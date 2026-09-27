/**
 * 预制开发规范：内置规范库 + 生效合并逻辑。
 * 平台无关（client 弹窗与 host 注入共用），禁止任何 node 依赖。
 *
 * 内置正文均为原创要点摘要（不逐字引用任何受版权保护的规范文档）；需要引用官方
 * 文档时只放链接。
 * @module dsh-workspace-combiner/core/standards
 */

import type { CustomStandard, ProjectType, WorkspaceRef, WorkspaceStandards } from './types.ts'

/** 内置规范。 */
export interface StandardPreset {
  id: string
  /** 展示名。 */
  name: string
  /** 技术栈分组键。 */
  tech: string
  /** 一句话说明（弹窗列表用）。 */
  summary: string
  /** 规范正文（markdown 列表）。 */
  body: string
  /** 内置版本号；正文变更时递增，用于将来提示「内置已更新」。 */
  version: number
  /** 与 projectDetector 的项目类型自动匹配。 */
  matchTypes?: readonly ProjectType[]
}

/** 全局规范库文件形状（~/.dsh/dsh-workspace-combiner-standards.json）。 */
export interface StandardsLibrary {
  version: 1
  /** 内置规范的覆盖正文：id -> body。 */
  overrides: Record<string, string>
  /** 全局自建规范。 */
  custom: CustomStandard[]
}

/** 空库。 */
export function emptyLibrary(): StandardsLibrary {
  return { version: 1, overrides: {}, custom: [] }
}

/** 校验一条自建规范（host 落盘与 client 请求体共用）。 */
export function parseCustomStandard(raw: unknown): CustomStandard | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const item = raw as Record<string, unknown>
  if (typeof item.id !== 'string' || item.id === '' || typeof item.name !== 'string' || typeof item.body !== 'string') return undefined
  return {
    id: item.id,
    name: item.name,
    tech: typeof item.tech === 'string' && item.tech !== '' ? item.tech : '自定义',
    summary: typeof item.summary === 'string' ? item.summary : '',
    body: item.body,
  }
}

/** 通用 / 团队规范。 */
const GENERAL: StandardPreset = {
  id: 'general',
  name: '通用 / 团队规范',
  tech: '通用',
  summary: '提交信息、凭据、测试、改动范围等团队级约定',
  version: 1,
  body: [
    '- 提交信息用 Conventional Commits：feat / fix / docs / style / refactor / test / chore；标题祈使句、不超过 72 字符',
    '- 严禁提交密钥、口令、token、真实生产数据；示例一律用假值',
    '- 新增或修改行为必须同时补测试；修 bug 先写能复现的用例',
    '- 不引入与仓库现状冲突的新框架/工具；优先复用已有能力',
    '- 注释与文档语言跟随仓库现状，不要中英混写',
    '- 每次都保持最小改动范围，不做与任务无关的重构或全量格式化',
    '- 公共函数/接口要写明用途与边界条件，不写「显而易见」的废话注释',
  ].join('\n'),
}

/** Java / Spring。 */
const JAVA_SPRING: StandardPreset = {
  id: 'java-spring',
  name: 'Java / Spring',
  tech: 'Java',
  summary: '分层、DTO、校验、统一异常、事务边界、日志与测试',
  version: 1,
  matchTypes: ['java'],
  body: [
    '- 分层：controller → service → repository/mapper；controller 只做参数接收与结果组装，不写业务逻辑',
    '- 实体（entity/DO）不作为接口出入参，使用 DTO/VO；转换集中在 service 或 converter',
    '- 参数校验：请求对象加 @Valid + JSR-303 约束注解；业务校验在 service 抛业务异常',
    '- 统一异常：@ControllerAdvice + 自定义业务异常 + 统一错误码；不要 try/catch 后吞掉异常',
    '- 事务：@Transactional 只加在 service 公有方法上；避免长事务与自调用失效；只读查询加 readOnly',
    '- 依赖注入用构造器（或 @RequiredArgsConstructor），禁止 @Autowired 字段注入',
    '- 日志用 SLF4J 占位符 logger.info("id={}", id)；禁止 System.out；异常日志带堆栈',
    '- 时间统一 java.time（LocalDateTime/Instant），禁止 java.util.Date',
    '- 配置外置：连接串、开关放配置或环境变量，禁止硬编码',
    '- 返回统一包装（如 Result<T>）；分页参数命名固定并做上限保护',
    '- MyBatis 参数化（#{}）避免注入；JPA 注意 N+1 与显式 fetch',
    '- 测试：JUnit 5 + MockMvc/Mockito；service 单测覆盖分支，不依赖真实数据库',
  ].join('\n'),
}

