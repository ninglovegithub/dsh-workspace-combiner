/**
 * 可选能力：用模型为每个功能生成一句话摘要（工作空间开启 codeIndexSummary='llm' 时）。
 *
 * 设计取舍：
 *   - 只在会话创建时按「功能签名」生成一次并缓存，避免每步/每次刷新都调用模型；
 *   - 任何失败（无 llm 服务、无默认模型、超时、输出不可解析）都静默降级——功能索引
 *     本身不依赖摘要，缺了它仍然可用；
 *   - @deepseek-ai/dsh-llm 用「变量说明符」动态 import，这样 dev 检出未安装该依赖时
 *     也能通过类型检查与构建，运行期再从 profile 的 fallback 解析。
 * @module dsh-workspace-combiner/host/codeIndexSummary
 */

import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { CodeIndexEntry } from '../core/types.ts'
import { dshHome } from '../store.ts'
import { warnIoFailure } from './fileIndex.ts'
import { runLlmText } from './llmText.ts'

const MAX_FEATURES = 24
const MAX_OUTPUT_TOKENS = 800
const TIMEOUT_MS = 20_000
const MAX_SUMMARY_CHARS = 60
/** 内存与磁盘同时保留的签名份数：A/B 工作空间交替使用时不互相覆盖。 */
const MAX_CACHED_SIGNATURES = 4

const SYSTEM = '你是代码库导航助手。根据给出的 HTTP 端点清单，为每个功能写一行中文摘要（不超过 20 字，说明它做什么）。只输出「功能名: 摘要」这样的行，不要任何多余解释。'

/** 功能签名：摘要缓存与失效判断的依据（含端点与落点，落点变化即失效）。 */
export function codeIndexSignature(entries: readonly CodeIndexEntry[]): string {
  return entries.map(e => [e.feature, e.endpoint, e.server?.file ?? '', e.server?.line ?? '', e.client?.file ?? '', e.client?.line ?? ''].join('@')).join('|')
}

/**
 * 生成功能摘要（失败返回空 Map）。
 * @param ctx - 宿主上下文（用于 ctx.get('llm') / ctx.get('agentDefaultModel')）。
 * @param sessionId - 归属会话 id（模型调用归属）。
 * @param entries - 待摘要的功能条目。
 */
