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
import { retireDshWorkspace, type DshWorkspaceEntity, type DshWorkspaceRegistry } from '../src/host/dshWorkspaces.ts'

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

const entity = (sessionIds: readonly string[]): DshWorkspaceEntity => ({
  id: 'ws-dsh-1',
  path: '/work/main',
  title: 'main',
  sessionIds,
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
