import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  WORKSPACE_SCHEMA,
  WORKSPACE_SCHEMA_VERSION,
  MAX_CAPTURE_TEXT_LENGTH,
  MAX_INBOX_PATCH_CAPTURES,
  MAX_REVIEW_PROGRESS_EVENTS,
  MAX_SEARCH_QUERY_LENGTH,
  WORKSPACE_BACKUP_STALE_DAYS,
  MOBILE_INBOX_PATCH_SCHEMA,
  REVIEW_PROGRESS_PATCH_SCHEMA,
  addCapture,
  addSession,
  applyMobileInboxPatch,
  applyGrade,
  applyReviewProgressPatch,
  buildFeishuPayload,
  buildCaptureDraftItems,
  buildFocusBrief,
  buildMirrorBundle,
  buildMirrorZip,
  buildSourceJumpUrl,
  buildTodayPack,
  captureDraftStatusText,
  cleanText,
  cleanUrl,
  createDefaultWorkspace,
  createSession,
  deleteCapture,
  deleteReviewCard,
  filterSessions,
  formatBytes,
  formatLocalIso,
  generateInboxHtml,
  generateMarkdown,
  generateMirrorIndexHtml,
  generateReviewPackMarkdown,
  generateReviewHtml,
  generateSynthesisDraft,
  generateTodayMarkdown,
  getRecentCaptureItems,
  getSynthesisStats,
  getSynthesisSourceStamp,
  getDueReviewCards,
  getDueReviewItems,
  getActiveSession,
  gradeCard,
  hasCaptureDraft,
  hasCaptureTextDraft,
  isMobileInboxPatch,
  isMobileInboxPatchLike,
  isReviewProgressPatch,
  isReviewProgressPatchLike,
  normalizeCaptureDraft,
  promoteCapture,
  resolveCaptureDraftFocusOverride,
  reviewIntervalDays,
  safeHref,
  sanitizeWorkspace,
  searchWorkspace,
  timestampToSeconds,
  updateSession,
  workspaceBackupFingerprint,
  workspaceStorageNotice,
  workspaceFromPortableData
} from "../apps/companion-web/src/model.js";
import {
  FEISHU_UPLOAD_PLAN_SCHEMA,
  FEISHU_UPLOAD_REPORT_SCHEMA,
  buildFeishuUploadDryRunReport,
  buildFeishuUploadPlan,
  materializeMirrorBundle
} from "./feishu-mirror-uploader.mjs";

const manifest = JSON.parse(readFileSync("apps/companion-web/manifest.webmanifest", "utf8"));
const indexHtml = readFileSync("apps/companion-web/index.html", "utf8");
const appJs = readFileSync("apps/companion-web/src/app.js", "utf8");
const serviceWorker = readFileSync("apps/companion-web/service-worker.js", "utf8");
assert.equal(manifest.display, "standalone");
assert.equal(manifest.start_url, "./");
assert.equal(manifest.icons[0].src, "./assets/icon.svg");
assert.match(indexHtml, /Capture \(Cmd\/Ctrl\+Enter\)/);
assert.match(indexHtml, /Cmd\/Ctrl\+Shift\+Enter/);
assert.match(indexHtml, /role="combobox"/);
assert.match(indexHtml, /aria-controls="searchResults"/);
assert.match(indexHtml, /role="listbox"/);
assert.match(appJs, /ArrowDown/);
assert.match(appJs, /aria-activedescendant/);
assert.match(appJs, /event\.isComposing/);
assert.match(appJs, /searchResultsCollapsed/);
assert.match(appJs, /scrollIntoView\(\{ block: "nearest" \}\)/);
assert.match(appJs, /openSearchResult\(results\[Math\.max\(0, activeSearchIndex\)\]\)/);
assert.match(appJs, /UI_PREFS_SCHEMA_VERSION = 2/);
assert.match(appJs, /workspaceBackupFingerprint/);
assert.match(appJs, /workspaceStorageNotice/);
assert.match(appJs, /Export requested - verify downloaded file/);
assert.match(serviceWorker, /CACHE_NAME/);
assert.match(serviceWorker, /learning-companion-static-v2/);
assert.match(serviceWorker, /STATIC_ASSETS/);
assert.match(serviceWorker, /src\/app\.js/);
assert.match(serviceWorker, /await fetch\(request\)/);
assert.match(serviceWorker, /cache\.match\(request\)/);

let workspace = createDefaultWorkspace();
assert.equal(workspace.schema, WORKSPACE_SCHEMA);
assert.equal(workspace.schemaVersion, WORKSPACE_SCHEMA_VERSION);
assert.equal(workspace.version, WORKSPACE_SCHEMA_VERSION);

const reviewPackMarkdown = generateReviewPackMarkdown(workspace);
assert.match(reviewPackMarkdown, /Learning Companion Review Pack/);
assert.match(reviewPackMarkdown, /Next action: Capture next point/);
assert.match(reviewPackMarkdown, /Why: The source is available and the session has gone quiet\./);
assert.match(reviewPackMarkdown, /Offline headline gate/);
assert.match(reviewPackMarkdown, /Separate permissioned gates/);
assert.match(reviewPackMarkdown, /npm run check:morning:browser/);

const normalizedDraft = normalizeCaptureDraft({
  quote: "  Draft quote\n",
  thought: "Draft thought",
  timestamp: " 08:12 ",
  updatedAt: "2026-05-29T00:01:00.000Z"
});
assert.deepEqual(normalizedDraft, {
  quote: "Draft quote",
  thought: "Draft thought",
  timestamp: "08:12",
  updatedAt: "2026-05-29T00:01:00.000Z"
});
assert.equal(hasCaptureDraft(normalizedDraft), true);
assert.equal(hasCaptureTextDraft(normalizedDraft), true);
assert.equal(captureDraftStatusText(normalizedDraft), "Draft saved");
assert.equal(captureDraftStatusText(normalizeCaptureDraft({ timestamp: "01:23" })), "Time kept");
assert.equal(captureDraftStatusText(normalizeCaptureDraft({})), "No draft");
assert.match(normalizeCaptureDraft({ quote: "\u0000safe" }).quote, /^safe$/);
assert.equal(normalizeCaptureDraft({ quote: "x" }, new Date("2026-05-29T00:02:00.000Z")).updatedAt, "2026-05-29T00:02:00.000Z");

const draftSessions = [
  createSession({ id: "draft_a", title: "Draft A" }, workspace.clientId),
  createSession({ id: "draft_b", title: "Draft B" }, workspace.clientId),
  createSession({ id: "draft_empty", title: "Draft Empty" }, workspace.clientId)
];
const draftItems = buildCaptureDraftItems(draftSessions, {
  draft_a: { quote: "Older draft", updatedAt: "2026-05-29T00:01:00.000Z" },
  draft_b: { thought: "Newest draft", updatedAt: "2026-05-29T00:03:00.000Z" },
  draft_empty: { quote: "   ", updatedAt: "2026-05-29T00:04:00.000Z" }
}, 5);
assert.deepEqual(draftItems.map((item) => item.session.id), ["draft_b", "draft_a"]);
assert.equal(buildCaptureDraftItems(draftSessions, { draft_a: { quote: "Only draft" } }, 0).length, 0);
assert.match(workspace.clientId, /^client_/);
assert.equal(workspace.sessions.length, 1);
assert.equal(cleanUrl("javascript:alert(1)"), "");
assert.equal(cleanUrl("data:text/html,hi"), "");
assert.equal(safeHref("javascript:alert(1)"), "#");
assert.equal(cleanUrl("https://example.com/a path").startsWith("https://example.com/"), true);
assert.equal(cleanText("ok\u0000bad"), "okbad");
assert.equal(cleanText("x".repeat(MAX_CAPTURE_TEXT_LENGTH + 10)).length, MAX_CAPTURE_TEXT_LENGTH);
assert.equal(buildSourceJumpUrl("javascript:alert(1)", "01:00"), "");
assert.equal(buildSourceJumpUrl("https://example.com/video", "01:00"), "https://example.com/video");
assert.equal(buildSourceJumpUrl("https://youtu.be/rust123?start=12", "01:00"), "https://youtu.be/rust123?t=60s");
assert.equal(timestampToSeconds("abc"), null);
assert.equal(timestampToSeconds("1:2:3:4"), null);

