/**
 * client 半面的类型。为规避 @deepseek-ai/dsh-client-* 各包版本碎片化，这里用
 * 「结构镜像」的局部类型描述我们实际使用的部分，不 import 运行时包。
 *
 * ⚠️ 这些镜像必须与 DSH 0.2.0-rc.2 的真实签名逐字对齐，否则 tsc 检查不到、
 * 只会在运行时炸。核对来源：
 *   - ctx.sessions.list 是 SnapshotStore（对象），读当前目录用 list.getSnapshot()
 *   - ctx.sessions.create(opts) 返回 Promise<SessionId>
 *   - ctx.sessions.binding(id) 借出一个 SessionBinding，改标题走 binding.session.rename
 *   - SessionFace 的身份字段是 sessionId（没有 id / append / snapshotEvents）
 *   - ctx.workspaces.create({ path }) 返回 WorkspaceView，id 字段是 workspaceId
 * @module dsh-workspace-combiner/client/types
 */

/** sidebar.panellist 图标组件收到的 owner props。 */
export interface PanelIconProps {
  size: number
  active: boolean
}

/**
 * 面板组件实际收到的 props：宿主通过闭包注入的动作。
 */
export interface WorkspaceCombinerPanelProps {
  /** 主目录 get-or-create 工作区后，永远新建并打开一个独立会话；可选设置会话标题。返回新会话 id。 */
  startSession: (mainDirPath: string, title?: string) => Promise<string>
  /** 打开宿主原生目录选择器，返回绝对路径；取消返回 null。 */
  pickDirectory: () => Promise<string | null>
  /** 把主项目目录注册为 DSH 左侧「工作区」列表项（get-or-create，触发左侧栏即时刷新）。 */
  registerDshWorkspace: (path: string) => Promise<void>
  /** 当前使用会话数（由 client 入口读取 sessions 快照后注入；缺省 0）。 */
  sessionCount?: number
  /** 会话标题查询（面板会话列表用；取不到返回空串，由面板回退短 id）。 */
  sessionTitle?: (id: string) => string
  /** 把主视图切到某个已有会话（服务缺失时为 no-op）。 */
  openSession?: (sessionId: string) => void
}

/** client 动态上下文的极小子集。 */
export interface ClientCtx {
  effect(cb: () => (() => void) | void, label?: string): void
  slots: SlotsService
  locale: LocaleService
  sessions: SessionsService
  workspaces: WorkspacesService
  remote: ClientRemote
  /**
   * 读取可选服务。**必须用它而不是 `ctx.xxx` 属性访问**：cordis 对未注入的服务做
   * 属性访问会抛 `cannot get property "xxx" without inject`；`get()` 不存在时返回
   * undefined，正适合"有就跳转、没有也不影响面板"的场景。
   */
  get?(name: string): unknown
}

/**
 * 主视图导航的最小形状。
 * 0.2.0-rc.2 的 `ClientSessions` 没有 `open()`——切换主视图会话是 ui-workspace 的职责
 * （官方 ui-chat / ui-subagent / ui-schedule 都调 `ctx.uiWorkspace.openSession(id)`）。
 */
export interface WorkspaceNavigation {
  /** 把主视图切到指定会话。 */
  openSession(sessionId: string): void
}

/** 会话 id（DSH 里是不透明字符串）。 */
export type SessionId = string

/**
 * `ctx.sessions.list` 是 SnapshotStore：**对象，不是函数**。
 * 目录快照至少含 ids（顺序）与 byId（明细，title 是持久标题）。
 */
export interface SessionsSnapshot {
  ids: readonly SessionId[]
  byId: Readonly<Record<SessionId, SessionSummaryFace | undefined>>
}

/** 会话目录明细的极小子集（其余字段如 blank/cwd/retainedBy 我们不使用）。 */
export interface SessionSummaryFace {
  /** 持久标题；未命名时宿主可能不给这个字段。 */
  title?: string
  cwd?: string
}

/** 借出的会话 binding（改标题用；不要再按 id 去 append 事件）。 */
export interface SessionBinding {
  readonly session: SessionFace
}

/** live session 最小形状：身份字段是 sessionId。 */
export interface SessionFace {
  readonly sessionId: SessionId
  /** 持久化重命名（宿主写入 session/title 事件）。 */
  rename(title: string): Promise<RpcResult<{ title: string }>>
}

/** 新建会话的选项（三者都可选；cwd 决定会话 shell 的工作目录）。 */
export interface SessionCreateOptions {
  workspaceId?: string
  cwd?: string
  sessionId?: SessionId
}

/** sessions 服务最小形状（DSH 0.2.0-rc.2）。 */
export interface SessionsService {
  /** 会话目录快照存储（对象；用 getSnapshot() 读）。 */
  list: { getSnapshot(): SessionsSnapshot }
  /** 新建会话（async，返回分配好的会话 id）。 */
  create(options?: SessionCreateOptions): Promise<SessionId>
  /** 借出已保留的会话 binding；未保留时返回 undefined。 */
  binding(id: SessionId): SessionBinding | undefined
}

/** workspaces create 的输入。 */
export interface WorkspaceCreateInput {
  path: string
}

/** workspaces.create 返回的视图（id 字段是 workspaceId）。 */
export interface WorkspaceView {
  workspaceId: string
  path?: string
  title?: string
}

/** workspaces 服务最小形状（DSH 0.2.0-rc.2：create(input) 按路径 get-or-create）。 */
export interface WorkspacesService {
  create(input: WorkspaceCreateInput): Promise<WorkspaceView>
}

/** remote 服务最小形状（directoryPicker 命名空间）。 */
export interface ClientRemote {
  directoryPicker: DirectoryPickerService
}

/** 宿主目录选择器 Remote 命名空间。 */
export interface DirectoryPickerService {
  pick(): Promise<RpcResult<string | null>>
}

/** 统一 Remote 结果。 */
export type RpcResult<T> = { ok: true; value: T } | { ok: false; error: { message: string } }

/** slots 服务的最小形状。 */
export interface SlotsService {
  inject(key: string, factory: () => () => void): () => void
  register(options: unknown, component: unknown): () => void
}

/** locale 服务的最小形状。 */
export interface LocaleService {
  register(ns: string, dictionaries: Record<string, Record<string, string>>): () => void
  /** 绑定命名空间得到翻译函数（重复 bind 返回同一引用；调用时读当前语言）。 */
  bind(ns: string): (key: string, values?: Record<string, string | number>) => string
}
