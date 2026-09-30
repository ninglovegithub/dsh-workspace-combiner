import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildCodeIndex, CodeIndexCache } from '../src/host/codeIndex.ts'
import type { WorkspaceRef } from '../src/core/types.ts'

const root = await mkdtemp(join(tmpdir(), 'wcb-code-index-'))
const project = join(root, 'project')

try {
  await mkdir(project)
  await writeFile(join(project, 'server.ts'), [
    "app.get('/exact', exactHandler)",
    "app.get('/users/{id}', userHandler)",
    "app.get('/server-only', serverOnlyHandler)",
  ].join('\n'))
  await writeFile(join(project, 'client.ts'), [
    "fetch('/exact')",
    'fetch(`/api/users/${id}`)',
  ].join('\n'))

  const workspace: WorkspaceRef = { id: project, name: 'fixture', path: project, access: 'readwrite' }
  const result = await buildCodeIndex([workspace])
  const exact = result.entries.find(entry => entry.endpoint === '/exact')
  const normalized = result.entries.find(entry => entry.endpoint.includes('/users/'))
  const unpaired = result.entries.find(entry => entry.endpoint === '/server-only')

  assert.equal(exact?.confidence, 'exact')
  assert.equal(normalized?.confidence, 'normalized')
  assert.ok(normalized?.reasons?.includes('normalized-api-prefix'))
  assert.ok(normalized?.reasons?.includes('normalized-parameter'))
  assert.equal(unpaired?.confidence, 'unpaired')
  assert.ok(unpaired?.reasons?.includes('missing-counterpart'))

  const cacheFile = join(root, 'legacy-cache.json')
  const cacheAt = Date.now()
  const mtime = (await stat(project)).mtimeMs
  await writeFile(cacheFile, JSON.stringify({
    signature: project + '@' + mtime,
    at: cacheAt,
    entries: [{
      feature: 'legacy',
      endpoint: '/legacy',
      server: { file: 'server.ts', line: 1 },
      client: { file: 'client.ts', line: 1 },
      refs: 0,
    }],
    fileEndpoints: {},
  }))
  const cached = await new CodeIndexCache(cacheFile).get([workspace])
  assert.equal(cached.entries[0]?.confidence, 'heuristic')
  assert.deepEqual(cached.entries[0]?.reasons, ['legacy-cache'])
  assert.equal(cached.entries[0]?.indexedAt, cacheAt)

  console.log('code-index smoke: exact, normalized, unpaired, legacy cache OK')
} finally {
  await rm(root, { recursive: true, force: true })
}
