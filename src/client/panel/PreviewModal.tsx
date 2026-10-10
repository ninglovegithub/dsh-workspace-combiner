/**
 * 注入 prompt 预览弹窗：只读展示当前配置将注入的完整文本，可一键复制。
 * @module dsh-workspace-combiner/client/panel/PreviewModal
 */

import type { ReactElement } from 'react'
import { tt } from '../locales.ts'
import { Dialog } from './Dialog.tsx'

interface PreviewModalProps {
  text: string
  loading: boolean
  onCopy(): void
  onClose(): void
}

export function PreviewModal({ text, loading, onCopy, onClose }: PreviewModalProps): ReactElement {
  return (
    <Dialog title={tt('previewTitle')} onClose={onClose} wide className="wcb-preview-modal">
        <div className="wcb-modal-body wcb-preview-body">
          {text === '' ? (
            <div className="wcb-hint">{tt('previewEmpty')}</div>
          ) : (
            <>
              {loading ? <div className="wcb-hint">{tt('previewLoading')}</div> : null}
              <pre className="wcb-preview" tabIndex={0} aria-label={tt('previewTitle')}>{text}</pre>
            </>
          )}
        </div>
        <div className="wcb-modal-actions">
          <span className="wcb-hint" style={{ marginRight: 'auto' }}>{text === '' ? '' : tt('previewChars', { n: text.length })}</span>
          <button type="button" className="wcb-btn-plain" aria-label={tt('cancel')} onClick={onClose}>{tt('cancel')}</button>
          <button type="button" className="wcb-btn-primary" aria-label={tt('previewCopy')} disabled={text === ''} onClick={onCopy}>{tt('previewCopy')}</button>
        </div>
    </Dialog>
  )
}
