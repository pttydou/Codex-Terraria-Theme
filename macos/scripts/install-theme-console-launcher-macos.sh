#!/bin/bash

# Install one managed macOS app for official/local-theme selection. The app is
# safe to pin to the Dock and replaces only launchers owned by this project.

set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/common-macos.sh"

APPLICATIONS_ROOT="$HOME/Applications"
DESKTOP_ROOT="$HOME/Desktop"
TARGET_APP="$APPLICATIONS_ROOT/Codex 皮肤控制台.app"
MANAGED_MARKER="CodexDreamSkinStudio launcher"
MANAGED_BUNDLE_ID="local.codex.dream-skin-studio.console"
LEGACY_LAUNCHERS=(
  "$DESKTOP_ROOT/Codex 皮肤控制台.command"
  "$DESKTOP_ROOT/Codex Dream Skin.command"
  "$DESKTOP_ROOT/Codex Dream Skin - Customize.command"
  "$DESKTOP_ROOT/Codex Dream Skin - Verify.command"
  "$DESKTOP_ROOT/Codex Dream Skin - Restore.command"
)

if [ -e "$TARGET_APP" ]; then
  target_plist="$TARGET_APP/Contents/Info.plist"
  target_bundle_id="$(/usr/bin/plutil -extract CFBundleIdentifier raw -o - "$target_plist" 2>/dev/null || true)"
  target_managed="$(/usr/bin/plutil -extract CodexDreamSkinStudioManaged raw -o - "$target_plist" 2>/dev/null || true)"
  if [ "$target_bundle_id" != "$MANAGED_BUNDLE_ID" ] || [ "$target_managed" != "true" ]; then
    fail "Refusing to overwrite an unrelated app: $TARGET_APP"
  fi
fi

/bin/mkdir -p "$APPLICATIONS_ROOT" "$DESKTOP_ROOT"
stage="$(/usr/bin/mktemp -d "$APPLICATIONS_ROOT/.codex-theme-console.XXXXXX")"
cleanup_stage() { /bin/rm -rf "$stage"; }
trap cleanup_stage EXIT

app_stage="$stage/Codex 皮肤控制台.app"
/bin/mkdir -p "$app_stage/Contents/MacOS" "$app_stage/Contents/Resources"

/usr/bin/printf '%s\n' \
  '<?xml version="1.0" encoding="UTF-8"?>' \
  '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">' \
  '<plist version="1.0">' \
  '<dict>' \
  '  <key>CFBundleDevelopmentRegion</key><string>zh_CN</string>' \
  '  <key>CFBundleDisplayName</key><string>Codex 皮肤控制台</string>' \
  '  <key>CFBundleExecutable</key><string>CodexThemeConsole</string>' \
  "  <key>CFBundleIdentifier</key><string>$MANAGED_BUNDLE_ID</string>" \
  '  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>' \
  '  <key>CFBundleName</key><string>Codex 皮肤控制台</string>' \
  '  <key>CFBundlePackageType</key><string>APPL</string>' \
  "  <key>CFBundleShortVersionString</key><string>$SKIN_VERSION</string>" \
  "  <key>CFBundleVersion</key><string>${SKIN_VERSION//./}</string>" \
  '  <key>LSMinimumSystemVersion</key><string>12.0</string>' \
  '  <key>LSArchitecturePriority</key><array><string>arm64</string><string>x86_64</string></array>' \
  '  <key>NSHighResolutionCapable</key><true/>' \
  '  <key>CodexDreamSkinStudioManaged</key><true/>' \
  '  <key>CFBundleIconFile</key><string>ThemeConsole.icns</string>' \
  '</dict>' \
  '</plist>' \
  > "$app_stage/Contents/Info.plist"

native_source="$PROJECT_ROOT/control-app/bin/CodexThemeConsole"
native_swift_source="$PROJECT_ROOT/control-app/CodexThemeConsole.swift"
native_target="$app_stage/Contents/MacOS/CodexThemeConsole"
native_payload="$app_stage/Contents/Resources/CodexThemeConsoleNative"
if [ -x "$native_source" ] \
  && { [ ! -f "$native_swift_source" ] || [ "$native_source" -nt "$native_swift_source" ]; }; then
  /bin/cp "$native_source" "$native_payload"
elif [ -x /usr/bin/swiftc ] \
  && "$SCRIPT_DIR/build-theme-console-binary-macos.sh" "$native_payload" >/dev/null 2>&1; then
  :
