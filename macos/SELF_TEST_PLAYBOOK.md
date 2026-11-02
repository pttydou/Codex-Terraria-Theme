# Codex Dream Skin 自测与复盘错题本

更新/修复入口为 [UPGRADE_CHECKUP.md](UPGRADE_CHECKUP.md)；本文维护评分和历史根因。`npm run checkup` 生成本轮证据与待补清单，不继承以下历史分数。

这份文档是每次修改皮肤、升级 Codex 或切换主题环境后的固定检查单。目标是先验证真实页面，再判断代码测试；发现问题时记录现象、根因、修复和回归证据，后续优先复用已经验证过的方案。

## 适用范围

当前检查基线是 macOS 本地 Codex/ChatGPT renderer，通过 loopback CDP 端口注入 Dream Skin。Windows 镜像、真实发送消息、联网业务结果属于额外范围，未执行时必须标记为“未覆盖”，不能写成通过。

2.7.26 起，兼容性报告还要保存 `diagnostics` 和 `diagnosticFingerprint`。只对当前路由应出现的能力比较 `primaryVisibleCount`、`fallbackVisibleCount` 和 `markerVisibleCount`：主命中为 0 时排查发现路径，主内容/Composer 已发现但 marker 为 0 时排查标记/清理。首页通知、设置浅色卡片等可选节点不存在时允许计数为 0。报告范围为 `current-renderer-structure`，不替代颜色、可读性或其他页面验收。

运行前记录：

```bash
cd ~/.codex/codex-dream-skin-studio
./scripts/status-dream-skin-macos.sh --deep
./scripts/doctor-macos.sh --require-live
```

需要保存的基线信息：皮肤 `VERSION`、Codex 版本、Node 版本、CDP 端口、当前主题名称、`frontendCompatibility.status`、`discovery`、`fallbacks` 和安全模式状态。

## 评分规则

本地 macOS 检查满分 100 分。每一项只有在真实证据满足“预期结果”后才得分；`partial` 只得该项一半分，`unverified` 不得分。

| 编号 | 检查项 | 分值 | 通过条件 |
| --- | --- | ---: | --- |
| A1 | 源码、夹具和资源测试 | 15 | `npm test` 与 `npm run test:browser` 全部通过；零测试/缺依赖不算通过 |
| A2 | 语法、payload、doctor | 10 | `node --check`、`--check-payload`、`doctor --require-live` 通过 |
| A3 | 当前 renderer live contract | 10 | `installed=true`、样式启用、`status` 为 `compatible` 或有明确可接受 fallback，安全模式为 `normal` |
| A4 | 环境切换 | 10 | 森林、洞穴、太空至少各切换一次；主题、背景和注入器保持运行 |
| A5 | 新会话首页 | 10 | 首页标记、当前版本建议区布局、1 个 Composer、无横向或纵向溢出；发送前检查四边 |
| A6 | 已有会话 | 10 | 主内容、Composer 自有标记数量为 1，Composer 可见，无溢出 |
| A7 | 设置页深度检查 | 15 | 设置卡片在 0/500/1200/2500ms 都稳定；按钮文字与背景有清晰对比 |
| A8 | 快速聊天生命周期 | 10 | 打开后浮层为深色、无白边和溢出；关闭后主页面恢复 `compatible/stable` |
| A9 | 音乐与伙伴入口 | 5 | 音乐按钮可从 ready 切换到 playing 再恢复关闭，伙伴或装饰入口存在 |
| A10 | 截图和延迟复检 | 5 | 关键页面至少截图一次；普通路由等待 2.5 秒复检，刷新场景按 100/500/1200/2500/5000/8000ms 采样关键标记 |

建议判定：

- 90 分及以上、无 P0/P1、必测路径有本轮证据且 warn/unknown 已复核：本地 macOS 合格；关键路径未测只能记增量验收，不因高分豁免；
- 80–89 分：需要修复或补测后再合格；
- 低于 80 分，或出现安全模式、Composer 丢失、白边、核心按钮不可读：不合格；
- Windows、真实消息发送和联网业务结果单独记录，不影响 macOS 分数，但不能冒充已验证。

## 固定执行顺序

### 1. 先跑源码、隔离浏览器与只读检查

```bash
npm test
npm run test:browser
node --check assets/renderer-inject.js
node --check scripts/injector.mjs
./scripts/doctor-macos.sh --require-live
npm run inspect -- --port 9341
```

`inspect` 的 `samples.json` 会保留各次 `verify` 数据：`frontendCompatibility.status`、`criticalMissing`、`fallbacks`、`discovery`、`diagnostics`、`diagnosticFingerprint`、`safety.mode`、`composerMarkerCount`、`visibleComposerMarkerCount`、`documentOverflow`。截图使用 inspect，避免旧 verify 截图路径改变悬停/弹层现场，见 ST-008。

Codex 更新后先运行一次适配器报告，保存其中的 `adapters`、`missingRequired`、
`fallbackAdapters` 和 `recommendedAction`。`refresh-runtime` 先更新运行时，`wait-and-recheck` 等待复检，`update-adapter` 定位关键能力，`inspect-runtime` 检查样式/安全模式，`inspect-fallback` 检查回退。任何可复现的视觉错误，即使返回 `none`，也必须进入对应页面排查：

```bash
npm run --silent compatibility-report > /tmp/codex-skin-compatibility.json
```

### 2. 切换代表性环境

使用热切换入口，不直接改运行目录中的 `theme.json`：

```bash
./scripts/switch-theme-macos.sh --id preset-terraria-forest-day
npm run inspect -- --port 9341

./scripts/switch-theme-macos.sh --id preset-terraria-cavern
npm run inspect -- --port 9341

./scripts/switch-theme-macos.sh --id preset-terraria-space
./scripts/verify-dream-skin-macos.sh --port 9341
```

每次切换后检查背景、侧栏、Composer、伙伴或装饰是否仍在，且没有白色横带。测试结束恢复用户原来的主题。

### 3. 测试页面路由

在真实 Codex 页面按下面顺序操作，并在每次路由切换后等待至少 1.2 秒：

1. 点击“新对话”：检查首页背景、建议卡片、Composer 和字体首帧。
2. 打开一个已有会话：检查消息、代码块、Composer 宽度和底部渐变。
3. 打开“设置 → 使用情况和计费”：检查卡片、链接、按钮文字和滚动。
4. 打开“快速聊天”：检查 portal 外壳、输入面板、关闭按钮；关闭后再次检查主页面。
5. 点击“♪ 音乐”：确认 `ready → playing → off` 的状态变化，最后恢复原状态。

