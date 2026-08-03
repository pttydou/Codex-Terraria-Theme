import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const randomRoot = path.join(root, "preset-terraria-random");
const randomThemePath = path.join(randomRoot, "theme.json");
const variants = [
  ["forest-day", "fo"],
  ["forest-night", "fn"],
  ["underground", "ug"],
  ["cavern", "cv"],
  ["space", "sp"],
  ["underworld", "uw"],
  ["crimson", "cr"],
  ["underground-crimson", "uc"],
  ["hallow", "ha"],
  ["hallow-night", "hn"],
  ["underground-hallow", "uh"],
  ["corruption", "co"],
  ["underground-corruption", "uo"],
  ["jungle", "ju"],
  ["jungle-night", "jn"],
  ["underground-jungle", "uj"],
  ["tundra", "tu"],
  ["tundra-night", "tn"],
  ["ice-biome", "ib"],
  ["desert", "de"],
  ["underground-desert", "ud"],
  ["ocean", "oc"],
  ["glowing-mushroom", "gm"],
  ["underground-glowing-mushroom", "um"],
  ["dungeon", "du"],
  ["jungle-temple", "jt"],
  ["blood-moon", "bm"],
  ["solar-eclipse", "se"],
  ["goblin-invasion", "gi"],
  ["pirate-invasion", "pi"],
  ["martian-invasion", "mi"],
  ["aether", "ae"],
  ["graveyard", "gy"],
  ["pumpkin-moon", "pm"],
  ["frost-moon", "fm"],
  ["lunar-solar", "ls"],
  ["lunar-vortex", "lv"],
  ["lunar-nebula", "ln"],
  ["lunar-stardust", "ld"],
  ["meteorite", "mt"],
  ["spider-nest", "sn"],
  ["bee-hive", "bh"],
  ["granite-cave", "gc"],
  ["marble-cave", "mc"],
];
const commonKeys = ["logo", "health", "mana"];
const usedKeys = new Set(commonKeys);
const generatedFiles = new Set();
const sourceBackupFiles = new Set();
const contentKeys = new Map();

function allocateKey(prefix, sourceKey) {
  const identity = sourceKey.replace(/^companion-/, "");
  const base = `${prefix}-${identity}`.slice(0, 40);
  let key = base;
  let suffix = 2;
  while (usedKeys.has(key)) {
    const marker = `-${suffix}`;
    key = `${base.slice(0, 40 - marker.length)}${marker}`;
    suffix += 1;
  }
  usedKeys.add(key);
  return key;
}

const sources = new Map();
for (const [variant] of variants) {
  const themeRoot = path.join(root, `preset-terraria-${variant}`);
  const theme = JSON.parse(await fs.readFile(path.join(themeRoot, "theme.json"), "utf8"));
  sources.set(variant, { themeRoot, theme });
}

const forest = sources.get("forest-day");
const randomTheme = JSON.parse(await fs.readFile(randomThemePath, "utf8"));
randomTheme.assets = {};
randomTheme.environmentPool = [];

