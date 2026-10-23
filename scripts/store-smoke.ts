/**
 * 存储 smoke：验证持久化层的四条纪律。
 *
 *   1. 首启（文件不存在）→ 一个默认工作空间，且不视为加载失败。
 *   2. 目录路径规范化 + 去重：`/a/b`、`/a/b/`、`/a/b//` 是同一个目录；主目录
 *      保留用户显式设置的 access，只补默认值。
 *   3. **多进程/多窗口不丢更新**：实例内存快照过期时，落盘前先重读磁盘再应用
 *      本次变更（rebase），两个实例各自新增的工作空间都要在。
 *   4. **损坏文件不覆盖**：读到无法解析的文件时隔离为 `.corrupt-*`，并拒绝写入
 *      ——否则空库会把用户全部工作空间抹掉。
 *
 * 全程使用临时目录，不触碰真实 DSH_HOME。
 * @module dsh-workspace-combiner/scripts/store-smoke
 */

import assert from 'node:assert/strict'
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { WorkspaceCombinerStore } = await import('../src/store.ts')

const dir = await mkdtemp(join(tmpdir(), 'wcb-store-smoke-'))
const file = join(dir, 'dsh-workspace-combiner.json')

// ------------------------------------------------- 1) 首启：默认工作空间
{
  const store = new WorkspaceCombinerStore(file)
  const state = await store.getState()
  assert.equal(store.loadFailed(), false, 'missing file is a normal first run')
  assert.equal(state.workspaces.length, 1, 'first run must materialize one default workspace')
  assert.equal(state.currentWorkspaceId, state.workspaces[0].id)
  console.log('first run default workspace OK')
}

// ------------------------------- 2) 路径规范化 / 去重 / 主目录 access
{
  const store = new WorkspaceCombinerStore(file)
  const ws = await store.createWorkspace('规范', undefined, [
    { id: 'p', name: 'primary', path: '/a/b/' },
    { id: 'dup1', name: 'dup', path: '/a/b' },
    { id: 'dup2', name: 'dup2', path: '/a/b//' },
    { id: 'other', name: 'other', path: '/c', access: 'readonly' },
  ])
  assert.deepEqual(ws.directories.map(d => d.path), ['/a/b', '/c'], 'trailing separators must collapse and duplicates must drop')
  assert.equal(ws.directories[0].isPrimary, true, 'first entry stays primary')
  assert.equal(ws.directories[0].access, 'readwrite', 'primary defaults to readwrite')
  assert.equal(ws.directories[1].access, 'readonly', 'explicit readonly must be preserved')

  const explicit = await store.createWorkspace('显式只读主目录', undefined, [
    { id: 'p2', name: 'primary', path: '/d', access: 'readonly' },
  ])
  assert.equal(explicit.directories[0].access, 'readonly', 'explicit primary access must not be rewritten')
  console.log('path normalization, dedupe and access preservation OK')
}

// --------------------------------- 3) 多进程/多窗口：不丢更新
{
  const shared = join(dir, 'shared.json')
  const first = new WorkspaceCombinerStore(shared)
  await first.getState() // 触发首次加载
  const second = new WorkspaceCombinerStore(shared)
  await second.getState() // 两个实例都只加载了一次内存快照

  await first.createWorkspace('来自进程一')
  // second 的内存快照里没有「来自进程一」；落盘前重读磁盘才能保住它。
  await second.createWorkspace('来自进程二')

  const final = JSON.parse(await readFile(shared, 'utf8')) as { workspaces: Array<{ name: string }> }
  const names = final.workspaces.map(w => w.name)
  assert.ok(names.includes('来自进程一'), 'first process workspace must survive')
  assert.ok(names.includes('来自进程二'), 'second process workspace must survive')
  assert.equal(names.filter(name => name === '来自进程一').length, 1, 'no duplicate after re-reading disk')
  console.log('cross-process lost-update avoidance OK')
}

// --------------------------------------- 4) 损坏文件：隔离 + 拒绝写入
{
  const broken = join(dir, 'broken.json')
  await writeFile(broken, '{ this is not json', 'utf8')
  const store = new WorkspaceCombinerStore(broken)
  await store.getState()
  assert.equal(store.loadFailed(), true, 'unparsable content must be reported as a load failure')

  const siblings = await readdir(dir)
  assert.ok(siblings.some(name => name.startsWith('broken.json.corrupt-')), 'the corrupt file must be quarantined, not deleted')

  let rejected = false
  await store.createWorkspace('不该写进去').catch(() => { rejected = true })
  assert.equal(rejected, true, 'persist must refuse to run after a load failure')

  // 结构可解析但内容退化（workspaces 全非法）同样按损坏处理。
  const degraded = join(dir, 'degraded.json')
  await writeFile(degraded, JSON.stringify({ version: 2, currentWorkspaceId: 'x', workspaces: [{ nope: 1 }] }), 'utf8')
  const degradedStore = new WorkspaceCombinerStore(degraded)
  await degradedStore.getState()
  assert.equal(degradedStore.loadFailed(), true, 'unrecognized structure must not silently become an empty library')
  console.log('corrupt store quarantine and write refusal OK')
}

