# dsh-workspace-combiner

A [Cordis](https://github.com/cordiverse/cordis) dual-face plugin for DSH (DeepSeek
Harness) that turns a set of repositories into a coordinated **multi-workspace joint
development** context.

The plugin registers a **Workspace Combiner** tab in the left sidebar. Each *workspace*
bundles a primary directory (the "workspace anchor" — where docs and non-code assets
live) plus an ordered list of *code-project* directories (for example a backend repo and
a frontend repo). When you start a new session, the plugin injects the absolute paths of
all active directories into the system prompt and syncs the writable ones into the
[`@chaoset/sandbox-extra-roots`](https://github.com/winliyou/dsh-plugins) whitelist.

To keep that injected context from exploding, the plugin applies a **four-layer
context-control** model:

1. **Directory layer** — per-directory access (`readwrite` / `readonly` / `disabled`),
   primary anchoring, drag ordering.
2. **Config layer** — `anchor` / `single` workspace mode plus optional group tags.
3. **Load-mode layer** — `full` / `summary` / `tree` controlling how much file detail is
   injected.
4. **Command layer** — `@`-command dynamic scope.

Layers 1-4 ship today; see [Changelog](./CHANGELOG.md).

---

## Features

- **Workspaces** — create / rename / delete / switch named workspaces; each owns a
  primary directory plus ordered code-project directories with per-directory access.
- **New-workspace wizard** — pick a name + base path; the host creates the primary folder
  and a scan detects Java / Vue / React / Python / Go projects for multi-select.
- **Three ways to add a directory** — select from native DSH workspaces, open the host
  directory picker, or paste an absolute path.
- **Directory tri-state access** — `readwrite` (sandbox-writable), `readonly` (visible but
  not writable), `disabled` (excluded from the prompt). The primary directory is always
  `readwrite`.
- **Workspace mode** — `anchor` (primary = docs anchor) vs `single` (primary = core
  business code).
- **Directory grouping** — optional group tags (docs / backend / frontend / reference /
  other) rendered as sub-headers.
- **Snapshots** — save / restore / delete a workspace's directory configuration; restore
  re-syncs the sandbox immediately.
- **File index + load modes** — gitignore-aware bounded file-tree scan with an mtime
  cache; a per-workspace load mode controls injected detail.
- **Context monitor** — a panel card with per-directory file counts and an estimated
  token budget, so you can tune the load mode and watch context shrink.
- **@-command dynamic scope** — a prompt section teaches the model to resolve `@`-prefixed
  tokens as explicitly referenced paths across all workspace roots (`@dir/`, `@file`,
  `@"path with spaces"`), pulling files into scope on demand.
- **Sandbox sync** — read-write directories are pushed into
  `sandbox-extra-roots` `extraWritableRoots` (hot reload with a file-write fallback).

---

## Architecture

~~~text
dsh-workspace-combiner/
├── package.json            # dsh field: bundle.patch + client.inject
├── cordis.patch.yml        # registration patch
├── tsconfig.json           # typecheck
├── tsdown.config.ts        # dual-entry build: host + client
└── src/
    ├── invariant.ts        # shared constants (plugin id / API paths / prompt order)
    ├── core/types.ts       # shared types (WorkspaceRef / Workspace / StoreShape / ...)
    ├── prompt.ts           # multi-workspace prompt + file-index rendering
    ├── store.ts            # host persistence (~/.dsh/dsh-workspace-combiner.json)
    ├── sandbox-sync.ts     # sandbox-extra-roots writable-root sync
    ├── routes.ts           # /api/dsh-workspace-combiner routes (loopback-only)
    ├── host/
    │   ├── index.ts        # host entry: prompt section + session/created + routes
    │   ├── projectDetector.ts # scan a directory for project type
    │   ├── fileIndex.ts    # gitignore-aware bounded file-tree scanner + mtime cache
    │   └── contextStats.ts # token estimator + per-directory context stats
    └── client/
        ├── index.ts        # client entry: sidebar icon + main-column panel
        ├── types.ts        # client-local mirrored types
        ├── locales.ts      # zh/en dictionary + tt() helper
        ├── api.ts          # client -> host fetch API
        └── panel/
            ├── WorkspaceCombinerPanel.tsx # panel body + icon
            ├── controller.ts              # state management
            ├── NewWorkspaceWizard.tsx     # create-workspace wizard
            ├── typeBadge.tsx              # project-type badge
            ├── naming.ts                  # name sanitize / dedupe
            └── styles.ts                  # injected <style> (theme-aware)
~~~

### Data flow

~~~text
[client panel] --POST /api/.../...--> [host store]
                                        │
                        session/created (top-level new session)
                                        ▼
                   selectionBySession: sessionId -> { directories, mode, loadMode, fileTrees }
                                        ▼
              systemPrompt.section(text fn renders per session)
                                        ▼
       injects "# Multi-workspace joint development mode active" + directory list + file index
~~~

On directory changes the host also calls `sandbox-extra-roots`
`sandboxExtraRootsConfig.set({ extraWritableRoots })` for hot reload; if the remote is
unavailable it falls back to an atomic write of
`~/.dsh/plugins/sandbox-extra-roots/config.json`.

---

## Install (local directory)

> Prerequisite: DSH is installed and the dependency plugin is present.

~~~bash
# 0) dependency plugin (required)
dsh plugin --profile desktop add @chaoset/sandbox-extra-roots

# 1) build lib/ (host + client)
cd /path/to/dsh-workspace-combiner
pnpm install
pnpm build

# 2) load the plugin
dsh plugin --profile desktop add file:./dsh-workspace-combiner

# 3) verify
dsh plugin --profile desktop ls dsh-workspace-combiner

# 4) restart DSH Desktop (or re-run "dsh web" for the web profile)
~~~

Update after changing source: `pnpm build`, then remove and re-add the plugin.

---

## Usage

1. Open the **Workspace Combiner** tab in the sidebar.
2. Select an existing workspace or create one via the **New workspace** wizard.
3. Add directories (native-workspace pick / directory picker / manual path), set each
   directory's access / group, and set the workspace mode and load mode.
4. Optionally save a snapshot of the directory configuration.
5. Click **New session** — the primary directory is opened and a new session is created;
   the plugin then injects all active directories (with the chosen load mode) into the
   system prompt and syncs the sandbox writable roots.
6. Check the **Context monitor** card to see the file counts and estimated token budget.

> ⚠️ Directory changes only affect **newly created sessions**; already-open sessions are
> not re-loaded.

### Injected prompt (appended to the system prompt)

~~~text
# Multi-workspace joint development mode active
Current session loads[2]project directories:
1.example-anchor[Primary: Workspace anchor (docs/non-code area)]absolute path: /abs/path
[Backend]
2.example-backend[Code project]absolute path: /abs/path

# File index (load mode: summary)
[example-anchor]/abs/path
  12 files / 3 dirs
[example-backend]/abs/path
  210 files / 42 dirs

# @-command dynamic scope
- Tokens prefixed with @ are explicitly referenced paths: @absolute/path or @relative/to-a-workspace-root
- A trailing slash marks a directory: list its tree when its contents matter
- Otherwise it is a file: read it first, never claim inspection before reading
- @"path with spaces" quotes a path containing spaces
- @-referenced files/dirs take priority; paths outside the file index are still readable (sandbox reads are unrestricted)

Development rules:
1. Read/write files and view code must use full absolute paths — no relative paths
2. Different repositories' Git commits are independent and do not interfere
3. On API changes, update backend and frontend request code together
4. Terminal commands must be run with full absolute paths, not relative paths
~~~

---

## Configuration (optional)

No schema; configure via `cordis.patch.yml`:

~~~yaml
workspace-combiner:
  enabled: true          # master switch
  announceToAgent: true  # inject the multi-workspace prompt section
~~~

---

## Design notes / constraints

1. **The session shell has a single, immutable cwd.** The plugin does not try to change
   it; instead the prompt rules force absolute paths.
2. **New sessions only.** On `session/created` the selection is snapshotted and bound to
   that session id; old sessions and child/fork sessions (those with `parentSession`) are
   not injected.
3. **Read model** — reads are already unrestricted in the DSH sandbox; the tri-state
   access only gates *writes* (via `extraWritableRoots`) and *prompt inclusion*.
4. **Dependencies** are declared in `package.json` `dsh.client.inject` and
   `peerDependencies` (`@chaoset/sandbox-extra-roots`, DSH host services).
5. **Aux routes** (loopback-only): `scan`, `file-index`, `context-stats`, plus state /
   workspace CRUD routes.

---

## Development

~~~bash
pnpm install
pnpm typecheck     # tsc --noEmit
pnpm build         # tsdown -> lib/host/index.js + lib/client.js
pnpm watch         # watch rebuild
~~~

- Host logs: `ctx.logger.warn(...)` on sync failures.
- Persistence: `~/.dsh/dsh-workspace-combiner.json`.
- Sandbox config: `~/.dsh/plugins/sandbox-extra-roots/config.json`.

## License

MIT