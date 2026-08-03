import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(root, "..", "..");
const wikiOrigin = "https://terraria.wiki.gg";
const headers = {
  "User-Agent": "CodexDreamSkinStudio/2.1 local-private-spawn-environment-refresh",
};
const rarityWeights = { 1: 100, 2: 55, 3: 25, 4: 10, 5: 3 };
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
const normalEnvironment = (tokens) =>
  !tokens.some((token) => token.startsWith("Bestiary_Events."));
const hasBiome = (biome) => (record) =>
  normalEnvironment(record.tokens) && record.tokens.includes(`Bestiary_Biomes.${biome}`);
const surfaceAt = (biome, time) => (record) => {
  if (!hasBiome(biome)(record)) return false;
  const opposite = time === "DayTime" ? "NightTime" : "DayTime";
  return !record.tokens.includes(`Bestiary_Times.${opposite}`);
};
const forestNight = (record) => {
  if (!normalEnvironment(record.tokens)
    || !record.tokens.includes("Bestiary_Times.NightTime")) return false;
  return !record.tokens.some((token) =>
    token.startsWith("Bestiary_Biomes.") && token !== "Bestiary_Biomes.Surface");
};

const variants = [
  {
    variant: "forest-day",
    base: "forest-day",
    name: "Terraria · 森林 · 白昼",
    brandSubtitle: "THE FOREST · DAY",
    statusText: "森林地表·白昼",
    tagline: "阳光穿过树梢，史莱姆开始苏醒。",
    quote: "THE ADVENTURE BEGINS AT DAWN",
    match: surfaceAt("Surface", "DayTime"),
  },
  {
    variant: "forest-night",
    base: "forest-day",
    name: "Terraria · 森林 · 夜晚",
    brandSubtitle: "THE FOREST · NIGHT",
    statusText: "森林地表·夜晚",
    tagline: "月色升起，僵尸与恶魔眼开始游荡。",
    quote: "THE NIGHT HAS EYES",
    match: forestNight,
    colors: {
      background: "#0a1024", panel: "#182344", panelAlt: "#28385d",
      accent: "#a9c9ff", accentAlt: "#8d79e8", secondary: "#68c4ff",
      highlight: "#584a99", text: "#f2f4ff", muted: "#bdc8df",
      line: "rgba(169, 201, 255, .50)",
    },
  },
  {
    variant: "underground",
    base: "cavern",
    name: "Terraria · 地下层",
    brandSubtitle: "THE UNDERGROUND",
    statusText: "地下层探索",
    tagline: "地表已经远去，矿脉仍在向下延伸。",
    quote: "BELOW THE SURFACE",
    match: hasBiome("Underground"),
    backgroundUrl: `${wikiOrigin}/images/Underground_background_8.png?5db4cb`,
    colors: {
      background: "#17130f", panel: "#3b3024", panelAlt: "#594736",
      accent: "#e7ba72", accentAlt: "#b47a49", secondary: "#8fc7bd",
      highlight: "#6d4d36", text: "#fff0d9", muted: "#d6c2a8",
      line: "rgba(231, 186, 114, .50)",
    },
  },
  {
    variant: "cavern",
    base: "cavern",
    name: "Terraria · 洞穴层",
    brandSubtitle: "THE CAVERN LAYER",
    statusText: "洞穴层探索",
    tagline: "更深的石层里，稀有生物正在潜伏。",
    quote: "DIG DEEPER",
    match: hasBiome("Caverns"),
  },
  {
    variant: "tundra",
    base: "tundra",
    name: "Terraria · 苔原 · 白昼",
    brandSubtitle: "THE TUNDRA · DAY",
    statusText: "雪原地表·白昼",
    tagline: "雪光照亮针叶林与冰原。",
    quote: "A QUIET DAY IN THE SNOW",
    match: surfaceAt("Snow", "DayTime"),
  },
  {
    variant: "tundra-night",
    base: "tundra",
    name: "Terraria · 苔原 · 夜晚",
    brandSubtitle: "THE TUNDRA · NIGHT",
    statusText: "雪原地表·夜晚",
    tagline: "寒夜降临，狼群在雪线外徘徊。",
    quote: "THE FROZEN NIGHT HOWLS",
    match: surfaceAt("Snow", "NightTime"),
    colors: {
      background: "#071827", panel: "#153a55", panelAlt: "#265776",
      accent: "#c4efff", accentAlt: "#7899e8", secondary: "#7edcff",
      highlight: "#4b66a1", text: "#f5fbff", muted: "#c4d8e5",
      line: "rgba(196, 239, 255, .52)",
    },
  },
  {
    variant: "ice-biome",
    base: "tundra",
    name: "Terraria · 地下冰雪",
    brandSubtitle: "THE ICE BIOME",
    statusText: "地下冰雪生物群落",
    tagline: "冰层之下，寒气凝结成另一座洞穴。",
    quote: "ICE RUNS DEEP",
    match: hasBiome("UndergroundSnow"),
    backgroundUrl: `${wikiOrigin}/images/Ice_biome_background_4.png?8fbc82`,
    colors: {
      background: "#071a28", panel: "#16425e", panelAlt: "#286d89",
      accent: "#b9f3ff", accentAlt: "#65bfff", secondary: "#d8eaff",
      highlight: "#4d83b4", text: "#f5fdff", muted: "#c4dce8",
      line: "rgba(185, 243, 255, .56)",
    },
  },
  {
    variant: "desert",
    base: "desert",
    name: "Terraria · 地表沙漠",
    brandSubtitle: "THE SURFACE DESERT",
    statusText: "地表沙漠",
    tagline: "烈日与黄沙守住世界的干旱地带。",
    quote: "THE DUNES REMEMBER",
    match: hasBiome("Desert"),
  },
  {
    variant: "underground-desert",
    base: "desert",
    name: "Terraria · 地下沙漠",
    brandSubtitle: "THE UNDERGROUND DESERT",
    statusText: "地下沙漠",
    tagline: "硬化沙层深处，蚁狮巢穴仍在扩张。",
    quote: "THE SAND MOVES BELOW",
    match: hasBiome("UndergroundDesert"),
    backgroundUrl: `${wikiOrigin}/images/Sandstone_Wall_%28placed%29.png?ed6267`,
    colors: {
      background: "#241506", panel: "#51351b", panelAlt: "#79522a",
      accent: "#f4c763", accentAlt: "#d98a37", secondary: "#f0ad66",
      highlight: "#8f5a2c", text: "#fff0d1", muted: "#ddc19b",
      line: "rgba(244, 199, 99, .55)",
    },
  },
  {
    variant: "jungle",
    base: "jungle",
    name: "Terraria · 丛林 · 白昼",
    brandSubtitle: "THE JUNGLE · DAY",
    statusText: "丛林地表·白昼",
    tagline: "藤蔓与阳光争夺每一寸树冠。",
    quote: "THE JUNGLE BREATHES",
    match: surfaceAt("Jungle", "DayTime"),
  },
  {
    variant: "jungle-night",
    base: "jungle",
    name: "Terraria · 丛林 · 夜晚",
    brandSubtitle: "THE JUNGLE · NIGHT",
    statusText: "丛林地表·夜晚",
    tagline: "夜色压低树冠，飞狐从林间掠过。",
    quote: "THE CANOPY NEVER SLEEPS",
    match: surfaceAt("Jungle", "NightTime"),
    colors: {
      background: "#07170e", panel: "#173d25", panelAlt: "#28603b",
      accent: "#88e06e", accentAlt: "#d8b84f", secondary: "#65d8bd",
      highlight: "#476f3e", text: "#f0ffe8", muted: "#b9d5b9",
      line: "rgba(136, 224, 110, .50)",
    },
  },
  {
    variant: "underground-jungle",
    base: "jungle",
    name: "Terraria · 地下丛林",
    brandSubtitle: "THE UNDERGROUND JUNGLE",
    statusText: "地下丛林",
    tagline: "泥块、蜂巢和孢子挤满潮湿洞穴。",
    quote: "THE ROOTS GO DEEPER",
    match: hasBiome("UndergroundJungle"),
    backgroundUrl: `${wikiOrigin}/images/Cavern_jungle_background_2.png?353ec5`,
    colors: {
      background: "#07180c", panel: "#174226", panelAlt: "#27683a",
      accent: "#91e85d", accentAlt: "#cfb83f", secondary: "#64d5a7",
      highlight: "#4b7d35", text: "#f0ffe5", muted: "#bad5b2",
      line: "rgba(145, 232, 93, .54)",
    },
  },
  {
    variant: "hallow",
    base: "hallow",
    name: "Terraria · 神圣之地 · 白昼",
    brandSubtitle: "THE HALLOW · DAY",
    statusText: "神圣地表·白昼",
    tagline: "珍珠木与彩虹照亮明亮地表。",
    quote: "LIGHT TAKES ROOT",
    match: surfaceAt("TheHallow", "DayTime"),
  },
  {
    variant: "hallow-night",
    base: "hallow",
    name: "Terraria · 神圣之地 · 夜晚",
    brandSubtitle: "THE HALLOW · NIGHT",
    statusText: "神圣地表·夜晚",
    tagline: "星光下，腹足怪与七彩草蛉开始发亮。",
    quote: "THE NIGHT GLITTERS",
    match: surfaceAt("TheHallow", "NightTime"),
    colors: {
      background: "#17102f", panel: "#39265f", panelAlt: "#5b4088",
      accent: "#ef9dff", accentAlt: "#80d5ff", secondary: "#c9a7ff",
      highlight: "#7455ad", text: "#fff3ff", muted: "#dbc7e7",
      line: "rgba(239, 157, 255, .54)",
    },
  },
  {
    variant: "underground-hallow",
    base: "hallow",
    name: "Terraria · 地下神圣",
    brandSubtitle: "THE UNDERGROUND HALLOW",
    statusText: "地下神圣之地",
    tagline: "水晶洞壁将每一点光折射成彩虹。",
    quote: "CRYSTAL LIGHT BELOW",
    match: hasBiome("UndergroundHallow"),
    backgroundUrl: `${wikiOrigin}/images/Underground_hallow_background_2.png?81ea30`,
    colors: {
      background: "#15112b", panel: "#382b61", panelAlt: "#5d478f",
      accent: "#e6a0ff", accentAlt: "#7fdcff", secondary: "#bda5ff",
      highlight: "#7157ab", text: "#fff1ff", muted: "#d9c9e8",
      line: "rgba(230, 160, 255, .55)",
    },
  },
  {
    variant: "corruption",
    base: "corruption",
    name: "Terraria · 地表腐化",
    brandSubtitle: "THE SURFACE CORRUPTION",
    statusText: "地表腐化之地",
    tagline: "裂隙与黑檀石侵入地表。",
    quote: "THE CHASM SPREADS",
    match: hasBiome("TheCorruption"),
  },
  {
    variant: "underground-corruption",
    base: "corruption",
    name: "Terraria · 地下腐化",
    brandSubtitle: "THE UNDERGROUND CORRUPTION",
    statusText: "地下腐化之地",
    tagline: "诅咒焰在黑檀石洞穴中燃烧。",
    quote: "CURSED FIRE BELOW",
    match: hasBiome("UndergroundCorruption"),
    backgroundUrl: `${wikiOrigin}/images/Underground_corruption_background_2.png?882c14`,
    colors: {
      background: "#130b24", panel: "#34205c", panelAlt: "#563783",
      accent: "#b07cff", accentAlt: "#72dc72", secondary: "#d29aff",
      highlight: "#6d4aa0", text: "#f9efff", muted: "#d0bedc",
      line: "rgba(176, 124, 255, .54)",
    },
  },
  {
    variant: "crimson",
    base: "crimson",
    name: "Terraria · 地表猩红",
    brandSubtitle: "THE SURFACE CRIMSON",
    statusText: "地表猩红之地",
    tagline: "猩红草与血肉地形吞没地表。",
    quote: "THE LAND HAS A PULSE",
    match: hasBiome("Crimson"),
  },
  {
    variant: "underground-crimson",
    base: "crimson",
    name: "Terraria · 地下猩红",
    brandSubtitle: "THE UNDERGROUND CRIMSON",
    statusText: "地下猩红之地",
    tagline: "血肉洞穴深处传来沉重搏动。",
    quote: "THE HEART BEATS BELOW",
    match: hasBiome("UndergroundCrimson"),
    backgroundUrl: `${wikiOrigin}/images/Underground_crimson_background_2.png?8432af`,
    colors: {
      background: "#21070b", panel: "#54171e", panelAlt: "#7c2831",
      accent: "#ff6b70", accentAlt: "#d34959", secondary: "#f0a06e",
      highlight: "#8f3541", text: "#fff0e8", muted: "#e1bcb8",
      line: "rgba(255, 107, 112, .55)",
    },
  },
  {
    variant: "glowing-mushroom",
    base: "glowing-mushroom",
    name: "Terraria · 地表夜光蘑菇",
    brandSubtitle: "THE SURFACE MUSHROOM",
    statusText: "地表夜光蘑菇地",
    tagline: "蓝色菌光在开放天空下蔓延。",
    quote: "SPORES UNDER OPEN SKY",
    match: hasBiome("SurfaceMushroom"),
  },
  {
    variant: "underground-glowing-mushroom",
    base: "glowing-mushroom",
    name: "Terraria · 地下夜光蘑菇",
    brandSubtitle: "THE UNDERGROUND MUSHROOM",
    statusText: "地下夜光蘑菇地",
    tagline: "发光菌丝照亮潮湿洞壁。",
    quote: "THE CAVERN GLOWS BLUE",
    match: hasBiome("UndergroundMushroom"),
    backgroundUrl: `${wikiOrigin}/images/Underground_glowing_mushroom_background_2.png?2946cf`,
    colors: {
      background: "#0c0d2b", panel: "#20245a", panelAlt: "#354281",
      accent: "#62e9ff", accentAlt: "#ad68ff", secondary: "#72a8ff",
      highlight: "#5a4fa4", text: "#eff7ff", muted: "#bec9e1",
      line: "rgba(98, 233, 255, .55)",
    },
  },
];

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
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
      .map((cell) => cell[1]);
    if (cells.length < 11) return null;
    return {
      name: decodeHtml(cells[2]),
      image: cells[1].match(/<img[^>]+src="([^"]+)"/)?.[1] || "",
      type: decodeHtml(cells[10]),
    };
  }).filter(Boolean);
}

