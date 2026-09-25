# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-09-26

### Changed — client UI redesign (dark IDE aesthetic)

Rebuilt the sidebar panel information architecture around action frequency and gave it a
glassmorphic, dark-IDE visual language. No functionality was removed.

- **Top bar (new high-frequency zone).** Brand row (gradient mark, title, subtitle,
  `⌘N` badge), a highlighted current-workspace card (gradient border, glowing status dot,
  mode / project-count / load-mode summary) and the primary **New session** button moved up
  from the bottom of the panel.
- **Workspace list.** Compact rows with status dot, name, current pill, relative last-used
  time, plus search filtering (client-side only) and a compact new-workspace button.
- **Project directories.** Collapsible section (expanded by default) with a drag handle,
  primary star, gradient type square (D/B/F), name, monospace path, colored group pill,
  access pill and an always-visible remove button. HTML5 drag reordering now shows a
  gradient drop line at the target position.
- **Advanced config** (collapsed by default, summary shown when collapsed): workspace mode
  and file load mode changed from `<select>` to segmented tabs, snapshots list moved here.
- **Context budget.** The monitor is now visual: a gradient token-budget progress bar with
  glow plus per-directory comparison bars; the previous numeric breakdown is retained below.
- **Empty states** with guidance and a primary call to action; **bottom legend** for
  read-write / read-only / disabled.
- **Visual system**: panel gradient surface, 12-14px cards, accent gradient primary buttons,
  status-color glows, 999px pills, glowing `:focus-visible` rings, 14-16px modals with a
  blurred scrim and colored step dots, stacked toasts that auto-dismiss after 3s. Every
  color ships both a `--dsw-alias-*` token and a hard-coded fallback so light and dark themes
  stay readable.
- **Accessibility**: `aria-label` on all interactive elements, modals support Esc and
  scrim-click dismissal with `aria-modal`, and key actions are keyboard reachable.

### Added — client UI features

- **Live injected-prompt preview** (P0). An expandable read-only code block renders
  `renderMultiWorkspacePrompt(...)` from the current directory list, mode, load mode and
  per-directory file trees (fetched through the existing file-index route), updating live as
  anything changes, with a copy button.
- **Configurable token budget** (P0). The budget target is editable in the monitor (default
  60000) and persisted per workspace; the bar turns amber past 80% and red past 100%, with an
  over-budget hint suggesting read-only/disabled directories or a lower load mode.
- **Bulk directory editing** (P1). Multi-select directories (the primary is excluded) and act
  on all of them at once: set access, set group, or delete.
- **Missing-directory detection** (P1). Each directory path is probed through the file-index
  route; gone paths turn red with a warning icon and tooltip.
- **Workspace pinning and color tags** (P1). Pin workspaces to sort them first and cycle a
  6-color tag per workspace.
- **Keyboard shortcuts and command palette** (P2). `⌘N`/`Ctrl+N` creates a session,
  `⌘K`/`Ctrl+K` opens a searchable palette (switch workspace, new session, add
  directory, refresh budget, toggle advanced/preview, change load mode) with arrow-key
  navigation, and `Esc` closes it.
- **Session usage readout** (P2). The panel shows how many sessions exist, next to the
  existing "new sessions only" caveat.

### Added — data model

- Optional workspace fields `tokenBudget`, `pinned` and `color`, plus `WorkspaceRef.note` and a
  shared `GitStatus` interface. All are parsed leniently on load so existing stores keep working.

### Changed — fixed-height layout with local scrolling

The panel no longer scrolls as a whole. It now fills the sidebar container at a fixed
height with `.wcb-root { overflow: hidden }`, and each crowded region scrolls on its own:

- The workspace list is capped (`max-height: 116px`, thin scrollbar) and only scrolls internally.
- The project-directory card is now `.wcb-card-grow` (`flex: 1` + `min-height: 0`), so the
  directory list absorbs the leftover height, scrolls internally, and the add row, bulk bar and
  hint stay pinned in view.
- The bulk-action bar dropped `position: sticky` for `flex: none` and moved inside the directory
  card; the session-usage readout and the "new sessions only" caveat moved into the context
  budget card; the toasts became an absolutely positioned overlay so they cannot add height.

### Added — UI features

