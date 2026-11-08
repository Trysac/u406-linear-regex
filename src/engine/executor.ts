import type { EngineExecutor, ExecutionResult } from "../../interfaces/engine.js";
import type { NfaGraph } from "../../interfaces/nfa.js";
import type { CompileOptions, EngineStats } from "../../interfaces/types.js";
import { LazyDfa } from "./dfa.js";
import { PikeVm } from "./pike.js";

/**
 * Dual engine executor coordinating lazy DFA and Pike VM.
 */
export class EngineExecutorImpl implements EngineExecutor {
  private readonly dfa: LazyDfa;
  private readonly pike: PikeVm;
  private _lastStats: EngineStats = { steps: 0, engine: "dfa" };

  constructor(
    public readonly nfa: NfaGraph,
    public readonly options?: CompileOptions,
  ) {
    this.dfa = new LazyDfa(nfa, options);
    this.pike = new PikeVm(nfa);
  }

  test(input: string, startIndex = 0): { readonly matched: boolean; readonly stats: EngineStats } {
    const dfaRes = this.dfa.execute(input, startIndex);
    if (dfaRes.fallback) {
      const pikeRes = this.pike.execute(input, startIndex);
      const stats: EngineStats = {
        steps: dfaRes.stats.steps + pikeRes.stats.steps,
        engine: "pike",
      };
      this._lastStats = stats;
      return { matched: pikeRes.matched, stats };
    }

    this._lastStats = dfaRes.stats;
    return { matched: dfaRes.matched, stats: dfaRes.stats };
  }

  exec(input: string, startIndex = 0): ExecutionResult {
    const pikeRes = this.pike.execute(input, startIndex);
    this._lastStats = pikeRes.stats;
    return {
      match: pikeRes.match,
      matched: pikeRes.matched,
      stats: pikeRes.stats,
    };
  }

  lastStats(): EngineStats {
    return this._lastStats;
  }
}

/**
 * Creates an EngineExecutor for a given Thompson NFA graph.
 */
export function createExecutor(nfa: NfaGraph, options?: CompileOptions): EngineExecutor {
  return new EngineExecutorImpl(nfa, options);
}
