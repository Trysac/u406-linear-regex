import type { NfaGraph } from "../../interfaces/nfa.js";
import type { EngineStats, RegexMatch } from "../../interfaces/types.js";
import { checkAnchor } from "./unicode.js";

interface PikeThread {
  readonly state: number;
  readonly saved: readonly number[];
}

/**
 * Pike VM engine for linear-time submatch extraction.
 */
export class PikeVm {
  constructor(public readonly nfa: NfaGraph) {}

  execute(
    input: string,
    startIndex = 0,
  ): {
    readonly match: RegexMatch | null;
    readonly matched: boolean;
    readonly stats: EngineStats;
  } {
    const effectiveStart = Math.max(0, startIndex);
    let steps = 0;
    const totalSlots = (this.nfa.captureCount + 1) * 2;

    if (effectiveStart > input.length) {
      return {
        match: null,
        matched: false,
        stats: { steps: 1, engine: "pike" },
      };
    }

    let bestMatchSaved: number[] | null = null;
    const stateSlots = this.nfa.stateCount + 1;

    // Threads are kept in priority order (leftmost-first, greedy before lazy). A thread that reaches
    // the match state records the match and cuts every lower-priority thread; higher-priority
    // threads keep running and may replace it with a longer or preferred match.
    const addThread = (
      state: number,
      saved: readonly number[],
      pos: number,
      targetList: PikeThread[],
      visited: Uint8Array,
    ): void => {
      steps++;
      if (visited[state]) {
        return;
      }
      visited[state] = 1;

      if (state === this.nfa.matchState) {
        targetList.push({ state, saved });
        return;
      }

      let consumes = false;
      for (const t of this.nfa.transitionsFrom(state)) {
        if (t.kind === "epsilon") {
          let nextSaved = saved;
          if (t.captureSlot !== undefined && t.captureSlot < totalSlots) {
            const updated = [...saved];
            updated[t.captureSlot] = pos;
            nextSaved = updated;
          }
          addThread(t.toState, nextSaved, pos, targetList, visited);
        } else if (t.kind === "anchor") {
          if (checkAnchor(t.anchorKind, pos, input)) {
            addThread(t.toState, saved, pos, targetList, visited);
          }
        } else if (t.kind === "range" && !consumes) {
          consumes = true;
          targetList.push({ state, saved });
        }
      }
    };

    let currentThreads: PikeThread[] = [];
    let visited = new Uint8Array(stateSlots);
    let pos = effectiveStart;

    for (;;) {
      // Unanchored search: until a match is found, a new attempt starts here at the lowest priority.
      if (bestMatchSaved === null) {
        const newSaved = new Array<number>(totalSlots).fill(-1);
        newSaved[0] = pos;
        addThread(this.nfa.startState, newSaved, pos, currentThreads, visited);
      }
      // No live thread: done once a match exists or the input is exhausted; otherwise move on so a
      // later position (after a newline, say) can still start one.
      if (currentThreads.length === 0 && (bestMatchSaved !== null || pos >= input.length)) {
        break;
      }

      const cp = pos < input.length ? input.codePointAt(pos) : undefined;
      const nextPos = cp === undefined ? pos : pos + (cp > 0xffff ? 2 : 1);
      const nextThreads: PikeThread[] = [];
      const nextVisited = new Uint8Array(stateSlots);

      for (const th of currentThreads) {
        if (th.state === this.nfa.matchState) {
          const finalSaved = [...th.saved];
          if (finalSaved[1] === -1) {
            finalSaved[1] = pos;
          }
          bestMatchSaved = finalSaved;
          break;
        }
        if (cp === undefined) {
          continue;
        }
        for (const t of this.nfa.transitionsFrom(th.state)) {
          if (t.kind === "range" && t.min !== undefined && t.max !== undefined) {
            if (cp >= t.min && cp <= t.max) {
              addThread(t.toState, th.saved, nextPos, nextThreads, nextVisited);
            }
          }
        }
      }

      if (cp === undefined) {
        break;
      }
      currentThreads = nextThreads;
      visited = nextVisited;
      pos = nextPos;
    }

    if (bestMatchSaved === null) {
      return {
        match: null,
        matched: false,
        stats: { steps: Math.max(1, steps), engine: "pike" },
      };
    }

    const savedArr: number[] = bestMatchSaved;
    const matchStart =
      savedArr[0] !== undefined && savedArr[0] !== -1 ? savedArr[0] : effectiveStart;
    const matchEnd = savedArr[1] !== undefined && savedArr[1] !== -1 ? savedArr[1] : pos;
    const matchText = input.slice(matchStart, matchEnd);

    const captures: (string | undefined)[] = [];
    for (let i = 1; i <= this.nfa.captureCount; i++) {
      const startSlot = 2 * i;
      const endSlot = 2 * i + 1;
      const s = savedArr[startSlot];
      const e = savedArr[endSlot];
      if (s !== undefined && e !== undefined && s !== -1 && e !== -1) {
        captures.push(input.slice(s, e));
      } else {
        captures.push(undefined);
      }
    }

    const groups: Record<string, string | undefined> = {};
    for (const [name, idx] of this.nfa.groupNames.entries()) {
      if (idx >= 1 && idx <= captures.length) {
        groups[name] = captures[idx - 1];
      } else if (idx < captures.length) {
        groups[name] = captures[idx];
      } else {
        groups[name] = undefined;
      }
    }

    const regexMatch: RegexMatch = {
      match: matchText,
      index: matchStart,
      length: matchEnd - matchStart,
      captures,
      groups,
    };

    return {
      match: regexMatch,
      matched: true,
      stats: { steps: Math.max(1, steps), engine: "pike" },
    };
  }
}
