import type { EngineExecutor } from "../engine/index.js";
import type { EngineStats, RegexMatch } from "../parser/index.js";
import { LimitExceededError } from "../parser/index.js";
import type { LinearRegex } from "./index.js";
import { advanceCodePoint, substituteReplacement } from "./substitute.js";

/**
 * Default upper bound on input length to safeguard against out-of-memory errors.
 */
export const DEFAULT_MAX_INPUT_LENGTH = 50_000_000;

/**
 * Process-wide last execution statistics tracker.
 */
export let globalLastStats: EngineStats = { steps: 0, engine: "dfa" };

/**
 * Sets the process-wide last execution stats.
 *
 * @param stats - Statistics to record.
 */
export function setGlobalLastStats(stats: EngineStats): void {
  globalLastStats = { steps: stats.steps, engine: stats.engine };
}

/**
 * Concrete implementation of the LinearRegex interface.
 */
export class LinearRegexImpl implements LinearRegex {
  private readonly _executor: EngineExecutor;
  private _lastStats: EngineStats = { steps: 0, engine: "dfa" };

  /**
   * Constructs a new LinearRegex instance.
   *
   * @param executor - The underlying engine executor (lazy DFA + Pike VM).
   */
  constructor(executor: EngineExecutor) {
    this._executor = executor;
  }

  /**
   * Tests if the regular expression matches the input string.
   *
   * @param input - The input string to test.
   * @returns True if the pattern matches anywhere in the string, false otherwise.
   * @throws TypeError if input is not a string.
   * @throws LimitExceededError if input exceeds DEFAULT_MAX_INPUT_LENGTH.
   */
  test(input: string): boolean {
    if (typeof input !== "string") {
      throw new TypeError("Expected input to be a string");
    }
    if (input.length > DEFAULT_MAX_INPUT_LENGTH) {
      throw new LimitExceededError(
        `Input length ${input.length} exceeds maximum limit of ${DEFAULT_MAX_INPUT_LENGTH}`,
      );
    }
    const res = this._executor.test(input);
    this._lastStats = { steps: res.stats.steps, engine: res.stats.engine };
    setGlobalLastStats(this._lastStats);
    return res.matched;
  }

  /**
   * Executes a search for a match in the specified string.
   *
   * @param input - The input string to match against.
   * @returns RegexMatch object containing match details, or null if no match.
   * @throws TypeError if input is not a string.
   * @throws LimitExceededError if input exceeds DEFAULT_MAX_INPUT_LENGTH.
   */
  exec(input: string): RegexMatch | null {
    if (typeof input !== "string") {
      throw new TypeError("Expected input to be a string");
    }
    if (input.length > DEFAULT_MAX_INPUT_LENGTH) {
      throw new LimitExceededError(
        `Input length ${input.length} exceeds maximum limit of ${DEFAULT_MAX_INPUT_LENGTH}`,
      );
    }
    const res = this._executor.exec(input);
    this._lastStats = { steps: res.stats.steps, engine: res.stats.engine };
    setGlobalLastStats(this._lastStats);
    return res.match;
  }

  /**
   * Returns an iterator yielding all non-overlapping matches in the input string.
   *
   * @param input - The input string to search.
   * @returns An iterator of RegexMatch objects.
   * @throws TypeError if input is not a string.
   * @throws LimitExceededError if input exceeds DEFAULT_MAX_INPUT_LENGTH.
   */
  matchAll(input: string): IterableIterator<RegexMatch> {
    if (typeof input !== "string") {
      throw new TypeError("Expected input to be a string");
    }
    if (input.length > DEFAULT_MAX_INPUT_LENGTH) {
      throw new LimitExceededError(
        `Input length ${input.length} exceeds maximum limit of ${DEFAULT_MAX_INPUT_LENGTH}`,
      );
    }
    return this._matchAllGenerator(input);
  }

  /**
   * Replaces matched occurrences with a replacement string or function result.
   *
   * @param input - The input text.
   * @param replacement - A replacement template or a callback receiving RegexMatch.
   * @returns A new string with all matches replaced.
   * @throws TypeError if input or replacement is invalid.
   * @throws LimitExceededError if input or replacement exceeds maximum length.
   */
  replace(input: string, replacement: string | ((match: RegexMatch) => string)): string {
    if (typeof input !== "string") {
      throw new TypeError("Expected input to be a string");
    }
    if (input.length > DEFAULT_MAX_INPUT_LENGTH) {
      throw new LimitExceededError(
        `Input length ${input.length} exceeds maximum limit of ${DEFAULT_MAX_INPUT_LENGTH}`,
      );
    }
    if (typeof replacement !== "string" && typeof replacement !== "function") {
      throw new TypeError("Expected replacement to be a string or a function");
    }
    if (typeof replacement === "string" && replacement.length > DEFAULT_MAX_INPUT_LENGTH) {
      throw new LimitExceededError(
        `Replacement length ${replacement.length} exceeds maximum limit of ${DEFAULT_MAX_INPUT_LENGTH}`,
      );
    }

    let result = "";
    let lastIndex = 0;
    let totalSteps = 0;
    let lastEngine: "dfa" | "pike" = "dfa";

    const gen = this._matchAllGenerator(input, (stats) => {
      totalSteps += stats.steps;
      if (stats.engine === "pike") {
        lastEngine = "pike";
      }
    });

    for (const match of gen) {
      result += input.slice(lastIndex, match.index);
      const replStr =
        typeof replacement === "function"
          ? String(replacement(match))
          : substituteReplacement(replacement, match, input);
      result += replStr;
      lastIndex = match.index + match.length;
    }

    result += input.slice(lastIndex);

    this._lastStats = { steps: totalSteps, engine: lastEngine };
    setGlobalLastStats(this._lastStats);
    return result;
  }

  /**
   * Returns the steps count and execution engine from the last operation.
   *
   * @returns Object with steps and engine ("dfa" | "pike").
   */
  lastStats(): { steps: number; engine: "dfa" | "pike" } {
    return { steps: this._lastStats.steps, engine: this._lastStats.engine };
  }

  private *_matchAllGenerator(
    input: string,
    onExec?: (stats: EngineStats) => void,
  ): IterableIterator<RegexMatch> {
    let startIndex = 0;
    const len = input.length;

    while (startIndex <= len) {
      const res = this._executor.exec(input, startIndex);
      this._lastStats = { steps: res.stats.steps, engine: res.stats.engine };
      setGlobalLastStats(this._lastStats);
      onExec?.(res.stats);

      const match = res.match;
      if (!match) {
        break;
      }

      // Safeguard against non-increasing search indices
      if (match.index < startIndex) {
        break;
      }

      yield match;

      if (match.length === 0) {
        startIndex = advanceCodePoint(input, match.index);
      } else {
        startIndex = match.index + match.length;
      }
    }
  }
}
