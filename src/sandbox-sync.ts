/**
 * 联动 @chaoset/sandbox-extra-roots：把选中的工作区目录并入沙盒 extraRoots
 * 白名单，放开 workspace-write 模式下的读写权限。
 *
 * 两层策略：
 *   1. 热更新（首选）：调用 sandbox-extra-roots 暴露的 typert 远程服务
 *      `sandboxExtraRootsConfig.set({ extraWritableRoots })` —— 它会校验、
 *      原子落盘并立即热更新运行中的沙盒包装（无需重启）。
 *   2. 直接写盘（回退）：当 typert 远程不可用时，直接原子写入
 *      `$DSH_HOME/plugins/sandbox-extra-roots/config.json`。此文件是该插件
 *      的权威配置（每次 confine 都读），但运行中的进程不会监听外部写盘，
 *      需重启 harness 后才生效。
 *
 * 调和语义（不覆盖用户手配目录）：只移除「本插件上次贡献」的路径，保留
 * 用户在 sandbox-extra-roots 设置页手动加入的其它目录。
 * @module dsh-workspace-combiner/sandbox-sync
 */

import type { Context } from '@deepseek-ai/cordis'
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { SANDBOX_PLUGIN_NAME, SANDBOX_REMOTE_SERVICE } from './invariant.ts'

/** sandbox-extra-roots 的 config.json 绝对路径。 */
export function sandboxConfigFile(): string {
  const dsh = process.env.DSH_HOME?.trim() ? resolve(process.env.DSH_HOME) : join(homedir(), '.dsh')
  return join(dsh, 'plugins', SANDBOX_PLUGIN_NAME, 'config.json')
}

/** sandbox-extra-roots 远程服务的最小形状（可选依赖，缺失时走回退）。 */
interface SandboxConfigRemote {
  get?: () => { config?: { extraWritableRoots?: string[] } }
  set?: (partial: { extraWritableRoots: string[] }) => unknown
}

/** 读取 config.json 里的 file-level extraWritableRoots（缺失/损坏 -> []）。 */
async function readFileRoots(): Promise<string[]> {
  try {
    const raw = await readFile(sandboxConfigFile(), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const roots = (parsed as { extraWritableRoots?: unknown }).extraWritableRoots
      if (Array.isArray(roots)) return roots.filter((r): r is string => typeof r === 'string')
    }
  } catch {
    // 不存在或损坏：视为空。
  }
  return []
}

/** 原子写入 config.json（目录 0700、文件 0600）。 */
async function writeFileRoots(roots: string[]): Promise<void> {
  const file = sandboxConfigFile()
  await mkdir(dirname(file), { recursive: true, mode: 0o700 })
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify({ extraWritableRoots: roots }, null, 2) + '\n', { mode: 0o600 })
  await rename(tmp, file)
  await chmod(file, 0o600).catch(() => {})
}

/** 去重并保持顺序。 */
function dedupe(paths: string[]): string[] {
  return [...new Set(paths)]
}

/**
 * 把选中目录同步进沙盒白名单。
 * @param ctx - 宿主插件上下文（用于查找远程服务）。
 * @param previous - 上一次贡献的路径（本插件之前选中的工作区路径）。
 * @param next - 本次要贡献的路径（新选中的工作区路径）。
 */
export async function syncExtraRoots(ctx: Context, previous: readonly string[], next: readonly string[]): Promise<void> {
  // 调和：移除本插件上次贡献，保留用户手配目录，再并入本次贡献。
  const fileRoots = await readFileRoots()
  const base = fileRoots.filter(path => !previous.includes(path))
  const merged = dedupe([...base, ...next])

  // 1) 热更新：走 sandbox-extra-roots 的远程服务（校验 + 落盘 + 热生效）。
  let remote: SandboxConfigRemote | undefined
  try {
    remote = ctx.get(SANDBOX_REMOTE_SERVICE) as SandboxConfigRemote | undefined
  } catch {
    remote = undefined
  }
  if (remote?.set !== undefined) {
    try {
      remote.set({ extraWritableRoots: merged })
      return
    } catch (error) {
      // set() 抛错通常是 sandbox-extra-roots 拒绝了危险/无效目录（如 / 或
      // home 祖先）。尊重它的安全判定，不绕过校验直接写盘。
      ctx.logger?.warn('[dsh-workspace-combiner] sandbox-extra-roots rejected the root set:', error)
      return
    }
  }

  // 2) 回退：远程不可用，直接写盘（重启 harness 后生效）。
  try {
    await writeFileRoots(merged)
    ctx.logger?.warn('[dsh-workspace-combiner] sandbox-extra-roots remote unavailable; wrote config.json (restart to apply)')
  } catch (error) {
    ctx.logger?.warn('[dsh-workspace-combiner] failed to write sandbox config:', error)
  }
}
