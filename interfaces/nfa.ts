import type { AstRoot } from "./ast.js";

export interface NfaTransition {
  readonly fromState: number;
  readonly toState: number;
  readonly kind: "epsilon" | "range" | "anchor";
  readonly min?: number;
  readonly max?: number;
  readonly anchorKind?:
    | "start_line"
    | "end_line"
    | "start_text"
    | "end_text"
    | "word_boundary"
    | "not_word_boundary";
  readonly captureSlot?: number;
}

export interface NfaGraph {
  readonly startState: number;
  readonly matchState: number;
  readonly stateCount: number;
  readonly captureCount: number;
  readonly groupNames: ReadonlyMap<string, number>;
  readonly transitionsFrom: (state: number) => readonly NfaTransition[];
}

export declare function buildNfa(ast: AstRoot): NfaGraph;
