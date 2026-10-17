/**
 * 新建工作空间向导的默认值。
 *
 * 主目录保存位置（base 路径）以前必须每次手点原生目录选择器才能「下一步」。
 * 这里给出一个**预填值**：优先用上次创建时用过的位置，其次用已有工作空间主目录
 * 的父目录（多数人把工作空间并排放在同一个父目录下），最后才留空让用户自己选。
 *
 * @module dsh-workspace-combiner/client/panel/defaults
 */

import type { Workspace } from '../../core/types.ts'

/** 上次创建时用过的保存位置（浏览器本地，按 profile 隔离）。 */
const LAST_BASE_KEY = 'dsh-workspace-combiner:lastBasePath'

/**
 * 读取上次用过的保存位置。
 * @returns 上次的路径；从未用过或本地存储不可用时返回 null。
 */
export function readLastBasePath(): string | null {
  try {
    const raw = globalThis.localStorage?.getItem(LAST_BASE_KEY)
    if (typeof raw !== 'string') return null
    const trimmed = raw.trim()
    return trimmed === '' ? null : trimmed
  } catch {
    // 隐私模式 / 存储被禁用：当作没有默认值即可，不影响主流程。
    return null
  }
}

/**
 * 记住这次用的保存位置，供下次预填。
 * @param path - 用户最后确认的 base 路径。
 */
export function rememberBasePath(path: string): void {
  const trimmed = path.trim()
  if (trimmed === '') return
  try {
    globalThis.localStorage?.setItem(LAST_BASE_KEY, trimmed)
  } catch {
    // 写失败只是少了个默认值，不打断创建流程。
  }
}

/**
 * 取父目录。同时支持 `/` 与 `\`，路径末尾的分隔符会被忽略。
 * @param path - 任意绝对路径。
 * @returns 父目录；无法再上溯时返回空串。
 */
export function parentDir(path: string): string {
  const trimmed = path.trim().replace(/[\\/]+$/, '')
  if (trimmed === '') return ''
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  if (cut < 0) return ''
  const head = trimmed.slice(0, cut)
  // 根目录本身（'/x' → '/'）：保留开头的分隔符，不要退化成空串。
  if (head === '') return trimmed.slice(0, 1)
  // Windows 盘符（'C:\x' → 'C:\'）：把分隔符补回去。
  if (/^[A-Za-z]:$/.test(head)) return head + trimmed[cut]
  return head
}

/**
 * 推导新建向导的默认保存位置。
 *
 * 优先级：上次用过 → 当前工作空间主目录的父目录 → 任一工作空间主目录的父目录 → 空。
 * @param workspaces - 已知工作空间列表。
 * @param currentWorkspaceId - 当前工作空间 id（可为 null）。
 * @returns 预填用的 base 路径；没有任何线索时返回空串（此时仍需用户自己选）。
 */
export function deriveDefaultBasePath(workspaces: readonly Workspace[], currentWorkspaceId: string | null): string {
  const last = readLastBasePath()
  if (last !== null) return last

  const mainOf = (workspace: Workspace | undefined): string => workspace?.directories[0]?.path ?? ''
  const current = workspaces.find(w => w.id === currentWorkspaceId)
  const currentParent = parentDir(mainOf(current))
  if (currentParent !== '') return currentParent

  for (const workspace of workspaces) {
    const parent = parentDir(mainOf(workspace))
    if (parent !== '') return parent
  }
  return ''
}

/**
 * 拼接 base 与文件夹名（用于向导里预览最终主目录）。
 * @param base - 保存位置。
 * @param name - 文件夹名。
 * @returns 拼接后的路径；base 为空时直接返回 name。
 */
export function joinPath(base: string, name: string): string {
  const head = base.trim().replace(/[\\/]+$/, '')
  const tail = name.trim().replace(/^[\\/]+/, '')
  if (head === '') return tail
  if (tail === '') return head
  // 反斜杠路径（Windows）沿用反斜杠，其余一律用正斜杠。
  const sep = head.includes('\\') && !head.includes('/') ? '\\' : '/'
  return head + sep + tail
}
