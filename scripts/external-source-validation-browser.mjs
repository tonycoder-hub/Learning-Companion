#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { dirname, extname, join, resolve } from "node:path";

const root = resolve("apps/companion-web");
const startedAtMs = Date.now();
const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(buildCliHelp());
  process.exit(0);
}
if (args["source-intake"]) {
  try {
    await runSourceIntake(args);
  } catch (error) {
    console.error(`source_intake_error: ${error.message}`);
    process.exit(1);
  }
  process.exit(0);
}
const selfTest = Boolean(args["self-test"]);
const approvedCurrentTurn = Boolean(args["approved-current-turn"]);
const publicSourceDryRun = Boolean(args["public-source-dry-run"]);
const outputRoot = resolve(args["out-root"] || ".codex-tmp/external-source-validation");
const runSlug = selfTest
  ? "selftest-local-fixtures"
  : safeSlug(args["run-label"] || (publicSourceDryRun ? "public-source-dry-run" : "approved-sources"));
const runRoot = join(outputRoot, `${timestampSlug(new Date(startedAtMs))}-${runSlug}`);
const profile = join(runRoot, "profile");
const chromePath = resolveChromePath();

const modeCount = [selfTest, approvedCurrentTurn, publicSourceDryRun].filter(Boolean).length;
if (modeCount !== 1) {
  throw new Error("External source validation requires exactly one of --self-test, --approved-current-turn, or --public-source-dry-run.");
}

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"]
]);
const virtualRoutes = new Map();

mkdirSync(profile, { recursive: true, mode: 0o700 });
await mkdir(runRoot, { recursive: true, mode: 0o700 });
if (selfTest) runApprovedUrlBoundarySelfChecks();

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (virtualRoutes.has(url.pathname)) {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store"
      });
      response.end(virtualRoutes.get(url.pathname));
      return;
    }
    const filePath = join(root, url.pathname === "/" ? "index.html" : url.pathname);
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes.get(extname(filePath)) || "application/octet-stream",
      "cache-control": "no-store"
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("not found");
  }
});

