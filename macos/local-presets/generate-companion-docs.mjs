import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(root, "..", "..");
const manifest = JSON.parse(
  await fs.readFile(path.join(root, "COMPANION_SOURCES.json"), "utf8"),
);
const themes = Object.values(manifest.themes);
const total = themes.reduce((sum, theme) => sum + theme.count, 0);
const animated = themes.reduce((sum, theme) => sum + theme.animatedCount, 0);
const critters = themes.reduce((sum, theme) =>
  sum + theme.companions.filter(({ type }) => type === "Critter").length, 0);
const version = (await fs.readFile(
  path.join(repositoryRoot, "macos", "VERSION"),
  "utf8",
)).trim();

const companionDocument = [
  "# Terraria 环境与事件伙伴表",
  "",
  `当前 ${themes.length} 套环境共有 **${total} 个伙伴候选**：${animated} 个官方 GIF 动图、${critters} 个动物或其他小动物候选。`,
  "",
  "伙伴按官方怪物图鉴的环境、地层、昼夜或事件筛选；同一环境中的解锁进度、困难模式和事件波次合并进一个完整伙伴池，天气怪不会混入普通环境。独立头部、身体、尾部素材以及无法在伙伴安全区内完整辨认的极端细长复合怪物不会进入伙伴池。进入环境时随机显示 1 个伙伴，之后每 12 秒更换且不连续重复。",
  "",
  "全环境随机会完整继承对应环境的伙伴池、稀有度权重、背景、配色、火把和固定建议卡，并继续支持用户排除不喜欢的环境。",
  "",
  "稀有度使用图鉴星级做相对权重：`1★=100`、`2★=55`、`3★=25`、`4★=10`、`5★=3`。这不是游戏刷怪率模拟，而是让稀有伙伴明显少见。",
  "",
  "| 环境 | 候选数 | GIF | 小动物 |",
  "| --- | ---: | ---: | ---: |",
  ...themes.map((theme) => {
    const smallAnimals = theme.companions.filter(({ type }) => type === "Critter").length;
    return `| ${theme.name.replace("Terraria · ", "")} | ${theme.count} | ${theme.animatedCount} | ${smallAnimals} |`;
  }),
  "",
];
for (const theme of themes) {
  companionDocument.push(`## ${theme.name.replace("Terraria · ", "")}（${theme.count}）`, "");
  companionDocument.push(theme.companions.map((companion) =>
    `${companion.animated ? "🎞" : "🖼"}${companion.type === "Critter" ? "🐾" : ""}`
    + `${companion.zhName || companion.name}（${companion.rarityStars || 1}★）`).join("、"), "");
}
await fs.writeFile(
  path.join(repositoryRoot, "docs", "TERRARIA_COMPANIONS.md"),
  `${companionDocument.join("\n")}\n`,
  "utf8",
);

const wrapNames = (companions) => {
  const entries = companions.map((companion) =>
    `${companion.animated ? "🎞" : "🖼"}${companion.zhName || companion.name}`
    + `（${companion.rarityStars || 1}★）`);
  const groups = [];
  for (let index = 0; index < entries.length; index += 6) {
    groups.push(entries.slice(index, index + 6).join("、"));
  }
  return groups.join("<br>") || "—";
};
const matrixDocument = [
  "# Terraria 环境伙伴总表",
  "",
  `这张表由 \`COMPANION_SOURCES.json\` 自动生成，列出当前 ${themes.length} 套皮肤的 **${total} 个伙伴候选**。`,
  "",
  "图鉴星级会降低稀有伙伴的抽取概率；同一时间只显示一只，12 秒轮换且不连续重复。多节残片与极端细长复合怪物不会作为伙伴出现。",
  "",
  "| 环境 | 敌怪伙伴 | 动物／小动物伙伴 | 总数（GIF） |",
  "| --- | --- | --- | ---: |",
  ...themes.map((theme) => {
    const enemies = theme.companions.filter(({ type }) => type === "Enemy");
    const smallAnimals = theme.companions.filter(({ type }) => type === "Critter");
    return `| ${theme.name.replace("Terraria · ", "")} | ${wrapNames(enemies)} | ${wrapNames(smallAnimals)} | ${theme.count}（${theme.animatedCount}） |`;
  }),
  "",
];
await fs.writeFile(
  path.join(repositoryRoot, "docs", "TERRARIA_ENVIRONMENT_PARTNERS.md"),
  `${matrixDocument.join("\n")}\n`,
  "utf8",
);

const catalogDocument = [
  "# Terraria 环境主题目录",
  "",
  `这份目录对应 Codex Dream Skin Studio ${version} 的 **${themes.length} 套固定环境／事件主题**和一套“全环境随机”主题。`,
  "",
  "## 拆分标准",
  "",
  "- 只按生物群系、地表／地下高度和昼夜拆分，并且仅在环境独有怪物确实有明显差异时保留两个主题。",
  "- 地表沙漠、地表腐化和地表猩红不拆昼夜，因为只看环境独有怪物时差异不足；天气暂不参与环境切分。",
  "- 不按肉前／肉后、Boss 解锁进度、地牢墙体派系或事件波次拆分。",
  "- 地牢、血月、日食、哥布林入侵、南瓜月和霜月各保留一套完整伙伴池。",
  `- ${themes.length} 套主题共收录 **${total} 个伙伴槽位**，其中 **${animated} 个为官方 GIF**、**${critters} 个为动物或其他小动物候选**。`,
  "- 伙伴每 12 秒更换且不连续重复；图鉴 1～5 星映射为 `100 / 55 / 25 / 10 / 3` 的相对权重。",
  `- “全环境随机”默认在全部 ${themes.length} 套主题中每 10 分钟无重复切换，可排除任意不喜欢的环境，但至少保留两套。`,
  "- 背景、配色、火把、伙伴池、伙伴权重和四张固定建议卡随环境成组切换；窗口隐藏或开启“减少动态效果”时暂停定时轮换。",
  "",
  "## 主题清单",
  "",
  "“稀有伙伴”指图鉴 4～5 星候选；完整名称、动图状态和星级见 [`TERRARIA_COMPANIONS.md`](./TERRARIA_COMPANIONS.md)。",
  "",
  "| 环境 | 主题 ID | 伙伴数 | GIF | 稀有伙伴 |",
  "| --- | --- | ---: | ---: | ---: |",
  ...Object.entries(manifest.themes).map(([variant, theme]) => {
    const rare = theme.companions.filter(({ rarityStars = 1 }) => rarityStars >= 4).length;
    return `| ${theme.name.replace("Terraria · ", "")} | \`${variant}\` | ${theme.count} | ${theme.animatedCount} | ${rare} |`;
  }),
  "",
  "## 资料与音乐边界",
  "",
  "所有伙伴与卡片素材 URL 见 `macos/local-presets/COMPANION_SOURCES.json` 与 `CARD_ICON_SOURCES.json`；高度和昼夜拆分来源见 `SPAWN_ENVIRONMENT_SOURCES.json`。",
  "",
  "发行包 **不附带也不下载 Terraria 商业原声文件**。用户可导入自己合法持有的本地音频，按环境顺序或随机播放；设置方法与安全边界见 [`TERRARIA_MUSIC.md`](./TERRARIA_MUSIC.md)。",
  "",
];
await fs.writeFile(
  path.join(repositoryRoot, "docs", "TERRARIA_THEME_CATALOG.md"),
  `${catalogDocument.join("\n")}\n`,
  "utf8",
);

console.log(JSON.stringify({
  themes: themes.length,
  companions: total,
  animated,
  critters,
}));
