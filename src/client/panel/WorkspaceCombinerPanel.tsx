/**
 * 工作区组合器侧边栏面板（main 插槽 body）与侧边栏图标（sidebar.panellist）。
 * 卡片式布局：自定义工作空间列表（新建/切换/重命名/删除）+ 每个工作空间独立绑定
 * 的项目目录列表（添加/删除/拖拽排序/主从）。
 * @module dsh-workspace-combiner/client/panel/WorkspaceCombinerPanel
 */

import { useEffect, useState, type ChangeEvent, type DragEvent, type ReactElement } from 'react'
import type { PanelIconProps, WorkspaceCombinerPanelProps } from '../types.ts'
import type { Workspace } from '../../core/types.ts'
import { useWorkspaceCombiner } from './controller.ts'
import { injectPanelStyles } from './styles.ts'
import { tt } from '../locales.ts'
import { NewWorkspaceWizard } from './NewWorkspaceWizard.tsx'

/** 侧边栏图标：两个叠放的方块 + 连线，表达「多项目组合」。 */
export function WorkspaceCombinerIcon({ size, active }: PanelIconProps): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={active ? 1.6 : 1.4} opacity={active ? 1 : 0.75} aria-hidden="true">
      <rect x={2} y={6} width={8} height={8} rx={1.5} />
      <rect x={6} y={2} width={8} height={8} rx={1.5} />
      <path d="M6 10l3-3" />
    </svg>
  )
}

/** 相对时间：最近使用时间。 */
function formatLastUsed(ts?: number): string {
  if (ts === undefined) return tt('wsNeverUsed')
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return tt('wsLastUsedJustNow')
  if (min < 60) return tt('wsLastUsedMin', { n: min })
  const hr = Math.floor(min / 60)
  if (hr < 24) return tt('wsLastUsedHour', { n: hr })
  return tt('wsLastUsedDay', { n: Math.floor(hr / 24) })
}

