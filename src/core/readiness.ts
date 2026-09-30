import type { CodeIndexEntry, ContextStats, GitStatus, Workspace, WorkspaceRef } from './types.ts'

export type ReadinessStatus = 'ready' | 'warning' | 'blocked'
export type ReadinessSeverity = 'warning' | 'blocked'

export type ReadinessIssueCode =
  | 'no-directories'
  | 'primary-missing'
  | 'missing-directories'
  | 'no-code-projects'
  | 'budget-over'
  | 'budget-near'
  | 'code-index-empty'
  | 'commands-missing'
  | 'dirty-repositories'

export interface ReadinessIssue {
  code: ReadinessIssueCode
  severity: ReadinessSeverity
  count?: number
}

export interface ReadinessSummary {
  directories: number
  effectiveDirectories: number
  missingDirectories: number
  frontendProjects: number
  backendProjects: number
  documentProjects: number
  otherProjects: number
  writableDirectories: number
  readonlyDirectories: number
  disabledDirectories: number
  gitRepositories: number
  dirtyRepositories: number
  endpoints: number
  pairedEndpoints: number
  estimatedTokens: number
  tokenBudget: number
  missingCommandProjects: number
  sessions: number
}

export interface ReadinessReport {
  status: ReadinessStatus
  issues: readonly ReadinessIssue[]
  summary: ReadinessSummary
}

export interface ReadinessInput {
  workspace: Workspace | undefined
  directories: readonly WorkspaceRef[]
  missingDirectories: ReadonlySet<string>
  gitStatuses: Readonly<Record<string, GitStatus | null>>
  contextStats: ContextStats | null
  codeEntries: readonly CodeIndexEntry[]
  codeIndexEnabled: boolean
  tokenBudget: number
  sessions: number
}

function isFrontend(directory: WorkspaceRef): boolean {
  return directory.projectType?.startsWith('frontend') === true
}

function isBackend(directory: WorkspaceRef): boolean {
  return directory.projectType === 'java' || directory.projectType === 'python' || directory.projectType === 'go'
}

function isDocument(directory: WorkspaceRef, index: number, workspace: Workspace | undefined): boolean {
  if (index === 0 && (workspace?.mode ?? 'anchor') === 'anchor') return true
  const group = directory.group?.toLowerCase() ?? ''
  return group.includes('文档') || group.includes('doc')
}

function hasCommands(directory: WorkspaceRef): boolean {
  const commands = directory.commands
  return commands !== undefined && [commands.run, commands.test, commands.build].some(value => value?.trim() !== '')
}

export function calculateReadiness(input: ReadinessInput): ReadinessReport {
  const enabled = input.directories.filter(directory => (directory.access ?? 'readwrite') !== 'disabled')
  const effective = enabled.filter(directory => !input.missingDirectories.has(directory.path))
  const missing = input.directories.filter(directory => input.missingDirectories.has(directory.path))
  const primaryMissing = input.directories[0] !== undefined && input.missingDirectories.has(input.directories[0].path)
  const codeProjects = effective.filter((directory, index) => !isDocument(directory, input.directories.indexOf(directory), input.workspace))

  let frontendProjects = 0
  let backendProjects = 0
  let documentProjects = 0
  effective.forEach(directory => {
    const index = input.directories.indexOf(directory)
    if (isDocument(directory, index, input.workspace)) documentProjects += 1
    else if (isFrontend(directory)) frontendProjects += 1
    else if (isBackend(directory)) backendProjects += 1
  })
  const otherProjects = Math.max(0, effective.length - frontendProjects - backendProjects - documentProjects)

  const gitRepositories = effective.filter(directory => input.gitStatuses[directory.path] != null).length
  const dirtyRepositories = effective.filter(directory => {
    const status = input.gitStatuses[directory.path]
    return status != null && status.dirty + status.untracked > 0
  }).length
  const pairedEndpoints = input.codeEntries.filter(entry => entry.server !== undefined && entry.client !== undefined).length
  const estimatedTokens = input.contextStats === null ? 0 : input.contextStats.fileIndexTokens
    + input.contextStats.promptOverheadTokens
    + input.contextStats.standardsTokens
    + input.contextStats.codeIndexTokens
    + input.contextStats.commandsTokens
  const missingCommandProjects = codeProjects.filter(directory => !hasCommands(directory)).length

  const issues: ReadinessIssue[] = []
  if (input.directories.length === 0) issues.push({ code: 'no-directories', severity: 'blocked' })
  if (primaryMissing) issues.push({ code: 'primary-missing', severity: 'blocked' })
  const secondaryMissing = missing.length - (primaryMissing ? 1 : 0)
  if (secondaryMissing > 0) issues.push({ code: 'missing-directories', severity: 'warning', count: secondaryMissing })
  if ((input.workspace?.mode ?? 'anchor') === 'anchor' && codeProjects.length === 0 && input.directories.length > 0) {
    issues.push({ code: 'no-code-projects', severity: 'warning' })
  }
  if (estimatedTokens > input.tokenBudget) issues.push({ code: 'budget-over', severity: 'warning' })
  else if (estimatedTokens > input.tokenBudget * 0.8) issues.push({ code: 'budget-near', severity: 'warning' })
  if (input.codeIndexEnabled && codeProjects.length > 0 && input.codeEntries.length === 0) {
    issues.push({ code: 'code-index-empty', severity: 'warning' })
  }
  if (missingCommandProjects > 0) issues.push({ code: 'commands-missing', severity: 'warning', count: missingCommandProjects })
  if (dirtyRepositories > 0) issues.push({ code: 'dirty-repositories', severity: 'warning', count: dirtyRepositories })

  const status: ReadinessStatus = issues.some(issue => issue.severity === 'blocked')
    ? 'blocked'
    : issues.some(issue => issue.severity === 'warning') ? 'warning' : 'ready'

  return {
    status,
    issues,
    summary: {
      directories: input.directories.length,
      effectiveDirectories: effective.length,
      missingDirectories: missing.length,
      frontendProjects,
      backendProjects,
      documentProjects,
      otherProjects,
      writableDirectories: effective.filter(directory => (directory.access ?? 'readwrite') === 'readwrite').length,
      readonlyDirectories: effective.filter(directory => directory.access === 'readonly').length,
      disabledDirectories: input.directories.filter(directory => directory.access === 'disabled').length,
      gitRepositories,
      dirtyRepositories,
      endpoints: input.codeEntries.length,
      pairedEndpoints,
      estimatedTokens,
      tokenBudget: input.tokenBudget,
      missingCommandProjects,
      sessions: input.sessions,
    },
  }
}
