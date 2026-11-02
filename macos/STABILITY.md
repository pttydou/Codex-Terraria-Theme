# Dream Skin 稳定性说明

实际升级与修复按 [UPGRADE_CHECKUP.md](UPGRADE_CHECKUP.md) 执行；本文解释架构与改造方向。未来方案不代表已实现，自动体检不代替必测页面验收。

这套皮肤不是 Codex 的官方主题插件，而是通过本机 loopback CDP 连接 Codex 的 Chromium renderer，把一段受控的 JavaScript 和 CSS 注入当前页面。注入器由 `scripts/injector.mjs` 负责，渲染逻辑在 `assets/renderer-inject.js`，视觉规则在 `assets/dream-skin.css`。

升级后需要检查，但并非每次都应该修改皮肤。只有依赖的节点、颜色语义、挂载时机或注入链路变化，才需要适配。当前最有价值的目标是减少对 Codex 内部结构的依赖，并把必要的依赖集中到少量模块。

## 当前注入链路

1. 启动脚本查找或启动带 CDP 端口的 Codex/ChatGPT 进程。
2. 注入器连接 `127.0.0.1:9341`，只接受 `app://` 页面目标。
3. 通过 `Page.addScriptToEvaluateOnNewDocument` 注册早期脚本。现在早期脚本会先放置一个很小的字体基线，等待页面真正出现主内容区、侧栏和 Composer 后，再执行完整皮肤。
4. 完整渲染器添加 `codex-dream-skin` 根标记，识别当前路由和语义节点，再给主内容区、Header、Composer、设置卡片等节点添加皮肤自有标记。主内容区同时支持原生 `main` 和 `[role="main"]`，视觉 CSS 只依赖皮肤自己的主内容标记，因此 Codex 更换标签时不会出现“诊断通过但主界面没有主题”的半失效状态。
5. 主内容、Composer 等规则已经使用自有标记，但隔离还不完整：视觉 CSS 仍直接使用 `_markdown`、CodeBlock、`bg-primary-*`、`bg-gradient-to-t` 和 `:first-child` 等内部信号。它们仍会随着 Codex 改动而失效；不能把“已建立适配器注册表”说成“已完成解耦”。
6. MutationObserver、ResizeObserver 和路由扫描负责处理异步挂载、路由切换和尺寸变化；文档重载后会重新注册早期脚本，并且只在当前文档丢失皮肤标记时补注入；前端能力契约持续检查关键能力。
7. 首次文档挂载有一次 8000ms 宽限；页面稳定后的主内容区或可见输入区持续无法发现时，等待 1200ms 复检，仍失败就进入安全模式，禁用皮肤并保留官方界面可用。

2.7.14 起，CSS 还会给 Codex 新版首页外围那个未标记的 `<main>` 提供主题背景兜底。新版空会话会先绘制这个包装层，内层 `[role="main"]` 尚未铺满时若仍使用官方浅色背景，就会出现顶部白带或右侧白边；这条规则只覆盖未标记的外围 `main`，不会接管 renderer 自有主内容标记。

2.7.15 起，启动脚本通过 Node 的 detached session 托管 watcher。这样关闭启动它的 VS Code 任务或终端不会把 watcher 留在同一个进程组里，状态文件中的 PID 也就是实际长期运行的注入器 PID。

## 为什么 Codex 升级会影响皮肤

影响通常来自 renderer 的实现细节变化，而不是版本号本身：

- Composer 从一个 DOM 容器换成另一个容器，或稳定的 `data-*` 属性被删除；
- Header、侧栏、设置页从 `main` 或 `aside` 移到新的路由根；
- CSS Module 哈希和 utility class 改名，原生背景、字体或层叠顺序发生变化；
- 页面从同步绘制改成异步挂载，首个 RAF 时节点还没有出现；
- Electron/Chromium 更新改变 webview、伪元素、字体加载或层叠行为；
- Codex 进程名、bundle 路径或 CDP 启动参数变化。

注入端口不再只写死在脚本里。默认仍是 `9341`，但启动、验证、恢复、菜单栏和注入器都读取 `CODEX_DREAM_SKIN_PORT`；以后 Codex 或本机已有调试端口冲突时可以只改这一项。

其中 CSS Module 哈希和 DOM 顺序最容易造成维护成本，所以视觉 CSS 不应该直接把它们当成长期接口。当前适配器已经优先使用 `data-composer-*`、`data-settings-panel-slug`、`data-feature="game-source"`、`textarea` 和 `contenteditable` 等语义信号，并保留旧 class 作为回退。

## 字体为什么会延迟

