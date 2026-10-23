# 构建「代码宇宙 Code Galaxy」三维工作区主控台插件的完整 Prompt

> 用法：把下面从「===BEGIN===」到「===END===」之间的整段内容，原样复制给任何 AI（DeepSeek / 豆包 / Claude 等）作为唯一指令即可。它自包含，不依赖任何额外对话。
>
> 背景：目标插件是 `dsh-code-graph-3d`（保留包名，产品名/面板标题叫「代码宇宙 Code Galaxy」），它要复刻参考插件 `dsh-workspace-combiner` 的双面插件架构与工作区能力，并把主界面做成一个**可飞行、可探索、可直接对 AI 下指令**的三维代码宇宙。

---

===BEGIN===

# 任务：把 DSH 插件 `dsh-code-graph-3d` 做成「代码宇宙 Code Galaxy」

你是资深的 Three.js 前端工程师 + 产品交互设计师。请把 DSH（DeepSeek Harness）插件 `dsh-code-graph-3d` 做成一个**三维工作区主控台**：把工作区组合器管理的工作区、项目、模块、符号、依赖、git 改动、会话，全部投射成一个可以自由飞行、层层下钻、随时对 AI 下指令的三维星系。它要同时满足：**好用（每个节点都能操作）、好玩（电影感动效）、充满探索（可无限穿梭、有景点）、无所不能（⌘K 命令面板把工作区/会话/任务/对 AI 的指令全部收进 3D 世界）**。

## 第一步：先读代码，再动手（必读，禁止跳过）

本任务在两个已存在的工程之间进行：

- **参考插件（复刻来源）**：`dsh-workspace-combiner`（与本工程同目录，路径通常是 `../dsh-workspace-combiner`）。它是双面插件的权威范本。
- **当前工程（要改造）**：`dsh-code-graph-3d`。已经有可复用的数据管线与 Three.js 骨架，不要推倒重写。

动手前完整阅读：

参考插件 `dsh-workspace-combiner`：
- `package.json`（双面插件：exports "." = host，"./client" = 浏览器；`dsh.client.inject` 列表）
- `cordis.patch.yml`（如何插入 cordis 编排表）
- `src/host/index.ts`（host 职责：store、路由、system prompt 分节、session 生命周期监听、沙盒联动）
- `src/routes.ts`（loopback 路由注册方式）
- `src/client/index.ts`（slots 注册 `sidebar.panellist` + `main` 面板、locale、`inject` 声明、`createPanelActions` 里的 `startSession/pickDirectory/registerDshWorkspace/openSession`）
- `src/client/panel/WorkspaceCombinerPanel.tsx`（面板挂载与工作区动作）
- `src/client/types.ts`（client 契约类型）

当前工程 `dsh-code-graph-3d`：
- `src/core/graphModel.ts` 与 `src/core/types.ts`（**已实现的带版本 node-link 折叠**：projects/modules/symbols/edges，含预算截断、空态、stats）
- `src/host/graph3d.ts`、`src/host/symbolScan.ts`、`src/host/fileIndex.ts`、`src/host/gitStatus.ts`、`src/host/workspaceStore.ts`（**已实现的扫描、缓存、按需索引、git 改动**）
- `src/host/index.ts`、`src/routes.ts`（现有 `/api/dsh-code-graph-3d/graph` 路由与 prompt 分节）
- `src/client/graph3d/`（已有 Graph3DScene/Graph3DBuilder/Graph3DLayout/Graph3DLayoutWorker/Graph3DColors/chunk 等）
- `src/client/index.ts`、`src/client/api.ts`、`src/client/Graph3DStore.ts`、`src/invariant.ts`、`tsdown.config.ts`

**原则**：数据管线（host 侧折叠、扫描、缓存、预算、按需索引、git）优先复用，不在前端重建图；主要投入放在 client 三维体验层与命令面板。字段名、接口签名一律以实际源码为准，不要臆测。

## 第二步：必须遵循的架构（双面插件 + 懒加载三维分片）

