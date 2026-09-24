# dsh-workspace-combiner · 工作区组合器

DSH（DeepSeek Harness）桌面端 / Web 端 Cordis 插件。在左侧侧边栏注册一个
**「工作区组合器」** Tab（与「多根」插件并排），勾选多个工作区（后端仓库 +
前端仓库），保存/加载项目组合模板；**新建会话**时自动把选中仓库的绝对路径注入
system prompt（多工作区联合开发模式），并联动
[`@chaoset/sandbox-extra-roots`](https://github.com/winliyou/dsh-plugins) 把选中
目录加入沙盒 extraRoots 白名单，放开文件读写权限。

- 双面插件：`src/host`（Cordis host 半面）+ `src/client`（React 浏览器半面）。
- 全部基于官方 npm SDK，无需改 DSH 源码，`dsh plugin` 本地目录加载即可用。

---

## 功能

- 侧边栏 Tab 面板（`sidebar.panellist` + `main` 插槽），与「多根」等全局面板并排。
- 自动读取 DSH 全部已注册工作区（宿主 `useWorkspaces` 快照），复选框多选。
- 每个工作区行展示：复选框、工作区名称、本地绝对路径。
- 项目组合模板：命名勾选组合（如「infoxmed 后端 + AI-FE 前端」），本地持久化，
  一键加载 / 删除；模板存「绝对路径 + 名称」，加载时自动把未注册的路径注册成 DSH
  工作区再恢复勾选（模板可移植、可重建）。
- **新建会话** 按钮 / **加载并新建**：勾选后（或加载模板后）直接在 **首个勾选工作区**
  中新建并打开会话，其余工作区作为只读仓库注入。
- 新建会话时注入多工作区联合开发 prompt（仅新建会话，旧会话不受影响）。
- 联动 `@chaoset/sandbox-extra-roots` 放开选中目录读写白名单（热更新）。

## 架构

```
dsh-workspace-combiner/
├── package.json            # dsh 字段：bundle.patch + client.inject（slots/locale/sessions/workspaces）
├── cordis.patch.yml        # 编排行：把插件插入 profile
├── tsconfig.json           # typecheck
├── tsdown.config.ts        # 双入口构建：host + client
└── src/
    ├── invariant.ts        # 双面共享常量（插件 id / API 路径 / prompt 排序）
    ├── core/types.ts       # 双面共享类型（WorkspaceRef / Template / StoreShape）
    ├── prompt.ts           # 多工作区联合开发模式 prompt 渲染
    ├── store.ts            # host 持久化（~/.dsh/dsh-workspace-combiner.json）
    ├── sandbox-sync.ts     # 联动 sandbox-extra-roots（热更新 + 回退写盘）
    ├── routes.ts           # /api/dsh-workspace-combiner 路由族（loopback-only）
    ├── host/index.ts       # host 入口：prompt 分节 + session/created 监听 + 路由
    └── client/
        ├── index.ts        # client 入口：注册侧边栏图标 + 中心列面板
        ├── types.ts        # client 局部类型（结构镜像，规避版本碎片化）
        ├── locales.ts      # zh/en 词典 + tt 助手
        ├── api.ts          # client -> host fetch API
        └── panel/
            ├── WorkspaceCombinerPanel.tsx   # 面板 body + 图标
            ├── controller.ts                # 状态管理（多选/模板）
            └── styles.ts                  # 内联样式（<style> 注入，跟随 DSH 主题变量）
```

### 数据流

```
[client 面板] --POST /api/.../selection--> [host store]
                                              │
                              session/created（顶层新会话）
                                              ▼
                         selectionBySession: sessionId -> WorkspaceRef[]
                                              ▼
                    systemPrompt.section(text 函数按会话渲染)
                                              ▼
                    注入「# 多工作区联合开发模式生效 …」区块
```

勾选变化时，host 同时调用 `sandbox-extra-roots` 的远程服务
`sandboxExtraRootsConfig.set({ extraWritableRoots })` 做热更新；远程不可用时回退
为原子写 `~/.dsh/plugins/sandbox-extra-roots/config.json`（重启后生效）。

---

## 安装（本地目录加载）

> 前置：已安装并启动过 DSH（`dsh` CLI 可用），且 **先安装依赖插件**：

```bash
# 0) 依赖插件：沙盒额外目录白名单（必须）
dsh plugin --profile desktop add @chaoset/sandbox-extra-roots
# 或者 web 端
dsh plugin --profile web add @chaoset/sandbox-extra-roots
```

```bash
# 1) 进入插件目录，构建出 lib/（host 半面 + client bundle）
cd /path/to/dsh-workspace-combiner
pnpm install
pnpm build          # tsdown 产出 lib/host/index.js 与 lib/client.js

# 2) 本地目录加载插件（desktop 端）
dsh plugin --profile desktop add file:./dsh-workspace-combiner
#   或 web 端
dsh plugin --profile web add file:./dsh-workspace-combiner

# 3) 验证已安装
dsh plugin --profile desktop ls dsh-workspace-combiner

# 4) 重启 harness 生效
#   桌面端：重启 DSH Desktop
#   web 端：重新执行 dsh web
```

> `file:` 安装的是自包含副本（不保留到源码目录的符号链接/junction）。改动源码后需
> 重新 `pnpm build`，再重装一次。桌面端通常是：
> `dsh plugin --profile desktop remove dsh-workspace-combiner` 然后
> `dsh plugin --profile desktop add file:./dsh-workspace-combiner`。

### 卸载 / 更新

```bash
dsh plugin --profile desktop remove dsh-workspace-combiner
dsh plugin --profile desktop update dsh-workspace-combiner   # 若走 npm
```

---

## 使用说明

1. 打开侧边栏，点击 **「工作区组合器」** Tab。
2. 面板会列出 DSH 全部已注册工作区（复选框 + 名称 + 绝对路径）。
3. 勾选需要的多个工作区（如后端仓库 + 前端仓库）。
4. 点击 **新建会话**：本插件先把勾选持久化到宿主，再在 **首个勾选的工作区** 中新建
   并打开会话（其余工作区作为只读仓库注入）。
   - 或先输入模板名点 **保存模板**，之后点 **加载并新建** 一键恢复勾选并开新会话。
   - **清空选择** 取消全部勾选。
5. 新会话创建后，本插件监听会话创建，把当前勾选的工作区绝对路径注入 system prompt，
   并把选中目录加入沙盒白名单。

> ⚠️ **勾选只对「之后新建的会话」生效**：已经打开的旧会话不会重新加载本次勾选配置
> （面板顶部有同样提示）。

### 注入的 prompt（自动追加到 system prompt）

```text
# 多工作区联合开发模式生效
当前会话加载【2】个独立Git仓库：
1.【infoxmed-backend】绝对路径：/Users/you/code/infoxmed-backend
2.【AI-FE】绝对路径：/Users/you/code/ai-fe

开发强制规则：
1. 读写文件、查看代码必须使用完整绝对路径，禁止相对路径
2. 多个仓库Git相互独立，提交互不干扰
3. 做接口变更时，同步修改后端代码与前端请求代码
4. 终端执行命令，必须填写文件完整绝对路径，不允许直接使用相对路径执行
```

---

## 配置（可选）

插件无 schema，配置项写在编排行 config（`cordis.patch.yml` 的 `config`）或
profile 的 cordis.patch.yml 里：

```yaml
workspace-combiner:
  enabled: true          # 总开关
  announceToAgent: true  # 是否注入多工作区 prompt 分节
```

---

## 关键设计 / 约束

1. **会话 shell 只有一个 cwd，无法修改**：插件不尝试改 cwd，靠 prompt 强制模型
   使用绝对路径（规则 1、4）。
2. **仅新建会话生效**：`session/created` 时快照勾选、绑定到该会话 id；旧会话、
   子代理/分支会话（带 `parentSession`）不注入。这就是需求里 `session:before-start`
   在 DSH 里的真实事件名（DSH 事件用 `/` 分隔）。
3. **依赖声明**：`package.json` 的 `dsh.client.inject` 声明客户端服务
   `slots` / `locale` / `sessions` / `workspaces`（`sessions` 提供
   `create({ workspaceId })` + `open` 新建会话流程，`workspaces` 提供
   `create({ path })` 按路径自动注册工作区）；`peerDependencies` 声明宿主服务与
   `@chaoset/sandbox-extra-roots`。需求里的「dshPlugin 字段」即 `package.json` 的
   `dsh` 字段。
4. **适配 Desktop 与 Web**：host 半面用 `webServer` 路由 + `systemPrompt`，client
   半面用 `slots`（`platform: "web"`），两端通用；`dsh.host: "0.1.5-rc.2"` 标注
   适配的宿主版本。

---

## 开发 / 调试

```bash
pnpm install
pnpm typecheck     # tsc --noEmit
pnpm build         # tsdown -> lib/host/index.js + lib/client.js
pnpm watch         # 监听重构建
```

调试要点：

- **host 日志**：勾选变化/沙盒联动失败会 `ctx.logger.warn(...)`。
- **持久化文件**：`~/.dsh/dsh-workspace-combiner.json`（勾选 + 模板，0600）。
- **沙盒配置**：`~/.dsh/plugins/sandbox-extra-roots/config.json`（extraWritableRoots）。
- **web 端**改完 `src/client` 后需重建 `lib/client.js` 并刷新页面；桌面端同理需重装
  或同步 `lib/` 后重启。

## License

MIT
