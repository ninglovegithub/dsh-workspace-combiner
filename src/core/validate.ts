/**
 * 平台无关的输入校验：目录项（WorkspaceRef）及其数组。
 * host 落盘加载与 client 请求体校验共用同一份规则，避免两处校验漂移。
 * @module dsh-workspace-combiner/core/validate
 */

import type { WorkspaceRef } from './types.ts'

/** 校验并规范化一条目录项；缺 id/name/path 等必填字段时返回 undefined。 */
export function parseWorkspaceRef(raw: unknown): WorkspaceRef | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const ref = raw as Record<string, unknown>
  if (typeof ref.id !== 'string' || typeof ref.name !== 'string' || typeof ref.path !== 'string') return undefined
  return {
    id: ref.id,
    name: ref.name,
    path: ref.path,
    ...(typeof ref.projectType === 'string' ? { projectType: ref.projectType as WorkspaceRef['projectType'] } : {}),
    ...(typeof ref.evidence === 'string' ? { evidence: ref.evidence } : {}),
    ...(typeof ref.isPrimary === 'boolean' ? { isPrimary: ref.isPrimary } : {}),
    ...(ref.access === 'readwrite' || ref.access === 'readonly' || ref.access === 'disabled' ? { access: ref.access } : {}),
    ...(typeof ref.group === 'string' && ref.group !== '' ? { group: ref.group } : {}),
    ...(typeof ref.note === 'string' && ref.note !== '' ? { note: ref.note } : {}),
  }
}

/** 校验目录项数组：任一项非法则整体返回 undefined（请求体语义：宁可拒绝也不半接受）。 */
export function parseWorkspaceRefs(raw: unknown): WorkspaceRef[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: WorkspaceRef[] = []
  for (const item of raw) {
    const ref = parseWorkspaceRef(item)
    if (ref === undefined) return undefined
    out.push(ref)
  }
  return out
}
