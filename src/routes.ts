/**
 * /api/dsh-workspace-combiner 路由族：读写自定义工作空间。
 * 每条路由都带 loopback-only 信任栅栏 + 浏览器同源标记——这些端点读写宿主目录
 * 与配置，局域网暴露的 dsh web 部署不得对外提供。
 * @module dsh-workspace-combiner/routes
 */

import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { API, MAX_JSON_BODY_BYTES } from './invariant.ts'
import { scanDirectory } from './host/projectDetector.ts'
import { syncExtraRoots } from './sandbox-sync.ts'
import { WorkspaceCombinerStore } from './store.ts'
import type { WorkspaceRef } from './core/types.ts'

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

/** 把任意结构校验成 WorkspaceRef[]（不合法项整体拒绝）。 */
function parseWorkspaceRefs(raw: unknown): WorkspaceRef[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: WorkspaceRef[] = []
  for (const item of raw) {
    if (item === null || typeof item !== 'object') return undefined
    const ref = item as Record<string, unknown>
    if (typeof ref.id !== 'string' || typeof ref.name !== 'string' || typeof ref.path !== 'string') return undefined
    out.push({
      id: ref.id,
      name: ref.name,
      path: ref.path,
      ...(typeof ref.projectType === 'string' ? { projectType: ref.projectType as WorkspaceRef['projectType'] } : {}),
      ...(typeof ref.evidence === 'string' ? { evidence: ref.evidence } : {}),
      ...(typeof ref.isPrimary === 'boolean' ? { isPrimary: ref.isPrimary } : {}),
    })
  }
  return out
}

/** 生成可用的文件系统文件夹名（去路径分隔符 / Windows 非法字符 / 控制字符）。 */
function sanitizeFolderName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '').trim()
  return cleaned === '' ? '未命名工作空间' : cleaned.slice(0, 80)
}

/**
 * 构建全部路由。
 * @param ctx - 宿主上下文（用于沙盒联动）。
 * @param store - 持久化存储。
 */
export function makeRoutes(ctx: Context, store: WorkspaceCombinerStore): WebRoute[] {
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
  let lastSyncedPaths: string[] = []
  void store.getCurrentWorkspace().then(ws => { lastSyncedPaths = ws?.directories.map(d => d.path) ?? [] })
  const syncCurrent = async (): Promise<void> => {
    const ws = await store.getCurrentWorkspace()
    const next = ws?.directories.map(d => d.path) ?? []
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
          const primary: WorkspaceRef = { id: targetPath, name: folderName, path: targetPath, isPrimary: true }
          const allDirectories: WorkspaceRef[] = [primary, ...directories.filter(d => d.path !== targetPath)]
          const workspace = await store.createWorkspace(name, undefined, allDirectories)
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
  ]
}
