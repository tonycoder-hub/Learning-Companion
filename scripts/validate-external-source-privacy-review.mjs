#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const RECEIPT_SCHEMA = "learning-companion.external-source-validation-browser.v1";
const REVIEW_SCHEMA = "learning-companion.external-source-privacy-review.v1";
const CLAIM_SCHEMA = "learning-companion.external-source-ko-evidence-review.v1";
const SOURCE_APPROVAL_REQUEST_BINDING_SCHEMA = "learning-companion.source-approval-request-binding.v1";
const CURRENT_CLEAN_PUBLIC_DRY_RUN = "CURRENT_CLEAN_PUBLIC_DRY_RUN";
const PLACEHOLDER_REVIEW_TEXT = new Set(["tbd", "-", "--", "n/a", "na", "none", "no evidence", "placeholder", "todo"]);
const LEADING_REVIEW_DECORATION_PATTERN = /^(?:[`"'()[\]{}<>*_.,;:#\-\s]+|\d+[.)]\s*)+/;
const TRAILING_REVIEW_DECORATION_PATTERN = /[`"'()[\]{}<>*_.,;:#\-\s]+$/;
const PLACEHOLDER_REVIEW_PREFIX_PATTERN = /^(tbd|todo|placeholder|n\s*\/\s*a)(\b|[\s:;,.()[\]{}_-]|$)/;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const PRIVACY_REVIEW_SELF_TEST_PATH = ".codex-tmp/external-source-privacy-review-selftest/";

const args = parseArgs(process.argv.slice(2));
if (args.out === true) throw new Error("--out requires a file path.");

if (args["self-test"]) {
  await runSelfTest();
} else if (args["write-template"]) {
  const receiptPath = requireArg(args.receipt, "receipt");
  const outPath = requireArg(args.out, "out");
  const receipt = await readJson(receiptPath, "receipt");
  validateCandidateReceipt(receipt);
  assertNotPrivacyReviewSelfTestPath(receiptPath, "receiptPath");
  const template = buildReviewTemplate(receipt, receiptPath);
  await writeJson(outPath, template);
  console.log(`external_source_privacy_review_template_ok ${outPath}`);
} else {
  const receiptPath = requireArg(args.receipt, "receipt");
  const reviewPath = requireArg(args.review, "review");
  const outPath = args.out || defaultOutPath(reviewPath);
  const receipt = await readJson(receiptPath, "receipt");
  const review = await readJson(reviewPath, "review");
  const claim = validatePrivacyReview({ receipt, receiptPath, review, reviewPath });
  await writeJson(outPath, claim);
  console.log(`external_source_privacy_review_ok ${outPath}`);
}

function validatePrivacyReview({ receipt, receiptPath, review, reviewPath, allowSelfTestFixtures = false }) {
  const receiptSummary = validateCandidateReceipt(receipt);
  if (!allowSelfTestFixtures) {
    assertNotPrivacyReviewSelfTestPath(receiptPath, "receiptPath");
    assertNotPrivacyReviewSelfTestPath(reviewPath, "reviewPath");
  }
  assert.equal(review.schema, REVIEW_SCHEMA, "review schema mismatch");
  assertConcreteReviewText(review.reviewer, "reviewer");
  assertIsoDateTime(review.reviewedAt, "reviewedAt");
  assert.equal(review.receiptSchema, RECEIPT_SCHEMA, "review should name the receipt schema");
  assert.equal(review.sourceApproval?.currentTurnApprovalConfirmed, true, "current-turn source approval must be confirmed");
  assertConcreteReviewText(review.sourceApproval?.approvalReference, "sourceApproval.approvalReference");
  assert.equal(review.sourceApproval?.approvedReadingUrl, receiptSummary.reading.source.url, "approved reading URL must match receipt");
  assert.equal(review.sourceApproval?.approvedVideoUrl, receiptSummary.video.source.url, "approved video URL must match receipt");
  assert.equal(review.sourceApproval?.approvedVideoTimestamp, receiptSummary.sourceApprovalRequestBinding.approvedVideoTimestamp, "approved video timestamp must match receipt binding");
  assert.equal(review.sourceApproval?.approvedVideoTimestamp, receiptSummary.video.saved.captureTimestamp, "approved video timestamp must match captured video timestamp");
  assert.equal(review.sourceApproval?.sourceApprovalRequestPath, receiptSummary.sourceApprovalRequestBinding.requestPath, "source approval request path must match receipt binding");
  assert.equal(review.sourceApproval?.requestedApprovalText, receiptSummary.sourceApprovalRequestBinding.requestedApprovalText, "requested approval text must match receipt binding");
  assert.equal(review.sourceApproval?.sourceApprovalRequestFreshness, CURRENT_CLEAN_PUBLIC_DRY_RUN, "source approval request freshness must match current clean public dry-run status");
  assert.equal(review.sourceApproval?.sourceApprovalRequestCurrentGitHead, receiptSummary.sourceApprovalRequestBinding.currentGitHead, "source approval request current git HEAD must match receipt binding");
  assert.equal(review.sourceApproval?.sourceApprovalRequestBasisGitHead, receiptSummary.sourceApprovalRequestBinding.basisGitHead, "source approval request basis git HEAD must match receipt binding");

  [
    ["privacyReview.noVisibleAccountIdentity", review.privacyReview?.noVisibleAccountIdentity],
    ["privacyReview.noPrivateOrSensitiveContent", review.privacyReview?.noPrivateOrSensitiveContent],
    ["privacyReview.noSecretsTokensSessionIds", review.privacyReview?.noSecretsTokensSessionIds],
    ["privacyReview.noPrivateBrowserChrome", review.privacyReview?.noPrivateBrowserChrome],
    ["executionReview.runContextReviewed", review.executionReview?.runContextReviewed],
    ["executionReview.appRevisionRecorded", review.executionReview?.appRevisionRecorded],
    ["executionReview.readingSourceContextPass", review.executionReview?.readingSourceContextPass],
    ["executionReview.videoSourceContextPass", review.executionReview?.videoSourceContextPass],
    ["executionReview.videoTimestampPass", review.executionReview?.videoTimestampPass],
    ["executionReview.videoLearningToolsPass", review.executionReview?.videoLearningToolsPass]
  ].forEach(([label, value]) => assert.equal(value, true, `${label} must be true`));

  validateScreenshotReviewCoverage(review.privacyReview?.screenshotsReviewed, receiptSummary.files);
  assert.equal(review.verdict, "PASS", "privacy review verdict must be PASS");
  assert.equal(review.canUseForKo, true, "review must explicitly allow KO use");
  assertConcreteReviewText(review.notes, "notes");

  return {
    schema: CLAIM_SCHEMA,
    generatedAt: new Date().toISOString(),
    evidenceTier: "APPROVED_SOURCE_PRIVACY_REVIEWED",
    canClaimExternalKo: true,
    fixtureOnly: false,
    reviewKind: "HUMAN_PRIVACY_REVIEW",
    receiptPath,
    reviewPath,
    reviewer: review.reviewer,
    reviewedAt: review.reviewedAt,
    reviewedScreenshots: reviewedScreenshotsForClaim(review.privacyReview.screenshotsReviewed, receiptSummary.files),
    reading: {
      url: receiptSummary.reading.source.url,
      title: receiptSummary.reading.source.title,
      files: receiptSummary.reading.files
    },
    video: {
      url: receiptSummary.video.source.url,
      title: receiptSummary.video.source.title,
      timestamp: receiptSummary.video.saved.captureTimestamp,
      files: receiptSummary.video.files
    },
    sourceApprovalRequest: {
      schema: receiptSummary.sourceApprovalRequestBinding.schema,
      requestPath: receiptSummary.sourceApprovalRequestBinding.requestPath,
      requestSchema: receiptSummary.sourceApprovalRequestBinding.requestSchema,
      evidenceTier: receiptSummary.sourceApprovalRequestBinding.evidenceTier,
      canClaimExternalKo: receiptSummary.sourceApprovalRequestBinding.canClaimExternalKo,
      requestedApprovalText: receiptSummary.sourceApprovalRequestBinding.requestedApprovalText,
      freshnessStatus: receiptSummary.sourceApprovalRequestBinding.freshnessStatus,
      requestedApprovalTextMatched: receiptSummary.sourceApprovalRequestBinding.requestedApprovalTextMatched,
      approvedReadingUrl: receiptSummary.sourceApprovalRequestBinding.approvedReadingUrl,
      approvedVideoUrl: receiptSummary.sourceApprovalRequestBinding.approvedVideoUrl,
      approvedVideoTimestamp: receiptSummary.sourceApprovalRequestBinding.approvedVideoTimestamp,
      currentGitHead: receiptSummary.sourceApprovalRequestBinding.currentGitHead,
      currentDirtyWorktree: receiptSummary.sourceApprovalRequestBinding.currentDirtyWorktree,
      basisGitHead: receiptSummary.sourceApprovalRequestBinding.basisGitHead,
      basisDirtyWorktree: receiptSummary.sourceApprovalRequestBinding.basisDirtyWorktree,
      basisReceiptPath: receiptSummary.sourceApprovalRequestBinding.basisReceiptPath,
      basisProfileCleanupOk: receiptSummary.sourceApprovalRequestBinding.basisProfileCleanupOk,
      basisProfileRetained: receiptSummary.sourceApprovalRequestBinding.basisProfileRetained,
      problems: receiptSummary.sourceApprovalRequestBinding.problems
    },
    runContext: summarizeRunContextForClaim(receipt.runContext),
    claimBoundary: {
      proves: [
        "One approved reading source worked in this browser/app evidence run.",
        "One approved video source worked in this browser/app evidence run with timestamp evidence.",
        "The approved video run exercised timestamp notes, video bookmarks, and playback-rate persistence.",
        "The candidate screenshots were reviewed for private or sensitive content before KO use."
      ],
      doesNotProve: [
        "All reading sites work.",
        "All video platforms work.",
        "Authenticated/private sources are supported.",
        "Windows, HarmonyOS device, or native Mac GUI behavior."
      ]
    }
  };
}

function validateCandidateReceipt(receipt) {
  assert.equal(receipt.schema, RECEIPT_SCHEMA, "receipt schema mismatch");
  assert.equal(receipt.evidenceTier, "APPROVED_SOURCE_CANDIDATE", "receipt must be a real approved-source candidate");
  assert.equal(receipt.selfTest, false, "local fixture self-tests cannot be privacy-reviewed into KO evidence");
  assert.equal(receipt.approvedCurrentTurn, true, "receipt must record current-turn approval");
  assert.equal(receipt.canClaimExternalKo, false, "candidate receipt should not directly claim KO");
  validateRunContext(receipt.runContext);
  assert.equal(Array.isArray(receipt.runs), true, "receipt runs must be an array");
  assert.equal(receipt.runs.length, 2, "receipt must include exactly reading and video runs");
  const reading = receipt.runs.find((run) => run.source?.type === "reading");
  const video = receipt.runs.find((run) => run.source?.type === "video");
  assert.ok(reading, "receipt missing reading run");
  assert.ok(video, "receipt missing video run");

  receipt.runs.forEach((run) => {
    assertHttpUrl(run.source?.url, `${run.source?.type || "source"}.url`);
    assertApprovedExternalUrl(run.source?.url, `${run.source?.type || "source"}.url`);
    assertNonTbd(run.source?.title, `${run.source?.type || "source"}.title`);
    assert.equal(run.source?.approved, "APPROVED_IN_CURRENT_TURN", `${run.source?.type || "source"} approval marker mismatch`);
    assertNonTbd(run.source?.approvalSource, `${run.source?.type || "source"}.approvalSource`);
    assert.equal(run.summary?.ok, true, `${run.source.type} summary must be ok`);
    assert.equal(run.summary?.captureSaved, true, `${run.source.type} capture must be saved`);
    assert.equal(run.summary?.sourceContextPreserved, true, `${run.source.type} source context must be preserved`);
    assert.equal(run.summary?.resumeOpened, true, `${run.source.type} resume must open`);
    assert.equal(Array.isArray(run.files), true, `${run.source.type} files must be listed`);
    assert.ok(run.files.length > 0, `${run.source.type} evidence files must not be empty`);
    run.files.forEach((file) => assert.equal(existsSync(file), true, `${run.source.type} evidence file missing: ${file}`));
  });
  assertRunFiles(reading, [
    "01-source-and-app-before-capture.png",
    "02-capture-saved.png",
    "03-resume-source.png"
  ]);
  assertRunFiles(video, [
    "01-source-and-app-before-capture.png",
    "02-capture-saved.png",
    "02b-video-learning-tools.png",
    "03-resume-source.png",
    "04-video-timestamp.png"
  ]);
  assert.equal(video.summary?.videoTimestampCaptured, true, "video timestamp evidence must be captured");
  assert.equal(video.summary?.videoLearningToolsCaptured, true, "video learning-tool evidence must be captured");
  assert.equal(video.videoTools?.timestampNoteInserted, true, "video timestamp note insertion must be recorded");
  assert.equal(video.videoTools?.videoBookmarkSaved, true, "video bookmark creation must be recorded");
  assert.equal(video.videoTools?.playbackRatePersisted, true, "video playback-rate preference must be recorded");
  assertNonTbd(video.saved?.captureTimestamp, "video.saved.captureTimestamp");
  assert.equal(video.saved?.captureMaterialType, "video", "video capture material type must be video");
  const sourceApprovalRequestBinding = validateSourceApprovalRequestBinding(receipt.sourceApprovalRequestBinding, {
    reading,
    video,
    runContext: receipt.runContext
  });

  return {
    reading,
    video,
    sourceApprovalRequestBinding,
    files: receipt.runs.flatMap((run) => run.files)
  };
}

function validateSourceApprovalRequestBinding(binding, { reading, video, runContext }) {
  assert.equal(binding?.schema, SOURCE_APPROVAL_REQUEST_BINDING_SCHEMA, "sourceApprovalRequestBinding schema mismatch");
  assertNonTbd(binding.requestPath, "sourceApprovalRequestBinding.requestPath");
  assert.equal(binding.requestSchema, "learning-companion.external-source-approval-request.v1", "sourceApprovalRequestBinding request schema mismatch");
  assert.equal(binding.evidenceTier, "SOURCE_APPROVAL_REQUEST_ONLY", "sourceApprovalRequestBinding evidence tier mismatch");
  assert.equal(binding.canClaimExternalKo, false, "sourceApprovalRequestBinding must be non-claiming");
  assertConcreteReviewText(binding.requestedApprovalText, "sourceApprovalRequestBinding.requestedApprovalText");
  assert.equal(binding.requestedApprovalTextMatched, true, "sourceApprovalRequestBinding must prove requested approval text matched the approved run");
  assertRequestedApprovalTextCoversSources(binding.requestedApprovalText, {
    readingUrl: reading.source.url,
    videoUrl: video.source.url,
    videoTimestamp: video.saved.captureTimestamp
  });
  assert.equal(binding.approvedReadingUrl, reading.source.url, "sourceApprovalRequestBinding approved reading URL must match receipt");
  assert.equal(binding.approvedVideoUrl, video.source.url, "sourceApprovalRequestBinding approved video URL must match receipt");
  assert.equal(binding.approvedVideoTimestamp, video.saved.captureTimestamp, "sourceApprovalRequestBinding approved video timestamp must match captured video timestamp");
  assert.equal(binding.approvedVideoTimestamp, video.videoTools?.bookmarkTimestamp, "sourceApprovalRequestBinding approved video timestamp must match bookmark timestamp");
  assert.equal(binding.freshnessStatus, CURRENT_CLEAN_PUBLIC_DRY_RUN, "sourceApprovalRequestBinding freshness must be CURRENT_CLEAN_PUBLIC_DRY_RUN");
  assertGitHead(binding.currentGitHead, "sourceApprovalRequestBinding.currentGitHead");
  assertGitHead(binding.basisGitHead, "sourceApprovalRequestBinding.basisGitHead");
  assert.equal(binding.currentGitHead, runContext.appRevision.gitHead, "sourceApprovalRequestBinding current git HEAD must match run context");
  assert.equal(binding.basisGitHead, binding.currentGitHead, "sourceApprovalRequestBinding basis git HEAD must match current clean HEAD");
  assert.equal(binding.currentDirtyWorktree, false, "sourceApprovalRequestBinding current worktree must be clean");
  assert.equal(binding.basisDirtyWorktree, false, "sourceApprovalRequestBinding basis dry-run worktree must be clean");
  assertNonTbd(binding.basisReceiptPath, "sourceApprovalRequestBinding.basisReceiptPath");
  assert.equal(binding.basisProfileCleanupOk, true, "sourceApprovalRequestBinding public dry-run basis must prove browser profile cleanup");
  assert.equal(binding.basisProfileRetained, false, "sourceApprovalRequestBinding public dry-run basis must not retain the browser profile");
  assert.equal(Array.isArray(binding.problems), true, "sourceApprovalRequestBinding problems must be listed");
  assert.equal(binding.problems.length, 0, "sourceApprovalRequestBinding must have no freshness problems");
  return binding;
}

function buildReviewTemplate(receipt, receiptPath) {
  const runs = Array.isArray(receipt.runs) ? receipt.runs : [];
  const reading = runs.find((run) => run.source?.type === "reading") || {};
  const video = runs.find((run) => run.source?.type === "video") || {};
  const files = runs.flatMap((run) => Array.isArray(run.files) ? run.files : []);
  return {
    schema: REVIEW_SCHEMA,
    receiptSchema: receipt.schema || RECEIPT_SCHEMA,
    receiptPath,
    reviewer: "TBD (human reviewer name)",
    reviewedAt: "TBD (ISO date-time with timezone, e.g. 2026-06-23T21:30:00+08:00)",
    sourceApproval: {
      currentTurnApprovalConfirmed: false,
      approvalReference: "TBD (current-turn approval message or link)",
      approvedReadingUrl: reading.source?.url || "TBD",
      approvedVideoUrl: video.source?.url || "TBD",
      approvedVideoTimestamp: receipt.sourceApprovalRequestBinding?.approvedVideoTimestamp || video.saved?.captureTimestamp || "TBD",
      requestedApprovalText: receipt.sourceApprovalRequestBinding?.requestedApprovalText || "TBD",
      sourceApprovalRequestPath: receipt.sourceApprovalRequestBinding?.requestPath || "TBD",
      sourceApprovalRequestFreshness: receipt.sourceApprovalRequestBinding?.freshnessStatus || "TBD",
      sourceApprovalRequestCurrentGitHead: receipt.sourceApprovalRequestBinding?.currentGitHead || "TBD",
      sourceApprovalRequestBasisGitHead: receipt.sourceApprovalRequestBinding?.basisGitHead || "TBD"
    },
    privacyReview: {
      noVisibleAccountIdentity: false,
      noPrivateOrSensitiveContent: false,
      noSecretsTokensSessionIds: false,
      noPrivateBrowserChrome: false,
      screenshotsReviewed: files.map((file) => ({
        ...screenshotEvidence(file),
        status: "TBD"
      }))
    },
    executionReview: {
      runContextReviewed: false,
      appRevisionRecorded: false,
      readingSourceContextPass: false,
      videoSourceContextPass: false,
      videoTimestampPass: false,
      videoLearningToolsPass: false
    },
    verdict: "TBD",
    canUseForKo: false,
    notes: "TBD (brief concrete privacy-review notes)"
  };
}

async function runSelfTest() {
  const root = resolve(".codex-tmp/external-source-privacy-review-selftest", timestampSlug(new Date()));
  await mkdir(root, { recursive: true, mode: 0o700 });
  const fixture = await createCandidateFixture(root);
  const candidateTemplate = buildReviewTemplate(fixture.receipt, fixture.receiptPath);
  assert.equal(candidateTemplate.sourceApproval.approvedReadingUrl, fixture.receipt.runs.find((run) => run.source.type === "reading").source.url);
  assert.equal(candidateTemplate.sourceApproval.approvedVideoTimestamp, fixture.receipt.sourceApprovalRequestBinding.approvedVideoTimestamp);
  assert.equal(candidateTemplate.sourceApproval.sourceApprovalRequestFreshness, CURRENT_CLEAN_PUBLIC_DRY_RUN);
  assert.equal(candidateTemplate.sourceApproval.sourceApprovalRequestPath, fixture.receipt.sourceApprovalRequestBinding.requestPath);
  assert.equal(candidateTemplate.sourceApproval.requestedApprovalText, fixture.receipt.sourceApprovalRequestBinding.requestedApprovalText);
  assert.equal(Number.isInteger(candidateTemplate.privacyReview.screenshotsReviewed[0].bytes), true);
  assert.match(candidateTemplate.privacyReview.screenshotsReviewed[0].sha256, /^[a-f0-9]{64}$/);
  assert.match(candidateTemplate.reviewedAt, /ISO date-time with timezone/);
  assert.match(candidateTemplate.notes, /concrete privacy-review notes/);
  const validReview = buildValidReview(fixture.receipt, fixture.receiptPath);
  const validateSelfTestPrivacyReview = (input) => validatePrivacyReview({ ...input, allowSelfTestFixtures: true });
  const cloneFixtureReceipt = () => JSON.parse(JSON.stringify(fixture.receipt));
  const claim = validateSelfTestPrivacyReview({
    receipt: fixture.receipt,
    receiptPath: fixture.receiptPath,
    review: validReview,
    reviewPath: join(root, "valid-review.json")
  });
  assert.equal(claim.canClaimExternalKo, true);
  assert.equal(claim.evidenceTier, "APPROVED_SOURCE_PRIVACY_REVIEWED");
  assert.equal(claim.runContext.appRevision.gitHeadCaptured, true);
  assert.equal(claim.runContext.appRevision.statusCaptured, true);
  assert.deepEqual(claim.runContext.appRevision.statusShort, fixture.receipt.runContext.appRevision.statusShort);

  assert.throws(() => validatePrivacyReview({
    receipt: fixture.receipt,
    receiptPath: fixture.receiptPath,
    review: validReview,
    reviewPath: "approved-source-privacy-review.json"
  }), /receiptPath must not come from external-source privacy-review self-test artifacts/);

  assert.throws(() => validatePrivacyReview({
    receipt: fixture.receipt,
    receiptPath: "approved-source-candidate-receipt.json",
    review: validReview,
    reviewPath: join(root, "valid-review.json")
  }), /reviewPath must not come from external-source privacy-review self-test artifacts/);

  const descriptiveNoneNotesClaim = validateSelfTestPrivacyReview({
    receipt: fixture.receipt,
    receiptPath: fixture.receiptPath,
    review: {
      ...validReview,
      notes: "None of the screenshots contained private or sensitive content; all required files were reviewed."
    },
    reviewPath: join(root, "descriptive-none-notes-review.json")
  });
  assert.equal(descriptiveNoneNotesClaim.canClaimExternalKo, true);

  const descriptiveNoEvidenceNotesClaim = validateSelfTestPrivacyReview({
    receipt: fixture.receipt,
    receiptPath: fixture.receiptPath,
    review: {
      ...validReview,
      notes: "No evidence of private account identity, secrets, or browser chrome in the reviewed screenshots."
    },
    reviewPath: join(root, "descriptive-no-evidence-notes-review.json")
  });
  assert.equal(descriptiveNoEvidenceNotesClaim.canClaimExternalKo, true);

  const selfTestReceipt = {
    ...fixture.receipt,
    evidenceTier: "LOCAL_FIXTURE_SELF_TEST",
    selfTest: true,
    approvedCurrentTurn: false
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: selfTestReceipt,
    receiptPath: join(root, "selftest-receipt.json"),
    review: validReview,
    reviewPath: join(root, "valid-review.json")
  }), /real approved-source candidate/);

  const publicDryRunReceipt = {
    ...fixture.receipt,
    evidenceTier: "PUBLIC_SOURCE_DRY_RUN",
    approvedCurrentTurn: false,
    publicSourceDryRun: true,
    runs: fixture.receipt.runs.map((run) => ({
      ...run,
      source: {
        ...run.source,
        approved: "PUBLIC_SOURCE_DRY_RUN_NOT_APPROVED",
        approvalSource: "dry-run only: public-source preflight before approval",
        dryRunOnly: true
      },
      summary: {
        ...run.summary,
        dryRunOnly: true
      }
    }))
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: publicDryRunReceipt,
    receiptPath: join(root, "public-dry-run-receipt.json"),
    review: validReview,
    reviewPath: join(root, "valid-review.json")
  }), /real approved-source candidate/);
  assert.throws(() => validateCandidateReceipt(publicDryRunReceipt), /real approved-source candidate/);

  const missingSourceApprovalRequestBindingReceipt = cloneFixtureReceipt();
  delete missingSourceApprovalRequestBindingReceipt.sourceApprovalRequestBinding;
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: missingSourceApprovalRequestBindingReceipt,
    receiptPath: join(root, "missing-source-approval-request-binding-receipt.json"),
    review: validReview,
    reviewPath: join(root, "valid-review.json")
  }), /sourceApprovalRequestBinding schema mismatch/);

  const staleSourceApprovalRequestBindingReceipt = cloneFixtureReceipt();
  staleSourceApprovalRequestBindingReceipt.sourceApprovalRequestBinding.freshnessStatus = "STALE_OR_DIRTY_PUBLIC_DRY_RUN";
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: staleSourceApprovalRequestBindingReceipt,
    receiptPath: join(root, "stale-source-approval-request-binding-receipt.json"),
    review: validReview,
    reviewPath: join(root, "valid-review.json")
  }), /CURRENT_CLEAN_PUBLIC_DRY_RUN/);

  const mismatchedSourceApprovalRequestReadingReceipt = cloneFixtureReceipt();
  mismatchedSourceApprovalRequestReadingReceipt.sourceApprovalRequestBinding.approvedReadingUrl = "https://www.wikipedia.org/other-reading";
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: mismatchedSourceApprovalRequestReadingReceipt,
    receiptPath: join(root, "mismatched-source-approval-request-reading-receipt.json"),
    review: validReview,
    reviewPath: join(root, "valid-review.json")
  }), /approved reading URL/);

  const mismatchedSourceApprovalRequestTimestampReceipt = cloneFixtureReceipt();
  mismatchedSourceApprovalRequestTimestampReceipt.sourceApprovalRequestBinding.approvedVideoTimestamp = "00:04";
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: mismatchedSourceApprovalRequestTimestampReceipt,
    receiptPath: join(root, "mismatched-source-approval-request-timestamp-receipt.json"),
    review: validReview,
    reviewPath: join(root, "valid-review.json")
  }), /approved video timestamp/);

  const missingRequestedApprovalTextReceipt = cloneFixtureReceipt();
  delete missingRequestedApprovalTextReceipt.sourceApprovalRequestBinding.requestedApprovalText;
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: missingRequestedApprovalTextReceipt,
    receiptPath: join(root, "missing-requested-approval-text-receipt.json"),
    review: validReview,
    reviewPath: join(root, "valid-review.json")
  }), /sourceApprovalRequestBinding\.requestedApprovalText must be a string/);

  const incompleteRequestedApprovalTextReceipt = cloneFixtureReceipt();
  incompleteRequestedApprovalTextReceipt.sourceApprovalRequestBinding.requestedApprovalText = "I approve the learning sources for this turn.";
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: incompleteRequestedApprovalTextReceipt,
    receiptPath: join(root, "incomplete-requested-approval-text-receipt.json"),
    review: {
      ...validReview,
      sourceApproval: {
        ...validReview.sourceApproval,
        requestedApprovalText: "I approve the learning sources for this turn."
      }
    },
    reviewPath: join(root, "incomplete-requested-approval-text-review.json")
  }), /requested approval text must contain exactly one reading= token/);

  const mismatchedSingleRequestedApprovalTextReceipt = cloneFixtureReceipt();
  mismatchedSingleRequestedApprovalTextReceipt.sourceApprovalRequestBinding.requestedApprovalText = fixture.receipt.sourceApprovalRequestBinding.requestedApprovalText.replace(
    `reading=${fixture.receipt.sourceApprovalRequestBinding.approvedReadingUrl}`,
    "reading=https://www.wikipedia.org/other-reading"
  );
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: mismatchedSingleRequestedApprovalTextReceipt,
    receiptPath: join(root, "mismatched-single-requested-approval-text-receipt.json"),
    review: {
      ...validReview,
      sourceApproval: {
        ...validReview.sourceApproval,
        requestedApprovalText: mismatchedSingleRequestedApprovalTextReceipt.sourceApprovalRequestBinding.requestedApprovalText
      }
    },
    reviewPath: join(root, "mismatched-single-requested-approval-text-review.json")
  }), /requested approval text must include the exact approved reading URL/);

  const suffixRequestedApprovalTextReceipt = cloneFixtureReceipt();
  suffixRequestedApprovalTextReceipt.sourceApprovalRequestBinding.requestedApprovalText = fixture.receipt.sourceApprovalRequestBinding.requestedApprovalText
    .replace(
      `reading=${fixture.receipt.sourceApprovalRequestBinding.approvedReadingUrl}`,
      `reading=${fixture.receipt.sourceApprovalRequestBinding.approvedReadingUrl}-extra`
    )
    .replace(
      `video=${fixture.receipt.sourceApprovalRequestBinding.approvedVideoUrl}`,
      `video=${fixture.receipt.sourceApprovalRequestBinding.approvedVideoUrl}&extra=true`
    )
    .replace(
      `timestamp=${fixture.receipt.sourceApprovalRequestBinding.approvedVideoTimestamp}`,
      `timestamp=${fixture.receipt.sourceApprovalRequestBinding.approvedVideoTimestamp}Z`
    );
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: suffixRequestedApprovalTextReceipt,
    receiptPath: join(root, "suffix-requested-approval-text-receipt.json"),
    review: {
      ...validReview,
      sourceApproval: {
        ...validReview.sourceApproval,
        requestedApprovalText: suffixRequestedApprovalTextReceipt.sourceApprovalRequestBinding.requestedApprovalText
      }
    },
    reviewPath: join(root, "suffix-requested-approval-text-review.json")
  }), /requested approval text must include the exact approved reading URL/);

  const conflictingRequestedApprovalTextReceipt = cloneFixtureReceipt();
  conflictingRequestedApprovalTextReceipt.sourceApprovalRequestBinding.requestedApprovalText = `${fixture.receipt.sourceApprovalRequestBinding.requestedApprovalText} reading=https://www.wikipedia.org/other-reading`;
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: conflictingRequestedApprovalTextReceipt,
    receiptPath: join(root, "conflicting-requested-approval-text-receipt.json"),
    review: {
      ...validReview,
      sourceApproval: {
        ...validReview.sourceApproval,
        requestedApprovalText: conflictingRequestedApprovalTextReceipt.sourceApprovalRequestBinding.requestedApprovalText
      }
    },
    reviewPath: join(root, "conflicting-requested-approval-text-review.json")
  }), /requested approval text must contain exactly one reading= token/);

  const conflictingVideoRequestedApprovalTextReceipt = cloneFixtureReceipt();
  conflictingVideoRequestedApprovalTextReceipt.sourceApprovalRequestBinding.requestedApprovalText = `${fixture.receipt.sourceApprovalRequestBinding.requestedApprovalText} video=https://www.youtube.com/watch?v=other-video`;
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: conflictingVideoRequestedApprovalTextReceipt,
    receiptPath: join(root, "conflicting-video-requested-approval-text-receipt.json"),
    review: {
      ...validReview,
      sourceApproval: {
        ...validReview.sourceApproval,
        requestedApprovalText: conflictingVideoRequestedApprovalTextReceipt.sourceApprovalRequestBinding.requestedApprovalText
      }
    },
    reviewPath: join(root, "conflicting-video-requested-approval-text-review.json")
  }), /requested approval text must contain exactly one video= token/);

  const conflictingTimestampRequestedApprovalTextReceipt = cloneFixtureReceipt();
  conflictingTimestampRequestedApprovalTextReceipt.sourceApprovalRequestBinding.requestedApprovalText = `${fixture.receipt.sourceApprovalRequestBinding.requestedApprovalText} timestamp=01:36`;
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: conflictingTimestampRequestedApprovalTextReceipt,
    receiptPath: join(root, "conflicting-timestamp-requested-approval-text-receipt.json"),
    review: {
      ...validReview,
      sourceApproval: {
        ...validReview.sourceApproval,
        requestedApprovalText: conflictingTimestampRequestedApprovalTextReceipt.sourceApprovalRequestBinding.requestedApprovalText
      }
    },
    reviewPath: join(root, "conflicting-timestamp-requested-approval-text-review.json")
  }), /requested approval text must contain exactly one timestamp= token/);

  const mismatchedRequestedApprovalTextReview = {
    ...validReview,
    sourceApproval: {
      ...validReview.sourceApproval,
      requestedApprovalText: "I approve a different set of sources."
    }
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: fixture.receipt,
    receiptPath: fixture.receiptPath,
    review: mismatchedRequestedApprovalTextReview,
    reviewPath: join(root, "mismatched-requested-approval-text-review.json")
  }), /requested approval text must match receipt binding/);

  const failedReview = {
    ...validReview,
    privacyReview: {
      ...validReview.privacyReview,
      noSecretsTokensSessionIds: false
    }
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: fixture.receipt,
    receiptPath: fixture.receiptPath,
    review: failedReview,
    reviewPath: join(root, "failed-review.json")
  }), /noSecretsTokensSessionIds must be true/);

  const duplicateScreenshotReview = {
    ...validReview,
    privacyReview: {
      ...validReview.privacyReview,
      screenshotsReviewed: [
        ...validReview.privacyReview.screenshotsReviewed,
        { ...validReview.privacyReview.screenshotsReviewed[0] }
      ]
    }
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: fixture.receipt,
    receiptPath: fixture.receiptPath,
    review: duplicateScreenshotReview,
    reviewPath: join(root, "duplicate-screenshot-review.json")
  }), /duplicate screenshot privacy review entry/);

  const extraScreenshotReview = {
    ...validReview,
    privacyReview: {
      ...validReview.privacyReview,
      screenshotsReviewed: [
        ...validReview.privacyReview.screenshotsReviewed,
        { file: join(root, "extra.png"), status: "PASS" }
      ]
    }
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: fixture.receipt,
    receiptPath: fixture.receiptPath,
    review: extraScreenshotReview,
    reviewPath: join(root, "extra-screenshot-review.json")
  }), /unexpected screenshot privacy review file/);

  const failedScreenshotReview = {
    ...validReview,
    privacyReview: {
      ...validReview.privacyReview,
      screenshotsReviewed: validReview.privacyReview.screenshotsReviewed.map((item, index) => index === 0
        ? { ...item, status: "FAIL" }
        : item)
    }
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: fixture.receipt,
    receiptPath: fixture.receiptPath,
    review: failedScreenshotReview,
    reviewPath: join(root, "failed-screenshot-review.json")
  }), /screenshot privacy review must be PASS/);

  const mismatchedScreenshotBytesReview = {
    ...validReview,
    privacyReview: {
      ...validReview.privacyReview,
      screenshotsReviewed: validReview.privacyReview.screenshotsReviewed.map((item, index) => index === 0
        ? { ...item, bytes: item.bytes + 1 }
        : item)
    }
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: fixture.receipt,
    receiptPath: fixture.receiptPath,
    review: mismatchedScreenshotBytesReview,
    reviewPath: join(root, "mismatched-screenshot-bytes-review.json")
  }), /screenshot privacy review bytes must match current file/);

  const mismatchedScreenshotShaReview = {
    ...validReview,
    privacyReview: {
      ...validReview.privacyReview,
      screenshotsReviewed: validReview.privacyReview.screenshotsReviewed.map((item, index) => index === 0
        ? { ...item, sha256: "0".repeat(64) }
        : item)
    }
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: fixture.receipt,
    receiptPath: fixture.receiptPath,
    review: mismatchedScreenshotShaReview,
    reviewPath: join(root, "mismatched-screenshot-sha-review.json")
  }), /screenshot privacy review sha256 must match current file/);

  const emptyScreenshotFile = fixture.receipt.runs[0].files[0];
  await writeFile(emptyScreenshotFile, "");
  try {
    assert.throws(() => validateSelfTestPrivacyReview({
      receipt: fixture.receipt,
      receiptPath: fixture.receiptPath,
      review: validReview,
      reviewPath: join(root, "empty-screenshot-file-review.json")
    }), /screenshot evidence file must not be empty/);
  } finally {
    await writeFile(emptyScreenshotFile, "fixture\n");
  }

  const placeholderReviewerReview = {
    ...validReview,
    reviewer: "N/A"
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: fixture.receipt,
    receiptPath: fixture.receiptPath,
    review: placeholderReviewerReview,
    reviewPath: join(root, "placeholder-reviewer-review.json")
  }), /reviewer must be filled with concrete review evidence/);

  const relativeReviewedAtReview = {
    ...validReview,
    reviewedAt: "today"
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: fixture.receipt,
    receiptPath: fixture.receiptPath,
    review: relativeReviewedAtReview,
    reviewPath: join(root, "relative-reviewed-at-review.json")
  }), /reviewedAt must be an ISO date-time with timezone/);

  const placeholderApprovalReferenceReview = {
    ...validReview,
    sourceApproval: {
      ...validReview.sourceApproval,
      approvalReference: "1. todo: paste current-turn approval"
    }
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: fixture.receipt,
    receiptPath: fixture.receiptPath,
    review: placeholderApprovalReferenceReview,
    reviewPath: join(root, "placeholder-approval-reference-review.json")
  }), /sourceApproval\.approvalReference must be filled with concrete review evidence/);

  const placeholderNotesReview = {
    ...validReview,
    notes: "> todo: inspect screenshots"
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: fixture.receipt,
    receiptPath: fixture.receiptPath,
    review: placeholderNotesReview,
    reviewPath: join(root, "placeholder-notes-review.json")
  }), /notes must be filled with concrete review evidence/);

  const emptyFilesReceipt = {
    ...fixture.receipt,
    runs: fixture.receipt.runs.map((run) => ({ ...run, files: [] }))
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: emptyFilesReceipt,
    receiptPath: join(root, "empty-files-receipt.json"),
    review: validReview,
    reviewPath: join(root, "valid-review.json")
  }), /evidence files must not be empty/);

  const missingUrlReceipt = {
    ...fixture.receipt,
    runs: fixture.receipt.runs.map((run) => run.source.type === "reading"
      ? { ...run, source: { ...run.source, url: "" } }
      : run)
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: missingUrlReceipt,
    receiptPath: join(root, "missing-url-receipt.json"),
    review: validReview,
    reviewPath: join(root, "valid-review.json")
  }), /reading\.url must be filled/);

  const mismatchedUrlReview = {
    ...validReview,
    sourceApproval: {
      ...validReview.sourceApproval,
      approvedReadingUrl: "https://example.com/other-reading"
    }
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: fixture.receipt,
    receiptPath: fixture.receiptPath,
    review: mismatchedUrlReview,
    reviewPath: join(root, "mismatched-url-review.json")
  }), /approved reading URL must match receipt/);

  const mismatchedReviewTimestamp = {
    ...validReview,
    sourceApproval: {
      ...validReview.sourceApproval,
      approvedVideoTimestamp: "01:36"
    }
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: fixture.receipt,
    receiptPath: fixture.receiptPath,
    review: mismatchedReviewTimestamp,
    reviewPath: join(root, "mismatched-review-timestamp.json")
  }), /approved video timestamp must match receipt binding/);

  const missingRunContextReceipt = {
    ...fixture.receipt,
    runContext: undefined
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: missingRunContextReceipt,
    receiptPath: join(root, "missing-run-context-receipt.json"),
    review: validReview,
    reviewPath: join(root, "valid-review.json")
  }), /runContext schema mismatch/);

  const retainedProfileReceipt = {
    ...fixture.receipt,
    runContext: {
      ...fixture.receipt.runContext,
      browser: {
        ...fixture.receipt.runContext.browser,
        profileRetained: true,
        profileCleanup: {
          attempted: true,
          ok: true,
          retained: true,
          error: "profile still exists after cleanup"
        }
      }
    }
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: retainedProfileReceipt,
    receiptPath: join(root, "retained-profile-receipt.json"),
    review: validReview,
    reviewPath: join(root, "valid-review.json")
  }), /browser profile must be cleaned/);

  const failedProfileCleanupReceipt = {
    ...fixture.receipt,
    runContext: {
      ...fixture.receipt.runContext,
      browser: {
        ...fixture.receipt.runContext.browser,
        profileRetained: false,
        profileCleanup: {
          attempted: true,
          ok: false,
          retained: false,
          error: "ENOTEMPTY"
        }
      }
    }
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: failedProfileCleanupReceipt,
    receiptPath: join(root, "failed-profile-cleanup-receipt.json"),
    review: validReview,
    reviewPath: join(root, "valid-review.json")
  }), /browser profile cleanup must pass/);

  const localSourceReceipt = {
    ...fixture.receipt,
    runs: fixture.receipt.runs.map((run) => run.source.type === "reading"
      ? { ...run, source: { ...run.source, url: "http://127.0.0.1:12345/private-reading" } }
      : run)
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: localSourceReceipt,
    receiptPath: join(root, "local-source-receipt.json"),
    review: validReview,
    reviewPath: join(root, "valid-review.json")
  }), /public, non-private approved source URL/);

  const mappedIpv6LocalSourceReceipt = {
    ...fixture.receipt,
    runs: fixture.receipt.runs.map((run) => run.source.type === "reading"
      ? { ...run, source: { ...run.source, url: "http://[::ffff:127.0.0.1]/private-reading" } }
      : run)
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: mappedIpv6LocalSourceReceipt,
    receiptPath: join(root, "mapped-ipv6-local-source-receipt.json"),
    review: validReview,
    reviewPath: join(root, "valid-review.json")
  }), /public, non-private approved source URL/);

  const sensitiveQueryReceipt = {
    ...fixture.receipt,
    runs: fixture.receipt.runs.map((run) => run.source.type === "video"
      ? { ...run, source: { ...run.source, url: "https://www.youtube.com/watch?v=learning-companion-approved-video&token=abc" } }
      : run)
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: sensitiveQueryReceipt,
    receiptPath: join(root, "sensitive-query-receipt.json"),
    review: validReview,
    reviewPath: join(root, "valid-review.json")
  }), /query key token looks sensitive/);

  const signedQueryReceipt = {
    ...fixture.receipt,
    runs: fixture.receipt.runs.map((run) => run.source.type === "video"
      ? { ...run, source: { ...run.source, url: "https://www.youtube.com/watch?v=learning-companion-approved-video&X-Amz-Signature=abc" } }
      : run)
  };
  assert.throws(() => validateSelfTestPrivacyReview({
    receipt: signedQueryReceipt,
    receiptPath: join(root, "signed-query-receipt.json"),
    review: validReview,
    reviewPath: join(root, "valid-review.json")
  }), /query key X-Amz-Signature looks sensitive/);

  await writeJson(join(root, "valid-review.json"), validReview);
  const summary = {
    schema: "learning-companion.external-source-privacy-review-selftest.v1",
    generatedAt: new Date().toISOString(),
    fixtureOnly: true,
    canClaimExternalKo: false,
    validatedClaimShapeInMemory: claim.schema === CLAIM_SCHEMA && claim.canClaimExternalKo === true,
    negativeCases: [
      "approved candidate template shape validated",
      "privacy-review self-test receipt path rejected",
      "privacy-review self-test review path rejected",
      "local fixture self-test receipt rejected",
      "public source dry-run receipt rejected",
      "public source dry-run template rejected",
      "missing source approval request binding rejected",
      "stale source approval request binding rejected",
      "mismatched source approval request reading URL rejected",
      "mismatched source approval request video timestamp rejected",
      "missing requested approval text in source approval binding rejected",
      "incomplete requested approval text in source approval binding rejected",
      "mismatched single-token requested approval text in source approval binding rejected",
      "suffix requested approval text in source approval binding rejected",
      "conflicting requested approval text in source approval binding rejected",
      "conflicting video requested approval text in source approval binding rejected",
      "conflicting timestamp requested approval text in source approval binding rejected",
      "mismatched requested approval text in privacy review rejected",
      "failed privacy boolean rejected",
      "duplicate screenshot review entry rejected",
      "extra screenshot review file rejected",
      "failed screenshot review status rejected",
      "mismatched screenshot review bytes rejected",
      "mismatched screenshot review sha256 rejected",
      "empty screenshot evidence file rejected",
      "placeholder reviewer rejected",
      "relative reviewedAt timestamp rejected",
      "placeholder approval reference rejected",
      "placeholder review notes rejected",
      "empty evidence file lists rejected",
      "missing source URL rejected",
      "mismatched review URL rejected",
      "mismatched review video timestamp rejected",
      "missing run context rejected",
      "local or private source URL rejected",
      "IPv4-mapped IPv6 local source URL rejected",
      "sensitive source query key rejected",
      "signed source query key rejected"
    ]
  };
  await writeJson(join(root, "selftest-summary.json"), summary);
  console.log(`external_source_privacy_review_selftest_ok ${join(root, "selftest-summary.json")}`);
}

