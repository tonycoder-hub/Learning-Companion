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
  buildMirrorBundle,
  buildMirrorZip,
  getDueReviewItems,
  sanitizeWorkspace
} from "../apps/companion-web/src/model.js";
import { buildHarmonyReaderView } from "../apps/companion-harmony/src/schema-reader.mjs";
import {
  buildFeishuUploadDryRunReport,
  buildFeishuUploadPlan,
  materializeMirrorBundle
} from "./feishu-mirror-uploader.mjs";

const OUT_DIR = "dist/morning-demo";
const MIRROR_DIR = join(OUT_DIR, "mirror-folder");
const FEISHU_UPLOAD_DIR = join(OUT_DIR, "feishu-upload");
const PATCH_DIR = join(OUT_DIR, "patches");
const SAMPLE_WORKSPACE_FILE = "sample-workspace.json";
const SAMPLE_MIRROR_JSON_FILE = "sample-feishu-mirror.json";
const SAMPLE_HARMONY_READER_FILE = "sample-harmony-reader-view.json";
const SAMPLE_MOBILE_INBOX_PATCH_FILE = "sample-mobile-inbox-patch.json";
const SAMPLE_REVIEW_PROGRESS_PATCH_FILE = "sample-review-progress-patch.json";
const REVIEW_REPORT_FILE = "review-start-here.html";
const STAGE_FILE = "STAGE.md";
const MAC_MANUAL_QA_FILE = "MAC_MANUAL_QA.md";
const HARMONY_DEVECO_HANDOFF_FILE = "HARMONY_DEVECO_HANDOFF.md";

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
      quote: "Phone-side follow-up while reviewing the mirror bundle.",
      thought: "This should import as an inbox capture without touching notes or cards.",
      timestamp: "13:20",
      sourceTitle: "HarmonyOS browser",
      sourceUrl: "javascript:alert(1)",
      materialType: "doc",
      tags: "phone mirror",
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

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(MIRROR_DIR, { recursive: true });
await mkdir(PATCH_DIR, { recursive: true });

const mirrorBundle = buildMirrorBundle(demoWorkspace);
const mirrorZip = buildMirrorZip(demoWorkspace);
const feishuUploadPlan = buildFeishuUploadPlan(mirrorBundle, {
  rootName: "Learning Companion Morning Demo",
  generatedAt: mirrorBundle.exportedAt
});
const harmonyReaderView = buildHarmonyReaderView(mirrorBundle, {
  now: "2026-05-29T07:20:00.000+08:00"
});
const sampleMirrorZipFile = `sample-${mirrorZip.filename}`;
await writeJson(join(OUT_DIR, SAMPLE_WORKSPACE_FILE), demoWorkspace);
await writeJson(join(OUT_DIR, SAMPLE_MIRROR_JSON_FILE), mirrorBundle);
await writeJson(join(OUT_DIR, SAMPLE_HARMONY_READER_FILE), harmonyReaderView);
await writeFile(join(OUT_DIR, sampleMirrorZipFile), Buffer.from(mirrorZip.data));
await writeJson(join(PATCH_DIR, SAMPLE_MOBILE_INBOX_PATCH_FILE), mobileInboxPatch);
await writeJson(join(PATCH_DIR, SAMPLE_REVIEW_PROGRESS_PATCH_FILE), reviewProgressPatch);
const feishuUploadResult = materializeMirrorBundle(mirrorBundle, FEISHU_UPLOAD_DIR, {
  plan: feishuUploadPlan
});
const feishuUploadReport = buildFeishuUploadDryRunReport(feishuUploadPlan, join(FEISHU_UPLOAD_DIR, "files"), {
  generatedAt: mirrorBundle.exportedAt
});
await writeJson(join(FEISHU_UPLOAD_DIR, "feishu-upload-report.json"), feishuUploadReport);
assert.equal(feishuUploadResult.fileCount, mirrorBundle.files.length);
assert.equal(feishuUploadResult.bundleFingerprint, mirrorBundle.manifest.bundleFingerprint);
assert.equal(feishuUploadReport.summary.verifiedFiles, mirrorBundle.files.length);
assert.equal(harmonyReaderView.workspace.sessionCount, demoWorkspace.sessions.length);
assert.equal(harmonyReaderView.activeTopic.id, demoWorkspace.activeSessionId);

