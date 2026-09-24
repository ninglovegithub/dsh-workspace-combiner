/**
 * 工作区组合器侧边栏面板（main 插槽 body）与侧边栏图标（sidebar.panellist）。
 * body 通过宿主注入的 useWorkspaces 读取全部工作区，渲染复选框多选 + 模板
 * 保存/加载/删除 + 清空选择，并给出「仅对新建会话生效」的醒目提示。
 * @module dsh-workspace-combiner/client/panel/WorkspaceCombinerPanel
 */

import { useEffect, type ChangeEvent, type ReactElement } from 'react'
import type { PanelIconProps, WorkspaceCombinerPanelProps } from '../types.ts'
import { useWorkspaceCombiner } from './controller.ts'
import { injectPanelStyles } from './styles.ts'
import { tt } from '../locales.ts'

/** 侧边栏图标：两个叠放的方块 + 连线，表达「多项目组合」。 */
export function WorkspaceCombinerIcon({ size, active }: PanelIconProps): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 1.6 : 1.4}
      opacity={active ? 1 : 0.75}
      aria-hidden="true"
    >
      <rect x={2} y={6} width={8} height={8} rx={1.5} />
      <rect x={6} y={2} width={8} height={8} rx={1.5} />
      <path d="M6 10l3-3" />
    </svg>
  )
}

/** 面板 body：工作区多选 + 模板管理。 */
export function WorkspaceCombinerPanel({ useWorkspaces, startSession, createWorkspace }: WorkspaceCombinerPanelProps): ReactElement {
  useEffect(() => { injectPanelStyles() }, [])

  const state = useWorkspaceCombiner(useWorkspaces, startSession, createWorkspace)
  const loading = state.phase !== 'ready'

  return (
    <div className="wcb-root">
      <div className="wcb-title">{tt('title')}</div>
      <div className="wcb-warning">{tt('warning')}</div>

      <div className="wcb-section">{tt('workspaces')}</div>
      {loading ? (
        <div className="wcb-hint">{tt('loading')}</div>
      ) : state.workspaces.length === 0 ? (
        <div className="wcb-hint">{tt('empty')}</div>
      ) : (
        <ul className="wcb-list">
          {state.workspaces.map(ws => (
            <li key={ws.workspaceId} className="wcb-row">
              <label className="wcb-row-label">
                <input
                  type="checkbox"
                  className="wcb-checkbox"
                  checked={state.selectedIds.has(ws.workspaceId)}
                  onChange={() => state.toggle(ws.workspaceId)}
                />
                <span className="wcb-name">{ws.title}</span>
                <span className="wcb-path" title={ws.path}>{ws.path}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="wcb-footer">
        <span className="wcb-count">{tt('selectedCount', { n: state.selectedIds.size })}</span>
        <button type="button" className="wcb-btn-primary" disabled={state.selectedIds.size === 0} onClick={state.createSession}>
          {tt('createSession')}
        </button>
        <button type="button" className="wcb-btn" disabled={state.selectedIds.size === 0} onClick={state.clearSelection}>
          {tt('clearSelection')}
        </button>
      </div>
      <div className="wcb-hint">{tt('primaryHint')}</div>

      <div className="wcb-section">{tt('templates')}</div>
      <div className="wcb-save-row">
        <input
          type="text"
          className="wcb-input"
          value={state.templateName}
          placeholder={tt('templateNamePlaceholder')}
          onChange={(event: ChangeEvent<HTMLInputElement>) => state.setTemplateName(event.currentTarget.value)}
        />
        <button type="button" className="wcb-btn-primary" disabled={state.selectedIds.size === 0} onClick={state.saveTemplate}>
          {tt('saveTemplate')}
        </button>
      </div>

      {state.templates.length === 0 ? (
        <div className="wcb-hint">{tt('templatesEmpty')}</div>
      ) : (
        <ul className="wcb-list">
          {state.templates.map(t => (
            <li key={t.id} className="wcb-template-row">
              <span className="wcb-template-name">{t.name}</span>
              <span className="wcb-template-count">{t.workspaces.length}</span>
              <button type="button" className="wcb-btn" onClick={() => state.loadTemplate(t)}>
                {tt('loadTemplate')}
              </button>
              <button type="button" className="wcb-btn-danger" onClick={() => state.deleteTemplate(t.id)}>
                {tt('deleteTemplate')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {state.status !== '' ? <div className="wcb-status">{state.status}</div> : null}
    </div>
  )
}
