#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { platformQaEvidenceFileErrors } from "./lib/platform-qa-evidence-files.mjs";

const execFileAsync = promisify(execFile);
const ROOT = ".codex-tmp/platform-qa-validators-selftest";
const PNG_1X1 = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c636000000200015d0b2a0b0000000049454e44ae426082", "hex");
const CASES = Object.freeze([
  {
    id: "mac",
    script: "scripts/validate-mac-manual-qa.mjs",
    qa: "dist/morning-demo/MAC_MANUAL_QA.md",
    schema: "learning-companion.mac-manual-qa-receipt.v1",
    claimKey: "canClaimMacManualQaUsable",
    requiredFilledField: "macOS version",
    claimableMessage: "Mac manual QA --require-claimable needs a full all-PASS real run"
  },
  {
    id: "windows",
    script: "scripts/validate-windows-static-qa.mjs",
    qa: "dist/morning-demo/WINDOWS_STATIC_QA.md",
    schema: "learning-companion.windows-static-qa-receipt.v1",
    claimKey: "canClaimWindowsStaticLoopUsable",
    requiredFilledField: "Windows browser/device",
    claimableMessage: "Windows static QA --require-claimable needs a full all-PASS real run"
  },
  {
    id: "harmony",
    script: "scripts/validate-harmony-device-qa.mjs",
    qa: "dist/morning-demo/HARMONY_DEVICE_QA.md",
    schema: "learning-companion.harmony-device-qa-receipt.v1",
    claimKey: "canClaimHarmonyDeviceRoundtripUsable",
    requiredFilledField: "HarmonyOS device/build",
    claimableMessage: "HarmonyOS device QA --require-claimable needs a full all-PASS real run"
  }
]);

await mkdir(ROOT, { recursive: true, mode: 0o700 });
const RUN_ROOT = await mkdtemp(join(ROOT, "run-"));

await assertPlatformQaEvidenceFileBinding();
for (const item of CASES) {
  await assertPendingMode(item);
  await assertClaimableModeRejectsPendingTemplate(item);
  await assertFilledRowsRequirePlatformHandoff(item);
}

console.log("platform_qa_validators_selftest_ok");

