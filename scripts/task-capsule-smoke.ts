import assert from 'node:assert/strict'
import { estimateTokens, type FileIndexEntry } from '../src/core/fileTree.ts'
import { buildTaskContextCapsule } from '../src/core/taskCapsule.ts'
import type { SessionTask } from '../src/core/task.ts'
import type { CodeIndexEntry, DependencyIndexEntry, SymbolIndexEntry, TestIndexEntry, WorkspaceRef } from '../src/core/types.ts'
import { renderMultiWorkspacePrompt } from '../src/prompt.ts'

const directories: WorkspaceRef[] = [
  { id: '/docs', name: 'docs', path: '/docs', access: 'readwrite' },
  { id: '/server', name: 'server', path: '/server', access: 'readwrite', projectType: 'java', group: '后端', commands: { test: 'mvn test', build: 'mvn package' } },
  { id: '/client', name: 'client', path: '/client', access: 'readwrite', projectType: 'frontend-react', group: '前端', commands: { test: 'pnpm test', build: 'pnpm build' } },
]
const task: SessionTask = {
  taskMode: 'api-change', description: '修改 @login 登录接口契约', directoryPaths: directories.map(directory => directory.path),
  loadMode: 'tree', includeCodeIndex: true, verification: ['test', 'build', 'review-impact'], contextPreset: 'deep', endpointImpact: true, allowWrites: true,
}
const entries: FileIndexEntry[] = [
  { name: 'docs', path: '/docs', files: 1, dirs: 0, tree: [{ name: 'README.md', path: 'README.md', type: 'file' }] },
  { name: 'server', path: '/server', files: 200, dirs: 20, tree: [
    { name: 'pom.xml', path: 'pom.xml', type: 'file' },
    { name: 'src', path: 'src', type: 'dir', children: [
      { name: 'main', path: 'src/main', type: 'dir', children: [{ name: 'LoginApplication.java', path: 'src/main/LoginApplication.java', type: 'file' }] },
      { name: 'test', path: 'src/test', type: 'dir', children: [{ name: 'LoginTest.java', path: 'src/test/LoginTest.java', type: 'file' }] },
    ] },
    ...Array.from({ length: 300 }, (_, index) => ({ name: `Service${index}.java`, path: `src/service/Service${index}.java`, type: 'file' as const })),
  ] },
  { name: 'client', path: '/client', files: 160, dirs: 18, tree: [
    { name: 'package.json', path: 'package.json', type: 'file' },
    { name: 'src', path: 'src', type: 'dir', children: [{ name: 'main.tsx', path: 'src/main.tsx', type: 'file' }, { name: 'login.ts', path: 'src/api/login.ts', type: 'file' }] },
    ...Array.from({ length: 300 }, (_, index) => ({ name: `Component${index}.tsx`, path: `src/components/Component${index}.tsx`, type: 'file' as const })),
  ] },
]
const codeEntries: CodeIndexEntry[] = [{
  feature: 'login', endpoint: '/api/login', refs: 2, confidence: 'exact', reasons: ['method-and-path'], indexedAt: 1,
  server: { file: 'src/main/LoginController.java', line: 20 }, serverDir: '/server',
  client: { file: 'src/api/login.ts', line: 8 }, clientDir: '/client',
}]
const symbols: SymbolIndexEntry[] = [{ name: 'LoginService', kind: 'class', file: 'src/main/LoginService.java', line: 12, dir: '/server', exported: true, signature: 'public class LoginService { … }' }]
const dependencies: DependencyIndexEntry[] = [
  { dir: '/server', from: 'src/main/LoginService.java', to: 'src/main/LoginRepository.java', line: 3 },
  { dir: '/server', from: 'src/main/LoginController.java', to: 'src/main/LoginService.java', line: 4 },
  { dir: '/server', from: 'src/main/UnrelatedService.java', to: 'src/main/UnrelatedRepository.java', line: 2 },
]
const tests: TestIndexEntry[] = [
  { dir: '/server', source: 'src/main/LoginService.java', test: 'src/test/LoginServiceTest.java', reason: 'name' },
  { dir: '/server', source: 'src/main/UnrelatedService.java', test: 'src/test/UnrelatedServiceTest.java', reason: 'name' },
]
const capsule = buildTaskContextCapsule(task, directories, entries, codeEntries, symbols, dependencies, tests, {
  '/server': ['src/main/LoginController.java'],
  '/client': ['src/api/login.ts'],
})
assert.match(capsule.projects.find(project => project.path === '/server')?.entrypoints.join('\n') ?? '', /LoginApplication\.java/)
assert.deepEqual(capsule.projects.find(project => project.path === '/server')?.testRoots, ['src/test'])
assert.match(capsule.endpoints[0]?.server ?? '', /LoginController\.java:20/)
assert.match(capsule.symbols[0]?.location ?? '', /LoginService\.java:12/)
assert.ok(capsule.dependencies.some(dependency => dependency.to.endsWith('/LoginRepository.java')))
assert.ok(!capsule.dependencies.some(dependency => dependency.to.includes('UnrelatedRepository')))
assert.ok(capsule.tests.some(entry => entry.test.endsWith('/LoginServiceTest.java')))
assert.ok(!capsule.tests.some(entry => entry.test.includes('UnrelatedServiceTest')))
assert.equal(capsule.readingOrder[0], '/server/src/main/LoginController.java')

const oldPrompt = renderMultiWorkspacePrompt({ workspaces: directories, loadMode: 'tree', entries, fileIndexBudget: 20000, task })
const capsulePrompt = renderMultiWorkspacePrompt({ workspaces: directories, loadMode: 'tree', entries, fileIndexBudget: 20000, task, taskCapsule: capsule, fileIndexPath: '/context/file-index.md', symbolIndexPath: '/context/symbol-index.md', dependencyIndexPath: '/context/dependency-index.md', testIndexPath: '/context/test-map.md' })
assert.match(capsulePrompt, /# 任务上下文胶囊/)
assert.match(capsulePrompt, /public class LoginService \{ … \}/)
assert.match(capsulePrompt, /建议读取顺序/)
assert.match(capsulePrompt, /完整文件索引未常驻上下文/)
assert.match(capsulePrompt, /相关代码骨架/)
assert.match(capsulePrompt, /最小依赖邻域/)
assert.doesNotMatch(capsulePrompt, /UnrelatedRepository/)
assert.match(capsulePrompt, /精准验证入口/)
assert.doesNotMatch(capsulePrompt, /UnrelatedServiceTest/)
assert.ok(!capsulePrompt.includes('Component79.tsx'))
assert.ok(estimateTokens(capsulePrompt) < estimateTokens(oldPrompt) * 0.55)

console.log('task capsule smoke: evidence, reading order and token reduction OK')
