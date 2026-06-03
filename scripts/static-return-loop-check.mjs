import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  applyMobileInboxPatch,
  applyReviewProgressPatch,
  buildReturnBaseFingerprint,
  workspaceFingerprint,
  sanitizeWorkspace
} from "../apps/companion-web/src/model.js";

const mirrorRoot = resolve("dist/morning-demo/mirror-folder");
const sampleWorkspacePath = resolve("dist/morning-demo/sample-workspace.json");
const gitignorePath = resolve(".gitignore");
const runBase = resolve(".codex-tmp/static-return-loop-check");
const runDir = join(runBase, `static-return-loop-${Date.now()}`);
const receiptPath = join(runDir, "receipt.json");

assertStaticInputs();
mkdirSync(runDir, { recursive: true, mode: 0o700 });

const indexHtml = await readFile(join(mirrorRoot, "index.html"), "utf8");
const reviewHtml = await readFile(join(mirrorRoot, "review.html"), "utf8");
const inboxHtml = await readFile(join(mirrorRoot, "inbox.html"), "utf8");
const sampleWorkspaceJson = await readFile(sampleWorkspacePath, "utf8");
const sampleWorkspace = sanitizeWorkspace(JSON.parse(sampleWorkspaceJson));
const gitignoreText = await readFile(gitignorePath, "utf8");
assert.equal(isGitignored(gitignoreText, ".codex-tmp/"), true);
const indexState = inspectMirrorHome(indexHtml);
const review = buildReviewReturnFromStaticContract(reviewHtml, sampleWorkspace);
const inbox = buildInboxReturnFromStaticContract(inboxHtml, sampleWorkspace);
const modelImport = await importReturnsThroughModel({
  reviewReturnJson: review.returnJson,
  inboxReturnJson: inbox.returnJson,
  sampleWorkspace
});

const receipt = {
  schema: "learning-companion.static-return-loop-check.v1",
  evidenceTier: "STATIC_CONTRACT_PLUS_FIXTURE_MODEL_IMPORT",
  generatedAt: new Date().toISOString(),
  mirrorRoot,
  runDir,
  runtime: {
    artifactRoot: ".codex-tmp/static-return-loop-check",
    artifactRootGitignored: true
  },
  summary: {
    ok: true,
    staticMirrorHomeContract: indexState.heading === "Learning Companion Mirror",
    reviewReturnBuilt: review.patch.schema === "learning-companion.review-progress-patch.v1",
    inboxReturnBuilt: inbox.patch.schema === "learning-companion.mobile-inbox-patch.v1",
    modelImportedReview: modelImport.reviewImportOk,
    modelImportedInbox: modelImport.inboxImportOk,
    downloadsWrittenByVerifier: 0,
    downloadsDirectoryObserved: false
  },
  staticPages: {
    index: indexState,
    review: review.safeSummary,
    inbox: inbox.safeSummary
  },
  modelImport,
  pendingManualEvidence: [
    {
      target: "macOS file:// browser execution",
      status: "pending",
      reason: "Headless Chrome DevTools target was unavailable in this sandbox and the in-app Browser policy rejected file:// navigation."
    },
    {
      target: "Windows Edge/Chrome folder launch and return file creation",
      status: "pending",
      reason: "Requires real Windows machine browser run."
    },
    {
      target: "HarmonyOS browser/app return behavior",
      status: "pending",
      reason: "Requires device or DevEco-backed run."
    }
  ],
  boundaries: {
    proves: [
      "The exported mirror home uses relative Review/Inbox links and the manual-return/static-mirror copy.",
      "The exported review.html contains the Manual Copy return contract and a schema-valid review return payload can be built from its embedded seed.",
      "The exported inbox.html contains the Manual Copy return contract, safe URL handling, and a schema-valid inbox return payload can be built from its embedded seed.",
      "The current Mac model importer accepts both return payloads against the demo workspace."
    ],
    doesNotProve: [
      "A real user-generated browser return file.",
      "Browser-executed file:// behavior.",
      "The full Mac browser UI import flow or native file picker.",
      "The user's Downloads directory remained unchanged.",
      "Windows Edge or Chrome behavior on a real Windows machine.",
      "HarmonyOS browser or app behavior on a real phone.",
      "File picker availability or save-panel behavior.",
      "Feishu live sync or credentialed upload."
    ]
  }
};

