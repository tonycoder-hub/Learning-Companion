import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  MOBILE_INBOX_PATCH_SCHEMA,
  REVIEW_PROGRESS_PATCH_SCHEMA,
  applyMobileInboxPatch,
  applyReviewProgressPatch,
  buildSourceJumpUrl,
  buildMirrorBundle,
  buildMirrorZip,
  extractSourceTimestamp,
  getDueReviewItems,
  sanitizeWorkspace,
  stripSourceTimestamp
} from "../apps/companion-web/src/model.js";
import { buildHarmonyReaderView } from "../apps/companion-harmony/src/schema-reader.mjs";
import {
  buildFeishuUploadDryRunReport,
  buildFeishuUploadPlan,
  materializeMirrorBundle
} from "./feishu-mirror-uploader.mjs";
import { buildCaptureResumeReceipt } from "./capture-resume-receipt.mjs";
import { buildPatchIntakeNegativeReceipt } from "./patch-intake-negative-receipt.mjs";
import { buildHarmonyScaffoldReport } from "./smoke-harmony-scaffold.mjs";
import { buildMirrorIntegrityReport } from "./mirror-integrity-check.mjs";
import { buildMorningDeterminismReport } from "./morning-determinism-check.mjs";
import { buildAdversarialGateReport } from "./adversarial-gate-check.mjs";

const OUT_DIR = process.env.MORNING_DEMO_OUT_DIR || "dist/morning-demo";
const SKIP_CLEAN = process.env.MORNING_DEMO_SKIP_CLEAN === "1";
const MIRROR_DIR = join(OUT_DIR, "mirror-folder");
const FEISHU_UPLOAD_DIR = join(OUT_DIR, "feishu-upload");
const PATCH_DIR = join(OUT_DIR, "patches");
const MORNING_GENERATED_AT = "2026-05-29T07:20:00.000+08:00";
const CAPTURE_RESUME_GENERATED_AT = "2026-05-29T07:25:00.000+08:00";
const SAMPLE_WORKSPACE_FILE = "sample-workspace.json";
const SAMPLE_MIRROR_JSON_FILE = "sample-feishu-mirror.json";
const SAMPLE_HARMONY_READER_FILE = "sample-harmony-reader-view.json";
const SAMPLE_MOBILE_INBOX_PATCH_FILE = "sample-mobile-inbox-patch.json";
const SAMPLE_REVIEW_PROGRESS_PATCH_FILE = "sample-review-progress-patch.json";
const REVIEW_REPORT_FILE = "review-start-here.html";
const DEMO_SCRIPT_FILE = "DEMO_SCRIPT.md";
const STAGE_FILE = "STAGE.md";
const MAC_MANUAL_QA_FILE = "MAC_MANUAL_QA.md";
const WINDOWS_STATIC_QA_FILE = "WINDOWS_STATIC_QA.md";
const STATIC_RETURN_CONTRACT_FILE = "STATIC_RETURN_CONTRACT.md";
const HARMONY_DEVECO_HANDOFF_FILE = "HARMONY_DEVECO_HANDOFF.md";
const HARMONY_SCAFFOLD_REPORT_FILE = "HARMONY_SCAFFOLD_REPORT.json";
const EVIDENCE_TIERS_FILE = "EVIDENCE_TIERS.json";
const CAPTURE_RESUME_RECEIPT_FILE = "CAPTURE_RESUME_RECEIPT.json";
const PATCH_INTAKE_NEGATIVE_RECEIPT_FILE = "PATCH_INTAKE_NEGATIVE_RECEIPT.json";
const SOURCE_TIME_LINKS_RECEIPT_FILE = "SOURCE_TIME_LINKS_RECEIPT.json";
const MIRROR_INTEGRITY_FILE = "MIRROR_INTEGRITY.json";
const DETERMINISM_FILE = "DETERMINISM.json";
const ADVERSARIAL_GATES_FILE = "ADVERSARIAL_GATES.json";
const DEFERRED_GATES_FILE = "DEFERRED_GATES.json";

const EVIDENCE_TIER_DEFINITIONS = Object.freeze({
  EXECUTED: {
    label: "EVIDENCE: EXECUTED",
    meaning: "Generated or validated by local scripts in this pack."
  },
  DRY_RUN: {
    label: "EVIDENCE: DRY_RUN",
    meaning: "Credential-free adapter boundary; no network, auth, or remote write."
  },
  HANDOFF_ONLY: {
    label: "EVIDENCE: HANDOFF_ONLY",
    meaning: "Implementation contract or scaffold guidance; not executed on the target device."
  },
  PENDING_USER_GATE: {
    label: "EVIDENCE: PENDING_USER_GATE",
    meaning: "Requires Tony approval, device access, credentials, or manual QA before it can be claimed."
  }
});

const demoWorkspace = sanitizeWorkspace({
  schema: "learning-companion.workspace.v1",
  schemaVersion: 1,
  version: 1,
  clientId: "client_morning_demo",
  activeSessionId: "session_rust_video",
  importedPatches: [],
  importedReviewPatches: [],
  createdAt: "2026-05-29T06:30:00.000+08:00",
  updatedAt: "2026-05-29T06:50:00.000+08:00",
  sessions: [
    {
      id: "session_rust_video",
      originClientId: "client_morning_demo",
      title: "Rust ownership video",
      sourceTitle: "RustConf ownership talk",
      sourceUrl: "https://www.youtube.com/watch?v=rust123",
      materialType: "video",
      tags: ["rust", "memory"],
      focusMode: "capture",
      notesMarkdown: [
        "# Rust ownership video",
        "",
        "Ownership connects memory safety to compile-time checks. The next useful step is reviewing the lifetime/card pair, then adding one synthesis paragraph from the freshest captures."
      ].join("\n"),
      captures: [
        {
          id: "capture_rust_ownership",
          quote: "Ownership lets Rust make memory safety guarantees without a garbage collector.",
          thought: "Connect this to compile-time lifetime checks.",
          timestamp: "08:12",
          sourceTitle: "RustConf ownership talk",
          sourceUrl: "https://www.youtube.com/watch?v=rust123",
          materialType: "video",
          sourceProvenance: "snapshot",
          tags: ["rust", "memory"],
          createdAt: "2026-05-29T06:32:00.000+08:00",
          capturedAt: "2026-05-29T06:32:00.000+08:00",
          updatedAt: "2026-05-29T06:32:00.000+08:00",
          originClientId: "client_morning_demo",
          promotedToReview: true
        },
        {
          id: "capture_borrow_checker",
          quote: "The borrow checker prevents aliasing and mutation from colliding.",
          thought: "This is the anchor for comparing Rust with GC languages.",
          timestamp: "11:03",
          sourceTitle: "RustConf ownership talk",
          sourceUrl: "https://www.youtube.com/watch?v=rust123",
          materialType: "video",
          sourceProvenance: "snapshot",
          tags: ["borrow-checker"],
          createdAt: "2026-05-29T06:36:00.000+08:00",
          capturedAt: "2026-05-29T06:36:00.000+08:00",
          updatedAt: "2026-05-29T06:36:00.000+08:00",
          originClientId: "client_morning_demo",
          promotedToReview: false
        },
        {
          id: "capture_trait_question_open",
          quote: "Traits define shared behavior without forcing inheritance.",
          thought: "How should I compare Rust traits with TypeScript interfaces?",
          timestamp: "12:20",
          sourceTitle: "RustConf ownership talk",
          sourceUrl: "https://www.youtube.com/watch?v=rust123",
          materialType: "video",
          sourceProvenance: "snapshot",
          tags: ["rust", "question"],
          questionResolvedAt: null,
          createdAt: "2026-05-29T06:38:00.000+08:00",
          capturedAt: "2026-05-29T06:38:00.000+08:00",
          updatedAt: "2026-05-29T06:38:00.000+08:00",
          originClientId: "client_morning_demo",
          promotedToReview: false
        },
        {
          id: "capture_gc_question_resolved",
          quote: "Ownership makes the lifetime of values explicit.",
          thought: "Why is this not just a garbage collector with extra rules?",
          timestamp: "14:02",
          sourceTitle: "RustConf ownership talk",
          sourceUrl: "https://www.youtube.com/watch?v=rust123",
          materialType: "video",
          sourceProvenance: "snapshot",
          tags: ["rust", "answered"],
          questionResolvedAt: "2026-05-29T06:49:00.000+08:00",
          createdAt: "2026-05-29T06:44:00.000+08:00",
          capturedAt: "2026-05-29T06:44:00.000+08:00",
          updatedAt: "2026-05-29T06:49:00.000+08:00",
          originClientId: "client_morning_demo",
          promotedToReview: false
        },
        {
          id: "capture_gc_question_answer",
          quote: "Garbage collection reclaims unreachable memory at runtime; ownership prevents invalid access before runtime.",
          thought: "Answer: ownership is a compile-time discipline, while GC is a runtime reclamation strategy.",
          timestamp: "14:08",
          sourceTitle: "RustConf ownership talk",
          sourceUrl: "https://www.youtube.com/watch?v=rust123",
          materialType: "video",
          sourceProvenance: "snapshot",
          tags: ["rust", "answer"],
          answersQuestionCaptureId: "capture_gc_question_resolved",
          createdAt: "2026-05-29T06:48:00.000+08:00",
          capturedAt: "2026-05-29T06:48:00.000+08:00",
          updatedAt: "2026-05-29T06:49:00.000+08:00",
          originClientId: "client_morning_demo",
          promotedToReview: false
        },
        {
          id: "capture_trait_question_parked",
          quote: "Trait objects can erase concrete types behind dynamic dispatch.",
          thought: "When should I compare trait objects with TypeScript structural typing?",
          timestamp: "16:10",
          sourceTitle: "RustConf ownership talk",
          sourceUrl: "https://www.youtube.com/watch?v=rust123",
          materialType: "video",
          sourceProvenance: "snapshot",
          tags: ["rust", "question", "parked"],
          questionResolvedAt: null,
          questionParkedAt: "2026-05-29T06:52:00.000+08:00",
          createdAt: "2026-05-29T06:51:00.000+08:00",
          capturedAt: "2026-05-29T06:51:00.000+08:00",
          updatedAt: "2026-05-29T06:52:00.000+08:00",
          originClientId: "client_morning_demo",
          promotedToReview: false
        }
      ],
      reviewCards: [
        {
          id: "card_rust_lifetime",
          prompt: "What does ownership let Rust guarantee without a garbage collector?",
          answer: "Memory safety through compile-time ownership and lifetime checks.",
          sourceCaptureId: "capture_rust_ownership",
          dueAt: "2026-05-29T06:30:00.000+08:00",
          strength: 0,
          createdAt: "2026-05-29T06:33:00.000+08:00",
          updatedAt: "2026-05-29T06:33:00.000+08:00",
          lastReviewedAt: null,
          originClientId: "client_morning_demo"
        }
      ],
      createdAt: "2026-05-29T06:30:00.000+08:00",
      updatedAt: "2026-05-29T06:50:00.000+08:00"
    },
    {
      id: "session_algorithms_doc",
      originClientId: "client_morning_demo",
      title: "Algorithms graph notes",
      sourceTitle: "Dijkstra lecture notes",
      sourceUrl: "https://example.com/algorithms/dijkstra",
      materialType: "doc",
      tags: ["algorithms", "graph"],
      focusMode: "review",
      notesMarkdown: "# Algorithms graph notes\n\nDijkstra explores the lowest-cost frontier first. The review card should stay close to that capture.",
      captures: [
        {
          id: "capture_dijkstra_frontier",
          quote: "Dijkstra explores the lowest-cost frontier first.",
          thought: "Recall why greedy selection works.",
          timestamp: "",
          sourceTitle: "Dijkstra lecture notes",
          sourceUrl: "https://example.com/algorithms/dijkstra",
          materialType: "doc",
          sourceProvenance: "snapshot",
          tags: ["algorithms", "graph"],
          createdAt: "2026-05-29T06:40:00.000+08:00",
          capturedAt: "2026-05-29T06:40:00.000+08:00",
          updatedAt: "2026-05-29T06:40:00.000+08:00",
          originClientId: "client_morning_demo",
          promotedToReview: true
        }
      ],
      reviewCards: [
        {
          id: "card_dijkstra_frontier",
          prompt: "Which frontier does Dijkstra explore first?",
          answer: "The lowest-cost frontier.",
          sourceCaptureId: "capture_dijkstra_frontier",
          dueAt: "2026-05-29T06:35:00.000+08:00",
          strength: 1,
          createdAt: "2026-05-29T06:41:00.000+08:00",
          updatedAt: "2026-05-29T06:41:00.000+08:00",
          lastReviewedAt: null,
          originClientId: "client_morning_demo"
        }
      ],
      createdAt: "2026-05-29T06:39:00.000+08:00",
      updatedAt: "2026-05-29T06:45:00.000+08:00"
    }
  ]
});

const mobileInboxPatch = {
  schema: MOBILE_INBOX_PATCH_SCHEMA,
  appVersion: 1,
  patchId: "morning_demo_mobile_inbox_patch",
  createdAt: "2026-05-29T07:05:00.000+08:00",
  source: {
    generatedBy: "inbox.html",
    workspaceFingerprint: "morning-demo",
    topicId: "session_rust_video",
    topicTitle: "Rust ownership video"
  },
  target: {
    topicId: "session_rust_video",
    topicTitle: "Rust ownership video"
  },
  captures: [
    {
      id: "morning_demo_phone_capture",
      quote: "Traits and TypeScript interfaces both describe behavior, but Rust trait bounds participate in compile-time dispatch and coherence.",
      thought: "Answer: compare them as shared-behavior contracts, then call out Rust's explicit impl and dispatch model.",
      timestamp: "13:20",
      sourceTitle: "HarmonyOS browser",
      sourceUrl: "javascript:alert(1)",
      materialType: "doc",
      tags: "phone mirror answer",
      answersQuestionCaptureId: "capture_trait_question_open",
      capturedAt: "2026-05-29T07:06:00.000+08:00"
    }
  ]
};

const [firstDue] = getDueReviewItems(demoWorkspace, new Date("2026-05-29T07:00:00.000+08:00"));
assert.ok(firstDue, "demo workspace should have a due review card");
const reviewProgressPatch = {
  schema: REVIEW_PROGRESS_PATCH_SCHEMA,
  appVersion: 1,
  patchId: "morning_demo_review_progress_patch",
  createdAt: "2026-05-29T07:10:00.000+08:00",
  source: {
    generatedBy: "review.html",
    workspaceFingerprint: "morning-demo"
  },
  events: [
    {
      id: "morning_demo_review_event",
      sessionId: firstDue.sessionId,
      cardId: firstDue.card.id,
      grade: "good",
      reviewedAt: "2026-05-29T07:11:00.000+08:00",
      baseUpdatedAt: firstDue.card.updatedAt,
      baseDueAt: firstDue.card.dueAt,
      baseStrength: firstDue.card.strength
    }
  ]
};

