import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The spawn-aware generator is now the supported refresh path. Keep the
// previous broad-biome implementation only as an explicit compatibility tool
// so an accidental refresh cannot collapse the 44-theme catalog back to 32.
if (!process.argv.includes("--legacy-broad-environments")) {
  await import("./rebuild-spawn-environments.mjs");
  process.exit(0);
}

const root = path.dirname(fileURLToPath(import.meta.url));
const wikiOrigin = "https://terraria.wiki.gg";
const npcApi = `${wikiOrigin}/api.php?action=parse&page=List_of_NPCs&prop=text&format=json&formatversion=2`;
const zhNpcApi = `${wikiOrigin}/zh/api.php?action=parse&page=NPC_%E5%88%97%E8%A1%A8&prop=text&format=json&formatversion=2`;
const favorTorchKeys = new Map([
  ["aether", "torch-aether"],
  ["dungeon", "torch-bone"],
  ["jungle-temple", "torch-jungle"],
  ["underworld", "torch-demon"],
  ["glowing-mushroom", "torch-mushroom"],
  ["hallow", "torch-hallowed"],
  ["corruption", "torch-corrupt"],
  ["crimson", "torch-crimson"],
  ["tundra", "torch-ice"],
  ["jungle", "torch-jungle"],
  ["underground-desert", "torch-desert"],
]);
const staticEnemyVariants = new Set([
  "aether", "graveyard", "pumpkin-moon", "frost-moon", "lunar-solar",
  "lunar-vortex", "lunar-nebula", "lunar-stardust", "meteorite",
  "spider-nest", "bee-hive", "granite-cave", "marble-cave",
]);
const excludedEntityNames = [
  "Blazing Wheel", "Crimson Axe", "Cursed Hammer", "Dutchman Cannon",
  "Enchanted Sword", "Mysterious Tablet", "Prime Saw", "Prime Vice", "Tesla Turret",
];
const excludedElongatedCompanionNames = new Set([
  "Blood Eel", "Bone Serpent", "Crawltipede", "Milkyway Weaver", "Wyvern",
]);
const isSegmentFragmentName = (name) => {
  const match = cleanName(name).match(/^(.+?) \((.+?) (Head|Body|Tail)\)$/i);
  return Boolean(match && match[1].toLowerCase() === match[2].toLowerCase());
};
// A few composite/static images do not have the same filename as the Chinese
// NPC table row. These are official Chinese names from that table/page family.
const zhFallbackNames = new Map([
  ["Golden Slime", "金史莱姆"],
  ["Salamander", "蝾螈"],
  ["Giant Worm", "巨型蠕虫"],
  ["Retinazer", "激光眼"],
  ["Spazmatism", "魔焰眼"],
  ["Skeletron Prime", "机械骷髅王"],
  ["Wyvern", "飞龙"],
  ["Bone Serpent", "骨蛇"],
  ["Devourer", "吞噬怪"],
  ["Scorpion (Black Scorpion)", "蝎子（黑蝎子）"],
  ["Scorpion", "蝎子"],
  ["Water Bolt Mimic", "水矢怪"],
  ["Martian Saucer", "火星飞碟"],
  ["Martian Saucer (Martian Saucer Core)", "火星飞碟（火星飞碟核心）"],
  ["Headache Skeleton", "头痛骷髅"],
  ["Misassembled Skeleton", "畸形骷髅"],
  ["Pantless Skeleton", "无裤骷髅"],
  ["Granite Slime", "花岗岩史莱姆"],
  ["Marble Slime", "大理石史莱姆"],
  ["Milkyway Weaver", "银河织妖"],
  ["Crawltipede", "千足蜈蚣"],
  ["Gingerbread Man", "姜饼人"],
  ["Elf Copter", "精灵直升机"],
  ["Corite", "流星火怪"],
]);
const lunarNames = {
  "lunar-solar": new Set([
    "Drakomire", "Drakomire Rider", "Sroller", "Corite", "Selenian", "Drakanian",
    "Solar Pillar",
  ]),
  "lunar-vortex": new Set([
    "Storm Diver", "Alien Queen", "Alien Hornet", "Alien Larva", "Vortexian",
    "Vortex Pillar",
  ]),
  "lunar-nebula": new Set([
    "Nebula Floater", "Brain Suckler", "Evolution Beast", "Predictor", "Nebula Pillar",
  ]),
  "lunar-stardust": new Set([
    "Star Cell", "Mini Star Cell", "Flow Invader", "Twinkle Popper", "Twinkle",
    "Stargazer", "Stardust Pillar",
  ]),
};
const themeRules = [
  ["forest-day", (environment) => environment.includes("Forest")],
  ["cavern", (environment) => environment.includes("Cavern")],
  ["space", (environment) => environment.includes("Space")],
  ["underworld", (environment) => environment.includes("Underworld")],
  ["crimson", (environment) => environment.includes("Crimson")],
  ["hallow", (environment) => environment.includes("Hallow")],
  ["corruption", (environment) => environment.includes("Corruption")],
  ["jungle", (environment) => environment.includes("Jungle") && !environment.includes("Jungle Temple")],
  ["tundra", (environment) => environment.includes("Snow biome") || environment.includes("Underground Snow")],
  ["desert", (environment) => environment.includes("Desert")],
  ["ocean", (environment) => environment.includes("Ocean")],
  ["glowing-mushroom", (environment) => environment.includes("Glowing Mushroom")],
  ["dungeon", (environment) => environment.includes("Dungeon") && !environment.includes("Jungle Temple")],
  ["jungle-temple", (environment) => environment.includes("Jungle Temple")],
  ["blood-moon", (environment) => environment.includes("Blood Moon")],
  ["solar-eclipse", (environment) => environment.includes("Solar Eclipse")],
  ["goblin-invasion", (environment) => environment.includes("Goblin Army")],
  ["pirate-invasion", (environment) => environment.includes("Pirate Invasion")],
  ["martian-invasion", (environment) => environment.includes("Martian Madness")],
  ["aether", (environment) => environment.includes("Aether")],
  ["graveyard", (environment) => environment.includes("Graveyard")],
  ["pumpkin-moon", (environment) => environment.includes("Pumpkin Moon")],
  ["frost-moon", (environment) => environment.includes("Frost Moon")],
  ...Object.entries(lunarNames).map(([variant, names]) => [
    variant,
    (environment, row) => environment.includes("Lunar Events") && names.has(cleanName(row.name)),
  ]),
  ["meteorite", (environment) => environment.includes("Meteorite")],
  ["spider-nest", (environment) => environment.includes("Spider Nest")],
  ["bee-hive", (environment) => environment.includes("Bee Hive")],
  ["granite-cave", (environment) => environment.includes("Granite Cave")],
  ["marble-cave", (environment) => environment.includes("Marble Cave")],
];
const extras = {
  cavern: [
    ["Giant Worm", "Enemy", `${wikiOrigin}/images/Giant_Worm.png?a9579b`],
  ],
  space: [
    ["Wyvern", "Enemy", `${wikiOrigin}/images/Wyvern.png?8fa8f8`],
  ],
  underworld: [
    ["Bone Serpent", "Enemy", `${wikiOrigin}/images/Bone_Serpent.png?3d464b`],
  ],
  corruption: [
    ["Devourer", "Enemy", `${wikiOrigin}/images/Devourer.png?3d8bf9`],
  ],
  desert: [
    ["Vulture", "Enemy", `${wikiOrigin}/images/Vulture.png?97297d`],
  ],
  "jungle-temple": [
    ["Golem Head", "Enemy", `${wikiOrigin}/images/Golem_Head.png?8b1577`],
  ],
  "goblin-invasion": [
    ["Goblin Sorcerer", "Enemy", `${wikiOrigin}/images/Goblin_Sorcerer.png?f61f19`],
  ],
  "martian-invasion": [
    ["Scutlix Gunner", "Enemy", `${wikiOrigin}/images/Scutlix_Gunner.png?31fde4`],
  ],
  aether: [
    ["Skeleton", "Enemy", `${wikiOrigin}/images/Skeleton.gif?26ef01`],
    ["Headache Skeleton", "Enemy", `${wikiOrigin}/images/Headache_Skeleton.gif?a556e5`],
    ["Misassembled Skeleton", "Enemy", `${wikiOrigin}/images/Misassembled_Skeleton.gif?5a451b`],
    ["Pantless Skeleton", "Enemy", `${wikiOrigin}/images/Pantless_Skeleton.gif?1fd14a`],
  ],
  "lunar-solar": [
    ["Crawltipede", "Enemy", `${wikiOrigin}/images/Crawltipede.png`],
  ],
  "lunar-stardust": [
    ["Milkyway Weaver", "Enemy", `${wikiOrigin}/images/Milkyway_Weaver.png`],
  ],
  "granite-cave": [
    ["Granite Slime", "Enemy", `${wikiOrigin}/images/Granite_Slime.png?ee8f79`],
  ],
  "marble-cave": [
    ["Marble Slime", "Enemy", `${wikiOrigin}/images/Marble_Slime.png?e66617`],
  ],
};