过去完整注入要等到主内容区和侧栏都出现。Codex 首屏先按自己的 CSS 绘制，等早期脚本确认目标页面后，才插入完整样式并把 `codex-dream-skin` 加到根节点，所以会看到“上面的字体”短暂出现，之后才切成皮肤字体。

2.7.11 增加了独立的 `codex-dream-skin-early-style`。它只设置页面级字体和表单控件字体，不负责背景、布局、装饰和路由判断。2.7.12 将它与完整 Terraria 规则统一为同一套系统 UI 字体；代码、路径和少量像素标签仍通过局部规则使用等宽字体。完整皮肤接管后继续使用原来的 CSS；安全模式、撤销皮肤和页面清理会同步禁用或移除这段基线。这样能缩短字体切换窗口，也不会让早期脚本承担完整主题的误判风险。

## 后续适配应该改哪里

以后遇到小版本更新，优先按这个顺序处理：

1. 先运行验证入口，查看 JSON 中的 `frontendCompatibility`、`discovery`、`criticalMissing` 和 `fingerprint`。
2. 如果只有 `adaptive` 或某个可选能力缺失，先确认是否为预期路由/可接受回退。设置页没有会话 Composer、任务页没有首页通知都正常；仅在实际能力失效时修改对应的 `find*` 适配器。
3. 如果 Composer 或主内容区确实换了结构，增加一个语义或几何回退；不要直接把新 CSS Module 哈希扩散到整份 CSS。
4. 只有视觉变化时才修改 `dream-skin.css`。布局发现和视觉规则分开后，Codex 升级通常只需要改适配器。
5. 如果进入安全模式，先保存 verify 输出和截图，再执行 `retryFrontendCompatibility` 或重新注入；不要先删掉安全回退。

2.7.13 还补了 `[role="main"]` 的完整视觉和清理路径，并统一了 CDP 端口配置。适配新版本时，先看 `discovery.main` 是 `main` 还是 `role-main`，再看 `frontendCompatibility.status`；两者正常只能证明发现路径可用，颜色、字体、白边仍需真实页面检查。

适配器输出的 `discovery` 会说明当前使用的是 `main`、`role-main`、稳定 Composer 属性、编辑器回退、导航语义回退还是设置面板属性。它比只记录 Codex 版本号更适合定位升级影响。

2.7.25 起，契约还会输出 `adapters` 注册表。每项包含 `required`、`status`、`selected`、
`primary`、`fallback` 和 renderer 自有 `marker`。升级后可直接运行：

```bash
npm run --silent compatibility-report
```

报告里的 `missingRequired` 表示当前路由要求但尚未发现的能力，`fallbackAdapters` 表示使用了回退路径。2.7.26 的 `recommendedAction` 区分：

| 值 | 下一步 |
| --- | --- |
| `refresh-runtime` | 皮肤未安装、契约不完整或运行版本旧；先恢复/更新注入器 |
| `wait-and-recheck` | 仍在启动宽限或路由确认期，等待后复检 |
| `update-adapter` | 关键能力持续失效，定位对应发现逻辑 |
| `inspect-runtime` | 样式禁用、安全模式或状态未知，检查运行状态 |
| `inspect-fallback` | 查看回退是否符合当前页面，不能直接判失败 |
| `none` | 当前结构无须处理，继续受影响页面的视觉检查 |

这一步只读取当前 renderer，不会重启 Codex 或切换主题。

2.7.26 起，报告还会输出 `diagnostics` 和 `diagnosticFingerprint`。每个适配器都会记录：

- `primaryCount` / `primaryVisibleCount`：主选择器实际命中和可见命中数量；
- `fallbackCount` / `fallbackVisibleCount`：回退候选是否仍存在；
- `markerCount` / `markerVisibleCount`：renderer 自有标记是否已经成功落到节点上。

这三个维度可以把升级后的问题分成三类：主选择器失效、节点仍在但不可见、节点已发现但主题 marker 丢失。`diagnosticFingerprint` 只用于排查和记录，不参与安全模式断路器，避免异步挂载时命中数量变化造成额外闪烁。兼容性维护因此收敛为“先看报告，再改对应适配器”，不需要先全量试 CSS。

计数需要结合路由和 marker 用途理解。导航候选可以不止一个；首页和设置 marker 计数的是被接管的浅色卡片，没有这种卡片时允许为 0。主内容和可见 Composer 的自有标记才应保持唯一。当前 fingerprint 是可见数量摘要，不是完整 DOM 哈希，也没有自动和历史基线比对。

## 这轮修复的复盘

不能把所有问题都归因于 Codex 更新。已有记录至少包含以下不同根因：

