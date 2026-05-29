#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "dist/morning-demo";
const EVIDENCE_TIERS = new Set(["EXECUTED", "DRY_RUN", "HANDOFF_ONLY", "PENDING_USER_GATE"]);

const files = {
  summary: "SUMMARY.json",
  evidence: "EVIDENCE_TIERS.json",
  deferredGates: "DEFERRED_GATES.json",
  captureResume: "CAPTURE_RESUME_RECEIPT.json",
  sourceTimeLinks: "SOURCE_TIME_LINKS_RECEIPT.json",
  patchIntakeNegative: "PATCH_INTAKE_NEGATIVE_RECEIPT.json",
  adversarial: "ADVERSARIAL_GATES.json",
  determinism: "DETERMINISM.json",
  mirrorIntegrity: "MIRROR_INTEGRITY.json",
  harmonyScaffold: "HARMONY_SCAFFOLD_REPORT.json",
  harmonyReaderView: "sample-harmony-reader-view.json",
  morningReview: "MORNING_REVIEW.md",
  demoScript: "DEMO_SCRIPT.md",
  stage: "STAGE.md",
  reviewStartHere: "review-start-here.html",
  mirrorHome: "mirror-folder/index.html",
  manualQa: "MAC_MANUAL_QA.md",
  feishuPlan: "feishu-upload/feishu-upload-plan.json",
  feishuReport: "feishu-upload/feishu-upload-report.json"
};

const summary = readJson(files.summary);
const evidence = readJson(files.evidence);
const deferredGates = readJson(files.deferredGates);
const captureResume = readJson(files.captureResume);
const sourceTimeLinks = readJson(files.sourceTimeLinks);
const patchIntakeNegative = readJson(files.patchIntakeNegative);
const adversarial = readJson(files.adversarial);
const determinism = readJson(files.determinism);
const mirrorIntegrity = readJson(files.mirrorIntegrity);
const harmonyScaffold = readJson(files.harmonyScaffold);
const harmonyReaderView = readJson(files.harmonyReaderView);
const morningReview = readText(files.morningReview);
const demoScript = readText(files.demoScript);
const stage = readText(files.stage);
const reviewStartHere = readText(files.reviewStartHere);
const mirrorHome = readText(files.mirrorHome);
const sourceTimeLinksRaw = readText(files.sourceTimeLinks);
const manualQa = readText(files.manualQa);
const feishuPlan = readJson(files.feishuPlan);
const feishuReport = readJson(files.feishuReport);

assert.equal(summary.ok, true);
assertEvidence(summary.evidence, "EXECUTED", "SUMMARY.json");
assert.equal(summary.assertions.captureResumeVisibleInToday, true);
assert.equal(summary.assertions.captureDraftDueReviewOverrideAllowed, false);
assert.equal(summary.assertions.sourceTimeLinksOk, true);
assert.equal(summary.assertions.sourceTimeLinksPassed, summary.assertions.sourceTimeLinksCases);
assert.equal(summary.assertions.sourceTimeLinksLiveSiteVerified, false);
assert.equal(summary.assertions.mirrorIntegrityOk, true);
assert.equal(summary.assertions.morningDeterministic, true);
assert.equal(summary.assertions.feishuUploadWouldSendNoNetwork, true);
assert.equal(summary.assertions.deferredGatesPending >= 5, true);
assert.equal(summary.assertions.patchIntakeNegativeExpectedFailures, summary.assertions.patchIntakeNegativeCases);
assert.equal(summary.assertions.harmonyScaffoldOk, true);
assert.equal(summary.assertions.harmonyReaderOpenQuestions, 1);
assert.equal(summary.assertions.harmonyReaderOpenQuestionPreviewCount, 1);
assert.equal(summary.assertions.harmonyReaderAnsweredQuestionFlags >= 1, true);

assert.equal(evidence.schema, "learning-companion.evidence-tiers.v1");
assert.equal(evidence.summary.artifactCount > 0, true);
assert.equal(evidence.artifacts.every((artifact) => {
  assertEvidence(artifact.evidence, artifact.evidence.tier, artifact.path);
  return Boolean(artifact.path && artifact.sha256 && artifact.bytes > 0);
}), true);
assert.equal(evidence.artifacts.some((artifact) => artifact.path === files.demoScript), true);

