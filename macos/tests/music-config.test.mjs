import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  importMusicTrack,
  loadMusicCatalog,
  loadMusicConfig,
  loadMusicRuntime,
} from "../scripts/music-config.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const musicScriptPath = path.resolve(here, "../scripts/music-config.mjs");
const catalogPath = path.resolve(here, "../assets/terraria-music-catalog.json");
const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "dream-music-test-"));
const stateRoot = path.join(temporaryRoot, "state");
const themeDir = path.join(stateRoot, "theme");
const libraryRoot = path.join(stateRoot, "music");
const configPath = path.join(stateRoot, "music.json");
const sourcePath = path.join(temporaryRoot, "森林音乐.wav");

try {
  const wav = Buffer.alloc(48);
  wav.write("RIFF", 0, "ascii");
  wav.writeUInt32LE(40, 4);
  wav.write("WAVEfmt ", 8, "ascii");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36, "ascii");
  wav.writeUInt32LE(4, 40);
  await fs.writeFile(sourcePath, wav);
  await fs.mkdir(themeDir, { recursive: true });

  const catalog = await loadMusicCatalog(catalogPath);
  assert.ok(catalog.slots.some((slot) => slot.id === "overworld-day"));

  const imported = await importMusicTrack({
    configPath,
    libraryRoot,
    catalogPath,
    slotId: "overworld-day",
    sourcePath,
  });
  assert.equal(imported.displayName, "森林音乐.wav");
  assert.match(imported.fileName, /^[a-f0-9]{64}\.wav$/);

  await importMusicTrack({
    configPath,
    libraryRoot,
    catalogPath,
    slotId: "overworld-day",
    sourcePath,
  });
  const deduplicated = await loadMusicConfig(configPath);
  assert.equal(deduplicated.tracks["overworld-day"].length, 1);
  assert.equal(deduplicated.enabled, false);
  assert.equal(deduplicated.playbackMode, "sequential");
  assert.equal(deduplicated.trackGapSeconds, 0);
  assert.equal(deduplicated.fadeInSeconds, 0);
  assert.equal(deduplicated.pauseWhenHidden, false);
  assert.equal(deduplicated.environmentChangeMode, "immediate");
  assert.equal(deduplicated.soundtrackMode, "classic");
  assert.equal(deduplicated.trackChangeMode, "fixed");

  const updated = {
    ...deduplicated,
    enabled: true,
    volume: 42,
    playbackMode: "random",
    trackGapSeconds: 3,
    fadeInSeconds: 1.5,
    pauseWhenHidden: false,
    environmentChangeMode: "after-current",
    soundtrackMode: "otherworld",
    trackChangeMode: "fixed",
  };
  await fs.writeFile(configPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  const runtime = await loadMusicRuntime(themeDir, catalogPath);
  assert.deepEqual(runtime.config, {
    enabled: true,
    volume: 0.42,
    playbackMode: "random",
    trackGapMs: 3000,
    fadeInMs: 1500,
    pauseWhenHidden: false,
    environmentChangeMode: "after-current",
    soundtrackMode: "otherworld",
    trackChangeMode: "fixed",
    tracks: [{
      slotId: "overworld-day",
      fileName: imported.fileName,
      displayName: "森林音乐.wav",
    }],
  });
  assert.equal(runtime.files.length, 1);
  assert.equal(path.dirname(runtime.files[0]), await fs.realpath(libraryRoot));

  const runSettingCommand = (command, value) => {
    const result = spawnSync(process.execPath, [musicScriptPath, command, configPath, value], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
  };
  runSettingCommand("set-gap", "7");
  runSettingCommand("set-fade", "2.5");
  runSettingCommand("set-hidden", "on");
  runSettingCommand("set-environment-mode", "immediate");
  runSettingCommand("set-soundtrack", "mixed");
  runSettingCommand("set-track-change", "rotate");
  const setSettings = spawnSync(process.execPath, [
    musicScriptPath,
    "set-settings",
    configPath,
    "off",
    "58",
    "sequential",
    "9",
    "2.0",
    "off",
    "after-current",
    "otherworld",
    "fixed",
  ], { encoding: "utf8" });
  assert.equal(setSettings.status, 0, setSettings.stderr);
  const cliUpdated = await loadMusicConfig(configPath);
  assert.equal(cliUpdated.enabled, false);
  assert.equal(cliUpdated.volume, 58);
  assert.equal(cliUpdated.playbackMode, "sequential");
  assert.equal(cliUpdated.trackGapSeconds, 9);
  assert.equal(cliUpdated.fadeInSeconds, 2);
  assert.equal(cliUpdated.pauseWhenHidden, false);
  assert.equal(cliUpdated.environmentChangeMode, "after-current");
  assert.equal(cliUpdated.soundtrackMode, "otherworld");
  assert.equal(cliUpdated.trackChangeMode, "fixed");

  const invalidSettings = spawnSync(process.execPath, [
    musicScriptPath,
    "set-settings",
    configPath,
    "on",
    "101",
    "sequential",
    "0",
    "0",
    "on",
    "immediate",
    "classic",
    "rotate",
  ], { encoding: "utf8" });
  assert.notEqual(invalidSettings.status, 0);
  assert.match(invalidSettings.stderr, /volume/);

  const legacyConfigPath = path.join(stateRoot, "legacy-music.json");
  await fs.writeFile(legacyConfigPath, `${JSON.stringify({
    schemaVersion: 1,
    enabled: true,
    volume: 20,
    playbackMode: "sequential",
    tracks: {},
  })}\n`);
  const migratedLegacy = await loadMusicConfig(legacyConfigPath);
  assert.deepEqual(migratedLegacy, {
    schemaVersion: 1,
    enabled: true,
    volume: 20,
    playbackMode: "sequential",
    trackGapSeconds: 0,
    fadeInSeconds: 0,
    pauseWhenHidden: false,
    environmentChangeMode: "immediate",
    soundtrackMode: "classic",
    trackChangeMode: "rotate",
    tracks: {},
  });

  const invalidConfigPath = path.join(stateRoot, "invalid-music.json");
  await fs.writeFile(invalidConfigPath, `${JSON.stringify({
    ...migratedLegacy,
    fadeInSeconds: 5.5,
  })}\n`);
  await assert.rejects(loadMusicConfig(invalidConfigPath), /fadeInSeconds/);

  const fakeMp3 = path.join(temporaryRoot, "伪装.mp3");
  await fs.writeFile(fakeMp3, Buffer.from("not really an mp3 file"));
  await assert.rejects(
    importMusicTrack({
      configPath,
      libraryRoot,
      catalogPath,
      slotId: "overworld-day",
      sourcePath: fakeMp3,
    }),
    /signature/,
  );
  await assert.rejects(
    importMusicTrack({
      configPath,
      libraryRoot,
      catalogPath,
      slotId: "not-a-slot",
      sourcePath,
    }),
    /Unknown music slot/,
  );
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}

console.log("music configuration tests passed");