const decodeHtml = (value) => value
  .replace(/<[^>]+>/g, " ")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&apos;|&#0?39;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/\s+/g, " ")
  .trim();

function parseNpcRows(html) {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((row) => {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => cell[1]);
    if (cells.length < 11) return null;
    const image = cells[1].match(/<img[^>]+src="([^"]+)"/);
    return {
      name: decodeHtml(cells[2]),
      image: image?.[1] || "",
      environment: decodeHtml(cells[9]),
      type: decodeHtml(cells[10]),
    };
  }).filter(Boolean);
}

function cleanName(name) {
  return name.replace(/ \(Desktop, Console and Mobile versions\)/g, "").trim();
}

function cleanZhName(name) {
  return name
    .replace(/\s*[（(](?:电脑版|主机版|移动版)[^）)]*[）)]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value) {
  return value.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 27) || "creature";
}

async function fetchBytes(url, attempt = 1) {
  const parsed = new URL(url, wikiOrigin);
  if (parsed.protocol !== "https:" || parsed.hostname !== "terraria.wiki.gg") {
    throw new Error(`Rejected non-Wiki asset URL: ${parsed.href}`);
  }
  const response = await fetch(parsed, {
    headers: { "User-Agent": "CodexDreamSkinStudio/1.9 local-private-material-refresh" },
  });
  if (!response.ok) {
    if (attempt < 4 && (response.status === 429 || response.status >= 500)) {
      await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
      return fetchBytes(url, attempt + 1);
    }
    throw new Error(`Wiki asset download failed (${response.status}): ${parsed.href}`);
  }
  return { bytes: Buffer.from(await response.arrayBuffer()), url: parsed.href };
}

