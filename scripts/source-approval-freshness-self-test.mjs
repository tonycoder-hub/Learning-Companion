#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  CURRENT_CLEAN_PUBLIC_DRY_RUN,
  STALE_OR_DIRTY_PUBLIC_DRY_RUN,
  assessSourceApprovalFreshness,
  buildApprovedCandidateCommand,
  buildFreshSourceCommands
} from "./lib/source-approval-freshness.mjs";

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
  assert.doesNotMatch(expectedCandidateCommand, /example\.com\/wrong/);
  const freshSourceCommands = buildFreshSourceCommands(mismatchedCommandRequest);
  assert.match(freshSourceCommands.refreshPublicDryRun, /example\.com\/reading/);
  assert.doesNotMatch(freshSourceCommands.refreshPublicDryRun, /example\.com\/wrong/);
  assert.match(freshSourceCommands.approvedCandidateAfterCurrentTurnApproval, /<approved-reading-url>/);

  const missing = await assessSourceApprovalFreshness(null, currentRevision);
  assert.equal(missing.status, "MISSING_SOURCE_APPROVAL_REQUEST");

  console.log("source_approval_freshness_selftest_ok");
} finally {
  await rm(tmp, { recursive: true, force: true });
}

function buildReceipt() {
  return {
    schema: "learning-companion.external-source-validation-browser.v1",
    evidenceTier: "PUBLIC_SOURCE_DRY_RUN",
    publicSourceDryRun: true,
    canClaimExternalKo: false,
    runContext: {
      appRevision: {
        gitHead: "abc123",
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

function buildRequest(receiptPath) {
  return {
    basis: {
      type: "PUBLIC_SOURCE_DRY_RUN_RECEIPT",
      inputPath: receiptPath,
      priorDryRunReceipt: receiptPath,
      priorDryRun: {
        gitHead: "abc123",
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
    requestedApprovalText: "I approve the exact test sources.",
    nextCommands: {
      approvedCandidateAfterCurrentTurnApproval: ""
    }
  };
}