| 现象 | 已有证据支持的根因 | 应改的位置 |
| --- | --- | --- |
| 新会话、代码栏、通知白边 | 新增容器或绘制层未覆盖 | 对应组件发现与局部视觉规则 |
| 设置卡片正常后又变蓝/变白 | 用已被主题染色的结果反推是否应接管，形成反馈 | ownership 保持与重复扫描测试，见 ST-001 |
| 按钮文字看不清 | 卡片通用文字色覆盖按钮自身配色 | 按钮前景和背景成对定义，见 ST-002 |
| 刷新时短暂回到官方白底 | 慢挂载被固定超时误判成失效 | 生命周期与确认窗口，见 ST-004 |
| 代码更新但运行版本仍旧 | watcher 启动时读取 VERSION；主题热更新不会重载注入器进程 | 重启 watcher 并核实实际 payload，见 ST-007 |

之前处理不足在于：多次按局部白边补规则，未先归类发现、配色、生命周期三种问题；部分测试只检查源码包含某条 CSS，不能证明浏览器布局正确；一次稳定截图不能覆盖延迟扫描和刷新。今后源码测试、结构契约、实际交互和延迟截图分别记录，历史 100 分不能继承到新的版本。

## 降低后续适配量的改造顺序

1. **基础配色与字体优先使用官方外观设置。** [官方设置文档](https://developers.openai.com/codex/app/settings/) 已列出 Accent、Background、Foreground、UI font、Code font 和主题导入。此轮已读取该文档；本机具体导入格式及迁移后视觉仍需验证。官方外观设置与对内部 DOM 注入 CSS 是不同的扩展边界，不能说 Codex 完全没有主题能力。
2. **环境图、伙伴、音乐控制采用皮肤自己的装饰节点。** 让游戏资源与业务 DOM 分开，逐步隔离装饰样式；Shadow DOM 可以隔离伙伴/控制按钮的 CSS，却不能给外部的原生输入框和按钮自动换肤。保留音乐/背景及原有审美，迁移时逐项验证。
3. **剩余原生控件适配按组件收口。** 优先代码块工具栏、通知、快速聊天和设置按钮；一个组件的发现、标记、清理、诊断及 fixture 放在一起。`data-*` 和 ARIA 比哈希 class 更可用，但仍不是本项目可依赖永久不变的官方 DOM 契约。
4. **限制几何修改及失败影响。** 尽量保留 Codex 的输入框宽度、滚动、定位；仅经真实回归证明必要时修改。未来可给装饰能力增加局部降级，关键输入/主内容继续保留全局安全模式。
5. **升级先做同场景对比，再决定是否发版。** 同主题、窗口尺寸、路由和挂载阶段比较诊断及截图；没有回归就不改。每次根因修复补对应行为回归，逐步替换只匹配源码字符串的测试。

上面是后续迁移方案；2.7.26 实际完成的是诊断计数、报告误判修正和相关回归，尚未实现原生主题迁移、全组件分拆或自动视觉差异检测。保持完整沉浸皮肤时无法保证零维护；通过减少内部依赖，可让多数小改动只影响一个适配器。

## 更新运行版本

修改 `VERSION` 或 `scripts/injector.mjs` 后，不能仅依赖 CSS/主题的热更新。先核对当前 loopback CDP 可用，再运行：

```bash
./scripts/start-dream-skin-macos.sh --port 9341
./scripts/compatibility-report-macos.sh --port 9341
./scripts/verify-dream-skin-macos.sh --port 9341
```

在已有有效 CDP 连接时，启动脚本只替换已验证身份的 watcher，使用当前暂存主题并登记新文档脚本。一次性调试注入应传当前 `~/Library/Application Support/CodexDreamSkinStudio/theme`，不要把 `assets` 默认样例当作用户的当前主题。此命令不等于重装原生控制台或发布 GitHub 版本。

## 验证重点

每次 Codex 升级后至少检查：

- 首屏字体是否在页面可见前已经应用；
- 首页、任务页、设置页来回切换时字体和主题是否保持；
- Composer 是否仍有且只有一个自有标记；
- 没有关键节点时是否在确认后进入安全模式；
- 官方按钮、输入框和设置页在安全模式下仍可操作。

当前验证脚本会检查能力契约、样式是否实际启用、Composer 归属、溢出和安全模式。Windows 和 macOS 如果继续共用渲染器，需要同步早期字体基线和契约字段。


## 2.7.27 的检验入口

已实现的增量是[一键检验工具](INSPECTION.md)：主窗口连续采样、截图边缘像素抽查、对比度保守计算、同场景历史结论比较，以及原生 macOS 控制台入口。报告把故障、疑似、待复核和未测分开，关联错题本；连接失败也保存报告。

这不是自动修复器、全页面遍历或完整视觉差分。它降低每次升级的定位成本，仍需按完整清单补测未进入的页面和刷新时序；原生主题迁移与全部组件拆分尚未实现。
