/**
 * 诊断报告的纯工具：汇总状态与复制前脱敏。
 * @module dsh-workspace-combiner/core/diagnostics
 */

import type { DiagnosticItem, DiagnosticStatus } from './types.ts'

export function summarizeDiagnostics(items: readonly DiagnosticItem[]): Record<DiagnosticStatus, number> {
  return items.reduce<Record<DiagnosticStatus, number>>((summary, item) => {
    summary[item.status]++
    return summary
  }, { ok: 0, warning: 0, error: 0, unknown: 0 })
}

/** 复制诊断报告前隐藏用户名、常见密钥和认证头。 */
export function redactDiagnosticText(text: string): string {
  return text
    .replace(/\/Users\/[^/\s]+/g, '/Users/<user>')
    .replace(/\/home\/[^/\s]+/g, '/home/<user>')
    .replace(/([A-Za-z]:\\Users\\)[^\\\s]+/gi, '$1<user>')
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{8,}|AIza[A-Za-z0-9_-]{8,})\b/g, '<redacted-key>')
    .replace(/((?:api[_-]?key|token|secret|authorization)\s*[:=]\s*)(?:bearer\s+)?[^\s,;]+/gi, '$1<redacted>')
}
