# TRSkin for Windows

Windows 源码位于 `TRSkin/`：

- `START-TRSKIN.cmd`：单一启动入口；
- `core/scripts/`：PowerShell 与 Node.js 逻辑；
- `core/assets/`：CSS、渲染器注入代码和图标；
- `core/local-presets/`：Terraria 主题配置与资源；
- `core/runtime/`：运行时许可证与说明，不追踪 `node.exe`。

面向普通用户的完整可运行包请从 GitHub Releases 下载。源码开发时，如需执行完整 Windows 安装流程，请按根目录 README 的说明补充 Release 中的两套 Node.js 便携运行时。
