/**
 * 宿主持久化存储：~/.dsh/dsh-workspace-combiner.json（或 $DSH_HOME 覆盖），
 * 保存「自定义工作空间」。GUI 与 host 共享同一份数据。
 *
 * 持久化纪律（与 dsh-multi-root 一致）：目录 0700、文件 0600、临时文件 +
 * rename 原子替换，所有变更串行化到一条 promise 链，缺失/损坏时退化为空
 * （工作空间是可重建状态，不是机密）。
 * @module dsh-workspace-combiner/store
 */

import { randomUUID } from 'node:crypto'
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { emptyStore, type LoadMode, type StoreShape, type Workspace, type WorkspaceMode, type WorkspaceRef, type WorkspaceSnapshot } from './core/types.ts'
import { parseWorkspaceRef } from './core/validate.ts'
import { STORE_FILE } from './invariant.ts'

/** 与 harness 的 DSH_HOME 约定一致：默认 ~/.dsh，可用 $DSH_HOME 覆盖。 */
export function dshHome(): string {
  const override = process.env.DSH_HOME?.trim()
  return override ? resolve(override) : join(homedir(), '.dsh')
}

/** 默认存储文件路径（测试可注入其它路径）。 */
export function defaultStoreFile(): string {
  return join(dshHome(), STORE_FILE)
}

/**
 * 目录列表的唯一事实来源是数组顺序：第一项就是主目录。把历史字段也随之
 * 规范化，避免拖拽重排后 isPrimary / access 仍留在旧主目录上，导致持久化
 * 数据与实际建会话目录、沙盒白名单相互矛盾。
 */
function normalizeDirectories(directories: readonly WorkspaceRef[]): WorkspaceRef[] {
  return directories.map((directory, index) => {
    if (index === 0) {
      return { ...directory, isPrimary: true, access: 'readwrite' }
    }
    const { isPrimary: _isPrimary, ...secondary } = directory
    return secondary
  })
}

/** 校验并规范化一条快照。 */
function parseSnapshot(raw: unknown): WorkspaceSnapshot | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const s = raw as Record<string, unknown>
  if (typeof s.id !== 'string' || typeof s.name !== 'string') return undefined
  const dirs = Array.isArray(s.directories)
    ? s.directories.map(parseWorkspaceRef).filter((r): r is WorkspaceRef => r !== undefined)
    : []
  return { id: s.id, name: s.name, directories: dirs, createdAt: typeof s.createdAt === 'number' ? s.createdAt : Date.now() }
}

/** 校验并规范化一个 Workspace。 */
function parseWorkspace(raw: unknown): Workspace | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const ws = raw as Record<string, unknown>
  if (typeof ws.id !== 'string' || typeof ws.name !== 'string') return undefined
  const dirs = Array.isArray(ws.directories)
    ? ws.directories.map(parseWorkspaceRef).filter((r): r is WorkspaceRef => r !== undefined)
    : []
  return {
    id: ws.id,
    name: ws.name,
    ...(typeof ws.remark === 'string' && ws.remark !== '' ? { remark: ws.remark } : {}),
    directories: normalizeDirectories(dirs),
    createdAt: typeof ws.createdAt === 'number' ? ws.createdAt : Date.now(),
    updatedAt: typeof ws.updatedAt === 'number' ? ws.updatedAt : Date.now(),
    ...(typeof ws.lastSessionAt === 'number' ? { lastSessionAt: ws.lastSessionAt } : {}),
    ...(ws.mode === 'anchor' || ws.mode === 'single' ? { mode: ws.mode } : {}),
    ...(ws.loadMode === 'full' || ws.loadMode === 'summary' || ws.loadMode === 'tree' ? { loadMode: ws.loadMode } : {}),
    ...(Array.isArray(ws.snapshots) ? { snapshots: ws.snapshots.map(parseSnapshot).filter((s): s is WorkspaceSnapshot => s !== undefined) } : {}),
    ...(typeof ws.tokenBudget === 'number' && Number.isFinite(ws.tokenBudget) && ws.tokenBudget > 0 ? { tokenBudget: Math.round(ws.tokenBudget) } : {}),
    ...(typeof ws.pinned === 'boolean' ? { pinned: ws.pinned } : {}),
    ...(typeof ws.color === 'string' && ws.color !== '' ? { color: ws.color } : {}),
    ...(typeof ws.codeIndexEnabled === 'boolean' ? { codeIndexEnabled: ws.codeIndexEnabled } : {}),
    ...(typeof ws.codeIndexBudget === 'number' && Number.isFinite(ws.codeIndexBudget) && ws.codeIndexBudget > 0 ? { codeIndexBudget: Math.round(ws.codeIndexBudget) } : {}),
    ...(ws.codeIndexSummary === 'off' || ws.codeIndexSummary === 'llm' ? { codeIndexSummary: ws.codeIndexSummary } : {}),
  }
}

