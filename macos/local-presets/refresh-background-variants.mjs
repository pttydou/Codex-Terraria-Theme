import fs from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const wikiOrigin = "https://terraria.wiki.gg";
const userAgent = "CodexTerrariaSkin/2.6 local-personal-use";
const maxImageBytes = 2 * 1024 * 1024;

const families = [
  {
    id: "forest",
    themes: [
      "forest-day", "forest-night", "blood-moon", "solar-eclipse",
      "goblin-invasion", "graveyard", "pumpkin-moon",
    ],
    files: [
      "Forest background 1.png", "Forest background 6.png",
      "Forest background 9.png", "Forest background 14.gif",
      "Forest background 18.png",
    ],
  },
  {
    id: "snow",
    themes: ["tundra", "tundra-night", "frost-moon"],
    files: [
      "Snow biome background 1.png", "Snow biome background 5.png",
      "Snow biome background 11.png", "Snow biome background 13.png",
      "Snow biome background 14.png",
    ],
  },
  {
    id: "jungle",
    themes: ["jungle", "jungle-night"],
    files: [
      "Jungle background 1.png", "Jungle background 3.png",
      "Jungle background 5.png", "Jungle background 6.gif",
      "Jungle background 7.gif",
    ],
  },
  {
    id: "desert",
    themes: ["desert"],
    files: [
      "Desert background 1.png", "Desert background 2.png",
      "Desert background 4.png", "Desert background 6.gif",
      "Desert background 7.png",
    ],
  },
  {
    id: "corruption",
    themes: ["corruption"],
    files: [
      "Corruption background 1.png", "Corruption background 3.png",
      "Corruption background 4.png", "Corruption background 5.png",
      "Corruption background 6.png",
    ],
  },
  {
    id: "crimson",
    themes: ["crimson"],
    files: [
      "Crimson background 1.png", "Crimson background 2.png",
      "Crimson background 4.png", "Crimson background 6.png",
      "Crimson background 7.gif",
    ],
  },
  {
    id: "hallow",
    themes: ["hallow", "hallow-night"],
    files: [
      "Hallow background 1.png", "Hallow background 2.png",
      "Hallow background 4.png", "Hallow background 5.png",
      "Hallow background 6.gif",
    ],
  },
  {
    id: "ocean",
    themes: ["ocean", "pirate-invasion"],
    files: [
      "Ocean background 1.png", "Ocean background 3.png",
      "Ocean background 6.png", "Ocean background 7.png",
      "Ocean background 8.png",
    ],
  },
  {
    id: "mushroom",
    themes: ["glowing-mushroom"],
    files: [
      "Glowing Mushroom background 1.png",
      "Glowing Mushroom background 2.png",
      "Glowing Mushroom background 3.gif",
      "Glowing Mushroom background 4.png",
      "Glowing Mushroom background 5.png",
    ],
  },
  {
    id: "underground",
    themes: ["underground"],
    files: [
      "Underground background 1.png", "Underground background 3.png",
      "Underground background 6.png", "Underground background 8.png",
      "Underground background 9.png",
    ],
  },
  {
    id: "cavern",
    themes: ["cavern"],
    files: [
      "Cavern background 1.png", "Cavern background 3.png",
      "Cavern background 6.png", "Cavern background 8.png",
      "Cavern background 9.png",
    ],
  },
  {
    id: "underworld",
    themes: ["underworld"],
    files: [
      "Underworld background 1.gif", "Underworld background 2.gif",
      "Underworld background 3.gif",
    ],
  },
  {
    id: "ice",
    themes: ["ice-biome"],
    files: [
      "Ice biome background 1.png", "Ice biome background 2.png",
      "Ice biome background 3.png", "Ice biome background 5.png",
      "Ice biome background 6.png",
    ],
  },
  {
    id: "underground-jungle",
    themes: ["underground-jungle"],
    files: [
      "Underground jungle background 1.png",
      "Underground jungle background 2.png",
      "Cavern jungle background 1.png",
      "Cavern jungle background 2.png",
    ],
  },
  {
    id: "underground-corruption",
    themes: ["underground-corruption"],
    files: [
      "Underground corruption background 1.png",
      "Underground corruption background 2.png",
      "Underground corruption background 3.png",
      "Underground corruption background 4.png",
    ],
  },
  {
    id: "underground-crimson",
    themes: ["underground-crimson"],
    files: [
      "Underground crimson background 1.png",
      "Underground crimson background 2.png",
      "Underground crimson background 3.png",
      "Underground crimson background 4.png",
      "Underground crimson background 5.png",
    ],
  },
  {
    id: "underground-hallow",
    themes: ["underground-hallow"],
    files: [
      "Underground hallow background 1.png",
      "Underground hallow background 2.png",
      "Underground hallow background 3.png",
    ],
  },
  {
    id: "underground-mushroom",
    themes: ["underground-glowing-mushroom"],
    files: [
      "Underground glowing mushroom background 1.png",
      "Underground glowing mushroom background 2.png",
    ],
  },
];

