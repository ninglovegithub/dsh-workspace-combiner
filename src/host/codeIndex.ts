/**
 * 功能角度代码索引：在选中的目录里抽取 HTTP 端点，并联结「服务端注册/处理」与
 * 「客户端调用」两侧的落点，供 prompt 精确导航、减少盲搜与无效 read。
 *
 * v1 是确定性的行扫描（无 AST），覆盖 TS/JS/TSX/JSX/Vue 的常见端点写法：
 *   1. 直接字面量：fetch('/api/x')、path: '/api/x'
 *   2. 命名常量：const X = '/api/x' / key: '/api/x'，再用 API.X、.x 引用联结两侧
 * 结果可能有噪声，所以只在抽到端点时注入，并受 token 上限约束。符号级索引不是本
 * 模块职责（那是 LSP/glob 的事）。
 * @module dsh-workspace-combiner/host/codeIndex
 */

import { chmod, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import { isIgnored, loadGitignore } from './fileIndex.ts'
import { dshHome } from '../store.ts'
import type { CodeIndexEntry, CodeIndexLoc, WorkspaceRef } from '../core/types.ts'

export type { CodeIndexEntry, CodeIndexLoc }

/** 参与扫描的代码扩展名（含常见后端语言，便于跨前后端联结）。 */
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.java', '.kt', '.go', '.py', '.rb', '.cs'])
/** 单次扫描上限，防止大仓库拖慢会话创建。 */
const MAX_FILES = 800
const MAX_DEPTH = 8
const MAX_FILE_BYTES = 256 * 1024
const MAX_TOTAL_BYTES = 8 * 1024 * 1024
const MAX_ENTRIES = 120

/** 端点字面量：引号内的 /path 形式。 */
const ENDPOINT_LITERAL = /['"`](\/[A-Za-z0-9._~\-/{}$:]+)['"`]/g
/** 形如 NAME = '/path' 或 key: '/path' 的命名端点（取匹配位置之前的前缀）。 */
const NAMED_SUFFIX = /([A-Za-z_$][\w$]*)\s*[:=]\s*$/
/** 引用令牌：.NAME 或 ['NAME']。 */
const REF_TOKEN = /\.([A-Za-z_$][\w$]*)\b|\[\s*['"]([A-Za-z_$][\w$]*)['"]\s*\]/g
/** 资源/文件扩展名，用于排除 '/a/b.png' 这类非端点。 */
const ASSET_EXT = /\.(png|jpe?g|gif|svg|ico|webp|css|scss|less|sass|woff2?|ttf|eot|map|html?|json|ya?ml|md|txt|lock|xml|vue|ts|tsx|js|jsx)$/i
/** 客户端调用线索（含 vue-router 页面路由）。 */
const CLIENT_HINT = /\b(fetch|axios|request|http|got|ky)\s*\(|\.(get|post|put|patch|delete)\s*\(|url\s*:|createRouter\s*\(|component\s*:/
/** 服务端注册/处理线索（含 Java 注解与 Go/gin 的大写方法）。 */
const SERVER_HINT = /kind\s*:\s*['"]exact['"]|handler\s*:|@(Get|Post|Put|Patch|Delete|Request)Mapping|(?:router|app|server|mux|bp)\.(?:get|post|put|patch|delete|route)\s*\(|\.(?:GET|POST|PUT|PATCH|DELETE)\s*\(/
/** 通用属性名：不做端点常量名，避免 names 映射被 value/path/url 之类污染。 */
const NAME_DENYLIST = new Set([
  'value', 'values', 'path', 'paths', 'url', 'uri', 'name', 'key', 'pattern', 'endpoint', 'base', 'baseUrl', 'baseURL',
  'method', 'route', 'routes', 'href', 'src', 'id', 'type', 'label', 'text', 'title', 'description',
  'prefix', 'suffix', 'host', 'port', 'protocol', 'default', 'options', 'config', 'data',
])

/** 归一化端点：{id} / ${id} / :id 视作同一占位，便于前后端联结。 */
function normalizeEndpoint(endpoint: string): string {
  return endpoint
    .replace(/\$\{[^}]*\}/g, '_')
    .replace(/\{[^}]*\}/g, '_')
    .replace(/\/:[A-Za-z_][\w]*/g, '/_')
}

/** 判断一个字面量是否像 HTTP 端点。 */
function looksLikeEndpoint(path: string): boolean {
  if (path.length < 2 || !path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  if (ASSET_EXT.test(path)) return false
  return true
}

/** 无命名时按端点路径推导功能名（取 /api/ 后的首段）。 */
function deriveFeature(endpoint: string): string {
  const segs = endpoint.split('/').filter(s => s !== '')
  if (segs[0] === 'api' && segs.length > 1) return segs[1]
  return segs[0] ?? endpoint
}

/** 累积一条端点的两侧落点。 */
function applyLoc(acc: CodeIndexEntry, file: string, line: number, server: boolean, client: boolean): void {
  if (server && acc.server === undefined) acc.server = { file, line }
  else if (client && acc.client === undefined) acc.client = { file, line }
  else acc.refs++
}

/** 递归收集代码文件（复用文件索引的忽略规则）。 */
async function collectCodeFiles(root: string, patterns: RegExp[]): Promise<string[]> {
  const out: string[] = []
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > MAX_DEPTH || out.length >= MAX_FILES) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      if (out.length >= MAX_FILES) return
      const abs = join(dir, ent.name)
      const rel = relative(root, abs).split(sep).join('/')
      if (isIgnored(rel, ent.isDirectory(), patterns)) continue
      if (ent.isDirectory()) {
        await walk(abs, depth + 1)
        continue
      }
      const dot = ent.name.lastIndexOf('.')
      if (dot <= 0) continue
      if (CODE_EXTENSIONS.has(ent.name.slice(dot).toLowerCase())) out.push(abs)
    }
  }
  await walk(root, 1)
  return out
}

/**
 * 构建功能角度代码索引。
 * @param dirs - 工作空间的目录列表（disabled 目录跳过）。
 * @returns 端点条目（仅保留至少有一侧落点的），按功能名与端点排序。
 */
export async function buildCodeIndex(dirs: readonly WorkspaceRef[]): Promise<CodeIndexEntry[]> {
  const names = new Map<string, string>()
  const byEndpoint = new Map<string, CodeIndexEntry>()
  const files: { rel: string; content: string; lines: string[]; server: boolean; client: boolean }[] = []
  let totalBytes = 0

  // key 用归一化端点（/x/{id} 与 /x/${id} 视作同一端点），display 保留首次出现的原始写法。
  const upsert = (key: string, display: string, feature: string): CodeIndexEntry => {
    let acc = byEndpoint.get(key)
    if (acc === undefined) {
      acc = { feature, endpoint: display, refs: 0 }
      byEndpoint.set(key, acc)
    }
    return acc
  }

  for (const dir of dirs) {
    if ((dir.access ?? 'readwrite') === 'disabled') continue
    const patterns = await loadGitignore(dir.path)
    for (const abs of await collectCodeFiles(dir.path, patterns)) {
      if (totalBytes >= MAX_TOTAL_BYTES) break
      let content = ''
      try {
        const info = await stat(abs)
        if (info.size > MAX_FILE_BYTES) continue
        content = await readFile(abs, 'utf8')
      } catch {
        continue
      }
      totalBytes += content.length
      files.push({
        rel: relative(dir.path, abs).split(sep).join('/'),
        content,
        lines: content.split('\n'),
        server: SERVER_HINT.test(content),
        client: CLIENT_HINT.test(content),
      })
    }
  }

  // 第一遍：字面量 + 命名定义。
  for (const f of files) {
    for (let i = 0; i < f.lines.length; i++) {
      const line = f.lines[i]
      const trimmed = line.trimStart()
      if (trimmed.startsWith('/') || trimmed.startsWith('*') || trimmed.startsWith('#')) continue
      // 跳过正则字面量/正则 API 行，否则会把正则源码里的 '/path' 当成端点。
      if (trimmed.includes('= /') || trimmed.includes('(/') || trimmed.includes('RegExp(')) continue
      ENDPOINT_LITERAL.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = ENDPOINT_LITERAL.exec(line)) !== null) {
        const endpoint = m[1]
        if (!looksLikeEndpoint(endpoint)) continue
        const key = normalizeEndpoint(endpoint)
        const rawName = NAMED_SUFFIX.exec(line.slice(0, m.index))?.[1]
        const name = rawName !== undefined && !NAME_DENYLIST.has(rawName) ? rawName : undefined
        if (name !== undefined) names.set(name, key)
        applyLoc(upsert(key, endpoint, name ?? deriveFeature(endpoint)), f.rel, i + 1, f.server, f.client)
      }
    }
  }

  // 第二遍：命名常量的引用联结（如 API.workspaceCreate / ['workspaceCreate']）。
  if (names.size > 0) {
    for (const f of files) {
      for (let i = 0; i < f.lines.length; i++) {
        const line = f.lines[i]
        REF_TOKEN.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = REF_TOKEN.exec(line)) !== null) {
          const name = m[1] ?? m[2]
          if (name === undefined) continue
          const key = names.get(name)
          if (key === undefined) continue
          applyLoc(upsert(key, name, name), f.rel, i + 1, f.server, f.client)
        }
      }
    }
  }

  return [...byEndpoint.values()]
    .filter(entry => entry.server !== undefined || entry.client !== undefined)
    .sort((a, b) => a.feature.localeCompare(b.feature) || a.endpoint.localeCompare(b.endpoint))
    .slice(0, MAX_ENTRIES)
}

