import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const wikiOrigin = "https://terraria.wiki.gg";
const commonSource = path.join(root, "preset-terraria-forest-day");
const commonAssets = {
  logo: "terraria-logo.png",
  health: "player-heart.png",
  mana: "mana.png",
  explore: "platinum-pickaxe.png",
  build: "toolbox.png",
  review: "the-plan.png",
  fix: "healing-potion.png",
};
const themes = [
  {
    variant: "aether",
    name: "Terraria · 以太",
    brandSubtitle: "THE AETHER",
    tagline: "让微光重塑眼前的一切。",
    projectPrefix: "选择微光域 · ",
    projectLabel: "选择微光域",
    statusText: "以太微光层",
    quote: "EVERYTHING SHIMMERS ANEW",
    backgroundFile: "Aetherium Wall (placed).png",
    accents: ["Faeling.gif", "Shimmer Slime.gif", "Shimmerfall Wall (placed).gif"],
    torch: ["torch-aether", "Aether Torch.png"],
    art: { focusX: 0.5, focusY: 0.5, safeArea: "left", taskMode: "ambient" },
    colors: {
      background: "#17112d", panel: "#34275c", panelAlt: "#554383",
      accent: "#caa7ff", accentAlt: "#7cf3e6", secondary: "#f3a9ff",
      highlight: "#7762c8", text: "#fff4ff", muted: "#d9cbea",
      line: "rgba(202, 167, 255, .58)",
    },
  },
  {
    variant: "graveyard",
    name: "Terraria · 墓地",
    brandSubtitle: "THE GRAVEYARD",
    tagline: "雾气贴地，墓碑保持沉默。",
    projectPrefix: "选择墓园 · ",
    projectLabel: "选择墓园",
    statusText: "墓地迷雾",
    quote: "THE MIST REMEMBERS",
    backgroundCopy: ["forest-day", "background.png"],
    accents: ["Ghost (enemy).gif", "Tombstone.png", "Ecto Mist.png"],
    art: { focusX: 0.54, focusY: 0.48, safeArea: "left", taskMode: "ambient" },
    colors: {
      background: "#151918", panel: "#303735", panelAlt: "#4b5651",
      accent: "#bcc7bb", accentAlt: "#8ca99b", secondary: "#a7b8c7",
      highlight: "#66736e", text: "#f3f4e9", muted: "#c5cbc4",
      line: "rgba(188, 199, 187, .52)",
    },
  },
  {
    variant: "pumpkin-moon",
    name: "Terraria · 南瓜月",
    brandSubtitle: "THE PUMPKIN MOON",
    tagline: "收获之夜已经进入下一波。",
    projectPrefix: "选择惊魂夜 · ",
    projectLabel: "选择惊魂夜",
    statusText: "南瓜月事件",
    quote: "THE HARVEST NEVER SLEEPS",
    backgroundCopy: ["forest-day", "background.png"],
    accents: ["Pumpkin Moon (moon).png", "Mourning Wood.gif", "Pumpking head.gif"],
    art: { focusX: 0.54, focusY: 0.48, safeArea: "left", taskMode: "ambient" },
    colors: {
      background: "#1d0d08", panel: "#4a2411", panelAlt: "#753b17",
      accent: "#ff9d36", accentAlt: "#e85d2a", secondary: "#d69cff",
      highlight: "#8f481a", text: "#fff0d5", muted: "#dfbea0",
      line: "rgba(255, 157, 54, .58)",
    },
  },
  {
    variant: "frost-moon",
    name: "Terraria · 霜月",
    brandSubtitle: "THE FROST MOON",
    tagline: "极寒长夜正在逼近最终波次。",
    projectPrefix: "选择霜夜 · ",
    projectLabel: "选择霜夜",
    statusText: "霜月事件",
    quote: "THE LONGEST NIGHT IS FROZEN",
    backgroundCopy: ["tundra", "background.png"],
    accents: ["Frost Moon (moon).png", "Everscream.gif", "Ice Queen.png"],
    art: { focusX: 0.5, focusY: 0.43, safeArea: "left", taskMode: "ambient" },
    colors: {
      background: "#091c2c", panel: "#163a55", panelAlt: "#285d78",
      accent: "#b7f4ff", accentAlt: "#6ebcff", secondary: "#d9e8ff",
      highlight: "#5788b8", text: "#f7fdff", muted: "#c9dce7",
      line: "rgba(183, 244, 255, .58)",
    },
  },
  {
    variant: "lunar-solar",
    name: "Terraria · 日耀柱",
    brandSubtitle: "THE SOLAR PILLAR",
    tagline: "日耀之力灼烧着天际。",
    projectPrefix: "选择日耀域 · ",
    projectLabel: "选择日耀域",
    statusText: "月亮事件·日耀",
    quote: "THE SUN BURNS BEYOND THE SKY",
    backgroundCopy: ["space", "background.png"],
    accents: ["Solar Pillar.png", "Solar Fragment.png", "Solar Planet.png"],
    art: { focusX: 0.5, focusY: 0.5, safeArea: "none", taskMode: "ambient" },
    colors: {
      background: "#2a0d08", panel: "#632014", panelAlt: "#963d1c",
      accent: "#ff9d38", accentAlt: "#ff5432", secondary: "#ffd16d",
      highlight: "#b84920", text: "#fff2d8", muted: "#e6bca2",
      line: "rgba(255, 157, 56, .60)",
    },
  },
  {
    variant: "lunar-vortex",
    name: "Terraria · 星旋柱",
    brandSubtitle: "THE VORTEX PILLAR",
    tagline: "星旋能量撕开深空。",
    projectPrefix: "选择星旋域 · ",
    projectLabel: "选择星旋域",
    statusText: "月亮事件·星旋",
    quote: "THE VORTEX OPENS",
    backgroundCopy: ["space", "background.png"],
    accents: ["Vortex Pillar.png", "Vortex Fragment.png", "Vortex Planet.png"],
    art: { focusX: 0.5, focusY: 0.5, safeArea: "none", taskMode: "ambient" },
    colors: {
      background: "#061f25", panel: "#0e4c53", panelAlt: "#16727a",
      accent: "#49e3d2", accentAlt: "#38a9e7", secondary: "#9cf8ee",
      highlight: "#1c8790", text: "#eafffb", muted: "#b8deda",
      line: "rgba(73, 227, 210, .58)",
    },
  },
  {
    variant: "lunar-nebula",
    name: "Terraria · 星云柱",
    brandSubtitle: "THE NEBULA PILLAR",
    tagline: "星云意识正在凝聚。",
    projectPrefix: "选择星云域 · ",
    projectLabel: "选择星云域",
    statusText: "月亮事件·星云",
    quote: "THE NEBULA THINKS",
    backgroundCopy: ["space", "background.png"],
    accents: ["Nebula Pillar.png", "Nebula Fragment.png", "Nebula Planet.png"],
    art: { focusX: 0.5, focusY: 0.5, safeArea: "none", taskMode: "ambient" },
    colors: {
      background: "#240b2d", panel: "#55205f", panelAlt: "#813884",
      accent: "#ec75e7", accentAlt: "#9a78ff", secondary: "#ffb0ed",
      highlight: "#9b4ca8", text: "#fff0ff", muted: "#dec4e0",
      line: "rgba(236, 117, 231, .58)",
    },
  },
  {
    variant: "lunar-stardust",
    name: "Terraria · 星尘柱",
    brandSubtitle: "THE STARDUST PILLAR",
    tagline: "星尘生命在宇宙中游弋。",
    projectPrefix: "选择星尘域 · ",
    projectLabel: "选择星尘域",
    statusText: "月亮事件·星尘",
    quote: "LIFE MOVES AMONG THE STARS",
    backgroundCopy: ["space", "background.png"],
    accents: ["Stardust Pillar.png", "Stardust Fragment.png", "Stardust Planet.png"],
    art: { focusX: 0.5, focusY: 0.5, safeArea: "none", taskMode: "ambient" },
    colors: {
      background: "#08162d", panel: "#173663", panelAlt: "#28558b",
      accent: "#72b9ff", accentAlt: "#6f7dff", secondary: "#b5ddff",
      highlight: "#4673bd", text: "#eef7ff", muted: "#bed1e3",
      line: "rgba(114, 185, 255, .58)",
    },
  },
  {
    variant: "meteorite",
    name: "Terraria · 陨石",
    brandSubtitle: "THE METEORITE",
    tagline: "撞击余热仍在矿坑中闪烁。",
    projectPrefix: "选择陨石坑 · ",
    projectLabel: "选择陨石坑",
    statusText: "陨石生物群落",
    quote: "THE SKY LEFT A SCAR",
    backgroundFile: "Meteorite Brick Wall (placed).png",
    accents: ["Meteor Head.gif", "Meteorite.png", "Ambience Meteor.gif"],
    art: { focusX: 0.5, focusY: 0.5, safeArea: "none", taskMode: "ambient" },
    colors: {
      background: "#1c111d", panel: "#3b2443", panelAlt: "#5c3b62",
      accent: "#ff8a45", accentAlt: "#c76bff", secondary: "#ffc06c",
      highlight: "#854b78", text: "#fff0e4", muted: "#d9c0d3",
      line: "rgba(255, 138, 69, .58)",
    },
  },
  {
    variant: "spider-nest",
    name: "Terraria · 蜘蛛洞",
    brandSubtitle: "THE SPIDER NEST",
    tagline: "蛛网覆盖着洞穴的每一道出口。",
    projectPrefix: "选择蛛网巢 · ",
    projectLabel: "选择蛛网巢",
    statusText: "蜘蛛洞穴",
    quote: "EVERY THREAD IS WATCHING",
    backgroundFile: "Spider Wall (placed).png",
    accents: ["Black Recluse (ground).gif", "Spider Fang.png", "Web Slinger.png"],
    art: { focusX: 0.5, focusY: 0.5, safeArea: "none", taskMode: "ambient" },
    colors: {
      background: "#15121b", panel: "#30273b", panelAlt: "#51425e",
      accent: "#d4c9df", accentAlt: "#9b72bf", secondary: "#e0b5ff",
      highlight: "#715780", text: "#fbf4ff", muted: "#cec4d3",
      line: "rgba(212, 201, 223, .52)",
    },
  },
  {
    variant: "bee-hive",
    name: "Terraria · 蜂巢",
    brandSubtitle: "THE BEE HIVE",
    tagline: "蜂蜜与蜂蜡包围着地下王国。",
    projectPrefix: "选择蜂巢室 · ",
    projectLabel: "选择蜂巢室",
    statusText: "地下蜂巢",
    quote: "PROTECT THE HIVE",
    backgroundFile: "Hive Wall (placed).png",
    accents: ["Queen Bee.gif", "Bee.gif", "Honey Block.png"],
    art: { focusX: 0.5, focusY: 0.5, safeArea: "none", taskMode: "ambient" },
    colors: {
      background: "#2a1a06", panel: "#59400e", panelAlt: "#86641b",
      accent: "#ffd24d", accentAlt: "#f29b28", secondary: "#fff0a1",
      highlight: "#a87519", text: "#fff6d5", muted: "#e5d2a2",
      line: "rgba(255, 210, 77, .58)",
    },
  },
  {
    variant: "granite-cave",
    name: "Terraria · 花岗岩洞",
    brandSubtitle: "THE GRANITE CAVE",
    tagline: "深蓝岩层中回荡着沉重脚步。",
    projectPrefix: "选择花岗岩域 · ",
    projectLabel: "选择花岗岩域",
    statusText: "花岗岩洞穴",
    quote: "STONE AWAKENS BELOW",
    backgroundFile: "Granite Wall (placed).png",
    accents: ["Granite Golem.gif", "Granite Elemental.gif", "Geode.png"],
    art: { focusX: 0.5, focusY: 0.5, safeArea: "none", taskMode: "ambient" },
    colors: {
      background: "#101927", panel: "#263b52", panelAlt: "#3f5f78",
      accent: "#86c9e8", accentAlt: "#6188b4", secondary: "#b8e8ff",
      highlight: "#50779c", text: "#f0f9ff", muted: "#bdcfda",
      line: "rgba(134, 201, 232, .54)",
    },
  },
  {
    variant: "marble-cave",
    name: "Terraria · 大理石洞",
    brandSubtitle: "THE MARBLE CAVE",
    tagline: "古典石柱守望着地下遗迹。",
    projectPrefix: "选择大理石域 · ",
    projectLabel: "选择大理石域",
    statusText: "大理石洞穴",
    quote: "THE OLD STONE STILL STANDS",
    backgroundFile: "Marble Wall (placed).png",
    accents: ["Medusa.gif", "Hoplite.gif", "Marble Block.png"],
    art: { focusX: 0.5, focusY: 0.5, safeArea: "none", taskMode: "ambient" },
    colors: {
      background: "#201d20", panel: "#454146", panelAlt: "#68636a",
      accent: "#e3ded7", accentAlt: "#b6a79b", secondary: "#d7c7ba",
      highlight: "#847a82", text: "#fffaf4", muted: "#d1cbc7",
      line: "rgba(227, 222, 215, .54)",
    },
  },
];