workspace = addSession(workspace, "Rust ownership course");
let session = getActiveSession(workspace);
assert.equal(session.title, "Rust ownership course");
workspace = updateSession(workspace, session.id, {
  sourceTitle: "RustConf ownership talk",
  sourceUrl: "https://www.youtube.com/watch?v=rust123",
  materialType: "video"
});
session = getActiveSession(workspace);

workspace = addCapture(workspace, session.id, {
  quote: "Ownership lets Rust make memory safety guarantees without a garbage collector.",
  thought: "Connect this to compile-time lifetime checks.",
  timestamp: "08:12",
  tags: "rust memory"
}, { promoteToReview: true, now: "2026-05-29T00:10:00.000Z" });

session = getActiveSession(workspace);
assert.equal(session.captures.length, 1);
assert.equal(session.reviewCards.length, 1);
assert.equal(session.captures[0].tags.includes("rust"), true);
assert.equal(session.captures[0].originClientId, workspace.clientId);
assert.equal(session.captures[0].updatedAt.length > 0, true);
assert.equal(session.captures[0].sourceTitle, "RustConf ownership talk");
assert.equal(session.captures[0].sourceUrl, "https://www.youtube.com/watch?v=rust123");
assert.equal(session.captures[0].materialType, "video");
assert.equal(session.captures[0].sourceProvenance, "snapshot");
assert.equal(getDueReviewCards(session).length, 1);
assert.equal(getDueReviewItems(workspace).length, 1);
assert.equal(timestampToSeconds("08:12"), 492);
assert.equal(buildSourceJumpUrl(session.captures[0].sourceUrl, session.captures[0].timestamp), "https://www.youtube.com/watch?v=rust123&t=492s");
const backupFingerprint = workspaceBackupFingerprint(workspace);
const backupNow = new Date("2026-05-29T00:30:00.000Z");
const emptyWorkspace = createDefaultWorkspace();
const emptyBackupFingerprint = workspaceBackupFingerprint(emptyWorkspace);
assert.equal(workspaceStorageNotice(createDefaultWorkspace(), null, 1000, backupNow), null);
assert.equal(workspaceStorageNotice(emptyWorkspace, { fingerprint: emptyBackupFingerprint, exportedAt: "2026-05-21T00:30:00.000Z" }, 1000, backupNow), null);
assert.equal(workspaceStorageNotice(workspace, null, 1000, backupNow), "Local changes not exported");
assert.equal(workspaceStorageNotice(workspace, { fingerprint: backupFingerprint, exportedAt: "2026-05-28T00:30:00.000Z" }, 1000, backupNow), null);
assert.equal(
  workspaceStorageNotice(workspace, { fingerprint: backupFingerprint, exportedAt: "2026-05-21T23:30:00.000Z" }, 1000, backupNow),
  `Last export was ${WORKSPACE_BACKUP_STALE_DAYS} days ago; re-export to refresh your local copy`
);
assert.equal(workspaceStorageNotice(workspace, { fingerprint: backupFingerprint, exportedAt: "2026-05-28T00:30:00.000Z" }, 4_000_000, backupNow), "Workspace is 3.8 MB; export now.");
assert.equal(workspaceStorageNotice(workspace, { fingerprint: backupFingerprint, exportedAt: "2026-05-21T23:30:00.000Z" }, 4_000_000, backupNow), "Workspace is 3.8 MB; export now.");
assert.equal(formatBytes(1536), "2 KB");

const promotedDeterminismBase = addSession(createDefaultWorkspace(), "Promoted card determinism");
const promotedDeterminismSession = getActiveSession(promotedDeterminismBase);
const promotedDeterminismInput = {
  id: "capture_promoted_deterministic",
  quote: "Fixed review-card timestamps make resume gates stable.",
  thought: "Check promoted card determinism."
};
const promotedA = addCapture(promotedDeterminismBase, promotedDeterminismSession.id, promotedDeterminismInput, {
  promoteToReview: true,
  now: "2026-05-29T00:12:00.000Z"
});
const promotedB = addCapture(promotedDeterminismBase, promotedDeterminismSession.id, promotedDeterminismInput, {
  promoteToReview: true,
  now: "2026-05-29T00:12:00.000Z"
});
const scrubPromotedCard = (workspaceValue) => {
  const card = getActiveSession(workspaceValue).reviewCards[0];
  return { ...card, id: "<generated-card-id>" };
};
assert.deepEqual(scrubPromotedCard(promotedA), scrubPromotedCard(promotedB));
assert.equal(scrubPromotedCard(promotedA).dueAt, "2026-05-29T00:12:00.000Z");
assert.equal(scrubPromotedCard(promotedA).createdAt, "2026-05-29T00:12:00.000Z");
assert.equal(scrubPromotedCard(promotedA).updatedAt, "2026-05-29T00:12:00.000Z");

const timedWorkspace = addCapture(workspace, session.id, {
  id: "timed_capture",
  quote: "Timed capture for deterministic receipts.",
  thought: "The script can inject capture time without changing app defaults."
}, { now: "2026-05-29T01:02:03.000Z" });
const timedCapture = getActiveSession(timedWorkspace).captures[0];
assert.equal(timedCapture.id, "timed_capture");
assert.equal(timedCapture.createdAt, "2026-05-29T01:02:03.000Z");
assert.equal(timedCapture.capturedAt, "2026-05-29T01:02:03.000Z");
assert.equal(timedCapture.updatedAt, "2026-05-29T01:02:03.000Z");

let multiReviewWorkspace = addSession(workspace, "Algorithms course");
const algorithmsSession = getActiveSession(multiReviewWorkspace);
multiReviewWorkspace = addCapture(multiReviewWorkspace, algorithmsSession.id, {
  quote: "Dijkstra explores the lowest-cost frontier first.",
  thought: "Recall why greedy selection works.",
  tags: "algorithms graph"
}, { promoteToReview: true, now: "2026-05-29T00:11:00.000Z" });
const dueItems = getDueReviewItems(multiReviewWorkspace);
assert.equal(dueItems.length, 2);
assert.equal(dueItems.some((item) => item.sessionTitle === "Rust ownership course"), true);
assert.equal(dueItems.some((item) => item.sessionTitle === "Algorithms course"), true);
assert.equal(getRecentCaptureItems(multiReviewWorkspace, 1)[0].sessionTitle, "Algorithms course");

