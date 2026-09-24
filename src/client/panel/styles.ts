/**
 * 面板样式：内联 CSS 字符串 + 运行时一次性注入 <style> 标签。
 *
 * 为什么不用 .module.css：DSH client 半面是单文件 JS（/plugins/<id>/client.js），
 * 加载器不会额外拉取分离的 style.css。与 @chaoset/sandbox-extra-roots 的 client
 * 同套路——把 CSS 作为字符串打进 bundle，挂载时以 data-plugin-css 打标注入，幂等。
 * @module dsh-workspace-combiner/client/panel/styles
 */

const PANEL_CSS = `
.wcb-root{display:flex;flex-direction:column;gap:8px;height:100%;padding:12px;box-sizing:border-box;color:var(--dsw-alias-label-primary);font-size:13px;line-height:18px}
.wcb-title{font-size:15px;font-weight:600;line-height:22px}
.wcb-warning{border:1px solid var(--dsw-alias-state-warn-primary,#b76e00);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#b76e00) 12%,transparent);color:var(--dsw-alias-state-warn-primary,#b76e00);border-radius:8px;padding:8px 10px;font-size:12px;line-height:17px}
.wcb-section{margin-top:4px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.wcb-hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:17px}
.wcb-list{list-style:none;margin:0;padding:0;overflow-y:auto;min-height:0;display:flex;flex-direction:column;gap:2px}
.wcb-row{border-radius:6px}
.wcb-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.wcb-row-label{display:flex;align-items:flex-start;gap:8px;padding:5px 6px;cursor:pointer}
.wcb-checkbox{flex:none;margin:2px 0 0;accent-color:var(--dsw-alias-state-accent,#4f8cff)}
.wcb-name{flex:none;max-width:40%;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wcb-path{flex:1;min-width:0;color:var(--dsw-alias-label-tertiary);font-size:11px;font-family:var(--ds-font-family-code,monospace);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wcb-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:2px 0}
.wcb-count{color:var(--dsw-alias-label-tertiary);font-size:12px}
.wcb-save-row{display:flex;gap:6px}
.wcb-input{flex:1;min-width:0;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:6px;padding:5px 8px;font:inherit;font-size:12px}
.wcb-input:focus{outline:none;border-color:var(--dsw-alias-state-accent,#4f8cff)}
.wcb-btn,.wcb-btn-primary,.wcb-btn-danger{font:inherit;font-size:12px;line-height:18px;cursor:pointer;border-radius:6px;padding:4px 12px;border:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-primary)}
.wcb-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.wcb-btn-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3);border-color:transparent}
.wcb-btn-danger{color:var(--dsw-alias-state-error-primary,#d64545)}
.wcb-btn:disabled,.wcb-btn-primary:disabled{opacity:.4;cursor:default}
.wcb-template-row{display:flex;align-items:center;gap:6px;padding:4px 2px}
.wcb-template-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wcb-template-count{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11px}
.wcb-status{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:17px}
`.trim()

/** 注入面板样式（幂等：同 id 已存在则跳过）。 */
export function injectPanelStyles(): void {
  if (typeof document === 'undefined') return
  const id = 'dsh-workspace-combiner/client.css'
  if (document.querySelector(`style[data-plugin-css="${id}"]`) !== null) return
  const tag = document.createElement('style')
  tag.setAttribute('data-plugin-css', id)
  tag.textContent = PANEL_CSS
  document.head.appendChild(tag)
}
