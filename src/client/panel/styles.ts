/**
 * 面板样式：内联 CSS 字符串 + 运行时一次性注入 <style> 标签（单文件 client bundle
 * 无法拉取分离 .css）。全部使用 DSH 设计令牌（--dsw-alias-*）以自动适配明暗主题，
 * 并带浅色兜底值。
 * @module dsh-workspace-combiner/client/panel/styles
 */

const PANEL_CSS = `
.wcb-root{display:flex;flex-direction:column;gap:10px;height:100%;padding:12px;box-sizing:border-box;color:var(--dsw-alias-label-primary,#1f2329);font-size:13px;line-height:18px;overflow-y:auto}
.wcb-header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.wcb-title{font-size:15px;font-weight:600;line-height:22px}
.wcb-subtitle{color:var(--dsw-alias-label-tertiary,#8a919f);font-size:12px;line-height:17px}
.wcb-warning{border:1px solid var(--dsw-alias-state-warn-primary,#b76e00);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#b76e00) 12%,transparent);color:var(--dsw-alias-state-warn-primary,#b76e00);border-radius:8px;padding:8px 10px;font-size:12px;line-height:17px}

/* 卡片式布局 */
.wcb-card{border:1px solid var(--dsw-alias-border-l2,#e4e7ec);background:var(--dsw-alias-bg-layer-2,#f7f8fa);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px}
.wcb-section{margin:0;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#4e5969)}
.wcb-hint{color:var(--dsw-alias-label-tertiary,#8a919f);font-size:12px;line-height:17px}




.wcb-ws-name{flex:none;max-width:40%;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wcb-ws-path{flex:1;min-width:0;color:var(--dsw-alias-label-tertiary,#8a919f);font-size:11px;font-family:var(--ds-font-family-code,monospace);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* 输入与按钮 */
.wcb-add-row,.wcb-save-row,.wcb-toolbar{display:flex;gap:6px;align-items:center}
.wcb-add-row .wcb-input{flex:1;min-width:0}
.wcb-input{flex:1;min-width:0;border:1px solid var(--dsw-alias-border-l2,#e4e7ec);background:var(--dsw-alias-bg-layer-3,#fff);color:var(--dsw-alias-label-primary,#1f2329);border-radius:6px;padding:5px 8px;font:inherit;font-size:12px}
.wcb-input:focus{outline:none;border-color:var(--dsw-alias-state-accent,#4f8cff)}
.wcb-btn,.wcb-btn-primary,.wcb-btn-danger{font:inherit;font-size:12px;line-height:18px;cursor:pointer;border-radius:6px;padding:4px 12px;border:1px solid var(--dsw-alias-border-l1,#d8dce3);background:transparent;color:var(--dsw-alias-label-primary,#1f2329);white-space:nowrap}
.wcb-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04))}
.wcb-btn-primary{background:var(--dsw-alias-state-accent,#4f8cff);color:#fff;border-color:transparent}
.wcb-btn-primary:hover{filter:brightness(1.05)}
.wcb-btn-danger{color:var(--dsw-alias-state-error-primary,#d64545);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d64545) 30%,transparent)}
.wcb-btn-danger:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d64545) 10%,transparent)}
.wcb-btn:disabled,.wcb-btn-primary:disabled{opacity:.4;cursor:default}
.wcb-btn:disabled:hover,.wcb-btn-primary:disabled:hover{background:var(--dsw-alias-state-accent,#4f8cff);filter:none}

/* 目录列表 */
.wcb-dir-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;min-height:0}
.wcb-dir-row{display:flex;align-items:center;gap:8px;border:1px solid transparent;border-radius:8px;padding:6px 8px;background:var(--dsw-alias-bg-layer-3,#fff);transition:border-color .12s,box-shadow .12s,opacity .12s}
.wcb-dir-row:hover{border-color:var(--dsw-alias-border-l1,#d8dce3)}
.wcb-dir-row.wcb-dragging{opacity:.45}
.wcb-dir-row.wcb-over{border-color:var(--dsw-alias-state-accent,#4f8cff);box-shadow:0 0 0 1px var(--dsw-alias-state-accent,#4f8cff) inset}
.wcb-drag-handle{flex:none;color:var(--dsw-alias-label-tertiary,#8a919f);cursor:grab;user-select:none;font-size:14px}
.wcb-star{flex:none;color:#f7ba2a;font-size:14px}

.wcb-dir-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.wcb-dir-title{display:flex;align-items:center;gap:6px;min-width:0}
.wcb-dir-name{flex:none;max-width:50%;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wcb-tag{flex:none;border-radius:4px;padding:0 6px;font-size:10px;line-height:15px;color:var(--dsw-alias-label-tertiary,#8a919f);background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}
.wcb-tag-primary{color:#c06a12;background:color-mix(in srgb,#f7ba2a 16%,transparent)}
.wcb-dir-path{color:var(--dsw-alias-label-tertiary,#8a919f);font-size:11px;font-family:var(--ds-font-family-code,monospace);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.wcb-remove{flex:none;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;border:none;background:transparent;color:var(--dsw-alias-label-tertiary,#8a919f);border-radius:4px;cursor:pointer;font-size:16px;line-height:1;opacity:0;transition:opacity .12s,background .12s}
.wcb-dir-row:hover .wcb-remove,.wcb-remove:focus-visible{opacity:1}
.wcb-remove:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d64545) 12%,transparent);color:var(--dsw-alias-state-error-primary,#d64545)}

/* 底部操作 */
.wcb-footer{display:flex;align-items:center;justify-content:space-between;gap:8px}
.wcb-count{color:var(--dsw-alias-label-tertiary,#8a919f);font-size:12px}
.wcb-footer-actions{display:flex;gap:6px}



/* toast */
.wcb-toast{position:sticky;bottom:0;margin-top:auto;border-radius:8px;padding:8px 12px;font-size:12px;line-height:17px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.18);z-index:40}
.wcb-toast-ok{background:color-mix(in srgb,var(--dsw-alias-state-success,#2ba471) 92%,#000);color:#fff}
.wcb-toast-error{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d64545) 92%,#000);color:#fff}

/* 弹窗 */
.wcb-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px}
.wcb-modal{width:380px;max-width:100%;max-height:76vh;display:flex;flex-direction:column;gap:10px;background:var(--dsw-alias-bg-layer-3,#fff);color:var(--dsw-alias-label-primary,#1f2329);border-radius:12px;padding:14px;box-shadow:0 12px 40px rgba(0,0,0,.3)}
.wcb-modal-title{font-size:14px;font-weight:600;line-height:20px}
.wcb-modal-body{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#4e5969)}

.wcb-modal-actions{display:flex;justify-content:flex-end;gap:6px}

/* 自定义工作空间列表 */
.wcb-section-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.wcb-section-row .wcb-section{margin:0}
.wcb-workspace-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;min-height:0}
.wcb-ws-item{display:flex;flex-direction:column;gap:1px;border:1px solid var(--dsw-alias-border-l2,#e4e7ec);border-radius:8px;padding:6px 10px;background:var(--dsw-alias-bg-layer-3,#fff);cursor:pointer;transition:border-color .12s,background .12s}
.wcb-ws-item:hover{border-color:var(--dsw-alias-border-l1,#d8dce3)}
.wcb-ws-item.wcb-ws-active{border-color:var(--dsw-alias-state-accent,#4f8cff);background:color-mix(in srgb,var(--dsw-alias-state-accent,#4f8cff) 8%,transparent)}
.wcb-ws-title-row{display:flex;align-items:center;gap:6px;min-width:0}
.wcb-ws-name{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wcb-ws-current{flex:none;border-radius:4px;padding:0 6px;font-size:10px;line-height:15px;color:#fff;background:var(--dsw-alias-state-accent,#4f8cff)}
.wcb-ws-meta{color:var(--dsw-alias-label-tertiary,#8a919f);font-size:11px}
.wcb-ws-actions{flex:none;margin-left:auto;display:flex;gap:4px}
.wcb-ws-act{flex:none;border:none;background:transparent;color:var(--dsw-alias-label-tertiary,#8a919f);border-radius:4px;cursor:pointer;font-size:11px;line-height:16px;padding:0 4px}
.wcb-ws-act:hover{color:var(--dsw-alias-label-primary,#1f2329);background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}
.wcb-ws-act-danger:hover{color:var(--dsw-alias-state-error-primary,#d64545);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#d64545) 12%,transparent)}

/* 表单字段（弹窗内） */
.wcb-field{display:flex;flex-direction:column;gap:3px}
.wcb-field span{font-size:12px;color:var(--dsw-alias-label-secondary,#4e5969)}
.wcb-field .wcb-input{width:100%;box-sizing:border-box}



/* 新建工作空间向导 */
.wcb-modal-wide{width:520px}
.wcb-wizard-steps{display:flex;align-items:center;gap:6px}
.wcb-wizard-step{flex:1;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a919f);padding:6px 8px;border-radius:6px;background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04))}
.wcb-wizard-step-num{flex:none;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;font-size:11px;background:var(--dsw-alias-border-l1,#d8dce3);color:var(--dsw-alias-label-secondary,#4e5969)}
.wcb-wizard-step-active{color:var(--dsw-alias-state-accent,#4f8cff);font-weight:600}
.wcb-wizard-step-active .wcb-wizard-step-num{background:var(--dsw-alias-state-accent,#4f8cff);color:#fff}
.wcb-wizard-step-done .wcb-wizard-step-num{background:var(--dsw-alias-state-success,#2ba471);color:#fff}
.wcb-wizard-body{display:flex;flex-direction:column;gap:8px;min-height:120px}
.wcb-wizard-list{display:flex;flex-direction:column;gap:6px}

/* 项目类型徽标 */
.wcb-type{flex:none;display:inline-flex;align-items:center;border-radius:999px;padding:1px 8px;font-size:11px;line-height:16px;font-weight:500;white-space:nowrap;cursor:default}
.wcb-type-java{background:color-mix(in srgb,#f0892a 16%,transparent);color:#c06a12}
.wcb-type-frontend{background:color-mix(in srgb,#4f8cff 16%,transparent);color:#2f6fe0}
.wcb-type-python{background:color-mix(in srgb,#2ba471 16%,transparent);color:#1f7a4d}
.wcb-type-go{background:color-mix(in srgb,#14b8c8 16%,transparent);color:#0e7d8a}
.wcb-type-generic{background:color-mix(in srgb,#8a919f 16%,transparent);color:#5f6672}
.wcb-type-none{background:transparent;color:#5f6672;border:1px solid color-mix(in srgb,#8a919f 45%,transparent)}

/* 扫描识别列表 */
.wcb-modal-toolbar{display:flex;justify-content:flex-end}
.wcb-scan-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;overflow-y:auto;max-height:40vh}
.wcb-scan-item{display:flex;align-items:center;gap:8px;border:1px solid var(--dsw-alias-border-l2,#e4e7ec);border-radius:8px;padding:8px 10px}
.wcb-scan-item input{flex:none;margin:0;accent-color:var(--dsw-alias-state-accent,#4f8cff)}
.wcb-scan-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.wcb-scan-name{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wcb-scan-path{color:var(--dsw-alias-label-tertiary,#8a919f);font-size:11px;font-family:var(--ds-font-family-code,monospace);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
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
