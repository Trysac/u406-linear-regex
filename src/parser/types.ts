/**
 * Trace events emitted during regex execution or compilation.
 */
export interface RegexTraceEvent {
  readonly type: "dfa_cache_hit" | "dfa_cache_miss" | "dfa_state_evicted" | "pike_vm_fallback";
  readonly stateId?: number;
  readonly position?: number;
  readonly count?: number;
}

/**
 * Configuration options for compiling a regex.
 */
export interface CompileOptions {
  readonly maxDfaStates?: number;
  readonly maxDepth?: number;
  readonly maxPatternLength?: number;
  readonly onEvent?: (event: RegexTraceEvent) => void;
}

/**
 * Performance and execution statistics returned by regex engines.
 */
export interface EngineStats {
  readonly steps: number;
  readonly engine: "dfa" | "pike";
}

/**
 * Match result structure produced by regex execution.
 */
export interface RegexMatch {
  readonly match: string;
  readonly index: number;
  readonly length: number;
  readonly captures: readonly (string | undefined)[];
  readonly groups: Readonly<Record<string, string | undefined>>;
}

/**
 * Base error class for all linear-regex errors with a machine-readable code.
 */
export abstract class LinearRegexError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when an unsupported regex feature (e.g. backreferences or lookaround) is encountered.
 */
export class UnsupportedFeatureError extends LinearRegexError {
  override readonly code = "UNSUPPORTED_FEATURE" as const;

  constructor(message: string) {
    super(message, "UNSUPPORTED_FEATURE");
  }
}

/**
 * Error thrown when a pattern contains invalid syntax.
 */
export class RegexSyntaxError extends LinearRegexError {
  override readonly code = "PARSE_ERROR" as const;
  readonly position: number;

  constructor(message: string, position: number) {
    super(message, "PARSE_ERROR");
    this.position = position;
  }
}

/**
 * Error thrown when pattern length or recursion depth limits are exceeded.
 */
export class LimitExceededError extends LinearRegexError {
  override readonly code = "LIMIT_EXCEEDED" as const;

  constructor(message: string) {
    super(message, "LIMIT_EXCEEDED");
  }
}
