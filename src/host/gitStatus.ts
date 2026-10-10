/**
 * Git 状态回显：读取某目录的当前分支 / 未提交修改数 / 未跟踪数 / 领先远程提交数。
 * 用 execFile（不经 shell）调用 git，带超时；任何错误（非 git 仓库、无 git、
 * 超时）一律返回 null，不抛异常——面板只是回显，不应影响其它功能。
 * @module dsh-workspace-combiner/host/gitStatus
 */

import { execFile } from 'node:child_process'
import type { GitStatus } from '../core/types.ts'
import { warnIoFailure } from './fileIndex.ts'

export type { GitStatus }

/** git 子进程超时（毫秒）。 */
const GIT_TIMEOUT_MS = 5000

/** 匹配 "[ahead N]"。 */
const AHEAD_RE = /\[ahead (\d+)/

/** 单次列出的变更文件上限（防大仓库把请求体撑爆）。 */
const MAX_CHANGED_FILES = 200

/** 变更文件列表的输出缓冲上限（旧实现 4 MiB）；超出会返回 ERR_CHILD_PROCESS_STDIO_MAXBUFFER。 */
const CHANGED_FILES_MAX_BUFFER = 4 << 20

/** 状态回显的输出缓冲上限（旧实现 1 MiB）。 */
const STATUS_MAX_BUFFER = 1 << 20

/** Node 在 maxBuffer 溢出时给出的错误码。 */
const MAX_BUFFER_ERROR_CODE = 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'

/**
 * getChangedFilesDetailed 的结果：文件列表 + 是否因输出上限被截断。
 * `truncated=true` 时 `files` 只是 git 输出的**前缀**，不能当成"全部改动"。
 */
export interface ChangedFilesResult {
  files: string[]
  truncated: boolean
}

/**
 * getGitStatusDetailed 的结果。`truncated=true` 表示输出被截断、计数不可信，
 * 因此 `status` 为 null（而不是给出一个错误的 dirty/untracked 计数）。
 */
export interface GitStatusResult {
  status: GitStatus | null
  truncated: boolean
}

/** 是否为子进程输出超限（区别于非 git 仓库、超时、git 未安装）。 */
function isMaxBufferError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === MAX_BUFFER_ERROR_CODE
}

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
 *
 * 输出超过 maxBuffer 时返回 git 输出的**前缀**（并记一条限流告警），而不是旧实现的
 * 空数组——"什么都没改"是最危险的错误答案。需要区分"完整/截断"时用
 * {@link getChangedFilesDetailed}。
 * @param path - 目录绝对路径。
 * @returns 相对路径列表；非 git 仓库 / 任何失败返回空数组。
 */
export async function getChangedFiles(path: string): Promise<string[]> {
  return (await getChangedFilesDetailed(path)).files
}

/**
 * 同 {@link getChangedFiles}，但额外给出"是否被输出上限截断"。
 * @param path - 目录绝对路径。
 * @returns 文件列表与截断标记。
 */
export async function getChangedFilesDetailed(path: string): Promise<ChangedFilesResult> {
  const trimmed = path.trim()
  if (trimmed === '') return { files: [], truncated: false }
  return await new Promise<ChangedFilesResult>((resolve) => {
    execFile(
      'git',
      ['-C', trimmed, 'status', '--porcelain', '--short'],
      { timeout: GIT_TIMEOUT_MS, maxBuffer: CHANGED_FILES_MAX_BUFFER, windowsHide: true },
      (error, stdout) => {
        if (error === null) {
          resolve({ files: parseChangedFilesSafely(stdout, trimmed), truncated: false })
          return
        }
        if (isMaxBufferError(error)) {
          // stdout 仍是前缀：返回它并显式标注截断，同时告警一次（按路径限流）。
          warnIoFailure('git-status', trimmed, error)
          resolve({ files: parseChangedFilesSafely(stdout, trimmed), truncated: true })
          return
        }
        resolve({ files: [], truncated: false })
      },
    )
  })
}

/** 解析失败不抛（回退空列表），但要留下一次限流告警。 */
function parseChangedFilesSafely(stdout: string, path: string): string[] {
  try {
    return parseChangedFiles(stdout)
  } catch (error) {
    warnIoFailure('git-status', path, error)
    return []
  }
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
 * @returns git 状态；非 git 仓库 / 任何失败 / 输出被截断（计数不可信）返回 null。
 */
export async function getGitStatus(path: string): Promise<GitStatus | null> {
  return (await getGitStatusDetailed(path)).status
}

/**
 * 同 {@link getGitStatus}，但额外给出"是否被输出上限截断"。
 * @param path - 目录绝对路径。
 * @returns 状态与截断标记（截断时 status 为 null，避免给出错误的计数）。
 */
export async function getGitStatusDetailed(path: string): Promise<GitStatusResult> {
  const trimmed = path.trim()
  if (trimmed === '') return { status: null, truncated: false }
  return await new Promise<GitStatusResult>((resolve) => {
    execFile(
      'git',
      ['-C', trimmed, 'status', '--porcelain', '-b', '--short'],
      { timeout: GIT_TIMEOUT_MS, maxBuffer: STATUS_MAX_BUFFER, windowsHide: true },
      (error, stdout) => {
        if (error === null) {
          resolve({ status: parseGitStatusSafely(stdout, trimmed), truncated: false })
          return
        }
        if (isMaxBufferError(error)) {
          // 截断的 porcelain 会让 dirty/untracked 计数偏小，宁可回 null 也不能误导。
          warnIoFailure('git-status', trimmed, error)
          resolve({ status: null, truncated: true })
          return
        }
        resolve({ status: null, truncated: false })
      },
    )
  })
}

/** 解析失败不抛（回退 null），但要留下一次限流告警。 */
function parseGitStatusSafely(stdout: string, path: string): GitStatus | null {
  try {
    return parseGitStatus(stdout)
  } catch (error) {
    warnIoFailure('git-status', path, error)
    return null
  }
}

