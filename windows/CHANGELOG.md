# Changelog

## Unreleased — Home notice ownership and Store-update recovery

- Add a dedicated semantic adapter for native notices above Home content and promotion
  surfaces between Hero and Composer. Ownership requires visible text, real action/status
  semantics, relative wide-and-shallow geometry, and computed light paint; it never uses
  product copy, locale, CSS Module hashes, child order, or fixed coordinates.
- Keep Hero, suggestions, Home utility, Composer, game-source, and ancestors containing
  those core nodes native. Give each logical notice one outer frame and reuse layered
  pseudo/control/foreground markers without nested borders or shadows.
- Claim asynchronous Home notices in the MutationObserver microtask and keep first-RAF,
  stable-route, cleanup, Windows, and macOS behavior under one regression contract.

- Detect a replaced Codex package or missing verified TR Skin session before saving from
  the control panel, and request restart consent in the visible panel instead of a hidden
  child process.
- Let the start script move away from an unresponsive stale debug port after an update.
- Keep Save/Restore disabled while their background operation is active. Report success
  only after start and live verification exit successfully, and show redirected stderr on
  failure.

## 2.7.7 — Codex frontend stability and safe fallback

- Add a version-independent frontend capability contract. Minor Codex DOM changes that
  still satisfy semantic/editor fallbacks report `adaptive` and keep running; only hard
  main-surface or visible-Composer capability loss reports `incompatible` and requests an
  adapter update. Live verification now exposes that decision directly.
- Add a persistent frontend circuit breaker. A first critical failure waits 1200ms for a
  confirming scan so route transitions cannot flash the theme; a persistent failure
  disables TRSkin CSS and custom chrome, leaving the official Codex interface operable.
  Safe mode survives reloads and clears automatically after compatibility returns.
- Require live verification to observe safety mode `normal` and an enabled stylesheet;
  confirming and safe states cannot be reported as successful installs, while optional
  capability loss continues to degrade locally.
- Locate real home content from stable `data-feature="game-source"` semantics and collapse
  only guarded empty slots before it; asynchronously populated banners become visible again.
- Mark only repeated, aligned, computed-light full-width change-review rows with
  `.trskin-light-surface-inset`, while excluding Header, Composer, Markdown/Diff, media,
  Settings, and form controls.
- Expand and center Composer from main-surface safe bounds instead of retaining a narrow
  native rail. Cap it only when painted or interactive sidebar content reaches the Composer
  band; transparent pinned-summary shells no longer leave a bottom-right gutter. Measure
  dock width separately from the rail origin, settle through the full summary transition,
  and unclip the verified inner message-width host so the painted input reaches its 15px
  safe edge without toggling that owned marker between geometry passes. Remove only
  verified empty pointer-inert footer decorations.
- Share the renderer/CSS behavior with macOS and cover home slots, CSS Color 4 paints,
  review rows, Composer width, and cleanup in the cross-platform regression suite.

## 2.7.6 — manual environment music continuity

- Preserve the user's active music intent when a fixed-environment selection hot-replaces
  the renderer, so the newly selected environment starts its music without another click.
- Keep an explicit user pause across the same replacement and retain normal stop behavior
  when TRSkin is restored or disabled.
- Mirror the renderer contract on Windows and macOS and add a two-way hot-swap regression.

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