const listenPort = await new Promise((resolvePort) => {
  server.listen(0, "127.0.0.1", () => resolvePort(server.address().port));
});
const appUrl = `http://127.0.0.1:${listenPort}/`;
const sourceSet = buildSourceSet({ appUrl, selfTest, publicSourceDryRun, args });
const debuggingPort = await allocateTcpPort();
const runContext = await buildRunContext({
  appUrl,
  chromePath,
  debuggingPort,
  profile,
  selfTest,
  publicSourceDryRun
});
const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-extensions",
  "--disable-sync",
  "--no-first-run",
  "--no-sandbox",
  "--window-size=1440,900",
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${debuggingPort}`,
  appUrl
], { stdio: "ignore" });

try {
  const target = await waitForTarget(debuggingPort);
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  const exceptions = [];
  cdp.on("Runtime.exceptionThrown", (event) => exceptions.push(event));
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  const runs = [];
  for (const source of sourceSet) {
    const result = await runSourceValidation({ cdp, appUrl, source, runRoot, exceptions });
    runs.push(result);
  }

  const receipt = {
    schema: "learning-companion.external-source-validation-browser.v1",
    generatedAt: new Date().toISOString(),
    evidenceTier: selfTest
      ? "LOCAL_FIXTURE_SELF_TEST"
      : publicSourceDryRun
        ? "PUBLIC_SOURCE_DRY_RUN"
        : "APPROVED_SOURCE_CANDIDATE",
    canClaimExternalKo: false,
    claimBoundary: selfTest
      ? "Self-test uses generated local fixtures and cannot satisfy approved reading/video evidence."
      : publicSourceDryRun
        ? "Dry run uses real public sources but lacks current-turn source approval and human privacy review; it cannot support the KO."
        : "Candidate evidence still requires human privacy review before it can support the KO.",
    runRoot,
    chromePath,
    appUrl,
    runContext,
    approvedCurrentTurn: approvedCurrentTurn && !publicSourceDryRun,
    publicSourceDryRun,
    selfTest,
    runs
  };
  await writeFile(join(runRoot, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  await writeFile(join(runRoot, "run.md"), buildRunMarkdown(receipt));

  assert.equal(runs.length, 2);
  assert.equal(runs.every((run) => run.summary.ok), true);
  assert.equal(runs.some((run) => run.source.type === "reading"), true);
  assert.equal(runs.some((run) => run.source.type === "video"), true);
  assert.equal(receipt.canClaimExternalKo, false);

  cdp.close();
  console.log(`${selfTest ? "external_source_validation_selftest_ok" : publicSourceDryRun ? "external_source_validation_public_dry_run_ok" : "external_source_validation_candidate_ok"} ${join(runRoot, "receipt.json")}`);
} finally {
  chrome.kill("SIGTERM");
  await waitForProcessExit(chrome, 3000);
  server.close();
}

async function runSourceValidation({ cdp, appUrl, source, runRoot, exceptions }) {
  const sourceDir = join(runRoot, source.type);
  await mkdir(sourceDir, { recursive: true, mode: 0o700 });
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 720,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await cdp.send("Page.navigate", { url: source.url });
  await waitForPageQuiet(cdp);
  const sourcePage = await assertSourcePageUsable(cdp, source);
  const sourceTitle = await cdp.evaluate(`document.title || ${JSON.stringify(source.title)}`);
  const sourceShot = await capturePng(cdp, join(sourceDir, "source-page.png"));

  await cdp.send("Page.navigate", { url: appUrl });
  await waitForNativeBridge(cdp, exceptions);
  const before = await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const setLang = (value) => {
      const select = document.querySelector("#languageSelect");
      if (!select) return;
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    };
    setLang(${JSON.stringify(source.language)});
    setValue("#sessionTitle", ${JSON.stringify(source.sessionTitle)});
    setValue("#sourceTitle", ${JSON.stringify(sourceTitle || source.title)});
    setValue("#sourceUrl", ${JSON.stringify(source.url)});
    setValue("#materialType", ${JSON.stringify(source.type === "video" ? "video" : "doc")});
    setValue("#timestampInput", ${JSON.stringify(source.timestamp || "")});
    setValue("#quoteInput", ${JSON.stringify(source.quote)});
    setValue("#thoughtInput", ${JSON.stringify(source.thought)});
    return {
      language: document.documentElement.lang,
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      sourceTitle: document.querySelector("#sourceTitle")?.value || "",
      sourceUrl: document.querySelector("#sourceUrl")?.value || "",
      timestamp: document.querySelector("#timestampInput")?.value || "",
      quote: document.querySelector("#quoteInput")?.value || "",
      thought: document.querySelector("#thoughtInput")?.value || ""
    };
  })()`);
  const appBeforeShot = await capturePng(cdp, join(sourceDir, "app-before-capture.png"));
  await captureComposite({
    cdp,
    title: `${source.type.toUpperCase()} source beside Learning Companion before capture`,
    leftLabel: `${source.type} source`,
    rightLabel: "Learning Companion capture form",
    leftPng: sourceShot,
    rightPng: appBeforeShot,
    outPath: join(sourceDir, "01-source-and-app-before-capture.png")
  });

  await cdp.send("Page.navigate", { url: appUrl });
  await waitForNativeBridge(cdp, exceptions);
  const saved = await cdp.evaluate(`(async () => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const setLang = (value) => {
      const select = document.querySelector("#languageSelect");
      if (!select) return;
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const compact = (text) => String(text || "").replace(/\\s+/g, " ").trim();
    setLang(${JSON.stringify(source.language)});
    setValue("#sessionTitle", ${JSON.stringify(source.sessionTitle)});
    setValue("#sourceTitle", ${JSON.stringify(sourceTitle || source.title)});
    setValue("#sourceUrl", ${JSON.stringify(source.url)});
    setValue("#materialType", ${JSON.stringify(source.type === "video" ? "video" : "doc")});
    setValue("#timestampInput", ${JSON.stringify(source.timestamp || "")});
    setValue("#quoteInput", ${JSON.stringify(source.quote)});
    setValue("#thoughtInput", ${JSON.stringify(source.thought)});
    document.querySelector("#captureBtn").click();
    await new Promise((resolve) => setTimeout(resolve, 80));
    const workspace = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId) || workspace.sessions[0];
    const captures = workspace.sessions.flatMap((item) => (item.captures || []).map((capture) => ({ capture, sessionId: item.id })));
    const matched = captures.find(({ capture }) => capture.sourceUrl === ${JSON.stringify(source.url)} && capture.quote === ${JSON.stringify(source.quote)})
      || captures.find(({ capture }) => capture.sourceUrl === ${JSON.stringify(source.url)})
      || captures[0]
      || {};
    const capture = matched.capture || {};
    return {
      activityTitle: compact(document.querySelector("#activityTitle")?.textContent || ""),
      activityDetail: compact(document.querySelector("#activityDetail")?.textContent || ""),
      hintText: compact(document.querySelector("#activityHintText")?.textContent || ""),
      hintAction: compact(document.querySelector("#activityHintBtn")?.textContent || ""),
      captureId: capture.id || "",
      captureQuote: capture.quote || "",
      captureThought: capture.thought || "",
      captureSourceTitle: capture.sourceTitle || "",
      captureSourceUrl: capture.sourceUrl || "",
      captureTimestamp: capture.timestamp || "",
      captureMaterialType: capture.materialType || "",
      captureCount: captures.length,
      activeSessionCaptureCount: session.captures.length
    };
  })()`);
  await capturePng(cdp, join(sourceDir, "02-capture-saved.png"));
  const videoTools = await exerciseVideoLearningTools({ cdp, source, sourceDir });

  const resume = await cdp.evaluate(`(() => {
    let opened = "";
    let target = "";
    let features = "";
    const nativeOpen = window.open;
    window.open = (href, nextTarget, nextFeatures) => {
      opened = href;
      target = nextTarget;
      features = nextFeatures;
      return null;
    };
    document.querySelector("#activityHintBtn")?.click();
    window.open = nativeOpen;
    return { opened, target, features };
  })()`);
  assert.ok(resume.opened, `${source.type} resume action should open a source URL`);
  await cdp.send("Page.navigate", { url: resume.opened });
  await waitForPageQuiet(cdp);
  await capturePng(cdp, join(sourceDir, "03-resume-source.png"));
  if (source.type === "video") {
    await capturePng(cdp, join(sourceDir, "04-video-timestamp.png"));
  }

  const expectedFiles = [
    "01-source-and-app-before-capture.png",
    "02-capture-saved.png",
    ...(source.type === "video" ? ["02b-video-learning-tools.png"] : []),
    "03-resume-source.png",
    ...(source.type === "video" ? ["04-video-timestamp.png"] : [])
  ];
  expectedFiles.forEach((file) => {
    assert.equal(existsSync(join(sourceDir, file)), true, `${source.type} evidence missing ${file}`);
  });

  const captureSaved = Boolean(saved.captureId);
  const sourceContextPreserved = saved.captureSourceUrl === source.url;
  const resumeOpened = Boolean(resume.opened);
  const videoTimestampCaptured = source.type === "video" ? Boolean(saved.captureTimestamp) && saved.captureTimestamp === source.timestamp : false;
  const videoLearningToolsCaptured = source.type === "video"
    ? Boolean(videoTools?.timestampNoteInserted && videoTools?.videoBookmarkSaved && videoTools?.playbackRatePersisted)
    : false;
  const ok = captureSaved
    && sourceContextPreserved
    && resumeOpened
    && (source.type !== "video" || (videoTimestampCaptured && videoLearningToolsCaptured));

  return {
    source: {
      type: source.type,
      url: source.url,
      title: sourceTitle || source.title,
      page: sourcePage,
      approved: source.approved,
      approvalSource: source.approvalSource,
      language: source.language,
      dryRunOnly: Boolean(source.dryRunOnly)
    },
    appBefore: before,
    saved,
    videoTools,
    resume,
    files: expectedFiles.map((file) => join(sourceDir, file)),
    summary: {
      ok,
      sourceBesideAppScreenshot: expectedFiles.includes("01-source-and-app-before-capture.png"),
      captureSaved,
      sourceContextPreserved,
      resumeOpened,
      videoTimestampCaptured,
      videoLearningToolsCaptured,
      selfTestOnly: source.selfTestOnly,
      dryRunOnly: Boolean(source.dryRunOnly),
      canClaimKo: false
    }
  };
}