async function createCandidateFixture(root) {
  const files = [
    join(root, "reading", "01-source-and-app-before-capture.png"),
    join(root, "reading", "02-capture-saved.png"),
    join(root, "reading", "03-resume-source.png"),
    join(root, "video", "01-source-and-app-before-capture.png"),
    join(root, "video", "02-capture-saved.png"),
    join(root, "video", "02b-video-learning-tools.png"),
    join(root, "video", "03-resume-source.png"),
    join(root, "video", "04-video-timestamp.png")
  ];
  await Promise.all(files.map(async (file) => {
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(file, "fixture\n");
  }));
  const receipt = {
    schema: RECEIPT_SCHEMA,
    generatedAt: new Date().toISOString(),
    evidenceTier: "APPROVED_SOURCE_CANDIDATE",
    canClaimExternalKo: false,
    claimBoundary: "Candidate evidence still requires human privacy review before it can support the KO.",
    runRoot: root,
    chromePath: "/usr/bin/chromium",
    appUrl: "http://127.0.0.1:12345/",
    sourceApprovalRequestBinding: {
      schema: SOURCE_APPROVAL_REQUEST_BINDING_SCHEMA,
      requestPath: join(root, "source-approval-request.json"),
      requestSchema: "learning-companion.external-source-approval-request.v1",
      evidenceTier: "SOURCE_APPROVAL_REQUEST_ONLY",
      canClaimExternalKo: false,
      requestedApprovalText: "I approve these exact public learning-material sources for the current turn: reading=https://www.wikipedia.org/learning-companion-approved-reading video=https://www.youtube.com/watch?v=learning-companion-approved-video timestamp=01:35 They may be used for Learning Companion external-source validation screenshots and privacy review.",
      requestedApprovalTextMatched: true,
      approvedReadingUrl: "https://www.wikipedia.org/learning-companion-approved-reading",
      approvedVideoUrl: "https://www.youtube.com/watch?v=learning-companion-approved-video",
      approvedVideoTimestamp: "01:35",
      freshnessStatus: CURRENT_CLEAN_PUBLIC_DRY_RUN,
      currentGitHead: "0123456789abcdef0123456789abcdef01234567",
      currentDirtyWorktree: false,
      basisGitHead: "0123456789abcdef0123456789abcdef01234567",
      basisDirtyWorktree: false,
      basisReceiptPath: join(root, "public-dry-run-receipt.json"),
      basisProfileCleanupOk: true,
      basisProfileRetained: false,
      problems: []
    },
    runContext: {
      schema: "learning-companion.external-source-run-context.v1",
      app: {
        url: "http://127.0.0.1:12345/",
        root: "/tmp/learning-companion/apps/companion-web"
      },
      appRevision: {
        gitHead: "0123456789abcdef0123456789abcdef01234567",
        gitHeadCaptured: true,
        dirtyWorktree: true,
        statusCaptured: true,
        statusLineCount: 1,
        statusShort: ["M scripts/external-source-validation-browser.mjs"],
        statusTruncated: false
      },
      browser: {
        chromePath: "/usr/bin/chromium",
        headless: true,
        profileMode: "throwaway-profile",
        profilePath: join(root, "profile"),
        profileRetained: false,
        profileCleanup: {
          attempted: true,
          ok: true,
          retained: false,
          error: ""
        },
        debuggingPort: 12346
      },
      viewport: {
        app: {
          width: 1440,
          height: 900,
          deviceScaleFactor: 1,
          mobile: false
        },
        sourceEvidence: {
          width: 720,
          height: 900,
          deviceScaleFactor: 1,
          mobile: false
        },
        composite: {
          width: 1440,
          height: 900
        }
      },
      network: {
        mode: "APPROVED_REMOTE_SOURCE_AND_LOCAL_APP",
        localAppServer: "127.0.0.1 ephemeral",
        browserFlags: [
          "--disable-background-networking",
          "--disable-component-update",
          "--disable-extensions",
          "--disable-sync",
          "--no-first-run"
        ]
      }
    },
    approvedCurrentTurn: true,
    selfTest: false,
    runs: [
      {
        source: {
          type: "reading",
          url: "https://www.wikipedia.org/learning-companion-approved-reading",
          title: "Approved Reading",
          approved: "APPROVED_IN_CURRENT_TURN",
          approvalSource: "fixture approval",
          language: "zh"
        },
        saved: {
          captureTimestamp: "",
          captureMaterialType: "doc"
        },
        resume: {
          opened: "https://www.wikipedia.org/learning-companion-approved-reading"
        },
        files: files.filter((file) => file.includes("/reading/")),
        summary: {
          ok: true,
          captureSaved: true,
          sourceContextPreserved: true,
          resumeOpened: true,
          videoTimestampCaptured: false
        }
      },
      {
        source: {
          type: "video",
          url: "https://www.youtube.com/watch?v=learning-companion-approved-video",
          title: "Approved Video",
          approved: "APPROVED_IN_CURRENT_TURN",
          approvalSource: "fixture approval",
          language: "en"
        },
        saved: {
          captureTimestamp: "01:35",
          captureMaterialType: "video"
        },
        videoTools: {
          timestampButtonEnabled: true,
          speedControlAvailable: true,
          bookmarkButtonAvailable: true,
          timestampNoteInserted: true,
          videoBookmarkSaved: true,
          playbackRatePersisted: true,
          bookmarkCount: 1,
          bookmarkLabel: "External source timestamp",
          bookmarkTimestamp: "01:35",
          playbackRate: 1.5
        },
        resume: {
          opened: "https://www.youtube.com/watch?v=learning-companion-approved-video&t=95"
        },
        files: files.filter((file) => file.includes("/video/")),
        summary: {
          ok: true,
          captureSaved: true,
          sourceContextPreserved: true,
          resumeOpened: true,
          videoTimestampCaptured: true,
          videoLearningToolsCaptured: true
        }
      }
    ]
  };
  const receiptPath = join(root, "candidate-receipt.json");
  await writeJson(receiptPath, receipt);
  return { receipt, receiptPath };
}

