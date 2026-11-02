#!/bin/bash
# Resolve Node before entering the report runner. App/CDP failures are recorded
# by the runner, rather than aborting this launcher before a report can be saved.
set -euo pipefail
. "$(cd "$(dirname "$0")" && pwd -P)/common-macos.sh"
ensure_node_runtime
exec "$NODE" "$SCRIPT_DIR/inspect-skin.mjs" "$@"
