import { useEffect, type ReactElement } from 'react'
import type { DiagnosticAction, DiagnosticItem, DiagnosticReport } from '../../core/types.ts'
import { redactDiagnosticText } from '../../core/diagnostics.ts'
import { tt, type WorkspaceCombinerKey } from '../locales.ts'

interface DiagnosticsModalProps {
  report: DiagnosticReport | null
  loading: boolean
  runningAction: DiagnosticAction | null
  onRefresh(): void
  onAction(action: DiagnosticAction): void
  onCopy(text: string): void
  onClose(): void
}

const titleKeys: Record<DiagnosticItem['id'], WorkspaceCombinerKey> = {
  directories: 'diagnosticsDirectories',
  'sandbox-service': 'diagnosticsSandboxService',
  'writable-roots': 'diagnosticsWritableRoots',
  'host-services': 'diagnosticsHostServices',
  sessions: 'diagnosticsSessions',
  'session-config': 'diagnosticsSessionConfig',
  'file-index-cache': 'diagnosticsFileCache',
  'code-index-cache': 'diagnosticsCodeCache',
  'token-alignment': 'diagnosticsTokenAlignment',
  commands: 'diagnosticsCommands',
  'large-directories': 'diagnosticsLargeDirectories',
  'store-config': 'diagnosticsStoreConfig',
  versions: 'diagnosticsVersions',
}

function n(item: DiagnosticItem, key: string): number { return Number(item.data?.[key] ?? 0) }
function s(item: DiagnosticItem, key: string): string { return String(item.data?.[key] ?? '') }

function itemSummary(item: DiagnosticItem): string {
  switch (item.id) {
    case 'directories': return tt(item.status === 'ok' ? 'diagnosticsDirectoriesOk' : 'diagnosticsDirectoriesBad', { total: n(item, 'total'), invalid: n(item, 'invalid') })
    case 'sandbox-service': return tt(item.status === 'ok' ? 'diagnosticsSandboxOk' : item.status === 'warning' ? 'diagnosticsSandboxFallback' : 'diagnosticsSandboxBad')
    case 'writable-roots': return tt(item.status === 'ok' ? 'diagnosticsWritableOk' : 'diagnosticsWritableBad', { synced: n(item, 'synced'), expected: n(item, 'expected') })
    case 'host-services': return tt(item.status === 'ok' ? 'diagnosticsServicesOk' : 'diagnosticsServicesBad', { available: n(item, 'available'), total: n(item, 'total') })
    case 'sessions': return tt(n(item, 'count') > 0 ? 'diagnosticsSessionsOk' : 'diagnosticsSessionsNone', { count: n(item, 'count') })
    case 'session-config': return tt(item.status === 'unknown' ? 'diagnosticsSessionConfigUnknown' : item.status === 'ok' ? 'diagnosticsSessionConfigOk' : 'diagnosticsSessionConfigStale', { stale: n(item, 'stale'), total: n(item, 'total') })
    case 'file-index-cache': return tt(item.status === 'error' ? 'diagnosticsFileCacheBad' : 'diagnosticsFileCacheOk', { indexed: n(item, 'indexed'), total: n(item, 'total') })
    case 'code-index-cache': return tt(item.status === 'unknown' ? 'diagnosticsCodeCacheOff' : item.status === 'error' ? 'diagnosticsCodeCacheBad' : 'diagnosticsCodeCacheOk', { entries: n(item, 'entries') })
    case 'token-alignment': return tt(item.status === 'unknown' ? 'diagnosticsTokenUnknown' : item.status === 'warning' ? 'diagnosticsTokenDifferent' : 'diagnosticsTokenOk', { estimated: n(item, 'estimated'), actual: n(item, 'actual'), difference: n(item, 'difference') })
    case 'commands': return tt(item.status === 'ok' ? 'diagnosticsCommandsOk' : 'diagnosticsCommandsMissing', { missing: n(item, 'missing'), total: n(item, 'total') })
    case 'large-directories': return tt(item.status === 'ok' ? 'diagnosticsLargeOk' : 'diagnosticsLargeBad', { count: n(item, 'count'), threshold: n(item, 'threshold') })
    case 'store-config': return tt(item.status === 'ok' ? 'diagnosticsStoreOk' : 'diagnosticsStoreBad', { version: n(item, 'version'), expected: n(item, 'expected') })
    case 'versions': return tt('diagnosticsVersionsValue', { plugin: s(item, 'plugin'), schema: n(item, 'schema') })
  }
}

