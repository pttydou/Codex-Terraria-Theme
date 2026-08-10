# TRSkin repository rules

- macOS 与 Windows 的 Composer DOM 发现逻辑必须同步维护。涉及
  `macos/assets/renderer-inject.js`、`windows/TRSkin/core/assets/renderer-inject.js`
  或任一平台 `dream-skin.css` 的修改，必须检查另一平台镜像。
- Composer 优先通过 `data-composer-surface-variant`、
  `data-composer-utility-bar-variant`、`data-composer-layout` 和
  `data-composer-home-utility-bar-position` 等稳定属性发现。
- Codex 原生 CSS Module 类只能用于兼容发现，不能作为主要视觉 CSS 的归属选择器。
  Composer 视觉样式统一依赖 `.dream-skin-composer-surface`，首页环境栏统一依赖
  `.dream-skin-home-utility`。
- 注入、重新发现与恢复必须清理失效的皮肤自有标记，确保同一时间只有当前可见
  Composer 带有 `.dream-skin-composer-surface`。
- 不修改官方 Codex `.app`、`app.asar`、代码签名、认证或业务项目源码。TRSkin 只管理
  仓库和用户目录中的独立皮肤运行时，并通过回环 CDP 连接执行热注入。
- 提交前至少运行 `cd macos && npm test`；Windows 可用时同时运行
  `powershell -File windows/tests/run-tests.ps1`。

