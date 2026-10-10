import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scanDirectory } from '../src/host/projectDetector.ts'

/**
 * 项目扫描回归：
 *   1. 父目录本身像项目时仍要继续下钻（旧实现命中即 return，会把子项目整片漏掉）；
 *   2. 复用文件索引的忽略规则：dist/ 里的源码不得被当成项目；
 *   3. Monorepo 已声明的包目录不得再作为独立工作区根重复上报。
 */

const root = await mkdtemp(join(tmpdir(), 'wcb-project-scan-'))
const scanRoot = join(root, 'scan-root')
const monorepoRoot = join(root, 'monorepo')

try {
  // 父目录直接 3 个源码文件 → generic；子目录 api 才是真正的项目。
  await mkdir(join(scanRoot, 'api'), { recursive: true })
  await mkdir(join(scanRoot, 'dist'), { recursive: true })
  await Promise.all(['a.ts', 'b.ts', 'c.ts'].map(file => writeFile(join(scanRoot, file), 'export {}\n')))
  await writeFile(join(scanRoot, 'api', 'go.mod'), 'module example.com/api\n')
  await Promise.all(['d.ts', 'e.ts', 'f.ts'].map(file => writeFile(join(scanRoot, 'dist', file), 'export {}\n')))

  // Monorepo 根 + 一个已声明包（包内 3 个源码文件，足以被判成 generic）。
  await mkdir(join(monorepoRoot, 'packages', 'shared'), { recursive: true })
  await writeFile(join(monorepoRoot, 'package.json'), JSON.stringify({ private: true, packageManager: 'pnpm@11.0.0' }))
  await writeFile(join(monorepoRoot, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n")
  await Promise.all(['index.ts', 'types.ts', 'schema.ts'].map(file => writeFile(join(monorepoRoot, 'packages', 'shared', file), 'export {}\n')))

  const scanned = await scanDirectory(scanRoot)
  const names = scanned.map(project => project.name)
  assert.ok(names.includes('scan-root'), '父目录本身是 generic 项目，仍应上报；got ' + JSON.stringify(names))
  assert.equal(scanned.find(project => project.name === 'scan-root')?.type, 'generic')
  assert.ok(names.includes('api'), '命中父项目后必须继续下钻，子项目 api 不能漏；got ' + JSON.stringify(names))
  assert.equal(scanned.find(project => project.name === 'api')?.type, 'go')
  assert.equal(names.includes('dist'), false, 'dist/ 必须按忽略规则跳过；got ' + JSON.stringify(names))

  const monorepo = await scanDirectory(monorepoRoot)
  const monorepoNames = monorepo.map(project => project.name)
  assert.equal(monorepo.find(project => project.name === 'monorepo')?.monorepo?.kind, 'pnpm')
  assert.deepEqual(monorepo.find(project => project.name === 'monorepo')?.monorepo?.packages.map(pkg => pkg.path), ['packages/shared'])
  assert.equal(monorepoNames.includes('shared'), false, '已声明的 monorepo 包不得成为独立工作区根；got ' + JSON.stringify(monorepoNames))

  console.log('project scan smoke: nested projects found, ignore rules reused, monorepo packages not duplicated OK')
} finally {
  await rm(root, { recursive: true, force: true })
}
