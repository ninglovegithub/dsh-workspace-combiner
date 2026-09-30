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

/** 加载模式对应的文件树最大扫描深度（summary 只需计数，深度 1 足够）。 */
export function loadModeMaxDepth(loadMode: LoadMode): number {
  return loadMode === 'full' ? 4 : loadMode === 'tree' ? 3 : 1
}

/** 一个目录的常用命令（面板可编辑，注入 prompt 供模型自证与自启）。 */
export interface DirectoryCommands {
  /** 启动 / 开发服务命令。 */
  run?: string
  /** 测试命令。 */
  test?: string
  /** 构建命令。 */
  build?: string
}

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
  /** 目录备注（用户自定义，展示在目录名下方；随目录列表整体持久化）。 */
  note?: string
  /** 该目录的常用命令（启动 / 测试 / 构建；注入 prompt 时带绝对路径）。 */
  commands?: DirectoryCommands
}

/** 一个目录的 git 状态（非 git 仓库时为 null）。 */
export interface GitStatus {
  /** 当前分支名（detached HEAD 时为 HEAD）。 */
  branch: string
  /** 已修改未暂存文件数。 */
  dirty: number
  /** 未跟踪文件数。 */
  untracked: number
  /** 领先远程提交数。 */
  ahead: number
}

/** 一处代码落点（相对某目录根的路径 + 行号）。 */
export interface CodeIndexLoc {
  file: string
  line: number
}

/** 功能索引配对结果的可信等级。 */
export type CodeIndexConfidence = 'exact' | 'normalized' | 'heuristic' | 'unpaired'

/** 功能角度代码索引条目：一个端点的前后端落点（自动抽取，可能有噪声）。 */
export interface CodeIndexEntry {
  /** 功能名（优先端点常量名，否则取路径首段）。 */
  feature: string
  /** 端点路径。 */
  endpoint: string
  /** 服务端注册/处理处。 */
  server?: CodeIndexLoc
  /** 客户端调用处。 */
  client?: CodeIndexLoc
  /** 服务端落点所属目录的绝对路径（跨目录配对展示用）。 */
  serverDir?: string
  /** 客户端落点所属目录的绝对路径。 */
  clientDir?: string
  /** 其它引用处数量。 */
  refs: number
  /** 可选的一句话功能摘要（codeIndexSummary='llm' 时生成并缓存）。 */
  summary?: string
  /** 配对可信等级：精确、归一化后匹配、启发式推断或单边落点。 */
  confidence?: CodeIndexConfidence
  /** 形成该等级的机器可读原因，供界面解释而不挤占常驻 prompt。 */
  reasons?: string[]
  /** 本条索引生成时间。 */
  indexedAt?: number
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
  /** 按项目类型推断的常用命令默认值（面板可改）。 */
  commands?: DirectoryCommands
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

/** 用户自建规范（可全局共享，也可仅属于某个工作空间）。 */
export interface CustomStandard {
  id: string
  name: string
  /** 技术栈分组键。 */
  tech: string
  /** 一句话说明。 */
  summary: string
  /** 规范正文（markdown 列表）。 */
  body: string
}

/** 工作空间级的开发规范绑定。 */
export interface WorkspaceStandards {
  /** 应用到整个工作空间的规范 id。 */
  global?: string[]
  /** 逐目录规范：目录绝对路径 -> 规范 id 列表。 */
  perDirectory?: Record<string, string[]>
  /** 仅本工作空间的自建规范。 */
  workspaceCustom?: CustomStandard[]
  /** 仅本工作空间的覆盖正文：id -> body。 */
  workspaceOverrides?: Record<string, string>
  /** 注入预算（缺省 DEFAULT_STANDARDS_BUDGET）。 */
  budget?: number
  /** 是否按 projectType 自动匹配内置规范（缺省 true）。 */
  autoMatch?: boolean
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
  /** 注入 prompt 的 token 预算上限（面板监控区可配置；缺省 60000）。 */
  tokenBudget?: number
  /** 是否置顶（面板工作空间列表排序优先）。 */
  pinned?: boolean
  /** 颜色标识（面板工作空间列表色点；6 色循环）。 */
  color?: string
  /** 是否注入功能/接口索引（缺省 true）。 */
  codeIndexEnabled?: boolean
  /** 功能索引 token 预算（缺省 DEFAULT_CODE_INDEX_BUDGET）。 */
  codeIndexBudget?: number
  /** 功能摘要模式：off=不生成（缺省）；llm=调用模型生成一句话摘要并缓存。 */
  codeIndexSummary?: 'off' | 'llm'
  /** 开发规范绑定（缺省不注入任何规范）。 */
  standards?: WorkspaceStandards
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
  /** 目录清单 + 规则等固定开销估算 token 数（不含功能索引与命令区块）。 */
  promptOverheadTokens: number
  /** 开发规范区块估算 token 数。 */
  standardsTokens: number
  /** 功能/接口索引区块估算 token 数。 */
  codeIndexTokens: number
  /** 各项目常用命令区块估算 token 数。 */
  commandsTokens: number
}

// ---------------------------------------------------------------------------
// 真实 token 用量（provider 上报；用于面板「真实消耗」块）
// ---------------------------------------------------------------------------

/** 一步的 provider 上报用量（单次模型调用的结算样本）。 */
export interface TokenUsageSample {
  /** 未命中缓存的输入 token。 */
  inputTokens: number
  outputTokens: number
  /** 命中提示词缓存的输入 token。 */
  cacheReadTokens: number
  /** 写入缓存的 token。 */
  cacheWriteTokens: number
}

/** 一个会话（或一组会话求和）的 token 用量汇总。 */
export interface TokenUsageSummary {
  /** 结算的步数（turn/step 去重后）。 */
  steps: number
  /** 未命中缓存的输入总量。 */
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  /** prompt 侧总量 = 未命中输入 + 缓存读 + 缓存写。 */
  promptTokens: number
  /** 缓存命中率（0~1，cacheRead / promptTokens）；无样本时为 null。 */
  cacheHitRate: number | null
}

/** 面板「真实消耗」块的查询结果。 */
export interface TokenUsageReport {
  /** 统计覆盖的会话数。 */
  sessions: number
  /** 这些会话的用量合计。 */
  totals: TokenUsageSummary
  /** 最近活跃会话的上下文占用（无样本时为 null）。 */
  latest: { sessionId: string; contextWindow?: number; promptTokens: number } | null
}

/** 一处端点因某个文件改动而受影响。 */
export interface EndpointImpact {
  feature: string
  endpoint: string
  /** 命中的改动文件所属目录绝对路径。 */
  changedDir: string
  /** 命中的改动文件（相对其目录根）。 */
  changedFile: string
  /** 对端落点（服务端或客户端）所在目录绝对路径。 */
  counterpartDir?: string
  /** 对端落点（服务端或客户端）。 */
  counterpart?: CodeIndexLoc
}
