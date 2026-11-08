import type { AstRoot } from "./ast.js";
import { parseRegex } from "./parser.js";
import type { CompileOptions } from "./types.js";

export * from "./ast.js";
export * from "./parser.js";
export * from "./ranges.js";
export * from "./types.js";

/**
 * Facade compile function used by the parser package to validate and generate an AST,
 * matching the LinearRegex compile interface error behavior.
 */
export function compile(
  pattern: string,
  flags?: string,
  options?: CompileOptions,
): { readonly ast: AstRoot } {
  const ast = parseRegex(pattern, flags, options);
  return { ast };
}
