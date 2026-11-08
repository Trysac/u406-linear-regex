import type { NfaGraph, NfaTransition } from "../../interfaces/nfa.js";

/**
 * Test Thompson NFA builder supporting common regex features
 * for rigorous isolated testing of dual execution engines.
 */
export class NfaBuilder {
  private stateCounter = 0;
  private transitions: NfaTransition[] = [];
  private groupNamesMap = new Map<string, number>();
  public captureCount = 0;

  newState(): number {
    return this.stateCounter++;
  }

  addTransition(t: NfaTransition): void {
    this.transitions.push(t);
  }

  addGroupName(name: string, index: number): void {
    this.groupNamesMap.set(name, index);
  }

  build(startState: number, matchState: number): NfaGraph {
    const byFrom = new Map<number, NfaTransition[]>();
    for (const t of this.transitions) {
      let arr = byFrom.get(t.fromState);
      if (!arr) {
        arr = [];
        byFrom.set(t.fromState, arr);
      }
      arr.push(t);
    }

    return {
      startState,
      matchState,
      stateCount: this.stateCounter,
      captureCount: this.captureCount,
      groupNames: this.groupNamesMap,
      transitionsFrom: (state: number): readonly NfaTransition[] => byFrom.get(state) ?? [],
    };
  }
}

interface Frag {
  start: number;
  end: number;
}

/**
 * Compiles regular expression patterns used in acceptance and unit tests
 * into an NfaGraph instance.
 */
