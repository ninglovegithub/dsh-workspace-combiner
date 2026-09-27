window.__ModuleLoader__.load({
	id: "dsh-workspace-combiner",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/locales.ts
		/**
		* 面板文案词典（zh / en）。面板通过插槽渲染、拿不到 locale 服务的 t 函数，
		* 因此用 document.documentElement.lang 在调用时选择词典。
		* @module dsh-workspace-combiner/client/locales
		*/
		const zh = {
			"title": "工作区组合器",
			"subtitle": "把多个项目目录组合成一个会话",
			"warning": "项目只对「新建会话」生效，已打开的会话不会自动刷新",
			"workspaces": "工作空间",
			"newWorkspace": "新建工作空间",
			"wsCurrent": "当前",
			"wsDirCount": "{n} 个项目",
			"wsNeverUsed": "未使用",
			"wsLastUsedJustNow": "刚刚",
			"wsLastUsedMin": "{n} 分钟前",
			"wsLastUsedHour": "{n} 小时前",
			"wsLastUsedDay": "{n} 天前",
			"wsRename": "重命名",
			"wsDelete": "删除",
			"wsRenameTitle": "重命名工作空间",
			"wsDeleteTitle": "删除工作空间",
			"wsCreateName": "工作空间名称",
			"wsDeleteConfirm": "确定删除工作空间「{name}」？其目录配置将被移除（不影响磁盘文件）。",
			"wsCreatedNamed": "已创建工作空间「{name}」",
			"wsDeleted": "工作空间已删除",
			"directories": "项目",
			"pickDirectory": "添加项目",
			"addDirectory": "添加",
			"manualPathPlaceholder": "或粘贴绝对路径后回车",
			"dirsEmpty": "还没添加项目，点上方「添加项目」或粘贴路径添加",
			"removeDirectory": "移除",
			"dirCount": "共 {n} 个项目",
			"primaryProject": "主项目",
			"codeProject": "代码项目",
			"createSession": "新建会话",
			"sessionCreatedNamed": "已创建会话「{name}」",
			"createFailed": "新建会话失败：{error}",
			"primaryHint": "第一个是「主项目」：会话锚点，用于保存文档等非代码文件；其余是「代码项目」，可进行代码开发",
			"badgeDocOnly": "📄 仅文档",
			"badgeCode": "💻 代码",
			"badgeDocOnlyTip": "本项目是「主项目 / 会话锚点」\n· 仅存放 Markdown、笔记、需求文档等非代码文件\n· 不存放源码，不进行代码开发\n· 代码请添加到下方「代码项目」",
			"badgeCodeTip": "代码项目：可进行代码开发（读写 / 只读 / 禁用由右侧控件设置）",
			"cancel": "取消",
			"confirm": "确定",
			"loadFailed": "加载失败：{error}",
			"saveFailed": "保存失败：{error}",
			"nameRequired": "请先输入工作空间名称",
			"pathRequired": "目录路径不能为空",
			"alreadyAdded": "该项目已在列表中",
			"pickFailed": "选择文件夹失败：{error}",
			"noPrimary": "当前工作空间还没有主项目，请先添加一个项目",
			"accessReadwrite": "读写",
			"accessReadonly": "只读",
			"accessDisabled": "禁用",
			"accessHint": "读写=可读可写；只读=仅可读；禁用=不加载此目录",
			"primaryAccessFixed": "主项目固定读写",
			"wsModeLabel": "工作空间模式",
			"wsModeAnchor": "文档锚点模式",
			"wsModeSingle": "传统单项目模式",
			"wsModeAnchorHint": "主目录=文档锚点（PRD/架构/markdown），其余目录=代码项目",
			"wsModeSingleHint": "主目录=核心业务代码（读写），追加目录=参考依赖（可只读/禁用）",
			"wsSaved": "已保存",
			"loadModeLabel": "文件加载",
			"loadModeSummary": "摘要",
			"loadModeTree": "目录树",
			"loadModeFull": "完整",
			"monitorTitle": "上下文监控",
			"monitorRefresh": "刷新",
			"monitorLoading": "统计中…",
			"monitorSummary": "{dirs} 目录 · {files} 文件 · {subdirs} 子目录",
			"monitorFileIndex": "文件索引",
			"monitorOverhead": "目录清单+规则",
			"monitorTotal": "总计",
			"monitorTokens": "tokens",
			"groupNone": "无分组",
			"groupDoc": "文档",
			"groupBackend": "后端",
			"groupFrontend": "前端",
			"groupRef": "参考",
			"groupOther": "其他",
			"groupHint": "目录分组标签（prompt 内按组渲染）",
			"snapshotNamePlaceholder": "快照名称（如：前端only）",
			"snapshotSave": "保存快照",
			"snapshotRestore": "恢复",
			"snapshotDelete": "删除快照",
			"snapshotSaved": "快照已保存",
			"snapshotRestored": "快照已恢复",
			"snapshotDeleted": "快照已删除",
			"snapshotDirCount": "{n} 个目录",
			"typeJava": "Java 后端",
			"typeFrontend": "前端",
			"typeFrontendVue": "前端(Vue)",
			"typeFrontendReact": "前端(React)",
			"typeFrontendWebpack": "前端(Webpack)",
			"typeFrontendNext": "前端(Next.js)",
			"typePython": "Python",
			"typeGo": "Go",
			"typeGeneric": "代码项目",
			"typeNone": "目录",
			"evidenceHint": "识别依据：{evidence}",
			"wizardTitle": "新建工作空间",
			"wizardStep1": "1. 名称与保存位置",
			"wizardStep2": "2. 添加项目",
			"wizardStep3": "3. 完成",
			"wizardNext": "下一步",
			"wizardBack": "上一步",
			"wizardCreate": "创建",
			"wizardPickFolder": "选择文件夹",
			"wizardNamePlaceholder": "未命名工作空间",
			"wizardBaseDir": "主目录保存位置",
			"wizardBaseEmpty": "尚未选择保存位置",
			"wizardBaseHint": "将在此位置下创建与名称同名的文件夹，作为主目录（文档等非代码文件保存区）",
			"wizardScanFolderEmpty": "尚未选择文件夹",
			"wizardScanning": "正在扫描识别…",
			"wizardNoProject": "未检测到代码项目，可直接进入下一步",
			"wizardSelectAll": "全选",
			"wizardClearSelect": "清除选择",
			"wizardSummary": "将在 {base} 下创建「{name}」文件夹作为主目录，并添加 {n} 个代码项目",
			"brandSubtitle": "多项目 → 一个会话",
			"searchPlaceholder": "搜索…",
			"newShort": "+ 新建",
			"projectsTitle": "项目目录",
			"advancedTitle": "高级配置",
			"advancedSummary": "模式：{mode} · 加载：{load} · {n} 快照",
			"budgetTitle": "上下文预算",
			"standardsTitle": "开发规范",
			"standardsNone": "未启用",
			"standardsGroups": "已启用 {n} 组",
			"standardsTarget": "应用到",
			"standardsTargetGlobal": "通用（整个工作空间）",
			"standardsAutoMatch": "按技术栈自动匹配",
			"standardsAutoMatched": "已按项目类型自动匹配：{name}",
			"standardsBuiltin": "内置规范",
			"standardsScopeGlobal": "全局（所有工作空间）",
			"standardsScopeWorkspace": "仅此工作空间",
			"standardsNamePlaceholder": "规范名称",
			"standardsNewCustom": "新建规范",
			"standardsDeleteCustom": "删除",
			"standardsResetDefault": "恢复默认",
			"standardsCopy": "复制",
			"standardsAiGenerate": "用 AI 生成",
			"standardsAiLoading": "生成中…",
			"standardsAiFailed": "AI 生成失败，请检查模型配置后重试",
			"standardsAiHint": "补充要求（可选）",
			"standardsScopeLabel": "作用域",
			"standardsScopeGlobalShort": "全局",
			"standardsScopeWorkspaceShort": "仅本空间",
			"standardsScopeHint": "「全局」对所有工作空间生效；「仅本空间」只覆盖当前工作空间",
			"standardsOverridden": "已改",
			"standardsBodyPlaceholder": "在这里写规范要点（每行一条 markdown 列表）",
			"standardsBudget": "规范预算",
			"standardsTotal": "合计 {n} token",
			"standardsSave": "保存",
			"codeIndexTitle": "功能/接口索引",
			"codeIndexToggle": "注入",
			"codeIndexBudget": "预算",
			"codeIndexSummaryLabel": "摘要",
			"codeIndexSummaryOff": "关闭",
			"codeIndexSummaryLlm": "AI 生成",
			"codeIndexEmpty": "未识别到端点（或已在面板关闭）",
			"codeIndexCopy": "点击复制 @功能名",
			"codeIndexSearch": "筛选功能/端点/路径",
			"codeIndexServer": "服务端",
			"codeIndexClient": "前端",
			"codeIndexHint": "自动抽取「端点 ↔ 前后端落点」；点条目复制 @功能名，会话中用它直接定位",
			"codeIndexSummaryHint": "AI 摘要在新会话创建时生成并缓存",
			"budgetCurrent": "当前注入",
			"budgetOf": "{cur} / {max} tokens",
			"budgetLimit": "目标上限",
			"budgetOver": "当前注入已超出预算，建议将目录设为只读/禁用或降低加载模式",
			"budgetWarn": "已接近预算上限，建议调低加载模式",
			"budgetRemain": "剩余 {remain}",
			"statFiles": "文件",
			"statDirs": "目录",
			"statIndex": "索引",
			"statOverhead": "开销",
			"dirUsageTitle": "分目录用量",
			"legendReadwrite": "读写",
			"legendReadonly": "只读",
			"legendDisabled": "禁用",
			"emptyTitle": "还没有工作空间",
			"emptyText": "创建一个工作空间，把多个项目目录组合起来，新建会话时统一注入上下文",
			"emptyCreate": "+ 新建工作空间",
			"dirsEmptyTitle": "还没有项目目录",
			"emptyAddDir": "添加项目",
			"dirMissing": "该目录不存在，可能已被删除或移动",
			"previewTitle": "预览注入 prompt",
			"previewShow": "预览注入 prompt",
			"previewHide": "收起预览",
			"previewCopy": "复制",
			"previewCopied": "已复制到剪贴板",
			"moreTitle": "更多",
			"moreBudgetHint": "上下文预算",
			"statStandards": "规范",
			"previewOpenHint": "点击查看",
			"previewEmpty": "当前配置不会注入任何内容（没有启用的目录）",
			"previewLoading": "正在读取文件索引…",
			"previewSimplified": "（未加载文件索引，仅预览目录清单与规则）",
			"bulkSelected": "已选 {n} 项",
			"bulkAccess": "批量访问",
			"bulkGroup": "批量分组",
			"bulkDelete": "批量删除",
			"bulkClear": "取消选择",
			"bulkApplied": "已批量更新 {n} 个目录",
			"selectDir": "选择此目录",
			"cmdkTitle": "命令面板",
			"cmdkPlaceholder": "输入命令…",
			"cmdkEmpty": "没有匹配的命令",
			"cmdkNewSession": "新建会话",
			"cmdkNewWorkspace": "新建工作空间",
			"cmdkRefresh": "刷新上下文预算",
			"cmdkAddDir": "添加项目目录",
			"cmdkToggleAdvanced": "切换高级配置",
			"cmdkTogglePreview": "切换 prompt 预览",
			"cmdkSwitchWs": "切换到：{name}",
			"cmdkLoadMode": "加载模式：{name}",
			"cmdkKindAction": "动作",
			"cmdkKindWorkspace": "工作空间",
			"cmdkKindLoadMode": "加载模式",
			"sessionsUsing": "{n} 个会话正在使用",
			"sessionsNone": "暂无会话使用",
			"gitDirty": "分支 {branch}，{dirty} 个修改，{untracked} 个未跟踪",
			"gitClean": "分支 {branch}，工作区干净",
			"addNote": "+ 添加备注",
			"notePlaceholder": "输入备注...",
			"sandboxSynced": "沙盒 {cur}/{total}",
			"sandboxTitle": "沙盒白名单已同步 {cur} 个目录（禁用目录不加入）",
			"cmdRefTitle": "@ 指令速查",
			"cmdRefHint": "（点击复制）",
			"cmdRefWorkspace": "切换到指定工作空间",
			"cmdRefDir": "限定上下文到某目录",
			"cmdRefFiles": "列出当前工作空间文件索引",
			"cmdRefSnapshot": "恢复某目录配置快照",
			"copied": "已复制到剪贴板",
			"copyFailed": "复制失败，请手动选择复制",
			"splitterLabel": "调整项目目录与上下文预算的高度比例",
			"splitterHint": "拖动调整高度比例（双击恢复 6:4）"
		};
		const en = {
			"title": "Workspace Combiner",
			"subtitle": "Combine multiple project directories into one session",
			"warning": "Projects only apply to NEW sessions; already-open sessions are not refreshed",
			"workspaces": "Workspaces",
			"newWorkspace": "New workspace",
			"wsCurrent": "Current",
			"wsDirCount": "{n} projects",
			"wsNeverUsed": "never used",
			"wsLastUsedJustNow": "just now",
			"wsLastUsedMin": "{n}m ago",
			"wsLastUsedHour": "{n}h ago",
			"wsLastUsedDay": "{n}d ago",
			"wsRename": "Rename",
			"wsDelete": "Delete",
			"wsRenameTitle": "Rename workspace",
			"wsDeleteTitle": "Delete workspace",
			"wsCreateName": "Workspace name",
			"wsDeleteConfirm": "Delete workspace \"{name}\"? Its directory config will be removed (files on disk are untouched).",
			"wsCreatedNamed": "Workspace \"{name}\" created",
			"wsDeleted": "Workspace deleted",
			"directories": "Projects",
			"pickDirectory": "Add project",
			"addDirectory": "Add",
			"manualPathPlaceholder": "or paste an absolute path, then Enter",
			"dirsEmpty": "No projects yet — use \"Add project\" or paste a path above",
			"removeDirectory": "Remove",
			"dirCount": "{n} projects",
			"primaryProject": "Primary",
			"codeProject": "Code project",
			"createSession": "New session",
			"sessionCreatedNamed": "Created session \"{name}\"",
			"createFailed": "Create session failed: {error}",
			"primaryHint": "The first is the \"primary\" project: the session anchor, for docs and other non-code files; the rest are \"code projects\" for code development",
			"badgeDocOnly": "📄 Docs only",
			"badgeCode": "💻 Code",
			"badgeDocOnlyTip": "This is the \"primary\" project / session anchor\n· Holds only Markdown, notes and requirement docs\n· No source code, no code development here\n· Add source repositories under \"Code projects\"",
			"badgeCodeTip": "Code project: source development (read-write / read-only / disabled via the controls on the right)",
			"cancel": "Cancel",
			"confirm": "Confirm",
			"loadFailed": "Load failed: {error}",
			"saveFailed": "Save failed: {error}",
			"nameRequired": "Type a workspace name first",
			"pathRequired": "Directory path is required",
			"alreadyAdded": "Already in the list",
			"pickFailed": "Choose folder failed: {error}",
			"noPrimary": "This workspace has no primary project — add one first",
			"accessReadwrite": "Read-write",
			"accessReadonly": "Read-only",
			"accessDisabled": "Disabled",
			"accessHint": "Read-write / Read-only / Excluded from context",
			"primaryAccessFixed": "Primary is always read-write",
			"wsModeLabel": "Workspace mode",
			"wsModeAnchor": "Document anchor mode",
			"wsModeSingle": "Single-project mode",
			"wsModeAnchorHint": "Primary = document anchor (PRD/architecture/markdown); others = code projects",
			"wsModeSingleHint": "Primary = core business code (read-write); extras = reference deps (read-only/disabled)",
			"wsSaved": "Saved",
			"loadModeLabel": "File load",
			"loadModeSummary": "Summary",
			"loadModeTree": "Tree",
			"loadModeFull": "Full",
			"monitorTitle": "Context monitor",
			"monitorRefresh": "Refresh",
			"monitorLoading": "Computing…",
			"monitorSummary": "{dirs} dirs · {files} files · {subdirs} subdirs",
			"monitorFileIndex": "File index",
			"monitorOverhead": "Dir list + rules",
			"monitorTotal": "Total",
			"monitorTokens": "tokens",
			"groupNone": "No group",
			"groupDoc": "Docs",
			"groupBackend": "Backend",
			"groupFrontend": "Frontend",
			"groupRef": "Reference",
			"groupOther": "Other",
			"groupHint": "Directory group label (rendered by group in prompt)",
			"snapshotNamePlaceholder": "Snapshot name (e.g. frontend-only)",
			"snapshotSave": "Save snapshot",
			"snapshotRestore": "Restore",
			"snapshotDelete": "Delete",
			"snapshotSaved": "Snapshot saved",
			"snapshotRestored": "Snapshot restored",
			"snapshotDeleted": "Snapshot deleted",
			"snapshotDirCount": "{n} dirs",
			"typeJava": "Java backend",
			"typeFrontend": "Frontend",
			"typeFrontendVue": "Frontend (Vue)",
			"typeFrontendReact": "Frontend (React)",
			"typeFrontendWebpack": "Frontend (Webpack)",
			"typeFrontendNext": "Frontend (Next.js)",
			"typePython": "Python",
			"typeGo": "Go",
			"typeGeneric": "Code project",
			"typeNone": "Directory",
			"evidenceHint": "Detected by: {evidence}",
			"wizardTitle": "New workspace",
			"wizardStep1": "1. Name & location",
			"wizardStep2": "2. Add projects",
			"wizardStep3": "3. Finish",
			"wizardNext": "Next",
			"wizardBack": "Back",
			"wizardCreate": "Create",
			"wizardPickFolder": "Choose folder",
			"wizardNamePlaceholder": "Untitled workspace",
			"wizardBaseDir": "Primary directory location",
			"wizardBaseEmpty": "No location chosen",
			"wizardBaseHint": "A folder named after the workspace will be created here as the primary directory (for docs and other non-code files)",
			"wizardScanFolderEmpty": "No folder chosen",
			"wizardScanning": "Scanning…",
			"wizardNoProject": "No code project detected — continue to next step",
			"wizardSelectAll": "Select all",
			"wizardClearSelect": "Clear selection",
			"wizardSummary": "Will create folder \"{name}\" under {base} as the primary directory, plus {n} code project(s)",
			"brandSubtitle": "Many projects → one session",
			"searchPlaceholder": "Search…",
			"newShort": "+ New",
			"projectsTitle": "Project directories",
			"advancedTitle": "Advanced",
			"advancedSummary": "Mode: {mode} · Load: {load} · {n} snapshots",
			"budgetTitle": "Context budget",
			"standardsTitle": "Coding standards",
			"standardsNone": "None enabled",
			"standardsGroups": "{n} group(s) active",
			"standardsTarget": "Applies to",
			"standardsTargetGlobal": "Global (whole workspace)",
			"standardsAutoMatch": "Auto-match by tech stack",
			"standardsAutoMatched": "Auto-matched by project type: {name}",
			"standardsBuiltin": "Built-in",
			"standardsScopeGlobal": "Global (all workspaces)",
			"standardsScopeWorkspace": "This workspace only",
			"standardsNamePlaceholder": "Standard name",
			"standardsNewCustom": "New standard",
			"standardsDeleteCustom": "Delete",
			"standardsResetDefault": "Reset",
			"standardsCopy": "Copy",
			"standardsAiGenerate": "Generate with AI",
			"standardsAiLoading": "Generating…",
			"standardsAiFailed": "AI generation failed; check the model settings and retry",
			"standardsAiHint": "Extra requirements (optional)",
			"standardsScopeLabel": "Scope",
			"standardsScopeGlobalShort": "Global",
			"standardsScopeWorkspaceShort": "Workspace",
			"standardsScopeHint": "Global affects every workspace; workspace scope overrides only this one",
			"standardsOverridden": "edited",
			"standardsBodyPlaceholder": "Write the rules here (one markdown bullet per line)",
			"standardsBudget": "Standards budget",
			"standardsTotal": "{n} token total",
			"standardsSave": "Save",
			"codeIndexTitle": "Feature / API index",
			"codeIndexToggle": "Inject",
			"codeIndexBudget": "Budget",
			"codeIndexSummaryLabel": "Summary",
			"codeIndexSummaryOff": "Off",
			"codeIndexSummaryLlm": "AI generated",
			"codeIndexEmpty": "No endpoints detected (or disabled)",
			"codeIndexCopy": "Click to copy @feature",
			"codeIndexSearch": "Filter by feature/endpoint/path",
			"codeIndexServer": "server",
			"codeIndexClient": "client",
			"codeIndexHint": "Auto-extracted endpoint ↔ server/client locations; click an item to copy @feature and locate it in a session",
			"codeIndexSummaryHint": "AI summaries are generated and cached when a new session is created",
			"budgetCurrent": "Injected",
			"budgetOf": "{cur} / {max} tokens",
			"budgetLimit": "Budget",
			"budgetOver": "Injected context exceeds the budget — set directories to read-only/disabled or lower the load mode",
			"budgetWarn": "Approaching the budget — consider lowering the load mode",
			"budgetRemain": "{remain} left",
			"statFiles": "Files",
			"statDirs": "Dirs",
			"statIndex": "Index",
			"statOverhead": "Overhead",
			"dirUsageTitle": "Per-directory usage",
			"legendReadwrite": "Read-write",
			"legendReadonly": "Read-only",
			"legendDisabled": "Disabled",
			"emptyTitle": "No workspaces yet",
			"emptyText": "Create a workspace to combine several project directories and inject them into new sessions",
			"emptyCreate": "+ New workspace",
			"dirsEmptyTitle": "No project directories yet",
			"emptyAddDir": "Add project",
			"dirMissing": "This directory does not exist — it may have been deleted or moved",
			"previewTitle": "Injected prompt preview",
			"previewShow": "Preview injected prompt",
			"previewHide": "Hide preview",
			"previewCopy": "Copy",
			"previewCopied": "Copied to clipboard",
			"moreTitle": "More",
			"moreBudgetHint": "Context budget",
			"statStandards": "Standards",
			"previewOpenHint": "Click to view",
			"previewEmpty": "The current config injects nothing (no enabled directories)",
			"previewLoading": "Reading file index…",
			"previewSimplified": "(file index not loaded — showing directory list and rules only)",
			"bulkSelected": "{n} selected",
			"bulkAccess": "Access",
			"bulkGroup": "Group",
			"bulkDelete": "Delete",
			"bulkClear": "Clear",
			"bulkApplied": "Updated {n} directories",
			"selectDir": "Select this directory",
			"cmdkTitle": "Command palette",
			"cmdkPlaceholder": "Type a command…",
			"cmdkEmpty": "No matching command",
			"cmdkNewSession": "New session",
			"cmdkNewWorkspace": "New workspace",
			"cmdkRefresh": "Refresh context budget",
			"cmdkAddDir": "Add project directory",
			"cmdkToggleAdvanced": "Toggle advanced config",
			"cmdkTogglePreview": "Toggle prompt preview",
			"cmdkSwitchWs": "Switch to: {name}",
			"cmdkLoadMode": "Load mode: {name}",
			"cmdkKindAction": "action",
			"cmdkKindWorkspace": "workspace",
			"cmdkKindLoadMode": "load mode",
			"sessionsUsing": "{n} session(s) using this",
			"sessionsNone": "No sessions using this",
			"gitDirty": "Branch {branch}, {dirty} modified, {untracked} untracked",
			"gitClean": "Branch {branch}, working tree clean",
			"addNote": "+ Add note",
			"notePlaceholder": "Type a note...",
			"sandboxSynced": "Sandbox {cur}/{total}",
			"sandboxTitle": "Sandbox allowlist synced for {cur} directories (disabled ones excluded)",
			"cmdRefTitle": "@ command cheat sheet",
			"cmdRefHint": "(click to copy)",
			"cmdRefWorkspace": "Switch to a given workspace",
			"cmdRefDir": "Scope context to one directory",
			"cmdRefFiles": "List the current workspace file index",
			"cmdRefSnapshot": "Restore a directory-config snapshot",
			"copied": "Copied to clipboard",
			"copyFailed": "Copy failed — select and copy manually",
			"splitterLabel": "Resize the project-directories / context-budget split",
			"splitterHint": "Drag to resize (double-click to reset to 6:4)"
		};
		/** 当前词典（按 document 语言选择，缺省 zh）。 */
		function dictionary() {
			return (typeof document !== "undefined" ? document.documentElement.lang : "zh").toLowerCase().startsWith("en") ? en : zh;
		}
		/** 翻译一个 key，支持 {name} 模板参数。 */
		function tt(key, values) {
			let out = dictionary()[key];
			if (values !== void 0) for (const [name, value] of Object.entries(values)) out = out.replaceAll("{" + name + "}", String(value));
			return out;
		}
		//#endregion
		//#region src/invariant.ts
		/** 侧边栏面板 id：既是 sidebar.panellist 的 id，也是 main 插槽的 key。 */
		const PANEL_ID = "workspace-combiner";
		/** 默认工作空间名（新建向导未命名时的兜底；host 建目录 / client 查重共用）。 */
		const DEFAULT_WORKSPACE_NAME = "未命名工作空间";
		/** 注入 prompt 的文件索引 token 预算默认值（工作空间未配置时生效）。 */
		const DEFAULT_TOKEN_BUDGET = 6e4;
		/** client -> host 的 HTTP 路由族（与 dsh-multi-root 同约定：loopback-only）。 */
		const API = {
			state: "/api/dsh-workspace-combiner/state",
			workspaceCreate: "/api/dsh-workspace-combiner/workspace-create",
			workspaceRename: "/api/dsh-workspace-combiner/workspace-rename",
			workspaceDelete: "/api/dsh-workspace-combiner/workspace-delete",
			workspaceSwitch: "/api/dsh-workspace-combiner/workspace-switch",
			workspaceDirectories: "/api/dsh-workspace-combiner/workspace-directories",
			workspaceMode: "/api/dsh-workspace-combiner/workspace-mode",
			workspacePatch: "/api/dsh-workspace-combiner/workspace-patch",
			workspaceSnapshot: "/api/dsh-workspace-combiner/workspace-snapshot",
			workspaceLoadMode: "/api/dsh-workspace-combiner/workspace-loadmode",
			contextStats: "/api/dsh-workspace-combiner/context-stats",
			fileIndex: "/api/dsh-workspace-combiner/file-index",
			gitStatus: "/api/dsh-workspace-combiner/git-status",
			scan: "/api/dsh-workspace-combiner/scan",
			stat: "/api/dsh-workspace-combiner/stat",
			codeIndex: "/api/dsh-workspace-combiner/code-index",
			standards: "/api/dsh-workspace-combiner/standards",
			workspaceStandards: "/api/dsh-workspace-combiner/workspace-standards",
			standardsAi: "/api/dsh-workspace-combiner/standards-ai"
		};
		//#endregion
		//#region src/client/api.ts
		/**
		* client -> host 的 HTTP API 客户端。走宿主 /api/dsh-workspace-combiner 路由
		* （loopback-only）。fetch 失败抛错，由面板统一 toast。
		* @module dsh-workspace-combiner/client/api
		*/
		/** 统一 JSON 请求/响应。 */
		async function request(path, init) {
			const res = await fetch(path, {
				headers: { "content-type": "application/json" },
				...init
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.error ?? "HTTP " + res.status);
			}
			return await res.json();
		}
		/** 工作空间读写的宿主 API。 */
		var WorkspaceCombinerApi = class {
			/** 读取全量状态（面板挂载时水合）。 */
			async getState() {
				return await request(API.state);
			}
			/** 新建工作空间：在 basePath 下创建与名称同名的文件夹作为主目录，其余目录作为代码项目；创建后自动切换为当前。 */
			async createWorkspace(name, basePath, directories, mode = "anchor", loadMode = "summary") {
				return await request(API.workspaceCreate, {
					method: "POST",
					body: JSON.stringify({
						name,
						basePath,
						directories,
						mode,
						loadMode
					})
				});
			}
			/** 扫描目录，识别其中的代码项目（java / vue / react / python / go 等）。 */
			async scan(path) {
				return (await request(API.scan, {
					method: "POST",
					body: JSON.stringify({ path })
				})).projects;
			}
			/** 重命名工作空间。 */
			async renameWorkspace(id, name) {
				await request(API.workspaceRename, {
					method: "POST",
					body: JSON.stringify({
						id,
						name
					})
				});
			}
			/** 删除工作空间；返回删除后的当前工作空间 id。 */
			async deleteWorkspace(id) {
				return await request(API.workspaceDelete, {
					method: "POST",
					body: JSON.stringify({ id })
				});
			}
			/** 切换当前工作空间。 */
			async switchWorkspace(id) {
				await request(API.workspaceSwitch, {
					method: "POST",
					body: JSON.stringify({ id })
				});
			}
			/** 覆盖某工作空间的目录列表（含排序/主从；宿主持久化并联动沙盒）。 */
			async setWorkspaceDirectories(id, directories) {
				await request(API.workspaceDirectories, {
					method: "POST",
					body: JSON.stringify({
						id,
						directories
					})
				});
			}
			/** 设置工作空间模式（文档锚点 / 传统单项目）。 */
			async setWorkspaceMode(id, mode) {
				await request(API.workspaceMode, {
					method: "POST",
					body: JSON.stringify({
						id,
						mode
					})
				});
			}
			/** 保存/恢复/删除工作空间目录配置快照。 */
			async workspaceSnapshot(id, action, payload = {}) {
				await request(API.workspaceSnapshot, {
					method: "POST",
					body: JSON.stringify({
						id,
						action,
						...payload
					})
				});
			}
			/** 设置文件加载模式（完整 / 摘要 / 目录树）。 */
			async setLoadMode(id, loadMode) {
				await request(API.workspaceLoadMode, {
					method: "POST",
					body: JSON.stringify({
						id,
						loadMode
					})
				});
			}
			/** 局部更新工作空间级元信息（模式 / 加载模式 / 置顶 / 颜色 / token 预算）。 */
			async patchWorkspace(id, patch) {
				await request(API.workspacePatch, {
					method: "POST",
					body: JSON.stringify({
						id,
						...patch
					})
				});
			}
			/** 读取单目录文件索引（面板预览 prompt 用）；目录不存在时抛错。loadMode 决定树深度，与注入 prompt 对齐。 */
			async fileIndex(path, loadMode = "tree") {
				return await request(API.fileIndex, {
					method: "POST",
					body: JSON.stringify({
						path,
						loadMode
					})
				});
			}
			/** 轻量存在性探测：目录失效检测用，避免为判断存在而构建整棵文件树。 */
			async stat(path) {
				return await request(API.stat, {
					method: "POST",
					body: JSON.stringify({ path })
				});
			}
			/** 读取目录 git 状态（非 git 仓库返回 null）。 */
			async gitStatus(path) {
				return (await request(API.gitStatus, {
					method: "POST",
					body: JSON.stringify({ path })
				})).status;
			}
			/** 获取上下文统计（各目录文件数 + 估算 token）。 */
			async contextStats() {
				return await request(API.contextStats, { method: "GET" });
			}
			/** 读取当前工作空间的功能/接口索引（面板预览用）。 */
			async codeIndex() {
				return (await request(API.codeIndex, { method: "GET" })).entries;
			}
			/** 读取全局开发规范库（覆盖正文 + 全局自建规范）。 */
			async standards() {
				return (await request(API.standards, { method: "GET" })).library;
			}
			/** 整份保存全局开发规范库。 */
			async saveStandards(library) {
				await request(API.standards, {
					method: "POST",
					body: JSON.stringify({ library })
				});
			}
			/** 覆盖某工作空间的开发规范绑定。 */
			async setWorkspaceStandards(id, standards) {
				await request(API.workspaceStandards, {
					method: "POST",
					body: JSON.stringify({
						id,
						standards
					})
				});
			}
			/** 用默认模型起草一份规范正文（可选能力；不可用时返回空串）。 */
			async generateStandard(payload) {
				return (await request(API.standardsAi, {
					method: "POST",
					body: JSON.stringify(payload)
				})).body;
			}
		};
		//#endregion
		//#region src/core/standards.ts
		/** 空库。 */
		function emptyLibrary() {
			return {
				version: 1,
				overrides: {},
				custom: []
			};
		}
		/** 内置规范（v1 共 7 条）。 */
		const BUILTIN_STANDARDS = [
			{
				id: "general",
				name: "通用 / 团队规范",
				tech: "通用",
				summary: "提交信息、凭据、测试、改动范围等团队级约定",
				version: 1,
				body: [
					"- 提交信息用 Conventional Commits：feat / fix / docs / style / refactor / test / chore；标题祈使句、不超过 72 字符",
					"- 严禁提交密钥、口令、token、真实生产数据；示例一律用假值",
					"- 新增或修改行为必须同时补测试；修 bug 先写能复现的用例",
					"- 不引入与仓库现状冲突的新框架/工具；优先复用已有能力",
					"- 注释与文档语言跟随仓库现状，不要中英混写",
					"- 每次都保持最小改动范围，不做与任务无关的重构或全量格式化",
					"- 公共函数/接口要写明用途与边界条件，不写「显而易见」的废话注释"
				].join("\n")
			},
			{
				id: "java-spring",
				name: "Java / Spring",
				tech: "Java",
				summary: "分层、DTO、校验、统一异常、事务边界、日志与测试",
				version: 1,
				matchTypes: ["java"],
				body: [
					"- 分层：controller → service → repository/mapper；controller 只做参数接收与结果组装，不写业务逻辑",
					"- 实体（entity/DO）不作为接口出入参，使用 DTO/VO；转换集中在 service 或 converter",
					"- 参数校验：请求对象加 @Valid + JSR-303 约束注解；业务校验在 service 抛业务异常",
					"- 统一异常：@ControllerAdvice + 自定义业务异常 + 统一错误码；不要 try/catch 后吞掉异常",
					"- 事务：@Transactional 只加在 service 公有方法上；避免长事务与自调用失效；只读查询加 readOnly",
					"- 依赖注入用构造器（或 @RequiredArgsConstructor），禁止 @Autowired 字段注入",
					"- 日志用 SLF4J 占位符 logger.info(\"id={}\", id)；禁止 System.out；异常日志带堆栈",
					"- 时间统一 java.time（LocalDateTime/Instant），禁止 java.util.Date",
					"- 配置外置：连接串、开关放配置或环境变量，禁止硬编码",
					"- 返回统一包装（如 Result<T>）；分页参数命名固定并做上限保护",
					"- MyBatis 参数化（#{}）避免注入；JPA 注意 N+1 与显式 fetch",
					"- 测试：JUnit 5 + MockMvc/Mockito；service 单测覆盖分支，不依赖真实数据库"
				].join("\n")
			},
			{
				id: "vue3",
				name: "Vue 3",
				tech: "前端",
				summary: "Composition API、状态边界、路由懒加载、请求封装",
				version: 1,
				matchTypes: ["frontend-vue"],
				body: [
					"- 组件统一 <script setup> + Composition API；一个文件一个组件",
					"- 组件文件与组件名用 PascalCase；组合式函数用 useXxx 命名",
					"- Props 用 defineProps<Props>() 显式类型，Emits 用 defineEmits 声明，避免隐式 any",
					"- 状态就近：局部用 ref/reactive，跨组件共享用 Pinia；不要让多个组件各自重复请求同一数据",
					"- 路由：页面级组件懒加载（() => import(...)）；路由参数显式类型化",
					"- 请求：统一封装 axios 实例（baseURL/超时/拦截器/统一错误提示），业务代码不直接调 axios",
					"- 样式：<style scoped>；全局样式与主题变量集中管理，避免深层选择器",
					"- 目录约定：views / components / composables / api / stores / router",
					"- 响应数据结构定义类型并集中放置，尽量避免 any"
				].join("\n")
			},
			{
				id: "react",
				name: "React",
				tech: "前端",
				summary: "函数组件与 Hooks、派生状态、副作用、请求封装",
				version: 1,
				matchTypes: ["frontend-react", "frontend-next"],
				body: [
					"- 只用函数组件 + Hooks，不引入类组件",
					"- 状态就近：能派生的值不要放进 state；跨组件共享用 Context 或既有状态库",
					"- 副作用集中在 useEffect，依赖数组必须完整；请求统一走 service 层，组件内不直接 fetch",
					"- 列表渲染给稳定 key；useMemo/useCallback 要有明确理由，不做无意义包裹",
					"- 组件文件 PascalCase；目录约定 components / pages / hooks / services",
					"- Props 用显式 interface，禁止 any",
					"- 样式方案跟随仓库现状（CSS Modules / styled / Tailwind），不混用",
					"- 可访问性：交互元素可键盘操作并带 aria-label"
				].join("\n")
			},
			{
				id: "python",
				name: "Python",
				tech: "Python",
				summary: "PEP 8、类型注解、分层、pydantic 校验、日志与测试",
				version: 1,
				matchTypes: ["python"],
				body: [
					"- 遵循 PEP 8；格式化与导入排序交给 black/ruff，不手工调空格",
					"- 全量类型注解（参数、返回值）；公共函数写 docstring 说明用途与边界",
					"- 分层：api/router → service → repository；不在路由层写业务逻辑",
					"- 数据校验与序列化统一用 pydantic 模型；不直接暴露 ORM 实体",
					"- 配置与密钥走环境变量 / pydantic-settings，禁止硬编码",
					"- 异常：定义业务异常并在统一入口转换为标准错误响应；禁止裸 except",
					"- 日志用 logging（结构化字段），禁止 print 调试残留",
					"- 依赖写入 requirements.txt / poetry.lock / uv.lock 并注明用途",
					"- 测试用 pytest，覆盖分支与边界；外部依赖用 fixture/mock"
				].join("\n")
			},
			{
				id: "go",
				name: "Go",
				tech: "Go",
				summary: "错误处理、context 透传、命名、分层与并发",
				version: 1,
				matchTypes: ["go"],
				body: [
					"- 错误必须处理：不忽略 error；用 %w 包装保持错误链；对外返回语义化错误",
					"- context.Context 作为第一个参数透传（超时/取消），不要存进结构体",
					"- 包名小写单词、无下划线；导出标识符写注释且以名字开头",
					"- gofmt/goimports 必须干净，golangci-lint 通过",
					"- 分层：handler → service → repository；依赖以接口注入，便于测试",
					"- 并发：goroutine 生命周期可管理（errgroup/context）；共享数据用 channel 或 mutex，避免数据竞争",
					"- 资源：defer 关闭文件/连接；注意 defer 在循环内的陷阱",
					"- 测试：表驱动 + t.Run；关注分支覆盖而非行数"
				].join("\n")
			},
			{
				id: "api-contract",
				name: "接口契约（前后端）",
				tech: "接口",
				summary: "改接口同步两侧、状态码、命名、幂等与契约优先",
				version: 1,
				body: [
					"- 改接口必须在同一轮改动里同步改前端请求层，不允许只改一边",
					"- 路径用资源复数名词、层级清晰，动词交给 HTTP 方法",
					"- 状态码语义正确（2xx/4xx/5xx）；错误响应体统一结构（code/message/details）",
					"- 分页/排序/筛选参数命名统一，并给默认值与上限",
					"- 字段命名前后端一致（统一 snake_case 或 camelCase）；时间用 ISO 8601 带时区",
					"- 破坏性变更需版本化或新增字段，不直接改语义；弃用要标注周期",
					"- 契约优先：能用 OpenAPI/proto 描述就先写契约，再由契约校验实现",
					"- 写操作注意幂等（幂等键/去重），保证重试安全",
					"- 接口变更同步更新文档与示例"
				].join("\n")
			}
		];
		/** 按项目类型找匹配的内置规范。 */
		function matchPresetForType(type) {
			if (type === void 0 || type === "none") return void 0;
			return BUILTIN_STANDARDS.find((preset) => preset.matchTypes?.includes(type) === true);
		}
		/**
		* 解析生效的规范分组。
		* @param standards - 工作空间的规范绑定。
		* @param directories - 目录列表（用于逐目录规范与自动匹配）。
		* @param library - 全局规范库（覆盖 + 自建）。
		*/
		function resolveStandardGroups(standards, directories, library) {
			const ws = standards ?? {};
			const byId = /* @__PURE__ */ new Map();
			for (const preset of BUILTIN_STANDARDS) {
				const body = ws.workspaceOverrides?.[preset.id] ?? library.overrides[preset.id] ?? preset.body;
				byId.set(preset.id, {
					name: preset.name,
					tech: preset.tech,
					body
				});
			}
			for (const custom of [...library.custom, ...ws.workspaceCustom ?? []]) byId.set(custom.id, {
				name: custom.name,
				tech: custom.tech,
				body: custom.body
			});
			const groups = [];
			const globalIds = [...new Set(ws.global ?? [])].filter((id) => byId.has(id));
			if (globalIds.length > 0) {
				const picked = globalIds.map((id) => byId.get(id));
				groups.push({
					title: picked.map((p) => p.name).join(" / ") + "（适用全部目录）",
					body: picked.map((p) => p.body).join("\n")
				});
			}
			const autoMatch = ws.autoMatch ?? true;
			for (const dir of directories) {
				if ((dir.access ?? "readwrite") === "disabled") continue;
				const ids = new Set(ws.perDirectory?.[dir.path] ?? []);
				if (autoMatch) {
					const matched = matchPresetForType(dir.projectType);
					if (matched !== void 0 && !(ws.perDirectory?.[dir.path] ?? []).includes(matched.id)) ids.add(matched.id);
				}
				const picked = [...ids].filter((id) => byId.has(id)).map((id) => byId.get(id));
				if (picked.length === 0) continue;
				groups.push({
					title: picked.map((p) => p.name).join(" / ") + "（适用：" + dir.name + "）",
					body: picked.map((p) => p.body).join("\n")
				});
			}
			return groups;
		}
		//#endregion
		//#region src/core/fileTree.ts
		/** 低信号目录（测试/夹具/快照/端到端），其下内容在预算截断时优先丢弃。 */
		const LOW_SIGNAL_DIR = /(^|\/)(__tests__|__mocks__|__snapshots__|tests?|fixtures?|snapshots?|testdata|mocks?|e2e)(\/|$)/;
		/** 低信号文件（测试/快照/生成物/锁文件/声明文件/sourcemap）。 */
		const LOW_SIGNAL_FILE = /(\.(test|spec)\.[cm]?[jt]sx?$)|(\.(snap|lock|map|d\.ts)$)|(\.min\.(js|css)$)|(^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|go\.sum|poetry\.lock|Cargo\.lock)$)/i;
		/** 高信号入口文件（优先展示）。 */
		const HIGH_SIGNAL_FILE = /^(index|main|app|entry|server|cli)\.[cm]?[jt]sx?$/i;
		/**
		* 节点展示优先级：0=入口，1=普通，2=低信号。截断从尾部丢弃，所以低信号排最后，
		* 命中预算时先丢测试/夹具/生成物，而不是按文件名顺序误伤源码。
		*/
		function signalRank(node) {
			if (LOW_SIGNAL_DIR.test(node.path)) return 2;
			if (node.type === "file") {
				if (LOW_SIGNAL_FILE.test(node.name)) return 2;
				if (HIGH_SIGNAL_FILE.test(node.name)) return 0;
			}
			return 1;
		}
		/** 渲染顺序：信号优先 > 目录优先 > 名称。 */
		function compareNodes(a, b) {
			const rank = signalRank(a) - signalRank(b);
			if (rank !== 0) return rank;
			const kind = (a.type === "dir" ? 0 : 1) - (b.type === "dir" ? 0 : 1);
			if (kind !== 0) return kind;
			return a.name.localeCompare(b.name);
		}
		/** 把文件树渲染成缩进文本（目录树加载模式使用；按信号排序，截断先丢低信号）。 */
		function renderTree(nodes, indent = "") {
			const lines = [];
			for (const n of [...nodes].sort(compareNodes)) {
				lines.push(indent + n.name + (n.type === "dir" ? "/" : ""));
				if (n.type === "dir" && n.children !== void 0) lines.push(renderTree(n.children, indent + "  "));
			}
			return lines.join("\n");
		}
		/** 粗略 token 估算：CJK 字符约 1 字符≈1 token，其余约 4 字符≈1 token。 */
		function estimateTokens(text) {
			let cjk = 0;
			let other = 0;
			for (const ch of text) {
				const code = ch.charCodeAt(0);
				if (code >= 19968 && code <= 40959 || code >= 12288 && code <= 12351 || code >= 65280 && code <= 65519) cjk++;
				else other++;
			}
			return Math.ceil(cjk + other / 4);
		}
		//#endregion
		//#region src/prompt.ts
		/** 功能索引默认预算（不挤占文件索引配额）。 */
		const CODE_INDEX_TOKEN_BUDGET = 400;
		/**
		* 渲染功能/接口索引区块（自动抽取，供快速定位前后端落点）。
		* @param tokenBudget - >0 时限制该区块的 token 上限（0/缺省 = 不限制）。
		*/
		function renderCodeIndex(entries, tokenBudget = CODE_INDEX_TOKEN_BUDGET) {
			if (entries.length === 0) return "";
			const header = "# 功能/接口索引（自动抽取，用于定位；以实际代码为准）";
			const lines = [header];
			const budget = tokenBudget > 0 ? tokenBudget : Number.POSITIVE_INFINITY;
			let used = estimateTokens(header);
			let truncated = false;
			for (const entry of entries) {
				const parts = ["@" + entry.feature + " → " + entry.endpoint];
				if (entry.summary !== void 0 && entry.summary !== "") parts.push(entry.summary);
				if (entry.server !== void 0) parts.push("服务端 " + entry.server.file + ":" + entry.server.line);
				if (entry.client !== void 0) parts.push("前端 " + entry.client.file + ":" + entry.client.line);
				const line = "- " + parts.join(" | ");
				const cost = estimateTokens(line) + 1;
				if (used + cost > budget) {
					truncated = true;
					break;
				}
				lines.push(line);
				used += cost;
			}
			if (truncated) lines.push("…（功能索引已达上限，可直接 @ 相关文件）");
			return lines.join("\n");
		}
		/** 目录被配额截断时的块内标注。 */
		const QUOTA_NOTE = "  …（本目录已达配额，可调高预算或改用摘要模式）";
		/**
		* 渲染文件索引区块（按加载模式）。
		*
		* 预算分配采用「目录配额 + 余量回填」：每个目录先保底出现，剩余预算补给被截断的
		* 目录，避免一个大目录把后面的代码项目整块挤掉（旧实现是字母序 first-fit）。
		* @param tokenBudget - >0 时启用目录配额（0/缺省 = 不限制）。
		*/
		function renderFileIndex(entries, loadMode, tokenBudget = 0) {
			if (entries.length === 0) return "";
			const header = "# 文件索引（加载模式：" + loadMode + "）";
			const blocks = entries.map((entry) => ({
				head: "【" + entry.name + "】" + entry.path,
				rest: loadMode === "summary" ? ["  " + (entry.truncated === true ? "≥" : "") + entry.files + " 文件 / " + entry.dirs + " 目录"] : renderTree(entry.tree ?? []).split("\n").map((l) => "  " + l)
			}));
			const cost = (line) => estimateTokens(line) + 1;
			const headerCost = cost(header);
			const headCosts = blocks.map((b) => cost(b.head));
			const restCosts = blocks.map((b) => b.rest.map(cost));
			const mandatory = headerCost + headCosts.reduce((a, c) => a + c, 0);
			const total = mandatory + restCosts.reduce((a, rc) => a + rc.reduce((x, c) => x + c, 0), 0);
			const budget = tokenBudget > 0 ? tokenBudget : Number.POSITIVE_INFINITY;
			if (total <= budget) return [header, ...blocks.flatMap((b) => [b.head, ...b.rest])].join("\n");
			const pool = Math.max(0, budget - mandatory);
			const noteCost = cost(QUOTA_NOTE);
			const share = pool / blocks.length;
			const fit = (costs, limit) => {
				let used = 0;
				let n = 0;
				for (const c of costs) {
					if (used + c > limit) break;
					used += c;
					n++;
				}
				return {
					n,
					used
				};
			};
			const take = blocks.map((_b, i) => {
				const costs = restCosts[i];
				const res = fit(costs, share);
				return res.n < costs.length ? fit(costs, Math.max(0, share - noteCost)) : res;
			});
			let leftover = pool - take.reduce((a, t, i) => a + t.used + (t.n < restCosts[i].length ? noteCost : 0), 0);
			for (let i = 0; i < blocks.length && leftover > 0; i++) {
				const costs = restCosts[i];
				if (take[i].n >= costs.length) continue;
				let n = take[i].n;
				let used = take[i].used;
				while (n < costs.length && leftover >= costs[n]) {
					leftover -= costs[n];
					used += costs[n];
					n++;
				}
				take[i] = {
					n,
					used
				};
			}
			const lines = [header];
			for (let i = 0; i < blocks.length; i++) {
				lines.push(blocks[i].head);
				for (let k = 0; k < take[i].n; k++) lines.push(blocks[i].rest[k]);
				if (take[i].n < blocks[i].rest.length) lines.push(QUOTA_NOTE);
			}
			return lines.join("\n");
		}
		/**
		* 渲染开发规范区块（按作用域分组：通用 + 逐目录）。
		* @param groups - 生效的规范分组。
		* @param tokenBudget - >0 时限制该区块的 token 上限（0/缺省 = 不限制）。
		*/
		function renderStandards(groups, tokenBudget = 800) {
			if (groups.length === 0) return "";
			const header = "# 开发规范（按作用域生效，务必遵守；与其他说明冲突时以本区块为准）";
			const lines = [header];
			const budget = tokenBudget > 0 ? tokenBudget : Number.POSITIVE_INFINITY;
			let used = estimateTokens(header);
			let truncated = false;
			for (const group of groups) {
				let stopped = false;
				for (const line of ["## " + group.title, ...group.body.split("\n")]) {
					const cost = estimateTokens(line) + 1;
					if (used + cost > budget) {
						truncated = true;
						stopped = true;
						break;
					}
					lines.push(line);
					used += cost;
				}
				if (stopped) break;
			}
			if (truncated) lines.push("…（开发规范已达预算上限被截断，可在面板调高预算或精简规范）");
			return lines.join("\n");
		}
		/**
		* 把选中的工作区列表渲染成追加到 system prompt 的固定区块。空列表返回空串
		* （宿主据此不向会话注入任何内容）。
		* @param input - 工作区、加载模式、文件索引、功能索引与开发规范等内容。
		* @returns 符合约定的 prompt 文本；空列表返回 ''。
		*/
		function renderMultiWorkspacePrompt(input) {
			const { workspaces, mode = "anchor", loadMode = "summary", entries = [], tokenBudget = 0, codeEntries = [], codeIndexBudget = CODE_INDEX_TOKEN_BUDGET, standardGroups = [], standardsBudget = 800 } = input;
			const active = workspaces.filter((ws, index) => index === 0 || (ws.access ?? "readwrite") !== "disabled");
			if (active.length === 0) return "";
			const hasReadonly = active.some((ws) => (ws.access ?? "readwrite") === "readonly");
			const primaryLabel = mode === "single" ? "【主项目 · 核心业务代码（读写）】" : "【主项目 · 工作区锚点（文档/非代码文件保存区）】";
			const secondaryLabel = mode === "single" ? "【参考依赖模块】" : "【代码项目】";
			let currentGroup = "";
			const list = active.map((ws, index) => {
				const role = index === 0 ? primaryLabel : secondaryLabel;
				const lock = (ws.access ?? "readwrite") === "readonly" ? "【只读】" : "";
				const group = index === 0 ? "" : ws.group ?? "";
				const header = group !== "" && group !== currentGroup ? "【" + group + "】\n" : "";
				if (group !== "" && group !== currentGroup) currentGroup = group;
				return `${header}${index + 1}.${ws.name}${role}${lock}绝对路径：${ws.path}`;
			}).join("\n");
			const standards = renderStandards(standardGroups, standardsBudget);
			const fileIndex = renderFileIndex(entries, loadMode, tokenBudget);
			const codeIndex = renderCodeIndex(codeEntries, codeIndexBudget);
			return [
				"# 多工作区联合开发模式生效",
				`当前会话加载【${active.length}】个项目目录：`,
				list,
				...standards !== "" ? ["", standards] : [],
				...fileIndex !== "" ? ["", fileIndex] : [],
				...codeIndex !== "" ? ["", codeIndex] : [],
				"",
				"# @指令 · 动态范围",
				"- 消息中以 @ 开头的 token 是被显式引用的路径：@绝对路径，或 @相对某工作区根的相对路径。",
				"- @结尾带 / 的是目录：需要其内容时列出其目录树（ls / read）。",
				"- 其它是文件：需要其内容时先用 read 读取，禁止未读就声称已检查。",
				"- 含空格的路径用 @\"路径 with spaces\" 包裹。",
				...codeIndex !== "" ? ["- @功能名（如 @workspaceCreate）：指上方「功能/接口索引」里的名字，展开即读取该项列出的服务端/前端文件，用于快速定位。"] : [],
				"- 被 @ 引用的文件/目录应优先纳入本次处理范围；不在上方文件索引里的路径同样可直接 read（沙盒读不受限）。",
				"",
				"开发强制规则：",
				"1. 读写文件、查看代码必须使用完整绝对路径，禁止相对路径",
				"2. 多个仓库Git相互独立，提交互不干扰",
				"3. 做接口变更时，同步修改后端代码与前端请求代码",
				"4. 终端执行命令，必须填写文件完整绝对路径，不允许直接使用相对路径执行",
				...hasReadonly ? ["5. 标记【只读】的目录仅可读取，禁止写入、新建、删除其中任何文件"] : []
			].join("\n");
		}
		//#endregion
		//#region src/client/panel/naming.ts
		/** 名称长度上限（超长截断）。 */
		const MAX_NAME_LENGTH = 64;
		/** 过滤控制字符、去首尾空白、超长截断。 */
		function sanitizeWorkspaceName(name) {
			return name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_NAME_LENGTH);
		}
		/** 全局查重：冲突则追加「 (n)」，n 从 2 递增；排除 excludeId 自身。 */
		function checkWorkspaceNameDuplicate(name, excludeId, existing) {
			const base = sanitizeWorkspaceName(name) || "未命名工作空间";
			const taken = new Set(existing.filter((w) => w.id !== excludeId).map((w) => w.name));
			if (!taken.has(base)) return base;
			let i = 2;
			while (taken.has(base + " (" + i + ")")) i++;
			return base + " (" + i + ")";
		}
		//#endregion
		//#region src/client/panel/controller.ts
		/**
		* 面板状态管理：自定义工作空间（增删改切 / 置顶 / 颜色 / token 预算）+ 每个工作空间
		* 独立绑定的项目目录（添加/删除/排序/多选批量）+ 注入 prompt 预览 + 目录失效检测。
		* @module dsh-workspace-combiner/client/panel/controller
		*/
		/**
		* 复制文本到剪贴板，返回是否成功。
		* navigator.clipboard 在非安全上下文 / 受限 iframe 中可能不存在，
		* 此时 writeText 会同步抛错——必须用 try/catch，不能只靠 Promise.catch。
		* @param text - 待复制文本。
		* @returns 是否复制成功。
		*/
		async function copyToClipboard(text) {
			try {
				const clipboard = navigator.clipboard;
				if (clipboard === void 0 || typeof clipboard.writeText !== "function") return false;
				await clipboard.writeText(text);
				return true;
			} catch {
				return false;
			}
		}
		/** 目录 basename（跨平台分隔符）。 */
		function basename(path) {
			const trimmed = path.replace(/[\\/]+$/, "");
			const seg = trimmed.split(/[\\/]/).pop();
			return seg === void 0 || seg === "" ? trimmed : seg;
		}
		/** 错误文本提取。 */
		function errText(error) {
			return error instanceof Error ? error.message : String(error);
		}
		/**
		* 面板状态 hook。
		*/
		function useWorkspaceCombiner(startSession, pickDirectory, registerDshWorkspace, sessionCount = 0) {
			const apiRef = (0, react.useRef)(null);
			if (apiRef.current === null) apiRef.current = new WorkspaceCombinerApi();
			const [workspaces, setWorkspaces] = (0, react.useState)([]);
			const [currentWorkspaceId, setCurrentWorkspaceId] = (0, react.useState)("");
			const [toasts, setToasts] = (0, react.useState)([]);
			const [manualPath, setManualPath] = (0, react.useState)("");
			const [snapshotName, setSnapshotName] = (0, react.useState)("");
			const [search, setSearch] = (0, react.useState)("");
			const [selectedDirs, setSelectedDirs] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [missingDirs, setMissingDirs] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [gitStatuses, setGitStatuses] = (0, react.useState)({});
			const [contextStats, setContextStats] = (0, react.useState)(null);
			const [previewOpen, setPreviewOpen] = (0, react.useState)(false);
			const [previewTrees, setPreviewTrees] = (0, react.useState)([]);
			const [codeEntries, setCodeEntries] = (0, react.useState)([]);
			const [standardsLibrary, setStandardsLibrary] = (0, react.useState)(() => emptyLibrary());
			const [previewLoading, setPreviewLoading] = (0, react.useState)(false);
			const [budgetOverride, setBudgetOverride] = (0, react.useState)(null);
			const currentWsIdRef = (0, react.useRef)("");
			currentWsIdRef.current = currentWorkspaceId;
			const toastSeq = (0, react.useRef)(0);
			const showToast = (0, react.useCallback)((text, kind = "ok") => {
				const id = ++toastSeq.current;
				setToasts((prev) => [...prev, {
					id,
					text,
					kind
				}].slice(-3));
				setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3e3);
			}, []);
			const dismissToast = (0, react.useCallback)((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
			const refreshContextStats = (0, react.useCallback)(() => {
				const api = apiRef.current;
				if (api === null) return;
				api.contextStats().then(setContextStats).catch(() => setContextStats(null));
			}, []);
			(0, react.useEffect)(() => {
				const api = apiRef.current;
				if (api === null) return;
				api.getState().then((state) => {
					setWorkspaces(state.workspaces);
					setCurrentWorkspaceId(state.currentWorkspaceId);
				}).catch((error) => showToast(tt("loadFailed", { error: errText(error) }), "error"));
			}, [showToast]);
			const dirs = (0, react.useMemo)(() => workspaces.find((w) => w.id === currentWorkspaceId)?.directories ?? [], [workspaces, currentWorkspaceId]);
			const dirsRef = (0, react.useRef)(dirs);
			dirsRef.current = dirs;
			const snapshots = (0, react.useMemo)(() => workspaces.find((w) => w.id === currentWorkspaceId)?.snapshots ?? [], [workspaces, currentWorkspaceId]);
			const currentWorkspace = (0, react.useMemo)(() => workspaces.find((w) => w.id === currentWorkspaceId), [workspaces, currentWorkspaceId]);
			const sortedWorkspaces = (0, react.useMemo)(() => [...workspaces].sort((a, b) => Number(b.pinned === true) - Number(a.pinned === true)), [workspaces]);
			const filteredWorkspaces = (0, react.useMemo)(() => {
				const q = search.trim().toLowerCase();
				if (q === "") return sortedWorkspaces;
				return sortedWorkspaces.filter((w) => w.name.toLowerCase().includes(q));
			}, [sortedWorkspaces, search]);
			const tokenBudget = budgetOverride ?? currentWorkspace?.tokenBudget ?? 6e4;
			const contextStatsKey = (0, react.useMemo)(() => dirs.map((d) => d.path + ":" + (d.access ?? "readwrite")).join("\n") + "|" + (currentWorkspace?.mode ?? "anchor") + "|" + (currentWorkspace?.loadMode ?? "summary"), [dirs, currentWorkspace]);
			(0, react.useEffect)(() => {
				refreshContextStats();
			}, [refreshContextStats, contextStatsKey]);
			const codeIndexEnabled = currentWorkspace?.codeIndexEnabled ?? true;
			const codeIndexBudget = currentWorkspace?.codeIndexBudget ?? 400;
			const codeIndexSummary = currentWorkspace?.codeIndexSummary ?? "off";
			const workspaceStandards = currentWorkspace?.standards;
			const standardsBudget = workspaceStandards?.budget ?? 800;
			const standardGroups = (0, react.useMemo)(() => resolveStandardGroups(workspaceStandards, dirs, standardsLibrary), [
				workspaceStandards,
				dirs,
				standardsLibrary
			]);
			(0, react.useEffect)(() => {
				const api = apiRef.current;
				if (api === null) return;
				let cancelled = false;
				api.standards().then((library) => {
					if (!cancelled) setStandardsLibrary(library);
				}).catch(() => {});
				return () => {
					cancelled = true;
				};
			}, []);
			const saveStandardsLibrary = (0, react.useCallback)((library) => {
				setStandardsLibrary(library);
				const api = apiRef.current;
				if (api === null) return;
				api.saveStandards(library).catch((error) => showToast(tt("saveFailed", { error: errText(error) }), "error"));
			}, [showToast]);
			/** 用默认模型起草一份规范正文（可选能力；失败返回空串并提示）。 */
			const generateStandard = (0, react.useCallback)(async (request) => {
				const api = apiRef.current;
				if (api === null) return "";
				try {
					const text = await api.generateStandard(request);
					if (text === "") showToast(tt("standardsAiFailed"), "error");
					return text;
				} catch (error) {
					showToast(tt("standardsAiFailed") + "：" + errText(error), "error");
					return "";
				}
			}, [showToast]);
			const setWorkspaceStandards = (0, react.useCallback)((next) => {
				const id = currentWsIdRef.current;
				const api = apiRef.current;
				if (api === null || id === "") return;
				setWorkspaces((prev) => prev.map((w) => w.id === id ? {
					...w,
					standards: next,
					updatedAt: Date.now()
				} : w));
				api.setWorkspaceStandards(id, next).then(() => refreshContextStats()).catch((error) => showToast(tt("saveFailed", { error: errText(error) }), "error"));
			}, [showToast, refreshContextStats]);
			(0, react.useEffect)(() => {
				const api = apiRef.current;
				if (api === null) return;
				if (!codeIndexEnabled) {
					setCodeEntries([]);
					return;
				}
				let cancelled = false;
				api.codeIndex().then((list) => {
					if (!cancelled) setCodeEntries(list);
				}).catch(() => {
					if (!cancelled) setCodeEntries([]);
				});
				return () => {
					cancelled = true;
				};
			}, [
				contextStatsKey,
				codeIndexEnabled,
				codeIndexSummary
			]);
			const applyDirs = (0, react.useCallback)((next) => {
				const id = currentWsIdRef.current;
				setWorkspaces((prev) => prev.map((w) => w.id === id ? {
					...w,
					directories: [...next],
					updatedAt: Date.now()
				} : w));
				const api = apiRef.current;
				if (api !== null) api.setWorkspaceDirectories(id, next).then(() => refreshContextStats()).catch((error) => showToast(tt("saveFailed", { error: errText(error) }), "error"));
				if (next[0]?.path !== void 0 && next[0].path !== "") registerDshWorkspace(next[0].path);
			}, [
				showToast,
				registerDshWorkspace,
				refreshContextStats
			]);
			const switchWorkspace = (0, react.useCallback)((id) => {
				const api = apiRef.current;
				if (api === null) return;
				setSelectedDirs(/* @__PURE__ */ new Set());
				api.switchWorkspace(id).then(() => setCurrentWorkspaceId(id)).catch((error) => showToast(tt("saveFailed", { error: errText(error) }), "error"));
			}, [showToast]);
			const createWorkspace = (0, react.useCallback)((name, basePath, directories, mode = "anchor", loadMode = "summary") => {
				const base = sanitizeWorkspaceName(name);
				if (base === "") {
					showToast(tt("nameRequired"), "error");
					return;
				}
				const finalName = checkWorkspaceNameDuplicate(base, void 0, workspaces);
				const api = apiRef.current;
				if (api === null) return;
				api.createWorkspace(finalName, basePath, directories, mode, loadMode).then(({ workspace, currentWorkspaceId: curId }) => {
					setWorkspaces((prev) => [...prev, workspace]);
					setCurrentWorkspaceId(curId);
					if (workspace.directories[0]?.path !== void 0) registerDshWorkspace(workspace.directories[0].path);
					showToast(tt("wsCreatedNamed", { name: finalName }));
				}).catch((error) => showToast(tt("saveFailed", { error: errText(error) }), "error"));
			}, [
				workspaces,
				registerDshWorkspace,
				showToast
			]);
			const renameWorkspace = (0, react.useCallback)((id, name) => {
				const base = sanitizeWorkspaceName(name);
				if (base === "") {
					showToast(tt("nameRequired"), "error");
					return;
				}
				const finalName = checkWorkspaceNameDuplicate(base, id, workspaces);
				const api = apiRef.current;
				if (api === null) return;
				api.renameWorkspace(id, finalName).then(() => setWorkspaces((prev) => prev.map((w) => w.id === id ? {
					...w,
					name: finalName
				} : w))).catch((error) => showToast(tt("saveFailed", { error: errText(error) }), "error"));
			}, [workspaces, showToast]);
			const deleteWorkspace = (0, react.useCallback)((id) => {
				const api = apiRef.current;
				if (api === null) return;
				api.deleteWorkspace(id).then(({ currentWorkspaceId: nextId }) => {
					setWorkspaces((prev) => prev.filter((w) => w.id !== id));
					setCurrentWorkspaceId(nextId);
					showToast(tt("wsDeleted"));
				}).catch((error) => showToast(tt("saveFailed", { error: errText(error) }), "error"));
			}, [showToast]);
			const addDirectory = (0, react.useCallback)((path) => {
				const trimmed = path.trim();
				if (trimmed === "") {
					showToast(tt("pathRequired"), "error");
					return;
				}
				if (dirs.some((d) => d.path === trimmed)) {
					showToast(tt("alreadyAdded"), "error");
					return;
				}
				applyDirs([...dirs, {
					id: trimmed,
					name: basename(trimmed),
					path: trimmed
				}]);
			}, [
				dirs,
				applyDirs,
				showToast
			]);
			const pickAndAddDirectory = (0, react.useCallback)(() => {
				pickDirectory().then((path) => {
					if (path !== null && path.trim() !== "") addDirectory(path);
				}).catch((error) => showToast(tt("pickFailed", { error: errText(error) }), "error"));
			}, [
				pickDirectory,
				addDirectory,
				showToast
			]);
			const removeDirectory = (0, react.useCallback)((path) => {
				applyDirs(dirs.filter((d) => d.path !== path));
				setSelectedDirs((prev) => {
					const next = new Set(prev);
					next.delete(path);
					return next;
				});
			}, [dirs, applyDirs]);
			const moveDirectory = (0, react.useCallback)((fromIndex, toIndex) => {
				if (fromIndex === toIndex) return;
				const next = [...dirs];
				const [moved] = next.splice(fromIndex, 1);
				if (moved === void 0) return;
				next.splice(toIndex, 0, moved);
				applyDirs(next);
			}, [dirs, applyDirs]);
			const setDirectoryAccess = (0, react.useCallback)((path, access) => {
				const idx = dirs.findIndex((d) => d.path === path);
				if (idx <= 0) return;
				applyDirs(dirs.map((d, i) => i === idx ? {
					...d,
					access
				} : d));
			}, [dirs, applyDirs]);
			const setDirectoryGroup = (0, react.useCallback)((path, group) => {
				const idx = dirs.findIndex((d) => d.path === path);
				if (idx <= 0) return;
				const g = group.trim();
				applyDirs(dirs.map((d, i) => {
					if (i !== idx) return d;
					if (g === "") {
						const { group: _group, ...withoutGroup } = d;
						return withoutGroup;
					}
					return {
						...d,
						group: g
					};
				}));
			}, [dirs, applyDirs]);
			const toggleDirSelected = (0, react.useCallback)((path) => {
				setSelectedDirs((prev) => {
					const next = new Set(prev);
					if (next.has(path)) next.delete(path);
					else next.add(path);
					return next;
				});
			}, []);
			const clearDirSelection = (0, react.useCallback)(() => setSelectedDirs(/* @__PURE__ */ new Set()), []);
			const bulkSetAccess = (0, react.useCallback)((access) => {
				const n = selectedDirs.size;
				if (n === 0) return;
				applyDirs(dirs.map((d, i) => i > 0 && selectedDirs.has(d.path) ? {
					...d,
					access
				} : d));
				showToast(tt("bulkApplied", { n }));
			}, [
				dirs,
				selectedDirs,
				applyDirs,
				showToast
			]);
			const bulkSetGroup = (0, react.useCallback)((group) => {
				const n = selectedDirs.size;
				if (n === 0) return;
				const g = group.trim();
				applyDirs(dirs.map((d, i) => i > 0 && selectedDirs.has(d.path) ? {
					...d,
					...g === "" ? { group: void 0 } : { group: g }
				} : d));
				showToast(tt("bulkApplied", { n }));
			}, [
				dirs,
				selectedDirs,
				applyDirs,
				showToast
			]);
			const bulkRemove = (0, react.useCallback)(() => {
				const n = selectedDirs.size;
				if (n === 0) return;
				applyDirs(dirs.filter((d, i) => i === 0 || !selectedDirs.has(d.path)));
				setSelectedDirs(/* @__PURE__ */ new Set());
				showToast(tt("bulkApplied", { n }));
			}, [
				dirs,
				selectedDirs,
				applyDirs,
				showToast
			]);
			const setWorkspaceMode = (0, react.useCallback)((mode) => {
				const id = currentWsIdRef.current;
				const api = apiRef.current;
				if (api === null || id === "") return;
				api.setWorkspaceMode(id, mode).then(() => {
					setWorkspaces((prev) => prev.map((w) => w.id === id ? {
						...w,
						mode,
						updatedAt: Date.now()
					} : w));
					showToast(tt("wsSaved"));
				}).catch((error) => showToast(tt("saveFailed", { error: errText(error) }), "error"));
			}, [showToast]);
			const setLoadMode = (0, react.useCallback)((loadMode) => {
				const id = currentWsIdRef.current;
				const api = apiRef.current;
				if (api === null || id === "") return;
				api.setLoadMode(id, loadMode).then(() => {
					setWorkspaces((prev) => prev.map((w) => w.id === id ? {
						...w,
						loadMode,
						updatedAt: Date.now()
					} : w));
					showToast(tt("wsSaved"));
				}).catch((error) => showToast(tt("saveFailed", { error: errText(error) }), "error"));
			}, [showToast]);
			const setTokenBudget = (0, react.useCallback)((value) => {
				const next = Number.isFinite(value) && value > 0 ? Math.round(value) : DEFAULT_TOKEN_BUDGET;
				setBudgetOverride(next);
				const id = currentWsIdRef.current;
				const api = apiRef.current;
				if (api === null || id === "") return;
				setWorkspaces((prev) => prev.map((w) => w.id === id ? {
					...w,
					tokenBudget: next
				} : w));
				api.patchWorkspace(id, { tokenBudget: next }).catch((error) => showToast(tt("saveFailed", { error: errText(error) }), "error"));
			}, [showToast]);
			const patchCodeIndex = (0, react.useCallback)((patch) => {
				const id = currentWsIdRef.current;
				const api = apiRef.current;
				if (api === null || id === "") return;
				setWorkspaces((prev) => prev.map((w) => w.id === id ? {
					...w,
					...patch,
					updatedAt: Date.now()
				} : w));
				api.patchWorkspace(id, patch).catch((error) => showToast(tt("saveFailed", { error: errText(error) }), "error"));
			}, [showToast]);
			const setCodeIndexEnabled = (0, react.useCallback)((enabled) => {
				patchCodeIndex({ codeIndexEnabled: enabled });
			}, [patchCodeIndex]);
			const setCodeIndexBudget = (0, react.useCallback)((value) => {
				patchCodeIndex({ codeIndexBudget: Number.isFinite(value) && value > 0 ? Math.round(value) : 400 });
			}, [patchCodeIndex]);
			const setCodeIndexSummary = (0, react.useCallback)((mode) => {
				patchCodeIndex({ codeIndexSummary: mode });
			}, [patchCodeIndex]);
			const saveSnapshot = (0, react.useCallback)(() => {
				const name = snapshotName.trim();
				const id = currentWsIdRef.current;
				const api = apiRef.current;
				if (name === "") {
					showToast(tt("nameRequired"), "error");
					return;
				}
				if (api === null || id === "") return;
				api.workspaceSnapshot(id, "save", { name }).then(async () => {
					const state = await api.getState();
					setWorkspaces(state.workspaces);
					setSnapshotName("");
					showToast(tt("snapshotSaved"));
				}).catch((error) => showToast(tt("saveFailed", { error: errText(error) }), "error"));
			}, [snapshotName, showToast]);
			const restoreSnapshot = (0, react.useCallback)((snapshotId) => {
				const id = currentWsIdRef.current;
				const api = apiRef.current;
				if (api === null || id === "") return;
				api.workspaceSnapshot(id, "restore", { snapshotId }).then(async () => {
					const state = await api.getState();
					setWorkspaces(state.workspaces);
					setCurrentWorkspaceId(state.currentWorkspaceId);
					const primary = state.workspaces.find((w) => w.id === id)?.directories[0]?.path;
					if (primary !== void 0 && primary !== "") registerDshWorkspace(primary);
					showToast(tt("snapshotRestored"));
				}).catch((error) => showToast(tt("saveFailed", { error: errText(error) }), "error"));
			}, [registerDshWorkspace, showToast]);
			const deleteSnapshot = (0, react.useCallback)((snapshotId) => {
				const id = currentWsIdRef.current;
				const api = apiRef.current;
				if (api === null || id === "") return;
				api.workspaceSnapshot(id, "delete", { snapshotId }).then(async () => {
					const state = await api.getState();
					setWorkspaces(state.workspaces);
					showToast(tt("snapshotDeleted"));
				}).catch((error) => showToast(tt("saveFailed", { error: errText(error) }), "error"));
			}, [showToast]);
			const dirsKey = (0, react.useMemo)(() => dirs.map((d) => d.path).join("\n"), [dirs]);
			const setDirectoryNote = (0, react.useCallback)((path, note) => {
				const idx = dirs.findIndex((d) => d.path === path);
				if (idx < 0) return;
				const n = note.trim();
				applyDirs(dirs.map((d, i) => i === idx ? {
					...d,
					note: n === "" ? void 0 : n
				} : d));
			}, [dirs, applyDirs]);
			const refreshGitStatuses = (0, react.useCallback)(() => {
				const api = apiRef.current;
				if (api === null) return;
				const paths = dirsRef.current.map((d) => d.path);
				Promise.all(paths.map(async (p) => {
					try {
						return await api.gitStatus(p);
					} catch {
						return null;
					}
				})).then((statuses) => {
					const next = {};
					paths.forEach((p, i) => {
						next[p] = statuses[i];
					});
					setGitStatuses(next);
				}).catch(() => {});
			}, []);
			(0, react.useEffect)(() => {
				refreshGitStatuses();
			}, [dirsKey, refreshGitStatuses]);
			(0, react.useEffect)(() => {
				const api = apiRef.current;
				const paths = dirsRef.current.map((d) => d.path);
				if (api === null || paths.length === 0) {
					setMissingDirs(/* @__PURE__ */ new Set());
					return;
				}
				let cancelled = false;
				Promise.all(paths.map(async (p) => {
					try {
						const info = await api.stat(p);
						return info.exists && info.isDirectory;
					} catch {
						return false;
					}
				})).then((flags) => {
					if (cancelled) return;
					const missing = /* @__PURE__ */ new Set();
					flags.forEach((ok, i) => {
						if (!ok) missing.add(paths[i]);
					});
					setMissingDirs(missing);
				}).catch(() => {});
				return () => {
					cancelled = true;
				};
			}, [dirsKey]);
			const previewLoadMode = currentWorkspace?.loadMode ?? "summary";
			(0, react.useEffect)(() => {
				const api = apiRef.current;
				const current = dirsRef.current;
				if (api === null || !previewOpen || current.length === 0) {
					setPreviewTrees([]);
					return;
				}
				let cancelled = false;
				setPreviewLoading(true);
				Promise.all(current.map(async (d) => {
					try {
						const r = await api.fileIndex(d.path, previewLoadMode);
						return {
							name: d.name,
							path: d.path,
							files: r.files,
							dirs: r.dirs,
							...r.truncated ? { truncated: true } : {},
							tree: r.tree
						};
					} catch {
						return {
							name: d.name,
							path: d.path,
							files: 0,
							dirs: 0,
							tree: []
						};
					}
				})).then((list) => {
					if (cancelled) return;
					setPreviewTrees(list);
					setPreviewLoading(false);
				}).catch(() => {
					if (!cancelled) setPreviewLoading(false);
				});
				return () => {
					cancelled = true;
				};
			}, [
				previewOpen,
				dirsKey,
				previewLoadMode
			]);
			const previewText = (0, react.useMemo)(() => {
				const mode = currentWorkspace?.mode ?? "anchor";
				const loadMode = currentWorkspace?.loadMode ?? "summary";
				return renderMultiWorkspacePrompt({
					workspaces: dirs,
					mode,
					loadMode,
					entries: previewTrees,
					tokenBudget,
					codeEntries: codeIndexEnabled ? codeEntries : [],
					codeIndexBudget,
					standardGroups,
					standardsBudget
				});
			}, [
				dirs,
				currentWorkspace,
				previewTrees,
				tokenBudget,
				codeEntries,
				codeIndexEnabled,
				codeIndexBudget,
				standardGroups,
				standardsBudget
			]);
			return {
				workspaces,
				currentWorkspaceId,
				currentWorkspace,
				sortedWorkspaces,
				filteredWorkspaces,
				dirs,
				snapshots,
				toasts,
				manualPath,
				snapshotName,
				search,
				selectedDirs,
				missingDirs,
				gitStatuses,
				tokenBudget,
				previewOpen,
				previewTrees,
				codeEntries,
				codeIndexEnabled,
				codeIndexBudget,
				codeIndexSummary,
				standardsLibrary,
				workspaceStandards,
				standardGroups,
				standardsBudget,
				saveStandardsLibrary,
				setWorkspaceStandards,
				generateStandard,
				setCodeIndexEnabled,
				setCodeIndexBudget,
				setCodeIndexSummary,
				previewLoading,
				previewText,
				sessionCount,
				setManualPath,
				setSnapshotName,
				setSearch,
				setTokenBudget,
				setPreviewOpen,
				switchWorkspace,
				createWorkspace,
				renameWorkspace,
				deleteWorkspace,
				pickAndAddDirectory,
				addDirectory,
				removeDirectory,
				moveDirectory,
				setDirectoryAccess,
				setDirectoryGroup,
				setDirectoryNote,
				toggleDirSelected,
				clearDirSelection,
				bulkSetAccess,
				bulkSetGroup,
				bulkRemove,
				setWorkspaceMode,
				setLoadMode,
				contextStats,
				refreshContextStats,
				saveSnapshot,
				restoreSnapshot,
				deleteSnapshot,
				copyPreview: (0, react.useCallback)(() => {
					if (previewText === "") return;
					copyToClipboard(previewText).then((ok) => showToast(ok ? tt("previewCopied") : tt("copyFailed"), ok ? "ok" : "error"));
				}, [previewText, showToast]),
				copyText: (0, react.useCallback)((text) => {
					copyToClipboard(text).then((ok) => showToast(ok ? tt("copied") : tt("copyFailed"), ok ? "ok" : "error"));
				}, [showToast]),
				createSession: (0, react.useCallback)(() => {
					const primary = dirs[0]?.path;
					if (primary === void 0 || primary === "") {
						showToast(tt("noPrimary"), "error");
						return;
					}
					const name = workspaces.find((w) => w.id === currentWorkspaceId)?.name;
					startSession(primary, name).then((sessionId) => showToast(tt("sessionCreatedNamed", { name: name ?? sessionId }))).catch((error) => showToast(tt("createFailed", { error: errText(error) }), "error"));
				}, [
					dirs,
					workspaces,
					currentWorkspaceId,
					startSession,
					showToast
				]),
				dismissToast
			};
		}
		//#endregion
		//#region src/client/panel/styles.ts
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
.wcb-std-modal{width:min(760px,94vw)}
.wcb-adv-modal{width:min(560px,92vw)}
.wcb-budget-modal{width:min(620px,92vw)}
.wcb-budget-body{max-height:64vh;overflow-y:auto;display:flex;flex-direction:column;gap:8px}
.wcb-adv-body{max-height:64vh;overflow-y:auto;display:flex;flex-direction:column;gap:10px}
.wcb-preview-modal{width:min(760px,94vw)}
.wcb-preview-body{max-height:64vh;overflow-y:auto;display:flex;flex-direction:column;gap:6px}
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

/* ---------- 开发规范弹窗 ---------- */
.wcb-std-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.wcb-std-split{display:flex;gap:12px;min-height:0;flex:1 1 auto}
.wcb-std-list{width:40%;min-width:190px;max-width:300px;flex:none;display:flex;flex-direction:column;gap:8px;
  overflow-y:auto;max-height:48vh;scrollbar-width:thin}
.wcb-std-group{display:flex;flex-direction:column;gap:2px}
.wcb-std-group-title{font-size:9px;color:var(--wcb-dim);text-transform:uppercase;letter-spacing:.3px;margin-bottom:2px}
.wcb-std-item{display:flex;align-items:center;gap:6px;padding:3px 6px;border-radius:5px;border:1px solid transparent}
.wcb-std-item:hover{background:var(--wcb-surface)}
.wcb-std-item-on{background:rgba(79,140,255,.1);border-color:rgba(79,140,255,.25)}
.wcb-std-name{flex:1;min-width:0;text-align:left;border:none;background:transparent;color:var(--wcb-text2);
  font:inherit;font-size:11px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0}
.wcb-std-flag{margin-left:5px;font-size:8.5px;color:var(--wcb-warn);border:1px solid rgba(212,160,23,.35);border-radius:3px;padding:0 3px}
.wcb-std-meta{flex:none;color:var(--wcb-dim);font-size:9px;font-variant-numeric:tabular-nums}
.wcb-std-new{display:flex;gap:5px;align-items:center;padding-top:5px;border-top:1px solid var(--wcb-line)}
.wcb-std-pane{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;min-height:0}
.wcb-std-pane-head{display:flex;align-items:center;gap:8px}
.wcb-std-pane-title{flex:1;min-width:0;font-size:11.5px;font-weight:600;color:var(--wcb-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wcb-std-editor{flex:1;min-height:230px;max-height:48vh;resize:vertical;background:var(--wcb-surface);
  border:1px solid var(--wcb-line2);border-radius:6px;color:var(--wcb-text2);
  font-family:var(--ds-font-family-code,monospace);font-size:11px;line-height:1.55;padding:8px 9px;outline:none}
.wcb-std-editor:focus{border-color:var(--wcb-accent)}

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
`;
		/** 注入面板样式（每次移除旧标签再插入新标签，确保开发时新样式生效）。 */
		function injectPanelStyles() {
			if (typeof document === "undefined") return;
			const id = "dsh-workspace-combiner/client.css";
			document.querySelectorAll(`style[data-plugin-css="${id}"]`).forEach((el) => el.remove());
			const tag = document.createElement("style");
			tag.setAttribute("data-plugin-css", id);
			tag.textContent = PANEL_CSS;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region src/client/panel/typeBadge.tsx
		const TYPE_CLASS = {
			java: "wcb-type-java",
			frontend: "wcb-type-frontend",
			"frontend-vue": "wcb-type-frontend",
			"frontend-react": "wcb-type-frontend",
			"frontend-webpack": "wcb-type-frontend",
			"frontend-next": "wcb-type-frontend",
			python: "wcb-type-python",
			go: "wcb-type-go",
			generic: "wcb-type-generic",
			none: "wcb-type-none"
		};
		const TYPE_KEY = {
			java: "typeJava",
			frontend: "typeFrontend",
			"frontend-vue": "typeFrontendVue",
			"frontend-react": "typeFrontendReact",
			"frontend-webpack": "typeFrontendWebpack",
			"frontend-next": "typeFrontendNext",
			python: "typePython",
			go: "typeGo",
			generic: "typeGeneric",
			none: "typeNone"
		};
		/** 类型 -> CSS 类（vue/react/webpack/next 统一前端色）。 */
		function typeClass(type) {
			return TYPE_CLASS[type];
		}
		/** 类型 -> 本地化标签。 */
		function typeLabel(type) {
			return tt(TYPE_KEY[type]);
		}
		/** 项目类型徽标。 */
		function TypeBadge({ type, evidence }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "wcb-type " + typeClass(type),
				title: evidence !== void 0 && evidence !== "" ? tt("evidenceHint", { evidence }) : void 0,
				children: typeLabel(type)
			});
		}
		//#endregion
		//#region src/client/panel/NewWorkspaceWizard.tsx
		/**
		* 新建工作空间三步向导：① 名称 + 主目录保存位置（base 路径）→ ② 选择文件夹自动识别
		* 项目（多选）→ ③ 完成。保存时在 base 路径下创建与名称同名的文件夹作为主目录，
		* 第二步选中的项目作为代码项目加入工作空间。
		* @module dsh-workspace-combiner/client/panel/NewWorkspaceWizard
		*/
		function NewWorkspaceWizard({ pickDirectory, onClose, onCreate }) {
			const apiRef = (0, react.useRef)(null);
			if (apiRef.current === null) apiRef.current = new WorkspaceCombinerApi();
			const [step, setStep] = (0, react.useState)(1);
			const [name, setName] = (0, react.useState)("");
			const [basePath, setBasePath] = (0, react.useState)("");
			const [scanPath, setScanPath] = (0, react.useState)("");
			const [scanning, setScanning] = (0, react.useState)(false);
			const [projects, setProjects] = (0, react.useState)([]);
			const [checked, setChecked] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [mode, setMode] = (0, react.useState)("anchor");
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (event.key === "Escape") onClose();
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [onClose]);
			const pickBase = () => {
				pickDirectory().then((path) => {
					if (path !== null && path.trim() !== "") setBasePath(path.trim());
				}).catch(() => {});
			};
			const runScan = (path) => {
				const api = apiRef.current;
				if (api === null) return;
				setScanning(true);
				setProjects([]);
				setChecked(/* @__PURE__ */ new Set());
				api.scan(path).then((list) => {
					setProjects(list);
					setChecked(new Set(list.map((p) => p.root)));
				}).catch(() => {}).finally(() => setScanning(false));
			};
			const pickScan = () => {
				pickDirectory().then((path) => {
					if (path !== null && path.trim() !== "") {
						const trimmed = path.trim();
						setScanPath(trimmed);
						runScan(trimmed);
					}
				}).catch(() => {});
			};
			const toggle = (root) => {
				setChecked((prev) => {
					const next = new Set(prev);
					if (next.has(root)) next.delete(root);
					else next.add(root);
					return next;
				});
			};
			const allChecked = projects.length > 0 && checked.size === projects.length;
			const toggleAll = () => setChecked(allChecked ? /* @__PURE__ */ new Set() : new Set(projects.map((p) => p.root)));
			const finalName = name.trim() === "" ? DEFAULT_WORKSPACE_NAME : name.trim();
			const selected = projects.filter((p) => checked.has(p.root));
			const buildSecondaryRefs = () => selected.map((p) => ({
				id: p.root,
				name: p.name,
				path: p.root,
				projectType: p.type,
				evidence: p.evidence
			}));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "wcb-overlay",
				onClick: onClose,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "wcb-modal wcb-modal-wide",
					role: "dialog",
					"aria-modal": "true",
					"aria-label": tt("wizardTitle"),
					onClick: (event) => event.stopPropagation(),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wcb-modal-title",
							children: tt("wizardTitle")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wcb-steps",
							children: [
								tt("wizardStep1"),
								tt("wizardStep2"),
								tt("wizardStep3")
							].map((label, i) => {
								const n = i + 1;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wcb-step" + (step === n ? " wcb-step-active" : "") + (step > n ? " wcb-step-done" : ""),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "wcb-step-num",
										children: n
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label })]
								}, label);
							})
						}),
						step === 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wcb-wizard-body",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "wcb-field",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tt("wsCreateName") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "wcb-input",
										value: name,
										autoFocus: true,
										placeholder: tt("wizardNamePlaceholder"),
										onChange: (event) => setName(event.currentTarget.value)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "wcb-field",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tt("wizardBaseDir") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "wcb-add-row",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "wcb-btn",
											onClick: pickBase,
											children: tt("wizardPickFolder")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "wcb-pathbox",
											children: basePath === "" ? tt("wizardBaseEmpty") : basePath
										})]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-label",
									children: tt("wsModeLabel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-tabs",
									role: "tablist",
									"aria-label": tt("wsModeLabel"),
									children: [["anchor", tt("wsModeAnchor")], ["single", tt("wsModeSingle")]].map(([value, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										role: "tab",
										"aria-selected": mode === value,
										"aria-label": label,
										className: "wcb-tab" + (mode === value ? " wcb-tab-on" : ""),
										onClick: () => setMode(value),
										children: label
									}, value))
								})] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-hint",
									children: mode === "single" ? tt("wsModeSingleHint") : tt("wsModeAnchorHint")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-hint",
									children: tt("wizardBaseHint")
								})
							]
						}) : null,
						step === 2 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wcb-wizard-body",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wcb-add-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "wcb-btn",
										disabled: scanning,
										onClick: pickScan,
										children: tt("wizardPickFolder")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "wcb-pathbox",
										children: scanPath === "" ? tt("wizardScanFolderEmpty") : scanPath
									})]
								}),
								scanning ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-hint",
									children: tt("wizardScanning")
								}) : null,
								!scanning && projects.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-toolbar",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "wcb-btn",
										onClick: toggleAll,
										children: allChecked ? tt("wizardClearSelect") : tt("wizardSelectAll")
									})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
									className: "wcb-scan-list",
									children: projects.map((p) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
										className: "wcb-scan-item",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: checked.has(p.root),
												onChange: () => toggle(p.root)
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "wcb-scan-info",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: "wcb-scan-name",
													children: p.name
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: "wcb-scan-path",
													title: p.root,
													children: p.root
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TypeBadge, {
												type: p.type,
												evidence: p.evidence
											})
										]
									}, p.root))
								})] }) : null,
								!scanning && projects.length === 0 && scanPath !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-hint",
									children: tt("wizardNoProject")
								}) : null
							]
						}) : null,
						step === 3 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wcb-wizard-body",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wcb-hint",
								children: tt("wizardSummary", {
									name: finalName,
									base: basePath,
									n: selected.length
								})
							})
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wcb-modal-actions",
							children: [
								step > 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wcb-btn-plain",
									"aria-label": tt("wizardBack"),
									onClick: () => setStep(step - 1),
									children: tt("wizardBack")
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wcb-btn-plain",
									"aria-label": tt("cancel"),
									onClick: onClose,
									children: tt("cancel")
								}),
								step < 3 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wcb-btn-primary",
									"aria-label": tt("wizardNext"),
									disabled: step === 1 && basePath === "",
									onClick: () => setStep(step + 1),
									children: tt("wizardNext")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wcb-btn-primary",
									"aria-label": tt("wizardCreate"),
									disabled: basePath === "",
									onClick: () => onCreate(finalName, basePath, buildSecondaryRefs(), mode),
									children: tt("wizardCreate")
								})
							]
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/panel/StandardsModal.tsx
		/**
		* 开发规范弹窗：内置规范勾选/编辑/恢复默认、全局与工作空间级自建规范、
		* 按技术栈自动匹配、可选 AI 起草、token 估算与预算。
		* @module dsh-workspace-combiner/client/panel/StandardsModal
		*/
		function StandardsModal({ standards, library, directories, onSaveWorkspace, onSaveLibrary, onGenerateDraft, onClose }) {
			const [draftWs, setDraftWs] = (0, react.useState)(() => ({ ...standards }));
			const [draftLib, setDraftLib] = (0, react.useState)(() => ({
				version: 1,
				overrides: { ...library.overrides },
				custom: library.custom.map((item) => ({ ...item }))
			}));
			const [target, setTarget] = (0, react.useState)("global");
			const [selectedId, setSelectedId] = (0, react.useState)(BUILTIN_STANDARDS[0]?.id ?? "");
			const [newName, setNewName] = (0, react.useState)("");
			const [newScope, setNewScope] = (0, react.useState)("global");
			const [editScope, setEditScope] = (0, react.useState)("global");
			const [aiHint, setAiHint] = (0, react.useState)("");
			const [aiLoading, setAiLoading] = (0, react.useState)(false);
			const rows = (0, react.useMemo)(() => {
				const workspaceOverrides = draftWs.workspaceOverrides ?? {};
				const builtin = BUILTIN_STANDARDS.map((preset) => {
					const globalText = draftLib.overrides[preset.id];
					const workspaceText = workspaceOverrides[preset.id];
					return {
						id: preset.id,
						name: preset.name,
						tech: preset.tech,
						summary: preset.summary,
						body: workspaceText ?? globalText ?? preset.body,
						kind: "builtin",
						overridden: workspaceText !== void 0 || globalText !== void 0
					};
				});
				const globalCustom = draftLib.custom.map((item) => ({
					id: item.id,
					name: item.name,
					tech: item.tech,
					summary: item.summary,
					body: item.body,
					kind: "global-custom",
					overridden: false
				}));
				const workspaceCustom = (draftWs.workspaceCustom ?? []).map((item) => ({
					id: item.id,
					name: item.name,
					tech: item.tech,
					summary: item.summary,
					body: item.body,
					kind: "workspace-custom",
					overridden: false
				}));
				return [
					...builtin,
					...globalCustom,
					...workspaceCustom
				];
			}, [
				draftLib,
				draftWs.workspaceCustom,
				draftWs.workspaceOverrides
			]);
			const activeIds = target === "global" ? draftWs.global ?? [] : draftWs.perDirectory?.[target] ?? [];
			const activeSet = new Set(activeIds);
			const setActive = (ids) => {
				if (target === "global") setDraftWs((prev) => ({
					...prev,
					global: ids
				}));
				else setDraftWs((prev) => {
					const perDirectory = { ...prev.perDirectory ?? {} };
					if (ids.length === 0) delete perDirectory[target];
					else perDirectory[target] = ids;
					return {
						...prev,
						perDirectory
					};
				});
			};
			const toggle = (id) => {
				const next = activeSet.has(id) ? activeIds.filter((x) => x !== id) : [...activeIds, id];
				setActive(next);
			};
			const setBody = (row, text) => {
				if (row.kind === "builtin") if (editScope === "workspace") setDraftWs((prev) => ({
					...prev,
					workspaceOverrides: {
						...prev.workspaceOverrides ?? {},
						[row.id]: text
					}
				}));
				else setDraftLib((prev) => ({
					...prev,
					overrides: {
						...prev.overrides,
						[row.id]: text
					}
				}));
				else if (row.kind === "global-custom") setDraftLib((prev) => ({
					...prev,
					custom: prev.custom.map((item) => item.id === row.id ? {
						...item,
						body: text
					} : item)
				}));
				else setDraftWs((prev) => ({
					...prev,
					workspaceCustom: (prev.workspaceCustom ?? []).map((item) => item.id === row.id ? {
						...item,
						body: text
					} : item)
				}));
			};
			const resetDefault = (row) => {
				if (row.kind !== "builtin") return;
				setDraftLib((prev) => {
					const overrides = { ...prev.overrides };
					delete overrides[row.id];
					return {
						...prev,
						overrides
					};
				});
				setDraftWs((prev) => {
					const workspaceOverrides = { ...prev.workspaceOverrides ?? {} };
					delete workspaceOverrides[row.id];
					return {
						...prev,
						workspaceOverrides
					};
				});
			};
			const createCustom = () => {
				const name = newName.trim();
				if (name === "") return;
				const id = "custom-" + Math.random().toString(36).slice(2, 10);
				if (newScope === "global") setDraftLib((prev) => ({
					...prev,
					custom: [...prev.custom, {
						id,
						name,
						tech: "自定义",
						summary: "",
						body: ""
					}]
				}));
				else setDraftWs((prev) => ({
					...prev,
					workspaceCustom: [...prev.workspaceCustom ?? [], {
						id,
						name,
						tech: tt("standardsScopeWorkspaceShort"),
						summary: "",
						body: ""
					}]
				}));
				setSelectedId(id);
				setNewName("");
			};
			const deleteCustom = (row) => {
				if (row.kind === "global-custom") setDraftLib((prev) => ({
					...prev,
					custom: prev.custom.filter((item) => item.id !== row.id)
				}));
				else if (row.kind === "workspace-custom") setDraftWs((prev) => ({
					...prev,
					workspaceCustom: (prev.workspaceCustom ?? []).filter((item) => item.id !== row.id)
				}));
				setActive(activeIds.filter((x) => x !== row.id));
				if (selectedId === row.id) setSelectedId(BUILTIN_STANDARDS[0]?.id ?? "");
			};
			const copyBody = async (text) => {
				try {
					await navigator.clipboard.writeText(text);
				} catch {}
			};
			const selected = rows.find((row) => row.id === selectedId) ?? rows[0];
			const budget = draftWs.budget ?? 800;
			const totalTokens = activeIds.reduce((sum, id) => {
				const row = rows.find((item) => item.id === id);
				return sum + (row === void 0 ? 0 : estimateTokens(row.body));
			}, 0);
			const targetDirectory = directories.find((dir) => dir.path === target);
			const autoMatched = targetDirectory === void 0 ? void 0 : BUILTIN_STANDARDS.find((preset) => preset.matchTypes?.includes(targetDirectory.projectType ?? "none") === true);
			const generate = async (row) => {
				setAiLoading(true);
				try {
					const text = await onGenerateDraft({
						name: row.name,
						tech: row.tech,
						...targetDirectory === void 0 ? {} : { directory: targetDirectory.name },
						...aiHint.trim() === "" ? {} : { hint: aiHint.trim() }
					});
					if (text !== "") setBody(row, text);
				} finally {
					setAiLoading(false);
				}
			};
			const close = () => {
				onClose();
			};
			const save = () => {
				onSaveWorkspace(draftWs);
				onSaveLibrary(draftLib);
				onClose();
			};
			const renderGroup = (label, items) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "wcb-std-group",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "wcb-std-group-title",
					children: label
				}), items.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "wcb-std-item" + (row.id === selectedId ? " wcb-std-item-on" : ""),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							className: "wcb-checkbox",
							checked: activeSet.has(row.id),
							"aria-label": row.name,
							onChange: () => toggle(row.id)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "wcb-std-name",
							onClick: () => setSelectedId(row.id),
							children: [row.name, row.overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "wcb-std-flag",
								children: tt("standardsOverridden")
							}) : null]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wcb-std-meta",
							children: "~" + estimateTokens(row.body) + " t"
						})
					]
				}, row.id))]
			}, label);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "wcb-overlay",
				onClick: close,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "wcb-modal wcb-modal-wide wcb-std-modal",
					role: "dialog",
					"aria-modal": "true",
					"aria-label": tt("standardsTitle"),
					onClick: (event) => event.stopPropagation(),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wcb-modal-title",
							children: tt("standardsTitle")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wcb-std-toolbar",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "wcb-label",
									style: { margin: 0 },
									children: tt("standardsTarget")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
									className: "wcb-input",
									style: { width: "auto" },
									value: target,
									"aria-label": tt("standardsTarget"),
									onChange: (event) => setTarget(event.currentTarget.value),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: "global",
										children: tt("standardsTargetGlobal")
									}), directories.map((dir) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: dir.path,
										children: dir.name + " — " + dir.path
									}, dir.path))]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "wcb-label",
									style: {
										margin: 0,
										display: "flex",
										alignItems: "center",
										gap: 4
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: draftWs.autoMatch ?? true,
										"aria-label": tt("standardsAutoMatch"),
										onChange: (event) => setDraftWs((prev) => ({
											...prev,
											autoMatch: event.currentTarget.checked
										}))
									}), tt("standardsAutoMatch")]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wcb-head-actions",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "wcb-label",
										style: { margin: 0 },
										children: tt("standardsBudget")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "wcb-budget-input",
										type: "number",
										min: 1,
										value: budget,
										"aria-label": tt("standardsBudget"),
										onChange: (event) => setDraftWs((prev) => ({
											...prev,
											budget: Number(event.currentTarget.value)
										}))
									})]
								})
							]
						}),
						autoMatched !== void 0 && target !== "global" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wcb-hint",
							children: tt("standardsAutoMatched", { name: autoMatched.name })
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wcb-std-split",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "wcb-std-list",
								children: [
									renderGroup(tt("standardsBuiltin"), rows.filter((row) => row.kind === "builtin")),
									draftLib.custom.length > 0 ? renderGroup(tt("standardsScopeGlobal"), rows.filter((row) => row.kind === "global-custom")) : null,
									(draftWs.workspaceCustom ?? []).length > 0 ? renderGroup(tt("standardsScopeWorkspace"), rows.filter((row) => row.kind === "workspace-custom")) : null,
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "wcb-std-new",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												className: "wcb-input",
												value: newName,
												placeholder: tt("standardsNamePlaceholder"),
												"aria-label": tt("standardsNamePlaceholder"),
												onChange: (event) => setNewName(event.currentTarget.value)
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
												className: "wcb-input",
												style: { width: "auto" },
												value: newScope,
												"aria-label": tt("standardsScopeGlobal"),
												onChange: (event) => setNewScope(event.currentTarget.value === "workspace" ? "workspace" : "global"),
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "global",
													children: tt("standardsScopeGlobalShort")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "workspace",
													children: tt("standardsScopeWorkspaceShort")
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "wcb-btn",
												disabled: newName.trim() === "",
												onClick: createCustom,
												children: tt("standardsNewCustom")
											})
										]
									})
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wcb-std-pane",
								children: selected === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-hint",
									children: tt("standardsNone")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "wcb-std-pane-head",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "wcb-std-pane-title",
											children: selected.name
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "wcb-head-actions",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: "wcb-input",
													style: { width: 150 },
													value: aiHint,
													placeholder: tt("standardsAiHint"),
													"aria-label": tt("standardsAiHint"),
													onChange: (event) => setAiHint(event.currentTarget.value)
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "wcb-linkbtn",
													disabled: aiLoading,
													onClick: () => void generate(selected),
													children: aiLoading ? tt("standardsAiLoading") : tt("standardsAiGenerate")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "wcb-linkbtn",
													onClick: () => void copyBody(selected.body),
													children: tt("standardsCopy")
												}),
												selected.kind === "builtin" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "wcb-linkbtn",
													disabled: !selected.overridden,
													onClick: () => resetDefault(selected),
													children: tt("standardsResetDefault")
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "wcb-linkbtn wcb-iconbtn-danger",
													onClick: () => deleteCustom(selected),
													children: tt("standardsDeleteCustom")
												})
											]
										})]
									}),
									selected.kind === "builtin" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "wcb-std-pane-head",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wcb-label",
												style: { margin: 0 },
												children: tt("standardsScopeLabel")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
												className: "wcb-input",
												style: { width: "auto" },
												value: editScope,
												"aria-label": tt("standardsScopeLabel"),
												onChange: (event) => setEditScope(event.currentTarget.value === "workspace" ? "workspace" : "global"),
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "global",
													children: tt("standardsScopeGlobalShort")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "workspace",
													children: tt("standardsScopeWorkspaceShort")
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wcb-hint",
												children: tt("standardsScopeHint")
											})
										]
									}) : null,
									selected.summary !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "wcb-hint",
										children: selected.summary
									}) : null,
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										className: "wcb-std-editor",
										value: selected.body,
										"aria-label": selected.name,
										placeholder: tt("standardsBodyPlaceholder"),
										onChange: (event) => setBody(selected, event.currentTarget.value)
									})
								] })
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wcb-modal-actions",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "wcb-hint",
									style: { marginRight: "auto" },
									children: tt("standardsTotal", { n: totalTokens }) + " / " + budget + " t"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wcb-btn-plain",
									"aria-label": tt("cancel"),
									onClick: close,
									children: tt("cancel")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wcb-btn-primary",
									"aria-label": tt("standardsSave"),
									onClick: save,
									children: tt("standardsSave")
								})
							]
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/panel/AdvancedModal.tsx
		/**
		* 高级配置弹窗：工作空间模式、文件加载模式、快照管理与 @ 指令速查。
		* @module dsh-workspace-combiner/client/panel/AdvancedModal
		*/
		function AdvancedModal({ state, currentWs, onClose }) {
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (event.key === "Escape") onClose();
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [onClose]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "wcb-overlay",
				onClick: onClose,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "wcb-modal wcb-modal-wide wcb-adv-modal",
					role: "dialog",
					"aria-modal": "true",
					"aria-label": tt("advancedTitle"),
					onClick: (event) => event.stopPropagation(),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wcb-modal-title",
							children: tt("advancedTitle")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wcb-modal-body wcb-adv-body",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-label",
									children: tt("wsModeLabel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-tabs",
									role: "tablist",
									"aria-label": tt("wsModeLabel"),
									children: [["anchor", tt("wsModeAnchor")], ["single", tt("wsModeSingle")]].map(([value, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										role: "tab",
										"aria-selected": (currentWs?.mode ?? "anchor") === value,
										"aria-label": label,
										className: "wcb-tab" + ((currentWs?.mode ?? "anchor") === value ? " wcb-tab-on" : ""),
										onClick: () => state.setWorkspaceMode(value),
										children: label
									}, value))
								})] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-label",
									children: tt("loadModeLabel")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-tabs",
									role: "tablist",
									"aria-label": tt("loadModeLabel"),
									children: [
										["summary", tt("loadModeSummary")],
										["tree", tt("loadModeTree")],
										["full", tt("loadModeFull")]
									].map(([value, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										role: "tab",
										"aria-selected": (currentWs?.loadMode ?? "summary") === value,
										"aria-label": label,
										className: "wcb-tab" + ((currentWs?.loadMode ?? "summary") === value ? " wcb-tab-on" : ""),
										onClick: () => state.setLoadMode(value),
										children: label
									}, value))
								})] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "wcb-label",
										children: tt("snapshotSave")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "wcb-add-row",
										style: {
											border: "none",
											padding: 0,
											marginBottom: 6
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "wcb-input",
											value: state.snapshotName,
											placeholder: tt("snapshotNamePlaceholder"),
											"aria-label": tt("snapshotNamePlaceholder"),
											onChange: (event) => state.setSnapshotName(event.currentTarget.value),
											onKeyDown: (event) => {
												if (event.key === "Enter") state.saveSnapshot();
											}
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "wcb-btn",
											"aria-label": tt("snapshotSave"),
											disabled: state.snapshotName.trim() === "",
											onClick: state.saveSnapshot,
											children: tt("snapshotSave")
										})]
									}),
									state.snapshots.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "wcb-snap-list",
										children: state.snapshots.map((s) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "wcb-snap-item",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "wcb-snap-name",
													title: s.name,
													children: s.name
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "wcb-snap-meta",
													children: tt("snapshotDirCount", { n: s.directories.length })
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "wcb-snap-restore",
													"aria-label": tt("snapshotRestore"),
													onClick: () => state.restoreSnapshot(s.id),
													children: tt("snapshotRestore")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "wcb-iconbtn wcb-iconbtn-danger",
													title: tt("snapshotDelete"),
													"aria-label": tt("snapshotDelete"),
													onClick: () => state.deleteSnapshot(s.id),
													children: "✕"
												})
											]
										}, s.id))
									}) : null
								] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "wcb-sep-line" }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wcb-label",
									style: {
										display: "flex",
										alignItems: "center",
										gap: 6
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: {
												color: "var(--wcb-purple)",
												fontWeight: 600
											},
											children: "@"
										}),
										tt("cmdRefTitle"),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: {
												fontSize: "9.5px",
												color: "var(--wcb-dim)"
											},
											children: tt("cmdRefHint")
										})
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-cmdref",
									children: [
										["@workspace", tt("cmdRefWorkspace")],
										["@dir:路径", tt("cmdRefDir")],
										["@files", tt("cmdRefFiles")],
										["@snapshot:名", tt("cmdRefSnapshot")]
									].map(([code, desc]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: "wcb-cmdref-item",
										"aria-label": code + " " + desc,
										onClick: () => state.copyText(code),
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
												className: "wcb-cmdref-code",
												children: code
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wcb-cmdref-desc",
												children: desc
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wcb-cmdref-copy",
												children: tt("previewCopy")
											})
										]
									}, code))
								})] })
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wcb-modal-actions",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "wcb-btn-plain",
								"aria-label": tt("cancel"),
								onClick: onClose,
								children: tt("cancel")
							})
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/panel/PreviewModal.tsx
		/**
		* 注入 prompt 预览弹窗：只读展示当前配置将注入的完整文本，可一键复制。
		* @module dsh-workspace-combiner/client/panel/PreviewModal
		*/
		function PreviewModal({ text, loading, onCopy, onClose }) {
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (event.key === "Escape") onClose();
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [onClose]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "wcb-overlay",
				onClick: onClose,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "wcb-modal wcb-modal-wide wcb-preview-modal",
					role: "dialog",
					"aria-modal": "true",
					"aria-label": tt("previewTitle"),
					onClick: (event) => event.stopPropagation(),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wcb-modal-title",
							children: tt("previewTitle")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wcb-modal-body wcb-preview-body",
							children: text === "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wcb-hint",
								children: tt("previewEmpty")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wcb-hint",
								children: tt("previewLoading")
							}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
								className: "wcb-preview",
								tabIndex: 0,
								"aria-label": tt("previewTitle"),
								children: text
							})] })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wcb-modal-actions",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "wcb-hint",
									style: { marginRight: "auto" },
									children: text === "" ? "" : String(text.length) + " chars"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wcb-btn-plain",
									"aria-label": tt("cancel"),
									onClick: onClose,
									children: tt("cancel")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wcb-btn-primary",
									"aria-label": tt("previewCopy"),
									disabled: text === "",
									onClick: onCopy,
									children: tt("previewCopy")
								})
							]
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/panel/BudgetModal.tsx
		/**
		* 上下文预算弹窗：环形总览 + 单行统计卡 + 逐目录横向条形图（可滚动）+ 预算与刷新。
		* 从右栏移入左栏「更多」入口，避免长期占用右栏高度。
		* @module dsh-workspace-combiner/client/panel/BudgetModal
		*/
		/** 千分位 token 简写（36200 -> 36.2k）。 */
		function kmTokens(n) {
			if (n < 1e3) return String(n);
			return (n / 1e3).toFixed(1) + "k";
		}
		/** 目录索引 -> 条形图颜色。 */
		function dirColor(index, group, type) {
			if (index === 0) return "#d4a017";
			if (group === tt("groupBackend") || type === "java" || type === "python" || type === "go") return "#8b5cf6";
			if (group === tt("groupFrontend") || type === "frontend" || type === "frontend-vue" || type === "frontend-react" || type === "frontend-webpack" || type === "frontend-next") return "#3b82f6";
			if (group === tt("groupRef")) return "#2aa8b4";
			if (group === tt("groupDoc")) return "#d4a017";
			return "#8b949e";
		}
		/** 环形进度图：SVG donut，中间显示百分比。 */
		function Donut({ percentage, size = 44, strokeWidth = 4, color = "#4f8cff" }) {
			const r = (size - strokeWidth) / 2;
			const circumference = 2 * Math.PI * r;
			const pct = Math.min(1, Math.max(0, percentage));
			const offset = circumference * (1 - pct);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "wcb-donut",
				style: {
					width: size,
					height: size
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
					width: size,
					height: size,
					viewBox: "0 0 " + size + " " + size,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
							cx: size / 2,
							cy: size / 2,
							r,
							fill: "none",
							stroke: "rgba(255,255,255,.06)",
							strokeWidth
						}),
						pct > .001 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
							cx: size / 2,
							cy: size / 2,
							r,
							fill: "none",
							stroke: color,
							strokeWidth,
							strokeDasharray: circumference,
							strokeDashoffset: offset,
							strokeLinecap: "round",
							transform: "rotate(-90 " + size / 2 + " " + size / 2 + ")"
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
							className: "wcb-donut-center",
							x: "50%",
							y: "50%",
							dominantBaseline: "central",
							textAnchor: "middle",
							style: { fontSize: size / 4.2 },
							children: Math.round(pct * 100) + "%"
						})
					]
				})
			});
		}
		function BudgetModal({ stats, budget, dirs, onBudget, onRefresh, onClose }) {
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (event.key === "Escape") onClose();
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [onClose]);
			const total = (stats?.fileIndexTokens ?? 0) + (stats?.promptOverheadTokens ?? 0) + (stats?.standardsTokens ?? 0);
			const ratio = budget > 0 ? total / budget : 0;
			const activeDirs = (stats?.directories ?? []).filter((d) => d.access !== "disabled");
			const maxDirTokens = Math.max(1, ...(stats?.directories ?? []).map((d) => d.tokens));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "wcb-overlay",
				onClick: onClose,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "wcb-modal wcb-modal-wide wcb-budget-modal",
					role: "dialog",
					"aria-modal": "true",
					"aria-label": tt("budgetTitle"),
					onClick: (event) => event.stopPropagation(),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wcb-modal-title",
							children: tt("budgetTitle")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wcb-std-toolbar",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "wcb-head-actions",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "wcb-label",
										style: { margin: 0 },
										children: tt("budgetLimit")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "wcb-budget-input",
										type: "number",
										min: 1,
										value: budget,
										"aria-label": tt("budgetLimit"),
										onChange: (event) => onBudget(Number(event.currentTarget.value))
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "wcb-linkbtn",
										"aria-label": tt("monitorRefresh"),
										onClick: onRefresh,
										children: "↻ " + tt("monitorRefresh")
									})
								]
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wcb-modal-body wcb-budget-body",
							children: stats === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wcb-hint",
								children: tt("monitorLoading")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wcb-budget-overview",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Donut, {
										percentage: ratio,
										color: ratio > 1 ? "#f85149" : ratio > .8 ? "#d4a017" : "#4f8cff"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "wcb-budget-figures",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wcb-budget-total",
												children: kmTokens(total)
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "wcb-budget-of",
												children: [
													"/ ",
													kmTokens(budget),
													" token"
												]
											}),
											ratio <= 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wcb-budget-remain",
												children: tt("budgetRemain", { remain: kmTokens(Math.max(0, budget - total)) })
											}) : null
										]
									})]
								}),
								ratio > 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-alert wcb-alert-over",
									children: tt("budgetOver")
								}) : ratio > .8 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-alert",
									children: tt("budgetWarn")
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wcb-stat-grid",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "wcb-stat-card",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "wcb-stat-label",
												children: tt("statFiles")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "wcb-stat-value",
												children: stats.totalFiles
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "wcb-stat-card",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "wcb-stat-label",
												children: tt("statDirs")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "wcb-stat-value",
												children: stats.totalDirs
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "wcb-stat-card",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "wcb-stat-label",
												children: tt("statIndex")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "wcb-stat-value-sm",
												children: kmTokens(stats.fileIndexTokens)
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "wcb-stat-card",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "wcb-stat-label",
												children: tt("statOverhead")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "wcb-stat-value-sm",
												children: kmTokens(stats.promptOverheadTokens)
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "wcb-stat-card",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "wcb-stat-label",
												children: tt("statStandards")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "wcb-stat-value-sm",
												children: kmTokens(stats.standardsTokens)
											})]
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-dir-usage-title",
									children: tt("dirUsageTitle")
								}),
								activeDirs.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-hint",
									children: tt("monitorLoading")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-bars",
									role: "list",
									"aria-label": tt("dirUsageTitle"),
									children: activeDirs.map((d) => {
										const idx = dirs.findIndex((x) => x.path === d.path);
										const ref = dirs.find((x) => x.path === d.path);
										const color = dirColor(idx, ref?.group, ref?.projectType);
										const pct = maxDirTokens > 0 ? d.tokens / maxDirTokens : 0;
										const w = d.tokens > 0 ? Math.max(3, Math.round(pct * 100)) : 1;
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "wcb-bar-row",
											role: "listitem",
											title: d.name + " · " + d.tokens.toLocaleString() + " " + tt("monitorTokens"),
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "wcb-bar-name",
													children: d.name
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: "wcb-bar-track-h",
													children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: "wcb-bar-fill-h",
														style: {
															width: w + "%",
															background: color
														}
													})
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "wcb-bar-val",
													children: kmTokens(d.tokens)
												})
											]
										}, d.path);
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-hint",
									children: tt("warning")
								})
							] })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wcb-modal-actions",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "wcb-btn-plain",
								"aria-label": tt("cancel"),
								onClick: onClose,
								children: tt("cancel")
							})
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/panel/WorkspaceCombinerPanel.tsx
		/**
		* 工作区组合器侧边栏面板（main 插槽 body）与侧边栏图标（sidebar.panellist）。
		* v2.3 宽屏左右分栏：顶部（品牌+当前卡）→ 左栏（工作空间+高级配置+预览）/
		* 右栏（项目目录+上下文预算）→ 底部图例。窄屏自动降级为上下堆叠。
		* @module dsh-workspace-combiner/client/panel/WorkspaceCombinerPanel
		*/
		/** 侧边栏图标：两个叠放的方块 + 连线，表达「多项目组合」。 */
		function WorkspaceCombinerIcon({ size, active }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				viewBox: "0 0 16 16",
				width: size,
				height: size,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: active ? 1.6 : 1.4,
				opacity: active ? 1 : .75,
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: 2,
						y: 6,
						width: 8,
						height: 8,
						rx: 1.5
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: 6,
						y: 2,
						width: 8,
						height: 8,
						rx: 1.5
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M6 10l3-3" })
				]
			});
		}
		/** 相对时间：最近使用时间。 */
		function formatLastUsed(ts) {
			if (ts === void 0) return tt("wsNeverUsed");
			const diff = Date.now() - ts;
			const min = Math.floor(diff / 6e4);
			if (min < 1) return tt("wsLastUsedJustNow");
			if (min < 60) return tt("wsLastUsedMin", { n: min });
			const hr = Math.floor(min / 60);
			if (hr < 24) return tt("wsLastUsedHour", { n: hr });
			return tt("wsLastUsedDay", { n: Math.floor(hr / 24) });
		}
		/** 目录分组 -> 胶囊样式类。 */
		const GROUP_CLASS = {
			[tt("groupDoc")]: "wcb-cap-doc",
			[tt("groupBackend")]: "wcb-cap-backend",
			[tt("groupFrontend")]: "wcb-cap-frontend",
			[tt("groupRef")]: "wcb-cap-ref",
			[tt("groupOther")]: "wcb-cap-other"
		};
		/** 目录分组 -> 类型方块字母 + 样式类。 */
		function dirTypeSquare(index, group, type) {
			if (index === 0) return {
				letter: "D",
				cls: "wcb-type-sq wcb-type-sq-doc"
			};
			const g = group ?? "";
			if (g === tt("groupBackend") || type === "java" || type === "python" || type === "go") return {
				letter: "B",
				cls: "wcb-type-sq wcb-type-sq-backend"
			};
			if (g === tt("groupFrontend") || type === "frontend" || type === "frontend-vue" || type === "frontend-react" || type === "frontend-webpack" || type === "frontend-next") return {
				letter: "F",
				cls: "wcb-type-sq wcb-type-sq-frontend"
			};
			if (g === tt("groupRef")) return {
				letter: "R",
				cls: "wcb-type-sq wcb-type-sq-ref"
			};
			if (g === tt("groupDoc")) return {
				letter: "D",
				cls: "wcb-type-sq wcb-type-sq-doc"
			};
			return {
				letter: "P",
				cls: "wcb-type-sq wcb-type-sq-other"
			};
		}
		/** 访问状态 -> 胶囊样式类。 */
		const ACCESS_CLASS = {
			readwrite: "wcb-cap wcb-cap-rw",
			readonly: "wcb-cap wcb-cap-ro",
			disabled: "wcb-cap wcb-cap-off"
		};
		/** 主项目标注：「📄 仅文档」——纯前端按是否为第一项渲染，不改数据结构。 */
		function DocOnlyBadge() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "wcb-kind wcb-kind-doc",
				title: tt("badgeDocOnlyTip"),
				role: "note",
				"aria-label": tt("badgeDocOnlyTip"),
				children: tt("badgeDocOnly")
			});
		}
		/** 代码项目反向标注：「💻 代码」——比主项目 Badge 更弱，仅作对照。 */
		function CodeBadge() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "wcb-kind wcb-kind-code",
				title: tt("badgeCodeTip"),
				role: "note",
				"aria-label": tt("badgeCodeTip"),
				children: tt("badgeCode")
			});
		}
		/** Git 分支标签：脏（橙）显示 '*N'，干净（灰）仅分支名；未加载/非 git 不渲染。 */
		function GitBadge({ status }) {
			if (status === void 0 || status === null) return null;
			const pending = status.dirty + status.untracked;
			const dirty = pending > 0;
			const title = dirty ? tt("gitDirty", {
				branch: status.branch,
				dirty: status.dirty,
				untracked: status.untracked
			}) : tt("gitClean", { branch: status.branch });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "wcb-git " + (dirty ? "wcb-git-dirty" : "wcb-git-clean"),
				title,
				children: [
					"⎇ " + status.branch,
					dirty ? " *" + pending : "",
					status.ahead > 0 ? " ↑" + status.ahead : ""
				]
			});
		}
		/** 弹窗公共外壳：Esc 关闭 + 点击遮罩关闭 + aria-modal。 */
		function Modal({ title, onClose, wide, children }) {
			const ref = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (event.key === "Escape") {
						event.stopPropagation();
						onClose();
					}
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [onClose]);
			(0, react.useEffect)(() => {
				ref.current?.focus();
			}, []);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "wcb-overlay",
				onClick: onClose,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref,
					tabIndex: -1,
					className: "wcb-modal" + (wide === true ? " wcb-modal-wide" : ""),
					role: "dialog",
					"aria-modal": "true",
					"aria-label": title,
					onClick: (event) => event.stopPropagation(),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wcb-modal-title",
						children: title
					}), children]
				})
			});
		}
		/** 重命名工作空间弹窗。 */
		function RenameWorkspaceModal({ ws, onConfirm, onClose }) {
			const [name, setName] = (0, react.useState)(ws.name);
			const submit = () => {
				const trimmed = name.trim();
				if (trimmed !== "") onConfirm(trimmed);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Modal, {
				title: tt("wsRenameTitle"),
				onClose,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: "wcb-field",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tt("wsCreateName") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: "wcb-input",
						value: name,
						autoFocus: true,
						"aria-label": tt("wsCreateName"),
						onChange: (event) => setName(event.currentTarget.value),
						onKeyDown: (event) => {
							if (event.key === "Enter") submit();
						}
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "wcb-modal-actions",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "wcb-btn-plain",
						"aria-label": tt("cancel"),
						onClick: onClose,
						children: tt("cancel")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "wcb-btn-primary",
						"aria-label": tt("confirm"),
						disabled: name.trim() === "",
						onClick: submit,
						children: tt("confirm")
					})]
				})]
			});
		}
		/** 删除工作空间确认弹窗。 */
		function DeleteWorkspaceModal({ ws, onConfirm, onClose }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Modal, {
				title: tt("wsDeleteTitle"),
				onClose,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "wcb-modal-body",
					children: tt("wsDeleteConfirm", { name: ws.name })
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "wcb-modal-actions",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "wcb-btn-plain",
						"aria-label": tt("cancel"),
						onClick: onClose,
						children: tt("cancel")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "wcb-btn-danger",
						"aria-label": tt("wsDelete"),
						onClick: onConfirm,
						children: tt("wsDelete")
					})]
				})]
			});
		}
		/** 面板 body。 */
		function WorkspaceCombinerPanel(props) {
			(0, react.useEffect)(() => {
				injectPanelStyles();
			}, []);
			const { startSession, pickDirectory, registerDshWorkspace } = props;
			const state = useWorkspaceCombiner(startSession, pickDirectory, registerDshWorkspace, props.sessionCount ?? 0);
			const [wizardOpen, setWizardOpen] = (0, react.useState)(false);
			const [renameTarget, setRenameTarget] = (0, react.useState)(null);
			const [deleteTarget, setDeleteTarget] = (0, react.useState)(null);
			const [dragIndex, setDragIndex] = (0, react.useState)(null);
			const [dropIndex, setDropIndex] = (0, react.useState)(null);
			const [dirsOpen, setDirsOpen] = (0, react.useState)(true);
			const [advOpen, setAdvOpen] = (0, react.useState)(false);
			const [standardsOpen, setStandardsOpen] = (0, react.useState)(false);
			const [budgetOpen, setBudgetOpen] = (0, react.useState)(false);
			const [cmdkOpen, setCmdkOpen] = (0, react.useState)(false);
			const [cmdkQuery, setCmdkQuery] = (0, react.useState)("");
			const [cmdkIndex, setCmdkIndex] = (0, react.useState)(0);
			const [editingNotePath, setEditingNotePath] = (0, react.useState)(null);
			const [ciQuery, setCiQuery] = (0, react.useState)("");
			const currentWs = state.currentWorkspace;
			const dirCount = state.dirs.length;
			const submitManualPath = () => {
				const path = state.manualPath.trim();
				if (path !== "") {
					state.addDirectory(path);
					state.setManualPath("");
				}
			};
			const sandboxCount = state.dirs.filter((d) => (d.access ?? "readwrite") !== "disabled").length;
			const advSummary = tt("advancedSummary", {
				mode: currentWs?.mode === "single" ? tt("wsModeSingle") : tt("wsModeAnchor"),
				load: currentWs?.loadMode === "full" ? tt("loadModeFull") : currentWs?.loadMode === "tree" ? tt("loadModeTree") : tt("loadModeSummary"),
				n: state.snapshots.length
			});
			const commands = (0, react.useMemo)(() => {
				const items = [
					{
						id: "new-session",
						label: tt("cmdkNewSession"),
						kind: tt("cmdkKindAction"),
						run: state.createSession
					},
					{
						id: "new-ws",
						label: tt("cmdkNewWorkspace"),
						kind: tt("cmdkKindAction"),
						run: () => setWizardOpen(true)
					},
					{
						id: "add-dir",
						label: tt("cmdkAddDir"),
						kind: tt("cmdkKindAction"),
						run: state.pickAndAddDirectory
					},
					{
						id: "refresh",
						label: tt("cmdkRefresh"),
						kind: tt("cmdkKindAction"),
						run: state.refreshContextStats
					},
					{
						id: "toggle-adv",
						label: tt("cmdkToggleAdvanced"),
						kind: tt("cmdkKindAction"),
						run: () => setAdvOpen((v) => !v)
					},
					{
						id: "toggle-preview",
						label: tt("cmdkTogglePreview"),
						kind: tt("cmdkKindAction"),
						run: () => state.setPreviewOpen(!state.previewOpen)
					}
				];
				for (const ws of state.sortedWorkspaces) items.push({
					id: "ws-" + ws.id,
					label: tt("cmdkSwitchWs", { name: ws.name }),
					kind: tt("cmdkKindWorkspace"),
					run: () => state.switchWorkspace(ws.id)
				});
				const modes = [
					["summary", tt("loadModeSummary")],
					["tree", tt("loadModeTree")],
					["full", tt("loadModeFull")]
				];
				for (const [value, label] of modes) items.push({
					id: "load-" + value,
					label: tt("cmdkLoadMode", { name: label }),
					kind: tt("cmdkKindLoadMode"),
					run: () => state.setLoadMode(value)
				});
				return items;
			}, [state]);
			const cmdkFiltered = (0, react.useMemo)(() => {
				const q = cmdkQuery.trim().toLowerCase();
				if (q === "") return commands;
				return commands.filter((c) => c.label.toLowerCase().includes(q));
			}, [commands, cmdkQuery]);
			const codeEntriesFiltered = (0, react.useMemo)(() => {
				const q = ciQuery.trim().toLowerCase();
				if (q === "") return state.codeEntries;
				return state.codeEntries.filter((entry) => (entry.feature + " " + entry.endpoint + " " + (entry.server?.file ?? "") + " " + (entry.client?.file ?? "") + " " + (entry.summary ?? "")).toLowerCase().includes(q));
			}, [state.codeEntries, ciQuery]);
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					const mod = event.metaKey || event.ctrlKey;
					if (mod && event.key.toLowerCase() === "n") {
						event.preventDefault();
						state.createSession();
						return;
					}
					if (mod && event.key.toLowerCase() === "k") {
						event.preventDefault();
						setCmdkOpen((v) => !v);
						setCmdkQuery("");
						setCmdkIndex(0);
						return;
					}
					if (event.key === "Escape") setCmdkOpen(false);
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [state]);
			(0, react.useEffect)(() => {
				if (!cmdkOpen) return;
				const onKey = (event) => {
					if (event.key === "ArrowDown") {
						event.preventDefault();
						setCmdkIndex((i) => Math.min(i + 1, cmdkFiltered.length - 1));
					} else if (event.key === "ArrowUp") {
						event.preventDefault();
						setCmdkIndex((i) => Math.max(i - 1, 0));
					} else if (event.key === "Enter") {
						event.preventDefault();
						const item = cmdkFiltered[cmdkIndex];
						if (item !== void 0) {
							item.run();
							setCmdkOpen(false);
						}
					}
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [
				cmdkOpen,
				cmdkFiltered,
				cmdkIndex
			]);
			if (state.workspaces.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "wcb-root",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "wcb-brand",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wcb-brand-icon",
							"aria-hidden": "true",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wcb-brand-text",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wcb-title",
								children: tt("title")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "wcb-subtitle",
								children: tt("brandSubtitle")
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wcb-card",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wcb-empty",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-empty-icon",
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-empty-title",
									children: tt("emptyTitle")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-empty-text",
									children: tt("emptyText")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wcb-btn-new",
									"aria-label": tt("emptyCreate"),
									onClick: () => setWizardOpen(true),
									children: tt("emptyCreate")
								})
							]
						})
					}),
					wizardOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NewWorkspaceWizard, {
						pickDirectory,
						onClose: () => setWizardOpen(false),
						onCreate: (name, basePath, directories, mode) => {
							state.createWorkspace(name, basePath, directories, mode);
							setWizardOpen(false);
						}
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wcb-toast-stack",
						children: state.toasts.map((t) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wcb-toast " + (t.kind === "error" ? "wcb-toast-error" : "wcb-toast-ok"),
							role: "status",
							onClick: () => state.dismissToast(t.id),
							children: t.text
						}, t.id))
					})
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "wcb-root",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "wcb-top",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wcb-brand",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-brand-icon",
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", {})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wcb-brand-text",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "wcb-title",
										children: tt("title")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "wcb-subtitle",
										children: tt("brandSubtitle")
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-kbd",
									title: "⌘N",
									children: "⌘N"
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wcb-current",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-status-dot" + (dirCount === 0 ? " wcb-status-off" : ""),
									"aria-hidden": "true"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wcb-current-text",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "wcb-current-name",
										title: currentWs?.name,
										children: currentWs?.name ?? ""
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "wcb-current-meta",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: currentWs?.mode === "single" ? tt("wsModeSingle") : tt("wsModeAnchor") }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wcb-sep",
												children: "·"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tt("wsDirCount", { n: dirCount }) }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wcb-sep",
												children: "·"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: currentWs?.loadMode === "full" ? tt("loadModeFull") : currentWs?.loadMode === "tree" ? tt("loadModeTree") : tt("loadModeSummary") })
										]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wcb-btn-new",
									"aria-label": tt("createSession"),
									disabled: dirCount === 0,
									onClick: state.createSession,
									children: tt("createSession")
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "wcb-main-split",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wcb-left-col",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
									className: "wcb-card wcb-card-grow",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "wcb-card-head",
										children: [
											tt("workspaces"),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wcb-badge",
												children: state.sortedWorkspaces.length
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "wcb-head-actions",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													className: "wcb-search",
													value: state.search,
													placeholder: tt("searchPlaceholder"),
													"aria-label": tt("searchPlaceholder"),
													onChange: (event) => state.setSearch(event.currentTarget.value)
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "wcb-linkbtn",
													"aria-label": tt("newWorkspace"),
													onClick: () => setWizardOpen(true),
													children: tt("newShort")
												})]
											})
										]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "wcb-card-body",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "wcb-ws-list",
											children: [state.filteredWorkspaces.map((ws) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "wcb-ws-item" + (ws.id === state.currentWorkspaceId ? " wcb-ws-active" : ""),
												role: "button",
												tabIndex: 0,
												"aria-label": ws.name,
												onClick: () => state.switchWorkspace(ws.id),
												onKeyDown: (event) => {
													if (event.key === "Enter" || event.key === " ") {
														event.preventDefault();
														state.switchWorkspace(ws.id);
													}
												},
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "wcb-ws-dot",
														"aria-hidden": "true",
														children: "●"
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "wcb-ws-name",
														title: ws.name,
														children: ws.name
													}),
													ws.id === state.currentWorkspaceId ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "wcb-pill wcb-pill-current",
														children: tt("wsCurrent")
													}) : null,
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "wcb-ws-time",
														children: formatLastUsed(ws.lastSessionAt)
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: "wcb-ws-tools",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "wcb-iconbtn",
															title: tt("wsRename"),
															"aria-label": tt("wsRename"),
															onClick: (event) => {
																event.stopPropagation();
																setRenameTarget(ws);
															},
															children: "✎"
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "wcb-iconbtn wcb-iconbtn-danger",
															title: tt("wsDelete"),
															"aria-label": tt("wsDelete"),
															onClick: (event) => {
																event.stopPropagation();
																setDeleteTarget(ws);
															},
															children: "✕"
														})]
													})
												]
											}, ws.id)), state.filteredWorkspaces.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "wcb-hint",
												children: tt("cmdkEmpty")
											}) : null]
										})
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
									className: "wcb-card",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "wcb-card-head wcb-card-head-btn",
										role: "button",
										tabIndex: 0,
										"aria-label": tt("standardsTitle"),
										"aria-expanded": standardsOpen,
										onClick: () => setStandardsOpen(true),
										onKeyDown: (event) => {
											if (event.key === "Enter" || event.key === " ") {
												event.preventDefault();
												setStandardsOpen(true);
											}
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wcb-caret",
												"aria-hidden": "true",
												children: "▸"
											}),
											tt("standardsTitle"),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wcb-badge",
												style: { marginLeft: 2 },
												children: state.standardGroups.length > 0 ? tt("standardsGroups", { n: state.standardGroups.length }) : tt("standardsNone")
											}),
											state.standardGroups.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wcb-label",
												style: {
													margin: 0,
													marginLeft: "auto"
												},
												children: "~" + (state.contextStats?.standardsTokens ?? 0) + " t"
											}) : null
										]
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
									className: "wcb-card",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "wcb-card-head wcb-card-head-btn",
										role: "button",
										tabIndex: 0,
										"aria-label": tt("advancedTitle"),
										"aria-expanded": advOpen,
										onClick: () => setAdvOpen(true),
										onKeyDown: (event) => {
											if (event.key === "Enter" || event.key === " ") {
												event.preventDefault();
												setAdvOpen(true);
											}
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wcb-caret",
												"aria-hidden": "true",
												children: "▸"
											}),
											tt("advancedTitle"),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wcb-badge",
												style: { marginLeft: 2 },
												children: advSummary
											})
										]
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
									className: "wcb-card",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "wcb-card-head wcb-card-head-btn",
										role: "button",
										tabIndex: 0,
										"aria-label": tt("previewTitle"),
										"aria-expanded": state.previewOpen,
										onClick: () => state.setPreviewOpen(true),
										onKeyDown: (event) => {
											if (event.key === "Enter" || event.key === " ") {
												event.preventDefault();
												state.setPreviewOpen(true);
											}
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wcb-caret",
												"aria-hidden": "true",
												children: "▸"
											}),
											tt("previewTitle"),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "wcb-head-actions",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "wcb-label",
													style: { margin: 0 },
													children: tt("previewOpenHint")
												})
											})
										]
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
									className: "wcb-card",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "wcb-card-head wcb-card-head-btn",
										role: "button",
										tabIndex: 0,
										"aria-label": tt("moreTitle"),
										"aria-expanded": budgetOpen,
										onClick: () => setBudgetOpen(true),
										onKeyDown: (event) => {
											if (event.key === "Enter" || event.key === " ") {
												event.preventDefault();
												setBudgetOpen(true);
											}
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wcb-caret",
												"aria-hidden": "true",
												children: "▸"
											}),
											tt("moreTitle"),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wcb-badge",
												style: { marginLeft: 2 },
												children: tt("moreBudgetHint")
											})
										]
									})
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wcb-right-col",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								className: "wcb-card wcb-card-grow",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wcb-card-head wcb-card-head-btn",
									role: "button",
									tabIndex: 0,
									"aria-label": tt("projectsTitle"),
									onClick: () => setDirsOpen((v) => !v),
									onKeyDown: (event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											setDirsOpen((v) => !v);
										}
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "wcb-caret",
											"aria-hidden": "true",
											children: dirsOpen ? "▾" : "▸"
										}),
										tt("projectsTitle"),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "wcb-badge",
											children: dirCount
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "wcb-head-actions",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "wcb-linkbtn",
												"aria-label": tt("pickDirectory"),
												onClick: (event) => {
													event.stopPropagation();
													state.pickAndAddDirectory();
												},
												children: "+ " + tt("addDirectory")
											})
										})
									]
								}), dirsOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wcb-card-body",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "wcb-add-row",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "wcb-btn",
												"aria-label": tt("wizardPickFolder"),
												onClick: state.pickAndAddDirectory,
												children: tt("wizardPickFolder")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												className: "wcb-input wcb-input-mono",
												value: state.manualPath,
												placeholder: tt("manualPathPlaceholder"),
												"aria-label": tt("manualPathPlaceholder"),
												onChange: (event) => state.setManualPath(event.currentTarget.value),
												onKeyDown: (event) => {
													if (event.key === "Enter") submitManualPath();
												}
											})]
										}),
										dirCount === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "wcb-empty",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: "wcb-empty-title",
													children: tt("dirsEmptyTitle")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: "wcb-empty-text",
													children: tt("dirsEmpty")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "wcb-btn",
													"aria-label": tt("emptyAddDir"),
													onClick: state.pickAndAddDirectory,
													children: tt("emptyAddDir")
												})
											]
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
											className: "wcb-dir-list",
											children: state.dirs.map((d, i) => {
												const group = d.group ?? "";
												const access = d.access ?? "readwrite";
												const sq = dirTypeSquare(i, d.group, d.projectType);
												const missing = state.missingDirs.has(d.path);
												const selected = state.selectedDirs.has(d.path);
												return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
													className: "wcb-dir-row" + (dragIndex === i ? " wcb-dragging" : "") + (access === "disabled" ? " wcb-dir-disabled" : "") + (missing ? " wcb-dir-missing" : "") + (selected ? " wcb-dir-selected" : ""),
													draggable: true,
													onDragStart: () => setDragIndex(i),
													onDragEnd: () => {
														setDragIndex(null);
														setDropIndex(null);
													},
													onDragOver: (event) => {
														event.preventDefault();
														setDropIndex(i);
													},
													onDrop: () => {
														if (dragIndex !== null && dropIndex !== null) state.moveDirectory(dragIndex, i);
														setDragIndex(null);
														setDropIndex(null);
													},
													children: [
														dropIndex === i && dragIndex !== null && dragIndex !== i ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "wcb-drop-line",
															"aria-hidden": "true"
														}) : null,
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "wcb-drag-handle",
															"aria-hidden": "true",
															children: "⠿"
														}),
														i > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															type: "checkbox",
															className: "wcb-checkbox",
															checked: selected,
															"aria-label": tt("selectDir"),
															onChange: () => state.toggleDirSelected(d.path)
														}) : null,
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "wcb-star" + (i === 0 ? "" : " wcb-star-off"),
															title: i === 0 ? tt("primaryProject") : "",
															"aria-hidden": "true",
															children: "★"
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: sq.cls,
															"aria-hidden": "true",
															children: sq.letter
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															className: "wcb-dir-info",
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																	className: "wcb-dir-name-row",
																	children: [
																		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																			className: "wcb-dir-name",
																			title: d.name,
																			children: d.name
																		}),
																		i === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DocOnlyBadge, {}) : null,
																		/* @__PURE__ */ (0, react_jsx_runtime.jsx)(GitBadge, { status: state.gitStatuses[d.path] }),
																		i > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CodeBadge, {}) : null
																	]
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																	className: "wcb-dir-path",
																	title: d.path,
																	children: d.path
																}),
																editingNotePath === d.path ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																	className: "wcb-dir-note-input",
																	autoFocus: true,
																	value: d.note ?? "",
																	placeholder: tt("notePlaceholder"),
																	"aria-label": tt("notePlaceholder"),
																	onClick: (event) => event.stopPropagation(),
																	onChange: (event) => state.setDirectoryNote(d.path, event.currentTarget.value),
																	onBlur: () => setEditingNotePath(null),
																	onKeyDown: (event) => {
																		if (event.key === "Enter") {
																			event.preventDefault();
																			state.setDirectoryNote(d.path, event.currentTarget.value);
																			setEditingNotePath(null);
																		} else if (event.key === "Escape") {
																			event.preventDefault();
																			setEditingNotePath(null);
																		}
																	}
																}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																	className: "wcb-dir-note",
																	title: d.note ?? tt("addNote"),
																	role: "button",
																	tabIndex: 0,
																	"aria-label": tt("addNote"),
																	onClick: (event) => {
																		event.stopPropagation();
																		setEditingNotePath(d.path);
																	},
																	onKeyDown: (event) => {
																		if (event.key === "Enter" || event.key === " ") {
																			event.preventDefault();
																			setEditingNotePath(d.path);
																		}
																	},
																	children: d.note !== void 0 && d.note !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: "wcb-dir-note-icon",
																		"aria-hidden": "true",
																		children: "📝"
																	}), d.note] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: "wcb-dir-note-add",
																		children: tt("addNote")
																	})
																})
															]
														}),
														missing ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "wcb-warn-icon",
															title: tt("dirMissing"),
															role: "img",
															"aria-label": tt("dirMissing"),
															children: "⚠"
														}) : null,
														i > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
															className: "wcb-cap wcb-cap-other",
															style: {
																border: "none",
																font: "inherit",
																fontSize: "9.5px",
																cursor: "pointer"
															},
															value: group === "" ? "" : group,
															"aria-label": tt("groupHint"),
															onChange: (event) => state.setDirectoryGroup(d.path, event.currentTarget.value),
															onDragStart: (event) => event.stopPropagation(),
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: "",
																	children: tt("groupNone")
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: tt("groupDoc"),
																	children: tt("groupDoc")
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: tt("groupBackend"),
																	children: tt("groupBackend")
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: tt("groupFrontend"),
																	children: tt("groupFrontend")
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: tt("groupRef"),
																	children: tt("groupRef")
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: tt("groupOther"),
																	children: tt("groupOther")
																})
															]
														}) : null,
														i > 0 && group !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: GROUP_CLASS[group] ?? "wcb-cap-other",
															"aria-hidden": "true",
															children: group
														}) : null,
														i === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: ACCESS_CLASS.readwrite,
															title: tt("primaryAccessFixed"),
															children: tt("accessReadwrite")
														}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
															className: ACCESS_CLASS[access].replace("wcb-cap ", "wcb-cap "),
															style: {
																border: "none",
																font: "inherit",
																fontSize: "9.5px",
																cursor: "pointer"
															},
															value: access,
															"aria-label": tt("accessHint"),
															onChange: (event) => state.setDirectoryAccess(d.path, event.currentTarget.value),
															onDragStart: (event) => event.stopPropagation(),
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: "readwrite",
																	children: tt("accessReadwrite")
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: "readonly",
																	children: tt("accessReadonly")
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: "disabled",
																	children: tt("accessDisabled")
																})
															]
														}),
														i > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "wcb-remove",
															title: tt("removeDirectory"),
															"aria-label": tt("removeDirectory"),
															onClick: () => state.removeDirectory(d.path),
															children: "✕"
														}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															style: { width: 20 },
															"aria-hidden": "true"
														})
													]
												}, d.path);
											})
										}),
										state.selectedDirs.size > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "wcb-bulk",
											role: "toolbar",
											"aria-label": tt("bulkSelected", { n: state.selectedDirs.size }),
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "wcb-bulk-row",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "wcb-bulk-count",
														children: tt("bulkSelected", { n: state.selectedDirs.size })
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "wcb-btn",
														"aria-label": tt("bulkClear"),
														onClick: state.clearDirSelection,
														children: tt("bulkClear")
													})]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "wcb-bulk-row",
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "wcb-label",
															style: { margin: 0 },
															children: tt("bulkAccess")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "wcb-btn",
															"aria-label": tt("accessReadwrite"),
															onClick: () => state.bulkSetAccess("readwrite"),
															children: tt("accessReadwrite")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "wcb-btn",
															"aria-label": tt("accessReadonly"),
															onClick: () => state.bulkSetAccess("readonly"),
															children: tt("accessReadonly")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "wcb-btn",
															"aria-label": tt("accessDisabled"),
															onClick: () => state.bulkSetAccess("disabled"),
															children: tt("accessDisabled")
														})
													]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "wcb-bulk-row",
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "wcb-label",
															style: { margin: 0 },
															children: tt("bulkGroup")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
															className: "wcb-input",
															style: {
																flex: "none",
																width: 110
															},
															"aria-label": tt("bulkGroup"),
															value: "",
															onChange: (event) => {
																state.bulkSetGroup(event.currentTarget.value);
																event.currentTarget.value = "";
															},
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: "",
																	children: tt("groupNone")
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: tt("groupDoc"),
																	children: tt("groupDoc")
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: tt("groupBackend"),
																	children: tt("groupBackend")
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: tt("groupFrontend"),
																	children: tt("groupFrontend")
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: tt("groupRef"),
																	children: tt("groupRef")
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																	value: tt("groupOther"),
																	children: tt("groupOther")
																})
															]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "wcb-btn-danger",
															"aria-label": tt("bulkDelete"),
															onClick: state.bulkRemove,
															children: tt("bulkDelete")
														})
													]
												})
											]
										}) : null,
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "wcb-hint",
											children: tt("primaryHint")
										})
									]
								}) : null]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								className: "wcb-card wcb-codeindex-card",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wcb-card-head",
									children: [tt("codeIndexTitle"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "wcb-head-actions",
										children: [
											state.codeIndexEnabled && state.codeEntries.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												className: "wcb-search",
												value: ciQuery,
												placeholder: tt("codeIndexSearch"),
												"aria-label": tt("codeIndexSearch"),
												onChange: (event) => setCiQuery(event.currentTarget.value)
											}) : null,
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: "wcb-label",
												style: {
													margin: 0,
													display: "flex",
													alignItems: "center",
													gap: 4
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "checkbox",
													checked: state.codeIndexEnabled,
													"aria-label": tt("codeIndexToggle"),
													onChange: (event) => state.setCodeIndexEnabled(event.currentTarget.checked)
												}), tt("codeIndexToggle")]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wcb-label",
												style: { margin: 0 },
												children: tt("codeIndexBudget")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												className: "wcb-budget-input",
												type: "number",
												min: 1,
												value: state.codeIndexBudget,
												disabled: !state.codeIndexEnabled,
												"aria-label": tt("codeIndexBudget"),
												onChange: (event) => state.setCodeIndexBudget(Number(event.currentTarget.value))
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "wcb-label",
												style: { margin: 0 },
												children: tt("codeIndexSummaryLabel")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
												className: "wcb-input",
												style: { width: "auto" },
												value: state.codeIndexSummary,
												disabled: !state.codeIndexEnabled,
												"aria-label": tt("codeIndexSummaryLabel"),
												onChange: (event) => state.setCodeIndexSummary(event.currentTarget.value === "llm" ? "llm" : "off"),
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "off",
													children: tt("codeIndexSummaryOff")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "llm",
													children: tt("codeIndexSummaryLlm")
												})]
											})
										]
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wcb-card-body",
									children: [!state.codeIndexEnabled || state.codeEntries.length === 0 || codeEntriesFiltered.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "wcb-hint",
										children: tt("codeIndexEmpty")
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										style: {
											display: "flex",
											flexDirection: "column",
											gap: 3
										},
										children: codeEntriesFiltered.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											role: "button",
											tabIndex: 0,
											title: tt("codeIndexCopy"),
											onClick: () => state.copyText("@" + entry.feature),
											onKeyDown: (event) => {
												if (event.key === "Enter" || event.key === " ") {
													event.preventDefault();
													state.copyText("@" + entry.feature);
												}
											},
											style: {
												display: "flex",
												gap: 6,
												alignItems: "baseline",
												fontSize: 10,
												cursor: "pointer",
												padding: "2px 5px",
												borderRadius: 4,
												background: "var(--wcb-surface)"
											},
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: {
														color: "var(--wcb-purple)",
														fontWeight: 600,
														flex: "none"
													},
													children: "@" + entry.feature
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: {
														color: "var(--wcb-text2)",
														flex: "none",
														fontFamily: "var(--ds-font-family-code,monospace)"
													},
													children: entry.endpoint
												}),
												entry.server !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: {
														color: "var(--wcb-muted)",
														flex: "none"
													},
													children: tt("codeIndexServer") + " " + entry.server.file + ":" + entry.server.line
												}) : null,
												entry.client !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: {
														color: "var(--wcb-muted)",
														flex: "none"
													},
													children: tt("codeIndexClient") + " " + entry.client.file + ":" + entry.client.line
												}) : null,
												entry.summary !== void 0 && entry.summary !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: {
														color: "var(--wcb-dim)",
														overflow: "hidden",
														textOverflow: "ellipsis",
														whiteSpace: "nowrap"
													},
													children: entry.summary
												}) : null
											]
										}, entry.feature + "|" + entry.endpoint))
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "wcb-hint",
										style: { marginTop: 5 },
										children: [tt("codeIndexHint"), state.codeIndexSummary === "llm" ? " · " + tt("codeIndexSummaryHint") : ""]
									})]
								})]
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "wcb-legend-row",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wcb-legend",
							children: [
								["#5dd8a3", tt("legendReadwrite")],
								["#d2a8ff", tt("legendReadonly")],
								["#8b949e", tt("legendDisabled")]
							].map(([color, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "wcb-legend-item",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "wcb-legend-dot",
									style: { background: color },
									"aria-hidden": "true"
								}), label]
							}, label))
						}), dirCount > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wcb-sandbox",
							title: tt("sandboxTitle", { cur: sandboxCount }),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "wcb-sandbox-dot",
								"aria-hidden": "true"
							}), "🔒 " + tt("sandboxSynced", {
								cur: sandboxCount,
								total: dirCount
							})]
						}) : null]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wcb-toast-stack",
						children: state.toasts.map((t) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "wcb-toast " + (t.kind === "error" ? "wcb-toast-error" : "wcb-toast-ok"),
							role: "status",
							onClick: () => state.dismissToast(t.id),
							children: t.text
						}, t.id))
					}),
					cmdkOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "wcb-cmdk-overlay",
						onClick: () => setCmdkOpen(false),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wcb-cmdk",
							role: "dialog",
							"aria-modal": "true",
							"aria-label": tt("cmdkTitle"),
							onClick: (event) => event.stopPropagation(),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "wcb-cmdk-input",
									autoFocus: true,
									value: cmdkQuery,
									placeholder: tt("cmdkPlaceholder"),
									"aria-label": tt("cmdkPlaceholder"),
									onChange: (event) => {
										setCmdkQuery(event.currentTarget.value);
										setCmdkIndex(0);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
									className: "wcb-cmdk-list",
									children: cmdkFiltered.map((c, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
										className: "wcb-cmdk-item" + (i === cmdkIndex ? " wcb-cmdk-on" : ""),
										role: "option",
										"aria-selected": i === cmdkIndex,
										onMouseEnter: () => setCmdkIndex(i),
										onClick: () => {
											c.run();
											setCmdkOpen(false);
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: c.label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "wcb-cmdk-kind",
											children: c.kind
										})]
									}, c.id))
								}),
								cmdkFiltered.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "wcb-cmdk-empty",
									children: tt("cmdkEmpty")
								}) : null
							]
						})
					}) : null,
					wizardOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NewWorkspaceWizard, {
						pickDirectory,
						onClose: () => setWizardOpen(false),
						onCreate: (name, basePath, directories, mode) => {
							state.createWorkspace(name, basePath, directories, mode);
							setWizardOpen(false);
						}
					}) : null,
					renameTarget !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RenameWorkspaceModal, {
						ws: renameTarget,
						onClose: () => setRenameTarget(null),
						onConfirm: (name) => {
							state.renameWorkspace(renameTarget.id, name);
							setRenameTarget(null);
						}
					}) : null,
					deleteTarget !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DeleteWorkspaceModal, {
						ws: deleteTarget,
						onClose: () => setDeleteTarget(null),
						onConfirm: () => {
							state.deleteWorkspace(deleteTarget.id);
							setDeleteTarget(null);
						}
					}) : null,
					advOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AdvancedModal, {
						state,
						currentWs,
						onClose: () => setAdvOpen(false)
					}) : null,
					state.previewOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PreviewModal, {
						text: state.previewText,
						loading: state.previewLoading,
						onCopy: state.copyPreview,
						onClose: () => state.setPreviewOpen(false)
					}) : null,
					budgetOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BudgetModal, {
						stats: state.contextStats,
						budget: state.tokenBudget,
						dirs: state.dirs,
						onBudget: state.setTokenBudget,
						onRefresh: state.refreshContextStats,
						onClose: () => setBudgetOpen(false)
					}) : null,
					standardsOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StandardsModal, {
						standards: state.workspaceStandards ?? {},
						library: state.standardsLibrary,
						directories: state.dirs,
						onSaveWorkspace: state.setWorkspaceStandards,
						onSaveLibrary: state.saveStandardsLibrary,
						onGenerateDraft: state.generateStandard,
						onClose: () => setStandardsOpen(false)
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** 本插件拥有的 locale 命名空间。 */
		const NS = "dsh-workspace-combiner";
		/** client fiber 需要的服务（slots 插槽、locale 词典、sessions 新建会话、workspaces get-or-create、remote.directoryPicker 选目录）。 */
		const inject = [
			"slots",
			"locale",
			"sessions",
			"workspaces",
			"remote",
			"remote.directoryPicker"
		];
		/**
		* 挂载词典 + 侧边栏图标 + 中心列面板。
		* @param ctx - client 根上下文（slots / locale / sessions / remote）。
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-workspace-combiner: dictionaries");
			const takenTitles = () => {
				const set = /* @__PURE__ */ new Set();
				try {
					const snapshot = ctx.sessions.list.getSnapshot();
					for (const id of snapshot.ids) {
						const title = snapshot.byId[id]?.title;
						if (typeof title === "string" && title !== "") set.add(title);
					}
				} catch {}
				return set;
			};
			const dedupeTitle = (name) => {
				const taken = takenTitles();
				if (!taken.has(name)) return name;
				let i = 2;
				while (taken.has(`${name} (${i})`)) i++;
				return `${name} (${i})`;
			};
			const startSession = async (mainDirPath, title) => {
				const workspace = await ctx.workspaces.create({ path: mainDirPath });
				const sessionId = await ctx.sessions.create({ workspaceId: workspace.workspaceId });
				const name = title?.trim();
				if (name !== void 0 && name !== "") {
					const finalName = dedupeTitle(name);
					const binding = ctx.sessions.binding(sessionId);
					if (binding !== void 0) {
						const renamed = await binding.session.rename(finalName).catch(() => void 0);
						if (renamed !== void 0 && !renamed.ok) console.warn(`[dsh-workspace-combiner] 会话改名失败: ${sessionId}`);
					}
				}
				ctx.sessions.open(sessionId);
				return sessionId;
			};
			const pickDirectory = async () => {
				const result = await ctx.remote.directoryPicker.pick();
				if (!result.ok) throw new Error(result.error.message);
				return result.value;
			};
			const registerDshWorkspace = async (path) => {
				if (path === "") return;
				await ctx.workspaces.create({ path }).catch(() => {});
			};
			ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
				name: "sidebar.panellist",
				id: PANEL_ID,
				order: 100,
				label: () => "工作区组合器"
			}, WorkspaceCombinerIcon));
			const sessionCount = () => {
				try {
					return ctx.sessions.list.getSnapshot().ids.length;
				} catch {
					return 0;
				}
			};
			ctx.slots.inject("main", () => ctx.slots.register({
				name: "main",
				key: PANEL_ID
			}, () => WorkspaceCombinerPanel({
				startSession,
				pickDirectory,
				registerDshWorkspace,
				sessionCount: sessionCount()
			})));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map