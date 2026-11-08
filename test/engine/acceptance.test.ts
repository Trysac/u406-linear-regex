import { describe, expect, it } from "vitest";
import type { CompileOptions, RegexTraceEvent } from "../../interfaces/types.js";
import { PATHOLOGICAL_PATTERNS } from "../../src/engine/index.js";
import { compile } from "./test-utils.js";

describe("Engine acceptance criteria", () => {
  it("WHEN compile('(a+)+$').test runs on 'a'.repeat(n) + 'b' for n = 10000 and n = 100000 THEN both return false and lastStats().steps for n = 100000 is at most 11 times the value for n = 10000", () => {
    const re = compile("(a+)+$");
    const n1 = 10000;
    const n2 = 100000;

    const res1 = re.test(`${"a".repeat(n1)}b`);
    const steps1 = re.lastStats().steps;

    const res2 = re.test(`${"a".repeat(n2)}b`);
    const steps2 = re.lastStats().steps;

    expect(res1).toBe(false);
    expect(res2).toBe(false);
    expect(steps2).toBeLessThanOrEqual(11 * steps1);
  });

  it("WHEN each of the 10 documented pathological patterns, including '(a|aa)*b', runs on inputs of 10000 and 100000 code points THEN the step ratio stays at most 11", () => {
    expect(PATHOLOGICAL_PATTERNS).toHaveLength(10);
    const includesRequired = PATHOLOGICAL_PATTERNS.some((p) => p.pattern === "(a|aa)*b");
    expect(includesRequired).toBe(true);

    for (const item of PATHOLOGICAL_PATTERNS) {
      const re = compile(item.pattern);
      const in1 = item.makeInput(10000);
      const in2 = item.makeInput(100000);

      re.test(in1);
      const s1 = re.lastStats().steps;

      re.test(in2);
      const s2 = re.lastStats().steps;

      const ratio = s2 / s1;
      expect(ratio).toBeLessThanOrEqual(11);
    }
  });

  it("WHEN compile('(?:a|b)*c').test('abac') runs THEN it returns true and lastStats().engine is 'dfa'", () => {
    const re = compile("(?:a|b)*c");
    const matched = re.test("abac");
    expect(matched).toBe(true);
    expect(re.lastStats().engine).toBe("dfa");
  });

  it("WHEN compile('(?P<id>[a-z]+):(?P<val>\\d+)').exec('foo:42') runs THEN groups equals { id: 'foo', val: '42' } and index is 0", () => {
    const re = compile("(?P<id>[a-z]+):(?P<val>\\d+)");
    const match = re.exec("foo:42");
    expect(match).not.toBeNull();
    expect(match?.groups).toEqual({ id: "foo", val: "42" });
    expect(match?.index).toBe(0);
  });

  it("WHEN lazy DFA encounters more than 10000 states THEN LRU eviction occurs and execution falls back to 'pike'", () => {
    let evictedCount = 0;
    let fallbackCount = 0;
    const events: RegexTraceEvent[] = [];

    const options: CompileOptions = {
      maxDfaStates: 5,
      onEvent: (event) => {
        events.push(event);
        if (event.type === "dfa_state_evicted") {
          evictedCount++;
        }
        if (event.type === "pike_vm_fallback") {
          fallbackCount++;
        }
      },
    };

    // "an 'a' five symbols before a 'c'" needs 2^5 DFA states over an a/b input with no 'c', so the
    // 5-state cache must evict and hand the search to the Pike VM, which finds no match.
    const re = compile("[ab]*a[ab][ab][ab][ab]c", undefined, options);
    const input = "abbabaaabbbababbaaabab".repeat(4);
    expect(re.test(input)).toBe(false);

    expect(evictedCount).toBeGreaterThan(0);
    expect(fallbackCount).toBeGreaterThan(0);
    expect(re.lastStats().engine).toBe("pike");
  });
});
