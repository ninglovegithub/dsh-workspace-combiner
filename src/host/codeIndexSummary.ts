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
import { PLUGIN_ID } from '../invariant.ts'
import { dshHome } from '../store.ts'

const MAX_FEATURES = 24
const MAX_OUTPUT_TOKENS = 800
const TIMEOUT_MS = 20_000
const MAX_SUMMARY_CHARS = 60

/** 动态 import 的说明符（声明为 string，避免 TS 解析不到依赖而报错）。 */
const LLM_MODULE: string = '@deepseek-ai/dsh-llm'

interface LlmModule {
  createUserMessage: (input: unknown) => unknown
  BlockAssembler: new () => { push(chunk: unknown): void; blocks(): Array<{ type: string; text?: string }> }
}
interface LlmService {
  stream(options: Record<string, unknown>): AsyncIterable<unknown>
}
interface DefaultModelService {
  currentSelection(): { provider?: string; model?: string } | undefined
}

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
  const llm = ctx.get('llm') as LlmService | undefined
  const model = ctx.get('agentDefaultModel') as DefaultModelService | undefined
  if (llm === undefined || model === undefined) return out
  const selection = model.currentSelection()
  if (selection?.provider === undefined || selection.model === undefined) return out

  let mod: LlmModule
  try {
    mod = await import(LLM_MODULE) as LlmModule
  } catch (error) {
    ctx.logger?.warn('[dsh-workspace-combiner] cannot load @deepseek-ai/dsh-llm for feature summaries:', error)
    return out
  }

  const subset = entries.slice(0, MAX_FEATURES)
  const list = subset
    .map(e => [e.feature, e.endpoint, e.server === undefined ? '' : 'server ' + e.server.file, e.client === undefined ? '' : 'client ' + e.client.file].filter(s => s !== '').join(' | '))
    .join('\n')
  try {
    const messages = [mod.createUserMessage({ content: [{ type: 'text', text: list }], source: { kind: 'plugin', plugin: PLUGIN_ID } })]
    const assembler = new mod.BlockAssembler()
    const options = {
      provider: selection.provider,
      model: selection.model,
      messages,
      system: SYSTEM,
      maxTokens: MAX_OUTPUT_TOKENS,
      sessionId,
      purpose: 'workspace-combiner-code-index-summary',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }
    for await (const chunk of llm.stream(options)) assembler.push(chunk)
    const text = assembler.blocks().filter(b => b.type === 'text').map(b => b.text ?? '').join('\n')
    const known = new Set(subset.map(e => e.feature))
    for (const line of text.split('\n')) {
      const match = /^\s*(?:[-*]\s*)?([^:：|]+?)\s*[:：]\s*(.+?)\s*$/.exec(line)
      if (match === null) continue
      const feature = match[1].trim()
      if (known.has(feature)) out.set(feature, match[2].trim().slice(0, MAX_SUMMARY_CHARS))
    }
  } catch (error) {
    ctx.logger?.warn('[dsh-workspace-combiner] feature summary generation failed:', error)
  }
  return out
}

/** 功能摘要落盘文件（跨重启复用，避免重复花 token 生成）。 */
export function featureSummaryFile(): string {
  return join(dshHome(), 'dsh-workspace-combiner-feature-summaries.json')
}

/** 落盘形状。 */
interface PersistedSummaries {
  signature: string
  at: number
  summaries: Record<string, string>
}

/**
 * 功能摘要缓存：按签名保存最近一次结果。
 * 查找顺序 = 进程内存 → 磁盘（跨重启）→ 调模型生成；生成结果落盘（失败静默）。
 * ensure() 带并发去重：同签名的多次请求只触发一次模型调用。
 */
export class FeatureSummaryCache {
  private readonly file: string
  private signature = ''
  private summaries: Map<string, string> = new Map()
  private diskLoaded = false
  private pending: Promise<Map<string, string>> | undefined

  constructor(file: string = featureSummaryFile()) {
    this.file = file
  }

  /** 按签名取摘要（内存/磁盘）；未命中返回 undefined。 */
  async get(signature: string): Promise<Map<string, string> | undefined> {
    if (!this.diskLoaded) {
      this.diskLoaded = true
      const disk = await this.loadDisk()
      if (disk !== undefined) {
        this.signature = disk.signature
        this.summaries = new Map(Object.entries(disk.summaries))
      }
    }
    return signature === this.signature && this.summaries.size > 0 ? this.summaries : undefined
  }

  /** 命中则直接返回；否则调用 generate（并发去重），非空结果落盘。 */
  async ensure(signature: string, generate: () => Promise<Map<string, string>>): Promise<Map<string, string>> {
    const cached = await this.get(signature)
    if (cached !== undefined) return cached
    if (this.pending !== undefined) return await this.pending
    const task = (async (): Promise<Map<string, string>> => {
      const generated = await generate()
      if (generated.size > 0) {
        this.signature = signature
        this.summaries = generated
        await this.saveDisk()
      }
      return generated
    })()
    this.pending = task
    try {
      return await task
    } finally {
      this.pending = undefined
    }
  }

  private async loadDisk(): Promise<PersistedSummaries | undefined> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.file, 'utf8'))
      if (parsed === null || typeof parsed !== 'object') return undefined
      const record = parsed as Record<string, unknown>
      if (typeof record.signature !== 'string' || record.summaries === null || typeof record.summaries !== 'object') return undefined
      const summaries: Record<string, string> = {}
      for (const [key, value] of Object.entries(record.summaries as Record<string, unknown>)) {
        if (typeof value === 'string') summaries[key] = value
      }
      return { signature: record.signature, at: typeof record.at === 'number' ? record.at : 0, summaries }
    } catch {
      return undefined
    }
  }

  private async saveDisk(): Promise<void> {
    try {
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 })
      const payload: PersistedSummaries = { signature: this.signature, at: Date.now(), summaries: Object.fromEntries(this.summaries) }
      const tmp = this.file + '.' + process.pid + '.tmp'
      await writeFile(tmp, JSON.stringify(payload), { mode: 0o600 })
      await rename(tmp, this.file)
      await chmod(this.file, 0o600).catch(() => {})
    } catch {
      // 落盘失败不影响本次使用。
    }
  }
}
