#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  CURRENT_CLEAN_PUBLIC_DRY_RUN,
  STALE_OR_DIRTY_PUBLIC_DRY_RUN,
  assessSourceApprovalFreshness,
  buildApprovedCandidateCommand,
  buildFreshSourceCommands
} from "./lib/source-approval-freshness.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = dirname(dirname(scriptPath));
const approvalCheckScript = join(repoRoot, "scripts/external-source-validation-browser.mjs");
const tmp = await mkdtemp(join(tmpdir(), "lc-source-approval-freshness-"));

try {
  const currentRevision = {
    gitHead: "abc123",
    dirtyWorktree: false
  };
  const receiptPath = join(tmp, "receipt.json");
  const cleanReceipt = buildReceipt();
  await writeFile(receiptPath, `${JSON.stringify(cleanReceipt, null, 2)}\n`);
  const cleanRequest = buildRequest(receiptPath);
  cleanRequest.nextCommands.approvedCandidateAfterCurrentTurnApproval = buildApprovedCandidateCommand(cleanRequest);

  const cleanFreshness = await assessSourceApprovalFreshness(cleanRequest, currentRevision);
  assert.equal(cleanFreshness.status, CURRENT_CLEAN_PUBLIC_DRY_RUN);
  assert.deepEqual(cleanFreshness.problems, []);
  assert.equal(cleanFreshness.basisReceiptPath, receiptPath);

  const fixtureRoot = join(tmp, "approval-check-fixture");
  const ignoredEvidenceDir = join(fixtureRoot, ".codex-tmp/external-source-validation");
  await mkdir(fixtureRoot, { recursive: true });
  await writeFile(join(fixtureRoot, "README.md"), "approval check fixture\n");
  await writeFile(join(fixtureRoot, ".gitignore"), ".codex-tmp/\n");
  await git(fixtureRoot, ["init"]);
  await git(fixtureRoot, ["add", "."]);
  await git(fixtureRoot, [
    "-c",
    "user.name=Learning Companion Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "-m",
    "initial approval check fixture"
  ]);
  const fixtureHead = (await git(fixtureRoot, ["rev-parse", "HEAD"])).stdout.trim();
  await mkdir(ignoredEvidenceDir, { recursive: true });
  const checkReceiptPath = join(ignoredEvidenceDir, "public-dry-run-receipt.json");
  const checkRequestPath = join(ignoredEvidenceDir, "source-approval-request.json");
  const checkOutPath = join(ignoredEvidenceDir, "source-approval-check.json");
  const checkReceipt = buildReceipt(fixtureHead);
  const checkRequest = buildRequest(checkReceiptPath, fixtureHead);
  checkRequest.approvalRequestPath = checkRequestPath;
  checkRequest.nextCommands.approvedCandidateAfterCurrentTurnApproval = buildApprovedCandidateCommand(checkRequest);
  await writeFile(checkReceiptPath, `${JSON.stringify(checkReceipt, null, 2)}\n`);
  await writeFile(checkRequestPath, `${JSON.stringify(checkRequest, null, 2)}\n`);

  const approvalCheckRun = await runNode([
    approvalCheckScript,
    "--approval-check",
    "--source-approval-request",
    checkRequestPath,
    "--approval-note",
    checkRequest.requestedApprovalText,
    "--out",
    checkOutPath
  ], fixtureRoot);
  assert.equal(approvalCheckRun.code, 0, approvalCheckRun.stderr || approvalCheckRun.stdout);
  assert.match(approvalCheckRun.stdout, /source_approval_check_ok/);
  const checkOutput = JSON.parse(await readFile(checkOutPath, "utf8"));
  assert.equal(checkOutput.schema, "learning-companion.source-approval-check.v1");
  assert.equal(checkOutput.evidenceTier, "SOURCE_APPROVAL_CHECK_ONLY");
  assert.equal(checkOutput.canClaimExternalKo, false);
  assert.equal(checkOutput.approvalNoteMatched, true);
  assert.equal(checkOutput.sourceApprovalRequestBinding.freshnessStatus, CURRENT_CLEAN_PUBLIC_DRY_RUN);
  assert.equal(checkOutput.blockedOrNotExecuted.includes("No browser was launched."), true);
  assert.equal((await stat(checkOutPath)).mode & 0o777, 0o600);

  const mismatchedApprovalCheckRun = await runNode([
    approvalCheckScript,
    "--approval-check",
    "--source-approval-request",
    checkRequestPath,
    "--approval-note",
    "I approve a different source."
  ], fixtureRoot);
  assert.notEqual(mismatchedApprovalCheckRun.code, 0);
  assert.match(`${mismatchedApprovalCheckRun.stdout}\n${mismatchedApprovalCheckRun.stderr}`, /does not match --approval-note/);

  const dirtyCurrent = await assessSourceApprovalFreshness(cleanRequest, {
    gitHead: "abc123",
    dirtyWorktree: true
  });
  assert.equal(dirtyCurrent.status, STALE_OR_DIRTY_PUBLIC_DRY_RUN);
  assert.ok(dirtyCurrent.problems.some((problem) => problem.includes("Current worktree is dirty")));

  const missingCurrentRevision = await assessSourceApprovalFreshness(cleanRequest);
  assert.equal(missingCurrentRevision.status, STALE_OR_DIRTY_PUBLIC_DRY_RUN);
  assert.ok(missingCurrentRevision.problems.some((problem) => problem.includes("Current gitHead is unavailable")));

  const missingReceiptRequest = buildRequest("");
  missingReceiptRequest.nextCommands.approvedCandidateAfterCurrentTurnApproval = buildApprovedCandidateCommand(missingReceiptRequest);
  const missingReceipt = await assessSourceApprovalFreshness(missingReceiptRequest, currentRevision);
  assert.equal(missingReceipt.status, STALE_OR_DIRTY_PUBLIC_DRY_RUN);
  assert.ok(missingReceipt.problems.some((problem) => problem.includes("receipt path is missing")));

  const nonPublicBasisRequest = buildRequest(receiptPath);
  nonPublicBasisRequest.basis.type = "SOURCE_INTAKE_HANDOFF";
  nonPublicBasisRequest.nextCommands.approvedCandidateAfterCurrentTurnApproval = buildApprovedCandidateCommand(nonPublicBasisRequest);
  const nonPublicBasis = await assessSourceApprovalFreshness(nonPublicBasisRequest, currentRevision);
  assert.equal(nonPublicBasis.status, STALE_OR_DIRTY_PUBLIC_DRY_RUN);
  assert.ok(nonPublicBasis.problems.some((problem) => problem.includes("has no public dry-run receipt basis")));

  const retainedReceiptPath = join(tmp, "retained-null-receipt.json");
  const retainedReceipt = buildReceipt();
  retainedReceipt.runContext.browser.profileRetained = null;
  await writeFile(retainedReceiptPath, `${JSON.stringify(retainedReceipt, null, 2)}\n`);
  const retainedRequest = buildRequest(retainedReceiptPath);
  retainedRequest.basis.priorDryRun.profileRetained = null;
  retainedRequest.nextCommands.approvedCandidateAfterCurrentTurnApproval = buildApprovedCandidateCommand(retainedRequest);
  const retainedFreshness = await assessSourceApprovalFreshness(retainedRequest, currentRevision);
  assert.equal(retainedFreshness.status, STALE_OR_DIRTY_PUBLIC_DRY_RUN);
  assert.ok(retainedFreshness.problems.some((problem) => problem.includes("profileRetained is false")));

  const retainedTrueReceiptPath = join(tmp, "retained-true-receipt.json");
  const retainedTrueReceipt = buildReceipt();
  retainedTrueReceipt.runContext.browser.profileRetained = true;
  await writeFile(retainedTrueReceiptPath, `${JSON.stringify(retainedTrueReceipt, null, 2)}\n`);
  const retainedTrueRequest = buildRequest(retainedTrueReceiptPath);
  retainedTrueRequest.basis.priorDryRun.profileRetained = true;
  retainedTrueRequest.nextCommands.approvedCandidateAfterCurrentTurnApproval = buildApprovedCandidateCommand(retainedTrueRequest);
  const retainedTrueFreshness = await assessSourceApprovalFreshness(retainedTrueRequest, currentRevision);
  assert.equal(retainedTrueFreshness.status, STALE_OR_DIRTY_PUBLIC_DRY_RUN);
  assert.ok(retainedTrueFreshness.problems.some((problem) => problem.includes("retained its browser profile")));

  const cleanupFailedReceiptPath = join(tmp, "cleanup-failed-receipt.json");
  const cleanupFailedReceipt = buildReceipt();
  cleanupFailedReceipt.runContext.browser.profileCleanup.ok = false;
  await writeFile(cleanupFailedReceiptPath, `${JSON.stringify(cleanupFailedReceipt, null, 2)}\n`);
  const cleanupFailedRequest = buildRequest(cleanupFailedReceiptPath);
  cleanupFailedRequest.basis.priorDryRun.profileCleanupOk = false;
  cleanupFailedRequest.nextCommands.approvedCandidateAfterCurrentTurnApproval = buildApprovedCandidateCommand(cleanupFailedRequest);
  const cleanupFailedFreshness = await assessSourceApprovalFreshness(cleanupFailedRequest, currentRevision);
  assert.equal(cleanupFailedFreshness.status, STALE_OR_DIRTY_PUBLIC_DRY_RUN);
  assert.ok(cleanupFailedFreshness.problems.some((problem) => problem.includes("profile cleanup was not proven")));

  const dirtyPriorReceiptPath = join(tmp, "dirty-prior-receipt.json");
  const dirtyPriorReceipt = buildReceipt();
  dirtyPriorReceipt.runContext.appRevision.dirtyWorktree = true;
  await writeFile(dirtyPriorReceiptPath, `${JSON.stringify(dirtyPriorReceipt, null, 2)}\n`);
  const dirtyPriorRequest = buildRequest(dirtyPriorReceiptPath);
  dirtyPriorRequest.basis.priorDryRun.dirtyWorktree = true;
  dirtyPriorRequest.nextCommands.approvedCandidateAfterCurrentTurnApproval = buildApprovedCandidateCommand(dirtyPriorRequest);
  const dirtyPriorFreshness = await assessSourceApprovalFreshness(dirtyPriorRequest, currentRevision);
  assert.equal(dirtyPriorFreshness.status, STALE_OR_DIRTY_PUBLIC_DRY_RUN);
  assert.ok(dirtyPriorFreshness.problems.some((problem) => problem.includes("Prior public dry-run was captured with a dirty worktree")));

  const staleHeadRequest = buildRequest(receiptPath);
  staleHeadRequest.basis.priorDryRun.gitHead = "old123";
  staleHeadRequest.nextCommands.approvedCandidateAfterCurrentTurnApproval = buildApprovedCandidateCommand(staleHeadRequest);
  const staleHeadFreshness = await assessSourceApprovalFreshness(staleHeadRequest, currentRevision);
  assert.equal(staleHeadFreshness.status, STALE_OR_DIRTY_PUBLIC_DRY_RUN);
  assert.ok(staleHeadFreshness.problems.some((problem) => problem.includes("does not match current HEAD")));
  assert.ok(staleHeadFreshness.problems.some((problem) => problem.includes("does not match approval request basis")));

  const claimingReceiptPath = join(tmp, "claiming-receipt.json");
  const claimingReceipt = buildReceipt();
  claimingReceipt.schema = "wrong.schema";
  claimingReceipt.evidenceTier = "APPROVED_EXTERNAL_SOURCE_EVIDENCE";
  claimingReceipt.publicSourceDryRun = false;
  claimingReceipt.canClaimExternalKo = true;
  await writeFile(claimingReceiptPath, `${JSON.stringify(claimingReceipt, null, 2)}\n`);
  const claimingRequest = buildRequest(claimingReceiptPath);
  claimingRequest.nextCommands.approvedCandidateAfterCurrentTurnApproval = buildApprovedCandidateCommand(claimingRequest);
  const claimingFreshness = await assessSourceApprovalFreshness(claimingRequest, currentRevision);
  assert.equal(claimingFreshness.status, STALE_OR_DIRTY_PUBLIC_DRY_RUN);
  assert.ok(claimingFreshness.problems.some((problem) => problem.includes("schema mismatch")));
  assert.ok(claimingFreshness.problems.some((problem) => problem.includes("non-claiming PUBLIC_SOURCE_DRY_RUN")));

  const sourceMismatchRequest = buildRequest(receiptPath);
  sourceMismatchRequest.sources.reading.url = "https://example.com/other-reading";
  sourceMismatchRequest.sources.video.timestamp = "00:07";
  sourceMismatchRequest.nextCommands.approvedCandidateAfterCurrentTurnApproval = buildApprovedCandidateCommand(sourceMismatchRequest);
  const sourceMismatchFreshness = await assessSourceApprovalFreshness(sourceMismatchRequest, currentRevision);
  assert.equal(sourceMismatchFreshness.status, STALE_OR_DIRTY_PUBLIC_DRY_RUN);
  assert.ok(sourceMismatchFreshness.problems.some((problem) => problem.includes("reading URL")));
  assert.ok(sourceMismatchFreshness.problems.some((problem) => problem.includes("video timestamp")));

  const genericApprovalTextRequest = buildRequest(receiptPath);
  genericApprovalTextRequest.requestedApprovalText = "I approve the learning sources for this turn.";
  genericApprovalTextRequest.nextCommands.approvedCandidateAfterCurrentTurnApproval = buildApprovedCandidateCommand(genericApprovalTextRequest);
  const genericApprovalTextFreshness = await assessSourceApprovalFreshness(genericApprovalTextRequest, currentRevision);
  assert.equal(genericApprovalTextFreshness.status, STALE_OR_DIRTY_PUBLIC_DRY_RUN);
  assert.ok(genericApprovalTextFreshness.problems.some((problem) => problem.includes("exactly one reading= token")));

  const suffixApprovalTextRequest = buildRequest(receiptPath);
  suffixApprovalTextRequest.requestedApprovalText = suffixApprovalTextRequest.requestedApprovalText
    .replace("reading=https://example.com/reading", "reading=https://example.com/reading-extra")
    .replace("video=https://example.com/video.mp4", "video=https://example.com/video.mp4?extra=true")
    .replace("timestamp=00:03", "timestamp=00:03Z");
  suffixApprovalTextRequest.nextCommands.approvedCandidateAfterCurrentTurnApproval = buildApprovedCandidateCommand(suffixApprovalTextRequest);
  const suffixApprovalTextFreshness = await assessSourceApprovalFreshness(suffixApprovalTextRequest, currentRevision);
  assert.equal(suffixApprovalTextFreshness.status, STALE_OR_DIRTY_PUBLIC_DRY_RUN);
  assert.ok(suffixApprovalTextFreshness.problems.some((problem) => problem.includes("exact approved reading URL")));
  assert.ok(suffixApprovalTextFreshness.problems.some((problem) => problem.includes("exact approved video URL")));
  assert.ok(suffixApprovalTextFreshness.problems.some((problem) => problem.includes("exact approved video timestamp")));

  const conflictingApprovalTextRequest = buildRequest(receiptPath);
  conflictingApprovalTextRequest.requestedApprovalText = `${conflictingApprovalTextRequest.requestedApprovalText} reading=https://example.com/other-reading`;
  conflictingApprovalTextRequest.nextCommands.approvedCandidateAfterCurrentTurnApproval = buildApprovedCandidateCommand(conflictingApprovalTextRequest);
  const conflictingApprovalTextFreshness = await assessSourceApprovalFreshness(conflictingApprovalTextRequest, currentRevision);
  assert.equal(conflictingApprovalTextFreshness.status, STALE_OR_DIRTY_PUBLIC_DRY_RUN);
  assert.ok(conflictingApprovalTextFreshness.problems.some((problem) => problem.includes("exactly one reading= token")));

  const conflictingVideoApprovalTextRequest = buildRequest(receiptPath);
  conflictingVideoApprovalTextRequest.requestedApprovalText = `${conflictingVideoApprovalTextRequest.requestedApprovalText} video=https://example.com/other-video.mp4`;
  conflictingVideoApprovalTextRequest.nextCommands.approvedCandidateAfterCurrentTurnApproval = buildApprovedCandidateCommand(conflictingVideoApprovalTextRequest);
  const conflictingVideoApprovalTextFreshness = await assessSourceApprovalFreshness(conflictingVideoApprovalTextRequest, currentRevision);
  assert.equal(conflictingVideoApprovalTextFreshness.status, STALE_OR_DIRTY_PUBLIC_DRY_RUN);
  assert.ok(conflictingVideoApprovalTextFreshness.problems.some((problem) => problem.includes("exactly one video= token")));

  const conflictingTimestampApprovalTextRequest = buildRequest(receiptPath);
  conflictingTimestampApprovalTextRequest.requestedApprovalText = `${conflictingTimestampApprovalTextRequest.requestedApprovalText} timestamp=00:04`;
  conflictingTimestampApprovalTextRequest.nextCommands.approvedCandidateAfterCurrentTurnApproval = buildApprovedCandidateCommand(conflictingTimestampApprovalTextRequest);
  const conflictingTimestampApprovalTextFreshness = await assessSourceApprovalFreshness(conflictingTimestampApprovalTextRequest, currentRevision);
  assert.equal(conflictingTimestampApprovalTextFreshness.status, STALE_OR_DIRTY_PUBLIC_DRY_RUN);
  assert.ok(conflictingTimestampApprovalTextFreshness.problems.some((problem) => problem.includes("exactly one timestamp= token")));

  const missingApprovalTextRequest = buildRequest(receiptPath);
  missingApprovalTextRequest.requestedApprovalText = "";
  missingApprovalTextRequest.nextCommands.approvedCandidateAfterCurrentTurnApproval = buildApprovedCandidateCommand(missingApprovalTextRequest);
  const missingApprovalTextFreshness = await assessSourceApprovalFreshness(missingApprovalTextRequest, currentRevision);
  assert.equal(missingApprovalTextFreshness.status, STALE_OR_DIRTY_PUBLIC_DRY_RUN);
  assert.ok(missingApprovalTextFreshness.problems.some((problem) => problem.includes("approval text is missing")));

  const invalidJsonReceiptPath = join(tmp, "invalid-json-receipt.json");
  await writeFile(invalidJsonReceiptPath, "{not-json}\n");
  const invalidJsonRequest = buildRequest(invalidJsonReceiptPath);
  invalidJsonRequest.nextCommands.approvedCandidateAfterCurrentTurnApproval = buildApprovedCandidateCommand(invalidJsonRequest);
  const invalidJsonFreshness = await assessSourceApprovalFreshness(invalidJsonRequest, currentRevision);
  assert.equal(invalidJsonFreshness.status, STALE_OR_DIRTY_PUBLIC_DRY_RUN);
  assert.ok(invalidJsonFreshness.problems.some((problem) => problem.includes("unreadable JSON")));

  const mismatchedCommandRequest = buildRequest(receiptPath);
  mismatchedCommandRequest.nextCommands.approvedCandidateAfterCurrentTurnApproval = "npm run external:validate -- --approved-current-turn --reading-url 'https://example.com/wrong'";
  const mismatchedCommand = await assessSourceApprovalFreshness(mismatchedCommandRequest, currentRevision);
  assert.equal(mismatchedCommand.status, STALE_OR_DIRTY_PUBLIC_DRY_RUN);
  assert.ok(mismatchedCommand.problems.some((problem) => problem.includes("does not match receipt-validated sources")));
  const expectedCandidateCommand = buildApprovedCandidateCommand(mismatchedCommandRequest);
  assert.match(expectedCandidateCommand, /example\.com\/reading/);
  assert.match(expectedCandidateCommand, /--source-approval-request '.codex-tmp\/external-source-validation\/source-approval-request\.json'/);
  assert.doesNotMatch(expectedCandidateCommand, /example\.com\/wrong/);
  const freshSourceCommands = buildFreshSourceCommands(mismatchedCommandRequest);
  assert.match(freshSourceCommands.refreshPublicDryRun, /example\.com\/reading/);
  assert.doesNotMatch(freshSourceCommands.refreshPublicDryRun, /example\.com\/wrong/);
  assert.match(freshSourceCommands.refreshedApprovalRequest, /--out '.codex-tmp\/external-source-validation\/source-approval-request\.json'/);
  assert.match(freshSourceCommands.refreshedApprovalRequest, /--markdown-out '.codex-tmp\/external-source-validation\/source-approval-request\.md'/);
  assert.match(freshSourceCommands.approvalCheck, /npm run external:approval-check/);
  assert.match(freshSourceCommands.approvalCheck, /--source-approval-request '.codex-tmp\/external-source-validation\/source-approval-request\.json'/);
  assert.match(freshSourceCommands.approvalCheck, /source-approval-check\.json/);
  assert.match(freshSourceCommands.approvedCandidateAfterCurrentTurnApproval, /--source-approval-request '.codex-tmp\/external-source-validation\/source-approval-request\.json'/);
  assert.match(freshSourceCommands.approvedCandidateAfterCurrentTurnApproval, /<approved-reading-url>/);

  const customApprovalPathRequest = buildRequest(receiptPath);
  customApprovalPathRequest.approvalRequestPath = join(tmp, "custom approval request.json");
  customApprovalPathRequest.nextCommands.approvedCandidateAfterCurrentTurnApproval = buildApprovedCandidateCommand(customApprovalPathRequest);
  const customFreshSourceCommands = buildFreshSourceCommands(customApprovalPathRequest);
  assert.match(customFreshSourceCommands.refreshedApprovalRequest, /--out '.*custom approval request\.json'/);
  assert.match(customFreshSourceCommands.refreshedApprovalRequest, /--markdown-out '.*custom approval request\.md'/);
  assert.match(customFreshSourceCommands.approvalCheck, /--source-approval-request '.*custom approval request\.json'/);
  assert.match(customFreshSourceCommands.approvedCandidateAfterCurrentTurnApproval, /--source-approval-request '.*custom approval request\.json'/);

  const missing = await assessSourceApprovalFreshness(null, currentRevision);
  assert.equal(missing.status, "MISSING_SOURCE_APPROVAL_REQUEST");

  console.log("source_approval_freshness_selftest_ok");
} finally {
  await rm(tmp, { recursive: true, force: true });
}

