import { createHash } from 'node:crypto'
import { chmod, mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { StandardGroup } from '../core/standards.ts'
import type { CodeIndexEntry, DependencyIndexEntry, SymbolIndexEntry, TestIndexEntry, WorkspaceRef } from '../core/types.ts'
import type { FileIndexEntry } from '../core/fileTree.ts'
import type { LoadMode } from '../core/types.ts'
import { renderCodeIndexText, renderCommandsText, renderDependencyIndexText, renderFileIndex, renderStandardsText, renderSymbolIndexText, renderTestIndexText } from '../prompt.ts'
import { dshHome } from '../store.ts'
import { warnIoFailure } from './fileIndex.ts'

function sessionKey(sessionId: string): string {
  return createHash('sha256').update(sessionId).digest('hex').slice(0, 24)
}

function sessionsDirectory(): string {
  return join(dshHome(), 'dsh-workspace-combiner', 'sessions')
}

export function sessionContextDirectory(sessionId: string): string {
  return join(sessionsDirectory(), sessionKey(sessionId))
}

export function standardsTextFile(sessionId: string): string {
  return join(sessionContextDirectory(sessionId), 'standards.md')
}

export function commandsTextFile(sessionId: string): string {
  return join(sessionContextDirectory(sessionId), 'commands.md')
}

export function codeIndexTextFile(sessionId: string): string {
  return join(sessionContextDirectory(sessionId), 'code-index.md')
}

export function contextManifestFile(sessionId: string): string {
  return join(sessionContextDirectory(sessionId), 'manifest.json')
}

export function fileIndexTextFile(sessionId: string): string {
  return join(sessionContextDirectory(sessionId), 'file-index.md')
}

export function symbolIndexTextFile(sessionId: string): string {
  return join(sessionContextDirectory(sessionId), 'symbol-index.md')
}

export function dependencyIndexTextFile(sessionId: string): string {
  return join(sessionContextDirectory(sessionId), 'dependency-index.md')
}

export function testIndexTextFile(sessionId: string): string {
  return join(sessionContextDirectory(sessionId), 'test-map.md')
}

async function writeContextFile(file: string, text: string): Promise<string | undefined> {
  if (text === '') {
    await rm(file, { force: true }).catch(() => {})
    return undefined
  }
  try {
    await mkdir(dirname(file), { recursive: true, mode: 0o700 })
    const tmp = file + '.' + process.pid + '.' + Math.random().toString(36).slice(2, 8) + '.tmp'
    await writeFile(tmp, text, { mode: 0o600 })
    await rename(tmp, file)
    await chmod(file, 0o600).catch(() => {})
    return file
  } catch (error) {
    // 写失败会让 prompt 里的"按需查询文件"指向不存在的路径，必须可见（按路径限流）。
    warnIoFailure('on-demand-context', file, error)
    return undefined
  }
}

export interface OnDemandContextFiles {
  standardsPath?: string
  commandsPath?: string
  codeIndexPath?: string
  fileIndexPath?: string
  symbolIndexPath?: string
  dependencyIndexPath?: string
  testIndexPath?: string
  manifestPath?: string
}

/** 会话追踪表上限（墓碑/序号），防止长跑进程无限增长。 */
const TRACKED_SESSIONS_MAX = 512
/** sessionId -> 该会话被销毁时的序号（墓碑）。 */
const disposedTicks = new Map<string, number>()
/** sessionId -> 最近一次落盘领到的序号。 */
const persistTicks = new Map<string, number>()
let tickCounter = 0

function trimTracking(map: Map<string, number>): void {
  while (map.size > TRACKED_SESSIONS_MAX) {
    const oldest = map.keys().next().value
    if (oldest === undefined) break
    map.delete(oldest)
  }
}

/** 领一个单调递增的落盘序号，并记为该会话最新的一次落盘。 */
function nextPersistTick(sessionId: string): number {
  const tick = ++tickCounter
  persistTicks.delete(sessionId)
  persistTicks.set(sessionId, tick)
  trimTracking(persistTicks)
  return tick
}

/**
 * 会话级串行队列：同一个 sessionId 的「落盘」与「清理」绝不并发执行。
 *
 * 为什么必须串行：清理走 `rm -rf` 会话目录，而落盘要在同一目录里创建临时文件
 * 再 rename。两者并发时，macOS 上会在 `open()`/`rename()` 上抛 EINVAL（目录树
 * 正在被删除），写失败被吞成「文件没写」，最终该会话的按需索引文件静默缺失。
 * 串行化后语义也更正确：清理会等这次落盘写完，再由序号调和决定去留。
 */
const sessionQueues = new Map<string, Promise<void>>()
/** 队列表上限，防止长跑进程无限增长。 */
const SESSION_QUEUES_MAX = 512

/** 在同一会话的队列上排队执行；前一个任务失败不影响后一个。 */
function enqueue<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
  const previous = sessionQueues.get(sessionId) ?? Promise.resolve()
  const result = previous.then(task, task)
  const tail = result.then(() => undefined, () => undefined)
  sessionQueues.set(sessionId, tail)
  void tail.then(() => {
    // 只有仍是链尾时才删除，避免把后来者排上的队摘掉。
    if (sessionQueues.get(sessionId) === tail) sessionQueues.delete(sessionId)
  })
  while (sessionQueues.size > SESSION_QUEUES_MAX) {
    const oldest = sessionQueues.keys().next().value
    if (oldest === undefined) break
    sessionQueues.delete(oldest)
  }
  return result
}

