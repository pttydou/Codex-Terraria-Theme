import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(root, "COMPANION_SOURCES.json");
const cardManifestPath = path.join(root, "CARD_ICON_SOURCES.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const cardManifest = JSON.parse(await fs.readFile(cardManifestPath, "utf8"));

const groups = [
  {
    base: "dungeon",
    removed: ["dungeon-brick", "dungeon-slab", "dungeon-tile"],
    name: "Terraria · 地牢",
    brandSubtitle: "THE DUNGEON",
    statusText: "地牢",
    tagline: "骷髅与地牢军团在砖墙深处巡逻。",
    quote: "THE CURSE HAS LIFTED",
  },
  {
    base: "blood-moon",
    removed: [
      "blood-moon-hardmode",
      "blood-moon-fishing",
      "blood-moon-fishing-hardmode",
    ],
    name: "Terraria · 血月",
    brandSubtitle: "BLOOD MOON",
    statusText: "血月",
    tagline: "血色月光唤醒地表与水下的全部来客。",
    quote: "THE BLOOD MOON IS RISING",
  },
  {
    base: "solar-eclipse",
    removed: ["solar-eclipse-mechanical", "solar-eclipse-plantera"],
    name: "Terraria · 日食",
    brandSubtitle: "SOLAR ECLIPSE",
    statusText: "日食",
    tagline: "被遮蔽的白昼迎来全部恐怖片怪物。",
    quote: "THE HORRORS HAVE ARRIVED",
  },
  {
    base: "goblin-invasion",
    removed: ["goblin-invasion-hardmode"],
    name: "Terraria · 哥布林入侵",
    brandSubtitle: "GOBLIN ARMY",
    statusText: "哥布林入侵",
    tagline: "完整哥布林军团正在向世界中心推进。",
    quote: "A GOBLIN ARMY APPROACHES",
  },
  {
    base: "pumpkin-moon",
    removed: ["pumpkin-moon-opening", "pumpkin-moon-mid", "pumpkin-moon-final"],
    name: "Terraria · 南瓜月",
    brandSubtitle: "PUMPKIN MOON",
    statusText: "南瓜月",
    tagline: "整场南瓜月的怪物在收获之夜轮番登场。",
    quote: "THE HARVEST HAS BEGUN",
  },
  {
    base: "frost-moon",
    removed: ["frost-moon-opening", "frost-moon-mid", "frost-moon-final"],
    name: "Terraria · 霜月",
    brandSubtitle: "FROST MOON",
    statusText: "霜月",
    tagline: "整场霜月的冬季军团在长夜中轮番登场。",
    quote: "THE FROST MOON RISES",
  },
];

for (const group of groups) {
  const variants = [group.base, ...group.removed];
  const baseRoot = path.join(root, `preset-terraria-${group.base}`);
  const themePath = path.join(baseRoot, "theme.json");
  const theme = JSON.parse(await fs.readFile(themePath, "utf8"));
  const companions = new Map();
  const sourceFiles = new Map();

  for (const variant of variants) {
    const record = manifest.themes[variant];
    if (!record) continue;
    const variantRoot = path.join(root, `preset-terraria-${variant}`);
    for (const companion of record.companions) {
      if (!companions.has(companion.key)) {
        companions.set(companion.key, structuredClone(companion));
      }
      if (sourceFiles.has(companion.key)) continue;
      const candidate = path.join(variantRoot, companion.file);
      try {
        await fs.access(candidate);
        sourceFiles.set(companion.key, candidate);
      } catch {}
    }
  }

  if (companions.size < 1 || companions.size > 64) {
    throw new Error(`${group.base} selected ${companions.size} companions`);
  }

  const merged = [...companions.values()];
  for (const companion of merged) {
    const sourceFile = sourceFiles.get(companion.key);
    if (!sourceFile) {
      throw new Error(`Missing source file for ${group.base}/${companion.key}`);
    }
    const targetFile = path.join(baseRoot, companion.file);
    if (path.resolve(sourceFile) !== path.resolve(targetFile)) {
      await fs.copyFile(sourceFile, targetFile);
    }
    theme.assets[companion.key] = companion.file;
  }

  theme.id = `preset-terraria-${group.base}`;
  theme.variant = group.base;
  theme.name = group.name;
  theme.brandSubtitle = group.brandSubtitle;
  theme.statusText = group.statusText;
  theme.tagline = group.tagline;
  theme.quote = group.quote;
  theme.companionPool = merged.map(({ key }) => key);
  theme.companionWeights = Object.fromEntries(
    merged.map(({ key, weight }) => [key, weight || 100]),
  );
  await fs.writeFile(themePath, `${JSON.stringify(theme, null, 2)}\n`, "utf8");

  manifest.themes[group.base] = {
    ...manifest.themes[group.base],
    name: group.name,
    count: merged.length,
    animatedCount: merged.filter(({ animated }) => animated).length,
    companions: merged,
  };
  cardManifest.themes[group.base].name = group.name;

  for (const variant of group.removed) {
    delete manifest.themes[variant];
    delete cardManifest.themes[variant];
    await fs.rm(path.join(root, `preset-terraria-${variant}`), {
      recursive: true,
      force: true,
    });
  }
}

manifest.generatedAt = new Date().toISOString();
manifest.selection = "Enemies and critters matched by official Bestiary biome, layer, time, and event filters; progression, unlock state, event waves, and weather are not separate themes.";
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await fs.writeFile(cardManifestPath, `${JSON.stringify(cardManifest, null, 2)}\n`, "utf8");
await fs.rm(path.join(root, "PROGRESSION_ENVIRONMENT_SOURCES.json"), { force: true });

const themeCount = Object.keys(manifest.themes).length;
if (themeCount !== 44) {
  throw new Error(`Expected 44 collapsed themes, found ${themeCount}`);
}
console.log(`Collapsed progression and wave variants into ${themeCount} fixed themes.`);