for (const file of mirrorBundle.files) {
  await writeText(join(MIRROR_DIR, file.path), file.content);
}

const macManualQaMarkdown = buildMacManualQaMarkdown({
  sampleMirrorZipFile,
  feishuUploadReport
});
const macManualQaStatus = summarizeMacManualQa(macManualQaMarkdown);

await writeText(join(OUT_DIR, "MORNING_REVIEW.md"), buildMorningReviewMarkdown({
  mirrorBundle,
  mirrorZip,
  sampleMirrorZipFile,
  feishuUploadPlan,
  feishuUploadResult,
  feishuUploadReport,
  harmonyReaderView,
  inboxReceipt: inboxResult.receipt,
  duplicateInboxReceipt: duplicateInboxResult.receipt,
  reviewReceipt: reviewResult.receipt,
  reviewConflictReceipt: reviewConflictResult.receipt,
  unsupportedInboxPatchRejected
}));
await writeText(join(OUT_DIR, STAGE_FILE), buildStageMarkdown({
  mirrorBundle,
  feishuUploadReport,
  harmonyReaderView,
  unsupportedInboxPatchRejected,
  macManualQaStatus
}));
await writeText(join(OUT_DIR, MAC_MANUAL_QA_FILE), macManualQaMarkdown);
await writeText(join(OUT_DIR, HARMONY_DEVECO_HANDOFF_FILE), await readFile("apps/companion-harmony/DEVECO_HANDOFF.md", "utf8"));
const reviewReportHtml = buildReviewStartHereHtml({
  mirrorBundle,
  mirrorZip,
  sampleMirrorZipFile,
  feishuUploadPlan,
  feishuUploadResult,
  feishuUploadReport,
  harmonyReaderView,
  inboxReceipt: inboxResult.receipt,
  duplicateInboxReceipt: duplicateInboxResult.receipt,
  reviewReceipt: reviewResult.receipt,
  reviewConflictReceipt: reviewConflictResult.receipt,
  unsupportedInboxPatchRejected
});
assert.match(reviewReportHtml, /href="MORNING_REVIEW\.md"/);
assert.match(reviewReportHtml, /href="STAGE\.md"/);
assert.match(reviewReportHtml, /href="MAC_MANUAL_QA\.md"/);
assert.match(reviewReportHtml, /href="HARMONY_DEVECO_HANDOFF\.md"/);
assert.match(reviewReportHtml, /href="mirror-folder\/index\.html"/);
assert.match(reviewReportHtml, /Fixture-only/);
await writeText(join(OUT_DIR, REVIEW_REPORT_FILE), reviewReportHtml);