1. **host 半面**（node，`exports "."`）：只读工作区组合器持久化、注册 loopback `/api` 路由、注册 system prompt 分节、按需聚合图模型。**Three.js 绝不能进 host**。
2. **client 半面**（浏览器，`exports "./client"`）：通过 `ctx.slots.inject` 注册 `sidebar.panellist` 图标 + `main` 面板；主界面即三维宇宙。**Three.js 及后处理必须打进懒加载分片**（`invariant.ts` 里 `CLIENT_CHUNK_FILE = 'client.graph3d.js'`），面板首次打开时才 `await import()`，不拖慢 DSH 启动。
3. 用 `tsdown` 构建，node 侧出 `lib/host`，浏览器侧出 `lib/client.js` 与懒加载分片；`cordis.patch.yml` 与 `package.json` 声明保持规范。
4. 中文注释、统一 `console` 前缀、`.ts` 后缀 import、不引入运行时 CDN 依赖（three 及 addons 全部 bundle 进分片）。
5. 延续本工程 `scripts/*-smoke.ts` 的确定性冒烟测试模式（`node --experimental-strip-types`）。

## 第三步：产品定义——「代码宇宙」五层空间

核心体验：用户不是在看图表，而是**开飞船穿越自己的代码**，连续缩放、无缝下钻、随时操作。数据到空间的映射是**权威表**，逐项落实：

| 空间实体 | 对应数据 | 视觉表现 |
|---|---|---|
| 星系（galaxy） | 工作区 / 多个项目目录 | 漂浮的星系，L0 全景层 |
| 中央恒星（star） | 项目目录 | 大发光体，颜色=工程类型(Java/Vue/React/Python/Go/…) |
| 行星（planet） | 模块/包 | 绕恒星轨道运行；大小=文件数；亮度=可写亮/只读暗 |
| 光点云（points） | 符号（类/函数） | 环绕行星的 `THREE.Points` 光点（氛围层，见精度边界） |
| 能量流（energy flow） | 依赖边 | 沿路径流动的光带；import=主流实线、测试=虚线、符号=微光 |
| 脉冲光环 | git 改动文件 | 改动节点周期性脉冲 |
| 飞船信标（beacon） | 正在运行的会话 | 绕恒星的发光飞行器 |
| 红色旋涡（POI） | 循环依赖 | 异常/奇观景点，引导用户发现 |

## 第四步：详细需求

### 4.1 复刻与边界（硬约束）

- **复刻工作区组合器的核心能力并在 3D 内全部可达**：读取工作区/项目列表、目录可写/只读、`startSession`、`pickDirectory`、`registerDshWorkspace`、打开/切换会话、刷新图、预算与符号层开关。这些在三维里都能触发，不能退回纯二维面板才能完成。
- host 只读工作区目录与工作区组合器持久化，不写项目文件、不改组合器行为。
- **精度边界（诚实，避免误导）**：文件/模块级 import 定位是可靠的（正则解析 import 足够），把它作为导航与依赖主路径；符号层用**光点氛围**呈现，不要把符号光点包装成"精确调用关系"（当前无 AST 扫描，符号依赖只是启发式）。界面措辞不得宣称"精确到方法的调用图"。

### 4.2 host 数据管线（复用 + 必要扩展）

- 复用 `foldGraphModel` 的带版本 node-link（projects/modules/symbols/edges/stats/warnings）。
- 按需补充「宇宙导航所需」的派生数据（可在 host 聚合或由 node-link 纯函数计算，必须可单测）：
  - 每个节点的层级（depth）、父节点、规模、`access`、`projectType`、`changed`。
  - 依赖边聚合权重；**检测循环依赖**（输出成环路径，用于红色旋涡 POI）。
  - 计算每个项目的"规模/热度"用于恒星大小（如文件数、模块数）。
  - 景点 POI 列表：最大模块、循环依赖、测试最密集模块（至少这三类）。
- 路由支持预算/深度/刷新参数（沿用现有 `graph` 接口约定），新增派生数据时保持**向后兼容的 `version` 契约**，并在 smoke 中校验。

### 4.3 三维宇宙（client）

**场景与层级**
- `WebGLRenderer`(antialias、alpha、适配设备像素比) + `PerspectiveCamera`；深空背景 + 星尘粒子 + 雾（Fog/FogExp2）营造纵深。
- 五个层级 L0 星系→L1 恒星→L2 行星→L3 符号光点，**连续缩放、相机 fly-to 无缝下钻**（带缓动的相机动画，不是硬切）；上钻/下钻时按 LOD 显隐。
- 每个项目星系：恒星居中，行星沿 `CatmullRomCurve3` 或环形轨道缓慢自转公转，进入时有"炸开成型"动画。