const workspaceDueElsewhere = sanitizeWorkspace({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  activeSessionId: "focus_active_clean",
  sessions: [
    {
      id: "focus_active_clean",
      title: "Clean active topic",
      sourceTitle: "Clean source",
      sourceUrl: "https://example.com/clean",
      materialType: "doc",
      tags: [],
      focusMode: "capture",
      notesMarkdown: "",
      captures: [],
      reviewCards: []
    },
    {
      id: "focus_due_elsewhere",
      title: "Due elsewhere",
      sourceTitle: "Other source",
      sourceUrl: "https://example.com/other",
      materialType: "doc",
      tags: [],
      focusMode: "capture",
      notesMarkdown: "",
      captures: [],
      reviewCards: [{
        id: "elsewhere_card",
        prompt: "Remember this outside the active topic",
        answer: "Because Today is workspace-scoped.",
        dueAt: "2026-05-29T00:00:00.000Z",
        strength: 0
      }]
    }
  ]
});
const workspaceDueBrief = buildFocusBrief(getActiveSession(workspaceDueElsewhere), workspaceDueElsewhere, new Date("2026-05-29T00:20:00.000Z"));
assert.equal(workspaceDueBrief.stats.dueCards, 0);
assert.equal(workspaceDueBrief.stats.workspaceDueCards, 1);
assert.equal(workspaceDueBrief.nextAction.kind, "review");
assert.match(workspaceDueBrief.nextAction.label, /workspace due card/);
assert.equal(workspaceDueBrief.nextAction.detail, "Due cards exist outside the active topic; queue is earliest due, then topic title.");
assert.equal(workspaceDueBrief.nextAction.reason, "Workspace review debt outranks adding new material.");

const inboxPatch = {
  schema: MOBILE_INBOX_PATCH_SCHEMA,
  appVersion: WORKSPACE_SCHEMA_VERSION,
  patchId: "patch_mobile_001",
  createdAt: "2026-05-29T08:00:00+08:00",
  source: {
    generatedBy: "inbox.html",
    workspaceFingerprint: "fnv1a-test",
    topicId: session.id,
    topicTitle: session.title
  },
  target: {
    topicId: session.id,
    topicTitle: session.title
  },
  captures: [{
    id: "inbox_capture_001",
    quote: "Mobile reading adds a follow-up quote.",
    thought: "Bring this back from HarmonyOS.",
    timestamp: "03:21",
    sourceTitle: "Mobile article",
    sourceUrl: "javascript:alert(1)",
    materialType: "article",
    tags: "mobile inbox",
    capturedAt: "2026-05-29T08:01:00+08:00"
  }, {
    id: "inbox_capture_001",
    quote: "Duplicate inside patch",
    thought: "Should be skipped",
    capturedAt: "2026-05-29T08:02:00+08:00"
  }]
};
assert.equal(isMobileInboxPatch(inboxPatch), true);
let inboxResult = applyMobileInboxPatch(workspace, inboxPatch, new Date("2026-05-29T08:05:00+08:00"));
let inboxSession = inboxResult.workspace.sessions.find((item) => item.id === session.id);
const importedInboxCapture = inboxSession.captures.find((capture) => capture.inboxCaptureId === "inbox_capture_001");
assert.equal(inboxResult.receipt.targetResolution, "id-match");
assert.equal(inboxResult.receipt.added, 1);
assert.equal(inboxResult.receipt.skippedDuplicate, 1);
assert.equal(inboxResult.receipt.sanitizedSourceUrls, 1);
assert.equal(importedInboxCapture.sourceProvenance, "inbox");
assert.equal(importedInboxCapture.sourceUrl, "");
assert.equal(importedInboxCapture.inboxCaptureId, "inbox_capture_001");
assert.equal(inboxResult.workspace.importedPatches.includes("patch_mobile_001"), true);
const duplicateInboxResult = applyMobileInboxPatch(inboxResult.workspace, inboxPatch);
assert.equal(duplicateInboxResult.receipt.targetResolution, "duplicate-patch");
assert.equal(duplicateInboxResult.receipt.added, 0);
assert.equal(duplicateInboxResult.workspace.sessions.find((item) => item.id === session.id).captures.length, inboxSession.captures.length);

const titlePatch = {
  ...inboxPatch,
  patchId: "patch_mobile_002",
  target: { topicId: "missing", topicTitle: session.title },
  captures: [{ ...inboxPatch.captures[0], id: "inbox_capture_002", sourceUrl: "https://example.com/mobile" }]
};
const titleResult = applyMobileInboxPatch(workspace, titlePatch);
assert.equal(titleResult.receipt.targetResolution, "title-match");
assert.equal(titleResult.workspace.sessions.find((item) => item.id === session.id).captures.find((capture) => capture.inboxCaptureId === "inbox_capture_002").sourceUrl, "https://example.com/mobile");

const fallbackPatch = {
  ...inboxPatch,
  patchId: "patch_mobile_003",
  target: { topicId: "missing", topicTitle: "Missing title" },
  captures: [{ ...inboxPatch.captures[0], id: "inbox_capture_003", thought: "Fallback capture" }]
};
const fallbackResult = applyMobileInboxPatch(workspace, fallbackPatch);
assert.equal(fallbackResult.receipt.targetResolution, "active-fallback");
assert.equal(getActiveSession(fallbackResult.workspace).captures.find((capture) => capture.inboxCaptureId === "inbox_capture_003").thought, "Fallback capture");

assert.equal(isMobileInboxPatchLike({ schema: "learning-companion.mobile-inbox-patch.v2" }), true);
assert.throws(() => workspaceFromPortableData({ schema: "learning-companion.mobile-inbox-patch.v2" }), /Unsupported mobile inbox patch schema/);
assert.throws(() => applyMobileInboxPatch(workspace, { ...inboxPatch, patchId: "" }), /patchId/);
assert.throws(() => applyMobileInboxPatch(workspace, {
  ...inboxPatch,
  patchId: "patch_mobile_too_many",
  captures: Array.from({ length: MAX_INBOX_PATCH_CAPTURES + 1 }, (_, index) => ({
    ...inboxPatch.captures[0],
    id: `too_many_${index}`
  }))
}), /too many captures/);

const markdown = generateMarkdown(session);
assert.match(markdown, /Rust ownership course/);
assert.match(markdown, /08:12/);
assert.match(markdown, /RustConf ownership talk/);
assert.match(markdown, /t=492s/);
assert.match(markdown, /Review Cards/);

const synthesis = generateSynthesisDraft(session);
assert.match(synthesis, /Synthesis - Rust ownership course/);
assert.match(synthesis, /Generated from 1 capture \/ 0 questions \/ 1 card/);
assert.match(synthesis, /compile-time lifetime checks/);
assert.match(synthesis, /Review Targets/);

const emptySynthesis = generateSynthesisDraft(createSession({ title: "Empty topic" }, workspace.clientId));
assert.match(emptySynthesis, /No captures yet/);
assert.deepEqual(getSynthesisStats(session), { captures: 1, questions: 0, cards: 1 });

