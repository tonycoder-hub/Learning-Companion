import assert from "node:assert/strict";
import {
  addCapture,
  applyGrade,
  buildMirrorBundle,
  createDefaultWorkspace,
  getActiveSession,
  promoteCapture,
  sanitizeWorkspace,
  updateSession
} from "../apps/companion-web/src/model.js";
import {
  HARMONY_READER_VIEW_SCHEMA,
  buildHarmonyReaderView
} from "../apps/companion-harmony/src/schema-reader.mjs";
import {
  HARMONY_IMPORT_RECEIPT_SCHEMA,
  buildHarmonyPatchEnvelope,
  importPortableForHarmony
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
const captureId = getActiveSession(workspace).captures[0].id;
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
assert.equal(workspaceView.mode, "read-only-prototype");
assert.equal(workspaceView.workspace.sessionCount, workspace.sessions.length);
assert.equal(workspaceView.workspace.activeTopicId, workspace.activeSessionId);
assert.equal(workspaceView.activeTopic.title, getActiveSession(workspace).title);
assert.equal(workspaceView.activeTopic.nextAction.reason, "Active topic has due review due now.");
assert.equal(workspaceView.activeTopic.nextAction.detail, "Reveal and grade before adding more material.");
assert.equal(workspaceView.topics.length, workspace.sessions.length);
assert.equal(workspaceView.topics.some((topic) => topic.captureCount > 0), true);
assert.equal(workspaceView.dueReview.length, 1);
assert.equal(workspaceView.dueReview[0].answer.includes("HarmonyOS reader"), true);
assert.equal(workspaceView.recentCaptures[0].quote, "HarmonyOS reader should preserve a fresh learning capture.");
assert.equal(workspaceView.limitations.some((item) => item.includes("Prototype reader only")), true);

const mirror = buildMirrorBundle(workspace);
const mirrorView = buildHarmonyReaderView(mirror, { now });
assert.deepEqual(
  mirrorView.topics.map((topic) => topic.id).sort(),
  workspaceView.topics.map((topic) => topic.id).sort()
);
assert.equal(mirrorView.activeTopic.id, workspaceView.activeTopic.id);
assert.equal(mirrorView.dueReview[0].cardId, workspaceView.dueReview[0].cardId);

const workspaceImport = importPortableForHarmony(workspace, { now });
assert.equal(workspaceImport.ok, true);
assert.equal(workspaceImport.receipt.schema, HARMONY_IMPORT_RECEIPT_SCHEMA);
assert.equal(workspaceImport.receipt.sourceKind, "workspace");
assert.equal(workspaceImport.receipt.readerViewSchema, HARMONY_READER_VIEW_SCHEMA);
assert.equal(workspaceImport.view.activeTopic.id, workspace.activeSessionId);

const mirrorImport = importPortableForHarmony(mirror, { now });
assert.equal(mirrorImport.ok, true);
assert.equal(mirrorImport.receipt.sourceKind, "mirror-bundle");
assert.equal(mirrorImport.receipt.topicCount, workspace.sessions.length);

const rejectedPatchImport = importPortableForHarmony({
  schema: "learning-companion.mobile-inbox-patch.v1",
  patchId: "phone_patch_should_not_import_here",
  captures: []
}, { now });
assert.equal(rejectedPatchImport.ok, false);
assert.equal(rejectedPatchImport.receipt.errorCode, "PATCH_IMPORT_NOT_SUPPORTED_ON_READER");

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
