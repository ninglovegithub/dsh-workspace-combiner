/**
 * 上下文监控：估算注入 prompt 的 token 规模 + 各目录文件统计。
 * @module dsh-workspace-combiner/host/contextStats
 */

import type { ContextStats, DirectoryContextStat, LoadMode, WorkspaceMode, WorkspaceRef } from '../core/types.ts'
import { countNodes, type FileIndexCache } from './fileIndex.ts'
import { renderFileIndex, renderMultiWorkspacePrompt } from '../prompt.ts'

/** 粗略 token 估算：CJK 字符约 1 字符≈1 token，其余约 4 字符≈1 token。 */
export function estimateTokens(text: string): number {
  let cjk = 0
  let other = 0
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3000 && code <= 0x303f) || (code >= 0xff00 && code <= 0xffef)) cjk++
    else other++
  }
  return Math.ceil(cjk + other / 4)
}

/** 计算当前工作区的上下文统计（文件树走 mtime 缓存）。 */
export async function computeContextStats(
  directories: readonly WorkspaceRef[],
  mode: WorkspaceMode,
  loadMode: LoadMode,
  fileIndexCache: FileIndexCache,
): Promise<ContextStats> {
  const stats: DirectoryContextStat[] = []
  let totalFiles = 0
  let totalDirs = 0
  let fileIndexTokens = 0
  for (const dir of directories) {
    const access = dir.access ?? 'readwrite'
    if (access === 'disabled') continue
    const tree = await fileIndexCache.get(dir.path, { maxDepth: loadMode === 'full' ? 4 : loadMode === 'tree' ? 3 : 1 })
    const { files, dirs } = countNodes(tree)
    const tokens = estimateTokens(renderFileIndex([{ name: dir.name, path: dir.path, tree }], loadMode))
    totalFiles += files
    totalDirs += dirs
    fileIndexTokens += tokens
    stats.push({ name: dir.name, path: dir.path, access, files, dirs, tokens })
  }
  const promptOverheadTokens = estimateTokens(renderMultiWorkspacePrompt(directories, mode, loadMode, []))
  return { loadMode, directories: stats, totalFiles, totalDirs, fileIndexTokens, promptOverheadTokens }
}
