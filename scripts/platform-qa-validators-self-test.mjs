#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = ".codex-tmp/platform-qa-validators-selftest";
const CASES = Object.freeze([
  {
    id: "mac",
    script: "scripts/validate-mac-manual-qa.mjs",
    qa: "dist/morning-demo/MAC_MANUAL_QA.md",
    schema: "learning-companion.mac-manual-qa-receipt.v1",
    claimKey: "canClaimMacManualQaUsable",
    claimableMessage: "Mac manual QA --require-claimable needs a full all-PASS real run"
  },
  {
    id: "windows",
    script: "scripts/validate-windows-static-qa.mjs",
    qa: "dist/morning-demo/WINDOWS_STATIC_QA.md",
    schema: "learning-companion.windows-static-qa-receipt.v1",
    claimKey: "canClaimWindowsStaticLoopUsable",
    claimableMessage: "Windows static QA --require-claimable needs a full all-PASS real run"
  },
  {
    id: "harmony",
    script: "scripts/validate-harmony-device-qa.mjs",
    qa: "dist/morning-demo/HARMONY_DEVICE_QA.md",
    schema: "learning-companion.harmony-device-qa-receipt.v1",
    claimKey: "canClaimHarmonyDeviceRoundtripUsable",
    claimableMessage: "HarmonyOS device QA --require-claimable needs a full all-PASS real run"
  }
]);

await mkdir(ROOT, { recursive: true, mode: 0o700 });
const RUN_ROOT = await mkdtemp(join(ROOT, "run-"));

for (const item of CASES) {
  await assertPendingMode(item);
  await assertClaimableModeRejectsPendingTemplate(item);
}

console.log("platform_qa_validators_selftest_ok");

async function assertPendingMode(item) {
  const outPath = join(RUN_ROOT, `${item.id}-pending.json`);
  const result = await runNode([
    item.script,
    "--qa",
    item.qa,
    "--out",
    outPath
  ]);
  assert.equal(result.code, 0, `${item.id} pending validator should pass: ${result.stderr}`);
  const receipt = await readReceipt(outPath);
  assert.equal(receipt.schema, item.schema, `${item.id} pending schema`);
  assert.equal(receipt.evidenceTier, "PENDING_USER_GATE", `${item.id} pending evidence tier`);
  assert.equal(receipt.summary?.ok, true, `${item.id} pending summary ok`);
  assert.equal(receipt.summary?.anyRealRowsFilled, false, `${item.id} pending should not have real rows`);
  assert.equal(receipt.claimBoundary?.[item.claimKey], false, `${item.id} pending must not claim platform QA`);
}

async function assertClaimableModeRejectsPendingTemplate(item) {
  const outPath = join(RUN_ROOT, `${item.id}-claimable-negative.json`);
  const result = await runNode([
    item.script,
    "--qa",
    item.qa,
    "--platform-handoff",
    ".codex-tmp/platform-qa-handoff/current.json",
    "--out",
    outPath,
    "--require-claimable"
  ]);
  assert.notEqual(result.code, 0, `${item.id} --require-claimable must reject pending templates`);
  assert.match(result.stderr, new RegExp(escapeRegExp(item.claimableMessage)), `${item.id} claimable rejection message`);
  const receipt = await readReceipt(outPath);
  assert.equal(receipt.schema, item.schema, `${item.id} claimable-negative schema`);
  // The claimable failure is a mode gate: the receipt must still prove the
  // underlying pending template was structurally valid and non-claiming.
  assert.equal(receipt.summary?.ok, true, `${item.id} claimable-negative receipt should remain structurally valid`);
  assert.equal(receipt.summary?.anyRealRowsFilled, false, `${item.id} claimable-negative should not have real rows`);
  assert.equal(receipt.claimBoundary?.[item.claimKey], false, `${item.id} claimable-negative must not claim platform QA`);
}

async function runNode(args) {
  try {
    const result = await execFileAsync(process.execPath, args, {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024
    });
    return {
      code: 0,
      stdout: result.stdout || "",
      stderr: result.stderr || ""
    };
  } catch (error) {
    return {
      code: Number.isInteger(error?.code) ? error.code : 1,
      stdout: error?.stdout || "",
      stderr: error?.stderr || String(error?.message || error)
    };
  }
}

async function readReceipt(path) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const text = await readFile(path, "utf8");
  assert.notEqual(text.trim(), "", `${path} must contain a receipt JSON object`);
  return JSON.parse(text);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
