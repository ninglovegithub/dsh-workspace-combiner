import assert from 'node:assert/strict'
import { recommendTask } from '../src/core/task.ts'
import type { CodeIndexEntry, WorkspaceRef } from '../src/core/types.ts'

const directories: WorkspaceRef[] = [
  { id: '/docs', name: 'docs', path: '/docs', access: 'readwrite' },
  { id: '/server', name: 'server', path: '/server', access: 'readwrite' },
  { id: '/client', name: 'client', path: '/client', access: 'readwrite' },
  { id: '/extra', name: 'extra', path: '/extra', access: 'readwrite' },
]

const entries: CodeIndexEntry[] = [
  {
    feature: 'login', endpoint: '/auth/login', refs: 0, confidence: 'exact',
    server: { file: 'routes.ts', line: 1 }, client: { file: 'api.ts', line: 1 },
    serverDir: '/server', clientDir: '/client',
  },
  {
    feature: 'billing', endpoint: '/billing/pay', refs: 0, confidence: 'heuristic',
    server: { file: 'billing.ts', line: 1 }, client: { file: 'billingApi.ts', line: 1 },
    serverDir: '/server', clientDir: '/client',
  },
  {
    feature: 'audit', endpoint: '/audit/logs', refs: 0, confidence: 'unpaired',
    server: { file: 'audit.ts', line: 1 }, serverDir: '/server',
  },
  {
    feature: 'user', endpoint: '/users', refs: 0, confidence: 'normalized',
    server: { file: 'users.ts', line: 1 }, client: { file: 'usersApi.ts', line: 1 },
    serverDir: '/server', clientDir: '/client',
  },
]

const trusted = recommendTask('bugfix', 'fix @login timeout', directories, entries)
assert.equal(trusted.mode, 'trusted-match')
assert.deepEqual(trusted.task.directoryPaths, ['/docs', '/server', '/client'])
assert.deepEqual(trusted.directoryFeatures['/server'], ['login'])

const heuristic = recommendTask('bugfix', 'fix @billing rounding', directories, entries)
assert.equal(heuristic.mode, 'weak-match')
assert.deepEqual(heuristic.task.directoryPaths, directories.map(directory => directory.path))

const unpaired = recommendTask('review', 'review /audit/logs', directories, entries)
assert.equal(unpaired.mode, 'weak-match')
assert.deepEqual(unpaired.task.directoryPaths, directories.map(directory => directory.path))

const tokenBoundary = recommendTask('feature', 'improve superuser permissions', directories, entries)
assert.equal(tokenBoundary.mode, 'default')
assert.equal(tokenBoundary.matchedEndpoints.length, 0)

console.log('task recommendation smoke: trusted narrowing, weak fallback, token boundary OK')
