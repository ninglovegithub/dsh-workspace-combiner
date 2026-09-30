import type { CodeIndexEntry, LoadMode, WorkspaceRef } from './types.ts'

export type TaskType = 'feature' | 'api-change' | 'bugfix' | 'review' | 'refactor' | 'custom'
export type TaskVerification = 'run' | 'test' | 'build' | 'review-impact'

export interface SessionTask {
  type: TaskType
  description: string
  directoryPaths: string[]
  loadMode: LoadMode
  includeCodeIndex: boolean
  verification: TaskVerification[]
}

export interface TaskRecommendation {
  task: SessionTask
  matchedEndpoints: readonly CodeIndexEntry[]
  trustedEndpoints: readonly CodeIndexEntry[]
  weakEndpoints: readonly CodeIndexEntry[]
  mode: 'trusted-match' | 'weak-match' | 'default'
  directoryFeatures: Readonly<Record<string, readonly string[]>>
}

const TASK_TYPES = new Set<TaskType>(['feature', 'api-change', 'bugfix', 'review', 'refactor', 'custom'])
const LOAD_MODES = new Set<LoadMode>(['summary', 'tree', 'full'])
const VERIFICATIONS = new Set<TaskVerification>(['run', 'test', 'build', 'review-impact'])

export function parseSessionTask(raw: unknown): SessionTask | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const record = raw as Record<string, unknown>
  if (typeof record.type !== 'string' || !TASK_TYPES.has(record.type as TaskType)) return undefined
  if (typeof record.description !== 'string') return undefined
  const description = record.description.trim().slice(0, 2000)
  if (description === '') return undefined
  if (!Array.isArray(record.directoryPaths)) return undefined
  const directoryPaths = [...new Set(record.directoryPaths.filter((path): path is string => typeof path === 'string' && path.trim() !== '').map(path => path.trim()))].slice(0, 50)
  if (directoryPaths.length === 0) return undefined
  const loadMode = typeof record.loadMode === 'string' && LOAD_MODES.has(record.loadMode as LoadMode) ? record.loadMode as LoadMode : 'summary'
  const verification = Array.isArray(record.verification)
    ? [...new Set(record.verification.filter((item): item is TaskVerification => typeof item === 'string' && VERIFICATIONS.has(item as TaskVerification)))]
    : []
  return {
    type: record.type as TaskType,
    description,
    directoryPaths,
    loadMode,
    includeCodeIndex: record.includeCodeIndex !== false,
    verification,
  }
}

function matchesEntry(description: string, entry: CodeIndexEntry): boolean {
  const text = description.toLowerCase()
  const endpoint = entry.endpoint.toLowerCase()
  const feature = entry.feature.toLowerCase()
  if (endpoint.length > 1 && text.includes(endpoint)) return true
  if (feature.length <= 2) return false
  if (text.includes('@' + feature)) return true
  if (!/^[a-z0-9_$-]+$/.test(feature)) return text.includes(feature)
  const escaped = feature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp('(^|[^a-z0-9_$-])' + escaped + '([^a-z0-9_$-]|$)').test(text)
}

function isTrustedMatch(entry: CodeIndexEntry): boolean {
  return (entry.confidence === 'exact' || entry.confidence === 'normalized')
    && entry.server !== undefined
    && entry.client !== undefined
}

function defaults(type: TaskType): { loadMode: LoadMode; includeCodeIndex: boolean; verification: TaskVerification[] } {
  switch (type) {
    case 'api-change': return { loadMode: 'tree', includeCodeIndex: true, verification: ['test', 'build', 'review-impact'] }
    case 'bugfix': return { loadMode: 'tree', includeCodeIndex: true, verification: ['test', 'review-impact'] }
    case 'review': return { loadMode: 'tree', includeCodeIndex: true, verification: ['review-impact'] }
    case 'refactor': return { loadMode: 'tree', includeCodeIndex: true, verification: ['test', 'build', 'review-impact'] }
    case 'feature': return { loadMode: 'tree', includeCodeIndex: true, verification: ['test', 'build'] }
    case 'custom': return { loadMode: 'summary', includeCodeIndex: true, verification: [] }
  }
}

export function recommendTask(type: TaskType, description: string, directories: readonly WorkspaceRef[], entries: readonly CodeIndexEntry[]): TaskRecommendation {
  const enabled = directories.filter(directory => (directory.access ?? 'readwrite') !== 'disabled')
  const matchedEndpoints = entries.filter(entry => matchesEntry(description, entry))
  const trustedEndpoints = matchedEndpoints.filter(isTrustedMatch)
  const weakEndpoints = matchedEndpoints.filter(entry => !isTrustedMatch(entry))
  const matchedPaths = new Set<string>()
  const featuresByPath = new Map<string, Set<string>>()
  for (const entry of trustedEndpoints) {
    if (entry.serverDir !== undefined) matchedPaths.add(entry.serverDir)
    if (entry.clientDir !== undefined) matchedPaths.add(entry.clientDir)
    for (const path of [entry.serverDir, entry.clientDir]) {
      if (path === undefined) continue
      const features = featuresByPath.get(path)
      if (features === undefined) featuresByPath.set(path, new Set([entry.feature]))
      else features.add(entry.feature)
    }
  }
  const primary = enabled[0]
  if (primary !== undefined) matchedPaths.add(primary.path)
  const hasMatchedProject = enabled.some((directory, index) => index > 0 && matchedPaths.has(directory.path))
  const selected = trustedEndpoints.length > 0 && hasMatchedProject
    ? enabled.filter(directory => matchedPaths.has(directory.path))
    : enabled
  const mode = trustedEndpoints.length > 0 && hasMatchedProject
    ? 'trusted-match'
    : weakEndpoints.length > 0 ? 'weak-match' : 'default'
  const directoryFeatures = Object.fromEntries(
    [...featuresByPath].map(([path, features]) => [path, [...features]]),
  )
  const config = defaults(type)
  return {
    task: {
      type,
      description: description.trim(),
      directoryPaths: selected.map(directory => directory.path),
      loadMode: config.loadMode,
      includeCodeIndex: config.includeCodeIndex,
      verification: config.verification,
    },
    matchedEndpoints,
    trustedEndpoints,
    weakEndpoints,
    mode,
    directoryFeatures,
  }
}

export function taskTypeLabel(type: TaskType): string {
  switch (type) {
    case 'feature': return '功能开发'
    case 'api-change': return 'API 联调/变更'
    case 'bugfix': return 'Bug 修复'
    case 'review': return '代码审查'
    case 'refactor': return '跨仓重构'
    case 'custom': return '自定义任务'
  }
}
