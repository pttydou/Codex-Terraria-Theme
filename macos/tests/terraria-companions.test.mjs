import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const macosRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const presetsRoot = path.join(macosRoot, "local-presets");
const manifest = JSON.parse(fs.readFileSync(
  path.join(presetsRoot, "COMPANION_SOURCES.json"),
  "utf8",
));
const cardManifest = JSON.parse(fs.readFileSync(
  path.join(presetsRoot, "CARD_ICON_SOURCES.json"),
  "utf8",
));
const musicMapping = JSON.parse(fs.readFileSync(
  path.join(presetsRoot, "MUSIC_ENVIRONMENT_SOURCES.json"),
  "utf8",
));
const musicCatalog = JSON.parse(fs.readFileSync(
  path.join(macosRoot, "assets", "terraria-music-catalog.json"),
  "utf8",
));
const variants = [
  "forest-day", "forest-night", "underground", "cavern", "space", "underworld",
  "crimson", "underground-crimson", "hallow", "hallow-night", "underground-hallow",
  "corruption", "underground-corruption", "jungle", "jungle-night", "underground-jungle",
  "tundra", "tundra-night", "ice-biome", "desert", "underground-desert", "ocean",
  "glowing-mushroom", "underground-glowing-mushroom",
  "dungeon", "jungle-temple",
  "blood-moon", "solar-eclipse", "goblin-invasion",
  "pirate-invasion", "martian-invasion",
  "aether", "graveyard",
  "pumpkin-moon", "frost-moon",
  "lunar-solar",
  "lunar-vortex", "lunar-nebula", "lunar-stardust", "meteorite",
  "spider-nest", "bee-hive", "granite-cave", "marble-cave",
];
const favorTorchKeys = new Map([
  ["aether", "torch-aether"], ["dungeon", "torch-bone"],
  ["jungle-temple", "torch-jungle"], ["underworld", "torch-demon"],
  ["glowing-mushroom", "torch-mushroom"],
  ["underground-glowing-mushroom", "torch-mushroom"],
  ["hallow", "torch-hallowed"], ["hallow-night", "torch-hallowed"],
  ["underground-hallow", "torch-hallowed"],
  ["corruption", "torch-corrupt"], ["underground-corruption", "torch-corrupt"],
  ["crimson", "torch-crimson"], ["underground-crimson", "torch-crimson"],
  ["tundra", "torch-ice"], ["tundra-night", "torch-ice"],
  ["ice-biome", "torch-ice"],
  ["jungle", "torch-jungle"], ["jungle-night", "torch-jungle"],
  ["underground-jungle", "torch-jungle"],
  ["underground-desert", "torch-desert"],
]);
const itemLikeNames = new Set([
  "Blazing Wheel", "Crimson Axe", "Cursed Hammer", "Dutchman Cannon",
  "Enchanted Sword", "Mysterious Tablet", "Prime Saw", "Prime Vice", "Tesla Turret",
]);
const excludedElongatedCompanionNames = new Set([
  "Blood Eel", "Bone Serpent", "Crawltipede", "Milkyway Weaver", "Wyvern",
]);
const isSegmentFragmentName = (name) => {
  const match = name.match(/^(.+?) \((.+?) (Head|Body|Tail)\)$/i);
  return Boolean(match && match[1].toLowerCase() === match[2].toLowerCase());
};

assert.deepEqual(new Set(Object.keys(manifest.themes)), new Set(variants));
assert.deepEqual(new Set(Object.keys(cardManifest.themes)), new Set(variants));
assert.deepEqual(new Set(Object.keys(musicMapping.environments)), new Set(variants));
assert.deepEqual(new Set(Object.keys(musicMapping.otherworldEnvironments)), new Set(variants));
assert.equal(musicMapping.source, "https://terraria.wiki.gg/wiki/Music");
assert.equal(
  musicMapping.otherworldSource,
  "https://terraria.wiki.gg/wiki/Otherworldly_Tracks",
);
const musicSlotIds = new Set(musicCatalog.slots.map(({ id }) => id));
assert.deepEqual(manifest.gemTorches, []);

