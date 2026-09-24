/**
 * /api/dsh-workspace-combiner 路由族：读/写当前勾选与项目组合模板。
 * 每条路由都带 loopback-only 信任栅栏 + 浏览器同源标记（与 dsh-multi-root
 * 同约定）——这些端点读写宿主目录与配置，局域网暴露的 dsh web 部署不得对外
 * 提供。
 * @module dsh-workspace-combiner/routes
 */

import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { API, MAX_JSON_BODY_BYTES } from './invariant.ts'
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
    hostUrl = new URL(`http://${host}`)
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
    out.push({ id: ref.id, name: ref.name, path: ref.path })
  }
  return out
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
      writeJson(res, 405, { error: `method not allowed: ${req.method}` })
      return false
    }
    return true
  }

  const fail = (res: ServerResponse, error: unknown): void => {
    writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
  }

  return [
    // ---------------------------------------------------------- selection
    {
      kind: 'exact',
      path: API.selection,
      handler: async (req, res) => {
        const method = req.method ?? 'GET'
        if (method === 'GET') {
          if (!isLoopbackRequest(req)) {
            writeJson(res, 403, { error: 'forbidden: loopback-only' })
            return
          }
          try {
            writeJson(res, 200, { selection: await store.getSelection() })
          } catch (error) {
            fail(res, error)
          }
          return
        }
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        if (body === undefined) {
          writeJson(res, 400, { error: 'invalid JSON body' })
          return
        }
        const selection = parseWorkspaceRefs(body.selection)
        if (selection === undefined) {
          writeJson(res, 400, { error: 'selection must be an array of { id, name, path }' })
          return
        }
        try {
          const previous = await store.getSelection()
          await store.setSelection(selection)
          // 联动沙盒：把新勾选目录并入 extraRoots 白名单。
          await syncExtraRoots(ctx, previous.map(w => w.path), selection.map(w => w.path))
          writeJson(res, 200, { ok: true })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- templates
    {
      kind: 'exact',
      path: API.templates,
      handler: async (req, res) => {
        const method = req.method ?? 'GET'
        if (method === 'GET') {
          if (!isLoopbackRequest(req)) {
            writeJson(res, 403, { error: 'forbidden: loopback-only' })
            return
          }
          try {
            writeJson(res, 200, { templates: await store.getTemplates() })
          } catch (error) {
            fail(res, error)
          }
          return
        }
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        if (body === undefined) {
          writeJson(res, 400, { error: 'invalid JSON body' })
          return
        }
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        const workspaces = parseWorkspaceRefs(body.workspaces)
        if (name === '' || workspaces === undefined) {
          writeJson(res, 400, { error: 'name and workspaces are required' })
          return
        }
        try {
          writeJson(res, 201, { template: await store.saveTemplate(name, workspaces) })
        } catch (error) {
          fail(res, error)
        }
      },
    },
    // ---------------------------------------------------------- templates/delete
    {
      kind: 'exact',
      path: API.templateDelete,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const id = body === undefined ? '' : typeof body.id === 'string' ? body.id : ''
        if (id === '') {
          writeJson(res, 400, { error: 'id is required' })
          return
        }
        try {
          await store.deleteTemplate(id)
          writeJson(res, 200, { ok: true })
        } catch (error) {
          fail(res, error)
        }
      },
    },
  ]
}
