import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  WORKSPACE_SCHEMA,
  WORKSPACE_SCHEMA_VERSION,
  MAX_CAPTURE_TEXT_LENGTH,
  addCapture,
  addSession,
  applyGrade,
  buildFeishuPayload,
  buildMirrorBundle,
  buildMirrorZip,
  buildSourceJumpUrl,
  buildTodayPack,
  cleanText,
  cleanUrl,
  createDefaultWorkspace,
  createSession,
  filterSessions,
  formatLocalIso,
  generateMarkdown,
  generateSynthesisDraft,
  generateTodayMarkdown,
  getRecentCaptureItems,
  getSynthesisStats,
  getDueReviewCards,
  getDueReviewItems,
  getActiveSession,
  gradeCard,
  promoteCapture,
  reviewIntervalDays,
  safeHref,
  sanitizeWorkspace,
  timestampToSeconds,
  updateSession,
  workspaceFromPortableData
} from "../apps/companion-web/src/model.js";

const manifest = JSON.parse(readFileSync("apps/companion-web/manifest.webmanifest", "utf8"));
const serviceWorker = readFileSync("apps/companion-web/service-worker.js", "utf8");
assert.equal(manifest.display, "standalone");
assert.equal(manifest.start_url, "./");
assert.equal(manifest.icons[0].src, "./assets/icon.svg");
assert.match(serviceWorker, /CACHE_NAME/);
assert.match(serviceWorker, /STATIC_ASSETS/);
assert.match(serviceWorker, /src\/app\.js/);

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
}, { promoteToReview: true });

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

let multiReviewWorkspace = addSession(workspace, "Algorithms course");
const algorithmsSession = getActiveSession(multiReviewWorkspace);
multiReviewWorkspace = addCapture(multiReviewWorkspace, algorithmsSession.id, {
  quote: "Dijkstra explores the lowest-cost frontier first.",
  thought: "Recall why greedy selection works.",
  tags: "algorithms graph"
}, { promoteToReview: true });
const dueItems = getDueReviewItems(multiReviewWorkspace);
assert.equal(dueItems.length, 2);
assert.equal(dueItems.some((item) => item.sessionTitle === "Rust ownership course"), true);
assert.equal(dueItems.some((item) => item.sessionTitle === "Algorithms course"), true);
assert.equal(getRecentCaptureItems(multiReviewWorkspace, 1)[0].sessionTitle, "Algorithms course");

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

const frozenToday = new Date("2099-01-02T00:00:00.000Z");
const todayPack = buildTodayPack(multiReviewWorkspace, frozenToday, { dueLimit: 1, recentLimit: 1 });
assert.equal(todayPack.stats.due, 2);
assert.equal(todayPack.dueItems.length, 1);
assert.equal(todayPack.dueOverflow, 1);
assert.equal(todayPack.recentCaptures.length, 1);
assert.match(todayPack.localDayWindow.start, /T00:00:00[+-]\d{2}:\d{2}$/);
assert.match(formatLocalIso(frozenToday), /2099-01-02T\d{2}:00:00[+-]\d{2}:\d{2}$/);
const todayMarkdown = generateTodayMarkdown(multiReviewWorkspace, frozenToday);
assert.equal(todayMarkdown, generateTodayMarkdown(multiReviewWorkspace, frozenToday));
assert.match(todayMarkdown, /Generated from workspace\.json/);
assert.match(todayMarkdown, /Today Study Pack/);
assert.match(todayMarkdown, /Local day window: \[/);
assert.match(todayMarkdown, /Due rule: review cards with dueAt <= generatedAt/);
assert.match(todayMarkdown, /Due Review/);
assert.match(todayMarkdown, /Recent Captures/);
assert.match(todayMarkdown, /Recall why greedy selection works/);

const payload = buildFeishuPayload(session);
assert.equal(payload.schema, "learning-companion.feishu-export.v1");
assert.equal(payload.session.id, session.id);

const mirror = buildMirrorBundle(workspace);
assert.equal(mirror.schema, "learning-companion.mirror-bundle.staging.v1");
assert.equal(mirror.contractStability, "experimental");
assert.equal(mirror.canonical, "workspace.json");
assert.equal(mirror.semantics.snapshot, "full");
assert.equal(mirror.workspace.sessionCount, workspace.sessions.length);
assert.equal(mirror.manifest.fileCount, 3 + workspace.sessions.length * 2);
assert.equal(mirror.files.some((file) => file.path === "workspace.json" && file.role === "workspace-restore"), true);
assert.equal(mirror.files.some((file) => file.path === "TODAY.md" && file.role === "study-pack"), true);
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
assert.equal(mirrorZipNames.includes("README.md"), true);
assert.equal(mirrorZipNames.includes("TODAY.md"), true);
assert.equal(mirrorZipNames.some((path) => path.endsWith(".md") && path.startsWith("sessions/")), true);
assert.equal(mirrorZipNames.some((path) => path.endsWith(".feishu.json")), true);

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