CDP 有多个 `app://` 页面时，主窗口必须按精确 URL `app://-/index.html` 选择。`initialRoute=/chatgpt/quick-chat-prewarm` 和 `/avatar-overlay` 是辅助页面，不能拿来代替主窗口做结果判断。

## 增量执行记录：2.7.28（2026-10-21）

- 弹层共享配色和默认图标已修复；新增控制台“交互巡检”。`npm test` 7 个脚本、42 个检测场景，隔离浏览器两套用例和 live doctor 通过。
- 从原生 macOS 控制台实际点击交互巡检，10 个入口完整采样并逐张看图；原白底、暗图标不再出现。失败/未测的早期记录保留，没有用最终结果覆盖。
- 当前页自动抽检 90/100，复杂背景对比度待复核。A1–A10 本轮没有完整重跑，不继承历史满分。设置、快速聊天、环境切换、播放、刷新未测。
- 详细证据和说明：`~/.codex/codex-dream-skin-local/evidence/2.7.28/VALIDATION.md`；交互报告：`~/Library/Application Support/CodexDreamSkinStudio/reports/walks/2026-10-21T07-17-36-822Z-QqjKn7/report.html`；漏测根因见 ST-009。

## 历史增量执行记录：2.7.27（2026-10-21）

本轮交付的是[本机检验工具](INSPECTION.md)，不再只靠人工保存零散截图。入口为 macOS 原生控制台的“皮肤检验”、`Inspect Codex Dream Skin.command` 和 `npm run inspect`。

- 本机 Codex 26.901.51231 / darwin-arm64；皮肤运行和磁盘均为 2.7.27；暂存与运行主题均为 preset-terraria-hallow，环境 hallow。不涉及配置中心，未更改音乐或环境配置。
- `npm test` 的 7 个测试脚本全部通过，含 34 个新增检验行为用例、10 个已有兼容报告场景及语法/payload 检查；`doctor --require-live` 通过。
- 独立 Chrome 夹具验证真实 DOM：白字白底、text-fill 覆盖、透明文字、渐变 unknown、禁用/隐藏/裁切标签排除、标记计数、延迟字体变化、真实 PNG 白边；探针未发送键鼠事件且保留焦点。真实 HTML 报告的两张本地图片正常加载，900/560px 布局无横向溢出。
- 真实断连端口 1：保存失败报告并退出 2；更新 VERSION 后仍运行旧 watcher 的实机场景：报告识别运行版本不一致。随后通过正式启动脚本恢复 watcher，未重启 Codex。
- macOS 控制台重新编译为 arm64/x86_64，安装并验证 ad-hoc 签名。通过系统辅助功能实际点击“皮肤检验”，状态显示结果并打开默认浏览器。
- 最终实机报告：**当前页自动抽检 90/100，待复核**。实际采样 50/716/1251/2553ms；版本/主题/契约/标记/溢出/短时稳定性通过，截图外缘近白色连续片段为 0，音乐 ready、可见伙伴 1。220 个按钮/链接文字样本因渐变、图片或合成背景不能可靠计算对比度，标 unknown，不计 10 分。
- **完整 A1–A10 清单仍只有 45/100（A1/A2/A3/A6）**，不把自动工具的 90 分当完整验收。新会话、设置子页、快速聊天、三环境切换、播放、刷新首帧与 5/8 秒复检未测。
- 证据：本机 `~/Library/Application Support/CodexDreamSkinStudio/reports/2026-10-21T03-57-30-221Z-Wwcv4F/`；测试/构建摘要和源码指纹在仓外 `~/.codex/codex-dream-skin-local/evidence/2.7.27/`。

## 增量执行记录：2.7.26

核验：2026-10-21（Asia/Shanghai）；范围为本次诊断代码和当前会话。Codex 26.901.51231、darwin-arm64、CDP 9341。测试命令使用 Node v22.23.3；macOS 启动脚本选用的 runtime Node 为 v24.19.0。

| 检查项 | 本次结果 | 证据与边界 |
| --- | --- | --- |
| A1 | pass | `npm test` 的 6 个脚本通过，新增报告测试含 10 个明确场景；renderer 另验证稳定/回退/marker 丢失/设置页语义 |
| A2 | pass | 脚本语法、payload 和 `doctor --require-live` 通过；不等于跨页面业务验证 |
| A3 | pass | 主目标 `app://-/index.html`，实际版本 2.7.26，schema 2，`compatible`、`normal`、`recommendedAction=none` |
| A6 | pass | 当前已有会话，主内容和 Composer 可见 marker 各 1，无横纵溢出；最终截图已查看 |
| A4/A5/A7/A8 | unverified | 本轮未重跑三环境切换、新会话、设置页或快速聊天；设置页只有 fixture 证据 |
| A9 | unverified | 仅确认当前 `hallow`、music `ready`、音乐按钮和伙伴存在；未进行播放状态切换 |
| A10 | unverified | 已保存并查看当前截图；未重新执行完整刷新时序采样 |

已验证项计 **45/100**，表示本轮完整清单的证据覆盖；本次诊断改动的增量验收通过，**尚不能宣布新版本通过完整 macOS 验收**。不复用下方 2.7.25 的历史 100 分。Windows 未覆盖。

最终主题与 watcher：重新启动已验证身份的皮肤 watcher，仍使用用户暂存的 `preset-terraria-hallow`；运行时读回 `version=2.7.26`、`environment=hallow`、`style=terraria`，并有 early script 注册状态。未重启 Codex 应用、未发布远端。

证据入口：[本机交接与证据](../codex-dream-skin-local/handoffs/2026-10-20_升级兼容性复盘.md)。临时原始输出为 `/tmp/codex-skin-2.7.26-final-verify.json`、`/tmp/codex-skin-2.7.26-compatibility.json`、`/tmp/codex-skin-2.7.26-runtime.json` 和 `/tmp/codex-skin-2.7.26-final.png`；关键输出已复制到本机交接目录，防止临时目录清理后丢失。

## 历史执行记录：2.7.25（不能视为 2.7.26 的验收）

日期：2026-10-20（Asia/Shanghai）  
皮肤版本：2.7.25  
Codex：26.901.51231  
Node：v24.19.0  
平台：darwin-arm64  
CDP：9341  
最终主题：Terraria · 神圣之地 · 白昼  
最终状态：injector、Codex、CDP 均正常，安全模式 `normal`

