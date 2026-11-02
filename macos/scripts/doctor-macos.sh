#!/bin/bash

set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/common-macos.sh"

REQUIRE_LIVE="false"
PORT="${CODEX_DREAM_SKIN_PORT:-9341}"
PORT_EXPLICIT="false"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --require-live) REQUIRE_LIVE="true"; shift ;;
    --port) [ "$#" -ge 2 ] || fail '--port requires a value'; PORT="$2"; PORT_EXPLICIT="true"; shift 2 ;;
    *) fail "Unknown doctor argument: $1" ;;
  esac
done

discover_codex_app
require_macos_runtime
[ -f "$CONFIG_PATH" ] || fail "Codex config not found: $CONFIG_PATH"
for required in \
  "$PROJECT_ROOT/assets/dream-skin.css" \
  "$PROJECT_ROOT/assets/renderer-inject.js" \
  "$PROJECT_ROOT/assets/theme.json" \
  "$PROJECT_ROOT/scripts/injector.mjs"; do
  [ -s "$required" ] || fail "Required project file is missing or empty: $required"
done

PAYLOAD_JSON="$("$NODE" "$INJECTOR" --check-payload --theme-dir "$THEME_DIR")"
if [ "$PORT_EXPLICIT" = "false" ] && [ "${CODEX_DREAM_SKIN_PORT:-}" = "" ] && [ -f "$STATE_PATH" ]; then
  saved_port="$(state_field port 2>/dev/null || true)"
  [ -z "$saved_port" ] || PORT="$saved_port"
fi
case "$PORT" in ''|*[!0-9]*) fail 'Port must be 1–65535' ;; esac
[ "$PORT" -ge 1 ] && [ "$PORT" -le 65535 ] || fail 'Port must be 1–65535'
LIVE="false"
if verified_cdp_endpoint "$PORT"; then
  "$NODE" "$INJECTOR" --verify --port "$PORT" --theme-dir "$THEME_DIR" --timeout-ms 12000 >/dev/null
  LIVE="true"
fi
[ "$REQUIRE_LIVE" = "false" ] || [ "$LIVE" = "true" ] || fail "No verified live Dream Skin session is active."

"$NODE" -e '
  const payload = JSON.parse(process.argv[1]);
  const result = {
    pass: true,
    product: "Codex Dream Skin Studio",
    version: process.argv[2],
    platform: `darwin-${process.argv[3]}`,
    codexVersion: process.argv[4],
    codexTeamId: process.argv[5],
    nodeVersion: process.argv[6],
    officialAppSignatureValid: true,
    modifiesAppAsar: false,
    live: process.argv[7] === "true",
    port: Number(process.argv[8]),
    theme: {
      id: payload.themeId,
      name: payload.themeName,
      imageBytes: payload.imageBytes,
      payloadBytes: payload.payloadBytes,
    },
  };
  console.log(JSON.stringify(result, null, 2));
' "$PAYLOAD_JSON" "$SKIN_VERSION" "$(macos_hardware_arch)" "$CODEX_VERSION" "$CODEX_TEAM_ID" "$NODE_VERSION" "$LIVE" "$PORT"
