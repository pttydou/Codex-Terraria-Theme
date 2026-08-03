# Terraria local theme asset sources

Downloaded on 2026-07-17 from the official Terraria Wiki (`terraria.wiki.gg`)
. Terraria and the included game artwork belong to
their respective rights holders. This source record is not a redistribution
license.

Source pages:

- <https://terraria.wiki.gg/zh/wiki/生物群系背景>
- <https://terraria.wiki.gg/wiki/Biome_backgrounds>
- <https://terraria.wiki.gg/zh/wiki/森林>
- <https://terraria.wiki.gg/zh/wiki/物品栏>
- <https://terraria.wiki.gg/zh/wiki/生命值>
- <https://terraria.wiki.gg/zh/wiki/魔力>
- <https://terraria.wiki.gg/wiki/List_of_NPCs>
- <https://terraria.wiki.gg/wiki/Bestiary/List>
- <https://terraria.wiki.gg/zh/wiki/怪物图鉴>
- <https://terraria.wiki.gg/wiki/Torch_God%27s_Favor>
- <https://terraria.wiki.gg/wiki/Torches>
- <https://terraria.wiki.gg/wiki/Otherworldly_Tracks>

## Official background variants

`BACKGROUND_SOURCES.json` records the exact official Wiki page, source URL,
destination environment, and local asset key for 81 unique background images
used by 29 of the 44 themes. Themes without an official independent background
variant retain their existing accurate fixed image. Background selection does
not preload the pool: fixed mode chooses once per environment entry, while
rotate mode replaces only the current CSS asset at the configured interval.

## Generated companion and gem-torch source record

`COMPANION_SOURCES.json` is the machine-readable source of truth for the 44
companion pools. It records every official Wiki image URL, whether the selected
file is an animated GIF, its NPC type, destination theme, Bestiary rarity stars,
and renderer selection weight. `SPAWN_ENVIRONMENT_SOURCES.json` records the
spawn-layer backgrounds and the 21 generated spawn-aware variants. The refresh
script selects full GIF enemies plus GIF/PNG critters, includes static enemies
for the expanded environments when no GIF exists, removes item-like entities,
and prefers a GIF when the same NPC also has a static image.

Progression, unlock state, Dungeon wall faction, fishing phase, and event wave
are intentionally not separate themes. Their recorded companions are merged
into the corresponding complete Dungeon, Blood Moon, Solar Eclipse, Goblin
Invasion, Pumpkin Moon, or Frost Moon pool.

Rarity is based on the official Bestiary 1–5 star field and maps to renderer
weights `100 / 55 / 25 / 10 / 3`. This deliberately preserves rare encounters
without claiming to reproduce Terraria's exact spawn-rate formula.

Torch God's Favor has no biome conversion for Forest, Cavern, Space, Ocean,
Graveyard, Meteorite, Spider Nest, Bee Hive, Granite Cave, Marble Cave, or the
event themes. Those themes therefore choose one of the seven
official gem torches (purple, yellow, blue, green, red, white, and orange) once
when the environment is entered. The eleven mapped biomes keep their single
official Favor torch. Exact gem-torch URLs are also recorded in
`COMPANION_SOURCES.json`.

Exact downloaded files:

