import fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");
const DEFAULT_CATALOG_PATH = path.join(root, "assets", "terraria-music-catalog.json");
const MAX_AUDIO_BYTES = 64 * 1024 * 1024;
const MAX_TRACKS_PER_SLOT = 16;
const MAX_TRACKS_TOTAL = 256;
const MANAGED_FILE_PATTERN = /^[a-f0-9]{64}\.(?:flac|m4a|mp3|ogg|wav)$/;
const ALLOWED_EXTENSIONS = new Set([".flac", ".m4a", ".mp3", ".ogg", ".wav"]);
const PLAYBACK_MODES = new Set(["sequential", "random"]);
const ENVIRONMENT_CHANGE_MODES = new Set(["immediate", "after-current"]);
const SOUNDTRACK_MODES = new Set(["classic", "otherworld", "mixed"]);
const TRACK_CHANGE_MODES = new Set(["rotate", "fixed"]);

function defaultConfig() {
  return {
    schemaVersion: 1,
    enabled: false,
    volume: 35,
    playbackMode: "sequential",
    trackGapSeconds: 0,
    fadeInSeconds: 0,
    pauseWhenHidden: false,
    environmentChangeMode: "immediate",
    soundtrackMode: "classic",
    trackChangeMode: "fixed",
    tracks: {},
  };
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

export async function loadMusicCatalog(catalogPath = DEFAULT_CATALOG_PATH) {
  const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  assertPlainObject(catalog, "Music catalog");
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.slots)) {
    throw new Error("Unsupported music catalog schema");
  }
  const ids = new Set();
  const slots = catalog.slots.map((slot) => {
    assertPlainObject(slot, "Music slot");
    if (!/^[a-z0-9-]{1,64}$/.test(slot.id) || typeof slot.name !== "string"
      || slot.name.length < 1 || slot.name.length > 80 || ids.has(slot.id)) {
      throw new Error("Music catalog contains an invalid or duplicate slot");
    }
    ids.add(slot.id);
    const soundtrack = slot.soundtrack ?? "classic";
    if (!SOUNDTRACK_MODES.has(soundtrack) || soundtrack === "mixed") {
      throw new Error("Music catalog contains an invalid soundtrack field");
    }
    return { id: slot.id, name: slot.name, soundtrack };
  });
  return { schemaVersion: 1, slots };
}

function normalizeTrack(track) {
  assertPlainObject(track, "Music track");
  if (!MANAGED_FILE_PATTERN.test(track.fileName)) {
    throw new Error("Music track has an invalid managed file name");
  }
  if (typeof track.displayName !== "string" || track.displayName.length < 1
    || track.displayName.length > 160 || /[\u0000-\u001f\u007f]/u.test(track.displayName)) {
    throw new Error("Music track has an invalid display name");
  }
  return { fileName: track.fileName, displayName: track.displayName };
}