async function runConcurrent(tasks, limit = 8) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const index = next;
      next += 1;
      await tasks[index]();
    }
  });
  await Promise.all(workers);
}

const apiHeaders = { "User-Agent": "CodexDreamSkinStudio/1.9 local-private-material-refresh" };
const [apiResponse, zhApiResponse] = await Promise.all([
  fetch(npcApi, { headers: apiHeaders }),
  fetch(zhNpcApi, { headers: apiHeaders }),
]);
if (!apiResponse.ok) throw new Error(`NPC list request failed: ${apiResponse.status}`);
if (!zhApiResponse.ok) throw new Error(`Chinese NPC list request failed: ${zhApiResponse.status}`);
const [apiPayload, zhApiPayload] = await Promise.all([apiResponse.json(), zhApiResponse.json()]);
const rows = parseNpcRows(apiPayload?.parse?.text || "");
const zhRows = parseNpcRows(zhApiPayload?.parse?.text || "");
if (rows.length < 500 || zhRows.length < 500) throw new Error("Official NPC table was incomplete");
const zhNamesByImage = new Map();
for (const row of zhRows) {
  if (!row.image || row.image.includes("/thumb/")) continue;
  const imagePath = new URL(row.image, wikiOrigin).pathname;
  if (!zhNamesByImage.has(imagePath)) zhNamesByImage.set(imagePath, cleanZhName(row.name));
}

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: `${wikiOrigin}/wiki/List_of_NPCs`,
  zhSource: `${wikiOrigin}/zh/wiki/NPC_%E5%88%97%E8%A1%A8`,
  selection: "All unique full GIF enemies plus GIF/PNG critters matched to each theme; item-like entities and isolated multipart Head/Body/Tail sprites excluded.",
  gemTorches: [],
  themes: {},
};
const downloadTasks = [];

