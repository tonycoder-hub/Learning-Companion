import assert from "node:assert/strict";
import {
  WORKSPACE_SCHEMA,
  addCapture,
  addSession,
  buildFeishuPayload,
  createDefaultWorkspace,
  filterSessions,
  generateMarkdown,
  getActiveSession,
  gradeCard,
  promoteCapture,
  sanitizeWorkspace
} from "../apps/companion-web/src/model.js";

let workspace = createDefaultWorkspace();
assert.equal(workspace.schema, WORKSPACE_SCHEMA);
assert.equal(workspace.sessions.length, 1);

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

const markdown = generateMarkdown(session);
assert.match(markdown, /Rust ownership course/);
assert.match(markdown, /08:12/);
assert.match(markdown, /Review Cards/);

const payload = buildFeishuPayload(session);
assert.equal(payload.schema, "learning-companion.feishu-export.v1");
assert.equal(payload.session.id, session.id);

workspace = promoteCapture(workspace, session.id, session.captures[0].id);
session = getActiveSession(workspace);
assert.equal(session.reviewCards.length, 1);

workspace = gradeCard(workspace, session.id, session.reviewCards[0].id, 1);
session = getActiveSession(workspace);
assert.equal(session.reviewCards[0].strength, 1);

const filtered = filterSessions(workspace, "ownership");
assert.equal(filtered.length, 1);

const sanitized = sanitizeWorkspace(JSON.parse(JSON.stringify(workspace)));
assert.equal(sanitized.activeSessionId, workspace.activeSessionId);

console.log("smoke_web_ok");