/** 只删目录，不改墓碑（内部清理用；销毁语义见 cleanupOnDemandContext）。 */
async function removeSessionContext(sessionId: string): Promise<void> {
  await rm(sessionContextDirectory(sessionId), { recursive: true, force: true }).catch(() => {})
}

/** 调用方的存活判定可能抛错；抛错时返回 undefined，回退到序号判定。 */
function safeIsAlive(isAlive: () => boolean): boolean | undefined {
  try {
    return isAlive()
  } catch {
    return undefined
  }
}

/**
 * 落盘后调和：会话可能在扫描期间已被销毁（host/index.ts 的存活判定在落盘之后），
 * 旧实现会把刚清理掉的目录重新创建成孤儿，且只有进程启动时的 stale 清理才回收。
 *
 * 判定规则（序号单调递增，会话被重新创建时序号更大）：
 *   - `isAlive` 显式给出结论时以它为准；
 *   - 已有更新的落盘接管该会话目录 → 不删（那批文件属于新生命周期）；
 *   - 本次落盘早于最近的销毁（tick <= disposalTick）→ 属于已死会话，删目录并返回空；
 *   - 其余（本次落盘晚于销毁，或从未销毁）→ 视为存活，清墓碑并返回路径。
 */
async function reconcilePersistedContext(
  sessionId: string,
  tick: number,
  files: OnDemandContextFiles,
  isAlive?: () => boolean,
): Promise<OnDemandContextFiles> {
  const alive = isAlive === undefined ? undefined : safeIsAlive(isAlive)
  if (alive === false) {
    await removeSessionContext(sessionId)
    return {}
  }
  if (alive === true) {
    disposedTicks.delete(sessionId)
    return files
  }
  if (persistTicks.get(sessionId) !== tick) {
    // 期间有新的一次落盘（会话被重建/刷新）：目录归它，别删。
    return {}
  }
  const disposalTick = disposedTicks.get(sessionId)
  if (disposalTick !== undefined && tick <= disposalTick) {
    await removeSessionContext(sessionId)
    return {}
  }
  disposedTicks.delete(sessionId)
  return files
}

/**
 * 把本次会话的按需查询文件写盘，并做一次存活调和（见 reconcilePersistedContext）。
 * @param isAlive - 可选存活判定回调；缺省时用模块内的销毁序号自行判定，行为对旧调用方不变。
 */
