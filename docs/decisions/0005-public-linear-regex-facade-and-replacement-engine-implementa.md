# Public linear regex facade and replacement engine implementation

Status: accepted (generated, pending human review)

## Context

The linear-regex library requires a clean public API providing compile, replace, matchAll, test, exec, and lastStats tracking. Regex substitutions must strictly adhere to ECMAScript GetSubstitution rules for numbering ($1-$99), named groups ($<name> and ${name}), and special tokens ($&, $0, $`, $', $$) while enforcing strict input limits to protect against DoS.

## Decision

Implemented LinearRegexImpl wrapping EngineExecutor, eager input validation against DEFAULT_MAX_INPUT_LENGTH, safe UTF-16 code point advancement for 0-length matches, template substitution adhering to ECMAScript standard, and dual instance/global lastStats tracking.

## Consequences

Callers receive guaranteed linear-time matching and replacement with full capture and named group support. All acceptance criteria and edge cases pass with 100% test branch coverage.
