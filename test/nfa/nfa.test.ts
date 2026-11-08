import { describe, expect, it } from "vitest";
import type { AstNode, AstRoot } from "../../interfaces/ast.js";
import { buildNfa, LimitExceededError, simulateNfa } from "../../src/nfa/index.js";

function makeAst(root: AstNode, flagsPartial?: Partial<AstRoot["flags"]>): AstRoot {
  return {
    root,
    flags: {
      caseInsensitive: false,
      multiline: false,
      dotAll: false,
      ungreedy: false,
      ...flagsPartial,
    },
    captureCount: 0,
    groupNames: new Map(),
  };
}

function compile(pattern: string, flags = "") {
  let root: AstNode;
  const caseInsensitive = flags.includes("i");
  const multiline = flags.includes("m");
  const dotAll = flags.includes("s");
  const ungreedy = flags.includes("U");

  if (pattern === "^.$") {
    root = {
      type: "concat",
      children: [
        { type: "anchor", kind: "start_text" },
        { type: "dot" },
        { type: "anchor", kind: "end_text" },
      ],
    };
  } else if (pattern === "a|b") {
    root = {
      type: "alt",
      children: [
        { type: "literal", codePoint: 97 },
        { type: "literal", codePoint: 98 },
      ],
    };
  } else {
    root = {
      type: "concat",
      children: Array.from(pattern).map((ch) => ({
        type: "literal" as const,
        codePoint: ch.codePointAt(0) ?? 0,
      })),
    };
  }

  const ast: AstRoot = {
    root,
    flags: { caseInsensitive, multiline, dotAll, ungreedy },
    captureCount: 0,
    groupNames: new Map(),
  };
  const nfa = buildNfa(ast);

  return {
    test(input: string): boolean {
      return simulateNfa(nfa, input).matched;
    },
    nfa,
  };
}

