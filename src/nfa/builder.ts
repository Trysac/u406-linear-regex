import type { AstNode, AstRoot } from "../../interfaces/ast.js";
import type { NfaGraph, NfaTransition } from "../../interfaces/nfa.js";
import { LimitExceededError } from "./errors.js";
import { getCaseFoldedCodePoints, invertRanges, normalizeRanges } from "./utf16.js";

interface Fragment {
  readonly start: number;
  readonly end: number;
}

/**
 * Builds a Thompson NFA graph from an AST root.
 */
export function buildNfa(ast: AstRoot): NfaGraph {
  let nextStateId = 0;
  const transitions: NfaTransition[][] = [];

  function createState(): number {
    const id = nextStateId++;
    transitions.push([]);
    return id;
  }

  function addTransition(t: NfaTransition): void {
    transitions[t.fromState]?.push(t);
  }

  const flags = ast.flags;

  function buildOptional(childNode: AstNode, greedy: boolean): Fragment {
    const start = createState();
    const end = createState();
    const frag = buildNode(childNode);
    if (greedy) {
      addTransition({ fromState: start, toState: frag.start, kind: "epsilon" });
      addTransition({ fromState: start, toState: end, kind: "epsilon" });
    } else {
      addTransition({ fromState: start, toState: end, kind: "epsilon" });
      addTransition({ fromState: start, toState: frag.start, kind: "epsilon" });
    }
    addTransition({ fromState: frag.end, toState: end, kind: "epsilon" });
    return { start, end };
  }

  function buildPlus(childNode: AstNode, greedy: boolean): Fragment {
    const start = createState();
    const end = createState();
    const frag = buildNode(childNode);
    addTransition({ fromState: start, toState: frag.start, kind: "epsilon" });
    if (greedy) {
      addTransition({ fromState: frag.end, toState: frag.start, kind: "epsilon" });
      addTransition({ fromState: frag.end, toState: end, kind: "epsilon" });
    } else {
      addTransition({ fromState: frag.end, toState: end, kind: "epsilon" });
      addTransition({ fromState: frag.end, toState: frag.start, kind: "epsilon" });
    }
    return { start, end };
  }

  function buildNode(node: AstNode): Fragment {
    switch (node.type) {
      case "literal": {
        const start = createState();
        const end = createState();
        if (flags.caseInsensitive) {
          const variants = getCaseFoldedCodePoints(node.codePoint);
          for (const cp of variants) {
            addTransition({
              fromState: start,
              toState: end,
              kind: "range",
              min: cp,
              max: cp,
            });
          }
        } else {
          addTransition({
            fromState: start,
            toState: end,
            kind: "range",
            min: node.codePoint,
            max: node.codePoint,
          });
        }
        return { start, end };
      }

      case "dot": {
        const start = createState();
        const end = createState();
        if (flags.dotAll) {
          addTransition({
            fromState: start,
            toState: end,
            kind: "range",
            min: 0,
            max: 0x10ffff,
          });
        } else {
          addTransition({
            fromState: start,
            toState: end,
            kind: "range",
            min: 0,
            max: 9,
          });
          addTransition({
            fromState: start,
            toState: end,
            kind: "range",
            min: 11,
            max: 0x10ffff,
          });
        }
        return { start, end };
      }

      case "charClass": {
        const start = createState();
        const end = createState();
        let ranges: [number, number][] = node.ranges.map(([min, max]) => [min, max]);

        if (flags.caseInsensitive) {
          const expanded: [number, number][] = [];
          for (const [min, max] of ranges) {
            expanded.push([min, max]);
            if (min <= 122 && max >= 97) {
              const oMin = Math.max(min, 97);
              const oMax = Math.min(max, 122);
              expanded.push([oMin - 32, oMax - 32]);
            }
            if (min <= 90 && max >= 65) {
              const oMin = Math.max(min, 65);
              const oMax = Math.min(max, 90);
              expanded.push([oMin + 32, oMax + 32]);
            }
            if (max - min <= 128 && (min > 127 || max > 127)) {
              for (let cp = min; cp <= max; cp++) {
                const variants = getCaseFoldedCodePoints(cp);
                for (const v of variants) {
                  if (v < min || v > max) {
                    expanded.push([v, v]);
                  }
                }
              }
            }
          }
          ranges = expanded;
        }

        const finalRanges = node.inverted ? invertRanges(ranges) : normalizeRanges(ranges);
        for (const [min, max] of finalRanges) {
          addTransition({
            fromState: start,
            toState: end,
            kind: "range",
            min,
            max,
          });
        }
        return { start, end };
      }

      case "anchor": {
        const start = createState();
        const end = createState();
        let anchorKind = node.kind;
        if (!flags.multiline) {
          if (anchorKind === "start_line") anchorKind = "start_text";
          if (anchorKind === "end_line") anchorKind = "end_text";
        }
        addTransition({
          fromState: start,
          toState: end,
          kind: "anchor",
          anchorKind,
        });
        return { start, end };
      }

      case "concat": {
        if (node.children.length === 0) {
          const start = createState();
          const end = createState();
          addTransition({ fromState: start, toState: end, kind: "epsilon" });
          return { start, end };
        }
        if (node.children.length === 1 && node.children[0] !== undefined) {
          return buildNode(node.children[0]);
        }
        const frags = node.children.map((c) => buildNode(c));
        const first = frags[0];
        const last = frags[frags.length - 1];
        if (!first || !last) {
          const start = createState();
          const end = createState();
          addTransition({ fromState: start, toState: end, kind: "epsilon" });
          return { start, end };
        }
        for (let i = 0; i < frags.length - 1; i++) {
          const curr = frags[i];
          const next = frags[i + 1];
          if (curr && next) {
            addTransition({
              fromState: curr.end,
              toState: next.start,
              kind: "epsilon",
            });
          }
        }
        return { start: first.start, end: last.end };
      }

      case "alt": {
        if (node.children.length === 0) {
          const start = createState();
          const end = createState();
          return { start, end };
        }
        const start = createState();
        const end = createState();
        for (const child of node.children) {
          const frag = buildNode(child);
          addTransition({ fromState: start, toState: frag.start, kind: "epsilon" });
          addTransition({ fromState: frag.end, toState: end, kind: "epsilon" });
        }
        return { start, end };
      }

      case "group": {
        const childFrag = buildNode(node.child);
        if (!node.capturing) {
          return childFrag;
        }
        const start = createState();
        const end = createState();
        const slot = (node.index ?? 1) * 2;
        addTransition({
          fromState: start,
          toState: childFrag.start,
          kind: "epsilon",
          captureSlot: slot,
        });
        addTransition({
          fromState: childFrag.end,
          toState: end,
          kind: "epsilon",
          captureSlot: slot + 1,
        });
        return { start, end };
      }

      case "repetition": {
        const min = node.min;
        const max = node.max;
        const greedy = flags.ungreedy ? !node.greedy : node.greedy;

        if (min > 10000 || (Number.isFinite(max) && max > 10000)) {
          throw new LimitExceededError("Repetition count exceeds limit of 10000");
        }

        if (min === 0 && max === 0) {
          const start = createState();
          const end = createState();
          addTransition({ fromState: start, toState: end, kind: "epsilon" });
          return { start, end };
        }

        if (min === 0 && max === 1) {
          return buildOptional(node.child, greedy);
        }

        if (min === 0 && max === Infinity) {
          const start = createState();
          const end = createState();
          const frag = buildNode(node.child);
          if (greedy) {
            addTransition({ fromState: start, toState: frag.start, kind: "epsilon" });
            addTransition({ fromState: start, toState: end, kind: "epsilon" });
            addTransition({ fromState: frag.end, toState: frag.start, kind: "epsilon" });
            addTransition({ fromState: frag.end, toState: end, kind: "epsilon" });
          } else {
            addTransition({ fromState: start, toState: end, kind: "epsilon" });
            addTransition({ fromState: start, toState: frag.start, kind: "epsilon" });
            addTransition({ fromState: frag.end, toState: end, kind: "epsilon" });
            addTransition({ fromState: frag.end, toState: frag.start, kind: "epsilon" });
          }
          return { start, end };
        }

        if (min === 1 && max === Infinity) {
          return buildPlus(node.child, greedy);
        }

        // Bounded repetition
        const mandCount = max === Infinity ? min - 1 : min;
        const mandatoryFrags: Fragment[] = [];
        for (let i = 0; i < mandCount; i++) {
          mandatoryFrags.push(buildNode(node.child));
        }

        let lastFrag: Fragment | undefined;
        if (mandatoryFrags.length > 0) {
          for (let i = 0; i < mandatoryFrags.length - 1; i++) {
            const curr = mandatoryFrags[i];
            const next = mandatoryFrags[i + 1];
            if (curr && next) {
              addTransition({
                fromState: curr.end,
                toState: next.start,
                kind: "epsilon",
              });
            }
          }
          lastFrag = mandatoryFrags[mandatoryFrags.length - 1];
        }

        if (max === Infinity) {
          const plusFrag = buildPlus(node.child, greedy);
          const firstMand = mandatoryFrags[0];
          if (lastFrag && firstMand) {
            addTransition({
              fromState: lastFrag.end,
              toState: plusFrag.start,
              kind: "epsilon",
            });
            return { start: firstMand.start, end: plusFrag.end };
          }
          return plusFrag;
        }

        if (max > min) {
          const optCount = max - min;
          const optFrags: Fragment[] = [];
          for (let i = 0; i < optCount; i++) {
            optFrags.push(buildOptional(node.child, greedy));
          }
          for (let i = 0; i < optFrags.length - 1; i++) {
            const curr = optFrags[i];
            const next = optFrags[i + 1];
            if (curr && next) {
              addTransition({
                fromState: curr.end,
                toState: next.start,
                kind: "epsilon",
              });
            }
          }
          const firstOpt = optFrags[0];
          const lastOpt = optFrags[optFrags.length - 1];
          const firstMand = mandatoryFrags[0];
          if (lastFrag && firstOpt && lastOpt && firstMand) {
            addTransition({
              fromState: lastFrag.end,
              toState: firstOpt.start,
              kind: "epsilon",
            });
            return {
              start: firstMand.start,
              end: lastOpt.end,
            };
          }
          if (firstOpt && lastOpt) {
            return { start: firstOpt.start, end: lastOpt.end };
          }
        }

        const firstMand = mandatoryFrags[0];
        const lastMand = mandatoryFrags[mandatoryFrags.length - 1];
        if (firstMand && lastMand) {
          return {
            start: firstMand.start,
            end: lastMand.end,
          };
        }

        const fallback = createState();
        return { start: fallback, end: fallback };
      }
    }
  }

  const rootFrag = buildNode(ast.root);
  const startState = createState();
  const matchState = createState();

  addTransition({
    fromState: startState,
    toState: rootFrag.start,
    kind: "epsilon",
    captureSlot: 0,
  });
  addTransition({
    fromState: rootFrag.end,
    toState: matchState,
    kind: "epsilon",
    captureSlot: 1,
  });

  const stateCount = nextStateId;
  const frozenTransitions: readonly (readonly NfaTransition[])[] = transitions.map((list) =>
    Object.freeze([...list]),
  );

  return {
    startState,
    matchState,
    stateCount,
    captureCount: ast.captureCount,
    groupNames: ast.groupNames ?? new Map(),
    transitionsFrom(state: number): readonly NfaTransition[] {
      const list = frozenTransitions[state];
      if (state >= 0 && list !== undefined) {
        return list;
      }
      return [];
    },
  };
}
