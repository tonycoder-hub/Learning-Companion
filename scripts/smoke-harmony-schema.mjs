import assert from "node:assert/strict";
import {
  addCapture,
  applyGrade,
  buildMirrorBundle,
  createDefaultWorkspace,
  getActiveSession,
  promoteCapture,
  sanitizeWorkspace,
  setCaptureQuestionParked,
  setCaptureQuestionResolved,
  updateSession
} from "../apps/companion-web/src/model.js";
import {
  HARMONY_READER_NEXT_ACTION_PRIORITY,
  HARMONY_READER_NEXT_ACTION_ROUTES,
  HARMONY_READER_VIEW_SCHEMA,
  buildHarmonyReaderView
} from "../apps/companion-harmony/src/schema-reader.mjs";
import {
  applyHarmonyImportResult,
  createHarmonyReaderSessionState,
  markHarmonyReaderSessionPersisted,
  summarizeHarmonyReaderSessionState
} from "../apps/companion-harmony/src/import-session.mjs";
import {
  HARMONY_IMPORT_MAX_BYTES,
  HARMONY_IMPORT_RECEIPT_SCHEMA,
  buildHarmonyPatchEnvelope,
  importPortableForHarmony,
  validateHarmonyImportFileCandidate
} from "../apps/companion-harmony/src/import-boundary.mjs";

