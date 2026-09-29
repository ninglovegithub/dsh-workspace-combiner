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
import { renderCodeIndexText } from '../prompt.ts'
import { dshHome } from '../store.ts'
import type { CodeIndexEntry, CodeIndexLoc, EndpointImpact, WorkspaceRef } from '../core/types.ts'

export type { CodeIndexEntry, CodeIndexLoc, EndpointImpact }

/** 参与扫描的代码扩展名（含常见后端语言，便于跨前后端联结）。 */
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.java', '.kt', '.go', '.py', '.rb', '.cs'])
/** 真正读取内容的文件数上限（候选收集另有 MAX_CANDIDATES），防止大仓库拖慢会话创建。 */
const MAX_FILES = 5000
/**
 * 目录递归深度：Java/Go 多模块仓的控制器路径 <repo>/<module>/src/main/java/com/<org>/<pkg>/controller/
 * 本身就有 9 层，8 层会把整棵 controller 目录剪掉，索引里一条服务端落点都匹配不上。
 */
const MAX_DEPTH = 16
const MAX_FILE_BYTES = 256 * 1024
const MAX_TOTAL_BYTES = 24 * 1024 * 1024
/** 候选文件收集上限：只走目录不读内容，先收全再按优先级排序，预算才花在刀刃上。 */
const MAX_CANDIDATES = 20000
/** 条目上限：调高后仍不影响 prompt 体积（renderCodeIndex 另有 token 预算截断），但截断会吃掉已经配好前后端落点的条目。 */
const MAX_ENTRIES = 600

