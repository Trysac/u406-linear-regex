# linear-regex

[![npm version](https://img.shields.io/npm/v/@trysac/linear-regex.svg)](https://www.npmjs.com/package/@trysac/linear-regex)
[![license: MIT](https://img.shields.io/npm/l/@trysac/linear-regex.svg)](LICENSE)
[![CI](https://github.com/Trysac/u406-linear-regex/actions/workflows/ci.yml/badge.svg)](https://github.com/Trysac/u406-linear-regex/actions/workflows/ci.yml)

Linear-time regular expression engine in TypeScript implementing a ReDoS-safe RE2 subset via Pike VM and lazy DFA.

## Problem

JavaScript's built-in `RegExp` uses a backtracking matcher, so a pattern such as `(a+)+$` can take exponential
time on crafted input (ReDoS). Services that run user-supplied or third-party patterns against untrusted text are
exposed to this. The usual alternative, Google RE2, reaches Node.js through native or WebAssembly bindings rather than
plain TypeScript. This project implements a dependency-free RE2-style subset in TypeScript: patterns are parsed and
validated, compiled to a Thompson NFA, and executed by a lazy DFA that falls back to a Pike VM when captures are needed
or the DFA state cache is exhausted. Backreferences and lookaround assertions are rejected with
`UnsupportedFeatureError`, and pattern length, nesting depth and input length are bounded. The engine lives under
`src/` and is not yet exported from the package entry point; see [API](#api).

## Install

```sh
npm install @trysac/linear-regex
```

Requires Node.js 20 or newer. The package ships ES modules with TypeScript declarations.

## Usage

```ts
import { greet } from "@trysac/linear-regex";

// Build a greeting; surrounding whitespace is ignored.
const message = greet("  Ada ");
console.log(message); // "Hello, Ada!"

try {
  greet("   ");
} catch (error) {
  console.error((error as Error).message); // "name must not be empty"
}
```

## API

| Export | Signature | Description |
|---|---|---|
| `greet` | `(name: string) => string` | Placeholder API; replace it with the real one. |

## Development

```sh
npm install
npm run check   # lint, format, types, tests with coverage, docs, secrets
```

See [AGENTS.md](AGENTS.md) for the full command list and [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## License

[MIT](LICENSE) © 2026 Miguel Gomez
