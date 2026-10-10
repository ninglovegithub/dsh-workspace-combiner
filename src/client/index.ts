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
 * DSH 0.2.0-rc.2 API 要点（改这里的代码前先读 client/types.ts 的镜像类型）：
 *   - `ctx.sessions.list` 是 SnapshotStore（对象），读目录用 `.getSnapshot()`；
 *   - `ctx.sessions.create(opts)` 是 async，返回会话 id；
 *   - 改会话标题用 `ctx.sessions.binding(id).session.rename(title)`；
 *   - `ctx.workspaces.create({ path })` 返回 `{ workspaceId, … }`。
 *
 * 挂载失败只告警不抛出：web shell 会因插件 apply 抛错而整体启动失败。
 * @module dsh-workspace-combiner/client
 */

import type { ClientCtx, WorkspaceNavigation } from './types.ts'
import { en, setTranslate, tt, zh } from './locales.ts'
import { WorkspaceCombinerIcon, WorkspaceCombinerPanel } from './panel/WorkspaceCombinerPanel.tsx'
import { PANEL_ID } from '../invariant.ts'

/** 本插件拥有的 locale 命名空间。 */
const NS = 'dsh-workspace-combiner'

/** 客户端日志前缀。 */
const LOG = '[dsh-workspace-combiner]'

/**
 * 面板动作：与 slot 注册解耦，便于对 DSH 客户端 API 契约做回归测试。
 * （`scripts/client-contract-smoke.ts` 会用真实签名的桩验证这些调用。）
 */
export interface PanelActions {
  /** 主目录 get-or-create 工作区后新建独立会话；可选设置标题。返回新会话 id。 */
  startSession(mainDirPath: string, title?: string): Promise<string>
  /** 打开宿主原生目录选择器；取消返回 null。 */
  pickDirectory(): Promise<string | null>
  /** 把目录注册进 DSH 左侧「工作区」列表（get-or-create）。 */
  registerDshWorkspace(path: string): Promise<void>
  /** 当前会话总数（读取失败回退 0）。 */
  sessionCount(): number
  /** 会话标题查询（读取失败返回空串）。 */
  sessionTitle(id: string): string
  /**
   * 把主视图切到指定会话。
   * 0.2.0-rc.2 的 ClientSessions 没有 open()，这一步由 ui-workspace 的
   * `uiWorkspace.openSession()` 负责；服务缺失时是 no-op（面板仍可用）。
   */
  openSession(sessionId: string): void
}

/**
 * 构造面板动作（不碰 slots/locale，只依赖 sessions / workspaces / remote）。
 * @param ctx - client 根上下文。
 */
