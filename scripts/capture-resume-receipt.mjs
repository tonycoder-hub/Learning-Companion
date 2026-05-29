import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  addCapture,
  buildFocusBrief,
  buildSourceJumpUrl,
  buildTodayPack,
  createSession,
  generateTodayMarkdown,
  resolveCaptureDraftFocusOverride,
  sanitizeWorkspace
} from "../apps/companion-web/src/model.js";

export const CAPTURE_RESUME_RECEIPT_SCHEMA = "learning-companion.capture-resume-receipt.v1";

export function buildCaptureResumeReceipt(options = {}) {
  const baseTime = parseDate(options.generatedAt) || new Date(Date.now() + 60_000);
  const workspace = sanitizeWorkspace(buildSeedWorkspace(baseTime));
  const beforeToday = generateTodayMarkdown(workspace, baseTime);
  const beforePack = buildTodayPack(workspace, baseTime, { recentLimit: 5 });
  const captureEvents = buildCaptureEvents(baseTime);
  let capturedWorkspace = workspace;

  captureEvents.forEach((event) => {
    capturedWorkspace = addCapture(capturedWorkspace, "session_capture_resume", event, {
      promoteToReview: false,
      now: event.capturedAt
    });
  });

  const afterToday = generateTodayMarkdown(capturedWorkspace, baseTime);
  const afterPack = buildTodayPack(capturedWorkspace, baseTime, { recentLimit: 5 });
  const beforeSession = workspace.sessions.find((session) => session.id === "session_capture_resume");
  const afterSession = capturedWorkspace.sessions.find((session) => session.id === "session_capture_resume");
  const addedCaptures = afterSession.captures.slice(0, captureEvents.length);
  const eventThoughts = new Set(captureEvents.map((event) => event.thought));
  const recentThoughts = new Set(afterPack.recentCaptures.map((item) => item.capture.thought));

  assert.equal(afterSession.captures.length - beforeSession.captures.length, captureEvents.length);
  assert.equal(afterPack.stats.captures - beforePack.stats.captures, captureEvents.length);
  captureEvents.forEach((event) => {
    assert.equal(afterToday.includes(event.thought), true);
    assert.equal(recentThoughts.has(event.thought), true);
  });
  assert.equal(afterPack.focusBrief.nextAction.kind, "synthesize");
  const draftFocus = buildDraftFocusReceipt(baseTime);

  return {
    schema: CAPTURE_RESUME_RECEIPT_SCHEMA,
    evidence: {
      tier: "EXECUTED",
      label: "EVIDENCE: EXECUTED",
      reason: "Pure model round-trip uses addCapture, buildTodayPack, and generateTodayMarkdown without GUI approvals."
    },
    generatedAt: baseTime.toISOString(),
    store: {
      path: "workspace.sessions[].captures",
      writeFunction: "addCapture",
      resumeFunctions: ["buildTodayPack", "generateTodayMarkdown"]
    },
    input: {
      eventCount: captureEvents.length,
      eventsSha256: sha256Json(captureEvents),
      events: captureEvents.map((event) => ({
        id: event.id,
        quoteSha256: sha256Text(event.quote),
        thought: event.thought,
        timestamp: event.timestamp,
        capturedAt: event.capturedAt,
        sourceTitle: event.sourceTitle,
        sourceUrl: event.sourceUrl,
        sourceJumpUrl: buildSourceJumpUrl(event.sourceUrl, event.timestamp),
        tags: event.tags
      }))
    },
    before: {
      captureCount: beforePack.stats.captures,
      recentCaptureCount: beforePack.recentCaptures.length,
      todaySha256: sha256Text(beforeToday),
      workspaceSha256: sha256Json(workspace)
    },
    after: {
      captureCount: afterPack.stats.captures,
      recentCaptureCount: afterPack.recentCaptures.length,
      todaySha256: sha256Text(afterToday),
      workspaceSha256: sha256Json(capturedWorkspace),
      focusBrief: {
        sessionId: afterPack.focusBrief.sessionId,
        nextAction: afterPack.focusBrief.nextAction,
        latestCapture: afterPack.focusBrief.latestCapture,
        capturesSinceLastSynthesis: afterPack.focusBrief.stats.capturesSinceLastSynthesis
      },
      recentCaptures: afterPack.recentCaptures.map(({ sessionId, sessionTitle, capture }) => ({
        sessionId,
        sessionTitle,
        captureId: capture.id,
        thought: capture.thought,
        timestamp: capture.timestamp,
        sourceJumpUrl: buildSourceJumpUrl(capture.sourceUrl, capture.timestamp)
      }))
    },
    roundTrip: {
      ok: true,
      addedCaptureCount: addedCaptures.length,
      todayHashChanged: sha256Text(beforeToday) !== sha256Text(afterToday),
      workspaceHashChanged: sha256Json(workspace) !== sha256Json(capturedWorkspace),
      allInputsVisibleInToday: captureEvents.every((event) => afterToday.includes(event.thought)),
      allInputsVisibleInRecentCaptures: captureEvents.every((event) => recentThoughts.has(event.thought)),
      focusBriefNextAction: afterPack.focusBrief.nextAction.kind,
      sourceUrlsPreserved: addedCaptures.every((capture) => Boolean(buildSourceJumpUrl(capture.sourceUrl, capture.timestamp)))
    },
    draftFocus,
    todayDiff: summarizeLineDiff(beforeToday, afterToday)
  };
}

