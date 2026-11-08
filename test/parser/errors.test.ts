import { describe, expect, it } from "vitest";
import {
  LimitExceededError,
  LinearRegexError,
  RegexSyntaxError,
  UnsupportedFeatureError,
} from "../../src/parser/index.js";

describe("LinearRegex Error Hierarchy", () => {
  it("creates UnsupportedFeatureError with code UNSUPPORTED_FEATURE", () => {
    const err = new UnsupportedFeatureError("Feature not supported");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(LinearRegexError);
    expect(err).toBeInstanceOf(UnsupportedFeatureError);
    expect(err.name).toBe("UnsupportedFeatureError");
    expect(err.code).toBe("UNSUPPORTED_FEATURE");
    expect(err.message).toBe("Feature not supported");
  });

  it("creates RegexSyntaxError with code PARSE_ERROR and position", () => {
    const err = new RegexSyntaxError("Unexpected token", 12);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(LinearRegexError);
    expect(err).toBeInstanceOf(RegexSyntaxError);
    expect(err.name).toBe("RegexSyntaxError");
    expect(err.code).toBe("PARSE_ERROR");
    expect(err.position).toBe(12);
    expect(err.message).toBe("Unexpected token");
  });

  it("creates LimitExceededError with code LIMIT_EXCEEDED", () => {
    const err = new LimitExceededError("Depth exceeded");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(LinearRegexError);
    expect(err).toBeInstanceOf(LimitExceededError);
    expect(err.name).toBe("LimitExceededError");
    expect(err.code).toBe("LIMIT_EXCEEDED");
    expect(err.message).toBe("Depth exceeded");
  });
});