/** 构造一个默认工作空间（全新安装 / 迁移 / 兜底）。 */
function makeDefaultWorkspace(directories: readonly WorkspaceRef[] = []): Workspace {
  const now = Date.now()
  return { id: randomUUID(), name: '默认工作空间', directories: [...directories], createdAt: now, updatedAt: now }
}

/**
 * 持久化存储：构造时一次性加载，所有公开方法先 await readiness，
 * 避免慢磁盘与早到调用产生竞态。
 */
export class WorkspaceCombinerStore {
  private readonly file: string
  private shape: StoreShape = emptyStore()
  private readonly ready: Promise<void>
  private chain: Promise<void> = Promise.resolve()

  constructor(file: string = defaultStoreFile()) {
    this.file = file
    this.ready = this.load()
  }

  /** 全量状态快照（工作空间 + 当前激活 id + 模板）。 */
  async getState(): Promise<StoreShape> {
    await this.ready
    return this.shape
  }

  /** 全部自定义工作空间。 */
  async getWorkspaces(): Promise<readonly Workspace[]> {
    await this.ready
    return this.shape.workspaces
  }

  /** 当前激活的工作空间 id。 */
  async getCurrentWorkspaceId(): Promise<string> {
    await this.ready
    return this.shape.currentWorkspaceId
  }

  /** 当前激活的工作空间（不存在则 undefined）。 */
  async getCurrentWorkspace(): Promise<Workspace | undefined> {
    await this.ready
    return this.shape.workspaces.find(w => w.id === this.shape.currentWorkspaceId)
  }

  /** 新建工作空间并切换为当前。 */
  async createWorkspace(name: string, remark?: string, directories: readonly WorkspaceRef[] = [], mode: WorkspaceMode = 'anchor', loadMode: LoadMode = 'summary'): Promise<Workspace> {
    await this.ready
    const now = Date.now()
    const ws: Workspace = {
      id: randomUUID(),
      name,
      ...(remark !== undefined && remark !== '' ? { remark } : {}),
      directories: normalizeDirectories(directories),
      mode,
      loadMode,
      createdAt: now,
      updatedAt: now,
    }
    await this.mutate(() => {
      this.shape = { ...this.shape, currentWorkspaceId: ws.id, workspaces: [...this.shape.workspaces, ws] }
    })
    return ws
  }

  /** 重命名工作空间（未知 id 不写盘）。 */
  async renameWorkspace(id: string, name: string): Promise<void> {
    await this.ready
    await this.mutate(() => {
      if (!this.shape.workspaces.some(w => w.id === id)) return
      this.shape = {
        ...this.shape,
        workspaces: this.shape.workspaces.map(w => w.id === id ? { ...w, name, updatedAt: Date.now() } : w),
      }
    })
  }

  /** 删除工作空间；删除当前工作空间时自动切到首个剩余工作空间。返回新的当前 id。 */
  async deleteWorkspace(id: string): Promise<string> {
    await this.ready
    let nextCurrent = this.shape.currentWorkspaceId
    await this.mutate(() => {
      const rest = this.shape.workspaces.filter(w => w.id !== id)
      if (rest.length === this.shape.workspaces.length) return
      if (nextCurrent === id) nextCurrent = rest[0]?.id ?? ''
      this.shape = { ...this.shape, workspaces: rest, currentWorkspaceId: nextCurrent }
    })
    return nextCurrent
  }