function buildValidReview(receipt, receiptPath) {
  const template = buildReviewTemplate(receipt, receiptPath);
  return {
    ...template,
    reviewer: "Self Test",
    reviewedAt: new Date().toISOString(),
    sourceApproval: {
      ...template.sourceApproval,
      currentTurnApprovalConfirmed: true,
      approvalReference: "self-test approval fixture"
    },
    privacyReview: {
      ...template.privacyReview,
      noVisibleAccountIdentity: true,
      noPrivateOrSensitiveContent: true,
      noSecretsTokensSessionIds: true,
      noPrivateBrowserChrome: true,
      screenshotsReviewed: template.privacyReview.screenshotsReviewed.map((item) => ({ ...item, status: "PASS" }))
    },
    executionReview: {
      runContextReviewed: true,
      appRevisionRecorded: true,
      readingSourceContextPass: true,
      videoSourceContextPass: true,
      videoTimestampPass: true,
      videoLearningToolsPass: true
    },
    verdict: "PASS",
    canUseForKo: true,
    notes: "Self-test fixture only."
  };
}

function validateScreenshotReviewCoverage(screenshotsReviewed, expectedFiles) {
  assert.equal(Array.isArray(screenshotsReviewed), true, "privacyReview.screenshotsReviewed must be an array");
  const expected = new Set(expectedFiles);
  assert.equal(expected.size, expectedFiles.length, "receipt evidence files must be unique");
  const expectedEvidence = new Map(expectedFiles.map((file) => [file, screenshotEvidence(file)]));
  const seen = new Set();
  screenshotsReviewed.forEach((item, index) => {
    const label = `privacyReview.screenshotsReviewed[${index}]`;
    assertNonTbd(item?.file, `${label}.file`);
    assert.equal(expected.has(item.file), true, `unexpected screenshot privacy review file: ${item.file}`);
    assert.equal(seen.has(item.file), false, `duplicate screenshot privacy review entry: ${item.file}`);
    assert.equal(item.status, "PASS", `screenshot privacy review must be PASS for ${item.file}`);
    const current = expectedEvidence.get(item.file);
    assert.equal(item.bytes, current.bytes, `screenshot privacy review bytes must match current file for ${item.file}`);
    assert.equal(item.sha256, current.sha256, `screenshot privacy review sha256 must match current file for ${item.file}`);
    seen.add(item.file);
  });
  for (const file of expectedFiles) {
    assert.equal(seen.has(file), true, `screenshot privacy review missing PASS for ${file}`);
  }
}

