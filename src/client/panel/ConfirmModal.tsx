/**
 * 通用二次确认弹窗（危险/不可撤销操作用）。
 * @module dsh-workspace-combiner/client/panel/ConfirmModal
 */

import type { ReactElement } from 'react'
import { tt } from '../locales.ts'
import { Dialog } from './Dialog.tsx'

interface ConfirmModalProps {
  /** 弹窗标题。 */
  title: string
  /** 说明正文。 */
  message: string
  /** 确认按钮文案。 */
  confirmLabel: string
  /** 危险操作使用红色按钮。 */
  danger?: boolean
  onConfirm(): void
  onClose(): void
}

/**
 * 二次确认弹窗。
 * @param props - 标题、正文、确认文案与回调。
 */
export function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onClose }: ConfirmModalProps): ReactElement {
  return (
    <Dialog title={title} onClose={onClose}>
      <div className="wcb-modal-body">{message}</div>
      <div className="wcb-modal-actions">
        <button type="button" className="wcb-btn-plain" aria-label={tt('cancel')} onClick={onClose}>{tt('cancel')}</button>
        <button type="button" className={danger === true ? 'wcb-btn-danger' : 'wcb-btn-primary'} aria-label={confirmLabel} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Dialog>
  )
}
