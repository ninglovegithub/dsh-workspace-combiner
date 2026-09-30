import type { CodeIndexEntry, GitStatus, LoadMode, WorkspaceRef } from './types.ts'

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

export type TaskPreflightStatus = 'ready' | 'warning' | 'blocked'
export type TaskPreflightIssueCode = 'missing-directory' | 'dirty-repository' | 'readonly-directory' | 'missing-command' | 'no-code-project' | 'no-verification'

export interface TaskPreflightIssue {
  code: TaskPreflightIssueCode
  count?: number
  verification?: TaskVerification
}

export interface TaskPreflightResult {
  status: TaskPreflightStatus
  issues: readonly TaskPreflightIssue[]
}

export interface TaskExecutionCheck {
  verification: TaskVerification
  command?: string
}

export interface TaskExecutionProject {
  name: string
  path: string
  primary: boolean
  access: 'readwrite' | 'readonly'
  gitStatus: GitStatus | null
  checks: readonly TaskExecutionCheck[]
}

const TASK_TYPES = new Set<TaskType>(['feature', 'api-change', 'bugfix', 'review', 'refactor', 'custom'])
const LOAD_MODES = new Set<LoadMode>(['summary', 'tree', 'full'])
const VERIFICATIONS = new Set<TaskVerification>(['run', 'test', 'build', 'review-impact'])
const VERIFICATION_COMMAND: Partial<Record<TaskVerification, 'run' | 'test' | 'build'>> = {
  run: 'run',
  test: 'test',
  build: 'build',
}

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

export function taskVerificationCoverage(
  verification: TaskVerification,
  directoryPaths: readonly string[],
  directories: readonly WorkspaceRef[],
): { configured: number; total: number } | undefined {
  const command = VERIFICATION_COMMAND[verification]
  if (command === undefined) return undefined
  const selectedProjects = directories.filter((directory, index) => index > 0 && directoryPaths.includes(directory.path))
  return {
    total: selectedProjects.length,
    configured: selectedProjects.filter(directory => (directory.commands?.[command] ?? '').trim() !== '').length,
  }
}

export function taskVerificationLabel(verification: TaskVerification): string {
  switch (verification) {
    case 'run': return '启动验证'
    case 'test': return '测试'
    case 'build': return '构建'
    case 'review-impact': return '变更影响复核'
  }
}

export function taskExecutionPlan(
  task: SessionTask,
  directories: readonly WorkspaceRef[],
  gitStatuses: Readonly<Record<string, GitStatus | null>>,
): readonly TaskExecutionProject[] {
  return directories.flatMap((directory, index) => {
    if (!task.directoryPaths.includes(directory.path)) return []
    const checks = index === 0 ? [] : task.verification.map(verification => {
      const commandKey = VERIFICATION_COMMAND[verification]
      const command = commandKey === undefined ? undefined : directory.commands?.[commandKey]?.trim()
      return { verification, ...(command === undefined || command === '' ? {} : { command }) }
    })
    return [{
      name: directory.name,
      path: directory.path,
      primary: index === 0,
      access: directory.access === 'readonly' ? 'readonly' : 'readwrite',
      gitStatus: gitStatuses[directory.path] ?? null,
      checks,
    }]
  })
}

export function taskPreflight(
  task: SessionTask,
  directories: readonly WorkspaceRef[],
  missingDirectories: ReadonlySet<string>,
  gitStatuses: Readonly<Record<string, GitStatus | null>>,
): TaskPreflightResult {
  const selected = directories.filter(directory => task.directoryPaths.includes(directory.path))
  const selectedProjects = selected.filter((directory, index) => directories.indexOf(directory) > 0)
  const issues: TaskPreflightIssue[] = []
  const missing = selected.filter(directory => missingDirectories.has(directory.path)).length
  if (missing > 0) issues.push({ code: 'missing-directory', count: missing })
  const dirty = selected.filter(directory => {
    const status = gitStatuses[directory.path]
    return status != null && status.dirty + status.untracked > 0
  }).length
  if (dirty > 0) issues.push({ code: 'dirty-repository', count: dirty })
  if (task.type !== 'review') {
    const readonly = selectedProjects.filter(directory => directory.access === 'readonly').length
    if (readonly > 0) issues.push({ code: 'readonly-directory', count: readonly })
  }
  if (selectedProjects.length === 0 && task.type !== 'review') issues.push({ code: 'no-code-project' })
  if (task.verification.length === 0) issues.push({ code: 'no-verification' })
  for (const verification of task.verification) {
    const coverage = taskVerificationCoverage(verification, task.directoryPaths, directories)
    if (coverage !== undefined && coverage.total > 0 && coverage.configured === 0) {
      issues.push({ code: 'missing-command', verification })
    }
  }
  return {
    status: missing > 0 ? 'blocked' : issues.length > 0 ? 'warning' : 'ready',
    issues,
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
