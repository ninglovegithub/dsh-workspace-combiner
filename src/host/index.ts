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
 *   5. 勾选变化时联动 dsh-write-protect，把选中目录并入沙盒
 *      writablePaths 白名单。
 *
 * 底层限制（重要）：会话 shell 只有唯一 cwd 且不可修改。本插件不去改 cwd，
 * 而是靠 prompt 强制模型使用绝对路径。
 *
 * 全部基于官方 npm SDK，无需改 DSH 源码。浏览器半面见 src/client。
 * @module dsh-workspace-combiner
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
// 类型仅导入：拉取 ctx.webServer / ctx.systemPrompt / session 事件的类型合并。
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-session'
import { DEFAULT_CODE_INDEX_BUDGET, DEFAULT_STANDARDS_BUDGET, DEFAULT_TOKEN_BUDGET, PLUGIN_ID, SECTION_NAME, SECTION_ORDER } from '../invariant.ts'
import { renderMultiWorkspacePrompt } from '../prompt.ts'
import { makeRoutes } from '../routes.ts'
import { WorkspaceCombinerStore } from '../store.ts'
import { FileIndexCache } from './fileIndex.ts'
import type { FileIndexEntry } from '../core/fileTree.ts'
import { loadModeMaxDepth, type CodeIndexEntry, type LoadMode, type Workspace, type WorkspaceMode, type WorkspaceRef } from '../core/types.ts'
import { CodeIndexCache } from './codeIndex.ts'
import { FeatureSummaryCache, codeIndexSignature, summarizeFeatures } from './codeIndexSummary.ts'
import { StandardsLibraryStore } from './standardsLibrary.ts'
import { cleanupOnDemandContext, cleanupStaleOnDemandContexts, persistOnDemandContext } from './onDemandContext.ts'
import { TokenUsageTracker, type TrackedEvent, type TrackedSession } from './tokenUsage.ts'
import type { SessionTask } from '../core/task.ts'
import { resolveStandardGroups, type StandardGroup } from '../core/standards.ts'
import { contextPresetConfig, resolveWorkspaceContext } from '../core/contextPreset.ts'
import { buildTaskContextCapsule, type TaskContextCapsule } from '../core/taskCapsule.ts'
import { getChangedFiles } from './gitStatus.ts'
import { pathKey as sandboxPathKey, syncExtraRoots } from '../sandbox-sync.ts'
import { setIoWarningSink } from './fileIndex.ts'
import { readWorkspaceRegistry, retitleDshWorkspace } from './dshWorkspaces.ts'

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

