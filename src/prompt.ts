/**
 * 多工作区联合开发模式 prompt 渲染。只依赖共享类型，平台无关。
 * @module dsh-workspace-combiner/prompt
 */

import type { CodeIndexEntry, LoadMode, WorkspaceMode, WorkspaceRef } from './core/types.ts'
import { renderTree, estimateTokens, type FileIndexEntry } from './core/fileTree.ts'
import type { StandardGroup } from './core/standards.ts'
import { DEFAULT_CODE_INDEX_BUDGET, DEFAULT_COMMANDS_BUDGET, DEFAULT_STANDARDS_BUDGET } from './invariant.ts'

/** 功能索引默认预算（不挤占文件索引配额）。 */
export const CODE_INDEX_TOKEN_BUDGET = DEFAULT_CODE_INDEX_BUDGET

/**
 * 单条索引条目的文本行：常驻区块与按需查询文件共用同一格式。
 * @param entry - 索引条目。
 * @returns 形如 '- @功能名 → 端点 | 服务端 文件:行 | 前端 文件:行' 的一行。
 */
export function renderCodeIndexLine(entry: CodeIndexEntry): string {
  const parts = ['@' + entry.feature + ' → ' + entry.endpoint]
  if (entry.summary !== undefined && entry.summary !== '') parts.push(entry.summary)
  if (entry.server !== undefined) parts.push('服务端 ' + entry.server.file + ':' + entry.server.line)
  if (entry.client !== undefined) parts.push('前端 ' + entry.client.file + ':' + entry.client.line)
  return '- ' + parts.join(' | ')
}

/**
 * 渲染功能/接口索引区块（自动抽取，供快速定位前后端落点）。
 * @param tokenBudget - >0 时限制该区块的 token 上限；<=0 表示完全不注入（改为按需查索引文件）。
 */
export function renderCodeIndex(entries: readonly CodeIndexEntry[], tokenBudget = CODE_INDEX_TOKEN_BUDGET): string {
  if (entries.length === 0 || tokenBudget <= 0) return ''
  const header = '# 功能/接口索引（自动抽取，用于定位；以实际代码为准）'
  const lines: string[] = [header]
  let used = estimateTokens(header)
  let truncated = false
  for (const entry of entries) {
    const line = renderCodeIndexLine(entry)
    const cost = estimateTokens(line) + 1
    if (used + cost > tokenBudget) { truncated = true; break }
    lines.push(line)
    used += cost
  }
  if (truncated) lines.push('…（功能索引已达上限，可直接 @ 相关文件）')
  return lines.join('\n')
}

/**
 * 按需查询文件的内容：每行一条端点，grep 关键词即可命中（缓存 JSON 是单行且转义过，grep 无用）。
 * 不受 token 预算限制——它不常驻上下文，只在需要定位端点时读。
 * @param entries - 索引条目（已按配对优先排序）。
 * @returns 可 grep 的纯文本。
 */
export function renderCodeIndexText(entries: readonly CodeIndexEntry[]): string {
  return ['# 功能/接口索引（按需查询：每行一条，grep 关键词即可）', ...entries.map(renderCodeIndexLine), ''].join('\n')
}

/** 目录被配额截断时的块内标注。 */
const QUOTA_NOTE = '  …（本目录已达配额，可调高预算或改用摘要模式）'

/**
 * 渲染「各项目常用命令」区块（面板可编辑；带绝对路径，避免模型在错误的 cwd 执行）。
 * 只渲染填了命令的目录，一条都没填时返回空串（不占用上下文）。
 * @param directories - 工作空间的目录列表。
 * @param tokenBudget - >0 时限制该区块的 token 上限。
 */
export function renderCommands(directories: readonly WorkspaceRef[], tokenBudget = DEFAULT_COMMANDS_BUDGET): string {
  const rows = directories
    .filter(dir => (dir.access ?? 'readwrite') !== 'disabled')
    .map(dir => {
      const commands = dir.commands
      if (commands === undefined) return undefined
      const parts = [
        ...(commands.run === undefined ? [] : ['启动 `' + commands.run + '`']),
        ...(commands.test === undefined ? [] : ['测试 `' + commands.test + '`']),
        ...(commands.build === undefined ? [] : ['构建 `' + commands.build + '`']),
      ]
      return parts.length === 0 ? undefined : '- ' + dir.name + '（' + dir.path + '）: ' + parts.join(' | ')
    })
    .filter((row): row is string => row !== undefined)
  if (rows.length === 0) return ''
  const header = '# 各项目常用命令（必须在对应绝对路径下执行；用于自启与自证）'
  const budget = tokenBudget > 0 ? tokenBudget : Number.POSITIVE_INFINITY
  const lines: string[] = [header]
  let used = estimateTokens(header)
  for (const row of rows) {
    const cost = estimateTokens(row) + 1
    if (used + cost > budget) { lines.push('…（命令已达预算上限，可在面板调整）'); break }
    lines.push(row)
    used += cost
  }
  return lines.join('\n')
}

