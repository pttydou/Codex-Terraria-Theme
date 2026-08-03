import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);

export const RANDOM_ENVIRONMENT_CATALOG = [
  ["forest-day", "Terraria · 森林 · 白昼"],
  ["forest-night", "Terraria · 森林 · 夜晚"],
  ["underground", "Terraria · 地下层"],
  ["cavern", "Terraria · 洞穴层"],
  ["space", "Terraria · 太空"],
  ["underworld", "Terraria · 地狱"],
  ["crimson", "Terraria · 地表猩红"],
  ["underground-crimson", "Terraria · 地下猩红"],
  ["hallow", "Terraria · 神圣之地 · 白昼"],
  ["hallow-night", "Terraria · 神圣之地 · 夜晚"],
  ["underground-hallow", "Terraria · 地下神圣"],
  ["corruption", "Terraria · 地表腐化"],
  ["underground-corruption", "Terraria · 地下腐化"],
  ["jungle", "Terraria · 丛林 · 白昼"],
  ["jungle-night", "Terraria · 丛林 · 夜晚"],
  ["underground-jungle", "Terraria · 地下丛林"],
  ["tundra", "Terraria · 苔原 · 白昼"],
  ["tundra-night", "Terraria · 苔原 · 夜晚"],
  ["ice-biome", "Terraria · 地下冰雪"],
  ["desert", "Terraria · 地表沙漠"],
  ["underground-desert", "Terraria · 地下沙漠"],
  ["ocean", "Terraria · 海洋"],
  ["glowing-mushroom", "Terraria · 地表夜光蘑菇"],
  ["underground-glowing-mushroom", "Terraria · 地下夜光蘑菇"],
  ["dungeon", "Terraria · 地牢"],
  ["jungle-temple", "Terraria · 丛林神庙"],
  ["blood-moon", "Terraria · 血月"],
  ["solar-eclipse", "Terraria · 日食"],
  ["goblin-invasion", "Terraria · 哥布林入侵"],
  ["pirate-invasion", "Terraria · 海盗入侵"],
  ["martian-invasion", "Terraria · 火星人入侵"],
  ["aether", "Terraria · 以太"],
  ["graveyard", "Terraria · 墓地"],
  ["pumpkin-moon", "Terraria · 南瓜月"],
  ["frost-moon", "Terraria · 霜月"],
  ["lunar-solar", "Terraria · 日耀柱"],
  ["lunar-vortex", "Terraria · 星旋柱"],
  ["lunar-nebula", "Terraria · 星云柱"],
  ["lunar-stardust", "Terraria · 星尘柱"],
  ["meteorite", "Terraria · 陨石"],
  ["spider-nest", "Terraria · 蜘蛛洞"],
  ["bee-hive", "Terraria · 蜂巢"],
  ["granite-cave", "Terraria · 花岗岩洞"],
  ["marble-cave", "Terraria · 大理石洞"],
];
const ALLOWED = new Set(RANDOM_ENVIRONMENT_CATALOG.map(([variant]) => variant));
export const DEFAULT_RANDOM_ENVIRONMENT_INTERVAL_MS = 600_000;
export const MIN_RANDOM_ENVIRONMENT_INTERVAL_MS = 60_000;
export const MAX_RANDOM_ENVIRONMENT_INTERVAL_MS = 3_600_000;
export const DEFAULT_BACKGROUND_MODE = "fixed";
export const DEFAULT_BACKGROUND_INTERVAL_MS = 900_000;
const BACKGROUND_MODES = new Set(["fixed", "rotate"]);
const RETIRED_VARIANTS = new Set([
  "dungeon-post-plantera-brick",
  "dungeon-post-plantera-slab",
  "dungeon-post-plantera-tile",
  "blood-moon-hardmode",
  "blood-moon-fishing-pre-hardmode",
  "blood-moon-fishing-hardmode",
  "solar-eclipse-mechanical",
  "solar-eclipse-plantera",
  "goblin-invasion-hardmode",
  "pumpkin-moon-wave-1",
  "pumpkin-moon-wave-10",
  "pumpkin-moon-wave-20",
  "frost-moon-wave-1",
  "frost-moon-wave-10",
  "frost-moon-wave-20",
]);

