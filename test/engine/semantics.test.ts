import { describe, expect, it } from "vitest";
import { createExecutor } from "../../src/engine/index.js";
import { buildNfa } from "../../src/nfa/index.js";
import { parseRegex } from "../../src/parser/index.js";

// Manual pass 2026-11-08: through the approved parser and NFA modules, not the test-only builder.
function executor(pattern: string, flags?: string) {
  return createExecutor(buildNfa(parseRegex(pattern, flags)));
}

describe("Pike VM match priority", () => {
  it("extends a greedy repetition after a first match is reachable", () => {
    const match = executor(String.raw`(\w+):(\d+)`).exec("hello:123").match;
    expect(match?.match).toBe("hello:123");
    expect(match?.captures).toEqual(["hello", "123"]);
  });

  it("stops a lazy repetition at the shortest match", () => {
    expect(executor("a+?").exec("aaa").match?.match).toBe("a");
  });

  it("prefers the first alternative that leads to a match (leftmost-first)", () => {
    const match = executor("(a|ab)(c|bcd)").exec("abcd").match;
    expect(match?.match).toBe("abcd");
    expect(match?.captures).toEqual(["a", "bcd"]);
  });

  it("gives everything to the first of two greedy groups", () => {
    expect(executor("(a*)(a*)").exec("aaa").match?.captures).toEqual(["aaa", ""]);
  });

  it("returns the leftmost match", () => {
    const match = executor("b+").exec("aabbb").match;
    expect(match?.index).toBe(2);
    expect(match?.match).toBe("bbb");
  });

  it("maps named groups to their captures", () => {
    const match = executor(String.raw`(?P<id>[a-z]+):(?P<val>\d+)`).exec("foo:42").match;
    expect(match?.groups).toEqual({ id: "foo", val: "42" });
  });
});

describe("lazy DFA anchor context", () => {
  it("does not reuse an end-of-input transition in the middle of a later input", () => {
    const re = executor("a$");
    expect(re.test("aa").matched).toBe(true);
    expect(re.test("aab").matched).toBe(false);
  });

  it("does not reuse a word-boundary transition across inputs", () => {
    const re = executor(String.raw`a\b`);
    expect(re.test("a b").matched).toBe(true);
    expect(re.test("aab").matched).toBe(false);
  });

  it("agrees with the Pike VM on anchored patterns over shared executors", () => {
    const cases: [string, string][] = [
      ["^a", ""],
      ["a$", ""],
      [String.raw`\bab`, ""],
      [String.raw`b\B`, ""],
      ["^b$", "m"],
    ];
    const inputs = ["ab", "ba", "a\nb", "b\na", "aab", "abab", "b", ""];
    for (const [pattern, flags] of cases) {
      const re = executor(pattern, flags);
      for (const input of inputs) {
        expect(re.test(input).matched, `${pattern} on ${JSON.stringify(input)}`).toBe(
          re.exec(input).matched,
        );
      }
    }
  });
});
