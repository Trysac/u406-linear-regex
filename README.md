# linear-regex

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/Trysac/u406-linear-regex/actions/workflows/ci.yml/badge.svg)](https://github.com/Trysac/u406-linear-regex/actions/workflows/ci.yml)

Linear-time regular expression engine in TypeScript implementing a ReDoS-safe RE2 subset via Pike VM and lazy DFA.

## Problem

JavaScript's built-in `RegExp` uses a backtracking matcher, so a pattern such as `(a+)+$` can take exponential
time on crafted input (ReDoS). Services that run user-supplied or third-party patterns against untrusted text are
exposed to this. The usual alternative, Google RE2, reaches Node.js through native or WebAssembly bindings rather than
plain TypeScript. This project implements a dependency-free RE2-style subset in TypeScript: patterns are parsed and
validated, compiled to a Thompson NFA, and executed by a lazy DFA that falls back to a Pike VM when captures are needed
or the DFA state cache is exhausted. Backreferences and lookaround assertions are rejected with
`UnsupportedFeatureError`, and pattern length, nesting depth and input length are bounded.

## Install

The package is not published to npm yet. Build it from a clone:

```sh
git clone https://github.com/Trysac/u406-linear-regex.git
cd u406-linear-regex
npm ci && npm run build
```

Requires Node.js 22 or newer. The build emits ES modules with TypeScript declarations in `dist/`.

## Usage

```ts
import { compile, replace, UnsupportedFeatureError } from "@trysac/linear-regex";

const email = compile("(\\w+)@(\\w+)\\.com");
console.log(email.test("mail ada@example.com")); // true
console.log(email.exec("mail ada@example.com")?.captures); // [ 'ada', 'example' ]

const numbers = [...compile("\\d+").matchAll("a1 b22 c333")].map((m) => m.match);
console.log(numbers); // [ '1', '22', '333' ]

console.log(replace("hello world", "$2, $1", "(\\w+)\\s(\\w+)")); // world, hello

// Features that need backtracking are rejected at compile time instead of running slowly.
try {
  compile("(a)\\1");
} catch (error) {
  console.log(error instanceof UnsupportedFeatureError); // true
}
```

`test/entry.test.ts` runs the same calls through the package entry point.

## API

| Export | Signature | Description |
|---|---|---|
| `compile` | `(pattern: string, flags?: string, options?: CompileOptions) => LinearRegex` | Parses, validates and compiles a pattern. Flags: `i`, `m`, `s`, `U`. |
| `LinearRegex` | `test`, `exec`, `matchAll`, `replace`, `lastStats` | A compiled pattern. Matches are `RegexMatch` objects (`match`, `index`, `length`, `captures`, `groups`). |
| `replace` | `(input, replacement, pattern, flags?, options?) => string` | One-shot replace; `replacement` is a `$1`/`$<name>` template or a function of the match. |
| `lastStats` | `() => { steps: number; engine: "dfa" \| "pike" }` | Steps and engine used by the most recent match. |
| `DEFAULT_MAX_INPUT_LENGTH` | `number` | Default input length limit (50,000,000). |
| `LinearRegexError` | class | Base of every error; carries a machine-readable `code`. |
| `RegexSyntaxError`, `UnsupportedFeatureError`, `LimitExceededError` | classes | Codes `PARSE_ERROR`, `UNSUPPORTED_FEATURE`, `LIMIT_EXCEEDED`. Branch on `code` for limit errors. |
| `greet` | `(name: string) => string` | Template helper kept for compatibility; not part of the engine. |

## Development

```sh
npm install
npm run check   # lint, format, types, tests with coverage, docs, secrets
```

See [AGENTS.md](AGENTS.md) for the full command list and [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## License

[MIT](LICENSE) © 2026 Miguel Gomez
