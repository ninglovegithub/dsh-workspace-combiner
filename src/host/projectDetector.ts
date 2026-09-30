/**
 * 宿主目录扫描：从给定根目录向下（最多 2 层）识别代码项目，用于新建工作空间
 * 向导第二步「自动识别项目」。识别依据：package.json（vue / react / 前端）、
 * pom.xml / gradle（Java）、requirements.txt / pyproject.toml / setup.py（Python）、
 * go.mod（Go）、≥3 个源码文件（通用代码项目）。
 * @module dsh-workspace-combiner/host/projectDetector
 */

import { readdir, readFile } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { basename, join } from 'node:path'
import type { DetectedProject, DirectoryCommands, ProjectType } from '../core/types.ts'

/** 最大扫描深度（根 = 0，向下到第 2 层子目录）。 */
const MAX_SCAN_DEPTH = 2

/** 最多访问目录数（防失控）。 */
const MAX_VISITED_DIRS = 256

/** 视为「代码文件」的扩展名（命中 ≥3 个即判为通用代码项目）。 */
const CODE_EXTENSIONS = new Set([
  '.java', '.js', '.jsx', '.ts', '.tsx', '.vue', '.py', '.go', '.rs',
  '.c', '.cc', '.cpp', '.h', '.hpp', '.cs', '.rb', '.php', '.kt', '.scala', '.swift',
])

interface PackageInfo {
  deps: string[]
  scripts: Set<string>
  packageManager?: string
}

/** 读 package.json 的依赖、脚本与包管理器声明（失败返回空）。 */
async function readPackageInfo(dir: string): Promise<PackageInfo> {
  try {
    const raw = await readFile(join(dir, 'package.json'), 'utf8')
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, unknown>
      devDependencies?: Record<string, unknown>
      scripts?: Record<string, unknown>
      packageManager?: unknown
    }
    return {
      deps: Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }),
      scripts: new Set(Object.entries(pkg.scripts ?? {}).filter(([, value]) => typeof value === 'string' && value.trim() !== '').map(([name]) => name)),
      ...(typeof pkg.packageManager === 'string' ? { packageManager: pkg.packageManager } : {}),
    }
  } catch {
    return { deps: [], scripts: new Set() }
  }
}

/** 依据目录项识别项目类型（none 表示不是项目根）。 */
async function detectType(dir: string, entries: string[]): Promise<ProjectType> {
  const names = new Set(entries)
  if (names.has('pom.xml') || names.has('build.gradle') || names.has('build.gradle.kts') || names.has('settings.gradle')) return 'java'
  if (names.has('go.mod')) return 'go'
  if (names.has('requirements.txt') || names.has('pyproject.toml') || names.has('setup.py')) return 'python'
  if (names.has('package.json')) {
    const { deps } = await readPackageInfo(dir)
    // next 基于 react、webpack 常作为 vue/react 的构建依赖，按「更具体优先」判定。
    if (deps.includes('next')) return 'frontend-next'
    if (deps.includes('vue')) return 'frontend-vue'
    if (deps.includes('react') || deps.includes('react-dom')) return 'frontend-react'
    if (deps.includes('webpack')) return 'frontend-webpack'
    return 'frontend'
  }
  const codeCount = entries.filter(e => {
    const dot = e.lastIndexOf('.')
    return dot > 0 && CODE_EXTENSIONS.has(e.slice(dot).toLowerCase())
  }).length
  return codeCount >= 3 ? 'generic' : 'none'
}

/** 项目识别依据描述（hover 提示用）。 */
function evidenceFor(type: ProjectType): string {
  switch (type) {
    case 'java': return 'pom.xml / build.gradle'
    case 'go': return 'go.mod'
    case 'python': return 'requirements.txt / pyproject.toml'
    case 'frontend-vue': return 'package.json + vue'
    case 'frontend-react': return 'package.json + react'
    case 'frontend-webpack': return 'package.json + webpack'
    case 'frontend-next': return 'package.json + next'
    case 'frontend': return 'package.json'
    case 'generic': return '源码文件'
    case 'none': return ''
  }
}

/**
 * 按项目类型给出常用命令默认值（面板预填，用户可改）。
 * 只给「几乎必然正确」的通用命令：需要额外参数（profile、模块名）的一律留空，
 * 宁可让用户自己填，也不要注入一条跑不通的命令。
 * @param type - 识别出的项目类型。
 * @returns 默认命令（无把握时缺字段）。
 */