function reviewedScreenshotsForClaim(screenshotsReviewed, expectedFiles) {
  const byFile = new Map(screenshotsReviewed.map((item) => [item.file, item]));
  return expectedFiles.map((file) => {
    const item = byFile.get(file);
    return {
      file,
      bytes: item.bytes,
      sha256: item.sha256,
      status: item.status
    };
  });
}

function screenshotEvidence(file) {
  const data = readFileSync(file);
  assert.ok(data.length > 0, `screenshot evidence file must not be empty: ${file}`);
  return {
    file,
    bytes: data.length,
    sha256: createHash("sha256").update(data).digest("hex")
  };
}

function validateRunContext(runContext) {
  assert.equal(runContext?.schema, "learning-companion.external-source-run-context.v1", "runContext schema mismatch");
  assertHttpUrl(runContext.app?.url, "runContext.app.url");
  assertNonTbd(runContext.app?.root, "runContext.app.root");
  assertGitHead(runContext.appRevision?.gitHead, "runContext.appRevision.gitHead");
  assert.equal(runContext.appRevision?.gitHeadCaptured, true, "runContext app git HEAD must be captured");
  assert.equal(typeof runContext.appRevision?.dirtyWorktree, "boolean", "runContext dirtyWorktree must be boolean");
  assert.equal(runContext.appRevision?.statusCaptured, true, "runContext git status must be captured");
  assert.equal(Number.isInteger(runContext.appRevision?.statusLineCount), true, "runContext statusLineCount must be an integer");
  assert.equal(Array.isArray(runContext.appRevision?.statusShort), true, "runContext statusShort must be listed");
  assert.equal(typeof runContext.appRevision?.statusTruncated, "boolean", "runContext statusTruncated must be boolean");
  assertNonTbd(runContext.browser?.chromePath, "runContext.browser.chromePath");
  assert.equal(runContext.browser?.headless, true, "runContext browser must be headless for this harness");
  assert.equal(runContext.browser?.profileMode, "throwaway-profile", "runContext browser profile mode must be throwaway-profile");
  assertNonTbd(runContext.browser?.profilePath, "runContext.browser.profilePath");
  assert.equal(runContext.browser?.profileRetained, false, "runContext browser profile must be cleaned after evidence capture");
  assert.equal(runContext.browser?.profileCleanup?.attempted, true, "runContext browser profile cleanup must be attempted");
  assert.equal(runContext.browser?.profileCleanup?.ok, true, "runContext browser profile cleanup must pass");
  assert.equal(runContext.browser?.profileCleanup?.retained, false, "runContext browser profile cleanup must not retain the profile");
  assert.equal(Number.isInteger(runContext.browser?.debuggingPort), true, "runContext browser debuggingPort must be an integer");
  assert.equal(runContext.viewport?.app?.width, 1440, "runContext app viewport width mismatch");
  assert.equal(runContext.viewport?.app?.height, 900, "runContext app viewport height mismatch");
  assert.equal(runContext.viewport?.sourceEvidence?.width, 720, "runContext source-evidence viewport width mismatch");
  assert.equal(runContext.viewport?.sourceEvidence?.height, 900, "runContext source-evidence viewport height mismatch");
  assert.equal(runContext.network?.mode, "APPROVED_REMOTE_SOURCE_AND_LOCAL_APP", "runContext network mode must be approved remote source plus local app");
  assert.equal(runContext.network?.localAppServer, "127.0.0.1 ephemeral", "runContext local app server must be ephemeral localhost");
}

