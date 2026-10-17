/**
 * 与 DSH 工作区注册表（`workspaceRegistry`）协作。
 *
 * 插件在删除一个工作空间时，DSH 左侧栏里为它的主目录建的那条工作区会一直留着，
 * 变成历史遗留。这里负责把对应的一并清理：**先归档该工作区名下的会话（可恢复），
 * 再移除工作区条目**。
 *
 * 两条安全约束：
 *  1. 只要还有任何一个插件工作空间在用这个目录（例如「复制工作空间」产生的副本与
 *     原工作空间共享同一批目录），就完全不碰 DSH 侧；
 *  2. 只要有会话没能归档（例如仍在运行），就不移除工作区条目——否则会留下一个
 *     不属于任何工作区的活动会话。
 *
 * @module dsh-workspace-combiner/host/dshWorkspaces
 */

/** DSH 工作区实体（只声明本模块用到的那部分）。 */
export interface DshWorkspaceEntity {
  readonly id: string
  readonly path: string
  readonly title: string
  readonly sessionIds: readonly string[]
}

/** `workspaceRegistry` 服务（只声明本模块用到的方法）。 */
export interface DshWorkspaceRegistry {
  resolveByPath(path: string): Promise<DshWorkspaceEntity | undefined>
  archiveSession(sessionId: string, options?: { stopActivity?: boolean }): Promise<unknown>
  delete(id: string): Promise<unknown>
}

/** 一次清理的结果（回给客户端用于提示）。 */
export interface DshRetireResult {
  /** 被归档的会话 id。 */
  readonly archived: readonly string[]
  /** 归档失败的会话 id。 */
  readonly failed: readonly string[]
  /** 工作区条目是否已从 DSH 左侧栏移除。 */
  readonly removed: boolean
  /** 处理过的目录路径。 */
  readonly path: string
}

/**
 * 清理一个目录对应的 DSH 工作区：归档其全部会话，再从注册表移除工作区条目。
 *
 * 服务缺失（例如在没有工作区注册表的组合里）时安静返回空结果，不影响插件自身的删除。
 * @param registry - `workspaceRegistry` 服务；取不到时传 undefined。
 * @param path - 刚被删除的工作空间目录（主目录或任一挂载目录）。
 * @returns 归档/移除结果。
 */
export async function retireDshWorkspace(
  registry: DshWorkspaceRegistry | undefined,
  path: string,
): Promise<DshRetireResult> {
  const empty: DshRetireResult = { archived: [], failed: [], removed: false, path }
  if (registry === undefined) return empty

  let entity: DshWorkspaceEntity | undefined
  try {
    entity = await registry.resolveByPath(path)
  } catch {
    // realpath 失败（目录已不存在等）：DSH 侧不可解析，当作没有对应工作区。
    return empty
  }
  if (entity === undefined) return empty

  const archived: string[] = []
  const failed: string[] = []
  for (const sessionId of entity.sessionIds) {
    try {
      // 工作空间已经删了，仍在跑的任务一并停掉，否则归档会被拒绝。
      await registry.archiveSession(sessionId, { stopActivity: true })
      archived.push(sessionId)
    } catch {
      failed.push(sessionId)
    }
  }

  // 还有会话没归档成功时不能删条目：那会让活动会话失去归属。
  if (failed.length > 0) return { archived, failed, removed: false, path }

  let removed = false
  try {
    await registry.delete(entity.id)
    removed = true
  } catch {
    removed = false
  }
  return { archived, failed, removed, path }
}
