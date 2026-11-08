/**
 * @packageDocumentation
 * Dual execution engines (Lazy DFA and Pike VM) for linear regex matching.
 */

export type { EngineExecutor, ExecutionResult } from "../../interfaces/engine.js";
export { DfaLruCache, LazyDfa } from "./dfa.js";
export { createExecutor, EngineExecutorImpl } from "./executor.js";
export { PATHOLOGICAL_PATTERNS, type PathologicalPatternCase } from "./pathological.js";
export { PikeVm } from "./pike.js";
export { checkAnchor, codePointBefore, isWordCodePoint } from "./unicode.js";
