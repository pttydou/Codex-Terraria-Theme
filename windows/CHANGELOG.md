# Changelog

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

