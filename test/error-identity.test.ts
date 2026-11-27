import { describe, expect, it } from "vitest";
import type { AstRoot } from "../interfaces/ast.js";
import { LimitExceededError, LinearRegexError } from "../src/index.js";
import { buildNfa, LimitExceededError as NfaLimitExceededError } from "../src/nfa/index.js";

const repetitionOverLimit: AstRoot = {
  root: {
    type: "repetition",
    child: { type: "literal", codePoint: 97 },
    min: 10001,
    max: 10001,
    greedy: true,
  },
  flags: { caseInsensitive: false, multiline: false, dotAll: false, ungreedy: false },
  captureCount: 0,
  groupNames: new Map(),
};

describe("error identity", () => {
  it("throws the exported LimitExceededError when a repetition count exceeds the NFA limit", () => {
    let thrown: unknown;
    try {
      buildNfa(repetitionOverLimit);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(LimitExceededError);
    expect(thrown).toBeInstanceOf(LinearRegexError);
    expect((thrown as LimitExceededError).code).toBe("LIMIT_EXCEEDED");
    expect((thrown as Error).message).toBe("Repetition count exceeds limit of 10000");
  });

  it("re-exports the same error classes from the nfa module", () => {
    expect(NfaLimitExceededError).toBe(LimitExceededError);
  });
});