let totalCompanions = 0;
let totalAnimated = 0;
let totalCritters = 0;
const fixedThemes = new Map();

for (const variant of variants) {
  const dir = path.join(presetsRoot, `preset-terraria-${variant}`);
  const theme = JSON.parse(fs.readFileSync(path.join(dir, "theme.json"), "utf8"));
  const record = manifest.themes[variant];
  fixedThemes.set(variant, { dir, theme });

  assert.equal(theme.id, `preset-terraria-${variant}`);
  assert.equal(record.count, record.companions.length);
  assert.equal(record.animatedCount, record.companions.filter(({ animated }) => animated).length);
  assert(record.count >= 1 && record.count <= 64);
  assert.deepEqual(theme.companionPool, record.companions.map(({ key }) => key));
  assert.deepEqual(Object.keys(theme.companionWeights), theme.companionPool);
  assert.equal(new Set(theme.companionPool).size, theme.companionPool.length);
  assert.deepEqual(theme.cardIconPool, ["explore", "build", "review", "fix"]);
  assert.deepEqual(theme.musicPool, musicMapping.environments[variant]);
  assert(theme.musicPool.every((slotId) => musicSlotIds.has(slotId)));
  assert.deepEqual(
    theme.otherworldMusicPool,
    musicMapping.otherworldEnvironments[variant],
  );
  assert(theme.otherworldMusicPool.every((slotId) => musicSlotIds.has(slotId)));

  const cardRecord = cardManifest.themes[variant];
  assert.equal(cardRecord.icons.length, 4);
  assert.deepEqual(cardRecord.icons.map(({ role }) => role), theme.cardIconPool);
  for (const icon of cardRecord.icons) {
    const iconPath = path.join(dir, icon.file);
    assert.equal(theme.assets[icon.role], icon.file);
    assert(icon.sourceUrl.startsWith("https://terraria.wiki.gg/images/"));
    assert.equal(
      crypto.createHash("sha256").update(fs.readFileSync(iconPath)).digest("hex"),
      icon.sha256,
    );
  }

  for (const companion of record.companions) {
    assert(["Enemy", "Critter"].includes(companion.type));
    assert(!itemLikeNames.has(companion.name));
    assert(!excludedElongatedCompanionNames.has(companion.name));
    assert(!isSegmentFragmentName(companion.name));
    assert(companion.sourceUrl.startsWith("https://terraria.wiki.gg/images/"));
    assert.equal(companion.animated, companion.file.endsWith(".apng"));
    assert(Number.isInteger(companion.rarityStars) && companion.rarityStars >= 1
      && companion.rarityStars <= 5);
    assert.equal(theme.companionWeights[companion.key], companion.weight);
    assert.equal(theme.assets[companion.key], companion.file);
    assert(fs.statSync(path.join(dir, companion.file)).size > 20);
  }

  const favorTorchKey = favorTorchKeys.get(variant);
  assert.equal(theme.torchPool, undefined);
  assert.equal(theme.torchKey, favorTorchKey);
  if (favorTorchKey) assert(theme.assets[favorTorchKey]);

  totalCompanions += record.count;
  totalAnimated += record.animatedCount;
  totalCritters += record.companions.filter(({ type }) => type === "Critter").length;
}

assert.equal(totalCompanions, 524);
assert.equal(totalAnimated, 449);
assert.equal(totalCritters, 99);
assert(totalCritters > 0, "Animals and other critters must remain in companion pools.");

const namesFor = (variant) =>
  manifest.themes[variant].companions.map(({ name }) => name);
const baseName = (name) => name.replace(/\s+\([^)]*\)\s*$/, "").trim();
const baseNamesFor = (variant) => namesFor(variant).map(baseName);
const assertExactBaseNames = (variant, expected) => {
  assert.deepEqual(new Set(baseNamesFor(variant)), new Set(expected));
};