/** 重命名工作空间弹窗。 */
function RenameWorkspaceModal({ ws, onConfirm, onClose }: {
  ws: Workspace
  onConfirm: (name: string) => void
  onClose: () => void
}): ReactElement {
  const [name, setName] = useState(ws.name)
  const submit = (): void => { const trimmed = name.trim(); if (trimmed !== '') onConfirm(trimmed) }
  return (
    <div className="wcb-overlay" onClick={onClose}>
      <div className="wcb-modal" onClick={(event) => event.stopPropagation()}>
        <div className="wcb-modal-title">{tt('wsRenameTitle')}</div>
        <label className="wcb-field">
          <span>{tt('wsCreateName')}</span>
          <input className="wcb-input" value={name} autoFocus onChange={(event) => setName(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter') submit() }} />
        </label>
        <div className="wcb-modal-actions">
          <button type="button" className="wcb-btn" onClick={onClose}>{tt('cancel')}</button>
          <button type="button" className="wcb-btn-primary" disabled={name.trim() === ''} onClick={submit}>{tt('confirm')}</button>
        </div>
      </div>
    </div>
  )
}

/** 删除工作空间确认弹窗。 */
function DeleteWorkspaceModal({ ws, onConfirm, onClose }: {
  ws: Workspace
  onConfirm: () => void
  onClose: () => void
}): ReactElement {
  return (
    <div className="wcb-overlay" onClick={onClose}>
      <div className="wcb-modal" onClick={(event) => event.stopPropagation()}>
        <div className="wcb-modal-title">{tt('wsDeleteTitle')}</div>
        <div className="wcb-modal-body">{tt('wsDeleteConfirm', { name: ws.name })}</div>
        <div className="wcb-modal-actions">
          <button type="button" className="wcb-btn" onClick={onClose}>{tt('cancel')}</button>
          <button type="button" className="wcb-btn-danger" onClick={onConfirm}>{tt('wsDelete')}</button>
        </div>
      </div>
    </div>
  )
}

/** 面板 body。 */
export function WorkspaceCombinerPanel({ startSession, pickDirectory, registerDshWorkspace }: WorkspaceCombinerPanelProps): ReactElement {
  useEffect(() => { injectPanelStyles() }, [])
  const state = useWorkspaceCombiner(startSession, pickDirectory, registerDshWorkspace)

  const [wizardOpen, setWizardOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<Workspace | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const currentWsName = state.workspaces.find(w => w.id === state.currentWorkspaceId)?.name ?? ''
  const submitManualPath = (): void => {
    const path = state.manualPath.trim()
    if (path !== '') { state.addDirectory(path); state.setManualPath('') }
  }

  return (
    <div className="wcb-root">
      <div className="wcb-header">
        <div>
          <div className="wcb-title">{tt('title')}</div>
          <div className="wcb-subtitle">{tt('subtitle')}{currentWsName !== '' ? ' · ' + currentWsName : ''}</div>
        </div>
      </div>

      <div className="wcb-warning">{tt('warning')}</div>

      {/* 工作空间列表 */}
      <section className="wcb-card">
        <div className="wcb-section-row">
          <h3 className="wcb-section">{tt('workspaces')}</h3>
          <button type="button" className="wcb-btn-primary" onClick={() => setWizardOpen(true)}>{tt('newWorkspace')}</button>
        </div>
        <ul className="wcb-workspace-list">
          {state.workspaces.map(ws => (
            <li key={ws.id} className={'wcb-ws-item' + (ws.id === state.currentWorkspaceId ? ' wcb-ws-active' : '')} onClick={() => state.switchWorkspace(ws.id)}>
              <div className="wcb-ws-title-row">
                <span className="wcb-ws-name" title={ws.name}>{ws.name}</span>
                {ws.id === state.currentWorkspaceId ? <span className="wcb-ws-current">{tt('wsCurrent')}</span> : null}
                <span className="wcb-ws-actions">
                  <button type="button" className="wcb-ws-act" title={tt('wsRename')} onClick={(event) => { event.stopPropagation(); setRenameTarget(ws) }}>{tt('wsRename')}</button>
                  <button type="button" className="wcb-ws-act wcb-ws-act-danger" title={tt('wsDelete')} onClick={(event) => { event.stopPropagation(); setDeleteTarget(ws) }}>{tt('wsDelete')}</button>
                </span>
              </div>
              <div className="wcb-ws-meta">{tt('wsDirCount', { n: ws.directories.length })} · {formatLastUsed(ws.lastSessionAt)}</div>
            </li>
          ))}
        </ul>
      </section>

      {/* 项目目录列表 */}
      <section className="wcb-card">
        <h3 className="wcb-section">{tt('directories')}</h3>
        <div className="wcb-add-row">
          <button type="button" className="wcb-btn" onClick={state.pickAndAddDirectory}>{tt('pickDirectory')}</button>
          <input className="wcb-input" value={state.manualPath} placeholder={tt('manualPathPlaceholder')} onChange={(event: ChangeEvent<HTMLInputElement>) => state.setManualPath(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitManualPath() }} />
          <button type="button" className="wcb-btn" disabled={state.manualPath.trim() === ''} onClick={submitManualPath}>{tt('addDirectory')}</button>
        </div>
        {state.dirs.length === 0 ? (
          <div className="wcb-hint">{tt('dirsEmpty')}</div>
        ) : (
          <ul className="wcb-dir-list">
            {state.dirs.map((d, i) => (
              <li
                key={d.path}
                className={'wcb-dir-row' + (dragIndex === i ? ' wcb-dragging' : '') + (overIndex === i && dragIndex !== null && dragIndex !== i ? ' wcb-over' : '')}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
                onDragOver={(event: DragEvent<HTMLLIElement>) => { event.preventDefault(); setOverIndex(i) }}
                onDrop={() => { if (dragIndex !== null) { state.moveDirectory(dragIndex, i); setDragIndex(null); setOverIndex(null) } }}
              >
                <span className="wcb-drag-handle">⋮⋮</span>
                <span className="wcb-star">{i === 0 ? '★' : ''}</span>
                <div className="wcb-dir-info">
                  <div className="wcb-dir-title">
                    <span className="wcb-dir-name" title={d.name}>{d.name}</span>
                    <span className={i === 0 ? 'wcb-tag wcb-tag-primary' : 'wcb-tag'}>{i === 0 ? tt('primaryProject') : tt('codeProject')}</span>
                  </div>
                  <div className="wcb-dir-path" title={d.path}>{d.path}</div>
                </div>
                <button type="button" className="wcb-remove" title={tt('removeDirectory')} onClick={() => state.removeDirectory(d.path)}>✕</button>
              </li>
            ))}
          </ul>
        )}
        <div className="wcb-hint">{tt('primaryHint')}</div>
      </section>

      {/* 底部：新建会话 */}
      <div className="wcb-footer">
        <span className="wcb-count">{tt('dirCount', { n: state.dirs.length })}</span>
        <div className="wcb-footer-actions">
          <button type="button" className="wcb-btn-primary" onClick={state.createSession}>{tt('createSession')}</button>
        </div>
      </div>

      {state.toast !== null ? (
        <div className={'wcb-toast ' + (state.toast.kind === 'error' ? 'wcb-toast-error' : 'wcb-toast-ok')} onClick={state.dismissToast}>{state.toast.text}</div>
      ) : null}

      {wizardOpen ? (
        <NewWorkspaceWizard
          pickDirectory={pickDirectory}
          onClose={() => setWizardOpen(false)}
          onCreate={(name, basePath, directories) => { state.createWorkspace(name, basePath, directories); setWizardOpen(false) }}
        />
      ) : null}
      {renameTarget !== null ? (
        <RenameWorkspaceModal ws={renameTarget} onClose={() => setRenameTarget(null)} onConfirm={(name) => { state.renameWorkspace(renameTarget.id, name); setRenameTarget(null) }} />
      ) : null}
      {deleteTarget !== null ? (
        <DeleteWorkspaceModal ws={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => { state.deleteWorkspace(deleteTarget.id); setDeleteTarget(null) }} />
      ) : null}
    </div>
  )
}
