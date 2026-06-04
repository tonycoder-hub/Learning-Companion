#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== Learning Companion morning offline check =="
echo

echo "== Web model smoke =="
npm run smoke
echo

echo "== HarmonyOS reader smoke =="
npm run smoke:harmony
echo

echo "== Capture resume receipt =="
npm run demo:capture-resume
echo

echo "== Patch intake negative receipt =="
npm run demo:patch-intake-negative
echo

echo "== Morning demo pack =="
npm run demo:morning
echo

echo "== Static return contract =="
npm run check:static-return
echo

echo "== Return file import dry-run =="
npm run demo:return-import-dry-run:smoke
echo

echo "== Morning receipt contracts =="
npm run morning:receipts
echo

echo "== Adversarial gate fixtures =="
npm run morning:adversarial
echo

echo "== Morning determinism =="
npm run morning:determinism
echo

echo "== Mirror integrity =="
npm run mirror:integrity
echo

echo "== Performance budget =="
npm run morning:perf
echo

echo "== Performance budget self-test =="
npm run morning:perf:selftest
echo

echo "== Git status =="
git status --short
echo

echo "morning_offline_check_ok"
