import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  MOBILE_INBOX_PATCH_SCHEMA,
  REVIEW_PROGRESS_PATCH_SCHEMA,
  applyMobileInboxPatch,
  applyReviewProgressPatch,
  buildMirrorBundle,
  buildMirrorZip,
  getDueReviewItems,
  sanitizeWorkspace
} from "../apps/companion-web/src/model.js";

const OUT_DIR = "dist/morning-demo";
const MIRROR_DIR = join(OUT_DIR, "mirror-folder");
const PATCH_DIR = join(OUT_DIR, "patches");
const SAMPLE_WORKSPACE_FILE = "sample-workspace.json";
const SAMPLE_MIRROR_JSON_FILE = "sample-feishu-mirror.json";
const SAMPLE_MOBILE_INBOX_PATCH_FILE = "sample-mobile-inbox-patch.json";
const SAMPLE_REVIEW_PROGRESS_PATCH_FILE = "sample-review-progress-patch.json";
const REVIEW_REPORT_FILE = "review-start-here.html";

const demoWorkspace = sanitizeWorkspace({
  schema: "learning-companion.workspace.v1",
  schemaVersion: 1,
  version: 1,
  clientId: "client_morning_demo",
  activeSessionId: "session_rust_video",
  importedPatches: [],
  importedReviewPatches: [],
  createdAt: "2026-05-29T06:30:00.000+08:00",
  updatedAt: "2026-05-29T06:50:00.000+08:00",
  sessions: [
    {
      id: "session_rust_video",
      originClientId: "client_morning_demo",
      title: "Rust ownership video",
      sourceTitle: "RustConf ownership talk",
      sourceUrl: "https://www.youtube.com/watch?v=rust123",
      materialType: "video",
      tags: ["rust", "memory"],
      focusMode: "capture",
      notesMarkdown: [
        "# Rust ownership video",
        "",
        "Ownership connects memory safety to compile-time checks. The next useful step is reviewing the lifetime/card pair, then adding one synthesis paragraph from the freshest captures."
      ].join("\n"),
      captures: [
        {
          id: "capture_rust_ownership",
          quote: "Ownership lets Rust make memory safety guarantees without a garbage collector.",
          thought: "Connect this to compile-time lifetime checks.",
          timestamp: "08:12",
          sourceTitle: "RustConf ownership talk",
          sourceUrl: "https://www.youtube.com/watch?v=rust123",
          materialType: "video",
          sourceProvenance: "snapshot",
          tags: ["rust", "memory"],
          createdAt: "2026-05-29T06:32:00.000+08:00",
          capturedAt: "2026-05-29T06:32:00.000+08:00",
          updatedAt: "2026-05-29T06:32:00.000+08:00",
          originClientId: "client_morning_demo",
          promotedToReview: true
        },
        {
          id: "capture_borrow_checker",
          quote: "The borrow checker prevents aliasing and mutation from colliding.",
          thought: "This is the anchor for comparing Rust with GC languages.",
          timestamp: "11:03",
          sourceTitle: "RustConf ownership talk",
          sourceUrl: "https://www.youtube.com/watch?v=rust123",
          materialType: "video",
          sourceProvenance: "snapshot",
          tags: ["borrow-checker"],
          createdAt: "2026-05-29T06:36:00.000+08:00",
          capturedAt: "2026-05-29T06:36:00.000+08:00",
          updatedAt: "2026-05-29T06:36:00.000+08:00",
          originClientId: "client_morning_demo",
          promotedToReview: false
        }
      ],
      reviewCards: [
        {
          id: "card_rust_lifetime",
          prompt: "What does ownership let Rust guarantee without a garbage collector?",
          answer: "Memory safety through compile-time ownership and lifetime checks.",
          sourceCaptureId: "capture_rust_ownership",
          dueAt: "2026-05-29T06:30:00.000+08:00",
          strength: 0,
          createdAt: "2026-05-29T06:33:00.000+08:00",
          updatedAt: "2026-05-29T06:33:00.000+08:00",
          lastReviewedAt: null,
          originClientId: "client_morning_demo"
        }
      ],
      createdAt: "2026-05-29T06:30:00.000+08:00",
      updatedAt: "2026-05-29T06:50:00.000+08:00"
    },
    {
      id: "session_algorithms_doc",
      originClientId: "client_morning_demo",
      title: "Algorithms graph notes",
      sourceTitle: "Dijkstra lecture notes",
      sourceUrl: "https://example.com/algorithms/dijkstra",
      materialType: "doc",
      tags: ["algorithms", "graph"],
      focusMode: "review",
      notesMarkdown: "# Algorithms graph notes\n\nDijkstra explores the lowest-cost frontier first. The review card should stay close to that capture.",
      captures: [
        {
          id: "capture_dijkstra_frontier",
          quote: "Dijkstra explores the lowest-cost frontier first.",
          thought: "Recall why greedy selection works.",
          timestamp: "",
          sourceTitle: "Dijkstra lecture notes",
          sourceUrl: "https://example.com/algorithms/dijkstra",
          materialType: "doc",
          sourceProvenance: "snapshot",
          tags: ["algorithms", "graph"],
          createdAt: "2026-05-29T06:40:00.000+08:00",
          capturedAt: "2026-05-29T06:40:00.000+08:00",
          updatedAt: "2026-05-29T06:40:00.000+08:00",
          originClientId: "client_morning_demo",
          promotedToReview: true
        }
      ],
      reviewCards: [
        {
          id: "card_dijkstra_frontier",
          prompt: "Which frontier does Dijkstra explore first?",
          answer: "The lowest-cost frontier.",
          sourceCaptureId: "capture_dijkstra_frontier",
          dueAt: "2026-05-29T06:35:00.000+08:00",
          strength: 1,
          createdAt: "2026-05-29T06:41:00.000+08:00",
          updatedAt: "2026-05-29T06:41:00.000+08:00",
          lastReviewedAt: null,
          originClientId: "client_morning_demo"
        }
      ],
      createdAt: "2026-05-29T06:39:00.000+08:00",
      updatedAt: "2026-05-29T06:45:00.000+08:00"
    }
  ]
});

