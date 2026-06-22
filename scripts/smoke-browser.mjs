import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  addCapture,
  addSession,
  createDefaultWorkspace,
  generateInboxHtml,
  generateMirrorIndexHtml,
  generateReviewHtml,
  getActiveSession,
  updateSession
} from "../apps/companion-web/src/model.js";

const root = resolve("apps/companion-web");
const chromePath = resolveChromePath();
const smokeBase = resolve(".codex-tmp/browser-smoke");
const SMOKE_ROOT_PREFIX = "lc-browser-smoke-";
const STALE_SMOKE_ROOT_MS = 30 * 60 * 1000;
const cleanupSmokeArtifacts = process.env.LC_CLEAN_SMOKE_ARTIFACTS === "1";

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"]
]);
const virtualRoutes = new Map();
const indexHtmlFixture = await readFile(join(root, "index.html"), "utf8");
const staleShellHtml = indexHtmlFixture
  .replace(/\n\s*<div id="updateNotice" class="storage-notice update-notice" hidden>[\s\S]*?<\/div>(?=\n\s*<div id="importReceipt")/, "")
  .replace(/\n\s*<div id="activityHint" class="next-step-hint" data-next-step-hint="" data-hint-installed="true" hidden>[\s\S]*?<\/div>(?=\n\s*<\/div>\n\s*<div class="activity-actions")/, "")
  .replace(/\n\s*<nav id="sidecarRail" class="sidecar-rail" aria-label="Sidecar study rail" aria-live="off" hidden><\/nav>/, "");
assert.equal(staleShellHtml.includes('id="updateNotice"'), false);
assert.equal(staleShellHtml.includes('id="activityHint"'), false);
assert.equal(staleShellHtml.includes('id="sidecarRail"'), false);
virtualRoutes.set("/stale-shell.html", staleShellHtml);

let twoDueReviewWorkspace = createDefaultWorkspace();
const firstDueSession = getActiveSession(twoDueReviewWorkspace);
twoDueReviewWorkspace = addCapture(twoDueReviewWorkspace, firstDueSession.id, {
  quote: "A priority queue keeps the next lowest-cost path visible.",
  thought: "Recall why Dijkstra's frontier stays greedy-safe."
}, { promoteToReview: true, now: "2026-05-29T00:11:00.000Z" });
twoDueReviewWorkspace = addSession(twoDueReviewWorkspace, "Second due review topic");
const secondDueSession = getActiveSession(twoDueReviewWorkspace);
twoDueReviewWorkspace = addCapture(twoDueReviewWorkspace, secondDueSession.id, {
  quote: "Spaced review should preserve the prompt answer boundary.",
  thought: "Recall why reveal-before-grade matters."
}, { promoteToReview: true, now: "2026-05-29T00:12:00.000Z" });
const twoDueReviewHtml = generateReviewHtml(twoDueReviewWorkspace, new Date("2026-06-03T09:00:00.000Z"));
const sourceOnlyMirrorBase = createDefaultWorkspace();
const sourceOnlyMirrorSession = getActiveSession(sourceOnlyMirrorBase);
const sourceOnlyMirrorWorkspace = updateSession(sourceOnlyMirrorBase, sourceOnlyMirrorSession.id, {
  sourceTitle: "Phone source reading target",
  sourceUrl: "https://example.com/phone-source-reading",
  materialType: "article"
});
const sourceOnlyMirrorHtml = generateMirrorIndexHtml(sourceOnlyMirrorWorkspace, new Date("2026-06-03T09:00:00.000Z"));
const sourceOnlyInboxHtml = generateInboxHtml(sourceOnlyMirrorWorkspace, new Date("2026-06-03T09:00:00.000Z"));
virtualRoutes.set("/mirror-source-mobile.html", sourceOnlyMirrorHtml);
virtualRoutes.set("/mirror-source-inbox-mobile.html", sourceOnlyInboxHtml);

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
if (cleanupSmokeArtifacts) cleanupStaleSmokeRoots(smokeBase, Date.now() - STALE_SMOKE_ROOT_MS);

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
  "--no-sandbox",
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
      registration,
      updateNoticeHidden: document.querySelector("#updateNotice")?.hidden === true,
      updateNoticeText: document.querySelector("#updateNoticeText")?.textContent || ""
    };
  })()`);

  assert.equal(pwa.manifestLink, "./manifest.webmanifest");
  assert.equal(pwa.display, "standalone");
  assert.equal(pwa.startUrl, "./");
  assert.equal(pwa.iconSrc, "./assets/icon.svg");
  assert.equal(pwa.workerCachesStaticAssets, true);
  assert.notEqual(pwa.registration, "unsupported");
  assert.equal(pwa.updateNoticeHidden, true);
  assert.equal(pwa.updateNoticeText, "App update ready");

  const staleShellExceptionCount = exceptions.length;
  await cdp.send("Page.navigate", { url: `${appUrl}stale-shell.html` });
  await sleep(500);
  const staleShellCompat = await cdp.evaluate(`(() => ({
    updateNoticeExists: Boolean(document.querySelector("#updateNotice")),
    updateNoticeCount: document.querySelectorAll("#updateNotice").length,
    updateNoticeHidden: document.querySelector("#updateNotice")?.hidden === true,
    updateNoticeText: document.querySelector("#updateNoticeText")?.textContent || "",
    updateReloadText: document.querySelector("#updateReloadBtn")?.textContent || "",
    activityHintExists: Boolean(document.querySelector("#activityHint")),
    activityHintCount: document.querySelectorAll("#activityHint").length,
    activityHintHidden: document.querySelector("#activityHint")?.hidden === true,
    activityHintInstalled: document.querySelector("#activityHint")?.dataset.hintInstalled || "",
    activityHintButtonExists: Boolean(document.querySelector("#activityHintBtn")),
    sidecarRailExists: Boolean(document.querySelector("#sidecarRail")),
    sidecarRailCount: document.querySelectorAll("#sidecarRail").length,
    sidecarRailHidden: document.querySelector("#sidecarRail")?.hidden === true,
    learningFlowVisible: Boolean(document.querySelector(".learning-flow-panel"))
  }))()`);
  assert.deepEqual(staleShellCompat, {
    updateNoticeExists: true,
    updateNoticeCount: 1,
    updateNoticeHidden: true,
    updateNoticeText: "App update ready",
    updateReloadText: "Reload",
    activityHintExists: true,
    activityHintCount: 1,
    activityHintHidden: true,
    activityHintInstalled: "true",
    activityHintButtonExists: true,
    sidecarRailExists: true,
    sidecarRailCount: 1,
    sidecarRailHidden: true,
    learningFlowVisible: true
  });
  assert.equal(exceptions.length, staleShellExceptionCount);

  await cdp.send("Page.navigate", { url: appUrl });
  await sleep(500);

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await cdp.send("Page.navigate", { url: appUrl });
  await sleep(500);
  const bilingualProbe = await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const originalWorkspaceJson = window.learningCompanionNative.exportWorkspaceJson();
    const select = document.querySelector("#languageSelect");
    select.value = "zh";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector('[data-tab="today"]').click();
    const linkedPanel = document.querySelector(".learning-flow-panel");
    const linkedState = {
      htmlLang: document.documentElement.lang,
      bodyLanguage: document.body.dataset.uiLanguage,
      selectValue: select.value,
      label: document.querySelector("#languageLabel")?.textContent || "",
      panelText: linkedPanel?.textContent || "",
      activityTitle: document.querySelector("#activityTitle")?.textContent || "",
      activityAction: document.querySelector("#activityDetailsBtn")?.textContent || "",
      quickHeading: document.querySelector("#capturePane .panel-heading h2")?.textContent || "",
      starterLabel: document.querySelector("#captureStarterLabel")?.textContent || "",
      starterTexts: [...document.querySelectorAll("[data-capture-starter]")].map((button) => button.textContent),
      prefsLanguage: JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}").language || ""
    };
    const recentWorkspace = JSON.parse(originalWorkspaceJson);
    const recentSession = recentWorkspace.sessions.find((session) => session.id === recentWorkspace.activeSessionId) || recentWorkspace.sessions[0];
    recentSession.captures = [{
      id: "zh_recent_capture",
      quote: "中文模式下的最近摘录。",
      thought: "This confirms Today Next Move uses the selected language.",
      timestamp: "",
      tags: [],
      capturedAt: "2026-06-11T09:00:00.000Z",
      createdAt: "2026-06-11T09:00:00.000Z",
      updatedAt: "2026-06-11T09:00:00.000Z"
    }];
    recentSession.reviewCards = [];
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify(recentWorkspace));
    document.querySelector('[data-tab="today"]').click();
    const recentState = {
      nextMoveText: document.querySelector(".today-path-card")?.textContent || "",
      nextMoveAction: document.querySelector("[data-today-path-action]")?.textContent || "",
      inspectAction: document.querySelector("[data-today-path-target]")?.textContent || "",
      activityTitle: document.querySelector("#activityTitle")?.textContent || "",
      activityAction: document.querySelector("#activityDetailsBtn")?.textContent || ""
    };
    setValue("#searchInput", "中文模式");
    const searchState = {
      placeholder: document.querySelector("#searchInput")?.placeholder || "",
      aria: document.querySelector("#searchInput")?.getAttribute("aria-label") || "",
      expanded: document.querySelector("#searchInput")?.getAttribute("aria-expanded") || "",
      activeDescendant: document.querySelector("#searchInput")?.getAttribute("aria-activedescendant") || "",
      hidden: document.querySelector("#searchResults")?.hidden === true,
      text: document.querySelector("#searchResults")?.textContent || "",
      options: [...document.querySelectorAll("#searchResults [role='option']")].map((button) => ({
        selected: button.getAttribute("aria-selected") || "",
        text: button.textContent
      }))
    };
    setValue("#searchInput", "");
    const noSourceWorkspace = JSON.parse(originalWorkspaceJson);
    const activeSession = noSourceWorkspace.sessions.find((session) => session.id === noSourceWorkspace.activeSessionId) || noSourceWorkspace.sessions[0];
    activeSession.title = "超长中文学习主题用于布局验证";
    activeSession.sourceTitle = "";
    activeSession.sourceUrl = "";
    activeSession.materialType = "article";
    activeSession.captures = [];
    activeSession.reviewCards = [];
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify(noSourceWorkspace));
    document.querySelector('[data-tab="today"]').click();
    document.querySelector('[data-focus-mode="capture"]').click();
    setValue("#quoteInput", "");
    setValue("#thoughtInput", "");
    const noSourcePanel = document.querySelector(".learning-flow-panel");
    const noSourceState = {
      panelText: noSourcePanel?.textContent || "",
      startHereText: noSourcePanel?.querySelector(".start-here-inline")?.textContent || "",
      startButtons: [...(noSourcePanel?.querySelectorAll(".start-here-inline .item-footer [data-start-action]") || [])].map((button) => ({
        action: button.dataset.startAction,
        text: button.textContent,
        aria: button.getAttribute("aria-label") || ""
      })),
      activityTitle: document.querySelector("#activityTitle")?.textContent || "",
      activityDetail: document.querySelector("#activityDetail")?.textContent || "",
      activityAction: document.querySelector("#activityDetailsBtn")?.textContent || "",
      activityAria: document.querySelector("#activityDetailsBtn")?.getAttribute("aria-label") || "",
      contextIntent: document.querySelector("#captureContextIntent")?.textContent || "",
      contextDraft: document.querySelector("#captureContextDraft")?.textContent || "",
      contextSource: document.querySelector("#captureContextSource")?.textContent || "",
      quotePlaceholder: document.querySelector("#quoteInput")?.placeholder || "",
      thoughtPlaceholder: document.querySelector("#thoughtInput")?.placeholder || "",
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      innerWidth: window.innerWidth
    };
    noSourcePanel?.querySelector(".start-here-device-route summary")?.click();
    noSourcePanel?.querySelector(".start-here-device-route [data-start-action='device-flow']")?.click();
    const deviceFlowPanel = document.querySelector(".handoff-card");
    const deviceFlowState = {
      open: deviceFlowPanel?.open === true,
      summaryText: deviceFlowPanel?.querySelector(".device-flow-summary")?.textContent || "",
      detail: deviceFlowPanel?.querySelector(".handoff-detail")?.textContent || "",
      stateText: deviceFlowPanel?.querySelector(".handoff-state-grid")?.textContent || "",
      guideText: deviceFlowPanel?.querySelector(".device-transfer-guide")?.textContent || "",
      stepsText: deviceFlowPanel?.querySelector(".return-files-steps")?.textContent || "",
      boundaryText: [...(deviceFlowPanel?.querySelectorAll(".handoff-boundary") || [])].map((node) => node.textContent).join(" "),
      modeNote: deviceFlowPanel?.querySelector(".return-files-mode-note")?.textContent || "",
      actionHint: deviceFlowPanel?.querySelector(".return-files-action-hint")?.textContent || "",
      buttonTexts: [...(deviceFlowPanel?.querySelectorAll(".return-files-actions button") || [])].map((button) => button.textContent),
      actionGroups: [...(deviceFlowPanel?.querySelectorAll(".return-files-action-group") || [])].map((group) => group.getAttribute("aria-label") || ""),
      activityTitle: document.querySelector("#activityTitle")?.textContent || "",
      activityDetail: document.querySelector("#activityDetail")?.textContent || "",
      activityAction: document.querySelector("#activityDetailsBtn")?.textContent || ""
    };
    select.value = "en";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    window.learningCompanionNative.importWorkspaceJson(originalWorkspaceJson);
    document.querySelector('[data-tab="today"]').click();
    const restoredPanel = document.querySelector(".learning-flow-panel");
    return {
      linkedState,
      recentState,
      searchState,
      noSourceState,
      deviceFlowState,
      restored: {
        htmlLang: document.documentElement.lang,
        bodyLanguage: document.body.dataset.uiLanguage,
        selectValue: document.querySelector("#languageSelect")?.value || "",
        prefsLanguage: JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}").language || "",
        panelText: restoredPanel?.textContent || "",
        quickHeading: document.querySelector("#capturePane .panel-heading h2")?.textContent || "",
        starterLabel: document.querySelector("#captureStarterLabel")?.textContent || ""
      }
    };
  })()`);
  assert.equal(bilingualProbe.linkedState.htmlLang, "zh-CN");
  assert.equal(bilingualProbe.linkedState.bodyLanguage, "zh");
  assert.equal(bilingualProbe.linkedState.selectValue, "zh");
  assert.equal(bilingualProbe.linkedState.label, "语言");
  assert.equal(bilingualProbe.linkedState.prefsLanguage, "zh");
  assert.match(bilingualProbe.linkedState.panelText, /学习流/);
  assert.match(bilingualProbe.linkedState.panelText, /阅读来源/);
  assert.match(bilingualProbe.linkedState.panelText, /在 Mac 上摘录/);
  assert.match(bilingualProbe.linkedState.panelText, /第一条笔记/);
  assert.match(bilingualProbe.linkedState.panelText, /稍后使用其他设备/);
  assert.equal(bilingualProbe.linkedState.activityTitle, "准备摘录");
  assert.equal(bilingualProbe.linkedState.activityAction, "摘录");
  assert.equal(bilingualProbe.linkedState.quickHeading, "快速摘录");
  assert.equal(bilingualProbe.linkedState.starterLabel, "写成");
  assert.deepEqual(bilingualProbe.linkedState.starterTexts, ["问题", "回答", "收获"]);
  assert.match(bilingualProbe.recentState.nextMoveText, /下一步/);
  assert.match(bilingualProbe.recentState.nextMoveText, /选择最新摘录的下一步/);
  assert.equal(bilingualProbe.recentState.nextMoveAction, "选择下一步");
  assert.equal(bilingualProbe.recentState.inspectAction, "最近");
  assert.equal(bilingualProbe.recentState.activityTitle, "最新摘录");
  assert.equal(bilingualProbe.recentState.activityAction, "详情");
  assert.equal(bilingualProbe.searchState.placeholder, "搜索主题、笔记、摘录");
  assert.equal(bilingualProbe.searchState.aria, "搜索主题、笔记、摘录");
  assert.equal(bilingualProbe.searchState.expanded, "true");
  assert.equal(bilingualProbe.searchState.activeDescendant, "search-result-0");
  assert.equal(bilingualProbe.searchState.hidden, false);
  assert.match(bilingualProbe.searchState.text, /查找/);
  assert.match(bilingualProbe.searchState.text, /个匹配/);
  assert.match(bilingualProbe.searchState.text, /摘录/);
  assert.match(bilingualProbe.searchState.text, /中文模式下的最近摘录/);
  assert.ok(
    bilingualProbe.searchState.options.some((option) => option.selected === "true" && /中文模式下的最近摘录/.test(option.text)),
    "Expected the Chinese search result list to select the matching capture"
  );
  assert.match(bilingualProbe.noSourceState.panelText, /需要来源/);
  assert.match(bilingualProbe.noSourceState.panelText, /先设置来源/);
  assert.match(bilingualProbe.noSourceState.startHereText, /第一条笔记/);
  assert.match(bilingualProbe.noSourceState.startHereText, /先把这次学习锚定到浏览器来源/);
  assert.deepEqual(bilingualProbe.noSourceState.startButtons.map((button) => [button.action, button.text]), [
    ["source", "粘贴来源"],
    ["source-manual", "手动设置来源"],
    ["capture", "先记想法"],
    ["question", "提出问题"],
    ["clipper", "设置页面 clipper"]
  ]);
  assert.equal(bilingualProbe.noSourceState.activityTitle, "绑定来源或先记想法");
  assert.match(bilingualProbe.noSourceState.activityDetail, /先粘贴浏览器 URL/);
  assert.equal(bilingualProbe.noSourceState.activityAction, "设置来源");
  assert.equal(bilingualProbe.noSourceState.activityAria, "聚焦来源 URL");
  assert.equal(bilingualProbe.noSourceState.contextIntent, "无来源");
  assert.match(bilingualProbe.noSourceState.contextDraft, /还没有可继续的来源/);
  assert.equal(bilingualProbe.noSourceState.contextSource, "无来源");
  assert.match(bilingualProbe.noSourceState.quotePlaceholder, /原文|字幕/);
  assert.match(bilingualProbe.noSourceState.thoughtPlaceholder, /笔记|问题/);
  assert.ok(
    Math.max(bilingualProbe.noSourceState.documentWidth, bilingualProbe.noSourceState.bodyWidth) <= bilingualProbe.noSourceState.innerWidth,
    `Expected Chinese mobile surface to avoid horizontal overflow, got doc=${bilingualProbe.noSourceState.documentWidth}, body=${bilingualProbe.noSourceState.bodyWidth}, inner=${bilingualProbe.noSourceState.innerWidth}`
  );
  assert.equal(bilingualProbe.deviceFlowState.open, true);
  assert.match(bilingualProbe.deviceFlowState.summaryText, /设备流程/);
  assert.match(bilingualProbe.deviceFlowState.summaryText, /手动传输/);
  assert.match(bilingualProbe.deviceFlowState.summaryText, /无实时同步/);
  assert.match(bilingualProbe.deviceFlowState.detail, /导出镜像/);
  assert.match(bilingualProbe.deviceFlowState.stateText, /还没有导出镜像/);
  assert.match(bilingualProbe.deviceFlowState.stateText, /还没有导入返回/);
  assert.match(bilingualProbe.deviceFlowState.guideText, /手动往返/);
  assert.match(bilingualProbe.deviceFlowState.guideText, /导出前先明确文件去向/);
  assert.match(bilingualProbe.deviceFlowState.stepsText, /在这台 Mac 上导出镜像/);
  assert.match(bilingualProbe.deviceFlowState.boundaryText, /仅手动传输/);
  assert.match(bilingualProbe.deviceFlowState.boundaryText, /飞书云文档/);
  assert.match(bilingualProbe.deviceFlowState.modeNote, /先粘贴或导入返回文件/);
  assert.match(bilingualProbe.deviceFlowState.actionHint, /下一步：导出镜像/);
  assert.deepEqual(bilingualProbe.deviceFlowState.buttonTexts, ["导出镜像", "导入返回文件", "粘贴返回文件"]);
  assert.deepEqual(bilingualProbe.deviceFlowState.actionGroups, ["发送镜像", "带回返回文件"]);
  assert.equal(bilingualProbe.deviceFlowState.activityTitle, "设备流程已打开");
  assert.match(bilingualProbe.deviceFlowState.activityDetail, /手动手机\/Windows 传输/);
  assert.equal(bilingualProbe.deviceFlowState.activityAction, "设备流程");
  assert.equal(bilingualProbe.restored.htmlLang, "en");
  assert.equal(bilingualProbe.restored.bodyLanguage, "en");
  assert.equal(bilingualProbe.restored.selectValue, "en");
  assert.equal(bilingualProbe.restored.prefsLanguage, "en");
  assert.match(bilingualProbe.restored.panelText, /Learning Flow/);
  assert.equal(bilingualProbe.restored.quickHeading, "Quick Capture");
  assert.equal(bilingualProbe.restored.starterLabel, "Write as");

  await cdp.send("Emulation.clearDeviceMetricsOverride");
  await cdp.send("Page.navigate", { url: appUrl });
  await sleep(500);

  const firstRun = await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const readTodayFlowMove = () => ({
      flowSteps: [...(document.querySelectorAll(".learning-flow-panel [data-learning-flow-step]") || [])].map((step) => ({
        kind: step.dataset.learningFlowStep,
        text: step.textContent
      })),
      nextMoveText: document.querySelector(".today-path-card")?.textContent || "",
      nextMoveKind: document.querySelector("[data-today-path-action]")?.dataset.todayPathAction || "",
      nextMoveAction: document.querySelector("[data-today-path-action]")?.textContent || "",
      inspectTarget: document.querySelector("[data-today-path-target]")?.dataset.todayPathTarget || ""
    });
    document.querySelector('[data-tab="today"]').click();
    const panel = document.querySelector(".learning-flow-panel");
    const card = document.querySelector(".start-here-inline");
    const before = {
      text: panel?.textContent || "",
      sourceStep: panel?.querySelector('[data-learning-flow-step="source"]')?.textContent || "",
      sourceActionAria: panel?.querySelector('[data-learning-flow-step="source"] button')?.getAttribute("aria-label") || "",
      sourceWide: panel?.querySelector('[data-learning-flow-step="source"]')?.classList.contains("is-wide") === true,
      deviceFlowVisible: Boolean(panel?.querySelector(".handoff-card")),
      deviceRouteText: panel?.querySelector(".start-here-device-route")?.textContent || "",
      deviceRouteAria: panel?.querySelector(".start-here-device-route")?.getAttribute("aria-label") || "",
      deviceRouteOpen: panel?.querySelector(".start-here-device-route")?.open === true,
      deviceRouteSummaryText: panel?.querySelector(".start-here-device-route summary")?.textContent || "",
      deviceRouteActionAria: panel?.querySelector(".start-here-device-route [data-start-action='device-flow']")?.getAttribute("aria-label") || "",
      deviceRouteActionVisible: (() => {
        const rect = panel?.querySelector(".start-here-device-route [data-start-action='device-flow']")?.getBoundingClientRect();
        return Boolean(rect && rect.width > 0 && rect.height > 0);
      })(),
      firstTodayPanel: document.querySelector("#todayTab")?.firstElementChild?.className || "",
      firstTodayBlock: document.querySelector("#todayList")?.firstElementChild?.className || "",
      secondTodayBlock: document.querySelector("#todayList")?.children?.[1]?.className || "",
      firstFlowKind: panel?.querySelector(".learning-flow-track")?.firstElementChild?.dataset.learningFlowStep || "",
      flowSteps: [...(panel?.querySelectorAll("[data-learning-flow-step]") || [])].map((step) => ({
        kind: step.dataset.learningFlowStep,
        text: step.textContent,
        wide: step.classList.contains("is-wide")
      })),
      flowTrackHeight: Math.round(panel?.querySelector(".learning-flow-track")?.getBoundingClientRect().height || 0),
      startHereHeight: Math.round(card?.getBoundingClientRect().height || 0),
      deviceRouteHeight: Math.round(panel?.querySelector(".start-here-device-route")?.getBoundingClientRect().height || 0),
      buttons: [...(card?.querySelectorAll("button") || [])].map((button) => ({
        action: button.dataset.startAction,
        text: button.textContent
      })),
      visibleButtons: [...(card?.querySelectorAll("button") || [])].filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).map((button) => ({
        action: button.dataset.startAction,
        text: button.textContent
      }))
    };
    card?.querySelector(".start-here-device-route summary")?.click();
    const deviceRouteOpenBeforeClick = document.querySelector(".start-here-device-route")?.open === true;
    card?.querySelector('[data-start-action="device-flow"]')?.click();
    const firstNoteDeviceFlowReveal = {
      deviceRouteOpenBeforeClick,
      deviceFlowVisible: Boolean(document.querySelector(".learning-flow-panel .handoff-card")),
      deviceFlowOpen: document.querySelector(".learning-flow-panel .handoff-card")?.open === true,
      deviceRouteStillVisible: Boolean(document.querySelector(".learning-flow-panel .start-here-device-route")),
      deviceFlowButtonStillVisible: Boolean(document.querySelector('.start-here-inline [data-start-action="device-flow"]')),
      activityTitle: document.querySelector("#activityTitle")?.textContent || "",
      activityDetail: document.querySelector("#activityDetail")?.textContent || ""
    };
    const originalWorkspaceJson = window.learningCompanionNative.exportWorkspaceJson();
    const nonEmptyWorkspace = JSON.parse(originalWorkspaceJson);
    const nonEmptySession = nonEmptyWorkspace.sessions.find((session) => session.id === nonEmptyWorkspace.activeSessionId) || nonEmptyWorkspace.sessions[0];
    nonEmptySession.captures = [{
      id: "capture_loop_reappears",
      quote: "Loop reappears after the first capture.",
      thought: "This keeps empty-state simplification from hiding later loop pressure.",
      timestamp: "",
      tags: [],
      capturedAt: "2026-06-03T09:00:00.000Z",
      createdAt: "2026-06-03T09:00:00.000Z",
      updatedAt: "2026-06-03T09:00:00.000Z"
    }];
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify(nonEmptyWorkspace));
    document.querySelector('[data-tab="today"]').click();
    const nonEmptyFlowSteps = [...(document.querySelectorAll(".learning-flow-panel [data-learning-flow-step]") || [])].map((step) => ({
      kind: step.dataset.learningFlowStep,
      text: step.textContent
    }));
    const nonEmptyDeviceFlowVisible = Boolean(document.querySelector(".learning-flow-panel .handoff-card"));
    const mixedQuestionDraftWorkspace = JSON.parse(originalWorkspaceJson);
    const mixedQuestionDraftSession = {
      ...mixedQuestionDraftWorkspace.sessions[0],
      id: "mixed_question_draft_flow",
      title: "Mixed question draft flow",
      sourceTitle: "Mixed flow source",
      sourceUrl: "https://example.com/mixed-flow",
      materialType: "doc",
      notesMarkdown: "",
      captures: [{
        id: "capture_mixed_open_question",
        quote: "The proof hints at a missing invariant.",
        thought: "Question: Why does the invariant make this step safe?",
        timestamp: "",
        tags: [],
        capturedAt: "2026-06-03T09:10:00.000Z",
        createdAt: "2026-06-03T09:10:00.000Z",
        updatedAt: "2026-06-03T09:10:00.000Z",
        sourceTitle: "Mixed flow source",
        sourceUrl: "https://example.com/mixed-flow"
      }],
      reviewCards: []
    };
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify({
      ...mixedQuestionDraftWorkspace,
      activeSessionId: mixedQuestionDraftSession.id,
      sessions: [mixedQuestionDraftSession],
      importedPatches: [],
      importedReviewPatches: []
    }));
    document.querySelector('[data-tab="captures"]').click();
    setValue("#thoughtInput", "Takeaway: this unfinished draft should wait behind the open question.");
    document.querySelector('[data-tab="today"]').click();
    const mixedQuestionDraftFlow = readTodayFlowMove();
    document.querySelector("#clearCaptureDraftBtn")?.click();
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify({
      ...mixedQuestionDraftWorkspace,
      activeSessionId: mixedQuestionDraftSession.id,
      sessions: [{
        ...mixedQuestionDraftSession,
        captures: [],
        reviewCards: []
      }],
      importedPatches: [],
      importedReviewPatches: []
    }));
    document.querySelector('[data-tab="captures"]').click();
    setValue("#thoughtInput", "Takeaway: this draft should be the next move when no question is open.");
    document.querySelector('[data-tab="today"]').click();
    const draftOnlyFlow = readTodayFlowMove();
    document.querySelector("#clearCaptureDraftBtn")?.click();
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify({
      ...mixedQuestionDraftWorkspace,
      activeSessionId: mixedQuestionDraftSession.id,
      sessions: [{
        ...mixedQuestionDraftSession,
        reviewCards: [{
          id: "review_mixed_priority_card",
          prompt: "Recall the highest-priority review card.",
          answer: "Due review stays ahead of question and draft work.",
          sourceCaptureId: "capture_mixed_open_question",
          evidenceCaptureId: "",
          dueAt: "2026-05-29T08:00:00.000Z",
          strength: 0,
          createdAt: "2026-05-29T08:00:00.000Z",
          updatedAt: "2026-05-29T08:00:00.000Z",
          lastReviewedAt: null,
          originClientId: mixedQuestionDraftWorkspace.clientId
        }]
      }],
      importedPatches: [],
      importedReviewPatches: []
    }));
    document.querySelector('[data-tab="captures"]').click();
    setValue("#thoughtInput", "Takeaway: this draft should wait behind review and question work.");
    document.querySelector('[data-tab="today"]').click();
    const reviewQuestionDraftFlow = readTodayFlowMove();
    document.querySelector("#clearCaptureDraftBtn")?.click();
    window.learningCompanionNative.importWorkspaceJson(originalWorkspaceJson);
    document.querySelector('[data-tab="today"]').click();
    document.querySelector(".start-here-inline")?.querySelector('[data-start-action="question"]')?.click();
    const originalWorkspace = JSON.parse(originalWorkspaceJson);
    const linkedDraft = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}")
      .captureDrafts?.[originalWorkspace.activeSessionId] || {};
    const linkedQuestion = {
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activeElement: document.activeElement?.id || "",
      thoughtValue: document.querySelector("#thoughtInput")?.value || "",
      activityTitle: document.querySelector("#activityTitle")?.textContent || "",
      activityDetail: document.querySelector("#activityDetail")?.textContent || "",
      activityAction: document.querySelector("#activityDetailsBtn")?.textContent || "",
      activityAria: document.querySelector("#activityDetailsBtn")?.getAttribute("aria-label") || "",
      draftSourceTitle: linkedDraft.sourceTitle || "",
      draftSourceUrl: linkedDraft.sourceUrl || ""
    };
    document.querySelector("#clearCaptureDraftBtn")?.click();
    document.querySelector('[data-tab="today"]').click();
    document.querySelector(".start-here-inline")?.querySelector('[data-start-action="clipper"]')?.click();
    const clipperHandoff = {
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activeElement: document.activeElement?.id || "",
      activityTitle: document.querySelector("#activityTitle")?.textContent || "",
      activityDetail: document.querySelector("#activityDetail")?.textContent || "",
      bookmarkletSelected: document.querySelector("#bookmarkletExport")?.selectionStart === 0
        && document.querySelector("#bookmarkletExport")?.selectionEnd === document.querySelector("#bookmarkletExport")?.value.length
    };
    document.querySelector('[data-tab="today"]').click();
    document.querySelector(".start-here-inline")?.querySelector('[data-start-action="capture"]')?.click();
    return {
      ...before,
      firstNoteDeviceFlowReveal,
      nonEmptyFlowSteps,
      nonEmptyDeviceFlowVisible,
      mixedQuestionDraftFlow,
      draftOnlyFlow,
      reviewQuestionDraftFlow,
      linkedQuestion,
      clipperHandoff,
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activeElement: document.activeElement?.id || "",
      capturePanePulsed: document.querySelector("#capturePane")?.classList.contains("pulse") === true,
      activity: document.querySelector("#activityTitle")?.textContent || ""
    };
  })()`);

  await cdp.send("Page.navigate", { url: appUrl });
  await sleep(300);
  const firstRunLoopKeyboardBefore = await cdp.evaluate(`(() => {
    document.querySelector('[data-tab="today"]').click();
    const loopButton = document.querySelector('[data-learning-flow-step="loop"] button');
    loopButton?.focus();
    return {
      loopText: document.querySelector('[data-learning-flow-step="loop"]')?.textContent || "",
      buttonText: loopButton?.textContent || "",
      buttonTag: loopButton?.tagName || "",
      buttonType: loopButton?.getAttribute("type") || "",
      buttonAria: loopButton?.getAttribute("aria-label") || "",
      activeElementText: document.activeElement?.textContent || "",
      activeElementAria: document.activeElement?.getAttribute("aria-label") || ""
    };
  })()`);
  const firstRunLoopKeyboard = await cdp.evaluate(`(() => {
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true
    });
    const dispatchResult = document.activeElement?.dispatchEvent(event);
    return {
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activeElement: document.activeElement?.id || "",
      activityTitle: document.querySelector("#activityTitle")?.textContent || "",
      activityDetail: document.querySelector("#activityDetail")?.textContent || "",
      activityAction: document.querySelector("#activityDetailsBtn")?.textContent || "",
      activityAria: document.querySelector("#activityDetailsBtn")?.getAttribute("aria-label") || "",
      capturePanePulsed: document.querySelector("#capturePane")?.classList.contains("pulse") === true,
      defaultPrevented: event.defaultPrevented,
      dispatchResult
    };
  })()`);
  assert.match(firstRun.text, /Learning Flow/);
  assert.match(firstRun.sourceStep, /Read source/);
  assert.match(firstRun.sourceStep, /Source linked/);
  assert.match(firstRun.sourceStep, /Open source/);
  assert.match(firstRun.sourceActionAria, /Open Product design desk/);
  assert.equal(firstRun.sourceWide, false);
  assert.equal(firstRun.deviceFlowVisible, false);
  assert.equal(firstRun.firstTodayPanel, "item-list");
  assert.match(
    firstRun.firstTodayBlock,
    /learning-flow-panel/,
    `Expected Today first content block to be learning-flow-panel, got: ${firstRun.firstTodayBlock}`
  );
  assert.match(
    firstRun.secondTodayBlock,
    /today-summary/,
    `Expected Today second content block to be today-summary, got: ${firstRun.secondTodayBlock}`
  );
  assert.equal(firstRun.firstFlowKind, "source");
  assert.deepEqual(firstRun.flowSteps.map((step) => step.kind), ["source", "capture", "loop"]);
  assert.equal(firstRun.flowSteps.find((step) => step.kind === "loop")?.wide, true);
  assert.ok(firstRun.flowTrackHeight <= 330, `Expected compact learning-flow track, got ${firstRun.flowTrackHeight}px`);
  assert.ok(firstRun.startHereHeight <= 300, `Expected compact first-note card, got ${firstRun.startHereHeight}px`);
  assert.ok(firstRun.deviceRouteHeight <= 110, `Expected compact collapsed device route, got ${firstRun.deviceRouteHeight}px`);
  assert.match(firstRun.text, /Capture on Mac/);
  assert.match(firstRun.flowSteps.find((step) => step.kind === "loop")?.text || "", /Pending/);
  assert.match(firstRun.flowSteps.find((step) => step.kind === "loop")?.text || "", /After first capture/);
  assert.match(firstRun.flowSteps.find((step) => step.kind === "loop")?.text || "", /Notes/);
  assert.match(firstRun.flowSteps.find((step) => step.kind === "loop")?.text || "", /Review/);
  assert.match(firstRun.flowSteps.find((step) => step.kind === "loop")?.text || "", /later phone\/Windows pass/);
  assert.match(firstRunLoopKeyboardBefore.loopText, /Pending - After first capture/);
  assert.equal(firstRunLoopKeyboardBefore.buttonText, "Capture first");
  assert.equal(firstRunLoopKeyboardBefore.buttonTag, "BUTTON");
  assert.equal(firstRunLoopKeyboardBefore.buttonType, "button");
  assert.equal(firstRunLoopKeyboardBefore.buttonAria, "Capture the first point before closing the learning loop");
  assert.equal(firstRunLoopKeyboardBefore.activeElementText, "Capture first");
  assert.equal(firstRunLoopKeyboardBefore.activeElementAria, "Capture the first point before closing the learning loop");
  assert.equal(firstRunLoopKeyboard.activeTab, "captures");
  assert.equal(firstRunLoopKeyboard.activeElement, "thoughtInput");
  assert.equal(firstRunLoopKeyboard.activityTitle, "First capture ready");
  assert.match(firstRunLoopKeyboard.activityDetail, /Save to unlock Notes, Review, and return files/);
  assert.equal(firstRunLoopKeyboard.activityAction, "Capture");
  assert.equal(firstRunLoopKeyboard.activityAria, "Open capture");
  assert.equal(firstRunLoopKeyboard.capturePanePulsed, true);
  assert.equal(firstRunLoopKeyboard.defaultPrevented, true);
  assert.equal(firstRunLoopKeyboard.dispatchResult, false);
  assert.doesNotMatch(firstRun.text, /Close the loopClear/);
  assert.deepEqual(firstRun.nonEmptyFlowSteps.map((step) => step.kind), ["source", "capture", "loop"]);
  assert.equal(firstRun.nonEmptyDeviceFlowVisible, true);
  assert.match(firstRun.nonEmptyFlowSteps.find((step) => step.kind === "loop")?.text || "", /Close the loop/);
  assert.deepEqual(firstRun.mixedQuestionDraftFlow.flowSteps.map((step) => step.kind), ["source", "capture", "loop"]);
  assert.match(firstRun.mixedQuestionDraftFlow.flowSteps.find((step) => step.kind === "loop")?.text || "", /1 open/);
  assert.match(firstRun.mixedQuestionDraftFlow.flowSteps.find((step) => step.kind === "loop")?.text || "", /Answer/);
  assert.match(firstRun.mixedQuestionDraftFlow.nextMoveText, /Answer 1 open question/);
  assert.doesNotMatch(firstRun.mixedQuestionDraftFlow.nextMoveText, /Resume capture draft/);
  assert.equal(firstRun.mixedQuestionDraftFlow.nextMoveKind, "question");
  assert.equal(firstRun.mixedQuestionDraftFlow.nextMoveAction, "Answer");
  assert.equal(firstRun.mixedQuestionDraftFlow.inspectTarget, "open_questions");
  assert.match(firstRun.draftOnlyFlow.flowSteps.find((step) => step.kind === "loop")?.text || "", /1 draft/);
  assert.match(firstRun.draftOnlyFlow.nextMoveText, /Resume capture draft/);
  assert.equal(firstRun.draftOnlyFlow.nextMoveKind, "draft");
  assert.equal(firstRun.draftOnlyFlow.nextMoveAction, "Resume");
  assert.equal(firstRun.draftOnlyFlow.inspectTarget, "capture_drafts");
  assert.match(firstRun.reviewQuestionDraftFlow.flowSteps.find((step) => step.kind === "loop")?.text || "", /1 due/);
  assert.match(firstRun.reviewQuestionDraftFlow.nextMoveText, /Review 1 due card/);
  assert.equal(firstRun.reviewQuestionDraftFlow.nextMoveKind, "review");
  assert.equal(firstRun.reviewQuestionDraftFlow.nextMoveAction, "Review");
  assert.equal(firstRun.reviewQuestionDraftFlow.inspectTarget, "due_review");
  assert.match(firstRun.text, /First Note/);
  assert.match(firstRun.text, /Choose the first thing to bring back from this source/);
  assert.match(firstRun.deviceRouteText, /Other devices/);
  assert.match(firstRun.deviceRouteText, /Use phone or Windows later/);
  assert.match(firstRun.deviceRouteText, /Export mirror after first capture/);
  assert.match(firstRun.deviceRouteText, /Bring return files back to this Mac/);
  assert.match(firstRun.deviceRouteText, /No live sync/);
  assert.equal(firstRun.deviceRouteOpen, false);
  assert.match(firstRun.deviceRouteSummaryText, /Other devices later/);
  assert.match(firstRun.deviceRouteSummaryText, /Use phone or Windows later/);
  assert.match(firstRun.deviceRouteSummaryText, /no live sync/i);
  assert.equal(firstRun.deviceRouteActionVisible, false);
  assert.match(firstRun.deviceRouteAria, /manual phone and Windows route/);
  assert.match(firstRun.deviceRouteActionAria, /Open manual phone and Windows transfer route/);
  assert.deepEqual(firstRun.buttons, [
    { action: "capture", text: "Capture this thought" },
    { action: "question", text: "Ask about this" },
    { action: "clipper", text: "Set up page clipper" },
    { action: "device-flow", text: "Phone/Windows" }
  ]);
  assert.deepEqual(firstRun.visibleButtons, [
    { action: "capture", text: "Capture this thought" },
    { action: "question", text: "Ask about this" },
    { action: "clipper", text: "Set up page clipper" }
  ]);
  assert.equal(firstRun.firstNoteDeviceFlowReveal.deviceRouteOpenBeforeClick, true);
  assert.equal(firstRun.firstNoteDeviceFlowReveal.deviceFlowVisible, true);
  assert.equal(firstRun.firstNoteDeviceFlowReveal.deviceFlowOpen, true);
  assert.equal(firstRun.firstNoteDeviceFlowReveal.deviceRouteStillVisible, false);
  assert.equal(firstRun.firstNoteDeviceFlowReveal.deviceFlowButtonStillVisible, false);
  assert.equal(firstRun.firstNoteDeviceFlowReveal.activityTitle, "Device Flow opened");
  assert.match(firstRun.firstNoteDeviceFlowReveal.activityDetail, /Manual phone\/Windows transfer/);
  assert.equal(firstRun.activeTab, "captures");
  assert.equal(firstRun.activeElement, "thoughtInput");
  assert.equal(firstRun.capturePanePulsed, true);
  assert.equal(firstRun.activity, "Ready to capture");
  assert.equal(firstRun.linkedQuestion.activeTab, "captures");
  assert.equal(firstRun.linkedQuestion.activeElement, "thoughtInput");
  assert.equal(firstRun.linkedQuestion.thoughtValue, "Question:");
  assert.equal(firstRun.linkedQuestion.activityTitle, "Question draft started");
  assert.match(firstRun.linkedQuestion.activityDetail, /Question ready in Quick Capture for Product design desk/);
  assert.doesNotMatch(firstRun.linkedQuestion.activityDetail, /no source yet|add a source/i);
  assert.equal(firstRun.linkedQuestion.activityAction, "Capture");
  assert.equal(firstRun.linkedQuestion.activityAria, "Open capture");
  assert.equal(firstRun.linkedQuestion.draftSourceTitle, "Product design desk");
  assert.match(firstRun.linkedQuestion.draftSourceUrl, /github\.com\/tonycoder-hub\/Learning-Companion/);
  assert.equal(firstRun.clipperHandoff.activeTab, "export");
  assert.equal(firstRun.clipperHandoff.activeElement, "bookmarkletExport");
  assert.equal(firstRun.clipperHandoff.activityTitle, "Current page clipper ready");
  assert.match(firstRun.clipperHandoff.activityDetail, /Copy Clip/);
  assert.match(firstRun.clipperHandoff.activityDetail, /browser bookmark/);
  assert.equal(firstRun.clipperHandoff.bookmarkletSelected, true);

  const firstNoteDeviceRouteLayouts = [];
  for (const width of [1024, 620, 360]) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 844,
      deviceScaleFactor: width <= 620 ? 2 : 1,
      mobile: width <= 620
    });
    await cdp.send("Page.navigate", { url: appUrl });
    await sleep(300);
    firstNoteDeviceRouteLayouts.push(await cdp.evaluate(`(() => {
      document.querySelector('[data-tab="today"]').click();
      const route = document.querySelector(".start-here-device-route");
      const copy = document.querySelector(".start-here-device-copy");
      const heading = document.querySelector(".start-here-device-heading");
      const steps = document.querySelector(".start-here-device-steps");
      const action = document.querySelector(".start-here-device-route [data-start-action='device-flow']");
      const badgeRow = document.querySelector(".start-here-device-route .device-flow-badges");
      const rect = (node) => {
        const box = node?.getBoundingClientRect();
        return box ? {
          width: Math.ceil(box.width),
          height: Math.ceil(box.height),
          left: Math.floor(box.left),
          right: Math.ceil(box.right)
        } : { width: 0, height: 0, left: 0, right: 0 };
      };
      const routeText = route?.textContent || "";
      const routeRect = rect(route);
      const closedActionRect = rect(action);
      const actionText = action?.textContent || "";
      const actionAria = action?.getAttribute("aria-label") || "";
      const routeInitiallyOpen = route?.open === true;
      route?.querySelector("summary")?.click();
      const routeOpenAfterSummary = route?.open === true;
      const copyClientWidth = copy?.clientWidth || 0;
      const copyScrollWidth = copy?.scrollWidth || 0;
      const headingClientWidth = heading?.clientWidth || 0;
      const headingScrollWidth = heading?.scrollWidth || 0;
      const stepsClientWidth = steps?.clientWidth || 0;
      const stepsScrollWidth = steps?.scrollWidth || 0;
      const actionRect = rect(action);
      const badgeRowRect = rect(badgeRow);
      action?.click();
      const guide = document.querySelector("[data-device-transfer-guide]");
      const guideGrid = document.querySelector(".device-transfer-grid");
      const guideSummary = document.querySelector(".device-transfer-guide summary");
      return {
        viewport: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        routeText,
        routeRect,
        copyClientWidth,
        copyScrollWidth,
        headingClientWidth,
        headingScrollWidth,
        stepsClientWidth,
        stepsScrollWidth,
        closedActionRect,
        actionRect,
        actionText,
        actionAria,
        badgeRowRect,
        routeInitiallyOpen,
        routeOpenAfterSummary,
        guideText: guide?.textContent || "",
        guideOpen: guide?.open === true,
        guideRect: rect(guide),
        guideGridClientWidth: guideGrid?.clientWidth || 0,
        guideGridScrollWidth: guideGrid?.scrollWidth || 0,
        guideSummaryClientWidth: guideSummary?.clientWidth || 0,
        guideSummaryScrollWidth: guideSummary?.scrollWidth || 0
      };
    })()`));
  }
  await cdp.send("Emulation.clearDeviceMetricsOverride");
  for (const layout of firstNoteDeviceRouteLayouts) {
    assert.ok(layout.documentWidth <= layout.viewport + 1, JSON.stringify(layout));
    assert.ok(layout.bodyWidth <= layout.viewport + 1, JSON.stringify(layout));
    assert.match(layout.routeText, /Use phone or Windows later/);
    assert.match(layout.routeText, /No live sync/);
    assert.equal(layout.actionText, "Phone/Windows");
    assert.match(layout.actionAria, /Open manual phone and Windows transfer route/);
    assert.equal(layout.routeInitiallyOpen, false);
    assert.equal(layout.routeOpenAfterSummary, true);
    assert.ok(layout.routeRect.width <= layout.viewport - 24, JSON.stringify(layout));
    assert.equal(layout.closedActionRect.width, 0, JSON.stringify(layout));
    assert.equal(layout.closedActionRect.height, 0, JSON.stringify(layout));
    assert.ok(layout.actionRect.width >= 96, JSON.stringify(layout));
    assert.ok(layout.actionRect.right <= layout.routeRect.right + 1, JSON.stringify(layout));
    assert.ok(layout.copyScrollWidth <= layout.copyClientWidth + 1, JSON.stringify(layout));
    assert.ok(layout.headingScrollWidth <= layout.headingClientWidth + 1, JSON.stringify(layout));
    assert.ok(layout.stepsScrollWidth <= layout.stepsClientWidth + 1, JSON.stringify(layout));
    assert.equal(layout.guideOpen, true, JSON.stringify(layout));
    assert.match(layout.guideText, /Manual round trip/);
    assert.match(layout.guideText, /Mac -> Windows/);
    assert.match(layout.guideText, /Mac -> Harmony/);
    assert.match(layout.guideText, /will not auto-scan Downloads/);
    assert.ok(layout.guideRect.width <= layout.viewport - 24, JSON.stringify(layout));
    assert.ok(layout.guideGridScrollWidth <= layout.guideGridClientWidth + 1, JSON.stringify(layout));
    assert.ok(layout.guideSummaryScrollWidth <= layout.guideSummaryClientWidth + 1, JSON.stringify(layout));
  }

  const firstNoteWithHandoffFixture = await cdp.evaluate(`(() => {
    const workspaceJson = localStorage.getItem("learning-companion.workspace.v1") || "";
    const uiJson = localStorage.getItem("learning-companion.ui.v1") || "";
    const workspace = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    workspace.importedPatches = [];
    workspace.importedReviewPatches = [];
    workspace.sessions = workspace.sessions.map((session) => ({
      ...session,
      captures: [],
      reviewCards: []
    }));
    localStorage.setItem("learning-companion.workspace.v1", JSON.stringify(workspace));
    localStorage.setItem("learning-companion.ui.v1", JSON.stringify({
      sidecarLayout: false,
      captureDrafts: {},
      mirrorHandoff: {
        workspaceFingerprint: "12345678",
        returnBaseFingerprint: "fnv1a-abcdef12",
        exportedAt: "2026-06-04T04:35:00.000Z",
        kind: "Mirror JSON",
        exportStats: {}
      }
    }));
    return { workspaceJson, uiJson };
  })()`);
  await cdp.send("Page.navigate", { url: appUrl });
  await sleep(500);
  const firstNoteHandoffVisible = await cdp.evaluate(`(() => ({
    startHere: Boolean(document.querySelector(".start-here-inline")),
    deviceFlowVisible: Boolean(document.querySelector(".learning-flow-panel .handoff-card")),
    deviceFlowText: document.querySelector(".learning-flow-panel .handoff-card")?.textContent || ""
  }))()`);
  assert.equal(firstNoteHandoffVisible.startHere, true);
  assert.equal(firstNoteHandoffVisible.deviceFlowVisible, true);
  assert.match(firstNoteHandoffVisible.deviceFlowText, /Device Flow/);
  await cdp.evaluate(`(() => {
    localStorage.setItem("learning-companion.workspace.v1", ${JSON.stringify(firstNoteWithHandoffFixture.workspaceJson)});
    localStorage.setItem("learning-companion.ui.v1", ${JSON.stringify(firstNoteWithHandoffFixture.uiJson)});
  })()`);
  await cdp.send("Page.navigate", { url: appUrl });
  await sleep(500);
  await sleep(50);

  const noSourceFlowStep = await cdp.evaluate(`(async () => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const before = window.learningCompanionNative.exportWorkspaceJson();
    const workspace = JSON.parse(before);
    const noSourceSession = {
      ...workspace.sessions[0],
      id: "no_source_learning_flow",
      title: "No source learning flow",
      sourceTitle: "",
      sourceUrl: "",
      materialType: "doc",
      notesMarkdown: "",
      captures: [],
      reviewCards: [],
      focusMode: "capture"
    };
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify({
      ...workspace,
      activeSessionId: noSourceSession.id,
      sessions: [noSourceSession],
      importedPatches: [],
      importedReviewPatches: []
    }));
    document.querySelector('[data-tab="today"]').click();
    const startHereButtonsBeforeQuestion = [...(document.querySelector(".start-here-inline")?.querySelectorAll("button") || [])].map((button) => ({
      action: button.dataset.startAction,
      text: button.textContent,
      primary: button.classList.contains("primary"),
      aria: button.getAttribute("aria-label") || ""
    }));
    const startHereTextBeforeQuestion = document.querySelector(".start-here-inline")?.textContent || "";
    const startHereDeviceRouteText = document.querySelector(".start-here-device-route")?.textContent || "";
    const startHereDeviceRouteOpen = document.querySelector(".start-here-device-route")?.open === true;
    const startHereDeviceRouteSummaryText = document.querySelector(".start-here-device-route summary")?.textContent || "";
    const captureStepBeforeQuestion = document.querySelector('[data-learning-flow-step="capture"]');
    const initialNoSourceActivity = {
      title: document.querySelector("#activityTitle")?.textContent || "",
      detail: document.querySelector("#activityDetail")?.textContent || "",
      action: document.querySelector("#activityDetailsBtn")?.textContent || "",
      aria: document.querySelector("#activityDetailsBtn")?.getAttribute("aria-label") || ""
    };
    document.querySelector("#activityDetailsBtn")?.click();
    const initialNoSourceAction = {
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activeElement: document.activeElement?.id || "",
      activityTitle: document.querySelector("#activityTitle")?.textContent || "",
      activityDetail: document.querySelector("#activityDetail")?.textContent || "",
      activityAction: document.querySelector("#activityDetailsBtn")?.textContent || "",
      activityAria: document.querySelector("#activityDetailsBtn")?.getAttribute("aria-label") || "",
      sourceStripPulsed: document.querySelector(".source-strip")?.classList.contains("pulse") === true
    };
    document.querySelector('[data-tab="today"]').click();
    document.querySelector(".start-here-inline")?.querySelector('[data-start-action="question"]')?.click();
    const noSourceDraft = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}")
      .captureDrafts?.[noSourceSession.id] || {};
    const noSourceQuestion = {
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activeElement: document.activeElement?.id || "",
      thoughtValue: document.querySelector("#thoughtInput")?.value || "",
      activityTitle: document.querySelector("#activityTitle")?.textContent || "",
      activityDetail: document.querySelector("#activityDetail")?.textContent || "",
      activityAction: document.querySelector("#activityDetailsBtn")?.textContent || "",
      activityAria: document.querySelector("#activityDetailsBtn")?.getAttribute("aria-label") || "",
      draftSourceTitle: noSourceDraft.sourceTitle || "",
      draftSourceUrl: noSourceDraft.sourceUrl || "",
      draftMaterialType: noSourceDraft.materialType || ""
    };
    document.querySelector("#clearCaptureDraftBtn")?.click();
    setValue("#materialType", "video");
    setValue("#timestampInput", "01:23");
    const timestampOnlyDraft = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}")
      .captureDrafts?.[noSourceSession.id] || {};
    document.querySelector("#clearCaptureDraftBtn")?.click();
    document.querySelector('[data-tab="today"]').click();
    let manualClipboardReads = 0;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: async () => {
          manualClipboardReads += 1;
          return "Manual source must not read this URL https://example.com/should-not-attach";
        },
        writeText: async () => {}
      }
    });
    document.querySelector(".start-here-inline")?.querySelector('[data-start-action="source-manual"]')?.click();
    const manualSourceAction = {
      activeElement: document.activeElement?.id || "",
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activityTitle: document.querySelector("#activityTitle")?.textContent || "",
      activityDetail: document.querySelector("#activityDetail")?.textContent || "",
      activityAction: document.querySelector("#activityDetailsBtn")?.textContent || "",
      activityAria: document.querySelector("#activityDetailsBtn")?.getAttribute("aria-label") || "",
      sourceStripPulsed: document.querySelector(".source-strip")?.classList.contains("pulse") === true,
      clipboardReads: manualClipboardReads
    };
    document.querySelector('[data-tab="today"]').click();
    const sourceStep = document.querySelector('[data-learning-flow-step="source"]');
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: async () => "private non-url first note source text",
        writeText: async () => {}
      }
    });
    sourceStep?.querySelector("button")?.click();
    await new Promise((resolve) => setTimeout(resolve, 120));
    const rejectedWorkspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
    const rejectedSession = rejectedWorkspace.sessions.find((item) => item.id === rejectedWorkspace.activeSessionId);
    const rejectedPaste = {
      sourceTitle: rejectedSession?.sourceTitle || "",
      sourceUrl: rejectedSession?.sourceUrl || "",
      activityTitle: document.querySelector("#activityTitle")?.textContent || "",
      activityDetail: document.querySelector("#activityDetail")?.textContent || "",
      activeElement: document.activeElement?.id || "",
      captureCount: rejectedSession?.captures?.length || 0
    };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: async () => "First Note Lecture\\nhttps://www.youtube.com/watch?v=firstnote&t=77s",
        writeText: async () => {}
      }
    });
    sourceStep?.querySelector("button")?.click();
    await new Promise((resolve) => setTimeout(resolve, 120));
    const pastedWorkspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
    const pastedSession = pastedWorkspace.sessions.find((item) => item.id === pastedWorkspace.activeSessionId);
    const result = {
      text: sourceStep?.textContent || "",
      button: sourceStep?.querySelector("button")?.textContent || "",
      actionAria: sourceStep?.querySelector("button")?.getAttribute("aria-label") || "",
      isWide: sourceStep?.classList.contains("is-wide") === true,
      activeElement: document.activeElement?.id || "",
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activityTitle: document.querySelector("#activityTitle")?.textContent || "",
      activityDetail: document.querySelector("#activityDetail")?.textContent || "",
      activityAction: document.querySelector("#activityDetailsBtn")?.textContent || "",
      activityAria: document.querySelector("#activityDetailsBtn")?.getAttribute("aria-label") || "",
      sourceStripPulsed: document.querySelector(".source-strip")?.classList.contains("pulse") === true,
      sourceTitle: pastedSession?.sourceTitle || "",
      sourceUrl: pastedSession?.sourceUrl || "",
      materialType: pastedSession?.materialType || "",
      timestamp: document.querySelector("#timestampInput")?.value || "",
      captureCount: pastedSession?.captures?.length || 0,
      manualSourceAction,
      rejectedPaste,
      noSourceQuestion,
      captureStep: {
        text: captureStepBeforeQuestion?.textContent || "",
        actionAria: captureStepBeforeQuestion?.querySelector("button")?.getAttribute("aria-label") || ""
      },
      initialNoSourceActivity,
      initialNoSourceAction,
      timestampOnlyDraft: {
        timestamp: timestampOnlyDraft.timestamp || "",
        sourceTitle: timestampOnlyDraft.sourceTitle || "",
        sourceUrl: timestampOnlyDraft.sourceUrl || "",
        materialType: timestampOnlyDraft.materialType || ""
      }
    };
    result.startHereButtons = startHereButtonsBeforeQuestion;
    result.startHereText = startHereTextBeforeQuestion;
    result.startHereDeviceRouteText = startHereDeviceRouteText;
    result.startHereDeviceRouteOpen = startHereDeviceRouteOpen;
    result.startHereDeviceRouteSummaryText = startHereDeviceRouteSummaryText;
    setValue("#timestampInput", "");
    setValue("#sourceTitle", "Transition source");
    setValue("#sourceUrl", "https://example.com/transition-source");
    document.querySelector('[data-tab="today"]').click();
    const collapsedSourceStep = document.querySelector('[data-learning-flow-step="source"]');
    result.afterSetSource = {
      text: collapsedSourceStep?.textContent || "",
      isWide: collapsedSourceStep?.classList.contains("is-wide") === true,
      button: collapsedSourceStep?.querySelector("button")?.textContent || ""
    };
    const lateSourceSession = {
      ...workspace.sessions[0],
      id: "late_source_question_flow",
      title: "Late source question flow",
      sourceTitle: "",
      sourceUrl: "",
      materialType: "doc",
      notesMarkdown: "",
      captures: [],
      reviewCards: [],
      focusMode: "capture"
    };
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify({
      ...workspace,
      activeSessionId: lateSourceSession.id,
      sessions: [lateSourceSession],
      importedPatches: [],
      importedReviewPatches: []
    }));
    document.querySelector('[data-tab="today"]').click();
    document.querySelector(".start-here-inline")?.querySelector('[data-start-action="question"]')?.click();
    setValue("#sourceTitle", "Late source doc");
    setValue("#sourceUrl", "https://example.com/late-source");
    document.querySelector("#sourceUrl")?.dispatchEvent(new Event("change", { bubbles: true }));
    const lateSourceDraft = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}")
      .captureDrafts?.[lateSourceSession.id] || {};
    result.lateSourceQuestion = {
      draftSourceTitle: lateSourceDraft.sourceTitle || "",
      draftSourceUrl: lateSourceDraft.sourceUrl || "",
      draftMaterialType: lateSourceDraft.materialType || "",
      status: document.querySelector("#captureDraftStatus")?.textContent || "",
      statusTitle: document.querySelector("#captureDraftStatus")?.title || "",
      activityTitle: document.querySelector("#activityTitle")?.textContent || "",
      activityDetail: document.querySelector("#activityDetail")?.textContent || "",
      activityAction: document.querySelector("#activityDetailsBtn")?.textContent || "",
      activityAria: document.querySelector("#activityDetailsBtn")?.getAttribute("aria-label") || ""
    };
    const existingSnapshotSession = {
      ...workspace.sessions[0],
      id: "existing_snapshot_question_flow",
      title: "Existing snapshot question flow",
      sourceTitle: "Original source doc",
      sourceUrl: "https://example.com/original-source",
      materialType: "doc",
      notesMarkdown: "",
      captures: [],
      reviewCards: [],
      focusMode: "capture"
    };
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify({
      ...workspace,
      activeSessionId: existingSnapshotSession.id,
      sessions: [existingSnapshotSession],
      importedPatches: [],
      importedReviewPatches: []
    }));
    document.querySelector('[data-tab="today"]').click();
    document.querySelector(".start-here-inline")?.querySelector('[data-start-action="question"]')?.click();
    setValue("#sourceTitle", "Changed source doc");
    setValue("#sourceUrl", "https://example.com/changed-source");
    document.querySelector("#sourceUrl")?.dispatchEvent(new Event("change", { bubbles: true }));
    const existingSnapshotDraft = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}")
      .captureDrafts?.[existingSnapshotSession.id] || {};
    result.existingSnapshotQuestion = {
      draftSourceTitle: existingSnapshotDraft.sourceTitle || "",
      draftSourceUrl: existingSnapshotDraft.sourceUrl || "",
      status: document.querySelector("#captureDraftStatus")?.textContent || "",
      statusTitle: document.querySelector("#captureDraftStatus")?.title || "",
      activityTitle: document.querySelector("#activityTitle")?.textContent || "",
      activityDetail: document.querySelector("#activityDetail")?.textContent || ""
    };
    const unsafeSourceSession = {
      ...workspace.sessions[0],
      id: "unsafe_source_question_flow",
      title: "Unsafe source question flow",
      sourceTitle: "",
      sourceUrl: "",
      materialType: "doc",
      notesMarkdown: "",
      captures: [],
      reviewCards: [],
      focusMode: "capture"
    };
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify({
      ...workspace,
      activeSessionId: unsafeSourceSession.id,
      sessions: [unsafeSourceSession],
      importedPatches: [],
      importedReviewPatches: []
    }));
    document.querySelector('[data-tab="today"]').click();
    document.querySelector(".start-here-inline")?.querySelector('[data-start-action="question"]')?.click();
    setValue("#sourceTitle", "Unsafe source doc");
    setValue("#sourceUrl", "javascript:alert(1)");
    document.querySelector("#sourceUrl")?.dispatchEvent(new Event("change", { bubbles: true }));
    const unsafeSourceDraft = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}")
      .captureDrafts?.[unsafeSourceSession.id] || {};
    result.unsafeSourceQuestion = {
      draftSourceTitle: unsafeSourceDraft.sourceTitle || "",
      draftSourceUrl: unsafeSourceDraft.sourceUrl || "",
      status: document.querySelector("#captureDraftStatus")?.textContent || "",
      statusTitle: document.querySelector("#captureDraftStatus")?.title || "",
      activityTitle: document.querySelector("#activityTitle")?.textContent || "",
      activityDetail: document.querySelector("#activityDetail")?.textContent || ""
    };
    window.learningCompanionNative.importWorkspaceJson(before);
    document.querySelector('[data-tab="today"]').click();
    return result;
  })()`);
  assert.match(noSourceFlowStep.text, /Read source/);
  assert.match(noSourceFlowStep.text, /Needs source/);
  assert.equal(noSourceFlowStep.button, "Paste source");
  assert.equal(noSourceFlowStep.actionAria, "Paste source URL from clipboard for this learning flow");
  assert.equal(noSourceFlowStep.isWide, true);
  assert.deepEqual(noSourceFlowStep.initialNoSourceActivity, {
    title: "Link source or jot loose thought",
    detail: "Paste the browser URL first to resume later, or capture an unanchored thought.",
    action: "Set source",
    aria: "Focus Source URL"
  });
  assert.deepEqual(noSourceFlowStep.initialNoSourceAction, {
    activeTab: "captures",
    activeElement: "sourceUrl",
    activityTitle: "Add a source",
    activityDetail: "Paste the browser page or video URL so captures can resume from it.",
    activityAction: "Set source",
    activityAria: "Focus Source URL",
    sourceStripPulsed: true
  });
  assert.equal(noSourceFlowStep.activeElement, "quoteInput");
  assert.equal(noSourceFlowStep.activeTab, "captures");
  assert.equal(noSourceFlowStep.activityTitle, "Source pasted");
  assert.match(noSourceFlowStep.activityDetail, /First Note Lecture @ 01:17/);
  assert.equal(noSourceFlowStep.activityAction, "Capture");
  assert.equal(noSourceFlowStep.activityAria, "Open capture");
  assert.equal(noSourceFlowStep.sourceStripPulsed, true);
  assert.equal(noSourceFlowStep.sourceTitle, "First Note Lecture");
  assert.equal(noSourceFlowStep.sourceUrl, "https://www.youtube.com/watch?v=firstnote");
  assert.equal(noSourceFlowStep.materialType, "video");
  assert.equal(noSourceFlowStep.timestamp, "01:17");
  assert.equal(noSourceFlowStep.captureCount, 0);
  assert.equal(noSourceFlowStep.manualSourceAction.activeElement, "sourceUrl");
  assert.equal(noSourceFlowStep.manualSourceAction.activeTab, "captures");
  assert.equal(noSourceFlowStep.manualSourceAction.activityTitle, "Add a source");
  assert.match(noSourceFlowStep.manualSourceAction.activityDetail, /Paste the browser page or video URL/);
  assert.equal(noSourceFlowStep.manualSourceAction.sourceStripPulsed, true);
  assert.equal(noSourceFlowStep.manualSourceAction.clipboardReads, 0);
  assert.equal(noSourceFlowStep.rejectedPaste.sourceTitle, "");
  assert.equal(noSourceFlowStep.rejectedPaste.sourceUrl, "");
  assert.equal(noSourceFlowStep.rejectedPaste.activityTitle, "No source URL found");
  assert.match(noSourceFlowStep.rejectedPaste.activityDetail, /Copy the browser URL/);
  assert.equal(noSourceFlowStep.rejectedPaste.activeElement, "sourceUrl");
  assert.equal(noSourceFlowStep.rejectedPaste.captureCount, 0);
  assert.equal(noSourceFlowStep.noSourceQuestion.activeTab, "captures");
  assert.equal(noSourceFlowStep.noSourceQuestion.activeElement, "thoughtInput");
  assert.equal(noSourceFlowStep.noSourceQuestion.thoughtValue, "Question:");
  assert.equal(noSourceFlowStep.noSourceQuestion.activityTitle, "Question draft started");
  assert.match(noSourceFlowStep.noSourceQuestion.activityDetail, /link a source later to anchor it/);
  assert.doesNotMatch(noSourceFlowStep.noSourceQuestion.activityDetail, /Product design desk/);
  assert.equal(noSourceFlowStep.noSourceQuestion.activityAction, "Capture");
  assert.equal(noSourceFlowStep.noSourceQuestion.activityAria, "Open capture");
  assert.equal(noSourceFlowStep.noSourceQuestion.draftSourceTitle, "");
  assert.equal(noSourceFlowStep.noSourceQuestion.draftSourceUrl, "");
  assert.equal(noSourceFlowStep.noSourceQuestion.draftMaterialType, "");
  assert.match(noSourceFlowStep.captureStep.text, /Capture on Mac/);
  assert.match(noSourceFlowStep.captureStep.text, /After source/);
  assert.match(noSourceFlowStep.captureStep.text, /Jot loose thought/);
  assert.match(noSourceFlowStep.captureStep.text, /cannot resume the source later/);
  assert.match(noSourceFlowStep.captureStep.actionAria, /source resume will not be available/);
  assert.deepEqual(noSourceFlowStep.timestampOnlyDraft, {
    timestamp: "01:23",
    sourceTitle: "",
    sourceUrl: "",
    materialType: ""
  });
  assert.deepEqual(noSourceFlowStep.startHereButtons, [
    { action: "source", text: "Paste source", primary: true, aria: "Paste source URL from clipboard for this learning flow" },
    { action: "source-manual", text: "Set source manually", primary: false, aria: "Set source URL manually for this learning flow" },
    { action: "capture", text: "Jot loose thought", primary: false, aria: "Jot a loose thought without a source; source resume will not be available" },
    { action: "question", text: "Ask about this", primary: false, aria: "" },
    { action: "clipper", text: "Set up page clipper", primary: false, aria: "" },
    { action: "device-flow", text: "Phone/Windows", primary: false, aria: "Open manual phone and Windows transfer route" }
  ]);
  assert.match(noSourceFlowStep.startHereText, /First Note/);
  assert.match(noSourceFlowStep.startHereText, /Start by anchoring this study block to the browser source/);
  assert.match(noSourceFlowStep.startHereText, /Anchor the source first, then capture, then close the loop/);
  assert.match(noSourceFlowStep.startHereDeviceRouteText, /Use phone or Windows later/);
  assert.match(noSourceFlowStep.startHereDeviceRouteText, /Bring return files back to this Mac/);
  assert.equal(noSourceFlowStep.startHereDeviceRouteOpen, false);
  assert.match(noSourceFlowStep.startHereDeviceRouteSummaryText, /Other devices later/);
  assert.match(noSourceFlowStep.startHereDeviceRouteSummaryText, /no live sync/i);
  assert.match(noSourceFlowStep.afterSetSource.text, /Source linked/);
  assert.equal(noSourceFlowStep.afterSetSource.isWide, false);
  assert.equal(noSourceFlowStep.afterSetSource.button, "Open source");
  assert.equal(noSourceFlowStep.lateSourceQuestion.draftSourceTitle, "Late source doc");
  assert.equal(noSourceFlowStep.lateSourceQuestion.draftSourceUrl, "https://example.com/late-source");
  assert.equal(noSourceFlowStep.lateSourceQuestion.draftMaterialType, "doc");
  assert.equal(noSourceFlowStep.lateSourceQuestion.status, "Draft saved");
  assert.equal(noSourceFlowStep.lateSourceQuestion.statusTitle, "");
  assert.equal(noSourceFlowStep.lateSourceQuestion.activityTitle, "Draft source linked");
  assert.match(noSourceFlowStep.lateSourceQuestion.activityDetail, /Late source doc/);
  assert.equal(noSourceFlowStep.lateSourceQuestion.activityAction, "Capture");
  assert.equal(noSourceFlowStep.lateSourceQuestion.activityAria, "Open capture");
  assert.equal(noSourceFlowStep.existingSnapshotQuestion.draftSourceTitle, "Original source doc");
  assert.equal(noSourceFlowStep.existingSnapshotQuestion.draftSourceUrl, "https://example.com/original-source");
  assert.equal(noSourceFlowStep.existingSnapshotQuestion.status, "Source changed");
  assert.match(noSourceFlowStep.existingSnapshotQuestion.statusTitle, /Draft began on Original source doc/);
  assert.equal(noSourceFlowStep.existingSnapshotQuestion.activityTitle, "Question draft started");
  assert.doesNotMatch(noSourceFlowStep.existingSnapshotQuestion.activityDetail, /Changed source doc|Draft source linked/);
  assert.equal(noSourceFlowStep.unsafeSourceQuestion.draftSourceTitle, "");
  assert.equal(noSourceFlowStep.unsafeSourceQuestion.draftSourceUrl, "");
  assert.equal(noSourceFlowStep.unsafeSourceQuestion.status, "Draft saved");
  assert.equal(noSourceFlowStep.unsafeSourceQuestion.statusTitle, "");
  assert.equal(noSourceFlowStep.unsafeSourceQuestion.activityTitle, "Question draft started");
  assert.doesNotMatch(noSourceFlowStep.unsafeSourceQuestion.activityDetail, /Unsafe source doc|Draft source linked/);

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
      toggleText: toggle.textContent,
      toggleTitle: toggle.title,
      toggleAria: toggle.getAttribute("aria-label") || "",
      metricsDisplay: getComputedStyle(document.querySelector(".metrics-row")).display,
      focusBriefDisplay: getComputedStyle(document.querySelector(".focus-brief")).display,
      focusBriefCompressed: document.querySelector(".focus-brief").classList.contains("is-sidecar-redundant"),
      focusBriefColumns: getComputedStyle(document.querySelector(".focus-brief")).gridTemplateColumns,
      focusBriefFactsDisplay: getComputedStyle(document.querySelector(".focus-brief-facts")).display,
      focusBriefSignalsDisplay: getComputedStyle(document.querySelector(".focus-brief-signals")).display,
      activityDisplay: getComputedStyle(document.querySelector(".activity-strip")).display,
      activityAction: document.querySelector("#activityDetailsBtn").textContent,
      activityAria: document.querySelector("#activityDetailsBtn").getAttribute("aria-label") || "",
      sidecarRailHidden: document.querySelector("#sidecarRail").hidden,
      sidecarRailDisplay: getComputedStyle(document.querySelector("#sidecarRail")).display,
      sidecarRailLive: document.querySelector("#sidecarRail").getAttribute("aria-live") || "",
      sidecarRailSteps: [...document.querySelectorAll("[data-sidecar-rail-step]")].map((step) => ({
        kind: step.dataset.sidecarRailStep,
        text: step.textContent,
        aria: step.getAttribute("aria-label") || ""
      })),
      activeId: document.activeElement?.id || "",
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      pressed: toggle.getAttribute("aria-pressed"),
      stored: JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}").sidecarLayout === true,
      storedVersion: JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}").schemaVersion,
      storedLanguage: JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}").language || "",
      activityTitle: document.querySelector("#activityTitle")?.textContent || "",
      capturePanePulsed: document.querySelector("#capturePane")?.classList.contains("pulse") === true
    });
    const readCaptureContextReadability = () => {
      const captureContext = document.querySelector("#captureContext");
      captureContext.scrollIntoView({ block: "center", inline: "nearest" });
      const targetContext = document.querySelector("#captureContextTarget");
      const sourceContext = document.querySelector("#captureContextSource");
      const intentContext = document.querySelector("#captureContextIntent");
      const draftContext = document.querySelector("#captureContextDraft");
      const timeContext = document.querySelector("#captureContextTime");
      const targetRect = targetContext.getBoundingClientRect();
      const sourceRect = sourceContext.getBoundingClientRect();
      return {
        shellCompact: shell.classList.contains("sidecar-layout"),
        captureContextWidth: Math.ceil(captureContext.getBoundingClientRect().width),
        captureContextScrollWidth: captureContext.scrollWidth,
        targetText: targetContext.textContent,
        targetTitle: targetContext.title,
        targetAria: targetContext.getAttribute("aria-label") || "",
        targetWidth: Math.ceil(targetRect.width),
        targetClientHeight: targetContext.clientHeight,
        targetScrollHeight: targetContext.scrollHeight,
        targetClientWidth: targetContext.clientWidth,
        targetScrollWidth: targetContext.scrollWidth,
        targetInnerText: targetContext.innerText,
        targetHit: document.elementFromPoint(targetRect.left + targetRect.width / 2, targetRect.top + targetRect.height / 2) === targetContext,
        sourceText: sourceContext.textContent,
        sourceTitle: sourceContext.title,
        sourceAria: sourceContext.getAttribute("aria-label") || "",
        sourceWidth: Math.ceil(sourceRect.width),
        sourceClientHeight: sourceContext.clientHeight,
        sourceScrollHeight: sourceContext.scrollHeight,
        sourceClientWidth: sourceContext.clientWidth,
        sourceScrollWidth: sourceContext.scrollWidth,
        sourceHit: document.elementFromPoint(sourceRect.left + sourceRect.width / 2, sourceRect.top + sourceRect.height / 2) === sourceContext,
        intentText: intentContext.textContent,
        intentClientHeight: intentContext.clientHeight,
        intentScrollHeight: intentContext.scrollHeight,
        draftText: draftContext.textContent,
        draftTitle: draftContext.title,
        draftClientHeight: draftContext.clientHeight,
        draftScrollHeight: draftContext.scrollHeight,
        draftClientWidth: draftContext.clientWidth,
        draftScrollWidth: draftContext.scrollWidth,
        timeHidden: timeContext.hidden,
        timeText: timeContext.textContent,
        timeClientHeight: timeContext.clientHeight,
        timeScrollHeight: timeContext.scrollHeight
      };
    };
    const setCaptureContextFixture = () => {
      document.querySelector("#sessionTitle").value = "Learning Companion Browser Notes With A Long Course Name";
      document.querySelector("#sessionTitle").dispatchEvent(new Event("input", { bubbles: true }));
      document.querySelector("#sourceTitle").value = "Manual browser check source with chapter marker";
      document.querySelector("#sourceTitle").dispatchEvent(new Event("input", { bubbles: true }));
      document.querySelector("#timestampInput").value = "12:34";
      document.querySelector("#timestampInput").dispatchEvent(new Event("input", { bubbles: true }));
    };
    const restoreCaptureContextFixture = (values) => {
      document.querySelector("#sessionTitle").value = values.title;
      document.querySelector("#sessionTitle").dispatchEvent(new Event("input", { bubbles: true }));
      document.querySelector("#sourceTitle").value = values.sourceTitle;
      document.querySelector("#sourceTitle").dispatchEvent(new Event("input", { bubbles: true }));
      document.querySelector("#timestampInput").value = values.timestamp;
      document.querySelector("#timestampInput").dispatchEvent(new Event("input", { bubbles: true }));
    };
    const originalContextFixture = {
      title: document.querySelector("#sessionTitle").value,
      sourceTitle: document.querySelector("#sourceTitle").value,
      timestamp: document.querySelector("#timestampInput").value
    };
    setCaptureContextFixture();
    const fullDeskContextReadability = readCaptureContextReadability();
    restoreCaptureContextFixture(originalContextFixture);
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
    setCaptureContextFixture();
    const sidecarContextReadability = readCaptureContextReadability();
    restoreCaptureContextFixture(originalContextFixture);
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
    const captureCountBeforeStarterShortcuts = document.querySelector("#captureMetric").textContent;
    const workspaceCaptureCountBeforeStarterShortcuts = (() => {
      const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
      const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
      return session?.captures.length || 0;
    })();
    const undoHiddenBeforeStarterShortcuts = document.querySelector("#activityUndoBtn").hidden === true;
    document.querySelector("#thoughtInput").value = "";
    document.querySelector("#thoughtInput").dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector("#notesEditor").focus();
    const editableStarterShortcutEvent = new KeyboardEvent("keydown", {
      key: "1",
      metaKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true
    });
    const editableStarterShortcutDispatchResult = document.querySelector("#notesEditor").dispatchEvent(editableStarterShortcutEvent);
    const afterEditableStarterShortcut = {
      thought: document.querySelector("#thoughtInput").value,
      defaultPrevented: editableStarterShortcutEvent.defaultPrevented,
      dispatchResult: editableStarterShortcutDispatchResult,
      activeId: document.activeElement?.id || ""
    };
    const starterShortcut = (key) => {
      document.querySelector("#sidecarLayoutBtn").focus();
      const event = new KeyboardEvent("keydown", {
        key,
        metaKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true
      });
      const dispatchResult = document.querySelector("#sidecarLayoutBtn").dispatchEvent(event);
      return {
        thought: document.querySelector("#thoughtInput").value,
        activeStarter: document.querySelector("[data-capture-starter].is-active")?.dataset.captureStarter || "",
        activeId: document.activeElement?.id || "",
        activityTitle: document.querySelector("#activityTitle").textContent,
        activityAction: document.querySelector("#activityDetailsBtn").textContent,
        captureCount: document.querySelector("#captureMetric").textContent,
        workspaceCaptureCount: (() => {
          const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
          const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
          return session?.captures.length || 0;
        })(),
        undoHidden: document.querySelector("#activityUndoBtn").hidden === true,
        defaultPrevented: event.defaultPrevented,
        dispatchResult
      };
    };
    const afterQuestionStarterShortcut = starterShortcut("1");
    const afterAnswerStarterShortcut = starterShortcut("2");
    const afterTakeawayStarterShortcut = starterShortcut("3");
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
    return { before, fullDeskContextReadability, afterEditableShortcut, afterPanelShortcut, afterFocusCaptureShortcut, sidecarContextReadability, afterDraftFocusCaptureShortcut, afterRepeatFocusCaptureShortcut, captureCountBeforeStarterShortcuts, workspaceCaptureCountBeforeStarterShortcuts, undoHiddenBeforeStarterShortcuts, afterEditableStarterShortcut, afterQuestionStarterShortcut, afterAnswerStarterShortcut, afterTakeawayStarterShortcut, afterCaptureDestination, afterActivityDetails };
  })()`);

  assert.equal(sidecarLayout.before.shellCompact, false);
  assert.equal(sidecarLayout.before.sidecarRailHidden, true);
  assert.notEqual(sidecarLayout.before.metricsDisplay, "none");
  assert.notEqual(sidecarLayout.before.focusBriefDisplay, "none");
  assert.equal(sidecarLayout.before.focusBriefCompressed, false);
  assert.equal(sidecarLayout.before.toggleDisplay, "flex");
  assert.equal(sidecarLayout.before.toggleText, "Focus Sidecar");
  assert.equal(sidecarLayout.before.toggleTitle, "Focus sidecar layout");
  assert.equal(sidecarLayout.before.toggleAria, "Focus sidecar layout");
  assert.notEqual(sidecarLayout.before.focusBriefFactsDisplay, "none");
  assert.notEqual(sidecarLayout.before.focusBriefSignalsDisplay, "none");
  const assertCaptureContextReadable = (state, shellCompact) => {
    assert.equal(state.shellCompact, shellCompact);
    assert.ok(state.captureContextWidth > 0);
    assert.ok(state.captureContextScrollWidth <= state.captureContextWidth + 2);
    assert.equal(state.targetText, "To Learning Companion Browser Notes With A Long Course Name");
    assert.equal(state.targetTitle, "Captures save to Learning Companion Browser Notes With A Long Course Name");
    assert.equal(state.targetAria, "Show capture destination: Learning Companion Browser Notes With A Long Course Name");
    assert.ok(state.targetWidth >= Math.floor(state.captureContextWidth * 0.9));
    assert.ok(state.targetScrollHeight <= state.targetClientHeight + 1);
    assert.ok(state.targetScrollWidth <= state.targetClientWidth + 2);
    assert.doesNotMatch(state.targetInnerText, /…|\.\.\./);
    assert.equal(state.targetHit, true);
    assert.equal(state.sourceText, "Manual browser check source with chapter marker");
    assert.match(state.sourceTitle, /Manual browser check source with chapter marker/);
    assert.equal(state.sourceAria, "Show capture source: Manual browser check source with chapter marker");
    assert.ok(state.sourceWidth >= Math.floor(state.captureContextWidth * 0.9));
    assert.ok(state.sourceScrollHeight <= state.sourceClientHeight + 1);
    assert.ok(state.sourceScrollWidth <= state.sourceClientWidth + 2);
    assert.equal(state.sourceHit, true);
    assert.ok(state.intentClientHeight <= 28);
    assert.ok(state.intentScrollHeight <= state.intentClientHeight + 1);
    assert.match(state.draftText, /Ready for .* in Learning Companion Browser Notes With A Long Course Name\./);
    assert.match(state.draftText, /Source resumes at 12:34\./);
    assert.equal(state.draftTitle, state.draftText);
    assert.ok(state.draftScrollHeight <= state.draftClientHeight + 1);
    assert.ok(state.draftScrollWidth <= state.draftClientWidth + 2);
    assert.equal(state.timeHidden, false);
    assert.equal(state.timeText, "@ 12:34");
    assert.ok(state.timeClientHeight <= 28);
    assert.ok(state.timeScrollHeight <= state.timeClientHeight + 1);
  };
  assertCaptureContextReadable(sidecarLayout.fullDeskContextReadability, false);
  assert.equal(sidecarLayout.afterEditableShortcut.shellCompact, false);
  assert.equal(sidecarLayout.afterPanelShortcut.shellCompact, true);
  assert.equal(sidecarLayout.afterPanelShortcut.sidebarDisplay, "none");
  assert.equal(sidecarLayout.afterPanelShortcut.inspectorDisplay, "none");
  assert.equal(sidecarLayout.afterPanelShortcut.metricsDisplay, "none");
  assert.equal(sidecarLayout.afterPanelShortcut.focusBriefDisplay, "none");
  assert.equal(sidecarLayout.afterPanelShortcut.focusBriefCompressed, true);
  assert.equal(sidecarLayout.afterPanelShortcut.focusBriefFactsDisplay, "none");
  assert.equal(sidecarLayout.afterPanelShortcut.focusBriefSignalsDisplay, "none");
  assert.equal(sidecarLayout.afterPanelShortcut.toggleDisplay, "flex");
  assert.equal(sidecarLayout.afterPanelShortcut.toggleText, "Full Desk");
  assert.equal(sidecarLayout.afterPanelShortcut.toggleTitle, "Return to full desk layout");
  assert.equal(sidecarLayout.afterPanelShortcut.toggleAria, "Return to full desk layout");
  assert.equal(sidecarLayout.afterPanelShortcut.activityDisplay, "grid");
  assert.equal(sidecarLayout.afterPanelShortcut.activityAction, "Capture");
  assert.equal(sidecarLayout.afterPanelShortcut.activityAria, "Focus Quick Capture");
  assert.equal(sidecarLayout.afterPanelShortcut.sidecarRailHidden, false);
  assert.equal(sidecarLayout.afterPanelShortcut.sidecarRailDisplay, "grid");
  assert.equal(sidecarLayout.afterPanelShortcut.sidecarRailLive, "off");
  assert.deepEqual(sidecarLayout.afterPanelShortcut.sidecarRailSteps.map((step) => step.kind), ["source", "capture", "loop"]);
  assert.match(sidecarLayout.afterPanelShortcut.sidecarRailSteps[0].text, /Source/);
  assert.match(sidecarLayout.afterPanelShortcut.sidecarRailSteps[1].text, /Capture/);
  assert.match(sidecarLayout.afterPanelShortcut.sidecarRailSteps[1].text, /Capture first point/);
  assert.match(sidecarLayout.afterPanelShortcut.sidecarRailSteps[1].text, /Focus field/);
  assert.match(sidecarLayout.afterPanelShortcut.sidecarRailSteps[2].text, /Loop/);
  assert.match(sidecarLayout.afterPanelShortcut.sidecarRailSteps[2].text, /Today/);
  assert.match(sidecarLayout.afterPanelShortcut.sidecarRailSteps[2].aria, /exit sidecar layout/);
  assert.equal(sidecarLayout.afterPanelShortcut.activeId, "sidecarLayoutBtn");
  assert.equal(sidecarLayout.afterPanelShortcut.pressed, "true");
  assert.equal(sidecarLayout.afterPanelShortcut.stored, true);
  assert.equal(sidecarLayout.afterPanelShortcut.storedVersion, 7);
  assert.equal(sidecarLayout.afterPanelShortcut.storedLanguage, "en");
  assert.equal(sidecarLayout.afterFocusCaptureShortcut.shellCompact, true);
  assert.equal(sidecarLayout.afterFocusCaptureShortcut.activeTab, "captures");
  assert.equal(sidecarLayout.afterFocusCaptureShortcut.activeId, "quoteInput");
  assert.equal(sidecarLayout.afterFocusCaptureShortcut.activityTitle, "Quick Capture ready");
  assert.equal(sidecarLayout.afterFocusCaptureShortcut.capturePanePulsed, true);
  assert.equal(sidecarLayout.afterFocusCaptureShortcut.activityAction, "Capture");
  assert.equal(sidecarLayout.afterFocusCaptureShortcut.activityAria, "Focus Quick Capture");
  assertCaptureContextReadable(sidecarLayout.sidecarContextReadability, true);
  assert.equal(sidecarLayout.afterDraftFocusCaptureShortcut.shellCompact, true);
  assert.equal(sidecarLayout.afterDraftFocusCaptureShortcut.activeTab, "captures");
  assert.equal(sidecarLayout.afterDraftFocusCaptureShortcut.activeId, "thoughtInput");
  assert.equal(sidecarLayout.afterDraftFocusCaptureShortcut.activityTitle, "Capture draft ready");
  assert.equal(sidecarLayout.afterDraftFocusCaptureShortcut.activityAction, "Resume");
  assert.equal(sidecarLayout.afterDraftFocusCaptureShortcut.activityAria, "Focus Quick Capture");
  assert.notEqual(sidecarLayout.afterDraftFocusCaptureShortcut.focusBriefDisplay, "none");
  assert.equal(sidecarLayout.afterDraftFocusCaptureShortcut.focusBriefCompressed, false);
  assert.equal(sidecarLayout.afterDraftFocusCaptureShortcut.defaultPrevented, true);
  assert.equal(sidecarLayout.afterDraftFocusCaptureShortcut.dispatchResult, false);
  assert.equal(sidecarLayout.afterRepeatFocusCaptureShortcut.activeId, "thoughtInput");
  assert.equal(sidecarLayout.afterRepeatFocusCaptureShortcut.capturePanePulsed, true);
  assert.deepEqual(sidecarLayout.afterEditableStarterShortcut, {
    thought: "",
    defaultPrevented: false,
    dispatchResult: true,
    activeId: "notesEditor"
  });
  assert.equal(sidecarLayout.afterQuestionStarterShortcut.thought, "Question:");
  assert.equal(sidecarLayout.afterQuestionStarterShortcut.activeStarter, "question");
  assert.equal(sidecarLayout.afterQuestionStarterShortcut.activeId, "thoughtInput");
  assert.equal(sidecarLayout.afterQuestionStarterShortcut.activityTitle, "Question draft started");
  assert.equal(sidecarLayout.afterQuestionStarterShortcut.activityAction, "Capture");
  assert.equal(sidecarLayout.afterQuestionStarterShortcut.defaultPrevented, true);
  assert.equal(sidecarLayout.afterQuestionStarterShortcut.dispatchResult, false);
  assert.equal(sidecarLayout.afterQuestionStarterShortcut.captureCount, sidecarLayout.captureCountBeforeStarterShortcuts);
  assert.equal(sidecarLayout.afterQuestionStarterShortcut.workspaceCaptureCount, sidecarLayout.workspaceCaptureCountBeforeStarterShortcuts);
  assert.equal(sidecarLayout.afterQuestionStarterShortcut.undoHidden, sidecarLayout.undoHiddenBeforeStarterShortcuts);
  assert.equal(sidecarLayout.afterAnswerStarterShortcut.thought, "Answer:");
  assert.equal(sidecarLayout.afterAnswerStarterShortcut.activeStarter, "answer");
  assert.equal(sidecarLayout.afterAnswerStarterShortcut.activityTitle, "Answer draft started");
  assert.equal(sidecarLayout.afterAnswerStarterShortcut.activityAction, "Capture");
  assert.equal(sidecarLayout.afterAnswerStarterShortcut.captureCount, sidecarLayout.captureCountBeforeStarterShortcuts);
  assert.equal(sidecarLayout.afterAnswerStarterShortcut.workspaceCaptureCount, sidecarLayout.workspaceCaptureCountBeforeStarterShortcuts);
  assert.equal(sidecarLayout.afterAnswerStarterShortcut.undoHidden, sidecarLayout.undoHiddenBeforeStarterShortcuts);
  assert.equal(sidecarLayout.afterTakeawayStarterShortcut.thought, "Takeaway:");
  assert.equal(sidecarLayout.afterTakeawayStarterShortcut.activeStarter, "takeaway");
  assert.equal(sidecarLayout.afterTakeawayStarterShortcut.activityTitle, "Takeaway draft started");
  assert.equal(sidecarLayout.afterTakeawayStarterShortcut.activityAction, "Capture");
  assert.equal(sidecarLayout.afterTakeawayStarterShortcut.captureCount, sidecarLayout.captureCountBeforeStarterShortcuts);
  assert.equal(sidecarLayout.afterTakeawayStarterShortcut.workspaceCaptureCount, sidecarLayout.workspaceCaptureCountBeforeStarterShortcuts);
  assert.equal(sidecarLayout.afterTakeawayStarterShortcut.undoHidden, sidecarLayout.undoHiddenBeforeStarterShortcuts);
  assert.equal(sidecarLayout.afterCaptureDestination.shellCompact, false);
  assert.notEqual(sidecarLayout.afterCaptureDestination.sidebarDisplay, "none");
  assert.equal(sidecarLayout.afterCaptureDestination.activeTab, "captures");
  assert.equal(sidecarLayout.afterCaptureDestination.targetText, "To Learning Companion MVP");
  assert.equal(sidecarLayout.afterCaptureDestination.activeSessionFocused, true);
  assert.equal(sidecarLayout.afterCaptureDestination.activeSessionPulsed, true);
  assert.equal(sidecarLayout.afterCaptureDestination.activityTitle, "Capture destination shown");
  assert.match(sidecarLayout.afterCaptureDestination.activityDetail, /Captures save to Learning Companion MVP/);
  assert.equal(sidecarLayout.afterActivityDetails.shellCompact, false);
  assert.notEqual(sidecarLayout.afterActivityDetails.metricsDisplay, "none");
  assert.notEqual(sidecarLayout.afterActivityDetails.focusBriefDisplay, "none");
  assert.equal(sidecarLayout.afterActivityDetails.focusBriefCompressed, false);
  assert.notEqual(sidecarLayout.afterActivityDetails.focusBriefFactsDisplay, "none");
  assert.notEqual(sidecarLayout.afterActivityDetails.focusBriefSignalsDisplay, "none");
  assert.equal(sidecarLayout.afterActivityDetails.activeTab, "captures");
  assert.equal(sidecarLayout.afterActivityDetails.activityAction, "Details");
  assert.equal(sidecarLayout.afterActivityDetails.sidecarRailHidden, true);

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
      activityAction: document.querySelector("#activityDetailsBtn").textContent,
      activityAria: document.querySelector("#activityDetailsBtn").getAttribute("aria-label") || "",
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
  assert.equal(pastedSource.activityAction, "Capture");
  assert.equal(pastedSource.activityAria, "Open capture");
  assert.equal(pastedSource.activeElement, "quoteInput");
  assert.equal(pastedSource.openSourceTitle, "Hide material viewer");
  assert.equal(pastedSource.contextOpenText, "Resume @ 01:35");
  assert.equal(pastedSource.captureIntent, "Video moment");
  assert.equal(pastedSource.quotePlaceholder, "Transcript line or key phrase at this moment");
  assert.equal(pastedSource.thoughtPlaceholder, "Your question, takeaway, or answer for this moment");
  assert.equal(pastedSource.sourceStripPulsed, true);

  const sourceFlowStep = await cdp.evaluate(`(() => {
    document.querySelector('[data-tab="today"]').click();
    let opened = "";
    const nativeOpen = window.open;
    window.open = (href) => {
      opened = href;
      return null;
    };
    const sourceStep = document.querySelector('[data-learning-flow-step="source"]');
    sourceStep?.querySelector("button")?.click();
    window.open = nativeOpen;
    return {
      text: sourceStep?.textContent || "",
      button: sourceStep?.querySelector("button")?.textContent || "",
      actionAria: sourceStep?.querySelector("button")?.getAttribute("aria-label") || "",
      isWide: sourceStep?.classList.contains("is-wide") === true,
      opened,
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent
    };
  })()`);
  assert.match(sourceFlowStep.text, /Read source/);
  assert.match(sourceFlowStep.text, /Resume @ 01:35/);
  assert.equal(sourceFlowStep.button, "Resume source");
  assert.match(sourceFlowStep.actionAria, /Resume Lecture Notes at 01:35/);
  assert.equal(sourceFlowStep.isWide, true);
  assert.match(sourceFlowStep.opened, /youtube\.com\/watch\?v=paste123/);
  assert.match(sourceFlowStep.opened, /t=95/);
  assert.equal(sourceFlowStep.activityTitle, "Source resumed @ 01:35");
  assert.match(sourceFlowStep.activityDetail, /keep this app beside it/);
  await sleep(50);

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
    const sourceBefore = {
      title: document.querySelector("#sourceTitle").value,
      url: document.querySelector("#sourceUrl").value,
      type: document.querySelector("#materialType").value,
      timestamp: document.querySelector("#timestampInput").value
    };
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
    setValue("#sourceTitle", sourceBefore.title);
    setValue("#sourceUrl", sourceBefore.url);
    setValue("#materialType", sourceBefore.type);
    setValue("#timestampInput", sourceBefore.timestamp);
    return { article, book, noSource };
  })()`);
  assert.equal(sourceGuidanceStates.article.intent, "Article excerpt");
  assert.equal(sourceGuidanceStates.article.intentTitle, "Capture the sentence, section, or claim you are reading now.");
  assert.equal(sourceGuidanceStates.article.quotePlaceholder, "Sentence, section excerpt, or key claim you are reading");
  assert.equal(sourceGuidanceStates.article.thoughtPlaceholder, "Your takeaway, question, or how you would apply it");
  assert.equal(sourceGuidanceStates.book.intent, "Book excerpt");
  assert.equal(sourceGuidanceStates.book.quotePlaceholder, "Sentence, section excerpt, or key claim you are reading");
  assert.equal(sourceGuidanceStates.noSource.intent, "No source");
  assert.equal(sourceGuidanceStates.noSource.intentTitle, "Captures are allowed, but linking the browser source first makes them resumable.");
  assert.equal(sourceGuidanceStates.noSource.quotePlaceholder, "Paste a quote, transcript line, or key idea");
  assert.equal(sourceGuidanceStates.noSource.thoughtPlaceholder, "Your note, question, or synthesis");

  const starterFlow = await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const readState = () => ({
      thought: document.querySelector("#thoughtInput").value,
      intent: document.querySelector("#captureContextIntent").textContent,
      intentTitle: document.querySelector("#captureContextIntent").title,
      activeElement: document.activeElement?.id || "",
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent,
      buttonTitles: [...document.querySelectorAll("[data-capture-starter]")].map((button) => button.title),
      buttonAria: [...document.querySelectorAll("[data-capture-starter]")].map((button) => button.getAttribute("aria-label")),
      buttonPressed: [...document.querySelectorAll("[data-capture-starter]")].map((button) => ({
        kind: button.dataset.captureStarter,
        pressed: button.getAttribute("aria-pressed"),
        active: button.classList.contains("is-active")
      }))
    });
    setValue("#quoteInput", "");
    setValue("#thoughtInput", "");
    document.querySelector('[data-capture-starter="question"]').click();
    const question = readState();
    setValue("#thoughtInput", "ownership prevents data races");
    document.querySelector('[data-capture-starter="question"]').click();
    const questionExisting = readState();
    document.querySelector('[data-capture-starter="question"]').click();
    const questionRepeat = readState();
    document.querySelector('[data-capture-starter="answer"]').click();
    const answer = readState();
    setValue("#thoughtInput", "Why ownership matters?");
    document.querySelector('[data-capture-starter="takeaway"]').click();
    const takeaway = readState();
    setValue("#thoughtInput", "Question：full-width colon body");
    document.querySelector('[data-capture-starter="answer"]').click();
    const fullWidthColon = readState();
    setValue("#thoughtInput", "   leading spaces matter");
    document.querySelector('[data-capture-starter="question"]').click();
    const leadingWhitespace = readState();
    setValue("#thoughtInput", "This remains useful. Why does the proof need compactness? It limits cases.");
    document.querySelector('[data-capture-starter="takeaway"]').click();
    const multiSentenceTakeaway = readState();
    return { question, questionExisting, questionRepeat, answer, takeaway, fullWidthColon, leadingWhitespace, multiSentenceTakeaway };
  })()`);
  assert.equal(starterFlow.question.thought, "Question:");
  assert.equal(starterFlow.question.intent, "Question draft");
  assert.equal(starterFlow.question.intentTitle, "Finish the question before saving it to Open Questions.");
  assert.equal(starterFlow.question.activeElement, "thoughtInput");
  assert.equal(starterFlow.question.activityTitle, "Question draft started");
  assert.match(starterFlow.question.activityDetail, /Local draft started/);
  assert.deepEqual(starterFlow.question.buttonTitles, [
    "Start a local question draft (Cmd/Ctrl+Shift+1)",
    "Start a local answer draft (Cmd/Ctrl+Shift+2)",
    "Start a local takeaway draft (Cmd/Ctrl+Shift+3)"
  ]);
  assert.deepEqual(starterFlow.question.buttonAria, [
    "Start a local question draft with Cmd or Control Shift 1",
    "Start a local answer draft with Cmd or Control Shift 2",
    "Start a local takeaway draft with Cmd or Control Shift 3"
  ]);
  assert.deepEqual(starterFlow.question.buttonPressed, [
    { kind: "question", pressed: "true", active: true },
    { kind: "answer", pressed: "false", active: false },
    { kind: "takeaway", pressed: "false", active: false }
  ]);
  assert.equal(starterFlow.questionExisting.thought, "Question: ownership prevents data races");
  assert.equal(starterFlow.questionExisting.intent, "Question");
  assert.equal(starterFlow.questionRepeat.thought, "Question: ownership prevents data races");
  assert.equal(starterFlow.answer.thought, "Answer: ownership prevents data races");
  assert.equal(starterFlow.answer.intent, "Answer");
  assert.equal(starterFlow.answer.activeElement, "thoughtInput");
  assert.equal(starterFlow.answer.activityTitle, "Answer draft started");
  assert.match(starterFlow.answer.activityDetail, /Not linked yet/);
  assert.deepEqual(starterFlow.answer.buttonPressed, [
    { kind: "question", pressed: "false", active: false },
    { kind: "answer", pressed: "true", active: true },
    { kind: "takeaway", pressed: "false", active: false }
  ]);
  assert.equal(starterFlow.takeaway.thought, "Takeaway: Why ownership matters?");
  assert.equal(starterFlow.takeaway.intent, "Takeaway");
  assert.equal(starterFlow.takeaway.activeElement, "thoughtInput");
  assert.equal(starterFlow.takeaway.activityTitle, "Takeaway draft started");
  assert.match(starterFlow.takeaway.activityDetail, /Local draft started/);
  assert.deepEqual(starterFlow.takeaway.buttonPressed, [
    { kind: "question", pressed: "false", active: false },
    { kind: "answer", pressed: "false", active: false },
    { kind: "takeaway", pressed: "true", active: true }
  ]);
  assert.equal(starterFlow.fullWidthColon.thought, "Answer: full-width colon body");
  assert.equal(starterFlow.fullWidthColon.intent, "Answer");
  assert.equal(starterFlow.leadingWhitespace.thought, "Question: leading spaces matter");
  assert.equal(starterFlow.leadingWhitespace.intent, "Question");
  assert.equal(starterFlow.multiSentenceTakeaway.thought, "Takeaway: This remains useful. Why does the proof need compactness? It limits cases.");
  assert.equal(starterFlow.multiSentenceTakeaway.intent, "Takeaway");

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
      contextDraft: document.querySelector("#captureContextDraft").textContent,
      quotePlaceholder: document.querySelector("#quoteInput").placeholder,
      thoughtPlaceholder: document.querySelector("#thoughtInput").placeholder,
      contextSource: document.querySelector("#captureContextSource").textContent,
      contextSourceState: document.querySelector("#captureContext").dataset.sourceState,
      contextSourceBorderStyle: getComputedStyle(document.querySelector("#captureContextSource")).borderStyle,
      contextTime: document.querySelector("#captureContextTime").textContent,
      contextTimeState: document.querySelector("#captureContext").dataset.timeState,
      contextAria: document.querySelector("#captureContext").getAttribute("aria-label"),
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
      title: document.querySelector("#captureContextIntent").title,
      summary: document.querySelector("#captureContextDraft").textContent
    };
    setValue("#thoughtInput", "Answer:");
    const answerDraftIntent = {
      text: document.querySelector("#captureContextIntent").textContent,
      title: document.querySelector("#captureContextIntent").title,
      summary: document.querySelector("#captureContextDraft").textContent
    };
    setValue("#thoughtInput", "Answer: because ownership gives each mutable reference a single active writer.");
    const answerIntent = {
      text: document.querySelector("#captureContextIntent").textContent,
      title: document.querySelector("#captureContextIntent").title,
      summary: document.querySelector("#captureContextDraft").textContent
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
      ariaLive: document.querySelector("#captureDraftStatus").getAttribute("aria-live"),
      contextDraftSourceState: document.querySelector("#captureContext").dataset.draftSourceState,
      contextDraft: document.querySelector("#captureContextDraft").textContent,
      contextSourceClass: document.querySelector("#captureContextSource").className,
      contextSourceTitle: document.querySelector("#captureContextSource").title,
      contextSourceAria: document.querySelector("#captureContextSource").getAttribute("aria-label")
    };
    document.querySelector('[data-tab="today"]').click();
    const sourceChangedTodayDraftCard = [...document.querySelectorAll("#todayList .draft-card")]
      .find((node) => /Draft anchored to the RustConf source/.test(node.textContent));
    const sourceChangedTodayDraft = {
      text: sourceChangedTodayDraftCard?.textContent || "",
      className: sourceChangedTodayDraftCard?.className || "",
      resumeText: sourceChangedTodayDraftCard?.querySelector("button")?.textContent || ""
    };
    sourceChangedTodayDraftCard?.querySelector("button")?.click();
    const sourceChangedTodayResume = {
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activeElement: document.activeElement?.id || "",
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent
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
      sourceUrlStored: restoredActiveSession.sourceUrl,
      contextDraftSourceState: document.querySelector("#captureContext").dataset.draftSourceState,
      contextSourceClass: document.querySelector("#captureContextSource").className
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
    const sourceTimestampNudge = { afterTimeBack, afterTimeForward, afterKeyboardBack, afterKeyboardForward, afterZeroBack, titleOnlySourceRefresh, questionIntent, answerDraftIntent, answerIntent, sourceChangedDraft, sourceChangedTodayDraft, sourceChangedTodayResume, sourceRestoredDraft, sourceReanchoredDraft, sourceReanchorCleared };
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
      exportedAt: backupPrefsAfterExport.exportedAt || "",
      directedSaveDestination: Boolean(window.webkit?.messageHandlers?.learningCompanion?.postMessage)
        || (typeof window.showSaveFilePicker === "function" && window.__LC_ALLOW_AUTOMATED_DOWNLOADS__ !== true),
      automatedDownloadFallback: window.__LC_ALLOW_AUTOMATED_DOWNLOADS__ === true
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
      hintKind: document.querySelector("#activityHint")?.dataset.nextStepHint || "",
      hintAction: document.querySelector("#activityHintBtn")?.textContent || "",
      openLinkText: [...document.querySelectorAll("#captureList .mini-button")]
        .map((button) => button.textContent)
        .find((text) => text.startsWith("Open @")) || ""
    };
    const cardedCaptureDetail = [...document.querySelectorAll("#captureList .item-card")]
      .find((item) => item.textContent.includes("compiler-enforced lifetimes"));
    const cardedCaptureDetailButtons = [...(cardedCaptureDetail?.querySelectorAll("button") || [])];
    const cardedCaptureDetailDelete = cardedCaptureDetailButtons.find((button) => button.textContent.startsWith("Delete"));
    const captureDetailAfterCard = {
      nextKind: cardedCaptureDetail?.dataset.captureNextStep || "",
      nextText: cardedCaptureDetail?.querySelector(".capture-detail-next")?.textContent || "",
      buttons: cardedCaptureDetailButtons.map((button) => button.textContent),
      reviewDisabled: cardedCaptureDetailButtons.find((button) => button.textContent === "Review")?.disabled === true,
      deleteClass: cardedCaptureDetailDelete?.className || "",
      deleteTitle: cardedCaptureDetailDelete?.title || "",
      deleteAria: cardedCaptureDetailDelete?.getAttribute("aria-label") || ""
    };
    cardedCaptureDetailButtons.find((button) => button.textContent === "Review")?.click();
    const captureDetailReviewOpen = {
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      focusMode: [...document.querySelectorAll("[data-focus-mode]")]
        .find((button) => button.classList.contains("active"))?.dataset.focusMode || "",
      deskReviewPrompt: document.querySelector("#deskReviewPrompt").textContent,
      activityTitle: document.querySelector("#activityTitle").textContent,
      activityAction: document.querySelector("#activityDetailsBtn").textContent
    };
    const firstStackRow = document.querySelector("#captureStack .capture-stack-row");
    const stackButtons = [...(firstStackRow?.querySelectorAll("button") || [])];
    const stackDelete = stackButtons.find((button) => button.textContent.startsWith("Delete"));
    const captureStackAfterCard = {
      header: document.querySelector("#captureStack .capture-stack-header")?.textContent || "",
      rows: document.querySelectorAll("#captureStack .capture-stack-row").length,
      text: firstStackRow?.textContent || "",
      buttons: stackButtons.map((button) => button.textContent),
      reviewDisabled: stackButtons.find((button) => button.textContent === "Review")?.disabled === true,
      deleteClass: stackDelete?.className || "",
      deleteTitle: stackDelete?.title || "",
      deleteAria: stackDelete?.getAttribute("aria-label") || ""
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
      .find((button) => button.textContent === "Add to notes");
    const noteButtonMeta = {
      label: noteButton?.textContent || "",
      title: noteButton?.getAttribute("title") || "",
      aria: noteButton?.getAttribute("aria-label") || ""
    };
    noteButton.click();
    const noteReopenButton = [...document.querySelectorAll("#captureList .mini-button")]
      .find((button) => button.textContent === "View in Notes");
    const noteReopenButtonMeta = {
      label: noteReopenButton?.textContent || "",
      title: noteReopenButton?.getAttribute("title") || "",
      aria: noteReopenButton?.getAttribute("aria-label") || ""
    };
    noteReopenButton.click();
    const noteReopenActivityTitle = document.querySelector("#activityTitle").textContent;
    const noteInsertions = (document.querySelector("#notesEditor").value.match(/learning-companion:capture:/g) || []).length;
    const noteHasSource = document.querySelector("#notesEditor").value.includes("t=492s");
    const noteAnchorVisible = Boolean(document.querySelector("#notesPreview [data-note-capture-id]"));
    const noteActionLabel = document.querySelector("#activityDetailsBtn").textContent;
    document.querySelector("#activityDetailsBtn").click();
    const noteTargetPulsed = Boolean(document.querySelector("#notesPreview [data-note-capture-id].pulse"));
    const noteTarget = document.querySelector("#notesPreview [data-note-capture-id]");
    const noteFocused = document.activeElement === noteTarget;
    const noteTargetAria = noteTarget?.getAttribute("aria-label") || "";
    const notesBeforeMarkerProbe = document.querySelector("#notesEditor").value;
    document.querySelector("#notesEditBtn").click();
    setValue("#notesEditor", notesBeforeMarkerProbe + "\\n\\n<!-- learning-companion:capture:manual_unbalanced:start -->\\nVisible after unbalanced marker");
    document.querySelector("#notesPreviewBtn").click();
    const markerProbePreview = document.querySelector("#notesPreview");
    const unbalancedMarkerProbe = {
      text: markerProbePreview.textContent,
      anchors: markerProbePreview.querySelectorAll('[data-note-capture-id="manual_unbalanced"]').length
    };
    setValue("#notesEditor", notesBeforeMarkerProbe);
    document.querySelector("#notesPreviewBtn").click();
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
    const clozeActivity = {
      title: document.querySelector("#activityTitle").textContent,
      detail: document.querySelector("#activityDetail").textContent,
      action: document.querySelector("#activityDetailsBtn").textContent
    };
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
    const dueFocusBriefInSidecar = {
      visible: getComputedStyle(document.querySelector(".focus-brief")).display !== "none",
      compressed: document.querySelector(".focus-brief").classList.contains("is-sidecar-redundant"),
      action: document.querySelector("#focusBriefAction").textContent,
      kicker: document.querySelector("#focusBriefKicker").textContent
    };
    const deskReviewVisibleInSidecar = getComputedStyle(document.querySelector("#deskReviewPane")).display !== "none"
      && getComputedStyle(document.querySelector(".inspector")).display === "none";
    document.querySelector("#sidecarLayoutBtn").click();
    const answerVisibleAfterReveal = document.querySelector("#deskReviewAnswer").textContent.includes("Ownership lets Rust");
    document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "2",
      bubbles: true,
      cancelable: true
    }));
    const reviewActivityAfterGood = {
      title: document.querySelector("#activityTitle").textContent,
      detail: document.querySelector("#activityDetail").textContent,
      action: document.querySelector("#activityDetailsBtn").textContent,
      targetId: document.querySelector("#activityDetailsBtn").dataset.activityTargetId || "",
      hintHidden: document.querySelector("#activityHint")?.hidden !== false,
      activeReviewText: document.querySelector("#reviewList .active-review-card")?.textContent || ""
    };
    document.querySelector("#activityDetailsBtn").click();
    const reviewNextCardAfterActivity = {
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activeReviewText: document.querySelector("#reviewList .active-review-card")?.textContent || "",
      pulsed: document.querySelector("#reviewList .active-review-card")?.classList.contains("pulse") === true
    };
    const focusBriefAfterGood = {
      action: document.querySelector("#focusBriefAction").textContent,
      kicker: document.querySelector("#focusBriefKicker").textContent
    };
    const beforeReviewQueueClearJson = window.learningCompanionNative.exportWorkspaceJson();
    const reviewQueueClearWorkspace = (() => {
      const base = JSON.parse(beforeReviewQueueClearJson);
      const createdAt = "2026-05-29T08:00:00.000Z";
      return {
        ...base,
        activeSessionId: "review_clear_session",
        sessions: [{
          id: "review_clear_session",
          originClientId: base.clientId,
          title: "Review clear smoke",
          sourceTitle: "Review clear source",
          sourceUrl: "https://example.com/review-clear-source",
          materialType: "article",
          tags: [],
          focusMode: "review",
          notesMarkdown: "",
          captures: [{
            id: "review_clear_capture",
            quote: "Review clear source quote.",
            thought: "Review clear answer.",
            timestamp: "",
            sourceTitle: "Review clear source",
            sourceUrl: "https://example.com/review-clear-source",
            materialType: "article",
            sourceProvenance: "snapshot",
            tags: [],
            createdAt,
            capturedAt: createdAt,
            updatedAt: createdAt,
            originClientId: base.clientId,
            inboxPatchId: "",
            inboxCaptureId: "",
            answersQuestionCaptureId: "",
            questionResolvedAt: null,
            questionParkedAt: null,
            promotedToReview: true
          }],
          reviewCards: [{
            id: "review_clear_card",
            prompt: "Recall the review clear prompt.",
            answer: "Review clear answer.",
            sourceCaptureId: "review_clear_capture",
            evidenceCaptureId: "",
            dueAt: "2026-05-29T08:00:00.000Z",
            strength: 0,
            createdAt,
            updatedAt: createdAt,
            lastReviewedAt: null,
            originClientId: base.clientId
          }],
          createdAt,
          updatedAt: createdAt
        }]
      };
    })();
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify(reviewQueueClearWorkspace));
    document.querySelector('[data-tab="review"]').click();
    document.querySelector('[data-reveal-card]')?.click();
    document.querySelector('[data-grade="good"]')?.click();
    const reviewQueueClearActivity = {
      title: document.querySelector("#activityTitle").textContent,
      detail: document.querySelector("#activityDetail").textContent,
      action: document.querySelector("#activityDetailsBtn").textContent,
      hintHidden: document.querySelector("#activityHint")?.hidden !== false,
      hintKind: document.querySelector("#activityHint")?.dataset.nextStepHint || "",
      hintAction: document.querySelector("#activityHintBtn")?.textContent || "",
      hintAria: document.querySelector("#activityHintBtn")?.getAttribute("aria-label") || "",
      activeTitle: document.querySelector("#sessionTitle")?.value || "",
      dueMetric: document.querySelector("#dueMetric")?.textContent || ""
    };
    let reviewQueueClearResumeHref = "";
    let reviewQueueClearResumeTarget = "";
    let reviewQueueClearResumeFeatures = "";
    const nativeReviewQueueClearWindowOpen = window.open;
    window.open = (href, target, features) => {
      reviewQueueClearResumeHref = href;
      reviewQueueClearResumeTarget = target;
      reviewQueueClearResumeFeatures = features;
      return { target, features };
    };
    document.querySelector("#activityHintBtn").click();
    window.open = nativeReviewQueueClearWindowOpen;
    const reviewQueueClearResume = {
      title: document.querySelector("#activityTitle").textContent,
      action: document.querySelector("#activityDetailsBtn").textContent,
      opened: reviewQueueClearResumeHref,
      target: reviewQueueClearResumeTarget,
      features: reviewQueueClearResumeFeatures,
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activeElement: document.activeElement?.id || "",
      capturePanePulsed: document.querySelector("#capturePane")?.classList.contains("pulse") === true
    };
    window.learningCompanionNative.importWorkspaceJson(beforeReviewQueueClearJson);
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
    const bookmarkletSetupNote = [...document.querySelectorAll(".export-section-title")]
      .find((item) => item.textContent === "Browser Capture")
      ?.nextElementSibling?.textContent || "";
    const workspaceExport = JSON.parse(document.querySelector("#workspaceExport").value);
    const reviewPackExport = document.querySelector("#reviewPackExport").value;
    const todayExport = document.querySelector("#todayExport").value;
    const mirror = JSON.parse(document.querySelector("#mirrorExport").value);
    const mirrorText = JSON.stringify(mirror);
    const baselineWorkspaceForAnswerMirror = window.learningCompanionNative.exportWorkspaceJson();
    const workspaceStateSignature = (workspaceJson) => {
      const workspace = JSON.parse(workspaceJson);
      return JSON.stringify({
        activeSessionId: workspace.activeSessionId,
        sessions: workspace.sessions.map((session) => ({
          id: session.id,
          title: session.title,
          captureIds: session.captures.map((capture) => capture.id),
          questionStates: session.captures
            .filter((capture) => /^(?:q|question)\s*[:：]/i.test(capture.thought || "") || /[?？]/.test(capture.thought || ""))
            .map((capture) => ({
              id: capture.id,
              thought: capture.thought,
              questionParkedAt: capture.questionParkedAt || "",
              questionResolvedAt: capture.questionResolvedAt || ""
            })),
          reviewCardIds: session.reviewCards.map((card) => card.id),
          notesMarkdown: session.notesMarkdown
        }))
      });
    };
    const baselineWorkspaceSignatureForAnswerMirror = workspaceStateSignature(baselineWorkspaceForAnswerMirror);
    document.querySelector('[data-focus-mode="capture"]').click();
    setValue("#quoteInput", "Mirror homepage should route this question to the phone inbox.");
    setValue("#thoughtInput", "Question: How should the phone answer this mirror question?");
    setValue("#timestampInput", "10:24");
    document.querySelector("#captureBtn").click();
    const answerMirrorWorkspaceJson = window.learningCompanionNative.exportWorkspaceJson();
    document.querySelector('[data-tab="export"]').click();
    const answerMirror = JSON.parse(document.querySelector("#mirrorExport").value);
    const answerMirrorIndexHtml = answerMirror.files.find((file) => file.path === "index.html")?.content || "";
    const answerMirrorReviewHtml = answerMirror.files.find((file) => file.path === "review.html")?.content || "";
    const answerMirrorInboxHtml = answerMirror.files.find((file) => file.path === "inbox.html")?.content || "";
    window.learningCompanionNative.importWorkspaceJson(baselineWorkspaceForAnswerMirror);
    const answerMirrorWorkspaceRestored = workspaceStateSignature(window.learningCompanionNative.exportWorkspaceJson()) === baselineWorkspaceSignatureForAnswerMirror;
    document.querySelector('[data-tab="export"]').click();
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
      className: todayDraftCard?.className || "",
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
      sourceState: document.querySelector("#captureContext").dataset.sourceState,
      sourceBorderStyle: getComputedStyle(document.querySelector("#captureContextSource")).borderStyle,
      timeHidden: document.querySelector("#captureContextTime").hidden,
      timeState: document.querySelector("#captureContext").dataset.timeState,
      contextAria: document.querySelector("#captureContext").getAttribute("aria-label"),
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
    const mirrorImportFileName = "learning-companion-mirror.json";
    const transfer = new DataTransfer();
    transfer.items.add(new File([mirrorText], mirrorImportFileName, { type: "application/json" }));
    importInput.files = transfer.files;
    importInput.dispatchEvent(new Event("change", { bubbles: true }));
    return new Promise((resolve) => {
      const waitForBrowserSmoke = (predicate, callback, deadline = Date.now() + 1500) => {
        if (predicate() || Date.now() >= deadline) {
          callback();
          return;
        }
        setTimeout(() => waitForBrowserSmoke(predicate, callback, deadline), 25);
      };
      waitForBrowserSmoke(() => {
        try {
          const importedWorkspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
          const importedSession = importedWorkspace.sessions.find((item) => item.id === importedWorkspace.activeSessionId);
          const importedPrefs = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}");
          const staleDraftStillPresent = Object.values(importedPrefs.captureDrafts || {})
            .some((draft) => draft.quote === staleDraftPruneQuote);
          return importedSession?.title === "Learning Companion MVP"
            && !staleDraftStillPresent
            && importInput.value === "";
        } catch {
          return false;
        }
      }, () => {
      const restoredWorkspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
      const restoredSession = restoredWorkspace.sessions.find((item) => item.id === restoredWorkspace.activeSessionId);
      const uiPrefsAfterImport = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}");
      const captureDraftPrunedAfterImport = !Object.values(uiPrefsAfterImport.captureDrafts || {})
        .some((draft) => draft.quote === staleDraftPruneQuote);
      const restoredMirror = JSON.parse(document.querySelector("#mirrorExport").value);
      const synthesisOccurrences = (restoredSession.notesMarkdown.match(/Synthesis - Learning Companion MVP/g) || []).length;
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
              document.querySelector('[data-return-preview-action="apply"]')?.click();
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
          document.querySelector('[data-return-preview-action="apply"]')?.click();
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
          const batchPreviewText = document.querySelector(".return-file-preview-card")?.textContent || "";
          document.querySelector('[data-return-preview-action="apply"]')?.click();
          const afterInboxImport = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
          const afterInboxSession = afterInboxImport.sessions.find((item) => item.id === afterInboxImport.activeSessionId);
          const batchReturnedCaptureId = afterInboxSession.captures.find((capture) => capture.inboxPatchId === "browser_patch_002")?.id || "";
          const batchReceiptText = document.querySelector("#importReceipt").textContent;
          const batchActivityTitle = document.querySelector("#activityTitle").textContent;
          const batchActivityDetail = document.querySelector("#activityDetail").textContent;
          const activeTabAfterBatchImport = document.querySelector(".tab.active")?.dataset.tab || "";
          const handoffAfterBatchImport = document.querySelector(".handoff-card");
          const handoffOpenAfterBatchImport = handoffAfterBatchImport?.open === true;
          const handoffPulsedAfterBatchImport = handoffAfterBatchImport?.classList.contains("pulse") === true;
          const uiPrefsAfterBatchImport = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}");
          const persistedReturnImportJson = JSON.stringify(uiPrefsAfterBatchImport.mirrorHandoff?.lastReturnImport || {});
          const persistedReturnImportHasLocalRejoin = /localRejoinTargets|rejoinTargets/.test(persistedReturnImportJson);
          document.querySelector('[data-tab="today"]').click();
          const returnedWorkCard = document.querySelector(".returned-work-card");
          const returnedWorkText = returnedWorkCard?.textContent || "";
          const returnedWorkButtons = [...(returnedWorkCard?.querySelectorAll("button") || [])].map((button) => button.textContent);
          returnedWorkCard?.querySelector("[data-returned-work-secondary]")?.click();
          const returnedWorkReceiptOpened = document.querySelector(".handoff-card")?.open === true;
          returnedWorkCard?.querySelector("[data-returned-work-action]")?.click();
          const returnedWorkActionResult = {
            activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
            returnedCaptureVisible: Boolean(batchReturnedCaptureId && document.querySelector('[data-capture-id="' + CSS.escape(batchReturnedCaptureId) + '"]')),
            returnedCapturePulsed: Boolean(batchReturnedCaptureId && document.querySelector('[data-capture-id="' + CSS.escape(batchReturnedCaptureId) + '"]')?.classList.contains("pulse")),
            activityTitle: document.querySelector("#activityTitle").textContent,
            activityDetail: document.querySelector("#activityDetail").textContent
          };
          returnedWorkCard?.querySelector('[data-returned-work-dismiss="true"]')?.click();
          const returnedWorkDismissed = !document.querySelector(".returned-work-card");
          const handoffPanel = document.querySelector(".handoff-card");
          const handoffText = handoffPanel.textContent;
          const handoffGuide = handoffPanel.querySelector("[data-device-transfer-guide]");
          const handoffExportButton = handoffPanel.querySelector('[data-return-files-step="export"]');
          const handoffGuideBeforeExport = Boolean(handoffGuide && handoffExportButton
            && (handoffGuide.compareDocumentPosition(handoffExportButton) & Node.DOCUMENT_POSITION_FOLLOWING));
          const handoffButtons = [...handoffPanel.querySelectorAll("button")].map((button) => button.textContent);
          const handoffActionGroups = [...handoffPanel.querySelectorAll(".return-files-action-group")].map((group) => ({
            label: group.getAttribute("aria-label") || "",
            steps: [...group.querySelectorAll("button")].map((button) => button.dataset.returnFilesStep || "")
          }));
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
          mirrorImportFileName,
          latestCaptureSourceUrl: restoredSession.captures[0].sourceUrl,
          latestCaptureMaterialType: restoredSession.captures[0].materialType,
          latestCaptureSourceProvenance: restoredSession.captures[0].sourceProvenance,
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
          batchPreviewText,
          batchActivityTitle,
          batchActivityDetail,
          activeTabAfterBatchImport,
          handoffOpenAfterBatchImport,
          handoffPulsedAfterBatchImport,
          persistedReturnImportHasLocalRejoin,
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
          handoffGuide: {
            open: handoffGuide?.open === true,
            text: handoffGuide?.textContent || "",
            beforeExport: handoffGuideBeforeExport
          },
          handoffButtons,
          handoffActionGroups,
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
          captureDetailAfterCard,
          captureDetailReviewOpen,
          captureStackAfterCard,
          captureStackReviewOpen,
          captureDraftStatusAfterCard,
          backupNoticeAfterCapture,
          backupNoticeAfterExport,
          sourceJumpOpened,
          focusBriefAfterCard,
          reviewActivityAfterGood,
          reviewNextCardAfterActivity,
          focusBriefAfterGood,
          reviewQueueClearActivity,
          reviewQueueClearResume,
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
          noteAnchorVisible,
          noteButtonMeta,
          noteActionLabel,
          noteReopenButtonLabel: noteReopenButton?.textContent || "",
          noteReopenButtonMeta,
          noteReopenActivityTitle,
          noteTargetPulsed,
          noteFocused,
          noteTargetAria,
          unbalancedMarkerProbe,
          searchBeforeOpen,
          searchAfterOpen,
          searchAfterFirstEscape,
          searchAfterSecondEscape,
          clozeActivity,
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
          bookmarkletSetupNote,
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
          mirrorHasIndex: restoredMirror.files.some((file) => file.path === "index.html" && file.role === "mirror-home" && /^fnv1a-[a-f0-9]{8}$/.test(file.sourceFingerprint) && file.content.includes("Learning Companion Mirror") && file.content.includes("Next from this export") && file.content.includes("Return-ready mirror") && file.content.includes("Mac return-base check") && file.content.includes("source.returnBaseFingerprint") && file.content.includes('href="TODAY.md"') && file.content.includes('href="review.html"') && file.content.includes('href="inbox.html"')),
          mirrorIndexHtml: restoredMirror.files.find((file) => file.path === "index.html")?.content || "",
          answerMirrorIndexHtml,
          answerMirrorReviewHtml,
          answerMirrorWorkspaceRestored,
          answerMirrorWorkspaceJson,
          mirrorHasWorkspace: restoredMirror.files.some((file) => file.path === "workspace.json"),
          mirrorHasToday: restoredMirror.files.some((file) => file.path === "TODAY.md" && file.content.includes("Today Study Pack") && file.content.includes("](sessions/")),
          mirrorHasReviewHtml: restoredMirror.files.some((file) => file.path === "review.html" && file.role === "portable-review" && /^fnv1a-[a-f0-9]{8}$/.test(file.sourceFingerprint) && /^fnv1a-[a-f0-9]{8}$/.test(file.sourceReturnBaseFingerprint) && file.content.includes("Learning Companion Review Pack") && file.content.includes("Return-ready mirror") && file.content.includes("data-reveal") && file.content.includes("returnBaseFingerprint") && file.content.includes("Content-Security-Policy")),
          mirrorReviewHtml: restoredMirror.files.find((file) => file.path === "review.html")?.content || "",
          mirrorHasInboxHtml: restoredMirror.files.some((file) => file.path === "inbox.html" && file.role === "mobile-inbox" && /^fnv1a-[a-f0-9]{8}$/.test(file.sourceReturnBaseFingerprint) && file.content.includes("Learning Companion Inbox") && file.content.includes("Return-ready mirror") && file.content.includes("learning-companion.mobile-inbox-patch.v1") && file.content.includes("returnBaseFingerprint") && !file.content.includes("<link") && !/<script[^>]+src=/i.test(file.content) && !/<iframe/i.test(file.content) && !/srcdoc=/i.test(file.content) && !/href=["']javascript:/i.test(file.content) && !/\\bfetch\\s*\\(/.test(file.content) && !/XMLHttpRequest/.test(file.content)),
          mirrorInboxHtml: restoredMirror.files.find((file) => file.path === "inbox.html")?.content || "",
          answerMirrorInboxHtml,
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
          dueFocusBriefInSidecar,
          deskReviewVisibleInSidecar,
          schemaVersion: restoredWorkspace.schemaVersion,
          clientId: restoredWorkspace.clientId
          });
        }, 80);
        }, 80);
        }, 80);
      }, 80);
      });
    });
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
  assert.equal(result.failedImportTitle, "Learning Companion MVP");
  assert.equal(result.importInputCleared, true);
  assert.equal(result.importInputMultiple, true);
  assert.match(result.reviewReceiptBeforeInbox, /Review progress imported/);
  assert.match(result.reviewReceiptBeforeInbox, /0 applied/);
  assert.match(result.reviewReceiptBeforeInbox, /1 missing/);
  assert.match(result.reviewReceiptBeforeInbox, /mirror base changed/);
  assert.match(result.reviewReceiptBeforeInbox, /legacy mirror check/);
  assert.match(result.reviewReceiptBeforeInbox, /older return file from previous mirror export/);
  assert.match(result.reviewReceiptBeforeInbox, /export updated mirror before next device pass/);
  assert.match(result.duplicateReviewReceiptBeforeInbox, /Review progress imported/);
  assert.match(result.duplicateReviewReceiptBeforeInbox, /0 applied/);
  assert.match(result.duplicateReviewReceiptBeforeInbox, /1 duplicate/);
  assert.match(result.duplicateReviewReceiptBeforeInbox, /mirror base changed/);
  assert.match(result.duplicateReviewReceiptBeforeInbox, /legacy mirror check/);
  assert.match(result.duplicateReviewReceiptBeforeInbox, /older return file from previous mirror export/);
  assert.equal(result.duplicateReturnNudgeBeforeInbox, false);
  assert.equal(result.inboxCaptureMetric, "5");
  assert.match(result.singleInboxReceiptText, /1 added, 0 skipped/);
  assert.match(result.singleInboxReceiptText, /1 source link stripped/);
  assert.match(result.singleInboxReceiptText, /1 answer target skipped/);
  assert.match(result.singleInboxReceiptText, /invalid: 1/);
  assert.match(result.singleInboxReceiptText, /mirror base changed/);
  assert.match(result.singleInboxReceiptText, /legacy mirror check/);
  assert.match(result.singleInboxReceiptText, /older return file from previous mirror export/);
  assert.match(result.singleInboxReceiptText, /export updated mirror before next device pass/);
  assert.match(result.singleInboxReceiptText, /topic id matched/);
  assert.equal(result.singleInboxActiveTab, "today");
  assert.match(result.singleReturnedWorkText, /older return file from previous mirror export - export updated mirror before next device pass/);
  assert.doesNotMatch(result.singleReturnedWorkText, /1 older return files/);
  assert.match(result.singleHandoffText, /1 older return file from previous mirror export - export updated mirror before next device pass/);
  assert.doesNotMatch(result.singleHandoffText, /1 older return files/);
  assert.match(result.batchReceiptText, /Return files imported/);
  assert.match(result.batchPreviewText, /Ready to apply/);
  assert.match(result.batchPreviewText, /2\/3 files parsed/);
  assert.match(result.batchPreviewText, /inbox \+1 capture/);
  assert.match(result.batchPreviewText, /review \+0 applied, 1 skipped/);
  assert.match(result.batchPreviewText, /1 failed/);
  assert.match(result.batchPreviewText, /would change workspace/);
  assert.match(result.batchReceiptText, /2\/3 files processed/);
  assert.match(result.batchReceiptText, /2 mirror bases changed/);
  assert.match(result.batchReceiptText, /2 legacy mirror checks/);
  assert.match(result.batchReceiptText, /older return files from previous mirror export/);
  assert.match(result.batchReceiptText, /export updated mirror before next device pass/);
  assert.match(result.batchReceiptText, /learning-companion-inbox-patch-20260529-0902-002\.json/);
  assert.match(result.batchReceiptText, /learning-companion-review-progress-patch-20260529-0906-missing\.json/);
  assert.match(result.batchReceiptText, /inbox: 1 added, 0 skipped/);
  assert.match(result.batchReceiptText, /review: 0 applied, 1 duplicate/);
  assert.match(result.batchReceiptText, /1 failed/);
  assert.match(result.batchReceiptText, /workspace-return-mistake\.json/);
  assert.equal(result.batchActivityTitle, "Return files imported (1 inbox, 1 review)");
  assert.match(result.batchActivityDetail, /2\/3 files processed/);
  assert.equal(result.activeTabAfterBatchImport, "today");
  assert.equal(result.handoffOpenAfterBatchImport, true);
  assert.equal(result.handoffPulsedAfterBatchImport, true);
  assert.equal(result.persistedReturnImportHasLocalRejoin, false);
  assert.match(result.returnedWorkText, /Returned from phone\/Windows/);
  assert.match(result.returnedWorkText, /1 new capture from phone or Windows/);
  assert.match(result.returnedWorkText, /3 return files checked/);
  assert.match(result.returnedWorkText, /2 older return files from previous mirror export - export updated mirror before next device pass/);
  assert.match(result.returnedWorkText, /2 succeeded/);
  assert.match(result.returnedWorkText, /1 returned capture/);
  assert.match(result.returnedWorkText, /1 failed - open Import details/);
  assert.deepEqual(result.returnedWorkButtons, ["View latest capture", "Import details", "Dismiss"]);
  assert.equal(result.returnedWorkReceiptOpened, true);
  assert.equal(result.returnedWorkActionResult.activeTab, "captures");
  assert.equal(result.returnedWorkActionResult.returnedCaptureVisible, true);
  assert.equal(result.returnedWorkActionResult.returnedCapturePulsed, true);
  assert.equal(result.returnedWorkActionResult.activityTitle, "Capture selected");
  assert.match(result.returnedWorkActionResult.activityDetail, /Batch import should report multiple files at once/);
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
  assert.match(result.handoffText, /On phone or Windows, open index\.html first; it will point you to Review, Inbox, or the source/);
  assert.match(result.handoffText, /Back on this Mac, import return files or paste a copied return file/);
  assert.match(result.handoffText, /No live Feishu sync/);
  assert.equal(result.handoffGuide.open, true);
  assert.equal(result.handoffGuide.beforeExport, true);
  assert.match(result.handoffGuide.text, /Manual round trip/);
  assert.match(result.handoffGuide.text, /Mac -> Windows/);
  assert.match(result.handoffGuide.text, /extract it first/);
  assert.match(result.handoffGuide.text, /Mac -> Harmony/);
  assert.match(result.handoffGuide.text, /Return patches move Mac-ward only/);
  assert.match(result.handoffGuide.text, /does not import inbox\/review return patches back into itself/);
  assert.match(result.handoffGuide.text, /learning-companion-inbox-patch-\*\.json/);
  assert.match(result.handoffGuide.text, /learning-companion-review-progress-patch-\*\.json/);
  assert.match(result.handoffGuide.text, /check that device browser's download list/);
  assert.match(result.handoffGuide.text, /will not auto-scan Downloads/);
  assert.match(result.handoffGuide.text, /Feishu Drive can be a manual file carrier/);
  assert.match(result.handoffText, /No mirror exported yet/);
  assert.match(result.handoffText, /Last return imported/);
  assert.match(result.handoffText, /2 files/);
  assert.match(result.handoffText, /1 new/);
  assert.match(result.handoffText, /2 older return files from previous mirror export - export updated mirror before next device pass/);
  assert.deepEqual(result.handoffButtons, ["Export Mirror", "Import Return Files", "Paste Return File"]);
  assert.deepEqual(result.handoffActionGroups, [
    { label: "Send mirror out", steps: ["export"] },
    { label: "Bring return files back", steps: ["import", "paste"] }
  ]);
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
  assert.equal(result.sourceTimestampStage.openSourceTitle, "Hide material viewer");
  assert.equal(result.sourceTimestampStage.draftStatus, "Time kept");
  assert.equal(result.sourceTimestampStage.timestampPulsed, true);
  assert.equal(result.sourceTimestampStage.contextTarget, "To Learning Companion MVP");
  assert.equal(result.sourceTimestampStage.contextTargetTitle, "Captures save to Learning Companion MVP");
  assert.equal(result.sourceTimestampStage.contextIntent, "Video moment");
  assert.equal(result.sourceTimestampStage.contextIntentTitle, "Capture the current video moment with the transcript line, question, or answer it triggered.");
  assert.match(result.sourceTimestampStage.contextDraft, /Ready for video moment in Learning Companion MVP\./);
  assert.match(result.sourceTimestampStage.contextDraft, /Source resumes at 08:12\./);
  assert.equal(result.sourceTimestampStage.quotePlaceholder, "Transcript line or key phrase at this moment");
  assert.equal(result.sourceTimestampStage.thoughtPlaceholder, "Your question, takeaway, or answer for this moment");
  assert.equal(result.sourceTimestampStage.contextSource, "RustConf ownership talk");
  assert.equal(result.sourceTimestampStage.contextSourceState, "linked");
  assert.equal(result.sourceTimestampStage.contextSourceBorderStyle, "solid");
  assert.equal(result.sourceTimestampStage.contextTime, "@ 08:12");
  assert.equal(result.sourceTimestampStage.contextTimeState, "set");
  assert.equal(
    result.sourceTimestampStage.contextAria,
    "Capture context: to Learning Companion MVP; Video moment; source RustConf ownership talk; time 08:12. Ready for video moment in Learning Companion MVP. Source resumes at 08:12."
  );
  assert.equal(result.sourceTimestampStage.contextOpenDisabled, false);
  assert.equal(result.sourceTimestampStage.contextOpenText, "Resume @ 08:12");
  assert.equal(result.sourceTimestampStage.contextOpenTitle, "Open source at 08:12");
  assert.equal(result.sourceTimestampStage.contextOpenAria, "Open source at 08:12");
  assert.equal(result.sourceTimestampStage.contextOpened, "");
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
  assert.equal(result.sourceTimestampTyped.contextOpened, "");
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
    title: "This capture will enter Open Questions.",
    summary: "Will enter Open Questions in Learning Companion MVP. Source resumes at 00:00."
  });
  assert.deepEqual(result.sourceTimestampNudge.answerDraftIntent, {
    text: "Answer draft",
    title: "This looks like an answer draft; add enough detail before saving as answer evidence.",
    summary: "Add detail before it can count as answer evidence. Source resumes at 00:00."
  });
  assert.deepEqual(result.sourceTimestampNudge.answerIntent, {
    text: "Answer",
    title: "This capture can appear in Answers Today.",
    summary: "Will appear in Answers Today in Learning Companion MVP. Source resumes at 00:00."
  });
  assert.equal(result.sourceTimestampNudge.sourceChangedDraft.status, "Source changed");
  assert.match(result.sourceTimestampNudge.sourceChangedDraft.statusClass, /warn/);
  assert.match(result.sourceTimestampNudge.sourceChangedDraft.statusTitle, /RustConf ownership talk/);
  assert.match(result.sourceTimestampNudge.sourceChangedDraft.statusTitle, /Different lecture/);
  assert.equal(result.sourceTimestampNudge.sourceChangedDraft.reanchorHidden, false);
  assert.equal(result.sourceTimestampNudge.sourceChangedDraft.role, "status");
  assert.equal(result.sourceTimestampNudge.sourceChangedDraft.ariaLive, "polite");
  assert.equal(result.sourceTimestampNudge.sourceChangedDraft.contextDraftSourceState, "changed");
  assert.match(result.sourceTimestampNudge.sourceChangedDraft.contextDraft, /Will save as a capture in Learning Companion MVP\./);
  assert.match(result.sourceTimestampNudge.sourceChangedDraft.contextDraft, /Source changed; use current to re-anchor\./);
  assert.match(result.sourceTimestampNudge.sourceChangedDraft.contextSourceClass, /warn/);
  assert.match(result.sourceTimestampNudge.sourceChangedDraft.contextSourceTitle, /Draft began on RustConf ownership talk/);
  assert.match(result.sourceTimestampNudge.sourceChangedDraft.contextSourceTitle, /current source is Different lecture/);
  assert.match(result.sourceTimestampNudge.sourceChangedDraft.contextSourceTitle, /Use current to re-anchor/);
  assert.match(result.sourceTimestampNudge.sourceChangedDraft.contextSourceAria, /Source changed/);
  assert.match(result.sourceTimestampNudge.sourceChangedDraft.contextSourceAria, /Draft began on RustConf ownership talk/);
  assert.match(result.sourceTimestampNudge.sourceChangedDraft.contextSourceAria, /current source is Different lecture/);
  assert.match(result.sourceTimestampNudge.sourceChangedTodayDraft.text, /Source changed/);
  assert.match(result.sourceTimestampNudge.sourceChangedTodayDraft.text, /Draft began on RustConf ownership talk/);
  assert.match(result.sourceTimestampNudge.sourceChangedTodayDraft.text, /current source is Different lecture/);
  assert.match(result.sourceTimestampNudge.sourceChangedTodayDraft.text, /Not exported/);
  assert.match(result.sourceTimestampNudge.sourceChangedTodayDraft.className, /source-changed/);
  assert.equal(result.sourceTimestampNudge.sourceChangedTodayDraft.resumeText, "Resume");
  assert.equal(result.sourceTimestampNudge.sourceChangedTodayResume.activeTab, "captures");
  assert.equal(result.sourceTimestampNudge.sourceChangedTodayResume.activeElement, "thoughtInput");
  assert.equal(result.sourceTimestampNudge.sourceChangedTodayResume.activityTitle, "Capture draft resumed");
  assert.match(result.sourceTimestampNudge.sourceChangedTodayResume.activityDetail, /Draft began on RustConf ownership talk/);
  assert.match(result.sourceTimestampNudge.sourceChangedTodayResume.activityDetail, /current source is Different lecture/);
  assert.equal(result.sourceTimestampNudge.sourceRestoredDraft.status, "Draft saved");
  assert.doesNotMatch(result.sourceTimestampNudge.sourceRestoredDraft.statusClass, /warn/);
  assert.equal(result.sourceTimestampNudge.sourceRestoredDraft.reanchorHidden, true);
  assert.equal(result.sourceTimestampNudge.sourceRestoredDraft.sourceUrlStored, "https://www.youtube.com/watch?v=rust123");
  assert.equal(result.sourceTimestampNudge.sourceRestoredDraft.contextDraftSourceState, "same");
  assert.doesNotMatch(result.sourceTimestampNudge.sourceRestoredDraft.contextSourceClass, /warn/);
  assert.equal(result.sourceTimestampNudge.sourceReanchoredDraft.status, "Draft saved");
  assert.doesNotMatch(result.sourceTimestampNudge.sourceReanchoredDraft.statusClass, /warn/);
  assert.equal(result.sourceTimestampNudge.sourceReanchoredDraft.reanchorHidden, true);
  assert.equal(result.sourceTimestampNudge.sourceReanchoredDraft.activityTitle, "Draft source updated");
  assert.match(result.sourceTimestampNudge.sourceReanchoredDraft.activityDetail, /Different lecture/);
  assert.deepEqual(result.sourceTimestampNudge.sourceReanchorCleared, { status: "No draft", reanchorHidden: true });
  assert.match(result.todayDraftBeforeResume.listText, /Capture Drafts/);
  assert.match(result.todayDraftBeforeResume.text, /Draft quote before session switch/);
  assert.doesNotMatch(result.todayDraftBeforeResume.text, /Source changed/);
  assert.doesNotMatch(result.todayDraftBeforeResume.className, /source-changed/);
  assert.match(result.todayDraftBeforeResume.text, /device-local/);
  assert.match(result.todayDraftBeforeResume.text, /Not exported/);
  assert.equal(result.todayDraftBeforeResume.resumeText, "Resume");
  assert.deepEqual(result.todayDraftAfterResume, {
    activeTab: "captures",
    focusMode: true,
    activeElement: "thoughtInput",
    activity: "Capture draft resumed"
  });
  assert.deepEqual(result.captureDraftStatusBeforeSwitch, { text: "Draft saved", clearHidden: false });
  assert.deepEqual(result.captureDraftStatusInNewSession, { text: "No draft", clearHidden: true });
  assert.equal(result.captureDraftNewSessionEmpty, true);
  assert.deepEqual(result.captureContextInNewSession, {
    target: "To New learning session",
    targetTitle: "Captures save to New learning session",
    intent: "No source",
    source: "No source",
    sourceState: "missing",
    sourceBorderStyle: "dashed",
    timeHidden: true,
    timeState: "unset",
    contextAria: "Capture context: to New learning session; No source; source no source set; no timestamp. Ready for no source in New learning session. No source resume yet.",
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
  assert.equal(result.mirrorImportFileName, "learning-companion-mirror.json");
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
  assert.equal(result.dueFocusBriefInSidecar.visible, true);
  assert.equal(result.dueFocusBriefInSidecar.compressed, false);
  assert.match(result.dueFocusBriefInSidecar.action, /Review 2 (workspace )?due cards/);
  assert.match(result.dueFocusBriefInSidecar.kicker, /2 due/);
  assert.equal(result.deskReviewVisibleInSidecar, true);
  assert.equal(result.answerVisibleAfterReveal, true);
  assert.equal(result.dueMetric, "1");
  assert.equal(result.dueAfterGood, "1");
  assert.equal(result.gradedCount, 1);
  assert.equal(result.reviewActivityAfterGood.title, "Review updated");
  assert.match(result.reviewActivityAfterGood.detail, /Next card is ready/);
  assert.equal(result.reviewActivityAfterGood.action, "Next card");
  assert.equal(result.reviewActivityAfterGood.hintHidden, true);
  assert.match(result.reviewActivityAfterGood.activeReviewText, /Spaced repetition improves/);
  assert.equal(result.reviewNextCardAfterActivity.activeTab, "review");
  assert.match(result.reviewNextCardAfterActivity.activeReviewText, /Spaced repetition improves/);
  assert.equal(result.reviewNextCardAfterActivity.pulsed, true);
  assert.equal(result.reviewQueueClearActivity.title, "Review queue clear");
  assert.match(result.reviewQueueClearActivity.detail, /No due cards left/);
  assert.equal(result.reviewQueueClearActivity.action, "Capture");
  assert.equal(result.reviewQueueClearActivity.hintHidden, false);
  assert.equal(result.reviewQueueClearActivity.hintKind, "afterReviewQueueClearedTextSourceLinked");
  assert.equal(result.reviewQueueClearActivity.hintAction, "Open at quote");
  assert.equal(result.reviewQueueClearActivity.hintAria, "Open the source; jump to the last reviewed quote if supported");
  assert.equal(result.reviewQueueClearActivity.activeTitle, "Review clear smoke");
  assert.equal(result.reviewQueueClearActivity.dueMetric, "0");
  assert.deepEqual(result.reviewQueueClearResume, {
    title: "Source resumed",
    action: "View capture",
    opened: "https://example.com/review-clear-source#:~:text=Review%20clear%20source%20quote.",
    target: "_blank",
    features: "noopener,noreferrer",
    activeTab: "captures",
    activeElement: "quoteInput",
    capturePanePulsed: true
  });
  assert.equal(result.activityAfterCard.title, "Capture and card saved");
  assert.match(result.activityAfterCard.detail, /08:12/);
  assert.equal(result.activityAfterCard.action, "Resume source");
  assert.equal(result.activityAfterCard.hintKind, "afterCardMade");
  assert.equal(result.activityAfterCard.hintAction, "Review card");
  assert.equal(result.activityAfterCard.openLinkText, "Open @ 08:12");
  assert.equal(result.captureDetailAfterCard.nextKind, "review-ready");
  assert.equal(result.captureDetailAfterCard.nextText, "Card scheduled · keep reading.");
  assert.deepEqual(result.captureDetailAfterCard.buttons, ["Open @ 08:12", "Add to notes", "Review", "Delete + 1 card"]);
  assert.equal(result.captureDetailAfterCard.reviewDisabled, false);
  assert.match(result.captureDetailAfterCard.deleteClass, /tertiary/);
  assert.match(result.captureDetailAfterCard.deleteClass, /danger/);
  assert.match(result.captureDetailAfterCard.deleteTitle, /Delete this capture and 1 linked review card after confirmation/);
  assert.equal(result.captureDetailAfterCard.deleteAria, result.captureDetailAfterCard.deleteTitle);
  assert.equal(result.captureDetailReviewOpen.activeTab, "review");
  assert.equal(result.captureDetailReviewOpen.focusMode, "review");
  assert.match(result.captureDetailReviewOpen.deskReviewPrompt, /compiler-enforced lifetimes/);
  assert.equal(result.captureDetailReviewOpen.activityTitle, "Review card opened");
  assert.equal(result.captureDetailReviewOpen.activityAction, "Review");
  assert.equal(result.clozeActivity.title, "Cloze card saved");
  assert.match(result.clozeActivity.detail, /durable/);
  assert.equal(result.clozeActivity.action, "Review");
  assert.match(result.captureStackAfterCard.header, /Recent Stack/);
  assert.match(result.captureStackAfterCard.header, /1 shown · 1 total/);
  assert.equal(result.captureStackAfterCard.rows, 1);
  assert.match(result.captureStackAfterCard.text, /08:12/);
  assert.match(result.captureStackAfterCard.text, /compiler-enforced lifetimes/);
  assert.deepEqual(result.captureStackAfterCard.buttons, ["Open @ 08:12", "Add to notes", "Review", "Delete + 1 card"]);
  assert.equal(result.captureStackAfterCard.reviewDisabled, false);
  assert.match(result.captureStackAfterCard.deleteClass, /tertiary/);
  assert.match(result.captureStackAfterCard.deleteClass, /danger/);
  assert.match(result.captureStackAfterCard.deleteTitle, /Delete this capture and 1 linked review card after confirmation/);
  assert.equal(result.captureStackAfterCard.deleteAria, result.captureStackAfterCard.deleteTitle);
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
  assert.equal(result.noteAnchorVisible, true);
  assert.deepEqual(result.noteButtonMeta, {
    label: "Add to notes",
    title: "Add this capture to Notes for synthesis",
    aria: "Add this capture to Notes"
  });
  assert.equal(result.noteReopenButtonLabel, "View in Notes");
  assert.deepEqual(result.noteReopenButtonMeta, {
    label: "View in Notes",
    title: "View this generated capture block in Notes",
    aria: "View this capture in Notes"
  });
  assert.equal(result.noteReopenActivityTitle, "Capture note opened");
  assert.equal(result.noteActionLabel, "View note");
  assert.equal(result.noteTargetPulsed, true);
  assert.equal(result.noteFocused, true);
  assert.equal(result.noteTargetAria, "Generated capture note");
  assert.match(result.unbalancedMarkerProbe.text, /learning-companion:capture:manual_unbalanced:start/);
  assert.match(result.unbalancedMarkerProbe.text, /Visible after unbalanced marker/);
  assert.equal(result.unbalancedMarkerProbe.anchors, 0);
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
  assert.equal(result.backupNoticeAfterExport.text, "Backup export requested - verify the exported file");
  assert.equal(result.backupNoticeAfterExport.directedSaveDestination, false);
  assert.equal(result.backupNoticeAfterExport.automatedDownloadFallback, true);
  assert.match(result.backupNoticeAfterExport.fingerprint, /^[a-f0-9]{8}$/);
  assert.match(result.backupNoticeAfterExport.exportedAt, /^20/);
  assert.deepEqual(result.captureDraftStatusAfterCard, {
    text: "Time kept",
    clearHidden: false,
    statusClass: "save-state capture-draft-status",
    statusTitle: ""
  });
  assert.equal(result.sourceJumpOpened, "");
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
  assert.match(result.bookmarkletSetupNote, /Copy Clip/);
  assert.match(result.bookmarkletSetupNote, /browser bookmark/);
  assert.match(result.bookmarkletSetupNote, /selected text, title, URL, and video time/);
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
  assert.match(result.mirrorIndexHtml, /Next from this export/);
  assert.ok(result.mirrorIndexHtml.indexOf("Next from this export") < result.mirrorIndexHtml.indexOf("Mirror entry points"));
  assert.match(result.mirrorIndexHtml, /Review due cards|Answer next question|Capture on this device/);
  assert.match(result.mirrorIndexHtml, /As of \d{4}-\d{2}-\d{2}T/);
  assert.match(result.mirrorIndexHtml, /device-next-link:focus-visible/);
  assert.match(result.mirrorIndexHtml, /Read Today/);
  assert.match(result.mirrorIndexHtml, /Work here/);
  assert.match(result.mirrorIndexHtml, /Return file back to Mac/);
  assert.doesNotMatch(result.mirrorIndexHtml, /Return JSON back to Mac/);
  assert.match(result.mirrorIndexHtml, /Today &gt; Return Files/);
  assert.equal(result.mirrorHasWorkspace, true);
  assert.equal(result.mirrorHasToday, true);
  assert.equal(result.mirrorHasReviewHtml, true);
  assert.match(result.mirrorReviewHtml, /learning-companion\.review-progress-patch\.v1/);
  assert.match(result.mirrorReviewHtml, /Return to Mac/);
  assert.match(result.mirrorReviewHtml, /Save Return File/);
  assert.doesNotMatch(result.mirrorReviewHtml, /Save Return JSON/);
  assert.doesNotMatch(result.mirrorReviewHtml, /Copy Return JSON/);
  assert.doesNotMatch(result.mirrorReviewHtml, /Return JSON file/);
  assert.match(result.mirrorReviewHtml, /returnNextStep/);
  assert.match(result.mirrorReviewHtml, /returnAfterSaveFollowup/);
  assert.match(result.answerMirrorReviewHtml, /Answer 1 open question/);
  assert.match(result.answerMirrorReviewHtml, /inbox\.html\?/);
  assert.equal(result.mirrorHasInboxHtml, true);
  assert.match(result.mirrorInboxHtml, /Learning Companion Inbox/);
  assert.match(result.mirrorInboxHtml, /Return to Mac/);
  assert.match(result.mirrorInboxHtml, /Save Return File/);
  assert.doesNotMatch(result.mirrorInboxHtml, /Save Return JSON/);
  assert.doesNotMatch(result.mirrorInboxHtml, /Copy Return JSON/);
  assert.doesNotMatch(result.mirrorInboxHtml, /Return JSON file/);
  assert.match(result.mirrorInboxHtml, /returnNextStep/);
  assert.match(result.mirrorInboxHtml, /returnAfterSaveFollowup/);
  assert.match(result.mirrorInboxHtml, /Review \d+ due card/);
  assert.equal(result.mirrorTodayEscapesScript, true);
  assert.equal(result.mirrorReviewEscapesScript, true);
  assert.equal(result.mirrorHasMarkdown, true);
  assert.equal(result.mirrorHasTimeJump, true);
  assert.equal(result.mirrorFingerprintsValid, true);
  assert.equal(result.schemaVersion, 2);
  assert.match(result.clientId, /^client_/);

  const importErrorReceipts = await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitUntil = async (predicate, timeoutMs = 3000) => {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        if (predicate()) return true;
        await wait(25);
      }
      return predicate();
    };
    const input = document.querySelector("#importWorkspaceInput");
    const nativeConfirm = window.confirm;
    const workspaceBefore = window.learningCompanionNative.exportWorkspaceJson();
    window.confirm = () => true;
    const importJsonFile = async (fileName, text, expectedPattern) => {
      delete input.dataset.importMode;
      const transfer = new DataTransfer();
      transfer.items.add(new File([text], fileName, { type: "application/json" }));
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      const matched = await waitUntil(() => {
        const receipt = document.querySelector("#importReceipt")?.textContent || "";
        return input.value === "" && expectedPattern.test(receipt);
      });
      return {
        matched,
        receipt: document.querySelector("#importReceipt")?.textContent || "",
        inputValue: input.value,
        modeAfter: input.dataset.importMode || "",
        visibleError: document.querySelector("#importReceipt")?.classList.contains("import-receipt-error") === true
      };
    };
    try {
      const badMirrorBundle = {
        schema: "learning-companion.mirror-bundle.staging.v1",
        contractStability: "experimental",
        canonical: "bad.json",
        manifest: { totalBytes: 0, fileCount: 0 },
        files: []
      };
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
      return {
        badMirror: await importJsonFile("bad-mirror.json", JSON.stringify(badMirrorBundle), /bad-mirror\\.json/),
        malformed: await importJsonFile("broken-patch.json", "{ broken json", /broken-patch\\.json/),
        oversized: await importJsonFile("oversized-inbox-patch.json", JSON.stringify(oversizedInboxPatch), /oversized-inbox-patch\\.json/)
      };
    } finally {
      window.confirm = nativeConfirm;
      window.learningCompanionNative.importWorkspaceJson(workspaceBefore);
      document.querySelector('[data-tab="today"]')?.click();
    }
  })()`);
  assert.equal(importErrorReceipts.badMirror.matched, true);
  assert.match(importErrorReceipts.badMirror.receipt, /Import issue/);
  assert.match(importErrorReceipts.badMirror.receipt, /bad-mirror\.json/);
  assert.match(importErrorReceipts.badMirror.receipt, /canonical payload/);
  assert.equal(importErrorReceipts.badMirror.inputValue, "");
  assert.equal(importErrorReceipts.badMirror.modeAfter, "");
  assert.equal(importErrorReceipts.malformed.matched, true);
  assert.match(importErrorReceipts.malformed.receipt, /Import issue/);
  assert.match(importErrorReceipts.malformed.receipt, /broken-patch\.json/);
  assert.equal(importErrorReceipts.malformed.inputValue, "");
  assert.equal(importErrorReceipts.oversized.matched, true);
  assert.match(importErrorReceipts.oversized.receipt, /Import issue/);
  assert.match(importErrorReceipts.oversized.receipt, /oversized-inbox-patch\.json/);
  assert.match(importErrorReceipts.oversized.receipt, /Mobile inbox patch is too large/);
  assert.equal(importErrorReceipts.oversized.visibleError, true);
  assert.equal(importErrorReceipts.oversized.inputValue, "");

  const mirrorSaveReceipt = await cdp.evaluate(`(async () => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const actionSnapshot = () => [...document.querySelectorAll(".handoff-card [data-return-files-step]")].map((button) => ({
      text: button.textContent,
      step: button.dataset.returnFilesStep || "",
      primary: button.classList.contains("primary")
    }));
    const actionHintText = () => document.querySelector("[data-return-files-action-hint]")?.textContent || "";
    const changeDetailSnapshot = () => {
      const node = document.querySelector('[data-testid="device-flow-change-detail"]');
      return {
        present: Boolean(node),
        title: node?.querySelector("strong")?.textContent || "",
        text: node?.textContent || "",
        items: node ? [...node.querySelectorAll("li")].map((item) => item.textContent) : []
      };
    };
    const workspaceBeforeStaleCheck = window.learningCompanionNative.exportWorkspaceJson();
    const exportedWorkspace = JSON.parse(workspaceBeforeStaleCheck);
    const exportedSession = exportedWorkspace.sessions.find((item) => item.id === exportedWorkspace.activeSessionId) || exportedWorkspace.sessions[0];
    document.querySelector('[data-tab="export"]').click();
    const mirrorExportBeforeSave = document.querySelector("#mirrorExport").value;
    document.querySelector("#downloadMirrorBtn").click();
    await new Promise((resolve) => setTimeout(resolve, 20));
      document.querySelector('[data-tab="today"]').click();
      const prefs = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}");
      const exportActivityTitle = document.querySelector("#activityTitle").textContent;
      const exportActivityDetail = document.querySelector("#activityDetail").textContent;
      const exportToast = document.querySelector("#toast").textContent;
      const currentHandoffText = document.querySelector(".handoff-card")?.textContent || "";
      const currentHandoffSummary = document.querySelector(".device-flow-summary .item-meta")?.textContent || "";
      const currentHandoffActions = actionSnapshot();
      const currentActionHint = actionHintText();
      const currentChangeDetail = changeDetailSnapshot();
      document.querySelector('[data-tab="captures"]').click();
      setValue("#quoteInput", "Mac-side capture after mirror export.");
      setValue("#thoughtInput", "This new point should make the mirror content stale.");
      document.querySelector("#captureBtn").click();
      document.querySelector('[data-tab="today"]').click();
      const staleHandoffText = document.querySelector(".handoff-card")?.textContent || "";
      const staleHandoffSummary = document.querySelector(".device-flow-summary .item-meta")?.textContent || "";
      const staleHandoffActions = actionSnapshot();
      const staleActionHint = actionHintText();
      const staleChangeDetail = changeDetailSnapshot();
      document.querySelector('[data-tab="captures"]').click();
      setValue("#quoteInput", "Second Mac-side capture after mirror export.");
      setValue("#thoughtInput", "Plural stale details should stay grammatically correct.");
      document.querySelector("#captureBtn").click();
      document.querySelector('[data-tab="today"]').click();
      const pluralStaleHandoffSummary = document.querySelector(".device-flow-summary .item-meta")?.textContent || "";
      const pluralStaleChangeDetail = changeDetailSnapshot();
      document.querySelector('[data-return-files-step="export"]')?.click();
      const reExportOpenedTab = document.querySelector(".tab.active")?.dataset.tab || "";
      document.querySelector("#downloadMirrorBtn").click();
      await new Promise((resolve) => setTimeout(resolve, 20));
      document.querySelector('[data-tab="today"]').click();
      const reExportedHandoffSummary = document.querySelector(".device-flow-summary .item-meta")?.textContent || "";
      const reExportedHandoffActions = actionSnapshot();
      const reExportedActionHint = actionHintText();
      const reExportedChangeDetail = changeDetailSnapshot();
      document.querySelector('[data-tab="captures"]').click();
      setValue("#sourceTitle", "Browser source retitled after mirror export");
      document.querySelector('[data-tab="today"]').click();
      const fingerprintOnlyHandoffSummary = document.querySelector(".device-flow-summary .item-meta")?.textContent || "";
      const fingerprintOnlyChangeDetail = changeDetailSnapshot();
      window.learningCompanionNative.importWorkspaceJson(workspaceBeforeStaleCheck);
      document.querySelector('[data-tab="export"]').click();
      document.querySelector("#downloadMirrorBtn").click();
      await new Promise((resolve) => setTimeout(resolve, 20));
      document.querySelector('[data-tab="today"]').click();
      const returnPatch = {
        schema: "learning-companion.mobile-inbox-patch.v1",
        appVersion: 1,
        patchId: "browser_return_after_mirror_export_001",
        createdAt: "2026-06-03T21:40:00+08:00",
        source: {
          generatedBy: "inbox.html",
          workspaceFingerprint: prefs.mirrorHandoff?.workspaceFingerprint || "",
          returnBaseFingerprint: prefs.mirrorHandoff?.returnBaseFingerprint || "",
          topicId: exportedSession.id,
          topicTitle: exportedSession.title
        },
        target: {
          topicId: exportedSession.id,
          topicTitle: exportedSession.title
        },
        captures: [{
          id: "browser_return_after_mirror_export_capture_001",
          quote: "Phone return after mirror export.",
          thought: "A successful return import should become the next export baseline.",
          capturedAt: "2026-06-03T21:41:00+08:00"
        }]
      };
      const returnImportResult = window.learningCompanionNative.importWorkspaceJson(JSON.stringify(returnPatch));
      document.querySelector('[data-tab="today"]').click();
      const returnedHandoffText = document.querySelector(".handoff-card")?.textContent || "";
      const returnedHandoffSummary = document.querySelector(".device-flow-summary .item-meta")?.textContent || "";
      const returnedHandoffActions = actionSnapshot();
      const returnedActionHint = actionHintText();
      const returnedChangeDetail = changeDetailSnapshot();
      const prefsAfterReturn = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}");
      const workspaceAfterReturnImport = window.learningCompanionNative.exportWorkspaceJson();
      window.learningCompanionNative.importWorkspaceJson(workspaceAfterReturnImport);
      document.querySelector('[data-tab="today"]').click();
      const roundTripReturnedHandoffSummary = document.querySelector(".device-flow-summary .item-meta")?.textContent || "";
      document.querySelector('[data-tab="captures"]').click();
      setValue("#quoteInput", "Mac-side capture after return import.");
      setValue("#thoughtInput", "After a successful return, a new Mac note should require another mirror export.");
      document.querySelector("#captureBtn").click();
      document.querySelector('[data-tab="today"]').click();
      const postReturnStaleSummary = document.querySelector(".device-flow-summary .item-meta")?.textContent || "";
      window.learningCompanionNative.importWorkspaceJson(workspaceBeforeStaleCheck);
      document.querySelector('[data-tab="today"]').click();
      return {
        activityTitle: exportActivityTitle,
        activityDetail: exportActivityDetail,
        toast: exportToast,
        handoffText: currentHandoffText,
        handoffSummary: currentHandoffSummary,
        currentHandoffActions,
        currentActionHint,
        currentChangeDetail,
        staleHandoffText,
        staleHandoffSummary,
        staleHandoffActions,
        staleActionHint,
        staleChangeDetail,
        pluralStaleHandoffSummary,
        pluralStaleChangeDetail,
        reExportOpenedTab,
        reExportedHandoffSummary,
        reExportedHandoffActions,
        reExportedActionHint,
        reExportedChangeDetail,
        fingerprintOnlyHandoffSummary,
        fingerprintOnlyChangeDetail,
        returnImportOk: returnImportResult.ok === true,
        returnImportKind: returnImportResult.kind || "",
        returnedHandoffText,
        returnedHandoffSummary,
        returnedHandoffActions,
        returnedActionHint,
        returnedChangeDetail,
        roundTripReturnedHandoffSummary,
        lastReturnImportWorkspaceFingerprint: prefsAfterReturn.mirrorHandoff?.lastReturnImport?.workspaceFingerprint || "",
        postReturnStaleSummary,
        mirrorHandoffKind: prefs.mirrorHandoff?.kind || "",
        mirrorHandoffWorkspaceFingerprint: prefs.mirrorHandoff?.workspaceFingerprint || "",
        mirrorHandoffHasFingerprint: /^fnv1a-[a-f0-9]{8}$/.test(prefs.mirrorHandoff?.returnBaseFingerprint || ""),
        mirrorHandoffExportStats: prefs.mirrorHandoff?.exportStats || {},
        mirrorExportLeaksHandoff: mirrorExportBeforeSave.includes("mirrorHandoff")
      };
  })()`);
  assert.equal(mirrorSaveReceipt.activityTitle, "Mirror JSON handoff ready");
  assert.equal(mirrorSaveReceipt.activityDetail, "Move the Mirror JSON through USB, AirDrop, email, file share, or a manual Feishu Drive upload; then open index.html on the device and follow its Next from this export route.");
  assert.equal(mirrorSaveReceipt.toast, "Mirror download requested");
  assert.match(mirrorSaveReceipt.handoffText, /Mirror current/);
  assert.match(mirrorSaveReceipt.handoffText, /Waiting for return file/);
  assert.match(mirrorSaveReceipt.handoffSummary, /Mirror ready/);
  assert.deepEqual(mirrorSaveReceipt.currentHandoffActions, [
    { text: "Export Mirror", step: "export", primary: false },
    { text: "Import Return Files", step: "import", primary: true },
    { text: "Paste Return File", step: "paste", primary: false }
  ]);
  assert.match(mirrorSaveReceipt.currentActionHint, /import or paste the return file/);
  assert.equal(mirrorSaveReceipt.currentChangeDetail.present, false);
  assert.match(mirrorSaveReceipt.staleHandoffText, /Mac changed since mirror export/);
  assert.match(mirrorSaveReceipt.staleHandoffText, /Since Mirror JSON export: 1 new capture/);
  assert.match(mirrorSaveReceipt.staleHandoffSummary, /Mac changed · 1 new capture/);
  assert.equal(mirrorSaveReceipt.staleChangeDetail.present, true);
  assert.equal(mirrorSaveReceipt.staleChangeDetail.title, "Mirror contents changed");
  assert.deepEqual(mirrorSaveReceipt.staleChangeDetail.items, ["1 new capture"]);
  assert.match(mirrorSaveReceipt.staleChangeDetail.text, /manual transfer is not live sync/);
  assert.match(mirrorSaveReceipt.pluralStaleHandoffSummary, /Mac changed · 2 new captures/);
  assert.equal(mirrorSaveReceipt.pluralStaleChangeDetail.present, true);
  assert.deepEqual(mirrorSaveReceipt.pluralStaleChangeDetail.items, ["2 new captures"]);
  assert.deepEqual(mirrorSaveReceipt.staleHandoffActions, [
    { text: "Export Updated Mirror", step: "export", primary: true },
    { text: "Import Return Files", step: "import", primary: false },
    { text: "Paste Return File", step: "paste", primary: false }
  ]);
  assert.match(mirrorSaveReceipt.staleActionHint, /export an updated mirror before another phone or Windows/);
  assert.equal(mirrorSaveReceipt.reExportOpenedTab, "export");
  assert.match(mirrorSaveReceipt.reExportedHandoffSummary, /Mirror ready/);
  assert.doesNotMatch(mirrorSaveReceipt.reExportedHandoffSummary, /Mac changed/);
  assert.deepEqual(mirrorSaveReceipt.reExportedHandoffActions, [
    { text: "Export Mirror", step: "export", primary: false },
    { text: "Import Return Files", step: "import", primary: true },
    { text: "Paste Return File", step: "paste", primary: false }
  ]);
  assert.match(mirrorSaveReceipt.reExportedActionHint, /import or paste the return file/);
  assert.equal(mirrorSaveReceipt.reExportedChangeDetail.present, false);
  assert.match(mirrorSaveReceipt.fingerprintOnlyHandoffSummary, /Mac changed · workspace changed/);
  assert.equal(mirrorSaveReceipt.fingerprintOnlyChangeDetail.present, true);
  assert.equal(mirrorSaveReceipt.fingerprintOnlyChangeDetail.title, "Mirror baseline changed");
  assert.deepEqual(mirrorSaveReceipt.fingerprintOnlyChangeDetail.items, ["workspace changed"]);
  assert.equal(mirrorSaveReceipt.returnImportOk, true);
  assert.equal(mirrorSaveReceipt.returnImportKind, "mobile-inbox-patch");
  assert.match(mirrorSaveReceipt.returnedHandoffSummary, /Return imported · ready for next export/);
  assert.doesNotMatch(mirrorSaveReceipt.returnedHandoffSummary, /Mac changed/);
  assert.match(mirrorSaveReceipt.roundTripReturnedHandoffSummary, /Return imported · ready for next export/);
  assert.doesNotMatch(mirrorSaveReceipt.roundTripReturnedHandoffSummary, /Mac changed/);
  assert.match(mirrorSaveReceipt.returnedHandoffText, /Return imported/);
  assert.match(mirrorSaveReceipt.returnedHandoffText, /Ready to export a fresh mirror/);
  assert.deepEqual(mirrorSaveReceipt.returnedHandoffActions, [
    { text: "Export Updated Mirror", step: "export", primary: true },
    { text: "Import Return Files", step: "import", primary: false },
    { text: "Paste Return File", step: "paste", primary: false }
  ]);
  assert.match(mirrorSaveReceipt.returnedActionHint, /export a fresh mirror/);
  assert.equal(mirrorSaveReceipt.returnedChangeDetail.present, false);
  assert.match(mirrorSaveReceipt.lastReturnImportWorkspaceFingerprint, /^[a-f0-9]{8}$/);
  assert.match(mirrorSaveReceipt.postReturnStaleSummary, /Mac changed/);
  assert.equal(mirrorSaveReceipt.mirrorHandoffKind, "Mirror JSON");
  assert.match(mirrorSaveReceipt.mirrorHandoffWorkspaceFingerprint, /^[a-f0-9]{8}$/);
  assert.equal(mirrorSaveReceipt.mirrorHandoffHasFingerprint, true);
  assert.equal(mirrorSaveReceipt.mirrorHandoffExportStats.captures >= 1, true);
  assert.equal(mirrorSaveReceipt.mirrorHandoffExportStats.cards >= 1, true);
  assert.equal(mirrorSaveReceipt.mirrorExportLeaksHandoff, false);

  const exceptionsBeforeMirrorIndexClick = exceptions.length;
  const workspaceBeforeMirrorAnswerReturnImport = await cdp.evaluate(`window.learningCompanionNative.exportWorkspaceJson()`);
  assert.match(result.answerMirrorIndexHtml, /1 open question/);
  virtualRoutes.set("/mirror-index.html", result.answerMirrorIndexHtml);
  virtualRoutes.set("/inbox.html", result.answerMirrorInboxHtml);
  await cdp.send("Page.navigate", { url: `${appUrl}mirror-index.html` });
  await sleep(300);
  const mirrorIndexAnswerClick = await cdp.evaluate(`(() => {
    const link = document.querySelector('a.device-next-link[href^="inbox.html?"]') || document.querySelector('a.device-next-secondary[href^="inbox.html?"]');
    const state = {
      heading: document.querySelector("h1")?.textContent || "",
      label: link?.textContent || "",
      href: link?.getAttribute("href") || ""
    };
    link?.click();
    return state;
  })()`);
  await sleep(300);
  const mirrorIndexAnswerLanding = await cdp.evaluate(`(() => {
    const answerToCaptureId = new URLSearchParams(window.location.search).get("answerToCaptureId") || "";
    const beforeAdd = {
      path: window.location.pathname,
      search: window.location.search,
      answerToCaptureId,
      answerContextHidden: document.querySelector("#answerContext")?.hidden,
      quoteLabel: document.querySelector("#quoteLabel")?.textContent || "",
      thoughtLabel: document.querySelector("#thoughtLabel")?.textContent || "",
      quotePlaceholder: document.querySelector("#quoteInput")?.placeholder || "",
      thoughtPlaceholder: document.querySelector("#thoughtInput")?.placeholder || "",
      quoteReadOnly: document.querySelector("#quoteInput")?.readOnly === true,
      thoughtReadOnly: document.querySelector("#thoughtInput")?.readOnly === true,
      thoughtDisabled: document.querySelector("#thoughtInput")?.disabled === true,
      quoteAriaReadonly: document.querySelector("#quoteInput")?.getAttribute("aria-readonly") || "",
      preview: document.querySelector("#answerQuestionPreview")?.textContent || ""
    };
    const answerText = "Answer: route verified from mirror home and ready for Mac import.";
    const answerValueAfterInput = (() => {
      const field = document.querySelector("#thoughtInput");
      if (!field) return "";
      field.value = answerText;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      return field.value;
    })();
    document.querySelector("#addCaptureBtn").click();
    const patch = JSON.parse(document.querySelector("#patchPreview").textContent);
    const capture = patch.captures.find((item) => item.answersQuestionCaptureId === answerToCaptureId) || {};
    return {
      ...beforeAdd,
      answerValueAfterInput,
      patchJson: JSON.stringify(patch),
      patchSchema: patch.schema || "",
      patchCaptureCount: patch.captures.length,
      patchThought: capture.thought || "",
      patchAnswersQuestionCaptureId: capture.answersQuestionCaptureId || "",
      postAddStatus: document.querySelector("#statusOutput")?.textContent || "",
      postAddQuoteLabel: document.querySelector("#quoteLabel")?.textContent || "",
      postAddThoughtLabel: document.querySelector("#thoughtLabel")?.textContent || "",
      postAddAnswerContextTitle: document.querySelector("#answerContextTitle")?.textContent || ""
    };
  })()`);
  assert.equal(exceptions.length, exceptionsBeforeMirrorIndexClick);
  assert.equal(result.answerMirrorWorkspaceRestored, true);
  assert.match(mirrorIndexAnswerClick.heading, /Learning Companion Mirror/);
  assert.match(mirrorIndexAnswerClick.heading, /学习伴侣镜像/);
  assert.match(mirrorIndexAnswerClick.label, /Answer|question/i);
  assert.match(mirrorIndexAnswerClick.href, /^inbox\.html\?/);
  assert.equal(mirrorIndexAnswerLanding.path, "/inbox.html");
  assert.match(mirrorIndexAnswerLanding.search, /answerToCaptureId=/);
  assert.notEqual(mirrorIndexAnswerLanding.answerToCaptureId, "");
  assert.equal(mirrorIndexAnswerLanding.answerContextHidden, false);
  assert.match(mirrorIndexAnswerLanding.quoteLabel, /Question from Mac/);
  assert.match(mirrorIndexAnswerLanding.quoteLabel, /来自 Mac 的问题/);
  assert.match(mirrorIndexAnswerLanding.thoughtLabel, /Answer to return/);
  assert.match(mirrorIndexAnswerLanding.thoughtLabel, /要带回的回答/);
  assert.match(mirrorIndexAnswerLanding.quotePlaceholder, /Question carried from the Mac mirror/);
  assert.match(mirrorIndexAnswerLanding.thoughtPlaceholder, /Write the answer to bring back to Mac/);
  assert.equal(mirrorIndexAnswerLanding.quoteReadOnly, true);
  assert.equal(mirrorIndexAnswerLanding.thoughtReadOnly, false);
  assert.equal(mirrorIndexAnswerLanding.thoughtDisabled, false);
  assert.equal(mirrorIndexAnswerLanding.answerValueAfterInput, "Answer: route verified from mirror home and ready for Mac import.");
  assert.equal(mirrorIndexAnswerLanding.quoteAriaReadonly, "true");
  assert.notEqual(mirrorIndexAnswerLanding.preview, "");
  assert.equal(mirrorIndexAnswerLanding.patchSchema, "learning-companion.mobile-inbox-patch.v1");
  assert.equal(mirrorIndexAnswerLanding.patchCaptureCount, 1);
  assert.equal(mirrorIndexAnswerLanding.patchThought, "Answer: route verified from mirror home and ready for Mac import.");
  assert.equal(mirrorIndexAnswerLanding.patchAnswersQuestionCaptureId, mirrorIndexAnswerLanding.answerToCaptureId);
  assert.match(mirrorIndexAnswerLanding.postAddStatus, /Answer captured in return draft/);
  assert.match(mirrorIndexAnswerLanding.postAddStatus, /回答已加入返回草稿/);
  assert.match(mirrorIndexAnswerLanding.postAddQuoteLabel, /Quote/);
  assert.match(mirrorIndexAnswerLanding.postAddQuoteLabel, /引文/);
  assert.match(mirrorIndexAnswerLanding.postAddThoughtLabel, /Thought/);
  assert.match(mirrorIndexAnswerLanding.postAddThoughtLabel, /想法/);
  assert.match(mirrorIndexAnswerLanding.postAddAnswerContextTitle, /Answer captured in this return draft/);
  assert.match(mirrorIndexAnswerLanding.postAddAnswerContextTitle, /回答已加入这个返回草稿/);

  await cdp.send("Page.navigate", { url: appUrl });
  await waitForCdpValue(
    cdp,
    `typeof window.learningCompanionNative?.importWorkspaceJson === "function"`,
    Boolean,
    15000
  ); // The smoke crosses file:// static mirror pages before returning to the app; Chrome can lag script readiness here.
  const mirrorAnswerReturnImport = await cdp.evaluate(`(() => {
    const answerWorkspace = ${JSON.stringify(result.answerMirrorWorkspaceJson)};
    const answerPatch = ${JSON.stringify(mirrorIndexAnswerLanding.patchJson)};
    const expectedAnswerTargetId = ${JSON.stringify(mirrorIndexAnswerLanding.answerToCaptureId)};
    const restoreResult = window.learningCompanionNative.importWorkspaceJson(answerWorkspace);
    const importResult = window.learningCompanionNative.importWorkspaceJson(answerPatch);
    const workspace = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    const activeSession = workspace.sessions.find((session) => session.id === workspace.activeSessionId) || workspace.sessions[0];
    const answerCapture = activeSession?.captures.find((capture) => capture.thought === "Answer: route verified from mirror home and ready for Mac import.") || {};
    const questionCapture = activeSession?.captures.find((capture) => capture.id === answerCapture.answersQuestionCaptureId) || {};
    const returnedWorkCard = document.querySelector(".returned-work-card");
    return {
      restoreOk: restoreResult.ok === true,
      importOk: importResult.ok === true,
      importKind: importResult.kind || "",
      importedAdded: importResult.receipt?.added || 0,
      importedAnsweredQuestions: importResult.receipt?.answeredQuestions || 0,
      answerCaptureLinked: answerCapture.answersQuestionCaptureId === expectedAnswerTargetId,
      answerTargetId: answerCapture.answersQuestionCaptureId || "",
      questionId: questionCapture.id || "",
      questionThought: questionCapture.thought || "",
      questionResolved: Boolean(questionCapture.questionResolvedAt),
      questionParked: Boolean(questionCapture.questionParkedAt),
      returnedWorkText: returnedWorkCard?.textContent || "",
      returnedWorkButtons: Array.from(returnedWorkCard?.querySelectorAll("button") || []).map((button) => button.textContent),
      closedQuestionsText: document.querySelector('[data-today-section="closed_questions"]')?.textContent || ""
    };
  })()`);
  assert.equal(mirrorAnswerReturnImport.restoreOk, true);
  assert.equal(mirrorAnswerReturnImport.importOk, true);
  assert.equal(mirrorAnswerReturnImport.importKind, "mobile-inbox-patch");
  assert.equal(mirrorAnswerReturnImport.importedAdded, 1);
  assert.equal(mirrorAnswerReturnImport.importedAnsweredQuestions, 1);
  assert.equal(mirrorAnswerReturnImport.answerCaptureLinked, true);
  assert.equal(mirrorAnswerReturnImport.answerTargetId, mirrorIndexAnswerLanding.answerToCaptureId);
  assert.equal(mirrorAnswerReturnImport.questionId, mirrorIndexAnswerLanding.answerToCaptureId);
  assert.equal(mirrorAnswerReturnImport.questionThought, "Question: How should the phone answer this mirror question?");
  assert.equal(mirrorAnswerReturnImport.questionResolved, true);
  assert.equal(mirrorAnswerReturnImport.questionParked, false);
  assert.match(mirrorAnswerReturnImport.returnedWorkText, /Returned from phone\/Windows/);
  assert.match(mirrorAnswerReturnImport.returnedWorkText, /1 new capture · 1 question resolved from phone or Windows/);
  assert.equal(mirrorAnswerReturnImport.returnedWorkButtons.includes("View closed questions"), true);
  assert.match(mirrorAnswerReturnImport.closedQuestionsText, /Closed Today/);
  const mirrorAnswerReturnRestore = await cdp.evaluate(`(() => {
    const restoreResult = window.learningCompanionNative.importWorkspaceJson(${JSON.stringify(workspaceBeforeMirrorAnswerReturnImport)});
    document.querySelector('[data-tab="today"]')?.click();
    const workspace = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    const closedQuestionCount = workspace.sessions.reduce((count, session) => (
      count + session.captures.filter((capture) => capture.questionResolvedAt).length
    ), 0);
    return {
      ok: restoreResult.ok === true,
      activeTitle: document.querySelector("#sessionTitle")?.value || "",
      closedQuestionCount
    };
  })()`);
  assert.equal(mirrorAnswerReturnRestore.ok, true);
  assert.equal(mirrorAnswerReturnRestore.activeTitle, result.restoredTitle);
  assert.equal(mirrorAnswerReturnRestore.closedQuestionCount, 0);

  const exceptionsBeforeFileMirrorClick = exceptions.length;
  const answerMirrorFileDir = join(smokeRoot, "answer mirror files", "中文");
  mkdirSync(answerMirrorFileDir, { recursive: true, mode: 0o700 });
  writeFileSync(join(answerMirrorFileDir, "index.html"), result.answerMirrorIndexHtml);
  writeFileSync(join(answerMirrorFileDir, "inbox.html"), result.answerMirrorInboxHtml);
  await cdp.send("Page.navigate", { url: pathToFileURL(join(answerMirrorFileDir, "index.html")).href });
  await sleep(300);
  const fileMirrorAnswerClick = await cdp.evaluate(`(() => {
    const link = document.querySelector('a.device-next-link[href^="inbox.html?"]') || document.querySelector('a.device-next-secondary[href^="inbox.html?"]');
    const state = {
      protocol: window.location.protocol,
      heading: document.querySelector("h1")?.textContent || "",
      label: link?.textContent || "",
      href: link?.getAttribute("href") || ""
    };
    link?.click();
    return state;
  })()`);
  await sleep(300);
  const fileMirrorAnswerLanding = await cdp.evaluate(`(() => ({
    protocol: window.location.protocol,
    pathname: window.location.pathname,
    search: window.location.search,
    answerToCaptureId: new URLSearchParams(window.location.search).get("answerToCaptureId") || "",
    status: document.querySelector("#statusOutput")?.textContent || "",
    quoteLabel: document.querySelector("#quoteLabel")?.textContent || "",
    thoughtLabel: document.querySelector("#thoughtLabel")?.textContent || "",
    quoteReadOnly: document.querySelector("#quoteInput")?.readOnly === true,
    thoughtReadOnly: document.querySelector("#thoughtInput")?.readOnly === true,
    answerContextHidden: document.querySelector("#answerContext")?.hidden,
    preview: document.querySelector("#answerQuestionPreview")?.textContent || ""
  }))()`);
  assert.equal(exceptions.length, exceptionsBeforeFileMirrorClick);
  assert.equal(fileMirrorAnswerClick.protocol, "file:");
  assert.match(fileMirrorAnswerClick.heading, /Learning Companion Mirror/);
  assert.match(fileMirrorAnswerClick.heading, /学习伴侣镜像/);
  assert.match(fileMirrorAnswerClick.label, /Answer|question/i);
  assert.match(fileMirrorAnswerClick.href, /^inbox\.html\?/);
  assert.doesNotMatch(fileMirrorAnswerClick.href, /^(?:\/|https?:|file:)/);
  assert.equal(fileMirrorAnswerLanding.protocol, "file:");
  assert.match(fileMirrorAnswerLanding.pathname, /\/inbox\.html$/);
  assert.match(fileMirrorAnswerLanding.search, /answerToCaptureId=/);
  assert.equal(fileMirrorAnswerLanding.answerToCaptureId, mirrorIndexAnswerLanding.answerToCaptureId);
  assert.match(fileMirrorAnswerLanding.status, /Answer draft loaded from mirror link/);
  assert.match(fileMirrorAnswerLanding.status, /已从镜像链接加载回答草稿/);
  assert.match(fileMirrorAnswerLanding.quoteLabel, /Question from Mac/);
  assert.match(fileMirrorAnswerLanding.quoteLabel, /来自 Mac 的问题/);
  assert.match(fileMirrorAnswerLanding.thoughtLabel, /Answer to return/);
  assert.match(fileMirrorAnswerLanding.thoughtLabel, /要带回的回答/);
  assert.equal(fileMirrorAnswerLanding.quoteReadOnly, true);
  assert.equal(fileMirrorAnswerLanding.thoughtReadOnly, false);
  assert.equal(fileMirrorAnswerLanding.answerContextHidden, false);
  assert.notEqual(fileMirrorAnswerLanding.preview, "");

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
    const initialReturnButtonsDisabled = ["copyProgressBtn", "downloadProgressBtn", "selectProgressBtn", "clearProgressBtn"].map((id) => document.querySelector("#" + id)?.disabled === true);
    const initialNextStep = document.querySelector("#returnNextStep").textContent;
    const emptyGuardButton = document.querySelector("#copyProgressBtn");
    emptyGuardButton.disabled = false;
    emptyGuardButton.click();
    const emptyGuardStatus = document.querySelector("#progressStatus").textContent;
    emptyGuardButton.disabled = true;
    document.querySelector('[data-reveal]')?.click();
    document.querySelector('[data-grade="good"]')?.click();
    const readyReturnButtonsDisabled = ["copyProgressBtn", "downloadProgressBtn", "selectProgressBtn", "clearProgressBtn"].map((id) => document.querySelector("#" + id)?.disabled === true);
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
    const savedStatus = document.querySelector("#progressStatus").textContent;
    const savedSaveCta = document.querySelector("#downloadProgressBtn").textContent;
    const savedReturnFileHint = document.querySelector("#returnFileHint").textContent;
    const savedReturnSaveMode = document.querySelector("#returnSaveMode").textContent;
    const savedReturnManualHelp = document.querySelector("#returnManualHelp").textContent;
    const savedReturnAfterPanelHidden = document.querySelector("#returnAfterSave").hidden;
    const savedReturnAfterText = document.querySelector("#returnAfterSaveText").textContent;
    const savedReturnAfterFollowup = document.querySelector("#returnAfterSaveFollowup");
    const returnPreviewTitle = document.querySelector(".return-preview-title").textContent;
    const returnCopyHint = document.querySelector(".return-copy-hint").textContent;
    const readyNextStep = document.querySelector("#returnNextStep").textContent;
    const reviewState = document.querySelector(".review-state").textContent;
    const dirtyAfterSave = beforeUnloadPrevented();
    document.querySelector("#clearProgressBtn").click();
    const clearedNextStep = document.querySelector("#returnNextStep").textContent;
    const clearedReturnButtonsDisabled = ["copyProgressBtn", "downloadProgressBtn", "selectProgressBtn", "clearProgressBtn"].map((id) => document.querySelector("#" + id)?.disabled === true);
    return {
      heading: document.querySelector("h1").textContent,
      initialReturnButtonsDisabled,
      initialNextStep,
      emptyGuardStatus,
      readyReturnButtonsDisabled,
      answerVisible: !document.querySelector(".answer").hidden,
      status: readyStatus,
      selectedStatus,
      selectedReturnJsonIncludesSchema: selectedReturnJson.includes('"schema": "learning-companion.review-progress-patch.v1"'),
      savedStatus,
      saveCta: savedSaveCta,
      returnFileHint: savedReturnFileHint,
      returnSaveMode: savedReturnSaveMode,
      returnManualHelp: savedReturnManualHelp,
      returnAfterPanelHidden: savedReturnAfterPanelHidden,
      returnAfterText: savedReturnAfterText,
      returnAfterFollowupHidden: savedReturnAfterFollowup?.hidden,
      returnAfterFollowupText: savedReturnAfterFollowup?.textContent || "",
      returnAfterFollowupHref: savedReturnAfterFollowup?.getAttribute("href") || "",
      returnPreviewTitle,
      returnCopyHint,
      returnNextStep: readyNextStep,
      clearedNextStep,
      clearedReturnButtonsDisabled,
      downloadName,
      dirtyBeforeSave,
      dirtyAfterSave,
      state: reviewState,
      previewSchema: preview.schema,
      previewEventCount: preview.events.length,
      previewGrade: preview.events[0]?.grade || "",
      hasBaseUpdatedAt: Boolean(preview.events[0]?.baseUpdatedAt),
      storageKey: Object.keys(localStorage).find((key) => key.startsWith("learning-companion.review-progress.")) || ""
    };
  })()`);

  assert.equal(exceptions.length, exceptionsBeforeReviewRuntime);
  assert.match(reviewRuntime.heading, /Learning Companion Review Pack/);
  assert.match(reviewRuntime.heading, /学习伴侣复习包/);
  assert.deepEqual(reviewRuntime.initialReturnButtonsDisabled, [true, true, true, true]);
  assert.match(reviewRuntime.initialNextStep, /No review return file yet/);
  assert.match(reviewRuntime.emptyGuardStatus, /No review return file yet/);
  assert.deepEqual(reviewRuntime.readyReturnButtonsDisabled, [false, false, false, false]);
  assert.equal(reviewRuntime.answerVisible, true);
  assert.match(reviewRuntime.status, /1 review event/);
  assert.match(reviewRuntime.selectedStatus, /Return file selected/);
  assert.equal(reviewRuntime.selectedReturnJsonIncludesSchema, true);
  assert.match(reviewRuntime.savedStatus, /Return file download requested/);
  assert.match(reviewRuntime.saveCta, /Download Return File/);
  assert.match(reviewRuntime.returnSaveMode, /Automated download fallback is enabled/);
  assert.match(reviewRuntime.returnFileHint, /Suggested JSON file: learning-companion-review-progress-patch-\d{8}-\d{4}-[a-zA-Z0-9_-]{1,8}\.json/);
  assert.match(reviewRuntime.returnManualHelp, /Locked-down browser: use Manual Copy, press Ctrl\+C or Command\+C, or long-press the selected text on phone/);
  assert.match(reviewRuntime.returnManualHelp, /paste into a text editor such as Notepad/);
  assert.equal(reviewRuntime.returnAfterPanelHidden, false);
  assert.match(reviewRuntime.returnAfterText, /Return file downloaded/);
  assert.match(reviewRuntime.returnAfterText, /Move it to Mac, then import or paste it from Today > Return Files/);
  assert.match(reviewRuntime.returnAfterText, /If a file was saved: Windows - check Downloads/);
  assert.match(reviewRuntime.returnAfterText, /HarmonyOS phone - check the Files app's Downloads folder/);
  assert.match(reviewRuntime.returnAfterText, /If no file was created: use Copy or Manual Copy/);
  assert.match(reviewRuntime.returnAfterText, /paste the return JSON into a trusted note, email, or message/);
  assert.match(reviewRuntime.returnAfterText, /import or paste it from Today > Return Files/);
  assert.match(reviewRuntime.returnAfterText, /Files app's Downloads folder/);
  assert.match(reviewRuntime.returnAfterText, /browser's default download folder/);
  assert.match(reviewRuntime.returnAfterText, /Manual carriers after you have the JSON: AirDrop, USB, file share, email/);
  assert.match(reviewRuntime.returnAfterText, /Feishu Drive; no live sync/);
  assert.match(reviewRuntime.returnAfterText, /keep reviewing here/);
  assert.equal(reviewRuntime.returnManualHelp.includes(reviewRuntime.downloadName), true);
  assert.match(reviewRuntime.returnPreviewTitle, /Return file preview/);
  assert.match(reviewRuntime.returnCopyHint, /selected text below is the return file JSON/);
  assert.match(reviewRuntime.returnNextStep, /1 review event staged in this return file/);
  assert.match(reviewRuntime.clearedNextStep, /No review return file yet/);
  assert.deepEqual(reviewRuntime.clearedReturnButtonsDisabled, [true, true, true, true]);
  assert.match(reviewRuntime.downloadName, /^learning-companion-review-progress-patch-\d{8}-\d{4}-[a-zA-Z0-9_-]{1,8}\.json$/);
  assert.equal(reviewRuntime.returnFileHint.includes(reviewRuntime.downloadName), true);
  assert.equal(reviewRuntime.dirtyBeforeSave, true);
  assert.equal(reviewRuntime.dirtyAfterSave, false);
  assert.match(reviewRuntime.state, /Marked good/);
  assert.equal(reviewRuntime.previewSchema, "learning-companion.review-progress-patch.v1");
  assert.equal(reviewRuntime.previewEventCount, 1);
  assert.equal(reviewRuntime.previewGrade, "good");
  assert.equal(reviewRuntime.hasBaseUpdatedAt, true);
  assert.match(reviewRuntime.storageKey, /^learning-companion\.review-progress\./);

  const exceptionsBeforeReviewFollowupRuntime = exceptions.length;
  virtualRoutes.set("/answer-mirror-review.html", result.answerMirrorReviewHtml);
  await cdp.send("Page.navigate", { url: `${appUrl}answer-mirror-review.html` });
  await sleep(300);
  const reviewFollowupRuntime = await cdp.evaluate(`(async () => {
    document.querySelector('[data-reveal]')?.click();
    document.querySelector('[data-grade="good"]')?.click();
    let downloadName = "";
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { downloadName = this.download; };
    try {
      document.querySelector("#downloadProgressBtn")?.click();
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
    const followup = document.querySelector("#returnAfterSaveFollowup");
    return {
      panelHidden: document.querySelector("#returnAfterSave")?.hidden,
      followupHidden: followup?.hidden,
      followupText: followup?.textContent || "",
      followupHref: followup?.getAttribute("href") || "",
      downloadName
    };
  })()`);
  assert.equal(exceptions.length, exceptionsBeforeReviewFollowupRuntime);
  assert.equal(reviewFollowupRuntime.panelHidden, false);
  assert.equal(reviewFollowupRuntime.followupHidden, false);
  assert.match(reviewFollowupRuntime.followupText, /Answer 1 open question/);
  assert.match(reviewFollowupRuntime.followupText, /open Inbox/);
  assert.match(reviewFollowupRuntime.followupHref, /^inbox\.html\?[^#]+$/);
  assert.match(reviewFollowupRuntime.followupHref, /answerToCaptureId=/);
  assert.doesNotMatch(reviewFollowupRuntime.followupHref, /workspaceFingerprint|returnBaseFingerprint|\/Users|file:/);
  assert.match(reviewFollowupRuntime.downloadName, /^learning-companion-review-progress-patch-\d{8}-\d{4}-[a-zA-Z0-9_-]{1,8}\.json$/);

  const reviewGuardDownloadNamesBefore = new Set(await settledDownloadNames(downloadPath));
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
      saveCta: document.querySelector("#downloadProgressBtn").textContent,
      returnSaveMode: document.querySelector("#returnSaveMode").textContent,
      downloadName,
      dirtyAfterBlockedSave: beforeUnloadPrevented()
    };
  })()`);
  const reviewGuardUnexpectedDownloads = (await settledDownloadNames(downloadPath))
    .filter((name) => name !== reviewFollowupRuntime.downloadName)
    .filter((name) => !reviewGuardDownloadNamesBefore.has(name))
    .filter((name) => /^learning-companion-review-progress-patch-/.test(name));
  assert.equal(reviewGuardRuntime.downloadName, "");
  assert.match(reviewGuardRuntime.status, /Save picker unavailable here/);
  assert.match(reviewGuardRuntime.saveCta, /Select Return File/);
  assert.match(reviewGuardRuntime.returnSaveMode, /No file picker detected/);
  assert.match(reviewGuardRuntime.status, /Nothing was saved to disk/);
  assert.equal(reviewGuardRuntime.dirtyAfterBlockedSave, true);
  assert.deepEqual(reviewGuardUnexpectedDownloads, []);

  const exceptionsBeforeReviewStorageGuard = exceptions.length;
  const reviewStorageFailureScript = await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: {
          getItem() { throw new Error("review progress storage blocked for smoke"); },
          setItem() { throw new Error("review progress storage blocked for smoke"); },
          removeItem() {},
          key() { return null; },
          get length() { return 0; }
        }
      });
    `
  });
  virtualRoutes.set("/mirror-review-storage-guard.html", twoDueReviewHtml);
  await cdp.send("Page.navigate", { url: `${appUrl}mirror-review-storage-guard.html` });
  await sleep(300);
  await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: reviewStorageFailureScript.identifier });
  const reviewStorageGuard = await cdp.evaluate(`(async () => {
    const rejectClipboard = () => Promise.reject(new Error("clipboard blocked for smoke"));
    try { if (window.Clipboard?.prototype) Object.defineProperty(window.Clipboard.prototype, "writeText", { configurable: true, value: rejectClipboard }); } catch {}
    try { Object.defineProperty(Navigator.prototype, "clipboard", { configurable: true, get() { return { writeText: rejectClipboard }; } }); } catch {}
    try { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: rejectClipboard } }); } catch {}
    const initialStatus = document.querySelector("#progressStatus").textContent;
    const cards = Array.from(document.querySelectorAll(".card")).slice(0, 2);
    cards.forEach((card) => {
      card.querySelector('[data-reveal]')?.click();
      card.querySelector('[data-grade="good"]')?.click();
    });
    const postGradeStatus = document.querySelector("#progressStatus").textContent;
    const preview = JSON.parse(document.querySelector("#progressPreview").textContent);
    document.querySelector("#copyProgressBtn").click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const copyFallbackStatus = document.querySelector("#progressStatus").textContent;
    const copySelectionText = window.getSelection()?.toString() || "";
    window.__LC_ALLOW_AUTOMATED_DOWNLOADS__ = false;
    Object.defineProperty(window, "showSaveFilePicker", { value: undefined, configurable: true });
    document.querySelector("#downloadProgressBtn").click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const saveFallbackStatus = document.querySelector("#progressStatus").textContent;
    const saveSelectionText = window.getSelection()?.toString() || "";
    return {
      heading: document.querySelector("h1").textContent,
      initialStatus,
      postGradeStatus,
      copyFallbackStatus,
      saveFallbackStatus,
      saveCta: document.querySelector("#downloadProgressBtn").textContent,
      returnSaveMode: document.querySelector("#returnSaveMode").textContent,
      copySelectionHasSchema: copySelectionText.includes("learning-companion.review-progress-patch.v1"),
      saveSelectionHasSchema: saveSelectionText.includes("learning-companion.review-progress-patch.v1"),
      gradeableCards: cards.length,
      previewSchema: preview.schema,
      previewEventCount: preview.events.length,
      previewGrades: preview.events.map((event) => event.grade),
      reviewStates: Array.from(document.querySelectorAll(".review-state")).map((node) => node.textContent).filter(Boolean),
      returnNextStep: document.querySelector("#returnNextStep").textContent,
      returnManualHelp: document.querySelector("#returnManualHelp").textContent
    };
  })()`);
  assert.equal(exceptions.length, exceptionsBeforeReviewStorageGuard);
  assert.match(reviewStorageGuard.heading, /Learning Companion Review Pack/);
  assert.match(reviewStorageGuard.heading, /学习伴侣复习包/);
  assert.match(reviewStorageGuard.initialStatus, /Browser storage is unavailable/);
  assert.match(reviewStorageGuard.postGradeStatus, /Browser storage is unavailable/);
  assert.match(reviewStorageGuard.postGradeStatus, /Copy, Manual Copy, or the available save action/);
  assert.match(reviewStorageGuard.copyFallbackStatus, /Copy failed/);
  assert.match(reviewStorageGuard.copyFallbackStatus, /copy it manually/);
  assert.match(reviewStorageGuard.saveFallbackStatus, /Save picker unavailable here/);
  assert.match(reviewStorageGuard.saveFallbackStatus, /manual copy/);
  assert.match(reviewStorageGuard.saveFallbackStatus, /Nothing was saved to disk/);
  assert.match(reviewStorageGuard.saveCta, /Select Return File/);
  assert.match(reviewStorageGuard.returnSaveMode, /No file picker detected/);
  assert.equal(reviewStorageGuard.copySelectionHasSchema, true);
  assert.equal(reviewStorageGuard.saveSelectionHasSchema, true);
  assert.equal(reviewStorageGuard.gradeableCards, 2);
  assert.equal(reviewStorageGuard.previewSchema, "learning-companion.review-progress-patch.v1");
  assert.equal(reviewStorageGuard.previewEventCount, 2);
  assert.deepEqual(reviewStorageGuard.previewGrades, ["good", "good"]);
  assert.equal(reviewStorageGuard.reviewStates.slice(0, 2).every((state) => /Marked good/.test(state)), true);
  assert.match(reviewStorageGuard.returnNextStep, /2 review events staged in this return file/);
  assert.match(reviewStorageGuard.returnManualHelp, /Manual Copy/);

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 320,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(120);
  virtualRoutes.set("/mirror-index-mobile.html", result.mirrorIndexHtml);
  await cdp.send("Page.navigate", { url: `${appUrl}mirror-index-mobile.html` });
  await sleep(300);
  const staticIndexMobile = await cdp.evaluate(`(() => {
    const nextPanel = document.querySelector(".device-next-panel");
    const entryNav = document.querySelector(".actions");
    const entryLinks = Array.from(document.querySelectorAll(".actions .action"));
    return {
      innerWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      nextBeforeEntries: Boolean(nextPanel && entryNav) && nextPanel.compareDocumentPosition(entryNav) === Node.DOCUMENT_POSITION_FOLLOWING,
      nextPanelWidth: Math.ceil(nextPanel?.getBoundingClientRect().width || 0),
      entryNavWidth: Math.ceil(entryNav?.getBoundingClientRect().width || 0),
      entryLinkWidths: entryLinks.map((link) => Math.ceil(link.getBoundingClientRect().width)),
      entryTexts: entryLinks.map((link) => link.querySelector("strong")?.textContent || ""),
      nextLabel: nextPanel?.querySelector(".device-next-link strong")?.textContent || ""
    };
  })()`);
  await cdp.send("Page.navigate", { url: `${appUrl}mirror-source-mobile.html` });
  await sleep(300);
  const staticSourceIndexMobile = await cdp.evaluate(`(() => {
    const nextPanel = document.querySelector(".device-next-panel");
    const primary = nextPanel?.querySelector(".device-next-link");
    const primaryStrong = primary?.querySelector("strong");
    const primarySpan = primary?.querySelector("span");
    const primarySmall = primary?.querySelector("small");
    const secondary = nextPanel?.querySelector(".device-next-secondary");
    return {
      innerWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      nextPanelWidth: Math.ceil(nextPanel?.getBoundingClientRect().width || 0),
      primaryText: primaryStrong?.textContent || "",
      primaryMeta: primarySmall?.textContent || "",
      primaryHref: primary?.getAttribute("href") || "",
      primaryTarget: primary?.getAttribute("target") || "",
      primaryRel: primary?.getAttribute("rel") || "",
      primaryScrollWidth: primary?.scrollWidth || 0,
      primaryClientWidth: primary?.clientWidth || 0,
      primaryLabelScrollWidth: primaryStrong?.scrollWidth || 0,
      primaryLabelClientWidth: primaryStrong?.clientWidth || 0,
      primaryDetailScrollWidth: primarySpan?.scrollWidth || 0,
      primaryDetailClientWidth: primarySpan?.clientWidth || 0,
      primaryHeight: Math.ceil(primary?.getBoundingClientRect().height || 0),
      secondaryText: secondary?.textContent || "",
      secondaryHref: secondary?.getAttribute("href") || "",
      secondaryScrollWidth: secondary?.scrollWidth || 0,
      secondaryClientWidth: secondary?.clientWidth || 0,
      secondaryHeight: Math.ceil(secondary?.getBoundingClientRect().height || 0)
    };
  })()`);
  await resetStaticReturnState(cdp, "learning-companion.inbox.");
  await cdp.send("Page.navigate", { url: `${appUrl}mirror-source-inbox-mobile.html` });
  await sleep(300);
  const staticSourceInboxMobile = await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const field = document.querySelector(selector);
      if (!field) return;
      field.value = value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const hint = document.querySelector("#topicSourceHint");
    const formPanel = document.querySelector('[aria-label="New mobile capture"]');
    const sourceTitleBefore = document.querySelector("#sourceTitleInput")?.value || "";
    const sourceUrlBefore = document.querySelector("#sourceUrlInput")?.value || "";
    const initialHintText = hint?.textContent || "";
    const topicAriaDescribedby = document.querySelector("#topicSelect")?.getAttribute("aria-describedby") || "";
    setValue("#sourceTitleInput", "Override source title");
    const overrideHintText = hint?.textContent || "";
    setValue("#sourceTitleInput", "");
    const restoredHintText = hint?.textContent || "";
    setValue("#quoteInput", "Source-only phone quote");
    setValue("#thoughtInput", "Capture after reading the source.");
    document.querySelector("#addCaptureBtn")?.click();
    const patch = JSON.parse(document.querySelector("#patchPreview")?.textContent || "{}");
    const capture = patch.captures?.[0] || {};
    return {
      innerWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      formPanelWidth: Math.ceil(formPanel?.getBoundingClientRect().width || 0),
      hintText: restoredHintText,
      initialHintText,
      overrideHintText,
      topicAriaDescribedby,
      hintScrollWidth: hint?.scrollWidth || 0,
      hintClientWidth: hint?.clientWidth || 0,
      sourceTitleBefore,
      sourceUrlBefore,
      previewSchema: patch.schema || "",
      previewCaptureCount: patch.captures?.length || 0,
      previewCaptureSourceTitle: capture.sourceTitle || "",
      previewCaptureSourceUrl: capture.sourceUrl || ""
    };
  })()`);
  await resetStaticReturnState(cdp, "learning-companion.review-progress.");
  virtualRoutes.set("/mirror-review-mobile.html", result.mirrorReviewHtml);
  await cdp.send("Page.navigate", { url: `${appUrl}mirror-review-mobile.html` });
  await sleep(300);
  const staticReviewMobile = await cdp.evaluate(`(() => {
    const panel = document.querySelector(".progress-panel");
    const actionButtons = Array.from(document.querySelectorAll(".progress-actions button"));
    const gradeButtons = Array.from(document.querySelectorAll(".grade-actions button"));
    document.querySelector('[data-reveal]')?.click();
    return {
      innerWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      panelWidth: Math.ceil(panel.getBoundingClientRect().width),
      actionContainerWidth: Math.ceil(document.querySelector(".progress-actions").getBoundingClientRect().width),
      gradeContainerWidth: Math.ceil(document.querySelector(".grade-actions").getBoundingClientRect().width),
      returnPreviewTitle: document.querySelector(".return-preview-title").textContent,
      returnSaveMode: document.querySelector("#returnSaveMode").textContent,
      returnCopyHint: document.querySelector(".return-copy-hint").textContent,
      actionButtons: actionButtons.map((button) => ({
        text: button.textContent,
        disabled: button.disabled,
        width: Math.ceil(button.getBoundingClientRect().width),
        height: Math.ceil(button.getBoundingClientRect().height)
      })),
      gradeButtons: gradeButtons.map((button) => ({
        text: button.textContent,
        width: Math.ceil(button.getBoundingClientRect().width),
        height: Math.ceil(button.getBoundingClientRect().height)
      }))
    };
  })()`);
  await resetStaticReturnState(cdp, "learning-companion.inbox.");
  virtualRoutes.set("/mirror-inbox-mobile.html", result.mirrorInboxHtml);
  await cdp.send("Page.navigate", { url: `${appUrl}mirror-inbox-mobile.html` });
  await sleep(300);
  const staticInboxMobile = await cdp.evaluate(`(() => {
    const panels = Array.from(document.querySelectorAll(".panel"));
    const actionButtons = Array.from(document.querySelectorAll(".actions button"));
    return {
      innerWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      maxPanelWidth: Math.max(...panels.map((panel) => Math.ceil(panel.getBoundingClientRect().width))),
      maxActionContainerWidth: Math.max(...Array.from(document.querySelectorAll(".actions")).map((actions) => Math.ceil(actions.getBoundingClientRect().width))),
      sourceRowColumns: getComputedStyle(document.querySelector(".row")).gridTemplateColumns.split(" ").filter(Boolean).length,
      returnPreviewTitle: document.querySelector(".return-preview-title").textContent,
      returnSaveMode: document.querySelector("#returnSaveMode").textContent,
      returnCopyHint: document.querySelector(".return-copy-hint").textContent,
      actionButtons: actionButtons.map((button) => ({
        text: button.textContent,
        disabled: button.disabled,
        width: Math.ceil(button.getBoundingClientRect().width),
        height: Math.ceil(button.getBoundingClientRect().height)
      }))
    };
  })()`);
  await cdp.send("Emulation.clearDeviceMetricsOverride");
  await sleep(120);
  assert.ok(staticIndexMobile.documentWidth <= staticIndexMobile.innerWidth + 1);
  assert.equal(staticIndexMobile.nextBeforeEntries, true);
  assert.match(staticIndexMobile.nextLabel, /Review due cards|Answer next question|Capture on this device/);
  assert.ok(staticIndexMobile.nextPanelWidth <= staticIndexMobile.innerWidth - 24);
  assert.ok(staticIndexMobile.entryNavWidth <= staticIndexMobile.innerWidth - 24);
  assert.equal(staticIndexMobile.entryTexts.length, 4);
  assert.match(staticIndexMobile.entryTexts[0], /Today/);
  assert.match(staticIndexMobile.entryTexts[1], /Review/);
  assert.match(staticIndexMobile.entryTexts[2], /Inbox/);
  assert.match(staticIndexMobile.entryTexts[3], /Restore/);
  staticIndexMobile.entryLinkWidths.forEach((width) => {
    assert.ok(width >= staticIndexMobile.entryNavWidth - 2);
  });
  assert.ok(staticSourceIndexMobile.documentWidth <= staticSourceIndexMobile.innerWidth + 1);
  assert.ok(staticSourceIndexMobile.nextPanelWidth <= staticSourceIndexMobile.innerWidth - 24);
  assert.match(staticSourceIndexMobile.primaryText, /Read source on this device/);
  assert.match(staticSourceIndexMobile.primaryMeta, /come back to this mirror tab for return JSON/);
  assert.equal(staticSourceIndexMobile.primaryHref, "https://example.com/phone-source-reading");
  assert.equal(staticSourceIndexMobile.primaryTarget, "_blank");
  assert.match(staticSourceIndexMobile.primaryRel, /noreferrer/);
  assert.match(staticSourceIndexMobile.primaryRel, /noopener/);
  assert.ok(staticSourceIndexMobile.primaryScrollWidth <= staticSourceIndexMobile.primaryClientWidth + 2);
  assert.ok(staticSourceIndexMobile.primaryLabelScrollWidth <= staticSourceIndexMobile.primaryLabelClientWidth + 2);
  assert.ok(staticSourceIndexMobile.primaryDetailScrollWidth <= staticSourceIndexMobile.primaryDetailClientWidth + 2);
  assert.ok(staticSourceIndexMobile.primaryHeight >= 36);
  assert.match(staticSourceIndexMobile.secondaryText, /Then capture in Inbox/);
  assert.equal(staticSourceIndexMobile.secondaryHref, "inbox.html");
  assert.ok(staticSourceIndexMobile.secondaryScrollWidth <= staticSourceIndexMobile.secondaryClientWidth + 2);
  assert.ok(staticSourceIndexMobile.secondaryHeight >= 32);
  assert.ok(staticSourceInboxMobile.documentWidth <= staticSourceInboxMobile.innerWidth + 1);
  assert.ok(staticSourceInboxMobile.formPanelWidth <= staticSourceInboxMobile.innerWidth - 24);
  assert.equal(staticSourceInboxMobile.topicAriaDescribedby, "topicSourceHint");
  assert.match(staticSourceInboxMobile.initialHintText, /Source: Phone source reading target/);
  assert.match(staticSourceInboxMobile.initialHintText, /used for new captures unless you fill Source or URL below/);
  assert.match(staticSourceInboxMobile.overrideHintText, /Using the Source or URL you entered for this capture/);
  assert.equal(staticSourceInboxMobile.hintText, staticSourceInboxMobile.initialHintText);
  assert.ok(staticSourceInboxMobile.hintScrollWidth <= staticSourceInboxMobile.hintClientWidth + 2);
  assert.equal(staticSourceInboxMobile.sourceTitleBefore, "");
  assert.equal(staticSourceInboxMobile.sourceUrlBefore, "");
  assert.equal(staticSourceInboxMobile.previewSchema, "learning-companion.mobile-inbox-patch.v1");
  assert.equal(staticSourceInboxMobile.previewCaptureCount, 1);
  assert.equal(staticSourceInboxMobile.previewCaptureSourceTitle, "Phone source reading target");
  assert.equal(staticSourceInboxMobile.previewCaptureSourceUrl, "https://example.com/phone-source-reading");
  assert.ok(staticReviewMobile.documentWidth <= staticReviewMobile.innerWidth + 1);
  assert.ok(staticReviewMobile.panelWidth <= staticReviewMobile.innerWidth - 24);
  assert.match(staticReviewMobile.returnPreviewTitle, /Return file preview/);
  assert.match(staticReviewMobile.returnSaveMode, /Automated download fallback is enabled/);
  assert.match(staticReviewMobile.returnCopyHint, /selected text below is the return file JSON/);
  ["Copy Return File", "Download Return File", "Manual Copy", "Clear Progress"].forEach((label, index) => {
    assert.match(staticReviewMobile.actionButtons[index]?.text || "", new RegExp(label));
  });
  assert.deepEqual(staticReviewMobile.actionButtons.map((button) => button.disabled), [true, true, true, true]);
  staticReviewMobile.actionButtons.forEach((button) => {
    assert.ok(button.width >= staticReviewMobile.actionContainerWidth - 2);
    assert.ok(button.height >= 36);
  });
  ["Again", "Good"].forEach((label, index) => {
    assert.match(staticReviewMobile.gradeButtons[index]?.text || "", new RegExp(label));
  });
  staticReviewMobile.gradeButtons.forEach((button) => {
    assert.ok(button.width >= staticReviewMobile.gradeContainerWidth - 2);
    assert.ok(button.height >= 36);
  });
  assert.ok(staticInboxMobile.documentWidth <= staticInboxMobile.innerWidth + 1);
  assert.ok(staticInboxMobile.maxPanelWidth <= staticInboxMobile.innerWidth - 24);
  assert.equal(staticInboxMobile.sourceRowColumns, 1);
  assert.match(staticInboxMobile.returnPreviewTitle, /Return file preview/);
  assert.match(staticInboxMobile.returnSaveMode, /Automated download fallback is enabled/);
  assert.match(staticInboxMobile.returnCopyHint, /selected text below is the return file JSON/);
  ["Add Capture", "Clear Form", "Copy Return File", "Download Return File", "Manual Copy", "Clear Drafts"].forEach((label, index) => {
    assert.match(staticInboxMobile.actionButtons[index]?.text || "", new RegExp(label));
  });
  assert.deepEqual(staticInboxMobile.actionButtons.map((button) => button.disabled), [false, false, true, true, true, true]);
  staticInboxMobile.actionButtons.forEach((button) => {
    assert.ok(button.width >= staticInboxMobile.maxActionContainerWidth - 2);
    assert.ok(button.height >= 38);
  });

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
    const initialReturnButtonsDisabled = ["copyPatchBtn", "downloadPatchBtn", "selectPatchBtn", "clearDraftsBtn"].map((id) => document.querySelector("#" + id)?.disabled === true);
    const initialNextStep = document.querySelector("#returnNextStep").textContent;
    const emptyGuardButton = document.querySelector("#copyPatchBtn");
    emptyGuardButton.disabled = false;
    emptyGuardButton.click();
    const emptyGuardStatus = document.querySelector("#statusOutput").textContent;
    emptyGuardButton.disabled = true;
    setValue("#quoteInput", "Static inbox quote from phone.");
    setValue("#thoughtInput", "This should become an append-only patch.");
    setValue("#timestampInput", "10:15");
    setValue("#tagsInput", "phone, mirror");
    setValue("#sourceTitleInput", "HarmonyOS browser");
    setValue("#sourceUrlInput", "javascript:alert(1)");
    document.querySelector("#addCaptureBtn").click();
    const readyReturnButtonsDisabled = ["copyPatchBtn", "downloadPatchBtn", "selectPatchBtn", "clearDraftsBtn"].map((id) => document.querySelector("#" + id)?.disabled === true);
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
    const savedStatus = document.querySelector("#statusOutput").textContent;
    const savedSaveCta = document.querySelector("#downloadPatchBtn").textContent;
    const savedReturnFileHint = document.querySelector("#returnFileHint").textContent;
    const savedReturnSaveMode = document.querySelector("#returnSaveMode").textContent;
    const savedReturnManualHelp = document.querySelector("#returnManualHelp").textContent;
    const savedReturnAfterPanelHidden = document.querySelector("#returnAfterSave").hidden;
    const savedReturnAfterText = document.querySelector("#returnAfterSaveText").textContent;
    const savedReturnAfterFollowup = document.querySelector("#returnAfterSaveFollowup");
    const returnPreviewTitle = document.querySelector(".return-preview-title").textContent;
    const returnCopyHint = document.querySelector(".return-copy-hint").textContent;
    const readyNextStep = document.querySelector("#returnNextStep").textContent;
    const readyDraftCount = document.querySelectorAll("#draftList .capture").length;
    const dirtyAfterSave = beforeUnloadPrevented();
    document.querySelector("#clearDraftsBtn").click();
    const clearedNextStep = document.querySelector("#returnNextStep").textContent;
    const clearedDraftCount = document.querySelectorAll("#draftList .capture").length;
    const clearedReturnButtonsDisabled = ["copyPatchBtn", "downloadPatchBtn", "selectPatchBtn", "clearDraftsBtn"].map((id) => document.querySelector("#" + id)?.disabled === true);
    return {
      heading: document.querySelector("h1").textContent,
      initialReturnButtonsDisabled,
      initialNextStep,
      emptyGuardStatus,
      readyReturnButtonsDisabled,
      topicOptions: document.querySelectorAll("#topicSelect option").length,
      selectedTopicId: document.querySelector("#topicSelect").value,
      selectedTopicTitle: document.querySelector("#topicSelect option:checked")?.textContent || "",
      quoteLabel: document.querySelector("#quoteLabel").textContent,
      thoughtLabel: document.querySelector("#thoughtLabel").textContent,
      quotePlaceholder: document.querySelector("#quoteInput").placeholder,
      thoughtPlaceholder: document.querySelector("#thoughtInput").placeholder,
      quoteReadOnly: document.querySelector("#quoteInput").readOnly,
      status: readyStatus,
      selectedStatus,
      selectedReturnJsonIncludesSchema: selectedReturnJson.includes('"schema": "learning-companion.mobile-inbox-patch.v1"'),
      draftCount: readyDraftCount,
      previewSchema: preview.schema,
      previewTargetTitle: preview.target.topicTitle,
      previewCaptureCount: preview.captures.length,
      previewQuote: preview.captures[0]?.quote || "",
      previewThought: preview.captures[0]?.thought || "",
      previewSourceUrl: preview.captures[0]?.sourceUrl || "",
      storedDraftCount: storedDrafts.length,
      savedStatus,
      saveCta: savedSaveCta,
      returnFileHint: savedReturnFileHint,
      returnSaveMode: savedReturnSaveMode,
      returnManualHelp: savedReturnManualHelp,
      returnAfterPanelHidden: savedReturnAfterPanelHidden,
      returnAfterText: savedReturnAfterText,
      returnAfterFollowupHidden: savedReturnAfterFollowup?.hidden,
      returnAfterFollowupText: savedReturnAfterFollowup?.textContent || "",
      returnAfterFollowupHref: savedReturnAfterFollowup?.getAttribute("href") || "",
      returnPreviewTitle,
      returnCopyHint,
      returnNextStep: readyNextStep,
      clearedNextStep,
      clearedDraftCount,
      clearedReturnButtonsDisabled,
      downloadName,
      dirtyBeforeSave,
      dirtyAfterSave
    };
  })()`);

  assert.equal(exceptions.length, exceptionsBeforeInboxRuntime);
  assert.match(inboxRuntime.heading, /Learning Companion Inbox/);
  assert.match(inboxRuntime.heading, /学习伴侣收件箱/);
  assert.deepEqual(inboxRuntime.initialReturnButtonsDisabled, [true, true, true, true]);
  assert.match(inboxRuntime.initialNextStep, /No draft captures for this topic yet/);
  assert.match(inboxRuntime.emptyGuardStatus, /No draft captures for this topic yet/);
  assert.deepEqual(inboxRuntime.readyReturnButtonsDisabled, [false, false, false, false]);
  assert.ok(inboxRuntime.topicOptions >= 1);
  assert.notEqual(inboxRuntime.selectedTopicId, "");
  assert.match(inboxRuntime.quoteLabel, /Quote/);
  assert.match(inboxRuntime.thoughtLabel, /Thought/);
  assert.match(inboxRuntime.quotePlaceholder, /Paste a quote or transcript line/);
  assert.match(inboxRuntime.thoughtPlaceholder, /Your thought, question, or takeaway/);
  assert.equal(inboxRuntime.quoteReadOnly, false);
  assert.match(inboxRuntime.status, /Capture added to return draft/);
  assert.match(inboxRuntime.selectedStatus, /Return file selected/);
  assert.equal(inboxRuntime.selectedReturnJsonIncludesSchema, true);
  assert.match(inboxRuntime.savedStatus, /Return file download requested/);
  assert.match(inboxRuntime.saveCta, /Download Return File/);
  assert.match(inboxRuntime.returnSaveMode, /Automated download fallback is enabled/);
  assert.match(inboxRuntime.returnFileHint, /Suggested JSON file: learning-companion-inbox-patch-\d{8}-\d{4}-[a-zA-Z0-9_-]{1,8}\.json/);
  assert.match(inboxRuntime.returnManualHelp, /Locked-down browser: use Manual Copy, press Ctrl\+C or Command\+C, or long-press the selected text on phone/);
  assert.match(inboxRuntime.returnManualHelp, /paste into a text editor such as Notepad/);
  assert.equal(inboxRuntime.returnAfterPanelHidden, false);
  assert.match(inboxRuntime.returnAfterText, /Return file downloaded/);
  assert.match(inboxRuntime.returnAfterText, /Move it to Mac, then import or paste it from Today > Return Files/);
  assert.match(inboxRuntime.returnAfterText, /If a file was saved: Windows - check Downloads/);
  assert.match(inboxRuntime.returnAfterText, /HarmonyOS phone - check the Files app's Downloads folder/);
  assert.match(inboxRuntime.returnAfterText, /If no file was created: use Copy or Manual Copy/);
  assert.match(inboxRuntime.returnAfterText, /paste the return JSON into a trusted note, email, or message/);
  assert.match(inboxRuntime.returnAfterText, /import or paste it from Today > Return Files/);
  assert.match(inboxRuntime.returnAfterText, /Files app's Downloads folder/);
  assert.match(inboxRuntime.returnAfterText, /browser's default download folder/);
  assert.match(inboxRuntime.returnAfterText, /Manual carriers after you have the JSON: AirDrop, USB, file share, email/);
  assert.match(inboxRuntime.returnAfterText, /Feishu Drive; no live sync/);
  assert.match(inboxRuntime.returnAfterText, /keep capturing here/);
  assert.equal(inboxRuntime.returnAfterFollowupHidden, false);
  assert.match(inboxRuntime.returnAfterFollowupText, /Review \d+ due card/);
  assert.match(inboxRuntime.returnAfterFollowupText, /open Review/);
  assert.equal(inboxRuntime.returnAfterFollowupHref, "review.html");
  assert.equal(inboxRuntime.returnManualHelp.includes(inboxRuntime.downloadName), true);
  assert.match(inboxRuntime.returnPreviewTitle, /Return file preview/);
  assert.match(inboxRuntime.returnCopyHint, /selected text below is the return file JSON/);
  assert.match(inboxRuntime.returnNextStep, /1 draft capture staged in this return file/);
  assert.match(inboxRuntime.clearedNextStep, /No draft captures for this topic yet/);
  assert.equal(inboxRuntime.clearedDraftCount, 0);
  assert.deepEqual(inboxRuntime.clearedReturnButtonsDisabled, [true, true, true, true]);
  assert.match(inboxRuntime.downloadName, /^learning-companion-inbox-patch-\d{8}-\d{4}-[a-zA-Z0-9_-]{1,8}\.json$/);
  assert.equal(inboxRuntime.returnFileHint.includes(inboxRuntime.downloadName), true);
  assert.equal(inboxRuntime.dirtyBeforeSave, true);
  assert.equal(inboxRuntime.dirtyAfterSave, false);
  assert.equal(inboxRuntime.draftCount, 1);
  assert.equal(inboxRuntime.previewSchema, "learning-companion.mobile-inbox-patch.v1");
  assert.equal(inboxRuntime.previewCaptureCount, 1);
  assert.equal(inboxRuntime.previewQuote, "Static inbox quote from phone.");
  assert.equal(inboxRuntime.previewThought, "This should become an append-only patch.");
  assert.equal(inboxRuntime.previewSourceUrl, "");
  assert.equal(inboxRuntime.storedDraftCount, 1);

  const exceptionsBeforeInboxStorageGuard = exceptions.length;
  const storageFailureScript = await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: {
          getItem() { throw new Error("localStorage blocked for smoke"); },
          setItem() { throw new Error("localStorage blocked for smoke"); },
          removeItem() {},
          key() { return null; },
          get length() { return 0; }
        }
      });
    `
  });
  virtualRoutes.set("/mirror-inbox-storage-guard.html", result.mirrorInboxHtml);
  await cdp.send("Page.navigate", { url: `${appUrl}mirror-inbox-storage-guard.html` });
  await sleep(300);
  await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: storageFailureScript.identifier });
  const inboxStorageGuard = await cdp.evaluate(`(async () => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const rejectClipboard = () => Promise.reject(new Error("clipboard blocked for smoke"));
    try { if (window.Clipboard?.prototype) Object.defineProperty(window.Clipboard.prototype, "writeText", { configurable: true, value: rejectClipboard }); } catch {}
    try { Object.defineProperty(Navigator.prototype, "clipboard", { configurable: true, get() { return { writeText: rejectClipboard }; } }); } catch {}
    try { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: rejectClipboard } }); } catch {}
    const initialStatus = document.querySelector("#statusOutput").textContent;
    setValue("#quoteInput", "Storage blocked quote from phone.");
    setValue("#thoughtInput", "This still needs a return file.");
    document.querySelector("#addCaptureBtn").click();
    const postAddStatus = document.querySelector("#statusOutput").textContent;
    const preview = JSON.parse(document.querySelector("#patchPreview").textContent);
    document.querySelector("#copyPatchBtn").click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const copyFallbackStatus = document.querySelector("#statusOutput").textContent;
    const copySelectionText = window.getSelection()?.toString() || "";
    window.__LC_ALLOW_AUTOMATED_DOWNLOADS__ = false;
    Object.defineProperty(window, "showSaveFilePicker", { value: undefined, configurable: true });
    document.querySelector("#downloadPatchBtn").click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const saveFallbackStatus = document.querySelector("#statusOutput").textContent;
    const saveSelectionText = window.getSelection()?.toString() || "";
    return {
      heading: document.querySelector("h1").textContent,
      initialStatus,
      postAddStatus,
      copyFallbackStatus,
      saveFallbackStatus,
      saveCta: document.querySelector("#downloadPatchBtn").textContent,
      returnSaveMode: document.querySelector("#returnSaveMode").textContent,
      copySelectionHasSchema: copySelectionText.includes("learning-companion.mobile-inbox-patch.v1"),
      saveSelectionHasSchema: saveSelectionText.includes("learning-companion.mobile-inbox-patch.v1"),
      previewSchema: preview.schema,
      previewCaptureCount: preview.captures.length,
      previewQuote: preview.captures[0]?.quote || "",
      previewThought: preview.captures[0]?.thought || "",
      draftCount: document.querySelectorAll("#draftList .capture").length,
      returnNextStep: document.querySelector("#returnNextStep").textContent,
      returnManualHelp: document.querySelector("#returnManualHelp").textContent
    };
  })()`);
  assert.equal(exceptions.length, exceptionsBeforeInboxStorageGuard);
  assert.match(inboxStorageGuard.heading, /Learning Companion Inbox/);
  assert.match(inboxStorageGuard.heading, /学习伴侣收件箱/);
  assert.match(inboxStorageGuard.initialStatus, /Browser storage is unavailable/);
  assert.match(inboxStorageGuard.postAddStatus, /Browser storage is unavailable/);
  assert.match(inboxStorageGuard.postAddStatus, /Copy, Manual Copy, or the available save action/);
  assert.match(inboxStorageGuard.copyFallbackStatus, /Copy failed/);
  assert.match(inboxStorageGuard.copyFallbackStatus, /copy it manually/);
  assert.match(inboxStorageGuard.saveFallbackStatus, /Save picker unavailable here/);
  assert.match(inboxStorageGuard.saveFallbackStatus, /manual copy/);
  assert.match(inboxStorageGuard.saveCta, /Select Return File/);
  assert.match(inboxStorageGuard.returnSaveMode, /No file picker detected/);
  assert.match(inboxStorageGuard.saveFallbackStatus, /Nothing was saved to disk/);
  assert.equal(inboxStorageGuard.copySelectionHasSchema, true);
  assert.equal(inboxStorageGuard.saveSelectionHasSchema, true);
  assert.equal(inboxStorageGuard.previewSchema, "learning-companion.mobile-inbox-patch.v1");
  assert.equal(inboxStorageGuard.previewCaptureCount, 1);
  assert.equal(inboxStorageGuard.previewQuote, "Storage blocked quote from phone.");
  assert.equal(inboxStorageGuard.previewThought, "This still needs a return file.");
  assert.equal(inboxStorageGuard.draftCount, 1);
  assert.match(inboxStorageGuard.returnNextStep, /1 draft capture staged in this return file/);
  assert.match(inboxStorageGuard.returnManualHelp, /Manual Copy/);

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
    sourceUrl: document.querySelector("#sourceUrlInput").value,
    quoteLabel: document.querySelector("#quoteLabel").textContent,
    thoughtLabel: document.querySelector("#thoughtLabel").textContent,
    quotePlaceholder: document.querySelector("#quoteInput").placeholder,
    thoughtPlaceholder: document.querySelector("#thoughtInput").placeholder,
    quoteReadOnly: document.querySelector("#quoteInput").readOnly,
    quoteAriaReadonly: document.querySelector("#quoteInput").getAttribute("aria-readonly"),
    answerContextHidden: document.querySelector("#answerContext").hidden,
    answerContextTitle: document.querySelector("#answerContextTitle").textContent,
    answerQuestionPreview: document.querySelector("#answerQuestionPreview").textContent,
    answerContextText: document.querySelector("#answerContextText").textContent
  }))()`);

  assert.match(inboxAnswerRuntime.status, /Answer draft loaded from mirror link/);
  assert.equal(inboxAnswerRuntime.selectedTopicId, inboxRuntime.selectedTopicId);
  assert.equal(inboxAnswerRuntime.selectedTopicTitle, inboxRuntime.selectedTopicTitle);
  assert.equal(inboxAnswerRuntime.quote, "What should I answer from the mirror?");
  assert.equal(inboxAnswerRuntime.thought, "Answer:");
  assert.equal(inboxAnswerRuntime.timestamp, "12:34");
  assert.equal(inboxAnswerRuntime.tags, "question, answer");
  assert.equal(inboxAnswerRuntime.sourceTitle, "Mirror question preview");
  assert.equal(inboxAnswerRuntime.sourceUrl, "");
  assert.match(inboxAnswerRuntime.quoteLabel, /Question from Mac/);
  assert.match(inboxAnswerRuntime.thoughtLabel, /Answer to return/);
  assert.match(inboxAnswerRuntime.quotePlaceholder, /Question carried from the Mac mirror/);
  assert.match(inboxAnswerRuntime.thoughtPlaceholder, /Write the answer to bring back to Mac/);
  assert.equal(inboxAnswerRuntime.quoteReadOnly, true);
  assert.equal(inboxAnswerRuntime.quoteAriaReadonly, "true");
  assert.equal(inboxAnswerRuntime.answerContextHidden, false);
  assert.match(inboxAnswerRuntime.answerContextTitle, /You're answering a question from this mirror/);
  assert.equal(inboxAnswerRuntime.answerQuestionPreview, "What should I answer from the mirror?");
  assert.match(inboxAnswerRuntime.answerContextText, /Your answer will be saved to a return file you move back to Mac/);
  const inboxAnswerPatchRuntime = await cdp.evaluate(`(() => {
    document.querySelector("#addCaptureBtn").click();
    const preview = JSON.parse(document.querySelector("#patchPreview").textContent);
    const capture = preview.captures.find((item) => item.quote === "What should I answer from the mirror?");
    return {
      status: document.querySelector("#statusOutput").textContent,
      previewSchema: preview.schema,
      answersQuestionCaptureId: capture?.answersQuestionCaptureId || "",
      quoteLabel: document.querySelector("#quoteLabel").textContent,
      thoughtLabel: document.querySelector("#thoughtLabel").textContent,
      quoteReadOnly: document.querySelector("#quoteInput").readOnly,
      quoteAriaReadonly: document.querySelector("#quoteInput").getAttribute("aria-readonly"),
      copyCta: document.querySelector("#copyPatchBtn").textContent,
      saveCta: document.querySelector("#downloadPatchBtn").textContent,
      answerContextHidden: document.querySelector("#answerContext").hidden,
      answerContextTitle: document.querySelector("#answerContextTitle").textContent,
      answerQuestionPreview: document.querySelector("#answerQuestionPreview").textContent,
      answerContextText: document.querySelector("#answerContextText").textContent
    };
  })()`);
  assert.match(inboxAnswerPatchRuntime.status, /Answer captured in return draft/);
  assert.equal(inboxAnswerPatchRuntime.previewSchema, "learning-companion.mobile-inbox-patch.v1");
  assert.equal(inboxAnswerPatchRuntime.answersQuestionCaptureId, "capture_question_runtime");
  assert.match(inboxAnswerPatchRuntime.quoteLabel, /Quote/);
  assert.match(inboxAnswerPatchRuntime.thoughtLabel, /Thought/);
  assert.equal(inboxAnswerPatchRuntime.quoteReadOnly, false);
  assert.equal(inboxAnswerPatchRuntime.quoteAriaReadonly, "false");
  assert.match(inboxAnswerPatchRuntime.copyCta, /Copy Return File/);
  assert.match(inboxAnswerPatchRuntime.saveCta, /Download Return File/);
  assert.equal(inboxAnswerPatchRuntime.answerContextHidden, false);
  assert.match(inboxAnswerPatchRuntime.answerContextTitle, /Answer captured in this return draft/);
  assert.equal(inboxAnswerPatchRuntime.answerQuestionPreview, "What should I answer from the mirror?");
  assert.match(inboxAnswerPatchRuntime.answerContextText, /Save or copy the return file to move it back to Mac/);

  const longAnswerQuote = `Can this preview escape <script>alert("x")</script> & keep a bounded question preview ${"x".repeat(300)}`;
  const escapedAnswerParams = new URLSearchParams({
    topicId: inboxRuntime.selectedTopicId,
    quote: longAnswerQuote,
    thought: "Answer:",
    answerToCaptureId: "capture_question_escape_runtime",
    sourceTitle: "Escaped mirror question"
  });
  await cdp.send("Page.navigate", { url: `${appUrl}mirror-inbox.html?${escapedAnswerParams}` });
  await sleep(300);
  const escapedAnswerRuntime = await cdp.evaluate(`(() => ({
    hidden: document.querySelector("#answerContext").hidden,
    previewText: document.querySelector("#answerQuestionPreview").textContent,
    previewHtml: document.querySelector("#answerQuestionPreview").innerHTML,
    quoteField: document.querySelector("#quoteInput").value
  }))()`);
  assert.equal(escapedAnswerRuntime.hidden, false);
  assert.equal(escapedAnswerRuntime.quoteField, longAnswerQuote);
  assert.ok(escapedAnswerRuntime.previewText.length <= 120);
  assert.match(escapedAnswerRuntime.previewText, /^Can this preview escape/);
  assert.equal(escapedAnswerRuntime.previewHtml.includes("<script>"), false);
  assert.match(escapedAnswerRuntime.previewHtml, /&lt;script&gt;/);

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
      sourceUrlField: document.querySelector("#sourceUrlInput").value,
      quoteLabel: document.querySelector("#quoteLabel").textContent,
      thoughtLabel: document.querySelector("#thoughtLabel").textContent,
      quoteReadOnly: document.querySelector("#quoteInput").readOnly,
      answerContextHidden: document.querySelector("#answerContext").hidden,
      answerContextText: document.querySelector("#answerContext").textContent
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

  assert.match(hostileInboxRuntime.preAdd.status, /Answer draft loaded with active topic/);
  assert.equal(hostileInboxRuntime.preAdd.selectedTopicId, inboxRuntime.selectedTopicId);
  assert.equal(hostileInboxRuntime.preAdd.quoteField, hostileMirrorQuote);
  assert.equal(hostileInboxRuntime.preAdd.sourceUrlField, "");
  assert.match(hostileInboxRuntime.preAdd.quoteLabel, /Quote/);
  assert.match(hostileInboxRuntime.preAdd.thoughtLabel, /Thought/);
  assert.equal(hostileInboxRuntime.preAdd.quoteReadOnly, false);
  assert.equal(hostileInboxRuntime.preAdd.answerContextHidden, true);
  assert.doesNotMatch(hostileInboxRuntime.preAdd.answerContextText, /question from this mirror/);
  assert.match(hostileInboxRuntime.status, /Capture added to return draft/);
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
  const urlTitleCollision = await waitForCdpValue(cdp, `(() => {
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
  })()`, (value) => value.activeSourceUrl === "https://example.com/not-the-scratch-source"
    && value.latestQuote === "URL should block title fallback");

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
  const stagedMatched = await waitForCdpValue(cdp, `(() => {
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
  })()`, (value) => value.activeTitle === "Title-only target"
    && value.quoteValue === "Staged title-only clip");

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
  const queryOrderInbound = await waitForCdpValue(cdp, `(() => {
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
  })()`, (value) => value.activeTitle === "Query order target"
    && value.latestQuote === "Query order matched capture");

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
    [...initialCaptureCard.querySelectorAll("button")].find((button) => button.textContent === "Add to notes").click();
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
        .some((button) => button.textContent === "Save for recall" && !button.disabled)
    };
    document.querySelector('[data-tab="captures"]').click();
    const captureCard = [...document.querySelectorAll("#captureList .item-card")]
      .find((item) => item.textContent.includes("Temporary capture for deletion."));
    const makeCardEnabled = [...captureCard.querySelectorAll("button")]
      .find((button) => button.textContent === "Save for recall" && !button.disabled);
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
      undoLabel: document.querySelector("#activityUndoBtn").textContent,
      undoTitle: document.querySelector("#activityUndoBtn").title,
      undoAria: document.querySelector("#activityUndoBtn").getAttribute("aria-label") || "",
      undoRemaining: document.querySelector("#activityUndoBtn").dataset.undoRemainingSeconds || ""
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
      activity: document.querySelector("#activityTitle").textContent,
      undoLabel: document.querySelector("#activityUndoBtn").textContent,
      undoAria: document.querySelector("#activityUndoBtn").getAttribute("aria-label") || "",
      undoRemaining: document.querySelector("#activityUndoBtn").dataset.undoRemainingSeconds || ""
    };
    setValue("#sourceTitle", "New saved source should replace the old delete recovery point.");
    const afterUndoSaveInvalidation = {
      undoHidden: document.querySelector("#activityUndoBtn").hidden,
      activity: document.querySelector("#activityTitle").textContent,
      activityDetail: document.querySelector("#activityDetail").textContent,
      undoRemaining: document.querySelector("#activityUndoBtn").dataset.undoRemainingSeconds || ""
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
      afterUndoSaveInvalidation,
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
  assert.equal(deleteFlow.afterStackDelete.undoLabel, "Undo delete (10s)");
  assert.match(deleteFlow.afterStackDelete.undoTitle, /Undo delete before this recovery window closes/);
  assert.match(deleteFlow.afterStackDelete.undoTitle, /Delete directly from the sidecar stack/);
  assert.match(deleteFlow.afterStackDelete.undoAria, /Undo capture delete/);
  assert.match(deleteFlow.afterStackDelete.undoAria, /10 seconds remaining/);
  assert.equal(deleteFlow.afterStackDelete.undoRemaining, "10");
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
  assert.equal(deleteFlow.afterStackRedoDelete.undoLabel, "Undo delete (10s)");
  assert.match(deleteFlow.afterStackRedoDelete.undoAria, /10 seconds remaining/);
  assert.equal(deleteFlow.afterStackRedoDelete.undoRemaining, "10");
  assert.equal(deleteFlow.afterUndoSaveInvalidation.undoHidden, true);
  assert.equal(deleteFlow.afterUndoSaveInvalidation.activity, "Undo expired");
  assert.equal(deleteFlow.afterUndoSaveInvalidation.activityDetail, "A new save replaced the capture-delete recovery point.");
  assert.equal(deleteFlow.afterUndoSaveInvalidation.undoRemaining, "");
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
    setValue("#materialType", "video");
    setValue("#thoughtInput", "Why does this theorem need the compactness assumption?");
    document.querySelector("#captureBtn").click();
    const questionSignal = Array.from(document.querySelectorAll("#focusBriefSignals .focus-signal"))
      .find((node) => /open question/.test(node.textContent));
    const initialQuestionSignals = document.querySelector("#focusBriefSignals").textContent;
    document.querySelector("#sidecarLayoutBtn").click();
    const beforeQuestionSignalClick = {
      shellCompact: document.querySelector(".app-shell").classList.contains("sidecar-layout"),
      focusBriefVisible: getComputedStyle(document.querySelector(".focus-brief")).display !== "none",
      focusBriefCompressed: document.querySelector(".focus-brief").classList.contains("is-sidecar-redundant"),
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
      .find((button) => button.textContent === "View")
      ?.click();
    setValue("#quoteInput", "Existing quote before answering");
    setValue("#thoughtInput", "Half-written side note");
    setValue("#timestampInput", "03:14");
    document.querySelector('[data-tab="today"]').click();
    const parkedQuestionCardWithDraft = Array.from(document.querySelectorAll("#todayList .parked-question-card"))
      .find((node) => /compactness assumption/.test(node.textContent));
    Array.from(parkedQuestionCardWithDraft?.querySelectorAll("button") || [])
      .find((button) => button.textContent === "Answer")
      ?.click();
    const collisionExport = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    const collisionTopic = collisionExport.sessions.find((session) => session.title === "Question parking smoke");
    const collisionQuestion = collisionTopic?.captures.find((item) => /compactness assumption/.test(item.thought || item.quote));
    const collisionPrefs = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}");
    const afterAnswerDraftCollision = {
      activity: document.querySelector("#activityTitle").textContent,
      detail: document.querySelector("#activityDetail").textContent,
      activeTitle: document.querySelector("#sessionTitle").value,
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activeElement: document.activeElement?.id || "",
      quote: document.querySelector("#quoteInput").value,
      thought: document.querySelector("#thoughtInput").value,
      timestamp: document.querySelector("#timestampInput").value,
      draftTarget: collisionPrefs.captureDrafts?.[collisionTopic?.id || ""]?.answersQuestionCaptureId || "",
      questionParked: Boolean(collisionQuestion?.questionParkedAt)
    };
    document.querySelector("#clearCaptureDraftBtn")?.click();
    setValue("#timestampInput", "04:44");
    document.querySelector('[data-tab="today"]').click();
    const parkedQuestionCardWithTimeDraft = Array.from(document.querySelectorAll("#todayList .parked-question-card"))
      .find((node) => /compactness assumption/.test(node.textContent));
    Array.from(parkedQuestionCardWithTimeDraft?.querySelectorAll("button") || [])
      .find((button) => button.textContent === "Answer")
      ?.click();
    const timeCollisionExport = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    const timeCollisionTopic = timeCollisionExport.sessions.find((session) => session.title === "Question parking smoke");
    const timeCollisionQuestion = timeCollisionTopic?.captures.find((item) => /compactness assumption/.test(item.thought || item.quote));
    const timeCollisionPrefs = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}");
    const afterAnswerTimeDraftCollision = {
      activity: document.querySelector("#activityTitle").textContent,
      detail: document.querySelector("#activityDetail").textContent,
      activeTitle: document.querySelector("#sessionTitle").value,
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activeElement: document.activeElement?.id || "",
      quote: document.querySelector("#quoteInput").value,
      thought: document.querySelector("#thoughtInput").value,
      timestamp: document.querySelector("#timestampInput").value,
      draftTarget: timeCollisionPrefs.captureDrafts?.[timeCollisionTopic?.id || ""]?.answersQuestionCaptureId || "",
      questionParked: Boolean(timeCollisionQuestion?.questionParkedAt)
    };
    document.querySelector("#clearCaptureDraftBtn")?.click();
    document.querySelector('[data-tab="today"]').click();
    const parkedQuestionCardAfterDraftClear = Array.from(document.querySelectorAll("#todayList .parked-question-card"))
      .find((node) => /compactness assumption/.test(node.textContent));
    Array.from(parkedQuestionCardAfterDraftClear?.querySelectorAll("button") || [])
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
    setValue("#thoughtInput", "Answer: partially written before break");
    document.querySelector('[data-tab="today"]').click();
    const openQuestionCardAfterAnswerDraft = Array.from(document.querySelectorAll("#todayList .question-card:not(.parked-question-card):not(.closed-question-card)"))
      .find((node) => /compactness assumption/.test(node.textContent));
    Array.from(openQuestionCardAfterAnswerDraft?.querySelectorAll("button") || [])
      .find((button) => button.textContent === "Answer")
      ?.click();
    const afterAnswerDraftResume = {
      activity: document.querySelector("#activityTitle").textContent,
      activeTitle: document.querySelector("#sessionTitle").value,
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activeElement: document.activeElement?.id || "",
      quote: document.querySelector("#quoteInput").value,
      thought: document.querySelector("#thoughtInput").value,
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
      .find((button) => button.textContent === "Save for recall")
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
    const answerReturnedWorkCard = document.querySelector(".returned-work-card");
    const answerReturnedWorkText = answerReturnedWorkCard?.textContent || "";
    const answerReturnedWorkButtons = [...(answerReturnedWorkCard?.querySelectorAll("button") || [])].map((button) => button.textContent);
    answerReturnedWorkCard?.querySelector("[data-returned-work-action]")?.click();
    const answerReturnedWorkClosedCardPulsed = Boolean(answerTarget?.id && document.querySelector('[data-capture-id="' + CSS.escape(answerTarget.id) + '"]')?.classList.contains("pulse"));
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
      todayText: document.querySelector("#todayList").textContent,
      returnedWorkText: answerReturnedWorkText,
      returnedWorkButtons: answerReturnedWorkButtons,
      returnedWorkClosedCardPulsed: answerReturnedWorkClosedCardPulsed
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
    const answerOnlyRestoreJson = window.learningCompanionNative.exportWorkspaceJson();
    const answerOnlyWorkspace = JSON.parse(answerOnlyRestoreJson);
    const answerOnlySession = answerOnlyWorkspace.sessions.find((session) => session.id === answerOnlyWorkspace.activeSessionId) || answerOnlyWorkspace.sessions[0];
    const answerOnlyQuestionId = "browser_answer_only_question";
    answerOnlySession.captures.unshift({
      id: answerOnlyQuestionId,
      quote: "Answer-only returned work question.",
      thought: "Question: should returned answers without a card still lead to closed questions?",
      timestamp: "",
      sourceTitle: answerOnlySession.sourceTitle || "",
      sourceUrl: answerOnlySession.sourceUrl || "",
      materialType: answerOnlySession.materialType || "doc",
      tags: ["question"],
      capturedAt: "2026-05-29T10:20:00.000Z"
    });
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify(answerOnlyWorkspace));
    document.querySelector('[data-tab="today"]').click();
    const answerOnlyImport = window.learningCompanionNative.importWorkspaceJson(JSON.stringify({
      schema: "learning-companion.mobile-inbox-patch.v1",
      appVersion: 1,
      patchId: "browser_answer_only_patch",
      createdAt: "2026-05-29T10:21:00.000Z",
      source: { generatedBy: "inbox.html", workspaceFingerprint: "browser-answer-only", topicId: answerOnlySession.id, topicTitle: answerOnlySession.title },
      target: { topicId: answerOnlySession.id, topicTitle: answerOnlySession.title },
      captures: [{
        id: "browser_answer_only_capture",
        quote: "The fallback should still navigate to the closed question ledger.",
        thought: "Answer: yes, because the returned answer closed the loop even without a refreshable card.",
        tags: "answer",
        answersQuestionCaptureId: answerOnlyQuestionId,
        capturedAt: "2026-05-29T10:21:01.000Z"
      }]
    }));
    const answerOnlyReturnedWorkCard = document.querySelector(".returned-work-card");
    const answerOnlyReturnedWorkText = answerOnlyReturnedWorkCard?.textContent || "";
    const answerOnlyReturnedWorkButtons = [...(answerOnlyReturnedWorkCard?.querySelectorAll("button") || [])].map((button) => button.textContent);
    answerOnlyReturnedWorkCard?.querySelector("[data-returned-work-action]")?.click();
    const answerOnlyClosedCardPulsed = Boolean(document.querySelector('[data-capture-id="' + CSS.escape(answerOnlyQuestionId) + '"]')?.classList.contains("pulse"));
    const answerOnlyReturn = {
      ok: answerOnlyImport.ok === true,
      answeredQuestions: answerOnlyImport.receipt?.answeredQuestions || 0,
      refreshableReviewCards: answerOnlyImport.receipt?.refreshableReviewCards || 0,
      returnedWorkText: answerOnlyReturnedWorkText,
      returnedWorkButtons: answerOnlyReturnedWorkButtons,
      closedCardPulsed: answerOnlyClosedCardPulsed
    };
    window.learningCompanionNative.importWorkspaceJson(answerOnlyRestoreJson);
    document.querySelector('[data-tab="today"]').click();
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
      afterAnswerDraftCollision,
      afterAnswerTimeDraftCollision,
      afterAnswerDraft,
      afterAnswerDraftResume,
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
      answerOnlyReturn,
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
  assert.equal(questionFlow.questionSignalClick.before.shellCompact, true);
  assert.equal(questionFlow.questionSignalClick.before.focusBriefVisible, true);
  assert.equal(questionFlow.questionSignalClick.before.focusBriefCompressed, false);
  assert.equal(questionFlow.questionSignalClick.before.tagName, "BUTTON");
  assert.equal(questionFlow.questionSignalClick.before.ariaLabel, "Open questions");
  assert.match(questionFlow.questionSignalClick.before.action, /Review 2 (workspace )?due cards/);
  assert.equal(questionFlow.questionSignalClick.after.shellCompact, false);
  assert.equal(questionFlow.questionSignalClick.after.activeTab, "today");
  assert.equal(questionFlow.questionSignalClick.after.sectionPulsed, true);
  assert.equal(questionFlow.questionSignalClick.after.sectionText, "Open Questions");
  assert.equal(questionFlow.questionButtons.includes("Answer"), true);
  assert.equal(questionFlow.questionButtons.includes("Save for recall"), true);
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
  assert.equal(questionFlow.afterAnswerDraftCollision.activity, "Capture draft waiting");
  assert.match(questionFlow.afterAnswerDraftCollision.detail, /Finish or clear current draft before answering/);
  assert.match(questionFlow.afterAnswerDraftCollision.detail, /compactness assumption/);
  assert.equal(questionFlow.afterAnswerDraftCollision.activeTitle, "Question parking smoke");
  assert.equal(questionFlow.afterAnswerDraftCollision.activeTab, "captures");
  assert.equal(questionFlow.afterAnswerDraftCollision.activeElement, "thoughtInput");
  assert.equal(questionFlow.afterAnswerDraftCollision.quote, "Existing quote before answering");
  assert.equal(questionFlow.afterAnswerDraftCollision.thought, "Half-written side note");
  assert.equal(questionFlow.afterAnswerDraftCollision.timestamp, "03:14");
  assert.equal(questionFlow.afterAnswerDraftCollision.draftTarget, "");
  assert.equal(questionFlow.afterAnswerDraftCollision.questionParked, true);
  assert.equal(questionFlow.afterAnswerTimeDraftCollision.activity, "Capture draft waiting");
  assert.match(questionFlow.afterAnswerTimeDraftCollision.detail, /Time kept @ 04:44/);
  assert.match(questionFlow.afterAnswerTimeDraftCollision.detail, /compactness assumption/);
  assert.equal(questionFlow.afterAnswerTimeDraftCollision.activeTitle, "Question parking smoke");
  assert.equal(questionFlow.afterAnswerTimeDraftCollision.activeTab, "captures");
  assert.equal(questionFlow.afterAnswerTimeDraftCollision.activeElement, "quoteInput");
  assert.equal(questionFlow.afterAnswerTimeDraftCollision.quote, "");
  assert.equal(questionFlow.afterAnswerTimeDraftCollision.thought, "");
  assert.equal(questionFlow.afterAnswerTimeDraftCollision.timestamp, "04:44");
  assert.equal(questionFlow.afterAnswerTimeDraftCollision.draftTarget, "");
  assert.equal(questionFlow.afterAnswerTimeDraftCollision.questionParked, true);
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
  assert.equal(questionFlow.afterAnswerDraftResume.activity, "Answer draft resumed");
  assert.equal(questionFlow.afterAnswerDraftResume.activeTitle, "Question parking smoke");
  assert.equal(questionFlow.afterAnswerDraftResume.activeTab, "captures");
  assert.equal(questionFlow.afterAnswerDraftResume.activeElement, "thoughtInput");
  assert.equal(questionFlow.afterAnswerDraftResume.quote, "Why does this theorem need the compactness assumption?");
  assert.equal(questionFlow.afterAnswerDraftResume.thought, "Answer: partially written before break");
  assert.match(questionFlow.afterAnswerDraftResume.draftTarget, /^capture_/);
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
  assert.match(questionFlow.afterAnswerImport.returnedWorkText, /Returned from phone\/Windows/);
  assert.match(questionFlow.afterAnswerImport.returnedWorkText, /1 new capture · 1 question resolved from phone or Windows/);
  assert.match(questionFlow.afterAnswerImport.returnedWorkText, /1 card ready to refresh/);
  assert.deepEqual(questionFlow.afterAnswerImport.returnedWorkButtons, ["Refresh cards", "View captures", "Import details", "Dismiss"]);
  assert.equal(questionFlow.afterAnswerImport.returnedWorkClosedCardPulsed, true);
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
  assert.equal(questionFlow.answerOnlyReturn.ok, true);
  assert.equal(questionFlow.answerOnlyReturn.answeredQuestions, 1);
  assert.equal(questionFlow.answerOnlyReturn.refreshableReviewCards, 0);
  assert.match(questionFlow.answerOnlyReturn.returnedWorkText, /1 new capture · 1 question resolved from phone or Windows/);
  assert.doesNotMatch(questionFlow.answerOnlyReturn.returnedWorkText, /card ready to refresh/);
  assert.deepEqual(questionFlow.answerOnlyReturn.returnedWorkButtons, ["View closed questions", "View captures", "Import details", "Dismiss"]);
  assert.equal(questionFlow.answerOnlyReturn.closedCardPulsed, true);

  const nativeClipboardCapture = await cdp.evaluate(`(() => {
    // Keep this bridge-heavy scenario isolated from the later mobile layout smoke.
    const beforeNativeWorkspaceJson = window.learningCompanionNative.exportWorkspaceJson();
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
    const promotedResult = window.learningCompanionNative.captureClipboardText("Native promoted review bridge capture.", {
      promoteToReview: true
    });
    const promotedActivityAction = document.querySelector("#activityDetailsBtn").textContent;
    const promotedActivityAria = document.querySelector("#activityDetailsBtn").getAttribute("aria-label") || "";
    const promotedActiveTab = document.querySelector(".tab.active")?.dataset.tab || "";
    const promotedWorkspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
    const promotedSession = promotedWorkspace.sessions.find((item) => item.id === promotedWorkspace.activeSessionId);
    const promotedReviewCardId = promotedSession?.reviewCards[0]?.id || "";
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
    const matchedActivityTitle = document.querySelector("#activityTitle").textContent;
    const matchedActivityDetail = document.querySelector("#activityDetail").textContent;
    const matchedActivityAction = document.querySelector("#activityDetailsBtn").textContent;
    const matchedActiveTabUi = document.querySelector(".tab.active")?.dataset.tab || "";
    const sidecarOn = window.learningCompanionNative.setSidecarLayout(true);
    const sidecarCapture = window.learningCompanionNative.captureClipboardText("Native sidecar focus capture.", {
      captureSource: "selected-text"
    });
    const sidecarRailSteps = [...document.querySelectorAll("[data-sidecar-rail-step]")].map((step) => ({
      kind: step.dataset.sidecarRailStep,
      text: step.textContent,
      aria: step.getAttribute("aria-label") || ""
    }));
    const sidecarState = {
      sidecarStillCompact: document.querySelector(".app-shell").classList.contains("sidecar-layout"),
      sidecarActivityTitle: document.querySelector("#activityTitle").textContent,
      sidecarActivityAction: document.querySelector("#activityDetailsBtn").textContent,
      sidecarActivityAria: document.querySelector("#activityDetailsBtn").getAttribute("aria-label") || "",
      sidecarActiveTabUi: document.querySelector(".tab.active")?.dataset.tab || "",
      sidecarRailHidden: document.querySelector("#sidecarRail").hidden,
      sidecarRailSteps
    };
    document.querySelector("#activityDetailsBtn").click();
    const sidecarActionTarget = document.querySelector('[data-capture-id="' + CSS.escape(sidecarCapture.captureId) + '"]');
    const sidecarActionState = {
      afterActionCompact: document.querySelector(".app-shell").classList.contains("sidecar-layout"),
      afterActionActiveTab: document.querySelector(".tab.active")?.dataset.tab || "",
      afterActionTargetPulsed: sidecarActionTarget?.classList.contains("pulse") === true
    };
    const sidecarOff = window.learningCompanionNative.setSidecarLayout(false);
    const restoreResult = window.learningCompanionNative.importWorkspaceJson(beforeNativeWorkspaceJson);
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
      promotedOk: promotedResult.ok,
      promotedReviewCardId: promotedResult.reviewCardId,
      promotedLatestReviewCardId: promotedReviewCardId,
      promotedActivityAction,
      promotedActivityAria,
      promotedActiveTab,
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
      activityTitle: matchedActivityTitle,
      activityDetail: matchedActivityDetail,
      activityAction: matchedActivityAction,
      activeTabUi: matchedActiveTabUi,
      sidecarOnOk: sidecarOn.ok === true && sidecarOn.sidecarLayout === true,
      sidecarCaptureOk: sidecarCapture.ok === true,
      ...sidecarState,
      ...sidecarActionState,
      sidecarOffOk: sidecarOff.ok === true && sidecarOff.sidecarLayout === false,
      restoreOk: restoreResult.ok === true
    };
  })()`, 60000);

  assert.equal(nativeClipboardCapture.ok, true);
  assert.equal(nativeClipboardCapture.browserOk, true);
  assert.equal(nativeClipboardCapture.browserSourceAttached, true);
  assert.equal(nativeClipboardCapture.browserResolution, "active-fallback");
  assert.equal(nativeClipboardCapture.defaultCaptureSource, "clipboard");
  assert.equal(nativeClipboardCapture.selectedCaptureSource, "selected-text");
  assert.equal(nativeClipboardCapture.selectedActivityTitle, "Selected text capture saved");
  assert.equal(nativeClipboardCapture.fallbackCaptureSource, "clipboard-fallback");
  assert.equal(nativeClipboardCapture.fallbackActivityTitle, "Clipboard fallback capture saved");
  assert.equal(nativeClipboardCapture.promotedOk, true);
  assert.equal(nativeClipboardCapture.promotedReviewCardId, nativeClipboardCapture.promotedLatestReviewCardId);
  assert.match(nativeClipboardCapture.promotedReviewCardId, /^card_/);
  assert.equal(nativeClipboardCapture.promotedActivityAction, "Review card");
  assert.equal(nativeClipboardCapture.promotedActivityAria, "Open review card");
  assert.equal(nativeClipboardCapture.promotedActiveTab, "review");
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
  assert.equal(nativeClipboardCapture.activityAction, "Saved capture");
  assert.equal(nativeClipboardCapture.activeTabUi, "captures");
  assert.equal(nativeClipboardCapture.sidecarOnOk, true);
  assert.equal(nativeClipboardCapture.sidecarCaptureOk, true);
  assert.equal(nativeClipboardCapture.sidecarStillCompact, true);
  assert.equal(nativeClipboardCapture.sidecarActivityTitle, "Selected text capture saved");
  assert.equal(nativeClipboardCapture.sidecarActivityAction, "Exit + Saved capture");
  assert.equal(nativeClipboardCapture.sidecarActivityAria, "Open saved capture and exit sidecar layout");
  assert.equal(nativeClipboardCapture.sidecarActiveTabUi, "captures");
  assert.equal(nativeClipboardCapture.sidecarRailHidden, false);
  assert.deepEqual(nativeClipboardCapture.sidecarRailSteps.map((step) => step.kind), ["source", "capture", "loop"]);
  assert.match(nativeClipboardCapture.sidecarRailSteps[1].text, /Capture/);
  assert.match(nativeClipboardCapture.sidecarRailSteps[1].text, /Capture next point/);
  assert.match(nativeClipboardCapture.sidecarRailSteps[1].text, /Focus field/);
  assert.equal(nativeClipboardCapture.afterActionCompact, false);
  assert.equal(nativeClipboardCapture.afterActionActiveTab, "captures");
  assert.equal(nativeClipboardCapture.afterActionTargetPulsed, true);
  assert.equal(nativeClipboardCapture.sidecarOffOk, true);
  assert.equal(nativeClipboardCapture.restoreOk, true);

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
    if (!document.querySelector("#clearCaptureDraftBtn").hidden) {
      document.querySelector("#clearCaptureDraftBtn").click();
    }
    const longDestinationTitle = "Learning Companion Browser Notes";
    const titleInput = document.querySelector("#sessionTitle");
    const sourceTitleInput = document.querySelector("#sourceTitle");
    const originalTitle = titleInput.value;
    const originalSourceTitle = sourceTitleInput.value;
    titleInput.value = longDestinationTitle;
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    sourceTitleInput.value = "Manual browser check source";
    sourceTitleInput.dispatchEvent(new Event("input", { bubbles: true }));
    const captureContext = document.querySelector("#captureContext");
    const target = document.querySelector("#captureContextTarget");
    const sourceControl = document.querySelector("#captureContextSource");
    const captureStarters = document.querySelector("#captureStarters");
    const captureStarterLabel = document.querySelector(".capture-starter-label");
    const starterButtons = [...document.querySelectorAll("[data-capture-starter]")].map((button) => ({
      text: button.textContent,
      width: Math.ceil(button.getBoundingClientRect().width),
      height: Math.ceil(button.getBoundingClientRect().height)
    }));
    const timeRow = document.querySelector(".time-input-row");
    const result = {
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
      captureTargetText: target.textContent,
      captureTargetTitle: target.title,
      captureTargetAria: target.getAttribute("aria-label"),
      captureTargetHeight: Math.ceil(target.getBoundingClientRect().height),
      captureTargetInnerText: target.innerText,
      captureTargetClientHeight: target.clientHeight,
      captureTargetScrollHeight: target.scrollHeight,
      captureTargetClientWidth: target.clientWidth,
      captureTargetScrollWidth: target.scrollWidth,
      originalTitle,
      originalSourceTitle,
      captureSourceText: sourceControl.textContent,
      captureSourceTitle: sourceControl.title,
      captureSourceAria: sourceControl.getAttribute("aria-label"),
      captureSourceHeight: Math.ceil(sourceControl.getBoundingClientRect().height),
      captureSourceClientHeight: sourceControl.clientHeight,
      captureSourceScrollHeight: sourceControl.scrollHeight,
      captureSourceClientWidth: sourceControl.clientWidth,
      captureSourceScrollWidth: sourceControl.scrollWidth,
      captureSourceWidth: Math.ceil(sourceControl.getBoundingClientRect().width),
      captureSourceHit: (() => {
        const rect = sourceControl.getBoundingClientRect();
        return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) === sourceControl;
      })(),
      captureStartersVisible: getComputedStyle(captureStarters).display !== "none",
      captureStartersWidth: Math.ceil(captureStarters.getBoundingClientRect().width),
      captureStartersScrollWidth: captureStarters.scrollWidth,
      captureStarterLabel: captureStarterLabel?.textContent || "",
      starterButtons,
      timeRowWidth: Math.ceil(timeRow.getBoundingClientRect().width),
      timeRowScrollWidth: timeRow.scrollWidth,
      timeBackWidth: Math.ceil(document.querySelector("#timeBackBtn").getBoundingClientRect().width),
      timeForwardWidth: Math.ceil(document.querySelector("#timeForwardBtn").getBoundingClientRect().width)
    };
    titleInput.value = originalTitle;
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    sourceTitleInput.value = originalSourceTitle;
    sourceTitleInput.dispatchEvent(new Event("input", { bubbles: true }));
    result.restoredTitle = document.querySelector("#sessionTitle").value;
    result.restoredSourceTitle = document.querySelector("#sourceTitle").value;
    return result;
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
  assert.equal(mobileLayout.captureStartersVisible, true);
  assert.equal(mobileLayout.captureStarterLabel, "Write as");
  assert.ok(mobileLayout.deskReviewWidth <= mobileLayout.innerWidth - 24);
  assert.ok(mobileLayout.captureContextWidth <= mobileLayout.innerWidth - 24);
  assert.ok(mobileLayout.captureContextScrollWidth <= mobileLayout.captureContextWidth + 2);
  assert.equal(mobileLayout.captureTargetText, "To Learning Companion Browser Notes");
  assert.equal(mobileLayout.captureTargetTitle, "Captures save to Learning Companion Browser Notes");
  assert.equal(mobileLayout.captureTargetAria, "Show capture destination: Learning Companion Browser Notes");
  assert.ok(mobileLayout.captureTargetHeight >= 32);
  assert.ok(mobileLayout.captureTargetHeight <= 48);
  assert.doesNotMatch(mobileLayout.captureTargetInnerText, /…|\.\.\./);
  assert.ok(mobileLayout.captureTargetScrollHeight <= mobileLayout.captureTargetClientHeight + 1);
  assert.ok(mobileLayout.captureTargetScrollWidth <= mobileLayout.captureTargetClientWidth + 2);
  assert.equal(mobileLayout.captureSourceText, "Manual browser check source");
  assert.match(mobileLayout.captureSourceTitle, /Manual browser check source/);
  assert.equal(mobileLayout.captureSourceAria, "Show capture source: Manual browser check source");
  assert.ok(mobileLayout.captureSourceHeight >= 32);
  assert.ok(mobileLayout.captureSourceHeight <= 48);
  assert.ok(mobileLayout.captureSourceScrollHeight <= mobileLayout.captureSourceClientHeight + 1);
  assert.ok(mobileLayout.captureSourceScrollWidth <= mobileLayout.captureSourceClientWidth + 2);
  assert.ok(mobileLayout.captureSourceWidth > 0);
  assert.equal(mobileLayout.captureSourceHit, true);
  assert.equal(mobileLayout.restoredTitle, mobileLayout.originalTitle);
  assert.equal(mobileLayout.restoredSourceTitle, mobileLayout.originalSourceTitle);
  assert.ok(mobileLayout.captureStartersWidth <= mobileLayout.innerWidth - 24);
  assert.ok(mobileLayout.captureStartersScrollWidth <= mobileLayout.captureStartersWidth + 2);
  assert.deepEqual(mobileLayout.starterButtons.map((button) => button.text), ["Question", "Answer", "Takeaway"]);
  mobileLayout.starterButtons.forEach((button) => {
    assert.ok(button.height >= 32);
  });
  assert.ok(mobileLayout.timeRowWidth <= mobileLayout.innerWidth - 24);
  assert.ok(mobileLayout.timeRowScrollWidth <= mobileLayout.timeRowWidth + 2);
  assert.ok(mobileLayout.timeBackWidth >= 44);
  assert.ok(mobileLayout.timeForwardWidth >= 44);
  assert.ok(mobileLayout.documentWidth <= mobileLayout.innerWidth + 2);
  assert.ok(mobileLayout.bodyWidth <= mobileLayout.innerWidth + 2);
  await assertDraftSourceSnapshotCommit(cdp);
  await assertReturnFilesImportModeGuard(cdp);
  await assertPasteReturnFileFromClipboard(cdp);
  await assertFirstCaptureLoopDecision(cdp);
  await assertPostSaveFlow(cdp);
  await assertCaptureStackNextStepMix(cdp);
  await assertSidecarHighlightActivity(cdp);
  await assertReaderSelectionCapture(cdp);
  await assertUiPrefsV6Migration(cdp);
  await assertVideoNotesTools(cdp);
  await cdp.close();
  console.log("smoke_browser_ok");
} finally {
  chrome.kill("SIGTERM");
  await waitForProcessExit(chrome, 3000);
  server.close();
  if (cleanupSmokeArtifacts) {
    rmSync(smokeRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

async function assertUiPrefsV6Migration(cdp) {
  const beforePrefs = await cdp.evaluate(`localStorage.getItem("learning-companion.ui.v1")`);
  const activeSessionId = await cdp.evaluate(`JSON.parse(window.learningCompanionNative.exportWorkspaceJson()).activeSessionId`);
  try {
    await cdp.evaluate(`(() => {
      const activeSessionId = ${JSON.stringify(activeSessionId)};
      localStorage.setItem("learning-companion.ui.v1", JSON.stringify({
        schemaVersion: 6,
        language: "zh",
        sidecarLayout: true,
        readingPrefs: { theme: "dark", fontSize: 18, tocCollapsed: true },
        captureDrafts: {
          [activeSessionId]: {
            quote: "migration draft quote",
            thought: "migration draft thought",
            timestamp: "00:12",
            updatedAt: "2026-06-20T10:00:00.000Z"
          }
        },
        workspaceBackup: {
          fingerprint: "fnv1a-deadbeef",
          exportedAt: "2026-06-20T10:00:00.000Z"
        },
        mirrorHandoff: {
          workspaceFingerprint: "fnv1a-cafebabe",
          returnBaseFingerprint: "fnv1a-feedface",
          exportedAt: "2026-06-20T10:00:00.000Z",
          kind: "Mirror JSON",
          exportStats: { captures: 1, cards: 2, questions: 3, due: 4 }
        }
      }));
    })()`);
    await cdp.send("Page.reload", { ignoreCache: true });
    await sleep(500);
    const result = await cdp.evaluate(`(() => {
      const activeSessionId = ${JSON.stringify(activeSessionId)};
      const prefs = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}");
      return {
        schemaVersion: prefs.schemaVersion,
        language: prefs.language,
        sidecarLayout: prefs.sidecarLayout,
        readingTheme: prefs.readingPrefs?.theme || "",
        readingFontSize: prefs.readingPrefs?.fontSize || 0,
        tocCollapsed: prefs.readingPrefs?.tocCollapsed === true,
        playbackRate: prefs.videoPlaybackRate,
        draftQuote: prefs.captureDrafts?.[activeSessionId]?.quote || "",
        backupFingerprint: prefs.workspaceBackup?.fingerprint || "",
        mirrorKind: prefs.mirrorHandoff?.kind || "",
        htmlLang: document.documentElement.lang
      };
    })()`);
    assert.deepEqual(result, {
      schemaVersion: 7,
      language: "zh",
      sidecarLayout: true,
      readingTheme: "dark",
      readingFontSize: 18,
      tocCollapsed: true,
      playbackRate: 1,
      draftQuote: "migration draft quote",
      backupFingerprint: "fnv1a-deadbeef",
      mirrorKind: "Mirror JSON",
      htmlLang: "zh-CN"
    });
  } finally {
    if (beforePrefs === null) await cdp.evaluate(`localStorage.removeItem("learning-companion.ui.v1")`);
    else await cdp.evaluate(`localStorage.setItem("learning-companion.ui.v1", ${JSON.stringify(beforePrefs)})`);
    await cdp.send("Page.reload", { ignoreCache: true });
    await sleep(500);
  }
}

async function assertVideoNotesTools(cdp) {
  const result = await cdp.evaluate(`(async () => {
    const beforeWorkspaceJson = window.learningCompanionNative.exportWorkspaceJson();
    const beforePrefs = localStorage.getItem("learning-companion.ui.v1");
    try {
      const workspace = JSON.parse(beforeWorkspaceJson);
      const session = {
        ...workspace.sessions[0],
        id: "video_notes_tools_session",
        title: "Video notes tools",
        sourceTitle: "Video lesson",
        sourceUrl: "https://youtu.be/rust123",
        materialType: "video",
        tags: [],
        notesMarkdown: "alpha",
        videoBookmarks: [],
        captures: [],
        reviewCards: [],
        focusMode: "capture",
        viewerOpen: true
      };
      window.learningCompanionNative.importWorkspaceJson(JSON.stringify({
        ...workspace,
        activeSessionId: session.id,
        sessions: [session],
        importedPatches: [],
        importedReviewPatches: []
      }));
      await new Promise((resolve) => setTimeout(resolve, 250));
      const editor = document.querySelector("#notesEditor");
      editor.focus();
      editor.setSelectionRange(0, 5);
      document.querySelector('[data-notes-tool="bold"]').click();
      const afterBold = editor.value;
      document.querySelector("#timestampInput").value = "01:23";
      editor.setSelectionRange(editor.value.length, editor.value.length);
      document.querySelector("#insertTimestampNoteBtn").click();
      const afterTimestamp = editor.value;
      const speed = document.querySelector(".video-speed-select");
      speed.value = "1.5";
      speed.dispatchEvent(new Event("change", { bubbles: true }));
      window.prompt = () => "key insight";
      [...document.querySelectorAll(".viewer-controls button")]
        .find((button) => /Bookmark|书签/.test(button.textContent))?.click();
      await new Promise((resolve) => setTimeout(resolve, 120));
      const exported = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
      const active = exported.sessions.find((item) => item.id === exported.activeSessionId);
      const bookmarkChipText = document.querySelector(".video-bookmark-chip")?.textContent || "";
      const prefs = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}");
      return {
        afterBold,
        afterTimestamp,
        toolbarHidden: document.querySelector("#notesToolbar").hidden,
        timestampDisabled: document.querySelector("#insertTimestampNoteBtn").disabled,
        bookmarkCount: active.videoBookmarks.length,
        bookmarkLabel: active.videoBookmarks[0]?.label || "",
        bookmarkChipText,
        playbackRate: prefs.videoPlaybackRate,
        notesMarkdown: active.notesMarkdown,
        timestampButtonTitle: document.querySelector("#insertTimestampNoteBtn").title,
        speedExists: Boolean(speed)
      };
    } finally {
      window.learningCompanionNative.importWorkspaceJson(beforeWorkspaceJson);
      if (beforePrefs === null) localStorage.removeItem("learning-companion.ui.v1");
      else localStorage.setItem("learning-companion.ui.v1", beforePrefs);
    }
  })()`);

  assert.equal(result.afterBold, "**alpha**");
  assert.match(result.afterTimestamp, /\[01:23\]\(https:\/\/youtu\.be\/rust123\?t=83s\)/);
  assert.equal(result.toolbarHidden, false);
  assert.equal(result.timestampDisabled, false);
  assert.equal(result.bookmarkCount, 1);
  assert.equal(result.bookmarkLabel, "key insight");
  assert.match(result.bookmarkChipText, /key insight/);
  assert.equal(result.playbackRate, 1.5);
  assert.match(result.notesMarkdown, /\*\*alpha\*\*/);
  assert.match(result.timestampButtonTitle, /Insert current video timestamp|插入当前视频时间戳/);
  assert.equal(result.speedExists, true);
}

async function assertDraftSourceSnapshotCommit(cdp) {
  const result = await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const beforeWorkspaceJson = window.learningCompanionNative.exportWorkspaceJson();
    const beforeWorkspace = JSON.parse(beforeWorkspaceJson);
    const baseSession = beforeWorkspace.sessions.find((item) => item.id === beforeWorkspace.activeSessionId)
      || beforeWorkspace.sessions[0];
    const commitSession = {
      ...baseSession,
      id: "draft_source_commit_flow",
      title: "Draft source commit flow",
      sourceTitle: "Original source",
      sourceUrl: "https://www.youtube.com/watch?v=original123",
      materialType: "video",
      notesMarkdown: "",
      captures: [],
      reviewCards: [],
      focusMode: "capture"
    };
    const importWorkspace = (session) => {
      window.learningCompanionNative.importWorkspaceJson(JSON.stringify({
        ...beforeWorkspace,
        activeSessionId: session.id,
        sessions: [session],
        importedPatches: [],
        importedReviewPatches: []
      }));
      document.querySelector('[data-tab="captures"]').click();
    };
    const activeCapture = () => {
      const workspace = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
      const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId) || workspace.sessions[0];
      return session.captures[0] || {};
    };

    importWorkspace(commitSession);
    setValue("#sourceTitle", "Original source");
    setValue("#sourceUrl", "https://www.youtube.com/watch?v=original123");
    setValue("#materialType", "video");
    setValue("#quoteInput", "Draft should keep its original source.");
    setValue("#thoughtInput", "This capture is saved after the session source changes.");
    setValue("#sourceTitle", "Changed source");
    setValue("#sourceUrl", "https://example.com/changed-source");
    setValue("#materialType", "doc");
    const driftStatusBeforeSave = document.querySelector("#captureDraftStatus")?.textContent || "";
    document.querySelector("#captureBtn").click();
    const driftSaved = activeCapture();

    setValue("#sourceTitle", "Original source");
    setValue("#sourceUrl", "https://www.youtube.com/watch?v=original123");
    setValue("#materialType", "video");
    setValue("#quoteInput", "Draft should use current source after reanchor.");
    setValue("#thoughtInput", "Use current source before saving.");
    setValue("#sourceTitle", "Changed source");
    setValue("#sourceUrl", "https://example.com/changed-source");
    setValue("#materialType", "doc");
    const reanchorVisibleBeforeClick = document.querySelector("#reanchorCaptureDraftBtn")?.hidden === false;
    document.querySelector("#reanchorCaptureDraftBtn")?.click();
    const reanchorStatusBeforeSave = document.querySelector("#captureDraftStatus")?.textContent || "";
    document.querySelector("#captureBtn").click();
    const reanchoredSaved = activeCapture();

    const reverseSession = {
      ...commitSession,
      id: "draft_source_reverse_commit_flow",
      title: "Draft source reverse commit flow",
      sourceTitle: "Original doc source",
      sourceUrl: "https://example.com/original-doc",
      materialType: "doc",
      captures: [],
      reviewCards: []
    };
    importWorkspace(reverseSession);
    setValue("#sourceTitle", "Original doc source");
    setValue("#sourceUrl", "https://example.com/original-doc");
    setValue("#materialType", "doc");
    setValue("#quoteInput", "Document draft should keep its original source.");
    setValue("#thoughtInput", "This capture is saved after the session changes to video.");
    setValue("#sourceTitle", "Changed video source");
    setValue("#sourceUrl", "https://www.youtube.com/watch?v=changed456");
    setValue("#materialType", "video");
    const reverseDriftStatusBeforeSave = document.querySelector("#captureDraftStatus")?.textContent || "";
    document.querySelector("#captureBtn").click();
    const reverseDriftSaved = activeCapture();

    const questionSession = {
      ...commitSession,
      id: "draft_source_answer_flow",
      title: "Draft source answer flow",
      sourceTitle: "Current changed source",
      sourceUrl: "https://example.com/current-changed-source",
      materialType: "doc",
      captures: [{
        id: "question_original_source",
        quote: "Question carried from original source.",
        thought: "Question: what evidence closes this?",
        timestamp: "02:10",
        tags: [],
        sourceTitle: "Question original source",
        sourceUrl: "https://www.youtube.com/watch?v=question123",
        materialType: "video",
        sourceProvenance: "snapshot",
        createdAt: "2026-06-04T01:00:00.000Z",
        capturedAt: "2026-06-04T01:00:00.000Z",
        updatedAt: "2026-06-04T01:00:00.000Z",
        originClientId: beforeWorkspace.clientId,
        answersQuestionCaptureId: "",
        questionResolvedAt: null,
        questionParkedAt: null,
        promotedToReview: false
      }],
      reviewCards: []
    };
    importWorkspace(questionSession);
    document.querySelector('[data-tab="today"]').click();
    const answerButton = [...document.querySelectorAll(".question-card button")]
      .find((button) => button.textContent === "Answer");
    answerButton?.click();
    const answerPrefs = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}");
    const answerDraft = answerPrefs.captureDrafts?.[questionSession.id] || {};
    setValue("#thoughtInput", "Answer: the original source shows the invariant remains stable through the proof.");
    document.querySelector("#captureBtn").click();
    const committedAnswer = activeCapture();

    window.learningCompanionNative.importWorkspaceJson(beforeWorkspaceJson);
    document.querySelector('[data-tab="today"]').click();
    return {
      driftStatusBeforeSave,
      driftSaved,
      reanchorVisibleBeforeClick,
      reanchorStatusBeforeSave,
      reanchoredSaved,
      reverseDriftStatusBeforeSave,
      reverseDriftSaved,
      answerDraft,
      committedAnswer
    };
  })()`);
  assert.equal(result.driftStatusBeforeSave, "Source changed");
  assert.equal(result.driftSaved.sourceTitle, "Original source");
  assert.equal(result.driftSaved.sourceUrl, "https://www.youtube.com/watch?v=original123");
  assert.equal(result.driftSaved.materialType, "video");
  assert.equal(result.driftSaved.sourceProvenance, "snapshot");
  assert.equal(result.reanchorVisibleBeforeClick, true);
  assert.equal(result.reanchorStatusBeforeSave, "Draft saved");
  assert.equal(result.reanchoredSaved.sourceTitle, "Changed source");
  assert.equal(result.reanchoredSaved.sourceUrl, "https://example.com/changed-source");
  assert.equal(result.reanchoredSaved.materialType, "doc");
  assert.equal(result.reanchoredSaved.sourceProvenance, "snapshot");
  assert.equal(result.reverseDriftStatusBeforeSave, "Source changed");
  assert.equal(result.reverseDriftSaved.sourceTitle, "Original doc source");
  assert.equal(result.reverseDriftSaved.sourceUrl, "https://example.com/original-doc");
  assert.equal(result.reverseDriftSaved.materialType, "doc");
  assert.equal(result.reverseDriftSaved.sourceProvenance, "snapshot");
  assert.equal(result.answerDraft.sourceTitle, "Question original source");
  assert.equal(result.answerDraft.sourceUrl, "https://www.youtube.com/watch?v=question123");
  assert.equal(result.answerDraft.materialType, "video");
  assert.equal(result.answerDraft.answersQuestionCaptureId, "question_original_source");
  assert.equal(result.committedAnswer.sourceTitle, "Question original source");
  assert.equal(result.committedAnswer.sourceUrl, "https://www.youtube.com/watch?v=question123");
  assert.equal(result.committedAnswer.materialType, "video");
  assert.equal(result.committedAnswer.sourceProvenance, "snapshot");
  assert.equal(result.committedAnswer.answersQuestionCaptureId, "question_original_source");
}

async function assertReturnFilesImportModeGuard(cdp) {
  const result = await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const beforeWorkspaceJson = window.learningCompanionNative.exportWorkspaceJson();
    const beforeWorkspace = JSON.parse(beforeWorkspaceJson);
    const beforeTitle = beforeWorkspace.sessions.find((item) => item.id === beforeWorkspace.activeSessionId)?.title || "";
    const wrongWorkspace = {
      ...beforeWorkspace,
      sessions: beforeWorkspace.sessions.map((session) => session.id === beforeWorkspace.activeSessionId
        ? { ...session, title: "Wrong workspace through Return Files" }
        : session)
    };
    const input = document.querySelector("#importWorkspaceInput");
    const importFile = async (mode) => {
      if (mode) input.dataset.importMode = mode;
      else delete input.dataset.importMode;
      const transfer = new DataTransfer();
      transfer.items.add(new File([JSON.stringify(wrongWorkspace)], "workspace-return-mistake-single.json", { type: "application/json" }));
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(180);
      const workspace = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
      const active = workspace.sessions.find((item) => item.id === workspace.activeSessionId) || workspace.sessions[0] || {};
      return {
        title: active.title || "",
        receipt: document.querySelector("#importReceipt")?.textContent || "",
        receiptError: document.querySelector("#importReceipt")?.classList.contains("import-receipt-error") === true,
        modeAfter: input.dataset.importMode || "",
        inputValue: input.value
      };
    };
    const returnFiles = await importFile("return-files");
    const portable = await importFile("");
    window.learningCompanionNative.importWorkspaceJson(beforeWorkspaceJson);
    document.querySelector('[data-tab="today"]').click();
    return { beforeTitle, returnFiles, portable };
  })()`);
  assert.equal(result.returnFiles.title, result.beforeTitle);
  assert.match(result.returnFiles.receipt, /Return files imported/);
  assert.match(result.returnFiles.receipt, /0\/1 files processed/);
  assert.match(result.returnFiles.receipt, /1 failed/);
  assert.match(result.returnFiles.receipt, /workspace-return-mistake-single\.json/);
  assert.match(result.returnFiles.receipt, /Return Files import only accepts inbox or review return files/);
  assert.equal(result.returnFiles.receiptError, true);
  assert.equal(result.returnFiles.modeAfter, "");
  assert.equal(result.returnFiles.inputValue, "");
  assert.equal(result.portable.title, "Wrong workspace through Return Files");
  assert.equal(result.portable.modeAfter, "");
  assert.equal(result.portable.inputValue, "");
}

async function assertPasteReturnFileFromClipboard(cdp) {
  const pasteReturn = await cdp.evaluate(`(async () => {
    const beforeWorkspaceJson = window.learningCompanionNative.exportWorkspaceJson();
    const beforeWorkspace = JSON.parse(beforeWorkspaceJson);
    const targetSession = beforeWorkspace.sessions.find((item) => item.id === beforeWorkspace.activeSessionId)
      || beforeWorkspace.sessions[0];
    const setClipboard = (text) => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          readText: async () => text,
          writeText: async () => {}
        }
      });
    };
    const blockClipboard = () => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          readText: async () => { throw new Error("blocked by smoke"); },
          writeText: async () => {}
        }
      });
    };
    const clickPaste = async () => {
      document.querySelector('[data-return-files-step="paste"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 160));
      return document.querySelector("#importReceipt").textContent;
    };
    const inboxPatch = {
      schema: "learning-companion.mobile-inbox-patch.v1",
      appVersion: 1,
      patchId: "browser_clipboard_patch_001",
      createdAt: "2026-06-03T23:20:00+08:00",
      source: {
        generatedBy: "inbox.html",
        workspaceFingerprint: "browser-clipboard",
        topicId: targetSession.id,
        topicTitle: targetSession.title
      },
      target: {
        topicId: targetSession.id,
        topicTitle: targetSession.title
      },
      captures: [{
        id: "browser_clipboard_capture_001",
        quote: "Clipboard return file capture.",
        thought: "Paste Return File should import copied JSON without creating a download.",
        timestamp: "23:20",
        sourceTitle: "Clipboard return smoke",
        sourceUrl: "https://example.com/clipboard-return",
        materialType: "doc",
        tags: "clipboard return",
        capturedAt: "2026-06-03T23:20:30+08:00"
      }]
    };
    let result = {};
    try {
      document.querySelector('[data-tab="today"]').click();
      setClipboard(JSON.stringify(inboxPatch));
      await clickPaste();
      const replacementPatch = {
        ...inboxPatch,
        patchId: "browser_clipboard_patch_replacement",
        captures: [{
          ...inboxPatch.captures[0],
          id: "browser_clipboard_capture_replacement",
          thought: "Replacement paste should replace the pending preview, not stack it."
        }]
      };
      setClipboard(JSON.stringify(replacementPatch));
      await clickPaste();
      const replacedPreview = {
        cardCount: document.querySelectorAll(".return-file-preview-card").length,
        importedOriginal: JSON.parse(window.learningCompanionNative.exportWorkspaceJson()).importedPatches.includes("browser_clipboard_patch_001"),
        importedReplacement: JSON.parse(window.learningCompanionNative.exportWorkspaceJson()).importedPatches.includes("browser_clipboard_patch_replacement")
      };
      document.querySelector('[data-return-preview-action="discard"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 160));
      const discardedPreview = {
        cardCount: document.querySelectorAll(".return-file-preview-card").length,
        importedOriginal: JSON.parse(window.learningCompanionNative.exportWorkspaceJson()).importedPatches.includes("browser_clipboard_patch_001"),
        importedReplacement: JSON.parse(window.learningCompanionNative.exportWorkspaceJson()).importedPatches.includes("browser_clipboard_patch_replacement"),
        activityTitle: document.querySelector("#activityTitle")?.textContent || "",
        activityDetail: document.querySelector("#activityDetail")?.textContent || ""
      };
      setClipboard(JSON.stringify(inboxPatch));
      await clickPaste();
      const previewWorkspaceJson = window.learningCompanionNative.exportWorkspaceJson();
      const previewWorkspace = JSON.parse(previewWorkspaceJson);
      const previewSession = previewWorkspace.sessions.find((item) => item.id === previewWorkspace.activeSessionId);
      const previewPanel = document.querySelector(".return-file-preview-card");
      const stagedPreview = {
        text: previewPanel?.textContent || "",
        applyVisible: Boolean(previewPanel?.querySelector('[data-return-preview-action="apply"]')),
        discardVisible: Boolean(previewPanel?.querySelector('[data-return-preview-action="discard"]')),
        importReceiptHidden: document.querySelector("#importReceipt")?.hidden === true,
        captureAlreadyImported: Boolean(previewSession?.captures.find((capture) => capture.inboxPatchId === "browser_clipboard_patch_001")),
        importedPatchAlreadyRecorded: previewWorkspace.importedPatches.includes("browser_clipboard_patch_001"),
        activityTitle: document.querySelector("#activityTitle")?.textContent || "",
        activityDetail: document.querySelector("#activityDetail")?.textContent || ""
      };
      previewPanel?.querySelector('[data-return-preview-action="apply"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 180));
      const afterSuccessJson = window.learningCompanionNative.exportWorkspaceJson();
      const afterSuccess = JSON.parse(afterSuccessJson);
      const sessionAfterSuccess = afterSuccess.sessions.find((item) => item.id === afterSuccess.activeSessionId);
      const pastedCapture = sessionAfterSuccess?.captures.find((capture) => capture.inboxPatchId === "browser_clipboard_patch_001");
      const successReceipt = document.querySelector("#importReceipt").textContent;
      const successActivity = {
        title: document.querySelector("#activityTitle").textContent,
        detail: document.querySelector("#activityDetail").textContent
      };
      const successActionButton = document.querySelector("#importReceiptActionBtn");
      const successReceiptAction = {
        text: successActionButton?.textContent || "",
        hidden: successActionButton?.hidden === true,
        action: successActionButton?.dataset.importReceiptAction || "",
        aria: successActionButton?.getAttribute("aria-label") || ""
      };
      successActionButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 160));
      const returnedCaptureSelector = pastedCapture?.id ? '[data-capture-id="' + CSS.escape(pastedCapture.id) + '"]' : "";
      const successReceiptActionResult = {
        activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
        returnedCaptureVisible: Boolean(returnedCaptureSelector && document.querySelector(returnedCaptureSelector)),
        activityTitle: document.querySelector("#activityTitle")?.textContent || "",
        activityDetail: document.querySelector("#activityDetail")?.textContent || ""
      };
      document.querySelector('[data-tab="today"]').click();
      const successHandoff = document.querySelector(".handoff-card");
      setClipboard(beforeWorkspaceJson);
      const workspaceRejectionReceipt = await clickPaste();
      const afterRejected = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
      const sessionAfterRejected = afterRejected.sessions.find((item) => item.id === afterRejected.activeSessionId);
      setClipboard("{ broken clipboard json");
      const malformedReceipt = await clickPaste();
      setClipboard("   ");
      const emptyReceipt = await clickPaste();
      blockClipboard();
      const blockedReceipt = await clickPaste();
      const transfer = new DataTransfer();
      transfer.items.add(new File([beforeWorkspaceJson], "learning-companion-workspace.json", { type: "application/json" }));
      const importInput = document.querySelector("#importWorkspaceInput");
      importInput.files = transfer.files;
      importInput.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 160));
      const afterFileImport = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
      const fileImportedSession = afterFileImport.sessions.find((item) => item.id === afterFileImport.activeSessionId);
      result = {
        buttonTexts: [...document.querySelectorAll(".handoff-card button")].map((button) => button.textContent),
        actionGroups: [...document.querySelectorAll(".handoff-card .return-files-action-group")].map((group) => ({
          label: group.getAttribute("aria-label") || "",
          steps: [...group.querySelectorAll("button")].map((button) => button.dataset.returnFilesStep || "")
        })),
        success: {
          pastedQuote: pastedCapture?.quote || "",
          pastedThought: pastedCapture?.thought || "",
          importedPatch: afterSuccess.importedPatches.includes("browser_clipboard_patch_001"),
          replacedPreview,
          discardedPreview,
          preview: stagedPreview,
          receipt: successReceipt,
          activity: successActivity,
          receiptAction: successReceiptAction,
          receiptActionResult: successReceiptActionResult,
          handoffOpen: successHandoff?.open === true
        },
        rejection: {
          workspaceReceipt: workspaceRejectionReceipt,
          malformedReceipt,
          emptyReceipt,
          blockedReceipt,
          pastedCaptureStillPresent: Boolean(sessionAfterRejected?.captures.find((capture) => capture.inboxPatchId === "browser_clipboard_patch_001")),
          importedPatchStillPresent: afterRejected.importedPatches.includes("browser_clipboard_patch_001"),
          captureCountUnchanged: sessionAfterRejected?.captures.length === sessionAfterSuccess?.captures.length
        },
        fileWorkspaceImport: {
          schema: afterFileImport.schema,
          sessions: afterFileImport.sessions.length,
          activeTitle: fileImportedSession?.title || "",
          importedPatchRemoved: !afterFileImport.importedPatches.includes("browser_clipboard_patch_001")
        }
      };
    } finally {
      window.learningCompanionNative.importWorkspaceJson(beforeWorkspaceJson);
    }
    return result;
  })()`, 15000);

  assert.deepEqual(pasteReturn.buttonTexts, ["Export Updated Mirror", "Import Return Files", "Paste Return File"]);
  assert.deepEqual(pasteReturn.actionGroups, [
    { label: "Send mirror out", steps: ["export"] },
    { label: "Bring return files back", steps: ["import", "paste"] }
  ]);
  assert.equal(pasteReturn.success.pastedQuote, "Clipboard return file capture.");
  assert.equal(pasteReturn.success.pastedThought, "Paste Return File should import copied JSON without creating a download.");
  assert.equal(pasteReturn.success.importedPatch, true);
  assert.deepEqual(pasteReturn.success.replacedPreview, {
    cardCount: 1,
    importedOriginal: false,
    importedReplacement: false
  });
  assert.deepEqual(pasteReturn.success.discardedPreview, {
    cardCount: 0,
    importedOriginal: false,
    importedReplacement: false,
    activityTitle: "Return file discarded",
    activityDetail: "No workspace changes were applied."
  });
  assert.match(pasteReturn.success.preview.text, /Ready to apply/);
  assert.match(pasteReturn.success.preview.text, /1 returned capture ready/);
  assert.match(pasteReturn.success.preview.text, /1\/1 files parsed/);
  assert.match(pasteReturn.success.preview.text, /inbox \+1 capture, 0 duplicates/);
  assert.match(pasteReturn.success.preview.text, /would change workspace/);
  assert.equal(pasteReturn.success.preview.applyVisible, true);
  assert.equal(pasteReturn.success.preview.discardVisible, true);
  assert.equal(pasteReturn.success.preview.importReceiptHidden, true);
  assert.equal(pasteReturn.success.preview.captureAlreadyImported, false);
  assert.equal(pasteReturn.success.preview.importedPatchAlreadyRecorded, false);
  assert.equal(pasteReturn.success.preview.activityTitle, "Return file ready");
  assert.match(pasteReturn.success.preview.activityDetail, /would change workspace/);
  assert.match(pasteReturn.success.receipt, /Mobile inbox imported/);
  assert.match(pasteReturn.success.receipt, /1 added/);
  assert.equal(pasteReturn.success.activity.title, "Mobile inbox imported");
  assert.match(pasteReturn.success.activity.detail, /1 added/);
  assert.deepEqual(pasteReturn.success.receiptAction, {
    text: "View latest capture",
    hidden: false,
    action: "returned-capture",
    aria: "Open captures returned from phone or Windows"
  });
  assert.equal(pasteReturn.success.receiptActionResult.activeTab, "captures");
  assert.equal(pasteReturn.success.receiptActionResult.returnedCaptureVisible, true);
  assert.equal(pasteReturn.success.receiptActionResult.activityTitle, "Capture selected");
  assert.match(pasteReturn.success.receiptActionResult.activityDetail, /Paste Return File should import copied JSON/);
  assert.equal(pasteReturn.success.handoffOpen, true);
  assert.match(pasteReturn.rejection.workspaceReceipt, /clipboard: Clipboard does not contain an inbox or review return file/);
  assert.match(pasteReturn.rejection.workspaceReceipt, /Use Import Return Files for full workspace files/);
  assert.match(pasteReturn.rejection.malformedReceipt, /clipboard: Clipboard text is not valid JSON/);
  assert.match(pasteReturn.rejection.emptyReceipt, /clipboard: Clipboard is empty/);
  assert.match(pasteReturn.rejection.blockedReceipt, /clipboard: Clipboard permission blocked/);
  assert.equal(pasteReturn.rejection.pastedCaptureStillPresent, true);
  assert.equal(pasteReturn.rejection.importedPatchStillPresent, true);
  assert.equal(pasteReturn.rejection.captureCountUnchanged, true);
  assert.equal(pasteReturn.fileWorkspaceImport.schema, "learning-companion.workspace.v1");
  assert.ok(pasteReturn.fileWorkspaceImport.sessions >= 1);
  assert.equal(pasteReturn.fileWorkspaceImport.activeTitle.length > 0, true);
  assert.equal(pasteReturn.fileWorkspaceImport.importedPatchRemoved, true);
}

async function assertFirstCaptureLoopDecision(cdp) {
  const result = await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const readActivity = () => ({
      title: document.querySelector("#activityTitle")?.textContent || "",
      detail: document.querySelector("#activityDetail")?.textContent || "",
      action: document.querySelector("#activityDetailsBtn")?.textContent || "",
      actionAria: document.querySelector("#activityDetailsBtn")?.getAttribute("aria-label") || "",
      hintHidden: document.querySelector("#activityHint")?.hidden !== false,
      hintKind: document.querySelector("#activityHint")?.dataset.nextStepHint || "",
      hintText: document.querySelector("#activityHintText")?.textContent || "",
      hintAction: document.querySelector("#activityHintBtn")?.textContent || "",
      hintAria: document.querySelector("#activityHintBtn")?.getAttribute("aria-label") || "",
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activeElement: document.activeElement?.id || ""
    });
    const before = window.learningCompanionNative.exportWorkspaceJson();
    const workspace = JSON.parse(before);
    const session = {
      ...workspace.sessions[0],
      id: "first_capture_loop_decision",
      title: "First capture loop decision",
      sourceTitle: "Decision source",
      sourceUrl: "https://example.com/decision-source",
      materialType: "article",
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
    setValue("#quoteInput", "First capture needs a durable next step.");
    setValue("#thoughtInput", "This should not count as a closed loop yet.");
    document.querySelector("#captureBtn").click();
    document.querySelector('[data-tab="today"]').click();
    const loopStep = document.querySelector('[data-learning-flow-step="loop"]');
    const nextMove = document.querySelector(".today-path-card");
    const beforeAction = {
      loopText: loopStep?.textContent || "",
      loopAction: loopStep?.querySelector("button")?.textContent || "",
      loopTone: loopStep?.className || "",
      nextMoveText: nextMove?.textContent || "",
      nextMoveAction: nextMove?.querySelector("[data-today-path-action]")?.textContent || "",
      nextMoveKind: nextMove?.querySelector("[data-today-path-action]")?.dataset.todayPathAction || ""
    };
    loopStep?.querySelector("button")?.click();
    const detailCard = [...document.querySelectorAll("#captureList .item-card")]
      .find((item) => item.textContent.includes("This should not count as a closed loop yet."));
    const afterAction = {
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      captureVisible: Boolean(detailCard),
      detailNeedsDecision: detailCard?.classList.contains("needs-durable-decision") === true,
      decisionGuide: detailCard?.querySelector("[data-capture-decision-guide]")?.textContent || "",
      decisionButtons: [...(detailCard?.querySelectorAll(".capture-decision-button") || [])].map((button) => ({
        label: button.textContent,
        title: button.title,
        aria: button.getAttribute("aria-label") || ""
      }))
    };
    [...(detailCard?.querySelectorAll("button") || [])]
      .find((button) => button.textContent === "Add to notes")
      ?.click();
    const noteAddedActivity = readActivity();
    let noteResumeHref = "";
    let noteResumeTarget = "";
    let noteResumeFeatures = "";
    const nativeWindowOpen = window.open;
    window.open = (href, target, features) => {
      noteResumeHref = href;
      noteResumeTarget = target || "";
      noteResumeFeatures = features || "";
      return null;
    };
    document.querySelector("#activityDetailsBtn")?.click();
    window.open = nativeWindowOpen;
    const noteResumeActivity = readActivity();
    const noteResumeState = {
      opened: noteResumeHref,
      target: noteResumeTarget,
      features: noteResumeFeatures,
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      action: document.querySelector("#activityDetailsBtn")?.textContent || "",
      capturePanePulsed: document.querySelector("#capturePane")?.classList.contains("pulse") === true
    };
    document.querySelector('[data-tab="today"]').click();
    const afterNotesLoopStep = document.querySelector('[data-learning-flow-step="loop"]');
    const afterNotes = {
      loopText: afterNotesLoopStep?.textContent || "",
      loopAction: afterNotesLoopStep?.querySelector("button")?.textContent || "",
      loopTone: afterNotesLoopStep?.className || ""
    };
    const timedWorkspace = JSON.parse(before);
    const timedSession = {
      ...timedWorkspace.sessions[0],
      id: "timed_note_resume",
      title: "Timed note resume",
      sourceTitle: "Timed lesson",
      sourceUrl: "https://www.youtube.com/watch?v=note123",
      materialType: "video",
      notesMarkdown: "",
      reviewCards: [],
      focusMode: "capture",
      captures: [
        {
          id: "timed_note_capture",
          quote: "A timestamped source should resume from its saved moment.",
          thought: "Timed notes should not fall back to a generic source hint.",
          timestamp: "03:21",
          sourceTitle: "Timed lesson",
          sourceUrl: "https://www.youtube.com/watch?v=note123",
          materialType: "video",
          createdAt: "2026-06-04T10:20:00.000Z",
          capturedAt: "2026-06-04T10:20:00.000Z",
          updatedAt: "2026-06-04T10:20:00.000Z"
        }
      ]
    };
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify({
      ...timedWorkspace,
      activeSessionId: timedSession.id,
      sessions: [timedSession],
      importedPatches: [],
      importedReviewPatches: []
    }));
    document.querySelector('[data-tab="captures"]').click();
    const timedRow = document.querySelector('[data-stack-capture-id="timed_note_capture"]');
    [...(timedRow?.querySelectorAll("button") || [])]
      .find((button) => button.textContent === "Add to notes")
      ?.click();
    const timedNoteActivity = readActivity();
    let timedNoteHref = "";
    const nativeTimedWindowOpen = window.open;
    window.open = (href) => {
      timedNoteHref = href;
      return null;
    };
    document.querySelector("#activityDetailsBtn")?.click();
    window.open = nativeTimedWindowOpen;
    const timedNoteResume = readActivity();
    const timedNoteState = {
      opened: timedNoteHref,
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activeElement: document.activeElement?.id || ""
    };
    const takeawayWorkspace = JSON.parse(before);
    const takeawaySession = {
      ...takeawayWorkspace.sessions[0],
      id: "takeaway_loop_decision",
      title: "Takeaway loop decision",
      sourceTitle: "Decision source",
      sourceUrl: "https://example.com/decision-source",
      materialType: "article",
      notesMarkdown: "",
      captures: [],
      reviewCards: [],
      focusMode: "capture"
    };
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify({
      ...takeawayWorkspace,
      activeSessionId: takeawaySession.id,
      sessions: [takeawaySession],
      importedPatches: [],
      importedReviewPatches: []
    }));
    setValue("#quoteInput", "");
    setValue("#thoughtInput", "Takeaway: This should remain synthesis support.");
    document.querySelector("#captureBtn").click();
    document.querySelector('[data-tab="today"]').click();
    const takeawayLoopStep = document.querySelector('[data-learning-flow-step="loop"]');
    const takeawayLoop = {
      loopText: takeawayLoopStep?.textContent || "",
      loopAction: takeawayLoopStep?.querySelector("button")?.textContent || "",
      loopTone: takeawayLoopStep?.className || ""
    };
    const supportLoopState = (id, title, quote, thought) => {
      const supportWorkspace = JSON.parse(before);
      const supportSession = {
        ...supportWorkspace.sessions[0],
        id,
        title,
        sourceTitle: "Decision source",
        sourceUrl: "https://example.com/decision-source",
        materialType: "article",
        notesMarkdown: "",
        captures: [],
        reviewCards: [],
        focusMode: "capture"
      };
      window.learningCompanionNative.importWorkspaceJson(JSON.stringify({
        ...supportWorkspace,
        activeSessionId: supportSession.id,
        sessions: [supportSession],
        importedPatches: [],
        importedReviewPatches: []
      }));
      setValue("#quoteInput", quote);
      setValue("#thoughtInput", thought);
      document.querySelector("#captureBtn").click();
      document.querySelector('[data-tab="today"]').click();
      const step = document.querySelector('[data-learning-flow-step="loop"]');
      const detailCard = [...document.querySelectorAll("#captureList .item-card")]
        .find((item) => item.textContent.includes(quote || thought));
      const stackRow = document.querySelector("#captureStack .capture-stack-row");
      return {
        loopText: step?.textContent || "",
        loopAction: step?.querySelector("button")?.textContent || "",
        loopTone: step?.className || "",
        detailNeedsDecision: detailCard?.classList.contains("needs-durable-decision") === true,
        stackNeedsDecision: stackRow?.classList.contains("needs-durable-decision") === true
      };
    };
    const quoteOnlyLoop = supportLoopState(
      "quote_only_loop_decision",
      "Quote-only loop decision",
      "A highlighted line should wait for a thought before durable routing.",
      ""
    );
    const answerOnlyLoop = supportLoopState(
      "answer_only_loop_decision",
      "Answer-only loop decision",
      "",
      "Answer: This unlinked answer is useful but should not force Notes or Review."
    );
    const mixedWorkspace = JSON.parse(before);
    const mixedSession = {
      ...mixedWorkspace.sessions[0],
      id: "parked_before_capture_decision",
      title: "Parked before capture decision",
      sourceTitle: "Priority source",
      sourceUrl: "https://example.com/priority-source",
      materialType: "article",
      notesMarkdown: "",
      reviewCards: [],
      focusMode: "capture",
      captures: [
        {
          id: "parked_priority_question",
          quote: "",
          thought: "Question: Which proof step should wait until later?",
          timestamp: "",
          sourceTitle: "Priority source",
          sourceUrl: "https://example.com/priority-source",
          materialType: "article",
          createdAt: "2026-06-04T10:00:00.000Z",
          capturedAt: "2026-06-04T10:00:00.000Z",
          updatedAt: "2026-06-04T10:01:00.000Z",
          questionResolvedAt: null,
          questionParkedAt: "2026-06-04T10:02:00.000Z"
        },
        {
          id: "latest_ordinary_capture_decision",
          quote: "A newer ordinary capture still needs durable routing.",
          thought: "This newer capture should wait behind the parked question.",
          timestamp: "",
          sourceTitle: "Priority source",
          sourceUrl: "https://example.com/priority-source",
          materialType: "article",
          createdAt: "2026-06-04T10:05:00.000Z",
          capturedAt: "2026-06-04T10:05:00.000Z",
          updatedAt: "2026-06-04T10:05:00.000Z",
          questionResolvedAt: null,
          questionParkedAt: null
        }
      ]
    };
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify({
      ...mixedWorkspace,
      activeSessionId: mixedSession.id,
      sessions: [mixedSession],
      importedPatches: [],
      importedReviewPatches: []
    }));
    document.querySelector('[data-tab="today"]').click();
    const mixedLoopStep = document.querySelector('[data-learning-flow-step="loop"]');
    const mixedNextMove = document.querySelector(".today-path-card");
    const mixedPriority = {
      loopText: mixedLoopStep?.textContent || "",
      loopAction: mixedLoopStep?.querySelector("button")?.textContent || "",
      loopTone: mixedLoopStep?.className || "",
      nextMoveText: mixedNextMove?.textContent || "",
      nextMoveAction: mixedNextMove?.querySelector("[data-today-path-action]")?.textContent || "",
      nextMoveKind: mixedNextMove?.querySelector("[data-today-path-action]")?.dataset.todayPathAction || "",
      parkedSectionText: document.querySelector("[data-today-section='parked_questions']")?.textContent || "",
      parkedCardText: document.querySelector(".parked-question-card")?.textContent || "",
      latestCaptureNeedsDecision: document
        .querySelector('[data-stack-capture-id="latest_ordinary_capture_decision"]')
        ?.classList.contains("needs-durable-decision") === true
    };
    window.learningCompanionNative.importWorkspaceJson(before);
    return { beforeAction, afterAction, noteAddedActivity, noteResumeActivity, noteResumeState, afterNotes, timedNoteActivity, timedNoteResume, timedNoteState, takeawayLoop, quoteOnlyLoop, answerOnlyLoop, mixedPriority };
  })()`);
  assert.match(result.beforeAction.loopText, /Close the loop/);
  assert.match(result.beforeAction.loopText, /Needs next step/);
  assert.match(result.beforeAction.loopText, /choose whether the latest capture belongs in Notes or Review/);
  assert.equal(result.beforeAction.loopAction, "Choose next");
  assert.match(result.beforeAction.loopTone, /is-capture/);
  assert.match(result.beforeAction.nextMoveText, /Choose latest capture's next step/);
  assert.match(result.beforeAction.nextMoveText, /choose Notes or Review/);
  assert.equal(result.beforeAction.nextMoveAction, "Choose next");
  assert.equal(result.beforeAction.nextMoveKind, "recent");
  assert.deepEqual(result.afterAction, {
    activeTab: "captures",
    captureVisible: true,
    detailNeedsDecision: true,
    decisionGuide: "Notes: connect ideas · Recall: remember later",
    decisionButtons: [
      {
        label: "Add to notes",
        title: "Add this capture to Notes for synthesis",
        aria: "Add this capture to Notes"
      },
      {
        label: "Save for recall",
        title: "Save this capture to recall later",
        aria: "Save this capture to recall later"
      }
    ]
  });
  assert.equal(result.noteAddedActivity.title, "Capture added to notes");
  assert.equal(result.noteAddedActivity.action, "Open at quote");
  assert.equal(result.noteAddedActivity.actionAria, "Open at quote in a new tab; Quick Capture stays ready");
  assert.equal(result.noteAddedActivity.hintHidden, false);
  assert.equal(result.noteAddedActivity.hintKind, "afterNoteAddedViewNote");
  assert.equal(result.noteAddedActivity.hintAction, "View note");
  assert.equal(result.noteAddedActivity.hintAria, "View this capture in Notes");
  assert.equal(result.noteResumeActivity.title, "Source resumed");
  assert.equal(result.noteResumeActivity.action, "Focus field");
  assert.equal(result.noteResumeActivity.actionAria, "Focus Quick Capture");
  assert.equal(result.noteResumeActivity.hintHidden, false);
  assert.equal(result.noteResumeActivity.hintKind, "afterNoteAddedViewNote");
  assert.equal(result.noteResumeActivity.hintAction, "View note");
  assert.match(result.noteResumeActivity.detail, /The note is saved\. Keep reading; capture the next point when it lands/);
  assert.deepEqual(result.noteResumeState, {
    opened: "https://example.com/decision-source#:~:text=First%20capture%20needs%20a%20durable%20next%20step.",
    target: "_blank",
    features: "noopener,noreferrer",
    activeTab: "captures",
    action: "Focus field",
    capturePanePulsed: true
  });
  assert.equal(result.timedNoteActivity.title, "Capture added to notes");
  assert.equal(result.timedNoteActivity.action, "Resume source");
  assert.equal(result.timedNoteActivity.actionAria, "Resume source in a new tab; Quick Capture stays ready");
  assert.equal(result.timedNoteActivity.hintHidden, false);
  assert.equal(result.timedNoteActivity.hintKind, "afterNoteAddedViewNote");
  assert.equal(result.timedNoteActivity.hintAction, "View note");
  assert.equal(result.timedNoteActivity.hintAria, "View this capture in Notes");
  assert.equal(result.timedNoteResume.title, "Source resumed");
  assert.equal(result.timedNoteResume.action, "Focus field");
  assert.equal(result.timedNoteResume.hintHidden, false);
  assert.equal(result.timedNoteResume.hintKind, "afterNoteAddedViewNote");
  assert.deepEqual(result.timedNoteState, {
    opened: "https://www.youtube.com/watch?v=note123&t=201s",
    activeTab: "captures",
    activeElement: "thoughtInput"
  });
  assert.match(result.afterNotes.loopText, /Close the loop/);
  assert.match(result.afterNotes.loopText, /Clear/);
  assert.doesNotMatch(result.afterNotes.loopText, /Needs next step/);
  assert.equal(result.afterNotes.loopAction, "Inspect");
  assert.match(result.afterNotes.loopTone, /is-clear/);
  assert.match(result.takeawayLoop.loopText, /Close the loop/);
  assert.match(result.takeawayLoop.loopText, /Clear/);
  assert.doesNotMatch(result.takeawayLoop.loopText, /Needs next step/);
  assert.equal(result.takeawayLoop.loopAction, "Inspect");
  assert.match(result.takeawayLoop.loopTone, /is-clear/);
  for (const supportLoop of [result.quoteOnlyLoop, result.answerOnlyLoop]) {
    assert.match(supportLoop.loopText, /Close the loop/);
    assert.match(supportLoop.loopText, /Clear/);
    assert.doesNotMatch(supportLoop.loopText, /Needs next step/);
    assert.equal(supportLoop.loopAction, "Inspect");
    assert.match(supportLoop.loopTone, /is-clear/);
    assert.equal(supportLoop.detailNeedsDecision, false);
    assert.equal(supportLoop.stackNeedsDecision, false);
  }
  assert.match(result.mixedPriority.loopText, /Close the loop/);
  assert.match(result.mixedPriority.loopText, /1 parked/);
  assert.doesNotMatch(result.mixedPriority.loopText, /Needs next step/);
  assert.equal(result.mixedPriority.loopAction, "Resume");
  assert.match(result.mixedPriority.loopTone, /is-parked/);
  assert.match(result.mixedPriority.nextMoveText, /Resume 1 saved question/);
  assert.match(result.mixedPriority.nextMoveText, /Which proof step should wait until later/);
  assert.equal(result.mixedPriority.nextMoveAction, "Resume");
  assert.equal(result.mixedPriority.nextMoveKind, "parked");
  assert.match(result.mixedPriority.parkedSectionText, /Parked Questions/);
  assert.match(result.mixedPriority.parkedCardText, /Which proof step should wait until later/);
  assert.equal(result.mixedPriority.latestCaptureNeedsDecision, true);
}

async function assertPostSaveFlow(cdp) {
  const postSaveFlow = await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const readActivity = () => {
      const hint = document.querySelector("#activityHint");
      const hintButton = document.querySelector("#activityHintBtn");
      return {
        title: document.querySelector("#activityTitle").textContent,
        detail: document.querySelector("#activityDetail").textContent,
        action: document.querySelector("#activityDetailsBtn").textContent,
        aria: document.querySelector("#activityDetailsBtn").getAttribute("aria-label") || "",
        targetId: document.querySelector("#activityDetailsBtn").dataset.activityTargetId || "",
        activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
        hintHidden: hint?.hidden !== false,
        hintKind: hint?.dataset.nextStepHint || "",
        hintText: document.querySelector("#activityHintText")?.textContent || "",
        hintAction: hintButton?.textContent || "",
        hintAria: hintButton?.getAttribute("aria-label") || "",
        hintParentClass: hint?.parentElement?.className || "",
        activeElement: document.activeElement?.id || ""
      };
    };
    const openQuestionButton = () => {
      const questionCard = [...document.querySelectorAll(".question-card")]
        .find((card) => card.textContent.includes("Why does ownership matter?"));
      return [...(questionCard?.querySelectorAll("button") || [])]
        .find((button) => button.textContent === "Answer");
    };
    document.querySelector('[data-focus-mode="capture"]')?.click();
    setValue("#sourceTitle", "Post-save flow fixture");
    setValue("#sourceUrl", "https://example.com/post-save-flow");
    setValue("#materialType", "article");
    setValue("#timestampInput", "");
    setValue("#quoteInput", "");
    setValue("#thoughtInput", "Question: Why does ownership matter?");
    document.querySelector("#captureBtn").click();
    const questionSaved = readActivity();
    const questionSavedCaptureId = (() => {
      const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
      const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
      return session?.captures.find((capture) => capture.thought === "Question: Why does ownership matter?")?.id || "";
    })();
    document.querySelector("#activityDetailsBtn").click();
    const questionDetails = {
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      drawerOpen: document.querySelector("[data-today-detail-drawer='study_details']")?.open === true,
      openQuestionText: document.querySelector("[data-today-section='open_questions']")?.textContent || "",
      openQuestionPulsed: document.querySelector("[data-today-section='open_questions']")?.classList.contains("pulse") === true
    };
    let questionResumeHref = "";
    let questionResumeTarget = "";
    let questionResumeFeatures = "";
    const nativeQuestionWindowOpen = window.open;
    window.open = (href, target, features) => {
      questionResumeHref = href;
      questionResumeTarget = target || "";
      questionResumeFeatures = features || "";
      return null;
    };
    document.querySelector("#activityHintBtn").click();
    window.open = nativeQuestionWindowOpen;
    const questionHintResume = readActivity();
    const questionHintResumeState = {
      opened: questionResumeHref,
      target: questionResumeTarget,
      features: questionResumeFeatures,
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activeElement: document.activeElement?.id || "",
      capturePanePulsed: document.querySelector("#capturePane")?.classList.contains("pulse") === true
    };
    document.querySelector("#activityHintBtn").click();
    const questionAnswerDraft = readActivity();
    const questionAnswerDraftState = (() => {
      const prefs = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}");
      const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
      const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
      const draft = prefs.captureDrafts?.[session?.id || ""] || {};
      return {
        activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
        activeElement: document.activeElement?.id || "",
        thoughtValue: document.querySelector("#thoughtInput")?.value || "",
        draftTarget: draft.answersQuestionCaptureId || "",
        draftQuote: draft.quote || "",
        draftSourceTitle: draft.sourceTitle || "",
        capturePanePulsed: document.querySelector("#capturePane")?.classList.contains("pulse") === true
      };
    })();
    openQuestionButton()?.click();
    setValue("#thoughtInput", "Answer: Ownership matters because the compiler can prove a single owner controls mutation.");
    document.querySelector("#captureBtn").click();
    const linkedAnswerSaved = readActivity();
    const linkedQuestionState = (() => {
      const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
      const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
      const question = session?.captures.find((capture) => capture.thought === "Question: Why does ownership matter?");
      return {
        resolved: Boolean(question?.questionResolvedAt),
        parked: Boolean(question?.questionParkedAt)
      };
    })();
    document.querySelector("#activityDetailsBtn").click();
    const linkedAnswerDetails = {
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      drawerOpen: document.querySelector("[data-today-detail-drawer='study_details']")?.open === true,
      closedQuestionText: document.querySelector("[data-today-section='closed_questions']")?.textContent || "",
      closedQuestionPulsed: document.querySelector("[data-today-section='closed_questions']")?.classList.contains("pulse") === true
    };
    const linkedAnswerWorkspace = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    const linkedAnswerSourceRemoved = {
      ...linkedAnswerWorkspace,
      sessions: linkedAnswerWorkspace.sessions.map((session) => session.id === linkedAnswerWorkspace.activeSessionId
        ? {
          ...session,
          sourceTitle: "",
          sourceUrl: "",
          captures: session.captures.map((capture) => /Ownership matters because/.test(capture.thought || "")
            ? { ...capture, sourceTitle: "", sourceUrl: "" }
            : capture)
        }
        : session)
    };
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify(linkedAnswerSourceRemoved));
    const linkedAnswerMissingSource = readActivity();
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify(linkedAnswerWorkspace));
    let linkedAnswerResumeHref = "";
    const nativeLinkedAnswerWindowOpen = window.open;
    window.open = (href, target, features) => {
      linkedAnswerResumeHref = href;
      return { target, features };
    };
    document.querySelector("#activityHintBtn").click();
    window.open = nativeLinkedAnswerWindowOpen;
    const linkedAnswerHintResume = readActivity();
    const linkedAnswerHintResumeState = {
      opened: linkedAnswerResumeHref,
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activeElement: document.activeElement?.id || "",
      capturePanePulsed: document.querySelector("#capturePane")?.classList.contains("pulse") === true
    };
    setValue("#quoteInput", "");
    setValue("#thoughtInput", "Answer: This unlinked answer is useful but does not close a question.");
    document.querySelector("#captureBtn").click();
    const unlinkedAnswerSaved = readActivity();
    document.querySelector("#activityDetailsBtn").click();
    const unlinkedAnswerDetails = {
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      drawerOpen: document.querySelector("[data-today-detail-drawer='study_details']")?.open === true,
      answersText: document.querySelector("[data-today-section='answers_today']")?.textContent || "",
      answersPulsed: document.querySelector("[data-today-section='answers_today']")?.classList.contains("pulse") === true
    };
    document.querySelector("#newSessionBtn").click();
    setValue("#sessionTitle", "Card refresh after answer");
    setValue("#sourceTitle", "Card refresh source");
    setValue("#sourceUrl", "https://example.com/card-refresh-source");
    setValue("#quoteInput", "");
    setValue("#thoughtInput", "Question: Which answer should refresh this review card?");
    document.querySelector("#captureBtn").click();
    const cardRefreshQuestionId = (() => {
      const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
      const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
      return session?.captures.find((capture) => /refresh this review card/.test(capture.thought || ""))?.id || "";
    })();
    document.querySelector("#activityDetailsBtn").click();
    const cardRefreshQuestionCard = [...document.querySelectorAll("#todayList .question-card")]
      .find((card) => /refresh this review card/.test(card.textContent || ""));
    [...(cardRefreshQuestionCard?.querySelectorAll("button") || [])]
      .find((button) => button.textContent === "Save for recall")
      ?.click();
    const cardRefreshWorkspaceWithStaleEvidence = (() => {
      const workspace = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
      return {
        ...workspace,
        sessions: workspace.sessions.map((session) => session.id === workspace.activeSessionId
          ? {
            ...session,
            reviewCards: session.reviewCards.map((card) => card.sourceCaptureId === cardRefreshQuestionId
              ? { ...card, evidenceCaptureId: cardRefreshQuestionId }
              : card)
          }
          : session)
      };
    })();
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify(cardRefreshWorkspaceWithStaleEvidence));
    document.querySelector('[data-tab="today"]').click();
    const cardRefreshOpenQuestion = [...document.querySelectorAll("#todayList .question-card:not(.closed-question-card):not(.parked-question-card)")]
      .find((card) => /refresh this review card/.test(card.textContent || ""));
    [...(cardRefreshOpenQuestion?.querySelectorAll("button") || [])]
      .find((button) => button.textContent === "Answer")
      ?.click();
    setValue("#thoughtInput", "Answer: This linked answer is the evidence that should refresh the card.");
    document.querySelector("#captureBtn").click();
    const cardedLinkedAnswerSaved = readActivity();
    const cardedLinkedAnswerState = (() => {
      const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
      const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
      const answer = session?.captures.find((capture) => /evidence that should refresh/.test(capture.thought || ""));
      const card = session?.reviewCards.find((item) => item.sourceCaptureId === cardRefreshQuestionId);
      return {
        answerId: answer?.id || "",
        questionId: cardRefreshQuestionId,
        cardEvidenceBefore: card?.evidenceCaptureId || ""
      };
    })();
    const cardedLinkedAnswerWorkspace = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    document.querySelector("#activityDetailsBtn").click();
    const cardedLinkedAnswerClosedToday = (() => {
      const card = [...document.querySelectorAll("#todayList .closed-question-card")]
        .find((item) => /refresh this review card/.test(item.textContent || ""));
      const buttons = [...(card?.querySelectorAll("button") || [])]
        .map((button) => ({ text: button.textContent, disabled: button.disabled === true }));
      return {
        activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
        closedCardFound: Boolean(card),
        refreshButton: buttons.find((button) => button.text === "Refresh card") || null,
        buttons
      };
    })();
    const cardedLinkedAnswerCardRemovedWorkspace = {
      ...cardedLinkedAnswerWorkspace,
      sessions: cardedLinkedAnswerWorkspace.sessions.map((session) => ({
        ...session,
        reviewCards: session.reviewCards.filter((card) => card.sourceCaptureId !== cardRefreshQuestionId)
      }))
    };
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify(cardedLinkedAnswerCardRemovedWorkspace));
    const cardedLinkedAnswerCardRemoved = readActivity();
    const cardedLinkedAnswerCardRemovedState = (() => {
      const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
      const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
      return {
        activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
        reviewCardStillPresent: session?.reviewCards.some((card) => card.sourceCaptureId === cardRefreshQuestionId) === true
      };
    })();
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify(cardedLinkedAnswerWorkspace));
    const cardedLinkedAnswerRestored = readActivity();
    document.querySelector("#activityHintBtn").click();
    const cardedLinkedAnswerRefresh = readActivity();
    const cardedLinkedAnswerRefreshState = (() => {
      const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
      const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
      const card = session?.reviewCards.find((item) => item.sourceCaptureId === cardRefreshQuestionId);
      return {
        activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
        activeReviewCard: Boolean(document.querySelector("#reviewList .active-review-card")),
        cardEvidenceAfter: card?.evidenceCaptureId || "",
        answerId: cardedLinkedAnswerState.answerId
      };
    })();
    let cardedLinkedAnswerPostRefreshResumeHref = "";
    let cardedLinkedAnswerPostRefreshResumeTarget = "";
    let cardedLinkedAnswerPostRefreshResumeFeatures = "";
    const nativeCardedRefreshWindowOpen = window.open;
    window.open = (href, target, features) => {
      cardedLinkedAnswerPostRefreshResumeHref = href;
      cardedLinkedAnswerPostRefreshResumeTarget = target;
      cardedLinkedAnswerPostRefreshResumeFeatures = features;
      return { target, features };
    };
    document.querySelector("#activityHintBtn").click();
    window.open = nativeCardedRefreshWindowOpen;
    const cardedLinkedAnswerPostRefreshResume = readActivity();
    const cardedLinkedAnswerPostRefreshResumeState = {
      opened: cardedLinkedAnswerPostRefreshResumeHref,
      target: cardedLinkedAnswerPostRefreshResumeTarget,
      features: cardedLinkedAnswerPostRefreshResumeFeatures,
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activeElement: document.activeElement?.id || "",
      capturePanePulsed: document.querySelector("#capturePane")?.classList.contains("pulse") === true
    };
    document.querySelector('[data-tab="captures"]').click();
    setValue("#sourceTitle", "Post-save flow fixture");
    setValue("#sourceUrl", "https://example.com/post-save-flow");
    setValue("#quoteInput", "");
    setValue("#thoughtInput", "Takeaway: Ownership makes the reader check aliasing before mutation.");
    document.querySelector("#captureBtn").click();
    const takeawaySaved = readActivity();
    setValue("#quoteInput", "This earlier sentence is another quote-only highlight.");
    setValue("#thoughtInput", "");
    document.querySelector("#captureBtn").click();
    setValue("#quoteInput", "This sentence is worth keeping as a highlight.");
    setValue("#thoughtInput", "");
    document.querySelector("#captureBtn").click();
    const highlightSaved = readActivity();
    const highlightBefore = (() => {
      const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
      const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
      const row = document.querySelector("#captureStack .capture-stack-row");
      return {
        count: session.captures.length,
        id: session.captures[0]?.id || "",
        previousId: session.captures[1]?.id || "",
        quote: session.captures[0]?.quote || "",
        stackNextKind: row?.dataset.stackNextStep || "",
        stackNextText: row?.querySelector(".capture-stack-next")?.textContent || ""
      };
    })();
    const highlightStackBefore = {
      kind: highlightBefore.stackNextKind,
      text: highlightBefore.stackNextText
    };
    document.querySelector("#activityDetailsBtn").click();
    const highlightActivityAnnotation = {
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      detailsFormVisible: document.querySelector('.highlight-annotation-form[data-highlight-annotation-context="details"]')?.dataset.highlightAnnotationId === highlightBefore.id,
      focused: document.activeElement?.classList.contains("highlight-annotation-input") === true
    };
    const addThoughtButtonFor = (captureId) => [...document.querySelectorAll("#captureStack .capture-stack-row button")]
      .find((button) => button.textContent === "Add thought" && button.dataset.highlightAnnotationTrigger === captureId);
    const highlightRow = [...document.querySelectorAll("#captureStack .capture-stack-row")]
      .find((row) => row.dataset.stackCaptureId === highlightBefore.id);
    const readNoteButtonMeta = (row, label) => {
      const button = [...(row?.querySelectorAll("button") || [])]
        .find((item) => item.textContent === label);
      return {
        visible: Boolean(button),
        label: button?.textContent || "",
        title: button?.getAttribute("title") || "",
        aria: button?.getAttribute("aria-label") || ""
      };
    };
    const addNoteButtonMeta = readNoteButtonMeta(highlightRow, "Add to notes");
    [...(highlightRow?.querySelectorAll("button") || [])]
      .find((button) => button.textContent === "Add to notes")
      ?.click();
    const notedHighlightRow = [...document.querySelectorAll("#captureStack .capture-stack-row")]
      .find((row) => row.dataset.stackCaptureId === highlightBefore.id);
    const noteBeforeAnnotation = {
      text: document.querySelector("#notesEditor").value,
      blockCount: (document.querySelector("#notesEditor").value.match(/learning-companion:capture:/g) || []).length,
      stackText: notedHighlightRow?.textContent || "",
      addNoteButtonMeta,
      viewButtonMeta: readNoteButtonMeta(notedHighlightRow, "View in Notes"),
      viewButtonVisible: [...(notedHighlightRow?.querySelectorAll("button") || [])].some((button) => button.textContent === "View in Notes")
    };
    document.querySelector("#notesEditBtn").click();
    setValue(
      "#notesEditor",
      document.querySelector("#notesEditor").value.replace(
        "This sentence is worth keeping as a highlight.",
        "This sentence was manually changed inside the generated note."
      )
    );
    document.querySelector('[data-tab="captures"]').click();
    const userEditedHighlightRow = [...document.querySelectorAll("#captureStack .capture-stack-row")]
      .find((row) => row.dataset.stackCaptureId === highlightBefore.id);
    noteBeforeAnnotation.userEditViewButtonMeta = readNoteButtonMeta(userEditedHighlightRow, "View in Notes");
    noteBeforeAnnotation.userEditKeepsViewButtonVisible = [...(userEditedHighlightRow?.querySelectorAll("button") || [])]
      .some((button) => button.textContent === "View in Notes");
    document.querySelector("#notesEditBtn").click();
    setValue(
      "#notesEditor",
      document.querySelector("#notesEditor").value.replace(
        /learning-companion:capture-fingerprint:[a-z0-9-]+/,
        "learning-companion:capture-fingerprint:fnv1a-stale"
      )
    );
    document.querySelector('[data-tab="captures"]').click();
    const staleHighlightRow = [...document.querySelectorAll("#captureStack .capture-stack-row")]
      .find((row) => row.dataset.stackCaptureId === highlightBefore.id);
    noteBeforeAnnotation.staleFingerprintButtonMeta = readNoteButtonMeta(staleHighlightRow, "Update note");
    noteBeforeAnnotation.staleFingerprintButtonVisible = [...(staleHighlightRow?.querySelectorAll("button") || [])]
      .some((button) => button.textContent === "Update note");
    [...(staleHighlightRow?.querySelectorAll("button") || [])]
      .find((button) => button.textContent === "Update note")
      ?.click();
    noteBeforeAnnotation.updatedActivity = readActivity();
    const refreshedHighlightRow = [...document.querySelectorAll("#captureStack .capture-stack-row")]
      .find((row) => row.dataset.stackCaptureId === highlightBefore.id);
    noteBeforeAnnotation.restoredViewButtonMeta = readNoteButtonMeta(refreshedHighlightRow, "View in Notes");
    noteBeforeAnnotation.restoredViewButtonVisible = [...(refreshedHighlightRow?.querySelectorAll("button") || [])]
      .some((button) => button.textContent === "View in Notes");
    addThoughtButtonFor(highlightBefore.id)?.click();
    const annotationFormVisible = document.querySelector(".highlight-annotation-form")?.textContent.includes("Add why this highlight matters") === true;
    const annotationFocusOnOpen = document.activeElement?.classList.contains("highlight-annotation-input") === true;
    addThoughtButtonFor(highlightBefore.previousId)?.click();
    const singleFormAfterSecondOpen = document.querySelectorAll(".highlight-annotation-form").length === 1
      && document.querySelector(".highlight-annotation-form")?.dataset.highlightAnnotationId === highlightBefore.previousId;
    addThoughtButtonFor(highlightBefore.id)?.click();
    const escapeInput = document.querySelector(".highlight-annotation-form textarea");
    escapeInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const escapeCanceled = document.querySelectorAll(".highlight-annotation-form").length === 0;
    const focusReturnedToTrigger = document.activeElement?.dataset.highlightAnnotationTrigger === highlightBefore.id;
    addThoughtButtonFor(highlightBefore.id)?.click();
    const annotationInput = document.querySelector(".highlight-annotation-form textarea");
    annotationInput.value = "This annotation must stay attached to the existing highlight.";
    annotationInput.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector(".highlight-annotation-form button[type='submit']").click();
    const highlightAnnotated = readActivity();
    const highlightAnnotationState = (() => {
      const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
      const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
      const capture = session.captures.find((item) => item.id === highlightBefore.id);
      const activeRow = document.querySelector("#captureStack .capture-stack-row");
      return {
        annotationFormVisible,
        annotationFocusOnOpen,
        singleFormAfterSecondOpen,
        escapeCanceled,
        focusReturnedToTrigger,
        countBefore: highlightBefore.count,
        countAfter: session.captures.length,
        quote: capture?.quote || "",
        thought: capture?.thought || "",
        stackText: activeRow?.textContent || "",
        stackNextKind: activeRow?.dataset.stackNextStep || "",
        stackNextText: activeRow?.querySelector(".capture-stack-next")?.textContent || "",
        addThoughtGone: ![...(activeRow?.querySelectorAll("button") || [])].some((button) => button.textContent === "Add thought"),
        noteBeforeAnnotation,
        noteAfterAnnotation: {
          text: session.notesMarkdown || "",
          blockCount: ((session.notesMarkdown || "").match(/learning-companion:capture:/g) || []).length
        }
      };
    })();
    let resumedSourceHref = "";
    const nativePostSaveWindowOpen = window.open;
    window.open = (href) => {
      resumedSourceHref = href;
      return null;
    };
    document.querySelector("#activityHintBtn").click();
    window.open = nativePostSaveWindowOpen;
    const highlightHintResume = readActivity();
    const highlightHintResumeState = (() => {
      const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
      const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
      const capture = session.captures.find((item) => item.id === highlightBefore.id);
      const card = session.reviewCards.find((item) => item.sourceCaptureId === highlightBefore.id);
      return {
        opened: resumedSourceHref,
        promoted: Boolean(capture?.promotedToReview),
        cardExists: Boolean(card),
        activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
        stackNextKind: document.querySelector(\`#captureStack .capture-stack-row[data-stack-capture-id="\${highlightBefore.id}"]\`)?.dataset.stackNextStep || "",
        stackNextText: document.querySelector(\`#captureStack .capture-stack-row[data-stack-capture-id="\${highlightBefore.id}"] .capture-stack-next\`)?.textContent || ""
      };
    })();
    [...document.querySelectorAll(\`#captureStack .capture-stack-row[data-stack-capture-id="\${highlightBefore.id}"] button\`)]
      .find((button) => button.textContent === "Save for recall")
      ?.click();
    const highlightHintCard = readActivity();
    const highlightHintCardState = (() => {
      const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
      const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
      const capture = session.captures.find((item) => item.id === highlightBefore.id);
      const card = session.reviewCards.find((item) => item.sourceCaptureId === highlightBefore.id);
      return {
        promoted: Boolean(capture?.promotedToReview),
        cardExists: Boolean(card),
        activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
        stackNextKind: document.querySelector(\`#captureStack .capture-stack-row[data-stack-capture-id="\${highlightBefore.id}"]\`)?.dataset.stackNextStep || "",
        stackNextText: document.querySelector(\`#captureStack .capture-stack-row[data-stack-capture-id="\${highlightBefore.id}"] .capture-stack-next\`)?.textContent || ""
      };
    })();
    const highlightCardWorkspace = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    const highlightCardDeletedWorkspace = {
      ...highlightCardWorkspace,
      sessions: highlightCardWorkspace.sessions.map((session) => session.id === highlightCardWorkspace.activeSessionId
        ? {
          ...session,
          reviewCards: session.reviewCards.filter((card) => card.sourceCaptureId !== highlightBefore.id)
        }
        : session)
    };
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify(highlightCardDeletedWorkspace));
    const highlightHintCardDeleted = readActivity();
    let deletedCardPrimaryOpen = "";
    window.open = (href) => {
      deletedCardPrimaryOpen = href;
      return null;
    };
    document.querySelector("#activityDetailsBtn").click();
    window.open = nativePostSaveWindowOpen;
    const highlightHintCardDeletedPrimaryState = {
      opened: deletedCardPrimaryOpen,
      toast: document.querySelector("#toast")?.textContent || "",
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      title: document.querySelector("#activityTitle")?.textContent || "",
      hintHidden: document.querySelector("#activityHint")?.hidden !== false,
      hintKind: document.querySelector("#activityHint")?.dataset.nextStepHint || ""
    };
    let deletedCardSourceOpen = "";
    window.open = (href) => {
      deletedCardSourceOpen = href;
      return null;
    };
    document.querySelector("#activityHintBtn").click();
    window.open = nativePostSaveWindowOpen;
    const highlightHintCardDeletedClickState = {
      opened: deletedCardSourceOpen,
      toast: document.querySelector("#toast")?.textContent || "",
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      hintHidden: document.querySelector("#activityHint")?.hidden !== false,
      hintKind: document.querySelector("#activityHint")?.dataset.nextStepHint || ""
    };
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify(highlightCardWorkspace));
    const highlightHintCardRestored = readActivity();
    const crossSessionCardWorkspace = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    const crossSessionCardSessionId = crossSessionCardWorkspace.activeSessionId;
    const crossSessionCardState = (() => {
      const sourceSession = crossSessionCardWorkspace.sessions.find((item) => item.id === crossSessionCardSessionId);
      const card = sourceSession?.reviewCards.find((item) => item.sourceCaptureId === highlightBefore.id);
      return {
        sourceSessionId: crossSessionCardSessionId,
        cardId: card?.id || "",
        activeBeforeSwitch: document.querySelector("#activityHint")?.hidden === false,
        activeHintKind: document.querySelector("#activityHint")?.dataset.nextStepHint || ""
      };
    })();
    document.querySelector("#newSessionBtn").click();
    setValue("#sessionTitle", "Cross-session recall hint guard");
    const crossSessionCardHidden = readActivity();
    let crossSessionCardOpened = "";
    window.open = (href) => {
      crossSessionCardOpened = href;
      return null;
    };
    document.querySelector("#activityHintBtn").click();
    window.open = nativePostSaveWindowOpen;
    const crossSessionCardClickState = {
      opened: crossSessionCardOpened,
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      currentSessionTitle: document.querySelector("#sessionTitle")?.value || "",
      toast: document.querySelector("#toast")?.textContent || "",
      hintHidden: document.querySelector("#activityHint")?.hidden !== false,
      hintKind: document.querySelector("#activityHint")?.dataset.nextStepHint || ""
    };
    const crossSessionRestoreButton = [...document.querySelectorAll("#sessionList .session-row")]
      .find((button) => button.textContent.includes("Post-save flow fixture"));
    crossSessionRestoreButton?.click();
    const crossSessionCardRestored = readActivity();
    const highlightSourceMissingWorkspace = {
      ...highlightCardWorkspace,
      sessions: highlightCardWorkspace.sessions.map((session) => session.id === highlightCardWorkspace.activeSessionId
        ? {
          ...session,
          captures: session.captures.filter((capture) => capture.id !== highlightBefore.id)
        }
        : session)
    };
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify(highlightSourceMissingWorkspace));
    let missingSourcePrimaryOpen = "";
    window.open = (href) => {
      missingSourcePrimaryOpen = href;
      return null;
    };
    document.querySelector("#activityDetailsBtn").click();
    window.open = nativePostSaveWindowOpen;
    const highlightMissingSourcePrimaryState = {
      opened: missingSourcePrimaryOpen,
      toast: document.querySelector("#toast")?.textContent || "",
      title: document.querySelector("#activityTitle")?.textContent || "",
      action: document.querySelector("#activityDetailsBtn")?.textContent || "",
      hintHidden: document.querySelector("#activityHint")?.hidden !== false,
      hintKind: document.querySelector("#activityHint")?.dataset.nextStepHint || ""
    };
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify(highlightCardWorkspace));
    const highlightReviewHintRestored = readActivity();
    let reviewHintWindowOpen = "";
    window.open = (href) => {
      reviewHintWindowOpen = href;
      return null;
    };
    document.querySelector("#activityHintBtn").click();
    window.open = nativePostSaveWindowOpen;
    const highlightHintReview = readActivity();
    const highlightHintReviewState = {
      opened: reviewHintWindowOpen,
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      focusMode: JSON.parse(localStorage.getItem("learning-companion.workspace.v1"))?.sessions
        ?.find((item) => item.id === JSON.parse(localStorage.getItem("learning-companion.workspace.v1"))?.activeSessionId)
        ?.focusMode || ""
    };
    document.querySelector("#newSessionBtn").click();
    setValue("#sessionTitle", "Primary recall source return");
    setValue("#sourceTitle", "Primary recall source");
    setValue("#sourceUrl", "https://example.com/primary-recall-source");
    setValue("#materialType", "article");
    setValue("#quoteInput", "Primary source return quote.");
    setValue("#thoughtInput", "This direct card should reopen source as the primary action.");
    document.querySelector("#captureCardBtn").click();
    let primaryResumeHref = "";
    let primaryResumeTarget = "";
    let primaryResumeFeatures = "";
    window.open = (href, target, features) => {
      primaryResumeHref = href;
      primaryResumeTarget = target;
      primaryResumeFeatures = features;
      return null;
    };
    document.querySelector("#activityDetailsBtn").click();
    window.open = nativePostSaveWindowOpen;
    const highlightPrimaryResume = readActivity();
    const highlightPrimaryResumeState = {
      opened: primaryResumeHref,
      target: primaryResumeTarget,
      features: primaryResumeFeatures,
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      focusMode: JSON.parse(localStorage.getItem("learning-companion.workspace.v1"))?.sessions
        ?.find((item) => item.id === JSON.parse(localStorage.getItem("learning-companion.workspace.v1"))?.activeSessionId)
        ?.focusMode || "",
      activeElement: document.activeElement?.id || "",
      capturePanePulsed: document.querySelector("#capturePane")?.classList.contains("pulse") === true
    };
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify(highlightCardWorkspace));
    document.querySelector('[data-tab="captures"]').click();
    addThoughtButtonFor(highlightBefore.previousId)?.click();
    const noNoteAnnotationInput = document.querySelector(".highlight-annotation-form textarea");
    noNoteAnnotationInput.value = "This annotation should stay out of notes.";
    noNoteAnnotationInput.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector(".highlight-annotation-form button[type='submit']").click();
    const noNoteHighlightAnnotated = readActivity();
    const noNoteHighlightState = (() => {
      const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
      const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
      const capture = session.captures.find((item) => item.id === highlightBefore.previousId);
      return {
        thought: capture?.thought || "",
        notesText: session.notesMarkdown || "",
        markerCount: ((session.notesMarkdown || "").match(/learning-companion:capture:/g) || []).length
      };
    })();
    setValue("#quoteInput", "Plain capture quote.");
    setValue("#thoughtInput", "Plain capture thought.");
    document.querySelector("#captureBtn").click();
    const ordinarySaved = readActivity();
    document.querySelector("#activityDetailsBtn").click();
    const ordinaryDetailCard = [...document.querySelectorAll("#captureList .item-card")]
      .find((item) => item.textContent.includes("Plain capture thought."));
    const ordinaryDetailState = {
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      nextKind: ordinaryDetailCard?.dataset.captureNextStep || "",
      nextText: ordinaryDetailCard?.querySelector(".capture-detail-next")?.textContent || "",
      pulsed: ordinaryDetailCard?.classList.contains("pulse") === true
    };
    setValue("#quoteInput", "Quote should not steal question semantics.");
    setValue("#thoughtInput", "Question: How does the highlight branch avoid stealing questions?");
    document.querySelector("#captureBtn").click();
    const quoteQuestionSaved = readActivity();
    document.querySelector("#newSessionBtn").click();
    setValue("#sessionTitle", "No-source highlight branch");
    setValue("#sourceTitle", "");
    setValue("#sourceUrl", "");
    setValue("#timestampInput", "");
    setValue("#quoteInput", "No source highlight.");
    setValue("#thoughtInput", "");
    document.querySelector("#captureBtn").click();
    const noSourceHighlightId = (() => {
      const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
      const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
      return session?.captures[0]?.id || "";
    })();
    addThoughtButtonFor(noSourceHighlightId)?.click();
    const noSourceAnnotationInput = document.querySelector(".highlight-annotation-form textarea");
    noSourceAnnotationInput.value = "Thought without source should still offer recall.";
    noSourceAnnotationInput.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector(".highlight-annotation-form button[type='submit']").click();
    const noSourceHighlightAnnotated = readActivity();
    const noSourceHighlightBranch = (() => {
      const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
      const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
      const capture = session?.captures.find((item) => item.id === noSourceHighlightId);
      return {
        sourceUrl: capture?.sourceUrl || "",
        sourceTitle: capture?.sourceTitle || "",
        promoted: Boolean(capture?.promotedToReview),
        stackNextKind: document.querySelector(\`#captureStack .capture-stack-row[data-stack-capture-id="\${noSourceHighlightId}"]\`)?.dataset.stackNextStep || "",
        stackNextText: document.querySelector(\`#captureStack .capture-stack-row[data-stack-capture-id="\${noSourceHighlightId}"] .capture-stack-next\`)?.textContent || ""
      };
    })();
    setValue("#quoteInput", "");
    setValue("#thoughtInput", "Question: What source should this be tied to?");
    document.querySelector("#captureBtn").click();
    const noSourceQuestionSaved = readActivity();
    document.querySelector("#newSessionBtn").click();
    setValue("#sessionTitle", "Unsafe recall source fallback");
    setValue("#sourceTitle", "Unsafe source should not resume");
    setValue("#sourceUrl", "javascript:alert(1)");
    document.querySelector("#sourceUrl")?.dispatchEvent(new Event("change", { bubbles: true }));
    setValue("#quoteInput", "Unsafe source should not become a source-resume action.");
    setValue("#thoughtInput", "This card should remain reviewable without opening the unsafe source.");
    document.querySelector("#captureCardBtn").click();
    const unsafeSourceCardSaved = readActivity();
    const unsafeSourceCardState = (() => {
      const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
      const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
      const capture = session?.captures.find((item) => /unsafe source/i.test(item.quote || "")) || {};
      const card = session?.reviewCards.find((item) => item.sourceCaptureId === capture.id) || {};
      return {
        sessionSourceUrl: session?.sourceUrl || "",
        captureSourceUrl: capture.sourceUrl || "",
        cardExists: Boolean(card.id),
        stackNextKind: document.querySelector(\`#captureStack .capture-stack-row[data-stack-capture-id="\${capture.id}"]\`)?.dataset.stackNextStep || ""
      };
    })();
    let unsafeSourceWindowOpen = "";
    const nativeUnsafeWindowOpen = window.open;
    window.open = (href) => {
      unsafeSourceWindowOpen = href;
      return null;
    };
    document.querySelector("#activityHintBtn").click();
    window.open = nativeUnsafeWindowOpen;
    const unsafeSourceReviewOpened = readActivity();
    document.querySelector("#newSessionBtn").click();
    setValue("#sessionTitle", "Unsafe promoted source fallback");
    setValue("#sourceTitle", "Unsafe promoted source should not resume");
    setValue("#sourceUrl", "javascript:alert(2)");
    document.querySelector("#sourceUrl")?.dispatchEvent(new Event("change", { bubbles: true }));
    setValue("#quoteInput", "Unsafe promoted highlight should not resume source.");
    setValue("#thoughtInput", "");
    document.querySelector("#captureBtn").click();
    const unsafePromotedId = (() => {
      const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
      const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
      return session?.captures[0]?.id || "";
    })();
    addThoughtButtonFor(unsafePromotedId)?.click();
    const unsafePromotedInput = document.querySelector(".highlight-annotation-form textarea");
    unsafePromotedInput.value = "Unsafe promoted thought should still create a review card.";
    unsafePromotedInput.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector(".highlight-annotation-form button[type='submit']").click();
    [...document.querySelectorAll(\`#captureStack .capture-stack-row[data-stack-capture-id="\${unsafePromotedId}"] button\`)]
      .find((button) => button.textContent === "Save for recall")
      ?.click();
    const unsafeSourcePromotedCardSaved = readActivity();
    const unsafeSourcePromotedCardState = (() => {
      const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
      const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
      const capture = session?.captures.find((item) => item.id === unsafePromotedId) || {};
      const card = session?.reviewCards.find((item) => item.sourceCaptureId === capture.id) || {};
      return {
        sessionSourceUrl: session?.sourceUrl || "",
        captureSourceUrl: capture.sourceUrl || "",
        promoted: Boolean(capture.promotedToReview),
        cardExists: Boolean(card.id),
        stackNextKind: document.querySelector(\`#captureStack .capture-stack-row[data-stack-capture-id="\${capture.id}"]\`)?.dataset.stackNextStep || ""
      };
    })();
    let unsafePromotedWindowOpen = "";
    window.open = (href) => {
      unsafePromotedWindowOpen = href;
      return null;
    };
    document.querySelector("#activityHintBtn").click();
    window.open = nativeUnsafeWindowOpen;
    const unsafeSourcePromotedReviewOpened = readActivity();
    document.querySelector("#newSessionBtn").click();
    setValue("#sessionTitle", "Moved question guard");
    setValue("#sourceTitle", "Moved question source");
    setValue("#sourceUrl", "https://example.com/moved-question-source");
    setValue("#quoteInput", "");
    setValue("#thoughtInput", "Question: What if this question is parked before answer?");
    document.querySelector("#captureBtn").click();
    let movedQuestionHref = "";
    const nativeMovedWindowOpen = window.open;
    window.open = (href) => {
      movedQuestionHref = href;
      return null;
    };
    document.querySelector("#activityHintBtn").click();
    window.open = nativeMovedWindowOpen;
    const movedWorkspace = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    const movedSession = movedWorkspace.sessions.find((item) => item.id === movedWorkspace.activeSessionId);
    const movedQuestionId = movedSession?.captures.find((capture) => /parked before answer/.test(capture.thought || ""))?.id || "";
    const parkedWorkspace = {
      ...movedWorkspace,
      sessions: movedWorkspace.sessions.map((session) => session.id === movedWorkspace.activeSessionId
        ? {
          ...session,
          captures: session.captures.map((capture) => capture.id === movedQuestionId
            ? { ...capture, questionParkedAt: new Date("2099-01-02T12:00:00.000Z").toISOString() }
            : capture)
        }
        : session)
    };
    window.learningCompanionNative.importWorkspaceJson(JSON.stringify(parkedWorkspace));
    document.querySelector("#activityHintBtn").click();
    const movedQuestionGuard = readActivity();
    const movedQuestionGuardState = (() => {
      const prefs = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}");
      const draft = prefs.captureDrafts?.[movedWorkspace.activeSessionId] || {};
      return {
        opened: movedQuestionHref,
        activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
        draftTarget: draft.answersQuestionCaptureId || "",
        thoughtValue: document.querySelector("#thoughtInput")?.value || "",
        detail: document.querySelector("#activityDetail")?.textContent || ""
      };
    })();
    return { questionSaved, questionSavedCaptureId, questionDetails, questionHintResume, questionHintResumeState, questionAnswerDraft, questionAnswerDraftState, linkedAnswerSaved, linkedQuestionState, linkedAnswerDetails, linkedAnswerMissingSource, linkedAnswerHintResume, linkedAnswerHintResumeState, unlinkedAnswerSaved, unlinkedAnswerDetails, cardedLinkedAnswerSaved, cardedLinkedAnswerState, cardedLinkedAnswerClosedToday, cardedLinkedAnswerCardRemoved, cardedLinkedAnswerCardRemovedState, cardedLinkedAnswerRestored, cardedLinkedAnswerRefresh, cardedLinkedAnswerRefreshState, cardedLinkedAnswerPostRefreshResume, cardedLinkedAnswerPostRefreshResumeState, takeawaySaved, highlightSaved, highlightStackBefore, highlightActivityAnnotation, highlightAnnotated, highlightAnnotationState, highlightHintResume, highlightHintResumeState, highlightHintCard, highlightHintCardState, highlightHintCardDeleted, highlightHintCardDeletedPrimaryState, highlightHintCardDeletedClickState, highlightHintCardRestored, highlightPrimaryResume, highlightPrimaryResumeState, highlightMissingSourcePrimaryState, highlightReviewHintRestored, highlightHintReview, highlightHintReviewState, crossSessionCardState, crossSessionCardHidden, crossSessionCardClickState, crossSessionCardRestored, noNoteHighlightAnnotated, noNoteHighlightState, ordinarySaved, ordinaryDetailState, quoteQuestionSaved, noSourceHighlightAnnotated, noSourceHighlightBranch, noSourceQuestionSaved, unsafeSourceCardSaved, unsafeSourceCardState, unsafeSourceWindowOpen, unsafeSourceReviewOpened, unsafeSourcePromotedCardSaved, unsafeSourcePromotedCardState, unsafePromotedWindowOpen, unsafeSourcePromotedReviewOpened, movedQuestionGuard, movedQuestionGuardState };
  })()`, 70000); // Covers a long post-save flow; budget guards observed CDP evaluate flakes without relaxing assertions.
  assert.equal(postSaveFlow.questionSaved.title, "Question saved");
  assert.equal(postSaveFlow.questionSaved.targetId, postSaveFlow.questionSavedCaptureId);
  assert.match(postSaveFlow.questionSaved.detail, /Open Questions/);
  assert.match(postSaveFlow.questionSaved.detail, /Resume the source/);
  assert.equal(postSaveFlow.questionSaved.action, "Questions");
  assert.equal(postSaveFlow.questionSaved.hintHidden, false);
  assert.equal(postSaveFlow.questionSaved.hintKind, "afterQuestionSavedSourceLinked");
  assert.equal(postSaveFlow.questionSaved.hintAction, "Resume source");
  assert.equal(postSaveFlow.questionSaved.hintAria, "Resume the source for this saved question");
  assert.equal(postSaveFlow.questionDetails.activeTab, "today");
  assert.equal(postSaveFlow.questionDetails.drawerOpen, true);
  assert.match(postSaveFlow.questionDetails.openQuestionText, /Open Questions/);
  assert.equal(postSaveFlow.questionDetails.openQuestionPulsed, true);
  assert.equal(postSaveFlow.questionHintResume.title, "Source resumed");
  assert.equal(postSaveFlow.questionHintResume.action, "View capture");
  assert.equal(postSaveFlow.questionHintResume.hintHidden, false);
  assert.equal(postSaveFlow.questionHintResume.hintKind, "afterQuestionSourceResumed");
  assert.equal(postSaveFlow.questionHintResume.hintAction, "Answer question");
  assert.equal(postSaveFlow.questionHintResume.hintAria, "Start a linked answer draft for this question");
  assert.deepEqual(postSaveFlow.questionHintResumeState, {
    opened: "https://example.com/post-save-flow",
    target: "_blank",
    features: "noopener,noreferrer",
    activeTab: "captures",
    activeElement: "thoughtInput",
    capturePanePulsed: true
  });
  assert.equal(postSaveFlow.questionAnswerDraft.title, "Answer draft started");
  assert.match(postSaveFlow.questionAnswerDraft.detail, /Loop: 1 active/);
  assert.equal(postSaveFlow.questionAnswerDraft.action, "Resume");
  assert.equal(postSaveFlow.questionAnswerDraftState.activeTab, "captures");
  assert.equal(postSaveFlow.questionAnswerDraftState.activeElement, "thoughtInput");
  assert.equal(postSaveFlow.questionAnswerDraftState.thoughtValue, "Answer:");
  assert.equal(postSaveFlow.questionAnswerDraftState.draftTarget, postSaveFlow.questionSavedCaptureId);
  assert.match(postSaveFlow.questionAnswerDraftState.draftQuote, /Question: Why does ownership matter/);
  assert.equal(postSaveFlow.questionAnswerDraftState.capturePanePulsed, true);
  assert.equal(postSaveFlow.linkedAnswerSaved.title, "Answer saved");
  assert.match(postSaveFlow.linkedAnswerSaved.detail, /Closed the linked question/);
  assert.doesNotMatch(postSaveFlow.linkedAnswerSaved.detail, /Resume the source/);
  assert.equal(postSaveFlow.linkedAnswerSaved.action, "Closed");
  assert.equal(postSaveFlow.linkedAnswerSaved.hintHidden, false);
  assert.equal(postSaveFlow.linkedAnswerSaved.hintKind, "afterLinkedAnswerSavedSourceLinked");
  assert.equal(postSaveFlow.linkedAnswerSaved.hintAction, "Resume source");
  assert.equal(postSaveFlow.linkedAnswerSaved.hintAria, "Resume the source after saving this answer");
  assert.deepEqual(postSaveFlow.linkedQuestionState, { resolved: true, parked: false });
  assert.equal(postSaveFlow.linkedAnswerDetails.activeTab, "today");
  assert.equal(postSaveFlow.linkedAnswerDetails.drawerOpen, true);
  assert.match(postSaveFlow.linkedAnswerDetails.closedQuestionText, /Closed Today/);
  assert.equal(postSaveFlow.linkedAnswerDetails.closedQuestionPulsed, true);
  assert.equal(postSaveFlow.linkedAnswerMissingSource.title, "Answer saved");
  assert.equal(postSaveFlow.linkedAnswerMissingSource.hintHidden, true);
  assert.equal(postSaveFlow.linkedAnswerMissingSource.hintKind, "");
  assert.equal(postSaveFlow.linkedAnswerHintResume.title, "Source resumed");
  assert.equal(postSaveFlow.linkedAnswerHintResume.action, "View capture");
  assert.equal(postSaveFlow.linkedAnswerHintResume.hintHidden, true);
  assert.deepEqual(postSaveFlow.linkedAnswerHintResumeState, {
    opened: "https://example.com/post-save-flow",
    activeTab: "captures",
    activeElement: "thoughtInput",
    capturePanePulsed: true
  });
  assert.equal(postSaveFlow.unlinkedAnswerSaved.title, "Answer note saved");
  assert.match(postSaveFlow.unlinkedAnswerSaved.detail, /did not close a question/);
  assert.equal(postSaveFlow.unlinkedAnswerSaved.action, "Answers");
  assert.equal(postSaveFlow.unlinkedAnswerSaved.hintHidden, true);
  assert.equal(postSaveFlow.unlinkedAnswerSaved.hintKind, "");
  assert.equal(postSaveFlow.unlinkedAnswerDetails.activeTab, "today");
  assert.equal(postSaveFlow.unlinkedAnswerDetails.drawerOpen, true);
  assert.match(postSaveFlow.unlinkedAnswerDetails.answersText, /Answers Today/);
  assert.equal(postSaveFlow.unlinkedAnswerDetails.answersPulsed, true);
  assert.equal(postSaveFlow.cardedLinkedAnswerSaved.title, "Answer saved");
  assert.match(postSaveFlow.cardedLinkedAnswerSaved.detail, /Refresh the review card/);
  assert.doesNotMatch(postSaveFlow.cardedLinkedAnswerSaved.detail, /Resume the source/);
  assert.equal(postSaveFlow.cardedLinkedAnswerSaved.action, "Closed");
  assert.equal(postSaveFlow.cardedLinkedAnswerSaved.hintHidden, false);
  assert.equal(postSaveFlow.cardedLinkedAnswerSaved.hintKind, "afterLinkedAnswerCardRefreshNeeded");
  assert.equal(postSaveFlow.cardedLinkedAnswerSaved.hintAction, "Refresh card");
  assert.equal(postSaveFlow.cardedLinkedAnswerSaved.hintAria, "Refresh the review card with this linked answer");
  assert.equal(postSaveFlow.cardedLinkedAnswerState.cardEvidenceBefore, postSaveFlow.cardedLinkedAnswerState.questionId);
  assert.equal(postSaveFlow.cardedLinkedAnswerClosedToday.activeTab, "today");
  assert.equal(postSaveFlow.cardedLinkedAnswerClosedToday.closedCardFound, true);
  assert.deepEqual(postSaveFlow.cardedLinkedAnswerClosedToday.refreshButton, { text: "Refresh card", disabled: false });
  assert.equal(postSaveFlow.cardedLinkedAnswerCardRemoved.title, "Answer saved");
  assert.equal(postSaveFlow.cardedLinkedAnswerCardRemoved.hintHidden, true);
  assert.equal(postSaveFlow.cardedLinkedAnswerCardRemoved.hintKind, "");
  assert.equal(postSaveFlow.cardedLinkedAnswerCardRemovedState.activeTab, "today");
  assert.equal(postSaveFlow.cardedLinkedAnswerCardRemovedState.reviewCardStillPresent, false);
  assert.equal(postSaveFlow.cardedLinkedAnswerRestored.title, "Answer saved");
  assert.equal(postSaveFlow.cardedLinkedAnswerRestored.hintHidden, false);
  assert.equal(postSaveFlow.cardedLinkedAnswerRestored.hintKind, "afterLinkedAnswerCardRefreshNeeded");
  assert.equal(postSaveFlow.cardedLinkedAnswerRefresh.title, "Review card refreshed");
  assert.equal(postSaveFlow.cardedLinkedAnswerRefreshState.activeTab, "review");
  assert.equal(postSaveFlow.cardedLinkedAnswerRefreshState.activeReviewCard, true);
  assert.equal(postSaveFlow.cardedLinkedAnswerRefreshState.cardEvidenceAfter, postSaveFlow.cardedLinkedAnswerRefreshState.answerId);
  assert.notEqual(postSaveFlow.cardedLinkedAnswerRefreshState.cardEvidenceAfter, postSaveFlow.cardedLinkedAnswerState.cardEvidenceBefore);
  assert.equal(postSaveFlow.cardedLinkedAnswerRefresh.hintHidden, false);
  assert.equal(postSaveFlow.cardedLinkedAnswerRefresh.hintKind, "afterQuestionCardRefreshedSourceLinked");
  assert.equal(postSaveFlow.cardedLinkedAnswerRefresh.hintAction, "Resume source");
  assert.equal(postSaveFlow.cardedLinkedAnswerRefresh.hintAria, "Resume the source after refreshing this review card");
  assert.equal(postSaveFlow.cardedLinkedAnswerPostRefreshResume.title, "Source resumed");
  assert.equal(postSaveFlow.cardedLinkedAnswerPostRefreshResume.action, "Question");
  assert.deepEqual(postSaveFlow.cardedLinkedAnswerPostRefreshResumeState, {
    opened: "https://example.com/card-refresh-source",
    target: "_blank",
    features: "noopener,noreferrer",
    activeTab: "captures",
    activeElement: "thoughtInput",
    capturePanePulsed: true
  });
  assert.equal(postSaveFlow.takeawaySaved.title, "Takeaway saved");
  assert.match(postSaveFlow.takeawaySaved.detail, /Save it for recall/);
  assert.equal(postSaveFlow.takeawaySaved.action, "Capture");
  assert.equal(postSaveFlow.highlightSaved.title, "Highlight saved");
  assert.match(postSaveFlow.highlightSaved.detail, /Saved locally as a highlight/);
  assert.match(postSaveFlow.highlightSaved.detail, /source page is unchanged/);
  assert.match(postSaveFlow.highlightSaved.detail, /save it for recall/);
  assert.equal(postSaveFlow.highlightSaved.action, "Add thought");
  assert.equal(postSaveFlow.highlightSaved.aria, "Add thought to saved highlight");
  assert.equal(postSaveFlow.highlightSaved.hintHidden, false);
  assert.equal(postSaveFlow.highlightSaved.hintKind, "afterQuoteSave");
  assert.match(postSaveFlow.highlightSaved.hintText, /add a thought/);
  assert.equal(postSaveFlow.highlightSaved.hintAction, "Add thought");
  assert.equal(postSaveFlow.highlightSaved.hintAria, "Add a thought to this saved highlight");
  assert.equal(postSaveFlow.highlightSaved.hintParentClass, "activity-copy");
  assert.equal(postSaveFlow.highlightStackBefore.kind, "add-thought");
  assert.equal(postSaveFlow.highlightStackBefore.text, "Needs your why — or leave it as a quote.");
  assert.equal(postSaveFlow.highlightActivityAnnotation.activeTab, "captures");
  assert.equal(postSaveFlow.highlightActivityAnnotation.detailsFormVisible, true);
  assert.equal(postSaveFlow.highlightActivityAnnotation.focused, true);
  assert.equal(postSaveFlow.highlightAnnotated.title, "Highlight annotated");
  assert.match(postSaveFlow.highlightAnnotated.detail, /Thought added to the saved highlight/);
  assert.match(postSaveFlow.highlightAnnotated.detail, /source page is unchanged/);
  assert.equal(postSaveFlow.highlightAnnotated.action, "View highlight");
  assert.equal(postSaveFlow.highlightAnnotated.hintHidden, false);
  assert.equal(postSaveFlow.highlightAnnotated.hintKind, "afterThoughtAddedTextSourceLinked");
  assert.match(postSaveFlow.highlightAnnotated.hintText, /open the source at this highlight/);
  assert.match(postSaveFlow.highlightAnnotated.hintText, /Add to Notes for synthesis, or save for recall practice/);
  assert.equal(postSaveFlow.highlightAnnotated.hintAction, "Open at quote");
  assert.equal(postSaveFlow.highlightAnnotated.hintAria, "Open the source; jump to this annotated highlight if supported");
  assert.equal(postSaveFlow.highlightAnnotated.activeElement, "quoteInput");
  assert.equal(postSaveFlow.highlightAnnotationState.annotationFormVisible, true);
  assert.equal(postSaveFlow.highlightAnnotationState.annotationFocusOnOpen, true);
  assert.equal(postSaveFlow.highlightAnnotationState.singleFormAfterSecondOpen, true);
  assert.equal(postSaveFlow.highlightAnnotationState.escapeCanceled, true);
  assert.equal(postSaveFlow.highlightAnnotationState.focusReturnedToTrigger, true);
  assert.equal(postSaveFlow.highlightAnnotationState.countAfter, postSaveFlow.highlightAnnotationState.countBefore);
  assert.equal(postSaveFlow.highlightAnnotationState.quote, "This sentence is worth keeping as a highlight.");
  assert.equal(postSaveFlow.highlightAnnotationState.thought, "This annotation must stay attached to the existing highlight.");
  assert.match(postSaveFlow.highlightAnnotationState.stackText, /annotation must stay attached/);
  assert.equal(postSaveFlow.highlightAnnotationState.stackNextKind, "keep-reading");
  assert.equal(postSaveFlow.highlightAnnotationState.stackNextText, "In Notes · keep reading, or save for recall practice.");
  assert.equal(postSaveFlow.highlightAnnotationState.addThoughtGone, true);
  assert.match(postSaveFlow.highlightAnnotationState.noteBeforeAnnotation.text, /This sentence is worth keeping as a highlight\./);
  assert.doesNotMatch(postSaveFlow.highlightAnnotationState.noteBeforeAnnotation.text, /annotation must stay attached/);
  assert.equal(postSaveFlow.highlightAnnotationState.noteBeforeAnnotation.blockCount, 2);
  assert.match(postSaveFlow.highlightAnnotationState.noteBeforeAnnotation.stackText, /In Notes/);
  assert.deepEqual(postSaveFlow.highlightAnnotationState.noteBeforeAnnotation.addNoteButtonMeta, {
    visible: true,
    label: "Add to notes",
    title: "Add this capture to Notes for synthesis",
    aria: "Add this capture to Notes"
  });
  assert.deepEqual(postSaveFlow.highlightAnnotationState.noteBeforeAnnotation.viewButtonMeta, {
    visible: true,
    label: "View in Notes",
    title: "View this generated capture block in Notes",
    aria: "View this capture in Notes"
  });
  assert.equal(postSaveFlow.highlightAnnotationState.noteBeforeAnnotation.viewButtonVisible, true);
  assert.deepEqual(postSaveFlow.highlightAnnotationState.noteBeforeAnnotation.userEditViewButtonMeta, {
    visible: true,
    label: "View in Notes",
    title: "View this generated capture block in Notes",
    aria: "View this capture in Notes"
  });
  assert.equal(postSaveFlow.highlightAnnotationState.noteBeforeAnnotation.userEditKeepsViewButtonVisible, true);
  assert.deepEqual(postSaveFlow.highlightAnnotationState.noteBeforeAnnotation.staleFingerprintButtonMeta, {
    visible: true,
    label: "Update note",
    title: "Update the generated Notes block from this capture",
    aria: "Update this capture's generated Notes block"
  });
  assert.equal(postSaveFlow.highlightAnnotationState.noteBeforeAnnotation.staleFingerprintButtonVisible, true);
  assert.equal(postSaveFlow.highlightAnnotationState.noteBeforeAnnotation.updatedActivity.title, "Capture note updated");
  assert.equal(postSaveFlow.highlightAnnotationState.noteBeforeAnnotation.updatedActivity.action, "Open at quote");
  assert.equal(postSaveFlow.highlightAnnotationState.noteBeforeAnnotation.updatedActivity.aria, "Open at quote in a new tab; Quick Capture stays ready");
  assert.equal(postSaveFlow.highlightAnnotationState.noteBeforeAnnotation.updatedActivity.hintHidden, false);
  assert.equal(postSaveFlow.highlightAnnotationState.noteBeforeAnnotation.updatedActivity.hintKind, "afterNoteAddedViewNote");
  assert.match(postSaveFlow.highlightAnnotationState.noteBeforeAnnotation.updatedActivity.hintText, /^Note updated\. View the refreshed block/);
  assert.equal(postSaveFlow.highlightAnnotationState.noteBeforeAnnotation.updatedActivity.hintAction, "View note");
  assert.deepEqual(postSaveFlow.highlightAnnotationState.noteBeforeAnnotation.restoredViewButtonMeta, {
    visible: true,
    label: "View in Notes",
    title: "View this generated capture block in Notes",
    aria: "View this capture in Notes"
  });
  assert.equal(postSaveFlow.highlightAnnotationState.noteBeforeAnnotation.restoredViewButtonVisible, true);
  assert.match(postSaveFlow.highlightAnnotationState.noteAfterAnnotation.text, /This sentence is worth keeping as a highlight\./);
  assert.match(postSaveFlow.highlightAnnotationState.noteAfterAnnotation.text, /This annotation must stay attached to the existing highlight\./);
  assert.equal(postSaveFlow.highlightAnnotationState.noteAfterAnnotation.blockCount, 2);
  assert.equal(postSaveFlow.highlightHintResume.title, "Source resumed");
  assert.match(postSaveFlow.highlightHintResume.detail, /Post-save flow fixture reopened/);
  assert.equal(postSaveFlow.highlightHintResume.action, "View highlight");
  assert.equal(postSaveFlow.highlightHintResume.hintHidden, true);
  assert.deepEqual(postSaveFlow.highlightHintResumeState, {
    opened: "https://example.com/post-save-flow#:~:text=This%20sentence%20is%20worth%20keeping%20as%20a%20highlight.",
    promoted: false,
    cardExists: false,
    activeTab: "captures",
    stackNextKind: "keep-reading",
    stackNextText: "In Notes · keep reading, or save for recall practice."
  });
  assert.equal(postSaveFlow.highlightHintCard.title, "Review card created");
  assert.equal(postSaveFlow.highlightHintCard.activeTab, "captures");
  assert.equal(postSaveFlow.highlightHintCard.hintHidden, false);
  assert.equal(postSaveFlow.highlightHintCard.action, "Open at quote");
  assert.equal(postSaveFlow.highlightHintCard.aria, "Open at quote in a new tab; Quick Capture stays ready");
  assert.equal(postSaveFlow.highlightHintCard.hintKind, "afterCardMade");
  assert.equal(postSaveFlow.highlightHintCard.hintText, "Saved for recall. Review when you want.");
  assert.equal(postSaveFlow.highlightHintCard.hintAction, "Review card");
  assert.equal(postSaveFlow.highlightHintCard.hintAria, "Open the new review card");
  assert.deepEqual(postSaveFlow.highlightHintCardState, {
    promoted: true,
    cardExists: true,
    activeTab: "captures",
    stackNextKind: "review-ready",
    stackNextText: "Card scheduled · keep reading."
  });
  assert.equal(postSaveFlow.highlightHintCardDeleted.title, "Review card created");
  assert.equal(postSaveFlow.highlightHintCardDeleted.hintHidden, true);
  assert.equal(postSaveFlow.highlightHintCardDeleted.hintKind, "");
  assert.deepEqual(postSaveFlow.highlightHintCardDeletedPrimaryState, {
    opened: "",
    toast: "Review card no longer exists",
    activeTab: "today",
    title: "Review card created",
    hintHidden: true,
    hintKind: ""
  });
  assert.deepEqual(postSaveFlow.highlightHintCardDeletedClickState, {
    opened: "",
    toast: "Review card no longer exists",
    activeTab: "today",
    hintHidden: true,
    hintKind: ""
  });
  assert.equal(postSaveFlow.highlightHintCardRestored.title, "Review card created");
  assert.equal(postSaveFlow.highlightHintCardRestored.hintHidden, false);
  assert.equal(postSaveFlow.highlightHintCardRestored.hintKind, "afterCardMade");
  assert.notEqual(postSaveFlow.crossSessionCardState.sourceSessionId, "");
  assert.match(postSaveFlow.crossSessionCardState.cardId, /^card_/);
  assert.equal(postSaveFlow.crossSessionCardState.activeBeforeSwitch, true);
  assert.equal(postSaveFlow.crossSessionCardState.activeHintKind, "afterCardMade");
  assert.equal(postSaveFlow.crossSessionCardHidden.title, "Link source or jot loose thought");
  assert.equal(postSaveFlow.crossSessionCardHidden.hintHidden, true);
  assert.equal(postSaveFlow.crossSessionCardHidden.hintKind, "");
  assert.deepEqual(postSaveFlow.crossSessionCardClickState, {
    opened: "",
    activeTab: "today",
    currentSessionTitle: "Cross-session recall hint guard",
    toast: "Session created",
    hintHidden: true,
    hintKind: ""
  });
  assert.equal(postSaveFlow.crossSessionCardRestored.title, "Review card created");
  assert.equal(postSaveFlow.crossSessionCardRestored.hintHidden, false);
  assert.equal(postSaveFlow.crossSessionCardRestored.hintKind, "afterCardMade");
  assert.equal(postSaveFlow.highlightPrimaryResume.title, "Source resumed");
  assert.equal(postSaveFlow.highlightPrimaryResume.action, "View capture");
  assert.equal(postSaveFlow.highlightPrimaryResume.hintHidden, true);
  assert.match(postSaveFlow.highlightPrimaryResume.detail, /Continue reading; the saved card is here when you want to review/);
  assert.deepEqual(postSaveFlow.highlightPrimaryResumeState, {
    opened: "https://example.com/primary-recall-source#:~:text=Primary%20source%20return%20quote.",
    target: "_blank",
    features: "noopener,noreferrer",
    activeTab: "captures",
    focusMode: "capture",
    activeElement: "thoughtInput",
    capturePanePulsed: true
  });
  assert.deepEqual(postSaveFlow.highlightMissingSourcePrimaryState, {
    opened: "",
    toast: "Source no longer exists",
    title: "Review card created",
    action: "Open at quote",
    hintHidden: false,
    hintKind: "afterCardMade"
  });
  assert.equal(postSaveFlow.highlightReviewHintRestored.hintKind, "afterCardMade");
  assert.equal(postSaveFlow.highlightHintReview.title, "Review card opened");
  assert.equal(postSaveFlow.highlightHintReview.action, "Review");
  assert.equal(postSaveFlow.highlightHintReview.hintHidden, true);
  assert.deepEqual(postSaveFlow.highlightHintReviewState, {
    opened: "",
    activeTab: "review",
    focusMode: "review"
  });
  assert.equal(postSaveFlow.noNoteHighlightAnnotated.title, "Highlight annotated");
  assert.doesNotMatch(postSaveFlow.noNoteHighlightAnnotated.detail, /generated note block/);
  assert.equal(postSaveFlow.noNoteHighlightState.thought, "This annotation should stay out of notes.");
  assert.doesNotMatch(postSaveFlow.noNoteHighlightState.notesText, /This annotation should stay out of notes/);
  assert.equal(postSaveFlow.noNoteHighlightState.markerCount, 2);
  assert.equal(postSaveFlow.ordinarySaved.title, "Capture saved");
  assert.match(postSaveFlow.ordinarySaved.detail, /Saved locally/);
  assert.equal(postSaveFlow.ordinarySaved.action, "View capture");
  assert.equal(postSaveFlow.ordinarySaved.aria, "View capture");
  assert.equal(postSaveFlow.ordinarySaved.hintHidden, false);
  assert.equal(postSaveFlow.ordinarySaved.hintKind, "afterCaptureSavedTextSourceLinked");
  assert.match(postSaveFlow.ordinarySaved.hintText, /open the source/);
  assert.equal(postSaveFlow.ordinarySaved.hintAction, "Open at quote");
  assert.equal(postSaveFlow.ordinarySaved.hintAria, "Open the source; jump to this saved quote if supported");
  assert.deepEqual(postSaveFlow.ordinaryDetailState, {
    activeTab: "captures",
    nextKind: "keep-reading",
    nextText: "Choose next: add to Notes for synthesis, or save for recall.",
    pulsed: true
  });
  assert.equal(postSaveFlow.quoteQuestionSaved.title, "Question saved");
  assert.equal(postSaveFlow.quoteQuestionSaved.action, "Questions");
  assert.equal(postSaveFlow.noSourceHighlightAnnotated.title, "Highlight annotated");
  assert.equal(postSaveFlow.noSourceHighlightAnnotated.hintHidden, false);
  assert.equal(postSaveFlow.noSourceHighlightAnnotated.hintKind, "afterThoughtAdded");
  assert.match(postSaveFlow.noSourceHighlightAnnotated.hintText, /come back later/);
  assert.equal(postSaveFlow.noSourceHighlightAnnotated.hintAction, "Save for recall");
  assert.equal(postSaveFlow.noSourceHighlightAnnotated.hintAria, "Save this annotated highlight for recall");
  assert.deepEqual(postSaveFlow.noSourceHighlightBranch, {
    sourceUrl: "",
    sourceTitle: "",
    promoted: false,
    stackNextKind: "keep-reading",
    stackNextText: "Choose next: add to Notes for synthesis, or save for recall."
  });
  assert.equal(postSaveFlow.noSourceQuestionSaved.title, "Question saved");
  assert.match(postSaveFlow.noSourceQuestionSaved.detail, /answer it, park it, save it for recall/);
  assert.doesNotMatch(postSaveFlow.noSourceQuestionSaved.detail, /Resume the source/);
  assert.equal(postSaveFlow.noSourceQuestionSaved.action, "Questions");
  assert.equal(postSaveFlow.noSourceQuestionSaved.hintHidden, true);
  assert.equal(postSaveFlow.noSourceQuestionSaved.hintKind, "");
  assert.equal(postSaveFlow.unsafeSourceCardSaved.title, "Capture and card saved");
  assert.doesNotMatch(postSaveFlow.unsafeSourceCardSaved.detail, /Jump back|Resume the source|Open at quote/i);
  assert.equal(postSaveFlow.unsafeSourceCardSaved.action, "Review");
  assert.equal(postSaveFlow.unsafeSourceCardSaved.hintHidden, false);
  assert.equal(postSaveFlow.unsafeSourceCardSaved.hintKind, "afterCardMade");
  assert.equal(postSaveFlow.unsafeSourceCardSaved.hintAction, "Review card");
  assert.equal(postSaveFlow.unsafeSourceCardSaved.hintAria, "Open the new review card");
  assert.deepEqual(postSaveFlow.unsafeSourceCardState, {
    sessionSourceUrl: "",
    captureSourceUrl: "",
    cardExists: true,
    stackNextKind: "review-ready"
  });
  assert.equal(postSaveFlow.unsafeSourceWindowOpen, "");
  assert.equal(postSaveFlow.unsafeSourceReviewOpened.title, "Review card opened");
  assert.equal(postSaveFlow.unsafeSourceReviewOpened.activeTab, "review");
  assert.equal(postSaveFlow.unsafeSourcePromotedCardSaved.title, "Review card created");
  assert.doesNotMatch(postSaveFlow.unsafeSourcePromotedCardSaved.detail, /Jump back|Resume the source|Open at quote/i);
  assert.equal(postSaveFlow.unsafeSourcePromotedCardSaved.action, "Review");
  assert.equal(postSaveFlow.unsafeSourcePromotedCardSaved.hintHidden, false);
  assert.equal(postSaveFlow.unsafeSourcePromotedCardSaved.hintKind, "afterCardMade");
  assert.equal(postSaveFlow.unsafeSourcePromotedCardSaved.hintAction, "Review card");
  assert.deepEqual(postSaveFlow.unsafeSourcePromotedCardState, {
    sessionSourceUrl: "",
    captureSourceUrl: "",
    promoted: true,
    cardExists: true,
    stackNextKind: "review-ready"
  });
  assert.equal(postSaveFlow.unsafePromotedWindowOpen, "");
  assert.equal(postSaveFlow.unsafeSourcePromotedReviewOpened.title, "Review card opened");
  assert.equal(postSaveFlow.unsafeSourcePromotedReviewOpened.activeTab, "review");
  assert.equal(postSaveFlow.movedQuestionGuard.title, "Question already moved");
  assert.match(postSaveFlow.movedQuestionGuard.detail, /parked/);
  assert.equal(postSaveFlow.movedQuestionGuard.action, "Today");
  assert.deepEqual(postSaveFlow.movedQuestionGuardState, {
    opened: "https://example.com/moved-question-source",
    activeTab: "today",
    draftTarget: "",
    thoughtValue: "",
    detail: "This question is parked. Resume it from Today before answering."
  });
}

async function assertCaptureStackNextStepMix(cdp) {
  const stackMix = await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    document.querySelector("#newSessionBtn").click();
    setValue("#sessionTitle", "Recent stack next-step mix");
    setValue("#sourceTitle", "Stack mix source");
    setValue("#sourceUrl", "https://example.com/stack-mix");
    setValue("#quoteInput", "Quote-only row should stay optional.");
    setValue("#thoughtInput", "");
    document.querySelector("#captureBtn").click();
    setValue("#quoteInput", "Card row should not push export.");
    setValue("#thoughtInput", "This concept should be scheduled for later review.");
    document.querySelector("#captureCardBtn").click();
    setValue("#quoteInput", "Thought row should encourage continuing.");
    setValue("#thoughtInput", "This point is useful, but not automatically a card.");
    document.querySelector("#captureBtn").click();
    return [...document.querySelectorAll("#captureStack .capture-stack-row")].map((row) => ({
      kind: row.dataset.stackNextStep || "",
      next: row.querySelector(".capture-stack-next")?.textContent || "",
      guide: row.querySelector("[data-capture-decision-guide]")?.textContent || "",
      buttons: [...row.querySelectorAll("button")].map((button) => ({
        label: button.textContent.trim(),
        title: button.title || "",
        aria: button.getAttribute("aria-label") || ""
      }))
    }));
  })()`);
  assert.deepEqual(stackMix.map((row) => row.kind), ["keep-reading", "review-ready", "add-thought"]);
  assert.deepEqual(stackMix.map((row) => row.next), [
    "Choose next: add to Notes for synthesis, or save for recall.",
    "Card scheduled · keep reading.",
    "Needs your why — or leave it as a quote."
  ]);
  assert.deepEqual(stackMix.map((row) => row.guide), [
    "",
    "",
    ""
  ]);
  assert.deepEqual(stackMix.map((row) => row.buttons.map((button) => button.label)), [
    ["Open source", "Add to notes", "Save for recall", "Delete"],
    ["Open source", "Add to notes", "Review", "Delete + 1 card"],
    ["Open source", "Add thought", "Add to notes", "Save for recall", "Delete"]
  ]);
  assert.deepEqual(stackMix[0].buttons.find((button) => button.label === "Save for recall"), {
    label: "Save for recall",
    title: "Save this capture to recall later",
    aria: "Save this capture to recall later"
  });
  assert.deepEqual(stackMix[1].buttons.find((button) => button.label === "Review"), {
    label: "Review",
    title: "Open the review card made from this capture",
    aria: "Open this capture's review card"
  });
}

async function assertSidecarHighlightActivity(cdp) {
  const sidecarHighlight = await cdp.evaluate(`(async () => {
    const beforeWorkspaceJson = window.learningCompanionNative.exportWorkspaceJson();
    let result = {};
    try {
      const workspace = JSON.parse(beforeWorkspaceJson);
      const baseSession = workspace.sessions[0];
      const fixtureSession = {
        ...baseSession,
        id: "sidecar_highlight_activity_fixture",
        title: "Sidecar highlight activity fixture",
        sourceTitle: "Reader article",
        sourceUrl: "https://example.com/reader-article",
        materialType: "article",
        notesMarkdown: "",
        captures: [],
        reviewCards: [],
        focusMode: "capture"
      };
      window.learningCompanionNative.importWorkspaceJson(JSON.stringify({
        ...workspace,
        activeSessionId: fixtureSession.id,
        sessions: [fixtureSession],
        importedPatches: [],
        importedReviewPatches: []
      }));
      window.learningCompanionNative.setSidecarLayout(true);
      const quote = "Sidecar quote-only highlight should open its thought form without leaving focus.";
      document.querySelector("#quoteInput").value = quote;
      document.querySelector("#thoughtInput").value = "";
      document.querySelector("#captureBtn").click();
      const activity = {
        title: document.querySelector("#activityTitle").textContent,
        detail: document.querySelector("#activityDetail").textContent,
        action: document.querySelector("#activityDetailsBtn").textContent,
        aria: document.querySelector("#activityDetailsBtn").getAttribute("aria-label") || ""
      };
      const afterCapture = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
      const savedSession = afterCapture.sessions.find((session) => session.id === afterCapture.activeSessionId);
      const savedCapture = savedSession?.captures[0];
      document.querySelector("#activityDetailsBtn").click();
      const stackForm = document.querySelector('.highlight-annotation-form[data-highlight-annotation-context="stack"]');
      const focusedBeforeTick = document.activeElement?.classList.contains("highlight-annotation-input") === true;
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      result = {
        activity,
        savedId: savedCapture?.id || "",
        savedQuote: savedCapture?.quote || "",
        savedThought: savedCapture?.thought || "",
        savedCount: savedSession?.captures.length || 0,
        stillSidecar: document.querySelector(".app-shell").classList.contains("sidecar-layout"),
        activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
        stackFormVisible: Boolean(stackForm) && !stackForm.closest(".inspector"),
        stackFormId: stackForm?.dataset.highlightAnnotationId || "",
        focused: focusedBeforeTick,
        focusedAfterTick: document.activeElement?.classList.contains("highlight-annotation-input") === true,
        formContexts: [...document.querySelectorAll(".highlight-annotation-form")].map((form) => ({
          id: form.dataset.highlightAnnotationId || "",
          context: form.dataset.highlightAnnotationContext || "",
          hiddenByInspector: Boolean(form.closest(".inspector"))
        }))
      };
    } finally {
      window.learningCompanionNative.setSidecarLayout(false);
      window.learningCompanionNative.importWorkspaceJson(beforeWorkspaceJson);
    }
    return result;
  })()`, 15000);

  assert.equal(sidecarHighlight.activity.title, "Highlight saved", JSON.stringify(sidecarHighlight));
  assert.equal(sidecarHighlight.activity.action, "Add thought", JSON.stringify(sidecarHighlight));
  assert.equal(sidecarHighlight.activity.aria, "Add thought to saved highlight", JSON.stringify(sidecarHighlight));
  assert.equal(sidecarHighlight.savedCount, 1, JSON.stringify(sidecarHighlight));
  assert.equal(sidecarHighlight.savedQuote, "Sidecar quote-only highlight should open its thought form without leaving focus.", JSON.stringify(sidecarHighlight));
  assert.equal(sidecarHighlight.savedThought, "", JSON.stringify(sidecarHighlight));
  assert.equal(sidecarHighlight.stillSidecar, true, JSON.stringify(sidecarHighlight));
  assert.equal(sidecarHighlight.activeTab, "captures", JSON.stringify(sidecarHighlight));
  assert.equal(sidecarHighlight.stackFormVisible, true, JSON.stringify(sidecarHighlight));
  assert.equal(sidecarHighlight.stackFormId, sidecarHighlight.savedId, JSON.stringify(sidecarHighlight));
  assert.equal(sidecarHighlight.focused, true, JSON.stringify(sidecarHighlight));
  assert.equal(sidecarHighlight.focusedAfterTick, true, JSON.stringify(sidecarHighlight));
}

async function assertReaderSelectionCapture(cdp) {
  await cdp.send("Page.navigate", { url: appUrl });
  await sleep(300);
  const readerSelection = await cdp.evaluate(`(async () => {
    const { renderReaderContent } = await import("./src/reader.js");
    const host = document.createElement("section");
    host.id = "reader-selection-smoke";
    host.style.position = "fixed";
    host.style.left = "0";
    host.style.top = "0";
    host.style.width = "360px";
    host.style.height = "220px";
    host.style.zIndex = "999";
    host.style.background = "white";
    document.body.appendChild(host);
    const captures = [];
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const selectNodeText = (node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    };
    let result = {};
    try {
      renderReaderContent(host, {
        html: '<h1>Reader smoke</h1><p id="readerSmokeQuote">Reader selection should stage clean quote text.</p>',
        url: "https://example.com/reader-smoke",
        title: "Reader smoke",
        lang: "en",
        onQuoteCapture: (text) => captures.push(text)
      });
      const article = host.querySelector(".reader-article");
      article.focus();
      selectNodeText(host.querySelector("#readerSmokeQuote"));
      article.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      await nextFrame();
      const enButton = document.querySelector(".selection-capture-btn");
      const enRect = enButton.getBoundingClientRect();
      const english = {
        text: enButton.textContent,
        aria: enButton.getAttribute("aria-label") || "",
        type: enButton.getAttribute("type") || "",
        top: Math.round(enRect.top),
        left: Math.round(enRect.left),
        right: Math.round(enRect.right),
        bottom: Math.round(enRect.bottom),
        countBeforeClick: document.querySelectorAll(".selection-capture-btn").length
      };
      enButton.click();
      await nextFrame();
      const afterClick = {
        buttonGone: !document.querySelector(".selection-capture-btn"),
        selectionEmpty: window.getSelection().toString() === ""
      };

      renderReaderContent(host, {
        html: '<p id="readerSmokeZh">中文键盘选择也要能摘录。</p>',
        url: "https://example.com/reader-smoke-zh",
        title: "Reader smoke zh",
        lang: "zh",
        onQuoteCapture: (text) => captures.push(text)
      });
      const zhArticle = host.querySelector(".reader-article");
      zhArticle.focus();
      selectNodeText(host.querySelector("#readerSmokeZh"));
      zhArticle.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight", shiftKey: true, bubbles: true }));
      await nextFrame();
      const zhButton = document.querySelector(".selection-capture-btn");
      const zhRect = zhButton.getBoundingClientRect();
      const zh = {
        text: zhButton.textContent,
        aria: zhButton.getAttribute("aria-label") || "",
        top: Math.round(zhRect.top),
        left: Math.round(zhRect.left),
        right: Math.round(zhRect.right),
        bottom: Math.round(zhRect.bottom),
        count: document.querySelectorAll(".selection-capture-btn").length
      };
      document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      await nextFrame();
      result = {
        english,
        afterClick,
        zh,
        captures,
        dismissed: !document.querySelector(".selection-capture-btn"),
        viewport: { width: window.innerWidth, height: window.innerHeight }
      };
    } finally {
      host.remove();
      document.querySelectorAll(".selection-capture-btn").forEach((button) => button.remove());
      window.getSelection().removeAllRanges();
    }
    return result;
  })()`, 15000);

  assert.equal(readerSelection.english.text, "Quote", JSON.stringify(readerSelection));
  assert.equal(readerSelection.english.aria, "Quote selected text into Quick Capture", JSON.stringify(readerSelection));
  assert.equal(readerSelection.english.type, "button", JSON.stringify(readerSelection));
  assert.equal(readerSelection.english.countBeforeClick, 1, JSON.stringify(readerSelection));
  assert.ok(readerSelection.english.top >= 8, JSON.stringify(readerSelection));
  assert.ok(readerSelection.english.left >= 8, JSON.stringify(readerSelection));
  assert.ok(readerSelection.english.right <= readerSelection.viewport.width - 8, JSON.stringify(readerSelection));
  assert.ok(readerSelection.english.bottom <= readerSelection.viewport.height - 8, JSON.stringify(readerSelection));
  assert.deepEqual(readerSelection.captures, ["Reader selection should stage clean quote text."], JSON.stringify(readerSelection));
  assert.equal(readerSelection.afterClick.buttonGone, true, JSON.stringify(readerSelection));
  assert.equal(readerSelection.afterClick.selectionEmpty, true, JSON.stringify(readerSelection));
  assert.equal(readerSelection.zh.text, "摘录", JSON.stringify(readerSelection));
  assert.equal(readerSelection.zh.aria, "摘录选中文本到快速摘录", JSON.stringify(readerSelection));
  assert.equal(readerSelection.zh.count, 1, JSON.stringify(readerSelection));
  assert.ok(readerSelection.zh.top >= 8, JSON.stringify(readerSelection));
  assert.ok(readerSelection.zh.left >= 8, JSON.stringify(readerSelection));
  assert.ok(readerSelection.zh.right <= readerSelection.viewport.width - 8, JSON.stringify(readerSelection));
  assert.ok(readerSelection.zh.bottom <= readerSelection.viewport.height - 8, JSON.stringify(readerSelection));
  assert.equal(readerSelection.dismissed, true, JSON.stringify(readerSelection));
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
  if (!found) throw new Error("No Chrome/Chromium binary found. Set CHROME_PATH to run this smoke.");
  return found;
}

async function waitForTarget(port) {
  const endpoint = `http://127.0.0.1:${port}/json`;
  const deadline = Date.now() + 20000; // Headless Chrome startup occasionally exceeds 12s before any product assertion runs.
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

async function settledDownloadNames(dir, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  let previous = "";
  let stableReads = 0;
  while (Date.now() < deadline) {
    const names = readdirSync(dir)
      .filter((name) => !name.endsWith(".crdownload"))
      .sort();
    const key = names.join("\n");
    if (key === previous) {
      stableReads += 1;
      if (stableReads >= 3) return names;
    } else {
      previous = key;
      stableReads = 0;
    }
    await sleep(100);
  }
  return readdirSync(dir)
    .filter((name) => !name.endsWith(".crdownload"))
    .sort();
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
  let evalId = 0;

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
    evaluate(expression, timeoutMs = 25000) {
      const currentEvalId = ++evalId;
      if (process.env.LC_SMOKE_TRACE_EVAL === "1") {
        console.error(`[smoke-eval ${currentEvalId}] ${String(expression).slice(0, 90).replace(/\s+/g, " ")}`);
      }
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
      }), timeoutMs, `Runtime.evaluate #${currentEvalId} timed out: ${String(expression).slice(0, 120).replace(/\s+/g, " ")}`);
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

async function resetStaticReturnState(cdp, storageKeyPrefix) {
  // Static return pages persist progress per mirror fingerprint; empty-state layout checks need isolated page-local state.
  await cdp.evaluate(`(() => {
    const prefix = ${JSON.stringify(storageKeyPrefix)};
    Object.keys(localStorage)
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => localStorage.removeItem(key));
  })()`);
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
