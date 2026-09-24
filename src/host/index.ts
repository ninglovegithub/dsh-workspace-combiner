/**
 * dsh-workspace-combiner — host 半面。
 *
 * 职责：
 *   1. 挂载持久化存储（~/.dsh/dsh-workspace-combiner.json）：当前工作空间。
 *   2. 注册 /api/dsh-workspace-combiner 路由族（loopback-only），供 client 半面
 *      读写工作空间。
 *   3. 注册全局 system prompt 分节，其 text 是「按会话动态」的函数——只对
 *      新建会话注入多工作区联合开发模式；旧会话、子代理会话返回空串。
 *   4. 监听 session/created（用户所说的 session:before-start 语义）：把此刻
 *      的勾选快照绑定到该会话 id；session/disposed 时清理。
 *   5. 勾选变化时联动 @chaoset/sandbox-extra-roots，把选中目录并入沙盒
 *      extraRoots 白名单。
 *
 * 底层限制（重要）：会话 shell 只有唯一 cwd 且不可修改。本插件不去改 cwd，
 * 而是靠 prompt 强制模型使用绝对路径。
 *
 * 全部基于官方 npm SDK，无需改 DSH 源码。浏览器半面见 src/client。
 * @module dsh-workspace-combiner
 */

import type { Context } from '@deepseek-ai/cordis'
// 类型仅导入：拉取 ctx.webServer / ctx.systemPrompt / session 事件的类型合并。
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-session'
import { PLUGIN_ID, SECTION_NAME, SECTION_ORDER } from '../invariant.ts'
import { renderMultiWorkspacePrompt } from '../prompt.ts'
import { makeRoutes } from '../routes.ts'
import { WorkspaceCombinerStore } from '../store.ts'
import type { WorkspaceRef } from '../core/types.ts'

/** 稳定的 cordis 插件名（编排行 id）。 */
export const name = PLUGIN_ID

/** 宿主挂载前必须就绪的服务。 */
export const inject = ['webServer', 'systemPrompt']

/** 插件配置（无 schema，apply 内做默认值处理）。 */
export interface Config {
  /** 总开关；false 时不注册任何东西。 */
  enabled?: boolean
  /** 是否向模型注入多工作区 prompt 分节（默认 true）。 */
  announceToAgent?: boolean
}

/** 会话事件回调里的最小会话形状（dsh-session 类型合并未加载时的结构兜底）。 */
interface SessionLike {
  id: string
  header?: { parentSession?: string }
}

/**
 * system prompt text 函数收到的组装上下文。dsh-agent 的 assembleContextFor 在
 * 运行期传入 { agent, scope: agent, signal? }（agent.session 即会话），但
 * dsh-system-prompt 的 AssembleContext 类型只声明了 scope/signal——这里做结构
 * 补充。scope/signal 字段同时用于满足 TS 弱类型检测（仅可选字段且无交叠会报错）。
 */
interface PromptContext {
  agent?: { session?: { id: string } }
  scope?: unknown
  signal?: AbortSignal
}

/**
 * 挂载存储、路由、prompt 分节、会话监听与沙盒联动。
 * @param ctx - 宿主插件上下文（webServer / systemPrompt）。
 * @param config - 已解析插件配置。
 */
export function apply(ctx: Context, config: Config = {}): void {
  if (config.enabled === false) return

  const store = new WorkspaceCombinerStore()
  // 会话 id -> 该会话创建时快照下来的当前工作空间目录。只有新建的顶层会话会写入。
  const selectionBySession = new Map<string, readonly WorkspaceRef[]>()
  // 会话 id -> 归属的自定义工作空间 id（新建会话时的当前工作空间）。
  const sessionWorkspaceBySession = new Map<string, string>()

  // 1) system prompt 分节（全局注册，按会话动态渲染）。
  if (config.announceToAgent ?? true) {
    ctx.effect(() => ctx.systemPrompt.section({
      name: SECTION_NAME,
      order: SECTION_ORDER,
      text: (context: PromptContext) => {
        const session = context.agent?.session
        if (session === undefined) return ''
        const selected = selectionBySession.get(session.id)
        return selected !== undefined ? renderMultiWorkspacePrompt(selected) : ''
      },
    }), 'dsh-workspace-combiner: prompt section')
  }

  // 2) 会话生命周期：新建会话时快照勾选，销毁时清理。
  ctx.on('session/created', (session: SessionLike) => {
    // 只对顶层新建会话生效：子代理/分支会话带 parentSession，不注入。
    if (session.header?.parentSession !== undefined) return
    // 快照此刻的当前工作空间目录 + 归属工作空间（异步读取，首个模型请求前必已完成）。
    void store.getCurrentWorkspace().then(ws => {
      if (ws === undefined) return
      if (ws.directories.length > 0) selectionBySession.set(session.id, ws.directories)
      sessionWorkspaceBySession.set(session.id, ws.id)
      void store.touchWorkspaceSession(ws.id)
    })
  }, { global: true })

  ctx.on('session/disposed', (session: SessionLike) => {
    selectionBySession.delete(session.id)
    sessionWorkspaceBySession.delete(session.id)
  }, { global: true })

  // 3) 路由族（client -> host：读写勾选与模板；勾选变化时联动沙盒）。
  ctx.effect(() => {
    const disposers = makeRoutes(ctx, store).map(route => ctx.webServer.register(route))
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'dsh-workspace-combiner: routes')
}