const mobileInboxPatch = {
  schema: MOBILE_INBOX_PATCH_SCHEMA,
  appVersion: 1,
  patchId: "morning_demo_mobile_inbox_patch",
  createdAt: "2026-05-29T07:05:00.000+08:00",
  source: {
    generatedBy: "inbox.html",
    workspaceFingerprint: "morning-demo",
    topicId: "session_rust_video",
    topicTitle: "Rust ownership video"
  },
  target: {
    topicId: "session_rust_video",
    topicTitle: "Rust ownership video"
  },
  captures: [
    {
      id: "morning_demo_phone_capture",
      quote: "Phone-side follow-up while reviewing the mirror bundle.",
      thought: "This should import as an inbox capture without touching notes or cards.",
      timestamp: "13:20",
      sourceTitle: "HarmonyOS browser",
      sourceUrl: "javascript:alert(1)",
      materialType: "doc",
      tags: "phone mirror",
      capturedAt: "2026-05-29T07:06:00.000+08:00"
    }
  ]
};

const [firstDue] = getDueReviewItems(demoWorkspace, new Date("2026-05-29T07:00:00.000+08:00"));
assert.ok(firstDue, "demo workspace should have a due review card");
const reviewProgressPatch = {
  schema: REVIEW_PROGRESS_PATCH_SCHEMA,
  appVersion: 1,
  patchId: "morning_demo_review_progress_patch",
  createdAt: "2026-05-29T07:10:00.000+08:00",
  source: {
    generatedBy: "review.html",
    workspaceFingerprint: "morning-demo"
  },
  events: [
    {
      id: "morning_demo_review_event",
      sessionId: firstDue.sessionId,
      cardId: firstDue.card.id,
      grade: "good",
      reviewedAt: "2026-05-29T07:11:00.000+08:00",
      baseUpdatedAt: firstDue.card.updatedAt,
      baseDueAt: firstDue.card.dueAt,
      baseStrength: firstDue.card.strength
    }
  ]
};

