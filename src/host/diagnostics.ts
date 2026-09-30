/**
 * 诊断中心宿主聚合层：复用现有索引、预算、沙盒和会话状态。
 * @module dsh-workspace-combiner/host/diagnostics
 */

import type { Context } from '@deepseek-ai/cordis'
import { readFile, stat } from 'node:fs/promises'
import type { DiagnosticItem, DiagnosticReport, TokenUsageReport, Workspace } from '../core/types.ts'
import { summarizeDiagnostics } from '../core/diagnostics.ts'
import { inspectExtraRoots } from '../sandbox-sync.ts'
import { defaultStoreFile } from '../store.ts'
import type { FileIndexCache } from './fileIndex.ts'
import type { CodeIndexCache } from './codeIndex.ts'
import type { ContextStats } from '../core/types.ts'

export interface DiagnosticDeps {
  ctx: Context
  workspace: Workspace | undefined
  fileIndexCache: FileIndexCache
  codeIndexCache: CodeIndexCache
  contextStats: ContextStats
  tokenUsage: TokenUsageReport
  sessions: readonly string[]
  sessionVersions: readonly number[]
}

async function pluginVersion(): Promise<string> {
  try {
    const raw = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as { version?: unknown }
    return typeof raw.version === 'string' ? raw.version : 'unknown'
  } catch {
    return 'unknown'
  }
}

function serviceAvailable(ctx: Context, name: string): boolean {
  try { return ctx.get(name) !== undefined } catch { return false }
}

export async function buildDiagnosticReport(deps: DiagnosticDeps): Promise<DiagnosticReport> {
  const { ctx, workspace, fileIndexCache, codeIndexCache, contextStats, tokenUsage, sessions, sessionVersions } = deps
  const items: DiagnosticItem[] = []
  const directories = workspace?.directories ?? []
  const active = directories.filter(directory => (directory.access ?? 'readwrite') !== 'disabled')
  const invalid: string[] = []
  await Promise.all(active.map(async directory => {
    try { if (!(await stat(directory.path)).isDirectory()) invalid.push(directory.path) } catch { invalid.push(directory.path) }
  }))
  items.push({ id: 'directories', status: invalid.length === 0 ? 'ok' : 'error', data: { total: active.length, invalid: invalid.length }, ...(invalid.length > 0 ? { paths: invalid } : {}) })

  const writable = directories.filter(directory => (directory.access ?? 'readwrite') === 'readwrite').map(directory => directory.path)
  const sandbox = await inspectExtraRoots(ctx, writable)
  items.push({ id: 'sandbox-service', status: sandbox.remoteAvailable ? 'ok' : sandbox.configReadable ? 'warning' : 'error', data: { remote: sandbox.remoteAvailable, configExists: sandbox.configExists, configReadable: sandbox.configReadable }, action: 'sync-sandbox' })
  items.push({ id: 'writable-roots', status: sandbox.missingExpected.length === 0 ? 'ok' : 'error', data: { expected: writable.length, synced: writable.length - sandbox.missingExpected.length }, ...(sandbox.missingExpected.length > 0 ? { paths: sandbox.missingExpected } : {}), action: 'sync-sandbox' })

  const requiredServices = ['webServer', 'systemPrompt']
  const availableServices = requiredServices.filter(name => serviceAvailable(ctx, name)).length
  items.push({ id: 'host-services', status: availableServices === requiredServices.length ? 'ok' : 'error', data: { available: availableServices, total: requiredServices.length } })
  items.push({ id: 'sessions', status: sessions.length > 0 ? 'ok' : 'warning', data: { count: sessions.length } })
  const staleSessions = workspace === undefined ? 0 : sessionVersions.filter(version => version < workspace.updatedAt).length
  items.push({ id: 'session-config', status: sessions.length === 0 ? 'unknown' : staleSessions === 0 ? 'ok' : 'warning', data: { stale: staleSessions, total: sessions.length }, action: 'refresh-sessions' })

  let fileIndexStatus: DiagnosticItem['status'] = invalid.length > 0 ? 'warning' : 'ok'
  let indexedDirectories = 0
  try {
    for (const directory of active) {
      if (invalid.includes(directory.path)) continue
      await fileIndexCache.count(directory.path)
      indexedDirectories++
    }
  } catch { fileIndexStatus = 'error' }
  items.push({ id: 'file-index-cache', status: fileIndexStatus, data: { indexed: indexedDirectories, total: active.length }, action: 'refresh-caches' })

  let codeEntries = 0
  let codeStatus: DiagnosticItem['status'] = (workspace?.codeIndexEnabled ?? true) ? 'ok' : 'unknown'
  try {
    if (workspace !== undefined && (workspace.codeIndexEnabled ?? true)) codeEntries = (await codeIndexCache.get(workspace.directories)).entries.length
  } catch { codeStatus = 'error' }
  items.push({ id: 'code-index-cache', status: codeStatus, data: { entries: codeEntries, enabled: workspace?.codeIndexEnabled ?? true }, action: 'refresh-caches' })

  const actualPrompt = tokenUsage.latest?.promptTokens ?? 0
  const estimated = contextStats.totalTokens
  const difference = actualPrompt > 0 ? Math.round(Math.abs(actualPrompt - estimated) / Math.max(actualPrompt, estimated, 1) * 100) : 0
  items.push({ id: 'token-alignment', status: actualPrompt === 0 ? 'unknown' : difference > 70 ? 'warning' : 'ok', data: { estimated, actual: actualPrompt, difference } })

  const codeDirectories = active.slice(1)
  const missingCommands = codeDirectories.filter(directory => {
    const commands = directory.commands
    return commands === undefined || [commands.run, commands.test, commands.build].every(command => command === undefined || command.trim() === '')
  }).map(directory => directory.path)
  items.push({ id: 'commands', status: missingCommands.length === 0 ? 'ok' : 'warning', data: { missing: missingCommands.length, total: codeDirectories.length }, ...(missingCommands.length > 0 ? { paths: missingCommands } : {}) })

  const threshold = Math.max(10_000, Math.round(contextStats.globalBudget * 0.45))
  const largeDirectories = contextStats.directories.filter(directory => directory.tokens > threshold || directory.files >= 20_000).map(directory => directory.path)
  items.push({ id: 'large-directories', status: largeDirectories.length === 0 ? 'ok' : 'warning', data: { count: largeDirectories.length, threshold }, ...(largeDirectories.length > 0 ? { paths: largeDirectories } : {}) })

  let storeReadable = false
  let storeVersion = 0
  try {
    const parsed: unknown = JSON.parse(await readFile(defaultStoreFile(), 'utf8'))
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      storeVersion = typeof (parsed as { version?: unknown }).version === 'number' ? (parsed as { version: number }).version : 0
      storeReadable = Array.isArray((parsed as { workspaces?: unknown }).workspaces)
    }
  } catch {
    storeReadable = false
  }
  items.push({ id: 'store-config', status: !storeReadable ? 'error' : storeVersion === 2 ? 'ok' : 'warning', data: { readable: storeReadable, version: storeVersion, expected: 2 } })
  items.push({ id: 'versions', status: storeVersion === 2 ? 'ok' : 'warning', data: { plugin: await pluginVersion(), schema: storeVersion, expected: 2 } })

  return { generatedAt: Date.now(), ...(workspace === undefined ? {} : { workspaceId: workspace.id }), summary: summarizeDiagnostics(items), items }
}
