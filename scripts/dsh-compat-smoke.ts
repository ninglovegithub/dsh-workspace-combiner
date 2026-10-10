import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
  engines?: { node?: string }
  dsh?: { host?: string; bundle?: { patch?: string }; client?: { platform?: string; inject?: string[] } }
  peerDependencies?: Record<string, string>
}

/**
 * 当前支持的 DSH seam 版本。与 peerDependencies 一样用范围表达：桌面端实际跑的是
 * `latest` 通道（写这份测试时是 0.2.0-rc.2），语义化范围能同时覆盖后续 rc。
 */
const target = '>=0.2.0-rc.1 <0.3.0'
const seams = [
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-host-webserver',
  '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-system-prompt',
]
/**
 * `dsh.client.inject` 是模块图/预取元数据，条目必须是**包名**：DSH 的
 * ClientModuleRegistry 只按包 id 建边，未知条目会被静默忽略（既不报错也不生效）。
 */
const clientPackages = [
  '@deepseek-ai/dsh-client-ui-renderer',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-api-session-controller',
  '@deepseek-ai/dsh-api-workspace-controller',
  '@deepseek-ai/dsh-api-gateway',
  '@deepseek-ai/dsh-client-ui-workspace',
]

assert.equal(manifest.dsh?.host, undefined, 'legacy dsh.host blocks forward-compatible manifest parsing')
assert.equal(manifest.dsh?.bundle?.patch, './cordis.patch.yml')
assert.equal(manifest.dsh?.client?.platform, 'web')
for (const seam of seams) assert.equal(manifest.peerDependencies?.[seam], target, `${seam} must match the supported DSH seam range`)
for (const pkg of clientPackages) {
  assert.ok(manifest.dsh?.client?.inject?.includes(pkg), `missing client package: ${pkg}`)
  assert.ok(pkg.startsWith('@deepseek-ai/'), 'dsh.client.inject entries must be package names, not service names')
}
assert.match(manifest.engines?.node ?? '', /22\.19\.0/)

console.log(`dsh compatibility smoke: seam range ${target}, modern manifest, package-name client inject OK`)
