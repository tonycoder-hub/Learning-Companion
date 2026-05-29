#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== Learning Companion morning native check =="
echo

echo "== Mac shell build =="
npm run mac:build
echo

echo "morning_native_check_ok"