  /** 切换当前工作空间（未知 id 不写盘）。 */
  async switchWorkspace(id: string): Promise<void> {
    await this.ready
    await this.mutate(() => {
      if (!this.shape.workspaces.some(w => w.id === id)) return
      if (this.shape.currentWorkspaceId === id) return
      this.shape = { ...this.shape, currentWorkspaceId: id }
    })
  }

  /** 覆盖某工作空间的目录列表（含排序/主从）。 */
  async setWorkspaceDirectories(id: string, directories: readonly WorkspaceRef[]): Promise<void> {
    await this.ready
    await this.mutate(() => {
      if (!this.shape.workspaces.some(w => w.id === id)) return
      this.shape = {
        ...this.shape,
        workspaces: this.shape.workspaces.map(w => w.id === id ? { ...w, directories: normalizeDirectories(directories), updatedAt: Date.now() } : w),
      }
    })
  }

  /** 设置工作空间模式（文档锚点 / 传统单项目）。 */
  async setWorkspaceMode(id: string, mode: WorkspaceMode): Promise<void> {
    await this.ready
    await this.mutate(() => {
      if (!this.shape.workspaces.some(w => w.id === id)) return
      this.shape = {
        ...this.shape,
        workspaces: this.shape.workspaces.map(w => w.id === id ? { ...w, mode, updatedAt: Date.now() } : w),
      }
    })
  }

  /** 设置文件加载模式（完整 / 摘要 / 目录树）。 */
  async setLoadMode(id: string, loadMode: LoadMode): Promise<void> {
    await this.ready
    await this.mutate(() => {
      if (!this.shape.workspaces.some(w => w.id === id)) return
      this.shape = {
        ...this.shape,
        workspaces: this.shape.workspaces.map(w => w.id === id ? { ...w, loadMode, updatedAt: Date.now() } : w),
      }
    })
  }

  /** 局部更新工作空间级元信息（置顶 / 颜色 / token 预算 / 功能索引配置）；未提供的字段保持原值。 */
  async patchMeta(id: string, patch: { pinned?: boolean; color?: string; tokenBudget?: number; codeIndexEnabled?: boolean; codeIndexBudget?: number; codeIndexSummary?: 'off' | 'llm' }): Promise<void> {
    await this.ready
    await this.mutate(() => {
      if (!this.shape.workspaces.some(w => w.id === id)) return
      this.shape = {
        ...this.shape,
        workspaces: this.shape.workspaces.map(w => w.id === id
          ? {
              ...w,
              ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
              ...(patch.color !== undefined ? { color: patch.color } : {}),
              ...(patch.tokenBudget !== undefined ? { tokenBudget: Math.max(1, Math.round(patch.tokenBudget)) } : {}),
              ...(patch.codeIndexEnabled !== undefined ? { codeIndexEnabled: patch.codeIndexEnabled } : {}),
              ...(patch.codeIndexBudget !== undefined ? { codeIndexBudget: Math.max(1, Math.round(patch.codeIndexBudget)) } : {}),
              ...(patch.codeIndexSummary !== undefined ? { codeIndexSummary: patch.codeIndexSummary } : {}),
              updatedAt: Date.now(),
            }
          : w),
      }
    })
  }

  /** 保存当前目录配置为一个命名快照。 */
  async saveSnapshot(id: string, name: string): Promise<void> {
    await this.ready
    await this.mutate(() => {
      const ws = this.shape.workspaces.find(w => w.id === id)
      if (ws === undefined) return
      const snapshot: WorkspaceSnapshot = { id: randomUUID(), name, directories: [...ws.directories], createdAt: Date.now() }
      this.shape = {
        ...this.shape,
        workspaces: this.shape.workspaces.map(w => w.id === id ? { ...w, snapshots: [...(w.snapshots ?? []), snapshot], updatedAt: Date.now() } : w),
      }
    })
  }

