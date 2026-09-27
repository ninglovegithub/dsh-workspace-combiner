/**
 * Git 状态回显：读取某目录的当前分支 / 未提交修改数 / 未跟踪数 / 领先远程提交数。
 * 用 execFile（不经 shell）调用 git，带超时；任何错误（非 git 仓库、无 git、
 * 超时）一律返回 null，不抛异常——面板只是回显，不应影响其它功能。
 * @module dsh-workspace-combiner/host/gitStatus
 */

import { execFile } from 'node:child_process'
import type { GitStatus } from '../core/types.ts'

export type { GitStatus }

/** git 子进程超时（毫秒）。 */
const GIT_TIMEOUT_MS = 5000

/** 匹配 "[ahead N]"。 */
const AHEAD_RE = /\[ahead (\d+)/

/** 单次列出的变更文件上限（防大仓库把请求体撑爆）。 */
const MAX_CHANGED_FILES = 200

/**
 * 解析 git status --porcelain 的变更文件列表（跳过分支头行）。
 * 重命名行形如 'R  old -> new'，取箭头右侧的新路径。
 * @param stdout - git 的标准输出。
 * @returns 相对仓库根的路径列表（去重、封顶）。
 */
export function parseChangedFiles(stdout: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const line of stdout.split('\n')) {
    if (line.length < 4 || line.startsWith('## ')) continue
    let file = line.slice(3)
    const arrow = file.indexOf(' -> ')
    if (arrow >= 0) file = file.slice(arrow + 4)
    // git 对含空格/中文的路径会加引号并转义；去掉外层引号即可覆盖常见情况。
    if (file.startsWith('"') && file.endsWith('"') && file.length > 1) file = file.slice(1, -1)
    if (file === '' || seen.has(file)) continue
    seen.add(file)
    out.push(file)
    if (out.length >= MAX_CHANGED_FILES) break
  }
  return out
}

/**
 * 列出目录下已变更（含未跟踪）的文件，相对该目录根。
 * @param path - 目录绝对路径。
 * @returns 相对路径列表；非 git 仓库 / 任何失败返回空数组。
 */
export async function getChangedFiles(path: string): Promise<string[]> {
  const trimmed = path.trim()
  if (trimmed === '') return []
  return await new Promise<string[]>((resolve) => {
    execFile(
      'git',
      ['-C', trimmed, 'status', '--porcelain', '--short'],
      { timeout: GIT_TIMEOUT_MS, maxBuffer: 4 << 20, windowsHide: true },
      (error, stdout) => {
        if (error !== null) {
          resolve([])
          return
        }
        try {
          resolve(parseChangedFiles(stdout))
        } catch {
          resolve([])
        }
      },
    )
  })
}

/**
 * 解析 git status --porcelain -b 的输出。
 * 首行形如 '## main...origin/main [ahead 2]'；其余行前两列是 XY 状态码，
 * '??' 表示未跟踪，其余（M/A/D/R 等）计入已修改。
 * @param stdout - git 的标准输出。
 * @returns 解析出的状态。
 */
export function parseGitStatus(stdout: string): GitStatus {
  const lines = stdout.split('\n')
  let branch = ''
  let ahead = 0
  let dirty = 0
  let untracked = 0
  for (const line of lines) {
    if (line === '') continue
    if (line.startsWith('## ')) {
      const head = line.slice(3).trim()
      const aheadMatch = AHEAD_RE.exec(head)
      if (aheadMatch !== null) ahead = Number(aheadMatch[1])
      if (head.startsWith('HEAD (no branch)')) {
        branch = 'HEAD'
      } else {
        const dots = head.indexOf('...')
        const noUpstream = head.split(' ')[0]
        const resolved = dots >= 0 ? head.slice(0, dots) : noUpstream
        branch = resolved.trim()
      }
      continue
    }
    const code = line.slice(0, 2)
    if (code === '??') untracked++
    else dirty++
  }
  return { branch, dirty, untracked, ahead }
}

/**
 * 读取目录的 git 状态（execFile，无 shell，5s 超时）。
 * @param path - 目录绝对路径。
 * @returns git 状态；非 git 仓库 / 任何失败返回 null。
 */
export async function getGitStatus(path: string): Promise<GitStatus | null> {
  const trimmed = path.trim()
  if (trimmed === '') return null
  return await new Promise<GitStatus | null>((resolve) => {
    execFile(
      'git',
      ['-C', trimmed, 'status', '--porcelain', '-b', '--short'],
      { timeout: GIT_TIMEOUT_MS, maxBuffer: 1 << 20, windowsHide: true },
      (error, stdout) => {
        if (error !== null) {
          resolve(null)
          return
        }
        try {
          resolve(parseGitStatus(stdout))
        } catch {
          resolve(null)
        }
      },
    )
  })
}