export function createPanelActions(ctx: ClientCtx): PanelActions {
  /**
   * 把主视图切到某个会话。
   *
   * 两个关键点：
   *   1. **每次调用才解析服务**，不在 apply 期捕获。DSH 客户端插件的加载顺序不保证
   *      （官方注释：dsh.client.inject 边只是预取元数据，从不做 apply 时序），apply 期
   *      读到的 `ctx.uiWorkspace` 可能是 undefined 并被闭包永久缓存成 no-op。
   *   2. **必须用 `ctx.get()` 读服务**：cordis 对未注入的服务做属性访问（`ctx.uiWorkspace`）
   *      会抛 `cannot get property "uiWorkspace" without inject`，而不是返回 undefined。
   *      上一版写成 `ctx.uiWorkspace?.openSession()`，异常被可选链 + try/catch 吞成静默
   *      no-op——会话建了、面板也列出了，但主视图永远不跳转。
   *   3. 失败不静默：拿不到服务或导航抛错都留下 error 级别日志。
   * @param sessionId - 要显示在主视图里的会话 id。
   */
  const openInMainView = (sessionId: string): void => {
    try {
      const navigation = ctx.get?.('uiWorkspace') as WorkspaceNavigation | undefined
      if (navigation === undefined || navigation === null || typeof navigation.openSession !== 'function') {
        console.error(`${LOG} 主视图导航服务不可用：会话已创建但没有跳转（${sessionId}）`)
        return
      }
      navigation.openSession(sessionId)
    } catch (error) {
      console.error(`${LOG} 打开会话失败（会话已创建，但主视图没有跳转）: ${sessionId}`, error)
    }
  }

  /**
   * 从会话目录快照折叠出「已被占用的标题」集合（读取失败返回空集合）。
   * 快照形状见 types.ts：{ ids, byId: { [id]: { title? } } }。
   */
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

  /** 标题去重：与已有会话的持久标题冲突时追加「(n)」序号。 */
  const dedupeTitle = (name: string): string => {
    const taken = takenTitles()
    if (!taken.has(name)) return name
    let i = 2
    while (taken.has(`${name} (${i})`)) i++
    return `${name} (${i})`
  }

  // 新建会话动作：主目录 get-or-create 工作区（按路径复用/注册，workspace.path 就是
  // mainDirPath），再用 **workspaceId** 建会话——宿主侧 `session.create` 硬校验
  // `workspaceId` 与 `cwd` 不能同时传，且只有走 workspaceId 才会
  // `workspace.attachSession(sessionId)`（左侧栏的工作空间分组/排序依赖它）；
  // cwd 由宿主按工作空间路径自动取。
  // 加载模板时以模板名命名（binding().session.rename()，失败/空名不影响打开）。
  const startSession = async (mainDirPath: string, title?: string): Promise<string> => {
    const workspace = await ctx.workspaces.create({ path: mainDirPath })
    const sessionId = await ctx.sessions.create({ workspaceId: workspace.workspaceId })
    // 建完必须显式导航。0.2.0-rc.2 的 ClientSessions 没有 open()——主视图切换由
    // dsh-client-ui-workspace 的 uiWorkspace.openSession() 负责（官方 ui-chat /
    // ui-subagent 同款用法）。少了这一步，会话确实建出来了，但界面停在原地，
    // 用户看到的就是"点了没反应/没有创建会话"。
    openInMainView(sessionId)
    const name = title?.trim()
    if (name !== undefined && name !== '') {
      const finalName = dedupeTitle(name)
      try {
        const binding = ctx.sessions.binding(sessionId)
        if (binding === undefined) {
          console.warn(`${LOG} 会话未保留，跳过改名: ${sessionId}`)
        } else {
          const result = await binding.session.rename(finalName)
          if (!result.ok) console.warn(`${LOG} 会话改名失败: ${sessionId} ${result.error.message}`)
        }
      } catch (error) {
        console.warn(`${LOG} 会话改名失败: ${sessionId}`, error)
      }
    }
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
    // 注册失败不能一律吞掉：那会让"左侧栏没有这个工作区"变成无迹可查的问题。
    await ctx.workspaces.create({ path }).catch(error => {
      console.error(`${LOG} 注册 DSH 工作区失败: ${path}`, error)
    })
  }

  return {
    startSession,
    openSession: openInMainView,
    pickDirectory,
    registerDshWorkspace,
    // 当前会话总数（会话占用回显；读取失败时回退 0）。
    sessionCount: (): number => {
      try {
        return ctx.sessions.list.getSnapshot().ids.length
      } catch {
        return 0
      }
    },
    // 会话标题查询（面板的会话列表展示用；读取失败返回空串，由面板回退短 id）。
    sessionTitle: (id: string): string => {
      try {
        const title = ctx.sessions.list.getSnapshot().byId[id]?.title
        return typeof title === 'string' ? title : ''
      } catch {
        return ''
      }
    },
  }
}

/**
 * client fiber 需要的服务（slots 插槽、locale 词典、sessions 新建会话、workspaces
 * get-or-create、remote.directoryPicker 选目录）。
 *
 * 注意 **uiWorkspace 故意不在这里**：它只用于"新建会话后跳转"这一件事，若写进
 * inject，一旦 ui-workspace 因别的原因 pending，我们的整个面板也会跟着不激活
 * （比"导航失效"严重得多）。改用不抛错的 `ctx.get('uiWorkspace')` 按需读取。
 */
export const inject = ['slots', 'locale', 'sessions', 'workspaces', 'remote', 'remote.directoryPicker']

/**
 * 挂载词典 + 侧边栏图标 + 中心列面板。
 * @param ctx - client 根上下文（slots / locale / sessions / remote）。
 */
export function apply(ctx: ClientCtx): void {
  // 词典注册（幂等；注册 bump revision 让已挂载出口拾取晚到词典）。
  // 同时尝试把命名空间绑定成翻译函数交给 locales.tt 使用（绑定失败保持
  // document.documentElement.lang 兜底，不影响可用性）。
  ctx.effect(() => {
    const dispose = ctx.locale.register(NS, { zh, en })
    try {
      const bound = ctx.locale.bind(NS)
      // 探测：绑定成功时 key 会翻成当前语言；失败时原样返回 key。
      const probe = bound('title')
      if (typeof probe === 'string' && probe !== '' && probe !== 'title') setTranslate(bound)
    } catch (error) {
      console.warn(`${LOG} locale.bind 失败，回退 document.lang：`, error)
    }
    return () => {
      setTranslate(undefined)
      dispose()
    }
  }, 'dsh-workspace-combiner: dictionaries')

  const actions = createPanelActions(ctx)

  // 侧边栏图标：sidebar.panellist（list 插槽）——id 与 main 的 key 对齐。
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
    { name: 'sidebar.panellist', id: PANEL_ID, order: 100, label: () => tt('title') },
    WorkspaceCombinerIcon,
  ))

  // 中心列面板 body：main（keyed 插槽）——选中图标时由布局以 entryKey 渲染。
  ctx.slots.inject('main', () => ctx.slots.register(
    { name: 'main', key: PANEL_ID },
    () => WorkspaceCombinerPanel({
      startSession: actions.startSession,
      pickDirectory: actions.pickDirectory,
      registerDshWorkspace: actions.registerDshWorkspace,
      sessionCount: actions.sessionCount(),
      sessionTitle: actions.sessionTitle,
      openSession: actions.openSession,
    }),
  ))
}
