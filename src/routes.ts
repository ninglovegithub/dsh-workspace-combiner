/**
 * /api/dsh-workspace-combiner 路由族：读写自定义工作空间。
 * 每条路由都带 loopback-only 信任栅栏 + 浏览器同源标记——这些端点读写宿主目录
 * 与配置，局域网暴露的 dsh web 部署不得对外提供。
 * @module dsh-workspace-combiner/routes
 */

import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { API, DEFAULT_CODE_INDEX_BUDGET, DEFAULT_TOKEN_BUDGET, DEFAULT_WORKSPACE_NAME, MAX_JSON_BODY_BYTES } from './invariant.ts'
import { scanDirectory } from './host/projectDetector.ts'
import { FileIndexCache } from './host/fileIndex.ts'
import { CodeIndexCache } from './host/codeIndex.ts'
import { codeIndexSignature, type FeatureSummaryCache } from './host/codeIndexSummary.ts'
import { parseWorkspaceRefs } from './core/validate.ts'
import { computeContextStats } from './host/contextStats.ts'
import { getGitStatus } from './host/gitStatus.ts'
import { syncExtraRoots } from './sandbox-sync.ts'
import { WorkspaceCombinerStore } from './store.ts'
import { loadModeMaxDepth, type LoadMode, type WorkspaceMode, type WorkspaceRef } from './core/types.ts'

/** loopback 字面量 + 浏览器同源标记（dsh-ssh 配对路由栅栏）。 */
function isLoopbackRequest(request: IncomingMessage): boolean {
  const address = request.socket.remoteAddress
  if (address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') return false
  const host = request.headers.host
  if (typeof host !== 'string') return false
  let hostUrl: URL
  try {
    hostUrl = new URL('http://' + host)
  } catch {
    return false
  }
  if (hostUrl.hostname !== '127.0.0.1' && hostUrl.hostname !== 'localhost' && hostUrl.hostname !== '[::1]') return false
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

/** 输出一段 JSON。 */
function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'referrer-policy': 'no-referrer' })
  res.end(JSON.stringify(body))
}

/** 读取 JSON 请求体（过大或不可解析返回 undefined）。 */
async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown> | undefined> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > MAX_JSON_BODY_BYTES) return undefined
    chunks.push(buffer)
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
}

/** 生成可用的文件系统文件夹名（去路径分隔符 / Windows 非法字符 / 控制字符）。 */
function sanitizeFolderName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '').trim()
  return cleaned === '' ? DEFAULT_WORKSPACE_NAME : cleaned.slice(0, 80)
}

/**
 * 构建全部路由。
 * @param ctx - 宿主上下文（用于沙盒联动）。
 * @param store - 持久化存储。
 */
