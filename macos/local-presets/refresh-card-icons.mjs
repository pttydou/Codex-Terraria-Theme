import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const wikiOrigin = "https://terraria.wiki.gg";
const roles = ["explore", "build", "review", "fix"];
const themes = new Map([
  ["forest-day", [
    ["橡实", "Acorn.png"], ["太阳花", "Daybloom.png"],
    ["木材", "Wood.png"], ["凝胶", "Gel.png"],
  ]],
  ["cavern", [
    ["生命水晶", "Life_Crystal.png"], ["金矿", "Gold_Ore.png"],
    ["回忆药水", "Recall_Potion.png"], ["魔镜", "Magic_Mirror.png"],
  ]],
  ["space", [
    ["坠落之星", "Fallen_Star.png"], ["太空枪", "Space_Gun.png"],
    ["陨石锭", "Meteorite_Bar.png"], ["星怒", "Starfury.png"],
  ]],
  ["underworld", [
    ["狱石", "Hellstone.png"], ["黑曜石", "Obsidian.png"],
    ["熔岩桶", "Lava_Bucket.png"], ["向导巫毒娃娃", "Guide_Voodoo_Doll.png"],
  ]],
  ["crimson", [
    ["组织样本", "Tissue_Sample.png"], ["猩红矿锭", "Crimtane_Bar.png"],
    ["灵液", "Ichor.png"], ["椎骨", "Vertebra.png"],
  ]],
  ["hallow", [
    ["水晶碎块", "Crystal_Shard.png"], ["妖精尘", "Pixie_Dust.png"],
    ["独角兽角", "Unicorn_Horn.png"], ["光明之魂", "Soul_of_Light.png"],
  ]],
  ["corruption", [
    ["魔矿锭", "Demonite_Bar.png"], ["腐肉", "Rotten_Chunk.png"],
    ["诅咒焰", "Cursed_Flame.png"], ["蠕虫毒牙", "Worm_Tooth.png"],
  ]],
  ["jungle", [
    ["丛林孢子", "Jungle_Spores.png"], ["毒刺", "Stinger.png"],
    ["生命果", "Life_Fruit.png"], ["藤蔓", "Vine.png"],
  ]],
  ["tundra", [
    ["冰雪刃", "Ice_Blade.png"], ["冰冻箱", "Frozen_Chest.png"],
    ["冰雪块", "Ice_Block.png"], ["寒霜核", "Frost_Core.png"],
  ]],
  ["desert", [
    ["仙人掌", "Cactus.png"], ["沙暴瓶", "Sandstorm_in_a_Bottle.png"],
    ["蚁狮上颚", "Antlion_Mandible.png"], ["沙漠化石", "Desert_Fossil.png"],
  ]],
  ["ocean", [
    ["海星", "Starfish.png"], ["贝壳", "Seashell.png"],
    ["珊瑚", "Coral.png"], ["鲨鱼鳍", "Shark_Fin.png"],
  ]],
  ["glowing-mushroom", [
    ["发光蘑菇", "Glowing_Mushroom.png"], ["蘑菇草种子", "Mushroom_Grass_Seeds.png"],
    ["松露虫", "Truffle_Worm.png"], ["蘑菇矿锭", "Shroomite_Bar.png"],
  ]],
  ["dungeon", [
    ["金钥匙", "Golden_Key.png"], ["水蜡烛", "Water_Candle.png"],
    ["骨头", "Bone.png"], ["钴护盾", "Cobalt_Shield.png"],
  ]],
  ["jungle-temple", [
    ["神庙钥匙", "Temple_Key.png"], ["丛林蜥蜴电池", "Lihzahrd_Power_Cell.png"],
    ["丛林蜥蜴砖", "Lihzahrd_Brick.png"], ["日耀碑牌碎片", "Solar_Tablet_Fragment.png"],
  ]],
  ["blood-moon", [
    ["血泪", "Bloody_Tear.png"], ["鱼饵桶", "Chum_Bucket.png"],
    ["吸血鬼青蛙法杖", "Vampire_Frog_Staff.png"], ["血月天塔柱", "Blood_Moon_Monolith.png"],
  ]],
  ["solar-eclipse", [
    ["断裂英雄剑", "Broken_Hero_Sword.png"], ["海神贝壳", "Neptune%27s_Shell.png"],
    ["月亮石", "Moon_Stone.png"], ["眼簧", "Eye_Spring.png"],
  ]],
  ["goblin-invasion", [
    ["尖球", "Spiky_Ball.png"], ["鱼叉枪", "Harpoon.png"],
    ["暗影焰刀", "Shadowflame_Knife.png"], ["破布", "Tattered_Cloth.png"],
  ]],
  ["pirate-invasion", [
    ["海盗地图", "Pirate_Map.png"], ["金戒指", "Gold_Ring.png"],
    ["钱币枪", "Coin_Gun.png"], ["短弯刀", "Cutlass.png"],
  ]],
  ["martian-invasion", [
    ["火星管道镀层", "Martian_Conduit_Plating.png"], ["激光钻头", "Laser_Drill.png"],
    ["宇宙车钥匙", "Cosmic_Car_Key.png"], ["外星霰弹枪", "Xenopopper.png"],
  ]],
  ["aether", [
    ["无底微光桶", "Bottomless_Shimmer_Bucket.png"], ["以太火把", "Aether_Torch.png"],
    ["和谐杖", "Rod_of_Harmony.png"], ["珍馐", "Ambrosia.png"],
  ]],
  ["graveyard", [
    ["墓碑", "Tombstone.png"], ["掘墓者铲子", "Gravedigger%27s_Shovel.png"],
    ["阿比盖尔的花", "Abigail%27s_Flower.png"], ["棺材矿车", "Coffin_Minecart.png"],
  ]],
  ["pumpkin-moon", [
    ["南瓜月勋章", "Pumpkin_Moon_Medallion.png"], ["阴森木", "Spooky_Wood.png"],
    ["黑色仙尘", "Black_Fairy_Dust.png"], ["乌鸦法杖", "Raven_Staff.png"],
  ]],
  ["frost-moon", [
    ["调皮礼物", "Naughty_Present.png"], ["暴雪法杖", "Blizzard_Staff.png"],
    ["链式机枪", "Chain_Gun.png"], ["精灵熔枪", "Elf_Melter.png"],
  ]],
  ["lunar-solar", [
    ["日耀碎片", "Solar_Fragment.png"], ["破晓之光", "Daybreak.png"],
    ["日耀喷发剑", "Solar_Eruption.png"], ["日耀碑牌", "Solar_Tablet.png"],
  ]],
  ["lunar-vortex", [
    ["星旋碎片", "Vortex_Fragment.png"], ["星旋机枪", "Vortex_Beater.png"],
    ["幻影弓", "Phantasm.png"], ["星旋头盔", "Vortex_Helmet.png"],
  ]],
  ["lunar-nebula", [
    ["星云碎片", "Nebula_Fragment.png"], ["星云烈焰", "Nebula_Blaze.png"],
    ["星云奥秘", "Nebula_Arcanum.png"], ["星云头盔", "Nebula_Helmet.png"],
  ]],
  ["lunar-stardust", [
    ["星尘碎片", "Stardust_Fragment.png"], ["星尘之龙法杖", "Stardust_Dragon_Staff.png"],
    ["星尘细胞法杖", "Stardust_Cell_Staff.png"], ["星尘头盔", "Stardust_Helmet.png"],
  ]],
  ["meteorite", [
    ["陨石", "Meteorite.png"], ["陨石锭", "Meteorite_Bar.png"],
    ["太空枪", "Space_Gun.png"], ["流星法杖", "Meteor_Staff.png"],
  ]],
  ["spider-nest", [
    ["蜘蛛牙", "Spider_Fang.png"], ["蛛丝发射器", "Web_Slinger.png"],
    ["毒液法杖", "Poison_Staff.png"], ["蜘蛛法杖", "Spider_Staff.png"],
  ]],
  ["bee-hive", [
    ["蜂蜜块", "Honey_Block.png"], ["蜂窝", "Honey_Comb.png"],
    ["蜜蜂枪", "Bee_Gun.png"], ["养蜂人", "Bee_Keeper.png"],
  ]],
  ["granite-cave", [
    ["花岗岩块", "Granite_Block.png"], ["晶洞", "Geode.png"],
    ["夜视头盔", "Night_Vision_Helmet.png"], ["花岗岩箱", "Granite_Chest.png"],
  ]],
  ["marble-cave", [
    ["大理石块", "Marble_Block.png"], ["蛇发女妖头", "Medusa_Head.png"],
    ["角斗士头盔", "Gladiator_Helmet.png"], ["标枪", "Javelin.png"],
  ]],
]);

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function downloadWikiFile(fileName, attempt = 1) {
  const decodedName = decodeURIComponent(fileName);
  const url = `${wikiOrigin}/images/${encodeURIComponent(decodedName)}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "CodexDreamSkinStudio/2.0 fixed-card-icon-refresh" },
    redirect: "follow",
  });
  if (!response.ok) {
    if (attempt < 6 && (response.status === 429 || response.status >= 500)) {
      await sleep(800 * attempt);
      return downloadWikiFile(fileName, attempt + 1);
    }
    throw new Error(`Wiki image request failed (${response.status}): ${decodedName}`);
  }
  const resolved = new URL(response.url);
  if (resolved.protocol !== "https:" || resolved.hostname !== "terraria.wiki.gg") {
    throw new Error(`Wiki redirect escaped the approved host: ${response.url}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 20 || bytes.length > 2 * 1024 * 1024 ||
    !bytes.subarray(1, 4).equals(Buffer.from("PNG"))) {
    throw new Error(`Unexpected card icon payload for ${decodedName}: ${bytes.length} bytes`);
  }
  return { bytes, sourceUrl: resolved.href };
}