const apiHeaders = { "User-Agent": "CodexDreamSkinStudio/2.0 local-private-environment-builder" };

async function resolveFiles(titles) {
  const url = new URL(`${wikiOrigin}/api.php`);
  for (const [key, value] of Object.entries({
    action: "query",
    format: "json",
    formatversion: "2",
    redirects: "1",
    prop: "imageinfo",
    iiprop: "url|size|mime",
    titles: titles.map((title) => `File:${title}`).join("|"),
  })) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: apiHeaders });
  if (!response.ok) throw new Error(`Wiki file metadata failed: ${response.status}`);
  const payload = await response.json();
  const byRequestedTitle = new Map();
  const redirects = new Map((payload.query?.redirects || []).map(({ from, to }) => [from, to]));
  const pages = new Map((payload.query?.pages || []).map((page) => [page.title, page]));
  for (const title of titles) {
    const requested = `File:${title}`;
    const resolved = redirects.get(requested) || requested;
    const page = pages.get(resolved);
    const image = page?.imageinfo?.[0];
    if (!image?.url || page.missing) throw new Error(`Missing official Wiki file: ${title}`);
    byRequestedTitle.set(title, {
      title: page.title.replace(/^File:/, ""),
      url: image.url,
      size: image.size,
      mime: image.mime,
    });
  }
  return byRequestedTitle;
}

