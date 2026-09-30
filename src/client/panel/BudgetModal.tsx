/**
 * 上下文预算弹窗：环形总览（估算）+ 真实消耗块（provider 上报）+ 单行统计卡 +
 * 逐目录横向条形图（可滚动）+ 预算与刷新。从右栏移入左栏「更多」入口。
 *
 * 「估算」和「真实」并排显示是有意的：估算值告诉你预算分配是否合理，真实值告诉你
 * 到底花了多少、缓存命中多少。二者差值大说明估算模型需要修正。
 * @module dsh-workspace-combiner/client/panel/BudgetModal
 */

import { useEffect, type ChangeEvent, type ReactElement } from 'react'
import type { ContextPreset, ContextStats, ProjectType, TokenUsageReport, WorkspaceRef } from '../../core/types.ts'
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

/** 百分比展示（0~1；null 显示 —）。 */
function pct(value: number | null): string {
  return value === null ? '—' : Math.round(value * 100) + '%'
}

/** 真实消耗块：provider 上报的用量 + 插件注入占比。与上方估算值对照看。 */
function RealUsage({ usage, injected }: { usage: TokenUsageReport | null; injected: number }): ReactElement {
  if (usage === null || (usage.totals.steps === 0 && usage.latest === null)) {
    return (
      <div className="wcb-usage-block">
        <div className="wcb-dir-usage-title">{tt('usageTitle')}</div>
        <div className="wcb-hint">{tt('usageNoData')}</div>
      </div>
    )
  }
  const t = usage.totals
  const latest = usage.latest
  const window = latest?.contextWindow
  const pressure = latest?.promptTokens ?? 0
  const occupancy = window !== undefined && window > 0 ? pressure / window : null
  const share = latest !== null && latest.promptTokens > 0 ? injected / latest.promptTokens : null
  return (
    <div className="wcb-usage-block">
      <div className="wcb-dir-usage-title">
        {tt('usageTitle')}
        <span className="wcb-usage-sessions">{tt('usageSessions', { n: String(usage.sessions) })}</span>
      </div>
      <div className="wcb-stat-grid">
        <div className="wcb-stat-card">
          <div className="wcb-stat-label">{tt('usageInput')}</div>
          <div className="wcb-stat-value-sm">{kmTokens(t.inputTokens)}</div>
        </div>
        <div className="wcb-stat-card">
          <div className="wcb-stat-label">{tt('usageCacheRead')}</div>
          <div className="wcb-stat-value-sm">{kmTokens(t.cacheReadTokens)}</div>
        </div>
        <div className="wcb-stat-card">
          <div className="wcb-stat-label">{tt('usageCacheWrite')}</div>
          <div className="wcb-stat-value-sm">{kmTokens(t.cacheWriteTokens)}</div>
        </div>
        <div className="wcb-stat-card">
          <div className="wcb-stat-label">{tt('usageOutput')}</div>
          <div className="wcb-stat-value-sm">{kmTokens(t.outputTokens)}</div>
        </div>
        <div className="wcb-stat-card">
          <div className="wcb-stat-label">{tt('usageHitRate')}</div>
          <div className="wcb-stat-value-sm">{pct(t.cacheHitRate)}</div>
        </div>
        <div className="wcb-stat-card">
          <div className="wcb-stat-label">{tt('usagePluginShare')}</div>
          <div className="wcb-stat-value-sm">{pct(share)}</div>
        </div>
      </div>
      {window !== undefined && window > 0 ? (
        <>
          <div className="wcb-usage-ctx-row">
            <span className="wcb-usage-ctx-label">{tt('usageContext')}</span>
            <span className="wcb-usage-ctx-val">{kmTokens(pressure) + ' / ' + kmTokens(window)}</span>
          </div>
          <div className="wcb-bar-track-h">
            <div className="wcb-bar-fill-h" style={{ width: Math.max(1, Math.round((occupancy ?? 0) * 100)) + '%', background: (occupancy ?? 0) > 0.9 ? '#f85149' : (occupancy ?? 0) > 0.7 ? '#d4a017' : '#4f8cff' }} />
          </div>
        </>
      ) : null}
      <div className="wcb-hint">{tt('usageHint')}</div>
    </div>
  )
}

interface BudgetModalProps {
  stats: ContextStats | null
  preset: ContextPreset
  budget: number
  fileIndexBudget: number
  codeIndexBudget: number
  standardsBudget: number
  commandsBudget: number
  dirs: readonly WorkspaceRef[]
  usage: TokenUsageReport | null
  onPreset(value: ContextPreset): void
  onBudget(value: number): void
  onFileIndexBudget(value: number): void
  onCodeIndexBudget(value: number): void
  onStandardsBudget(value: number): void
  onCommandsBudget(value: number): void
  onRefresh(): void
  onClose(): void
}