const inboxResult = applyMobileInboxPatch(demoWorkspace, mobileInboxPatch, new Date("2026-05-29T07:08:00.000+08:00"));
assert.equal(inboxResult.receipt.added, 1);
assert.equal(inboxResult.receipt.sanitizedSourceUrls, 1);
assert.equal(inboxResult.receipt.answeredQuestions, 1);
assert.equal(inboxResult.receipt.skippedAnswerTargets, 0);
const duplicateInboxResult = applyMobileInboxPatch(inboxResult.workspace, mobileInboxPatch, new Date("2026-05-29T07:09:00.000+08:00"));
assert.equal(duplicateInboxResult.receipt.targetResolution, "duplicate-patch");
assert.equal(duplicateInboxResult.receipt.added, 0);
let unsupportedInboxPatchRejected = false;
try {
  applyMobileInboxPatch(demoWorkspace, { schema: "invalid" });
} catch (error) {
  unsupportedInboxPatchRejected = /Unsupported mobile inbox patch/.test(error.message);
}
assert.equal(unsupportedInboxPatchRejected, true);
const reviewResult = applyReviewProgressPatch(demoWorkspace, reviewProgressPatch, new Date("2026-05-29T07:12:00.000+08:00"));
assert.equal(reviewResult.receipt.applied, 1);
const reviewConflictResult = applyReviewProgressPatch(demoWorkspace, {
  ...reviewProgressPatch,
  patchId: "morning_demo_review_conflict_patch",
  events: [{
    ...reviewProgressPatch.events[0],
    id: "morning_demo_review_conflict_event",
    baseUpdatedAt: "2026-05-29T00:00:00.000+08:00"
  }]
}, new Date("2026-05-29T07:13:00.000+08:00"));
assert.equal(reviewConflictResult.receipt.applied, 0);
assert.equal(reviewConflictResult.receipt.skippedConflict, 1);

if (!SKIP_CLEAN) await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(MIRROR_DIR, { recursive: true });
await mkdir(PATCH_DIR, { recursive: true });

const mirrorBundle = buildMirrorBundle(demoWorkspace, {
  exportedAt: MORNING_GENERATED_AT
});
const todayMarkdownFile = mirrorBundle.files.find((file) => file.path === "TODAY.md")?.content || "";
assert.match(todayMarkdownFile, /Closed Today/);
assert.match(todayMarkdownFile, /Answers Today/);
assert.match(todayMarkdownFile, /Answer: ownership is a compile-time discipline, while GC is a runtime reclamation strategy/);
const mirrorZip = buildMirrorZip(demoWorkspace, {
  exportedAt: MORNING_GENERATED_AT
});
const feishuUploadPlan = buildFeishuUploadPlan(mirrorBundle, {
  rootName: "Learning Companion Morning Demo",
  generatedAt: mirrorBundle.exportedAt
});
const harmonyReaderView = buildHarmonyReaderView(mirrorBundle, {
  now: "2026-05-29T07:20:00.000+08:00"
});
const harmonyScaffoldReport = buildHarmonyScaffoldReport({
  checkedAt: "2026-05-29T07:21:00.000+08:00"
});
const sampleMirrorZipFile = `sample-${mirrorZip.filename}`;
await writeJson(join(OUT_DIR, SAMPLE_WORKSPACE_FILE), demoWorkspace);
await writeJson(join(OUT_DIR, SAMPLE_MIRROR_JSON_FILE), mirrorBundle);
await writeJson(join(OUT_DIR, SAMPLE_HARMONY_READER_FILE), harmonyReaderView);
await writeJson(join(OUT_DIR, HARMONY_SCAFFOLD_REPORT_FILE), harmonyScaffoldReport);
await writeFile(join(OUT_DIR, sampleMirrorZipFile), Buffer.from(mirrorZip.data));
await writeJson(join(PATCH_DIR, SAMPLE_MOBILE_INBOX_PATCH_FILE), mobileInboxPatch);
await writeJson(join(PATCH_DIR, SAMPLE_REVIEW_PROGRESS_PATCH_FILE), reviewProgressPatch);
const feishuUploadResult = materializeMirrorBundle(mirrorBundle, FEISHU_UPLOAD_DIR, {
  plan: feishuUploadPlan,
  force: SKIP_CLEAN
});
const feishuUploadReport = buildFeishuUploadDryRunReport(feishuUploadPlan, join(FEISHU_UPLOAD_DIR, "files"), {
  generatedAt: mirrorBundle.exportedAt
});
await writeJson(join(FEISHU_UPLOAD_DIR, "feishu-upload-report.json"), feishuUploadReport);
const captureResumeReceipt = buildCaptureResumeReceipt({
  generatedAt: CAPTURE_RESUME_GENERATED_AT
});
await writeJson(join(OUT_DIR, CAPTURE_RESUME_RECEIPT_FILE), captureResumeReceipt);
const sourceTimeLinksReceipt = buildSourceTimeLinksReceipt({
  generatedAt: "2026-05-29T07:28:00.000+08:00"
});
await writeJson(join(OUT_DIR, SOURCE_TIME_LINKS_RECEIPT_FILE), sourceTimeLinksReceipt);
const patchIntakeNegativeReceipt = buildPatchIntakeNegativeReceipt({
  generatedAt: "2026-05-29T07:30:00.000+08:00"
});
await writeJson(join(OUT_DIR, PATCH_INTAKE_NEGATIVE_RECEIPT_FILE), patchIntakeNegativeReceipt);
assert.equal(feishuUploadResult.fileCount, mirrorBundle.files.length);
assert.equal(feishuUploadResult.bundleFingerprint, mirrorBundle.manifest.bundleFingerprint);
assert.equal(feishuUploadReport.summary.verifiedFiles, mirrorBundle.files.length);
assert.equal(feishuUploadReport.wouldSend.status, "not-sent");
assert.equal(feishuUploadReport.wouldSend.requestCount, mirrorBundle.files.length);
assert.equal(feishuUploadReport.wouldSend.requests.every((request) => /^[a-f0-9]{64}$/.test(request.payloadSha256)), true);
assert.equal(captureResumeReceipt.roundTrip.ok, true);
assert.equal(captureResumeReceipt.roundTrip.addedCaptureCount, 3);
assert.equal(captureResumeReceipt.roundTrip.allInputsVisibleInToday, true);
assert.equal(sourceTimeLinksReceipt.summary.ok, true);
assert.equal(sourceTimeLinksReceipt.summary.passed, sourceTimeLinksReceipt.summary.cases);
assert.equal(patchIntakeNegativeReceipt.summary.ok, true);
assert.equal(patchIntakeNegativeReceipt.summary.expectedFailuresObserved, patchIntakeNegativeReceipt.summary.cases);
assert.equal(harmonyReaderView.workspace.sessionCount, demoWorkspace.sessions.length);
assert.equal(harmonyReaderView.activeTopic.id, demoWorkspace.activeSessionId);
assert.equal(harmonyReaderView.workspace.openQuestionCount, 1);
assert.equal(harmonyReaderView.workspace.parkedQuestionCount, 1);
assert.equal(harmonyReaderView.workspace.unresolvedQuestionCount, 2);
assert.equal(harmonyReaderView.activeTopic.openQuestionCount, 1);
assert.equal(harmonyReaderView.activeTopic.parkedQuestionCount, 1);
assert.equal(harmonyReaderView.activeTopic.unresolvedQuestionCount, 2);
assert.equal(harmonyReaderView.openQuestions.length, 1);
assert.equal(harmonyReaderView.openQuestions[0].captureId, "capture_trait_question_open");
assert.equal(harmonyReaderView.parkedQuestions.length, 1);
assert.equal(harmonyReaderView.parkedQuestions[0].captureId, "capture_trait_question_parked");
assert.equal(
  harmonyReaderView.recentCaptures.find((capture) => capture.captureId === "capture_gc_question_resolved")?.isOpenQuestion,
  false
);
assert.equal(harmonyScaffoldReport.ok, true);

for (const file of mirrorBundle.files) {
  await writeText(join(MIRROR_DIR, file.path), file.content);
}
const mirrorIntegrityReport = buildMirrorIntegrityReport(MIRROR_DIR, {
  checkedAt: mirrorBundle.exportedAt,
  rootLabel: "mirror-folder"
});
await writeJson(join(OUT_DIR, MIRROR_INTEGRITY_FILE), mirrorIntegrityReport);
assert.equal(mirrorIntegrityReport.ok, true);
assert.equal(mirrorIntegrityReport.summary.brokenLinks, 0);
const adversarialGateReport = buildAdversarialGateReport({
  checkedAt: mirrorBundle.exportedAt
});
await writeJson(join(OUT_DIR, ADVERSARIAL_GATES_FILE), adversarialGateReport);
assert.equal(adversarialGateReport.ok, true);
assert.equal(adversarialGateReport.checks.every((check) => check.expectedFailureObserved), true);
const deferredGates = buildDeferredGatesManifest({
  generatedAt: mirrorBundle.exportedAt
});
await writeJson(join(OUT_DIR, DEFERRED_GATES_FILE), deferredGates);
let determinismReport = null;
if (process.env.MORNING_SKIP_DETERMINISM !== "1") {
  determinismReport = buildMorningDeterminismReport({
    checkedAt: mirrorBundle.exportedAt
  });
  await writeJson(join(OUT_DIR, DETERMINISM_FILE), determinismReport);
  assert.equal(determinismReport.ok, true);
  assert.equal(determinismReport.summary.differences, 0);
}

const macManualQaMarkdown = buildMacManualQaMarkdown({
  sampleMirrorZipFile,
  feishuUploadReport
});
const macManualQaStatus = summarizeManualQa(macManualQaMarkdown);
const windowsStaticQaMarkdown = buildWindowsStaticQaMarkdown({
  sampleMirrorZipFile
});
const windowsStaticQaStatus = summarizeManualQa(windowsStaticQaMarkdown);
assert.match(windowsStaticQaMarkdown, /Return-ready mirror/);
assert.match(windowsStaticQaMarkdown, /review\.html/);
assert.match(windowsStaticQaMarkdown, /inbox\.html/);
assert.match(windowsStaticQaMarkdown, /returnBaseFingerprint/);

await writeText(join(OUT_DIR, "MORNING_REVIEW.md"), buildMorningReviewMarkdown({
  mirrorBundle,
  mirrorZip,
  sampleMirrorZipFile,
  feishuUploadPlan,
  feishuUploadResult,
  feishuUploadReport,
  captureResumeReceipt,
  sourceTimeLinksReceipt,
  patchIntakeNegativeReceipt,
  mirrorIntegrityReport,
  adversarialGateReport,
  deferredGates,
  determinismReport,
  harmonyReaderView,
  harmonyScaffoldReport,
  windowsStaticQaStatus,
  inboxReceipt: inboxResult.receipt,
  duplicateInboxReceipt: duplicateInboxResult.receipt,
  reviewReceipt: reviewResult.receipt,
  reviewConflictReceipt: reviewConflictResult.receipt,
  unsupportedInboxPatchRejected
}));
await writeText(join(OUT_DIR, STAGE_FILE), buildStageMarkdown({
  mirrorBundle,
  feishuUploadReport,
  captureResumeReceipt,
  sourceTimeLinksReceipt,
  patchIntakeNegativeReceipt,
  mirrorIntegrityReport,
  adversarialGateReport,
  deferredGates,
  determinismReport,
  harmonyReaderView,
  harmonyScaffoldReport,
  unsupportedInboxPatchRejected,
  macManualQaStatus,
  windowsStaticQaStatus
}));
await writeText(join(OUT_DIR, MAC_MANUAL_QA_FILE), macManualQaMarkdown);
await writeText(join(OUT_DIR, WINDOWS_STATIC_QA_FILE), windowsStaticQaMarkdown);
await writeText(join(OUT_DIR, STATIC_RETURN_CONTRACT_FILE), buildStaticReturnContractMarkdown());
await writeText(
  join(OUT_DIR, HARMONY_DEVECO_HANDOFF_FILE),
  `${buildEvidenceBadgeMarkdown(HARMONY_DEVECO_HANDOFF_FILE)}${await readFile("apps/companion-harmony/DEVECO_HANDOFF.md", "utf8")}`
);
await writeText(join(OUT_DIR, DEMO_SCRIPT_FILE), buildDemoScriptMarkdown({
  captureResumeReceipt,
  sourceTimeLinksReceipt,
  deferredGates,
  harmonyScaffoldReport,
  mirrorIntegrityReport,
  sampleMirrorZipFile
}));
const reviewReportHtml = buildReviewStartHereHtml({
  mirrorBundle,
  mirrorZip,
  sampleMirrorZipFile,
  feishuUploadPlan,
  feishuUploadResult,
  feishuUploadReport,
  captureResumeReceipt,
  sourceTimeLinksReceipt,
  patchIntakeNegativeReceipt,
  mirrorIntegrityReport,
  adversarialGateReport,
  deferredGates,
  determinismReport,
  harmonyReaderView,
  harmonyScaffoldReport,
  inboxReceipt: inboxResult.receipt,
  duplicateInboxReceipt: duplicateInboxResult.receipt,
  reviewReceipt: reviewResult.receipt,
  reviewConflictReceipt: reviewConflictResult.receipt,
  unsupportedInboxPatchRejected
});
assert.match(reviewReportHtml, /href="MORNING_REVIEW\.md"/);
assert.match(reviewReportHtml, /href="DEMO_SCRIPT\.md"/);
assert.match(reviewReportHtml, /href="STAGE\.md"/);
assert.match(reviewReportHtml, /href="MAC_MANUAL_QA\.md"/);
assert.match(reviewReportHtml, /href="WINDOWS_STATIC_QA\.md"/);
assert.match(reviewReportHtml, /href="STATIC_RETURN_CONTRACT\.md"/);
assert.match(reviewReportHtml, /href="HARMONY_DEVECO_HANDOFF\.md"/);
assert.match(reviewReportHtml, /href="EVIDENCE_TIERS\.json"/);
assert.match(reviewReportHtml, /href="DEFERRED_GATES\.json"/);
assert.match(reviewReportHtml, /href="mirror-folder\/index\.html"/);
assert.match(reviewReportHtml, /Fixture-only/);
assert.match(reviewReportHtml, /EVIDENCE: DRY_RUN/);
assert.match(reviewReportHtml, /open question/);
assert.match(reviewReportHtml, /parked question/);
assert.match(reviewReportHtml, /What To Inspect First/);
assert.match(reviewReportHtml, /Mac Capture Sidecar/);
assert.match(reviewReportHtml, /source\/time context strip/);
assert.match(reviewReportHtml, /First-Run First Note/);
assert.match(reviewReportHtml, /without repeating Open source/);
assert.match(reviewReportHtml, /Capture this thought/);
assert.match(reviewReportHtml, /npm run check:static-return/);
assert.match(reviewReportHtml, /Today section map/);
assert.match(reviewReportHtml, /Harmony Reader Session/);
assert.match(reviewReportHtml, /rejected-kept-current/);
assert.match(reviewReportHtml, /Focus Loop/);
assert.match(reviewReportHtml, /Question Closure/);
assert.match(reviewReportHtml, /Question Queue Health/);
assert.match(reviewReportHtml, /Windows Static Return/);
assert.match(reviewReportHtml, /Evidence Boundary/);
await writeText(join(OUT_DIR, REVIEW_REPORT_FILE), reviewReportHtml);