function summarizeRunContextForClaim(runContext) {
  return {
    schema: runContext.schema,
    app: {
      url: runContext.app.url,
      root: runContext.app.root
    },
    appRevision: {
      gitHead: runContext.appRevision.gitHead,
      gitHeadCaptured: runContext.appRevision.gitHeadCaptured,
      dirtyWorktree: runContext.appRevision.dirtyWorktree,
      statusCaptured: runContext.appRevision.statusCaptured,
      statusLineCount: runContext.appRevision.statusLineCount,
      statusShort: runContext.appRevision.statusShort,
      statusTruncated: runContext.appRevision.statusTruncated
    },
    browser: {
      chromePath: runContext.browser.chromePath,
      headless: runContext.browser.headless,
      profileMode: runContext.browser.profileMode,
      profileRetained: runContext.browser.profileRetained,
      profileCleanup: runContext.browser.profileCleanup
    },
    viewport: runContext.viewport,
    network: runContext.network
  };
}

function assertGitHead(value, label) {
  assertNonTbd(value, label);
  assert.match(value, /^[a-f0-9]{40}$/i, `${label} must be a 40-character git SHA`);
}

function assertNotPrivacyReviewSelfTestPath(value, label) {
  assertNonTbd(value, label);
  const normalizedPath = value.replace(/\\/g, "/");
  assert.equal(
    normalizedPath.includes(PRIVACY_REVIEW_SELF_TEST_PATH),
    false,
    `${label} must not come from external-source privacy-review self-test artifacts`
  );
}

