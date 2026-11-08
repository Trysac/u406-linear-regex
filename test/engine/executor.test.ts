import { describe, expect, it } from "vitest";
import { createExecutor, type EngineExecutorImpl } from "../../src/engine/executor.js";
import { checkAnchor, isWordCodePoint } from "../../src/engine/unicode.js";
import { buildTestNfa } from "./nfa-helper.js";

describe("EngineExecutorImpl and Unicode helpers", () => {
  it("tests anchor evaluations", () => {
    expect(checkAnchor("start_text", 0, "abc")).toBe(true);
    expect(checkAnchor("start_text", 1, "abc")).toBe(false);
    expect(checkAnchor("end_text", 3, "abc")).toBe(true);
    expect(checkAnchor("end_text", 2, "abc")).toBe(false);
    expect(checkAnchor("start_line", 0, "a")).toBe(true);
    expect(checkAnchor("start_line", 1, "\na")).toBe(true);
    expect(checkAnchor("end_line", 2, "ab")).toBe(true);
    expect(checkAnchor("end_line", 1, "a\nb")).toBe(true);
    expect(checkAnchor("word_boundary", 0, "a")).toBe(true);
    expect(checkAnchor("not_word_boundary", 1, "aa")).toBe(true);
    expect(checkAnchor(undefined, 0, "a")).toBe(false);
  });

  it("verifies word code points", () => {
    expect(isWordCodePoint(65)).toBe(true); // 'A'
    expect(isWordCodePoint(97)).toBe(true); // 'a'
    expect(isWordCodePoint(48)).toBe(true); // '0'
    expect(isWordCodePoint(95)).toBe(true); // '_'
    expect(isWordCodePoint(32)).toBe(false); // ' '
  });

  it("createExecutor initializes and tracks lastStats", () => {
    const nfa = buildTestNfa("foo");
    const executor = createExecutor(nfa) as EngineExecutorImpl;
    expect(executor.test("foo").matched).toBe(true);
    expect(executor.lastStats().engine).toBe("dfa");
    expect(executor.exec("foo").matched).toBe(true);
    expect(executor.lastStats().engine).toBe("pike");
  });
});
