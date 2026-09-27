/**
 * 工作区组合器侧边栏面板（main 插槽 body）与侧边栏图标（sidebar.panellist）。
 * v2.3 宽屏左右分栏：顶部（品牌+当前卡）→ 左栏（工作空间+高级配置+预览）/
 * 右栏（项目目录+上下文预算）→ 底部图例。窄屏自动降级为上下堆叠。
 * @module dsh-workspace-combiner/client/panel/WorkspaceCombinerPanel
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactElement } from 'react'
import type { PanelIconProps, WorkspaceCombinerPanelProps } from '../types.ts'
import type { DirectoryAccess, GitStatus, LoadMode, ProjectType, Workspace, WorkspaceMode } from '../../core/types.ts'
import { useWorkspaceCombiner, DEFAULT_TOKEN_BUDGET } from './controller.ts'
import { injectPanelStyles } from './styles.ts'
import { tt } from '../locales.ts'
import { NewWorkspaceWizard } from './NewWorkspaceWizard.tsx'
import { StandardsModal } from './StandardsModal.tsx'
import { AdvancedModal } from './AdvancedModal.tsx'
import { PreviewModal } from './PreviewModal.tsx'
import { BudgetModal } from './BudgetModal.tsx'

/** 侧边栏图标：两个叠放的方块 + 连线，表达「多项目组合」。 */
export function WorkspaceCombinerIcon({ size, active }: PanelIconProps): ReactElement {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={active ? 1.6 : 1.4} opacity={active ? 1 : 0.75} aria-hidden="true">
      <rect x={2} y={6} width={8} height={8} rx={1.5} />
      <rect x={6} y={2} width={8} height={8} rx={1.5} />
      <path d="M6 10l3-3" />
    </svg>
  )
}

/** 相对时间：最近使用时间。 */
function formatLastUsed(ts?: number): string {
  if (ts === undefined) return tt('wsNeverUsed')
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return tt('wsLastUsedJustNow')
  if (min < 60) return tt('wsLastUsedMin', { n: min })
  const hr = Math.floor(min / 60)
  if (hr < 24) return tt('wsLastUsedHour', { n: hr })
  return tt('wsLastUsedDay', { n: Math.floor(hr / 24) })
}


/** 目录分组 -> 胶囊样式类。 */
const GROUP_CLASS: Record<string, string> = {
  [tt('groupDoc')]: 'wcb-cap-doc',
  [tt('groupBackend')]: 'wcb-cap-backend',
  [tt('groupFrontend')]: 'wcb-cap-frontend',
  [tt('groupRef')]: 'wcb-cap-ref',
  [tt('groupOther')]: 'wcb-cap-other',
}

/** 目录分组 -> 类型方块字母 + 样式类。 */
function dirTypeSquare(index: number, group: string | undefined, type: ProjectType | undefined): { letter: string; cls: string } {
  if (index === 0) return { letter: 'D', cls: 'wcb-type-sq wcb-type-sq-doc' }
  const g = group ?? ''
  if (g === tt('groupBackend') || type === 'java' || type === 'python' || type === 'go') return { letter: 'B', cls: 'wcb-type-sq wcb-type-sq-backend' }
  if (g === tt('groupFrontend') || type === 'frontend' || type === 'frontend-vue' || type === 'frontend-react' || type === 'frontend-webpack' || type === 'frontend-next') return { letter: 'F', cls: 'wcb-type-sq wcb-type-sq-frontend' }
  if (g === tt('groupRef')) return { letter: 'R', cls: 'wcb-type-sq wcb-type-sq-ref' }
  if (g === tt('groupDoc')) return { letter: 'D', cls: 'wcb-type-sq wcb-type-sq-doc' }
  return { letter: 'P', cls: 'wcb-type-sq wcb-type-sq-other' }
}


/** 访问状态 -> 胶囊样式类。 */
const ACCESS_CLASS: Record<DirectoryAccess, string> = {
  readwrite: 'wcb-cap wcb-cap-rw',
  readonly: 'wcb-cap wcb-cap-ro',
  disabled: 'wcb-cap wcb-cap-off',
}

/** 主项目标注：「📄 仅文档」——纯前端按是否为第一项渲染，不改数据结构。 */
function DocOnlyBadge(): ReactElement {
  return (
    <span className="wcb-kind wcb-kind-doc" title={tt('badgeDocOnlyTip')} role="note" aria-label={tt('badgeDocOnlyTip')}>
      {tt('badgeDocOnly')}
    </span>
  )
}

/** 代码项目反向标注：「💻 代码」——比主项目 Badge 更弱，仅作对照。 */
function CodeBadge(): ReactElement {
  return (
    <span className="wcb-kind wcb-kind-code" title={tt('badgeCodeTip')} role="note" aria-label={tt('badgeCodeTip')}>
      {tt('badgeCode')}
    </span>
  )
}

/** Git 分支标签：脏（橙）显示 '*N'，干净（灰）仅分支名；未加载/非 git 不渲染。 */
function GitBadge({ status }: { status: GitStatus | null | undefined }): ReactElement | null {
  if (status === undefined || status === null) return null
  const pending = status.dirty + status.untracked
  const dirty = pending > 0
  const title = dirty
    ? tt('gitDirty', { branch: status.branch, dirty: status.dirty, untracked: status.untracked })
    : tt('gitClean', { branch: status.branch })
  return (
    <span className={'wcb-git ' + (dirty ? 'wcb-git-dirty' : 'wcb-git-clean')} title={title}>
      {'\u2387 ' + status.branch}
      {dirty ? ' *' + pending : ''}
      {status.ahead > 0 ? ' \u2191' + status.ahead : ''}
    </span>
  )
}