const preSummaryManifest = await collectOutputManifest(OUT_DIR);
const evidenceTiers = buildEvidenceTierManifest(preSummaryManifest, {
  generatedAt: mirrorBundle.exportedAt
});
await writeJson(join(OUT_DIR, EVIDENCE_TIERS_FILE), evidenceTiers);
const outputManifest = await collectOutputManifest(OUT_DIR);
const credentialSweep = await scanForCredentialLikeText(OUT_DIR, {
  rootLabel: "morning-demo"
});
assert.equal(credentialSweep.ok, true, `credential-like text found in ${credentialSweep.matches.map((item) => item.path).join(", ")}`);
await writeJson(join(OUT_DIR, "SUMMARY.json"), {
  ok: true,
  kind: "fixture",
  scope: "local-fixture",
  evidence: getEvidenceTierForPath("SUMMARY.json"),
  stageStatement: "cross-end fixture-ready, not live cross-end ready",
  integrationStages: [
    { area: "Mac", stage: "internal-build", proof: "offline pack generated; native/browser gates are split to avoid sandbox-only failures" },
    { area: "Feishu", stage: "dry-run", proof: "local upload plan/report; no network call was made" },
    { area: "HarmonyOS", stage: "schema-prototype", proof: "local reader view smoke only, including open-question contract evidence" },
    { area: "Windows", stage: "portable-fixture", proof: `static mirror files plus pending receipt ${windowsStaticQaStatus.filled}/${windowsStaticQaStatus.total} filled` }
  ],
  notProven: [
    "live Feishu Drive write",
    "real HarmonyOS device roundtrip",
    "Windows manual import/export run",
    "signed or notarized Mac packaging",
    "off-Mac generated patch imported on Mac",
    "live video-site timestamp playback"
  ],
  disclaimer: "Fixture-only generated sample data. This does not prove live Feishu sync, HarmonyOS device behavior, or signed Mac packaging.",
  generatedAt: mirrorBundle.exportedAt,
  provenance: {
    gitSha: getGitSha(),
    nodeVersion: process.version,
    generator: "scripts/build-morning-demo.mjs"
  },
  workspace: SAMPLE_WORKSPACE_FILE,
  reviewReport: REVIEW_REPORT_FILE,
  macManualQa: MAC_MANUAL_QA_FILE,
  windowsStaticQa: WINDOWS_STATIC_QA_FILE,
  staticReturnContract: STATIC_RETURN_CONTRACT_FILE,
  harmonyDevEcoHandoff: HARMONY_DEVECO_HANDOFF_FILE,
  harmonyScaffoldReport: HARMONY_SCAFFOLD_REPORT_FILE,
  evidenceTiers: EVIDENCE_TIERS_FILE,
  deferredGates: DEFERRED_GATES_FILE,
  evidenceTierCounts: evidenceTiers.summary.counts,
  mirrorBundle: SAMPLE_MIRROR_JSON_FILE,
  mirrorZip: sampleMirrorZipFile,
  mirrorFileCount: mirrorBundle.files.length,
  mirrorBundleFingerprint: mirrorBundle.manifest.bundleFingerprint,
  feishuUploadPlan: "feishu-upload/feishu-upload-plan.json",
  feishuUploadReport: "feishu-upload/feishu-upload-report.json",
  feishuUploadFileCount: feishuUploadResult.fileCount,
  feishuUploadWouldSend: {
    status: feishuUploadReport.wouldSend.status,
    requestCount: feishuUploadReport.wouldSend.requestCount,
    operation: feishuUploadReport.wouldSend.operation,
    targetTreeFiles: feishuUploadReport.targetTree.files.length
  },
  captureResumeReceipt: CAPTURE_RESUME_RECEIPT_FILE,
  sourceTimeLinksReceipt: SOURCE_TIME_LINKS_RECEIPT_FILE,
  patchIntakeNegativeReceipt: PATCH_INTAKE_NEGATIVE_RECEIPT_FILE,
  mirrorIntegrity: MIRROR_INTEGRITY_FILE,
  adversarialGates: ADVERSARIAL_GATES_FILE,
  determinism: determinismReport ? DETERMINISM_FILE : null,
  harmonyReaderView: SAMPLE_HARMONY_READER_FILE,
  macManualQaStatus,
  windowsStaticQaReceipt: buildManualQaReceiptSummary({
    file: WINDOWS_STATIC_QA_FILE,
    evidenceTier: "PENDING_USER_GATE",
    evidenceStatus: windowsStaticQaStatus.filled === 0 ? "NOT_RUN" : "PARTIAL",
    receiptOnly: windowsStaticQaStatus.filled === 0,
    status: windowsStaticQaStatus
  }),
  mobileInboxPatch: `patches/${SAMPLE_MOBILE_INBOX_PATCH_FILE}`,
  reviewProgressPatch: `patches/${SAMPLE_REVIEW_PROGRESS_PATCH_FILE}`,
  assertions: {
    mobileInboxAdded: inboxResult.receipt.added,
    mobileInboxSanitizedSourceUrls: inboxResult.receipt.sanitizedSourceUrls,
    duplicateInboxTargetResolution: duplicateInboxResult.receipt.targetResolution,
    reviewProgressApplied: reviewResult.receipt.applied,
    reviewProgressSkippedConflict: reviewConflictResult.receipt.skippedConflict,
    unsupportedInboxPatchRejected,
    feishuUploadFileCount: feishuUploadResult.fileCount,
    feishuUploadDryRunVerified: feishuUploadReport.summary.verifiedFiles,
    feishuUploadNoNetworkCall: feishuUploadReport.boundary.network === "not-called",
    feishuUploadWouldSendNoNetwork: feishuUploadReport.wouldSend.status === "not-sent",
    feishuUploadWouldSendRequests: feishuUploadReport.wouldSend.requestCount,
    feishuUploadWouldSendPayloadHashes: feishuUploadReport.wouldSend.requests.filter((request) => /^[a-f0-9]{64}$/.test(request.payloadSha256)).length,
    feishuUploadTargetTreeFiles: feishuUploadReport.targetTree.files.length,
    captureResumeAdded: captureResumeReceipt.roundTrip.addedCaptureCount,
    captureResumeVisibleInToday: captureResumeReceipt.roundTrip.allInputsVisibleInToday,
    captureResumeTodayHashChanged: captureResumeReceipt.roundTrip.todayHashChanged,
    captureResumeFocusBriefNextAction: captureResumeReceipt.roundTrip.focusBriefNextAction,
    captureDraftDueReviewOverrideAllowed: captureResumeReceipt.draftFocus.cases.dueReviewBeatsFreshDraft.shouldOverride,
    sourceTimeLinksOk: sourceTimeLinksReceipt.summary.ok,
    sourceTimeLinksCases: sourceTimeLinksReceipt.summary.cases,
    sourceTimeLinksPassed: sourceTimeLinksReceipt.summary.passed,
    sourceTimeLinksLiveSiteVerified: sourceTimeLinksReceipt.summary.liveSiteVerified,
    patchIntakeNegativeExpectedFailures: patchIntakeNegativeReceipt.summary.expectedFailuresObserved,
    patchIntakeNegativeCases: patchIntakeNegativeReceipt.summary.cases,
    mirrorIntegrityOk: mirrorIntegrityReport.ok,
    mirrorIntegrityBrokenLinks: mirrorIntegrityReport.summary.brokenLinks,
    adversarialGatesExpectedFailuresObserved: adversarialGateReport.checks.filter((check) => check.expectedFailureObserved).length,
    deferredGatesPending: deferredGates.summary.pending,
    morningDeterministic: determinismReport ? determinismReport.ok : "skipped",
    harmonyReaderTopics: harmonyReaderView.topics.length,
    harmonyReaderOpenQuestions: harmonyReaderView.workspace.openQuestionCount,
    harmonyReaderParkedQuestions: harmonyReaderView.workspace.parkedQuestionCount || 0,
    harmonyReaderUnresolvedQuestions: harmonyReaderView.workspace.unresolvedQuestionCount || harmonyReaderView.workspace.openQuestionCount,
    harmonyReaderOpenQuestionPreviewCount: harmonyReaderView.openQuestions.length,
    harmonyReaderAnsweredQuestionFlags: harmonyReaderView.recentCaptures.filter((capture) => capture.isQuestion && !capture.isOpenQuestion).length,
    harmonyScaffoldOk: harmonyScaffoldReport.ok,
    harmonyScaffoldFiles: harmonyScaffoldReport.fileCount,
    dashboardLinksExist: true,
    credentialSweepOk: credentialSweep.ok
  },
  outputManifest,
  credentialSweepScope: credentialSweep.scope,
  credentialSweep
});
await assertLocalDashboardLinksExist(reviewReportHtml, OUT_DIR);

console.log("morning_demo_ok");
console.log(`${OUT_DIR}/${REVIEW_REPORT_FILE}`);

async function writeJson(path, value) {
  await writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value);
}

function buildSourceTimeLinksReceipt(options = {}) {
  const caseSpecs = [
    {
      id: "youtube_param_precedence",
      provider: "youtube",
      inputUrl: "https://youtu.be/rust123?t=1m30s&start=492&time_continue=3723",
      jumpTimestamp: "01:30",
      expectedExtractedTimestamp: "01:30",
      expectedStrippedUrl: "https://youtu.be/rust123",
      expectedJumpUrl: "https://youtu.be/rust123?t=90s",
      expectation: "YouTube t wins over start/time_continue; canonical jump writes t=<seconds>s."
    },
    {
      id: "youtube_short_link_zero",
      provider: "youtube",
      inputUrl: "https://youtu.be/rust123?t=0",
      jumpTimestamp: "00:00",
      expectedExtractedTimestamp: "00:00",
      expectedStrippedUrl: "https://youtu.be/rust123",
      expectedJumpUrl: "https://youtu.be/rust123?t=0s",
      expectation: "YouTube short links preserve an explicit zero timestamp instead of treating it as missing."
    },
    {
      id: "youtube_duration_hours",
      provider: "youtube",
      inputUrl: "https://www.youtube.com/watch?v=rust123&t=1h2m3s",
      jumpTimestamp: "1:02:03",
      expectedExtractedTimestamp: "1:02:03",
      expectedStrippedUrl: "https://www.youtube.com/watch?v=rust123",
      expectedJumpUrl: "https://www.youtube.com/watch?v=rust123&t=3723s",
      expectation: "YouTube duration timestamps with hours are parsed and emitted as seconds."
    },
    {
      id: "youtube_malformed_time_stripped",
      provider: "youtube",
      inputUrl: "https://www.youtube.com/watch?v=rust123&t=banana",
      jumpTimestamp: "01:30",
      expectedExtractedTimestamp: "",
      expectedStrippedUrl: "https://www.youtube.com/watch?v=rust123",
      expectedJumpUrl: "https://www.youtube.com/watch?v=rust123&t=90s",
      expectation: "Malformed YouTube time values are not imported as local timestamps, but known time keys are stripped before a fresh jump is built."
    },
    {
      id: "bilibili_mobile_part_preserved",
      provider: "bilibili",
      inputUrl: "https://m.bilibili.com/video/BV123/?p=2&t=90",
      jumpTimestamp: "01:30",
      expectedExtractedTimestamp: "01:30",
      expectedStrippedUrl: "https://m.bilibili.com/video/BV123/?p=2",
      expectedJumpUrl: "https://m.bilibili.com/video/BV123/?p=2&t=90",
      expectation: "Bilibili t is numeric seconds and the video part parameter survives strip/jump."
    },
    {
      id: "bilibili_desktop_no_part",
      provider: "bilibili",
      inputUrl: "https://www.bilibili.com/video/BV123?t=90",
      jumpTimestamp: "01:30",
      expectedExtractedTimestamp: "01:30",
      expectedStrippedUrl: "https://www.bilibili.com/video/BV123",
      expectedJumpUrl: "https://www.bilibili.com/video/BV123?t=90",
      expectation: "Desktop Bilibili links do not require a part parameter for time extraction or jump construction."
    },
    {
      id: "vimeo_multikey_hash",
      provider: "vimeo",
      inputUrl: "https://player.vimeo.com/video/123456789?h=abc#t=90s&autoplay=1",
      jumpTimestamp: "01:30",
      expectedExtractedTimestamp: "01:30",
      expectedStrippedUrl: "https://player.vimeo.com/video/123456789?h=abc#autoplay=1",
      expectedJumpUrl: "https://player.vimeo.com/video/123456789?h=abc#autoplay=1&t=1m30s",
      expectation: "Vimeo timestamp lives in hash parameter t; unrelated hash keys are preserved."
    },
    {
      id: "vimeo_path_style",
      provider: "vimeo",
      inputUrl: "https://vimeo.com/123456789#t=1m30s",
      jumpTimestamp: "01:30",
      expectedExtractedTimestamp: "01:30",
      expectedStrippedUrl: "https://vimeo.com/123456789",
      expectedJumpUrl: "https://vimeo.com/123456789#t=1m30s",
      expectation: "Vimeo path-style URLs support the same hash timestamp contract as player URLs."
    },
    {
      id: "vimeo_non_key_hash_preserved",
      provider: "vimeo",
      inputUrl: "https://vimeo.com/123456789#chapter-one",
      jumpTimestamp: "01:30",
      expectedExtractedTimestamp: "",
      expectedStrippedUrl: "https://vimeo.com/123456789#chapter-one",
      expectedJumpUrl: "https://vimeo.com/123456789#chapter-one",
      expectation: "A non-key Vimeo hash is treated as navigation state and is not overwritten."
    },
    {
      id: "unsupported_short_link_preserved",
      provider: "unsupported",
      inputUrl: "https://b23.tv/abc?t=90",
      jumpTimestamp: "01:30",
      expectedExtractedTimestamp: "",
      expectedStrippedUrl: "https://b23.tv/abc?t=90",
      expectedJumpUrl: "https://b23.tv/abc?t=90",
      expectation: "b23.tv is intentionally unsupported until redirect resolution exists."
    },
    {
      id: "non_video_t_preserved",
      provider: "non-video",
      inputUrl: "https://example.com/video?t=1m30s",
      jumpTimestamp: "01:30",
      expectedExtractedTimestamp: "",
      expectedStrippedUrl: "https://example.com/video?t=1m30s",
      expectedJumpUrl: "https://example.com/video?t=1m30s",
      expectation: "A t query parameter on an unknown host is not interpreted as media time."
    }
  ];
  const cases = caseSpecs.map((spec) => {
    const actualExtractedTimestamp = extractSourceTimestamp(spec.inputUrl);
    const actualStrippedUrl = stripSourceTimestamp(spec.inputUrl);
    const actualJumpUrl = buildSourceJumpUrl(actualStrippedUrl, spec.jumpTimestamp);
    const checks = {
      extractedTimestamp: actualExtractedTimestamp === spec.expectedExtractedTimestamp,
      strippedUrl: actualStrippedUrl === spec.expectedStrippedUrl,
      jumpUrl: actualJumpUrl === spec.expectedJumpUrl
    };
    return {
      ...spec,
      actualExtractedTimestamp,
      actualStrippedUrl,
      actualJumpUrl,
      checks,
      ok: Object.values(checks).every(Boolean)
    };
  });
  const passed = cases.filter((item) => item.ok).length;
  return {
    schema: "learning-companion.source-time-links-receipt.v1",
    generatedAt: options.generatedAt || new Date().toISOString(),
    evidence: getEvidenceTierForPath(SOURCE_TIME_LINKS_RECEIPT_FILE),
    scope: "local-parser-fixture",
    liveSiteVerified: false,
    providers: ["youtube", "bilibili", "vimeo"],
    unsupportedHosts: ["b23.tv"],
    functionsExercised: [
      "extractSourceTimestamp",
      "stripSourceTimestamp",
      "buildSourceJumpUrl"
    ],
    precedence: {
      youtubeTimeParameterOrder: ["t", "start", "time_continue"],
      explicitEditorTimestampOverridesExtractedTimestampOnJump: true,
      unknownHostsPreserveOriginalUrl: true
    },
    summary: {
      ok: passed === cases.length,
      cases: cases.length,
      passed,
      providersCovered: 3,
      unsupportedPreserved: cases.find((item) => item.id === "unsupported_short_link_preserved")?.ok === true,
      liveSiteVerified: false
    },
    cases
  };
}

