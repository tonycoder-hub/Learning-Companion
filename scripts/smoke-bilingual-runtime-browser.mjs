#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { readCurrentRevisionSync } from "./lib/git-revision.mjs";

const root = resolve("apps/companion-web");
const startedAtMs = Date.now();
const defaultOut = resolve(".codex-tmp/bilingual-browser-smoke/receipt.json");
const outPath = resolve(parseArg("--out") || defaultOut);
const runRoot = resolve(".codex-tmp/bilingual-browser-smoke", `run-${startedAtMs}`);
const profile = join(runRoot, "profile");
const chromePath = resolveChromePath();

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"]
]);

mkdirSync(profile, { recursive: true, mode: 0o700 });
mkdirSync(dirname(outPath), { recursive: true, mode: 0o700 });

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://127.0.0.1");
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
const debuggingPort = 9600 + Math.floor(Math.random() * 300);
const appUrl = `http://127.0.0.1:${listenPort}/`;
const appRevision = readCurrentRevisionSync();
const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-extensions",
  "--disable-sync",
  "--no-first-run",
  "--no-sandbox",
  "--window-size=1280,900",
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
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await cdp.send("Page.navigate", { url: appUrl });
  await waitForNativeBridge(cdp, exceptions);

  const result = await cdp.evaluate(`(async () => {
    const compact = (text) => String(text || "").replace(/\\s+/g, " ").trim();
    const text = (selector) => compact(document.querySelector(selector)?.textContent || "");
    const clickTab = (tab) => document.querySelector(\`[data-tab="\${tab}"]\`)?.click();
    const setLang = (value) => {
      const select = document.querySelector("#languageSelect");
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const snapshotExport = () => {
      clickTab("export");
      return {
        tab: document.querySelector(".tab.active")?.dataset.tab || "",
        htmlLang: document.documentElement.lang,
        bodyLanguage: document.body.dataset.uiLanguage,
        workspaceTitle: text("#workspaceExportSection"),
        workspaceNote: text("#workspaceExportNote"),
        copyWorkspace: text("#copyWorkspaceBtn"),
        saveWorkspace: text("#downloadWorkspaceBtn"),
        reviewPackTitle: text("#reviewPackExportSection"),
        currentSessionTitle: text("#currentSessionExportSection"),
        mirrorTitle: text("#mirrorExportSection"),
        browserCaptureTitle: text("#browserCaptureExportSection"),
        browserCaptureNote: text("#browserCaptureExportNote"),
        copyClip: text("#copyBookmarkletBtn")
      };
    };
    const snapshotStudyShell = () => {
      clickTab("today");
      const details = document.querySelector(".today-detail-drawer");
      if (details) details.open = true;
      const labels = (selector) => [...document.querySelectorAll(selector)].map((node) => compact(node.textContent));
      const attr = (selector, name) => document.querySelector(selector)?.getAttribute(name) || "";
      const importLabel = document.querySelector("#importWorkspaceInput")?.closest("label");
      const activeTab = document.querySelector(".tab.active")?.dataset.tab || "";
      const reviewTabButton = document.querySelector('[data-tab="review"]');
      reviewTabButton?.click();
      const reviewToolbar = {
        reviewNext: text("#reviewNextBtn"),
        dueCount: text("#dueCount"),
        reviewList: text("#reviewList")
      };
      document.querySelector('[data-tab="today"]')?.click();
      return {
        documentTitle: document.title,
        htmlLang: document.documentElement.lang,
        bodyLanguage: document.body.dataset.uiLanguage,
        sidebarAria: attr(".sidebar", "aria-label"),
        sessionListAria: attr("#sessionList", "aria-label"),
        searchPlaceholder: document.querySelector("#searchInput")?.placeholder || "",
        searchAria: attr("#searchInput", "aria-label"),
        newSessionTitle: document.querySelector("#newSessionBtn")?.title || "",
        newSessionAria: attr("#newSessionBtn", "aria-label"),
        exportWorkspaceTitle: document.querySelector("#exportWorkspaceBtn")?.title || "",
        exportWorkspaceAria: attr("#exportWorkspaceBtn", "aria-label"),
        importWorkspaceTitle: importLabel?.title || "",
        importWorkspaceAria: importLabel?.getAttribute("aria-label") || "",
        storageExport: text("#storageExportNowBtn"),
        updateReload: text("#updateReloadBtn"),
        importDismiss: text("#importReceiptDismissBtn"),
        sourceLabels: labels(".source-strip label"),
        pasteSource: text("#pasteSourceBtn"),
        materialTypes: labels("#materialType option"),
        focusModes: labels("[data-focus-mode]"),
        timeLabel: text('label[for="timestampInput"]'),
        tagLabel: text('label[for="sessionTags"]'),
        activityAria: attr(".activity-strip", "aria-label"),
        focusBriefAria: attr(".focus-brief", "aria-label"),
        capturePaneAria: attr("#capturePane", "aria-label"),
        synthesisPaneAria: attr("#synthesisPane", "aria-label"),
        deskReviewPaneAria: attr("#deskReviewPane", "aria-label"),
        editorPaneAria: attr(".editor-pane", "aria-label"),
        inspectorAria: attr(".inspector", "aria-label"),
        todayTabAria: attr("#todayTab", "aria-label"),
        capturesTabAria: attr("#capturesTab", "aria-label"),
        reviewTabAria: attr("#reviewTab", "aria-label"),
        exportTabAria: attr("#exportTab", "aria-label"),
        metricLabels: labels(".metric-cell small"),
        tabs: labels(".inspector .tab"),
        quickHeading: text("#capturePane .panel-heading h2"),
        captureStarterLabel: text("#captureStarterLabel"),
        captureStarters: labels("#captureStarters button"),
        captureButtons: [text("#captureBtn"), text("#captureCardBtn"), text("#captureClozeBtn")],
        quotePlaceholder: document.querySelector("#quoteInput")?.placeholder || "",
        thoughtPlaceholder: document.querySelector("#thoughtInput")?.placeholder || "",
        synthesisHeading: text("#synthesisPane .panel-heading h2"),
        synthesisButtons: [text("#buildSynthesisBtn"), text("#insertSynthesisBtn")],
        synthesisPlaceholder: document.querySelector("#synthesisDraft")?.placeholder || "",
        synthesisAria: attr("#synthesisDraft", "aria-label"),
        notesHeading: text(".editor-pane .panel-heading h2"),
        notesButtons: [text("#notesEditBtn"), text("#notesPreviewBtn")],
        todayStats: labels("#todaySummary small"),
        todayMapLabels: labels(".today-map-button span"),
        todaySections: labels(".today-section-title"),
        learningFlowText: text(".learning-flow-panel"),
        studyDetailsText: text(".today-detail-drawer"),
        reviewToolbar,
        activeTab
      };
    };
    const snapshotReturn = () => {
      clickTab("today");
      return {
        receiptHidden: document.querySelector("#importReceipt")?.hidden === true,
        receiptText: text("#importReceipt"),
        receiptTitle: text("#importReceiptTitle"),
        receiptDetail: text("#importReceiptDetail"),
        receiptAction: text("#importReceiptActionBtn"),
        nudgeText: text(".returned-work-card"),
        nudgeMeta: text(".returned-work-card .item-meta"),
        nudgeButtons: [...document.querySelectorAll(".returned-work-card button")].map((button) => compact(button.textContent)),
        handoffText: text(".handoff-card"),
        handoffActions: [...document.querySelectorAll(".handoff-card [data-return-files-step]")].map((button) => compact(button.textContent))
      };
    };
    const stageReturnFile = async (patch) => {
      const input = document.querySelector("#importWorkspaceInput");
      input.dataset.importMode = "return-files";
      const transfer = new DataTransfer();
      transfer.items.add(new File([JSON.stringify(patch)], "learning-companion-inbox-patch-bilingual.json", { type: "application/json" }));
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await waitFor(() => document.querySelector(".return-file-preview-card"), "return preview");
      return {
        previewText: text(".return-file-preview-card"),
        previewTitle: text(".return-file-preview-card .card-prompt"),
        previewMeta: text(".return-file-preview-card .item-meta"),
        previewButtons: [...document.querySelectorAll(".return-file-preview-card button")].map((button) => compact(button.textContent)),
        modeNote: text(".return-files-mode-note"),
        actionHint: text(".return-files-action-hint")
      };
    };
    const waitFor = (predicate, label) => new Promise((resolve, reject) => {
      const deadline = Date.now() + 3000;
      const poll = () => {
        if (predicate()) {
          resolve();
          return;
        }
        if (Date.now() >= deadline) {
          reject(new Error(\`Timed out waiting for \${label}\`));
          return;
        }
        setTimeout(poll, 25);
      };
      poll();
    });
    const exerciseNewSessionZh = async () => {
      document.querySelector("#newSessionBtn")?.click();
      await waitFor(() => document.querySelector("#sessionTitle")?.value === "新建学习主题", "Chinese default new session title");
      return {
        titleInput: document.querySelector("#sessionTitle")?.value || "",
        sessionListText: text("#sessionList"),
        captureContextTarget: text("#captureContextTarget"),
        captureContextTargetTitle: document.querySelector("#captureContextTarget")?.title || "",
        captureContextTargetAria: document.querySelector("#captureContextTarget")?.getAttribute("aria-label") || "",
        captureContextAria: document.querySelector("#captureContext")?.getAttribute("aria-label") || ""
      };
    };
    const exerciseMainLoopZh = async () => {
      clickTab("captures");
      const quote = document.querySelector("#quoteInput");
      const thought = document.querySelector("#thoughtInput");
      const search = document.querySelector("#searchInput");
      quote.value = "Visible bilingual runtime quote for the main learning loop.";
      thought.value = "";
      quote.dispatchEvent(new Event("input", { bubbles: true }));
      await waitFor(() => /摘录草稿|快速摘录/.test(text("#activityTitle")), "Chinese draft activity");
      document.querySelector("#captureBtn")?.click();
      await waitFor(() => /最近堆栈/.test(text("#captureStack")) && /添加想法/.test(text("#captureStack")), "Chinese recent stack");
      const captureActivity = {
        title: text("#activityTitle"),
        detail: text("#activityDetail"),
        hintText: text("#activityHintText"),
        hintButton: text("#activityHintBtn")
      };
      search.value = "Visible bilingual runtime";
      search.dispatchEvent(new Event("input", { bubbles: true }));
      await waitFor(() => /查找/.test(text("#searchResults")), "Chinese search results");
      document.querySelector("#timeForwardBtn")?.click();
      await waitFor(() => /时间已调整|时间未变化/.test(text("#activityTitle")), "Chinese time nudge activity");
      return {
        activityTitle: captureActivity.title,
        activityDetail: captureActivity.detail,
        activityHintText: captureActivity.hintText,
        activityHintButton: captureActivity.hintButton,
        focusBriefText: text(".focus-brief"),
        captureStackText: text("#captureStack"),
        captureListText: text("#captureList"),
        searchText: text("#searchResults"),
        timeActivityTitle: text("#activityTitle"),
        timeActivityDetail: text("#activityDetail")
      };
    };
    const exerciseSynthesisConfirmZh = async () => {
      document.querySelector('[data-focus-mode="synthesize"]')?.click();
      await waitFor(() => document.querySelector("#synthesisPane")?.hidden === false, "Chinese synthesis pane");
      const draft = document.querySelector("#synthesisDraft");
      const originalConfirm = window.confirm;
      let confirmMessage = "";
      draft.value = "用户手动编辑的综合草稿";
      draft.dispatchEvent(new Event("input", { bubbles: true }));
      window.confirm = (message) => {
        confirmMessage = String(message || "");
        return false;
      };
      document.querySelector("#buildSynthesisBtn")?.click();
      window.confirm = originalConfirm;
      return {
        confirmMessage,
        draftValue: draft.value,
        status: text("#synthesisStatus")
      };
    };
    const exerciseMirrorImportConfirmZh = async () => {
      clickTab("export");
      await waitFor(() => document.querySelector("#mirrorExport")?.value?.includes("learning-companion.mirror-bundle.staging.v1"), "mirror bundle export text");
      const beforeWorkspace = window.learningCompanionNative.exportWorkspaceJson();
      const beforeParsed = JSON.parse(beforeWorkspace);
      const bundle = JSON.parse(document.querySelector("#mirrorExport").value);
      const originalConfirm = window.confirm;
      let confirmMessage = "";
      window.confirm = (message) => {
        confirmMessage = String(message || "");
        return false;
      };
      const importResult = window.learningCompanionNative.importWorkspaceJson(JSON.stringify(bundle));
      window.confirm = originalConfirm;
      const afterParsed = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
      return {
        confirmMessage,
        canceled: importResult?.canceled === true,
        ok: importResult?.ok === true,
        workspaceUnchanged: beforeParsed.activeSessionId === afterParsed.activeSessionId
          && beforeParsed.sessions.length === afterParsed.sessions.length
          && afterParsed.sessions.some((session) => session.title === "新建学习主题")
      };
    };

    setLang("zh");
    const studyZh = snapshotStudyShell();
    const newSessionZh = await exerciseNewSessionZh();
    const mainLoopZh = await exerciseMainLoopZh();
    const synthesisConfirmZh = await exerciseSynthesisConfirmZh();
    const mirrorImportConfirmZh = await exerciseMirrorImportConfirmZh();
    const exportZh = snapshotExport();
    const workspace = JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId) || workspace.sessions[0];
    const importedPatch = {
      schema: "learning-companion.mobile-inbox-patch.v1",
      appVersion: 1,
      patchId: "bilingual_runtime_patch_001",
      createdAt: "2026-06-15T10:00:00+08:00",
      source: {
        generatedBy: "inbox.html",
        workspaceFingerprint: "bilingual-browser",
        topicId: session.id,
        topicTitle: session.title
      },
      target: {
        topicId: session.id,
        topicTitle: session.title
      },
      captures: [{
        id: "bilingual_runtime_capture_001",
        quote: "Returned reading note from another device.",
        thought: "Append-only return files should keep the bilingual loop visible.",
        timestamp: "02:15",
        sourceTitle: "Bilingual browser smoke source",
        sourceUrl: "https://example.com/bilingual-browser-smoke",
        materialType: "article",
        tags: "bilingual runtime",
        capturedAt: "2026-06-15T10:01:00+08:00"
      }]
    };
    const importResult = window.learningCompanionNative.importWorkspaceJson(JSON.stringify(importedPatch));
    const returnZh = snapshotReturn();
    setLang("en");
    const returnEn = snapshotReturn();
    const studyEn = snapshotStudyShell();
    const exportEn = snapshotExport();
    setLang("zh");
    const stagedPatch = {
      ...importedPatch,
      patchId: "bilingual_runtime_patch_002",
      captures: [{
        ...importedPatch.captures[0],
        id: "bilingual_runtime_capture_002",
        quote: "Second returned note staged for preview.",
        thought: "Preview copy should switch before apply.",
        capturedAt: "2026-06-15T10:02:00+08:00"
      }]
    };
    const previewZh = await stageReturnFile(stagedPatch);
    document.querySelector('[data-return-preview-action="discard"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const afterDiscardZh = snapshotReturn();

    return {
      importResult,
      studyZh,
      newSessionZh,
      mainLoopZh,
      synthesisConfirmZh,
      mirrorImportConfirmZh,
      exportZh,
      returnZh,
      returnEn,
      studyEn,
      exportEn,
      previewZh,
      afterDiscardZh,
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      overflow: {
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        innerWidth: window.innerWidth
      }
    };
  })()`, 15000);

  assert.equal(result.importResult.ok, true);
  assert.equal(result.importResult.kind, "mobile-inbox-patch");

  assert.equal(result.studyZh.htmlLang, "zh-CN");
  assert.equal(result.studyZh.bodyLanguage, "zh");
  assert.equal(result.studyZh.documentTitle, "Learning Companion | 学习伙伴");
  assert.equal(result.studyZh.sidebarAria, "学习主题");
  assert.equal(result.studyZh.sessionListAria, "主题列表");
  assert.equal(result.studyZh.searchPlaceholder, "搜索主题、笔记、摘录");
  assert.equal(result.studyZh.searchAria, "搜索主题、笔记、摘录");
  assert.equal(result.studyZh.newSessionTitle, "新建主题");
  assert.equal(result.studyZh.newSessionAria, "新建主题");
  assert.equal(result.studyZh.exportWorkspaceTitle, "导出工作区");
  assert.equal(result.studyZh.exportWorkspaceAria, "导出工作区");
  assert.equal(result.studyZh.importWorkspaceTitle, "导入工作区、镜像包或补丁");
  assert.equal(result.studyZh.importWorkspaceAria, "导入工作区、镜像包或补丁");
  assert.equal(result.studyZh.storageExport, "导出");
  assert.equal(result.studyZh.updateReload, "重新加载");
  assert.equal(result.studyZh.importDismiss, "好的");
  assert.deepEqual(result.studyZh.sourceLabels, ["主题", "来源", "链接", "类型"]);
  assert.equal(result.studyZh.pasteSource, "粘贴");
  assert.deepEqual(result.studyZh.materialTypes, ["文章", "视频", "文档", "课程", "书籍", "其他"]);
  assert.deepEqual(result.studyZh.focusModes, ["摘录", "综合", "复习"]);
  assert.equal(result.studyZh.timeLabel, "时间");
  assert.equal(result.studyZh.tagLabel, "标签");
  assert.equal(result.studyZh.activityAria, "专注动态");
  assert.equal(result.studyZh.focusBriefAria, "继续学习");
  assert.equal(result.studyZh.capturePaneAria, "快速摘录");
  assert.equal(result.studyZh.synthesisPaneAria, "综合");
  assert.equal(result.studyZh.deskReviewPaneAria, "专注复习");
  assert.equal(result.studyZh.editorPaneAria, "主题笔记");
  assert.equal(result.studyZh.inspectorAria, "学习检查器");
  assert.equal(result.studyZh.todayTabAria, "今日学习包");
  assert.equal(result.studyZh.capturesTabAria, "摘录");
  assert.equal(result.studyZh.reviewTabAria, "复习卡片");
  assert.equal(result.studyZh.exportTabAria, "导出");
  assert.deepEqual(result.studyZh.tabs, ["今日", "摘录", "复习", "导出"]);
  assert.equal(result.studyZh.quickHeading, "快速摘录");
  assert.equal(result.studyZh.captureStarterLabel, "写成");
  assert.deepEqual(result.studyZh.captureStarters, ["问题", "回答", "收获"]);
  assert.deepEqual(result.studyZh.captureButtons, ["摘录", "保存到复习", "填空"]);
  assert.match(result.studyZh.quotePlaceholder, /摘录|原文|句子|来源|字幕/);
  assert.match(result.studyZh.thoughtPlaceholder, /笔记|问题|收获|回答|想法/);
  assert.equal(result.studyZh.synthesisHeading, "综合");
  assert.deepEqual(result.studyZh.synthesisButtons, ["生成", "插入"]);
  assert.equal(result.studyZh.synthesisPlaceholder, "从摘录生成草稿，然后插入到笔记");
  assert.equal(result.studyZh.synthesisAria, "综合草稿");
  assert.equal(result.studyZh.notesHeading, "笔记");
  assert.deepEqual(result.studyZh.notesButtons, ["编辑", "预览"]);
  assert.equal(result.newSessionZh.titleInput, "新建学习主题");
  assert.match(result.newSessionZh.sessionListText, /新建学习主题/);
  assert.equal(result.newSessionZh.captureContextTarget, "到新建学习主题");
  assert.equal(result.newSessionZh.captureContextTargetTitle, "摘录会保存到 新建学习主题");
  assert.equal(result.newSessionZh.captureContextTargetAria, "显示摘录目标：新建学习主题");
  assert.match(result.newSessionZh.captureContextAria, /新建学习主题/);
  ["到期", "问题", "暂存", "已关闭", "摘录", "卡片"].forEach((label) => assert.ok(result.studyZh.todayStats.includes(label), `Chinese Today stats should include ${label}`));
  ["学习流", "阅读来源", "在 Mac 上摘录", "闭环"].forEach((label) => assert.match(result.studyZh.learningFlowText, new RegExp(label)));
  ["到期复习", "问题队列健康度", "问题闭环", "开放问题", "暂存问题", "今日回答", "今日已关闭", "最近摘录"].forEach((label) => assert.ok(result.studyZh.todaySections.includes(label), `Chinese Today sections should include ${label}`));
  assert.match(result.studyZh.studyDetailsText, /学习详情/);
  assert.equal(result.studyZh.reviewToolbar.reviewNext, "复习下一张");
  assert.match(result.studyZh.reviewToolbar.dueCount, /张到期/);
  assert.match(result.mainLoopZh.activityHintText, /下一步|如果之后/);
  assert.equal(result.mainLoopZh.activityHintButton, "添加想法");
  assert.match(result.mainLoopZh.captureStackText, /最近堆栈/);
  assert.match(result.mainLoopZh.captureStackText, /添加想法/);
  assert.match(result.mainLoopZh.captureStackText, /加入笔记|在笔记中/);
  assert.match(result.mainLoopZh.captureListText, /需要补上你的原因|添加想法/);
  assert.match(result.mainLoopZh.captureListText, /保存到复习/);
  assert.match(result.mainLoopZh.searchText, /查找/);
  assert.match(result.mainLoopZh.searchText, /匹配/);
  assert.match(result.mainLoopZh.searchText, /摘录|来源|卡片|笔记/);
  assert.match(result.mainLoopZh.timeActivityTitle, /时间已调整|时间未变化/);
  assert.match(result.mainLoopZh.timeActivityDetail, /摘录时间/);
  assert.equal(result.synthesisConfirmZh.confirmMessage, "用重新生成的版本替换已编辑的综合草稿？");
  assert.equal(result.synthesisConfirmZh.draftValue, "用户手动编辑的综合草稿");
  assert.equal(result.synthesisConfirmZh.status, "草稿已编辑");
  assert.match(result.mirrorImportConfirmZh.confirmMessage, /用镜像 bundle/);
  assert.match(result.mirrorImportConfirmZh.confirmMessage, /替换当前工作区/);
  assert.match(result.mirrorImportConfirmZh.confirmMessage, /个主题/);
  assert.equal(result.mirrorImportConfirmZh.canceled, true);
  assert.equal(result.mirrorImportConfirmZh.ok, false);
  assert.equal(result.mirrorImportConfirmZh.workspaceUnchanged, true);

  assert.equal(result.exportZh.htmlLang, "zh-CN");
  assert.equal(result.exportZh.workspaceTitle, "完整工作区（全部主题）");
  assert.match(result.exportZh.workspaceNote, /仅本地备份/);
  assert.equal(result.exportZh.copyWorkspace, "复制工作区");
  assert.equal(result.exportZh.saveWorkspace, "保存工作区");
  assert.equal(result.exportZh.reviewPackTitle, "复习包");
  assert.equal(result.exportZh.currentSessionTitle, "当前主题");
  assert.equal(result.exportZh.mirrorTitle, "镜像文件夹");
  assert.equal(result.exportZh.browserCaptureTitle, "浏览器摘录");
  assert.match(result.exportZh.browserCaptureNote, /来源页面/);
  assert.equal(result.exportZh.copyClip, "复制 Clip");

  assert.equal(result.returnZh.receiptHidden, false);
  assert.equal(result.returnZh.receiptTitle, "移动收件箱已导入");
  assert.match(result.returnZh.receiptDetail, /1 条新增/);
  assert.equal(result.returnZh.receiptAction, "查看最新摘录");
  assert.match(result.returnZh.nudgeMeta, /来自手机\/Windows/);
  assert.match(result.returnZh.nudgeText, /1 条新摘录/);
  assert.deepEqual(result.returnZh.nudgeButtons, ["查看最新摘录", "导入详情", "隐藏"]);
  assert.match(result.returnZh.handoffText, /设备流程/);
  assert.deepEqual(result.returnZh.handoffActions, ["导出镜像", "导入返回文件", "粘贴返回文件"]);

  assert.equal(result.returnEn.receiptTitle, "Mobile inbox imported");
  assert.match(result.returnEn.receiptDetail, /1 added/);
  assert.equal(result.returnEn.receiptAction, "View latest capture");
  assert.match(result.returnEn.nudgeMeta, /Returned from phone\/Windows/);
  assert.match(result.returnEn.nudgeText, /1 new capture/);
  assert.deepEqual(result.returnEn.nudgeButtons, ["View latest capture", "Import details", "Dismiss"]);

  assert.equal(result.studyEn.htmlLang, "en");
  assert.equal(result.studyEn.documentTitle, "Learning Companion");
  assert.equal(result.studyEn.sidebarAria, "Learning sessions");
  assert.equal(result.studyEn.sessionListAria, "Session list");
  assert.equal(result.studyEn.searchPlaceholder, "Search sessions, notes, captures");
  assert.equal(result.studyEn.searchAria, "Search sessions, notes, captures");
  assert.equal(result.studyEn.newSessionTitle, "New session");
  assert.equal(result.studyEn.newSessionAria, "New session");
  assert.equal(result.studyEn.exportWorkspaceTitle, "Export workspace");
  assert.equal(result.studyEn.exportWorkspaceAria, "Export workspace");
  assert.equal(result.studyEn.importWorkspaceTitle, "Import workspace, mirror bundle, or patch");
  assert.equal(result.studyEn.importWorkspaceAria, "Import workspace, mirror bundle, or patch");
  assert.equal(result.studyEn.storageExport, "Export");
  assert.equal(result.studyEn.updateReload, "Reload");
  assert.equal(result.studyEn.importDismiss, "OK");
  assert.deepEqual(result.studyEn.sourceLabels, ["Session", "Source", "URL", "Type"]);
  assert.deepEqual(result.studyEn.focusModes, ["Capture", "Synthesize", "Review"]);
  assert.deepEqual(result.studyEn.tabs, ["Today", "Captures", "Review", "Export"]);
  assert.equal(result.studyEn.quickHeading, "Quick Capture");
  assert.deepEqual(result.studyEn.captureButtons, ["Capture", "Save for recall", "Blank"]);
  assert.equal(result.studyEn.synthesisHeading, "Synthesis");
  assert.deepEqual(result.studyEn.synthesisButtons, ["Build", "Insert"]);
  assert.equal(result.studyEn.synthesisPlaceholder, "Build a draft from captures, then insert it into Notes");
  assert.equal(result.studyEn.synthesisAria, "Synthesis draft");
  assert.match(result.studyEn.learningFlowText, /Learning Flow/);
  assert.ok(result.studyEn.todaySections.includes("Question Queue Health"));

  assert.equal(result.exportEn.htmlLang, "en");
  assert.equal(result.exportEn.workspaceTitle, "Full Workspace (all sessions)");
  assert.equal(result.exportEn.copyWorkspace, "Copy Workspace");
  assert.equal(result.exportEn.saveWorkspace, "Save Workspace");
  assert.equal(result.exportEn.browserCaptureTitle, "Browser Capture");
  assert.match(result.exportEn.browserCaptureNote, /source page/);

  assert.match(result.previewZh.previewMeta, /准备应用/);
  assert.match(result.previewZh.previewTitle, /1 条返回摘录已准备好/);
  assert.match(result.previewZh.previewText, /1\/1 个文件已解析/);
  assert.match(result.previewZh.previewText, /收件箱 \+1 条摘录/);
  assert.match(result.previewZh.previewText, /将更改工作区/);
  assert.deepEqual(result.previewZh.previewButtons, ["应用返回文件", "丢弃"]);
  assert.match(result.previewZh.modeNote, /预览只在内存中/);
  assert.match(result.previewZh.actionHint, /检查已解析的返回文件/);
  assert.match(result.afterDiscardZh.handoffText, /设备流程/);
  assert.ok(
    Math.max(result.overflow.documentWidth, result.overflow.bodyWidth) <= result.overflow.innerWidth,
    `Expected no horizontal overflow, got doc=${result.overflow.documentWidth}, body=${result.overflow.bodyWidth}, inner=${result.overflow.innerWidth}`
  );

  const receipt = {
    schema: "learning-companion.bilingual-browser-smoke.v1",
    generatedAt: new Date().toISOString(),
    evidenceType: "CONTROLLED_BROWSER_RUNTIME_SMOKE",
    appUrl,
    runRoot,
    chromePath,
    runContext: {
      schema: "learning-companion.local-browser-smoke-run-context.v1",
      app: {
        url: appUrl,
        root
      },
      appRevision,
      browser: {
        chromePath,
        headless: true,
        profileMode: "throwaway-profile",
        profilePath: profile
      },
      viewport: {
        app: {
          width: 1280,
          height: 900,
          deviceScaleFactor: 1,
          mobile: false
        }
      },
      network: {
        mode: "LOCAL_APP_ONLY",
        localAppServer: "127.0.0.1 ephemeral"
      }
    },
    result: "PASS",
    elapsedMs: Date.now() - startedAtMs,
    checks: {
      staticShellChromeZh: true,
      staticShellChromeEnAfterSwitch: true,
      newSessionDefaultZh: true,
      exportCopyZh: true,
      exportCopyEn: true,
      studyShellZh: true,
      studyShellEnAfterSwitch: true,
      todayLearningFlowZh: true,
      reviewToolbarZh: true,
      mainLoopCaptureZh: true,
      synthesisOverwriteConfirmZh: true,
      mirrorImportConfirmZh: true,
      recentStackZh: true,
      searchResultsZh: true,
      activityHintZh: true,
      importReceiptZh: true,
      importReceiptEnAfterSwitch: true,
      returnedWorkNudgeZh: true,
      returnedWorkNudgeEnAfterSwitch: true,
      returnFilePreviewZh: true,
      noHorizontalOverflow: true
    },
    boundaries: {
      proves: [
        "A real headless browser executed runtime language switching for static shell chrome, search/input placeholders, export-panel copy, mobile inbox import receipt copy, returned-work nudge copy, and return-file preview copy.",
        "A representative main study shell switched English and Chinese for source controls, capture controls, synthesis controls, Today, Review, Recent Stack, Captures, Search, and Activity hints.",
        "The app imported a controlled append-only mobile inbox patch through the browser-exposed native bridge."
      ],
      doesNotProve: [
        "External reading/video website compatibility.",
        "HarmonyOS or Windows device runtime.",
        "Mac WKWebView native GUI behavior.",
        "Human learning comprehension."
      ]
    },
    observed: result
  };
  writeFileSync(outPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  cdp.close();
  console.log(`smoke_bilingual_browser_ok ${outPath}`);
} finally {
  chrome.kill("SIGTERM");
  await waitForProcessExit(chrome, 3000);
  server.close();
}

function parseArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] || "";
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
  const exceptionText = exceptions.map((event) => event.exceptionDetails?.exception?.description || event.exceptionDetails?.text || "").filter(Boolean).join("\\n");
  throw new Error(`Native bridge was not ready.${exceptionText ? `\\n${exceptionText}` : ""}`);
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

async function connectCdp(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const handlers = new Map();
  let id = 0;

  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", rejectOpen, { once: true });
  });

  socket.addEventListener("message", (message) => {
    const payload = JSON.parse(message.data);
    if (!payload.id || !pending.has(payload.id)) {
      if (payload.method && handlers.has(payload.method)) {
        handlers.get(payload.method).forEach((handler) => handler(payload.params || {}));
      }
      return;
    }
    const { resolveMessage, rejectMessage } = pending.get(payload.id);
    pending.delete(payload.id);
    if (payload.error) rejectMessage(new Error(payload.error.message));
    else resolveMessage(payload.result);
  });

  return {
    send(method, params = {}) {
      const messageId = ++id;
      socket.send(JSON.stringify({ id: messageId, method, params }));
      return new Promise((resolveMessage, rejectMessage) => {
        pending.set(messageId, { resolveMessage, rejectMessage });
      });
    },
    evaluate(expression, timeoutMs = 8000) {
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
    on(method, handler) {
      if (!handlers.has(method)) handlers.set(method, []);
      handlers.get(method).push(handler);
    },
    close() {
      socket.close();
    }
  };
}

function withTimeout(promise, timeoutMs, message) {
  return new Promise((resolveTimeout, rejectTimeout) => {
    const timeout = setTimeout(() => rejectTimeout(new Error(message)), timeoutMs);
    promise.then((value) => {
      clearTimeout(timeout);
      resolveTimeout(value);
    }, (error) => {
      clearTimeout(timeout);
      rejectTimeout(error);
    });
  });
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
