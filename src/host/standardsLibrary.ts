/**
 * 全局开发规范库读写：~/.dsh/dsh-workspace-combiner-standards.json。
 * 存储内置规范的覆盖正文与全局自建规范；原子写、0600、内存缓存、失败静默降级。
 * @module dsh-workspace-combiner/host/standardsLibrary
 */

import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { emptyLibrary, parseCustomStandard, type StandardsLibrary } from '../core/standards.ts'
import type { CustomStandard } from '../core/types.ts'
import { dshHome } from '../store.ts'
import { warnIoFailure } from './fileIndex.ts'

/** 规范库文件路径。 */
export function standardsLibraryFile(): string {
  return join(dshHome(), 'dsh-workspace-combiner-standards.json')
}

/** 校验并规范化整份库。 */
export function parseLibrary(raw: unknown): StandardsLibrary {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return emptyLibrary()
  const record = raw as Record<string, unknown>
  const overrides: Record<string, string> = {}
  if (record.overrides !== null && typeof record.overrides === 'object' && !Array.isArray(record.overrides)) {
    for (const [key, value] of Object.entries(record.overrides as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim() !== '') overrides[key] = value
    }
  }
  const custom = Array.isArray(record.custom)
    ? record.custom.map(parseCustomStandard).filter((item): item is CustomStandard => item !== undefined)
    : []
  return { version: 1, overrides, custom }
}

/** 规范库：读一次缓存，整份替换写盘。 */
export class StandardsLibraryStore {
  private readonly file: string
  /**
   * 首次读盘的共享 promise。旧实现用一个布尔位在 await 之前置位：并发首个
   * get()（面板读库 / 会话创建解析规范）会让后到者拿到半初始化的空库。
   */
  private loading: Promise<void> | undefined
  private library: StandardsLibrary = emptyLibrary()
  private chain: Promise<void> = Promise.resolve()

  constructor(file: string = standardsLibraryFile()) {
    this.file = file
  }

  /** 读取库（首次读盘，之后走内存）。 */
  async get(): Promise<StandardsLibrary> {
    if (this.loading === undefined) this.loading = this.load()
    await this.loading
    return this.library
  }

  /** 整份替换并落盘（串行化）。 */
  async replace(next: StandardsLibrary): Promise<void> {
    await this.get()
    this.library = parseLibrary(next)
    const run = async (): Promise<void> => { await this.persist() }
    this.chain = this.chain.then(run, run)
    await this.chain
  }

  /** 一次性读盘；缺失（ENOENT）静默，损坏/不可读告警一次。 */
  private async load(): Promise<void> {
    try {
      this.library = parseLibrary(JSON.parse(await readFile(this.file, 'utf8')))
    } catch (error) {
      warnIoFailure('standards-library', this.file, error)
      this.library = emptyLibrary()
    }
  }

  private async persist(): Promise<void> {
    try {
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 })
      const tmp = this.file + '.' + process.pid + '.' + Math.random().toString(36).slice(2, 8) + '.tmp'
      await writeFile(tmp, JSON.stringify(this.library, null, 2), { mode: 0o600 })
      await rename(tmp, this.file)
      await chmod(this.file, 0o600).catch(() => {})
    } catch (error) {
      // 落盘失败不影响本次使用，但要能看见。
      warnIoFailure('standards-library', this.file, error)
    }
  }
}
