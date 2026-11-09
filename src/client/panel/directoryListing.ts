/**
 * DSH 目录选择器（browse 能力）返回值的宿主无关视图。
 *
 * 宿主把 list() 的结果放在 `{ ok, value }` 里，value 的形状是
 * `{ path, home, crumbs, entries, truncated }`。这里做一次防御性归一化：
 * 字段缺失或类型不对时退化成空值，避免整个面板因为一个字段挂掉。
 *
 * @module dsh-workspace-combiner/client/panel/directoryListing
 */

/** 一层目录里的一个可进入条目。 */
export interface DirectoryEntry {
  readonly name: string
  readonly path: string
  readonly hidden: boolean
}

/** 面包屑的一段。 */
export interface DirectoryCrumb {
  readonly name: string
  readonly path: string
}

/** 一层目录的完整列表。 */
export interface DirectoryListing {
  /** 当前目录的绝对路径。 */
  readonly path: string
  /** 宿主 home 目录（「回到首页」用）。 */
  readonly home: string
  /** 从根到当前目录的面包屑。 */
  readonly crumbs: readonly DirectoryCrumb[]
  /** 子目录（只含可进入的目录）。 */
  readonly entries: readonly DirectoryEntry[]
  /** 条目是否被宿主截断。 */
  readonly truncated: boolean
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

function toEntry(value: unknown): DirectoryEntry | null {
  if (typeof value !== 'object' || value === null) return null
  const row = value as Record<string, unknown>
  const name = text(row.name)
  const path = text(row.path)
  if (name === '' || path === '') return null
  return { name, path, hidden: row.hidden === true }
}

function toCrumb(value: unknown): DirectoryCrumb | null {
  if (typeof value !== 'object' || value === null) return null
  const row = value as Record<string, unknown>
  const path = text(row.path)
  if (path === '') return null
  return { name: text(row.name) === '' ? path : text(row.name), path }
}

/**
 * 把宿主的原始 payload 归一化成 {@link DirectoryListing}。
 * @param value - `remote.directoryPicker.list()` 的 value。
 * @returns 归一化后的列表；缺字段时给出空数组。
 */
export function toListing(value: unknown): DirectoryListing {
  const row = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const entries = Array.isArray(row.entries) ? row.entries.map(toEntry).filter((item): item is DirectoryEntry => item !== null) : []
  const crumbs = Array.isArray(row.crumbs) ? row.crumbs.map(toCrumb).filter((item): item is DirectoryCrumb => item !== null) : []
  return {
    path: text(row.path),
    home: text(row.home),
    crumbs,
    entries,
    truncated: row.truncated === true,
  }
}

/** 取上一级目录的路径（没有父级时返回空串）。 */
export function parentListingPath(listing: DirectoryListing): string {
  const parent = listing.crumbs.length >= 2 ? listing.crumbs[listing.crumbs.length - 2] : undefined
  return parent?.path ?? ''
}