async function git(cwd, args) {
  const result = await runCommand("git", args, cwd);
  assert.equal(result.code, 0, result.stderr || result.stdout);
  return result;
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

function buildReceipt(gitHead = "abc123") {
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

function buildRequest(receiptPath, gitHead = "abc123") {
  return {
    schema: "learning-companion.external-source-approval-request.v1",
    evidenceTier: "SOURCE_APPROVAL_REQUEST_ONLY",
    canClaimExternalKo: false,
    approvalRequestPath: ".codex-tmp/external-source-validation/source-approval-request.json",
    basis: {
      type: "PUBLIC_SOURCE_DRY_RUN_RECEIPT",
      inputPath: receiptPath,
      priorDryRunReceipt: receiptPath,
      priorDryRun: {
        gitHead,
        dirtyWorktree: false,
        profileRetained: false,
        profileCleanupOk: true
      }
    },
    sources: {
      reading: {
        url: "https://example.com/reading"
      },
      video: {
        url: "https://example.com/video.mp4",
        timestamp: "00:03"
      }
    },
    requestedApprovalText: "I approve these exact public learning-material sources for the current turn: reading=https://example.com/reading video=https://example.com/video.mp4 timestamp=00:03 They may be used for Learning Companion external-source validation screenshots and privacy review.",
    nextCommands: {
      approvedCandidateAfterCurrentTurnApproval: ""
    }
  };
}