- **Git status readout.** Each directory row shows its current branch: amber `branch *N` when there
  are uncommitted or untracked changes (hover gives the exact split), grey when the tree is clean,
  plus `↑N` when ahead of the upstream. Non-repository directories render nothing. A new
  `/api/dsh-workspace-combiner/git-status` route runs `git status --porcelain -b` through `execFile` (no
  shell, 5s timeout) and resolves to `null` instead of throwing on any failure.
- **Directory notes.** Every directory can carry a free-form note rendered under its path; click
  the placeholder or the note to edit inline, Enter saves, Esc cancels, blur saves. Empty notes are
  dropped from the stored data.
- **Sandbox link status.** The bottom legend now shows `🔒 Sandbox N/M` with a glowing dot, where N
  counts the directories actually present in the sandbox allowlist (disabled directories are
  excluded), matching the sandbox sync filter.
- **@-command cheat sheet.** The advanced-config card gained a `@ command cheat sheet` block listing the
  four `@` tokens the plugin understands; clicking a row copies it and shows a toast.

### Fixed — workspace metadata persistence

- Workspace metadata updates (`pinned`, `color`, `tokenBudget`) previously rode on the
  `workspace-mode` route, which only validated `mode` and rejected any other payload with
  `400` — the client swallowed the error, so the optimistic UI looked correct while the values
  were lost on reload. There is now a dedicated `/api/dsh-workspace-combiner/workspace-patch` route
  backed by `WorkspaceCombinerStore.patchMeta()`, which merges only the supplied fields and persists
  them; `workspace-mode` is back to accepting just `mode`.
### Added — project-directory annotations

- The primary row (the starred one) now carries a `📄 Docs only` badge explaining that it is the
  session anchor for Markdown/notes/requirements rather than source code, with a hover tooltip;
  every other row carries a lighter `💻 Code` tag next to its branch name. Both are rendered
  purely from row position — no schema change.
- A draggable divider splits the right column between **Project directories** and **Context budget
  (default 6:4)**. Drag to resize, double-click or `Home` to reset, arrow keys to nudge; the ratio is
  persisted in `localStorage`.

### Changed — context budget visualisation

- The per-directory usage list became a **column chart**: one bar per directory, scaled to the
  largest consumer, with token values above and names below, over four horizontal gridlines.
  The previous inline donut + horizontal bar per row is gone.

### Fixed — panel rendering

- **Brand icon rendered as a blank square.** It used an inline SVG plus a Unicode glyph that
  fell back to a missing-glyph box. It is now drawn with pure CSS (two offset squares) in both
  the header and the empty state, so it never depends on SVG or font coverage.
- **Accent colour was inverted per theme.** `--wcb-accent` pointed at
  `--dsw-alias-brand-primary`, which is a *foreground* token that flips between near-white
  (dark theme) and near-black (light theme). Used as a fill it produced white-on-white icons and
  buttons. It now resolves to the stable brand blue `--dsw-static-deepseek-500` with an explicit
  `--wcb-on-accent` foreground.
- **Workspace names truncated to a single character.** `.wcb-ws-name` could shrink to zero width;
  it now reserves a minimum width so names stay legible while still ellipsising when needed.
- **Workspace row controls overlapped the timestamp.** Status dot, name, current pill, time and
  actions now have explicit flex behaviour and spacing.
- **The New-session button clipped its label.**
- **A stray dot appeared at the top of the donut chart** at zero progress, because a round line
  cap renders a dot on a zero-length arc. Zero values are no longer drawn.
- **The left column left a large empty area.** Its first card now absorbs the remaining height and
  scrolls internally.
- **Clipboard copy could throw.** `navigator.clipboard` is absent in some contexts, where
  `writeText` throws synchronously and bypassed the promise `.catch()`. A guarded helper now
  reports the real outcome instead of always claiming success.

## [0.2.0] - 2026-09-25

### Added — Context-control roadmap (workspace layer)

A four-layer context-control model so that injecting several repositories no longer
blows up the model context.

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
8. **@-command dynamic scope.** A `# @-command dynamic scope` prompt section teaches the model to resolve `@`-prefixed tokens
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
- 0c (tokenizer): landed in this release (estimateTokens in contextStats.ts).

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
