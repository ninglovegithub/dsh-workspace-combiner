/**
 * 「复制工作空间」弹窗里要展示的信息摘要。
 *
 * 复制只换名称与 id，其余配置原样照搬；这里把**到底会复制什么**算成结构化数据，
 * 让弹窗逐条列出来（目录、模式、预算、命令、规范、快照），并明确标出
 * **不复制会话、不复制磁盘文件**。
 *
 * @module dsh-workspace-combiner/client/panel/duplicateSummary
 */

import type { ContextPreset, LoadMode, Workspace, WorkspaceMode } from '../../core/types.ts'

/** 复制摘要：只给数字与枚举，具体文案由面板按当前语言渲染。 */
export interface DuplicateSummary {
  /** 挂载目录数量。 */
  readonly directoryCount: number
  /** 主目录路径（无目录时为空串）。 */
  readonly primaryPath: string
  /** 只读目录数量。 */
  readonly readonlyCount: number
  /** 访问模式。 */
  readonly mode: WorkspaceMode
  /** 文件加载模式。 */
  readonly loadMode: LoadMode
  /** 上下文预设（旧工作空间缺省按 custom）。 */
  readonly contextPreset: ContextPreset
  /** 全局注入 token 上限；未设置时为 undefined。 */
  readonly tokenBudget: number | undefined
  /** 常用命令总条数（各目录汇总）。 */
  readonly commandCount: number
  /** 开发规范绑定项数（全局 + 逐目录 + 本空间自建）。 */
  readonly standardsCount: number
  /** 目录配置快照数量。 */
  readonly snapshotCount: number
}

/**
 * 计算复制摘要。
 * @param workspace - 被复制的工作空间。
 * @returns 供弹窗展示的摘要。
 */
export function summarizeDuplicateSource(workspace: Workspace): DuplicateSummary {
  const directories = workspace.directories ?? []
  const primary = directories.find(d => d.isPrimary === true) ?? directories[0]
  const standards = workspace.standards
  const perDirectory = Object.values(standards?.perDirectory ?? {})
  return {
    directoryCount: directories.length,
    primaryPath: primary?.path ?? '',
    readonlyCount: directories.filter(d => d.access === 'readonly').length,
    mode: workspace.mode ?? 'anchor',
    loadMode: workspace.loadMode ?? 'summary',
    contextPreset: workspace.contextPreset ?? 'custom',
    tokenBudget: workspace.tokenBudget,
    commandCount: directories.reduce((sum, d) => sum + Object.keys(d.commands ?? {}).length, 0),
    standardsCount: (standards?.global?.length ?? 0)
      + perDirectory.reduce((sum, ids) => sum + ids.length, 0)
      + (standards?.workspaceCustom?.length ?? 0),
    snapshotCount: workspace.snapshots?.length ?? 0,
  }
}