const cleanName = (name) =>
  name.replace(/ \(Desktop, Console and Mobile versions\)/g, "").trim();
const baseName = (name) => cleanName(name).replace(/\s+\([^)]*\)\s*$/, "").trim();
const cleanZhName = (name) => name
  .replace(/\s*[（(](?:电脑版|主机版|移动版)[^）)]*[）)]/g, "")
  .replace(/\s+/g, " ")
  .trim();
const slug = (value) => value.toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 27) || "creature";

function parseBestiary(wikitext) {
  const records = new Map();
  for (const block of wikitext.split(/\n\|-\s*\n/)) {
    const name = block.match(/\{\{tr\|([^|}\n]+)/)?.[1]?.trim();
    const stars = Number(block.match(/\n\|\s*([1-5])\s*\n\|/)?.[1]);
    if (!name || !stars) continue;
    const tokens = [...block.matchAll(
      /Bestiary_(?:Biomes|Times|Events)\.[A-Za-z0-9]+|BestiaryInfo\.IsRare/g,
    )].map((match) => match[0]);
    const values = records.get(name) || [];
    values.push({ stars, tokens });
    records.set(name, values);
  }
  return records;
}

async function fetchBytes(url) {
  const parsed = new URL(url, wikiOrigin);
  if (parsed.protocol !== "https:" || parsed.hostname !== "terraria.wiki.gg") {
    throw new Error(`Rejected non-Wiki URL: ${parsed.href}`);
  }
  const response = await fetch(parsed, { headers });
  if (!response.ok) throw new Error(`Wiki request failed (${response.status}): ${parsed.href}`);
  return { bytes: Buffer.from(await response.arrayBuffer()), url: parsed.href };
}

async function runConcurrent(tasks, limit = 8) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const index = next++;
      await tasks[index]();
    }
  }));
}

