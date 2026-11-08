import { describe, expect, it } from "vitest";
import {
  compile,
  invertRanges,
  LimitExceededError,
  mergeRanges,
  parseFlags,
  parseRegex,
  RegexSyntaxError,
  UnsupportedFeatureError,
} from "../../src/parser/index.js";

describe("Parser Acceptance Criteria", () => {
  it("IF the pattern contains a backreference '(a)\\1' or lookaround '(?=a)' THEN compile throws UnsupportedFeatureError with code 'UNSUPPORTED_FEATURE'", () => {
    expect(() => compile("(a)\\1")).toThrow(UnsupportedFeatureError);
    expect(() => parseRegex("(a)\\1")).toThrow(UnsupportedFeatureError);
    try {
      compile("(a)\\1");
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedFeatureError);
      expect((e as UnsupportedFeatureError).code).toBe("UNSUPPORTED_FEATURE");
    }

    expect(() => compile("(?=a)")).toThrow(UnsupportedFeatureError);
    expect(() => parseRegex("(?=a)")).toThrow(UnsupportedFeatureError);
    try {
      compile("(?=a)");
    } catch (e) {
      expect(e).toBeInstanceOf(UnsupportedFeatureError);
      expect((e as UnsupportedFeatureError).code).toBe("UNSUPPORTED_FEATURE");
    }
  });

  it("IF the pattern is '[a-' or '(abc' THEN compile throws RegexSyntaxError with code 'PARSE_ERROR' and a position of at least 0", () => {
    expect(() => compile("[a-")).toThrow(RegexSyntaxError);
    try {
      compile("[a-");
    } catch (e) {
      expect(e).toBeInstanceOf(RegexSyntaxError);
      const err = e as RegexSyntaxError;
      expect(err.code).toBe("PARSE_ERROR");
      expect(err.position).toBeGreaterThanOrEqual(0);
    }

    expect(() => compile("(abc")).toThrow(RegexSyntaxError);
    try {
      compile("(abc");
    } catch (e) {
      expect(e).toBeInstanceOf(RegexSyntaxError);
      const err = e as RegexSyntaxError;
      expect(err.code).toBe("PARSE_ERROR");
      expect(err.position).toBeGreaterThanOrEqual(0);
    }
  });

  it("WHEN pattern length exceeds default maxPatternLength 4096 or nesting exceeds maxDepth 64 THEN compile throws LimitExceededError with code 'LIMIT_EXCEEDED'", () => {
    const longPattern = "a".repeat(4097);
    expect(() => compile(longPattern)).toThrow(LimitExceededError);
    try {
      compile(longPattern);
    } catch (e) {
      expect(e).toBeInstanceOf(LimitExceededError);
      expect((e as LimitExceededError).code).toBe("LIMIT_EXCEEDED");
    }

    const deepPattern = `${"(".repeat(65)}a${")".repeat(65)}`;
    expect(() => compile(deepPattern)).toThrow(LimitExceededError);
    try {
      compile(deepPattern);
    } catch (e) {
      expect(e).toBeInstanceOf(LimitExceededError);
      expect((e as LimitExceededError).code).toBe("LIMIT_EXCEEDED");
    }
  });
});

describe("Parser Adversarial Neighbours & Unsupported Features", () => {
  it("rejects backreferences adjacent to literals and symbols", () => {
    expect(() => compile("prefix(a)\\1suffix")).toThrow(UnsupportedFeatureError);
    expect(() => compile("((foo)\\2)")).toThrow(UnsupportedFeatureError);
    expect(() => compile("\\9")).toThrow(UnsupportedFeatureError);
    expect(() => compile("\\k<group>")).toThrow(UnsupportedFeatureError);
    expect(() => compile("(?P=group)")).toThrow(UnsupportedFeatureError);
  });

  it("rejects all lookaround variations and atomic groups", () => {
    expect(() => compile("pre(?=a)post")).toThrow(UnsupportedFeatureError);
    expect(() => compile("(?!negative)")).toThrow(UnsupportedFeatureError);
    expect(() => compile("(?<=behind)")).toThrow(UnsupportedFeatureError);
    expect(() => compile("(?<!negbehind)")).toThrow(UnsupportedFeatureError);
    expect(() => compile("(?>atomic)")).toThrow(UnsupportedFeatureError);
    expect(() => compile("(?(1)then|else)")).toThrow(UnsupportedFeatureError);
    expect(() => compile("\\p{Greek}")).toThrow(UnsupportedFeatureError);
    expect(() => compile("\\P{L}")).toThrow(UnsupportedFeatureError);
    expect(() => compile("a*+")).toThrow(UnsupportedFeatureError);
    expect(() => compile("a++")).toThrow(UnsupportedFeatureError);
  });
});

