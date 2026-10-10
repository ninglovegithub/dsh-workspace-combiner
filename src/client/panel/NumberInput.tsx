/**
 * 数字输入：编辑期间保留用户原始字符串，只在失焦/回车时提交。
 *
 * 直接绑 `value={budget}` + `onChange(Number(v))` 的问题是清空输入框会立刻变成
 * `Number('') === 0`，预算被当场重置（token 预算还会跳回默认值），用户没法自然
 * 地清空重输。这里用本地草稿把「输入过程」和「提交值」分开。
 * @module dsh-workspace-combiner/client/panel/NumberInput
 */

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactElement } from 'react'

interface NumberInputProps {
  /** 当前生效值。 */
  value: number
  /** 失焦/回车时的提交回调。 */
  onCommit(value: number): void
  /** 可访问名称。 */
  label: string
  className?: string
  title?: string
  min?: number
  disabled?: boolean
  /** 输入为空/非法时提交的值（缺省 0）。 */
  emptyValue?: number
}

/**
 * 数字输入框。
 * @param props - 生效值、提交回调、标签与取值范围。
 */
export function NumberInput({ value, onCommit, label, className, title, min, disabled, emptyValue = 0 }: NumberInputProps): ReactElement {
  const [draft, setDraft] = useState<string>(String(value))
  const editing = useRef(false)

  // 外部值变化（切预设/切工作空间）时同步草稿；正在输入时不打断用户。
  useEffect(() => {
    if (!editing.current) setDraft(String(value))
  }, [value])

  const commit = (): void => {
    editing.current = false
    const trimmed = draft.trim()
    const parsed = trimmed === '' ? Number.NaN : Number(trimmed)
    const next = Number.isFinite(parsed) ? Math.round(parsed) : emptyValue
    setDraft(String(next))
    onCommit(next)
  }

  return (
    <input
      type="number"
      className={className ?? 'wcb-budget-input'}
      value={draft}
      min={min}
      disabled={disabled}
      title={title}
      aria-label={label}
      onFocus={() => { editing.current = true }}
      onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit()
        }
      }}
    />
  )
}
