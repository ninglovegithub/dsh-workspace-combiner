import { chmod, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
//#region src/invariant.ts
/**
* 双面共享的不变量：插件身份、API 路径、面板 id、prompt 排序、沙盒联动常量。
* 本文件必须平台无关（client bundle 也编译它），禁止任何 node 依赖。
* @module dsh-workspace-combiner/invariant
*/
/** npm 包名 / cordis 编排行 id（package.json 的 name 与 cordis.patch.yml 的 name）。 */
const PLUGIN_ID = "dsh-workspace-combiner";
/** system prompt 分节名（全局唯一，供 agent preset 等按名 shadow）。 */
const SECTION_NAME = "plugin:dsh-workspace-combiner";
/** 默认工作空间名（新建向导未命名时的兜底；host 建目录 / client 查重共用）。 */
const DEFAULT_WORKSPACE_NAME = "未命名工作空间";
/** 宿主持久化文件名（相对 $DSH_HOME / ~/.dsh）。 */
const STORE_FILE = "dsh-workspace-combiner.json";
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
/** sandbox-extra-roots 的配置目录名（相对 $DSH_HOME/plugins）。 */
const SANDBOX_PLUGIN_NAME = "sandbox-extra-roots";
/** sandbox-extra-roots 暴露给 host 的 typert 远程服务键（PluginConfigGateway）。 */
const SANDBOX_REMOTE_SERVICE = "sandboxExtraRootsConfig";
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
//#region src/host/projectDetector.ts
/**
* 宿主目录扫描：从给定根目录向下（最多 2 层）识别代码项目，用于新建工作空间
* 向导第二步「自动识别项目」。识别依据：package.json（vue / react / 前端）、
* pom.xml / gradle（Java）、requirements.txt / pyproject.toml / setup.py（Python）、
* go.mod（Go）、≥3 个源码文件（通用代码项目）。
* @module dsh-workspace-combiner/host/projectDetector
*/
/** 最大扫描深度（根 = 0，向下到第 2 层子目录）。 */
const MAX_SCAN_DEPTH = 2;
/** 最多访问目录数（防失控）。 */
const MAX_VISITED_DIRS = 256;
/** 视为「代码文件」的扩展名（命中 ≥3 个即判为通用代码项目）。 */
const CODE_EXTENSIONS$1 = /* @__PURE__ */ new Set([
	".java",
	".js",
	".jsx",
	".ts",
	".tsx",
	".vue",
	".py",
	".go",
	".rs",
	".c",
	".cc",
	".cpp",
	".h",
	".hpp",
	".cs",
	".rb",
	".php",
	".kt",
	".scala",
	".swift"
]);
/** 读 package.json 的 dependencies/devDependencies 键名（失败返回空）。 */
async function readPackageDeps(dir) {
	try {
		const raw = await readFile(join(dir, "package.json"), "utf8");
		const pkg = JSON.parse(raw);
		return Object.keys({
			...pkg.dependencies,
			...pkg.devDependencies
		});
	} catch {
		return [];
	}
}
/** 依据目录项识别项目类型（none 表示不是项目根）。 */
async function detectType(dir, entries) {
	const names = new Set(entries);
	if (names.has("pom.xml") || names.has("build.gradle") || names.has("build.gradle.kts") || names.has("settings.gradle")) return "java";
	if (names.has("go.mod")) return "go";
	if (names.has("requirements.txt") || names.has("pyproject.toml") || names.has("setup.py")) return "python";
	if (names.has("package.json")) {
		const deps = await readPackageDeps(dir);
		if (deps.includes("next")) return "frontend-next";
		if (deps.includes("vue")) return "frontend-vue";
		if (deps.includes("react") || deps.includes("react-dom")) return "frontend-react";
		if (deps.includes("webpack")) return "frontend-webpack";
		return "frontend";
	}
	return entries.filter((e) => {
		const dot = e.lastIndexOf(".");
		return dot > 0 && CODE_EXTENSIONS$1.has(e.slice(dot).toLowerCase());
	}).length >= 3 ? "generic" : "none";
}
/** 项目识别依据描述（hover 提示用）。 */
function evidenceFor(type) {
	switch (type) {
		case "java": return "pom.xml / build.gradle";
		case "go": return "go.mod";
		case "python": return "requirements.txt / pyproject.toml";
		case "frontend-vue": return "package.json + vue";
		case "frontend-react": return "package.json + react";
		case "frontend-webpack": return "package.json + webpack";
		case "frontend-next": return "package.json + next";
		case "frontend": return "package.json";
		case "generic": return "源码文件";
		case "none": return "";
	}
}
/** 从根目录向下扫描（最多 2 层），返回识别到的项目列表。 */
async function scanDirectory(root) {
	const found = [];
	let visited = 0;
	const walk = async (dir, depth) => {
		if (depth > MAX_SCAN_DEPTH || visited >= MAX_VISITED_DIRS) return;
		visited++;
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}
		const type = await detectType(dir, entries.map((e) => e.name));
		if (type !== "none") {
			found.push({
				root: dir,
				name: basename(dir),
				type,
				evidence: evidenceFor(type)
			});
			return;
		}
		if (depth >= MAX_SCAN_DEPTH) return;
		for (const entry of entries) {
			if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue;
			await walk(join(dir, entry.name), depth + 1);
		}
	};
	await walk(root, 0);
	return found;
}
//#endregion
//#region src/host/fileIndex.ts
/**
* 文件索引地基：gitignore 过滤 + 有界文件树扫描 + mtime 缓存。
* 供「目录树加载模式」「@指令文件解析」「上下文监控面板」复用。
* @module dsh-workspace-combiner/host/fileIndex
*/
/** 内置默认忽略（gitignore 之外兜底）：VCS、依赖、构建产物与常见工具缓存。 */
const DEFAULT_IGNORES = [
	".git",
	"node_modules",
	"dist",
	"build",
	"coverage",
	".DS_Store",
	".pnpm-store",
	".next",
	".nuxt",
	".turbo",
	".venv",
	"__pycache__",
	".gradle"
];
/** 需要转义的正则特殊字符。 */
const REGEX_SPECIALS = /* @__PURE__ */ new Set([
	".",
	"+",
	"^",
	"$",
	"(",
	")",
	"[",
	"]",
	"{",
	"}",
	"|",
	"\\"
]);
/** 把 gitignore 风格 glob 片段转成正则片段（简化子集）。 */
function globToRegex(glob) {
	let re = "";
	let i = 0;
	while (i < glob.length) {
		const ch = glob[i];
		if (ch === "*" && glob[i + 1] === "*") if (glob[i + 2] === "/") {
			re += "(?:[^/]+/)*";
			i += 3;
		} else {
			re += ".*";
			i += 2;
		}
		else if (ch === "*") {
			re += "[^/]*";
			i++;
		} else if (ch === "?") {
			re += "[^/]";
			i++;
		} else if (REGEX_SPECIALS.has(ch)) {
			re += "\\" + ch;
			i++;
		} else {
			re += ch;
			i++;
		}
	}
	return re;
}
/** 解析 .gitignore 内容为匹配正则（简化：忽略 ! 取反、目录锚定等高级语法）。 */
function parseGitignore(content) {
	const patterns = [];
	for (const raw of content.split("\n")) {
		const line = raw.trim();
		if (line === "" || line.startsWith("#")) continue;
		if (line.startsWith("!")) continue;
		let p = line.replace(/\/+$/, "");
		if (p === "") continue;
		if (!p.includes("/")) p = "**/" + p;
		else if (!p.startsWith("/") && !p.startsWith("**")) p = "**/" + p;
		if (p.startsWith("/")) p = p.slice(1);
		patterns.push(new RegExp("^" + globToRegex(p) + "(/.*)?$"));
	}
	return patterns;
}
/** 判断相对路径（'/' 分隔）是否应忽略。 */
function isIgnored(relPath, isDir, patterns) {
	for (const part of relPath.split("/")) if (DEFAULT_IGNORES.includes(part)) return true;
	for (const re of patterns) {
		if (re.test(relPath)) return true;
		if (isDir && re.test(relPath + "/")) return true;
	}
	return false;
}
/** 读取 root/.gitignore（缺失返回空）。同时供代码索引复用同一套忽略规则。 */
async function loadGitignore(root) {
	try {
		return parseGitignore(await readFile(join(root, ".gitignore"), "utf8"));
	} catch {
		return [];
	}
}
/** 同级目录并发度（防止宽目录一次打开过多 fd）。 */
const DIR_CONCURRENCY = 8;
/** 有界并发映射（保序），用于同级目录并行下钻。 */
async function mapLimit(items, limit, fn) {
	const results = new Array(items.length);
	let next = 0;
	const worker = async () => {
		for (;;) {
			const index = next++;
			if (index >= items.length) return;
			results[index] = await fn(items[index]);
		}
	};
	await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
	return results;
}
/** 有界递归扫描，构建文件树（过滤 gitignore + 默认忽略）。 */
async function buildFileTree(root, options = {}) {
	const maxDepth = options.maxDepth ?? 4;
	const maxFiles = options.maxFiles ?? 500;
	const patterns = await loadGitignore(root);
	let fileCount = 0;
	async function walk(dir, depth) {
		if (depth > maxDepth || fileCount >= maxFiles) return [];
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			return [];
		}
		entries.sort((a, b) => a.name.localeCompare(b.name));
		const nodes = [];
		const subdirs = [];
		for (const ent of entries) {
			if (fileCount >= maxFiles) break;
			const rel = relative(root, join(dir, ent.name)).split(sep).join("/");
			if (isIgnored(rel, ent.isDirectory(), patterns)) continue;
			if (ent.isDirectory()) subdirs.push({
				name: ent.name,
				rel
			});
			else {
				fileCount++;
				nodes.push({
					name: ent.name,
					path: rel,
					type: "file"
				});
			}
		}
		const children = await mapLimit(subdirs, DIR_CONCURRENCY, async (sub) => ({
			name: sub.name,
			rel: sub.rel,
			nodes: await walk(join(dir, sub.name), depth + 1)
		}));
		for (const child of children) nodes.push({
			name: child.name,
			path: child.rel,
			type: "dir",
			children: child.nodes
		});
		return nodes;
	}
	return await walk(root, 1);
}
/**
* 递归计数（不建树）：gitignore + 默认忽略，供摘要与监控显示真实体量。
* 与 buildFileTree 不同，这里不受 maxDepth 限制，只受 maxFiles 上限保护。
*/
async function countTree(root, options = {}) {
	const maxFiles = options.maxFiles ?? 2e4;
	const patterns = await loadGitignore(root);
	let files = 0;
	let dirs = 0;
	let truncated = false;
	const walk = async (dir) => {
		if (files >= maxFiles) {
			truncated = true;
			return;
		}
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}
		const subdirs = [];
		for (const ent of entries) {
			if (files >= maxFiles) {
				truncated = true;
				return;
			}
			if (isIgnored(relative(root, join(dir, ent.name)).split(sep).join("/"), ent.isDirectory(), patterns)) continue;
			if (ent.isDirectory()) {
				dirs++;
				subdirs.push(join(dir, ent.name));
			} else files++;
		}
		await mapLimit(subdirs, DIR_CONCURRENCY, async (sub) => {
			await walk(sub);
		});
	};
	await walk(root);
	return {
		files,
		dirs,
		truncated
	};
}
/** mtime + TTL 缓存：根目录 mtime 未变且未过期则复用上次索引。 */
var FileIndexCache = class FileIndexCache {
	/** 缓存有效期：深层增删不改根目录 mtime，用 TTL 兜住系统性陈旧。 */
	static TTL_MS = 3e4;
	cache = /* @__PURE__ */ new Map();
	countCache = /* @__PURE__ */ new Map();
	async get(root, options) {
		const maxDepth = options?.maxDepth ?? 4;
		const maxFiles = options?.maxFiles ?? 500;
		const key = root + "#" + maxDepth + "#" + maxFiles;
		let mtime = 0;
		try {
			mtime = (await stat(root)).mtimeMs;
		} catch {
			return [];
		}
		const hit = this.cache.get(key);
		if (hit !== void 0 && hit.mtime === mtime && Date.now() - hit.at < FileIndexCache.TTL_MS) return hit.tree;
		const tree = await buildFileTree(root, {
			maxDepth,
			maxFiles
		});
		this.cache.set(key, {
			mtime,
			at: Date.now(),
			tree
		});
		return tree;
	}
	/** 递归计数（走独立计数缓存，与文件树缓存互不干扰）。 */
	async count(root, options) {
		const maxFiles = options?.maxFiles ?? 2e4;
		const key = root + "#count#" + maxFiles;
		let mtime = 0;
		try {
			mtime = (await stat(root)).mtimeMs;
		} catch {
			return {
				files: 0,
				dirs: 0,
				truncated: false
			};
		}
		const hit = this.countCache.get(key);
		if (hit !== void 0 && hit.mtime === mtime && Date.now() - hit.at < FileIndexCache.TTL_MS) return hit.value;
		const value = await countTree(root, { maxFiles });
		this.countCache.set(key, {
			mtime,
			at: Date.now(),
			value
		});
		return value;
	}
	clear() {
		this.cache.clear();
		this.countCache.clear();
	}
};
//#endregion
//#region src/core/types.ts
/** 加载模式对应的文件树最大扫描深度（summary 只需计数，深度 1 足够）。 */
function loadModeMaxDepth(loadMode) {
	return loadMode === "full" ? 4 : loadMode === "tree" ? 3 : 1;
}
/** 无内容的空存储快照（加载器会兜底补一个默认工作空间）。 */
function emptyStore() {
	return {
		version: 2,
		currentWorkspaceId: "",
		workspaces: []
	};
}
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
/** 校验一条自建规范（host 落盘与 client 请求体共用）。 */
function parseCustomStandard(raw) {
	if (raw === null || typeof raw !== "object") return void 0;
	const item = raw;
	if (typeof item.id !== "string" || item.id === "" || typeof item.name !== "string" || typeof item.body !== "string") return void 0;
	return {
		id: item.id,
		name: item.name,
		tech: typeof item.tech === "string" && item.tech !== "" ? item.tech : "自定义",
		summary: typeof item.summary === "string" ? item.summary : "",
		body: item.body
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
//#region src/core/validate.ts
/** 校验并规范化一条目录项；缺 id/name/path 等必填字段时返回 undefined。 */
function parseWorkspaceRef(raw) {
	if (raw === null || typeof raw !== "object") return void 0;
	const ref = raw;
	if (typeof ref.id !== "string" || typeof ref.name !== "string" || typeof ref.path !== "string") return void 0;
	return {
		id: ref.id,
		name: ref.name,
		path: ref.path,
		...typeof ref.projectType === "string" ? { projectType: ref.projectType } : {},
		...typeof ref.evidence === "string" ? { evidence: ref.evidence } : {},
		...typeof ref.isPrimary === "boolean" ? { isPrimary: ref.isPrimary } : {},
		...ref.access === "readwrite" || ref.access === "readonly" || ref.access === "disabled" ? { access: ref.access } : {},
		...typeof ref.group === "string" && ref.group !== "" ? { group: ref.group } : {},
		...typeof ref.note === "string" && ref.note !== "" ? { note: ref.note } : {}
	};
}
/** 校验目录项数组：任一项非法则整体返回 undefined（请求体语义：宁可拒绝也不半接受）。 */
function parseWorkspaceRefs(raw) {
	if (!Array.isArray(raw)) return void 0;
	const out = [];
	for (const item of raw) {
		const ref = parseWorkspaceRef(item);
		if (ref === void 0) return void 0;
		out.push(ref);
	}
	return out;
}
//#endregion
//#region src/store.ts
/**
* 宿主持久化存储：~/.dsh/dsh-workspace-combiner.json（或 $DSH_HOME 覆盖），
* 保存「自定义工作空间」。GUI 与 host 共享同一份数据。
*
* 持久化纪律（与 dsh-multi-root 一致）：目录 0700、文件 0600、临时文件 +
* rename 原子替换，所有变更串行化到一条 promise 链，缺失/损坏时退化为空
* （工作空间是可重建状态，不是机密）。
* @module dsh-workspace-combiner/store
*/
/** 与 harness 的 DSH_HOME 约定一致：默认 ~/.dsh，可用 $DSH_HOME 覆盖。 */
function dshHome() {
	const override = process.env.DSH_HOME?.trim();
	return override ? resolve(override) : join(homedir(), ".dsh");
}
/** 默认存储文件路径（测试可注入其它路径）。 */
function defaultStoreFile() {
	return join(dshHome(), STORE_FILE);
}
/**
* 目录列表的唯一事实来源是数组顺序：第一项就是主目录。把历史字段也随之
* 规范化，避免拖拽重排后 isPrimary / access 仍留在旧主目录上，导致持久化
* 数据与实际建会话目录、沙盒白名单相互矛盾。
*/
function normalizeDirectories(directories) {
	return directories.map((directory, index) => {
		if (index === 0) return {
			...directory,
			isPrimary: true,
			access: "readwrite"
		};
		const { isPrimary: _isPrimary, ...secondary } = directory;
		return secondary;
	});
}
/** 校验并规范化一条快照。 */
function parseSnapshot(raw) {
	if (raw === null || typeof raw !== "object") return void 0;
	const s = raw;
	if (typeof s.id !== "string" || typeof s.name !== "string") return void 0;
	const dirs = Array.isArray(s.directories) ? s.directories.map(parseWorkspaceRef).filter((r) => r !== void 0) : [];
	return {
		id: s.id,
		name: s.name,
		directories: dirs,
		createdAt: typeof s.createdAt === "number" ? s.createdAt : Date.now()
	};
}
/** 校验并规范化工作空间级的规范绑定。 */
function parseStandards(raw) {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return void 0;
	const record = raw;
	const asIds = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string" && item !== "") : [];
	const global = asIds(record.global);
	const perDirectory = {};
	if (record.perDirectory !== null && typeof record.perDirectory === "object" && !Array.isArray(record.perDirectory)) for (const [key, value] of Object.entries(record.perDirectory)) {
		const ids = asIds(value);
		if (ids.length > 0) perDirectory[key] = ids;
	}
	const workspaceOverrides = {};
	if (record.workspaceOverrides !== null && typeof record.workspaceOverrides === "object" && !Array.isArray(record.workspaceOverrides)) {
		for (const [key, value] of Object.entries(record.workspaceOverrides)) if (typeof value === "string" && value.trim() !== "") workspaceOverrides[key] = value;
	}
	const workspaceCustom = Array.isArray(record.workspaceCustom) ? record.workspaceCustom.map(parseCustomStandard).filter((item) => item !== void 0) : [];
	const result = {
		...global.length > 0 ? { global } : {},
		...Object.keys(perDirectory).length > 0 ? { perDirectory } : {},
		...workspaceCustom.length > 0 ? { workspaceCustom } : {},
		...Object.keys(workspaceOverrides).length > 0 ? { workspaceOverrides } : {},
		...typeof record.budget === "number" && Number.isFinite(record.budget) && record.budget > 0 ? { budget: Math.round(record.budget) } : {},
		...typeof record.autoMatch === "boolean" ? { autoMatch: record.autoMatch } : {}
	};
	return Object.keys(result).length > 0 ? result : void 0;
}
/** 校验并规范化一个 Workspace。 */
function parseWorkspace(raw) {
	if (raw === null || typeof raw !== "object") return void 0;
	const ws = raw;
	if (typeof ws.id !== "string" || typeof ws.name !== "string") return void 0;
	const dirs = Array.isArray(ws.directories) ? ws.directories.map(parseWorkspaceRef).filter((r) => r !== void 0) : [];
	return {
		id: ws.id,
		name: ws.name,
		...typeof ws.remark === "string" && ws.remark !== "" ? { remark: ws.remark } : {},
		directories: normalizeDirectories(dirs),
		createdAt: typeof ws.createdAt === "number" ? ws.createdAt : Date.now(),
		updatedAt: typeof ws.updatedAt === "number" ? ws.updatedAt : Date.now(),
		...typeof ws.lastSessionAt === "number" ? { lastSessionAt: ws.lastSessionAt } : {},
		...ws.mode === "anchor" || ws.mode === "single" ? { mode: ws.mode } : {},
		...ws.loadMode === "full" || ws.loadMode === "summary" || ws.loadMode === "tree" ? { loadMode: ws.loadMode } : {},
		...Array.isArray(ws.snapshots) ? { snapshots: ws.snapshots.map(parseSnapshot).filter((s) => s !== void 0) } : {},
		...typeof ws.tokenBudget === "number" && Number.isFinite(ws.tokenBudget) && ws.tokenBudget > 0 ? { tokenBudget: Math.round(ws.tokenBudget) } : {},
		...typeof ws.pinned === "boolean" ? { pinned: ws.pinned } : {},
		...typeof ws.color === "string" && ws.color !== "" ? { color: ws.color } : {},
		...typeof ws.codeIndexEnabled === "boolean" ? { codeIndexEnabled: ws.codeIndexEnabled } : {},
		...typeof ws.codeIndexBudget === "number" && Number.isFinite(ws.codeIndexBudget) && ws.codeIndexBudget > 0 ? { codeIndexBudget: Math.round(ws.codeIndexBudget) } : {},
		...ws.codeIndexSummary === "off" || ws.codeIndexSummary === "llm" ? { codeIndexSummary: ws.codeIndexSummary } : {},
		...parseStandards(ws.standards) !== void 0 ? { standards: parseStandards(ws.standards) } : {}
	};
}
/** 构造一个默认工作空间（全新安装 / 迁移 / 兜底）。 */
function makeDefaultWorkspace(directories = []) {
	const now = Date.now();
	return {
		id: randomUUID(),
		name: "默认工作空间",
		directories: [...directories],
		createdAt: now,
		updatedAt: now
	};
}
/**
* 持久化存储：构造时一次性加载，所有公开方法先 await readiness，
* 避免慢磁盘与早到调用产生竞态。
*/
var WorkspaceCombinerStore = class {
	file;
	shape = emptyStore();
	ready;
	chain = Promise.resolve();
	constructor(file = defaultStoreFile()) {
		this.file = file;
		this.ready = this.load();
	}
	/** 全量状态快照（工作空间 + 当前激活 id + 模板）。 */
	async getState() {
		await this.ready;
		return this.shape;
	}
	/** 全部自定义工作空间。 */
	async getWorkspaces() {
		await this.ready;
		return this.shape.workspaces;
	}
	/** 当前激活的工作空间 id。 */
	async getCurrentWorkspaceId() {
		await this.ready;
		return this.shape.currentWorkspaceId;
	}
	/** 当前激活的工作空间（不存在则 undefined）。 */
	async getCurrentWorkspace() {
		await this.ready;
		return this.shape.workspaces.find((w) => w.id === this.shape.currentWorkspaceId);
	}
	/** 新建工作空间并切换为当前。 */
	async createWorkspace(name, remark, directories = [], mode = "anchor", loadMode = "summary") {
		await this.ready;
		const now = Date.now();
		const ws = {
			id: randomUUID(),
			name,
			...remark !== void 0 && remark !== "" ? { remark } : {},
			directories: normalizeDirectories(directories),
			mode,
			loadMode,
			createdAt: now,
			updatedAt: now
		};
		await this.mutate(() => {
			this.shape = {
				...this.shape,
				currentWorkspaceId: ws.id,
				workspaces: [...this.shape.workspaces, ws]
			};
		});
		return ws;
	}
	/** 重命名工作空间（未知 id 不写盘）。 */
	async renameWorkspace(id, name) {
		await this.ready;
		await this.mutate(() => {
			if (!this.shape.workspaces.some((w) => w.id === id)) return;
			this.shape = {
				...this.shape,
				workspaces: this.shape.workspaces.map((w) => w.id === id ? {
					...w,
					name,
					updatedAt: Date.now()
				} : w)
			};
		});
	}
	/** 删除工作空间；删除当前工作空间时自动切到首个剩余工作空间。返回新的当前 id。 */
	async deleteWorkspace(id) {
		await this.ready;
		let nextCurrent = this.shape.currentWorkspaceId;
		await this.mutate(() => {
			const rest = this.shape.workspaces.filter((w) => w.id !== id);
			if (rest.length === this.shape.workspaces.length) return;
			if (nextCurrent === id) nextCurrent = rest[0]?.id ?? "";
			this.shape = {
				...this.shape,
				workspaces: rest,
				currentWorkspaceId: nextCurrent
			};
		});
		return nextCurrent;
	}
	/** 切换当前工作空间（未知 id 不写盘）。 */
	async switchWorkspace(id) {
		await this.ready;
		await this.mutate(() => {
			if (!this.shape.workspaces.some((w) => w.id === id)) return;
			if (this.shape.currentWorkspaceId === id) return;
			this.shape = {
				...this.shape,
				currentWorkspaceId: id
			};
		});
	}
	/** 覆盖某工作空间的目录列表（含排序/主从）。 */
	async setWorkspaceDirectories(id, directories) {
		await this.ready;
		await this.mutate(() => {
			if (!this.shape.workspaces.some((w) => w.id === id)) return;
			this.shape = {
				...this.shape,
				workspaces: this.shape.workspaces.map((w) => w.id === id ? {
					...w,
					directories: normalizeDirectories(directories),
					updatedAt: Date.now()
				} : w)
			};
		});
	}
	/** 设置工作空间模式（文档锚点 / 传统单项目）。 */
	async setWorkspaceMode(id, mode) {
		await this.ready;
		await this.mutate(() => {
			if (!this.shape.workspaces.some((w) => w.id === id)) return;
			this.shape = {
				...this.shape,
				workspaces: this.shape.workspaces.map((w) => w.id === id ? {
					...w,
					mode,
					updatedAt: Date.now()
				} : w)
			};
		});
	}
	/** 覆盖某工作空间的开发规范绑定。 */
	async setWorkspaceStandards(id, standards) {
		await this.ready;
		await this.mutate(() => {
			if (!this.shape.workspaces.some((w) => w.id === id)) return;
			const parsed = parseStandards(standards);
			this.shape = {
				...this.shape,
				workspaces: this.shape.workspaces.map((w) => w.id === id ? {
					...w,
					...parsed === void 0 ? { standards: void 0 } : { standards: parsed },
					updatedAt: Date.now()
				} : w)
			};
		});
	}
	/** 设置文件加载模式（完整 / 摘要 / 目录树）。 */
	async setLoadMode(id, loadMode) {
		await this.ready;
		await this.mutate(() => {
			if (!this.shape.workspaces.some((w) => w.id === id)) return;
			this.shape = {
				...this.shape,
				workspaces: this.shape.workspaces.map((w) => w.id === id ? {
					...w,
					loadMode,
					updatedAt: Date.now()
				} : w)
			};
		});
	}
	/** 局部更新工作空间级元信息（置顶 / 颜色 / token 预算 / 功能索引配置）；未提供的字段保持原值。 */
	async patchMeta(id, patch) {
		await this.ready;
		await this.mutate(() => {
			if (!this.shape.workspaces.some((w) => w.id === id)) return;
			this.shape = {
				...this.shape,
				workspaces: this.shape.workspaces.map((w) => w.id === id ? {
					...w,
					...patch.pinned !== void 0 ? { pinned: patch.pinned } : {},
					...patch.color !== void 0 ? { color: patch.color } : {},
					...patch.tokenBudget !== void 0 ? { tokenBudget: Math.max(1, Math.round(patch.tokenBudget)) } : {},
					...patch.codeIndexEnabled !== void 0 ? { codeIndexEnabled: patch.codeIndexEnabled } : {},
					...patch.codeIndexBudget !== void 0 ? { codeIndexBudget: Math.max(1, Math.round(patch.codeIndexBudget)) } : {},
					...patch.codeIndexSummary !== void 0 ? { codeIndexSummary: patch.codeIndexSummary } : {},
					updatedAt: Date.now()
				} : w)
			};
		});
	}
	/** 保存当前目录配置为一个命名快照。 */
	async saveSnapshot(id, name) {
		await this.ready;
		await this.mutate(() => {
			const ws = this.shape.workspaces.find((w) => w.id === id);
			if (ws === void 0) return;
			const snapshot = {
				id: randomUUID(),
				name,
				directories: [...ws.directories],
				createdAt: Date.now()
			};
			this.shape = {
				...this.shape,
				workspaces: this.shape.workspaces.map((w) => w.id === id ? {
					...w,
					snapshots: [...w.snapshots ?? [], snapshot],
					updatedAt: Date.now()
				} : w)
			};
		});
	}
	/** 用快照恢复目录配置。 */
	async restoreSnapshot(id, snapshotId) {
		await this.ready;
		await this.mutate(() => {
			const ws = this.shape.workspaces.find((w) => w.id === id);
			const snapshot = ws?.snapshots?.find((s) => s.id === snapshotId);
			if (ws === void 0 || snapshot === void 0) return;
			this.shape = {
				...this.shape,
				workspaces: this.shape.workspaces.map((w) => w.id === id ? {
					...w,
					directories: normalizeDirectories(snapshot.directories),
					updatedAt: Date.now()
				} : w)
			};
		});
	}
	/** 删除一条快照。 */
	async deleteSnapshot(id, snapshotId) {
		await this.ready;
		await this.mutate(() => {
			if (this.shape.workspaces.find((w) => w.id === id) === void 0) return;
			this.shape = {
				...this.shape,
				workspaces: this.shape.workspaces.map((w) => w.id === id ? {
					...w,
					snapshots: (w.snapshots ?? []).filter((s) => s.id !== snapshotId),
					updatedAt: Date.now()
				} : w)
			};
		});
	}
	/** 记录该工作空间最近一次新建会话时间。 */
	async touchWorkspaceSession(id) {
		await this.ready;
		await this.mutate(() => {
			if (!this.shape.workspaces.some((w) => w.id === id)) return;
			const now = Date.now();
			this.shape = {
				...this.shape,
				workspaces: this.shape.workspaces.map((w) => w.id === id ? {
					...w,
					lastSessionAt: now,
					updatedAt: now
				} : w)
			};
		});
	}
	/** 一次性加载：缺失/损坏退化为空存储；v1 结构自动迁移为 v2。 */
	async load() {
		try {
			const raw = await readFile(this.file, "utf8");
			const parsed = JSON.parse(raw);
			if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
				const record = parsed;
				if (record.version === 1 || Array.isArray(record.selection)) {
					const ws = makeDefaultWorkspace(normalizeDirectories(Array.isArray(record.selection) ? record.selection.map(parseWorkspaceRef).filter((r) => r !== void 0) : []));
					this.shape = {
						version: 2,
						currentWorkspaceId: ws.id,
						workspaces: [ws]
					};
				} else {
					const workspaces = Array.isArray(record.workspaces) ? record.workspaces.map(parseWorkspace).filter((w) => w !== void 0) : [];
					const current = typeof record.currentWorkspaceId === "string" && workspaces.some((w) => w.id === record.currentWorkspaceId) ? record.currentWorkspaceId : workspaces[0]?.id ?? "";
					this.shape = {
						version: 2,
						currentWorkspaceId: current,
						workspaces
					};
				}
			}
		} catch {}
		if (this.shape.workspaces.length === 0) {
			const ws = makeDefaultWorkspace();
			this.shape = {
				...this.shape,
				workspaces: [ws],
				currentWorkspaceId: ws.id
			};
		}
	}
	/** 串行化一次变更（内存更新 + 原子落盘）。 */
	mutate(update) {
		const run = async () => {
			update();
			await this.persist();
		};
		this.chain = this.chain.then(run, run);
		return this.chain;
	}
	/** 原子落盘：临时文件 + rename，目录 0700、文件 0600。 */
	async persist() {
		await mkdir(dirname(this.file), {
			recursive: true,
			mode: 448
		});
		const tmp = this.file + "." + process.pid + ".tmp";
		await writeFile(tmp, JSON.stringify(this.shape, null, 2), { mode: 384 });
		await rename(tmp, this.file);
		await chmod(this.file, 384).catch(() => {});
	}
};
//#endregion
//#region src/host/codeIndex.ts
/**
* 功能角度代码索引：在选中的目录里抽取 HTTP 端点，并联结「服务端注册/处理」与
* 「客户端调用」两侧的落点，供 prompt 精确导航、减少盲搜与无效 read。
*
* v1 是确定性的行扫描（无 AST），覆盖 TS/JS/TSX/JSX/Vue 的常见端点写法：
*   1. 直接字面量：fetch('/api/x')、path: '/api/x'
*   2. 命名常量：const X = '/api/x' / key: '/api/x'，再用 API.X、.x 引用联结两侧
* 结果可能有噪声，所以只在抽到端点时注入，并受 token 上限约束。符号级索引不是本
* 模块职责（那是 LSP/glob 的事）。
* @module dsh-workspace-combiner/host/codeIndex
*/
/** 参与扫描的代码扩展名（含常见后端语言，便于跨前后端联结）。 */
const CODE_EXTENSIONS = /* @__PURE__ */ new Set([
	".ts",
	".tsx",
	".js",
	".jsx",
	".mjs",
	".cjs",
	".vue",
	".java",
	".kt",
	".go",
	".py",
	".rb",
	".cs"
]);
/** 单次扫描上限，防止大仓库拖慢会话创建。 */
const MAX_FILES = 800;
const MAX_DEPTH = 8;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const MAX_ENTRIES = 120;
/** 端点字面量：引号内的 /path 形式。 */
const ENDPOINT_LITERAL = /['"`](\/[A-Za-z0-9._~\-/{}$:]+)['"`]/g;
/** 形如 NAME = '/path' 或 key: '/path' 的命名端点（取匹配位置之前的前缀）。 */
const NAMED_SUFFIX = /([A-Za-z_$][\w$]*)\s*[:=]\s*$/;
/** 引用令牌：.NAME 或 ['NAME']。 */
const REF_TOKEN = /\.([A-Za-z_$][\w$]*)\b|\[\s*['"]([A-Za-z_$][\w$]*)['"]\s*\]/g;
/** 资源/文件扩展名，用于排除 '/a/b.png' 这类非端点。 */
const ASSET_EXT = /\.(png|jpe?g|gif|svg|ico|webp|css|scss|less|sass|woff2?|ttf|eot|map|html?|json|ya?ml|md|txt|lock|xml|vue|ts|tsx|js|jsx)$/i;
/** 客户端调用线索（含 vue-router 页面路由）。 */
const CLIENT_HINT = /\b(fetch|axios|request|http|got|ky)\s*\(|\.(get|post|put|patch|delete)\s*\(|url\s*:|createRouter\s*\(|component\s*:/;
/** 服务端注册/处理线索（含 Java 注解与 Go/gin 的大写方法）。 */
const SERVER_HINT = /kind\s*:\s*['"]exact['"]|handler\s*:|@(Get|Post|Put|Patch|Delete|Request)Mapping|(?:router|app|server|mux|bp)\.(?:get|post|put|patch|delete|route)\s*\(|\.(?:GET|POST|PUT|PATCH|DELETE)\s*\(/;
/** 通用属性名：不做端点常量名，避免 names 映射被 value/path/url 之类污染。 */
const NAME_DENYLIST = /* @__PURE__ */ new Set([
	"value",
	"values",
	"path",
	"paths",
	"url",
	"uri",
	"name",
	"key",
	"pattern",
	"endpoint",
	"base",
	"baseUrl",
	"baseURL",
	"method",
	"route",
	"routes",
	"href",
	"src",
	"id",
	"type",
	"label",
	"text",
	"title",
	"description",
	"prefix",
	"suffix",
	"host",
	"port",
	"protocol",
	"default",
	"options",
	"config",
	"data"
]);
/** 归一化端点：{id} / ${id} / :id 视作同一占位，便于前后端联结。 */
function normalizeEndpoint(endpoint) {
	return endpoint.replace(/\$\{[^}]*\}/g, "_").replace(/\{[^}]*\}/g, "_").replace(/\/:[A-Za-z_][\w]*/g, "/_");
}
/** 判断一个字面量是否像 HTTP 端点。 */
function looksLikeEndpoint(path) {
	if (path.length < 2 || !path.startsWith("/")) return false;
	if (path.startsWith("//")) return false;
	if (ASSET_EXT.test(path)) return false;
	return true;
}
/** 无命名时按端点路径推导功能名（取 /api/ 后的首段）。 */
function deriveFeature(endpoint) {
	const segs = endpoint.split("/").filter((s) => s !== "");
	if (segs[0] === "api" && segs.length > 1) return segs[1];
	return segs[0] ?? endpoint;
}
/** 累积一条端点的两侧落点。 */
function applyLoc(acc, file, line, server, client) {
	if (server && acc.server === void 0) acc.server = {
		file,
		line
	};
	else if (client && acc.client === void 0) acc.client = {
		file,
		line
	};
	else acc.refs++;
}
/** 递归收集代码文件（复用文件索引的忽略规则）。 */
async function collectCodeFiles(root, patterns) {
	const out = [];
	const walk = async (dir, depth) => {
		if (depth > MAX_DEPTH || out.length >= MAX_FILES) return;
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const ent of entries) {
			if (out.length >= MAX_FILES) return;
			const abs = join(dir, ent.name);
			if (isIgnored(relative(root, abs).split(sep).join("/"), ent.isDirectory(), patterns)) continue;
			if (ent.isDirectory()) {
				await walk(abs, depth + 1);
				continue;
			}
			const dot = ent.name.lastIndexOf(".");
			if (dot <= 0) continue;
			if (CODE_EXTENSIONS.has(ent.name.slice(dot).toLowerCase())) out.push(abs);
		}
	};
	await walk(root, 1);
	return out;
}
/**
* 构建功能角度代码索引。
* @param dirs - 工作空间的目录列表（disabled 目录跳过）。
* @returns 端点条目（仅保留至少有一侧落点的），按功能名与端点排序。
*/
async function buildCodeIndex(dirs) {
	const names = /* @__PURE__ */ new Map();
	const byEndpoint = /* @__PURE__ */ new Map();
	const files = [];
	let totalBytes = 0;
	const upsert = (key, display, feature) => {
		let acc = byEndpoint.get(key);
		if (acc === void 0) {
			acc = {
				feature,
				endpoint: display,
				refs: 0
			};
			byEndpoint.set(key, acc);
		}
		return acc;
	};
	for (const dir of dirs) {
		if ((dir.access ?? "readwrite") === "disabled") continue;
		const patterns = await loadGitignore(dir.path);
		for (const abs of await collectCodeFiles(dir.path, patterns)) {
			if (totalBytes >= MAX_TOTAL_BYTES) break;
			let content = "";
			try {
				if ((await stat(abs)).size > MAX_FILE_BYTES) continue;
				content = await readFile(abs, "utf8");
			} catch {
				continue;
			}
			totalBytes += content.length;
			files.push({
				rel: relative(dir.path, abs).split(sep).join("/"),
				content,
				lines: content.split("\n"),
				server: SERVER_HINT.test(content),
				client: CLIENT_HINT.test(content)
			});
		}
	}
	for (const f of files) for (let i = 0; i < f.lines.length; i++) {
		const line = f.lines[i];
		const trimmed = line.trimStart();
		if (trimmed.startsWith("/") || trimmed.startsWith("*") || trimmed.startsWith("#")) continue;
		if (trimmed.includes("= /") || trimmed.includes("(/") || trimmed.includes("RegExp(")) continue;
		ENDPOINT_LITERAL.lastIndex = 0;
		let m;
		while ((m = ENDPOINT_LITERAL.exec(line)) !== null) {
			const endpoint = m[1];
			if (!looksLikeEndpoint(endpoint)) continue;
			const key = normalizeEndpoint(endpoint);
			const rawName = NAMED_SUFFIX.exec(line.slice(0, m.index))?.[1];
			const name = rawName !== void 0 && !NAME_DENYLIST.has(rawName) ? rawName : void 0;
			if (name !== void 0) names.set(name, key);
			applyLoc(upsert(key, endpoint, name ?? deriveFeature(endpoint)), f.rel, i + 1, f.server, f.client);
		}
	}
	if (names.size > 0) for (const f of files) for (let i = 0; i < f.lines.length; i++) {
		const line = f.lines[i];
		REF_TOKEN.lastIndex = 0;
		let m;
		while ((m = REF_TOKEN.exec(line)) !== null) {
			const name = m[1] ?? m[2];
			if (name === void 0) continue;
			const key = names.get(name);
			if (key === void 0) continue;
			applyLoc(upsert(key, name, name), f.rel, i + 1, f.server, f.client);
		}
	}
	return [...byEndpoint.values()].filter((entry) => entry.server !== void 0 || entry.client !== void 0).sort((a, b) => a.feature.localeCompare(b.feature) || a.endpoint.localeCompare(b.endpoint)).slice(0, MAX_ENTRIES);
}
/** 功能索引落盘文件（跨重启复用，避免首会话重扫全部代码）。 */
function codeIndexFile() {
	return join(dshHome(), "dsh-workspace-combiner-code-index.json");
}
/**
* 索引缓存：目录签名（路径 + 根 mtime）未变且未过期则复用。
* 查找顺序 = 进程内存 → 磁盘（跨重启）→ 重新扫描；重建后异步落盘（失败静默）。
*/
var CodeIndexCache = class CodeIndexCache {
	/** 缓存有效期：内容级改动不改根目录 mtime，用 TTL 兜住索引陈旧（行号漂移）。 */
	static TTL_MS = 6e4;
	cache = /* @__PURE__ */ new Map();
	file;
	diskLoaded = false;
	constructor(file = codeIndexFile()) {
		this.file = file;
	}
	async get(dirs) {
		const active = dirs.filter((d) => (d.access ?? "readwrite") !== "disabled");
		const parts = [];
		for (const d of active) {
			let mtime = -1;
			try {
				mtime = (await stat(d.path)).mtimeMs;
			} catch {
				mtime = -1;
			}
			parts.push(d.path + "@" + mtime);
		}
		const key = parts.join("|");
		const hit = this.cache.get(key);
		if (hit !== void 0 && Date.now() - hit.at < CodeIndexCache.TTL_MS) return hit.entries;
		if (!this.diskLoaded) {
			this.diskLoaded = true;
			const disk = await this.loadDisk();
			if (disk !== void 0 && disk.signature === key && Date.now() - disk.at < CodeIndexCache.TTL_MS) {
				this.cache.set(key, {
					at: disk.at,
					entries: disk.entries
				});
				return disk.entries;
			}
		}
		const value = await buildCodeIndex(active);
		this.cache.clear();
		this.cache.set(key, {
			at: Date.now(),
			entries: value
		});
		await this.saveDisk({
			signature: key,
			at: Date.now(),
			entries: value
		});
		return value;
	}
	clear() {
		this.cache.clear();
	}
	async loadDisk() {
		try {
			const parsed = JSON.parse(await readFile(this.file, "utf8"));
			if (parsed === null || typeof parsed !== "object") return void 0;
			const record = parsed;
			if (typeof record.signature !== "string" || typeof record.at !== "number" || !Array.isArray(record.entries)) return void 0;
			const entries = record.entries.filter((item) => {
				if (item === null || typeof item !== "object") return false;
				const entry = item;
				return typeof entry.feature === "string" && typeof entry.endpoint === "string";
			});
			return {
				signature: record.signature,
				at: record.at,
				entries
			};
		} catch {
			return;
		}
	}
	async saveDisk(payload) {
		try {
			await mkdir(dirname(this.file), {
				recursive: true,
				mode: 448
			});
			const tmp = this.file + "." + process.pid + ".tmp";
			await writeFile(tmp, JSON.stringify(payload), { mode: 384 });
			await rename(tmp, this.file);
			await chmod(this.file, 384).catch(() => {});
		} catch {}
	}
};
//#endregion
//#region src/host/llmText.ts
/** 动态 import 的说明符（声明为 string，避免 TS 解析不到依赖而报错）。 */
const LLM_MODULE = "@deepseek-ai/dsh-llm";
/**
* 用默认模型生成纯文本。
* @param ctx - 宿主上下文（用于 ctx.get('llm') / ctx.get('agentDefaultModel')）。
* @param request - 系统提示、用户输入与限额。
* @returns 成功/失败结果（失败含可读原因）。
*/
async function runLlmText(ctx, request) {
	const llm = ctx.get("llm");
	if (llm === void 0 || typeof llm.stream !== "function") return {
		ok: false,
		error: "llm 服务不可用（ctx.get(\"llm\") 为空）"
	};
	const selection = ctx.get("agentDefaultModel")?.currentSelection();
	if (selection?.provider === void 0 || selection.model === void 0) return {
		ok: false,
		error: "默认模型未配置（agentDefaultModel 没有 provider/model）"
	};
	let mod;
	try {
		mod = await import(LLM_MODULE);
	} catch (error) {
		ctx.logger?.warn("[dsh-workspace-combiner] cannot load @deepseek-ai/dsh-llm:", error);
		return {
			ok: false,
			error: "无法加载 @deepseek-ai/dsh-llm：" + (error instanceof Error ? error.message : String(error))
		};
	}
	try {
		const messages = [mod.createUserMessage({
			content: [{
				type: "text",
				text: request.userText
			}],
			source: {
				kind: "plugin",
				plugin: PLUGIN_ID
			}
		})];
		const assembler = new mod.BlockAssembler();
		const options = {
			provider: selection.provider,
			model: selection.model,
			messages,
			system: request.system,
			maxTokens: request.maxTokens,
			purpose: request.purpose,
			signal: AbortSignal.timeout(request.timeoutMs ?? 2e4)
		};
		if (request.sessionId !== void 0 && request.sessionId !== "") options.sessionId = request.sessionId;
		for await (const chunk of llm.stream(options)) assembler.push(chunk);
		const finish = assembler.finish;
		if (finish !== void 0 && finish.kind !== void 0 && finish.kind !== "stop") {
			const detail = finish.failure?.message ?? finish.failure?.code ?? finish.kind;
			ctx.logger?.warn("[dsh-workspace-combiner] llm finish:", selection.provider, selection.model, finish.kind, detail);
			return {
				ok: false,
				error: "模型调用未成功（" + finish.kind + "）：" + detail
			};
		}
		const text = assembler.blocks().filter((block) => block.type === "text").map((block) => block.text ?? "").join("\n").trim();
		if (text === "") return {
			ok: false,
			error: "模型未返回任何文本（finish=" + (finish?.kind ?? "unknown") + "）"
		};
		return {
			ok: true,
			text
		};
	} catch (error) {
		ctx.logger?.warn("[dsh-workspace-combiner] llm text call threw:", error);
		return {
			ok: false,
			error: "模型调用异常：" + (error instanceof Error ? error.message : String(error))
		};
	}
}
//#endregion
//#region src/host/codeIndexSummary.ts
/**
* 可选能力：用模型为每个功能生成一句话摘要（工作空间开启 codeIndexSummary='llm' 时）。
*
* 设计取舍：
*   - 只在会话创建时按「功能签名」生成一次并缓存，避免每步/每次刷新都调用模型；
*   - 任何失败（无 llm 服务、无默认模型、超时、输出不可解析）都静默降级——功能索引
*     本身不依赖摘要，缺了它仍然可用；
*   - @deepseek-ai/dsh-llm 用「变量说明符」动态 import，这样 dev 检出未安装该依赖时
*     也能通过类型检查与构建，运行期再从 profile 的 fallback 解析。
* @module dsh-workspace-combiner/host/codeIndexSummary
*/
const MAX_FEATURES = 24;
const MAX_OUTPUT_TOKENS$1 = 800;
const TIMEOUT_MS$1 = 2e4;
const MAX_SUMMARY_CHARS = 60;
const SYSTEM$1 = "你是代码库导航助手。根据给出的 HTTP 端点清单，为每个功能写一行中文摘要（不超过 20 字，说明它做什么）。只输出「功能名: 摘要」这样的行，不要任何多余解释。";
/** 功能签名：摘要缓存与失效判断的依据（含端点与落点，落点变化即失效）。 */
function codeIndexSignature(entries) {
	return entries.map((e) => [
		e.feature,
		e.endpoint,
		e.server?.file ?? "",
		e.server?.line ?? "",
		e.client?.file ?? "",
		e.client?.line ?? ""
	].join("@")).join("|");
}
/**
* 生成功能摘要（失败返回空 Map）。
* @param ctx - 宿主上下文（用于 ctx.get('llm') / ctx.get('agentDefaultModel')）。
* @param sessionId - 归属会话 id（模型调用归属）。
* @param entries - 待摘要的功能条目。
*/
async function summarizeFeatures(ctx, sessionId, entries) {
	const out = /* @__PURE__ */ new Map();
	if (entries.length === 0) return out;
	const subset = entries.slice(0, MAX_FEATURES);
	const list = subset.map((e) => [
		e.feature,
		e.endpoint,
		e.server === void 0 ? "" : "server " + e.server.file,
		e.client === void 0 ? "" : "client " + e.client.file
	].filter((s) => s !== "").join(" | ")).join("\n");
	const result = await runLlmText(ctx, {
		system: SYSTEM$1,
		userText: list,
		sessionId,
		maxTokens: MAX_OUTPUT_TOKENS$1,
		purpose: "workspace-combiner-code-index-summary",
		timeoutMs: TIMEOUT_MS$1
	});
	if (!result.ok) {
		ctx.logger?.warn("[dsh-workspace-combiner] feature summary skipped:", result.error);
		return out;
	}
	const text = result.text;
	const known = new Set(subset.map((e) => e.feature));
	for (const line of text.split("\n")) {
		const match = /^\s*(?:[-*]\s*)?([^:：|]+?)\s*[:：]\s*(.+?)\s*$/.exec(line);
		if (match === null) continue;
		const feature = match[1].trim();
		if (known.has(feature)) out.set(feature, match[2].trim().slice(0, MAX_SUMMARY_CHARS));
	}
	return out;
}
/** 功能摘要落盘文件（跨重启复用，避免重复花 token 生成）。 */
function featureSummaryFile() {
	return join(dshHome(), "dsh-workspace-combiner-feature-summaries.json");
}
/**
* 功能摘要缓存：按签名保存最近一次结果。
* 查找顺序 = 进程内存 → 磁盘（跨重启）→ 调模型生成；生成结果落盘（失败静默）。
* ensure() 带并发去重：同签名的多次请求只触发一次模型调用。
*/
var FeatureSummaryCache = class {
	file;
	signature = "";
	summaries = /* @__PURE__ */ new Map();
	diskLoaded = false;
	pending;
	constructor(file = featureSummaryFile()) {
		this.file = file;
	}
	/** 按签名取摘要（内存/磁盘）；未命中返回 undefined。 */
	async get(signature) {
		if (!this.diskLoaded) {
			this.diskLoaded = true;
			const disk = await this.loadDisk();
			if (disk !== void 0) {
				this.signature = disk.signature;
				this.summaries = new Map(Object.entries(disk.summaries));
			}
		}
		return signature === this.signature && this.summaries.size > 0 ? this.summaries : void 0;
	}
	/** 命中则直接返回；否则调用 generate（并发去重），非空结果落盘。 */
	async ensure(signature, generate) {
		const cached = await this.get(signature);
		if (cached !== void 0) return cached;
		if (this.pending !== void 0) return await this.pending;
		const task = (async () => {
			const generated = await generate();
			if (generated.size > 0) {
				this.signature = signature;
				this.summaries = generated;
				await this.saveDisk();
			}
			return generated;
		})();
		this.pending = task;
		try {
			return await task;
		} finally {
			this.pending = void 0;
		}
	}
	async loadDisk() {
		try {
			const parsed = JSON.parse(await readFile(this.file, "utf8"));
			if (parsed === null || typeof parsed !== "object") return void 0;
			const record = parsed;
			if (typeof record.signature !== "string" || record.summaries === null || typeof record.summaries !== "object") return void 0;
			const summaries = {};
			for (const [key, value] of Object.entries(record.summaries)) if (typeof value === "string") summaries[key] = value;
			return {
				signature: record.signature,
				at: typeof record.at === "number" ? record.at : 0,
				summaries
			};
		} catch {
			return;
		}
	}
	async saveDisk() {
		try {
			await mkdir(dirname(this.file), {
				recursive: true,
				mode: 448
			});
			const payload = {
				signature: this.signature,
				at: Date.now(),
				summaries: Object.fromEntries(this.summaries)
			};
			const tmp = this.file + "." + process.pid + ".tmp";
			await writeFile(tmp, JSON.stringify(payload), { mode: 384 });
			await rename(tmp, this.file);
			await chmod(this.file, 384).catch(() => {});
		} catch {}
	}
};
//#endregion
//#region src/host/standardsLibrary.ts
/**
* 全局开发规范库读写：~/.dsh/dsh-workspace-combiner-standards.json。
* 存储内置规范的覆盖正文与全局自建规范；原子写、0600、内存缓存、失败静默降级。
* @module dsh-workspace-combiner/host/standardsLibrary
*/
/** 规范库文件路径。 */
function standardsLibraryFile() {
	return join(dshHome(), "dsh-workspace-combiner-standards.json");
}
/** 校验并规范化整份库。 */
function parseLibrary(raw) {
	if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return emptyLibrary();
	const record = raw;
	const overrides = {};
	if (record.overrides !== null && typeof record.overrides === "object" && !Array.isArray(record.overrides)) {
		for (const [key, value] of Object.entries(record.overrides)) if (typeof value === "string" && value.trim() !== "") overrides[key] = value;
	}
	return {
		version: 1,
		overrides,
		custom: Array.isArray(record.custom) ? record.custom.map(parseCustomStandard).filter((item) => item !== void 0) : []
	};
}
/** 规范库：读一次缓存，整份替换写盘。 */
var StandardsLibraryStore = class {
	file;
	loaded = false;
	library = emptyLibrary();
	chain = Promise.resolve();
	constructor(file = standardsLibraryFile()) {
		this.file = file;
	}
	/** 读取库（首次读盘，之后走内存）。 */
	async get() {
		if (!this.loaded) {
			this.loaded = true;
			try {
				this.library = parseLibrary(JSON.parse(await readFile(this.file, "utf8")));
			} catch {
				this.library = emptyLibrary();
			}
		}
		return this.library;
	}
	/** 整份替换并落盘（串行化）。 */
	async replace(next) {
		await this.get();
		this.library = parseLibrary(next);
		const run = async () => {
			await this.persist();
		};
		this.chain = this.chain.then(run, run);
		await this.chain;
	}
	async persist() {
		try {
			await mkdir(dirname(this.file), {
				recursive: true,
				mode: 448
			});
			const tmp = this.file + "." + process.pid + ".tmp";
			await writeFile(tmp, JSON.stringify(this.library, null, 2), { mode: 384 });
			await rename(tmp, this.file);
			await chmod(this.file, 384).catch(() => {});
		} catch {}
	}
};
//#endregion
//#region src/host/standardsAi.ts
const TIMEOUT_MS = 25e3;
const MAX_OUTPUT_TOKENS = 800;
const SYSTEM = [
	"你是资深工程师，负责编写给 AI 编码助手使用的开发规范。",
	"输出 markdown 列表：每行以 \"- \" 开头，共 12-18 条。",
	"覆盖：命名约定、目录与分层、错误处理、日志、事务/并发、配置与密钥、测试要求、接口与兼容性（按技术栈取舍）。",
	"每条一句话、可执行、具体；不要输出标题、解释、代码块或前后缀。"
].join("");
/**
* 起草一份规范正文。
* @param ctx - 宿主上下文。
* @param request - 规范名、技术栈与可选补充。
* @returns 生成的正文；失败返回 undefined。
*/
async function generateStandardDraft(ctx, request) {
	const lines = ["规范名称：" + request.name, "技术栈：" + request.tech];
	if (request.directory !== void 0 && request.directory !== "") lines.push("目标项目目录：" + request.directory);
	if (request.hint !== void 0 && request.hint.trim() !== "") lines.push("额外要求：" + request.hint.trim());
	return await runLlmText(ctx, {
		system: SYSTEM,
		userText: lines.join("\n"),
		maxTokens: MAX_OUTPUT_TOKENS,
		purpose: "workspace-combiner-standards-draft",
		timeoutMs: TIMEOUT_MS
	});
}
//#endregion
//#region src/host/contextStats.ts
/**
* 上下文监控：估算注入 prompt 的 token 规模 + 各目录文件统计。
* @module dsh-workspace-combiner/host/contextStats
*/
/**
* 计算当前工作区的上下文统计（文件树走 mtime 缓存）。
* @param input - 工作空间目录、加载模式、各区块缓存与预算。
*/
async function computeContextStats(input) {
	const { directories, mode, loadMode, fileIndexCache, tokenBudget = 0, codeIndexCache, codeConfig, standardGroups = [], standardsBudget = 0 } = input;
	const stats = await Promise.all(directories.filter((dir) => (dir.access ?? "readwrite") !== "disabled").map(async (dir) => {
		const access = dir.access ?? "readwrite";
		const counts = await fileIndexCache.count(dir.path);
		const base = {
			name: dir.name,
			path: dir.path,
			files: counts.files,
			dirs: counts.dirs,
			...counts.truncated ? { truncated: true } : {}
		};
		const entry = loadMode === "summary" ? base : {
			...base,
			tree: await fileIndexCache.get(dir.path, { maxDepth: loadModeMaxDepth(loadMode) })
		};
		return {
			name: dir.name,
			path: dir.path,
			access,
			files: counts.files,
			dirs: counts.dirs,
			tokens: estimateTokens(renderFileIndex([entry], loadMode, tokenBudget))
		};
	}));
	const totalFiles = stats.reduce((sum, s) => sum + s.files, 0);
	const totalDirs = stats.reduce((sum, s) => sum + s.dirs, 0);
	const fileIndexTokens = stats.reduce((sum, s) => sum + s.tokens, 0);
	const codeEntries = [];
	if (codeConfig?.enabled !== false && codeIndexCache !== void 0 && directories.length > 0) {
		const raw = await codeIndexCache.get(directories);
		const summaries = codeConfig?.summaries;
		for (const entry of raw) codeEntries.push(summaries !== void 0 && summaries.has(entry.feature) ? {
			...entry,
			summary: summaries.get(entry.feature)
		} : entry);
	}
	const standardsTokens = estimateTokens(renderStandards(standardGroups, standardsBudget));
	return {
		loadMode,
		directories: stats,
		totalFiles,
		totalDirs,
		fileIndexTokens,
		promptOverheadTokens: estimateTokens(renderMultiWorkspacePrompt({
			workspaces: directories,
			mode,
			loadMode,
			entries: [],
			tokenBudget: 0,
			codeEntries,
			...codeConfig?.budget === void 0 ? {} : { codeIndexBudget: codeConfig.budget }
		})),
		standardsTokens
	};
}
//#endregion
//#region src/host/gitStatus.ts
/**
* Git 状态回显：读取某目录的当前分支 / 未提交修改数 / 未跟踪数 / 领先远程提交数。
* 用 execFile（不经 shell）调用 git，带超时；任何错误（非 git 仓库、无 git、
* 超时）一律返回 null，不抛异常——面板只是回显，不应影响其它功能。
* @module dsh-workspace-combiner/host/gitStatus
*/
/** git 子进程超时（毫秒）。 */
const GIT_TIMEOUT_MS = 5e3;
/** 匹配 "[ahead N]"。 */
const AHEAD_RE = /\[ahead (\d+)/;
/**
* 解析 git status --porcelain -b 的输出。
* 首行形如 '## main...origin/main [ahead 2]'；其余行前两列是 XY 状态码，
* '??' 表示未跟踪，其余（M/A/D/R 等）计入已修改。
* @param stdout - git 的标准输出。
* @returns 解析出的状态。
*/
function parseGitStatus(stdout) {
	const lines = stdout.split("\n");
	let branch = "";
	let ahead = 0;
	let dirty = 0;
	let untracked = 0;
	for (const line of lines) {
		if (line === "") continue;
		if (line.startsWith("## ")) {
			const head = line.slice(3).trim();
			const aheadMatch = AHEAD_RE.exec(head);
			if (aheadMatch !== null) ahead = Number(aheadMatch[1]);
			if (head.startsWith("HEAD (no branch)")) branch = "HEAD";
			else {
				const dots = head.indexOf("...");
				const noUpstream = head.split(" ")[0];
				branch = (dots >= 0 ? head.slice(0, dots) : noUpstream).trim();
			}
			continue;
		}
		if (line.slice(0, 2) === "??") untracked++;
		else dirty++;
	}
	return {
		branch,
		dirty,
		untracked,
		ahead
	};
}
/**
* 读取目录的 git 状态（execFile，无 shell，5s 超时）。
* @param path - 目录绝对路径。
* @returns git 状态；非 git 仓库 / 任何失败返回 null。
*/
async function getGitStatus(path) {
	const trimmed = path.trim();
	if (trimmed === "") return null;
	return await new Promise((resolve) => {
		execFile("git", [
			"-C",
			trimmed,
			"status",
			"--porcelain",
			"-b",
			"--short"
		], {
			timeout: GIT_TIMEOUT_MS,
			maxBuffer: 1 << 20,
			windowsHide: true
		}, (error, stdout) => {
			if (error !== null) {
				resolve(null);
				return;
			}
			try {
				resolve(parseGitStatus(stdout));
			} catch {
				resolve(null);
			}
		});
	});
}
//#endregion
//#region src/sandbox-sync.ts
/** sandbox-extra-roots 的 config.json 绝对路径。 */
function sandboxConfigFile() {
	return join(process.env.DSH_HOME?.trim() ? resolve(process.env.DSH_HOME) : join(homedir(), ".dsh"), "plugins", SANDBOX_PLUGIN_NAME, "config.json");
}
/** 读取 config.json 里的 file-level extraWritableRoots（缺失/损坏 -> []）。 */
async function readFileRoots() {
	try {
		const raw = await readFile(sandboxConfigFile(), "utf8");
		const parsed = JSON.parse(raw);
		if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
			const roots = parsed.extraWritableRoots;
			if (Array.isArray(roots)) return roots.filter((r) => typeof r === "string");
		}
	} catch {}
	return [];
}
/** 原子写入 config.json（目录 0700、文件 0600）。 */
async function writeFileRoots(roots) {
	const file = sandboxConfigFile();
	await mkdir(dirname(file), {
		recursive: true,
		mode: 448
	});
	const tmp = `${file}.${process.pid}.tmp`;
	await writeFile(tmp, JSON.stringify({ extraWritableRoots: roots }, null, 2) + "\n", { mode: 384 });
	await rename(tmp, file);
	await chmod(file, 384).catch(() => {});
}
/** 去重并保持顺序。 */
function dedupe(paths) {
	return [...new Set(paths)];
}
/**
* 把选中目录同步进沙盒白名单。
* @param ctx - 宿主插件上下文（用于查找远程服务）。
* @param previous - 上一次贡献的路径（本插件之前选中的工作区路径）。
* @param next - 本次要贡献的路径（新选中的工作区路径）。
*/
async function syncExtraRoots(ctx, previous, next) {
	const merged = dedupe([...(await readFileRoots()).filter((path) => !previous.includes(path)), ...next]);
	let remote;
	try {
		remote = ctx.get(SANDBOX_REMOTE_SERVICE);
	} catch {
		remote = void 0;
	}
	if (remote?.set !== void 0) try {
		remote.set({ extraWritableRoots: merged });
		return;
	} catch (error) {
		ctx.logger?.warn("[dsh-workspace-combiner] sandbox-extra-roots rejected the root set:", error);
		return;
	}
	try {
		await writeFileRoots(merged);
		ctx.logger?.warn("[dsh-workspace-combiner] sandbox-extra-roots remote unavailable; wrote config.json (restart to apply)");
	} catch (error) {
		ctx.logger?.warn("[dsh-workspace-combiner] failed to write sandbox config:", error);
	}
}
//#endregion
//#region src/routes.ts
/** loopback 字面量 + 浏览器同源标记（dsh-ssh 配对路由栅栏）。 */
function isLoopbackRequest(request) {
	const address = request.socket.remoteAddress;
	if (address !== "127.0.0.1" && address !== "::1" && address !== "::ffff:127.0.0.1") return false;
	const host = request.headers.host;
	if (typeof host !== "string") return false;
	let hostUrl;
	try {
		hostUrl = new URL("http://" + host);
	} catch {
		return false;
	}
	if (hostUrl.hostname !== "127.0.0.1" && hostUrl.hostname !== "localhost" && hostUrl.hostname !== "[::1]") return false;
	if (request.headers["sec-fetch-site"] === "cross-site") return false;
	const origin = request.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
/** 输出一段 JSON。 */
function writeJson(res, status, body) {
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"referrer-policy": "no-referrer"
	});
	res.end(JSON.stringify(body));
}
/** 读取 JSON 请求体（过大或不可解析返回 undefined）。 */
async function readJsonBody(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = chunk;
		size += buffer.length;
		if (size > 1048576) return void 0;
		chunks.push(buffer);
	}
	try {
		const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
		return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : void 0;
	} catch {
		return;
	}
}
/** 生成可用的文件系统文件夹名（去路径分隔符 / Windows 非法字符 / 控制字符）。 */
function sanitizeFolderName(name) {
	const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "").trim();
	return cleaned === "" ? DEFAULT_WORKSPACE_NAME : cleaned.slice(0, 80);
}
/**
* 构建全部路由。
* @param ctx - 宿主上下文（用于沙盒联动）。
* @param store - 持久化存储。
*/
function makeRoutes(ctx, store, fileIndexCache, codeIndexCache, summaryCache, standardsLibrary) {
	const guard = (req, res, method) => {
		if (!isLoopbackRequest(req)) {
			writeJson(res, 403, { error: "forbidden: loopback-only" });
			return false;
		}
		if (req.method !== method) {
			writeJson(res, 405, { error: "method not allowed: " + req.method });
			return false;
		}
		return true;
	};
	const fail = (res, error) => {
		writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
	};
	const writablePaths = (dirs) => dirs.filter((d) => (d.access ?? "readwrite") === "readwrite").map((d) => d.path);
	let lastSyncedPaths = [];
	store.getCurrentWorkspace().then((ws) => {
		lastSyncedPaths = writablePaths(ws?.directories ?? []);
	});
	const syncCurrent = async () => {
		const ws = await store.getCurrentWorkspace();
		const next = writablePaths(ws?.directories ?? []);
		await syncExtraRoots(ctx, lastSyncedPaths, next);
		lastSyncedPaths = next;
	};
	return [
		{
			kind: "exact",
			path: API.state,
			handler: async (req, res) => {
				if (!guard(req, res, "GET")) return;
				try {
					const state = await store.getState();
					writeJson(res, 200, {
						currentWorkspaceId: state.currentWorkspaceId,
						workspaces: state.workspaces
					});
				} catch (error) {
					fail(res, error);
				}
			}
		},
		{
			kind: "exact",
			path: API.workspaceCreate,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req);
				if (body === void 0) {
					writeJson(res, 400, { error: "invalid JSON body" });
					return;
				}
				const name = typeof body.name === "string" ? body.name.trim() : "";
				if (name === "") {
					writeJson(res, 400, { error: "name is required" });
					return;
				}
				const basePath = typeof body.basePath === "string" ? body.basePath.trim() : "";
				const mode = body.mode === "single" ? "single" : "anchor";
				const loadMode = body.loadMode === "full" || body.loadMode === "tree" ? body.loadMode : "summary";
				const directories = parseWorkspaceRefs(body.directories) ?? [];
				if (basePath === "") {
					writeJson(res, 400, { error: "basePath is required" });
					return;
				}
				try {
					const folderName = sanitizeFolderName(name);
					const targetPath = join(basePath, folderName);
					await mkdir(targetPath, { recursive: true });
					const allDirectories = [{
						id: targetPath,
						name: folderName,
						path: targetPath,
						isPrimary: true,
						access: "readwrite"
					}, ...directories.filter((d) => d.path !== targetPath)];
					const workspace = await store.createWorkspace(name, void 0, allDirectories, mode, loadMode);
					await syncCurrent();
					writeJson(res, 201, {
						workspace,
						currentWorkspaceId: workspace.id
					});
				} catch (error) {
					fail(res, error);
				}
			}
		},
		{
			kind: "exact",
			path: API.scan,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req);
				const path = body === void 0 ? "" : typeof body.path === "string" ? body.path.trim() : "";
				if (path === "") {
					writeJson(res, 400, { error: "path is required" });
					return;
				}
				try {
					writeJson(res, 200, { projects: await scanDirectory(path) });
				} catch (error) {
					fail(res, error);
				}
			}
		},
		{
			kind: "exact",
			path: API.workspaceRename,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req);
				const id = body === void 0 ? "" : typeof body.id === "string" ? body.id : "";
				const name = body === void 0 ? "" : typeof body.name === "string" ? body.name.trim() : "";
				if (id === "" || name === "") {
					writeJson(res, 400, { error: "id and name are required" });
					return;
				}
				try {
					await store.renameWorkspace(id, name);
					writeJson(res, 200, { ok: true });
				} catch (error) {
					fail(res, error);
				}
			}
		},
		{
			kind: "exact",
			path: API.workspaceDelete,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req);
				const id = body === void 0 ? "" : typeof body.id === "string" ? body.id : "";
				if (id === "") {
					writeJson(res, 400, { error: "id is required" });
					return;
				}
				try {
					const nextCurrent = await store.deleteWorkspace(id);
					await syncCurrent();
					writeJson(res, 200, {
						ok: true,
						currentWorkspaceId: nextCurrent
					});
				} catch (error) {
					fail(res, error);
				}
			}
		},
		{
			kind: "exact",
			path: API.workspaceSwitch,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req);
				const id = body === void 0 ? "" : typeof body.id === "string" ? body.id : "";
				if (id === "") {
					writeJson(res, 400, { error: "id is required" });
					return;
				}
				try {
					await store.switchWorkspace(id);
					await syncCurrent();
					writeJson(res, 200, { ok: true });
				} catch (error) {
					fail(res, error);
				}
			}
		},
		{
			kind: "exact",
			path: API.workspaceDirectories,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req);
				const id = body === void 0 ? "" : typeof body.id === "string" ? body.id : "";
				const directories = body === void 0 ? void 0 : parseWorkspaceRefs(body.directories);
				if (id === "" || directories === void 0) {
					writeJson(res, 400, { error: "id and directories are required" });
					return;
				}
				try {
					await store.setWorkspaceDirectories(id, directories);
					if (id === await store.getCurrentWorkspaceId()) await syncCurrent();
					writeJson(res, 200, { ok: true });
				} catch (error) {
					fail(res, error);
				}
			}
		},
		{
			kind: "exact",
			path: API.workspaceMode,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req);
				const id = body === void 0 ? "" : typeof body.id === "string" ? body.id : "";
				const mode = body === void 0 ? "" : body.mode === "single" ? "single" : body.mode === "anchor" ? "anchor" : "";
				if (id === "" || mode === "") {
					writeJson(res, 400, { error: "id and mode are required" });
					return;
				}
				try {
					await store.setWorkspaceMode(id, mode);
					writeJson(res, 200, { ok: true });
				} catch (error) {
					fail(res, error);
				}
			}
		},
		{
			kind: "exact",
			path: API.workspacePatch,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req);
				const id = body === void 0 ? "" : typeof body.id === "string" ? body.id : "";
				if (id === "") {
					writeJson(res, 400, { error: "id is required" });
					return;
				}
				const mode = body === void 0 ? "" : body.mode === "single" ? "single" : body.mode === "anchor" ? "anchor" : "";
				const loadMode = body === void 0 ? "" : body.loadMode === "full" || body.loadMode === "summary" || body.loadMode === "tree" ? body.loadMode : "";
				const pinned = body !== void 0 && typeof body.pinned === "boolean" ? body.pinned : void 0;
				const color = body !== void 0 && typeof body.color === "string" && body.color !== "" ? body.color : void 0;
				const tokenBudget = body !== void 0 && typeof body.tokenBudget === "number" && Number.isFinite(body.tokenBudget) && body.tokenBudget > 0 ? body.tokenBudget : void 0;
				const codeIndexEnabled = body !== void 0 && typeof body.codeIndexEnabled === "boolean" ? body.codeIndexEnabled : void 0;
				const codeIndexBudget = body !== void 0 && typeof body.codeIndexBudget === "number" && Number.isFinite(body.codeIndexBudget) && body.codeIndexBudget > 0 ? body.codeIndexBudget : void 0;
				const codeIndexSummary = body !== void 0 && (body.codeIndexSummary === "off" || body.codeIndexSummary === "llm") ? body.codeIndexSummary : void 0;
				try {
					if (mode !== "") await store.setWorkspaceMode(id, mode);
					if (loadMode !== "") await store.setLoadMode(id, loadMode);
					if (pinned !== void 0 || color !== void 0 || tokenBudget !== void 0 || codeIndexEnabled !== void 0 || codeIndexBudget !== void 0 || codeIndexSummary !== void 0) await store.patchMeta(id, {
						...pinned !== void 0 ? { pinned } : {},
						...color !== void 0 ? { color } : {},
						...tokenBudget !== void 0 ? { tokenBudget } : {},
						...codeIndexEnabled !== void 0 ? { codeIndexEnabled } : {},
						...codeIndexBudget !== void 0 ? { codeIndexBudget } : {},
						...codeIndexSummary !== void 0 ? { codeIndexSummary } : {}
					});
					writeJson(res, 200, { ok: true });
				} catch (error) {
					fail(res, error);
				}
			}
		},
		{
			kind: "exact",
			path: API.workspaceLoadMode,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req);
				const id = body === void 0 ? "" : typeof body.id === "string" ? body.id : "";
				const loadMode = body === void 0 ? "" : body.loadMode === "full" || body.loadMode === "summary" || body.loadMode === "tree" ? body.loadMode : "";
				if (id === "" || loadMode === "") {
					writeJson(res, 400, { error: "id and loadMode are required" });
					return;
				}
				try {
					await store.setLoadMode(id, loadMode);
					writeJson(res, 200, { ok: true });
				} catch (error) {
					fail(res, error);
				}
			}
		},
		{
			kind: "exact",
			path: API.workspaceSnapshot,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req);
				const id = body === void 0 ? "" : typeof body.id === "string" ? body.id : "";
				const action = body === void 0 ? "" : typeof body.action === "string" ? body.action : "";
				const name = body === void 0 ? "" : typeof body.name === "string" ? body.name.trim() : "";
				const snapshotId = body === void 0 ? "" : typeof body.snapshotId === "string" ? body.snapshotId : "";
				if (id === "" || action === "") {
					writeJson(res, 400, { error: "id and action are required" });
					return;
				}
				try {
					if (action === "save") {
						if (name === "") {
							writeJson(res, 400, { error: "name is required" });
							return;
						}
						await store.saveSnapshot(id, name);
					} else if (action === "restore") {
						if (snapshotId === "") {
							writeJson(res, 400, { error: "snapshotId is required" });
							return;
						}
						await store.restoreSnapshot(id, snapshotId);
						if (id === await store.getCurrentWorkspaceId()) await syncCurrent();
					} else if (action === "delete") {
						if (snapshotId === "") {
							writeJson(res, 400, { error: "snapshotId is required" });
							return;
						}
						await store.deleteSnapshot(id, snapshotId);
					} else {
						writeJson(res, 400, { error: "unknown action" });
						return;
					}
					writeJson(res, 200, { ok: true });
				} catch (error) {
					fail(res, error);
				}
			}
		},
		{
			kind: "exact",
			path: API.stat,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req);
				const path = body === void 0 ? "" : typeof body.path === "string" ? body.path.trim() : "";
				if (path === "") {
					writeJson(res, 400, { error: "path is required" });
					return;
				}
				try {
					writeJson(res, 200, {
						exists: true,
						isDirectory: (await stat(path)).isDirectory()
					});
				} catch {
					writeJson(res, 200, {
						exists: false,
						isDirectory: false
					});
				}
			}
		},
		{
			kind: "exact",
			path: API.fileIndex,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req);
				const path = body === void 0 ? "" : typeof body.path === "string" ? body.path.trim() : "";
				if (path === "") {
					writeJson(res, 400, { error: "path is required" });
					return;
				}
				const loadMode = body !== void 0 && (body.loadMode === "full" || body.loadMode === "tree" || body.loadMode === "summary") ? body.loadMode : "tree";
				try {
					if (!(await stat(path)).isDirectory()) throw new Error("path is not a directory: " + path);
					const tree = await fileIndexCache.get(path, { maxDepth: loadModeMaxDepth(loadMode) });
					const counts = await fileIndexCache.count(path);
					writeJson(res, 200, {
						root: path,
						files: counts.files,
						dirs: counts.dirs,
						truncated: counts.truncated,
						loadMode,
						tree
					});
				} catch (error) {
					fail(res, error);
				}
			}
		},
		{
			kind: "exact",
			path: API.gitStatus,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req);
				const path = body === void 0 ? "" : typeof body.path === "string" ? body.path.trim() : "";
				if (path === "") {
					writeJson(res, 400, { error: "path is required" });
					return;
				}
				try {
					writeJson(res, 200, { status: await getGitStatus(path) });
				} catch (error) {
					fail(res, error);
				}
			}
		},
		{
			kind: "exact",
			path: API.codeIndex,
			handler: async (req, res) => {
				if (!guard(req, res, "GET")) return;
				try {
					const ws = await store.getCurrentWorkspace();
					if (ws === void 0 || (ws.codeIndexEnabled ?? true) !== true) {
						writeJson(res, 200, { entries: [] });
						return;
					}
					const raw = await codeIndexCache.get(ws.directories);
					const summaries = await summaryCache.get(codeIndexSignature(raw));
					writeJson(res, 200, { entries: summaries === void 0 ? raw : raw.map((entry) => summaries.has(entry.feature) ? {
						...entry,
						summary: summaries.get(entry.feature)
					} : entry) });
				} catch (error) {
					fail(res, error);
				}
			}
		},
		{
			kind: "exact",
			path: API.standards,
			handler: async (req, res) => {
				if (req.method === "GET") {
					if (!guard(req, res, "GET")) return;
					try {
						writeJson(res, 200, { library: await standardsLibrary.get() });
					} catch (error) {
						fail(res, error);
					}
					return;
				}
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req);
				if (body === void 0 || body.library === void 0) {
					writeJson(res, 400, { error: "library is required" });
					return;
				}
				try {
					await standardsLibrary.replace(parseLibrary(body.library));
					writeJson(res, 200, { ok: true });
				} catch (error) {
					fail(res, error);
				}
			}
		},
		{
			kind: "exact",
			path: API.workspaceStandards,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req);
				const id = body === void 0 ? "" : typeof body.id === "string" ? body.id : "";
				const standards = body === void 0 ? void 0 : body.standards;
				if (id === "" || standards === void 0 || standards === null || typeof standards !== "object") {
					writeJson(res, 400, { error: "id and standards are required" });
					return;
				}
				try {
					await store.setWorkspaceStandards(id, standards);
					writeJson(res, 200, { ok: true });
				} catch (error) {
					fail(res, error);
				}
			}
		},
		{
			kind: "exact",
			path: API.standardsAi,
			handler: async (req, res) => {
				if (!guard(req, res, "POST")) return;
				const body = await readJsonBody(req);
				const name = body === void 0 ? "" : typeof body.name === "string" ? body.name.trim() : "";
				if (name === "") {
					writeJson(res, 400, { error: "name is required" });
					return;
				}
				const tech = body !== void 0 && typeof body.tech === "string" && body.tech !== "" ? body.tech : "通用";
				const directory = body !== void 0 && typeof body.directory === "string" && body.directory !== "" ? body.directory : void 0;
				const hint = body !== void 0 && typeof body.hint === "string" && body.hint !== "" ? body.hint : void 0;
				try {
					const outcome = await generateStandardDraft(ctx, {
						name,
						tech,
						...directory === void 0 ? {} : { directory },
						...hint === void 0 ? {} : { hint }
					});
					if (!outcome.ok) {
						writeJson(res, 502, { error: outcome.error });
						return;
					}
					writeJson(res, 200, { body: outcome.text });
				} catch (error) {
					fail(res, error);
				}
			}
		},
		{
			kind: "exact",
			path: API.contextStats,
			handler: async (req, res) => {
				if (!guard(req, res, "GET")) return;
				try {
					const ws = await store.getCurrentWorkspace();
					if (ws === void 0) {
						writeJson(res, 200, {
							loadMode: "summary",
							directories: [],
							totalFiles: 0,
							totalDirs: 0,
							fileIndexTokens: 0,
							promptOverheadTokens: 0,
							standardsTokens: 0
						});
						return;
					}
					const codeIndexEnabled = ws.codeIndexEnabled ?? true;
					const summaries = codeIndexEnabled ? await summaryCache.get(codeIndexSignature(await codeIndexCache.get(ws.directories))) : void 0;
					const standardGroups = resolveStandardGroups(ws.standards, ws.directories, await standardsLibrary.get());
					writeJson(res, 200, await computeContextStats({
						directories: ws.directories,
						mode: ws.mode ?? "anchor",
						loadMode: ws.loadMode ?? "summary",
						fileIndexCache,
						tokenBudget: ws.tokenBudget ?? 6e4,
						codeIndexCache,
						codeConfig: {
							enabled: codeIndexEnabled,
							budget: ws.codeIndexBudget ?? 400,
							...summaries === void 0 ? {} : { summaries }
						},
						standardGroups,
						standardsBudget: ws.standards?.budget ?? 800
					}));
				} catch (error) {
					fail(res, error);
				}
			}
		}
	];
}
//#endregion
//#region src/host/index.ts
/** 稳定的 cordis 插件名（编排行 id）。 */
const name = PLUGIN_ID;
/** 宿主挂载前必须就绪的服务。 */
const inject = ["webServer", "systemPrompt"];
/** 把功能摘要合并进索引条目（无摘要时返回副本原样）。 */
function withSummaries(entries, summaries) {
	if (summaries === void 0 || summaries.size === 0) return [...entries];
	return entries.map((entry) => summaries.has(entry.feature) ? {
		...entry,
		summary: summaries.get(entry.feature)
	} : entry);
}
/**
* 挂载存储、路由、prompt 分节、会话监听与沙盒联动。
* @param ctx - 宿主插件上下文（webServer / systemPrompt）。
* @param config - 已解析插件配置。
*/
function apply(ctx, config = {}) {
	if (config.enabled === false) return;
	const store = new WorkspaceCombinerStore();
	const fileIndexCache = new FileIndexCache();
	const codeIndexCache = new CodeIndexCache();
	const summaryCache = new FeatureSummaryCache();
	const standardsLibrary = new StandardsLibraryStore();
	const selectionBySession = /* @__PURE__ */ new Map();
	const sessionWorkspaceBySession = /* @__PURE__ */ new Map();
	const renderedBySession = /* @__PURE__ */ new Map();
	if (config.announceToAgent ?? true) ctx.effect(() => ctx.systemPrompt.section({
		name: SECTION_NAME,
		order: 190,
		text: (context) => {
			const session = context.agent?.session;
			if (session === void 0) return "";
			const selected = selectionBySession.get(session.id);
			if (selected === void 0) return "";
			const cached = renderedBySession.get(session.id);
			if (cached !== void 0 && cached.snapshot === selected) return cached.text;
			const text = renderMultiWorkspacePrompt({
				workspaces: selected.directories,
				mode: selected.mode,
				loadMode: selected.loadMode,
				entries: selected.entries,
				tokenBudget: selected.tokenBudget,
				codeEntries: selected.codeEntries,
				codeIndexBudget: selected.codeIndexBudget,
				standardGroups: selected.standardGroups,
				standardsBudget: selected.standardsBudget
			});
			renderedBySession.set(session.id, {
				snapshot: selected,
				text
			});
			return text;
		}
	}), "dsh-workspace-combiner: prompt section");
	ctx.on("session/created", (session) => {
		if (session.header?.parentSession !== void 0) return;
		store.getCurrentWorkspace().then(async (ws) => {
			if (ws === void 0) return;
			const loadMode = ws.loadMode ?? "summary";
			const mode = ws.mode ?? "anchor";
			const directories = ws.directories.map((directory) => ({ ...directory }));
			const tokenBudget = ws.tokenBudget ?? 6e4;
			const codeIndexBudget = ws.codeIndexBudget ?? 400;
			selectionBySession.set(session.id, {
				directories,
				mode,
				loadMode,
				tokenBudget,
				entries: [],
				codeEntries: [],
				codeIndexBudget,
				standardGroups: [],
				standardsBudget: ws.standards?.budget ?? 800
			});
			sessionWorkspaceBySession.set(session.id, ws.id);
			store.touchWorkspaceSession(ws.id);
			const entries = await Promise.all(directories.filter((dir) => (dir.access ?? "readwrite") !== "disabled").map(async (dir) => {
				const counts = await fileIndexCache.count(dir.path);
				const base = {
					name: dir.name,
					path: dir.path,
					files: counts.files,
					dirs: counts.dirs,
					...counts.truncated ? { truncated: true } : {}
				};
				return loadMode === "summary" ? base : {
					...base,
					tree: await fileIndexCache.get(dir.path, { maxDepth: loadModeMaxDepth(loadMode) })
				};
			}));
			const baseCodeEntries = ws.codeIndexEnabled ?? true ? await codeIndexCache.get(directories) : [];
			const signature = codeIndexSignature(baseCodeEntries);
			const cachedSummaries = baseCodeEntries.length > 0 ? await summaryCache.get(signature) : void 0;
			const codeEntries = withSummaries(baseCodeEntries, cachedSummaries);
			const standardGroups = resolveStandardGroups(ws.standards, directories, await standardsLibrary.get());
			if (sessionWorkspaceBySession.get(session.id) === ws.id) selectionBySession.set(session.id, {
				directories,
				mode,
				loadMode,
				tokenBudget,
				entries,
				codeEntries,
				codeIndexBudget,
				standardGroups,
				standardsBudget: ws.standards?.budget ?? 800
			});
			if (baseCodeEntries.length > 0 && (ws.codeIndexSummary ?? "off") === "llm" && cachedSummaries === void 0) (async () => {
				const generated = await summaryCache.ensure(signature, () => summarizeFeatures(ctx, session.id, baseCodeEntries));
				if (generated.size === 0) return;
				if (sessionWorkspaceBySession.get(session.id) !== ws.id) return;
				const current = selectionBySession.get(session.id);
				if (current === void 0 || current.codeEntries !== codeEntries) return;
				selectionBySession.set(session.id, {
					...current,
					codeEntries: withSummaries(baseCodeEntries, generated)
				});
				renderedBySession.delete(session.id);
			})();
		});
	}, { global: true });
	ctx.on("session/disposed", (session) => {
		selectionBySession.delete(session.id);
		sessionWorkspaceBySession.delete(session.id);
		renderedBySession.delete(session.id);
	}, { global: true });
	ctx.effect(() => {
		const disposers = makeRoutes(ctx, store, fileIndexCache, codeIndexCache, summaryCache, standardsLibrary).map((route) => ctx.webServer.register(route));
		return () => {
			for (const dispose of disposers) dispose();
		};
	}, "dsh-workspace-combiner: routes");
}
//#endregion
export { apply, inject, name };

//# sourceMappingURL=index.js.map