const inboxResult = applyMobileInboxPatch(demoWorkspace, mobileInboxPatch, new Date("2026-05-29T07:08:00.000+08:00"));
assert.equal(inboxResult.receipt.added, 1);
assert.equal(inboxResult.receipt.sanitizedSourceUrls, 1);
const duplicateInboxResult = applyMobileInboxPatch(inboxResult.workspace, mobileInboxPatch, new Date("2026-05-29T07:09:00.000+08:00"));
assert.equal(duplicateInboxResult.receipt.targetResolution, "duplicate-patch");
assert.equal(duplicateInboxResult.receipt.added, 0);
assert.throws(() => applyMobileInboxPatch(demoWorkspace, { schema: "invalid" }), /Unsupported mobile inbox patch/);
const reviewResult = applyReviewProgressPatch(demoWorkspace, reviewProgressPatch, new Date("2026-05-29T07:12:00.000+08:00"));
assert.equal(reviewResult.receipt.applied, 1);
const reviewConflictResult = applyReviewProgressPatch(demoWorkspace, {
  ...reviewProgressPatch,
  patchId: "morning_demo_review_conflict_patch",
  events: [{
    ...reviewProgressPatch.events[0],
    id: "morning_demo_review_conflict_event",
    baseUpdatedAt: "2026-05-29T00:00:00.000+08:00"
  }]
}, new Date("2026-05-29T07:13:00.000+08:00"));
assert.equal(reviewConflictResult.receipt.applied, 0);
assert.equal(reviewConflictResult.receipt.skippedConflict, 1);

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(MIRROR_DIR, { recursive: true });
await mkdir(PATCH_DIR, { recursive: true });

const mirrorBundle = buildMirrorBundle(demoWorkspace);
const mirrorZip = buildMirrorZip(demoWorkspace);
const sampleMirrorZipFile = `sample-${mirrorZip.filename}`;
await writeJson(join(OUT_DIR, SAMPLE_WORKSPACE_FILE), demoWorkspace);
await writeJson(join(OUT_DIR, SAMPLE_MIRROR_JSON_FILE), mirrorBundle);
await writeFile(join(OUT_DIR, sampleMirrorZipFile), Buffer.from(mirrorZip.data));
await writeJson(join(PATCH_DIR, SAMPLE_MOBILE_INBOX_PATCH_FILE), mobileInboxPatch);
await writeJson(join(PATCH_DIR, SAMPLE_REVIEW_PROGRESS_PATCH_FILE), reviewProgressPatch);

for (const file of mirrorBundle.files) {
  await writeText(join(MIRROR_DIR, file.path), file.content);
}

await writeText(join(OUT_DIR, "MORNING_REVIEW.md"), buildMorningReviewMarkdown({
  mirrorBundle,
  mirrorZip,
  sampleMirrorZipFile,
  inboxReceipt: inboxResult.receipt,
  duplicateInboxReceipt: duplicateInboxResult.receipt,
  reviewReceipt: reviewResult.receipt,
  reviewConflictReceipt: reviewConflictResult.receipt
}));
const reviewReportHtml = buildReviewStartHereHtml({
  mirrorBundle,
  mirrorZip,
  sampleMirrorZipFile,
  inboxReceipt: inboxResult.receipt,
  duplicateInboxReceipt: duplicateInboxResult.receipt,
  reviewReceipt: reviewResult.receipt,
  reviewConflictReceipt: reviewConflictResult.receipt
});
assert.match(reviewReportHtml, /href="MORNING_REVIEW\.md"/);
assert.match(reviewReportHtml, /href="mirror-folder\/index\.html"/);
assert.match(reviewReportHtml, /Fixture-only/);
await writeText(join(OUT_DIR, REVIEW_REPORT_FILE), reviewReportHtml);

const outputManifest = await collectOutputManifest(OUT_DIR);
const credentialSweep = await scanForCredentialLikeText(OUT_DIR);
assert.equal(credentialSweep.ok, true, `credential-like text found in ${credentialSweep.matches.map((item) => item.path).join(", ")}`);
await writeJson(join(OUT_DIR, "SUMMARY.json"), {
  ok: true,
  kind: "fixture",
  disclaimer: "Fixture-only generated sample data. This does not prove live Feishu sync, HarmonyOS device behavior, or signed Mac packaging.",
  generatedAt: new Date().toISOString(),
  provenance: {
    gitSha: getGitSha(),
    nodeVersion: process.version,
    generator: "scripts/build-morning-demo.mjs"
  },
  workspace: SAMPLE_WORKSPACE_FILE,
  reviewReport: REVIEW_REPORT_FILE,
  mirrorBundle: SAMPLE_MIRROR_JSON_FILE,
  mirrorZip: sampleMirrorZipFile,
  mirrorFileCount: mirrorBundle.files.length,
  mirrorBundleFingerprint: mirrorBundle.manifest.bundleFingerprint,
  mobileInboxPatch: `patches/${SAMPLE_MOBILE_INBOX_PATCH_FILE}`,
  reviewProgressPatch: `patches/${SAMPLE_REVIEW_PROGRESS_PATCH_FILE}`,
  assertions: {
    mobileInboxAdded: inboxResult.receipt.added,
    mobileInboxSanitizedSourceUrls: inboxResult.receipt.sanitizedSourceUrls,
    duplicateInboxTargetResolution: duplicateInboxResult.receipt.targetResolution,
    reviewProgressApplied: reviewResult.receipt.applied,
    reviewProgressSkippedConflict: reviewConflictResult.receipt.skippedConflict,
    credentialSweepOk: credentialSweep.ok
  },
  outputManifest,
  credentialSweep
});