function formatCount(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildStageMarkdown({
  mirrorBundle,
  feishuUploadReport,
  captureResumeReceipt,
  sourceTimeLinksReceipt,
  patchIntakeNegativeReceipt,
  mirrorIntegrityReport,
  adversarialGateReport,
  deferredGates,
  determinismReport,
  harmonyReaderView,
  harmonyScaffoldReport,
  unsupportedInboxPatchRejected,
  macManualQaStatus,
  windowsStaticQaStatus
}) {
  const macQaGate = macManualQaStatus.nt === macManualQaStatus.total
    ? `NOT_RUN(0/${macManualQaStatus.total})`
    : `PARTIAL(${macManualQaStatus.filled}/${macManualQaStatus.total})`;
  const windowsQaGate = windowsStaticQaStatus.nt === windowsStaticQaStatus.total
    ? `RECEIPT_ONLY NOT_RUN(0/${windowsStaticQaStatus.total})`
    : `PARTIAL(${windowsStaticQaStatus.filled}/${windowsStaticQaStatus.total})`;
  const openQuestionLabel = formatCount(harmonyReaderView.workspace.openQuestionCount, "open question");
  const parkedQuestionLabel = formatCount(harmonyReaderView.workspace.parkedQuestionCount || 0, "parked question");
  const unresolvedQuestionLabel = formatCount(harmonyReaderView.workspace.unresolvedQuestionCount || harmonyReaderView.workspace.openQuestionCount, "unresolved question");
  return [
    "# Learning Companion Stage Matrix",
    "",
    buildEvidenceBadgeMarkdown(STAGE_FILE).trim(),
    "",
    "This file is the morning pack's stage label. Any single artifact in this folder should be read through this matrix.",
    "",
    "| Area | Stage | Evidence in this pack | Not proven |",
    "| --- | --- | --- | --- |",
    `| Mac shell | internal-build | Offline pack generated; run \`npm run check:morning:native\` for SwiftPM build and \`npm run check:morning:browser\` for browser smoke; manual QA ${macManualQaStatus.filled}/${macManualQaStatus.total} filled; mirror fingerprint ${mirrorBundle.manifest.bundleFingerprint}. | Signed/notarized app, AppKit panel manual QA. |`,
    `| Feishu | dry-run | Upload report verified ${feishuUploadReport.summary.verifiedFiles} local files; wouldSend is ${feishuUploadReport.wouldSend.status} with ${feishuUploadReport.wouldSend.requestCount} hashed virtual requests and ${feishuUploadReport.targetTree.files.length} target-tree files; ${feishuUploadReport.boundary.statement} | Live Drive write, auth, stale remote cleanup. |`,
    `| Capture to resume | executed-model-loop | ${captureResumeReceipt.roundTrip.addedCaptureCount} captures added through addCapture and visible in Today; Focus Brief next action: ${captureResumeReceipt.roundTrip.focusBriefNextAction}; draft over due review: ${captureResumeReceipt.draftFocus.cases.dueReviewBeatsFreshDraft.shouldOverride}. | Native selected-text GUI permissions, real browser selection. |`,
    `| Source time links | executed-local-parser | ${sourceTimeLinksReceipt.summary.passed}/${sourceTimeLinksReceipt.summary.cases} provider/edge cases for ${sourceTimeLinksReceipt.providers.join(", ")}; unsupported hosts preserved: ${sourceTimeLinksReceipt.summary.unsupportedPreserved}. | Live video-site playback QA is not proven. |`,
    `| Patch intake negatives | executed-negative-fixture | ${patchIntakeNegativeReceipt.summary.expectedFailuresObserved}/${patchIntakeNegativeReceipt.summary.cases} malformed/oversized/duplicate/stale patch cases observed expected failures. | Real off-Mac patch origination. |`,
    `| Mirror integrity | executed-static-check | ${mirrorIntegrityReport.summary.internalLinks} internal links checked; ${mirrorIntegrityReport.summary.brokenLinks} broken links. | Windows manual browser/file roundtrip. |`,
    `| Gate adversarial checks | executed-negative-fixture | ${adversarialGateReport.summary.passed}/${adversarialGateReport.summary.checks} negative fixtures proved expected failures. | Broader corruption matrix. |`,
    `| Deferred gates | pending-user-gate | ${deferredGates.summary.pending}/${deferredGates.summary.total} approval/device/signing gates are explicitly tracked in \`${DEFERRED_GATES_FILE}\`. | Completion evidence for those gates. |`,
    `| Morning determinism | ${determinismReport ? "executed-byte-compare" : "SKIPPED(child-run)"} | ${determinismReport ? `${determinismReport.summary.comparedFiles} files compared across two isolated runs; ${determinismReport.summary.differences} differences.` : "Skipped inside determinism child run."} | Runtime environment outside this repo. |`,
    `| HarmonyOS | schema-prototype + scaffold | Reader view has ${harmonyReaderView.topics.length} topics, ${harmonyReaderView.dueReview.length} due cards, ${openQuestionLabel}, ${parkedQuestionLabel}, and ${unresolvedQuestionLabel}; DevEco scaffold report checks ${harmonyScaffoldReport.fileCount} files. | SDK compile, real device import, storage, export, or UX. |`,
    `| Windows | portable-fixture + pending receipt | Static mirror HTML/Markdown/JSON files are generated; RECEIPT_ONLY manual receipt ${windowsStaticQaStatus.filled}/${windowsStaticQaStatus.total} filled. | Manual Windows browser/file roundtrip. |`,
    `| Patch intake | Mac-import-verified fixture | Inbox duplicate handling, review conflict handling, and unsupported inbox patch rejection: ${unsupportedInboxPatchRejected ? "covered" : "missing"}. | Off-Mac generated patch imported on Mac. |`,
    "",
    "## Named Gates",
    "",
    "| Gate | Status | Evidence / next action |",
    "| --- | --- | --- |",
    `| mac_manual_qa | ${macQaGate} | Fill \`${MAC_MANUAL_QA_FILE}\` during real dogfood. |`,
    `| windows_static_qa | ${windowsQaGate} | Fill \`${WINDOWS_STATIC_QA_FILE}\` during a real Windows browser/manual return pass. |`,
    ...deferredGates.gates.map((gate) => `| ${gate.id} | ${gate.status} | ${gate.nextEvidence} |`),
    "| mac_native_build | SEPARATE_NATIVE_GATE | Run `npm run check:morning:native`; SwiftPM may require toolchain/cache access outside restricted sandboxes. |",
    "| local_browser_smoke | SEPARATE_BROWSER_GATE | Run `npm run check:morning:browser` in a shell that can bind `127.0.0.1`; the headline `check:morning` gate is offline. |",
    `| patch_intake_fixture | ${unsupportedInboxPatchRejected && patchIntakeNegativeReceipt.summary.ok ? "PASS" : "NEEDS_FIX"} | Browser smoke and generator cover duplicate/conflict/unsupported/malformed/oversized fixture paths. |`,
    "",
    "Use wording: fixture, dry-run, schema-prototype, internal-build. Do not call this pack live sync, device-ready, or production Mac packaging.",
    ""
  ].join("\n");
}

function buildDeferredGatesManifest(options = {}) {
  const gates = [
    {
      id: "feishu_live_write",
      status: "deferred_no_approval",
      owner: "Tony/Hermes",
      reason: "Needs explicit Feishu credentials, remote folder target, and approval for live Drive writes.",
      nextEvidence: "Run credentialed Feishu upload against a test folder, record remote file ids/counts, and verify stale cleanup behavior.",
      approvalRequired: true
    },
    {
      id: "harmony_device_roundtrip",
      status: "deferred_no_approval",
      owner: "Tony",
      reason: "Needs a real HarmonyOS device or DevEco run outside the credential-free schema prototype.",
      nextEvidence: "Import a generated mirror bundle on device, add a phone capture, export a patch, and import that patch on Mac.",
      approvalRequired: true
    },
    {
      id: "windows_manual_roundtrip",
      status: "deferred_no_approval",
      owner: "Tony",
      reason: "Needs the home Windows machine for static mirror inspection and patch-file roundtrip.",
      nextEvidence: "Open mirror-folder on Windows, create inbox/review patches, and confirm Mac import receipts.",
      approvalRequired: true
    },
    {
      id: "mac_signed_packaging",
      status: "deferred_no_approval",
      owner: "Tony/Codex",
      reason: "Needs signing/notarization choices and local keychain access; current app is an internal build.",
      nextEvidence: "Build signed app artifact, verify launch/quarantine behavior, and record notarization or explicit unsigned distribution decision.",
      approvalRequired: true
    },
    {
      id: "mac_gui_selected_text",
      status: "deferred_no_approval",
      owner: "Tony",
      reason: "Needs macOS Accessibility/Automation prompts and real frontmost browser/document selection.",
      nextEvidence: "Run MAC_MANUAL_QA selected-text rows, record PASS/FAIL/BLOCKED, and capture permission prompt outcomes.",
      approvalRequired: true
    }
  ];
  return {
    schema: "learning-companion.deferred-gates.v1",
    generatedAt: options.generatedAt || new Date().toISOString(),
    evidence: getEvidenceTierForPath(DEFERRED_GATES_FILE),
    summary: {
      total: gates.length,
      pending: gates.filter((gate) => gate.status === "deferred_no_approval").length,
      status: "not_live_ready",
      note: "These gates are intentionally not executed in the offline morning pack; they prevent green local checks from implying live cross-end readiness."
    },
    gates
  };
}

function summarizeManualQa(markdown) {
  const results = markdown
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.includes("| ---") && !line.includes("| Area |"))
    .map((line) => line.split("|").map((part) => part.trim())[4] || "");
  const count = (value) => results.filter((result) => result === value).length;
  const nt = count("NT");
  return {
    total: results.length,
    filled: results.length - nt,
    pass: count("PASS"),
    fail: count("FAIL"),
    blocked: count("BLOCKED"),
    nt
  };
}

function buildManualQaReceiptSummary({
  file,
  evidenceTier,
  evidenceStatus,
  receiptOnly,
  status
}) {
  return {
    file,
    evidenceTier,
    evidenceStatus,
    receiptOnly,
    total: status.total,
    filled: status.filled,
    pass: status.pass,
    fail: status.fail,
    blocked: status.blocked,
    nt: status.nt
  };
}

function buildMacManualQaMarkdown({
  sampleMirrorZipFile,
  feishuUploadReport
}) {
  return [
    "# Learning Companion Mac Manual QA Receipt",
    "",
    buildEvidenceBadgeMarkdown(MAC_MANUAL_QA_FILE).trim(),
    "",
    "Stage: internal-build manual QA. This receipt does not prove signed packaging, notarization, or live Feishu/HarmonyOS behavior.",
    "",
    "Fill this in during the morning review. Use `PASS`, `FAIL`, `BLOCKED`, or `NT` in the Result column.",
    "",
    "## Preconditions",
    "",
    "- Run `npm run check:morning` from the repository root for the offline headline gate.",
    "- Run `npm run check:morning:native` separately when SwiftPM toolchain/cache access is allowed.",
    "- Run `npm run check:morning:browser` separately when local browser port binding is allowed.",
    "- Launch the shell with `swift run --package-path apps/companion-mac LearningCompanionMac apps/companion-web`.",
    "- Import `dist/morning-demo/sample-workspace.json` into the app.",
    "- Keep `dist/morning-demo/review-start-here.html` open for artifact links.",
    "- Do not enter Feishu credentials; Feishu evidence here is dry-run only.",
    "",
    "## Test Matrix",
    "",
    "| Area | Steps | Expected | Result | Notes |",
    "| --- | --- | --- | --- | --- |",
    "| Launch | Open the Mac shell from the command above. | App loads the local workspace UI without falling back to `127.0.0.1`. | NT |  |",
    "| Morning pack shortcut | Use `File > Open Morning Review Pack`. | Default browser opens `dist/morning-demo/review-start-here.html`; missing pack shows an alert. | NT |  |",
    "| Sidecar | Use `Window > Enter Sidecar Window`, then `Window > Restore Desk Window`. | Native window narrows/restores and web layout follows. | NT |  |",
    "| Sidecar focus rail | Enter sidecar layout beside a browser source, then inspect the activity strip before clicking anything. | The metric row is hidden, the sidecar-only rail shows `Source`, `Capture`, and `Loop`, and a clear loop says `Today` before exiting sidecar layout. | NT |  |",
    "| Floating | Toggle `Window > Keep Window Above Others` while a browser is frontmost. | Window level changes only when manually toggled. | NT |  |",
    "| Clipboard capture | Copy text in any app, then use `Capture > Save Clipboard as Capture`. | Capture appears in the active topic with `clipboard` source. | NT |  |",
    "| Quick Capture draft persistence | Type a quote, thought, and time in Quick Capture without saving; switch to another session and return. Then change the source title or URL before saving that draft, and use `Use current` if the draft should follow the new source. | Draft text and time are restored, and the capture surface shows a local draft status; if the current source no longer matches the draft's local source snapshot, the status changes to `Source changed`, while `Use current` clears that warning by re-anchoring the local draft. | NT |  |",
    "| Keyboard quick capture | From Today, Review, or Export, press the app-focused Quick Capture shortcut. Repeat once with a quote-only draft. | The app returns to Quick Capture without leaving sidecar layout; empty capture focuses Quote, quote-only draft focuses Thought, and the activity strip reports the correct capture/draft state. | NT |  |",
    "| Source time staging | Paste a supported video URL that contains a timestamp into the source URL field, then use `-15`, `+15`, ArrowDown, and ArrowUp while Time is focused. | The Time field is filled and pulsed, Quick Capture shows the source/time context, the context Open button includes that time, mouse and keyboard nudges adjust the context time, the activity strip reports `Source time staged` or `Time adjusted`, and the stored source URL no longer includes only the time parameter. | NT |  |",
    "| Paste Source setup | Copy a browser URL that contains a video timestamp, then click the URL-field Paste Source button in the app. Repeat with a non-URL clipboard value and with a typed topic that already has a capture. | The app fills a safe source URL, derives or keeps an editable source title, infers Video when safe, syncs Time from the URL, focuses Quick Capture, non-URL clipboard text is discarded with a manual-entry prompt, and existing typed topics are not silently reclassified after captures exist. | NT |  |",
    "| Today draft resume | Leave a non-empty Quick Capture draft, open Today, then use the draft Resume action. | Today shows a device-local/not-exported draft card and Resume returns focus to Quick Capture. | NT |  |",
    "| First-run First Note | Open the app with an empty workspace or fresh browser profile. Repeat once after linking a source. Use both Capture this thought and Ask about this. | Today shows Learning Flow with a compact First Note row; no-source state offers Set source first, linked-source state offers Capture this thought, Ask about this, and Set up page clipper without repeating Open source. Capture this thought focuses the Thought field. Ask about this stages a `Question:` draft, keeps focus in Thought, and reports source-aware feedback: linked-source questions are ready in Quick Capture for that source, while no-source questions ask you to link a source later to anchor them. | NT |  |",
    "| Today section map | In Today with the sample workspace imported, click the Due, Questions, Parked, Answers, Closed, and Recent chips. | Each chip jumps to the matching section without horizontal overflow at sidecar/mobile widths. | NT |  |",
    "| Focus Brief draft precedence | In a workspace with both a due review and a fresh Quick Capture draft, open Focus Brief. | Due review stays the primary next action; the draft remains recoverable from Today instead of being treated as synced/exported data. | NT |  |",
    "| Focus Brief question signal | In a topic with an open question and due review or synthesis, click the Focus Brief open-question signal. | The primary Focus Brief action stays Review or Build, while the signal opens Today at Open Questions and exits sidecar layout if needed. | NT |  |",
    "| Open question handoff | After importing `dist/morning-demo/sample-workspace.json`, open Today and the mirror home. | The Rust traits question appears in Today Open Questions and in `mirror-folder/index.html` as an Open Question Preview. | NT |  |",
    "| Question close loop | In Today, use the open question's Park, Answer, Make card, then Resolve and Reopen on a question capture. | Park moves it to Parked Questions without resolving; Answer starts an `Answer:` Quick Capture draft in the source topic; Make card creates a review card in that topic; Resolve removes it from Open Questions; Reopen restores it. | NT |  |",
    "| Source timestamp jump | Enter a current Time value on a session with a video source, then open the source. | Browser target includes the current timestamp when the source supports timestamp jumps. | NT |  |",
    "| Selected text capture | Select text in Safari/Chrome/docs, then use `Capture > Save Selected Text as Capture`. | If Accessibility exposes `AXSelectedText`, selected text is captured without overwriting pasteboard. | NT |  |",
    "| Clipboard fallback guard | Trigger selected-text capture with no exposed selection and unchanged clipboard. | App does not import stale clipboard; status explains no selection/new clipboard. | NT |  |",
    "| Browser context | Capture selected/clipboard text while Safari or Chrome is frontmost on an HTTP(S) page. | Capture can attach page title and URL, or degrades to text-only if Automation is denied. | NT |  |",
    "| Native import success | Import `dist/morning-demo/patches/sample-mobile-inbox-patch.json` via `File > Import Workspace...`. | Return Files/receipt shows imported inbox patch without overwriting notes/cards. | NT |  |",
    "| Native import failure | Import a malformed JSON file via `File > Import Workspace...`. | Alert and in-app issue receipt explain the import failure. | NT |  |",
    "| Export backup | After adding a capture, confirm the storage notice appears; then use `File > Export Workspace...`. | Notice asks for export before backup and then asks you to verify the exported JSON file yourself. | NT |  |",
    "| Relaunch persistence | Quit and relaunch the shell. | Workspace persists through WebKit localStorage. | NT |  |",
    `| Mirror inspection | Open \`dist/morning-demo/mirror-folder/index.html\` and \`${sampleMirrorZipFile}\`. | Static mirror is readable; ZIP extracts to the same conceptual folder. | NT |  |`,
    `| Feishu dry-run artifact | Inspect \`dist/morning-demo/feishu-upload/feishu-upload-report.json\`. | Boundary says: ${feishuUploadReport.boundary.statement}; wouldSend is ${feishuUploadReport.wouldSend.status} with ${feishuUploadReport.wouldSend.requestCount} hashed virtual requests. | NT |  |`,
    "",
    "## Notes",
    "",
    "- Permission prompts are expected for Accessibility or browser Automation. If a prompt appears, record it instead of treating it as a product failure.",
    "- If a step needs a user approval tonight, mark `BLOCKED` and continue with the rest.",
    `- Real Windows static mirror runs belong in \`${WINDOWS_STATIC_QA_FILE}\`; real HarmonyOS runs still belong in a later device roundtrip receipt.`,
    ""
  ].join("\n");
}

