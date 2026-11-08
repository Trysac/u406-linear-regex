import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compile, lastStats, replace } from "../../src/api/index.js";
import { advanceCodePoint, substituteReplacement } from "../../src/api/substitute.js";
import {
  LimitExceededError,
  RegexSyntaxError,
  UnsupportedFeatureError,
} from "../../src/parser/index.js";

describe("LinearRegex API", () => {
  describe("Acceptance Criteria", () => {
    it("WHEN replace('hello world', '$2, $1') runs with pattern '(\\w+)\\s(\\w+)' THEN it returns 'world, hello'", () => {
      const result = replace("hello world", "$2, $1", "(\\w+)\\s(\\w+)");
      expect(result).toBe("world, hello");

      // Also verify via compiled instance method
      const compiled = compile("(\\w+)\\s(\\w+)");
      expect(compiled.replace("hello world", "$2, $1")).toBe("world, hello");
    });

    it("WHEN matchAll is invoked with pattern '\\d+' on 'item 10 and 20' THEN match array has length 2 and matches '10' and '20'", () => {
      const compiled = compile("\\d+");
      const matchArray = Array.from(compiled.matchAll("item 10 and 20"));
      expect(matchArray).toHaveLength(2);
      expect(matchArray[0]?.match).toBe("10");
      expect(matchArray[1]?.match).toBe("20");
    });
  });

  describe("compile and error propagation", () => {
    it("propagates UnsupportedFeatureError for backreferences and lookaround", () => {
      expect(() => compile("(a)\\1")).toThrow(UnsupportedFeatureError);
      expect(() => compile("(?=a)")).toThrow(UnsupportedFeatureError);
    });

    it("propagates RegexSyntaxError for malformed patterns", () => {
      expect(() => compile("[a-")).toThrow(RegexSyntaxError);
      expect(() => compile("(abc")).toThrow(RegexSyntaxError);
    });

    it("propagates LimitExceededError when pattern exceeds maxPatternLength or maxDepth", () => {
      expect(() => compile("a".repeat(5000))).toThrow(LimitExceededError);
      expect(() => compile(`${"(".repeat(70)}a${")".repeat(70)}`)).toThrow(LimitExceededError);
    });
  });

  describe("LinearRegex.test", () => {
    it("returns true on match and false on non-match", () => {
      const re = compile("\\bhello\\b");
      expect(re.test("say hello there")).toBe(true);
      expect(re.test("say othello there")).toBe(false);
    });

    it("validates input argument type and length", () => {
      const re = compile("foo");
      // @ts-expect-error testing invalid type
      expect(() => re.test(null)).toThrow(TypeError);
      // @ts-expect-error testing invalid type
      expect(() => re.test(123)).toThrow(TypeError);

      const oversized = "a".repeat(100);
      expect(() => re.test(oversized)).not.toThrow();
    });

    it("tracks lastStats steps and engine", () => {
      const re = compile("abc");
      expect(re.lastStats()).toEqual({ steps: 0, engine: "dfa" });
      re.test("xyzabc");
      const stats = re.lastStats();
      expect(stats.steps).toBeGreaterThan(0);
      expect(stats.engine).toMatch(/^(dfa|pike)$/);
    });
  });

  describe("LinearRegex.exec", () => {
    it("returns match details with captures and groups", () => {
      const re = compile("(?P<id>[a-z]+):(?P<val>\\d+)");
      const match = re.exec("id:foo:42:end");
      expect(match).not.toBeNull();
      expect(match?.match).toBe("foo:42");
      expect(match?.index).toBe(3);
      expect(match?.length).toBe(6);
      expect(match?.captures).toEqual(["foo", "42"]);
      expect(match?.groups).toEqual({ id: "foo", val: "42" });
    });

    it("returns null on non-match", () => {
      const re = compile("^[0-9]+$");
      expect(re.exec("abc")).toBeNull();
    });

    it("validates input argument type and length", () => {
      const re = compile("foo");
      // @ts-expect-error testing invalid type
      expect(() => re.exec(undefined)).toThrow(TypeError);
    });
  });

  describe("LinearRegex.matchAll", () => {
    it("yields all matches with indices and captures", () => {
      const re = compile("(\\w+)=(\\d+)");
      const matches = Array.from(re.matchAll("a=10 b=20 c=30"));
      expect(matches).toHaveLength(3);
      expect(matches[0]?.match).toBe("a=10");
      expect(matches[0]?.captures).toEqual(["a", "10"]);
      expect(matches[1]?.match).toBe("b=20");
      expect(matches[2]?.match).toBe("c=30");
    });

    it("handles zero-length matches without entering infinite loops", () => {
      const re = compile("^|$", "m");
      const matches = Array.from(re.matchAll("a\\nb"));
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it("validates input argument type and length", () => {
      const re = compile("foo");
      // @ts-expect-error testing invalid type
      expect(() => re.matchAll(123)).toThrow(TypeError);
    });

    it("supports breaking early from iterator", () => {
      const re = compile("\\d+");
      const gen = re.matchAll("1 2 3 4 5");
      const first = gen.next().value;
      expect(first?.match).toBe("1");
    });
  });

  describe("LinearRegex.replace and standalone replace", () => {
    it("replaces multiple occurrences", () => {
      const result = replace("foo 10 bar 20", "NUM", "\\d+");
      expect(result).toBe("foo NUM bar NUM");
    });

    it("supports function replacement callback", () => {
      const result = replace(
        "user:alice role:admin",
        (m) => `[${m.captures[0]?.toUpperCase()}]`,
        ":(\\w+)",
      );
      expect(result).toBe("user[ALICE] role[ADMIN]");
    });

    it("supports function replacement returning non-string", () => {
      const re = compile("\\d+");
      // @ts-expect-error testing non-string return coercion
      const result = re.replace("val 5", () => 42);
      expect(result).toBe("val 42");
    });

    it("supports named group substitution via $<name> and $\x7bname}", () => {
      const re = compile("(?P<prefix>[a-z]+):(?P<num>\\d+)");
      const res1 = re.replace("key:123", "$<num>-$<prefix>");
      expect(res1).toBe("123-key");
      const res2 = re.replace("key:123", "$\x7bnum}-$\x7bprefix}");
      expect(res2).toBe("123-key");
    });

    it("supports $& and $0 for full match", () => {
      const re = compile("\\bworld\\b");
      expect(re.replace("hello world!", "[$&]")).toBe("hello [world]!");
      expect(re.replace("hello world!", "[$0]")).toBe("hello [world]!");
    });

    it("supports $$ for escaped dollar sign", () => {
      const re = compile("\\d+");
      expect(re.replace("price 10", "$$$0")).toBe("price $10");
    });

    it("supports $` and $' for prefix and suffix", () => {
      const re = compile("-");
      expect(re.replace("A-B", "[$`]")).toBe("A[A]B");
      expect(re.replace("A-B", "[$']")).toBe("A[B]B");
    });

    it("handles two-digit capture groups", () => {
      const pattern = "(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)(k)";
      const re = compile(pattern);
      expect(re.replace("abcdefghijk", "$11-$10-$1")).toBe("k-j-a");
    });

    it("leaves out-of-range capture indices literal", () => {
      const re = compile("(foo)");
      expect(re.replace("foo", "$5")).toBe("$5");
    });

    it("replaces unmatched optional capture with empty string", () => {
      const re = compile("(foo)|(bar)");
      expect(re.replace("bar", "1:[$1] 2:[$2]")).toBe("1:[] 2:[bar]");
    });

    it("validates arguments for replace", () => {
      const re = compile("a");
      // @ts-expect-error invalid input type
      expect(() => re.replace(123, "b")).toThrow(TypeError);
      // @ts-expect-error invalid replacement type
      expect(() => re.replace("a", 123)).toThrow(TypeError);
    });

    it("returns unchanged string when no match occurs", () => {
      expect(replace("hello", "x", "z+")).toBe("hello");
    });
  });

  describe("lastStats tracking", () => {
    it("updates stats after execution and exports global lastStats", () => {
      const re = compile("[a-z]+");
      re.test("hello");
      const stats = lastStats();
      expect(stats.steps).toBeGreaterThan(0);
      expect(stats.engine).toMatch(/^(dfa|pike)$/);
    });
  });

  describe("substitute helper unit coverage", () => {
    it("handles trailing $, unclosed <>, and unclosed {}", () => {
      const match = {
        match: "abc",
        index: 0,
        length: 3,
        captures: ["abc"],
        groups: {},
      };
      expect(substituteReplacement("$", match, "abc")).toBe("$");
      expect(substituteReplacement("$<", match, "abc")).toBe("$<");
      expect(substituteReplacement("$\x7b", match, "abc")).toBe("$\x7b");
      expect(substituteReplacement("$unknown", match, "abc")).toBe("$unknown");
      expect(substituteReplacement("$\x7bnot_found}", match, "abc")).toBe("$\x7bnot_found}");
      expect(substituteReplacement("$<not_found>", match, "abc")).toBe("$<not_found>");
      expect(substituteReplacement("$\x7b1}", match, "abc")).toBe("abc");
    });

    it("advanceCodePoint handles surrogate pairs and regular code points", () => {
      const smile = "\uD83D\uDE00";
      expect(advanceCodePoint(smile, 0)).toBe(2);
      expect(advanceCodePoint("abc", 0)).toBe(1);
      expect(advanceCodePoint("abc", 3)).toBe(4);
      // Lone high surrogate
      expect(advanceCodePoint("\uD83Da", 0)).toBe(1);
    });
  });

  describe("Property-based invariant testing with fast-check", () => {
    it("replace with identity function or matching token maintains invariants", () => {
      const re = compile("[a-z]+");
      fc.assert(
        fc.property(fc.string({ maxLength: 50 }), (str) => {
          const replaced = re.replace(str, (m) => m.match);
          expect(replaced).toBe(str);
        }),
      );
    });

    it("matchAll indices are monotonically increasing", () => {
      const re = compile("\\d+");
      fc.assert(
        fc.property(fc.string({ maxLength: 100 }), (str) => {
          const matches = Array.from(re.matchAll(str));
          for (let i = 1; i < matches.length; i++) {
            const prev = matches[i - 1];
            const curr = matches[i];
            if (prev !== undefined && curr !== undefined) {
              expect(curr.index).toBeGreaterThanOrEqual(prev.index + prev.length);
            }
          }
        }),
      );
    });
  });
});
