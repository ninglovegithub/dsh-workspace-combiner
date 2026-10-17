/**
 * 规范 token 显示 smoke：「按需」时不能显示 0。
 *
 * 之前卡片头用的是 `standardsTokens`（已按预算截断的实际注入量），按需模式下它是 0，
 * 于是界面显示「~0 t」——规范明明有一堆内容。现在多一个 `standardsContentTokens`
 * （完整正文，不看预算），按需时用它显示"规范有多大"。
 * @module dsh-workspace-combiner/scripts/standards-tokens-smoke
 */

import assert from 'node:assert/strict'
import { emptyLibrary, resolveStandardGroups } from '../src/core/standards.ts'
import { FileIndexCache } from '../src/host/fileIndex.ts'
import { computeContextStats } from '../src/host/contextStats.ts'
import { estimateTokens } from '../src/core/fileTree.ts'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderStandards, renderStandardsText } from '../src/prompt.ts'

// 至少要有一个可统计的目录：renderMultiWorkspacePromptDetailed 在「没有任何活动目录」时
// 会直接返回并把各区块预算清零，那样测不出"常驻"路径。
const dir = await mkdtemp(join(tmpdir(), 'wcb-std-tokens-'))
await writeFile(join(dir, 'a.ts'), 'export const a = 1\n', 'utf8')
const directories = [{ id: dir, name: 'demo', path: dir }]

const groups = resolveStandardGroups({ global: ['anchor-boundary'] }, [], emptyLibrary())
const content = estimateTokens(renderStandardsText(groups))
assert.ok(content > 0, '规范正文本身必须有内容')

// ---- 按需（预算 0）：注入量为 0，但"规范有多大"必须仍然报真实值 ----
{
  const stats = await computeContextStats({
    directories,
    mode: 'anchor',
    loadMode: 'summary',
    fileIndexCache: new FileIndexCache(),
    standardGroups: groups,
    standardsBudget: 0,
  })
  assert.equal(stats.standardsTokens, 0, '按需 = 不注入，注入量就是 0')
  assert.equal(stats.standardsContentTokens, content, '按需时仍要报完整正文的 token 数（界面用它显示）')
  assert.equal(renderStandards(groups, 0), '', '预算 0 时渲染结果为空（与注入量一致）')
}

// ---- 常驻且预算充足：注入量 = 完整正文 ----
{
  const stats = await computeContextStats({
    directories,
    mode: 'anchor',
    loadMode: 'summary',
    fileIndexCache: new FileIndexCache(),
    standardGroups: groups,
    standardsBudget: 800,
  })
  assert.ok(stats.standardsTokens > 0, '常驻时注入量必须 > 0')
  assert.ok(stats.standardsTokens <= 800, '注入量不超过预算')
  assert.equal(stats.standardsContentTokens, content, '完整正文大小不受预算影响')
}

// ---- 预算极小：注入被截断，完整正文大小不变 ----
{
  const stats = await computeContextStats({
    directories,
    mode: 'anchor',
    loadMode: 'summary',
    fileIndexCache: new FileIndexCache(),
    standardGroups: groups,
    standardsBudget: 120,
  })
  assert.ok(stats.standardsTokens < content, '预算很小时注入量必须被截断')
  assert.equal(stats.standardsContentTokens, content, '完整正文大小不变')
  // 注意：区块内的截断不会记 ContextDegradation（那是全局预算闸的产物），
  // 只在正文尾部加一行提示，所以这里断言渲染结果。
  assert.ok(renderStandards(groups, 120).includes('被截断'), '区块内截断要在正文尾部给出提示')
}

// ---- 没有规范：两者都是 0（界面据此隐藏标签） ----
{
  const stats = await computeContextStats({
    directories,
    mode: 'anchor',
    loadMode: 'summary',
    fileIndexCache: new FileIndexCache(),
    standardGroups: [],
    standardsBudget: 800,
  })
  assert.equal(stats.standardsTokens, 0, '没有规范时注入量 0')
  assert.equal(stats.standardsContentTokens, 0, '没有规范时完整正文也是 0')
}

console.log('standards tokens smoke: 按需报完整正文 / 常驻报实际注入 / 截断受限 / 空规范为 0 OK')
