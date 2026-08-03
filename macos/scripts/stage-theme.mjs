import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";

const [sourceDirArg, stageDirArg] = process.argv.slice(2);
if (!sourceDirArg || !stageDirArg) {
  throw new Error("Usage: stage-theme.mjs <source-theme-dir> <stage-dir>");
}

const MAX_CONFIG_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const MAX_DECORATION_BYTES = 2 * 1024 * 1024;
const MAX_STATIC_DECORATION_COUNT = 96;
const MAX_DECORATION_COUNT = 768;
const MAX_TOTAL_DECORATION_BYTES = 32 * 1024 * 1024;
const MAX_COMPANION_COUNT = 64;
const OPEN_FLAGS = fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u;

function assertContained(rootPath, candidatePath, label) {
  const relative = path.relative(rootPath, candidatePath);
  if (
    relative === ""
    || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`))
  ) return;
  throw new Error(`${label} must stay inside its theme directory`);
}

function sameStat(left, right) {
  return left.isFile() && right.isFile()
    && left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs;
}

async function readStableFile(filePath, label, maxBytes) {
  let handle;
  try {
    handle = await fs.open(filePath, OPEN_FLAGS);
  } catch (error) {
    if (error.code === "ELOOP") throw new Error(`${label} must not be a symbolic link`);
    throw error;
  }
  try {
    const before = await handle.stat();
    if (!before.isFile()) throw new Error(`${label} must be a regular file`);
    if (before.size > maxBytes) throw new Error(`${label} is larger than ${maxBytes} bytes`);
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (!sameStat(before, after)) {
      throw new Error(`${label} changed while it was being staged`);
    }
    if (bytes.length > maxBytes) throw new Error(`${label} is larger than ${maxBytes} bytes`);
    return { bytes, stat: after };
  } finally {
    await handle.close();
  }
}

function decodeJson(bytes, label) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (text.includes("\0")) throw new Error(`${label} contains NUL characters`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

async function writeExclusive(filePath, bytes) {
  const temporary = `${filePath}.${process.pid}.tmp`;
  try {
    await fs.writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
    await fs.rename(temporary, filePath);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}

async function main() {
  const sourceRoot = await fs.realpath(sourceDirArg);
  const sourceStat = await fs.stat(sourceRoot);
  if (!sourceStat.isDirectory()) throw new Error("Theme source must be a directory");

  const configPath = path.join(sourceRoot, "theme.json");
  const config = await readStableFile(configPath, "Theme config", MAX_CONFIG_BYTES);
  const theme = decodeJson(config.bytes, "Theme config");
  if (theme?.schemaVersion !== 1 || typeof theme.image !== "string" || !theme.image) {
    throw new Error("Theme config has an unsupported schema or image field");
  }
  if (path.basename(theme.image) !== theme.image) {
    throw new Error("Theme image must stay inside its theme directory");
  }
  if (theme.image === "theme.json") {
    throw new Error("Theme image must not replace theme.json");
  }
  if (CONTROL_CHARACTERS.test(theme.image)) {
    throw new Error("Theme image contains control characters");
  }

  const rawAssets = theme.assets === undefined ? {} : theme.assets;
  if (!rawAssets || typeof rawAssets !== "object" || Array.isArray(rawAssets)) {
    throw new Error("Theme assets must be an object");
  }
  const assetEntries = Object.entries(rawAssets);
  const maxAssetCount = Array.isArray(theme.environmentPool) && theme.environmentPool.length > 0
    ? MAX_DECORATION_COUNT : MAX_STATIC_DECORATION_COUNT;
  if (assetEntries.length > maxAssetCount) {
    throw new Error(`Theme assets may contain at most ${maxAssetCount} entries`);
  }
  for (const [key, fileName] of assetEntries) {
    if (!/^[a-z][a-z0-9-]{0,39}$/.test(key)) {
      throw new Error(`Theme asset key is invalid: ${key}`);
    }
    if (
      typeof fileName !== "string" || !fileName || path.basename(fileName) !== fileName
      || fileName === "theme.json" || CONTROL_CHARACTERS.test(fileName)
    ) {
      throw new Error(`Theme asset must stay inside its theme directory: ${key}`);
    }
  }
  const rawBackgroundPool = theme.backgroundPool === undefined ? [] : theme.backgroundPool;
  if (
    !Array.isArray(rawBackgroundPool)
    || rawBackgroundPool.length > 16
    || rawBackgroundPool.some((key) =>
      typeof key !== "string" || !Object.hasOwn(rawAssets, key))
    || new Set(rawBackgroundPool).size !== rawBackgroundPool.length
  ) {
    throw new Error("Theme backgroundPool must contain at most 16 unique local assets");
  }
  const rawCardIconPool = theme.cardIconPool === undefined ? [] : theme.cardIconPool;
  if (
    !Array.isArray(rawCardIconPool)
    || (rawCardIconPool.length > 0 && rawCardIconPool.length < 4)
    || rawCardIconPool.length > MAX_DECORATION_COUNT
    || rawCardIconPool.some((key) => typeof key !== "string" || !Object.hasOwn(rawAssets, key))
    || new Set(rawCardIconPool).size !== rawCardIconPool.length
  ) {
    throw new Error("Theme cardIconPool must contain 4 to 16 unique asset keys");
  }
  const rawTorchKey = theme.torchKey === undefined ? "" : theme.torchKey;
  if (
    typeof rawTorchKey !== "string"
    || (rawTorchKey && !Object.hasOwn(rawAssets, rawTorchKey))
  ) {
    throw new Error("Theme torchKey must reference one local asset key");
  }
  const rawTorchPool = theme.torchPool === undefined ? [] : theme.torchPool;
  if (
    !Array.isArray(rawTorchPool)
    || rawTorchPool.length > 7
    || rawTorchPool.some((key) => typeof key !== "string" || !Object.hasOwn(rawAssets, key))
    || new Set(rawTorchPool).size !== rawTorchPool.length
  ) {
    throw new Error("Theme torchPool must contain up to 7 unique local asset keys");
  }
  const rawCompanionPool = theme.companionPool === undefined ? [] : theme.companionPool;
  if (
    !Array.isArray(rawCompanionPool)
    || (rawCompanionPool.length > 0 && rawCompanionPool.length < 1)
    || rawCompanionPool.length > MAX_COMPANION_COUNT
    || rawCompanionPool.some((key) => typeof key !== "string" || !Object.hasOwn(rawAssets, key))
    || new Set(rawCompanionPool).size !== rawCompanionPool.length
  ) {
    throw new Error(`Theme companionPool must contain 1 to ${MAX_COMPANION_COUNT} unique asset keys`);
  }
  const validateCompanionWeights = (value, pool, label) => {
    if (value === undefined) return;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Theme ${label} must be an object`);
    }
    const allowed = new Set(pool);
    if (Object.entries(value).some(([key, weight]) =>
      !allowed.has(key) || !Number.isInteger(weight) || weight < 1 || weight > 1000)) {
      throw new Error(`Theme ${label} must map companion keys to integer weights from 1 to 1000`);
    }
  };
  validateCompanionWeights(theme.companionWeights, rawCompanionPool, "companionWeights");
  const validateMusicPool = (value, label) => {
    if (value === undefined) return;
    if (
      !Array.isArray(value)
      || value.length < 1
      || value.length > 16
      || value.some((slotId) =>
        typeof slotId !== "string" || !/^[a-z0-9-]{1,64}$/.test(slotId))
      || new Set(value).size !== value.length
    ) {
      throw new Error(`Theme ${label} must contain 1 to 16 unique music slot ids`);
    }
  };
  validateMusicPool(theme.musicPool, "musicPool");
  validateMusicPool(theme.otherworldMusicPool, "otherworldMusicPool");
  const rawEnvironmentPool = theme.environmentPool === undefined ? [] : theme.environmentPool;
  if (
    !Array.isArray(rawEnvironmentPool)
    || (rawEnvironmentPool.length > 0 && rawEnvironmentPool.length < 2)
    || rawEnvironmentPool.length > 64
  ) {
    throw new Error("Theme environmentPool must contain 2 to 64 environments");
  }
  const environmentVariants = new Set();
  for (const environment of rawEnvironmentPool) {
    if (!environment || typeof environment !== "object" || Array.isArray(environment)) {
      throw new Error("Theme environmentPool entries must be objects");
    }
    if (
      typeof environment.variant !== "string"
      || !/^[a-z][a-z0-9-]{0,39}$/.test(environment.variant)
      || environmentVariants.has(environment.variant)
    ) {
      throw new Error("Theme environmentPool variants must be unique safe identifiers");
    }
    environmentVariants.add(environment.variant);
    if (
      typeof environment.backgroundKey !== "string"
      || !Object.hasOwn(rawAssets, environment.backgroundKey)
    ) {
      throw new Error("Theme environmentPool backgrounds must reference local assets");
    }
    const environmentBackgroundPool = environment.backgroundPool === undefined
      ? [environment.backgroundKey] : environment.backgroundPool;
    if (
      !Array.isArray(environmentBackgroundPool)
      || environmentBackgroundPool.length < 1
      || environmentBackgroundPool.length > 16
      || environmentBackgroundPool.some((key) =>
        typeof key !== "string" || !Object.hasOwn(rawAssets, key))
      || new Set(environmentBackgroundPool).size !== environmentBackgroundPool.length
      || !environmentBackgroundPool.includes(environment.backgroundKey)
    ) {
      throw new Error("Theme environment backgroundPool must contain its primary background");
    }
    const environmentTorchKey = environment.torchKey === undefined ? "" : environment.torchKey;
    const environmentTorchPool = environment.torchPool === undefined ? [] : environment.torchPool;
    if (
      typeof environmentTorchKey !== "string"
      || (environmentTorchKey && !Object.hasOwn(rawAssets, environmentTorchKey))
      || !Array.isArray(environmentTorchPool)
      || environmentTorchPool.length > 7
      || environmentTorchPool.some((key) =>
        typeof key !== "string" || !Object.hasOwn(rawAssets, key))
      || new Set(environmentTorchPool).size !== environmentTorchPool.length
    ) {
      throw new Error("Theme environmentPool torches must reference local assets");
    }
    if (
      !Array.isArray(environment.companionPool)
      || environment.companionPool.length < 1
      || environment.companionPool.length > MAX_COMPANION_COUNT
      || new Set(environment.companionPool).size !== environment.companionPool.length
      || environment.companionPool.some((key) =>
        typeof key !== "string" || !Object.hasOwn(rawAssets, key))
    ) {
      throw new Error(`Theme environmentPool companion pools must contain 1 to ${MAX_COMPANION_COUNT} local assets`);
    }
    validateCompanionWeights(
      environment.companionWeights,
      environment.companionPool,
      "environment companionWeights",
    );
    if (
      environment.accentKeys !== undefined
      && (!Array.isArray(environment.accentKeys)
        || environment.accentKeys.length !== 3
        || new Set(environment.accentKeys).size !== environment.accentKeys.length
        || environment.accentKeys.some((key) =>
          typeof key !== "string" || !Object.hasOwn(rawAssets, key)))
    ) {
      throw new Error("Theme environmentPool accentKeys must contain exactly 3 local assets");
    }
    if (
      !Array.isArray(environment.cardIconPool)
      || environment.cardIconPool.length < 4
      || environment.cardIconPool.length > 16
      || new Set(environment.cardIconPool).size !== environment.cardIconPool.length
      || environment.cardIconPool.some((key) =>
        typeof key !== "string" || !Object.hasOwn(rawAssets, key))
    ) {
      throw new Error("Theme environmentPool card icon pools must contain 4 to 16 local assets");
    }
    validateMusicPool(environment.musicPool, "environment musicPool");
    validateMusicPool(
      environment.otherworldMusicPool,
      "environment otherworldMusicPool",
    );
  }
  if (rawEnvironmentPool.length > 0 && (
    !Number.isInteger(theme.environmentIntervalMs)
    || theme.environmentIntervalMs < 60000
    || theme.environmentIntervalMs > 3600000
  )) {
    throw new Error("Theme environmentIntervalMs must be between 60000 and 3600000");
  }

  const imagePath = path.resolve(sourceRoot, theme.image);
  assertContained(sourceRoot, imagePath, "Theme image");
  const image = await readStableFile(imagePath, "Theme image", MAX_IMAGE_BYTES);
  if (image.bytes.length < 1) throw new Error("Theme image is empty");

  const assets = [];
  let totalDecorationBytes = 0;
  for (const [key, fileName] of assetEntries) {
    const assetPath = path.resolve(sourceRoot, fileName);
    assertContained(sourceRoot, assetPath, `Theme asset ${key}`);
    const asset = await readStableFile(assetPath, `Theme asset ${key}`, MAX_DECORATION_BYTES);
    if (asset.bytes.length < 1) throw new Error(`Theme asset is empty: ${key}`);
    totalDecorationBytes += asset.bytes.length;
    if (totalDecorationBytes > MAX_TOTAL_DECORATION_BYTES) {
      throw new Error(`Theme assets exceed ${MAX_TOTAL_DECORATION_BYTES} bytes in total`);
    }
    assets.push({ fileName, bytes: asset.bytes });
  }

  const stageRoot = await fs.realpath(stageDirArg);
  const stageStat = await fs.stat(stageRoot);
  if (!stageStat.isDirectory()) throw new Error("Theme stage must be a directory");
  assertContained(stageRoot, path.join(stageRoot, "theme.json"), "Staged theme config");
  assertContained(stageRoot, path.join(stageRoot, theme.image), "Staged theme image");
  for (const { fileName } of assets) {
    assertContained(stageRoot, path.join(stageRoot, fileName), "Staged theme asset");
  }

  // Write both files from the already-open, stable descriptors. The caller
  // publishes the image first and theme.json last, so the watcher only ever
  // observes a complete pair; subsequent source edits cannot race the copy.
  await writeExclusive(path.join(stageRoot, theme.image), image.bytes);
  for (const { fileName, bytes } of assets) {
    if (fileName === theme.image) continue;
    await writeExclusive(path.join(stageRoot, fileName), bytes);
  }
  await writeExclusive(path.join(stageRoot, "theme.json"), config.bytes);
  process.stdout.write(theme.image);
}

await main();
