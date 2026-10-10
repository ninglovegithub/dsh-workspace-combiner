/**
 * 联动 dsh-write-protect：把选中的工作区目录并入沙盒额外可写根白名单，
 * 放开 workspace-write 模式下的写权限。
 *
 * dsh-write-protect 通过替换官方 sandbox-policy / fs-sandbox / sandbox 三行
 * 接管沙箱，额外可写根由它的 policy 半区配置提供（字面绝对路径数组）。该配置
 * 声明在桌面 profile 的 cordis.patch.yml，DSH 以 `patchReload: live` 热加载——
 * 改完即可热生效，无需重启。
 *
 * ## 两个来源，必须都照顾到
 * dsh-write-protect 的有效值是
 *   `currentConfigValue(config.writablePatterns, writableBaseText())`
 * 即：
 *   - **部署 base**：patch 里 `dsh-write-protect-policy` 行的 `config.writablePaths`（数组）
 *   - **用户覆盖**：同一插件设置页保存过的 `config.writablePatterns`（换行分隔文本）
 * 只要用户在设置页保存过「额外可写根」，base 就被整体忽略。所以本模块两处都
 * 和解：base 永远更新；若 patch 里已经存在带 `writablePatterns` 的顶层覆盖行，
 * 同一个文本也一并和解。否则会出现"报告已同步、实际不生效"的假成功。
 *
 * ## 调和语义（不覆盖用户手配目录）
 * 只移除「本插件上次贡献」的路径，保留用户在 patch 里 / dsh-write-protect 设置页
 * 手动加入的其它目录。比较用规范化路径（去尾分隔符 / 折叠分隔符 / Windows 大小写
 * 不敏感），避免 `/a/b` 与 `/a/b/` 被当成两个目录而反复追加重复项。
 *
 * 容错：patch 缺失、行缺失、或写失败时，一律不破坏原文件，只告警。
 * @module dsh-workspace-combiner/sandbox-sync
 */

