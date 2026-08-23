# TRSkin handoff

## Current release line

- Current release candidate: `2.7.7`
- Supported desktop platforms: Windows and macOS
- Linux does not currently have an installation package.

## Composer compatibility repair

Codex 26.730 removed the native `.composer-surface-chrome` wrapper and renamed the
home utility CSS Module class. TRSkin now discovers Composer surfaces through stable
`data-composer-*` attributes, marks only the active visible surface with
`.dream-skin-composer-surface`, and marks the home environment bar with
`.dream-skin-home-utility`.

The legacy `.composer-surface-chrome` path remains in renderer and injector discovery
for older Codex builds. Visual CSS no longer depends on it. Re-injection and cleanup
remove stale renderer-owned markers.

Current Codex builds may add nested native Composer layout/rich-text surfaces inside
the owned outer node. Those stable-attribute descendants are intentionally transparent:
the outer `.dream-skin-composer-surface` remains the sole themed background owner and
the native dark inset, shadow, and outline must not cover it.

## Codex frontend update policy

Do not map TRSkin releases to Codex version numbers. The runtime uses frontend capability
contract schema `1` and reports `compatible`, `adaptive`, or `incompatible` through
`window.__CODEX_DREAM_SKIN_STATE__.frontendContract` and the live verification output.

- `compatible`: no frontend maintenance.
- `adaptive`: a stable anchor changed, but a verified semantic/editor fallback still works;
  keep the current TRSkin release and monitor only.
- `incompatible`: a critical main-surface or visible-Composer capability is lost; only then
  prepare a frontend-adapter repair.

TRSkin's updater compares TRSkin release versions only. An official Codex update is not an
update trigger by itself. Optional header/sidebar/home controls may disappear on individual
routes without requiring a compatibility release.

The Windows control panel follows a progressive-disclosure layout. Its quick page owns
only fixed-environment selection. The all-environment random switch, rotation pool,
timers, music, and restore controls belong under Advanced Settings. Saving and applying
are one primary action; do not split them or move advanced controls back to the first-run
surface without a new usability review.

Fixed-environment selection hot-replaces the renderer inside the same Codex document.
The renderer must capture the old music controller's playback intent before cleanup:
active or queued playback resumes with the selected environment, while an explicit user
pause remains paused. Official restore still stops playback and removes the controller.

The `v2.7.7` cross-platform layout compatibility release:
the renderer collapses only verified empty home slots before the stable game-source
content, themes repeated computed-light change-review rows through an owned inset
marker, and expands/centers Composer from main-surface safe bounds instead of retaining
the native narrow rail. A complementary sidebar caps that safe area only when painted or
interactive content occupies the Composer band; transparent full-height pinned-summary
shells and top-only overlays do not create a bottom-right gutter. Dock width and rail
translation origin are measured separately, geometry settling spans the full summary
transition, and a renderer-owned overflow-host marker prevents Codex's narrower message
column from clipping the visibly expanded input.
Persistent hard capability loss is confirmed after 1200ms before the renderer disables
TRSkin CSS and custom chrome. This safe mode survives reloads, preserves the official
Codex interface, and clears automatically when a compatible adapter is present again.
macOS and Windows source tests cover these contracts. Windows
native source tests pass. Windows managed-runtime verification confirms the pinned output
summary and painted Composer remain 15px from the main-surface right edge; macOS real-app
visual verification still requires a Mac.

## Verification status

- macOS source suite: required before merge.
- Windows-native source suite: required before merge.
- GitHub Actions: required on Windows, macOS, and Ubuntu.
- macOS real-app DOM verification: must be performed on a Mac with Codex 26.730 or newer.
- Windows real-app verification: may be performed from the managed local runtime; never
  patch WindowsApps or official application files.

## Safety boundary

Installation and hot application operate only on the independent TRSkin runtime and
the loopback DevTools session. Do not edit Codex `.app`, `app.asar`, code signatures,
authentication data, or an unrelated open business repository.

