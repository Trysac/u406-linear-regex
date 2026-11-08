/**
 * Parsed compilation flags.
 */
export interface FlagSet {
  readonly caseInsensitive: boolean;
  readonly multiline: boolean;
  readonly dotAll: boolean;
  readonly ungreedy: boolean;
}

/**
 * AST node representation of regular expression components.
 */
export type AstNode =
  | { readonly type: "literal"; readonly codePoint: number }
  | { readonly type: "dot" }
  | {
      readonly type: "charClass";
      readonly ranges: readonly (readonly [number, number])[];
      readonly inverted: boolean;
    }
  | {
      readonly type: "anchor";
      readonly kind:
        | "start_line"
        | "end_line"
        | "start_text"
        | "end_text"
        | "word_boundary"
        | "not_word_boundary";
    }
  | {
      readonly type: "repetition";
      readonly child: AstNode;
      readonly min: number;
      readonly max: number;
      readonly greedy: boolean;
    }
  | { readonly type: "concat"; readonly children: readonly AstNode[] }
  | { readonly type: "alt"; readonly children: readonly AstNode[] }
  | {
      readonly type: "group";
      readonly child: AstNode;
      readonly capturing: boolean;
      readonly index?: number;
      readonly name?: string;
    };

/**
 * Root AST container holding flags, capture metadata, and the syntax tree.
 */
export interface AstRoot {
  readonly root: AstNode;
  readonly flags: FlagSet;
  readonly captureCount: number;
  readonly groupNames: ReadonlyMap<string, number>;
}