const now = new Date("2026-05-29T08:20:00.000+08:00");
let workspace = createDefaultWorkspace();
const active = getActiveSession(workspace);
workspace = addCapture(workspace, active.id, {
  quote: "HarmonyOS reader should preserve a fresh learning capture.",
  thought: "Use this as the first phone-side topic preview.",
  timestamp: "00:03:12",
  tags: "harmony reader",
  sourceTitle: "Mac study video",
  sourceUrl: "https://example.com/study?t=192"
}, { now });
const captureId = getActiveSession(workspace).captures.find((capture) => (
  capture.thought === "Use this as the first phone-side topic preview."
)).id;
workspace = addCapture(workspace, active.id, {
  quote: "The phone should keep unfinished questions visible.",
  thought: "What should I check first when I resume this topic on HarmonyOS?",
  timestamp: "00:04:10",
  tags: "harmony reader question",
  sourceTitle: "Mac study video",
  sourceUrl: "https://example.com/study?t=250"
}, { now: new Date("2026-05-29T08:21:00.000+08:00") });
const openQuestionCaptureId = getActiveSession(workspace).captures.find((capture) => (
  capture.thought === "What should I check first when I resume this topic on HarmonyOS?"
)).id;
workspace = setCaptureQuestionResolved(workspace, active.id, openQuestionCaptureId, true);
workspace = setCaptureQuestionResolved(workspace, active.id, openQuestionCaptureId, false);
workspace = addCapture(workspace, active.id, {
  quote: "Resolved questions should stay as evidence without filling the backlog.",
  thought: "How do I keep answered phone questions out of the open list?",
  timestamp: "00:05:11",
  tags: "harmony reader question",
  sourceTitle: "Mac study video",
  sourceUrl: "https://example.com/study?t=311"
}, { now: new Date("2026-05-29T08:22:00.000+08:00") });
const resolvedQuestionCaptureId = getActiveSession(workspace).captures.find((capture) => (
  capture.thought === "How do I keep answered phone questions out of the open list?"
)).id;
workspace = setCaptureQuestionResolved(workspace, active.id, resolvedQuestionCaptureId, true);
workspace = addCapture(workspace, active.id, {
  quote: "A linked answer should be visible on the phone today.",
  thought: "Answer: keep answered phone questions in Answers Today without putting them back in the backlog.",
  timestamp: "00:05:40",
  tags: "harmony reader answer",
  sourceTitle: "Mac study video",
  sourceUrl: "https://example.com/study?t=340",
  answersQuestionCaptureId: resolvedQuestionCaptureId
}, { now: new Date("2026-05-29T08:24:00.000+08:00") });
const answerCaptureId = getActiveSession(workspace).captures.find((capture) => (
  capture.answersQuestionCaptureId === resolvedQuestionCaptureId
)).id;
workspace = addCapture(workspace, active.id, {
  quote: "A phone answer imported today should stay visible even when the original capture is older.",
  thought: "Answer: this was captured earlier on the phone but landed on the Mac today.",
  timestamp: "00:05:45",
  tags: "harmony reader answer",
  sourceTitle: "Mac study video",
  sourceUrl: "https://example.com/study?t=345",
  answersQuestionCaptureId: resolvedQuestionCaptureId
}, { now: new Date("2026-05-26T08:24:00.000+08:00") });
const inboxAnswerCaptureId = getActiveSession(workspace).captures.find((capture) => (
  capture.thought === "Answer: this was captured earlier on the phone but landed on the Mac today."
)).id;
workspace = updateSession(workspace, active.id, {
  captures: getActiveSession(workspace).captures.map((capture) => capture.id === inboxAnswerCaptureId
    ? {
        ...capture,
        inboxPatchId: "harmony_inbox_answer_patch_001",
        updatedAt: "2026-05-29T00:25:00.000Z"
      }
    : capture)
});
workspace = addCapture(workspace, active.id, {
  quote: "An old local answer edited today should not be reclassified as today's phone answer.",
  thought: "Answer: this old local answer was edited today but was not imported today.",
  timestamp: "00:05:50",
  tags: "harmony reader answer",
  sourceTitle: "Mac study video",
  sourceUrl: "https://example.com/study?t=350"
}, { now: new Date("2026-05-28T08:24:00.000+08:00") });
const editedOldAnswerCaptureId = getActiveSession(workspace).captures.find((capture) => (
  capture.thought === "Answer: this old local answer was edited today but was not imported today."
)).id;
workspace = updateSession(workspace, active.id, {
  captures: getActiveSession(workspace).captures.map((capture) => capture.id === editedOldAnswerCaptureId
    ? { ...capture, updatedAt: "2026-05-29T00:26:00.000Z" }
    : capture)
});
workspace = addCapture(workspace, active.id, {
  quote: "Parked questions should wait without crowding the active phone backlog.",
  thought: "Which HarmonyOS question can wait until the next study block?",
  timestamp: "00:06:02",
  tags: "harmony reader question parked",
  sourceTitle: "Mac study video",
  sourceUrl: "https://example.com/study?t=362"
}, { now: new Date("2026-05-29T08:23:00.000+08:00") });
const parkedQuestionCaptureId = getActiveSession(workspace).captures.find((capture) => (
  capture.thought === "Which HarmonyOS question can wait until the next study block?"
)).id;
workspace = setCaptureQuestionParked(workspace, active.id, parkedQuestionCaptureId, true);
for (let index = 0; index < 13; index += 1) {
  workspace = addCapture(workspace, active.id, {
    quote: `Extra phone backlog question ${index + 1}.`,
    thought: `What is the extra HarmonyOS backlog question ${index + 1}?`,
    tags: "harmony backlog",
    sourceTitle: "Mac study video",
    sourceUrl: "https://example.com/study"
  }, { now: new Date(`2026-05-29T07:${String(index).padStart(2, "0")}:00.000+08:00`) });
}
workspace = promoteCapture(workspace, active.id, captureId, { now });
const card = getActiveSession(workspace).reviewCards[0];
workspace = updateSession(workspace, active.id, {
  reviewCards: getActiveSession(workspace).reviewCards.map((item) => item.id === card.id
    ? applyGrade(item, "again", new Date("2026-05-28T08:20:00.000+08:00"))
    : item)
});
workspace = sanitizeWorkspace(workspace);

