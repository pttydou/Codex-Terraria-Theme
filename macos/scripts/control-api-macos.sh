#!/bin/bash

# Non-interactive bridge used by the native control panel. Keep every command
# allowlisted so UI strings and imported paths are passed as argv, never eval.

set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/common-macos.sh"

usage() {
  /usr/bin/printf '%s\n' \
    'Usage:' \
    '  control-api-macos.sh snapshot' \
    '  control-api-macos.sh apply <official|random|environment-variant>' \
    '  control-api-macos.sh random-save <environment-minutes> <fixed|rotate> <background-minutes> [excluded-variant ...]' \
    '  control-api-macos.sh random-next' \
    '  control-api-macos.sh music-save <on|off> <volume> <sequential|random> <gap> <fade> <on|off> <immediate|after-current> <classic|otherworld|mixed> <rotate|fixed>' \
    '  control-api-macos.sh music-import <slot-id> <audio-file>'
}

COMMAND="${1:-}"
[ -n "$COMMAND" ] || { usage >&2; exit 64; }
shift

ensure_state_root

snapshot() {
  "$NODE" "$SCRIPT_DIR/control-state.mjs" \
    "$STATE_PATH" "$THEME_DIR/theme.json" "$RANDOM_POOL_CONFIG_PATH" \
    "$MUSIC_CONFIG_PATH" "$MUSIC_CATALOG_PATH"
}

# Snapshot is read-only and launches on every control-panel open. Resolve the
# already known bundled Node quickly; mutations below still perform the full
# Codex bundle/signature/runtime validation before touching state or CDP.
if [ "$COMMAND" = "snapshot" ]; then
  [ "$#" -eq 0 ] || fail "snapshot does not accept arguments."
  ensure_node_runtime
  snapshot
  exit 0
fi

discover_codex_app
require_macos_runtime

reapply_music_if_active() {
  local port="9341"
  local saved_port=""
  [ -f "$STATE_PATH" ] || return 0
  [ -f "$THEME_DIR/theme.json" ] || return 0
  codex_is_running || return 0
  saved_port="$(state_field port 2>/dev/null || true)"
  case "$saved_port" in
    ''|*[!0-9]*) ;;
    *) port="$saved_port" ;;
  esac
  verified_cdp_endpoint "$port" || return 0
  "$NODE" "$INJECTOR" --once --port "$port" --theme-dir "$THEME_DIR" \
    --timeout-ms 8000 >/dev/null
}

runtime_skin_command() {
  local port="9341"
  local saved_port=""
  [ -f "$STATE_PATH" ] || return 1
  [ -f "$THEME_DIR/theme.json" ] || return 1
  codex_is_running || return 1
  saved_port="$(state_field port 2>/dev/null || true)"
  case "$saved_port" in
    ''|*[!0-9]*) ;;
    *) port="$saved_port" ;;
  esac
  verified_cdp_endpoint "$port" || return 1
  "$NODE" "$INJECTOR" "$@" --port "$port" --timeout-ms 8000 >/dev/null
}

case "$COMMAND" in
  apply)
    [ "$#" -eq 1 ] || fail "apply requires exactly one theme variant."
    exec "$SCRIPT_DIR/theme-console-macos.sh" --choice "$1"
    ;;
  random-save)
    [ "$#" -ge 3 ] || fail "random-save requires environment interval, background mode, and background interval."
    interval_minutes="$1"
    background_mode="$2"
    background_minutes="$3"
    shift 3
    case "$interval_minutes" in
      ''|*[!0-9]*) fail "Random environment interval must be a whole number from 1 to 60 minutes." ;;
    esac
    [ "$interval_minutes" -ge 1 ] && [ "$interval_minutes" -le 60 ] \
      || fail "Random environment interval must be from 1 to 60 minutes."
    case "$background_mode" in
      fixed|rotate) ;;
      *) fail "Background mode must be fixed or rotate." ;;
    esac
    case "$background_minutes" in
      ''|*[!0-9]*) fail "Background interval must be a whole number from 1 to 60 minutes." ;;
    esac
    [ "$background_minutes" -ge 1 ] && [ "$background_minutes" -le 60 ] \
      || fail "Background interval must be from 1 to 60 minutes."
    interval_ms=$((interval_minutes * 60000))
    background_interval_ms=$((background_minutes * 60000))
    "$NODE" "$SCRIPT_DIR/random-pool-config.mjs" set \
      "$RANDOM_POOL_CONFIG_PATH" --interval-ms "$interval_ms" \
      --background-mode "$background_mode" \
      --background-interval-ms "$background_interval_ms" "$@" >/dev/null
    runtime_skin_command --runtime-random-config "$RANDOM_POOL_CONFIG_PATH" || true
    snapshot
    ;;
  random-next)
    [ "$#" -eq 0 ] || fail "random-next does not accept arguments."
    runtime_skin_command --runtime-next-environment \
      || fail "Open Codex with the all-environment random skin before switching environments."
    snapshot
    ;;
  music-save)
    [ "$#" -eq 9 ] || fail "music-save requires exactly nine setting values."
    "$NODE" "$SCRIPT_DIR/music-config.mjs" set-settings \
      "$MUSIC_CONFIG_PATH" "$@" >/dev/null
    reapply_music_if_active
    snapshot
    ;;
  music-import)
    [ "$#" -eq 2 ] || fail "music-import requires a slot id and a local audio file."
    "$NODE" "$SCRIPT_DIR/music-config.mjs" import \
      "$MUSIC_CONFIG_PATH" "$MUSIC_LIBRARY_ROOT" "$MUSIC_CATALOG_PATH" \
      "$1" "$2" >/dev/null
    "$NODE" "$SCRIPT_DIR/music-config.mjs" set-enabled "$MUSIC_CONFIG_PATH" on >/dev/null
    reapply_music_if_active
    snapshot
    ;;
  *)
    usage >&2
    fail "Unknown control API command: $COMMAND"
    ;;
esac
