# Notices

TRSkin / Codex Terraria Skin Switcher 是非官方本地定制项目，与 OpenAI、Re-Logic 或 Terraria Wiki 无隶属、赞助或官方认可关系。

## 软件

仓库中的脚本、CSS、注入器、Swift 源码和项目文档受根目录 `LICENSE` 中的 MIT License 约束。

发行包可能包含未经修改的官方 Node.js 便携运行时；源码仓库不追踪这些可执行文件。Node.js 适用其上游许可证，相关文本保留在 `windows/TRSkin/core/runtime/LICENSE.node.txt`。

本项目不分发 Codex、Electron、OpenAI 应用文件或修改后的 `app.asar`。

## Terraria 第三方素材

`windows/TRSkin/core/local-presets/preset-terraria-*` 与 `macos/local-presets/preset-terraria-*` 包含 Terraria 相关第三方图片。这些文件不受本项目 MIT License 覆盖，本项目不授予其再分发或商业使用权利。

素材来源和完整性信息记录在各 `local-presets` 目录中的 `*_SOURCES.json` 等清单文件。下游使用者应自行遵守 Terraria、Re-Logic 及相关 Wiki 内容条款。

## 安全模型

TRSkin 不修改 Codex 应用签名、`app.asar`、认证数据、API Key 或模型提供商设置。主题通过仅绑定到 `127.0.0.1` 的 Chromium DevTools Protocol 端口应用；主题运行期间应避免不受信任的本地软件连接该端口。
