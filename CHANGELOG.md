# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-09-25

### Added — `@`-command dynamic scope (layer 4)

A `# @-command dynamic scope` prompt section teaches the model to resolve `@`-prefixed tokens
as explicitly referenced paths across the multi-root workspace: `@absolute/path` or
`@relative/to-a-workspace-root`. A trailing `/` scopes to a directory tree, a bare path
means "read it first" (never claim inspection before reading), and `@"path with spaces"`
quotes paths with spaces. Referenced paths take priority; anything outside the injected
file index is still readable because sandbox reads are unrestricted.

### Research

- 0b (input-box hook): DSH exposes an @file / @session / /command trigger pipeline via
  ctx.fileReferences and ctx.commandUi. The built-in local @file provider is rooted at
  the session cwd (single root), so cross-root completion needs a custom provider; the
  prompt-level @-command section covers cross-root dynamic scope today.
- 0c (tokenizer): landed in 0.2.0 (estimateTokens in contextStats.ts).

## [0.2.0] - 2026-09-25

### Added — Context-control roadmap (workspace layer)

A four-layer context-control model so that injecting several repositories no longer
blows up the model context. Layers 1-3 ship in this release; layer 4 (@-commands) is
next.

1. **Directory tri-state access.** Every code-project directory gets a `readwrite` /
   `readonly` / `disabled` access level. `readonly` keeps the absolute path in the
   prompt but excludes it from the sandbox writable roots; `disabled` drops it from the
   prompt entirely. The primary directory (index 0) is always `readwrite`.
2. **Workspace mode.** `anchor` (primary = docs/anchor folder) vs `single` (primary =
   core business code), switching the role labels emitted into the system prompt.
3. **Directory grouping.** Optional group tags (docs / backend / frontend / reference /
   other) rendered as `[group]` sub-headers in the prompt.
4. **Workspace snapshots.** One-click save / restore / delete of a workspace's directory
   configuration (order + access + group). Restore re-syncs the sandbox writable roots
   immediately.
5. **File-index foundation.** Gitignore-aware, bounded recursive file-tree scanner
   (`maxDepth` / `maxFiles`) with an mtime-keyed cache. Built-in ignores for `.git`,
   `node_modules`, `dist`, `build`, `coverage`, `.DS_Store`.
6. **File load modes.** Per-workspace `full` / `summary` / `tree` load mode controlling
   how much file detail is injected below the directory list. `summary` emits only file /
   dir counts, `tree` a shallow tree, `full` the complete tree.
7. **Context-monitor panel.** A `contextStats` endpoint plus a client card showing
   per-directory file counts and an estimated token budget (lightweight CJK-aware
   tokenizer) with a manual refresh.

### Changed

- The system prompt now emits the directory list plus an optional `# File index` (file
  index) section, ordered after the directory list and before the hardening rules.

### Fixed

- `FileIndexCache` keyed only by `root + mtime`, ignoring scan depth — switching load
  modes reused a stale shallow tree. The key now includes `maxDepth` / `maxFiles`.

## [0.1.0] - 2026-09-24

### Added

- Initial release: left-sidebar workspace combiner, multi-directory workspace binding,
  new-workspace wizard with project-type detection (Java / Vue / React / Python / Go)
  and multi-select, system-prompt injection of absolute repository paths, and
  `@chaoset/sandbox-extra-roots` writable-root sync.