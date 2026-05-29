#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "dist/morning-demo";
const EVIDENCE_TIERS = new Set(["EXECUTED", "DRY_RUN", "HANDOFF_ONLY", "PENDING_USER_GATE"]);

const files = {
  summary: "SUMMARY.json",
  evidence: "EVIDENCE_TIERS.json",
  captureResume: "CAPTURE_RESUME_RECEIPT.json",
  determinism: "DETERMINISM.json",
  mirrorIntegrity: "MIRROR_INTEGRITY.json",
  feishuPlan: "feishu-upload/feishu-upload-plan.json",
  feishuReport: "feishu-upload/feishu-upload-report.json"
};

const summary = readJson(files.summary);
const evidence = readJson(files.evidence);
const captureResume = readJson(files.captureResume);
const determinism = readJson(files.determinism);
const mirrorIntegrity = readJson(files.mirrorIntegrity);
const feishuPlan = readJson(files.feishuPlan);
const feishuReport = readJson(files.feishuReport);

assert.equal(summary.ok, true);
assertEvidence(summary.evidence, "EXECUTED", "SUMMARY.json");
assert.equal(summary.assertions.captureResumeVisibleInToday, true);
assert.equal(summary.assertions.mirrorIntegrityOk, true);
assert.equal(summary.assertions.morningDeterministic, true);
assert.equal(summary.assertions.feishuUploadWouldSendNoNetwork, true);

assert.equal(evidence.schema, "learning-companion.evidence-tiers.v1");
assert.equal(evidence.summary.artifactCount > 0, true);
assert.equal(evidence.artifacts.every((artifact) => {
  assertEvidence(artifact.evidence, artifact.evidence.tier, artifact.path);
  return Boolean(artifact.path && artifact.sha256 && artifact.bytes > 0);
}), true);

assert.equal(captureResume.schema, "learning-companion.capture-resume-receipt.v1");
assertEvidence(captureResume.evidence, "EXECUTED", files.captureResume);
assert.equal(captureResume.roundTrip.ok, true);
assert.equal(captureResume.roundTrip.allInputsVisibleInToday, true);
assert.equal(captureResume.roundTrip.todayHashChanged, true);
assert.equal(captureResume.roundTrip.focusBriefNextAction, "synthesize");

assert.equal(determinism.schema, "learning-companion.morning-determinism-report.v1");
assertEvidence(determinism.evidence, "EXECUTED", files.determinism);
assert.equal(determinism.ok, true);
assert.equal(determinism.summary.differences, 0);
assert.equal(determinism.firstOutputSha256, determinism.secondOutputSha256);

assert.equal(mirrorIntegrity.schema, "learning-companion.mirror-integrity-report.v1");
assertEvidence(mirrorIntegrity.evidence, "EXECUTED", files.mirrorIntegrity);
assert.equal(mirrorIntegrity.ok, true);
assert.equal(mirrorIntegrity.summary.brokenLinks, 0);

assert.equal(feishuPlan.schema, "learning-companion.feishu-upload-plan.v1");
assertEvidence(feishuPlan.evidence, "DRY_RUN", files.feishuPlan);
assert.equal(feishuPlan.provider.auth.status, "not-included");

assert.equal(feishuReport.schema, "learning-companion.feishu-upload-report.v1");
assertEvidence(feishuReport.evidence, "DRY_RUN", files.feishuReport);
assert.equal(feishuReport.boundary.network, "not-called");
assert.equal(feishuReport.wouldSend.status, "not-sent");
assert.equal(feishuReport.wouldSend.requests.every((request) => /^[a-f0-9]{64}$/.test(request.payloadSha256)), true);

console.log("morning_receipts_ok");

function assertEvidence(evidence, expectedTier, label) {
  assert.equal(Boolean(evidence), true, `${label} missing evidence`);
  assert.equal(EVIDENCE_TIERS.has(evidence.tier), true, `${label} has unknown evidence tier`);
  assert.equal(evidence.tier, expectedTier, `${label} evidence tier mismatch`);
  assert.equal(evidence.label, `EVIDENCE: ${expectedTier}`);
  assert.equal(typeof evidence.reason, "string", `${label} missing evidence reason`);
  assert.equal(evidence.reason.length > 0, true, `${label} empty evidence reason`);
}

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}
