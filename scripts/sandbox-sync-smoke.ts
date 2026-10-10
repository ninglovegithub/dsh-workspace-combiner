/**
 * 沙盒联动 smoke：验证 dsh-write-protect 配置写入的三条纪律。
 *
 *   1. 路径归一化：`/a/b` 与 `/a/b/` 视为同一目录（否则白名单会反复追加重复项，
 *      诊断项也会永远误报「未同步」）。
 *   2. 生效来源解析与 dsh-write-protect 的 `currentConfigValue(writablePatterns,
 *      writablePaths)` 一致：设置页保存过覆盖字段时以覆盖字段为准。
 *   3. 写入时两处都和解，且只撤「本插件上次贡献」的路径，保留用户手配目录；
 *      空路径一律不写入（写进去会让 policy 半区构造函数抛错）。
 *
 * 全程使用临时 DSH_HOME，不触碰真实 profile。
 * @module dsh-workspace-combiner/scripts/sandbox-sync-smoke
 */

import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const home = await mkdtemp(join(tmpdir(), 'wcb-sandbox-smoke-'))
process.env.DSH_HOME = home
process.env.DSH_PROFILE = 'desktop'

const { inspectExtraRoots, inspectPatchText, pathKey, reconcilePaths, syncExtraRoots } = await import('../src/sandbox-sync.ts')

const profileDir = join(home, 'profiles', 'desktop')
const patchFile = join(profileDir, 'cordis.patch.yml')
await mkdir(profileDir, { recursive: true })

const FIXTURE = `# profile patch fixture
- id: ui-theme
  name: "@deepseek-ai/dsh-client-ui-theme"
  config:
    preference: dark
- insert:
    - id: dsh-write-protect-policy
      name: dsh-write-protect
      config:
        writablePaths:
          - /Users/someone/hand-added
- id: dsh-write-protect-policy
  name: dsh-write-protect
  config:
    writablePatterns: |
      /Users/someone/settings-added
`

// ---------------------------------------------------------------- 1) pathKey
assert.equal(pathKey('/a/b/'), pathKey('/a/b'), 'trailing separator must not create a second identity')
assert.equal(pathKey('/a//b'), pathKey('/a/b'), 'duplicate separators must collapse')
assert.equal(pathKey('   '), '', 'blank path must normalize to the empty key')
if (process.platform === 'win32') assert.equal(pathKey('C:/Work'), pathKey('c:/work'))
console.log('pathKey normalization OK')

// ------------------------------------------------- 2) 生效来源解析（无覆盖行）
const baseOnly = `- insert:
    - id: dsh-write-protect-policy
      name: dsh-write-protect
      config:
        writablePaths:
          - /a
          - /b
`
const parsedBase = inspectPatchText(baseOnly)
assert.equal(parsedBase.source, 'base')
assert.deepEqual(parsedBase.roots, ['/a', '/b'])
assert.equal(parsedBase.overrideRowPresent, false)

// 覆盖行存在 -> 覆盖 win（即使为空串，也要遮蔽 base，与 currentConfigValue 一致）
const withOverride = `${baseOnly}- id: dsh-write-protect-policy
  name: dsh-write-protect
  config:
    writablePatterns: "/only-this"
`
const parsedOverride = inspectPatchText(withOverride)
assert.equal(parsedOverride.source, 'override')
assert.deepEqual(parsedOverride.roots, ['/only-this'])

const emptyOverride = `${baseOnly}- id: dsh-write-protect-policy
  name: dsh-write-protect
  config:
    writablePatterns: ""
`
assert.deepEqual(inspectPatchText(emptyOverride).roots, [], 'empty override must shadow the base')
console.log('effective-source resolution OK')

// ------------------------------------------------------------ 3) 纯函数调和
assert.deepEqual(reconcilePaths(['/keep', '/old/', ''], ['/old'], ['/new', '/new/', '']), ['/keep', '/new'])
console.log('reconcile OK')

// ---------------------------------------------------- 4) 真实写入：两处都和解
const ctx = { logger: { warn: (...args: unknown[]) => { throw new Error('unexpected warn: ' + args.join(' ')) } } } as never

await writeFile(patchFile, FIXTURE, 'utf8')
const first = await syncExtraRoots(ctx, [], ['/work/proj/'])
assert.equal(first, true, 'first sync must succeed')

let text = await readFile(patchFile, 'utf8')
assert.ok(text.includes('/Users/someone/hand-added'), 'user base entry must survive')
assert.ok(text.includes('/Users/someone/settings-added'), 'user override entry must survive')
assert.ok(text.includes('/work/proj'), 'new contribution must land in the base')
assert.ok(!text.includes('/work/proj/'), 'trailing separator must be normalized away')

// 覆盖字段也必须拿到本次贡献，否则「报告已同步、实际不生效」
const afterFirst = await inspectExtraRoots(ctx, ['/work/proj'])
assert.equal(afterFirst.effectiveSource, 'override')
assert.deepEqual(afterFirst.missingExpected, [], 'effective set must contain the contribution')
console.log('write into base + override OK')

// ------------------------------------------- 5) 切换：旧贡献撤掉，用户手配保留
const second = await syncExtraRoots(ctx, ['/work/proj'], ['/work/other'])
assert.equal(second, true)
text = await readFile(patchFile, 'utf8')
assert.ok(!text.includes('/work/proj'), 'previous contribution must be removed')
assert.ok(text.includes('/work/other'), 'new contribution must be present')
assert.ok(text.includes('/Users/someone/hand-added') && text.includes('/Users/someone/settings-added'), 'user entries must still survive')
assert.deepEqual((await inspectExtraRoots(ctx, ['/work/other'])).missingExpected, [])
console.log('reconcile across switches OK')

// ------------------------------------------------ 6) 空路径绝不写入配置
await syncExtraRoots(ctx, ['/work/other'], ['/work/final', '', '   '])
text = await readFile(patchFile, 'utf8')
const writableSection = text.slice(text.indexOf('writablePaths:'))
assert.ok(!/- ""/.test(writableSection), 'blank entries must never be written (policy half throws on them)')
assert.ok(!/- "   "/.test(writableSection), 'whitespace-only entries must never be written')
const final = await inspectExtraRoots(ctx, ['/work/final'])
assert.deepEqual(final.missingExpected, [])
assert.ok(final.roots.every(root => root.trim() !== ''), 'no blank entry may be effective')
console.log('blank path rejection OK')

// ------------------------------------------- 7) 归一化比较：尾斜杠不再误报
assert.deepEqual((await inspectExtraRoots(ctx, ['/work/final/'])).missingExpected, [], 'trailing separator must not be reported as missing')
console.log('normalized comparison OK')

// ------------------------------------------- 8) 配置不可读时如实报告失败
process.env.DSH_HOME = join(home, 'does-not-exist')
const missing = await inspectExtraRoots(ctx, ['/x'])
assert.equal(missing.configExists, false)
assert.deepEqual(missing.missingExpected, ['/x'])
console.log('unreadable patch reported as missing OK')

console.log('sandbox-sync smoke: normalization, effective source, dual reconciliation and blank-path rejection OK')
