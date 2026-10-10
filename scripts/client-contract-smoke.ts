/**
 * 客户端契约 smoke：对着 **0.2.0-rc.2 的真实签名**验证面板动作。
 *
 * 背景：浏览器半面曾一度被改写成一套并不存在的 API（`sessions.list()` 当方法、
 * `sessions.create(id, opts)` 当同步返回 live session、`session.append()`、
 * `workspaces.create(path)`）。它不会抛错崩溃——全都包在 try/catch 里——只会静默
 * 失效（新建会话落到错误目录、无法命名、会话数恒为 0），所以必须由测试守住。
 *
 * 这里加载**构建产物** `lib/client.js`（`__ModuleLoader__` 工厂形态），用忠实复刻
 * 官方 `ClientSessions` / `WorkspaceController` 的桩调用并断言调用参数。
 * 运行前需要先构建：`pnpm build`。
 * @module dsh-workspace-combiner/scripts/client-contract-smoke
 */

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { access } from 'node:fs/promises'

const require = createRequire(import.meta.url)
const bundleUrl = new URL('../lib/client.js', import.meta.url)

try {
  await access(bundleUrl)
} catch {
  console.error('client-contract smoke: lib/client.js missing — run `pnpm build` first')
  process.exit(1)
}

// ---- 1) 用 __ModuleLoader__ 形态加载构建产物 ----
let captured
globalThis.window = { __ModuleLoader__: { load: (definition) => { captured = definition } } }
await import(bundleUrl.href)
assert.ok(captured, 'client bundle must register itself through window.__ModuleLoader__.load')
assert.equal(captured.id, 'dsh-workspace-combiner')

const mod = captured.factory(require)
assert.equal(typeof mod.apply, 'function', 'client bundle must export apply')
// uiWorkspace 必须在 inject 里：cordis 对未注入的服务做属性访问会抛错，
// 不在 inject 里就只能靠可选链吞掉异常 → 会话建了但界面不跳（真实踩过的坑）。
assert.deepEqual(mod.inject, ['slots', 'locale', 'sessions', 'workspaces', 'remote', 'remote.directoryPicker'])
// uiWorkspace 故意不进 inject：它只用于"建完跳转"。若写进 inject，一旦 ui-workspace
// pending，我们的面板会跟着整个不激活。改用不抛错的 ctx.get() 按需读取。
assert.ok(!mod.inject.includes('uiWorkspace'), 'uiWorkspace must stay out of inject (panel must not depend on it activating)')
assert.equal(typeof mod.createPanelActions, 'function', 'client entry must export createPanelActions for contract testing')

// ---- 2) 忠实复刻 0.2.0-rc.2 的客户端服务 ----
const calls = { create: [], workspaceCreate: [], rename: [], pick: 0, open: [] }

/** @deepseek-ai/dsh-api-session-controller@0.2.0-rc.2 的 ClientSessions 形状。 */
class StubSessions {
  constructor() {
    this.titles = { 's-1': '既有会话' }
    this.list = {
      // readonly list: SnapshotStore —— 是对象，不是方法
      getSnapshot: () => ({ ids: Object.keys(this.titles), byId: Object.fromEntries(Object.entries(this.titles).map(([id, title]) => [id, { id, title }])), phase: 'ready', projectionsBySession: {} }),
    }
  }
  // create(opts?: { workspaceId?, cwd?, sessionId? }): Promise<SessionId>
  async create(opts = {}) {
    calls.create.push(opts)
    return 's-new'
  }
  // binding(id): { session: SessionFace } | undefined —— SessionFace 只有 rename/sessionId
  binding(id) {
    return { session: { sessionId: id, async rename(title) { calls.rename.push({ id, title }); return { ok: true, value: { title } } } } }
  }
  // 故意不提供 open/get/list()：插件若还调用它们，本测试会直接失败。
}

/** @deepseek-ai/dsh-api-workspace-controller@0.2.0-rc.2 的 WorkspaceController 形状。 */
class StubWorkspaces {
  // create(input: { path: string }): Promise<WorkspaceView>
  async create(input) {
    assert.equal(typeof input, 'object', 'workspaces.create must receive an object, not a bare path string')
    assert.equal(typeof input.path, 'string', 'workspaces.create input must carry { path }')
    calls.workspaceCreate.push(input)
    return { workspaceId: 'ws-1', path: input.path, title: 'main', sessionIds: [], createdAt: '', updatedAt: '' }
  }
}

