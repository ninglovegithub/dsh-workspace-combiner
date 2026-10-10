/**
 * 工作空间名与目录路径的规范化/查重。
 *
 * 目录路径的最终权威在宿主（store 用 node:path resolve 后落盘并去重），这里做的是
 * **平台无关的尽力而为**：让面板在加入前就能发现「同一目录写了两次」，
 * 避免列表里先出现重复行、等下一次 getState 才被宿主悄悄合并。
 * @module dsh-workspace-combiner/client/panel/naming
 */

import { DEFAULT_WORKSPACE_NAME } from '../../invariant.ts'
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
  const base = sanitizeWorkspaceName(name) || DEFAULT_WORKSPACE_NAME
  const taken = new Set(existing.filter(w => w.id !== excludeId).map(w => w.name))
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(base + ' (' + i + ')')) i++
  return base + ' (' + i + ')'
}

/**
 * 目录路径的展示级规范化：去首尾空白、折叠重复分隔符、去尾部分隔符。
 * 不做绝对化与 `..` 归一（那是宿主 node:path 的职责，客户端拿不到平台信息）。
 * @param path - 用户输入或宿主返回的路径。
 * @returns 规范化后的路径；空输入返回空串。
 */
export function normalizeDirectoryPath(path: string): string {
  const trimmed = path.trim()
  if (trimmed === '') return ''
  // 保留 UNC 前缀原样（\\server\share），只折叠其余位置的重复分隔符。
  const prefix = /^[\\/]{2}/.exec(trimmed)?.[0] ?? ''
  const body = prefix === '' ? trimmed : trimmed.slice(prefix.length)
  const collapsed = prefix + body.replace(/([\\/])[\\/]+/g, '$1')
  const stripped = collapsed.replace(/[\\/]+$/, '')
  if (stripped === '') return collapsed
  // Windows 盘根 'C:\' 去掉尾分隔符会变成没有意义的 'C:'，补回分隔符。
  if (/^[a-zA-Z]:$/.test(stripped)) return stripped + '\\'
  return stripped
}

/**
 * 路径比较键：去掉尾部分隔符、折叠重复分隔符，Windows 形式的路径大小写不敏感。
 * 与 core/validate.ts 的 normalizePathKey 同语义（宿主对请求体去重用的是那一份）。
 * @param path - 目录路径。
 */
export function pathKey(path: string): string {
  const stripped = path.replace(/[\\/]+$/, '').replace(/([\\/])[\\/]+/g, '$1')
  const key = stripped === '' ? path : stripped
  return /^[a-zA-Z]:/.test(key) ? key.toLowerCase() : key
}