function buildDraftFocusReceipt(baseTime) {
  const freshDraft = {
    quote: "Uncommitted quote should resume only when review is not due.",
    thought: "Draft is local UI state, not workspace truth.",
    updatedAt: new Date(baseTime.getTime() - 60_000).toISOString()
  };
  const staleDraft = {
    thought: "Old draft should stay visible in Today, not own Focus Brief.",
    updatedAt: new Date(baseTime.getTime() - 25 * 60 * 60_000).toISOString()
  };
  const timestampOnlyDraft = {
    timestamp: "08:12",
    updatedAt: new Date(baseTime.getTime() - 60_000).toISOString()
  };
  const dueSession = createSession({
    id: "draft_focus_due",
    title: "Draft focus due review",
    sourceUrl: "https://example.com/draft-focus",
    reviewCards: [{
      id: "draft_focus_due_card",
      prompt: "What wins over draft resume?",
      answer: "Due review.",
      dueAt: new Date(baseTime.getTime() - 60_000).toISOString(),
      strength: 0
    }]
  }, "client_capture_resume_receipt");
  const dueWorkspace = sanitizeWorkspace({
    schema: "learning-companion.workspace.v1",
    schemaVersion: 1,
    version: 1,
    clientId: "client_capture_resume_receipt",
    activeSessionId: dueSession.id,
    importedPatches: [],
    importedReviewPatches: [],
    createdAt: baseTime.toISOString(),
    updatedAt: baseTime.toISOString(),
    sessions: [dueSession]
  });
  const dueBrief = buildFocusBrief(dueSession, dueWorkspace, baseTime);
  const synthesisBrief = buildFocusBrief(createSession({
    id: "draft_focus_synthesis",
    title: "Draft focus synthesis",
    sourceUrl: "https://example.com/draft-focus",
    captures: [
      { id: "draft_focus_cap_1", thought: "First", capturedAt: new Date(baseTime.getTime() - 180_000).toISOString() },
      { id: "draft_focus_cap_2", thought: "Second", capturedAt: new Date(baseTime.getTime() - 120_000).toISOString() },
      { id: "draft_focus_cap_3", thought: "Third", capturedAt: new Date(baseTime.getTime() - 60_000).toISOString() }
    ],
    reviewCards: []
  }, "client_capture_resume_receipt"), null, baseTime);
  const dueResult = resolveCaptureDraftFocusOverride(dueBrief, freshDraft, baseTime);
  const synthesisResult = resolveCaptureDraftFocusOverride(synthesisBrief, freshDraft, baseTime);
  const staleResult = resolveCaptureDraftFocusOverride(synthesisBrief, staleDraft, baseTime);
  const timestampOnlyResult = resolveCaptureDraftFocusOverride(synthesisBrief, timestampOnlyDraft, baseTime);

  assert.equal(dueBrief.nextAction.kind, "review");
  assert.equal(dueResult.shouldOverride, false);
  assert.equal(dueResult.blockedByReview, true);
  assert.equal(synthesisBrief.nextAction.kind, "synthesize");
  assert.equal(synthesisResult.shouldOverride, true);
  assert.equal(staleResult.shouldOverride, false);
  assert.equal(timestampOnlyResult.shouldOverride, false);

  return {
    schema: "learning-companion.capture-draft-focus-receipt.v1",
    maxAgeHours: synthesisResult.maxAgeHours,
    cases: {
      dueReviewBeatsFreshDraft: dueResult,
      freshDraftBeatsSynthesis: synthesisResult,
      staleDraftDoesNotOverride: staleResult,
      timestampOnlyDoesNotOverride: timestampOnlyResult
    }
  };
}