function assertNonTbd(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.trim() && value.trim() !== "TBD", `${label} must be filled`);
}

function assertConcreteReviewText(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  const text = normalizeReviewText(value);
  assert.ok(text && !isPlaceholderReviewText(text), `${label} must be filled with concrete review evidence`);
}

function assertIsoDateTime(value, label) {
  assertConcreteReviewText(value, label);
  const text = String(value).trim();
  assert.ok(ISO_DATE_TIME_PATTERN.test(text) && Number.isFinite(Date.parse(text)), `${label} must be an ISO date-time with timezone`);
}

function assertRequestedApprovalTextCoversSources(text, { readingUrl, videoUrl, videoTimestamp }) {
  const tokens = parseApprovalTokens(text);
  assert.equal(tokens.reading.count, 1, "requested approval text must contain exactly one reading= token");
  assert.equal(tokens.video.count, 1, "requested approval text must contain exactly one video= token");
  assert.equal(tokens.timestamp.count, 1, "requested approval text must contain exactly one timestamp= token");
  assert.equal(tokens.reading.value, readingUrl, "requested approval text must include the exact approved reading URL");
  assert.equal(tokens.video.value, videoUrl, "requested approval text must include the exact approved video URL");
  assert.equal(tokens.timestamp.value, videoTimestamp, "requested approval text must include the exact approved video timestamp");
}

