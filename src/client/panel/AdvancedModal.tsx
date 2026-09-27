/**
 * 高级配置弹窗：工作空间模式、文件加载模式、快照管理与 @ 指令速查。
 * @module dsh-workspace-combiner/client/panel/AdvancedModal
 */

import { useState, useEffect, type ChangeEvent, type ReactElement } from 'react'
import type { LoadMode, Workspace, WorkspaceMode } from '../../core/types.ts'
import type { WorkspaceCombinerState } from './controller.ts'
import { tt } from '../locales.ts'

interface AdvancedModalProps {
  state: WorkspaceCombinerState
  currentWs: Workspace | undefined
  onClose(): void
}

export function AdvancedModal({ state, currentWs, onClose }: AdvancedModalProps): ReactElement {
  // 草稿：弹窗内改的是本地副本，点「保存」才一次性提交，「取消」即丢弃。
  const [draftMode, setDraftMode] = useState<WorkspaceMode>(currentWs?.mode ?? 'anchor')
  const [draftLoad, setDraftLoad] = useState<LoadMode>(currentWs?.loadMode ?? 'summary')
  const dirty = draftMode !== (currentWs?.mode ?? 'anchor') || draftLoad !== (currentWs?.loadMode ?? 'summary')

  // 打开弹窗时工作空间可能还没加载完，或期间切换了工作空间：把草稿对齐到当前值（按 id 变化触发，避免覆盖正在编辑的草稿）。
  useEffect(() => {
    setDraftMode(currentWs?.mode ?? 'anchor')
    setDraftLoad(currentWs?.loadMode ?? 'summary')
  }, [currentWs?.id])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="wcb-overlay" onClick={onClose}>
      <div className="wcb-modal wcb-modal-wide wcb-adv-modal" role="dialog" aria-modal="true" aria-label={tt('advancedTitle')} onClick={(event) => event.stopPropagation()}>
        <div className="wcb-modal-title">{tt('advancedTitle')}</div>
        <div className="wcb-modal-body wcb-adv-body">
          <div>
            <div className="wcb-label">{tt('wsModeLabel')}</div>
            <div className="wcb-tabs" role="tablist" aria-label={tt('wsModeLabel')}>
              {([['anchor', tt('wsModeAnchor')], ['single', tt('wsModeSingle')]] as Array<[WorkspaceMode, string]>).map(([value, label]) => (
                <button key={value} type="button" role="tab" aria-selected={draftMode === value} aria-label={label} className={'wcb-tab' + (draftMode === value ? ' wcb-tab-on' : '')} onClick={() => setDraftMode(value)}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="wcb-label">{tt('loadModeLabel')}</div>
            <div className="wcb-tabs" role="tablist" aria-label={tt('loadModeLabel')}>
              {([['summary', tt('loadModeSummary')], ['tree', tt('loadModeTree')], ['full', tt('loadModeFull')]] as Array<[LoadMode, string]>).map(([value, label]) => (
                <button key={value} type="button" role="tab" aria-selected={draftLoad === value} aria-label={label} className={'wcb-tab' + (draftLoad === value ? ' wcb-tab-on' : '')} onClick={() => setDraftLoad(value)}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="wcb-label">{tt('snapshotSave')}</div>
            <div className="wcb-add-row" style={{ border: 'none', padding: 0, marginBottom: 6 }}>
              <input className="wcb-input" value={state.snapshotName} placeholder={tt('snapshotNamePlaceholder')} aria-label={tt('snapshotNamePlaceholder')} onChange={(event: ChangeEvent<HTMLInputElement>) => state.setSnapshotName(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter') state.saveSnapshot() }} />
              <button type="button" className="wcb-btn" aria-label={tt('snapshotSave')} disabled={state.snapshotName.trim() === ''} onClick={state.saveSnapshot}>{tt('snapshotSave')}</button>
            </div>
            {state.snapshots.length > 0 ? (
              <div className="wcb-snap-list">
                {state.snapshots.map(s => (
                  <div key={s.id} className="wcb-snap-item">
                    <span className="wcb-snap-name" title={s.name}>{s.name}</span>
                    <span className="wcb-snap-meta">{tt('snapshotDirCount', { n: s.directories.length })}</span>
                    <button type="button" className="wcb-snap-restore" aria-label={tt('snapshotRestore')} onClick={() => state.restoreSnapshot(s.id)}>{tt('snapshotRestore')}</button>
                    <button type="button" className="wcb-iconbtn wcb-iconbtn-danger" title={tt('snapshotDelete')} aria-label={tt('snapshotDelete')} onClick={() => state.deleteSnapshot(s.id)}>✕</button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="wcb-sep-line" />
          <div>
            <div className="wcb-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--wcb-purple)', fontWeight: 600 }}>@</span>
              {tt('cmdRefTitle')}
              <span style={{ fontSize: '9.5px', color: 'var(--wcb-dim)' }}>{tt('cmdRefHint')}</span>
            </div>
            <div className="wcb-cmdref">
              {([
                ['@workspace', tt('cmdRefWorkspace')],
                ['@dir:路径', tt('cmdRefDir')],
                ['@files', tt('cmdRefFiles')],
                ['@snapshot:名', tt('cmdRefSnapshot')],
              ] as Array<[string, string]>).map(([code, desc]) => (
                <button key={code} type="button" className="wcb-cmdref-item" aria-label={code + ' ' + desc} onClick={() => state.copyText(code)}>
                  <code className="wcb-cmdref-code">{code}</code>
                  <span className="wcb-cmdref-desc">{desc}</span>
                  <span className="wcb-cmdref-copy">{tt('previewCopy')}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="wcb-modal-actions">
          <button type="button" className="wcb-btn-plain" aria-label={tt('cancel')} onClick={onClose}>{tt('cancel')}</button>
          <button type="button" className="wcb-btn" aria-label={tt('advSave')} disabled={!dirty} onClick={() => { state.saveAdvanced(draftMode, draftLoad); onClose() }}>{tt('advSave')}</button>
        </div>
      </div>
    </div>
  )
}