- Control console — World Globe (environment): <https://terraria.wiki.gg/images/World_Globe.png?c12db3>
- Control console — Music Box (music): <https://terraria.wiki.gg/images/Music_Box.png?278a5b>
- Control console — Cog (random settings): <https://terraria.wiki.gg/images/Cog.png?70c88a>
- Control console — Magic Mirror (restore official appearance): <https://terraria.wiki.gg/images/Magic_Mirror.png?535741>
- Forest background: <https://terraria.wiki.gg/images/Forest_background_9.png?e8e52d>
- Cavern background: <https://terraria.wiki.gg/images/Cavern_background_8.png?d62063>
- Terraria Wiki overworld logo: <https://terraria.wiki.gg/images/Site-logo-overworld.png?b63ea6>
- Green Slime: <https://terraria.wiki.gg/images/Green_Slime.png?737ede>
- Player Heart: <https://terraria.wiki.gg/images/PlayerHeart.png?24beae>
- Mana: <https://terraria.wiki.gg/images/Mana.png?b0e7a8>
- Platinum Pickaxe: <https://terraria.wiki.gg/images/Platinum_Pickaxe.png?c72652>
- Toolbox: <https://terraria.wiki.gg/images/Toolbox.png?67ad8b>
- The Plan: <https://terraria.wiki.gg/images/The_Plan.png?8be0b2>
- Healing Potion: <https://terraria.wiki.gg/images/Healing_Potion.png?2e776b>
- Torch: <https://terraria.wiki.gg/images/Torch.png>
- Sun with Sunglasses: <https://terraria.wiki.gg/images/Sun_%28with_Sunglasses%29.png?b4e0b9>
- Bunny: <https://terraria.wiki.gg/images/Bunny.png?8d5133>
- Bird NPC: <https://terraria.wiki.gg/images/Bird_%28NPC%29.png?cf0380>
- Life Crystal: <https://terraria.wiki.gg/images/Life_Crystal.png?ac89c9>
- Cave Bat: <https://terraria.wiki.gg/images/Cave_Bat.png?771180>
- Gold Ore: <https://terraria.wiki.gg/images/Gold_Ore.png?582771>
- Minecart: <https://terraria.wiki.gg/images/Minecart.png?1d8cff>
- Minecart Track: <https://terraria.wiki.gg/images/Minecart_Track.png?8ac96d>

## Environment pack additions

The following files were downloaded on 2026-07-17 from the same official Wiki
and retain their original PNG pixels.

### Space

- Starlit Heaven Wallpaper (placed): <https://terraria.wiki.gg/images/Starlit_Heaven_Wallpaper_%28placed%29.png?66897d>
- Harpy: <https://terraria.wiki.gg/images/Harpy.png?191d98>
- Moon: <https://terraria.wiki.gg/images/Moon.png?a7c875>
- Star: <https://terraria.wiki.gg/images/Star.png?b5a54a>
- Space Gun: <https://terraria.wiki.gg/images/Space_Gun.png?298a4d>

### Underworld

- Underworld background 2: <https://terraria.wiki.gg/images/Underworld_background_2.png?e3c4d3>
- Demon: <https://terraria.wiki.gg/images/Demon.png?8521ae>
- Fire Imp: <https://terraria.wiki.gg/images/Fire_Imp.png?54f80f>
- Hellstone: <https://terraria.wiki.gg/images/Hellstone.png?98d9cd>
- Lava Bucket: <https://terraria.wiki.gg/images/Lava_Bucket.png?fdb0f0>

### Crimson

- Crimson background 7: <https://terraria.wiki.gg/images/Crimson_background_7.png?9ae7e6>
- Face Monster: <https://terraria.wiki.gg/images/Face_Monster.png?32958a>
- Crimson Heart: <https://terraria.wiki.gg/images/Crimson_Heart.png?7a7179>
- Crimstone Block: <https://terraria.wiki.gg/images/Crimstone_Block.png?c42bba>
- Ichor: <https://terraria.wiki.gg/images/Ichor.png?78a569>

### Hallow

- Hallow background 6: <https://terraria.wiki.gg/images/Hallow_background_6.png?9c6e39>
- Unicorn: <https://terraria.wiki.gg/images/Unicorn.png?ddbf8d>
- Pixie: <https://terraria.wiki.gg/images/Pixie.png?c44dbc>
- Crystal Shard: <https://terraria.wiki.gg/images/Crystal_Shard.png?59de4d>
- Rainbow Rod: <https://terraria.wiki.gg/images/Rainbow_Rod.png?2729d9>

### Corruption

