import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { AstRoot } from "../../interfaces/ast.js";
import { buildNfa, decodeUtf16, invertRanges, normalizeRanges } from "../../src/nfa/index.js";

describe("Thompson NFA Property Tests", () => {
  it("decodes any UTF-16 string into code points in valid range", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (str: string) => {
        const cps = decodeUtf16(str);
        for (const cp of cps) {
          expect(cp).toBeGreaterThanOrEqual(0);
          expect(cp).toBeLessThanOrEqual(0x10ffff);
        }
      }),
    );
  });

  it("preserves NFA invariants: stateCount >= 2 and all transitions stay within bounds", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 0x10ffff }), { minLength: 1, maxLength: 10 }),
        (cps) => {
          const ast: AstRoot = {
            root: {
              type: "concat",
              children: cps.map((cp) => ({ type: "literal" as const, codePoint: cp })),
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
          expect(nfa.stateCount).toBeGreaterThanOrEqual(2);
          expect(nfa.startState).toBeGreaterThanOrEqual(0);
          expect(nfa.startState).toBeLessThan(nfa.stateCount);
          expect(nfa.matchState).toBeGreaterThanOrEqual(0);
          expect(nfa.matchState).toBeLessThan(nfa.stateCount);

          for (let s = 0; s < nfa.stateCount; s++) {
            const transitions = nfa.transitionsFrom(s);
            for (const t of transitions) {
              expect(t.fromState).toBe(s);
              expect(t.toState).toBeGreaterThanOrEqual(0);
              expect(t.toState).toBeLessThan(nfa.stateCount);
            }
          }
        },
      ),
    );
  });

  it("normalizing normalized ranges is idempotent", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(fc.integer({ min: 0, max: 0x10ffff }), fc.integer({ min: 0, max: 0x10ffff })),
          { maxLength: 10 },
        ),
        (rawRanges) => {
          const sortedRanges = rawRanges.map(
            ([a, b]) => [Math.min(a, b), Math.max(a, b)] as [number, number],
          );
          const normalizedOnce = normalizeRanges(sortedRanges);
          const normalizedTwice = normalizeRanges(normalizedOnce);
          expect(normalizedOnce).toEqual(normalizedTwice);
        },
      ),
    );
  });

  it("inverting disjoint ranges twice covers the original range space", () => {
    fc.assert(
      fc.property(fc.integer({ min: 10, max: 100 }), fc.integer({ min: 200, max: 500 }), (a, b) => {
        const original: [number, number][] = [
          [0, a],
          [b, b + 50],
        ];
        const inv1 = invertRanges(original);
        const inv2 = invertRanges(inv1);
        expect(inv2).toEqual(original);
      }),
    );
  });
});
