/**
 * DSH 工作区清理 smoke：删除插件工作空间时，DSH 左侧栏对应的工作区要一起清掉。
 *
 * 两条安全约束必须钉死：
 *  1. 先归档会话、后删工作区条目；
 *  2. **只要有会话归档失败（仍在运行），就绝不删条目**——否则会留下不属于任何工作区
 *     的活动会话。
 * @module dsh-workspace-combiner/scripts/dsh-workspace-retire-smoke
 */

import assert from 'node:assert/strict'
import { retireDshWorkspace, retitleDshWorkspace, type DshWorkspaceEntity, type DshWorkspaceRegistry } from '../src/host/dshWorkspaces.ts'

/** 记录调用顺序的假注册表。 */
function fakeRegistry(options: {
  entity?: DshWorkspaceEntity
  resolveThrows?: boolean
  archiveFails?: readonly string[]
  deleteThrows?: boolean
} = {}) {
  const calls: string[] = []
  const registry: DshWorkspaceRegistry = {
    async resolveByPath(path: string) {
      calls.push(`resolve:${path}`)
      if (options.resolveThrows === true) throw new Error('realpath failed')
      return options.entity
    },
    async archiveSession(sessionId: string, opts?: { stopActivity?: boolean }) {
      calls.push(`archive:${sessionId}:stop=${String(opts?.stopActivity)}`)
      if (options.archiveFails?.includes(sessionId) === true) throw new Error('session is active')
      return undefined
    },
    async delete(id: string) {
      calls.push(`delete:${id}`)
      if (options.deleteThrows === true) throw new Error('delete failed')
      return undefined
    },
  }
  return { registry, calls }
}

const entity = (sessionIds: readonly string[], onTitle?: (title: string) => void, titleThrows = false): DshWorkspaceEntity => ({
  id: 'ws-dsh-1',
  path: '/work/main',
  title: 'main',
  sessionIds,
  async setTitle(title: string) {
    onTitle?.(title)
    if (titleThrows) throw new Error('rename rejected')
    return undefined
  },
})

// ---- 1) 服务缺失：安静返回，不影响插件自身删除 ----
{
  const result = await retireDshWorkspace(undefined, '/work/main')
  assert.deepEqual(result, { archived: [], failed: [], removed: false, path: '/work/main' }, 'missing service must be a no-op')
}

// ---- 2) DSH 侧没有对应工作区 ----
{
  const { registry, calls } = fakeRegistry({ entity: undefined })
  const result = await retireDshWorkspace(registry, '/work/none')
  assert.deepEqual(result.archived, [], 'nothing to archive')
  assert.equal(result.removed, false, 'nothing to remove')
  assert.deepEqual(calls, ['resolve:/work/none'], 'no archive/delete when no workspace matches')
}

// ---- 3) 正常路径：归档全部会话 + 移除工作区条目 ----
{
  const { registry, calls } = fakeRegistry({ entity: entity(['s1', 's2']) })
  const result = await retireDshWorkspace(registry, '/work/main')
  assert.deepEqual(result.archived, ['s1', 's2'], 'every session of the workspace is archived')
  assert.deepEqual(result.failed, [], 'no failures expected')
  assert.equal(result.removed, true, 'the workspace entry is removed')
  assert.deepEqual(calls, [
    'resolve:/work/main',
    'archive:s1:stop=true',
    'archive:s2:stop=true',
    'delete:ws-dsh-1',
  ], 'archive sessions first, delete the workspace last; active work is stopped')
}

// ---- 4) 有会话归档失败：绝不删工作区条目 ----
{
  const { registry, calls } = fakeRegistry({ entity: entity(['s1', 's2', 's3']), archiveFails: ['s2'] })
  const result = await retireDshWorkspace(registry, '/work/main')
  assert.deepEqual(result.archived, ['s1', 's3'], 'the sessions that could be archived are reported')
  assert.deepEqual(result.failed, ['s2'], 'the stuck session is reported')
  assert.equal(result.removed, false, 'must not remove the workspace while a session still belongs to it')
  assert.ok(!calls.some(c => c.startsWith('delete:')), 'delete must not be called when any archive failed')
}

