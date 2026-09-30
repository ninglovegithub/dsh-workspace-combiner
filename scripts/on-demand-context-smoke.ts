import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderMultiWorkspacePrompt } from '../src/prompt.ts'
import type { StandardGroup } from '../src/core/standards.ts'
import type { CodeIndexEntry, WorkspaceRef } from '../src/core/types.ts'

const root = await mkdtemp(join(tmpdir(), 'wcb-on-demand-context-'))
process.env.DSH_HOME = root

try {
  const { persistOnDemandContext, standardsTextFile, commandsTextFile } = await import('../src/host/onDemandContext.ts')
  const directories: WorkspaceRef[] = [
    { id: '/docs', name: 'docs', path: '/docs', access: 'readwrite' },
    { id: '/api', name: 'api', path: '/api', access: 'readwrite', commands: { test: 'pnpm test', build: 'pnpm build' } },
  ]
  const standardGroups: StandardGroup[] = [
    { title: 'Java / Spring（适用：api）', body: '- Controller 只接参数\n- Service 写业务逻辑' },
  ]
  const files = await persistOnDemandContext(directories, standardGroups)
  assert.equal(files.standardsPath, standardsTextFile())
  assert.equal(files.commandsPath, commandsTextFile())
  assert.match(await readFile(files.standardsPath!, 'utf8'), /Service 写业务逻辑/)
  assert.match(await readFile(files.commandsPath!, 'utf8'), /pnpm build/)

  const entries: CodeIndexEntry[] = [{ feature: 'login', endpoint: '/api/login', refs: 0, confidence: 'exact', reasons: ['method-and-path'], indexedAt: 1 }]
  const prompt = renderMultiWorkspacePrompt({
    workspaces: directories,
    standardGroups,
    standardsBudget: 0,
    standardsPath: files.standardsPath,
    commandsBudget: 0,
    commandsPath: files.commandsPath,
    codeEntries: entries,
    codeIndexBudget: 0,
    codeIndexPath: join(root, 'code-index.txt'),
  })
  assert.ok(!prompt.includes('# 开发规范（按作用域生效'))
  assert.ok(!prompt.includes('# 各项目常用命令（必须'))
  assert.ok(!prompt.includes('# 功能/接口索引'))
  assert.match(prompt, /开发规范未常驻上下文/)
  assert.match(prompt, /各项目启动\/测试\/构建命令未常驻上下文/)
  assert.match(prompt, /功能\/接口索引.*未常驻上下文/)
  console.log('on-demand context smoke: prompt hints and files OK')
} finally {
  await rm(root, { recursive: true, force: true })
}
