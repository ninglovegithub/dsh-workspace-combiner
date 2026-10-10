/**
 * 目录分组的稳定枚举与文案映射。
 *
 * 分组是**持久化数据**：它进 store、进注入 prompt（宿主按组渲染），所以不能存
 * 当前语言的文案——用户切一次语言，历史分组就会和 `tt('groupBackend')` 失配，
 * 颜色、下拉选中、就绪度里的「文档目录」判定会集体失效。
 *
 * 这里以 `doc | backend | frontend | ref | other` 作为存储值，读取时用
 * {@link groupKindOf} 兼容历史数据（中文/英文旧文案、以及宿主扫描出的
 * `suggestedGroup` 原始值），渲染时才映射成本地化文案。
 *
 * 词汇表的权威定义在 `src/core/groups.ts`（宿主 prompt 渲染用它）。本文件是同一份
 * 词汇表的镜像 + 本地化标签；下面的 `_GroupKindMatchesCore` 是编译期断言，
 * 任一侧增删枚举值都会让 tsc 立刻报错，杜绝「客户端存 backend、宿主不认识」。
 * @module dsh-workspace-combiner/client/panel/groups
 */

import type { GroupKind as CoreGroupKind } from '../../core/groups.ts'
import type { ProjectType } from '../../core/types.ts'
import { tt, type WorkspaceCombinerKey } from '../locales.ts'

/** 分组的稳定枚举（持久化值）。 */
export type GroupKind = 'doc' | 'backend' | 'frontend' | 'ref' | 'other'

/** 编译期断言工具：要求 T 为 true，否则该类型不成立（赋值处报错）。 */
type Expect<T extends true> = T

/** 两个联合类型是否互为子集（= 完全一致）。 */
type SameUnion<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

/** 客户端枚举与宿主权威枚举必须完全一致，否则编译失败。 */
export type GroupKindMatchesCore = Expect<SameUnion<GroupKind, CoreGroupKind>>

/** 下拉菜单顺序。 */
export const GROUP_KINDS: readonly GroupKind[] = ['doc', 'backend', 'frontend', 'ref', 'other']

/** 历史/别名 -> 稳定枚举（小写后做包含匹配，兼容中英文旧值与 `suggestedGroup`）。
 * 顺序即优先级：更具体的词排在前面。
 * ⚠️ 必须与 `src/core/groups.ts` 的 ALIASES 逐字一致（那份是宿主权威词汇表）：
 * 客户端写 `backend` 而宿主不认识，prompt 里就会渲染出原样字符串。 */
const ALIASES: ReadonlyArray<readonly [GroupKind, readonly string[]]> = [
  ['doc', ['doc', 'docs', 'document', 'documentation', '文档', '文档锚点', '说明']],
  ['backend', ['backend', 'back-end', 'server', 'service', '后端', '服务端', '接口']],
  ['frontend', ['frontend', 'front-end', 'front', 'web', 'client', '前端', '前端项目']],
  ['ref', ['ref', 'reference', 'dependency', '参考', '依赖', '引用']],
  ['other', ['other', 'misc', 'generic', '其他', '其它']],
]

/** 枚举 -> 本地化标签（复用既有 key，不新增词典项）。 */
const GROUP_LABEL_KEYS: Record<GroupKind, WorkspaceCombinerKey> = {
  doc: 'groupDoc',
  backend: 'groupBackend',
  frontend: 'groupFrontend',
  ref: 'groupRef',
  other: 'groupOther',
}

/** 枚举 -> 胶囊样式类（纯常量，不含 i18n，模块顶层求值安全）。 */
export const GROUP_CLASS: Record<GroupKind, string> = {
  doc: 'wcb-cap-doc',
  backend: 'wcb-cap-backend',
  frontend: 'wcb-cap-frontend',
  ref: 'wcb-cap-ref',
  other: 'wcb-cap-other',
}

/** 枚举 -> 条形图颜色。 */
const GROUP_COLOR: Record<GroupKind, string> = {
  doc: '#d4a017',
  backend: '#8b5cf6',
  frontend: '#3b82f6',
  ref: '#2aa8b4',
  other: '#8b949e',
}

/** 分组枚举 -> 当前语言标签。 */
export function groupLabel(kind: GroupKind): string {
  return tt(GROUP_LABEL_KEYS[kind])
}

/**
 * 任意历史/别名值 -> 分组枚举；空串与无法识别的值返回 undefined（= 无分组）。
 * 与 `src/core/groups.ts` 的同名函数**同一套匹配规则**（单次遍历里
 * `精确相等 || 包含`，顺序即优先级），保证两端对同一个值给出同一个枚举。
 * @param value - 存储值或 suggestedGroup 原始值。
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
 * 目录类型方块（D/B/F/R/P）的字母与样式：优先看分组枚举，其次看项目类型。
 * @param index - 目录下标（0 = 主项目）。
 * @param group - 目录分组存储值。
 * @param type - 识别出的项目类型。
 */
export function dirTypeSquare(index: number, group: string | undefined, type: ProjectType | undefined): { letter: string; cls: string } {
  if (index === 0) return { letter: 'D', cls: 'wcb-type-sq wcb-type-sq-doc' }
  const kind = groupKindOf(group)
  if (kind === 'doc') return { letter: 'D', cls: 'wcb-type-sq wcb-type-sq-doc' }
  if (kind === 'ref') return { letter: 'R', cls: 'wcb-type-sq wcb-type-sq-ref' }
  if (kind === 'backend') return { letter: 'B', cls: 'wcb-type-sq wcb-type-sq-backend' }
  if (kind === 'frontend') return { letter: 'F', cls: 'wcb-type-sq wcb-type-sq-frontend' }
  if (type === 'java' || type === 'python' || type === 'go') return { letter: 'B', cls: 'wcb-type-sq wcb-type-sq-backend' }
  if (type === 'frontend' || type === 'frontend-vue' || type === 'frontend-react' || type === 'frontend-webpack' || type === 'frontend-next') return { letter: 'F', cls: 'wcb-type-sq wcb-type-sq-frontend' }
  return { letter: 'P', cls: 'wcb-type-sq wcb-type-sq-other' }
}

/**
 * 逐目录用量条形颜色：主项目金色，其余按分组枚举（缺失时退回项目类型）。
 * @param index - 目录下标。
 * @param group - 目录分组存储值。
 * @param type - 项目类型。
 */
export function dirTypeColor(index: number, group: string | undefined, type: ProjectType | undefined): string {
  if (index === 0) return GROUP_COLOR.doc
  const kind = groupKindOf(group)
  if (kind !== undefined) return GROUP_COLOR[kind]
  if (type === 'java' || type === 'python' || type === 'go') return GROUP_COLOR.backend
  if (type === 'frontend' || type === 'frontend-vue' || type === 'frontend-react' || type === 'frontend-webpack' || type === 'frontend-next') return GROUP_COLOR.frontend
  return GROUP_COLOR.other
}