| 检查项 | 结果 | 证据 |
| --- | --- | --- |
| A1 | pass | `npm test`：图片格式、早期注入、renderer、主题暂存、Terraria 资源测试全部通过；伙伴资源 524 slots / 449 animated / 99 critters |
| A2 | pass | 两个 `node --check`、`doctor --require-live`、payload 校验通过 |
| A3 | pass | 2.7.25，样式已启用，`criticalMissing=[]`，安全模式 `normal` |
| A4 | pass | `preset-terraria-forest-day`、`preset-terraria-cavern`、`preset-terraria-space` 热切换均成功 |
| A5 | pass | 新会话：`home=true`、4 个建议卡片、1 个 Composer、横纵向溢出均为 false；首页存在可接受的 `header-optional` fallback |
| A6 | pass | 已有会话：`composerDiscovery=stable`、自有 Composer=1、可见 Composer=1、无溢出；模型容量提示 `aside` 为深色主题面板 |
| A7 | pass | 设置页 0/500/1200/2500ms 均为 4 张深蓝卡片；按钮文字和填充色均为 `rgb(16,35,53)` |
| A8 | pass with fallback | 快速聊天打开后背景为深色、无溢出；打开期间 contract 为 `adaptive/semantic-fallback`，关闭后恢复 `compatible/stable` |
| A9 | pass | 音乐按钮 `ready → playing → off`；关闭前已恢复原状态，伙伴装饰可见 |
| A10 | pass | 当前设置页和森林、洞穴环境均保存截图；设置卡片延迟复检稳定；真实主窗口刷新采样在 100/500ms 保持未挂载但无安全模式，1200/2500ms 为 `confirming`，5000/8000ms 恢复 `compatible/stable`；适配器报告 `recommendedAction=none` |

本轮 macOS 得分：**100/100，合格**。Windows 镜像目录当前不存在，因此 Windows 不计入本轮 macOS 分数，后续有镜像时单独执行同一清单。

## 错题本

### ST-001：设置卡片先正常，延迟后变蓝或恢复白色

- 现象：首次扫描把原生白卡标记为 `trskin-settings-light-surface`，主题随后把它染成深蓝；下一轮扫描按当前深色重新判断，移除标记。
- 根因：发现逻辑读取了“已经被主题改变后的结果”，没有保持 renderer 自有标记。
- 修复：`assets/renderer-inject.js` 的 `isSettingsLightSurface` 对已拥有标记的卡片保持 ownership；增加深色后重复扫描回归测试。
- 回归：设置页 0/500/1200/2500ms 采样均保持 4 张卡片和同一背景色。

### ST-002：按钮背景正常，但按钮文字看不清

- 现象：`bg-primary-soft-alpha` 和 `bg-primary-solid` 按钮的背景是浅色，文字也被统一设置为浅色。
- 根因：卡片级文字基线覆盖了按钮自己的语义颜色；Electron 还可能使用 `-webkit-text-fill-color`。
- 修复：`assets/dream-skin.css` 为两类 primary action 和内部 `span` 使用 `#102335`，同时固定 `-webkit-text-fill-color`；增加 CSS 合约测试。
- 回归：真实“使用情况和计费”页面的“查看套餐”“购买额度”“使用重置额度”均可读，截图已检查。

### ST-003：CDP 自测偶尔得到错误的页面结果

- 现象：快速聊天开启后会出现 `initialRoute=/chatgpt/quick-chat-prewarm` 辅助页面；如果用“第一个 app:// 页面”做测试，可能误读为主窗口丢失 Composer。
- 根因：测试脚本选择目标过宽，没有区分主窗口和 prewarm、avatar overlay 页面。
- 修复：本清单规定主窗口必须精确匹配 `app://-/index.html`，辅助页面单独记录。
- 回归：主窗口和快速聊天生命周期分别验证；关闭快速聊天后主窗口恢复 `compatible/stable`。

### ST-004：刷新时慢启动被误判为前端失效

- 发现时间 / Codex 版本 / 皮肤版本：2026-10-19 / 26.901.51231 / 2.7.22
- 操作路径和稳定复现步骤：刷新 Codex 主窗口，在页面完成异步挂载前连续读取兼容性状态。
- 首帧、500ms、1200ms、2500ms 的观察：早期皮肤已注入但 `main` 和 Composer 尚未出现，状态进入 `confirming`；约 4.3 秒页面才完成挂载，旧逻辑已经在 1200ms 后进入 `incompatible/safe`，导致刷新过程中短暂恢复官方白色界面。
- 真实 DOM、计算样式、截图证据：刷新期间 `document.body` 存在，Codex 路由壳尚未挂载；完成挂载后同一页面恢复 `compatible/stable`。
- 根因：安全模式断路器只有固定 1200ms 失败确认，没有区分首次 renderer 文档的异步挂载阶段与已稳定页面的路由切换。
- 修复位置和兼容性边界：`assets/renderer-inject.js` 为新文档增加一次性 8000ms 启动宽限；首次挂载成功后清零，之后仍使用 1200ms 确认。8 秒内持续缺少关键能力仍会进入安全模式。
- 回归测试：`renderer-inject.test.mjs` 模拟首次无 `main` 的慢启动，验证 1200ms 内不进入安全模式、挂载后恢复；已有持续路由缺失测试继续验证 1200ms 后进入安全模式。
- 本轮分数变化：A1 仍为 pass；A10 增加刷新 100/500/1200/2500/5000/8000ms 采样后再计入完整分数。
- 未覆盖项和下一次复查时间：Windows renderer 和 Codex 更慢的冷启动未覆盖；下次 Codex 更新完整复测。

### ST-005：代码块首行操作栏出现白边

- 发现时间 / Codex 版本 / 皮肤版本：2026-10-20 / 26.901.51231 / 2.7.23
- 操作路径和稳定复现步骤：打开“检查并同步 OnePoint 环境”会话，滚动到包含 `Bash` 代码块的消息。
- 首帧、500ms、1200ms、2500ms 的观察：代码正文和外层面板已经是深色，但代码块首行约 48px 保持纯白；等待不会自行恢复。
- 真实 DOM、计算样式、截图证据：`[data-markdown-copy="code-block"]` 外层已被主题染深；其首子 `_StickyActionBar_*`（当前实际类为 `_StickyActionBar_1f1nx_10`）计算背景为 `rgb(255,255,255)`，`data-theme="light"` 触发了原生浅色 token。
- 根因：旧适配只覆盖 `pre` 和 CodeBlock 外层，没有覆盖新版 CodeBlock 自有首行操作栏。
- 修复位置和兼容性边界：`assets/dream-skin.css` 按代码块稳定语义标记接管首子层及其按钮、图标；不依赖完整 CSS Module hash，也不影响普通消息工具栏。
- 回归测试：源码 CSS 合约测试；真实会话检查外层 CodeBlock 与首行操作栏的 computed background、截图和 `data-theme="light"` 兼容性。
- 本轮分数变化：A1–A10 保持通过，新增代码块首行白边专项检查。
- 未覆盖项和下一次复查时间：其他语言代码块及 Windows renderer 在下次完整 Codex 更新时复测。

