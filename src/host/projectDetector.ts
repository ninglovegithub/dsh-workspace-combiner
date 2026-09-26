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
import type { DetectedProject, ProjectType } from '../core/types.ts'

/** 最大扫描深度（根 = 0，向下到第 2 层子目录）。 */
const MAX_SCAN_DEPTH = 2

/** 最多访问目录数（防失控）。 */
const MAX_VISITED_DIRS = 256

/** 视为「代码文件」的扩展名（命中 ≥3 个即判为通用代码项目）。 */
const CODE_EXTENSIONS = new Set([
  '.java', '.js', '.jsx', '.ts', '.tsx', '.vue', '.py', '.go', '.rs',
  '.c', '.cc', '.cpp', '.h', '.hpp', '.cs', '.rb', '.php', '.kt', '.scala', '.swift',
])

/** 读 package.json 的 dependencies/devDependencies 键名（失败返回空）。 */
async function readPackageDeps(dir: string): Promise<string[]> {
  try {
    const raw = await readFile(join(dir, 'package.json'), 'utf8')
    const pkg = JSON.parse(raw) as { dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown> }
    return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
  } catch {
    return []
  }
}

/** 依据目录项识别项目类型（none 表示不是项目根）。 */
async function detectType(dir: string, entries: string[]): Promise<ProjectType> {
  const names = new Set(entries)
  if (names.has('pom.xml') || names.has('build.gradle') || names.has('build.gradle.kts') || names.has('settings.gradle')) return 'java'
  if (names.has('go.mod')) return 'go'
  if (names.has('requirements.txt') || names.has('pyproject.toml') || names.has('setup.py')) return 'python'
  if (names.has('package.json')) {
    const deps = await readPackageDeps(dir)
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
      found.push({ root: dir, name: basename(dir), type, evidence: evidenceFor(type) })
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
