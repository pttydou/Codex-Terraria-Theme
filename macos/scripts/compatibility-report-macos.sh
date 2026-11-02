#!/bin/bash

set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/common-macos.sh"

PORT="${CODEX_DREAM_SKIN_PORT:-9341}"
PORT_EXPLICIT="false"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --port) PORT="${2:-}"; PORT_EXPLICIT="true"; shift 2 ;;
    --timeout-ms) TIMEOUT_MS="${2:-}"; shift 2 ;;
    *) fail "Unknown compatibility report argument: $1" ;;
  esac
done

TIMEOUT_MS="${TIMEOUT_MS:-10000}"
discover_codex_app
require_macos_runtime
if [ "$PORT_EXPLICIT" = "false" ] && [ -f "$STATE_PATH" ] && [ "${CODEX_DREAM_SKIN_PORT:-}" = "" ]; then
  saved_port="$(state_field port 2>/dev/null || true)"
  case "$saved_port" in
    ''|*[!0-9]*) ;;
    *) PORT="$saved_port" ;;
  esac
fi
verified_cdp_endpoint "$PORT" || fail "Port $PORT is not a verified Codex loopback CDP endpoint."

exec "$NODE" "$INJECTOR" --compatibility-report --port "$PORT" \
  --theme-dir "$THEME_DIR" --timeout-ms "$TIMEOUT_MS"
