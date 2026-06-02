import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const root = resolve("apps/companion-web");
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const smokeBase = resolve(".codex-tmp/browser-smoke");
const SMOKE_ROOT_PREFIX = "lc-browser-smoke-";
const STALE_SMOKE_ROOT_MS = 30 * 60 * 1000;

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"]
]);
const virtualRoutes = new Map();

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const routePath = url.pathname === "/" ? "/index.html" : url.pathname;
    if (virtualRoutes.has(routePath)) {
      response.writeHead(200, {
        "content-type": mimeTypes.get(extname(routePath)) || "text/html; charset=utf-8"
      });
      response.end(virtualRoutes.get(routePath));
      return;
    }
    const filePath = join(root, url.pathname === "/" ? "index.html" : url.pathname);
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes.get(extname(filePath)) || "application/octet-stream"
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

const debuggingPort = 9400 + Math.floor(Math.random() * 300);
mkdirSync(smokeBase, { recursive: true, mode: 0o700 });
cleanupStaleSmokeRoots(smokeBase, Date.now() - STALE_SMOKE_ROOT_MS);

const smokeRoot = join(smokeBase, `${SMOKE_ROOT_PREFIX}${Date.now()}`);
const profile = join(smokeRoot, "profile");
const downloadPath = join(smokeRoot, "downloads");
mkdirSync(downloadPath, { recursive: true, mode: 0o700 });
const appUrl = `http://127.0.0.1:${listenPort}/`;
const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-extensions",
  "--disable-sync",
  "--no-first-run",
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
  cdp.on("Page.javascriptDialogOpening", () => {
    cdp.send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
  });
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: "window.__LC_ALLOW_AUTOMATED_DOWNLOADS__ = true;"
  });
  await cdp.send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath
  });
  await cdp.send("Page.navigate", { url: appUrl });
  await sleep(500);

  const pwa = await cdp.evaluate(`(async () => {
    const manifestLink = document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "";
    const manifest = await fetch(manifestLink).then((response) => response.json());
    const workerText = await fetch("./service-worker.js").then((response) => response.text());
    const registration = "serviceWorker" in navigator
      ? await Promise.race([
        navigator.serviceWorker.ready.then((item) => item.active ? "ready" : "registered"),
        new Promise((resolve) => setTimeout(() => resolve("pending"), 2000))
      ])
      : "unsupported";
    return {
      manifestLink,
      display: manifest.display,
      startUrl: manifest.start_url,
      iconSrc: manifest.icons?.[0]?.src,
      workerCachesStaticAssets: workerText.includes("STATIC_ASSETS"),
      registration
    };
  })()`);

  assert.equal(pwa.manifestLink, "./manifest.webmanifest");
  assert.equal(pwa.display, "standalone");
  assert.equal(pwa.startUrl, "./");
  assert.equal(pwa.iconSrc, "./assets/icon.svg");
  assert.equal(pwa.workerCachesStaticAssets, true);
  assert.notEqual(pwa.registration, "unsupported");

  const firstRun = await cdp.evaluate(`(() => {
    document.querySelector('[data-tab="today"]').click();
    const panel = document.querySelector(".learning-flow-panel");
    const card = document.querySelector(".start-here-inline");
    const before = {
      text: panel?.textContent || "",
      buttons: [...(card?.querySelectorAll("button") || [])].map((button) => ({
        action: button.dataset.startAction,
        text: button.textContent
      }))
    };
    card?.querySelector('[data-start-action="capture"]')?.click();
    return {
      ...before,
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activeElement: document.activeElement?.id || "",
      capturePanePulsed: document.querySelector("#capturePane")?.classList.contains("pulse") === true,
      activity: document.querySelector("#activityTitle")?.textContent || ""
    };
  })()`);
  assert.match(firstRun.text, /Learning Flow/);
  assert.match(firstRun.text, /Capture on Mac/);
  assert.match(firstRun.text, /Close the loop/);
  assert.match(firstRun.text, /Start Here/);
  assert.match(firstRun.text, /Start with what you are watching or reading/);
  assert.deepEqual(firstRun.buttons, [
    { action: "capture", text: "Capture this thought" },
    { action: "question", text: "Ask about this" },
    { action: "clipper", text: "Set up page clipper" }
  ]);
  assert.equal(firstRun.activeTab, "captures");
  assert.equal(firstRun.activeElement, "quoteInput");
  assert.equal(firstRun.capturePanePulsed, true);
  assert.equal(firstRun.activity, "Ready to capture");

  const sidecarLayout = await cdp.evaluate(`(() => {
    const shell = document.querySelector(".app-shell");
    const sidebar = document.querySelector(".sidebar");
    const inspector = document.querySelector(".inspector");
    const toggle = document.querySelector("#sidecarLayoutBtn");
    const readState = () => ({
      shellCompact: shell.classList.contains("sidecar-layout"),
      sidebarDisplay: getComputedStyle(sidebar).display,
      inspectorDisplay: getComputedStyle(inspector).display,
      toggleDisplay: getComputedStyle(toggle).display,
      activityDisplay: getComputedStyle(document.querySelector(".activity-strip")).display,
      activityAction: document.querySelector("#activityDetailsBtn").textContent,
      activeId: document.activeElement?.id || "",
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      pressed: toggle.getAttribute("aria-pressed"),
      stored: JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}").sidecarLayout === true,
      storedVersion: JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}").schemaVersion,
      activityTitle: document.querySelector("#activityTitle")?.textContent || "",
      capturePanePulsed: document.querySelector("#capturePane")?.classList.contains("pulse") === true
    });
    const before = readState();
    document.querySelector("#notesEditor").focus();
    document.querySelector("#notesEditor").dispatchEvent(new KeyboardEvent("keydown", {
      key: "\\\\",
      metaKey: true,
      bubbles: true,
      cancelable: true
    }));
    const afterEditableShortcut = readState();
    document.querySelector('[data-tab="export"]').click();
    document.querySelector("#copyMarkdownBtn").focus();
    document.querySelector("#copyMarkdownBtn").dispatchEvent(new KeyboardEvent("keydown", {
      key: "\\\\",
      metaKey: true,
      bubbles: true,
      cancelable: true
    }));
    const afterPanelShortcut = readState();
    document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "C",
      metaKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true
    }));
    const afterFocusCaptureShortcut = readState();
    document.querySelector("#quoteInput").value = "Draft quote from shortcut smoke.";
    document.querySelector("#thoughtInput").value = "";
    document.querySelector("#quoteInput").dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector('[data-focus-mode="review"]').click();
    document.querySelector("#notesEditor").focus();
    const draftShortcutEvent = new KeyboardEvent("keydown", {
      key: "C",
      metaKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true
    });
    const draftShortcutDispatchResult = document.querySelector("#notesEditor").dispatchEvent(draftShortcutEvent);
    const afterDraftFocusCaptureShortcut = {
      ...readState(),
      defaultPrevented: draftShortcutEvent.defaultPrevented,
      dispatchResult: draftShortcutDispatchResult
    };
    document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "C",
      metaKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true
    }));
    const afterRepeatFocusCaptureShortcut = readState();
    document.querySelector("#captureContextTarget").click();
    const activeSessionRow = document.querySelector("#sessionList .session-row.active");
    const afterCaptureDestination = {
      ...readState(),
      targetText: document.querySelector("#captureContextTarget").textContent,
      activeSessionFocused: document.activeElement === activeSessionRow,
      activeSessionPulsed: activeSessionRow?.classList.contains("pulse") === true,
      activityDetail: document.querySelector("#activityDetail").textContent
    };
    document.querySelector("#activityDetailsBtn").click();
    const afterActivityDetails = readState();
    return { before, afterEditableShortcut, afterPanelShortcut, afterFocusCaptureShortcut, afterDraftFocusCaptureShortcut, afterRepeatFocusCaptureShortcut, afterCaptureDestination, afterActivityDetails };
  })()`);

  assert.equal(sidecarLayout.before.shellCompact, false);
  assert.equal(sidecarLayout.afterEditableShortcut.shellCompact, false);
  assert.equal(sidecarLayout.afterPanelShortcut.shellCompact, true);
  assert.equal(sidecarLayout.afterPanelShortcut.sidebarDisplay, "none");
  assert.equal(sidecarLayout.afterPanelShortcut.inspectorDisplay, "none");
  assert.equal(sidecarLayout.afterPanelShortcut.toggleDisplay, "grid");
  assert.equal(sidecarLayout.afterPanelShortcut.activityDisplay, "grid");
  assert.equal(sidecarLayout.afterPanelShortcut.activityAction, "Exit + Details");
  assert.equal(sidecarLayout.afterPanelShortcut.activeId, "sidecarLayoutBtn");
  assert.equal(sidecarLayout.afterPanelShortcut.pressed, "true");
  assert.equal(sidecarLayout.afterPanelShortcut.stored, true);
  assert.equal(sidecarLayout.afterPanelShortcut.storedVersion, 3);
  assert.equal(sidecarLayout.afterFocusCaptureShortcut.shellCompact, true);
  assert.equal(sidecarLayout.afterFocusCaptureShortcut.activeTab, "captures");
  assert.equal(sidecarLayout.afterFocusCaptureShortcut.activeId, "quoteInput");
  assert.equal(sidecarLayout.afterFocusCaptureShortcut.activityTitle, "Quick Capture ready");
  assert.equal(sidecarLayout.afterFocusCaptureShortcut.capturePanePulsed, true);
  assert.equal(sidecarLayout.afterFocusCaptureShortcut.activityAction, "Exit + Details");
  assert.equal(sidecarLayout.afterDraftFocusCaptureShortcut.shellCompact, true);
  assert.equal(sidecarLayout.afterDraftFocusCaptureShortcut.activeTab, "captures");
  assert.equal(sidecarLayout.afterDraftFocusCaptureShortcut.activeId, "thoughtInput");
  assert.equal(sidecarLayout.afterDraftFocusCaptureShortcut.activityTitle, "Capture draft ready");
  assert.equal(sidecarLayout.afterDraftFocusCaptureShortcut.defaultPrevented, true);
  assert.equal(sidecarLayout.afterDraftFocusCaptureShortcut.dispatchResult, false);
  assert.equal(sidecarLayout.afterRepeatFocusCaptureShortcut.activeId, "thoughtInput");
  assert.equal(sidecarLayout.afterRepeatFocusCaptureShortcut.capturePanePulsed, true);
  assert.equal(sidecarLayout.afterCaptureDestination.shellCompact, false);
  assert.notEqual(sidecarLayout.afterCaptureDestination.sidebarDisplay, "none");
  assert.equal(sidecarLayout.afterCaptureDestination.activeTab, "captures");
  assert.equal(sidecarLayout.afterCaptureDestination.targetText, "To Learning Companion MVP");
  assert.equal(sidecarLayout.afterCaptureDestination.activeSessionFocused, true);
  assert.equal(sidecarLayout.afterCaptureDestination.activeSessionPulsed, true);
  assert.equal(sidecarLayout.afterCaptureDestination.activityTitle, "Capture destination shown");
  assert.match(sidecarLayout.afterCaptureDestination.activityDetail, /Captures save to Learning Companion MVP/);
  assert.equal(sidecarLayout.afterActivityDetails.shellCompact, false);
  assert.equal(sidecarLayout.afterActivityDetails.activeTab, "captures");
  assert.equal(sidecarLayout.afterActivityDetails.activityAction, "Details");

  const pastedSource = await cdp.evaluate(`(async () => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: async () => "Lecture Notes\\nhttps://www.youtube.com/watch?v=paste123&t=95s&utm_source=clipboard",
        writeText: async () => {}
      }
    });
    setValue("#sourceTitle", "");
    setValue("#sourceUrl", "");
    setValue("#timestampInput", "");
    setValue("#quoteInput", "");
    setValue("#thoughtInput", "");
    document.querySelector("#pasteSourceBtn").click();
    await new Promise((resolve) => setTimeout(resolve, 120));
    const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
    const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
    return {
      sourceTitle: session.sourceTitle,
      sourceUrl: session.sourceUrl,
      materialType: session.materialType,
      timestamp: document.querySelector("#timestampInput").value,
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent,
      activeElement: document.activeElement?.id || "",
      openSourceTitle: document.querySelector("#openSourceBtn").title,
      contextOpenText: document.querySelector("#captureContextOpenBtn").textContent,
      captureIntent: document.querySelector("#captureContextIntent").textContent,
      quotePlaceholder: document.querySelector("#quoteInput").placeholder,
      thoughtPlaceholder: document.querySelector("#thoughtInput").placeholder,
      sourceStripPulsed: document.querySelector(".source-strip").classList.contains("pulse")
    };
  })()`);

  assert.equal(pastedSource.sourceTitle, "Lecture Notes");
  assert.equal(pastedSource.sourceUrl, "https://www.youtube.com/watch?v=paste123&utm_source=clipboard");
  assert.equal(pastedSource.materialType, "video");
  assert.equal(pastedSource.timestamp, "01:35");
  assert.equal(pastedSource.activityTitle, "Source pasted");
  assert.match(pastedSource.activityDetail, /Lecture Notes @ 01:35/);
  assert.equal(pastedSource.activeElement, "quoteInput");
  assert.equal(pastedSource.openSourceTitle, "Open source at 01:35");
  assert.equal(pastedSource.contextOpenText, "Resume @ 01:35");
  assert.equal(pastedSource.captureIntent, "Video moment");
  assert.equal(pastedSource.quotePlaceholder, "Transcript line or key phrase at this moment");
  assert.equal(pastedSource.thoughtPlaceholder, "Your question, takeaway, or answer for this moment");
  assert.equal(pastedSource.sourceStripPulsed, true);

  const sourceGuidanceStates = await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const readGuidance = () => ({
      intent: document.querySelector("#captureContextIntent").textContent,
      intentTitle: document.querySelector("#captureContextIntent").title,
      quotePlaceholder: document.querySelector("#quoteInput").placeholder,
      thoughtPlaceholder: document.querySelector("#thoughtInput").placeholder
    });
    setValue("#quoteInput", "");
    setValue("#thoughtInput", "");
    setValue("#timestampInput", "");
    setValue("#sourceTitle", "Concurrency article");
    setValue("#sourceUrl", "https://example.com/concurrency-article");
    setValue("#materialType", "article");
    const article = readGuidance();
    setValue("#sourceTitle", "Systems book");
    setValue("#sourceUrl", "https://example.com/systems-book");
    setValue("#materialType", "book");
    const book = readGuidance();
    setValue("#sourceTitle", "");
    setValue("#sourceUrl", "");
    setValue("#materialType", "article");
    const noSource = readGuidance();
    return { article, book, noSource };
  })()`);
  assert.equal(sourceGuidanceStates.article.intent, "Article excerpt");
  assert.equal(sourceGuidanceStates.article.intentTitle, "Capture the sentence, section, or claim you are reading now.");
  assert.equal(sourceGuidanceStates.article.quotePlaceholder, "Sentence, section excerpt, or key claim you are reading");
  assert.equal(sourceGuidanceStates.article.thoughtPlaceholder, "Your takeaway, question, or how you would apply it");
  assert.equal(sourceGuidanceStates.book.intent, "Book excerpt");
  assert.equal(sourceGuidanceStates.book.quotePlaceholder, "Sentence, section excerpt, or key claim you are reading");
  assert.equal(sourceGuidanceStates.noSource.intent, "Ready");
  assert.equal(sourceGuidanceStates.noSource.intentTitle, "Add a quote or thought to capture.");
  assert.equal(sourceGuidanceStates.noSource.quotePlaceholder, "Paste a quote, transcript line, or key idea");
  assert.equal(sourceGuidanceStates.noSource.thoughtPlaceholder, "Your note, question, or synthesis");

  const rejectedClipboardSource = await cdp.evaluate(`(async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: async () => "private non-url note that must not become source metadata",
        writeText: async () => {}
      }
    });
    document.querySelector("#pasteSourceBtn").click();
    await new Promise((resolve) => setTimeout(resolve, 120));
    const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
    const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
    return {
      sourceTitle: session.sourceTitle,
      sourceUrl: session.sourceUrl,
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent,
      activeElement: document.activeElement?.id || ""
    };
  })()`);
  assert.equal(rejectedClipboardSource.sourceTitle, "Lecture Notes");
  assert.equal(rejectedClipboardSource.sourceUrl, "https://www.youtube.com/watch?v=paste123&utm_source=clipboard");
  assert.equal(rejectedClipboardSource.activityTitle, "No source URL found");
  assert.match(rejectedClipboardSource.activityDetail, /Copy the browser URL/);
  assert.equal(rejectedClipboardSource.activeElement, "sourceUrl");

  const guardedPasteSource = await cdp.evaluate(`(async () => {
    const beforeWorkspaceJson = localStorage.getItem("learning-companion.workspace.v1");
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    setValue("#sourceTitle", "Doc lesson");
    setValue("#sourceUrl", "https://example.com/doc-lesson");
    setValue("#materialType", "doc");
    setValue("#timestampInput", "");
    setValue("#quoteInput", "Existing doc capture");
    setValue("#thoughtInput", "Keep this topic framed as a document.");
    document.querySelector("#captureBtn").click();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: async () => "Companion video\\nhttps://www.youtube.com/watch?v=guarded&t=30s",
        writeText: async () => {}
      }
    });
    document.querySelector("#pasteSourceBtn").click();
    await new Promise((resolve) => setTimeout(resolve, 120));
    const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
    const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
    const result = {
      captures: session.captures.length,
      sourceTitle: session.sourceTitle,
      sourceUrl: session.sourceUrl,
      materialType: session.materialType,
      timestamp: document.querySelector("#timestampInput").value,
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent
    };
    window.learningCompanionNative.importWorkspaceJson(beforeWorkspaceJson);
    return result;
  })()`);
  assert.equal(guardedPasteSource.sourceTitle, "Companion video");
  assert.equal(guardedPasteSource.sourceUrl, "https://www.youtube.com/watch?v=guarded");
  assert.equal(guardedPasteSource.materialType, "doc");
  assert.equal(guardedPasteSource.timestamp, "00:30");
  assert.equal(guardedPasteSource.activityTitle, "Source pasted");
  assert.match(guardedPasteSource.activityDetail, /Type kept as Doc/);
  assert.ok(guardedPasteSource.captures >= 1);

  const result = await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    setValue("#sourceTitle", "RustConf ownership talk");
    setValue("#quoteInput", "");
    setValue("#thoughtInput", "");
    setValue("#timestampInput", "");
    setValue("#materialType", "video");
    setValue("#sourceUrl", "https://www.youtube.com/watch?v=rust123&t=8m12s");
    let sourceContextOpened = "";
    const nativeContextWindowOpen = window.open;
    window.open = (href) => {
      sourceContextOpened = href;
      return null;
    };
    document.querySelector("#captureContextOpenBtn").click();
    window.open = nativeContextWindowOpen;
    const sourceTimestampWorkspace = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    const sourceTimestampSession = sourceTimestampWorkspace.sessions.find((item) => item.id === sourceTimestampWorkspace.activeSessionId);
    const sourceTimestampStage = {
      timestamp: document.querySelector("#timestampInput").value,
      sourceUrlInputBeforeChange: document.querySelector("#sourceUrl").value,
      sourceUrlStored: sourceTimestampSession.sourceUrl,
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent,
      openSourceTitle: document.querySelector("#openSourceBtn").title,
      draftStatus: document.querySelector("#captureDraftStatus").textContent,
      timestampPulsed: document.querySelector("#timestampInput").classList.contains("pulse"),
      contextTarget: document.querySelector("#captureContextTarget").textContent,
      contextTargetTitle: document.querySelector("#captureContextTarget").title,
      contextIntent: document.querySelector("#captureContextIntent").textContent,
      contextIntentTitle: document.querySelector("#captureContextIntent").title,
      quotePlaceholder: document.querySelector("#quoteInput").placeholder,
      thoughtPlaceholder: document.querySelector("#thoughtInput").placeholder,
      contextSource: document.querySelector("#captureContextSource").textContent,
      contextTime: document.querySelector("#captureContextTime").textContent,
      contextOpenDisabled: document.querySelector("#captureContextOpenBtn").disabled,
      contextOpenText: document.querySelector("#captureContextOpenBtn").textContent,
      contextOpenTitle: document.querySelector("#captureContextOpenBtn").title,
      contextOpenAria: document.querySelector("#captureContextOpenBtn").getAttribute("aria-label"),
      contextOpened: sourceContextOpened
    };
    document.querySelector("#captureContextSource").click();
    const sourceContextShown = {
      activeElement: document.activeElement?.id || "",
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent,
      sourceStripPulsed: document.querySelector(".source-strip").classList.contains("pulse"),
      ariaLabel: document.querySelector("#captureContextSource").getAttribute("aria-label")
    };
    document.querySelector("#sourceUrl").dispatchEvent(new Event("change", { bubbles: true }));
    sourceTimestampStage.sourceUrlInputAfterChange = document.querySelector("#sourceUrl").value;
    setValue("#timestampInput", "12:30");
    let typedTimestampContextOpened = "";
    const nativeTypedWindowOpen = window.open;
    window.open = (href) => {
      typedTimestampContextOpened = href;
      return null;
    };
    document.querySelector("#captureContextOpenBtn").click();
    window.open = nativeTypedWindowOpen;
    const sourceTimestampTyped = {
      timestamp: document.querySelector("#timestampInput").value,
      contextTime: document.querySelector("#captureContextTime").textContent,
      contextOpenText: document.querySelector("#captureContextOpenBtn").textContent,
      contextOpenTitle: document.querySelector("#captureContextOpenBtn").title,
      contextOpenAria: document.querySelector("#captureContextOpenBtn").getAttribute("aria-label"),
      contextOpened: typedTimestampContextOpened
    };
    document.querySelector("#timeBackBtn").click();
    const afterTimeBack = {
      timestamp: document.querySelector("#timestampInput").value,
      contextTime: document.querySelector("#captureContextTime").textContent,
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent,
      pulsed: document.querySelector("#timestampInput").classList.contains("pulse")
    };
    document.querySelector("#timeForwardBtn").click();
    const afterTimeForward = {
      timestamp: document.querySelector("#timestampInput").value,
      contextTime: document.querySelector("#captureContextTime").textContent,
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent
    };
    document.querySelector("#timestampInput").focus();
    const keyBackEvent = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true
    });
    const keyBackDispatchResult = document.querySelector("#timestampInput").dispatchEvent(keyBackEvent);
    const afterKeyboardBack = {
      timestamp: document.querySelector("#timestampInput").value,
      contextTime: document.querySelector("#captureContextTime").textContent,
      activityTitle: document.querySelector("#activityTitle").textContent,
      defaultPrevented: keyBackEvent.defaultPrevented,
      dispatchResult: keyBackDispatchResult,
      activeId: document.activeElement?.id || ""
    };
    const keyForwardEvent = new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true
    });
    const keyForwardDispatchResult = document.querySelector("#timestampInput").dispatchEvent(keyForwardEvent);
    const afterKeyboardForward = {
      timestamp: document.querySelector("#timestampInput").value,
      contextTime: document.querySelector("#captureContextTime").textContent,
      activityTitle: document.querySelector("#activityTitle").textContent,
      defaultPrevented: keyForwardEvent.defaultPrevented,
      dispatchResult: keyForwardDispatchResult,
      activeId: document.activeElement?.id || ""
    };
    setValue("#timestampInput", "00:00");
    document.querySelector("#timeBackBtn").click();
    const afterZeroBack = {
      timestamp: document.querySelector("#timestampInput").value,
      contextTime: document.querySelector("#captureContextTime").textContent,
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent
    };
    setValue("#quoteInput", "Draft anchored to the RustConf source.");
    setValue("#thoughtInput", "This should warn if the source changes before capture.");
    setValue("#sourceTitle", "RustConf ownership talk - YouTube");
    const titleOnlySourceRefresh = {
      status: document.querySelector("#captureDraftStatus").textContent,
      statusClass: document.querySelector("#captureDraftStatus").className
    };
    setValue("#thoughtInput", "Why does this ownership example avoid data races?");
    const questionIntent = {
      text: document.querySelector("#captureContextIntent").textContent,
      title: document.querySelector("#captureContextIntent").title
    };
    setValue("#thoughtInput", "Answer:");
    const answerDraftIntent = {
      text: document.querySelector("#captureContextIntent").textContent,
      title: document.querySelector("#captureContextIntent").title
    };
    setValue("#thoughtInput", "Answer: because ownership gives each mutable reference a single active writer.");
    const answerIntent = {
      text: document.querySelector("#captureContextIntent").textContent,
      title: document.querySelector("#captureContextIntent").title
    };
    setValue("#thoughtInput", "This should warn if the source changes before capture.");
    setValue("#sourceTitle", "Different lecture");
    setValue("#sourceUrl", "https://www.youtube.com/watch?v=other456");
    const sourceChangedDraft = {
      status: document.querySelector("#captureDraftStatus").textContent,
      statusClass: document.querySelector("#captureDraftStatus").className,
      statusTitle: document.querySelector("#captureDraftStatus").title,
      reanchorHidden: document.querySelector("#reanchorCaptureDraftBtn").hidden,
      role: document.querySelector("#captureDraftStatus").getAttribute("role"),
      ariaLive: document.querySelector("#captureDraftStatus").getAttribute("aria-live")
    };
    setValue("#sourceTitle", "RustConf ownership talk");
    setValue("#sourceUrl", "https://www.youtube.com/watch?v=rust123&t=0s");
    const restoredWorkspace = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    const restoredActiveSession = restoredWorkspace.sessions
      .find((item) => item.id === restoredWorkspace.activeSessionId);
    const sourceRestoredDraft = {
      status: document.querySelector("#captureDraftStatus").textContent,
      statusClass: document.querySelector("#captureDraftStatus").className,
      reanchorHidden: document.querySelector("#reanchorCaptureDraftBtn").hidden,
      sourceUrlStored: restoredActiveSession.sourceUrl
    };
    setValue("#sourceTitle", "Different lecture");
    setValue("#sourceUrl", "https://www.youtube.com/watch?v=other456");
    document.querySelector("#reanchorCaptureDraftBtn").click();
    const sourceReanchoredDraft = {
      status: document.querySelector("#captureDraftStatus").textContent,
      statusClass: document.querySelector("#captureDraftStatus").className,
      reanchorHidden: document.querySelector("#reanchorCaptureDraftBtn").hidden,
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent
    };
    document.querySelector("#clearCaptureDraftBtn").click();
    const sourceReanchorCleared = {
      status: document.querySelector("#captureDraftStatus").textContent,
      reanchorHidden: document.querySelector("#reanchorCaptureDraftBtn").hidden
    };
    const sourceTimestampNudge = { afterTimeBack, afterTimeForward, afterKeyboardBack, afterKeyboardForward, afterZeroBack, titleOnlySourceRefresh, questionIntent, answerDraftIntent, answerIntent, sourceChangedDraft, sourceRestoredDraft, sourceReanchoredDraft, sourceReanchorCleared };
    setValue("#sourceTitle", "RustConf ownership talk");
    setValue("#sourceUrl", "https://www.youtube.com/watch?v=rust123");
    document.querySelector("#materialType").value = "video";
    document.querySelector("#materialType").dispatchEvent(new Event("change", { bubbles: true }));
    setValue("#quoteInput", "Ownership lets Rust make memory safety guarantees.");
    setValue("#thoughtInput", "- Connect this with compiler-enforced lifetimes.");
    setValue("#timestampInput", "08:12");
    document.querySelector("#captureCardBtn").click();
    const backupNoticeAfterCapture = {
      hidden: document.querySelector("#storageNotice").hidden,
      text: document.querySelector("#storageNoticeText").textContent
    };
    document.querySelector("#storageExportNowBtn").click();
    const backupPrefsAfterExport = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}").workspaceBackup || {};
    const backupNoticeAfterExport = {
      hidden: document.querySelector("#storageNotice").hidden,
      text: document.querySelector("#storageNoticeText").textContent,
      fingerprint: backupPrefsAfterExport.fingerprint || "",
      exportedAt: backupPrefsAfterExport.exportedAt || ""
    };
    const captureDraftStatusAfterCard = {
      text: document.querySelector("#captureDraftStatus").textContent,
      clearHidden: document.querySelector("#clearCaptureDraftBtn").hidden,
      statusClass: document.querySelector("#captureDraftStatus").className,
      statusTitle: document.querySelector("#captureDraftStatus").title
    };
    let sourceJumpOpened = "";
    const nativeWindowOpen = window.open;
    window.open = (href) => {
      sourceJumpOpened = href;
      return null;
    };
    document.querySelector("#openSourceBtn").click();
    window.open = nativeWindowOpen;
    const focusBriefAfterCard = {
      action: document.querySelector("#focusBriefAction").textContent,
      facts: document.querySelector("#focusBriefFacts").textContent,
      signals: document.querySelector("#focusBriefSignals").textContent,
      button: document.querySelector("#focusBriefActionBtn").textContent
    };
    const activityAfterCard = {
      title: document.querySelector("#activityTitle").textContent,
      detail: document.querySelector("#activityDetail").textContent,
      action: document.querySelector("#activityDetailsBtn").textContent,
      openLinkText: [...document.querySelectorAll("#captureList .mini-button")]
        .map((button) => button.textContent)
        .find((text) => text.startsWith("Open @")) || ""
    };
    const firstStackRow = document.querySelector("#captureStack .capture-stack-row");
    const stackButtons = [...(firstStackRow?.querySelectorAll("button") || [])];
    const captureStackAfterCard = {
      header: document.querySelector("#captureStack .capture-stack-header")?.textContent || "",
      rows: document.querySelectorAll("#captureStack .capture-stack-row").length,
      text: firstStackRow?.textContent || "",
      buttons: stackButtons.map((button) => button.textContent),
      reviewDisabled: stackButtons.find((button) => button.textContent === "Review")?.disabled === true
    };
    stackButtons.find((button) => button.textContent === "Review")?.click();
    const captureStackReviewOpen = {
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      focusMode: [...document.querySelectorAll("[data-focus-mode]")]
        .find((button) => button.classList.contains("active"))?.dataset.focusMode || "",
      deskReviewPrompt: document.querySelector("#deskReviewPrompt").textContent,
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityAction: document.querySelector("#activityDetailsBtn").textContent
    };
    document.querySelector('[data-tab="today"]').click();
    const todayText = document.querySelector("#todayTab").textContent;
    const todayActive = document.querySelector(".tab.active")?.dataset.tab === "today";
    const todayHasDueReview = todayText.includes("Due Review") && todayText.includes("Ownership lets Rust");
    const todayHasRecentCapture = todayText.includes("Recent Captures") && todayText.includes("compiler-enforced lifetimes");
    const todayDueOpenLinkText = [...document.querySelectorAll("#todayTab .due-card .mini-button")]
      .map((button) => button.textContent)
      .find((text) => text.startsWith("Open @")) || "";
    const todayRecentOpenLinkText = [...document.querySelectorAll("#todayTab .item-card:not(.due-card) .mini-button")]
      .map((button) => button.textContent)
      .find((text) => text.startsWith("Open @")) || "";
    const todayPrimary = {
      text: document.querySelector(".today-path-card")?.textContent || "",
      action: document.querySelector(".today-path-card [data-today-path-action]")?.textContent || "",
      actionKind: document.querySelector(".today-path-card [data-today-path-action]")?.dataset.todayPathAction || "",
      inspect: document.querySelector(".today-path-card [data-today-path-target]")?.textContent || "",
      target: document.querySelector(".today-path-card [data-today-path-target]")?.dataset.todayPathTarget || ""
    };
    const todayMapButtons = [...document.querySelectorAll("#todayTab .today-map-button")]
      .map((button) => ({
        target: button.dataset.todayMapTarget,
        text: button.textContent.trim(),
        aria: button.getAttribute("aria-label")
      }));
    const todayDetailDrawer = document.querySelector(".today-detail-drawer");
    const todayDetailDrawerOpenBefore = todayDetailDrawer?.open === true;
    const todayDetailDrawerText = todayDetailDrawer?.querySelector("summary")?.textContent || "";
    const todayDetailJumpResults = ["open_questions", "parked_questions", "answers_today", "closed_questions", "recent_captures"]
      .map((target) => {
        if (todayDetailDrawer) todayDetailDrawer.open = false;
        document.querySelector('[data-today-section="' + target + '"]')?.classList.remove("pulse");
        document.querySelector('#todayTab .today-map-button[data-today-map-target="' + target + '"]')?.click();
        return {
          target,
          open: todayDetailDrawer?.open === true,
          pulsed: document.querySelector('[data-today-section="' + target + '"]')?.classList.contains("pulse") === true
        };
      });
    const todayDetailDrawerOpenAfter = todayDetailDrawer?.open === true;
    const todayMapRecentPulsed = todayDetailJumpResults.find((item) => item.target === "recent_captures")?.pulsed === true;
    document.querySelector("#activityDetailsBtn").click();
    const activityOpenedReviewTab = document.querySelector(".tab.active")?.dataset.tab || "";
    const activityTargetPulsed = Boolean(document.querySelector(".review-card.pulse"));
    setValue("#timestampInput", "");
    document.querySelector("#timeBackBtn").click();
    const emptyFallbackNudge = {
      timestamp: document.querySelector("#timestampInput").value,
      contextTime: document.querySelector("#captureContextTime").textContent,
      activityTitle: document.querySelector("#activityTitle").textContent,
      backLabel: document.querySelector("#timeBackBtn").getAttribute("aria-label"),
      forwardLabel: document.querySelector("#timeForwardBtn").getAttribute("aria-label")
    };
    setValue("#timestampInput", "abc");
    document.querySelector("#timeForwardBtn").click();
    const invalidFallbackNudge = {
      timestamp: document.querySelector("#timestampInput").value,
      contextTime: document.querySelector("#captureContextTime").textContent,
      activityTitle: document.querySelector("#activityTitle").textContent
    };
    setValue("#timestampInput", "08:12");
    const noteButton = [...document.querySelectorAll("#captureList .mini-button")]
      .find((button) => button.textContent === "Note");
    noteButton.click();
    [...document.querySelectorAll("#captureList .mini-button")]
      .find((button) => button.textContent === "Note")
      .click();
    const noteInsertions = (document.querySelector("#notesEditor").value.match(/learning-companion:capture:/g) || []).length;
    const noteHasSource = document.querySelector("#notesEditor").value.includes("t=492s");
    setValue("#searchInput", "lifetime");
    const searchResults = [...document.querySelectorAll("#searchResults .search-result")];
    const firstSearchResult = searchResults[0];
    const searchBeforeOpen = {
      count: searchResults.length,
      type: firstSearchResult?.querySelector(".search-result-type")?.textContent || "",
      title: firstSearchResult?.querySelector(".search-result-title")?.textContent || "",
      excerpt: firstSearchResult?.querySelector(".search-result-excerpt")?.textContent || "",
      expanded: document.querySelector("#searchInput").getAttribute("aria-expanded") || "",
      activeDescendant: document.querySelector("#searchInput").getAttribute("aria-activedescendant") || "",
      activeSelected: firstSearchResult?.getAttribute("aria-selected") || ""
    };
    document.querySelector("#searchInput").dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true
    }));
    const searchAfterOpen = {
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activity: document.querySelector("#activityTitle").textContent,
      targetPulsed: Boolean(document.querySelector("#captureList .item-card.pulse"))
    };
    setValue("#searchInput", "lifetime");
    document.querySelector("#searchInput").dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true
    }));
    const searchAfterFirstEscape = {
      value: document.querySelector("#searchInput").value,
      hidden: document.querySelector("#searchResults").hidden,
      expanded: document.querySelector("#searchInput").getAttribute("aria-expanded") || ""
    };
    document.querySelector("#searchInput").dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true
    }));
    const searchAfterSecondEscape = {
      value: document.querySelector("#searchInput").value,
      hidden: document.querySelector("#searchResults").hidden,
      expanded: document.querySelector("#searchInput").getAttribute("aria-expanded") || ""
    };
    setValue("#quoteInput", "Spaced repetition improves durable recall. <script>alert(1)</script> <b>bold</b>");
    const quote = document.querySelector("#quoteInput");
    const start = quote.value.indexOf("durable");
    quote.setSelectionRange(start, start + "durable".length);
    document.querySelector("#captureClozeBtn").click();
    const dueBeforeGood = document.querySelector("#dueMetric").textContent;
    const gradeVisibleBeforeReveal = Boolean(document.querySelector('[data-grade="good"]'));
    document.querySelector('[data-tab="review"]').click();
    document.querySelector('[data-reveal-card]').click();
    const inspectorRevealVisible = document.querySelector("#reviewList").textContent.includes("Ownership lets Rust");
    document.querySelector('[data-focus-mode="review"]').click();
    const deskReviewVisible = !document.querySelector("#deskReviewPane").hidden && document.querySelector("#capturePane").hidden;
    const deskReviewPrompt = document.querySelector("#deskReviewPrompt").textContent;
    const deskReviewGradeVisibleAfterInspectorReveal = !document.querySelector("#deskReviewGoodBtn").hidden;
    const deskPreservedInspectorReveal = document.querySelector("#deskReviewAnswer").textContent.includes("Ownership lets Rust");
    document.querySelector("#sidecarLayoutBtn").click();
    const deskReviewVisibleInSidecar = getComputedStyle(document.querySelector("#deskReviewPane")).display !== "none"
      && getComputedStyle(document.querySelector(".inspector")).display === "none";
    document.querySelector("#sidecarLayoutBtn").click();
    const answerVisibleAfterReveal = document.querySelector("#deskReviewAnswer").textContent.includes("Ownership lets Rust");
    document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "2",
      bubbles: true,
      cancelable: true
    }));
    const focusBriefAfterGood = {
      action: document.querySelector("#focusBriefAction").textContent,
      kicker: document.querySelector("#focusBriefKicker").textContent
    };
    document.querySelector('[data-focus-mode="synthesize"]').click();
    const synthesisVisible = !document.querySelector("#synthesisPane").hidden && document.querySelector("#capturePane").hidden;
    document.querySelector("#synthesisDraft").value = "manual synthesis survives";
    document.querySelector("#synthesisDraft").dispatchEvent(new Event("input", { bubbles: true }));
    window.confirm = () => false;
    document.querySelector("#buildSynthesisBtn").click();
    const manualDraftAfterCancel = document.querySelector("#synthesisDraft").value;
    document.querySelector('[data-focus-mode="capture"]').click();
    setValue("#quoteInput", "A later capture changes source material.");
    document.querySelector("#captureBtn").click();
    document.querySelector('[data-focus-mode="synthesize"]').click();
    const staleStatus = document.querySelector("#synthesisStatus").textContent;
    window.confirm = () => true;
    document.querySelector("#buildSynthesisBtn").click();
    const synthesisDraft = document.querySelector("#synthesisDraft").value;
    document.querySelector("#insertSynthesisBtn").click();
    const focusBriefAfterSynthesis = {
      action: document.querySelector("#focusBriefAction").textContent,
      facts: document.querySelector("#focusBriefFacts").textContent,
      signals: document.querySelector("#focusBriefSignals").textContent,
      button: document.querySelector("#focusBriefActionBtn").textContent
    };
    const activityAfterSynthesis = document.querySelector("#activityTitle").textContent;
    document.querySelector("#insertSynthesisBtn").click();
    document.querySelector('[data-tab="export"]').click();
    const bookmarklet = document.querySelector("#bookmarkletExport").value;
    const workspaceExport = JSON.parse(document.querySelector("#workspaceExport").value);
    const reviewPackExport = document.querySelector("#reviewPackExport").value;
    const todayExport = document.querySelector("#todayExport").value;
    const mirror = JSON.parse(document.querySelector("#mirrorExport").value);
    const mirrorText = JSON.stringify(mirror);
    const hasMirrorZipButton = document.querySelector("#downloadMirrorZipBtn").textContent === "Save ZIP Copy";
    const exportSections = [...document.querySelectorAll(".export-section-title")].map((item) => item.textContent);
    const hasWorkspaceExportButtons = document.querySelector("#copyWorkspaceBtn").textContent === "Copy Workspace"
      && document.querySelector("#downloadWorkspaceBtn").textContent === "Save Workspace";
    const hasReviewPackButtons = document.querySelector("#copyReviewPackBtn").textContent === "Copy Pack"
      && document.querySelector("#downloadReviewPackBtn").textContent === "Save Pack";
    const hasTodayExportButtons = document.querySelector("#copyTodayBtn").textContent === "Copy Today"
      && document.querySelector("#downloadTodayBtn").textContent === "Save Today";
    const nativeBridgeExport = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    const nativeBridgeImportResult = window.learningCompanionNative.importWorkspaceJson(JSON.stringify(nativeBridgeExport));
    const nativeBridgeReviewPatchResult = window.learningCompanionNative.importWorkspaceJson(JSON.stringify({
      schema: "learning-companion.review-progress-patch.v1",
      appVersion: 1,
      patchId: "native_bridge_review_patch_missing",
      createdAt: "2026-05-29T09:02:00+08:00",
      source: { generatedBy: "review.html", workspaceFingerprint: "native-bridge" },
      events: [{
        id: "native_bridge_review_event_missing",
        sessionId: nativeBridgeExport.activeSessionId,
        cardId: "missing_native_bridge_card",
        grade: "good",
        reviewedAt: "2026-05-29T09:03:00+08:00",
        baseUpdatedAt: "2026-05-29T09:00:00.000Z",
        baseDueAt: "2026-05-29T09:00:00.000Z",
        baseStrength: 0
      }]
    }));
    const nativeBridgeInboxPatchResult = window.learningCompanionNative.importWorkspaceJson(JSON.stringify({
      schema: "learning-companion.mobile-inbox-patch.v1",
      appVersion: 1,
      patchId: "native_bridge_inbox_patch_001",
      createdAt: "2026-05-29T09:04:00+08:00",
      source: { generatedBy: "inbox.html", workspaceFingerprint: "native-bridge", topicId: nativeBridgeExport.activeSessionId },
      target: { topicId: nativeBridgeExport.activeSessionId },
      captures: [{
        id: "native_bridge_inbox_capture_001",
        quote: "Native menu imported this phone patch.",
        thought: "Mac bridge should share the same patch path as the browser file input.",
        timestamp: "09:04",
        sourceTitle: "Native bridge smoke",
        sourceUrl: "https://example.com/native-bridge",
        materialType: "doc",
        tags: "native bridge",
        capturedAt: "2026-05-29T09:04:30+08:00"
      }]
    }));
    const nativeBridgeInboxReceiptText = document.querySelector("#importReceipt").textContent;
    const nativeBridgeBadPatchResult = window.learningCompanionNative.importWorkspaceJson(JSON.stringify({
      schema: "learning-companion.mobile-inbox-patch.v2",
      patchId: "native_bridge_bad_patch",
      captures: []
    }));
    const nativeBridgeRestoreAfterPatch = window.learningCompanionNative.importWorkspaceJson(JSON.stringify(nativeBridgeExport));
    const nativeBridgeRoundTrip = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    const nativeSidecarOn = window.learningCompanionNative.setSidecarLayout(true);
    const nativeSidecarClassOn = document.querySelector(".app-shell").classList.contains("sidecar-layout");
    const nativeSidecarOff = window.learningCompanionNative.setSidecarLayout(false);
    const nativeSidecarClassOff = document.querySelector(".app-shell").classList.contains("sidecar-layout");
    setValue("#searchInput", "");
    document.querySelector('[data-tab="today"]').click();
    setValue("#quoteInput", "Draft quote before session switch.");
    setValue("#thoughtInput", "Draft thought should survive.");
    setValue("#timestampInput", "01:23");
    const draftFocusBrief = {
      action: document.querySelector("#focusBriefAction").textContent,
      detail: document.querySelector("#focusBriefDetail").textContent,
      facts: document.querySelector("#focusBriefFacts").textContent,
      signals: document.querySelector("#focusBriefSignals").textContent,
      button: document.querySelector("#focusBriefActionBtn").textContent
    };
    const draftActivity = {
      title: document.querySelector("#activityTitle").textContent,
      detail: document.querySelector("#activityDetail").textContent
    };
    const todayDraftCard = document.querySelector("#todayList .draft-card");
    const todayDraftBeforeResume = {
      listText: document.querySelector("#todayList")?.textContent || "",
      text: todayDraftCard?.textContent || "",
      resumeText: todayDraftCard?.querySelector("button")?.textContent || ""
    };
    todayDraftCard?.querySelector("button")?.click();
    const todayDraftAfterResume = {
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      focusMode: document.querySelector('[data-focus-mode="capture"]').classList.contains("active"),
      activeElement: document.activeElement?.id || "",
      activity: document.querySelector("#activityTitle").textContent
    };
    const captureDraftStatusBeforeSwitch = {
      text: document.querySelector("#captureDraftStatus").textContent,
      clearHidden: document.querySelector("#clearCaptureDraftBtn").hidden
    };
    document.querySelector("#newSessionBtn").click();
    const captureDraftNewSessionEmpty = document.querySelector("#quoteInput").value === ""
      && document.querySelector("#thoughtInput").value === ""
      && document.querySelector("#timestampInput").value === "";
    const captureDraftStatusInNewSession = {
      text: document.querySelector("#captureDraftStatus").textContent,
      clearHidden: document.querySelector("#clearCaptureDraftBtn").hidden
    };
    let emptyContextOpened = "";
    const nativeEmptyWindowOpen = window.open;
    window.open = (href) => {
      emptyContextOpened = href;
      return null;
    };
    document.querySelector("#captureContextOpenBtn").click();
    window.open = nativeEmptyWindowOpen;
    const captureContextInNewSession = {
      target: document.querySelector("#captureContextTarget").textContent,
      targetTitle: document.querySelector("#captureContextTarget").title,
      intent: document.querySelector("#captureContextIntent").textContent,
      source: document.querySelector("#captureContextSource").textContent,
      timeHidden: document.querySelector("#captureContextTime").hidden,
      openDisabled: document.querySelector("#captureContextOpenBtn").disabled,
      openText: document.querySelector("#captureContextOpenBtn").textContent,
      openLabel: document.querySelector("#captureContextOpenBtn").getAttribute("aria-label"),
      activeElementAfterOpen: document.activeElement?.id || "",
      activityTitleAfterOpen: document.querySelector("#activityTitle").textContent,
      activityDetailAfterOpen: document.querySelector("#activityDetail").textContent,
      sourceStripPulsedAfterOpen: document.querySelector(".source-strip").classList.contains("pulse"),
      opened: emptyContextOpened
    };
    const titleAfterNewSession = document.querySelector("#sessionTitle").value;
    [...document.querySelectorAll("#sessionList .session-row")]
      .find((button) => button.textContent.includes("Learning Companion MVP"))
      .click();
    const uiPrefs = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}");
    const captureDraftAfterSwitch = {
      quote: document.querySelector("#quoteInput").value,
      thought: document.querySelector("#thoughtInput").value,
      timestamp: document.querySelector("#timestampInput").value,
      persisted: Object.values(uiPrefs.captureDrafts || {})
        .some((draft) => draft.quote === "Draft quote before session switch."
          && draft.thought === "Draft thought should survive."
          && draft.timestamp === "01:23")
    };
    const captureDraftStatusAfterSwitch = {
      text: document.querySelector("#captureDraftStatus").textContent,
      clearHidden: document.querySelector("#clearCaptureDraftBtn").hidden
    };
    document.querySelector("#clearCaptureDraftBtn").click();
    const uiPrefsAfterClear = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}");
    const captureDraftAfterClear = {
      quote: document.querySelector("#quoteInput").value,
      thought: document.querySelector("#thoughtInput").value,
      timestamp: document.querySelector("#timestampInput").value,
      status: document.querySelector("#captureDraftStatus").textContent,
      clearHidden: document.querySelector("#clearCaptureDraftBtn").hidden,
      persisted: Object.values(uiPrefsAfterClear.captureDrafts || {})
        .some((draft) => draft.quote === "Draft quote before session switch."
          || draft.thought === "Draft thought should survive."
          || draft.timestamp === "01:23")
    };
    const staleDraftPruneQuote = "Stale draft should be pruned on restore.";
    [...document.querySelectorAll("#sessionList .session-row")]
      .find((button) => button.textContent.includes(titleAfterNewSession))
      .click();
    setValue("#quoteInput", staleDraftPruneQuote);
    const uiPrefsWithStaleDraft = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}");
    const captureDraftStaleBeforeImport = Object.values(uiPrefsWithStaleDraft.captureDrafts || {})
      .some((draft) => draft.quote === staleDraftPruneQuote);
    const importInput = document.querySelector("#importWorkspaceInput");
    const transfer = new DataTransfer();
    transfer.items.add(new File([mirrorText], "learning-companion-feishu-mirror.json", { type: "application/json" }));
    importInput.files = transfer.files;
    importInput.dispatchEvent(new Event("change", { bubbles: true }));
    return new Promise((resolve) => setTimeout(() => {
      const restoredWorkspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
      const restoredSession = restoredWorkspace.sessions.find((item) => item.id === restoredWorkspace.activeSessionId);
      const uiPrefsAfterImport = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}");
      const captureDraftPrunedAfterImport = !Object.values(uiPrefsAfterImport.captureDrafts || {})
        .some((draft) => draft.quote === staleDraftPruneQuote);
      const restoredMirror = JSON.parse(document.querySelector("#mirrorExport").value);
      const synthesisOccurrences = (restoredSession.notesMarkdown.match(/Synthesis - Learning Companion MVP/g) || []).length;
      const badTransfer = new DataTransfer();
      badTransfer.items.add(new File([JSON.stringify({ ...mirror, canonical: "bad.json" })], "bad-mirror.json", { type: "application/json" }));
        importInput.files = badTransfer.files;
        importInput.dispatchEvent(new Event("change", { bubbles: true }));
        setTimeout(() => {
          const badMirrorReceipt = document.querySelector("#importReceipt").textContent;
          const malformedTransfer = new DataTransfer();
          malformedTransfer.items.add(new File(["{ broken json"], "broken-patch.json", { type: "application/json" }));
          importInput.files = malformedTransfer.files;
          importInput.dispatchEvent(new Event("change", { bubbles: true }));
          setTimeout(() => {
            const malformedImportReceipt = document.querySelector("#importReceipt").textContent;
            const oversizedInboxPatch = {
              schema: "learning-companion.mobile-inbox-patch.v1",
              appVersion: 1,
              patchId: "browser_patch_too_large",
              captures: [{
                id: "browser_inbox_capture_too_large",
                quote: "Oversized inbox patch fixture",
                thought: "x".repeat(270000)
              }]
            };
            const oversizedTransfer = new DataTransfer();
            oversizedTransfer.items.add(new File([JSON.stringify(oversizedInboxPatch)], "oversized-inbox-patch.json", { type: "application/json" }));
            importInput.files = oversizedTransfer.files;
            importInput.dispatchEvent(new Event("change", { bubbles: true }));
            setTimeout(() => {
              const oversizedImportReceipt = document.querySelector("#importReceipt").textContent;
              const oversizedImportReceiptVisible = !document.querySelector("#importReceipt").hidden
                && getComputedStyle(document.querySelector("#importReceipt")).display !== "none"
                && document.querySelector("#importReceipt").classList.contains("import-receipt-error");
          const afterFailedImport = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
          const afterFailedSession = afterFailedImport.sessions.find((item) => item.id === afterFailedImport.activeSessionId);
          const reviewProgressPatch = {
            schema: "learning-companion.review-progress-patch.v1",
            appVersion: 1,
            patchId: "browser_review_progress_missing",
            createdAt: "2026-05-29T09:05:00+08:00",
            source: { generatedBy: "review.html", workspaceFingerprint: "browser" },
            events: [{
              id: "browser_review_event_missing",
              sessionId: restoredSession.id,
              cardId: "missing_card",
              grade: "good",
              reviewedAt: "2026-05-29T09:06:00+08:00",
              baseUpdatedAt: "2026-05-29T09:00:00.000Z",
              baseDueAt: "2026-05-29T09:00:00.000Z",
              baseStrength: 0
            }]
          };
          const reviewTransfer = new DataTransfer();
          reviewTransfer.items.add(new File([JSON.stringify(reviewProgressPatch)], "learning-companion-review-progress-patch.json", { type: "application/json" }));
          importInput.files = reviewTransfer.files;
          importInput.dispatchEvent(new Event("change", { bubbles: true }));
          setTimeout(() => {
            const reviewReceiptBeforeInbox = document.querySelector("#importReceipt").textContent;
            const duplicateReviewTransfer = new DataTransfer();
            duplicateReviewTransfer.items.add(new File([JSON.stringify(reviewProgressPatch)], "learning-companion-review-progress-patch.json", { type: "application/json" }));
            importInput.files = duplicateReviewTransfer.files;
            importInput.dispatchEvent(new Event("change", { bubbles: true }));
            setTimeout(() => {
              const duplicateReviewReceiptBeforeInbox = document.querySelector("#importReceipt").textContent;
              const duplicateReturnNudgeBeforeInbox = Boolean(document.querySelector(".returned-work-card"));
              const captureMetricBeforeInbox = document.querySelector("#captureMetric").textContent;
              const cardMetricBeforeInbox = document.querySelector("#cardMetric").textContent;
              const dueMetricBeforeInbox = document.querySelector("#dueMetric").textContent;
              const captureTextBeforeInbox = document.querySelector("#captureList").textContent;
              const reviewTextBeforeInbox = document.querySelector("#reviewList").textContent;
              const inboxPatch = {
          schema: "learning-companion.mobile-inbox-patch.v1",
          appVersion: 1,
          patchId: "browser_patch_001",
          createdAt: "2026-05-29T09:00:00+08:00",
          source: { generatedBy: "inbox.html", workspaceFingerprint: "browser", topicId: restoredSession.id, topicTitle: restoredSession.title },
          target: { topicId: restoredSession.id, topicTitle: restoredSession.title },
          captures: [{
            id: "browser_inbox_capture_001",
            quote: "Mobile inbox capture from Windows or HarmonyOS.",
            thought: "Append-only patch should return to the Mac.",
            timestamp: "09:00",
            sourceTitle: "Phone note",
            sourceUrl: "data:text/html,bad",
            materialType: "doc",
            tags: "mobile inbox",
            answersQuestionCaptureId: "bad answer target!",
            capturedAt: "2026-05-29T09:01:00+08:00"
          }]
        };
        const inboxTransfer = new DataTransfer();
        inboxTransfer.items.add(new File([JSON.stringify(inboxPatch)], "learning-companion-inbox-patch.json", { type: "application/json" }));
        importInput.files = inboxTransfer.files;
        importInput.dispatchEvent(new Event("change", { bubbles: true }));
        setTimeout(() => {
          const singleInboxReceiptText = document.querySelector("#importReceipt").textContent;
          const singleInboxActiveTab = document.querySelector(".tab.active")?.dataset.tab || "";
          const singleReturnedWorkText = document.querySelector(".returned-work-card")?.textContent || "";
          const singleHandoffText = document.querySelector(".handoff-card")?.textContent || "";
          const batchInboxPatch = {
            ...inboxPatch,
            patchId: "browser_patch_002",
            captures: [{
              ...inboxPatch.captures[0],
              id: "browser_inbox_capture_002",
              quote: "Second return file capture from Windows.",
              thought: "Batch import should report multiple files at once.",
              capturedAt: "2026-05-29T09:02:00+08:00"
            }]
          };
          const batchTransfer = new DataTransfer();
          batchTransfer.items.add(new File([JSON.stringify(batchInboxPatch)], "learning-companion-inbox-patch-20260529-0902-002.json", { type: "application/json" }));
          batchTransfer.items.add(new File([JSON.stringify(reviewProgressPatch)], "learning-companion-review-progress-patch-20260529-0906-missing.json", { type: "application/json" }));
          batchTransfer.items.add(new File([JSON.stringify(restoredWorkspace)], "workspace-return-mistake.json", { type: "application/json" }));
          importInput.files = batchTransfer.files;
          importInput.dispatchEvent(new Event("change", { bubbles: true }));
          setTimeout(() => {
          const afterInboxImport = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
          const afterInboxSession = afterInboxImport.sessions.find((item) => item.id === afterInboxImport.activeSessionId);
          const batchReceiptText = document.querySelector("#importReceipt").textContent;
          const batchActivityTitle = document.querySelector("#activityTitle").textContent;
          const batchActivityDetail = document.querySelector("#activityDetail").textContent;
          const activeTabAfterBatchImport = document.querySelector(".tab.active")?.dataset.tab || "";
          const handoffAfterBatchImport = document.querySelector(".handoff-card");
          const handoffOpenAfterBatchImport = handoffAfterBatchImport?.open === true;
          const handoffPulsedAfterBatchImport = handoffAfterBatchImport?.classList.contains("pulse") === true;
          document.querySelector('[data-tab="today"]').click();
          const returnedWorkCard = document.querySelector(".returned-work-card");
          const returnedWorkText = returnedWorkCard?.textContent || "";
          const returnedWorkButtons = [...(returnedWorkCard?.querySelectorAll("button") || [])].map((button) => button.textContent);
          returnedWorkCard?.querySelector("[data-returned-work-secondary]")?.click();
          const returnedWorkReceiptOpened = document.querySelector(".handoff-card")?.open === true;
          returnedWorkCard?.querySelector("[data-returned-work-action]")?.click();
          const returnedWorkActionResult = {
            detailDrawerOpen: document.querySelector('[data-today-detail-drawer="study_details"]')?.open === true,
            recentPulsed: document.querySelector('[data-today-section="recent_captures"]')?.classList.contains("pulse") === true
          };
          returnedWorkCard?.querySelector('[data-returned-work-dismiss="true"]')?.click();
          const returnedWorkDismissed = !document.querySelector(".returned-work-card");
          const handoffPanel = document.querySelector(".handoff-card");
          const handoffText = handoffPanel.textContent;
          const handoffButtons = [...handoffPanel.querySelectorAll("button")].map((button) => button.textContent);
          handoffPanel.querySelector('[data-return-files-step="export"]')?.click();
          const handoffExportOpened = {
            activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
            activeElement: document.activeElement?.id || "",
            mirrorSectionPulsed: document.querySelector("#mirrorExportSection")?.classList.contains("pulse") === true,
            activityTitle: document.querySelector("#activityTitle").textContent,
            activityDetail: document.querySelector("#activityDetail").textContent
          };
          resolve({
          titleAfterNewSession,
          restoredTitle: restoredSession.title,
          restoredCaptures: restoredSession.captures.length,
          restoredCards: restoredSession.reviewCards.length,
          restoredSourceUrl: restoredSession.sourceUrl,
          latestCaptureSourceUrl: restoredSession.captures[0].sourceUrl,
          latestCaptureMaterialType: restoredSession.captures[0].materialType,
          latestCaptureSourceProvenance: restoredSession.captures[0].sourceProvenance,
          badMirrorReceipt,
          malformedImportReceipt,
          oversizedImportReceipt,
          oversizedImportReceiptVisible,
          failedImportTitle: afterFailedSession.title,
          importInputCleared: importInput.value === "",
          importInputMultiple: importInput.multiple === true,
          reviewReceiptBeforeInbox,
          duplicateReviewReceiptBeforeInbox,
          duplicateReturnNudgeBeforeInbox,
          captureMetric: captureMetricBeforeInbox,
          cardMetric: cardMetricBeforeInbox,
          dueMetric: dueMetricBeforeInbox,
          captureText: captureTextBeforeInbox,
          reviewText: reviewTextBeforeInbox,
          inboxCaptureMetric: document.querySelector("#captureMetric").textContent,
          singleInboxReceiptText,
          singleInboxActiveTab,
          singleReturnedWorkText,
          singleHandoffText,
          batchReceiptText,
          batchActivityTitle,
          batchActivityDetail,
          activeTabAfterBatchImport,
          handoffOpenAfterBatchImport,
          handoffPulsedAfterBatchImport,
          returnedWorkText,
          returnedWorkButtons,
          returnedWorkReceiptOpened,
          returnedWorkActionResult,
          returnedWorkDismissed,
          inboxLatestSourceUrl: afterInboxSession.captures[0].sourceUrl,
          inboxLatestProvenance: afterInboxSession.captures[0].sourceProvenance,
          inboxSanitizedSourceUrls: afterInboxImport.sessions.find((item) => item.id === afterInboxImport.activeSessionId).captures[0].sourceUrl === "" ? 1 : 0,
          inboxImportedPatch: afterInboxImport.importedPatches.includes("browser_patch_001"),
          batchImportedPatch: afterInboxImport.importedPatches.includes("browser_patch_002"),
          batchImportedReviewPatch: afterInboxImport.importedReviewPatches.includes("browser_review_progress_missing"),
          handoffText,
          handoffButtons,
          handoffExportOpened,
          inboxNotesPreserved: afterInboxSession.notesMarkdown === restoredSession.notesMarkdown,
          inboxCardsPreserved: afterInboxSession.reviewCards.length === restoredSession.reviewCards.length,
          previewText: document.querySelector("#notesPreview").textContent,
          notesMarkdown: restoredSession.notesMarkdown,
          draftFocusBrief,
          draftActivity,
          sourceTimestampStage,
          sourceContextShown,
          sourceTimestampTyped,
          sourceTimestampNudge,
          todayDraftBeforeResume,
          todayDraftAfterResume,
          captureDraftStatusBeforeSwitch,
          captureDraftStatusInNewSession,
          captureContextInNewSession,
          captureDraftNewSessionEmpty,
          captureDraftAfterSwitch,
          captureDraftStatusAfterSwitch,
          captureDraftAfterClear,
          captureDraftStaleBeforeImport,
          captureDraftPrunedAfterImport,
          activityAfterCard,
          captureStackAfterCard,
          captureStackReviewOpen,
          captureDraftStatusAfterCard,
          backupNoticeAfterCapture,
          backupNoticeAfterExport,
          sourceJumpOpened,
          focusBriefAfterCard,
          focusBriefAfterGood,
          focusBriefAfterSynthesis,
          todayActive,
          todayHasDueReview,
          todayHasRecentCapture,
          todayDueOpenLinkText,
          todayRecentOpenLinkText,
          todayPrimary,
          todayMapButtons,
          todayDetailDrawerOpenBefore,
          todayDetailDrawerText,
          todayDetailJumpResults,
          todayDetailDrawerOpenAfter,
          todayMapRecentPulsed,
          emptyFallbackNudge,
          invalidFallbackNudge,
          noteInsertions,
          noteHasSource,
          searchBeforeOpen,
          searchAfterOpen,
          searchAfterFirstEscape,
          searchAfterSecondEscape,
          activityOpenedReviewTab,
          activityTargetPulsed,
          activityAfterSynthesis,
          synthesisVisible,
          synthesisDraft,
          manualDraftAfterCancel,
          staleStatus,
          synthesisOccurrences,
          hasScriptNode: Boolean(document.querySelector("#notesPreview script")),
          hasBoldNode: Boolean(document.querySelector("#notesPreview b")),
          bookmarklet: document.querySelector("#bookmarkletExport").value,
          workspaceExportSchema: workspaceExport.schema,
          workspaceExportSessions: workspaceExport.sessions.length,
          workspaceExportActiveSession: workspaceExport.sessions.find((item) => item.id === workspaceExport.activeSessionId)?.title || "",
          reviewPackExport,
          workspaceDetailsCollapsed: document.querySelector(".export-details").open === false,
          workspaceExportNote: document.querySelector(".export-note").textContent,
          exportSections,
          nativeBridgeExportSchema: nativeBridgeExport.schema,
          nativeBridgeImportOk: nativeBridgeImportResult.ok === true,
          nativeBridgeReviewPatchOk: nativeBridgeReviewPatchResult.ok === true,
          nativeBridgeReviewPatchKind: nativeBridgeReviewPatchResult.kind,
          nativeBridgeReviewPatchMissing: nativeBridgeReviewPatchResult.receipt?.skippedMissing || 0,
          nativeBridgeInboxPatchOk: nativeBridgeInboxPatchResult.ok === true,
          nativeBridgeInboxPatchKind: nativeBridgeInboxPatchResult.kind,
          nativeBridgeInboxPatchAdded: nativeBridgeInboxPatchResult.receipt?.added || 0,
          nativeBridgeInboxReceiptText,
          nativeBridgeBadPatchOk: nativeBridgeBadPatchResult.ok === true,
          nativeBridgeBadPatchError: nativeBridgeBadPatchResult.error || "",
          nativeBridgeRestoreAfterPatchOk: nativeBridgeRestoreAfterPatch.ok === true,
          nativeBridgeRoundTripSchema: nativeBridgeRoundTrip.schema,
          nativeBridgeRoundTripSessions: nativeBridgeRoundTrip.sessions.length,
          nativeBridgeRoundTripActiveId: nativeBridgeRoundTrip.activeSessionId,
          nativeSidecarOnOk: nativeSidecarOn.ok === true && nativeSidecarOn.sidecarLayout === true,
          nativeSidecarClassOn,
          nativeSidecarOffOk: nativeSidecarOff.ok === true && nativeSidecarOff.sidecarLayout === false,
          nativeSidecarClassOff,
          todayExport,
          hasWorkspaceExportButtons,
          hasReviewPackButtons,
          hasTodayExportButtons,
          hasMirrorZipButton,
          mirrorSchema: restoredMirror.schema,
          mirrorFileCount: restoredMirror.manifest.fileCount,
          mirrorCanonical: restoredMirror.canonical,
          mirrorBundleFingerprint: restoredMirror.manifest.bundleFingerprint,
          mirrorHasIndex: restoredMirror.files.some((file) => file.path === "index.html" && file.role === "mirror-home" && /^fnv1a-[a-f0-9]{8}$/.test(file.sourceFingerprint) && file.content.includes("Learning Companion Mirror") && file.content.includes("Return-ready mirror") && file.content.includes("Mac return-base check") && file.content.includes('href="TODAY.md"') && file.content.includes('href="review.html"') && file.content.includes('href="inbox.html"')),
          mirrorIndexHtml: restoredMirror.files.find((file) => file.path === "index.html")?.content || "",
          mirrorHasWorkspace: restoredMirror.files.some((file) => file.path === "workspace.json"),
          mirrorHasToday: restoredMirror.files.some((file) => file.path === "TODAY.md" && file.content.includes("Today Study Pack") && file.content.includes("](sessions/")),
          mirrorHasReviewHtml: restoredMirror.files.some((file) => file.path === "review.html" && file.role === "portable-review" && /^fnv1a-[a-f0-9]{8}$/.test(file.sourceFingerprint) && /^fnv1a-[a-f0-9]{8}$/.test(file.sourceReturnBaseFingerprint) && file.content.includes("Learning Companion Review Pack") && file.content.includes("Return-ready mirror") && file.content.includes("data-reveal") && file.content.includes("returnBaseFingerprint") && file.content.includes("Content-Security-Policy")),
          mirrorReviewHtml: restoredMirror.files.find((file) => file.path === "review.html")?.content || "",
          mirrorHasInboxHtml: restoredMirror.files.some((file) => file.path === "inbox.html" && file.role === "mobile-inbox" && /^fnv1a-[a-f0-9]{8}$/.test(file.sourceReturnBaseFingerprint) && file.content.includes("Learning Companion Inbox") && file.content.includes("Return-ready mirror") && file.content.includes("learning-companion.mobile-inbox-patch.v1") && file.content.includes("returnBaseFingerprint") && !file.content.includes("<link") && !/<script[^>]+src=/i.test(file.content) && !/<iframe/i.test(file.content) && !/srcdoc=/i.test(file.content) && !/href=["']javascript:/i.test(file.content) && !/\\bfetch\\s*\\(/.test(file.content) && !/XMLHttpRequest/.test(file.content)),
          mirrorInboxHtml: restoredMirror.files.find((file) => file.path === "inbox.html")?.content || "",
          mirrorTodayEscapesScript: (() => {
            const today = restoredMirror.files.find((file) => file.path === "TODAY.md")?.content || "";
            return today.includes("&lt;script&gt;alert") && !today.includes("<script");
          })(),
          mirrorReviewEscapesScript: (() => {
            const review = restoredMirror.files.find((file) => file.path === "review.html")?.content || "";
            return review.includes("&lt;script&gt;alert") && !review.includes("<script>alert");
          })(),
          mirrorHasMarkdown: restoredMirror.files.some((file) => file.path.endsWith(".md") && file.content.includes("Learning Companion MVP")),
          mirrorHasTimeJump: restoredMirror.files.some((file) => file.path.endsWith(".md") && file.content.includes("t=492s")),
          mirrorFingerprintsValid: restoredMirror.files.every((file) => file.encoding === "utf-8" && /^fnv1a-[a-f0-9]{8}$/.test(file.contentFingerprint)),
          captures: restoredSession.captures.length,
          cards: restoredSession.reviewCards.length,
          latestPrompt: restoredSession.reviewCards[0].prompt,
          latestAnswer: restoredSession.reviewCards[0].answer,
          dueBeforeGood,
          gradeVisibleBeforeReveal,
          answerVisibleAfterReveal,
          dueAfterGood: document.querySelector("#dueMetric").textContent,
          gradedCount: restoredSession.reviewCards.filter((card) => card.strength === 1).length,
          deskReviewVisible,
          deskReviewPrompt,
          deskReviewGradeVisibleAfterInspectorReveal,
          inspectorRevealVisible,
          deskPreservedInspectorReveal,
          deskReviewVisibleInSidecar,
          schemaVersion: restoredWorkspace.schemaVersion,
          clientId: restoredWorkspace.clientId
          });
          }, 80);
        }, 80);
        }, 80);
        }, 80);
        }, 80);
        }, 80);
      }, 80);
    }, 80));
  })()`);

  assert.equal(exceptions.length, 0);
  assert.equal(result.titleAfterNewSession, "New learning session");
  assert.equal(result.restoredTitle, "Learning Companion MVP");
  assert.equal(result.restoredCaptures, 3);
  assert.equal(result.restoredCards, 2);
  assert.equal(result.restoredSourceUrl, "https://www.youtube.com/watch?v=rust123");
  assert.equal(result.latestCaptureSourceUrl, "https://www.youtube.com/watch?v=rust123");
  assert.equal(result.latestCaptureMaterialType, "video");
  assert.equal(result.latestCaptureSourceProvenance, "snapshot");
  assert.match(result.badMirrorReceipt, /Import issue/);
  assert.match(result.badMirrorReceipt, /bad-mirror\.json/);
  assert.match(result.badMirrorReceipt, /canonical payload/);
  assert.match(result.malformedImportReceipt, /Import issue/);
  assert.match(result.malformedImportReceipt, /broken-patch\.json/);
  assert.match(result.oversizedImportReceipt, /Import issue/);
  assert.match(result.oversizedImportReceipt, /oversized-inbox-patch\.json/);
  assert.match(result.oversizedImportReceipt, /Mobile inbox patch is too large/);
  assert.equal(result.oversizedImportReceiptVisible, true);
  assert.equal(result.failedImportTitle, "Learning Companion MVP");
  assert.equal(result.importInputCleared, true);
  assert.equal(result.importInputMultiple, true);
  assert.match(result.reviewReceiptBeforeInbox, /Review progress imported/);
  assert.match(result.reviewReceiptBeforeInbox, /0 applied/);
  assert.match(result.reviewReceiptBeforeInbox, /1 missing/);
  assert.match(result.reviewReceiptBeforeInbox, /mirror base changed/);
  assert.match(result.reviewReceiptBeforeInbox, /legacy mirror check/);
  assert.match(result.reviewReceiptBeforeInbox, /old return JSON/);
  assert.match(result.reviewReceiptBeforeInbox, /re-export mirror before next device pass/);
  assert.match(result.duplicateReviewReceiptBeforeInbox, /Review progress imported/);
  assert.match(result.duplicateReviewReceiptBeforeInbox, /0 applied/);
  assert.match(result.duplicateReviewReceiptBeforeInbox, /1 duplicate/);
  assert.match(result.duplicateReviewReceiptBeforeInbox, /mirror base changed/);
  assert.match(result.duplicateReviewReceiptBeforeInbox, /legacy mirror check/);
  assert.match(result.duplicateReviewReceiptBeforeInbox, /old return JSON/);
  assert.equal(result.duplicateReturnNudgeBeforeInbox, false);
  assert.equal(result.inboxCaptureMetric, "5");
  assert.match(result.singleInboxReceiptText, /1 added, 0 skipped/);
  assert.match(result.singleInboxReceiptText, /1 source link stripped/);
  assert.match(result.singleInboxReceiptText, /1 answer target skipped/);
  assert.match(result.singleInboxReceiptText, /invalid: 1/);
  assert.match(result.singleInboxReceiptText, /mirror base changed/);
  assert.match(result.singleInboxReceiptText, /legacy mirror check/);
  assert.match(result.singleInboxReceiptText, /old return JSON/);
  assert.match(result.singleInboxReceiptText, /re-export mirror before next device pass/);
  assert.match(result.singleInboxReceiptText, /topic id matched/);
  assert.equal(result.singleInboxActiveTab, "today");
  assert.match(result.singleReturnedWorkText, /old return JSON - re-export mirror before next device pass/);
  assert.doesNotMatch(result.singleReturnedWorkText, /1 old return files/);
  assert.match(result.singleHandoffText, /1 old return file - re-export mirror before next device pass/);
  assert.doesNotMatch(result.singleHandoffText, /1 old return files/);
  assert.match(result.batchReceiptText, /Return JSON imported/);
  assert.match(result.batchReceiptText, /2\/3 files processed/);
  assert.match(result.batchReceiptText, /2 mirror bases changed/);
  assert.match(result.batchReceiptText, /2 legacy mirror checks/);
  assert.match(result.batchReceiptText, /old return JSON/);
  assert.match(result.batchReceiptText, /re-export mirror before next device pass/);
  assert.match(result.batchReceiptText, /learning-companion-inbox-patch-20260529-0902-002\.json/);
  assert.match(result.batchReceiptText, /learning-companion-review-progress-patch-20260529-0906-missing\.json/);
  assert.match(result.batchReceiptText, /inbox: 1 added, 0 skipped/);
  assert.match(result.batchReceiptText, /review: 0 applied, 1 duplicate/);
  assert.match(result.batchReceiptText, /1 failed/);
  assert.match(result.batchReceiptText, /workspace-return-mistake\.json/);
  assert.equal(result.batchActivityTitle, "Return JSON imported (1 inbox, 1 review)");
  assert.match(result.batchActivityDetail, /2\/3 files processed/);
  assert.equal(result.activeTabAfterBatchImport, "today");
  assert.equal(result.handoffOpenAfterBatchImport, true);
  assert.equal(result.handoffPulsedAfterBatchImport, true);
  assert.match(result.returnedWorkText, /Returned from phone\/Windows/);
  assert.match(result.returnedWorkText, /1 new capture from phone or Windows/);
  assert.match(result.returnedWorkText, /3 return files checked/);
  assert.match(result.returnedWorkText, /2 old return files - re-export mirror before next device pass/);
  assert.match(result.returnedWorkText, /2 succeeded/);
  assert.match(result.returnedWorkText, /1 returned capture/);
  assert.match(result.returnedWorkText, /1 failed - open Import details/);
  assert.deepEqual(result.returnedWorkButtons, ["View captures", "Import details", "Dismiss"]);
  assert.equal(result.returnedWorkReceiptOpened, true);
  assert.deepEqual(result.returnedWorkActionResult, {
    detailDrawerOpen: true,
    recentPulsed: true
  });
  assert.equal(result.returnedWorkDismissed, true);
  assert.equal(result.inboxLatestSourceUrl, "");
  assert.equal(result.inboxLatestProvenance, "inbox");
  assert.equal(result.inboxSanitizedSourceUrls, 1);
  assert.equal(result.inboxImportedPatch, true);
  assert.equal(result.batchImportedPatch, true);
  assert.equal(result.batchImportedReviewPatch, true);
  assert.match(result.handoffText, /Device Flow/);
  assert.match(result.handoffText, /Next: export mirror/);
  assert.match(result.handoffText, /Manual transfer/);
  assert.match(result.handoffText, /2 inbox · 1 review/);
  assert.match(result.handoffText, /2\/3 files processed/);
  assert.match(result.handoffText, /review: 0 applied, 1 duplicate/);
  assert.match(result.handoffText, /1 failed/);
  assert.match(result.handoffText, /Export mirror on this Mac/);
  assert.match(result.handoffText, /USB, AirDrop, email, or any file share/);
  assert.match(result.handoffText, /manual Feishu Drive upload/);
  assert.match(result.handoffText, /On phone or Windows, open inbox\.html or review\.html and save inbox\/review return JSON/);
  assert.match(result.handoffText, /Back on this Mac, import one or many return JSON files at once/);
  assert.match(result.handoffText, /No live Feishu sync/);
  assert.match(result.handoffText, /No mirror exported yet/);
  assert.match(result.handoffText, /Last return imported/);
  assert.match(result.handoffText, /2 files/);
  assert.match(result.handoffText, /1 new/);
  assert.match(result.handoffText, /2 old return files - re-export mirror before next device pass/);
  assert.deepEqual(result.handoffButtons, ["Export Mirror", "Import Return Files"]);
  assert.deepEqual(result.handoffExportOpened, {
    activeTab: "export",
    activeElement: "downloadMirrorBtn",
    mirrorSectionPulsed: true,
    activityTitle: "Mirror export ready",
    activityDetail: "Save Mirror JSON or ZIP, then move it through USB, AirDrop, email, file share, or a manual Feishu Drive upload."
  });
  assert.equal(result.inboxNotesPreserved, true);
  assert.equal(result.inboxCardsPreserved, true);
  assert.match(result.draftFocusBrief.action, /Review/);
  assert.equal(result.draftFocusBrief.button, "Review");
  assert.doesNotMatch(result.draftFocusBrief.action, /Resume capture draft/);
  assert.equal(result.draftActivity.title, "Capture draft waiting");
  assert.match(result.draftActivity.detail, /Draft quote before session switch/);
  assert.equal(result.sourceTimestampStage.timestamp, "08:12");
  assert.equal(result.sourceTimestampStage.sourceUrlInputBeforeChange, "https://www.youtube.com/watch?v=rust123&t=8m12s");
  assert.equal(result.sourceTimestampStage.sourceUrlStored, "https://www.youtube.com/watch?v=rust123");
  assert.equal(result.sourceTimestampStage.sourceUrlInputAfterChange, "https://www.youtube.com/watch?v=rust123");
  assert.equal(result.sourceTimestampStage.activityTitle, "Source time staged");
  assert.match(result.sourceTimestampStage.activityDetail, /Timestamp 08:12 saved as a capture draft/);
  assert.equal(result.sourceTimestampStage.openSourceTitle, "Open source at 08:12");
  assert.equal(result.sourceTimestampStage.draftStatus, "Time kept");
  assert.equal(result.sourceTimestampStage.timestampPulsed, true);
  assert.equal(result.sourceTimestampStage.contextTarget, "To Learning Companion MVP");
  assert.equal(result.sourceTimestampStage.contextTargetTitle, "Captures save to Learning Companion MVP");
  assert.equal(result.sourceTimestampStage.contextIntent, "Video moment");
  assert.equal(result.sourceTimestampStage.contextIntentTitle, "Capture the current video moment with the transcript line, question, or answer it triggered.");
  assert.equal(result.sourceTimestampStage.quotePlaceholder, "Transcript line or key phrase at this moment");
  assert.equal(result.sourceTimestampStage.thoughtPlaceholder, "Your question, takeaway, or answer for this moment");
  assert.equal(result.sourceTimestampStage.contextSource, "RustConf ownership talk");
  assert.equal(result.sourceTimestampStage.contextTime, "@ 08:12");
  assert.equal(result.sourceTimestampStage.contextOpenDisabled, false);
  assert.equal(result.sourceTimestampStage.contextOpenText, "Resume @ 08:12");
  assert.equal(result.sourceTimestampStage.contextOpenTitle, "Open source at 08:12");
  assert.equal(result.sourceTimestampStage.contextOpenAria, "Open source at 08:12");
  assert.equal(result.sourceTimestampStage.contextOpened, "https://www.youtube.com/watch?v=rust123&t=492s");
  assert.deepEqual(result.sourceContextShown, {
    activeElement: "sourceTitle",
    activityTitle: "Capture source shown",
    activityDetail: "Captures use RustConf ownership talk.",
    sourceStripPulsed: true,
    ariaLabel: "Show capture source: RustConf ownership talk"
  });
  assert.equal(result.sourceTimestampTyped.timestamp, "12:30");
  assert.equal(result.sourceTimestampTyped.contextTime, "@ 12:30");
  assert.equal(result.sourceTimestampTyped.contextOpenText, "Resume @ 12:30");
  assert.equal(result.sourceTimestampTyped.contextOpenTitle, "Open source at 12:30");
  assert.equal(result.sourceTimestampTyped.contextOpenAria, "Open source at 12:30");
  assert.equal(result.sourceTimestampTyped.contextOpened, "https://www.youtube.com/watch?v=rust123&t=750s");
  assert.deepEqual(result.sourceTimestampNudge.afterTimeBack, {
    timestamp: "12:15",
    contextTime: "@ 12:15",
    activityTitle: "Time adjusted",
    activityDetail: "Capture time set to 12:15.",
    pulsed: true
  });
  assert.deepEqual(result.sourceTimestampNudge.afterTimeForward, {
    timestamp: "12:30",
    contextTime: "@ 12:30",
    activityTitle: "Time adjusted",
    activityDetail: "Capture time set to 12:30."
  });
  assert.deepEqual(result.sourceTimestampNudge.afterKeyboardBack, {
    timestamp: "12:15",
    contextTime: "@ 12:15",
    activityTitle: "Time adjusted",
    defaultPrevented: true,
    dispatchResult: false,
    activeId: "timestampInput"
  });
  assert.deepEqual(result.sourceTimestampNudge.afterKeyboardForward, {
    timestamp: "12:30",
    contextTime: "@ 12:30",
    activityTitle: "Time adjusted",
    defaultPrevented: true,
    dispatchResult: false,
    activeId: "timestampInput"
  });
  assert.deepEqual(result.sourceTimestampNudge.afterZeroBack, {
    timestamp: "00:00",
    contextTime: "@ 00:00",
    activityTitle: "Time unchanged",
    activityDetail: "Capture time is already 00:00."
  });
  assert.equal(result.sourceTimestampNudge.titleOnlySourceRefresh.status, "Draft saved");
  assert.doesNotMatch(result.sourceTimestampNudge.titleOnlySourceRefresh.statusClass, /warn/);
  assert.deepEqual(result.sourceTimestampNudge.questionIntent, {
    text: "Question",
    title: "This capture will enter Open Questions."
  });
  assert.deepEqual(result.sourceTimestampNudge.answerDraftIntent, {
    text: "Answer draft",
    title: "This looks like an answer draft; add enough detail before saving as answer evidence."
  });
  assert.deepEqual(result.sourceTimestampNudge.answerIntent, {
    text: "Answer",
    title: "This capture can appear in Answers Today."
  });
  assert.equal(result.sourceTimestampNudge.sourceChangedDraft.status, "Source changed");
  assert.match(result.sourceTimestampNudge.sourceChangedDraft.statusClass, /warn/);
  assert.match(result.sourceTimestampNudge.sourceChangedDraft.statusTitle, /RustConf ownership talk/);
  assert.match(result.sourceTimestampNudge.sourceChangedDraft.statusTitle, /Different lecture/);
  assert.equal(result.sourceTimestampNudge.sourceChangedDraft.reanchorHidden, false);
  assert.equal(result.sourceTimestampNudge.sourceChangedDraft.role, "status");
  assert.equal(result.sourceTimestampNudge.sourceChangedDraft.ariaLive, "polite");
  assert.equal(result.sourceTimestampNudge.sourceRestoredDraft.status, "Draft saved");
  assert.doesNotMatch(result.sourceTimestampNudge.sourceRestoredDraft.statusClass, /warn/);
  assert.equal(result.sourceTimestampNudge.sourceRestoredDraft.reanchorHidden, true);
  assert.equal(result.sourceTimestampNudge.sourceRestoredDraft.sourceUrlStored, "https://www.youtube.com/watch?v=rust123");
  assert.equal(result.sourceTimestampNudge.sourceReanchoredDraft.status, "Draft saved");
  assert.doesNotMatch(result.sourceTimestampNudge.sourceReanchoredDraft.statusClass, /warn/);
  assert.equal(result.sourceTimestampNudge.sourceReanchoredDraft.reanchorHidden, true);
  assert.equal(result.sourceTimestampNudge.sourceReanchoredDraft.activityTitle, "Draft source updated");
  assert.match(result.sourceTimestampNudge.sourceReanchoredDraft.activityDetail, /Different lecture/);
  assert.deepEqual(result.sourceTimestampNudge.sourceReanchorCleared, { status: "No draft", reanchorHidden: true });
  assert.match(result.todayDraftBeforeResume.listText, /Capture Drafts/);
  assert.match(result.todayDraftBeforeResume.text, /Draft quote before session switch/);
  assert.match(result.todayDraftBeforeResume.text, /device-local/);
  assert.match(result.todayDraftBeforeResume.text, /Not exported/);
  assert.equal(result.todayDraftBeforeResume.resumeText, "Resume");
  assert.deepEqual(result.todayDraftAfterResume, {
    activeTab: "captures",
    focusMode: true,
    activeElement: "quoteInput",
    activity: "Capture draft resumed"
  });
  assert.deepEqual(result.captureDraftStatusBeforeSwitch, { text: "Draft saved", clearHidden: false });
  assert.deepEqual(result.captureDraftStatusInNewSession, { text: "No draft", clearHidden: true });
  assert.equal(result.captureDraftNewSessionEmpty, true);
  assert.deepEqual(result.captureContextInNewSession, {
    target: "To New learning session",
    targetTitle: "Captures save to New learning session",
    intent: "Ready",
    source: "No source",
    timeHidden: true,
    openDisabled: false,
    openText: "Set source",
    openLabel: "Set source URL",
    activeElementAfterOpen: "sourceUrl",
    activityTitleAfterOpen: "Add a source",
    activityDetailAfterOpen: "Paste the browser page or video URL so captures can resume from it.",
    sourceStripPulsedAfterOpen: true,
    opened: ""
  });
  assert.equal(result.captureDraftAfterSwitch.quote, "Draft quote before session switch.");
  assert.equal(result.captureDraftAfterSwitch.thought, "Draft thought should survive.");
  assert.equal(result.captureDraftAfterSwitch.timestamp, "01:23");
  assert.equal(result.captureDraftAfterSwitch.persisted, true);
  assert.deepEqual(result.captureDraftStatusAfterSwitch, { text: "Draft saved", clearHidden: false });
  assert.deepEqual(result.captureDraftAfterClear, {
    quote: "",
    thought: "",
    timestamp: "",
    status: "No draft",
    clearHidden: true,
    persisted: false
  });
  assert.equal(result.captureDraftStaleBeforeImport, true);
  assert.equal(result.captureDraftPrunedAfterImport, true);
  assert.equal(result.captures, 3);
  assert.equal(result.cards, 2);
  assert.equal(result.captureMetric, "3");
  assert.equal(result.cardMetric, "2");
  assert.equal(result.dueBeforeGood, "2");
  assert.equal(result.gradeVisibleBeforeReveal, false);
  assert.equal(result.inspectorRevealVisible, true);
  assert.equal(result.deskReviewVisible, true);
  assert.match(result.deskReviewPrompt, /compiler-enforced lifetimes/);
  assert.equal(result.deskReviewGradeVisibleAfterInspectorReveal, true);
  assert.equal(result.deskPreservedInspectorReveal, true);
  assert.equal(result.deskReviewVisibleInSidecar, true);
  assert.equal(result.answerVisibleAfterReveal, true);
  assert.equal(result.dueMetric, "1");
  assert.equal(result.dueAfterGood, "1");
  assert.equal(result.gradedCount, 1);
  assert.equal(result.activityAfterCard.title, "Capture and card saved");
  assert.match(result.activityAfterCard.detail, /08:12/);
  assert.equal(result.activityAfterCard.action, "Review");
  assert.equal(result.activityAfterCard.openLinkText, "Open @ 08:12");
  assert.match(result.captureStackAfterCard.header, /Recent Stack/);
  assert.match(result.captureStackAfterCard.header, /1 shown · 1 total/);
  assert.equal(result.captureStackAfterCard.rows, 1);
  assert.match(result.captureStackAfterCard.text, /08:12/);
  assert.match(result.captureStackAfterCard.text, /compiler-enforced lifetimes/);
  assert.deepEqual(result.captureStackAfterCard.buttons, ["Open @ 08:12", "Note", "Review", "Delete + 1 card"]);
  assert.equal(result.captureStackAfterCard.reviewDisabled, false);
  assert.equal(result.captureStackReviewOpen.activeTab, "review");
  assert.equal(result.captureStackReviewOpen.focusMode, "review");
  assert.match(result.captureStackReviewOpen.deskReviewPrompt, /compiler-enforced lifetimes/);
  assert.equal(result.captureStackReviewOpen.activityTitle, "Review card opened");
  assert.equal(result.captureStackReviewOpen.activityAction, "Review");
  assert.match(result.focusBriefAfterCard.action, /Review 1 due card/);
  assert.match(result.focusBriefAfterCard.facts, /compiler-enforced lifetimes/);
  assert.match(result.focusBriefAfterCard.facts, /Active topic has due review due now/);
  assert.equal(result.focusBriefAfterCard.button, "Review");
  assert.match(result.focusBriefAfterGood.action, /Review 1 due card/);
  assert.match(result.focusBriefAfterGood.kicker, /1 due/);
  assert.equal(result.focusBriefAfterSynthesis.signals.includes("Synthesis due"), false);
  assert.match(result.focusBriefAfterSynthesis.facts, /Current/);
  assert.match(result.focusBriefAfterSynthesis.facts, /Active topic has due review due now/);
  assert.equal(result.todayActive, true);
  assert.equal(result.todayHasDueReview, true);
  assert.equal(result.todayHasRecentCapture, true);
  assert.equal(result.todayDueOpenLinkText, "Open @ 08:12");
  assert.equal(result.todayRecentOpenLinkText, "Open @ 08:12");
  assert.match(result.todayPrimary.text, /Next Move/);
  assert.match(result.todayPrimary.text, /Review 1 due card/);
  assert.equal(result.todayPrimary.action, "Review");
  assert.equal(result.todayPrimary.actionKind, "review");
  assert.equal(result.todayPrimary.inspect, "Due");
  assert.equal(result.todayPrimary.target, "due_review");
  assert.equal(result.todayMapButtons.some((button) => button.target === "due_review" && /Due/.test(button.text)), true);
  assert.equal(result.todayMapButtons.some((button) => button.target === "open_questions" && /Questions/.test(button.text)), true);
  assert.equal(result.todayMapButtons.some((button) => button.target === "answers_today" && /Answers/.test(button.text)), true);
  assert.equal(result.todayMapButtons.some((button) => button.target === "recent_captures" && /Recent/.test(button.text)), true);
  assert.equal(result.todayDetailDrawerOpenBefore, false);
  assert.match(result.todayDetailDrawerText, /Study Details/);
  assert.match(result.todayDetailDrawerText, /\d+ open/);
  assert.match(result.todayDetailDrawerText, /\d+ parked/);
  assert.match(result.todayDetailDrawerText, /\d+ recent/);
  assert.deepEqual(result.todayDetailJumpResults, [
    { target: "open_questions", open: true, pulsed: true },
    { target: "parked_questions", open: true, pulsed: true },
    { target: "answers_today", open: true, pulsed: true },
    { target: "closed_questions", open: true, pulsed: true },
    { target: "recent_captures", open: true, pulsed: true }
  ]);
  assert.equal(result.todayDetailDrawerOpenAfter, true);
  assert.equal(result.todayMapRecentPulsed, true);
  assert.deepEqual(result.emptyFallbackNudge, {
    timestamp: "07:57",
    contextTime: "@ 07:57",
    activityTitle: "Time adjusted",
    backLabel: "Back 15 seconds",
    forwardLabel: "Forward 15 seconds"
  });
  assert.deepEqual(result.invalidFallbackNudge, {
    timestamp: "08:27",
    contextTime: "@ 08:27",
    activityTitle: "Time adjusted"
  });
  assert.equal(result.noteInsertions, 2);
  assert.equal(result.noteHasSource, true);
  assert.ok(result.searchBeforeOpen.count >= 1);
  assert.equal(result.searchBeforeOpen.type, "Capture");
  assert.match(result.searchBeforeOpen.excerpt, /lifetime/);
  assert.equal(result.searchBeforeOpen.expanded, "true");
  assert.equal(result.searchBeforeOpen.activeDescendant, "search-result-0");
  assert.equal(result.searchBeforeOpen.activeSelected, "true");
  assert.equal(result.searchAfterOpen.activeTab, "captures");
  assert.equal(result.searchAfterOpen.activity, "Search result opened");
  assert.equal(result.searchAfterOpen.targetPulsed, true);
  assert.deepEqual(result.searchAfterFirstEscape, { value: "lifetime", hidden: true, expanded: "false" });
  assert.deepEqual(result.searchAfterSecondEscape, { value: "", hidden: true, expanded: "false" });
  assert.equal(result.activityOpenedReviewTab, "review");
  assert.equal(result.activityTargetPulsed, true);
  assert.deepEqual(result.backupNoticeAfterCapture, { hidden: false, text: "Local changes not exported" });
  assert.equal(result.backupNoticeAfterExport.hidden, false);
  assert.equal(result.backupNoticeAfterExport.text, "Backup requested - verify downloaded file");
  assert.match(result.backupNoticeAfterExport.fingerprint, /^[a-f0-9]{8}$/);
  assert.match(result.backupNoticeAfterExport.exportedAt, /^20/);
  assert.deepEqual(result.captureDraftStatusAfterCard, {
    text: "Time kept",
    clearHidden: false,
    statusClass: "save-state capture-draft-status",
    statusTitle: ""
  });
  assert.equal(result.sourceJumpOpened, "https://www.youtube.com/watch?v=rust123&t=492s");
  assert.equal(result.activityAfterSynthesis, "Synthesis inserted");
  assert.match(result.captureText, /Ownership lets Rust/);
  assert.match(result.reviewText, /Spaced repetition improves/);
  assert.equal(result.synthesisVisible, true);
  assert.equal(result.manualDraftAfterCancel, "manual synthesis survives");
  assert.match(result.staleStatus, /Source changed/);
  assert.match(result.synthesisDraft, /Synthesis - Learning Companion MVP/);
  assert.match(result.synthesisDraft, /Generated from 3 captures \/ 0 questions \/ 2 cards/);
  assert.match(result.synthesisDraft, /Spaced repetition improves/);
  assert.match(result.synthesisDraft, /A later capture changes/);
  assert.equal(result.synthesisOccurrences, 1);
  assert.match(result.notesMarkdown, /Synthesis - Learning Companion MVP/);
  assert.match(result.latestPrompt, /____/);
  assert.match(result.latestAnswer, /durable/);
  assert.match(result.previewText, /Learning Companion MVP/);
  assert.match(result.previewText, /Synthesis - Learning Companion MVP/);
  assert.equal(result.hasScriptNode, false);
  assert.equal(result.hasBoldNode, false);
  assert.match(result.bookmarklet, /^javascript:/);
  assert.match(result.bookmarklet, /127\.0\.0\.1/);
  assert.match(result.bookmarklet, /currentTime/);
  assert.equal(result.workspaceExportSchema, "learning-companion.workspace.v1");
  assert.equal(result.workspaceExportSessions, 1);
  assert.equal(result.workspaceExportActiveSession, "Learning Companion MVP");
  assert.match(result.reviewPackExport, /Learning Companion Review Pack/);
  assert.match(result.reviewPackExport, /Scope: local MVP fixture\/internal build/);
  assert.match(result.reviewPackExport, /Why: Active topic has due review due now/);
  assert.match(result.reviewPackExport, /Feishu: local mirror bundle plus upload plan\/dry-run boundary/);
  assert.match(result.reviewPackExport, /HarmonyOS: schema reader prototype/);
  assert.match(result.reviewPackExport, /Separate permissioned gates/);
  assert.match(result.reviewPackExport, /npm run check:morning/);
  assert.match(result.reviewPackExport, /npm run check:morning:browser/);
  assert.equal(result.workspaceDetailsCollapsed, true);
  assert.match(result.workspaceExportNote, /not cloud sync or Feishu upload/);
  assert.deepEqual(result.exportSections, [
    "Full Workspace (all sessions)",
    "Review Pack",
    "Current Session",
    "Mirror Folder",
    "Browser Capture"
  ]);
  assert.equal(result.hasWorkspaceExportButtons, true);
  assert.equal(result.hasReviewPackButtons, true);
  assert.equal(result.nativeBridgeExportSchema, "learning-companion.workspace.v1");
  assert.equal(result.nativeBridgeImportOk, true);
  assert.equal(result.nativeBridgeReviewPatchOk, true);
  assert.equal(result.nativeBridgeReviewPatchKind, "review-progress-patch");
  assert.equal(result.nativeBridgeReviewPatchMissing, 1);
  assert.equal(result.nativeBridgeInboxPatchOk, true);
  assert.equal(result.nativeBridgeInboxPatchKind, "mobile-inbox-patch");
  assert.equal(result.nativeBridgeInboxPatchAdded, 1);
  assert.match(result.nativeBridgeInboxReceiptText, /Mobile inbox imported/);
  assert.match(result.nativeBridgeInboxReceiptText, /1 added/);
  assert.equal(result.nativeBridgeBadPatchOk, false);
  assert.match(result.nativeBridgeBadPatchError, /Unsupported mobile inbox patch schema/);
  assert.equal(result.nativeBridgeRestoreAfterPatchOk, true);
  assert.equal(result.nativeBridgeRoundTripSchema, "learning-companion.workspace.v1");
  assert.equal(result.nativeBridgeRoundTripSessions, 1);
  assert.equal(typeof result.nativeBridgeRoundTripActiveId, "string");
  assert.equal(result.nativeSidecarOnOk, true);
  assert.equal(result.nativeSidecarClassOn, true);
  assert.equal(result.nativeSidecarOffOk, true);
  assert.equal(result.nativeSidecarClassOff, false);
  assert.equal(result.hasTodayExportButtons, true);
  assert.match(result.todayExport, /Today Study Pack/);
  assert.match(result.todayExport, /Generated from workspace\.json/);
  assert.equal(result.hasMirrorZipButton, true);
  assert.equal(result.mirrorSchema, "learning-companion.mirror-bundle.staging.v1");
  assert.equal(result.mirrorFileCount, 8);
  assert.equal(result.mirrorCanonical, "workspace.json");
  assert.match(result.mirrorBundleFingerprint, /^fnv1a-[a-f0-9]{8}$/);
  assert.equal(result.mirrorHasIndex, true);
  assert.match(result.mirrorIndexHtml, /Manual Return/);
  assert.match(result.mirrorIndexHtml, /Read Today/);
  assert.match(result.mirrorIndexHtml, /Work here/);
  assert.match(result.mirrorIndexHtml, /Return JSON back to Mac/);
  assert.match(result.mirrorIndexHtml, /Today &gt; Return Files/);
  assert.equal(result.mirrorHasWorkspace, true);
  assert.equal(result.mirrorHasToday, true);
  assert.equal(result.mirrorHasReviewHtml, true);
  assert.match(result.mirrorReviewHtml, /learning-companion\.review-progress-patch\.v1/);
  assert.match(result.mirrorReviewHtml, /Return to Mac/);
  assert.match(result.mirrorReviewHtml, /Save Return JSON/);
  assert.equal(result.mirrorHasInboxHtml, true);
  assert.match(result.mirrorInboxHtml, /Learning Companion Inbox/);
  assert.match(result.mirrorInboxHtml, /Return to Mac/);
  assert.match(result.mirrorInboxHtml, /Save Return JSON/);
  assert.equal(result.mirrorTodayEscapesScript, true);
  assert.equal(result.mirrorReviewEscapesScript, true);
  assert.equal(result.mirrorHasMarkdown, true);
  assert.equal(result.mirrorHasTimeJump, true);
  assert.equal(result.mirrorFingerprintsValid, true);
  assert.equal(result.schemaVersion, 1);
  assert.match(result.clientId, /^client_/);

  const mirrorSaveReceipt = await cdp.evaluate(`(() => new Promise((resolve) => {
    document.querySelector('[data-tab="export"]').click();
    const mirrorExportBeforeSave = document.querySelector("#mirrorExport").value;
    document.querySelector("#downloadMirrorBtn").click();
    setTimeout(() => {
      document.querySelector('[data-tab="today"]').click();
      const prefs = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}");
      resolve({
        activityTitle: document.querySelector("#activityTitle").textContent,
        activityDetail: document.querySelector("#activityDetail").textContent,
        toast: document.querySelector("#toast").textContent,
        handoffText: document.querySelector(".handoff-card")?.textContent || "",
        mirrorHandoffKind: prefs.mirrorHandoff?.kind || "",
        mirrorHandoffHasFingerprint: /^fnv1a-[a-f0-9]{8}$/.test(prefs.mirrorHandoff?.returnBaseFingerprint || ""),
        mirrorExportLeaksHandoff: mirrorExportBeforeSave.includes("mirrorHandoff")
      });
    }, 20);
  }))()`);
  assert.equal(mirrorSaveReceipt.activityTitle, "Mirror JSON handoff ready");
  assert.equal(mirrorSaveReceipt.activityDetail, "Move the Mirror JSON through USB, AirDrop, email, file share, or a manual Feishu Drive upload; then use inbox.html or review.html to create a return JSON.");
  assert.equal(mirrorSaveReceipt.toast, "Mirror download requested");
  assert.match(mirrorSaveReceipt.handoffText, /Mirror current/);
  assert.match(mirrorSaveReceipt.handoffText, /Waiting for return file/);
  assert.equal(mirrorSaveReceipt.mirrorHandoffKind, "Mirror JSON");
  assert.equal(mirrorSaveReceipt.mirrorHandoffHasFingerprint, true);
  assert.equal(mirrorSaveReceipt.mirrorExportLeaksHandoff, false);

  const exceptionsBeforeReviewRuntime = exceptions.length;
  virtualRoutes.set("/mirror-review.html", result.mirrorReviewHtml);
  await cdp.send("Page.navigate", { url: `${appUrl}mirror-review.html` });
  await sleep(300);
  const reviewRuntime = await cdp.evaluate(`(async () => {
    const beforeUnloadPrevented = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    document.querySelector('[data-reveal]')?.click();
    document.querySelector('[data-grade="good"]')?.click();
    const preview = JSON.parse(document.querySelector("#progressPreview").textContent);
    const readyStatus = document.querySelector("#progressStatus").textContent;
    document.querySelector("#selectProgressBtn").click();
    const selectedReturnJson = window.getSelection().toString();
    const selectedStatus = document.querySelector("#progressStatus").textContent;
    const dirtyBeforeSave = beforeUnloadPrevented();
    let downloadName = "";
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { downloadName = this.download; };
    try {
      document.querySelector("#downloadProgressBtn").click();
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    return {
      heading: document.querySelector("h1").textContent,
      answerVisible: !document.querySelector(".answer").hidden,
      status: readyStatus,
      selectedStatus,
      selectedReturnJsonIncludesSchema: selectedReturnJson.includes('"schema": "learning-companion.review-progress-patch.v1"'),
      savedStatus: document.querySelector("#progressStatus").textContent,
      returnFileHint: document.querySelector("#returnFileHint").textContent,
      downloadName,
      dirtyBeforeSave,
      dirtyAfterSave: beforeUnloadPrevented(),
      state: document.querySelector(".review-state").textContent,
      previewSchema: preview.schema,
      previewEventCount: preview.events.length,
      previewGrade: preview.events[0]?.grade || "",
      hasBaseUpdatedAt: Boolean(preview.events[0]?.baseUpdatedAt),
      storageKey: Object.keys(localStorage).find((key) => key.startsWith("learning-companion.review-progress.")) || ""
    };
  })()`);

  assert.equal(exceptions.length, exceptionsBeforeReviewRuntime);
  assert.equal(reviewRuntime.heading, "Learning Companion Review Pack");
  assert.equal(reviewRuntime.answerVisible, true);
  assert.match(reviewRuntime.status, /1 review event/);
  assert.match(reviewRuntime.selectedStatus, /Return JSON selected/);
  assert.equal(reviewRuntime.selectedReturnJsonIncludesSchema, true);
  assert.match(reviewRuntime.savedStatus, /Return JSON download requested/);
  assert.match(reviewRuntime.returnFileHint, /^Suggested file: learning-companion-review-progress-patch-\d{8}-\d{4}-[a-zA-Z0-9_-]{1,8}\.json$/);
  assert.match(reviewRuntime.downloadName, /^learning-companion-review-progress-patch-\d{8}-\d{4}-[a-zA-Z0-9_-]{1,8}\.json$/);
  assert.equal(reviewRuntime.downloadName, reviewRuntime.returnFileHint.replace("Suggested file: ", ""));
  assert.equal(reviewRuntime.dirtyBeforeSave, true);
  assert.equal(reviewRuntime.dirtyAfterSave, false);
  assert.equal(reviewRuntime.state, "Marked good");
  assert.equal(reviewRuntime.previewSchema, "learning-companion.review-progress-patch.v1");
  assert.equal(reviewRuntime.previewEventCount, 1);
  assert.equal(reviewRuntime.previewGrade, "good");
  assert.equal(reviewRuntime.hasBaseUpdatedAt, true);
  assert.match(reviewRuntime.storageKey, /^learning-companion\.review-progress\./);

  const reviewGuardDownloadCountBefore = readdirSync(downloadPath).length;
  virtualRoutes.set("/mirror-review-guard.html", result.mirrorReviewHtml);
  await cdp.send("Page.navigate", { url: `${appUrl}mirror-review-guard.html` });
  await sleep(300);
  const reviewGuardRuntime = await cdp.evaluate(`(async () => {
    window.__LC_ALLOW_AUTOMATED_DOWNLOADS__ = false;
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true });
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
    const beforeUnloadPrevented = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    document.querySelector('[data-reveal]')?.click();
    document.querySelector('[data-grade="good"]')?.click();
    let downloadName = "";
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { downloadName = this.download; };
    try {
      document.querySelector("#downloadProgressBtn").click();
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    return {
      status: document.querySelector("#progressStatus").textContent,
      downloadName,
      dirtyAfterBlockedSave: beforeUnloadPrevented()
    };
  })()`);
  const reviewGuardDownloadCountAfter = readdirSync(downloadPath).length;
  assert.equal(reviewGuardRuntime.downloadName, "");
  assert.match(reviewGuardRuntime.status, /Save picker unavailable here/);
  assert.equal(reviewGuardRuntime.dirtyAfterBlockedSave, true);
  assert.equal(reviewGuardDownloadCountAfter, reviewGuardDownloadCountBefore);

  const exceptionsBeforeInboxRuntime = exceptions.length;
  virtualRoutes.set("/mirror-inbox.html", result.mirrorInboxHtml);
  await cdp.send("Page.navigate", { url: `${appUrl}mirror-inbox.html` });
  await sleep(300);
  const inboxRuntime = await cdp.evaluate(`(async () => {
    const beforeUnloadPrevented = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    setValue("#quoteInput", "Static inbox quote from phone.");
    setValue("#thoughtInput", "This should become an append-only patch.");
    setValue("#timestampInput", "10:15");
    setValue("#tagsInput", "phone, mirror");
    setValue("#sourceTitleInput", "HarmonyOS browser");
    setValue("#sourceUrlInput", "javascript:alert(1)");
    document.querySelector("#addCaptureBtn").click();
    const preview = JSON.parse(document.querySelector("#patchPreview").textContent);
    const readyStatus = document.querySelector("#statusOutput").textContent;
    document.querySelector("#selectPatchBtn").click();
    const selectedReturnJson = window.getSelection().toString();
    const selectedStatus = document.querySelector("#statusOutput").textContent;
    const storageKey = Object.keys(localStorage).find((key) => key.startsWith("learning-companion.inbox.") && !key.endsWith(".return-file"));
    const storedDrafts = storageKey ? JSON.parse(localStorage.getItem(storageKey) || "[]") : [];
    const dirtyBeforeSave = beforeUnloadPrevented();
    let downloadName = "";
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { downloadName = this.download; };
    try {
      document.querySelector("#downloadPatchBtn").click();
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    return {
      heading: document.querySelector("h1").textContent,
      topicOptions: document.querySelectorAll("#topicSelect option").length,
      selectedTopicId: document.querySelector("#topicSelect").value,
      selectedTopicTitle: document.querySelector("#topicSelect option:checked")?.textContent || "",
      status: readyStatus,
      selectedStatus,
      selectedReturnJsonIncludesSchema: selectedReturnJson.includes('"schema": "learning-companion.mobile-inbox-patch.v1"'),
      draftCount: document.querySelectorAll("#draftList .capture").length,
      previewSchema: preview.schema,
      previewTargetTitle: preview.target.topicTitle,
      previewCaptureCount: preview.captures.length,
      previewQuote: preview.captures[0]?.quote || "",
      previewThought: preview.captures[0]?.thought || "",
      previewSourceUrl: preview.captures[0]?.sourceUrl || "",
      storedDraftCount: storedDrafts.length,
      savedStatus: document.querySelector("#statusOutput").textContent,
      returnFileHint: document.querySelector("#returnFileHint").textContent,
      downloadName,
      dirtyBeforeSave,
      dirtyAfterSave: beforeUnloadPrevented()
    };
  })()`);

  assert.equal(exceptions.length, exceptionsBeforeInboxRuntime);
  assert.equal(inboxRuntime.heading, "Learning Companion Inbox");
  assert.ok(inboxRuntime.topicOptions >= 1);
  assert.notEqual(inboxRuntime.selectedTopicId, "");
  assert.equal(inboxRuntime.status, "Capture added to patch draft. Save Return JSON when ready.");
  assert.match(inboxRuntime.selectedStatus, /Return JSON selected/);
  assert.equal(inboxRuntime.selectedReturnJsonIncludesSchema, true);
  assert.match(inboxRuntime.savedStatus, /Return JSON download requested/);
  assert.match(inboxRuntime.returnFileHint, /^Suggested file: learning-companion-inbox-patch-\d{8}-\d{4}-[a-zA-Z0-9_-]{1,8}\.json$/);
  assert.match(inboxRuntime.downloadName, /^learning-companion-inbox-patch-\d{8}-\d{4}-[a-zA-Z0-9_-]{1,8}\.json$/);
  assert.equal(inboxRuntime.downloadName, inboxRuntime.returnFileHint.replace("Suggested file: ", ""));
  assert.equal(inboxRuntime.dirtyBeforeSave, true);
  assert.equal(inboxRuntime.dirtyAfterSave, false);
  assert.equal(inboxRuntime.draftCount, 1);
  assert.equal(inboxRuntime.previewSchema, "learning-companion.mobile-inbox-patch.v1");
  assert.equal(inboxRuntime.previewCaptureCount, 1);
  assert.equal(inboxRuntime.previewQuote, "Static inbox quote from phone.");
  assert.equal(inboxRuntime.previewThought, "This should become an append-only patch.");
  assert.equal(inboxRuntime.previewSourceUrl, "");
  assert.equal(inboxRuntime.storedDraftCount, 1);

  const inboxAnswerParams = new URLSearchParams({
    topicId: inboxRuntime.selectedTopicId,
    quote: "What should I answer from the mirror?",
    thought: "Answer:",
    answerToCaptureId: "capture_question_runtime",
    timestamp: "12:34",
    tags: "question, answer",
    sourceTitle: "Mirror question preview",
    sourceUrl: "javascript:alert(1)"
  });
  await cdp.send("Page.navigate", { url: `${appUrl}mirror-inbox.html?${inboxAnswerParams}` });
  await sleep(300);
  const inboxAnswerRuntime = await cdp.evaluate(`(() => ({
    status: document.querySelector("#statusOutput").textContent,
    selectedTopicId: document.querySelector("#topicSelect").value,
    selectedTopicTitle: document.querySelector("#topicSelect option:checked")?.textContent || "",
    quote: document.querySelector("#quoteInput").value,
    thought: document.querySelector("#thoughtInput").value,
    timestamp: document.querySelector("#timestampInput").value,
    tags: document.querySelector("#tagsInput").value,
    sourceTitle: document.querySelector("#sourceTitleInput").value,
    sourceUrl: document.querySelector("#sourceUrlInput").value
  }))()`);

  assert.equal(inboxAnswerRuntime.status, "Answer draft loaded from mirror link.");
  assert.equal(inboxAnswerRuntime.selectedTopicId, inboxRuntime.selectedTopicId);
  assert.equal(inboxAnswerRuntime.selectedTopicTitle, inboxRuntime.selectedTopicTitle);
  assert.equal(inboxAnswerRuntime.quote, "What should I answer from the mirror?");
  assert.equal(inboxAnswerRuntime.thought, "Answer:");
  assert.equal(inboxAnswerRuntime.timestamp, "12:34");
  assert.equal(inboxAnswerRuntime.tags, "question, answer");
  assert.equal(inboxAnswerRuntime.sourceTitle, "Mirror question preview");
  assert.equal(inboxAnswerRuntime.sourceUrl, "");
  const inboxAnswerPatchRuntime = await cdp.evaluate(`(() => {
    document.querySelector("#addCaptureBtn").click();
    const preview = JSON.parse(document.querySelector("#patchPreview").textContent);
    const capture = preview.captures.find((item) => item.quote === "What should I answer from the mirror?");
    return {
      status: document.querySelector("#statusOutput").textContent,
      answersQuestionCaptureId: capture?.answersQuestionCaptureId || ""
    };
  })()`);
  assert.equal(inboxAnswerPatchRuntime.status, "Capture added to patch draft. Save Return JSON when ready.");
  assert.equal(inboxAnswerPatchRuntime.answersQuestionCaptureId, "capture_question_runtime");

  const hostileMirrorQuote = `Can inbox prefill keep <script>alert("x")</script> & #hash ?q=1 emoji 😀 RTL שלום ${"x".repeat(1024)}?`;
  const hostileInboxParams = new URLSearchParams({
    topicId: "missing_mirror_topic",
    quote: hostileMirrorQuote,
    thought: "Answer:",
    timestamp: "13:37",
    tags: "question, hostile, answer",
    sourceTitle: "Mirror hostile question",
    sourceUrl: "javascript:alert(1)"
  });
  await cdp.send("Page.navigate", { url: `${appUrl}mirror-inbox.html?${hostileInboxParams}` });
  await sleep(300);
  const hostileInboxRuntime = await cdp.evaluate(`(() => {
    const preAdd = {
      status: document.querySelector("#statusOutput").textContent,
      selectedTopicId: document.querySelector("#topicSelect").value,
      quoteField: document.querySelector("#quoteInput").value,
      sourceUrlField: document.querySelector("#sourceUrlInput").value
    };
    document.querySelector("#addCaptureBtn").click();
    const preview = JSON.parse(document.querySelector("#patchPreview").textContent);
    const capture = preview.captures.find((item) => item.quote.includes("Can inbox prefill keep"));
    return {
      preAdd,
      status: document.querySelector("#statusOutput").textContent,
      selectedTopicId: document.querySelector("#topicSelect").value,
      quoteField: document.querySelector("#quoteInput").value,
      captureQuote: capture?.quote || "",
      captureThought: capture?.thought || "",
      captureTags: capture?.tags || "",
      captureSourceTitle: capture?.sourceTitle || "",
      captureSourceUrl: capture?.sourceUrl || "",
      captureAnswersQuestionCaptureId: capture?.answersQuestionCaptureId || ""
    };
  })()`);

  assert.equal(hostileInboxRuntime.preAdd.status, "Answer draft loaded with active topic; original topic was not found.");
  assert.equal(hostileInboxRuntime.preAdd.selectedTopicId, inboxRuntime.selectedTopicId);
  assert.equal(hostileInboxRuntime.preAdd.quoteField, hostileMirrorQuote);
  assert.equal(hostileInboxRuntime.preAdd.sourceUrlField, "");
  assert.equal(hostileInboxRuntime.status, "Capture added to patch draft. Save Return JSON when ready.");
  assert.equal(hostileInboxRuntime.selectedTopicId, inboxRuntime.selectedTopicId);
  assert.equal(hostileInboxRuntime.quoteField, "");
  assert.equal(hostileInboxRuntime.captureQuote, hostileMirrorQuote);
  assert.equal(hostileInboxRuntime.captureThought, "Answer:");
  assert.equal(hostileInboxRuntime.captureTags, "question, hostile, answer");
  assert.equal(hostileInboxRuntime.captureSourceTitle, "Mirror hostile question");
  assert.equal(hostileInboxRuntime.captureSourceUrl, "");
  assert.equal(hostileInboxRuntime.captureAnswersQuestionCaptureId, "");

  await cdp.evaluate(`document.querySelector("#clearDraftsBtn")?.click()`);
  await cdp.evaluate(`(() => {
    const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
    const template = workspace.sessions.find((item) => item.title === "Learning Companion MVP") || workspace.sessions[0];
    const decoy = {
      ...template,
      id: "smoke_decoy_session",
      title: "Scratch decoy",
      sourceTitle: "External course page",
      sourceUrl: "https://example.com/scratch",
      materialType: "article",
      notesMarkdown: "",
      captures: [],
      reviewCards: [],
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    workspace.sessions = [
      decoy,
      ...workspace.sessions.filter((item) => item.id !== decoy.id)
    ];
    workspace.activeSessionId = decoy.id;
    localStorage.setItem("learning-companion.workspace.v1", JSON.stringify(workspace));
  })()`);
  const matchedInboundUrl = `${appUrl}?capture=1&sourceTitle=${encodeURIComponent("Changed browser title")}&sourceUrl=${encodeURIComponent("https://www.youtube.com/watch?v=rust123&t=42s&utm_source=clip")}&quote=${encodeURIComponent("Matched source bookmarklet capture")}&thought=${encodeURIComponent("Should route away from the decoy session")}&t=00:42`;
  await cdp.send("Page.navigate", { url: "about:blank" });
  await sleep(100);
  await cdp.send("Page.navigate", { url: matchedInboundUrl });
  await sleep(300);
  const matchedInbound = await waitForCdpValue(cdp, `(() => {
    const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
    const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
    const decoy = workspace.sessions.find((item) => item.title === "Scratch decoy");
    const latest = session.captures[0] || {};
    return {
      href: location.href,
      search: location.search,
      readyState: document.readyState,
      activeTitle: session.title,
      activeMaterialType: session.materialType,
      sessionSourceTitle: session.sourceTitle,
      sessionSourceUrl: session.sourceUrl,
      latestQuote: latest.quote || "",
      latestTimestamp: latest.timestamp || "",
      latestSourceTitle: latest.sourceTitle || "",
      latestSourceUrl: latest.sourceUrl || "",
      decoyCaptures: decoy?.captures.length || 0,
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent,
      activeTab: document.querySelector(".tab.active")?.dataset.tab || ""
    };
  })()`, (value) => value.latestQuote === "Matched source bookmarklet capture", 10000);

  assert.equal(matchedInbound.activeTitle, "Learning Companion MVP");
  assert.equal(matchedInbound.activeMaterialType, "video");
  assert.equal(matchedInbound.sessionSourceTitle, "RustConf ownership talk");
  assert.equal(matchedInbound.sessionSourceUrl, "https://www.youtube.com/watch?v=rust123");
  assert.equal(matchedInbound.latestQuote, "Matched source bookmarklet capture");
  assert.equal(matchedInbound.latestTimestamp, "00:42");
  assert.equal(matchedInbound.latestSourceTitle, "Changed browser title");
  assert.equal(matchedInbound.latestSourceUrl, "https://www.youtube.com/watch?v=rust123&utm_source=clip");
  assert.equal(matchedInbound.decoyCaptures, 0);
  assert.equal(matchedInbound.activityTitle, "Browser capture saved");
  assert.match(matchedInbound.activityDetail, /matched existing source URL/);
  assert.equal(matchedInbound.activeTab, "captures");

  const inboundUrl = `${appUrl}?capture=1&sourceTitle=${encodeURIComponent("External course page")}&sourceUrl=${encodeURIComponent("https://example.com/course")}&quote=${encodeURIComponent("Inbound bookmarklet capture")}&thought=${encodeURIComponent("Turn this into a note")}&t=01:02:03`;
  await cdp.send("Page.navigate", { url: inboundUrl });
  await sleep(300);
  const inbound = await cdp.evaluate(`(() => {
    const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
    const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
    return {
      sourceTitle: session.sourceTitle,
      sourceUrl: session.sourceUrl,
      captureMetric: document.querySelector("#captureMetric").textContent,
      latestQuote: session.captures[0].quote,
      latestThought: session.captures[0].thought,
      latestTimestamp: session.captures[0].timestamp,
      latestSourceTitle: session.captures[0].sourceTitle,
      latestSourceUrl: session.captures[0].sourceUrl,
      latestSourceProvenance: session.captures[0].sourceProvenance,
      decoyCaptures: workspace.sessions.find((item) => item.title === "Scratch decoy")?.captures.length || 0,
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent,
      locationSearch: window.location.search
    };
  })()`);

  assert.equal(inbound.sourceTitle, "External course page");
  assert.equal(inbound.sourceUrl, "https://example.com/course");
  assert.equal(inbound.captureMetric, "7");
  assert.equal(inbound.latestQuote, "Inbound bookmarklet capture");
  assert.equal(inbound.latestThought, "Turn this into a note");
  assert.equal(inbound.latestTimestamp, "01:02:03");
  assert.equal(inbound.latestSourceTitle, "External course page");
  assert.equal(inbound.latestSourceUrl, "https://example.com/course");
  assert.equal(inbound.latestSourceProvenance, "inbound");
  assert.equal(inbound.decoyCaptures, 0);
  assert.equal(inbound.activityTitle, "Browser capture saved");
  assert.match(inbound.activityDetail, /01:02:03/);
  assert.equal(inbound.locationSearch, "");

  const stagedCollisionUrl = `${appUrl}?sourceTitle=${encodeURIComponent("External course page")}&quote=${encodeURIComponent("Staged title collision clip")}&thought=${encodeURIComponent("Should stay on the active topic")}&t=00:07`;
  await cdp.send("Page.navigate", { url: stagedCollisionUrl });
  await sleep(300);
  const stagedCollision = await cdp.evaluate(`(() => {
    const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
    const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
    const decoy = workspace.sessions.find((item) => item.title === "Scratch decoy");
    return {
      activeTitle: session.title,
      quoteValue: document.querySelector("#quoteInput").value,
      thoughtValue: document.querySelector("#thoughtInput").value,
      timestampValue: document.querySelector("#timestampInput").value,
      decoyCaptures: decoy?.captures.length || 0,
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent
    };
  })()`);

  assert.equal(stagedCollision.activeTitle, "Learning Companion MVP");
  assert.equal(stagedCollision.quoteValue, "Staged title collision clip");
  assert.equal(stagedCollision.thoughtValue, "Should stay on the active topic");
  assert.equal(stagedCollision.timestampValue, "00:07");
  assert.equal(stagedCollision.decoyCaptures, 0);
  assert.equal(stagedCollision.activityTitle, "Browser clip staged");
  assert.match(stagedCollision.activityDetail, /current topic/);

  const urlWithTitleCollision = `${appUrl}?sourceTitle=${encodeURIComponent("External course page")}&sourceUrl=${encodeURIComponent("https://example.com/not-the-scratch-source")}&quote=${encodeURIComponent("URL should block title fallback")}&capture=1`;
  await cdp.send("Page.navigate", { url: urlWithTitleCollision });
  await sleep(300);
  const urlTitleCollision = await cdp.evaluate(`(() => {
    const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
    const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
    const decoy = workspace.sessions.find((item) => item.title === "Scratch decoy");
    return {
      activeTitle: session.title,
      activeSourceUrl: session.sourceUrl,
      latestQuote: session.captures[0]?.quote || "",
      decoyCaptures: decoy?.captures.length || 0,
      activityDetail: document.querySelector("#activityDetail").textContent
    };
  })()`);

  assert.equal(urlTitleCollision.activeTitle, "Learning Companion MVP");
  assert.equal(urlTitleCollision.activeSourceUrl, "https://example.com/not-the-scratch-source");
  assert.equal(urlTitleCollision.latestQuote, "URL should block title fallback");
  assert.equal(urlTitleCollision.decoyCaptures, 0);
  assert.match(urlTitleCollision.activityDetail, /no matching topic/);

  await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    document.querySelector("#newSessionBtn").click();
    setValue("#sessionTitle", "Title-only target");
    setValue("#sourceTitle", "Loose paper");
    setValue("#sourceUrl", "");
    document.querySelector("#newSessionBtn").click();
    setValue("#sessionTitle", "Active staging decoy");
    setValue("#sourceTitle", "Active source");
    setValue("#sourceUrl", "https://example.com/active");
  })()`);
  const stagedMatchedUrl = `${appUrl}?sourceTitle=${encodeURIComponent("Loose paper")}&quote=${encodeURIComponent("Staged title-only clip")}&thought=${encodeURIComponent("Do not auto-save this")}&t=00:11`;
  await cdp.send("Page.navigate", { url: stagedMatchedUrl });
  await sleep(300);
  const stagedMatched = await cdp.evaluate(`(() => {
    const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
    const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
    return {
      activeTitle: session.title,
      captureCount: session.captures.length,
      quoteValue: document.querySelector("#quoteInput").value,
      thoughtValue: document.querySelector("#thoughtInput").value,
      timestampValue: document.querySelector("#timestampInput").value,
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent
    };
  })()`);

  assert.equal(stagedMatched.activeTitle, "Title-only target");
  assert.equal(stagedMatched.captureCount, 0);
  assert.equal(stagedMatched.quoteValue, "Staged title-only clip");
  assert.equal(stagedMatched.thoughtValue, "Do not auto-save this");
  assert.equal(stagedMatched.timestampValue, "00:11");
  assert.equal(stagedMatched.activityTitle, "Browser clip staged");
  assert.match(stagedMatched.activityDetail, /matched existing source title/);

  await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    document.querySelector("#newSessionBtn").click();
    setValue("#sessionTitle", "Query order target");
    setValue("#sourceTitle", "Deep link article");
    setValue("#sourceUrl", "https://example.com/deep?a=1&b=2");
    document.querySelector("#newSessionBtn").click();
    setValue("#sessionTitle", "Query order decoy");
    setValue("#sourceTitle", "Query decoy");
    setValue("#sourceUrl", "https://example.com/query-decoy");
  })()`);
  const queryOrderInboundUrl = `${appUrl}?capture=1&sourceTitle=${encodeURIComponent("Deep link article")}&sourceUrl=${encodeURIComponent("https://example.com/deep?b=2&a=1&UTM_Source=clip")}&quote=${encodeURIComponent("Query order matched capture")}&thought=${encodeURIComponent("Query order should not break source matching")}`;
  await cdp.send("Page.navigate", { url: queryOrderInboundUrl });
  await sleep(300);
  const queryOrderInbound = await cdp.evaluate(`(() => {
    const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
    const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
    const decoy = workspace.sessions.find((item) => item.title === "Query order decoy");
    return {
      activeTitle: session.title,
      sessionSourceUrl: session.sourceUrl,
      latestQuote: session.captures[0]?.quote || "",
      decoyCaptures: decoy?.captures.length || 0,
      activityDetail: document.querySelector("#activityDetail").textContent
    };
  })()`);

  assert.equal(queryOrderInbound.activeTitle, "Query order target");
  assert.equal(queryOrderInbound.sessionSourceUrl, "https://example.com/deep?a=1&b=2");
  assert.equal(queryOrderInbound.latestQuote, "Query order matched capture");
  assert.equal(queryOrderInbound.decoyCaptures, 0);
  assert.match(queryOrderInbound.activityDetail, /matched existing source URL/);

  const bookmarkletSource = result.bookmarklet.replace(/^javascript:/, "");
  virtualRoutes.set("/external-video.html", `<!doctype html>
<html>
  <head><title>Runtime Bookmarklet Video</title></head>
  <body>
    <main>
      <h1>Runtime Bookmarklet Video</h1>
      <p id="selected-quote">Virtual video selected sentence.</p>
      <video id="runtime-video"></video>
    </main>
  </body>
</html>`);
  await cdp.send("Page.navigate", { url: `${appUrl}external-video.html` });
  await sleep(200);
  const openedVideoCaptureUrl = await cdp.evaluate(`(() => {
    window.__openedLearningCompanionUrl = "";
    window.open = (url) => {
      window.__openedLearningCompanionUrl = String(url);
      return null;
    };
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(document.querySelector("#selected-quote"));
    selection.removeAllRanges();
    selection.addRange(range);
    const video = document.querySelector("#runtime-video");
    try {
      Object.defineProperty(video, "currentTime", { value: 125, configurable: true });
    } catch {
      try { video.currentTime = 125; } catch {}
    }
    eval(${JSON.stringify(bookmarkletSource)});
    return window.__openedLearningCompanionUrl;
  })()`);
  const parsedVideoCaptureUrl = new URL(openedVideoCaptureUrl);
  assert.equal(parsedVideoCaptureUrl.origin, new URL(appUrl).origin);
  assert.equal(parsedVideoCaptureUrl.pathname, "/");
  assert.equal(parsedVideoCaptureUrl.searchParams.get("capture"), "1");
  assert.equal(parsedVideoCaptureUrl.searchParams.get("sourceTitle"), "Runtime Bookmarklet Video");
  assert.equal(parsedVideoCaptureUrl.searchParams.get("sourceUrl"), `${appUrl}external-video.html`);
  assert.equal(parsedVideoCaptureUrl.searchParams.get("quote"), "Virtual video selected sentence.");
  assert.equal(parsedVideoCaptureUrl.searchParams.get("t"), "00:02:05");

  await cdp.send("Page.navigate", { url: openedVideoCaptureUrl });
  await sleep(300);
  const runtimeVideoCapture = await waitForCdpValue(cdp, `(() => {
    const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
    const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
    const latest = session.captures[0] || {};
    return {
      activeTitle: session.title,
      sourceTitle: session.sourceTitle,
      sourceUrl: session.sourceUrl,
      latestQuote: latest.quote || "",
      latestTimestamp: latest.timestamp || "",
      latestSourceTitle: latest.sourceTitle || "",
      latestSourceUrl: latest.sourceUrl || "",
      latestSourceProvenance: latest.sourceProvenance || "",
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent
    };
  })()`, (value) => value.latestQuote === "Virtual video selected sentence.");

  assert.equal(runtimeVideoCapture.activeTitle, "Query order target");
  assert.equal(runtimeVideoCapture.sourceTitle, "Runtime Bookmarklet Video");
  assert.equal(runtimeVideoCapture.sourceUrl, `${appUrl}external-video.html`);
  assert.equal(runtimeVideoCapture.latestQuote, "Virtual video selected sentence.");
  assert.equal(runtimeVideoCapture.latestTimestamp, "00:02:05");
  assert.equal(runtimeVideoCapture.latestSourceTitle, "Runtime Bookmarklet Video");
  assert.equal(runtimeVideoCapture.latestSourceUrl, `${appUrl}external-video.html`);
  assert.equal(runtimeVideoCapture.latestSourceProvenance, "inbound");
  assert.equal(runtimeVideoCapture.activityTitle, "Browser capture saved");
  assert.match(runtimeVideoCapture.activityDetail, /no matching topic/);

  virtualRoutes.set("/external-doc.html", `<!doctype html>
<html>
  <head><title>Runtime Bookmarklet Doc</title></head>
  <body>
    <article>
      <h1>Runtime Bookmarklet Doc</h1>
      <p id="selected-quote">Virtual <strong>document</strong> selected <span>excerpt.</span></p>
    </article>
  </body>
</html>`);
  await cdp.send("Page.navigate", { url: `${appUrl}external-doc.html` });
  await sleep(200);
  const openedDocCaptureUrl = await cdp.evaluate(`(() => {
    window.__openedLearningCompanionUrl = "";
    window.open = (url) => {
      window.__openedLearningCompanionUrl = String(url);
      return null;
    };
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(document.querySelector("#selected-quote"));
    selection.removeAllRanges();
    selection.addRange(range);
    eval(${JSON.stringify(bookmarkletSource)});
    return window.__openedLearningCompanionUrl;
  })()`);
  const parsedDocCaptureUrl = new URL(openedDocCaptureUrl);
  assert.equal(parsedDocCaptureUrl.origin, new URL(appUrl).origin);
  assert.equal(parsedDocCaptureUrl.pathname, "/");
  assert.equal(parsedDocCaptureUrl.searchParams.get("capture"), "1");
  assert.equal(parsedDocCaptureUrl.searchParams.get("sourceTitle"), "Runtime Bookmarklet Doc");
  assert.equal(parsedDocCaptureUrl.searchParams.get("sourceUrl"), `${appUrl}external-doc.html`);
  assert.equal(parsedDocCaptureUrl.searchParams.get("quote"), "Virtual document selected excerpt.");
  assert.equal(parsedDocCaptureUrl.searchParams.get("t"), "");

  await cdp.send("Page.navigate", { url: openedDocCaptureUrl });
  await sleep(300);
  const runtimeDocCapture = await waitForCdpValue(cdp, `(() => {
    const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
    const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
    const latest = session.captures[0] || {};
    return {
      activeTitle: session.title,
      sourceTitle: session.sourceTitle,
      sourceUrl: session.sourceUrl,
      latestQuote: latest.quote || "",
      latestTimestamp: latest.timestamp || "",
      latestSourceTitle: latest.sourceTitle || "",
      latestSourceUrl: latest.sourceUrl || "",
      latestSourceProvenance: latest.sourceProvenance || "",
      captureCount: session.captures.length,
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent
    };
  })()`, (value) => value.latestQuote === "Virtual document selected excerpt.");

  assert.equal(runtimeDocCapture.activeTitle, "Query order target");
  assert.equal(runtimeDocCapture.sourceTitle, "Runtime Bookmarklet Doc");
  assert.equal(runtimeDocCapture.sourceUrl, `${appUrl}external-doc.html`);
  assert.equal(runtimeDocCapture.latestQuote, "Virtual document selected excerpt.");
  assert.equal(runtimeDocCapture.latestTimestamp, "");
  assert.equal(runtimeDocCapture.latestSourceTitle, "Runtime Bookmarklet Doc");
  assert.equal(runtimeDocCapture.latestSourceUrl, `${appUrl}external-doc.html`);
  assert.equal(runtimeDocCapture.latestSourceProvenance, "inbound");
  assert.equal(runtimeDocCapture.activityTitle, "Browser capture saved");
  assert.match(runtimeDocCapture.activityDetail, /no matching topic/);

  virtualRoutes.set("/external-empty.html", `<!doctype html>
<html>
  <head><title>Runtime Bookmarklet Empty Selection</title></head>
  <body>
    <article>
      <h1>Runtime Bookmarklet Empty Selection</h1>
      <p>Nothing is selected on this page.</p>
    </article>
  </body>
</html>`);
  await cdp.send("Page.navigate", { url: `${appUrl}external-empty.html` });
  await sleep(200);
  const openedEmptyCaptureUrl = await cdp.evaluate(`(() => {
    window.__openedLearningCompanionUrl = "";
    window.open = (url) => {
      window.__openedLearningCompanionUrl = String(url);
      return null;
    };
    window.getSelection().removeAllRanges();
    eval(${JSON.stringify(bookmarkletSource)});
    return window.__openedLearningCompanionUrl;
  })()`);
  const parsedEmptyCaptureUrl = new URL(openedEmptyCaptureUrl);
  assert.equal(parsedEmptyCaptureUrl.origin, new URL(appUrl).origin);
  assert.equal(parsedEmptyCaptureUrl.pathname, "/");
  assert.equal(parsedEmptyCaptureUrl.searchParams.get("capture"), "1");
  assert.equal(parsedEmptyCaptureUrl.searchParams.get("sourceTitle"), "Runtime Bookmarklet Empty Selection");
  assert.equal(parsedEmptyCaptureUrl.searchParams.get("sourceUrl"), `${appUrl}external-empty.html`);
  assert.equal(parsedEmptyCaptureUrl.searchParams.get("quote"), "");
  assert.equal(parsedEmptyCaptureUrl.searchParams.get("t"), "");

  await cdp.send("Page.navigate", { url: openedEmptyCaptureUrl });
  await sleep(300);
  const runtimeEmptySelection = await waitForCdpValue(cdp, `(() => {
    const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
    const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
    return {
      activeTitle: session.title,
      sourceTitle: session.sourceTitle,
      sourceUrl: session.sourceUrl,
      captureCount: session.captures.length,
      latestQuote: session.captures[0]?.quote || "",
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent
    };
  })()`, (value) => value.activityTitle === "Browser source updated");

  assert.equal(runtimeEmptySelection.activeTitle, "Query order target");
  assert.equal(runtimeEmptySelection.sourceTitle, "Runtime Bookmarklet Empty Selection");
  assert.equal(runtimeEmptySelection.sourceUrl, `${appUrl}external-empty.html`);
  assert.equal(runtimeEmptySelection.captureCount, runtimeDocCapture.captureCount);
  assert.equal(runtimeEmptySelection.latestQuote, "Virtual document selected excerpt.");
  assert.equal(runtimeEmptySelection.activityTitle, "Browser source updated");
  assert.match(runtimeEmptySelection.activityDetail, /no matching topic/);

  const globalReview = await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    document.querySelector("#newSessionBtn").click();
    setValue("#sessionTitle", "Algorithms course");
    setValue("#quoteInput", "Dijkstra explores the lowest-cost frontier first.");
    setValue("#thoughtInput", "Recall why greedy selection works.");
    document.querySelector("#captureCardBtn").click();
    document.querySelector('[data-tab="review"]').click();
    return {
      dueCount: document.querySelector("#dueCount").textContent,
      dueMetric: document.querySelector("#dueMetric").textContent,
      reviewText: document.querySelector("#reviewList").textContent
    };
  })()`);

  assert.equal(globalReview.dueCount, "2 due");
  assert.equal(globalReview.dueMetric, "2");
  assert.match(globalReview.reviewText, /Algorithms course/);
  assert.match(globalReview.reviewText, /Spaced repetition improves/);

  const deleteFlow = await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    document.querySelector("#newSessionBtn").click();
    setValue("#sessionTitle", "Cleanup course");
    setValue("#quoteInput", "Temporary capture for deletion.");
    setValue("#thoughtInput", "Temporary card should be removable.");
    document.querySelector("#captureCardBtn").click();
    const before = {
      captures: document.querySelector("#captureMetric").textContent,
      cards: document.querySelector("#cardMetric").textContent,
      stackRows: document.querySelectorAll("#captureStack .capture-stack-row").length,
      stackReviewEnabled: [...document.querySelectorAll("#captureStack .capture-stack-row button")]
        .find((button) => button.textContent === "Review")?.disabled === false,
      stackDeleteLabel: [...document.querySelectorAll("#captureStack .capture-stack-row button")]
        .map((button) => button.textContent)
        .find((text) => text.startsWith("Delete")) || ""
    };
    let stackCancelPrompt = "";
    window.confirm = (message) => {
      stackCancelPrompt = message;
      return false;
    };
    [...document.querySelectorAll("#captureStack .capture-stack-row button")]
      .find((button) => button.textContent.startsWith("Delete"))
      ?.click();
    const afterStackCancelDelete = {
      captures: document.querySelector("#captureMetric").textContent,
      cards: document.querySelector("#cardMetric").textContent,
      stackRows: document.querySelectorAll("#captureStack .capture-stack-row").length,
      confirmPrompt: stackCancelPrompt
    };
    document.querySelector("#sidecarLayoutBtn").click();
    const stackAllBefore = {
      shellCompact: document.querySelector(".app-shell").classList.contains("sidecar-layout"),
      inspectorDisplay: getComputedStyle(document.querySelector(".inspector")).display
    };
    document.querySelector("#captureStack .capture-stack-header button").click();
    const stackAllAfter = {
      shellCompact: document.querySelector(".app-shell").classList.contains("sidecar-layout"),
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      inspectorDisplay: getComputedStyle(document.querySelector(".inspector")).display
    };
    document.querySelector('[data-tab="captures"]').click();
    const initialCaptureCard = [...document.querySelectorAll("#captureList .item-card")]
      .find((item) => item.textContent.includes("Temporary capture for deletion."));
    [...initialCaptureCard.querySelectorAll("button")].find((button) => button.textContent === "Note").click();
    const notedCaptureCard = [...document.querySelectorAll("#captureList .item-card")]
      .find((item) => item.textContent.includes("Temporary capture for deletion."));
    const cascadeDeleteLabel = [...notedCaptureCard.querySelectorAll("button")]
      .map((button) => button.textContent)
      .find((text) => text.startsWith("Delete")) || "";
    window.confirm = () => false;
    [...notedCaptureCard.querySelectorAll("button")].find((button) => button.textContent.startsWith("Delete")).click();
    const afterCancelDelete = {
      captures: document.querySelector("#captureMetric").textContent,
      cards: document.querySelector("#cardMetric").textContent,
      notesHasCapture: document.querySelector("#notesEditor").value.includes("Temporary capture for deletion.")
    };
    window.confirm = () => true;
    document.querySelector('[data-tab="review"]').click();
    const reviewCard = [...document.querySelectorAll("#reviewList .review-card")]
      .find((item) => item.textContent.includes("Temporary card should be removable."));
    [...reviewCard.querySelectorAll("button")].find((button) => button.textContent === "Delete").click();
    const afterCardDelete = {
      captures: document.querySelector("#captureMetric").textContent,
      cards: document.querySelector("#cardMetric").textContent,
      reviewText: document.querySelector("#reviewList").textContent,
      stackMakeCardEnabled: [...document.querySelectorAll("#captureStack .capture-stack-row button")]
        .some((button) => button.textContent === "Make card" && !button.disabled)
    };
    document.querySelector('[data-tab="captures"]').click();
    const captureCard = [...document.querySelectorAll("#captureList .item-card")]
      .find((item) => item.textContent.includes("Temporary capture for deletion."));
    const makeCardEnabled = [...captureCard.querySelectorAll("button")]
      .find((button) => button.textContent === "Make card" && !button.disabled);
    [...captureCard.querySelectorAll("button")].find((button) => button.textContent === "Delete").click();
    const afterCaptureDelete = {
      captures: document.querySelector("#captureMetric").textContent,
      cards: document.querySelector("#cardMetric").textContent,
      captureText: document.querySelector("#captureList").textContent,
      stackRows: document.querySelectorAll("#captureStack .capture-stack-row").length,
      stackText: document.querySelector("#captureStack").textContent,
      notesHasCapture: document.querySelector("#notesEditor").value.includes("Temporary capture for deletion."),
      activity: document.querySelector("#activityTitle").textContent
    };
    setValue("#quoteInput", "Stack-only mistaken capture.");
    setValue("#thoughtInput", "Delete directly from the sidecar stack.");
    document.querySelector("#captureBtn").click();
    const stackOnlyDeleteLabel = [...document.querySelectorAll("#captureStack .capture-stack-row button")]
      .map((button) => button.textContent)
      .find((text) => text.startsWith("Delete")) || "";
    let stackOnlyDeletePrompt = "";
    window.confirm = (message) => {
      stackOnlyDeletePrompt = message;
      return true;
    };
    [...document.querySelectorAll("#captureStack .capture-stack-row button")]
      .find((button) => button.textContent === "Delete")
      ?.click();
    const afterStackDelete = {
      captures: document.querySelector("#captureMetric").textContent,
      cards: document.querySelector("#cardMetric").textContent,
      stackText: document.querySelector("#captureStack").textContent,
      activity: document.querySelector("#activityTitle").textContent,
      stackOnlyDeleteLabel,
      confirmPrompt: stackOnlyDeletePrompt,
      undoVisible: !document.querySelector("#activityUndoBtn").hidden,
      undoLabel: document.querySelector("#activityUndoBtn").textContent
    };
    document.querySelector("#activityUndoBtn").click();
    const afterStackUndo = {
      captures: document.querySelector("#captureMetric").textContent,
      cards: document.querySelector("#cardMetric").textContent,
      stackText: document.querySelector("#captureStack").textContent,
      activity: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent,
      undoHidden: document.querySelector("#activityUndoBtn").hidden
    };
    window.confirm = () => true;
    [...document.querySelectorAll("#captureStack .capture-stack-row button")]
      .find((button) => button.textContent === "Delete")
      ?.click();
    const afterStackRedoDelete = {
      captures: document.querySelector("#captureMetric").textContent,
      cards: document.querySelector("#cardMetric").textContent,
      stackText: document.querySelector("#captureStack").textContent,
      activity: document.querySelector("#activityTitle").textContent
    };
    document.querySelector("#newSessionBtn").click();
    setValue("#sessionTitle", "Review reveal preserve");
    setValue("#quoteInput", "Preserve this revealed answer.");
    setValue("#thoughtInput", "Preserve this review prompt while deleting another capture.");
    document.querySelector("#captureCardBtn").click();
    document.querySelector('[data-tab="review"]').click();
    const preserveCard = [...document.querySelectorAll("#reviewList .review-card")]
      .find((card) => card.textContent.includes("Preserve this review prompt"));
    preserveCard.querySelector("[data-reveal-card]")?.click();
    const beforeUnrelatedDeleteReveal = [...document.querySelectorAll("#reviewList .review-card")]
      .some((card) => card.textContent.includes("Preserve this review prompt") && card.textContent.includes("Preserve this revealed answer."));
    document.querySelector("#newSessionBtn").click();
    setValue("#sessionTitle", "Unrelated stack delete");
    setValue("#quoteInput", "Unrelated capture to delete.");
    setValue("#thoughtInput", "This delete must not hide the revealed review answer.");
    document.querySelector("#captureBtn").click();
    window.confirm = () => true;
    [...document.querySelectorAll("#captureStack .capture-stack-row button")]
      .find((button) => button.textContent === "Delete")
      ?.click();
    document.querySelector('[data-tab="review"]').click();
    const afterUnrelatedDeleteReveal = [...document.querySelectorAll("#reviewList .review-card")]
      .some((card) => card.textContent.includes("Preserve this review prompt") && card.textContent.includes("Preserve this revealed answer."));
    const preserveCardAfter = [...document.querySelectorAll("#reviewList .review-card")]
      .find((card) => card.textContent.includes("Preserve this review prompt"));
    [...preserveCardAfter.querySelectorAll("button")]
      .find((button) => button.textContent === "Delete")
      ?.click();
    const unrelatedReviewState = {
      beforeUnrelatedDeleteReveal,
      afterUnrelatedDeleteReveal
    };
    return {
      before,
      afterCardDelete,
      makeCardEnabled: Boolean(makeCardEnabled),
      afterCaptureDelete,
      afterStackDelete,
      afterStackUndo,
      afterStackRedoDelete,
      unrelatedReviewState,
      afterStackCancelDelete,
      afterCancelDelete,
      stackAllBefore,
      stackAllAfter,
      cascadeDeleteLabel
    };
  })()`);

  assert.equal(deleteFlow.before.captures, "1");
  assert.equal(deleteFlow.before.cards, "1");
  assert.equal(deleteFlow.before.stackRows, 1);
  assert.equal(deleteFlow.before.stackReviewEnabled, true);
  assert.equal(deleteFlow.before.stackDeleteLabel, "Delete + 1 card");
  assert.equal(deleteFlow.afterStackCancelDelete.captures, "1");
  assert.equal(deleteFlow.afterStackCancelDelete.cards, "1");
  assert.equal(deleteFlow.afterStackCancelDelete.stackRows, 1);
  assert.match(deleteFlow.afterStackCancelDelete.confirmPrompt, /Temporary card should be removable/);
  assert.match(deleteFlow.afterStackCancelDelete.confirmPrompt, /1 linked review card/);
  assert.match(deleteFlow.afterStackCancelDelete.confirmPrompt, /Existing note blocks/);
  assert.deepEqual(deleteFlow.stackAllBefore, { shellCompact: true, inspectorDisplay: "none" });
  assert.equal(deleteFlow.stackAllAfter.shellCompact, false);
  assert.equal(deleteFlow.stackAllAfter.activeTab, "captures");
  assert.notEqual(deleteFlow.stackAllAfter.inspectorDisplay, "none");
  assert.equal(deleteFlow.cascadeDeleteLabel, "Delete + 1 card");
  assert.equal(deleteFlow.afterCancelDelete.captures, "1");
  assert.equal(deleteFlow.afterCancelDelete.cards, "1");
  assert.equal(deleteFlow.afterCancelDelete.notesHasCapture, true);
  assert.equal(deleteFlow.afterCardDelete.captures, "1");
  assert.equal(deleteFlow.afterCardDelete.cards, "0");
  assert.equal(deleteFlow.afterCardDelete.stackMakeCardEnabled, true);
  assert.equal(deleteFlow.makeCardEnabled, true);
  assert.equal(deleteFlow.afterCaptureDelete.captures, "0");
  assert.equal(deleteFlow.afterCaptureDelete.cards, "0");
  assert.doesNotMatch(deleteFlow.afterCaptureDelete.captureText, /Temporary capture for deletion/);
  assert.equal(deleteFlow.afterCaptureDelete.stackRows, 0);
  assert.doesNotMatch(deleteFlow.afterCaptureDelete.stackText, /Temporary capture for deletion/);
  assert.equal(deleteFlow.afterCaptureDelete.notesHasCapture, true);
  assert.equal(deleteFlow.afterCaptureDelete.activity, "Capture deleted");
  assert.equal(deleteFlow.afterStackDelete.captures, "0");
  assert.equal(deleteFlow.afterStackDelete.cards, "0");
  assert.equal(deleteFlow.afterStackDelete.stackText, "Recent StackSidecar memoryAllSaved captures will stay visible here while you read.");
  assert.equal(deleteFlow.afterStackDelete.activity, "Capture deleted");
  assert.equal(deleteFlow.afterStackDelete.stackOnlyDeleteLabel, "Delete");
  assert.match(deleteFlow.afterStackDelete.confirmPrompt, /Delete directly from the sidecar stack/);
  assert.match(deleteFlow.afterStackDelete.confirmPrompt, /Existing note blocks/);
  assert.equal(deleteFlow.afterStackDelete.undoVisible, true);
  assert.equal(deleteFlow.afterStackDelete.undoLabel, "Undo 10s");
  assert.equal(deleteFlow.afterStackUndo.captures, "1");
  assert.equal(deleteFlow.afterStackUndo.cards, "0");
  assert.match(deleteFlow.afterStackUndo.stackText, /Delete directly from the sidecar stack/);
  assert.equal(deleteFlow.afterStackUndo.activity, "Capture delete undone");
  assert.match(deleteFlow.afterStackUndo.activityDetail, /Delete directly from the sidecar stack/);
  assert.equal(deleteFlow.afterStackUndo.undoHidden, true);
  assert.equal(deleteFlow.afterStackRedoDelete.captures, "0");
  assert.equal(deleteFlow.afterStackRedoDelete.cards, "0");
  assert.doesNotMatch(deleteFlow.afterStackRedoDelete.stackText, /Stack-only mistaken capture/);
  assert.equal(deleteFlow.afterStackRedoDelete.activity, "Capture deleted");
  assert.deepEqual(deleteFlow.unrelatedReviewState, {
    beforeUnrelatedDeleteReveal: true,
    afterUnrelatedDeleteReveal: true
  });

  const questionFlow = await cdp.evaluate(`(() => {
    window.__questionFlowErrors = [];
    window.addEventListener("error", (event) => {
      window.__questionFlowErrors.push(event.message || "unknown error");
    });
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    document.querySelector("#newSessionBtn").click();
    const zeroFocusFacts = document.querySelector("#focusBriefFacts").textContent;
    document.querySelector('[data-tab="today"]').click();
    const emptyTodayText = document.querySelector("#todayList").textContent;
    setValue("#sessionTitle", "Question parking smoke");
    setValue("#sourceUrl", "https://example.com/question-parking");
    setValue("#thoughtInput", "Why does this theorem need the compactness assumption?");
    document.querySelector("#captureBtn").click();
    const questionSignal = Array.from(document.querySelectorAll("#focusBriefSignals .focus-signal"))
      .find((node) => /open question/.test(node.textContent));
    const initialQuestionSignals = document.querySelector("#focusBriefSignals").textContent;
    document.querySelector("#sidecarLayoutBtn").click();
    const beforeQuestionSignalClick = {
      shellCompact: document.querySelector(".app-shell").classList.contains("sidecar-layout"),
      tagName: questionSignal?.tagName || "",
      ariaLabel: questionSignal?.getAttribute("aria-label") || "",
      action: document.querySelector("#focusBriefAction").textContent
    };
    questionSignal?.click();
    const afterQuestionSignalClick = {
      shellCompact: document.querySelector(".app-shell").classList.contains("sidecar-layout"),
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      sectionPulsed: document.querySelector('[data-today-section="open_questions"]')?.classList.contains("pulse") === true,
      sectionText: document.querySelector('[data-today-section="open_questions"]')?.textContent || ""
    };
    const initialQuestionStackText = document.querySelector("#captureStack").textContent;
    document.querySelector("#newSessionBtn").click();
    setValue("#sessionTitle", "Different active smoke");
    document.querySelector('[data-tab="today"]').click();
    const questionCard = Array.from(document.querySelectorAll("#todayList .question-card"))
      .find((node) => /compactness assumption/.test(node.textContent));
    const questionButtons = questionCard
      ? Array.from(questionCard.querySelectorAll("button")).map((button) => button.textContent)
      : [];
    Array.from(questionCard?.querySelectorAll("button") || [])
      .find((button) => button.textContent === "Park")
      ?.click();
    const afterPark = {
      activity: document.querySelector("#activityTitle").textContent,
      detail: document.querySelector("#activityDetail").textContent,
      focusFacts: document.querySelector("#focusBriefFacts").textContent,
      openQuestionCards: Array.from(document.querySelectorAll("#todayList .question-card:not(.parked-question-card):not(.closed-question-card)"))
        .filter((node) => /compactness assumption/.test(node.textContent)).length,
      parkedQuestionCards: Array.from(document.querySelectorAll("#todayList .parked-question-card"))
        .filter((node) => /compactness assumption/.test(node.textContent)).length,
      todayText: document.querySelector("#todayList").textContent,
      parkedButtons: Array.from(document.querySelectorAll("#todayList .parked-question-card button")).map((button) => button.textContent)
    };
    const parkedQuestionCard = Array.from(document.querySelectorAll("#todayList .parked-question-card"))
      .find((node) => /compactness assumption/.test(node.textContent));
    Array.from(parkedQuestionCard?.querySelectorAll("button") || [])
      .find((button) => button.textContent === "Answer")
      ?.click();
    const afterAnswerDraft = {
      activity: document.querySelector("#activityTitle").textContent,
      detail: document.querySelector("#activityDetail").textContent,
      activeTitle: document.querySelector("#sessionTitle").value,
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activeElement: document.activeElement?.id || "",
      quote: document.querySelector("#quoteInput").value,
      thought: document.querySelector("#thoughtInput").value,
      timestamp: document.querySelector("#timestampInput").value,
      intent: document.querySelector("#captureContextIntent").textContent,
      draftTarget: (() => {
        const exported = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
        const prefs = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}");
        return prefs.captureDrafts?.[exported.activeSessionId]?.answersQuestionCaptureId || "";
      })()
    };
    const beforeLocalAnswerSave = window.learningCompanionNative.exportWorkspaceJson();
    setValue("#thoughtInput", "Answer: supercalifragilistic");
    const notReadyLinkedAnswerIntent = {
      text: document.querySelector("#captureContextIntent").textContent,
      title: document.querySelector("#captureContextIntent").title
    };
    setValue("#thoughtInput", "Answer: compactness lets the proof extract a finite subcover from the open cover.");
    const localAnswerIntent = document.querySelector("#captureContextIntent").textContent;
    document.querySelector("#captureBtn").click();
    const localAnswerExport = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    const localAnswerTopic = localAnswerExport.sessions.find((session) => session.title === "Question parking smoke");
    const localAnswerQuestion = localAnswerTopic?.captures.find((capture) => /compactness assumption/.test(capture.thought || capture.quote));
    const localAnswerCapture = localAnswerTopic?.captures.find((capture) => /finite subcover/.test(capture.thought || capture.quote));
    const localAnswerSaved = {
      intentBeforeSave: localAnswerIntent,
      activity: document.querySelector("#activityTitle").textContent,
      linked: localAnswerCapture?.answersQuestionCaptureId === localAnswerQuestion?.id,
      questionResolved: Boolean(localAnswerQuestion?.questionResolvedAt),
      questionParked: Boolean(localAnswerQuestion?.questionParkedAt)
    };
    window.learningCompanionNative.importWorkspaceJson(beforeLocalAnswerSave);
    document.querySelector('[data-tab="today"]').click();
    const answerQuestionCard = Array.from(document.querySelectorAll("#todayList .question-card"))
      .find((node) => /compactness assumption/.test(node.textContent));
    Array.from(answerQuestionCard?.querySelectorAll("button") || [])
      .find((button) => button.textContent === "Make card")
      ?.click();
    const afterQuestionCard = {
      activity: document.querySelector("#activityTitle").textContent,
      detail: document.querySelector("#activityDetail").textContent,
      activeTitle: document.querySelector("#sessionTitle").value,
      cardMetric: document.querySelector("#cardMetric").textContent,
      reviewActive: document.querySelector('[data-tab="review"]').classList.contains("active"),
      reviewText: document.querySelector("#reviewList").textContent
    };
    document.querySelector('[data-tab="today"]').click();
    const promotedQuestionCard = Array.from(document.querySelectorAll("#todayList .question-card"))
      .find((node) => /compactness assumption/.test(node.textContent));
    const promotedQuestionButtons = promotedQuestionCard
      ? Array.from(promotedQuestionCard.querySelectorAll("button"))
      : [];
    const promotedCardButton = promotedQuestionButtons.find((button) => button.textContent === "Card");
    promotedQuestionButtons.find((button) => button.textContent === "Resolve")?.click();
    const afterResolve = {
      activity: document.querySelector("#activityTitle").textContent,
      detail: document.querySelector("#activityDetail").textContent,
      focusFacts: document.querySelector("#focusBriefFacts").textContent,
      stackText: document.querySelector("#captureStack").textContent,
      openQuestionCards: Array.from(document.querySelectorAll("#todayList .question-card:not(.parked-question-card):not(.closed-question-card)"))
        .filter((node) => /compactness assumption/.test(node.textContent)).length
    };
    document.querySelector('[data-tab="captures"]').click();
    const resolvedCaptureCard = Array.from(document.querySelectorAll("#captureList .item-card"))
      .find((node) => /compactness assumption/.test(node.textContent));
    const captureButtonsAfterResolve = resolvedCaptureCard
      ? Array.from(resolvedCaptureCard.querySelectorAll("button")).map((button) => button.textContent)
      : [];
    Array.from(resolvedCaptureCard?.querySelectorAll("button") || [])
      .find((button) => button.textContent === "Reopen")
      ?.click();
    document.querySelector('[data-tab="today"]').click();
    const afterReopen = {
      activity: document.querySelector("#activityTitle").textContent,
      detail: document.querySelector("#activityDetail").textContent,
      focusFacts: document.querySelector("#focusBriefFacts").textContent,
      stackText: document.querySelector("#captureStack").textContent,
      openQuestionCards: Array.from(document.querySelectorAll("#todayList .question-card:not(.parked-question-card):not(.closed-question-card)"))
        .filter((node) => /compactness assumption/.test(node.textContent)).length
    };
    const reopenedSnapshot = {
      signals: document.querySelector("#focusBriefSignals").textContent,
      focusFacts: document.querySelector("#focusBriefFacts").textContent,
      todaySummary: document.querySelector("#todaySummary").textContent,
      todayText: document.querySelector("#todayList").textContent
    };
    const exportedBeforeAnswerImport = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    const answerTopic = exportedBeforeAnswerImport.sessions.find((session) => (
      session.captures.some((capture) => /compactness assumption/.test(capture.thought || capture.quote))
    ));
    const answerTarget = answerTopic?.captures.find((capture) => /compactness assumption/.test(capture.thought || capture.quote));
    const answerImport = window.learningCompanionNative.importWorkspaceJson(JSON.stringify({
      schema: "learning-companion.mobile-inbox-patch.v1",
      appVersion: 1,
      patchId: "browser_question_answer_patch",
      createdAt: "2026-05-29T10:00:00.000Z",
      source: { generatedBy: "inbox.html", workspaceFingerprint: "browser-question", topicId: answerTopic?.id || "", topicTitle: answerTopic?.title || "" },
      target: { topicId: answerTopic?.id || "", topicTitle: answerTopic?.title || "" },
      captures: [{
        id: "browser_question_answer_capture",
        quote: "Compactness keeps the finite subcover step available.",
        thought: "Answer: without compactness the proof cannot pass from local covers to a finite argument.",
        tags: "answer",
        answersQuestionCaptureId: answerTarget?.id || "",
        capturedAt: "2026-05-29T10:00:01.000Z"
      }]
    }));
    const exportedAfterAnswerImport = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    const answerTopicAfter = exportedAfterAnswerImport.sessions.find((session) => session.id === answerTopic?.id);
    const answerTargetAfter = answerTopicAfter?.captures.find((capture) => capture.id === answerTarget?.id);
    const answerCaptureAfter = answerTopicAfter?.captures.find((capture) => capture.inboxCaptureId === "browser_question_answer_capture");
    const afterAnswerImport = {
      ok: answerImport.ok === true,
      kind: answerImport.kind || "",
      receiptText: document.querySelector("#importReceipt").textContent,
      answeredQuestions: answerImport.receipt?.answeredQuestions || 0,
      open: answerTargetAfter ? /Question/.test(answerTargetAfter.thought || "") && !answerTargetAfter.questionResolvedAt : true,
      questionResolvedAt: answerTargetAfter?.questionResolvedAt || "",
      answerCaptureLinked: answerCaptureAfter?.answersQuestionCaptureId === answerTarget?.id,
      closedQuestionCards: Array.from(document.querySelectorAll("#todayList .closed-question-card"))
        .filter((node) => /compactness assumption/.test(node.textContent)).length,
      closedCardButtons: Array.from(document.querySelectorAll("#todayList .closed-question-card button"))
        .map((button) => ({ text: button.textContent, disabled: button.disabled === true })),
      todayText: document.querySelector("#todayList").textContent
    };
    const refreshButton = Array.from(document.querySelectorAll("#todayList .closed-question-card button"))
      .find((button) => button.textContent === "Refresh card");
    refreshButton?.click();
    const activeReviewButtons = () => Array.from(document.querySelectorAll("#reviewList .active-review-card button"));
    const reviewButtonsBeforeReveal = activeReviewButtons()
      .map((button) => button.textContent);
    activeReviewButtons()
      .find((button) => button.textContent === "Reveal")
      ?.click();
    const exportedAfterRefresh = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    const answerTopicAfterRefresh = exportedAfterRefresh.sessions.find((session) => session.id === answerTopic?.id);
    const refreshedAnswerCard = answerTopicAfterRefresh?.reviewCards.find((card) => card.sourceCaptureId === answerTarget?.id);
    const afterAnswerRefresh = {
      activity: document.querySelector("#activityTitle").textContent,
      detail: document.querySelector("#activityDetail").textContent,
      reviewText: document.querySelector("#reviewList").textContent,
      activeReviewCard: Boolean(document.querySelector("#reviewList .active-review-card")),
      reviewButtonsBeforeReveal,
      reviewButtons: activeReviewButtons()
        .map((button) => button.textContent),
      cardEvidenceCaptureId: refreshedAnswerCard?.evidenceCaptureId || "",
      answerCaptureId: answerCaptureAfter?.id || ""
    };
    const answerEvidenceButton = activeReviewButtons()
      .find((button) => button.textContent === "Answer evidence");
    answerEvidenceButton?.click();
    const afterAnswerEvidence = {
      activity: document.querySelector("#activityTitle").textContent,
      captureText: document.querySelector("#captureList").textContent,
      answerCaptureVisible: Boolean(answerCaptureAfter?.id && document.querySelector("[data-capture-id='" + CSS.escape(answerCaptureAfter.id) + "']"))
    };
    document.querySelector('[data-tab="today"]').click();
    const closedQuestionCard = Array.from(document.querySelectorAll("#todayList .closed-question-card"))
      .find((node) => /compactness assumption/.test(node.textContent));
    Array.from(closedQuestionCard?.querySelectorAll("button") || [])
      .find((button) => button.textContent === "Reopen")
      ?.click();
    const afterAnswerReopen = {
      activity: document.querySelector("#activityTitle").textContent,
      detail: document.querySelector("#activityDetail").textContent,
      closedQuestionCards: Array.from(document.querySelectorAll("#todayList .closed-question-card"))
        .filter((node) => /compactness assumption/.test(node.textContent)).length,
      openQuestionCards: Array.from(document.querySelectorAll("#todayList .question-card:not(.parked-question-card):not(.closed-question-card)"))
        .filter((node) => /compactness assumption/.test(node.textContent)).length,
      focusFacts: document.querySelector("#focusBriefFacts").textContent
    };
    return {
      zeroFocusFacts,
      emptyTodayText,
      stackText: initialQuestionStackText,
      signals: initialQuestionSignals,
      focusFacts: reopenedSnapshot.focusFacts,
      questionSignalClass: questionSignal ? questionSignal.className : "",
      todaySummary: reopenedSnapshot.todaySummary,
      todayText: afterPark.todayText,
      questionButtons,
      questionSignalClick: {
        before: beforeQuestionSignalClick,
        after: afterQuestionSignalClick
      },
      afterPark,
      afterAnswerDraft,
      notReadyLinkedAnswerIntent,
      localAnswerSaved,
      afterQuestionCard,
      promotedQuestionButton: {
        text: promotedCardButton?.textContent || "",
        disabled: promotedCardButton?.disabled === true
      },
      afterResolve,
      captureButtonsAfterResolve,
      afterReopen,
      afterAnswerImport,
      afterAnswerRefresh,
      afterAnswerEvidence,
      afterAnswerReopen,
      errors: window.__questionFlowErrors
    };
  })()`);

  assert.deepEqual(questionFlow.errors, []);
  assert.match(questionFlow.zeroFocusFacts, /Questions/);
  assert.match(questionFlow.zeroFocusFacts, /None/);
  assert.match(questionFlow.emptyTodayText, /Open Questions/);
  assert.match(questionFlow.emptyTodayText, /Question Queue Health/);
  assert.match(questionFlow.emptyTodayText, /Question Loop/);
  assert.match(questionFlow.emptyTodayText, /No open questions captured/);
  assert.match(questionFlow.stackText, /Question/);
  assert.match(questionFlow.stackText, /compactness assumption/);
  assert.match(questionFlow.signals, /1 open question/);
  assert.match(questionFlow.focusFacts, /Questions/);
  assert.doesNotMatch(questionFlow.questionSignalClass, /warn/);
  assert.match(questionFlow.todaySummary, /questions/);
  assert.match(questionFlow.todayText, /Open Questions/);
  assert.match(questionFlow.todayText, /Question Queue Health/);
  assert.match(questionFlow.todayText, /Question Loop/);
  assert.match(questionFlow.todayText, /compactness assumption/);
  assert.deepEqual(questionFlow.questionSignalClick.before, {
    shellCompact: true,
    tagName: "BUTTON",
    ariaLabel: "Open questions",
    action: "Review 2 workspace due cards"
  });
  assert.equal(questionFlow.questionSignalClick.after.shellCompact, false);
  assert.equal(questionFlow.questionSignalClick.after.activeTab, "today");
  assert.equal(questionFlow.questionSignalClick.after.sectionPulsed, true);
  assert.equal(questionFlow.questionSignalClick.after.sectionText, "Open Questions");
  assert.equal(questionFlow.questionButtons.includes("Answer"), true);
  assert.equal(questionFlow.questionButtons.includes("Make card"), true);
  assert.equal(questionFlow.questionButtons.includes("Park"), true);
  assert.equal(questionFlow.afterPark.activity, "Question parked");
  assert.match(questionFlow.afterPark.detail, /Loop: 0 active · 1 parked · 0 closed today · 0 cards today/);
  assert.match(questionFlow.afterPark.focusFacts, /Questions/);
  assert.match(questionFlow.afterPark.focusFacts, /None/);
  assert.equal(questionFlow.afterPark.openQuestionCards, 0);
  assert.equal(questionFlow.afterPark.parkedQuestionCards, 1);
  assert.match(questionFlow.afterPark.todayText, /Parked Questions/);
  assert.match(questionFlow.afterPark.todayText, /Parked since/);
  assert.match(questionFlow.afterPark.todayText, /1 parked question waiting/);
  assert.match(questionFlow.afterPark.todayText, /compactness assumption/);
  assert.equal(questionFlow.afterPark.parkedButtons.includes("Answer"), true);
  assert.equal(questionFlow.afterPark.parkedButtons.includes("Resume"), true);
  assert.equal(questionFlow.afterAnswerDraft.activity, "Answer draft started");
  assert.match(questionFlow.afterAnswerDraft.detail, /Loop: 1 active · 0 parked · 0 closed today · 0 cards today/);
  assert.equal(questionFlow.afterAnswerDraft.activeTitle, "Question parking smoke");
  assert.equal(questionFlow.afterAnswerDraft.activeTab, "captures");
  assert.equal(questionFlow.afterAnswerDraft.activeElement, "thoughtInput");
  assert.equal(questionFlow.afterAnswerDraft.quote, "Why does this theorem need the compactness assumption?");
  assert.equal(questionFlow.afterAnswerDraft.thought, "Answer:");
  assert.equal(questionFlow.afterAnswerDraft.timestamp, "");
  assert.equal(questionFlow.afterAnswerDraft.intent, "Answer draft");
  assert.match(questionFlow.afterAnswerDraft.draftTarget, /^capture_/);
  assert.deepEqual(questionFlow.notReadyLinkedAnswerIntent, {
    text: "Answer draft",
    title: "This will answer the linked question once you add enough detail."
  });
  assert.deepEqual(questionFlow.localAnswerSaved, {
    intentBeforeSave: "Answer",
    activity: "Answer saved",
    linked: true,
    questionResolved: true,
    questionParked: false
  });
  assert.equal(questionFlow.afterQuestionCard.activity, "Review card created");
  assert.match(questionFlow.afterQuestionCard.detail, /Loop: 1 active · 0 parked · 0 closed today · 1 card today/);
  assert.equal(questionFlow.afterQuestionCard.activeTitle, "Question parking smoke");
  assert.equal(questionFlow.afterQuestionCard.cardMetric, "1");
  assert.equal(questionFlow.afterQuestionCard.reviewActive, true);
  assert.match(questionFlow.afterQuestionCard.reviewText, /compactness assumption/);
  assert.deepEqual(questionFlow.promotedQuestionButton, { text: "Card", disabled: true });
  assert.equal(questionFlow.questionButtons.includes("Resolve"), true);
  assert.equal(questionFlow.afterResolve.activity, "Question resolved");
  assert.match(questionFlow.afterResolve.detail, /Loop: 0 active · 0 parked · 1 closed today · 1 card today/);
  assert.equal(questionFlow.afterResolve.openQuestionCards, 0);
  assert.match(questionFlow.afterResolve.focusFacts, /Questions/);
  assert.match(questionFlow.afterResolve.focusFacts, /None/);
  assert.match(questionFlow.afterResolve.stackText, /Answered/);
  assert.equal(questionFlow.captureButtonsAfterResolve.includes("Reopen"), true);
  assert.equal(questionFlow.afterReopen.activity, "Question reopened");
  assert.match(questionFlow.afterReopen.detail, /Loop: 1 active · 0 parked · 0 closed today · 1 card today/);
  assert.equal(questionFlow.afterReopen.openQuestionCards, 1);
  assert.match(questionFlow.afterReopen.focusFacts, /1 open/);
  assert.match(questionFlow.afterReopen.stackText, /Question/);
  assert.equal(questionFlow.afterAnswerImport.ok, true);
  assert.equal(questionFlow.afterAnswerImport.kind, "mobile-inbox-patch");
  assert.equal(questionFlow.afterAnswerImport.answeredQuestions, 1);
  assert.equal(questionFlow.afterAnswerImport.open, false);
  assert.match(questionFlow.afterAnswerImport.questionResolvedAt, /^20/);
  assert.equal(questionFlow.afterAnswerImport.answerCaptureLinked, true);
  assert.match(questionFlow.afterAnswerImport.receiptText, /1 question resolved/);
  assert.match(questionFlow.afterAnswerImport.receiptText, /1 card ready to refresh/);
  assert.equal(questionFlow.afterAnswerImport.closedQuestionCards, 1);
  assert.deepEqual(
    questionFlow.afterAnswerImport.closedCardButtons.find((button) => button.text === "Refresh card"),
    { text: "Refresh card", disabled: false }
  );
  assert.match(questionFlow.afterAnswerImport.todayText, /Closed Today/);
  assert.match(questionFlow.afterAnswerImport.todayText, /Answers Today/);
  assert.match(questionFlow.afterAnswerImport.todayText, /linked answer/);
  assert.match(questionFlow.afterAnswerImport.todayText, /Question Loop/);
  assert.match(questionFlow.afterAnswerImport.todayText, /1 answer-linked closure/);
  assert.match(questionFlow.afterAnswerImport.todayText, /Answer: without compactness the proof cannot pass/);
  assert.doesNotMatch(questionFlow.afterAnswerImport.todayText, /Answer: Answer:/);
  assert.match(questionFlow.afterAnswerImport.todayText, /Reopen/);
  assert.equal(questionFlow.afterAnswerRefresh.activity, "Review card refreshed");
  assert.match(questionFlow.afterAnswerRefresh.detail, /Loop: 0 active · 0 parked · 1 closed today · 1 card today/);
  assert.equal(questionFlow.afterAnswerRefresh.activeReviewCard, true);
  assert.match(questionFlow.afterAnswerRefresh.reviewText, /Answer the question: Why does this theorem need the compactness assumption/);
  assert.equal(questionFlow.afterAnswerRefresh.cardEvidenceCaptureId, questionFlow.afterAnswerRefresh.answerCaptureId);
  assert.equal(questionFlow.afterAnswerRefresh.reviewButtonsBeforeReveal.includes("Answer evidence"), false);
  assert.equal(questionFlow.afterAnswerRefresh.reviewButtons.includes("Answer evidence"), true);
  assert.equal(questionFlow.afterAnswerEvidence.activity, "Capture selected");
  assert.equal(questionFlow.afterAnswerEvidence.answerCaptureVisible, true);
  assert.match(questionFlow.afterAnswerEvidence.captureText, /without compactness the proof cannot pass/);
  assert.equal(questionFlow.afterAnswerReopen.activity, "Question reopened");
  assert.match(questionFlow.afterAnswerReopen.detail, /Loop: 1 active · 0 parked · 0 closed today · 1 card today/);
  assert.equal(questionFlow.afterAnswerReopen.closedQuestionCards, 0);
  assert.equal(questionFlow.afterAnswerReopen.openQuestionCards, 1);
  assert.match(questionFlow.afterAnswerReopen.focusFacts, /1 open/);

  const nativeClipboardCapture = await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const result = window.learningCompanionNative.captureClipboardText("Native clipboard bridge direct capture.");
    const browserResult = window.learningCompanionNative.captureClipboardText("Native browser context bridge capture.", {
      sourceTitle: "Native browser docs",
      sourceUrl: "https://developer.mozilla.org/en-US/docs/Web/API/Selection"
    });
    const selectedResult = window.learningCompanionNative.captureClipboardText("Native selected source label.", {
      captureSource: "selected-text"
    });
    const selectedActivityTitle = document.querySelector("#activityTitle").textContent;
    const fallbackResult = window.learningCompanionNative.captureClipboardText("Native fallback source label.", {
      captureSource: "clipboard-fallback"
    });
    const fallbackActivityTitle = document.querySelector("#activityTitle").textContent;
    document.querySelector("#newSessionBtn").click();
    setValue("#sessionTitle", "Native source target");
    setValue("#sourceTitle", "Native original page");
    setValue("#sourceUrl", "https://example.com/native?a=1&b=2");
    document.querySelector("#newSessionBtn").click();
    setValue("#sessionTitle", "Native source decoy");
    setValue("#sourceTitle", "Native decoy page");
    setValue("#sourceUrl", "https://example.com/native-decoy");
    const matchedResult = window.learningCompanionNative.captureClipboardText("Native matched source bridge capture.", {
      sourceTitle: "Native changed page",
      sourceUrl: "https://example.com/native?b=2&a=1&utm_source=clip"
    });
    const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
    const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
    const decoy = workspace.sessions.find((item) => item.title === "Native source decoy");
    return {
      ok: result.ok,
      browserOk: browserResult.ok,
      browserSourceAttached: browserResult.sourceAttached,
      browserResolution: browserResult.resolution,
      defaultCaptureSource: result.captureSource,
      selectedCaptureSource: selectedResult.captureSource,
      selectedActivityTitle,
      fallbackCaptureSource: fallbackResult.captureSource,
      fallbackActivityTitle,
      matchedOk: matchedResult.ok,
      matchedResolution: matchedResult.resolution,
      activeTab: result.activeTab,
      captureId: result.captureId,
      latestQuote: session.captures[0]?.quote || "",
      latestSourceTitle: session.captures[0]?.sourceTitle || "",
      latestSourceUrl: session.captures[0]?.sourceUrl || "",
      latestSourceProvenance: session.captures[0]?.sourceProvenance || "",
      sessionTitle: session.title,
      sessionSourceTitle: session.sourceTitle,
      sessionSourceUrl: session.sourceUrl,
      decoyCaptures: decoy?.captures.length || 0,
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent,
      activeTabUi: document.querySelector(".tab.active")?.dataset.tab || ""
    };
  })()`);

  assert.equal(nativeClipboardCapture.ok, true);
  assert.equal(nativeClipboardCapture.browserOk, true);
  assert.equal(nativeClipboardCapture.browserSourceAttached, true);
  assert.equal(nativeClipboardCapture.browserResolution, "active-fallback");
  assert.equal(nativeClipboardCapture.defaultCaptureSource, "clipboard");
  assert.equal(nativeClipboardCapture.selectedCaptureSource, "selected-text");
  assert.equal(nativeClipboardCapture.selectedActivityTitle, "Selected text capture saved");
  assert.equal(nativeClipboardCapture.fallbackCaptureSource, "clipboard-fallback");
  assert.equal(nativeClipboardCapture.fallbackActivityTitle, "Clipboard fallback capture saved");
  assert.equal(nativeClipboardCapture.matchedOk, true);
  assert.equal(nativeClipboardCapture.matchedResolution, "matched-source-url");
  assert.equal(nativeClipboardCapture.activeTab, "captures");
  assert.match(nativeClipboardCapture.captureId, /^capture_/);
  assert.equal(nativeClipboardCapture.latestQuote, "Native matched source bridge capture.");
  assert.equal(nativeClipboardCapture.latestSourceTitle, "Native changed page");
  assert.equal(nativeClipboardCapture.latestSourceUrl, "https://example.com/native?b=2&a=1&utm_source=clip");
  assert.equal(nativeClipboardCapture.latestSourceProvenance, "inbound");
  assert.equal(nativeClipboardCapture.sessionTitle, "Native source target");
  assert.equal(nativeClipboardCapture.sessionSourceTitle, "Native original page");
  assert.equal(nativeClipboardCapture.sessionSourceUrl, "https://example.com/native?a=1&b=2");
  assert.equal(nativeClipboardCapture.decoyCaptures, 0);
  assert.equal(nativeClipboardCapture.activityTitle, "Clipboard capture saved");
  assert.match(nativeClipboardCapture.activityDetail, /Native matched source/);
  assert.match(nativeClipboardCapture.activityDetail, /matched existing source URL/);
  assert.equal(nativeClipboardCapture.activeTabUi, "captures");

  const draftDriftFocusBrief = await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const workspace = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    const session = {
      ...workspace.sessions[0],
      id: "draft_focus_source_drift",
      title: "Draft focus source drift",
      sourceTitle: "Original lesson",
      sourceUrl: "https://example.com/original",
      materialType: "video",
      tags: [],
      notesMarkdown: "",
      captures: [],
      reviewCards: [],
      focusMode: "capture"
    };
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify({
      ...workspace,
      activeSessionId: session.id,
      sessions: [session],
      importedPatches: [],
      importedReviewPatches: []
    }));
    document.querySelector('[data-focus-mode="capture"]').click();
    setValue("#quoteInput", "Draft that should own the next action.");
    setValue("#thoughtInput", "Keep the source warning visible in Focus Brief.");
    setValue("#timestampInput", "03:21");
    setValue("#sourceTitle", "Different lesson");
    setValue("#sourceUrl", "https://example.com/different");
    return {
      action: document.querySelector("#focusBriefAction").textContent,
      detail: document.querySelector("#focusBriefDetail").textContent,
      facts: document.querySelector("#focusBriefFacts").textContent,
      signals: document.querySelector("#focusBriefSignals").textContent,
      status: document.querySelector("#captureDraftStatus").textContent
    };
  })()`);

  assert.equal(draftDriftFocusBrief.action, "Resume capture draft");
  assert.match(draftDriftFocusBrief.detail, /Draft that should own/);
  assert.match(draftDriftFocusBrief.facts, /Draft source/);
  assert.match(draftDriftFocusBrief.facts, /Original lesson/);
  assert.match(draftDriftFocusBrief.signals, /Source changed/);
  assert.equal(draftDriftFocusBrief.status, "Source changed");

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(120);
  const mobileLayout = await cdp.evaluate(`(() => {
    document.querySelector('[data-focus-mode="review"]').click();
    document.querySelector('[data-tab="today"]').click();
    const styleColumns = (selector) => getComputedStyle(document.querySelector(selector)).gridTemplateColumns
      .split(" ")
      .filter(Boolean).length;
    const deskReviewWidth = Math.ceil(document.querySelector("#deskReviewPane").getBoundingClientRect().width);
    const deskReviewVisible = !document.querySelector("#deskReviewPane").hidden;
    const todayActive = document.querySelector(".tab.active")?.dataset.tab === "today";
    const handoffSummaryMeta = document.querySelector(".device-flow-summary .item-meta");
    const handoffSummary = document.querySelector(".device-flow-summary");
    document.querySelector('[data-focus-mode="capture"]').click();
    const captureContext = document.querySelector("#captureContext");
    const timeRow = document.querySelector(".time-input-row");
    return {
      innerWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      shellColumns: styleColumns(".app-shell"),
      workColumns: styleColumns(".work-grid"),
      tabColumns: styleColumns(".tabs"),
      deskReviewWidth,
      deskReviewVisible,
      todayActive,
      handoffSummaryText: handoffSummaryMeta?.textContent || "",
      handoffSummaryVisible: Boolean(handoffSummaryMeta) && getComputedStyle(handoffSummaryMeta).display !== "none",
      handoffSummaryWidth: Math.ceil(handoffSummaryMeta?.getBoundingClientRect().width || 0),
      handoffSummaryScrollWidth: handoffSummaryMeta?.scrollWidth || 0,
      handoffSummaryParentWidth: Math.ceil(handoffSummary?.getBoundingClientRect().width || 0),
      captureContextVisible: getComputedStyle(captureContext).display !== "none",
      captureContextWidth: Math.ceil(captureContext.getBoundingClientRect().width),
      captureContextScrollWidth: captureContext.scrollWidth,
      timeRowWidth: Math.ceil(timeRow.getBoundingClientRect().width),
      timeRowScrollWidth: timeRow.scrollWidth,
      timeBackWidth: Math.ceil(document.querySelector("#timeBackBtn").getBoundingClientRect().width),
      timeForwardWidth: Math.ceil(document.querySelector("#timeForwardBtn").getBoundingClientRect().width)
    };
  })()`);

  assert.equal(mobileLayout.shellColumns, 1);
  assert.equal(mobileLayout.workColumns, 1);
  assert.equal(mobileLayout.tabColumns, 2);
  assert.equal(mobileLayout.deskReviewVisible, true);
  assert.equal(mobileLayout.todayActive, true);
  assert.equal(mobileLayout.handoffSummaryVisible, true);
  assert.match(mobileLayout.handoffSummaryText, /Next: export mirror|Mac changed|Mirror ready|Return imported/);
  assert.ok(mobileLayout.handoffSummaryParentWidth <= mobileLayout.innerWidth - 24);
  assert.ok(mobileLayout.handoffSummaryScrollWidth <= mobileLayout.handoffSummaryWidth + 2);
  assert.equal(mobileLayout.captureContextVisible, true);
  assert.ok(mobileLayout.deskReviewWidth <= mobileLayout.innerWidth - 24);
  assert.ok(mobileLayout.captureContextWidth <= mobileLayout.innerWidth - 24);
  assert.ok(mobileLayout.captureContextScrollWidth <= mobileLayout.captureContextWidth + 2);
  assert.ok(mobileLayout.timeRowWidth <= mobileLayout.innerWidth - 24);
  assert.ok(mobileLayout.timeRowScrollWidth <= mobileLayout.timeRowWidth + 2);
  assert.ok(mobileLayout.timeBackWidth >= 44);
  assert.ok(mobileLayout.timeForwardWidth >= 44);
  assert.ok(mobileLayout.documentWidth <= mobileLayout.innerWidth + 2);
  assert.ok(mobileLayout.bodyWidth <= mobileLayout.innerWidth + 2);
  await cdp.close();
  console.log("smoke_browser_ok");
} finally {
  chrome.kill("SIGTERM");
  await waitForProcessExit(chrome, 3000);
  server.close();
  rmSync(smokeRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

async function waitForTarget(port) {
  const endpoint = `http://127.0.0.1:${port}/json`;
  const deadline = Date.now() + 12000;
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

function cleanupStaleSmokeRoots(baseDir, cutoffMs) {
  for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(SMOKE_ROOT_PREFIX)) continue;
    const startedAt = Number(entry.name.slice(SMOKE_ROOT_PREFIX.length));
    if (!Number.isFinite(startedAt) || startedAt >= cutoffMs) continue;
    rmSync(join(baseDir, entry.name), {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100
    });
  }
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
    evaluate(expression) {
      return this.send("Runtime.evaluate", {
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
      });
    },
    on(method, callback) {
      listeners.set(method, [...(listeners.get(method) || []), callback]);
    },
    close() {
      socket.close();
    }
  };
}

async function waitForCdpValue(cdp, expression, predicate, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  let lastError;
  while (Date.now() < deadline) {
    try {
      lastValue = await cdp.evaluate(expression);
      lastError = undefined;
      if (predicate(lastValue)) return lastValue;
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  if (lastError) throw lastError;
  throw new Error(`Timed out waiting for CDP value: ${JSON.stringify(lastValue)}`);
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
