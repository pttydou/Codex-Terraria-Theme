import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const randomRoot = path.join(root, "preset-terraria-random");
const eventIds = [
  "blood-moon",
  "solar-eclipse",
  "goblin-invasion",
  "pirate-invasion",
  "martian-invasion",
];
const randomThemePath = path.join(randomRoot, "theme.json");
const randomTheme = JSON.parse(await fs.readFile(randomThemePath, "utf8"));

randomTheme.environmentPool = randomTheme.environmentPool.filter(
  (environment) => !eventIds.includes(environment.variant),
);
for (const key of Object.keys(randomTheme.assets)) {
  if (eventIds.some((variant) => key.startsWith(`${variant}-`))) delete randomTheme.assets[key];
}

for (const variant of eventIds) {
  const sourceRoot = path.join(root, `preset-terraria-${variant}`);
  const source = JSON.parse(await fs.readFile(path.join(sourceRoot, "theme.json"), "utf8"));
  const remapped = new Map();

  const addAsset = async (targetKey, sourceKey, targetStem) => {
    const sourceName = source.assets[sourceKey];
    if (!sourceName) throw new Error(`${variant} is missing asset ${sourceKey}`);
    const extension = path.extname(sourceName).toLowerCase();
    const targetName = `${targetStem}${extension}`;
    await fs.copyFile(path.join(sourceRoot, sourceName), path.join(randomRoot, targetName));
    randomTheme.assets[targetKey] = targetName;
    if (!remapped.has(sourceKey)) remapped.set(sourceKey, targetKey);
    return targetKey;
  };

  const backgroundKey = `${variant}-art`;
  const backgroundExtension = path.extname(source.image).toLowerCase();
  const backgroundName = `${variant}-background${backgroundExtension}`;
  await fs.copyFile(path.join(sourceRoot, source.image), path.join(randomRoot, backgroundName));
  randomTheme.assets[backgroundKey] = backgroundName;
  const torchKey = await addAsset(`${variant}-torch`, source.torchKey, `${variant}-torch`);
  const companionPool = [];
  for (const [index, sourceKey] of source.companionPool.entries()) {
    companionPool.push(await addAsset(
      `${variant}-companion-${index + 1}`,
      sourceKey,
      `${variant}-companion-${index + 1}`,
    ));
  }
  const cardIconPool = [];
  for (const [index, sourceKey] of source.cardIconPool.entries()) {
    cardIconPool.push(await addAsset(
      `${variant}-card-${index + 1}`,
      sourceKey,
      `${variant}-card-${index + 1}`,
    ));
  }
  randomTheme.environmentPool.push({
    variant: source.variant,
    name: source.name,
    brandSubtitle: source.brandSubtitle,
    tagline: source.tagline,
    projectPrefix: source.projectPrefix,
    projectLabel: source.projectLabel,
    statusText: source.statusText,
    quote: source.quote,
    appearance: source.appearance,
    art: source.art,
    backgroundKey,
    torchKey,
    companionPool,
    cardIconPool,
    colors: source.colors,
  });
}

await fs.writeFile(randomThemePath, `${JSON.stringify(randomTheme, null, 2)}\n`, "utf8");
console.log(`Rebuilt ${randomTheme.environmentPool.length}-theme random pool.`);
