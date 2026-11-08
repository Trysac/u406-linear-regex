export type { NfaGraph, NfaTransition } from "../../interfaces/nfa.js";
export { buildNfa } from "./builder.js";
export { LimitExceededError, LinearRegexError } from "./errors.js";
export { simulateNfa } from "./simulate.js";
export {
  codePointOffsets,
  decodeUtf16,
  getCaseFoldedCodePoints,
  invertRanges,
  isWordChar,
  normalizeRanges,
} from "./utf16.js";