### ST-006：模型容量提示继承白色通知面板

- 发现时间 / Codex 版本 / 皮肤版本：2026-10-20 / 26.901.51231 / 2.7.25
- 操作路径和稳定复现步骤：在任务页选择不可用模型，等待生成失败提示出现。
- 首帧、500ms、1200ms、2500ms 的观察：消息项底部出现白色圆角 `aside`，提示文字为
  `Selected model is at capacity. Please try a different model.`，等待不会自行变暗。
- 真实 DOM、计算样式、截图证据：`aside` 没有 `role` 或专用 data 属性；其祖先会话项拥有
  `[data-local-conversation-item-target-ids]`，原生 `background` 为 `rgb(255, 255, 255)`。
- 根因：通知从普通消息内部变成无语义 `aside`，没有进入原有 `section/article/role` 浅色表面发现集合。
- 修复位置和兼容性边界：`dream-skin.css` 通过会话项稳定属性定位其 `aside`，只接管任务页的该类通知，设置页和应用侧栏不受影响。
- 回归测试：CSS 契约测试；live 注入后该节点计算背景为 Terraria 深色渐变，边框使用主题强调色。
- 本轮分数变化：A6 增加模型容量提示检查，保持 100/100。
- 未覆盖项和下一次复查时间：其他错误提示若没有会话项稳定属性，记录为新的适配器问题；下次 Codex 更新复查。

### ST-007：代码已变，但运行版本/主题与预期不一致

- 发现时间 / Codex 版本 / 皮肤版本：2026-10-21 / 26.901.51231 / 2.7.26。
- 现象：磁盘 VERSION 为 2.7.26，renderer 契约 schema 已更新，但 `skinVersion=2.7.25`；verify 版本校验失败。随后一次性注入使用 `assets`，暂时载入默认资源，未使用用户暂存主题。
- 根因：注入器把 VERSION 作为进程启动常量；文件 watcher 仅热加载主题和 renderer/CSS。一次性 payload 正确也不能证明 watcher 的下一次加载正确；doctor 的暂存主题不等于 renderer 实际主题。
- 修复：通过正式启动脚本替换已验证身份的 watcher，使用当前暂存主题目录，更新 early registration；读回实际 `themeId`、版本、音乐状态和伙伴节点。报告新增 `refresh-runtime` 分支，不再把版本不一致报告为无需处理。
- 回归：新增 old watcher payload、未注入、旧契约、禁用样式等报告场景。真实主窗口最终为 2.7.26 / hallow / normal，verify pass；应用没有重启。
- 边界：本轮未做真实页面刷新，不能把 early registration 存在当成刷新首帧已验证。
- 下次复查：注入器/VERSION 更新后重跑运行版本和主题读回；下次完整验收补刷新时序。

### ST-008：截图操作改变待测现场

- 发现时间 / 版本：2026-10-21，检验工具 2.7.27 开发时。
- 代码证据：旧 `injector.capture()` 会先发 Escape、移动鼠标，再截图，可能关掉弹层或取消 hover。这是静态定位到的检测盲区，不应把消失的浮层当修好了。
- 新工具修复：直接调用 `Page.captureScreenshot`，保留焦点和悬停；独立 Chrome 夹具校验探针前后无键鼠/blur 事件且焦点不变。
- 边界：旧 verify 截图入口仍保留原行为；复现浮层问题时用新检验工具，快速聊天独立窗口仍需专项验证。
- 下次复查：每次改检测器或 CDP 操作后执行隔离浏览器测试。断连、缺图、未测项不得给通过分。

### ST-009：项目弹层白底、嵌套表单漏测与暗图标

- 发现时间 / 版本：2026-10-21，Codex 26.901.51231，修复为 2.7.28。
- 路径：新会话 → 项目选择；侧栏添加项目 → 下一步 → 项目名称/源文件夹 → 图标选择。第一层修复后必须继续检查第二、第三层。
- 根因：旧 CSS 只覆盖 role=menu，新项目选择为 role=dialog + data-slot=popover-content；创建表单使用新增 elevated-secondary/primary-soft/primary-solid 色组，默认图标使用 color-codex-icon。旧主题浅色文字、官方浅背景及官方暗图标混用。首页扫描分支提前返回，表单保护又排除扫描，不能靠扫描白色后补染弥补。
- 修复：dream-skin.css 在语义弹层范围内成组映射表面、输入区、按钮前景/背景、默认图标 token；直接 CSS 生效，不依赖路由扫描；彩色选项不重染。
- 漏测复盘：原工具只读当前页，外缘像素正常不能证明内部弹层正常；没有顺着创建流程进入下一步；文字检测不含无字图标。逐张人工看截图后独立发现暗图标，补 SVG 实际 fill/stroke 检测。Radix 一级入口必须模拟真实 pointerdown，HTMLElement.click 不能代表完整交互。
- 固定回归：控制台“交互巡检”或 npm run inspect:overlays，10 条固定路径，每条保存约 0/500/1200/2500ms 样本和首末截图；缺入口/打开失败必须显式记未测/失败。逐张看完截图才可给出人工视觉结论；渐变等未知不能自动算通过。
- 回归夹具：tests/popover-skin-browser.test.mjs 使用完整 CSS，旧白底和暗图标必须能报警，修复后测列表/悬停/输入/按钮文字/图标/三种配色；tests/inspection.test.mjs 包含报告告警传播。
- 证据：本地 evidence/2.7.28 与 reports/walks 下保存真实失败、部分覆盖和最终复测，不删除失败记录。项目选择白色像素占比从约 97.9% 降至 0%。
- 分数边界：交互入口覆盖率独立于 A1–A10，不能继承历史 100 分。设置子页、快速聊天、环境真实切换、音乐播放和刷新首帧需要另测。
- 下次复查：每次改弹层 CSS 或 Codex 更新运行全部 10 个入口；每周/同类问题三次复盘时按语义 token 家族归因，不再只按用户截图补选择器。

### 历史方案索引

