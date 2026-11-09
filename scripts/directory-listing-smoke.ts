/**
 * 内置目录浏览器的纯逻辑测试：宿主 payload 归一化 + 上一级推导。
 *
 * browse 宿主返回 `{ path, home, crumbs, entries, truncated }`；任何字段缺失
 * 都必须退化成安全默认值，否则面板会因为一个 undefined 直接白屏。
 */

import assert from 'node:assert/strict'

const { toListing, parentListingPath } = await import('../src/client/panel/directoryListing.ts')

// ---- 1) 正常 payload ----
{
  const listing = toListing({
    path: '/work/proj',
    home: '/home/dev',
    crumbs: [
      { name: '/', path: '/' },
      { name: 'work', path: '/work' },
      { name: 'proj', path: '/work/proj' },
    ],
    entries: [
      { name: 'src', path: '/work/proj/src', hidden: false },
      { name: '.git', path: '/work/proj/.git', hidden: true },
    ],
    truncated: true,
  })
  assert.equal(listing.path, '/work/proj')
  assert.equal(listing.home, '/home/dev')
  assert.equal(listing.crumbs.length, 3)
  assert.equal(listing.entries.length, 2)
  assert.equal(listing.entries[1].hidden, true)
  assert.equal(listing.truncated, true)
  assert.equal(parentListingPath(listing), '/work')
  console.log('full payload OK')
}

// ---- 2) 根目录：没有上一级 ----
{
  const root = toListing({ path: '/', crumbs: [{ name: '/', path: '/' }], entries: [] })
  assert.equal(parentListingPath(root), '', '根目录没有上一级')
  console.log('root has no parent OK')
}

// ---- 3) 脏数据：缺字段/类型不对/条目缺 path ----
{
  const empty = toListing(undefined)
  assert.deepEqual(empty.entries, [])
  assert.deepEqual(empty.crumbs, [])
  assert.equal(empty.path, '')
  assert.equal(empty.truncated, false)

  const partial = toListing({
    path: '/x',
    crumbs: [{ path: '/x' }, null, 42],
    entries: [{ name: 'ok', path: '/x/ok' }, { name: 'no-path' }, null, 'junk'],
  })
  assert.equal(partial.entries.length, 1, '缺 path 或非对象的条目被丢弃')
  assert.equal(partial.entries[0].name, 'ok')
  assert.equal(partial.crumbs.length, 1, '只有带 path 的面包屑保留')
  assert.equal(partial.crumbs[0].name, '/x', '面包屑缺 name 时用 path 兜底')
  console.log('dirty payload degrades safely OK')
}

console.log('directory listing smoke: normalization, parent derivation and dirty payloads OK')
