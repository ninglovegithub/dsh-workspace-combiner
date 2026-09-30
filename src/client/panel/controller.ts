/**
 * 面板状态管理：自定义工作空间（增删改切 / 置顶 / 颜色 / token 预算）+ 每个工作空间
 * 独立绑定的项目目录（添加/删除/排序/多选批量）+ 注入 prompt 预览 + 目录失效检测。
 * @module dsh-workspace-combiner/client/panel/controller
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WorkspaceCombinerApi } from '../api.ts'
import type { CodeIndexEntry, ContextStats, DetectedProject, DirectoryAccess, DirectoryCommands, EndpointImpact, GitStatus, LoadMode, TokenUsageReport, Workspace, WorkspaceMode, WorkspaceRef, WorkspaceSnapshot, WorkspaceStandards } from '../../core/types.ts'
import { emptyLibrary, resolveStandardGroups, type StandardGroup, type StandardsLibrary } from '../../core/standards.ts'
import type { FileTreeNode } from '../../core/fileTree.ts'
import { calculateReadiness, type ReadinessReport } from '../../core/readiness.ts'
import type { SessionTask } from '../../core/task.ts'
import { DEFAULT_CODE_INDEX_BUDGET, DEFAULT_STANDARDS_BUDGET, DEFAULT_TOKEN_BUDGET } from '../../invariant.ts'
import { renderMultiWorkspacePrompt } from '../../prompt.ts'
import { tt } from '../locales.ts'
import { checkWorkspaceNameDuplicate, sanitizeWorkspaceName } from './naming.ts'

/** token 预算默认上限（与宿主机注入 prompt 使用同一常量）。 */
export { DEFAULT_TOKEN_BUDGET }


/**
 * 复制文本到剪贴板，返回是否成功。
 * navigator.clipboard 在非安全上下文 / 受限 iframe 中可能不存在，
 * 此时 writeText 会同步抛错——必须用 try/catch，不能只靠 Promise.catch。
 * @param text - 待复制文本。
 * @returns 是否复制成功。
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const clipboard = navigator.clipboard
    if (clipboard === undefined || typeof clipboard.writeText !== 'function') return false
    await clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** 一条 toast。 */
export interface Toast {
  id: number
  text: string
  kind: 'ok' | 'error'
}

/** 预览用的单目录文件索引条目（计数 + 文件树）。 */
export interface PreviewFileTree {
  name: string
  path: string
  /** 递归总文件数（api.fileIndex 返回）。 */
  files: number
  /** 递归总子目录数。 */
  dirs: number
  /** 计数达到扫描上限（数字为下界）。 */
  truncated?: boolean
  tree: FileTreeNode[]
}