await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
console.log("static_return_loop_ok");
console.log(receiptPath);

function assertStaticInputs() {
  const required = [
    join(mirrorRoot, "index.html"),
    join(mirrorRoot, "review.html"),
    join(mirrorRoot, "inbox.html"),
    sampleWorkspacePath
  ];
  required.forEach((filePath) => {
    assert.equal(existsSync(filePath), true, `Missing required static-return fixture: ${filePath}`);
  });
}

function inspectMirrorHome(html) {
  const state = {
    title: extractTagText(html, "title"),
    heading: extractTagText(html, "h1"),
    hasManualReturn: /Manual Return/.test(html),
    hasStaticBoundary: /Static mirror/.test(html),
    reviewHref: extractHref(html, "review.html"),
    inboxHref: extractHref(html, "inbox.html"),
    nextHref: extractDeviceNextHref(html),
    hasExternalScript: /<script[^>]+src=/i.test(html),
    hasExternalStylesheet: /<link[^>]+rel=["']stylesheet/i.test(html)
  };
  assert.equal(state.title, "Learning Companion Mirror");
  assert.equal(state.heading, "Learning Companion Mirror");
  assert.equal(state.hasManualReturn, true);
  assert.equal(state.hasStaticBoundary, true);
  assert.equal(state.reviewHref, "review.html");
  assert.equal(state.inboxHref, "inbox.html");
  if (state.nextHref) assert.doesNotMatch(state.nextHref, /^(?:\/|https?:|file:)/);
  assert.equal(state.hasExternalScript, false);
  assert.equal(state.hasExternalStylesheet, false);
  return state;
}

function buildReviewReturnFromStaticContract(html, workspace) {
  const seed = extractSeed(html, "learning-companion.review-progress-seed.v1");
  assertSeedMatchesWorkspace(seed, workspace);
  const followup = assertReviewFollowup(seed, workspace);
  assertStaticReturnContract(html, {
    heading: "Learning Companion Review Pack",
    schema: "learning-companion.review-progress-patch.v1",
    copyButtonId: "copyProgressBtn",
    saveButtonId: "downloadProgressBtn",
    selectButtonId: "selectProgressBtn",
    clearButtonId: "clearProgressBtn",
    previewId: "progressPreview",
    returnNamePrefix: "learning-companion-review-progress-patch"
  });
  assert.equal(seed.cards.length > 0, true, "Review fixture needs at least one due card.");
  const card = seed.cards[0];
  const patch = {
    schema: "learning-companion.review-progress-patch.v1",
    appVersion: seed.appVersion,
    patchId: "review_patch_static_contract",
    createdAt: new Date().toISOString(),
    source: {
      generatedBy: "review.html",
      workspaceFingerprint: seed.workspaceFingerprint,
      returnBaseFingerprint: seed.returnBaseFingerprint
    },
    events: [{
      id: "review_event_static_contract",
      sessionId: card.sessionId,
      cardId: card.cardId,
      grade: "good",
      reviewedAt: new Date().toISOString(),
      baseUpdatedAt: card.baseUpdatedAt,
      baseDueAt: card.baseDueAt,
      baseStrength: card.baseStrength
    }]
  };
  assert.equal(patch.schema, "learning-companion.review-progress-patch.v1");
  assert.match(patch.source.returnBaseFingerprint, /^fnv1a-[a-f0-9]{8}$/);
  assert.equal(patch.events.length, 1);
  assert.equal(patch.events[0].grade, "good");
  return {
    returnJson: JSON.stringify(patch, null, 2),
    patch,
    safeSummary: {
      heading: extractTagText(html, "h1"),
      schema: patch.schema,
      eventCount: patch.events.length,
      grade: patch.events[0].grade,
      seedMatchesSampleWorkspace: true,
      hasManualCopy: /Manual Copy/.test(html),
      hasReturnBaseFingerprint: /^fnv1a-[a-f0-9]{8}$/.test(patch.source.returnBaseFingerprint || ""),
      hasSuggestedFilenameTemplate: /returnFileName\('learning-companion-review-progress-patch'/.test(html),
      hasCrossPageFollowup: Boolean(followup),
      followupHref: followup?.href || ""
    }
  };
}

function buildInboxReturnFromStaticContract(html, workspace) {
  const seed = extractSeed(html, "learning-companion.mobile-inbox-seed.v1");
  assertSeedMatchesWorkspace(seed, workspace);
  const followup = assertInboxFollowup(seed);
  assertStaticReturnContract(html, {
    heading: "Learning Companion Inbox",
    schema: "learning-companion.mobile-inbox-patch.v1",
    copyButtonId: "copyPatchBtn",
    saveButtonId: "downloadPatchBtn",
    selectButtonId: "selectPatchBtn",
    clearButtonId: "clearDraftsBtn",
    previewId: "patchPreview",
    returnNamePrefix: "learning-companion-inbox-patch"
  });
  const topic = seed.topics.find((item) => item.id === seed.activeSessionId) || seed.topics[0];
  assert.ok(topic, "Inbox fixture needs an active topic.");
  const safeUrlMatrix = [
    "javascript:alert(1)",
    " JavaScript:alert(1)",
    "vbscript:msgbox(1)",
    "data:text/html,<script>alert(1)</script>",
    "HTTPS://Example.com/Allowed?x=1"
  ].map((value) => [value, safeUrlLikeStaticInbox(value)]);
  const patch = {
    schema: "learning-companion.mobile-inbox-patch.v1",
    appVersion: seed.appVersion,
    patchId: "inbox_patch_static_contract",
    createdAt: new Date().toISOString(),
    source: {
      generatedBy: "inbox.html",
      workspaceFingerprint: seed.workspaceFingerprint,
      returnBaseFingerprint: seed.returnBaseFingerprint,
      topicId: seed.activeSessionId,
      topicTitle: seed.topics.find((item) => item.id === seed.activeSessionId)?.title || ""
    },
    target: {
      topicId: topic.id,
      topicTitle: topic.title
    },
    captures: [{
      id: "inbox_capture_static_contract",
      quote: "Local file mirror inbox quote.",
      thought: "This return file came from the standalone static contract verifier.",
      timestamp: "09:42",
      sourceTitle: "Static return loop verifier",
      sourceUrl: safeUrlLikeStaticInbox("javascript:alert(1)"),
      answersQuestionCaptureId: "",
      materialType: topic.materialType || "other",
      tags: "file, return",
      capturedAt: new Date().toISOString()
    }]
  };
  assert.equal(patch.schema, "learning-companion.mobile-inbox-patch.v1");
  assert.match(patch.source.returnBaseFingerprint, /^fnv1a-[a-f0-9]{8}$/);
  assert.equal(patch.captures.length, 1);
  assert.equal(patch.captures[0].quote, "Local file mirror inbox quote.");
  assert.equal(patch.captures[0].sourceUrl, "");
  assert.deepEqual(safeUrlMatrix, [
    ["javascript:alert(1)", ""],
    [" JavaScript:alert(1)", ""],
    ["vbscript:msgbox(1)", ""],
    ["data:text/html,<script>alert(1)</script>", ""],
    ["HTTPS://Example.com/Allowed?x=1", "https://example.com/Allowed?x=1"]
  ]);
  return {
    returnJson: JSON.stringify(patch, null, 2),
    patch,
    safeSummary: {
      heading: extractTagText(html, "h1"),
      schema: patch.schema,
      captureCount: patch.captures.length,
      strippedUnsafeSourceUrl: patch.captures[0].sourceUrl === "",
      safeUrlMatrix,
      seedMatchesSampleWorkspace: true,
      hasManualCopy: /Manual Copy/.test(html),
      hasSafeUrlFunction: /function safeUrl\(/.test(html),
      hasReturnBaseFingerprint: /^fnv1a-[a-f0-9]{8}$/.test(patch.source.returnBaseFingerprint || ""),
      hasSuggestedFilenameTemplate: /returnFileName\('learning-companion-inbox-patch'/.test(html),
      hasCrossPageFollowup: Boolean(followup),
      followupHref: followup?.href || ""
    }
  };
}

function assertReviewFollowup(seed, workspace) {
  const openQuestions = countOpenQuestions(workspace);
  assert.equal(seed.cards.length > 0, true, "Review fixture needs due cards for cross-page follow-up.");
  assert.equal(openQuestions > 0, true, "Review fixture needs open questions for cross-page follow-up.");
  const followup = seed.followup;
  assert.ok(followup, "Review seed should include an Inbox follow-up for mixed due+question mirrors.");
  assert.equal(followup.label, `Answer ${formatCount(openQuestions, "open question")}`);
  assert.match(followup.href, /^inbox\.html\?[^#]+$/);
  assert.match(followup.href, /answerToCaptureId=/);
  assertRelativeStaticHref(followup.href);
  const params = new URLSearchParams(followup.href.split("?")[1] || "");
  assert.notEqual(params.get("answerToCaptureId") || "", "");
  assert.equal(params.get("thought"), "Answer:");
  assert.match(followup.detail, /Save this review return file/);
  return followup;
}

function assertInboxFollowup(seed) {
  assert.equal(seed.cards?.length, undefined);
  const followup = seed.followup;
  assert.ok(followup, "Inbox seed should include a Review follow-up for mixed due+question mirrors.");
  assert.match(followup.label, /^Review [1-9]\d* due card/);
  assert.equal(followup.href, "review.html");
  assertRelativeStaticHref(followup.href);
  assert.match(followup.detail, /Save this inbox return file/);
  return followup;
}

function assertStaticReturnContract(html, {
  heading,
  schema,
  copyButtonId,
  saveButtonId,
  selectButtonId,
  clearButtonId,
  previewId,
  returnNamePrefix
}) {
  assert.equal(extractTagText(html, "h1"), heading);
  assert.match(html, new RegExp(escapeRegExp(schema)));
  [copyButtonId, saveButtonId, selectButtonId, clearButtonId, previewId].forEach((id) => {
    assert.match(html, new RegExp(`id=["']${escapeRegExp(id)}["']`));
  });
  assert.match(html, /Manual Copy/);
  assert.match(html, /Today &gt; Return Files/);
  assert.match(html, new RegExp(`returnFileName\\('${escapeRegExp(returnNamePrefix)}'`));
  assert.match(html, /returnBaseFingerprint/);
  assert.match(html, /setReturnActionsEnabled\(/);
  assert.match(html, /button\.disabled = !enabled|button\.disabled = !hasTopicDrafts/);
  assert.match(html, /clearProgressBtn|clear\.disabled = !hasAnyDrafts/);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<link[^>]+rel=["']stylesheet/i);
  assert.doesNotMatch(html, /<iframe/i);
  assert.doesNotMatch(html, /srcdoc=/i);
  assert.doesNotMatch(html, /href=["']javascript:/i);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  assert.doesNotMatch(html, /data:text\/html/i);
  assert.doesNotMatch(html, /\bimport\s*\(/);
  assert.doesNotMatch(html, /\bfetch\s*\(/);
  assert.doesNotMatch(html, /XMLHttpRequest/);
  assert.doesNotMatch(html, /serviceWorker/);
  assert.doesNotMatch(html, /WebSocket/);
  assert.doesNotMatch(html, /EventSource/);
  assert.doesNotMatch(html, /sendBeacon/);
  assert.doesNotMatch(html, /BroadcastChannel/);
  assert.doesNotMatch(html, /<a\b[^>]*\bdownload\b/i);
}

function extractSeed(html, expectedSchema) {
  const match = html.match(/\bconst seed = (\{[^\n]+?\});/);
  assert.ok(match, `Missing embedded seed for ${expectedSchema}`);
  const seed = JSON.parse(match[1]);
  assert.equal(seed.schema, expectedSchema);
  assert.match(seed.workspaceFingerprint, /^fnv1a-[a-f0-9]{8}$/);
  assert.match(seed.returnBaseFingerprint, /^fnv1a-[a-f0-9]{8}$/);
  return seed;
}

function assertRelativeStaticHref(href) {
  assert.doesNotMatch(href, /^(?:\/|https?:|file:)/);
  assert.doesNotMatch(href, /(?:^|\/)\.\.(?:\/|$)/);
  assert.doesNotMatch(href, /workspaceFingerprint|returnBaseFingerprint|\/Users|file:/);
}

function countOpenQuestions(workspace) {
  return (workspace.sessions || []).reduce((count, session) => (
    count + (session.captures || []).filter((capture) => (
      isQuestionText(capture.thought || capture.quote || "")
        && !capture.questionResolvedAt
        && !capture.questionParkedAt
    )).length
  ), 0);
}

function isQuestionText(value) {
  return /^(?:q|question)\s*[:：]/i.test(String(value || "").trim()) || /[?？]/.test(String(value || ""));
}

function formatCount(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function assertSeedMatchesWorkspace(seed, workspace) {
  const expectedWorkspaceFingerprint = `fnv1a-${workspaceFingerprint(JSON.stringify(sanitizeWorkspace(workspace), null, 2))}`;
  const expectedReturnBaseFingerprint = buildReturnBaseFingerprint(workspace);
  assert.equal(seed.workspaceFingerprint, expectedWorkspaceFingerprint);
  assert.equal(seed.returnBaseFingerprint, expectedReturnBaseFingerprint);
}

function extractTagText(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i"));
  return match ? stripTags(match[1]).trim() : "";
}

function extractHref(html, expectedHref) {
  const match = html.match(new RegExp(`<a\\b[^>]*href=["'](${escapeRegExp(expectedHref)})["'][^>]*>`, "i"));
  return match ? match[1] : "";
}

function extractDeviceNextHref(html) {
  const match = html.match(/<a\b(?=[^>]*class=["'][^"']*(?:device-next-link|device-next-secondary))[^>]*href=["']([^"']*)["'][^>]*>/i);
  return match ? match[1] : "";
}

function stripTags(value) {
  return String(value || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeUrlLikeStaticInbox(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    return /^https?:$/.test(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function isGitignored(gitignoreText, pathPattern) {
  return gitignoreText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .includes(pathPattern);
}

async function importReturnsThroughModel({ reviewReturnJson, inboxReturnJson, sampleWorkspace }) {
  const reviewPatch = JSON.parse(reviewReturnJson);
  const inboxPatch = JSON.parse(inboxReturnJson);
  const reviewResult = applyReviewProgressPatch(sampleWorkspace, reviewPatch);
  const inboxResult = applyMobileInboxPatch(reviewResult.workspace, inboxPatch);
  const workspace = inboxResult.workspace;
  const active = workspace.sessions.find((session) => session.id === workspace.activeSessionId) || workspace.sessions[0];
  const importedCapture = active.captures.find((capture) => capture.quote === "Local file mirror inbox quote.") || {};
  const reviewedCards = workspace.sessions.flatMap((session) => session.reviewCards || []).filter((card) => card.lastReviewedAt);
  assert.throws(() => applyReviewProgressPatch(sampleWorkspace, {
    ...reviewPatch,
    schema: "learning-companion.review-progress-patch.v2"
  }), /Unsupported review progress patch schema/);
  assert.throws(() => applyMobileInboxPatch(sampleWorkspace, {
    ...inboxPatch,
    patchId: ""
  }), /patchId/);
  const result = {
    source: "verifier-generated-from-static-seed",
    provesRealUserExport: false,
    sampleWorkspaceLoaded: true,
    reviewImportOk: true,
    reviewKind: "review-progress-patch",
    reviewReceiptSchema: reviewResult.receipt.schema || "",
    reviewApplied: reviewResult.receipt.applied || 0,
    inboxImportOk: true,
    inboxKind: "mobile-inbox-patch",
    inboxReceiptSchema: inboxResult.receipt.schema || "",
    inboxAdded: inboxResult.receipt.added || 0,
    importedCaptureFound: Boolean(importedCapture.id),
    importedCaptureSourceUrl: importedCapture.sourceUrl || "",
    reviewedCardCount: reviewedCards.length,
    importedPatchCount: workspace.importedPatches?.length || 0,
    importedReviewPatchCount: workspace.importedReviewPatches?.length || 0
  };
  assert.equal(result.sampleWorkspaceLoaded, true);
  assert.equal(result.reviewImportOk, true);
  assert.equal(result.reviewKind, "review-progress-patch");
  assert.equal(result.reviewReceiptSchema, "learning-companion.review-progress-receipt.v1");
  assert.equal(result.reviewApplied, 1);
  assert.equal(result.inboxImportOk, true);
  assert.equal(result.inboxKind, "mobile-inbox-patch");
  assert.equal(result.inboxReceiptSchema, "learning-companion.mobile-inbox-receipt.v1");
  assert.equal(result.inboxAdded, 1);
  assert.equal(result.importedCaptureFound, true);
  assert.equal(result.importedCaptureSourceUrl, "");
  assert.equal(result.reviewedCardCount >= 1, true);
  assert.equal(result.importedPatchCount >= 1, true);
  assert.equal(result.importedReviewPatchCount >= 1, true);
  return result;
}
