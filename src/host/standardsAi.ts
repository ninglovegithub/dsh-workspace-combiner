/**
 * 可选能力：用模型起草一份开发规范（弹窗里点「用 AI 生成」时调用）。
 * 失败/不可用返回 undefined，由 UI 提示，不影响手动编辑。
 * @module dsh-workspace-combiner/host/standardsAi
 */

import type { Context } from '@deepseek-ai/cordis'
import { runLlmText, type LlmTextOutcome } from './llmText.ts'

const TIMEOUT_MS = 25_000
const MAX_OUTPUT_TOKENS = 800

const SYSTEM = [
  '你是资深工程师，负责编写给 AI 编码助手使用的开发规范。',
  '输出 markdown 列表：每行以 "- " 开头，共 12-18 条。',
  '覆盖：命名约定、目录与分层、错误处理、日志、事务/并发、配置与密钥、测试要求、接口与兼容性（按技术栈取舍）。',
  '每条一句话、可执行、具体；不要输出标题、解释、代码块或前后缀。',
].join('')

/** 起草请求。 */
export interface StandardDraftRequest {
  name: string
  tech: string
  /** 目标目录名（可选，用于结合项目上下文）。 */
  directory?: string
  /** 用户补充要求（可选）。 */
  hint?: string
}

/**
 * 起草一份规范正文。
 * @param ctx - 宿主上下文。
 * @param request - 规范名、技术栈与可选补充。
 * @returns 生成的正文；失败返回 undefined。
 */
export async function generateStandardDraft(ctx: Context, request: StandardDraftRequest): Promise<LlmTextOutcome> {
  const lines = ['规范名称：' + request.name, '技术栈：' + request.tech]
  if (request.directory !== undefined && request.directory !== '') lines.push('目标项目目录：' + request.directory)
  if (request.hint !== undefined && request.hint.trim() !== '') lines.push('额外要求：' + request.hint.trim())
  return await runLlmText(ctx, {
    system: SYSTEM,
    userText: lines.join('\n'),
    maxTokens: MAX_OUTPUT_TOKENS,
    purpose: 'workspace-combiner-standards-draft',
    timeoutMs: TIMEOUT_MS,
  })
}
