import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const [releaseJsonArg, distArg, version, tag, sourceCommit] = process.argv.slice(2);
if (!releaseJsonArg || !distArg || !/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(version ?? "")) {
  throw new Error("Usage: generate-release-metadata.mjs <release-json> <dist> <version> <tag> <source-commit>");
}
if (tag !== `v${version}` || !/^[a-f0-9]{40}$/.test(sourceCommit ?? "")) {
  throw new Error("Release tag or source commit is invalid");
}

const dist = path.resolve(distArg);
await fs.mkdir(dist, { recursive: true });
const config = JSON.parse(await fs.readFile(path.join(root, "release/release-config.json"), "utf8"));
const release = JSON.parse(await fs.readFile(path.resolve(releaseJsonArg), "utf8"));
if (!Array.isArray(release.assets) || release.tag_name !== tag || release.draft !== true) {
  throw new Error("GitHub release metadata does not describe the expected draft release");
}
const names = {
  macosUpdate: `TRSkin-macOS-Update-${version}.zip`,
  macosFull: `TRSkin-macOS-${version}.zip`,
  music: config.music.assetName,
};

function describe(name) {
  const asset = release.assets.find((candidate) => candidate.name === name);
  if (!asset || !Number.isSafeInteger(asset.size) || asset.size <= 0) {
    throw new Error(`Draft release asset is missing or invalid: ${name}`);
  }
  const digest = typeof asset.digest === "string" ? asset.digest : "";
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) {
    throw new Error(`Draft release asset has no GitHub SHA-256 digest: ${name}`);
  }
  return {
    name,
    size: asset.size,
    sha256: digest.slice("sha256:".length),
  };
}

const assets = {};
for (const [key, name] of Object.entries(names)) assets[key] = describe(name);
if (assets.music.sha256 !== config.music.sha256) {
  throw new Error("The Music Pack does not match its pinned SHA-256");
}

const manifest = {
  schemaVersion: 1,
  repository: config.repository,
  release: { version, tag, sourceCommit },
  platforms: {
    macos: { version, update: assets.macosUpdate, full: assets.macosFull },
  },
  music: { version: config.music.version, ...assets.music },
};
await fs.writeFile(
  path.join(dist, "update-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

const manifestBytes = await fs.readFile(path.join(dist, "update-manifest.json"));
const checksumAssets = [...Object.values(assets), {
  name: "update-manifest.json",
  size: manifestBytes.length,
  sha256: createHash("sha256").update(manifestBytes).digest("hex"),
}].sort((left, right) => left.name.localeCompare(right.name));
await fs.writeFile(
  path.join(dist, "SHA256SUMS.txt"),
  `${checksumAssets.map((asset) => `${asset.sha256}  ${asset.name}`).join("\n")}\n`,
  "utf8",
);

const notes = `# TRSkin ${version} for macOS\n\n`
  + `本 Release 由 GitHub Actions 从标签 \`${tag}\`（commit \`${sourceCommit}\`）自动测试和构建。\n\n`
  + `从 v2.7.33 起，本项目只维护 macOS。Windows 停止功能更新和兼容性修复，最后版本为 [v2.7.10](https://github.com/${config.repository}/releases/tag/v2.7.10)，旧源码和下载继续保留。\n\n`
  + `- 首次安装：下载 \`${names.macosFull}\`，解压后打开 \`START-CODEX-TERRARIA.app\`。\n`
  + `- 已安装 macOS 用户：程序会提示下载 \`${names.macosUpdate}\`，不会重复下载音乐。\n`
  + `- 音乐单独安装：下载 \`${names.music}\`。\n\n`
  + `本版变化与验证范围见[更新说明](https://github.com/${config.repository}/blob/${tag}/macos/CHANGELOG.md)。自动测试不替代真实 Codex 全页面交互验收。\n\n`
  + `校验：\`shasum -a 256 -c SHA256SUMS.txt\`（需下载清单内全部文件；单个文件可与清单逐项比对）。\n\n`
  + `构建证明：\`gh attestation verify <文件> -R ${config.repository}\`\n`;
await fs.writeFile(path.join(dist, "RELEASE-NOTES.md"), notes, "utf8");
console.log(`Generated manifest and checksums for ${tag}.`);
