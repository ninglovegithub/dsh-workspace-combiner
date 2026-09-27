/**
 * 注入 prompt 预览弹窗：只读展示当前配置将注入的完整文本，可一键复制。
 * @module dsh-workspace-combiner/client/panel/PreviewModal
 */

import { useEffect, type ReactElement } from 'react'
import { tt } from '../locales.ts'

interface PreviewModalProps {
  text: string
  loading: boolean
  onCopy(): void
  onClose(): void
}

export function PreviewModal({ text, loading, onCopy, onClose }: PreviewModalProps): ReactElement {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="wcb-overlay" onClick={onClose}>
      <div className="wcb-modal wcb-modal-wide wcb-preview-modal" role="dialog" aria-modal="true" aria-label={tt('previewTitle')} onClick={(event) => event.stopPropagation()}>
        <div className="wcb-modal-title">{tt('previewTitle')}</div>
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
          <span className="wcb-hint" style={{ marginRight: 'auto' }}>{text === '' ? '' : String(text.length) + ' chars'}</span>
          <button type="button" className="wcb-btn-plain" aria-label={tt('cancel')} onClick={onClose}>{tt('cancel')}</button>
          <button type="button" className="wcb-btn-primary" aria-label={tt('previewCopy')} disabled={text === ''} onClick={onCopy}>{tt('previewCopy')}</button>
        </div>
      </div>
    </div>
  )
}
