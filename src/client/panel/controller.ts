/**
 * 面板状态管理：自定义工作空间（增删改切）+ 每个工作空间独立绑定的项目目录
 * （添加/删除/排序）。
 * @module dsh-workspace-combiner/client/panel/controller
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WorkspaceCombinerApi } from '../api.ts'
import type { Workspace, WorkspaceRef } from '../../core/types.ts'
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
  toast: Toast | null
  manualPath: string
  setManualPath(path: string): void
  switchWorkspace(id: string): void
  createWorkspace(name: string, basePath: string, directories: readonly WorkspaceRef[]): void
  renameWorkspace(id: string, name: string): void
  deleteWorkspace(id: string): void
  pickAndAddDirectory(): void
  addDirectory(path: string): void
  removeDirectory(path: string): void
  moveDirectory(fromIndex: number, toIndex: number): void
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
  const currentWsIdRef = useRef('')
  currentWsIdRef.current = currentWorkspaceId

  const showToast = useCallback((text: string, kind: 'ok' | 'error' = 'ok'): void => {
    setToast({ text, kind })
  }, [])
  const dismissToast = useCallback((): void => setToast(null), [])

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

  // 覆盖当前工作空间目录并持久化 + 联动 DSH 工作区 + 沙盒。
  const applyDirs = useCallback((next: readonly WorkspaceRef[]): void => {
    const id = currentWsIdRef.current
    setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, directories: [...next], updatedAt: Date.now() } : w))
    const api = apiRef.current
    if (api !== null) {
      void api.setWorkspaceDirectories(id, next).catch(error => showToast(tt('saveFailed', { error: errText(error) }), 'error'))
    }
    if (next[0]?.path !== undefined && next[0].path !== '') void registerDshWorkspace(next[0].path)
  }, [showToast, registerDshWorkspace])

  const switchWorkspace = useCallback((id: string): void => {
    const api = apiRef.current
    if (api === null) return
    void api.switchWorkspace(id)
      .then(() => setCurrentWorkspaceId(id))
      .catch(error => showToast(tt('saveFailed', { error: errText(error) }), 'error'))
  }, [showToast])

  // 新建工作空间：宿主在 basePath 下创建同名文件夹作为主目录，其余目录作为代码项目。
  const createWorkspace = useCallback((name: string, basePath: string, directories: readonly WorkspaceRef[]): void => {
    const base = sanitizeWorkspaceName(name)
    if (base === '') {
      showToast(tt('nameRequired'), 'error')
      return
    }
    const finalName = checkWorkspaceNameDuplicate(base, undefined, workspaces)
    const api = apiRef.current
    if (api === null) return
    void api.createWorkspace(finalName, basePath, directories)
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
    toast,
    manualPath,
    setManualPath,
    switchWorkspace,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    pickAndAddDirectory,
    addDirectory,
    removeDirectory,
    moveDirectory,
    createSession,
    dismissToast,
  }
}
