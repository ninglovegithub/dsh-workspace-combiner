/**
 * 宿主持久化存储：~/.dsh/dsh-workspace-combiner.json（或 $DSH_HOME 覆盖），
 * 保存「当前勾选的工作区」与「项目组合模板」。GUI 与 host 共享同一份数据。
 *
 * 持久化纪律（与 dsh-multi-root 一致）：目录 0700、文件 0600、临时文件 +
 * rename 原子替换，所有变更串行化到一条 promise 链，缺失/损坏时退化为空
 * （工作区与模板都是可重建状态，不是机密）。
 * @module dsh-workspace-combiner/store
 */

import { randomUUID } from 'node:crypto'
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { emptyStore, type StoreShape, type Template, type WorkspaceRef } from './core/types.ts'
import { STORE_FILE } from './invariant.ts'

/** 与 harness 的 DSH_HOME 约定一致：默认 ~/.dsh，可用 $DSH_HOME 覆盖。 */
export function dshHome(): string {
  const override = process.env.DSH_HOME?.trim()
  return override ? resolve(override) : join(homedir(), '.dsh')
}

/** 默认存储文件路径（测试可注入其它路径）。 */
export function defaultStoreFile(): string {
  return join(dshHome(), STORE_FILE)
}

/**
 * 持久化存储：构造时一次性加载，所有公开方法先 await readiness，
 * 避免慢磁盘与早到调用产生竞态。
 */
export class WorkspaceCombinerStore {
  private readonly file: string
  private shape: StoreShape = emptyStore()
  private readonly ready: Promise<void>
  private chain: Promise<void> = Promise.resolve()

  constructor(file: string = defaultStoreFile()) {
    this.file = file
    this.ready = this.load()
  }

  /** 当前勾选的工作区（空数组表示未勾选）。 */
  async getSelection(): Promise<readonly WorkspaceRef[]> {
    await this.ready
    return this.shape.selection
  }

  /** 覆盖当前勾选（触发持久化）。 */
  async setSelection(selection: readonly WorkspaceRef[]): Promise<void> {
    await this.ready
    await this.mutate(() => {
      this.shape = { ...this.shape, selection: [...selection] }
    })
  }

  /** 全部已保存模板（按更新时间倒序）。 */
  async getTemplates(): Promise<readonly Template[]> {
    await this.ready
    return this.shape.templates
  }

  /**
   * 保存模板：按名称 upsert（同名覆盖工作区引用列表），返回落盘后的模板。
   * @param name - 模板名（如「infoxmed 后端 + AI-FE 前端」）。
   * @param workspaces - 勾选的工作区引用（含 id/name/path，加载时可自动注册）。
   */
  async saveTemplate(name: string, workspaces: readonly WorkspaceRef[]): Promise<Template> {
    await this.ready
    const now = Date.now()
    let saved: Template | undefined
    await this.mutate(() => {
      const existing = this.shape.templates.find(t => t.name === name)
      saved = existing === undefined
        ? { id: randomUUID(), name, workspaces: [...workspaces], createdAt: now, updatedAt: now }
        : { ...existing, workspaces: [...workspaces], updatedAt: now }
      const rest = this.shape.templates.filter(t => t.name !== name)
      this.shape = { ...this.shape, templates: [saved!, ...rest] }
    })
    return saved!
  }

  /** 按 id 删除模板（幂等：未知 id 不写盘）。 */
  async deleteTemplate(id: string): Promise<void> {
    await this.ready
    await this.mutate(() => {
      const templates = this.shape.templates.filter(t => t.id !== id)
      if (templates.length === this.shape.templates.length) return
      this.shape = { ...this.shape, templates }
    })
  }

  /** 一次性加载；缺失/损坏退化为空存储。 */
  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.file, 'utf8')
      const parsed: unknown = JSON.parse(raw)
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Partial<StoreShape>
        this.shape = {
          version: 1,
          selection: Array.isArray(record.selection) ? record.selection : [],
          templates: (Array.isArray(record.templates) ? record.templates : [])
            .filter((t): t is Template => t !== null && typeof t === 'object' && Array.isArray((t as Template).workspaces)),
        }
      }
    } catch {
      // 缺失或损坏：从空存储开始。
    }
  }

  /** 串行化一次变更（内存更新 + 原子落盘）。 */
  private mutate(update: () => void): Promise<void> {
    const run = async (): Promise<void> => {
      update()
      await this.persist()
    }
    this.chain = this.chain.then(run, run)
    return this.chain
  }

  /** 原子落盘：临时文件 + rename，目录 0700、文件 0600。 */
  private async persist(): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 })
    const tmp = `${this.file}.${process.pid}.tmp`
    await writeFile(tmp, JSON.stringify(this.shape, null, 2), { mode: 0o600 })
    await rename(tmp, this.file)
    await chmod(this.file, 0o600).catch(() => {
      // 平台不支持 chmod 语义时尽力而为；open 时的 mode 已生效。
    })
  }
}
