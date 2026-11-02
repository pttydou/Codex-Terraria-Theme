# 发布溯源与验证

## 当前发布流程（v2.7.33 起仅 macOS）

TRSkin 的标准发布链为：

```text
合并源码 → 创建版本标签 → GitHub Actions 测试 → 构建 macOS 包
        → 生成 SHA-256 与更新清单 → 生成构建证明 → 发布 Release
```

发布工作流会强制以下值完全一致，否则停止构建：

- Git 标签 `v<版本>`；
- `macos/VERSION`；
- `macos/package.json` 中的版本；
- ZIP 文件名和包内 `BUILD-INFO.json`。

Windows 已停止维护，最后版本为 [v2.7.10](https://github.com/pttydou/Codex-Terraria-Theme/releases/tag/v2.7.10)；其源码、版本号和旧产物保留，不参与当前发布。历史 Windows 的 Node.js 可执行文件来自 Node.js 官方下载地址，URL、下载归档 SHA-256、`node.exe` SHA-256 与许可证 SHA-256 固定记录在 [`NODE-RUNTIME.json`](../windows/TRSkin/core/legal/NODE-RUNTIME.json)。音乐不进入源码仓库；完整包使用 [`release-config.json`](../release/release-config.json) 中固定版本和 SHA-256 的公开 Music Pack 作为构建输入。

## CI 发布的文件

- `TRSkin-macOS-<版本>.zip`：macOS 完整包；
- `TRSkin-macOS-Update-<版本>.zip`：macOS 更新包，不含音乐；
- `TRSkin-Music-Pack.zip`：经固定 SHA-256 验证后复用的独立音乐包；
- `SHA256SUMS.txt`：所有发布文件的 SHA-256；
- `update-manifest.json`：自动更新器使用的版本、大小、哈希和源码 commit。

## 用户验证

校验文件哈希：

```bash
shasum -a 256 -c SHA256SUMS.txt
```

该命令要求下载清单内全部文件；只下载一个安装包时，可运行 `shasum -a 256 <文件>` 与清单中对应项比较。

验证 ZIP 是否确实由本仓库的 GitHub Actions 工作流产生：

```bash
gh attestation verify TRSkin-macOS-<版本>.zip -R pttydou/Codex-Terraria-Theme
```

GitHub 的构建证明会关联仓库、工作流、commit、触发事件与产物哈希。它证明产物来源和完整性，但不等同于代码本身没有安全问题。

## 本地复现打包步骤

macOS 包必须在 macOS 上构建，因为流程会使用系统 Swift 编译器生成原生控制台并执行本地 ad-hoc 签名：

```bash
commit="$(git rev-parse HEAD)"
bash release/build-macos.sh 2.7.33 ./dist "$commit" ./TRSkin-Music-Pack.zip
```

GitHub Actions 使用同一组公开脚本。更新清单只包含 `platforms.macos`，不发布虚构的 Windows 新版本。旧 Windows 更新器会忽略不含 Windows 包的清单。

CI 使用隔离浏览器夹具；真实 Codex 页面、音乐播放和完整交互矩阵需在 Mac 上另行验收，不能将自动检查当作完整实机验收。

## v2.6.0.17 历史说明

`v2.6.0.17` 是迁移到公开源码与 CI 之前的历史 Release：标签先指向了空的初始提交，ZIP 由作者本地构建后上传，完整源码随后才公开。因此无法仅根据 GitHub 证明该 Release ZIP 由标签对应源码生成。

此外，旧 Windows ZIP 文件名为 `2.6.0.17`，包内引擎 `VERSION` 实际为 `2.6.0.19`。保留旧标签和旧 Release 是为了不改写历史；项目不对它追加事后构建证明。从 `v2.7.0` 起使用上面的可追溯流程。
