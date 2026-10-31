# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
English · [中文](./CHANGELOG.zh.md)

## [Unreleased]

## [0.8.10] - 2026-10-31

### Added

- The host half logs `dsh-workspace-combiner vX activated` at startup, and the **More** dialog shows
  the version the host process actually loaded. Upgrading the plugin only takes effect after a full
  restart, and this makes "did it reload?" verifiable instead of guesswork.

## [0.8.9] - 2026-10-31

### Fixed

- Renaming a workspace (including the automatic `(2)` suffix when a name collides) now renames the
  matching DSH workspace in the left sidebar. The title is also aligned when a session is created, so
  a workspace renamed before its first session still shows the plugin's name.

## [0.8.8] - 2026-10-23

### Fixed

- Duplicating a workspace used to share the source's primary directory (anchor), so quick sessions
  started from the copy still landed in the source workspace's DSH workspace and documents were
  written to the same place. The copy now gets its own anchor at `<parent>/<copy name>`; the other
  mounted (code-project) directories stay shared, and the duplicate dialog previews the new path.

## [0.8.7] - 2026-10-17

### Fixed

- A profile without `dsh-write-protect` no longer reports a sandbox-sync failure: the plugin has no
  integration point there, so the sync is a silent no-op. Previously every workspace change raised an
  error toast and a warning log, which made a plain install look broken.
- `@deepseek-ai/dsh-llm` is loaded through a runtime dynamic import; it was missing from
  `peerDependencies`, so AI summaries and standards drafting failed on a clean machine. It is now
  declared and installed together with the plugin.

## [0.8.6] - 2026-10-17

### Added