export async function loadMusicConfig(configPath, { allowMissing = true } = {}) {
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(configPath, "utf8"));
  } catch (error) {
    if (allowMissing && error?.code === "ENOENT") return defaultConfig();
    throw error;
  }
  assertPlainObject(parsed, "Music configuration");
  if (parsed.schemaVersion !== 1) throw new Error("Unsupported music configuration schema");
  if (typeof parsed.enabled !== "boolean") throw new Error("Music enabled must be a boolean");
  if (!Number.isInteger(parsed.volume) || parsed.volume < 0 || parsed.volume > 100) {
    throw new Error("Music volume must be an integer from 0 to 100");
  }
  if (!PLAYBACK_MODES.has(parsed.playbackMode)) {
    throw new Error("Music playbackMode must be sequential or random");
  }
  const trackGapSeconds = parsed.trackGapSeconds ?? 0;
  if (!Number.isInteger(trackGapSeconds) || trackGapSeconds < 0 || trackGapSeconds > 30) {
    throw new Error("Music trackGapSeconds must be an integer from 0 to 30");
  }
  const fadeInSeconds = parsed.fadeInSeconds ?? 0;
  if (!Number.isFinite(fadeInSeconds) || fadeInSeconds < 0 || fadeInSeconds > 5
    || Math.round(fadeInSeconds * 10) !== fadeInSeconds * 10) {
    throw new Error("Music fadeInSeconds must be from 0 to 5 in 0.1 second steps");
  }
  const pauseWhenHidden = parsed.pauseWhenHidden ?? false;
  if (typeof pauseWhenHidden !== "boolean") {
    throw new Error("Music pauseWhenHidden must be a boolean");
  }
  const environmentChangeMode = parsed.environmentChangeMode ?? "immediate";
  if (!ENVIRONMENT_CHANGE_MODES.has(environmentChangeMode)) {
    throw new Error("Music environmentChangeMode must be immediate or after-current");
  }
  const soundtrackMode = parsed.soundtrackMode ?? "classic";
  if (!SOUNDTRACK_MODES.has(soundtrackMode)) {
    throw new Error("Music soundtrackMode must be classic, otherworld, or mixed");
  }
  const trackChangeMode = parsed.trackChangeMode ?? "rotate";
  if (!TRACK_CHANGE_MODES.has(trackChangeMode)) {
    throw new Error("Music trackChangeMode must be rotate or fixed");
  }
  assertPlainObject(parsed.tracks, "Music tracks");
  const tracks = {};
  let total = 0;
  for (const [slotId, entries] of Object.entries(parsed.tracks)) {
    if (!/^[a-z0-9-]{1,64}$/.test(slotId) || !Array.isArray(entries)
      || entries.length > MAX_TRACKS_PER_SLOT) {
      throw new Error(`Music slot ${slotId} is invalid or too large`);
    }
    tracks[slotId] = entries.map(normalizeTrack);
    total += tracks[slotId].length;
  }
  if (total > MAX_TRACKS_TOTAL) throw new Error("Music configuration contains too many tracks");
  return {
    schemaVersion: 1,
    enabled: parsed.enabled,
    volume: parsed.volume,
    playbackMode: parsed.playbackMode,
    trackGapSeconds,
    fadeInSeconds,
    pauseWhenHidden,
    environmentChangeMode,
    soundtrackMode,
    trackChangeMode,
    tracks,
  };
}

async function writeConfig(configPath, config) {
  const directory = path.dirname(configPath);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.chmod(directory, 0o700).catch(() => {});
  const temporary = path.join(
    directory,
    `.music.json.${process.pid}.${randomBytes(6).toString("hex")}.tmp`,
  );
  try {
    await fs.writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await fs.rename(temporary, configPath);
    await fs.chmod(configPath, 0o600).catch(() => {});
  } finally {
    await fs.unlink(temporary).catch(() => {});
  }
}

function audioSignatureIsValid(extension, header) {
  const ascii = (start, end) => header.subarray(start, end).toString("ascii");
  if (extension === ".wav") return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE";
  if (extension === ".ogg") return ascii(0, 4) === "OggS";
  if (extension === ".flac") return ascii(0, 4) === "fLaC";
  if (extension === ".m4a") return ascii(4, 8) === "ftyp";
  if (extension === ".mp3") {
    return ascii(0, 3) === "ID3" || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0);
  }
  return false;
}

export async function importMusicTrack({
  configPath,
  libraryRoot,
  catalogPath = DEFAULT_CATALOG_PATH,
  slotId,
  sourcePath,
}) {
  const catalog = await loadMusicCatalog(catalogPath);
  if (!catalog.slots.some((slot) => slot.id === slotId)) {
    throw new Error(`Unknown music slot: ${slotId}`);
  }
  const extension = path.extname(sourcePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Supported music formats are MP3, M4A, WAV, OGG, and FLAC");
  }
  const sourceStat = await fs.lstat(sourcePath);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink() || sourceStat.size < 12
    || sourceStat.size > MAX_AUDIO_BYTES) {
    throw new Error("Music file must be a regular non-symlink file from 12 bytes to 64 MB");
  }
  const handle = await fs.open(sourcePath, fsConstants.O_RDONLY);
  let header;
  try {
    header = Buffer.alloc(Math.min(64, sourceStat.size));
    await handle.read(header, 0, header.length, 0);
  } finally {
    await handle.close();
  }
  if (!audioSignatureIsValid(extension, header)) {
    throw new Error("Music file signature does not match its extension");
  }
  const data = await fs.readFile(sourcePath);
  const fileName = `${createHash("sha256").update(data).digest("hex")}${extension}`;
  const displayName = path.basename(sourcePath).normalize("NFC");
  const config = await loadMusicConfig(configPath);
  const current = config.tracks[slotId] ?? [];
  if (!current.some((track) => track.fileName === fileName)) {
    if (current.length >= MAX_TRACKS_PER_SLOT) {
      throw new Error(`Music slot ${slotId} already contains ${MAX_TRACKS_PER_SLOT} tracks`);
    }
    const total = Object.values(config.tracks).reduce((sum, tracks) => sum + tracks.length, 0);
    if (total >= MAX_TRACKS_TOTAL) throw new Error("Music library already contains 256 tracks");
    config.tracks[slotId] = [...current, { fileName, displayName }];
  }
  await fs.mkdir(libraryRoot, { recursive: true, mode: 0o700 });
  await fs.chmod(libraryRoot, 0o700).catch(() => {});
  const destination = path.join(libraryRoot, fileName);
  try {
    await fs.copyFile(sourcePath, destination, fsConstants.COPYFILE_EXCL);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
  await fs.chmod(destination, 0o600).catch(() => {});
  await writeConfig(configPath, config);
  return { slotId, fileName, displayName };
}