function parseApprovalTokens(text) {
  const value = String(text || "");
  return Object.fromEntries(["reading", "video", "timestamp"].map((token) => {
    const matches = Array.from(value.matchAll(new RegExp(`(^|\\s)${token}=([^\\s]+)`, "g")));
    return [token, {
      count: matches.length,
      value: matches[0]?.[2] || ""
    }];
  }));
}

function normalizeReviewText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isPlaceholderReviewText(text) {
  const unwrappedText = text.replace(LEADING_REVIEW_DECORATION_PATTERN, "");
  const canonicalText = text.replace(LEADING_REVIEW_DECORATION_PATTERN, "").replace(TRAILING_REVIEW_DECORATION_PATTERN, "");
  const canonicalUnwrappedText = unwrappedText.replace(TRAILING_REVIEW_DECORATION_PATTERN, "");
  return PLACEHOLDER_REVIEW_TEXT.has(text)
    || PLACEHOLDER_REVIEW_TEXT.has(unwrappedText)
    || PLACEHOLDER_REVIEW_TEXT.has(canonicalText)
    || PLACEHOLDER_REVIEW_TEXT.has(canonicalUnwrappedText)
    || PLACEHOLDER_REVIEW_PREFIX_PATTERN.test(text)
    || PLACEHOLDER_REVIEW_PREFIX_PATTERN.test(unwrappedText);
}

