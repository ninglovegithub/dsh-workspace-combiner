/**
 * client 半面的类型。为规避 @deepseek-ai/dsh-client-* 各包版本碎片化
 * （client-runtime 0.1.1-rc.2 vs host 0.1.5-rc.2），这里用「结构镜像」的局部
 * 类型描述我们实际使用的部分，不 import 运行时包。结构对应关系注释标注。
 * @module dsh-workspace-combiner/client/types
 */

import type { ReactNode } from 'react'

/**
 * 工作区视图。结构镜像
 * @deepseek-ai/dsh-client-connection/client 的 WorkspaceView。
 */
export interface WorkspaceView {
  workspaceId: string
  title: string
  path: string
  sessionIds: readonly string[]
  createdAt: string
  updatedAt: string
}

/**
 * 工作区快照（useWorkspaces 订阅的 store 状态）。结构镜像
 * WorkspaceListState：items + phase + state。
 */
export interface WorkspaceSnapshot {
  items: readonly WorkspaceView[]
  phase: string
  state?: unknown
  archivedSessionIds?: readonly string[]
}

/** zustand 风格选择器 hook。结构镜像 SnapshotSelectorHook<T>。 */
export type SnapshotSelectorHook<T> = <R>(selector: (snapshot: T) => R) => R

/** sidebar.panellist 图标组件收到的 owner props。 */
export interface PanelIconProps {
  size: number
  active: boolean
}

/** 全局（root scope）插槽组件收到的标准 props；本插件只用 useWorkspaces。 */
export interface PanelStandardProps {
  useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>
}

/**
 * 面板组件实际收到的 props：标准 props + 宿主通过闭包注入的「新建会话」动作。
 * startSession 来自 ctx.sessions（Session Controller 的 create + open），即 DSH
 * 的 New Session 流程（首个勾选工作区作为会话 cwd，创建后打开该会话）。
 */
export interface WorkspaceCombinerPanelProps extends PanelStandardProps {
  startSession: (workspaceId: string) => Promise<void>
}

/** client 动态上下文（slots / locale / sessions / effect）的极小子集。 */
export interface ClientCtx {
  effect(cb: () => (() => void) | void, label?: string): void
  slots: SlotsService
  locale: LocaleService
  sessions: SessionsService
}

/**
 * sessions 服务最小形状（结构镜像 dsh-api-session-controller 的 ClientSessions）：
 * create({ workspaceId }) 在指定工作区创建一个会话并返回 sessionId，
 * open(id) 选中并打开该会话。
 */
export interface SessionsService {
  create(opts: { workspaceId?: string; cwd?: string; sessionId?: string }): Promise<string>
  open(id: string): void
}

/** slots 服务的最小形状（register/inject）。 */
export interface SlotsService {
  inject(key: string, factory: () => () => void): () => void
  register(options: unknown, component: unknown): () => void
}

/** locale 服务的最小形状。 */
export interface LocaleService {
  register(ns: string, dictionaries: Record<string, Record<string, string>>): () => void
  bind(ns: string): (key: string, values?: Record<string, string>) => string
}

/** 任何可渲染组件（宽松占位，实际组件由调用处约束）。 */
export type SlotComponent = (props: never) => ReactNode
