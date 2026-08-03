#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const presetRoot = path.dirname(fileURLToPath(import.meta.url));
const ffmpeg = process.env.FFMPEG || "ffmpeg";
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const animationChunk = Buffer.from("acTL", "ascii");

const walk = (directory, predicate, results = []) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const itemPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(itemPath, predicate, results);
    else if (predicate(itemPath)) results.push(itemPath);
  }
  return results;
};

const isApng = (bytes) =>
  bytes.subarray(0, pngSignature.length).equals(pngSignature)
  && bytes.includes(animationChunk);

const writeJson = (filePath, value) => {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const ffmpegProbe = spawnSync(ffmpeg, ["-version"], { encoding: "utf8" });
if (ffmpegProbe.status !== 0) {
  throw new Error(
    `ffmpeg is required to normalize Terraria animations (${ffmpegProbe.error?.message || "not found"})`,
  );
}

const gifFiles = walk(presetRoot, (filePath) => filePath.endsWith(".gif"));
const sourceGroups = new Map();
for (const filePath of gifFiles) {
  const bytes = fs.readFileSync(filePath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (!sourceGroups.has(digest)) sourceGroups.set(digest, []);
  sourceGroups.get(digest).push(filePath);
}

let convertedUnique = 0;
let writtenCopies = 0;
let sourceBytes = 0;
let normalizedBytes = 0;
for (const [digest, copies] of sourceGroups) {
  const sourcePath = copies[0];
  const source = fs.readFileSync(sourcePath);
  sourceBytes += source.length;
  const temporaryPath = path.join(
    path.dirname(sourcePath),
    `.dream-skin-${digest.slice(0, 16)}-${process.pid}.apng`,
  );
  const conversion = spawnSync(ffmpeg, [
    "-hide_banner",
    "-loglevel", "error",
    "-i", sourcePath,
    "-plays", "0",
    "-f", "apng",
    temporaryPath,
    "-y",
  ], { encoding: "utf8" });
  if (conversion.status !== 0) {
    throw new Error(
      `Failed to normalize ${sourcePath}: ${conversion.stderr || conversion.error?.message || "ffmpeg failed"}`,
    );
  }
  const normalized = fs.readFileSync(temporaryPath);
  fs.unlinkSync(temporaryPath);
  if (!isApng(normalized)) {
    throw new Error(`Normalized animation is not a valid APNG: ${sourcePath}`);
  }
  convertedUnique += 1;
  normalizedBytes += normalized.length;
  for (const copyPath of copies) {
    fs.writeFileSync(copyPath.slice(0, -4) + ".apng", normalized);
    writtenCopies += 1;
  }
}

let themeReferences = 0;
for (const themePath of walk(presetRoot, (filePath) => path.basename(filePath) === "theme.json")) {
  const theme = JSON.parse(fs.readFileSync(themePath, "utf8"));
  if (typeof theme.image === "string" && theme.image.endsWith(".gif")) {
    theme.image = theme.image.slice(0, -4) + ".apng";
    themeReferences += 1;
  }
  for (const [key, fileName] of Object.entries(theme.assets || {})) {
    if (typeof fileName !== "string" || !fileName.endsWith(".gif")) continue;
    theme.assets[key] = fileName.slice(0, -4) + ".apng";
    themeReferences += 1;
  }
  writeJson(themePath, theme);
}

const companionSourcesPath = path.join(presetRoot, "COMPANION_SOURCES.json");
const companionSources = JSON.parse(fs.readFileSync(companionSourcesPath, "utf8"));
let companionReferences = 0;
for (const theme of Object.values(companionSources.themes || {})) {
  for (const companion of theme.companions || []) {
    if (typeof companion.file !== "string" || !companion.file.endsWith(".gif")) continue;
    companion.file = companion.file.slice(0, -4) + ".apng";
    companionReferences += 1;
  }
}
writeJson(companionSourcesPath, companionSources);

const expandedSourcesPath = path.join(presetRoot, "EXPANDED_ENVIRONMENT_SOURCES.json");
const expandedSources = JSON.parse(fs.readFileSync(expandedSourcesPath, "utf8"));
let expandedReferences = 0;
for (const [variant, theme] of Object.entries(expandedSources.themes || {})) {
  for (const asset of theme.assets || []) {
    if (typeof asset.file !== "string" || !asset.file.endsWith(".gif")) continue;
    asset.file = asset.file.slice(0, -4) + ".apng";
    asset.mime = "image/png";
    const normalizedPath = path.join(presetRoot, `preset-terraria-${variant}`, asset.file);
    asset.size = fs.statSync(normalizedPath).size;
    expandedReferences += 1;
  }
}
writeJson(expandedSourcesPath, expandedSources);

console.log(JSON.stringify({
  presetRoot,
  uniqueGifSources: sourceGroups.size,
  gifCopies: gifFiles.length,
  convertedUnique,
  writtenCopies,
  themeReferences,
  companionReferences,
  expandedReferences,
  uniqueSourceMiB: Number((sourceBytes / 1048576).toFixed(2)),
  uniqueApngMiB: Number((normalizedBytes / 1048576).toFixed(2)),
}, null, 2));
