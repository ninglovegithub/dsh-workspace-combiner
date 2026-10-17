/**
 * 预算档位选择器：一个紧凑按钮 + 点开的小弹窗。
 *
 * 侧栏很窄，把「按需 │ 精简 │ 标准 │ 详细」四个按钮直接铺在卡片头上既挤又丑；
 * 日常 99% 的时间只看当前档位，所以默认只显示 `标准 · 800 ▾`，点开才列出四个
 * 选项并解释每个档位意味着什么（token 数也放在那里）。
 *
 * 上下文预算弹窗、开发规范弹窗、功能索引卡三处共用。
 *
 * @module dsh-workspace-combiner/client/panel/BudgetLevelPicker
 */

import { useState, type ReactElement } from 'react'
import { matchBudgetLevel, tokensOfLevel, type BudgetBlock, type BudgetLevel } from '../../core/budgetLevels.ts'
import { tt } from '../locales.ts'
import { Dialog } from './Dialog.tsx'
import { kmTokens, tokenText } from './tokenFormat.ts'

/** 四个档位，由"不注入"到"最详细"。 */
const OPTIONS: readonly BudgetLevel[] = ['off', 'compact', 'standard', 'detailed']

/** 档位 -> 名称文案 key。 */
const LABEL: Record<BudgetLevel, 'budgetModeOff' | 'budgetLevelCompact' | 'budgetLevelStandard' | 'budgetLevelDetailed'> = {
  off: 'budgetModeOff',
  compact: 'budgetLevelCompact',
  standard: 'budgetLevelStandard',
  detailed: 'budgetLevelDetailed',
}

interface BudgetLevelPickerProps {
  /** 受控区块（决定三档对应的 token 值）。 */
  block: BudgetBlock
  /** 当前预算（token）；<= 0 表示按需。 */
  value: number
  /** 选择某个档位后的新 token 值（`按需` 为 0）。 */
  onChange(value: number): void
  /** 禁用（例如功能索引整体关闭时）。 */
  disabled?: boolean
  /** 弹窗标题（缺省「预算密度」）。 */
  title?: string
}

/**
 * 档位按钮 + 选择弹窗。
 * @param props - 区块、当前值、变更回调。
 * @returns 选择器元素。
 */
export function BudgetLevelPicker({ block, value, onChange, disabled = false, title }: BudgetLevelPickerProps): ReactElement {
  const [open, setOpen] = useState(false)
  const match = matchBudgetLevel(block, value)
  const off = match.level === 'off'
  const pick = (level: BudgetLevel): void => {
    onChange(tokensOfLevel(block, level))
    setOpen(false)
  }
  return (
    <>
      <button type="button" className="wcb-level-btn" disabled={disabled}
        aria-haspopup="dialog" aria-expanded={open}
        aria-label={tt('budgetPickerLabel')}
        onClick={() => setOpen(true)}>
        <span className={'wcb-level-btn-name' + (off ? ' is-off' : '')}>{tt(LABEL[match.level])}</span>
        {off ? null : <span className="wcb-level-btn-tokens">{tokenText(value)}</span>}
        <span className="wcb-level-btn-caret" aria-hidden="true">▾</span>
      </button>
      {open ? (
        <Dialog title={title ?? tt('budgetDensity')} onClose={() => setOpen(false)}>
          <div className="wcb-level-options" role="radiogroup" aria-label={tt('budgetDensity')}>
            {OPTIONS.map(level => {
              const active = match.level === level
              return (
                <button key={level} type="button" role="radio" aria-checked={active}
                  className={'wcb-level-option' + (active ? ' is-on' : '')}
                  onClick={() => pick(level)}>
                  <span className={'wcb-level-dot' + (active ? ' is-on' : '')} aria-hidden="true" />
                  <span className="wcb-level-option-text">
                    <span className="wcb-level-option-name">
                      {tt(LABEL[level])}
                      {level === 'off' ? null : <span className="wcb-level-option-tokens">{'约 ' + tokenText(tokensOfLevel(block, level))}</span>}
                    </span>
                    <span className="wcb-level-option-desc">{tt(level === 'off' ? 'budgetLevelOffDesc' : 'budgetLevelTokensDesc')}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <div className="wcb-level-hints">
            <div className="wcb-hint wcb-level-hint">{tt('budgetHintResident')}</div>
            <div className="wcb-hint wcb-level-hint">{tt('budgetHintOnDemand')}</div>
          </div>
          <div className="wcb-modal-actions">
            <button type="button" className="wcb-btn-plain" aria-label={tt('cancel')} onClick={() => setOpen(false)}>{tt('cancel')}</button>
          </div>
        </Dialog>
      ) : null}
    </>
  )
}
