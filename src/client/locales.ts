/**
 * 面板文案词典（zh / en）。面板通过插槽渲染、拿不到 locale 服务的 t 函数，
 * 因此用 document.documentElement.lang 在调用时选择词典——与 dsh-multi-root
 * 的 tt 助手同思路，避免给插槽组件额外穿线 locale 上下文。
 * @module dsh-workspace-combiner/client/locales
 */

const zh = {
  title: '工作区组合器',
  warning: '⚠️ 勾选项目后，新建会话生效，旧会话不会自动加载',
  workspaces: '选择工作区',
  empty: '暂无工作区，请先在 DSH 中创建工作区',
  saveTemplate: '保存模板',
  loadTemplate: '加载并新建',
  deleteTemplate: '删除',
  clearSelection: '清空选择',
  templateName: '模板名称（如：infoxmed后端 + AI-FE前端）',
  templateNamePlaceholder: '输入模板名称后点击保存',
  templates: '项目组合模板',
  templatesEmpty: '暂无模板，勾选工作区后点击「保存模板」',
  selectedCount: '已勾选 {n} 个工作区',
  saved: '已保存',
  loaded: '已加载',
  cleared: '已清空',
  deleted: '已删除',
  loadFailed: '加载失败：{error}',
  saveFailed: '保存失败：{error}',
  nameRequired: '请先输入模板名称',
  noSelection: '请先勾选至少一个工作区',
  createSession: '新建会话',
  sessionCreated: '已新建会话（在首个勾选工作区中打开）',
  createFailed: '新建会话失败：{error}',
  primaryHint: '新建会话 / 加载模板后，会话在「首个勾选的工作区」中打开，其余工作区作为只读仓库注入',
  loading: '加载中…',
} as const

const en: Record<keyof typeof zh, string> = {
  title: 'Workspace Combiner',
  warning: '⚠️ Selection applies to NEW sessions only; already-open sessions are not reloaded',
  workspaces: 'Workspaces',
  empty: 'No workspaces yet — create one in DSH first',
  saveTemplate: 'Save template',
  loadTemplate: 'Load & new session',
  deleteTemplate: 'Delete',
  clearSelection: 'Clear selection',
  templateName: 'Template name (e.g. backend + AI-FE)',
  templateNamePlaceholder: 'Type a template name, then Save',
  templates: 'Project templates',
  templatesEmpty: 'No templates — check workspaces, then Save template',
  selectedCount: '{n} workspace(s) selected',
  saved: 'Saved',
  loaded: 'Loaded',
  cleared: 'Cleared',
  deleted: 'Deleted',
  loadFailed: 'Load failed: {error}',
  saveFailed: 'Save failed: {error}',
  nameRequired: 'Type a template name first',
  noSelection: 'Select at least one workspace first',
  createSession: 'New session',
  sessionCreated: 'Session created (opened in the first selected workspace)',
  createFailed: 'Create session failed: {error}',
  primaryHint: 'New session / Load template opens the session in the first selected workspace; the rest are injected as read-only repos',
  loading: 'Loading…',
}

export type WorkspaceCombinerKey = keyof typeof zh

/** 当前词典（按 document 语言选择，缺省 zh）。 */
function dictionary(): Record<WorkspaceCombinerKey, string> {
  const lang = typeof document !== 'undefined' ? document.documentElement.lang : 'zh'
  return lang.toLowerCase().startsWith('en') ? en : zh
}

/** 翻译一个 key，支持 {name} 模板参数。 */
export function tt(key: WorkspaceCombinerKey, values?: Record<string, string | number>): string {
  let out = dictionary()[key]
  if (values !== undefined) {
    for (const [name, value] of Object.entries(values)) out = out.replaceAll(`{${name}}`, String(value))
  }
  return out
}

export { en, zh }
