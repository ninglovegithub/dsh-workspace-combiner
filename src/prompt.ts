/**
 * 多工作区联合开发模式 prompt 渲染。只依赖共享类型，平台无关。
 * @module dsh-workspace-combiner/prompt
 */

import type { WorkspaceRef } from './core/types.ts'

/**
 * 把选中的工作区列表渲染成追加到 system prompt 的固定区块。空列表返回空串
 * （宿主据此不向会话注入任何内容）。
 * @param workspaces - 本次会话选中的工作区。
 * @returns 符合约定的 prompt 文本；空列表返回 ''。
 */
export function renderMultiWorkspacePrompt(workspaces: readonly WorkspaceRef[]): string {
  if (workspaces.length === 0) return ''
  const list = workspaces
    .map((ws, index) => {
      const role = index === 0 ? '【主项目 · 工作区锚点（文档/非代码文件保存区）】' : '【代码项目】'
      return `${index + 1}.${ws.name}${role}绝对路径：${ws.path}`
    })
    .join('\n')
  return [
    '# 多工作区联合开发模式生效',
    `当前会话加载【${workspaces.length}】个项目目录：`,
    list,
    '',
    '开发强制规则：',
    '1. 读写文件、查看代码必须使用完整绝对路径，禁止相对路径',
    '2. 多个仓库Git相互独立，提交互不干扰',
    '3. 做接口变更时，同步修改后端代码与前端请求代码',
    '4. 终端执行命令，必须填写文件完整绝对路径，不允许直接使用相对路径执行',
  ].join('\n')
}
