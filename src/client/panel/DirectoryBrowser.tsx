/**
 * 内置目录浏览器：宿主没有系统目录对话框（DSH 挂的是 browse 能力）时兜底。
 *
 * 只用 `remote.directoryPicker.list()` 返回的 path / crumbs / entries 导航，
 * 因此对 native 与 browse 两种宿主都安全（native 宿主上根本不会打开它）。
 *
 * @module dsh-workspace-combiner/client/panel/DirectoryBrowser
 */

import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { tt } from '../locales.ts'
import { Dialog } from './Dialog.tsx'
import { parentListingPath, type DirectoryListing } from './directoryListing.ts'

interface DirectoryBrowserProps {
  listDirectory: (path?: string) => Promise<DirectoryListing>
  /** 选中目录（null = 取消/关闭且不选）。 */
  onPick(path: string | null): void
}

/**
 * 目录浏览器弹窗。
 * @param props - 列目录函数与选择回调。
 * @returns 弹窗。
 */
export function DirectoryBrowser({ listDirectory, onPick }: DirectoryBrowserProps): ReactElement {
  const [listing, setListing] = useState<DirectoryListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback((path?: string): void => {
    setLoading(true)
    setError('')
    void listDirectory(path)
      .then(next => {
        setListing(next)
        setLoading(false)
      })
      .catch((cause: unknown) => {
        setListing(null)
        setLoading(false)
        setError(cause instanceof Error ? cause.message : String(cause))
      })
  }, [listDirectory])

  useEffect(() => { load() }, [load])

  const current = listing?.path ?? ''
  const up = listing === null ? '' : parentListingPath(listing)

  return (
    <Dialog title={tt('browseTitle')} onClose={() => onPick(null)} wide>
      <div className="wcb-browse-crumbs">
        {(listing?.crumbs ?? []).map(crumb => (
          <button key={crumb.path} type="button" className="wcb-linkbtn" onClick={() => load(crumb.path)}>{crumb.name}</button>
        ))}
      </div>

      {loading ? <div className="wcb-hint">{tt('browseLoading')}</div> : null}
      {error === '' ? null : <div className="wcb-hint wcb-hint-error" role="alert">{tt('browseError', { error })}</div>}

      <div className="wcb-browse-list">
        {up === '' ? null : (
          <button type="button" className="wcb-browse-row" onClick={() => load(up)}>↑ {tt('browseUp')}</button>
        )}
        {(listing?.entries ?? []).map(entry => (
          <button key={entry.path} type="button" className="wcb-browse-row" onClick={() => load(entry.path)} title={entry.path}>
            {entry.name}/
          </button>
        ))}
        {listing !== null && listing.entries.length === 0 && !loading ? (
          <div className="wcb-hint">{tt('browseEmpty')}</div>
        ) : null}
      </div>

      {listing?.truncated === true ? <div className="wcb-hint">{tt('browseTruncated')}</div> : null}
      {current === '' ? null : <div className="wcb-hint">{current}</div>}

      <div className="wcb-modal-actions">
        <button type="button" className="wcb-btn-plain" onClick={() => onPick(null)}>{tt('cancel')}</button>
        <button type="button" className="wcb-btn-primary" disabled={current === ''} onClick={() => onPick(current)}>
          {tt('browsePickCurrent')}
        </button>
      </div>
    </Dialog>
  )
}
