/**
 * client -> host 的 HTTP API 客户端。走宿主 /api/dsh-workspace-combiner 路由
 * （loopback-only，与 dsh-multi-root 同机制）。fetch 失败抛错，由面板统一提示。
 * @module dsh-workspace-combiner/client/api
 */

import { API } from '../invariant.ts'
import type { Template, WorkspaceRef } from '../core/types.ts'

/** 统一 JSON 请求/响应。 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return await res.json() as T
}

/** 勾选读写 + 模板读写的宿主 API。 */
export class WorkspaceCombinerApi {
  /** 读取当前勾选（面板挂载时水合复选框）。 */
  async getSelection(): Promise<WorkspaceRef[]> {
    const data = await request<{ selection: WorkspaceRef[] }>(API.selection)
    return data.selection
  }

  /** 覆盖当前勾选（宿主持久化并联动沙盒 extraRoots）。 */
  async setSelection(selection: readonly WorkspaceRef[]): Promise<void> {
    await request<{ ok: boolean }>(API.selection, {
      method: 'POST',
      body: JSON.stringify({ selection }),
    })
  }

  /** 读取全部模板。 */
  async getTemplates(): Promise<Template[]> {
    const data = await request<{ templates: Template[] }>(API.templates)
    return data.templates
  }

  /** 保存（按名称 upsert）一个模板。 */
  async saveTemplate(name: string, workspaces: readonly WorkspaceRef[]): Promise<Template> {
    const data = await request<{ template: Template }>(API.templates, {
      method: 'POST',
      body: JSON.stringify({ name, workspaces }),
    })
    return data.template
  }

  /** 删除一个模板。 */
  async deleteTemplate(id: string): Promise<void> {
    await request<{ ok: boolean }>(API.templateDelete, {
      method: 'POST',
      body: JSON.stringify({ id }),
    })
  }
}