describe("Parser Syntax Errors & Corner Cases", () => {
  it("throws on unclosed and invalid syntax", () => {
    expect(() => compile("[")).toThrow(RegexSyntaxError);
    expect(() => compile("[z-a]")).toThrow(RegexSyntaxError);
    expect(() => compile("abc)")).toThrow(RegexSyntaxError);
    expect(() => compile("*abc")).toThrow(RegexSyntaxError);
    expect(() => compile("a**")).toThrow(RegexSyntaxError);
    expect(() => compile("a{5,2}")).toThrow(RegexSyntaxError);
    expect(() => compile("a{invalid}")).toThrow(RegexSyntaxError);
    expect(() => compile("a\\")).toThrow(RegexSyntaxError);
    expect(() => compile("\\x1")).toThrow(RegexSyntaxError);
    expect(() => compile("\\u12")).toThrow(RegexSyntaxError);
    expect(() => compile("\\u{110000}")).toThrow(RegexSyntaxError);
    expect(() => compile("\\u{incomplete")).toThrow(RegexSyntaxError);
    expect(() => compile("\\c")).toThrow(RegexSyntaxError);
    expect(() => compile("\\q")).toThrow(RegexSyntaxError);
    expect(() => compile("(?")).toThrow(RegexSyntaxError);
    expect(() => compile("(?x)")).toThrow(RegexSyntaxError);
    expect(() => compile("(?<123>a)")).toThrow(RegexSyntaxError);
    expect(() => compile("(?<name>a)(?<name>b)")).toThrow(RegexSyntaxError);
    expect(() => compile("(?<unclosed")).toThrow(RegexSyntaxError);
    expect(() => compile("(?P<unclosed")).toThrow(RegexSyntaxError);
    expect(() => compile("(?P!bad)")).toThrow(RegexSyntaxError);
  });

  it("handles custom limits", () => {
    expect(() => compile("abc", "", { maxPatternLength: 2 })).toThrow(LimitExceededError);
    expect(() => compile("((a))", "", { maxDepth: 1 })).toThrow(LimitExceededError);
    expect(() => compile("a", "", { maxPatternLength: -1 })).toThrow(LimitExceededError);
    expect(() => compile("a", "", { maxDepth: -1 })).toThrow(LimitExceededError);
    expect(() => compile("a{20000}")).toThrow(LimitExceededError);
  });
});

describe("Parser Flags & AST construction", () => {
  it("parses valid flags and rejects invalid or duplicates", () => {
    const flags = parseFlags("imsUug");
    expect(flags).toEqual({
      caseInsensitive: true,
      multiline: true,
      dotAll: true,
      ungreedy: true,
    });

    expect(() => parseFlags("ii")).toThrow(RegexSyntaxError);
    expect(() => parseFlags("z")).toThrow(RegexSyntaxError);
  });

  it("constructs correct AST for literals, anchors, and escapes", () => {
    const ast = parseRegex(
      "^a.b$\\b\\B\\A\\z\\Z\\0\\t\\n\\r\\f\\v\\a\\e\\x41\\u0042\\u{1F600}\\cM\\Qfoo\\E",
    );
    expect(ast.flags.multiline).toBe(false);
    expect(ast.captureCount).toBe(0);
    expect(ast.root.type).toBe("concat");
  });

  it("constructs correct AST for multiline anchors", () => {
    const ast = parseRegex("^a$", "m");
    expect(ast.flags.multiline).toBe(true);
    if (ast.root.type === "concat") {
      expect(ast.root.children[0]).toEqual({ type: "anchor", kind: "start_line" });
      expect(ast.root.children[2]).toEqual({ type: "anchor", kind: "end_line" });
    }
  });

  it("constructs correct AST for character classes and negation", () => {
    const ast = parseRegex("[-a-c\\d\\s\\w\\D\\S\\W\\b\\-]");
    expect(ast.root.type).toBe("charClass");

    const inv = parseRegex("[^0-9]");
    if (inv.root.type === "charClass") {
      expect(inv.root.inverted).toBe(true);
      expect(inv.root.ranges).toEqual([[48, 57]]);
    }
  });

  it("constructs correct AST for groups and alternation", () => {
    const ast = parseRegex("(?P<id>[a-z]+):(?P<val>\\d+)|(?:other)");
    expect(ast.captureCount).toBe(2);
    expect(ast.groupNames.get("id")).toBe(1);
    expect(ast.groupNames.get("val")).toBe(2);
    expect(ast.root.type).toBe("alt");
  });

  it("constructs correct AST for repetitions and greediness toggling", () => {
    const ast = parseRegex("a*b+c?d{2,4}e*?");
    expect(ast.root.type).toBe("concat");

    const ungreedyAst = parseRegex("a*a*?", "U");
    if (ungreedyAst.root.type === "concat") {
      const first = ungreedyAst.root.children[0];
      const second = ungreedyAst.root.children[1];
      if (first?.type === "repetition" && second?.type === "repetition") {
        expect(first.greedy).toBe(false);
        expect(second.greedy).toBe(true);
      }
    }
  });

  it("handles empty pattern, empty groups, and empty branches", () => {
    const empty = parseRegex("");
    expect(empty.root).toEqual({ type: "concat", children: [] });

    const emptyGroup = parseRegex("()");
    expect(emptyGroup.captureCount).toBe(1);

    const altEmpty = parseRegex("a|");
    expect(altEmpty.root.type).toBe("alt");
  });
});

describe("Range Operations", () => {
  it("merges overlapping and adjacent ranges correctly", () => {
    expect(mergeRanges([])).toEqual([]);
    expect(mergeRanges([[10, 20]])).toEqual([[10, 20]]);
    expect(
      mergeRanges([
        [10, 20],
        [15, 25],
      ]),
    ).toEqual([[10, 25]]);
    expect(
      mergeRanges([
        [10, 20],
        [21, 30],
      ]),
    ).toEqual([[10, 30]]);
    expect(
      mergeRanges([
        [30, 40],
        [10, 20],
      ]),
    ).toEqual([
      [10, 20],
      [30, 40],
    ]);
  });

  it("inverts ranges correctly within Unicode bounds", () => {
    const inv = invertRanges([[48, 57]]);
    expect(inv[0]).toEqual([0, 47]);
    expect(inv[1]).toEqual([58, 0x10ffff]);
  });
});