export async function loadMusicRuntime(themeDir, catalogPath = DEFAULT_CATALOG_PATH) {
  const stateRoot = path.dirname(path.resolve(themeDir));
  const configPath = path.join(stateRoot, "music.json");
  const libraryRoot = path.join(stateRoot, "music");
  const catalog = await loadMusicCatalog(catalogPath);
  const allowedSlots = new Set(catalog.slots.map((slot) => slot.id));
  const config = await loadMusicConfig(configPath);
  const tracks = [];
  const files = [];
  for (const [slotId, entries] of Object.entries(config.tracks)) {
    if (!allowedSlots.has(slotId)) continue;
    for (const track of entries) {
      const filePath = path.join(libraryRoot, track.fileName);
      try {
        const stat = await fs.lstat(filePath);
        const realLibrary = await fs.realpath(libraryRoot);
        const realFile = await fs.realpath(filePath);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 12
          || stat.size > MAX_AUDIO_BYTES || path.dirname(realFile) !== realLibrary) continue;
        tracks.push({ slotId, fileName: track.fileName, displayName: track.displayName });
        files.push(realFile);
      } catch {}
    }
  }
  return {
    config: {
      enabled: config.enabled,
      volume: config.volume / 100,
      playbackMode: config.playbackMode,
      trackGapMs: config.trackGapSeconds * 1000,
      fadeInMs: config.fadeInSeconds * 1000,
      pauseWhenHidden: config.pauseWhenHidden,
      environmentChangeMode: config.environmentChangeMode,
      soundtrackMode: config.soundtrackMode,
      trackChangeMode: config.trackChangeMode,
      tracks,
    },
    files,
  };
}

