import assert from 'node:assert/strict'
import { contextPresetConfig, resolveWorkspaceContext } from '../src/core/contextPreset.ts'
import { estimateTokens, type FileIndexEntry } from '../src/core/fileTree.ts'
import type { CodeIndexEntry, Workspace } from '../src/core/types.ts'
import { renderMultiWorkspacePromptDetailed } from '../src/prompt.ts'

const now = Date.now()
const legacy: Workspace = {
  id: 'legacy',
  name: 'legacy',
  directories: [{ id: '/tmp/app', name: 'app', path: '/tmp/app' }],
  loadMode: 'full',
  tokenBudget: 4321,
  codeIndexBudget: 222,
  createdAt: now,
  updatedAt: now,
}
const legacyResolved = resolveWorkspaceContext(legacy)
assert.equal(legacyResolved.preset, 'custom')
assert.equal(legacyResolved.loadMode, 'full')
assert.equal(legacyResolved.globalBudget, 4321)
assert.equal(legacyResolved.fileIndexBudget, 4321)
assert.equal(legacyResolved.codeIndexBudget, 222)

const balanced = contextPresetConfig('balanced')
assert.equal(balanced.preset, 'balanced')
assert.equal(balanced.globalBudget, 32000)

const entries: FileIndexEntry[] = [{
  name: 'app',
  path: '/tmp/app',
  files: 500,
  dirs: 50,
  tree: Array.from({ length: 80 }, (_, index) => ({ name: `feature-${index}.ts`, type: 'file' as const })),
}]
const codeEntries: CodeIndexEntry[] = Array.from({ length: 60 }, (_, index) => ({
  feature: `feature${index}`,
  endpoint: `/api/feature/${index}`,
  server: { file: `src/server/feature-${index}.ts`, line: index + 1 },
  client: { file: `src/client/feature-${index}.ts`, line: index + 1 },
  refs: 2,
  summary: 'AI generated explanation '.repeat(8),
}))
const gated = renderMultiWorkspacePromptDetailed({
  workspaces: legacy.directories,
  loadMode: 'full',
  entries,
  fileIndexBudget: 8000,
  codeEntries,
  codeIndexBudget: 6000,
  globalBudget: 1800,
})
assert.ok(estimateTokens(gated.text) <= 1800)
assert.ok(gated.degradations.includes('file-index-truncated'))
assert.ok(gated.degradations.includes('code-index-truncated'))
assert.match(gated.text, /不得静默忽略用户显式引用/)

console.log('context budget smoke passed')