- Corruption background 6: <https://terraria.wiki.gg/images/Corruption_background_6.png?7264ff>
- Eater of Souls: <https://terraria.wiki.gg/images/Eater_of_Souls.png?bcfc35>
- Shadow Orb: <https://terraria.wiki.gg/images/Shadow_Orb.png?58191b>
- Demonite Ore: <https://terraria.wiki.gg/images/Demonite_Ore.png?5e57cb>
- Cursed Flame: <https://terraria.wiki.gg/images/Cursed_Flame.png?30a75e>

### Jungle

- Jungle background 7: <https://terraria.wiki.gg/images/Jungle_background_7.png?9cb171>
- Hornet: <https://terraria.wiki.gg/images/Hornet.png?2789a3>
- Jungle Spores: <https://terraria.wiki.gg/images/Jungle_Spores.png?b86d6e>
- Life Fruit: <https://terraria.wiki.gg/images/Life_Fruit.png?83660d>
- Bee: <https://terraria.wiki.gg/images/Bee.png?3af4f0>

### Tundra

- Snow biome background 14: <https://terraria.wiki.gg/images/Snow_biome_background_14.png?e2dd21>
- Snow Flinx: <https://terraria.wiki.gg/images/Snow_Flinx.png?2c95bb>
- Ice Slime: <https://terraria.wiki.gg/images/Ice_Slime.png?a51f60>
- Ice Blade: <https://terraria.wiki.gg/images/Ice_Blade.png?ae3e0a>
- Frozen Chest: <https://terraria.wiki.gg/images/Frozen_Chest.png?382bf7>

### Desert

- Desert background 7: <https://terraria.wiki.gg/images/Desert_background_7.png?d570d2>
- Vulture: <https://terraria.wiki.gg/images/Vulture.png?97297d>
- Antlion: <https://terraria.wiki.gg/images/Antlion.png?ea0763>
- Cactus: <https://terraria.wiki.gg/images/Cactus.png?b711d1>
- Sandstorm in a Bottle: <https://terraria.wiki.gg/images/Sandstorm_in_a_Bottle.png?31668d>

### Ocean

- Ocean background 7: <https://terraria.wiki.gg/images/Ocean_background_7.png?8246da>
- Shark: <https://terraria.wiki.gg/images/Shark.png?f4b4df>
- Starfish: <https://terraria.wiki.gg/images/Starfish.png?9db469>
- Seashell: <https://terraria.wiki.gg/images/Seashell.png?8e00cc>
- Coral: <https://terraria.wiki.gg/images/Coral.png?faf6f8>

### Glowing Mushroom

- Glowing Mushroom background 5: <https://terraria.wiki.gg/images/Glowing_Mushroom_background_5.png?40bef1>
- Truffle Worm (NPC): <https://terraria.wiki.gg/images/Truffle_Worm_%28NPC%29.png>
- Glowing Mushroom: <https://terraria.wiki.gg/images/Glowing_Mushroom.png?d5da5e>
- Spore Zombie: <https://terraria.wiki.gg/images/Spore_Zombie.png?c010de>
- Mushroom Grass Seeds: <https://terraria.wiki.gg/images/Mushroom_Grass_Seeds.png?50b29c>

### Dungeon

- Dungeon Wall tile: <https://terraria.wiki.gg/images/Dungeon_Wall_-_Tile.png?cba17d>
- Dungeon Slime: <https://terraria.wiki.gg/images/Dungeon_Slime.png?4b85a1>
- Golden Key: <https://terraria.wiki.gg/images/Golden_Key.png?214c58>
- Water Candle: <https://terraria.wiki.gg/images/Water_Candle.png?c19d6e>
- Cursed Skull: <https://terraria.wiki.gg/images/Cursed_Skull.png?665f61>

### Jungle Temple

- Lihzahrd Brick Wall (placed): <https://terraria.wiki.gg/images/Lihzahrd_Brick_Wall_%28placed%29.png?688c5e>
- Lihzahrd: <https://terraria.wiki.gg/images/Lihzahrd.png?7168ab>
- Lihzahrd Altar Sun Orb: <https://terraria.wiki.gg/images/Lihzahrd_Altar_Sun_Orb.png?bd169c>
- Temple Key: <https://terraria.wiki.gg/images/Temple_Key.png?113cdd>
- Lihzahrd Power Cell: <https://terraria.wiki.gg/images/Lihzahrd_Power_Cell.png?952b50>

