/**
 * 平台无关的文件树类型与纯工具：host 扫描结果、prompt 渲染、client 预览共用。
 * 本文件必须平台无关（client bundle 也会编译），禁止任何 node 依赖——文件树的
 * 读写扫描留在 host/fileIndex.ts。
 * @module dsh-workspace-combiner/core/fileTree
 */

/** 文件树节点。 */
export interface FileTreeNode {
  name: string
  /** 相对根目录的路径（用 '/' 分隔）。 */
  path: string
  type: 'file' | 'dir'
  children?: FileTreeNode[]
}

/** 一个目录的文件索引条目：计数始终有，文件树仅 tree/full 模式携带。 */
export interface FileIndexEntry {
  name: string
  path: string
  /** 递归总文件数（truncated=true 时为下界）。 */
  files: number
  /** 递归总子目录数（truncated=true 时为下界）。 */
  dirs: number
  /** true = 计数达到扫描上限，数字为下界。 */
  truncated?: boolean
  /** tree/full 模式携带的文件树（相对路径）。 */
  tree?: FileTreeNode[]
}

/** 统计文件树中的文件/目录数。 */
export function countNodes(nodes: readonly FileTreeNode[]): { files: number; dirs: number } {
  let files = 0
  let dirs = 0
  const visit = (list: readonly FileTreeNode[]): void => {
    for (const n of list) {
      if (n.type === 'file') files++
      else {
        dirs++
        if (n.children !== undefined) visit(n.children)
      }
    }
  }
  visit(nodes)
  return { files, dirs }
}

/** 低信号目录（测试/夹具/快照/端到端），其下内容在预算截断时优先丢弃。 */
const LOW_SIGNAL_DIR = /(^|\/)(__tests__|__mocks__|__snapshots__|tests?|fixtures?|snapshots?|testdata|mocks?|e2e)(\/|$)/
/** 低信号文件（测试/快照/生成物/锁文件/声明文件/sourcemap）。 */
const LOW_SIGNAL_FILE = /(\.(test|spec)\.[cm]?[jt]sx?$)|(\.(snap|lock|map|d\.ts)$)|(\.min\.(js|css)$)|(^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|go\.sum|poetry\.lock|Cargo\.lock)$)/i
/** 高信号入口文件（优先展示）。 */
const HIGH_SIGNAL_FILE = /^(index|main|app|entry|server|cli)\.[cm]?[jt]sx?$/i

/**
 * 节点展示优先级：0=入口，1=普通，2=低信号。截断从尾部丢弃，所以低信号排最后，
 * 命中预算时先丢测试/夹具/生成物，而不是按文件名顺序误伤源码。
 */
export function signalRank(node: FileTreeNode): number {
  if (LOW_SIGNAL_DIR.test(node.path)) return 2
  if (node.type === 'file') {
    if (LOW_SIGNAL_FILE.test(node.name)) return 2
    if (HIGH_SIGNAL_FILE.test(node.name)) return 0
  }
  return 1
}

/** 渲染顺序：信号优先 > 目录优先 > 名称。 */
function compareNodes(a: FileTreeNode, b: FileTreeNode): number {
  const rank = signalRank(a) - signalRank(b)
  if (rank !== 0) return rank
  const kind = (a.type === 'dir' ? 0 : 1) - (b.type === 'dir' ? 0 : 1)
  if (kind !== 0) return kind
  return a.name.localeCompare(b.name)
}

/** 把文件树渲染成缩进文本（目录树加载模式使用；按信号排序，截断先丢低信号）。 */
export function renderTree(nodes: readonly FileTreeNode[], indent = ''): string {
  const lines: string[] = []
  for (const n of [...nodes].sort(compareNodes)) {
    lines.push(indent + n.name + (n.type === 'dir' ? '/' : ''))
    if (n.type === 'dir' && n.children !== undefined) lines.push(renderTree(n.children, indent + '  '))
  }
  return lines.join('\n')
}

/** 粗略 token 估算：CJK 字符约 1 字符≈1 token，其余约 4 字符≈1 token。 */
export function estimateTokens(text: string): number {
  let cjk = 0
  let other = 0
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3000 && code <= 0x303f) || (code >= 0xff00 && code <= 0xffef)) cjk++
    else other++
  }
  return Math.ceil(cjk + other / 4)
}