/**
 * 渲染文件索引区块（按加载模式）。
 *
 * 预算分配采用「目录配额 + 余量回填」：每个目录先保底出现，剩余预算补给被截断的
 * 目录，避免一个大目录把后面的代码项目整块挤掉（旧实现是字母序 first-fit）。
 * @param tokenBudget - >0 时启用目录配额（0/缺省 = 不限制）。
 */
export function renderFileIndex(entries: readonly FileIndexEntry[], loadMode: LoadMode, tokenBudget = 0): string {
  if (entries.length === 0) return ''
  const header = '# 文件索引（加载模式：' + loadMode + '）'
  // summary 用递归计数（不建树）；tree/full 用已构建的文件树。
  const blocks = entries.map(entry => ({
    head: '【' + entry.name + '】' + entry.path,
    rest: loadMode === 'summary'
      ? ['  ' + (entry.truncated === true ? '≥' : '') + entry.files + ' 文件 / ' + entry.dirs + ' 目录']
      : renderTree(entry.tree ?? []).split('\n').map(l => '  ' + l),
  }))
  const cost = (line: string): number => estimateTokens(line) + 1
  const headerCost = cost(header)
  const headCosts = blocks.map(b => cost(b.head))
  const restCosts = blocks.map(b => b.rest.map(cost))
  const mandatory = headerCost + headCosts.reduce((a, c) => a + c, 0)
  const total = mandatory + restCosts.reduce((a, rc) => a + rc.reduce((x, c) => x + c, 0), 0)

  const budget = tokenBudget > 0 ? tokenBudget : Number.POSITIVE_INFINITY
  if (total <= budget) {
    return [header, ...blocks.flatMap(b => [b.head, ...b.rest])].join('\n')
  }

  // 每个目录等分剩余预算；放不下 rest 的目录需额外留出标注空间（只为真正被截断的目录预留）。
  const pool = Math.max(0, budget - mandatory)
  const noteCost = cost(QUOTA_NOTE)
  const share = pool / blocks.length
  const fit = (costs: readonly number[], limit: number): { n: number; used: number } => {
    let used = 0
    let n = 0
    for (const c of costs) {
      if (used + c > limit) break
      used += c
      n++
    }
    return { n, used }
  }
  const take = blocks.map((_b, i) => {
    const costs = restCosts[i]
    const res = fit(costs, share)
    return res.n < costs.length ? fit(costs, Math.max(0, share - noteCost)) : res
  })
  // 余量回填：等分后没用掉的总预算（含标注开销）补给被截断的目录（按目录顺序）。
  let leftover = pool - take.reduce((a, t, i) => a + t.used + (t.n < restCosts[i].length ? noteCost : 0), 0)
  for (let i = 0; i < blocks.length && leftover > 0; i++) {
    const costs = restCosts[i]
    if (take[i].n >= costs.length) continue
    let n = take[i].n
    let used = take[i].used
    while (n < costs.length && leftover >= costs[n]) { leftover -= costs[n]; used += costs[n]; n++ }
    take[i] = { n, used }
  }

  const lines: string[] = [header]
  for (let i = 0; i < blocks.length; i++) {
    lines.push(blocks[i].head)
    for (let k = 0; k < take[i].n; k++) lines.push(blocks[i].rest[k])
    if (take[i].n < blocks[i].rest.length) lines.push(QUOTA_NOTE)
  }
  return lines.join('\n')
}

/**
 * 渲染开发规范区块（按作用域分组：通用 + 逐目录）。
 * @param groups - 生效的规范分组。
 * @param tokenBudget - >0 时限制该区块的 token 上限（0/缺省 = 不限制）。
 */
export function renderStandards(groups: readonly StandardGroup[], tokenBudget = DEFAULT_STANDARDS_BUDGET): string {
  if (groups.length === 0) return ''
  const header = '# 开发规范（按作用域生效，务必遵守；与其他说明冲突时以本区块为准）'
  const lines: string[] = [header]
  const budget = tokenBudget > 0 ? tokenBudget : Number.POSITIVE_INFINITY
  let used = estimateTokens(header)
  let truncated = false
  for (const group of groups) {
    let stopped = false
    for (const line of ['## ' + group.title, ...group.body.split('\n')]) {
      const cost = estimateTokens(line) + 1
      if (used + cost > budget) { truncated = true; stopped = true; break }
      lines.push(line)
      used += cost
    }
    if (stopped) break
  }
  if (truncated) lines.push('…（开发规范已达预算上限被截断，可在面板调高预算或精简规范）')
  return lines.join('\n')
}

/** renderMultiWorkspacePrompt 的输入。 */
export interface MultiWorkspacePromptInput {
  workspaces: readonly WorkspaceRef[]
  mode?: WorkspaceMode
  loadMode?: LoadMode
  entries?: readonly FileIndexEntry[]
  tokenBudget?: number
  codeEntries?: readonly CodeIndexEntry[]
  codeIndexBudget?: number
  /** 按需查询文件路径：功能索引不常驻上下文时，给模型一条「需要时去查」的线索。 */
  codeIndexPath?: string
  /** 生效的开发规范分组（按作用域）。 */
  standardGroups?: readonly StandardGroup[]
  standardsBudget?: number
  /** 各项目常用命令区块预算。 */
  commandsBudget?: number
}

