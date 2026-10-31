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
import { dirname, isAbsolute, join, relative } from 'node:path'
import { API, DEFAULT_CODE_INDEX_BUDGET, DEFAULT_COMMANDS_BUDGET, DEFAULT_STANDARDS_BUDGET, DEFAULT_TOKEN_BUDGET, DEFAULT_WORKSPACE_NAME, MAX_JSON_BODY_BYTES } from './invariant.ts'
import { scanDirectory } from './host/projectDetector.ts'
import { FileIndexCache } from './host/fileIndex.ts'
import { CodeIndexCache, findEndpointImpact } from './host/codeIndex.ts'
import type { TokenUsageTracker } from './host/tokenUsage.ts'
import { codeIndexSignature, type FeatureSummaryCache } from './host/codeIndexSummary.ts'
import { StandardsLibraryStore, parseLibrary } from './host/standardsLibrary.ts'
import { generateStandardDraft } from './host/standardsAi.ts'
import { resolveStandardGroups } from './core/standards.ts'
import { parseWorkspaceRefs } from './core/validate.ts'
import { computeContextStats } from './host/contextStats.ts'
import { getChangedFiles, getGitStatus } from './host/gitStatus.ts'
import { WorkspaceCombinerStore } from './store.ts'
import { loadModeMaxDepth, type DiagnosticAction, type LoadMode, type TokenUsageReport, type WorkspaceMode, type WorkspaceRef } from './core/types.ts'
import { parseSessionTask, type SessionTask } from './core/task.ts'
import { resolveWorkspaceContext } from './core/contextPreset.ts'
import { buildDiagnosticReport } from './host/diagnostics.ts'
import { readWorkspaceRegistry, retireDshWorkspace, retitleDshWorkspace, type DshRetireResult } from './host/dshWorkspaces.ts'
import { pathKey } from './sandbox-sync.ts'
import { sanitizeFolderName } from './core/folderName.ts'

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

