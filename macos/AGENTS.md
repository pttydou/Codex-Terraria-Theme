# Terraria 皮肤维护入口

- 开始升级适配、皮肤修复或完整验收时，先读 [UPGRADE_CHECKUP.md](UPGRADE_CHECKUP.md)，再查 [SELF_TEST_PLAYBOOK.md](SELF_TEST_PLAYBOOK.md) 相关ST。工具看INSPECTION.md，架构看STABILITY.md。
- 修改前核对磁盘/实际renderer版本、用户暂存主题与注入模式，保留修前证据；修复落到适配器、共享配色、生命周期、布局或资源生成入口。
- 交付前执行 `npm run checkup`，按任务范围补真实交互、看图及延迟复检。未测/unknown不计通过；当前页分数、历史满分、浏览器夹具不能代表整应用合格。
- 新浏览器回归命名 `tests/*-browser.test.mjs` 自动纳入；新源码测试登记tests/run-tests.sh。修同类组件并记漏测原因，避免只对截图位置加补丁。
- 保留用户主题、音乐、伙伴、窗口和注入模式；manual无watcher不能擅自重启。不要改官方asar或合并Codex/HairFree配置、认证、会话。
- 安装目录可能无Git metadata，不声称提交/同步远端；本机运行证据不提交、不上传。继续同一需求交接，不重复建档。
