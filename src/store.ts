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
import { dirname, join, resolve, sep } from 'node:path'
import { emptyStore, type ContextPreset, type CustomStandard, type LoadMode, type StoreShape, type Workspace, type WorkspaceMode, type WorkspaceRef, type WorkspaceSnapshot, type WorkspaceStandards } from './core/types.ts'
import { contextPresetConfig } from './core/contextPreset.ts'
import { defaultWorkspaceStandards, parseCustomStandard } from './core/standards.ts'
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
 * 规范化目录绝对路径：解析相对/冗余段并去掉尾部分隔符。
 *
 * 不这样做的话，`/a/b` 与 `/a/b/` 会被当成两个不同目录：沙盒白名单会出现只差
 * 一个斜杠的重复项，「期望目录是否已同步」的精确比较永远判缺失（诊断项长期误
 * 报），按路径查重的逻辑也会失效。
 */
function normalizeDirPath(path: string): string {
  const trimmed = path.trim()
  if (trimmed === '') return ''
  const resolved = resolve(trimmed)
  if (resolved === sep) return resolved
  const stripped = resolved.replace(/[\\/]+$/, '')
  if (stripped === '') return resolved
  // Windows 盘根 'C:\' 去掉尾分隔符会变成没有意义的 'C:'，要补回来。
  return stripped.endsWith(':') ? stripped + sep : stripped
}

/** 路径比较键：Windows 下大小写不敏感。 */
function pathKey(path: string): string {
  return process.platform === 'win32' ? path.toLowerCase() : path
}

/**
 * 目录列表的唯一事实来源是数组顺序：第一项就是主目录。把历史字段也随之
 * 规范化，避免拖拽重排后 isPrimary / access 仍留在旧主目录上，导致持久化
 * 数据与实际建会话目录、沙盒白名单相互矛盾。
 *
 * 主目录只补默认的 readwrite，不覆盖用户显式设置的 access；同一路径只保留
 * 第一次出现（重复项会让仓库被重复扫描、重复注入、重复写进沙盒白名单）。
 */
function normalizeDirectories(directories: readonly WorkspaceRef[]): WorkspaceRef[] {
  const seen = new Set<string>()
  const out: WorkspaceRef[] = []
  for (const directory of directories) {
    const path = normalizeDirPath(directory.path)
    if (path === '') continue
    const key = pathKey(path)
    if (seen.has(key)) continue
    seen.add(key)
    const normalized = path === directory.path ? directory : { ...directory, path }
    if (out.length === 0) {
      out.push({ ...normalized, isPrimary: true, access: normalized.access ?? 'readwrite' })
    } else {
      const { isPrimary: _isPrimary, ...secondary } = normalized
      out.push(secondary)
    }
  }
  return out
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

/** 校验并规范化工作空间级的规范绑定。 */
function parseStandards(raw: unknown): WorkspaceStandards | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const record = raw as Record<string, unknown>
  const asIds = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item !== '') : []
  const global = asIds(record.global)
  const perDirectory: Record<string, string[]> = {}
  if (record.perDirectory !== null && typeof record.perDirectory === 'object' && !Array.isArray(record.perDirectory)) {
    for (const [key, value] of Object.entries(record.perDirectory as Record<string, unknown>)) {
      const ids = asIds(value)
      if (ids.length > 0) perDirectory[key] = ids
    }
  }
  const workspaceOverrides: Record<string, string> = {}
  if (record.workspaceOverrides !== null && typeof record.workspaceOverrides === 'object' && !Array.isArray(record.workspaceOverrides)) {
    for (const [key, value] of Object.entries(record.workspaceOverrides as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim() !== '') workspaceOverrides[key] = value
    }
  }
  const workspaceCustom = Array.isArray(record.workspaceCustom)
    ? record.workspaceCustom.map(parseCustomStandard).filter((item): item is CustomStandard => item !== undefined)
    : []
  const result: WorkspaceStandards = {
    ...(global.length > 0 ? { global } : {}),
    ...(Object.keys(perDirectory).length > 0 ? { perDirectory } : {}),
    ...(workspaceCustom.length > 0 ? { workspaceCustom } : {}),
    ...(Object.keys(workspaceOverrides).length > 0 ? { workspaceOverrides } : {}),
    ...(typeof record.budget === 'number' && Number.isFinite(record.budget) && record.budget > 0 ? { budget: Math.round(record.budget) } : {}),
    ...(typeof record.autoMatch === 'boolean' ? { autoMatch: record.autoMatch } : {}),
  }
  return Object.keys(result).length > 0 ? result : undefined
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
    ...(ws.contextPreset === 'economy' || ws.contextPreset === 'balanced' || ws.contextPreset === 'deep' || ws.contextPreset === 'custom' ? { contextPreset: ws.contextPreset } : {}),
    ...(Array.isArray(ws.snapshots) ? { snapshots: ws.snapshots.map(parseSnapshot).filter((s): s is WorkspaceSnapshot => s !== undefined) } : {}),
    ...(typeof ws.tokenBudget === 'number' && Number.isFinite(ws.tokenBudget) && ws.tokenBudget > 0 ? { tokenBudget: Math.round(ws.tokenBudget) } : {}),
    ...(typeof ws.fileIndexBudget === 'number' && Number.isFinite(ws.fileIndexBudget) && ws.fileIndexBudget >= 0 ? { fileIndexBudget: Math.round(ws.fileIndexBudget) } : {}),
    ...(typeof ws.commandsBudget === 'number' && Number.isFinite(ws.commandsBudget) && ws.commandsBudget >= 0 ? { commandsBudget: Math.round(ws.commandsBudget) } : {}),
    ...(typeof ws.pinned === 'boolean' ? { pinned: ws.pinned } : {}),
    ...(typeof ws.color === 'string' && ws.color !== '' ? { color: ws.color } : {}),
    ...(typeof ws.codeIndexEnabled === 'boolean' ? { codeIndexEnabled: ws.codeIndexEnabled } : {}),
    ...(typeof ws.codeIndexBudget === 'number' && Number.isFinite(ws.codeIndexBudget) && ws.codeIndexBudget >= 0 ? { codeIndexBudget: Math.round(ws.codeIndexBudget) } : {}),
    ...(ws.codeIndexSummary === 'off' || ws.codeIndexSummary === 'llm' ? { codeIndexSummary: ws.codeIndexSummary } : {}),
    ...(parseStandards(ws.standards) !== undefined ? { standards: parseStandards(ws.standards) as WorkspaceStandards } : {}),
  }
}

