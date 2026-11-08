import type { CompileOptions, RegexMatch } from "./types";

export interface LinearRegex {
  test(input: string): boolean;
  exec(input: string): RegexMatch | null;
  matchAll(input: string): IterableIterator<RegexMatch>;
  replace(input: string, replacement: string | ((match: RegexMatch) => string)): string;
  lastStats(): { steps: number; engine: "dfa" | "pike" };
}

export declare function compile(
  pattern: string,
  flags?: string,
  options?: CompileOptions,
): LinearRegex;
export declare function replace(
  input: string,
  replacement: string | ((match: RegexMatch) => string),
  pattern: string,
  flags?: string,
  options?: CompileOptions,
): string;