/** Vue 3。 */
const VUE3: StandardPreset = {
  id: 'vue3',
  name: 'Vue 3',
  tech: '前端',
  summary: 'Composition API、状态边界、路由懒加载、请求封装',
  version: 1,
  matchTypes: ['frontend-vue'],
  body: [
    '- 组件统一 <script setup> + Composition API；一个文件一个组件',
    '- 组件文件与组件名用 PascalCase；组合式函数用 useXxx 命名',
    '- Props 用 defineProps<Props>() 显式类型，Emits 用 defineEmits 声明，避免隐式 any',
    '- 状态就近：局部用 ref/reactive，跨组件共享用 Pinia；不要让多个组件各自重复请求同一数据',
    '- 路由：页面级组件懒加载（() => import(...)）；路由参数显式类型化',
    '- 请求：统一封装 axios 实例（baseURL/超时/拦截器/统一错误提示），业务代码不直接调 axios',
    '- 样式：<style scoped>；全局样式与主题变量集中管理，避免深层选择器',
    '- 目录约定：views / components / composables / api / stores / router',
    '- 响应数据结构定义类型并集中放置，尽量避免 any',
  ].join('\n'),
}

/** React。 */
const REACT: StandardPreset = {
  id: 'react',
  name: 'React',
  tech: '前端',
  summary: '函数组件与 Hooks、派生状态、副作用、请求封装',
  version: 1,
  matchTypes: ['frontend-react', 'frontend-next'],
  body: [
    '- 只用函数组件 + Hooks，不引入类组件',
    '- 状态就近：能派生的值不要放进 state；跨组件共享用 Context 或既有状态库',
    '- 副作用集中在 useEffect，依赖数组必须完整；请求统一走 service 层，组件内不直接 fetch',
    '- 列表渲染给稳定 key；useMemo/useCallback 要有明确理由，不做无意义包裹',
    '- 组件文件 PascalCase；目录约定 components / pages / hooks / services',
    '- Props 用显式 interface，禁止 any',
    '- 样式方案跟随仓库现状（CSS Modules / styled / Tailwind），不混用',
    '- 可访问性：交互元素可键盘操作并带 aria-label',
  ].join('\n'),
}

/** Python。 */
const PYTHON: StandardPreset = {
  id: 'python',
  name: 'Python',
  tech: 'Python',
  summary: 'PEP 8、类型注解、分层、pydantic 校验、日志与测试',
  version: 1,
  matchTypes: ['python'],
  body: [
    '- 遵循 PEP 8；格式化与导入排序交给 black/ruff，不手工调空格',
    '- 全量类型注解（参数、返回值）；公共函数写 docstring 说明用途与边界',
    '- 分层：api/router → service → repository；不在路由层写业务逻辑',
    '- 数据校验与序列化统一用 pydantic 模型；不直接暴露 ORM 实体',
    '- 配置与密钥走环境变量 / pydantic-settings，禁止硬编码',
    '- 异常：定义业务异常并在统一入口转换为标准错误响应；禁止裸 except',
    '- 日志用 logging（结构化字段），禁止 print 调试残留',
    '- 依赖写入 requirements.txt / poetry.lock / uv.lock 并注明用途',
    '- 测试用 pytest，覆盖分支与边界；外部依赖用 fixture/mock',
  ].join('\n'),
}

/** Go。 */
const GO: StandardPreset = {
  id: 'go',
  name: 'Go',
  tech: 'Go',
  summary: '错误处理、context 透传、命名、分层与并发',
  version: 1,
  matchTypes: ['go'],
  body: [
    '- 错误必须处理：不忽略 error；用 %w 包装保持错误链；对外返回语义化错误',
    '- context.Context 作为第一个参数透传（超时/取消），不要存进结构体',
    '- 包名小写单词、无下划线；导出标识符写注释且以名字开头',
    '- gofmt/goimports 必须干净，golangci-lint 通过',
    '- 分层：handler → service → repository；依赖以接口注入，便于测试',
    '- 并发：goroutine 生命周期可管理（errgroup/context）；共享数据用 channel 或 mutex，避免数据竞争',
    '- 资源：defer 关闭文件/连接；注意 defer 在循环内的陷阱',
    '- 测试：表驱动 + t.Run；关注分支覆盖而非行数',
  ].join('\n'),
}

