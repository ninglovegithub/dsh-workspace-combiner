import assert from 'node:assert/strict'
import { parseSessionTask, taskExecutionPlan, taskVerificationCoverage, taskVerificationLabel } from '../src/core/task.ts'
import type { WorkspaceRef } from '../src/core/types.ts'

const directories: WorkspaceRef[] = [
  { id: '/docs', name: 'docs', path: '/docs', access: 'readwrite' },
  { id: '/api', name: 'api', path: '/api', access: 'readwrite', commands: { run: 'pnpm dev', test: 'pnpm test', build: '' } },
  { id: '/web', name: 'web', path: '/web', access: 'readonly', commands: { run: 'pnpm dev', build: 'pnpm build' } },
  { id: '/unused', name: 'unused', path: '/unused', access: 'readwrite', commands: { test: 'pnpm test' } },
]

assert.deepEqual(taskVerificationCoverage('run', ['/docs', '/api', '/web'], directories), { configured: 2, total: 2 })
assert.deepEqual(taskVerificationCoverage('test', ['/docs', '/api', '/web'], directories), { configured: 1, total: 2 })
assert.deepEqual(taskVerificationCoverage('build', ['/docs', '/api', '/web'], directories), { configured: 1, total: 2 })
assert.equal(taskVerificationCoverage('review-impact', ['/docs', '/api'], directories), undefined)
assert.equal(taskVerificationLabel('review-impact'), '变更影响复核')

const executionPlan = taskExecutionPlan({
  taskMode: 'feature', description: 'ship feature', directoryPaths: ['/docs', '/api', '/web'], loadMode: 'tree', includeCodeIndex: true, verification: ['test', 'build', 'review-impact'], contextPreset: 'balanced', endpointImpact: false, allowWrites: true,
}, directories, {
  '/api': { branch: 'main', dirty: 2, untracked: 1, ahead: 0 },
  '/web': { branch: 'feature/ui', dirty: 0, untracked: 0, ahead: 1 },
})
assert.equal(executionPlan.length, 3)
assert.equal(executionPlan[0]?.primary, true)
assert.deepEqual(executionPlan[1]?.checks, [
  { verification: 'test', command: 'pnpm test' },
  { verification: 'build' },
  { verification: 'review-impact' },
])
assert.equal(executionPlan[2]?.access, 'readonly')
assert.equal(executionPlan[2]?.gitStatus?.branch, 'feature/ui')

const parsed = parseSessionTask({
  type: 'bugfix',
  description: 'fix login',
  directoryPaths: ['/docs', '/api'],
  loadMode: 'tree',
  verification: ['test', 'test', 'unknown', 'review-impact'],
})
assert.deepEqual(parsed?.verification, ['test', 'review-impact'])
assert.equal(parsed?.taskMode, 'bugfix')
assert.equal(parsed?.contextPreset, 'balanced')

console.log('task verification smoke: coverage, execution plan, labels, parsing OK')