/**
 * 把选中的工作区列表渲染成追加到 system prompt 的固定区块。空列表返回空串
 * （宿主据此不向会话注入任何内容）。
 * @param input - 工作区、加载模式、文件索引、功能索引与开发规范等内容。
 * @returns 符合约定的 prompt 文本；空列表返回 ''。
 */
export function renderMultiWorkspacePrompt(input: MultiWorkspacePromptInput): string {
  const {
    workspaces,
    mode = 'anchor',
    loadMode = 'summary',
    entries = [],
    tokenBudget = 0,
    codeEntries = [],
    codeIndexBudget = CODE_INDEX_TOKEN_BUDGET,
    codeIndexPath,
    standardGroups = [],
    standardsBudget = DEFAULT_STANDARDS_BUDGET,
    commandsBudget = DEFAULT_COMMANDS_BUDGET,
  } = input
  // 剔除「禁用」目录（不注入上下文）；主项目（第 0 项）恒保留。
  const active = workspaces.filter((ws, index) => index === 0 || (ws.access ?? 'readwrite') !== 'disabled')
  if (active.length === 0) return ''
  const hasReadonly = active.some(ws => (ws.access ?? 'readwrite') === 'readonly')
  const primaryLabel = mode === 'single' ? '【主项目 · 核心业务代码（读写）】' : '【主项目 · 工作区锚点（文档/非代码文件保存区）】'
  const secondaryLabel = mode === 'single' ? '【参考依赖模块】' : '【代码项目】'
  let currentGroup = ''
  const list = active
    .map((ws, index) => {
      const role = index === 0 ? primaryLabel : secondaryLabel
      const lock = (ws.access ?? 'readwrite') === 'readonly' ? '【只读】' : ''
      const group = index === 0 ? '' : (ws.group ?? '')
      const header = group !== '' && group !== currentGroup ? '【' + group + '】\n' : ''
      if (group !== '' && group !== currentGroup) currentGroup = group
      return `${header}${index + 1}.${ws.name}${role}${lock}绝对路径：${ws.path}`
    })
    .join('\n')
  const standards = renderStandards(standardGroups, standardsBudget)
  const fileIndex = renderFileIndex(entries, loadMode, tokenBudget)
  const codeIndex = renderCodeIndex(codeEntries, codeIndexBudget)
  const commands = renderCommands(active, commandsBudget)
  // 常驻时用「@功能名」定位；改为按需（预算 <=0）时给一条查询线索，否则模型不知道有这份索引。
  const codeIndexUsage = codeIndex !== ''
    ? '- @功能名（如 @workspaceCreate）：指上方「功能/接口索引」里的名字，展开即读取该项列出的服务端/前端文件，用于快速定位。'
    : codeIndexPath !== undefined && codeIndexPath !== ''
      ? '- 功能/接口索引（端点 ↔ 前后端落点）未常驻上下文：需要定位端点时先 grep ' + codeIndexPath + '（每行一条：@功能名 → 端点 | 服务端 文件:行 | 前端 文件:行），不必为此通读仓库。'
      : ''
  return [
    '# 多工作区联合开发模式生效',
    `当前会话加载【${active.length}】个项目目录：`,
    list,
    ...(commands !== '' ? ['', commands] : []),
    ...(standards !== '' ? ['', standards] : []),
    ...(fileIndex !== '' ? ['', fileIndex] : []),
    ...(codeIndex !== '' ? ['', codeIndex] : []),
    '',
    '# @指令 · 动态范围',
    '- 消息中以 @ 开头的 token 是被显式引用的路径：@绝对路径，或 @相对某工作区根的相对路径。',
    '- @结尾带 / 的是目录：需要其内容时列出其目录树（ls / read）。',
    '- 其它是文件：需要其内容时先用 read 读取，禁止未读就声称已检查。',
    '- 含空格的路径用 @"路径 with spaces" 包裹。',
    ...(codeIndexUsage !== '' ? [codeIndexUsage] : []),
    '- 被 @ 引用的文件/目录应优先纳入本次处理范围；不在上方文件索引里的路径同样可直接 read（沙盒读不受限）。',
    '',
    '开发强制规则：',
    '1. 读写文件、查看代码必须使用完整绝对路径，禁止相对路径',
    '2. 多个仓库Git相互独立，提交互不干扰',
    '3. 做接口变更时，同步修改后端代码与前端请求代码',
    '4. 终端执行命令，必须填写文件完整绝对路径，不允许直接使用相对路径执行',
    ...(hasReadonly ? ['5. 标记【只读】的目录仅可读取，禁止写入、新建、删除其中任何文件'] : []),
  ].join('\n')
}
