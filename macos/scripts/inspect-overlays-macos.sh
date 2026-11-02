#!/bin/bash
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/common-macos.sh"
ensure_node_runtime
exec "$NODE" "$SCRIPT_DIR/inspect-overlays.mjs" "$@"
