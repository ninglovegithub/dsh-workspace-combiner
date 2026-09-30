import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanDirectory, suggestedGroup } from '../src/host/projectDetector.ts'

const root = await mkdtemp(join(tmpdir(), 'wcb-project-defaults-'))

try {
  const frontend = join(root, 'web-app')
  const backend = join(root, 'api-go')
  const reference = join(root, 'shared-types')
  await Promise.all([mkdir(frontend), mkdir(backend), mkdir(reference)])
  await writeFile(join(frontend, 'package.json'), JSON.stringify({
    packageManager: 'yarn@4.5.0',
    dependencies: { react: '^18.0.0' },
    scripts: { dev: 'vite', build: 'vite build' },
  }))
  await writeFile(join(frontend, 'yarn.lock'), '')
  await writeFile(join(backend, 'go.mod'), 'module example.com/api\n')
  await Promise.all(['index.ts', 'types.ts', 'schema.ts'].map(file => writeFile(join(reference, file), 'export {}\n')))

  const projects = await scanDirectory(root)
  const web = projects.find(project => project.name === 'web-app')
  const api = projects.find(project => project.name === 'api-go')
  const shared = projects.find(project => project.name === 'shared-types')

  assert.equal(web?.suggestedGroup, 'frontend')
  assert.deepEqual(web?.commands, { run: 'yarn dev', build: 'yarn build' })
  assert.equal(api?.suggestedGroup, 'backend')
  assert.deepEqual(api?.commands, { run: 'go run .', test: 'go test ./...', build: 'go build ./...' })
  assert.equal(shared?.suggestedGroup, 'reference')
  assert.equal(shared?.commands, undefined)
  assert.equal(suggestedGroup('generic', 'core-service'), 'other')

  console.log('project defaults smoke: groups, package manager, scripts, commands OK')
} finally {
  await rm(root, { recursive: true, force: true })
}