function buildSeedWorkspace(baseTime) {
  const createdAt = new Date(baseTime.getTime() - 20 * 60_000).toISOString();
  return {
    schema: "learning-companion.workspace.v1",
    schemaVersion: 1,
    version: 1,
    clientId: "client_capture_resume_receipt",
    activeSessionId: "session_capture_resume",
    importedPatches: [],
    importedReviewPatches: [],
    createdAt,
    updatedAt: createdAt,
    sessions: [
      {
        id: "session_capture_resume",
        originClientId: "client_capture_resume_receipt",
        title: "Browser focus capture receipt",
        sourceTitle: "Advanced indexing lecture",
        sourceUrl: "https://example.com/learning/indexes",
        materialType: "video",
        tags: ["database", "indexing"],
        focusMode: "capture",
        notesMarkdown: "# Browser focus capture receipt\n\nCapture while watching, then resume from Today.",
        captures: [],
        reviewCards: [],
        createdAt,
        updatedAt: createdAt
      }
    ]
  };
}

function buildCaptureEvents(baseTime) {
  const capturedAt = (minutesBefore) => new Date(baseTime.getTime() - minutesBefore * 60_000).toISOString();
  return [
      {
        id: "capture_resume_covering_index",
        quote: "A covering index can answer the query without touching the base table.",
      thought: "Covering indexes trade write overhead for read locality.",
      timestamp: "03:12",
      capturedAt: capturedAt(3),
      sourceTitle: "Advanced indexing lecture",
      sourceUrl: "https://example.com/learning/indexes",
      materialType: "video",
      sourceProvenance: "snapshot",
      tags: ["index", "read-path"]
    },
      {
        id: "capture_resume_selectivity",
        quote: "The planner estimates selectivity before choosing the access path.",
      thought: "Selectivity is the bridge between statistics and query shape.",
      timestamp: "09:44",
      capturedAt: capturedAt(2),
      sourceTitle: "Advanced indexing lecture",
      sourceUrl: "https://example.com/learning/indexes",
      materialType: "video",
      sourceProvenance: "snapshot",
      tags: ["planner", "statistics"]
    },
      {
        id: "capture_resume_partial_index",
        quote: "Partial indexes are powerful when the predicate matches the workload.",
      thought: "Partial index usefulness depends on stable query predicates.",
      timestamp: "16:05",
      capturedAt: capturedAt(1),
      sourceTitle: "Advanced indexing lecture",
      sourceUrl: "https://example.com/learning/indexes",
      materialType: "video",
      sourceProvenance: "snapshot",
      tags: ["partial-index", "workload"]
    }
  ];
}

function summarizeLineDiff(before, after) {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);
  return {
    addedLineCount: afterLines.filter((line) => !beforeSet.has(line)).length,
    removedLineCount: beforeLines.filter((line) => !afterSet.has(line)).length,
    addedLines: afterLines.filter((line) => line && !beforeSet.has(line)).slice(0, 20),
    removedLines: beforeLines.filter((line) => line && !afterSet.has(line)).slice(0, 20)
  };
}

function sha256Text(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function sha256Json(value) {
  return sha256Text(JSON.stringify(value));
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