## Rotating companion additions

Downloaded on 2026-07-19 from the official Terraria Wiki as original PNG
sprites. Existing environment sprites such as Bunny, Bird, Cave Bat, Fire Imp,
Pixie, Bee, Ice Slime, Antlion, Spore Zombie, and Cursed Skull are also reused
by their matching environment companion pools.

- Space — Wyvern: <https://terraria.wiki.gg/images/Wyvern.png?8fa8f8>
- Space — Martian Probe: <https://terraria.wiki.gg/images/Martian_Probe.png?4e053b>
- Underworld — Bone Serpent: <https://terraria.wiki.gg/images/Bone_Serpent.png?3d464b>
- Crimson — Crimera: <https://terraria.wiki.gg/images/Crimera.png?1f050e>
- Crimson — Blood Crawler: <https://terraria.wiki.gg/images/Blood_Crawler.png?5c6b7b>
- Hallow — Gastropod: <https://terraria.wiki.gg/images/Gastropod.png?a69858>
- Corruption — Devourer: <https://terraria.wiki.gg/images/Devourer.png?3d8bf9>
- Corruption — Corruptor: <https://terraria.wiki.gg/images/Corruptor.png?6e674a>
- Jungle — Jungle Bat: <https://terraria.wiki.gg/images/Jungle_Bat.png?d6a51d>
- Tundra — Penguin: <https://terraria.wiki.gg/images/Penguin.png?93a30a>
- Desert — Sand Slime: <https://terraria.wiki.gg/images/Sand_Slime.png?c14b80>
- Ocean — Dolphin: <https://terraria.wiki.gg/images/Dolphin.png?ffc476>
- Ocean — Sea Turtle: <https://terraria.wiki.gg/images/Sea_Turtle.png?6a4bab>
- Glowing Mushroom — Anomura Fungus: <https://terraria.wiki.gg/images/Anomura_Fungus.png?d8d668>
- Dungeon — Angry Bones: <https://terraria.wiki.gg/images/Angry_Bones.png?12c47b> (the original 2×2 sheet is preserved; CSS displays one randomly selected quadrant)
- Jungle Temple — Flying Snake: <https://terraria.wiki.gg/images/Flying_Snake.png?57967f>
- Jungle Temple — Golem Head: <https://terraria.wiki.gg/images/Golem_Head.png?8b1577>

## Biome torch assets

Downloaded on 2026-07-19 from the official Terraria Wiki. The biome mapping is
based on the official Torch God's Favor table; each theme now fixes one primary
torch instead of rotating them. Coral Torch is used for Ocean because the Wiki
identifies it as the Ocean-specific torch even though the Favor does not
automatically swap it in. Earlier alternate torch downloads remain recorded
below but are not selected by the companion timer.

- Aether Torch: <https://terraria.wiki.gg/images/Aether_Torch.png>
- Blue Torch: <https://terraria.wiki.gg/images/Blue_Torch.png>
- Bone Torch: <https://terraria.wiki.gg/images/Bone_Torch.png>
- Coral Torch: <https://terraria.wiki.gg/images/Coral_Torch.png>
- Corrupt Torch: <https://terraria.wiki.gg/images/Corrupt_Torch.png>
- Crimson Torch: <https://terraria.wiki.gg/images/Crimson_Torch.png>
- Cursed Torch: <https://terraria.wiki.gg/images/Cursed_Torch.png>
- Demon Torch: <https://terraria.wiki.gg/images/Demon_Torch.png>
- Desert Torch: <https://terraria.wiki.gg/images/Desert_Torch.png>
- Green Torch: <https://terraria.wiki.gg/images/Green_Torch.png>
- Hallowed Torch: <https://terraria.wiki.gg/images/Hallowed_Torch.png>
- Ice Torch: <https://terraria.wiki.gg/images/Ice_Torch.png>
- Ichor Torch: <https://terraria.wiki.gg/images/Ichor_Torch.png>
- Jungle Torch: <https://terraria.wiki.gg/images/Jungle_Torch.png>
- Mushroom Torch: <https://terraria.wiki.gg/images/Mushroom_Torch.png>
- Orange Torch: <https://terraria.wiki.gg/images/Orange_Torch.png>
- Pink Torch: <https://terraria.wiki.gg/images/Pink_Torch.png>
- Purple Torch: <https://terraria.wiki.gg/images/Purple_Torch.png>
- Rainbow Torch: <https://terraria.wiki.gg/images/Rainbow_Torch.png>
- Red Torch: <https://terraria.wiki.gg/images/Red_Torch.png>
- Ultrabright Torch: <https://terraria.wiki.gg/images/Ultrabright_Torch.png>
- White Torch: <https://terraria.wiki.gg/images/White_Torch.png>
- Yellow Torch: <https://terraria.wiki.gg/images/Yellow_Torch.png>

