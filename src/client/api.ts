/**
 * client -> host 的 HTTP API 客户端。走宿主 /api/dsh-workspace-combiner 路由
 * （loopback-only）。fetch 失败抛错，由面板统一 toast。
 * @module dsh-workspace-combiner/client/api
 */

import { API } from '../invariant.ts'
import type { DetectedProject, Workspace, WorkspaceRef } from '../core/types.ts'

/** 统一 JSON 请求/响应。 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? 'HTTP ' + res.status)
  }
  return await res.json() as T
}

/** 宿主全量状态（工作空间 + 当前激活）。 */
export interface AppState {
  currentWorkspaceId: string
  workspaces: Workspace[]
}

/** 工作空间读写的宿主 API。 */
export class WorkspaceCombinerApi {
  /** 读取全量状态（面板挂载时水合）。 */
  async getState(): Promise<AppState> {
    return await request<AppState>(API.state)
  }

  /** 新建工作空间：在 basePath 下创建与名称同名的文件夹作为主目录，其余目录作为代码项目；创建后自动切换为当前。 */
  async createWorkspace(name: string, basePath: string, directories: readonly WorkspaceRef[]): Promise<{ workspace: Workspace; currentWorkspaceId: string }> {
    return await request<{ workspace: Workspace; currentWorkspaceId: string }>(API.workspaceCreate, {
      method: 'POST',
      body: JSON.stringify({ name, basePath, directories }),
    })
  }

  /** 扫描目录，识别其中的代码项目（java / vue / react / python / go 等）。 */
  async scan(path: string): Promise<DetectedProject[]> {
    const body = await request<{ projects: DetectedProject[] }>(API.scan, {
      method: 'POST',
      body: JSON.stringify({ path }),
    })
    return body.projects
  }

  /** 重命名工作空间。 */
  async renameWorkspace(id: string, name: string): Promise<void> {
    await request<{ ok: boolean }>(API.workspaceRename, {
      method: 'POST',
      body: JSON.stringify({ id, name }),
    })
  }

  /** 删除工作空间；返回删除后的当前工作空间 id。 */
  async deleteWorkspace(id: string): Promise<{ currentWorkspaceId: string }> {
    return await request<{ ok: boolean; currentWorkspaceId: string }>(API.workspaceDelete, {
      method: 'POST',
      body: JSON.stringify({ id }),
    })
  }

  /** 切换当前工作空间。 */
  async switchWorkspace(id: string): Promise<void> {
    await request<{ ok: boolean }>(API.workspaceSwitch, {
      method: 'POST',
      body: JSON.stringify({ id }),
    })
  }

  /** 覆盖某工作空间的目录列表（含排序/主从；宿主持久化并联动沙盒）。 */
  async setWorkspaceDirectories(id: string, directories: readonly WorkspaceRef[]): Promise<void> {
    await request<{ ok: boolean }>(API.workspaceDirectories, {
      method: 'POST',
      body: JSON.stringify({ id, directories }),
    })
  }
}
