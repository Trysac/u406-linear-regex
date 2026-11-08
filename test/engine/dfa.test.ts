import { describe, expect, it } from "vitest";
import type { RegexTraceEvent } from "../../interfaces/types.js";
import { DfaLruCache, LazyDfa } from "../../src/engine/dfa.js";
import { buildTestNfa } from "./nfa-helper.js";

describe("Lazy DFA and LRU Cache", () => {
  it("handles hit, miss and clear on DfaLruCache", () => {
    const events: RegexTraceEvent[] = [];
    const cache = new DfaLruCache(3, (e) => events.push(e));

    expect(cache.get("missing")).toBeUndefined();
    expect(events.some((e) => e.type === "dfa_cache_miss")).toBe(true);

    const s1 = cache.set("1", [1], false);
    expect(s1.evicted).toBe(false);
    expect(cache.size).toBe(1);

    const got = cache.get("1");
    expect(got?.id).toBe(s1.state.id);
    expect(events.some((e) => e.type === "dfa_cache_hit")).toBe(true);

    cache.set("2", [2], false);
    cache.set("3", [3], false);
    expect(cache.size).toBe(3);

    // 4th item triggers eviction
    const s4 = cache.set("4", [4], true);
    expect(s4.evicted).toBe(true);
    expect(events.some((e) => e.type === "dfa_state_evicted")).toBe(true);

    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("matches Unicode code points (emoji U+1F600) with dot", () => {
    const nfa = buildTestNfa("^.$");
    const dfa = new LazyDfa(nfa);
    const result = dfa.execute("\uD83D\uDE00");
    expect(result.matched).toBe(true);
    expect(result.stats.engine).toBe("dfa");
  });

  it("handles empty string inputs and boundary startIndex", () => {
    const nfa = buildTestNfa("^$");
    const dfa = new LazyDfa(nfa);
    expect(dfa.execute("").matched).toBe(true);
    expect(dfa.execute("a", 2).matched).toBe(false);
  });
});
