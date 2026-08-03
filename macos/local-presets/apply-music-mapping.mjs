import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mapping = JSON.parse(
  await fs.readFile(path.join(root, "MUSIC_ENVIRONMENT_SOURCES.json"), "utf8"),
);

for (const [variant, musicPool] of Object.entries(mapping.environments)) {
  const themePath = path.join(root, `preset-terraria-${variant}`, "theme.json");
  const theme = JSON.parse(await fs.readFile(themePath, "utf8"));
  if (theme.variant !== variant) {
    throw new Error(`${themePath} declares ${theme.variant}; expected ${variant}`);
  }
  theme.musicPool = musicPool;
  const otherworldMusicPool = mapping.otherworldEnvironments?.[variant];
  if (!Array.isArray(otherworldMusicPool) || otherworldMusicPool.length < 1) {
    throw new Error(`${themePath} is missing an Otherworld music pool`);
  }
  theme.otherworldMusicPool = otherworldMusicPool;
  await fs.writeFile(themePath, `${JSON.stringify(theme, null, 2)}\n`, "utf8");
}

console.log(`Applied music pools to ${Object.keys(mapping.environments).length} environments.`);
