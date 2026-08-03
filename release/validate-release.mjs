import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const versionPattern = /^\d+\.\d+\.\d+(?:\.\d+)?$/;

async function readText(relativePath) {
  return (await fs.readFile(path.join(root, relativePath), "utf8")).trim();
}

const windowsVersion = await readText("windows/TRSkin/core/VERSION");
const macosVersion = await readText("macos/VERSION");
const macosPackage = JSON.parse(await readText("macos/package.json"));
const config = JSON.parse(await readText("release/release-config.json"));

for (const [label, value] of [
  ["Windows VERSION", windowsVersion],
  ["macOS VERSION", macosVersion],
  ["macOS package.json version", macosPackage.version],
]) {
  if (!versionPattern.test(value)) throw new Error(`${label} is invalid: ${value}`);
}

if (windowsVersion !== macosVersion || windowsVersion !== macosPackage.version) {
  throw new Error(
    `Release versions must match (Windows=${windowsVersion}, macOS=${macosVersion}, package.json=${macosPackage.version})`,
  );
}
if (config.schemaVersion !== 1 || config.repository !== "pttydou/TRSkin") {
  throw new Error("release-config.json has an unsupported identity");
}
if (!/^[a-f0-9]{64}$/.test(config.music.sha256)) {
  throw new Error("The pinned Music Pack SHA-256 is invalid");
}

const tagIndex = process.argv.indexOf("--tag");
if (tagIndex >= 0) {
  const tag = process.argv[tagIndex + 1] ?? "";
  if (tag !== `v${windowsVersion}`) {
    throw new Error(`Tag ${tag || "(missing)"} must exactly match v${windowsVersion}`);
  }
}

console.log(`PASS: release identity v${windowsVersion} is consistent.`);
