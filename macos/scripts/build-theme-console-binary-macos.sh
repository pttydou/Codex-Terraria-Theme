#!/bin/bash

# Build the native AppKit console. On Apple Silicon, try to create a universal
# binary for redistribution; otherwise fall back to the current architecture.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
SOURCE="$ROOT/control-app/CodexThemeConsole.swift"
OUTPUT="${1:-}"

[ -n "$OUTPUT" ] || {
  /usr/bin/printf 'Usage: build-theme-console-binary-macos.sh <output-binary>\n' >&2
  exit 64
}
[ -f "$SOURCE" ] || {
  /usr/bin/printf 'Native control-panel source is missing: %s\n' "$SOURCE" >&2
  exit 1
}
[ -x /usr/bin/swiftc ] || {
  /usr/bin/printf 'The macOS Swift compiler is unavailable.\n' >&2
  exit 1
}

stage="$(/usr/bin/mktemp -d /tmp/codex-theme-console-build.XXXXXX)"
cleanup() { /bin/rm -rf "$stage"; }
trap cleanup EXIT

compile_arch() {
  local arch="$1"
  local destination="$2"
  /usr/bin/swiftc -O \
    -target "${arch}-apple-macos12.0" \
    -framework AppKit \
    -framework QuartzCore \
    "$SOURCE" \
    -o "$destination"
}

hardware_arch="$(/usr/bin/uname -m)"
if [ "$hardware_arch" = "arm64" ] \
  && compile_arch arm64 "$stage/console-arm64" \
  && compile_arch x86_64 "$stage/console-x86_64"; then
  /usr/bin/lipo -create \
    "$stage/console-arm64" "$stage/console-x86_64" \
    -output "$stage/CodexThemeConsole"
else
  compile_arch "$hardware_arch" "$stage/CodexThemeConsole"
fi

/bin/mkdir -p "$(/usr/bin/dirname "$OUTPUT")"
/bin/cp "$stage/CodexThemeConsole" "$OUTPUT"
/bin/chmod 700 "$OUTPUT"
/usr/bin/printf 'Built native theme console: %s\n' "$OUTPUT"
