/**
 * 宿主侧最简 LLM 文本调用：解析默认模型 → ctx.llm.stream → 汇总纯文本。
 *
 * 关键语义：dsh-llm 的 stream() 在适配器/鉴权/网络失败时**不抛异常**，而是以终态
 * finish(reason.kind === 'error' | 'aborted' | ...) 分片结束。因此这里必须检查 finish，
 * 否则会把失败当成「模型没输出」。所有失败都转成可读的 error 文本，供 UI 展示。
 *
 * @deepseek-ai/dsh-llm 用「变量说明符」动态 import：dev 检出未安装该依赖时也能通过
 * 类型检查与构建；运行期从 profile 的 fallback 解析。
 * @module dsh-workspace-combiner/host/llmText
 */

import type { Context } from '@deepseek-ai/cordis'
import { PLUGIN_ID } from '../invariant.ts'

/** 动态 import 的说明符（声明为 string，避免 TS 解析不到依赖而报错）。 */
const LLM_MODULE: string = '@deepseek-ai/dsh-llm'

interface FinishReason {
  kind?: string
  failure?: { message?: string; code?: string }
}
interface LlmModule {
  createUserMessage: (input: unknown) => unknown
  BlockAssembler: new () => {
    push(chunk: unknown): void
    blocks(): Array<{ type: string; text?: string }>
    finish?: FinishReason
  }
}
interface LlmService {
  stream(options: Record<string, unknown>): AsyncIterable<unknown>
}
interface DefaultModelService {
  currentSelection(): { provider?: string; model?: string } | undefined
}

/** 一次文本生成请求。 */
export interface LlmTextRequest {
  system: string
  userText: string
  maxTokens: number
  /** 模型调用归属的会话 id（可缺省）。 */
  sessionId?: string
  purpose: string
  timeoutMs?: number
}

/** 生成结果：成功带文本，失败带可读原因。 */
export type LlmTextOutcome =
  | { ok: true; text: string }
  | { ok: false; error: string }

/**
 * 用默认模型生成纯文本。
 * @param ctx - 宿主上下文（用于 ctx.get('llm') / ctx.get('agentDefaultModel')）。
 * @param request - 系统提示、用户输入与限额。
 * @returns 成功/失败结果（失败含可读原因）。
 */
export async function runLlmText(ctx: Context, request: LlmTextRequest): Promise<LlmTextOutcome> {
  const llm = ctx.get('llm') as LlmService | undefined
  if (llm === undefined || typeof llm.stream !== 'function') {
    return { ok: false, error: 'llm 服务不可用（ctx.get("llm") 为空）' }
  }
  const model = ctx.get('agentDefaultModel') as DefaultModelService | undefined
  const selection = model?.currentSelection()
  if (selection?.provider === undefined || selection.model === undefined) {
    return { ok: false, error: '默认模型未配置（agentDefaultModel 没有 provider/model）' }
  }

  let mod: LlmModule
  try {
    mod = await import(LLM_MODULE) as LlmModule
  } catch (error) {
    ctx.logger?.warn('[dsh-workspace-combiner] cannot load @deepseek-ai/dsh-llm:', error)
    return { ok: false, error: '无法加载 @deepseek-ai/dsh-llm：' + (error instanceof Error ? error.message : String(error)) }
  }

  try {
    const messages = [mod.createUserMessage({
      content: [{ type: 'text', text: request.userText }],
      source: { kind: 'plugin', plugin: PLUGIN_ID },
    })]
    const assembler = new mod.BlockAssembler()
    const options: Record<string, unknown> = {
      provider: selection.provider,
      model: selection.model,
      messages,
      system: request.system,
      maxTokens: request.maxTokens,
      purpose: request.purpose,
      signal: AbortSignal.timeout(request.timeoutMs ?? 20_000),
    }
    if (request.sessionId !== undefined && request.sessionId !== '') options.sessionId = request.sessionId
    for await (const chunk of llm.stream(options)) assembler.push(chunk)

    const finish: FinishReason | undefined = assembler.finish
    if (finish !== undefined && finish.kind !== undefined && finish.kind !== 'stop') {
      const detail = finish.failure?.message ?? finish.failure?.code ?? finish.kind
      ctx.logger?.warn('[dsh-workspace-combiner] llm finish:', selection.provider, selection.model, finish.kind, detail)
      return { ok: false, error: '模型调用未成功（' + finish.kind + '）：' + detail }
    }

    const text = assembler.blocks().filter(block => block.type === 'text').map(block => block.text ?? '').join('\n').trim()
    if (text === '') return { ok: false, error: '模型未返回任何文本（finish=' + (finish?.kind ?? 'unknown') + '）' }
    return { ok: true, text }
  } catch (error) {
    ctx.logger?.warn('[dsh-workspace-combiner] llm text call threw:', error)
    return { ok: false, error: '模型调用异常：' + (error instanceof Error ? error.message : String(error)) }
  }
}