- New-workspace wizard pre-fills the primary-directory location (last used, otherwise the parent of
  the current workspace's primary directory) and lets you edit it in place instead of always opening
  the native folder picker.
- Workspace list gains **Duplicate** (⧉): same mounted directories and every setting, only the name
  and id change. The dialog lists exactly what will be copied.
- Built-in standard **Session anchor boundary**, enabled by default for new workspaces: the anchor
  only reads/writes non-code files, and documents produced in plugin sessions must land there.
- Deleting a workspace now also retires its DSH workspace: its sessions are archived and the matching
  DSH workspace entry is removed. Shared directories (duplicates) are skipped, and the entry is kept
  when a session could not be archived.

### Changed

- Context budgets are chosen as `On demand / Resident` plus `Compact / Standard / Detailed` tiers
  instead of raw token numbers; the numbers moved into an collapsible **Advanced** section.
- Token counts read `N token` everywhere (no `t` shorthand). The standards card and the standards
  dialog share one computation and show `injected / budget` or `full size · on demand`.

### Fixed

- The standards card showed `0 token` until `contextStats` finished loading; it is now derived
  locally from the effective groups.
- The standards dialog footer summed only the selected scope, showing `0 token` on directory tabs.
- The budget tier dialog overflowed instead of wrapping long hint text.
- Labels such as `Standards budget (0=on demand)` leaked the internal `0` convention.

## [0.8.5] - 2026-10-10

### Fixed — DSH 0.2.0-rc.2 compatibility (client half was broken)

- **Client session/workspace API regression.** The client half had been rewritten against a
  non-existent API (`sessions.list()` as a method, `sessions.create(id, opts)` returning a
  live session, `sessions.get()`, `session.append()`/`session.snapshotEvents()`,
  `workspaces.create(path)`). On DSH `0.2.0-rc.2` that made "new session" land in the wrong
  directory with no title, and session count/title silently read as empty. Restored the real
  contracts: `sessions.list.getSnapshot()`, `await sessions.create({ workspaceId, cwd })`,
  `sessions.binding(id).session.rename(title)`, `workspaces.create({ path })`.
- `src/client/types.ts` mirrors are now shape-checked against those contracts, and
  `smoke:dsh-compat` plus the new client contract test pin them.
- **`fileIndexBudget = 0` meant two opposite things** (unlimited while rendering, "nothing to
  trim" while trimming), which disabled the global budget gate for the file index. `0` now
  consistently means "not resident", like the other three blocks.
- **Blank directory paths are rejected.** An empty `path` used to be written into
  `dsh-write-protect`'s `writablePaths`, whose constructor throws on blank entries — taking the
  whole sandbox policy half down while the REST call still answered `200`.
- **A corrupt store no longer wipes user data.** A failed read used to degrade to an empty
  in-memory store, and the next `session/created` persisted that emptiness over the real file.
  The file is now quarantined as `.corrupt-<ts>` and writes are refused until restart.
- **Unhandled rejections removed** on the `session/created` path (a failed disk write could
  terminate the host process under Node's default policy).
- **Sandbox whitelist covers every live session**, not just the current workspace: switching
  workspaces no longer silently revokes write access from a session whose prompt still marks
  those directories writable.
- **`dsh-write-protect` settings override is reconciled.** Its effective roots come from
  `writablePatterns` when the settings page has been saved, which shadows the patch's
  `writablePaths`; both are now kept in sync, so "synced" in diagnostics means "effective".
- **Path normalization** (trailing separators, repeated separators, Windows case) for the
  whitelist and directory lists: `/a/b` and `/a/b/` are one directory, no duplicate entries,
  no permanent "missing" diagnostics.
- The file-index group heading is no longer dropped when an ungrouped directory sits between
  two directories of the same group.
- `sanitizeFolderName` rejects `.`/`..`/device names, which previously let the workspace
  primary directory escape to the parent of the chosen base path.
- Unknown workspace ids now return `404` instead of a silent `ok: true` no-op; the sandbox
  sync result is reported back as `sandboxSynced`.
- **Per-session on-demand context writes are serialized with cleanup.** The cleanup path
  (`rm -rf` of the session directory) used to run concurrently with an in-flight persist that
  creates temp files and renames them into that same directory. On macOS that surfaces as
  `EINVAL` from `open`/`rename`, which the write helper swallowed into "file not written", so
  the surviving generation silently lost its index files (measured 61/200 in a stress loop,
  0/200 after serializing). `smoke:on-demand-lifecycle` now stress-covers the pattern.
- Host-side index/scan hardening: cache LRU bounds, in-flight de-duplication, promise-based
  load sharing, streamed/size-aware git status, Java/Kotlin dependency lookup without the
  quadratic scan, and non-`ENOENT` filesystem errors are logged instead of silently becoming
  "empty project".
- Client-side robustness: request sequencing and cancellation guards, rollback on failed
  optimistic writes, fetch timeouts, overlay close on the correct mouse-down target, modal
  focus/Esc fixes, debounced note/command saves, and localized group kinds no longer stored
  as data.

### Changed — DSH 0.2.0-rc.2 compatibility

- Peer dependencies now declare a range (`>=0.2.0-rc.1 <0.3.0`) instead of exact seam versions,
  and dev dependencies track `0.2.0-rc.2`.
- `dsh.client.inject` lists **package** names (module-graph/prefetch metadata) as DSH expects,
  while the browser entry keeps its cordis service list in the exported `inject`.
- `smoke:dsh-compat` validates the peer range and the package-name inject list; added
  `smoke:sandbox-sync` for the write-protect reconciliation rules.


### Changed — DSH 0.1.7 compatibility

- Updated the plugin manifest for DSH `0.1.7-rc.2`: removed the legacy `dsh.host` field and pinned all imported DSH seam packages to the exact runtime version required by the new plugin compatibility gate.
- Disabled peer auto-installation in the development workspace so packaging does not bundle duplicate host seam packages; DSH provides those services at runtime.
- Added `smoke:dsh-compat` to verify the modern manifest, exact seam versions, required client services, bundle patch, and Node runtime floor.

### Added — symbol-level code skeletons

- Symbol indexing now stores a compact declaration signature for each matched function, class, interface, type, enum, or component while reusing the existing source read.
- Task capsules show the signature beside each matched symbol, giving the model parameters and type boundaries before it decides whether implementation details are necessary.
- The session-scoped symbol file now acts as an on-demand code skeleton; prompt guidance tells the model to inspect signatures first and read only the relevant location instead of entire files.

### Added — precise test mapping

- The source scan now maps implementation files to tests through direct test imports first, then conservative filename matching such as `service.ts` ↔ `service.test.ts`, `LoginService.java` ↔ `LoginServiceTest.java`, and `module.py` ↔ `test_module.py`.
- Task capsules include only tests covering changed files, matched symbols, endpoint files, or their one-hop dependency neighborhood; unrelated tests remain outside resident context.
- The complete source-to-test map stays in the session-scoped `test-map.md`, and the prompt tells the model to run targeted tests before widening to larger suites.

### Added — minimal dependency neighborhoods

- The existing source scan now resolves deterministic local imports for TS/JS/Vue, Java/Kotlin, and Python relative modules without adding another repository traversal.
- Task capsules include only the direct dependencies and direct dependents of changed files, matched symbols, and matched endpoint files, then place those neighbors into the recommended reading order.
- The complete dependency graph stays in the session-scoped `dependency-index.md`, so the model can expand impact one hop at a time instead of loading or searching an entire module.

### Added — general symbol index

- The existing endpoint scan now also extracts functions, classes, interfaces, types, enums, and common component declarations without a second repository traversal.
- Complete symbol locations are written to each session's on-demand `symbol-index.md`; the resident prompt keeps only one lookup instruction.
- Task capsules promote only symbols matched by the task description into the recommended reading order, reducing blind repository searches without loading a full symbol table into every turn.

### Added — task context capsules

- Task sessions no longer keep the complete file tree resident. A high-signal capsule summarizes project roles, stacks, entry/build manifests, key configuration, test locations, current changes, commands, and matched endpoint locations.
- Capsules derive a recommended reading order from Git changes, endpoint evidence, and entrypoints. The complete file index moves to the session-scoped on-demand file and is queried only when the capsule is insufficient.
- Quick sessions retain the existing directory-loading behavior. A large-project smoke test requires capsule mode to cut resident tokens by at least 45%.

### Fixed — session-scoped on-demand context

- Standards, project commands, and the feature index now use hashed per-session directories instead of shared global text files, preventing concurrent workspaces from overwriting one another.
- Each session writes a manifest describing its workspace and directory scope; normal disposal removes it immediately and stale crash leftovers are reclaimed after 24 hours.
- Context-budget previews use the same isolated path shape as real sessions instead of displaying a potentially unrelated global path.

## [0.8.3] - 2026-09-30

### Added — Monorepo support

- Detects pnpm/npm/yarn/bun workspaces, Turbo, Nx, Lerna, Maven modules, and Gradle multi-project builds, showing the workspace kind and package count in the creation wizard.
- Loads a monorepo root once instead of duplicating nested packages in the directory list, sandbox roots, and Git rules; package boundaries persist with the workspace.
- Injects package names, stacks, and absolute paths into the session prompt and distinguishes root commands from package-level commands.

### Added — TaskMode workflows

- Consolidated feature, API change, bug fix, review, cross-repository refactor, and custom tasks into one registry that drives scope, context preset, required data blocks, endpoint impact, verification, permissions, and final output.
- Task mode is stored only in the session snapshot and never overwrites workspace configuration. Legacy `type` payloads remain compatible and migrate to `taskMode` when parsed.
- Review is read-only everywhere; API change forces the endpoint index and impact review; bugfix, refactor, and feature modes inject reproduction/regression, migration-risk, and delivery rules respectively.

## [0.8.2] - 2026-09-30

### Added — unified diagnostics center

- Added 13 checks covering project directories, sandbox dependency and writable roots, required DSH services, linked sessions and configuration freshness, file/feature index caches, token estimate variance, project commands, large directories, the store file, and version metadata.
- Every check reports OK, warning, error, or unknown and can be rerun; safe one-click repairs refresh caches, resync sandbox roots, and refresh linked sessions.
- Copied diagnostic reports automatically redact local usernames, common API keys, tokens, and authorization values.

### Added — context presets and a global budget gate

- Added Economy, Balanced, Deep analysis, and Custom context strategies. New workspaces default to
  Balanced, while legacy workspaces resolve to Custom without changing their existing behavior.
- A global budget gate now protects the task, directory list, explicit `@` references, and standards
  before trimming file indexes, feature indexes, and AI-generated summaries.
- The context budget dialog shows per-block budgets, resident usage, and every automatic degradation.
  Editing a low-level budget switches the workspace to Custom.

## [0.8.1] - 2026-09-30

### Changed — context-heavy blocks default to on-demand

- Development standards and per-project commands now default to on-demand files in ~/.dsh, with
  only one lookup hint in the session prompt. Set a positive standards budget to inline them again.
- The feature/API index default budget is now 0, so new and existing workspaces keep the endpoint
  lookup file available without keeping the index body resident in every model turn.
- Context statistics count only the resident prompt text; on-demand file bodies no longer inflate the
  standards/commands/code-index token buckets.

### Improved — automatic grouping and smart defaults

- Workspace scans now suggest Backend / Frontend / Reference / Other groups by stack and project
  name; adding a single project to an existing workspace uses the same detection path.
- Node projects derive commands from `packageManager`, lockfiles, and actual package scripts instead
  of assuming pnpm. Java detects Maven/Gradle wrappers, while Go/Python keep conservative defaults.
- Workspaces with 1–4 code projects default to tree loading, with larger scopes falling back to
  summary mode. The wizard shows these defaults and keeps them editable after creation.

## [0.8.0] - 2026-09-30

### Added — task-scope risk check before session creation

- The confirmation step now blocks creation when a selected directory is missing or inaccessible,
  and warns about dirty Git repositories, read-only code projects, empty code scope, missing checks,
  and verification-command gaps.
- Risks are calculated only from the directories and checks selected for this task. Review tasks do
  not treat read-only projects as a problem.
- Healthy scopes show a Ready state; blocked scopes disable the create action before a broken
  session can be started.

### Improved — project-level execution plan on confirmation

- The Start Task confirmation lists each project's role, Git branch and dirty state, plus the
  concrete command used for every selected verification.
- Missing commands are explicitly marked for model discovery, while impact review is shown as a
  manual check so execution gaps are visible before session creation.

### Improved — editable task verification with command coverage

- Step two of Start Task now exposes Run, Test, Build, and Impact review toggles instead of
  hiding the task-type defaults in an uneditable configuration.
- Run/Test/Build show how many selected code projects have the corresponding command configured.
  Missing coverage produces a non-blocking warning while still allowing script discovery.
- The confirmation page and injected prompt use readable verification labels instead of internal
  enum values such as `review-impact`.

### Improved — confidence-aware task scope recommendations

- Start Task narrows the project scope only when an Exact/Normalized endpoint has a complete
  server-client pair. Inferred, one-sided, and legacy-cache matches remain hints and keep every
  enabled project selected, preventing uncertain evidence from excluding a required repository.
- The wizard explains whether it used trusted narrowing, a weak-match safety fallback, or the
  default full scope, and labels recommended projects with their matching `@feature` names.
- Bare feature-name matching now uses token boundaries, so `user` no longer matches `superuser`.

### Added — explainable confidence for the feature/API index

- Each endpoint now carries an Exact / Normalized / Inferred / One-sided confidence level.
  A compact panel badge exposes server/client sources, evidence, index time, and the dynamic
  route caveat on hover.
- The scanner records API-prefix and parameter normalization, composed Spring routes, client
  literals, and named endpoint references. Legacy disk caches remain readable and conservatively
  fall back to inferred confidence when their evidence is unavailable.
- The persistent prompt marks only inferred and one-sided rows, keeping detailed evidence out
  of the token budget and replacing the previous absolute “no false positives” claim.

### Added — task-scoped cross-repository sessions

- The primary action is now a three-step Start task wizard: enter the goal and task type,
  review the recommended directory scope, load mode, and feature-index policy, then create
  a session with that task context. The previous behavior remains available as Quick session.
- Feature, API-change, bug-fix, review, cross-repository refactor, and custom tasks are
  supported. Endpoint or `@feature` matches narrow the recommendation to the linked client
  and server projects plus the primary directory; uncertain matches safely fall back to all
  enabled directories.
- Task settings live in host memory by session ID and never overwrite the saved workspace.
  Review tasks mark their session snapshot read-only and explicitly prohibit file changes in
  the injected prompt.
- A loopback-only `session-task` route accepts task metadata even before `session/created`
  finishes, avoiding a client/host lifecycle race.

### Added — workspace readiness report

- The current-workspace header now exposes a compact Ready / Needs attention / Blocked
  status. Its detail view checks directory validity, detected frontend/backend projects,
  writable roots, Git state, paired endpoints, project commands, context budget, and
  attached sessions in one place.
- A missing primary directory or an empty workspace blocks readiness; budget pressure,
  an empty endpoint index, missing commands, and dirty repositories remain actionable
  non-blocking warnings. The report can re-run its checks and open the context-budget
  view directly.
- Readiness is derived by a platform-independent pure function, with no new host route
  and no writes to project files.

### Added — per-project session list with a one-click refresh

- Clicking a project in the panel expands the sessions that have it loaded (the ones this DSH
  process bound), each with a **Refresh session** button that re-seeds that session's context
  snapshot from the workspace's current config, so the next request already carries the new
  directory list, file index, endpoint index and standards. Sessions this process never loaded are
  not listed — they cannot be refreshed.
- Mode, load-mode and snapshot-restore changes now refresh live sessions too (they were left out of
  the earlier refresh path), and a failed snapshot build is logged instead of leaving the session
  quietly stuck on an empty index.

## [0.7.0] - 2026-09-29

### Added — the new-workspace wizard accepts projects in several rounds

- Step 2 ("Add projects") no longer replaces the previous scan when you pick another folder:
  newly detected projects are appended (deduplicated by path) and checked, so one workspace can be
  assembled from folders that live in different places. Unchecking a row still keeps it out, each
  scan reports what it added, and the pick button turns into "Add another folder" once the list is
  non-empty.

### Fixed — the feature/endpoint index now matches server-side landing points

- The scan walked at most 8 directory levels, but a standard multi-module Java/Go layout
  (`<repo>/<module>/src/main/java/com/<org>/<pkg>/controller/…`) puts controllers at level 9, so
  the whole `controller` tree was pruned: every entry had a front-end call site and none had a
  server one. Depth is now 16, and the read budget went from 800 files / 8 MB to 5000 / 24 MB.
- Route/controller files are read first, so a repository that exceeds the budget still links its
  endpoints instead of spending the budget on whatever the walk happened to reach first.
- `venv`, `site-packages` and Maven `target` are ignored, which removes bogus endpoints extracted
  from installed Python packages.
- Entries that have both sides sort first, then entries with only a front-end call site, so a
  truncating cap cannot drop the pairs or the front-end calls; server-only routes fill the rest.
- The client side is detected per language: backend files matched the crude `.get(` pattern
  everywhere (`map.get(...)`, `list.get(0)`), so a controller's own internal calls were reported as
  the front-end landing point of 315 of 353 "paired" entries. Backend files now need a real HTTP
  client token (`RestTemplate`, `WebClient`, `HttpClient`, `FeignClient`, `requests.get`, `http.Get`, …).

### Changed — the feature/endpoint index can be loaded on demand

- A code index budget of `0` used to mean "no limit", so a hand-edited config could inject the whole
  index (about 29k tokens on a multi-module workspace). `0` now means "do not inject the block at
  all"; the budget field accepts it and the panel list keeps working either way.
- The index is also persisted next to its cache as a grep friendly text file (one endpoint per line,
  `@功能名 → endpoint | 服务端 file:line | 前端 file:line`). When the block is not injected the prompt
  carries a single line pointing at that file, so an endpoint is looked up only when one is needed:
  942 → 579 prompt tokens on this workspace.

### Changed — project changes now reach sessions that are already open

- Adding (or removing) a project directory, or changing the mode, load mode, budgets, code index
  settings or standards, re-selects every live session bound to that workspace, so the next request
  already carries the new directory list, file index, endpoint index and standards. A new session is
  no longer required, and the panel hint no longer claims otherwise.
- Fixed the on-demand mode being impossible to save: the workspace patch route rejected a code index
  budget of `0`, the store clamped it up to `1`, and a stored `0` was dropped on load.

## [0.6.0] - 2026-09-27

### Added — real token usage (provider-reported)

- **"Real usage" block in the context modal** — reads actual provider-reported usage from
  `session/event` (`assistant/message` settlement samples) and shows uncached input, cache read,
  cache write, output, **cache hit rate**, and context occupancy against the model's context window.
- **Plugin share** — the injected blocks' estimated tokens divided by the latest request's prompt
  tokens, so you can see what percentage of each request your own context injection costs.
- **Estimates vs reality side by side** — the existing per-block figures stay as estimates; the new
  block is ground truth. A large gap tells you the estimator needs fixing.

### Added — per-project command handbook

- **`commands` per directory** (`run` / `test` / `build`) — edited inline in a directory card,
  persisted with the directory list (no new file), and injected as its own prompt block
  (`# Per-project commands`) with absolute paths and a 400-token budget.
- **Prefilled from project type** — the workspace wizard and the directory scanner fill in
  `mvn spring-boot:run`, `go run .`, `pnpm dev`, … where the command is certain; commands that
  need extra arguments are left empty rather than injected as something that cannot run.

### Added — deterministic endpoint correlation

- **Per-directory endpoint attribution** — each indexed endpoint now records which directory its
  server side and client side live in.
- **`/api` prefix tolerance** — `/api/user/detail` and `/user/detail` now match, so a proxied
  frontend and a plain backend endpoint join up instead of being indexed twice.
- **Spring class-level prefix composition** — `@RequestMapping("/user")` plus `@GetMapping("/list")`
  is indexed as `/user/list` instead of the bare `/list`.
- **"Endpoints touched by these changes" card** — a deterministic reverse lookup from the git
  working-tree changes (via the file→endpoint map built during the same scan) to the endpoints
  those files declare or call, with the counterpart file on the other side. No AI, no guessing.

### Changed — context accounting

- Per-block token accounting is exact: the fixed-overhead figure is now derived as
  `whole-block render − file index − code index − standards − commands`, so the panel's numbers add
  up to the amount actually injected instead of double-counting the block header.
- New `codeIndexTokens` and `commandsTokens` fields on the context stats, each with its own card.

### Fixed — a new left-column card could be silently clipped

- **The left column now scrolls.** Its cards have a fixed content height (flex: none) while the
  column itself was overflow: hidden, so once the fixed cards exceeded the column height the
  *last* card was clipped with no scrollbar and no error — on a shorter window the feature was
  simply invisible. The column is now overflow-y: auto and the workspace card keeps a 150px floor.
- **The endpoint list moved inside the code-index card** instead of occupying a card of its own,
  so the left column no longer grows by a whole card per new feature.
### Added — advanced config now saves explicitly

- **Save button in the advanced-config dialog.** Workspace mode and file load mode are edited as a
  local draft: nothing is written until Save, Cancel discards both, and Save stays disabled until
  something actually changed. The draft re-syncs when the workspace changes, so opening the dialog
  while the workspace is still loading cannot silently write the default mode.

### Changed — the code-index card pins its header block and footer

- The impact block ("endpoints touched by this change") and the hint line both sit outside the
  card scroll container, so only the endpoint list between them scrolls: both stay visible and the
  card still honours its max-height of 320px. The impact block is capped at 110px and scrolls
  internally only when a change touches so many endpoints that it would otherwise push the footer
  out of the card.

## [0.5.0] - 2026-09-27

### Added — preset coding standards

- **Built-in standards library (7 presets)** — general/team, Java & Spring, Vue 3, React,
  Python, Go, and an API-contract preset. Each is an original bullet-point digest (no verbatim
  copy of any copyrighted style guide).
- **Auto-match by tech stack** — with `autoMatch` on (default), each directory's detected
  `projectType` pulls in the matching preset (java → Java/Spring, vue → Vue 3, go → Go, …);
  any match can be unchecked individually.
- **Per-workspace binding** — `global` presets for the whole workspace plus
  `perDirectory` presets, a per-workspace token budget and an enable switch.
- **Editable and restorable** — built-in text can be edited globally or only for the current
  workspace; "Reset" clears both. Custom standards can be created (global or workspace-scoped),
  edited, deleted, and copied out for sharing.
- **Injected as its own prompt block** — `# Coding standards (scoped, mandatory)` sits
  between the directory list and the file index, grouped by scope (for example
  `Java / Spring (applies to: example-backend)`), with its own token budget (default 800)
  and a truncation notice.
- **Panel entry** — a "Coding standards" card in the left column opens a two-pane modal
  (library + editor) with per-item and total token estimates.

### Added — optional AI drafting

- **"Generate with AI"** in the standards modal drafts a 12–18 bullet standard for the
  selected name/tech stack using the host's default model, then drops it into the editor for
  review. Nothing is generated automatically, and no token is spent unless you click.
- **Shared LLM helper** (`host/llmText.ts`) now backs both the feature summaries and the
  standards draft.
- LLM stream failures — which arrive as a terminal `finish` chunk, not an exception — are
  now detected and surfaced as a readable reason in the UI toast.

### Changed — panel layout

- **Advanced config**, **injected-prompt preview**, and **context budget** each became a
  click-to-open modal (Esc / scrim to close) instead of an inline expanding card; the left
  column is now a stack of compact entry cards.
- **The context budget moved out of the right column** into a left-column "More" entry. The
  resizable splitter that divided "project directories : context budget" was removed, and the
  directory card now uses the full column height.
- Budget compacted further: single-line header, one-line overview, label+value on one line per
  stat card, donut at 44; per-directory usage is a horizontal, scrollable bar list; a
  "Standards" figure was added to the stats.

### Added — Chinese documentation

- `README.zh.md` (a full Chinese README, cross-linked with the English one) and this
  `CHANGELOG.zh.md`; the npm tarball now ships `README.zh.md`.

### Fixed

- Feature-index `summary` mode did not mark truncation; comment/regex source lines could be
  mistaken for endpoints; the §B@@feature` rule was injected even when no index existed.
- `ContextStats.standardsTokens` added so the monitor total matches what is actually injected.

## [0.4.0] - 2026-09-26

### Added — feature/API index and context tuning

- **Feature/API index (new).** The host deterministically extracts HTTP endpoints and links the
  server registration site to the client call site as `file:line`; covers
  TS/JS/TSX/JSX/Vue plus Java/Kotlin/Go/Python/Ruby/C#. Endpoints are normalized
  (`{id}` / `$${id}` / `:id` collapse to one placeholder) and generic property names such as
  value/path/url are filtered out to avoid false joins.
- **Configurable index.** Per-workspace `codeIndexEnabled` / `codeIndexBudget` /
  `codeIndexSummary`, plus a panel card with toggle, budget, summary mode, filter and
  click-to-copy §B@@feature`.
- **§B@@feature` expansion protocol.** The §B@@`-command prompt section gained a rule mapping a
  feature name from the index to the server/client files it lists; the rule is injected only
  when an index actually exists.
- **Optional AI feature summaries.** With `codeIndexSummary=llm`, one summary line per feature
  is generated by signature, in the background (never blocking session creation or the first
  turn), de-duplicated, and silently degraded on failure.
- **Disk persistence.** The index and the summaries persist to
  `~/.dsh/dsh-workspace-combiner-code-index.json` and
  `~/.dsh/dsh-workspace-combiner-feature-summaries.json` (atomic write, 0600, TTL), so
  restarts reuse them instead of rescanning and re-spending tokens.

### Changed — context and token economy

- Summary counts are now **recursive totals** (previously top-level only, which understated the
  real size).
- The file-index budget is now a **per-directory quota with leftover backfill**, so one huge
  directory can no longer starve the code projects that follow it.
- **Low-signal-first truncation** — tests, fixtures, snapshots, lock files and generated
  artifacts are dropped first.
- `tokenBudget` now actually takes effect (it was display-only before).
- The prompt section reuses a **per-session rendered string** instead of rebuilding it on every
  model step.
- Default ignores extended with .pnpm-store / .next / .nuxt / .turbo / .venv / __pycache__ /
  .gradle.

### Changed — performance

- Session creation scans directories **in parallel**; the tree walk descends sibling directories
  with bounded concurrency.
- A lightweight **`/stat`** route replaced full-tree builds for missing-directory detection.
- **`loadModeMaxDepth()`** is the single source of truth for summary/tree/full → 1/3/4, and
  **`/file-index`** accepts `loadMode` so the preview matches the injection depth and shares the
  same cache.
- `FileIndexCache` gained a 30s TTL backstop.

### Changed — panel UI

- Compact context budget card: single-line header, one-line overview, label+value on one line
  per stat card, donut reduced to 44.
- Per-directory usage switched from a **column chart** to a **horizontal scrollable bar list**.
- The feature-index card scrolls inside a fixed height; the budget card's scroll rule moved to
  an explicit class (fixing a broken `:last-child` selector).

### Fixed

- Feature-index summary mode failed to mark truncation; comment/regex source lines were mistaken
  for endpoints; the §B@@feature` rule dangled when no index existed.

### Docs

- Added `README.zh.md` (a Chinese README), cross-linked with the English one.



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
