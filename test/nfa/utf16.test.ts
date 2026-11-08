import { describe, expect, it } from "vitest";
import {
  codePointOffsets,
  decodeUtf16,
  getCaseFoldedCodePoints,
  invertRanges,
  isWordChar,
  normalizeRanges,
} from "../../src/nfa/index.js";

describe("UTF-16 decoding and Unicode utilities", () => {
  it("decodes ASCII and BMP characters", () => {
    const input = "hello";
    expect(decodeUtf16(input)).toEqual([104, 101, 108, 108, 111]);
  });

  it("decodes surrogate pairs into single code points", () => {
    // U+1F600 = 😀
    const emoji = "\uD83D\uDE00";
    const cps = decodeUtf16(emoji);
    expect(cps).toHaveLength(1);
    expect(cps[0]).toBe(0x1f600);
  });

  it("preserves lone surrogates", () => {
    const loneHigh = "\uD83D";
    expect(decodeUtf16(loneHigh)).toEqual([0xd83d]);

    const loneLow = "\uDE00";
    expect(decodeUtf16(loneLow)).toEqual([0xde00]);

    const reversed = "\uDE00\uD83D";
    expect(decodeUtf16(reversed)).toEqual([0xde00, 0xd83d]);
  });

  it("maps code point offsets to string indices accurately", () => {
    const mixed = "a\uD83D\uDE00b";
    const offsets = codePointOffsets(mixed);
    expect(offsets).toEqual([0, 1, 3, 4]);
    expect(mixed.slice(offsets[1], offsets[2])).toBe("\uD83D\uDE00");
  });

  it("folds ASCII and Unicode characters correctly", () => {
    expect(getCaseFoldedCodePoints(65)).toContain(97);
    expect(getCaseFoldedCodePoints(97)).toContain(65);
    expect(getCaseFoldedCodePoints(0x03b1)).toContain(0x0391);
  });

  it("normalizes overlapping and disjoint character ranges", () => {
    expect(normalizeRanges([])).toEqual([]);
    expect(
      normalizeRanges([
        [10, 20],
        [5, 12],
        [25, 30],
      ]),
    ).toEqual([
      [5, 20],
      [25, 30],
    ]);
  });

  it("inverts ranges correctly across Unicode space", () => {
    expect(invertRanges([])).toEqual([[0, 0x10ffff]]);
    expect(invertRanges([[0, 0x10ffff]])).toEqual([]);
    expect(invertRanges([[10, 20]])).toEqual([
      [0, 9],
      [21, 0x10ffff],
    ]);
  });

  it("identifies word characters correctly", () => {
    expect(isWordChar(65)).toBe(true); // 'A'
    expect(isWordChar(97)).toBe(true); // 'a'
    expect(isWordChar(48)).toBe(true); // '0'
    expect(isWordChar(95)).toBe(true); // '_'
    expect(isWordChar(32)).toBe(false); // ' '
    expect(isWordChar(undefined)).toBe(false);
  });
});