// ------------------------------------------- 5) 复制工作空间：只改名字
{
  const dupFile = join(dir, 'duplicate.json')
  const store = new WorkspaceCombinerStore(dupFile)
  const source = await store.createWorkspace('源工作空间', '备注保留', [
    { id: 'a', name: 'primary', path: '/work/main' },
    { id: 'b', name: 'svc', path: '/work/svc', access: 'readonly', group: 'backend' },
  ], 'single', 'tree')
  await store.patchMeta(source.id, { tokenBudget: 1234, contextPreset: 'deep' })

  const before = await store.getState()
  const beforeSource = before.workspaces.find(w => w.id === source.id)
  assert.ok(beforeSource !== undefined, 'source must exist before duplication')

  const copy = await store.duplicateWorkspace(source.id, '副本工作空间')
  assert.notEqual(copy.id, source.id, 'the copy must get a fresh id')
  assert.equal(copy.name, '副本工作空间', 'the copy carries the new name')
  assert.equal(copy.remark, source.remark, 'remark is copied')
  assert.equal(copy.mode, source.mode, 'mode is copied')
  assert.equal(copy.loadMode, source.loadMode, 'loadMode is copied')
  assert.equal(copy.tokenBudget, 1234, 'budgets are copied, not reset to the preset default')
  assert.equal(copy.contextPreset, 'deep', 'context preset is copied')
  assert.deepEqual(
    copy.directories.map(d => ({ path: d.path, isPrimary: d.isPrimary, access: d.access, group: d.group })),
    source.directories.map(d => ({ path: d.path, isPrimary: d.isPrimary, access: d.access, group: d.group })),
    'mounted directories must be identical (path, order, primary flag, access, group)',
  )

  const after = await store.getState()
  assert.equal(after.workspaces.length, before.workspaces.length + 1, 'exactly one workspace is added')
  assert.equal(after.currentWorkspaceId, copy.id, 'the copy becomes the current workspace')
  const afterSource = after.workspaces.find(w => w.id === source.id)
  assert.deepEqual(afterSource?.directories, beforeSource.directories, 'the source workspace must stay untouched')
  assert.equal(afterSource?.name, '源工作空间', 'the source keeps its own name')

  // 目录对象必须是深拷贝：改副本不能牵动源工作空间。
  copy.directories[0].access = 'readonly'
  const reloaded = await store.getState()
  assert.equal(
    reloaded.workspaces.find(w => w.id === source.id)?.directories[0]?.access,
    'readwrite',
    'mutating the copy must not leak into the source',
  )

  // 持久化后仍可读回（不是只改了内存）。
  const reopened = new WorkspaceCombinerStore(dupFile)
  const persisted = await reopened.getState()
  assert.ok(persisted.workspaces.some(w => w.id === copy.id), 'the copy must be persisted to disk')

  // 复制时可以传入新的目录列表（路由会为副本新建自己的锚点目录）：
  // 共用的代码项目目录不变，主目录换成新路径。
  const newPrimary = { id: '/work/copy', name: 'copy', path: '/work/copy', isPrimary: true, access: 'readwrite' as const }
  const withAnchor = await store.duplicateWorkspace(source.id, '带新锚点的副本', [newPrimary, ...copy.directories.slice(1)])
  assert.equal(withAnchor.directories[0].path, '/work/copy', '传入的新主目录生效')
  assert.equal(withAnchor.directories[0].isPrimary, true, '新主目录标记为主目录')
  assert.deepEqual(
    withAnchor.directories.slice(1).map(d => d.path),
    source.directories.slice(1).map(d => d.path),
    '其余挂载目录与原工作空间共用（路径不变）',
  )
  assert.equal(
    (await store.getState()).workspaces.find(w => w.id === source.id)?.directories[0]?.path,
    '/work/main',
    '传入新目录也不能改动源工作空间',
  )

  // 源不存在时必须报错，而不是悄悄建一个空工作空间。
  let missingRejected = false
  await store.duplicateWorkspace('no-such-id', 'x').catch(() => { missingRejected = true })
  assert.equal(missingRejected, true, 'duplicating an unknown workspace must fail loudly')
  console.log('duplicate workspace: new id/name, identical directories, copied config, source untouched OK')
}

console.log('store smoke: first run, normalization, cross-process merge and corruption safety OK')
