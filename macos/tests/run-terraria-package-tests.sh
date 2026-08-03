#!/bin/bash

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
NODE="${NODE:-$(command -v node || true)}"
[ -n "$NODE" ] || { printf 'Node.js is required for package source tests.\n' >&2; exit 1; }

for script in "$ROOT"/*.command "$ROOT"/scripts/*.sh; do
  [ -f "$script" ] || continue
  /bin/bash -n "$script"
done
for module in "$ROOT"/scripts/*.mjs; do
  [ -f "$module" ] || continue
  "$NODE" --check "$module"
done

for test_file in \
  image-metadata.test.mjs \
  injector-bootstrap.test.mjs \
  renderer-inject.test.mjs \
  theme-stage.test.mjs \
  terraria-companions.test.mjs; do
  "$NODE" "$ROOT/tests/$test_file"
done

"$NODE" "$ROOT/scripts/injector.mjs" --check-payload \
  --theme-dir "$ROOT/local-presets/preset-terraria-random" >/dev/null

printf 'PASS: Terraria repository-layout package source tests.\n'
