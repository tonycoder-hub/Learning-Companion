import {
  buildFocusBrief,
  captureHasOpenQuestion,
  captureHasParkedQuestion,
  captureHasQuestion,
  getAnswerCaptureItems,
  getDueReviewItems,
  getOpenQuestionItems,
  getParkedQuestionItems,
  getRecentCaptureItems,
  resolveTodayWindow,
  workspaceFromPortableData
} from "../../companion-web/src/model.js";

export const HARMONY_READER_VIEW_SCHEMA = "learning-companion.harmony-reader-view.v1";
export const HARMONY_READER_NEXT_ACTION_PRIORITY = Object.freeze([
  "review_queue",
  "answer_question",
  "read_answers",
  "resume_topic",
  "import_reader_view"
]);
export const HARMONY_READER_NEXT_ACTION_ROUTES = Object.freeze([
  "pages/ReviewQueue",
  "pages/TopicDetail",
  "pages/ImportReceipt"
]);

export function buildHarmonyReaderView(portableData, options = {}) {
  const now = normalizeDate(options.now);
  const workspace = workspaceFromPortableData(portableData);
  const openQuestionItems = getOpenQuestionItems(workspace, 12);
  const parkedQuestionItems = getParkedQuestionItems(workspace, 12);
  const todayWindow = resolveTodayWindow(now);
  const answerItems = getAnswerCaptureItems(workspace, Number.MAX_SAFE_INTEGER, {
    since: todayWindow.start,
    until: todayWindow.end
  });
  const answerLimit = 12;
  const openQuestionCount = countOpenQuestions(workspace);
  const parkedQuestionCount = countParkedQuestions(workspace);
  const unresolvedQuestionCount = openQuestionCount + parkedQuestionCount;
  const topics = workspace.sessions.map((session) => {
    const focusBrief = buildFocusBrief(session, workspace, now);
    const topicParkedQuestionCount = session.captures.filter((capture) => captureHasParkedQuestion(capture)).length;
    return {
      id: session.id,
      title: session.title,
      sourceTitle: session.sourceTitle,
      sourceUrl: session.sourceUrl,
      materialType: session.materialType,
      tags: session.tags,
      captureCount: session.captures.length,
      reviewCardCount: session.reviewCards.length,
      dueReviewCount: focusBrief.stats.dueCards,
      openQuestionCount: focusBrief.stats.questions,
      parkedQuestionCount: topicParkedQuestionCount,
      unresolvedQuestionCount: focusBrief.stats.questions + topicParkedQuestionCount,
      nextAction: focusBrief.nextAction,
      latestCapture: focusBrief.latestCapture
        ? {
            id: focusBrief.latestCapture.id,
            summary: focusBrief.latestCapture.summary,
            capturedAt: focusBrief.latestCapture.capturedAt,
            sourceTitle: focusBrief.latestCapture.sourceTitle,
            sourceHref: focusBrief.latestCapture.sourceHref
          }
        : null
    };
  });
  const activeTopic = topics.find((topic) => topic.id === workspace.activeSessionId) || topics[0] || null;
  const dueReview = getDueReviewItems(workspace, now).slice(0, 20).map((item) => ({
    sessionId: item.sessionId,
    sessionTitle: item.sessionTitle,
    cardId: item.card.id,
    prompt: item.card.prompt,
    answer: item.card.answer,
    dueAt: item.card.dueAt,
    strength: item.card.strength
  }));
  const recentCaptures = getRecentCaptureItems(workspace, 12).map((item) => ({
    sessionId: item.sessionId,
    sessionTitle: item.sessionTitle,
    captureId: item.capture.id,
    quote: item.capture.quote,
    thought: item.capture.thought,
    capturedAt: item.capture.capturedAt || item.capture.createdAt,
    sourceTitle: item.capture.sourceTitle,
    sourceUrl: item.capture.sourceUrl,
    isQuestion: captureHasQuestion(item.capture),
    isOpenQuestion: captureHasOpenQuestion(item.capture),
    isParkedQuestion: captureHasParkedQuestion(item.capture),
    questionResolvedAt: item.capture.questionResolvedAt || "",
    questionParkedAt: item.capture.questionParkedAt || ""
  }));
  const openQuestions = openQuestionItems.map((item) => ({
    sessionId: item.sessionId,
    sessionTitle: item.sessionTitle,
    captureId: item.capture.id,
    quote: item.capture.quote,
    thought: item.capture.thought,
    capturedAt: item.capture.capturedAt || item.capture.createdAt,
    sourceTitle: item.capture.sourceTitle,
    sourceUrl: item.capture.sourceUrl
  }));
  const parkedQuestions = parkedQuestionItems.map((item) => ({
    sessionId: item.sessionId,
    sessionTitle: item.sessionTitle,
    captureId: item.capture.id,
    quote: item.capture.quote,
    thought: item.capture.thought,
    capturedAt: item.capture.capturedAt || item.capture.createdAt,
    questionParkedAt: item.capture.questionParkedAt || "",
    sourceTitle: item.capture.sourceTitle,
    sourceUrl: item.capture.sourceUrl
  }));
  const answersToday = answerItems.slice(0, answerLimit).map((item) => answerTodayItem(item));
  const readerNextAction = buildHarmonyReaderNextAction({
    generatedAt: now.toISOString(),
    activeTopic,
    dueReview,
    openQuestions,
    answersToday,
    recentCaptures,
    answerCount: answerItems.length,
    openQuestionCount
  });
  return {
    schema: HARMONY_READER_VIEW_SCHEMA,
    generatedAt: now.toISOString(),
    mode: "read-only-prototype",
    localDayWindow: {
      start: todayWindow.startIso,
      end: todayWindow.endIso,
      label: todayWindow.label,
      timeZone: todayWindow.timeZone
    },
    source: {
      acceptedSchemas: [
        "learning-companion.workspace.v1",
        "learning-companion.mirror-bundle.staging.v1"
      ],
      canonical: "workspace.json"
    },
    workspace: {
      schema: workspace.schema,
      schemaVersion: workspace.schemaVersion,
      clientId: workspace.clientId,
      sessionCount: workspace.sessions.length,
      openQuestionCount,
      parkedQuestionCount,
      unresolvedQuestionCount,
      answerCaptureCountToday: answerItems.length,
      activeTopicId: activeTopic?.id || ""
    },
    activeTopic,
    readerNextAction,
    topics,
    dueReview,
    recentCaptures,
    openQuestions,
    parkedQuestions,
    answersToday,
    answersTodayOverflow: Math.max(0, answerItems.length - answerLimit),
    limitations: [
      "Prototype reader only; no HarmonyOS storage adapter yet.",
      "Review and inbox patches still use the mirror bundle's static pages.",
      "No live Feishu sync or device file picker is implemented here."
    ]
  };
}

