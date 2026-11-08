/**
 * Unicode and string context utilities for regex engines.
 */

/**
 * Checks if a Unicode code point is an ASCII word character [a-zA-Z0-9_].
 */
export function isWordCodePoint(cp: number): boolean {
  return (
    (cp >= 48 && cp <= 57) || // 0-9
    (cp >= 65 && cp <= 90) || // A-Z
    (cp >= 97 && cp <= 122) || // a-z
    cp === 95 // _
  );
}

/**
 * Returns the code point immediately before the given UTF-16 code unit index.
 */
export function codePointBefore(input: string, pos: number): number {
  if (pos <= 0) {
    return -1;
  }
  const low = input.charCodeAt(pos - 1);
  if (pos >= 2 && low >= 0xdc00 && low <= 0xdfff) {
    const high = input.charCodeAt(pos - 2);
    if (high >= 0xd800 && high <= 0xdbff) {
      return input.codePointAt(pos - 2) ?? low;
    }
  }
  return low;
}

/**
 * Evaluates anchor conditions at a specific UTF-16 index in an input string.
 */
export function checkAnchor(
  kind:
    | "start_line"
    | "end_line"
    | "start_text"
    | "end_text"
    | "word_boundary"
    | "not_word_boundary"
    | undefined,
  pos: number,
  input: string,
): boolean {
  switch (kind) {
    case "start_text":
      return pos === 0;
    case "end_text":
      return pos === input.length;
    case "start_line": {
      if (pos === 0) return true;
      const prev = input.charCodeAt(pos - 1);
      return prev === 10 || prev === 13;
    }
    case "end_line": {
      if (pos === input.length) return true;
      const next = input.charCodeAt(pos);
      return next === 10 || next === 13;
    }
    case "word_boundary": {
      const left = pos > 0 ? isWordCodePoint(codePointBefore(input, pos)) : false;
      const right = pos < input.length ? isWordCodePoint(input.codePointAt(pos) ?? -1) : false;
      return left !== right;
    }
    case "not_word_boundary": {
      const left = pos > 0 ? isWordCodePoint(codePointBefore(input, pos)) : false;
      const right = pos < input.length ? isWordCodePoint(input.codePointAt(pos) ?? -1) : false;
      return left === right;
    }
    default:
      return false;
  }
}
