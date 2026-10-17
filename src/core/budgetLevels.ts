/**
 * 上下文预算的「档位」表达。
 *
 * 用户看不懂裸 token 数字（`0` 同时意味着"关闭"和"按需"，`2000` 与 `8000` 差在哪
 * 也没有参照系）。这里把四类区块的预算换成人能理解的表达：
 *
 *  - **按需（off）**：不常驻上下文，内容落到会话目录、只给模型一条 grep/read 线索（= token 0）
 *  - **常驻**：再分 `精简 / 标准 / 详细` 三档，每档对应一个固定 token 值
 *
 * 界面只展示档位与"实际占用"，具体数字收进「高级」。内部仍以 token 为准，
 * 所以本模块是纯映射，不改变既有数据结构。
 *
 * @module dsh-workspace-combiner/core/budgetLevels
 */

/** 受预算控制的四类区块。 */
export type BudgetBlock = 'standards' | 'commands' | 'codeIndex' | 'fileIndex'

/** 界面展示顺序：先是最常调的规范与命令，再是索引类。 */
export const BUDGET_BLOCKS: readonly BudgetBlock[] = ['standards', 'commands', 'codeIndex', 'fileIndex']

/** 档位：`off` = 按需（不常驻）。 */
export type BudgetLevel = 'off' | 'compact' | 'standard' | 'detailed'

/** 常驻时的三档（升序）。 */
export const RESIDENT_LEVELS: readonly Exclude<BudgetLevel, 'off'>[] = ['compact', 'standard', 'detailed']

/**
 * 各块三档对应的 token 值。
 *
 * 取值有依据，不是拍脑袋：文件索引三档沿用 `economy / balanced / deep` 预设里
 * 已经验证过的量级（5000 / 16000 / 42000）；功能索引沿用 deep 的 5000 作为"标准"；
 * 规范"标准"= 800，正好放下「会话锚点边界」（约 350 token）并留出追加余量。
 */
export const BUDGET_LEVEL_TOKENS: Record<BudgetBlock, Record<Exclude<BudgetLevel, 'off'>, number>> = {
  fileIndex: { compact: 4000, standard: 16000, detailed: 42000 },
  codeIndex: { compact: 1500, standard: 5000, detailed: 12000 },
  standards: { compact: 400, standard: 800, detailed: 2000 },
  commands: { compact: 300, standard: 800, detailed: 2000 },
}

/**
 * 档位 → token 值。
 * @param block - 区块。
 * @param level - 档位；`off` 返回 0（= 按需，不常驻）。
 * @returns token 预算。
 */
export function tokensOfLevel(block: BudgetBlock, level: BudgetLevel): number {
  return level === 'off' ? 0 : BUDGET_LEVEL_TOKENS[block][level]
}

/** 档位映射结果。 */
export interface BudgetLevelMatch {
  /** 最接近的档位；`off` 表示当前是按需。 */
  readonly level: BudgetLevel
  /** 当前值不等于任何档位（用户手填过数字），界面可标「自定义」。 */
  readonly custom: boolean
}

/**
 * 把 token 值映射回档位。
 *
 * 不等档位时取**最接近**的一档；距离相同取更省的那一档（三档升序遍历 + 严格小于），
 * 避免把 `2000` 这种中间值显示成更贵的档。
 * @param block - 区块。
 * @param tokens - 当前预算值；<= 0 视为按需。
 * @returns 档位与是否自定义。
 */
export function matchBudgetLevel(block: BudgetBlock, tokens: number): BudgetLevelMatch {
  const value = Number.isFinite(tokens) ? Math.round(tokens) : 0
  if (value <= 0) return { level: 'off', custom: false }
  let best: Exclude<BudgetLevel, 'off'> = 'compact'
  let bestDistance = Number.POSITIVE_INFINITY
  for (const level of RESIDENT_LEVELS) {
    const distance = Math.abs(tokensOfLevel(block, level) - value)
    if (distance === 0) return { level, custom: false }
    if (distance < bestDistance) {
      best = level
      bestDistance = distance
    }
  }
  return { level: best, custom: true }
}
