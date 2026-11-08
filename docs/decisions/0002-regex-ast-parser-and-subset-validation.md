# Regex AST Parser and Subset Validation

Status: accepted (generated, pending human review)

## Context

The linear-regex engine requires an AST parser that strictly verifies the linear RE2 subset (rejecting exponential backtracking features like backreferences and lookahead/lookbehind) and enforces size and recursion depth limits.

## Decision

Implemented a recursive-descent parser decoding full Unicode code points with depth tracking, a dedicated character class range merge and inversion utility, and a typed error hierarchy (LinearRegexError with UnsupportedFeatureError, RegexSyntaxError, and LimitExceededError).

## Consequences

Guarantees that untrusted regex patterns cannot cause catastrophic parsing resource exhaustion or stack overflow, and guarantees all parsed patterns conform to the linear-time execution subset.
