/**
 * Documented pathological regular expression patterns known to trigger exponential
 * or super-linear backtracking in standard engines (ReDoS), guaranteed to execute
 * in linear O(N) time with ratio <= 11 in this engine.
 */
export interface PathologicalPatternCase {
  readonly name: string;
  readonly pattern: string;
  readonly makeInput: (n: number) => string;
}

export const PATHOLOGICAL_PATTERNS: readonly PathologicalPatternCase[] = [
  {
    name: "overlapping_alternation_star",
    pattern: "(a|aa)*b",
    makeInput: (n: number) => "a".repeat(n),
  },
  {
    name: "nested_plus",
    pattern: "(a+)+$",
    makeInput: (n: number) => `${"a".repeat(n)}b`,
  },
  {
    name: "nested_star",
    pattern: "(a*)*$",
    makeInput: (n: number) => `${"a".repeat(n)}b`,
  },
  {
    name: "alternation_optional_plus",
    pattern: "(a|a?)+$",
    makeInput: (n: number) => `${"a".repeat(n)}b`,
  },
  {
    name: "non_capturing_nested_plus_star",
    pattern: "(?:a+)*b",
    makeInput: (n: number) => "a".repeat(n),
  },
  {
    name: "nested_star_in_plus",
    pattern: "(?:a|b*)+c",
    makeInput: (n: number) => "a".repeat(n),
  },
  {
    name: "repeated_group_plus",
    pattern: "(a+b)+$",
    makeInput: (n: number) => "a".repeat(n),
  },
  {
    name: "nested_non_capturing_plus",
    pattern: "(?:a+)+c",
    makeInput: (n: number) => "a".repeat(n),
  },
  {
    name: "nested_star_trailing_b",
    pattern: "(?:a*)*b",
    makeInput: (n: number) => "a".repeat(n),
  },
  {
    name: "overlapping_prefix_alternation",
    pattern: "(?:a|ab)*c",
    makeInput: (n: number) => "a".repeat(n),
  },
];