export function makeRoutes(ctx: Context, store: WorkspaceCombinerStore, fileIndexCache: FileIndexCache, codeIndexCache: CodeIndexCache, summaryCache: FeatureSummaryCache): WebRoute[] {
  const guard = (req: IncomingMessage, res: ServerResponse, method: string): boolean => {
    if (!isLoopbackRequest(req)) {
      writeJson(res, 403, { error: 'forbidden: loopback-only' })
      return false
    }
    if (req.method !== method) {
      writeJson(res, 405, { error: 'method not allowed: ' + req.method })
      return false
    }
    return true
  }

  const fail = (res: ServerResponse, error: unknown): void => {
    writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
  }

  // 沙盒联动：跟踪本插件上次贡献的路径，当前工作空间目录变化时调和白名单。
  // 只有「读写」目录进入可写白名单；只读/禁用目录保持不可写（读本就不受限）。
  const writablePaths = (dirs: readonly WorkspaceRef[]): string[] =>
    dirs.filter(d => (d.access ?? 'readwrite') === 'readwrite').map(d => d.path)
  let lastSyncedPaths: string[] = []
  void store.getCurrentWorkspace().then(ws => { lastSyncedPaths = writablePaths(ws?.directories ?? []) })
  const syncCurrent = async (): Promise<void> => {
    const ws = await store.getCurrentWorkspace()
    const next = writablePaths(ws?.directories ?? [])
    await syncExtraRoots(ctx, lastSyncedPaths, next)
    lastSyncedPaths = next
  }

  return [
    // ---------------------------------------------------------- state
    {
      kind: 'exact',
      path: API.state,
      handler: async (req, res) => {
        if (!guard(req, res, 'GET')) return
        try {
          const state = await store.getState()
          writeJson(res, 200, { currentWorkspaceId: state.currentWorkspaceId, workspaces: state.workspaces })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- workspace-create
    {
      kind: 'exact',
      path: API.workspaceCreate,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        if (body === undefined) {
          writeJson(res, 400, { error: 'invalid JSON body' })
          return
        }
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        if (name === '') {
          writeJson(res, 400, { error: 'name is required' })
          return
        }
        const basePath = typeof body.basePath === 'string' ? body.basePath.trim() : ''
        const mode: WorkspaceMode = body.mode === 'single' ? 'single' : 'anchor'
        const loadMode: LoadMode = body.loadMode === 'full' || body.loadMode === 'tree' ? body.loadMode : 'summary'
        const directories = parseWorkspaceRefs(body.directories) ?? []
        if (basePath === '') {
          writeJson(res, 400, { error: 'basePath is required' })
          return
        }
        try {
          // 在 base 路径下创建与名称同名的工作文件夹，作为主目录（文档等非代码文件保存区）。
          const folderName = sanitizeFolderName(name)
          const targetPath = join(basePath, folderName)
          await mkdir(targetPath, { recursive: true })
          const primary: WorkspaceRef = { id: targetPath, name: folderName, path: targetPath, isPrimary: true, access: 'readwrite' }
          const allDirectories: WorkspaceRef[] = [primary, ...directories.filter(d => d.path !== targetPath)]
          const workspace = await store.createWorkspace(name, undefined, allDirectories, mode, loadMode)
          await syncCurrent()
          writeJson(res, 201, { workspace, currentWorkspaceId: workspace.id })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- scan
    {
      kind: 'exact',
      path: API.scan,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const path = body === undefined ? '' : typeof body.path === 'string' ? body.path.trim() : ''
        if (path === '') {
          writeJson(res, 400, { error: 'path is required' })
          return
        }
        try {
          const projects = await scanDirectory(path)
          writeJson(res, 200, { projects })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- workspace-rename
    {
      kind: 'exact',
      path: API.workspaceRename,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const id = body === undefined ? '' : typeof body.id === 'string' ? body.id : ''
        const name = body === undefined ? '' : typeof body.name === 'string' ? body.name.trim() : ''
        if (id === '' || name === '') {
          writeJson(res, 400, { error: 'id and name are required' })
          return
        }
        try {
          await store.renameWorkspace(id, name)
          writeJson(res, 200, { ok: true })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- workspace-delete
    {
      kind: 'exact',
      path: API.workspaceDelete,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const id = body === undefined ? '' : typeof body.id === 'string' ? body.id : ''
        if (id === '') {
          writeJson(res, 400, { error: 'id is required' })
          return
        }
        try {
          const nextCurrent = await store.deleteWorkspace(id)
          await syncCurrent()
          writeJson(res, 200, { ok: true, currentWorkspaceId: nextCurrent })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- workspace-switch
    {
      kind: 'exact',
      path: API.workspaceSwitch,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const id = body === undefined ? '' : typeof body.id === 'string' ? body.id : ''
        if (id === '') {
          writeJson(res, 400, { error: 'id is required' })
          return
        }
        try {
          await store.switchWorkspace(id)
          await syncCurrent()
          writeJson(res, 200, { ok: true })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- workspace-directories
    {
      kind: 'exact',
      path: API.workspaceDirectories,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const id = body === undefined ? '' : typeof body.id === 'string' ? body.id : ''
        const directories = body === undefined ? undefined : parseWorkspaceRefs(body.directories)
        if (id === '' || directories === undefined) {
          writeJson(res, 400, { error: 'id and directories are required' })
          return
        }
        try {
          await store.setWorkspaceDirectories(id, directories)
          if (id === (await store.getCurrentWorkspaceId())) await syncCurrent()
          writeJson(res, 200, { ok: true })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- workspace-mode
    {
      kind: 'exact',
      path: API.workspaceMode,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const id = body === undefined ? '' : typeof body.id === 'string' ? body.id : ''
        const mode: WorkspaceMode | '' = body === undefined ? '' : body.mode === 'single' ? 'single' : body.mode === 'anchor' ? 'anchor' : ''
        if (id === '' || mode === '') {
          writeJson(res, 400, { error: 'id and mode are required' })
          return
        }
        try {
          await store.setWorkspaceMode(id, mode)
          writeJson(res, 200, { ok: true })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- workspace-patch
    {
      kind: 'exact',
      path: API.workspacePatch,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const id = body === undefined ? '' : typeof body.id === 'string' ? body.id : ''
        if (id === '') {
          writeJson(res, 400, { error: 'id is required' })
          return
        }
        const mode: WorkspaceMode | '' = body === undefined ? '' : body.mode === 'single' ? 'single' : body.mode === 'anchor' ? 'anchor' : ''
        const loadMode: LoadMode | '' = body === undefined ? '' : body.loadMode === 'full' || body.loadMode === 'summary' || body.loadMode === 'tree' ? body.loadMode : ''
        const pinned = body !== undefined && typeof body.pinned === 'boolean' ? body.pinned : undefined
        const color = body !== undefined && typeof body.color === 'string' && body.color !== '' ? body.color : undefined
        const tokenBudget = body !== undefined && typeof body.tokenBudget === 'number' && Number.isFinite(body.tokenBudget) && body.tokenBudget > 0 ? body.tokenBudget : undefined
        const codeIndexEnabled = body !== undefined && typeof body.codeIndexEnabled === 'boolean' ? body.codeIndexEnabled : undefined
        const codeIndexBudget = body !== undefined && typeof body.codeIndexBudget === 'number' && Number.isFinite(body.codeIndexBudget) && body.codeIndexBudget > 0 ? body.codeIndexBudget : undefined
        const codeIndexSummary = body !== undefined && (body.codeIndexSummary === 'off' || body.codeIndexSummary === 'llm') ? body.codeIndexSummary : undefined
        try {
          if (mode !== '') await store.setWorkspaceMode(id, mode)
          if (loadMode !== '') await store.setLoadMode(id, loadMode)
          if (pinned !== undefined || color !== undefined || tokenBudget !== undefined || codeIndexEnabled !== undefined || codeIndexBudget !== undefined || codeIndexSummary !== undefined) {
            await store.patchMeta(id, {
              ...(pinned !== undefined ? { pinned } : {}),
              ...(color !== undefined ? { color } : {}),
              ...(tokenBudget !== undefined ? { tokenBudget } : {}),
              ...(codeIndexEnabled !== undefined ? { codeIndexEnabled } : {}),
              ...(codeIndexBudget !== undefined ? { codeIndexBudget } : {}),
              ...(codeIndexSummary !== undefined ? { codeIndexSummary } : {}),
            })
          }
          writeJson(res, 200, { ok: true })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- workspace-loadmode
    {
      kind: 'exact',
      path: API.workspaceLoadMode,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const id = body === undefined ? '' : typeof body.id === 'string' ? body.id : ''
        const loadMode: LoadMode | '' = body === undefined ? '' : body.loadMode === 'full' || body.loadMode === 'summary' || body.loadMode === 'tree' ? body.loadMode : ''
        if (id === '' || loadMode === '') {
          writeJson(res, 400, { error: 'id and loadMode are required' })
          return
        }
        try {
          await store.setLoadMode(id, loadMode)
          writeJson(res, 200, { ok: true })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- workspace-snapshot
    {
      kind: 'exact',
      path: API.workspaceSnapshot,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const id = body === undefined ? '' : typeof body.id === 'string' ? body.id : ''
        const action = body === undefined ? '' : typeof body.action === 'string' ? body.action : ''
        const name = body === undefined ? '' : typeof body.name === 'string' ? body.name.trim() : ''
        const snapshotId = body === undefined ? '' : typeof body.snapshotId === 'string' ? body.snapshotId : ''
        if (id === '' || action === '') {
          writeJson(res, 400, { error: 'id and action are required' })
          return
        }
        try {
          if (action === 'save') {
            if (name === '') { writeJson(res, 400, { error: 'name is required' }); return }
            await store.saveSnapshot(id, name)
          } else if (action === 'restore') {
            if (snapshotId === '') { writeJson(res, 400, { error: 'snapshotId is required' }); return }
            await store.restoreSnapshot(id, snapshotId)
            if (id === (await store.getCurrentWorkspaceId())) await syncCurrent()
          } else if (action === 'delete') {
            if (snapshotId === '') { writeJson(res, 400, { error: 'snapshotId is required' }); return }
            await store.deleteSnapshot(id, snapshotId)
          } else {
            writeJson(res, 400, { error: 'unknown action' })
            return
          }
          writeJson(res, 200, { ok: true })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- stat
    {
      kind: 'exact',
      path: API.stat,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const path = body === undefined ? '' : typeof body.path === 'string' ? body.path.trim() : ''
        if (path === '') {
          writeJson(res, 400, { error: 'path is required' })
          return
        }
        // 轻量存在性探测：目录失效检测用它替代 file-index，避免只为判断存在就构建整棵文件树。
        try {
          const info = await stat(path)
          writeJson(res, 200, { exists: true, isDirectory: info.isDirectory() })
        } catch {
          writeJson(res, 200, { exists: false, isDirectory: false })
        }
      },
    },
    // ---------------------------------------------------------- file-index
    {
      kind: 'exact',
      path: API.fileIndex,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const path = body === undefined ? '' : typeof body.path === 'string' ? body.path.trim() : ''
        if (path === '') {
          writeJson(res, 400, { error: 'path is required' })
          return
        }
        // 调用方传 loadMode，保证树深度与注入 prompt 一致，也复用同一份扫描缓存。
        const loadMode: LoadMode = body !== undefined && (body.loadMode === 'full' || body.loadMode === 'tree' || body.loadMode === 'summary') ? body.loadMode : 'tree'
        try {
          // FileIndexCache 对无法 stat 的路径会返回空树。这对 prompt 渲染很宽容，
          // 但 API 调用方需要区分“空目录”和“目录不存在”，否则 UI 无法标红失效路径。
          const info = await stat(path)
          if (!info.isDirectory()) {
            throw new Error('path is not a directory: ' + path)
          }
          const tree = await fileIndexCache.get(path, { maxDepth: loadModeMaxDepth(loadMode) })
          const counts = await fileIndexCache.count(path)
          writeJson(res, 200, { root: path, files: counts.files, dirs: counts.dirs, truncated: counts.truncated, loadMode, tree })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- git-status
    {
      kind: 'exact',
      path: API.gitStatus,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const path = body === undefined ? '' : typeof body.path === 'string' ? body.path.trim() : ''
        if (path === '') {
          writeJson(res, 400, { error: 'path is required' })
          return
        }
        try {
          const status = await getGitStatus(path)
          writeJson(res, 200, { status })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- code-index
    {
      kind: 'exact',
      path: API.codeIndex,
      handler: async (req, res) => {
        if (!guard(req, res, 'GET')) return
        try {
          const ws = await store.getCurrentWorkspace()
          if (ws === undefined || (ws.codeIndexEnabled ?? true) !== true) {
            writeJson(res, 200, { entries: [] })
            return
          }
          const raw = await codeIndexCache.get(ws.directories)
          const summaries = await summaryCache.get(codeIndexSignature(raw))
          const entries = summaries === undefined ? raw : raw.map(entry => summaries.has(entry.feature) ? { ...entry, summary: summaries.get(entry.feature) } : entry)
          writeJson(res, 200, { entries })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- context-stats
    {
      kind: 'exact',
      path: API.contextStats,
      handler: async (req, res) => {
        if (!guard(req, res, 'GET')) return
        try {
          const ws = await store.getCurrentWorkspace()
          if (ws === undefined) {
            writeJson(res, 200, { loadMode: 'summary', directories: [], totalFiles: 0, totalDirs: 0, fileIndexTokens: 0, promptOverheadTokens: 0 })
            return
          }
          const codeIndexEnabled = ws.codeIndexEnabled ?? true
          const summaries = codeIndexEnabled ? await summaryCache.get(codeIndexSignature(await codeIndexCache.get(ws.directories))) : undefined
          const stats = await computeContextStats(ws.directories, ws.mode ?? 'anchor', ws.loadMode ?? 'summary', fileIndexCache, ws.tokenBudget ?? DEFAULT_TOKEN_BUDGET, codeIndexCache, {
            enabled: codeIndexEnabled,
            budget: ws.codeIndexBudget ?? DEFAULT_CODE_INDEX_BUDGET,
            ...(summaries === undefined ? {} : { summaries }),
          })
          writeJson(res, 200, stats)
        } catch (error) {
          fail(res, error)
        }
      },
    },
  ]
}