function buildHarmonyReaderNextAction({
  generatedAt,
  activeTopic,
  dueReview,
  openQuestions,
  answersToday,
  recentCaptures,
  answerCount,
  openQuestionCount
}) {
  if (dueReview.length) {
    return withReaderSecondaryAction({
      kind: "review_queue",
      label: "Review due cards",
      detail: dueReview[0]?.prompt || "Reveal the first due card from this import.",
      route: "pages/ReviewQueue",
      routeLabel: "Open Review Queue",
      meta: `${formatCount(dueReview.length, "due card")} from this import`,
      secondary: deferredReaderNextLine({
        openQuestionCount,
        answerCount
      }),
      generatedAt,
      surface: "reader"
    }, readerSecondaryAction({ openQuestionCount, answerCount }));
  }
  if (openQuestions.length) {
    return withReaderSecondaryAction({
      kind: "answer_question",
      label: "Answer next question",
      detail: summarizePhoneAction(openQuestions[0]?.thought || openQuestions[0]?.quote || "Open question"),
      route: "pages/TopicDetail",
      routeLabel: "Open Active Topic",
      meta: `${formatCount(openQuestionCount, "open question")} from this import`,
      secondary: [
        deferredReaderNextLine({ answerCount }),
        "Phone answers should return as append-only JSON for Mac import."
      ].filter(Boolean).join(" "),
      generatedAt,
      surface: "reader"
    }, readerSecondaryAction({ answerCount }));
  }
  if (answersToday.length) {
    return {
      kind: "read_answers",
      label: "Review answers today",
      detail: summarizePhoneAction(answersToday[0]?.thought || "Read the latest answer imported today."),
      route: "pages/TopicDetail",
      routeLabel: "Open Active Topic",
      meta: `${formatCount(answerCount, "answer")} today`,
      secondary: "Answers are a Mac-generated read-only projection.",
      generatedAt,
      surface: "reader"
    };
  }
  if (activeTopic?.latestCapture) {
    return {
      kind: "resume_topic",
      label: activeTopic.nextAction?.label || "Resume topic",
      detail: summarizePhoneAction(activeTopic.latestCapture.summary || activeTopic.nextAction?.detail || "Continue the active topic."),
      route: "pages/TopicDetail",
      routeLabel: "Open Active Topic",
      meta: activeTopic.title || "Active topic",
      secondary: "Static reader view; re-import a fresh mirror for updates.",
      generatedAt,
      surface: "reader"
    };
  }
  return {
    kind: "import_reader_view",
    label: "Import mirror JSON",
    detail: "When the device picker is wired, choose a workspace or mirror bundle before using the phone reader.",
    route: "pages/ImportReceipt",
    routeLabel: "View Import Contract",
    meta: "JSON <= 5 MB; no live sync",
    secondary: "Rejected files keep the previous reader view visible.",
    generatedAt,
    surface: "reader"
  };
}