async function download(url, target) {
  const response = await fetch(url, { headers: apiHeaders });
  if (!response.ok) throw new Error(`Wiki asset download failed (${response.status}): ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 20 || bytes.length > 16 * 1024 * 1024) {
    throw new Error(`Unexpected Wiki asset size ${bytes.length}: ${url}`);
  }
  await fs.writeFile(target, bytes);
}

const requestedTitles = [...new Set(themes.flatMap((theme) => [
  ...(theme.backgroundFile ? [theme.backgroundFile] : []),
  ...theme.accents,
  ...(theme.torch ? [theme.torch[1]] : []),
]))];
const resolvedFiles = await resolveFiles(requestedTitles);
const sourceRecord = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: `${wikiOrigin}/wiki/Main_Page`,
  themes: {},
};

for (const theme of themes) {
  const themeRoot = path.join(root, `preset-terraria-${theme.variant}`);
  await fs.mkdir(themeRoot, { recursive: true });
  const assets = {};
  for (const [key, file] of Object.entries(commonAssets)) {
    await fs.copyFile(path.join(commonSource, file), path.join(themeRoot, file));
    assets[key] = file;
  }

  let image;
  const recordedAssets = [];
  if (theme.backgroundCopy) {
    const [sourceVariant, sourceFile] = theme.backgroundCopy;
    image = "background.png";
    await fs.copyFile(
      path.join(root, `preset-terraria-${sourceVariant}`, sourceFile),
      path.join(themeRoot, image),
    );
    recordedAssets.push({
      role: "background",
      reusedFrom: `preset-terraria-${sourceVariant}/${sourceFile}`,
      file: image,
    });
  } else {
    const source = resolvedFiles.get(theme.backgroundFile);
    const extension = path.extname(new URL(source.url).pathname).toLowerCase();
    image = `background${extension}`;
    await download(source.url, path.join(themeRoot, image));
    recordedAssets.push({ role: "background", file: image, ...source });
  }

  for (let index = 0; index < theme.accents.length; index += 1) {
    const title = theme.accents[index];
    const source = resolvedFiles.get(title);
    const extension = path.extname(new URL(source.url).pathname).toLowerCase();
    const key = `accent-${index + 1}`;
    const file = `${key}${extension}`;
    await download(source.url, path.join(themeRoot, file));
    assets[key] = file;
    recordedAssets.push({ role: key, file, ...source });
  }

  const config = {
    schemaVersion: 1,
    id: `preset-terraria-${theme.variant}`,
    name: theme.name,
    stylePreset: "terraria",
    variant: theme.variant,
    brandSubtitle: theme.brandSubtitle,
    tagline: theme.tagline,
    projectPrefix: theme.projectPrefix,
    projectLabel: theme.projectLabel,
    statusText: theme.statusText,
    quote: theme.quote,
    image,
    appearance: "dark",
    art: theme.art,
    assets,
    companionPool: [],
    cardIconPool: ["explore", "build", "review", "fix"],
    colors: theme.colors,
  };
  if (theme.torch) {
    const [key, title] = theme.torch;
    const source = resolvedFiles.get(title);
    const extension = path.extname(new URL(source.url).pathname).toLowerCase();
    const file = `${key}${extension}`;
    await download(source.url, path.join(themeRoot, file));
    config.assets[key] = file;
    config.torchKey = key;
    recordedAssets.push({ role: "torch", file, ...source });
  }
  await fs.writeFile(
    path.join(themeRoot, "theme.json"),
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8",
  );
  sourceRecord.themes[theme.variant] = { name: theme.name, assets: recordedAssets };
}

await fs.writeFile(
  path.join(root, "EXPANDED_ENVIRONMENT_SOURCES.json"),
  `${JSON.stringify(sourceRecord, null, 2)}\n`,
  "utf8",
);
console.log(`Created ${themes.length} expanded Terraria environment presets.`);