export function defaultCommands(type: ProjectType): DirectoryCommands | undefined {
  switch (type) {
    case 'java': return { run: 'mvn spring-boot:run', test: 'mvn test', build: 'mvn -q package -DskipTests' }
    case 'go': return { run: 'go run .', test: 'go test ./...', build: 'go build ./...' }
    case 'python': return { test: 'pytest' }
    case 'frontend-next': return { run: 'pnpm dev', test: 'pnpm test', build: 'pnpm build' }
    case 'frontend-vue':
    case 'frontend-react':
    case 'frontend-webpack':
    case 'frontend': return { run: 'pnpm dev', test: 'pnpm test', build: 'pnpm build' }
    default: return undefined
  }
}

export function suggestedGroup(type: ProjectType, name: string): 'backend' | 'frontend' | 'reference' | 'other' {
  if (type.startsWith('frontend')) return 'frontend'
  if (type === 'java' || type === 'go' || type === 'python') return 'backend'
  if (/\b(shared|common|sdk|types?|contracts?|schemas?|proto)\b/i.test(name.replace(/[-_.]+/g, ' '))) return 'reference'
  return 'other'
}

function packageManager(entries: readonly string[], declared?: string): 'pnpm' | 'npm' | 'yarn' | 'bun' {
  const name = declared?.split('@')[0]
  if (name === 'pnpm' || name === 'npm' || name === 'yarn' || name === 'bun') return name
  if (entries.includes('pnpm-lock.yaml')) return 'pnpm'
  if (entries.includes('yarn.lock')) return 'yarn'
  if (entries.includes('bun.lock') || entries.includes('bun.lockb')) return 'bun'
  return 'npm'
}

function scriptCommand(manager: 'pnpm' | 'npm' | 'yarn' | 'bun', script: string): string {
  if (manager === 'npm') return 'npm run ' + script
  if (manager === 'bun') return 'bun run ' + script
  return manager + ' ' + script
}

async function detectedCommands(dir: string, type: ProjectType, entries: readonly string[]): Promise<DirectoryCommands | undefined> {
  if (type.startsWith('frontend')) {
    const info = await readPackageInfo(dir)
    const manager = packageManager(entries, info.packageManager)
    const runScript = info.scripts.has('dev') ? 'dev' : info.scripts.has('start') ? 'start' : undefined
    const commands: DirectoryCommands = {
      ...(runScript === undefined ? {} : { run: scriptCommand(manager, runScript) }),
      ...(info.scripts.has('test') ? { test: scriptCommand(manager, 'test') } : {}),
      ...(info.scripts.has('build') ? { build: scriptCommand(manager, 'build') } : {}),
    }
    return Object.keys(commands).length === 0 ? undefined : commands
  }
  if (type === 'java') {
    if (entries.includes('pom.xml')) {
      const runner = entries.includes('mvnw') ? './mvnw' : 'mvn'
      return { run: runner + ' spring-boot:run', test: runner + ' test', build: runner + ' package -DskipTests' }
    }
    const runner = entries.includes('gradlew') ? './gradlew' : 'gradle'
    return { run: runner + ' bootRun', test: runner + ' test', build: runner + ' build -x test' }
  }
  return defaultCommands(type)
}

/** 从根目录向下扫描（最多 2 层），返回识别到的项目列表。 */
export async function scanDirectory(root: string): Promise<DetectedProject[]> {
  const found: DetectedProject[] = []
  let visited = 0

  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > MAX_SCAN_DEPTH || visited >= MAX_VISITED_DIRS) return
    visited++
    let entries: Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    const names = entries.map(e => e.name)
    const type = await detectType(dir, names)
    if (type !== 'none') {
      const name = basename(dir)
      const commands = await detectedCommands(dir, type, names)
      found.push({
        root: dir,
        name,
        type,
        evidence: evidenceFor(type),
        suggestedGroup: suggestedGroup(type, name),
        ...(commands === undefined ? {} : { commands }),
      })
      return
    }
    if (depth >= MAX_SCAN_DEPTH) return
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue
      await walk(join(dir, entry.name), depth + 1)
    }
  }

  await walk(root, 0)
  return found
}
