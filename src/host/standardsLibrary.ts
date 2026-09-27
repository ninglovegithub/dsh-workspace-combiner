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
  private loaded = false
  private library: StandardsLibrary = emptyLibrary()
  private chain: Promise<void> = Promise.resolve()

  constructor(file: string = standardsLibraryFile()) {
    this.file = file
  }

  /** 读取库（首次读盘，之后走内存）。 */
  async get(): Promise<StandardsLibrary> {
    if (!this.loaded) {
      this.loaded = true
      try {
        this.library = parseLibrary(JSON.parse(await readFile(this.file, 'utf8')))
      } catch {
        this.library = emptyLibrary()
      }
    }
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

  private async persist(): Promise<void> {
    try {
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 })
      const tmp = this.file + '.' + process.pid + '.tmp'
      await writeFile(tmp, JSON.stringify(this.library, null, 2), { mode: 0o600 })
      await rename(tmp, this.file)
      await chmod(this.file, 0o600).catch(() => {})
    } catch {
      // 落盘失败不影响本次使用。
    }
  }
}