function buildStaticReturnContractMarkdown() {
  return [
    "# Static Return Contract",
    "",
    buildEvidenceBadgeMarkdown(STATIC_RETURN_CONTRACT_FILE).trim(),
    "",
    "This note explains what `npm run check:static-return` proves and what it deliberately does not prove.",
    "",
    "Positive scope: it proves the generated static Review/Inbox HTML matches the declared local return contract, and that verifier-generated review/inbox return payloads import through the real Mac model functions as fixtures.",
    "",
    "## Run It",
    "",
    "```bash",
    "npm run check:static-return",
    "```",
    "",
    "The verifier reads the generated morning mirror files from `dist/morning-demo/mirror-folder/` and writes its receipt under the project-local ignored `.codex-tmp/static-return-loop-check/` directory. It does not write to Downloads.",
    "",
    "## Proven By The Local Contract",
    "",
    "- `index.html`, `review.html`, and `inbox.html` exist in the generated mirror folder.",
    "- Review and Inbox links are relative local-file links.",
    "- Static Review/Inbox pages expose Manual Copy and Return Files instructions.",
    "- Static Review/Inbox post-save follow-up links preserve the other exported lane in mixed due-review/open-question mirrors, using relative hrefs only.",
    "- Static pages do not reference external scripts, styles, fetch/XHR/import/service worker, WebSocket/EventSource/sendBeacon, BroadcastChannel, iframe, or inline event-handler paths.",
    "- Embedded seed fingerprints match `sample-workspace.json`.",
    "- Generated review and inbox return payloads import through the real Mac model functions as fixture payloads.",
    "- Unsafe inbox URL inputs are stripped in the verifier matrix.",
    "",
    "## Not Proven",
    "",
    "- It does not prove a real user-created return file.",
    "- It does not prove browser-executed `file://` behavior on macOS, Windows, or HarmonyOS.",
    "- It does not prove native file pickers, Downloads immutability, Feishu sync, or a phone-device roundtrip.",
    "- It does not replace `MAC_MANUAL_QA.md`, `WINDOWS_STATIC_QA.md`, or the HarmonyOS DevEco/device gates.",
    "",
    "## Evidence Label",
    "",
    "The expected verifier receipt tier is `STATIC_CONTRACT_PLUS_FIXTURE_MODEL_IMPORT`. Treat that as stronger than a static link check, but weaker than a real manual return-file pass.",
    ""
  ].join("\n");
}

function buildWindowsStaticQaMarkdown({
  sampleMirrorZipFile
}) {
  return [
    "# Learning Companion Windows Static QA Receipt",
    "",
    buildEvidenceBadgeMarkdown(WINDOWS_STATIC_QA_FILE).trim(),
    "",
    "Stage: portable-fixture manual QA. PENDING RECEIPT, not QA evidence: this file is not evidence until a real Windows browser run fills the Result column.",
    "",
    "Use this during a Windows Edge/Chrome static mirror pass. Use `PASS`, `FAIL`, `BLOCKED`, or `NT` in the Result column.",
    "",
    "## Preconditions",
    "",
    "- Run `npm run demo:morning` from the repository root.",
    `- Transfer or extract \`dist/morning-demo/${sampleMirrorZipFile}\`, or copy \`dist/morning-demo/mirror-folder/\`, onto the Windows machine.`,
    "- Open `mirror-folder/index.html` from local disk in Edge or Chrome.",
    "- Do not sign in to Feishu or claim live sync; this is local file transport only.",
    "- Do not mark this receipt complete while every Result row is still `NT`.",
    "- Keep the returned JSON files in a temporary folder until they are imported on Mac, then archive or delete them deliberately.",
    "",
    "## Test Matrix",
    "",
    "| Area | Steps | Expected | Result | Notes |",
    "| --- | --- | --- | --- | --- |",
    "| Launch mirror home | Open `mirror-folder/index.html` from the extracted folder. | Page loads from local disk, shows the Manual Return checklist and the `Return-ready mirror` badge, and does not require network access. | NT |  |",
    "| Read Today | Open the Today link from the mirror home, then open `TODAY.md` directly from the folder. | Resume Here, due review, open questions, parked questions, and recent captures are readable without the Mac app. | NT |  |",
    "| Pre-return fingerprint check | Before saving the return file, inspect the Review/Inbox JSON preview or copied text for `source.returnBaseFingerprint`. | The value is present before Windows work is moved back to Mac; if it is missing, record legacy compatibility and re-export before the next Windows pass. | NT |  |",
    "| Review return file | Open `mirror-folder/review.html`, reveal a due card, mark Good, then use Copy, Manual Copy, or Save Return File. | The page shows the `Return-ready mirror` badge, suggests a timestamped filename, and the JSON uses `learning-companion.review-progress-patch.v1` with `source.returnBaseFingerprint`. | NT |  |",
    "| Inbox return file | Open `mirror-folder/inbox.html`, add a quote and thought, then use Copy, Manual Copy, or Save Return File. | The page suggests one stable timestamped filename for that draft, and the JSON uses `learning-companion.mobile-inbox-patch.v1` with `source.returnBaseFingerprint`. | NT |  |",
    "| Unsaved leave warning | Make an unsaved review or inbox change, then close the tab or navigate away. | Browser warns before leaving local unsaved work. | NT |  |",
    "| Manual transfer back | Move the review and inbox return files back to Mac, then import them with Return Files. | Mac shows `Return files imported`, new captures or review updates rejoin Learning Flow, and the receipt names stale/legacy mirror checks if applicable. | NT |  |",
    "| Batch partial-import guard | Import one valid Windows return file together with one wrong file such as `sample-workspace.json` through Return Files. | Mac imports only the valid append-only return, reports the wrong file as failed or unsupported, and does not overwrite the workspace. | NT |  |",
    "| Wrong file guard | Try importing `sample-workspace.json` or `sample-feishu-mirror.json` through Return Files after the Windows pass. | Mac reports an unsupported or failed return file without overwriting the workspace. | NT |  |",
    "| Static boundary | If available, repeat the launch while offline or inspect network activity in the browser. | Local mirror pages remain readable; no row treats Feishu Drive as live sync. | NT |  |",
    "",
    "## Notes",
    "",
    "- `BLOCKED` is the right result when Windows browser policy prevents local file access, clipboard, downloads, or return-file transfer.",
    "- A passing Windows static pass proves only the local mirror/manual return loop. It does not prove Feishu live write, HarmonyOS behavior, or Mac signing.",
    "- If a return file lacks `source.returnBaseFingerprint`, record it as legacy compatibility and re-export the mirror before the next Windows pass.",
    ""
  ].join("\n");
}

function buildDemoScriptMarkdown({
  captureResumeReceipt,
  sourceTimeLinksReceipt,
  deferredGates,
  harmonyScaffoldReport,
  mirrorIntegrityReport,
  sampleMirrorZipFile
}) {
  return [
    "# Learning Companion 60-Second Review Script",
    "",
    buildEvidenceBadgeMarkdown(DEMO_SCRIPT_FILE).trim(),
    "",
    "Use this to review only the surfaces this pack actually proves. It is a route through the demo, not a claim that deferred gates are complete.",
    "",
    "## 0-10s: Open The Evidence Pack",
    "",
    "- Open `review-start-here.html`.",
    "- Read `STAGE.md` and `DEFERRED_GATES.json` first; there are no live Feishu, HarmonyOS device, Windows, signing, or completed Mac GUI claims here.",
    `- Deferred gates pending: ${deferredGates.summary.pending}/${deferredGates.summary.total}.`,
    "",
    "## 10-25s: Check Resume Value",
    "",
    "- Open `mirror-folder/index.html` and `mirror-folder/TODAY.md`.",
    "- Confirm Resume Here shows the next action, source, latest capture, and the reason behind the recommendation.",
    `- Model receipt: \`CAPTURE_RESUME_RECEIPT.json\` shows ${captureResumeReceipt.roundTrip.addedCaptureCount} captures, Focus Brief \`${captureResumeReceipt.roundTrip.focusBriefNextAction}\`, and due review blocking draft override: ${captureResumeReceipt.draftFocus.cases.dueReviewBeatsFreshDraft.blockedByReview}.`,
    `- Source time receipt: \`${SOURCE_TIME_LINKS_RECEIPT_FILE}\` shows ${sourceTimeLinksReceipt.summary.passed}/${sourceTimeLinksReceipt.summary.cases} local parser/jump cases for ${sourceTimeLinksReceipt.providers.join(", ")}; live video-site playback QA is not proven.`,
    "",
    "## 25-40s: Check Cross-End Boundaries",
    "",
    `- Open \`mirror-folder/review.html\` and \`mirror-folder/inbox.html\`; they are static patch exporters for phone/Windows/manual transport.`,
    `- Read \`${STATIC_RETURN_CONTRACT_FILE}\`, then run \`npm run check:static-return\` when you want the local static return contract receipt without touching Downloads.`,
    `- Open \`${WINDOWS_STATIC_QA_FILE}\` before claiming Windows usability; it is the pending receipt for local browser launch, Review/Inbox return files, and Mac Return Files import.`,
    `- Open \`${sampleMirrorZipFile}\` or \`sample-feishu-mirror.json\`; mirror integrity checked ${mirrorIntegrityReport.summary.internalLinks} internal links with ${mirrorIntegrityReport.summary.brokenLinks} broken.`,
    `- Open \`HARMONY_SCAFFOLD_REPORT.json\`; it checks ${harmonyScaffoldReport.fileCount} scaffold files, not an SDK compile.`,
    "",
    "## 40-55s: Check Local Data Honesty",
    "",
    "- In the app, add a real capture, confirm the local storage notice appears, then export workspace and verify the exported JSON file yourself.",
    `- Use \`MAC_MANUAL_QA.md\` and \`${WINDOWS_STATIC_QA_FILE}\` for manual rows; leave anything approval/device-bound as \`NT\` or \`BLOCKED\` rather than treating it as passed.`,
    "",
    "## 55-60s: Decide The Next Gate",
    "",
    "- If the sidecar capture loop feels right, the next honest gates are `npm run check:morning:browser`, `npm run check:morning:native`, and one real Mac GUI dogfood pass.",
    "- Do not treat dry-run Feishu files, Harmony scaffold shape, static-return fixture imports, or static Windows mirror files as live cross-end completion.",
    ""
  ].join("\n");
}

