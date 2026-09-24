/**
 * dsh-workspace-combiner — client（浏览器）半面。
 *
 * 通过现代 slots 机制（0.1.5-rc.2 的 sidebar.panellist + main）注册：
 *   1. sidebar.panellist 图标（id = PANEL_ID，与 main 的 key 同名，侧边栏据此
 *      在选中时把中心列切到本面板）——与「多根」插件等全局面板并排。
 *   2. main 面板 body（key = PANEL_ID）。
 *
 * 挂载失败只告警不抛出：web shell 会因插件 apply 抛错而整体启动失败。
 * @module dsh-workspace-combiner/client
 */

import type { ClientCtx, PanelStandardProps } from './types.ts'
import { en, zh } from './locales.ts'
import { WorkspaceCombinerIcon, WorkspaceCombinerPanel } from './panel/WorkspaceCombinerPanel.tsx'
import { PANEL_ID } from '../invariant.ts'

/** 本插件拥有的 locale 命名空间。 */
const NS = 'dsh-workspace-combiner'

/** client fiber 需要的服务（slots 插槽入口、locale 词典、sessions 新建会话）。 */
export const inject = ['slots', 'locale', 'sessions']

/**
 * 挂载词典 + 侧边栏图标 + 中心列面板。
 * @param ctx - client 根上下文（slots / locale / sessions）。
 */
export function apply(ctx: ClientCtx): void {
  // 词典注册（幂等；注册 bump revision 让已挂载出口拾取晚到词典）。
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-workspace-combiner: dictionaries')

  // 新建会话动作（ctx.sessions.create + open）。注册时闭包注入，组件不直接
  // 依赖 sessions 服务，保持 props 面向标准插槽契约。
  const startSession = async (workspaceId: string): Promise<void> => {
    const sessionId = await ctx.sessions.create({ workspaceId })
    ctx.sessions.open(sessionId)
  }

  // 侧边栏图标：sidebar.panellist（list 插槽）——id 与 main 的 key 对齐。
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
    { name: 'sidebar.panellist', id: PANEL_ID, order: 100, label: () => '工作区组合器' },
    WorkspaceCombinerIcon,
  ))

  // 中心列面板 body：main（keyed 插槽）——选中图标时由布局以 entryKey 渲染。
  ctx.slots.inject('main', () => ctx.slots.register(
    { name: 'main', key: PANEL_ID },
    (props: PanelStandardProps) => WorkspaceCombinerPanel({ ...props, startSession }),
  ))
}