/** 功能索引落盘文件（跨重启复用，避免首会话重扫全部代码）。 */
export function codeIndexFile(): string {
  return join(dshHome(), 'dsh-workspace-combiner-code-index.json')
}

/** 落盘形状。 */
interface PersistedCodeIndex {
  signature: string
  at: number
  entries: CodeIndexEntry[]
}

/**
 * 索引缓存：目录签名（路径 + 根 mtime）未变且未过期则复用。
 * 查找顺序 = 进程内存 → 磁盘（跨重启）→ 重新扫描；重建后异步落盘（失败静默）。
 */
export class CodeIndexCache {
  /** 缓存有效期：内容级改动不改根目录 mtime，用 TTL 兜住索引陈旧（行号漂移）。 */
  private static readonly TTL_MS = 60_000
  private readonly cache = new Map<string, { at: number; entries: CodeIndexEntry[] }>()
  private readonly file: string
  private diskLoaded = false

  constructor(file: string = codeIndexFile()) {
    this.file = file
  }

  async get(dirs: readonly WorkspaceRef[]): Promise<CodeIndexEntry[]> {
    const active = dirs.filter(d => (d.access ?? 'readwrite') !== 'disabled')
    const parts: string[] = []
    for (const d of active) {
      let mtime = -1
      try {
        mtime = (await stat(d.path)).mtimeMs
      } catch {
        mtime = -1
      }
      parts.push(d.path + '@' + mtime)
    }
    const key = parts.join('|')
    const hit = this.cache.get(key)
    if (hit !== undefined && Date.now() - hit.at < CodeIndexCache.TTL_MS) return hit.entries
    if (!this.diskLoaded) {
      this.diskLoaded = true
      const disk = await this.loadDisk()
      if (disk !== undefined && disk.signature === key && Date.now() - disk.at < CodeIndexCache.TTL_MS) {
        this.cache.set(key, { at: disk.at, entries: disk.entries })
        return disk.entries
      }
    }
    const value = await buildCodeIndex(active)
    this.cache.clear()
    this.cache.set(key, { at: Date.now(), entries: value })
    await this.saveDisk({ signature: key, at: Date.now(), entries: value })
    return value
  }

  clear(): void {
    this.cache.clear()
  }

  private async loadDisk(): Promise<PersistedCodeIndex | undefined> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.file, 'utf8'))
      if (parsed === null || typeof parsed !== 'object') return undefined
      const record = parsed as Record<string, unknown>
      if (typeof record.signature !== 'string' || typeof record.at !== 'number' || !Array.isArray(record.entries)) return undefined
      const entries = record.entries.filter((item): item is CodeIndexEntry => {
        if (item === null || typeof item !== 'object') return false
        const entry = item as Record<string, unknown>
        return typeof entry.feature === 'string' && typeof entry.endpoint === 'string'
      })
      return { signature: record.signature, at: record.at, entries }
    } catch {
      return undefined
    }
  }

  private async saveDisk(payload: PersistedCodeIndex): Promise<void> {
    try {
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 })
      const tmp = this.file + '.' + process.pid + '.tmp'
      await writeFile(tmp, JSON.stringify(payload), { mode: 0o600 })
      await rename(tmp, this.file)
      await chmod(this.file, 0o600).catch(() => {})
    } catch {
      // 落盘失败不影响内存索引；下次照常重建。
    }
  }
}
