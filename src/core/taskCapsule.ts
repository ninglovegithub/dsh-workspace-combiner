import type { FileIndexEntry, FileTreeNode } from './fileTree.ts'
import type { CodeIndexEntry, DependencyIndexEntry, DirectoryCommands, ProjectType, SymbolIndexEntry, TestIndexEntry, WorkspaceRef } from './types.ts'
import { matchesTaskCodeEntry, type SessionTask } from './task.ts'
import { groupLabel } from './groups.ts'

export interface TaskCapsuleProject {
  name: string
  path: string
  primary: boolean
  access: 'readwrite' | 'readonly'
  projectType?: ProjectType
  group?: string
  commands?: DirectoryCommands
  entrypoints: string[]
  configFiles: string[]
  testRoots: string[]
  changedFiles: string[]
}

export interface TaskCapsuleEndpoint {
  feature: string
  endpoint: string
  confidence?: CodeIndexEntry['confidence']
  server?: string
  client?: string
}

export interface TaskContextCapsule {
  projects: TaskCapsuleProject[]
  endpoints: TaskCapsuleEndpoint[]
  symbols: Array<{ name: string; kind: SymbolIndexEntry['kind']; location: string; signature?: string }>
  dependencies: Array<{ relation: 'depends-on' | 'used-by'; from: string; to: string }>
  tests: Array<{ source: string; test: string; reason: TestIndexEntry['reason'] }>
  readingOrder: string[]
}

const ENTRYPOINT = /(^|\/)(package\.json|pom\.xml|build\.gradle(?:\.kts)?|settings\.gradle(?:\.kts)?|go\.mod|pyproject\.toml|requirements\.txt|Cargo\.toml|(?:main|app|server|index|entry|cli)\.[cm]?[jt]sx?|main\.(?:py|go|rs)|manage\.py|[A-Za-z0-9_$]+Application\.java)$/i
const CONFIG = /(^|\/)(tsconfig(?:\.[^/]+)?\.json|vite\.config\.[^/]+|next\.config\.[^/]+|vue\.config\.[^/]+|application[^/]*\.ya?ml|Dockerfile|docker-compose[^/]*\.ya?ml|\.env\.example)$/i
const TEST_ROOT = /(^|\/)(src\/test|tests?|__tests__|e2e)(\/|$)/i

function flatten(nodes: readonly FileTreeNode[] | undefined): string[] {
  if (nodes === undefined) return []
  const output: string[] = []
  const visit = (items: readonly FileTreeNode[]): void => {
    for (const item of items) {
      output.push(item.path)
      if (item.children !== undefined) visit(item.children)
    }
  }
  visit(nodes)
  return output
}

function uniqueLimited(values: readonly string[], limit: number): string[] {
  return [...new Set(values.filter(value => value !== ''))].slice(0, limit)
}

/**
 * 仅用于比较的规范化：统一分隔符、去掉尾分隔符。
 * Windows 上 `C:\proj` 与 `C:/proj/` 必须被视为同一目录。
 */
