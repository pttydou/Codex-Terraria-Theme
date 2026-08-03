#!/bin/bash

set -euo pipefail

TARGET_APP="${1:-}"
ENGINE_DIRECTORY_NAME="${2:-.codex-dream-skin-studio}"
[ -n "$TARGET_APP" ] || {
  /usr/bin/printf 'Usage: build-one-click-client-app-macos.sh <target.app> [engine-directory-name]\n' >&2
  exit 64
}

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
VERSION="$(/usr/bin/tr -d '[:space:]' < "$ROOT/VERSION")"
STAGE="${TARGET_APP}.building.$$"
/bin/rm -rf "$STAGE"
cleanup() {
  /bin/rm -rf "$STAGE"
}
trap cleanup EXIT

/bin/mkdir -p "$STAGE/Contents/MacOS" "$STAGE/Contents/Resources"
/usr/bin/printf '%s\n' \
  '<?xml version="1.0" encoding="UTF-8"?>' \
  '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">' \
  '<plist version="1.0">' \
  '<dict>' \
  '  <key>CFBundleDevelopmentRegion</key><string>zh_CN</string>' \
  '  <key>CFBundleDisplayName</key><string>启动 Codex Terraria 皮肤</string>' \
  '  <key>CFBundleExecutable</key><string>StartCodexTerraria</string>' \
  '  <key>CFBundleIdentifier</key><string>local.codex.dream-skin-studio.one-click</string>' \
  '  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>' \
  '  <key>CFBundleName</key><string>START-CODEX-TERRARIA</string>' \
  '  <key>CFBundlePackageType</key><string>APPL</string>' \
  "  <key>CFBundleShortVersionString</key><string>$VERSION</string>" \
  "  <key>CFBundleVersion</key><string>${VERSION//./}</string>" \
  '  <key>CFBundleIconFile</key><string>ThemeConsole.icns</string>' \
  '  <key>LSMinimumSystemVersion</key><string>12.0</string>' \
  '  <key>LSUIElement</key><true/>' \
  '  <key>NSHighResolutionCapable</key><true/>' \
  '</dict>' \
  '</plist>' \
  > "$STAGE/Contents/Info.plist"

/usr/bin/printf '%s\n' \
  '#!/bin/bash' \
  'set -u' \
  'package_root="$(cd "$(dirname "$0")/../../.." && pwd -P)"' \
  "engine=\"\$package_root/$ENGINE_DIRECTORY_NAME\"" \
  'entry="$engine/scripts/one-click-dream-skin-macos.sh"' \
  'log_root="$HOME/Library/Logs/CodexDreamSkinStudio"' \
  'log_path="$log_root/one-click.log"' \
  '/bin/mkdir -p "$log_root"' \
  'show_alert() {' \
  '  /usr/bin/osascript - "$1" <<'"'"'APPLESCRIPT'"'"' >/dev/null 2>&1 || true' \
  'on run argv' \
  '  display alert "Codex Terraria 皮肤" message (item 1 of argv) as warning' \
  'end run' \
  'APPLESCRIPT' \
  '}' \
  'if [ ! -x "$entry" ]; then' \
  '  show_alert "安装包不完整。请完整解压 ZIP，不要只拖出这个 App。"' \
  '  exit 1' \
  'fi' \
  'if "$entry" >> "$log_path" 2>&1; then' \
  '  exit 0' \
  'fi' \
  'status=$?' \
  'detail="$(/usr/bin/tail -n 10 "$log_path" 2>/dev/null || true)"' \
  '[ -n "$detail" ] || detail="启动未完成，请查看包内安全指南后重试。"' \
  'show_alert "$detail"' \
  'exit "$status"' \
  > "$STAGE/Contents/MacOS/StartCodexTerraria"

/bin/chmod 755 "$STAGE/Contents/MacOS/StartCodexTerraria"
/usr/bin/plutil -lint "$STAGE/Contents/Info.plist" >/dev/null
ICON_SOURCE="$ROOT/local-presets/preset-terraria-forest-day/theme-console.icns"
[ ! -f "$ICON_SOURCE" ] ||
  /bin/cp "$ICON_SOURCE" "$STAGE/Contents/Resources/ThemeConsole.icns"
/usr/bin/xattr -cr "$STAGE"
/usr/bin/codesign --force --sign - --timestamp=none "$STAGE" >/dev/null 2>&1
/usr/bin/codesign --verify --strict "$STAGE" >/dev/null 2>&1
/bin/rm -rf "$TARGET_APP"
/bin/mv "$STAGE" "$TARGET_APP"
trap - EXIT
