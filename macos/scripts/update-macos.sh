#!/bin/bash

set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/common-macos.sh"

UPDATE_REPOSITORY="pttydou/Codex-Terraria-Theme"
UPDATE_MANIFEST_URL="https://github.com/pttydou/Codex-Terraria-Theme/releases/latest/download/update-manifest.json"
UPDATE_CACHE_PATH="$STATE_ROOT/update-check.json"
UPDATE_CACHE_SECONDS=86400

manifest_value() {
  /usr/bin/plutil -extract "$2" raw -o - "$1" 2>/dev/null
}

version_at_least_update() {
  local installed="$1" available="$2" index left right
  for index in 1 2 3 4; do
    left="$(/usr/bin/printf '%s\n' "$installed" | /usr/bin/awk -F. -v i="$index" '{print ($i == "" ? 0 : $i)}')"
    right="$(/usr/bin/printf '%s\n' "$available" | /usr/bin/awk -F. -v i="$index" '{print ($i == "" ? 0 : $i)}')"
    [ "$left" -gt "$right" ] && return 0
    [ "$left" -lt "$right" ] && return 1
  done
  return 0
}

validate_update_manifest() {
  local file="$1" version tag commit platform_version name hash size
  /usr/bin/plutil -lint "$file" >/dev/null 2>&1 || return 1
  [ "$(manifest_value "$file" schemaVersion)" = "1" ] || return 1
  [ "$(manifest_value "$file" repository)" = "$UPDATE_REPOSITORY" ] || return 1
  version="$(manifest_value "$file" release.version)" || return 1
  tag="$(manifest_value "$file" release.tag)" || return 1
  commit="$(manifest_value "$file" release.sourceCommit)" || return 1
  platform_version="$(manifest_value "$file" platforms.macos.version)" || return 1
  name="$(manifest_value "$file" platforms.macos.update.name)" || return 1
  hash="$(manifest_value "$file" platforms.macos.update.sha256)" || return 1
  size="$(manifest_value "$file" platforms.macos.update.size)" || return 1
  case "$version" in ''|*[!0-9.]*|.*|*..*|*.) return 1 ;; esac
  case "$commit" in *[!a-f0-9]*|'') return 1 ;; esac
  case "$hash" in *[!a-f0-9]*|'') return 1 ;; esac
  case "$size" in ''|*[!0-9]*) return 1 ;; esac
  [ "${#commit}" -eq 40 ] && [ "${#hash}" -eq 64 ] || return 1
  [ "$tag" = "v$version" ] && [ "$platform_version" = "$version" ] || return 1
  [ "$name" = "TRSkin-macOS-Update-$version.zip" ] || return 1
  [ "$size" -gt 0 ] && [ "$size" -le 536870912 ]
}

refresh_update_manifest() {
  [ "${TRSKIN_DISABLE_UPDATE_CHECK:-0}" != "1" ] || return 1
  ensure_state_root
  local now modified temporary
  now="$(/bin/date +%s)"
  if [ -f "$UPDATE_CACHE_PATH" ] && validate_update_manifest "$UPDATE_CACHE_PATH"; then
    modified="$(/usr/bin/stat -f '%m' "$UPDATE_CACHE_PATH" 2>/dev/null || echo 0)"
    [ "$((now - modified))" -lt "$UPDATE_CACHE_SECONDS" ] && return 0
  fi
  temporary="$STATE_ROOT/.update-check.$$.$RANDOM.tmp"
  if ! /usr/bin/curl --fail --location --silent --show-error \
    --connect-timeout 4 --max-time 8 "$UPDATE_MANIFEST_URL" -o "$temporary"; then
    /bin/rm -f "$temporary"
    return 1
  fi
  if ! validate_update_manifest "$temporary"; then
    /bin/rm -f "$temporary"
    return 1
  fi
  /bin/chmod 600 "$temporary"
  /bin/mv -f "$temporary" "$UPDATE_CACHE_PATH"
}

install_available_update() {
  local manifest="$1" version tag commit name hash size work archive expanded package engine build_info actual
  version="$(manifest_value "$manifest" release.version)"
  tag="$(manifest_value "$manifest" release.tag)"
  commit="$(manifest_value "$manifest" release.sourceCommit)"
  name="$(manifest_value "$manifest" platforms.macos.update.name)"
  hash="$(manifest_value "$manifest" platforms.macos.update.sha256)"
  size="$(manifest_value "$manifest" platforms.macos.update.size)"
  work="$(/usr/bin/mktemp -d /tmp/trskin-update.XXXXXX)"
  archive="$work/$name"
  expanded="$work/expanded"
  cleanup_update() { /bin/rm -rf "$work"; }
  trap cleanup_update RETURN EXIT
  /usr/bin/curl --fail --location --show-error \
    --connect-timeout 8 --max-time 600 \
    "https://github.com/$UPDATE_REPOSITORY/releases/download/$tag/$name" -o "$archive"
  [ "$(/usr/bin/stat -f '%z' "$archive")" = "$size" ] || fail "The downloaded update size does not match its manifest."
  actual="$(/usr/bin/shasum -a 256 "$archive" | /usr/bin/awk '{print $1}')"
  [ "$actual" = "$hash" ] || fail "The downloaded update failed SHA-256 verification."
  /bin/mkdir -p "$expanded"
  /usr/bin/ditto -x -k "$archive" "$expanded"
  package="$expanded/TRSkin-macOS-$version"
  engine="$package/.codex-dream-skin-studio"
  build_info="$engine/BUILD-INFO.json"
  [ -x "$engine/scripts/install-dream-skin-macos.sh" ] && [ -f "$build_info" ] \
    || fail "The downloaded update package is incomplete."
  [ "$(/usr/bin/tr -d '[:space:]' < "$engine/VERSION")" = "$version" ] \
    || fail "The downloaded update VERSION does not match its manifest."
  [ "$(manifest_value "$build_info" repository)" = "$UPDATE_REPOSITORY" ] \
    && [ "$(manifest_value "$build_info" releaseVersion)" = "$version" ] \
    && [ "$(manifest_value "$build_info" sourceCommit)" = "$commit" ] \
    || fail "The downloaded update build identity does not match its manifest."
  "$engine/scripts/install-dream-skin-macos.sh" --runtime-only --no-launch
  trap - RETURN EXIT
  cleanup_update
}

check_and_install_update() {
  refresh_update_manifest || return 0
  local available response
  available="$(manifest_value "$UPDATE_CACHE_PATH" release.version)"
  version_at_least_update "$SKIN_VERSION" "$available" && return 0
  response="$(/usr/bin/osascript - "$available" <<'APPLESCRIPT' 2>/dev/null || true
on run argv
  display dialog "发现 TR Skin " & (item 1 of argv) & "。更新只替换程序文件，不会删除音乐、主题或设置。" with title "TR Skin 更新" buttons {"稍后", "下载并安装"} default button "下载并安装" cancel button "稍后"
  return button returned of result
end run
APPLESCRIPT
)"
  [ "$response" = "下载并安装" ] || return 0
  install_available_update "$UPDATE_CACHE_PATH"
  notify_user "TR Skin 已更新到 $available；音乐、主题和设置均已保留。"
}

case "${1:-}" in
  --check-and-install) check_and_install_update ;;
  *) /usr/bin/printf 'Usage: update-macos.sh --check-and-install\n' >&2; exit 64 ;;
esac
