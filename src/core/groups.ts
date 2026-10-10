/**
 * 目录分组的稳定枚举与宿主侧文案映射。
 *
 * 分组是**持久化数据**，而 DSH 面板支持运行时切语言。如果把当前语言的文案直接
 * 存进 store，用户切一次中英文，历史分组就会和渲染侧的文案比较失配：分组胶囊
 * 颜色、下拉选中、以及「这个目录是不是文档目录」的判定会集体失效。
 *
 * 因此落盘与比较统一用 {@link GroupKind}，宿主在拼 prompt 时才映射回中文文案。
 * {@link groupLabel} 对未知取值原样返回，兼容历史数据里的中文/英文旧文案，以及
 * 项目扫描给出的 `suggestedGroup`。
 *
 * 浏览器半面有一份同样词汇表的镜像（`src/client/panel/groups.ts`），它额外负责
 * 本地化标签；两处的枚举值必须保持一致。
 * @module dsh-workspace-combiner/core/groups
 */

/** 分组的稳定枚举（持久化值）。 */
export type GroupKind = 'doc' | 'backend' | 'frontend' | 'ref' | 'other'

/** 全部枚举值。 */
export const GROUP_KINDS: readonly GroupKind[] = ['doc', 'backend', 'frontend', 'ref', 'other']

/**
 * 历史/别名 -> 稳定枚举（小写后做包含匹配，兼容中英文旧值与 `suggestedGroup`）。
 * 顺序即优先级：更具体的词排在前面。
 */
const ALIASES: ReadonlyArray<readonly [GroupKind, readonly string[]]> = [
  ['doc', ['doc', 'docs', 'document', 'documentation', '文档', '文档锚点', '说明']],
  ['backend', ['backend', 'back-end', 'server', 'service', '后端', '服务端', '接口']],
  ['frontend', ['frontend', 'front-end', 'front', 'web', 'client', '前端', '前端项目']],
  ['ref', ['ref', 'reference', 'dependency', '参考', '依赖', '引用']],
  ['other', ['other', 'misc', 'generic', '其他', '其它']],
]

/** 注入 prompt 时使用的中文文案（prompt 固定中文）。 */
const HOST_LABELS: Record<GroupKind, string> = {
  doc: '文档',
  backend: '后端',
  frontend: '前端',
  ref: '参考',
  other: '其他',
}

/**
 * 把任意历史取值归一化为稳定枚举；无法识别时返回 undefined。
 * @param value - store 里的 group 值（可能是枚举、中文旧文案或扫描建议值）。
 */
export function groupKindOf(value: string | undefined): GroupKind | undefined {
  if (value === undefined) return undefined
  const lower = value.trim().toLowerCase()
  if (lower === '') return undefined
  for (const [kind, aliases] of ALIASES) {
    if (aliases.some(alias => lower === alias || lower.includes(alias))) return kind
  }
  return undefined
}

/**
 * 分组在宿主 prompt 里的展示文案。
 * 已知枚举 -> 中文标签；未知取值（历史自定义文案）原样返回，绝不丢信息。
 * @param value - store 里的 group 值。
 */
export function groupLabel(value: string | undefined): string {
  if (value === undefined) return ''
  const kind = groupKindOf(value)
  return kind === undefined ? value : HOST_LABELS[kind]
}

/** 该分组是否表示「文档/非代码」目录。 */
export function isDocumentGroup(value: string | undefined): boolean {
  return groupKindOf(value) === 'doc'
}
