# TRSkin for macOS

macOS 源码包含：

- `scripts/`：安装、切换、恢复、诊断和构建脚本；
- `control-app/CodexThemeConsole.swift`：原生主题控制台源码；
- `assets/`：CSS 与渲染器注入代码；
- `local-presets/`：Terraria 主题配置与资源；
- `tests/`：Node.js 与 Shell 测试；
- `menubar/`：可选菜单栏脚本。

运行测试：

```bash
./tests/run-tests.sh
```

安装开发副本：

```bash
./scripts/install-dream-skin-macos.sh --no-launch
```

普通用户请使用 GitHub Releases 中的 macOS 完整包。
