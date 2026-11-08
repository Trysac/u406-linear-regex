# Project record: linear-regex

## Objective

Linear-time regular expression engine in TypeScript implementing a ReDoS-safe RE2 subset via Pike VM and lazy DFA.

State the measurable outcome this utility must deliver and who it is for.

## Scope

In scope:

- The public API documented in the README.

Out of scope:

- List what this utility deliberately does not do.

## Timeline

| Date | Milestone |
|---|---|
| 2026 | Repository created from the factory utility template. |

## Effort metrics

Measured values only. Leave "pending measurement" until a real figure is recorded; never estimate here.

| Metric | Value | Source |
|---|---|---|
| Tokens (input / output) | 2849085 / 64451 | factory ledger |
| Hours (human) | pending measurement | time log |
| Cost (USD) | 0.6008 | factory ledger |

## Factory run linear-regex-parser (measured from API usage)

| Phase | Model | Batch | Input | Output | Cache write | Cache read | Cost (USD) |
|---|---|---|---|---|---|---|---|
| generation | gemini-3.8-flash | yes | 6213 | 48712 | 0 | 0 | 0.0937 |
| fix-1 | gemini-3.8-flash | no | 93099 | 1556 | 0 | 947768 | 0.1467 |
| fix-2 | gemini-3.8-flash | no | 69067 | 3186 | 0 | 202886 | 0.0790 |
| fix-3 | gemini-3.8-flash | no | 16951 | 91 | 0 | 12753 | 0.0140 |
| audit | gemini-3.1-flash-lite | no | 28882 | 550 | 0 | 32542 | 0.0089 |
| fix-1 | gemini-3.8-flash | no | 80522 | 9558 | 0 | 478985 | 0.1322 |
| fix-2 | gemini-3.8-flash | no | 85052 | 798 | 0 | 794365 | 0.1264 |

Total: $0.6008. Prices: Anthropic list prices.