function buildMorningReviewMarkdown({
  mirrorBundle,
  mirrorZip,
  sampleMirrorZipFile,
  feishuUploadPlan,
  feishuUploadResult,
  feishuUploadReport,
  captureResumeReceipt,
  sourceTimeLinksReceipt,
  patchIntakeNegativeReceipt,
  mirrorIntegrityReport,
  adversarialGateReport,
  deferredGates,
  determinismReport,
  harmonyReaderView,
  harmonyScaffoldReport,
  windowsStaticQaStatus,
  inboxReceipt,
  duplicateInboxReceipt,
  reviewReceipt,
  reviewConflictReceipt,
  unsupportedInboxPatchRejected
}) {
  const openQuestionLabel = formatCount(harmonyReaderView.workspace.openQuestionCount, "open question");
  const parkedQuestionLabel = formatCount(harmonyReaderView.workspace.parkedQuestionCount || 0, "parked question");
  const unresolvedQuestionLabel = formatCount(harmonyReaderView.workspace.unresolvedQuestionCount || harmonyReaderView.workspace.openQuestionCount, "unresolved question");
  return [
    "# Learning Companion Morning Review",
    "",
    buildEvidenceBadgeMarkdown("MORNING_REVIEW.md").trim(),
    "",
    "> FIXTURE ONLY: this pack is generated sample data. It does not prove live Feishu sync, real HarmonyOS device behavior, or signed Mac packaging.",
    "> FRESHNESS: offline and native gates were rerun against HEAD; latest Today draft-resume UI assertions are receipt + syntax checked and still need the separate local browser smoke gate.",
    "",
    "This pack is generated from a representative local workspace. It is credential-free and safe to inspect without Feishu or HarmonyOS setup.",
    "",
    "## Start Here",
    "",
    "0. Open `dist/morning-demo/review-start-here.html` for a clickable review dashboard.",
    "0a. Read `dist/morning-demo/STAGE.md` before interpreting any artifact as a capability claim.",
    "0b. Use `dist/morning-demo/MAC_MANUAL_QA.md` to record Mac GUI dogfood results.",
    `0c. Use \`dist/morning-demo/${WINDOWS_STATIC_QA_FILE}\` to record the Windows static mirror and Return Files loop; current rows filled: ${windowsStaticQaStatus.filled}/${windowsStaticQaStatus.total}.`,
    "0d. Use `dist/morning-demo/HARMONY_DEVECO_HANDOFF.md` as the phone-app scaffold contract.",
    "0e. Read `dist/morning-demo/DEFERRED_GATES.json` so green local checks are not mistaken for live readiness.",
    "0f. Read `dist/morning-demo/CAPTURE_RESUME_RECEIPT.json` if you want the exact model evidence that due review blocks a fresh Quick Capture draft from owning the Focus Brief.",
    `0g. Read \`dist/morning-demo/${SOURCE_TIME_LINKS_RECEIPT_FILE}\` for the local source-time parser evidence; it does not prove real video-site playback.`,
    `0h. Read \`dist/morning-demo/${STATIC_RETURN_CONTRACT_FILE}\`, then run \`npm run check:static-return\` if you need the local static return contract receipt.`,
    "0i. Check the first-run `First Note` row in `dist/morning-demo/MAC_MANUAL_QA.md`; it is a manual UI gate, not a generator proof.",
    "0j. Check the Today section map row in `dist/morning-demo/MAC_MANUAL_QA.md`; it should make the denser Today cockpit navigable on sidecar/mobile widths.",
    "1. Run `npm run check:morning` from the repo root for the offline headline gate.",
    "1a. Run `npm run check:morning:native` separately if SwiftPM toolchain/cache access is allowed.",
    "1b. Run `npm run check:morning:browser` separately if local browser port binding is allowed.",
    "1c. Run `npm run check:static-return` separately for the static return contract; it writes receipts under `.codex-tmp/`, not Downloads.",
    "2. Run `npm run dev` and open `http://127.0.0.1:5173`.",
    "3. Import `dist/morning-demo/sample-workspace.json` in the app.",
    "4. Open the Export tab and compare it with `dist/morning-demo/mirror-folder/index.html`.",
    "5. Open `dist/morning-demo/mirror-folder/review.html`, reveal a card, mark Good, and save/copy the progress patch.",
    "6. Open `dist/morning-demo/mirror-folder/inbox.html`, add a capture, and save/copy the inbox patch.",
    "7. Import the sample patches from `dist/morning-demo/patches/` to see the Mac-side receipts.",
    "",
    "## Generated Artifacts",
    "",
    `- 60-second review script: \`${DEMO_SCRIPT_FILE}\` (bounded path through verified surfaces and deferred gates)`,
    `- Sample mirror JSON: \`${SAMPLE_MIRROR_JSON_FILE}\` (${mirrorBundle.manifest.fileCount} files)`,
    `- Sample mirror ZIP: \`${sampleMirrorZipFile}\` (${mirrorZip.fileCount} files, ${mirrorZip.bytes} bytes)`,
    "- Extracted folder: `mirror-folder/`",
    `- Stage matrix: \`${STAGE_FILE}\` (fixture/dry-run/prototype/internal labels)`,
    `- Evidence tiers: \`${EVIDENCE_TIERS_FILE}\` (machine-readable claim labels for generated artifacts)`,
    `- Deferred gates: \`${DEFERRED_GATES_FILE}\` (${deferredGates.summary.pending} approval/device/signing gates still pending)`,
    `- Mac manual QA receipt: \`${MAC_MANUAL_QA_FILE}\` (fill during dogfood review)`,
    `- Windows static QA receipt: \`${WINDOWS_STATIC_QA_FILE}\` (fill during real Windows folder/review/inbox/Return Files pass; ${windowsStaticQaStatus.filled}/${windowsStaticQaStatus.total} rows filled now)`,
    `- Static return contract: \`${STATIC_RETURN_CONTRACT_FILE}\` (explains the \`npm run check:static-return\` verifier and its evidence boundary)`,
    `- HarmonyOS DevEco handoff: \`${HARMONY_DEVECO_HANDOFF_FILE}\` (ArkTS scaffold contract, import file guard, reader session handoff, and device gates)`,
    `- HarmonyOS scaffold report: \`${HARMONY_SCAFFOLD_REPORT_FILE}\` (${harmonyScaffoldReport.fileCount} scaffold files checked, including reader session/page wiring; no SDK compile claimed)`,
    `- Feishu upload plan: \`feishu-upload/feishu-upload-plan.json\` (${feishuUploadPlan.files.length} planned local upserts, no live API)`,
    `- Feishu dry-run report: \`feishu-upload/feishu-upload-report.json\` (${feishuUploadReport.summary.verifiedFiles} verified local files; ${feishuUploadReport.wouldSend.requestCount} hashed wouldSend requests, ${feishuUploadReport.targetTree.files.length} target-tree files, not sent)`,
    `- Capture resume receipt: \`${CAPTURE_RESUME_RECEIPT_FILE}\` (${captureResumeReceipt.roundTrip.addedCaptureCount} captures visible in Today; Focus Brief next action ${captureResumeReceipt.roundTrip.focusBriefNextAction}; draft-vs-review arbiter checked)`,
    `- Source time links receipt: \`${SOURCE_TIME_LINKS_RECEIPT_FILE}\` (${sourceTimeLinksReceipt.summary.passed}/${sourceTimeLinksReceipt.summary.cases} local parser/jump cases for ${sourceTimeLinksReceipt.providers.join(", ")}; live video-site playback QA is not proven; live-site verified: ${sourceTimeLinksReceipt.summary.liveSiteVerified})`,
    `- Patch intake negative receipt: \`${PATCH_INTAKE_NEGATIVE_RECEIPT_FILE}\` (${patchIntakeNegativeReceipt.summary.expectedFailuresObserved}/${patchIntakeNegativeReceipt.summary.cases} expected failures observed)`,
    `- Mirror integrity report: \`${MIRROR_INTEGRITY_FILE}\` (${mirrorIntegrityReport.summary.internalLinks} internal links checked, ${mirrorIntegrityReport.summary.brokenLinks} broken)`,
    `- Adversarial gates report: \`${ADVERSARIAL_GATES_FILE}\` (${adversarialGateReport.summary.passed}/${adversarialGateReport.summary.checks} expected failures observed)`,
    `- Deferred gates sample: ${deferredGates.gates.map((gate) => `${gate.id}=${gate.status}`).join(", ")}.`,
    determinismReport ? `- Determinism report: \`${DETERMINISM_FILE}\` (${determinismReport.summary.comparedFiles} files compared across two isolated runs)` : "",
    `- Feishu local files: \`feishu-upload/files/\` (${feishuUploadResult.fileCount} materialized fixture files)`,
    `- HarmonyOS reader view: \`${SAMPLE_HARMONY_READER_FILE}\` (${harmonyReaderView.topics.length} topics, ${openQuestionLabel}, ${parkedQuestionLabel}, ${unresolvedQuestionLabel}, schema prototype)`,
    `- Sample workspace restore: \`${SAMPLE_WORKSPACE_FILE}\``,
    `- Sample phone capture patch: \`patches/${SAMPLE_MOBILE_INBOX_PATCH_FILE}\``,
    `- Sample review progress patch: \`patches/${SAMPLE_REVIEW_PROGRESS_PATCH_FILE}\``,
    "",
    "## What To Judge",
    "",
    "- Sidecar capture: can you capture quote/thought/time/source without losing focus?",
    "- Capture draft recovery: can you type a half-finished thought, switch sessions, and resume it from Today or the Focus Brief without confusing it for synced/exported data?",
    "- Keyboard quick capture: can the app-focused shortcut return to Quick Capture from other tabs while preserving sidecar layout and draft focus?",
    "- Source time staging: does pasting a timestamped video URL make the saved draft time and source-open behavior obvious without stealing focus?",
    "- Source time links: do supported provider links resume to the intended timestamp locally, and is the absence of live playback QA explicit enough?",
    "- Workspace Find: can you find a prior capture or card quickly?",
    "- Today pack: does it tell you what to resume?",
    "- First-run First Note: does an empty workspace offer source setup before capture, and does a linked source offer capture, first-question, and browser-clipper entry points without duplicating Open source?",
    "- Today section map: does the denser cockpit stay skimmable by jumping to due, question, answer, closed, and recent sections?",
    "- Local durability: does the app ask for a workspace export after real learning changes without pretending the browser download is already durable?",
    "- Mirror folder: would this be readable in Feishu Drive or Windows?",
    "- Feishu upload plan: is the one-way folder writer boundary clear enough before real credentials?",
    "- Harmony reader view: does the phone-facing view model contain the right active topic, active open questions, parked questions, review, and capture slices?",
    "- Harmony reader session: does the phone scaffold preserve the accepted reader view after a failed import and keep Index/TopicDetail/ReviewQueue on the same session state?",
    "- Mobile inbox: can phone-side captures return to Mac without overwriting notes/cards?",
    "- Review progress: can phone-side review grades return without overwriting newer Mac state?",
    "",
    "## What Tony Will Not See Working Tonight",
    "",
    "- No live Feishu Drive write; only local dry-run files and hashed wouldSend envelopes are generated.",
    "- No real HarmonyOS device import/export; only the schema reader and DevEco scaffold contract are checked.",
    `- No Windows machine roundtrip; the static mirror is generated/link-checked locally and \`${WINDOWS_STATIC_QA_FILE}\` remains a pending receipt.`,
    "- No signed/notarized Mac package; the shell remains an internal build.",
    "- No completed Mac GUI QA; `MAC_MANUAL_QA.md` rows stay `NT` until a real dogfood pass.",
    "- No executed local browser smoke in this run; `npm run check:morning:browser` remains a separate permissioned gate.",
    "- Live video-site playback QA is not proven; source time links are local parser/jump fixtures only.",
    "- No real static return-file QA is claimed by `npm run check:static-return`; it proves static contract plus fixture model import only.",
    "",
    "## Safety Receipts Verified By Generator",
    "",
    `- Mobile inbox sample: ${inboxReceipt.added} added, ${inboxReceipt.sanitizedSourceUrls} unsafe source link stripped, ${inboxReceipt.answeredQuestions} original question resolved.`,
    `- Duplicate inbox sample: ${duplicateInboxReceipt.added} added after duplicate-patch detection.`,
    `- Review progress sample: ${reviewReceipt.applied} applied, ${reviewReceipt.skippedConflict} stale conflicts.`,
    `- Review progress conflict sample: ${reviewConflictReceipt.applied} applied, ${reviewConflictReceipt.skippedConflict} stale conflict skipped.`,
    `- Feishu upload plan sample: ${feishuUploadPlan.files.length} upserts, auth status ${feishuUploadPlan.provider.auth.status}.`,
    `- Feishu dry-run report sample: ${feishuUploadReport.summary.verifiedFiles} local files verified, ${feishuUploadReport.summary.wouldUpsert} would-upsert actions, ${feishuUploadReport.wouldSend.requestCount} no-network wouldSend envelopes, ${feishuUploadReport.targetTree.files.length} target-tree files; ${feishuUploadReport.boundary.statement}`,
    `- Capture to resume sample: ${captureResumeReceipt.roundTrip.addedCaptureCount} captures added, Today hash changed: ${captureResumeReceipt.roundTrip.todayHashChanged}, all inputs visible in Today: ${captureResumeReceipt.roundTrip.allInputsVisibleInToday}, Focus Brief next action: ${captureResumeReceipt.roundTrip.focusBriefNextAction}, draft-vs-review override allowed: ${captureResumeReceipt.draftFocus.cases.dueReviewBeatsFreshDraft.shouldOverride}.`,
    `- Draft focus precedence sample: due review > fresh draft resume > stale draft > timestamp-only; due review blocks draft override: ${captureResumeReceipt.draftFocus.cases.dueReviewBeatsFreshDraft.blockedByReview}.`,
    `- Source time links sample: ${sourceTimeLinksReceipt.summary.passed}/${sourceTimeLinksReceipt.summary.cases} parser/jump cases passed; providers ${sourceTimeLinksReceipt.providers.join(", ")}; unsupported hosts preserved: ${sourceTimeLinksReceipt.summary.unsupportedPreserved}; live-site verified: ${sourceTimeLinksReceipt.summary.liveSiteVerified}.`,
    `- Patch intake negative sample: ${patchIntakeNegativeReceipt.summary.expectedFailuresObserved}/${patchIntakeNegativeReceipt.summary.cases} expected failures observed; malformed rejected: ${patchIntakeNegativeReceipt.summary.malformedRejected}, oversized rejected: ${patchIntakeNegativeReceipt.summary.oversizedRejected}, duplicate review skipped: ${patchIntakeNegativeReceipt.summary.duplicateReviewSkipped}, stale review conflict skipped: ${patchIntakeNegativeReceipt.summary.staleReviewConflictSkipped}.`,
    `- Mirror integrity sample: ${mirrorIntegrityReport.summary.fileCount} files, ${mirrorIntegrityReport.summary.internalLinks} internal links, ${mirrorIntegrityReport.summary.brokenLinks} broken links.`,
    `- Windows static QA sample: ${windowsStaticQaStatus.filled}/${windowsStaticQaStatus.total} manual rows filled; this is intentionally pending until a real Windows run.`,
    `- Adversarial gate sample: ${adversarialGateReport.checks.map((check) => `${check.name}=${check.expectedFailureObserved}`).join(", ")}.`,
    determinismReport ? `- Morning determinism sample: ${determinismReport.summary.comparedFiles} files compared across two isolated runs, ${determinismReport.summary.differences} differences.` : "",
    `- Harmony reader sample: ${harmonyReaderView.topics.length} topics, ${harmonyReaderView.dueReview.length} due cards, ${openQuestionLabel}, ${parkedQuestionLabel}, ${unresolvedQuestionLabel}.`,
    `- Harmony scaffold sample: ${harmonyScaffoldReport.fileCount} files checked, bundle ${harmonyScaffoldReport.app.bundleName}, pages ${harmonyScaffoldReport.pages.length}; reader session/page wiring is checked without claiming DevEco execution.`,
    "- Dashboard local links were checked for file existence before `SUMMARY.json` was written.",
    "- Credential sweep and output hashes are recorded in `SUMMARY.json`.",
    `- Unsupported mobile inbox patch rejection: ${unsupportedInboxPatchRejected ? "covered" : "missing"}.`,
    "",
    "## What This Does Not Prove",
    "",
    "- This is still manual transport, not real Feishu OpenAPI sync.",
    "- Static return verifier receipts are `STATIC_CONTRACT_PLUS_FIXTURE_MODEL_IMPORT`, not real user-created return-file evidence.",
    "- The Feishu upload plan is local-folder materialization only; it does not authenticate or write to Drive.",
    "- HarmonyOS browser behavior needs a real device roundtrip.",
    "- localStorage is temporary; the app prompts after committed learning data changes or a stale seven-day export, but real file exports are still the user's durability checkpoint.",
    "- Mac shell is still a thin WKWebView wrapper, not a signed production app.",
    `- The sample ZIP has not been opened on Windows or HarmonyOS in this generator; \`${WINDOWS_STATIC_QA_FILE}\` is a fillable receipt, not a pass.`,
    "- Source time links have not been clicked against live YouTube, Bilibili, or Vimeo playback pages in this generator.",
    "",
    "## Current Evidence",
    "",
    "- `npm run smoke` covers model contracts and generated static artifacts.",
    "- `npm run smoke:harmony` covers the read-only HarmonyOS reader view contract plus pure import/patch boundary fixtures.",
    "- When the separate browser gate is allowed, `npm run smoke:browser` covers browser interaction, mirror generation/import, static review/inbox runtime behavior, patch import receipts, duplicate review patch receipts, and visible issue receipts for bad mirror, malformed JSON, and oversized patch imports.",
    "- `npm run check:morning` runs the offline headline gate: web smoke, Harmony reader smoke, capture resume, morning generator, receipt contracts, determinism, and mirror integrity.",
    "- `npm run check:morning:native` runs the Mac SwiftPM build separately because SwiftPM may need toolchain/cache access outside restricted sandboxes.",
    "- `npm run check:morning:browser` runs the local browser UX smoke separately because it binds `127.0.0.1`.",
    "- `npm run check:static-return` runs the static mirror return contract and writes project-local ignored receipts under `.codex-tmp/`.",
    ""
  ].join("\n");
}

