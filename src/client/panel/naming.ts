import type { Workspace } from '../../core/types.ts'

/** 名称长度上限（超长截断）。 */
const MAX_NAME_LENGTH = 64

/** 过滤控制字符、去首尾空白、超长截断。 */
export function sanitizeWorkspaceName(name: string): string {
  return name
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
}

/** 全局查重：冲突则追加「 (n)」，n 从 2 递增；排除 excludeId 自身。 */
export function checkWorkspaceNameDuplicate(name: string, excludeId: string | undefined, existing: readonly Workspace[]): string {
  const base = sanitizeWorkspaceName(name) || '未命名工作空间'
  const taken = new Set(existing.filter(w => w.id !== excludeId).map(w => w.name))
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(base + ' (' + i + ')')) i++
  return base + ' (' + i + ')'
}