const focusNow = new Date("2026-05-29T00:20:00.000Z");
const dueFocusBrief = buildFocusBrief(session, workspace, focusNow);
assert.equal(dueFocusBrief.schema, "learning-companion.focus-brief.v1");
assert.equal(dueFocusBrief.nextAction.kind, "review");
assert.equal(dueFocusBrief.nextAction.reason, "Active topic has due review due now.");
assert.match(generateReviewPackMarkdown(workspace), /Why: Active topic has due review due now\./);
assert.equal(dueFocusBrief.stats.dueCards, 1);
assert.equal(dueFocusBrief.source.href, "https://www.youtube.com/watch?v=rust123&t=492s");
assert.equal(dueFocusBrief.source.provenance, "session");
assert.match(generateTodayMarkdown(workspace, focusNow), /Source: \[RustConf ownership talk\]\(https:\/\/www\.youtube\.com\/watch\?v=rust123&t=492s\)/);
const noCaptureSourceBrief = buildFocusBrief(createSession({
  title: "Source without captures",
  sourceTitle: "Readable source",
  sourceUrl: "https://example.com/guide"
}, workspace.clientId), null, focusNow);
assert.equal(noCaptureSourceBrief.source.href, "https://example.com/guide");
assert.equal(noCaptureSourceBrief.source.provenance, "session");
const noTimestampSourceBrief = buildFocusBrief(createSession({
  title: "Source with untimed capture",
  sourceTitle: "Video without timestamp",
  sourceUrl: "https://www.youtube.com/watch?v=notimed",
  captures: [{ id: "notimed_capture", quote: "No timestamp yet", thought: "", timestamp: "", capturedAt: "2026-05-29T00:19:00.000Z" }]
}, workspace.clientId), null, focusNow);
assert.equal(noTimestampSourceBrief.source.href, "https://www.youtube.com/watch?v=notimed");
const captureFallbackBrief = buildFocusBrief(createSession({
  title: "Source fallback",
  captures: [{
    id: "fallback_capture",
    quote: "Fallback source capture",
    thought: "",
    timestamp: "00:30",
    sourceTitle: "Fallback video",
    sourceUrl: "https://youtu.be/fallback",
    capturedAt: "2026-05-29T00:19:00.000Z"
  }]
}, workspace.clientId), null, focusNow);
assert.equal(captureFallbackBrief.source.href, "https://youtu.be/fallback?t=30s");
assert.equal(captureFallbackBrief.source.title, "Fallback video");
assert.equal(captureFallbackBrief.source.provenance, "latest_capture_fallback");
assert.deepEqual(resolveCaptureDraftFocusOverride(dueFocusBrief, {
  quote: "A fresh draft should not outrank review.",
  updatedAt: "2026-05-29T00:19:00.000Z"
}, focusNow), {
  schema: "learning-companion.capture-draft-focus.v1",
  shouldOverride: false,
  hasText: true,
  isFresh: true,
  blockedByReview: true,
  maxAgeHours: 24
});
const synthesizeBrief = buildFocusBrief(createSession({
  id: "focus_synthesize",
  title: "Synthesis needed",
  sourceUrl: "https://example.com/course",
  captures: [
    { id: "cap_a", thought: "First idea", capturedAt: "2026-05-29T00:00:00.000Z" },
    { id: "cap_b", thought: "Second idea", capturedAt: "2026-05-29T00:01:00.000Z" },
    { id: "cap_c", thought: "Third idea", capturedAt: "2026-05-29T00:02:00.000Z" }
  ],
  reviewCards: []
}, workspace.clientId), null, focusNow);
assert.equal(synthesizeBrief.nextAction.kind, "synthesize");
assert.equal(synthesizeBrief.nextAction.reason, "Unsynthesized captures reached the compression threshold.");
assert.equal(synthesizeBrief.stats.capturesSinceLastSynthesis, 3);
assert.equal(synthesizeBrief.warnings.some((warning) => warning.kind === "needs_synthesis"), true);
assert.equal(resolveCaptureDraftFocusOverride(synthesizeBrief, {
  thought: "Fresh draft can outrank synthesis.",
  updatedAt: "2026-05-29T00:19:00.000Z"
}, focusNow).shouldOverride, true);
assert.equal(resolveCaptureDraftFocusOverride(synthesizeBrief, {
  thought: "Stale draft stays in Today only.",
  updatedAt: "2026-05-27T00:19:00.000Z"
}, focusNow).shouldOverride, false);
assert.equal(resolveCaptureDraftFocusOverride(synthesizeBrief, {
  timestamp: "08:12",
  updatedAt: "2026-05-29T00:19:00.000Z"
}, focusNow).shouldOverride, false);
assert.equal(resolveCaptureDraftFocusOverride(synthesizeBrief, {
  thought: "Future-dated drafts should not own focus.",
  updatedAt: "2026-05-30T00:19:00.000Z"
}, focusNow).shouldOverride, false);
const oldCaptureBrief = buildFocusBrief(createSession({
  id: "focus_capture",
  title: "Capture next",
  sourceUrl: "https://example.com/course",
  captures: [{ id: "cap_old", thought: "Older thought", capturedAt: "2026-05-29T00:00:00.000Z" }],
  reviewCards: []
}, workspace.clientId), null, focusNow);
assert.equal(oldCaptureBrief.nextAction.kind, "capture");
assert.equal(oldCaptureBrief.nextAction.reason, "The source is available and the session has gone quiet.");
const recentCaptureBrief = buildFocusBrief(createSession({
  id: "focus_continue",
  title: "Continue reading",
  sourceUrl: "https://example.com/course",
  captures: [{ id: "cap_recent", thought: "Fresh thought", capturedAt: "2026-05-29T00:15:00.000Z" }],
  reviewCards: []
}, workspace.clientId), null, focusNow);
assert.equal(recentCaptureBrief.nextAction.kind, "continue");
assert.equal(recentCaptureBrief.nextAction.reason, "A recent capture exists, so the best next step is to keep reading.");
const noSourceBrief = buildFocusBrief(createSession({ id: "focus_no_source", title: "No source" }, workspace.clientId), null, focusNow);
assert.equal(noSourceBrief.nextAction.kind, "open_source");
assert.equal(noSourceBrief.nextAction.reason, "Source context is missing, so captures would be hard to revisit.");
assert.equal(noSourceBrief.warnings.some((warning) => warning.kind === "missing_source"), true);
const unsafeSourceBrief = buildFocusBrief(createSession({
  id: "focus_unsafe_source",
  title: "Unsafe source",
  sourceUrl: "javascript:alert(1)",
  captures: []
}, workspace.clientId), null, focusNow);
assert.equal(unsafeSourceBrief.source.href, "");
assert.equal(unsafeSourceBrief.nextAction.kind, "open_source");
let synthesizedSession = createSession({
  id: "focus_synthesized",
  title: "Synthesized",
  sourceUrl: "https://example.com/course",
  captures: [
    { id: "done_a", thought: "First idea", capturedAt: "2026-05-29T00:00:00.000Z" },
    { id: "done_b", thought: "Second idea", capturedAt: "2026-05-29T00:01:00.000Z" },
    { id: "done_c", thought: "Third idea", capturedAt: "2026-05-29T00:02:00.000Z" }
  ],
  reviewCards: []
}, workspace.clientId);
synthesizedSession = {
  ...synthesizedSession,
  notesMarkdown: [
    "<!-- learning-companion:synthesis:start -->",
    `<!-- learning-companion:synthesis-source:${getSynthesisSourceStamp(synthesizedSession)} -->`,
    "Done",
    "<!-- learning-companion:synthesis:end -->"
  ].join("\n")
};
const synthesizedBrief = buildFocusBrief(synthesizedSession, null, focusNow);
assert.equal(synthesizedBrief.stats.capturesSinceLastSynthesis, 0);
assert.equal(synthesizedBrief.warnings.some((warning) => warning.kind === "needs_synthesis"), false);
assert.equal(getSynthesisSourceStamp({
  ...synthesizedSession,
  captures: [...synthesizedSession.captures].reverse(),
  reviewCards: [...synthesizedSession.reviewCards].reverse()
}), getSynthesisSourceStamp(synthesizedSession));
const staleSynthesisBrief = buildFocusBrief({
  ...synthesizedSession,
  captures: [
    { id: "new_after_synth", thought: "New idea after the old synthesis", capturedAt: "2026-05-29T00:19:00.000Z" },
    ...synthesizedSession.captures
  ]
}, null, focusNow);
assert.equal(staleSynthesisBrief.nextAction.kind, "synthesize");

