import type { CodeIndexEntry, ContextPreset, GitStatus, LoadMode, WorkspaceRef } from './types.ts'

export type TaskMode = 'feature' | 'api-change' | 'bugfix' | 'review' | 'refactor' | 'custom'
/** 兼容旧调用方；新代码使用 TaskMode。 */
export type TaskType = TaskMode
export type TaskVerification = 'run' | 'test' | 'build' | 'review-impact'
export type TaskDataBlock = 'file-index' | 'code-index' | 'standards' | 'commands' | 'endpoint-impact' | 'git-status'
export type TaskContextPreset = Exclude<ContextPreset, 'custom'>

export interface TaskModeConfig {
  taskMode: TaskMode
  label: string
  labelKey: 'taskTypeFeature' | 'taskTypeApi' | 'taskTypeBugfix' | 'taskTypeReview' | 'taskTypeRefactor' | 'taskTypeCustom'
  descriptionKey: 'taskModeFeatureHint' | 'taskModeApiHint' | 'taskModeBugfixHint' | 'taskModeReviewHint' | 'taskModeRefactorHint' | 'taskModeCustomHint'
  scope: 'matched-or-all' | 'all'
  contextPreset: TaskContextPreset
  loadMode: LoadMode
  requiredBlocks: readonly TaskDataBlock[]
  endpointImpact: boolean
  verification: readonly TaskVerification[]
  allowWrites: boolean
  promptRules: readonly string[]
  finalOutput: string
}

const MODE_CONFIGS: readonly TaskModeConfig[] = [
  { taskMode: 'feature', label: '功能开发', labelKey: 'taskTypeFeature', descriptionKey: 'taskModeFeatureHint', scope: 'matched-or-all', contextPreset: 'balanced', loadMode: 'tree', requiredBlocks: ['file-index', 'standards', 'commands'], endpointImpact: false, verification: ['test', 'build'], allowWrites: true, promptRules: ['先确认实现范围和受影响项目，再完成代码修改。', '新增或改变行为时补充对应测试；不得只实现不验证。'], finalOutput: '按“实现内容 / 验证结果 / 剩余事项”输出。' },
  { taskMode: 'api-change', label: 'API 联调/变更', labelKey: 'taskTypeApi', descriptionKey: 'taskModeApiHint', scope: 'matched-or-all', contextPreset: 'deep', loadMode: 'tree', requiredBlocks: ['file-index', 'code-index', 'endpoint-impact', 'standards', 'commands'], endpointImpact: true, verification: ['test', 'build', 'review-impact'], allowWrites: true, promptRules: ['必须同时检查服务端注册处、客户端调用处以及请求/响应类型。', '接口路径、字段或语义变化后，必须执行端点影响复核，禁止只改一端。'], finalOutput: '按“接口变化 / 服务端修改 / 客户端修改 / 兼容性与验证”输出。' },
  { taskMode: 'bugfix', label: 'Bug 修复', labelKey: 'taskTypeBugfix', descriptionKey: 'taskModeBugfixHint', scope: 'matched-or-all', contextPreset: 'balanced', loadMode: 'tree', requiredBlocks: ['file-index', 'git-status', 'commands'], endpointImpact: false, verification: ['test', 'review-impact'], allowWrites: true, promptRules: ['先给出可验证的复现条件或失败证据，再定位根因。', '修复后执行针对性回归，说明为什么不会引入同类问题。'], finalOutput: '按“复现 / 根因 / 修复 / 回归验证”输出。' },
  { taskMode: 'review', label: '代码审查', labelKey: 'taskTypeReview', descriptionKey: 'taskModeReviewHint', scope: 'all', contextPreset: 'balanced', loadMode: 'tree', requiredBlocks: ['file-index', 'code-index', 'git-status'], endpointImpact: true, verification: ['review-impact'], allowWrites: false, promptRules: ['禁止修改、新建或删除任何项目文件。', '只报告可执行的问题，必须包含证据位置、影响和建议。'], finalOutput: '按严重程度输出风险清单；无问题时明确说明检查范围和残余风险。' },
  { taskMode: 'refactor', label: '跨仓重构', labelKey: 'taskTypeRefactor', descriptionKey: 'taskModeRefactorHint', scope: 'all', contextPreset: 'deep', loadMode: 'tree', requiredBlocks: ['file-index', 'code-index', 'git-status', 'standards', 'commands'], endpointImpact: true, verification: ['test', 'build', 'review-impact'], allowWrites: true, promptRules: ['修改前列出跨仓依赖、迁移顺序和回滚边界。', '保持阶段性兼容，明确旧入口、旧字段或旧调用的清理时机。'], finalOutput: '按“依赖关系 / 迁移步骤 / 修改结果 / 风险与回滚 / 验证”输出。' },
  { taskMode: 'custom', label: '自定义任务', labelKey: 'taskTypeCustom', descriptionKey: 'taskModeCustomHint', scope: 'all', contextPreset: 'balanced', loadMode: 'summary', requiredBlocks: ['file-index'], endpointImpact: false, verification: [], allowWrites: true, promptRules: ['严格按用户目标执行；范围或完成标准不清楚时先说明假设。'], finalOutput: '按用户要求输出，并明确实际修改和验证情况。' },
]

