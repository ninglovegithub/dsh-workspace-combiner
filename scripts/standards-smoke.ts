/**
 * 开发规范 smoke：新增的「会话锚点边界」必须默认启用，且用户能关掉。
 *
 * 三个易错点：
 *  1. 默认绑定必须是**每次新建对象**，否则多个工作空间会共享同一个可变数组；
 *  2. 关掉之后（`global: []`）不能再被自动匹配加回来；
 *  3. 复制工作空间要连规范绑定一起带走。
 * @module dsh-workspace-combiner/scripts/standards-smoke
 */

import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BUILTIN_STANDARDS, DEFAULT_STANDARD_BUDGET, DEFAULT_STANDARD_IDS, defaultWorkspaceStandards, emptyLibrary, resolveStandardGroups } from '../src/core/standards.ts'
import { renderStandards } from '../src/prompt.ts'
import { WorkspaceCombinerStore } from '../src/store.ts'

// ---- 1) 内置规范里有这条，且正文写清了双向边界 ----
{
  const preset = BUILTIN_STANDARDS.find(p => p.id === 'anchor-boundary')
  assert.ok(preset !== undefined, 'anchor-boundary must be a builtin preset')
  assert.equal(preset.name, '会话锚点边界', '展示名')
  assert.ok(preset.body.includes('会话锚点'), '正文要定义锚点是什么')
  assert.ok(preset.body.includes('非代码类文件'), '正文要写明锚点只读写非代码类文件')
  assert.ok(preset.body.includes('代码项目目录'), '正文要指明代码只读写代码项目目录')
  assert.ok(preset.body.includes('一律保存到会话锚点'), '正文要写明插件会话的产出一律落锚点')
  assert.equal(preset.matchTypes, undefined, '它不按项目类型自动匹配，只能由用户/默认值启用')
  assert.ok(DEFAULT_STANDARD_IDS.includes('anchor-boundary'), '默认启用的就是这条')
}

// ---- 2) 默认绑定：内容正确且互不共享 ----
{
  const first = defaultWorkspaceStandards()
  const second = defaultWorkspaceStandards()
  assert.deepEqual(first, { global: ['anchor-boundary'], budget: DEFAULT_STANDARD_BUDGET }, '默认绑定只含这条规范且带预算')
  assert.ok(DEFAULT_STANDARD_BUDGET > 0, '预算必须 > 0：0 表示规范不常驻上下文，等于没启用')
  assert.notEqual(first.global, second.global, '两次调用不能共享同一个数组')
  first.global?.push('general')
  assert.deepEqual(second.global, ['anchor-boundary'], '改一份不能影响另一份')
}

// ---- 3) 有效规范分组：启用时出现在全局组，关闭时彻底消失 ----
{
  const on = resolveStandardGroups({ global: ['anchor-boundary'] }, [], emptyLibrary())
  assert.equal(on.length, 1, '启用后解析出一组全局规范')
  assert.ok(on[0].title.includes('会话锚点边界'), '组标题带规范名')
  assert.ok(on[0].body.includes('非代码类文件'), '正文原样注入')

  // 关键：默认预算下必须**真的**渲染出正文（预算 0 时 renderStandards 会返回空串）。
  const rendered = renderStandards(on, defaultWorkspaceStandards().budget)
  assert.ok(rendered.includes('非代码类文件'), '默认预算下规范正文必须真的进入提示词')
  assert.ok(rendered.includes('会话锚点'), '渲染结果包含锚点定义')
  assert.ok(!rendered.includes('被截断'), '800 token 的默认预算足够放下这条规范，不应被截断')

  const off = resolveStandardGroups({ global: [] }, [], emptyLibrary())
  assert.deepEqual(off, [], '用户关掉之后不应注入任何规范')

  // 目录级自动匹配不该把它加回来（它没有 matchTypes）。
  const dirs = [{ id: 'p', name: 'svc', path: '/work/svc', projectType: 'java' as const }]
  const matched = resolveStandardGroups({ global: [] }, dirs, emptyLibrary())
  assert.equal(matched.length, 1, '只有按项目类型匹配到的 java 规范')
  assert.ok(!matched[0].title.includes('会话锚点边界'), '关掉的规范不能被自动匹配复活')
}

// ---- 4) 新建工作空间默认带上；复制工作空间一起带走 ----
{
  const dir = await mkdtemp(join(tmpdir(), 'wcb-standards-'))
  const file = join(dir, 'store.json')
  const store = new WorkspaceCombinerStore(file)

  const initial = await store.getState()
  assert.deepEqual(initial.workspaces[0].standards, { global: ['anchor-boundary'], budget: DEFAULT_STANDARD_BUDGET }, '首启的默认工作空间也默认启用')

  const created = await store.createWorkspace('新空间', undefined, [{ id: 'p', name: 'main', path: '/work/main' }])
  assert.deepEqual(created.standards, { global: ['anchor-boundary'], budget: DEFAULT_STANDARD_BUDGET }, '新建工作空间默认启用')

  const copy = await store.duplicateWorkspace(created.id, '新空间 副本')
  assert.deepEqual(copy.standards, { global: ['anchor-boundary'], budget: DEFAULT_STANDARD_BUDGET }, '复制工作空间要带走规范绑定')

  // 落盘再读回：默认值必须能持久化（否则重启后又变回"未启用"）。
  const reopened = new WorkspaceCombinerStore(file)
  const persisted = await reopened.getState()
  assert.deepEqual(persisted.workspaces.find(w => w.id === created.id)?.standards, { global: ['anchor-boundary'], budget: DEFAULT_STANDARD_BUDGET }, '默认规范要能持久化')
}

console.log('standards smoke: 锚点边界默认启用 / 可关闭 / 不复活 / 可持久化 / 复制带走 OK')