function normalizeExcluded(values, { allowRetired = false } = {}) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) {
    throw new Error("Random pool exclusions must be an array of theme identifiers");
  }
  const excluded = [...new Set(values)];
  const unknown = excluded.filter(
    (variant) => !ALLOWED.has(variant) && !(allowRetired && RETIRED_VARIANTS.has(variant)),
  );
  if (unknown.length > 0) {
    throw new Error(`Unknown random pool theme: ${unknown.join(", ")}`);
  }
  const activeExcluded = excluded.filter((variant) => ALLOWED.has(variant));
  if (RANDOM_ENVIRONMENT_CATALOG.length - activeExcluded.length < 2) {
    throw new Error("Random rotation must keep at least two themes enabled");
  }
  return RANDOM_ENVIRONMENT_CATALOG
    .map(([variant]) => variant)
    .filter((variant) => activeExcluded.includes(variant));
}

function normalizeEnvironmentIntervalMs(value) {
  const normalized = value === undefined
    ? DEFAULT_RANDOM_ENVIRONMENT_INTERVAL_MS
    : Number(value);
  if (
    !Number.isInteger(normalized)
    || normalized < MIN_RANDOM_ENVIRONMENT_INTERVAL_MS
    || normalized > MAX_RANDOM_ENVIRONMENT_INTERVAL_MS
  ) {
    throw new Error("Random environment interval must be an integer between 60000 and 3600000 ms");
  }
  return normalized;
}

function normalizeBackgroundMode(value) {
  const normalized = value ?? DEFAULT_BACKGROUND_MODE;
  if (!BACKGROUND_MODES.has(normalized)) {
    throw new Error("Background mode must be fixed or rotate");
  }
  return normalized;
}

function normalizeBackgroundIntervalMs(value) {
  const normalized = value === undefined ? DEFAULT_BACKGROUND_INTERVAL_MS : Number(value);
  if (
    !Number.isInteger(normalized)
    || normalized < MIN_RANDOM_ENVIRONMENT_INTERVAL_MS
    || normalized > MAX_RANDOM_ENVIRONMENT_INTERVAL_MS
  ) {
    throw new Error("Background interval must be an integer between 60000 and 3600000 ms");
  }
  return normalized;
}

export async function loadRandomPoolConfig(configPath) {
  try {
    const raw = JSON.parse(await fs.readFile(configPath, "utf8"));
    if (!raw || raw.schemaVersion !== 1) throw new Error("unsupported schema");
    return {
      excludedVariants: normalizeExcluded(raw.excludedVariants, { allowRetired: true }),
      environmentIntervalMs: normalizeEnvironmentIntervalMs(raw.environmentIntervalMs),
      backgroundMode: normalizeBackgroundMode(raw.backgroundMode),
      backgroundIntervalMs: normalizeBackgroundIntervalMs(raw.backgroundIntervalMs),
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        excludedVariants: [],
        environmentIntervalMs: DEFAULT_RANDOM_ENVIRONMENT_INTERVAL_MS,
        backgroundMode: DEFAULT_BACKGROUND_MODE,
        backgroundIntervalMs: DEFAULT_BACKGROUND_INTERVAL_MS,
      };
    }
    throw new Error(`Invalid random pool config: ${error.message}`);
  }
}

