import { chmod, mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { StandardGroup } from '../core/standards.ts'
import type { WorkspaceRef } from '../core/types.ts'
import { renderCommandsText, renderStandardsText } from '../prompt.ts'
import { dshHome } from '../store.ts'

export function standardsTextFile(): string {
  return join(dshHome(), 'dsh-workspace-combiner-standards-context.txt')
}

export function commandsTextFile(): string {
  return join(dshHome(), 'dsh-workspace-combiner-commands.txt')
}

async function writeContextFile(file: string, text: string): Promise<string | undefined> {
  if (text === '') return undefined
  try {
    await mkdir(dirname(file), { recursive: true, mode: 0o700 })
    const tmp = file + '.' + process.pid + '.tmp'
    await writeFile(tmp, text, { mode: 0o600 })
    await rename(tmp, file)
    await chmod(file, 0o600).catch(() => {})
    return file
  } catch {
    return undefined
  }
}

export interface OnDemandContextFiles {
  standardsPath?: string
  commandsPath?: string
}

export async function persistOnDemandContext(
  directories: readonly WorkspaceRef[],
  standardGroups: readonly StandardGroup[],
): Promise<OnDemandContextFiles> {
  const standardsText = renderStandardsText(standardGroups)
  const commandsText = renderCommandsText(directories)
  const [standardsPath, commandsPath] = await Promise.all([
    writeContextFile(standardsTextFile(), standardsText),
    writeContextFile(commandsTextFile(), commandsText),
  ])
  return {
    ...(standardsPath === undefined ? {} : { standardsPath }),
    ...(commandsPath === undefined ? {} : { commandsPath }),
  }
}