**动效（电影感，全部要做）**
- 后处理 `EffectComposer + RenderPass + UnrealBloomPass` 辉光（性能受限时提供降级开关）。
- 依赖能量流：沿线运动的光粒子/流光，表达依赖方向。
- 节点呼吸、git 改动脉冲、选中聚焦、悬停放大与高亮。
- 相机穿越飞行、点击爆炸式展开、空场景入场动画。
- 提供至少 1 套可切换世界皮肤（深空 / 赛博 / 极简三选一，先做一套也可，但要预留换肤接口）。

**交互（好用，逐项实现）**
- `OrbitControls` 旋转/缩放/平移 + 拾取（`Raycaster`）：hover 显示标签（名、类型、路径、文件数、改动），点击聚焦并展开详情。
- 点击恒星：项目详情（路径、语言、文件数、会话数、可写性）+ 操作按钮。
- 点击行星：模块详情（文件树、依赖谁、被谁依赖、测试）。
- 点击符号：定位 `file:line`，并给动作：**解释它 / 改它 / 写测试 / 让 AI 重构**（通过命令面板向 agent 发指令）。
- 点能量流：高亮整条依赖路径，无关星系变暗（可再次点击取消）。
- 右键/详情面板：新建会话、设为主目录、注册工作区、只读切换、打开会话。
- **搜索=传送门**：输入符号/模块/文件名，相机穿越飞至目标并高亮。
- 小地图（minimap，可用顶视正交小渲染或 2D 覆盖层）+ 当前位置指示，防迷路。

**探索（充满探索）**
- 自动巡航：一键切自动驾驶，相机沿样条轨道游览整个代码库；可随时退出接管。
- 景点导览 POI：自动标出"最大模块""循环依赖红色旋涡""测试最密集星球"，点击飞到该处。
- 无边界、可无限缩放、距离 LOD；远处符号合并为点。

**⌘K 命令面板（无所不能，核心）**
- 场景内悬浮命令面板（⌘K 唤起），支持模糊搜索命令，全部工作区动作可在此触发：新建会话、选目录、注册工作区、切换/打开会话、刷新图、调预算、切符号层、换皮肤、开关巡航。
- 可直接对 AI 下指令并把当前选中节点作为上下文，例如："解释这个模块""给这个文件写测试""重构这个模块""在这个项目新建会话"。这些动作复用 `createPanelActions` 的会话/工作区 API，并把目标路径/符号拼进指令。
- 命令面板是整个 3D 世界的统一操作入口，任何后续数据（任务、token 用量、诊断）都能在此扩展。

### 4.4 性能（必须达标）

- 符号光点用单个/少量 `THREE.Points` + `BufferGeometry`（自定义 `ShaderMaterial` 或 PointsMaterial），禁止为每个符号建独立 Mesh。
- 布局计算放 Web Worker（复用已有 `Graph3DLayoutWorker`）；启用视锥剔除与距离 LOD；预算复用现有 `symbolBudget/moduleDepth`，符号层默认不常驻全量。
- 面板卸载必须**释放资源**：取消 requestAnimationFrame、dispose renderer/几何体/材质/后处理、terminate worker、解绑事件，避免 DSH 反复打开面板导致内存泄漏。
- 监听窗口 resize；后处理与高 DPI 提供降级开关，保证中低端机器可交互。

### 4.5 建议目录结构（在现有基础上演进，可微调）