export async function saveRandomPoolConfig(
  configPath,
  { excludedVariants, environmentIntervalMs, backgroundMode, backgroundIntervalMs },
) {
  const excluded = normalizeExcluded(excludedVariants);
  const interval = normalizeEnvironmentIntervalMs(environmentIntervalMs);
  const normalizedBackgroundMode = normalizeBackgroundMode(backgroundMode);
  const normalizedBackgroundInterval = normalizeBackgroundIntervalMs(backgroundIntervalMs);
  const parent = path.dirname(configPath);
  await fs.mkdir(parent, { recursive: true, mode: 0o700 });
  const temporary = path.join(
    parent,
    `.${path.basename(configPath)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`,
  );
  const payload = `${JSON.stringify({
    schemaVersion: 1,
    excludedVariants: excluded,
    environmentIntervalMs: interval,
    backgroundMode: normalizedBackgroundMode,
    backgroundIntervalMs: normalizedBackgroundInterval,
    updatedAt: new Date().toISOString(),
  }, null, 2)}\n`;
  await fs.writeFile(temporary, payload, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await fs.rename(temporary, configPath);
  await fs.chmod(configPath, 0o600);
  return {
    excludedVariants: excluded,
    environmentIntervalMs: interval,
    backgroundMode: normalizedBackgroundMode,
    backgroundIntervalMs: normalizedBackgroundInterval,
  };
}

async function applyConfig(configPath, themePath) {
  const config = await loadRandomPoolConfig(configPath);
  const theme = JSON.parse(await fs.readFile(themePath, "utf8"));
  theme.backgroundMode = config.backgroundMode;
  theme.backgroundIntervalMs = config.backgroundIntervalMs;
  if (theme.id === "preset-terraria-random" && Array.isArray(theme.environmentPool)) {
    const available = new Set(theme.environmentPool.map((environment) => environment.variant));
    const unavailable = [...ALLOWED].filter((variant) => !available.has(variant));
    if (unavailable.length > 0) {
      throw new Error(`Random theme is missing configured variants: ${unavailable.join(", ")}`);
    }
    const excluded = new Set(config.excludedVariants);
    theme.enabledEnvironmentVariants = theme.environmentPool
      .map((environment) => environment.variant)
      .filter((variant) => !excluded.has(variant));
    if (theme.enabledEnvironmentVariants.length < 2) {
      throw new Error("Random rotation must keep at least two themes enabled");
    }
    theme.environmentIntervalMs = config.environmentIntervalMs;
  }
  const temporary = `${themePath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(theme, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await fs.rename(temporary, themePath);
  console.log(JSON.stringify({
    total: RANDOM_ENVIRONMENT_CATALOG.length,
    enabled: Array.isArray(theme.enabledEnvironmentVariants)
      ? theme.enabledEnvironmentVariants
      : [theme.variant].filter((variant) => typeof variant === "string"),
    excluded: config.excludedVariants,
    environmentIntervalMs: config.environmentIntervalMs,
    backgroundMode: config.backgroundMode,
    backgroundIntervalMs: config.backgroundIntervalMs,
  }));
}

function parseSetArguments(args) {
  const excludedVariants = [];
  let environmentIntervalMs;
  let backgroundMode;
  let backgroundIntervalMs;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--interval-ms") {
      if (environmentIntervalMs !== undefined || index + 1 >= args.length) {
        throw new Error("--interval-ms requires exactly one value");
      }
      environmentIntervalMs = args[index + 1];
      index += 1;
    } else if (value === "--background-mode") {
      if (backgroundMode !== undefined || index + 1 >= args.length) {
        throw new Error("--background-mode requires exactly one value");
      }
      backgroundMode = args[index + 1];
      index += 1;
    } else if (value === "--background-interval-ms") {
      if (backgroundIntervalMs !== undefined || index + 1 >= args.length) {
        throw new Error("--background-interval-ms requires exactly one value");
      }
      backgroundIntervalMs = args[index + 1];
      index += 1;
    } else {
      excludedVariants.push(value);
    }
  }
  return { excludedVariants, environmentIntervalMs, backgroundMode, backgroundIntervalMs };
}

async function main(argv) {
  const [command, configPath, ...args] = argv;
  if (!command || !configPath) {
    throw new Error("Usage: random-pool-config.mjs <show|set|apply|catalog> <config-path> [args]");
  }

  if (command === "catalog") {
    console.log(JSON.stringify(
      RANDOM_ENVIRONMENT_CATALOG.map(([variant, name]) => ({ variant, name })),
    ));
  } else if (command === "show") {
    const config = await loadRandomPoolConfig(configPath);
    console.log(JSON.stringify({
      total: RANDOM_ENVIRONMENT_CATALOG.length,
      excluded: config.excludedVariants,
      enabled: RANDOM_ENVIRONMENT_CATALOG.map(([variant]) => variant).filter(
        (variant) => !config.excludedVariants.includes(variant),
      ),
      environmentIntervalMs: config.environmentIntervalMs,
      backgroundMode: config.backgroundMode,
      backgroundIntervalMs: config.backgroundIntervalMs,
    }));
  } else if (command === "set") {
    const parsed = parseSetArguments(args);
    const existing = await loadRandomPoolConfig(configPath);
    const saved = await saveRandomPoolConfig(configPath, {
      excludedVariants: parsed.excludedVariants,
      environmentIntervalMs: parsed.environmentIntervalMs ?? existing.environmentIntervalMs,
      backgroundMode: parsed.backgroundMode ?? existing.backgroundMode,
      backgroundIntervalMs: parsed.backgroundIntervalMs ?? existing.backgroundIntervalMs,
    });
    console.log(JSON.stringify({
      total: RANDOM_ENVIRONMENT_CATALOG.length,
      excluded: saved.excludedVariants,
      environmentIntervalMs: saved.environmentIntervalMs,
      backgroundMode: saved.backgroundMode,
      backgroundIntervalMs: saved.backgroundIntervalMs,
    }));
  } else if (command === "apply") {
    if (args.length !== 1) throw new Error("apply requires a staged theme.json path");
    await applyConfig(configPath, path.resolve(args[0]));
  } else {
    throw new Error(`Unknown random pool config command: ${command}`);
  }
}

if (path.resolve(process.argv[1] || "") === path.resolve(scriptPath)) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    console.error(`[dream-skin] ${error.message}`);
    process.exitCode = 1;
  }
}
