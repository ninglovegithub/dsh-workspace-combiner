/**
 * 文件索引地基：gitignore 过滤 + 有界文件树扫描 + mtime 缓存。
 * 供「目录树加载模式」「@指令文件解析」「上下文监控面板」复用。
 * @module dsh-workspace-combiner/host/fileIndex
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

import type { FileTreeNode } from '../core/fileTree.ts'

// 纯类型与渲染/统计工具已下沉到平台无关的 core/fileTree.ts；这里转发以兼容既有导入。
export { countNodes, renderTree } from '../core/fileTree.ts'
export type { FileTreeNode } from '../core/fileTree.ts'

/** 扫描选项。 */
export interface FileIndexOptions {
  /** 最大递归深度（默认 4）。 */
  maxDepth?: number
  /** 最大文件数（默认 500，超出停止）。 */
  maxFiles?: number
}

/** 内置默认忽略（gitignore 之外兜底）：VCS、依赖、构建产物与常见工具缓存。 */
const DEFAULT_IGNORES = [
  '.git', 'node_modules', 'dist', 'build', 'coverage', '.DS_Store',
  '.pnpm-store', '.next', '.nuxt', '.turbo', '.venv', '__pycache__', '.gradle',
]

/** 需要转义的正则特殊字符。 */
const REGEX_SPECIALS = new Set(['.', '+', '^', '$', '(', ')', '[', ']', '{', '}', '|', '\\'])

/** 把 gitignore 风格 glob 片段转成正则片段（简化子集）。 */
function globToRegex(glob: string): string {
  let re = ''
  let i = 0
  while (i < glob.length) {
    const ch = glob[i]
    if (ch === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') {
        re += '(?:[^/]+/)*'
        i += 3
      } else {
        re += '.*'
        i += 2
      }
    } else if (ch === '*') {
      re += '[^/]*'
      i++
    } else if (ch === '?') {
      re += '[^/]'
      i++
    } else if (REGEX_SPECIALS.has(ch)) {
      re += '\\' + ch
      i++
    } else {
      re += ch
      i++
    }
  }
  return re
}

/** 解析 .gitignore 内容为匹配正则（简化：忽略 ! 取反、目录锚定等高级语法）。 */
export function parseGitignore(content: string): RegExp[] {
  const patterns: RegExp[] = []
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    if (line.startsWith('!')) continue
    let p = line.replace(/\/+$/, '')
    if (p === '') continue
    if (!p.includes('/')) p = '**/' + p
    else if (!p.startsWith('/') && !p.startsWith('**')) p = '**/' + p
    if (p.startsWith('/')) p = p.slice(1)
    patterns.push(new RegExp('^' + globToRegex(p) + '(/.*)?$'))
  }
  return patterns
}

/** 判断相对路径（'/' 分隔）是否应忽略。 */
export function isIgnored(relPath: string, isDir: boolean, patterns: RegExp[]): boolean {
  for (const part of relPath.split('/')) {
    if (DEFAULT_IGNORES.includes(part)) return true
  }
  for (const re of patterns) {
    if (re.test(relPath)) return true
    if (isDir && re.test(relPath + '/')) return true
  }
  return false
}

/** 读取 root/.gitignore（缺失返回空）。同时供代码索引复用同一套忽略规则。 */
export async function loadGitignore(root: string): Promise<RegExp[]> {
  try {
    return parseGitignore(await readFile(join(root, '.gitignore'), 'utf8'))
  } catch {
    return []
  }
}

/** 同级目录并发度（防止宽目录一次打开过多 fd）。 */
const DIR_CONCURRENCY = 8

/** 有界并发映射（保序），用于同级目录并行下钻。 */
async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next++
      if (index >= items.length) return
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
  return results
}

