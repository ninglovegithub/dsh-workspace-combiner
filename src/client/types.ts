/**
 * client 半面的类型。为规避 @deepseek-ai/dsh-client-* 各包版本碎片化，这里用
 * 「结构镜像」的局部类型描述我们实际使用的部分，不 import 运行时包。
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
}

/** client 动态上下文的极小子集。 */
export interface ClientCtx {
  effect(cb: () => (() => void) | void, label?: string): void
  slots: SlotsService
  locale: LocaleService
  sessions: SessionsService
  workspaces: WorkspacesService
  remote: ClientRemote
}

/** sessions 服务最小形状（create + open）。 */
export interface SessionsService {
  create(opts: { workspaceId?: string; cwd?: string; sessionId?: string }): Promise<string>
  open(id: string): void
  /** 解析已创建会话的绑定（用于建会话后改名，走投影 title）。 */
  binding(id: string): { session: { rename(title: string): Promise<{ ok: boolean }> } } | undefined
  /** 会话列表快照（用于标题去重：读取已有持久标题）。 */
  list: { getSnapshot(): { ids: readonly string[]; byId: Record<string, { title?: string }> } }
}

/** workspaces 服务最小形状（get-or-create）。 */
export interface WorkspacesService {
  create(input: { path: string }): Promise<{ workspaceId: string; title: string; path: string }>
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
  bind(ns: string): (key: string, values?: Record<string, string>) => string
}
