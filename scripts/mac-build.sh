#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

export CLANG_MODULE_CACHE_PATH="$PWD/apps/companion-mac/.build/clang-module-cache"
mkdir -p "$CLANG_MODULE_CACHE_PATH"

swift build --package-path apps/companion-mac
