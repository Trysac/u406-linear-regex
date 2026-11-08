export interface RegexTraceEvent {
  readonly type: "dfa_cache_hit" | "dfa_cache_miss" | "dfa_state_evicted" | "pike_vm_fallback";
  readonly stateId?: number;
  readonly position?: number;
  readonly count?: number;
}

export interface CompileOptions {
  readonly maxDfaStates?: number;
  readonly maxDepth?: number;
  readonly maxPatternLength?: number;
  readonly onEvent?: (event: RegexTraceEvent) => void;
}

export interface EngineStats {
  readonly steps: number;
  readonly engine: "dfa" | "pike";
}

export interface RegexMatch {
  readonly match: string;
  readonly index: number;
  readonly length: number;
  readonly captures: readonly (string | undefined)[];
  readonly groups: Readonly<Record<string, string | undefined>>;
}

export declare abstract class LinearRegexError extends Error {
  readonly code: string;
  constructor(message: string, code: string);
}

export declare class UnsupportedFeatureError extends LinearRegexError {
  readonly code: "UNSUPPORTED_FEATURE";
  constructor(message: string);
}

export declare class RegexSyntaxError extends LinearRegexError {
  readonly code: "PARSE_ERROR";
  readonly position: number;
  constructor(message: string, position: number);
}

export declare class LimitExceededError extends LinearRegexError {
  readonly code: "LIMIT_EXCEEDED";
  constructor(message: string);
}