const frozenToday = new Date("2099-01-02T00:00:00.000Z");
const todayPack = buildTodayPack(multiReviewWorkspace, frozenToday, { dueLimit: 1, recentLimit: 1 });
assert.equal(todayPack.stats.due, 2);
assert.equal(todayPack.dueItems.length, 1);
assert.equal(todayPack.dueOverflow, 1);
assert.equal(todayPack.recentCaptures.length, 1);
assert.equal(todayPack.focusBrief.nextAction.kind, "review");
assert.equal(todayPack.focusBrief.sessionId, multiReviewWorkspace.activeSessionId);
assert.match(todayPack.dueItems[0].sessionPath, /^sessions\/.+\.md$/);
assert.match(todayPack.recentCaptures[0].sessionPath, /^sessions\/.+\.md$/);
assert.match(todayPack.localDayWindow.start, /T00:00:00[+-]\d{2}:\d{2}$/);
assert.match(formatLocalIso(frozenToday), /2099-01-02T\d{2}:00:00[+-]\d{2}:\d{2}$/);
const todayMarkdown = generateTodayMarkdown(multiReviewWorkspace, frozenToday);
assert.equal(todayMarkdown, generateTodayMarkdown(multiReviewWorkspace, frozenToday));
assert.match(todayMarkdown, /Generated from workspace\.json/);
assert.match(todayMarkdown, /Today Study Pack/);
assert.match(todayMarkdown, /Local day window: \[/);
assert.match(todayMarkdown, /Due rule: review cards with dueAt <= generatedAt/);
assert.match(todayMarkdown, /Resume Here/);
assert.match(todayMarkdown, /Next: Review/);
assert.match(todayMarkdown, /\]\(sessions\/.+\.md\)/);
assert.match(todayMarkdown, /Due Review/);
assert.match(todayMarkdown, /Recent Captures/);
assert.match(todayMarkdown, /Recall why greedy selection works/);

