/**
 * 面板状态管理：把「工作区列表 + 多选 + 模板」收敛成一个小而清晰的 hook。
 * 数据流：
 *   - 工作区列表来自 useWorkspaces（宿主 runtime 提供的标准插槽 props）。
 *   - 勾选/模板经 WorkspaceCombinerApi 持久化到宿主（勾选同时联动沙盒）。
 *
 * 规则（与需求一致）：勾选只对「之后新建的会话」生效；模板是勾选工作区引用
 * （含路径）的命名快照，加载时按路径自动注册缺失工作区并恢复勾选。
 * @module dsh-workspace-combiner/client/panel/controller
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WorkspaceCombinerApi } from '../api.ts'
import type { Template, WorkspaceRef } from '../../core/types.ts'
import type { SnapshotSelectorHook, WorkspaceSnapshot, WorkspaceView } from '../types.ts'
import { tt } from '../locales.ts'

/** 面板挂载时的一次性加载与后续操作都走这个对象。 */
export interface WorkspaceCombinerState {
  /** 工作区列表（空 = 加载中或无工作区）。 */
  workspaces: readonly WorkspaceView[]
  /** 加载阶段（'ready' 表示列表可用）。 */
  phase: string
  /** 已勾选的工作区 id 集合。 */
  selectedIds: ReadonlySet<string>
  /** 已保存模板。 */
  templates: readonly Template[]
  /** 一行状态提示（成功/失败）。 */
  status: string
  /** 模板名输入框受控值。 */
  templateName: string
  setTemplateName(name: string): void
  toggle(id: string): void
  saveTemplate(): void
  loadTemplate(template: Template): void
  deleteTemplate(id: string): void
  clearSelection(): void
  /** 用当前勾选新建/打开一个会话（首个勾选工作区作为会话 cwd）。 */
  createSession(): void
}

/** 工作区 id -> 可注入宿主的 WorkspaceRef。 */
function toRef(workspace: WorkspaceView): WorkspaceRef {
  return { id: workspace.workspaceId, name: workspace.title, path: workspace.path }
}

/**
 * 面板状态 hook。
 * @param useWorkspaces - 宿主注入的标准 hook。
 * @param startSession - ctx.sessions.create + open（DSH 新建会话流程）。
 * @param createWorkspace - ctx.workspaces.create（按路径自动注册工作区，幂等）。
 */
