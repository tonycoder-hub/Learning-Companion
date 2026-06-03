import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
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
  buildReturnBaseFingerprint,
  buildResumeSource,
  buildSourceJumpUrl,
  buildTodayPack,
  captureDraftStatusText,
  captureHasReviewReadyAnswer,
  captureHasOpenQuestion,
  captureHasParkedQuestion,
  captureHasQuestion,
  captureHasResolvedQuestion,
  cleanText,
  cleanUrl,
  createDefaultWorkspace,
  createSession,
  deleteCapture,
  deleteReviewCard,
  extractSourceTimestamp,
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
  getAnswerCaptureItems,
  getRecentCaptureItems,
  getSynthesisStats,
  getSynthesisSourceStamp,
  getDueReviewCards,
  getDueReviewItems,
  getParkedQuestionItems,
  getResolvedQuestionItems,
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
  refreshAnsweredQuestionReviewCard,
  resolveCaptureDraftFocusOverride,
  resolveTodayWindow,
  reviewIntervalDays,
  safeHref,
  sanitizeWorkspace,
  searchWorkspace,
  secondsToTimestamp,
  setCaptureQuestionParked,
  setCaptureQuestionResolved,
  stripSourceTimestamp,
  timestampToSeconds,
  updateCaptureThought,
  updateSession,
  workspaceBackupFingerprint,
  workspaceFingerprint,
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

const tempBase = resolve(".codex-tmp/smoke-web");
mkdirSync(tempBase, { recursive: true, mode: 0o700 });
const cleanupSmokeArtifacts = process.env.LC_CLEAN_SMOKE_ARTIFACTS === "1";

const manifest = JSON.parse(readFileSync("apps/companion-web/manifest.webmanifest", "utf8"));
const indexHtml = readFileSync("apps/companion-web/index.html", "utf8");
const appJs = readFileSync("apps/companion-web/src/app.js", "utf8");
const markdownJs = readFileSync("apps/companion-web/src/markdown.js", "utf8");
const appCss = readFileSync("apps/companion-web/styles.css", "utf8");
const serviceWorker = readFileSync("apps/companion-web/service-worker.js", "utf8");
assert.equal(manifest.display, "standalone");
assert.equal(manifest.start_url, "./");
assert.equal(manifest.icons[0].src, "./assets/icon.svg");
assert.match(indexHtml, /Capture \(Cmd\/Ctrl\+Enter\)/);
assert.match(indexHtml, /Cmd\/Ctrl\+Shift\+Enter/);
assert.match(indexHtml, /role="combobox"/);
assert.match(indexHtml, /aria-controls="searchResults"/);
assert.match(indexHtml, /role="listbox"/);
assert.match(indexHtml, /id="sidecarRail" class="sidecar-rail" aria-label="Sidecar study rail" aria-live="off"/);
assert.match(indexHtml, /id="updateNotice" class="storage-notice update-notice" hidden/);
assert.match(indexHtml, /id="updateReloadBtn" class="mini-button" type="button">Reload/);
assert.match(appJs, /ArrowDown/);
assert.match(appJs, /aria-activedescendant/);
assert.match(appJs, /event\.isComposing/);
assert.match(appJs, /searchResultsCollapsed/);
assert.match(appJs, /scrollIntoView\(\{ block: "nearest" \}\)/);
assert.match(appJs, /openSearchResult\(results\[Math\.max\(0, activeSearchIndex\)\]\)/);
assert.match(appJs, /UI_PREFS_SCHEMA_VERSION = 3/);
assert.match(appJs, /workspaceBackupFingerprint/);
assert.match(appJs, /workspaceStorageNotice/);
assert.match(appJs, /mirrorHandoff/);
assert.match(appJs, /buildReturnBaseFingerprint\(workspace\)/);
assert.match(appJs, /No mirror exported yet/);
assert.match(appJs, /Mirror current/);
assert.match(appJs, /Mac changed since mirror export/);
assert.match(appJs, /Last return imported/);
assert.match(appJs, /showSaveFilePicker/);
assert.match(appJs, /messageHandlers\?\.learningCompanion/);
assert.match(appJs, /completeSaveRequest/);
assert.match(appJs, /shouldUseFallbackDownload/);
assert.match(appJs, /__LC_ALLOW_AUTOMATED_DOWNLOADS__/);
assert.match(appJs, /if \(!shouldUseFallbackDownload\(\)\) \{[\s\S]+downloadBlob\(filename, blob\);/);
assert.match(appJs, /Backup export requested - verify the exported file/);
assert.match(appJs, /Backup saved - verify the selected file/);
assert.match(appJs, /openFocusBriefWarning/);
assert.match(appJs, /answerQuestionFromToday/);
assert.match(appJs, /Finish current draft before answering/);
assert.match(appJs, /Answer draft resumed/);
assert.match(appJs, /focusCaptureDraftContinuation/);
assert.match(appJs, /answerDraftBlocksQuestion/);
assert.match(appJs, /Time kept @/);
assert.match(appJs, /todayDraftSourceMeta/);
assert.match(appJs, /todayDraftSourceDetail/);
assert.match(appJs, /Draft began on/);
assert.match(appJs, /redundantKinds = \["capture", "continue"\]/);
assert.match(appJs, /data-today-section/);
assert.match(appJs, /captureContextOpenLabel/);
assert.match(appJs, /captureIsQuoteOnly/);
assert.match(appJs, /Highlight saved/);
assert.match(appJs, /source page is unchanged/);
assert.match(appJs, /targetPane: "highlightAnnotation"/);
assert.match(appJs, /activityTargetsHighlightAnnotation/);
assert.match(appJs, /Add thought to saved highlight/);
assert.match(appJs, /Highlight already has a thought/);
assert.match(appJs, /updateCaptureThought/);
assert.match(appJs, /Add why this highlight matters/);
assert.match(appJs, /Update note/);
assert.match(appJs, /Capture note updated/);
assert.match(appJs, /targetPane: "notes"/);
assert.match(appJs, /View note/);
assert.match(appJs, /target\?\.focus\(\{ preventScroll: true \}\)/);
assert.match(appJs, /targetPane: "quickCapture"/);
assert.match(appJs, /installShellCompatibilityNodes/);
assert.match(appJs, /watchServiceWorkerUpdate/);
assert.match(appJs, /updateNoticeShown/);
assert.match(appJs, /dom\.updateReloadBtn\.disabled = true/);
assert.match(appJs, /registration\.waiting/);
assert.match(appJs, /controllerchange/);
assert.match(appJs, /App update ready - reload to use the newest Learning Flow\./);
assert.match(appJs, /staysInSidecar/);
assert.match(appJs, /activityStaysInSidecar/);
assert.match(appJs, /activityTargetsQuickCapture/);
assert.match(appJs, /Focus Quick Capture/);
assert.match(appCss, /\.highlight-annotation-form/);
assert.match(appCss, /\.capture-note-chip/);
assert.match(appCss, /\.notes-preview \.note-capture-block/);
assert.match(markdownJs, /noteCaptureId/);
assert.match(markdownJs, /learning-companion:capture:/);
assert.match(markdownJs, /CAPTURE_MARKER_PATTERN/);
assert.match(markdownJs, /findValidCaptureMarkerLines/);
assert.match(markdownJs, /aria-label", "Generated capture note"/);
assert.match(markdownJs, /tabIndex = -1/);
assert.match(appJs, /resumeCurrentSource/);
assert.match(appJs, /handleCaptureContextSourceAction/);
assert.match(appJs, /promptForSource/);
assert.match(appJs, /Resume @/);
assert.match(appJs, /Set source URL/);
assert.match(indexHtml, /data-capture-starter="question"/);
assert.match(indexHtml, /Cmd\/Ctrl\+Shift\+1/);
assert.match(indexHtml, /Cmd\/Ctrl\+Shift\+2/);
assert.match(indexHtml, /Cmd\/Ctrl\+Shift\+3/);
assert.match(appJs, /applyCaptureStarter/);
assert.match(appJs, /handleCaptureStarterShortcut/);
assert.match(appJs, /isEditableTarget\(event\.target\)/);
assert.match(appJs, /targetPane: "quickCapture"/);
assert.match(appJs, /never commit a capture\/card/);
assert.match(appJs, /renderCaptureStarters/);
assert.match(appJs, /captureSaveActivity/);
assert.match(appJs, /targetSection: "open_questions"/);
assert.match(appJs, /targetSection: linked \? "closed_questions" : "answers_today"/);
assert.match(appJs, /Saved in Answers Today\. It did not close a question because no question was linked\./);
assert.match(appJs, /Turn it into a card if it needs recall/);
assert.match(appJs, /Question draft still needs a body/);
const captureSaveActivityBody = appJs.match(/function captureSaveActivity[\s\S]*?\n}\n\nfunction captureSaveToast/)?.[0] || "";
assert.equal((captureSaveActivityBody.match(/actionLabel:/g) || []).length, 8);
assert.match(appJs, /renderTodaySectionMap/);
assert.match(appJs, /renderLearningFlowPanel/);
assert.match(appJs, /resolveSourceSessionState/);
assert.match(appJs, /resumeSourceFromLearningFlow/);
assert.match(appJs, /renderSidecarRail/);
assert.match(appJs, /dataset\.sidecarRailStep/);
assert.match(appJs, /openTodayFromSidecar/);
assert.match(appJs, /dataset\.learningFlowStep = step\.kind/);
assert.match(appJs, /classList\.add\("is-wide"\)/);
assert.match(appJs, /actionAriaLabel/);
assert.match(appJs, /Read source/);
assert.match(appJs, /Needs source/);
assert.match(appJs, /renderReturnedWorkNudge/);
assert.match(appJs, /Returned from phone\/Windows/);
assert.match(appJs, /returnReceiptNewWork/);
assert.match(appJs, /dismissedReturnNudgeKey/);
assert.match(appJs, /returnedWorkAction/);
assert.match(appJs, /returnedWorkTertiary/);
assert.match(appJs, /Review status/);
assert.match(appJs, /openReturnedReviewStatus/);
assert.match(appJs, /no cards are due right now/);
assert.match(appJs, /returnedInboxAnsweredQuestions/);
assert.match(appJs, /returnedInboxRefreshableReviewCards/);
assert.match(appJs, /returnedAnswerFollowup/);
assert.match(appJs, /Refresh cards/);
assert.match(appJs, /View closed questions/);
assert.match(appJs, /Returned review-progress events stay higher priority/);
assert.match(appJs, /seedFirstQuestionDraft/);
assert.match(appJs, /todayMapTarget/);
assert.match(appJs, /older return file/);
assert.match(appJs, /re-export mirror/);
assert.match(appJs, /signal-button/);
assert.match(appJs, /const scrollTarget = section \|\| dom\.todayList/);
assert.match(appJs, /shouldCompressSidecarFocusBrief/);
assert.match(appJs, /is-sidecar-redundant/);
assert.match(appCss, /\.today-map-button/);
assert.match(appCss, /\.learning-flow-panel/);
assert.match(appCss, /\.learning-flow-step\.is-wide/);
assert.match(appCss, /\.learning-flow-step\.is-source/);
assert.match(appCss, /\.sidecar-rail/);
assert.match(appCss, /\.sidecar-rail-button/);
assert.match(appCss, /\.app-shell\.sidecar-layout \.metrics-row/);
assert.match(appCss, /\.app-shell\.sidecar-layout \.focus-brief/);
assert.match(appCss, /\.app-shell\.sidecar-layout \.focus-brief\.is-sidecar-redundant/);
assert.match(appCss, /\.app-shell\.sidecar-layout \.focus-brief-facts/);
assert.match(appCss, /\.returned-work-card/);
assert.match(appCss, /\.manual-transfer-badge/);
assert.match(appCss, /\.device-flow-badges/);
assert.match(appCss, /\.handoff-state-grid/);
assert.match(appCss, /\.today-detail-drawer/);
assert.match(appCss, /\.today-detail-badge/);
assert.match(appCss, /\.storage-notice\.update-notice/);
assert.match(appCss, /prefers-reduced-motion: reduce/);
assert.match(serviceWorker, /CACHE_NAME/);
assert.match(serviceWorker, /learning-companion-static-v5/);
assert.match(serviceWorker, /STATIC_ASSETS/);
assert.match(serviceWorker, /src\/app\.js/);
assert.match(serviceWorker, /await fetch\(request\)/);
assert.match(serviceWorker, /cache\.match\(request\)/);
assert.match(serviceWorker, /name\.startsWith\("learning-companion-static-"\) && name !== CACHE_NAME/);

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
  sourceTitle: "  Source doc ",
  sourceUrl: " https://example.com/lesson ",
  answersQuestionCaptureId: "capture_answer_target",
  updatedAt: "2026-05-29T00:01:00.000Z"
});
assert.deepEqual(normalizedDraft, {
  quote: "Draft quote",
  thought: "Draft thought",
  timestamp: "08:12",
  sourceTitle: "Source doc",
  sourceUrl: "https://example.com/lesson",
  answersQuestionCaptureId: "capture_answer_target",
  updatedAt: "2026-05-29T00:01:00.000Z"
});
assert.equal(hasCaptureDraft(normalizedDraft), true);
assert.equal(hasCaptureTextDraft(normalizedDraft), true);
assert.equal(captureDraftStatusText(normalizedDraft), "Draft saved");
assert.equal(captureDraftStatusText(normalizeCaptureDraft({ timestamp: "01:23" })), "Time kept");
assert.equal(captureDraftStatusText(normalizeCaptureDraft({})), "No draft");
assert.match(normalizeCaptureDraft({ quote: "\u0000safe" }).quote, /^safe$/);
assert.deepEqual(
  {
    sourceTitle: normalizeCaptureDraft({ quote: "legacy draft" }).sourceTitle,
    sourceUrl: normalizeCaptureDraft({ quote: "legacy draft" }).sourceUrl
  },
  { sourceTitle: "", sourceUrl: "" }
);
assert.equal(normalizeCaptureDraft({ sourceTitle: "\u0000 Source\nTitle " }).sourceTitle, "Source Title");
assert.equal(normalizeCaptureDraft({ sourceUrl: ` ${"x".repeat(2200)} ` }).sourceUrl.length, 2048);
assert.equal(normalizeCaptureDraft({ answersQuestionCaptureId: "bad answer target!" }).answersQuestionCaptureId, "");
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
assert.equal(buildSourceJumpUrl("https://youtu.be/rust123", "1m30s"), "https://youtu.be/rust123?t=90s");
assert.equal(buildSourceJumpUrl("https://www.bilibili.com/video/BV123/?p=2", "01:30"), "https://www.bilibili.com/video/BV123/?p=2&t=90");
assert.equal(buildSourceJumpUrl("https://m.bilibili.com/video/BV123/?p=2", "01:30"), "https://m.bilibili.com/video/BV123/?p=2&t=90");
assert.equal(buildSourceJumpUrl("https://vimeo.com/123456789?h=abc", "01:30"), "https://vimeo.com/123456789?h=abc#t=1m30s");
assert.equal(buildSourceJumpUrl("https://vimeo.com/123456789?h=abc#autoplay=1", "01:30"), "https://vimeo.com/123456789?h=abc#autoplay=1&t=1m30s");
assert.equal(buildSourceJumpUrl("https://vimeo.com/123456789#chapter-one", "01:30"), "https://vimeo.com/123456789#chapter-one");
assert.equal(timestampToSeconds("abc"), null);
assert.equal(timestampToSeconds("1:2:3:4"), null);
assert.equal(timestampToSeconds("1hxm"), null);
assert.equal(timestampToSeconds("1m30s"), 90);
assert.equal(timestampToSeconds("1h02m03s"), 3723);
assert.equal(secondsToTimestamp(90), "01:30");
assert.equal(secondsToTimestamp(3601), "1:00:01");
assert.equal(extractSourceTimestamp("https://youtu.be/rust123?t=1m30s"), "01:30");
assert.equal(extractSourceTimestamp("https://youtu.be/rust123?t=90"), "01:30");
assert.equal(extractSourceTimestamp("https://youtu.be/rust123?t=1m30s&start=492&time_continue=3723"), "01:30");
assert.equal(extractSourceTimestamp("https://www.youtube.com/watch?v=rust123&start=492"), "08:12");
assert.equal(extractSourceTimestamp("https://www.youtube.com/watch?v=rust123&time_continue=3723"), "1:02:03");
assert.equal(extractSourceTimestamp("https://www.bilibili.com/video/BV123/?p=2&t=90"), "01:30");
assert.equal(extractSourceTimestamp("https://m.bilibili.com/video/BV123/?p=2&t=90"), "01:30");
assert.equal(extractSourceTimestamp("https://b23.tv/abc?t=90"), "");
assert.equal(extractSourceTimestamp("https://vimeo.com/123456789?h=abc#t=1m30s"), "01:30");
assert.equal(extractSourceTimestamp("https://player.vimeo.com/video/123456789#t=90s&autoplay=1"), "01:30");
assert.equal(extractSourceTimestamp("https://example.com/video?t=1m30s"), "");
assert.equal(stripSourceTimestamp("https://youtu.be/rust123?t=1m30s"), "https://youtu.be/rust123");
assert.equal(stripSourceTimestamp("https://www.youtube.com/watch?v=rust123&start=492"), "https://www.youtube.com/watch?v=rust123");
assert.equal(
  stripSourceTimestamp("https://www.youtube.com/watch?v=rust123&list=PL1&index=2&t=90#notes"),
  "https://www.youtube.com/watch?v=rust123&list=PL1&index=2#notes"
);
assert.equal(stripSourceTimestamp("https://www.bilibili.com/video/BV123/?p=2&t=90"), "https://www.bilibili.com/video/BV123/?p=2");
assert.equal(stripSourceTimestamp("https://vimeo.com/123456789?h=abc#t=1m30s"), "https://vimeo.com/123456789?h=abc");
assert.equal(stripSourceTimestamp("https://vimeo.com/123456789?h=abc#t=1m30s&autoplay=1"), "https://vimeo.com/123456789?h=abc#autoplay=1");
assert.equal(stripSourceTimestamp("https://vimeo.com/123456789#chapter-one"), "https://vimeo.com/123456789#chapter-one");
assert.equal(stripSourceTimestamp("https://example.com/video?t=1m30s"), "https://example.com/video?t=1m30s");

