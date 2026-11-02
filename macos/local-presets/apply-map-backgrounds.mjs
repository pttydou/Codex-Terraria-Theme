// Offline source of truth for environments that used placed-wall previews.
// Run before rebuilding the random pack so shared wallpaper keys are split
// by the new image content, while companions/music retain their own mappings.
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await fs.readFile(
  path.join(root, "MAP_BACKGROUND_SOURCES.json"), "utf8",
));
const images = [];
for (const entry of manifest.environments) {
  const source = path.join(root, entry.file);
  const bytes = await fs.readFile(source);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== entry.sha256) throw new Error(`Map background changed: ${entry.variant}`);
  const directory = path.join(root, `preset-terraria-${entry.variant}`);
  const theme = JSON.parse(await fs.readFile(path.join(directory, "theme.json"), "utf8"));
  if (theme.image !== "background.png" || theme.backgroundPool?.length) {
    throw new Error(`Review background mapping before replacing ${entry.variant}`);
  }
  images.push({ source, target: path.join(directory, theme.image) });
}
// Validate all mappings before replacing any image.
for (const { source, target } of images) await fs.copyFile(source, target);
console.log(`Applied ${images.length} verified map backgrounds to fixed presets.`);