## All-theme random composite

`preset-terraria-random` contains local copies of the already-recorded
background, fixed torch, companion files, and four fixed suggestion-card item
icons from all 44 fixed environments and events. It introduces no new image
source; content-identical files are deduplicated while the configurable 44-theme random pack remains
self-contained for validated one-shot injection. Environment rotation clears
the previous four inline card icons before applying the next fixed set.

## Fixed suggestion-card item source record

`CARD_ICON_SOURCES.json` records the four fixed item icons for every
environment, in explore/build/review/fix order. It includes the resolved
official Wiki URL, local filename, byte count, and SHA-256 digest for all 176
theme-icon entries. `refresh-card-icons.mjs` can reproducibly refresh them. These icons do
not use the companion pool and do not run a timed shuffle.

No asset in these packs was generated or redrawn by AI. CSS only scales,
repeats, frames, and positions the original pixel artwork.

## 2.0 expanded environment sources

Downloaded on 2026-07-20 from the official Terraria Wiki. The exact resolved
file URLs, byte sizes, reuse relationships, and local filenames are recorded in
`EXPANDED_ENVIRONMENT_SOURCES.json`. The repeatable downloader and theme
metadata live in `add-expanded-environments.mjs`.

- Aether: Aetherium Wall, Faeling, Shimmer Slime, Shimmerfall Wall, Aether Torch.
- Graveyard: Forest background reuse, Ghost, Tombstone, Ecto Mist.
- Pumpkin Moon: Forest background reuse, Pumpkin Moon, Mourning Wood, Pumpking.
- Frost Moon: Tundra background reuse, Frost Moon, Everscream, Ice Queen.
- Lunar Pillars: Starlit Heaven Wallpaper reuse plus each pillar, fragment, and planet.
- Meteorite: Meteorite Brick Wall, Meteor Head, Meteorite, meteor ambience.
- Spider Nest: Spider Wall, Black Recluse, Spider Fang, Web Slinger.
- Bee Hive: Hive Wall, Queen Bee, Bee, Honey Block.
- Granite Cave: Granite Wall, Granite Golem, Granite Elemental, Geode.
- Marble Cave: Marble Wall, Medusa, Hoplite, Marble Block.

Companion-only sources, including the four Shimmer skeleton outputs, complete
Lunar enemy splits, and Granite/Marble Slimes, remain recorded per entry in
`COMPANION_SOURCES.json`.

## Event theme additions

Downloaded on 2026-07-20 from the official Terraria Wiki. Each animated enemy
is kept as an independent source GIF rather than a multi-creature sprite sheet.
Runtime playback uses the mechanically normalized APNG copy described below.
Blood Moon, Solar Eclipse, and Goblin Army reuse the already-recorded Forest
background; Pirate Invasion reuses Ocean; Martian Madness reuses the placed
Starlit Heaven Wallpaper. The duplicated copies keep every local preset
self-contained.

### Blood Moon

