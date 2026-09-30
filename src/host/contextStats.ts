/**
 * 上下文监控：估算注入 prompt 的 token 规模 + 各目录文件统计。
 * @module dsh-workspace-combiner/host/contextStats
 */

import { loadModeMaxDepth, type CodeIndexEntry, type ContextPreset, type ContextStats, type DirectoryContextStat, type LoadMode, type WorkspaceMode, type WorkspaceRef } from '../core/types.ts'
import { estimateTokens, type FileIndexEntry } from '../core/fileTree.ts'
import type { StandardGroup } from '../core/standards.ts'
import type { FileIndexCache } from './fileIndex.ts'
import { codeIndexTextFile, type CodeIndexCache } from './codeIndex.ts'
import { renderCodeIndex, renderCommands, renderCommandsText, renderFileIndex, renderMultiWorkspacePromptDetailed, renderStandards, renderStandardsText } from '../prompt.ts'
import { DEFAULT_CODE_INDEX_BUDGET, DEFAULT_COMMANDS_BUDGET } from '../invariant.ts'
import { commandsTextFile, standardsTextFile } from './onDemandContext.ts'

/** 功能索引在统计中的配置（与宿主注入保持一致）。 */
export interface CodeIndexStatsConfig {
  enabled: boolean
  budget: number
  /** 已生成的功能摘要（可选，命中签名才有）。 */
  summaries?: Map<string, string>
}

/** 计算上下文统计所需的全部输入。 */
export interface ContextStatsInput {
  directories: readonly WorkspaceRef[]
  mode: WorkspaceMode
  loadMode: LoadMode
  fileIndexCache: FileIndexCache
  preset?: ContextPreset
  globalBudget?: number
  fileIndexBudget?: number
  codeIndexCache?: CodeIndexCache
  codeConfig?: CodeIndexStatsConfig
  /** 生效的开发规范分组。 */
  standardGroups?: readonly StandardGroup[]
  standardsBudget?: number
  /** 各项目常用命令区块预算。 */
  commandsBudget?: number
}

/**
 * 计算当前工作区的上下文统计（文件树走 mtime 缓存）。
 * @param input - 工作空间目录、加载模式、各区块缓存与预算。
 */
export async function computeContextStats(input: ContextStatsInput): Promise<ContextStats> {
  const {
    directories,
    mode,
    loadMode,
    fileIndexCache,
    preset = 'custom',
    globalBudget = Number.POSITIVE_INFINITY,
    fileIndexBudget = 0,
    codeIndexCache,
    codeConfig,
    standardGroups = [],
    standardsBudget = 0,
    commandsBudget = 0,
  } = input
  // 各目录并行统计（顺序由 Promise.all 保持）；计数走递归 countTree，只有 tree/full 才建树。
  const perDirectory = await Promise.all(directories
    .filter(dir => (dir.access ?? 'readwrite') !== 'disabled')
    .map(async (dir): Promise<{ stat: DirectoryContextStat; entry: FileIndexEntry }> => {
      const access = dir.access ?? 'readwrite'
      const counts = await fileIndexCache.count(dir.path)
      const base: FileIndexEntry = { name: dir.name, path: dir.path, files: counts.files, dirs: counts.dirs, ...(counts.truncated ? { truncated: true } : {}) }
      const entry = loadMode === 'summary' ? base : { ...base, tree: await fileIndexCache.get(dir.path, { maxDepth: loadModeMaxDepth(loadMode) }) }
      return {
        entry,
        stat: {
          name: dir.name,
          path: dir.path,
          access,
          files: counts.files,
          dirs: counts.dirs,
          // 逐目录条形图用「该目录单独渲染」的近似值（含一次区块标题）。
          tokens: estimateTokens(renderFileIndex([entry], loadMode, fileIndexBudget)),
        },
      }
    }))
  const stats = perDirectory.map(item => item.stat)
  const fileEntries = perDirectory.map(item => item.entry)
  const totalFiles = stats.reduce((sum, s) => sum + s.files, 0)
  const totalDirs = stats.reduce((sum, s) => sum + s.dirs, 0)
  // 功能索引也算进固定开销，面板总额才与实际注入一致；关闭时不计。
  const codeEntries: CodeIndexEntry[] = []
  if (codeConfig?.enabled !== false && codeIndexCache !== undefined && directories.length > 0) {
    const raw = (await codeIndexCache.get(directories)).entries
    const summaries = codeConfig?.summaries
    for (const entry of raw) {
      codeEntries.push(summaries !== undefined && summaries.has(entry.feature) ? { ...entry, summary: summaries.get(entry.feature) } : entry)
    }
  }
  const codeIndexBudget = codeConfig?.budget ?? DEFAULT_CODE_INDEX_BUDGET
  const commandsBudgetResolved = commandsBudget > 0 ? commandsBudget : DEFAULT_COMMANDS_BUDGET
  // 各区块分别计费：面板才能显示「谁在吃预算」，而不是只知道一个总数。
  const standardsText = renderStandardsText(standardGroups)
  const commandsText = renderCommandsText(directories)
  const rendered = renderMultiWorkspacePromptDetailed({
    workspaces: directories,
    mode,
    loadMode,
    entries: fileEntries,
    fileIndexBudget,
    globalBudget,
    codeEntries,
    codeIndexBudget,
    ...(codeIndexBudget <= 0 && codeEntries.length > 0 ? { codeIndexPath: codeIndexTextFile() } : {}),
    standardGroups,
    standardsBudget,
    ...(standardsBudget <= 0 && standardsText !== '' ? { standardsPath: standardsTextFile() } : {}),
    commandsBudget: commandsBudgetResolved,
    ...(commandsBudgetResolved <= 0 && commandsText !== '' ? { commandsPath: commandsTextFile() } : {}),
  })
  const fileIndexTokens = estimateTokens(renderFileIndex(fileEntries, loadMode, rendered.effectiveBudgets.fileIndex))
  const standardsTokens = estimateTokens(renderStandards(standardGroups, rendered.effectiveBudgets.standards))
  const codeIndexTokens = estimateTokens(renderCodeIndex(codeEntries, rendered.effectiveBudgets.codeIndex))
  const commandsTokens = estimateTokens(renderCommands(directories, rendered.effectiveBudgets.commands))
  const totalTokens = estimateTokens(rendered.text)
  const promptOverheadTokens = Math.max(0, totalTokens - fileIndexTokens - codeIndexTokens - standardsTokens - commandsTokens)
  return { preset, loadMode, directories: stats, totalFiles, totalDirs, fileIndexTokens, promptOverheadTokens, standardsTokens, codeIndexTokens, commandsTokens, totalTokens, globalBudget, degradations: rendered.degradations }
}