function buildReviewStartHereHtml({
  mirrorBundle,
  mirrorZip,
  sampleMirrorZipFile,
  feishuUploadPlan,
  feishuUploadResult,
  feishuUploadReport,
  captureResumeReceipt,
  sourceTimeLinksReceipt,
  patchIntakeNegativeReceipt,
  mirrorIntegrityReport,
  adversarialGateReport,
  deferredGates,
  determinismReport,
  harmonyReaderView,
  harmonyScaffoldReport,
  inboxReceipt,
  duplicateInboxReceipt,
  reviewReceipt,
  reviewConflictReceipt,
  unsupportedInboxPatchRejected
}) {
  const openQuestionLabel = formatCount(harmonyReaderView.workspace.openQuestionCount, "open question");
  const parkedQuestionLabel = formatCount(harmonyReaderView.workspace.parkedQuestionCount || 0, "parked question");
  const unresolvedQuestionLabel = formatCount(harmonyReaderView.workspace.unresolvedQuestionCount || harmonyReaderView.workspace.openQuestionCount, "unresolved question");
  const artifactRows = [
    ["Morning review (fixture)", "MORNING_REVIEW.md", "Readable checklist and evidence summary."],
    ["60-second review script", DEMO_SCRIPT_FILE, "Bounded route through the verified demo surfaces and deferred gates."],
    ["Stage matrix", STAGE_FILE, "Fixture/dry-run/prototype/internal labels for this pack."],
    ["Evidence tiers", EVIDENCE_TIERS_FILE, "Machine-readable evidence tier for each generated artifact."],
    ["Deferred gates", DEFERRED_GATES_FILE, `${deferredGates.summary.pending} approval/device/signing gates are explicitly not proven.`],
    ["Mac Manual QA Receipt", MAC_MANUAL_QA_FILE, "Fill this during real Mac dogfood: sidecar, capture, import/export, relaunch."],
    ["Windows Static QA Receipt", WINDOWS_STATIC_QA_FILE, "PENDING RECEIPT, not QA evidence; fill this during real Windows Edge/Chrome mirror launch, Review/Inbox return files, and Mac Return Files import."],
    ["Static Return Contract", STATIC_RETURN_CONTRACT_FILE, "`npm run check:static-return` boundary: static contract plus fixture model import, not real device/user return-file proof."],
    ["HarmonyOS DevEco Handoff", HARMONY_DEVECO_HANDOFF_FILE, "ArkTS scaffold, import boundary, reader session handoff, patch boundary, and device test gates."],
    ["HarmonyOS Scaffold Report", HARMONY_SCAFFOLD_REPORT_FILE, `${harmonyScaffoldReport.fileCount} scaffold files checked; reader session/page wiring covered; no SDK compile claimed.`],
    ["Sample workspace", SAMPLE_WORKSPACE_FILE, "Import this into the app for the demo state."],
    ["Mirror home", "mirror-folder/index.html", "Static folder intended for Feishu Drive or Windows reading."],
    ["Today pack", "mirror-folder/TODAY.md", "Resume list generated from the workspace."],
    ["Portable review", "mirror-folder/review.html", "Offline review page that exports progress patches."],
    ["Mobile inbox", "mirror-folder/inbox.html", "Phone/Windows capture draft page."],
    ["Feishu Upload Plan (local fixture, no live API)", "feishu-upload/feishu-upload-plan.json", `${feishuUploadPlan.files.length} local one-way upserts; no live credentials or Drive writes.`],
    ["Feishu Dry-Run Report (no network)", "feishu-upload/feishu-upload-report.json", `${feishuUploadReport.summary.verifiedFiles} local files verified; ${feishuUploadReport.wouldSend.requestCount} hashed wouldSend requests and ${feishuUploadReport.targetTree.files.length} target-tree files remain not-sent.`],
    ["Capture Resume Receipt", CAPTURE_RESUME_RECEIPT_FILE, `${captureResumeReceipt.roundTrip.addedCaptureCount} captures added through model path, surfaced in Today, moved Focus Brief to ${captureResumeReceipt.roundTrip.focusBriefNextAction}, and checked draft-vs-review precedence.`],
    ["Source Time Links Receipt", SOURCE_TIME_LINKS_RECEIPT_FILE, `${sourceTimeLinksReceipt.summary.passed}/${sourceTimeLinksReceipt.summary.cases} local parser/jump cases for ${sourceTimeLinksReceipt.providers.join(", ")}; live video-site playback QA is not proven.`],
    ["Patch Intake Negative Receipt", PATCH_INTAKE_NEGATIVE_RECEIPT_FILE, `${patchIntakeNegativeReceipt.summary.expectedFailuresObserved}/${patchIntakeNegativeReceipt.summary.cases} malformed/oversized/duplicate/stale cases observed expected failures.`],
    ["Mirror Integrity Report", MIRROR_INTEGRITY_FILE, `${mirrorIntegrityReport.summary.internalLinks} internal links checked; ${mirrorIntegrityReport.summary.brokenLinks} broken.`],
    ["Adversarial Gates Report", ADVERSARIAL_GATES_FILE, `${adversarialGateReport.summary.passed}/${adversarialGateReport.summary.checks} negative fixtures observed expected failures.`],
    ...(determinismReport ? [["Determinism Report", DETERMINISM_FILE, `${determinismReport.summary.comparedFiles} files compared across two isolated runs; ${determinismReport.summary.differences} differences.`]] : []),
    ["Feishu Local Files (materialized fixture)", "feishu-upload/files/index.html", `${feishuUploadResult.fileCount} files materialized for Drive folder QA only.`],
    ["HarmonyOS Reader View (schema prototype)", SAMPLE_HARMONY_READER_FILE, `${harmonyReaderView.topics.length} phone-facing topics, ${openQuestionLabel}, ${parkedQuestionLabel}, and ${unresolvedQuestionLabel}; not device-verified.`],
    ["Mirror JSON", SAMPLE_MIRROR_JSON_FILE, `${mirrorBundle.manifest.fileCount} files in structured bundle form.`],
    ["Mirror ZIP", sampleMirrorZipFile, `${mirrorZip.fileCount} files, ${mirrorZip.bytes} bytes.`],
    ["Inbox patch", `patches/${SAMPLE_MOBILE_INBOX_PATCH_FILE}`, "Sample append-only phone capture patch."],
    ["Review patch", `patches/${SAMPLE_REVIEW_PROGRESS_PATCH_FILE}`, "Sample append-only review progress patch."],
    ["Summary", "SUMMARY.json", "Hashes, provenance, and generator receipts."]
  ];
  const receiptRows = [
    ["Mobile inbox import", `${inboxReceipt.added} added`, `${inboxReceipt.sanitizedSourceUrls} unsafe source link stripped; ${inboxReceipt.answeredQuestions} question resolved`],
    ["Duplicate inbox import", `${duplicateInboxReceipt.added} added`, duplicateInboxReceipt.targetResolution],
    ["Review progress import", `${reviewReceipt.applied} applied`, `${reviewReceipt.skippedConflict} stale conflicts`],
    ["Review conflict import", `${reviewConflictReceipt.applied} applied`, `${reviewConflictReceipt.skippedConflict} stale conflicts`],
    ["Unsupported patch rejection", unsupportedInboxPatchRejected ? "covered" : "missing", "invalid mobile inbox patch rejected before import"],
    ["Feishu upload plan", `${feishuUploadPlan.files.length} upserts`, `auth ${feishuUploadPlan.provider.auth.status}`],
    ["Feishu dry-run report", `${feishuUploadReport.summary.verifiedFiles} verified`, `${feishuUploadReport.summary.wouldUpsert} would-upsert actions; ${feishuUploadReport.wouldSend.requestCount} wouldSend envelopes; ${feishuUploadReport.targetTree.files.length} target-tree files; ${feishuUploadReport.boundary.statement}`],
    ["Capture to resume", `${captureResumeReceipt.roundTrip.addedCaptureCount} captures`, `Today changed: ${captureResumeReceipt.roundTrip.todayHashChanged}; Focus Brief: ${captureResumeReceipt.roundTrip.focusBriefNextAction}; draft over due review: ${captureResumeReceipt.draftFocus.cases.dueReviewBeatsFreshDraft.shouldOverride}`],
    ["Source time links", `${sourceTimeLinksReceipt.summary.passed}/${sourceTimeLinksReceipt.summary.cases} passed`, `providers ${sourceTimeLinksReceipt.providers.join(", ")}; unsupported preserved ${sourceTimeLinksReceipt.summary.unsupportedPreserved}; live-site verified ${sourceTimeLinksReceipt.summary.liveSiteVerified}`],
    ["Patch intake negatives", `${patchIntakeNegativeReceipt.summary.expectedFailuresObserved}/${patchIntakeNegativeReceipt.summary.cases} observed`, "malformed, unsupported, oversized, duplicate, and stale patch inputs are rejected or skipped"],
    ["Mirror integrity", mirrorIntegrityReport.ok ? "ok" : "broken", `${mirrorIntegrityReport.summary.internalLinks} internal links; ${mirrorIntegrityReport.summary.brokenLinks} broken`],
    ["Adversarial gates", `${adversarialGateReport.summary.passed}/${adversarialGateReport.summary.checks} passed`, "determinism and mirror-integrity expected failures observed"],
    ["Deferred gates", `${deferredGates.summary.pending}/${deferredGates.summary.total} pending`, "approval/device/signing/live-write evidence still required"],
    ...(determinismReport ? [["Morning determinism", determinismReport.ok ? "ok" : "diff", `${determinismReport.summary.comparedFiles} files; ${determinismReport.summary.differences} differences`]] : []),
    ["Harmony scaffold", harmonyScaffoldReport.ok ? "ok" : "needs fix", `${harmonyScaffoldReport.fileCount} files; ${harmonyScaffoldReport.pages.length} pages; reader session/page wiring checked`],
    ["Harmony reader view", `${harmonyReaderView.topics.length} topics`, `${harmonyReaderView.dueReview.length} due cards; ${openQuestionLabel}; ${parkedQuestionLabel}; ${unresolvedQuestionLabel}`]
  ];
  const stageRows = [
    ["Mac shell", "internal-build", "offline pack plus separate native/browser gates", "signed/notarized app"],
    ["Capture to resume", "executed-model-loop", `${captureResumeReceipt.roundTrip.addedCaptureCount} captures visible in Today; Focus Brief ${captureResumeReceipt.roundTrip.focusBriefNextAction}; draft over due review ${captureResumeReceipt.draftFocus.cases.dueReviewBeatsFreshDraft.shouldOverride}`, "native GUI selection"],
    ["Source time links", "executed-local-parser", `${sourceTimeLinksReceipt.summary.passed}/${sourceTimeLinksReceipt.summary.cases} provider/edge cases`, "live video-site playback QA is not proven"],
    ["Patch intake negatives", "executed-negative-fixture", `${patchIntakeNegativeReceipt.summary.expectedFailuresObserved}/${patchIntakeNegativeReceipt.summary.cases} expected failures observed`, "real off-Mac patch origination"],
    ["Mirror integrity", "executed-static-check", `${mirrorIntegrityReport.summary.internalLinks} internal links checked`, `Windows manual rows live in ${WINDOWS_STATIC_QA_FILE}`],
    ["Static return loop", "static-contract-fixture", "`npm run check:static-return` verifies local mirror return contracts and fixture model import", "real user-created return file, file:// runtime, Windows, HarmonyOS, native picker, Feishu"],
    ["Adversarial gates", "executed-negative-fixture", `${adversarialGateReport.summary.passed}/${adversarialGateReport.summary.checks} expected failures observed`, "broader corruption matrix"],
    ["Deferred gates", "pending-user-gate", `${deferredGates.summary.pending} explicitly deferred gates`, "completion evidence"],
    ...(determinismReport ? [["Morning determinism", "executed-byte-compare", `${determinismReport.summary.comparedFiles} files compared`, "runtime environment outside repo"]] : []),
    ["Feishu", "dry-run", "local upload plan/report; no network call was made", "live Drive write"],
    ["HarmonyOS", "schema-prototype + scaffold", `${harmonyReaderView.topics.length} topic reader view; ${openQuestionLabel}; ${parkedQuestionLabel}; ${harmonyScaffoldReport.fileCount} scaffold files; reader session protects accepted view after rejected imports`, "SDK compile, real device picker, storage, and roundtrip"],
    ["Windows", "portable-fixture + pending receipt", `static mirror HTML/Markdown/JSON; ${WINDOWS_STATIC_QA_FILE} is generated for manual evidence`, "manual Windows run"],
    ["Patch intake", "Mac-import-verified fixture", "sample patch receipts and negative rejection", "off-Mac generated patch"]
  ];
  const inspectRows = [
    [
      "1. Mac Capture Sidecar",
      "In Quick Capture, check the app-focused shortcut, source/time context strip, timestamped URL staging, and -15/+15 Time nudges before inspecting broader review loops.",
      MAC_MANUAL_QA_FILE
    ],
    [
      "2. First-Run First Note",
      "Open an empty workspace and confirm Learning Flow keeps only Read source and Capture on Mac before First Note; linked-source state should offer Capture this thought, Ask about this, and Set up page clipper without repeating Open source.",
      MAC_MANUAL_QA_FILE
    ],
    [
      "3. Today Section Map",
      "With the sample workspace imported, use the Today section map to jump to due cards, questions, parked items, answers, closed items, and recent captures without losing the sidecar/mobile layout.",
      MAC_MANUAL_QA_FILE
    ],
    [
      "4. Focus Loop",
      `Import the sample workspace, then confirm Focus Brief points to review before capture while Today keeps ${openQuestionLabel} and ${parkedQuestionLabel} visible.`,
      SAMPLE_WORKSPACE_FILE
    ],
    [
      "5. Question Closure",
      "Use the Focus Brief open-question signal, then Make card, Resolve, and Reopen from Today/Captures.",
      MAC_MANUAL_QA_FILE
    ],
    [
      "6. Question Queue Health",
      `Inspect Today and TODAY.md: active plus parked should read as ${unresolvedQuestionLabel}, without making parked items hijack focus.`,
      "mirror-folder/TODAY.md"
    ],
    [
      "7. Harmony Reader Session",
      "Open the Harmony handoff and scaffold report: accepted imports should feed ReaderSessionState.currentView, rejected imports should become rejected-kept-current, and Index/TopicDetail/ReviewQueue should share that session contract.",
      HARMONY_DEVECO_HANDOFF_FILE
    ],
    [
      "8. Cross-End Mirror",
      "Open the static mirror home, then try the portable review and inbox pages as the Windows/Harmony/Feishu folder proxy.",
      "mirror-folder/index.html"
    ],
    [
      "9. Windows Static Return",
      `Use ${WINDOWS_STATIC_QA_FILE} for the actual Windows folder launch, Review/Inbox return-file creation, and Mac Return Files import before treating the Windows loop as usable.`,
      WINDOWS_STATIC_QA_FILE
    ],
    [
      "10. Static Return Contract",
      "Read the static return contract and run npm run check:static-return before treating Review/Inbox return files as locally contract-checked; this still is not real Windows, HarmonyOS, or file picker QA.",
      STATIC_RETURN_CONTRACT_FILE
    ],
    [
      "11. Evidence Boundary",
      `${deferredGates.summary.pending} approval/device/live-write gates are still deferred; do not treat this pack as live sync or production packaging.`,
      DEFERRED_GATES_FILE
    ]
  ];
  const tierRows = Object.entries(EVIDENCE_TIER_DEFINITIONS).map(([code, definition]) => [
    code,
    definition.label,
    definition.meaning
  ]);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Learning Companion Morning Review</title>
  <style>
    :root { color-scheme: light dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f6f3ed; color: #201f1b; }
    main { max-width: 1100px; margin: 0 auto; padding: 32px 20px 48px; }
    header { display: grid; gap: 10px; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 32px; letter-spacing: 0; }
    h2 { margin: 0 0 12px; font-size: 18px; }
    p { line-height: 1.55; max-width: 760px; }
    .banner { border-left: 4px solid #b45309; background: #fff7ed; padding: 12px 14px; border-radius: 6px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 14px; }
    section { margin-top: 20px; }
    .card { background: #fffaf2; border: 1px solid #e5ded1; border-radius: 8px; padding: 16px; }
    .artifact { display: grid; gap: 6px; }
    .priority { border-left: 4px solid #0f766e; }
    .badge { display: inline-block; width: fit-content; border: 1px solid #d6cabb; border-radius: 999px; padding: 2px 7px; font-size: 11px; font-weight: 700; color: #5f4b20; background: #fff4d6; }
    a { color: #0f766e; font-weight: 650; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .meta { color: #666154; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; background: #fffaf2; border: 1px solid #e5ded1; border-radius: 8px; overflow: hidden; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e5ded1; vertical-align: top; }
    th { background: #ece7dc; }
    tr:last-child td { border-bottom: 0; }
    code { background: #ece7dc; padding: 2px 5px; border-radius: 4px; }
    @media (prefers-color-scheme: dark) {
      body { background: #171612; color: #f3efe6; }
      .banner { background: #2f2415; border-left-color: #f59e0b; }
      .card, table { background: #201f1b; border-color: #3d382f; }
      .priority { border-left-color: #5eead4; }
      th { background: #2c2923; }
      th, td { border-bottom-color: #3d382f; }
      a { color: #5eead4; }
      .meta { color: #bbb2a1; }
      code { background: #2c2923; }
      .badge { color: #fde68a; background: #332711; border-color: #6b5521; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Learning Companion Morning Review</h1>
      <p class="banner"><strong>Fixture-only review pack.</strong> This dashboard proves generated local artifacts and safety receipts, not live Feishu sync, real HarmonyOS behavior, Windows manual QA, off-Mac patch origination, or signed Mac packaging.</p>
      <p class="banner"><strong>Freshness note.</strong> Offline and native gates were rerun against HEAD. Latest Today draft-resume UI assertions are receipt + syntax checked and still need the separate local browser smoke gate.</p>
      <p class="meta">Scope: cross-end fixture-ready · no live Feishu sync · no device run · no signed packaging · see <a href="${escapeHtml(STAGE_FILE)}">STAGE.md</a></p>
      <p><span class="badge">${escapeHtml(getEvidenceTierForPath(REVIEW_REPORT_FILE).label)}</span></p>
      <p>Start with the Mac learning loop: open the app beside a browser source, check First Note and Quick Capture, then inspect the static mirror and bounded return-file evidence.</p>
    </header>
    <section>
      <h2>What To Inspect First</h2>
      <div class="grid">
        ${inspectRows.map(([title, description, href]) => `<div class="card priority"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(description)}</p><p class="meta"><a href="${escapeHtml(href)}">${escapeHtml(href)}</a></p></div>`).join("\n        ")}
      </div>
    </section>
    <section>
      <h2>Fast Path</h2>
      <div class="grid">
        <div class="card"><strong>1. Mac Loop</strong><p>Open the app beside a browser source. Check First Note, then use Capture this thought and confirm the Thought lane is the focused writing target.</p></div>
        <div class="card"><strong>2. Import</strong><p>Import <a href="${escapeHtml(SAMPLE_WORKSPACE_FILE)}">${escapeHtml(SAMPLE_WORKSPACE_FILE)}</a>, type a half-finished Quick Capture thought, switch sessions, and confirm Today/Focus Brief can resume it without calling it synced data.</p></div>
        <div class="card"><strong>3. Verify</strong><p>Run <code>npm run check:morning</code> for the offline headline gate. Run <code>npm run check:static-return</code> for the static Review/Inbox return contract. Run <code>npm run check:morning:native</code> and <code>npm run check:morning:browser</code> separately when those local permissions are available.</p></div>
        <div class="card"><strong>4. Inspect</strong><p>Open <a href="mirror-folder/index.html">mirror-folder/index.html</a>, then try review and inbox patch pages.</p></div>
      </div>
    </section>
    <section>
      <h2>Stage Matrix</h2>
      <table>
        <thead><tr><th>Area</th><th>Stage</th><th>Evidence</th><th>Not proven</th></tr></thead>
        <tbody>
          ${stageRows.map(([area, stage, evidence, gap]) => `<tr><td>${escapeHtml(area)}</td><td>${escapeHtml(stage)}</td><td>${escapeHtml(evidence)}</td><td>${escapeHtml(gap)}</td></tr>`).join("\n          ")}
        </tbody>
      </table>
    </section>
    <section>
      <h2>Evidence Tiers</h2>
      <table>
        <thead><tr><th>Tier</th><th>Badge</th><th>Meaning</th></tr></thead>
        <tbody>
          ${tierRows.map(([tier, badge, meaning]) => `<tr><td>${escapeHtml(tier)}</td><td><span class="badge">${escapeHtml(badge)}</span></td><td>${escapeHtml(meaning)}</td></tr>`).join("\n          ")}
        </tbody>
      </table>
    </section>
    <section>
      <h2>Generated Artifacts</h2>
      <div class="grid">
        ${artifactRows.map(([title, href, description]) => {
          const evidence = getEvidenceTierForPath(href);
          return `<div class="card artifact"><a href="${escapeHtml(href)}">${escapeHtml(title)}</a><span class="badge">${escapeHtml(evidence.label)}</span><span class="meta">${escapeHtml(description)}</span></div>`;
        }).join("\n        ")}
      </div>
    </section>
    <section>
      <h2>Safety Receipts</h2>
      <table>
        <thead><tr><th>Check</th><th>Result</th><th>Detail</th></tr></thead>
        <tbody>
          ${receiptRows.map(([name, result, detail]) => `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(result)}</td><td>${escapeHtml(detail)}</td></tr>`).join("\n          ")}
        </tbody>
      </table>
    </section>
    <section>
      <h2>Current Gaps</h2>
      <ul>
        <li>Live Feishu OpenAPI sync is not implemented; upload plan is local only.</li>
        <li>HarmonyOS behavior still needs real-device verification; Windows still needs the manual static receipt in <a href="${escapeHtml(WINDOWS_STATIC_QA_FILE)}">${escapeHtml(WINDOWS_STATIC_QA_FILE)}</a>.</li>
        <li>The static return verifier is contract-plus-fixture evidence only; it does not prove a real user-created return file or target-device file picker behavior.</li>
        <li>The Mac shell is an internal WKWebView shell, not a signed production app.</li>
        <li>Native selected-text capture has no live GUI matrix in this generator.</li>
        <li>Latest Today draft-resume browser assertions still need the separate local browser smoke gate.</li>
        <li>See <a href="${escapeHtml(DEFERRED_GATES_FILE)}">${escapeHtml(DEFERRED_GATES_FILE)}</a> for the exact pending approval/device/signing gates and closing evidence.</li>
      </ul>
    </section>
  </main>
</body>
</html>`;
}

function buildEvidenceTierManifest(outputManifest, options = {}) {
  const artifacts = outputManifest.map((entry) => ({
    path: entry.path,
    bytes: entry.bytes,
    sha256: entry.sha256,
    evidence: getEvidenceTierForPath(entry.path)
  }));
  const counts = {};
  for (const artifact of artifacts) {
    counts[artifact.evidence.tier] = (counts[artifact.evidence.tier] || 0) + 1;
  }
  return {
    schema: "learning-companion.evidence-tiers.v1",
    generatedAt: options.generatedAt || new Date().toISOString(),
    evidenceTiers: EVIDENCE_TIER_DEFINITIONS,
    summary: {
      artifactCount: artifacts.length,
      counts,
      note: "SUMMARY.json is written after this manifest and declares its own evidence tier."
    },
    artifacts
  };
}

function buildEvidenceBadgeMarkdown(path) {
  const evidence = getEvidenceTierForPath(path);
  return `> ${evidence.label}: ${evidence.reason}\n\n`;
}

function getEvidenceTierForPath(path) {
  const normalized = String(path).replace(/^dist\/morning-demo\//, "");
  if (normalized === MAC_MANUAL_QA_FILE) {
    return evidenceTier("PENDING_USER_GATE", "Manual QA rows are intentionally `NT` until Tony runs the Mac dogfood flow.");
  }
  if (normalized === WINDOWS_STATIC_QA_FILE) {
    return evidenceTier("PENDING_USER_GATE", "Manual QA rows are intentionally `NT` until Tony runs the Windows static mirror and Return Files loop.");
  }
  if (normalized === STATIC_RETURN_CONTRACT_FILE) {
    return evidenceTier("EXECUTED", "Generated contract note for the separate static return verifier; the verifier receipt itself is project-local and ignored.");
  }
  if (normalized === HARMONY_DEVECO_HANDOFF_FILE) {
    return evidenceTier("HANDOFF_ONLY", "DevEco/ArkTS scaffold guidance and interface contract only; no HarmonyOS device run is claimed.");
  }
  if (normalized === HARMONY_SCAFFOLD_REPORT_FILE) {
    return evidenceTier("HANDOFF_ONLY", "DevEco scaffold file structure and ArkTS contract names were checked locally; no SDK compile or device run is claimed.");
  }
  if (normalized === DEFERRED_GATES_FILE) {
    return evidenceTier("PENDING_USER_GATE", "Explicitly lists live-write, device, Windows, signing, and GUI gates that require approval or target hardware.");
  }
  if (normalized.startsWith("feishu-upload/")) {
    return evidenceTier("DRY_RUN", "Feishu folder files, plan, and report are credential-free local dry-run artifacts; no network or remote write is claimed.");
  }
  if (normalized === EVIDENCE_TIERS_FILE) {
    return evidenceTier("EXECUTED", "Generated from the pack's output manifest to label each artifact's evidence tier.");
  }
  if (normalized === CAPTURE_RESUME_RECEIPT_FILE) {
    return evidenceTier("EXECUTED", "Pure model round-trip proves addCapture writes are visible in the generated Today resume pack.");
  }
  if (normalized === SOURCE_TIME_LINKS_RECEIPT_FILE) {
    return evidenceTier("EXECUTED", "Local parser/jump fixtures prove supported video-provider timestamp URL behavior; live playback QA is not claimed.");
  }
  if (normalized === PATCH_INTAKE_NEGATIVE_RECEIPT_FILE) {
    return evidenceTier("EXECUTED", "Pure model/import negative fixtures prove malformed, unsupported, oversized, duplicate, and stale patch paths fail safely.");
  }
  if (normalized === MIRROR_INTEGRITY_FILE) {
    return evidenceTier("EXECUTED", "Static mirror folder was walked and every internal HTML/Markdown link was resolved on disk.");
  }
  if (normalized === ADVERSARIAL_GATES_FILE) {
    return evidenceTier("EXECUTED", "Negative fixtures prove determinism and mirror-integrity gates fail when invariants are violated.");
  }
  if (normalized === DETERMINISM_FILE) {
    return evidenceTier("EXECUTED", "Morning generator was run twice in isolated temp directories and output bytes were compared.");
  }
  if (normalized === "SUMMARY.json") {
    return evidenceTier("EXECUTED", "Generated after local checks and credential sweep; records hashes, gates, and evidence-tier counts.");
  }
  return evidenceTier("EXECUTED", "Generated or validated by local scripts in this fixture pack; target-device or credentialed behavior is not implied.");
}

function evidenceTier(tier, reason) {
  const definition = EVIDENCE_TIER_DEFINITIONS[tier];
  if (!definition) throw new Error(`Unknown evidence tier: ${tier}`);
  return {
    tier,
    label: definition.label,
    meaning: definition.meaning,
    reason
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function assertLocalDashboardLinksExist(html, root) {
  const hrefs = [...html.matchAll(/\bhref="([^"]+)"/g)].map((match) => match[1]);
  for (const href of hrefs) {
    if (/^(?:https?:|mailto:|#)/i.test(href)) continue;
    await access(join(root, href));
  }
}

function getGitSha() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function collectOutputManifest(root) {
  const files = await listFiles(root);
  const entries = [];
  for (const path of files) {
    if (path.endsWith("/SUMMARY.json")) continue;
    const data = await readFile(path);
    entries.push({
      path: path.slice(`${root}/`.length),
      bytes: data.length,
      sha256: createHash("sha256").update(data).digest("hex")
    });
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

async function scanForCredentialLikeText(root, options = {}) {
  const patterns = [
    { name: "authorization-header", regex: /\bAuthorization\s*:/i },
    { name: "cookie-header", regex: /\b(Set-)?Cookie\s*:/i },
    { name: "bearer-token", regex: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/i },
    { name: "jwt", regex: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/ },
    { name: "mira-session", regex: /\bmira_session\b/i },
    { name: "csrf-token", regex: /\bopen_csrf_token\b/i },
    { name: "oauth-code", regex: /\boauth[_-]?code\b/i }
  ];
  const matches = [];
  for (const path of await listFiles(root)) {
    if (path.endsWith(".zip")) continue;
    if (path.endsWith("/SUMMARY.json")) continue;
    const text = await readFile(path, "utf8");
    for (const pattern of patterns) {
      if (pattern.regex.test(text)) {
        matches.push({ path: path.slice(`${root}/`.length), pattern: pattern.name });
      }
    }
  }
  return {
    ok: matches.length === 0,
    scope: {
      root: options.rootLabel || root,
      ruleset: "credential-like-text.v1",
      skippedBinaryExtensions: [".zip"]
    },
    scannedFiles: (await listFiles(root)).filter((path) => !path.endsWith(".zip") && !path.endsWith("/SUMMARY.json")).length,
    matches
  };
}

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      paths.push(...await listFiles(path));
    } else if (entry.isFile()) {
      paths.push(path);
    }
  }
  return paths;
}