| 问题 | 当前方案 |
| --- | --- |
| 新会话白边 | 未标记外围 `main` 背景兜底，见 `CHANGELOG.md` 2.7.14 |
| 快速聊天白底 | `data-pip-obstacle="quick-chat"` portal 适配，见 2.7.16–2.7.20 |
| 线程右下角白带 | 接管新版 `aria-hidden + bg-gradient-to-t` 层，见 2.7.20 |
| 代码块白底 | `pre`、`data-code-block`、`CodeBlock` 深色适配，见 2.7.20 |
| 字体延迟 | 独立 early font baseline，见 2.7.11 |
| 设置卡片闪变 | marker ownership 保持，见 2.7.21 |
| 设置按钮不可读 | 按钮语义色和 `-webkit-text-fill-color`，见 2.7.22 |

## 新问题记录模板

每次发现问题，复制下面模板追加到“错题本”，不要只写“已修复”：

```markdown
### ST-XXX：简短现象

- 发现时间 / Codex 版本 / 皮肤版本：
- 操作路径和稳定复现步骤：
- 首帧、500ms、1200ms、2500ms 的观察：
- 真实 DOM、计算样式、截图证据：
- 根因：
- 为什么此前自测没发现，今后由哪个检查发现：
- 修复位置和兼容性边界：
- 回归测试：
- 本轮分数变化：
- 未覆盖项和下一次复查时间：
```

## 周期

- 每次改 CSS、renderer、注入器或主题资源：至少跑 A1–A3，再跑受影响页面。
- 每次 Codex 更新：完整跑 A1–A10，并保存 `verify` JSON、关键截图和刷新 100/500/1200/2500/5000/8000ms 采样。
- 每周或连续三次修复同类问题：回看错题本，把重复根因提升为 renderer 适配器或测试合约。
- 只有在连续两轮完整检查都没有 P0/P1 回归后，才把某条兼容方案标记为稳定。

## ST-013：源码测试通过不等于浏览器回归已执行（2026-10-22）

- 现象：项目已有五套真实浏览器回归，但 `npm test` 原来只执行显式列出的源码测试；新维护者可能只跑这一条就遗漏弹层、选区、布局与地图。
- 根因：测试入口分散；检测器退出0也允许unknown/warn，容易误把“命令成功”当“视觉通过”。doctor原来还会用保存端口覆盖环境指定端口。
- 修复：`npm run test:browser` 自动发现全部 `*-browser.test.mjs`；`npm run checkup` 汇总源码/浏览器/live doctor/兼容/当前页，保存日志/指纹/待补清单，解析实际语义结果。doctor新增显式端口，优先级为参数→环境→状态→默认。
- 回归：实际运行五套全部通过（含地图90组、布局18组）；当前页212个文字/图标样本因背景不可计算，checkup返回2并保留review，没有报全绿。故意指定缺失Playwright：零套执行、review；离线live项为untested。指定端口1时doctor失败，没有误连状态中的9341。
- 工具行为用例覆盖：辅助/多个主窗口、未知结果、失败日志、坏JSON、缺命令、超时，以及失败后独立命令仍可执行。
- 边界：真实设置、快速聊天、播放、刷新与多页往返仍须按UPGRADE_CHECKUP矩阵补测；不是本轮全应用验收。本机证据在 `../codex-dream-skin-local/evidence/2026-10-22-checkup/VALIDATION.md`。

## ST-014：原生伙伴误识别、颜色别名变更与隐藏旧会话（2.7.32）

- **发现**：Codex 从上次核验的 26.901.51231 更新至 26.1021.31345（build 21828）。初始 CDP 可用、皮肤未安装、manual 状态记录缺失。历史日志没有本次原始报错，不能把旧日志当作用户这次弹窗的确切内容。
- **窗口根因**：`initialRoute=/avatar-overlay` 新增 main 和 contenteditable，旧探针会接受；一次性注入逐窗口检查且要求侧栏，辅助窗口失败会导致整体退出2。将宿主 URL 判定用于发现、early 字体和完整 early payload，保留主窗口/quick-chat index 宿主；辅助窗口出现编辑器也不再接管。
- **配色根因**：新壳与 Markdown 改用 `--color-surface*`、`--app-color-background-*`、`--color-text`、`--color-text-user-message`，仅有旧 token 映射不够。直接用户文本不经过 p 标签，补 p 颜色也无法覆盖。修在 Terraria 根级中性色别名，接入现有环境配色，保留告警/状态颜色。
- **缓存根因**：隐藏旧会话位于可见会话之前。只用 querySelector(editor) 会将兼容性契约的 Composer.required 判为 false，并使编辑器回退选错。发现和契约均遍历可见编辑器；独立浏览器同时验证隐藏旧会话、缺失稳定属性的回退、缺 Composer 必须报警。
- **漏测原因**：结构 compatible 不等于可读；旧实机文字探针主要覆盖按钮/链接，普通 Markdown 正文没有覆盖，且图片/渐变大量为 unknown。不能拿旧分数或入口存在证明视觉正常。本轮增加完整 CSS 的三环境原生配色回归并看实机截图。
- **固定回归**：主窗与 avatar 同时存在时手动应用 → 只有合法宿主被注入、控制台成功；三环境下顶栏/侧栏/底部表面、普通与直接用户正文可读，告警色不变，卸载恢复官方变量；隐藏旧编辑器不掩盖当前编辑器。
- **错误留证**：手动应用不再丢弃 stdout，每次在 Application Support/CodexDreamSkinStudio/reports/apply/ 保存 result.json、stderr.log、exit-code.txt。失败路径显示新记录目录并写 start-error.log；旧日志、陈旧控制台状态、历史检验分数均不代表本次结果。隔离 stub 覆盖成功、无 stderr 的校验失败、连接失败；失败不能写活动状态。
- **证据边界**：本轮原始截图/实际颜色/应用记录见 `../codex-dream-skin-local/evidence/2026-10-26-launcher/` 与同需求交接。设置、真实快速聊天、刷新首帧、播放切换须有单独证据，不能继承三环境夹具结论。

## ST-010：原生分栏宽度反馈、窄输入回退与首页空槽（2.7.29）

