import { describe, expect, it } from "vitest";
import {
  compile,
  greet,
  LimitExceededError,
  LinearRegexError,
  RegexSyntaxError,
  replace,
  UnsupportedFeatureError,
} from "../src/index.js";

describe("package entry point", () => {
  it("exports compile with test, exec and matchAll", () => {
    const re = compile("(\\w+)@(\\w+)\\.com");
    expect(re.test("mail ada@example.com")).toBe(true);
    expect(re.exec("mail ada@example.com")?.captures).toEqual(["ada", "example"]);
    expect([...compile("\\d+").matchAll("a1 b22 c333")].map((m) => m.match)).toEqual([
      "1",
      "22",
      "333",
    ]);
  });

  it("exports replace", () => {
    expect(replace("hello world", "$2, $1", "(\\w+)\\s(\\w+)")).toBe("world, hello");
  });

  it("exports the error classes", () => {
    expect(() => compile("(a")).toThrow(RegexSyntaxError);
    expect(() => compile("(a)\\1")).toThrow(UnsupportedFeatureError);
    expect(() => compile("(a")).toThrow(LinearRegexError);
    expect(LimitExceededError).toBeTypeOf("function");
  });

  it("keeps greet", () => {
    expect(greet(" Ada ")).toBe("Hello, Ada!");
  });
});
