import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve("apps/companion-web");
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"]
]);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://127.0.0.1");
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
const profile = join(tmpdir(), `lc-browser-smoke-${Date.now()}`);
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
      storedVersion: JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}").schemaVersion
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
    document.querySelector("#activityDetailsBtn").click();
    const afterActivityDetails = readState();
    return { before, afterEditableShortcut, afterPanelShortcut, afterActivityDetails };
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
  assert.equal(sidecarLayout.afterPanelShortcut.storedVersion, 1);
  assert.equal(sidecarLayout.afterActivityDetails.shellCompact, false);
  assert.equal(sidecarLayout.afterActivityDetails.activeTab, "captures");
  assert.equal(sidecarLayout.afterActivityDetails.activityAction, "Details");

  const result = await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    setValue("#quoteInput", "Ownership lets Rust make memory safety guarantees.");
    setValue("#thoughtInput", "- Connect this with compiler-enforced lifetimes.");
    setValue("#timestampInput", "08:12");
    document.querySelector("#captureCardBtn").click();
    const activityAfterCard = {
      title: document.querySelector("#activityTitle").textContent,
      detail: document.querySelector("#activityDetail").textContent,
      action: document.querySelector("#activityDetailsBtn").textContent
    };
    document.querySelector("#activityDetailsBtn").click();
    const activityOpenedReviewTab = document.querySelector(".tab.active")?.dataset.tab || "";
    const activityTargetPulsed = Boolean(document.querySelector(".review-card.pulse"));
    setValue("#quoteInput", "Spaced repetition improves durable recall. <script>alert(1)</script> <b>bold</b>");
    const quote = document.querySelector("#quoteInput");
    const start = quote.value.indexOf("durable");
    quote.setSelectionRange(start, start + "durable".length);
    document.querySelector("#captureClozeBtn").click();
    const dueBeforeGood = document.querySelector("#dueMetric").textContent;
    const gradeVisibleBeforeReveal = Boolean(document.querySelector('[data-grade="good"]'));
    document.querySelector('[data-reveal-card]').click();
    const answerVisibleAfterReveal = document.querySelector("#reviewList").textContent.includes("compiler-enforced lifetimes");
    document.querySelector('[data-grade="good"]').click();
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
    const activityAfterSynthesis = document.querySelector("#activityTitle").textContent;
    document.querySelector("#insertSynthesisBtn").click();
    document.querySelector('[data-tab="export"]').click();
    const bookmarklet = document.querySelector("#bookmarkletExport").value;
    const mirror = JSON.parse(document.querySelector("#mirrorExport").value);
    const mirrorText = JSON.stringify(mirror);
    document.querySelector("#newSessionBtn").click();
    const titleAfterNewSession = document.querySelector("#sessionTitle").value;
    const importInput = document.querySelector("#importWorkspaceInput");
    const transfer = new DataTransfer();
    transfer.items.add(new File([mirrorText], "learning-companion-feishu-mirror.json", { type: "application/json" }));
    importInput.files = transfer.files;
    importInput.dispatchEvent(new Event("change", { bubbles: true }));
    return new Promise((resolve) => setTimeout(() => {
      const restoredWorkspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
      const restoredSession = restoredWorkspace.sessions.find((item) => item.id === restoredWorkspace.activeSessionId);
      const restoredMirror = JSON.parse(document.querySelector("#mirrorExport").value);
      const synthesisOccurrences = (restoredSession.notesMarkdown.match(/Synthesis - Learning Companion MVP/g) || []).length;
      const badTransfer = new DataTransfer();
      badTransfer.items.add(new File([JSON.stringify({ ...mirror, canonical: "bad.json" })], "bad-mirror.json", { type: "application/json" }));
      importInput.files = badTransfer.files;
      importInput.dispatchEvent(new Event("change", { bubbles: true }));
      setTimeout(() => {
        const afterFailedImport = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
        const afterFailedSession = afterFailedImport.sessions.find((item) => item.id === afterFailedImport.activeSessionId);
        resolve({
          titleAfterNewSession,
          restoredTitle: restoredSession.title,
          restoredCaptures: restoredSession.captures.length,
          restoredCards: restoredSession.reviewCards.length,
          restoredSourceUrl: restoredSession.sourceUrl,
          failedImportTitle: afterFailedSession.title,
          importInputCleared: importInput.value === "",
          captureMetric: document.querySelector("#captureMetric").textContent,
          cardMetric: document.querySelector("#cardMetric").textContent,
          dueMetric: document.querySelector("#dueMetric").textContent,
          captureText: document.querySelector("#captureList").textContent,
          reviewText: document.querySelector("#reviewList").textContent,
          previewText: document.querySelector("#notesPreview").textContent,
          notesMarkdown: restoredSession.notesMarkdown,
          activityAfterCard,
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
          mirrorSchema: restoredMirror.schema,
          mirrorFileCount: restoredMirror.manifest.fileCount,
          mirrorCanonical: restoredMirror.canonical,
          mirrorBundleFingerprint: restoredMirror.manifest.bundleFingerprint,
          mirrorHasWorkspace: restoredMirror.files.some((file) => file.path === "workspace.json"),
          mirrorHasMarkdown: restoredMirror.files.some((file) => file.path.endsWith(".md") && file.content.includes("Learning Companion MVP")),
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
          schemaVersion: restoredWorkspace.schemaVersion,
          clientId: restoredWorkspace.clientId
        });
      }, 80);
    }, 80));
  })()`);

  assert.equal(exceptions.length, 0);
  assert.equal(result.titleAfterNewSession, "New learning session");
  assert.equal(result.restoredTitle, "Learning Companion MVP");
  assert.equal(result.restoredCaptures, 3);
  assert.equal(result.restoredCards, 2);
  assert.equal(result.restoredSourceUrl, "https://github.com/tonycoder-hub/Learning-Companion");
  assert.equal(result.failedImportTitle, "Learning Companion MVP");
  assert.equal(result.importInputCleared, true);
  assert.equal(result.captures, 3);
  assert.equal(result.cards, 2);
  assert.equal(result.captureMetric, "3");
  assert.equal(result.cardMetric, "2");
  assert.equal(result.dueBeforeGood, "2");
  assert.equal(result.gradeVisibleBeforeReveal, false);
  assert.equal(result.answerVisibleAfterReveal, true);
  assert.equal(result.dueMetric, "1");
  assert.equal(result.dueAfterGood, "1");
  assert.equal(result.gradedCount, 1);
  assert.equal(result.activityAfterCard.title, "Capture and card saved");
  assert.match(result.activityAfterCard.detail, /08:12/);
  assert.equal(result.activityAfterCard.action, "Review");
  assert.equal(result.activityOpenedReviewTab, "review");
  assert.equal(result.activityTargetPulsed, true);
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
  assert.equal(result.mirrorSchema, "learning-companion.mirror-bundle.staging.v1");
  assert.equal(result.mirrorFileCount, 4);
  assert.equal(result.mirrorCanonical, "workspace.json");
  assert.match(result.mirrorBundleFingerprint, /^fnv1a-[a-f0-9]{8}$/);
  assert.equal(result.mirrorHasWorkspace, true);
  assert.equal(result.mirrorHasMarkdown, true);
  assert.equal(result.mirrorFingerprintsValid, true);
  assert.equal(result.schemaVersion, 1);
  assert.match(result.clientId, /^client_/);

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
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent,
      locationSearch: window.location.search
    };
  })()`);

  assert.equal(inbound.sourceTitle, "External course page");
  assert.equal(inbound.sourceUrl, "https://example.com/course");
  assert.equal(inbound.captureMetric, "4");
  assert.equal(inbound.latestQuote, "Inbound bookmarklet capture");
  assert.equal(inbound.latestThought, "Turn this into a note");
  assert.equal(inbound.latestTimestamp, "01:02:03");
  assert.equal(inbound.activityTitle, "Browser capture saved");
  assert.match(inbound.activityDetail, /01:02:03/);
  assert.equal(inbound.locationSearch, "");

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
  await cdp.close();
  console.log("smoke_browser_ok");
} finally {
  chrome.kill("SIGTERM");
  server.close();
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
          throw new Error(result.exceptionDetails.text || "Evaluation failed.");
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

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
