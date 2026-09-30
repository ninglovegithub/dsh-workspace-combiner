import assert from 'node:assert/strict'
import { parseSessionTask, taskVerificationCoverage, taskVerificationLabel } from '../src/core/task.ts'
import type { WorkspaceRef } from '../src/core/types.ts'

const directories: WorkspaceRef[] = [
  { id: '/docs', name: 'docs', path: '/docs', access: 'readwrite' },
  { id: '/api', name: 'api', path: '/api', access: 'readwrite', commands: { run: 'pnpm dev', test: 'pnpm test', build: '' } },
  { id: '/web', name: 'web', path: '/web', access: 'readwrite', commands: { run: 'pnpm dev', build: 'pnpm build' } },
  { id: '/unused', name: 'unused', path: '/unused', access: 'readwrite', commands: { test: 'pnpm test' } },
]

assert.deepEqual(taskVerificationCoverage('run', ['/docs', '/api', '/web'], directories), { configured: 2, total: 2 })
assert.deepEqual(taskVerificationCoverage('test', ['/docs', '/api', '/web'], directories), { configured: 1, total: 2 })
assert.deepEqual(taskVerificationCoverage('build', ['/docs', '/api', '/web'], directories), { configured: 1, total: 2 })
assert.equal(taskVerificationCoverage('review-impact', ['/docs', '/api'], directories), undefined)
assert.equal(taskVerificationLabel('review-impact'), '变更影响复核')

const parsed = parseSessionTask({
  type: 'bugfix',
  description: 'fix login',
  directoryPaths: ['/docs', '/api'],
  loadMode: 'tree',
  verification: ['test', 'test', 'unknown', 'review-impact'],
})
assert.deepEqual(parsed?.verification, ['test', 'review-impact'])

console.log('task verification smoke: coverage, labels, parsing OK')
