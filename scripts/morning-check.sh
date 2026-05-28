#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== Learning Companion morning check =="
echo

echo "== Web model smoke =="
npm run smoke
echo

echo "== Browser UX smoke =="
npm run smoke:browser
echo

echo "== Mac shell build =="
npm run mac:build
echo

echo "== Morning demo pack =="
npm run demo:morning
echo

echo "== Git status =="
git status --short
echo

echo "morning_check_ok"