export async function persistOnDemandContext(
  sessionId: string,
  workspaceId: string,
  directories: readonly WorkspaceRef[],
  standardGroups: readonly StandardGroup[],
  codeEntries: readonly CodeIndexEntry[],
  symbolEntries: readonly SymbolIndexEntry[],
  dependencyEntries: readonly DependencyIndexEntry[],
  testEntries: readonly TestIndexEntry[],
  fileEntries: readonly FileIndexEntry[],
  loadMode: LoadMode,
  isAlive?: () => boolean,
): Promise<OnDemandContextFiles> {
  const tick = nextPersistTick(sessionId)
  const standardsText = renderStandardsText(standardGroups)
  const commandsText = renderCommandsText(directories)
  const codeIndexText = renderCodeIndexText(codeEntries)
  // 这是「按需查询文件」的内容，不常驻上下文，因此不受 token 预算约束：
  // 必须显式传 Infinity——renderFileIndex 的 0 现在是"不注入"（B1 预算语义）。
  const fileIndexText = renderFileIndex(fileEntries, loadMode, Number.POSITIVE_INFINITY)
  const symbolIndexText = renderSymbolIndexText(symbolEntries)
  const dependencyIndexText = renderDependencyIndexText(dependencyEntries)
  const testIndexText = renderTestIndexText(testEntries)
  const manifestText = JSON.stringify({
    version: 1,
    generatedAt: Date.now(),
    workspaceId,
    sessionKey: sessionKey(sessionId),
    directories: directories.map(directory => ({ name: directory.name, path: directory.path, access: directory.access ?? 'readwrite' })),
  }, null, 2)
  // 落盘 + 调和整体排队：既避免与清理的 rm -rf 并发踩坏文件，
  // 也保证「写完再判断去留」的顺序是确定的。
  return await enqueue(sessionId, async () => {
    const [standardsPath, commandsPath, codeIndexPath, fileIndexPath, symbolIndexPath, dependencyIndexPath, testIndexPath, manifestPath] = await Promise.all([
      writeContextFile(standardsTextFile(sessionId), standardsText),
      writeContextFile(commandsTextFile(sessionId), commandsText),
      writeContextFile(codeIndexTextFile(sessionId), codeIndexText),
      writeContextFile(fileIndexTextFile(sessionId), fileIndexText),
      writeContextFile(symbolIndexTextFile(sessionId), symbolIndexText),
      writeContextFile(dependencyIndexTextFile(sessionId), dependencyIndexText),
      writeContextFile(testIndexTextFile(sessionId), testIndexText),
      writeContextFile(contextManifestFile(sessionId), manifestText),
    ])
    return await reconcilePersistedContext(sessionId, tick, {
      ...(standardsPath === undefined ? {} : { standardsPath }),
      ...(commandsPath === undefined ? {} : { commandsPath }),
      ...(codeIndexPath === undefined ? {} : { codeIndexPath }),
      ...(fileIndexPath === undefined ? {} : { fileIndexPath }),
      ...(symbolIndexPath === undefined ? {} : { symbolIndexPath }),
      ...(dependencyIndexPath === undefined ? {} : { dependencyIndexPath }),
      ...(testIndexPath === undefined ? {} : { testIndexPath }),
      ...(manifestPath === undefined ? {} : { manifestPath }),
    }, isAlive)
  })
}

/** 会话销毁：记墓碑（供落盘调和判定）并删除其上下文目录。 */
export async function cleanupOnDemandContext(sessionId: string): Promise<void> {
  // 墓碑序号必须同步记录（调用方依赖「销毁瞬间即生效」），删除动作排到队列里。
  disposedTicks.set(sessionId, ++tickCounter)
  trimTracking(disposedTicks)
  await enqueue(sessionId, () => removeSessionContext(sessionId))
}

/** 清理异常退出遗留的会话上下文；正常关闭仍由 cleanupOnDemandContext 立即删除。 */
export async function cleanupStaleOnDemandContexts(maxAgeMs = 24 * 60 * 60 * 1000): Promise<void> {
  let entries
  try { entries = await readdir(sessionsDirectory(), { withFileTypes: true }) } catch { return }
  const now = Date.now()
  await Promise.all(entries.filter(entry => entry.isDirectory()).map(async entry => {
    const path = join(sessionsDirectory(), entry.name)
    try {
      if (now - (await stat(path)).mtimeMs > maxAgeMs) await rm(path, { recursive: true, force: true })
    } catch { /* stale cleanup is best-effort */ }
  }))
}
