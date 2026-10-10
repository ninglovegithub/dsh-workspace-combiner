import assert from 'node:assert/strict'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderMultiWorkspacePrompt } from '../src/prompt.ts'
import type { StandardGroup } from '../src/core/standards.ts'
import type { CodeIndexEntry, DependencyIndexEntry, SymbolIndexEntry, TestIndexEntry, WorkspaceRef } from '../src/core/types.ts'
import type { FileIndexEntry } from '../src/core/fileTree.ts'

const root = await mkdtemp(join(tmpdir(), 'wcb-on-demand-context-'))
process.env.DSH_HOME = root

try {
  const { cleanupOnDemandContext, codeIndexTextFile, commandsTextFile, contextManifestFile, dependencyIndexTextFile, fileIndexTextFile, persistOnDemandContext, standardsTextFile, symbolIndexTextFile, testIndexTextFile } = await import('../src/host/onDemandContext.ts')
  const directories: WorkspaceRef[] = [
    { id: '/docs', name: 'docs', path: '/docs', access: 'readwrite' },
    { id: '/api', name: 'api', path: '/api', access: 'readwrite', commands: { test: 'pnpm test', build: 'pnpm build' } },
  ]
  const standardGroups: StandardGroup[] = [
    { title: 'Java / Spring（适用：api）', body: '- Controller 只接参数\n- Service 写业务逻辑' },
  ]
  const entries: CodeIndexEntry[] = [{ feature: 'login', endpoint: '/api/login', refs: 0, confidence: 'exact', reasons: ['method-and-path'], indexedAt: 1 }]
  const symbols: SymbolIndexEntry[] = [{ name: 'LoginService', kind: 'class', file: 'src/LoginService.ts', line: 3, dir: '/api', exported: true, signature: 'export class LoginService { … }' }]
  const dependencies: DependencyIndexEntry[] = [{ dir: '/api', from: 'src/LoginService.ts', to: 'src/LoginRepository.ts', line: 1 }]
  const tests: TestIndexEntry[] = [{ dir: '/api', source: 'src/LoginService.ts', test: 'src/LoginService.test.ts', reason: 'name' }]
  const fileEntries: FileIndexEntry[] = [{ name: 'api', path: '/api', files: 2, dirs: 1, tree: [{ name: 'src', path: 'src', type: 'dir', children: [{ name: 'server.ts', path: 'src/server.ts', type: 'file' }] }] }]
  const files = await persistOnDemandContext('session-a', 'workspace-a', directories, standardGroups, entries, symbols, dependencies, tests, fileEntries, 'tree')
  assert.equal(files.standardsPath, standardsTextFile('session-a'))
  assert.equal(files.commandsPath, commandsTextFile('session-a'))
  assert.equal(files.codeIndexPath, codeIndexTextFile('session-a'))
  assert.equal(files.fileIndexPath, fileIndexTextFile('session-a'))
  assert.equal(files.symbolIndexPath, symbolIndexTextFile('session-a'))
  assert.equal(files.dependencyIndexPath, dependencyIndexTextFile('session-a'))
  assert.equal(files.testIndexPath, testIndexTextFile('session-a'))
  assert.equal(files.manifestPath, contextManifestFile('session-a'))
  assert.match(await readFile(files.standardsPath!, 'utf8'), /Service 写业务逻辑/)
  assert.match(await readFile(files.commandsPath!, 'utf8'), /pnpm build/)
  assert.match(await readFile(files.codeIndexPath!, 'utf8'), /@login/)
  assert.match(await readFile(files.fileIndexPath!, 'utf8'), /server\.ts/)
  assert.match(await readFile(files.symbolIndexPath!, 'utf8'), /LoginService/)
  assert.match(await readFile(files.symbolIndexPath!, 'utf8'), /export class LoginService \{ … \}/)
  assert.match(await readFile(files.dependencyIndexPath!, 'utf8'), /LoginRepository/)
  assert.match(await readFile(files.testIndexPath!, 'utf8'), /LoginService\.test/)
  assert.match(await readFile(files.manifestPath!, 'utf8'), /workspace-a/)

  const otherDirectories: WorkspaceRef[] = [{ id: '/other', name: 'other', path: '/other', commands: { test: 'go test ./...' } }]
  const other = await persistOnDemandContext('session-b', 'workspace-b', otherDirectories, [], [], [], [], [], [], 'summary')
  assert.notEqual(other.commandsPath, files.commandsPath)
  assert.match(await readFile(other.commandsPath!, 'utf8'), /go test/)
  assert.doesNotMatch(await readFile(files.commandsPath!, 'utf8'), /go test/)

  const prompt = renderMultiWorkspacePrompt({
    workspaces: directories,
    standardGroups,
    standardsBudget: 0,
    standardsPath: files.standardsPath,
    commandsBudget: 0,
    commandsPath: files.commandsPath,
    codeEntries: entries,
    codeIndexBudget: 0,
    codeIndexPath: files.codeIndexPath,
    symbolIndexPath: files.symbolIndexPath,
    dependencyIndexPath: files.dependencyIndexPath,
    testIndexPath: files.testIndexPath,
  })
  assert.ok(!prompt.includes('# 开发规范（按作用域生效'))
  assert.ok(!prompt.includes('# 各项目常用命令（必须'))
  assert.ok(!prompt.includes('# 功能/接口索引'))
  assert.match(prompt, /开发规范未常驻上下文/)
  assert.match(prompt, /各项目启动\/测试\/构建命令未常驻上下文/)
  assert.match(prompt, /功能\/接口索引.*未常驻上下文/)
  assert.match(prompt, /通用符号骨架未常驻上下文/)
  assert.match(prompt, /文件依赖图未常驻上下文/)
  assert.match(prompt, /精准测试映射未常驻上下文/)
  await cleanupOnDemandContext('session-a')
  await assert.rejects(access(files.manifestPath!))
  await access(other.manifestPath!)
  console.log('on-demand context smoke: session isolation, prompt hints and cleanup OK')
} finally {
  await rm(root, { recursive: true, force: true })
}
