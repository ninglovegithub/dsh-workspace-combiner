/**
 * dsh-workspace-combiner — client（浏览器）半面。
 *
 * 通过现代 slots 机制注册：
 *   1. sidebar.panellist 图标（id = PANEL_ID，与 main 的 key 同名）。
 *   2. main 面板 body（key = PANEL_ID）。
 *
 * 面板管理自定义工作空间（每个绑定主目录 + 只读参考目录），新建会话时对主目录
 * get-or-create 工作区并永远新建独立会话，其余目录作为只读仓库注入 prompt + 沙盒白名单。
 *
 * 挂载失败只告警不抛出：web shell 会因插件 apply 抛错而整体启动失败。
 * @module dsh-workspace-combiner/client
 */

import type { ClientCtx } from './types.ts'
import { en, zh } from './locales.ts'
import { WorkspaceCombinerIcon, WorkspaceCombinerPanel } from './panel/WorkspaceCombinerPanel.tsx'
import { PANEL_ID } from '../invariant.ts'

/** 本插件拥有的 locale 命名空间。 */
const NS = 'dsh-workspace-combiner'

/** client fiber 需要的服务（slots 插槽、locale 词典、sessions 新建会话、workspaces get-or-create、remote.directoryPicker 选目录）。 */
export const inject = ['slots', 'locale', 'sessions', 'workspaces', 'remote', 'remote.directoryPicker']

/**
 * 挂载词典 + 侧边栏图标 + 中心列面板。
 * @param ctx - client 根上下文（slots / locale / sessions / remote）。
 */
export function apply(ctx: ClientCtx): void {
  // 词典注册（幂等；注册 bump revision 让已挂载出口拾取晚到词典）。
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-workspace-combiner: dictionaries')

  // 新建会话动作：主目录 get-or-create 工作区（ctx.workspaces.create 按路径复用或
  // 注册），再 ctx.sessions.create({ workspaceId }) 永远创建独立新会话并 open。
  // 注册时闭包注入，组件不直接依赖 sessions/workspaces 服务，保持 props 面向标准插槽契约。
  // 标题去重：与已有会话的持久标题冲突时追加「(n)」序号。
  const takenTitles = (): Set<string> => {
    const set = new Set<string>()
    try {
      const snapshot = ctx.sessions.list.getSnapshot()
      for (const id of snapshot.ids) {
        const title = snapshot.byId[id]?.title
        if (typeof title === 'string' && title !== '') set.add(title)
      }
    } catch {
      // 读取失败时不去重，直接使用原名（去重是尽力而为）。
    }
    return set
  }
  const dedupeTitle = (name: string): string => {
    const taken = takenTitles()
    if (!taken.has(name)) return name
    let i = 2
    while (taken.has(`${name} (${i})`)) i++
    return `${name} (${i})`
  }

  // 新建会话动作：主目录 get-or-create 工作区（按路径复用/注册），再
  // ctx.sessions.create({ workspaceId }) 永远创建独立新会话并 open；加载模板时
  // 以模板名命名（rename 走投影 title，失败/空名不影响打开）。
  const startSession = async (mainDirPath: string, title?: string): Promise<string> => {
    const workspace = await ctx.workspaces.create({ path: mainDirPath })
    const sessionId = await ctx.sessions.create({ workspaceId: workspace.workspaceId })
    const name = title?.trim()
    if (name !== undefined && name !== '') {
      const finalName = dedupeTitle(name)
      const binding = ctx.sessions.binding(sessionId)
      if (binding !== undefined) {
        const renamed = await binding.session.rename(finalName).catch(() => undefined)
        if (renamed !== undefined && !renamed.ok) {
          console.warn(`[dsh-workspace-combiner] 会话改名失败: ${sessionId}`)
        }
      }
    }
    ctx.sessions.open(sessionId)
    return sessionId
  }

  // 选择目录动作（ctx.remote.directoryPicker.pick）：宿主原生目录选择器。
  const pickDirectory = async (): Promise<string | null> => {
    const result = await ctx.remote.directoryPicker.pick()
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }

  // 把主项目目录注册为 DSH 左侧「工作区」列表项（get-or-create；官方 API，会刷新左侧栏）。
  const registerDshWorkspace = async (path: string): Promise<void> => {
    if (path === '') return
    await ctx.workspaces.create({ path }).catch(() => {})
  }

  // 侧边栏图标：sidebar.panellist（list 插槽）——id 与 main 的 key 对齐。
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
    { name: 'sidebar.panellist', id: PANEL_ID, order: 100, label: () => '工作区组合器' },
    WorkspaceCombinerIcon,
  ))

  // 当前会话总数（会话占用回显；读取失败时回退 0）。
  const sessionCount = (): number => {
    try {
      return ctx.sessions.list.getSnapshot().ids.length
    } catch {
      return 0
    }
  }

  // 中心列面板 body：main（keyed 插槽）——选中图标时由布局以 entryKey 渲染。
  ctx.slots.inject('main', () => ctx.slots.register(
    { name: 'main', key: PANEL_ID },
    () => WorkspaceCombinerPanel({ startSession, pickDirectory, registerDshWorkspace, sessionCount: sessionCount() }),
  ))
}