function withReaderSecondaryAction(action, secondaryAction) {
  return secondaryAction ? { ...action, secondaryAction } : action;
}

function readerSecondaryAction({ openQuestionCount = 0, answerCount = 0 }) {
  if (openQuestionCount) {
    return {
      label: "Answer open questions",
      route: "pages/TopicDetail",
      routeLabel: "Open Questions",
      routeParams: { section: "open_questions" },
      meta: formatCount(openQuestionCount, "open question")
    };
  }
  if (answerCount) {
    return {
      label: "Read answers today",
      route: "pages/TopicDetail",
      routeLabel: "Open Answers",
      routeParams: { section: "answers_today" },
      meta: `${formatCount(answerCount, "answer")} today`
    };
  }
  return null;
}

function deferredReaderNextLine({ openQuestionCount = 0, answerCount = 0 }) {
  const parts = [];
  if (openQuestionCount) parts.push(formatCount(openQuestionCount, "open question"));
  if (answerCount) parts.push(`${formatCount(answerCount, "answer")} today`);
  return parts.length ? `Also: ${parts.join(" · ")}.` : "";
}

function summarizePhoneAction(value) {
  const text = String(value || "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!text) return "Open the active topic for the next reader step.";
  return text.length > 120 ? `${text.slice(0, 117).trimEnd()}...` : text;
}

function formatCount(count, singular) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function countOpenQuestions(workspace) {
  return workspace.sessions.reduce((sum, session) => (
    sum + session.captures.filter((capture) => captureHasOpenQuestion(capture)).length
  ), 0);
}

function countParkedQuestions(workspace) {
  return workspace.sessions.reduce((sum, session) => (
    sum + session.captures.filter((capture) => captureHasParkedQuestion(capture)).length
  ), 0);
}

function normalizeDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  const date = value ? new Date(value) : new Date();
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function answerTodayItem(item) {
  const answerTime = answerCaptureTimestamp(item.capture);
  return {
    sessionId: item.sessionId,
    sessionTitle: item.sessionTitle,
    captureId: item.capture.id,
    quote: item.capture.quote,
    thought: item.capture.thought,
    capturedAt: item.capture.capturedAt || item.capture.createdAt,
    answeredAt: answerTime.iso,
    answeredAtSource: answerTime.source,
    answerReason: item.answerReason,
    questionCaptureId: item.questionCapture?.id || "",
    questionThought: item.questionCapture?.thought || "",
    questionResolvedAt: item.questionCapture?.questionResolvedAt || "",
    sourceTitle: item.capture.sourceTitle,
    sourceUrl: item.capture.sourceUrl
  };
}

function answerCaptureTimestamp(capture) {
  if (capture?.inboxPatchId) {
    const updatedAt = normalizeOptionalDate(capture.updatedAt);
    if (updatedAt) return { iso: updatedAt, source: "updatedAt-inbox-import" };
  }
  const capturedAt = normalizeOptionalDate(capture?.capturedAt);
  if (capturedAt) return { iso: capturedAt, source: "capturedAt" };
  const createdAt = normalizeOptionalDate(capture?.createdAt);
  if (createdAt) return { iso: createdAt, source: "createdAt" };
  return { iso: "", source: "" };
}

function normalizeOptionalDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}