export function useWorkspaceCombiner(
  useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>,
  startSession: (workspaceId: string) => Promise<void>,
  createWorkspace: (path: string) => Promise<WorkspaceView>,
): WorkspaceCombinerState {
  const workspaces = useWorkspaces(state => state.items)
  const phase = useWorkspaces(state => state.phase)

  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [templates, setTemplates] = useState<readonly Template[]>([])
  const [status, setStatus] = useState('')
  const [templateName, setTemplateName] = useState('')

  const apiRef = useRef<WorkspaceCombinerApi | null>(null)
  if (apiRef.current === null) apiRef.current = new WorkspaceCombinerApi()

  // 由 id 集合 + 当前工作区列表推导选中引用（保持勾选顺序）。
  const selectionOf = useCallback((ids: ReadonlySet<string>): WorkspaceRef[] => {
    return workspaces.filter(ws => ids.has(ws.workspaceId)).map(toRef)
  }, [workspaces])

  // 把勾选同步到宿主（持久化 + 沙盒联动），失败仅提示、不打断本地状态。
  const pushSelection = useCallback((ids: ReadonlySet<string>): void => {
    const api = apiRef.current
    if (api === null) return
    void api.setSelection(selectionOf(ids)).catch(error => {
      setStatus(tt('saveFailed', { error: error instanceof Error ? error.message : String(error) }))
    })
  }, [selectionOf])

  // 挂载时水合勾选与模板。
  useEffect(() => {
    const api = apiRef.current
    if (api === null) return
    void api.getSelection()
      .then(selection => setSelectedIds(new Set(selection.map(ref => ref.id))))
      .catch(error => setStatus(tt('loadFailed', { error: error instanceof Error ? error.message : String(error) })))
    void api.getTemplates()
      .then(items => setTemplates(items))
      .catch(error => setStatus(tt('loadFailed', { error: error instanceof Error ? error.message : String(error) })))
  }, [])

  const toggle = useCallback((id: string): void => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      pushSelection(next)
      return next
    })
  }, [pushSelection])

  const clearSelection = useCallback((): void => {
    setSelectedIds(new Set())
    pushSelection(new Set())
    setStatus(tt('cleared'))
  }, [pushSelection])

  const saveTemplate = useCallback((): void => {
    const name = templateName.trim()
    if (name === '') {
      setStatus(tt('nameRequired'))
      return
    }
    if (selectedIds.size === 0) {
      setStatus(tt('noSelection'))
      return
    }
    const api = apiRef.current
    if (api === null) return
    void api.saveTemplate(name, selectionOf(selectedIds))
      .then(saved => {
        setTemplates(prev => [saved, ...prev.filter(t => t.id !== saved.id)])
        setStatus(tt('saved'))
        setTemplateName('')
      })
      .catch(error => setStatus(tt('saveFailed', { error: error instanceof Error ? error.message : String(error) })))
  }, [templateName, selectedIds, selectionOf])

  // 新建会话：先把勾选持久化到宿主（确保宿主在 session/created 快照时读到
  // 最新选择），再走 ctx.sessions.create + open 打开「首个勾选工作区」的会话。
  const launchWithRefs = useCallback((refs: readonly WorkspaceRef[]): void => {
    if (refs.length === 0) {
      setStatus(tt('noSelection'))
      return
    }
    const primaryId = refs[0].id
    const api = apiRef.current
    const launch = (): void => {
      void startSession(primaryId)
        .then(() => setStatus(tt('sessionCreated')))
        .catch(error => setStatus(tt('createFailed', { error: error instanceof Error ? error.message : String(error) })))
    }
    if (api === null) {
      launch()
      return
    }
    void api.setSelection(refs)
      .then(launch)
      .catch(error => setStatus(tt('saveFailed', { error: error instanceof Error ? error.message : String(error) })))
  }, [startSession])

  const createSession = useCallback((): void => {
    launchWithRefs(selectionOf(selectedIds))
  }, [launchWithRefs, selectionOf, selectedIds])

  const loadTemplate = useCallback((template: Template): void => {
    // 按模板里的引用恢复勾选：id 还在则用 id；id 变了但路径已注册则换新 id；
    // 路径未注册则自动注册工作区（幂等）。恢复后直接新建/打开会话。
    void (async () => {
      const byId = new Map(workspaces.map(ws => [ws.workspaceId, ws]))
      const byPath = new Map(workspaces.map(ws => [ws.path, ws]))
      const resolved: WorkspaceRef[] = []
      for (const ref of template.workspaces) {
        const current = byId.get(ref.id)
        if (current !== undefined) {
          resolved.push(toRef(current))
          continue
        }
        const reRegistered = byPath.get(ref.path)
        if (reRegistered !== undefined) {
          resolved.push(toRef(reRegistered))
          continue
        }
        const created = await createWorkspace(ref.path)
        resolved.push(toRef(created))
      }
      setSelectedIds(new Set(resolved.map(ref => ref.id)))
      setStatus(tt('loaded'))
      launchWithRefs(resolved)
    })().catch(error => {
      setStatus(tt('createFailed', { error: error instanceof Error ? error.message : String(error) }))
    })
  }, [workspaces, createWorkspace, launchWithRefs])

  const deleteTemplate = useCallback((id: string): void => {
    const api = apiRef.current
    if (api === null) return
    void api.deleteTemplate(id)
      .then(() => {
        setTemplates(prev => prev.filter(t => t.id !== id))
        setStatus(tt('deleted'))
      })
      .catch(error => setStatus(tt('saveFailed', { error: error instanceof Error ? error.message : String(error) })))
  }, [])

  return useMemo(() => ({
    workspaces,
    phase,
    selectedIds,
    templates,
    status,
    templateName,
    setTemplateName,
    toggle,
    saveTemplate,
    loadTemplate,
    deleteTemplate,
    clearSelection,
    createSession,
  }), [workspaces, phase, selectedIds, templates, status, templateName, toggle, saveTemplate, loadTemplate, deleteTemplate, clearSelection, createSession])
}
