#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== Learning Companion morning browser check =="
echo

echo "== Browser UX smoke =="
npm run smoke:browser
echo

echo "morning_browser_check_ok"
