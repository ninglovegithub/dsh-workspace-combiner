/**
 * 平台无关的输入校验：目录项（WorkspaceRef）及其数组。
 * host 落盘加载与 client 请求体校验共用同一份规则，避免两处校验漂移。
 * @module dsh-workspace-combiner/core/validate
 */

import type { DirectoryCommands, MonorepoInfo, MonorepoKind, MonorepoPackage, ProjectType, WorkspaceRef } from './types.ts'

const MONOREPO_KINDS = new Set<MonorepoKind>(['pnpm', 'npm', 'yarn', 'bun', 'turbo', 'nx', 'lerna', 'maven', 'gradle'])
const PROJECT_TYPES = new Set<ProjectType>(['java', 'frontend', 'frontend-vue', 'frontend-react', 'frontend-webpack', 'frontend-next', 'python', 'go', 'generic', 'none'])

function parseMonorepo(raw: unknown): MonorepoInfo | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const record = raw as Record<string, unknown>
  if (typeof record.kind !== 'string' || !MONOREPO_KINDS.has(record.kind as MonorepoKind) || !Array.isArray(record.packages)) return undefined
  const packages: MonorepoPackage[] = []
  for (const item of record.packages) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return undefined
    const pkg = item as Record<string, unknown>
    if (typeof pkg.name !== 'string' || typeof pkg.path !== 'string' || typeof pkg.projectType !== 'string' || !PROJECT_TYPES.has(pkg.projectType as ProjectType)) return undefined
    packages.push({ name: pkg.name, path: pkg.path, projectType: pkg.projectType as ProjectType })
  }
  return { kind: record.kind as MonorepoKind, packages }
}

/**
 * 校验并规范化目录命令：三个字段都是可选非空字符串，全空时返回 undefined
 * （避免把空对象写进持久化数据）。
 */
export function parseCommands(raw: unknown): DirectoryCommands | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const record = raw as Record<string, unknown>
  const pick = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
  const run = pick(record.run)
  const test = pick(record.test)
  const build = pick(record.build)
  if (run === undefined && test === undefined && build === undefined) return undefined
  return {
    ...(run === undefined ? {} : { run }),
    ...(test === undefined ? {} : { test }),
    ...(build === undefined ? {} : { build }),
  }
}

/** 校验并规范化一条目录项；缺 id/name/path 等必填字段时返回 undefined。 */
export function parseWorkspaceRef(raw: unknown): WorkspaceRef | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const ref = raw as Record<string, unknown>
  if (typeof ref.id !== 'string' || typeof ref.name !== 'string' || typeof ref.path !== 'string') return undefined
  const monorepo = parseMonorepo(ref.monorepo)
  return {
    id: ref.id,
    name: ref.name,
    path: ref.path,
    ...(typeof ref.projectType === 'string' ? { projectType: ref.projectType as WorkspaceRef['projectType'] } : {}),
    ...(typeof ref.evidence === 'string' ? { evidence: ref.evidence } : {}),
    ...(typeof ref.isPrimary === 'boolean' ? { isPrimary: ref.isPrimary } : {}),
    ...(ref.access === 'readwrite' || ref.access === 'readonly' || ref.access === 'disabled' ? { access: ref.access } : {}),
    ...(typeof ref.group === 'string' && ref.group !== '' ? { group: ref.group } : {}),
    ...(typeof ref.note === 'string' && ref.note !== '' ? { note: ref.note } : {}),
    ...(parseCommands(ref.commands) === undefined ? {} : { commands: parseCommands(ref.commands) as DirectoryCommands }),
    ...(monorepo === undefined ? {} : { monorepo }),
  }
}

/** 校验目录项数组：任一项非法则整体返回 undefined（请求体语义：宁可拒绝也不半接受）。 */
export function parseWorkspaceRefs(raw: unknown): WorkspaceRef[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: WorkspaceRef[] = []
  for (const item of raw) {
    const ref = parseWorkspaceRef(item)
    if (ref === undefined) return undefined
    out.push(ref)
  }
  return out
}