for (const [variant, matchesEnvironment] of themeRules) {
  const themeRoot = path.join(root, `preset-terraria-${variant}`);
  const themePath = path.join(themeRoot, "theme.json");
  const theme = JSON.parse(await fs.readFile(themePath, "utf8"));
  const oldCompanions = new Set(Array.isArray(theme.companionPool) ? theme.companionPool : []);
  for (const key of oldCompanions) delete theme.assets[key];

  const candidates = rows.filter((row) => {
    if (!matchesEnvironment(row.environment, row)) return false;
    if (row.type !== "Enemy" && row.type !== "Critter") return false;
    if (!row.image || row.image.includes("/thumb/") || row.name.includes("(Mimic)")) return false;
    if (row.name.includes("Pumpking Blade")) return false;
    if (excludedEntityNames.some((name) => row.name.startsWith(name))) return false;
    if (excludedElongatedCompanionNames.has(cleanName(row.name))) return false;
    if (isSegmentFragmentName(row.name)) return false;
    return row.image.toLowerCase().includes(".gif")
      || row.type === "Critter"
      || staticEnemyVariants.has(variant);
  });
  const gifNames = new Set(candidates.filter((row) => row.image.toLowerCase().includes(".gif"))
    .map((row) => cleanName(row.name)));
  const selected = candidates.filter((row) => !(
    !row.image.toLowerCase().includes(".gif") && gifNames.has(cleanName(row.name))
  ));
  for (const [name, type, url] of extras[variant] || []) {
    if (excludedElongatedCompanionNames.has(cleanName(name))) continue;
    selected.push({ name, type, image: url, environment: variant });
  }

  const seenUrls = new Set();
  const usedKeys = new Set();
  const companions = [];
  for (const row of selected) {
    const sourceUrl = new URL(row.image, wikiOrigin).href;
    const urlIdentity = sourceUrl.replace(/\?.*$/, "");
    if (seenUrls.has(urlIdentity)) continue;
    seenUrls.add(urlIdentity);
    const base = `companion-${slug(cleanName(row.name))}`;
    let key = base;
    let suffix = 2;
    while (usedKeys.has(key) || Object.hasOwn(theme.assets, key)) {
      key = `${base.slice(0, 37 - String(suffix).length)}-${suffix}`;
      suffix += 1;
    }
    usedKeys.add(key);
    const extension = path.extname(new URL(sourceUrl).pathname).toLowerCase();
    if (extension !== ".gif" && extension !== ".png") continue;
    const file = `${key}${extension}`;
    theme.assets[key] = file;
    const englishName = cleanName(row.name);
    companions.push({
      key,
      name: englishName,
      zhName: zhNamesByImage.get(new URL(sourceUrl).pathname)
        || zhFallbackNames.get(englishName) || englishName,
      type: row.type,
      animated: extension === ".gif" || extension === ".apng",
      file,
      sourceUrl,
    });
    downloadTasks.push(async () => {
      const result = await fetchBytes(sourceUrl);
      if (result.bytes.length < 20 || result.bytes.length > 2 * 1024 * 1024) {
        throw new Error(`Unexpected companion size for ${sourceUrl}: ${result.bytes.length}`);
      }
      await fs.writeFile(path.join(themeRoot, file), result.bytes);
    });
  }
  if (companions.length < 1 || companions.length > 64) {
    throw new Error(`${variant} selected an invalid companion count: ${companions.length}`);
  }
  theme.companionPool = companions.map(({ key }) => key);
  theme.cardIconPool = ["explore", "build", "review", "fix"];

  const favorTorchKey = favorTorchKeys.get(variant);
  delete theme.torchPool;
  if (favorTorchKey && Object.hasOwn(theme.assets, favorTorchKey)) {
    theme.torchKey = favorTorchKey;
  } else {
    delete theme.torchKey;
  }
  manifest.themes[variant] = {
    name: theme.name,
    count: companions.length,
    animatedCount: companions.filter(({ animated }) => animated).length,
    companions,
    torchMode: favorTorchKey ? "torch-god-favor" : "none",
  };
  await fs.writeFile(themePath, `${JSON.stringify(theme, null, 2)}\n`, "utf8");
}