export const TASK_MODE_REGISTRY: Readonly<Record<TaskMode, TaskModeConfig>> = Object.freeze(Object.fromEntries(MODE_CONFIGS.map(config => [config.taskMode, config])) as Record<TaskMode, TaskModeConfig>)
export const TASK_MODES: readonly TaskMode[] = MODE_CONFIGS.map(config => config.taskMode)

export function taskModeConfig(taskMode: TaskMode): TaskModeConfig {
  return TASK_MODE_REGISTRY[taskMode]
}

export interface SessionTask {
  taskMode: TaskMode
  description: string
  directoryPaths: string[]
  loadMode: LoadMode
  includeCodeIndex: boolean
  verification: TaskVerification[]
  contextPreset: TaskContextPreset
  endpointImpact: boolean
  allowWrites: boolean
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

const TASK_MODES_SET = new Set<TaskMode>(TASK_MODES)
const LOAD_MODES = new Set<LoadMode>(['summary', 'tree', 'full'])
const VERIFICATIONS = new Set<TaskVerification>(['run', 'test', 'build', 'review-impact'])
const VERIFICATION_COMMAND: Partial<Record<TaskVerification, 'run' | 'test' | 'build'>> = { run: 'run', test: 'test', build: 'build' }

export function parseSessionTask(raw: unknown): SessionTask | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const record = raw as Record<string, unknown>
  const rawMode = typeof record.taskMode === 'string' ? record.taskMode : record.type
  if (typeof rawMode !== 'string' || !TASK_MODES_SET.has(rawMode as TaskMode)) return undefined
  const taskMode = rawMode as TaskMode
  const config = taskModeConfig(taskMode)
  if (typeof record.description !== 'string') return undefined
  const description = record.description.trim().slice(0, 2000)
  if (description === '') return undefined
  if (!Array.isArray(record.directoryPaths)) return undefined
  const directoryPaths = [...new Set(record.directoryPaths.filter((path): path is string => typeof path === 'string' && path.trim() !== '').map(path => path.trim()))].slice(0, 50)
  if (directoryPaths.length === 0) return undefined
  const loadMode = typeof record.loadMode === 'string' && LOAD_MODES.has(record.loadMode as LoadMode) ? record.loadMode as LoadMode : config.loadMode
  const verification = Array.isArray(record.verification)
    ? [...new Set(record.verification.filter((item): item is TaskVerification => typeof item === 'string' && VERIFICATIONS.has(item as TaskVerification)))]
    : [...config.verification]
  return {
    taskMode,
    description,
    directoryPaths,
    loadMode,
    includeCodeIndex: config.requiredBlocks.includes('code-index') || record.includeCodeIndex !== false,
    verification,
    contextPreset: config.contextPreset,
    endpointImpact: config.endpointImpact,
    allowWrites: config.allowWrites,
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
  return (entry.confidence === 'exact' || entry.confidence === 'normalized') && entry.server !== undefined && entry.client !== undefined
}

export function recommendTask(taskMode: TaskMode, description: string, directories: readonly WorkspaceRef[], entries: readonly CodeIndexEntry[]): TaskRecommendation {
  const config = taskModeConfig(taskMode)
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
  const trustedScope = config.scope === 'matched-or-all' && trustedEndpoints.length > 0 && hasMatchedProject
  const selected = trustedScope ? enabled.filter(directory => matchedPaths.has(directory.path)) : enabled
  const mode: TaskRecommendation['mode'] = trustedScope ? 'trusted-match' : weakEndpoints.length > 0 ? 'weak-match' : 'default'
  const directoryFeatures = Object.fromEntries([...featuresByPath].map(([path, features]) => [path, [...features]]))
  return {
    task: {
      taskMode,
      description: description.trim(),
      directoryPaths: selected.map(directory => directory.path),
      loadMode: config.loadMode,
      includeCodeIndex: config.requiredBlocks.includes('code-index'),
      verification: [...config.verification],
      contextPreset: config.contextPreset,
      endpointImpact: config.endpointImpact,
      allowWrites: config.allowWrites,
    },
    matchedEndpoints,
    trustedEndpoints,
    weakEndpoints,
    mode,
    directoryFeatures,
  }
}

export function taskVerificationCoverage(verification: TaskVerification, directoryPaths: readonly string[], directories: readonly WorkspaceRef[]): { configured: number; total: number } | undefined {
  const command = VERIFICATION_COMMAND[verification]
  if (command === undefined) return undefined
  const selectedProjects = directories.filter((directory, index) => index > 0 && directoryPaths.includes(directory.path))
  return { total: selectedProjects.length, configured: selectedProjects.filter(directory => (directory.commands?.[command] ?? '').trim() !== '').length }
}

export function taskVerificationLabel(verification: TaskVerification): string {
  if (verification === 'run') return '启动验证'
  if (verification === 'test') return '测试'
  if (verification === 'build') return '构建'
  return '变更影响复核'
}

export function taskExecutionPlan(task: SessionTask, directories: readonly WorkspaceRef[], gitStatuses: Readonly<Record<string, GitStatus | null>>): readonly TaskExecutionProject[] {
  const allowWrites = taskModeConfig(task.taskMode).allowWrites
  return directories.flatMap((directory, index) => {
    if (!task.directoryPaths.includes(directory.path)) return []
    const checks = index === 0 ? [] : task.verification.map(verification => {
      const commandKey = VERIFICATION_COMMAND[verification]
      const command = commandKey === undefined ? undefined : directory.commands?.[commandKey]?.trim()
      return { verification, ...(command === undefined || command === '' ? {} : { command }) }
    })
    return [{ name: directory.name, path: directory.path, primary: index === 0, access: !allowWrites || directory.access === 'readonly' ? 'readonly' : 'readwrite', gitStatus: gitStatuses[directory.path] ?? null, checks }]
  })
}

export function taskPreflight(task: SessionTask, directories: readonly WorkspaceRef[], missingDirectories: ReadonlySet<string>, gitStatuses: Readonly<Record<string, GitStatus | null>>): TaskPreflightResult {
  const config = taskModeConfig(task.taskMode)
  const selected = directories.filter(directory => task.directoryPaths.includes(directory.path))
  const selectedProjects = selected.filter(directory => directories.indexOf(directory) > 0)
  const issues: TaskPreflightIssue[] = []
  const missing = selected.filter(directory => missingDirectories.has(directory.path)).length
  if (missing > 0) issues.push({ code: 'missing-directory', count: missing })
  const dirty = selected.filter(directory => {
    const status = gitStatuses[directory.path]
    return status != null && status.dirty + status.untracked > 0
  }).length
  if (dirty > 0) issues.push({ code: 'dirty-repository', count: dirty })
  if (config.allowWrites) {
    const readonly = selectedProjects.filter(directory => directory.access === 'readonly').length
    if (readonly > 0) issues.push({ code: 'readonly-directory', count: readonly })
  }
  if (selectedProjects.length === 0 && config.allowWrites) issues.push({ code: 'no-code-project' })
  if (task.verification.length === 0) issues.push({ code: 'no-verification' })
  for (const verification of task.verification) {
    const coverage = taskVerificationCoverage(verification, task.directoryPaths, directories)
    if (coverage !== undefined && coverage.total > 0 && coverage.configured === 0) issues.push({ code: 'missing-command', verification })
  }
  return { status: missing > 0 ? 'blocked' : issues.length > 0 ? 'warning' : 'ready', issues }
}

export function taskTypeLabel(taskMode: TaskMode): string {
  return taskModeConfig(taskMode).label
}
