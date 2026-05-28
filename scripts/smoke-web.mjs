import assert from "node:assert/strict";
import {
  WORKSPACE_SCHEMA,
  WORKSPACE_SCHEMA_VERSION,
  MAX_CAPTURE_TEXT_LENGTH,
  addCapture,
  addSession,
  applyGrade,
  buildFeishuPayload,
  buildMirrorBundle,
  cleanText,
  cleanUrl,
  createDefaultWorkspace,
  createSession,
  filterSessions,
  generateMarkdown,
  generateSynthesisDraft,
  getSynthesisStats,
  getDueReviewCards,
  getActiveSession,
  gradeCard,
  promoteCapture,
  reviewIntervalDays,
  safeHref,
  sanitizeWorkspace
} from "../apps/companion-web/src/model.js";

let workspace = createDefaultWorkspace();
assert.equal(workspace.schema, WORKSPACE_SCHEMA);
assert.equal(workspace.schemaVersion, WORKSPACE_SCHEMA_VERSION);
assert.equal(workspace.version, WORKSPACE_SCHEMA_VERSION);
assert.match(workspace.clientId, /^client_/);
assert.equal(workspace.sessions.length, 1);
assert.equal(cleanUrl("javascript:alert(1)"), "");
assert.equal(cleanUrl("data:text/html,hi"), "");
assert.equal(safeHref("javascript:alert(1)"), "#");
assert.equal(cleanUrl("https://example.com/a path").startsWith("https://example.com/"), true);
assert.equal(cleanText("ok\u0000bad"), "okbad");
assert.equal(cleanText("x".repeat(MAX_CAPTURE_TEXT_LENGTH + 10)).length, MAX_CAPTURE_TEXT_LENGTH);

workspace = addSession(workspace, "Rust ownership course");
let session = getActiveSession(workspace);
assert.equal(session.title, "Rust ownership course");

workspace = addCapture(workspace, session.id, {
  quote: "Ownership lets Rust make memory safety guarantees without a garbage collector.",
  thought: "Connect this to compile-time lifetime checks.",
  timestamp: "08:12",
  tags: "rust memory"
}, { promoteToReview: true });

session = getActiveSession(workspace);
assert.equal(session.captures.length, 1);
assert.equal(session.reviewCards.length, 1);
assert.equal(session.captures[0].tags.includes("rust"), true);
assert.equal(session.captures[0].originClientId, workspace.clientId);
assert.equal(session.captures[0].updatedAt.length > 0, true);
assert.equal(getDueReviewCards(session).length, 1);

const markdown = generateMarkdown(session);
assert.match(markdown, /Rust ownership course/);
assert.match(markdown, /08:12/);
assert.match(markdown, /Review Cards/);

const synthesis = generateSynthesisDraft(session);
assert.match(synthesis, /Synthesis - Rust ownership course/);
assert.match(synthesis, /Generated from 1 capture \/ 0 questions \/ 1 card/);
assert.match(synthesis, /compile-time lifetime checks/);
assert.match(synthesis, /Review Targets/);

const emptySynthesis = generateSynthesisDraft(createSession({ title: "Empty topic" }, workspace.clientId));
assert.match(emptySynthesis, /No captures yet/);
assert.deepEqual(getSynthesisStats(session), { captures: 1, questions: 0, cards: 1 });

const payload = buildFeishuPayload(session);
assert.equal(payload.schema, "learning-companion.feishu-export.v1");
assert.equal(payload.session.id, session.id);

const mirror = buildMirrorBundle(workspace);
assert.equal(mirror.schema, "learning-companion.mirror-bundle.staging.v1");
assert.equal(mirror.contractStability, "experimental");
assert.equal(mirror.canonical, "workspace.json");
assert.equal(mirror.semantics.snapshot, "full");
assert.equal(mirror.workspace.sessionCount, workspace.sessions.length);
assert.equal(mirror.manifest.fileCount, 2 + workspace.sessions.length * 2);
assert.equal(mirror.files.some((file) => file.path === "workspace.json" && file.role === "workspace-restore"), true);
assert.equal(mirror.files.some((file) => file.path.endsWith(".md") && /Rust ownership course/.test(file.content)), true);
assert.equal(mirror.files.every((file) => file.encoding === "utf-8"), true);
assert.equal(mirror.files.every((file) => /^fnv1a-[a-f0-9]{8}$/.test(file.contentFingerprint)), true);
assert.equal(/^fnv1a-[a-f0-9]{8}$/.test(mirror.manifest.bundleFingerprint), true);

const restoredWorkspaceFile = mirror.files.find((file) => file.path === "workspace.json");
const restoredWorkspace = sanitizeWorkspace(JSON.parse(restoredWorkspaceFile.content));
const restoredMirror = buildMirrorBundle(restoredWorkspace);
assert.deepEqual(
  restoredMirror.files.map((file) => file.path).sort(),
  mirror.files.map((file) => file.path).sort()
);

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

const sanitized = sanitizeWorkspace(JSON.parse(JSON.stringify(workspace)));
assert.equal(sanitized.activeSessionId, workspace.activeSessionId);
assert.equal(sanitized.schemaVersion, WORKSPACE_SCHEMA_VERSION);

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
