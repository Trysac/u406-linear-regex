/**
 * Public entry point of @trysac/linear-regex.
 *
 * `compile` builds a linear-time matcher (lazy DFA with a Pike VM fallback); `replace` is a
 * one-shot helper. Every error extends `LinearRegexError` and carries a machine-readable `code`.
 */

export type { CompileOptions, EngineStats, LinearRegex, RegexMatch } from "./api/index.js";
export { compile, DEFAULT_MAX_INPUT_LENGTH, lastStats, replace } from "./api/index.js";
export {
  LimitExceededError,
  LinearRegexError,
  RegexSyntaxError,
  UnsupportedFeatureError,
} from "./parser/index.js";

/**
 * Builds a greeting for `name`.
 *
 * @param name - Who to greet. Surrounding whitespace is ignored.
 * @returns The greeting, for example `"Hello, Ada!"`.
 * @throws {TypeError} When `name` is empty after trimming.
 */
export function greet(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") {
    throw new TypeError("name must not be empty");
  }
  return `Hello, ${trimmed}!`;
}