// ---- 5) 路径解析失败（目录已不存在）当作没有对应工作区 ----
{
  const { registry, calls } = fakeRegistry({ resolveThrows: true })
  const result = await retireDshWorkspace(registry, '/work/gone')
  assert.deepEqual(result, { archived: [], failed: [], removed: false, path: '/work/gone' }, 'unresolvable path is a no-op')
  assert.deepEqual(calls, ['resolve:/work/gone'], 'no further calls after a resolve failure')
}

// ---- 6) 空工作区（没有会话）：照样移除条目 ----
{
  const { registry, calls } = fakeRegistry({ entity: entity([]) })
  const result = await retireDshWorkspace(registry, '/work/main')
  assert.deepEqual(result.archived, [], 'no sessions to archive')
  assert.equal(result.removed, true, 'an empty workspace entry is still removed')
  assert.deepEqual(calls, ['resolve:/work/main', 'delete:ws-dsh-1'], 'no archive calls for an empty workspace')
}

// ---- 7) 删除失败：如实上报 removed=false，归档结果仍然保留 ----
{
  const { registry } = fakeRegistry({ entity: entity(['s1']), deleteThrows: true })
  const result = await retireDshWorkspace(registry, '/work/main')
  assert.deepEqual(result.archived, ['s1'], 'archived sessions are still reported')
  assert.equal(result.removed, false, 'a failed delete must not be reported as removed')
}

console.log('dsh workspace retire smoke: archive-then-delete, failure keeps the entry, missing service is a no-op OK')

// ------------------------------- 8) 重命名同步到 DSH 左栏
{
  // 8a. 服务缺失 / 参数为空：安静返回
  assert.equal(await retitleDshWorkspace(undefined, '/work/main', '新名字'), false, '没有注册表时返回 false')
  const { registry: empty } = fakeRegistry({ entity: undefined })
  assert.equal(await retitleDshWorkspace(empty, '', '新名字'), false, '空路径不处理')
  assert.equal(await retitleDshWorkspace(empty, '/work/main', ''), false, '空名称不处理')

  // 8b. DSH 侧没有对应工作区
  const none = fakeRegistry({ entity: undefined })
  assert.equal(await retitleDshWorkspace(none.registry, '/work/main', '新名字'), false, '找不到工作区返回 false')

  // 8c. 名字本来就一样：不调用 setTitle，但算成功
  const titles: string[] = []
  const same = fakeRegistry({ entity: entity([], t => titles.push(t)) })
  assert.equal(await retitleDshWorkspace(same.registry, '/work/main', 'main'), true, '同名视为已同步')
  assert.deepEqual(titles, [], '同名不应重复写')

  // 8d. 正常改名：把新名称写进 DSH
  const renamed: string[] = []
  const ok = fakeRegistry({ entity: entity([], t => renamed.push(t)) })
  assert.equal(await retitleDshWorkspace(ok.registry, '/work/main', '问卷采纳 (2)'), true, '改名成功')
  assert.deepEqual(renamed, ['问卷采纳 (2)'], 'DSH 侧收到新的显示名（含重名后缀）')

  // 8e. setTitle 失败 / 解析失败：返回 false，不抛
  const failing = fakeRegistry({ entity: entity([], undefined, true) })
  assert.equal(await retitleDshWorkspace(failing.registry, '/work/main', '新名字'), false, 'setTitle 失败返回 false')
  const broken = fakeRegistry({ resolveThrows: true })
  assert.equal(await retitleDshWorkspace(broken.registry, '/work/main', '新名字'), false, '解析失败返回 false')
  console.log('dsh workspace retitle: same-name no-op, rename writes title, failures are soft OK')
}