const workspaceView = buildHarmonyReaderView(workspace, { now });
assert.equal(workspaceView.schema, HARMONY_READER_VIEW_SCHEMA);
assert.deepEqual(HARMONY_READER_NEXT_ACTION_PRIORITY, ["review_queue", "answer_question", "read_answers", "resume_topic", "import_reader_view"]);
assert.deepEqual(HARMONY_READER_NEXT_ACTION_ROUTES, ["pages/ReviewQueue", "pages/TopicDetail", "pages/ImportReceipt"]);
assert.equal(workspaceView.mode, "read-only-prototype");
assert.equal(workspaceView.workspace.sessionCount, workspace.sessions.length);
assert.equal(workspaceView.workspace.activeTopicId, workspace.activeSessionId);
assert.equal(workspaceView.activeTopic.title, getActiveSession(workspace).title);
assert.equal(workspaceView.activeTopic.nextAction.reason, "Active topic has due review due now.");
assert.equal(workspaceView.activeTopic.nextAction.detail, "Reveal and grade before adding more material.");
assert.equal(workspaceView.readerNextAction.kind, "review_queue");
assert.equal(workspaceView.readerNextAction.label, "Review due cards");
assert.equal(workspaceView.readerNextAction.route, "pages/ReviewQueue");
assert.equal(workspaceView.readerNextAction.routeLabel, "Open Review Queue");
assert.equal(HARMONY_READER_NEXT_ACTION_ROUTES.includes(workspaceView.readerNextAction.route), true);
assert.equal(workspaceView.readerNextAction.surface, "reader");
assert.match(workspaceView.readerNextAction.meta, /1 due card from this import/);
assert.match(workspaceView.readerNextAction.secondary, /Also: 14 open questions · 2 answers today\./);
assert.equal(workspaceView.readerNextAction.secondaryAction.label, "Answer open questions");
assert.equal(workspaceView.readerNextAction.secondaryAction.route, "pages/TopicDetail");
assert.equal(workspaceView.readerNextAction.secondaryAction.routeLabel, "Open Questions");
assert.equal(workspaceView.readerNextAction.secondaryAction.routeParams.section, "open_questions");
assert.match(workspaceView.readerNextAction.secondaryAction.meta, /^\d+ open questions$/);
assert.equal(workspaceView.readerNextAction.generatedAt, now.toISOString());
assert.equal(Number.isFinite(Date.parse(workspaceView.readerNextAction.generatedAt)), true);
assert.equal(workspaceView.activeTopic.openQuestionCount, 14);
assert.equal(workspaceView.activeTopic.parkedQuestionCount, 1);
assert.equal(workspaceView.activeTopic.unresolvedQuestionCount, 15);
assert.equal(workspaceView.workspace.openQuestionCount, 14);
assert.equal(workspaceView.workspace.parkedQuestionCount, 1);
assert.equal(workspaceView.workspace.unresolvedQuestionCount, 15);
assert.equal(workspaceView.workspace.answerCaptureCountToday, 2);
assert.equal(workspaceView.localDayWindow.label.includes("2026-05-29"), true);
assert.equal(workspaceView.topics.length, workspace.sessions.length);
assert.equal(workspaceView.topics.some((topic) => topic.captureCount > 0), true);
assert.equal(workspaceView.dueReview.length, 1);
assert.equal(workspaceView.dueReview[0].answer.includes("HarmonyOS reader"), true);
assert.equal(workspaceView.openQuestions.length, 12);
assert.equal(workspaceView.openQuestions.some((item) => item.captureId === openQuestionCaptureId), true);
assert.equal(workspaceView.openQuestions.some((item) => item.captureId === parkedQuestionCaptureId), false);
assert.equal(workspaceView.openQuestions.every((item) => item.thought.endsWith("?")), true);
assert.equal(workspaceView.parkedQuestions.length, 1);
assert.equal(workspaceView.parkedQuestions[0].captureId, parkedQuestionCaptureId);
assert.equal(workspaceView.parkedQuestions[0].questionParkedAt.length > 0, true);
const recentOpenQuestion = workspaceView.recentCaptures.find((item) => item.captureId === openQuestionCaptureId);
assert.equal(recentOpenQuestion.isQuestion, true);
assert.equal(recentOpenQuestion.isOpenQuestion, true);
assert.equal(recentOpenQuestion.questionResolvedAt, "");
assert.equal(recentOpenQuestion.isParkedQuestion, false);
assert.equal(recentOpenQuestion.questionParkedAt, "");
const recentParkedQuestion = workspaceView.recentCaptures.find((item) => item.captureId === parkedQuestionCaptureId);
assert.equal(recentParkedQuestion.isQuestion, true);
assert.equal(recentParkedQuestion.isOpenQuestion, false);
assert.equal(recentParkedQuestion.isParkedQuestion, true);
assert.equal(recentParkedQuestion.questionResolvedAt, "");
assert.equal(recentParkedQuestion.questionParkedAt.length > 0, true);
const recentResolvedQuestion = workspaceView.recentCaptures.find((item) => item.captureId === resolvedQuestionCaptureId);
assert.equal(recentResolvedQuestion.isQuestion, true);
assert.equal(recentResolvedQuestion.isOpenQuestion, false);
assert.equal(recentResolvedQuestion.isParkedQuestion, false);
assert.equal(typeof recentResolvedQuestion.questionResolvedAt, "string");
assert.notEqual(recentResolvedQuestion.questionResolvedAt, "");
const recentLearningCapture = workspaceView.recentCaptures.find((item) => item.captureId === captureId);
assert.equal(recentLearningCapture.quote, "HarmonyOS reader should preserve a fresh learning capture.");
assert.equal(recentLearningCapture.isQuestion, false);
assert.equal(recentLearningCapture.isOpenQuestion, false);
assert.equal(recentLearningCapture.isParkedQuestion, false);
assert.equal(typeof recentLearningCapture.isQuestion, "boolean");
assert.equal(typeof recentLearningCapture.isOpenQuestion, "boolean");
assert.equal(typeof recentLearningCapture.isParkedQuestion, "boolean");
assert.equal(recentLearningCapture.questionResolvedAt, "");
assert.equal(recentLearningCapture.questionParkedAt, "");
assert.equal(workspaceView.answersToday.length, 2);
assert.equal(workspaceView.answersTodayOverflow, 0);
assert.equal(workspaceView.workspace.answerCaptureCountToday, workspaceView.answersToday.length + workspaceView.answersTodayOverflow);
assert.equal(workspaceView.answersToday[0].captureId, inboxAnswerCaptureId);
assert.equal(workspaceView.answersToday[0].answeredAt, "2026-05-29T00:25:00.000Z");
assert.equal(workspaceView.answersToday[0].answeredAtSource, "updatedAt-inbox-import");
assert.equal(workspaceView.answersToday[1].captureId, answerCaptureId);
assert.equal(workspaceView.answersToday[1].answerReason, "linked-question");
assert.equal(workspaceView.answersToday[1].questionCaptureId, resolvedQuestionCaptureId);
assert.equal(workspaceView.answersToday[1].questionThought, "How do I keep answered phone questions out of the open list?");
assert.equal(workspaceView.answersToday[1].questionResolvedAt.length > 0, true);
assert.equal(workspaceView.answersToday[1].answeredAt, "2026-05-29T00:24:00.000Z");
assert.equal(workspaceView.answersToday[1].answeredAtSource, "capturedAt");
assert.equal(workspaceView.answersToday.some((item) => item.captureId === editedOldAnswerCaptureId), false);
assert.equal(workspaceView.limitations.some((item) => item.includes("Prototype reader only")), true);