assert.equal(deferredGates.schema, "learning-companion.deferred-gates.v1");
assertEvidence(deferredGates.evidence, "PENDING_USER_GATE", files.deferredGates);
assert.equal(deferredGates.summary.status, "not_live_ready");
assert.equal(deferredGates.summary.pending, deferredGates.gates.length);
assert.equal(deferredGates.gates.every((gate) => gate.status === "deferred_no_approval"), true);
assert.equal(deferredGates.gates.some((gate) => gate.id === "feishu_live_write"), true);
assert.equal(deferredGates.gates.some((gate) => gate.id === "mac_gui_selected_text"), true);

assert.equal(captureResume.schema, "learning-companion.capture-resume-receipt.v1");
assertEvidence(captureResume.evidence, "EXECUTED", files.captureResume);
assert.equal(captureResume.roundTrip.ok, true);
assert.equal(captureResume.roundTrip.allInputsVisibleInToday, true);
assert.equal(captureResume.roundTrip.todayHashChanged, true);
assert.equal(captureResume.roundTrip.focusBriefNextAction, "synthesize");
assert.equal(captureResume.draftFocus.schema, "learning-companion.capture-draft-focus-receipt.v1");
assert.equal(captureResume.draftFocus.cases.dueReviewBeatsFreshDraft.shouldOverride, false);
assert.equal(captureResume.draftFocus.cases.dueReviewBeatsFreshDraft.blockedByReview, true);
assert.equal(captureResume.draftFocus.cases.freshDraftBeatsSynthesis.shouldOverride, true);
assert.equal(captureResume.draftFocus.cases.staleDraftDoesNotOverride.shouldOverride, false);
assert.equal(captureResume.draftFocus.cases.timestampOnlyDoesNotOverride.shouldOverride, false);

assert.equal(sourceTimeLinks.schema, "learning-companion.source-time-links-receipt.v1");
assertEvidence(sourceTimeLinks.evidence, "EXECUTED", files.sourceTimeLinks);
assert.equal(sourceTimeLinks.summary.ok, true);
assert.equal(sourceTimeLinks.summary.passed, sourceTimeLinks.summary.cases);
assert.equal(sourceTimeLinks.summary.liveSiteVerified, false);
assert.deepEqual([...sourceTimeLinks.providers].sort(), ["bilibili", "vimeo", "youtube"]);
assert.deepEqual([...sourceTimeLinks.unsupportedHosts].sort(), ["b23.tv"]);
assert.deepEqual(sourceTimeLinks.cases.map((item) => item.id).sort(), [
  "bilibili_desktop_no_part",
  "bilibili_mobile_part_preserved",
  "non_video_t_preserved",
  "unsupported_short_link_preserved",
  "vimeo_multikey_hash",
  "vimeo_non_key_hash_preserved",
  "vimeo_path_style",
  "youtube_duration_hours",
  "youtube_malformed_time_stripped",
  "youtube_param_precedence",
  "youtube_short_link_zero"
]);
assert.equal(sourceTimeLinks.cases.every((item) => item.ok), true);
const sourceTimeManifestEntry = summary.outputManifest.find((entry) => entry.path === files.sourceTimeLinks);
assert.equal(Boolean(sourceTimeManifestEntry), true, "summary output manifest missing source time links receipt");
assert.equal(sourceTimeManifestEntry.sha256, sha256(sourceTimeLinksRaw));
assert.equal(sourceTimeManifestEntry.bytes, Buffer.byteLength(sourceTimeLinksRaw));

assert.equal(patchIntakeNegative.schema, "learning-companion.patch-intake-negative-receipt.v1");
assertEvidence(patchIntakeNegative.evidence, "EXECUTED", files.patchIntakeNegative);
assert.equal(patchIntakeNegative.summary.ok, true);
assert.equal(patchIntakeNegative.summary.expectedFailuresObserved, patchIntakeNegative.summary.cases);
assert.equal(patchIntakeNegative.summary.malformedRejected, true);
assert.equal(patchIntakeNegative.summary.oversizedRejected, true);
assert.equal(patchIntakeNegative.summary.duplicateReviewSkipped, true);
assert.equal(patchIntakeNegative.summary.staleReviewConflictSkipped, true);
assert.equal(patchIntakeNegative.cases.every((item) => item.expectedFailureObserved), true);

assert.equal(adversarial.schema, "learning-companion.adversarial-gates-report.v1");
assertEvidence(adversarial.evidence, "EXECUTED", files.adversarial);
assert.equal(adversarial.ok, true);
assert.equal(adversarial.checks.every((check) => check.expectedFailureObserved), true);

assert.equal(determinism.schema, "learning-companion.morning-determinism-report.v1");
assertEvidence(determinism.evidence, "EXECUTED", files.determinism);
assert.equal(determinism.ok, true);
assert.equal(determinism.summary.differences, 0);
assert.equal(determinism.firstOutputSha256, determinism.secondOutputSha256);

