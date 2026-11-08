import type { AstNode, AstRoot, FlagSet } from "./ast.js";
import {
  DIGIT_RANGES,
  invertRanges,
  MAX_CODE_POINT,
  mergeRanges,
  SPACE_RANGES,
  WORD_RANGES,
} from "./ranges.js";
import {
  type CompileOptions,
  LimitExceededError,
  RegexSyntaxError,
  UnsupportedFeatureError,
} from "./types.js";

const DEFAULT_MAX_PATTERN_LENGTH = 4096;
const DEFAULT_MAX_DEPTH = 64;

/**
 * Parses regex flag string into a typed FlagSet.
 */
export function parseFlags(flags = ""): FlagSet {
  let caseInsensitive = false;
  let multiline = false;
  let dotAll = false;
  let ungreedy = false;

  const seen = new Set<string>();

  for (let i = 0; i < flags.length; i++) {
    const ch = flags[i];
    if (ch === undefined) {
      continue;
    }
    if (seen.has(ch)) {
      throw new RegexSyntaxError(`Duplicate flag: ${ch}`, 0);
    }
    seen.add(ch);

    switch (ch) {
      case "i":
        caseInsensitive = true;
        break;
      case "m":
        multiline = true;
        break;
      case "s":
        dotAll = true;
        break;
      case "U":
        ungreedy = true;
        break;
      case "u":
      case "g":
        break;
      default:
        throw new RegexSyntaxError(`Unknown flag: ${ch}`, 0);
    }
  }

  return {
    caseInsensitive,
    multiline,
    dotAll,
    ungreedy,
  };
}

/**
 * Parses a regular expression pattern and flags into an AST root.
 */
