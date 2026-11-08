import { describe, expect, it } from "vitest";
import { PikeVm } from "../../src/engine/pike.js";
import { buildTestNfa } from "./nfa-helper.js";

describe("Pike VM Submatch Extraction", () => {
  it("extracts captures correctly for matching input", () => {
    const nfa = buildTestNfa("(\\w+)\\:(\\d+)");
    const vm = new PikeVm(nfa);
    const res = vm.execute("hello:123");
    expect(res.matched).toBe(true);
    expect(res.match?.match).toBe("hello:123");
    expect(res.match?.captures).toEqual(["hello", "123"]);
  });

  it("returns null match for non-matching input", () => {
    const nfa = buildTestNfa("^a$");
    const vm = new PikeVm(nfa);
    const res = vm.execute("b");
    expect(res.matched).toBe(false);
    expect(res.match).toBeNull();
  });

  it("handles startIndex beyond input length", () => {
    const nfa = buildTestNfa("a");
    const vm = new PikeVm(nfa);
    const res = vm.execute("a", 10);
    expect(res.matched).toBe(false);
  });
});
