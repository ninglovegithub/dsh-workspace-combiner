/**
 * 上下文预设与旧配置兼容解析。纯逻辑，供 host、client 和 smoke test 共用。
 * @module dsh-workspace-combiner/core/contextPreset
 */

import type { ContextPreset, LoadMode, Workspace } from './types.ts'
import { DEFAULT_CODE_INDEX_BUDGET, DEFAULT_COMMANDS_BUDGET, DEFAULT_STANDARDS_BUDGET, DEFAULT_TOKEN_BUDGET } from '../invariant.ts'

export interface ContextPresetConfig {
  preset: ContextPreset
  loadMode: LoadMode
  globalBudget: number
  fileIndexBudget: number
  codeIndexBudget: number
  standardsBudget: number
  commandsBudget: number
  codeIndexSummary: 'off' | 'llm'
}

const PRESETS: Record<Exclude<ContextPreset, 'custom'>, Omit<ContextPresetConfig, 'preset'>> = {
  economy: {
    loadMode: 'summary',
    globalBudget: 12000,
    fileIndexBudget: 5000,
    codeIndexBudget: 0,
    standardsBudget: 0,
    commandsBudget: 0,
    codeIndexSummary: 'off',
  },
  balanced: {
    loadMode: 'tree',
    globalBudget: 32000,
    fileIndexBudget: 16000,
    codeIndexBudget: 0,
    standardsBudget: 0,
    commandsBudget: 0,
    codeIndexSummary: 'off',
  },
  deep: {
    loadMode: 'full',
    globalBudget: 60000,
    fileIndexBudget: 42000,
    codeIndexBudget: 5000,
    standardsBudget: 6000,
    commandsBudget: 1500,
    codeIndexSummary: 'llm',
  },
}

export function contextPresetConfig(preset: Exclude<ContextPreset, 'custom'>): ContextPresetConfig {
  return { preset, ...PRESETS[preset] }
}

/** 解析工作空间的实际预算；旧工作空间自动映射 custom 且不改变已有行为。 */
export function resolveWorkspaceContext(workspace: Workspace): ContextPresetConfig {
  const preset = workspace.contextPreset ?? 'custom'
  if (preset !== 'custom') {
    const base = contextPresetConfig(preset)
    return {
      ...base,
      loadMode: workspace.loadMode ?? base.loadMode,
      globalBudget: workspace.tokenBudget ?? base.globalBudget,
      fileIndexBudget: workspace.fileIndexBudget ?? base.fileIndexBudget,
      codeIndexBudget: workspace.codeIndexBudget ?? base.codeIndexBudget,
      standardsBudget: workspace.standards?.budget ?? base.standardsBudget,
      commandsBudget: workspace.commandsBudget ?? base.commandsBudget,
      codeIndexSummary: workspace.codeIndexSummary ?? base.codeIndexSummary,
    }
  }
  const legacyBudget = workspace.tokenBudget ?? DEFAULT_TOKEN_BUDGET
  return {
    preset: 'custom',
    loadMode: workspace.loadMode ?? 'summary',
    globalBudget: legacyBudget,
    fileIndexBudget: workspace.fileIndexBudget ?? legacyBudget,
    codeIndexBudget: workspace.codeIndexBudget ?? DEFAULT_CODE_INDEX_BUDGET,
    standardsBudget: workspace.standards?.budget ?? DEFAULT_STANDARDS_BUDGET,
    commandsBudget: workspace.commandsBudget ?? DEFAULT_COMMANDS_BUDGET,
    codeIndexSummary: workspace.codeIndexSummary ?? 'off',
  }
}