const mirror = buildMirrorBundle(workspace);
const mirrorView = buildHarmonyReaderView(mirror, { now });
assert.deepEqual(
  mirrorView.topics.map((topic) => topic.id).sort(),
  workspaceView.topics.map((topic) => topic.id).sort()
);
assert.equal(mirrorView.activeTopic.id, workspaceView.activeTopic.id);
assert.equal(mirrorView.dueReview[0].cardId, workspaceView.dueReview[0].cardId);
assert.equal(mirrorView.workspace.openQuestionCount, workspaceView.workspace.openQuestionCount);
assert.equal(mirrorView.workspace.parkedQuestionCount, workspaceView.workspace.parkedQuestionCount);
assert.equal(mirrorView.workspace.unresolvedQuestionCount, workspaceView.workspace.unresolvedQuestionCount);
assert.equal(mirrorView.activeTopic.openQuestionCount, workspaceView.activeTopic.openQuestionCount);
assert.equal(mirrorView.activeTopic.parkedQuestionCount, workspaceView.activeTopic.parkedQuestionCount);
assert.equal(mirrorView.activeTopic.unresolvedQuestionCount, workspaceView.activeTopic.unresolvedQuestionCount);
assert.deepEqual(mirrorView.openQuestions, workspaceView.openQuestions);
assert.deepEqual(mirrorView.parkedQuestions, workspaceView.parkedQuestions);
assert.equal(mirrorView.workspace.answerCaptureCountToday, workspaceView.workspace.answerCaptureCountToday);
assert.deepEqual(mirrorView.answersToday, workspaceView.answersToday);
assert.equal(mirrorView.answersTodayOverflow, workspaceView.answersTodayOverflow);
assert.deepEqual(mirrorView.readerNextAction, workspaceView.readerNextAction);