function statusLabel(item: DiagnosticItem): string {
  return tt(item.status === 'ok' ? 'diagnosticsStatusOk' : item.status === 'warning' ? 'diagnosticsStatusWarning' : item.status === 'error' ? 'diagnosticsStatusError' : 'diagnosticsStatusUnknown')
}

function actionLabel(action: DiagnosticAction): string {
  return tt(action === 'refresh-caches' ? 'diagnosticsRefreshCaches' : action === 'sync-sandbox' ? 'diagnosticsSyncSandbox' : 'diagnosticsRefreshSessions')
}

function reportText(report: DiagnosticReport): string {
  const lines = [tt('diagnosticsTitle'), new Date(report.generatedAt).toLocaleString(), '']
  for (const item of report.items) {
    lines.push('[' + statusLabel(item) + '] ' + tt(titleKeys[item.id]))
    lines.push(itemSummary(item))
    for (const path of item.paths ?? []) lines.push('- ' + path)
    lines.push('')
  }
  return redactDiagnosticText(lines.join('\n'))
}

export function DiagnosticsModal({ report, loading, runningAction, onRefresh, onAction, onCopy, onClose }: DiagnosticsModalProps): ReactElement {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="wcb-overlay" onClick={onClose}>
      <div className="wcb-modal wcb-modal-wide wcb-diagnostics-modal" role="dialog" aria-modal="true" aria-label={tt('diagnosticsTitle')} onClick={(event) => event.stopPropagation()}>
        <div className="wcb-modal-title">{tt('diagnosticsTitle')}</div>
        {report === null ? <div className="wcb-modal-body">{loading ? tt('diagnosticsRunning') : tt('diagnosticsEmpty')}</div> : (
          <div className="wcb-modal-body wcb-diagnostics-body">
            <div className="wcb-diagnostics-summary">
              <span className="wcb-diagnostic-ok">{tt('diagnosticsSummaryOk', { n: report.summary.ok })}</span>
              <span className="wcb-diagnostic-warning">{tt('diagnosticsSummaryWarning', { n: report.summary.warning })}</span>
              <span className="wcb-diagnostic-error">{tt('diagnosticsSummaryError', { n: report.summary.error })}</span>
              <span>{tt('diagnosticsSummaryUnknown', { n: report.summary.unknown })}</span>
            </div>
            <div className="wcb-diagnostics-list">
              {report.items.map(item => (
                <section className={'wcb-diagnostic-item wcb-diagnostic-' + item.status} key={item.id}>
                  <div className="wcb-diagnostic-head">
                    <span className="wcb-diagnostic-dot" />
                    <strong>{tt(titleKeys[item.id])}</strong>
                    <span className="wcb-badge">{statusLabel(item)}</span>
                  </div>
                  <div>{itemSummary(item)}</div>
                  {(item.paths ?? []).length > 0 ? <div className="wcb-diagnostic-paths">{item.paths?.map(path => <code key={path}>{path}</code>)}</div> : null}
                  {item.action !== undefined && item.status !== 'ok' ? <button type="button" className="wcb-linkbtn" disabled={runningAction !== null} onClick={() => onAction(item.action as DiagnosticAction)}>{runningAction === item.action ? tt('diagnosticsFixing') : actionLabel(item.action)}</button> : null}
                </section>
              ))}
            </div>
          </div>
        )}
        <div className="wcb-modal-actions">
          <button type="button" className="wcb-btn-plain" disabled={report === null} onClick={() => { if (report !== null) onCopy(reportText(report)) }}>{tt('diagnosticsCopy')}</button>
          <button type="button" className="wcb-btn" disabled={loading} onClick={onRefresh}>{loading ? tt('diagnosticsRunning') : tt('diagnosticsRefresh')}</button>
          <button type="button" className="wcb-btn-primary" onClick={onClose}>{tt('cancel')}</button>
        </div>
      </div>
    </div>
  )
}
