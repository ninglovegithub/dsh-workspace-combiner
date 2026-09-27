/**
 * 会话 token 用量统计：从 session/event 的 assistant/message 采样 provider 上报的
 * 真实用量（含提示词缓存读/写），供面板显示「这个工作空间真实烧了多少」。
 *
 * 只采样 assistant/message：它是 SDK 的结算样本（dsh-token-meter 的 usageOf 主分支
 * 同样优先取它）；assistant/attempt 只在流里带用量，计入会与结算样本重复。重试时
 * 同一 turn/step 的结算样本按「同槽位替换」而非累加，与 dsh-token-meter 语义一致。
 * @module dsh-workspace-combiner/host/tokenUsage
 */

import type { TokenUsageSample, TokenUsageSummary } from '../core/types.ts'

/** 会话事件回调里的最小会话形状（requestContext 可选，用于取上下文容量）。 */
export interface TrackedSession {
  id: string
  requestContext?(): { contextWindow?: number } | undefined
}

/**
 * session/event 回调里的最小事件形状。data 声明为 unknown 而非窄对象：
 * cordis 的事件参数按逆变检查，过窄的 data 会让真实 SessionEvent 无法赋入
 * （弱类型检测），这里只做结构访问并在读取处显式收窄。
 */
export interface TrackedEvent {
  type?: string
  data?: unknown
}

/** 从事件 data 里取 turn/step/usage 的结构视图。 */
function dataOf(event: TrackedEvent): { turn?: unknown; step?: unknown; usage?: unknown } {
  const data = event.data
  return data !== null && typeof data === 'object' ? data as { turn?: unknown; step?: unknown; usage?: unknown } : {}
}

/** 单会话折叠状态。 */
interface Fold {
  steps: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  /** 最近一次结算样本的槽位键（turn/step）。 */
  slotKey: string
  /** 该槽位已计入的样本（重试替换时要先扣掉）。 */
  slot: TokenUsageSample
  /** 最近一次样本的 prompt 侧总量（≈ 当前上下文占用）。 */
  promptTokens: number
  /** 会话上下文容量（若 SDK 提供）。 */
  contextWindow?: number
}

/** 空样本。 */
const ZERO: TokenUsageSample = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }

/** 非负整数读取（provider 字段缺失或非法时返回 0）。 */
function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

/** 从事件里读出一条结算样本；不是 assistant/message 或没有 usage 时返回 undefined。 */
function readSample(event: TrackedEvent): TokenUsageSample | undefined {
  if (event.type !== 'assistant/message') return undefined
  const usage = dataOf(event).usage
  if (usage === null || typeof usage !== 'object') return undefined
  const record = usage as Record<string, unknown>
  // inputTokens 是「未命中缓存」的输入（与 dsh-token-meter 的 uncachedInputTokens 同义）。
  if (record.inputTokens === undefined && record.outputTokens === undefined) return undefined
  return {
    inputTokens: count(record.inputTokens),
    outputTokens: count(record.outputTokens),
    cacheReadTokens: count(record.cacheReadTokens),
    cacheWriteTokens: count(record.cacheWriteTokens),
  }
}

/** 槽位键：同一 turn/step 的多次结算视为同一槽（重试替换）。 */
function slotKeyOf(event: TrackedEvent): string {
  const turn = dataOf(event).turn
  const step = dataOf(event).step
  if (typeof turn !== 'number' || typeof step !== 'number') return ''
  return turn + '/' + step
}

/** 把样本累加到折叠状态。 */
function addInto(fold: Fold, sample: TokenUsageSample, sign: number): void {
  fold.inputTokens = Math.max(0, fold.inputTokens + sign * sample.inputTokens)
  fold.outputTokens = Math.max(0, fold.outputTokens + sign * sample.outputTokens)
  fold.cacheReadTokens = Math.max(0, fold.cacheReadTokens + sign * sample.cacheReadTokens)
  fold.cacheWriteTokens = Math.max(0, fold.cacheWriteTokens + sign * sample.cacheWriteTokens)
}

/** 由折叠状态生成对外汇总。 */
function summarizeFold(fold: Fold): TokenUsageSummary {
  const promptTokens = fold.inputTokens + fold.cacheReadTokens + fold.cacheWriteTokens
  return {
    steps: fold.steps,
    inputTokens: fold.inputTokens,
    outputTokens: fold.outputTokens,
    cacheReadTokens: fold.cacheReadTokens,
    cacheWriteTokens: fold.cacheWriteTokens,
    promptTokens,
    cacheHitRate: promptTokens > 0 ? fold.cacheReadTokens / promptTokens : null,
  }
}

/**
 * 会话 token 用量跟踪器：内存态，进程重启即清空（用量属于本机瞬时观测，不落盘）。
 */
export class TokenUsageTracker {
  private readonly bySession = new Map<string, Fold>()
  private lastSessionId = ''

  /** 观察一条会话事件（非结算样本自动忽略）。 */
  observe(session: TrackedSession, event: TrackedEvent): void {
    this.lastSessionId = session.id
    let fold = this.bySession.get(session.id)
    if (fold === undefined) {
      fold = { steps: 0, ...ZERO, slotKey: '', slot: ZERO, promptTokens: 0 }
      this.bySession.set(session.id, fold)
    }
    // 容量不作为样本条件：即使某步没有 usage，也要能显示占用条。
    const window = session.requestContext?.()?.contextWindow
    if (typeof window === 'number' && window > 0) fold.contextWindow = window

    const sample = readSample(event)
    if (sample === undefined) return
    const key = slotKeyOf(event)
    if (key !== '' && fold.slotKey === key) addInto(fold, fold.slot, -1)
    else fold.steps++
    addInto(fold, sample, 1)
    fold.slotKey = key
    fold.slot = sample
    fold.promptTokens = sample.inputTokens + sample.cacheReadTokens + sample.cacheWriteTokens
  }

  /** 汇总给定会话的用量（列表为空或全部无样本时返回零值汇总）。 */
  summarize(sessionIds: readonly string[]): TokenUsageSummary {
    const total: Fold = { steps: 0, ...ZERO, slotKey: '', slot: ZERO, promptTokens: 0 }
    for (const id of sessionIds) {
      const fold = this.bySession.get(id)
      if (fold === undefined) continue
      total.steps += fold.steps
      addInto(total, fold, 1)
    }
    return summarizeFold(total)
  }

  /** 最近一次观察到事件的会话 id（没有任何事件时为空串）。 */
  latestSessionId(): string {
    return this.lastSessionId
  }

  /** 指定会话的上下文占用（无样本时为 null）。 */
  latestOf(sessionId: string): { contextWindow?: number; promptTokens: number } | null {
    const fold = this.bySession.get(sessionId)
    if (fold === undefined || fold.promptTokens <= 0) return null
    return { ...(fold.contextWindow === undefined ? {} : { contextWindow: fold.contextWindow }), promptTokens: fold.promptTokens }
  }

  /** 会话销毁时清理。 */
  forget(sessionId: string): void {
    this.bySession.delete(sessionId)
    if (this.lastSessionId === sessionId) this.lastSessionId = ''
  }
}