/** 弹窗公共外壳：Esc 关闭 + 点击遮罩关闭 + aria-modal。 */
function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: ReactElement | ReactElement[] }): ReactElement {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <div className="wcb-overlay" onClick={onClose}>
      <div ref={ref} tabIndex={-1} className={'wcb-modal' + (wide === true ? ' wcb-modal-wide' : '')} role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="wcb-modal-title">{title}</div>
        {children}
      </div>
    </div>
  )
}

/** 重命名工作空间弹窗。 */
function RenameWorkspaceModal({ ws, onConfirm, onClose }: {
  ws: Workspace
  onConfirm: (name: string) => void
  onClose: () => void
}): ReactElement {
  const [name, setName] = useState(ws.name)
  const submit = (): void => { const trimmed = name.trim(); if (trimmed !== '') onConfirm(trimmed) }
  return (
    <Modal title={tt('wsRenameTitle')} onClose={onClose}>
      <label className="wcb-field">
        <span>{tt('wsCreateName')}</span>
        <input className="wcb-input" value={name} autoFocus aria-label={tt('wsCreateName')} onChange={(event) => setName(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter') submit() }} />
      </label>
      <div className="wcb-modal-actions">
        <button type="button" className="wcb-btn-plain" aria-label={tt('cancel')} onClick={onClose}>{tt('cancel')}</button>
        <button type="button" className="wcb-btn-primary" aria-label={tt('confirm')} disabled={name.trim() === ''} onClick={submit}>{tt('confirm')}</button>
      </div>
    </Modal>
  )
}

/** 删除工作空间确认弹窗。 */
function DeleteWorkspaceModal({ ws, onConfirm, onClose }: {
  ws: Workspace
  onConfirm: () => void
  onClose: () => void
}): ReactElement {
  return (
    <Modal title={tt('wsDeleteTitle')} onClose={onClose}>
      <div className="wcb-modal-body">{tt('wsDeleteConfirm', { name: ws.name })}</div>
      <div className="wcb-modal-actions">
        <button type="button" className="wcb-btn-plain" aria-label={tt('cancel')} onClick={onClose}>{tt('cancel')}</button>
        <button type="button" className="wcb-btn-danger" aria-label={tt('wsDelete')} onClick={onConfirm}>{tt('wsDelete')}</button>
      </div>
    </Modal>
  )
}

/** 命令面板条目。 */
interface CmdItem {
  id: string
  label: string
  kind: string
  run: () => void
}

/** 面板 body。 */
export function WorkspaceCombinerPanel(props: WorkspaceCombinerPanelProps): ReactElement {
  useEffect(() => { injectPanelStyles() }, [])
  const { startSession, pickDirectory, registerDshWorkspace } = props
  const state = useWorkspaceCombiner(startSession, pickDirectory, registerDshWorkspace, props.sessionCount ?? 0)

  const [wizardOpen, setWizardOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<Workspace | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [dirsOpen, setDirsOpen] = useState(true)
  const [advOpen, setAdvOpen] = useState(false)
  const [standardsOpen, setStandardsOpen] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [cmdkOpen, setCmdkOpen] = useState(false)
  const [cmdkQuery, setCmdkQuery] = useState('')
  const [cmdkIndex, setCmdkIndex] = useState(0)
  const [editingNotePath, setEditingNotePath] = useState<string | null>(null)
  const [editingCmdPath, setEditingCmdPath] = useState<string | null>(null)
  const [ciQuery, setCiQuery] = useState('')
  const currentWs = state.currentWorkspace
  const dirCount = state.dirs.length

  const submitManualPath = (): void => {
    const path = state.manualPath.trim()
    if (path !== '') { state.addDirectory(path); state.setManualPath('') }
  }

  const sandboxCount = state.dirs.filter(d => (d.access ?? 'readwrite') !== 'disabled').length

  const advSummary = tt('advancedSummary', {
    mode: currentWs?.mode === 'single' ? tt('wsModeSingle') : tt('wsModeAnchor'),
    load: currentWs?.loadMode === 'full' ? tt('loadModeFull') : currentWs?.loadMode === 'tree' ? tt('loadModeTree') : tt('loadModeSummary'),
    n: state.snapshots.length,
  })

  // ---------------- 命令面板条目 ----------------
  const commands = useMemo<CmdItem[]>(() => {
    const items: CmdItem[] = [
      { id: 'new-session', label: tt('cmdkNewSession'), kind: tt('cmdkKindAction'), run: state.createSession },
      { id: 'new-ws', label: tt('cmdkNewWorkspace'), kind: tt('cmdkKindAction'), run: () => setWizardOpen(true) },
      { id: 'add-dir', label: tt('cmdkAddDir'), kind: tt('cmdkKindAction'), run: state.pickAndAddDirectory },
      { id: 'refresh', label: tt('cmdkRefresh'), kind: tt('cmdkKindAction'), run: state.refreshContextStats },
      { id: 'toggle-adv', label: tt('cmdkToggleAdvanced'), kind: tt('cmdkKindAction'), run: () => setAdvOpen(v => !v) },
      { id: 'toggle-preview', label: tt('cmdkTogglePreview'), kind: tt('cmdkKindAction'), run: () => state.setPreviewOpen(!state.previewOpen) },
    ]
    for (const ws of state.sortedWorkspaces) {
      items.push({ id: 'ws-' + ws.id, label: tt('cmdkSwitchWs', { name: ws.name }), kind: tt('cmdkKindWorkspace'), run: () => state.switchWorkspace(ws.id) })
    }
    const modes: Array<[LoadMode, string]> = [['summary', tt('loadModeSummary')], ['tree', tt('loadModeTree')], ['full', tt('loadModeFull')]]
    for (const [value, label] of modes) {
      items.push({ id: 'load-' + value, label: tt('cmdkLoadMode', { name: label }), kind: tt('cmdkKindLoadMode'), run: () => state.setLoadMode(value) })
    }
    return items
  }, [state])

  const cmdkFiltered = useMemo(() => {
    const q = cmdkQuery.trim().toLowerCase()
    if (q === '') return commands
    return commands.filter(c => c.label.toLowerCase().includes(q))
  }, [commands, cmdkQuery])

  // 功能索引筛选（纯 UI；匹配功能名/端点/落点路径/摘要）。
  const codeEntriesFiltered = useMemo(() => {
    const q = ciQuery.trim().toLowerCase()
    if (q === '') return state.codeEntries
    return state.codeEntries.filter(entry => (
      entry.feature + ' ' + entry.endpoint + ' ' + (entry.server?.file ?? '') + ' ' + (entry.client?.file ?? '') + ' ' + (entry.summary ?? '')
    ).toLowerCase().includes(q))
  }, [state.codeEntries, ciQuery])

  // ---------------- 全局快捷键 ----------------
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key.toLowerCase() === 'n') { event.preventDefault(); state.createSession(); return }
      if (mod && event.key.toLowerCase() === 'k') { event.preventDefault(); setCmdkOpen(v => !v); setCmdkQuery(''); setCmdkIndex(0); return }
      if (event.key === 'Escape') { setCmdkOpen(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

  useEffect(() => {
    if (!cmdkOpen) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'ArrowDown') { event.preventDefault(); setCmdkIndex(i => Math.min(i + 1, cmdkFiltered.length - 1)) }
      else if (event.key === 'ArrowUp') { event.preventDefault(); setCmdkIndex(i => Math.max(i - 1, 0)) }
      else if (event.key === 'Enter') {
        event.preventDefault()
        const item = cmdkFiltered[cmdkIndex]
        if (item !== undefined) { item.run(); setCmdkOpen(false) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cmdkOpen, cmdkFiltered, cmdkIndex])

  // ---------------- 空状态：无工作空间 ----------------
  if (state.workspaces.length === 0) {
    return (
      <div className="wcb-root">
        <div className="wcb-brand">
          <div className="wcb-brand-icon" aria-hidden="true"><i /></div>
          <div className="wcb-brand-text">
            <div className="wcb-title">{tt('title')}</div>
            <div className="wcb-subtitle">{tt('brandSubtitle')}</div>
          </div>
        </div>
        <div className="wcb-card">
          <div className="wcb-empty">
            <div className="wcb-empty-icon" aria-hidden="true"><i /></div>
            <div className="wcb-empty-title">{tt('emptyTitle')}</div>
            <div className="wcb-empty-text">{tt('emptyText')}</div>
            <button type="button" className="wcb-btn-new" aria-label={tt('emptyCreate')} onClick={() => setWizardOpen(true)}>{tt('emptyCreate')}</button>
          </div>
        </div>
        {wizardOpen ? (
          <NewWorkspaceWizard
            pickDirectory={pickDirectory}
            onClose={() => setWizardOpen(false)}
            onCreate={(name, basePath, directories, mode) => { state.createWorkspace(name, basePath, directories, mode); setWizardOpen(false) }}
          />
        ) : null}
        <div className="wcb-toast-stack">
          {state.toasts.map(t => (
            <div key={t.id} className={'wcb-toast ' + (t.kind === 'error' ? 'wcb-toast-error' : 'wcb-toast-ok')} role="status" onClick={() => state.dismissToast(t.id)}>{t.text}</div>
          ))}
        </div>
      </div>
    )
  }

  // 非禁用目录列表（用于分目录用量）

  return (
    <div className="wcb-root">
      {/* ===== 顶部全宽：品牌 + 当前工作空间卡 ===== */}
      <div className="wcb-top">
        <div className="wcb-brand">
          <div className="wcb-brand-icon" aria-hidden="true"><i /></div>
          <div className="wcb-brand-text">
            <div className="wcb-title">{tt('title')}</div>
            <div className="wcb-subtitle">{tt('brandSubtitle')}</div>
          </div>
          <div className="wcb-kbd" title="⌘N">⌘N</div>
        </div>

        <div className="wcb-current">
          <div className={'wcb-status-dot' + (dirCount === 0 ? ' wcb-status-off' : '')} aria-hidden="true" />
          <div className="wcb-current-text">
            <div className="wcb-current-name" title={currentWs?.name}>{currentWs?.name ?? ''}</div>
            <div className="wcb-current-meta">
              <span>{currentWs?.mode === 'single' ? tt('wsModeSingle') : tt('wsModeAnchor')}</span>
              <span className="wcb-sep">·</span>
              <span>{tt('wsDirCount', { n: dirCount })}</span>
              <span className="wcb-sep">·</span>
              <span>{currentWs?.loadMode === 'full' ? tt('loadModeFull') : currentWs?.loadMode === 'tree' ? tt('loadModeTree') : tt('loadModeSummary')}</span>
            </div>
          </div>
          <button type="button" className="wcb-btn-new" aria-label={tt('createSession')} disabled={dirCount === 0} onClick={state.createSession}>{tt('createSession')}</button>
        </div>
      </div>

      {/* ===== 左右分栏主体 ===== */}
      <div className="wcb-main-split">

        {/* --- 左栏：工作空间列表 + 高级配置 + prompt预览 --- */}
        <div className="wcb-left-col">
          {/* 工作空间列表 */}
          <section className="wcb-card wcb-card-grow">
            <div className="wcb-card-head">
              {tt('workspaces')}
              <span className="wcb-badge">{state.sortedWorkspaces.length}</span>
              <div className="wcb-head-actions">
                <input className="wcb-search" value={state.search} placeholder={tt('searchPlaceholder')} aria-label={tt('searchPlaceholder')} onChange={(event: ChangeEvent<HTMLInputElement>) => state.setSearch(event.currentTarget.value)} />
                <button type="button" className="wcb-linkbtn" aria-label={tt('newWorkspace')} onClick={() => setWizardOpen(true)}>{tt('newShort')}</button>
              </div>
            </div>
            <div className="wcb-card-body">
              <div className="wcb-ws-list">
                {state.filteredWorkspaces.map(ws => (
                  <div
                    key={ws.id}
                    className={'wcb-ws-item' + (ws.id === state.currentWorkspaceId ? ' wcb-ws-active' : '')}
                    role="button"
                    tabIndex={0}
                    aria-label={ws.name}
                    onClick={() => state.switchWorkspace(ws.id)}
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); state.switchWorkspace(ws.id) } }}
                  >
                    <span className="wcb-ws-dot" aria-hidden="true">●</span>
                    <span className="wcb-ws-name" title={ws.name}>{ws.name}</span>
                    {ws.id === state.currentWorkspaceId ? <span className="wcb-pill wcb-pill-current">{tt('wsCurrent')}</span> : null}
                    <span className="wcb-ws-time">{formatLastUsed(ws.lastSessionAt)}</span>
                    <span className="wcb-ws-tools">
                      <button type="button" className="wcb-iconbtn" title={tt('wsRename')} aria-label={tt('wsRename')} onClick={(event) => { event.stopPropagation(); setRenameTarget(ws) }}>✎</button>
                      <button type="button" className="wcb-iconbtn wcb-iconbtn-danger" title={tt('wsDelete')} aria-label={tt('wsDelete')} onClick={(event) => { event.stopPropagation(); setDeleteTarget(ws) }}>✕</button>
                    </span>
                  </div>
                ))}
                {state.filteredWorkspaces.length === 0 ? <div className="wcb-hint">{tt('cmdkEmpty')}</div> : null}
              </div>
            </div>
          </section>

          {/* 开发规范：点击弹窗（位于高级配置上方） */}
          <section className="wcb-card">
            <div
              className="wcb-card-head wcb-card-head-btn"
              role="button"
              tabIndex={0}
              aria-label={tt('standardsTitle')}
              aria-expanded={standardsOpen}
              onClick={() => setStandardsOpen(true)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setStandardsOpen(true) } }}
            >
              <span className="wcb-caret" aria-hidden="true">▸</span>
              {tt('standardsTitle')}
              <span className="wcb-badge" style={{ marginLeft: 2 }}>
                {state.standardGroups.length > 0 ? tt('standardsGroups', { n: state.standardGroups.length }) : tt('standardsNone')}
              </span>
              {state.standardGroups.length > 0 ? <span className="wcb-label" style={{ margin: 0, marginLeft: 'auto' }}>{'~' + (state.contextStats?.standardsTokens ?? 0) + ' t'}</span> : null}
            </div>
          </section>

          {/* 高级配置：点击弹窗 */}
          <section className="wcb-card">
            <div className="wcb-card-head wcb-card-head-btn" role="button" tabIndex={0} aria-label={tt('advancedTitle')} aria-expanded={advOpen} onClick={() => setAdvOpen(true)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setAdvOpen(true) } }}>
              <span className="wcb-caret" aria-hidden="true">▸</span>
              {tt('advancedTitle')}
              <span className="wcb-badge" style={{ marginLeft: 2 }}>{advSummary}</span>
            </div>
          </section>

          {/* 注入 prompt 预览：点击弹窗 */}
          <section className="wcb-card">
            <div className="wcb-card-head wcb-card-head-btn" role="button" tabIndex={0} aria-label={tt('previewTitle')} aria-expanded={state.previewOpen} onClick={() => state.setPreviewOpen(true)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); state.setPreviewOpen(true) } }}>
              <span className="wcb-caret" aria-hidden="true">▸</span>
              {tt('previewTitle')}
              <div className="wcb-head-actions">
                <span className="wcb-label" style={{ margin: 0 }}>{tt('previewOpenHint')}</span>
              </div>
            </div>
          </section>
          {/* 更多：上下文预算入口（点击弹窗） */}
          <section className="wcb-card">
            <div className="wcb-card-head wcb-card-head-btn" role="button" tabIndex={0} aria-label={tt('moreTitle')} aria-expanded={budgetOpen} onClick={() => setBudgetOpen(true)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setBudgetOpen(true) } }}>
              <span className="wcb-caret" aria-hidden="true">▸</span>
              {tt('moreTitle')}
              <span className="wcb-badge" style={{ marginLeft: 2 }}>{tt('moreBudgetHint')}</span>
            </div>
          </section>
        </div>

        {/* --- 右栏：项目目录 + 上下文预算（7:30 固定比例，可拖拽调整） --- */}
        <div className="wcb-right-col">
          {/* 项目目录区 */}
          <section className="wcb-card wcb-card-grow">
            <div className="wcb-card-head wcb-card-head-btn" role="button" tabIndex={0} aria-label={tt('projectsTitle')} onClick={() => setDirsOpen(v => !v)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDirsOpen(v => !v) } }}>
              <span className="wcb-caret" aria-hidden="true">{dirsOpen ? '▾' : '▸'}</span>
              {tt('projectsTitle')}
              <span className="wcb-badge">{dirCount}</span>
              <div className="wcb-head-actions">
                <button type="button" className="wcb-linkbtn" aria-label={tt('pickDirectory')} onClick={(event) => { event.stopPropagation(); state.pickAndAddDirectory() }}>{'+ ' + tt('addDirectory')}</button>
              </div>
            </div>
            {dirsOpen ? (
              <div className="wcb-card-body">
                <div className="wcb-add-row">
                  <button type="button" className="wcb-btn" aria-label={tt('wizardPickFolder')} onClick={state.pickAndAddDirectory}>{tt('wizardPickFolder')}</button>
                  <input className="wcb-input wcb-input-mono" value={state.manualPath} placeholder={tt('manualPathPlaceholder')} aria-label={tt('manualPathPlaceholder')} onChange={(event: ChangeEvent<HTMLInputElement>) => state.setManualPath(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitManualPath() }} />
                </div>
                {dirCount === 0 ? (
                  <div className="wcb-empty">
                    <div className="wcb-empty-title">{tt('dirsEmptyTitle')}</div>
                    <div className="wcb-empty-text">{tt('dirsEmpty')}</div>
                    <button type="button" className="wcb-btn" aria-label={tt('emptyAddDir')} onClick={state.pickAndAddDirectory}>{tt('emptyAddDir')}</button>
                  </div>
                ) : (
                  <ul className="wcb-dir-list">
                    {state.dirs.map((d, i) => {
                      const group = d.group ?? ''
                      const access = (d.access ?? 'readwrite') as DirectoryAccess
                      const sq = dirTypeSquare(i, d.group, d.projectType)
                      const missing = state.missingDirs.has(d.path)
                      const selected = state.selectedDirs.has(d.path)
                      return (
                        <li
                          key={d.path}
                          className={'wcb-dir-row' + (dragIndex === i ? ' wcb-dragging' : '') + (access === 'disabled' ? ' wcb-dir-disabled' : '') + (missing ? ' wcb-dir-missing' : '') + (selected ? ' wcb-dir-selected' : '')}
                          draggable
                          onDragStart={() => setDragIndex(i)}
                          onDragEnd={() => { setDragIndex(null); setDropIndex(null) }}
                          onDragOver={(event: DragEvent<HTMLLIElement>) => { event.preventDefault(); setDropIndex(i) }}
                          onDrop={() => { if (dragIndex !== null && dropIndex !== null) state.moveDirectory(dragIndex, i); setDragIndex(null); setDropIndex(null) }}
                        >
                          {dropIndex === i && dragIndex !== null && dragIndex !== i ? <span className="wcb-drop-line" aria-hidden="true" /> : null}
                          <span className="wcb-drag-handle" aria-hidden="true">⠿</span>
                          {i > 0 ? <input type="checkbox" className="wcb-checkbox" checked={selected} aria-label={tt('selectDir')} onChange={() => state.toggleDirSelected(d.path)} /> : null}
                          <span className={'wcb-star' + (i === 0 ? '' : ' wcb-star-off')} title={i === 0 ? tt('primaryProject') : ''} aria-hidden="true">★</span>
                          <span className={sq.cls} aria-hidden="true">{sq.letter}</span>
                          <div className="wcb-dir-info">
                            <div className="wcb-dir-name-row">
                              <span className="wcb-dir-name" title={d.name}>{d.name}</span>
                              {i === 0 ? <DocOnlyBadge /> : null}
                              <GitBadge status={state.gitStatuses[d.path]} />
                              {i > 0 ? <CodeBadge /> : null}
                            </div>
                            <div className="wcb-dir-path" title={d.path}>{d.path}</div>
                            {editingNotePath === d.path ? (
                              <input
                                className="wcb-dir-note-input"
                                autoFocus
                                value={d.note ?? ""}
                                placeholder={tt("notePlaceholder")}
                                aria-label={tt("notePlaceholder")}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event: ChangeEvent<HTMLInputElement>) => state.setDirectoryNote(d.path, event.currentTarget.value)}
                                onBlur={() => setEditingNotePath(null)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") { event.preventDefault(); state.setDirectoryNote(d.path, event.currentTarget.value); setEditingNotePath(null) }
                                  else if (event.key === "Escape") { event.preventDefault(); setEditingNotePath(null) }
                                }}
                              />
                            ) : (
                              <div
                                className="wcb-dir-note"
                                title={d.note ?? tt("addNote")}
                                role="button"
                                tabIndex={0}
                                aria-label={tt("addNote")}
                                onClick={(event) => { event.stopPropagation(); setEditingNotePath(d.path) }}
                                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setEditingNotePath(d.path) } }}
                              >
                                {d.note !== undefined && d.note !== "" ? (
                                  <><span className="wcb-dir-note-icon" aria-hidden="true">📝</span>{d.note}</>
                                ) : (
                                  <span className="wcb-dir-note-add">{tt("addNote")}</span>
                                )}
                              </div>
                            )}
                            {editingCmdPath === d.path ? (
                              <div className="wcb-dir-cmd-edit" onClick={(event) => event.stopPropagation()}>
                                {([['run', tt('cmdRun')], ['test', tt('cmdTest')], ['build', tt('cmdBuild')]] as Array<['run' | 'test' | 'build', string]>).map(([field, label]) => (
                                  <div className="wcb-dir-cmd-row" key={field}>
                                    <span className="wcb-dir-cmd-label">{label}</span>
                                    <input
                                      className="wcb-dir-note-input"
                                      value={d.commands?.[field] ?? ""}
                                      placeholder={tt('cmdPlaceholder')}
                                      aria-label={label}
                                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                                        const next = { ...(d.commands ?? {}), [field]: event.currentTarget.value.trim() }
                                        const any = Object.values(next).some(v => v !== undefined && v !== '')
                                        state.setDirectoryCommands(d.path, any ? next : undefined)
                                      }}
                                    />
                                  </div>
                                ))}
                                <div className="wcb-dir-cmd-actions">
                                  <span className="wcb-hint">{tt('cmdHint')}</span>
                                  <button type="button" className="wcb-linkbtn" aria-label={tt('confirm')} onClick={() => setEditingCmdPath(null)}>{tt('confirm')}</button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="wcb-dir-note"
                                title={d.commands === undefined ? tt('cmdTitle') : tt('cmdEdit')}
                                role="button"
                                tabIndex={0}
                                aria-label={tt('cmdTitle')}
                                onClick={(event) => { event.stopPropagation(); setEditingCmdPath(d.path) }}
                                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setEditingCmdPath(d.path) } }}
                              >
                                {d.commands !== undefined ? (
                                  <>
                                    <span className="wcb-dir-note-icon" aria-hidden="true">⌘</span>
                                    {[d.commands.run, d.commands.test, d.commands.build].filter(x => x !== undefined && x !== '').join(' · ')}
                                  </>
                                ) : (
                                  <span className="wcb-dir-note-add">{'+ ' + tt('cmdTitle')}</span>
                                )}
                              </div>
                            )}
                          </div>
                          {missing ? <span className="wcb-warn-icon" title={tt('dirMissing')} role="img" aria-label={tt('dirMissing')}>⚠</span> : null}
                          {i > 0 ? (
                            <select className="wcb-cap wcb-cap-other" style={{ border: 'none', font: 'inherit', fontSize: '9.5px', cursor: 'pointer' }} value={group === '' ? '' : group} aria-label={tt('groupHint')} onChange={(event) => state.setDirectoryGroup(d.path, event.currentTarget.value)} onDragStart={(event: DragEvent<HTMLSelectElement>) => event.stopPropagation()}>
                              <option value="">{tt('groupNone')}</option>
                              <option value={tt('groupDoc')}>{tt('groupDoc')}</option>
                              <option value={tt('groupBackend')}>{tt('groupBackend')}</option>
                              <option value={tt('groupFrontend')}>{tt('groupFrontend')}</option>
                              <option value={tt('groupRef')}>{tt('groupRef')}</option>
                              <option value={tt('groupOther')}>{tt('groupOther')}</option>
                            </select>
                          ) : null}
                          {i > 0 && group !== '' ? <span className={GROUP_CLASS[group] ?? 'wcb-cap-other'} aria-hidden="true">{group}</span> : null}
                          {i === 0 ? (
                            <span className={ACCESS_CLASS.readwrite} title={tt('primaryAccessFixed')}>{tt('accessReadwrite')}</span>
                          ) : (
                            <select className={ACCESS_CLASS[access].replace('wcb-cap ', 'wcb-cap ')} style={{ border: 'none', font: 'inherit', fontSize: '9.5px', cursor: 'pointer' }} value={access} aria-label={tt('accessHint')} onChange={(event) => state.setDirectoryAccess(d.path, event.currentTarget.value as DirectoryAccess)} onDragStart={(event: DragEvent<HTMLSelectElement>) => event.stopPropagation()}>
                              <option value="readwrite">{tt('accessReadwrite')}</option>
                              <option value="readonly">{tt('accessReadonly')}</option>
                              <option value="disabled">{tt('accessDisabled')}</option>
                            </select>
                          )}
                          {i > 0 ? <button type="button" className="wcb-remove" title={tt('removeDirectory')} aria-label={tt('removeDirectory')} onClick={() => state.removeDirectory(d.path)}>✕</button> : <span style={{ width: 20 }} aria-hidden="true" />}
                        </li>
                      )
                    })}
                  </ul>
                )}
                {/* 批量操作条 */}
                {state.selectedDirs.size > 0 ? (
                  <div className="wcb-bulk" role="toolbar" aria-label={tt('bulkSelected', { n: state.selectedDirs.size })}>
                    <div className="wcb-bulk-row">
                      <span className="wcb-bulk-count">{tt('bulkSelected', { n: state.selectedDirs.size })}</span>
                      <button type="button" className="wcb-btn" aria-label={tt('bulkClear')} onClick={state.clearDirSelection}>{tt('bulkClear')}</button>
                    </div>
                    <div className="wcb-bulk-row">
                      <span className="wcb-label" style={{ margin: 0 }}>{tt('bulkAccess')}</span>
                      <button type="button" className="wcb-btn" aria-label={tt('accessReadwrite')} onClick={() => state.bulkSetAccess('readwrite')}>{tt('accessReadwrite')}</button>
                      <button type="button" className="wcb-btn" aria-label={tt('accessReadonly')} onClick={() => state.bulkSetAccess('readonly')}>{tt('accessReadonly')}</button>
                      <button type="button" className="wcb-btn" aria-label={tt('accessDisabled')} onClick={() => state.bulkSetAccess('disabled')}>{tt('accessDisabled')}</button>
                    </div>
                    <div className="wcb-bulk-row">
                      <span className="wcb-label" style={{ margin: 0 }}>{tt('bulkGroup')}</span>
                      <select className="wcb-input" style={{ flex: 'none', width: 110 }} aria-label={tt('bulkGroup')} value="" onChange={(event) => { state.bulkSetGroup(event.currentTarget.value); event.currentTarget.value = '' }}>
                        <option value="">{tt('groupNone')}</option>
                        <option value={tt('groupDoc')}>{tt('groupDoc')}</option>
                        <option value={tt('groupBackend')}>{tt('groupBackend')}</option>
                        <option value={tt('groupFrontend')}>{tt('groupFrontend')}</option>
                        <option value={tt('groupRef')}>{tt('groupRef')}</option>
                        <option value={tt('groupOther')}>{tt('groupOther')}</option>
                      </select>
                      <button type="button" className="wcb-btn-danger" aria-label={tt('bulkDelete')} onClick={state.bulkRemove}>{tt('bulkDelete')}</button>
                    </div>
                  </div>
                ) : null}
                <div className="wcb-hint">{tt('primaryHint')}</div>
              </div>
            ) : null}
          </section>


          {/* 功能/接口索引：端点 ↔ 服务端 ↔ 前端（点击复制 @功能名） */}
          <section className="wcb-card wcb-codeindex-card">
            <div className="wcb-card-head">
              {tt('codeIndexTitle')}
              <div className="wcb-head-actions">
                {state.codeIndexEnabled && state.codeEntries.length > 0 ? (
                  <input className="wcb-search" value={ciQuery} placeholder={tt('codeIndexSearch')} aria-label={tt('codeIndexSearch')} onChange={(event: ChangeEvent<HTMLInputElement>) => setCiQuery(event.currentTarget.value)} />
                ) : null}
                <label className="wcb-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={state.codeIndexEnabled} aria-label={tt('codeIndexToggle')} onChange={(event: ChangeEvent<HTMLInputElement>) => state.setCodeIndexEnabled(event.currentTarget.checked)} />
                  {tt('codeIndexToggle')}
                </label>
                <span className="wcb-label" style={{ margin: 0 }}>{tt('codeIndexBudget')}</span>
                <input className="wcb-budget-input" type="number" min={1} value={state.codeIndexBudget} disabled={!state.codeIndexEnabled} aria-label={tt('codeIndexBudget')} onChange={(event: ChangeEvent<HTMLInputElement>) => state.setCodeIndexBudget(Number(event.currentTarget.value))} />
                <span className="wcb-label" style={{ margin: 0 }}>{tt('codeIndexSummaryLabel')}</span>
                <select className="wcb-input" style={{ width: 'auto' }} value={state.codeIndexSummary} disabled={!state.codeIndexEnabled} aria-label={tt('codeIndexSummaryLabel')} onChange={(event: ChangeEvent<HTMLSelectElement>) => state.setCodeIndexSummary(event.currentTarget.value === 'llm' ? 'llm' : 'off')}>
                  <option value="off">{tt('codeIndexSummaryOff')}</option>
                  <option value="llm">{tt('codeIndexSummaryLlm')}</option>
                </select>
              </div>
            </div>
            <div className="wcb-card-body">
              {(!state.codeIndexEnabled || state.codeEntries.length === 0 || codeEntriesFiltered.length === 0) ? (
                <div className="wcb-hint">{tt('codeIndexEmpty')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {codeEntriesFiltered.map(entry => (
                    <div
                      key={entry.feature + '|' + entry.endpoint}
                      role="button"
                      tabIndex={0}
                      title={tt('codeIndexCopy')}
                      onClick={() => state.copyText('@' + entry.feature)}
                      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); state.copyText('@' + entry.feature) } }}
                      style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: 10, cursor: 'pointer', padding: '2px 5px', borderRadius: 4, background: 'var(--wcb-surface)' }}
                    >
                      <span style={{ color: 'var(--wcb-purple)', fontWeight: 600, flex: 'none' }}>{'@' + entry.feature}</span>
                      <span style={{ color: 'var(--wcb-text2)', flex: 'none', fontFamily: 'var(--ds-font-family-code,monospace)' }}>{entry.endpoint}</span>
                      {entry.server !== undefined ? <span style={{ color: 'var(--wcb-muted)', flex: 'none' }}>{tt('codeIndexServer') + ' ' + entry.server.file + ':' + entry.server.line}</span> : null}
                      {entry.client !== undefined ? <span style={{ color: 'var(--wcb-muted)', flex: 'none' }}>{tt('codeIndexClient') + ' ' + entry.client.file + ':' + entry.client.line}</span> : null}
                      {entry.summary !== undefined && entry.summary !== '' ? <span style={{ color: 'var(--wcb-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.summary}</span> : null}
                    </div>
                  ))}
                </div>
              )}
              <div className="wcb-hint" style={{ marginTop: 5 }}>{tt('codeIndexHint')}{state.codeIndexSummary === 'llm' ? ' · ' + tt('codeIndexSummaryHint') : ''}</div>
            </div>
          </section>

          {/* 本次变更 -> 受影响端点：确定性反查（改动文件 -> 端点 -> 对端落点） */}
          <section className="wcb-card">
            <div className="wcb-card-head">
              {tt('impactTitle')}
              <div className="wcb-head-actions">
                {state.endpointImpactFiles > 0 ? <span className="wcb-label" style={{ margin: 0 }}>{tt('impactFiles', { n: state.endpointImpactFiles })}</span> : null}
                <button type="button" className="wcb-linkbtn" aria-label={tt('impactRefresh')} disabled={state.endpointImpactLoading} onClick={state.refreshEndpointImpact}>{'↻ ' + tt('impactRefresh')}</button>
              </div>
            </div>
            <div className="wcb-card-body">
              {state.endpointImpactFiles === 0 ? (
                <div className="wcb-hint">{tt('impactEmpty')}</div>
              ) : state.endpointImpact.length === 0 ? (
                <div className="wcb-hint">{tt('impactNone')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {state.endpointImpact.map(item => (
                    <div
                      key={item.endpoint + '|' + item.changedFile + '|' + (item.counterpart?.file ?? '')}
                      role="button"
                      tabIndex={0}
                      title={tt('codeIndexCopy')}
                      onClick={() => state.copyText('@' + item.feature)}
                      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); state.copyText('@' + item.feature) } }}
                      style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: 10, cursor: 'pointer', padding: '2px 5px', borderRadius: 4, background: 'var(--wcb-surface)' }}
                    >
                      <span style={{ color: 'var(--wcb-purple)', fontWeight: 600, flex: 'none' }}>{'@' + item.feature}</span>
                      <span style={{ color: 'var(--wcb-text2)', flex: 'none', fontFamily: 'var(--ds-font-family-code,monospace)' }}>{item.endpoint}</span>
                      <span style={{ color: 'var(--wcb-muted)', flex: 'none' }}>{'✎ ' + item.changedFile}</span>
                      {item.counterpart !== undefined ? (
                        <span style={{ color: 'var(--wcb-dim)', flex: 'none' }}>{tt('impactCounterpart') + ' → ' + item.counterpart.file + ':' + item.counterpart.line}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ===== 底部全宽：图例 + 沙盒状态 ===== */}
      <div className="wcb-legend-row">
        <div className="wcb-legend">
          {([['#5dd8a3', tt('legendReadwrite')], ['#d2a8ff', tt('legendReadonly')], ['#8b949e', tt('legendDisabled')]] as Array<[string, string]>).map(([color, label]) => (
            <span className="wcb-legend-item" key={label}><span className="wcb-legend-dot" style={{ background: color }} aria-hidden="true" />{label}</span>
          ))}
        </div>
        {dirCount > 0 ? (
          <div className="wcb-sandbox" title={tt('sandboxTitle', { cur: sandboxCount })}>
            <span className="wcb-sandbox-dot" aria-hidden="true" />
            {'🔒 ' + tt('sandboxSynced', { cur: sandboxCount, total: dirCount })}
          </div>
        ) : null}
      </div>

      <div className="wcb-toast-stack">
        {state.toasts.map(t => (
          <div key={t.id} className={'wcb-toast ' + (t.kind === 'error' ? 'wcb-toast-error' : 'wcb-toast-ok')} role="status" onClick={() => state.dismissToast(t.id)}>{t.text}</div>
        ))}
      </div>

      {/* 命令面板 */}
      {cmdkOpen ? (
        <div className="wcb-cmdk-overlay" onClick={() => setCmdkOpen(false)}>
          <div className="wcb-cmdk" role="dialog" aria-modal="true" aria-label={tt('cmdkTitle')} onClick={(event) => event.stopPropagation()}>
            <input className="wcb-cmdk-input" autoFocus value={cmdkQuery} placeholder={tt('cmdkPlaceholder')} aria-label={tt('cmdkPlaceholder')} onChange={(event: ChangeEvent<HTMLInputElement>) => { setCmdkQuery(event.currentTarget.value); setCmdkIndex(0) }} />
            <ul className="wcb-cmdk-list">
              {cmdkFiltered.map((c, i) => (
                <li key={c.id} className={'wcb-cmdk-item' + (i === cmdkIndex ? ' wcb-cmdk-on' : '')} role="option" aria-selected={i === cmdkIndex} onMouseEnter={() => setCmdkIndex(i)} onClick={() => { c.run(); setCmdkOpen(false) }}>
                  <span>{c.label}</span>
                  <span className="wcb-cmdk-kind">{c.kind}</span>
                </li>
              ))}
            </ul>
            {cmdkFiltered.length === 0 ? <div className="wcb-cmdk-empty">{tt('cmdkEmpty')}</div> : null}
          </div>
        </div>
      ) : null}

      {wizardOpen ? (
        <NewWorkspaceWizard
          pickDirectory={pickDirectory}
          onClose={() => setWizardOpen(false)}
          onCreate={(name, basePath, directories, mode) => { state.createWorkspace(name, basePath, directories, mode); setWizardOpen(false) }}
        />
      ) : null}
      {renameTarget !== null ? (
        <RenameWorkspaceModal ws={renameTarget} onClose={() => setRenameTarget(null)} onConfirm={(name) => { state.renameWorkspace(renameTarget.id, name); setRenameTarget(null) }} />
      ) : null}
      {deleteTarget !== null ? (
        <DeleteWorkspaceModal ws={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => { state.deleteWorkspace(deleteTarget.id); setDeleteTarget(null) }} />
      ) : null}
      {advOpen ? (
        <AdvancedModal state={state} currentWs={currentWs} onClose={() => setAdvOpen(false)} />
      ) : null}
      {state.previewOpen ? (
        <PreviewModal text={state.previewText} loading={state.previewLoading} onCopy={state.copyPreview} onClose={() => state.setPreviewOpen(false)} />
      ) : null}
      {budgetOpen ? (
        <BudgetModal
          stats={state.contextStats}
          usage={state.tokenUsage}
          budget={state.tokenBudget}
          dirs={state.dirs}
          onBudget={state.setTokenBudget}
          onRefresh={() => { state.refreshContextStats(); state.refreshTokenUsage() }}
          onClose={() => setBudgetOpen(false)}
        />
      ) : null}
      {standardsOpen ? (
        <StandardsModal
          standards={state.workspaceStandards ?? {}}
          library={state.standardsLibrary}
          directories={state.dirs}
          onSaveWorkspace={state.setWorkspaceStandards}
          onSaveLibrary={state.saveStandardsLibrary}
          onGenerateDraft={state.generateStandard}
          onClose={() => setStandardsOpen(false)}
        />
      ) : null}
    </div>
  )
}