```
src/
  core/graphModel.ts        # 复用 + 派生：循环依赖/POI/热度（纯函数，可单测）
  host/graph3d.ts           # 复用：扫描/折叠/缓存/按需索引，按需扩展派生数据
  routes.ts                 # 复用 graph 接口，新增派生数据保持版本兼容
  client/
    index.ts                # 注册 sidebar 图标 + main 面板（面板内懒加载宇宙）
    graph3d/
      GalaxyUniverse.ts     # 场景总控：renderer/scene/camera/后处理/RAF/dispose
      GalaxyLayers.ts       # L0~L3 层级构建与 LOD 显隐
      GalaxyBuilder.ts      # GraphModel → 恒星/行星/光点/能量流/信标
      GalaxyEnergy.ts       # 依赖能量流（流光粒子/曲线）
      GalaxyEffects.ts      # Bloom/脉冲/呼吸/入场/穿越动画
      GalaxyControls.ts     # OrbitControls + Raycaster 拾取 + fly-to
      GalaxyAutopilot.ts    # 样条轨道自动巡航
      GalaxyCommandPalette.tsx  # ⌘K 命令面板（工作区动作 + 对 AI 指令）
      GalaxySearch.ts       # 搜索传送门
      GalaxyMinimap.ts      # 小地图
      GalaxySkins.ts        # 皮肤主题
      Graph3DLayout*.ts     # 复用 Worker 布局
      Graph3DPanel.tsx      # 面板容器（Canvas + HUD + 详情卡 + 命令面板）
```

## 第五步：分期出片（每阶段必须可运行、可验证）

1. **v0.1 先出"哇"**：复刻骨架跑通 → 打开面板即进入深空场景，工作区→项目→模块三级成型，Bloom、星尘、自转、OrbitControls 正常。
2. **v0.2**：下钻符号光点云 + 依赖能量流 + hover 标签 + 点击详情。
3. **v0.3**：相机 fly-to 穿梭 + 搜索传送门 + 依赖路径高亮 + 小地图。
4. **v0.4**：自动巡航 + POI 景点（含循环依赖红色旋涡）+ git 脉冲 + 会话信标。
5. **v0.5**：⌘K 命令面板（全部工作区动作 + 对 AI 指令）+ 换肤 + 性能降级 + 空态/错误态 + 资源释放。

## 第六步：验收标准（逐条核对）

1. 双面 `tsdown` 构建通过、`tsc --noEmit` 通过；`cordis.patch.yml`、`package.json` 正确声明，DSH web 客户端能加载新侧边栏图标。
2. 打开面板即懒加载三维分片并进入宇宙：深空背景、星尘、Bloom、轨道自转，交互流畅。
3. 五层映射与权威表一致：星系/恒星/行星/光点/能量流/脉冲/信标/红色旋涡，颜色编码正确（工程类型、可写性）。
4. 连续缩放 fly-to 下钻/上钻正常；hover 标签、点击三级详情（项目/模块/符号）可用。
5. 搜索传送、依赖路径高亮、自动巡航、至少 3 种 POI 可用。
6. ⌘K 命令面板可：新建会话、选目录、注册工作区、切换/打开会话、刷新/预算/换肤/巡航，以及"解释/写测试/重构"对 AI 指令（带当前选中节点上下文）。
7. 性能：预算内万级符号用 Points 不卡顿；面板反复打开关闭无内存泄漏（RAF/worker/renderer 已释放）；有后处理降级开关。
8. 无工作区/目录不可读/扫描截断时有空态与错误态，不白屏；warnings 可见。
9. 复用并扩展 `foldGraphModel` 派生数据（循环依赖/POI/热度）有确定性 smoke 测试；现有 smoke 不回归；不破坏 `dsh-workspace-combiner`。
10. 符号层措辞遵守精度边界，不宣称精确方法调用图。
11. README 写明安装方式、操作方式（飞行/点击/搜索/巡航/⌘K）、性能与降级开关。

## 第七步：工作方式要求

- 严格按 v0.1→v0.5 分期推进，每阶段先自测可运行再继续；不要一次堆完所有功能。
- 优先复用 `dsh-code-graph-3d` 的 host 数据管线与 `dsh-workspace-combiner` 的 client 动作，再增量做三维体验，避免重写已验证的逻辑。
- Three.js 具体 addon 导入路径以**实际安装的 three 版本**为准（`three/examples/jsm/...` 或 `three/addons/...`），不确定就先确认版本。
- 字段/接口名一律以实际源码为准；保持克制，只做代码宇宙要求，不扩展无关功能。
- 遇到确实做不到的点，明确说明原因与影响，不悄悄降级后宣称完成。

请从 v0.1 开始实现。

===END===

---

> 提示：整段复制 `===BEGIN===` 与 `===END===` 之间的内容给 AI。如果 AI 看不到相邻的 `dsh-workspace-combiner` 工程，请把两个仓库都放到它可访问的目录，并在开头注明参考工程的绝对路径。
