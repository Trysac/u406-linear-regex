import { createExecutor } from "../engine/index.js";
import { buildNfa } from "../nfa/index.js";
import type { CompileOptions, RegexMatch } from "../parser/index.js";
import { parseRegex } from "../parser/index.js";
import { globalLastStats, LinearRegexImpl } from "./linear-regex.js";

export type { CompileOptions, EngineStats, RegexMatch } from "../parser/index.js";
export { DEFAULT_MAX_INPUT_LENGTH } from "./linear-regex.js";

/**
 * Represents a compiled linear-time regular expression instance.
 */
export interface LinearRegex {
  /**
   * Tests if the regular expression matches the input string.
   */
  test(input: string): boolean;
  /**
   * Executes a search for a match in the specified string.
   */
  exec(input: string): RegexMatch | null;
  /**
   * Returns an iterator yielding all non-overlapping matches.
   */
  matchAll(input: string): IterableIterator<RegexMatch>;
  /**
   * Replaces matched occurrences with a replacement string or function result.
   */
  replace(input: string, replacement: string | ((match: RegexMatch) => string)): string;
  /**
   * Returns the steps count and execution engine from the last operation.
   */
  lastStats(): { steps: number; engine: "dfa" | "pike" };
}

/**
 * Compiles a regular expression pattern into a LinearRegex instance.
 *
 * @param pattern - Regular expression pattern string.
 * @param flags - Optional regular expression flags ('i', 'm', 's', 'U').
 * @param options - Optional engine compilation options.
 * @returns A compiled LinearRegex instance.
 * @throws RegexSyntaxError if pattern syntax is invalid.
 * @throws UnsupportedFeatureError if unsupported features (e.g. backreferences, lookarounds) are used.
 * @throws LimitExceededError if pattern length or nesting depth exceeds limits.
 */
export function compile(pattern: string, flags?: string, options?: CompileOptions): LinearRegex {
  const ast = parseRegex(pattern, flags, options);
  const nfa = buildNfa(ast);
  const executor = createExecutor(nfa, options);
  return new LinearRegexImpl(executor);
}

/**
 * Replaces matched occurrences of pattern in input with replacement string or function.
 *
 * @param input - The input string.
 * @param replacement - Replacement template or callback receiving RegexMatch.
 * @param pattern - Regular expression pattern string.
 * @param flags - Optional flags string.
 * @param options - Optional compile options.
 * @returns Transformed string with all matches replaced.
 */
export function replace(
  input: string,
  replacement: string | ((match: RegexMatch) => string),
  pattern: string,
  flags?: string,
  options?: CompileOptions,
): string {
  const regex = compile(pattern, flags, options);
  return regex.replace(input, replacement);
}

/**
 * Returns engine statistics from the most recent regex execution across instances.
 *
 * @returns Object with steps and engine ("dfa" | "pike").
 */
export function lastStats(): { steps: number; engine: "dfa" | "pike" } {
  return { steps: globalLastStats.steps, engine: globalLastStats.engine };
}