let questionOnlyWorkspace = createDefaultWorkspace();
const questionOnlyActive = getActiveSession(questionOnlyWorkspace);
questionOnlyWorkspace = addCapture(questionOnlyWorkspace, questionOnlyActive.id, {
  quote: "Question-only Harmony import should not pretend review is due.",
  thought: "What should the phone reader answer first?",
  tags: "harmony question"
}, { now });
const questionOnlyView = buildHarmonyReaderView(questionOnlyWorkspace, { now });
assert.equal(questionOnlyView.dueReview.length, 0);
assert.equal(questionOnlyView.readerNextAction.kind, "answer_question");
assert.equal(questionOnlyView.readerNextAction.label, "Answer next question");
assert.equal(questionOnlyView.readerNextAction.route, "pages/TopicDetail");
assert.equal(HARMONY_READER_NEXT_ACTION_ROUTES.includes(questionOnlyView.readerNextAction.route), true);
assert.match(questionOnlyView.readerNextAction.detail, /What should the phone reader answer first\?/);
assert.match(questionOnlyView.readerNextAction.secondary, /append-only JSON/);
assert.equal(questionOnlyView.readerNextAction.secondaryAction, undefined);

let questionAndAnswerWorkspace = createDefaultWorkspace();
const questionAndAnswerActive = getActiveSession(questionAndAnswerWorkspace);
questionAndAnswerWorkspace = addCapture(questionAndAnswerWorkspace, questionAndAnswerActive.id, {
  quote: "Question plus answer import should keep both lanes reachable.",
  thought: "What should the phone reader answer next?",
  tags: "harmony question"
}, { now });
questionAndAnswerWorkspace = addCapture(questionAndAnswerWorkspace, questionAndAnswerActive.id, {
  quote: "An answer today can be reviewed after the open question.",
  thought: "Answer: keep the already captured answer visible as a secondary lane.",
  tags: "harmony answer"
}, { now });
const questionAndAnswerView = buildHarmonyReaderView(questionAndAnswerWorkspace, { now });
assert.equal(questionAndAnswerView.readerNextAction.kind, "answer_question");
assert.equal(questionAndAnswerView.readerNextAction.secondaryAction.label, "Read answers today");
assert.equal(questionAndAnswerView.readerNextAction.secondaryAction.route, "pages/TopicDetail");
assert.equal(questionAndAnswerView.readerNextAction.secondaryAction.routeLabel, "Open Answers");
assert.equal(questionAndAnswerView.readerNextAction.secondaryAction.routeParams.section, "answers_today");
assert.match(questionAndAnswerView.readerNextAction.secondaryAction.meta, /^\d+ answer today$/);

const emptyReaderView = buildHarmonyReaderView(createDefaultWorkspace(), { now });
assert.notEqual(emptyReaderView.readerNextAction, null);
assert.equal(HARMONY_READER_NEXT_ACTION_ROUTES.includes(emptyReaderView.readerNextAction.route), true);
assert.equal(emptyReaderView.readerNextAction.secondaryAction, undefined);

const workspaceImport = importPortableForHarmony(workspace, { now });
assert.equal(workspaceImport.ok, true);
assert.equal(workspaceImport.receipt.schema, HARMONY_IMPORT_RECEIPT_SCHEMA);
assert.equal(workspaceImport.receipt.sourceKind, "workspace");
assert.equal(workspaceImport.receipt.readerViewSchema, HARMONY_READER_VIEW_SCHEMA);
assert.equal(workspaceImport.view.activeTopic.id, workspace.activeSessionId);
assert.equal(workspaceImport.receipt.answerCaptureCountToday, 2);

