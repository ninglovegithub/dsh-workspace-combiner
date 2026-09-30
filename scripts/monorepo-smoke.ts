import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseWorkspaceRef } from '../src/core/validate.ts'
import { scanDirectory } from '../src/host/projectDetector.ts'
import { renderMultiWorkspacePrompt } from '../src/prompt.ts'

const root = await mkdtemp(join(tmpdir(), 'wcb-monorepo-'))

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value))
}

try {
  const pnpmRoot = join(root, 'pnpm-repo')
  await Promise.all([
    mkdir(join(pnpmRoot, 'apps', 'web'), { recursive: true }),
    mkdir(join(pnpmRoot, 'packages', 'contracts'), { recursive: true }),
  ])
  await writeJson(join(pnpmRoot, 'package.json'), { private: true, packageManager: 'pnpm@11.0.0', scripts: { build: 'turbo build' } })
  await writeFile(join(pnpmRoot, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n  - 'packages/*'\n")
  await writeJson(join(pnpmRoot, 'apps', 'web', 'package.json'), { dependencies: { react: '^19.0.0' } })
  await Promise.all(['index.ts', 'schema.ts', 'types.ts'].map(file => writeFile(join(pnpmRoot, 'packages', 'contracts', file), 'export {}\n')))

  const mavenRoot = join(root, 'java-platform')
  await mkdir(join(mavenRoot, 'service-api'), { recursive: true })
  await writeFile(join(mavenRoot, 'pom.xml'), '<project><modules><module>service-api</module></modules></project>')
  await writeFile(join(mavenRoot, 'service-api', 'pom.xml'), '<project/>')

  const turboRoot = join(root, 'turbo-repo')
  await mkdir(join(turboRoot, 'apps', 'admin'), { recursive: true })
  await writeJson(join(turboRoot, 'package.json'), { private: true, workspaces: ['apps/*'] })
  await writeJson(join(turboRoot, 'turbo.json'), { tasks: { build: {} } })
  await writeJson(join(turboRoot, 'apps', 'admin', 'package.json'), { dependencies: { vue: '^3.0.0' } })

  const gradleRoot = join(root, 'gradle-platform')
  await mkdir(join(gradleRoot, 'service-core'), { recursive: true })
  await writeFile(join(gradleRoot, 'settings.gradle.kts'), 'include(":service-core")\n')
  await writeFile(join(gradleRoot, 'service-core', 'build.gradle.kts'), 'plugins { java }\n')

  const projects = await scanDirectory(root)
  const pnpm = projects.find(project => project.name === 'pnpm-repo')
  const maven = projects.find(project => project.name === 'java-platform')
  const turbo = projects.find(project => project.name === 'turbo-repo')
  const gradle = projects.find(project => project.name === 'gradle-platform')
  assert.equal(projects.some(project => project.name === 'web'), false, 'nested packages must not become duplicate workspace roots')
  assert.equal(pnpm?.monorepo?.kind, 'pnpm')
  assert.deepEqual(pnpm?.monorepo?.packages.map(pkg => [pkg.path, pkg.projectType]), [
    ['apps/web', 'frontend-react'],
    ['packages/contracts', 'generic'],
  ])
  assert.deepEqual(pnpm?.commands, { build: 'pnpm build' })
  assert.equal(maven?.monorepo?.kind, 'maven')
  assert.deepEqual(maven?.monorepo?.packages.map(pkg => pkg.path), ['service-api'])
  assert.equal(turbo?.monorepo?.kind, 'turbo')
  assert.deepEqual(turbo?.monorepo?.packages.map(pkg => pkg.projectType), ['frontend-vue'])
  assert.equal(gradle?.monorepo?.kind, 'gradle')
  assert.deepEqual(gradle?.monorepo?.packages.map(pkg => pkg.path), ['service-core'])

  const ref = parseWorkspaceRef({ id: pnpmRoot, name: 'pnpm-repo', path: pnpmRoot, monorepo: pnpm?.monorepo })
  assert.equal(ref?.monorepo?.packages.length, 2)
  const prompt = renderMultiWorkspacePrompt({ workspaces: [ref!], mode: 'single' })
  assert.match(prompt, /# Monorepo 包边界/)
  assert.match(prompt, /apps\/web/)
  assert.match(prompt, /禁止把嵌套包当成独立 Git 仓库/)

  console.log('monorepo smoke: root detection, package boundaries, persistence and prompt OK')
} finally {
  await rm(root, { recursive: true, force: true })
}