for (const name of [
  "Blue Armored Bones", "Rusty Armored Bones", "Hell Armored Bones",
  "Skeleton Commando", "Skeleton Sniper", "Tactical Skeleton",
]) assert(baseNamesFor("dungeon").includes(name));
for (const name of [
  "Clown", "Zombie Merman", "Wandering Eye Fish", "Dreadnautilus",
  "Blood Squid", "Hemogoblin Shark",
]) assert(baseNamesFor("blood-moon").includes(name));
for (const name of ["Reaper", "Mothron"]) {
  assert(baseNamesFor("solar-eclipse").includes(name));
}
assert(baseNamesFor("goblin-invasion").includes("Goblin Warlock"));
for (const name of ["Scarecrow", "Pumpking", "Mourning Wood"]) {
  assert(baseNamesFor("pumpkin-moon").includes(name));
}
for (const name of ["Zombie Elf", "Everscream", "Ice Queen", "Santa-NK1"]) {
  assert(baseNamesFor("frost-moon").includes(name));
}

const randomDir = path.join(presetsRoot, "preset-terraria-random");
const randomTheme = JSON.parse(fs.readFileSync(path.join(randomDir, "theme.json"), "utf8"));
assert.equal(randomTheme.id, "preset-terraria-random");
assert.equal(randomTheme.name, "Terraria · 全环境随机");
assert.equal(randomTheme.environmentIntervalMs, 600000);
assert.equal(randomTheme.environmentPool.length, 44);
assert(Object.keys(randomTheme.assets).length <= 768);
assert.deepEqual(randomTheme.environmentPool.map(({ variant }) => variant), variants);

const referencedAssets = new Set(["logo", "health", "mana"]);
for (const environment of randomTheme.environmentPool) {
  const { dir, theme } = fixedThemes.get(environment.variant);
  assert(environment.companionPool.length <= theme.companionPool.length);
  assert.equal(Object.keys(environment.companionWeights).length, environment.companionPool.length);
  assert.equal(environment.accentKeys, undefined);
  assert.equal(environment.cardIconPool.length, 4);
  assert.deepEqual(environment.musicPool, theme.musicPool);
  assert.deepEqual(environment.otherworldMusicPool, theme.otherworldMusicPool);
  assert(environment.backgroundPool.includes(environment.backgroundKey));
  environment.backgroundPool.forEach((key) => referencedAssets.add(key));
  environment.companionPool.forEach((key) => referencedAssets.add(key));
  environment.cardIconPool.forEach((key) => referencedAssets.add(key));
  const favorTorchKey = favorTorchKeys.get(environment.variant);
  assert.equal(environment.torchPool, undefined);
  if (favorTorchKey) {
    assert.equal(typeof environment.torchKey, "string");
    referencedAssets.add(environment.torchKey);
    const sourceHash = crypto.createHash("sha256")
      .update(fs.readFileSync(path.join(dir, theme.assets[favorTorchKey]))).digest("hex");
    const targetHash = crypto.createHash("sha256")
      .update(fs.readFileSync(path.join(randomDir, randomTheme.assets[environment.torchKey])))
      .digest("hex");
    assert.equal(targetHash, sourceHash);
  } else {
    assert.equal(environment.torchKey, undefined);
  }

  const sourceHashes = new Set(theme.companionPool.map((key) =>
    crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, theme.assets[key]))).digest("hex")));
  for (const key of environment.companionPool) {
    const target = path.join(randomDir, randomTheme.assets[key]);
    const targetHash = crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex");
    assert(sourceHashes.has(targetHash));
  }

  const sourceCardHashes = theme.cardIconPool.map((key) =>
    crypto.createHash("sha256").update(fs.readFileSync(path.join(dir, theme.assets[key]))).digest("hex"));
  const targetCardHashes = environment.cardIconPool.map((key) =>
    crypto.createHash("sha256").update(fs.readFileSync(
      path.join(randomDir, randomTheme.assets[key]),
    )).digest("hex"));
  assert.deepEqual(targetCardHashes, sourceCardHashes);
}

assert.deepEqual(new Set(Object.keys(randomTheme.assets)), referencedAssets);
console.log(
  `Terraria companion presets passed: ${totalCompanions} slots, `
  + `${totalAnimated} animated, ${totalCritters} critters.`,
);