console.log("morning_demo_ok");
console.log(`${OUT_DIR}/${REVIEW_REPORT_FILE}`);

async function writeJson(path, value) {
  await writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value);
}

function buildMorningReviewMarkdown({
  mirrorBundle,
  mirrorZip,
  sampleMirrorZipFile,
  inboxReceipt,
  duplicateInboxReceipt,
  reviewReceipt,
  reviewConflictReceipt
}) {
  return [
    "# Learning Companion Morning Review",
    "",
    "> FIXTURE ONLY: this pack is generated sample data. It does not prove live Feishu sync, real HarmonyOS device behavior, or signed Mac packaging.",
    "",
    "This pack is generated from a representative local workspace. It is credential-free and safe to inspect without Feishu or HarmonyOS setup.",
    "",
    "## Start Here",
    "",
    "0. Open `dist/morning-demo/review-start-here.html` for a clickable review dashboard.",
    "1. Run `npm run check:morning` from the repo root.",
    "2. Run `npm run dev` and open `http://127.0.0.1:5173`.",
    "3. Import `dist/morning-demo/sample-workspace.json` in the app.",
    "4. Open the Export tab and compare it with `dist/morning-demo/mirror-folder/index.html`.",
    "5. Open `dist/morning-demo/mirror-folder/review.html`, reveal a card, mark Good, and save/copy the progress patch.",
    "6. Open `dist/morning-demo/mirror-folder/inbox.html`, add a capture, and save/copy the inbox patch.",
    "7. Import the sample patches from `dist/morning-demo/patches/` to see the Mac-side receipts.",
    "",
    "## Generated Artifacts",
    "",
    `- Sample mirror JSON: \`${SAMPLE_MIRROR_JSON_FILE}\` (${mirrorBundle.manifest.fileCount} files)`,
    `- Sample mirror ZIP: \`${sampleMirrorZipFile}\` (${mirrorZip.fileCount} files, ${mirrorZip.bytes} bytes)`,
    "- Extracted folder: `mirror-folder/`",
    `- Sample workspace restore: \`${SAMPLE_WORKSPACE_FILE}\``,
    `- Sample phone capture patch: \`patches/${SAMPLE_MOBILE_INBOX_PATCH_FILE}\``,
    `- Sample review progress patch: \`patches/${SAMPLE_REVIEW_PROGRESS_PATCH_FILE}\``,
    "",
    "## What To Judge",
    "",
    "- Sidecar capture: can you capture quote/thought/time/source without losing focus?",
    "- Workspace Find: can you find a prior capture or card quickly?",
    "- Today pack: does it tell you what to resume?",
    "- Mirror folder: would this be readable in Feishu Drive or Windows?",
    "- Mobile inbox: can phone-side captures return to Mac without overwriting notes/cards?",
    "- Review progress: can phone-side review grades return without overwriting newer Mac state?",
    "",
    "## Safety Receipts Verified By Generator",
    "",
    `- Mobile inbox sample: ${inboxReceipt.added} added, ${inboxReceipt.sanitizedSourceUrls} unsafe source link stripped.`,
    `- Duplicate inbox sample: ${duplicateInboxReceipt.added} added after duplicate-patch detection.`,
    `- Review progress sample: ${reviewReceipt.applied} applied, ${reviewReceipt.skippedConflict} stale conflicts.`,
    `- Review progress conflict sample: ${reviewConflictReceipt.applied} applied, ${reviewConflictReceipt.skippedConflict} stale conflict skipped.`,
    "- Credential sweep and output hashes are recorded in `SUMMARY.json`.",
    "",
    "## What This Does Not Prove",
    "",
    "- This is still manual transport, not real Feishu OpenAPI sync.",
    "- HarmonyOS browser behavior needs a real device roundtrip.",
    "- localStorage is temporary; export often.",
    "- Mac shell is still a thin WKWebView wrapper, not a signed production app.",
    "- The sample ZIP has not been opened on Windows or HarmonyOS in this generator.",
    "",
    "## Current Evidence",
    "",
    "- `npm run smoke` covers model contracts and generated static artifacts.",
    "- `npm run smoke:browser` covers browser interaction, mirror generation/import, static review/inbox runtime behavior, and patch import receipts.",
    "- `npm run check:morning` runs web smoke, browser smoke, Mac shell build, and this demo pack generator.",
    ""
  ].join("\n");
}