async function main(argv) {
  const [command, configPath, ...args] = argv;
  if (!command || !configPath) {
    throw new Error("Usage: music-config.mjs <show|catalog|set-enabled|set-volume|set-mode|set-gap|set-fade|set-hidden|set-environment-mode|set-soundtrack|set-track-change|set-settings|import> <music.json> ...");
  }
  if (command === "show") {
    console.log(JSON.stringify(await loadMusicConfig(configPath), null, 2));
    return;
  }
  if (command === "catalog") {
    const catalogPath = args[0] ? path.resolve(args[0]) : DEFAULT_CATALOG_PATH;
    const catalog = await loadMusicCatalog(catalogPath);
    const config = await loadMusicConfig(configPath);
    console.log(JSON.stringify({
      ...catalog,
      slots: catalog.slots.map((slot) => ({
        ...slot,
        imported: config.tracks[slot.id]?.length ?? 0,
      })),
    }, null, 2));
    return;
  }
  if (command === "import") {
    const [libraryRoot, catalogPath, slotId, sourcePath] = args;
    if (!libraryRoot || !catalogPath || !slotId || !sourcePath) {
      throw new Error("import requires <library-root> <catalog.json> <slot-id> <audio-file>");
    }
    console.log(JSON.stringify(await importMusicTrack({
      configPath,
      libraryRoot: path.resolve(libraryRoot),
      catalogPath: path.resolve(catalogPath),
      slotId,
      sourcePath: path.resolve(sourcePath),
    }), null, 2));
    return;
  }
  const config = await loadMusicConfig(configPath);
  if (command === "set-settings") {
    const [
      enabled,
      volumeValue,
      playbackMode,
      gapValue,
      fadeValue,
      hidden,
      environmentMode,
      soundtrackMode,
      trackChangeMode,
    ] = args;
    const volume = Number(volumeValue);
    const gap = Number(gapValue);
    const fade = Number(fadeValue);
    if (!["on", "off"].includes(enabled)) {
      throw new Error("set-settings enabled value must be on or off");
    }
    if (!Number.isInteger(volume) || volume < 0 || volume > 100) {
      throw new Error("set-settings volume must be an integer from 0 to 100");
    }
    if (!PLAYBACK_MODES.has(playbackMode)) {
      throw new Error("set-settings playback mode must be sequential or random");
    }
    if (!Number.isInteger(gap) || gap < 0 || gap > 30) {
      throw new Error("set-settings gap must be an integer from 0 to 30 seconds");
    }
    if (!Number.isFinite(fade) || fade < 0 || fade > 5
      || Math.round(fade * 10) !== fade * 10) {
      throw new Error("set-settings fade must be from 0 to 5 seconds in 0.1 second steps");
    }
    if (!["on", "off"].includes(hidden)) {
      throw new Error("set-settings hidden value must be on or off");
    }
    if (!ENVIRONMENT_CHANGE_MODES.has(environmentMode)) {
      throw new Error("set-settings environment mode must be immediate or after-current");
    }
    if (!SOUNDTRACK_MODES.has(soundtrackMode)) {
      throw new Error("set-settings soundtrack mode must be classic, otherworld, or mixed");
    }
    if (!TRACK_CHANGE_MODES.has(trackChangeMode)) {
      throw new Error("set-settings track change mode must be rotate or fixed");
    }
    config.enabled = enabled === "on";
    config.volume = volume;
    config.playbackMode = playbackMode;
    config.trackGapSeconds = gap;
    config.fadeInSeconds = fade;
    config.pauseWhenHidden = hidden === "on";
    config.environmentChangeMode = environmentMode;
    config.soundtrackMode = soundtrackMode;
    config.trackChangeMode = trackChangeMode;
  } else if (command === "set-enabled") {
    if (!["on", "off"].includes(args[0])) throw new Error("set-enabled requires on or off");
    config.enabled = args[0] === "on";
  } else if (command === "set-volume") {
    const volume = Number(args[0]);
    if (!Number.isInteger(volume) || volume < 0 || volume > 100) {
      throw new Error("set-volume requires an integer from 0 to 100");
    }
    config.volume = volume;
  } else if (command === "set-mode") {
    if (!PLAYBACK_MODES.has(args[0])) {
      throw new Error("set-mode requires sequential or random");
    }
    config.playbackMode = args[0];
  } else if (command === "set-gap") {
    const seconds = Number(args[0]);
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 30) {
      throw new Error("set-gap requires an integer from 0 to 30 seconds");
    }
    config.trackGapSeconds = seconds;
  } else if (command === "set-fade") {
    const seconds = Number(args[0]);
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 5
      || Math.round(seconds * 10) !== seconds * 10) {
      throw new Error("set-fade requires 0 to 5 seconds in 0.1 second steps");
    }
    config.fadeInSeconds = seconds;
  } else if (command === "set-hidden") {
    if (!["on", "off"].includes(args[0])) throw new Error("set-hidden requires on or off");
    config.pauseWhenHidden = args[0] === "on";
  } else if (command === "set-environment-mode") {
    if (!ENVIRONMENT_CHANGE_MODES.has(args[0])) {
      throw new Error("set-environment-mode requires immediate or after-current");
    }
    config.environmentChangeMode = args[0];
  } else if (command === "set-soundtrack") {
    if (!SOUNDTRACK_MODES.has(args[0])) {
      throw new Error("set-soundtrack requires classic, otherworld, or mixed");
    }
    config.soundtrackMode = args[0];
  } else if (command === "set-track-change") {
    if (!TRACK_CHANGE_MODES.has(args[0])) {
      throw new Error("set-track-change requires rotate or fixed");
    }
    config.trackChangeMode = args[0];
  } else {
    throw new Error(`Unknown music command: ${command}`);
  }
  await writeConfig(configPath, config);
  console.log(JSON.stringify(config, null, 2));
}

if (path.resolve(process.argv[1] || "") === path.resolve(scriptPath)) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    console.error(`[dream-skin] ${error.message}`);
    process.exitCode = 1;
  }
}
