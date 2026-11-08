import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  LimitExceededError,
  LinearRegexError,
  parseRegex,
  UnsupportedFeatureError,
} from "../../src/parser/index.js";

describe("Parser fast-check property tests", () => {
  it("never throws unexpected errors on arbitrary string inputs", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 100 }), (pattern) => {
        try {
          const ast = parseRegex(pattern);
          expect(ast).toBeDefined();
          expect(ast.captureCount).toBeGreaterThanOrEqual(0);
        } catch (error) {
          expect(error).toBeInstanceOf(LinearRegexError);
          expect(["PARSE_ERROR", "UNSUPPORTED_FEATURE", "LIMIT_EXCEEDED"]).toContain(
            (error as LinearRegexError).code,
          );
        }
      }),
      { numRuns: 500 },
    );
  });

  it("always enforces maxPatternLength limit", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), (maxLen) => {
        const longStr = "a".repeat(maxLen + 1);
        expect(() => parseRegex(longStr, "", { maxPatternLength: maxLen })).toThrow(
          LimitExceededError,
        );
      }),
      { numRuns: 100 },
    );
  });

  it("always enforces maxDepth limit", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (depth) => {
        const nested = `${"(".repeat(depth + 1)}x${")".repeat(depth + 1)}`;
        expect(() => parseRegex(nested, "", { maxDepth: depth })).toThrow(LimitExceededError);
      }),
      { numRuns: 100 },
    );
  });

  it("always rejects backreferences and lookaround across random context strings", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 20 }),
        fc.string({ maxLength: 20 }),
        fc.constantFrom("(a)\\1", "(?=a)", "(?!b)", "(?<=c)", "(?<!d)", "(?>e)", "\\k<foo>"),
        (prefix, suffix, forbidden) => {
          // Only test when prefix has matching parenthesis so lookaround token itself is parsed
          const safePrefix = prefix.replace(/[\\()[\].*+?{}^$]/g, "a");
          const safeSuffix = suffix.replace(/[\\()[\].*+?{}^$]/g, "z");
          const pattern = safePrefix + forbidden + safeSuffix;
          expect(() => parseRegex(pattern)).toThrow(UnsupportedFeatureError);
        },
      ),
      { numRuns: 200 },
    );
  });
});
