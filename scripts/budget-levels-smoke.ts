/**
 * 预算档位 smoke：把裸 token 数字换成「按需 / 常驻 + 三档密度」之后，
 * 映射必须可逆、可解释，否则用户点了一个档位却被显示成另一个。
 *
 * 关键不变量：
 *  1. `off` 严格等于 0（0 仍然是「不常驻」的内部表示，只是不再暴露给用户）；
 *  2. 每个档位的 token 值都能映射回同一个档位（无「自定义」误报）；
 *  3. 中间值取**最接近**的档位，距离相同取更省的那档；
 *  4. 三档必须严格递增，否则界面顺序与语义相反。
 * @module dsh-workspace-combiner/scripts/budget-levels-smoke
 */

import assert from 'node:assert/strict'
import { BUDGET_BLOCKS, BUDGET_LEVEL_TOKENS, RESIDENT_LEVELS, matchBudgetLevel, tokensOfLevel } from '../src/core/budgetLevels.ts'

// ---- 1) off = 0，且四类区块都覆盖到 ----
assert.deepEqual([...BUDGET_BLOCKS].sort(), ['codeIndex', 'commands', 'fileIndex', 'standards'], '四类受预算控制的区块都要在表里')

for (const block of BUDGET_BLOCKS) {
  assert.equal(tokensOfLevel(block, 'off'), 0, block + '：按需就是 0')
  for (const level of RESIDENT_LEVELS) {
    const tokens = tokensOfLevel(block, level)
    assert.ok(tokens > 0, block + '/' + level + '：常驻档位必须 > 0')
    // 2) 可逆：档位 -> token -> 档位，不能变成「自定义」
    assert.deepEqual(matchBudgetLevel(block, tokens), { level, custom: false }, block + '/' + level + '：值必须能映射回同一档')
  }
  // 4) 严格递增
  const [compact, standard, detailed] = RESIDENT_LEVELS.map(level => tokensOfLevel(block, level))
  assert.ok(compact < standard && standard < detailed, block + '：三档必须严格递增')
}

// ---- 2) 0 / 负数 / NaN 都算按需 ----
for (const block of BUDGET_BLOCKS) {
  for (const value of [0, -1, Number.NaN]) {
    assert.deepEqual(matchBudgetLevel(block, value), { level: 'off', custom: false }, block + '：' + String(value) + ' 视为按需')
  }
}

// ---- 3) 中间值：取最接近的一档并标记自定义 ----
{
  // standards: 400 / 800 / 2000
  assert.deepEqual(matchBudgetLevel('standards', 500), { level: 'compact', custom: true }, '500 更接近 400')
  assert.deepEqual(matchBudgetLevel('standards', 700), { level: 'standard', custom: true }, '700 更接近 800')
  assert.deepEqual(matchBudgetLevel('standards', 1500), { level: 'detailed', custom: true }, '1500 更接近 2000')
  assert.deepEqual(matchBudgetLevel('standards', 64000), { level: 'detailed', custom: true }, '远超最高档也只落到 detailed')

  // 距离相同（600 = 400 与 800 的中点）取更省的那档，避免把中间值显示成更贵的一档。
  assert.deepEqual(matchBudgetLevel('standards', 600), { level: 'compact', custom: true }, '等距时取更省的一档')
}

// ---- 4) 与既有预设对齐：这两档直接沿用了预设里验证过的数值 ----
assert.equal(BUDGET_LEVEL_TOKENS.fileIndex.detailed, 42000, '文件索引「详细」= deep 预设的 42000')
assert.equal(BUDGET_LEVEL_TOKENS.codeIndex.standard, 5000, '功能索引「标准」= deep 预设的 5000')
assert.equal(BUDGET_LEVEL_TOKENS.standards.standard, 800, '规范「标准」= 新建工作空间的默认预算')

console.log('budget levels smoke: 按需=0 / 档位可逆 / 等距取省 / 三档递增 / 与预设对齐 OK')