/** 构造一个默认工作空间（全新安装 / 迁移 / 兜底）。 */
function makeDefaultWorkspace(directories: readonly WorkspaceRef[] = []): Workspace {
  const now = Date.now()
  const preset = contextPresetConfig('balanced')
  return { id: randomUUID(), name: '默认工作空间', directories: [...directories], contextPreset: 'balanced', loadMode: preset.loadMode, tokenBudget: preset.globalBudget, fileIndexBudget: preset.fileIndexBudget, commandsBudget: preset.commandsBudget, codeIndexBudget: preset.codeIndexBudget, codeIndexSummary: preset.codeIndexSummary, standards: defaultWorkspaceStandards(), createdAt: now, updatedAt: now }
}

/**
 * 把已解析的 JSON 值转换成 StoreShape（含 v1 -> v2 迁移）。
 * 结构不可识别时返回 undefined，由调用方按「损坏」处理——绝不返回空库。
 */
function parseShape(parsed: unknown): StoreShape | undefined {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
  const record = parsed as Record<string, unknown>
  if (record.version === 1 || Array.isArray(record.selection)) {
    // v1 -> v2：旧的全局 selection 迁入一个默认工作空间。
    const dirs = Array.isArray(record.selection)
      ? record.selection.map(parseWorkspaceRef).filter((r): r is WorkspaceRef => r !== undefined)
      : []
    const ws = makeDefaultWorkspace(normalizeDirectories(dirs))
    return { version: 2, currentWorkspaceId: ws.id, workspaces: [ws] }
  }
  const workspaces = Array.isArray(record.workspaces)
    ? record.workspaces.map(parseWorkspace).filter((w): w is Workspace => w !== undefined)
    : []
  // 有 workspaces 字段却一条都没解析出来 = 结构被破坏，不当成空库处理。
  if (Array.isArray(record.workspaces) && record.workspaces.length > 0 && workspaces.length === 0) return undefined
  const current = typeof record.currentWorkspaceId === 'string' && workspaces.some(w => w.id === record.currentWorkspaceId)
    ? record.currentWorkspaceId
    : workspaces[0]?.id ?? ''
  return { version: 2, currentWorkspaceId: current, workspaces }
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
  /** 加载失败的原因；undefined = 正常。非 undefined 时禁止落盘。 */
  private loadFailure: unknown = undefined

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
    const preset = contextPresetConfig('balanced')
    const ws: Workspace = {
      id: randomUUID(),
      name,
      ...(remark !== undefined && remark !== '' ? { remark } : {}),
      directories: normalizeDirectories(directories),
      mode,
      loadMode,
      contextPreset: 'balanced',
      tokenBudget: preset.globalBudget,
      fileIndexBudget: preset.fileIndexBudget,
      commandsBudget: preset.commandsBudget,
      codeIndexBudget: preset.codeIndexBudget,
      codeIndexSummary: preset.codeIndexSummary,
      // 默认启用「会话锚点边界」：锚点只存文档、代码只在项目目录。
      standards: defaultWorkspaceStandards(),
      createdAt: now,
      updatedAt: now,
    }
    await this.mutate(() => {
      this.shape = { ...this.shape, currentWorkspaceId: ws.id, workspaces: [...this.shape.workspaces, ws] }
    })
    return ws
  }

  /**
   * 复制工作空间：保留全部挂载目录与配置，只换名称和新 id。
   *
   * 刻意**不碰磁盘**——不新建、不复制任何目录。因此副本与原工作空间共享同一批
   * 挂载目录（"只改名字，其余保持一致"），适合同一批代码开多个互不干扰的会话。
   * @param sourceId - 被复制的工作空间 id。
   * @param name - 副本名称（调用方负责查重）。
   * @returns 新建的副本；副本会成为当前工作空间。
   */
  async duplicateWorkspace(sourceId: string, name: string): Promise<Workspace> {
    await this.ready
    const now = Date.now()
    let copy: Workspace | undefined
    await this.mutate(() => {
      const source = this.shape.workspaces.find(w => w.id === sourceId)
      if (source === undefined) return
      copy = {
        ...source,
        id: randomUUID(),
        name,
        // 深拷贝目录：副本之后改 access / group / note 不能牵动原工作空间。
        directories: normalizeDirectories(source.directories.map(d => ({ ...d }))),
        createdAt: now,
        updatedAt: now,
      }
      this.shape = {
        ...this.shape,
        currentWorkspaceId: copy.id,
        workspaces: [...this.shape.workspaces, copy],
      }
    })
    if (copy === undefined) throw new Error(`workspace not found: ${sourceId}`)
    return copy
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
    // currentWorkspaceId 必须在闭包内读取：mutate 会先重读磁盘，闭包外的快照可能已过期。
    let nextCurrent = ''
    await this.mutate(() => {
      const rest = this.shape.workspaces.filter(w => w.id !== id)
      if (rest.length === this.shape.workspaces.length) {
        nextCurrent = this.shape.currentWorkspaceId
        return
      }
      nextCurrent = this.shape.currentWorkspaceId === id ? rest[0]?.id ?? '' : this.shape.currentWorkspaceId
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

  /** 覆盖某工作空间的开发规范绑定。 */
  async setWorkspaceStandards(id: string, standards: WorkspaceStandards): Promise<void> {
    await this.ready
    await this.mutate(() => {
      if (!this.shape.workspaces.some(w => w.id === id)) return
      const parsed = parseStandards(standards)
      this.shape = {
        ...this.shape,
        workspaces: this.shape.workspaces.map(w => w.id === id
          ? { ...w, ...(parsed === undefined ? { standards: undefined } : { standards: parsed }), updatedAt: Date.now() }
          : w),
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
  async patchMeta(id: string, patch: { pinned?: boolean; color?: string; contextPreset?: ContextPreset; tokenBudget?: number; fileIndexBudget?: number; commandsBudget?: number; codeIndexEnabled?: boolean; codeIndexBudget?: number; codeIndexSummary?: 'off' | 'llm' }): Promise<void> {
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
              ...(patch.contextPreset !== undefined ? { contextPreset: patch.contextPreset } : {}),
              ...(patch.tokenBudget !== undefined ? { tokenBudget: Math.max(1, Math.round(patch.tokenBudget)) } : {}),
              ...(patch.fileIndexBudget !== undefined ? { fileIndexBudget: Math.max(0, Math.round(patch.fileIndexBudget)) } : {}),
              ...(patch.commandsBudget !== undefined ? { commandsBudget: Math.max(0, Math.round(patch.commandsBudget)) } : {}),
              ...(patch.codeIndexEnabled !== undefined ? { codeIndexEnabled: patch.codeIndexEnabled } : {}),
              // 0 = 不注入上下文（按需查索引文件），不是「未设置」，别 clamp 成 1。
              ...(patch.codeIndexBudget !== undefined ? { codeIndexBudget: Math.max(0, Math.round(patch.codeIndexBudget)) } : {}),
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
        workspaces: this.shape.workspaces.map(w => w.id === id ? { ...w, lastSessionAt: now } : w),
      }
    })
  }

  /**
   * 一次性加载：文件不存在（首启）退化为空存储；v1 结构自动迁移为 v2。
   *
   * 关键纪律：读取/解析失败**不等于**空存储。若把损坏文件当成空库继续跑，
   * 紧接着的 session/created 会触发 touchWorkspaceSession → persist，用空数据
   * 覆盖用户原有文件，工作空间会静默全部丢失。因此这里把原文件改名为
   * `.corrupt-<时间戳>` 留证，并置 loadFailure 让 persist 拒绝写入。
   */
  private async load(): Promise<void> {
    let raw: string
    try {
      raw = await readFile(this.file, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.loadFailure = error
        await this.quarantine()
      }
      return this.ensureDefaultWorkspace()
    }
    try {
      const parsed = parseShape(JSON.parse(raw) as unknown)
      if (parsed === undefined) throw new Error('store structure is not recognized')
      this.shape = parsed
    } catch (error) {
      // 损坏：隔离原文件，本次会话只读内存，不覆盖磁盘。
      this.loadFailure = error
      await this.quarantine()
    }
    this.ensureDefaultWorkspace()
  }

  /** 兜底：始终至少存在一个工作空间，保证「新建会话」有归属。 */
  private ensureDefaultWorkspace(): void {
    if (this.shape.workspaces.length === 0) {
      const ws = makeDefaultWorkspace()
      this.shape = { ...this.shape, workspaces: [ws], currentWorkspaceId: ws.id }
    }
  }

  /** 把无法解析的存储文件改名留证（失败只告警，不阻断启动）。 */
  private async quarantine(): Promise<void> {
    try {
      await rename(this.file, `${this.file}.corrupt-${Date.now()}`)
    } catch {
      // 改名失败（权限/已被移走）不影响只读降级本身。
    }
  }

  /** 上次加载是否失败（失败后禁止落盘，避免用空数据覆盖用户文件）。 */
  loadFailed(): boolean {
    return this.loadFailure !== undefined
  }

  /** 上次加载失败的原因（正常加载为 undefined）。 */
  loadError(): unknown {
    return this.loadFailure
  }

  /**
   * 串行化一次变更：**先重读磁盘**，再应用更新，最后原子落盘。
   *
   * 重读这一步是多进程/多窗口下的正确性关键：桌面端与 `dsh web` CLI 共享同一个
   * `~/.dsh/dsh-workspace-combiner.json`，而本实例只在构造时加载过一次。若直接
   * 用内存快照整份覆盖，后写者会把对方刚做的改动全部抹掉（丢更新）。重读后让
   * 更新闭包作用在最新状态上，等于把本次变更 rebase 到磁盘现状。
   */
  private mutate(update: () => void): Promise<void> {
    const run = async (): Promise<void> => {
      await this.reloadFromDisk()
      update()
      await this.persist()
    }
    this.chain = this.chain.then(run, run)
    return this.chain
  }

  /**
   * 落盘前重读磁盘（仅当文件仍可解析）。失败时保持内存现状并把错误交给 persist
   * 拒绝写入——宁可本次改不动，也不要用过期快照覆盖别人的数据。
   */
  private async reloadFromDisk(): Promise<void> {
    if (this.loadFailure !== undefined) return
    let raw: string
    try {
      raw = await readFile(this.file, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      this.loadFailure = error
      return
    }
    try {
      const parsed = parseShape(JSON.parse(raw) as unknown)
      if (parsed === undefined) throw new Error('store structure is not recognized')
      this.shape = parsed
    } catch (error) {
      // 不隔离文件（可能属于另一个仍在运行的进程），只拒绝本次写入。
      this.loadFailure = error
    }
  }

  /**
   * 原子落盘：临时文件 + rename，目录 0700、文件 0600。
   * 加载失败时直接拒绝写入——内存里是空库，写下去就等于删掉用户数据。
   */
  private async persist(): Promise<void> {
    if (this.loadFailure !== undefined) {
      throw new Error(`store load failed (${String(this.loadFailure)}); refusing to overwrite ${this.file}`)
    }
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 })
    // 临时名带随机后缀：同进程内多个 store 实例（重复 apply / 测试）不会互相踩。
    const tmp = `${this.file}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`
    await writeFile(tmp, JSON.stringify(this.shape, null, 2), { mode: 0o600 })
    await rename(tmp, this.file)
    await chmod(this.file, 0o600).catch(() => {
      // 平台不支持 chmod 语义时尽力而为；open 时的 mode 已生效。
    })
  }
}
