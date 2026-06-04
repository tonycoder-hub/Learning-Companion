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
  dogfoodRunbook: "DOGFOOD_RUNBOOK.md",
  reviewStartHere: "review-start-here.html",
  staticReturnContract: "STATIC_RETURN_CONTRACT.md",
  agentStudyLoopSmoke: "AGENT_STUDY_LOOP_SMOKE.md",
  mirrorHome: "mirror-folder/index.html",
  manualQa: "MAC_MANUAL_QA.md",
  windowsStaticQa: "WINDOWS_STATIC_QA.md",
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
const dogfoodRunbook = readText(files.dogfoodRunbook);
const dogfoodRows = parseDogfoodRunbookRows(dogfoodRunbook);
const reviewStartHere = readText(files.reviewStartHere);
const staticReturnContract = readText(files.staticReturnContract);
const agentStudyLoopSmoke = readText(files.agentStudyLoopSmoke);
const mirrorHome = readText(files.mirrorHome);
const sourceTimeLinksRaw = readText(files.sourceTimeLinks);
const manualQa = readText(files.manualQa);
const windowsStaticQa = readText(files.windowsStaticQa);
const windowsStaticQaResults = parseManualQaResults(windowsStaticQa);
const feishuPlan = readJson(files.feishuPlan);
const feishuReport = readJson(files.feishuReport);
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

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
assert.equal(summary.windowsStaticQa, files.windowsStaticQa);
assert.equal(summary.dogfoodRunbook, files.dogfoodRunbook);
assert.equal(summary.windowsStaticQaReceipt.evidenceTier, "PENDING_USER_GATE");
assert.equal(summary.windowsStaticQaReceipt.evidenceStatus, "NOT_RUN");
assert.equal(summary.windowsStaticQaReceipt.receiptOnly, true);
assert.equal(summary.windowsStaticQaReceipt.filled, 0);
assert.equal(summary.windowsStaticQaReceipt.total, 10);
assert.equal(summary.windowsStaticQaReceipt.nt, 10);

