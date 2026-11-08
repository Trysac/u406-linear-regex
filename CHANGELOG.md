# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Entries are derived from Conventional Commits.

## [Unreleased]

### Added

- Add LinearRegex public facade with compile, replace, matchAll, test, exec, and ECMAScript substitution templating.
- Add dual execution engines featuring Lazy DFA with LRU cache and Pike VM for linear-time regex matching and submatch extraction.
- Add Thompson NFA builder with UTF-16 code point decoding, character range intervals, anchors, and capture slots.
- * Implement RE2-subset AST parser, typed error hierarchy, and limit enforcement.
- Initial project structure from the factory utility template.
