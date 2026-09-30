/**
 * 开始任务三步向导：任务描述与类型 -> 推荐目录/上下文 -> 确认并创建会话。
 * 推荐只写入本次会话，不修改工作空间永久配置。
 * @module dsh-workspace-combiner/client/panel/StartTaskWizard
 */

import { useEffect, useState, type ChangeEvent, type ReactElement } from 'react'
import type { CodeIndexEntry, GitStatus, LoadMode, WorkspaceRef } from '../../core/types.ts'
import { recommendTask, taskExecutionPlan, taskPreflight, taskVerificationCoverage, type SessionTask, type TaskPreflightIssue, type TaskRecommendation, type TaskType, type TaskVerification } from '../../core/task.ts'
import { tt } from '../locales.ts'

interface StartTaskWizardProps {
  directories: readonly WorkspaceRef[]
  codeEntries: readonly CodeIndexEntry[]
  missingDirectories: ReadonlySet<string>
  gitStatuses: Readonly<Record<string, GitStatus | null>>
  onCreate(task: SessionTask): void
  onClose(): void
}

const TASK_TYPES: TaskType[] = ['feature', 'api-change', 'bugfix', 'review', 'refactor', 'custom']
const VERIFICATIONS: TaskVerification[] = ['run', 'test', 'build', 'review-impact']

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

function verificationLabel(verification: TaskVerification): string {
  if (verification === 'run') return tt('taskVerificationRun')
  if (verification === 'test') return tt('taskVerificationTest')
  if (verification === 'build') return tt('taskVerificationBuild')
  return tt('taskVerificationImpact')
}

function preflightIssueLabel(issue: TaskPreflightIssue): string {
  if (issue.code === 'missing-directory') return tt('taskPreflightMissingDirectory', { n: issue.count ?? 0 })
  if (issue.code === 'dirty-repository') return tt('taskPreflightDirtyRepository', { n: issue.count ?? 0 })
  if (issue.code === 'readonly-directory') return tt('taskPreflightReadonlyDirectory', { n: issue.count ?? 0 })
  if (issue.code === 'missing-command') return tt('taskPreflightMissingCommand', { verification: verificationLabel(issue.verification ?? 'test') })
  if (issue.code === 'no-code-project') return tt('taskPreflightNoCodeProject')
  return tt('taskPreflightNoVerification')
}

export function StartTaskWizard({ directories, codeEntries, missingDirectories, gitStatuses, onCreate, onClose }: StartTaskWizardProps): ReactElement {
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

  const toggleVerification = (verification: TaskVerification): void => {
    setTask(current => ({
      ...current,
      verification: current.verification.includes(verification)
        ? current.verification.filter(item => item !== verification)
        : [...current.verification, verification],
    }))
  }

  const enabledDirectories = directories.filter(directory => (directory.access ?? 'readwrite') !== 'disabled')
  const preflight = taskPreflight(task, directories, missingDirectories, gitStatuses)
  const executionPlan = taskExecutionPlan(task, directories, gitStatuses)

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
            <div className="wcb-field">
              <span>{tt('taskVerification')}</span>
              <div className="wcb-task-verifications">
                {VERIFICATIONS.map(verification => {
                  const coverage = taskVerificationCoverage(verification, task.directoryPaths, directories)
                  return (
                    <label className="wcb-task-verification" key={verification}>
                      <input type="checkbox" checked={task.verification.includes(verification)} onChange={() => toggleVerification(verification)} />
                      <span>
                        <strong>{verificationLabel(verification)}</strong>
                        {coverage !== undefined ? (
                          <small>{coverage.total === 0 ? tt('taskVerificationNoProjects') : tt('taskVerificationCoverage', { configured: coverage.configured, total: coverage.total })}</small>
                        ) : null}
                      </span>
                    </label>
                  )
                })}
              </div>
              {VERIFICATIONS.some(verification => {
                if (!task.verification.includes(verification)) return false
                const coverage = taskVerificationCoverage(verification, task.directoryPaths, directories)
                return coverage !== undefined && coverage.total > 0 && coverage.configured === 0
              }) ? <div className="wcb-task-verification-warn">{tt('taskVerificationMissingCommand')}</div> : null}
              <div className="wcb-hint">{tt('taskVerificationHint')}</div>
            </div>
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
              <div><span>{tt('taskVerification')}</span><strong>{task.verification.length > 0 ? task.verification.map(verificationLabel).join(' · ') : tt('taskVerificationNone')}</strong></div>
            </div>
            <div className="wcb-task-plan">
              <strong>{tt('taskPlanTitle')}</strong>
              <div className="wcb-task-plan-list">
                {executionPlan.map(project => {
                  const pending = project.gitStatus === null ? 0 : project.gitStatus.dirty + project.gitStatus.untracked
                  return (
                    <div className="wcb-task-plan-project" key={project.path}>
                      <div className="wcb-task-plan-head">
                        <span><b>{project.name}</b><em>{project.primary ? tt('taskPlanPrimary') : project.access === 'readonly' ? tt('taskPlanReadonly') : tt('taskPlanWritable')}</em></span>
                        {project.gitStatus !== null ? <small>{project.gitStatus.branch} · {pending > 0 ? tt('taskPlanDirty', { n: pending }) : tt('taskPlanClean')}</small> : null}
                      </div>
                      <small className="wcb-task-plan-path" title={project.path}>{project.path}</small>
                      {project.checks.length > 0 ? (
                        <div className="wcb-task-plan-checks">
                          {project.checks.map(check => (
                            <span key={check.verification}>
                              <b>{verificationLabel(check.verification)}</b>
                              <code>{check.command ?? (check.verification === 'review-impact' ? tt('taskPlanManualReview') : tt('taskPlanAutoCommand'))}</code>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className={'wcb-task-preflight wcb-task-preflight-' + preflight.status}>
              <strong>
                {preflight.status === 'ready' ? tt('taskPreflightReady') : preflight.status === 'blocked' ? tt('taskPreflightBlocked') : tt('taskPreflightWarning')}
              </strong>
              {preflight.issues.length === 0 ? <span>{tt('taskPreflightReadyHint')}</span> : (
                <ul>{preflight.issues.map((issue, index) => <li key={issue.code + '|' + (issue.verification ?? '') + '|' + index}>{preflightIssueLabel(issue)}</li>)}</ul>
              )}
            </div>
          </div>
        ) : null}

        <div className="wcb-modal-actions">
          {step > 1 ? <button type="button" className="wcb-btn-plain" onClick={() => setStep((step - 1) as 1 | 2 | 3)}>{tt('wizardBack')}</button> : null}
          <button type="button" className="wcb-btn-plain" onClick={onClose}>{tt('cancel')}</button>
          {step === 1 ? <button type="button" className="wcb-btn-primary" disabled={description.trim() === ''} onClick={prepareRecommendation}>{tt('wizardNext')}</button> : null}
          {step === 2 ? <button type="button" className="wcb-btn-primary" disabled={task.directoryPaths.length === 0} onClick={() => setStep(3)}>{tt('wizardNext')}</button> : null}
          {step === 3 ? <button type="button" className="wcb-btn-primary" disabled={preflight.status === 'blocked'} onClick={() => onCreate(task)}>{tt('taskCreate')}</button> : null}
        </div>
      </div>
    </div>
  )
}