/** 端点字面量：引号内的 /path 形式。 */
const ENDPOINT_LITERAL = /['"`](\/[A-Za-z0-9._~\-/{}$:]+)['"`]/g
/** 形如 NAME = '/path' 或 key: '/path' 的命名端点（取匹配位置之前的前缀）。 */
const NAMED_SUFFIX = /([A-Za-z_$][\w$]*)\s*[:=]\s*$/
/** 引用令牌：.NAME 或 ['NAME']。 */
const REF_TOKEN = /\.([A-Za-z_$][\w$]*)\b|\[\s*['"]([A-Za-z_$][\w$]*)['"]\s*\]/g
/** 资源/文件扩展名，用于排除 '/a/b.png' 这类非端点。 */
const ASSET_EXT = /\.(png|jpe?g|gif|svg|ico|webp|css|scss|less|sass|woff2?|ttf|eot|map|html?|json|ya?ml|md|txt|lock|xml|vue|ts|tsx|js|jsx)$/i
/** Java 类级路由前缀（@RequestMapping("...")）。 */
const JAVA_REQUEST_MAPPING = /@RequestMapping\s*\(([^)]*)\)/
/** Java 方法级映射注解（@GetMapping 等，路径由类前缀拼接）。 */
const JAVA_METHOD_MAPPING = /@(Get|Post|Put|Patch|Delete)Mapping\b/
/** 注解里的第一个字符串字面量参数。 */
const ANNOTATION_STRING = /["']([^"']*)["']/

/**
 * 找出 Java 控制器文件里的类级路由前缀。
 *
 * 只在「文件里存在方法级映射注解」时才认定第一条 @RequestMapping 是类级前缀：
 * 否则它本身就是端点（例如只有 @RequestMapping(value=..., method=GET) 的写法），
 * 误判会把唯一端点整条吃掉。这是无 AST 的行扫描下最稳的判据。
 * @param lines - 文件按行拆分的内容。
 * @returns 前缀（已去尾斜杠）与所在行号；无法判定时返回 undefined。
 */
function findJavaClassPrefix(lines: readonly string[]): { prefix: string; line: number } | undefined {
  if (!lines.some(line => JAVA_METHOD_MAPPING.test(line))) return undefined
  for (let i = 0; i < lines.length; i++) {
    const mapping = JAVA_REQUEST_MAPPING.exec(lines[i])
    if (mapping === null) continue
    const value = ANNOTATION_STRING.exec(mapping[1])
    if (value === null) return undefined
    const prefix = value[1].replace(/\/+$/, '')
    return prefix === '' ? undefined : { prefix, line: i }
  }
  return undefined
}

/** 拼接类级前缀与方法级路径（斜杠归一，避免 //user//detail）。 */
function joinRoute(prefix: string, path: string): string {
  const head = prefix.replace(/\/+$/, '')
  const tail = path.replace(/^\/+/, '')
  if (head === '') return '/' + tail
  return tail === '' ? head : head + '/' + tail
}

/** 客户端调用线索（含 vue-router 页面路由）。 */
const CLIENT_HINT = /\b(fetch|axios|request|http|got|ky)\s*\(|\.(get|post|put|patch|delete)\s*\(|url\s*:|createRouter\s*\(|component\s*:/
/** 后端语言里真正发起 HTTP 调用的线索：Java 的 map.get()/list.get(0) 会让 CLIENT_HINT 到处命中。 */
const HTTP_CLIENT_HINT = /\b(RestTemplate|WebClient|HttpClient|OkHttpClient|okhttp3|FeignClient|HttpURLConnection|WebRequest|Net::HTTP|requests\.(get|post|put|patch|delete)|httpx\.|urllib\.request|http\.(Get|Post|Put|Delete|NewRequest)\s*\()/
/** 后端扩展名：这些文件的 client 侧用 HTTP_CLIENT_HINT 判定，其余用 CLIENT_HINT。 */
const BACKEND_EXT = /\.(java|kt|go|rb|cs|py)$/i
/** 服务端注册/处理线索（含 Java 注解与 Go/gin 的大写方法）。 */
const SERVER_HINT = /kind\s*:\s*['"]exact['"]|handler\s*:|@(Get|Post|Put|Patch|Delete|Request)Mapping|(?:router|app|server|mux|bp)\.(?:get|post|put|patch|delete|route)\s*\(|\.(?:GET|POST|PUT|PATCH|DELETE)\s*\(/
/** 路由/控制器落点路径线索：命中者优先读取，读预算不够时也不会把控制器排出队列。 */
const ROUTE_PATH = /(?:^|\/)(?:controllers?|resources?|apis?|routes?|routers?|handlers?|urls?|endpoints?|servlets?)(?:\/|$)/i
const ROUTE_FILE = /(?:Controller|Resource|Servlet)\.\w+$/i
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

/**
 * 端点匹配键：归一化占位符后，再剥掉前端代理惯用的 /api 前缀，使前端
 * '/api/user/detail' 与后端 '/user/detail' 能联结为同一功能。
 * 只剥一层 /api（可跟 /vN）——更激进的剥离会把不同端点误并。
 */
export function matchKey(endpoint: string): string {
  const normalized = normalizeEndpoint(endpoint)
  const stripped = normalized.replace(/^\/api(\/v\d+)?(?=\/|$)/, '')
  return stripped === '' || stripped === '/' ? normalized : stripped
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

/** 累积一条端点的两侧落点（含所属目录，供跨目录配对展示）。 */
function applyLoc(acc: CodeIndexEntry, file: string, line: number, server: boolean, client: boolean, dir: string): void {
  if (server && acc.server === undefined) {
    acc.server = { file, line }
    acc.serverDir = dir
  } else if (client && acc.client === undefined) {
    acc.client = { file, line }
    acc.clientDir = dir
  } else acc.refs++
}

/** 文件级反向索引：绝对文件路径 -> 该文件涉及端点的匹配键集合。 */
type FileEndpointMap = Map<string, Set<string>>

/** 记录「某文件涉及某端点」，供改动反查。 */
function touch(map: FileEndpointMap, abs: string, key: string): void {
  const set = map.get(abs)
  if (set === undefined) map.set(abs, new Set([key]))
  else set.add(key)
}

/** 排序优先级：配对的 > 只有前端调用的 > 只有服务端注册的；同档内交给功能名排序。 */
function pairingRank(entry: CodeIndexEntry): number {
  if (entry.server !== undefined && entry.client !== undefined) return 0
  // 只有前端落点的排在只有服务端之前：服务端端点数量大得多，截断时前端调用点更值得留在列表里。
  return entry.client !== undefined ? 1 : 2
}

/** 路由/控制器文件排前面（0 = 优先），其余次之；与目录顺序无关，保证大仓也能联上落点。 */
function routeRank(abs: string): number {
  return ROUTE_PATH.test(abs) || ROUTE_FILE.test(abs) ? 0 : 1
}

/** 递归收集代码文件（复用文件索引的忽略规则）。 */
async function collectCodeFiles(root: string, patterns: RegExp[]): Promise<string[]> {
  const out: string[] = []
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > MAX_DEPTH || out.length >= MAX_CANDIDATES) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      if (out.length >= MAX_CANDIDATES) return
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
  // 按优先级排序后再读内容：大仓里「先遍历到的先读」会让 controller 目录排在预算之外。
  return out.sort((a, b) => routeRank(a) - routeRank(b))
}

/** 功能索引构建结果：端点条目 + 文件级反向索引。 */
export interface CodeIndexResult {
  entries: CodeIndexEntry[]
  /** 绝对文件路径 -> 该文件涉及的端点匹配键（用于「改动文件反查端点」）。 */
  fileEndpoints: Record<string, string[]>
}

/**
 * 构建功能角度代码索引。
 * @param dirs - 工作空间的目录列表（disabled 目录跳过）。
 * @returns 端点条目（仅保留至少有一侧落点的）+ 文件到端点的反向索引。
 */
export async function buildCodeIndex(dirs: readonly WorkspaceRef[]): Promise<CodeIndexResult> {
  const names = new Map<string, string>()
  const byEndpoint = new Map<string, CodeIndexEntry>()
  const touched: FileEndpointMap = new Map()
  const files: { abs: string; dir: string; rel: string; content: string; lines: string[]; server: boolean; client: boolean }[] = []
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

  let readFiles = 0
  for (const dir of dirs) {
    if ((dir.access ?? 'readwrite') === 'disabled') continue
    const patterns = await loadGitignore(dir.path)
    for (const abs of await collectCodeFiles(dir.path, patterns)) {
      if (readFiles >= MAX_FILES || totalBytes >= MAX_TOTAL_BYTES) break
      let content = ''
      try {
        const info = await stat(abs)
        if (info.size > MAX_FILE_BYTES) continue
        content = await readFile(abs, 'utf8')
      } catch {
        continue
      }
      totalBytes += content.length
      readFiles++
      files.push({
        abs,
        dir: dir.path,
        rel: relative(dir.path, abs).split(sep).join('/'),
        content,
        lines: content.split('\n'),
        server: SERVER_HINT.test(content),
        // 后端文件里 `.get(` 遍地都是（map.get/list.get），只有真正的 HTTP 客户端才算 client 侧，
        // 否则「前端落点」会指向 Java 控制器自己。
        client: BACKEND_EXT.test(abs) ? HTTP_CLIENT_HINT.test(content) : CLIENT_HINT.test(content),
      })
    }
  }

  // 第一遍：字面量 + 命名定义。
  for (const f of files) {
    // Java 控制器：类级 @RequestMapping 是前缀而非端点，方法级映射要拼上前缀，
    // 否则后端 '/detail' 与前端 '/api/user/detail' 永远配不上。
    const javaPrefix = findJavaClassPrefix(f.lines)
    for (let i = 0; i < f.lines.length; i++) {
      const line = f.lines[i]
      const trimmed = line.trimStart()
      if (trimmed.startsWith('/') || trimmed.startsWith('*') || trimmed.startsWith('#')) continue
      // 跳过正则字面量/正则 API 行，否则会把正则源码里的 '/path' 当成端点。
      if (trimmed.includes('= /') || trimmed.includes('(/') || trimmed.includes('RegExp(')) continue
      if (javaPrefix !== undefined && i === javaPrefix.line) continue
      const methodMapping = javaPrefix !== undefined && JAVA_METHOD_MAPPING.test(line)
      ENDPOINT_LITERAL.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = ENDPOINT_LITERAL.exec(line)) !== null) {
        const endpoint = m[1]
        if (!looksLikeEndpoint(endpoint)) continue
        const effective = methodMapping ? joinRoute(javaPrefix.prefix, endpoint) : endpoint
        const key = matchKey(effective)
        const rawName = NAMED_SUFFIX.exec(line.slice(0, m.index))?.[1]
        const name = rawName !== undefined && !NAME_DENYLIST.has(rawName) ? rawName : undefined
        if (name !== undefined) names.set(name, key)
        touch(touched, f.abs, key)
        applyLoc(upsert(key, effective, name ?? deriveFeature(effective)), f.rel, i + 1, f.server, f.client, f.dir)
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
          touch(touched, f.abs, key)
          applyLoc(upsert(key, name, name), f.rel, i + 1, f.server, f.client, f.dir)
        }
      }
    }
  }

  const entries = [...byEndpoint.values()]
    .filter(entry => entry.server !== undefined || entry.client !== undefined)
    // 前后端都配上的排最前：条目受 MAX_ENTRIES 截断、prompt 注入也按顺序取，
    // 按功能名平铺会把已经配对好的条目挤掉（实测 600 条上限下只剩 163/353 组）。
    .sort((a, b) => pairingRank(a) - pairingRank(b) || a.feature.localeCompare(b.feature) || a.endpoint.localeCompare(b.endpoint))
    .slice(0, MAX_ENTRIES)
  // 只保留最终存在条目的键，避免反向索引指向被 MAX_ENTRIES 截断掉的端点。
  const kept = new Set(entries.map(entry => matchKey(entry.endpoint)))
  const fileEndpoints: Record<string, string[]> = {}
  for (const [abs, keys] of touched) {
    const alive = [...keys].filter(key => kept.has(key))
    if (alive.length > 0) fileEndpoints[abs] = alive
  }
  return { entries, fileEndpoints }
}

/**
 * 由「改动文件」反查受影响的端点：确定性查询（只查索引里该文件声明/调用的端点），
 * 不做任何语义猜测，因此不会出现「AI 预测影响」那类误报。
 * @param result - 当前工作空间的功能索引。
 * @param changed - 改动文件列表（目录绝对路径 + 相对该目录的路径）。
 * @returns 受影响的端点及其对端落点（同端点同一改动文件只出现一次）。
 */
export function findEndpointImpact(result: CodeIndexResult, changed: readonly { dir: string; file: string }[]): EndpointImpact[] {
  const byKey = new Map<string, CodeIndexEntry>()
  for (const entry of result.entries) {
    const key = matchKey(entry.endpoint)
    if (!byKey.has(key)) byKey.set(key, entry)
  }
  const out: EndpointImpact[] = []
  const seen = new Set<string>()
  for (const item of changed) {
    const abs = join(item.dir, item.file)
    const keys = result.fileEndpoints[abs]
    if (keys === undefined) continue
    for (const key of keys) {
      const entry = byKey.get(key)
      if (entry === undefined) continue
      const dedupe = key + '\u0000' + abs
      if (seen.has(dedupe)) continue
      seen.add(dedupe)
      // 对端 = 另一侧的落点：改动文件在某侧目录时，给出另一侧。
      const onServer = entry.serverDir === item.dir
      const counterpart = onServer ? entry.client : entry.server
      const counterpartDir = onServer ? entry.clientDir : entry.serverDir
      out.push({
        feature: entry.feature,
        endpoint: entry.endpoint,
        changedDir: item.dir,
        changedFile: item.file,
        ...(counterpart === undefined ? {} : { counterpart }),
        ...(counterpartDir === undefined ? {} : { counterpartDir }),
      })
    }
  }
  return out
}

/** 功能索引落盘文件（跨重启复用，避免首会话重扫全部代码）。 */
export function codeIndexFile(): string {
  return join(dshHome(), 'dsh-workspace-combiner-code-index.json')
}

/**
 * 功能索引的按需查询文件：每行一条端点，便于 grep。
 * 缓存 JSON 是单行且字符串被转义，grep 它只会吐出整行，所以另存一份纯文本。
 */
export function codeIndexTextFile(): string {
  return join(dshHome(), 'dsh-workspace-combiner-code-index.txt')
}

/** 落盘形状。 */
interface PersistedCodeIndex {
  signature: string
  at: number
  entries: CodeIndexEntry[]
  /** 文件到端点的反向索引（旧版本文件缺此字段时退化为空，不影响条目读取）。 */
  fileEndpoints: Record<string, string[]>
}

/** 空索引结果。 */
export function emptyCodeIndex(): CodeIndexResult {
  return { entries: [], fileEndpoints: {} }
}

/** 校验落盘 / 读取到的反向索引字段。 */
function parseFileEndpoints(raw: unknown): Record<string, string[]> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue
    const keys = value.filter((item): item is string => typeof item === 'string' && item !== '')
    if (keys.length > 0) out[key] = keys
  }
  return out
}

/**
 * 索引缓存：目录签名（路径 + 根 mtime）未变且未过期则复用。
 * 查找顺序 = 进程内存 → 磁盘（跨重启）→ 重新扫描；重建后异步落盘（失败静默）。
 */
export class CodeIndexCache {
  /** 缓存有效期：内容级改动不改根目录 mtime，用 TTL 兜住索引陈旧（行号漂移）。 */
  private static readonly TTL_MS = 60_000
  private readonly cache = new Map<string, { at: number; value: CodeIndexResult }>()
  private readonly file: string
  private diskLoaded = false

  constructor(file: string = codeIndexFile()) {
    this.file = file
  }

  async get(dirs: readonly WorkspaceRef[]): Promise<CodeIndexResult> {
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
    if (hit !== undefined && Date.now() - hit.at < CodeIndexCache.TTL_MS) return hit.value
    if (!this.diskLoaded) {
      this.diskLoaded = true
      const disk = await this.loadDisk()
      if (disk !== undefined && disk.signature === key && Date.now() - disk.at < CodeIndexCache.TTL_MS) {
        const value: CodeIndexResult = { entries: disk.entries, fileEndpoints: disk.fileEndpoints }
        this.cache.set(key, { at: disk.at, value })
        return value
      }
    }
    const value = await buildCodeIndex(active)
    this.cache.clear()
    this.cache.set(key, { at: Date.now(), value })
    await this.saveDisk({ signature: key, at: Date.now(), entries: value.entries, fileEndpoints: value.fileEndpoints })
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
      return { signature: record.signature, at: record.at, entries, fileEndpoints: parseFileEndpoints(record.fileEndpoints) }
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
      // 按需查询文件：不常驻上下文，只在需要定位端点时 grep。
      const textTmp = tmp + '.txt'
      await writeFile(textTmp, renderCodeIndexText(payload.entries), { mode: 0o600 })
      await rename(textTmp, codeIndexTextFile())
    } catch {
      // 落盘失败不影响内存索引；下次照常重建。
    }
  }
}
