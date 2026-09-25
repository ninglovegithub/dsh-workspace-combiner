/**
 * 面板状态管理：自定义工作空间（增删改切）+ 每个工作空间独立绑定的项目目录
 * （添加/删除/排序）。
 * @module dsh-workspace-combiner/client/panel/controller
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WorkspaceCombinerApi } from '../api.ts'
import type { ContextStats, DirectoryAccess, LoadMode, Workspace, WorkspaceMode, WorkspaceRef, WorkspaceSnapshot } from '../../core/types.ts'
import { tt } from '../locales.ts'
import { checkWorkspaceNameDuplicate, sanitizeWorkspaceName } from './naming.ts'

/** 一条 toast。 */
export interface Toast {
  text: string
  kind: 'ok' | 'error'
}

/** 面板状态（收敛成一个对象，避免散落 useState 到 UI）。 */
export interface WorkspaceCombinerState {
  workspaces: readonly Workspace[]
  currentWorkspaceId: string
  /** 当前工作空间的目录列表（派生自 workspaces）。 */
  dirs: readonly WorkspaceRef[]
  /** 当前工作空间的目录配置快照（派生自 workspaces）。 */
  snapshots: readonly WorkspaceSnapshot[]
  toast: Toast | null
  manualPath: string
  snapshotName: string
  setManualPath(path: string): void
  setSnapshotName(name: string): void
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
  setWorkspaceMode(mode: WorkspaceMode): void
  setLoadMode(loadMode: LoadMode): void
  contextStats: ContextStats | null
  refreshContextStats(): void
  saveSnapshot(): void
  restoreSnapshot(snapshotId: string): void
  deleteSnapshot(snapshotId: string): void
  createSession(): void
  dismissToast(): void
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
): WorkspaceCombinerState {
  const apiRef = useRef<WorkspaceCombinerApi | null>(null)
  if (apiRef.current === null) apiRef.current = new WorkspaceCombinerApi()

  const [workspaces, setWorkspaces] = useState<readonly Workspace[]>([])
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)
  const [manualPath, setManualPath] = useState('')
  const [snapshotName, setSnapshotName] = useState('')
  const [contextStats, setContextStats] = useState<ContextStats | null>(null)
  const currentWsIdRef = useRef('')
  currentWsIdRef.current = currentWorkspaceId

  const showToast = useCallback((text: string, kind: 'ok' | 'error' = 'ok'): void => {
    setToast({ text, kind })
  }, [])
  const dismissToast = useCallback((): void => setToast(null), [])

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
    applyDirs(dirs.map((d, i) => i === idx ? { ...d, ...(g === '' ? {} : { group: g }) } : d))
  }, [dirs, applyDirs])

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
    dirs,
    snapshots,
    toast,
    manualPath,
    snapshotName,
    setManualPath,
    setSnapshotName,
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
    setWorkspaceMode,
    setLoadMode,
    contextStats,
    refreshContextStats,
    saveSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    createSession,
    dismissToast,
  }
}
