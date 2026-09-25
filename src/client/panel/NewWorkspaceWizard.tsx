/**
 * 新建工作空间三步向导：① 名称 + 主目录保存位置（base 路径）→ ② 选择文件夹自动识别
 * 项目（多选）→ ③ 完成。保存时在 base 路径下创建与名称同名的文件夹作为主目录，
 * 第二步选中的项目作为代码项目加入工作空间。
 * @module dsh-workspace-combiner/client/panel/NewWorkspaceWizard
 */

import { useRef, useState, type ChangeEvent, type ReactElement } from 'react'
import type { DetectedProject, WorkspaceMode, WorkspaceRef } from '../../core/types.ts'
import { WorkspaceCombinerApi } from '../api.ts'
import { tt } from '../locales.ts'
import { TypeBadge } from './typeBadge.tsx'

interface NewWorkspaceWizardProps {
  pickDirectory: () => Promise<string | null>
  onClose: () => void
  onCreate: (name: string, basePath: string, directories: readonly WorkspaceRef[], mode: WorkspaceMode) => void
}

export function NewWorkspaceWizard({ pickDirectory, onClose, onCreate }: NewWorkspaceWizardProps): ReactElement {
  const apiRef = useRef<WorkspaceCombinerApi | null>(null)
  if (apiRef.current === null) apiRef.current = new WorkspaceCombinerApi()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState('')
  const [basePath, setBasePath] = useState('')
  const [scanPath, setScanPath] = useState('')
  const [scanning, setScanning] = useState(false)
  const [projects, setProjects] = useState<readonly DetectedProject[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<WorkspaceMode>('anchor')

  const pickBase = (): void => {
    void pickDirectory()
      .then(path => { if (path !== null && path.trim() !== '') setBasePath(path.trim()) })
      .catch(() => {})
  }

  const runScan = (path: string): void => {
    const api = apiRef.current
    if (api === null) return
    setScanning(true)
    setProjects([])
    setChecked(new Set())
    void api.scan(path)
      .then(list => {
        setProjects(list)
        setChecked(new Set(list.map(p => p.root)))
      })
      .catch(() => {})
      .finally(() => setScanning(false))
  }

  const pickScan = (): void => {
    void pickDirectory()
      .then(path => {
        if (path !== null && path.trim() !== '') {
          const trimmed = path.trim()
          setScanPath(trimmed)
          runScan(trimmed)
        }
      })
      .catch(() => {})
  }

  const toggle = (root: string): void => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(root)) next.delete(root)
      else next.add(root)
      return next
    })
  }
  const allChecked = projects.length > 0 && checked.size === projects.length
  const toggleAll = (): void => setChecked(allChecked ? new Set() : new Set(projects.map(p => p.root)))

  const finalName = name.trim() === '' ? '未命名工作空间' : name.trim()
  const selected = projects.filter(p => checked.has(p.root))
  const buildSecondaryRefs = (): WorkspaceRef[] => selected.map(p => ({ id: p.root, name: p.name, path: p.root, projectType: p.type, evidence: p.evidence }))

  return (
    <div className="wcb-overlay" onClick={onClose}>
      <div className="wcb-modal wcb-modal-wide" onClick={(event) => event.stopPropagation()}>
        <div className="wcb-modal-title">{tt('wizardTitle')}</div>

        <div className="wcb-wizard-steps">
          {[tt('wizardStep1'), tt('wizardStep2'), tt('wizardStep3')].map((label, i) => {
            const n = i + 1
            return (
              <div key={label} className={'wcb-wizard-step' + (step === n ? ' wcb-wizard-step-active' : '') + (step > n ? ' wcb-wizard-step-done' : '')}>
                <span className="wcb-wizard-step-num">{n}</span>
                <span>{label}</span>
              </div>
            )
          })}
        </div>

        {step === 1 ? (
          <div className="wcb-wizard-body">
            <label className="wcb-field">
              <span>{tt('wsCreateName')}</span>
              <input className="wcb-input" value={name} autoFocus placeholder={tt('wizardNamePlaceholder')} onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.currentTarget.value)} />
            </label>
            <label className="wcb-field">
              <span>{tt('wizardBaseDir')}</span>
              <div className="wcb-add-row">
                <button type="button" className="wcb-btn" onClick={pickBase}>{tt('wizardPickFolder')}</button>
                <div className="wcb-ws-path">{basePath === '' ? tt('wizardBaseEmpty') : basePath}</div>
              </div>
            </label>
            <label className="wcb-field">
              <span>{tt('wsModeLabel')}</span>
              <select className="wcb-input" value={mode} onChange={(event: ChangeEvent<HTMLSelectElement>) => setMode(event.currentTarget.value as WorkspaceMode)}>
                <option value="anchor">{tt('wsModeAnchor')}</option>
                <option value="single">{tt('wsModeSingle')}</option>
              </select>
            </label>
            <div className="wcb-hint">{mode === 'single' ? tt('wsModeSingleHint') : tt('wsModeAnchorHint')}</div>
            <div className="wcb-hint">{tt('wizardBaseHint')}</div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="wcb-wizard-body">
            <div className="wcb-add-row">
              <button type="button" className="wcb-btn" disabled={scanning} onClick={pickScan}>{tt('wizardPickFolder')}</button>
              <div className="wcb-ws-path">{scanPath === '' ? tt('wizardScanFolderEmpty') : scanPath}</div>
            </div>
            {scanning ? <div className="wcb-hint">{tt('wizardScanning')}</div> : null}
            {!scanning && projects.length > 0 ? (
              <>
                <div className="wcb-modal-toolbar">
                  <button type="button" className="wcb-btn" onClick={toggleAll}>{allChecked ? tt('wizardClearSelect') : tt('wizardSelectAll')}</button>
                </div>
                <ul className="wcb-scan-list">
                  {projects.map(p => (
                    <li key={p.root} className="wcb-scan-item">
                      <input type="checkbox" checked={checked.has(p.root)} onChange={() => toggle(p.root)} />
                      <div className="wcb-scan-info">
                        <div className="wcb-scan-name">{p.name}</div>
                        <div className="wcb-scan-path" title={p.root}>{p.root}</div>
                      </div>
                      <TypeBadge type={p.type} evidence={p.evidence} />
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {!scanning && projects.length === 0 && scanPath !== '' ? <div className="wcb-hint">{tt('wizardNoProject')}</div> : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="wcb-wizard-body">
            <div className="wcb-hint">{tt('wizardSummary', { name: finalName, base: basePath, n: selected.length })}</div>
          </div>
        ) : null}

        <div className="wcb-modal-actions">
          {step > 1 ? <button type="button" className="wcb-btn" onClick={() => setStep((step - 1) as 1 | 2 | 3)}>{tt('wizardBack')}</button> : null}
          <button type="button" className="wcb-btn" onClick={onClose}>{tt('cancel')}</button>
          {step < 3 ? (
            <button type="button" className="wcb-btn-primary" disabled={step === 1 && basePath === ''} onClick={() => setStep((step + 1) as 1 | 2 | 3)}>{tt('wizardNext')}</button>
          ) : (
            <button type="button" className="wcb-btn-primary" disabled={basePath === ''} onClick={() => onCreate(finalName, basePath, buildSecondaryRefs(), mode)}>{tt('wizardCreate')}</button>
          )}
        </div>
      </div>
    </div>
  )
}
