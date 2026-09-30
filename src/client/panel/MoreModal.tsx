import { useEffect, type ReactElement } from 'react'
import { tt } from '../locales.ts'

interface MoreModalProps {
  onBudget(): void
  onDiagnostics(): void
  onClose(): void
}

export function MoreModal({ onBudget, onDiagnostics, onClose }: MoreModalProps): ReactElement {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="wcb-overlay" onClick={onClose}>
      <div className="wcb-modal" role="dialog" aria-modal="true" aria-label={tt('moreTitle')} onClick={(event) => event.stopPropagation()}>
        <div className="wcb-modal-title">{tt('moreTitle')}</div>
        <div className="wcb-more-list">
          <button type="button" className="wcb-more-item" onClick={onBudget}>
            <strong>{tt('budgetTitle')}</strong>
            <span>{tt('moreBudgetDescription')}</span>
          </button>
          <button type="button" className="wcb-more-item" onClick={onDiagnostics}>
            <strong>{tt('diagnosticsTitle')}</strong>
            <span>{tt('moreDiagnosticsDescription')}</span>
          </button>
        </div>
        <div className="wcb-modal-actions">
          <button type="button" className="wcb-btn-primary" onClick={onClose}>{tt('cancel')}</button>
        </div>
      </div>
    </div>
  )
}