  /** 用快照恢复目录配置。 */
  async restoreSnapshot(id: string, snapshotId: string): Promise<void> {
    await this.ready
    await this.mutate(() => {
      const ws = this.shape.workspaces.find(w => w.id === id)
      const snapshot = ws?.snapshots?.find(s => s.id === snapshotId)
      if (ws === undefined || snapshot === undefined) return
      this.shape = {
        ...this.shape,
        workspaces: this.shape.workspaces.map(w => w.id === id ? { ...w, directories: normalizeDirectories(snapshot.directories), updatedAt: Date.now() } : w),
      }
    })
  }

  /** 删除一条快照。 */
  async deleteSnapshot(id: string, snapshotId: string): Promise<void> {
    await this.ready
    await this.mutate(() => {
      const ws = this.shape.workspaces.find(w => w.id === id)
      if (ws === undefined) return
      this.shape = {
        ...this.shape,
        workspaces: this.shape.workspaces.map(w => w.id === id ? { ...w, snapshots: (w.snapshots ?? []).filter(s => s.id !== snapshotId), updatedAt: Date.now() } : w),
      }
    })
  }

  /** 记录该工作空间最近一次新建会话时间。 */
  async touchWorkspaceSession(id: string): Promise<void> {
    await this.ready
    await this.mutate(() => {
      if (!this.shape.workspaces.some(w => w.id === id)) return
      const now = Date.now()
      this.shape = {
        ...this.shape,
        workspaces: this.shape.workspaces.map(w => w.id === id ? { ...w, lastSessionAt: now, updatedAt: now } : w),
      }
    })
  }

    /** 一次性加载：缺失/损坏退化为空存储；v1 结构自动迁移为 v2。 */
  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.file, 'utf8')
      const parsed: unknown = JSON.parse(raw)
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>
        if (record.version === 1 || Array.isArray(record.selection)) {
          // v1 -> v2：旧的全局 selection 迁入一个默认工作空间。
          const dirs = Array.isArray(record.selection)
            ? record.selection.map(parseWorkspaceRef).filter((r): r is WorkspaceRef => r !== undefined)
            : []
          const ws = makeDefaultWorkspace(normalizeDirectories(dirs))
          this.shape = { version: 2, currentWorkspaceId: ws.id, workspaces: [ws] }
        } else {
          const workspaces = Array.isArray(record.workspaces)
            ? record.workspaces.map(parseWorkspace).filter((w): w is Workspace => w !== undefined)
            : []
          const current = typeof record.currentWorkspaceId === 'string' && workspaces.some(w => w.id === record.currentWorkspaceId)
            ? record.currentWorkspaceId
            : workspaces[0]?.id ?? ''
          this.shape = { version: 2, currentWorkspaceId: current, workspaces }
        }
      }
    } catch {
      // 缺失或损坏：从空存储开始。
    }
    // 兜底：始终至少存在一个工作空间，保证「新建会话」有归属。
    if (this.shape.workspaces.length === 0) {
      const ws = makeDefaultWorkspace()
      this.shape = { ...this.shape, workspaces: [ws], currentWorkspaceId: ws.id }
    }
  }

  /** 串行化一次变更（内存更新 + 原子落盘）。 */
  private mutate(update: () => void): Promise<void> {
    const run = async (): Promise<void> => {
      update()
      await this.persist()
    }
    this.chain = this.chain.then(run, run)
    return this.chain
  }

  /** 原子落盘：临时文件 + rename，目录 0700、文件 0600。 */
  private async persist(): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 })
    const tmp = this.file + '.' + process.pid + '.tmp'
    await writeFile(tmp, JSON.stringify(this.shape, null, 2), { mode: 0o600 })
    await rename(tmp, this.file)
    await chmod(this.file, 0o600).catch(() => {
      // 平台不支持 chmod 语义时尽力而为；open 时的 mode 已生效。
    })
  }
}
