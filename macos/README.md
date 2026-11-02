# TRSkin for macOS

当前版本 **2.7.33**。项目现只维护 macOS；普通用户可下载[最新完整包](https://github.com/pttydou/Codex-Terraria-Theme/releases/latest)。

**更新和修复从 [升级体检与修复流程](UPGRADE_CHECKUP.md) 开始。** `npm run checkup` 统一执行源码测试、隔离浏览器回归及当前客户端抽检，生成本机 Markdown/JSON 报告、日志和待补交互清单。完整验收还需补设置、快速聊天、刷新等路径。

macOS 源码包含：

- `scripts/`：安装、切换、恢复、诊断和构建脚本；
- `control-app/CodexThemeConsole.swift`：原生主题控制台源码；
- `assets/`：CSS 与渲染器注入代码；
- `local-presets/`：Terraria 主题配置与资源；
- `tests/`：Node.js 与 Shell 测试；
- `menubar/`：可选菜单栏脚本。
- `SELF_TEST_PLAYBOOK.md`：真实 Codex 页面自测清单、评分规则和复盘错题本。

一键检验当前皮肤：打开 macOS 皮肤控制台 → **皮肤检验**，或双击 `Inspect Codex Dream Skin.command`。也可执行：

```bash
npm run inspect -- --open
```

报告、截图与历史只保存在本机；分数只代表当前页自动抽检，未测页面不会算通过。详见 [检验工具使用说明](INSPECTION.md)。

运行测试：

```bash
./tests/run-tests.sh
```

安装开发副本：

```bash
./scripts/install-dream-skin-macos.sh --no-launch
```

普通用户请使用 GitHub Releases 中的 macOS 完整包。