function buildReviewStartHereHtml({
  mirrorBundle,
  mirrorZip,
  sampleMirrorZipFile,
  inboxReceipt,
  duplicateInboxReceipt,
  reviewReceipt,
  reviewConflictReceipt
}) {
  const artifactRows = [
    ["Morning review", "MORNING_REVIEW.md", "Readable checklist and evidence summary."],
    ["Sample workspace", SAMPLE_WORKSPACE_FILE, "Import this into the app for the demo state."],
    ["Mirror home", "mirror-folder/index.html", "Static folder intended for Feishu Drive or Windows reading."],
    ["Today pack", "mirror-folder/TODAY.md", "Resume list generated from the workspace."],
    ["Portable review", "mirror-folder/review.html", "Offline review page that exports progress patches."],
    ["Mobile inbox", "mirror-folder/inbox.html", "Phone/Windows capture draft page."],
    ["Mirror JSON", SAMPLE_MIRROR_JSON_FILE, `${mirrorBundle.manifest.fileCount} files in structured bundle form.`],
    ["Mirror ZIP", sampleMirrorZipFile, `${mirrorZip.fileCount} files, ${mirrorZip.bytes} bytes.`],
    ["Inbox patch", `patches/${SAMPLE_MOBILE_INBOX_PATCH_FILE}`, "Sample append-only phone capture patch."],
    ["Review patch", `patches/${SAMPLE_REVIEW_PROGRESS_PATCH_FILE}`, "Sample append-only review progress patch."],
    ["Summary", "SUMMARY.json", "Hashes, provenance, and generator receipts."]
  ];
  const receiptRows = [
    ["Mobile inbox import", `${inboxReceipt.added} added`, `${inboxReceipt.sanitizedSourceUrls} unsafe source link stripped`],
    ["Duplicate inbox import", `${duplicateInboxReceipt.added} added`, duplicateInboxReceipt.targetResolution],
    ["Review progress import", `${reviewReceipt.applied} applied`, `${reviewReceipt.skippedConflict} stale conflicts`],
    ["Review conflict import", `${reviewConflictReceipt.applied} applied`, `${reviewConflictReceipt.skippedConflict} stale conflicts`]
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Learning Companion Morning Review</title>
  <style>
    :root { color-scheme: light dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f6f3ed; color: #201f1b; }
    main { max-width: 1100px; margin: 0 auto; padding: 32px 20px 48px; }
    header { display: grid; gap: 10px; margin-bottom: 24px; }
    h1 { margin: 0; font-size: 32px; letter-spacing: 0; }
    h2 { margin: 0 0 12px; font-size: 18px; }
    p { line-height: 1.55; max-width: 760px; }
    .banner { border-left: 4px solid #b45309; background: #fff7ed; padding: 12px 14px; border-radius: 6px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 14px; }
    section { margin-top: 20px; }
    .card { background: #fffaf2; border: 1px solid #e5ded1; border-radius: 8px; padding: 16px; }
    .artifact { display: grid; gap: 6px; }
    a { color: #0f766e; font-weight: 650; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .meta { color: #666154; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; background: #fffaf2; border: 1px solid #e5ded1; border-radius: 8px; overflow: hidden; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e5ded1; vertical-align: top; }
    th { background: #ece7dc; }
    tr:last-child td { border-bottom: 0; }
    code { background: #ece7dc; padding: 2px 5px; border-radius: 4px; }
    @media (prefers-color-scheme: dark) {
      body { background: #171612; color: #f3efe6; }
      .banner { background: #2f2415; border-left-color: #f59e0b; }
      .card, table { background: #201f1b; border-color: #3d382f; }
      th { background: #2c2923; }
      th, td { border-bottom-color: #3d382f; }
      a { color: #5eead4; }
      .meta { color: #bbb2a1; }
      code { background: #2c2923; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Learning Companion Morning Review</h1>
      <p class="banner"><strong>Fixture-only review pack.</strong> This dashboard proves generated local artifacts and safety receipts, not live Feishu sync, real HarmonyOS behavior, or signed Mac packaging.</p>
      <p>Start here in the morning: open the app, import the sample workspace, then inspect the static mirror, mobile inbox, and review progress loop.</p>
    </header>
    <section>
      <h2>Fast Path</h2>
      <div class="grid">
        <div class="card"><strong>1. Verify</strong><p>Run <code>npm run check:morning</code>. It runs web smoke, browser smoke, Mac build, and this generator.</p></div>
        <div class="card"><strong>2. Import</strong><p>Open the app and import <a href="${escapeHtml(SAMPLE_WORKSPACE_FILE)}">${escapeHtml(SAMPLE_WORKSPACE_FILE)}</a>.</p></div>
        <div class="card"><strong>3. Inspect</strong><p>Open <a href="mirror-folder/index.html">mirror-folder/index.html</a>, then try review and inbox patch pages.</p></div>
      </div>
    </section>
    <section>
      <h2>Generated Artifacts</h2>
      <div class="grid">
        ${artifactRows.map(([title, href, description]) => `<div class="card artifact"><a href="${escapeHtml(href)}">${escapeHtml(title)}</a><span class="meta">${escapeHtml(description)}</span></div>`).join("\n        ")}
      </div>
    </section>
    <section>
      <h2>Safety Receipts</h2>
      <table>
        <thead><tr><th>Check</th><th>Result</th><th>Detail</th></tr></thead>
        <tbody>
          ${receiptRows.map(([name, result, detail]) => `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(result)}</td><td>${escapeHtml(detail)}</td></tr>`).join("\n          ")}
        </tbody>
      </table>
    </section>
    <section>
      <h2>Current Gaps</h2>
      <ul>
        <li>Live Feishu OpenAPI sync is not implemented.</li>
        <li>HarmonyOS and Windows behavior still need real-device verification.</li>
        <li>The Mac shell is an internal WKWebView shell, not a signed production app.</li>
        <li>Native selected-text capture without copy-first remains a follow-up.</li>
      </ul>
    </section>
  </main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getGitSha() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function collectOutputManifest(root) {
  const files = await listFiles(root);
  const entries = [];
  for (const path of files) {
    if (path.endsWith("/SUMMARY.json")) continue;
    const data = await readFile(path);
    entries.push({
      path: path.slice(`${root}/`.length),
      bytes: data.length,
      sha256: createHash("sha256").update(data).digest("hex")
    });
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

async function scanForCredentialLikeText(root) {
  const patterns = [
    { name: "authorization-header", regex: /\bAuthorization\s*:/i },
    { name: "cookie-header", regex: /\b(Set-)?Cookie\s*:/i },
    { name: "bearer-token", regex: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/i },
    { name: "jwt", regex: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/ },
    { name: "mira-session", regex: /\bmira_session\b/i },
    { name: "csrf-token", regex: /\bopen_csrf_token\b/i },
    { name: "oauth-code", regex: /\boauth[_-]?code\b/i }
  ];
  const matches = [];
  for (const path of await listFiles(root)) {
    if (path.endsWith(".zip")) continue;
    if (path.endsWith("/SUMMARY.json")) continue;
    const text = await readFile(path, "utf8");
    for (const pattern of patterns) {
      if (pattern.regex.test(text)) {
        matches.push({ path: path.slice(`${root}/`.length), pattern: pattern.name });
      }
    }
  }
  return {
    ok: matches.length === 0,
    scannedFiles: (await listFiles(root)).filter((path) => !path.endsWith(".zip") && !path.endsWith("/SUMMARY.json")).length,
    matches
  };
}

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      paths.push(...await listFiles(path));
    } else if (entry.isFile()) {
      paths.push(path);
    }
  }
  return paths;
}
