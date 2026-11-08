import type { EngineExecutor } from "../../interfaces/engine.js";
import type { CompileOptions, EngineStats, RegexMatch } from "../../interfaces/types.js";
import { createExecutor } from "../../src/engine/index.js";
import { buildTestNfa } from "./nfa-helper.js";

export interface LinearRegexTestWrapper {
  test(input: string): boolean;
  exec(input: string): RegexMatch | null;
  lastStats(): EngineStats;
}

/**
 * Compiles pattern to NFA and returns an EngineExecutor wrapper
 * implementing test, exec and lastStats matching the public facade.
 */
export function compile(
  pattern: string,
  _flags?: string,
  options?: CompileOptions,
): LinearRegexTestWrapper {
  const nfa = buildTestNfa(pattern);
  const executor: EngineExecutor = createExecutor(nfa, options);
  let currentStats: EngineStats = { steps: 0, engine: "dfa" };

  return {
    test(input: string): boolean {
      const res = executor.test(input);
      currentStats = res.stats;
      return res.matched;
    },
    exec(input: string): RegexMatch | null {
      const res = executor.exec(input);
      currentStats = res.stats;
      return res.match;
    },
    lastStats(): EngineStats {
      return currentStats;
    },
  };
}
