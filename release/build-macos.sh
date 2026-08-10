#!/bin/bash

set -euo pipefail
VERSION="${1:-}"
OUTPUT_DIRECTORY="${2:-}"
SOURCE_COMMIT="${3:-}"
MUSIC_PACK="${4:-}"
case "$VERSION" in ''|*[!0-9.]*|.*|*..*|*.) printf 'Invalid version.\n' >&2; exit 64 ;; esac
case "$SOURCE_COMMIT" in *[!a-f0-9]*|'') printf 'A full source commit is required.\n' >&2; exit 64 ;; esac
[ "${#SOURCE_COMMIT}" -eq 40 ] || { printf 'A full source commit is required.\n' >&2; exit 64; }
[ -n "$OUTPUT_DIRECTORY" ] || { printf 'Output directory is required.\n' >&2; exit 64; }

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
ACTUAL_VERSION="$(/usr/bin/tr -d '[:space:]' < "$ROOT/macos/VERSION")"
[ "$ACTUAL_VERSION" = "$VERSION" ] || { printf 'macOS VERSION does not match %s.\n' "$VERSION" >&2; exit 1; }
/bin/mkdir -p "$OUTPUT_DIRECTORY"
OUTPUT_DIRECTORY="$(cd "$OUTPUT_DIRECTORY" && pwd -P)"
WORK="$(/usr/bin/mktemp -d /tmp/trskin-release.XXXXXX)"
cleanup() { /bin/rm -rf "$WORK"; }
trap cleanup EXIT

stage_package() {
  local destination="$1"
  local package_root="$destination/TRSkin-macOS-$VERSION"
  local engine="$package_root/.codex-dream-skin-studio"
  /bin/mkdir -p "$engine"
  /usr/bin/rsync -a --exclude '.DS_Store' --exclude 'control-app/bin/' "$ROOT/macos/" "$engine/"
  /bin/chmod 755 "$engine"/*.command "$engine"/scripts/*.sh 2>/dev/null || true
  /bin/mkdir -p "$engine/control-app/bin"
  "$engine/scripts/build-theme-console-binary-macos.sh" "$engine/control-app/bin/CodexThemeConsole"
  "$engine/scripts/build-one-click-client-app-macos.sh" "$package_root/START-CODEX-TERRARIA.app"
  /usr/bin/printf '%s\n' \
    "TRSkin $VERSION" \
    '' \
    '双击 START-CODEX-TERRARIA.app 安装或打开控制台。' \
    '程序更新不会删除 ~/Library/Application Support/CodexDreamSkinStudio 中的音乐、主题和设置。' \
    > "$package_root/README.txt"
  /usr/bin/printf '{\n  "schemaVersion": 1,\n  "repository": "pttydou/Codex-Terraria-Theme",\n  "releaseVersion": "%s",\n  "sourceCommit": "%s",\n  "builder": "GitHub Actions"\n}\n' \
    "$VERSION" "$SOURCE_COMMIT" > "$engine/BUILD-INFO.json"
}

UPDATE_STAGE="$WORK/update"
stage_package "$UPDATE_STAGE"
/usr/bin/ditto -c -k --sequesterRsrc --keepParent \
  "$UPDATE_STAGE/TRSkin-macOS-$VERSION" "$OUTPUT_DIRECTORY/TRSkin-macOS-Update-$VERSION.zip"

if [ -n "$MUSIC_PACK" ]; then
  [ -f "$MUSIC_PACK" ] || { printf 'Music Pack not found: %s\n' "$MUSIC_PACK" >&2; exit 1; }
  FULL_STAGE="$WORK/full"
  /usr/bin/ditto "$UPDATE_STAGE" "$FULL_STAGE"
  MUSIC_STAGE="$WORK/music"
  /bin/mkdir -p "$MUSIC_STAGE"
  /usr/bin/ditto -x -k "$MUSIC_PACK" "$MUSIC_STAGE"
  [ -d "$MUSIC_STAGE/TRSkin/core/bundled-music" ] || { printf 'Music Pack layout is invalid.\n' >&2; exit 1; }
  ENGINE="$FULL_STAGE/TRSkin-macOS-$VERSION/.codex-dream-skin-studio"
  /bin/cp -R "$MUSIC_STAGE/TRSkin/core/bundled-music" "$ENGINE/"
  /bin/cp "$MUSIC_STAGE/TRSkin/core/bundled-music.json" "$ENGINE/"
  /usr/bin/ditto -c -k --sequesterRsrc --keepParent \
    "$FULL_STAGE/TRSkin-macOS-$VERSION" "$OUTPUT_DIRECTORY/TRSkin-macOS-$VERSION.zip"
fi
