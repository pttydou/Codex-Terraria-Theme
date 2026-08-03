import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadMusicCatalog, loadMusicConfig } from "./music-config.mjs";
import {
  loadRandomPoolConfig,
  RANDOM_ENVIRONMENT_CATALOG,
} from "./random-pool-config.mjs";

const scriptPath = fileURLToPath(import.meta.url);

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function loadControlState({
  statePath,
  themePath,
  randomConfigPath,
  musicConfigPath,
  musicCatalogPath,
}) {
  const [runtimeState, stagedTheme, randomConfig, musicConfig, musicCatalog] = await Promise.all([
    readJsonIfPresent(statePath),
    readJsonIfPresent(themePath),
    loadRandomPoolConfig(randomConfigPath),
    loadMusicConfig(musicConfigPath),
    loadMusicCatalog(musicCatalogPath),
  ]);
  const activeTheme = runtimeState && stagedTheme
    ? {
      id: typeof stagedTheme.id === "string" ? stagedTheme.id : "",
      name: typeof stagedTheme.name === "string" ? stagedTheme.name : "已应用皮肤",
      variant: stagedTheme.id === "preset-terraria-random"
        ? "random"
        : (typeof stagedTheme.variant === "string" ? stagedTheme.variant : ""),
    }
    : {
      id: "official",
      name: "Codex 官方原版",
      variant: "official",
    };
  const excluded = new Set(randomConfig.excludedVariants);
  return {
    schemaVersion: 1,
    activeTheme,
    environments: RANDOM_ENVIRONMENT_CATALOG.map(([variant, name]) => ({
      variant,
      name,
      includedInRandom: !excluded.has(variant),
    })),
    random: {
      total: RANDOM_ENVIRONMENT_CATALOG.length,
      excluded: randomConfig.excludedVariants,
      enabledCount: RANDOM_ENVIRONMENT_CATALOG.length - randomConfig.excludedVariants.length,
      environmentIntervalMinutes: randomConfig.environmentIntervalMs / 60_000,
      backgroundMode: randomConfig.backgroundMode,
      backgroundIntervalMinutes: randomConfig.backgroundIntervalMs / 60_000,
    },
    music: {
      enabled: musicConfig.enabled,
      volume: musicConfig.volume,
      playbackMode: musicConfig.playbackMode,
      trackGapSeconds: musicConfig.trackGapSeconds,
      fadeInSeconds: musicConfig.fadeInSeconds,
      pauseWhenHidden: musicConfig.pauseWhenHidden,
      environmentChangeMode: musicConfig.environmentChangeMode,
      soundtrackMode: musicConfig.soundtrackMode,
      trackChangeMode: musicConfig.trackChangeMode,
      importedTotal: Object.values(musicConfig.tracks)
        .reduce((total, tracks) => total + tracks.length, 0),
      slots: musicCatalog.slots.map((slot) => ({
        ...slot,
        imported: musicConfig.tracks[slot.id]?.length ?? 0,
      })),
    },
  };
}

async function main(argv) {
  if (argv.length !== 5) {
    throw new Error(
      "Usage: control-state.mjs <state.json> <theme.json> <random-pool.json> <music.json> <music-catalog.json>",
    );
  }
  const [statePath, themePath, randomConfigPath, musicConfigPath, musicCatalogPath] = argv;
  const state = await loadControlState({
    statePath: path.resolve(statePath),
    themePath: path.resolve(themePath),
    randomConfigPath: path.resolve(randomConfigPath),
    musicConfigPath: path.resolve(musicConfigPath),
    musicCatalogPath: path.resolve(musicCatalogPath),
  });
  console.log(JSON.stringify(state));
}

if (path.resolve(process.argv[1] || "") === path.resolve(scriptPath)) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    console.error(`[dream-skin] ${error.message}`);
    process.exitCode = 1;
  }
}
