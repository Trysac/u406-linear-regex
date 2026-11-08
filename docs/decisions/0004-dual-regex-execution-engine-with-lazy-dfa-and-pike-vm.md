# Dual regex execution engine with Lazy DFA and Pike VM

Status: accepted (generated, pending human review)

## Context

Regular expression engines must ensure linear time worst-case performance to completely prevent ReDoS vulnerabilities while supporting fast full-text searching and capturing group extraction.

## Decision

Implement a dual-engine architecture: a lazy DFA with bounded LRU state cache for fast linear time testing/execution without capture groups, and an exact Pike VM for full submatch extraction. When DFA state limits are exceeded, execution seamlessly falls back to Pike VM.

## Consequences

All 10 documented pathological ReDoS patterns execute in O(N) time with step ratio under 11, group extractions accurately resolve named and indexed captures, and memory usage is bounded by an LRU cache.
