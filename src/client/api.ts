/**
 * client -> host 的 HTTP API 客户端。走宿主 /api/dsh-workspace-combiner 路由
 * （loopback-only）。fetch 失败抛错，由面板统一 toast。
 * @module dsh-workspace-combiner/client/api
 */

import { API } from '../invariant.ts'
import { tt } from './locales.ts'
import type { CodeIndexEntry, ContextPreset, ContextStats, DetectedProject, DiagnosticAction, DiagnosticReport, EndpointImpact, GitStatus, LoadMode, TokenUsageReport, Workspace, WorkspaceMode, WorkspaceRef, WorkspaceStandards } from '../core/types.ts'
import type { StandardsLibrary } from '../core/standards.ts'
import type { FileTreeNode } from '../core/fileTree.ts'
import type { SessionTask } from '../core/task.ts'

/** 轻量读写的默认超时；慢查询单独放宽，避免宿主无响应时面板永久转圈。 */
const DEFAULT_TIMEOUT_MS = 15_000
/** 磁盘扫描类（scan / file-index / git-status / 统计 / 诊断）的超时。 */
const HEAVY_TIMEOUT_MS = 60_000
/** 模型起草规范正文的超时（可能几十秒）。 */
const AI_TIMEOUT_MS = 120_000

/**
 * 变更类响应的公共字段：宿主写完沙盒白名单后会带上 `sandboxSynced`，
 * 为 false 表示白名单没落上（目录写权限可能没放开），调用方要提示用户。
 */
export interface MutationResult {
  sandboxSynced?: boolean
}

/**
 * 统一 JSON 请求/响应：带超时（AbortController）、非 2xx 检查、JSON 解析保护。
 * @param path - 宿主路由。
 * @param init - fetch 参数。
 * @param timeoutMs - 超时毫秒（超时抛可读错误，而不是让 promise 永不 settle）。
 */