const reviewHtml = generateReviewHtml(multiReviewWorkspace, frozenToday);
assert.match(reviewHtml, /Learning Companion Review Pack/);
assert.match(reviewHtml, /Content-Security-Policy/);
assert.match(reviewHtml, /learning-companion-workspace-fingerprint/);
assert.match(reviewHtml, /learning-companion\.review-progress-patch\.v1/);
assert.match(reviewHtml, /data-reveal/);
assert.match(reviewHtml, /data-grade="good"/);
assert.match(reviewHtml, /Recall why greedy selection works/);
assert.match(reviewHtml, /href="sessions\/.+\.md"/);
assert.equal(reviewHtml.includes("<script>alert"), false);
assert.equal(/<script[^>]+src=/i.test(reviewHtml), false);
assert.equal(/\bfetch\s*\(/.test(reviewHtml), false);
assert.equal(/XMLHttpRequest/.test(reviewHtml), false);
assert.equal(reviewHtml, generateReviewHtml(multiReviewWorkspace, frozenToday));

const [reviewProgressItem] = getDueReviewItems(multiReviewWorkspace, frozenToday);
const reviewProgressPatch = {
  schema: REVIEW_PROGRESS_PATCH_SCHEMA,
  appVersion: WORKSPACE_SCHEMA_VERSION,
  patchId: "review_patch_001",
  createdAt: "2099-01-02T08:00:00.000Z",
  source: { generatedBy: "review.html", workspaceFingerprint: "fnv1a-test" },
  events: [{
    id: "review_event_001",
    sessionId: reviewProgressItem.sessionId,
    cardId: reviewProgressItem.card.id,
    grade: "good",
    reviewedAt: "2099-01-02T08:01:00.000Z",
    baseUpdatedAt: reviewProgressItem.card.updatedAt,
    baseDueAt: reviewProgressItem.card.dueAt,
    baseStrength: reviewProgressItem.card.strength
  }, {
    id: "review_event_001",
    sessionId: reviewProgressItem.sessionId,
    cardId: reviewProgressItem.card.id,
    grade: "again",
    reviewedAt: "2099-01-02T08:02:00.000Z",
    baseUpdatedAt: reviewProgressItem.card.updatedAt,
    baseDueAt: reviewProgressItem.card.dueAt,
    baseStrength: reviewProgressItem.card.strength
  }]
};
assert.equal(isReviewProgressPatch(reviewProgressPatch), true);
let reviewProgressResult = applyReviewProgressPatch(multiReviewWorkspace, reviewProgressPatch, frozenToday);
const reviewedSession = reviewProgressResult.workspace.sessions.find((item) => item.id === reviewProgressItem.sessionId);
const reviewedCard = reviewedSession.reviewCards.find((card) => card.id === reviewProgressItem.card.id);
assert.equal(reviewProgressResult.receipt.applied, 1);
assert.equal(reviewProgressResult.receipt.skippedDuplicate, 1);
assert.equal(reviewProgressResult.workspace.importedReviewPatches.includes("review_patch_001"), true);
assert.equal(reviewedCard.strength, reviewProgressItem.card.strength + 1);
assert.equal(reviewedCard.lastReviewedAt, "2099-01-02T08:01:00.000Z");
const duplicateReviewProgressResult = applyReviewProgressPatch(reviewProgressResult.workspace, reviewProgressPatch);
assert.equal(duplicateReviewProgressResult.receipt.targetResolution, "duplicate-patch");
assert.equal(duplicateReviewProgressResult.receipt.applied, 0);
const staleReviewProgressResult = applyReviewProgressPatch(reviewProgressResult.workspace, {
  ...reviewProgressPatch,
  patchId: "review_patch_002",
  events: [{ ...reviewProgressPatch.events[0], id: "review_event_002" }]
});
assert.equal(staleReviewProgressResult.receipt.applied, 0);
assert.equal(staleReviewProgressResult.receipt.skippedConflict, 1);
const missingReviewProgressResult = applyReviewProgressPatch(multiReviewWorkspace, {
  ...reviewProgressPatch,
  patchId: "review_patch_003",
  events: [{ ...reviewProgressPatch.events[0], id: "review_event_003", cardId: "missing_card" }]
});
assert.equal(missingReviewProgressResult.receipt.skippedMissing, 1);
assert.equal(isReviewProgressPatchLike({ schema: "learning-companion.review-progress-patch.v2" }), true);
assert.throws(() => workspaceFromPortableData({ schema: "learning-companion.review-progress-patch.v2" }), /Unsupported review progress patch schema/);
assert.throws(() => applyReviewProgressPatch(multiReviewWorkspace, { ...reviewProgressPatch, patchId: "" }), /patchId/);
assert.throws(() => applyReviewProgressPatch(multiReviewWorkspace, {
  ...reviewProgressPatch,
  patchId: "review_patch_too_many",
  events: Array.from({ length: MAX_REVIEW_PROGRESS_EVENTS + 1 }, (_, index) => ({
    ...reviewProgressPatch.events[0],
    id: `too_many_review_${index}`
  }))
}), /too many events/);

const maliciousReviewWorkspace = sanitizeWorkspace({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  activeSessionId: "malicious_session",
  sessions: [{
    id: "malicious_session",
    title: "Bad \" onclick=alert(1) x=\" & topic",
    sourceTitle: "",
    sourceUrl: "",
    materialType: "doc",
    focusMode: "capture",
    notesMarkdown: "",
    tags: [],
    captures: [],
    reviewCards: [{
      id: "malicious_card",
      prompt: "Prompt \" onclick=alert(1) x=\" <img src=x onerror=alert(1)>",
      answer: "Answer & <script>alert(1)</script> ' `",
      dueAt: "2026-05-29T00:00:00.000Z",
      strength: 0
    }]
  }]
});
const maliciousReviewHtml = generateReviewHtml(maliciousReviewWorkspace, frozenToday);
assert.match(maliciousReviewHtml, /&quot; onclick=alert\(1\) x=&quot;/);
assert.match(maliciousReviewHtml, /&amp;/);
assert.match(maliciousReviewHtml, /&#39;/);
assert.equal(maliciousReviewHtml.includes("<img src=x"), false);
assert.equal(maliciousReviewHtml.includes("<script>alert"), false);

const inboxHtml = generateInboxHtml(multiReviewWorkspace, frozenToday);
assert.match(inboxHtml, /Learning Companion Inbox/);
assert.match(inboxHtml, /learning-companion\.mobile-inbox-patch\.v1/);
assert.match(inboxHtml, /Content-Security-Policy/);
assert.match(inboxHtml, /getRandomValues/);
assert.equal(inboxHtml.includes("<link"), false);
assert.equal(/<script[^>]+src=/i.test(inboxHtml), false);
assert.equal(/<iframe/i.test(inboxHtml), false);
assert.equal(/srcdoc=/i.test(inboxHtml), false);
assert.equal(/href=["']javascript:/i.test(inboxHtml), false);
assert.equal(/\bfetch\s*\(/.test(inboxHtml), false);
assert.equal(/XMLHttpRequest/.test(inboxHtml), false);
assert.equal(/\bimport\s*\(/.test(inboxHtml), false);

const manyCardsWorkspace = sanitizeWorkspace({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  activeSessionId: "many_cards_session",
  sessions: [{
    id: "many_cards_session",
    title: "Many cards",
    sourceTitle: "",
    sourceUrl: "",
    materialType: "doc",
    focusMode: "capture",
    notesMarkdown: "",
    tags: [],
    captures: [],
    reviewCards: Array.from({ length: 55 }, (_, index) => ({
      id: `many_card_${index}`,
      prompt: `Prompt ${index}`,
      answer: `Answer ${index}`,
      dueAt: "2026-05-29T00:00:00.000Z",
      strength: 0,
      createdAt: `2026-05-29T00:00:${String(index).padStart(2, "0")}.000Z`
    }))
  }]
});
const manyCardsReviewHtml = generateReviewHtml(manyCardsWorkspace, frozenToday);
assert.equal((manyCardsReviewHtml.match(/<article class="card"/g) || []).length, 50);

const mirrorIndexHtml = generateMirrorIndexHtml(multiReviewWorkspace, frozenToday);
assert.match(mirrorIndexHtml, /Learning Companion Mirror/);
assert.match(mirrorIndexHtml, /href="TODAY\.md"/);
assert.match(mirrorIndexHtml, /href="review\.html"/);
assert.match(mirrorIndexHtml, /href="inbox\.html"/);
assert.match(mirrorIndexHtml, /href="workspace\.json"/);
assert.match(mirrorIndexHtml, /href="sessions\/.+\.md"/);
assert.match(mirrorIndexHtml, /Resume Here/);
assert.match(mirrorIndexHtml, /Review 1 due card/);
assert.match(mirrorIndexHtml, /Why: Active topic has due review due now/);
assert.match(generateMirrorIndexHtml(workspace, focusNow), /href="https:\/\/www\.youtube\.com\/watch\?v=rust123&amp;t=492s"/);
assert.match(mirrorIndexHtml, /Content-Security-Policy/);
assert.match(mirrorIndexHtml, /learning-companion-workspace-fingerprint/);
assert.equal(mirrorIndexHtml.includes("<script"), false);
assert.equal(mirrorIndexHtml, generateMirrorIndexHtml(multiReviewWorkspace, frozenToday));

const payload = buildFeishuPayload(session);
assert.equal(payload.schema, "learning-companion.feishu-export.v1");
assert.equal(payload.session.id, session.id);
assert.equal(payload.focusBrief.sessionId, session.id);
assert.equal(payload.focusBrief.nextAction.kind, "review");

const mirror = buildMirrorBundle(workspace);
assert.equal(mirror.schema, "learning-companion.mirror-bundle.staging.v1");
assert.equal(mirror.contractStability, "experimental");
assert.equal(mirror.canonical, "workspace.json");
assert.equal(mirror.semantics.snapshot, "full");
assert.equal(mirror.workspace.sessionCount, workspace.sessions.length);
assert.equal(mirror.manifest.fileCount, 6 + workspace.sessions.length * 2);
assert.equal(mirror.files.some((file) => file.path === "index.html" && file.role === "mirror-home" && /^fnv1a-[a-f0-9]{8}$/.test(file.sourceFingerprint)), true);
assert.equal(mirror.files.some((file) => file.path === "workspace.json" && file.role === "workspace-restore"), true);
assert.equal(mirror.files.some((file) => file.path === "TODAY.md" && file.role === "study-pack"), true);
assert.equal(mirror.files.some((file) => file.path === "review.html" && file.role === "portable-review" && /^fnv1a-[a-f0-9]{8}$/.test(file.sourceFingerprint)), true);
assert.equal(mirror.files.some((file) => file.path === "inbox.html" && file.role === "mobile-inbox" && file.content.includes("Learning Companion Inbox")), true);
assert.equal(mirror.files.some((file) => file.path === "TODAY.md" && /Due Review/.test(file.content)), true);
assert.equal(mirror.files.some((file) => file.path.endsWith(".md") && /Rust ownership course/.test(file.content)), true);
assert.equal(mirror.files.every((file) => file.encoding === "utf-8"), true);
assert.equal(mirror.files.every((file) => /^fnv1a-[a-f0-9]{8}$/.test(file.contentFingerprint)), true);
assert.equal(/^fnv1a-[a-f0-9]{8}$/.test(mirror.manifest.bundleFingerprint), true);

const mirrorZip = buildMirrorZip(workspace);
const mirrorZipNames = listZipFileNames(mirrorZip.data);
assert.equal(mirrorZip.filename, "learning-companion-feishu-mirror.zip");
assert.equal(mirrorZip.mediaType, "application/zip");
assert.equal(mirrorZip.fileCount, mirror.manifest.fileCount);
assert.equal(mirrorZip.bytes, mirrorZip.data.length);
assert.equal(mirrorZipNames.length, mirror.files.length);
assert.equal(mirrorZipNames.includes("workspace.json"), true);
assert.equal(mirrorZipNames.includes("index.html"), true);
assert.equal(mirrorZipNames.includes("README.md"), true);
assert.equal(mirrorZipNames.includes("TODAY.md"), true);
assert.equal(mirrorZipNames.includes("review.html"), true);
assert.equal(mirrorZipNames.includes("inbox.html"), true);
assert.equal(mirrorZipNames.some((path) => path.endsWith(".md") && path.startsWith("sessions/")), true);
assert.equal(mirrorZipNames.some((path) => path.endsWith(".feishu.json")), true);

const uploadPlan = buildFeishuUploadPlan(mirror, {
  rootName: "Tony Learning Mirror",
  generatedAt: "2026-05-29T08:00:00.000+08:00"
});
assert.equal(uploadPlan.schema, FEISHU_UPLOAD_PLAN_SCHEMA);
assert.equal(uploadPlan.planVersion, 1);
assert.equal(uploadPlan.evidence.tier, "DRY_RUN");
assert.equal(uploadPlan.bundleFingerprint, mirror.manifest.bundleFingerprint);
assert.equal(uploadPlan.provider.name, "feishu-drive");
assert.equal(uploadPlan.provider.auth.status, "not-included");
assert.equal(uploadPlan.provider.auth.reason, "credential-free-planner");
assert.equal(uploadPlan.source.bundleFingerprint, mirror.manifest.bundleFingerprint);
assert.equal(uploadPlan.source.fileCount, mirror.manifest.fileCount);
assert.equal(uploadPlan.target.layout, "folder-files");
assert.equal(uploadPlan.files.length, mirror.files.length);
assert.equal(uploadPlan.files.every((file) => file.action === "upsert"), true);
assert.equal(uploadPlan.files.some((file) => file.path === "TODAY.md" && file.role === "study-pack"), true);
assert.equal(uploadPlan.files.some((file) => file.path === "workspace.json" && file.role === "workspace-restore"), true);
const uploadOutDir = mkdtempSync(join(tmpdir(), "learning-companion-feishu-upload-"));
try {
  const uploadResult = materializeMirrorBundle(mirror, uploadOutDir, { plan: uploadPlan });
  assert.equal(uploadResult.ok, true);
  assert.equal(uploadResult.fileCount, mirror.files.length);
  assert.equal(uploadResult.bundleFingerprint, mirror.manifest.bundleFingerprint);
  assert.equal(existsSync(join(uploadOutDir, "files", "TODAY.md")), true);
  assert.equal(existsSync(join(uploadOutDir, "files", "workspace.json")), true);
  assert.equal(existsSync(join(uploadOutDir, "feishu-upload-plan.json")), true);
  const dryRunReport = buildFeishuUploadDryRunReport(uploadPlan, join(uploadOutDir, "files"), {
    generatedAt: "2026-05-29T08:01:00.000+08:00"
  });
  assert.equal(dryRunReport.schema, FEISHU_UPLOAD_REPORT_SCHEMA);
  assert.equal(dryRunReport.evidence.tier, "DRY_RUN");
  assert.equal(dryRunReport.mode, "dry-run");
  assert.equal(dryRunReport.ok, true);
  assert.equal(dryRunReport.boundary.network, "not-called");
  assert.match(dryRunReport.boundary.statement, /No network call was made/);
  assert.equal(dryRunReport.wouldSend.status, "not-sent");
  assert.equal(dryRunReport.wouldSend.requestCount, mirror.files.length);
  assert.equal(dryRunReport.wouldSend.requests.every((request) => request.adapterAction === "upsert"), true);
  assert.equal(dryRunReport.wouldSend.requests.every((request) => /^[a-f0-9]{64}$/.test(request.payloadSha256)), true);
  assert.equal(dryRunReport.targetTree.rootName, "Tony Learning Mirror");
  assert.equal(dryRunReport.targetTree.directories.includes("sessions"), true);
  assert.equal(dryRunReport.targetTree.files.length, mirror.files.length);
  assert.equal(dryRunReport.targetTree.files.every((file) => /^[a-f0-9]{64}$/.test(file.payloadSha256)), true);
  assert.equal(dryRunReport.targetTree.files.some((file) => file.path === "TODAY.md" && file.filename === "TODAY.md"), true);
  assert.equal(dryRunReport.summary.plannedFiles, mirror.files.length);
  assert.equal(dryRunReport.summary.verifiedFiles, mirror.files.length);
  assert.equal(dryRunReport.summary.wouldUpsert, mirror.files.length);
  assert.equal(dryRunReport.files.every((file) => file.status === "would-upsert"), true);
  assert.equal(dryRunReport.files.every((file) => /^[a-f0-9]{64}$/.test(file.payloadSha256)), true);
} finally {
  rmSync(uploadOutDir, { recursive: true, force: true });
}
assert.throws(() => buildFeishuUploadPlan({
  ...mirror,
  schema: "learning-companion.mirror-bundle.staging.v2"
}), /Unsupported mirror bundle schema/);
assert.throws(() => buildFeishuUploadPlan({
  ...mirror,
  files: mirror.files.map((file, index) => index === 0 ? { ...file, path: "../escape.md" } : file)
}), /Unsafe mirror path/);
assert.throws(() => buildFeishuUploadPlan({
  ...mirror,
  files: mirror.files.map((file, index) => index === 0 ? { ...file, path: "C:/escape.md" } : file)
}), /Unsafe mirror path/);
assert.throws(() => buildFeishuUploadPlan({
  ...mirror,
  files: [...mirror.files, { ...mirror.files[0] }]
}), /Duplicate mirror path/);
assert.throws(() => buildFeishuUploadPlan({
  ...mirror,
  files: mirror.files.map((file) => file.path === "workspace.json" ? { ...file, bytes: file.bytes + 1 } : file)
}), /byte count mismatch/);
assert.throws(() => buildFeishuUploadPlan({
  ...mirror,
  files: mirror.files.filter((file) => file.path !== "workspace.json")
}), /exactly one workspace.json/);
assert.throws(() => buildFeishuUploadDryRunReport({
  ...uploadPlan,
  provider: { ...uploadPlan.provider, auth: { status: "configured" } }
}, "/tmp"), /must not include auth/);
assert.throws(() => buildFeishuUploadDryRunReport({
  ...uploadPlan,
  files: uploadPlan.files.map((file, index) => index === 0 ? { ...file, action: "delete" } : file)
}, "/tmp"), /Unsupported upload action/);
const overwriteOutDir = mkdtempSync(join(tmpdir(), "learning-companion-feishu-overwrite-"));
try {
  materializeMirrorBundle(mirror, overwriteOutDir, { plan: uploadPlan });
  assert.throws(() => materializeMirrorBundle(mirror, overwriteOutDir, { plan: uploadPlan }), /already exists/);
} finally {
  rmSync(overwriteOutDir, { recursive: true, force: true });
}
const symlinkOutDir = mkdtempSync(join(tmpdir(), "learning-companion-feishu-symlink-"));
try {
  mkdirSync(join(symlinkOutDir, "files"), { recursive: true });
  symlinkSync(tmpdir(), join(symlinkOutDir, "files", "sessions"), "dir");
  assert.throws(() => materializeMirrorBundle(mirror, symlinkOutDir, { plan: uploadPlan, force: true }), /symbolic link/);
} finally {
  rmSync(symlinkOutDir, { recursive: true, force: true });
}

const restoredWorkspaceFile = mirror.files.find((file) => file.path === "workspace.json");
const restoredWorkspace = sanitizeWorkspace(JSON.parse(restoredWorkspaceFile.content));
const importedFromMirror = workspaceFromPortableData(mirror);
assert.equal(importedFromMirror.activeSessionId, workspace.activeSessionId);
assert.equal(getActiveSession(importedFromMirror).title, session.title);
const sidecarPoisoned = workspaceFromPortableData({
  ...mirror,
  files: mirror.files.map((file) => file.role === "session-sidecar"
    ? { ...file, content: JSON.stringify({ sessions: [{ title: "Poisoned sidecar" }] }) }
    : file)
});
assert.equal(getActiveSession(sidecarPoisoned).title, session.title);
const restoredMirror = buildMirrorBundle(restoredWorkspace);
assert.deepEqual(
  restoredMirror.files.map((file) => file.path).sort(),
  mirror.files.map((file) => file.path).sort()
);
assert.throws(() => workspaceFromPortableData({
  ...mirror,
  canonical: "sessions/first.md"
}), /canonical/);
assert.throws(() => workspaceFromPortableData({
  ...mirror,
  files: [
    ...mirror.files,
    { ...restoredWorkspaceFile, path: "backup-workspace.json" }
  ]
}), /exactly one/);
assert.throws(() => workspaceFromPortableData({
  ...mirror,
  files: mirror.files.map((file) => file.path === "workspace.json"
    ? { ...file, content: "not json" }
    : file)
}), /not valid JSON/);

const collisionWorkspace = sanitizeWorkspace({
  ...workspace,
  activeSessionId: "same_a",
  sessions: [
    createSession({ id: "same_a", title: "Algebra" }, workspace.clientId),
    createSession({ id: "same_b", title: "algebra" }, workspace.clientId),
    createSession({ id: "reserved_con", title: "CON" }, workspace.clientId)
  ]
});
const collisionBundle = buildMirrorBundle(collisionWorkspace);
const markdownPaths = collisionBundle.files.filter((file) => file.path.endsWith(".md")).map((file) => file.path);
assert.equal(new Set(markdownPaths).size, markdownPaths.length);
assert.equal(markdownPaths.some((path) => /topic-con/.test(path)), true);

workspace = promoteCapture(workspace, session.id, session.captures[0].id);
session = getActiveSession(workspace);
assert.equal(session.reviewCards.length, 1);

let cleanupWorkspace = addCapture(workspace, session.id, {
  quote: "Temporary capture for cleanup.",
  thought: "This should be removable."
}, { promoteToReview: true });
let cleanupSession = getActiveSession(cleanupWorkspace);
const cleanupCaptureId = cleanupSession.captures[0].id;
const cleanupCardId = cleanupSession.reviewCards[0].id;
cleanupWorkspace = deleteReviewCard(cleanupWorkspace, cleanupSession.id, cleanupCardId);
cleanupSession = getActiveSession(cleanupWorkspace);
assert.equal(cleanupSession.reviewCards.some((card) => card.id === cleanupCardId), false);
assert.equal(cleanupSession.captures.find((capture) => capture.id === cleanupCaptureId).promotedToReview, false);
cleanupWorkspace = promoteCapture(cleanupWorkspace, cleanupSession.id, cleanupCaptureId);
cleanupSession = getActiveSession(cleanupWorkspace);
assert.equal(cleanupSession.reviewCards.some((card) => card.sourceCaptureId === cleanupCaptureId), true);
cleanupWorkspace = deleteCapture(cleanupWorkspace, cleanupSession.id, cleanupCaptureId);
cleanupSession = getActiveSession(cleanupWorkspace);
assert.equal(cleanupSession.captures.some((capture) => capture.id === cleanupCaptureId), false);
assert.equal(cleanupSession.reviewCards.some((card) => card.sourceCaptureId === cleanupCaptureId), false);

workspace = gradeCard(workspace, session.id, session.reviewCards[0].id, "good");
session = getActiveSession(workspace);
assert.equal(session.reviewCards[0].strength, 1);
assert.equal(getDueReviewCards(session).length, 0);
assert.equal(reviewIntervalDays(0), 0);
assert.equal(reviewIntervalDays(2), 3);
assert.equal(reviewIntervalDays(5), 30);

const now = new Date("2026-05-29T00:00:00.000Z");
const failed = applyGrade({ ...session.reviewCards[0], strength: 1 }, "again", now);
const passed = applyGrade({ ...session.reviewCards[0], strength: 1 }, "good", now);
assert.equal(failed.strength, 0);
assert.equal(passed.strength, 2);
assert.ok(new Date(failed.dueAt).getTime() < new Date(passed.dueAt).getTime());

const filtered = filterSessions(workspace, "ownership");
assert.equal(filtered.length, 1);
const captureSearch = searchWorkspace(workspace, "lifetime", 5);
assert.equal(captureSearch[0].type, "capture");
assert.equal(captureSearch[0].sessionId, session.id);
assert.equal(captureSearch[0].targetId, session.captures[0].id);
assert.match(captureSearch[0].excerpt, /lifetime/);
const sourceSearch = searchWorkspace(workspace, "RustConf", 5);
assert.equal(sourceSearch.some((result) => result.type === "session" && result.matchLabel === "Source"), true);
const reviewSearch = searchWorkspace(workspace, "garbage collector", 5);
assert.equal(reviewSearch.some((result) => result.type === "review" && result.targetId === session.reviewCards[0].id), true);
workspace = updateSession(workspace, session.id, {
  notesMarkdown: `${session.notesMarkdown}\n\nRemember the borrow checker comparison.`
});
session = getActiveSession(workspace);
const noteSearch = searchWorkspace(workspace, "borrow checker", 5);
assert.equal(noteSearch.some((result) => result.type === "note" && result.sessionId === session.id), true);
const cappedSearch = searchWorkspace(workspace, `${"x".repeat(MAX_SEARCH_QUERY_LENGTH + 50)}lifetime`, 5);
assert.equal(cappedSearch.length, 0);

const sanitized = sanitizeWorkspace(JSON.parse(JSON.stringify(workspace)));
assert.equal(sanitized.activeSessionId, workspace.activeSessionId);
assert.equal(sanitized.schemaVersion, WORKSPACE_SCHEMA_VERSION);

const legacyWorkspace = sanitizeWorkspace({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  version: WORKSPACE_SCHEMA_VERSION,
  clientId: "client_legacy",
  activeSessionId: "legacy_session",
  sessions: [{
    id: "legacy_session",
    originClientId: "client_legacy",
    title: "Legacy source",
    sourceTitle: "Legacy doc",
    sourceUrl: "https://example.com/legacy",
    materialType: "doc",
    tags: [],
    focusMode: "capture",
    notesMarkdown: "",
    captures: [{
      id: "legacy_capture",
      originClientId: "client_legacy",
      quote: "Old capture",
      thought: "",
      timestamp: "",
      tags: [],
      createdAt: "2026-05-29T00:00:00.000Z",
      capturedAt: "2026-05-29T00:00:00.000Z",
      updatedAt: "2026-05-29T00:00:00.000Z",
      promotedToReview: false
    }],
    reviewCards: [],
    createdAt: "2026-05-29T00:00:00.000Z",
    updatedAt: "2026-05-29T00:00:00.000Z"
  }],
  createdAt: "2026-05-29T00:00:00.000Z",
  updatedAt: "2026-05-29T00:00:00.000Z"
});
const legacyCapture = getActiveSession(legacyWorkspace).captures[0];
assert.equal(legacyCapture.sourceTitle, "Legacy doc");
assert.equal(legacyCapture.sourceUrl, "https://example.com/legacy");
assert.equal(legacyCapture.materialType, "doc");
assert.equal(legacyCapture.sourceProvenance, "inherited");

const roundTrip = sanitizeWorkspace(JSON.parse(JSON.stringify(sanitized)));
assert.equal(roundTrip.clientId, workspace.clientId);
assert.equal(getActiveSession(roundTrip).reviewCards.length, 1);

assert.throws(() => sanitizeWorkspace({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION + 1,
  version: WORKSPACE_SCHEMA_VERSION + 1,
  sessions: []
}), /Unsupported workspace version/);

console.log("smoke_web_ok");

function listZipFileNames(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const decoder = new TextDecoder();
  let endOffset = -1;
  for (let offset = data.length - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  assert.notEqual(endOffset, -1);
  const entryCount = view.getUint16(endOffset + 10, true);
  let offset = view.getUint32(endOffset + 16, true);
  const names = [];
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(view.getUint32(offset, true), 0x02014b50);
    assert.equal((view.getUint16(offset + 8, true) & 0x0800) > 0, true);
    assert.equal(view.getUint16(offset + 10, true), 0);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    names.push(decoder.decode(data.slice(offset + 46, offset + 46 + nameLength)));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}
