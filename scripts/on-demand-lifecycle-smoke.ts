import assert from 'node:assert/strict'
import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { WorkspaceRef } from '../src/core/types.ts'

/**
 * 按需上下文落盘的生命周期调和回归（H13）：
 *   1. 落盘进行中会话被销毁 → 写完必须自查并回收刚创建的目录，不留下孤儿；
 *   2. 可选的 isAlive 回调可以显式判定存活/已销毁；
 *   3. 会话被重建后，早先那次过期落盘不得删掉新生命周期的目录。
 */

const root = await mkdtemp(join(tmpdir(), 'wcb-on-demand-lifecycle-'))
process.env.DSH_HOME = root

try {
  const { cleanupOnDemandContext, contextManifestFile, persistOnDemandContext } = await import('../src/host/onDemandContext.ts')
  const directories: WorkspaceRef[] = [{ id: '/repo', name: 'repo', path: '/repo', access: 'readwrite' }]
  const write = (sessionId: string, isAlive?: () => boolean) =>
    persistOnDemandContext(sessionId, 'ws', directories, [], [], [], [], [], [], 'summary', isAlive)

  // 1) 落盘期间销毁：tick 在函数入口同步领号，销毁紧跟着同步记墓碑（无 await 间隙），顺序确定。
  const pending = write('race')
  const cleanup = cleanupOnDemandContext('race')
  assert.deepEqual(await pending, {}, '销毁期间落盘的文件必须被回收，且不返回任何路径')
  await cleanup
  await assert.rejects(access(contextManifestFile('race')), '孤儿上下文目录不得残留')

  // 2) 显式 isAlive=false → 同样回收。
  assert.deepEqual(await write('dead', () => false), {})
  await assert.rejects(access(contextManifestFile('dead')))

  // 3) 显式 isAlive=true 与从未销毁 → 正常返回路径（行为对旧调用方不变）。
  const alive = await write('live', () => true)
  assert.equal(alive.manifestPath, contextManifestFile('live'))
  const normal = await write('normal')
  assert.equal(normal.manifestPath, contextManifestFile('normal'))
  await access(normal.manifestPath!)

  // 4) 销毁后同一 sessionId 重新落盘（会话被重建）：新目录必须活下来。
  const stale = write('resume')
  await cleanupOnDemandContext('resume')
  const fresh = write('resume')
  const [freshFiles, staleFiles] = await Promise.all([fresh, stale])
  assert.equal(freshFiles.manifestPath, contextManifestFile('resume'))
  // 过期那次只允许返回「新路径」或「空」——无论哪种都不能把新目录删掉。
  assert.ok(staleFiles.manifestPath === undefined || staleFiles.manifestPath === contextManifestFile('resume'))
  await access(contextManifestFile('resume'))

  await cleanupOnDemandContext('live')
  await cleanupOnDemandContext('normal')
  await cleanupOnDemandContext('resume')

  // 5) 并发压力：同一会话「落盘 - 清理 - 落盘」并发跑多次。
  // 清理是 rm -rf，落盘要在同目录里写临时文件再 rename；不串行化时 macOS 上会在
  // open/rename 上抛 EINVAL，写失败被吞成"文件没写"，新的那次落盘会返回空的路径集
  // （正是本轮实测到的偶发失败：61/200）。这里断言新生命周期的那次必须是完整的。
  let incomplete = 0
  for (let i = 0; i < 60; i++) {
    const id = `stress-${i}`
    const stale = write(id)
    await cleanupOnDemandContext(id)
    const fresh = write(id)
    const [freshFiles, staleFiles] = await Promise.all([fresh, stale])
    // 过期的那个只允许「空」或「与新的一致」；新的那个 manifest 必须落地
    // （空内容的索引文件按设计不生成，所以只断言 manifest + 实际可读）。
    assert.ok(staleFiles.manifestPath === undefined || staleFiles.manifestPath === contextManifestFile(id))
    if (freshFiles.manifestPath !== contextManifestFile(id)) incomplete++
    else await access(contextManifestFile(id)).catch(() => { incomplete++ })
    await cleanupOnDemandContext(id)
  }
  assert.equal(incomplete, 0, 'concurrent persist/cleanup must never truncate the surviving generation')
  console.log('concurrent persist/cleanup stress OK')

  console.log('on-demand lifecycle smoke: dispose-during-scan cleanup, isAlive override and resume-safe reconciliation OK')
} finally {
  await rm(root, { recursive: true, force: true })
}