async function assertPlatformQaEvidenceFileBinding() {
  const gitHead = "0123456789abcdef0123456789abcdef01234567";
  const evidenceDir = `.codex-tmp/platform-qa-evidence/selftest/${RUN_ROOT.split("/").at(-1)}/nativeMacManualQa/${gitHead}/01-launch`;
  const notesPath = `${evidenceDir}/notes.md`;
  const screenshotPath = `${evidenceDir}/screenshot.png`;
  const handoffPath = join(RUN_ROOT, "platform-qa-handoff.json");
  await mkdir(evidenceDir, { recursive: true, mode: 0o700 });
  await writeFile(notesPath, [
    "# Row 1 Launch",
    "",
    "- Result: PASS",
    "- Observed summary: The native Mac app launched from the named build.",
    "- Reviewer: Self Test",
    "- Date/time: 2026-06-24T08:00:00+08:00",
    "- Device/build/browser: Self-test Mac",
    ""
  ].join("\n"));
  await writeFile(screenshotPath, PNG_1X1);
  const binding = {
    handoffPath
  };
  await writeJson(handoffPath, {
    schema: "learning-companion.platform-qa-handoff.v1",
    evidenceTier: "PLATFORM_QA_HANDOFF_ONLY",
    canClaimKo: false,
    platforms: [
      {
        id: "nativeMacManualQa",
        currentTemplateSummary: {
          rowEvidenceHints: [
            {
              row: 1,
              area: "Launch",
              evidenceDir
            }
          ]
        }
      }
    ]
  });
  assert.deepEqual(platformQaEvidenceFileErrors({
    rows: [{ area: "Launch", result: "PASS", notes: `evidence: ${notesPath}; screenshot: ${screenshotPath}; result: PASS; observed: launch succeeded` }],
    platformHandoffBinding: binding,
    platformId: "nativeMacManualQa",
    label: "Mac manual QA"
  }), []);
  assert.ok(platformQaEvidenceFileErrors({
    rows: [{ area: "Launch", result: "PASS", notes: `evidence: ${notesPath}; result: PASS; observed: launch succeeded` }],
    platformHandoffBinding: binding,
    platformId: "nativeMacManualQa",
    label: "Mac manual QA"
  }).some((error) => error.includes("must reference row-specific evidence screenshot")));
  await rm(screenshotPath, { force: true });
  assert.ok(platformQaEvidenceFileErrors({
    rows: [{ area: "Launch", result: "PASS", notes: `evidence: ${notesPath}; screenshot: ${screenshotPath}; result: PASS; observed: launch succeeded` }],
    platformHandoffBinding: binding,
    platformId: "nativeMacManualQa",
    label: "Mac manual QA"
  }).some((error) => error.includes("evidence screenshot missing")));
  await writeFile(screenshotPath, "");
  assert.ok(platformQaEvidenceFileErrors({
    rows: [{ area: "Launch", result: "PASS", notes: `evidence: ${notesPath}; screenshot: ${screenshotPath}; result: PASS; observed: launch succeeded` }],
    platformHandoffBinding: binding,
    platformId: "nativeMacManualQa",
    label: "Mac manual QA"
  }).some((error) => error.includes("evidence screenshot file must not be empty")));
  await writeFile(screenshotPath, "not a png\n");
  assert.ok(platformQaEvidenceFileErrors({
    rows: [{ area: "Launch", result: "PASS", notes: `evidence: ${notesPath}; screenshot: ${screenshotPath}; result: PASS; observed: launch succeeded` }],
    platformHandoffBinding: binding,
    platformId: "nativeMacManualQa",
    label: "Mac manual QA"
  }).some((error) => error.includes("evidence screenshot file must be a PNG")));
  await writeFile(screenshotPath, PNG_1X1);
  assert.ok(platformQaEvidenceFileErrors({
    rows: [{ area: "Launch", result: "PASS", notes: "launch succeeded" }],
    platformHandoffBinding: binding,
    platformId: "nativeMacManualQa",
    label: "Mac manual QA"
  }).some((error) => error.includes("must reference row-specific evidence notes")));
  await writeFile(notesPath, "TEMPLATE ONLY - replace before use. This file is not QA evidence.\n");
  assert.ok(platformQaEvidenceFileErrors({
    rows: [{ area: "Launch", result: "PASS", notes: `evidence: ${notesPath}; screenshot: ${screenshotPath}; result: PASS; observed: launch succeeded` }],
    platformHandoffBinding: binding,
    platformId: "nativeMacManualQa",
    label: "Mac manual QA"
  }).some((error) => error.includes("still scaffold template")));
  await writeFile(notesPath, [
    "# Row 1 Launch",
    "",
    "- Result: FAIL",
    "- Observed summary: The native Mac app launched from the named build.",
    "- Reviewer: Self Test",
    "- Date/time: 2026-06-24T08:00:00+08:00",
    "- Device/build/browser: Self-test Mac",
    ""
  ].join("\n"));
  assert.ok(platformQaEvidenceFileErrors({
    rows: [{ area: "Launch", result: "PASS", notes: `evidence: ${notesPath}; screenshot: ${screenshotPath}; result: PASS; observed: launch succeeded` }],
    platformHandoffBinding: binding,
    platformId: "nativeMacManualQa",
    label: "Mac manual QA"
  }).some((error) => error.includes("Result must match row result PASS")));
  await writeFile(notesPath, [
    "# Row 1 Launch",
    "",
    "- Result: PASS",
    "- Reviewer: Self Test",
    "- Date/time: 2026-06-24T08:00:00+08:00",
    "- Device/build/browser: Self-test Mac",
    ""
  ].join("\n"));
  assert.ok(platformQaEvidenceFileErrors({
    rows: [{ area: "Launch", result: "PASS", notes: `evidence: ${notesPath}; screenshot: ${screenshotPath}; result: PASS; observed: launch succeeded` }],
    platformHandoffBinding: binding,
    platformId: "nativeMacManualQa",
    label: "Mac manual QA"
  }).some((error) => error.includes("must include a concrete Observed summary")));
  await writeFile(notesPath, [
    "# Row 1 Launch",
    "",
    "- Result: PASS",
    "- Observed summary: The native Mac app launched from the named build.",
    "- Reviewer: TBD",
    "- Date/time: 2026-06-24T08:00:00+08:00",
    "- Device/build/browser: Self-test Mac",
    ""
  ].join("\n"));
  assert.ok(platformQaEvidenceFileErrors({
    rows: [{ area: "Launch", result: "PASS", notes: `evidence: ${notesPath}; screenshot: ${screenshotPath}; result: PASS; observed: launch succeeded` }],
    platformHandoffBinding: binding,
    platformId: "nativeMacManualQa",
    label: "Mac manual QA"
  }).some((error) => error.includes("must include a concrete Reviewer")));
  await writeFile(notesPath, [
    "# Row 1 Launch",
    "",
    "- Result: PASS",
    "- Observed summary: The native Mac app launched from the named build.",
    "- Reviewer: Self Test",
    "- Date/time: today",
    "- Device/build/browser: Self-test Mac",
    ""
  ].join("\n"));
  assert.ok(platformQaEvidenceFileErrors({
    rows: [{ area: "Launch", result: "PASS", notes: `evidence: ${notesPath}; screenshot: ${screenshotPath}; result: PASS; observed: launch succeeded` }],
    platformHandoffBinding: binding,
    platformId: "nativeMacManualQa",
    label: "Mac manual QA"
  }).some((error) => error.includes("must include Date/time as ISO date-time with timezone")));
  await writeFile(notesPath, [
    "# Row 1 Launch",
    "",
    "- Result: PASS",
    "- Observed summary: The native Mac app launched from the named build.",
    "- Reviewer: Self Test",
    "- Date/time: 2026-02-31T08:00:00+08:00",
    "- Device/build/browser: Self-test Mac",
    ""
  ].join("\n"));
  assert.ok(platformQaEvidenceFileErrors({
    rows: [{ area: "Launch", result: "PASS", notes: `evidence: ${notesPath}; screenshot: ${screenshotPath}; result: PASS; observed: launch succeeded` }],
    platformHandoffBinding: binding,
    platformId: "nativeMacManualQa",
    label: "Mac manual QA"
  }).some((error) => error.includes("must include Date/time as ISO date-time with timezone")));
  await writeFile(notesPath, [
    "# Row 1 Launch",
    "",
    "- Result: PASS",
    "- Observed summary: The native Mac app launched from the named build.",
    "- Reviewer: Self Test",
    "- Date/time: 2026-06-24T08:00:00+08:00",
    "- Device/build/browser: TBD",
    ""
  ].join("\n"));
  assert.ok(platformQaEvidenceFileErrors({
    rows: [{ area: "Launch", result: "PASS", notes: `evidence: ${notesPath}; screenshot: ${screenshotPath}; result: PASS; observed: launch succeeded` }],
    platformHandoffBinding: binding,
    platformId: "nativeMacManualQa",
    label: "Mac manual QA"
  }).some((error) => error.includes("must include a concrete Device/build/browser")));
}

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