- Blood Zombie: <https://terraria.wiki.gg/images/Blood_Zombie.gif?b067f5>
- Drippler: <https://terraria.wiki.gg/images/Drippler.gif?a5b15d>
- The Bride: <https://terraria.wiki.gg/images/The_Bride.gif?b05473>
- The Groom: <https://terraria.wiki.gg/images/The_Groom.gif?4de67b>
- Blood Moon (moon): <https://terraria.wiki.gg/images/Blood_Moon_%28moon%29.png?415cdc>
- Bloody Tear: <https://terraria.wiki.gg/images/Bloody_Tear.png?11f31e>

### Solar Eclipse

- Mothron: <https://terraria.wiki.gg/images/Mothron.gif?a4e9cb>
- Nailhead: <https://terraria.wiki.gg/images/Nailhead.gif?9b246f>
- Deadly Sphere: <https://terraria.wiki.gg/images/Deadly_Sphere.gif?a56df7>
- Psycho: <https://terraria.wiki.gg/images/Psycho.gif?6fef71>
- Solar Eclipse (sun): <https://terraria.wiki.gg/images/Solar_Eclipse_%28sun%29.png?5d1a92>
- Solar Tablet: <https://terraria.wiki.gg/images/Solar_Tablet.png?635a56>

### Goblin Army

- Goblin Peon: <https://terraria.wiki.gg/images/Goblin_Peon.gif?c86df8>
- Goblin Warrior: <https://terraria.wiki.gg/images/Goblin_Warrior.gif?51b7c3>
- Goblin Warlock: <https://terraria.wiki.gg/images/Goblin_Warlock.gif?4d2921>
- Goblin Archer: <https://terraria.wiki.gg/images/Goblin_Archer.gif?db9926>
- Goblin Battle Standard: <https://terraria.wiki.gg/images/Goblin_Battle_Standard.png?6dc7d2>
- Spiky Ball: <https://terraria.wiki.gg/images/Spiky_Ball.png?875d21>

### Pirate Invasion

- Pirate Captain: <https://terraria.wiki.gg/images/Pirate_Captain.gif?a615af>
- Pirate Corsair: <https://terraria.wiki.gg/images/Pirate_Corsair.gif?b0632a>
- Pirate Deadeye: <https://terraria.wiki.gg/images/Pirate_Deadeye.gif?ea1079>
- Parrot: <https://terraria.wiki.gg/images/Parrot.gif?311081>
- Pirate Map: <https://terraria.wiki.gg/images/Pirate_Map.png?65cee9>
- Gold Coin: <https://terraria.wiki.gg/images/Gold_Coin.png?c6fdb6>

### Martian Madness

- Martian Saucer: <https://terraria.wiki.gg/images/Martian_Saucer.gif?507e72>
- Martian Engineer: <https://terraria.wiki.gg/images/Martian_Engineer.gif?7b39f3>
- Martian Officer: <https://terraria.wiki.gg/images/Martian_Officer.gif?7f1a96>
- Martian Drone: <https://terraria.wiki.gg/images/Martian_Drone.gif?455562>
- Martian Probe: <https://terraria.wiki.gg/images/Martian_Probe.gif?480c9f>
- Martian Conduit Plating: <https://terraria.wiki.gg/images/Martian_Conduit_Plating.png?c01606>

`theme-console.icns` is a local macOS icon mechanically derived from the exact
Player Heart file above by padding it on a navy square and exporting standard
icon sizes. It is not an AI-generated or redrawn Terraria asset.

## Transparent animation normalization

The official Wiki GIF files remain the immutable provenance/source copies.
`normalize-animations.mjs` groups identical GIF bytes, converts each unique
animation once with FFmpeg to an infinite-loop APNG, writes self-contained APNG
copies into every preset, and updates theme/manifests to reference only APNG.
Run it again after any animation refresh:

```sh
node local-presets/normalize-animations.mjs
```

Tests reject raw GIF references, missing APNG animation control chunks,
single-frame output, non-infinite loops, or macOS/Windows divergence. Public
runtime ZIPs omit the unused GIF backups.