async function request<T>(path: string, init?: RequestInit, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
  let res: Response
  try {
    res = await fetch(path, {
      headers: { 'content-type': 'application/json' },
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (timedOut) throw new Error(tt('requestTimeout', { ms: timeoutMs }))
    throw error
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? 'HTTP ' + res.status)
  }
  // 2xx 但响应体不是 JSON（代理错误页/空体）时给出可读错误，而不是把
  // `SyntaxError: Unexpected token` 原文丢给用户。
  try {
    return await res.json() as T
  } catch {
    throw new Error(tt('badResponse'))
  }
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
  async createWorkspace(name: string, basePath: string, directories: readonly WorkspaceRef[], mode: WorkspaceMode = 'anchor', loadMode: LoadMode = 'summary'): Promise<{ workspace: Workspace; currentWorkspaceId: string } & MutationResult> {
    return await request<{ workspace: Workspace; currentWorkspaceId: string }>(API.workspaceCreate, {
      method: 'POST',
      body: JSON.stringify({ name, basePath, directories, mode, loadMode }),
    })
  }

  /** 扫描目录，识别其中的代码项目（java / vue / react / python / go 等）。 */
  async scan(path: string): Promise<DetectedProject[]> {
    const body = await request<{ projects: DetectedProject[] }>(API.scan, {
      method: 'POST',
      body: JSON.stringify({ path }),
    }, HEAVY_TIMEOUT_MS)
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
  async deleteWorkspace(id: string): Promise<{ currentWorkspaceId: string } & MutationResult> {
    return await request<{ ok: boolean; currentWorkspaceId: string } & MutationResult>(API.workspaceDelete, {
      method: 'POST',
      body: JSON.stringify({ id }),
    })
  }

  /** 切换当前工作空间（返回沙盒白名单是否落盘成功）。 */
  async switchWorkspace(id: string): Promise<MutationResult> {
    return await request<{ ok: boolean } & MutationResult>(API.workspaceSwitch, {
      method: 'POST',
      body: JSON.stringify({ id }),
    })
  }

  /** 覆盖某工作空间的目录列表（含排序/主从；宿主持久化并联动沙盒）。 */
  async setWorkspaceDirectories(id: string, directories: readonly WorkspaceRef[]): Promise<MutationResult> {
    return await request<{ ok: boolean } & MutationResult>(API.workspaceDirectories, {
      method: 'POST',
      body: JSON.stringify({ id, directories }),
    })
  }

  /** 设置工作空间模式（文档锚点 / 传统单项目）。 */
  async setWorkspaceMode(id: string, mode: WorkspaceMode): Promise<void> {
    await request<{ ok: boolean }>(API.workspaceMode, {
      method: 'POST',
      body: JSON.stringify({ id, mode }),
    })
  }

  /** 保存/恢复/删除工作空间目录配置快照（返回沙盒白名单是否落盘成功）。 */
  async workspaceSnapshot(id: string, action: 'save' | 'restore' | 'delete', payload: { name?: string; snapshotId?: string } = {}): Promise<MutationResult> {
    return await request<{ ok: boolean } & MutationResult>(API.workspaceSnapshot, {
      method: 'POST',
      body: JSON.stringify({ id, action, ...payload }),
    })
  }

  /** 设置文件加载模式（完整 / 摘要 / 目录树）。 */
  async setLoadMode(id: string, loadMode: LoadMode): Promise<void> {
    await request<{ ok: boolean }>(API.workspaceLoadMode, {
      method: 'POST',
      body: JSON.stringify({ id, loadMode }),
    })
  }

  /** 局部更新工作空间级元信息（模式 / 加载模式 / 置顶 / 颜色 / token 预算）。 */
  async patchWorkspace(id: string, patch: { mode?: WorkspaceMode; loadMode?: LoadMode; pinned?: boolean; color?: string; contextPreset?: ContextPreset; tokenBudget?: number; fileIndexBudget?: number; commandsBudget?: number; codeIndexEnabled?: boolean; codeIndexBudget?: number; codeIndexSummary?: 'off' | 'llm' }): Promise<void> {
    await request<{ ok: boolean }>(API.workspacePatch, {
      method: 'POST',
      body: JSON.stringify({ id, ...patch }),
    })
  }

  /** 读取单目录文件索引（面板预览 prompt 用）；目录不存在时抛错。loadMode 决定树深度，与注入 prompt 对齐。 */
  async fileIndex(path: string, loadMode: LoadMode = 'tree'): Promise<{ root: string; files: number; dirs: number; truncated: boolean; tree: FileTreeNode[] }> {
    return await request<{ root: string; files: number; dirs: number; truncated: boolean; tree: FileTreeNode[] }>(API.fileIndex, {
      method: 'POST',
      body: JSON.stringify({ path, loadMode }),
    }, HEAVY_TIMEOUT_MS)
  }

  /** 轻量存在性探测：目录失效检测用，避免为判断存在而构建整棵文件树。 */
  async stat(path: string): Promise<{ exists: boolean; isDirectory: boolean }> {
    return await request<{ exists: boolean; isDirectory: boolean }>(API.stat, {
      method: 'POST',
      body: JSON.stringify({ path }),
    })
  }

  /** 读取目录 git 状态（非 git 仓库返回 null）。 */
  async gitStatus(path: string): Promise<GitStatus | null> {
    const body = await request<{ status: GitStatus | null }>(API.gitStatus, {
      method: 'POST',
      body: JSON.stringify({ path }),
    }, HEAVY_TIMEOUT_MS)
    return body.status
  }

  /** 获取上下文统计（各目录文件数 + 估算 token）。 */
  async contextStats(): Promise<ContextStats> {
    return await request<ContextStats>(API.contextStats, { method: 'GET' }, HEAVY_TIMEOUT_MS)
  }

  /** 读取当前工作空间的功能/接口索引（面板预览用）。 */
  async codeIndex(): Promise<CodeIndexEntry[]> {
    const body = await request<{ entries: CodeIndexEntry[] }>(API.codeIndex, { method: 'GET' }, HEAVY_TIMEOUT_MS)
    return body.entries
  }

  /** 读取全局开发规范库（覆盖正文 + 全局自建规范）。 */
  async standards(): Promise<StandardsLibrary> {
    const body = await request<{ library: StandardsLibrary }>(API.standards, { method: 'GET' })
    return body.library
  }

  /** 整份保存全局开发规范库。 */
  async saveStandards(library: StandardsLibrary): Promise<void> {
    await request<{ ok: boolean }>(API.standards, { method: 'POST', body: JSON.stringify({ library }) })
  }

  /** 覆盖某工作空间的开发规范绑定。 */
  async setWorkspaceStandards(id: string, standards: WorkspaceStandards): Promise<void> {
    await request<{ ok: boolean }>(API.workspaceStandards, { method: 'POST', body: JSON.stringify({ id, standards }) })
  }

  /** 用默认模型起草一份规范正文（可选能力；不可用时返回空串）。 */
  async generateStandard(payload: { name: string; tech?: string; directory?: string; hint?: string }): Promise<string> {
    const body = await request<{ body: string }>(API.standardsAi, { method: 'POST', body: JSON.stringify(payload) }, AI_TIMEOUT_MS)
    return body.body
  }

  /** 读取当前工作空间的真实 token 用量（provider 上报，含提示词缓存命中）。 */
  async tokenUsage(): Promise<TokenUsageReport> {
    return await request<TokenUsageReport>(API.tokenUsage, { method: 'GET' })
  }

  /** 运行当前工作空间的统一诊断。 */
  async diagnostics(): Promise<DiagnosticReport> {
    return await request<DiagnosticReport>(API.diagnostics, { method: 'GET' }, HEAVY_TIMEOUT_MS)
  }

  /** 执行诊断中心允许的一项安全修复。 */
  async runDiagnosticAction(action: DiagnosticAction): Promise<void> {
    await request<{ ok: boolean }>(API.diagnosticAction, { method: 'POST', body: JSON.stringify({ action }) }, HEAVY_TIMEOUT_MS)
  }

  /** 读取某工作空间已加载（绑定）的会话 id；只有本进程加载过的会话才可刷新。 */
  async workspaceSessions(id: string): Promise<string[]> {
    const body = await request<{ sessions: string[] }>(API.workspaceSessions + '?id=' + encodeURIComponent(id), { method: 'GET' })
    return body.sessions
  }

  /** 把工作空间的最新配置刷新进某个已加载的会话（下一轮请求生效）。 */
  async refreshSession(sessionId: string): Promise<void> {
    await request<{ ok: boolean }>(API.sessionRefresh, { method: 'POST', body: JSON.stringify({ sessionId }) }, HEAVY_TIMEOUT_MS)
  }

  /** 把一次性任务范围绑定到新会话，不修改工作空间永久配置。 */
  async setSessionTask(sessionId: string, task: SessionTask): Promise<void> {
    await request<{ ok: boolean }>(API.sessionTask, { method: 'POST', body: JSON.stringify({ sessionId, task }) })
  }

  /** 由改动文件反查受影响的前后端端点（不传 files 时用 git 工作区变更）。 */
  async endpointImpact(files?: readonly string[]): Promise<{ impact: EndpointImpact[]; changedFiles: number }> {
    return await request<{ impact: EndpointImpact[]; changedFiles: number }>(API.endpointImpact, {
      method: 'POST',
      body: JSON.stringify(files === undefined ? {} : { files }),
    }, HEAVY_TIMEOUT_MS)
  }
}
