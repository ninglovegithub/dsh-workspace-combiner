/**
 * 文件索引地基：gitignore 过滤 + 有界文件树扫描 + mtime 缓存。
 * 供「目录树加载模式」「@指令文件解析」「上下文监控面板」复用。
 * @module dsh-workspace-combiner/host/fileIndex
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

/** 文件树节点。 */
export interface FileTreeNode {
  name: string
  /** 相对根目录的路径（用 '/' 分隔）。 */
  path: string
  type: 'file' | 'dir'
  children?: FileTreeNode[]
}

/** 扫描选项。 */
export interface FileIndexOptions {
  /** 最大递归深度（默认 4）。 */
  maxDepth?: number
  /** 最大文件数（默认 500，超出停止）。 */
  maxFiles?: number
}

/** 内置默认忽略（gitignore 之外兜底）。 */
const DEFAULT_IGNORES = ['.git', 'node_modules', 'dist', 'build', 'coverage', '.DS_Store']

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

/** 读取 root/.gitignore（缺失返回空）。 */
async function loadGitignore(root: string): Promise<RegExp[]> {
  try {
    return parseGitignore(await readFile(join(root, '.gitignore'), 'utf8'))
  } catch {
    return []
  }
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
    for (const ent of entries) {
      if (fileCount >= maxFiles) break
      const rel = relative(root, join(dir, ent.name)).split(sep).join('/')
      if (isIgnored(rel, ent.isDirectory(), patterns)) continue
      if (ent.isDirectory()) {
        const children = await walk(join(dir, ent.name), depth + 1)
        nodes.push({ name: ent.name, path: rel, type: 'dir', children })
      } else {
        fileCount++
        nodes.push({ name: ent.name, path: rel, type: 'file' })
      }
    }
    return nodes
  }

  return await walk(root, 1)
}

/** 统计文件树中的文件/目录数。 */
export function countNodes(nodes: readonly FileTreeNode[]): { files: number; dirs: number } {
  let files = 0
  let dirs = 0
  const visit = (list: readonly FileTreeNode[]): void => {
    for (const n of list) {
      if (n.type === 'file') files++
      else {
        dirs++
        if (n.children !== undefined) visit(n.children)
      }
    }
  }
  visit(nodes)
  return { files, dirs }
}

/** 把文件树渲染成缩进文本（目录树加载模式使用）。 */
export function renderTree(nodes: readonly FileTreeNode[], indent = ''): string {
  const lines: string[] = []
  for (const n of nodes) {
    lines.push(indent + n.name + (n.type === 'dir' ? '/' : ''))
    if (n.type === 'dir' && n.children !== undefined) lines.push(renderTree(n.children, indent + '  '))
  }
  return lines.join('\n')
}

/** mtime 缓存：根目录 mtime 未变则复用上次索引。 */
export class FileIndexCache {
  private readonly cache = new Map<string, { mtime: number; tree: FileTreeNode[] }>()

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
    if (hit !== undefined && hit.mtime === mtime) return hit.tree
    const tree = await buildFileTree(root, { maxDepth, maxFiles })
    this.cache.set(key, { mtime, tree })
    return tree
  }

  clear(): void {
    this.cache.clear()
  }
}