/** 接口契约（前后端）。 */
const API_CONTRACT: StandardPreset = {
  id: 'api-contract',
  name: '接口契约（前后端）',
  tech: '接口',
  summary: '改接口同步两侧、状态码、命名、幂等与契约优先',
  version: 1,
  body: [
    '- 改接口必须在同一轮改动里同步改前端请求层，不允许只改一边',
    '- 路径用资源复数名词、层级清晰，动词交给 HTTP 方法',
    '- 状态码语义正确（2xx/4xx/5xx）；错误响应体统一结构（code/message/details）',
    '- 分页/排序/筛选参数命名统一，并给默认值与上限',
    '- 字段命名前后端一致（统一 snake_case 或 camelCase）；时间用 ISO 8601 带时区',
    '- 破坏性变更需版本化或新增字段，不直接改语义；弃用要标注周期',
    '- 契约优先：能用 OpenAPI/proto 描述就先写契约，再由契约校验实现',
    '- 写操作注意幂等（幂等键/去重），保证重试安全',
    '- 接口变更同步更新文档与示例',
  ].join('\n'),
}

/** 内置规范（v1 共 7 条）。 */
export const BUILTIN_STANDARDS: readonly StandardPreset[] = [
  GENERAL, JAVA_SPRING, VUE3, REACT, PYTHON, GO, API_CONTRACT,
]

/** 按项目类型找匹配的内置规范。 */
export function matchPresetForType(type: ProjectType | undefined): StandardPreset | undefined {
  if (type === undefined || type === 'none') return undefined
  return BUILTIN_STANDARDS.find(preset => preset.matchTypes?.includes(type) === true)
}

/** 生效后的规范分组（一段可注入的正文 + 标题）。 */
export interface StandardGroup {
  /** 组标题，如 "Java / Spring（适用：example-backend）"。 */
  title: string
  /** 该组正文。 */
  body: string
}

interface ResolvedPreset {
  name: string
  tech: string
  body: string
}

/**
 * 解析生效的规范分组。
 * @param standards - 工作空间的规范绑定。
 * @param directories - 目录列表（用于逐目录规范与自动匹配）。
 * @param library - 全局规范库（覆盖 + 自建）。
 */
export function resolveStandardGroups(
  standards: WorkspaceStandards | undefined,
  directories: readonly WorkspaceRef[],
  library: StandardsLibrary,
): StandardGroup[] {
  const ws = standards ?? {}
  const byId = new Map<string, ResolvedPreset>()
  for (const preset of BUILTIN_STANDARDS) {
    const body = ws.workspaceOverrides?.[preset.id] ?? library.overrides[preset.id] ?? preset.body
    byId.set(preset.id, { name: preset.name, tech: preset.tech, body })
  }
  for (const custom of [...library.custom, ...(ws.workspaceCustom ?? [])]) {
    byId.set(custom.id, { name: custom.name, tech: custom.tech, body: custom.body })
  }

  const groups: StandardGroup[] = []
  const globalIds = [...new Set(ws.global ?? [])].filter(id => byId.has(id))
  if (globalIds.length > 0) {
    const picked = globalIds.map(id => byId.get(id) as ResolvedPreset)
    groups.push({
      title: picked.map(p => p.name).join(' / ') + '（适用全部目录）',
      body: picked.map(p => p.body).join('\n'),
    })
  }

  const autoMatch = ws.autoMatch ?? true
  for (const dir of directories) {
    if ((dir.access ?? 'readwrite') === 'disabled') continue
    const ids = new Set(ws.perDirectory?.[dir.path] ?? [])
    if (autoMatch) {
      const matched = matchPresetForType(dir.projectType)
      if (matched !== undefined && !(ws.perDirectory?.[dir.path] ?? []).includes(matched.id)) ids.add(matched.id)
    }
    const picked = [...ids].filter(id => byId.has(id)).map(id => byId.get(id) as ResolvedPreset)
    if (picked.length === 0) continue
    groups.push({
      title: picked.map(p => p.name).join(' / ') + '（适用：' + dir.name + '）',
      body: picked.map(p => p.body).join('\n'),
    })
  }
  return groups
}
