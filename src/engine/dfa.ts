import type { NfaGraph } from "../../interfaces/nfa.js";
import type { CompileOptions, EngineStats, RegexTraceEvent } from "../../interfaces/types.js";
import { checkAnchor, codePointBefore, isWordCodePoint } from "./unicode.js";

export interface DfaState {
  readonly id: number;
  readonly nfaStates: readonly number[];
  readonly isMatch: boolean;
  /** Keyed by code point * 64 + the anchor context of the position after it (see anchorContext). */
  readonly transitions: Map<number, DfaState>;
}

/**
 * LRU Cache for on-the-fly lazy DFA state construction with eviction tracking.
 */
export class DfaLruCache {
  private readonly states = new Map<string, DfaState>();
  private nextStateId = 1;

  constructor(
    public readonly maxStates: number,
    private readonly onEvent?: (event: RegexTraceEvent) => void,
  ) {}

  get(key: string, position?: number): DfaState | undefined {
    const state = this.states.get(key);
    if (state !== undefined) {
      this.states.delete(key);
      this.states.set(key, state);
      const hitEvt: RegexTraceEvent = {
        type: "dfa_cache_hit",
        stateId: state.id,
        ...(position !== undefined ? { position } : {}),
      };
      this.onEvent?.(hitEvt);
      return state;
    }
    const missEvt: RegexTraceEvent = {
      type: "dfa_cache_miss",
      ...(position !== undefined ? { position } : {}),
    };
    this.onEvent?.(missEvt);
    return undefined;
  }

  set(
    key: string,
    nfaStates: readonly number[],
    isMatch: boolean,
    position?: number,
  ): { state: DfaState; evicted: boolean } {
    let evicted = false;
    if (this.states.size >= this.maxStates) {
      const oldestKey = this.states.keys().next().value;
      if (oldestKey !== undefined) {
        const oldest = this.states.get(oldestKey);
        this.states.delete(oldestKey);
        evicted = true;
        const evictEvt: RegexTraceEvent = {
          type: "dfa_state_evicted",
          count: 1,
          ...(oldest !== undefined ? { stateId: oldest.id } : {}),
          ...(position !== undefined ? { position } : {}),
        };
        this.onEvent?.(evictEvt);
      }
    }

    const state: DfaState = {
      id: this.nextStateId++,
      nfaStates,
      isMatch,
      transitions: new Map<number, DfaState>(),
    };
    this.states.set(key, state);
    return { state, evicted };
  }

  get size(): number {
    return this.states.size;
  }

  clear(): void {
    this.states.clear();
  }
}

/**
 * Computes the epsilon-closure of a set of NFA states at a specific string position.
 */
export function computeEpsilonClosure(
  seeds: readonly number[],
  nfa: NfaGraph,
  pos: number,
  input: string,
): readonly number[] {
  const visited = new Set<number>();
  const queue: number[] = [...seeds];

  for (const s of seeds) {
    visited.add(s);
  }

  while (queue.length > 0) {
    const s = queue.shift();
    if (s === undefined) {
      break;
    }
    const transitions = nfa.transitionsFrom(s);
    for (const t of transitions) {
      if (t.kind === "epsilon") {
        if (!visited.has(t.toState)) {
          visited.add(t.toState);
          queue.push(t.toState);
        }
      } else if (t.kind === "anchor") {
        if (checkAnchor(t.anchorKind, pos, input)) {
          if (!visited.has(t.toState)) {
            visited.add(t.toState);
            queue.push(t.toState);
          }
        }
      }
    }
  }

  const result = Array.from(visited);
  result.sort((a, b) => a - b);
  return result;
}

/**
 * Everything an anchor can observe at a position, packed in 6 bits. The epsilon-closure at a position
 * depends on it, so a cached transition is only valid for the same context.
 */
export function anchorContext(input: string, pos: number): number {
  const prev = pos > 0 ? codePointBefore(input, pos) : -1;
  const next = pos < input.length ? (input.codePointAt(pos) ?? -1) : -1;
  return (
    (pos === 0 ? 1 : 0) |
    (pos === input.length ? 2 : 0) |
    (prev === 10 || prev === 13 ? 4 : 0) |
    (next === 10 || next === 13 ? 8 : 0) |
    (prev >= 0 && isWordCodePoint(prev) ? 16 : 0) |
    (next >= 0 && isWordCodePoint(next) ? 32 : 0)
  );
}

