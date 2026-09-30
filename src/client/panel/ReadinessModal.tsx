import { useEffect, type ReactElement } from 'react'
import type { ReadinessIssue, ReadinessReport } from '../../core/readiness.ts'
import { tt } from '../locales.ts'

interface ReadinessModalProps {
  report: ReadinessReport
  onRefresh(): void
  onOpenBudget(): void
  onClose(): void
}

function issueText(issue: ReadinessIssue): string {
  const count = issue.count ?? 0
  switch (issue.code) {
    case 'no-directories': return tt('readinessIssueNoDirectories')
    case 'primary-missing': return tt('readinessIssuePrimaryMissing')
    case 'missing-directories': return tt('readinessIssueMissingDirectories', { n: count })
    case 'no-code-projects': return tt('readinessIssueNoCodeProjects')
    case 'budget-over': return tt('readinessIssueBudgetOver')
    case 'budget-near': return tt('readinessIssueBudgetNear')
    case 'code-index-empty': return tt('readinessIssueCodeIndexEmpty')
    case 'commands-missing': return tt('readinessIssueCommandsMissing', { n: count })
    case 'dirty-repositories': return tt('readinessIssueDirtyRepositories', { n: count })
  }
}

function statusLabel(report: ReadinessReport): string {
  if (report.status === 'blocked') return tt('readinessBlocked')
  if (report.status === 'warning') return tt('readinessWarning')
  return tt('readinessReady')
}

function km(value: number): string {
  return value >= 1000 ? (value / 1000).toFixed(value >= 10000 ? 0 : 1) + 'K' : String(value)
}

export function ReadinessModal({ report, onRefresh, onOpenBudget, onClose }: ReadinessModalProps): ReactElement {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const blocked = report.issues.filter(issue => issue.severity === 'blocked')
  const warnings = report.issues.filter(issue => issue.severity === 'warning')
  const summary = report.summary

  return (
    <div className="wcb-overlay" onClick={onClose}>
      <div className="wcb-modal wcb-modal-wide" role="dialog" aria-modal="true" aria-label={tt('readinessTitle')} onClick={(event) => event.stopPropagation()}>
        <div className="wcb-modal-title">{tt('readinessTitle')}</div>
        <div className={'wcb-readiness-hero wcb-readiness-' + report.status}>
          <span className="wcb-readiness-dot" aria-hidden="true" />
          <div>
            <div className="wcb-readiness-state">{statusLabel(report)}</div>
            <div className="wcb-hint">{report.status === 'ready' ? tt('readinessReadyHint') : tt('readinessAttentionHint')}</div>
          </div>
        </div>

        <div className="wcb-modal-body wcb-readiness-body">
          {blocked.length > 0 ? (
            <section>
              <div className="wcb-label">{tt('readinessBlockedIssues')}</div>
              <div className="wcb-readiness-list">{blocked.map(issue => <div className="wcb-readiness-issue wcb-readiness-issue-blocked" key={issue.code}>{issueText(issue)}</div>)}</div>
            </section>
          ) : null}
          {warnings.length > 0 ? (
            <section>
              <div className="wcb-label">{tt('readinessSuggestions')}</div>
              <div className="wcb-readiness-list">{warnings.map(issue => <div className="wcb-readiness-issue" key={issue.code}>{issueText(issue)}</div>)}</div>
            </section>
          ) : null}

          <section>
            <div className="wcb-label">{tt('readinessCapabilities')}</div>
            <div className="wcb-readiness-grid">
              <div><strong>{summary.effectiveDirectories}</strong><span>{tt('readinessEffectiveDirs')}</span></div>
              <div><strong>{summary.frontendProjects}</strong><span>{tt('readinessFrontend')}</span></div>
              <div><strong>{summary.backendProjects}</strong><span>{tt('readinessBackend')}</span></div>
              <div><strong>{summary.writableDirectories}</strong><span>{tt('readinessWritable')}</span></div>
              <div><strong>{summary.gitRepositories}</strong><span>{tt('readinessGitRepos')}</span></div>
              <div><strong>{summary.pairedEndpoints}/{summary.endpoints}</strong><span>{tt('readinessPairedEndpoints')}</span></div>
              <div><strong>{km(summary.estimatedTokens)}</strong><span>{tt('readinessEstimatedTokens')}</span></div>
              <div><strong>{summary.sessions}</strong><span>{tt('readinessSessions')}</span></div>
            </div>
          </section>
        </div>

        <div className="wcb-modal-actions">
          <button type="button" className="wcb-btn-plain" onClick={onOpenBudget}>{tt('readinessOpenBudget')}</button>
          <button type="button" className="wcb-btn" onClick={onRefresh}>{tt('readinessRefresh')}</button>
          <button type="button" className="wcb-btn-primary" onClick={onClose}>{tt('cancel')}</button>
        </div>
      </div>
    </div>
  )
}