assert.equal(evidence.schema, "learning-companion.evidence-tiers.v1");
assert.equal(evidence.summary.artifactCount > 0, true);
assert.equal(evidence.artifacts.every((artifact) => {
  assertEvidence(artifact.evidence, artifact.evidence.tier, artifact.path);
  return Boolean(artifact.path && artifact.sha256 && artifact.bytes > 0);
}), true);
assert.equal(evidence.artifacts.some((artifact) => artifact.path === files.demoScript), true);
assert.equal(evidence.artifacts.some((artifact) => {
  if (artifact.path !== files.dogfoodRunbook) {
    return false;
  }
  assertEvidence(artifact.evidence, "PENDING_USER_GATE", files.dogfoodRunbook);
  return true;
}), true);
assert.equal(evidence.artifacts.some((artifact) => artifact.path === files.staticReturnContract), true);
assert.equal(evidence.artifacts.some((artifact) => {
  if (artifact.path !== files.agentStudyLoopSmoke) {
    return false;
  }
  assertEvidence(artifact.evidence, "EXECUTED", files.agentStudyLoopSmoke);
  return true;
}), true);
assert.equal(evidence.artifacts.some((artifact) => {
  if (artifact.path !== files.windowsStaticQa) {
    return false;
  }
  assertEvidence(artifact.evidence, "PENDING_USER_GATE", files.windowsStaticQa);
  return true;
}), true);

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
assert.equal(harmonyReaderView.workspace.parkedQuestionCount, summary.assertions.harmonyReaderParkedQuestions);
assert.equal(harmonyReaderView.workspace.unresolvedQuestionCount, summary.assertions.harmonyReaderOpenQuestions + summary.assertions.harmonyReaderParkedQuestions);
assert.equal(harmonyReaderView.openQuestions.length, summary.assertions.harmonyReaderOpenQuestionPreviewCount);
assert.equal(harmonyReaderView.openQuestions[0].thought, "How should I compare Rust traits with TypeScript interfaces?");
assert.equal(harmonyReaderView.parkedQuestions[0].thought, "When should I compare trait objects with TypeScript structural typing?");
assert.equal(harmonyReaderView.recentCaptures.some((capture) => capture.isQuestion && !capture.isOpenQuestion && capture.questionResolvedAt), true);
assert.equal(harmonyReaderView.recentCaptures.some((capture) => capture.isQuestion && capture.isParkedQuestion && capture.questionParkedAt), true);

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
assert.match(morningReview, /WINDOWS_STATIC_QA\.md/);
assert.match(morningReview, /No executed local browser smoke in this run/);
assert.match(morningReview, /Live video-site playback QA is not proven/);
assert.match(morningReview, /When the separate browser gate is allowed/);
assert.match(morningReview, /npm run check:static-return/);
assert.match(morningReview, /STATIC_CONTRACT_PLUS_FIXTURE_MODEL_IMPORT/);
assert.match(morningReview, /\.codex-tmp/);
assert.match(morningReview, /stale seven-day export/);
assert.match(morningReview, /1 open question/);
assert.match(morningReview, /1 parked question/);
assert.match(morningReview, /2 unresolved questions/);
assert.match(morningReview, /1 original question resolved/);
assert.match(stage, /1 open question/);
assert.match(stage, /1 parked question/);
assert.match(stage, /windows_static_qa/);
assert.match(stage, /RECEIPT_ONLY NOT_RUN\(0\/10\)/);
assert.match(stage, /WINDOWS_STATIC_QA\.md/);
assert.match(reviewStartHere, /1 open question/);
assert.match(reviewStartHere, /1 parked question/);
const firstReviewSection = reviewStartHere.match(/<section>[\s\S]*?<\/section>/)?.[0] || "";
assert.match(firstReviewSection, /Morning Dogfood Gate/);
assert.equal(reviewStartHere.indexOf("Morning Dogfood Gate") < reviewStartHere.indexOf("What To Inspect First"), true);
assert.equal(reviewStartHere.indexOf("Morning Dogfood Gate") < reviewStartHere.indexOf("Generated Artifacts"), true);
assert.match(reviewStartHere, /Morning Dogfood Gate/);
assert.match(reviewStartHere, /Generated status: NOT RUN/);
assert.match(reviewStartHere, /0 PASS \/ 11 NT \/ usable=false/);
assert.match(reviewStartHere, /until Tony fills the runbook from a real session/);
assert.match(reviewStartHere, /Run the real Mac loop first/);
assert.match(reviewStartHere, /spend 15 minutes on rows 1-6/);
assert.match(reviewStartHere, /Record friction in the row/);
assert.match(reviewStartHere, /Leave untouched rows as NT/);
assert.match(reviewStartHere, /Validate before claiming usable/);
assert.match(reviewStartHere, /real-run-receipt\.json/);
assert.equal(packageJson.scripts["dogfood:validate"], "node scripts/validate-dogfood-runbook.mjs");
assert.match(reviewStartHere, /npm run dogfood:validate -- --runbook dist\/morning-demo\/DOGFOOD_RUNBOOK\.md --out \.codex-tmp\/dogfood-runbook\/real-run-receipt\.json/);
assert.match(reviewStartHere, /What To Inspect First/);
assert.match(reviewStartHere, /Start with the Mac learning loop/);
assert.match(reviewStartHere, /DOGFOOD_RUNBOOK\.md/);
assert.match(reviewStartHere, /Dogfood Route/);
assert.match(reviewStartHere, /record step count, time, and every failure/);
assert.match(reviewStartHere, /Mac Capture Sidecar/);
assert.match(reviewStartHere, /controlled-agent-browser-smoke/);
assert.match(reviewStartHere, /CONTROLLED_AGENT_BROWSER_SMOKE/);
assert.match(reviewStartHere, /provesRealUserDogfood=false/);
assert.match(reviewStartHere, /not real dogfood/);
assert.match(reviewStartHere, /no Mac\/Windows\/HarmonyOS\/Feishu\/native picker\/file movement coverage/);
assert.match(reviewStartHere, /source\/time context strip/);
assert.match(reviewStartHere, /First-Run First Note/);
assert.match(reviewStartHere, /without repeating Open source/);
assert.match(reviewStartHere, /Capture this thought/);
assert.match(reviewStartHere, /Mac Loop/);
assert.match(reviewStartHere, /Thought lane is the focused writing target/);
assert.match(reviewStartHere, /STATIC_RETURN_CONTRACT\.md/);
assert.match(reviewStartHere, /npm run check:static-return/);
assert.doesNotMatch(reviewStartHere, /First-Run Start Here/);
assert.doesNotMatch(reviewStartHere, /First-run Start Here/);
assert.match(reviewStartHere, /Today Section Map/);
assert.match(reviewStartHere, /Harmony Reader Session/);
assert.match(reviewStartHere, /rejected-kept-current/);
assert.match(reviewStartHere, /Focus Loop/);
assert.match(reviewStartHere, /Question Closure/);
assert.match(reviewStartHere, /Question Queue Health/);
assert.match(reviewStartHere, /Windows Static Return/);
assert.match(reviewStartHere, /WINDOWS_STATIC_QA\.md/);
assert.match(reviewStartHere, /Evidence Boundary/);
assert.match(staticReturnContract, /^# Static Return Contract$/m);
assert.match(staticReturnContract, /npm run check:static-return/);
assert.match(staticReturnContract, /Positive scope:/);
assert.match(staticReturnContract, /generated static Review\/Inbox HTML matches the declared local return contract/);
assert.match(staticReturnContract, /does not write to Downloads/);
assert.match(staticReturnContract, /STATIC_CONTRACT_PLUS_FIXTURE_MODEL_IMPORT/);
assert.match(staticReturnContract, /does not prove a real user-created return file/);
assert.match(agentStudyLoopSmoke, /^# controlled-agent-browser-smoke$/m);
assert.match(agentStudyLoopSmoke, /Canonical label: `controlled-agent-browser-smoke`/);
assert.match(agentStudyLoopSmoke, /npm run agent:study-loop/);
assert.match(agentStudyLoopSmoke, /\.codex-tmp\/agent-study-loop-smoke\/receipt\.json/);
assert.match(agentStudyLoopSmoke, /learning-companion\.agent-study-loop-smoke\.v1/);
assert.match(agentStudyLoopSmoke, /CONTROLLED_AGENT_BROWSER_SMOKE/);
assert.match(agentStudyLoopSmoke, /provesRealUserDogfood=false/);
assert.match(agentStudyLoopSmoke, /Not a human dogfood session/);
assert.match(agentStudyLoopSmoke, /Not Mac WKWebView coverage/);
assert.match(agentStudyLoopSmoke, /Cannot fill any row in `DOGFOOD_RUNBOOK\.md` or `MAC_MANUAL_QA\.md`/);
assert.match(mirrorHome, /Open Question Preview/);
assert.match(mirrorHome, /1 open question/);
assert.match(mirrorHome, /How should I compare Rust traits with TypeScript interfaces\?/);
assert.match(demoScript, /Do not treat dry-run Feishu files/);
assert.match(demoScript, /STATIC_RETURN_CONTRACT\.md/);
assert.match(demoScript, /DOGFOOD_RUNBOOK\.md/);
assert.match(demoScript, /static-return fixture imports/);
assert.match(demoScript, /Source time receipt/);
assert.match(demoScript, /WINDOWS_STATIC_QA\.md/);
assert.match(demoScript, /live video-site playback QA is not proven/);
assert.match(stage, /Live video-site playback QA is not proven/);
assert.match(reviewStartHere, /live video-site playback QA is not proven/i);
assert.match(dogfoodRunbook, /^# Learning Companion Dogfood Runbook$/m);
assert.match(dogfoodRunbook, /EVIDENCE: PENDING_USER_GATE/);
assert.match(dogfoodRunbook, /not evidence until the Result column is filled from an actual run/);
assert.match(dogfoodRunbook, /record step count, time, and every failure/);
assert.match(dogfoodRunbook, /npm run demo:morning:serve -- --port 5174/);
assert.match(dogfoodRunbook, /http:\/\/127\.0\.0\.1:5174\//);
assert.match(dogfoodRunbook, /Mac Study Loop target: 15 minutes/);
assert.match(dogfoodRunbook, /Manual Device Loop target: 10 minutes/);
assert.match(dogfoodRunbook, /Manual device transport used/);
assert.match(dogfoodRunbook, /Total elapsed time/);
assert.match(dogfoodRunbook, /Mac Study Loop/);
assert.match(dogfoodRunbook, /Manual Device Loop/);
assert.match(dogfoodRunbook, /Mac loop friction observed/);
assert.match(dogfoodRunbook, /Add-to-Notes source-return count/);
assert.match(dogfoodRunbook, /Add-to-Notes View-note count/);
assert.match(dogfoodRunbook, /Manual device loop friction observed/);
assert.match(dogfoodRunbook, /must name the blocker/);
assert.match(dogfoodRunbook, /source-return wins 3 or more times/);
assert.match(dogfoodRunbook, /Import Dry-Run Helper/);
assert.match(dogfoodRunbook, /npm run demo:return-import-dry-run/);
assert.match(dogfoodRunbook, /npm run demo:return-import-dry-run:smoke/);
assert.match(dogfoodRunbook, /proves the harness, not a real device pass/);
assert.match(dogfoodRunbook, /Validate The Filled Runbook/);
assert.match(dogfoodRunbook, /npm run dogfood:validate/);
assert.match(dogfoodRunbook, /requires FAIL\/BLOCKED rows to name the friction or blocker/);
assert.match(dogfoodRunbook, /only allows a Mac dogfood claim when all Mac Study Loop rows are executed/);
assert.match(dogfoodRunbook, /source\.returnBaseFingerprint/);
assert.match(dogfoodRunbook, /Fixture receipts such as `npm run check:static-return` can support contract confidence, but cannot fill this table/);
assert.equal((dogfoodRunbook.match(/\| NT \|/g) || []).length, 11);
assert.equal(dogfoodRows.length, 11);
for (const row of dogfoodRows) {
  assert.equal(["PASS", "FAIL", "BLOCKED", "NT"].includes(row.result), true, `dogfood row ${row.step} has invalid result`);
  if (row.result === "BLOCKED") {
    assert.equal(row.notes.length > 0, true, `dogfood row ${row.step} BLOCKED without reason`);
  }
}
assert.match(morningReview, /Harmony reader session/);
assert.match(morningReview, /accepted reader view after a failed import/);
assert.match(demoScript, /leave anything approval\/device-bound as `NT` or `BLOCKED`/);
assert.match(manualQa, /verify the exported JSON file yourself/);
assert.match(manualQa, /First-run First Note/);
assert.match(manualQa, /Capture this thought focuses the Thought field/);
assert.match(manualQa, /Ask about this stages a `Question:` draft/);
assert.match(manualQa, /ready in Quick Capture for that source/);
assert.match(manualQa, /link a source later to anchor them/);
assert.doesNotMatch(manualQa, /First-run Start Here/);
assert.doesNotMatch(manualQa, /Capture this thought focuses Quick Capture/);
assert.match(manualQa, /Keyboard quick capture/);
assert.match(manualQa, /quote-only draft focuses Thought/);
assert.match(manualQa, /Source changed/);
assert.match(manualQa, /Use current/);
assert.match(manualQa, /Source time staging/);
assert.match(manualQa, /filled and pulsed/);
assert.match(manualQa, /source\/time context/);
assert.match(manualQa, /ArrowDown/);
assert.match(manualQa, /ArrowUp/);
assert.match(manualQa, /Time adjusted/);
assert.match(manualQa, /Source time staged/);
assert.match(manualQa, /Paste Source setup/);
assert.match(manualQa, /non-URL clipboard text is discarded/);
assert.match(manualQa, /not silently reclassified/);
assert.match(manualQa, /Today section map/);
assert.match(manualQa, /sidecar\/mobile widths/);
assert.match(manualQa, /Sidecar focus rail/);
assert.match(manualQa, /metric row is hidden/);
assert.match(manualQa, /clear loop says `Today`/);
assert.match(manualQa, /Focus Brief question signal/);
assert.match(manualQa, /Open question handoff/);
assert.match(manualQa, /Question close loop/);
assert.match(manualQa, /Park moves it to Parked Questions/);
assert.match(manualQa, /Answer starts an `Answer:` Quick Capture draft/);
assert.match(manualQa, /Make card creates a review card/);
assert.match(windowsStaticQa, /^# Learning Companion Windows Static QA Receipt$/m);
assert.match(windowsStaticQa, /EVIDENCE: PENDING_USER_GATE/);
assert.match(windowsStaticQa, /PENDING RECEIPT, not QA evidence/);
assert.match(windowsStaticQa, /Return-ready mirror/);
assert.match(windowsStaticQa, /review\.html/);
assert.match(windowsStaticQa, /inbox\.html/);
assert.match(windowsStaticQa, /source\.returnBaseFingerprint/);
assert.match(windowsStaticQa, /Pre-return fingerprint check/);
assert.match(windowsStaticQa, /Batch partial-import guard/);
assert.match(windowsStaticQa, /Return files imported/);
assert.match(windowsStaticQa, /Wrong file guard/);
assert.match(windowsStaticQa, /PASS`, `FAIL`, `BLOCKED`, or `NT`/);
assert.equal(windowsStaticQaResults.length, 10);
assert.deepEqual([...new Set(windowsStaticQaResults)], ["NT"]);
for (const line of windowsStaticQa.split("\n").filter((item) => item.includes("QA evidence"))) {
  assert.match(line, /not QA evidence/);
}

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

function parseManualQaResults(markdown) {
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.includes("| ---") && !line.includes("| Area |"))
    .map((line) => line.split("|").map((part) => part.trim())[4] || "");
}

function parseDogfoodRunbookRows(markdown) {
  return markdown
    .split("\n")
    .filter((line) => /^\| \d+ \|/.test(line))
    .map((line) => {
      const cells = line.split("|").map((part) => part.trim());
      return {
        step: cells[1],
        action: cells[2],
        expected: cells[3],
        result: cells[4],
        notes: cells[5] || ""
      };
    });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