const emptyReaderSession = createHarmonyReaderSessionState({ now });
assert.equal(emptyReaderSession.importStatus.state, "empty");
assert.equal(emptyReaderSession.currentView, null);
const persistWithoutView = markHarmonyReaderSessionPersisted(emptyReaderSession, {
  savedAt: "2026-05-29T00:29:00.000Z",
  storageAdapter: "harmony-preferences",
  key: "lastReaderView"
});
assert.equal(persistWithoutView, emptyReaderSession);
assert.equal(persistWithoutView.storage.status, "empty");
const acceptedReaderSession = applyHarmonyImportResult(emptyReaderSession, workspaceImport);
assert.equal(acceptedReaderSession.importStatus.state, "accepted-pending-persist");
assert.equal(acceptedReaderSession.importStatus.changedView, true);
assert.equal(acceptedReaderSession.currentView.activeTopic.id, workspace.activeSessionId);
assert.equal(acceptedReaderSession.storage.status, "pending-device-persistence");
assert.match(summarizeHarmonyReaderSessionState(acceptedReaderSession), /answers today/);
const persistedReaderSession = markHarmonyReaderSessionPersisted(acceptedReaderSession, {
  savedAt: "2026-05-29T00:30:00.000Z",
  storageAdapter: "harmony-preferences",
  key: "lastReaderView"
});
assert.equal(persistedReaderSession.importStatus.state, "ready");
assert.equal(persistedReaderSession.storage.status, "persisted-by-device-adapter");
assert.equal(persistedReaderSession.storage.key, "lastReaderView");

const mirrorImport = importPortableForHarmony(mirror, { now });
assert.equal(mirrorImport.ok, true);
assert.equal(mirrorImport.receipt.sourceKind, "mirror-bundle");
assert.equal(mirrorImport.receipt.topicCount, workspace.sessions.length);

const acceptedFileCandidate = validateHarmonyImportFileCandidate({
  name: "workspace.json",
  size: HARMONY_IMPORT_MAX_BYTES
});
assert.equal(acceptedFileCandidate.ok, true);
assert.deepEqual(acceptedFileCandidate.acceptedExtensions, [".json"]);
const acceptedUppercaseExtension = validateHarmonyImportFileCandidate({
  name: "workspace.JSON",
  size: 1024
});
assert.equal(acceptedUppercaseExtension.ok, true);
const acceptedByteLengthFallback = validateHarmonyImportFileCandidate({
  fileName: "mirror.JSON",
  byteLength: 1024
});
assert.equal(acceptedByteLengthFallback.ok, true);
const sizeWinsOverByteLength = validateHarmonyImportFileCandidate({
  name: "workspace.json",
  size: HARMONY_IMPORT_MAX_BYTES,
  byteLength: HARMONY_IMPORT_MAX_BYTES + 1
});
assert.equal(sizeWinsOverByteLength.ok, true);
const rejectedFileType = validateHarmonyImportFileCandidate({
  name: "workspace.txt",
  size: 1024
});
assert.equal(rejectedFileType.ok, false);
assert.equal(rejectedFileType.errorCode, "UNSUPPORTED_FILE_TYPE");
const rejectedMissingName = validateHarmonyImportFileCandidate({
  size: 1024
});
assert.equal(rejectedMissingName.ok, false);
assert.equal(rejectedMissingName.errorCode, "UNSUPPORTED_FILE_TYPE");
const rejectedOversizeFile = validateHarmonyImportFileCandidate({
  name: "workspace.json",
  size: HARMONY_IMPORT_MAX_BYTES + 1
});
assert.equal(rejectedOversizeFile.ok, false);
assert.equal(rejectedOversizeFile.errorCode, "PORTABLE_FILE_TOO_LARGE");
for (const size of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, undefined]) {
  const rejectedInvalidSize = validateHarmonyImportFileCandidate({
    name: "workspace.json",
    size
  });
  assert.equal(rejectedInvalidSize.ok, false);
  assert.equal(rejectedInvalidSize.errorCode, "INVALID_FILE_SIZE");
}