export async function summarizeFeatures(ctx: Context, sessionId: string, entries: readonly CodeIndexEntry[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (entries.length === 0) return out
  const subset = entries.slice(0, MAX_FEATURES)
  const list = subset
    .map(e => [e.feature, e.endpoint, e.server === undefined ? '' : 'server ' + e.server.file, e.client === undefined ? '' : 'client ' + e.client.file].filter(s => s !== '').join(' | '))
    .join('\n')
  const result = await runLlmText(ctx, {
    system: SYSTEM,
    userText: list,
    sessionId,
    maxTokens: MAX_OUTPUT_TOKENS,
    purpose: 'workspace-combiner-code-index-summary',
    timeoutMs: TIMEOUT_MS,
  })
  if (!result.ok) {
    ctx.logger?.warn('[dsh-workspace-combiner] feature summary skipped:', result.error)
    return out
  }
  const text = result.text
  const known = new Set(subset.map(e => e.feature))
  for (const line of text.split('\n')) {
    const match = /^\s*(?:[-*]\s*)?([^:：|]+?)\s*[:：]\s*(.+?)\s*$/.exec(line)
    if (match === null) continue
    const feature = match[1].trim()
    if (known.has(feature)) out.set(feature, match[2].trim().slice(0, MAX_SUMMARY_CHARS))
  }
  return out
}

/** 功能摘要落盘文件（跨重启复用，避免重复花 token 生成）。 */
export function featureSummaryFile(): string {
  return join(dshHome(), 'dsh-workspace-combiner-feature-summaries.json')
}

/** 落盘形状（v1 单签名，兼容旧文件；v2 为多签名列表）。 */
interface PersistedSummaries {
  signature: string
  at: number
  summaries: Record<string, string>
}

interface PersistedSummariesV2 {
  version: 2
  entries: PersistedSummaries[]
}

/** 内存里的一个签名条目。 */
interface CachedSummaries {
  at: number
  summaries: Map<string, string>
}

/**
 * 功能摘要缓存：按签名各存一份（LRU，上限 maxSignatures）。
 * 查找顺序 = 进程内存 → 磁盘（跨重启）→ 调模型生成；生成结果落盘（失败告警一次）。
 * ensure() 并发去重按签名分开：不同工作空间各自生成，不会串味，也不重复花 token。
 */
export class FeatureSummaryCache {
  private readonly file: string
  private readonly maxSignatures: number
  /** signature -> 摘要；Map 插入顺序即最近使用顺序（LRU）。 */
  private readonly entries = new Map<string, CachedSummaries>()
  /** 首次读盘的共享 promise（旧实现用布尔位会在并发首读时返回空缓存）。 */
  private loading: Promise<void> | undefined
  /** 同一签名的并发生成去重。 */
  private readonly pending = new Map<string, Promise<Map<string, string>>>()

  constructor(file: string = featureSummaryFile(), maxSignatures: number = MAX_CACHED_SIGNATURES) {
    this.file = file
    this.maxSignatures = Math.max(1, Math.floor(maxSignatures))
  }

  /** 按签名取摘要（内存/磁盘）；未命中返回 undefined。 */
  async get(signature: string): Promise<Map<string, string> | undefined> {
    await this.loadOnce()
    const hit = this.entries.get(signature)
    if (hit === undefined || hit.summaries.size === 0) return undefined
    this.touch(signature)
    return hit.summaries
  }

  /** 命中则直接返回；否则调用 generate（同签名并发去重），非空结果落盘。 */
  async ensure(signature: string, generate: () => Promise<Map<string, string>>): Promise<Map<string, string>> {
    const cached = await this.get(signature)
    if (cached !== undefined) return cached
    const running = this.pending.get(signature)
    if (running !== undefined) return await running
    const task = (async (): Promise<Map<string, string>> => {
      const generated = await generate()
      if (generated.size > 0) {
        this.remember(signature, generated)
        await this.saveDisk()
      }
      return generated
    })()
    this.pending.set(signature, task)
    try {
      return await task
    } finally {
      if (this.pending.get(signature) === task) this.pending.delete(signature)
    }
  }

  /** 写入并按 LRU 淘汰（过期由签名本身判定，这里只控份数）。 */
  private remember(signature: string, summaries: Map<string, string>, at: number = Date.now()): void {
    if (summaries.size === 0) return
    this.entries.delete(signature)
    this.entries.set(signature, { at, summaries })
    while (this.entries.size > this.maxSignatures) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.entries.delete(oldest)
    }
  }

  /** 命中后移到末尾（最近使用）。 */
  private touch(signature: string): void {
    const hit = this.entries.get(signature)
    if (hit === undefined) return
    this.entries.delete(signature)
    this.entries.set(signature, hit)
  }

  private async loadOnce(): Promise<void> {
    if (this.loading === undefined) this.loading = this.load()
    await this.loading
  }

  /** 首次读盘：v1 单签名与 v2 多签名都能读。 */
  private async load(): Promise<void> {
    const records = await this.loadDisk()
    if (records === undefined) return
    for (const record of records) this.remember(record.signature, new Map(Object.entries(record.summaries)), record.at)
  }

  private async loadDisk(): Promise<PersistedSummaries[] | undefined> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.file, 'utf8'))
      if (parsed === null || typeof parsed !== 'object') return undefined
      const record = parsed as Record<string, unknown>
      const raw: unknown[] = Array.isArray(record.entries) ? record.entries : [record]
      const out: PersistedSummaries[] = []
      for (const item of raw) {
        if (item === null || typeof item !== 'object') continue
        const entry = item as Record<string, unknown>
        if (typeof entry.signature !== 'string' || entry.summaries === null || typeof entry.summaries !== 'object') continue
        const summaries: Record<string, string> = {}
        for (const [key, value] of Object.entries(entry.summaries as Record<string, unknown>)) {
          if (typeof value === 'string') summaries[key] = value
        }
        out.push({ signature: entry.signature, at: typeof entry.at === 'number' ? entry.at : 0, summaries })
      }
      return out.length === 0 ? undefined : out
    } catch (error) {
      // 首次运行没有缓存文件（ENOENT）属正常；损坏/不可读要能看见。
      warnIoFailure('feature-summaries', this.file, error)
      return undefined
    }
  }

  private async saveDisk(): Promise<void> {
    try {
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 })
      const payload: PersistedSummariesV2 = {
        version: 2,
        entries: [...this.entries].map(([signature, entry]) => ({ signature, at: entry.at, summaries: Object.fromEntries(entry.summaries) })),
      }
      const tmp = this.file + '.' + process.pid + '.' + Math.random().toString(36).slice(2, 8) + '.tmp'
      await writeFile(tmp, JSON.stringify(payload), { mode: 0o600 })
      await rename(tmp, this.file)
      await chmod(this.file, 0o600).catch(() => {})
    } catch (error) {
      // 落盘失败不影响本次使用，但要能看见。
      warnIoFailure('feature-summaries', this.file, error)
    }
  }
}
