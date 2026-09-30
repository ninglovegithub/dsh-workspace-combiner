/**
 * 开始任务三步向导：任务描述与类型 -> 推荐目录/上下文 -> 确认并创建会话。
 * 推荐只写入本次会话，不修改工作空间永久配置。
 * @module dsh-workspace-combiner/client/panel/StartTaskWizard
 */

import { useEffect, useState, type ChangeEvent, type ReactElement } from 'react'
import type { CodeIndexEntry, LoadMode, WorkspaceRef } from '../../core/types.ts'
import { recommendTask, type SessionTask, type TaskRecommendation, type TaskType } from '../../core/task.ts'
import { tt } from '../locales.ts'

interface StartTaskWizardProps {
  directories: readonly WorkspaceRef[]
  codeEntries: readonly CodeIndexEntry[]
  onCreate(task: SessionTask): void
  onClose(): void
}

const TASK_TYPES: TaskType[] = ['feature', 'api-change', 'bugfix', 'review', 'refactor', 'custom']

function typeLabel(type: TaskType): string {
  switch (type) {
    case 'feature': return tt('taskTypeFeature')
    case 'api-change': return tt('taskTypeApi')
    case 'bugfix': return tt('taskTypeBugfix')
    case 'review': return tt('taskTypeReview')
    case 'refactor': return tt('taskTypeRefactor')
    case 'custom': return tt('taskTypeCustom')
  }
}

function recommendationLabel(recommendation: TaskRecommendation): string {
  if (recommendation.mode === 'trusted-match') {
    return tt('taskTrustedScope', { n: recommendation.trustedEndpoints.length, dirs: recommendation.task.directoryPaths.length })
  }
  if (recommendation.mode === 'weak-match') return tt('taskWeakScope', { n: recommendation.weakEndpoints.length })
  return tt('taskDefaultScope')
}