/** 面板状态（收敛成一个对象，避免散落 useState 到 UI）。 */
export interface WorkspaceCombinerState {
  workspaces: readonly Workspace[]
  currentWorkspaceId: string
  currentWorkspace: Workspace | undefined
  /** 工作空间列表（置顶优先，其余保持原顺序）。 */
  sortedWorkspaces: readonly Workspace[]
  /** 经过搜索框过滤的工作空间列表。 */
  filteredWorkspaces: readonly Workspace[]
  /** 当前工作空间的目录列表（派生自 workspaces）。 */
  dirs: readonly WorkspaceRef[]
  /** 当前工作空间的目录配置快照（派生自 workspaces）。 */
  snapshots: readonly WorkspaceSnapshot[]
  toasts: readonly Toast[]
  manualPath: string
  snapshotName: string
  search: string
  /** 目录多选：被选中的目录 path 集合（主项目不可选）。 */
  selectedDirs: ReadonlySet<string>
  /** 目录存在性：path -> 是否存在（缺省视为存在）。 */
  missingDirs: ReadonlySet<string>
  /** 目录 git 状态：path -> 状态（null = 非 git 仓库；缺省 = 未加载）。 */
  gitStatuses: Readonly<Record<string, GitStatus | null>>
  /** token 预算上限（工作空间级，缺省 DEFAULT_TOKEN_BUDGET）。 */
  tokenBudget: number
  /** 预览：是否展开。 */
  previewOpen: boolean
  /** 预览：文件树（异步拉取 file-index）。 */
  previewTrees: readonly PreviewFileTree[]
  /** 预览：文件树是否加载中。 */
  previewLoading: boolean
  /** 预览：注入 prompt 文本（实时派生）。 */
  previewText: string
  /** 当前工作空间的功能/接口索引（异步拉取 code-index）。 */
  codeEntries: readonly CodeIndexEntry[]
  /** 功能索引是否注入（工作空间级）。 */
  codeIndexEnabled: boolean
  /** 功能索引 token 预算。 */
  codeIndexBudget: number
  /** 功能摘要模式。 */
  codeIndexSummary: 'off' | 'llm'
  setCodeIndexEnabled(enabled: boolean): void
  setCodeIndexBudget(value: number): void
  setCodeIndexSummary(mode: 'off' | 'llm'): void
  /** 全局规范库（覆盖 + 全局自建）。 */
  standardsLibrary: StandardsLibrary
  /** 当前工作空间的规范绑定。 */
  workspaceStandards: WorkspaceStandards | undefined
  /** 生效的规范分组。 */
  standardGroups: readonly StandardGroup[]
  /** 规范注入预算。 */
  standardsBudget: number
  saveStandardsLibrary(library: StandardsLibrary): void
  setWorkspaceStandards(next: WorkspaceStandards): void
  generateStandard(request: { name: string; tech?: string; directory?: string; hint?: string }): Promise<string>
  /** 当前工作空间的会话占用数（props 注入；缺省 0）。 */
  sessionCount: number
  /** 各工作空间已加载的会话 id（展开时懒加载；缺省 = 未读取）。 */
  sessionsByWorkspace: Readonly<Record<string, readonly string[]>>
  /** 展开会话列表的工作空间 id（null = 收起）。 */
  sessionsOpenId: string | null
  /** 正在刷新配置的会话 id（按钮禁用用）。 */
  refreshingSessionId: string | null
  setManualPath(path: string): void
  setSnapshotName(name: string): void
  setSearch(value: string): void
  setTokenBudget(value: number): void
  setPreviewOpen(open: boolean): void
  switchWorkspace(id: string): void
  /** 点击工作空间行：切为当前并展开它的会话列表；已是当前且已展开时收起。 */
  pickWorkspace(id: string): void
  /** 重新读取某工作空间的已加载会话列表。 */
  reloadWorkspaceSessions(id: string): void
  /** 把最新配置刷新进某个会话（下一轮请求生效）。 */
  refreshSession(sessionId: string): void
  createWorkspace(name: string, basePath: string, directories: readonly WorkspaceRef[], mode?: WorkspaceMode, loadMode?: LoadMode): void
  renameWorkspace(id: string, name: string): void
  deleteWorkspace(id: string): void
  pickAndAddDirectory(): void
  addDirectory(path: string): void
  removeDirectory(path: string): void
  moveDirectory(fromIndex: number, toIndex: number): void
  setDirectoryAccess(path: string, access: DirectoryAccess): void
  setDirectoryGroup(path: string, group: string): void
  setDirectoryNote(path: string, note: string): void
  toggleDirSelected(path: string): void
  clearDirSelection(): void
  bulkSetAccess(access: DirectoryAccess): void
  bulkSetGroup(group: string): void
  bulkRemove(): void
  setWorkspaceMode(mode: WorkspaceMode): void
  setLoadMode(loadMode: LoadMode): void
  contextStats: ContextStats | null
  /** 当前工作空间就绪度（纯客户端派生，不新增后端请求）。 */
  readiness: ReadinessReport
  refreshContextStats(): void
  /** 真实 token 用量（provider 上报，含提示词缓存命中率）。 */
  tokenUsage: TokenUsageReport | null
  refreshTokenUsage(): void
  /** 由工作区改动文件反查出的受影响端点（确定性查询，非预测）。 */
  endpointImpact: readonly EndpointImpact[]
  /** 参与反查的改动文件数（0 = 工作区干净）。 */
  endpointImpactFiles: number
  endpointImpactLoading: boolean
  refreshEndpointImpact(): void
  /** 设置某目录的常用命令（空对象则删除该字段）。 */
  setDirectoryCommands(path: string, commands: DirectoryCommands | undefined): void
  saveSnapshot(): void
  restoreSnapshot(snapshotId: string): void
  deleteSnapshot(snapshotId: string): void
  copyPreview(): void
  copyText(text: string): void
  /** 高级配置弹窗：一次性提交草稿（工作空间模式 + 文件加载模式）。 */
  saveAdvanced(mode: WorkspaceMode, loadMode: LoadMode): void
  createSession(): void
  createTaskSession(task: SessionTask): void
  dismissToast(id: number): void
}

/** 目录 basename（跨平台分隔符）。 */
function basename(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '')
  const seg = trimmed.split(/[\\/]/).pop()
  return seg === undefined || seg === '' ? trimmed : seg
}

function detectedProjectRef(project: DetectedProject): WorkspaceRef {
  const group = project.suggestedGroup === 'backend' ? tt('groupBackend')
    : project.suggestedGroup === 'frontend' ? tt('groupFrontend')
      : project.suggestedGroup === 'reference' ? tt('groupRef') : tt('groupOther')
  return {
    id: project.root,
    name: project.name,
    path: project.root,
    projectType: project.type,
    evidence: project.evidence,
    access: 'readwrite',
    group,
    ...(project.commands === undefined ? {} : { commands: project.commands }),
  }
}

/** 错误文本提取。 */
function errText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * 面板状态 hook。
 */