assert.equal(mirrorIntegrity.schema, "learning-companion.mirror-integrity-report.v1");
assertEvidence(mirrorIntegrity.evidence, "EXECUTED", files.mirrorIntegrity);
assert.equal(mirrorIntegrity.ok, true);
assert.equal(mirrorIntegrity.summary.brokenLinks, 0);

assert.equal(harmonyScaffold.schema, "learning-companion.harmony-scaffold-report.v1");
assertEvidence(harmonyScaffold.evidence, "HANDOFF_ONLY", files.harmonyScaffold);
assert.equal(harmonyScaffold.ok, true);
assert.equal(harmonyScaffold.app.bundleName, "com.tonycoder.learningcompanion");
assert.equal(harmonyScaffold.pages.includes("pages/Index"), true);
assert.equal(harmonyScaffold.checks.every((check) => check.ok), true);
assert.equal(Object.values(harmonyScaffold.schemaParity).every((item) => item.ok), true);

assert.equal(harmonyReaderView.schema, "learning-companion.harmony-reader-view.v1");
assert.equal(harmonyReaderView.workspace.openQuestionCount, summary.assertions.harmonyReaderOpenQuestions);
assert.equal(harmonyReaderView.openQuestions.length, summary.assertions.harmonyReaderOpenQuestionPreviewCount);
assert.equal(harmonyReaderView.openQuestions[0].thought, "How should I compare Rust traits with TypeScript interfaces?");
assert.equal(harmonyReaderView.recentCaptures.some((capture) => capture.isQuestion && !capture.isOpenQuestion && capture.questionResolvedAt), true);

assert.equal(feishuPlan.schema, "learning-companion.feishu-upload-plan.v1");
assertEvidence(feishuPlan.evidence, "DRY_RUN", files.feishuPlan);
assert.equal(feishuPlan.provider.auth.status, "not-included");

assert.equal(feishuReport.schema, "learning-companion.feishu-upload-report.v1");
assertEvidence(feishuReport.evidence, "DRY_RUN", files.feishuReport);
assert.equal(feishuReport.boundary.network, "not-called");
assert.equal(feishuReport.wouldSend.status, "not-sent");
assert.equal(feishuReport.wouldSend.requests.every((request) => /^[a-f0-9]{64}$/.test(request.payloadSha256)), true);
assert.equal(feishuReport.targetTree.layout, "folder-files");
assert.equal(feishuReport.targetTree.directories.includes("sessions"), true);
assert.equal(feishuReport.targetTree.files.length, feishuReport.wouldSend.requestCount);
assert.equal(feishuReport.targetTree.files.every((file) => /^[a-f0-9]{64}$/.test(file.payloadSha256)), true);

assert.match(morningReview, /^## What Tony Will Not See Working Tonight$/m);
assert.match(morningReview, /DEMO_SCRIPT\.md/);
assert.match(morningReview, /CAPTURE_RESUME_RECEIPT\.json/);
assert.match(morningReview, /SOURCE_TIME_LINKS_RECEIPT\.json/);
assert.match(morningReview, /No executed local browser smoke in this run/);
assert.match(morningReview, /Live video-site playback QA is not proven/);
assert.match(morningReview, /When the separate browser gate is allowed/);
assert.match(morningReview, /stale seven-day export/);
assert.match(morningReview, /1 open question/);
assert.match(stage, /1 open question/);
assert.match(reviewStartHere, /1 open question/);
assert.match(mirrorHome, /Open Question Preview/);
assert.match(mirrorHome, /1 open question/);
assert.match(mirrorHome, /How should I compare Rust traits with TypeScript interfaces\?/);
assert.match(demoScript, /Do not treat dry-run Feishu files/);
assert.match(demoScript, /Source time receipt/);
assert.match(demoScript, /live video-site playback QA is not proven/);
assert.match(stage, /Live video-site playback QA is not proven/);
assert.match(reviewStartHere, /live video-site playback QA is not proven/i);
assert.match(demoScript, /leave anything approval\/device-bound as `NT` or `BLOCKED`/);
assert.match(manualQa, /verify the downloaded JSON file yourself/);
assert.match(manualQa, /Focus Brief question signal/);
assert.match(manualQa, /Open question handoff/);
assert.match(manualQa, /Question close loop/);
assert.match(manualQa, /Make card creates a review card/);

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

function readText(path) {
  return readFileSync(join(ROOT, path), "utf8");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
