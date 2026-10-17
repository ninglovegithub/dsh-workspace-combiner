/**
 * 「复制工作空间」摘要 smoke：弹窗要把"到底复制了什么"如实告诉用户。
 *
 * 两个易错点必须钉死：
 *  1. **主目录取自 isPrimary，而不是数组第一项**（拖拽重排后二者可能不同）；
 *  2. 缺省值要按插件语义回落（mode→anchor、loadMode→summary、preset→custom），
 *     否则弹窗会把"未设置"显示成 undefined。
 * @module dsh-workspace-combiner/scripts/duplicate-summary-smoke
 */

import assert from 'node:assert/strict'
import { summarizeDuplicateSource } from '../src/client/panel/duplicateSummary.ts'

// ---- 1) 最小工作空间：全部走缺省值 ----
{
  const summary = summarizeDuplicateSource({
    id: 'w1',
    name: '最小',
    directories: [{ id: 'd1', name: 'main', path: '/work/main' }],
  } as never)
  assert.equal(summary.directoryCount, 1, '目录数量')
  assert.equal(summary.primaryPath, '/work/main', '只有一项时它就是主目录')
  assert.equal(summary.readonlyCount, 0, '默认没有只读目录')
  assert.equal(summary.mode, 'anchor', 'mode 缺省 anchor')
  assert.equal(summary.loadMode, 'summary', 'loadMode 缺省 summary')
  assert.equal(summary.contextPreset, 'custom', 'preset 缺省 custom')
  assert.equal(summary.tokenBudget, undefined, '未设置预算时保持 undefined')
  assert.equal(summary.commandCount, 0, '没有常用命令')
  assert.equal(summary.standardsCount, 0, '没有规范绑定')
  assert.equal(summary.snapshotCount, 0, '没有快照')
}

// ---- 2) 完整工作空间：逐项计数 ----
{
  const summary = summarizeDuplicateSource({
    id: 'w2',
    name: '完整',
    mode: 'single',
    loadMode: 'tree',
    contextPreset: 'deep',
    tokenBudget: 64000,
    directories: [
      { id: 'a', name: 'svc', path: '/work/svc', isPrimary: true, access: 'readwrite', commands: { dev: 'pnpm dev', test: 'pnpm test' } },
      { id: 'b', name: 'docs', path: '/work/docs', access: 'readonly', commands: { build: 'mkdocs build' } },
      { id: 'c', name: 'lib', path: '/work/lib', access: 'readonly' },
    ],
    standards: {
      global: ['base'],
      perDirectory: { '/work/svc': ['java'], '/work/docs': [] },
      workspaceCustom: [{ id: 'x', name: 'x', body: 'b' }],
    },
    snapshots: [{ id: 's1', name: 's1', createdAt: 1, directories: [] }, { id: 's2', name: 's2', createdAt: 2, directories: [] }],
  } as never)
  assert.equal(summary.directoryCount, 3, '三个挂载目录')
  assert.equal(summary.primaryPath, '/work/svc', 'isPrimary 那一项才是主目录')
  assert.equal(summary.readonlyCount, 2, '两个只读目录')
  assert.equal(summary.mode, 'single', 'mode 原样带出')
  assert.equal(summary.loadMode, 'tree', 'loadMode 原样带出')
  assert.equal(summary.contextPreset, 'deep', 'preset 原样带出')
  assert.equal(summary.tokenBudget, 64000, '预算原样带出')
  assert.equal(summary.commandCount, 3, '常用命令跨目录汇总')
  assert.equal(summary.standardsCount, 3, '全局 1 + 逐目录 1 + 自建 1')
  assert.equal(summary.snapshotCount, 2, '快照数量')
}

// ---- 3) 主目录被拖到数组中间：仍按 isPrimary 取 ----
{
  const summary = summarizeDuplicateSource({
    id: 'w3',
    name: '重排',
    directories: [
      { id: 'x', name: 'x', path: '/work/x' },
      { id: 'p', name: 'p', path: '/work/primary', isPrimary: true },
    ],
  } as never)
  assert.equal(summary.primaryPath, '/work/primary', 'isPrimary 优先于数组顺序')
}

// ---- 4) 没有目录：主目录为空串，不抛错 ----
{
  const summary = summarizeDuplicateSource({ id: 'w4', name: '空', directories: [] } as never)
  assert.equal(summary.directoryCount, 0, '零目录')
  assert.equal(summary.primaryPath, '', '没有主目录时为空串')
}

console.log('duplicate summary smoke: 缺省回落 / 逐项计数 / isPrimary 优先 / 空目录 OK')
