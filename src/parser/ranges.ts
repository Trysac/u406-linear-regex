/**
 * Maximum Unicode code point.
 */
export const MAX_CODE_POINT = 0x10ffff;

/**
 * Predefined character class ranges.
 */
export const DIGIT_RANGES: readonly (readonly [number, number])[] = Object.freeze([[48, 57]]);
export const WORD_RANGES: readonly (readonly [number, number])[] = Object.freeze([
  [48, 57],
  [65, 90],
  [95, 95],
  [97, 122],
]);
export const SPACE_RANGES: readonly (readonly [number, number])[] = Object.freeze([
  [9, 13],
  [32, 32],
]);

/**
 * Sorts and merges contiguous or overlapping code point ranges.
 */
export function mergeRanges(ranges: readonly (readonly [number, number])[]): [number, number][] {
  if (ranges.length <= 1) {
    return ranges.map((r) => [r[0], r[1]]);
  }

  const sorted = ranges
    .map((r) => [r[0], r[1]] as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const first = sorted[0];
  if (first === undefined) {
    return [];
  }
  const result: [number, number][] = [[first[0], first[1]]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = result[result.length - 1];
    if (current === undefined || last === undefined) {
      continue;
    }

    if (current[0] <= last[1] + 1) {
      last[1] = Math.max(last[1], current[1]);
    } else {
      result.push([current[0], current[1]]);
    }
  }

  return result;
}

/**
 * Computes the complement of sorted merged ranges within [0, MAX_CODE_POINT].
 */
export function invertRanges(ranges: readonly (readonly [number, number])[]): [number, number][] {
  const result: [number, number][] = [];
  let current = 0;

  for (const [start, end] of ranges) {
    if (start > current) {
      result.push([current, start - 1]);
    }
    current = Math.max(current, end + 1);
  }

  if (current <= MAX_CODE_POINT) {
    result.push([current, MAX_CODE_POINT]);
  }

  return result;
}
