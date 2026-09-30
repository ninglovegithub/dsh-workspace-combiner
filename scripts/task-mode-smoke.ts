import assert from 'node:assert/strict'
import { parseSessionTask, recommendTask, TASK_MODES, taskExecutionPlan, taskModeConfig } from '../src/core/task.ts'
import type { CodeIndexEntry, WorkspaceRef } from '../src/core/types.ts'
import { renderMultiWorkspacePrompt } from '../src/prompt.ts'

const directories: WorkspaceRef[] = [
  { id: '/docs', name: 'docs', path: '/docs', access: 'readwrite' },
  { id: '/server', name: 'server', path: '/server', access: 'readwrite' },
  { id: '/client', name: 'client', path: '/client', access: 'readwrite' },
]
const entries: CodeIndexEntry[] = [{
  feature: 'login', endpoint: '/api/login', refs: 0, confidence: 'exact',
  server: { file: 'server.ts', line: 1 }, client: { file: 'client.ts', line: 2 }, serverDir: '/server', clientDir: '/client',
}]

assert.deepEqual(TASK_MODES, ['feature', 'api-change', 'bugfix', 'review', 'refactor', 'custom'])
for (const mode of TASK_MODES) {
  const config = taskModeConfig(mode)
  assert.equal(config.taskMode, mode)
  assert.ok(config.requiredBlocks.length > 0)
  assert.ok(config.promptRules.length > 0)
  assert.ok(config.finalOutput.length > 0)
  const task = recommendTask(mode, 'verify mode rules', directories, entries).task
  const prompt = renderMultiWorkspacePrompt({ workspaces: directories, task })
  assert.ok(prompt.includes(config.promptRules[0]!))
  assert.ok(prompt.includes(config.finalOutput))
}

const review = recommendTask('review', 'review login', directories, entries).task
assert.equal(review.allowWrites, false)
assert.deepEqual(review.directoryPaths, directories.map(directory => directory.path))
assert.ok(taskExecutionPlan(review, directories, {}).every(project => project.access === 'readonly'))

const api = recommendTask('api-change', 'change @login contract', directories, entries).task
assert.equal(api.endpointImpact, true)
assert.equal(api.includeCodeIndex, true)
assert.equal(api.contextPreset, 'deep')
assert.ok(api.verification.includes('review-impact'))

const legacy = parseSessionTask({ type: 'review', description: 'legacy review', directoryPaths: ['/docs', '/server'], loadMode: 'tree', includeCodeIndex: false, verification: ['review-impact'] })
assert.equal(legacy?.taskMode, 'review')
assert.equal(legacy?.allowWrites, false)
assert.equal(legacy?.includeCodeIndex, true)

console.log('task mode smoke: registry, legacy migration, review readonly, API impact OK')
