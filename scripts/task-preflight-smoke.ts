import assert from 'node:assert/strict'
import { taskPreflight, type SessionTask } from '../src/core/task.ts'
import type { GitStatus, WorkspaceRef } from '../src/core/types.ts'

const directories: WorkspaceRef[] = [
  { id: '/docs', name: 'docs', path: '/docs', access: 'readwrite' },
  { id: '/api', name: 'api', path: '/api', access: 'readwrite', commands: { test: 'pnpm test' } },
  { id: '/web', name: 'web', path: '/web', access: 'readonly', commands: { build: 'pnpm build' } },
]
const clean: GitStatus = { branch: 'main', dirty: 0, untracked: 0, ahead: 0 }
const dirty: GitStatus = { branch: 'main', dirty: 2, untracked: 1, ahead: 0 }
const baseTask: SessionTask = {
  type: 'bugfix', description: 'fix login', directoryPaths: ['/docs', '/api'], loadMode: 'tree', includeCodeIndex: true, verification: ['test'],
}

assert.deepEqual(taskPreflight(baseTask, directories, new Set(), { '/api': clean }), { status: 'ready', issues: [] })

const dirtyResult = taskPreflight(baseTask, directories, new Set(), { '/api': dirty })
assert.equal(dirtyResult.status, 'warning')
assert.equal(dirtyResult.issues[0]?.code, 'dirty-repository')

const readonlyResult = taskPreflight({ ...baseTask, directoryPaths: ['/docs', '/web'], verification: ['build'] }, directories, new Set(), { '/web': clean })
assert.equal(readonlyResult.status, 'warning')
assert.ok(readonlyResult.issues.some(issue => issue.code === 'readonly-directory'))

const blocked = taskPreflight(baseTask, directories, new Set(['/api']), { '/api': clean })
assert.equal(blocked.status, 'blocked')
assert.equal(blocked.issues[0]?.code, 'missing-directory')

const emptyScope = taskPreflight({ ...baseTask, directoryPaths: ['/docs'], verification: [] }, directories, new Set(), {})
assert.equal(emptyScope.status, 'warning')
assert.ok(emptyScope.issues.some(issue => issue.code === 'no-code-project'))
assert.ok(emptyScope.issues.some(issue => issue.code === 'no-verification'))

console.log('task preflight smoke: ready, warning, readonly, blocked paths OK')