else
  /usr/bin/printf '%s\n' \
    '#!/bin/bash' \
    "# $MANAGED_MARKER" \
    'set -u' \
    'engine="${CODEX_DREAM_SKIN_ENGINE:-$HOME/.codex/codex-dream-skin-studio}"' \
    'console="$engine/scripts/theme-console-macos.sh"' \
    'log_root="$HOME/Library/Logs/CodexDreamSkinStudio"' \
    'log_path="$log_root/theme-console-app.log"' \
    '/bin/mkdir -p "$log_root"' \
    'show_alert() {' \
    '  /usr/bin/osascript - "$1" <<'"'"'APPLESCRIPT'"'"' >/dev/null 2>&1 || true' \
    'on run argv' \
    '  display alert "Codex 皮肤控制台" message (item 1 of argv)' \
    'end run' \
    'APPLESCRIPT' \
    '}' \
    'if [ ! -x "$console" ]; then' \
    '  show_alert "皮肤引擎未安装或入口已损坏。请重新运行安装程序。"' \
    '  exit 1' \
    'fi' \
    'if "$console" >> "$log_path" 2>&1; then' \
    '  exit 0' \
    'else' \
    '  status=$?' \
    'fi' \
    'if [ "$status" -ne 2 ]; then' \
    '  detail="$(/usr/bin/tail -n 8 "$log_path" 2>/dev/null || true)"' \
    '  [ -n "$detail" ] || detail="操作未完成，请重新打开控制台或恢复官方原版。"' \
    '  show_alert "$detail"' \
    'fi' \
    'exit "$status"' \
    > "$native_payload"
fi
/bin/chmod 700 "$native_payload"
/usr/bin/printf '%s\n' \
  '#!/bin/bash' \
  "# $MANAGED_MARKER" \
  'set -u' \
  'app_root="$(cd "$(dirname "$0")/.." && pwd -P)"' \
  'payload="$app_root/Resources/CodexThemeConsoleNative"' \
  'engine="${CODEX_DREAM_SKIN_ENGINE:-$HOME/.codex/codex-dream-skin-studio}"' \
  'updater="$engine/scripts/update-macos.sh"' \
  'log_root="$HOME/Library/Logs/CodexDreamSkinStudio"' \
  'log_path="$log_root/update.log"' \
  '/bin/mkdir -p "$log_root"' \
  'if [ -x "$updater" ]; then' \
  '  "$updater" --check-and-install >> "$log_path" 2>&1 || true' \
  'fi' \
  'if [ ! -x "$payload" ]; then' \
  '  /usr/bin/osascript -e '"'"'display alert "TR Skin" message "控制台文件不完整，请重新安装 TR Skin。" as warning'"'"' >/dev/null 2>&1 || true' \
  '  exit 1' \
  'fi' \
  'exec "$payload"' \
  > "$native_target"
/bin/chmod 700 "$native_target"
/usr/bin/plutil -lint "$app_stage/Contents/Info.plist" >/dev/null

icon_source="$PROJECT_ROOT/local-presets/preset-terraria-forest-day/theme-console.icns"
if [ -f "$icon_source" ]; then
  /bin/cp "$icon_source" "$app_stage/Contents/Resources/ThemeConsole.icns"
fi
copy_control_resource() {
  local source="$1"
  local destination="$2"
  [ -f "$source" ] || return 0
  /bin/cp "$source" "$app_stage/Contents/Resources/$destination"
}
copy_control_resource \
  "$PROJECT_ROOT/local-presets/preset-terraria-forest-day/background.png" \
  "ControlBackground.png"
copy_control_resource \
  "$PROJECT_ROOT/control-app/resources/EnvironmentCard.png" \
  "EnvironmentCard.png"
copy_control_resource \
  "$PROJECT_ROOT/control-app/resources/MusicCard.png" \
  "MusicCard.png"
copy_control_resource \
  "$PROJECT_ROOT/control-app/resources/RandomCard.png" \
  "RandomCard.png"
copy_control_resource \
  "$PROJECT_ROOT/control-app/resources/MagicMirror.png" \
  "MagicMirror.png"

/usr/bin/xattr -d com.apple.quarantine "$app_stage" 2>/dev/null || true
/usr/bin/codesign --force --sign - --timestamp=none "$app_stage" >/dev/null 2>&1 \
  || fail "Could not ad-hoc sign the local theme console app."
/usr/bin/codesign --verify --strict "$app_stage" >/dev/null 2>&1 \
  || fail "The local theme console app failed signature verification."
/bin/rm -rf "$TARGET_APP"
/bin/mv "$app_stage" "$TARGET_APP"
/usr/bin/touch "$TARGET_APP"

for legacy in "${LEGACY_LAUNCHERS[@]}"; do
  [ -e "$legacy" ] || continue
  if /usr/bin/grep -F -q "# $MANAGED_MARKER" "$legacy" 2>/dev/null; then
    /bin/rm -f "$legacy"
  fi
done

trap - EXIT
/bin/rm -rf "$stage"
/usr/bin/printf 'Installed the single Dock-ready theme app: %s\n' "$TARGET_APP"
