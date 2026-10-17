/**
 * token 数量的统一展示格式。
 *
 * 界面上一律写全 `token`，不用 `t` / `T` 缩写——用户看不出那是什么单位。
 * 数值本身超过 1000 时用 `16.0k` 这种紧凑写法，避免长数字把窄侧栏撑开。
 *
 * @module dsh-workspace-combiner/client/panel/tokenFormat
 */

/**
 * 千分位 token 简写（32000 -> 32.0k，800 -> 800）。
 * @param n - token 数。
 * @returns 紧凑数值（不含单位）。
 */
export function kmTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0'
  return n < 1000 ? String(n) : (n / 1000).toFixed(1) + 'k'
}

/**
 * 带单位的 token 文案（`800 token` / `16.0k token`）。
 * @param n - token 数。
 * @returns 可直接展示的字符串。
 */
export function tokenText(n: number): string {
  return kmTokens(n) + ' token'
}