async function runConcurrent(tasks, limit = 4) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const index = next;
      next += 1;
      await tasks[index]();
      await sleep(80);
    }
  });
  await Promise.all(workers);
}

const fileNames = new Set();
for (const entries of themes.values()) {
  for (const [, fileName] of entries) fileNames.add(fileName);
}
const downloads = new Map();
await runConcurrent([...fileNames].map((fileName) => async () => {
  downloads.set(fileName, await downloadWikiFile(fileName));
}));

const sourceRecord = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: `${wikiOrigin}/wiki/Items`,
  behavior: "Four fixed environment-specific item icons; no timed card rotation.",
  themes: {},
};

for (const [variant, entries] of themes) {
  const themeRoot = path.join(root, `preset-terraria-${variant}`);
  const themePath = path.join(themeRoot, "theme.json");
  const theme = JSON.parse(await fs.readFile(themePath, "utf8"));
  if (theme.variant !== variant || entries.length !== roles.length) {
    throw new Error(`Card icon mapping mismatch: ${variant}`);
  }
  const previousFiles = roles.map((role) => theme.assets[role]).filter(Boolean);
  const records = [];
  for (let index = 0; index < roles.length; index += 1) {
    const role = roles[index];
    const [zhName, fileName] = entries[index];
    const result = await downloads.get(fileName);
    const targetName = `card-${role}.png`;
    await fs.writeFile(path.join(themeRoot, targetName), result.bytes);
    theme.assets[role] = targetName;
    records.push({
      role,
      zhName,
      sourceFile: decodeURIComponent(fileName),
      sourceUrl: result.sourceUrl,
      file: targetName,
      bytes: result.bytes.length,
      sha256: crypto.createHash("sha256").update(result.bytes).digest("hex"),
    });
  }
  theme.cardIconPool = [...roles];
  await fs.writeFile(themePath, `${JSON.stringify(theme, null, 2)}\n`, "utf8");
  const referenced = new Set(Object.values(theme.assets));
  for (const oldFile of previousFiles) {
    if (!referenced.has(oldFile) && /^(?:platinum-pickaxe|toolbox|the-plan|healing-potion)\.png$/.test(oldFile)) {
      await fs.unlink(path.join(themeRoot, oldFile)).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }
  sourceRecord.themes[variant] = { name: theme.name, icons: records };
}

await fs.writeFile(
  path.join(root, "CARD_ICON_SOURCES.json"),
  `${JSON.stringify(sourceRecord, null, 2)}\n`,
  "utf8",
);
console.log(`Refreshed ${themes.size * roles.length} fixed card item icons across ${themes.size} themes.`);
