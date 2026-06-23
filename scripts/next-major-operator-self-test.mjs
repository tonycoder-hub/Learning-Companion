#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { buildApprovedCandidateCommand } from "./lib/source-approval-freshness.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = dirname(dirname(scriptPath));
const operatorScript = join(repoRoot, "scripts/next-major-operator-packet.mjs");
const platformHandoffScript = join(repoRoot, "scripts/platform-qa-handoff.mjs");
// Deliberately differs from buildPlatformHandoff's synthetic 27/10/10 counts.
const REAL_HANDOFF_ROW_COUNTS = Object.freeze({
  nativeMacManualQa: 28,
  windowsStaticManualQa: 11,
  harmonyDeviceQa: 9
});
const tmp = await mkdtemp(join(tmpdir(), "lc-next-major-operator-"));
const fixtureRoot = join(tmp, "repo");
const inputDir = join(tmp, "inputs");
const outDir = join(tmp, "out");
const statusPath = join(inputDir, "ko-status.json");
const readinessPath = join(inputDir, "readiness.json");
const platformPath = join(inputDir, "platform-handoff.json");
const approvalPath = join(inputDir, "source-approval-request.json");
const receiptPath = join(inputDir, "public-dry-run-receipt.json");

try {
  await mkdir(fixtureRoot, { recursive: true });
  await mkdir(inputDir, { recursive: true });
  await mkdir(outDir, { recursive: true });

  await writeFile(join(fixtureRoot, "README.md"), "operator fixture\n");
  await writePlatformQaTemplates();
  await initFixtureGit("initial operator fixture");

  const currentHead = (await git(["rev-parse", "HEAD"])).stdout.trim();
  await writeJson(statusPath, buildStatus(currentHead));
  await writeJson(readinessPath, buildReadiness(false));
  await writeJson(receiptPath, buildPublicDryRunReceipt(currentHead));
  await writeJson(platformPath, buildPlatformHandoff(currentHead));
  await writeJson(approvalPath, buildApprovalRequest(currentHead));

  const realPlatformHandoffRun = await runPlatformHandoff("real-platform-handoff");
  assert.equal(realPlatformHandoffRun.code, 0, realPlatformHandoffRun.stderr);
  const realPlatformHandoff = await readJson(realPlatformHandoffRun.jsonPath);
  assert.deepEqual(realPlatformHandoff.platforms.map((platform) => platform.id), [
    "nativeMacManualQa",
    "windowsStaticManualQa",
    "harmonyDeviceQa"
  ]);
  const realPlatformOperatorRun = await runOperator("real-platform-operator", {
    approval: approvalPath,
    platformHandoff: realPlatformHandoffRun.jsonPath
  });
  assert.equal(realPlatformOperatorRun.code, 0, realPlatformOperatorRun.stderr);
  const realPlatformPacket = await readJson(realPlatformOperatorRun.jsonPath);
  const realPlatformHandoffMarkdown = await readFile(realPlatformHandoffRun.markdownPath, "utf8");
  const realPlatformOperatorMarkdown = await readFile(realPlatformOperatorRun.markdownPath, "utf8");
  assert.equal(realPlatformPacket.inputs.platformHandoffPath, realPlatformHandoffRun.jsonPath);
  assert.match(realPlatformHandoffMarkdown, /Platform QA Execution Handoff/);
  assert.match(realPlatformHandoffMarkdown, /Execution checklist/);
  assert.match(realPlatformHandoffMarkdown, /windowsStaticManualQa/);
  assert.match(realPlatformOperatorMarkdown, /Execution checklist/);
  assert.match(realPlatformOperatorMarkdown, /Not accepted as evidence/);
  assert.deepEqual(realPlatformPacket.operatorOrder, [
    "approvedExternalReadingVideo",
    "nativeMacManualQa",
    "windowsStaticManualQa",
    "harmonyDeviceQa",
    "finalKoGate"
  ]);
  assert.deepEqual(realPlatformPacket.nextActionSequence.map((step) => step.id), [
    "get-current-turn-source-approval",
    "run-approved-external-source-candidate",
    "complete-external-source-privacy-review",
    "run-nativeMacManualQa",
    "run-windowsStaticManualQa",
    "run-harmonyDeviceQa",
    "validate-final-ko"
  ]);
  assert.equal(getLane(realPlatformPacket, "nativeMacManualQa").currentRows.nt, REAL_HANDOFF_ROW_COUNTS.nativeMacManualQa);
  assert.equal(getLane(realPlatformPacket, "windowsStaticManualQa").currentRows.nt, REAL_HANDOFF_ROW_COUNTS.windowsStaticManualQa);
  assert.equal(getLane(realPlatformPacket, "harmonyDeviceQa").currentRows.nt, REAL_HANDOFF_ROW_COUNTS.harmonyDeviceQa);
  assert.match(getLane(realPlatformPacket, "nativeMacManualQa").executionChecklist.afterRun.join("\n"), /mac:manual:validate:real/);
  assert.match(getLane(realPlatformPacket, "windowsStaticManualQa").executionChecklist.afterRun.join("\n"), /windows:static:validate:real/);
  assert.match(getLane(realPlatformPacket, "harmonyDeviceQa").executionChecklist.afterRun.join("\n"), /harmony:device:validate:real/);

  const freshRun = await runOperator("fresh", { approval: approvalPath });
  assert.equal(freshRun.code, 0, freshRun.stderr);
  assert.match(freshRun.stdout, /next_major_operator_packet_ok/);
  assert.match(freshRun.stdout, /approvedExternalReadingVideo: NEEDS_CURRENT_TURN_APPROVAL/);
  assert.match(freshRun.stdout, /nativeMacManualQa: NEEDS_REAL_PLATFORM_RUN/);
  assert.match(freshRun.stdout, /windowsStaticManualQa: NEEDS_REAL_PLATFORM_RUN/);
  assert.match(freshRun.stdout, /harmonyDeviceQa: NEEDS_REAL_PLATFORM_RUN/);
  const freshPacket = await readJson(freshRun.jsonPath);
  assert.equal(freshPacket.schema, "learning-companion.next-major-operator-packet.v1");
  assert.equal(freshPacket.evidenceTier, "NEXT_MAJOR_OPERATOR_PACKET_ONLY");
  assert.equal(freshPacket.canClaimNextMajorFromThisPacket, false);
  assert.equal(freshPacket.releaseActionAuthorized, false);
  assert.equal(freshPacket.inputs.sourceApprovalRequestAvailable, true);
  assert.equal(freshPacket.platformHandoffFreshness.status, "CURRENT_CLEAN_PLATFORM_QA_HANDOFF");
  assert.equal(freshPacket.platformHandoffFreshness.problems.length, 0);
  assert.deepEqual(freshPacket.operatorOrder, [
    "approvedExternalReadingVideo",
    "nativeMacManualQa",
    "windowsStaticManualQa",
    "harmonyDeviceQa",
    "finalKoGate"
  ]);
  assert.deepEqual(freshPacket.nextActionSequence.map((step) => step.id), [
    "get-current-turn-source-approval",
    "run-approved-external-source-candidate",
    "complete-external-source-privacy-review",
    "run-nativeMacManualQa",
    "run-windowsStaticManualQa",
    "run-harmonyDeviceQa",
    "validate-final-ko"
  ]);
  assert.equal(freshPacket.nextActionSequence[0].claimBoundary, "This operator packet cannot grant approval on the user's behalf.");
  assert.match(freshPacket.nextActionSequence.find((step) => step.id === "validate-final-ko").claimBoundary, /every preceding lane has real PASS evidence/);
  const sourceLane = getLane(freshPacket, "approvedExternalReadingVideo");
  const macLane = getLane(freshPacket, "nativeMacManualQa");
  const windowsLane = getLane(freshPacket, "windowsStaticManualQa");
  const harmonyLane = getLane(freshPacket, "harmonyDeviceQa");
  const finalLane = getLane(freshPacket, "finalKoGate");
  assert.equal(sourceLane.operatorState, "NEEDS_CURRENT_TURN_APPROVAL");
  assert.equal(sourceLane.approvalRequest.freshness.status, "CURRENT_CLEAN_PUBLIC_DRY_RUN");
  assert.equal(sourceLane.approvalRequest.freshness.problems.length, 0);
  assert.equal(sourceLane.nextCommands.approvedCandidateAfterCurrentTurnApproval, buildApprovedCandidateCommand(buildApprovalRequest(currentHead)));
  assert.equal(sourceLane.cannotBeFilledFrom.includes("public-source dry-runs without current-turn approval"), true);
  assertPlatformLane(macLane, {
    id: "nativeMacManualQa",
    nt: 27,
    validateCommandPattern: /mac:manual:validate:real/,
    cannotBeFilledFrom: "fixture receipts"
  });
  assertPlatformLane(windowsLane, {
    id: "windowsStaticManualQa",
    nt: 10,
    validateCommandPattern: /windows:static:validate:real/,
    cannotBeFilledFrom: "non-Windows fixture inspection"
  });
  assertPlatformLane(harmonyLane, {
    id: "harmonyDeviceQa",
    nt: 10,
    validateCommandPattern: /harmony:device:validate:real/,
    cannotBeFilledFrom: "Harmony scaffold smoke"
  });
  assert.equal(finalLane.operatorState, "BLOCKED_UNTIL_ALL_EVIDENCE_PASSES");
  assert.equal(finalLane.releaseActionAuthorized, false);
  assert.equal(finalLane.nextCommands.finalizeNextMajor, "npm run next:finalize -- --external <ko-evidence-review.json>");
  assert.match(freshPacket.nextActionSequence.find((step) => step.id === "validate-final-ko").command, /npm run next:finalize/);
  assert.equal((await stat(freshRun.jsonPath)).mode & 0o777, 0o600);
  assert.equal((await stat(freshRun.markdownPath)).mode & 0o777, 0o600);
  const freshMarkdown = await readFile(freshRun.markdownPath, "utf8");
  assert.match(freshMarkdown, /Next Major Operator Packet/);
  assert.match(freshMarkdown, /## Critical Path/);
  assert.match(freshMarkdown, /get-current-turn-source-approval/);
  assert.match(freshMarkdown, /run-approved-external-source-candidate/);
  assert.match(freshMarkdown, /validate-final-ko/);
  assert.match(freshMarkdown, /Exact approval text to request:\n\n```text\nFixture approval_text\.\n```/);
  assert.match(freshMarkdown, /Exact approval text to copy:\n\n```text\nFixture approval_text\.\n```/);
  assert.doesNotMatch(freshMarkdown, /```text\nFixture approval\\_text/);
  assert.match(freshMarkdown, /Approval request freshness: CURRENT\\_CLEAN\\_PUBLIC\\_DRY\\_RUN/);
  assert.match(freshMarkdown, /No build, package, deployment, Mew-Test, main-site, or remote acceptance check was run by this operator packet/);

  await writeJson(approvalPath, buildApprovalRequest(currentHead, {
    priorGitHead: "0000000000000000000000000000000000000000"
  }));
  const staleSourceRun = await runOperator("stale-source", { approval: approvalPath });
  assert.equal(staleSourceRun.code, 0, staleSourceRun.stderr);
  const staleSourcePacket = await readJson(staleSourceRun.jsonPath);
  const staleSourceLane = getLane(staleSourcePacket, "approvedExternalReadingVideo");
  assert.equal(staleSourceLane.operatorState, "NEEDS_FRESH_PUBLIC_DRY_RUN_OR_APPROVAL_REQUEST");
  assert.equal(staleSourceLane.approvalRequest.freshness.status, "STALE_OR_DIRTY_PUBLIC_DRY_RUN");
  assert.ok(staleSourceLane.approvalRequest.freshness.problems.some((problem) => problem.includes("does not match current HEAD")));
  assert.match(staleSourceLane.nextCommands.refreshPublicDryRun, /external:validate:public-dry-run/);
  assert.match(staleSourceLane.nextCommands.approvedCandidateAfterCurrentTurnApproval, /<approved-reading-url>/);
  assert.equal(staleSourcePacket.nextActionSequence[0].id, "refresh-public-source-dry-run");
  assert.match(staleSourcePacket.nextActionSequence[0].command, /external:validate:public-dry-run/);

  await writeJson(approvalPath, buildApprovalRequest(currentHead));
  await writeJson(platformPath, buildPlatformHandoff("0000000000000000000000000000000000000000"));
  const stalePlatformRun = await runOperator("stale-platform", { approval: approvalPath });
  assert.equal(stalePlatformRun.code, 0, stalePlatformRun.stderr);
  const stalePlatformPacket = await readJson(stalePlatformRun.jsonPath);
  assert.equal(stalePlatformPacket.platformHandoffFreshness.status, "STALE_OR_DIRTY_PLATFORM_QA_HANDOFF");
  assert.ok(stalePlatformPacket.platformHandoffFreshness.problems.some((problem) => problem.includes("does not match current HEAD")));
  assert.equal(getLane(stalePlatformPacket, "nativeMacManualQa").operatorState, "NEEDS_FRESH_PLATFORM_QA_HANDOFF");
  assert.equal(getLane(stalePlatformPacket, "windowsStaticManualQa").operatorState, "NEEDS_FRESH_PLATFORM_QA_HANDOFF");
  assert.equal(getLane(stalePlatformPacket, "harmonyDeviceQa").operatorState, "NEEDS_FRESH_PLATFORM_QA_HANDOFF");
  assert.equal(stalePlatformPacket.nextActionSequence.some((step) => step.id === "refresh-platform-qa-handoff"), true);
  assert.match(getLane(stalePlatformPacket, "nativeMacManualQa").nextCommands.refreshPlatformHandoff, /platform:qa-handoff/);
  assert.match(getLane(stalePlatformPacket, "windowsStaticManualQa").nextCommands.refreshPlatformHandoff, /platform:qa-handoff/);
  assert.match(getLane(stalePlatformPacket, "harmonyDeviceQa").nextCommands.refreshPlatformHandoff, /platform:qa-handoff/);

  await writeJson(platformPath, buildPlatformHandoff(currentHead));
  const missingSourceRun = await runOperator("missing-source", { approval: join(tmp, "missing-approval.json") });
  assert.equal(missingSourceRun.code, 0, missingSourceRun.stderr);
  const missingSourcePacket = await readJson(missingSourceRun.jsonPath);
  const missingSourceLane = getLane(missingSourcePacket, "approvedExternalReadingVideo");
  assert.equal(missingSourcePacket.inputs.sourceApprovalRequestAvailable, false);
  assert.equal(missingSourceLane.operatorState, "NEEDS_SOURCE_INPUT");
  assert.equal(missingSourceLane.approvalRequest.freshness.status, "MISSING_SOURCE_APPROVAL_REQUEST");
  assert.match(missingSourceLane.nextCommands.sourceIntake, /external:source-intake/);
  assert.match(missingSourceLane.nextCommands.sourceApprovalRequest, /external:approval-request/);
  assert.equal(missingSourcePacket.nextActionSequence[0].id, "collect-source-input");
  assert.match(missingSourcePacket.nextActionSequence[0].command, /external:source-intake/);

  await writeJson(approvalPath, buildApprovalRequest(currentHead));
  const refreshInputsRun = await runOperatorRefresh("refresh-inputs", { approval: approvalPath });
  assert.equal(refreshInputsRun.code, 0, refreshInputsRun.stderr);
  assert.match(refreshInputsRun.stdout, /next_major_operator_packet_ok/);
  const refreshedInputPacket = await readJson(refreshInputsRun.jsonPath);
  assert.equal(refreshedInputPacket.inputs.readinessPath, readinessPath);
  assert.equal(refreshedInputPacket.inputs.platformHandoffPath, platformPath);
  assert.equal(refreshedInputPacket.sourceReadiness.koStatusFreshness, "CURRENT_CLEAN_HEAD_KO_STATUS");
  assert.equal(refreshedInputPacket.platformHandoffFreshness.status, "CURRENT_CLEAN_PLATFORM_QA_HANDOFF");
  assert.equal(getLane(refreshedInputPacket, "nativeMacManualQa").currentRows.nt, REAL_HANDOFF_ROW_COUNTS.nativeMacManualQa);
  assert.equal((await stat(markdownSiblingPath(readinessPath))).mode & 0o777, 0o600);
  assert.equal((await stat(markdownSiblingPath(platformPath))).mode & 0o777, 0o600);
  assert.match(await readFile(markdownSiblingPath(readinessPath), "utf8"), /Next Major Readiness Packet/);
  assert.match(await readFile(markdownSiblingPath(platformPath), "utf8"), /Platform QA Execution Handoff/);

  const extensionlessReadinessPath = join(outDir, "extensionless-readiness");
  const extensionlessPlatformPath = join(outDir, "extensionless-platform");
  const extensionlessRefreshRun = await runOperatorRefresh("extensionless-refresh-inputs", {
    approval: approvalPath,
    readiness: extensionlessReadinessPath,
    platformHandoff: extensionlessPlatformPath
  });
  assert.equal(extensionlessRefreshRun.code, 0, extensionlessRefreshRun.stderr);
  assert.match(extensionlessRefreshRun.stdout, /next_major_operator_packet_ok/);
  assert.equal((await stat(markdownSiblingPath(extensionlessReadinessPath))).mode & 0o777, 0o600);
  assert.equal((await stat(markdownSiblingPath(extensionlessPlatformPath))).mode & 0o777, 0o600);
  assert.match(await readFile(markdownSiblingPath(extensionlessReadinessPath), "utf8"), /Next Major Readiness Packet/);
  assert.match(await readFile(markdownSiblingPath(extensionlessPlatformPath), "utf8"), /Platform QA Execution Handoff/);

  await writeJson(readinessPath, buildReadiness(true));
  const releaseAuthorizedRun = await runOperator("release-authorized", { approval: approvalPath });
  assert.notEqual(releaseAuthorizedRun.code, 0);
  assert.match(`${releaseAuthorizedRun.stdout}\n${releaseAuthorizedRun.stderr}`, /releaseActionAuthorized mismatch/);

  const missingOutPath = await runNode([operatorScript, "--out"], fixtureRoot);
  assert.notEqual(missingOutPath.code, 0);
  assert.match(`${missingOutPath.stdout}\n${missingOutPath.stderr}`, /--out requires a file path/);

  const missingMarkdownPath = await runNode([operatorScript, "--markdown-out"], fixtureRoot);
  assert.notEqual(missingMarkdownPath.code, 0);
  assert.match(`${missingMarkdownPath.stdout}\n${missingMarkdownPath.stderr}`, /--markdown-out requires a file path/);

  console.log("next_major_operator_selftest_ok");
} finally {
  await rm(tmp, { recursive: true, force: true });
}

async function initFixtureGit(message) {
  await git(["init"]);
  await git(["add", "."]);
  await gitCommit(message);
}

async function git(args) {
  const result = await runCommand("git", args, fixtureRoot);
  assert.equal(result.code, 0, result.stderr || result.stdout);
  return result;
}

async function gitCommit(message) {
  await git([
    "-c",
    "user.name=Learning Companion Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "-m",
    message
  ]);
}

async function runOperator(label, options = {}) {
  const jsonPath = join(outDir, `${label}.json`);
  const markdownPath = join(outDir, `${label}.md`);
  const result = await runNode([
    operatorScript,
    "--status",
    statusPath,
    "--readiness",
    readinessPath,
    "--platform-handoff",
    options.platformHandoff || platformPath,
    "--source-approval-request",
    options.approval || approvalPath,
    "--out",
    jsonPath,
    "--markdown-out",
    markdownPath
  ], fixtureRoot);
  return {
    ...result,
    jsonPath,
    markdownPath
  };
}

async function runOperatorRefresh(label, options = {}) {
  const jsonPath = join(outDir, `${label}.json`);
  const markdownPath = join(outDir, `${label}.md`);
  const result = await runNode([
    operatorScript,
    "--refresh",
    "--status",
    statusPath,
    "--readiness",
    options.readiness || readinessPath,
    "--platform-handoff",
    options.platformHandoff || platformPath,
    "--source-approval-request",
    options.approval || approvalPath,
    "--out",
    jsonPath,
    "--markdown-out",
    markdownPath
  ], fixtureRoot);
  return {
    ...result,
    jsonPath,
    markdownPath
  };
}

async function runPlatformHandoff(label) {
  const jsonPath = join(outDir, `${label}.json`);
  const markdownPath = join(outDir, `${label}.md`);
  const result = await runNode([
    platformHandoffScript,
    "--status",
    statusPath,
    "--out",
    jsonPath,
    "--markdown-out",
    markdownPath
  ], fixtureRoot);
  return {
    ...result,
    jsonPath,
    markdownPath
  };
}

async function runNode(args, cwd) {
  return runCommand(process.execPath, args, cwd);
}

async function runCommand(command, args, cwd) {
  try {
    const result = await execFileAsync(command, args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    });
    return {
      code: 0,
      stdout: result.stdout || "",
      stderr: result.stderr || ""
    };
  } catch (error) {
    return {
      code: Number.isInteger(error.code) ? error.code : 1,
      stdout: String(error.stdout || ""),
      stderr: String(error.stderr || error.message || "")
    };
  }
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writePlatformQaTemplates() {
  const qaRoot = join(fixtureRoot, "dist/morning-demo");
  await mkdir(qaRoot, { recursive: true });
  await writeFile(join(qaRoot, "MAC_MANUAL_QA.md"), buildQaMarkdown("Mac", REAL_HANDOFF_ROW_COUNTS.nativeMacManualQa));
  await writeFile(join(qaRoot, "WINDOWS_STATIC_QA.md"), buildQaMarkdown("Windows", REAL_HANDOFF_ROW_COUNTS.windowsStaticManualQa));
  await writeFile(join(qaRoot, "HARMONY_DEVICE_QA.md"), buildQaMarkdown("Harmony", REAL_HANDOFF_ROW_COUNTS.harmonyDeviceQa));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function markdownSiblingPath(jsonPath) {
  const text = String(jsonPath);
  return text.endsWith(".json") ? text.slice(0, -5) + ".md" : `${text}.md`;
}

function getLane(packet, id) {
  return packet.lanes.find((lane) => lane.id === id) || {};
}

function assertPlatformLane(lane, { id, nt, validateCommandPattern, cannotBeFilledFrom }) {
  assert.equal(lane.id, id);
  assert.equal(lane.operatorState, "NEEDS_REAL_PLATFORM_RUN");
  assert.equal(lane.currentRows.nt, nt);
  assert.equal(lane.currentRows.rowsNeedingConcreteNotes, 0);
  assert.match(lane.validateCommand, validateCommandPattern);
  assert.equal(lane.nextCommands.refreshPlatformHandoff, undefined);
  assert.equal(lane.cannotBeFilledFrom.includes(cannotBeFilledFrom), true);
}

function buildStatus(gitHead) {
  return {
    schema: "learning-companion.ko-evidence-review.v1",
    evidenceTier: "KO_MISSING_EVIDENCE",
    canClaimKo: false,
    currentRevision: {
      gitAvailable: true,
      gitHead,
      dirtyWorktree: false,
      statusLineCount: 0,
      statusSummary: "",
      statusTruncated: false
    },
    requirements: [
      {
        id: "approvedExternalReadingVideo",
        status: "MISSING",
        detail: "Requires privacy-reviewed approved external evidence",
        evidencePath: ""
      },
      {
        id: "nativeMacManualQa",
        status: "FAIL",
        detail: "Mac manual QA rows must all PASS",
        evidencePath: ".codex-tmp/mac-manual-qa/receipt.json"
      },
      {
        id: "windowsStaticManualQa",
        status: "FAIL",
        detail: "Windows static QA rows must all PASS",
        evidencePath: ".codex-tmp/windows-static-qa/receipt.json"
      },
      {
        id: "harmonyDeviceQa",
        status: "FAIL",
        detail: "HarmonyOS device QA rows must all PASS",
        evidencePath: ".codex-tmp/harmony-device-qa/receipt.json"
      }
    ]
  };
}

function buildReadiness(releaseActionAuthorized) {
  return {
    schema: "learning-companion.next-major-readiness.v1",
    evidenceTier: "NEXT_MAJOR_READINESS_SUMMARY_ONLY",
    canClaimNextMajorPreReleaseReady: false,
    releaseActionAuthorized,
    readinessStatus: "NOT_READY_MISSING_EVIDENCE"
  };
}

function buildPlatformHandoff(gitHead) {
  return {
    schema: "learning-companion.platform-qa-handoff.v1",
    evidenceTier: "PLATFORM_QA_HANDOFF_ONLY",
    canClaimKo: false,
    currentRevision: {
      gitAvailable: true,
      gitHead,
      dirtyWorktree: false,
      statusLineCount: 0,
      statusSummary: "",
      statusTruncated: false
    },
    executionFreshness: {
      status: "CURRENT_CLEAN_HEAD_PLATFORM_QA_HANDOFF"
    },
    nextCommands: {
      finalizeNextMajor: "npm run next:finalize -- --external <ko-evidence-review.json>",
      finalKoGate: "npm run ko:validate -- --external <ko-evidence-review.json> --out .codex-tmp/ko-evidence/final.json",
      finalKoGateWithExplicitPlatformReceipts: "npm run ko:validate -- --external <ko-evidence-review.json> --mac-manual .codex-tmp/mac-manual-qa/real-run-receipt.json --windows-static .codex-tmp/windows-static-qa/real-run-receipt.json --harmony-device .codex-tmp/harmony-device-qa/real-run-receipt.json --out .codex-tmp/ko-evidence/final.json"
    },
    platforms: [
      {
        id: "nativeMacManualQa",
        label: "Native Mac manual QA",
        currentKoStatus: {
          status: "PENDING_NOT_RUN",
          detail: "fixture pending",
          evidencePath: ".codex-tmp/mac-manual-qa/receipt.json"
        },
        qaPath: "dist/morning-demo/MAC_MANUAL_QA.md",
        receiptPath: ".codex-tmp/mac-manual-qa/real-run-receipt.json",
        validateCommand: "npm run mac:manual:validate:real",
        expectedRows: 27,
        currentTemplateSummary: {
          rows: 27,
          pass: 0,
          fail: 0,
          blocked: 0,
          nt: 27,
          invalid: 0,
          rowsNeedingConcreteNotes: 0,
          requiredSessionFields: [
            {
              field: "Reviewer",
              filled: false
            }
          ]
        },
        nextRealRunSteps: ["Fill the real Mac QA template."],
        cannotBeFilledFrom: ["fixture receipts"]
      },
      {
        id: "windowsStaticManualQa",
        label: "Windows static/manual QA",
        currentKoStatus: {
          status: "PENDING_NOT_RUN",
          detail: "fixture pending",
          evidencePath: ".codex-tmp/windows-static-qa/receipt.json"
        },
        qaPath: "dist/morning-demo/WINDOWS_STATIC_QA.md",
        receiptPath: ".codex-tmp/windows-static-qa/real-run-receipt.json",
        validateCommand: "npm run windows:static:validate:real",
        expectedRows: 10,
        currentTemplateSummary: {
          rows: 10,
          pass: 0,
          fail: 0,
          blocked: 0,
          nt: 10,
          invalid: 0,
          rowsNeedingConcreteNotes: 0,
          requiredSessionFields: [
            {
              field: "Windows browser/device",
              filled: false
            }
          ]
        },
        nextRealRunSteps: ["Fill the real Windows static/manual QA template."],
        cannotBeFilledFrom: ["non-Windows fixture inspection"]
      },
      {
        id: "harmonyDeviceQa",
        label: "HarmonyOS device/toolchain QA",
        currentKoStatus: {
          status: "PENDING_NOT_RUN",
          detail: "fixture pending",
          evidencePath: ".codex-tmp/harmony-device-qa/receipt.json"
        },
        qaPath: "dist/morning-demo/HARMONY_DEVICE_QA.md",
        receiptPath: ".codex-tmp/harmony-device-qa/real-run-receipt.json",
        validateCommand: "npm run harmony:device:validate:real",
        expectedRows: 10,
        currentTemplateSummary: {
          rows: 10,
          pass: 0,
          fail: 0,
          blocked: 0,
          nt: 10,
          invalid: 0,
          rowsNeedingConcreteNotes: 0,
          requiredSessionFields: [
            {
              field: "HarmonyOS device/build",
              filled: false
            }
          ]
        },
        nextRealRunSteps: ["Fill the real HarmonyOS device/toolchain QA template."],
        cannotBeFilledFrom: ["Harmony scaffold smoke"]
      }
    ]
  };
}

function buildApprovalRequest(gitHead, options = {}) {
  const request = {
    schema: "learning-companion.external-source-approval-request.v1",
    evidenceTier: "SOURCE_APPROVAL_REQUEST_ONLY",
    canClaimExternalKo: false,
    basis: {
      type: "PUBLIC_SOURCE_DRY_RUN_RECEIPT",
      inputPath: receiptPath,
      priorDryRunReceipt: receiptPath,
      priorDryRun: {
        gitHead: options.priorGitHead || gitHead,
        dirtyWorktree: false,
        profileRetained: false,
        profileCleanupOk: true
      }
    },
    sources: {
      reading: {
        url: "https://example.com/reading",
        title: "Fixture reading"
      },
      video: {
        url: "https://example.com/video.mp4",
        title: "Fixture video",
        timestamp: "00:03"
      }
    },
    requestedApprovalText: "Fixture approval_text.",
    nextCommands: {
      approvedCandidateAfterCurrentTurnApproval: "",
      privacyTemplate: "npm run external:privacy-template -- --receipt <candidate-receipt.json> --out <privacy-review.json>",
      privacyReview: "npm run external:privacy-review -- --receipt <candidate-receipt.json> --review <privacy-review.json> --out <ko-evidence-review.json>"
    }
  };
  request.nextCommands.approvedCandidateAfterCurrentTurnApproval = buildApprovedCandidateCommand(request);
  return request;
}

function buildPublicDryRunReceipt(gitHead) {
  return {
    schema: "learning-companion.external-source-validation-browser.v1",
    evidenceTier: "PUBLIC_SOURCE_DRY_RUN",
    publicSourceDryRun: true,
    canClaimExternalKo: false,
    runContext: {
      appRevision: {
        gitHead,
        dirtyWorktree: false
      },
      browser: {
        profileRetained: false,
        profileCleanup: {
          ok: true
        }
      }
    },
    runs: [
      {
        source: {
          type: "reading",
          url: "https://example.com/reading"
        }
      },
      {
        source: {
          type: "video",
          url: "https://example.com/video.mp4"
        },
        videoTools: {
          bookmarkTimestamp: "00:03"
        }
      }
    ]
  };
}

function buildQaMarkdown(label, rows) {
  const lines = [
    `# ${label} QA Fixture`,
    "",
    "| Area | Steps | Expected | Result | Notes |",
    "| --- | --- | --- | --- | --- |"
  ];
  for (let index = 0; index < rows; index += 1) {
    lines.push(`| ${label} area ${index + 1} | Do fixture step ${index + 1}. | See expected fixture state. | NT |  |`);
  }
  return `${lines.join("\n")}\n`;
}
