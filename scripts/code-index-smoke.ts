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
    "import { exactHelper } from './helper'",
    'export class ExactService {}',
    'export function buildExact() {}',
    "app.get('/exact', exactHandler)",
    "app.get('/users/{id}', userHandler)",
    "app.get('/server-only', serverOnlyHandler)",
  ].join('\n'))
  await writeFile(join(project, 'helper.ts'), 'export const exactHelper = () => true\n')
  await writeFile(join(project, 'server.test.ts'), "import './server'\n")
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
  assert.ok(result.symbols.some(symbol => symbol.name === 'ExactService' && symbol.kind === 'class'))
  assert.ok(result.symbols.some(symbol => symbol.name === 'buildExact' && symbol.kind === 'function'))
  assert.equal(result.symbols.find(symbol => symbol.name === 'buildExact')?.signature, 'export function buildExact() { … }')
  assert.ok(result.dependencies.some(dependency => dependency.from === 'server.ts' && dependency.to === 'helper.ts'))
  assert.ok(result.tests.some(entry => entry.source === 'server.ts' && entry.test === 'server.test.ts' && entry.reason === 'import'))

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

  console.log('code-index smoke: endpoints, symbols, dependencies, test mapping and legacy cache OK')
} finally {
  await rm(root, { recursive: true, force: true })
}
