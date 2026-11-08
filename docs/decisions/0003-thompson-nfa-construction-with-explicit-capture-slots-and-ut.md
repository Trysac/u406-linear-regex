# Thompson NFA construction with explicit capture slots and UTF-16 code point decoding

Status: accepted (generated, pending human review)

## Context

Regular expression engines requiring guaranteed linear-time matching rely on compiling an AST into a Thompson NFA. The NFA must handle Unicode code points decoded from UTF-16 surrogate pairs, case-folded character sets, interval character ranges, anchors, and capturing group slots without catastrophic backtracking.

## Decision

We implemented Thompson NFA construction using fragment composition. Each AST node compiles into an entry/exit fragment connected via epsilon transitions, character range intervals, and anchor checks. UTF-16 decoding handles surrogate pairs into code points up to U+10FFFF. Capturing groups and the full match use slots 2k (start) and 2k+1 (end). State transitions are stored in index-addressed arrays for O(1) retrieval.

## Consequences

Compiling expressions runs in time linear in AST size plus bounded unrolls. The resulting graph can be executed via lazy DFA or Pike VM while preserving submatch indices and code point correctness.
