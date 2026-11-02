#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd -P)"
exec "$ROOT/scripts/inspect-skin-macos.sh" --open