const rejectedPatchImport = importPortableForHarmony({
  schema: "learning-companion.mobile-inbox-patch.v1",
  patchId: "phone_patch_should_not_import_here",
  captures: []
}, { now });
assert.equal(rejectedPatchImport.ok, false);
assert.equal(rejectedPatchImport.receipt.errorCode, "PATCH_IMPORT_NOT_SUPPORTED_ON_READER");
const rejectedEmptyReaderSession = applyHarmonyImportResult(emptyReaderSession, rejectedPatchImport);
assert.equal(rejectedEmptyReaderSession.importStatus.state, "rejected-empty");
assert.equal(rejectedEmptyReaderSession.importStatus.changedView, false);
assert.equal(rejectedEmptyReaderSession.currentView, null);
assert.equal(rejectedEmptyReaderSession.lastImportReceipt.errorCode, "PATCH_IMPORT_NOT_SUPPORTED_ON_READER");
const previousView = persistedReaderSession.currentView;
const previousViewSnapshot = JSON.parse(JSON.stringify(previousView));
const rejectedReaderSession = applyHarmonyImportResult(persistedReaderSession, rejectedPatchImport);
assert.equal(rejectedReaderSession.importStatus.state, "rejected-kept-current");
assert.equal(rejectedReaderSession.importStatus.changedView, false);
assert.equal(rejectedReaderSession.currentView, previousView);
assert.deepEqual(rejectedReaderSession.currentView, previousViewSnapshot);
assert.equal(rejectedReaderSession.currentView.activeTopic.id, workspace.activeSessionId);
assert.equal(rejectedReaderSession.lastImportReceipt.errorCode, "PATCH_IMPORT_NOT_SUPPORTED_ON_READER");
assert.equal(rejectedReaderSession.lastImportReceipt.ok, false);
const secondAcceptedReaderSession = applyHarmonyImportResult(rejectedReaderSession, mirrorImport);
assert.equal(secondAcceptedReaderSession.importStatus.state, "accepted-pending-persist");
assert.equal(secondAcceptedReaderSession.lastImportReceipt.ok, true);
assert.equal(secondAcceptedReaderSession.lastImportReceipt.sourceKind, "mirror-bundle");

const inboxEnvelope = buildHarmonyPatchEnvelope("inbox", {
  now,
  patchId: "harmony_inbox_patch_001",
  workspaceFingerprint: "fnv1a-test",
  target: { topicId: active.id, topicTitle: active.title },
  captures: [{
    quote: "Harmony native capture draft.",
    thought: "Append-only phone write.",
    tags: "harmony"
  }]
});
assert.equal(inboxEnvelope.schema, "learning-companion.mobile-inbox-patch.v1");
assert.equal(inboxEnvelope.captures[0].id, "harmony_inbox_patch_001_capture_1");
assert.equal(inboxEnvelope.target.topicId, active.id);

const reviewEnvelope = buildHarmonyPatchEnvelope("review-progress", {
  now,
  patchId: "harmony_review_patch_001",
  workspaceFingerprint: "fnv1a-test",
  target: { topicId: active.id, topicTitle: active.title },
  events: [{
    cardId: card.id,
    grade: "good",
    baseUpdatedAt: card.updatedAt,
    baseDueAt: card.dueAt,
    baseStrength: card.strength
  }]
});
assert.equal(reviewEnvelope.schema, "learning-companion.review-progress-patch.v1");
assert.equal(reviewEnvelope.events[0].id, "harmony_review_patch_001_event_1");
assert.equal(reviewEnvelope.events[0].sessionId, active.id);

assert.throws(() => buildHarmonyPatchEnvelope("sync", { patchId: "bad" }), /Unsupported Harmony patch/);
assert.throws(() => buildHarmonyReaderView({ schema: "unknown" }, { now }), /Unsupported/);

console.log("smoke_harmony_schema_ok");
