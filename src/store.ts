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
import { emptyStore, type StoreShape, type Workspace, type WorkspaceRef } from './core/types.ts'
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

/** 校验并规范化一条 WorkspaceRef（目录项）。 */
function parseRef(raw: unknown): WorkspaceRef | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const ref = raw as Record<string, unknown>
  if (typeof ref.id !== 'string' || typeof ref.name !== 'string' || typeof ref.path !== 'string') return undefined
  return {
    id: ref.id,
    name: ref.name,
    path: ref.path,
    ...(typeof ref.projectType === 'string' ? { projectType: ref.projectType as WorkspaceRef['projectType'] } : {}),
    ...(typeof ref.evidence === 'string' ? { evidence: ref.evidence } : {}),
    ...(typeof ref.isPrimary === 'boolean' ? { isPrimary: ref.isPrimary } : {}),
  }
}

/** 校验并规范化一个 Workspace。 */
function parseWorkspace(raw: unknown): Workspace | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const ws = raw as Record<string, unknown>
  if (typeof ws.id !== 'string' || typeof ws.name !== 'string') return undefined
  const dirs = Array.isArray(ws.directories)
    ? ws.directories.map(parseRef).filter((r): r is WorkspaceRef => r !== undefined)
    : []
  return {
    id: ws.id,
    name: ws.name,
    ...(typeof ws.remark === 'string' && ws.remark !== '' ? { remark: ws.remark } : {}),
    directories: dirs,
    createdAt: typeof ws.createdAt === 'number' ? ws.createdAt : Date.now(),
    updatedAt: typeof ws.updatedAt === 'number' ? ws.updatedAt : Date.now(),
    ...(typeof ws.lastSessionAt === 'number' ? { lastSessionAt: ws.lastSessionAt } : {}),
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
  async createWorkspace(name: string, remark?: string, directories: readonly WorkspaceRef[] = []): Promise<Workspace> {
    await this.ready
    const now = Date.now()
    const ws: Workspace = {
      id: randomUUID(),
      name,
      ...(remark !== undefined && remark !== '' ? { remark } : {}),
      directories: [...directories],
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
        workspaces: this.shape.workspaces.map(w => w.id === id ? { ...w, directories: [...directories], updatedAt: Date.now() } : w),
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
            ? record.selection.map(parseRef).filter((r): r is WorkspaceRef => r !== undefined)
            : []
          const ws = makeDefaultWorkspace(dirs)
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