async function copyAsset(sourceRoot, sourceTheme, sourceKey, targetKey) {
  const sourceName = sourceTheme.assets[sourceKey];
  if (!sourceName) throw new Error(`${sourceTheme.id} is missing asset ${sourceKey}`);
  const sourcePath = path.join(sourceRoot, sourceName);
  const digest = createHash("sha256").update(await fs.readFile(sourcePath)).digest("hex");
  if (contentKeys.has(digest)) return contentKeys.get(digest);
  const extension = path.extname(sourceName).toLowerCase();
  const targetName = `${targetKey}${extension}`;
  await fs.copyFile(sourcePath, path.join(randomRoot, targetName));
  if (extension === ".apng") {
    const sourceBackupPath = path.join(
      sourceRoot,
      `${path.basename(sourceName, extension)}.gif`,
    );
    try {
      const backupName = `${targetKey}.gif`;
      await fs.copyFile(sourceBackupPath, path.join(randomRoot, backupName));
      sourceBackupFiles.add(backupName);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  randomTheme.assets[targetKey] = targetName;
  generatedFiles.add(targetName);
  contentKeys.set(digest, targetKey);
  return targetKey;
}

for (const key of commonKeys) {
  await copyAsset(forest.themeRoot, forest.theme, key, key);
}

for (const [variant, prefix] of variants) {
  const { themeRoot, theme } = sources.get(variant);
  const remapped = new Map();

  const backgroundKey = allocateKey(prefix, "art");
  const backgroundExtension = path.extname(theme.image).toLowerCase();
  const backgroundPath = path.join(themeRoot, theme.image);
  const backgroundDigest = createHash("sha256")
    .update(await fs.readFile(backgroundPath)).digest("hex");
  let mappedBackgroundKey = contentKeys.get(backgroundDigest);
  if (!mappedBackgroundKey) {
    const backgroundName = `${backgroundKey}${backgroundExtension}`;
    await fs.copyFile(backgroundPath, path.join(randomRoot, backgroundName));
    randomTheme.assets[backgroundKey] = backgroundName;
    generatedFiles.add(backgroundName);
    contentKeys.set(backgroundDigest, backgroundKey);
    mappedBackgroundKey = backgroundKey;
  }

  const mapAsset = async (sourceKey, role = sourceKey) => {
    if (commonKeys.includes(sourceKey)) return sourceKey;
    if (remapped.has(sourceKey)) return remapped.get(sourceKey);
    const targetKey = allocateKey(prefix, role);
    const resolvedKey = await copyAsset(themeRoot, theme, sourceKey, targetKey);
    remapped.set(sourceKey, resolvedKey);
    return resolvedKey;
  };

  const torchKey = theme.torchKey ? await mapAsset(theme.torchKey, "torch") : undefined;
  const torchPool = [];
  for (const key of theme.torchPool || []) {
    torchPool.push(await mapAsset(key, key));
  }
  const mappedCompanions = [];
  for (const key of theme.companionPool) {
    mappedCompanions.push(await mapAsset(key, key));
  }
  const companionPool = [...new Set(mappedCompanions)];
  const companionWeights = {};
  theme.companionPool.forEach((sourceKey, index) => {
    const targetKey = mappedCompanions[index];
    const weight = theme.companionWeights?.[sourceKey] || 100;
    companionWeights[targetKey] = companionWeights[targetKey] === undefined
      ? weight : Math.min(companionWeights[targetKey], weight);
  });
  const cardIconPool = [];
  for (const key of theme.cardIconPool) {
    cardIconPool.push(await mapAsset(key, key));
  }
  const backgroundPool = [];
  for (const key of theme.backgroundPool || []) {
    backgroundPool.push(await mapAsset(key, "background"));
  }
  const mappedBackgroundPool = [...new Set(
    backgroundPool.length > 0 ? backgroundPool : [mappedBackgroundKey],
  )];

  randomTheme.environmentPool.push({
    variant: theme.variant,
    name: theme.name,
    brandSubtitle: theme.brandSubtitle,
    tagline: theme.tagline,
    projectPrefix: theme.projectPrefix,
    projectLabel: theme.projectLabel,
    statusText: theme.statusText,
    quote: theme.quote,
    appearance: theme.appearance,
    art: theme.art,
    backgroundKey: mappedBackgroundPool[0],
    backgroundPool: mappedBackgroundPool,
    ...(torchKey ? { torchKey } : {}),
    ...(torchPool.length > 0 ? { torchPool } : {}),
    companionPool,
    companionWeights,
    cardIconPool,
    musicPool: Array.isArray(theme.musicPool) ? theme.musicPool : [],
    otherworldMusicPool: Array.isArray(theme.otherworldMusicPool)
      ? theme.otherworldMusicPool : [],
    colors: theme.colors,
  });
}

const firstEnvironment = randomTheme.environmentPool[0];
const firstSource = forest.theme;
const firstImage = randomTheme.assets[firstEnvironment.backgroundKey];
randomTheme.image = firstImage;
randomTheme.variant = firstSource.variant;
randomTheme.name = "Terraria · 全环境随机";
randomTheme.brandSubtitle = firstSource.brandSubtitle;
randomTheme.tagline = firstSource.tagline;
randomTheme.projectPrefix = firstSource.projectPrefix;
randomTheme.projectLabel = firstSource.projectLabel;
randomTheme.statusText = firstSource.statusText;
randomTheme.quote = firstSource.quote;
randomTheme.appearance = firstSource.appearance;
randomTheme.art = firstSource.art;
randomTheme.colors = firstSource.colors;
delete randomTheme.torchKey;
delete randomTheme.torchPool;
if (firstEnvironment.torchKey) randomTheme.torchKey = firstEnvironment.torchKey;
else if (firstEnvironment.torchPool?.length > 0) {
  randomTheme.torchPool = firstEnvironment.torchPool;
}
randomTheme.companionPool = firstEnvironment.companionPool;
randomTheme.companionWeights = firstEnvironment.companionWeights;
randomTheme.cardIconPool = firstEnvironment.cardIconPool;
randomTheme.musicPool = firstEnvironment.musicPool;
randomTheme.otherworldMusicPool = firstEnvironment.otherworldMusicPool;

await fs.writeFile(randomThemePath, `${JSON.stringify(randomTheme, null, 2)}\n`, "utf8");

const directoryEntries = await fs.readdir(randomRoot, { withFileTypes: true });
const referencedFiles = new Set([
  "theme.json",
  ...Object.values(randomTheme.assets),
  ...sourceBackupFiles,
]);
for (const entry of directoryEntries) {
  if (!entry.isFile() || referencedFiles.has(entry.name)) continue;
  if (/\.(?:gif|png|jpe?g|webp)$/i.test(entry.name)) {
    await fs.unlink(path.join(randomRoot, entry.name));
  }
}

console.log(
  `Rebuilt ${randomTheme.environmentPool.length}-theme random pool with `
  + `${randomTheme.assets && Object.keys(randomTheme.assets).length} referenced assets.`,
);
