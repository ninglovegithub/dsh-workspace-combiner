/**
 * 分组枚举 smoke：分组是持久化数据，而界面语言可运行时切换。
 *
 * 落盘必须是稳定枚举（`doc`/`backend`/…），渲染时才映射成中文；同时必须兼容历史
 * 数据里的中英文旧文案——兼容不了就会出现「切一次语言，分组颜色、下拉选中、
 * 文档目录判定集体失效」。
 * @module dsh-workspace-combiner/scripts/groups-smoke
 */

import assert from 'node:assert/strict'
import { GROUP_KINDS, groupKindOf, groupLabel, isDocumentGroup } from '../src/core/groups.ts'

// ---- 1) 枚举值自洽 ----
for (const kind of GROUP_KINDS) {
  assert.equal(groupKindOf(kind), kind, `${kind} must round-trip`)
  assert.notEqual(groupLabel(kind), '', `${kind} must render a label`)
}
assert.deepEqual([...GROUP_KINDS], ['doc', 'backend', 'frontend', 'ref', 'other'])
console.log('kind round-trip OK')

// ---- 2) 历史文案仍能识别（旧数据不能被丢掉）----
const legacy = [
  ['文档', 'doc'], ['文档锚点', 'doc'], ['Docs', 'doc'], ['DOCUMENTATION', 'doc'],
  ['后端', 'backend'], ['服务端', 'backend'], ['Backend', 'backend'],
  ['前端', 'frontend'], ['Front-End', 'frontend'], ['web', 'frontend'],
  ['参考', 'ref'], ['依赖', 'ref'], ['Reference', 'ref'],
  ['其它', 'other'], ['misc', 'other'],
] as const
for (const [raw, expected] of legacy) {
  assert.equal(groupKindOf(raw), expected, `${raw} must normalize to ${expected}`)
}
console.log('legacy alias normalization OK')

// ---- 3) 渲染回中文（prompt 固定中文），未知值原样透传 ----
assert.equal(groupLabel('doc'), '文档')
assert.equal(groupLabel('backend'), '后端')
assert.equal(groupLabel('后端'), '后端', 'legacy value must render in Chinese too')
assert.equal(groupLabel('某个自定义分组'), '某个自定义分组', 'unknown values must pass through unchanged')
assert.equal(groupLabel(undefined), '')
assert.equal(groupLabel(''), '')
console.log('label mapping OK')

// ---- 4) 文档目录判定对新旧取值一致 ----
for (const value of ['doc', '文档', 'Docs', '文档锚点']) {
  assert.equal(isDocumentGroup(value), true, `${value} must count as a document directory`)
}
for (const value of ['backend', '后端', 'frontend', '', undefined, '自定义']) {
  assert.equal(isDocumentGroup(value), false, `${value} must not count as a document directory`)
}
console.log('document-group detection OK')

// ---- 5) 空白输入不产生伪分组 ----
assert.equal(groupKindOf('   '), undefined)
assert.equal(groupKindOf(undefined), undefined)
console.log('blank input OK')

console.log('groups smoke: stable enum storage, legacy alias compatibility and Chinese rendering OK')
