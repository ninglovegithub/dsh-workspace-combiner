/**
 * 面板状态管理：自定义工作空间（增删改切 / 置顶 / 颜色 / token 预算）+ 每个工作空间
 * 独立绑定的项目目录（添加/删除/排序/多选批量）+ 注入 prompt 预览 + 目录失效检测。
 * @module dsh-workspace-combiner/client/panel/controller
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WorkspaceCombinerApi } from '../api.ts'
import type { ContextStats, DirectoryAccess, GitStatus, LoadMode, Workspace, WorkspaceMode, WorkspaceRef, WorkspaceSnapshot } from '../../core/types.ts'
import type { FileTreeNode } from '../../host/fileIndex.ts'
import { renderMultiWorkspacePrompt } from '../../prompt.ts'
import { tt } from '../locales.ts'
import { checkWorkspaceNameDuplicate, sanitizeWorkspaceName } from './naming.ts'

/** token 预算默认上限。 */
export const DEFAULT_TOKEN_BUDGET = 60000


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

/** 预览用的单目录文件树。 */
export interface PreviewFileTree {
  name: string
  path: string
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
  /** 当前工作空间的会话占用数（props 注入；缺省 0）。 */
  sessionCount: number
  setManualPath(path: string): void
  setSnapshotName(name: string): void
  setSearch(value: string): void
  setTokenBudget(value: number): void
  setPreviewOpen(open: boolean): void
  switchWorkspace(id: string): void
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
  refreshContextStats(): void
  saveSnapshot(): void
  restoreSnapshot(snapshotId: string): void
  deleteSnapshot(snapshotId: string): void
  copyPreview(): void
  copyText(text: string): void
  createSession(): void
  dismissToast(id: number): void
}

/** 目录 basename（跨平台分隔符）。 */
function basename(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '')
  const seg = trimmed.split(/[\\/]/).pop()
  return seg === undefined || seg === '' ? trimmed : seg
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
  const [previewLoading, setPreviewLoading] = useState(false)
  const [budgetOverride, setBudgetOverride] = useState<number | null>(null)
  const currentWsIdRef = useRef('')
  currentWsIdRef.current = currentWorkspaceId
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

  // 工作空间/目录变化后自动刷新上下文统计。
  useEffect(() => { refreshContextStats() }, [refreshContextStats, workspaces, currentWorkspaceId])

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
    void api.switchWorkspace(id)
      .then(() => setCurrentWorkspaceId(id))
      .catch(error => showToast(tt('saveFailed', { error: errText(error) }), 'error'))
  }, [showToast])

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
    if (dirs.some(d => d.path === trimmed)) {
      showToast(tt('alreadyAdded'), 'error')
      return
    }
    applyDirs([...dirs, { id: trimmed, name: basename(trimmed), path: trimmed }])
  }, [dirs, applyDirs, showToast])

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
    const paths = dirs.map(d => d.path)
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
  }, [dirs])

  // 目录变化（含切换工作空间）时重新拉取 git 状态。
  useEffect(() => { refreshGitStatuses() }, [dirsKey, refreshGitStatuses])

  // ---------------- 目录失效检测（复用 file-index 路由） ----------------
  useEffect(() => {
    const api = apiRef.current
    if (api === null || dirs.length === 0) { setMissingDirs(new Set()); return }
    let cancelled = false
    void Promise.all(dirs.map(async d => {
      try {
        // 路径存在时 fileIndex 正常返回（即使空目录 files+dirs=0 也不算缺失）；
        // 路径不存在时 fileIndex 路由抛错，catch 判定为缺失。
        await api.fileIndex(d.path)
        return true
      } catch {
        return false
      }
    })).then(flags => {
      if (cancelled) return
      const missing = new Set<string>()
      flags.forEach((ok, i) => { if (!ok) missing.add(dirs[i].path) })
      setMissingDirs(missing)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [dirsKey, dirs])

  // ---------------- 注入 prompt 预览（实时派生） ----------------
  useEffect(() => {
    const api = apiRef.current
    if (api === null || !previewOpen || dirs.length === 0) { setPreviewTrees([]); return }
    let cancelled = false
    setPreviewLoading(true)
    void Promise.all(dirs.map(async d => {
      try {
        const r = await api.fileIndex(d.path)
        return { name: d.name, path: d.path, tree: r.tree } as PreviewFileTree
      } catch {
        return { name: d.name, path: d.path, tree: [] } as PreviewFileTree
      }
    })).then(list => {
      if (cancelled) return
      setPreviewTrees(list)
      setPreviewLoading(false)
    }).catch(() => { if (!cancelled) setPreviewLoading(false) })
    return () => { cancelled = true }
  }, [previewOpen, dirsKey, dirs])

  const previewText = useMemo(() => {
    const mode = currentWorkspace?.mode ?? 'anchor'
    const loadMode = currentWorkspace?.loadMode ?? 'summary'
    return renderMultiWorkspacePrompt(dirs, mode, loadMode, previewTrees)
  }, [dirs, currentWorkspace, previewTrees])

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
    previewLoading,
    previewText,
    sessionCount,
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
    refreshContextStats,
    saveSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    copyPreview,
    copyText,
    createSession,
    dismissToast,
  }
}
