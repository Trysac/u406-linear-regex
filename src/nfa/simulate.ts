import type { NfaGraph } from "../../interfaces/nfa.js";
import { decodeUtf16, isWordChar } from "./utf16.js";

function isAnchorSatisfied(kind: string, pos: number, codePoints: readonly number[]): boolean {
  const len = codePoints.length;
  const prevCp = pos > 0 ? codePoints[pos - 1] : undefined;
  const nextCp = pos < len ? codePoints[pos] : undefined;

  switch (kind) {
    case "start_text":
      return pos === 0;
    case "end_text":
      return pos === len;
    case "start_line":
      return pos === 0 || prevCp === 10;
    case "end_line":
      return pos === len || nextCp === 10;
    case "word_boundary": {
      const prevWord = isWordChar(prevCp);
      const nextWord = isWordChar(nextCp);
      return prevWord !== nextWord;
    }
    case "not_word_boundary": {
      const prevWord = isWordChar(prevCp);
      const nextWord = isWordChar(nextCp);
      return prevWord === nextWord;
    }
    default:
      return false;
  }
}

function epsilonClosure(
  initialStates: readonly number[],
  pos: number,
  codePoints: readonly number[],
  nfa: NfaGraph,
): number[] {
  const closure: number[] = [];
  const visited = new Set<number>();
  const queue = [...initialStates];

  for (let i = 0; i < queue.length; i++) {
    const s = queue[i];
    if (s === undefined || visited.has(s)) continue;
    visited.add(s);
    closure.push(s);

    const transitions = nfa.transitionsFrom(s);
    for (const t of transitions) {
      if (t.kind === "epsilon") {
        if (!visited.has(t.toState)) {
          queue.push(t.toState);
        }
      } else if (t.kind === "anchor" && t.anchorKind) {
        if (isAnchorSatisfied(t.anchorKind, pos, codePoints)) {
          if (!visited.has(t.toState)) {
            queue.push(t.toState);
          }
        }
      }
    }
  }

  return closure;
}

/**
 * Simulates an NFA on an input string, returning match status and step count.
 */
export function simulateNfa(
  nfa: NfaGraph,
  input: string,
  startIndex = 0,
): { matched: boolean; steps: number } {
  const codePoints = decodeUtf16(input);
  let totalSteps = 0;

  for (let start = startIndex; start <= codePoints.length; start++) {
    let current = epsilonClosure([nfa.startState], start, codePoints, nfa);
    if (current.includes(nfa.matchState)) {
      return { matched: true, steps: Math.max(1, totalSteps) };
    }

    for (let pos = start; pos < codePoints.length; pos++) {
      totalSteps++;
      const cp = codePoints[pos];
      if (cp === undefined) break;
      const nextStates: number[] = [];
      for (const s of current) {
        for (const t of nfa.transitionsFrom(s)) {
          if (t.kind === "range" && t.min !== undefined && t.max !== undefined) {
            if (cp >= t.min && cp <= t.max) {
              nextStates.push(t.toState);
            }
          }
        }
      }
      current = epsilonClosure(nextStates, pos + 1, codePoints, nfa);
      if (current.includes(nfa.matchState)) {
        return { matched: true, steps: Math.max(1, totalSteps) };
      }
      if (current.length === 0) {
        break;
      }
    }
  }

  return { matched: false, steps: Math.max(1, totalSteps) };
}