let highlightWorkspace = createDefaultWorkspace();
highlightWorkspace = addCapture(highlightWorkspace, getActiveSession(highlightWorkspace).id, {
  id: "capture_quote_only_annotation",
  quote: "A quote-only highlight should stay as one capture.",
  thought: "",
  timestamp: "02:10"
}, { now: "2026-05-29T00:04:00.000Z" });
const highlightSession = getActiveSession(highlightWorkspace);
highlightWorkspace = updateCaptureThought(
  highlightWorkspace,
  highlightSession.id,
  "capture_quote_only_annotation",
  "This explains why annotation must be in-place.",
  { now: "2026-05-29T00:05:00.000Z" }
);
const annotatedHighlight = getActiveSession(highlightWorkspace).captures[0];
assert.equal(getActiveSession(highlightWorkspace).captures.length, 1);
assert.equal(annotatedHighlight.thought, "This explains why annotation must be in-place.");
assert.equal(annotatedHighlight.quote, "A quote-only highlight should stay as one capture.");
assert.equal(annotatedHighlight.updatedAt, "2026-05-29T00:05:00.000Z");
assert.equal(updateCaptureThought(highlightWorkspace, highlightSession.id, annotatedHighlight.id, ""), highlightWorkspace);
assert.equal(updateCaptureThought(highlightWorkspace, highlightSession.id, annotatedHighlight.id, "   "), highlightWorkspace);

let promotedHighlightWorkspace = createDefaultWorkspace();
promotedHighlightWorkspace = addCapture(promotedHighlightWorkspace, getActiveSession(promotedHighlightWorkspace).id, {
  id: "capture_promoted_quote_only_annotation",
  quote: "A promoted quote-only highlight should keep its linked card useful.",
  thought: ""
}, { promoteToReview: true, now: "2026-05-29T00:06:00.000Z" });
const promotedHighlightSession = getActiveSession(promotedHighlightWorkspace);
assert.match(promotedHighlightSession.reviewCards[0].prompt, /^Explain this excerpt:/);
promotedHighlightWorkspace = updateCaptureThought(
  promotedHighlightWorkspace,
  promotedHighlightSession.id,
  "capture_promoted_quote_only_annotation",
  "Use the annotation as the recall prompt.",
  { now: "2026-05-29T00:07:00.000Z" }
);
const refreshedPromotedHighlight = getActiveSession(promotedHighlightWorkspace);
assert.equal(refreshedPromotedHighlight.captures.length, 1);
assert.equal(refreshedPromotedHighlight.reviewCards.length, 1);
assert.equal(refreshedPromotedHighlight.reviewCards[0].prompt, "Recall the point behind: Use the annotation as the recall prompt.");
const editedPromptWorkspace = {
  ...promotedHighlightWorkspace,
  sessions: promotedHighlightWorkspace.sessions.map((item) => item.id === promotedHighlightSession.id
    ? {
        ...item,
        reviewCards: item.reviewCards.map((card) => ({
          ...card,
          prompt: "Custom learner prompt should survive annotation."
        }))
      }
    : item)
};
const preservedPromptWorkspace = updateCaptureThought(
  editedPromptWorkspace,
  promotedHighlightSession.id,
  "capture_promoted_quote_only_annotation",
  "A later annotation should not overwrite custom prompts.",
  { now: "2026-05-29T00:08:00.000Z" }
);
assert.equal(getActiveSession(preservedPromptWorkspace).reviewCards[0].prompt, "Custom learner prompt should survive annotation.");

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
assert.equal(inboxResult.receipt.answeredQuestions, 0);
assert.equal(inboxResult.receipt.skippedAnswerTargets, 0);
assert.equal(inboxResult.receipt.sourceWorkspaceFingerprint, "fnv1a-test");
assert.equal(inboxResult.receipt.currentWorkspaceFingerprint, `fnv1a-${workspaceFingerprint(JSON.stringify(sanitizeWorkspace(workspace), null, 2))}`);
assert.equal(inboxResult.receipt.sourceFingerprintBasis, "workspace");
assert.equal(inboxResult.receipt.sourceFingerprintMatches, false);
assert.equal(importedInboxCapture.sourceProvenance, "inbox");
assert.equal(importedInboxCapture.sourceUrl, "");
assert.equal(importedInboxCapture.inboxCaptureId, "inbox_capture_001");
assert.equal(inboxResult.workspace.importedPatches.includes("patch_mobile_001"), true);
const matchingInboxFingerprint = `fnv1a-${workspaceFingerprint(JSON.stringify(sanitizeWorkspace(workspace), null, 2))}`;
const matchingInboxResult = applyMobileInboxPatch(workspace, {
  ...inboxPatch,
  patchId: "patch_mobile_matching_base",
  source: { ...inboxPatch.source, workspaceFingerprint: matchingInboxFingerprint },
  captures: []
});
assert.equal(matchingInboxResult.receipt.sourceFingerprintMatches, true);
const matchingInboxReturnBaseFingerprint = buildReturnBaseFingerprint(workspace);
const matchingInboxReturnBaseResult = applyMobileInboxPatch(workspace, {
  ...inboxPatch,
  patchId: "patch_mobile_matching_return_base",
  source: { ...inboxPatch.source, returnBaseFingerprint: matchingInboxReturnBaseFingerprint },
  captures: []
});
assert.equal(matchingInboxReturnBaseResult.receipt.sourceReturnBaseFingerprint, matchingInboxReturnBaseFingerprint);
assert.equal(matchingInboxReturnBaseResult.receipt.currentReturnBaseFingerprint, matchingInboxReturnBaseFingerprint);
assert.equal(matchingInboxReturnBaseResult.receipt.sourceFingerprintBasis, "return-base");
assert.notEqual(matchingInboxReturnBaseResult.receipt.sourceFingerprintBasis, "workspace");
assert.ok(matchingInboxReturnBaseResult.receipt.sourceWorkspaceFingerprint);
assert.equal(matchingInboxReturnBaseResult.receipt.sourceFingerprintMatches, true);
const unrelatedMacCaptureWorkspace = addCapture(workspace, session.id, {
  quote: "Unrelated Mac capture after mirror export.",
  thought: "This should not stale the phone return base.",
  timestamp: "09:30"
});
const unrelatedMacCaptureReturnResult = applyMobileInboxPatch(unrelatedMacCaptureWorkspace, {
  ...inboxPatch,
  patchId: "patch_mobile_unrelated_mac_capture",
  source: { ...inboxPatch.source, returnBaseFingerprint: matchingInboxReturnBaseFingerprint },
  captures: []
});
assert.equal(unrelatedMacCaptureReturnResult.receipt.sourceFingerprintMatches, true);
const legacyInboxResult = applyMobileInboxPatch(workspace, {
  ...inboxPatch,
  patchId: "patch_mobile_legacy_base",
  source: { generatedBy: "inbox.html", topicId: session.id, topicTitle: session.title },
  captures: []
});
assert.equal(legacyInboxResult.receipt.sourceWorkspaceFingerprint, "");
assert.equal(legacyInboxResult.receipt.sourceFingerprintMatches, null);
const duplicateInboxResult = applyMobileInboxPatch(inboxResult.workspace, inboxPatch);
assert.equal(duplicateInboxResult.receipt.targetResolution, "duplicate-patch");
assert.equal(duplicateInboxResult.receipt.added, 0);
assert.equal(duplicateInboxResult.receipt.sourceFingerprintMatches, false);
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

const focusNow = new Date("2026-05-29T00:20:00.000Z");
const questionSession = createSession({
  title: "Question parking",
  sourceUrl: "https://example.com/questions",
  captures: [{
    id: "question_capture",
    thought: "Why does ownership make aliasing safe？",
    quote: "Ownership constrains mutable aliases.",
    capturedAt: "2026-05-29T00:18:00.000Z"
  }],
  reviewCards: []
}, workspace.clientId);
const questionBrief = buildFocusBrief(questionSession, null, focusNow);
assert.equal(captureHasQuestion(questionSession.captures[0]), true);
assert.equal(captureHasOpenQuestion(questionSession.captures[0]), true);
assert.equal(getSynthesisStats(questionSession).questions, 1);
assert.equal(questionBrief.stats.questions, 1);
assert.equal(questionBrief.warnings.some((warning) => warning.kind === "open_questions"), true);
const questionWarning = questionBrief.warnings.find((warning) => warning.kind === "open_questions");
assert.equal(questionWarning.actionLabel, "Open questions");
assert.equal(questionWarning.targetTab, "today");
assert.equal(questionWarning.targetSection, "open_questions");
assert.match(generateSynthesisDraft(questionSession), /Why does ownership make aliasing safe？/);

