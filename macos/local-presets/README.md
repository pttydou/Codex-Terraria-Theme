# Local preset packs

This directory is intentionally separate from `presets/`. It contains
theme packs that include third-party game artwork and are not covered
by the MIT software license.

The installer seeds these packs into the local theme library so they can be
selected and removed independently without changing the official Codex app.

`preset-terraria-random` is a local composite of the same recorded Wiki assets
used by the 44 fixed environments and events. It adds no new third-party source and
rotates only inside the active renderer.

Run `node rebuild-spawn-environments.mjs` to refresh the spawn-aware environment
catalog, companion rarity weights, generated partner documents, and source
records. `refresh-companions.mjs` delegates to that generator by default; its
old broad-biome behavior is available only with
`--legacy-broad-environments`.

Run `node refresh-background-variants.mjs` to refresh the exact official Wiki
background variants recorded in `BACKGROUND_SOURCES.json`, then run
`node rebuild-random-preset.mjs` so the composite environment pool receives the
same `backgroundPool` values. The renderer supports a fixed-per-entry mode and
a timed rotation mode, but materializes only the currently visible background.

Run `node collapse-progression-environments.mjs` after importing an older
59-theme data set. It merges Dungeon factions, unlock progression, fishing
variants, and Pumpkin/Frost Moon wave snapshots back into six complete themes,
then removes the 15 obsolete preset directories.

See `SOURCES.md` for the exact source pages and asset URLs.