describe("Thompson NFA module", () => {
  it("WHEN compile('^.$').test('\\uD83D\\uDE00') runs THEN it returns true, because matching is by code point (U+1F600 is one character)", () => {
    const result = compile("^.$").test("\uD83D\uDE00");
    expect(result).toBe(true);
  });

  it("WHEN an NFA is constructed for 'a|b' THEN state count is at least 4 and matches input 'a' returning step count of at least 1", () => {
    const ast: AstRoot = {
      root: {
        type: "alt",
        children: [
          { type: "literal", codePoint: 97 },
          { type: "literal", codePoint: 98 },
        ],
      },
      flags: {
        caseInsensitive: false,
        multiline: false,
        dotAll: false,
        ungreedy: false,
      },
      captureCount: 0,
      groupNames: new Map(),
    };
    const nfa = buildNfa(ast);
    expect(nfa.stateCount).toBeGreaterThanOrEqual(4);
    const sim = simulateNfa(nfa, "a");
    expect(sim.matched).toBe(true);
    expect(sim.steps).toBeGreaterThanOrEqual(1);
  });

  it("handles literal matching with case sensitivity and case insensitivity", () => {
    const astSensitive = makeAst({ type: "literal", codePoint: 97 });
    const nfaSensitive = buildNfa(astSensitive);
    expect(simulateNfa(nfaSensitive, "a").matched).toBe(true);
    expect(simulateNfa(nfaSensitive, "A").matched).toBe(false);

    const astInsensitive = makeAst({ type: "literal", codePoint: 97 }, { caseInsensitive: true });
    const nfaInsensitive = buildNfa(astInsensitive);
    expect(simulateNfa(nfaInsensitive, "a").matched).toBe(true);
    expect(simulateNfa(nfaInsensitive, "A").matched).toBe(true);
    expect(simulateNfa(nfaInsensitive, "b").matched).toBe(false);
  });

  it("handles dot with and without dotAll flag", () => {
    const astNoDotAll = makeAst({ type: "dot" }, { dotAll: false });
    const nfaNoDotAll = buildNfa(astNoDotAll);
    expect(simulateNfa(nfaNoDotAll, "x").matched).toBe(true);
    expect(simulateNfa(nfaNoDotAll, "\n").matched).toBe(false);

    const astDotAll = makeAst({ type: "dot" }, { dotAll: true });
    const nfaDotAll = buildNfa(astDotAll);
    expect(simulateNfa(nfaDotAll, "\n").matched).toBe(true);
  });

  it("handles character classes and inverted character classes", () => {
    const charClassAst = makeAst({
      type: "charClass",
      ranges: [
        [48, 57],
        [97, 102],
      ],
      inverted: false,
    });
    const nfa = buildNfa(charClassAst);
    expect(simulateNfa(nfa, "5").matched).toBe(true);
    expect(simulateNfa(nfa, "c").matched).toBe(true);
    expect(simulateNfa(nfa, "z").matched).toBe(false);

    const invertedAst = makeAst({
      type: "charClass",
      ranges: [[48, 57]],
      inverted: true,
    });
    const nfaInv = buildNfa(invertedAst);
    expect(simulateNfa(nfaInv, "5").matched).toBe(false);
    expect(simulateNfa(nfaInv, "a").matched).toBe(true);
  });

  it("handles character class case insensitivity with ascii and unicode", () => {
    const classAst = makeAst(
      {
        type: "charClass",
        ranges: [
          [97, 122],
          [0x03b1, 0x03c9],
        ],
        inverted: false,
      },
      { caseInsensitive: true },
    );
    const nfa = buildNfa(classAst);
    expect(simulateNfa(nfa, "A").matched).toBe(true);
    expect(simulateNfa(nfa, "a").matched).toBe(true);
    expect(simulateNfa(nfa, "\u0391").matched).toBe(true);
  });

  it("handles anchors and multiline anchors", () => {
    const lineStartAst = makeAst(
      {
        type: "concat",
        children: [
          { type: "anchor", kind: "start_line" },
          { type: "literal", codePoint: 97 },
        ],
      },
      { multiline: true },
    );
    const nfaLine = buildNfa(lineStartAst);
    expect(simulateNfa(nfaLine, "a").matched).toBe(true);
    expect(simulateNfa(nfaLine, "b\na").matched).toBe(true);

    const singlelineAst = makeAst(
      {
        type: "concat",
        children: [
          { type: "anchor", kind: "start_line" },
          { type: "literal", codePoint: 97 },
        ],
      },
      { multiline: false },
    );
    const nfaSingle = buildNfa(singlelineAst);
    expect(simulateNfa(nfaSingle, "a").matched).toBe(true);
    expect(simulateNfa(nfaSingle, "b\na").matched).toBe(false);
  });

  it("handles word boundary and not-word-boundary anchors", () => {
    const wordBoundaryAst = makeAst({
      type: "concat",
      children: [
        { type: "anchor", kind: "word_boundary" },
        { type: "literal", codePoint: 97 },
        { type: "anchor", kind: "word_boundary" },
      ],
    });
    const nfaWb = buildNfa(wordBoundaryAst);
    expect(simulateNfa(nfaWb, "a").matched).toBe(true);
    expect(simulateNfa(nfaWb, "!a!").matched).toBe(true);
    expect(simulateNfa(nfaWb, "xa").matched).toBe(false);

    const notWbAst = makeAst({
      type: "concat",
      children: [
        { type: "literal", codePoint: 120 },
        { type: "anchor", kind: "not_word_boundary" },
        { type: "literal", codePoint: 97 },
      ],
    });
    const nfaNotWb = buildNfa(notWbAst);
    expect(simulateNfa(nfaNotWb, "xa").matched).toBe(true);
    expect(simulateNfa(nfaNotWb, "x!a").matched).toBe(false);
  });

  it("handles repetitions: zero-or-one, zero-or-more, one-or-more, exact, and bounded", () => {
    // a?
    const qAst = makeAst({
      type: "repetition",
      child: { type: "literal", codePoint: 97 },
      min: 0,
      max: 1,
      greedy: true,
    });
    const nfaQ = buildNfa(qAst);
    expect(simulateNfa(nfaQ, "").matched).toBe(true);
    expect(simulateNfa(nfaQ, "a").matched).toBe(true);

    // a* lazy
    const starLazyAst = makeAst({
      type: "repetition",
      child: { type: "literal", codePoint: 97 },
      min: 0,
      max: Infinity,
      greedy: false,
    });
    const nfaStarLazy = buildNfa(starLazyAst);
    expect(simulateNfa(nfaStarLazy, "aaa").matched).toBe(true);

    // a+ lazy
    const plusLazyAst = makeAst({
      type: "repetition",
      child: { type: "literal", codePoint: 97 },
      min: 1,
      max: Infinity,
      greedy: false,
    });
    const nfaPlusLazy = buildNfa(plusLazyAst);
    expect(simulateNfa(nfaPlusLazy, "").matched).toBe(false);
    expect(simulateNfa(nfaPlusLazy, "a").matched).toBe(true);

    // a{2,4}
    const rangeAst = makeAst({
      type: "repetition",
      child: { type: "literal", codePoint: 97 },
      min: 2,
      max: 4,
      greedy: true,
    });
    const nfaRange = buildNfa(rangeAst);
    expect(simulateNfa(nfaRange, "a").matched).toBe(false);
    expect(simulateNfa(nfaRange, "aa").matched).toBe(true);
    expect(simulateNfa(nfaRange, "aaaa").matched).toBe(true);

    // a{2,}
    const atLeastAst = makeAst({
      type: "repetition",
      child: { type: "literal", codePoint: 97 },
      min: 2,
      max: Infinity,
      greedy: true,
    });
    const nfaAtLeast = buildNfa(atLeastAst);
    expect(simulateNfa(nfaAtLeast, "a").matched).toBe(false);
    expect(simulateNfa(nfaAtLeast, "aaa").matched).toBe(true);

    // a{3}
    const exactAst = makeAst({
      type: "repetition",
      child: { type: "literal", codePoint: 97 },
      min: 3,
      max: 3,
      greedy: true,
    });
    const nfaExact = buildNfa(exactAst);
    expect(simulateNfa(nfaExact, "aa").matched).toBe(false);
    expect(simulateNfa(nfaExact, "aaa").matched).toBe(true);

    // a{0}
    const zeroAst = makeAst({
      type: "repetition",
      child: { type: "literal", codePoint: 97 },
      min: 0,
      max: 0,
      greedy: true,
    });
    const nfaZero = buildNfa(zeroAst);
    expect(simulateNfa(nfaZero, "").matched).toBe(true);
  });

  it("enforces repetition limit when count exceeds 10000", () => {
    const invalidAst = makeAst({
      type: "repetition",
      child: { type: "literal", codePoint: 97 },
      min: 10001,
      max: 20000,
      greedy: true,
    });
    expect(() => buildNfa(invalidAst)).toThrow(LimitExceededError);
  });

  it("handles capturing and non-capturing groups", () => {
    const groupAst: AstRoot = {
      root: {
        type: "group",
        child: { type: "literal", codePoint: 97 },
        capturing: true,
        index: 1,
        name: "first",
      },
      flags: {
        caseInsensitive: false,
        multiline: false,
        dotAll: false,
        ungreedy: false,
      },
      captureCount: 1,
      groupNames: new Map([["first", 1]]),
    };
    const nfa = buildNfa(groupAst);
    expect(nfa.captureCount).toBe(1);
    expect(nfa.groupNames.get("first")).toBe(1);

    const transitions = nfa.transitionsFrom(nfa.startState);
    expect(transitions.length).toBeGreaterThan(0);
    expect(simulateNfa(nfa, "a").matched).toBe(true);

    const nonCapturingAst = makeAst({
      type: "group",
      child: { type: "literal", codePoint: 97 },
      capturing: false,
    });
    const nfaNonCap = buildNfa(nonCapturingAst);
    expect(simulateNfa(nfaNonCap, "a").matched).toBe(true);
  });

  it("handles empty concat, empty alt, and single-child concat", () => {
    const emptyConcatAst = makeAst({ type: "concat", children: [] });
    const nfaConcat = buildNfa(emptyConcatAst);
    expect(simulateNfa(nfaConcat, "").matched).toBe(true);

    const singleConcatAst = makeAst({
      type: "concat",
      children: [{ type: "literal", codePoint: 97 }],
    });
    const nfaSingle = buildNfa(singleConcatAst);
    expect(simulateNfa(nfaSingle, "a").matched).toBe(true);

    const emptyAltAst = makeAst({ type: "alt", children: [] });
    const nfaAlt = buildNfa(emptyAltAst);
    expect(simulateNfa(nfaAlt, "a").matched).toBe(false);
  });

  it("returns empty array for invalid state lookup in transitionsFrom", () => {
    const nfa = buildNfa(makeAst({ type: "literal", codePoint: 97 }));
    expect(nfa.transitionsFrom(-1)).toEqual([]);
    expect(nfa.transitionsFrom(9999)).toEqual([]);
  });
});