interface SessionSelection {
  workspaceUpdatedAt: number
  directories: readonly WorkspaceRef[]
  mode: WorkspaceMode
  loadMode: LoadMode
  globalBudget: number
  fileIndexBudget: number
  fileIndexPath?: string
  symbolIndexPath?: string
  dependencyIndexPath?: string
  testIndexPath?: string
  entries: FileIndexEntry[]
  taskCapsule?: TaskContextCapsule
  codeEntries: CodeIndexEntry[]
  codeIndexBudget: number
  codeIndexPath?: string
  standardGroups: StandardGroup[]
  standardsBudget: number
  standardsPath?: string
  commandsBudget: number
  commandsPath?: string
  task?: SessionTask
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
/**
 * 当前进程实际加载的插件版本。
 *
 * 宿主半面只在进程启动时读一次文件，所以它才是"到底跑的是哪个版本"的权威答案；
 * 升级后没重启时，这里仍然是旧版本——面板会把它显示出来，避免靠猜。
 */
const PLUGIN_VERSION: string = (() => {
  try {
    const parsed = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')) as { version?: unknown }
    return typeof parsed.version === 'string' ? parsed.version : 'unknown'
  } catch {
    return 'unknown'
  }
})()

export function apply(ctx: Context, config: Config = {}): void {
  if (config.enabled === false) return
  // 升级插件后必须重启进程才会生效；这行日志让人一眼看出当前跑的是哪个版本。
  ctx.logger?.info(`[dsh-workspace-combiner] v${PLUGIN_VERSION} activated (host half loaded at process start)`)

  const store = new WorkspaceCombinerStore()
  // 会话 id -> 该会话创建时快照下来的当前工作空间目录。只有新建的顶层会话会写入。
  const fileIndexCache = new FileIndexCache()
  const codeIndexCache = new CodeIndexCache()
  const summaryCache = new FeatureSummaryCache()
  const standardsLibrary = new StandardsLibraryStore()
  const tokenUsage = new TokenUsageTracker()
  const selectionBySession = new Map<string, SessionSelection>()
  const taskBySession = new Map<string, SessionTask>()
  const selectionNonceBySession = new Map<string, number>()
  // 会话 id -> 归属的自定义工作空间 id（新建会话时的当前工作空间）。
  const sessionWorkspaceBySession = new Map<string, string>()
  // 会话 id -> 已渲染文本：同一快照对象直接复用，避免每个模型步重复拼串。
  const renderedBySession = new Map<string, { snapshot: object; text: string }>()
  void cleanupStaleOnDemandContexts()

  // 把「非 ENOENT 的文件系统错误」（EACCES/EIO/JSON 损坏等）收口到插件日志：
  // 否则权限不足的仓库只表现为「未识别到项目」，用户完全无从判断原因。
  setIoWarningSink(message => ctx.logger?.warn(message))

  // 存储加载失败时明确告警：本次运行只读内存（persist 会拒绝写入），
  // 避免用户以为「工作空间被删了」而反复重建。
  void store.getState().then(() => {
    if (store.loadFailed()) {
      ctx.logger?.warn('[dsh-workspace-combiner] 工作空间存储读取失败，本次运行不会写入磁盘（原文件已隔离为 .corrupt-*）:', store.loadError())
    }
  }).catch(() => {})

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
        const text = renderMultiWorkspacePrompt({
          workspaces: selected.directories,
          mode: selected.mode,
          loadMode: selected.loadMode,
          entries: selected.entries,
          taskCapsule: selected.taskCapsule,
          fileIndexPath: selected.fileIndexPath,
          symbolIndexPath: selected.symbolIndexPath,
          dependencyIndexPath: selected.dependencyIndexPath,
          testIndexPath: selected.testIndexPath,
          fileIndexBudget: selected.fileIndexBudget,
          globalBudget: selected.globalBudget,
          codeEntries: selected.codeEntries,
          codeIndexBudget: selected.codeIndexBudget,
          // 预算 <=0 = 不常驻：改给一条按需查询线索（索引空说明功能索引未启用，则不给）。
          ...(selected.codeIndexBudget <= 0 && selected.codeIndexPath !== undefined ? { codeIndexPath: selected.codeIndexPath } : {}),
          standardGroups: selected.standardGroups,
          standardsBudget: selected.standardsBudget,
          ...(selected.standardsBudget <= 0 && selected.standardsPath !== undefined ? { standardsPath: selected.standardsPath } : {}),
          commandsBudget: selected.commandsBudget,
          ...(selected.commandsBudget <= 0 && selected.commandsPath !== undefined ? { commandsPath: selected.commandsPath } : {}),
          task: selected.task,
        })
        renderedBySession.set(session.id, { snapshot: selected, text })
        return text
      },
    }), 'dsh-workspace-combiner: prompt section')
  }

  /**
   * 把工作空间的当前配置写成某会话的上下文快照：先绑定目录，再异步补文件树与功能索引。
   * 会话创建与「工作空间改动后刷新在跑会话」共用这一条路径，避免两处行为漂移。
   * @param sessionId - 目标会话 id。
   * @param ws - 工作空间记录。
   */
  const selectWorkspace = (sessionId: string, ws: Workspace): void => {
    const task = taskBySession.get(sessionId)
    const context = task === undefined ? resolveWorkspaceContext(ws) : contextPresetConfig(task.contextPreset)
    const loadMode = task?.loadMode ?? context.loadMode
    const mode = ws.mode ?? 'anchor'
    const selectedPaths = task === undefined ? undefined : new Set(task.directoryPaths)
    const directories = ws.directories
      .filter((directory, index) => index === 0 || selectedPaths === undefined || selectedPaths.has(directory.path))
      .map(directory => ({
        ...directory,
        ...(task?.allowWrites === false ? { access: 'readonly' as const } : {}),
      }))
    const globalBudget = context.globalBudget
    const fileIndexBudget = context.fileIndexBudget
    const codeIndexBudget = task?.includeCodeIndex === false ? 0 : context.codeIndexBudget
    const standardsBudget = context.standardsBudget
    const commandsBudget = context.commandsBudget
    const nonce = (selectionNonceBySession.get(sessionId) ?? 0) + 1
    selectionNonceBySession.set(sessionId, nonce)
    // 先绑定目录快照，再异步补充文件树。此前在文件树扫描之后才写入 Map：大型
    // 仓库扫描期间 system prompt 可能已被组装，导致首轮请求完全没有多工作区上下文。
    selectionBySession.set(sessionId, { workspaceUpdatedAt: ws.updatedAt, directories, mode, loadMode, globalBudget, fileIndexBudget, entries: [], codeEntries: [], codeIndexBudget, standardGroups: [], standardsBudget, commandsBudget, ...(task === undefined ? {} : { task }) })
    void (async () => {

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
      const codeIndexResult = await codeIndexCache.get(directories)
      const baseCodeEntries = (ws.codeIndexEnabled ?? true) && task?.includeCodeIndex !== false ? codeIndexResult.entries : []
      const signature = codeIndexSignature(baseCodeEntries)
      const cachedSummaries = baseCodeEntries.length > 0 ? await summaryCache.get(signature) : undefined
      const codeEntries = withSummaries(baseCodeEntries, cachedSummaries)
      // 开发规范：按工作空间绑定 + projectType 自动匹配解析出作用域分组。
      const standardGroups = resolveStandardGroups(ws.standards, directories, await standardsLibrary.get())
      const changedFiles = task === undefined ? {} : Object.fromEntries(await Promise.all(directories.filter(directory => task.directoryPaths.includes(directory.path)).map(async directory => [directory.path, await getChangedFiles(directory.path)] as const)))
      const taskCapsule = task === undefined ? undefined : buildTaskContextCapsule(task, directories, entries, codeEntries, codeIndexResult.symbols, codeIndexResult.dependencies, codeIndexResult.tests, changedFiles)
      const onDemand = await persistOnDemandContext(sessionId, ws.id, directories, standardGroups, codeEntries, codeIndexResult.symbols, codeIndexResult.dependencies, codeIndexResult.tests, entries, loadMode)
      // 会话可能在扫描期间已被关闭；不要把过期快照重新放回 Map。
      if (sessionWorkspaceBySession.get(sessionId) === ws.id && selectionNonceBySession.get(sessionId) === nonce) {
        selectionBySession.set(sessionId, {
          workspaceUpdatedAt: ws.updatedAt,
          directories, mode, loadMode, globalBudget, fileIndexBudget, entries,
          ...(taskCapsule === undefined ? {} : { taskCapsule, fileIndexPath: onDemand.fileIndexPath }),
          symbolIndexPath: onDemand.symbolIndexPath,
          dependencyIndexPath: onDemand.dependencyIndexPath,
          testIndexPath: onDemand.testIndexPath,
          codeEntries, codeIndexBudget,
          ...(codeIndexBudget <= 0 ? { codeIndexPath: onDemand.codeIndexPath } : {}),
          standardGroups,
          standardsBudget,
          ...(standardsBudget <= 0 ? { standardsPath: onDemand.standardsPath } : {}),
          commandsBudget,
          ...(commandsBudget <= 0 ? { commandsPath: onDemand.commandsPath } : {}),
          ...(task === undefined ? {} : { task }),
        })
      }
      // AI 摘要在后台生成：不阻塞会话创建与首轮；完成后更新快照并失效渲染缓存。
      if (baseCodeEntries.length > 0 && context.codeIndexSummary === 'llm' && cachedSummaries === undefined) {
        void (async () => {
          const generated = await summaryCache.ensure(signature, () => summarizeFeatures(ctx, sessionId, baseCodeEntries))
          if (generated.size === 0) return
          if (sessionWorkspaceBySession.get(sessionId) !== ws.id || selectionNonceBySession.get(sessionId) !== nonce) return
          const current = selectionBySession.get(sessionId)
          if (current === undefined || current.codeEntries !== codeEntries) return
          selectionBySession.set(sessionId, { ...current, codeEntries: withSummaries(baseCodeEntries, generated) })
          renderedBySession.delete(sessionId)
        })().catch(error => {
          // 摘要生成是后台增强：失败只降级为「没有摘要」，不能变成未处理拒绝。
          ctx.logger?.warn('[dsh-workspace-combiner] 生成功能摘要失败:', error)
        })
      }
    })().catch(error => {
      // 构建失败（目录不可读/被删等）不能让会话停在半空快照上：面板的「刷新会话」可重试。
      ctx.logger?.warn('[dsh-workspace-combiner] 构建会话上下文快照失败:', error)
    })
  }

  // 3) 会话生命周期：新建会话时快照勾选，销毁时清理。
  ctx.on('session/created', (session: SessionLike) => {
    // 只对顶层新建会话生效：子代理/分支会话带 parentSession，不注入。
    if (session.header?.parentSession !== undefined) return
    void store.getCurrentWorkspace().then(ws => {
      if (ws === undefined) return
      // 绑定必须早于 selectWorkspace：其中的守卫按这个绑定判断快照是否已被接替。
      sessionWorkspaceBySession.set(session.id, ws.id)
      // 新会话绑定的工作空间也要进白名单（会话绑定的可能不是当前工作空间）。
      void syncSandbox()
      // DSH 侧工作区是按目录自动建的，标题默认取目录名；插件里的名称可能与目录不同
      // （重命名过），这里顺手对齐一次，避免左栏显示名和插件面板对不上。
      void retitleDshWorkspace(
        readWorkspaceRegistry(ctx),
        ws.directories[0]?.path ?? '',
        ws.name,
      ).catch((error: unknown) => {
        ctx.logger?.warn('[dsh-workspace-combiner] 同步 DSH 工作区名称失败:', error)
      })
      // 落盘失败（EACCES/ENOSPC）必须自己接住：dsh-session 只 catch 监听器自身
      // 返回的 promise，这里返回 undefined，裸 rejection 会按 Node 默认策略终止进程。
      void store.touchWorkspaceSession(ws.id).catch(error => {
        ctx.logger?.warn('[dsh-workspace-combiner] 记录会话时间失败:', error)
      })
      selectWorkspace(session.id, ws)
    }).catch(error => {
      ctx.logger?.warn('[dsh-workspace-combiner] 读取当前工作空间失败:', error)
    })
  }, { global: true })

  /**
   * 刷新单个会话的上下文快照（面板会话列表里的「刷新会话」按钮）。
   * @param sessionId - 会话 id。
   * @returns 该会话绑定的工作空间 id；不是本进程加载的会话则返回 undefined。
   */
  const refreshSession = async (sessionId: string): Promise<string | undefined> => {
    const workspaceId = sessionWorkspaceBySession.get(sessionId)
    if (workspaceId === undefined) return undefined
    try {
      const workspaces = await store.getWorkspaces()
      const ws = workspaces.find(item => item.id === workspaceId)
      if (ws === undefined) return workspaceId
      // 刷新期间会话可能已关闭或切到别的工作空间：再确认一次绑定。
      if (sessionWorkspaceBySession.get(sessionId) === workspaceId) selectWorkspace(sessionId, ws)
    } catch (error) {
      // 读取失败必须让调用方看见：以前是 fire-and-forget + 空 catch，
      // 接口先回 ok，用户以为上下文已刷新。
      ctx.logger?.warn('[dsh-workspace-combiner] 刷新会话上下文失败:', sessionId, error)
      throw error
    }
    return workspaceId
  }

  /**
   * 工作空间配置变化（新增项目、改加载模式/预算/规范等）后刷新绑定它的活动会话：
   * 下一个模型步就用上新目录，不必新建会话（此前这些改动只对新建会话生效）。
   * @param workspaceId - 发生变化的工作空间 id。
   */
  const refreshWorkspaceSessions = (workspaceId: string): void => {
    for (const [sessionId, id] of sessionWorkspaceBySession) {
      if (id === workspaceId) void refreshSession(sessionId).catch(() => {})
    }
  }

  const setSessionTask = (sessionId: string, task: SessionTask): void => {
    taskBySession.set(sessionId, task)
    renderedBySession.delete(sessionId)
    if (sessionWorkspaceBySession.has(sessionId)) void refreshSession(sessionId).catch(() => {})
  }

  /** 本插件上次贡献给沙盒白名单的路径（调和基线：只撤自己写过的，保留用户手配）。 */
  let lastSyncedSandboxPaths: string[] = []

  /**
   * 把「当前工作空间 ∪ 全部活动会话绑定的工作空间」的可写目录写入沙盒白名单。
   *
   * 只跟随当前工作空间是不够的：切到工作空间 B 会把绑定 A 的活会话的写权限静默
   * 吊销，而那个会话的 prompt 里 A 仍标着可写。并集才能保证「说得出就写得到」。
   * @returns 是否写入成功（失败只告警，不抛出）。
   */
  const syncSandbox = async (): Promise<boolean> => {
    try {
      const wantedIds = new Set<string>(sessionWorkspaceBySession.values())
      const currentId = await store.getCurrentWorkspaceId()
      if (currentId !== '') wantedIds.add(currentId)
      const paths: string[] = []
      const seen = new Set<string>()
      for (const ws of await store.getWorkspaces()) {
        if (!wantedIds.has(ws.id)) continue
        for (const directory of ws.directories) {
          if ((directory.access ?? 'readwrite') !== 'readwrite') continue
          const key = sandboxPathKey(directory.path)
          if (key === '' || seen.has(key)) continue
          seen.add(key)
          paths.push(directory.path)
        }
      }
      const ok = await syncExtraRoots(ctx, lastSyncedSandboxPaths, paths)
      // 写失败时不推进基线：否则下次调和会以为旧路径已经撤掉，白名单会残留。
      if (ok) lastSyncedSandboxPaths = paths
      return ok
    } catch (error) {
      ctx.logger?.warn('[dsh-workspace-combiner] 同步沙盒白名单失败:', error)
      return false
    }
  }

  ctx.on('session/disposed', (session: SessionLike) => {
    selectionBySession.delete(session.id)
    sessionWorkspaceBySession.delete(session.id)
    taskBySession.delete(session.id)
    selectionNonceBySession.delete(session.id)
    renderedBySession.delete(session.id)
    tokenUsage.forget(session.id)
    void cleanupOnDemandContext(session.id)
    // 会话结束后重算白名单：它的工作空间可能不再需要写权限。
    void syncSandbox()
  }, { global: true })

  // 2.5) 真实 token 用量：采样 assistant/message 的 provider 上报值（含提示词缓存命中）。
  // 用量只在内存里观测，不落盘——面板显示的是「本机本次运行」的真实消耗。
  ctx.on('session/event', (session: TrackedSession, event: TrackedEvent) => {
    tokenUsage.observe(session, event)
  }, { global: true })

  // 3) 路由族（client -> host：读写勾选与模板；勾选变化时联动沙盒）。
  ctx.effect(() => {
    const disposers = makeRoutes(ctx, store, fileIndexCache, codeIndexCache, summaryCache, standardsLibrary, {
      pluginVersion: PLUGIN_VERSION,
      tokenUsage,
      // 用量按工作空间聚合：会话 -> 工作空间的绑定在 session/created 时确定。
      sessionsOfWorkspace: (workspaceId: string) =>
        [...sessionWorkspaceBySession].filter(([, id]) => id === workspaceId).map(([sessionId]) => sessionId),
      sessionVersionsOfWorkspace: (workspaceId: string) =>
        [...sessionWorkspaceBySession]
          .filter(([, id]) => id === workspaceId)
          .map(([sessionId]) => selectionBySession.get(sessionId)?.workspaceUpdatedAt ?? 0),
      // 工作空间改动后立刻刷新在跑的会话（见 refreshWorkspaceSessions）。
      refreshSessions: refreshWorkspaceSessions,
      refreshSession,
      setSessionTask,
      syncSandbox,
    }).map(route => ctx.webServer.register(route))
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'dsh-workspace-combiner: routes')
}
