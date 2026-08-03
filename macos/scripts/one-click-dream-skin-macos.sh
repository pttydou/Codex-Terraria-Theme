#!/bin/bash

# Single macOS package entry. Install or upgrade when needed; otherwise open
# the managed native control panel without touching a running Codex task.

set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/common-macos.sh"

INSTALLED_APP="$HOME/Applications/Codex 皮肤控制台.app"
INSTALLED_CONSOLE="$INSTALL_ROOT/scripts/theme-console-macos.sh"
VERIFY_INSTALLED_RUNTIME="false"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --verify-installed-runtime) VERIFY_INSTALLED_RUNTIME="true"; shift ;;
    *) fail "Unknown one-click argument: $1" ;;
  esac
done

read_version() {
  local path="$1"
  [ -f "$path" ] || return 1
  local value
  value="$(/usr/bin/tr -d '[:space:]' < "$path")"
  case "$value" in
    ''|*[!0-9.]*|.*|*..*|*.) return 1 ;;
  esac
  /usr/bin/printf '%s\n' "$value"
}

version_at_least() {
  local installed="$1"
  local bundled="$2"
  local installed_part bundled_part
  local index
  for index in 1 2 3 4; do
    installed_part="$(/usr/bin/printf '%s\n' "$installed" | /usr/bin/awk -F. -v i="$index" '{print ($i == "" ? 0 : $i)}')"
    bundled_part="$(/usr/bin/printf '%s\n' "$bundled" | /usr/bin/awk -F. -v i="$index" '{print ($i == "" ? 0 : $i)}')"
    [ "$installed_part" -gt "$bundled_part" ] && return 0
    [ "$installed_part" -lt "$bundled_part" ] && return 1
  done
  return 0
}

running_from_managed_engine() {
  [ -d "$INSTALL_ROOT" ] || return 1
  [ "$PROJECT_ROOT" = "$(cd "$INSTALL_ROOT" && pwd -P)" ]
}

open_installed_console() {
  if [ -d "$INSTALLED_APP" ]; then
    /usr/bin/open "$INSTALLED_APP"
    return 0
  fi
  [ -x "$INSTALLED_CONSOLE" ] ||
    fail "The installed control panel is incomplete. Run this entry from a complete newer package."
  exec "$INSTALLED_CONSOLE"
}

confirm_codex_close() {
  /usr/bin/osascript <<'APPLESCRIPT' 2>/dev/null
try
  display dialog "首次安装或升级需要关闭一次 Codex，未发送的输入可能丢失。是否继续？" with title "Codex Terraria 皮肤" buttons {"取消", "关闭 Codex 并继续"} default button "关闭 Codex 并继续" cancel button "取消" with icon caution
  return "continue"
on error number -128
  return "cancel"
end try
APPLESCRIPT
}

BUNDLED_VERSION="$(read_version "$PROJECT_ROOT/VERSION")" ||
  fail "The package VERSION file is missing or invalid."
[ "$BUNDLED_VERSION" = "$SKIN_VERSION" ] ||
  fail "The package VERSION does not match its runtime identity."
INSTALLED_VERSION="$(read_version "$INSTALL_ROOT/VERSION" 2>/dev/null || true)"
INSTALLED_COMPLETE="false"
if [ -x "$INSTALLED_CONSOLE" ] &&
  [ -x "$INSTALL_ROOT/scripts/common-macos.sh" ] &&
  [ -x "$INSTALL_ROOT/scripts/one-click-dream-skin-macos.sh" ] &&
  [ -x "$INSTALL_ROOT/scripts/install-dream-skin-macos.sh" ]; then
  INSTALLED_COMPLETE="true"
fi

if [ "$VERIFY_INSTALLED_RUNTIME" = "true" ]; then
  running_from_managed_engine ||
    fail "Installed-runtime verification must run from the managed engine."
  [ "$INSTALLED_COMPLETE" = "true" ] &&
    [ -n "$INSTALLED_VERSION" ] &&
    [ "$INSTALLED_VERSION" = "$BUNDLED_VERSION" ] ||
    fail "The installed control engine is incomplete or has an inconsistent VERSION."
  /usr/bin/printf 'PASS: installed macOS one-click runtime %s is complete and source-independent.\n' \
    "$INSTALLED_VERSION"
  exit 0
fi

if running_from_managed_engine; then
  open_installed_console
fi

if [ "$INSTALLED_COMPLETE" = "true" ] &&
  [ -n "$INSTALLED_VERSION" ] &&
  version_at_least "$INSTALLED_VERSION" "$BUNDLED_VERSION"; then
  if [ ! -d "$INSTALLED_APP" ]; then
    "$INSTALL_ROOT/scripts/install-theme-console-launcher-macos.sh"
  fi
  open_installed_console
fi

discover_codex_app
require_macos_runtime
if codex_is_running; then
  confirmation="$(confirm_codex_close || /usr/bin/printf 'cancel\n')"
  [ "$confirmation" = "continue" ] || exit 0
  stop_codex true
fi

exec "$PROJECT_ROOT/scripts/install-dream-skin-macos.sh"