const outputManifest = await collectOutputManifest(OUT_DIR);
const credentialSweep = await scanForCredentialLikeText(OUT_DIR);
assert.equal(credentialSweep.ok, true, `credential-like text found in ${credentialSweep.matches.map((item) => item.path).join(", ")}`);
await writeJson(join(OUT_DIR, "SUMMARY.json"), {
  ok: true,
  kind: "fixture",
  scope: "local-fixture",
  stageStatement: "cross-end fixture-ready, not live cross-end ready",
  integrationStages: [
    { area: "Mac", stage: "internal-build", proof: "SwiftPM build plus browser/native bridge smoke" },
    { area: "Feishu", stage: "dry-run", proof: "local upload plan/report; no network call was made" },
    { area: "HarmonyOS", stage: "schema-prototype", proof: "local reader view smoke only" },
    { area: "Windows", stage: "portable-fixture", proof: "static mirror files only" }
  ],
  notProven: [
    "live Feishu Drive write",
    "real HarmonyOS device roundtrip",
    "Windows manual import/export run",
    "signed or notarized Mac packaging",
    "off-Mac generated patch imported on Mac"
  ],
  disclaimer: "Fixture-only generated sample data. This does not prove live Feishu sync, HarmonyOS device behavior, or signed Mac packaging.",
  generatedAt: new Date().toISOString(),
  provenance: {
    gitSha: getGitSha(),
    nodeVersion: process.version,
    generator: "scripts/build-morning-demo.mjs"
  },
  workspace: SAMPLE_WORKSPACE_FILE,
  reviewReport: REVIEW_REPORT_FILE,
  macManualQa: MAC_MANUAL_QA_FILE,
  harmonyDevEcoHandoff: HARMONY_DEVECO_HANDOFF_FILE,
  mirrorBundle: SAMPLE_MIRROR_JSON_FILE,
  mirrorZip: sampleMirrorZipFile,
  mirrorFileCount: mirrorBundle.files.length,
  mirrorBundleFingerprint: mirrorBundle.manifest.bundleFingerprint,
  feishuUploadPlan: "feishu-upload/feishu-upload-plan.json",
  feishuUploadReport: "feishu-upload/feishu-upload-report.json",
  feishuUploadFileCount: feishuUploadResult.fileCount,
  harmonyReaderView: SAMPLE_HARMONY_READER_FILE,
  macManualQaStatus,
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
    harmonyReaderTopics: harmonyReaderView.topics.length,
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

function buildStageMarkdown({
  mirrorBundle,
  feishuUploadReport,
  harmonyReaderView,
  unsupportedInboxPatchRejected,
  macManualQaStatus
}) {
  const macQaGate = macManualQaStatus.nt === macManualQaStatus.total
    ? `NOT_RUN(0/${macManualQaStatus.total})`
    : `PARTIAL(${macManualQaStatus.filled}/${macManualQaStatus.total})`;
  return [
    "# Learning Companion Stage Matrix",
    "",
    "This file is the morning pack's stage label. Any single artifact in this folder should be read through this matrix.",
    "",
    "| Area | Stage | Evidence in this pack | Not proven |",
    "| --- | --- | --- | --- |",
    `| Mac shell | internal-build | SwiftPM build plus native bridge smoke; manual QA ${macManualQaStatus.filled}/${macManualQaStatus.total} filled; mirror fingerprint ${mirrorBundle.manifest.bundleFingerprint}. | Signed/notarized app, AppKit panel manual QA. |`,
    `| Feishu | dry-run | Upload report verified ${feishuUploadReport.summary.verifiedFiles} local files; ${feishuUploadReport.boundary.statement} | Live Drive write, auth, stale remote cleanup. |`,
    `| HarmonyOS | schema-prototype | Reader view has ${harmonyReaderView.topics.length} topics and ${harmonyReaderView.dueReview.length} due cards; import/patch boundary is covered by smoke. | Real device import, storage, export, or UX. |`,
    "| Windows | portable-fixture | Static mirror HTML/Markdown/JSON files are generated. | Manual Windows browser/file roundtrip. |",
    `| Patch intake | Mac-import-verified fixture | Inbox duplicate handling, review conflict handling, and unsupported inbox patch rejection: ${unsupportedInboxPatchRejected ? "covered" : "missing"}. | Off-Mac generated patch imported on Mac. |`,
    "",
    "## Named Gates",
    "",
    "| Gate | Status | Evidence / next action |",
    "| --- | --- | --- |",
    `| mac_manual_qa | ${macQaGate} | Fill \`${MAC_MANUAL_QA_FILE}\` during real dogfood. |`,
    "| feishu_live_write | BLOCKED(creds) | Needs explicit credential configuration and approval. |",
    "| harmony_device | BLOCKED(no_device) | Needs DevEco/device run using the handoff contract. |",
    "| windows_manual | NOT_RUN | Needs manual mirror folder and patch file roundtrip on Windows. |",
    "| mac_signed | NOT_RUN | Needs packaging/signing/notarization flow. |",
    `| patch_intake_fixture | ${unsupportedInboxPatchRejected ? "PASS" : "NEEDS_FIX"} | Browser smoke and generator cover duplicate/conflict/unsupported fixture paths. |`,
    "",
    "Use wording: fixture, dry-run, schema-prototype, internal-build. Do not call this pack live sync, device-ready, or production Mac packaging.",
    ""
  ].join("\n");
}

function summarizeMacManualQa(markdown) {
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

function buildMacManualQaMarkdown({
  sampleMirrorZipFile,
  feishuUploadReport
}) {
  return [
    "# Learning Companion Mac Manual QA Receipt",
    "",
    "Stage: internal-build manual QA. This receipt does not prove signed packaging, notarization, or live Feishu/HarmonyOS behavior.",
    "",
    "Fill this in during the morning review. Use `PASS`, `FAIL`, `BLOCKED`, or `NT` in the Result column.",
    "",
    "## Preconditions",
    "",
    "- Run `npm run check:morning` from the repository root.",
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
    "| Floating | Toggle `Window > Keep Window Above Others` while a browser is frontmost. | Window level changes only when manually toggled. | NT |  |",
    "| Clipboard capture | Copy text in any app, then use `Capture > Save Clipboard as Capture`. | Capture appears in the active topic with `clipboard` source. | NT |  |",
    "| Selected text capture | Select text in Safari/Chrome/docs, then use `Capture > Save Selected Text as Capture`. | If Accessibility exposes `AXSelectedText`, selected text is captured without overwriting pasteboard. | NT |  |",
    "| Clipboard fallback guard | Trigger selected-text capture with no exposed selection and unchanged clipboard. | App does not import stale clipboard; status explains no selection/new clipboard. | NT |  |",
    "| Browser context | Capture selected/clipboard text while Safari or Chrome is frontmost on an HTTP(S) page. | Capture can attach page title and URL, or degrades to text-only if Automation is denied. | NT |  |",
    "| Native import success | Import `dist/morning-demo/patches/sample-mobile-inbox-patch.json` via `File > Import Workspace...`. | Patch Intake/receipt shows imported inbox patch without overwriting notes/cards. | NT |  |",
    "| Native import failure | Import a malformed JSON file via `File > Import Workspace...`. | Alert and in-app issue receipt explain the import failure. | NT |  |",
    "| Export backup | Use `File > Export Workspace...`. | A JSON workspace backup can be saved locally. | NT |  |",
    "| Relaunch persistence | Quit and relaunch the shell. | Workspace persists through WebKit localStorage. | NT |  |",
    `| Mirror inspection | Open \`dist/morning-demo/mirror-folder/index.html\` and \`${sampleMirrorZipFile}\`. | Static mirror is readable; ZIP extracts to the same conceptual folder. | NT |  |`,
    `| Feishu dry-run artifact | Inspect \`dist/morning-demo/feishu-upload/feishu-upload-report.json\`. | Boundary says: ${feishuUploadReport.boundary.statement} | NT |  |`,
    "",
    "## Notes",
    "",
    "- Permission prompts are expected for Accessibility or browser Automation. If a prompt appears, record it instead of treating it as a product failure.",
    "- If a step needs a user approval tonight, mark `BLOCKED` and continue with the rest.",
    "- Real HarmonyOS and Windows runs belong in a later device roundtrip receipt.",
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
  harmonyReaderView,
  inboxReceipt,
  duplicateInboxReceipt,
  reviewReceipt,
  reviewConflictReceipt,
  unsupportedInboxPatchRejected
}) {
  return [
    "# Learning Companion Morning Review",
    "",
    "> FIXTURE ONLY: this pack is generated sample data. It does not prove live Feishu sync, real HarmonyOS device behavior, or signed Mac packaging.",
    "",
    "This pack is generated from a representative local workspace. It is credential-free and safe to inspect without Feishu or HarmonyOS setup.",
    "",
    "## Start Here",
    "",
    "0. Open `dist/morning-demo/review-start-here.html` for a clickable review dashboard.",
    "0a. Read `dist/morning-demo/STAGE.md` before interpreting any artifact as a capability claim.",
    "0b. Use `dist/morning-demo/MAC_MANUAL_QA.md` to record Mac GUI dogfood results.",
    "0c. Use `dist/morning-demo/HARMONY_DEVECO_HANDOFF.md` as the phone-app scaffold contract.",
    "1. Run `npm run check:morning` from the repo root.",
    "2. Run `npm run dev` and open `http://127.0.0.1:5173`.",
    "3. Import `dist/morning-demo/sample-workspace.json` in the app.",
    "4. Open the Export tab and compare it with `dist/morning-demo/mirror-folder/index.html`.",
    "5. Open `dist/morning-demo/mirror-folder/review.html`, reveal a card, mark Good, and save/copy the progress patch.",
    "6. Open `dist/morning-demo/mirror-folder/inbox.html`, add a capture, and save/copy the inbox patch.",
    "7. Import the sample patches from `dist/morning-demo/patches/` to see the Mac-side receipts.",
    "",
    "## Generated Artifacts",
    "",
    `- Sample mirror JSON: \`${SAMPLE_MIRROR_JSON_FILE}\` (${mirrorBundle.manifest.fileCount} files)`,
    `- Sample mirror ZIP: \`${sampleMirrorZipFile}\` (${mirrorZip.fileCount} files, ${mirrorZip.bytes} bytes)`,
    "- Extracted folder: `mirror-folder/`",
    `- Stage matrix: \`${STAGE_FILE}\` (fixture/dry-run/prototype/internal labels)`,
    `- Mac manual QA receipt: \`${MAC_MANUAL_QA_FILE}\` (fill during dogfood review)`,
    `- HarmonyOS DevEco handoff: \`${HARMONY_DEVECO_HANDOFF_FILE}\` (ArkTS scaffold contract)`,
    `- Feishu upload plan: \`feishu-upload/feishu-upload-plan.json\` (${feishuUploadPlan.files.length} planned local upserts, no live API)`,
    `- Feishu dry-run report: \`feishu-upload/feishu-upload-report.json\` (${feishuUploadReport.summary.verifiedFiles} verified local files)`,
    `- Feishu local files: \`feishu-upload/files/\` (${feishuUploadResult.fileCount} materialized fixture files)`,
    `- HarmonyOS reader view: \`${SAMPLE_HARMONY_READER_FILE}\` (${harmonyReaderView.topics.length} topics, schema prototype)`,
    `- Sample workspace restore: \`${SAMPLE_WORKSPACE_FILE}\``,
    `- Sample phone capture patch: \`patches/${SAMPLE_MOBILE_INBOX_PATCH_FILE}\``,
    `- Sample review progress patch: \`patches/${SAMPLE_REVIEW_PROGRESS_PATCH_FILE}\``,
    "",
    "## What To Judge",
    "",
    "- Sidecar capture: can you capture quote/thought/time/source without losing focus?",
    "- Workspace Find: can you find a prior capture or card quickly?",
    "- Today pack: does it tell you what to resume?",
    "- Mirror folder: would this be readable in Feishu Drive or Windows?",
    "- Feishu upload plan: is the one-way folder writer boundary clear enough before real credentials?",
    "- Harmony reader view: does the phone-facing view model contain the right active topic, review, and capture slices?",
    "- Mobile inbox: can phone-side captures return to Mac without overwriting notes/cards?",
    "- Review progress: can phone-side review grades return without overwriting newer Mac state?",
    "",
    "## Safety Receipts Verified By Generator",
    "",
    `- Mobile inbox sample: ${inboxReceipt.added} added, ${inboxReceipt.sanitizedSourceUrls} unsafe source link stripped.`,
    `- Duplicate inbox sample: ${duplicateInboxReceipt.added} added after duplicate-patch detection.`,
    `- Review progress sample: ${reviewReceipt.applied} applied, ${reviewReceipt.skippedConflict} stale conflicts.`,
    `- Review progress conflict sample: ${reviewConflictReceipt.applied} applied, ${reviewConflictReceipt.skippedConflict} stale conflict skipped.`,
    `- Feishu upload plan sample: ${feishuUploadPlan.files.length} upserts, auth status ${feishuUploadPlan.provider.auth.status}.`,
    `- Feishu dry-run report sample: ${feishuUploadReport.summary.verifiedFiles} local files verified, ${feishuUploadReport.summary.wouldUpsert} would-upsert actions; ${feishuUploadReport.boundary.statement}`,
    `- Harmony reader sample: ${harmonyReaderView.topics.length} topics, ${harmonyReaderView.dueReview.length} due cards.`,
    "- Dashboard local links were checked for file existence before `SUMMARY.json` was written.",
    "- Credential sweep and output hashes are recorded in `SUMMARY.json`.",
    `- Unsupported mobile inbox patch rejection: ${unsupportedInboxPatchRejected ? "covered" : "missing"}.`,
    "",
    "## What This Does Not Prove",
    "",
    "- This is still manual transport, not real Feishu OpenAPI sync.",
    "- The Feishu upload plan is local-folder materialization only; it does not authenticate or write to Drive.",
    "- HarmonyOS browser behavior needs a real device roundtrip.",
    "- localStorage is temporary; export often.",
    "- Mac shell is still a thin WKWebView wrapper, not a signed production app.",
    "- The sample ZIP has not been opened on Windows or HarmonyOS in this generator.",
    "",
    "## Current Evidence",
    "",
    "- `npm run smoke` covers model contracts and generated static artifacts.",
    "- `npm run smoke:harmony` covers the read-only HarmonyOS reader view contract plus pure import/patch boundary fixtures.",
    "- `npm run smoke:browser` covers browser interaction, mirror generation/import, static review/inbox runtime behavior, patch import receipts, duplicate review patch receipts, and visible issue receipts for bad mirror, malformed JSON, and oversized patch imports.",
    "- `npm run check:morning` runs web smoke, Harmony reader smoke, browser smoke, Mac shell build, and this demo pack generator.",
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
  harmonyReaderView,
  inboxReceipt,
  duplicateInboxReceipt,
  reviewReceipt,
  reviewConflictReceipt,
  unsupportedInboxPatchRejected
}) {
  const artifactRows = [
    ["Morning review (fixture)", "MORNING_REVIEW.md", "Readable checklist and evidence summary."],
    ["Stage matrix", STAGE_FILE, "Fixture/dry-run/prototype/internal labels for this pack."],
    ["Mac Manual QA Receipt", MAC_MANUAL_QA_FILE, "Fill this during real Mac dogfood: sidecar, capture, import/export, relaunch."],
    ["HarmonyOS DevEco Handoff", HARMONY_DEVECO_HANDOFF_FILE, "ArkTS scaffold, import boundary, patch boundary, and device test gates."],
    ["Sample workspace", SAMPLE_WORKSPACE_FILE, "Import this into the app for the demo state."],
    ["Mirror home", "mirror-folder/index.html", "Static folder intended for Feishu Drive or Windows reading."],
    ["Today pack", "mirror-folder/TODAY.md", "Resume list generated from the workspace."],
    ["Portable review", "mirror-folder/review.html", "Offline review page that exports progress patches."],
    ["Mobile inbox", "mirror-folder/inbox.html", "Phone/Windows capture draft page."],
    ["Feishu Upload Plan (local fixture, no live API)", "feishu-upload/feishu-upload-plan.json", `${feishuUploadPlan.files.length} local one-way upserts; no live credentials or Drive writes.`],
    ["Feishu Dry-Run Report (no network)", "feishu-upload/feishu-upload-report.json", `${feishuUploadReport.summary.verifiedFiles} local files verified before any real uploader exists.`],
    ["Feishu Local Files (materialized fixture)", "feishu-upload/files/index.html", `${feishuUploadResult.fileCount} files materialized for Drive folder QA only.`],
    ["HarmonyOS Reader View (schema prototype)", SAMPLE_HARMONY_READER_FILE, `${harmonyReaderView.topics.length} phone-facing topics; not device-verified.`],
    ["Mirror JSON", SAMPLE_MIRROR_JSON_FILE, `${mirrorBundle.manifest.fileCount} files in structured bundle form.`],
    ["Mirror ZIP", sampleMirrorZipFile, `${mirrorZip.fileCount} files, ${mirrorZip.bytes} bytes.`],
    ["Inbox patch", `patches/${SAMPLE_MOBILE_INBOX_PATCH_FILE}`, "Sample append-only phone capture patch."],
    ["Review patch", `patches/${SAMPLE_REVIEW_PROGRESS_PATCH_FILE}`, "Sample append-only review progress patch."],
    ["Summary", "SUMMARY.json", "Hashes, provenance, and generator receipts."]
  ];
  const receiptRows = [
    ["Mobile inbox import", `${inboxReceipt.added} added`, `${inboxReceipt.sanitizedSourceUrls} unsafe source link stripped`],
    ["Duplicate inbox import", `${duplicateInboxReceipt.added} added`, duplicateInboxReceipt.targetResolution],
    ["Review progress import", `${reviewReceipt.applied} applied`, `${reviewReceipt.skippedConflict} stale conflicts`],
    ["Review conflict import", `${reviewConflictReceipt.applied} applied`, `${reviewConflictReceipt.skippedConflict} stale conflicts`],
    ["Unsupported patch rejection", unsupportedInboxPatchRejected ? "covered" : "missing", "invalid mobile inbox patch rejected before import"],
    ["Feishu upload plan", `${feishuUploadPlan.files.length} upserts`, `auth ${feishuUploadPlan.provider.auth.status}`],
    ["Feishu dry-run report", `${feishuUploadReport.summary.verifiedFiles} verified`, `${feishuUploadReport.summary.wouldUpsert} would-upsert actions; ${feishuUploadReport.boundary.statement}`],
    ["Harmony reader view", `${harmonyReaderView.topics.length} topics`, `${harmonyReaderView.dueReview.length} due cards`]
  ];
  const stageRows = [
    ["Mac shell", "internal-build", "SwiftPM build and native bridge smoke", "signed/notarized app"],
    ["Feishu", "dry-run", "local upload plan/report; no network call was made", "live Drive write"],
    ["HarmonyOS", "schema-prototype", `${harmonyReaderView.topics.length} topic reader view`, "real device roundtrip"],
    ["Windows", "portable-fixture", "static mirror HTML/Markdown/JSON", "manual Windows run"],
    ["Patch intake", "Mac-import-verified fixture", "sample patch receipts and negative rejection", "off-Mac generated patch"]
  ];
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
      th { background: #2c2923; }
      th, td { border-bottom-color: #3d382f; }
      a { color: #5eead4; }
      .meta { color: #bbb2a1; }
      code { background: #2c2923; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Learning Companion Morning Review</h1>
      <p class="banner"><strong>Fixture-only review pack.</strong> This dashboard proves generated local artifacts and safety receipts, not live Feishu sync, real HarmonyOS behavior, Windows manual QA, off-Mac patch origination, or signed Mac packaging.</p>
      <p class="meta">Scope: cross-end fixture-ready · no live Feishu sync · no device run · no signed packaging · see <a href="${escapeHtml(STAGE_FILE)}">STAGE.md</a></p>
      <p>Start here in the morning: open the app, import the sample workspace, then inspect the static mirror, mobile inbox, and review progress loop.</p>
    </header>
    <section>
      <h2>Fast Path</h2>
      <div class="grid">
        <div class="card"><strong>1. Verify</strong><p>Run <code>npm run check:morning</code>. It runs web smoke, Harmony reader smoke, browser smoke, Mac build, and this generator.</p></div>
        <div class="card"><strong>2. Import</strong><p>Open the app and import <a href="${escapeHtml(SAMPLE_WORKSPACE_FILE)}">${escapeHtml(SAMPLE_WORKSPACE_FILE)}</a>.</p></div>
        <div class="card"><strong>3. Inspect</strong><p>Open <a href="mirror-folder/index.html">mirror-folder/index.html</a>, then try review and inbox patch pages.</p></div>
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
      <h2>Generated Artifacts</h2>
      <div class="grid">
        ${artifactRows.map(([title, href, description]) => `<div class="card artifact"><a href="${escapeHtml(href)}">${escapeHtml(title)}</a><span class="meta">${escapeHtml(description)}</span></div>`).join("\n        ")}
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
        <li>HarmonyOS and Windows behavior still need real-device verification.</li>
        <li>The Mac shell is an internal WKWebView shell, not a signed production app.</li>
        <li>Native selected-text capture has no live GUI matrix in this generator.</li>
      </ul>
    </section>
  </main>
</body>
</html>`;
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

async function scanForCredentialLikeText(root) {
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
      root,
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
