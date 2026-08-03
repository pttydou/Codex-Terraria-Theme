# TRSkin

TRSkin 是一个非官方的 Codex Desktop Terraria 主题切换器，提供 Windows 与 macOS 支持、44 套环境/事件主题，以及全环境随机模式。

> 本项目与 OpenAI、Re-Logic 或 Terraria Wiki 无隶属、赞助或官方认可关系。

## 下载

普通用户请直接打开 [最新 Release](https://github.com/pttydou/TRSkin/releases/latest)，按用途选择：

- 首次安装：`TRSkin-Windows-<版本>.zip` 或 `TRSkin-macOS-<版本>.zip` 完整包；
- 已安装用户：程序自动提示下载对应平台的 `Update` 包；
- 只需补充音乐：`TRSkin-Music-Pack.zip`。

从 `v2.7.0` 开始，Release 由 GitHub Actions 从版本标签对应的源码自动测试和构建。Windows/macOS 完整包与 Update 包均带源码 commit 信息，并发布 SHA-256 与 GitHub 构建证明；独立 Music Pack 作为固定哈希的外部内容输入管理。详细说明见[发布溯源与验证](docs/RELEASE-PROVENANCE.md)。

## 安装与使用

### Windows

1. 从 Release 下载最新的 `TRSkin-Windows-<版本>.zip`。
2. 完整解压 ZIP，不要直接在压缩包预览窗口中运行。
3. 打开解压后的 `TRSkin` 文件夹。
4. 双击 `START-TRSKIN.cmd`。
5. 首次安装完成后，通过桌面的 **TR Skin Control Panel** 选择环境、随机模式和音乐设置。

需要恢复 Codex 官方外观时，在 TR Skin 控制面板或托盘菜单中选择恢复；恢复不会删除已经保存的主题和音乐配置。

### macOS

1. 从 Release 下载最新的 `TRSkin-macOS-<版本>.zip`。
2. 完整解压后双击 `START-CODEX-TERRARIA.app`。
3. 首次如被 macOS 阻止，请右键应用并选择 **打开**。
4. 安装完成后，通过主题控制台选择环境、随机模式和音乐设置。

需要恢复官方外观时，在主题控制台中选择恢复；引擎和已保存主题会继续保留。

### 单独安装 Music Pack

解压 `TRSkin-Music-Pack.zip`，得到 `bundled-music/` 和 `bundled-music.json`：

- Windows：放到 `TRSkin/core/` 下，与 `scripts/` 同级；
- macOS：放到 `.codex-dream-skin-studio/` 下，与 `scripts/` 同级。

首次播放音乐时，需要在 Codex 主题界面中点击一次音乐按钮。音乐功能默认不会自动播放。

## 更新机制

从 `2.7.0` 开始，Windows 桌面入口和 macOS 控制台每 24 小时最多检查一次最新版本。发现更新时会先询问用户，再执行以下流程：

1. 只下载当前平台的 `Update` 包，不下载完整包或 Music Pack；
2. 校验下载大小、SHA-256、版本号、源码 commit 和包内构建身份；
3. 将新引擎暂存并替换旧引擎，失败时恢复旧引擎；
4. 成功后删除旧引擎备份、下载 ZIP 和临时目录。

音乐、主题和设置存放在引擎以外的持久目录中：

- Windows：`%LOCALAPPDATA%\CodexDreamSkin`；
- macOS：`~/Library/Application Support/CodexDreamSkinStudio`。

因此普通代码更新不会重复下载或删除音乐。只有 Music Pack 版本发生变化时，用户才需要单独更新音乐。设置环境变量 `TRSKIN_DISABLE_UPDATE_CHECK=1` 可以关闭联网检查。

## 仓库结构

```text
TRSkin/
├─ windows/TRSkin/       Windows 启动器、PowerShell/Node 脚本和主题资源
├─ macos/                macOS Shell/Node 脚本、Swift 控制台源码和测试
├─ docs/                 主题目录、素材来源和开发参考
├─ CONTRIBUTING.md       贡献指南
├─ LICENSE               软件源码许可证
└─ NOTICE.md             商标、第三方素材和安全说明
```

音乐文件、构建产物、用户配置和便携 Node.js 可执行文件不会进入源码仓库。

## 从源码开始

```bash
git clone https://github.com/pttydou/TRSkin.git
cd TRSkin
```

### Windows

Windows 的发布包内置 x64/arm64 Node.js 运行时，源码仓库不追踪这些大型二进制文件。CI 会按照 [`NODE-RUNTIME.json`](windows/TRSkin/core/legal/NODE-RUNTIME.json) 中固定的官方地址和 SHA-256 下载 Node。若要直接从源码运行安装流程，可运行公开打包脚本，或者从对应 Release 包复制：

```text
TRSkin/core/runtime/win-x64/node.exe
TRSkin/core/runtime/win-arm64/node.exe
```

到源码树中的：

```text
windows/TRSkin/core/runtime/
```

然后运行 `windows/TRSkin/START-TRSKIN.cmd`。普通用户无需执行这一步，直接下载 Release 即可。

公开构建命令和 CI 流程见[发布溯源文档](docs/RELEASE-PROVENANCE.md)与 [release workflow](.github/workflows/release.yml)。

### macOS

macOS 开发环境要求官方 Codex Desktop 已安装，并建议使用 Node.js 20 或更高版本执行测试：

```bash
cd macos
./tests/run-tests.sh
./scripts/install-dream-skin-macos.sh --no-launch
```

相关脚本只通过本机回环地址连接 Codex 的调试端口，不修改官方 `.app`、`app.asar` 或代码签名。

## 参与修改

欢迎 Fork 仓库、创建功能分支并提交 Pull Request。提交前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)，不要提交音乐、用户图片、账号数据、日志或构建后的二进制文件。

## 许可证与素材

脚本、CSS、注入器、Swift 源码和项目文档采用 [MIT License](LICENSE)。`local-presets/preset-terraria-*` 中的 Terraria 相关素材属于第三方内容，不包含在 MIT 授权中；来源记录和适用条款见 [NOTICE.md](NOTICE.md) 及目录内的来源清单。

## 安全边界

TRSkin 不修改 Codex 认证信息、API Key、模型提供商设置、WindowsApps 或应用签名。主题会话使用仅绑定到 `127.0.0.1` 的 Chromium DevTools Protocol 端口；不使用主题时请执行恢复操作关闭注入器和调试端口。
