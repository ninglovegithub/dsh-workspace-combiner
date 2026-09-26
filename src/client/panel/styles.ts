/**
 * 面板样式：内联 CSS 字符串 + 运行时一次性注入 <style> 标签。
 * v2.2 DSH 原生融合风：扁平、紧凑、无玻璃拟态、无大圆角卡片、无外发光。
 * 区块用底部分割线区分，标题小号大写灰色，和 DSH 左侧栏风格一致。
 * 颜色同时引用 --dsw-alias-* 令牌（明暗自适应）并带硬编码兜底。
 * @module dsh-workspace-combiner/client/panel/styles
 */

const PANEL_CSS = String.raw`
/* ============================================================
   dsh-workspace-combiner · DSH 原生融合风设计系统 v2.2
   扁平紧凑，和 DSH 左侧栏/侧边栏风格统一
   ============================================================ */
.wcb-root{
  /* --dsw-alias-brand-primary 是「前景/文本」语义令牌，会随明暗主题反转
     （暗色=近白 #f9fafb，亮色=近黑 #0f1115），当作填充色会让图标与背景同色。
     这里改用稳定的品牌蓝，并显式声明 on-accent 前景色。 */
  --wcb-accent:var(--dsw-static-deepseek-500,#4176e6);
  --wcb-accent-soft:var(--dsw-static-deepseek-450,#5686fe);
  --wcb-on-accent:#fff;
  --wcb-ok:var(--dsw-alias-state-success-primary,#5dd8a3);
  --wcb-purple:var(--dsw-alias-purple,#8b5cf6);
  --wcb-warn:var(--dsw-alias-state-warning-primary,#d4a017);
  --wcb-blue:var(--dsw-alias-brand-secondary,#3b82f6);
  --wcb-cyan:#2aa8b4;
  --wcb-muted:var(--dsw-alias-label-tertiary,#888);
  --wcb-dim:var(--dsw-alias-label-quaternary,#666);
  --wcb-danger:var(--dsw-alias-state-error-primary,#f85149);
  --wcb-text:var(--dsw-alias-label-primary,#e6edf3);
  --wcb-text2:var(--dsw-alias-label-secondary,#bbb);
  --wcb-text3:var(--dsw-alias-label-tertiary,#888);
  --wcb-surface:color-mix(in srgb,var(--dsw-alias-label-primary,#e6edf3) 3%,transparent);
  --wcb-surface2:color-mix(in srgb,var(--dsw-alias-label-primary,#e6edf3) 5%,transparent);
  --wcb-line:color-mix(in srgb,var(--dsw-alias-label-primary,#e6edf3) 7%,transparent);
  --wcb-line2:color-mix(in srgb,var(--dsw-alias-label-primary,#e6edf3) 10%,transparent);
  display:flex;flex-direction:column;gap:0;height:100%;box-sizing:border-box;
  padding:0;overflow:hidden;position:relative;
  color:var(--wcb-text2);font-size:12px;line-height:1.5;
  background:transparent;border-radius:0;border:none;box-shadow:none;
}
.wcb-root *{box-sizing:border-box}
.wcb-root ::-webkit-scrollbar{width:4px;height:4px}
.wcb-root ::-webkit-scrollbar-thumb{background:var(--wcb-line2);border-radius:999px}

/* ---------- 品牌行 ---------- */
.wcb-brand{display:flex;align-items:center;gap:8px;padding:10px 12px 8px;flex:none}
.wcb-brand-icon{width:22px;height:22px;border-radius:6px;flex:none;position:relative;
  background:var(--wcb-accent,#4176e6);color:var(--wcb-on-accent,#fff);box-shadow:0 2px 8px rgba(79,140,255,.3)}
/* 图标用纯 CSS 画两个错位方块（不依赖 SVG / 字体，避免缺字方块） */
.wcb-brand-icon::before,.wcb-brand-icon::after{content:"";position:absolute;width:7px;height:7px;
  border:1.5px solid currentColor;border-radius:1.5px;box-sizing:border-box}
.wcb-brand-icon::before{left:3.5px;top:7.5px}
.wcb-brand-icon::after{left:7.5px;top:3.5px}
.wcb-brand-icon>i{position:absolute;left:7px;top:7px;width:3.5px;height:1.5px;
  background:currentColor;transform:rotate(45deg);transform-origin:left center}
.wcb-brand-text{flex:1;min-width:0}
.wcb-title{font-size:13px;font-weight:600;color:var(--wcb-text);line-height:1.35}
.wcb-subtitle{color:var(--wcb-muted);font-size:10.5px;line-height:1.35}
.wcb-kbd{flex:none;color:var(--wcb-muted);font-size:9.5px;border:1px solid var(--wcb-line2);border-radius:4px;
  padding:1px 5px;background:var(--wcb-surface);font-family:var(--ds-font-family-code,monospace)}

/* ---------- 当前工作空间卡 ---------- */
.wcb-current{border-radius:6px;padding:9px 11px;margin:0 12px 8px;display:flex;align-items:center;gap:8px;flex:none;
  background:rgba(79,140,255,.07);border:1px solid rgba(79,140,255,.18);border-left:2px solid var(--wcb-accent)}
.wcb-status-dot{width:7px;height:7px;border-radius:50%;flex:none;background:var(--wcb-ok);box-shadow:0 0 4px rgba(93,216,163,.5)}
.wcb-status-off{background:var(--wcb-dim);box-shadow:none}
.wcb-current-text{flex:1;min-width:0}
.wcb-current-name{font-size:12.5px;font-weight:600;color:var(--wcb-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wcb-current-meta{color:var(--wcb-muted);font-size:10px;margin-top:1px;display:flex;gap:5px;align-items:center;min-width:0}
.wcb-current-meta .wcb-sep{opacity:.5}
.wcb-btn-new{flex:0 0 auto;font:inherit;font-size:11px;font-weight:500;color:var(--wcb-on-accent,#fff);cursor:pointer;white-space:nowrap;
  border:none;border-radius:5px;padding:5px 12px;min-width:auto;background:var(--wcb-accent,#4176e6)}
.wcb-btn-new:hover{filter:brightness(1.1)}
.wcb-btn-new:disabled{opacity:.4;cursor:default;filter:none}

/* ---------- 通用区块（扁平分割线） ---------- */
.wcb-card{border-radius:0;background:transparent;border:none;overflow:hidden;flex:none;
  border-bottom:1px solid var(--wcb-line)}
.wcb-card:last-child{border-bottom:none}
.wcb-card-grow{flex:1;min-height:0;display:flex;flex-direction:column;border-bottom:1px solid var(--wcb-line)}
.wcb-card-head{padding:7px 12px;display:flex;align-items:center;gap:6px;
  font-size:10.5px;font-weight:600;color:var(--wcb-muted);
  text-transform:uppercase;letter-spacing:.3px;user-select:none;cursor:default;border:none;
  white-space:nowrap}
.wcb-card-head-btn{cursor:pointer}
.wcb-card-body{padding:7px 12px;display:flex;flex-direction:column;gap:7px}
.wcb-card-grow .wcb-card-body{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column}
.wcb-card-grow .wcb-dir-list{flex:1;min-height:0;overflow-y:auto;padding-right:2px;scrollbar-width:thin}
.wcb-card-grow .wcb-add-row{flex:none}
.wcb-card-grow .wcb-hint{flex:none}
.wcb-caret{color:var(--wcb-dim);font-size:9px;flex:none;transition:transform .15s}
.wcb-badge{color:var(--wcb-dim);font-size:9.5px;background:var(--wcb-surface2);border-radius:3px;padding:0 5px;flex:none;font-weight:400;text-transform:none;letter-spacing:0}
.wcb-head-actions{margin-left:auto;display:flex;gap:5px;align-items:center}
.wcb-linkbtn{font:inherit;font-size:10px;color:var(--wcb-accent);border:1px solid rgba(79,140,255,.25);
  border-radius:4px;padding:2px 7px;background:rgba(79,140,255,.06);cursor:pointer;white-space:nowrap;text-transform:none;letter-spacing:0;font-weight:400}
.wcb-linkbtn:hover{background:rgba(79,140,255,.12)}
.wcb-linkbtn:disabled{opacity:.4;cursor:default}
.wcb-hint{color:var(--wcb-muted);font-size:10px;line-height:1.5;flex:none}
.wcb-label{color:var(--wcb-muted);font-size:10px;margin-bottom:5px}

/* ---------- 工作空间列表 ---------- */
.wcb-ws-list{max-height:96px;overflow-y:auto;padding:2px 8px 6px;display:flex;flex-direction:column;gap:1px}
.wcb-ws-item{display:flex;align-items:center;gap:6px;border-radius:5px;padding:5px 8px;min-width:0;
  cursor:pointer;background:transparent;border:1px solid transparent;transition:background .1s}
.wcb-ws-item:hover{background:var(--wcb-surface)}
.wcb-ws-item.wcb-ws-active{background:rgba(79,140,255,.1);border-color:rgba(79,140,255,.2)}
.wcb-ws-dot{font-size:9px;flex:none;line-height:1;color:var(--wcb-dim)}
.wcb-ws-item.wcb-ws-active .wcb-ws-dot{color:var(--wcb-accent)}
.wcb-ws-name{flex:1 1 auto;min-width:7em;font-size:11.5px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--wcb-text2)}
.wcb-ws-item.wcb-ws-active .wcb-ws-name{color:var(--wcb-text);font-weight:500}
.wcb-pill{flex:none;font-size:8.5px;font-weight:500;border-radius:3px;padding:1px 5px;white-space:nowrap}
.wcb-pill-current{color:var(--wcb-ok);background:rgba(93,216,163,.12)}
.wcb-ws-time{flex:0 0 auto;color:var(--wcb-dim);font-size:9px;font-variant-numeric:tabular-nums;margin-left:auto;white-space:nowrap;max-width:5.5em;overflow:hidden;text-overflow:ellipsis}
.wcb-ws-tools{flex:none;display:flex;gap:3px;margin-left:4px;opacity:.35;transition:opacity .12s}
.wcb-ws-item:hover .wcb-ws-tools,.wcb-ws-item:focus-within .wcb-ws-tools{opacity:1}
.wcb-iconbtn{flex:none;border:none;background:transparent;color:var(--wcb-muted);border-radius:4px;cursor:pointer;
  font-size:11px;line-height:18px;padding:0 4px;font-family:inherit}
.wcb-iconbtn:hover{color:var(--wcb-text);background:var(--wcb-surface2)}
.wcb-iconbtn-danger:hover{color:var(--wcb-danger);background:rgba(248,81,73,.12)}
.wcb-search{width:72px;background:var(--wcb-surface);border:1px solid var(--wcb-line2);border-radius:4px;
  padding:2px 6px;color:var(--wcb-text2);font:inherit;font-size:10.5px;outline:none;text-transform:none;letter-spacing:0;font-weight:400}
.wcb-search:focus{border-color:var(--wcb-accent)}

/* ---------- 目录区 ---------- */
.wcb-add-row{display:flex;gap:6px;align-items:center;padding:5px 12px 7px;flex:none}
.wcb-dir-list{list-style:none;margin:0;padding:0 8px 4px;flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:1px}
.wcb-dir-wrap{position:relative}
.wcb-drop-line{height:2px;border-radius:2px;margin:0 2px 3px;background:linear-gradient(90deg,var(--wcb-accent),transparent)}
.wcb-dir-row{display:flex;align-items:flex-start;gap:6px;border-radius:5px;padding:5px 8px;
  background:transparent;border:1px solid transparent;transition:background .1s,border-color .1s,opacity .1s}
.wcb-dir-row:hover{background:var(--wcb-surface)}
.wcb-dir-row.wcb-dragging{opacity:.4}
.wcb-dir-row.wcb-dir-disabled{opacity:.55}
.wcb-dir-row.wcb-dir-missing{border-color:rgba(248,81,73,.4);background:rgba(248,81,73,.06)}
.wcb-dir-row.wcb-dir-missing .wcb-dir-name{color:var(--wcb-danger)}
.wcb-dir-row.wcb-dir-selected{border-color:rgba(79,140,255,.3);background:rgba(79,140,255,.07)}
.wcb-drag-handle{flex:none;color:var(--wcb-dim);cursor:grab;user-select:none;font-size:11px;line-height:1;margin-top:3px;opacity:0;transition:opacity .12s}
.wcb-dir-row:hover .wcb-drag-handle{opacity:1}
.wcb-checkbox{flex:none;margin:0;margin-top:4px;accent-color:var(--wcb-accent);cursor:pointer}
.wcb-star{flex:none;font-size:10px;line-height:1;color:var(--wcb-warn);background:none;border:none;padding:0;cursor:default;margin-top:3px}
.wcb-star-off{color:var(--wcb-dim);opacity:.4}
.wcb-type-sq{width:16px;height:16px;border-radius:4px;flex:none;display:flex;align-items:center;justify-content:center;
  color:#fff;font-size:8.5px;font-weight:700;margin-top:2px}
.wcb-type-sq-doc{background:#d4a017}
.wcb-type-sq-backend{background:#8b5cf6}
.wcb-type-sq-frontend{background:#3b82f6}
.wcb-type-sq-ref{background:#2aa8b4}
.wcb-type-sq-other{background:#666}
.wcb-dir-info{flex:1;min-width:0}
.wcb-dir-name-row{display:flex;align-items:center;gap:5px}
.wcb-dir-name{color:var(--wcb-text);font-size:11.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wcb-dir-path{color:var(--wcb-dim);font-size:9.5px;font-family:var(--ds-font-family-code,monospace);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
.wcb-dir-note{font-size:9.5px;color:var(--wcb-muted);margin-top:1px;font-style:italic;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:text;display:flex;align-items:center;gap:3px}
.wcb-dir-note-icon{font-style:normal;flex:none}
.wcb-dir-note-add{color:var(--wcb-dim);font-style:normal;opacity:0;transition:opacity .12s}
.wcb-dir-row:hover .wcb-dir-note-add{opacity:1}
.wcb-dir-note-input{width:100%;background:var(--wcb-surface);border:1px solid var(--wcb-accent);border-radius:4px;
  padding:2px 6px;color:var(--wcb-text);font:inherit;font-size:10px;font-style:normal;outline:none;margin-top:1px}
.wcb-warn-icon{flex:none;color:var(--wcb-danger);font-size:12px;cursor:help;margin-top:2px}
.wcb-cap{flex:none;font-size:8.5px;border-radius:3px;padding:1px 5px;white-space:nowrap;margin-top:3px}
.wcb-cap-doc{color:#d4a017;background:rgba(212,160,23,.1)}
.wcb-cap-backend{color:#8b5cf6;background:rgba(139,92,246,.1)}
.wcb-cap-frontend{color:#3b82f6;background:rgba(59,130,246,.1)}
.wcb-cap-ref{color:#2aa8b4;background:rgba(42,168,180,.1)}
.wcb-cap-other{color:#888;background:rgba(255,255,255,.05)}
.wcb-cap-rw{color:var(--wcb-ok);background:rgba(93,216,163,.1)}
.wcb-cap-ro{color:var(--wcb-purple);background:rgba(139,92,246,.1)}
.wcb-cap-off{color:var(--wcb-dim);background:rgba(255,255,255,.04)}
.wcb-remove{flex:none;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;border:none;
  background:transparent;color:var(--wcb-dim);border-radius:4px;cursor:pointer;font-size:12px;line-height:1;padding:0;margin-top:1px;opacity:0;transition:opacity .12s}
.wcb-dir-row:hover .wcb-remove{opacity:1}
.wcb-remove:hover{background:rgba(248,81,73,.12);color:var(--wcb-danger)}

/* ---------- Git 分支标签 ---------- */
.wcb-git{flex:none;font-size:8.5px;font-family:var(--ds-font-family-code,monospace);border-radius:3px;
  padding:0 4px;white-space:nowrap;display:inline-flex;align-items:center;gap:2px}
.wcb-git-dirty{color:var(--wcb-warn);background:rgba(212,160,23,.12)}
.wcb-git-clean{color:var(--wcb-muted);background:var(--wcb-surface2)}
/* 项目行类型标注：主项目「仅文档」vs 代码项目「代码」（全部走 token，明暗自适应） */
.wcb-kind{flex:none;font-size:8.5px;line-height:15px;border-radius:3px;padding:0 5px;white-space:nowrap;
  border:1px solid var(--wcb-line);cursor:help;user-select:none}
/* 主项目：略强一点，但仍不抢「读写」按钮的权重 */
.wcb-kind-doc{color:var(--wcb-muted);background:var(--wcb-surface2)}
/* 代码项目：更弱，仅作对照 */
.wcb-kind-code{color:var(--wcb-dim);background:transparent}

/* ---------- 表单控件 ---------- */
.wcb-input{flex:1;min-width:0;background:var(--wcb-surface);border:1px solid var(--wcb-line2);border-radius:4px;
  padding:3px 7px;color:var(--wcb-text2);font:inherit;font-size:11px;outline:none}
.wcb-input-mono{font-family:var(--ds-font-family-code,monospace)}
.wcb-input:focus{border-color:var(--wcb-accent)}
.wcb-btn{font:inherit;font-size:10.5px;cursor:pointer;border-radius:4px;padding:3px 8px;white-space:nowrap;
  border:1px solid var(--wcb-line2);background:var(--wcb-surface);color:var(--wcb-text2)}
.wcb-btn:hover{background:var(--wcb-surface2);border-color:rgba(79,140,255,.3)}
.wcb-btn:disabled{opacity:.4;cursor:default}
.wcb-btn-primary{font:inherit;font-size:11px;font-weight:500;cursor:pointer;border:none;border-radius:5px;padding:6px 14px;
  color:var(--wcb-on-accent,#fff);background:var(--wcb-accent,#4176e6)}
.wcb-btn-primary:hover{filter:brightness(1.1)}
.wcb-btn-primary:disabled{opacity:.4;cursor:default;filter:none}
.wcb-btn-plain{font:inherit;font-size:11px;cursor:pointer;border:none;background:transparent;color:var(--wcb-muted);
  border-radius:5px;padding:6px 12px}
.wcb-btn-plain:hover{color:var(--wcb-text)}
.wcb-btn-danger{font:inherit;font-size:11px;font-weight:500;cursor:pointer;border:none;border-radius:5px;padding:6px 14px;
  color:#fff;background:var(--wcb-danger)}

/* ---------- 选项卡 ---------- */
.wcb-tabs{display:flex;gap:4px}
.wcb-tab{flex:1;text-align:center;padding:4px 0;border-radius:5px;font-size:10.5px;cursor:pointer;font-family:inherit;
  background:var(--wcb-surface);border:1px solid var(--wcb-line2);color:var(--wcb-muted);transition:all .12s}
.wcb-tab:hover{border-color:rgba(79,140,255,.3)}
.wcb-tab-on{background:rgba(79,140,255,.1);border-color:rgba(79,140,255,.3);color:var(--wcb-accent);font-weight:600}
.wcb-tab:disabled{opacity:.45;cursor:default}

/* ---------- 快照 ---------- */
.wcb-snap-list{display:flex;flex-direction:column;gap:3px}
.wcb-snap-item{display:flex;align-items:center;gap:7px;border-radius:5px;background:var(--wcb-surface);
  border:1px solid var(--wcb-line);padding:5px 8px}
.wcb-snap-name{flex:1;min-width:0;color:var(--wcb-text2);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wcb-snap-meta{flex:none;color:var(--wcb-dim);font-size:9.5px}
.wcb-snap-restore{flex:none;color:var(--wcb-accent);font-size:10px;cursor:pointer;background:none;border:none;font-family:inherit;padding:0 2px}

/* ---------- 分隔线 ---------- */
.wcb-sep-line{height:1px;background:var(--wcb-line);margin:2px 0}

/* ---------- @指令速查卡 ---------- */
.wcb-cmdref{display:flex;flex-direction:column;gap:2px}
.wcb-cmdref-item{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:5px;
  background:var(--wcb-surface);cursor:pointer;transition:background .12s;border:none;width:100%;text-align:left;font:inherit}
.wcb-cmdref-item:hover{background:var(--wcb-surface2)}
.wcb-cmdref-code{font-size:10px;color:var(--wcb-purple);font-family:var(--ds-font-family-code,monospace);flex:none}
.wcb-cmdref-desc{font-size:10px;color:var(--wcb-muted);flex:1;min-width:0}
.wcb-cmdref-copy{margin-left:auto;font-size:9px;color:var(--wcb-dim);flex:none}

/* ---------- 上下文预算 ---------- */
.wcb-monitor-top{display:flex;align-items:center;justify-content:space-between;color:var(--wcb-muted);font-size:10px;margin-bottom:3px;gap:8px}
.wcb-monitor-num{color:var(--wcb-text);font-variant-numeric:tabular-nums;font-weight:500}
.wcb-bar{height:5px;border-radius:3px;background:rgba(255,255,255,.06);overflow:hidden}
.wcb-bar-fill{height:100%;border-radius:3px;background:var(--wcb-accent);transition:width .2s}
.wcb-bar-warn{background:var(--wcb-warn)}
.wcb-bar-over{background:var(--wcb-danger)}
.wcb-dirbars{display:flex;flex-direction:column;gap:4px;padding-top:1px}
.wcb-dirbar{display:flex;align-items:center;gap:7px}
.wcb-dirbar-name{width:52px;flex:none;color:var(--wcb-muted);font-size:9.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wcb-dirbar-track{flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,.05);overflow:hidden}
.wcb-dirbar-fill{height:100%;border-radius:2px}
.wcb-dirbar-num{width:30px;flex:none;text-align:right;color:var(--wcb-muted);font-size:9.5px;font-variant-numeric:tabular-nums}
.wcb-budget-input{width:56px;flex:none;background:var(--wcb-surface);border:1px solid var(--wcb-line2);border-radius:4px;
  padding:2px 5px;color:var(--wcb-text2);font:inherit;font-size:10.5px;outline:none;font-variant-numeric:tabular-nums;text-transform:none;letter-spacing:0;font-weight:400}
.wcb-budget-input:focus{border-color:var(--wcb-accent)}
.wcb-alert{border-radius:6px;padding:6px 8px;font-size:10px;line-height:1.5;
  border:1px solid rgba(212,160,23,.3);background:rgba(212,160,23,.08);color:var(--wcb-text2)}
.wcb-alert-over{border-color:rgba(248,81,73,.35);background:rgba(248,81,73,.08)}
.wcb-monitor-lines{display:flex;flex-direction:column;gap:3px;padding-top:6px;border-top:1px solid var(--wcb-line)}
.wcb-monitor-line{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:10px}
.wcb-monitor-label{color:var(--wcb-muted)}
.wcb-monitor-value{font-variant-numeric:tabular-nums;text-align:right;color:var(--wcb-text2)}
.wcb-monitor-total .wcb-monitor-value{font-weight:600;color:var(--wcb-text)}

/* ---------- prompt 预览 ---------- */
.wcb-preview{max-height:220px;overflow:auto;border-radius:6px;padding:8px 9px;
  background:var(--wcb-surface);border:1px solid var(--wcb-line);color:var(--wcb-text2);
  font-size:10px;line-height:1.6;font-family:var(--ds-font-family-code,monospace);
  white-space:pre-wrap;word-break:break-word;margin:0}

/* ---------- 批量操作条 ---------- */
.wcb-bulk{flex:none;margin-top:6px;display:flex;flex-direction:column;gap:6px;border-radius:6px;padding:8px 10px;
  background:rgba(79,140,255,.08);border:1px solid rgba(79,140,255,.25)}
.wcb-bulk-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.wcb-bulk-count{flex:1;min-width:0;font-size:10.5px;font-weight:600;color:var(--wcb-text)}

/* ---------- 底部图例 + 沙盒 ---------- */
.wcb-legend-row{display:flex;align-items:center;justify-content:space-between;flex:none;padding:8px 12px 10px}
.wcb-legend{display:flex;gap:10px}
.wcb-legend-item{display:flex;align-items:center;gap:4px;color:var(--wcb-dim);font-size:9.5px}
.wcb-legend-dot{width:5px;height:5px;border-radius:50%;flex:none}
.wcb-sandbox{font-size:9.5px;color:var(--wcb-ok);display:flex;align-items:center;gap:4px}
.wcb-sandbox-dot{width:5px;height:5px;border-radius:50%;background:var(--wcb-ok);box-shadow:0 0 4px rgba(93,216,163,.5)}

/* ---------- 空状态 ---------- */
.wcb-empty{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;padding:24px 16px}
.wcb-empty-icon{width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;
  position:relative;color:var(--wcb-accent);background:rgba(79,140,255,.1);border:1px solid rgba(79,140,255,.2)}
.wcb-empty-icon::before,.wcb-empty-icon::after{content:"";position:absolute;width:12px;height:12px;
  border:2px solid currentColor;border-radius:3px;box-sizing:border-box}
.wcb-empty-icon::before{left:8px;top:14px}
.wcb-empty-icon::after{left:14px;top:8px}
.wcb-empty-icon>i{position:absolute;left:13px;top:13px;width:7px;height:2px;
  background:currentColor;transform:rotate(45deg);transform-origin:left center}
.wcb-empty-title{color:var(--wcb-text);font-size:12.5px;font-weight:600}
.wcb-empty-text{color:var(--wcb-muted);font-size:10.5px;line-height:1.6}

/* ---------- toast ---------- */
.wcb-toast-stack{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:5px;z-index:200}
.wcb-toast{border-radius:6px;padding:7px 12px;font-size:11px;line-height:1.45;cursor:pointer;
  box-shadow:0 4px 16px rgba(0,0,0,.3);color:#fff;animation:wcb-toast-in .18s ease-out;white-space:nowrap}
.wcb-toast-ok{background:rgba(50,120,60,.92)}
.wcb-toast-error{background:rgba(180,50,50,.92)}
@keyframes wcb-toast-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

/* ---------- 弹窗 ---------- */
.wcb-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(2px);
  display:flex;align-items:center;justify-content:center;z-index:150;padding:16px}
.wcb-modal{width:360px;max-width:100%;max-height:80vh;display:flex;flex-direction:column;gap:10px;padding:16px;
  border-radius:10px;color:var(--wcb-text);
  background:var(--dsw-alias-bg-layer-3,#1e2430);
  border:1px solid var(--wcb-line2);box-shadow:0 16px 48px rgba(0,0,0,.5)}
.wcb-modal-wide{width:480px}
.wcb-modal-title{font-size:13px;font-weight:600}
.wcb-modal-body{font-size:11.5px;line-height:1.6;color:var(--wcb-text2)}
.wcb-modal-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:2px}
.wcb-field{display:flex;flex-direction:column;gap:4px}
.wcb-field>span{color:var(--wcb-muted);font-size:10.5px}
.wcb-field .wcb-input{width:100%;flex:none;padding:6px 9px;font-size:11px}
.wcb-field .wcb-input.wcb-input-mono{font-size:11px}

/* ---------- 向导步骤条 ---------- */
.wcb-steps{display:flex;gap:4px}
.wcb-step{flex:1;display:flex;align-items:center;gap:5px;font-size:10px;color:var(--wcb-dim);
  padding:4px 6px;border-radius:5px;background:var(--wcb-surface)}
.wcb-step-num{width:15px;height:15px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;
  font-size:9px;background:var(--wcb-surface2);color:var(--wcb-muted)}
.wcb-step-active{color:var(--wcb-accent);font-weight:600;background:rgba(79,140,255,.1)}
.wcb-step-active .wcb-step-num{background:var(--wcb-accent,#4176e6);color:var(--wcb-on-accent,#fff)}
.wcb-step-done .wcb-step-num{background:var(--wcb-ok);color:#fff}
.wcb-step-done{color:var(--wcb-muted)}
.wcb-wizard-body{display:flex;flex-direction:column;gap:8px;min-height:100px}
.wcb-scan-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px;overflow-y:auto;max-height:36vh}
.wcb-scan-item{display:flex;align-items:center;gap:8px;border:1px solid var(--wcb-line);border-radius:6px;padding:7px 9px;background:var(--wcb-surface)}
.wcb-scan-item input{flex:none;margin:0;accent-color:var(--wcb-accent)}
.wcb-scan-info{flex:1;min-width:0}
.wcb-scan-name{font-weight:500;font-size:11px;color:var(--wcb-text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wcb-scan-path{color:var(--wcb-dim);font-size:9.5px;font-family:var(--ds-font-family-code,monospace);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wcb-pathbox{flex:1;min-width:0;color:var(--wcb-dim);font-size:10px;font-family:var(--ds-font-family-code,monospace);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wcb-toolbar{display:flex;justify-content:flex-end}

/* ---------- 项目类型徽标 ---------- */
.wcb-type{flex:none;display:inline-flex;align-items:center;border-radius:999px;padding:1px 7px;font-size:9.5px;
  line-height:15px;font-weight:500;white-space:nowrap;cursor:default}
.wcb-type-java{background:rgba(240,137,42,.15);color:#f0892a}
.wcb-type-frontend{background:rgba(59,130,246,.15);color:#3b82f6}
.wcb-type-python{background:rgba(43,164,113,.15);color:#3fb950}
.wcb-type-go{background:rgba(20,184,200,.15);color:#2aa8b4}
.wcb-type-generic{background:rgba(136,136,136,.15);color:#888}
.wcb-type-none{background:transparent;color:#888;border:1px solid rgba(136,136,136,.35)}

/* ---------- 命令面板 ---------- */
.wcb-cmdk-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(2px);
  display:flex;align-items:flex-start;justify-content:center;padding:12vh 16px 16px;z-index:160}
.wcb-cmdk{width:400px;max-width:100%;max-height:60vh;display:flex;flex-direction:column;border-radius:10px;overflow:hidden;
  background:var(--dsw-alias-bg-layer-3,#1e2430);border:1px solid var(--wcb-line2);
  box-shadow:0 16px 48px rgba(0,0,0,.5);color:var(--wcb-text)}
.wcb-cmdk-input{width:100%;border:none;border-bottom:1px solid var(--wcb-line);background:transparent;outline:none;
  padding:11px 13px;color:var(--wcb-text);font:inherit;font-size:12px}
.wcb-cmdk-list{list-style:none;margin:0;padding:5px;overflow-y:auto;display:flex;flex-direction:column;gap:1px}
.wcb-cmdk-item{display:flex;align-items:center;gap:8px;border-radius:5px;padding:6px 8px;font-size:11px;cursor:pointer;color:var(--wcb-text2)}
.wcb-cmdk-item.wcb-cmdk-on{background:rgba(79,140,255,.12);color:var(--wcb-text)}
.wcb-cmdk-kind{margin-left:auto;color:var(--wcb-dim);font-size:9.5px}
.wcb-cmdk-empty{padding:14px;text-align:center;color:var(--wcb-muted);font-size:11px}

/* ---------- 宽屏左右分栏布局 ---------- */
.wcb-top{flex:none}
.wcb-main-split{flex:1;min-height:0;display:flex;flex-direction:column;gap:0}
.wcb-left-col{display:flex;flex-direction:column;min-height:0;overflow:hidden}
.wcb-left-col>.wcb-card:first-child{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.wcb-left-col>.wcb-card:first-child .wcb-card-body{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column}
.wcb-left-col>.wcb-card:first-child .wcb-ws-list{flex:1;min-height:0;max-height:none;overflow-y:auto}
.wcb-left-col>.wcb-card{flex:none}
/* 右栏：项目目录 / 上下文预算 按比例分割高度（可拖拽分隔条调整） */
.wcb-right-col{display:flex;flex-direction:column;min-height:0;overflow:hidden;flex:1}
/* 两个区块的高度由内联 style 的 flex-basis 决定（6:4，可拖拽）；此处只保证可收缩 */
.wcb-right-col>.wcb-card{min-height:0}
.wcb-splitter{flex:none;height:9px;display:flex;align-items:center;justify-content:center;cursor:row-resize;
  background:transparent;user-select:none;touch-action:none}
.wcb-splitter-grip{width:36px;height:3px;border-radius:2px;background:var(--wcb-line);transition:background .12s,width .12s}
.wcb-splitter:hover .wcb-splitter-grip{background:var(--wcb-accent);width:52px}
.wcb-splitter:focus-visible .wcb-splitter-grip{background:var(--wcb-accent);width:52px}
.wcb-splitter:focus-visible{outline:2px solid var(--wcb-accent);outline-offset:-2px}
@media(min-width:600px){
  .wcb-main-split{flex-direction:row}
  .wcb-left-col{width:280px;flex:none;border-right:1px solid var(--wcb-line)}
  .wcb-left-col .wcb-card:last-child{border-bottom:none}
  .wcb-right-col .wcb-card:last-child{border-bottom:none}
}

/* ---------- 上下文预算左右布局 ---------- */
/* 预算卡在固定高度内可滚动（显式类名，不再依赖 :last-child——后面还有功能索引卡） */
.wcb-budget-card{display:flex;flex-direction:column;overflow:hidden}
.wcb-codeindex-card{display:flex;flex-direction:column;overflow:hidden;flex:0 0 auto;max-height:220px}
.wcb-codeindex-card .wcb-card-body{flex:1;min-height:0;overflow-y:auto;scrollbar-width:thin}
.wcb-budget-card .wcb-budget-split{flex:1;min-height:0;overflow-y:auto}
.wcb-budget-split{display:flex;flex-direction:column;gap:8px;padding:6px 12px}
.wcb-budget-left{display:flex;flex-direction:column;gap:8px}
.wcb-budget-right{display:flex;flex-direction:column;gap:5px;min-width:0;min-height:0}
@media(min-width:600px){
  .wcb-budget-split{flex-direction:row;gap:14px}
  .wcb-budget-left{width:200px;flex:none}
  .wcb-budget-right{flex:1}
}
.wcb-budget-overview{display:flex;align-items:center;gap:9px;flex-wrap:nowrap;min-width:0}
.wcb-budget-figures{display:flex;align-items:baseline;gap:6px;min-width:0;flex-wrap:wrap;line-height:1.2}
.wcb-budget-total{font-size:15px;font-weight:700;color:var(--wcb-text);font-variant-numeric:tabular-nums;line-height:1.1;white-space:nowrap}
.wcb-budget-of{font-size:10px;color:var(--wcb-dim);white-space:nowrap}
.wcb-budget-remain{font-size:9.5px;color:var(--wcb-ok);white-space:nowrap}
.wcb-donut{position:relative;flex:none}
.wcb-donut-center{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--wcb-text)}
.wcb-stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}
/* 每张统计卡「标题 + 数值」同一行，显著缩短卡片高度 */
.wcb-stat-card{background:var(--wcb-surface);border:1px solid var(--wcb-line2);border-radius:5px;padding:3px 7px;display:flex;align-items:baseline;gap:5px;min-width:0}
.wcb-stat-label{color:var(--wcb-dim);font-size:8px;text-transform:uppercase;letter-spacing:.2px;flex:none;white-space:nowrap}
.wcb-stat-value{color:var(--wcb-text);font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;margin-left:auto}
.wcb-stat-value-sm{color:var(--wcb-text2);font-size:11px;font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap;margin-left:auto}
.wcb-dir-usage-title{font-size:9px;color:var(--wcb-dim);text-transform:uppercase;letter-spacing:.3px;margin-bottom:1px}
/* 分目录用量：横向条形列表（可滚动、逐条可删除） */
.wcb-bars{display:flex;flex-direction:column;gap:3px;overflow-y:auto;min-height:0;flex:1 1 auto;padding-right:2px;scrollbar-width:thin}
.wcb-bar-row{display:flex;align-items:center;gap:6px;min-width:0}
.wcb-bar-name{flex:none;width:62px;font-size:9.5px;color:var(--wcb-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wcb-bar-track-h{flex:1 1 auto;height:8px;min-width:18px;background:var(--wcb-surface);border:1px solid var(--wcb-line);border-radius:4px;overflow:hidden}
.wcb-bar-fill-h{height:100%;border-radius:3px;transition:width .2s}
.wcb-bar-val{flex:none;width:42px;text-align:right;font-size:9px;color:var(--wcb-text2);font-variant-numeric:tabular-nums;white-space:nowrap}
.wcb-dir-usage-item{display:flex;align-items:center;gap:8px;background:var(--wcb-surface);border:1px solid var(--wcb-line);border-radius:5px;padding:5px 8px}
.wcb-dir-usage-info{flex:1;min-width:0}
.wcb-dir-usage-name-row{display:flex;align-items:center;justify-content:space-between;gap:5px}
.wcb-dir-usage-name{font-size:11px;color:var(--wcb-text);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wcb-dir-usage-tokens{font-size:10px;color:var(--wcb-text2);font-variant-numeric:tabular-nums;font-weight:600;flex:none}

/* ---------- 无障碍 ---------- */
.wcb-root :focus-visible{outline:2px solid var(--wcb-accent);outline-offset:1px}
.wcb-root button{font-family:inherit}
`

/** 注入面板样式（每次移除旧标签再插入新标签，确保开发时新样式生效）。 */
export function injectPanelStyles(): void {
  if (typeof document === 'undefined') return
  const id = 'dsh-workspace-combiner/client.css'
  document.querySelectorAll(`style[data-plugin-css="${id}"]`).forEach(el => el.remove())
  const tag = document.createElement('style')
  tag.setAttribute('data-plugin-css', id)
  tag.textContent = PANEL_CSS
  document.head.appendChild(tag)
}
