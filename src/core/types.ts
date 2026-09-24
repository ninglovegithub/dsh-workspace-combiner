/**
 * 双面共享的领域类型：host 半面持久化选中的工作区与模板，client 半面把
 * 工作区列表渲染成复选框并多选。此处必须保持「平台无关」——client bundle 也会
 * 编译本文件，禁止任何 node 依赖。
 * @module dsh-workspace-combiner/core/types
 */

/** 一个被选中的工作区（项目）引用。path 是宿主文件系统的绝对路径。 */
export interface WorkspaceRef {
  /** DSH 工作区稳定 id（WorkspaceId，来自 useWorkspaces 的 workspaceId）。 */
  id: string
  /** 展示名（来自 workspace 的 title，通常是目录 basename）。 */
  name: string
  /** 绝对路径（来自 workspace 的 path，宿主 canonical 路径）。 */
  path: string
}

/** 一个项目组合模板：命名的一组工作区引用，可一键恢复勾选并自动注册缺失工作区。 */
export interface Template {
  id: string
  name: string
  /** 勾选的工作区引用（含 id/name/path，顺序保持勾选顺序；加载时按 path 自动注册）。 */
  workspaces: WorkspaceRef[]
  createdAt: number
  updatedAt: number
}

/** 宿主持久化文件（~/.dsh/dsh-workspace-combiner.json）的磁盘形状。 */
export interface StoreShape {
  version: 1
  /** 当前勾选（对「下一次新建的会话」生效）。 */
  selection: WorkspaceRef[]
  /** 已保存的项目组合模板。 */
  templates: Template[]
}

/** 无选择的空存储快照。 */
export function emptyStore(): StoreShape {
  return { version: 1, selection: [], templates: [] }
}
