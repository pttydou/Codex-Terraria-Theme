# Changelog

## 2.7.5 — focused Windows quick settings

- Keep only the fixed-environment selector on the Windows quick page.
- Move the all-environment random switch alongside interval, background, pool, and
  next-environment controls under Advanced Settings.
- Replace separate save and re-apply controls with one `保存并应用` action; choosing a
  fixed environment automatically exits all-environment random mode.

## 2.7.4 — nested home Composer surface

- Keep the renderer-owned Composer frame as the single Terraria background owner.
- Clear native background, shadow, and outline from nested stable Composer layout and
  rich-text surfaces, preventing the current Codex home input from showing a dark inset.
- Apply the same stable-attribute rule to Windows and macOS without relying on generated
  CSS Module class names.
- Reduce the Windows control panel to two top-level choices: fixed environment and
  all-environment random. Move rotation details, music, re-apply, and restore into
  clearly grouped advanced pages.

## 2.7.3 — synchronized maintenance release

- Keep Windows and macOS update manifests on the same release version while shipping
  the macOS settings-card contrast repair.
- Retain the Windows Composer theming, outline removal, and environment-music
  continuity fixes verified against the managed local runtime.
- Define the missing forest-day and cavern Composer card variables and retain a
  themed fallback, preventing transparent inputs from exposing Codex native dark gray.

## 2.7.2 — stable Composer ownership

- Discover current Codex Composer surfaces through stable `data-composer-*` attributes
  and retain `.composer-surface-chrome` only as an older-build fallback.
- Style the active visible Composer through `.dream-skin-composer-surface`, remove stale
  markers after route changes, and suppress the native `canvastext` outline.
- Discover the home environment utility bar through
  `data-composer-home-utility-bar-position`, restoring Terraria background and readable
  text on Codex 26.730 and newer.
- Add a Windows-native source test entry point and synchronize probe, early injection,
  live verification, CSS, and Mermaid SVG contrast behavior with macOS.