const questionReviewSession = createSession({
  ...questionSession,
  reviewCards: [{
    id: "question_due_card",
    prompt: "Recall the open question context.",
    answer: "Use the captured question as evidence.",
    sourceCaptureId: "question_capture",
    dueAt: "2026-05-29T00:19:00.000Z",
    strength: 0,
    createdAt: "2026-05-29T00:19:00.000Z",
    updatedAt: "2026-05-29T00:19:00.000Z"
  }]
}, workspace.clientId);
const questionReviewBrief = buildFocusBrief(questionReviewSession, {
  ...workspace,
  activeSessionId: questionReviewSession.id,
  sessions: [questionReviewSession]
}, focusNow);
const questionReviewWarning = questionReviewBrief.warnings.find((warning) => warning.kind === "open_questions");
assert.equal(questionReviewBrief.nextAction.kind, "review");
assert.equal(questionReviewBrief.nextAction.reason, "Active topic has due review due now.");
assert.equal(questionReviewWarning.targetTab, "today");
assert.equal(questionReviewWarning.targetSection, "open_questions");

let questionLifecycleWorkspace = sanitizeWorkspace({
  ...createDefaultWorkspace(),
  activeSessionId: questionSession.id,
  sessions: [questionSession]
});
const questionCaptureId = questionSession.captures[0].id;
const questionReturnBaseFingerprint = buildReturnBaseFingerprint(questionLifecycleWorkspace);
assert.equal(buildReturnBaseFingerprint(questionLifecycleWorkspace), questionReturnBaseFingerprint);
assert.notEqual(buildReturnBaseFingerprint(setCaptureQuestionResolved(
  questionLifecycleWorkspace,
  questionSession.id,
  questionCaptureId,
  true
)), questionReturnBaseFingerprint);
let parkedQuestionWorkspace = setCaptureQuestionParked(
  questionLifecycleWorkspace,
  questionSession.id,
  questionCaptureId
);
let parkedQuestionSession = getActiveSession(parkedQuestionWorkspace);
const parkedQuestionCapture = parkedQuestionSession.captures[0];
assert.match(parkedQuestionCapture.questionParkedAt, /^\d{4}-\d{2}-\d{2}T/);
assert.equal(parkedQuestionCapture.questionResolvedAt, null);
assert.equal(captureHasOpenQuestion(parkedQuestionCapture), false);
assert.equal(captureHasParkedQuestion(parkedQuestionCapture), true);
assert.equal(getParkedQuestionItems(parkedQuestionWorkspace, 10).length, 1);
assert.equal(buildTodayPack(parkedQuestionWorkspace, focusNow).stats.questions, 0);
assert.equal(buildTodayPack(parkedQuestionWorkspace, focusNow).stats.parkedQuestions, 1);
assert.equal(buildTodayPack(parkedQuestionWorkspace, focusNow).questionItems.length, 0);
assert.equal(buildTodayPack(parkedQuestionWorkspace, focusNow).parkedQuestionItems.length, 1);
assert.equal(buildTodayPack(parkedQuestionWorkspace, focusNow).questionHealth.status, "parked_only");
assert.equal(buildTodayPack(parkedQuestionWorkspace, focusNow).questionHealth.unresolvedQuestions, 1);
assert.match(generateTodayMarkdown(parkedQuestionWorkspace, focusNow), /Parked Questions/);
assert.match(generateTodayMarkdown(parkedQuestionWorkspace, focusNow), /Question Queue Health/);
assert.match(generateTodayMarkdown(parkedQuestionWorkspace, focusNow), /Why does ownership make aliasing safe/);
assert.equal(buildFocusBrief(parkedQuestionSession, parkedQuestionWorkspace, focusNow).stats.questions, 0);
assert.equal(buildFocusBrief(parkedQuestionSession, parkedQuestionWorkspace, focusNow).warnings.some((warning) => warning.kind === "open_questions"), false);
const parkedQuestionSynthesisOpenQuestions = generateSynthesisDraft(parkedQuestionSession).split("### Open Questions")[1].split("### Review Targets")[0];
assert.doesNotMatch(parkedQuestionSynthesisOpenQuestions, /Why does ownership make aliasing safe/);
const roundTripParkedWorkspace = workspaceFromPortableData(JSON.parse(JSON.stringify(parkedQuestionWorkspace)));
assert.equal(captureHasParkedQuestion(getActiveSession(roundTripParkedWorkspace).captures[0]), true);
const resolvedFromParkedWorkspace = setCaptureQuestionResolved(
  parkedQuestionWorkspace,
  questionSession.id,
  questionCaptureId,
  true
);
const resolvedFromParkedCapture = getActiveSession(resolvedFromParkedWorkspace).captures[0];
assert.equal(captureHasParkedQuestion(resolvedFromParkedCapture), false);
assert.equal(resolvedFromParkedCapture.questionParkedAt, null);
assert.notEqual(resolvedFromParkedCapture.questionResolvedAt, null);
const reopenedFromParkedCapture = getActiveSession(setCaptureQuestionResolved(
  resolvedFromParkedWorkspace,
  questionSession.id,
  questionCaptureId,
  false
)).captures[0];
assert.equal(captureHasOpenQuestion(reopenedFromParkedCapture), true);
assert.equal(reopenedFromParkedCapture.questionParkedAt, null);
const illegalResolvedParkedWorkspace = workspaceFromPortableData(JSON.parse(JSON.stringify({
  ...parkedQuestionWorkspace,
  sessions: parkedQuestionWorkspace.sessions.map((sessionItem) => ({
    ...sessionItem,
    captures: sessionItem.captures.map((captureItem) => captureItem.id === questionCaptureId
      ? {
          ...captureItem,
          questionResolvedAt: "2026-05-29T00:30:00.000Z",
          questionParkedAt: "2026-05-29T00:29:00.000Z"
        }
      : captureItem)
  }))
})));
const illegalNormalizedCapture = getActiveSession(illegalResolvedParkedWorkspace).captures[0];
assert.equal(illegalNormalizedCapture.questionResolvedAt, "2026-05-29T00:30:00.000Z");
assert.equal(illegalNormalizedCapture.questionParkedAt, null);
assert.equal(setCaptureQuestionParked(
  illegalResolvedParkedWorkspace,
  questionSession.id,
  questionCaptureId,
  true
), illegalResolvedParkedWorkspace);
parkedQuestionWorkspace = setCaptureQuestionParked(
  parkedQuestionWorkspace,
  questionSession.id,
  questionCaptureId,
  false
);
assert.equal(getActiveSession(parkedQuestionWorkspace).captures[0].questionParkedAt, null);
assert.equal(captureHasOpenQuestion(getActiveSession(parkedQuestionWorkspace).captures[0]), true);
const localWeakAnswerWorkspace = addCapture(questionLifecycleWorkspace, questionSession.id, {
  id: "local_weak_answer_capture",
  quote: "Weak answer body.",
  thought: "Answer: ok",
  answersQuestionCaptureId: questionCaptureId
}, { now: "2026-05-29T00:30:30.000Z" });
const localWeakAnswerSession = getActiveSession(localWeakAnswerWorkspace);
assert.equal(localWeakAnswerSession.captures[0].answersQuestionCaptureId, questionCaptureId);
assert.equal(captureHasReviewReadyAnswer(localWeakAnswerSession.captures[0]), false);
assert.equal(captureHasOpenQuestion(localWeakAnswerSession.captures.find((capture) => capture.id === questionCaptureId)), true);
assert.equal(captureHasReviewReadyAnswer({
  thought: "Answer: supercalifragilistic",
  answersQuestionCaptureId: questionCaptureId
}), false);
const localAnswerWorkspace = addCapture(questionLifecycleWorkspace, questionSession.id, {
  id: "local_answer_capture",
  quote: "Ownership makes aliasing safe by enforcing one mutable owner.",
  thought: "Answer: the compiler rejects overlapping mutable aliases before runtime.",
  answersQuestionCaptureId: questionCaptureId
}, { now: "2026-05-29T00:31:30.000Z" });
const localAnswerSession = getActiveSession(localAnswerWorkspace);
const localAnsweredQuestion = localAnswerSession.captures.find((capture) => capture.id === questionCaptureId);
assert.equal(localAnswerSession.captures[0].answersQuestionCaptureId, questionCaptureId);
assert.equal(captureHasReviewReadyAnswer(localAnswerSession.captures[0]), true);
assert.equal(captureHasOpenQuestion(localAnsweredQuestion), false);
assert.equal(captureHasResolvedQuestion(localAnsweredQuestion), true);
assert.equal(localAnsweredQuestion.questionParkedAt, null);
assert.match(localAnsweredQuestion.questionResolvedAt, /^2026-05-29T00:31:30/);
const answerInboxPatch = {
  schema: MOBILE_INBOX_PATCH_SCHEMA,
  appVersion: WORKSPACE_SCHEMA_VERSION,
  patchId: "patch_answer_question_001",
  createdAt: "2026-05-29T00:31:00.000Z",
  source: {
    generatedBy: "inbox.html",
    workspaceFingerprint: "answer-test",
    topicId: questionSession.id,
    topicTitle: questionSession.title
  },
  target: {
    topicId: questionSession.id,
    topicTitle: questionSession.title
  },
  captures: [{
    id: "inbox_answer_capture_001",
    quote: "Ownership makes aliasing safe by enforcing one mutable owner.",
    thought: "Answer: the compiler rejects overlapping mutable aliases before runtime.",
    tags: "answer question",
    answersQuestionCaptureId: questionCaptureId,
    capturedAt: "2026-05-29T00:31:00.000Z"
  }]
};
const answerInboxResult = applyMobileInboxPatch(questionLifecycleWorkspace, answerInboxPatch, new Date("2026-05-29T00:32:00.000Z"));
const answerInboxSession = getActiveSession(answerInboxResult.workspace);
const answeredOriginalQuestion = answerInboxSession.captures.find((capture) => capture.id === questionCaptureId);
const importedAnswerCapture = answerInboxSession.captures.find((capture) => capture.inboxCaptureId === "inbox_answer_capture_001");
assert.equal(answerInboxResult.receipt.answeredQuestions, 1);
assert.equal(answerInboxResult.receipt.refreshableReviewCards, 0);
assert.equal(answerInboxResult.receipt.skippedAnswerTargets, 0);
assert.deepEqual(answerInboxResult.receipt.answerTargetSkips, {
  invalid: 0,
  selfReference: 0,
  patchReference: 0,
  missing: 0,
  nonQuestion: 0,
  alreadyClosed: 0
});
assert.equal(captureHasOpenQuestion(answeredOriginalQuestion), false);
assert.equal(captureHasResolvedQuestion(answeredOriginalQuestion), true);
assert.equal(answeredOriginalQuestion.questionParkedAt, null);
assert.match(answeredOriginalQuestion.questionResolvedAt, /^2026-05-29T00:32:00/);
assert.equal(importedAnswerCapture.answersQuestionCaptureId, questionCaptureId);
const promotedAnsweredQuestionWorkspace = promoteCapture(answerInboxResult.workspace, questionSession.id, questionCaptureId);
const promotedAnsweredQuestionSession = getActiveSession(promotedAnsweredQuestionWorkspace);
const promotedAnsweredQuestionCard = promotedAnsweredQuestionSession.reviewCards[0];
assert.equal(promotedAnsweredQuestionSession.captures.find((capture) => capture.id === questionCaptureId).promotedToReview, true);
assert.equal(promotedAnsweredQuestionCard.sourceCaptureId, questionCaptureId);
assert.equal(promotedAnsweredQuestionCard.evidenceCaptureId, importedAnswerCapture.id);
assert.match(promotedAnsweredQuestionCard.prompt, /Answer the question: Why does ownership make aliasing safe/);
assert.match(promotedAnsweredQuestionCard.answer, /compiler rejects overlapping mutable aliases/);
assert.match(promotedAnsweredQuestionCard.answer, /Evidence: Ownership makes aliasing safe/);
const evidenceDeletedQuestionWorkspace = deleteCapture(
  promotedAnsweredQuestionWorkspace,
  questionSession.id,
  promotedAnsweredQuestionCard.evidenceCaptureId
);
const evidenceDeletedQuestionCard = getActiveSession(evidenceDeletedQuestionWorkspace).reviewCards[0];
assert.equal(evidenceDeletedQuestionCard.sourceCaptureId, questionCaptureId);
assert.equal(evidenceDeletedQuestionCard.evidenceCaptureId, "");
const prePromotedQuestionWorkspace = promoteCapture(questionLifecycleWorkspace, questionSession.id, questionCaptureId);
const prePromotedQuestionCardId = getActiveSession(prePromotedQuestionWorkspace).reviewCards[0].id;
const answeredPrePromotedQuestion = applyMobileInboxPatch(prePromotedQuestionWorkspace, {
  ...answerInboxPatch,
  patchId: "patch_answer_question_pre_promoted",
  captures: [{
    ...answerInboxPatch.captures[0],
    id: "inbox_answer_capture_pre_promoted"
  }]
}, new Date("2026-05-29T00:33:30.000Z"));
assert.equal(answeredPrePromotedQuestion.receipt.answeredQuestions, 1);
assert.equal(answeredPrePromotedQuestion.receipt.refreshableReviewCards, 1);
const prePromotedAnswerCapture = getActiveSession(answeredPrePromotedQuestion.workspace)
  .captures.find((capture) => capture.inboxCaptureId === "inbox_answer_capture_pre_promoted");