- **触发**：文件在左侧且较窄，聊天仍占大部分外壳；输入框反复变宽/回缩。实机旧样本在 736px 与 1866px 间交替。
- **根因**：旧几何修正使用外层 main 测量并回写宽度/横移；“聊天占比足够小才跳过”的比例判断漏掉窄文件窗格。回写影响原生容器查询，形成反馈。原生壳额外 2px 装饰边框也会撑宽被测量的布局。
- **修复**：原生 `data-app-shell-workspace-layout` 出现时释放脚本宽度、偏移、标记和重试计时器；改用原生 thread-footer 在聊天窗格内 `width:100%`，左右 24px。外壳分界线用 inset shadow 绘制，不参与布局。
- **本轮漏项**：只确认“稳定 736px”不够，用户指出大屏输入框变小。已改为同时验收不跳变、足够宽、两侧留白一致、不会伸进文件区。以后不能用单个稳定数值代替体验与包含关系。
- **首页边界**：内层 `scrollbar-gutter:stable both-edges` 在无滚动条时仍预留约 30px 空带；内外两层分别画背景又造成标题栏断层。首页取消空槽，环境统一画在外壳，内层透明。Hero 原有细像素框保留。
- **检测漏洞**：旧稳定性只比较颜色/字体和数量，既不比较 rect，也只采四次。2.7.29 加入 rect 和 2.5 秒逐帧输入区检查；新建、拖动、换位、流式输出时可能提示变化，先静止重测，不自动修样式。
- **固定复测**：全宽聊天 → 文件右侧 → 文件左侧 → 拖动分隔条 → 恢复右侧；每步静止至少 2.5 秒，检查输入框宽=聊天窗格宽−48px、左右各 24px、旧几何标记为 0、聊天窗格无额外横向溢出。另测原生全屏/恢复、首页右缘与标题栏。任何恢复页、缺入口或未恢复步骤都留作失败/未测，不按之前截图继承通过。
- **源码回归**：renderer 夹具覆盖进入/退出 workspace 清理；`workspace-skin-browser.test.mjs` 使用完整 CSS 覆盖 18 组宽度/左右/全宽组合，验证包含关系、无布局边框、首页空槽和单背景，并用真实动画帧重现旧宽度交替。
- **检验器**：`npm run inspect` 会记录逐帧数据；页面/窗格/viewport 改变、采样不足或后台限速标待复核。逐帧探针是只读、有 3.2 秒截止，不记录输入文字。
- **证据**：`~/.codex/codex-dream-skin-local/evidence/2.7.29/VALIDATION.md` 保存最终结果以及中途失败；不是全应用验收。
- **重启经验**：从 HairFree 终端启动官方 Codex 时，不把当前 `CODEX_HOME` 继承给它；本轮采用 `env -u CODEX_HOME ./scripts/start-dream-skin-macos.sh ...`，仅移除子进程变量，不改两边配置、认证或会话目录。实际账号和 CDP 在重启后重新核对。

## ST-011：选中文字的浮动操作条白底与漏检（2.7.30）

- **发现与路径**：2026-10-21，Codex 26.901.51231。在现有回复中拖选文字，出现“添加到对话 / 更多详情 / 在侧边聊天中提问”浮条。它属于 body portal，实际为 `role=presentation`、`bg-surface-elevated-secondary/90`，没有 menu/dialog 角色。
- **根因**：原生表面仍为接近白色的 90% 不透明背景，文字却已继承皮肤浅色。旧共享弹层 CSS 和检查器只枚举 menu/dialog/popover；10 个菜单路径没有选中文字场景，因此白底和低对比同时漏过。外缘通过或菜单巡检通过不能代表其他交互通过。
- **修复**：将这个带 elevated 语义、直接子按钮的 presentation 表面接入同一组面板/前景/边框 token；成对设置按钮默认、悬停和焦点颜色，取消毛玻璃。直接 CSS 生效，不靠正文、中文标签、哈希类或扫描延迟。保留原生定位及动作逻辑；仍依赖现有表面语义，Codex 改此契约后需适配。
- **检测补齐**：probe 同时发现 presentation 浮条与标准 toolbar，但前者单独记为 `selection-actions`。本轮第一次采错普通 toolbar，相关证据已标为 unrelated，不能当成修复前截图。
- **固定复测**：已有回复拖选 → 检查浮条三按钮 → 悬停/键盘焦点 → 取消 → 再选；保持动作未触发，不发送消息。挂载后约 0/500/1200/2500ms 记录色彩、对比度与首末截图；真正绘制首帧与操作生命周期另由浏览器夹具覆盖。只读检验不会替你打开浮条。
- **回归**：`selection-toolbar-browser.test.mjs` 先断言旧白底报警，再以完整 CSS 测 forest-night/hallow/spider-nest 三色组、默认/hover/focus、重复选取取消及无关内容不被染色。已有 popover 浏览器回归同时通过。
- **实机结果**：蜘蛛洞四次样本三按钮均 13.05:1；用户切至森林白昼后四次均 10.15:1，首末像素通过并人工看图。正式当前页抽检 90/100，剩余文字背景含图片/渐变不能自动计算；不等于完整清单验收。
- **证据与边界**：本机 `evidence/2.7.30/VALIDATION.md`；没有点击三个业务动作。设置、快速聊天、真实刷新和文件全屏未在本轮复测。每次改弹层规则或 Codex 更新加测本路径，每周/同类第三次回顾遗漏的交互类型，而非只增加白色选择器。

## ST-012：墙块示意图平铺、背景来源与随机池去重（2.7.31）

- **发现与根因**：蜘蛛洞出现方格缝；核对公开远端和本机后确认原版使用 64×64 的 Spider Wall (placed).png 并放大为 128px 平铺。44 个环境中有 15 个使用墙块/壁纸/地牢墙体图集，素材类型不适合完整环境背景。这是旧资源选型问题，不能一律归因于 Codex 更新。
- **来源判断**：官方 Wiki 的 Minimap → Full-screen map backgrounds 有独立地图画面；只查 Biome backgrounds 或环境详情页会漏掉。尺寸小并不等于墙块：其余 29 环境包含正式地下场景纹理，按来源与看图判断，未批量替换。
- **修复范围**：15 环境使用地图图；删除墙块专用 repeat 和固定像素尺寸，完整图 cover/no-repeat/pixelated。首页仍只在外壳画一层；侧栏覆盖旧 aside 与新版 div，不靠标签名判断。以太/陨石/火星没有已核实的专属条目，采用洞穴/森林/太空地图，来源清单明确写复用，不冒称专属图。
- **隐藏依赖**：太空、火星与四柱曾共用 sp-art。不能只覆盖这一个文件；重建随机池后四柱各自指向对应图。检查整个 backgroundPool，不能只检查首选 backgroundKey。音乐、伙伴、火把、色组和随机设置不应随背景替换改变。
- **防回退**：MAP_BACKGROUND_SOURCES.json 保存新旧哈希和确切 URL；随机包重建先校验并恢复 map-backgrounds/ 离线原图。npm test 验证固定与随机所有地图引用，旧生成器带回墙块时直接失败。原来强制要求墙块平铺的四条 CSS 正则断言已移除，改用图片完整性与浏览器实际绘制检查。
- **固定回归**：15 环境 × 固定/随机 × 800/1728/2560px，共 90 组；每组验证图片解码、完整 CSS、首页外壳、会话伪元素、aside/div 侧栏。图片层必须 no-repeat；覆盖全幅的渐变层即使默认 repeat 也不会形成墙缝，检测不能混淆两层。真实客户端另逐个注入并采样，源码夹具不代替实机结果。
- **下次复查**：每次修改背景资源/生成器/尺寸规则后执行该专项；Codex 更新后再检验首页与侧栏实际结构。看图必须确认是连贯场景、主体裁切合理、文字仍清晰。地图图为 115×65 像素原画，宽窄比例差异通过 cover 裁切，不能拉伸变形。
- **证据**：`~/.codex/codex-dream-skin-local/evidence/2.7.31/` 的 44 环境清单、15 项来源、对照图、浏览器日志与实机样本。本轮完整分数与未测项以 VALIDATION.md 为准。


