/**
 * 上下文监控：估算注入 prompt 的 token 规模 + 各目录文件统计。
 * @module dsh-workspace-combiner/host/contextStats
 */

import { loadModeMaxDepth, type CodeIndexEntry, type ContextStats, type DirectoryContextStat, type LoadMode, type WorkspaceMode, type WorkspaceRef } from '../core/types.ts'
import { estimateTokens, type FileIndexEntry } from '../core/fileTree.ts'
import type { FileIndexCache } from './fileIndex.ts'
import type { CodeIndexCache } from './codeIndex.ts'
import { renderFileIndex, renderMultiWorkspacePrompt } from '../prompt.ts'

/** 功能索引在统计中的配置（与宿主注入保持一致）。 */
export interface CodeIndexStatsConfig {
  enabled: boolean
  budget: number
  /** 已生成的功能摘要（可选，命中签名才有）。 */
  summaries?: Map<string, string>
}

/**
 * 计算当前工作区的上下文统计（文件树走 mtime 缓存）。
 * @param tokenBudget - 与注入 prompt 使用同一预算，保证统计值与实际注入一致。
 */
export async function computeContextStats(
  directories: readonly WorkspaceRef[],
  mode: WorkspaceMode,
  loadMode: LoadMode,
  fileIndexCache: FileIndexCache,
  tokenBudget = 0,
  codeIndexCache?: CodeIndexCache,
  codeConfig?: CodeIndexStatsConfig,
): Promise<ContextStats> {
  // 各目录并行统计（顺序由 Promise.all 保持）；计数走递归 countTree，只有 tree/full 才建树。
  const stats = await Promise.all(directories
    .filter(dir => (dir.access ?? 'readwrite') !== 'disabled')
    .map(async (dir): Promise<DirectoryContextStat> => {
      const access = dir.access ?? 'readwrite'
      const counts = await fileIndexCache.count(dir.path)
      const base: FileIndexEntry = { name: dir.name, path: dir.path, files: counts.files, dirs: counts.dirs, ...(counts.truncated ? { truncated: true } : {}) }
      const entry = loadMode === 'summary' ? base : { ...base, tree: await fileIndexCache.get(dir.path, { maxDepth: loadModeMaxDepth(loadMode) }) }
      return {
        name: dir.name,
        path: dir.path,
        access,
        files: counts.files,
        dirs: counts.dirs,
        tokens: estimateTokens(renderFileIndex([entry], loadMode, tokenBudget)),
      }
    }))
  const totalFiles = stats.reduce((sum, s) => sum + s.files, 0)
  const totalDirs = stats.reduce((sum, s) => sum + s.dirs, 0)
  const fileIndexTokens = stats.reduce((sum, s) => sum + s.tokens, 0)
  // 功能索引也算进固定开销，面板总额才与实际注入一致；关闭时不计。
  const codeEntries: CodeIndexEntry[] = []
  if (codeConfig?.enabled !== false && codeIndexCache !== undefined && directories.length > 0) {
    const raw = await codeIndexCache.get(directories)
    const summaries = codeConfig?.summaries
    for (const entry of raw) {
      codeEntries.push(summaries !== undefined && summaries.has(entry.feature) ? { ...entry, summary: summaries.get(entry.feature) } : entry)
    }
  }
  const promptOverheadTokens = estimateTokens(renderMultiWorkspacePrompt(directories, mode, loadMode, [], 0, codeEntries, codeConfig?.budget))
  return { loadMode, directories: stats, totalFiles, totalDirs, fileIndexTokens, promptOverheadTokens }
}
