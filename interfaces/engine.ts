import type { NfaGraph } from "./nfa";
import type { CompileOptions, EngineStats, RegexMatch } from "./types";

export interface ExecutionResult {
  readonly match: RegexMatch | null;
  readonly matched: boolean;
  readonly stats: EngineStats;
}

export interface EngineExecutor {
  test(
    input: string,
    startIndex?: number,
  ): { readonly matched: boolean; readonly stats: EngineStats };
  exec(input: string, startIndex?: number): ExecutionResult;
}

export declare function createExecutor(nfa: NfaGraph, options?: CompileOptions): EngineExecutor;