/** 读取 GET 路由的查询参数（缺失或 URL 非法时返回空串）。 */
function queryParam(request: IncomingMessage, name: string): string {
  try {
    return new URL(request.url ?? '/', 'http://127.0.0.1').searchParams.get(name)?.trim() ?? ''
  } catch {
    return ''
  }
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

/**
 * `child` 是否等于 `parent` 或位于 `parent` 之内。
 * 用 `relative` 判断而不是字符串前缀：Windows 上 `C:\proj` 与 `C:/proj/x`
 * 分隔符不同，硬编码 '/' 的 `startsWith` 永远不成立（改动反查会恒为空）。
 */
function isSameOrInside(parent: string, child: string): boolean {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** token 用量路由所需的宿主侧依赖。 */
export interface TokenUsageDeps {
  /** 宿主进程实际加载的插件版本（用于界面显示"是否已重载"）。 */
  pluginVersion?: string
  tokenUsage: TokenUsageTracker
  /** 某工作空间关联的会话 id 列表（会话 -> 工作空间绑定在 session/created 时确定）。 */
  sessionsOfWorkspace(workspaceId: string): readonly string[]
  /** 各关联会话当前加载的工作空间配置时间戳。 */
  sessionVersionsOfWorkspace(workspaceId: string): readonly number[]
  /** 工作空间配置变化后刷新其在跑会话的上下文快照（新增项目立即可用，无需新建会话）。 */
  refreshSessions(workspaceId: string): void
  /** 刷新单个会话的上下文快照；返回它绑定的工作空间 id，未绑定返回 undefined。 */
  refreshSession(sessionId: string): Promise<string | undefined>
  /** 绑定一次性任务上下文；允许早于 session/created 到达。 */
  setSessionTask(sessionId: string, task: SessionTask): void
  /**
   * 重算并写入沙盒额外可写根白名单。范围是「当前工作空间 ∪ 全部活动会话绑定的
   * 工作空间」的可写目录——只跟随当前工作空间会把另一个活会话的写权限静默吊销。
   * @returns 是否写入成功。
   */
  syncSandbox(): Promise<boolean>
}

/**
 * 构建全部路由。
 * @param ctx - 宿主上下文（用于沙盒联动）。
 * @param store - 持久化存储。
 * @param usage - token 用量观测与工作空间会话映射。
 */
export function makeRoutes(ctx: Context, store: WorkspaceCombinerStore, fileIndexCache: FileIndexCache, codeIndexCache: CodeIndexCache, summaryCache: FeatureSummaryCache, standardsLibrary: StandardsLibraryStore, usage: TokenUsageDeps): WebRoute[] {
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

  /**
   * 工作空间是否存在。store 的变更方法对未知 id 是静默 no-op，路由若照样回
   * `ok: true`，客户端就分不清「改成功了」和「什么都没改」。未知 id 一律 404。
   */
  const workspaceExists = async (id: string): Promise<boolean> =>
    (await store.getWorkspaces()).some(workspace => workspace.id === id)

  /** 未知工作空间 id 时回 404 并返回 false。 */
  const guardWorkspace = async (res: ServerResponse, id: string): Promise<boolean> => {
    if (await workspaceExists(id)) return true
    writeJson(res, 404, { error: 'unknown workspace id' })
    return false
  }

  // 沙盒联动：白名单的「当前工作空间 ∪ 全部活动会话绑定的工作空间」并集由宿主
  // 计算（见 host/index.ts 的 syncSandbox），这里只负责调用并把结果如实回给客户端
  // ——静默吞掉失败会让人以为写权限已经放开。
  const syncCurrent = async (): Promise<boolean> => await usage.syncSandbox()

  const contextStatsOf = async () => {
    const ws = await store.getCurrentWorkspace()
    if (ws === undefined) return { preset: 'custom' as const, loadMode: 'summary' as const, directories: [], totalFiles: 0, totalDirs: 0, fileIndexTokens: 0, promptOverheadTokens: 0, standardsTokens: 0, standardsContentTokens: 0, codeIndexTokens: 0, commandsTokens: 0, totalTokens: 0, globalBudget: DEFAULT_TOKEN_BUDGET, degradations: [] }
    const context = resolveWorkspaceContext(ws)
    const codeIndexEnabled = ws.codeIndexEnabled ?? true
    const summaries = codeIndexEnabled ? await summaryCache.get(codeIndexSignature((await codeIndexCache.get(ws.directories)).entries)) : undefined
    const standardGroups = resolveStandardGroups(ws.standards, ws.directories, await standardsLibrary.get())
    return await computeContextStats({
      directories: ws.directories,
      mode: ws.mode ?? 'anchor',
      loadMode: context.loadMode,
      fileIndexCache,
      preset: context.preset,
      globalBudget: context.globalBudget,
      fileIndexBudget: context.fileIndexBudget,
      codeIndexCache,
      codeConfig: { enabled: codeIndexEnabled, budget: context.codeIndexBudget, ...(summaries === undefined ? {} : { summaries }) },
      standardGroups,
      standardsBudget: context.standardsBudget,
      commandsBudget: context.commandsBudget,
      contextScope: 'workspace-preview:' + ws.id,
    })
  }

  const tokenUsageOf = async (): Promise<TokenUsageReport> => {
    const ws = await store.getCurrentWorkspace()
    const sessionIds = ws === undefined ? [] : usage.sessionsOfWorkspace(ws.id)
    const active = usage.tokenUsage.latestSessionId()
    const latestId = sessionIds.includes(active)
      ? active
      : [...sessionIds].reverse().find(id => usage.tokenUsage.latestOf(id) !== null) ?? ''
    const info = latestId === '' ? null : usage.tokenUsage.latestOf(latestId)
    return {
      sessions: sessionIds.length,
      totals: usage.tokenUsage.summarize(sessionIds),
      latest: info === null ? null : { sessionId: latestId, ...info },
    }
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
          writeJson(res, 200, {
            currentWorkspaceId: state.currentWorkspaceId,
            workspaces: state.workspaces,
            ...(usage.pluginVersion === undefined ? {} : { version: usage.pluginVersion }),
          })
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
          const sandboxSynced = await syncCurrent()
          writeJson(res, 201, { workspace, currentWorkspaceId: workspace.id, sandboxSynced })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ------------------------------------------------------ workspace-duplicate
    {
      kind: 'exact',
      path: API.workspaceDuplicate,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        if (body === undefined) {
          writeJson(res, 400, { error: 'invalid JSON body' })
          return
        }
        const sourceId = typeof body.sourceId === 'string' ? body.sourceId.trim() : ''
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        if (sourceId === '' || name === '') {
          writeJson(res, 400, { error: 'sourceId and name are required' })
          return
        }
        try {
          const before = await store.getState()
          const source = before.workspaces.find(w => w.id === sourceId)
          if (source === undefined) {
            writeJson(res, 404, { error: 'workspace not found' })
            return
          }
          if (before.workspaces.some(w => w.name === name)) {
            writeJson(res, 409, { error: 'workspace name already exists' })
            return
          }
          // 副本要有自己的锚点目录：否则两边的快捷会话会落进同一个 DSH 工作区
          // （DSH 按目录归属工作区），文档也会写到同一处。代码项目目录保持不变。
          const sourcePrimary = source.directories[0]?.path ?? ''
          const folderName = sanitizeFolderName(name)
          const directories: WorkspaceRef[] = source.directories.map(directory => ({ ...directory }))
          if (sourcePrimary !== '') {
            const targetPath = join(dirname(sourcePrimary), folderName)
            await mkdir(targetPath, { recursive: true })
            if (directories.length === 0) {
              directories.push({ id: targetPath, name: folderName, path: targetPath, isPrimary: true, access: 'readwrite' })
            } else {
              directories[0] = { ...directories[0], id: targetPath, name: folderName, path: targetPath, isPrimary: true }
            }
          }
          const workspace = await store.duplicateWorkspace(sourceId, name, directories)
          const sandboxSynced = await syncCurrent()
          writeJson(res, 201, { workspace, currentWorkspaceId: workspace.id, sandboxSynced })
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
          if (!(await guardWorkspace(res, id))) return
          const before = await store.getState()
          const target = before.workspaces.find(w => w.id === id)
          await store.renameWorkspace(id, name)

          // 插件内重名会自动加 (2) 之类后缀：DSH 左栏的显示名必须跟着改，否则两边对不上。
          // 只改「主目录（锚点）」对应的那个 DSH 工作区——别的目录共用与否与显示名无关。
          const primary = target?.directories[0]?.path ?? ''
          const dshRenamed = await retitleDshWorkspace(readWorkspaceRegistry(ctx), primary, name)
          writeJson(res, 200, { ok: true, dshRenamed })
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
          if (!(await guardWorkspace(res, id))) return
          const before = await store.getState()
          const target = before.workspaces.find(w => w.id === id)
          const nextCurrent = await store.deleteWorkspace(id)
          const sandboxSynced = await syncCurrent()

          // DSH 侧清理：归档该工作区的会话并移除工作区条目。
          // 只处理「删除后已没有任何插件工作空间再用」的目录——复制出来的副本会共享目录。
          const registry = readWorkspaceRegistry(ctx)
          const stillUsed = new Set(
            (await store.getState()).workspaces.flatMap(w => w.directories.map(d => pathKey(d.path))),
          )
          const dshRetired: DshRetireResult[] = []
          for (const directory of target?.directories ?? []) {
            if (stillUsed.has(pathKey(directory.path))) continue
            const result = await retireDshWorkspace(registry, directory.path)
            if (result.archived.length > 0 || result.removed) dshRetired.push(result)
          }

          writeJson(res, 200, { ok: true, currentWorkspaceId: nextCurrent, sandboxSynced, dshRetired })
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
          if (!(await guardWorkspace(res, id))) return
          await store.switchWorkspace(id)
          const sandboxSynced = await syncCurrent()
          writeJson(res, 200, { ok: true, sandboxSynced })
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
          if (!(await guardWorkspace(res, id))) return
          await store.setWorkspaceDirectories(id, directories)
          const sandboxSynced = id === (await store.getCurrentWorkspaceId()) ? await syncCurrent() : true
          // 增删项目后刷新在跑的会话：下一个模型步就能看到新目录，不必新建会话。
          usage.refreshSessions(id)
          writeJson(res, 200, { ok: true, sandboxSynced })
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
          if (!(await guardWorkspace(res, id))) return
          await store.setWorkspaceMode(id, mode)
          // 模式会改变注入内容（锚点/单项目），同样刷新在跑的会话。
          usage.refreshSessions(id)
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
        const contextPreset = body !== undefined && (body.contextPreset === 'economy' || body.contextPreset === 'balanced' || body.contextPreset === 'deep' || body.contextPreset === 'custom') ? body.contextPreset : undefined
        const fileIndexBudget = body !== undefined && typeof body.fileIndexBudget === 'number' && Number.isFinite(body.fileIndexBudget) && body.fileIndexBudget >= 0 ? body.fileIndexBudget : undefined
        const commandsBudget = body !== undefined && typeof body.commandsBudget === 'number' && Number.isFinite(body.commandsBudget) && body.commandsBudget >= 0 ? body.commandsBudget : undefined
        const codeIndexEnabled = body !== undefined && typeof body.codeIndexEnabled === 'boolean' ? body.codeIndexEnabled : undefined
        // 0 = 不注入上下文（改为按需查索引文件），必须放行；只有非法值才落回 undefined。
        const codeIndexBudget = body !== undefined && typeof body.codeIndexBudget === 'number' && Number.isFinite(body.codeIndexBudget) && body.codeIndexBudget >= 0 ? body.codeIndexBudget : undefined
        const codeIndexSummary = body !== undefined && (body.codeIndexSummary === 'off' || body.codeIndexSummary === 'llm') ? body.codeIndexSummary : undefined
        try {
          if (mode !== '') await store.setWorkspaceMode(id, mode)
          if (loadMode !== '') await store.setLoadMode(id, loadMode)
          if (pinned !== undefined || color !== undefined || contextPreset !== undefined || tokenBudget !== undefined || fileIndexBudget !== undefined || commandsBudget !== undefined || codeIndexEnabled !== undefined || codeIndexBudget !== undefined || codeIndexSummary !== undefined) {
            await store.patchMeta(id, {
              ...(pinned !== undefined ? { pinned } : {}),
              ...(color !== undefined ? { color } : {}),
              ...(contextPreset !== undefined ? { contextPreset } : {}),
              ...(tokenBudget !== undefined ? { tokenBudget } : {}),
              ...(fileIndexBudget !== undefined ? { fileIndexBudget } : {}),
              ...(commandsBudget !== undefined ? { commandsBudget } : {}),
              ...(codeIndexEnabled !== undefined ? { codeIndexEnabled } : {}),
              ...(codeIndexBudget !== undefined ? { codeIndexBudget } : {}),
              ...(codeIndexSummary !== undefined ? { codeIndexSummary } : {}),
            })
          }
          // 模式/加载模式/预算/功能索引都会改变注入内容，同样立刻刷新在跑的会话。
          usage.refreshSessions(id)
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
          // 加载模式决定文件索引深度，同样刷新在跑的会话。
          usage.refreshSessions(id)
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
        let sandboxSynced = true
        try {
          if (action === 'save') {
            if (name === '') { writeJson(res, 400, { error: 'name is required' }); return }
            if (!(await guardWorkspace(res, id))) return
          await store.saveSnapshot(id, name)
          } else if (action === 'restore') {
            if (snapshotId === '') { writeJson(res, 400, { error: 'snapshotId is required' }); return }
            await store.restoreSnapshot(id, snapshotId)
            sandboxSynced = id === (await store.getCurrentWorkspaceId()) ? await syncCurrent() : true
            // 还快照换的是目录列表，同样刷新在跑的会话。
            usage.refreshSessions(id)
          } else if (action === 'delete') {
            if (snapshotId === '') { writeJson(res, 400, { error: 'snapshotId is required' }); return }
            await store.deleteSnapshot(id, snapshotId)
          } else {
            writeJson(res, 400, { error: 'unknown action' })
            return
          }
          writeJson(res, 200, { ok: true, sandboxSynced })
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
          const raw = (await codeIndexCache.get(ws.directories)).entries
          const summaries = await summaryCache.get(codeIndexSignature(raw))
          const entries = summaries === undefined ? raw : raw.map(entry => summaries.has(entry.feature) ? { ...entry, summary: summaries.get(entry.feature) } : entry)
          writeJson(res, 200, { entries })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- standards（全局规范库）
    {
      kind: 'exact',
      path: API.standards,
      handler: async (req, res) => {
        if (req.method === 'GET') {
          if (!guard(req, res, 'GET')) return
          try {
            writeJson(res, 200, { library: await standardsLibrary.get() })
          } catch (error) {
            fail(res, error)
          }
          return
        }
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        if (body === undefined || body.library === undefined) {
          writeJson(res, 400, { error: 'library is required' })
          return
        }
        try {
          await standardsLibrary.replace(parseLibrary(body.library))
          writeJson(res, 200, { ok: true })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- workspace-standards（工作空间绑定）
    {
      kind: 'exact',
      path: API.workspaceStandards,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const id = body === undefined ? '' : typeof body.id === 'string' ? body.id : ''
        const standards = body === undefined ? undefined : body.standards
        if (id === '' || standards === undefined || standards === null || typeof standards !== 'object') {
          writeJson(res, 400, { error: 'id and standards are required' })
          return
        }
        try {
          if (!(await guardWorkspace(res, id))) return
          await store.setWorkspaceStandards(id, standards as never)
          // 开发规范也是注入内容的一部分，改了同样刷新在跑的会话。
          usage.refreshSessions(id)
          writeJson(res, 200, { ok: true })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- standards-ai（用模型起草规范正文）
    {
      kind: 'exact',
      path: API.standardsAi,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const name = body === undefined ? '' : typeof body.name === 'string' ? body.name.trim() : ''
        if (name === '') {
          writeJson(res, 400, { error: 'name is required' })
          return
        }
        const tech = body !== undefined && typeof body.tech === 'string' && body.tech !== '' ? body.tech : '通用'
        const directory = body !== undefined && typeof body.directory === 'string' && body.directory !== '' ? body.directory : undefined
        const hint = body !== undefined && typeof body.hint === 'string' && body.hint !== '' ? body.hint : undefined
        try {
          const outcome = await generateStandardDraft(ctx, {
            name,
            tech,
            ...(directory === undefined ? {} : { directory }),
            ...(hint === undefined ? {} : { hint }),
          })
          if (!outcome.ok) {
            writeJson(res, 502, { error: outcome.error })
            return
          }
          writeJson(res, 200, { body: outcome.text })
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
          writeJson(res, 200, await contextStatsOf())
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- token-usage（真实用量）
    {
      kind: 'exact',
      path: API.tokenUsage,
      handler: async (req, res) => {
        if (!guard(req, res, 'GET')) return
        try {
          writeJson(res, 200, await tokenUsageOf())
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- diagnostics
    {
      kind: 'exact',
      path: API.diagnostics,
      handler: async (req, res) => {
        if (!guard(req, res, 'GET')) return
        try {
          const workspace = await store.getCurrentWorkspace()
          const sessions = workspace === undefined ? [] : usage.sessionsOfWorkspace(workspace.id)
          const report = await buildDiagnosticReport({
            ctx,
            workspace,
            fileIndexCache,
            codeIndexCache,
            contextStats: await contextStatsOf(),
            tokenUsage: await tokenUsageOf(),
            sessions,
            sessionVersions: workspace === undefined ? [] : usage.sessionVersionsOfWorkspace(workspace.id),
          })
          writeJson(res, 200, report)
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- diagnostic-action
    {
      kind: 'exact',
      path: API.diagnosticAction,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const action = body?.action as DiagnosticAction | undefined
        try {
          const workspace = await store.getCurrentWorkspace()
          if (action === 'refresh-caches') {
            fileIndexCache.clear()
            codeIndexCache.clear()
            if (workspace !== undefined) await Promise.all([
              ...workspace.directories.filter(directory => (directory.access ?? 'readwrite') !== 'disabled').map(directory => fileIndexCache.count(directory.path)),
              codeIndexCache.get(workspace.directories),
            ])
          } else if (action === 'sync-sandbox') {
            if (!(await syncCurrent())) {
              writeJson(res, 500, { error: 'sandbox whitelist write failed (see host log)' })
              return
            }
          } else if (action === 'refresh-sessions') {
            if (workspace !== undefined) usage.refreshSessions(workspace.id)
          } else {
            writeJson(res, 400, { error: 'unknown diagnostic action' })
            return
          }
          writeJson(res, 200, { ok: true })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- workspace-sessions（该项目已加载的会话）
    {
      kind: 'exact',
      path: API.workspaceSessions,
      handler: async (req, res) => {
        if (!guard(req, res, 'GET')) return
        try {
          const id = queryParam(req, 'id')
          if (id === '') {
            writeJson(res, 400, { error: 'id is required' })
            return
          }
          writeJson(res, 200, { sessions: usage.sessionsOfWorkspace(id) })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- session-refresh（把最新配置刷进某个会话）
    {
      kind: 'exact',
      path: API.sessionRefresh,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        try {
          const body = await readJsonBody(req)
          const sessionId = body === undefined ? '' : typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
          if (sessionId === '') {
            writeJson(res, 400, { error: 'sessionId is required' })
            return
          }
          const workspaceId = await usage.refreshSession(sessionId)
          if (workspaceId === undefined) {
            writeJson(res, 404, { error: 'session is not loaded in this process' })
            return
          }
          writeJson(res, 200, { ok: true, workspaceId })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- session-task（一次性任务范围）
    {
      kind: 'exact',
      path: API.sessionTask,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        try {
          const body = await readJsonBody(req)
          const sessionId = body === undefined ? '' : typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
          const task = parseSessionTask(body?.task)
          if (sessionId === '' || task === undefined) {
            writeJson(res, 400, { error: 'valid sessionId and task are required' })
            return
          }
          usage.setSessionTask(sessionId, task)
          writeJson(res, 200, { ok: true })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- endpoint-impact（改动反查端点）
    {
      kind: 'exact',
      path: API.endpointImpact,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        try {
          const ws = await store.getCurrentWorkspace()
          if (ws === undefined) {
            writeJson(res, 200, { impact: [], changedFiles: 0 })
            return
          }
          const dirs = ws.directories.filter(dir => (dir.access ?? 'readwrite') !== 'disabled')
          const requested = body !== undefined && Array.isArray(body.files)
            ? body.files.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
            : undefined
          // 未指定文件时用 git 工作区变更（含未跟踪）作为输入：确定性、无需用户操作。
          const changed: { dir: string; file: string }[] = []
          if (requested === undefined) {
            const lists = await Promise.all(dirs.map(async dir => ({ dir: dir.path, files: await getChangedFiles(dir.path) })))
            for (const item of lists) for (const file of item.files) changed.push({ dir: item.dir, file })
          } else {
            for (const raw of requested) {
              const file = raw.trim()
              if (isAbsolute(file)) {
                const dir = dirs.find(d => isSameOrInside(d.path, file))
                if (dir !== undefined) changed.push({ dir: dir.path, file: relative(dir.path, file) })
              } else {
                for (const dir of dirs) changed.push({ dir: dir.path, file })
              }
            }
          }
          const index = await codeIndexCache.get(ws.directories)
          writeJson(res, 200, { impact: findEndpointImpact(index, changed), changedFiles: changed.length })
        } catch (error) {
          fail(res, error)
        }
      },
    },
  ]
}
