# TRSkin handoff

## Current release line

- Planned version: `2.7.2`
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