## ST-015：首页轴向变化、缓存路由与设置内容误识别（2.7.33）

- **触发与根因**：26.1021 在首页 rail 外加横向 flex 容器。旧 `flex: 0 0 440px` 预留高度变成宽度，卡片实际宽396px，标题仅144px；Logo宽300px、标题高378px超过固定卡片高度。不能仅缩字体或给项目名加省略号掩盖。
- **修复**：rail 用 `flex:none + width:100% + min-height`，hero 用内容高度与最小高度，Logo限父宽、长名字可断行；保留原像素框、Logo和环境素材。短窗口可滚动，防止裁掉输入框。
- **漏测根因**：旧浏览器夹具只测输入框宽度，不含真实首页标题树；探针只看文档级overflow。新版缓存隐藏首页，renderer、verify和巡检还会误判当前会话为home。三个入口均改为可见路由发现，探针新增卡片挤压和内部内容越界。
- **关联设置**：设置内容不再是 sidebar.nextSibling.firstChild（新版为header），优先原生 `data-app-shell-focus-area=main`；Pets预览中main/form/textarea不应识别成Composer。补information链接配色和伙伴CSS材质背景；设置路径只采当前选中的slug。
- **回归**：home-layout-browser共36组（新/旧row-column、800/1200/1700宽、640/1000高、中文/长仓库名/无断点长名），旧CSS应失败；隐藏首页退场、故意压窄必须被探针抓到。native-palette-browser覆盖真实设置外层/预览/链接，inspection-pages覆盖时序和切页拒绝假通过。
- **下次执行**：checkup，空首页inspect:pages；看实际首末截图。目录 `../codex-dream-skin-local/evidence/2026-10-26-full-check/` 保存本轮实际证据；途中用户切页、注入校验失败也保留，不能将中断记录算通过。完整矩阵及未验项见同需求交接。

- ST-015 补充：遍历到语音底部/插件页面后主动发现 settings 普通内容未接入 portal 共享输入/主按钮色组；为settings-content复用色组，主按钮及其子标签避开旧的统一浅字规则。巡检增加设置内层面板与输入栏采样；普通toolbar不阻塞启动，选中侧栏项滚出视口仍保持正确页面身份。
- **工具误报复盘**：四次采样若从任务开始计时，首次探测耗时会缩短首末有效间隔。本轮快捷键页为194→2532ms，仅2338ms，被判不足2400ms。现以后续采样相对首样本完成时间计时，保留原失败报告；修正后实机重试遇到用户草稿而停止，尚未复验，不得改写为通过。正常开关的白色圆点也须结合截图区分，不能将所有浅色像素一律染暗。

## ST-016：侧栏右侧20px背景竖带（2026-10-27，2.7.33 CSS热修）

- **触发**：蜘蛛洞等地图环境下，侧栏右边出现紫灰竖带，主背景像有空隙；浅色外缘探针仍可通过。
- **根因**：原生 `.app-shell-left-panel::after` 为绝对定位、`right:-20px;width:20px;background:inherit`，实际主内容已紧邻侧栏，竖带是继承的背景遮挡，不是布局留白。旧透明规则仅适用于art-wide=true和aside，地图环境art-wide=false没有命中。
- **修复**：合并为皮肤启用时所有 `.app-shell-left-panel::after` 背景透明，移除路由、图片宽幅和标签条件。不改原生宽度、偏移、pointer-events或拖拽手柄，不用负margin或扩宽输入框补偿。
- **为什么漏测**：只采窗口外缘和近白像素；侧栏内部的深色竖带既不触发溢出也不是白色。旧背景夹具没有原生伪元素。检查器现读取外延伪元素背景，当前页和设置巡检都可报警。
- **回归**：sidebar-edge-browser用真实完整CSS，aside/div × 宽幅/地图 × 首页/会话/设置 × 800/1700px，共24组。旧CSS反例必须告警且确实遮住像素；修后与移除伪元素的同位置像素一致，几何不变，真实鼠标拖拽36px仍生效，停用皮肤恢复原生背景。已有workspace18组另验证分栏输入框。
- **现场边界**：源码版本保持2.7.33；本次仅热替换现有样式内容，保留renderer代际标记，并另记实时CSS完整SHA-256，避免完整重注入随机切换环境/伙伴。源码变更随下一次正常注入加载；未测试真实刷新。实机证据、最终体检和配置指纹见同需求交接及 `../codex-dream-skin-local/evidence/2026-10-27-sidebar-seam/`。
- **用户指定考核**：每次升级独立记录0/1/2成绩和证据；执行入口及标准见UPGRADE_CHECKUP“用户指定的升级必考题”。ST-016和ST-017不能合并成一次“白边检查通过”。

## ST-017：输入框外围原生底板与渐变形成黑边（2026-10-27，2.7.33 CSS热修）

