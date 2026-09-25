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

/** 千分位 token 简写（36200 -> 36.2k）。 */
function kmTokens(n: number): string {
  if (n < 1000) return String(n)
  return (n / 1000).toFixed(1) + 'k'
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

/** 目录索引 -> 环形图/进度条颜色。 */
function dirColor(index: number, group: string | undefined, type: ProjectType | undefined): string {
  if (index === 0) return '#d4a017'
  const g = group ?? ''
  if (g === tt('groupBackend') || type === 'java' || type === 'python' || type === 'go') return '#8b5cf6'
  if (g === tt('groupFrontend') || type === 'frontend' || type === 'frontend-vue' || type === 'frontend-react' || type === 'frontend-webpack' || type === 'frontend-next') return '#3b82f6'
  if (g === tt('groupRef')) return '#2aa8b4'
  if (g === tt('groupDoc')) return '#d4a017'
  return '#888'
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

/** 环形进度图：SVG donut，中间显示百分比。 */
function Donut({ percentage, size = 56, strokeWidth = 5, color = '#4f8cff' }: {
  percentage: number; size?: number; strokeWidth?: number; color?: string;
}): ReactElement {
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const pct = Math.min(1, Math.max(0, percentage))
  const offset = circumference * (1 - pct)
  return (
    <div className="wcb-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={strokeWidth} />
        {/* 进度为 0 时不渲染，否则 strokeLinecap="round" 会在起点留下一个孤立圆点 */}
        {pct > 0.001 ? (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeLinecap={pct >= 0.999 ? "butt" : "round"}
            strokeDasharray={circumference} strokeDashoffset={offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        ) : null}
      </svg>
      <div className="wcb-donut-center" style={{ fontSize: Math.round(size * 0.22) }}>{Math.round(pct * 100)}%</div>
    </div>
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
  const [cmdkOpen, setCmdkOpen] = useState(false)
  const [cmdkQuery, setCmdkQuery] = useState('')
  const [cmdkIndex, setCmdkIndex] = useState(0)
  const [editingNotePath, setEditingNotePath] = useState<string | null>(null)
  // 右栏 项目目录 : 上下文预算 的高度比例（默认 6:4），可拖拽调整并持久化。
  const [splitRatio, setSplitRatio] = useState<number>(() => {
    if (typeof localStorage === 'undefined') return 0.6
    const saved = Number(localStorage.getItem('wcb.splitRatio'))
    return Number.isFinite(saved) && saved > 0.05 && saved < 0.95 ? saved : 0.6
  })
  const rightColRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)

  const onSplitMove = useCallback((clientY: number): void => {
    const el = rightColRef.current
    if (el === null) return
    const rect = el.getBoundingClientRect()
    if (rect.height <= 0) return
    const next = Math.min(0.9, Math.max(0.1, (clientY - rect.top) / rect.height))
    setSplitRatio(next)
  }, [])

  useEffect(() => {
    const onMove = (event: MouseEvent): void => { if (draggingRef.current) onSplitMove(event.clientY) }
    const onUp = (): void => {
      if (!draggingRef.current) return
      draggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      setSplitRatio(prev => { try { localStorage.setItem('wcb.splitRatio', String(prev)) } catch { /* 忽略隐私模式写入失败 */ } return prev })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [onSplitMove])

  const startSplitDrag = useCallback((event: React.MouseEvent): void => {
    event.preventDefault()
    draggingRef.current = true
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const currentWs = state.currentWorkspace
  const dirCount = state.dirs.length

  const submitManualPath = (): void => {
    const path = state.manualPath.trim()
    if (path !== '') { state.addDirectory(path); state.setManualPath('') }
  }

  const total = (state.contextStats?.fileIndexTokens ?? 0) + (state.contextStats?.promptOverheadTokens ?? 0)
  const budget = state.tokenBudget
  const ratio = budget > 0 ? total / budget : 0
  const maxDirTokens = Math.max(1, ...(state.contextStats?.directories ?? []).map(d => d.tokens))
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
  const activeDirs = (state.contextStats?.directories ?? []).filter(d => d.access !== 'disabled')

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

          {/* 高级配置（默认折叠） */}
          <section className="wcb-card">
            <div className="wcb-card-head wcb-card-head-btn" role="button" tabIndex={0} aria-label={tt('advancedTitle')} aria-expanded={advOpen} onClick={() => setAdvOpen(v => !v)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setAdvOpen(v => !v) } }}>
              <span className="wcb-caret" aria-hidden="true">{advOpen ? '▾' : '▸'}</span>
              {tt('advancedTitle')}
              {!advOpen ? <span className="wcb-badge" style={{ marginLeft: 2 }}>{advSummary}</span> : null}
            </div>
            {advOpen ? (
              <div className="wcb-card-body">
                <div>
                  <div className="wcb-label">{tt('wsModeLabel')}</div>
                  <div className="wcb-tabs" role="tablist" aria-label={tt('wsModeLabel')}>
                    {([['anchor', tt('wsModeAnchor')], ['single', tt('wsModeSingle')]] as Array<[WorkspaceMode, string]>).map(([value, label]) => (
                      <button key={value} type="button" role="tab" aria-selected={(currentWs?.mode ?? 'anchor') === value} aria-label={label} className={'wcb-tab' + ((currentWs?.mode ?? 'anchor') === value ? ' wcb-tab-on' : '')} onClick={() => state.setWorkspaceMode(value)}>{label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="wcb-label">{tt('loadModeLabel')}</div>
                  <div className="wcb-tabs" role="tablist" aria-label={tt('loadModeLabel')}>
                    {([['summary', tt('loadModeSummary')], ['tree', tt('loadModeTree')], ['full', tt('loadModeFull')]] as Array<[LoadMode, string]>).map(([value, label]) => (
                      <button key={value} type="button" role="tab" aria-selected={(currentWs?.loadMode ?? 'summary') === value} aria-label={label} className={'wcb-tab' + ((currentWs?.loadMode ?? 'summary') === value ? ' wcb-tab-on' : '')} onClick={() => state.setLoadMode(value)}>{label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="wcb-label">{tt('snapshotSave')}</div>
                  <div className="wcb-add-row" style={{ border: 'none', padding: 0, marginBottom: 6 }}>
                    <input className="wcb-input" value={state.snapshotName} placeholder={tt('snapshotNamePlaceholder')} aria-label={tt('snapshotNamePlaceholder')} onChange={(event: ChangeEvent<HTMLInputElement>) => state.setSnapshotName(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter') state.saveSnapshot() }} />
                    <button type="button" className="wcb-btn" aria-label={tt('snapshotSave')} disabled={state.snapshotName.trim() === ''} onClick={state.saveSnapshot}>{tt('snapshotSave')}</button>
                  </div>
                  {state.snapshots.length > 0 ? (
                    <div className="wcb-snap-list">
                      {state.snapshots.map(s => (
                        <div key={s.id} className="wcb-snap-item">
                          <span className="wcb-snap-name" title={s.name}>{s.name}</span>
                          <span className="wcb-snap-meta">{tt('snapshotDirCount', { n: s.directories.length })}</span>
                          <button type="button" className="wcb-snap-restore" aria-label={tt('snapshotRestore')} onClick={() => state.restoreSnapshot(s.id)}>{tt('snapshotRestore')}</button>
                          <button type="button" className="wcb-iconbtn wcb-iconbtn-danger" title={tt('snapshotDelete')} aria-label={tt('snapshotDelete')} onClick={() => state.deleteSnapshot(s.id)}>✕</button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                {/* @指令速查卡 */}
                <div className="wcb-sep-line" />
                <div>
                  <div className="wcb-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--wcb-purple)', fontWeight: 600 }}>@</span>
                    {tt('cmdRefTitle')}
                    <span style={{ fontSize: '9.5px', color: 'var(--wcb-dim)' }}>{tt('cmdRefHint')}</span>
                  </div>
                  <div className="wcb-cmdref">
                    {([
                      ['@workspace', tt('cmdRefWorkspace')],
                      ['@dir:路径', tt('cmdRefDir')],
                      ['@files', tt('cmdRefFiles')],
                      ['@snapshot:名', tt('cmdRefSnapshot')],
                    ] as Array<[string, string]>).map(([code, desc]) => (
                      <button
                        key={code}
                        type="button"
                        className="wcb-cmdref-item"
                        aria-label={code + ' ' + desc}
                        onClick={() => state.copyText(code)}
                      >
                        <code className="wcb-cmdref-code">{code}</code>
                        <span className="wcb-cmdref-desc">{desc}</span>
                        <span className="wcb-cmdref-copy">{tt('previewCopy')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          {/* prompt 预览 */}
          <section className="wcb-card">
            <div className="wcb-card-head wcb-card-head-btn" role="button" tabIndex={0} aria-label={tt('previewTitle')} aria-expanded={state.previewOpen} onClick={() => state.setPreviewOpen(!state.previewOpen)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); state.setPreviewOpen(!state.previewOpen) } }}>
              <span className="wcb-caret" aria-hidden="true">{state.previewOpen ? '▾' : '▸'}</span>
              {tt('previewTitle')}
              <div className="wcb-head-actions">
                {state.previewOpen ? <button type="button" className="wcb-linkbtn" aria-label={tt('previewCopy')} disabled={state.previewText === ''} onClick={(event) => { event.stopPropagation(); state.copyPreview() }}>{tt('previewCopy')}</button> : null}
              </div>
            </div>
            {state.previewOpen ? (
              <div className="wcb-card-body">
                {state.previewText === '' ? (
                  <div className="wcb-hint">{tt('previewEmpty')}</div>
                ) : (
                  <>
                    {state.previewLoading ? <div className="wcb-hint">{tt('previewLoading')}</div> : null}
                    <pre className="wcb-preview" tabIndex={0} aria-label={tt('previewTitle')}>{state.previewText}</pre>
                  </>
                )}
              </div>
            ) : null}
          </section>
        </div>

        {/* --- 右栏：项目目录 + 上下文预算（7:30 固定比例，可拖拽调整） --- */}
        <div className="wcb-right-col" ref={rightColRef}>
          {/* 项目目录区 */}
          <section className="wcb-card wcb-card-grow" style={{ flex: splitRatio + ' 1 0' }}>
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

          {/* 可拖拽分隔条：调整「项目目录 : 上下文预算」高度比例 */}
          <div
            className="wcb-splitter"
            role="separator"
            aria-orientation="horizontal"
            aria-label={tt('splitterLabel')}
            aria-valuenow={Math.round(splitRatio * 100)}
            aria-valuemin={10}
            aria-valuemax={90}
            tabIndex={0}
            title={tt('splitterHint')}
            onMouseDown={startSplitDrag}
            onDoubleClick={() => setSplitRatio(0.6)}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 0.05 : 0.02
              if (event.key === 'ArrowUp') { event.preventDefault(); setSplitRatio(v => Math.max(0.1, v - step)) }
              else if (event.key === 'ArrowDown') { event.preventDefault(); setSplitRatio(v => Math.min(0.9, v + step)) }
              else if (event.key === 'Home') { event.preventDefault(); setSplitRatio(0.6) }
            }}
          >
            <span className="wcb-splitter-grip" aria-hidden="true" />
          </div>
          {/* 上下文预算（环形图 + 统计卡片 / 分目录用量柱状图） */}
          <section className="wcb-card" style={{ flex: (1 - splitRatio) + ' 1 0' }}>
            <div className="wcb-card-head">
              {tt('budgetTitle')}
              <div className="wcb-head-actions">
                <span className="wcb-label" style={{ margin: 0 }}>{tt('budgetLimit')}</span>
                <input
                  className="wcb-budget-input"
                  type="number"
                  min={1}
                  value={budget}
                  aria-label={tt('budgetLimit')}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => state.setTokenBudget(Number(event.currentTarget.value))}
                />
                <button type="button" className="wcb-linkbtn" aria-label={tt('monitorRefresh')} onClick={state.refreshContextStats}>{'↻ ' + tt('monitorRefresh')}</button>
              </div>
            </div>
            {state.contextStats === null ? (
              <div className="wcb-card-body"><div className="wcb-hint">{tt('monitorLoading')}</div></div>
            ) : (
              <div className="wcb-budget-split">
                {/* 左：环形图 + 总览 + 2x2统计卡片 */}
                <div className="wcb-budget-left">
                  <div className="wcb-budget-overview">
                    <Donut percentage={ratio} size={56} strokeWidth={5} color={ratio > 1 ? '#f85149' : ratio > 0.8 ? '#d4a017' : '#4f8cff'} />
                    <div>
                      <div className="wcb-budget-total">{kmTokens(total)}</div>
                      <div className="wcb-budget-of">/ {kmTokens(budget)} token</div>
                      {ratio <= 1 ? <div className="wcb-budget-remain">{tt('budgetRemain', { remain: kmTokens(Math.max(0, budget - total)) })}</div> : null}
                    </div>
                  </div>
                  {ratio > 1 ? <div className="wcb-alert wcb-alert-over">{tt('budgetOver')}</div> : ratio > 0.8 ? <div className="wcb-alert">{tt('budgetWarn')}</div> : null}
                  <div className="wcb-stat-grid">
                    <div className="wcb-stat-card">
                      <div className="wcb-stat-label">{tt('statFiles')}</div>
                      <div className="wcb-stat-value">{state.contextStats.totalFiles}</div>
                    </div>
                    <div className="wcb-stat-card">
                      <div className="wcb-stat-label">{tt('statDirs')}</div>
                      <div className="wcb-stat-value">{state.contextStats.totalDirs}</div>
                    </div>
                    <div className="wcb-stat-card">
                      <div className="wcb-stat-label">{tt('statIndex')}</div>
                      <div className="wcb-stat-value-sm">{kmTokens(state.contextStats.fileIndexTokens)}</div>
                    </div>
                    <div className="wcb-stat-card">
                      <div className="wcb-stat-label">{tt('statOverhead')}</div>
                      <div className="wcb-stat-value-sm">{kmTokens(state.contextStats.promptOverheadTokens)}</div>
                    </div>
                  </div>
                </div>
                {/* 右：分目录用量柱状图 */}
                <div className="wcb-budget-right">
                  <div className="wcb-dir-usage-title">{tt('dirUsageTitle')}</div>
                  {activeDirs.length === 0 ? <div className="wcb-hint">{tt('monitorLoading')}</div> : null}
                  {activeDirs.length > 0 ? (
                    <div className="wcb-bars" role="img" aria-label={tt('dirUsageTitle')}>
                      <div className="wcb-bars-grid" aria-hidden="true">
                        {[0, 1, 2, 3].map(i => <div className="wcb-bars-gridline" key={i} />)}
                      </div>
                      {activeDirs.map(d => {
                        const idx = state.dirs.findIndex(x => x.path === d.path)
                        const ref = state.dirs.find(x => x.path === d.path)
                        const color = dirColor(idx, ref?.group, ref?.projectType)
                        const pct = maxDirTokens > 0 ? d.tokens / maxDirTokens : 0
                        const h = d.tokens > 0 ? Math.max(4, Math.round(pct * 100)) : 2
                        return (
                          <div className="wcb-bar-col" key={d.path} title={d.name + ' · ' + d.tokens.toLocaleString() + ' ' + tt('monitorTokens')}>
                            <span className="wcb-bar-val">{kmTokens(d.tokens)}</span>
                            <div className="wcb-bar-track">
                              <div className="wcb-bar-fill-v" style={{ height: h + '%', background: color }} />
                            </div>
                            <span className="wcb-bar-name">{d.name}</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
            <div className="wcb-hint" style={{ padding: '6px 12px 9px', borderTop: '1px solid var(--wcb-line)' }}>{tt('warning')}</div>
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
    </div>
  )
}