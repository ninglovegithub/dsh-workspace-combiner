/**
 * 由工作空间名称推导**磁盘目录名**。
 *
 * 与「名称」不同：目录名要能跨平台落盘，所以必须去掉 Windows 非法字符与保留名。
 * 路由（真正建目录）与客户端（复制弹窗里预览目标路径）共用这一份实现，避免
 * 预览显示 `/x/a:b` 而实际建成 `/x/ab`。
 *
 * @module dsh-workspace-combiner/core/folderName
 */

import { DEFAULT_WORKSPACE_NAME } from '../invariant.ts'

/** 目录名最大长度（字节层面留足余量，避免触发各平台路径长度限制）。 */
const MAX_FOLDER_NAME_LENGTH = 80

/**
 * 名称 -> 可落盘的目录名。
 *
 * 必须显式拒绝 `.` / `..` / 纯点名称：它们能通过字符过滤，然后 `join(basePath, '..')`
 * 会让主目录变成 basePath 的**父目录**，并被当成可写根写进 prompt 与沙盒白名单。
 * Windows 另需拒绝设备保留名与结尾的点/空格。
 * @param name - 用户输入的工作空间名称。
 * @returns 合法目录名；无法得到合法名字时回退到默认名称。
 */
export function sanitizeFolderName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, '')
    .trim()
    .replace(/[. ]+$/, '')
  if (cleaned === '' || /^\.+$/.test(cleaned)) return DEFAULT_WORKSPACE_NAME
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(cleaned)) return DEFAULT_WORKSPACE_NAME
  return cleaned.slice(0, MAX_FOLDER_NAME_LENGTH)
}