const registered = []
const ctx = {
  effect: (callback) => { const dispose = callback(); return typeof dispose === 'function' ? dispose : () => {} },
  // dsh-client-locale 的真实服务同时提供 register 与 bind（bind 返回稳定的 t）。
  locale: { register: () => () => {}, bind: () => (key) => key },
  slots: {
    inject: (name, factory) => { factory(); return () => {} },
    register: (declaration, component) => { registered.push({ declaration, component }); return () => {} },
  },
  sessions: new StubSessions(),
  workspaces: new StubWorkspaces(),
  remote: { directoryPicker: { pick: async () => { calls.pick++; return { ok: true, value: '/tmp/picked' } } } },
  // dsh-client-ui-workspace 提供的 uiWorkspace：0.2.0-rc.2 的 ClientSessions 没有
  // open()，新建会话后必须靠它切换主视图，否则用户看到的是"点了没反应"。
  // 必须通过 ctx.get 暴露——cordis 对未注入服务的属性访问会抛错。
  navigation: { openSession: (id) => { calls.open.push(id) } },
  get(name) { return name === 'uiWorkspace' ? this.navigation : undefined },
}

// ---- 3) apply 仍能挂载 ----
mod.apply(ctx)
assert.deepEqual(registered.map(r => r.declaration.name), ['sidebar.panellist', 'main'], 'both slots must be registered')

// ---- 4) 逐条验证动作打到正确的 API ----
const actions = mod.createPanelActions(ctx)

const newId = await actions.startSession('/work/proj', '我的会话')
assert.equal(newId, 's-new', 'startSession must return the session id from sessions.create')
assert.deepEqual(calls.workspaceCreate, [{ path: '/work/proj' }], 'workspace must be created with { path }')
// 宿主硬校验 workspaceId 与 cwd 不能同时出现；只传 workspaceId 才会 attachSession，
// 会话才会出现在左侧栏的工作空间分组里（workspace.path 即 cwd）。
assert.deepEqual(calls.create, [{ workspaceId: 'ws-1' }], 'sessions.create must receive { workspaceId } only')
assert.deepEqual(calls.rename, [{ id: 's-new', title: '我的会话' }], 'title must be applied through binding().session.rename')
assert.deepEqual(calls.open, ['s-new'], 'the new session must be revealed through uiWorkspace.openSession')

// 标题去重：与既有标题冲突时追加序号
await actions.startSession('/work/proj', '既有会话')
assert.equal(calls.rename.at(-1).title, '既有会话 (2)', 'duplicate titles must be suffixed')

// 会话数与标题读取走 list 快照
assert.equal(actions.sessionCount(), 1, 'sessionCount must read the list snapshot')
assert.equal(actions.sessionTitle('s-1'), '既有会话', 'sessionTitle must read the list snapshot')
assert.equal(actions.sessionTitle('missing'), '', 'unknown session falls back to an empty title')

// 面板动作面：openSession 必须存在且直达 uiWorkspace
assert.equal(typeof actions.openSession, 'function', 'PanelActions must expose openSession')
actions.openSession('s-1')
assert.equal(calls.open.at(-1), 's-1', 'PanelActions.openSession must reach uiWorkspace.openSession')

// 目录选择与 DSH 工作区注册
assert.equal(await actions.pickDirectory(), '/tmp/picked')
assert.equal(calls.pick, 1)
await actions.registerDshWorkspace('/work/other')
assert.deepEqual(calls.workspaceCreate.at(-1), { path: '/work/other' })

// ---- 5) 无标题时不应触发改名 ----
const renameCount = calls.rename.length
await actions.startSession('/work/proj')
assert.equal(calls.rename.length, renameCount, 'no title means no rename call')

// ---- 6) uiWorkspace 必须调用时才解析，且缺失时不能抛 ----
{
  const stale = []
  const live = []
  const swapCtx = {
    ...ctx,
    navigation: { openSession: (id) => { stale.push(id) } },
    get(name) { return name === 'uiWorkspace' ? this.navigation : undefined },
  }
  const swapActions = mod.createPanelActions(swapCtx)
  // 模拟服务在本插件之后才被替换/重新提供
  swapCtx.navigation = { openSession: (id) => { live.push(id) } }
  await swapActions.startSession('/work/swap')
  assert.deepEqual(live, ['s-new'], 'openSession must read the service at call time')
  assert.deepEqual(stale, [], 'the previously captured service must not be used')

  // 服务整体不可用时：会话照样创建，且不能抛（面板必须活着）
  const bareCtx = { ...ctx, get: () => undefined, sessions: new StubSessions(), workspaces: new StubWorkspaces() }
  const bareActions = mod.createPanelActions(bareCtx)
  const bareId = await bareActions.startSession('/work/bare')
  assert.equal(bareId, 's-new', 'a missing navigation service must not break session creation')
}

console.log('client contract smoke: sessions.list snapshot, create({workspaceId}), binding().rename, openSession and workspaces.create({path}) OK')
