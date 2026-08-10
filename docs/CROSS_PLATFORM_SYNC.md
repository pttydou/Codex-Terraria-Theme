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
7. Route changes, hot re-injection, and restore must remove stale markers.

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