import type { Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import YAML from 'yaml'
import { SANDBOX_POLICY_ROW_ID, SANDBOX_WRITABLE_FIELD } from './invariant.ts'

/** 默认 profile 名：沙盒联动写桌面 profile 的 patch 层。 */
const PROFILE_NAME = process.env.DSH_PROFILE?.trim() || 'desktop'

/** dsh-write-protect policy 半区在 cordis.patch.yml 里的编排行 id。 */
const POLICY_ROW_ID = SANDBOX_POLICY_ROW_ID

/** writablePaths 字段名（部署 base）。 */
const WRITABLE_FIELD = SANDBOX_WRITABLE_FIELD

/**
 * 设置页覆盖字段名。dsh-write-protect 的 `writablePatterns` 一旦存在就整体
 * 遮蔽 base（`currentConfigValue` 只在 undefined 时回退），所以必须单独和解。
 */
const WRITABLE_OVERRIDE_FIELD = 'writablePatterns'

/** 与 dsh-write-protect 同名的顶层覆盖行 id（设置页写回的是 policy 行 id）。 */
const OVERRIDE_ROW_IDS = [POLICY_ROW_ID, 'dsh-write-protect']

/** desktop profile 的 cordis.patch.yml 绝对路径。 */
export function sandboxConfigFile(): string {
  const dsh = process.env.DSH_HOME?.trim() ? resolve(process.env.DSH_HOME) : join(homedir(), '.dsh')
  return join(dsh, 'profiles', PROFILE_NAME, 'cordis.patch.yml')
}

/**
 * 规范形态（保留大小写）：去首尾空白、折叠重复分隔符、去掉尾部分隔符。
 * 根目录（`/`、`C:/`）保持原样。
 */
export function canonicalPath(path: string): string {
  const trimmed = path.trim()
  if (trimmed === '') return ''
  const collapsed = trimmed.replace(/[\\/]{2,}/g, '/')
  const stripped = collapsed.replace(/[\\/]+$/, '')
  if (stripped === '') return collapsed
  return stripped.endsWith(':') ? stripped + '/' : stripped
}

/**
 * 路径比较键：规范化后再按平台决定是否忽略大小写。
 * 空串返回空串（调用方据此过滤非法项）。
 */
export function pathKey(path: string): string {
  const canonical = canonicalPath(path)
  if (canonical === '') return ''
  return process.platform === 'win32' ? canonical.toLowerCase() : canonical
}

export interface SandboxInspection {
  /**
   * dsh-write-protect 无独立远程服务；语义平移到「patch 配置就绪」
   * （profile 的 cordis.patch.yml 存在且可读 = 就绪，靠 live reload 生效）。
   */
  remoteAvailable: boolean
  configExists: boolean
  configReadable: boolean
  /** 当前**实际生效**的额外可写根（已按 dsh-write-protect 的优先级解析）。 */
  roots: string[]
  /** 期望同步但实际不在生效集合里的路径（按规范化路径比较）。 */
  missingExpected: string[]
  /** 生效来源：部署 base 还是设置页覆盖。 */
  effectiveSource: 'base' | 'override'
  /** patch 里是否存在设置页写回的顶层覆盖行。 */
  overrideRowPresent: boolean
}

/** patch 文档里三个关心的位置。 */
interface PatchLayout {
  /** 顶层 `- insert:` 条目的下标（policy 行所在）。 */
  insertIndex: number
  /** insert 数组里 policy 行的下标。 */
  policyIndex: number
  /** 顶层覆盖行下标（设置页写回），-1 表示不存在。 */
  overrideIndex: number
}

/** 定位 patch 文档里 policy 行与（可能的）顶层覆盖行。 */
function locate(doc: YAML.Document.Parsed): PatchLayout | undefined {
  const contents = doc.contents
  if (!YAML.isSeq(contents)) return undefined
  let insertIndex = -1
  let policyIndex = -1
  let overrideIndex = -1
  contents.items.forEach((entry, index) => {
    if (!YAML.isMap(entry)) return
    const insert = entry.get('insert')
    if (YAML.isSeq(insert)) {
      insert.items.forEach((inserted, i) => {
        if (!YAML.isMap(inserted)) return
        if (String(inserted.get('id', true) ?? '') === POLICY_ROW_ID) {
          insertIndex = index
          policyIndex = i
        }
      })
      return
    }
    const id = String(entry.get('id', true) ?? '')
    if (OVERRIDE_ROW_IDS.includes(id) && YAML.isMap(entry.get('config'))) overrideIndex = index
  })
  return { insertIndex, policyIndex, overrideIndex }
}

/** 从 patch 文本里取出 base 数组项（缺失/损坏 -> []）。 */
function extractBaseRoots(doc: YAML.Document.Parsed, layout: PatchLayout): string[] {
  if (layout.insertIndex < 0 || layout.policyIndex < 0) return []
  const row = doc.getIn([layout.insertIndex, 'insert', layout.policyIndex])
  if (!YAML.isMap(row)) return []
  const config = row.get('config')
  if (!YAML.isMap(config)) return []
  const wp = config.get(WRITABLE_FIELD)
  if (YAML.isSeq(wp)) {
    return wp.items.map(node => {
      if (node !== null && typeof node === 'object' && 'toJSON' in node && typeof (node as { toJSON: unknown }).toJSON === 'function') {
        return String((node as { toJSON: () => unknown }).toJSON())
      }
      return String(node)
    })
  }
  if (Array.isArray(wp)) return wp.filter((item): item is string => typeof item === 'string')
  return []
}

/** 从 patch 文档里取出设置页覆盖文本（不存在 -> undefined）。 */
function extractOverrideText(doc: YAML.Document.Parsed, layout: PatchLayout): string | undefined {
  if (layout.overrideIndex < 0) return undefined
  const config = doc.getIn([layout.overrideIndex, 'config'])
  if (!YAML.isMap(config)) return undefined
  const value = config.get(WRITABLE_OVERRIDE_FIELD)
  return typeof value === 'string' ? value : undefined
}

/** 解析 patch 文本（失败返回 undefined）。 */
function parsePatch(raw: string): YAML.Document.Parsed | undefined {
  try {
    const doc = YAML.parseDocument(raw)
    if (doc.errors.length > 0) return undefined
    return doc
  } catch {
    return undefined
  }
}

/** 只读检查：patch 文本 -> 生效来源与实际生效的额外可写根。 */
function readEffective(raw: string): { source: 'base' | 'override'; roots: string[]; overrideRowPresent: boolean } {
  const doc = parsePatch(raw)
  if (doc === undefined) return { source: 'base', roots: [], overrideRowPresent: false }
  const layout = locate(doc)
  if (layout === undefined) return { source: 'base', roots: [], overrideRowPresent: false }
  const base = extractBaseRoots(doc, layout)
  const override = extractOverrideText(doc, layout)
  // 与 dsh-write-protect 的 currentConfigValue 一致：只在 undefined 时回退 base。
  if (override === undefined) return { source: 'base', roots: base, overrideRowPresent: layout.overrideIndex >= 0 }
  return { source: 'override', roots: override.split('\n').map(l => l.trim()).filter(l => l !== ''), overrideRowPresent: true }
}

/** 读取 patch 文件文本（失败 -> undefined）。 */
async function readPatch(): Promise<string | undefined> {
  try {
    return await readFile(sandboxConfigFile(), 'utf8')
  } catch {
    return undefined
  }
}

/**
 * 调和一组原始条目：移掉「本插件上次贡献」，保留用户手配，再并入本次贡献。
 * 空项与重复项（按规范化路径）一律丢弃。
 */
function reconcile(raw: readonly string[], previous: readonly string[], next: readonly string[]): string[] {
  const previousKeys = new Set(previous.map(pathKey).filter(key => key !== ''))
  const out: string[] = []
  const seen = new Set<string>()
  const push = (entry: string): void => {
    // 写回规范形态：否则 `/a/b` 与 `/a/b/` 会以两行共存，下次调和再判重复。
    const canonical = canonicalPath(entry)
    const key = pathKey(canonical)
    if (key === '' || seen.has(key)) return
    seen.add(key)
    out.push(canonical)
  }
  for (const entry of raw) {
    const key = pathKey(entry)
    if (key === '' || previousKeys.has(key)) continue
    push(entry)
  }
  for (const entry of next) push(entry)
  return out
}

/** 换行分隔文本形态的调和（设置页覆盖字段）。 */
function reconcileText(text: string, previous: readonly string[], next: readonly string[]): string {
  return reconcile(text.split('\n'), previous, next).join('\n')
}

/** 只读检查沙盒依赖和已同步目录，不暴露配置中的其它敏感内容。 */
export async function inspectExtraRoots(ctx: Context, expected: readonly string[]): Promise<SandboxInspection> {
  void ctx
  const raw = await readPatch()
  if (raw === undefined) {
    return { remoteAvailable: false, configExists: false, configReadable: false, roots: [], missingExpected: [...expected], effectiveSource: 'base', overrideRowPresent: false }
  }
  const effective = readEffective(raw)
  const have = new Set(effective.roots.map(pathKey).filter(key => key !== ''))
  return {
    remoteAvailable: true,
    configExists: true,
    configReadable: true,
    roots: effective.roots,
    missingExpected: expected.filter(path => !have.has(pathKey(path))),
    effectiveSource: effective.source,
    overrideRowPresent: effective.overrideRowPresent,
  }
}

/** 原子写入 patch 文件（目录 0700、文件 0600）。 */
async function writePatch(raw: string, base: string[], previous: readonly string[], next: readonly string[]): Promise<void> {
  const doc = parsePatch(raw)
  if (doc === undefined) throw new Error('cordis.patch.yml is not parseable YAML')
  const layout = locate(doc)
  if (layout === undefined || layout.insertIndex < 0 || layout.policyIndex < 0) {
    throw new Error('dsh-write-protect-policy row not found in patch')
  }
  doc.setIn([layout.insertIndex, 'insert', layout.policyIndex, 'config', WRITABLE_FIELD], base)
  // 用户保存过设置页时 base 被整体遮蔽：同一个文本也要和解，否则本次同步不生效。
  if (layout.overrideIndex >= 0) {
    const current = extractOverrideText(doc, layout) ?? ''
    doc.setIn([layout.overrideIndex, 'config', WRITABLE_OVERRIDE_FIELD], reconcileText(current, previous, next))
  }
  const file = sandboxConfigFile()
  await mkdir(dirname(file), { recursive: true, mode: 0o700 })
  // 临时名带随机后缀：与 DSH 设置页的写入（写同一个文件）并发时不会互相踩。
  const tmp = `${file}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`
  await writeFile(tmp, String(doc), { mode: 0o600 })
  await rename(tmp, file)
  await chmod(file, 0o600).catch(() => {})
}

/**
 * 把选中目录同步进沙盒白名单（profile 的 dsh-write-protect 配置）。
 *
 * 同时更新部署 base 与（若存在的）设置页覆盖文本，保证「报告已同步」等于
 * 「实际生效」。
 * @param ctx - 宿主插件上下文（仅用于告警日志）。
 * @param previous - 上一次贡献的路径（本插件之前选中的工作区路径）。
 * @param next - 本次要贡献的路径（新选中的工作区路径）。
 * @returns 是否写入成功（失败只告警，不抛出）。
 */
export async function syncExtraRoots(ctx: Context, previous: readonly string[], next: readonly string[]): Promise<boolean> {
  // 空路径绝不能写进去：dsh-write-protect 构造函数对空项直接抛错，会让沙箱
  // policy 半区加载失败。路由层已拒绝，这里再兜一次。
  const wanted = next.map(path => path.trim()).filter(path => path !== '')
  const raw = await readPatch()
  if (raw === undefined) {
    ctx.logger?.warn('[dsh-workspace-combiner] failed to sync dsh-write-protect writablePaths: patch file unreadable')
    return false
  }
  try {
    const doc = parsePatch(raw)
    const layout = doc === undefined ? undefined : locate(doc)
    const base = doc === undefined || layout === undefined ? [] : extractBaseRoots(doc, layout)
    await writePatch(raw, reconcile(base, previous, wanted), previous, wanted)
    return true
  } catch (error) {
    ctx.logger?.warn('[dsh-workspace-combiner] failed to sync dsh-write-protect writablePaths:', error)
    return false
  }
}

/** 便于测试/诊断：从 patch 文本解析生效集合。 */
export function inspectPatchText(raw: string): { source: 'base' | 'override'; roots: string[]; overrideRowPresent: boolean } {
  return readEffective(raw)
}

/** 便于测试：纯函数形态的调和。 */
export const reconcilePaths = reconcile
