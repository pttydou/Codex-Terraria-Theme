# Terraria 环境主题目录

这份目录对应 TR Skin 2.6.0.10 / 2.6.0.17 的 **44 套固定环境／事件主题**和一套“全环境随机”主题。

## 拆分标准

- 只按生物群系、地表／地下高度和昼夜拆分，并且仅在环境独有怪物确实有明显差异时保留两个主题。
- 地表沙漠、地表腐化和地表猩红不拆昼夜，因为只看环境独有怪物时差异不足；天气暂不参与环境切分。
- 不按肉前／肉后、Boss 解锁进度、地牢墙体派系或事件波次拆分。
- 地牢、血月、日食、哥布林入侵、南瓜月和霜月各保留一套完整伙伴池。
- 44 套主题共收录 **524 个伙伴槽位**，其中 **449 个为官方 GIF**、**99 个为动物或其他小动物候选**。
- 伙伴每 12 秒更换且不连续重复；图鉴 1～5 星映射为 `100 / 55 / 25 / 10 / 3` 的相对权重。
- “全环境随机”默认在全部 44 套主题中每 10 分钟无重复切换，可排除任意不喜欢的环境，但至少保留两套。
- 背景、配色、火把、伙伴池、伙伴权重和四张固定建议卡随环境成组切换；窗口隐藏或开启“减少动态效果”时暂停定时轮换。

## 主题清单

“稀有伙伴”指图鉴 4～5 星候选；完整名称、动图状态和星级见 [`TERRARIA_COMPANIONS.md`](./TERRARIA_COMPANIONS.md)。

| 环境 | 主题 ID | 伙伴数 | GIF | 稀有伙伴 |
| --- | --- | ---: | ---: | ---: |
| 森林 · 白昼 | `forest-day` | 36 | 25 | 10 |
| 森林 · 夜晚 | `forest-night` | 38 | 34 | 7 |
| 地下层 | `underground` | 8 | 8 | 3 |
| 洞穴层 | `cavern` | 53 | 35 | 8 |
| 苔原 · 白昼 | `tundra` | 5 | 2 | 0 |
| 苔原 · 夜晚 | `tundra-night` | 7 | 4 | 0 |
| 地下冰雪 | `ice-biome` | 10 | 9 | 1 |
| 地表沙漠 | `desert` | 8 | 5 | 0 |
| 地下沙漠 | `underground-desert` | 12 | 12 | 0 |
| 丛林 · 白昼 | `jungle` | 21 | 16 | 2 |
| 丛林 · 夜晚 | `jungle-night` | 16 | 16 | 3 |
| 地下丛林 | `underground-jungle` | 24 | 24 | 3 |
| 神圣之地 · 白昼 | `hallow` | 6 | 5 | 1 |
| 神圣之地 · 夜晚 | `hallow-night` | 10 | 9 | 2 |
| 地下神圣 | `underground-hallow` | 4 | 3 | 1 |
| 地表腐化 | `corruption` | 6 | 5 | 0 |
| 地下腐化 | `underground-corruption` | 8 | 6 | 1 |
| 地表猩红 | `crimson` | 10 | 9 | 0 |
| 地下猩红 | `underground-crimson` | 11 | 10 | 1 |
| 地表夜光蘑菇 | `glowing-mushroom` | 8 | 6 | 0 |
| 地下夜光蘑菇 | `underground-glowing-mushroom` | 10 | 8 | 0 |
| 太空 | `space` | 7 | 7 | 4 |
| 地狱 | `underworld` | 15 | 15 | 3 |
| 海洋 | `ocean` | 15 | 14 | 3 |
| 地牢 | `dungeon` | 26 | 26 | 6 |
| 丛林神庙 | `jungle-temple` | 5 | 4 | 0 |
| 血月 | `blood-moon` | 16 | 16 | 7 |
| 日食 | `solar-eclipse` | 16 | 16 | 2 |
| 哥布林入侵 | `goblin-invasion` | 7 | 6 | 1 |
| 海盗入侵 | `pirate-invasion` | 8 | 8 | 1 |
| 火星人入侵 | `martian-invasion` | 12 | 11 | 2 |
| 以太 | `aether` | 6 | 6 | 2 |
| 墓地 | `graveyard` | 10 | 7 | 3 |
| 南瓜月 | `pumpkin-moon` | 16 | 16 | 1 |
| 霜月 | `frost-moon` | 15 | 13 | 1 |
| 日耀柱 | `lunar-solar` | 7 | 6 | 1 |
| 星旋柱 | `lunar-vortex` | 6 | 5 | 1 |
| 星云柱 | `lunar-nebula` | 5 | 4 | 1 |
| 星尘柱 | `lunar-stardust` | 7 | 6 | 1 |
| 陨石 | `meteorite` | 1 | 1 | 0 |
| 蜘蛛洞 | `spider-nest` | 4 | 4 | 0 |
| 蜂巢 | `bee-hive` | 3 | 3 | 0 |
| 花岗岩洞 | `granite-cave` | 3 | 2 | 0 |
| 大理石洞 | `marble-cave` | 3 | 2 | 1 |

## 资料与音乐边界

所有伙伴与卡片素材 URL 见 `macos/local-presets/COMPANION_SOURCES.json` 与 `CARD_ICON_SOURCES.json`；高度和昼夜拆分来源见 `SPAWN_ENVIRONMENT_SOURCES.json`。

发行包 **不附带也不下载 Terraria 原声文件**。用户可导入自己合法持有的本地音频，按环境顺序或随机播放；设置方法与安全边界见 [`TERRARIA_MUSIC.md`](./TERRARIA_MUSIC.md)。