- **触发**：用户在ST-016修复后指出输入框上方黑色横带、左右黑边。实机有“文件已更改”行；背景正常但输入区像被额外套了黑底板。
- **根因**：Codex将原生绘制拆成 `[data-thread-scroll-footer]` 内的空absolute底板与thread-scroll-container内sticky占位中的空absolute渐变。旧装饰标记跟随syncComposerGeometry；ST-010为消除布局反馈在native workspace提前return，导致新布局既不回写几何，也不再清除装饰。原生色组虽已变暗，仍是不连续的大块背景。
- **修复责任层**：使用footer语义锚点及空div/absolute/pointer-events-none结构直接清背景和阴影。只影响两个无交互装饰层，不改display/高度/底部padding、输入框宽度，不覆盖状态提示、发送按钮或输入正文；不依赖CSS Module哈希，也不重新开启几何回写。
- **漏测与改进**：先前workspace回归只有输入框和宽度，没有拆分的原生底板/渐变；白像素探针抓不到黑边。现在probe独立输出footerDecorations，当前页/设置巡检任一采样出现背景即告警。未知DOM变体仍需看图。
- **固定考题**：空闲→文件已更改→进度行展开；全宽/文件左/文件右；检查上方32px渐变及左右/底部留白没有矩形黑底板，输入框皮肤边框保留，草稿、按钮、几何正常。与ST-016分别记0/1/2，必须保留本轮证据。
- **回归**：footer-paint-browser共18组；旧CSS必须检测到2个绘制层且实测左侧/上方像素各自变暗。修后与隐藏这两层的同位置像素一致，切状态不丢草稿，发送/状态按钮可点击，停用皮肤恢复原生绘制。全部在隔离浏览器中，不发送真实消息。
- **实机边界**：本轮只热替换CSS，未重启/刷新/切页或操纵用户草稿。用户客户端正在运行其他任务，内容/伙伴变化不当成皮肤引起。实际采样/分数/未测项继续记录原需求交接；完整全应用验收未完成。

## ST-018：额度来源标题仍用半透明黑字（2026-10-28，2.7.33 CSS热修）

- **触发**：Codex 26.1023.50603 左下角用量弹层，“额度来源：你的 Pro 套餐”几乎不可见，其余可点击条目正常。
- **根因**：标题是非交互 div，使用 `text-codex-description → --color-codex-description → --app-color-text-foreground-tertiary`。原生light主题把后者设为rgba(26,28,31,.495)；皮肤只接了foreground/secondary和另一组tertiary别名，漏掉这条来源链。菜单旧规则只改button/menuitem/span，遮住了同类控件问题却漏了静态标题。
- **修复责任层**：根级和共享弹层色组补齐描述文字/tertiary来源，复用柔和的reading-muted，不按中文文案、坐标、CSS Module哈希或所有子节点统一染色。主按钮前景/背景配对、危险提示和显式颜色预览保留。
- **为什么没自测到**：旧probe只遍历控件文字；普通标题即使可见也没有样本。新增popupText及独立160片段预算，采弹层非控件文字、嵌套去重、排除隐藏/裁切/遮挡/禁用/编辑区；只保存样式/坐标，不保存正文。当前页、设置巡检、菜单巡检接入，菜单巡检增加usage-menu；采不到说明不能算通过。背景含blur时仍unknown，必须查看截图，不伪造精确比值。
- **回归**：popup-label-browser的3配色×menu/dialog/popover×2次重开共18组；真实旧CSS反例失败（约1.1:1），修后静态说明/主按钮可读，hover/focus、2.5秒延迟、嵌套去重、遮挡/禁用排除、长侧栏不挤掉说明、卸载恢复通过。检测报告另测低对比/延迟变化/采样截断不能假通过。
- **实机证据**：26.1023.50603、manual无watcher。只热替换现有CSS并保留renderer代际标记，未重启或改主题；同一desert环境五样本约0/500/1200/2500/8000ms颜色稳定为rgb(200,220,232)，verify通过。截图邻近背景采样估算从1.24:1到8.21:1，首末图已看；此估算不冒充blur表面的自动WCAG结论。后续重开及最终体检见原交接和 `../codex-dream-skin-local/evidence/2026-10-28-quota-label/`。
- **固定考核**：与ST-016/017分别记0/1/2，每次升级重新取得源码及实机证据；必须打开用量弹层检查静态标题，不能沿用普通按钮通过或整页90分。


### ST-018 追加：真实巡检发现较亮环境的表单说明低对比（2026-10-28）

- 用量黑字修复后，真实创建项目/图标选择巡检主动发现大理石环境设备说明为4.15:1；旧回归只用森林、紫色暗底，没有覆盖44环境中较亮的panelAlt。两条告警是同一个设备按钮的两个文字片段，不是两个独立控件。
- 共享primary-soft/primary-soft-alpha背景改为panelAlt的60%透明层，叠在原环境panel上；保留原文字和环境配色，避免继续把字增白。44套真实环境的设备说明与输入占位文字回归均通过，最低4.84:1；旧CSS反例实际失败。大理石实机五样本至8秒从4.15:1提升到5.12:1，无新的低对比告警。原生模糊背景仍unknown，截图需复核。
- 证据在 `../codex-dream-skin-local/evidence/2026-10-28-interactive/`：palette-before/after日志、inset-live-validation.json及修前/修后截图；不能沿用此前额度弹层的desert截图代表本次表单修复。

## ST-019：常驻工具栏阻断巡检、悬停按钮与创建步骤变更（2026-10-28）

- **症状**：菜单巡检两次0/11，报“已有弹层打开”，但现场无菜单；后来添加项目3条路径仍报入口缺失。
- **根因**：probe把常驻role=toolbar纳入视觉检查，菜单巡检却将全部popovers当阻塞弹窗；设置巡检已有排除判断，但没有共用。新版添加项目按钮的父层悬停前宽0/裁切，提前量坐标落到侧栏外。新版创建流程直接显示表单，旧工具还查找“下一步”。
- **修复**：`inspection/overlays.mjs`统一transientPopups/hasBlockingPopup；常驻toolbar保留视觉采样，但不阻塞启动，也不能冒充已打开的菜单。真正menu/dialog/alertdialog/选区浮条仍保护。创建入口先悬停所属项目标题，再重测并命中校验；直接表单跳过下一步，旧版只允许明确Next文字，绝不退化为点击最终创建。设备选择改测表单内设备菜单，不选择设备/文件夹。
- **回归**：inspection-browser真实DOM验证常驻toolbar、隐藏dialog、三种弹层、选区浮条；真实CDP鼠标验证悬停前裁切坐标不能点击邻居，展开后仅点击目标一次；新旧创建步骤及未知流程拒绝最终提交。设置巡检复用同一判断。
- **下次验收**：无草稿新会话首页执行inspect:overlays；再执行inspect:pages。缺少运行位置/分支时记录当前项目是否提供Git上下文，不造控件补齐数量。既有草稿/用户切页应停止并保留，不清空后强跑。源码夹具不代替11个真实入口和设置页面证据，最终成绩看同需求交接。