export function BudgetModal({ stats, preset, budget, fileIndexBudget, codeIndexBudget, standardsBudget, commandsBudget, dirs, usage, onPreset, onBudget, onFileIndexBudget, onCodeIndexBudget, onStandardsBudget, onCommandsBudget, onRefresh, onClose }: BudgetModalProps): ReactElement {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const total = (stats?.fileIndexTokens ?? 0) + (stats?.promptOverheadTokens ?? 0) + (stats?.standardsTokens ?? 0)
    + (stats?.codeIndexTokens ?? 0) + (stats?.commandsTokens ?? 0)
  const ratio = budget > 0 ? total / budget : 0
  const activeDirs = (stats?.directories ?? []).filter(d => d.access !== 'disabled')
  const maxDirTokens = Math.max(1, ...(stats?.directories ?? []).map(d => d.tokens))

  return (
    <div className="wcb-overlay" onClick={onClose}>
      <div className="wcb-modal wcb-modal-wide wcb-budget-modal" role="dialog" aria-modal="true" aria-label={tt('budgetTitle')} onClick={(event) => event.stopPropagation()}>
        <div className="wcb-modal-title">{tt('budgetTitle')}</div>

        <div className="wcb-tabs" role="tablist" aria-label={tt('contextPresetLabel')}>
          {([['economy', tt('contextPresetEconomy')], ['balanced', tt('contextPresetBalanced')], ['deep', tt('contextPresetDeep')], ['custom', tt('contextPresetCustom')]] as Array<[ContextPreset, string]>).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={preset === value} className={'wcb-tab' + (preset === value ? ' wcb-tab-on' : '')} onClick={() => onPreset(value)}>{label}</button>
          ))}
        </div>
        <div className="wcb-hint">{tt('contextPresetHint')}</div>

        <div className="wcb-std-toolbar">
          <div className="wcb-head-actions">
            <span className="wcb-label" style={{ margin: 0 }}>{tt('budgetLimit')}</span>
            <input className="wcb-budget-input" type="number" min={1} value={budget} aria-label={tt('budgetLimit')} onChange={(event: ChangeEvent<HTMLInputElement>) => onBudget(Number(event.currentTarget.value))} />
            <button type="button" className="wcb-linkbtn" aria-label={tt('monitorRefresh')} onClick={onRefresh}>{'↻ ' + tt('monitorRefresh')}</button>
          </div>
        </div>

        {preset === 'custom' ? (
          <div className="wcb-stat-grid">
            {([
              [tt('budgetFileIndex'), fileIndexBudget, onFileIndexBudget],
              [tt('budgetCodeIndex'), codeIndexBudget, onCodeIndexBudget],
              [tt('budgetStandards'), standardsBudget, onStandardsBudget],
              [tt('budgetCommands'), commandsBudget, onCommandsBudget],
            ] as Array<[string, number, (value: number) => void]>).map(([label, value, update]) => (
              <label className="wcb-stat-card" key={label}>
                <span className="wcb-stat-label">{label}</span>
                <input className="wcb-budget-input" type="number" min={0} value={value} aria-label={label} onChange={(event: ChangeEvent<HTMLInputElement>) => update(Number(event.currentTarget.value))} />
              </label>
            ))}
          </div>
        ) : null}

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
              {stats.degradations.length > 0 ? (
                <div className="wcb-alert">
                  <strong>{tt('budgetDegraded')}</strong>
                  {' ' + stats.degradations.map(item => tt(item === 'file-index-truncated' ? 'budgetDegradeFile' : item === 'code-index-truncated' ? 'budgetDegradeCode' : item === 'commands-truncated' ? 'budgetDegradeCommands' : item === 'standards-truncated' ? 'budgetDegradeStandards' : 'budgetDegradeAi')).join('；')}
                </div>
              ) : null}
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
                <div className="wcb-stat-card">
                  <div className="wcb-stat-label">{tt('statCodeIndex')}</div>
                  <div className="wcb-stat-value-sm">{kmTokens(stats.codeIndexTokens)}</div>
                </div>
                <div className="wcb-stat-card">
                  <div className="wcb-stat-label">{tt('statCommands')}</div>
                  <div className="wcb-stat-value-sm">{kmTokens(stats.commandsTokens)}</div>
                </div>
              </div>
              <RealUsage usage={usage} injected={total} />
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