export function useWorkspaceCombiner(
  startSession: (mainDirPath: string, title?: string) => Promise<string>,
  pickDirectory: () => Promise<string | null>,
  registerDshWorkspace: (path: string) => Promise<void>,
  sessionCount = 0,
): WorkspaceCombinerState {
  const apiRef = useRef<WorkspaceCombinerApi | null>(null)
  if (apiRef.current === null) apiRef.current = new WorkspaceCombinerApi()

  const [workspaces, setWorkspaces] = useState<readonly Workspace[]>([])
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState('')
  const [toasts, setToasts] = useState<readonly Toast[]>([])
  const [manualPath, setManualPath] = useState('')
  const [snapshotName, setSnapshotName] = useState('')
  const [search, setSearch] = useState('')
  const [selectedDirs, setSelectedDirs] = useState<ReadonlySet<string>>(new Set())
  const [missingDirs, setMissingDirs] = useState<ReadonlySet<string>>(new Set())
  const [gitStatuses, setGitStatuses] = useState<Readonly<Record<string, GitStatus | null>>>({})
  const [contextStats, setContextStats] = useState<ContextStats | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewTrees, setPreviewTrees] = useState<readonly PreviewFileTree[]>([])
  const [codeEntries, setCodeEntries] = useState<readonly CodeIndexEntry[]>([])
  const [standardsLibrary, setStandardsLibrary] = useState<StandardsLibrary>(() => emptyLibrary())
  const [tokenUsage, setTokenUsage] = useState<TokenUsageReport | null>(null)
  const [endpointImpact, setEndpointImpact] = useState<readonly EndpointImpact[]>([])
  const [endpointImpactFiles, setEndpointImpactFiles] = useState(0)
  const [endpointImpactLoading, setEndpointImpactLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [budgetOverride, setBudgetOverride] = useState<number | null>(null)
  const [sessionsByWorkspace, setSessionsByWorkspace] = useState<Readonly<Record<string, readonly string[]>>>({})
  const [sessionsOpenId, setSessionsOpenId] = useState<string | null>(null)
  const [refreshingSessionId, setRefreshingSessionId] = useState<string | null>(null)
  const currentWsIdRef = useRef('')
  currentWsIdRef.current = currentWorkspaceId
  const sessionsOpenIdRef = useRef<string | null>(null)
  sessionsOpenIdRef.current = sessionsOpenId
  const toastSeq = useRef(0)

  const showToast = useCallback((text: string, kind: 'ok' | 'error' = 'ok'): void => {
    const id = ++toastSeq.current
    setToasts(prev => [...prev, { id, text, kind }].slice(-3))
    // toast 自动 3s 消失（可堆叠）。
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])
  const dismissToast = useCallback((id: number): void => setToasts(prev => prev.filter(t => t.id !== id)), [])

  // 拉取上下文统计（各目录文件数 + 估算 token）。
  const refreshContextStats = useCallback((): void => {
    const api = apiRef.current
    if (api === null) return
    void api.contextStats()
      .then(setContextStats)
      .catch(() => setContextStats(null))
  }, [])

  // 真实用量：宿主侧是内存读，轮询代价可忽略；10s 刷新一次即可反映最新消耗。
  const refreshTokenUsage = useCallback((): void => {
    const api = apiRef.current
    if (api === null) return
    void api.tokenUsage().then(setTokenUsage).catch(() => {})
  }, [])
  useEffect(() => {
    refreshTokenUsage()
    const timer = setInterval(refreshTokenUsage, 10_000)
    return () => clearInterval(timer)
  }, [refreshTokenUsage])

  // 水合。
  useEffect(() => {
    const api = apiRef.current
    if (api === null) return
    void api.getState()
      .then(state => {
        setWorkspaces(state.workspaces)
        setCurrentWorkspaceId(state.currentWorkspaceId)
      })
      .catch(error => showToast(tt('loadFailed', { error: errText(error) }), 'error'))
  }, [showToast])

  // 当前工作空间目录（派生）。
  const dirs = useMemo<readonly WorkspaceRef[]>(
    () => workspaces.find(w => w.id === currentWorkspaceId)?.directories ?? [],
    [workspaces, currentWorkspaceId],
  )
  // 副作用读取最新目录用 ref，避免把 dirs 身份纳入依赖（改只读/分组/备注时不触发全量轮询）。
  const dirsRef = useRef<readonly WorkspaceRef[]>(dirs)
  dirsRef.current = dirs
  const snapshots = useMemo<readonly WorkspaceSnapshot[]>(
    () => workspaces.find(w => w.id === currentWorkspaceId)?.snapshots ?? [],
    [workspaces, currentWorkspaceId],
  )
  const currentWorkspace = useMemo<Workspace | undefined>(
    () => workspaces.find(w => w.id === currentWorkspaceId),
    [workspaces, currentWorkspaceId],
  )

  // 排序：置顶在前，其余保持原有顺序。
  const sortedWorkspaces = useMemo<readonly Workspace[]>(
    () => [...workspaces].sort((a, b) => Number(b.pinned === true) - Number(a.pinned === true)),
    [workspaces],
  )
  // 搜索过滤（纯 UI，不调 API）。
  const filteredWorkspaces = useMemo<readonly Workspace[]>(() => {
    const q = search.trim().toLowerCase()
    if (q === '') return sortedWorkspaces
    return sortedWorkspaces.filter(w => w.name.toLowerCase().includes(q))
  }, [sortedWorkspaces, search])

  const tokenBudget = budgetOverride ?? currentWorkspace?.tokenBudget ?? DEFAULT_TOKEN_BUDGET

  const readiness = useMemo<ReadinessReport>(() => calculateReadiness({
    workspace: currentWorkspace,
    directories: dirs,
    missingDirectories: missingDirs,
    gitStatuses,
    contextStats,
    codeEntries,
    codeIndexEnabled: currentWorkspace?.codeIndexEnabled ?? true,
    tokenBudget,
    sessions: sessionsByWorkspace[currentWorkspaceId]?.length ?? 0,
  }), [currentWorkspace, dirs, missingDirs, gitStatuses, contextStats, codeEntries, tokenBudget, sessionsByWorkspace, currentWorkspaceId])

  // 上下文统计只受「目录集合 + 访问模式 + 加载模式」影响；改备注/分组/置顶/颜色时不重复扫描。
  const contextStatsKey = useMemo(
    () => dirs.map(d => d.path + ':' + (d.access ?? 'readwrite')).join('\n')
      + '|' + (currentWorkspace?.mode ?? 'anchor')
      + '|' + (currentWorkspace?.loadMode ?? 'summary'),
    [dirs, currentWorkspace],
  )
  useEffect(() => { refreshContextStats() }, [refreshContextStats, contextStatsKey])

  const codeIndexEnabled = currentWorkspace?.codeIndexEnabled ?? true
  const codeIndexBudget = currentWorkspace?.codeIndexBudget ?? DEFAULT_CODE_INDEX_BUDGET
  const codeIndexSummary = currentWorkspace?.codeIndexSummary ?? 'off'

  const workspaceStandards: WorkspaceStandards | undefined = currentWorkspace?.standards
  const standardsBudget = workspaceStandards?.budget ?? DEFAULT_STANDARDS_BUDGET
  // 生效规范分组（与宿主同源：同一份 core/standards 纯函数）。
  const standardGroups = useMemo(
    () => resolveStandardGroups(workspaceStandards, dirs, standardsLibrary),
    [workspaceStandards, dirs, standardsLibrary],
  )

  // 全局规范库：挂载时拉一次，保存后本地更新。
  useEffect(() => {
    const api = apiRef.current
    if (api === null) return
    let cancelled = false
    void api.standards().then(library => { if (!cancelled) setStandardsLibrary(library) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const saveStandardsLibrary = useCallback((library: StandardsLibrary): void => {
    setStandardsLibrary(library)
    const api = apiRef.current
    if (api === null) return
    void api.saveStandards(library).catch(error => showToast(tt('saveFailed', { error: errText(error) }), 'error'))
  }, [showToast])

  /** 用默认模型起草一份规范正文（可选能力；失败返回空串并提示）。 */
  const generateStandard = useCallback(async (request: { name: string; tech?: string; directory?: string; hint?: string }): Promise<string> => {
    const api = apiRef.current
    if (api === null) return ''
    try {
      const text = await api.generateStandard(request)
      if (text === '') showToast(tt('standardsAiFailed'), 'error')
      return text
    } catch (error) {
      showToast(tt('standardsAiFailed') + '：' + errText(error), 'error')
      return ''
    }
  }, [showToast])

  const setWorkspaceStandards = useCallback((next: WorkspaceStandards): void => {
    const id = currentWsIdRef.current
    const api = apiRef.current
    if (api === null || id === '') return
    setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, standards: next, updatedAt: Date.now() } : w))
    void api.setWorkspaceStandards(id, next)
      .then(() => refreshContextStats())
      .catch(error => showToast(tt('saveFailed', { error: errText(error) }), 'error'))
  }, [showToast, refreshContextStats])

  // 功能/接口索引：目录或配置变化时重新拉取；关闭时清空（不注入也不显示）。
  useEffect(() => {
    const api = apiRef.current
    if (api === null) return
    if (!codeIndexEnabled) { setCodeEntries([]); return }
    let cancelled = false
    void api.codeIndex()
      .then(list => { if (!cancelled) setCodeEntries(list) })
      .catch(() => { if (!cancelled) setCodeEntries([]) })
    return () => { cancelled = true }
  }, [contextStatsKey, codeIndexEnabled, codeIndexSummary])

  // 覆盖当前工作空间目录并持久化 + 联动 DSH 工作区 + 沙盒。
  const applyDirs = useCallback((next: readonly WorkspaceRef[]): void => {
    const id = currentWsIdRef.current
    setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, directories: [...next], updatedAt: Date.now() } : w))
    const api = apiRef.current
    if (api !== null) {
      void api.setWorkspaceDirectories(id, next)
        .then(() => refreshContextStats())
        .catch(error => showToast(tt('saveFailed', { error: errText(error) }), 'error'))
    }
    if (next[0]?.path !== undefined && next[0].path !== '') void registerDshWorkspace(next[0].path)
  }, [showToast, registerDshWorkspace, refreshContextStats])

  const switchWorkspace = useCallback((id: string): void => {
    const api = apiRef.current
    if (api === null) return
    setSelectedDirs(new Set())
    setSessionsOpenId(null)
    void api.switchWorkspace(id)
      .then(() => setCurrentWorkspaceId(id))
      .catch(error => showToast(tt('saveFailed', { error: errText(error) }), 'error'))
  }, [showToast])

  // 会话列表：某工作空间在本进程内加载过的会话（宿主内存读，展开时才拉取）。
  const reloadWorkspaceSessions = useCallback((id: string): void => {
    const api = apiRef.current
    if (api === null) return
    void api.workspaceSessions(id)
      .then(ids => setSessionsByWorkspace(prev => ({ ...prev, [id]: ids })))
      .catch(() => setSessionsByWorkspace(prev => ({ ...prev, [id]: [] })))
  }, [])

  // 点击工作空间行：切为当前并展开它的会话列表；已是当前且已展开时收起。
  const pickWorkspace = useCallback((id: string): void => {
    if (currentWsIdRef.current === id && sessionsOpenIdRef.current === id) {
      setSessionsOpenId(null)
      return
    }
    switchWorkspace(id)
    setSessionsOpenId(id)
    reloadWorkspaceSessions(id)
  }, [switchWorkspace, reloadWorkspaceSessions])

  // 刷新单个会话：宿主重建它的上下文快照，下一轮请求即带上最新配置。
  const refreshSession = useCallback((sessionId: string): void => {
    const api = apiRef.current
    if (api === null) return
    setRefreshingSessionId(sessionId)
    void api.refreshSession(sessionId)
      .then(() => {
        showToast(tt('sessionRefreshed'))
        const open = sessionsOpenIdRef.current
        if (open !== null) reloadWorkspaceSessions(open)
      })
      .catch(error => showToast(tt('sessionRefreshFailed', { error: errText(error) }), 'error'))
      .finally(() => setRefreshingSessionId(null))
  }, [showToast, reloadWorkspaceSessions])

  // 新建工作空间：宿主在 basePath 下创建同名文件夹作为主目录，其余目录作为代码项目。
  const createWorkspace = useCallback((name: string, basePath: string, directories: readonly WorkspaceRef[], mode: WorkspaceMode = 'anchor', loadMode: LoadMode = 'summary'): void => {
    const base = sanitizeWorkspaceName(name)
    if (base === '') {
      showToast(tt('nameRequired'), 'error')
      return
    }
    const finalName = checkWorkspaceNameDuplicate(base, undefined, workspaces)
    const api = apiRef.current
    if (api === null) return
    void api.createWorkspace(finalName, basePath, directories, mode, loadMode)
      .then(({ workspace, currentWorkspaceId: curId }) => {
        setWorkspaces(prev => [...prev, workspace])
        setCurrentWorkspaceId(curId)
        if (workspace.directories[0]?.path !== undefined) void registerDshWorkspace(workspace.directories[0].path)
        showToast(tt('wsCreatedNamed', { name: finalName }))
      })
      .catch(error => showToast(tt('saveFailed', { error: errText(error) }), 'error'))
  }, [workspaces, registerDshWorkspace, showToast])

  const renameWorkspace = useCallback((id: string, name: string): void => {
    const base = sanitizeWorkspaceName(name)
    if (base === '') {
      showToast(tt('nameRequired'), 'error')
      return
    }
    const finalName = checkWorkspaceNameDuplicate(base, id, workspaces)
    const api = apiRef.current
    if (api === null) return
    void api.renameWorkspace(id, finalName)
      .then(() => setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, name: finalName } : w)))
      .catch(error => showToast(tt('saveFailed', { error: errText(error) }), 'error'))
  }, [workspaces, showToast])

  const deleteWorkspace = useCallback((id: string): void => {
    const api = apiRef.current
    if (api === null) return
    void api.deleteWorkspace(id)
      .then(({ currentWorkspaceId: nextId }) => {
        setWorkspaces(prev => prev.filter(w => w.id !== id))
        setCurrentWorkspaceId(nextId)
        showToast(tt('wsDeleted'))
      })
      .catch(error => showToast(tt('saveFailed', { error: errText(error) }), 'error'))
  }, [showToast])

  const addDirectory = useCallback((path: string): void => {
    const trimmed = path.trim()
    if (trimmed === '') {
      showToast(tt('pathRequired'), 'error')
      return
    }
    if (dirsRef.current.some(d => d.path === trimmed)) {
      showToast(tt('alreadyAdded'), 'error')
      return
    }
    const fallback = (): void => {
      const current = dirsRef.current
      if (current.some(directory => directory.path === trimmed)) return
      applyDirs([...current, { id: trimmed, name: basename(trimmed), path: trimmed, access: 'readwrite', group: tt('groupOther') }])
    }
    const api = apiRef.current
    if (api === null) {
      fallback()
      return
    }
    void api.scan(trimmed)
      .then(projects => {
        const detected = projects.find(project => project.root === trimmed)
        if (detected === undefined) {
          fallback()
          return
        }
        const current = dirsRef.current
        if (current.some(directory => directory.path === trimmed)) return
        applyDirs([...current, detectedProjectRef(detected)])
      })
      .catch(fallback)
  }, [applyDirs, showToast])

  const pickAndAddDirectory = useCallback((): void => {
    void pickDirectory()
      .then(path => { if (path !== null && path.trim() !== '') addDirectory(path) })
      .catch(error => showToast(tt('pickFailed', { error: errText(error) }), 'error'))
  }, [pickDirectory, addDirectory, showToast])

  const removeDirectory = useCallback((path: string): void => {
    applyDirs(dirs.filter(d => d.path !== path))
    setSelectedDirs(prev => { const next = new Set(prev); next.delete(path); return next })
  }, [dirs, applyDirs])

  const moveDirectory = useCallback((fromIndex: number, toIndex: number): void => {
    if (fromIndex === toIndex) return
    const next = [...dirs]
    const [moved] = next.splice(fromIndex, 1)
    if (moved === undefined) return
    next.splice(toIndex, 0, moved)
    applyDirs(next)
  }, [dirs, applyDirs])

  // 切换目录访问模式（读写 / 只读 / 禁用）；主项目（第 0 项）固定读写，不允许改。
  const setDirectoryAccess = useCallback((path: string, access: DirectoryAccess): void => {
    const idx = dirs.findIndex(d => d.path === path)
    if (idx <= 0) return
    applyDirs(dirs.map((d, i) => i === idx ? { ...d, access } : d))
  }, [dirs, applyDirs])

  // 设置目录分组标签（prompt 内按组渲染）。
  const setDirectoryGroup = useCallback((path: string, group: string): void => {
    const idx = dirs.findIndex(d => d.path === path)
    if (idx <= 0) return
    const g = group.trim()
    applyDirs(dirs.map((d, i) => {
      if (i !== idx) return d
      // 展开空对象会保留旧 group，导致单目录无法从下拉菜单清除分组。
      if (g === '') {
        const { group: _group, ...withoutGroup } = d
        return withoutGroup
      }
      return { ...d, group: g }
    }))
  }, [dirs, applyDirs])

  // ---------------- 目录多选批量 ----------------
  const toggleDirSelected = useCallback((path: string): void => {
    setSelectedDirs(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])
  const clearDirSelection = useCallback((): void => setSelectedDirs(new Set()), [])

  const bulkSetAccess = useCallback((access: DirectoryAccess): void => {
    const n = selectedDirs.size
    if (n === 0) return
    applyDirs(dirs.map((d, i) => i > 0 && selectedDirs.has(d.path) ? { ...d, access } : d))
    showToast(tt('bulkApplied', { n }))
  }, [dirs, selectedDirs, applyDirs, showToast])

  const bulkSetGroup = useCallback((group: string): void => {
    const n = selectedDirs.size
    if (n === 0) return
    const g = group.trim()
    applyDirs(dirs.map((d, i) => i > 0 && selectedDirs.has(d.path) ? { ...d, ...(g === '' ? { group: undefined } : { group: g }) } : d))
    showToast(tt('bulkApplied', { n }))
  }, [dirs, selectedDirs, applyDirs, showToast])

  const bulkRemove = useCallback((): void => {
    const n = selectedDirs.size
    if (n === 0) return
    applyDirs(dirs.filter((d, i) => i === 0 || !selectedDirs.has(d.path)))
    setSelectedDirs(new Set())
    showToast(tt('bulkApplied', { n }))
  }, [dirs, selectedDirs, applyDirs, showToast])

  // 切换工作空间模式（文档锚点 / 传统单项目）。
  const setWorkspaceMode = useCallback((mode: WorkspaceMode): void => {
    const id = currentWsIdRef.current
    const api = apiRef.current
    if (api === null || id === '') return
    void api.setWorkspaceMode(id, mode)
      .then(() => {
        setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, mode, updatedAt: Date.now() } : w))
        showToast(tt('wsSaved'))
      })
      .catch(error => showToast(tt('saveFailed', { error: errText(error) }), 'error'))
  }, [showToast])

  // 设置文件加载模式（完整 / 摘要 / 目录树）。
  const setLoadMode = useCallback((loadMode: LoadMode): void => {
    const id = currentWsIdRef.current
    const api = apiRef.current
    if (api === null || id === '') return
    void api.setLoadMode(id, loadMode)
      .then(() => {
        setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, loadMode, updatedAt: Date.now() } : w))
        showToast(tt('wsSaved'))
      })
      .catch(error => showToast(tt('saveFailed', { error: errText(error) }), 'error'))
  }, [showToast])

  // 高级配置弹窗：草稿一次性落库（工作空间模式 + 文件加载模式）。
  const saveAdvanced = useCallback((mode: WorkspaceMode, loadMode: LoadMode): void => {
    const id = currentWsIdRef.current
    const api = apiRef.current
    if (api === null || id === '') return
    setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, mode, loadMode, updatedAt: Date.now() } : w))
    void api.patchWorkspace(id, { mode, loadMode })
      .then(() => showToast(tt('wsSaved')))
      .catch(error => showToast(tt('saveFailed', { error: errText(error) }), 'error'))
  }, [showToast])

  // token 预算（乐观即时生效 + 持久化）。
  const setTokenBudget = useCallback((value: number): void => {
    const next = Number.isFinite(value) && value > 0 ? Math.round(value) : DEFAULT_TOKEN_BUDGET
    setBudgetOverride(next)
    const id = currentWsIdRef.current
    const api = apiRef.current
    if (api === null || id === '') return
    setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, tokenBudget: next } : w))
    void api.patchWorkspace(id, { tokenBudget: next }).catch(error => showToast(tt('saveFailed', { error: errText(error) }), 'error'))
  }, [showToast])

  // 功能索引配置（乐观即时生效 + 持久化）。
  const patchCodeIndex = useCallback((patch: { codeIndexEnabled?: boolean; codeIndexBudget?: number; codeIndexSummary?: 'off' | 'llm' }): void => {
    const id = currentWsIdRef.current
    const api = apiRef.current
    if (api === null || id === '') return
    setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, ...patch, updatedAt: Date.now() } : w))
    void api.patchWorkspace(id, patch).catch(error => showToast(tt('saveFailed', { error: errText(error) }), 'error'))
  }, [showToast])
  const setCodeIndexEnabled = useCallback((enabled: boolean): void => { patchCodeIndex({ codeIndexEnabled: enabled }) }, [patchCodeIndex])
  const setCodeIndexBudget = useCallback((value: number): void => {
    patchCodeIndex({ codeIndexBudget: Number.isFinite(value) && value >= 0 ? Math.round(value) : DEFAULT_CODE_INDEX_BUDGET })
  }, [patchCodeIndex])
  const setCodeIndexSummary = useCallback((mode: 'off' | 'llm'): void => { patchCodeIndex({ codeIndexSummary: mode }) }, [patchCodeIndex])

  // 保存当前目录配置为快照。
  const saveSnapshot = useCallback((): void => {
    const name = snapshotName.trim()
    const id = currentWsIdRef.current
    const api = apiRef.current
    if (name === '') { showToast(tt('nameRequired'), 'error'); return }
    if (api === null || id === '') return
    void api.workspaceSnapshot(id, 'save', { name })
      .then(async () => {
        const state = await api.getState()
        setWorkspaces(state.workspaces)
        setSnapshotName('')
        showToast(tt('snapshotSaved'))
      })
      .catch(error => showToast(tt('saveFailed', { error: errText(error) }), 'error'))
  }, [snapshotName, showToast])

  const restoreSnapshot = useCallback((snapshotId: string): void => {
    const id = currentWsIdRef.current
    const api = apiRef.current
    if (api === null || id === '') return
    void api.workspaceSnapshot(id, 'restore', { snapshotId })
      .then(async () => {
        const state = await api.getState()
        setWorkspaces(state.workspaces)
        setCurrentWorkspaceId(state.currentWorkspaceId)
        const primary = state.workspaces.find(w => w.id === id)?.directories[0]?.path
        if (primary !== undefined && primary !== '') void registerDshWorkspace(primary)
        showToast(tt('snapshotRestored'))
      })
      .catch(error => showToast(tt('saveFailed', { error: errText(error) }), 'error'))
  }, [registerDshWorkspace, showToast])

  const deleteSnapshot = useCallback((snapshotId: string): void => {
    const id = currentWsIdRef.current
    const api = apiRef.current
    if (api === null || id === '') return
    void api.workspaceSnapshot(id, 'delete', { snapshotId })
      .then(async () => {
        const state = await api.getState()
        setWorkspaces(state.workspaces)
        showToast(tt('snapshotDeleted'))
      })
      .catch(error => showToast(tt('saveFailed', { error: errText(error) }), 'error'))
  }, [showToast])

  // 目录路径签名：目录集合变化时触发 git / 失效 / 预览的重新拉取。
  const dirsKey = useMemo(() => dirs.map(d => d.path).join('\n'), [dirs])

  // 设置目录常用命令（三个字段全空则删除该字段，避免注入空区块）。
  const setDirectoryCommands = useCallback((path: string, commands: DirectoryCommands | undefined): void => {
    const idx = dirs.findIndex(d => d.path === path)
    if (idx < 0) return
    applyDirs(dirs.map((d, i) => {
      if (i !== idx) return d
      if (commands === undefined) {
        const { commands: _commands, ...rest } = d
        return rest
      }
      return { ...d, commands }
    }))
  }, [dirs, applyDirs])

  // 设置目录备注（空串则删除该字段）。
  const setDirectoryNote = useCallback((path: string, note: string): void => {
    const idx = dirs.findIndex(d => d.path === path)
    if (idx < 0) return
    const n = note.trim()
    applyDirs(dirs.map((d, i) => i === idx ? { ...d, note: n === '' ? undefined : n } : d))
  }, [dirs, applyDirs])

  // ---------------- Git 状态回显（逐目录并行，非 git 仓库存 null） ----------------
  const refreshGitStatuses = useCallback((): void => {
    const api = apiRef.current
    if (api === null) return
    const paths = dirsRef.current.map(d => d.path)
    void Promise.all(paths.map(async p => {
      try {
        return await api.gitStatus(p)
      } catch {
        return null
      }
    })).then(statuses => {
      const next: Record<string, GitStatus | null> = {}
      paths.forEach((p, i) => { next[p] = statuses[i] })
      setGitStatuses(next)
    }).catch(() => {})
  }, [])

  // 目录变化（含切换工作空间）时重新拉取 git 状态。
  useEffect(() => { refreshGitStatuses() }, [dirsKey, refreshGitStatuses])

  // ---------------- 改动文件 -> 受影响端点（确定性反查，不用 AI） ----------------
  const refreshEndpointImpact = useCallback((): void => {
    const api = apiRef.current
    if (api === null) return
    setEndpointImpactLoading(true)
    void api.endpointImpact()
      .then(result => { setEndpointImpact(result.impact); setEndpointImpactFiles(result.changedFiles) })
      .catch(() => { setEndpointImpact([]); setEndpointImpactFiles(0) })
      .finally(() => setEndpointImpactLoading(false))
  }, [])

  // 目录变化时跟着 git 状态一起刷新（git 状态里就有变更文件）。
  useEffect(() => { refreshEndpointImpact() }, [dirsKey, refreshEndpointImpact])

  // ---------------- 目录失效检测（轻量 stat，不构建文件树） ----------------
  useEffect(() => {
    const api = apiRef.current
    const paths = dirsRef.current.map(d => d.path)
    if (api === null || paths.length === 0) { setMissingDirs(new Set()); return }
    let cancelled = false
    void Promise.all(paths.map(async p => {
      try {
        // stat 只探测存在性；目录不存在/不是目录都算失效。
        const info = await api.stat(p)
        return info.exists && info.isDirectory
      } catch {
        return false
      }
    })).then(flags => {
      if (cancelled) return
      const missing = new Set<string>()
      flags.forEach((ok, i) => { if (!ok) missing.add(paths[i]) })
      setMissingDirs(missing)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [dirsKey])

  // ---------------- 注入 prompt 预览（实时派生） ----------------
  // 预览用当前工作空间的加载模式取树，保证与真正注入的深度一致。
  const previewLoadMode: LoadMode = currentWorkspace?.loadMode ?? 'summary'
  useEffect(() => {
    const api = apiRef.current
    const current = dirsRef.current
    if (api === null || !previewOpen || current.length === 0) { setPreviewTrees([]); return }
    let cancelled = false
    setPreviewLoading(true)
    void Promise.all(current.map(async d => {
      try {
        const r = await api.fileIndex(d.path, previewLoadMode)
        return { name: d.name, path: d.path, files: r.files, dirs: r.dirs, ...(r.truncated ? { truncated: true } : {}), tree: r.tree } as PreviewFileTree
      } catch {
        return { name: d.name, path: d.path, files: 0, dirs: 0, tree: [] } as PreviewFileTree
      }
    })).then(list => {
      if (cancelled) return
      setPreviewTrees(list)
      setPreviewLoading(false)
    }).catch(() => { if (!cancelled) setPreviewLoading(false) })
    return () => { cancelled = true }
  }, [previewOpen, dirsKey, previewLoadMode])

  const previewText = useMemo(() => {
    const mode = currentWorkspace?.mode ?? 'anchor'
    const loadMode = currentWorkspace?.loadMode ?? 'summary'
    return renderMultiWorkspacePrompt({
      workspaces: dirs,
      mode,
      loadMode,
      entries: previewTrees,
      tokenBudget,
      codeEntries: codeIndexEnabled ? codeEntries : [],
      codeIndexBudget,
      standardGroups,
      standardsBudget,
    })
  }, [dirs, currentWorkspace, previewTrees, tokenBudget, codeEntries, codeIndexEnabled, codeIndexBudget, standardGroups, standardsBudget])

  const copyPreview = useCallback((): void => {
    if (previewText === '') return
    void copyToClipboard(previewText).then(ok => showToast(ok ? tt('previewCopied') : tt('copyFailed'), ok ? 'ok' : 'error'))
  }, [previewText, showToast])

  // 复制一段文本并提示结果（@指令速查卡等复用）。
  const copyText = useCallback((text: string): void => {
    void copyToClipboard(text).then(ok => showToast(ok ? tt('copied') : tt('copyFailed'), ok ? 'ok' : 'error'))
  }, [showToast])

  // 新建会话：在主目录打开（标题 = 工作空间名，startSession 内去重）。
  const createSession = useCallback((): void => {
    const primary = dirs[0]?.path
    if (primary === undefined || primary === '') {
      showToast(tt('noPrimary'), 'error')
      return
    }
    const name = workspaces.find(w => w.id === currentWorkspaceId)?.name
    void startSession(primary, name)
      .then(sessionId => showToast(tt('sessionCreatedNamed', { name: name ?? sessionId })))
      .catch(error => showToast(tt('createFailed', { error: errText(error) }), 'error'))
  }, [dirs, workspaces, currentWorkspaceId, startSession, showToast])

  const createTaskSession = useCallback((task: SessionTask): void => {
    const primary = dirs[0]?.path
    if (primary === undefined || primary === '') {
      showToast(tt('noPrimary'), 'error')
      return
    }
    const workspaceName = workspaces.find(workspace => workspace.id === currentWorkspaceId)?.name ?? ''
    const shortTask = task.description.length > 36 ? task.description.slice(0, 36) + '…' : task.description
    const title = workspaceName === '' ? shortTask : workspaceName + ' · ' + shortTask
    void startSession(primary, title)
      .then(async sessionId => {
        const api = apiRef.current
        if (api !== null) await api.setSessionTask(sessionId, task)
        showToast(tt('taskSessionCreated', { name: title }))
      })
      .catch(error => showToast(tt('createFailed', { error: errText(error) }), 'error'))
  }, [dirs, workspaces, currentWorkspaceId, startSession, showToast])

  return {
    workspaces,
    currentWorkspaceId,
    currentWorkspace,
    sortedWorkspaces,
    filteredWorkspaces,
    dirs,
    snapshots,
    toasts,
    manualPath,
    snapshotName,
    search,
    selectedDirs,
    missingDirs,
    gitStatuses,
    tokenBudget,
    previewOpen,
    previewTrees,
    codeEntries,
    codeIndexEnabled,
    codeIndexBudget,
    codeIndexSummary,
    standardsLibrary,
    workspaceStandards,
    standardGroups,
    standardsBudget,
    saveStandardsLibrary,
    setWorkspaceStandards,
    generateStandard,
    setCodeIndexEnabled,
    setCodeIndexBudget,
    setCodeIndexSummary,
    previewLoading,
    previewText,
    sessionCount,
    sessionsByWorkspace,
    sessionsOpenId,
    refreshingSessionId,
    pickWorkspace,
    reloadWorkspaceSessions,
    refreshSession,
    setManualPath,
    setSnapshotName,
    setSearch,
    setTokenBudget,
    setPreviewOpen,
    switchWorkspace,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    pickAndAddDirectory,
    addDirectory,
    removeDirectory,
    moveDirectory,
    setDirectoryAccess,
    setDirectoryGroup,
    setDirectoryNote,
    toggleDirSelected,
    clearDirSelection,
    bulkSetAccess,
    bulkSetGroup,
    bulkRemove,
    setWorkspaceMode,
    setLoadMode,
    contextStats,
    readiness,
    refreshContextStats,
    tokenUsage,
    refreshTokenUsage,
    endpointImpact,
    endpointImpactFiles,
    endpointImpactLoading,
    refreshEndpointImpact,
    setDirectoryCommands,
    saveSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    copyPreview,
    copyText,
    saveAdvanced,
    createSession,
    createTaskSession,
    dismissToast,
  }
}
