# TRSkin repository rules

- 从 v2.7.33 起只维护 macOS。Windows 源码与 v2.7.10 发行版作为历史版本保留，
  不再同步功能、修复、版本号或构建发布；macOS 测试不得依赖 Windows 镜像。
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
- 提交前运行 macOS 源码测试与隔离浏览器回归；交付前执行 `npm run checkup`，
  非 Mac 设备明确记录未测项，并由 macOS CI 完成源码测试与原生编译。
- 发布版本以 `macos/VERSION` 和 `macos/package.json` 为准；发布流程只生成
  macOS 完整包、macOS Update 包、独立音乐包及校验/构建证明。

