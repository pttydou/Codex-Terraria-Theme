# Contributing to TRSkin

感谢你帮助改进 TRSkin。从 v2.7.33 起仅维护 macOS；Windows 源码和 v2.7.10 下载作为历史版本保留，不再同步功能或兼容性修复。

## 开发流程

1. Fork 本仓库并从 `main` 创建功能分支。
2. 将修改限制在一个清晰主题内。
3. 不要提交音乐、运行日志、用户配置、账号信息、API Key、下载的运行时或已编译二进制文件。
4. 修改主题素材时，同步更新相应的来源清单和完整性信息。
5. 在对应平台完成验证后提交 Pull Request，说明测试环境、行为变化和风险边界。

## 测试

macOS：

```bash
cd macos
./tests/run-tests.sh
```

完整自动检查在 macOS 上执行：

```bash
npm run checkup -- --offline
```

源码与隔离浏览器检查必须通过；离线检查因未连接真实 Codex 返回 2，不代表全应用验收。浏览器依赖和实机补测见 [升级体检流程](macos/UPGRADE_CHECKUP.md)。发布工具修改另运行 `node --test release/tests/*.test.mjs`（仓库根目录）。

当前 CI 在 macOS 上执行源码/浏览器测试及 Swift 控制台编译；不要求同步或测试 Windows 镜像。

## 素材与版权

MIT License 只覆盖软件源码和项目文档。不要加入没有明确再分发权利的图片、音乐、角色素材或商标资源。Terraria 主题已有素材的来源记录必须保留。