export function StartTaskWizard({ directories, codeEntries, onCreate, onClose }: StartTaskWizardProps): ReactElement {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [description, setDescription] = useState('')
  const [type, setType] = useState<TaskType>('feature')
  const [recommendation, setRecommendation] = useState<TaskRecommendation>(() => recommendTask('feature', 'new feature', directories, codeEntries))
  const [task, setTask] = useState<SessionTask>(() => recommendation.task)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const prepareRecommendation = (): void => {
    const recommendation = recommendTask(type, description, directories, codeEntries)
    setTask(recommendation.task)
    setRecommendation(recommendation)
    setStep(2)
  }

  const toggleDirectory = (path: string): void => {
    const primary = directories[0]?.path
    if (path === primary) return
    setTask(current => ({
      ...current,
      directoryPaths: current.directoryPaths.includes(path)
        ? current.directoryPaths.filter(item => item !== path)
        : [...current.directoryPaths, path],
    }))
  }

  const enabledDirectories = directories.filter(directory => (directory.access ?? 'readwrite') !== 'disabled')

  return (
    <div className="wcb-overlay" onClick={onClose}>
      <div className="wcb-modal wcb-modal-wide" role="dialog" aria-modal="true" aria-label={tt('taskWizardTitle')} onClick={(event) => event.stopPropagation()}>
        <div className="wcb-modal-title">{tt('taskWizardTitle')}</div>
        <div className="wcb-steps">
          {[tt('taskStep1'), tt('taskStep2'), tt('taskStep3')].map((label, index) => {
            const number = index + 1
            return <div key={label} className={'wcb-step' + (step === number ? ' wcb-step-active' : '') + (step > number ? ' wcb-step-done' : '')}><span>{number}</span>{label}</div>
          })}
        </div>

        {step === 1 ? (
          <div className="wcb-wizard-body">
            <label className="wcb-field">
              <span>{tt('taskDescription')}</span>
              <textarea className="wcb-input wcb-task-textarea" autoFocus value={description} placeholder={tt('taskDescriptionPlaceholder')} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDescription(event.currentTarget.value)} />
            </label>
            <div className="wcb-field">
              <span>{tt('taskType')}</span>
              <div className="wcb-task-types">
                {TASK_TYPES.map(item => <button key={item} type="button" className={'wcb-tab' + (type === item ? ' wcb-tab-on' : '')} onClick={() => setType(item)}>{typeLabel(item)}</button>)}
              </div>
            </div>
            <div className="wcb-hint">{tt('taskRecommendationHint')}</div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="wcb-wizard-body">
            <div className="wcb-task-recommendation">
              <strong>{recommendationLabel(recommendation)}</strong>
              <span>{recommendation.mode === 'weak-match' ? tt('taskWeakScopeHint') : tt('taskRecommendationScope')}</span>
            </div>
            <div className="wcb-task-dir-list">
              {enabledDirectories.map((directory, index) => (
                <label className="wcb-task-dir" key={directory.path}>
                  <input type="checkbox" checked={task.directoryPaths.includes(directory.path)} disabled={index === 0} onChange={() => toggleDirectory(directory.path)} />
                  <span>
                    <strong>{directory.name}</strong>
                    <small title={directory.path}>{directory.path}</small>
                    {index === 0 ? <em>{tt('taskPrimaryRequired')}</em> : null}
                    {(recommendation.directoryFeatures[directory.path]?.length ?? 0) > 0 ? (
                      <em>{tt('taskDirectoryMatched', { features: recommendation.directoryFeatures[directory.path]!.slice(0, 3).map(feature => '@' + feature).join(' · ') })}</em>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
            <div className="wcb-field">
              <span>{tt('loadModeLabel')}</span>
              <div className="wcb-tabs">
                {([['summary', tt('loadModeSummary')], ['tree', tt('loadModeTree')], ['full', tt('loadModeFull')]] as Array<[LoadMode, string]>).map(([value, label]) => (
                  <button key={value} type="button" className={'wcb-tab' + (task.loadMode === value ? ' wcb-tab-on' : '')} onClick={() => setTask(current => ({ ...current, loadMode: value }))}>{label}</button>
                ))}
              </div>
            </div>
            <label className="wcb-check-row"><input type="checkbox" checked={task.includeCodeIndex} onChange={(event) => setTask(current => ({ ...current, includeCodeIndex: event.currentTarget.checked }))} />{tt('taskIncludeCodeIndex')}</label>
            <div className="wcb-hint">{tt('taskSessionOnlyHint')}</div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="wcb-wizard-body">
            <div className="wcb-task-summary">
              <div><span>{tt('taskType')}</span><strong>{typeLabel(task.type)}</strong></div>
              <div><span>{tt('taskDescription')}</span><strong>{task.description}</strong></div>
              <div><span>{tt('taskScope')}</span><strong>{tt('taskDirectoryCount', { n: task.directoryPaths.length })}</strong></div>
              <div><span>{tt('taskScopeReason')}</span><strong>{recommendationLabel(recommendation)}</strong></div>
              <div><span>{tt('loadModeLabel')}</span><strong>{task.loadMode}</strong></div>
              <div><span>{tt('taskVerification')}</span><strong>{task.verification.length > 0 ? task.verification.join(' · ') : tt('taskVerificationNone')}</strong></div>
            </div>
          </div>
        ) : null}

        <div className="wcb-modal-actions">
          {step > 1 ? <button type="button" className="wcb-btn-plain" onClick={() => setStep((step - 1) as 1 | 2 | 3)}>{tt('wizardBack')}</button> : null}
          <button type="button" className="wcb-btn-plain" onClick={onClose}>{tt('cancel')}</button>
          {step === 1 ? <button type="button" className="wcb-btn-primary" disabled={description.trim() === ''} onClick={prepareRecommendation}>{tt('wizardNext')}</button> : null}
          {step === 2 ? <button type="button" className="wcb-btn-primary" disabled={task.directoryPaths.length === 0} onClick={() => setStep(3)}>{tt('wizardNext')}</button> : null}
          {step === 3 ? <button type="button" className="wcb-btn-primary" onClick={() => onCreate(task)}>{tt('taskCreate')}</button> : null}
        </div>
      </div>
    </div>
  )
}