export function parseRegex(pattern: string, flags = "", options?: CompileOptions): AstRoot {
  const maxPatternLength = options?.maxPatternLength ?? DEFAULT_MAX_PATTERN_LENGTH;
  if (maxPatternLength < 0) {
    throw new LimitExceededError(`Invalid maxPatternLength: ${maxPatternLength}`);
  }
  if (pattern.length > maxPatternLength) {
    throw new LimitExceededError(
      `Pattern length ${pattern.length} exceeds maxPatternLength limit of ${maxPatternLength}`,
    );
  }

  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  if (maxDepth < 0) {
    throw new LimitExceededError(`Invalid maxDepth: ${maxDepth}`);
  }

  const flagSet = parseFlags(flags);
  let pos = 0;
  let depth = 0;
  let captureCount = 0;
  const groupNames = new Map<string, number>();

  function parseAlt(): AstNode {
    const branches: AstNode[] = [parseConcat()];
    while (pos < pattern.length && pattern[pos] === "|") {
      pos++;
      branches.push(parseConcat());
    }
    const firstBranch = branches[0];
    if (branches.length === 1 && firstBranch !== undefined) {
      return firstBranch;
    }
    return { type: "alt", children: branches };
  }

  function parseConcat(): AstNode {
    const children: AstNode[] = [];
    while (pos < pattern.length && pattern[pos] !== "|" && pattern[pos] !== ")") {
      children.push(parseRepetition());
    }
    const firstChild = children[0];
    if (children.length === 1 && firstChild !== undefined) {
      return firstChild;
    }
    return { type: "concat", children };
  }

  function parseRepetition(): AstNode {
    let node = parseAtom();
    if (pos >= pattern.length) {
      return node;
    }

    const ch = pattern[pos];
    if (ch === "*" || ch === "+" || ch === "?") {
      pos++;
      let min = 0;
      let max = Infinity;
      if (ch === "*") {
        min = 0;
        max = Infinity;
      } else if (ch === "+") {
        min = 1;
        max = Infinity;
      } else {
        min = 0;
        max = 1;
      }

      let greedy = !flagSet.ungreedy;
      if (pos < pattern.length && pattern[pos] === "?") {
        pos++;
        greedy = !greedy;
      } else if (pos < pattern.length && pattern[pos] === "+") {
        throw new UnsupportedFeatureError("Possessive quantifiers are not supported");
      }

      if (
        pos < pattern.length &&
        (pattern[pos] === "*" || pattern[pos] === "+" || pattern[pos] === "?")
      ) {
        throw new RegexSyntaxError("Multiple repeat characters", pos);
      }

      node = {
        type: "repetition",
        child: node,
        min,
        max,
        greedy,
      };
    } else if (ch === "{") {
      const match = pattern.slice(pos).match(/^\{(\d+)(?:,(\d*))?\}/);
      if (!match) {
        throw new RegexSyntaxError("Incomplete or invalid quantifier", pos);
      }
      const fullMatch = match[0];
      const minStr = match[1];
      if (fullMatch === undefined || minStr === undefined) {
        throw new RegexSyntaxError("Incomplete or invalid quantifier", pos);
      }
      const min = Number.parseInt(minStr, 10);
      let max: number;
      if (match[2] === undefined) {
        max = min;
      } else if (match[2] === "") {
        max = Infinity;
      } else {
        max = Number.parseInt(match[2], 10);
        if (max < min) {
          throw new RegexSyntaxError("Numbers out of order in {} quantifier", pos);
        }
      }

      if (min > 10000 || (max !== Infinity && max > 10000)) {
        throw new LimitExceededError("Repetition count exceeds maximum allowed limit of 10000");
      }

      pos += fullMatch.length;

      let greedy = !flagSet.ungreedy;
      if (pos < pattern.length && pattern[pos] === "?") {
        pos++;
        greedy = !greedy;
      } else if (pos < pattern.length && pattern[pos] === "+") {
        throw new UnsupportedFeatureError("Possessive quantifiers are not supported");
      }

      if (
        pos < pattern.length &&
        (pattern[pos] === "*" || pattern[pos] === "+" || pattern[pos] === "?")
      ) {
        throw new RegexSyntaxError("Multiple repeat characters", pos);
      }

      node = {
        type: "repetition",
        child: node,
        min,
        max,
        greedy,
      };
    }

    return node;
  }

  function parseAtom(): AstNode {
    if (pos >= pattern.length) {
      return { type: "concat", children: [] };
    }

    const ch = pattern[pos];
    if (ch === undefined) {
      return { type: "concat", children: [] };
    }
    if (ch === "*" || ch === "+" || ch === "?" || ch === "{") {
      throw new RegexSyntaxError("Quantifier has nothing to repeat", pos);
    }

    if (ch === ".") {
      pos++;
      return { type: "dot" };
    }

    if (ch === "^") {
      pos++;
      return {
        type: "anchor",
        kind: flagSet.multiline ? "start_line" : "start_text",
      };
    }

    if (ch === "$") {
      pos++;
      return {
        type: "anchor",
        kind: flagSet.multiline ? "end_line" : "end_text",
      };
    }

    if (ch === "[") {
      return parseCharClass();
    }

    if (ch === "(") {
      return parseGroup();
    }

    if (ch === "\\") {
      return parseEscape();
    }

    const codePoint = pattern.codePointAt(pos);
    if (codePoint === undefined) {
      throw new RegexSyntaxError("Unexpected end of pattern", pos);
    }
    const charLen = codePoint > 0xffff ? 2 : 1;
    pos += charLen;
    return { type: "literal", codePoint };
  }

  function parseGroup(): AstNode {
    const groupStartPos = pos;
    pos++; // consume '('

    depth++;
    if (depth > maxDepth) {
      throw new LimitExceededError(`Pattern nesting depth exceeds maxDepth limit of ${maxDepth}`);
    }

    try {
      if (pos < pattern.length && pattern[pos] === "?") {
        pos++;
        if (pos >= pattern.length) {
          throw new RegexSyntaxError("Incomplete group syntax", groupStartPos);
        }

        const nextChar = pattern[pos];
        if (nextChar === "=") {
          throw new UnsupportedFeatureError("Lookahead assertions are not supported: (?=");
        }
        if (nextChar === "!") {
          throw new UnsupportedFeatureError("Negative lookahead assertions are not supported: (?!");
        }
        if (nextChar === "<") {
          pos++;
          if (pos < pattern.length && pattern[pos] === "=") {
            throw new UnsupportedFeatureError("Lookbehind assertions are not supported: (?<=");
          }
          if (pos < pattern.length && pattern[pos] === "!") {
            throw new UnsupportedFeatureError(
              "Negative lookbehind assertions are not supported: (?<!",
            );
          }
          return parseNamedGroup(groupStartPos);
        }
        if (nextChar === "P") {
          pos++;
          if (pos < pattern.length && pattern[pos] === "<") {
            pos++;
            return parseNamedGroup(groupStartPos);
          }
          if (pos < pattern.length && pattern[pos] === "=") {
            throw new UnsupportedFeatureError("Named backreferences are not supported: (?P=");
          }
          throw new RegexSyntaxError("Invalid (?P...) syntax", groupStartPos);
        }
        if (nextChar === ">") {
          throw new UnsupportedFeatureError("Atomic groups are not supported: (?>");
        }
        if (nextChar === "(") {
          throw new UnsupportedFeatureError("Conditional patterns are not supported: (?(");
        }
        if (nextChar === ":") {
          pos++;
          const child = parseAlt();
          if (pos >= pattern.length || pattern[pos] !== ")") {
            throw new RegexSyntaxError("Unterminated group", groupStartPos);
          }
          pos++; // consume ')'
          return { type: "group", capturing: false, child };
        }

        throw new RegexSyntaxError(`Unknown group syntax: (?${nextChar}`, groupStartPos);
      }

      captureCount++;
      const groupIndex = captureCount;
      const child = parseAlt();
      if (pos >= pattern.length || pattern[pos] !== ")") {
        throw new RegexSyntaxError("Unterminated group", groupStartPos);
      }
      pos++; // consume ')'
      return { type: "group", capturing: true, index: groupIndex, child };
    } finally {
      depth--;
    }
  }

  function parseNamedGroup(groupStartPos: number): AstNode {
    const gtIndex = pattern.indexOf(">", pos);
    if (gtIndex === -1) {
      throw new RegexSyntaxError("Unterminated group name", groupStartPos);
    }
    const name = pattern.slice(pos, gtIndex);
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new RegexSyntaxError(`Invalid group name: ${name}`, pos);
    }
    if (groupNames.has(name)) {
      throw new RegexSyntaxError(`Duplicate group name: ${name}`, pos);
    }
    captureCount++;
    const groupIndex = captureCount;
    groupNames.set(name, groupIndex);
    pos = gtIndex + 1;

    const child = parseAlt();
    if (pos >= pattern.length || pattern[pos] !== ")") {
      throw new RegexSyntaxError("Unterminated group", groupStartPos);
    }
    pos++; // consume ')'
    return { type: "group", capturing: true, index: groupIndex, name, child };
  }

  function parseCharClass(): AstNode {
    const classStartPos = pos;
    pos++; // consume '['

    let inverted = false;
    if (pos < pattern.length && pattern[pos] === "^") {
      inverted = true;
      pos++;
    }

    const ranges: [number, number][] = [];

    if (pos < pattern.length && pattern[pos] === "-") {
      ranges.push([45, 45]);
      pos++;
    }

    while (pos < pattern.length && pattern[pos] !== "]") {
      if (pattern[pos] === "\\") {
        const escPos = pos;
        pos++;
        if (pos >= pattern.length) {
          throw new RegexSyntaxError("Unterminated character class", classStartPos);
        }
        const ch = pattern[pos];
        if (ch === undefined) {
          throw new RegexSyntaxError("Unterminated character class", classStartPos);
        }
        if (ch === "d") {
          pos++;
          ranges.push(...DIGIT_RANGES.map((r) => [r[0], r[1]] as [number, number]));
          continue;
        }
        if (ch === "D") {
          pos++;
          ranges.push(...invertRanges(DIGIT_RANGES));
          continue;
        }
        if (ch === "w") {
          pos++;
          ranges.push(...WORD_RANGES.map((r) => [r[0], r[1]] as [number, number]));
          continue;
        }
        if (ch === "W") {
          pos++;
          ranges.push(...invertRanges(WORD_RANGES));
          continue;
        }
        if (ch === "s") {
          pos++;
          ranges.push(...SPACE_RANGES.map((r) => [r[0], r[1]] as [number, number]));
          continue;
        }
        if (ch === "S") {
          pos++;
          ranges.push(...invertRanges(SPACE_RANGES));
          continue;
        }
        pos = escPos;
      }

      const startCp = parseSingleClassCodePoint(classStartPos);

      if (
        pos < pattern.length &&
        pattern[pos] === "-" &&
        pos + 1 < pattern.length &&
        pattern[pos + 1] !== "]"
      ) {
        pos++; // consume '-'
        const endCp = parseSingleClassCodePoint(classStartPos);
        if (endCp < startCp) {
          throw new RegexSyntaxError("Range out of order in character class", pos);
        }
        ranges.push([startCp, endCp]);
      } else {
        ranges.push([startCp, startCp]);
      }
    }

    if (pos >= pattern.length) {
      throw new RegexSyntaxError("Unterminated character class", classStartPos);
    }
    pos++; // consume ']'

    const merged = mergeRanges(ranges);
    return {
      type: "charClass",
      ranges: merged,
      inverted,
    };
  }

  function parseSingleClassCodePoint(classStartPos: number): number {
    if (pos >= pattern.length) {
      throw new RegexSyntaxError("Unterminated character class", classStartPos);
    }

    if (pattern[pos] === "\\") {
      const escPos = pos;
      pos++;
      if (pos >= pattern.length) {
        throw new RegexSyntaxError("Unterminated character class", classStartPos);
      }
      const ch = pattern[pos];
      if (ch === undefined) {
        throw new RegexSyntaxError("Unterminated character class", classStartPos);
      }
      if (ch === "b") {
        pos++;
        return 8; // backspace inside character class
      }
      if (ch === "n") {
        pos++;
        return 10;
      }
      if (ch === "r") {
        pos++;
        return 13;
      }
      if (ch === "t") {
        pos++;
        return 9;
      }
      if (ch === "f") {
        pos++;
        return 12;
      }
      if (ch === "v") {
        pos++;
        return 11;
      }
      if (ch === "a") {
        pos++;
        return 7;
      }
      if (ch === "e") {
        pos++;
        return 27;
      }
      if (ch === "0") {
        pos++;
        return 0;
      }
      if (ch === "x") {
        return parseHexEscape(escPos);
      }
      if (ch === "u") {
        return parseUnicodeEscape(escPos);
      }
      if (ch === "c") {
        return parseControlEscape(escPos);
      }
      if (ch >= "1" && ch <= "9") {
        throw new UnsupportedFeatureError(`Backreferences are not supported: \\${ch}`);
      }
      const cp = pattern.codePointAt(pos);
      if (cp === undefined) {
        throw new RegexSyntaxError("Unterminated character class", classStartPos);
      }
      const charLen = cp > 0xffff ? 2 : 1;
      pos += charLen;
      return cp;
    }

    const cp = pattern.codePointAt(pos);
    if (cp === undefined) {
      throw new RegexSyntaxError("Unterminated character class", classStartPos);
    }
    const charLen = cp > 0xffff ? 2 : 1;
    pos += charLen;
    return cp;
  }

  function parseHexEscape(escPos: number): number {
    pos++; // consume 'x'
    if (pos + 2 > pattern.length) {
      throw new RegexSyntaxError("Invalid hex escape \\x", escPos);
    }
    const hex = pattern.slice(pos, pos + 2);
    if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
      throw new RegexSyntaxError(`Invalid hex escape \\x${hex}`, escPos);
    }
    pos += 2;
    return Number.parseInt(hex, 16);
  }

  function parseUnicodeEscape(escPos: number): number {
    pos++; // consume 'u'
    if (pos < pattern.length && pattern[pos] === "{") {
      pos++; // consume '{'
      const closeBrace = pattern.indexOf("}", pos);
      if (closeBrace === -1) {
        throw new RegexSyntaxError("Unclosed unicode escape \\u{", escPos);
      }
      const hex = pattern.slice(pos, closeBrace);
      if (!/^[0-9a-fA-F]{1,6}$/.test(hex)) {
        throw new RegexSyntaxError(`Invalid unicode escape \\u{${hex}}`, escPos);
      }
      const cp = Number.parseInt(hex, 16);
      if (cp > MAX_CODE_POINT) {
        throw new RegexSyntaxError("Unicode code point out of range", escPos);
      }
      pos = closeBrace + 1;
      return cp;
    }

    if (pos + 4 > pattern.length) {
      throw new RegexSyntaxError("Invalid unicode escape \\u", escPos);
    }
    const hex = pattern.slice(pos, pos + 4);
    if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
      throw new RegexSyntaxError(`Invalid unicode escape \\u${hex}`, escPos);
    }
    pos += 4;
    return Number.parseInt(hex, 16);
  }

  function parseControlEscape(escPos: number): number {
    pos++; // consume 'c'
    const ch = pattern[pos];
    if (pos >= pattern.length || ch === undefined || !/^[a-zA-Z]$/.test(ch)) {
      throw new RegexSyntaxError("Invalid control escape \\c", escPos);
    }
    const cp = pattern.charCodeAt(pos) % 32;
    pos++;
    return cp;
  }

  function parseEscape(): AstNode {
    const escPos = pos;
    pos++; // consume '\\'

    if (pos >= pattern.length) {
      throw new RegexSyntaxError("Trailing backslash at end of pattern", escPos);
    }

    const ch = pattern[pos];
    if (ch === undefined) {
      throw new RegexSyntaxError("Trailing backslash at end of pattern", escPos);
    }
    if (ch >= "1" && ch <= "9") {
      throw new UnsupportedFeatureError(`Backreferences are not supported: \\${ch}`);
    }
    if (ch === "k") {
      throw new UnsupportedFeatureError("Named backreferences are not supported: \\k");
    }
    if (ch === "b") {
      pos++;
      return { type: "anchor", kind: "word_boundary" };
    }
    if (ch === "B") {
      pos++;
      return { type: "anchor", kind: "not_word_boundary" };
    }
    if (ch === "A") {
      pos++;
      return { type: "anchor", kind: "start_text" };
    }
    if (ch === "z" || ch === "Z") {
      pos++;
      return { type: "anchor", kind: "end_text" };
    }
    if (ch === "d") {
      pos++;
      return { type: "charClass", ranges: DIGIT_RANGES, inverted: false };
    }
    if (ch === "D") {
      pos++;
      return { type: "charClass", ranges: DIGIT_RANGES, inverted: true };
    }
    if (ch === "w") {
      pos++;
      return { type: "charClass", ranges: WORD_RANGES, inverted: false };
    }
    if (ch === "W") {
      pos++;
      return { type: "charClass", ranges: WORD_RANGES, inverted: true };
    }
    if (ch === "s") {
      pos++;
      return { type: "charClass", ranges: SPACE_RANGES, inverted: false };
    }
    if (ch === "S") {
      pos++;
      return { type: "charClass", ranges: SPACE_RANGES, inverted: true };
    }
    if (ch === "p" || ch === "P") {
      throw new UnsupportedFeatureError(`Unicode properties are not supported: \\${ch}`);
    }
    if (ch === "n") {
      pos++;
      return { type: "literal", codePoint: 10 };
    }
    if (ch === "r") {
      pos++;
      return { type: "literal", codePoint: 13 };
    }
    if (ch === "t") {
      pos++;
      return { type: "literal", codePoint: 9 };
    }
    if (ch === "f") {
      pos++;
      return { type: "literal", codePoint: 12 };
    }
    if (ch === "v") {
      pos++;
      return { type: "literal", codePoint: 11 };
    }
    if (ch === "a") {
      pos++;
      return { type: "literal", codePoint: 7 };
    }
    if (ch === "e") {
      pos++;
      return { type: "literal", codePoint: 27 };
    }
    if (ch === "0") {
      pos++;
      return { type: "literal", codePoint: 0 };
    }
    if (ch === "x") {
      return { type: "literal", codePoint: parseHexEscape(escPos) };
    }
    if (ch === "u") {
      return { type: "literal", codePoint: parseUnicodeEscape(escPos) };
    }
    if (ch === "c") {
      return { type: "literal", codePoint: parseControlEscape(escPos) };
    }
    if (ch === "Q") {
      pos++; // consume 'Q'
      const endIdx = pattern.indexOf("\\E", pos);
      const text = endIdx === -1 ? pattern.slice(pos) : pattern.slice(pos, endIdx);
      pos = endIdx === -1 ? pattern.length : endIdx + 2;
      const lits: AstNode[] = [];
      for (let i = 0; i < text.length; ) {
        const cp = text.codePointAt(i);
        if (cp === undefined) {
          break;
        }
        lits.push({ type: "literal", codePoint: cp });
        i += cp > 0xffff ? 2 : 1;
      }
      const firstLit = lits[0];
      if (lits.length === 1 && firstLit !== undefined) {
        return firstLit;
      }
      return { type: "concat", children: lits };
    }

    if (/^[a-zA-Z]$/.test(ch)) {
      throw new RegexSyntaxError(`Unknown escape sequence: \\${ch}`, escPos);
    }

    const cp = pattern.codePointAt(pos);
    if (cp === undefined) {
      throw new RegexSyntaxError("Unexpected end of pattern", pos);
    }
    const charLen = cp > 0xffff ? 2 : 1;
    pos += charLen;
    return { type: "literal", codePoint: cp };
  }

  const root = parseAlt();
  if (pos < pattern.length) {
    if (pattern[pos] === ")") {
      throw new RegexSyntaxError("Unmatched closing parenthesis", pos);
    }
    throw new RegexSyntaxError(`Unexpected character '${pattern[pos]}'`, pos);
  }

  return {
    root,
    flags: flagSet,
    captureCount,
    groupNames,
  };
}