async function exerciseVideoLearningTools({ cdp, source, sourceDir }) {
  if (source.type !== "video") return null;
  const result = await cdp.evaluate(`(async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const compact = (text) => String(text || "").replace(/\\s+/g, " ").trim();
    const expectedTimestamp = ${JSON.stringify(source.timestamp || "")};
    const bookmarkLabel = "External source timestamp";
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      if (!node) return false;
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    };
    setValue("#timestampInput", expectedTimestamp);
    if (!document.querySelector(".video-speed-select")) {
      document.querySelector("#openSourceBtn")?.click();
      await delay(160);
    }
    const noteButton = document.querySelector("#insertTimestampNoteBtn");
    const timestampButtonEnabled = Boolean(noteButton && !noteButton.disabled);
    noteButton?.click();
    await delay(120);

    const speedSelect = document.querySelector(".video-speed-select");
    const speedControlAvailable = Boolean(speedSelect);
    if (speedSelect) {
      speedSelect.value = "1.5";
      speedSelect.dispatchEvent(new Event("change", { bubbles: true }));
      await delay(120);
    }

    const bookmarkButton = document.querySelector("[data-video-bookmark-action='add']")
      || Array.from(document.querySelectorAll("button")).find((button) => {
        const label = compact((button.textContent || "") + " " + (button.title || "") + " " + (button.getAttribute("aria-label") || ""));
        return /Bookmark|书签/i.test(label) && /Save current video time|保存为书签|保存/i.test(label);
      });
    const nativePrompt = window.prompt;
    window.prompt = () => bookmarkLabel;
    try {
      bookmarkButton?.click();
    } finally {
      window.prompt = nativePrompt;
    }
    await delay(180);

    const workspace = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId) || workspace.sessions[0] || {};
    const notesMarkdown = String(session.notesMarkdown || "");
    const bookmarks = Array.isArray(session.videoBookmarks) ? session.videoBookmarks : [];
    const latestBookmark = bookmarks[bookmarks.length - 1] || {};
    const prefs = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}");
    const timestampNeedle = "[" + expectedTimestamp + "]";
    const timestampNoteInserted = expectedTimestamp
      ? notesMarkdown.includes(timestampNeedle) && notesMarkdown.includes(${JSON.stringify(source.url)})
      : false;
    const videoBookmarkSaved = bookmarks.length > 0
      && latestBookmark.timestamp === expectedTimestamp
      && latestBookmark.label === bookmarkLabel;
    const playbackRatePersisted = Number(prefs.videoPlaybackRate) === 1.5;
    return {
      timestampButtonEnabled,
      speedControlAvailable,
      bookmarkButtonAvailable: Boolean(bookmarkButton),
      timestampNoteInserted,
      videoBookmarkSaved,
      playbackRatePersisted,
      bookmarkCount: bookmarks.length,
      bookmarkLabel: latestBookmark.label || "",
      bookmarkTimestamp: latestBookmark.timestamp || "",
      playbackRate: prefs.videoPlaybackRate ?? null
    };
  })()`);
  await capturePng(cdp, join(sourceDir, "02b-video-learning-tools.png"));
  return result;
}

async function capturePng(cdp, outPath) {
  await mkdir(dirname(outPath), { recursive: true, mode: 0o700 });
  const result = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  await writeFile(outPath, Buffer.from(result.data, "base64"));
  return result.data;
}