function assertHttpUrl(value, label) {
  assertNonTbd(value, label);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute URL.`);
  }
  assert.ok(["http:", "https:"].includes(parsed.protocol), `${label} must use http(s).`);
  assert.equal(parsed.username || parsed.password, "", `${label} must not include credentials.`);
}

function assertApprovedExternalUrl(value, label) {
  assertHttpUrl(value, label);
  const parsed = new URL(value);
  const host = normalizeHostname(parsed.hostname);
  if (isDisallowedExternalHost(host)) {
    throw new Error(`${label} must be a public, non-private approved source URL; ${parsed.hostname} is local, private, reserved, or internal.`);
  }
  for (const [key] of parsed.searchParams) {
    if (isSensitiveQueryKey(key)) throw new Error(`${label} query key ${key} looks sensitive.`);
  }
}

function isSensitiveQueryKey(key) {
  const compact = String(key || "").trim().toLowerCase().replace(/[-_\s]/g, "");
  return new Set([
    "token",
    "accesstoken",
    "idtoken",
    "refreshtoken",
    "session",
    "sessionid",
    "auth",
    "authtoken",
    "authorization",
    "apikey",
    "key",
    "secret",
    "password",
    "passcode",
    "code",
    "jwt",
    "sig",
    "signature",
    "expires",
    "expiry",
    "expiration",
    "expiresin",
    "awsaccesskeyid",
    "xamzsignature",
    "xamzcredential",
    "xamzsecuritytoken",
    "xamzexpires",
    "xamzsignedheaders",
    "xgoogsignature",
    "xgoogcredential",
    "xgoogsecuritytoken",
    "xgoogexpires",
    "xgoogsignedheaders",
    "xgoogalgorithm",
    "keypairid",
    "policy"
  ]).has(compact);
}

function normalizeHostname(hostname) {
  return String(hostname || "").trim().replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "").toLowerCase();
}

function isDisallowedExternalHost(host) {
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (!host.includes(".") && !host.includes(":")) return true;
  if (["example.com", "example.net", "example.org"].includes(host)) return true;
  if ([
    ".example.com",
    ".example.net",
    ".example.org",
    ".local",
    ".internal",
    ".lan",
    ".home",
    ".test",
    ".invalid"
  ].some((suffix) => host.endsWith(suffix))) return true;
  return isPrivateOrReservedIpv4(host) || isPrivateOrReservedIpv6(host);
}

function isPrivateOrReservedIpv4(host) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
  const parts = host.split(".").map((part) => Number(part));
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && b === 18) ||
    (a === 198 && b === 19) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isPrivateOrReservedIpv6(host) {
  if (!host.includes(":")) return false;
  if (host === "::" || host === "::1") return true;
  if (host.startsWith("fe80:")) return true;
  if (/^f[cd][0-9a-f]{0,2}:/i.test(host)) return true;
  if (host.startsWith("::ffff:")) {
    return isPrivateOrReservedIpv4(expandMappedIpv4(host.slice("::ffff:".length)));
  }
  return false;
}

function expandMappedIpv4(value) {
  if (value.includes(".")) return value;
  const match = value.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!match) return value;
  const high = Number.parseInt(match[1], 16);
  const low = Number.parseInt(match[2], 16);
  return [
    (high >> 8) & 255,
    high & 255,
    (low >> 8) & 255,
    low & 255
  ].join(".");
}

function assertRunFiles(run, requiredNames) {
  requiredNames.forEach((name) => {
    assert.ok(run.files.some((file) => file.endsWith(name)), `${run.source.type} evidence missing ${name}`);
  });
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read ${label} JSON at ${path}: ${error.message}`);
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await chmod(path, 0o600).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
}

function defaultOutPath(reviewPath) {
  return join(dirname(resolve(reviewPath)), "external-source-ko-evidence-review.json");
}

function requireArg(value, label) {
  if (!value || value === true) throw new Error(`Missing --${label}.`);
  return value;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function timestampSlug(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