/** 有界递归扫描，构建文件树（过滤 gitignore + 默认忽略）。 */
export async function buildFileTree(root: string, options: FileIndexOptions = {}): Promise<FileTreeNode[]> {
  const maxDepth = options.maxDepth ?? 4
  const maxFiles = options.maxFiles ?? 500
  const patterns = await loadGitignore(root)
  let fileCount = 0

  async function walk(dir: string, depth: number): Promise<FileTreeNode[]> {
    if (depth > maxDepth || fileCount >= maxFiles) return []
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return []
    }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    const nodes: FileTreeNode[] = []
    const subdirs: { name: string; rel: string }[] = []
    for (const ent of entries) {
      if (fileCount >= maxFiles) break
      const rel = relative(root, join(dir, ent.name)).split(sep).join('/')
      if (isIgnored(rel, ent.isDirectory(), patterns)) continue
      if (ent.isDirectory()) subdirs.push({ name: ent.name, rel })
      else {
        fileCount++
        nodes.push({ name: ent.name, path: rel, type: 'file' })
      }
    }
    // 同级目录并行下钻（保序），避免深/宽目录串行等待。
    const children = await mapLimit(subdirs, DIR_CONCURRENCY, async sub => ({ name: sub.name, rel: sub.rel, nodes: await walk(join(dir, sub.name), depth + 1) }))
    for (const child of children) nodes.push({ name: child.name, path: child.rel, type: 'dir', children: child.nodes })
    return nodes
  }

  return await walk(root, 1)
}

/**
 * 递归计数（不建树）：gitignore + 默认忽略，供摘要与监控显示真实体量。
 * 与 buildFileTree 不同，这里不受 maxDepth 限制，只受 maxFiles 上限保护。
 */
export async function countTree(root: string, options: { maxFiles?: number } = {}): Promise<{ files: number; dirs: number; truncated: boolean }> {
  const maxFiles = options.maxFiles ?? 20000
  const patterns = await loadGitignore(root)
  let files = 0
  let dirs = 0
  let truncated = false
  const walk = async (dir: string): Promise<void> => {
    if (files >= maxFiles) { truncated = true; return }
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    const subdirs: string[] = []
    for (const ent of entries) {
      if (files >= maxFiles) { truncated = true; return }
      const rel = relative(root, join(dir, ent.name)).split(sep).join('/')
      if (isIgnored(rel, ent.isDirectory(), patterns)) continue
      if (ent.isDirectory()) { dirs++; subdirs.push(join(dir, ent.name)) }
      else files++
    }
    await mapLimit(subdirs, DIR_CONCURRENCY, async sub => { await walk(sub) })
  }
  await walk(root)
  return { files, dirs, truncated }
}

/** mtime + TTL 缓存：根目录 mtime 未变且未过期则复用上次索引。 */
export class FileIndexCache {
  /** 缓存有效期：深层增删不改根目录 mtime，用 TTL 兜住系统性陈旧。 */
  private static readonly TTL_MS = 30_000
  private readonly cache = new Map<string, { mtime: number; at: number; tree: FileTreeNode[] }>()
  private readonly countCache = new Map<string, { mtime: number; at: number; value: { files: number; dirs: number; truncated: boolean } }>()

  async get(root: string, options?: FileIndexOptions): Promise<FileTreeNode[]> {
    const maxDepth = options?.maxDepth ?? 4
    const maxFiles = options?.maxFiles ?? 500
    const key = root + '#' + maxDepth + '#' + maxFiles
    let mtime = 0
    try {
      mtime = (await stat(root)).mtimeMs
    } catch {
      return []
    }
    const hit = this.cache.get(key)
    if (hit !== undefined && hit.mtime === mtime && Date.now() - hit.at < FileIndexCache.TTL_MS) return hit.tree
    const tree = await buildFileTree(root, { maxDepth, maxFiles })
    this.cache.set(key, { mtime, at: Date.now(), tree })
    return tree
  }

  /** 递归计数（走独立计数缓存，与文件树缓存互不干扰）。 */
  async count(root: string, options?: { maxFiles?: number }): Promise<{ files: number; dirs: number; truncated: boolean }> {
    const maxFiles = options?.maxFiles ?? 20000
    const key = root + '#count#' + maxFiles
    let mtime = 0
    try {
      mtime = (await stat(root)).mtimeMs
    } catch {
      return { files: 0, dirs: 0, truncated: false }
    }
    const hit = this.countCache.get(key)
    if (hit !== undefined && hit.mtime === mtime && Date.now() - hit.at < FileIndexCache.TTL_MS) return hit.value
    const value = await countTree(root, { maxFiles })
    this.countCache.set(key, { mtime, at: Date.now(), value })
    return value
  }

  clear(): void {
    this.cache.clear()
    this.countCache.clear()
  }
}