/**
 * Lazy DFA engine with LRU state caching and Pike VM fallback trigger.
 */
export class LazyDfa {
  public readonly cache: DfaLruCache;
  private readonly onEvent: ((event: RegexTraceEvent) => void) | undefined;

  constructor(
    public readonly nfa: NfaGraph,
    public readonly options?: CompileOptions,
  ) {
    const maxStates = options?.maxDfaStates ?? 10000;
    this.onEvent = options?.onEvent;
    this.cache = new DfaLruCache(maxStates, this.onEvent);
  }

  /**
   * Executes matching using the lazy DFA.
   * Returns fallback = true if max DFA states limit is reached.
   */
  execute(
    input: string,
    startIndex = 0,
  ): {
    readonly matched: boolean;
    readonly stats: EngineStats;
    readonly fallback: boolean;
  } {
    const effectiveStart = Math.max(0, startIndex);
    let steps = 1;

    if (effectiveStart > input.length) {
      return { matched: false, stats: { steps, engine: "dfa" }, fallback: false };
    }

    const initialNfaStates = computeEpsilonClosure(
      [this.nfa.startState],
      this.nfa,
      effectiveStart,
      input,
    );
    const initialKey = initialNfaStates.join(",");

    let current: DfaState | undefined = this.cache.get(initialKey, effectiveStart);
    if (!current) {
      const isMatch = initialNfaStates.includes(this.nfa.matchState);
      const { state, evicted } = this.cache.set(
        initialKey,
        initialNfaStates,
        isMatch,
        effectiveStart,
      );
      current = state;
      if (evicted) {
        this.onEvent?.({ type: "pike_vm_fallback", position: effectiveStart });
        return { matched: false, stats: { steps, engine: "dfa" }, fallback: true };
      }
    }

    let pos = effectiveStart;

    // Empty string match check
    if (input.length === 0 || pos === input.length) {
      if (current.isMatch) {
        return { matched: true, stats: { steps, engine: "dfa" }, fallback: false };
      }
    }

    while (pos < input.length) {
      steps++;
      const cp = input.codePointAt(pos);
      if (cp === undefined) {
        break;
      }
      const cpLen = cp > 0xffff ? 2 : 1;
      const nextPos = pos + cpLen;

      const transitionKey = cp * 64 + anchorContext(input, nextPos);
      let next: DfaState | undefined = current.transitions.get(transitionKey);
      if (!next) {
        // Transition on character cp
        const nextSeeds: number[] = [];
        for (const s of current.nfaStates) {
          for (const t of this.nfa.transitionsFrom(s)) {
            if (t.kind === "range" && t.min !== undefined && t.max !== undefined) {
              if (cp >= t.min && cp <= t.max) {
                nextSeeds.push(t.toState);
              }
            }
          }
        }

        // Unanchored search: startState is also considered at next position
        nextSeeds.push(this.nfa.startState);

        const nextNfaStates = computeEpsilonClosure(nextSeeds, this.nfa, nextPos, input);
        const key = nextNfaStates.join(",");

        let cached = this.cache.get(key, nextPos);
        if (!cached) {
          const isMatch = nextNfaStates.includes(this.nfa.matchState);
          const { state, evicted } = this.cache.set(key, nextNfaStates, isMatch, nextPos);
          cached = state;
          if (evicted) {
            this.onEvent?.({ type: "pike_vm_fallback", position: nextPos });
            return { matched: false, stats: { steps, engine: "dfa" }, fallback: true };
          }
        }

        current.transitions.set(transitionKey, cached);
        next = cached;
      }

      current = next;
      pos = nextPos;

      // Check match
      if (current.isMatch) {
        return { matched: true, stats: { steps, engine: "dfa" }, fallback: false };
      }
    }

    return { matched: current.isMatch, stats: { steps, engine: "dfa" }, fallback: false };
  }
}
