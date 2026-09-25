/**
 * 多工作区联合开发模式 prompt 渲染。只依赖共享类型，平台无关。
 * @module dsh-workspace-combiner/prompt
 */

import type { LoadMode, WorkspaceMode, WorkspaceRef } from './core/types.ts'
import type { FileTreeNode } from './host/fileIndex.ts'
import { countNodes, renderTree } from './host/fileIndex.ts'

/** 渲染文件索引区块（按加载模式）。 */
export function renderFileIndex(fileTrees: readonly { name: string; path: string; tree: FileTreeNode[] }[], loadMode: LoadMode): string {
  if (fileTrees.length === 0) return ''
  const lines: string[] = ['# 文件索引（加载模式：' + loadMode + '）']
  for (const ft of fileTrees) {
    lines.push('【' + ft.name + '】' + ft.path)
    if (loadMode === 'summary') {
      const { files, dirs } = countNodes(ft.tree)
      lines.push('  ' + files + ' 文件 / ' + dirs + ' 目录')
    } else {
      for (const l of renderTree(ft.tree).split('\n')) lines.push('  ' + l)
    }
  }
  return lines.join('\n')
}

/**
 * 把选中的工作区列表渲染成追加到 system prompt 的固定区块。空列表返回空串
 * （宿主据此不向会话注入任何内容）。
 * @param workspaces - 本次会话选中的工作区。
 * @returns 符合约定的 prompt 文本；空列表返回 ''。
 */
export function renderMultiWorkspacePrompt(workspaces: readonly WorkspaceRef[], mode: WorkspaceMode = 'anchor', loadMode: LoadMode = 'summary', fileTrees: readonly { name: string; path: string; tree: FileTreeNode[] }[] = []): string {
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
  const fileIndex = renderFileIndex(fileTrees, loadMode)
  return [
    '# 多工作区联合开发模式生效',
    `当前会话加载【${active.length}】个项目目录：`,
    list,
    ...(fileIndex !== '' ? ['', fileIndex] : []),
    '',
    '# @指令 · 动态范围',
    '- 消息中以 @ 开头的 token 是被显式引用的路径：@绝对路径，或 @相对某工作区根的相对路径。',
    '- @结尾带 / 的是目录：需要其内容时列出其目录树（ls / read）。',
    '- 其它是文件：需要其内容时先用 read 读取，禁止未读就声称已检查。',
    '- 含空格的路径用 @"路径 with spaces" 包裹。',
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
