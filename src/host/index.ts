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
import { DEFAULT_CODE_INDEX_BUDGET, DEFAULT_TOKEN_BUDGET, PLUGIN_ID, SECTION_NAME, SECTION_ORDER } from '../invariant.ts'
import { renderMultiWorkspacePrompt } from '../prompt.ts'
import { makeRoutes } from '../routes.ts'
import { WorkspaceCombinerStore } from '../store.ts'
import { FileIndexCache } from './fileIndex.ts'
import type { FileIndexEntry } from '../core/fileTree.ts'
import { loadModeMaxDepth, type CodeIndexEntry, type LoadMode, type WorkspaceMode, type WorkspaceRef } from '../core/types.ts'
import { CodeIndexCache } from './codeIndex.ts'
import { FeatureSummaryCache, codeIndexSignature, summarizeFeatures } from './codeIndexSummary.ts'

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

/** 把功能摘要合并进索引条目（无摘要时返回副本原样）。 */
function withSummaries(entries: readonly CodeIndexEntry[], summaries: Map<string, string> | undefined): CodeIndexEntry[] {
  if (summaries === undefined || summaries.size === 0) return [...entries]
  return entries.map(entry => summaries.has(entry.feature) ? { ...entry, summary: summaries.get(entry.feature) } : entry)
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
  const fileIndexCache = new FileIndexCache()
  const codeIndexCache = new CodeIndexCache()
  const summaryCache = new FeatureSummaryCache()
  const selectionBySession = new Map<string, { directories: readonly WorkspaceRef[]; mode: WorkspaceMode; loadMode: LoadMode; tokenBudget: number; entries: FileIndexEntry[]; codeEntries: CodeIndexEntry[]; codeIndexBudget: number }>()
  // 会话 id -> 归属的自定义工作空间 id（新建会话时的当前工作空间）。
  const sessionWorkspaceBySession = new Map<string, string>()
  // 会话 id -> 已渲染文本：同一快照对象直接复用，避免每个模型步重复拼串。
  const renderedBySession = new Map<string, { snapshot: object; text: string }>()

  // 1) system prompt 分节（全局注册，按会话动态渲染）。
  if (config.announceToAgent ?? true) {
    ctx.effect(() => ctx.systemPrompt.section({
      name: SECTION_NAME,
      order: SECTION_ORDER,
      text: (context: PromptContext) => {
        const session = context.agent?.session
        if (session === undefined) return ''
        const selected = selectionBySession.get(session.id)
        if (selected === undefined) return ''
        const cached = renderedBySession.get(session.id)
        if (cached !== undefined && cached.snapshot === selected) return cached.text
        const text = renderMultiWorkspacePrompt(selected.directories, selected.mode, selected.loadMode, selected.entries, selected.tokenBudget, selected.codeEntries, selected.codeIndexBudget)
        renderedBySession.set(session.id, { snapshot: selected, text })
        return text
      },
    }), 'dsh-workspace-combiner: prompt section')
  }

  // 2) 会话生命周期：新建会话时快照勾选，销毁时清理。
  ctx.on('session/created', (session: SessionLike) => {
    // 只对顶层新建会话生效：子代理/分支会话带 parentSession，不注入。
    if (session.header?.parentSession !== undefined) return
    // 先绑定目录快照，再异步补充文件树。此前在文件树扫描之后才写入 Map：大型
    // 仓库扫描期间 system prompt 可能已被组装，导致首轮请求完全没有多工作区上下文。
    void store.getCurrentWorkspace().then(async ws => {
      if (ws === undefined) return
      const loadMode = ws.loadMode ?? 'summary'
      const mode = ws.mode ?? 'anchor'
      const directories = ws.directories.map(directory => ({ ...directory }))
      const tokenBudget = ws.tokenBudget ?? DEFAULT_TOKEN_BUDGET
      const codeIndexBudget = ws.codeIndexBudget ?? DEFAULT_CODE_INDEX_BUDGET
      selectionBySession.set(session.id, { directories, mode, loadMode, tokenBudget, entries: [], codeEntries: [], codeIndexBudget })
      sessionWorkspaceBySession.set(session.id, ws.id)
      void store.touchWorkspaceSession(ws.id)

      // 各目录并行扫描（顺序由 Promise.all 保持）；summary 只注入递归计数、不建树。
      const entries = await Promise.all(directories
        .filter(dir => (dir.access ?? 'readwrite') !== 'disabled')
        .map(async (dir): Promise<FileIndexEntry> => {
          const counts = await fileIndexCache.count(dir.path)
          const base: FileIndexEntry = { name: dir.name, path: dir.path, files: counts.files, dirs: counts.dirs, ...(counts.truncated ? { truncated: true } : {}) }
          return loadMode === 'summary' ? base : { ...base, tree: await fileIndexCache.get(dir.path, { maxDepth: loadModeMaxDepth(loadMode) }) }
        }))
      // 功能/接口索引：把前后端落点连起来，减少盲搜。可在面板关闭或改预算；
      // codeIndexSummary='llm' 时按签名生成一次一句话摘要并缓存（失败静默降级）。
      const baseCodeEntries = (ws.codeIndexEnabled ?? true) ? await codeIndexCache.get(directories) : []
      const signature = codeIndexSignature(baseCodeEntries)
      const cachedSummaries = baseCodeEntries.length > 0 ? await summaryCache.get(signature) : undefined
      const codeEntries = withSummaries(baseCodeEntries, cachedSummaries)
      // 会话可能在扫描期间已被关闭；不要把过期快照重新放回 Map。
      if (sessionWorkspaceBySession.get(session.id) === ws.id) {
        selectionBySession.set(session.id, { directories, mode, loadMode, tokenBudget, entries, codeEntries, codeIndexBudget })
      }
      // AI 摘要在后台生成：不阻塞会话创建与首轮；完成后更新快照并失效渲染缓存。
      if (baseCodeEntries.length > 0 && (ws.codeIndexSummary ?? 'off') === 'llm' && cachedSummaries === undefined) {
        void (async () => {
          const generated = await summaryCache.ensure(signature, () => summarizeFeatures(ctx, session.id, baseCodeEntries))
          if (generated.size === 0) return
          if (sessionWorkspaceBySession.get(session.id) !== ws.id) return
          const current = selectionBySession.get(session.id)
          if (current === undefined || current.codeEntries !== codeEntries) return
          selectionBySession.set(session.id, { ...current, codeEntries: withSummaries(baseCodeEntries, generated) })
          renderedBySession.delete(session.id)
        })()
      }
    })
  }, { global: true })

  ctx.on('session/disposed', (session: SessionLike) => {
    selectionBySession.delete(session.id)
    sessionWorkspaceBySession.delete(session.id)
    renderedBySession.delete(session.id)
  }, { global: true })

  // 3) 路由族（client -> host：读写勾选与模板；勾选变化时联动沙盒）。
  ctx.effect(() => {
    const disposers = makeRoutes(ctx, store, fileIndexCache, codeIndexCache, summaryCache).map(route => ctx.webServer.register(route))
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'dsh-workspace-combiner: routes')
}