function safeExtension(title) {
  const extension = path.extname(title).toLowerCase();
  if (![".png", ".gif"].includes(extension)) {
    throw new Error(`Unsupported background extension: ${title}`);
  }
  return extension;
}

function validSignature(extension, bytes) {
  if (extension === ".png") {
    return bytes.length >= 8
      && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  return bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"));
}

async function fetchWikiFile(title) {
  const api = new URL("/api.php", wikiOrigin);
  api.search = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "imageinfo",
    iiprop: "url|size|sha1",
    titles: `File:${title}`,
  });
  const response = await fetch(api, { headers: { "user-agent": userAgent } });
  if (!response.ok) throw new Error(`Wiki API failed for ${title}: HTTP ${response.status}`);
  const data = await response.json();
  const page = Object.values(data?.query?.pages || {})[0];
  const info = page?.imageinfo?.[0];
  if (
    !info || typeof info.url !== "string"
    || !info.url.startsWith(`${wikiOrigin}/images/`)
    || !Number.isInteger(info.size) || info.size < 1 || info.size > maxImageBytes
  ) {
    throw new Error(`Wiki returned unsafe metadata for ${title}`);
  }
  const imageResponse = await fetch(info.url, { headers: { "user-agent": userAgent } });
  if (!imageResponse.ok) {
    throw new Error(`Wiki image download failed for ${title}: HTTP ${imageResponse.status}`);
  }
  const bytes = Buffer.from(await imageResponse.arrayBuffer());
  const extension = safeExtension(title);
  if (bytes.length < 1 || bytes.length > maxImageBytes || !validSignature(extension, bytes)) {
    throw new Error(`Wiki image has an invalid size or signature: ${title}`);
  }
  return {
    title,
    url: info.url,
    width: info.width,
    height: info.height,
    wikiSize: info.size,
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

async function writeAtomic(filePath, bytes) {
  const temporary = `${filePath}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  try {
    await fs.writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
    await fs.rename(temporary, filePath);
  } finally {
    await fs.unlink(temporary).catch(() => {});
  }
}

const downloads = new Map();
for (const title of new Set(families.flatMap((family) => family.files))) {
  downloads.set(title, await fetchWikiFile(title));
}

const sourceRecord = {
  schemaVersion: 1,
  downloadedAt: new Date().toISOString(),
  sourcePage: `${wikiOrigin}/wiki/Biome_backgrounds`,
  behavior: "Each environment lazily materializes one selected background from its pool.",
  families: [],
};

for (const family of families) {
  const records = family.files.map((title) => downloads.get(title));
  for (const variant of family.themes) {
    const themeRoot = path.join(root, `preset-terraria-${variant}`);
    const themePath = path.join(themeRoot, "theme.json");
    const theme = JSON.parse(await fs.readFile(themePath, "utf8"));
    const primaryBytes = await fs.readFile(path.join(themeRoot, theme.image));
    const primaryDigest = createHash("sha256").update(primaryBytes).digest("hex");
    const nextAssets = { ...(theme.assets || {}) };
    for (const key of Object.keys(nextAssets)) {
      if (key === "bg-primary" || key.startsWith("bg-variant-")) delete nextAssets[key];
    }
    nextAssets["bg-primary"] = theme.image;
    const pool = ["bg-primary"];
    const retainedFiles = new Set();
    for (let index = 0; index < records.length; index += 1) {
      const record = records[index];
      if (record.sha256 === primaryDigest) continue;
      const extension = safeExtension(record.title);
      const key = `bg-variant-${family.id}-${index + 1}`;
      const fileName = `${key}${extension}`;
      await writeAtomic(path.join(themeRoot, fileName), record.bytes);
      nextAssets[key] = fileName;
      pool.push(key);
      retainedFiles.add(fileName);
    }
    for (const entry of await fs.readdir(themeRoot, { withFileTypes: true })) {
      if (
        entry.isFile() && /^bg-variant-.*\.(?:gif|png)$/i.test(entry.name)
        && !retainedFiles.has(entry.name)
      ) {
        await fs.unlink(path.join(themeRoot, entry.name));
      }
    }
    theme.assets = nextAssets;
    theme.backgroundPool = [...new Set(pool)];
    await writeAtomic(themePath, Buffer.from(`${JSON.stringify(theme, null, 2)}\n`, "utf8"));
  }
  sourceRecord.families.push({
    id: family.id,
    themes: family.themes,
    files: records.map(({ bytes, ...record }) => ({ ...record, size: bytes.length })),
  });
}

await writeAtomic(
  path.join(root, "BACKGROUND_SOURCES.json"),
  Buffer.from(`${JSON.stringify(sourceRecord, null, 2)}\n`, "utf8"),
);

console.log(
  `Updated ${families.reduce((sum, family) => sum + family.themes.length, 0)} themes `
  + `from ${downloads.size} official Wiki background files.`,
);
