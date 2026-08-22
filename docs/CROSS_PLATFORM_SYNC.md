# Cross-platform synchronization

## Mirrored runtime files

The following files implement the same renderer contract and must be reviewed together:

| macOS | Windows |
|---|---|
| `macos/assets/renderer-inject.js` | `windows/TRSkin/core/assets/renderer-inject.js` |
| `macos/assets/dream-skin.css` | `windows/TRSkin/core/assets/dream-skin.css` |
| `macos/scripts/injector.mjs` | `windows/TRSkin/core/scripts/injector.mjs` |

Windows also embeds equivalent probe and live-verification logic in
`windows/TRSkin/core/scripts/theme-payload.mjs`.

## Stable Composer contract

1. Discover native surfaces with `[data-composer-surface-variant]` and
   `[data-composer-utility-bar-variant]`.
2. Prefer a visible direct child `[data-composer-layout]` as the actual styled surface.
3. Mark only that active node with `.dream-skin-composer-surface`.
4. Discover the home utility bar with `[data-composer-home-utility-bar-position]` and
   mark it with `.dream-skin-home-utility`.
5. Keep `.composer-surface-chrome` and the old home utility CSS Module substring only as
   compatibility discovery fallbacks.
6. Visual CSS must use renderer-owned classes and must clear the native Composer outline.
7. Nested stable Composer surface/layout and rich-text nodes must remain transparent;
   `.dream-skin-composer-surface` is the single themed background owner.
8. Route changes, hot re-injection, and restore must remove stale markers.

## Layout compatibility contract

1. Locate real home content from `[data-feature="game-source"]`; only direct siblings
   before that content that pass an empty-content guard may receive
   `.dream-skin-home-empty-slot`.
2. Text, controls, media, Composer nodes, URL-backed paint, and asynchronous content
   make a home slot non-empty and must revoke the marker before the next paint.
3. Repeated change-review rows may receive `.trskin-light-surface-inset` only when at
   least two wide, shallow, horizontally aligned semantic controls share a compact
   ancestor and their computed solid, gradient, or pseudo-element paint is light.
4. Header, Composer, Home, Settings, Markdown/Diff, media, and form regions remain
   excluded from the generic light-surface scan.
5. Composer width comes from main-surface safe bounds. Its readable cap is the greater
   of the native dock width and `mainHeight * 1.5`; available width remains the hard cap.
6. Empty positioned pointer-inert footer decorations use renderer-owned markers; real
   status/progress content remains visible.
7. Route mutation, resize, hot replacement, pause, restore, and cleanup must revoke
   stale markers and inline Composer geometry on both platforms.

## Music hot-replacement contract

1. Capture the previous controller's playback intent before hot-replacement cleanup.
2. If music was active or waiting to advance, attach the new environment pool and resume
   without requiring another button click.
3. If the user explicitly paused music, preserve that pause across the replacement.
4. Official restore and disable paths must still stop audio, unload the source, and revoke
   its Blob URL.
5. Keep the Windows and macOS renderer implementations identical for this behavior.

## Required checks

```bash
cd macos
npm test
```

```powershell
powershell -File windows/tests/run-tests.ps1
```

CI runs the cross-platform renderer contract on all three hosted operating systems and
the Windows-native suite on the Windows runner. A macOS release additionally compiles
the native control panel before packaging.

