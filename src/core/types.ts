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

/** 目录访问模式：读写 / 只读 / 禁用（禁用目录不注入上下文）。 */
export type DirectoryAccess = 'readwrite' | 'readonly' | 'disabled'

/** 工作空间模式：anchor=文档锚点（主目录存文档），single=传统单项目（主目录是核心代码）。 */
export type WorkspaceMode = 'anchor' | 'single'

/** 文件加载模式：full=完整文件树，summary=目录摘要（计数），tree=浅层目录树。 */
export type LoadMode = 'full' | 'summary' | 'tree'

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
  /** 目录访问模式（默认 readwrite；主项目固定 readwrite）。 */
  access?: DirectoryAccess
  /** 目录分组标签（如 文档/后端/前端/参考；prompt 内按组渲染）。 */
  group?: string
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

/** 工作空间目录配置快照（一键保存/恢复目录选择 + 访问模式 + 分组）。 */
export interface WorkspaceSnapshot {
  /** 唯一标识。 */
  id: string
  /** 快照名（用户自定义）。 */
  name: string
  /** 快照时的目录列表（含访问模式/分组）。 */
  directories: WorkspaceRef[]
  /** 保存时间。 */
  createdAt: number
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
  /** 工作空间模式（默认 anchor）。 */
  mode?: WorkspaceMode
  /** 文件加载模式（默认 summary）。 */
  loadMode?: LoadMode
  /** 目录配置快照（一键保存/恢复）。 */
  snapshots?: WorkspaceSnapshot[]
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

/** 单个目录的上下文统计。 */
export interface DirectoryContextStat {
  name: string
  path: string
  access: DirectoryAccess
  /** 文件数。 */
  files: number
  /** 子目录数。 */
  dirs: number
  /** 该目录文件索引区块的估算 token 数。 */
  tokens: number
}

/** 上下文监控汇总。 */
export interface ContextStats {
  loadMode: LoadMode
  directories: DirectoryContextStat[]
  totalFiles: number
  totalDirs: number
  /** 文件索引区块估算 token 数。 */
  fileIndexTokens: number
  /** 目录清单 + 规则等固定开销估算 token 数。 */
  promptOverheadTokens: number
}