async function captureComposite({ cdp, title, leftLabel, rightLabel, leftPng, rightPng, outPath }) {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; background: #f6f7f9; color: #1f2933; }
      header { padding: 14px 18px; font-weight: 700; background: #ffffff; border-bottom: 1px solid #d8dee6; }
      main { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px; }
      section { background: #ffffff; border: 1px solid #d8dee6; border-radius: 8px; overflow: hidden; }
      h2 { margin: 0; padding: 10px 12px; font-size: 15px; border-bottom: 1px solid #e6ebf0; }
      img { display: block; width: 100%; height: auto; }
    </style>
  </head>
  <body>
    <header>${escapeHtml(title)}</header>
    <main>
      <section><h2>${escapeHtml(leftLabel)}</h2><img src="data:image/png;base64,${leftPng}" alt=""></section>
      <section><h2>${escapeHtml(rightLabel)}</h2><img src="data:image/png;base64,${rightPng}" alt=""></section>
    </main>
  </body>
</html>`;
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await cdp.send("Page.navigate", { url: `data:text/html;charset=utf-8,${encodeURIComponent(html)}` });
  await waitForPageQuiet(cdp);
  await capturePng(cdp, outPath);
}

async function assertSourcePageUsable(cdp, source) {
  const page = await cdp.evaluate(`(() => {
    const compact = (text) => String(text || "").replace(/\\s+/g, " ").trim();
    const bodyText = compact(document.body?.innerText || "");
    const hasMedia = Boolean(document.querySelector("video, audio, source, picture, img"));
    return {
      href: location.href,
      title: document.title || "",
      bodyTextSample: bodyText.slice(0, 500),
      bodyTextLength: bodyText.length,
      hasMedia,
      chromeError: document.body?.id === "t" || document.documentElement?.classList?.contains("neterror")
    };
  })()`);
  const errorText = `${page.title}\n${page.bodyTextSample}`;
  const looksLikeBrowserError = page.chromeError || /This site can.t be reached|ERR_[A-Z0-9_]+|DNS_PROBE_|took too long to respond|No internet/i.test(errorText);
  if (looksLikeBrowserError) {
    throw new Error(`${source.type} source page did not load usable public content: ${page.title || source.url}`);
  }
  if (!page.hasMedia && page.bodyTextLength < 80) {
    throw new Error(`${source.type} source page has too little visible content for evidence capture.`);
  }
  return page;
}

function buildSourceSet({ appUrl, selfTest, publicSourceDryRun, args }) {
  if (selfTest) {
    const readingPath = "/external-fixtures/reading.html";
    const videoPath = "/external-fixtures/video.html";
    virtualRoutes.set(readingPath, fixtureReadingHtml());
    virtualRoutes.set(videoPath, fixtureVideoHtml());
    return [
      {
        type: "reading",
        url: `${appUrl.replace(/\/$/, "")}${readingPath}`,
        title: "Local Reading Fixture",
        sessionTitle: "External validation self-test reading",
        quote: "A local fixture can verify the evidence harness without claiming real source approval.",
        thought: "Self-test: capture reading context and resume the source.",
        approved: "LOCAL_FIXTURE_SELF_TEST",
        approvalSource: "script --self-test",
        language: "zh",
        selfTestOnly: true
      },
      {
        type: "video",
        url: `${appUrl.replace(/\/$/, "")}${videoPath}`,
        title: "Local Video Fixture",
        sessionTitle: "External validation self-test video",
        quote: "The local video fixture displays timestamp 01:35 for screenshot evidence.",
        thought: "Self-test: capture a timestamped video note and resume the source.",
        timestamp: "01:35",
        approved: "LOCAL_FIXTURE_SELF_TEST",
        approvalSource: "script --self-test",
        language: "en",
        selfTestOnly: true
      }
    ];
  }

  const approvalSource = publicSourceDryRun ? (args["dry-run-note"] || "") : (args["approval-note"] || "");
  if (publicSourceDryRun && !approvalSource) throw new Error("Public source dry-run requires --dry-run-note.");
  if (!publicSourceDryRun && !approvalSource) throw new Error("External validation requires --approval-note.");
  const readingUrl = requireApprovedUrl(args["reading-url"], "reading-url");
  const videoUrl = requireApprovedUrl(args["video-url"], "video-url");
  const videoTimestamp = args["video-timestamp"] || "";
  if (!videoTimestamp) throw new Error("External video validation requires --video-timestamp for timestamp/resume evidence.");
  const approvalMarker = publicSourceDryRun ? "PUBLIC_SOURCE_DRY_RUN_NOT_APPROVED" : "APPROVED_IN_CURRENT_TURN";
  const sourceApproval = publicSourceDryRun ? `dry-run only: ${approvalSource}` : approvalSource;
  return [
    {
      type: "reading",
      url: readingUrl,
      title: args["reading-title"] || (publicSourceDryRun ? "Public reading source dry-run" : "Approved reading source"),
      sessionTitle: args["reading-session"] || (publicSourceDryRun ? "Public reading dry-run validation" : "Approved reading validation"),
      quote: args["reading-quote"] || (publicSourceDryRun ? "Public reading source note captured during dry-run validation." : "Approved reading source note captured during validation."),
      thought: args["reading-thought"] || "Capture this reading point and verify source resume.",
      approved: approvalMarker,
      approvalSource: sourceApproval,
      language: args["reading-language"] || "zh",
      selfTestOnly: false,
      dryRunOnly: publicSourceDryRun
    },
    {
      type: "video",
      url: videoUrl,
      title: args["video-title"] || (publicSourceDryRun ? "Public video source dry-run" : "Approved video source"),
      sessionTitle: args["video-session"] || (publicSourceDryRun ? "Public video dry-run validation" : "Approved video validation"),
      quote: args["video-quote"] || (publicSourceDryRun ? "Public video source note captured during dry-run validation." : "Approved video source note captured during validation."),
      thought: args["video-thought"] || "Capture this video point and verify source resume.",
      timestamp: videoTimestamp,
      approved: approvalMarker,
      approvalSource: sourceApproval,
      language: args["video-language"] || "en",
      selfTestOnly: false,
      dryRunOnly: publicSourceDryRun
    }
  ];
}

function fixtureReadingHtml() {
  return `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Local Reading Fixture</title></head>
  <body style="font-family: system-ui, sans-serif; max-width: 720px; margin: 40px auto; line-height: 1.6;">
    <h1>Local Reading Fixture</h1>
    <p>A local fixture can verify the evidence harness without claiming real source approval.</p>
    <p>The app should preserve this page title and URL when the capture is saved.</p>
  </body>
</html>`;
}

function fixtureVideoHtml() {
  return `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Local Video Fixture</title></head>
  <body style="font-family: system-ui, sans-serif; max-width: 720px; margin: 40px auto; line-height: 1.6;">
    <h1>Local Video Fixture</h1>
    <div style="border: 2px solid #2d6cdf; border-radius: 12px; padding: 24px; background: #eef5ff;">
      <strong>Fixture playback timestamp</strong>
      <p style="font-size: 48px; margin: 12px 0;">01:35</p>
      <p>The local video fixture displays timestamp 01:35 for screenshot evidence.</p>
    </div>
  </body>
</html>`;
}

function buildRunMarkdown(receipt) {
  const git = receipt.runContext?.appRevision || {};
  const browser = receipt.runContext?.browser || {};
  const viewport = receipt.runContext?.viewport || {};
  const network = receipt.runContext?.network || {};
  const lines = [
    "# External Source Validation Browser Run",
    "",
    `Date: ${receipt.generatedAt}`,
    `Evidence tier: ${receipt.evidenceTier}`,
    `Can claim external KO: ${receipt.canClaimExternalKo}`,
    `Claim boundary: ${receipt.claimBoundary}`,
    "",
    "## Run Context",
    "",
    `- App URL: ${receipt.runContext?.app?.url || receipt.appUrl}`,
    `- App root: ${receipt.runContext?.app?.root || root}`,
    `- Git HEAD: ${git.gitHead || "UNKNOWN"}`,
    `- Dirty worktree: ${git.dirtyWorktree}`,
    `- Git status captured: ${git.statusCaptured}`,
    `- Changed/untracked entries: ${git.statusLineCount ?? "UNKNOWN"}`,
    `- Browser: ${browser.chromePath || receipt.chromePath}`,
    `- Browser profile mode: ${browser.profileMode || "throwaway-profile"}`,
    `- Headless: ${browser.headless}`,
    `- Viewport: ${viewport.app?.width || "TBD"}x${viewport.app?.height || "TBD"} app, ${viewport.sourceEvidence?.width || "TBD"}x${viewport.sourceEvidence?.height || "TBD"} source capture`,
    `- Network mode: ${network.mode || "TBD"}`,
    `- Local app server: ${network.localAppServer || "TBD"}`,
    "",
    "## Runs",
    ""
  ];
  receipt.runs.forEach((run) => {
    lines.push(`### ${run.source.type}`);
    lines.push("");
    lines.push(`- URL: ${run.source.url}`);
    lines.push(`- Title: ${run.source.title}`);
    lines.push(`- Approved URL/file: ${run.source.approved}`);
    lines.push(`- Approval source: ${run.source.approvalSource}`);
    lines.push(`- Dry-run only: ${run.source.dryRunOnly}`);
    lines.push(`- UI language: ${run.source.language}`);
    lines.push(`- Capture saved: ${run.summary.captureSaved}`);
    lines.push(`- Source context preserved: ${run.summary.sourceContextPreserved}`);
    lines.push(`- Resume opened: ${run.summary.resumeOpened}`);
    lines.push(`- Video timestamp captured: ${run.summary.videoTimestampCaptured}`);
    lines.push(`- Video learning tools captured: ${run.summary.videoLearningToolsCaptured}`);
    if (run.source.type === "video") {
      lines.push(`- Timestamp note inserted: ${run.videoTools?.timestampNoteInserted}`);
      lines.push(`- Video bookmark saved: ${run.videoTools?.videoBookmarkSaved}`);
      lines.push(`- Playback speed preference saved: ${run.videoTools?.playbackRatePersisted}`);
      lines.push(`- Bookmark observed: ${run.videoTools?.bookmarkTimestamp || "TBD"} ${run.videoTools?.bookmarkLabel || "TBD"}`);
      lines.push(`- Playback rate observed: ${run.videoTools?.playbackRate ?? "TBD"}`);
    }
    lines.push("");
    lines.push("Evidence files:");
    run.files.forEach((file) => lines.push(`- ${file}`));
    lines.push("");
  });
  lines.push("## Blocked / Not Run / Needs Decision");
  lines.push("");
  if (receipt.selfTest) {
    lines.push("- This is a local fixture self-test and cannot satisfy the approved external reading/video evidence rows.");
  } else if (receipt.publicSourceDryRun) {
    lines.push("- This is a real public-source dry-run without current-turn source approval; it cannot be privacy-reviewed into KO evidence.");
  } else {
    lines.push("- Human privacy review is still required before using these artifacts as KO evidence.");
  }
  lines.push("- Windows, HarmonyOS device/toolchain, and native Mac GUI/manual proof are not covered by this run.");
  return `${lines.join("\n")}\n`;
}

async function buildRunContext({ appUrl, chromePath, debuggingPort, profile, selfTest, publicSourceDryRun }) {
  const gitHeadResult = await execFileText("git", ["rev-parse", "HEAD"]);
  const gitStatusResult = await execFileText("git", ["status", "--short"]);
  const statusLines = gitStatusResult.ok
    ? gitStatusResult.stdout.split("\n").map((line) => line.trimEnd()).filter(Boolean)
    : [];
  return {
    schema: "learning-companion.external-source-run-context.v1",
    app: {
      url: appUrl,
      root
    },
    appRevision: {
      gitHead: gitHeadResult.ok ? gitHeadResult.stdout.trim() : "UNKNOWN",
      gitHeadCaptured: gitHeadResult.ok,
      dirtyWorktree: gitStatusResult.ok ? statusLines.length > 0 : true,
      statusCaptured: gitStatusResult.ok,
      statusLineCount: statusLines.length,
      statusShort: statusLines.slice(0, 120),
      statusTruncated: statusLines.length > 120
    },
    browser: {
      chromePath,
      headless: true,
      profileMode: "throwaway-profile",
      profilePath: profile,
      debuggingPort
    },
    viewport: {
      app: {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      },
      sourceEvidence: {
        width: 720,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      },
      composite: {
        width: 1440,
        height: 900
      }
    },
    network: {
      mode: selfTest
        ? "LOCAL_FIXTURE_SOURCE_AND_LOCAL_APP"
        : publicSourceDryRun
          ? "PUBLIC_REMOTE_SOURCE_DRY_RUN_AND_LOCAL_APP"
          : "APPROVED_REMOTE_SOURCE_AND_LOCAL_APP",
      localAppServer: "127.0.0.1 ephemeral",
      browserFlags: [
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-extensions",
        "--disable-sync",
        "--no-first-run"
      ]
    }
  };
}

function execFileText(command, commandArgs) {
  return new Promise((resolveCommand) => {
    execFile(command, commandArgs, { cwd: process.cwd(), timeout: 5000 }, (error, stdout, stderr) => {
      resolveCommand({
        ok: !error,
        stdout: String(stdout || "").trim(),
        stderr: String(stderr || "").trim()
      });
    });
  });
}

async function runSourceIntake(args) {
  const input = await readSourceIntakeText(args);
  const parsed = parseSourceIntake(input);
  const readingUrl = requireApprovedUrl(parsed.readingUrl, "reading-url");
  const videoUrl = requireApprovedUrl(parsed.videoUrl, "video-url");
  const videoTimestamp = normalizeVideoTimestamp(parsed.videoTimestamp);
  const publicDryRunCommand = buildSourceValidationCommand({
    mode: "public-dry-run",
    readingUrl,
    videoUrl,
    videoTimestamp,
    note: "source intake preflight"
  });
  const approvedCommand = buildSourceValidationCommand({
    mode: "approved",
    readingUrl,
    videoUrl,
    videoTimestamp,
    note: "<current-turn approval>"
  });
  const handoff = buildSourceIntakeHandoff({
    readingUrl,
    videoUrl,
    videoTimestamp,
    publicDryRunCommand,
    approvedCommand
  });
  if (args.out) {
    const outPath = resolve(String(args.out));
    await mkdir(dirname(outPath), { recursive: true, mode: 0o700 });
    await writeFile(outPath, `${JSON.stringify(handoff, null, 2)}\n`, { mode: 0o600 });
  }
  const outputLines = [
    "source_intake_ok",
    `Reading URL: ${readingUrl}`,
    `Video URL: ${videoUrl}`,
    `Video timestamp: ${videoTimestamp}`
  ];
  if (args.out) {
    outputLines.push(`Handoff JSON: ${resolve(String(args.out))}`);
  }
  console.log([
    ...outputLines,
    "",
    "Public dry-run command (not KO evidence):",
    publicDryRunCommand,
    "",
    "Approved candidate command (run only after explicit current-turn approval):",
    approvedCommand
  ].join("\n"));
}

function buildSourceIntakeHandoff({ readingUrl, videoUrl, videoTimestamp, publicDryRunCommand, approvedCommand }) {
  return {
    schema: "learning-companion.external-source-intake-handoff.v1",
    generatedAt: new Date().toISOString(),
    evidenceTier: "SOURCE_INTAKE_HANDOFF_ONLY",
    canClaimExternalKo: false,
    claimBoundary: "Parsed source intake only. No browser evidence, screenshots, source approval, or privacy review has been executed.",
    rawInputRetained: false,
    normalized: {
      readingUrl,
      videoUrl,
      videoTimestamp
    },
    nextCommands: {
      publicDryRun: publicDryRunCommand,
      approvedCandidateAfterCurrentTurnApproval: approvedCommand,
      privacyTemplate: "npm run external:privacy-template -- --receipt <candidate-receipt.json> --out <privacy-review.json>",
      privacyReview: "npm run external:privacy-review -- --receipt <candidate-receipt.json> --review <privacy-review.json> --out <ko-evidence-review.json>"
    },
    approvalRequiredBeforeKoEvidence: [
      "Exact reading URL approved in the current turn.",
      "Exact video URL approved in the current turn.",
      "Exact video timestamp approved or captured from the approved source.",
      "Browser evidence run executed with --approved-current-turn.",
      "Human privacy review completed with PASS before KO use."
    ],
    privacyReviewChecklist: [
      "No visible account identity.",
      "No private or sensitive content.",
      "No secrets, tokens, cookies, session IDs, or signed URL parameters.",
      "Throwaway browser profile and run context reviewed.",
      "App git revision and dirty-worktree state reviewed.",
      "Every listed screenshot reviewed and marked PASS."
    ],
    blockedOrNotExecuted: [
      "No browser was launched.",
      "No local app server was started.",
      "No screenshots were captured.",
      "No source approval was granted by this handoff.",
      "No privacy review was performed.",
      "Mac, Windows, and HarmonyOS platform QA are not covered."
    ]
  };
}

async function readSourceIntakeText(args) {
  if (args.input && args["input-file"]) throw new Error("Use only one of --input or --input-file.");
  if (args.input) return String(args.input);
  if (args["input-file"]) return readFile(resolve(String(args["input-file"])), "utf8");
  throw new Error("Missing source input. Use --input \"阅读：https://...\\n视频：https://...\\n时间：00:15\" or --input-file <path>.");
}

function parseSourceIntake(input) {
  const text = String(input || "");
  const fields = {};
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const reading = trimmed.match(/^(?:阅读|reading|read|article|doc|document|reading[-_ ]?url)\s*[:：=]\s*(\S+)/i);
    if (reading && !fields.readingUrl) fields.readingUrl = trimSourceToken(reading[1]);
    const video = trimmed.match(/^(?:视频|video|watch|video[-_ ]?url)\s*[:：=]\s*(\S+)/i);
    if (video && !fields.videoUrl) fields.videoUrl = trimSourceToken(video[1]);
    const timestamp = trimmed.match(/^(?:时间|timestamp|time|video[-_ ]?timestamp)\s*[:：=]\s*([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)/i);
    if (timestamp && !fields.videoTimestamp) fields.videoTimestamp = timestamp[1];
  });
  const urls = extractSourceUrls(text);
  if (!fields.readingUrl && urls[0]) fields.readingUrl = urls[0];
  if (!fields.videoUrl && urls[1]) fields.videoUrl = urls[1];
  if (!fields.videoTimestamp) {
    const timestamp = text.match(/\b([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)\b/);
    if (timestamp) fields.videoTimestamp = timestamp[1];
  }
  return fields;
}

function extractSourceUrls(text) {
  return (String(text).match(/https?:\/\/[^\s<>"'`]+/g) || []).map(trimSourceToken);
}

function trimSourceToken(value) {
  return String(value || "").trim().replace(/[，。；;、]+$/u, "");
}

function normalizeVideoTimestamp(value) {
  if (!value) throw new Error("Missing video timestamp. Add 时间：00:15 or --video-timestamp 00:15.");
  const raw = String(value).trim();
  const parts = raw.split(":").map((part) => Number(part));
  if (![2, 3].includes(parts.length) || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error(`Invalid video timestamp: ${raw}. Use mm:ss or hh:mm:ss.`);
  }
  const minutes = parts.length === 2 ? parts[0] : parts[1];
  const seconds = parts.length === 2 ? parts[1] : parts[2];
  if (minutes >= 60 || seconds >= 60) throw new Error(`Invalid video timestamp: ${raw}. Minutes and seconds must be below 60.`);
  return parts.map((part) => String(part).padStart(2, "0")).join(":");
}

function buildSourceValidationCommand({ mode, readingUrl, videoUrl, videoTimestamp, note }) {
  const prefix = mode === "approved"
    ? "npm run external:validate -- --approved-current-turn"
    : "npm run external:validate:public-dry-run --";
  const noteFlag = mode === "approved" ? "--approval-note" : "--dry-run-note";
  return [
    prefix,
    "--reading-url",
    shellQuote(readingUrl),
    "--video-url",
    shellQuote(videoUrl),
    "--video-timestamp",
    shellQuote(videoTimestamp),
    noteFlag,
    shellQuote(note)
  ].join(" ");
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function requireApprovedUrl(value, label) {
  if (!value) throw new Error(`Missing --${label}. This must be a public learning-material URL, not a repo, build, localhost, or deployment URL.`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`--${label} must be an absolute URL.`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`--${label} must be http(s); local files should be validated with --self-test or explicit runbook handling.`);
  }
  assertApprovedExternalHost(url.hostname, `--${label}`);
  if (url.username || url.password) throw new Error(`--${label} must not include credentials.`);
  for (const [key] of url.searchParams) {
    if (isSensitiveQueryKey(key)) throw new Error(`--${label} query key ${key} looks sensitive.`);
  }
  return url.href;
}

function buildCliHelp() {
  return `Learning Companion external source validation

Plain meaning:
- URL means a public learning-material link.
- 中文：URL 就是网页链接。这里要的是公开学习材料链接，不是仓库、部署地址、localhost 或内部页面。

Send inputs in this shape:
  阅读：https://<public-reading-material>
  视频：https://<public-video-material>
  时间：00:15

Command flags:
- --reading-url: approved reading material page, such as an official doc or public article.
- --video-url: approved video material page or public video file.
- --video-timestamp: the video time to capture, such as 00:15.

Modes:
- npm run external:source-intake -- --input "阅读：https://... 视频：https://... 时间：00:15"
  Parse and validate a pasted source-input block, then print the next dry-run and approved-candidate commands. Does not launch a browser and never creates KO evidence.
  Add --out .codex-tmp/external-source-validation/source-intake-handoff.json to write a handoff-only JSON artifact for the next approved run.

- npm run external:validate:selftest
  Local fixture harness check. Never KO evidence.

- npm run external:validate:public-dry-run -- --reading-url <public-reading-url> --video-url <public-video-url> --video-timestamp <observed-timestamp> --dry-run-note "<why this is only a dry run>"
  Real public-source preflight. Never KO evidence and cannot be privacy-reviewed.

- npm run external:validate -- --approved-current-turn --reading-url <approved-reading-url> --video-url <approved-video-url> --video-timestamp <captured-timestamp> --approval-note "<current-turn approval>"
  Approved-source candidate. Still requires human privacy review before KO use.

Do not use authenticated/private pages, localhost, private IPs, intranet hosts, reserved example domains, or URLs with token/session/signature query keys.`;
}

function assertApprovedExternalHost(hostname, label) {
  const host = normalizeHostname(hostname);
  if (isDisallowedExternalHost(host)) {
    throw new Error(`${label} must be a public, non-private approved source URL; ${hostname} is local, private, reserved, or internal.`);
  }
}

function runApprovedUrlBoundarySelfChecks() {
  assert.throws(() => requireApprovedUrl("http://127.0.0.1:12345/source", "reading-url"), /public, non-private approved source URL/);
  assert.throws(() => requireApprovedUrl("http://[::ffff:127.0.0.1]/source", "reading-url"), /public, non-private approved source URL/);
  assert.throws(() => requireApprovedUrl("http://10.0.0.12/source", "reading-url"), /public, non-private approved source URL/);
  assert.throws(() => requireApprovedUrl("https://internal-wiki/source", "reading-url"), /public, non-private approved source URL/);
  assert.throws(() => requireApprovedUrl("https://example.com/source", "reading-url"), /public, non-private approved source URL/);
  assert.throws(() => requireApprovedUrl("https://www.wikipedia.org/source?token=abc", "reading-url"), /query key token looks sensitive/);
  assert.throws(() => requireApprovedUrl("https://www.wikipedia.org/source?X-Amz-Signature=abc", "reading-url"), /query key X-Amz-Signature looks sensitive/);
  assert.equal(requireApprovedUrl("https://www.wikipedia.org/search?keyword=learning", "reading-url"), "https://www.wikipedia.org/search?keyword=learning");
  assert.equal(requireApprovedUrl("https://www.wikipedia.org/wiki/Learning", "reading-url"), "https://www.wikipedia.org/wiki/Learning");
  const intake = parseSourceIntake("阅读：https://www.wikipedia.org/wiki/Spaced_repetition\n视频：https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4\n时间：0:03");
  assert.equal(intake.readingUrl, "https://www.wikipedia.org/wiki/Spaced_repetition");
  assert.equal(intake.videoUrl, "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4");
  assert.equal(normalizeVideoTimestamp(intake.videoTimestamp), "00:03");
  const intakeHandoff = buildSourceIntakeHandoff({
    readingUrl: requireApprovedUrl(intake.readingUrl, "reading-url"),
    videoUrl: requireApprovedUrl(intake.videoUrl, "video-url"),
    videoTimestamp: normalizeVideoTimestamp(intake.videoTimestamp),
    publicDryRunCommand: buildSourceValidationCommand({
      mode: "public-dry-run",
      readingUrl: intake.readingUrl,
      videoUrl: intake.videoUrl,
      videoTimestamp: normalizeVideoTimestamp(intake.videoTimestamp),
      note: "source intake preflight"
    }),
    approvedCommand: buildSourceValidationCommand({
      mode: "approved",
      readingUrl: intake.readingUrl,
      videoUrl: intake.videoUrl,
      videoTimestamp: normalizeVideoTimestamp(intake.videoTimestamp),
      note: "<current-turn approval>"
    })
  });
  assert.equal(intakeHandoff.schema, "learning-companion.external-source-intake-handoff.v1");
  assert.equal(intakeHandoff.evidenceTier, "SOURCE_INTAKE_HANDOFF_ONLY");
  assert.equal(intakeHandoff.canClaimExternalKo, false);
  assert.match(intakeHandoff.nextCommands.approvedCandidateAfterCurrentTurnApproval, /--approved-current-turn/);
  assert.ok(intakeHandoff.blockedOrNotExecuted.includes("No browser was launched."));
}

function isSensitiveQueryKey(key) {
  const compact = String(key || "").trim().toLowerCase().replace(/[-_\s]/g, "");
  return new Set([
    "token",
    "accesstoken",
    "idtoken",
    "refreshtoken",
    "session",
    "sessionid",
    "auth",
    "authtoken",
    "authorization",
    "apikey",
    "key",
    "secret",
    "password",
    "passcode",
    "code",
    "jwt",
    "sig",
    "signature",
    "expires",
    "expiry",
    "expiration",
    "expiresin",
    "awsaccesskeyid",
    "xamzsignature",
    "xamzcredential",
    "xamzsecuritytoken",
    "xamzexpires",
    "xamzsignedheaders",
    "xgoogsignature",
    "xgoogcredential",
    "xgoogsecuritytoken",
    "xgoogexpires",
    "xgoogsignedheaders",
    "xgoogalgorithm",
    "keypairid",
    "policy"
  ]).has(compact);
}

function normalizeHostname(hostname) {
  return String(hostname || "").trim().replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "").toLowerCase();
}

function isDisallowedExternalHost(host) {
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (!host.includes(".") && !host.includes(":")) return true;
  if ([
    "example.com",
    "example.net",
    "example.org"
  ].includes(host)) return true;
  if ([
    ".example.com",
    ".example.net",
    ".example.org",
    ".local",
    ".internal",
    ".lan",
    ".home",
    ".test",
    ".invalid"
  ].some((suffix) => host.endsWith(suffix))) return true;
  return isPrivateOrReservedIpv4(host) || isPrivateOrReservedIpv6(host);
}

function isPrivateOrReservedIpv4(host) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
  const parts = host.split(".").map((part) => Number(part));
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && b === 18) ||
    (a === 198 && b === 19) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isPrivateOrReservedIpv6(host) {
  if (!host.includes(":")) return false;
  if (host === "::" || host === "::1") return true;
  if (host.startsWith("fe80:")) return true;
  if (/^f[cd][0-9a-f]{0,2}:/i.test(host)) return true;
  if (host.startsWith("::ffff:")) {
    return isPrivateOrReservedIpv4(expandMappedIpv4(host.slice("::ffff:".length)));
  }
  return false;
}

function expandMappedIpv4(value) {
  if (value.includes(".")) return value;
  const match = value.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!match) return value;
  const high = Number.parseInt(match[1], 16);
  const low = Number.parseInt(match[2], 16);
  return [
    (high >> 8) & 255,
    high & 255,
    (low >> 8) & 255,
    low & 255
  ].join(".");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function timestampSlug(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function safeSlug(value) {
  return String(value || "run").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "run";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function resolveChromePath() {
  const candidates = [
    process.env.CHROME_PATH || "",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("No Chrome/Chromium binary found. Set CHROME_PATH to run this validation.");
  return found;
}

async function waitForTarget(port) {
  const endpoint = `http://127.0.0.1:${port}/json`;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const targets = await fetch(endpoint).then((response) => response.json());
      const target = targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
      if (target) return target;
    } catch {
      await sleep(150);
    }
  }
  throw new Error("Chrome DevTools target was not ready.");
}

async function waitForNativeBridge(cdp, exceptions) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const ready = await cdp.evaluate(`Boolean(window.learningCompanionNative?.exportWorkspaceJson && window.learningCompanionNative?.importWorkspaceJson)`);
    if (ready) return;
    await sleep(100);
  }
  const exceptionText = exceptions.map((event) => event.exceptionDetails?.exception?.description || event.exceptionDetails?.text || "").filter(Boolean).join("\n");
  throw new Error(`Native bridge was not ready.${exceptionText ? `\n${exceptionText}` : ""}`);
}

async function waitForPageQuiet(cdp) {
  try {
    await Promise.race([
      new Promise((resolveLoad) => {
        const handler = () => resolveLoad();
        cdp.on("Page.loadEventFired", handler);
      }),
      sleep(1200)
    ]);
  } catch {
    await sleep(300);
  }
  await sleep(250);
}

function waitForProcessExit(process, timeoutMs) {
  if (process.exitCode !== null || process.signalCode !== null) return Promise.resolve();
  return new Promise((resolveExit) => {
    const timeout = setTimeout(resolveExit, timeoutMs);
    process.once("exit", () => {
      clearTimeout(timeout);
      resolveExit();
    });
  });
}

function allocateTcpPort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createNetServer();
    server.unref();
    server.once("error", rejectPort);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });
}