const refreshedPrePromotedQuestion = promoteCapture(answeredPrePromotedQuestion.workspace, questionSession.id, questionCaptureId);
const refreshedPrePromotedSession = getActiveSession(refreshedPrePromotedQuestion);
assert.equal(refreshedPrePromotedSession.reviewCards.length, 1);
assert.equal(refreshedPrePromotedSession.reviewCards[0].id, prePromotedQuestionCardId);
assert.doesNotMatch(refreshedPrePromotedSession.reviewCards[0].prompt, /Answer the question:/);
assert.equal(refreshedPrePromotedSession.reviewCards[0].evidenceCaptureId, "");
assert.equal(refreshedPrePromotedSession.captures.find((capture) => capture.id === questionCaptureId).promotedToReview, true);
const answerRefreshedPrePromotedQuestion = refreshAnsweredQuestionReviewCard(
  answeredPrePromotedQuestion.workspace,
  questionSession.id,
  questionCaptureId
);
const answerRefreshedPrePromotedSession = getActiveSession(answerRefreshedPrePromotedQuestion);
assert.equal(answerRefreshedPrePromotedSession.reviewCards.length, 1);
assert.equal(answerRefreshedPrePromotedSession.reviewCards[0].id, prePromotedQuestionCardId);
assert.match(answerRefreshedPrePromotedSession.reviewCards[0].prompt, /Answer the question: Why does ownership make aliasing safe/);
assert.match(answerRefreshedPrePromotedSession.reviewCards[0].answer, /compiler rejects overlapping mutable aliases/);
assert.equal(answerRefreshedPrePromotedSession.reviewCards[0].evidenceCaptureId, prePromotedAnswerCapture.id);
assert.equal(answerRefreshedPrePromotedSession.reviewCards[0].dueAt, getActiveSession(prePromotedQuestionWorkspace).reviewCards[0].dueAt);
const answeredTodayPack = buildTodayPack(answerInboxResult.workspace, new Date("2026-05-29T00:32:30.000Z"), {
  resolvedQuestionLimit: 2
});
assert.equal(answeredTodayPack.stats.resolvedQuestionsToday, 1);
assert.equal(answeredTodayPack.stats.answerCapturesToday, 1);
assert.equal(answeredTodayPack.stats.questionReviewCards, 0);
assert.equal(answeredTodayPack.stats.questionReviewCardsToday, 0);
assert.equal(answeredTodayPack.resolvedQuestionItems.length, 1);
assert.equal(answeredTodayPack.resolvedQuestionItems[0].capture.id, questionCaptureId);
assert.equal(answeredTodayPack.resolvedQuestionItems[0].answerCapture.inboxCaptureId, "inbox_answer_capture_001");
assert.equal(answeredTodayPack.answerItems.length, 1);
assert.equal(answeredTodayPack.answerItems[0].capture.inboxCaptureId, "inbox_answer_capture_001");
assert.equal(answeredTodayPack.answerItems[0].questionCapture.id, questionCaptureId);
assert.equal(answeredTodayPack.questionLoop.resolvedQuestionsToday, 1);
assert.equal(answeredTodayPack.questionLoop.answerLinkedResolvedToday, 1);
assert.equal(answeredTodayPack.questionLoop.questionReviewCards, 0);
assert.equal(answeredTodayPack.questionLoop.questionReviewCardsToday, 0);
assert.equal(answeredTodayPack.questionLoop.targetSection, "closed_questions");
assert.match(answeredTodayPack.questionLoop.todayDetail, /1 answer-linked closure/);
assert.equal(getResolvedQuestionItems(answerInboxResult.workspace, 10, {
  since: new Date("2026-05-29T00:00:00.000Z"),
  until: new Date("2026-05-30T00:00:00.000Z")
}).length, 1);
assert.equal(getAnswerCaptureItems(answerInboxResult.workspace, 10, {
  since: new Date("2026-05-29T00:00:00.000Z"),
  until: new Date("2026-05-30T00:00:00.000Z")
}).length, 1);
const answeredTodayMarkdown = generateTodayMarkdown(answerInboxResult.workspace, new Date("2026-05-29T00:32:30.000Z"));
assert.match(answeredTodayMarkdown, /Closed Today/);
assert.match(answeredTodayMarkdown, /Answers Today/);
assert.match(answeredTodayMarkdown, /answers today/);
assert.match(answeredTodayMarkdown, /1 closed today/);
assert.match(answeredTodayMarkdown, /Why does ownership make aliasing safe/);
assert.match(answeredTodayMarkdown, /Answer: the compiler rejects overlapping mutable aliases before runtime/);
assert.match(answeredTodayMarkdown, /Reason: linked-question/);
assert.match(answeredTodayMarkdown, /Answers: Why does ownership make aliasing safe/);
assert.match(answeredTodayMarkdown, /## Answers Today[\s\S]+## Closed Today/);
assert.doesNotMatch(answeredTodayMarkdown, /Answer: Answer:/);
const reopenedAfterAnswerWorkspace = setCaptureQuestionResolved(
  answerInboxResult.workspace,
  questionSession.id,
  questionCaptureId,
  false
);
const reopenedAfterAnswerPack = buildTodayPack(reopenedAfterAnswerWorkspace, new Date("2026-05-29T00:40:00.000Z"));
assert.equal(reopenedAfterAnswerPack.stats.resolvedQuestionsToday, 0);
assert.equal(reopenedAfterAnswerPack.resolvedQuestionItems.length, 0);
assert.equal(reopenedAfterAnswerPack.stats.questions, 1);
assert.equal(reopenedAfterAnswerPack.questionLoop.activeQuestions, 1);
assert.equal(reopenedAfterAnswerPack.questionLoop.targetSection, "open_questions");
assert.equal(reopenedAfterAnswerPack.questionItems[0].capture.id, questionCaptureId);
const reansweredQuestionResult = applyMobileInboxPatch(reopenedAfterAnswerWorkspace, {
  ...answerInboxPatch,
  patchId: "patch_answer_question_reresolve",
  createdAt: "2026-05-29T14:00:00.000Z",
  captures: [{
    ...answerInboxPatch.captures[0],
    id: "inbox_answer_capture_reresolve",
    capturedAt: "2026-05-29T14:00:00.000Z"
  }]
}, new Date("2026-05-29T14:01:00.000Z"));
const reansweredPack = buildTodayPack(reansweredQuestionResult.workspace, new Date("2026-05-29T14:02:00.000Z"));
assert.equal(reansweredPack.stats.resolvedQuestionsToday, 1);
assert.equal(reansweredPack.resolvedQuestionItems.length, 1);
assert.match(reansweredPack.resolvedQuestionItems[0].capture.questionResolvedAt, /^2026-05-29T14:01:00/);
const answeredQuestionCardFixture = workspaceFromPortableData({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  clientId: "client_answered_question_cards",
  activeSessionId: "answered_card_topic",
  sessions: [{
    id: "answered_card_topic",
    title: "Answered card semantics",
    captures: [{
      id: "q_prefixed_question",
      quote: "",
      thought: "Q: Which invariant survives stale heap entries?",
      tags: ["question"],
      capturedAt: "2099-01-02T10:00:00.000Z",
      createdAt: "2099-01-02T10:00:00.000Z",
      updatedAt: "2099-01-02T10:00:00.000Z",
      questionResolvedAt: "2099-01-02T12:10:00.000Z"
    }, {
      id: "answer_captured_earlier",
      quote: "Stale heap entries are ignored when popped.",
      thought: "Answer: discard entries whose distance no longer matches the best-known distance.",
      answersQuestionCaptureId: "q_prefixed_question",
      capturedAt: "2099-01-02T11:00:00.000Z",
      createdAt: "2099-01-02T13:00:00.000Z",
      updatedAt: "2099-01-02T13:00:00.000Z"
    }, {
      id: "answer_created_only",
      quote: "Final invariant: distances are only committed when popped fresh.",
      thought: "",
      answersQuestionCaptureId: "q_prefixed_question",
      createdAt: "2099-01-02T12:00:00.000Z",
      updatedAt: "2099-01-02T12:00:00.000Z"
    }, {
      id: "answer_weak_latest",
      thought: "Answer: ok",
      answersQuestionCaptureId: "q_prefixed_question",
      capturedAt: "2099-01-02T13:00:00.000Z",
      createdAt: "2099-01-02T13:00:00.000Z",
      updatedAt: "2099-01-02T13:00:00.000Z"
    }],
    reviewCards: []
  }]
});
const promotedQPrefixedQuestion = promoteCapture(answeredQuestionCardFixture, "answered_card_topic", "q_prefixed_question");
const qPrefixedQuestionCard = getActiveSession(promotedQPrefixedQuestion).reviewCards[0];
assert.match(qPrefixedQuestionCard.prompt, /Answer the question: Which invariant survives stale heap entries\?/);
assert.doesNotMatch(qPrefixedQuestionCard.prompt, /Answer the question: Q:/);
assert.match(qPrefixedQuestionCard.answer, /Final invariant: distances are only committed when popped fresh/);
assert.doesNotMatch(qPrefixedQuestionCard.answer, /Answer: ok/);
assert.doesNotMatch(qPrefixedQuestionCard.answer, /discard entries whose distance/);
assert.doesNotMatch(qPrefixedQuestionCard.answer, /Evidence:/);
assert.equal(qPrefixedQuestionCard.evidenceCaptureId, "answer_created_only");
const weakOnlyAnswerCardFixture = workspaceFromPortableData({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  clientId: "client_weak_answered_question",
  activeSessionId: "weak_answered_card_topic",
  sessions: [{
    id: "weak_answered_card_topic",
    title: "Weak answered card semantics",
    captures: [{
      id: "weak_answer_question",
      quote: "The derivation needs a stable invariant.",
      thought: "Question: What invariant should I keep?",
      tags: ["question"],
      capturedAt: "2099-01-02T10:00:00.000Z",
      createdAt: "2099-01-02T10:00:00.000Z",
      updatedAt: "2099-01-02T10:00:00.000Z",
      questionResolvedAt: "2099-01-02T11:00:00.000Z"
    }, {
      id: "weak_answer_only",
      thought: "Answer: ok",
      answersQuestionCaptureId: "weak_answer_question",
      capturedAt: "2099-01-02T11:00:00.000Z",
      createdAt: "2099-01-02T11:00:00.000Z",
      updatedAt: "2099-01-02T11:00:00.000Z"
    }],
    reviewCards: []
  }]
});
const weakOnlyAnswerCard = getActiveSession(promoteCapture(weakOnlyAnswerCardFixture, "weak_answered_card_topic", "weak_answer_question")).reviewCards[0];
assert.doesNotMatch(weakOnlyAnswerCard.prompt, /Answer the question:/);
assert.doesNotMatch(weakOnlyAnswerCard.answer, /Answer: ok/);
assert.equal(weakOnlyAnswerCard.evidenceCaptureId, "");
const tiedAnswerCardFixture = workspaceFromPortableData({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  clientId: "client_answered_question_tie",
  activeSessionId: "answered_card_tie_topic",
  sessions: [{
    id: "answered_card_tie_topic",
    title: "Answered card tie semantics",
    captures: [{
      id: "tie_question",
      thought: "Question: Which equal-timestamp answer wins?",
      tags: ["question"],
      capturedAt: "2099-01-02T10:00:00.000Z",
      createdAt: "2099-01-02T10:00:00.000Z",
      updatedAt: "2099-01-02T10:00:00.000Z",
      questionResolvedAt: "2099-01-02T12:10:00.000Z"
    }, {
      id: "answer_a",
      thought: "Answer: lower lexical id should lose the deterministic tie.",
      answersQuestionCaptureId: "tie_question",
      capturedAt: "2099-01-02T12:00:00.000Z",
      createdAt: "2099-01-02T12:00:00.000Z",
      updatedAt: "2099-01-02T12:00:00.000Z"
    }, {
      id: "answer_z",
      thought: "Answer: higher lexical id wins the deterministic tie.",
      answersQuestionCaptureId: "tie_question",
      capturedAt: "2099-01-02T12:00:00.000Z",
      createdAt: "2099-01-02T12:00:00.000Z",
      updatedAt: "2099-01-02T12:00:00.000Z"
    }],
    reviewCards: []
  }]
});
const tiedAnswerCard = getActiveSession(promoteCapture(tiedAnswerCardFixture, "answered_card_tie_topic", "tie_question")).reviewCards[0];
assert.match(tiedAnswerCard.prompt, /Answer the question: Which equal-timestamp answer wins\?/);
assert.match(tiedAnswerCard.answer, /higher lexical id wins/);
assert.doesNotMatch(tiedAnswerCard.answer, /lower lexical id/);
assert.equal(tiedAnswerCard.evidenceCaptureId, "answer_z");
const duplicateAnswerInboxResult = applyMobileInboxPatch(answerInboxResult.workspace, answerInboxPatch, new Date("2026-05-29T00:32:30.000Z"));
assert.equal(duplicateAnswerInboxResult.receipt.targetResolution, "duplicate-patch");
assert.equal(duplicateAnswerInboxResult.receipt.answeredQuestions, 0);
assert.equal(duplicateAnswerInboxResult.receipt.refreshableReviewCards, 0);
assert.equal(duplicateAnswerInboxResult.receipt.skippedAnswerTargets, 0);
const alreadyClosedAnswerResult = applyMobileInboxPatch(answerInboxResult.workspace, {
  ...answerInboxPatch,
  patchId: "patch_answer_question_already_closed",
  captures: [{
    ...answerInboxPatch.captures[0],
    id: "inbox_answer_capture_already_closed"
  }]
}, new Date("2026-05-29T00:32:45.000Z"));
assert.equal(alreadyClosedAnswerResult.receipt.answeredQuestions, 0);
assert.equal(alreadyClosedAnswerResult.receipt.skippedAnswerTargets, 1);
assert.equal(alreadyClosedAnswerResult.receipt.answerTargetSkips.alreadyClosed, 1);
const badAnswerTargetPatch = {
  ...answerInboxPatch,
  patchId: "patch_answer_question_missing",
  captures: [{
    ...answerInboxPatch.captures[0],
    id: "inbox_answer_capture_missing",
    answersQuestionCaptureId: "missing_question_capture"
  }]
};
const badAnswerTargetResult = applyMobileInboxPatch(questionLifecycleWorkspace, badAnswerTargetPatch, new Date("2026-05-29T00:33:00.000Z"));
assert.equal(badAnswerTargetResult.receipt.answeredQuestions, 0);
assert.equal(badAnswerTargetResult.receipt.skippedAnswerTargets, 1);
assert.equal(badAnswerTargetResult.receipt.answerTargetSkips.missing, 1);
assert.equal(captureHasOpenQuestion(getActiveSession(badAnswerTargetResult.workspace).captures.find((capture) => capture.id === questionCaptureId)), true);
const answerTargetGuardPatch = {
  ...answerInboxPatch,
  patchId: "patch_answer_question_guards",
  captures: [{
    ...answerInboxPatch.captures[0],
    id: "self_ref_capture",
    answersQuestionCaptureId: "self_ref_capture"
  }, {
    ...answerInboxPatch.captures[0],
    id: "batch_target_capture",
    answersQuestionCaptureId: questionCaptureId
  }, {
    ...answerInboxPatch.captures[0],
    id: "batch_ref_capture",
    answersQuestionCaptureId: "batch_target_capture"
  }, {
    ...answerInboxPatch.captures[0],
    id: "invalid_target_capture",
    answersQuestionCaptureId: `${"x".repeat(129)}!`
  }]
};
const answerTargetGuardResult = applyMobileInboxPatch(questionLifecycleWorkspace, answerTargetGuardPatch, new Date("2026-05-29T00:34:00.000Z"));
assert.equal(answerTargetGuardResult.receipt.added, 4);
assert.equal(answerTargetGuardResult.receipt.answeredQuestions, 1);
assert.equal(answerTargetGuardResult.receipt.skippedAnswerTargets, 3);
assert.equal(answerTargetGuardResult.receipt.answerTargetSkips.selfReference, 1);
assert.equal(answerTargetGuardResult.receipt.answerTargetSkips.patchReference, 1);
assert.equal(answerTargetGuardResult.receipt.answerTargetSkips.invalid, 1);
const crossTopicWorkspace = addSession(questionLifecycleWorkspace, "Different question answer target");
const crossTopicId = crossTopicWorkspace.sessions.find((item) => item.title === "Different question answer target").id;
const crossTopicAnswerResult = applyMobileInboxPatch(crossTopicWorkspace, {
  ...answerInboxPatch,
  patchId: "patch_answer_question_cross_topic",
  target: { topicId: crossTopicId, topicTitle: "Different question answer target" },
  captures: [{
    ...answerInboxPatch.captures[0],
    id: "inbox_answer_capture_cross_topic"
  }]
}, new Date("2026-05-29T00:35:00.000Z"));
assert.equal(crossTopicAnswerResult.receipt.answeredQuestions, 0);
assert.equal(crossTopicAnswerResult.receipt.skippedAnswerTargets, 1);
assert.equal(crossTopicAnswerResult.receipt.answerTargetSkips.missing, 1);
assert.equal(captureHasOpenQuestion(crossTopicAnswerResult.workspace.sessions.find((item) => item.id === questionSession.id).captures.find((capture) => capture.id === questionCaptureId)), true);
questionLifecycleWorkspace = setCaptureQuestionResolved(
  questionLifecycleWorkspace,
  questionSession.id,
  questionCaptureId
);
let questionLifecycleSession = getActiveSession(questionLifecycleWorkspace);
const resolvedQuestionTimestamp = questionLifecycleSession.captures[0].questionResolvedAt;
assert.equal(captureHasQuestion(questionLifecycleSession.captures[0]), true);
assert.equal(captureHasOpenQuestion(questionLifecycleSession.captures[0]), false);
assert.match(resolvedQuestionTimestamp, /^\d{4}-\d{2}-\d{2}T/);
assert.equal(getSynthesisStats(questionLifecycleSession).questions, 0);
assert.equal(buildFocusBrief(questionLifecycleSession, questionLifecycleWorkspace, focusNow).stats.questions, 0);
assert.equal(buildTodayPack(questionLifecycleWorkspace, focusNow).stats.questions, 0);
assert.equal(buildTodayPack(questionLifecycleWorkspace, focusNow).questionItems.length, 0);
const resolvedQuestionSynthesis = generateSynthesisDraft(questionLifecycleSession);
const resolvedQuestionOpenQuestions = resolvedQuestionSynthesis.split("### Open Questions")[1].split("### Review Targets")[0];
assert.match(resolvedQuestionSynthesis, /Generated from 1 capture \/ 0 questions \/ 0 cards/);
assert.doesNotMatch(resolvedQuestionOpenQuestions, /Why does ownership make aliasing safe/);
assert.equal(setCaptureQuestionResolved(
  questionLifecycleWorkspace,
  questionSession.id,
  questionCaptureId
), questionLifecycleWorkspace);
const roundTripResolvedWorkspace = workspaceFromPortableData(JSON.parse(JSON.stringify(questionLifecycleWorkspace)));
const roundTripResolvedSession = getActiveSession(roundTripResolvedWorkspace);
assert.equal(roundTripResolvedSession.captures[0].questionResolvedAt, resolvedQuestionTimestamp);
assert.equal(captureHasOpenQuestion(roundTripResolvedSession.captures[0]), false);
questionLifecycleWorkspace = setCaptureQuestionResolved(
  questionLifecycleWorkspace,
  questionSession.id,
  questionCaptureId,
  false
);
questionLifecycleSession = getActiveSession(questionLifecycleWorkspace);
assert.equal(captureHasOpenQuestion(questionLifecycleSession.captures[0]), true);
assert.equal(questionLifecycleSession.captures[0].questionResolvedAt, null);
assert.equal(buildTodayPack(questionLifecycleWorkspace, focusNow).stats.questions, 1);
assert.equal(setCaptureQuestionResolved(
  questionLifecycleWorkspace,
  questionSession.id,
  questionCaptureId,
  false
), questionLifecycleWorkspace);
const legacyQuestionWorkspace = sanitizeWorkspace({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  version: WORKSPACE_SCHEMA_VERSION,
  clientId: "legacy_question_client",
  activeSessionId: "legacy_question_session",
  createdAt: "2026-05-29T00:00:00.000Z",
  updatedAt: "2026-05-29T00:00:00.000Z",
  sessions: [{
    id: "legacy_question_session",
    originClientId: "legacy_question_client",
    title: "Legacy question topic",
    sourceTitle: "",
    sourceUrl: "",
    materialType: "article",
    tags: [],
    focusMode: "capture",
    notesMarkdown: "",
    captures: [{
      id: "legacy_question_capture",
      originClientId: "legacy_question_client",
      quote: "",
      thought: "Why does this old workspace still count?",
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
  }]
});
assert.equal(getActiveSession(legacyQuestionWorkspace).captures[0].questionResolvedAt, null);
assert.equal(getActiveSession(legacyQuestionWorkspace).captures[0].questionParkedAt, null);
assert.equal(captureHasOpenQuestion(getActiveSession(legacyQuestionWorkspace).captures[0]), true);

const statementSession = createSession({
  title: "No question parking",
  sourceUrl: "https://example.com/statements",
  captures: [{
    id: "statement_capture",
    thought: "Ownership constrains aliases without an explicit question.",
    capturedAt: "2026-05-29T00:18:30.000Z"
  }],
  reviewCards: []
}, workspace.clientId);
const statementBrief = buildFocusBrief(statementSession, null, focusNow);
assert.equal(captureHasQuestion(statementSession.captures[0]), false);
assert.equal(getSynthesisStats(statementSession).questions, 0);
assert.equal(statementBrief.stats.questions, 0);
assert.equal(statementBrief.warnings.some((warning) => warning.kind === "open_questions"), false);
assert.equal(captureHasQuestion({ thought: "Question: why ownership matters" }), true);
assert.equal(captureHasQuestion({ thought: "Q: ownership matters" }), true);
assert.equal(captureHasQuestion({ thought: "Question: " }), false);

const urlCodeSession = createSession({
  title: "Question false positives",
  sourceUrl: "https://example.com/question-false-positives",
  captures: [
    {
      id: "url_capture",
      thought: "Reference https://example.com/course?unit=1 before the next section.",
      capturedAt: "2026-05-29T00:18:40.000Z"
    },
    {
      id: "inline_code_capture",
      thought: "Try `value?.prop` in the console.",
      capturedAt: "2026-05-29T00:18:50.000Z"
    },
    {
      id: "fenced_code_capture",
      thought: "```\nfetch('/api?debug=1')\n```",
      capturedAt: "2026-05-29T00:19:00.000Z"
    }
  ],
  reviewCards: []
}, workspace.clientId);
const urlCodeBrief = buildFocusBrief(urlCodeSession, null, focusNow);
assert.equal(urlCodeSession.captures.every((capture) => !captureHasQuestion(capture)), true);
assert.equal(getSynthesisStats(urlCodeSession).questions, 0);
assert.equal(urlCodeBrief.stats.questions, 0);
assert.equal(urlCodeBrief.warnings.some((warning) => warning.kind === "open_questions"), false);
const urlCodeSynthesis = generateSynthesisDraft(urlCodeSession);
const urlCodeOpenQuestions = urlCodeSynthesis.split("### Open Questions")[1].split("### Review Targets")[0];
assert.match(urlCodeSynthesis, /Generated from 3 captures \/ 0 questions \/ 0 cards/);
assert.doesNotMatch(urlCodeOpenQuestions, /https:\/\/example\.com/);
assert.doesNotMatch(urlCodeOpenQuestions, /value\?\.prop/);
assert.doesNotMatch(urlCodeOpenQuestions, /api\?debug/);

const mixedQuestionSession = createSession({
  title: "Questions with code and links",
  sourceUrl: "https://example.com/mixed-questions",
  captures: [
    {
      id: "url_question_capture",
      thought: "Why does https://example.com/course?unit=1 still load slowly?",
      capturedAt: "2026-05-29T00:19:10.000Z"
    },
    {
      id: "code_question_capture",
      thought: "Does `value?.prop` short-circuit when value is null?",
      capturedAt: "2026-05-29T00:19:20.000Z"
    }
  ],
  reviewCards: []
}, workspace.clientId);
const mixedQuestionSynthesis = generateSynthesisDraft(mixedQuestionSession);
assert.equal(mixedQuestionSession.captures.every((capture) => captureHasQuestion(capture)), true);
assert.equal(getSynthesisStats(mixedQuestionSession).questions, 2);
assert.match(mixedQuestionSynthesis, /Why does https:\/\/example\.com\/course\?unit=1 still load slowly\?/);
assert.match(mixedQuestionSynthesis, /Does `value\?\.prop` short-circuit when value is null\?/);

const emptySynthesis = generateSynthesisDraft(createSession({ title: "Empty topic" }, workspace.clientId));
assert.match(emptySynthesis, /No captures yet/);
assert.deepEqual(getSynthesisStats(session), { captures: 1, questions: 0, cards: 1 });

const dueFocusBrief = buildFocusBrief(session, workspace, focusNow);
assert.equal(dueFocusBrief.schema, "learning-companion.focus-brief.v1");
assert.equal(dueFocusBrief.nextAction.kind, "review");
assert.equal(dueFocusBrief.nextAction.reason, "Active topic has due review due now.");
assert.match(generateReviewPackMarkdown(workspace), /Why: Active topic has due review due now\./);
assert.equal(dueFocusBrief.stats.dueCards, 1);
assert.equal(dueFocusBrief.source.href, "https://www.youtube.com/watch?v=rust123&t=492s");
assert.equal(dueFocusBrief.source.provenance, "session");
assert.deepEqual(dueFocusBrief.source, buildResumeSource(session));
assert.equal(buildResumeSource(session).href, "https://www.youtube.com/watch?v=rust123&t=492s");
assert.equal(buildResumeSource(session, "09:00").href, "https://www.youtube.com/watch?v=rust123&t=540s");
assert.equal(buildResumeSource(session, "not a timestamp").href, "https://www.youtube.com/watch?v=rust123&t=492s");
assert.match(generateTodayMarkdown(workspace, focusNow), /Source: \[RustConf ownership talk\]\(https:\/\/www\.youtube\.com\/watch\?v=rust123&t=492s\)/);
const noCaptureSession = createSession({
  title: "Source without captures",
  sourceTitle: "Readable source",
  sourceUrl: "https://example.com/guide"
}, workspace.clientId);
const noCaptureSourceBrief = buildFocusBrief(noCaptureSession, null, focusNow);
assert.equal(noCaptureSourceBrief.source.href, "https://example.com/guide");
assert.equal(noCaptureSourceBrief.source.provenance, "session");
assert.deepEqual(noCaptureSourceBrief.source, buildResumeSource(noCaptureSession));
const noTimestampSourceBrief = buildFocusBrief(createSession({
  title: "Source with untimed capture",
  sourceTitle: "Video without timestamp",
  sourceUrl: "https://www.youtube.com/watch?v=notimed",
  captures: [{ id: "notimed_capture", quote: "No timestamp yet", thought: "", timestamp: "", capturedAt: "2026-05-29T00:19:00.000Z" }]
}, workspace.clientId), null, focusNow);
assert.equal(noTimestampSourceBrief.source.href, "https://www.youtube.com/watch?v=notimed");
const captureFallbackSession = createSession({
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
}, workspace.clientId);
const captureFallbackBrief = buildFocusBrief(captureFallbackSession, null, focusNow);
assert.equal(captureFallbackBrief.source.href, "https://youtu.be/fallback?t=30s");
assert.equal(captureFallbackBrief.source.title, "Fallback video");
assert.equal(captureFallbackBrief.source.provenance, "latest_capture_fallback");
assert.deepEqual(captureFallbackBrief.source, buildResumeSource(captureFallbackSession));
assert.equal(buildResumeSource(captureFallbackSession).href, "https://youtu.be/fallback?t=30s");
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
    { id: "cap_b", thought: "Second idea?", capturedAt: "2026-05-29T00:01:00.000Z" },
    { id: "cap_c", thought: "Third idea", capturedAt: "2026-05-29T00:02:00.000Z" }
  ],
  reviewCards: []
}, workspace.clientId), null, focusNow);
assert.equal(synthesizeBrief.nextAction.kind, "synthesize");
assert.equal(synthesizeBrief.nextAction.reason, "Unsynthesized captures reached the compression threshold.");
assert.equal(synthesizeBrief.stats.capturesSinceLastSynthesis, 3);
assert.equal(synthesizeBrief.stats.questions, 1);
assert.equal(synthesizeBrief.warnings.some((warning) => warning.kind === "needs_synthesis"), true);
assert.equal(synthesizeBrief.warnings.some((warning) => warning.kind === "open_questions"), true);
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
const evidenceStampSession = {
  ...synthesizedSession,
  reviewCards: [{
    id: "stamp_card",
    prompt: "Same prompt",
    answer: "Same answer",
    sourceCaptureId: "done_a",
    evidenceCaptureId: "answer_a",
    updatedAt: "2026-05-29T00:03:00.000Z"
  }]
};
assert.notEqual(getSynthesisSourceStamp(evidenceStampSession), getSynthesisSourceStamp({
  ...evidenceStampSession,
  reviewCards: [{
    ...evidenceStampSession.reviewCards[0],
    evidenceCaptureId: "answer_b"
  }]
}));
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
assert.equal(todayPack.stats.questions, 0);
assert.equal(todayPack.stats.parkedQuestions, 0);
assert.equal(todayPack.stats.resolvedQuestionsToday, 0);
assert.equal(todayPack.stats.answerCapturesToday, 0);
assert.equal(todayPack.stats.questionReviewCards, 0);
assert.equal(todayPack.stats.questionReviewCardsToday, 0);
assert.equal(todayPack.questionHealth.status, "clear");
assert.equal(todayPack.questionLoop.label, "Question loop quiet");
assert.equal(todayPack.questionLoop.questionReviewCards, 0);
assert.match(todayPack.questionLoop.todayDetail, /0 answer-linked closures/);
assert.equal(todayPack.dueItems.length, 1);
assert.equal(todayPack.dueOverflow, 1);
assert.equal(todayPack.questionItems.length, 0);
assert.equal(todayPack.parkedQuestionItems.length, 0);
assert.equal(todayPack.resolvedQuestionItems.length, 0);
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
assert.match(todayMarkdown, /Question Queue Health/);
assert.match(todayMarkdown, /Question queue clear/);
assert.match(todayMarkdown, /Question Loop/);
assert.match(todayMarkdown, /Question loop quiet/);
assert.match(todayMarkdown, /Today metrics use the local day window/);
assert.match(todayMarkdown, /Open Questions/);
assert.match(todayMarkdown, /No open questions captured yet/);
assert.match(todayMarkdown, /Parked Questions/);
assert.match(todayMarkdown, /No parked questions/);
assert.match(todayMarkdown, /Closed Today/);
assert.match(todayMarkdown, /No questions closed today/);
assert.match(todayMarkdown, /Recent Captures/);
assert.match(todayMarkdown, /Recall why greedy selection works/);
const boundaryNow = new Date("2099-01-02T23:59:30");
const boundaryWindow = resolveTodayWindow(boundaryNow);
const boundaryPack = buildTodayPack(multiReviewWorkspace, boundaryNow);
assert.equal(boundaryPack.localDayWindow.start, boundaryWindow.startIso);
assert.equal(boundaryPack.localDayWindow.end, boundaryWindow.endIso);
assert.equal(generateTodayMarkdown(multiReviewWorkspace, boundaryNow).includes(boundaryWindow.label), true);

