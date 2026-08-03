import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const presets = path.join(root, "local-presets");
const payloadScript = fs.existsSync(path.join(root, "scripts", "theme-payload.mjs"))
  ? path.join(root, "scripts", "theme-payload.mjs")
  : path.join(root, "scripts", "injector.mjs");
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const walk = (directory, predicate, results = []) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const itemPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(itemPath, predicate, results);
    else if (predicate(itemPath)) results.push(itemPath);
  }
  return results;
};

const themeFiles = walk(presets, (filePath) => path.basename(filePath) === "theme.json");
const apngReferences = [];
const gifReferences = [];
for (const themeFile of themeFiles) {
  const theme = JSON.parse(fs.readFileSync(themeFile, "utf8"));
  for (const fileName of [theme.image, ...Object.values(theme.assets || {})]) {
    if (typeof fileName !== "string") continue;
    if (fileName.endsWith(".gif")) gifReferences.push({ themeFile, fileName });
    if (fileName.endsWith(".apng")) {
      apngReferences.push(path.join(path.dirname(themeFile), fileName));
    }
  }
}

assert.deepEqual(gifReferences, [], "Bundled themes must not load raw GIF animations.");
assert.ok(
  apngReferences.length >= 800,
  `Expected the complete normalized animation library, received ${apngReferences.length} references.`,
);

const uniqueAnimations = new Set();
for (const animationPath of apngReferences) {
  assert.equal(fs.existsSync(animationPath), true, `Missing APNG asset: ${animationPath}`);
  const bytes = fs.readFileSync(animationPath);
  assert.equal(
    bytes.subarray(0, pngSignature.length).equals(pngSignature),
    true,
    `Invalid PNG signature: ${animationPath}`,
  );
  const animationIndex = bytes.indexOf(Buffer.from("acTL", "ascii"));
  assert.ok(animationIndex >= 0, `Missing APNG animation control chunk: ${animationPath}`);
  assert.ok(bytes.readUInt32BE(animationIndex + 4) > 1, `APNG must contain multiple frames: ${animationPath}`);
  assert.equal(bytes.readUInt32BE(animationIndex + 8), 0, `APNG must loop indefinitely: ${animationPath}`);
  uniqueAnimations.add(createHash("sha256").update(bytes).digest("hex"));
}
assert.ok(uniqueAnimations.size >= 350, "The normalized library unexpectedly lost unique animations.");

const rawGifFiles = walk(presets, (filePath) => filePath.endsWith(".gif"));
assert.ok(
  rawGifFiles.length === 0 || rawGifFiles.length >= 800,
  "GIF source backups must be complete in the repository or fully omitted from a runtime package.",
);

const loader = fs.readFileSync(payloadScript, "utf8");
assert.match(loader, /\["\.png", "\.apng", "\.jpg"/, "The payload loader must accept APNG assets.");
assert.match(loader, /theme\.animatedAssetKeys = animatedAssetKeys/, "The payload must identify APNG animation keys.");
assert.match(loader, /theme\.assetDimensions = assetDimensions/, "The payload must expose safe sprite dimensions.");
assert.equal(
  fs.existsSync(path.join(presets, "normalize-animations.mjs")),
  true,
  "The reproducible GIF-to-APNG normalizer is missing.",
);

console.log(
  `PASS: ${apngReferences.length} APNG references (${uniqueAnimations.size} unique) replace raw GIF playback.`,
);