await runConcurrent(downloadTasks);
await fs.writeFile(
  path.join(root, "COMPANION_SOURCES.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);
const total = Object.values(manifest.themes).reduce((sum, theme) => sum + theme.count, 0);
const animated = Object.values(manifest.themes).reduce((sum, theme) => sum + theme.animatedCount, 0);
const critters = Object.values(manifest.themes).reduce((sum, theme) =>
  sum + theme.companions.filter(({ type }) => type === "Critter").length, 0);
const companionDocument = [
  "# Terraria 环境与事件伙伴表",
  "",
  `当前 ${themeRules.length} 套环境共有 **${total} 个伙伴候选**：${animated} 个官方 GIF 动图、${critters} 个动物或其他小动物候选。伙伴只保留 Wiki NPC 表中的敌怪和小动物；物品、武器、载具、机关及多节怪的独立头部、身体、尾部图片不进入伙伴池。`,
  "",
  "进入主题时随机显示 1 个伙伴，之后每 12 秒更换且不连续重复；任何时候都只显示一只。全环境随机会完整继承对应环境的伙伴池，并可继续用控制台排除不喜欢的环境。",
  "",
  "标记：`🎞` 为 GIF 动图，`🖼` 为静态 PNG，`🐾` 为 Critter（动物或其他小动物）。名称沿用 Terraria Wiki 的官方素材名。",
  "",
  "| 环境 | 候选数 | GIF | 小动物 | 火把规则 |",
  "| --- | ---: | ---: | ---: | --- |",
  ...Object.values(manifest.themes).map((theme) => {
    const smallAnimals = theme.companions.filter(({ type }) => type === "Critter").length;
    const torch = theme.torchMode === "torch-god-favor"
      ? "火把神恩赐对应火把" : "—";
    return `| ${theme.name.replace("Terraria · ", "")} | ${theme.count} | ${theme.animatedCount} | ${smallAnimals} | ${torch} |`;
  }),
  "",
];
for (const theme of Object.values(manifest.themes)) {
  companionDocument.push(`## ${theme.name.replace("Terraria · ", "")}（${theme.count}）`, "");
  companionDocument.push(theme.companions.map(({ name, zhName, animated: isAnimated, type }) => {
    const markers = `${isAnimated ? "🎞" : "🖼"}${type === "Critter" ? "🐾" : ""}`;
    return `${markers} ${zhName || name}`;
  }).join("、"), "");
}
await fs.writeFile(
  path.resolve(root, "..", "..", "docs", "TERRARIA_COMPANIONS.md"),
  `${companionDocument.join("\n")}\n`,
  "utf8",
);
const wrapNames = (companions) => {
  const entries = companions.map(({ name, zhName, animated: isAnimated }) =>
    `${isAnimated ? "🎞" : "🖼"}${zhName || name}`);
  const groups = [];
  for (let index = 0; index < entries.length; index += 6) {
    groups.push(entries.slice(index, index + 6).join("、"));
  }
  return groups.join("<br>") || "—";
};
const matrixDocument = [
  "# Terraria 环境伙伴总表",
  "",
  `这张表由 \`COMPANION_SOURCES.json\` 自动生成，列出当前 ${themeRules.length} 套皮肤实际会随机出现的 **${total} 个伙伴候选**，其中 ${animated} 个为官方 GIF 动图、${critters} 个为动物或其他小动物。中文名来自官方中文 Terraria Wiki 的 NPC 列表，\`🎞\` 表示 GIF 动图，\`🖼\` 表示静态 PNG。物品、武器、载具和机关不属于伙伴；小动物单独列出。`,
  "",
  "伙伴进入环境时随机 1 个，之后每 12 秒更换且不连续重复；同一时间只显示一只。“全环境随机”切换到某个环境后会使用该环境自己的伙伴池，用户排除的环境不会参与轮换。",
  "",
  "> 同名条目不一定是重复素材。例如部分骷髅、蝾螈、龙虾和卷壳怪在官方 NPC 表里有不同造型或尺寸，中文名归一后看起来相同，但运行时对应不同图片。",
  "",
  "| 环境 | 敌怪伙伴 | 动物／小动物伙伴 | 总数（GIF） |",
  "| --- | --- | --- | ---: |",
  ...Object.values(manifest.themes).map((theme) => {
    const enemies = theme.companions.filter(({ type }) => type === "Enemy");
    const smallAnimals = theme.companions.filter(({ type }) => type === "Critter");
    return `| ${theme.name.replace("Terraria · ", "")} | ${wrapNames(enemies)} | ${wrapNames(smallAnimals)} | ${theme.count}（${theme.animatedCount}） |`;
  }),
  "",
];
await fs.writeFile(
  path.resolve(root, "..", "..", "docs", "TERRARIA_ENVIRONMENT_PARTNERS.md"),
  `${matrixDocument.join("\n")}\n`,
  "utf8",
);
console.log(`Refreshed ${total} companion slots (${animated} animated) across ${themeRules.length} themes.`);
