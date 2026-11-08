/**
 * Decodes a UTF-16 string into an array of Unicode code points (U+0000 to U+10FFFF).
 * Correctly combines surrogate pairs into single code points and preserves lone surrogates.
 */
export function decodeUtf16(input: string): number[] {
  const codePoints: number[] = [];
  const len = input.length;
  for (let i = 0; i < len; ) {
    const cp = input.codePointAt(i);
    if (cp === undefined) {
      break;
    }
    codePoints.push(cp);
    i += cp > 0xffff ? 2 : 1;
  }
  return codePoints;
}

/**
 * Computes code unit start offsets for each code point in the UTF-16 string,
 * with an extra trailing offset equal to input.length.
 */
export function codePointOffsets(input: string): number[] {
  const offsets: number[] = [];
  const len = input.length;
  for (let i = 0; i < len; ) {
    offsets.push(i);
    const cp = input.codePointAt(i);
    if (cp === undefined) {
      break;
    }
    i += cp > 0xffff ? 2 : 1;
  }
  offsets.push(len);
  return offsets;
}

/**
 * Returns all case variants of a given Unicode code point.
 */
export function getCaseFoldedCodePoints(codePoint: number): number[] {
  const set = new Set<number>([codePoint]);

  if (codePoint >= 65 && codePoint <= 90) {
    set.add(codePoint + 32);
    return Array.from(set);
  }
  if (codePoint >= 97 && codePoint <= 122) {
    set.add(codePoint - 32);
    return Array.from(set);
  }

  try {
    const s = String.fromCodePoint(codePoint);
    const upper = s.toUpperCase();
    const lower = s.toLowerCase();
    for (let i = 0; i < upper.length; ) {
      const cp = upper.codePointAt(i);
      if (cp !== undefined) {
        set.add(cp);
        i += cp > 0xffff ? 2 : 1;
      } else {
        break;
      }
    }
    for (let i = 0; i < lower.length; ) {
      const cp = lower.codePointAt(i);
      if (cp !== undefined) {
        set.add(cp);
        i += cp > 0xffff ? 2 : 1;
      } else {
        break;
      }
    }
  } catch {
    // Invalid code point fallback
  }

  return Array.from(set);
}

/**
 * Normalizes and merges overlapping or adjacent character ranges.
 */
export function normalizeRanges(
  ranges: readonly (readonly [number, number])[],
): [number, number][] {
  if (ranges.length === 0) return [];

  const valid = ranges
    .filter(([min, max]) => min <= max && min >= 0 && max <= 0x10ffff)
    .map(([min, max]) => [min, max] as [number, number]);

  valid.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const first = valid[0];
  if (!first) return [];

  const merged: [number, number][] = [];
  let current: [number, number] = [first[0], first[1]];

  for (let i = 1; i < valid.length; i++) {
    const next = valid[i];
    if (!next) continue;
    if (next[0] <= current[1] + 1) {
      current[1] = Math.max(current[1], next[1]);
    } else {
      merged.push(current);
      current = [next[0], next[1]];
    }
  }
  merged.push(current);
  return merged;
}

/**
 * Computes the complement of the given ranges in the range [0, 0x10FFFF].
 */
export function invertRanges(ranges: readonly (readonly [number, number])[]): [number, number][] {
  const merged = normalizeRanges(ranges);
  const inverted: [number, number][] = [];
  let cur = 0;

  for (const [min, max] of merged) {
    if (min > cur) {
      inverted.push([cur, min - 1]);
    }
    cur = Math.max(cur, max + 1);
    if (cur > 0x10ffff) break;
  }

  if (cur <= 0x10ffff) {
    inverted.push([cur, 0x10ffff]);
  }

  return inverted;
}

/**
 * Checks if code point is an ASCII word character [0-9A-Za-z_].
 */
export function isWordChar(cp: number | undefined): boolean {
  if (cp === undefined) return false;
  return (cp >= 48 && cp <= 57) || (cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122) || cp === 95;
}