async function connectCdp(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const listeners = new Map();
  let id = 0;

  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", rejectOpen, { once: true });
  });

  socket.addEventListener("message", (message) => {
    const payload = JSON.parse(message.data);
    if (payload.id && pending.has(payload.id)) {
      const { resolveMessage, rejectMessage } = pending.get(payload.id);
      pending.delete(payload.id);
      if (payload.error) rejectMessage(new Error(payload.error.message));
      else resolveMessage(payload.result);
      return;
    }
    if (!payload.method) return;
    const callbacks = listeners.get(payload.method) || [];
    callbacks.forEach((callback) => callback(payload.params));
  });

  return {
    send(method, params = {}) {
      const messageId = ++id;
      socket.send(JSON.stringify({ id: messageId, method, params }));
      return new Promise((resolveMessage, rejectMessage) => {
        pending.set(messageId, { resolveMessage, rejectMessage });
      });
    },
    evaluate(expression, timeoutMs = 10000) {
      return withTimeout(this.send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true
      }).then((result) => {
        if (result.exceptionDetails) {
          throw new Error(result.exceptionDetails.exception?.description
            || result.exceptionDetails.text
            || "Evaluation failed.");
        }
        return result.result.value;
      }), timeoutMs, "Runtime.evaluate timed out.");
    },
    on(method, callback) {
      listeners.set(method, [...(listeners.get(method) || []), callback]);
    },
    close() {
      socket.close();
    }
  };
}

function withTimeout(promise, timeoutMs, message) {
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]).finally(() => clearTimeout(timeout));
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
