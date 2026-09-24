/**
 * 双面共享的领域类型：host 半面持久化自定义工作空间与模板，client 半面渲染。
 * 必须「平台无关」——client bundle 也编译本文件，禁止任何 node 依赖。
 * @module dsh-workspace-combiner/core/types
 */

/** 项目类型标识（由宿主扫描特征文件得出）。 */
export type ProjectType =
  | 'java'
  | 'frontend'
  | 'frontend-vue'
  | 'frontend-react'
  | 'frontend-webpack'
  | 'frontend-next'
  | 'python'
  | 'go'
  | 'generic'
  | 'none'

/** 一个被选中的项目（目录）引用。path 是宿主文件系统的绝对路径。 */
export interface WorkspaceRef {
  /** 稳定 id（本插件内 = path；兼容历史 DSH workspaceId）。 */
  id: string
  /** 展示名（通常是目录 basename）。 */
  name: string
  /** 绝对路径（项目根目录）。 */
  path: string
  /** 项目类型标识（自动识别；手动添加/兜底时为 'none'）。 */
  projectType?: ProjectType
  /** 识别依据（如 "pom.xml"、"package.json + src/"），hover 提示用。 */
  evidence?: string
  /** 是否主项目：运行时仍以数组第 0 项为主项目，此字段仅作持久化标记保持同步。 */
  isPrimary?: boolean
}

/** 目录项：工作空间里的一条项目目录引用（与 WorkspaceRef 同构，语义别名）。 */
export type DirectoryItem = WorkspaceRef

/** 一次目录扫描识别出的单个代码项目。 */
export interface DetectedProject {
  /** 项目根绝对路径。 */
  root: string
  /** 项目名（目录 basename）。 */
  name: string
  /** 项目类型。 */
  type: ProjectType
  /** 识别依据（特征文件名或描述）。 */
  evidence: string
}

/** 一个自定义工作空间：独立关联一组项目目录（主从顺序由数组顺序表达）。 */
export interface Workspace {
  /** 唯一标识。 */
  id: string
  /** 工作空间名称。 */
  name: string
  /** 备注。 */
  remark?: string
  /** 关联的项目目录列表（含主从、类型、路径）。 */
  directories: DirectoryItem[]
  createdAt: number
  updatedAt: number
  /** 最近一次在此工作空间下新建会话的时间。 */
  lastSessionAt?: number
}

/** 宿主持久化文件（~/.dsh/dsh-workspace-combiner.json）的磁盘形状。 */
export interface StoreShape {
  version: 2
  /** 当前激活的工作空间 id。 */
  currentWorkspaceId: string
  /** 所有自定义工作空间。 */
  workspaces: Workspace[]
}

/** 无内容的空存储快照（加载器会兜底补一个默认工作空间）。 */
export function emptyStore(): StoreShape {
  return { version: 2, currentWorkspaceId: '', workspaces: [] }
}