const [npcPayload, zhNpcPayload, bestiaryPayload] = await Promise.all([
  fetch(`${wikiOrigin}/api.php?action=parse&page=List_of_NPCs&prop=text&format=json&formatversion=2`,
    { headers }).then((response) => response.json()),
  fetch(`${wikiOrigin}/zh/api.php?action=parse&page=NPC_%E5%88%97%E8%A1%A8&prop=text&format=json&formatversion=2`,
    { headers }).then((response) => response.json()),
  fetch(`${wikiOrigin}/api.php?action=parse&page=Bestiary%2FList&prop=wikitext&format=json&formatversion=2`,
    { headers }).then((response) => response.json()),
]);
const rows = parseNpcRows(npcPayload?.parse?.text || "");
const zhRows = parseNpcRows(zhNpcPayload?.parse?.text || "");
const bestiary = parseBestiary(bestiaryPayload?.parse?.wikitext || "");
if (rows.length < 500 || zhRows.length < 500 || bestiary.size < 400) {
  throw new Error("Official Wiki NPC/Bestiary data was incomplete");
}
const zhNamesByImage = new Map(zhRows.filter((row) => row.image).map((row) => [
  new URL(row.image, wikiOrigin).pathname,
  cleanZhName(row.name),
]));

const manifestPath = path.join(root, "COMPANION_SOURCES.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const cardManifestPath = path.join(root, "CARD_ICON_SOURCES.json");
const cardManifest = JSON.parse(await fs.readFile(cardManifestPath, "utf8"));
const generatedThemes = {};
const backgroundSources = {};
const downloadTasks = [];

for (const descriptor of variants) {
  const baseRoot = path.join(root, `preset-terraria-${descriptor.base}`);
  const themeRoot = path.join(root, `preset-terraria-${descriptor.variant}`);
  if (descriptor.variant !== descriptor.base) {
    await fs.rm(themeRoot, { recursive: true, force: true });
    await fs.cp(baseRoot, themeRoot, { recursive: true });
  }
  const themePath = path.join(themeRoot, "theme.json");
  const theme = JSON.parse(await fs.readFile(themePath, "utf8"));
  const oldCompanionFiles = Object.entries(theme.assets)
    .filter(([key]) => key.startsWith("companion-"))
    .map(([, file]) => file);
  for (const key of Object.keys(theme.assets)) {
    if (key.startsWith("companion-")) delete theme.assets[key];
  }
  theme.id = `preset-terraria-${descriptor.variant}`;
  theme.variant = descriptor.variant;
  theme.name = descriptor.name;
  theme.brandSubtitle = descriptor.brandSubtitle;
  theme.statusText = descriptor.statusText;
  theme.tagline = descriptor.tagline;
  theme.quote = descriptor.quote;
  if (descriptor.colors) theme.colors = descriptor.colors;

  if (descriptor.backgroundUrl) {
    const result = await fetchBytes(descriptor.backgroundUrl);
    await fs.writeFile(path.join(themeRoot, theme.image), result.bytes);
    backgroundSources[descriptor.variant] = {
      sourceUrl: result.url,
      reusedFrom: null,
    };
  } else {
    backgroundSources[descriptor.variant] = {
      sourceUrl: null,
      reusedFrom: `preset-terraria-${descriptor.base}/${theme.image}`,
    };
  }

  const candidates = rows.filter((row) => {
    if (row.type !== "Enemy" && row.type !== "Critter") return false;
    if (!row.image || row.image.includes("/thumb/") || row.name.includes("(Mimic)")) return false;
    if (excludedEntityNames.some((name) => cleanName(row.name).startsWith(name))) return false;
    if (excludedElongatedCompanionNames.has(cleanName(row.name))) return false;
    if (isSegmentFragmentName(row.name)) return false;
    const records = bestiary.get(baseName(row.name)) || [];
    return records.some(descriptor.match);
  });
  const seenUrls = new Set();
  const usedKeys = new Set();
  const companions = [];
  for (const row of candidates) {
    const sourceUrl = new URL(row.image, wikiOrigin).href;
    const identity = sourceUrl.replace(/\?.*$/, "");
    if (seenUrls.has(identity)) continue;
    seenUrls.add(identity);
    const records = (bestiary.get(baseName(row.name)) || []).filter(descriptor.match);
    const stars = Math.max(...records.map((record) => record.stars));
    const extension = path.extname(new URL(sourceUrl).pathname).toLowerCase();
    if (extension !== ".gif" && extension !== ".png") continue;
    const base = `companion-${slug(cleanName(row.name))}`;
    let key = base;
    let suffix = 2;
    while (usedKeys.has(key) || Object.hasOwn(theme.assets, key)) {
      key = `${base.slice(0, 37 - String(suffix).length)}-${suffix++}`;
    }
    usedKeys.add(key);
    const file = `${key}${extension}`;
    theme.assets[key] = file;
    companions.push({
      key,
      name: cleanName(row.name),
      zhName: zhNamesByImage.get(new URL(sourceUrl).pathname) || cleanName(row.name),
      type: row.type,
      animated: extension === ".gif",
      rarityStars: stars,
      weight: rarityWeights[stars],
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
    throw new Error(`${descriptor.variant} selected ${companions.length} companions`);
  }
  theme.companionPool = companions.map(({ key }) => key);
  theme.companionWeights = Object.fromEntries(
    companions.map(({ key, weight }) => [key, weight]),
  );
  theme.cardIconPool = ["explore", "build", "review", "fix"];
  await fs.writeFile(themePath, `${JSON.stringify(theme, null, 2)}\n`, "utf8");
  for (const file of oldCompanionFiles) {
    if (!Object.values(theme.assets).includes(file)) {
      await fs.rm(path.join(themeRoot, file), { force: true });
    }
  }
  generatedThemes[descriptor.variant] = {
    name: theme.name,
    count: companions.length,
    animatedCount: companions.filter(({ animated }) => animated).length,
    companions,
    torchMode: typeof theme.torchKey === "string"
      ? "torch-god-favor" : "none",
  };
  if (!cardManifest.themes?.[descriptor.variant] && cardManifest.themes?.[descriptor.base]) {
    cardManifest.themes[descriptor.variant] = {
      ...cardManifest.themes[descriptor.base],
      name: theme.name,
    };
  }
}
await runConcurrent(downloadTasks);

const rebuiltVariants = new Set(variants.map(({ variant }) => variant));
for (const [variant, sourceTheme] of Object.entries(manifest.themes)) {
  if (rebuiltVariants.has(variant)) continue;
  const themePath = path.join(root, `preset-terraria-${variant}`, "theme.json");
  const theme = JSON.parse(await fs.readFile(themePath, "utf8"));
  const companions = sourceTheme.companions.filter(
    ({ name }) => !excludedElongatedCompanionNames.has(cleanName(name)),
  );
  sourceTheme.companions = companions;
  sourceTheme.count = companions.length;
  sourceTheme.animatedCount = companions.filter(({ animated }) => animated).length;
  const retainedKeys = new Set(companions.map(({ key }) => key));
  theme.companionPool = theme.companionPool.filter((key) => retainedKeys.has(key));
  for (const key of Object.keys(theme.assets)) {
    if (key.startsWith("companion-") && !retainedKeys.has(key)) delete theme.assets[key];
  }
  for (const companion of companions) {
    const records = bestiary.get(baseName(companion.name)) || [];
    const stars = records.length > 0
      ? Math.max(...records.map((record) => record.stars)) : 1;
    companion.rarityStars = stars;
    companion.weight = rarityWeights[stars];
  }
  theme.companionWeights = Object.fromEntries(
    companions.map(({ key, weight }) => [key, weight]),
  );
  await fs.writeFile(themePath, `${JSON.stringify(theme, null, 2)}\n`, "utf8");
  generatedThemes[variant] = sourceTheme;
}

manifest.schemaVersion = 2;
manifest.generatedAt = new Date().toISOString();
manifest.bestiarySource = `${wikiOrigin}/wiki/Bestiary/List`;
manifest.selection = "Enemies and critters matched by exact Bestiary biome/layer/time filters; weather and event filters excluded from normal biomes; isolated multipart Head/Body/Tail sprites and extreme elongated composite creatures excluded.";
manifest.rarityWeights = rarityWeights;
manifest.themes = generatedThemes;
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await fs.writeFile(cardManifestPath, `${JSON.stringify(cardManifest, null, 2)}\n`, "utf8");
await fs.writeFile(
  path.join(root, "SPAWN_ENVIRONMENT_SOURCES.json"),
  `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    bestiarySource: `${wikiOrigin}/wiki/Bestiary/List`,
    rarityWeights,
    backgrounds: backgroundSources,
  }, null, 2)}\n`,
  "utf8",
);

const orderedThemes = [
  ...variants.map(({ variant }) => generatedThemes[variant]),
  ...Object.entries(generatedThemes)
    .filter(([variant]) => !variants.some((entry) => entry.variant === variant))
    .map(([, theme]) => theme),
];
const total = orderedThemes.reduce((sum, theme) => sum + theme.count, 0);
const animated = orderedThemes.reduce((sum, theme) => sum + theme.animatedCount, 0);
const critters = orderedThemes.reduce((sum, theme) =>
  sum + theme.companions.filter(({ type }) => type === "Critter").length, 0);
const companionDocument = [
  "# Terraria 环境与事件伙伴表",
  "",
  `当前 ${orderedThemes.length} 套环境共有 **${total} 个伙伴候选**：${animated} 个官方 GIF 动图、${critters} 个动物或其他小动物候选。`,
  "",
  "伙伴按官方怪物图鉴的环境、地层和昼夜条件筛选；天气与事件怪不会混入普通环境，多节怪的独立头部、身体和尾部图片，以及无法在伙伴安全区内完整辨认的极端细长复合怪物，都不会进入伙伴池。进入环境时随机显示 1 个伙伴，之后每 12 秒更换且不连续重复。",
  "",
  "全环境随机会完整继承对应环境的伙伴池、稀有度权重、背景、配色、火把和固定建议卡，并继续支持用户排除不喜欢的环境。",
  "",
  "稀有度使用图鉴星级做相对权重：`1★=100`、`2★=55`、`3★=25`、`4★=10`、`5★=3`。这不是游戏刷怪率模拟，而是让稀有伙伴明显少见。",
  "",
  "| 环境 | 候选数 | GIF | 小动物 |",
  "| --- | ---: | ---: | ---: |",
  ...orderedThemes.map((theme) => {
    const smallAnimals = theme.companions.filter(({ type }) => type === "Critter").length;
    return `| ${theme.name.replace("Terraria · ", "")} | ${theme.count} | ${theme.animatedCount} | ${smallAnimals} |`;
  }),
  "",
];
for (const theme of orderedThemes) {
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
  `这张表由 \`COMPANION_SOURCES.json\` 自动生成，列出当前 ${orderedThemes.length} 套皮肤的 **${total} 个伙伴候选**。`,
  "",
  "图鉴星级会降低稀有伙伴的抽取概率；同一时间只显示一只，12 秒轮换且不连续重复。",
  "",
  "| 环境 | 敌怪伙伴 | 动物／小动物伙伴 | 总数（GIF） |",
  "| --- | --- | --- | ---: |",
  ...orderedThemes.map((theme) => {
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
console.log(
  `Rebuilt ${variants.length} spawn-specific environments and weighted `
  + `${total} companion slots across ${orderedThemes.length} themes.`,
);