const questionTodayWorkspace = addCapture(multiReviewWorkspace, algorithmsSession.id, {
  quote: "A stale heap item can survive after a better path is found.",
  thought: "Which invariant breaks if the heap is stale?",
  timestamp: "14:05",
  tags: "question graph"
}, { now: "2099-01-02T00:05:00.000Z" });
const questionTodayPack = buildTodayPack(questionTodayWorkspace, frozenToday, {
  dueLimit: 1,
  questionLimit: 1,
  recentLimit: 1
});
assert.equal(questionTodayPack.stats.questions, 1);
assert.equal(questionTodayPack.stats.parkedQuestions, 0);
assert.equal(questionTodayPack.questionHealth.status, "active");
assert.equal(questionTodayPack.questionHealth.targetSection, "open_questions");
assert.equal(questionTodayPack.questionLoop.activeQuestions, 1);
assert.equal(questionTodayPack.questionLoop.targetSection, "open_questions");
assert.equal(questionTodayPack.questionItems.length, 1);
assert.equal(questionTodayPack.questionItems[0].sessionTitle, "Algorithms course");
assert.match(questionTodayPack.questionItems[0].sessionPath, /^sessions\/.+\.md$/);
assert.equal(questionTodayPack.questionOverflow, 0);
const questionTodayMarkdown = generateTodayMarkdown(questionTodayWorkspace, frozenToday);
assert.match(questionTodayMarkdown, /Open question rule: latest 6 open question captures by capturedAt/);
assert.match(questionTodayMarkdown, /Parked question rule: latest 6 parked question captures by parkedAt/);
assert.match(questionTodayMarkdown, /Closed today rule: latest 4 question captures resolved in 2099-01-02 local/);
assert.match(questionTodayMarkdown, /Answer rule: latest 4 answer captures in 2099-01-02 local/);
assert.match(questionTodayMarkdown, /Workspace: 3 sessions \/ 3 captures \/ 1 open question \/ 0 parked questions \/ 0 closed today \/ 0 answers today \/ 2 cards \/ 2 due cards/);
assert.match(questionTodayMarkdown, /Questions can also appear under Recent Captures/);
assert.match(questionTodayMarkdown, /Question Loop/);
assert.match(questionTodayMarkdown, /Question loop has active work/);
assert.match(questionTodayMarkdown, /Backlog: 1 unresolved question/);
const mixedMirrorIndexHtml = generateMirrorIndexHtml(questionTodayWorkspace, frozenToday);
assert.match(mixedMirrorIndexHtml, /Next from this export/);
assert.match(mixedMirrorIndexHtml, /Review due cards/);
assert.match(mixedMirrorIndexHtml, /Also answer 1 open question in Inbox\./);
assert.match(mixedMirrorIndexHtml, /class="device-next-secondary" href="inbox\.html\?/);
assert.doesNotMatch(mixedMirrorIndexHtml, /<strong>Answer next question/);
const mixedSecondaryHref = mixedMirrorIndexHtml.match(/class="device-next-secondary" href="([^"]+)"/)?.[1] || "";
assert.match(mixedSecondaryHref, /^inbox\.html\?[^#]+$/);
assert.match(mixedSecondaryHref, /answerToCaptureId=/);
assert.doesNotMatch(mixedSecondaryHref, /workspaceFingerprint|returnBaseFingerprint|\/Users|file:/);
const twoQuestionMirrorWorkspace = addCapture(questionTodayWorkspace, algorithmsSession.id, {
  quote: "Another stale heap edge case.",
  thought: "Question: Which tie-breaker keeps the exported path deterministic?",
  tags: "question graph"
}, { now: "2099-01-02T00:06:00.000Z" });
const twoQuestionMirrorIndexHtml = generateMirrorIndexHtml(twoQuestionMirrorWorkspace, frozenToday);
assert.match(twoQuestionMirrorIndexHtml, /Also answer 2 open questions in Inbox\./);
const pluralSecondaryHref = twoQuestionMirrorIndexHtml.match(/class="device-next-secondary" href="([^"]+)"/)?.[1] || "";
assert.match(pluralSecondaryHref, /^inbox\.html\?[^#]+$/);
assert.doesNotMatch(pluralSecondaryHref, /workspaceFingerprint|returnBaseFingerprint|\/Users|file:/);
const overflowResolvedCaptures = Array.from({ length: 6 }, (_, index) => ({
  id: `resolved_overflow_${index}`,
  quote: "",
  thought: `Resolved overflow question ${index}?`,
  timestamp: "",
  tags: ["question", "resolved"],
  capturedAt: `2099-01-02T00:0${index}:00.000Z`,
  createdAt: `2099-01-02T00:0${index}:00.000Z`,
  updatedAt: `2099-01-02T00:${10 + index}:00.000Z`,
  sourceTitle: "",
  sourceUrl: "",
  materialType: "doc",
  sourceProvenance: "manual",
  promotedToReview: false,
  questionResolvedAt: `2099-01-02T00:${10 + index}:00.000Z`,
  questionParkedAt: null
}));
const overflowResolvedWorkspace = workspaceFromPortableData({
  ...multiReviewWorkspace,
  sessions: multiReviewWorkspace.sessions.map((session) => session.id === algorithmsSession.id
    ? {
        ...session,
        captures: [...session.captures, ...overflowResolvedCaptures]
      }
    : session)
});
const overflowResolvedPack = buildTodayPack(overflowResolvedWorkspace, frozenToday, {
  dueLimit: 1,
  recentLimit: 1,
  resolvedQuestionLimit: 2
});
assert.equal(overflowResolvedPack.stats.resolvedQuestionsToday, 6);
assert.equal(overflowResolvedPack.questionLoop.resolvedQuestionsToday, 6);
assert.equal(overflowResolvedPack.questionLoop.targetSection, "closed_questions");
assert.equal(overflowResolvedPack.resolvedQuestionItems.length, 2);
assert.equal(overflowResolvedPack.resolvedQuestionItems[0].capture.thought, "Resolved overflow question 5?");
assert.equal(overflowResolvedPack.resolvedQuestionOverflow, 4);
assert.match(generateTodayMarkdown(overflowResolvedWorkspace, frozenToday), /\+2 more questions closed today in workspace\.json/);
const overflowAnswerWorkspace = workspaceFromPortableData({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  clientId: "client_answer_overflow",
  activeSessionId: "answer_overflow_topic",
  sessions: [{
    id: "answer_overflow_topic",
    title: "Answer overflow topic",
    captures: Array.from({ length: 6 }, (_, index) => ({
      id: `answer_overflow_${index}`,
      thought: `Answer: overflow answer ${index} has enough detail to classify.`,
      tags: ["answer"],
      capturedAt: `2099-01-02T00:0${index}:00.000Z`,
      createdAt: `2099-01-02T00:0${index}:00.000Z`,
      updatedAt: `2099-01-02T00:0${index}:00.000Z`
    })),
    reviewCards: []
  }]
});
const overflowAnswerPack = buildTodayPack(overflowAnswerWorkspace, frozenToday, { answerLimit: 2 });
assert.equal(overflowAnswerPack.stats.answerCapturesToday, 6);
assert.equal(overflowAnswerPack.answerItems.length, 2);
assert.equal(overflowAnswerPack.answerItems[0].answerReason, "tagged-answer");
assert.equal(overflowAnswerPack.answerOverflow, 4);
assert.match(generateTodayMarkdown(overflowAnswerWorkspace, frozenToday), /\+2 more answers captured today in workspace\.json/);
const priorSessionAnswerWorkspace = workspaceFromPortableData({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  clientId: "client_prior_session_answer",
  activeSessionId: "prior_question_topic",
  sessions: [{
    id: "prior_question_topic",
    title: "Prior question topic",
    captures: [{
      id: "prior_session_question",
      thought: "Why does answer location matter?",
      tags: ["question"],
      capturedAt: "2099-01-02T09:00:00.000Z",
      createdAt: "2099-01-02T09:00:00.000Z",
      updatedAt: "2099-01-02T10:00:00.000Z",
      questionResolvedAt: "2099-01-02T10:00:00.000Z"
    }],
    reviewCards: []
  }, {
    id: "prior_answer_topic",
    title: "Prior answer topic",
    captures: [{
      id: "prior_session_answer",
      thought: "Answer: same-session linking prevents accidental cross-topic closure.",
      tags: ["answer"],
      answersQuestionCaptureId: "prior_session_question",
      capturedAt: "2099-01-02T10:01:00.000Z",
      createdAt: "2099-01-02T10:01:00.000Z",
      updatedAt: "2099-01-02T10:01:00.000Z"
    }],
    reviewCards: []
  }]
});
const priorSessionAnswerPack = buildTodayPack(priorSessionAnswerWorkspace, frozenToday);
assert.equal(priorSessionAnswerPack.questionLoop.resolvedQuestionsToday, 1);
assert.equal(priorSessionAnswerPack.questionLoop.answerLinkedResolvedToday, 0);
assert.equal(priorSessionAnswerPack.resolvedQuestionItems[0].answerCapture, null);
const priorPromotedQuestion = promoteCapture(priorSessionAnswerWorkspace, "prior_question_topic", "prior_session_question");
const priorPromotedCard = getActiveSession(priorPromotedQuestion).reviewCards[0];
assert.equal(priorPromotedCard.evidenceCaptureId, "");
assert.doesNotMatch(priorPromotedCard.answer, /same-session linking prevents/);
const questionOnlyMirrorWorkspace = workspaceFromPortableData({
  ...questionTodayWorkspace,
  sessions: questionTodayWorkspace.sessions.map((item) => ({ ...item, reviewCards: [] }))
});
const questionOnlyMirrorPack = buildTodayPack(questionOnlyMirrorWorkspace, frozenToday, {
  dueLimit: 1,
  questionLimit: 1,
  recentLimit: 1
});
assert.equal(questionOnlyMirrorPack.stats.due, 0);
assert.equal(questionOnlyMirrorPack.stats.questions, 1);
const questionMirrorIndexHtml = generateMirrorIndexHtml(questionOnlyMirrorWorkspace, frozenToday);
assert.match(questionMirrorIndexHtml, /Next from this export/);
assert.match(questionMirrorIndexHtml, /Answer next question/);
assert.match(questionMirrorIndexHtml, /Open Question Preview/);
assert.match(questionMirrorIndexHtml, /1 open question/);
assert.match(questionMirrorIndexHtml, /Which invariant breaks if the heap is stale\?/);
assert.match(questionMirrorIndexHtml, /href="sessions\/.+\.md"/);
assert.match(questionMirrorIndexHtml, /Draft answer in inbox/);
const nextQuestionHref = questionMirrorIndexHtml.match(/href="(inbox\.html\?[^"]+)"><strong>Answer next question/)?.[1]?.replace(/&amp;/g, "&") || "";
const nextQuestionParams = new URLSearchParams(nextQuestionHref.split("?")[1] || "");
assert.equal(nextQuestionParams.get("answerToCaptureId"), questionOnlyMirrorPack.questionItems[0].capture.id);
assert.equal(nextQuestionParams.get("thought"), "Answer:");
const questionAnswerHref = questionMirrorIndexHtml.match(/href="(inbox\.html\?[^"]+)">Draft answer in inbox/)?.[1]?.replace(/&amp;/g, "&") || "";
const questionAnswerParams = new URLSearchParams(questionAnswerHref.split("?")[1] || "");
assert.equal(questionAnswerParams.get("topicId"), algorithmsSession.id);
assert.equal(questionAnswerParams.get("answerToCaptureId"), questionOnlyMirrorPack.questionItems[0].capture.id);
assert.equal(questionAnswerParams.get("quote"), "Which invariant breaks if the heap is stale?");
assert.equal(questionAnswerParams.get("thought"), "Answer:");
assert.equal(questionAnswerParams.get("timestamp"), "14:05");
assert.match(questionAnswerParams.get("tags") || "", /answer/);
let hostileQuestionWorkspace = addCapture(multiReviewWorkspace, algorithmsSession.id, {
  quote: "Hostile mirror quote should stay inert.",
  thought: `Can mirror links carry <script>alert("x")</script> & #hash ?q=1\r\nemoji 😀 RTL שלום ${"x".repeat(4096)}?`,
  tags: "question hostile"
}, { now: "2099-01-02T00:30:00.000Z" });
const hostileMirrorIndexHtml = generateMirrorIndexHtml(hostileQuestionWorkspace, frozenToday);
const hostileAnswerHref = hostileMirrorIndexHtml.match(/href="(inbox\.html\?[^"]+)">Draft answer in inbox/)?.[1]?.replace(/&amp;/g, "&") || "";
const hostileAnswerParams = new URLSearchParams(hostileAnswerHref.split("?")[1] || "");
assert.equal(hostileAnswerParams.get("topicId"), algorithmsSession.id);
assert.match(hostileAnswerParams.get("answerToCaptureId") || "", /^capture_/);
assert.match(hostileAnswerParams.get("quote") || "", /Can mirror links carry <script>alert\("x"\)<\/script> & #hash \?q=1emoji 😀 RTL שלום/);
assert.doesNotMatch(hostileAnswerParams.get("quote") || "", /[\r\n]/);
assert.equal(hostileAnswerParams.get("thought"), "Answer:");
assert.match(hostileAnswerParams.get("tags") || "", /answer/);
assert.doesNotMatch(hostileMirrorIndexHtml, /<script>alert/);
const hostileQuestionOnlyMirrorHtml = generateMirrorIndexHtml(workspaceFromPortableData({
  ...hostileQuestionWorkspace,
  sessions: hostileQuestionWorkspace.sessions.map((item) => ({ ...item, reviewCards: [] }))
}), frozenToday);
assert.match(hostileQuestionOnlyMirrorHtml, /Answer next question/);
assert.doesNotMatch(hostileQuestionOnlyMirrorHtml, /<script>alert/);
const hostileNextHref = hostileQuestionOnlyMirrorHtml.match(/href="(inbox\.html\?[^"]+)"><strong>Answer next question/)?.[1]?.replace(/&amp;/g, "&") || "";
const hostileNextParams = new URLSearchParams(hostileNextHref.split("?")[1] || "");
assert.match(hostileNextParams.get("quote") || "", /Can mirror links carry <script>alert\("x"\)<\/script> & #hash \?q=1emoji 😀 RTL שלום/);
assert.doesNotMatch(hostileNextParams.get("quote") || "", /[\r\n]/);
assert.equal(hostileNextParams.get("thought"), "Answer:");
let overflowMirrorQuestionWorkspace = addCapture(questionTodayWorkspace, algorithmsSession.id, {
  quote: "HTML-like study input should stay inert in the mirror home.",
  thought: "What about <script>alert(\"x\")</script> & \"quotes\"?",
  tags: "question html"
}, { now: "2099-01-02T00:20:00.000Z" });
for (let index = 0; index < 6; index += 1) {
  overflowMirrorQuestionWorkspace = addCapture(overflowMirrorQuestionWorkspace, algorithmsSession.id, {
    quote: `Overflow mirror question ${index + 1}.`,
    thought: `What overflow mirror question ${index + 1}?`,
    tags: "question overflow"
  }, { now: `2099-01-02T00:1${index}:00.000Z` });
}
const overflowMirrorIndexHtml = generateMirrorIndexHtml(overflowMirrorQuestionWorkspace, frozenToday);
assert.match(overflowMirrorIndexHtml, /Open Question Preview/);
assert.match(overflowMirrorIndexHtml, /2 more open questions in <a href="TODAY\.md">TODAY\.md<\/a>/);
assert.doesNotMatch(overflowMirrorIndexHtml, /<script>alert/);
assert.doesNotMatch(overflowMirrorIndexHtml, /"quotes"/);
assert.match(overflowMirrorIndexHtml, /What about &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; &quot;quotes&quot;\?/);
assert.match(questionTodayMarkdown, /Which invariant breaks if the heap is stale\?/);
assert.match(questionTodayMarkdown, /#question #graph/);

let overflowQuestionWorkspace = multiReviewWorkspace;
Array.from({ length: 7 }, (_, index) => index).forEach((index) => {
  overflowQuestionWorkspace = addCapture(overflowQuestionWorkspace, algorithmsSession.id, {
    thought: `Overflow question ${index}?`,
    tags: "question overflow"
  }, { now: `2099-01-02T00:0${index}:00.000Z` });
});
const overflowQuestionPack = buildTodayPack(overflowQuestionWorkspace, frozenToday, {
  dueLimit: 1,
  questionLimit: 2,
  recentLimit: 1
});
assert.equal(overflowQuestionPack.stats.questions, 7);
assert.equal(overflowQuestionPack.questionItems.length, 2);
assert.equal(overflowQuestionPack.questionItems[0].capture.thought, "Overflow question 6?");
assert.equal(overflowQuestionPack.questionItems[1].capture.thought, "Overflow question 5?");
assert.equal(overflowQuestionPack.questionOverflow, 5);
const overflowQuestionMarkdown = generateTodayMarkdown(overflowQuestionWorkspace, frozenToday);
const overflowOpenQuestions = overflowQuestionMarkdown.split("## Open Questions")[1].split("## Recent Captures")[0];
assert.match(overflowQuestionMarkdown, /Overflow question 6\?/);
assert.doesNotMatch(overflowOpenQuestions, /Overflow question 0\?/);
assert.match(overflowQuestionMarkdown, /\+1 more open questions in workspace\.json/);

const reviewHtml = generateReviewHtml(multiReviewWorkspace, frozenToday);
assert.match(reviewHtml, /Learning Companion Review Pack/);
assert.match(reviewHtml, /Content-Security-Policy/);
assert.match(reviewHtml, /learning-companion-workspace-fingerprint/);
assert.match(reviewHtml, /learning-companion-return-base-fingerprint/);
assert.match(reviewHtml, /returnBaseFingerprint/);
assert.match(reviewHtml, /Return-ready mirror/);
assert.match(reviewHtml, /Mac return-base check/);
assert.match(reviewHtml, /source\.returnBaseFingerprint/);
assert.match(reviewHtml, /learning-companion\.review-progress-patch\.v1/);
assert.match(reviewHtml, /Return to Mac/);
assert.match(reviewHtml, /timestamped review return file/);
assert.match(reviewHtml, /Save Return File/);
assert.match(reviewHtml, /copyProgressBtn" type="button">Copy Return File/);
assert.doesNotMatch(reviewHtml, /Copy Return JSON/);
assert.doesNotMatch(reviewHtml, /Save Return JSON/);
assert.doesNotMatch(reviewHtml, /Return JSON file/);
assert.match(reviewHtml, /selectProgressBtn" class="secondary"/);
assert.match(reviewHtml, />Manual Copy<\/button>/);
assert.match(reviewHtml, /downloadProgressBtn" class="secondary"/);
assert.match(reviewHtml, /selectReturnJson/);
assert.match(reviewHtml, /Return file selected/);
assert.match(reviewHtml, /returnFileName\('learning-companion-review-progress-patch'/);
assert.match(reviewHtml, /returnMetaKey/);
assert.match(reviewHtml, /Suggested JSON file:/);
assert.match(reviewHtml, /returnManualHelp/);
assert.match(reviewHtml, /Locked-down browser: use Manual Copy/);
assert.match(reviewHtml, /press Ctrl\+C/);
assert.match(reviewHtml, /Notepad/);
assert.match(reviewHtml, /returnNextStep/);
assert.match(reviewHtml, /role="status" aria-live="polite"/);
assert.match(reviewHtml, /No review events yet/);
assert.match(reviewHtml, /Use Copy or Save to take it back to Mac before closing/);
assert.match(reviewHtml, /Name it/);
assert.match(reviewHtml, /showSaveFilePicker/);
assert.match(reviewHtml, /shouldUseFallbackDownload/);
assert.match(reviewHtml, /__LC_ALLOW_AUTOMATED_DOWNLOADS__/);
assert.match(reviewHtml, /Save picker unavailable here/);
assert.match(reviewHtml, /beforeunload/);
assert.match(reviewHtml, /Today &gt; Return Files/);
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
assert.equal(reviewProgressResult.receipt.sourceWorkspaceFingerprint, "fnv1a-test");
assert.equal(reviewProgressResult.receipt.currentWorkspaceFingerprint, `fnv1a-${workspaceFingerprint(JSON.stringify(sanitizeWorkspace(multiReviewWorkspace), null, 2))}`);
assert.equal(reviewProgressResult.receipt.sourceFingerprintBasis, "workspace");
assert.equal(reviewProgressResult.receipt.sourceFingerprintMatches, false);
assert.equal(reviewProgressResult.workspace.importedReviewPatches.includes("review_patch_001"), true);
assert.equal(reviewedCard.strength, reviewProgressItem.card.strength + 1);
assert.equal(reviewedCard.lastReviewedAt, "2099-01-02T08:01:00.000Z");
const matchingReviewProgressResult = applyReviewProgressPatch(multiReviewWorkspace, {
  ...reviewProgressPatch,
  patchId: "review_patch_matching_base",
  source: {
    ...reviewProgressPatch.source,
    workspaceFingerprint: `fnv1a-${workspaceFingerprint(JSON.stringify(sanitizeWorkspace(multiReviewWorkspace), null, 2))}`,
    returnBaseFingerprint: buildReturnBaseFingerprint(multiReviewWorkspace)
  },
  events: [{ ...reviewProgressPatch.events[0], id: "review_event_matching_base" }]
}, frozenToday);
assert.equal(matchingReviewProgressResult.receipt.sourceFingerprintBasis, "return-base");
assert.equal(matchingReviewProgressResult.receipt.sourceFingerprintMatches, true);
const duplicateReviewProgressResult = applyReviewProgressPatch(reviewProgressResult.workspace, reviewProgressPatch);
assert.equal(duplicateReviewProgressResult.receipt.targetResolution, "duplicate-patch");
assert.equal(duplicateReviewProgressResult.receipt.applied, 0);
assert.equal(duplicateReviewProgressResult.receipt.sourceFingerprintMatches, false);
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
assert.match(inboxHtml, /learning-companion-return-base-fingerprint/);
assert.match(inboxHtml, /returnBaseFingerprint/);
assert.match(inboxHtml, /Return-ready mirror/);
assert.match(inboxHtml, /Mac return-base check/);
assert.match(inboxHtml, /source\.returnBaseFingerprint/);
assert.match(inboxHtml, /Return to Mac/);
assert.match(inboxHtml, /timestamped inbox return file/);
assert.match(inboxHtml, /Save Return File/);
assert.match(inboxHtml, /copyPatchBtn" type="button">Copy Return File/);
assert.doesNotMatch(inboxHtml, /Copy Return JSON/);
assert.doesNotMatch(inboxHtml, /Save Return JSON/);
assert.doesNotMatch(inboxHtml, /Return JSON file/);
assert.match(inboxHtml, /selectPatchBtn" class="secondary"/);
assert.match(inboxHtml, />Manual Copy<\/button>/);
assert.match(inboxHtml, /downloadPatchBtn" class="secondary"/);
assert.match(inboxHtml, /selectReturnJson/);
assert.match(inboxHtml, /Return file selected/);
assert.match(inboxHtml, /returnFileName\('learning-companion-inbox-patch'/);
assert.match(inboxHtml, /returnMetaKey/);
assert.match(inboxHtml, /Suggested JSON file:/);
assert.match(inboxHtml, /returnManualHelp/);
assert.match(inboxHtml, /Locked-down browser: use Manual Copy/);
assert.match(inboxHtml, /press Ctrl\+C/);
assert.match(inboxHtml, /Notepad/);
assert.match(inboxHtml, /textarea\[readonly\]/);
assert.match(inboxHtml, /returnNextStep/);
assert.match(inboxHtml, /role="status" aria-live="polite"/);
assert.match(inboxHtml, /No draft captures yet/);
assert.match(inboxHtml, /Use Copy or Save to take it back to Mac before closing/);
assert.match(inboxHtml, /Name it/);
assert.match(inboxHtml, /showSaveFilePicker/);
assert.match(inboxHtml, /shouldUseFallbackDownload/);
assert.match(inboxHtml, /__LC_ALLOW_AUTOMATED_DOWNLOADS__/);
assert.match(inboxHtml, /Save picker unavailable here/);
assert.match(inboxHtml, /beforeunload/);
assert.match(inboxHtml, /Today &gt; Return Files/);
assert.match(inboxHtml, /Content-Security-Policy/);
assert.match(inboxHtml, /getRandomValues/);
assert.match(inboxHtml, /applyQueryPrefill/);
assert.match(inboxHtml, /answerContext/);
assert.match(inboxHtml, /role="status" aria-live="polite"/);
assert.match(inboxHtml, /id="quoteLabel">Quote/);
assert.match(inboxHtml, /id="thoughtLabel">Thought/);
assert.match(inboxHtml, /Question from Mac/);
assert.match(inboxHtml, /Answer to return/);
assert.match(inboxHtml, /Question carried from the Mac mirror/);
assert.match(inboxHtml, /Write the answer to bring back to Mac/);
assert.match(inboxHtml, /setAnswerFieldMode/);
assert.match(inboxHtml, /fields\.quote\.readOnly = Boolean\(isAnswerDraft\)/);
assert.match(inboxHtml, /aria-readonly/);
assert.match(inboxHtml, /You're answering a question from this mirror/);
assert.match(inboxHtml, /Your answer will be saved to a return file you move back to Mac/);
assert.match(inboxHtml, /renderAnswerContext/);
assert.match(inboxHtml, /Answer draft loaded from mirror link/);
assert.match(inboxHtml, /original topic was not found/);
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
assert.match(mirrorIndexHtml, /Next from this export/);
assert.match(mirrorIndexHtml, /Review due cards/);
assert.match(mirrorIndexHtml, /2 due cards/);
assert.match(mirrorIndexHtml, /As of 2099-01-02T08:00:00\+08:00/);
assert.match(mirrorIndexHtml, /device-next-link:focus-visible/);
assert.match(mirrorIndexHtml, /a\.device-next-secondary/);
assert.match(mirrorIndexHtml, /Manual Return/);
assert.match(mirrorIndexHtml, /Read Today/);
assert.match(mirrorIndexHtml, /Work here/);
assert.match(mirrorIndexHtml, /Return file back to Mac/);
assert.match(mirrorIndexHtml, /Static mirror only/);
assert.match(mirrorIndexHtml, /Today &gt; Return Files/);
assert.match(mirrorIndexHtml, /href="sessions\/.+\.md"/);
assert.match(mirrorIndexHtml, /Resume Here/);
assert.match(mirrorIndexHtml, /Review 1 due card/);
assert.match(mirrorIndexHtml, /Why: Active topic has due review due now/);
assert.match(mirrorIndexHtml, /Open Question Preview/);
assert.match(mirrorIndexHtml, /No open questions captured yet/);
assert.match(generateMirrorIndexHtml(workspace, focusNow), /href="https:\/\/www\.youtube\.com\/watch\?v=rust123&amp;t=492s"/);
assert.match(mirrorIndexHtml, /Content-Security-Policy/);
assert.match(mirrorIndexHtml, /learning-companion-workspace-fingerprint/);
assert.match(mirrorIndexHtml, /learning-companion-return-base-fingerprint/);
assert.match(mirrorIndexHtml, /Return-ready mirror/);
assert.match(mirrorIndexHtml, /Mac return-base check/);
assert.match(mirrorIndexHtml, /source\.returnBaseFingerprint/);
assert.doesNotMatch(mirrorIndexHtml, /Return JSON back to Mac/);
assert.equal(mirrorIndexHtml.includes("<script"), false);
assert.equal(mirrorIndexHtml, generateMirrorIndexHtml(multiReviewWorkspace, frozenToday));
const emptyMirrorIndexHtml = generateMirrorIndexHtml(createDefaultWorkspace(), frozenToday);
assert.match(emptyMirrorIndexHtml, /Next from this export/);
assert.match(emptyMirrorIndexHtml, /Capture on this device/);
assert.match(emptyMirrorIndexHtml, /href="inbox\.html"><strong>Capture on this device/);
assert.match(emptyMirrorIndexHtml, /No due cards or open questions; return by JSON/);
const bareQuestionBase = createDefaultWorkspace();
const bareQuestionSession = getActiveSession(bareQuestionBase);
const bareQuestionWorkspace = addCapture(bareQuestionBase, bareQuestionSession.id, {
  thought: "Question:",
  tags: "question"
}, { now: "2099-01-02T00:40:00.000Z" });
const bareQuestionMirrorIndexHtml = generateMirrorIndexHtml(bareQuestionWorkspace, frozenToday);
assert.match(bareQuestionMirrorIndexHtml, /Capture on this device/);
assert.doesNotMatch(bareQuestionMirrorIndexHtml, /Answer next question/);

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
assert.equal(mirror.files.some((file) => file.path === "index.html" && file.role === "mirror-home" && /^fnv1a-[a-f0-9]{8}$/.test(file.sourceFingerprint) && file.content.includes("Return-ready mirror")), true);
assert.equal(mirror.files.some((file) => file.path === "workspace.json" && file.role === "workspace-restore"), true);
assert.equal(mirror.files.some((file) => file.path === "TODAY.md" && file.role === "study-pack"), true);
assert.equal(mirror.files.some((file) => file.path === "review.html" && file.role === "portable-review" && /^fnv1a-[a-f0-9]{8}$/.test(file.sourceFingerprint) && /^fnv1a-[a-f0-9]{8}$/.test(file.sourceReturnBaseFingerprint) && file.content.includes("Return-ready mirror")), true);
assert.equal(mirror.files.some((file) => file.path === "inbox.html" && file.role === "mobile-inbox" && /^fnv1a-[a-f0-9]{8}$/.test(file.sourceReturnBaseFingerprint) && file.content.includes("Return-ready mirror")), true);
assert.equal(mirror.files.some((file) => file.path === "inbox.html" && file.role === "mobile-inbox" && file.content.includes("Learning Companion Inbox")), true);
assert.equal(mirror.files.some((file) => file.path === "TODAY.md" && /Due Review/.test(file.content)), true);
assert.equal(mirror.files.some((file) => file.path.endsWith(".md") && /Rust ownership course/.test(file.content)), true);
const mirrorHome = mirror.files.find((file) => file.path === "index.html")?.content || "";
const mirrorDeviceHref = mirrorHome.match(/class="device-next-link" href="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&") || "";
assert.equal(mirror.files.some((file) => file.path === mirrorDeviceHref.split("?")[0]), true);
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
const uploadOutDir = mkdtempSync(join(tempBase, "feishu-upload-"));
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
  if (cleanupSmokeArtifacts) rmSync(uploadOutDir, { recursive: true, force: true });
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
const overwriteOutDir = mkdtempSync(join(tempBase, "feishu-overwrite-"));
try {
  materializeMirrorBundle(mirror, overwriteOutDir, { plan: uploadPlan });
  assert.throws(() => materializeMirrorBundle(mirror, overwriteOutDir, { plan: uploadPlan }), /already exists/);
} finally {
  if (cleanupSmokeArtifacts) rmSync(overwriteOutDir, { recursive: true, force: true });
}
const symlinkOutDir = mkdtempSync(join(tempBase, "feishu-symlink-"));
try {
  mkdirSync(join(symlinkOutDir, "files"), { recursive: true });
  const symlinkTarget = join(tempBase, "symlink-target");
  mkdirSync(symlinkTarget, { recursive: true, mode: 0o700 });
  symlinkSync(symlinkTarget, join(symlinkOutDir, "files", "sessions"), "dir");
  assert.throws(() => materializeMirrorBundle(mirror, symlinkOutDir, { plan: uploadPlan, force: true }), /symbolic link/);
} finally {
  if (cleanupSmokeArtifacts) rmSync(symlinkOutDir, { recursive: true, force: true });
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
const splitCaptureSearch = searchWorkspace(workspace, "rust lifetime", 5);
assert.equal(splitCaptureSearch[0].type, "capture");
assert.equal(splitCaptureSearch[0].targetId, session.captures[0].id);
assert.match(splitCaptureSearch[0].matchLabel, /2 terms:/);
const splitSourceSearch = searchWorkspace(workspace, "rustconf video", 5);
assert.equal(splitSourceSearch[0].type, "session");
assert.match(splitSourceSearch[0].matchLabel, /2 terms:/);
let splitGuardWorkspace = createDefaultWorkspace();
splitGuardWorkspace = addSession(splitGuardWorkspace, "Zebra source only");
splitGuardWorkspace = addSession(splitGuardWorkspace, "Quartz topic only");
assert.equal(searchWorkspace(splitGuardWorkspace, "zebra quartz", 5).length, 0);
let cjkSearchWorkspace = createDefaultWorkspace();
cjkSearchWorkspace = addSession(cjkSearchWorkspace, "中文学习");
let cjkSession = getActiveSession(cjkSearchWorkspace);
cjkSearchWorkspace = addCapture(cjkSearchWorkspace, cjkSession.id, {
  quote: "保持焦点，不要被浏览器标签打断。",
  thought: "侧边栏应该帮助回到上下文。",
  tags: "学习"
});
const cjkSearch = searchWorkspace(cjkSearchWorkspace, "学习 焦点", 5);
assert.equal(cjkSearch[0].type, "capture");
assert.match(cjkSearch[0].matchLabel, /2 terms:/);
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