export function buildTestNfa(pattern: string): NfaGraph {
  const builder = new NfaBuilder();
  let pos = 0;

  function parseExpr(): Frag {
    let left = parseConcat();
    while (pos < pattern.length && pattern[pos] === "|") {
      pos++; // skip |
      const right = parseConcat();
      const newStart = builder.newState();
      const newEnd = builder.newState();
      builder.addTransition({ fromState: newStart, toState: left.start, kind: "epsilon" });
      builder.addTransition({ fromState: newStart, toState: right.start, kind: "epsilon" });
      builder.addTransition({ fromState: left.end, toState: newEnd, kind: "epsilon" });
      builder.addTransition({ fromState: right.end, toState: newEnd, kind: "epsilon" });
      left = { start: newStart, end: newEnd };
    }
    return left;
  }

  function parseConcat(): Frag {
    const start = builder.newState();
    let currEnd = start;

    while (pos < pattern.length && pattern[pos] !== "|" && pattern[pos] !== ")") {
      const frag = parseRepeat();
      builder.addTransition({ fromState: currEnd, toState: frag.start, kind: "epsilon" });
      currEnd = frag.end;
    }
    return { start, end: currEnd };
  }

  function parseRepeat(): Frag {
    let frag = parsePrimary();
    if (pos < pattern.length) {
      const ch = pattern[pos];
      if (ch === "*") {
        pos++;
        const s = builder.newState();
        const e = builder.newState();
        builder.addTransition({ fromState: s, toState: frag.start, kind: "epsilon" });
        builder.addTransition({ fromState: s, toState: e, kind: "epsilon" });
        builder.addTransition({ fromState: frag.end, toState: frag.start, kind: "epsilon" });
        builder.addTransition({ fromState: frag.end, toState: e, kind: "epsilon" });
        frag = { start: s, end: e };
      } else if (ch === "+") {
        pos++;
        const s = builder.newState();
        const e = builder.newState();
        builder.addTransition({ fromState: s, toState: frag.start, kind: "epsilon" });
        builder.addTransition({ fromState: frag.end, toState: frag.start, kind: "epsilon" });
        builder.addTransition({ fromState: frag.end, toState: e, kind: "epsilon" });
        frag = { start: s, end: e };
      } else if (ch === "?") {
        pos++;
        const s = builder.newState();
        const e = builder.newState();
        builder.addTransition({ fromState: s, toState: frag.start, kind: "epsilon" });
        builder.addTransition({ fromState: s, toState: e, kind: "epsilon" });
        builder.addTransition({ fromState: frag.end, toState: e, kind: "epsilon" });
        frag = { start: s, end: e };
      }
    }
    return frag;
  }

  function parsePrimary(): Frag {
    const ch = pattern[pos];
    if (ch === "^") {
      pos++;
      const s = builder.newState();
      const e = builder.newState();
      builder.addTransition({ fromState: s, toState: e, kind: "anchor", anchorKind: "start_text" });
      return { start: s, end: e };
    }
    if (ch === "$") {
      pos++;
      const s = builder.newState();
      const e = builder.newState();
      builder.addTransition({ fromState: s, toState: e, kind: "anchor", anchorKind: "end_text" });
      return { start: s, end: e };
    }
    if (ch === ".") {
      pos++;
      const s = builder.newState();
      const e = builder.newState();
      builder.addTransition({ fromState: s, toState: e, kind: "range", min: 0, max: 0x10ffff });
      return { start: s, end: e };
    }
    if (ch === "[") {
      pos++; // skip [
      let min = 0;
      let max = 0x10ffff;
      if (pattern.startsWith("a-z]", pos)) {
        pos += 4;
        min = 97;
        max = 122;
      } else if (pattern.startsWith("ab]", pos)) {
        pos += 3;
        min = 97;
        max = 98;
      } else {
        while (pos < pattern.length && pattern[pos] !== "]") {
          pos++;
        }
        if (pos < pattern.length) pos++;
      }
      const s = builder.newState();
      const e = builder.newState();
      builder.addTransition({ fromState: s, toState: e, kind: "range", min, max });
      return { start: s, end: e };
    }
    if (ch === "\\") {
      pos++;
      const esc = pattern[pos++] ?? "";
      const s = builder.newState();
      const e = builder.newState();
      if (esc === "d") {
        builder.addTransition({ fromState: s, toState: e, kind: "range", min: 48, max: 57 });
      } else if (esc === "w") {
        builder.addTransition({ fromState: s, toState: e, kind: "range", min: 48, max: 57 });
        builder.addTransition({ fromState: s, toState: e, kind: "range", min: 65, max: 90 });
        builder.addTransition({ fromState: s, toState: e, kind: "range", min: 97, max: 122 });
        builder.addTransition({ fromState: s, toState: e, kind: "range", min: 95, max: 95 });
      } else if (esc === "b") {
        builder.addTransition({
          fromState: s,
          toState: e,
          kind: "anchor",
          anchorKind: "word_boundary",
        });
      } else {
        const cp = esc.codePointAt(0) ?? 0;
        builder.addTransition({ fromState: s, toState: e, kind: "range", min: cp, max: cp });
      }
      return { start: s, end: e };
    }
    if (ch === "(") {
      pos++;
      let isCapturing = true;
      let groupName: string | undefined;
      if (pattern.startsWith("?:", pos)) {
        pos += 2;
        isCapturing = false;
      } else if (pattern.startsWith("?P<", pos)) {
        pos += 3;
        const endAngle = pattern.indexOf(">", pos);
        groupName = pattern.slice(pos, endAngle);
        pos = endAngle + 1;
        isCapturing = true;
      }

      const groupIdx = isCapturing ? ++builder.captureCount : 0;
      if (groupName) {
        builder.addGroupName(groupName, groupIdx);
      }

      const s = builder.newState();
      const inner = parseExpr();
      const e = builder.newState();
      pos++; // skip )

      if (isCapturing) {
        builder.addTransition({
          fromState: s,
          toState: inner.start,
          kind: "epsilon",
          captureSlot: 2 * groupIdx,
        });
        builder.addTransition({
          fromState: inner.end,
          toState: e,
          kind: "epsilon",
          captureSlot: 2 * groupIdx + 1,
        });
      } else {
        builder.addTransition({ fromState: s, toState: inner.start, kind: "epsilon" });
        builder.addTransition({ fromState: inner.end, toState: e, kind: "epsilon" });
      }
      return { start: s, end: e };
    }

    // Literal character
    const cp = pattern.codePointAt(pos) ?? 0;
    pos += cp > 0xffff ? 2 : 1;
    const s = builder.newState();
    const e = builder.newState();
    builder.addTransition({ fromState: s, toState: e, kind: "range", min: cp, max: cp });
    return { start: s, end: e };
  }

  const root = parseExpr();
  const startState = builder.newState();
  const matchState = builder.newState();
  builder.addTransition({
    fromState: startState,
    toState: root.start,
    kind: "epsilon",
    captureSlot: 0,
  });
  builder.addTransition({
    fromState: root.end,
    toState: matchState,
    kind: "epsilon",
    captureSlot: 1,
  });

  return builder.build(startState, matchState);
}
