import type { ReactElement } from 'react'
import { tt } from '../locales.ts'
import { Dialog } from './Dialog.tsx'

interface MoreModalProps {
  onBudget(): void
  onDiagnostics(): void
  onClose(): void
}

export function MoreModal({ onBudget, onDiagnostics, onClose }: MoreModalProps): ReactElement {
  return (
    <Dialog title={tt('moreTitle')} onClose={onClose}>
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
    </Dialog>
  )
}
