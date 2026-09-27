/**
 * 上下文预算弹窗：环形总览 + 单行统计卡 + 逐目录横向条形图（可滚动）+ 预算与刷新。
 * 从右栏移入左栏「更多」入口，避免长期占用右栏高度。
 * @module dsh-workspace-combiner/client/panel/BudgetModal
 */

import { useEffect, type ChangeEvent, type ReactElement } from 'react'
import type { ContextStats, ProjectType, WorkspaceRef } from '../../core/types.ts'
import { tt } from '../locales.ts'

/** 千分位 token 简写（36200 -> 36.2k）。 */
function kmTokens(n: number): string {
  if (n < 1000) return String(n)
  return (n / 1000).toFixed(1) + 'k'
}

/** 目录索引 -> 条形图颜色。 */
function dirColor(index: number, group: string | undefined, type: ProjectType | undefined): string {
  if (index === 0) return '#d4a017'
  if (group === tt('groupBackend') || type === 'java' || type === 'python' || type === 'go') return '#8b5cf6'
  if (group === tt('groupFrontend') || type === 'frontend' || type === 'frontend-vue' || type === 'frontend-react' || type === 'frontend-webpack' || type === 'frontend-next') return '#3b82f6'
  if (group === tt('groupRef')) return '#2aa8b4'
  if (group === tt('groupDoc')) return '#d4a017'
  return '#8b949e'
}

/** 环形进度图：SVG donut，中间显示百分比。 */
function Donut({ percentage, size = 44, strokeWidth = 4, color = '#4f8cff' }: {
  percentage: number; size?: number; strokeWidth?: number; color?: string;
}): ReactElement {
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const pct = Math.min(1, Math.max(0, percentage))
  const offset = circumference * (1 - pct)
  return (
    <div className="wcb-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={'0 0 ' + size + ' ' + size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={strokeWidth} />
        {pct > 0.001 ? (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            transform={'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'} />
        ) : null}
        <text className="wcb-donut-center" x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
          style={{ fontSize: size / 4.2 }}>{Math.round(pct * 100) + '%'}</text>
      </svg>
    </div>
  )
}

interface BudgetModalProps {
  stats: ContextStats | null
  budget: number
  dirs: readonly WorkspaceRef[]
  onBudget(value: number): void
  onRefresh(): void
  onClose(): void
}

export function BudgetModal({ stats, budget, dirs, onBudget, onRefresh, onClose }: BudgetModalProps): ReactElement {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const total = (stats?.fileIndexTokens ?? 0) + (stats?.promptOverheadTokens ?? 0) + (stats?.standardsTokens ?? 0)
  const ratio = budget > 0 ? total / budget : 0
  const activeDirs = (stats?.directories ?? []).filter(d => d.access !== 'disabled')
  const maxDirTokens = Math.max(1, ...(stats?.directories ?? []).map(d => d.tokens))

  return (
    <div className="wcb-overlay" onClick={onClose}>
      <div className="wcb-modal wcb-modal-wide wcb-budget-modal" role="dialog" aria-modal="true" aria-label={tt('budgetTitle')} onClick={(event) => event.stopPropagation()}>
        <div className="wcb-modal-title">{tt('budgetTitle')}</div>

        <div className="wcb-std-toolbar">
          <div className="wcb-head-actions">
            <span className="wcb-label" style={{ margin: 0 }}>{tt('budgetLimit')}</span>
            <input className="wcb-budget-input" type="number" min={1} value={budget} aria-label={tt('budgetLimit')} onChange={(event: ChangeEvent<HTMLInputElement>) => onBudget(Number(event.currentTarget.value))} />
            <button type="button" className="wcb-linkbtn" aria-label={tt('monitorRefresh')} onClick={onRefresh}>{'↻ ' + tt('monitorRefresh')}</button>
          </div>
        </div>

        <div className="wcb-modal-body wcb-budget-body">
          {stats === null ? (
            <div className="wcb-hint">{tt('monitorLoading')}</div>
          ) : (
            <>
              <div className="wcb-budget-overview">
                <Donut percentage={ratio} color={ratio > 1 ? '#f85149' : ratio > 0.8 ? '#d4a017' : '#4f8cff'} />
                <div className="wcb-budget-figures">
                  <span className="wcb-budget-total">{kmTokens(total)}</span>
                  <span className="wcb-budget-of">/ {kmTokens(budget)} token</span>
                  {ratio <= 1 ? <span className="wcb-budget-remain">{tt('budgetRemain', { remain: kmTokens(Math.max(0, budget - total)) })}</span> : null}
                </div>
              </div>
              {ratio > 1 ? <div className="wcb-alert wcb-alert-over">{tt('budgetOver')}</div> : ratio > 0.8 ? <div className="wcb-alert">{tt('budgetWarn')}</div> : null}
              <div className="wcb-stat-grid">
                <div className="wcb-stat-card">
                  <div className="wcb-stat-label">{tt('statFiles')}</div>
                  <div className="wcb-stat-value">{stats.totalFiles}</div>
                </div>
                <div className="wcb-stat-card">
                  <div className="wcb-stat-label">{tt('statDirs')}</div>
                  <div className="wcb-stat-value">{stats.totalDirs}</div>
                </div>
                <div className="wcb-stat-card">
                  <div className="wcb-stat-label">{tt('statIndex')}</div>
                  <div className="wcb-stat-value-sm">{kmTokens(stats.fileIndexTokens)}</div>
                </div>
                <div className="wcb-stat-card">
                  <div className="wcb-stat-label">{tt('statOverhead')}</div>
                  <div className="wcb-stat-value-sm">{kmTokens(stats.promptOverheadTokens)}</div>
                </div>
                <div className="wcb-stat-card">
                  <div className="wcb-stat-label">{tt('statStandards')}</div>
                  <div className="wcb-stat-value-sm">{kmTokens(stats.standardsTokens)}</div>
                </div>
              </div>
              <div className="wcb-dir-usage-title">{tt('dirUsageTitle')}</div>
              {activeDirs.length === 0 ? <div className="wcb-hint">{tt('monitorLoading')}</div> : (
                <div className="wcb-bars" role="list" aria-label={tt('dirUsageTitle')}>
                  {activeDirs.map(d => {
                    const idx = dirs.findIndex(x => x.path === d.path)
                    const ref = dirs.find(x => x.path === d.path)
                    const color = dirColor(idx, ref?.group, ref?.projectType)
                    const pct = maxDirTokens > 0 ? d.tokens / maxDirTokens : 0
                    const w = d.tokens > 0 ? Math.max(3, Math.round(pct * 100)) : 1
                    return (
                      <div className="wcb-bar-row" role="listitem" key={d.path} title={d.name + ' · ' + d.tokens.toLocaleString() + ' ' + tt('monitorTokens')}>
                        <span className="wcb-bar-name">{d.name}</span>
                        <div className="wcb-bar-track-h">
                          <div className="wcb-bar-fill-h" style={{ width: w + '%', background: color }} />
                        </div>
                        <span className="wcb-bar-val">{kmTokens(d.tokens)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="wcb-hint">{tt('warning')}</div>
            </>
          )}
        </div>

        <div className="wcb-modal-actions">
          <button type="button" className="wcb-btn-plain" aria-label={tt('cancel')} onClick={onClose}>{tt('cancel')}</button>
        </div>
      </div>
    </div>
  )
}
