import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadControlState } from "../scripts/control-state.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "dream-control-state-"));
const statePath = path.join(temporaryRoot, "state.json");
const themePath = path.join(temporaryRoot, "theme", "theme.json");
const randomPath = path.join(temporaryRoot, "random-pool.json");
const musicPath = path.join(temporaryRoot, "music.json");
const catalogPath = path.resolve(here, "../assets/terraria-music-catalog.json");

try {
  const official = await loadControlState({
    statePath,
    themePath,
    randomConfigPath: randomPath,
    musicConfigPath: musicPath,
    musicCatalogPath: catalogPath,
  });
  assert.equal(official.activeTheme.variant, "official");
  assert.equal(official.environments.length, 44);
  assert.equal(official.random.enabledCount, 44);
  assert.equal(official.random.environmentIntervalMinutes, 10);
  assert.equal(official.random.backgroundMode, "fixed");
  assert.equal(official.random.backgroundIntervalMinutes, 15);
  assert.equal(official.music.enabled, false);
  assert.equal(official.music.soundtrackMode, "classic");
  assert.equal(official.music.trackChangeMode, "fixed");
  assert.equal(official.music.importedTotal, 0);

  await fs.mkdir(path.dirname(themePath), { recursive: true });
  await fs.writeFile(statePath, "{}\n");
  await fs.writeFile(themePath, `${JSON.stringify({
    id: "preset-terraria-cavern",
    name: "Terraria · 洞穴层",
    variant: "cavern",
  })}\n`);
  await fs.writeFile(randomPath, `${JSON.stringify({
    schemaVersion: 1,
    excludedVariants: ["crimson", "corruption"],
    environmentIntervalMs: 240_000,
    backgroundMode: "rotate",
    backgroundIntervalMs: 420_000,
  })}\n`);
  await fs.writeFile(musicPath, `${JSON.stringify({
    schemaVersion: 1,
    enabled: true,
    volume: 41,
    playbackMode: "random",
    trackGapSeconds: 3,
    fadeInSeconds: 1.5,
    pauseWhenHidden: false,
    environmentChangeMode: "after-current",
    soundtrackMode: "otherworld",
    trackChangeMode: "fixed",
    tracks: {},
  })}\n`);

  const themed = await loadControlState({
    statePath,
    themePath,
    randomConfigPath: randomPath,
    musicConfigPath: musicPath,
    musicCatalogPath: catalogPath,
  });
  assert.equal(themed.activeTheme.variant, "cavern");
  assert.equal(themed.random.enabledCount, 42);
  assert.equal(themed.random.environmentIntervalMinutes, 4);
  assert.equal(themed.random.backgroundMode, "rotate");
  assert.equal(themed.random.backgroundIntervalMinutes, 7);
  assert.equal(
    themed.environments.find((environment) => environment.variant === "crimson")
      .includedInRandom,
    false,
  );
  assert.equal(themed.music.volume, 41);
  assert.equal(themed.music.playbackMode, "random");
  assert.equal(themed.music.soundtrackMode, "otherworld");
  assert.equal(themed.music.trackChangeMode, "fixed");
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}

console.log("control panel state tests passed");
