import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { buildCodeIndex } from '../src/host/codeIndex.ts'
import { isIgnored, loadGitignore } from '../src/host/fileIndex.ts'
import type { WorkspaceRef } from '../src/core/types.ts'

/**
 * Java/Kotlin 依赖解析的差分回归：把改前的实现（同一目录候选里按插入顺序取首个
 * `endsWith('/' + suffix + '.java' | '.kt')`）作为 oracle，验证改成后缀索引后
 * 输出逐条一致，包括「同名类出现在两个包路径」的首个胜出语义。
 */

/** 旧实现：与改前 resolveLocal 的 Java 分支逐字等价。 */
function oracleTarget(candidates: readonly string[], specifier: string): string | undefined {
  const suffix = specifier.replace(/\./g, '/')
  return candidates.find(candidate => candidate.endsWith('/' + suffix + '.java') || candidate.endsWith('/' + suffix + '.kt'))
}

/** 复刻 collectCodeFiles 的候选插入顺序：同一根下按 readdir 顺序 DFS。 */
async function candidateOrder(root: string): Promise<string[]> {
  const patterns = await loadGitignore(root)
  const out: string[] = []
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const abs = join(dir, entry.name)
      const rel = relative(root, abs).split(sep).join('/')
      if (isIgnored(rel, entry.isDirectory(), patterns)) continue
      if (entry.isDirectory()) {
        await walk(abs)
        continue
      }
      if (entry.name.lastIndexOf('.') <= 0) continue
      if (!/\.(java|kt)$/i.test(entry.name)) continue
      out.push(rel)
    }
  }
  await walk(root)
  return out
}

const root = await mkdtemp(join(tmpdir(), 'wcb-code-index-java-'))
const project = join(root, 'project')

const alphaLines = [
  'import com.example.user.UserService;',
  'import com.example.common.ApiResponse;',
  'import one.Shared;',
  'import case.Case;',
  'import root.Root;',
  'import deep.Root;',
  'import com.example.user.Missing;',
  'class Alpha {}',
]
const betaLines = [
  'import one.Shared',
  'import com.example.user.UserService',
  'class Beta',
]

try {
  const fixture: Record<string, string> = {
    'Alpha.java': alphaLines.join('\n'),
    'Beta.kt': betaLines.join('\n'),
    // 根级文件没有 '/' 前缀，任何包名后缀都不该命中它。
    'Root.java': 'class Root {}\n',
    // 扩展名大小写敏感：Case.JAVA 不得被 import case.Case 命中。
    'lib/case/Case.JAVA': 'class Case {}\n',
    'lib/one/Shared.java': 'package one;\nclass Shared {}\n',
    'lib/two/Shared.kt': 'package two\nclass Shared\n',
    'lib/deep/Root.java': 'package deep;\nclass Root {}\n',
    'one/com/example/user/UserService.java': 'package com.example.user;\nclass UserService {}\n',
    'two/com/example/user/UserService.java': 'package com.example.user;\nclass UserService {}\n',
    'one/com/example/common/ApiResponse.java': 'package com.example.common;\nclass ApiResponse {}\n',
  }
  for (const [rel, body] of Object.entries(fixture)) {
    const abs = join(project, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, body)
  }

  const candidates = await candidateOrder(project)
  assert.ok(candidates.includes('one/com/example/user/UserService.java'), 'fixture must be collected')
  assert.ok(candidates.includes('two/com/example/user/UserService.java'), 'ambiguity fixture must be collected')

  const imports = [
    ...alphaLines.flatMap((line, index) => /^import\s+(.+);$/.test(line) ? [{ file: 'Alpha.java', line: index + 1, specifier: /^import\s+(.+);$/.exec(line)![1] }] : []),
    ...betaLines.flatMap((line, index) => /^import\s+(.+)$/.test(line) ? [{ file: 'Beta.kt', line: index + 1, specifier: /^import\s+(.+)$/.exec(line)![1] }] : []),
  ]

  const expected: Array<{ from: string; to: string; line: number }> = []
  const seen = new Set<string>()
  for (const item of imports) {
    const to = oracleTarget(candidates, item.specifier)
    if (to === undefined) continue
    const key = item.file + '\u0000' + to
    if (seen.has(key)) continue
    seen.add(key)
    expected.push({ from: item.file, to, line: item.line })
  }
  expected.sort((a, b) => a.from.localeCompare(b.from) || a.line - b.line)

  const workspace: WorkspaceRef = { id: project, name: 'java-fixture', path: project, access: 'readwrite' }
  const result = await buildCodeIndex([workspace])
  const actual = result.dependencies
    .filter(dependency => dependency.from === 'Alpha.java' || dependency.from === 'Beta.kt')
    .map(dependency => ({ from: dependency.from, to: dependency.to, line: dependency.line }))
    .sort((a, b) => a.from.localeCompare(b.from) || a.line - b.line)

  assert.deepEqual(actual, expected, 'Java/Kotlin 依赖解析必须与旧实现逐条一致')

  // 「同名类在两个包路径」确实构成歧义，且结果落在候选之一（首胜语义被真正执行）。
  const ambiguous = actual.find(dependency => dependency.from === 'Alpha.java' && dependency.line === 1)?.to
  assert.ok(
    ambiguous === 'one/com/example/user/UserService.java' || ambiguous === 'two/com/example/user/UserService.java',
    'ambiguous specifier must resolve to one of the two candidates, got ' + String(ambiguous),
  )
  // 大小写敏感与根级文件不得被裸后缀命中。
  assert.equal(actual.some(dependency => dependency.from === 'Alpha.java' && dependency.line === 4), false, 'Case.JAVA must stay unmatched')
  assert.equal(actual.some(dependency => dependency.from === 'Alpha.java' && dependency.line === 5), false, 'root-level Root.java must stay unmatched')
  assert.equal(actual.some(dependency => dependency.from === 'Alpha.java' && dependency.line === 7), false, 'missing import must stay unmatched')
  // 正常命中的两种边界：单个目录段后缀、Kotlin 导入 Java 类。
  assert.equal(actual.find(dependency => dependency.from === 'Alpha.java' && dependency.line === 3)?.to, 'lib/one/Shared.java')
  assert.equal(actual.find(dependency => dependency.from === 'Alpha.java' && dependency.line === 6)?.to, 'lib/deep/Root.java')
  assert.equal(actual.find(dependency => dependency.from === 'Beta.kt' && dependency.line === 1)?.to, 'lib/one/Shared.java')

  console.log('code-index java smoke: O(1) suffix index matches legacy resolveLocal, first-wins and case-sensitivity OK')
} finally {
  await rm(root, { recursive: true, force: true })
}
