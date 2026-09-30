import assert from 'node:assert/strict'
import { redactDiagnosticText, summarizeDiagnostics } from '../src/core/diagnostics.ts'
import type { DiagnosticItem } from '../src/core/types.ts'

const items: DiagnosticItem[] = [
  { id: 'directories', status: 'ok' },
  { id: 'commands', status: 'warning' },
  { id: 'store-config', status: 'error' },
  { id: 'sessions', status: 'unknown' },
]

assert.deepEqual(summarizeDiagnostics(items), { ok: 1, warning: 1, error: 1, unknown: 1 })

const redacted = redactDiagnosticText([
  '/Users/maning/project/.env',
  '/home/alice/repo',
  'api_key=sk-secret123456789',
  'Authorization: Bearer token-value',
  'ghp_1234567890abcdef',
].join('\n'))

assert.equal(redacted.includes('maning'), false)
assert.equal(redacted.includes('alice'), false)
assert.equal(redacted.includes('secret123456789'), false)
assert.equal(redacted.includes('token-value'), false)
assert.equal(redacted.includes('ghp_1234567890abcdef'), false)
assert.match(redacted, /\/Users\/<user>/)
assert.match(redacted, /<redacted/)

console.log('diagnostics smoke: ok')
