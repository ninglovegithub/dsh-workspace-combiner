/**
 * 双面共享的不变量：插件身份、API 路径、面板 id、prompt 排序、沙盒联动常量。
 * 本文件必须平台无关（client bundle 也编译它），禁止任何 node 依赖。
 * @module dsh-workspace-combiner/invariant
 */

/** npm 包名 / cordis 编排行 id（package.json 的 name 与 cordis.patch.yml 的 name）。 */
export const PLUGIN_ID = 'dsh-workspace-combiner'

/** 侧边栏面板 id：既是 sidebar.panellist 的 id，也是 main 插槽的 key。 */
export const PANEL_ID = 'workspace-combiner'

/** system prompt 分节名（全局唯一，供 agent preset 等按名 shadow）。 */
export const SECTION_NAME = 'plugin:dsh-workspace-combiner'

/**
 * system prompt 分节排序：放在部署 persona（0）之后、plan policy（500）之前，
 * 使「多工作区联合开发模式」成为模型最早读到的一批强约束之一。
 */
export const SECTION_ORDER = 190

/** 默认工作空间名（新建向导未命名时的兜底；host 建目录 / client 查重共用）。 */
export const DEFAULT_WORKSPACE_NAME = '未命名工作空间'

/** 注入 prompt 的文件索引 token 预算默认值（工作空间未配置时生效）。 */
export const DEFAULT_TOKEN_BUDGET = 60000

/** 功能/接口索引的 token 预算默认值（独立于文件索引，避免互相挤占）。 */
export const DEFAULT_CODE_INDEX_BUDGET = 400

/** 宿主持久化文件名（相对 $DSH_HOME / ~/.dsh）。 */
export const STORE_FILE = 'dsh-workspace-combiner.json'

/** client -> host 的 HTTP 路由族（与 dsh-multi-root 同约定：loopback-only）。 */
export const API = {
  state: '/api/dsh-workspace-combiner/state',
  workspaceCreate: '/api/dsh-workspace-combiner/workspace-create',
  workspaceRename: '/api/dsh-workspace-combiner/workspace-rename',
  workspaceDelete: '/api/dsh-workspace-combiner/workspace-delete',
  workspaceSwitch: '/api/dsh-workspace-combiner/workspace-switch',
  workspaceDirectories: '/api/dsh-workspace-combiner/workspace-directories',
  workspaceMode: '/api/dsh-workspace-combiner/workspace-mode',
  workspacePatch: '/api/dsh-workspace-combiner/workspace-patch',
  workspaceSnapshot: '/api/dsh-workspace-combiner/workspace-snapshot',
  workspaceLoadMode: '/api/dsh-workspace-combiner/workspace-loadmode',
  contextStats: '/api/dsh-workspace-combiner/context-stats',
  fileIndex: '/api/dsh-workspace-combiner/file-index',
  gitStatus: '/api/dsh-workspace-combiner/git-status',
  scan: '/api/dsh-workspace-combiner/scan',
  stat: '/api/dsh-workspace-combiner/stat',
  codeIndex: '/api/dsh-workspace-combiner/code-index',
} as const

/** 请求体上限（1 MiB），超出直接拒绝。 */
export const MAX_JSON_BODY_BYTES = 1 << 20

// ---------------------------------------------------------------------------
// 联动 @chaoset/sandbox-extra-roots
// ---------------------------------------------------------------------------

/** sandbox-extra-roots 的配置目录名（相对 $DSH_HOME/plugins）。 */
export const SANDBOX_PLUGIN_NAME = 'sandbox-extra-roots'

/** sandbox-extra-roots 暴露给 host 的 typert 远程服务键（PluginConfigGateway）。 */
export const SANDBOX_REMOTE_SERVICE = 'sandboxExtraRootsConfig'
