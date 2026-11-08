import type { RegexMatch } from "../parser/index.js";

/**
 * Advances index by one UTF-16 code point (handling surrogate pairs properly).
 *
 * @param input - The input string.
 * @param index - Current UTF-16 code unit offset.
 * @returns The next code point offset.
 */
export function advanceCodePoint(input: string, index: number): number {
  if (index < input.length) {
    const code = input.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff && index + 1 < input.length) {
      const nextCode = input.charCodeAt(index + 1);
      if (nextCode >= 0xdc00 && nextCode <= 0xdfff) {
        return index + 2;
      }
    }
  }
  return index + 1;
}

/**
 * Substitutes replacement patterns into a matched substring according to
 * ECMAScript GetSubstitution rules, supporting $1-$99, $&, $0, $`, $', $$,
 * and $<name> or ${name} named groups.
 *
 * @param template - Replacement string template.
 * @param match - The regex match object.
 * @param input - The original input string.
 * @returns The expanded replacement string.
 */
export function substituteReplacement(template: string, match: RegexMatch, input: string): string {
  let result = "";
  let i = 0;
  const len = template.length;

  while (i < len) {
    const ch = template[i];
    if (ch !== "$") {
      result += ch;
      i++;
      continue;
    }

    // Trailing '$' character
    if (i + 1 >= len) {
      result += "$";
      i++;
      break;
    }

    const next = template[i + 1];
    if (next === undefined) {
      result += "$";
      i++;
      break;
    }

    // '$$' -> literal '$'
    if (next === "$") {
      result += "$";
      i += 2;
      continue;
    }

    // '$&' or '$0' -> entire matched text
    if (next === "&" || next === "0") {
      result += match.match;
      i += 2;
      continue;
    }

    // '$`' -> prefix before matched substring
    if (next === "`") {
      result += input.slice(0, match.index);
      i += 2;
      continue;
    }

    // "$'" -> suffix after matched substring
    if (next === "'") {
      result += input.slice(match.index + match.length);
      i += 2;
      continue;
    }

    // '$<name>' -> named group substitution
    if (next === "<") {
      const closing = template.indexOf(">", i + 2);
      if (closing !== -1) {
        const groupName = template.slice(i + 2, closing);
        if (groupName in match.groups) {
          result += match.groups[groupName] ?? "";
        } else {
          result += template.slice(i, closing + 1);
        }
        i = closing + 1;
        continue;
      }
      result += "$";
      i++;
      continue;
    }

    // '${name}' or '${n}' -> alternative named/numbered group substitution
    if (next === "{") {
      const closing = template.indexOf("}", i + 2);
      if (closing !== -1) {
        const key = template.slice(i + 2, closing);
        if (key in match.groups) {
          result += match.groups[key] ?? "";
        } else {
          const num = Number.parseInt(key, 10);
          if (
            !Number.isNaN(num) &&
            String(num) === key &&
            num >= 1 &&
            num <= match.captures.length
          ) {
            result += match.captures[num - 1] ?? "";
          } else {
            result += template.slice(i, closing + 1);
          }
        }
        i = closing + 1;
        continue;
      }
      result += "$";
      i++;
      continue;
    }

    // Decimal numbered captures: '$1'-'$99'
    if (next >= "1" && next <= "9") {
      const d1 = Number.parseInt(next, 10);
      let matchedTwoDigits = false;
      let twoDigitNum = 0;

      const nextNext = template[i + 2];
      if (i + 2 < len && nextNext !== undefined && nextNext >= "0" && nextNext <= "9") {
        twoDigitNum = Number.parseInt(template.slice(i + 1, i + 3), 10);
        if (twoDigitNum <= match.captures.length) {
          matchedTwoDigits = true;
        }
      }

      if (matchedTwoDigits) {
        result += match.captures[twoDigitNum - 1] ?? "";
        i += 3;
        continue;
      }

      if (d1 <= match.captures.length) {
        result += match.captures[d1 - 1] ?? "";
        i += 2;
        continue;
      }

      // Neither two-digit nor single digit is within capture count; leave literal
      result += template.slice(i, i + 2);
      i += 2;
      continue;
    }

    // Unrecognized sequence after '$'; leave '$'
    result += "$";
    i++;
  }

  return result;
}