function compareKey(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

function absolute(root: string, relativePath: string): string {
  return root.replace(/[\\/]+$/, '') + '/' + relativePath.replace(/^[\\/]+/, '')
}

export function buildTaskContextCapsule(
  task: SessionTask,
  directories: readonly WorkspaceRef[],
  fileEntries: readonly FileIndexEntry[],
  codeEntries: readonly CodeIndexEntry[],
  symbolEntries: readonly SymbolIndexEntry[],
  dependencyEntries: readonly DependencyIndexEntry[],
  testEntries: readonly TestIndexEntry[],
  changedFiles: Readonly<Record<string, readonly string[]>>,
): TaskContextCapsule {
  const entriesByPath = new Map(fileEntries.map(entry => [entry.path, entry]))
  const projects = directories.flatMap((directory, index): TaskCapsuleProject[] => {
    if (!task.directoryPaths.includes(directory.path)) return []
    const paths = flatten(entriesByPath.get(directory.path)?.tree)
    const testRoots = uniqueLimited(paths.filter(path => TEST_ROOT.test(path)).map(path => path.split('/').slice(0, path.split('/').findIndex(part => /^(src\/test|tests?|__tests__|e2e)$/i.test(part)) + 1).join('/')).filter(Boolean), 4)
    return [{
      name: directory.name,
      path: directory.path,
      primary: index === 0,
      access: !task.allowWrites || directory.access === 'readonly' ? 'readonly' : 'readwrite',
      ...(directory.projectType === undefined ? {} : { projectType: directory.projectType }),
      ...(directory.group === undefined ? {} : { group: groupLabel(directory.group) }),
      ...(directory.commands === undefined ? {} : { commands: directory.commands }),
      entrypoints: uniqueLimited(paths.filter(path => ENTRYPOINT.test(path)), 8),
      configFiles: uniqueLimited(paths.filter(path => CONFIG.test(path)), 6),
      testRoots,
      changedFiles: uniqueLimited(changedFiles[directory.path] ?? [], 12),
    }]
  })
  const matched = codeEntries.filter(entry => matchesTaskCodeEntry(task.description, entry))
  const endpoints = matched.slice(0, 12).map(entry => ({
    feature: entry.feature,
    endpoint: entry.endpoint,
    ...(entry.confidence === undefined ? {} : { confidence: entry.confidence }),
    ...(entry.server === undefined || entry.serverDir === undefined ? {} : { server: absolute(entry.serverDir, entry.server.file) + ':' + entry.server.line }),
    ...(entry.client === undefined || entry.clientDir === undefined ? {} : { client: absolute(entry.clientDir, entry.client.file) + ':' + entry.client.line }),
  }))
  const taskWords = new Set(task.description.toLowerCase().split(/[^a-z0-9_$\u4e00-\u9fff]+/).filter(word => word.length >= 2))
  const matchedSymbols = symbolEntries.filter(symbol => {
    const lower = symbol.name.toLowerCase()
    const parts = symbol.name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[_$\s-]+/)
    return taskWords.has(lower) || parts.some(part => part.length >= 3 && taskWords.has(part)) || [...taskWords].some(word => word.length >= 4 && lower.includes(word))
  }).slice(0, 12)
  const symbols = matchedSymbols.map(symbol => ({
    name: symbol.name,
    kind: symbol.kind,
    location: absolute(symbol.dir, symbol.file) + ':' + symbol.line,
    ...(symbol.signature === undefined ? {} : { signature: symbol.signature }),
  }))
  const seedFiles = new Set<string>()
  /** 目录 + 相对文件的集合键：两侧都走 compareKey，分隔符不一致也能对上。 */
  const fileKey = (dir: string, file: string): string => compareKey(dir) + '\u0000' + compareKey(file)
  for (const [dir, files] of Object.entries(changedFiles)) files.forEach(file => seedFiles.add(fileKey(dir, file)))
  matchedSymbols.forEach(symbol => seedFiles.add(fileKey(symbol.dir, symbol.file)))
  matched.forEach(entry => {
    if (entry.server !== undefined && entry.serverDir !== undefined) seedFiles.add(fileKey(entry.serverDir, entry.server.file))
    if (entry.client !== undefined && entry.clientDir !== undefined) seedFiles.add(fileKey(entry.clientDir, entry.client.file))
  })
  const dependencySeen = new Set<string>()
  const dependencies = dependencyEntries.flatMap((entry): TaskContextCapsule['dependencies'] => {
    const fromKey = fileKey(entry.dir, entry.from)
    const toKey = fileKey(entry.dir, entry.to)
    const relation = seedFiles.has(fromKey) ? 'depends-on' : seedFiles.has(toKey) ? 'used-by' : undefined
    if (relation === undefined) return []
    const key = relation + '\u0000' + fromKey + '\u0000' + toKey
    if (dependencySeen.has(key)) return []
    dependencySeen.add(key)
    return [{ relation, from: absolute(entry.dir, entry.from), to: absolute(entry.dir, entry.to) }]
  }).slice(0, 16)
  const relevantFiles = new Set(seedFiles)
  dependencies.forEach(dependency => {
    const fromKey = compareKey(dependency.from)
    const toKey = compareKey(dependency.to)
    for (const directory of directories) {
      const prefix = compareKey(directory.path) + '/'
      if (fromKey.startsWith(prefix)) relevantFiles.add(fileKey(directory.path, fromKey.slice(prefix.length)))
      if (toKey.startsWith(prefix)) relevantFiles.add(fileKey(directory.path, toKey.slice(prefix.length)))
    }
  })
  const tests = testEntries.filter(entry => relevantFiles.has(fileKey(entry.dir, entry.source))).slice(0, 12).map(entry => ({
    source: absolute(entry.dir, entry.source),
    test: absolute(entry.dir, entry.test),
    reason: entry.reason,
  }))
  const readingOrder = uniqueLimited([
    ...projects.flatMap(project => project.changedFiles.map(file => absolute(project.path, file))),
    ...symbols.map(symbol => symbol.location),
    ...dependencies.map(dependency => dependency.relation === 'depends-on' ? dependency.to : dependency.from),
    ...tests.map(entry => entry.test),
    ...endpoints.flatMap(endpoint => [endpoint.server ?? '', endpoint.client ?? '']),
    ...projects.flatMap(project => project.entrypoints.map(file => absolute(project.path, file))),
    ...projects.flatMap(project => project.configFiles.map(file => absolute(project.path, file))),
  ], 20)
  return { projects, endpoints, symbols, dependencies, tests, readingOrder }
}
