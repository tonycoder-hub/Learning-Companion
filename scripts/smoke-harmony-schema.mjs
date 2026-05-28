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

assert.throws(() => buildHarmonyReaderView({ schema: "unknown" }, { now }), /Unsupported/);

console.log("smoke_harmony_schema_ok");
