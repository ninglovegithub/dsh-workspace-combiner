/**
 * 弹窗外壳：统一处理 Esc 关闭、点击遮罩关闭、焦点陷阱与焦点还原。
 *
 * 现存三个反复出现的缺陷都在这里一次性解决：
 *   1. `onClick={onClose}` 不校验按下起点——在输入框里拖选文本后松手到遮罩上会
 *      触发 click（target 是公共祖先遮罩）而误关弹窗、丢弃草稿。这里改成
 *      `onMouseDown` 且要求 target 就是遮罩本身。
 *   2. 挂载时无条件 `container.focus()` 会把子元素 `autoFocus` 的输入框焦点抢走。
 *      这里只在弹窗内部还没有焦点时才兜底聚焦。
 *   3. 无焦点陷阱：Tab 会跑到遮罩背后；关闭后焦点也不回到触发按钮。
 * @module dsh-workspace-combiner/client/panel/Dialog
 */

import { useEffect, useRef, type ReactElement, type ReactNode } from 'react'

/** 可聚焦元素选择器（焦点陷阱用）。 */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

interface DialogProps {
  /** 弹窗标题（同时作为 aria-label）。 */
  title: string
  /** 关闭回调（Esc / 遮罩 / 调用方按钮）。 */
  onClose: () => void
  /** 宽版弹窗。 */
  wide?: boolean
  /** 追加到 `.wcb-modal` 上的类名（各弹窗自己的布局类）。 */
  className?: string
  children: ReactNode
}

/**
 * 通用弹窗外壳。
 * @param props - 标题、关闭回调、宽度与子节点。
 */
export function Dialog({ title, onClose, wide, className, children }: DialogProps): ReactElement {
  const ref = useRef<HTMLDivElement | null>(null)

  // Esc 关闭 + Tab 焦点陷阱 + 关闭时把焦点还给打开弹窗的元素。
  useEffect(() => {
    const node = ref.current
    if (node === null) return
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // 子元素的 autoFocus 已经生效时不要抢焦点（effect 晚于 autoFocus 的 commit）。
    if (!node.contains(document.activeElement)) node.focus()

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusables = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusables.length === 0) {
        event.preventDefault()
        node.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (first === undefined || last === undefined) return
      const active = document.activeElement
      if (!event.shiftKey && (active === last || !node.contains(active))) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && (active === first || !node.contains(active))) {
        event.preventDefault()
        last.focus()
      }
    }
    node.addEventListener('keydown', onKeyDown)
    return () => {
      node.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
  }, [onClose])

  return (
    <div
      className="wcb-overlay"
      // 只有按下起点就是遮罩本身才关闭：否则拖选文本/拖动滑杆会误关并丢草稿。
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className={'wcb-modal' + (wide === true ? ' wcb-modal-wide' : '') + (className === undefined ? '' : ' ' + className)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="wcb-modal-title">{title}</div>
        {children}
      </div>
    </div>
  )
}
