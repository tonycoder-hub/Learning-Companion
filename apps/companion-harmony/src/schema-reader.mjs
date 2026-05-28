import {
  buildFocusBrief,
  getDueReviewItems,
  getRecentCaptureItems,
  workspaceFromPortableData
} from "../../companion-web/src/model.js";

export const HARMONY_READER_VIEW_SCHEMA = "learning-companion.harmony-reader-view.v1";

export function buildHarmonyReaderView(portableData, options = {}) {
  const now = normalizeDate(options.now);
  const workspace = workspaceFromPortableData(portableData);
  const topics = workspace.sessions.map((session) => {
    const focusBrief = buildFocusBrief(session, workspace, now);
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
  return {
    schema: HARMONY_READER_VIEW_SCHEMA,
    generatedAt: now.toISOString(),
    mode: "read-only-prototype",
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
      activeTopicId: activeTopic?.id || ""
    },
    activeTopic,
    topics,
    dueReview: getDueReviewItems(workspace, now).slice(0, 20).map((item) => ({
      sessionId: item.sessionId,
      sessionTitle: item.sessionTitle,
      cardId: item.card.id,
      prompt: item.card.prompt,
      answer: item.card.answer,
      dueAt: item.card.dueAt,
      strength: item.card.strength
    })),
    recentCaptures: getRecentCaptureItems(workspace, 12).map((item) => ({
      sessionId: item.sessionId,
      sessionTitle: item.sessionTitle,
      captureId: item.capture.id,
      quote: item.capture.quote,
      thought: item.capture.thought,
      capturedAt: item.capture.capturedAt || item.capture.createdAt,
      sourceTitle: item.capture.sourceTitle,
      sourceUrl: item.capture.sourceUrl
    })),
    limitations: [
      "Prototype reader only; no HarmonyOS storage adapter yet.",
      "Review and inbox patches still use the mirror bundle's static pages.",
      "No live Feishu sync or device file picker is implemented here."
    ]
  };
}

function normalizeDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  const date = value ? new Date(value) : new Date();
  return Number.isFinite(date.getTime()) ? date : new Date();
}
