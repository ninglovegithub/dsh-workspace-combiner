/**
 * 多工作区联合开发模式 prompt 渲染。只依赖共享类型，平台无关。
 * @module dsh-workspace-combiner/prompt
 */

import type { CodeIndexEntry, LoadMode, WorkspaceMode, WorkspaceRef } from './core/types.ts'
import { renderTree, estimateTokens, type FileIndexEntry } from './core/fileTree.ts'
import { DEFAULT_CODE_INDEX_BUDGET } from './invariant.ts'

/** 功能索引默认预算（不挤占文件索引配额）。 */
export const CODE_INDEX_TOKEN_BUDGET = DEFAULT_CODE_INDEX_BUDGET

/**
 * 渲染功能/接口索引区块（自动抽取，供快速定位前后端落点）。
 * @param tokenBudget - >0 时限制该区块的 token 上限（0/缺省 = 不限制）。
 */
export function renderCodeIndex(entries: readonly CodeIndexEntry[], tokenBudget = CODE_INDEX_TOKEN_BUDGET): string {
  if (entries.length === 0) return ''
  const header = '# 功能/接口索引（自动抽取，用于定位；以实际代码为准）'
  const lines: string[] = [header]
  const budget = tokenBudget > 0 ? tokenBudget : Number.POSITIVE_INFINITY
  let used = estimateTokens(header)
  let truncated = false
  for (const entry of entries) {
    const parts = ['@' + entry.feature + ' → ' + entry.endpoint]
    if (entry.summary !== undefined && entry.summary !== '') parts.push(entry.summary)
    if (entry.server !== undefined) parts.push('服务端 ' + entry.server.file + ':' + entry.server.line)
    if (entry.client !== undefined) parts.push('前端 ' + entry.client.file + ':' + entry.client.line)
    const line = '- ' + parts.join(' | ')
    const cost = estimateTokens(line) + 1
    if (used + cost > budget) { truncated = true; break }
    lines.push(line)
    used += cost
  }
  if (truncated) lines.push('…（功能索引已达上限，可直接 @ 相关文件）')
  return lines.join('\n')
}

/** 目录被配额截断时的块内标注。 */
const QUOTA_NOTE = '  …（本目录已达配额，可调高预算或改用摘要模式）'

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
 * 把选中的工作区列表渲染成追加到 system prompt 的固定区块。空列表返回空串
 * （宿主据此不向会话注入任何内容）。
 * @param workspaces - 本次会话选中的工作区。
 * @returns 符合约定的 prompt 文本；空列表返回 ''。
 */
export function renderMultiWorkspacePrompt(workspaces: readonly WorkspaceRef[], mode: WorkspaceMode = 'anchor', loadMode: LoadMode = 'summary', entries: readonly FileIndexEntry[] = [], tokenBudget = 0, codeEntries: readonly CodeIndexEntry[] = [], codeIndexBudget = CODE_INDEX_TOKEN_BUDGET): string {
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
  const fileIndex = renderFileIndex(entries, loadMode, tokenBudget)
  const codeIndex = renderCodeIndex(codeEntries, codeIndexBudget)
  return [
    '# 多工作区联合开发模式生效',
    `当前会话加载【${active.length}】个项目目录：`,
    list,
    ...(fileIndex !== '' ? ['', fileIndex] : []),
    ...(codeIndex !== '' ? ['', codeIndex] : []),
    '',
    '# @指令 · 动态范围',
    '- 消息中以 @ 开头的 token 是被显式引用的路径：@绝对路径，或 @相对某工作区根的相对路径。',
    '- @结尾带 / 的是目录：需要其内容时列出其目录树（ls / read）。',
    '- 其它是文件：需要其内容时先用 read 读取，禁止未读就声称已检查。',
    '- 含空格的路径用 @"路径 with spaces" 包裹。',
    ...(codeIndex !== '' ? ['- @功能名（如 @workspaceCreate）：指上方「功能/接口索引」里的名字，展开即读取该项列出的服务端/前端文件，用于快速定位。'] : []),
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