async function assertFilledRowsRequirePlatformHandoff(item) {
  const qaPath = join(RUN_ROOT, `${item.id}-filled-no-handoff.md`);
  const outPath = join(RUN_ROOT, `${item.id}-filled-no-handoff.json`);
  const source = await readFile(item.qa, "utf8");
  await writeFile(qaPath, createFilledNoHandoffMarkdown(source, item));
  const result = await runNode([
    item.script,
    "--qa",
    qaPath,
    "--out",
    outPath
  ]);
  assert.notEqual(result.code, 0, `${item.id} filled rows without platform handoff must fail`);
  const receipt = await readReceipt(outPath);
  assert.equal(receipt.schema, item.schema, `${item.id} filled-no-handoff schema`);
  assert.equal(receipt.summary?.anyRealRowsFilled, true, `${item.id} filled-no-handoff should have real rows`);
  assert.equal(receipt.summary?.ok, false, `${item.id} filled-no-handoff must not be structurally valid`);
  assert.ok(
    receipt.errors?.some((error) => error.includes("--platform-handoff is required")),
    `${item.id} filled-no-handoff must require platform handoff`
  );
  assert.ok(
    receipt.errors?.some((error) => error.includes("evidence file validation requires platform handoff binding")),
    `${item.id} filled-no-handoff must require row evidence file binding`
  );
  assert.equal(receipt.claimBoundary?.[item.claimKey], false, `${item.id} filled-no-handoff must not claim platform QA`);
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

function createFilledNoHandoffMarkdown(source, item) {
  let text = source
    .replace("| Date/time | TBD |", "| Date/time | 2026-06-24T08:00:00+08:00 |")
    .replace("| Reviewer | TBD |", "| Reviewer | Self Test |")
    .replace(`| ${item.requiredFilledField} | TBD |`, `| ${item.requiredFilledField} | Self-test environment |`);
  const lines = text.split("\n");
  const rowIndex = lines.findIndex((line) => (
    line.startsWith("| ")
      && !line.startsWith("| Area |")
      && !line.includes("| ---")
      && line.includes(" | NT |  |")
  ));
  assert.notEqual(rowIndex, -1, `${item.id} fixture should contain at least one pending QA row`);
  const updatedLine = lines[rowIndex].replace(
    " | NT |  |",
    " | PASS | evidence: self-test-no-handoff-notes.md; result: PASS; observed: self-test filled row |"
  );
  assert.notEqual(updatedLine, lines[rowIndex], `${item.id} fixture row should be fillable`);
  lines[rowIndex] = updatedLine;
  text = lines.join("\n");
  assert.match(text, /\| PASS \| evidence: self-test-no-handoff-notes\.md/);
  return text;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
