/**
 * 新建向导默认保存位置 smoke：预填值必须可靠、且不能把用户锁死在某个位置。
 *
 * 覆盖三件事：
 *  1. `parentDir` / `joinPath` 的跨平台行为（`/` 与 `\`、末尾分隔符、盘符根）；
 *  2. 默认值的优先级（上次用过 > 当前工作空间 > 任一工作空间 > 空）；
 *  3. localStorage 不可用（隐私模式 / 存储被禁）时安静降级，不抛错。
 * @module dsh-workspace-combiner/scripts/wizard-defaults-smoke
 */

import assert from 'node:assert/strict'
import { deriveDefaultBasePath, joinPath, parentDir, readLastBasePath, rememberBasePath } from '../src/client/panel/defaults.ts'

/** 装一个最小的 localStorage 桩，避免测试依赖 Node 的实验性 webstorage。 */
function installStorage(impl: { get: (k: string) => string | null; set: (k: string, v: string) => void } | null): void {
  if (impl === null) {
    delete (globalThis as { localStorage?: unknown }).localStorage
    return
  }
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => impl.get(k),
    setItem: (k: string, v: string) => impl.set(k, v),
  }
}

/** 造一个只有主目录的工作空间（defaults 只关心 directories[0].path）。 */
const ws = (id: string, mainPath: string) => ({
  id,
  name: id,
  directories: [{ id: mainPath, name: id, path: mainPath, access: 'readwrite' as const, group: 'other' as const }],
  mode: 'anchor' as const,
  loadMode: 'summary' as const,
})

// ---- 1) parentDir ----
assert.equal(parentDir('/Users/maning/myCombiner/AIGC'), '/Users/maning/myCombiner', '普通路径取父目录')
assert.equal(parentDir('/Users/maning/myCombiner/AIGC/'), '/Users/maning/myCombiner', '末尾分隔符要忽略')
assert.equal(parentDir('/Users/maning/myCombiner/AIGC///'), '/Users/maning/myCombiner', '多个末尾分隔符也要忽略')
assert.equal(parentDir('/AIGC'), '/', '一层目录的父目录是根')
assert.equal(parentDir('C:\\work\\proj'), 'C:\\work', 'Windows 反斜杠路径')
assert.equal(parentDir('C:\\proj'), 'C:\\', 'Windows 盘符根要保留分隔符')
assert.equal(parentDir('AIGC'), '', '相对路径没有父目录')
assert.equal(parentDir(''), '', '空串返回空串')

// ---- 2) joinPath ----
assert.equal(joinPath('/Users/maning/myCombiner', 'AIGC'), '/Users/maning/myCombiner/AIGC', '正常拼接')
assert.equal(joinPath('/Users/maning/myCombiner/', 'AIGC'), '/Users/maning/myCombiner/AIGC', 'base 末尾有斜杠不重复')
assert.equal(joinPath('/Users/maning/myCombiner', '/AIGC'), '/Users/maning/myCombiner/AIGC', 'name 开头有斜杠不重复')
assert.equal(joinPath('', 'AIGC'), 'AIGC', 'base 为空直接给名字')
assert.equal(joinPath('C:\\work', 'proj'), 'C:\\work\\proj', '反斜杠路径沿用反斜杠')

// ---- 3) 默认值优先级 ----
const spaces = [ws('w1', '/base/first/app'), ws('w2', '/base/second/app')]

// 3a. 上次用过 > 其它一切
installStorage({ get: () => '/picked/last', set: () => {} })
assert.equal(readLastBasePath(), '/picked/last', '能读回上次的保存位置')
assert.equal(deriveDefaultBasePath(spaces, 'w2'), '/picked/last', '上次用过优先于当前工作空间')

// 3b. 没有上次记录时用当前工作空间主目录的父目录
installStorage(null)
assert.equal(readLastBasePath(), null, '没有本地存储时读不到上次位置')
assert.equal(deriveDefaultBasePath(spaces, 'w2'), '/base/second', '退到当前工作空间主目录的父目录')

// 3c. 当前工作空间不存在时用第一个工作空间
assert.equal(deriveDefaultBasePath(spaces, 'missing'), '/base/first', '退到任一工作空间主目录的父目录')
assert.equal(deriveDefaultBasePath(spaces, null), '/base/first', 'currentWorkspaceId 为 null 时同样退到第一个')

// 3d. 什么都没有时留空（用户仍需自己选）
assert.equal(deriveDefaultBasePath([], null), '', '没有任何线索时返回空串')

// ---- 4) 记住位置：去空白、空串不写、存储抛错不炸 ----
const written: Array<[string, string]> = []
installStorage({ get: () => null, set: (k, v) => { written.push([k, v]) } })
rememberBasePath('  /picked/trimmed  ')
assert.deepEqual(written, [['dsh-workspace-combiner:lastBasePath', '/picked/trimmed']], '写入时去掉首尾空白')
written.length = 0
rememberBasePath('   ')
assert.equal(written.length, 0, '空串不写入')

installStorage({ get: () => null, set: () => { throw new Error('quota exceeded') } })
rememberBasePath('/anywhere')  // 不能抛出

installStorage({ get: () => { throw new Error('storage disabled') }, set: () => { throw new Error('storage disabled') } })
assert.equal(readLastBasePath(), null, '存储不可用时安静返回 null')
assert.equal(deriveDefaultBasePath(spaces, 'w1'), '/base/first', '存储不可用时仍能靠工作空间推导')

installStorage(null)
console.log('wizard defaults smoke: parentDir / joinPath / 默认值优先级 / 存储降级 OK')
