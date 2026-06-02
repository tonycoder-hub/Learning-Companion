import {
  WORKSPACE_SCHEMA,
  CAPTURE_DRAFT_LIMIT,
  MAX_INBOX_PATCH_BYTES,
  MAX_MIRROR_BUNDLE_BYTES,
  MAX_REVIEW_PROGRESS_PATCH_BYTES,
  MAX_SEARCH_QUERY_LENGTH,
  addCapture,
  addSession,
  applyMobileInboxPatch,
  applyReviewProgressPatch,
  buildFeishuPayload,
  buildCaptureDraftItems,
  buildFocusBrief,
  buildMirrorBundle,
  buildMirrorZip,
  buildReturnBaseFingerprint,
  buildResumeSource,
  buildSourceJumpUrl,
  buildTodayPack,
  captureDraftStatusText,
  captureHasAnswer,
  captureHasOpenQuestion,
  captureHasParkedQuestion,
  captureHasQuestion,
  captureHasReviewReadyAnswer,
  cleanUrl,
  deleteCapture,
  deleteReviewCard,
  extractSourceTimestamp,
  filterSessions,
  formatBytes,
  generateMarkdown,
  generateReviewPackMarkdown,
  generateSynthesisDraft,
  generateTodayMarkdown,
  getSynthesisStats,
  getSynthesisSourceStamp,
  getDueReviewCards,
  getDueReviewItems,
  getActiveSession,
  gradeCard,
  hasCaptureDraft,
  hasCaptureTextDraft,
  isMirrorBundle,
  isMobileInboxPatch,
  isMobileInboxPatchLike,
  isReviewProgressPatch,
  isReviewProgressPatchLike,
  normalizeCaptureDraft,
  promoteCapture,
  refreshAnsweredQuestionReviewCard,
  resolveCaptureDraftFocusOverride,
  sanitizeWorkspace,
  searchWorkspace,
  secondsToTimestamp,
  summarizeCaptureDraft,
  selectSession,
  setCaptureQuestionParked,
  setCaptureQuestionResolved,
  stripSourceTimestamp,
  timestampToSeconds,
  updateSession,
  workspaceBackupFingerprint,
  workspaceStorageNotice,
  workspaceFromPortableData
} from "./model.js";
import { renderMarkdown } from "./markdown.js";

const STORAGE_KEY = "learning-companion.workspace.v1";
const UI_PREFS_KEY = "learning-companion.ui.v1";
const UI_PREFS_SCHEMA_VERSION = 3;
const CAPTURE_DELETE_UNDO_MS = 10000;
const nativeSaveRequests = new Map();

const dom = {
  appShell: document.querySelector(".app-shell"),
  sidebar: document.querySelector(".sidebar"),
  inspector: document.querySelector(".inspector"),
  workspaceMeta: document.querySelector("#workspaceMeta"),
  searchInput: document.querySelector("#searchInput"),
  searchResults: document.querySelector("#searchResults"),
  newSessionBtn: document.querySelector("#newSessionBtn"),
  exportWorkspaceBtn: document.querySelector("#exportWorkspaceBtn"),
  importWorkspaceInput: document.querySelector("#importWorkspaceInput"),
  storageNotice: document.querySelector("#storageNotice"),
  storageNoticeText: document.querySelector("#storageNoticeText"),
  storageExportNowBtn: document.querySelector("#storageExportNowBtn"),
  importReceipt: document.querySelector("#importReceipt"),
  importReceiptTitle: document.querySelector("#importReceiptTitle"),
  importReceiptDetail: document.querySelector("#importReceiptDetail"),
  importReceiptDismissBtn: document.querySelector("#importReceiptDismissBtn"),
  sessionList: document.querySelector("#sessionList"),
  sessionTitle: document.querySelector("#sessionTitle"),
  sourceTitle: document.querySelector("#sourceTitle"),
  sourceUrl: document.querySelector("#sourceUrl"),
  pasteSourceBtn: document.querySelector("#pasteSourceBtn"),
  openSourceBtn: document.querySelector("#openSourceBtn"),
  materialType: document.querySelector("#materialType"),
  timestampInput: document.querySelector("#timestampInput"),
  timeBackBtn: document.querySelector("#timeBackBtn"),
  timeForwardBtn: document.querySelector("#timeForwardBtn"),
  sessionTags: document.querySelector("#sessionTags"),
  sidecarLayoutBtn: document.querySelector("#sidecarLayoutBtn"),
  captureMetric: document.querySelector("#captureMetric"),
  cardMetric: document.querySelector("#cardMetric"),
  dueMetric: document.querySelector("#dueMetric"),
  sizeMetric: document.querySelector("#sizeMetric"),
  activityTitle: document.querySelector("#activityTitle"),
  activityDetail: document.querySelector("#activityDetail"),
  activityUndoBtn: document.querySelector("#activityUndoBtn"),
  activityDetailsBtn: document.querySelector("#activityDetailsBtn"),
  sidecarRail: document.querySelector("#sidecarRail"),
  focusBriefKicker: document.querySelector("#focusBriefKicker"),
  focusBriefAction: document.querySelector("#focusBriefAction"),
  focusBriefDetail: document.querySelector("#focusBriefDetail"),
  focusBriefFacts: document.querySelector("#focusBriefFacts"),
  focusBriefSignals: document.querySelector("#focusBriefSignals"),
  focusBriefActionBtn: document.querySelector("#focusBriefActionBtn"),
  quoteInput: document.querySelector("#quoteInput"),
  thoughtInput: document.querySelector("#thoughtInput"),
  capturePane: document.querySelector("#capturePane"),
  captureContext: document.querySelector("#captureContext"),
  captureContextTarget: document.querySelector("#captureContextTarget"),
  captureContextIntent: document.querySelector("#captureContextIntent"),
  captureContextSource: document.querySelector("#captureContextSource"),
  captureContextTime: document.querySelector("#captureContextTime"),
  captureContextOpenBtn: document.querySelector("#captureContextOpenBtn"),
  captureStack: document.querySelector("#captureStack"),
  captureDraftStatus: document.querySelector("#captureDraftStatus"),
  reanchorCaptureDraftBtn: document.querySelector("#reanchorCaptureDraftBtn"),
  clearCaptureDraftBtn: document.querySelector("#clearCaptureDraftBtn"),
  captureBtn: document.querySelector("#captureBtn"),
  captureCardBtn: document.querySelector("#captureCardBtn"),
  captureClozeBtn: document.querySelector("#captureClozeBtn"),
  synthesisPane: document.querySelector("#synthesisPane"),
  synthesisDraft: document.querySelector("#synthesisDraft"),
  buildSynthesisBtn: document.querySelector("#buildSynthesisBtn"),
  insertSynthesisBtn: document.querySelector("#insertSynthesisBtn"),
  synthesisStatus: document.querySelector("#synthesisStatus"),
  deskReviewPane: document.querySelector("#deskReviewPane"),
  deskReviewNextBtn: document.querySelector("#deskReviewNextBtn"),
  deskReviewMeta: document.querySelector("#deskReviewMeta"),
  deskReviewCard: document.querySelector("#deskReviewCard"),
  deskReviewSource: document.querySelector("#deskReviewSource"),
  deskReviewPrompt: document.querySelector("#deskReviewPrompt"),
  deskReviewAnswer: document.querySelector("#deskReviewAnswer"),
  deskReviewRevealBtn: document.querySelector("#deskReviewRevealBtn"),
  deskReviewAgainBtn: document.querySelector("#deskReviewAgainBtn"),
  deskReviewGoodBtn: document.querySelector("#deskReviewGoodBtn"),
  notesEditor: document.querySelector("#notesEditor"),
  notesPreview: document.querySelector("#notesPreview"),
  notesEditBtn: document.querySelector("#notesEditBtn"),
  notesPreviewBtn: document.querySelector("#notesPreviewBtn"),
  saveState: document.querySelector("#saveState"),
  todaySummary: document.querySelector("#todaySummary"),
  todayList: document.querySelector("#todayList"),
  captureList: document.querySelector("#captureList"),
  reviewNextBtn: document.querySelector("#reviewNextBtn"),
  dueCount: document.querySelector("#dueCount"),
  reviewList: document.querySelector("#reviewList"),
  workspaceExport: document.querySelector("#workspaceExport"),
  reviewPackExport: document.querySelector("#reviewPackExport"),
  markdownExport: document.querySelector("#markdownExport"),
  payloadExport: document.querySelector("#payloadExport"),
  todayExport: document.querySelector("#todayExport"),
  copyWorkspaceBtn: document.querySelector("#copyWorkspaceBtn"),
  copyReviewPackBtn: document.querySelector("#copyReviewPackBtn"),
  copyMarkdownBtn: document.querySelector("#copyMarkdownBtn"),
  downloadWorkspaceBtn: document.querySelector("#downloadWorkspaceBtn"),
  downloadReviewPackBtn: document.querySelector("#downloadReviewPackBtn"),
  downloadMarkdownBtn: document.querySelector("#downloadMarkdownBtn"),
  copyPayloadBtn: document.querySelector("#copyPayloadBtn"),
  downloadPayloadBtn: document.querySelector("#downloadPayloadBtn"),
  copyTodayBtn: document.querySelector("#copyTodayBtn"),
  downloadTodayBtn: document.querySelector("#downloadTodayBtn"),
  copyMirrorBtn: document.querySelector("#copyMirrorBtn"),
  downloadMirrorBtn: document.querySelector("#downloadMirrorBtn"),
  downloadMirrorZipBtn: document.querySelector("#downloadMirrorZipBtn"),
  mirrorExport: document.querySelector("#mirrorExport"),
  copyBookmarkletBtn: document.querySelector("#copyBookmarkletBtn"),
  bookmarkletExport: document.querySelector("#bookmarkletExport"),
  toast: document.querySelector("#toast")
};

let workspace = loadWorkspace();
let uiPrefs = loadUiPrefs();
let activeTab = "today";
let notesMode = "edit";
let saveTimer = null;
let storageWarning = null;
let activeReviewKey = "";
let activeSearchIndex = -1;
let searchResultsCollapsed = false;
let lastActivity = null;
let lastImportReceipt = null;
let dismissedReturnNudgeKey = "";
let pendingCaptureUndo = null;
let pendingCaptureUndoTimer = null;
const revealedReviewCards = new Set();

pruneCurrentCaptureDrafts();
applyUrlCapture();
render();
registerServiceWorker();
installNativeBridge();

dom.newSessionBtn.addEventListener("click", () => {
  workspace = addSession(workspace, "New learning session");
  persistAndRender("Session created");
  dom.sessionTitle.focus();
  dom.sessionTitle.select();
});

dom.exportWorkspaceBtn.addEventListener("click", () => {
  exportWorkspace();
});

dom.storageExportNowBtn.addEventListener("click", exportWorkspace);
dom.importReceiptDismissBtn.addEventListener("click", () => {
  dismissedReturnNudgeKey = returnNudgeKey(lastImportReceipt);
  lastImportReceipt = null;
  renderImportReceipt();
  if (activeTab === "today") renderToday();
});

dom.importWorkspaceInput.addEventListener("change", async (event) => {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;
  try {
    if (files.length > 1) {
      await importReturnFiles(files);
      return;
    }
    const file = files[0];
    const imported = await readImportFile(file);
    importPortableData(imported);
  } catch (error) {
    const message = error.message || "Import failed";
    recordImportFailure(message, files[0]?.name || "");
    showToast(message);
  } finally {
    event.target.value = "";
  }
});

async function readImportFile(file) {
  if (file.size > MAX_MIRROR_BUNDLE_BYTES) {
    throw new Error("Import file is too large");
  }
  const imported = JSON.parse(await file.text());
  if (isMobileInboxPatchLike(imported) && file.size > MAX_INBOX_PATCH_BYTES) {
    throw new Error("Mobile inbox patch is too large.");
  }
  if (isReviewProgressPatchLike(imported) && file.size > MAX_REVIEW_PROGRESS_PATCH_BYTES) {
    throw new Error("Review progress patch is too large.");
  }
  return imported;
}

async function importReturnFiles(files) {
  const summary = emptyReturnFilesReceipt(files.length);
  const returnFiles = [];
  for (const file of files) {
    try {
      const imported = await readImportFile(file);
      if (!isMobileInboxPatch(imported) && !isReviewProgressPatch(imported)) {
        throw new Error("Multi-file import only accepts inbox or review return JSON.");
      }
      returnFiles.push({
        fileName: file.name,
        kind: isMobileInboxPatch(imported) ? "mobile-inbox-patch" : "review-progress-patch",
        imported
      });
    } catch (error) {
      addReturnFileImportError(summary, file.name, error.message || "Import failed");
    }
  }
  returnFiles.sort(compareReturnFiles);
  for (const item of returnFiles) {
    try {
      const result = importPortableData(item.imported, { quiet: true });
      addReturnFileImportResult(summary, item.fileName, result);
    } catch (error) {
      addReturnFileImportError(summary, item.fileName, error.message || "Import failed");
    }
  }
  summary.importedAt = new Date().toISOString();
  lastImportReceipt = summary;
  dismissedReturnNudgeKey = "";
  recordMirrorReturnImport(summary);
  setActivity(getActiveSession(workspace), {
    title: returnFilesActivityTitle(summary),
    detail: formatReturnFilesReceipt(summary),
    tab: "today",
    targetId: ""
  });
  finishReturnFileImport(`Return files: ${summary.processedFiles} processed, ${summary.failedFiles} failed`);
  if (summary.failedFiles) showToast(`${summary.failedFiles} return ${summary.failedFiles === 1 ? "file" : "files"} failed`);
}

function finishReturnFileImport(message) {
  activeTab = "today";
  persistAndRender(message);
  focusReturnFilesPanel();
}

function focusReturnFilesPanel() {
  const panel = document.querySelector(".handoff-card");
  if (!panel) return;
  panel.open = true;
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
  pulseNode(panel);
}

function compareReturnFiles(a, b) {
  const typeOrder = (item) => (item.kind === "mobile-inbox-patch" ? 0 : 1);
  const left = [
    typeOrder(a),
    String(a.imported?.createdAt || ""),
    String(a.imported?.patchId || ""),
    String(a.fileName || "")
  ];
  const right = [
    typeOrder(b),
    String(b.imported?.createdAt || ""),
    String(b.imported?.patchId || ""),
    String(b.fileName || "")
  ];
  return left.join("\u0000").localeCompare(right.join("\u0000"));
}

function importPortableData(imported, options = {}) {
  const focusTodayOnWorkspace = Boolean(options.focusTodayOnWorkspace);
  const quiet = Boolean(options.quiet);
  if (isMobileInboxPatch(imported)) {
    const result = applyMobileInboxPatch(workspace, imported);
    workspace = result.workspace;
    recordMirrorReturnImport(result.receipt);
    if (!quiet) {
      lastImportReceipt = result.receipt;
      dismissedReturnNudgeKey = "";
      setActivity(getActiveSession(workspace), {
        title: "Mobile inbox imported",
        detail: formatInboxReceipt(result.receipt),
        tab: "today",
        targetId: ""
      });
      finishReturnFileImport(`Inbox import: ${result.receipt.added} added`);
    }
    return {
      ok: true,
      kind: "mobile-inbox-patch",
      receipt: result.receipt,
      activeSessionId: workspace.activeSessionId,
      sessions: workspace.sessions.length
    };
  }
  if (isReviewProgressPatch(imported)) {
    const result = applyReviewProgressPatch(workspace, imported);
    workspace = result.workspace;
    recordMirrorReturnImport(result.receipt);
    if (!quiet) {
      lastImportReceipt = result.receipt;
      dismissedReturnNudgeKey = "";
      setActivity(getActiveSession(workspace), {
        title: "Review progress imported",
        detail: formatImportReceipt(result.receipt),
        tab: "today",
        targetId: ""
      });
      finishReturnFileImport(`Review import: ${result.receipt.applied} applied`);
    }
    return {
      ok: true,
      kind: "review-progress-patch",
      receipt: result.receipt,
      activeSessionId: workspace.activeSessionId,
      sessions: workspace.sessions.length
    };
  }
  if (isMobileInboxPatchLike(imported)) {
    throw new Error("Unsupported mobile inbox patch schema.");
  }
  if (isReviewProgressPatchLike(imported)) {
    throw new Error("Unsupported review progress patch schema.");
  }
  if (isMirrorBundle(imported) && hasUserWorkspace(workspace) && !confirmBundleImport(imported)) {
    showToast("Import canceled");
    return {
      ok: false,
      canceled: true
    };
  }
  workspace = workspaceFromPortableData(imported);
  if (focusTodayOnWorkspace) activeTab = "today";
  activeReviewKey = "";
  lastImportReceipt = null;
  revealedReviewCards.clear();
  persistAndRender("Workspace imported");
  return {
    ok: true,
    kind: isMirrorBundle(imported) ? "mirror-bundle" : "workspace",
    sessions: workspace.sessions.length,
    activeSessionId: workspace.activeSessionId
  };
}

dom.searchInput.addEventListener("input", () => {
  if (dom.searchInput.value.length > MAX_SEARCH_QUERY_LENGTH) {
    dom.searchInput.value = dom.searchInput.value.slice(0, MAX_SEARCH_QUERY_LENGTH);
  }
  searchResultsCollapsed = false;
  activeSearchIndex = dom.searchInput.value.trim() ? 0 : -1;
  renderSessions();
  renderSearchResults();
});

dom.searchInput.addEventListener("keydown", (event) => {
  if (event.isComposing) return;
  if (!["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) return;
  const results = currentSearchResults();
  if (event.key === "Escape") {
    if (!dom.searchInput.value) return;
    event.preventDefault();
    if (!searchResultsCollapsed && results.length) {
      searchResultsCollapsed = true;
      renderSearchResults();
      return;
    }
    dom.searchInput.value = "";
    searchResultsCollapsed = false;
    activeSearchIndex = -1;
    renderSessions();
    renderSearchResults();
    return;
  }
  if (!results.length) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    searchResultsCollapsed = false;
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = activeSearchIndex < 0 ? 0 : activeSearchIndex + direction;
    activeSearchIndex = (nextIndex + results.length) % results.length;
    renderSearchResults();
    return;
  }
  if (event.key === "Enter") {
    if (activeSearchIndex < 0) return;
    event.preventDefault();
    openSearchResult(results[Math.max(0, activeSearchIndex)]);
  }
});

["input", "change"].forEach((eventName) => {
  dom.sessionTitle.addEventListener(eventName, updateSessionFromFields);
  dom.sourceTitle.addEventListener(eventName, updateSessionFromFields);
  dom.sourceUrl.addEventListener(eventName, updateSessionFromFields);
  dom.materialType.addEventListener(eventName, updateSessionFromFields);
  dom.sessionTags.addEventListener(eventName, updateSessionFromFields);
});

dom.notesEditor.addEventListener("input", () => {
  const session = getActiveSession(workspace);
  workspace = updateSession(workspace, session.id, { notesMarkdown: dom.notesEditor.value });
  scheduleSave();
  renderFocusBrief();
  renderInspector();
  renderNotesMode();
});

dom.notesEditBtn.addEventListener("click", () => {
  notesMode = "edit";
  renderNotesMode();
});

dom.notesPreviewBtn.addEventListener("click", () => {
  notesMode = "preview";
  renderNotesMode();
});

dom.openSourceBtn.addEventListener("click", resumeCurrentSource);
dom.pasteSourceBtn.addEventListener("click", pasteSourceFromClipboard);
dom.captureContextTarget.addEventListener("click", showCaptureDestination);
dom.captureContextSource.addEventListener("click", showCaptureSource);
dom.captureContextOpenBtn.addEventListener("click", handleCaptureContextSourceAction);
dom.timeBackBtn.addEventListener("click", () => nudgeCaptureTime(-15));
dom.timeForwardBtn.addEventListener("click", () => nudgeCaptureTime(15));

dom.sidecarLayoutBtn.addEventListener("click", toggleSidecarLayout);
dom.activityDetailsBtn.addEventListener("click", showActivityDetails);
dom.activityUndoBtn.addEventListener("click", restorePendingCaptureDelete);
dom.focusBriefActionBtn.addEventListener("click", runFocusBriefAction);

window.addEventListener("pagehide", persist);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") persist();
});

dom.captureBtn.addEventListener("click", () => capture(false));
dom.captureCardBtn.addEventListener("click", () => capture(true));
dom.captureClozeBtn.addEventListener("click", () => capture("cloze"));
document.querySelectorAll("[data-capture-starter]").forEach((button) => {
  button.addEventListener("click", () => applyCaptureStarter(button.dataset.captureStarter));
});
dom.reanchorCaptureDraftBtn?.addEventListener("click", reanchorCurrentCaptureDraft);
dom.clearCaptureDraftBtn?.addEventListener("click", clearCurrentCaptureDraft);
[dom.quoteInput, dom.thoughtInput, dom.timestampInput].forEach((node) => {
  node.addEventListener("input", saveCurrentCaptureDraft);
  node.addEventListener("change", saveCurrentCaptureDraft);
});
dom.timestampInput.addEventListener("keydown", (event) => {
  if (event.isComposing) return;
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    nudgeCaptureTime(event.key === "ArrowUp" ? 15 : -15);
  }
});
dom.synthesisDraft.addEventListener("input", () => {
  dom.synthesisDraft.dataset.dirty = "true";
  renderSynthesisStatus();
});
dom.buildSynthesisBtn.addEventListener("click", () => {
  if (!confirmSynthesisOverwrite()) return;
  fillSynthesisDraft(true);
  renderSynthesisStatus();
  showToast("Synthesis draft built");
});
dom.insertSynthesisBtn.addEventListener("click", () => {
  const draft = dom.synthesisDraft.value.trim();
  if (!draft) {
    showToast("Build a draft first");
    return;
  }
  const session = getActiveSession(workspace);
  const nextNotes = upsertSynthesisBlock(session.notesMarkdown, draft, getSynthesisSourceStamp(session));
  workspace = updateSession(workspace, session.id, { notesMarkdown: nextNotes });
  setActivity(getActiveSession(workspace), {
    title: "Synthesis inserted",
    detail: "Notes preview now includes the current synthesis block.",
    tab: "captures",
    targetId: ""
  });
  notesMode = "preview";
  persistAndRender("Synthesis inserted");
});
dom.reviewNextBtn.addEventListener("click", () => {
  activeTab = "review";
  const [next] = getDueReviewItems(workspace);
  if (!next) {
    showToast("No due cards");
    renderInspector();
    return;
  }
  activeReviewKey = reviewKey(next.sessionId, next.card.id);
  revealedReviewCards.delete(activeReviewKey);
  renderInspector();
  renderDeskReview();
  const card = document.querySelector(`[data-review-key="${CSS.escape(activeReviewKey)}"]`);
  card?.scrollIntoView({ behavior: "smooth", block: "center" });
  card?.classList.add("pulse");
  setTimeout(() => card?.classList.remove("pulse"), 900);
});
dom.deskReviewNextBtn.addEventListener("click", selectNextDeskReview);
dom.deskReviewRevealBtn.addEventListener("click", () => {
  const item = getActiveReviewItem();
  if (!item) return;
  activeReviewKey = reviewKey(item.sessionId, item.card.id);
  revealedReviewCards.add(activeReviewKey);
  renderDeskReview();
  renderInspector();
});
dom.deskReviewAgainBtn.addEventListener("click", () => gradeActiveReview("again"));
dom.deskReviewGoodBtn.addEventListener("click", () => gradeActiveReview("good"));

document.addEventListener("keydown", (event) => {
  const isMod = event.metaKey || event.ctrlKey;
  if (handleReviewShortcut(event)) return;
  if (isMod && event.shiftKey && event.key.toLowerCase() === "c") {
    event.preventDefault();
    event.stopPropagation();
    focusQuickCapture();
    return;
  }
  if (isMod && event.key === "Enter") {
    event.preventDefault();
    capture(event.shiftKey);
    return;
  }
  if (isMod && event.key.toLowerCase() === "s") {
    event.preventDefault();
    persistAndRender("Saved");
    return;
  }
  if (isMod && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (uiPrefs.sidecarLayout) {
      uiPrefs = { ...uiPrefs, sidecarLayout: false };
      saveUiPrefs();
      renderShellMode();
      renderActivity(getActiveSession(workspace));
    }
    dom.searchInput.focus();
    dom.searchInput.select();
    return;
  }
  if (isMod && event.key === "\\") {
    if (isEditableTarget(event.target)) return;
    event.preventDefault();
    toggleSidecarLayout();
  }
});

document.querySelectorAll("[data-focus-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    const session = getActiveSession(workspace);
    workspace = updateSession(workspace, session.id, { focusMode: button.dataset.focusMode });
    if (button.dataset.focusMode === "review") activeTab = "review";
    if (button.dataset.focusMode === "capture") activeTab = "captures";
    if (button.dataset.focusMode === "synthesize") activeTab = "captures";
    persistAndRender();
  });
});

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    activeTab = button.dataset.tab;
    renderInspector();
  });
});

dom.copyWorkspaceBtn.addEventListener("click", () => copyText(dom.workspaceExport.value, "Workspace copied"));
dom.copyReviewPackBtn.addEventListener("click", () => copyText(dom.reviewPackExport.value, "Review pack copied"));
dom.copyMarkdownBtn.addEventListener("click", () => copyText(dom.markdownExport.value, "Markdown copied"));
dom.copyPayloadBtn.addEventListener("click", () => copyText(dom.payloadExport.value, "JSON copied"));
dom.copyTodayBtn.addEventListener("click", () => copyText(dom.todayExport.value, "Today study pack copied"));
dom.copyMirrorBtn.addEventListener("click", () => copyText(dom.mirrorExport.value, "Mirror bundle copied"));
dom.copyBookmarkletBtn.addEventListener("click", () => copyText(dom.bookmarkletExport.value, "Capture bookmarklet copied"));
dom.downloadWorkspaceBtn.addEventListener("click", exportWorkspace);
dom.downloadReviewPackBtn.addEventListener("click", async () => {
  if (await saveTextFile("LEARNING_COMPANION_REVIEW_PACK.md", dom.reviewPackExport.value, "text/markdown")) {
    showToast(saveCompleteMessage("Review pack"));
  }
});
dom.downloadMarkdownBtn.addEventListener("click", async () => {
  const session = getActiveSession(workspace);
  if (await saveTextFile(`${slugify(session.title)}.md`, generateMarkdown(session), "text/markdown")) {
    showToast(saveCompleteMessage("Markdown"));
  }
});
dom.downloadPayloadBtn.addEventListener("click", async () => {
  const session = getActiveSession(workspace);
  if (await saveTextFile(`${slugify(session.title)}.feishu.json`, JSON.stringify(buildFeishuPayload(session), null, 2), "application/json")) {
    showToast(saveCompleteMessage("JSON"));
  }
});
dom.downloadTodayBtn.addEventListener("click", async () => {
  if (await saveTextFile("TODAY.md", dom.todayExport.value, "text/markdown")) {
    showToast(saveCompleteMessage("Today"));
  }
});
dom.downloadMirrorBtn.addEventListener("click", async () => {
  if (await saveTextFile("learning-companion-feishu-mirror.json", dom.mirrorExport.value, "application/json")) {
    showToast(saveCompleteMessage("Mirror"));
    recordReturnFileExportReceipt("Mirror JSON");
  }
});
dom.downloadMirrorZipBtn.addEventListener("click", async () => {
  const zip = buildMirrorZip(workspace);
  if (await saveBytesFile(zip.filename, zip.data, zip.mediaType)) {
    showToast(saveCompleteMessage("Mirror ZIP"));
    recordReturnFileExportReceipt("Mirror ZIP");
  }
});

function loadWorkspace() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return sanitizeWorkspace(null);
    return sanitizeWorkspace(JSON.parse(raw));
  } catch {
    return sanitizeWorkspace(null);
  }
}

function loadUiPrefs() {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    if (!raw) return defaultUiPrefs();
    const parsed = JSON.parse(raw);
    return {
      schemaVersion: UI_PREFS_SCHEMA_VERSION,
      sidecarLayout: Boolean(parsed.sidecarLayout),
      captureDrafts: normalizeCaptureDrafts(parsed.captureDrafts),
      workspaceBackup: normalizeWorkspaceBackup(parsed.workspaceBackup),
      mirrorHandoff: normalizeMirrorHandoff(parsed.mirrorHandoff)
    };
  } catch {
    return defaultUiPrefs();
  }
}

function saveUiPrefs() {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify({
      schemaVersion: UI_PREFS_SCHEMA_VERSION,
      sidecarLayout: Boolean(uiPrefs.sidecarLayout),
      captureDrafts: pruneCaptureDrafts(uiPrefs.captureDrafts),
      workspaceBackup: normalizeWorkspaceBackup(uiPrefs.workspaceBackup),
      mirrorHandoff: normalizeMirrorHandoff(uiPrefs.mirrorHandoff)
    }));
  } catch {
    // Layout preference is non-critical; workspace persistence handles its own warning path.
  }
}

function defaultUiPrefs() {
  return {
    schemaVersion: UI_PREFS_SCHEMA_VERSION,
    sidecarLayout: false,
    captureDrafts: {},
    workspaceBackup: null,
    mirrorHandoff: null
  };
}

function normalizeWorkspaceBackup(value) {
  if (!value || typeof value !== "object") return null;
  const fingerprint = cleanBackupText(value.fingerprint, 24);
  const exportedAt = cleanBackupText(value.exportedAt, 32);
  if (!fingerprint || !exportedAt) return null;
  return { fingerprint, exportedAt };
}

function cleanBackupText(value, limit) {
  return String(value || "").replace(/[^a-zA-Z0-9:._-]/g, "").slice(0, limit);
}

function normalizeMirrorHandoff(value) {
  if (!value || typeof value !== "object") return null;
  const returnBaseFingerprint = cleanBackupText(value.returnBaseFingerprint, 64);
  const exportedAt = cleanBackupText(value.exportedAt, 32);
  const kind = normalizeMirrorKind(value.kind);
  const lastReturnImport = normalizeMirrorReturnImport(value.lastReturnImport);
  const exportState = returnBaseFingerprint && exportedAt && kind
    ? { returnBaseFingerprint, exportedAt, kind }
    : {};
  if (!Object.keys(exportState).length && !lastReturnImport) return null;
  return {
    ...exportState,
    ...(lastReturnImport ? { lastReturnImport } : {})
  };
}

function normalizeMirrorReturnImport(value) {
  if (!value || typeof value !== "object") return null;
  const importedAt = cleanBackupText(value.importedAt, 32);
  if (!importedAt) return null;
  return {
    importedAt,
    sourceFingerprint: cleanBackupText(value.sourceFingerprint, 64),
    fileCount: clampSmallCount(value.fileCount),
    newItems: clampSmallCount(value.newItems),
    baseChangedFiles: clampSmallCount(value.baseChangedFiles),
    legacyBasisFiles: clampSmallCount(value.legacyBasisFiles)
  };
}

function normalizeMirrorKind(value) {
  const raw = String(value || "").replace(/\s+/g, " ").trim().slice(0, 32);
  const compact = raw.replace(/\s/g, "");
  if (compact === "MirrorJSON") return "Mirror JSON";
  if (compact === "MirrorZIP") return "Mirror ZIP";
  return raw;
}

function clampSmallCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(999, Math.floor(count));
}

function normalizeCaptureDrafts(value) {
  if (!value || typeof value !== "object") return {};
  const entries = Object.entries(value)
    .map(([sessionId, draft]) => [String(sessionId || "").slice(0, 128), normalizeCaptureDraft(draft)])
    .filter(([sessionId, draft]) => sessionId && hasCaptureDraft(draft))
    .sort((a, b) => new Date(b[1].updatedAt).getTime() - new Date(a[1].updatedAt).getTime())
    .slice(0, CAPTURE_DRAFT_LIMIT);
  return Object.fromEntries(entries);
}

function pruneCaptureDrafts(value) {
  const activeIds = new Set(workspace.sessions.map((session) => session.id));
  return Object.fromEntries(Object.entries(normalizeCaptureDrafts(value))
    .filter(([sessionId]) => activeIds.has(sessionId)));
}

function pruneCurrentCaptureDrafts() {
  const current = normalizeCaptureDrafts(uiPrefs.captureDrafts);
  const pruned = pruneCaptureDrafts(current);
  if (JSON.stringify(current) === JSON.stringify(pruned)) return;
  uiPrefs = {
    ...uiPrefs,
    captureDrafts: pruned
  };
  saveUiPrefs();
}

function getCaptureDraft(sessionId) {
  return normalizeCaptureDraft(uiPrefs.captureDrafts?.[sessionId]);
}

function setCaptureDraft(sessionId, draftInput) {
  const sessionKey = String(sessionId || "").slice(0, 128);
  if (!sessionKey) return;
  const draft = normalizeCaptureDraft({
    ...draftInput,
    updatedAt: new Date().toISOString()
  });
  const captureDrafts = { ...(uiPrefs.captureDrafts || {}) };
  if (hasCaptureDraft(draft)) captureDrafts[sessionKey] = draft;
  else delete captureDrafts[sessionKey];
  uiPrefs = {
    ...uiPrefs,
    captureDrafts
  };
  saveUiPrefs();
}

function saveCurrentCaptureDraft() {
  const session = getActiveSession(workspace);
  const existingDraft = getCaptureDraft(session.id);
  const snapshot = draftSourceSnapshotFor(session.id, dom.sourceTitle.value, dom.sourceUrl.value);
  const answersQuestionCaptureId = answerDraftTargetForThought(existingDraft.answersQuestionCaptureId, dom.thoughtInput.value);
  setCaptureDraft(session.id, {
    quote: dom.quoteInput.value,
    thought: dom.thoughtInput.value,
    timestamp: dom.timestampInput.value,
    answersQuestionCaptureId,
    ...snapshot
  });
  const draft = getCaptureDraft(session.id);
  if (resolveCaptureDraftFocusOverride(null, draft).isFresh) {
    setActivity(session, {
      title: "Capture draft waiting",
      detail: summarizeCaptureDraft(draft),
      tab: "captures",
      targetId: ""
    });
  } else {
    clearCaptureDraftActivity(session.id);
  }
  renderCaptureDraftStatus(session, draft);
  renderOpenSourceButton(session);
  renderCaptureContext(session);
  renderActivity(session);
  renderFocusBrief();
  if (activeTab === "today") renderToday();
}

function clearCurrentCaptureDraft() {
  setCaptureDraft(getActiveSession(workspace).id, {});
  clearCaptureDraftActivity(getActiveSession(workspace).id);
  renderCaptureDraft(getActiveSession(workspace));
  renderOpenSourceButton(getActiveSession(workspace));
  renderCaptureContext(getActiveSession(workspace));
  renderActivity(getActiveSession(workspace));
  renderFocusBrief();
  if (activeTab === "today") renderToday();
  dom.quoteInput.focus();
}

function reanchorCurrentCaptureDraft() {
  const session = getActiveSession(workspace);
  const draft = getCaptureDraft(session.id);
  if (!hasCaptureDraft(draft)) return;
  setCaptureDraft(session.id, {
    ...draft,
    sourceTitle: session.sourceTitle,
    sourceUrl: session.sourceUrl
  });
  setActivity(session, {
    title: "Draft source updated",
    detail: `Draft now uses ${sourceSnapshotLabel(session)}.`,
    tab: "captures",
    targetId: ""
  });
  renderCaptureDraftStatus(session);
  renderActivity(session);
  renderFocusBrief();
  if (activeTab === "today") renderToday();
}

function renderCaptureDraft(session) {
  const draft = getCaptureDraft(session.id);
  dom.quoteInput.value = draft.quote;
  dom.thoughtInput.value = draft.thought;
  dom.timestampInput.value = draft.timestamp;
  renderCaptureDraftStatus(session, draft);
}

function renderCaptureDraftStatus(session, draft = getCaptureDraft(session.id)) {
  const hasDraft = hasCaptureDraft(draft);
  const sourceChanged = hasDraft && captureDraftSourceChanged(session, draft);
  dom.captureDraftStatus.textContent = sourceChanged ? "Source changed" : captureDraftStatusText(draft);
  dom.captureDraftStatus.classList.toggle("warn", sourceChanged);
  dom.captureDraftStatus.title = sourceChanged
    ? `Draft began on ${sourceSnapshotLabel(draft)}; current source is ${sourceSnapshotLabel(session)}.`
    : "";
  if (dom.reanchorCaptureDraftBtn) {
    dom.reanchorCaptureDraftBtn.hidden = !sourceChanged;
    dom.reanchorCaptureDraftBtn.title = sourceChanged ? "Use the current source for this local draft" : "";
    dom.reanchorCaptureDraftBtn.setAttribute("aria-label", "Use current source for this draft");
  }
  if (dom.clearCaptureDraftBtn) {
    dom.clearCaptureDraftBtn.hidden = !hasDraft;
  }
}

function captureDraftSourceChanged(session, draft) {
  const draftUrl = canonicalDraftSourceUrl(draft.sourceUrl);
  const sessionUrl = canonicalDraftSourceUrl(session.sourceUrl);
  const draftTitle = normalizeInboundSourceTitle(draft.sourceTitle);
  const sessionTitle = normalizeInboundSourceTitle(session.sourceTitle);
  // Legacy local drafts did not store source snapshots; without origin evidence, avoid false warnings.
  if (!draftUrl && !draftTitle) return false;
  if (draftUrl && sessionUrl) return draftUrl !== sessionUrl;
  const draftSource = draftTitle || draftUrl;
  const sessionSource = sessionTitle || sessionUrl;
  return Boolean(draftSource && sessionSource && draftSource !== sessionSource);
}

function draftSourceSnapshotFor(sessionId, sourceTitle, sourceUrl) {
  const draft = getCaptureDraft(sessionId);
  // A draft's source snapshot is its origin, so keep it stable until the draft is captured or cleared.
  return {
    sourceTitle: draft.sourceTitle || sourceTitle,
    sourceUrl: draft.sourceUrl || canonicalDraftSourceUrl(sourceUrl)
  };
}

function canonicalDraftSourceUrl(value) {
  return normalizeInboundMatchUrl(value) || stripSourceTimestamp(value) || cleanUrl(value);
}

function sourceSnapshotLabel(source) {
  return source?.sourceTitle || readableSourceHost(source?.sourceUrl) || "(no source)";
}

function applyUrlCapture() {
  const params = new URLSearchParams(window.location.search);
  const quote = params.get("quote");
  const thought = params.get("thought");
  const sourceUrl = params.get("sourceUrl") || params.get("url");
  const sourceTitle = params.get("sourceTitle") || params.get("title");
  const cleanSourceUrl = stripSourceTimestamp(sourceUrl) || sourceUrl;
  const timestamp = params.get("t") || params.get("time") || extractSourceTimestamp(sourceUrl);
  const autoCapture = params.get("capture") === "1" || params.get("autoCapture") === "1";
  if (!quote && !thought && !sourceUrl && !sourceTitle) return;

  const target = resolveInboundCaptureTarget(workspace, { sourceUrl: cleanSourceUrl, sourceTitle });
  const preserveSessionSource = target.resolution !== "active-fallback";
  const activeFallbackSourceUpdated = target.resolution === "active-fallback" && (
    (cleanSourceUrl && cleanUrl(cleanSourceUrl) !== cleanUrl(target.session.sourceUrl)) ||
    (sourceTitle && normalizeInboundSourceTitle(sourceTitle) !== normalizeInboundSourceTitle(target.session.sourceTitle))
  );
  workspace = selectSession(workspace, target.session.id);
  workspace = updateSession(workspace, target.session.id, {
    sourceUrl: preserveSessionSource
      ? target.session.sourceUrl || cleanSourceUrl
      : cleanSourceUrl || target.session.sourceUrl,
    sourceTitle: preserveSessionSource
      ? target.session.sourceTitle || sourceTitle
      : sourceTitle || target.session.sourceTitle,
    materialType: inferInboundMaterialType(cleanSourceUrl, timestamp, target.session.materialType),
    focusMode: "capture"
  });
  activeTab = "captures";
  if (autoCapture && (quote || thought)) {
    workspace = addCapture(workspace, target.session.id, {
      quote: quote || "",
      thought: thought || "",
      timestamp: timestamp || "",
      tags: target.session.tags,
      sourceTitle: sourceTitle || "",
      sourceUrl: cleanSourceUrl || "",
      sourceProvenance: "inbound"
    });
    setCaptureDraft(target.session.id, {});
    const updated = getActiveSession(workspace);
    setActivity(updated, {
      title: "Browser capture saved",
      detail: `${summarizeCapture(updated.captures[0])} · ${formatInboundResolution(target.resolution, activeFallbackSourceUpdated)}`,
      tab: "captures",
      targetId: updated.captures[0]?.id
    });
    showToast("Browser capture saved");
  } else {
    setCaptureDraft(target.session.id, {
      quote: quote || "",
      thought: thought || "",
      timestamp: timestamp || ""
    });
    renderCaptureDraft(getActiveSession(workspace));
    const updated = getActiveSession(workspace);
    setActivity(updated, {
      title: quote || thought ? "Browser clip staged" : "Browser source updated",
      detail: `${sourceTitle || updated.sourceTitle || "Source"}${timestamp ? ` @ ${timestamp}` : ""} · ${formatInboundResolution(target.resolution, activeFallbackSourceUpdated)}`,
      tab: "captures",
      targetId: ""
    });
    showToast(quote || thought ? "Browser clip staged" : "Browser source updated");
  }
  history.replaceState({}, "", window.location.pathname);
  persist();
}

function resolveInboundCaptureTarget(currentWorkspace, inbound) {
  const active = getActiveSession(currentWorkspace);
  const normalizedSourceUrl = normalizeInboundMatchUrl(inbound.sourceUrl);
  if (normalizedSourceUrl) {
    const match = findInboundUrlMatch(currentWorkspace, active, normalizedSourceUrl);
    if (match) {
      return {
        session: match,
        resolution: match.id === active.id ? "active-source" : "matched-source-url"
      };
    }
  }

  const normalizedTitle = normalizeInboundSourceTitle(inbound.sourceTitle);
  if (!normalizedSourceUrl && normalizedTitle) {
    const match = findInboundTitleMatch(currentWorkspace, active, normalizedTitle);
    if (match) {
      return {
        session: match,
        resolution: match.id === active.id ? "active-source" : "matched-source-title"
      };
    }
  }

  return {
    session: active,
    resolution: "active-fallback"
  };
}

function findInboundUrlMatch(currentWorkspace, active, normalizedSourceUrl) {
  if (normalizeInboundMatchUrl(active.sourceUrl) === normalizedSourceUrl) return active;
  return [...currentWorkspace.sessions]
    .filter((session) => session.id !== active.id)
    .sort((a, b) => (new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()) || a.id.localeCompare(b.id))
    .find((session) => normalizeInboundMatchUrl(session.sourceUrl) === normalizedSourceUrl);
}

function findInboundTitleMatch(currentWorkspace, active, normalizedTitle) {
  if (!normalizeInboundMatchUrl(active.sourceUrl) && normalizeInboundSourceTitle(active.sourceTitle) === normalizedTitle) {
    return active;
  }
  return [...currentWorkspace.sessions]
    .filter((session) => session.id !== active.id && !normalizeInboundMatchUrl(session.sourceUrl))
    .sort((a, b) => (new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()) || a.id.localeCompare(b.id))
    .find((session) => normalizeInboundSourceTitle(session.sourceTitle) === normalizedTitle);
}

function normalizeInboundSourceTitle(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeInboundMatchUrl(value) {
  const href = cleanUrl(value || "");
  if (!href) return "";
  try {
    const url = new URL(href);
    url.hash = "";
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    [...url.searchParams.keys()].forEach((key) => {
      if (/^utm_/i.test(key) || ["fbclid", "gclid", "igshid", "mc_cid", "mc_eid"].includes(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    });
    if (isKnownVideoHost(url.hostname)) {
      ["t", "start", "time_continue"].forEach((key) => url.searchParams.delete(key));
    }
    url.searchParams.sort();
    return url.href;
  } catch {
    return href;
  }
}

function inferInboundMaterialType(sourceUrl, timestamp, fallback) {
  const href = cleanUrl(sourceUrl || "");
  if (!href) return fallback;
  try {
    const host = new URL(href).hostname.toLowerCase();
    if (isKnownVideoHost(host) && ["article", "other"].includes(fallback)) {
      return "video";
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function isKnownVideoHost(hostname) {
  return /(^|\.)youtube\.com$|^youtu\.be$|(^|\.)bilibili\.com$|(^|\.)vimeo\.com$/.test(String(hostname || "").toLowerCase());
}

function formatInboundResolution(resolution, sourceUpdated = false) {
  return {
    "active-source": "active source",
    "matched-source-url": "matched existing source URL",
    "matched-source-title": "matched existing source title",
    "active-fallback": sourceUpdated ? "no matching topic; saved to current topic and updated source" : "current topic"
  }[resolution] || "current topic";
}

function updateSessionFromFields(event) {
  const session = getActiveSession(workspace);
  let sourceUrl = dom.sourceUrl.value;
  let stagedSourceTimestamp = "";
  if (event?.target === dom.sourceUrl) {
    const extractedTimestamp = extractSourceTimestamp(sourceUrl);
    const strippedSourceUrl = stripSourceTimestamp(sourceUrl);
    if (extractedTimestamp && !dom.timestampInput.value.trim()) {
      dom.timestampInput.value = extractedTimestamp;
      stagedSourceTimestamp = extractedTimestamp;
      const snapshot = draftSourceSnapshotFor(session.id, dom.sourceTitle.value, strippedSourceUrl || sourceUrl);
      setCaptureDraft(session.id, {
        quote: dom.quoteInput.value,
        thought: dom.thoughtInput.value,
        timestamp: extractedTimestamp,
        ...snapshot
      });
      renderCaptureDraftStatus(session);
    }
    if (strippedSourceUrl) {
      sourceUrl = strippedSourceUrl;
      if (event.type === "change" && strippedSourceUrl !== cleanUrl(dom.sourceUrl.value)) {
        dom.sourceUrl.value = strippedSourceUrl;
      }
    }
  }
  workspace = updateSession(workspace, session.id, {
    title: dom.sessionTitle.value,
    sourceTitle: dom.sourceTitle.value,
    sourceUrl,
    materialType: dom.materialType.value,
    tags: dom.sessionTags.value
  });
  scheduleSave();
  renderOpenSourceButton(getActiveSession(workspace));
  renderCaptureContext(getActiveSession(workspace));
  renderCaptureDraftStatus(getActiveSession(workspace));
  renderFocusBrief();
  renderSessions();
  renderInspector();
  if (stagedSourceTimestamp) {
    setActivity(getActiveSession(workspace), {
      title: "Source time staged",
      detail: `Timestamp ${stagedSourceTimestamp} saved as a capture draft. Open source will include that time.`,
      tab: "captures",
      targetId: ""
    });
    renderActivity(getActiveSession(workspace));
    pulseNode(dom.timestampInput);
  }
}

function capture(promoteToReview) {
  const session = getActiveSession(workspace);
  if (!dom.quoteInput.value.trim() && !dom.thoughtInput.value.trim()) {
    showToast("Add quote or thought");
    dom.quoteInput.focus();
    return;
  }
  const cloze = promoteToReview === "cloze" ? buildCloze() : null;
  if (promoteToReview === "cloze" && !cloze) {
    showToast("Select text in the quote");
    dom.quoteInput.focus();
    return;
  }
  const draft = getCaptureDraft(session.id);
  const answersQuestionCaptureId = answerDraftTargetForThought(draft.answersQuestionCaptureId, dom.thoughtInput.value, { requireReviewReady: true });
  workspace = addCapture(workspace, session.id, {
    quote: dom.quoteInput.value,
    thought: dom.thoughtInput.value,
    timestamp: dom.timestampInput.value,
    tags: dom.sessionTags.value,
    answersQuestionCaptureId
  }, {
    promoteToReview: Boolean(promoteToReview),
    reviewPrompt: cloze?.prompt,
    reviewAnswer: cloze?.answer
  });
  const updated = getActiveSession(workspace);
  const isCloze = promoteToReview === "cloze";
  const isLinkedAnswer = Boolean(answersQuestionCaptureId);
  const savedCapture = updated.captures[0];
  const savedCard = promoteToReview ? updated.reviewCards[0] : null;
  setCaptureDraft(session.id, {
    timestamp: dom.timestampInput.value,
    sourceTitle: updated.sourceTitle,
    sourceUrl: updated.sourceUrl
  });
  setActivity(updated, captureSaveActivity(updated, savedCapture, {
    isCloze,
    isLinkedAnswer,
    savedCard,
    promotedToReview: Boolean(promoteToReview)
  }));
  dom.quoteInput.value = "";
  dom.thoughtInput.value = "";
  persistAndRender(captureSaveToast(savedCapture, { isCloze, isLinkedAnswer, promotedToReview: Boolean(promoteToReview) }));
  dom.quoteInput.focus();
}

function captureSaveActivity(session, capture, options = {}) {
  if (options.isCloze) {
    return {
      title: "Cloze card saved",
      detail: `${summarizeCapture(capture)} · Review card is due now. Reveal it from Review when you are ready.`,
      tab: "review",
      targetId: options.savedCard?.id || "",
      actionLabel: "Review"
    };
  }
  if (options.promotedToReview) {
    return {
      title: "Capture and card saved",
      detail: `${summarizeCapture(capture)} · A review card was created, so the point can come back when it is due.`,
      tab: "review",
      targetId: options.savedCard?.id || "",
      actionLabel: "Review"
    };
  }
  if (captureHasQuestion(capture)) {
    return {
      title: "Question saved",
      detail: "Added to Open Questions. Next: answer it, park it, make a card, or resolve it from Today.",
      tab: "today",
      targetId: "",
      targetSection: "open_questions",
      actionLabel: "Questions"
    };
  }
  if (captureHasAnswer(capture)) {
    const linked = Boolean(options.isLinkedAnswer);
    return {
      title: linked ? "Answer saved" : "Answer note saved",
      detail: linked
        ? "Closed the linked question and kept this answer as evidence in Answers Today."
        : "Saved in Answers Today. It did not close a question because no question was linked.",
      tab: "today",
      targetId: "",
      targetSection: linked ? "closed_questions" : "answers_today",
      actionLabel: linked ? "Closed" : "Answers"
    };
  }
  if (captureHasTakeawayPrefix(capture)) {
    return {
      title: "Takeaway saved",
      detail: "Kept as a takeaway. Turn it into a card if it needs recall, or build synthesis after a few captures.",
      tab: "captures",
      targetId: capture?.id || "",
      actionLabel: "Capture"
    };
  }
  if (captureIsQuoteOnly(capture)) {
    return {
      title: "Highlight saved",
      detail: `${summarizeCapture(capture)} · Saved locally as a highlight; the source page is unchanged. Add a thought or make a card when recall matters.`,
      tab: "captures",
      targetId: capture?.id || "",
      actionLabel: "View highlight"
    };
  }
  if (captureHasStarterPrefix(capture, "question")) {
    return {
      title: "Question draft saved",
      detail: "Saved as a capture because the Question draft still needs a body before entering Open Questions.",
      tab: "captures",
      targetId: capture?.id || "",
      actionLabel: "Capture"
    };
  }
  return {
    title: "Capture saved",
    detail: `${summarizeCapture(capture)} · Keep reading, make a card when recall matters, or build synthesis later.`,
    tab: "captures",
    targetId: capture?.id || "",
    actionLabel: "Capture"
  };
}

function captureSaveToast(capture, options = {}) {
  if (options.isCloze || options.promotedToReview) return "Capture + card saved";
  if (captureHasQuestion(capture)) return "Question saved";
  if (captureHasAnswer(capture)) return options.isLinkedAnswer ? "Answer saved" : "Answer note saved";
  if (captureHasTakeawayPrefix(capture)) return "Takeaway saved";
  if (captureIsQuoteOnly(capture)) return "Highlight saved";
  return "Capture saved";
}

function captureHasTakeawayPrefix(capture) {
  return captureHasStarterPrefix(capture, "takeaway");
}

function captureIsQuoteOnly(capture) {
  return Boolean(
    String(capture?.quote || "").trim()
    && !String(capture?.thought || "").trim()
    && !capture?.answersQuestionCaptureId
    && !capture?.questionResolvedAt
    && !capture?.questionParkedAt
  );
}

function captureHasStarterPrefix(capture, kind) {
  const thought = String(capture?.thought || "").trimStart();
  if (kind === "question") return /^(?:q|question)\s*[:：]/i.test(thought);
  if (kind === "takeaway") return /^takeaway\s*[:：]/i.test(thought);
  return false;
}

function captureTextFromNative(text, options = {}) {
  const quote = String(text || "").trim();
  if (!quote) {
    return {
      ok: false,
      error: "empty_capture"
    };
  }
  const sourceTitle = String(options.sourceTitle || "");
  const sourceUrl = String(options.sourceUrl || "");
  const cleanSourceUrl = stripSourceTimestamp(sourceUrl) || sourceUrl;
  const timestamp = String(options.timestamp || extractSourceTimestamp(sourceUrl));
  const captureSource = normalizeNativeCaptureSource(options.captureSource);
  const target = resolveInboundCaptureTarget(workspace, { sourceUrl: cleanSourceUrl, sourceTitle });
  const preserveSessionSource = target.resolution !== "active-fallback";
  const activeFallbackSourceUpdated = target.resolution === "active-fallback" && (
    (cleanSourceUrl && cleanUrl(cleanSourceUrl) !== cleanUrl(target.session.sourceUrl)) ||
    (sourceTitle && normalizeInboundSourceTitle(sourceTitle) !== normalizeInboundSourceTitle(target.session.sourceTitle))
  );
  const promoteToReview = Boolean(options.promoteToReview);
  workspace = selectSession(workspace, target.session.id);
  workspace = updateSession(workspace, target.session.id, {
    sourceUrl: preserveSessionSource
      ? target.session.sourceUrl || cleanSourceUrl
      : cleanSourceUrl || target.session.sourceUrl,
    sourceTitle: preserveSessionSource
      ? target.session.sourceTitle || sourceTitle
      : sourceTitle || target.session.sourceTitle,
    materialType: inferInboundMaterialType(cleanSourceUrl, timestamp, target.session.materialType),
    focusMode: "capture"
  });
  workspace = addCapture(workspace, target.session.id, {
    quote,
    thought: "",
    timestamp,
    tags: target.session.tags,
    sourceTitle,
    sourceUrl: cleanSourceUrl,
    sourceProvenance: sourceTitle || sourceUrl ? "inbound" : "snapshot"
  }, {
    promoteToReview
  });
  activeTab = promoteToReview ? "review" : "captures";
  const updated = getActiveSession(workspace);
  const capture = updated.captures[0];
  const activityTitle = nativeCaptureActivityTitle(captureSource, promoteToReview);
  setActivity(updated, {
    title: activityTitle,
    detail: sourceTitle || cleanSourceUrl
      ? `${summarizeCapture(capture)} · ${formatInboundResolution(target.resolution, activeFallbackSourceUpdated)}`
      : summarizeCapture(capture),
    tab: activeTab,
    targetId: promoteToReview ? updated.reviewCards[0]?.id : capture?.id,
    actionLabel: promoteToReview ? "Review card" : "Saved capture"
  });
  persistAndRender(activityTitle);
  return {
    ok: true,
    sessionId: updated.id,
    captureId: capture?.id || "",
    reviewCardId: promoteToReview ? updated.reviewCards[0]?.id || "" : "",
    captures: updated.captures.length,
    activeTab,
    sourceAttached: Boolean(sourceTitle || cleanSourceUrl),
    resolution: target.resolution,
    captureSource
  };
}

function normalizeNativeCaptureSource(value) {
  const source = String(value || "").trim();
  return ["selected-text", "clipboard-fallback", "clipboard"].includes(source) ? source : "clipboard";
}

function nativeCaptureActivityTitle(captureSource, promoteToReview) {
  if (captureSource === "selected-text") {
    return promoteToReview ? "Selected text capture and card saved" : "Selected text capture saved";
  }
  if (captureSource === "clipboard-fallback") {
    return promoteToReview ? "Clipboard fallback capture and card saved" : "Clipboard fallback capture saved";
  }
  return promoteToReview ? "Clipboard capture and card saved" : "Clipboard capture saved";
}

function buildCloze() {
  const quote = dom.quoteInput.value;
  const start = dom.quoteInput.selectionStart;
  const end = dom.quoteInput.selectionEnd;
  const selected = quote.slice(start, end).trim();
  if (!selected) return null;
  const before = quote.slice(0, start);
  const after = quote.slice(end);
  return {
    prompt: `${before}____${after}`.trim(),
    answer: selected
  };
}

function scheduleSave() {
  clearPendingCaptureUndo({ renderActivityStrip: true });
  dom.saveState.textContent = "Saving";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persist();
    dom.saveState.textContent = "Saved";
  }, 250);
}

function persistAndRender(message, options = {}) {
  if (!options.keepCaptureUndo) clearPendingCaptureUndo();
  persist();
  render();
  if (message) showToast(message);
}

function persist() {
  workspace = { ...workspace, updatedAt: new Date().toISOString() };
  pruneCurrentCaptureDrafts();
  const serialized = JSON.stringify(workspace);
  const bytes = new Blob([serialized]).size;
  storageWarning = null;
  try {
    localStorage.setItem(STORAGE_KEY, serialized);
    storageWarning = workspaceStorageNotice(workspace, uiPrefs.workspaceBackup, bytes);
  } catch {
    storageWarning = "Storage full. Export now.";
    dom.saveState.textContent = "Export needed";
  }
  renderStorageNotice();
}

function render() {
  const session = getActiveSession(workspace);
  dom.workspaceMeta.textContent = `${workspace.sessions.length} sessions`;
  dom.sessionTitle.value = session.title;
  dom.sourceTitle.value = session.sourceTitle;
  dom.sourceUrl.value = session.sourceUrl;
  dom.materialType.value = session.materialType;
  dom.sessionTags.value = session.tags.join(", ");
  dom.notesEditor.value = session.notesMarkdown;
  renderCaptureDraft(session);
  renderCaptureStack(session);
  renderOpenSourceButton(session);
  renderCaptureContext(session);
  renderFocusMode(session.focusMode);
  renderShellMode();
  renderActivity(session);
  renderFocusBrief();
  renderNotesMode();
  renderStorageNotice();
  renderImportReceipt();
  renderMetrics();
  renderSessions();
  renderSearchResults();
  renderInspector();
}

function resumeCurrentSource() {
  const session = getActiveSession(workspace);
  const resume = buildResumeSource(session, dom.timestampInput.value);
  if (!resume.href) return;
  window.open(resume.href, "_blank", "noopener,noreferrer");
}

function handleCaptureContextSourceAction() {
  const session = getActiveSession(workspace);
  const resume = buildResumeSource(session, dom.timestampInput.value);
  if (resume.href) {
    resumeCurrentSource();
    return;
  }
  promptForSource(session);
}

function promptForSource(session = getActiveSession(workspace)) {
  activeTab = "captures";
  setActivity(session, {
    title: "Add a source",
    detail: "Paste the browser page or video URL so captures can resume from it.",
    tab: "captures",
    targetId: ""
  });
  renderInspector();
  renderActivity(session);
  dom.sourceUrl.focus();
  pulseNode(document.querySelector(".source-strip"));
}

async function pasteSourceFromClipboard() {
  const session = getActiveSession(workspace);
  if (!navigator.clipboard?.readText) {
    handlePasteSourceFailure(session, "Clipboard unavailable", "Paste the browser URL into the URL field.");
    return;
  }
  const previousLabel = dom.pasteSourceBtn.textContent;
  dom.pasteSourceBtn.disabled = true;
  dom.pasteSourceBtn.textContent = "...";
  try {
    const parsed = parseClipboardSource(await navigator.clipboard.readText());
    if (!parsed.url) {
      handlePasteSourceFailure(session, "No source URL found", "Copy the browser URL, then use Paste Source or enter it manually.");
      return;
    }
    applyClipboardSource(parsed);
  } catch {
    handlePasteSourceFailure(session, "Clipboard blocked", "Browser settings blocked clipboard access. Enter the source URL manually.");
  } finally {
    dom.pasteSourceBtn.disabled = false;
    dom.pasteSourceBtn.textContent = previousLabel;
  }
}

function applyClipboardSource(source) {
  const session = getActiveSession(workspace);
  const timestamp = extractSourceTimestamp(source.url);
  const sourceUrl = stripSourceTimestamp(source.url) || source.url;
  const sourceTitle = source.title || session.sourceTitle;
  const nextTitle = shouldRenameUntitledSession(session.title) && sourceTitle
    ? sourceTitle
    : session.title;
  const inferredMaterialType = inferClipboardMaterialType(sourceUrl, timestamp, session.materialType);
  const typeGuarded = shouldKeepExistingMaterialType(session, inferredMaterialType);
  const materialType = typeGuarded ? session.materialType : inferredMaterialType;
  workspace = updateSession(workspace, session.id, {
    title: nextTitle,
    sourceTitle,
    sourceUrl,
    materialType,
    focusMode: "capture"
  });
  activeTab = "captures";
  persistAndRender("Source pasted");
  if (timestamp && !dom.timestampInput.value.trim()) {
    dom.timestampInput.value = timestamp;
    setCaptureDraft(session.id, {
      quote: dom.quoteInput.value,
      thought: dom.thoughtInput.value,
      timestamp,
      sourceTitle,
      sourceUrl
    });
  }
  const updated = getActiveSession(workspace);
  setActivity(updated, {
    title: "Source pasted",
    detail: `${sourceTitle || readableSourceHost(sourceUrl) || "Source URL"}${timestamp ? ` @ ${timestamp}` : ""} is ready for captures.${typeGuarded ? ` Type kept as ${materialTypeLabel(session.materialType)} because this topic already has captures.` : ""}`,
    tab: "captures",
    targetId: ""
  });
  renderActivity(updated);
  renderCaptureDraftStatus(updated);
  renderCaptureContext(updated);
  renderOpenSourceButton(updated);
  pulseNode(document.querySelector(".source-strip"));
  dom.quoteInput.focus();
}

function handlePasteSourceFailure(session, title, detail) {
  setActivity(session, {
    title,
    detail,
    tab: "captures",
    targetId: ""
  });
  renderActivity(session);
  dom.sourceUrl.focus();
  pulseNode(document.querySelector(".source-strip"));
}

function parseClipboardSource(value) {
  const text = String(value || "");
  const url = extractFirstClipboardUrl(text);
  if (!url) return { url: "", title: "" };
  return {
    url,
    title: extractClipboardTitle(text, url) || deriveSourceTitleFromUrl(url)
  };
}

function extractFirstClipboardUrl(text) {
  const matches = String(text || "").match(/https?:\/\/[^\s<>"'`]+/gi) || [];
  for (const match of matches) {
    const cleaned = cleanUrl(match.replace(/[)\].,;!?]+$/g, ""));
    if (cleaned) return cleaned;
  }
  return "";
}

function extractClipboardTitle(text, sourceUrl) {
  const markdownLink = String(text || "").match(/\[([^\]]{2,160})\]\((https?:\/\/[^)]+)\)/i);
  if (markdownLink && cleanUrl(markdownLink[2]) === sourceUrl) {
    return normalizeClipboardTitle(markdownLink[1]);
  }
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => normalizeClipboardTitle(line))
    .find((line) => line && !/https?:\/\//i.test(line)) || "";
}

function deriveSourceTitleFromUrl(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    const segments = url.pathname
      .split("/")
      .map((segment) => decodeURIComponent(segment).replace(/\.[a-z0-9]{1,8}$/i, ""))
      .map((segment) => segment.replace(/[-_+]+/g, " ").trim())
      .filter((segment) => segment && !/^\d+$/.test(segment));
    const slug = segments[segments.length - 1];
    if (slug && !["watch", "docs", "document", "read"].includes(slug.toLowerCase())) {
      return titleCaseSource(slug);
    }
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeClipboardTitle(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^[-*#>\s]+/, "")
    .trim()
    .slice(0, 160);
}

function titleCaseSource(value) {
  return normalizeClipboardTitle(value)
    .split(" ")
    .map((word) => word ? `${word[0].toUpperCase()}${word.slice(1)}` : "")
    .join(" ");
}

function shouldRenameUntitledSession(title) {
  return ["", "New learning session"].includes(String(title || "").trim());
}

function shouldKeepExistingMaterialType(session, inferredMaterialType) {
  return Boolean(
    inferredMaterialType &&
    session.materialType &&
    inferredMaterialType !== session.materialType &&
    session.captures.length
  );
}

function inferClipboardMaterialType(sourceUrl, timestamp, fallback) {
  const href = cleanUrl(sourceUrl || "");
  if (!href) return fallback;
  try {
    const host = new URL(href).hostname.toLowerCase();
    if (isKnownVideoHost(host)) return "video";
  } catch {
    return fallback;
  }
  return inferInboundMaterialType(sourceUrl, timestamp, fallback);
}

function materialTypeLabel(value) {
  return {
    article: "Article",
    video: "Video",
    doc: "Doc",
    course: "Course",
    book: "Book",
    other: "Other"
  }[value] || "current type";
}

function nudgeCaptureTime(deltaSeconds) {
  const session = getActiveSession(workspace);
  // Precedence: typed Time field, latest captured source time, then zero; nudges never go below 00:00.
  const currentTimestamp = dom.timestampInput.value.trim();
  const currentSeconds = timestampToSeconds(dom.timestampInput.value);
  const fallbackSeconds = timestampToSeconds(buildResumeSource(session, "").timestamp);
  const baseSeconds = currentSeconds ?? fallbackSeconds ?? 0;
  const nextSeconds = Math.max(0, baseSeconds + deltaSeconds);
  const nextTimestamp = secondsToTimestamp(nextSeconds);
  if (currentSeconds !== null && currentTimestamp === nextTimestamp && nextSeconds === currentSeconds) {
    setActivity(session, {
      title: "Time unchanged",
      detail: `Capture time is already ${nextTimestamp}.`,
      tab: "captures",
      targetId: ""
    });
    renderActivity(session);
    pulseNode(dom.timestampInput);
    return;
  }
  dom.timestampInput.value = nextTimestamp;
  saveCurrentCaptureDraft();
  setActivity(session, {
    title: "Time adjusted",
    detail: `Capture time set to ${nextTimestamp}.`,
    tab: "captures",
    targetId: ""
  });
  renderActivity(session);
  renderCaptureContext(session);
  renderOpenSourceButton(session);
  pulseNode(dom.timestampInput);
}

function renderOpenSourceButton(session) {
  const resume = buildResumeSource(session, dom.timestampInput.value);
  dom.openSourceBtn.disabled = !resume.href;
  const title = resume.timestamp ? `Open source at ${resume.timestamp}` : "Open source";
  dom.openSourceBtn.title = title;
  dom.openSourceBtn.setAttribute("aria-label", title);
}

function renderCaptureContext(session) {
  const resume = buildResumeSource(session, dom.timestampInput.value);
  const sourceLabel = resume.title || readableSourceHost(resume.url) || "No source";
  const title = resume.timestamp ? `Open source at ${resume.timestamp}` : "Open source";
  const openLabel = captureContextOpenLabel(resume);
  const targetLabel = `To ${session.title || "current topic"}`;
  dom.captureContextTarget.textContent = targetLabel;
  dom.captureContextTarget.title = `Captures save to ${session.title || "the current topic"}`;
  dom.captureContextTarget.setAttribute("aria-label", `Show capture destination: ${session.title || "current topic"}`);
  const intent = captureDraftIntent(session);
  dom.captureContextIntent.textContent = intent.label;
  dom.captureContextIntent.title = intent.title;
  dom.captureContextSource.textContent = sourceLabel;
  dom.captureContextSource.title = resume.href
    ? `Captures attach to ${sourceLabel}. ${title}.`
    : "No source URL yet. Set one to resume the browser source later.";
  dom.captureContextSource.setAttribute("aria-label", resume.href
    ? `Show capture source: ${sourceLabel}`
    : "Show capture source: no source URL yet");
  dom.captureContextTime.hidden = !resume.timestamp;
  dom.captureContextTime.textContent = resume.timestamp ? `@ ${resume.timestamp}` : "";
  dom.captureContextOpenBtn.disabled = false;
  dom.captureContextOpenBtn.textContent = openLabel;
  dom.captureContextOpenBtn.title = resume.href ? title : "Set source URL";
  dom.captureContextOpenBtn.setAttribute("aria-label", resume.href ? title : "Set source URL");
  renderCaptureGuidance(session, resume);
  renderCaptureStarters();
}

function captureContextOpenLabel(resume) {
  if (!resume?.href) return "Set source";
  if (resume.timestamp) return `Resume @ ${resume.timestamp}`;
  return "Open source";
}

function captureDraftIntent(session) {
  const quote = dom.quoteInput.value.trim();
  const thought = dom.thoughtInput.value.trim();
  const draft = getCaptureDraft(session.id);
  const answersQuestionCaptureId = answerDraftTargetForThought(draft.answersQuestionCaptureId, thought);
  const draftCapture = {
    quote,
    thought,
    tags: dom.sessionTags.value || session.tags,
    answersQuestionCaptureId
  };
  const answerPrefix = /^(?:a|answer)\s*[:：]/i.test(thought);
  const questionPrefix = /^(?:q|question)\s*[:：]/i.test(thought);
  const takeawayPrefix = /^takeaway\s*[:：]/i.test(thought);
  if (!quote && !thought) {
    const guidance = captureGuidanceFor(session, buildResumeSource(session, dom.timestampInput.value));
    return {
      label: guidance.intent,
      title: guidance.intentTitle
    };
  }
  if (questionPrefix && !captureHasQuestion(draftCapture)) {
    return {
      label: "Question draft",
      title: "Finish the question before saving it to Open Questions."
    };
  }
  if (answerPrefix && !captureHasReviewReadyAnswer(draftCapture)) {
    return {
      label: answersQuestionCaptureId ? "Answer draft" : "Answer draft",
      title: answersQuestionCaptureId
        ? "This will answer the linked question once you add enough detail."
        : "This looks like an answer draft; add enough detail before saving as answer evidence."
    };
  }
  if (captureHasAnswer(draftCapture)) {
    return {
      label: "Answer",
      title: answersQuestionCaptureId
        ? "This capture will answer the linked question."
        : "This capture can appear in Answers Today."
    };
  }
  if (takeawayPrefix) {
    return {
      label: "Takeaway",
      title: "This will save as a takeaway thought."
    };
  }
  if (captureHasQuestion(draftCapture)) {
    return {
      label: "Question",
      title: "This capture will enter Open Questions."
    };
  }
  if (quote && !thought) {
    return {
      label: "Quote",
      title: "This will save as a quote capture."
    };
  }
  if (thought && !quote) {
    return {
      label: "Thought",
      title: "This will save as a thought capture."
    };
  }
  return {
    label: "Capture",
    title: "This will save as a capture with quote and thought."
  };
}

function renderCaptureGuidance(session, resume) {
  const guidance = captureGuidanceFor(session, resume);
  dom.quoteInput.placeholder = guidance.quotePlaceholder;
  dom.thoughtInput.placeholder = guidance.thoughtPlaceholder;
}

function renderCaptureStarters() {
  const activeKind = activeCaptureStarterKind(dom.thoughtInput.value);
  document.querySelectorAll("[data-capture-starter]").forEach((button) => {
    const active = button.dataset.captureStarter === activeKind;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function activeCaptureStarterKind(value) {
  const thought = String(value || "").trimStart();
  if (/^(?:q|question)\s*[:：]/i.test(thought)) return "question";
  if (/^(?:a|answer)\s*[:：]/i.test(thought)) return "answer";
  if (/^takeaway\s*[:：]/i.test(thought)) return "takeaway";
  return "";
}

function captureGuidanceFor(session, resume) {
  const materialType = session.materialType || "article";
  const hasSource = Boolean(resume?.href || session.sourceUrl || session.sourceTitle);
  const hasTime = Boolean(resume?.timestamp);
  if (!hasSource) return defaultCaptureGuidance();
  if (materialType === "video") {
    return hasTime ? {
      intent: "Video moment",
      intentTitle: "Capture the current video moment with the transcript line, question, or answer it triggered.",
      quotePlaceholder: "Transcript line or key phrase at this moment",
      thoughtPlaceholder: "Your question, takeaway, or answer for this moment"
    } : {
      intent: "Video note",
      intentTitle: "Capture a video point; add Time when the moment matters.",
      quotePlaceholder: "Transcript line or key phrase from the video",
      thoughtPlaceholder: "Question, takeaway, or answer from this segment"
    };
  }
  if (materialType === "doc" || materialType === "article" || materialType === "book") {
    return {
      intent: textSourceIntentLabel(materialType),
      intentTitle: "Capture the sentence, section, or claim you are reading now.",
      quotePlaceholder: "Sentence, section excerpt, or key claim you are reading",
      thoughtPlaceholder: "Your takeaway, question, or how you would apply it"
    };
  }
  if (hasSource) {
    return {
      intent: "Source note",
      intentTitle: "Capture the current source point before switching context.",
      quotePlaceholder: "Source excerpt, line, or key idea",
      thoughtPlaceholder: "Why it matters, what is unclear, or next step"
    };
  }
  return defaultCaptureGuidance();
}

function defaultCaptureGuidance() {
  return {
    intent: "Ready",
    intentTitle: "Add a quote or thought to capture.",
    quotePlaceholder: "Paste a quote, transcript line, or key idea",
    thoughtPlaceholder: "Your note, question, or synthesis"
  };
}

function textSourceIntentLabel(materialType) {
  if (materialType === "book") return "Book excerpt";
  if (materialType === "article") return "Article excerpt";
  return "Doc excerpt";
}

function applyCaptureStarter(kind) {
  const starter = captureStarterDefinition(kind);
  if (!starter) return;
  const session = getActiveSession(workspace);
  dom.thoughtInput.value = starterTextFor(dom.thoughtInput.value, starter.prefix);
  saveCurrentCaptureDraft();
  setActivity(session, {
    title: `${starter.label} draft started`,
    detail: captureStarterActivityDetail(starter, session),
    tab: "captures",
    targetId: ""
  });
  renderCaptureContext(session);
  renderActivity(session);
  renderFocusBrief();
  if (activeTab === "today") renderToday();
  dom.thoughtInput.focus();
  dom.thoughtInput.setSelectionRange(dom.thoughtInput.value.length, dom.thoughtInput.value.length);
}

function captureStarterDefinition(kind) {
  if (kind === "question") {
    return {
      kind,
      label: "Question",
      prefix: "Question: ",
      detail: "Local draft started. Press Capture when the question is specific."
    };
  }
  if (kind === "answer") {
    return {
      kind,
      label: "Answer",
      prefix: "Answer: ",
      detail: "Local draft started. Linked answers can close questions once they have enough detail."
    };
  }
  if (kind === "takeaway") {
    return {
      kind,
      label: "Takeaway",
      prefix: "Takeaway: ",
      detail: "Local draft started. Press Capture to save the point you want to keep."
    };
  }
  return null;
}

function captureStarterActivityDetail(starter, session) {
  if (starter.kind !== "answer") return starter.detail;
  const draft = getCaptureDraft(session.id);
  if (draft.answersQuestionCaptureId) {
    return "Local answer draft started for the linked question.";
  }
  return "Local answer draft started. Not linked yet; press Capture to save it as an answer note.";
}

function starterTextFor(value, prefix) {
  const text = String(value || "");
  const trimmed = text.trimStart();
  if (!trimmed) return prefix;
  const body = trimmed.replace(/^(?:q|question|a|answer|takeaway)\s*[:：]\s*/i, "").trimStart();
  return `${prefix}${body}`;
}

function answerDraftTargetForThought(targetId, thought, options = {}) {
  if (!targetId) return "";
  const text = String(thought || "").trim();
  if (!/^(?:a|answer)\s*[:：]/i.test(text)) return "";
  if (options.requireReviewReady && !captureHasReviewReadyAnswer({
    thought: text,
    answersQuestionCaptureId: targetId
  })) return "";
  return targetId;
}

function readableSourceHost(value) {
  try {
    return cleanUrl(value) ? new URL(value).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

function toggleSidecarLayout() {
  setSidecarLayout(!uiPrefs.sidecarLayout);
}

function setSidecarLayout(enabled) {
  const active = document.activeElement;
  const next = Boolean(enabled);
  const willHidePanels = next && !uiPrefs.sidecarLayout;
  uiPrefs = { ...uiPrefs, sidecarLayout: next };
  saveUiPrefs();
  renderShellMode();
  renderActivity(getActiveSession(workspace));
  if (willHidePanels && isInSidePanel(active)) {
    dom.sidecarLayoutBtn.focus();
  }
  return {
    ok: true,
    sidecarLayout: uiPrefs.sidecarLayout
  };
}

function renderShellMode() {
  dom.appShell.classList.toggle("sidecar-layout", uiPrefs.sidecarLayout);
  dom.sidecarLayoutBtn.setAttribute("aria-pressed", String(uiPrefs.sidecarLayout));
}

function setActivity(session, activity) {
  lastActivity = {
    sessionId: session.id,
    title: String(activity.title || "Ready"),
    detail: String(activity.detail || ""),
    tab: activity.tab || "captures",
    targetId: activity.targetId || "",
    targetSection: activity.targetSection || "",
    actionLabel: activity.actionLabel || ""
  };
}

function renderActivity(session) {
  const activity = getActivity(session);
  const canUndoCaptureDelete = pendingCaptureUndo?.sessionId === session.id;
  const baseAction = activity.actionLabel || (activity.tab === "review"
    ? "Review"
    : activity.tab === "export" ? "Export" : activity.tab === "today" ? "Today" : "Details");
  const actionText = uiPrefs.sidecarLayout ? `Exit + ${baseAction}` : baseAction;
  const actionLabel = uiPrefs.sidecarLayout
    ? `Open ${baseAction.toLowerCase()} and exit sidecar layout`
    : `Open ${baseAction.toLowerCase()}`;
  dom.activityTitle.textContent = activity.title;
  dom.activityDetail.textContent = activity.detail;
  dom.activityUndoBtn.hidden = !canUndoCaptureDelete;
  dom.activityUndoBtn.textContent = canUndoCaptureDelete ? "Undo 10s" : "Undo";
  dom.activityUndoBtn.title = canUndoCaptureDelete ? `Undo delete: ${pendingCaptureUndo.summary}` : "";
  dom.activityUndoBtn.setAttribute("aria-label", canUndoCaptureDelete ? `Undo capture delete: ${pendingCaptureUndo.summary}` : "Undo capture delete");
  dom.activityDetailsBtn.textContent = actionText;
  dom.activityDetailsBtn.title = actionLabel;
  dom.activityDetailsBtn.setAttribute("aria-label", actionLabel);
  renderSidecarRail(session);
}

function renderSidecarRail(session) {
  clearChildren(dom.sidecarRail);
  dom.sidecarRail.hidden = !uiPrefs.sidecarLayout;
  if (!uiPrefs.sidecarLayout) return;
  resolveSidecarRailSteps(session).forEach((step) => dom.sidecarRail.append(renderSidecarRailButton(step)));
}

function resolveSidecarRailSteps(session = getActiveSession(workspace)) {
  const pack = buildTodayPack(workspace, new Date(), { dueLimit: 1, questionLimit: 1, parkedQuestionLimit: 1, resolvedQuestionLimit: 1, recentLimit: 1 });
  const draftItems = getCaptureDraftItems();
  return [
    sidecarRailStep(resolveSourceSessionState(), "Source"),
    resolveSidecarCaptureRailStep(pack, draftItems, session),
    sidecarRailStep(resolveCloseLoopState(pack, draftItems), "Loop")
  ];
}

function sidecarRailStep(step, label) {
  const clearLoop = step.kind === "loop" && step.status === "Clear";
  return {
    ...step,
    label,
    actionLabel: clearLoop ? "Open Today" : step.actionLabel,
    actionAriaLabel: clearLoop ? "Open Today details and exit sidecar layout" : step.actionAriaLabel,
    railDetail: step.status,
    railAction: clearLoop ? "Today" : step.actionLabel
  };
}

function resolveSidecarCaptureRailStep(pack, draftItems, session) {
  const draft = getCaptureDraft(session.id);
  const hasDraft = hasCaptureDraft(draft);
  return {
    kind: "capture",
    label: "Capture",
    status: hasDraft ? "Draft waiting" : captureFlowStatus(pack, draftItems),
    detail: hasDraft ? summarizeCaptureDraft(draft) : "Focus Quick Capture for the next quote or thought.",
    railDetail: hasDraft ? "Draft waiting" : "Ready beside source",
    railAction: hasDraft ? "Resume" : "Focus",
    actionLabel: hasDraft ? "Resume capture" : "Focus capture",
    actionAriaLabel: hasDraft ? "Resume the waiting Quick Capture draft" : "Focus Quick Capture in sidecar layout",
    action: focusQuickCapture,
    tone: "capture"
  };
}

function renderSidecarRailButton(step) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = ["sidecar-rail-button", step.tone ? `is-${step.tone}` : ""].filter(Boolean).join(" ");
  button.dataset.sidecarRailStep = step.kind || step.label.toLowerCase();
  button.title = step.detail;
  button.setAttribute("aria-label", step.actionAriaLabel || `${step.actionLabel}: ${step.detail}`);
  button.append(
    textEl("span", "", step.label),
    textEl("strong", "", step.railDetail || step.status),
    textEl("small", "", step.railAction || step.actionLabel)
  );
  button.addEventListener("click", () => {
    if (step.kind === "loop" && step.status === "Clear") {
      openTodayFromSidecar();
      return;
    }
    step.action();
  });
  return button;
}

function openTodayFromSidecar(sectionName = "") {
  activeTab = "today";
  if (uiPrefs.sidecarLayout) {
    uiPrefs = { ...uiPrefs, sidecarLayout: false };
    saveUiPrefs();
    renderShellMode();
  }
  renderInspector();
  if (sectionName) jumpToTodaySection(sectionName);
  renderActivity(getActiveSession(workspace));
}

function renderFocusBrief() {
  const session = getActiveSession(workspace);
  const brief = buildFocusBrief(session, workspace);
  const draft = getCaptureDraft(session.id);
  if (canDraftOwnFocusBrief(draft, brief)) {
    renderCaptureDraftFocusBrief(session, draft, brief);
    return;
  }
  const dueCopy = brief.stats.workspaceDueCards !== brief.stats.dueCards
    ? `${brief.stats.dueCards} topic due · ${brief.stats.workspaceDueCards} workspace due`
    : `${brief.stats.dueCards} due`;
  dom.focusBriefKicker.textContent = `${brief.stats.captures} captures · ${dueCopy}`;
  dom.focusBriefAction.textContent = brief.nextAction.label;
  dom.focusBriefDetail.textContent = brief.nextAction.detail;
  dom.focusBriefActionBtn.textContent = focusBriefButtonLabel(brief.nextAction.kind);
  dom.focusBriefActionBtn.title = brief.nextAction.detail;
  dom.focusBriefActionBtn.setAttribute("aria-label", brief.nextAction.label);
  clearChildren(dom.focusBriefFacts);
  dom.focusBriefFacts.append(
    focusBriefFact("Source", brief.source.title || (brief.source.available ? "Open source" : "No source")),
    focusBriefFact("Latest", brief.latestCapture
      ? `${brief.latestCapture.summary}${brief.latestCapture.timestamp ? ` @ ${brief.latestCapture.timestamp}` : ""}`
      : "No captures yet"),
    focusBriefFact("Synthesis", brief.stats.capturesSinceLastSynthesis
      ? `${brief.stats.capturesSinceLastSynthesis} waiting`
      : "Current"),
    focusBriefFact("Questions", brief.stats.questions ? `${brief.stats.questions} open` : "None"),
    focusBriefFact("Why", brief.nextAction.reason)
  );
  clearChildren(dom.focusBriefSignals);
  if (brief.warnings.length) {
    brief.warnings.forEach((warning) => {
      const signalClass = warning.kind === "open_questions" ? "focus-signal" : "focus-signal warn";
      const signal = warning.targetTab
        ? textEl("button", `${signalClass} signal-button`, warning.label)
        : textEl("span", signalClass, warning.label);
      if (signal.tagName === "BUTTON") {
        signal.type = "button";
        signal.setAttribute("aria-label", warning.actionLabel || warning.label);
        signal.addEventListener("click", () => openFocusBriefWarning(warning));
      }
      signal.title = warning.detail;
      dom.focusBriefSignals.append(signal);
    });
  } else {
    dom.focusBriefSignals.append(textEl("span", "focus-signal", "Ready"));
  }
}

function renderCaptureDraftFocusBrief(session, draft, brief) {
  const sourceChanged = captureDraftSourceChanged(session, draft);
  const dueCopy = brief.stats.workspaceDueCards !== brief.stats.dueCards
    ? `${brief.stats.dueCards} topic due · ${brief.stats.workspaceDueCards} workspace due`
    : `${brief.stats.dueCards} due`;
  dom.focusBriefKicker.textContent = `${session.captures.length} captures · ${dueCopy}`;
  dom.focusBriefAction.textContent = "Resume capture draft";
  dom.focusBriefDetail.textContent = summarizeCaptureDraft(draft);
  dom.focusBriefActionBtn.textContent = "Resume";
  dom.focusBriefActionBtn.title = "Continue the saved quote or thought";
  dom.focusBriefActionBtn.setAttribute("aria-label", "Resume capture draft");
  clearChildren(dom.focusBriefFacts);
  const facts = [
    focusBriefFact("Source", session.sourceTitle || (session.sourceUrl ? "Open source" : "No source")),
    ...(sourceChanged ? [focusBriefFact("Draft source", sourceSnapshotLabel(draft))] : []),
    focusBriefFact("Draft", draft.timestamp ? `Saved @ ${draft.timestamp}` : "Saved locally"),
    focusBriefFact("Sync", "Device-local"),
    focusBriefFact("Why", "Fresh local draft and no due review is blocking it.")
  ];
  dom.focusBriefFacts.append(...facts);
  clearChildren(dom.focusBriefSignals);
  const draftSignal = textEl("span", "focus-signal warn", "Draft waiting");
  const sourceSignal = textEl("span", "focus-signal warn", "Source changed");
  sourceSignal.title = `Draft began on ${sourceSnapshotLabel(draft)}; current source is ${sourceSnapshotLabel(session)}.`;
  dom.focusBriefSignals.append(
    draftSignal,
    ...(sourceChanged ? [sourceSignal] : []),
    textEl("span", "focus-signal", "Not exported")
  );
}

function canDraftOwnFocusBrief(draft, brief) {
  return resolveCaptureDraftFocusOverride(brief, draft).shouldOverride;
}

function focusBriefFact(label, value) {
  const item = document.createElement("div");
  item.className = "focus-brief-fact";
  item.append(textEl("span", "", label), textEl("strong", "", value));
  return item;
}

function showCaptureDestination() {
  const session = getActiveSession(workspace);
  activeTab = "captures";
  if (uiPrefs.sidecarLayout) {
    uiPrefs = { ...uiPrefs, sidecarLayout: false };
    saveUiPrefs();
    renderShellMode();
  }
  renderInspector();
  renderSessions();
  const activeRow = document.querySelector(`[data-session-id="${CSS.escape(session.id)}"]`);
  activeRow?.scrollIntoView({ behavior: "smooth", block: "center" });
  pulseNode(activeRow);
  activeRow?.focus();
  setActivity(session, {
    title: "Capture destination shown",
    detail: `Captures save to ${session.title}.`,
    tab: "captures",
    targetId: ""
  });
  renderActivity(session);
}

function showCaptureSource() {
  const session = getActiveSession(workspace);
  const shouldFocusTitle = Boolean(session.sourceTitle) || !session.sourceUrl;
  const focusTarget = shouldFocusTitle ? dom.sourceTitle : dom.sourceUrl;
  focusTarget.focus();
  focusTarget.select?.();
  pulseNode(document.querySelector(".source-strip"));
  setActivity(session, {
    title: "Capture source shown",
    detail: session.sourceTitle || session.sourceUrl
      ? `Captures use ${sourceSnapshotLabel(session)}.`
      : "Add a source title or URL before capturing.",
    tab: "captures",
    targetId: ""
  });
  renderActivity(session);
}

function focusBriefButtonLabel(kind) {
  return {
    review: "Review",
    synthesize: "Build",
    capture: "Capture",
    continue: "Open",
    open_source: "Source"
  }[kind] || "Go";
}

function openFocusBriefWarning(warning) {
  if (!warning?.targetTab) return;
  activeTab = warning.targetTab;
  if (uiPrefs.sidecarLayout) {
    uiPrefs = { ...uiPrefs, sidecarLayout: false };
    saveUiPrefs();
    renderShellMode();
  }
  renderInspector();
  const section = warning.targetSection
    ? document.querySelector(`[data-today-section="${CSS.escape(warning.targetSection)}"]`)
    : null;
  const scrollTarget = section || dom.todayList;
  scrollTarget?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (section) pulseNode(section);
  renderActivity(getActiveSession(workspace));
}

function runFocusBriefAction() {
  const session = getActiveSession(workspace);
  const brief = buildFocusBrief(session, workspace);
  const draft = getCaptureDraft(session.id);
  if (canDraftOwnFocusBrief(draft, brief)) {
    workspace = updateSession(workspace, session.id, { focusMode: "capture" });
    activeTab = "captures";
    setActivity(session, {
      title: "Capture draft resumed",
      detail: summarizeCaptureDraft(draft),
      tab: "captures",
      targetId: ""
    });
    persistAndRender();
    dom.quoteInput.focus();
    return;
  }
  if (["review", "synthesize", "capture", "continue"].includes(brief.nextAction.kind)) {
    workspace = updateSession(workspace, session.id, { focusMode: brief.nextAction.focusMode });
    activeTab = brief.nextAction.tab || activeTab;
    if (brief.nextAction.kind === "review") {
      const [next] = getDueReviewItems(workspace);
      activeReviewKey = next ? reviewKey(next.sessionId, next.card.id) : "";
      if (activeReviewKey) revealedReviewCards.delete(activeReviewKey);
    }
    persistAndRender();
  }
  if (brief.nextAction.kind === "review") {
    renderDeskReview();
  } else if (brief.nextAction.kind === "synthesize") {
    dom.synthesisDraft.focus();
  } else if (brief.nextAction.kind === "capture") {
    dom.quoteInput.focus();
  } else if (brief.nextAction.kind === "continue") {
    if (brief.source.href) window.open(brief.source.href, "_blank", "noopener,noreferrer");
    else dom.quoteInput.focus();
  } else {
    dom.sourceUrl.focus();
  }
}

function focusQuickCapture() {
  const session = getActiveSession(workspace);
  const draft = getCaptureDraft(session.id);
  const hasDraft = hasCaptureDraft(draft);
  const title = hasDraft ? "Capture draft ready" : "Quick Capture ready";
  workspace = updateSession(workspace, session.id, { focusMode: "capture" });
  activeTab = "captures";
  setActivity(session, {
    title,
    detail: hasDraft ? summarizeCaptureDraft(draft) : "Capture a quote, thought, or timestamp without leaving the study surface.",
    tab: "captures",
    targetId: ""
  });
  persistAndRender(title);
  const target = dom.quoteInput.value.trim() && !dom.thoughtInput.value.trim()
    ? dom.thoughtInput
    : dom.quoteInput;
  target.focus();
  pulseNode(dom.capturePane);
  return {
    ok: true,
    activeTab,
    focusMode: getActiveSession(workspace).focusMode,
    focused: target.id,
    sidecarLayout: uiPrefs.sidecarLayout
  };
}

function getActivity(session) {
  if (lastActivity?.sessionId === session.id) return lastActivity;
  const draft = getCaptureDraft(session.id);
  if (hasCaptureTextDraft(draft)) {
    return {
      title: "Capture draft waiting",
      detail: summarizeCaptureDraft(draft),
      tab: "captures",
      targetId: ""
    };
  }
  const due = getDueReviewItems(workspace).length;
  if (session.focusMode === "review" && due) {
    return {
      title: "Review queue ready",
      detail: `${due} due ${due === 1 ? "card" : "cards"} across the workspace.`,
      tab: "review",
      targetId: ""
    };
  }
  const [latest] = session.captures;
  if (latest) {
    return {
      title: "Latest capture",
      detail: summarizeCapture(latest),
      tab: "captures",
      targetId: latest.id
    };
  }
  return {
    title: "Ready to capture",
    detail: "Paste a quote or use the browser clipper.",
    tab: "captures",
    targetId: ""
  };
}

function clearCaptureDraftActivity(sessionId) {
  if (lastActivity?.sessionId === sessionId
    && ["Capture draft waiting", "Capture draft resumed"].includes(lastActivity.title)) {
    lastActivity = null;
  }
}

function showActivityDetails() {
  const activity = getActivity(getActiveSession(workspace));
  activeTab = activity.tab;
  if (uiPrefs.sidecarLayout) {
    uiPrefs = { ...uiPrefs, sidecarLayout: false };
    saveUiPrefs();
    renderShellMode();
  }
  renderInspector();
  scrollActivityTarget(activity);
  renderActivity(getActiveSession(workspace));
}

function scrollActivityTarget(activity) {
  if (activity.targetSection) {
    const section = document.querySelector(`[data-today-section="${CSS.escape(activity.targetSection)}"]`);
    const drawer = section?.closest("details");
    if (drawer && !drawer.open) drawer.open = true;
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    pulseNode(section);
    return;
  }
  if (!activity.targetId) return;
  const selector = activity.tab === "review"
    ? `[data-card-id="${CSS.escape(activity.targetId)}"]`
    : `[data-capture-id="${CSS.escape(activity.targetId)}"]`;
  const target = document.querySelector(selector);
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
  pulseNode(target);
}

function pulseNode(target) {
  if (!target) return;
  target.classList.remove("pulse");
  void target.offsetWidth;
  target.classList.add("pulse");
  setTimeout(() => target?.classList.remove("pulse"), 900);
}

function isInSidePanel(node) {
  return Boolean(node && (dom.sidebar.contains(node) || dom.inspector.contains(node)));
}

function isEditableTarget(node) {
  if (!(node instanceof HTMLElement)) return false;
  const tagName = node.tagName.toLowerCase();
  return node.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

function renderStorageNotice() {
  if (!dom.storageNotice) return;
  const shouldShow = Boolean(storageWarning);
  dom.storageNotice.hidden = !shouldShow;
  dom.storageNoticeText.textContent = storageWarning || "";
}

function renderImportReceipt() {
  if (!dom.importReceipt) return;
  const receipt = lastImportReceipt;
  dom.importReceipt.hidden = !receipt;
  dom.importReceipt.classList.toggle("import-receipt-error",
    receipt?.schema === "learning-companion.import-error-receipt.v1"
      || (receipt?.schema === "learning-companion.return-files-receipt.v1" && receipt.failedFiles > 0 && receipt.processedFiles === 0));
  if (!receipt) return;
  dom.importReceiptTitle.textContent = importReceiptTitle(receipt);
  dom.importReceiptDetail.textContent = formatImportReceipt(receipt);
}

function importReceiptTitle(receipt) {
  if (receipt?.schema === "learning-companion.return-files-receipt.v1") return "Return JSON imported";
  if (receipt?.schema === "learning-companion.review-progress-receipt.v1") return "Review progress imported";
  if (receipt?.schema === "learning-companion.import-error-receipt.v1") return "Import issue";
  return "Mobile inbox imported";
}

function formatImportReceipt(receipt) {
  if (receipt?.schema === "learning-companion.import-error-receipt.v1") {
    return formatImportErrorReceipt(receipt);
  }
  if (receipt?.schema === "learning-companion.return-files-receipt.v1") {
    return formatReturnFilesReceipt(receipt);
  }
  if (receipt?.schema === "learning-companion.review-progress-receipt.v1") {
    return formatReviewProgressReceipt(receipt);
  }
  return formatInboxReceipt(receipt);
}

function emptyReturnFilesReceipt(fileCount) {
  return {
    schema: "learning-companion.return-files-receipt.v1",
    importedAt: new Date().toISOString(),
    fileCount,
    processedFiles: 0,
    failedFiles: 0,
    inbox: {
      files: 0,
      added: 0,
      skippedDuplicate: 0,
      answeredQuestions: 0,
      refreshableReviewCards: 0,
      skippedAnswerTargets: 0
    },
    review: {
      files: 0,
      applied: 0,
      skippedDuplicate: 0,
      skippedMissing: 0,
      skippedConflict: 0,
      skippedInvalid: 0,
      totalEvents: 0
    },
    baseChangedFiles: 0,
    baseChangedFileNames: [],
    legacyBasisFiles: 0,
    legacyBasisFileNames: [],
    sourceReturnBaseFingerprints: [],
    errors: []
  };
}

function addReturnFileImportResult(summary, fileName, result) {
  summary.processedFiles += 1;
  if (result.kind === "mobile-inbox-patch") {
    const receipt = result.receipt || {};
    addReturnFileBaseStatus(summary, fileName, receipt);
    summary.inbox.files += 1;
    summary.inbox.added += Number(receipt.added) || 0;
    summary.inbox.skippedDuplicate += Number(receipt.skippedDuplicate) || 0;
    summary.inbox.answeredQuestions += Number(receipt.answeredQuestions) || 0;
    summary.inbox.refreshableReviewCards += Number(receipt.refreshableReviewCards) || 0;
    summary.inbox.skippedAnswerTargets += Number(receipt.skippedAnswerTargets) || 0;
    return;
  }
  if (result.kind === "review-progress-patch") {
    const receipt = result.receipt || {};
    addReturnFileBaseStatus(summary, fileName, receipt);
    summary.review.files += 1;
    summary.review.applied += Number(receipt.applied) || 0;
    summary.review.skippedDuplicate += Number(receipt.skippedDuplicate) || 0;
    summary.review.skippedMissing += Number(receipt.skippedMissing) || 0;
    summary.review.skippedConflict += Number(receipt.skippedConflict) || 0;
    summary.review.skippedInvalid += Number(receipt.skippedInvalid) || 0;
    summary.review.totalEvents += Number(receipt.totalEvents) || 0;
    return;
  }
  addReturnFileImportError(summary, fileName, "Unsupported return file.");
}

function addReturnFileBaseStatus(summary, fileName, receipt) {
  const sourceReturnBaseFingerprint = cleanBackupText(receipt?.sourceReturnBaseFingerprint, 64);
  if (sourceReturnBaseFingerprint && !summary.sourceReturnBaseFingerprints.includes(sourceReturnBaseFingerprint)) {
    summary.sourceReturnBaseFingerprints.push(sourceReturnBaseFingerprint);
  }
  if (receipt?.sourceFingerprintBasis === "workspace") {
    summary.legacyBasisFiles += 1;
    summary.legacyBasisFileNames.push(String(fileName || "").slice(0, 120));
  }
  if (receipt?.sourceFingerprintMatches === false) {
    summary.baseChangedFiles += 1;
    summary.baseChangedFileNames.push(String(fileName || "").slice(0, 120));
  }
}

function addReturnFileImportError(summary, fileName, message) {
  summary.failedFiles += 1;
  summary.errors.push({
    fileName: String(fileName || "").slice(0, 120),
    message: String(message || "Import failed").slice(0, 180)
  });
}

function recordImportFailure(message, fileName = "") {
  lastImportReceipt = {
    schema: "learning-companion.import-error-receipt.v1",
    status: "failed",
    message: String(message || "Import failed").slice(0, 180),
    fileName: String(fileName || "").slice(0, 120),
    importedAt: new Date().toISOString()
  };
  renderImportReceipt();
  if (activeTab === "today") renderToday();
}

function formatImportErrorReceipt(receipt) {
  if (!receipt) return "";
  const source = receipt.fileName ? `${receipt.fileName}: ` : "";
  return `${source}${receipt.message}`;
}

function formatInboxReceipt(receipt) {
  if (!receipt) return "";
  const resolution = {
    "id-match": "topic id matched",
    "title-match": "title matched",
    "active-fallback": `fell back to active topic`,
    "duplicate-patch": "duplicate patch skipped"
  }[receipt.targetResolution] || receipt.targetResolution;
  const sanitized = receipt.sanitizedSourceUrls
    ? ` · ${receipt.sanitizedSourceUrls} source ${receipt.sanitizedSourceUrls === 1 ? "link" : "links"} stripped`
    : "";
  const answered = receipt.answeredQuestions
    ? ` · ${receipt.answeredQuestions} ${receipt.answeredQuestions === 1 ? "question" : "questions"} resolved`
    : "";
  const refreshable = receipt.refreshableReviewCards
    ? ` · ${receipt.refreshableReviewCards} ${receipt.refreshableReviewCards === 1 ? "card" : "cards"} ready to refresh`
    : "";
  const answerSkipped = receipt.skippedAnswerTargets
    ? ` · ${receipt.skippedAnswerTargets} answer ${receipt.skippedAnswerTargets === 1 ? "target" : "targets"} skipped${formatAnswerTargetSkips(receipt.answerTargetSkips)}`
    : "";
  const baseChanged = receipt.sourceFingerprintMatches === false ? " · mirror base changed" : "";
  const legacyBasis = formatLegacyBasisNote(receipt);
  return `${receipt.added} added, ${receipt.skippedDuplicate} skipped${sanitized}${answered}${refreshable}${answerSkipped}${baseChanged}${legacyBasis} · ${resolution} · ${receipt.targetSessionTitle}`;
}

function formatAnswerTargetSkips(skips = {}) {
  const labels = {
    invalid: "invalid",
    selfReference: "self",
    patchReference: "same patch",
    missing: "missing",
    nonQuestion: "not question",
    alreadyClosed: "already closed"
  };
  const parts = Object.entries(labels)
    .map(([key, label]) => {
      const count = Number(skips[key]) || 0;
      return count ? `${label}: ${count}` : "";
    })
    .filter(Boolean);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

function formatReviewProgressReceipt(receipt) {
  if (!receipt) return "";
  const duplicate = receipt.skippedDuplicate ? `, ${receipt.skippedDuplicate} duplicate` : "";
  const missing = receipt.skippedMissing ? `, ${receipt.skippedMissing} missing` : "";
  const conflict = receipt.skippedConflict ? `, ${receipt.skippedConflict} stale` : "";
  const invalid = receipt.skippedInvalid ? `, ${receipt.skippedInvalid} invalid` : "";
  const baseChanged = receipt.sourceFingerprintMatches === false ? " · mirror base changed" : "";
  const legacyBasis = formatLegacyBasisNote(receipt);
  return `${receipt.applied} applied${duplicate}${missing}${conflict}${invalid} · ${receipt.totalEvents} events${baseChanged}${legacyBasis}`;
}

function formatReturnFilesReceipt(receipt) {
  if (!receipt) return "";
  const parts = [`${receipt.processedFiles}/${receipt.fileCount} files processed`];
  if (receipt.baseChangedFiles) {
    parts.push(`${receipt.baseChangedFiles} mirror ${receipt.baseChangedFiles === 1 ? "base" : "bases"} changed${formatBaseChangedFileNames(receipt.baseChangedFileNames)}`);
  }
  if (receipt.legacyBasisFiles) {
    parts.push(`${receipt.legacyBasisFiles} legacy mirror ${receipt.legacyBasisFiles === 1 ? "check" : "checks"}${formatBaseChangedFileNames(receipt.legacyBasisFileNames)} - old return JSON, re-export mirror before next device pass`);
  }
  if (receipt.inbox?.files) {
    const answered = receipt.inbox.answeredQuestions ? `, ${receipt.inbox.answeredQuestions} questions resolved` : "";
    const refreshable = receipt.inbox.refreshableReviewCards ? `, ${receipt.inbox.refreshableReviewCards} cards ready` : "";
    const answerSkipped = receipt.inbox.skippedAnswerTargets ? `, ${receipt.inbox.skippedAnswerTargets} answer targets skipped` : "";
    parts.push(`inbox: ${receipt.inbox.added} added, ${receipt.inbox.skippedDuplicate} skipped${answered}${refreshable}${answerSkipped}`);
  }
  if (receipt.review?.files) {
    const duplicate = receipt.review.skippedDuplicate ? `, ${receipt.review.skippedDuplicate} duplicate` : "";
    const missing = receipt.review.skippedMissing ? `, ${receipt.review.skippedMissing} missing` : "";
    const conflict = receipt.review.skippedConflict ? `, ${receipt.review.skippedConflict} stale` : "";
    const invalid = receipt.review.skippedInvalid ? `, ${receipt.review.skippedInvalid} invalid` : "";
    parts.push(`review: ${receipt.review.applied} applied${duplicate}${missing}${conflict}${invalid}`);
  }
  if (receipt.failedFiles) {
    const first = receipt.errors?.[0];
    const detail = first ? ` (${first.fileName ? `${first.fileName}: ` : ""}${first.message})` : "";
    parts.push(`${receipt.failedFiles} failed${detail}`);
  }
  return parts.join(" · ");
}

function formatLegacyBasisNote(receipt) {
  return receipt?.sourceFingerprintBasis === "workspace"
    ? " · legacy mirror check (old return JSON; re-export mirror before next device pass)"
    : "";
}

function formatBaseChangedFileNames(fileNames = []) {
  const names = fileNames
    .map((name) => String(name || "").trim())
    .filter(Boolean)
    .slice(0, 3);
  if (!names.length) return "";
  const hidden = Math.max(0, fileNames.length - names.length);
  return ` (${names.join(", ")}${hidden ? `, +${hidden} more` : ""})`;
}

function returnFilesActivityTitle(receipt) {
  const inbox = Number(receipt?.inbox?.files) || 0;
  const review = Number(receipt?.review?.files) || 0;
  if (!inbox && !review) return "Return JSON import issue";
  return `Return JSON imported (${inbox} inbox, ${review} review)`;
}

function renderMetrics() {
  const session = getActiveSession(workspace);
  const due = getDueReviewItems(workspace).length;
  const bytes = new Blob([JSON.stringify(workspace)]).size;
  dom.captureMetric.textContent = String(session.captures.length);
  dom.cardMetric.textContent = String(session.reviewCards.length);
  dom.dueMetric.textContent = String(due);
  dom.sizeMetric.textContent = formatBytes(bytes);
}

function handleReviewShortcut(event) {
  if (event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target)) return false;
  if (getActiveSession(workspace).focusMode !== "review") return false;
  const item = getActiveReviewItem();
  if (!item) return false;
  const key = reviewKey(item.sessionId, item.card.id);
  const isRevealed = revealedReviewCards.has(key);
  if ((event.key === " " || event.key === "Enter") && !isRevealed) {
    event.preventDefault();
    activeReviewKey = key;
    revealedReviewCards.add(key);
    renderDeskReview();
    renderInspector();
    return true;
  }
  if (isRevealed && event.key === "1") {
    event.preventDefault();
    gradeActiveReview("again");
    return true;
  }
  if (isRevealed && event.key === "2") {
    event.preventDefault();
    gradeActiveReview("good");
    return true;
  }
  return false;
}

function getReviewItemsForDisplay() {
  const session = getActiveSession(workspace);
  const dueItems = getDueReviewItems(workspace);
  return dueItems.length
    ? dueItems
    : [...session.reviewCards]
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
      .map((card) => ({ sessionId: session.id, sessionTitle: session.title, card }));
}

function getActiveReviewItem() {
  const items = getReviewItemsForDisplay();
  if (!items.length) return null;
  const active = items.find((item) => reviewKey(item.sessionId, item.card.id) === activeReviewKey);
  return active || items[0];
}

function selectNextDeskReview() {
  const items = getReviewItemsForDisplay();
  if (!items.length) {
    showToast("No review cards");
    renderDeskReview();
    return;
  }
  const currentIndex = Math.max(0, items.findIndex((item) => reviewKey(item.sessionId, item.card.id) === activeReviewKey));
  const next = items[(currentIndex + 1) % items.length];
  activeReviewKey = reviewKey(next.sessionId, next.card.id);
  revealedReviewCards.delete(activeReviewKey);
  renderDeskReview();
  renderInspector();
}

function renderDeskReview() {
  if (dom.deskReviewPane.hidden) return;
  const due = getDueReviewItems(workspace).length;
  const item = getActiveReviewItem();
  dom.deskReviewMeta.textContent = `${due} due`;
  if (!item) {
    dom.deskReviewSource.textContent = "";
    dom.deskReviewPrompt.textContent = "No review cards yet.";
    dom.deskReviewAnswer.hidden = true;
    dom.deskReviewRevealBtn.hidden = true;
    dom.deskReviewAgainBtn.hidden = true;
    dom.deskReviewGoodBtn.hidden = true;
    return;
  }
  const key = reviewKey(item.sessionId, item.card.id);
  activeReviewKey = key;
  const isRevealed = revealedReviewCards.has(key);
  dom.deskReviewCard.dataset.reviewKey = key;
  dom.deskReviewSource.textContent = `${item.sessionTitle} · strength ${item.card.strength} · due ${new Date(item.card.dueAt).toLocaleDateString()}`;
  dom.deskReviewPrompt.textContent = item.card.prompt;
  dom.deskReviewAnswer.hidden = !isRevealed;
  dom.deskReviewRevealBtn.hidden = isRevealed;
  dom.deskReviewAgainBtn.hidden = !isRevealed;
  dom.deskReviewGoodBtn.hidden = !isRevealed;
  if (isRevealed) renderMarkdown(dom.deskReviewAnswer, item.card.answer);
  else clearChildren(dom.deskReviewAnswer);
}

function gradeActiveReview(grade) {
  const item = getActiveReviewItem();
  if (!item) return;
  const key = reviewKey(item.sessionId, item.card.id);
  workspace = gradeCard(workspace, item.sessionId, item.card.id, grade);
  revealedReviewCards.delete(key);
  const [next] = getDueReviewItems(workspace);
  activeReviewKey = next ? reviewKey(next.sessionId, next.card.id) : "";
  const reviewedSession = workspace.sessions.find((session) => session.id === item.sessionId);
  const reviewedCard = reviewedSession?.reviewCards.find((card) => card.id === item.card.id);
  setActivity(getActiveSession(workspace), {
    title: "Review updated",
    detail: `${grade === "good" ? "Good" : "Again"} · ${item.sessionTitle} · next due ${new Date(reviewedCard?.dueAt || item.card.dueAt).toLocaleDateString()}`,
    tab: "review",
    targetId: item.card.id
  });
  persistAndRender("Review updated");
}

function renderNotesMode() {
  const session = getActiveSession(workspace);
  const previewing = notesMode === "preview";
  dom.notesEditor.hidden = previewing;
  dom.notesPreview.hidden = !previewing;
  dom.notesEditBtn.classList.toggle("active", !previewing);
  dom.notesPreviewBtn.classList.toggle("active", previewing);
  if (previewing) renderMarkdown(dom.notesPreview, session.notesMarkdown);
}

function renderFocusMode(mode) {
  const session = getActiveSession(workspace);
  document.querySelectorAll("[data-focus-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.focusMode === mode);
  });
  const synthesizing = mode === "synthesize";
  const reviewing = mode === "review";
  dom.synthesisPane.hidden = !synthesizing;
  dom.deskReviewPane.hidden = !reviewing;
  dom.capturePane.hidden = synthesizing || reviewing;
  if (synthesizing) fillSynthesisDraft();
  if (reviewing) renderDeskReview();
  renderSynthesisStatus();
  if (!synthesizing && dom.synthesisDraft.dataset.sessionId !== session.id) {
    dom.synthesisDraft.value = "";
    delete dom.synthesisDraft.dataset.sessionId;
    delete dom.synthesisDraft.dataset.sourceStamp;
    delete dom.synthesisDraft.dataset.dirty;
  }
}

function fillSynthesisDraft(force = false) {
  const session = getActiveSession(workspace);
  const belongsToSession = dom.synthesisDraft.dataset.sessionId === session.id;
  const sourceStamp = getSynthesisSourceStamp(session);
  const matchesSource = dom.synthesisDraft.dataset.sourceStamp === sourceStamp;
  const isDirty = dom.synthesisDraft.dataset.dirty === "true";
  if (!force && belongsToSession && dom.synthesisDraft.value.trim() && (matchesSource || isDirty)) return;
  dom.synthesisDraft.value = generateSynthesisDraft(session);
  dom.synthesisDraft.dataset.sessionId = session.id;
  dom.synthesisDraft.dataset.sourceStamp = sourceStamp;
  dom.synthesisDraft.dataset.dirty = "false";
}

function confirmSynthesisOverwrite() {
  if (dom.synthesisDraft.dataset.dirty !== "true" || !dom.synthesisDraft.value.trim()) return true;
  return window.confirm("Replace your edited synthesis draft with a regenerated version?");
}

function renderSynthesisStatus() {
  if (!dom.synthesisStatus) return;
  const session = getActiveSession(workspace);
  const stats = getSynthesisStats(session);
  const hasDraft = Boolean(dom.synthesisDraft.value.trim());
  const isDirty = dom.synthesisDraft.dataset.dirty === "true";
  const sourceChanged = hasDraft && dom.synthesisDraft.dataset.sourceStamp !== getSynthesisSourceStamp(session);
  dom.synthesisStatus.classList.toggle("warn", sourceChanged);
  if (!hasDraft) {
    dom.synthesisStatus.textContent = "";
  } else if (sourceChanged) {
    dom.synthesisStatus.textContent = "Source changed since last Build";
  } else if (isDirty) {
    dom.synthesisStatus.textContent = "Edited draft";
  } else {
    dom.synthesisStatus.textContent = `${stats.captures}/${stats.questions}/${stats.cards}`;
  }
}

function upsertSynthesisBlock(notesMarkdown, draft, sourceStamp = "") {
  const block = [
    "<!-- learning-companion:synthesis:start -->",
    sourceStamp ? `<!-- learning-companion:synthesis-source:${sourceStamp} -->` : "",
    draft.trim(),
    "<!-- learning-companion:synthesis:end -->"
  ].filter(Boolean).join("\n");
  const existingBlock = /\n*<!-- learning-companion:synthesis:start -->[\s\S]*?<!-- learning-companion:synthesis:end -->/;
  const notes = String(notesMarkdown || "").trim();
  if (existingBlock.test(notes)) {
    return notes.replace(existingBlock, `\n\n${block}`).trim();
  }
  return [notes, block].filter(Boolean).join("\n\n");
}

function renderSessions() {
  const visible = filterSessions(workspace, dom.searchInput.value);
  const active = getActiveSession(workspace);
  clearChildren(dom.sessionList);
  if (!visible.length) {
    dom.sessionList.append(emptyState("No matching sessions"));
    return;
  }
  visible.forEach((session) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `session-row${session.id === active.id ? " active" : ""}`;
    button.dataset.sessionId = session.id;
    button.append(
      textEl("span", "session-title", session.title),
      textEl("span", "session-subtitle", `${session.sourceTitle || session.materialType} · ${session.captures.length} captures`)
    );
    button.addEventListener("click", () => {
      workspace = selectSession(workspace, session.id);
      persistAndRender();
    });
    dom.sessionList.append(button);
  });
}

function renderSearchResults() {
  if (!dom.searchResults) return;
  const query = dom.searchInput.value.trim();
  dom.searchResults.hidden = !query || searchResultsCollapsed;
  dom.searchInput.setAttribute("aria-expanded", query && !searchResultsCollapsed ? "true" : "false");
  dom.searchInput.removeAttribute("aria-activedescendant");
  clearChildren(dom.searchResults);
  if (!query || searchResultsCollapsed) return;
  const results = currentSearchResults();
  activeSearchIndex = results.length ? Math.max(0, Math.min(activeSearchIndex, results.length - 1)) : -1;
  const heading = document.createElement("div");
  heading.className = "search-results-heading";
  heading.append(textEl("strong", "", "Find"), textEl("span", "", results.length ? `${results.length} matches` : "No matches"));
  dom.searchResults.append(heading);
  if (!results.length) {
    dom.searchResults.append(textEl("p", "search-empty", "Try source titles, quote text, notes, tags, or card prompts."));
    return;
  }
  results.forEach((result, index) => {
    const button = document.createElement("button");
    const resultId = `search-result-${index}`;
    button.type = "button";
    button.id = resultId;
    button.className = `search-result${index === activeSearchIndex ? " active" : ""}`;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", index === activeSearchIndex ? "true" : "false");
    button.append(
      textEl("span", "search-result-type", searchTypeLabel(result.type)),
      textEl("strong", "search-result-title", result.title),
      textEl("span", "search-result-meta", [result.matchLabel, result.meta].filter(Boolean).join(" · ")),
      textEl("span", "search-result-excerpt", result.excerpt)
    );
    button.addEventListener("click", () => openSearchResult(result));
    dom.searchResults.append(button);
  });
  if (activeSearchIndex >= 0) {
    dom.searchInput.setAttribute("aria-activedescendant", `search-result-${activeSearchIndex}`);
    document.querySelector(`#search-result-${activeSearchIndex}`)?.scrollIntoView({ block: "nearest" });
  }
}

function currentSearchResults() {
  return searchWorkspace(workspace, dom.searchInput.value.trim(), 7);
}

function openSearchResult(result) {
  if (!result) return;
  const targetSession = workspace.sessions.find((session) => session.id === result.sessionId);
  if (!targetSession) {
    showToast("Search result no longer exists");
    renderSearchResults();
    return;
  }
  if (result.type === "capture" && !targetSession.captures.some((capture) => capture.id === result.targetId)) {
    showToast("Capture no longer exists");
    renderSearchResults();
    return;
  }
  if (result.type === "review" && !targetSession.reviewCards.some((card) => card.id === result.targetId)) {
    showToast("Review card no longer exists");
    renderSearchResults();
    return;
  }
  workspace = selectSession(workspace, result.sessionId);
  const session = getActiveSession(workspace);
  if (result.type === "review") {
    workspace = updateSession(workspace, session.id, { focusMode: "review" });
    activeTab = "review";
    activeReviewKey = reviewKey(result.sessionId, result.targetId);
    revealedReviewCards.delete(activeReviewKey);
    setActivity(getActiveSession(workspace), {
      title: "Search result opened",
      detail: `${result.matchLabel} · ${result.title}`,
      tab: "review",
      targetId: result.targetId
    });
    persistAndRender();
    renderDeskReview();
    scrollActivityTarget({ tab: "review", targetId: result.targetId });
    return;
  }
  if (result.type === "capture") {
    workspace = updateSession(workspace, session.id, { focusMode: "capture" });
    activeTab = "captures";
    setActivity(getActiveSession(workspace), {
      title: "Search result opened",
      detail: `${result.matchLabel} · ${result.title}`,
      tab: "captures",
      targetId: result.targetId
    });
    persistAndRender();
    scrollActivityTarget({ tab: "captures", targetId: result.targetId });
    return;
  }
  workspace = updateSession(workspace, session.id, { focusMode: "capture" });
  activeTab = "today";
  notesMode = result.type === "note" ? "preview" : notesMode;
  setActivity(getActiveSession(workspace), {
    title: result.type === "note" ? "Notes match opened" : "Session selected",
    detail: `${result.matchLabel} · ${result.title}`,
    tab: "captures",
    targetId: ""
  });
  persistAndRender();
  if (result.type === "note") pulseNode(document.querySelector(".editor-pane"));
}

function searchTypeLabel(type) {
  return {
    session: "Source",
    note: "Note",
    capture: "Capture",
    review: "Card"
  }[type] || "Match";
}

function renderInspector() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === activeTab);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${activeTab}Tab`);
  });
  renderToday();
  renderCaptures();
  renderReviewCards();
  renderExport();
  renderMetrics();
}

function renderToday() {
  const pack = buildTodayPack(workspace, new Date(), { dueLimit: 5, questionLimit: 5, parkedQuestionLimit: 4, resolvedQuestionLimit: 4, recentLimit: 5 });
  const { stats } = pack;
  const draftItems = getCaptureDraftItems();
  clearChildren(dom.todaySummary);
  clearChildren(dom.todayList);
  dom.todaySummary.append(
    todayStat(String(stats.due), "due"),
    todayStat(String(stats.questions), "questions"),
    todayStat(String(stats.parkedQuestions || 0), "parked"),
    todayStat(String(stats.resolvedQuestionsToday || 0), "closed"),
    todayStat(String(stats.captures), "captures"),
    todayStat(String(stats.cards), "cards")
  );

  const showStartHere = shouldShowStartHere(pack, draftItems);
  dom.todayList.append(renderTodaySectionMap(pack, draftItems));
  dom.todayList.append(renderLearningFlowPanel(pack, draftItems, showStartHere));
  renderTodayDrafts(draftItems);

  dom.todayList.append(todaySectionTitle("Due Review", "due_review"));
  if (!pack.dueItems.length) {
    dom.todayList.append(emptyState("No cards due right now"));
  } else {
    pack.dueItems.forEach((item) => {
      const sourceSession = workspace.sessions.find((session) => session.id === item.sessionId);
      const sourceCapture = sourceSession?.captures.find((capture) => capture.id === item.card.sourceCaptureId);
      const card = document.createElement("article");
      card.className = "item-card due-card";
      card.append(
        textEl("div", "item-meta", `${item.sessionTitle} · strength ${item.card.strength}`),
        textEl("p", "card-prompt", item.card.prompt)
      );
      const footer = document.createElement("div");
      footer.className = "item-footer";
      const sourceHref = buildSourceJumpUrl(sourceCapture?.sourceUrl || sourceSession?.sourceUrl, sourceCapture?.timestamp || "");
      if (sourceHref) {
        const open = textEl("button", "mini-button", sourceCapture?.timestamp ? `Open @ ${sourceCapture.timestamp}` : "Open source");
        open.type = "button";
        open.addEventListener("click", () => {
          window.open(sourceHref, "_blank", "noopener,noreferrer");
        });
        footer.append(open);
      }
      const review = textEl("button", "mini-button primary", "Review");
      review.type = "button";
      review.addEventListener("click", () => startReviewAtItem(item));
      footer.append(review);
      card.append(footer);
      dom.todayList.append(card);
    });
    if (pack.dueOverflow) dom.todayList.append(emptyState(`+${pack.dueOverflow} more due cards in workspace.json`));
  }

  dom.todayList.append(todaySectionTitle("Question Queue Health", "question_health"));
  const health = document.createElement("article");
  health.className = "item-card question-health-card";
  health.append(
    textEl("div", "item-meta", [
      `${pack.questionHealth.activeQuestions} active`,
      `${pack.questionHealth.parkedQuestions} parked`,
      `${pack.questionHealth.unresolvedQuestions} unresolved`
    ].join(" · ")),
    textEl("p", "card-prompt", pack.questionHealth.label),
    textEl("p", "item-meta", pack.questionHealth.detail)
  );
  if (pack.questionHealth.targetSection) {
    const jump = textEl("button", "mini-button primary", pack.questionHealth.status === "active" ? "Work active" : "Inspect parked");
    jump.type = "button";
    jump.addEventListener("click", () => jumpToTodaySection(pack.questionHealth.targetSection));
    const footer = document.createElement("div");
    footer.className = "item-footer";
    footer.append(jump);
    health.append(footer);
  }
  dom.todayList.append(health);

  dom.todayList.append(todaySectionTitle("Question Loop", "question_loop"));
  const loop = document.createElement("article");
  loop.className = "item-card question-loop-card";
  loop.append(
    textEl("p", "card-prompt", pack.questionLoop.label),
    textEl("p", "item-meta", `Today: ${pack.questionLoop.todayDetail}`),
    textEl("p", "item-meta", `Backlog: ${pack.questionLoop.backlogDetail}`),
    textEl("p", "item-meta", `Lifetime: ${pack.questionLoop.lifetimeDetail}`)
  );
  if (pack.questionLoop.targetSection) {
    const jump = textEl("button", "mini-button", "Inspect loop");
    jump.type = "button";
    jump.addEventListener("click", () => jumpToTodaySection(pack.questionLoop.targetSection));
    const footer = document.createElement("div");
    footer.className = "item-footer";
    footer.append(jump);
    loop.append(footer);
  }
  dom.todayList.append(loop);

  const archive = renderTodayDetailDrawer(pack);
  const archiveList = document.createElement("div");
  archiveList.className = "today-detail-list";
  archive.append(archiveList);
  dom.todayList.append(archive);

  const openQuestionTitle = todaySectionTitle("Open Questions", "open_questions");
  archiveList.append(openQuestionTitle);
  if (!pack.questionItems.length) {
    archiveList.append(emptyState("No open questions captured"));
  } else {
    pack.questionItems.forEach(({ sessionId, sessionTitle, capture }) => {
      const sourceSession = workspace.sessions.find((session) => session.id === sessionId);
      const item = document.createElement("article");
      item.className = "item-card question-card";
      item.append(textEl("div", "item-meta", [
        sessionTitle,
        capture.timestamp || "",
        new Date(capture.createdAt).toLocaleString()
      ].filter(Boolean).join(" · ")));
      const thought = document.createElement("div");
      thought.className = "capture-thought markdown-lite";
      renderMarkdown(thought, capture.thought || capture.quote || "Untitled question");
      item.append(thought);
      const footer = document.createElement("div");
      footer.className = "item-footer";
      footer.append(textEl("span", "", formatCaptureTags(capture)));
      const sourceHref = buildSourceJumpUrl(capture.sourceUrl || sourceSession?.sourceUrl, capture.timestamp);
      if (sourceHref) {
        const open = textEl("button", "mini-button", capture.timestamp ? `Open @ ${capture.timestamp}` : "Open source");
        open.type = "button";
        open.addEventListener("click", () => {
          window.open(sourceHref, "_blank", "noopener,noreferrer");
        });
        footer.append(open);
      }
      const view = textEl("button", "mini-button", "View");
      view.type = "button";
      view.addEventListener("click", () => openCaptureFromToday(sessionId, capture));
      footer.append(view);
      const answer = textEl("button", "mini-button", "Answer");
      answer.type = "button";
      answer.addEventListener("click", () => answerQuestionFromToday(capture.id, sessionId));
      footer.append(answer);
      const card = textEl("button", "mini-button", capture.promotedToReview ? "Card" : "Make card");
      card.type = "button";
      card.disabled = capture.promotedToReview;
      card.addEventListener("click", () => promoteCaptureToReview(capture.id, sessionId));
      footer.append(card);
      const park = textEl("button", "mini-button", "Park");
      park.type = "button";
      park.addEventListener("click", () => setQuestionParked(capture.id, sessionId, true));
      footer.append(park);
      const resolve = textEl("button", "mini-button primary", "Resolve");
      resolve.type = "button";
      resolve.addEventListener("click", () => setQuestionResolved(capture.id, sessionId, true));
      footer.append(resolve);
      item.append(footer);
      archiveList.append(item);
    });
    if (pack.questionOverflow) archiveList.append(emptyState(`+${pack.questionOverflow} more open questions in workspace.json`));
  }

  const parkedQuestionTitle = todaySectionTitle("Parked Questions", "parked_questions");
  archiveList.append(parkedQuestionTitle);
  if (!pack.parkedQuestionItems.length) {
    archiveList.append(emptyState("No parked questions"));
  } else {
    pack.parkedQuestionItems.forEach(({ sessionId, sessionTitle, capture }) => {
      const item = document.createElement("article");
      item.className = "item-card question-card parked-question-card";
      item.append(textEl("div", "item-meta", [
        sessionTitle,
        capture.questionParkedAt ? `Parked since ${new Date(capture.questionParkedAt).toLocaleString()}` : "",
        capture.timestamp || ""
      ].filter(Boolean).join(" · ")));
      const thought = document.createElement("div");
      thought.className = "capture-thought markdown-lite";
      renderMarkdown(thought, capture.thought || capture.quote || "Untitled question");
      item.append(thought);
      const footer = document.createElement("div");
      footer.className = "item-footer";
      footer.append(textEl("span", "", formatCaptureTags(capture)));
      const view = textEl("button", "mini-button", "View");
      view.type = "button";
      view.addEventListener("click", () => openCaptureFromToday(sessionId, capture));
      footer.append(view);
      const answer = textEl("button", "mini-button", "Answer");
      answer.type = "button";
      answer.addEventListener("click", () => answerQuestionFromToday(capture.id, sessionId));
      footer.append(answer);
      const resume = textEl("button", "mini-button primary", "Resume");
      resume.type = "button";
      resume.addEventListener("click", () => setQuestionParked(capture.id, sessionId, false));
      footer.append(resume);
      const resolve = textEl("button", "mini-button", "Resolve");
      resolve.type = "button";
      resolve.addEventListener("click", () => setQuestionResolved(capture.id, sessionId, true));
      footer.append(resolve);
      item.append(footer);
      archiveList.append(item);
    });
    if (pack.parkedQuestionOverflow) archiveList.append(emptyState(`+${pack.parkedQuestionOverflow} more parked questions in workspace.json`));
  }

  archiveList.append(todaySectionTitle("Answers Today", "answers_today"));
  archiveList.append(textEl("p", "item-meta", `Answer captures in ${pack.localDayWindow.label}`));
  if (!pack.answerItems.length) {
    archiveList.append(emptyState("No answers captured today"));
  } else {
    pack.answerItems.forEach(({ sessionId, sessionTitle, capture, questionCapture, answerReason }) => {
      const sourceSession = workspace.sessions.find((session) => session.id === sessionId);
      const item = document.createElement("article");
      item.className = "item-card answer-card";
      item.append(textEl("div", "item-meta", [
        sessionTitle,
        formatAnswerReason(answerReason),
        capture.timestamp || "",
        new Date(capture.capturedAt || capture.createdAt).toLocaleString()
      ].filter(Boolean).join(" · ")));
      const answer = document.createElement("div");
      answer.className = "capture-thought markdown-lite";
      renderMarkdown(answer, `Answer: ${formatAnswerCaptureSummary(capture)}`);
      item.append(answer);
      if (questionCapture) {
        item.append(textEl("p", "item-meta", `Answers: ${questionCapture.thought || questionCapture.quote || "linked question"}`));
      }
      const footer = document.createElement("div");
      footer.className = "item-footer";
      footer.append(textEl("span", "", formatCaptureTags(capture)));
      const sourceHref = buildSourceJumpUrl(capture.sourceUrl || sourceSession?.sourceUrl, capture.timestamp);
      if (sourceHref) {
        const open = textEl("button", "mini-button", capture.timestamp ? `Open @ ${capture.timestamp}` : "Open source");
        open.type = "button";
        open.addEventListener("click", () => {
          window.open(sourceHref, "_blank", "noopener,noreferrer");
        });
        footer.append(open);
      }
      const view = textEl("button", "mini-button", "View");
      view.type = "button";
      view.addEventListener("click", () => openCaptureFromToday(sessionId, capture));
      footer.append(view);
      item.append(footer);
      archiveList.append(item);
    });
    if (pack.answerOverflow) archiveList.append(emptyState(`+${pack.answerOverflow} more answers captured today in workspace.json`));
  }

  const closedQuestionTitle = todaySectionTitle("Closed Today", "closed_questions");
  archiveList.append(closedQuestionTitle);
  archiveList.append(textEl("p", "item-meta", `Local window: ${pack.localDayWindow.label}`));
  if (!pack.resolvedQuestionItems.length) {
    archiveList.append(emptyState("No questions closed today"));
  } else {
    pack.resolvedQuestionItems.forEach(({ sessionId, sessionTitle, capture, answerCapture }) => {
      const sourceSession = workspace.sessions.find((session) => session.id === sessionId);
      const item = document.createElement("article");
      item.className = "item-card question-card closed-question-card";
      item.append(textEl("div", "item-meta", [
        sessionTitle,
        capture.questionResolvedAt ? `Closed ${new Date(capture.questionResolvedAt).toLocaleString()}` : "",
        capture.timestamp || ""
      ].filter(Boolean).join(" · ")));
      const thought = document.createElement("div");
      thought.className = "capture-thought markdown-lite";
      renderMarkdown(thought, capture.thought || capture.quote || "Untitled question");
      item.append(thought);
      if (answerCapture) {
        const answer = document.createElement("div");
        answer.className = "capture-thought markdown-lite";
        renderMarkdown(answer, `Answer: ${formatAnswerCaptureSummary(answerCapture)}`);
        item.append(answer);
      }
      const footer = document.createElement("div");
      footer.className = "item-footer";
      footer.append(textEl("span", "", formatCaptureTags(capture)));
      const sourceHref = buildSourceJumpUrl(capture.sourceUrl || sourceSession?.sourceUrl, capture.timestamp);
      if (sourceHref) {
        const open = textEl("button", "mini-button", capture.timestamp ? `Open @ ${capture.timestamp}` : "Open source");
        open.type = "button";
        open.addEventListener("click", () => {
          window.open(sourceHref, "_blank", "noopener,noreferrer");
        });
        footer.append(open);
      }
      const view = textEl("button", "mini-button", "View");
      view.type = "button";
      view.addEventListener("click", () => openCaptureFromToday(sessionId, capture));
      footer.append(view);
      const card = textEl("button", "mini-button", closedQuestionCardLabel(capture, answerCapture));
      card.type = "button";
      card.disabled = capture.promotedToReview && !answerCapture;
      card.addEventListener("click", () => {
        if (capture.promotedToReview && answerCapture) {
          refreshAnsweredQuestionCard(capture.id, sessionId);
          return;
        }
        promoteCaptureToReview(capture.id, sessionId);
      });
      footer.append(card);
      const reopen = textEl("button", "mini-button primary", "Reopen");
      reopen.type = "button";
      reopen.addEventListener("click", () => setQuestionResolved(capture.id, sessionId, false));
      footer.append(reopen);
      item.append(footer);
      archiveList.append(item);
    });
    if (pack.resolvedQuestionOverflow) archiveList.append(emptyState(`+${pack.resolvedQuestionOverflow} more questions closed today in workspace.json`));
  }

  archiveList.append(todaySectionTitle("Recent Captures", "recent_captures"));
  if (!pack.recentCaptures.length) {
    archiveList.append(emptyState("No captures yet"));
    return;
  }
  pack.recentCaptures.forEach(({ sessionId, sessionTitle, capture }) => {
    const sourceSession = workspace.sessions.find((session) => session.id === sessionId);
    const item = document.createElement("article");
    item.className = "item-card";
    item.append(textEl("div", "item-meta", [
      sessionTitle,
      capture.timestamp || "",
      new Date(capture.createdAt).toLocaleString()
    ].filter(Boolean).join(" · ")));
    if (capture.quote) item.append(textEl("blockquote", "", capture.quote));
    if (capture.thought) {
      const thought = document.createElement("div");
      thought.className = "capture-thought markdown-lite";
      renderMarkdown(thought, capture.thought);
      item.append(thought);
    }
    const footer = document.createElement("div");
    footer.className = "item-footer";
    footer.append(textEl("span", "", formatCaptureTags(capture)));
    const sourceHref = buildSourceJumpUrl(capture.sourceUrl || sourceSession?.sourceUrl, capture.timestamp);
    if (sourceHref) {
      const open = textEl("button", "mini-button", capture.timestamp ? `Open @ ${capture.timestamp}` : "Open source");
      open.type = "button";
      open.addEventListener("click", () => {
        window.open(sourceHref, "_blank", "noopener,noreferrer");
      });
      footer.append(open);
    }
    const view = textEl("button", "mini-button", "View");
    view.type = "button";
    view.addEventListener("click", () => openCaptureFromToday(sessionId, capture));
    footer.append(view);
    item.append(footer);
    archiveList.append(item);
  });
  if (pack.recentOverflow) archiveList.append(emptyState(`+${pack.recentOverflow} more captures in workspace.json`));
}

function renderTodayDetailDrawer(pack) {
  const totalRecent = pack.recentCaptures.length + pack.recentOverflow;
  const totalDetails = [
    pack.stats.questions,
    pack.stats.parkedQuestions || 0,
    pack.stats.answerCapturesToday || 0,
    pack.stats.resolvedQuestionsToday || 0,
    totalRecent
  ].reduce((sum, value) => sum + (Number(value) || 0), 0);
  const drawer = document.createElement("details");
  const unresolvedQuestions = (Number(pack.stats.questions) || 0) + (Number(pack.stats.parkedQuestions) || 0);
  drawer.className = ["today-detail-drawer", unresolvedQuestions ? "has-attention" : ""].filter(Boolean).join(" ");
  drawer.dataset.todayDetailDrawer = "study_details";
  const summary = document.createElement("summary");
  summary.className = "today-detail-summary";
  const badges = document.createElement("span");
  badges.className = "today-detail-badges";
  badges.append(
    textEl("span", unresolvedQuestions ? "today-detail-badge is-attention" : "today-detail-badge", `${pack.stats.questions} open`),
    textEl("span", pack.stats.parkedQuestions ? "today-detail-badge is-warm" : "today-detail-badge", `${pack.stats.parkedQuestions || 0} parked`),
    textEl("span", totalRecent ? "today-detail-badge" : "today-detail-badge is-muted", `${totalRecent} recent`)
  );
  summary.append(
    textEl("strong", "", "Study Details"),
    textEl("span", "item-meta", `${totalDetails} tracked`),
    badges
  );
  const hint = textEl(
    "p",
    "today-detail-hint",
    "Open questions, parked follow-ups, answers, closed items, and recent captures stay here until you need the full ledger."
  );
  drawer.append(summary, hint);
  return drawer;
}

function renderTodaySectionMap(pack, draftItems = []) {
  const totalRecent = pack.recentCaptures.length + pack.recentOverflow;
  const entries = [
    { section: "due_review", label: "Due", value: pack.stats.due, tone: pack.stats.due ? "urgent" : "" },
    ...(draftItems.length ? [{ section: "capture_drafts", label: "Drafts", value: draftItems.length, tone: "warm" }] : []),
    { section: "open_questions", label: "Questions", value: pack.stats.questions, tone: pack.stats.questions ? "focus" : "" },
    { section: "parked_questions", label: "Parked", value: pack.stats.parkedQuestions || 0, tone: pack.stats.parkedQuestions ? "warm" : "" },
    { section: "answers_today", label: "Answers", value: pack.stats.answerCapturesToday || 0, tone: pack.stats.answerCapturesToday ? "green" : "" },
    { section: "closed_questions", label: "Closed", value: pack.stats.resolvedQuestionsToday || 0, tone: pack.stats.resolvedQuestionsToday ? "green" : "" },
    { section: "recent_captures", label: "Recent", value: totalRecent, tone: totalRecent ? "" : "muted" }
  ];
  const nav = document.createElement("nav");
  nav.className = "today-map";
  nav.setAttribute("aria-label", "Today sections");
  entries.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = ["today-map-button", entry.tone ? `is-${entry.tone}` : ""].filter(Boolean).join(" ");
    button.dataset.todayMapTarget = entry.section;
    button.setAttribute("aria-label", `Jump to ${entry.label}: ${entry.value}`);
    button.append(
      textEl("strong", "", String(entry.value)),
      textEl("span", "", entry.label)
    );
    button.addEventListener("click", () => jumpToTodaySection(entry.section));
    nav.append(button);
  });
  return nav;
}

function shouldShowStartHere(pack, draftItems = []) {
  return !draftItems.length
    && !pack.stats.captures
    && !pack.stats.cards
    && !pack.stats.due
    && !pack.stats.questions
    && !pack.stats.parkedQuestions
    && !pack.stats.resolvedQuestionsToday
    && !pack.stats.answerCapturesToday;
}

function renderLearningFlowPanel(pack, draftItems = [], showStartHere = false) {
  const panel = document.createElement("section");
  panel.className = "learning-flow-panel";
  panel.setAttribute("aria-label", "Learning flow");
  const header = document.createElement("div");
  header.className = "learning-flow-header";
  header.append(
    textEl("div", "item-meta", "Learning Flow"),
    textEl("span", "learning-flow-badge", "Mac first")
  );
  panel.append(header);

  const track = document.createElement("div");
  track.className = "learning-flow-track";
  track.append(
    renderLearningFlowStep(resolveSourceSessionState()),
    renderLearningFlowStep({
      kind: "capture",
      label: "Capture on Mac",
      status: captureFlowStatus(pack, draftItems),
      detail: "Keep the browser source open and catch quote, thought, time, or question.",
      actionLabel: showStartHere ? "Capture this thought" : "Capture",
      action: focusQuickCaptureFromStart,
      tone: "capture"
    }),
    renderLearningFlowStep(resolveCloseLoopState(pack, draftItems))
  );
  panel.append(track);

  const returnNudge = renderReturnedWorkNudge(pack);
  if (returnNudge) panel.append(returnNudge);
  panel.append(showStartHere ? renderStartHereInline() : renderTodayPrimaryAction(pack, draftItems));
  panel.append(renderReturnFilesPanel());
  return panel;
}

function renderLearningFlowStep(step) {
  const node = document.createElement("div");
  node.className = ["learning-flow-step", step.tone ? `is-${step.tone}` : ""].filter(Boolean).join(" ");
  if (step.kind) node.dataset.learningFlowStep = step.kind;
  if (step.wide) node.classList.add("is-wide");
  node.append(
    textEl("span", "learning-flow-step-label", step.label),
    textEl("strong", "", step.status),
    textEl("p", "", step.detail)
  );
  const action = textEl("button", "mini-button", step.actionLabel);
  action.type = "button";
  action.title = step.actionTitle || step.detail;
  action.setAttribute("aria-label", step.actionAriaLabel || `${step.actionLabel}: ${step.detail}`);
  action.addEventListener("click", step.action);
  node.append(action);
  return node;
}

function resolveSourceSessionState() {
  const session = getActiveSession(workspace);
  const draft = getCaptureDraft(session.id);
  const timestamp = dom.timestampInput.value || draft.timestamp || "";
  const resume = buildResumeSource(session, timestamp);
  const sourceLabel = resume.title || readableSourceHost(resume.url) || "No source";
  if (resume.href) {
    return {
      kind: "source",
      label: "Read source",
      status: resume.timestamp ? `Resume @ ${resume.timestamp}` : "Source linked",
      detail: resume.timestamp
        ? `${sourceLabel} · open the saved moment beside Quick Capture.`
        : `${sourceLabel} · open it beside Quick Capture before writing the next point.`,
      actionLabel: resume.timestamp ? "Resume source" : "Open source",
      actionAriaLabel: `${resume.timestamp ? `Resume ${sourceLabel} at ${resume.timestamp}` : `Open ${sourceLabel}`} beside Quick Capture`,
      action: resumeSourceFromLearningFlow,
      wide: Boolean(resume.timestamp),
      tone: "source"
    };
  }
  return {
    kind: "source",
    label: "Read source",
    status: "Needs source",
    detail: "Bind the browser URL or video before this study thread leaves the desk.",
    actionLabel: "Set source",
    actionAriaLabel: "Set source URL for this learning flow",
    action: () => promptForSource(session),
    wide: true,
    tone: "source"
  };
}

function resumeSourceFromLearningFlow() {
  const session = getActiveSession(workspace);
  const draft = getCaptureDraft(session.id);
  const resume = buildResumeSource(session, dom.timestampInput.value || draft.timestamp || "");
  if (!resume.href) {
    promptForSource(session);
    return;
  }
  setActivity(session, {
    title: resume.timestamp ? `Source resumed @ ${resume.timestamp}` : "Source opened",
    detail: `${resume.title || readableSourceHost(resume.url) || "Source"} · keep this app beside it and capture the next point.`,
    tab: "captures",
    targetId: ""
  });
  renderActivity(session);
  window.open(resume.href, "_blank", "noopener,noreferrer");
}

function captureFlowStatus(pack, draftItems = []) {
  const captureCount = Number(pack.stats.captures) || 0;
  const draftCount = draftItems.length;
  if (captureCount || draftCount) {
    return `${captureCount} ${captureCount === 1 ? "capture" : "captures"} · ${draftCount} ${draftCount === 1 ? "draft" : "drafts"}`;
  }
  return "Ready";
}

function resolveCloseLoopState(pack, draftItems = []) {
  // Keep the loop priority in one place: due review > unanswered question > unfinished draft > parked follow-up > clear.
  const [dueItem] = pack.dueItems;
  if (dueItem) {
    return {
      label: "Close the loop",
      status: `${pack.stats.due} due`,
      detail: `${dueItem.sessionTitle} · review the next due card before adding more material.`,
      actionLabel: "Review",
      action: () => startReviewAtItem(dueItem),
      kind: "loop",
      tone: "review"
    };
  }

  const [questionItem] = pack.questionItems;
  if (questionItem) {
    return {
      label: "Close the loop",
      status: `${pack.stats.questions} open`,
      detail: `${questionItem.sessionTitle} · answer, park, resolve, or turn it into a card.`,
      actionLabel: "Answer",
      action: () => answerQuestionFromToday(questionItem.capture.id, questionItem.sessionId),
      kind: "loop",
      tone: "question"
    };
  }

  const [draftItem] = draftItems;
  if (draftItem) {
    return {
      label: "Close the loop",
      status: `${draftItems.length} ${draftItems.length === 1 ? "draft" : "drafts"}`,
      detail: `${draftItem.session.title} · finish the waiting capture before opening another thread.`,
      actionLabel: "Resume",
      action: () => resumeCaptureDraft(draftItem.session.id),
      kind: "loop",
      tone: "parked"
    };
  }

  const [parkedItem] = pack.parkedQuestionItems;
  if (parkedItem) {
    return {
      label: "Close the loop",
      status: `${pack.stats.parkedQuestions} parked`,
      detail: `${parkedItem.sessionTitle} · resume a saved question when this study block has room.`,
      actionLabel: "Resume",
      action: () => setQuestionParked(parkedItem.capture.id, parkedItem.sessionId, false),
      kind: "loop",
      tone: "parked"
    };
  }

  return {
    label: "Close the loop",
    status: "Clear",
    detail: "No due cards or open questions are blocking the next capture.",
    actionLabel: "Inspect",
    action: () => jumpToTodaySection("question_health"),
    kind: "loop",
    tone: "clear"
  };
}

function renderReturnedWorkNudge(pack) {
  const nudge = returnedWorkNudge(pack);
  if (!nudge) return null;
  const card = document.createElement("article");
  card.className = `returned-work-card is-${nudge.kind}`;
  card.append(
    textEl("div", "item-meta", "Returned from phone/Windows"),
    textEl("p", "card-prompt", nudge.title),
    textEl("p", "item-meta", nudge.detail)
  );
  const footer = document.createElement("div");
  footer.className = "item-footer";
  const action = textEl("button", "mini-button primary", nudge.actionLabel);
  action.type = "button";
  action.dataset.returnedWorkAction = nudge.kind;
  action.addEventListener("click", nudge.run);
  footer.append(action);
  if (nudge.secondaryLabel && nudge.secondaryRun) {
    const secondary = textEl("button", "mini-button", nudge.secondaryLabel);
    secondary.type = "button";
    secondary.dataset.returnedWorkSecondary = nudge.kind;
    secondary.addEventListener("click", nudge.secondaryRun);
    footer.append(secondary);
  }
  const dismiss = textEl("button", "mini-button", "Dismiss");
  dismiss.type = "button";
  dismiss.dataset.returnedWorkDismiss = "true";
  dismiss.addEventListener("click", dismissReturnedWorkNudge);
  footer.append(dismiss);
  card.append(footer);
  return card;
}

function returnedWorkNudge(pack) {
  const receipt = lastImportReceipt;
  if (!receipt || receipt.schema === "learning-companion.import-error-receipt.v1") return null;
  const nudgeKey = returnNudgeKey(receipt);
  if (dismissedReturnNudgeKey === nudgeKey) return null;
  const work = returnReceiptNewWork(receipt);
  if (!work.newItems) return null;
  const fileDetail = returnedFileDetail(receipt);
  const failedDetail = returnedFailedDetail(receipt);
  const captureDetail = work.inboxAdded ? `${work.inboxAdded} returned ${work.inboxAdded === 1 ? "capture" : "captures"}` : "";
  const reviewDetail = work.reviewApplied ? `${work.reviewApplied} review ${work.reviewApplied === 1 ? "update" : "updates"} applied` : "";
  const basisDetail = returnedBasisDetail(receipt);
  const detail = [fileDetail, captureDetail, reviewDetail, basisDetail, failedDetail].filter(Boolean).join(" · ");
  if (work.inboxAdded) {
    return {
      kind: "inbox",
      title: returnedWorkTitle(work),
      detail,
      actionLabel: "View captures",
      run: () => jumpToTodaySection("recent_captures"),
      secondaryLabel: "Import details",
      secondaryRun: openLastReturnReceipt
    };
  }
  return {
    kind: "review",
    title: returnedWorkTitle(work),
    detail,
    actionLabel: "Import details",
    run: openLastReturnReceipt,
    secondaryLabel: pack.dueItems.length ? "Due review" : "Due status",
    secondaryRun: () => jumpToTodaySection("due_review")
  };
}

function returnReceiptNewWork(receipt) {
  const inboxAdded = returnedInboxAdded(receipt);
  const reviewApplied = returnedReviewApplied(receipt);
  return {
    inboxAdded,
    reviewApplied,
    newItems: inboxAdded + reviewApplied
  };
}

function returnedWorkTitle(work) {
  const captures = work.inboxAdded ? `${work.inboxAdded} new ${work.inboxAdded === 1 ? "capture" : "captures"}` : "";
  const reviews = work.reviewApplied ? `${work.reviewApplied} review ${work.reviewApplied === 1 ? "update" : "updates"}` : "";
  return `${[captures, reviews].filter(Boolean).join(" · ")} from phone or Windows`;
}

function returnedInboxAdded(receipt) {
  if (receipt?.schema === "learning-companion.return-files-receipt.v1") return Number(receipt.inbox?.added) || 0;
  if (receipt?.schema === "learning-companion.mobile-inbox-receipt.v1") return Number(receipt.added) || 0;
  return 0;
}

function returnedReviewApplied(receipt) {
  if (receipt?.schema === "learning-companion.return-files-receipt.v1") return Number(receipt.review?.applied) || 0;
  if (receipt?.schema === "learning-companion.review-progress-receipt.v1") return Number(receipt.applied) || 0;
  return 0;
}

function returnedFileDetail(receipt) {
  if (receipt?.schema === "learning-companion.return-files-receipt.v1") {
    const succeeded = Number(receipt.processedFiles) || 0;
    return `${receipt.fileCount} return ${receipt.fileCount === 1 ? "file" : "files"} checked · ${succeeded} succeeded`;
  }
  return "1 return file";
}

function returnedFailedDetail(receipt) {
  if (receipt?.schema !== "learning-companion.return-files-receipt.v1" || !receipt.failedFiles) return "";
  return `${receipt.failedFiles} failed - open Import details`;
}

function returnedBasisDetail(receipt) {
  if (receipt?.schema !== "learning-companion.return-files-receipt.v1") {
    if (receipt?.sourceFingerprintBasis === "workspace") return "old return JSON - re-export mirror before next device pass";
    if (receipt?.sourceFingerprintMatches === false) return "mirror base changed";
    return "";
  }
  const parts = [];
  if (receipt.legacyBasisFiles) {
    parts.push(`${oldReturnFileCountLabel(receipt.legacyBasisFiles)} - re-export mirror before next device pass`);
  }
  if (receipt.baseChangedFiles) {
    parts.push(`${receipt.baseChangedFiles} mirror ${receipt.baseChangedFiles === 1 ? "base" : "bases"} changed`);
  }
  return parts.join(" · ");
}

function oldReturnFileCountLabel(count) {
  const value = Number(count) || 0;
  return `${value} old return ${value === 1 ? "file" : "files"}`;
}

function returnNudgeKey(receipt) {
  if (!receipt || typeof receipt !== "object") return "";
  return [
    receipt.schema || "",
    receipt.importedAt || "",
    returnedInboxAdded(receipt),
    returnedReviewApplied(receipt),
    receipt.processedFiles || "",
    receipt.fileCount || "",
    receipt.failedFiles || ""
  ].join("::");
}

function openLastReturnReceipt() {
  const panel = document.querySelector(".handoff-card");
  if (!panel) return;
  panel.open = true;
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
  pulseNode(panel);
}

function dismissReturnedWorkNudge() {
  dismissedReturnNudgeKey = returnNudgeKey(lastImportReceipt);
  renderToday();
}

function renderTodayPrimaryAction(pack, draftItems = []) {
  const move = todayPrimaryMove(pack, draftItems);
  const card = document.createElement("article");
  card.className = `item-card today-path-card is-${move.kind}`;
  card.append(
    textEl("div", "item-meta", "Next Move"),
    textEl("p", "card-prompt", move.title),
    textEl("p", "item-meta", move.detail)
  );
  const footer = document.createElement("div");
  footer.className = "item-footer";
  const action = textEl("button", "mini-button primary", move.actionLabel);
  action.type = "button";
  action.dataset.todayPathAction = move.kind;
  action.addEventListener("click", move.run);
  const inspect = textEl("button", "mini-button", move.inspectLabel);
  inspect.type = "button";
  inspect.dataset.todayPathTarget = move.targetSection;
  inspect.addEventListener("click", () => jumpToTodaySection(move.targetSection));
  footer.append(action, inspect);
  card.append(footer);
  return card;
}

function renderStartHereInline() {
  const card = document.createElement("article");
  card.className = "start-here-inline";
  card.append(
    textEl("div", "item-meta", "Start Here"),
    textEl("p", "card-prompt", "Start with what you are watching or reading.")
  );
  card.append(startHereActions());
  return card;
}

function todayPrimaryMove(pack, draftItems = []) {
  const [dueItem] = pack.dueItems;
  if (dueItem) {
    return {
      kind: "review",
      title: `Review ${pack.stats.due} due ${pack.stats.due === 1 ? "card" : "cards"}`,
      detail: `${dueItem.sessionTitle} · ${dueItem.card.prompt.slice(0, 120)}`,
      actionLabel: "Review",
      inspectLabel: "Due",
      targetSection: "due_review",
      run: () => startReviewAtItem(dueItem)
    };
  }

  const [draftItem] = draftItems;
  if (draftItem) {
    return {
      kind: "draft",
      title: "Resume capture draft",
      detail: `${draftItem.session.title} · ${summarizeCaptureDraft(draftItem.draft)}`,
      actionLabel: "Resume",
      inspectLabel: "Drafts",
      targetSection: "capture_drafts",
      run: () => resumeCaptureDraft(draftItem.session.id)
    };
  }

  const [questionItem] = pack.questionItems;
  if (questionItem) {
    return {
      kind: "question",
      title: `Answer ${pack.stats.questions} open ${pack.stats.questions === 1 ? "question" : "questions"}`,
      detail: `${questionItem.sessionTitle} · ${summarizeCapture(questionItem.capture)}`,
      actionLabel: "Answer",
      inspectLabel: "Questions",
      targetSection: "open_questions",
      run: () => answerQuestionFromToday(questionItem.capture.id, questionItem.sessionId)
    };
  }

  const [parkedItem] = pack.parkedQuestionItems;
  if (parkedItem) {
    return {
      kind: "parked",
      title: `Resume ${pack.stats.parkedQuestions} saved ${pack.stats.parkedQuestions === 1 ? "question" : "questions"}`,
      detail: `${parkedItem.sessionTitle} · ${summarizeCapture(parkedItem.capture)}`,
      actionLabel: "Resume",
      inspectLabel: "Saved",
      targetSection: "parked_questions",
      run: () => setQuestionParked(parkedItem.capture.id, parkedItem.sessionId, false)
    };
  }

  const [recentItem] = pack.recentCaptures;
  if (recentItem) {
    return {
      kind: "recent",
      title: "Continue latest capture",
      detail: `${recentItem.sessionTitle} · ${summarizeCapture(recentItem.capture)}`,
      actionLabel: "View",
      inspectLabel: "Recent",
      targetSection: "recent_captures",
      run: () => openCaptureFromToday(recentItem.sessionId, recentItem.capture)
    };
  }

  return {
    kind: "capture",
    title: "Capture next point",
    detail: `${getActiveSession(workspace).title} · ready for a quote, thought, or question`,
    actionLabel: "Capture",
    inspectLabel: "Recent",
    targetSection: "recent_captures",
    run: focusQuickCaptureFromStart
  };
}

function startHereActions() {
  const footer = document.createElement("div");
  footer.className = "item-footer";
  const capture = textEl("button", "mini-button primary", "Capture this thought");
  capture.type = "button";
  capture.dataset.startAction = "capture";
  capture.addEventListener("click", focusQuickCaptureFromStart);
  const question = textEl("button", "mini-button", "Ask about this");
  question.type = "button";
  question.dataset.startAction = "question";
  question.addEventListener("click", seedFirstQuestionDraft);
  const clipper = textEl("button", "mini-button", "Set up page clipper");
  clipper.type = "button";
  clipper.dataset.startAction = "clipper";
  clipper.addEventListener("click", openBookmarkletHandoff);
  footer.append(capture, question, clipper);
  return footer;
}

function todaySectionTitle(label, section) {
  const title = textEl("div", "today-section-title", label);
  if (section) title.dataset.todaySection = section;
  return title;
}

function jumpToTodaySection(sectionName) {
  const section = document.querySelector(`[data-today-section="${CSS.escape(sectionName)}"]`);
  const drawer = section?.closest("details");
  if (drawer && !drawer.open) drawer.open = true;
  section?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (section) pulseNode(section);
}

function focusQuickCaptureFromStart() {
  const session = getActiveSession(workspace);
  workspace = updateSession(workspace, session.id, { focusMode: "capture" });
  activeTab = "captures";
  setActivity(getActiveSession(workspace), {
    title: "Ready to capture",
    detail: "Thought waiting in Quick Capture.",
    tab: "captures",
    targetId: ""
  });
  persistAndRender();
  dom.quoteInput.focus();
  pulseNode(dom.capturePane);
}

function seedFirstQuestionDraft() {
  const session = getActiveSession(workspace);
  const draft = getCaptureDraft(session.id);
  workspace = updateSession(workspace, session.id, { focusMode: "capture" });
  setCaptureDraft(session.id, {
    quote: draft.quote,
    thought: draft.thought || "Question: ",
    timestamp: draft.timestamp
  });
  activeTab = "captures";
  setActivity(getActiveSession(workspace), {
    title: "Question draft started",
    detail: "Question waiting in Quick Capture (no source yet).",
    tab: "captures",
    targetId: ""
  });
  persistAndRender();
  dom.thoughtInput.focus();
  dom.thoughtInput.setSelectionRange(dom.thoughtInput.value.length, dom.thoughtInput.value.length);
  pulseNode(dom.capturePane);
}

function openBookmarkletHandoff() {
  const session = getActiveSession(workspace);
  activeTab = "export";
  setActivity(session, {
    title: "Current page clipper ready",
    detail: "Bookmarklet selected in Export.",
    tab: "export",
    targetId: ""
  });
  renderInspector();
  renderActivity(session);
  dom.bookmarkletExport.focus();
  dom.bookmarkletExport.select();
}

function renderTodayDrafts(drafts = getCaptureDraftItems()) {
  if (!drafts.length) return;
  dom.todayList.append(todaySectionTitle("Capture Drafts", "capture_drafts"));
  drafts.forEach(({ session, draft }) => {
    const item = document.createElement("article");
    item.className = "item-card draft-card";
    item.append(textEl("div", "item-meta", [
      session.title,
      draft.timestamp ? `@ ${draft.timestamp}` : "",
      "device-local"
    ].filter(Boolean).join(" · ")));
    const body = [draft.quote, draft.thought].filter(Boolean).join("\n").trim();
    item.append(textEl("p", "card-prompt", body || `Time kept: ${draft.timestamp}`));
    const footer = document.createElement("div");
    footer.className = "item-footer";
    footer.append(textEl("span", "", "Not exported"));
    const resume = textEl("button", "mini-button primary", "Resume");
    resume.type = "button";
    resume.addEventListener("click", () => resumeCaptureDraft(session.id));
    footer.append(resume);
    item.append(footer);
    dom.todayList.append(item);
  });
}

function renderCaptureStack(session) {
  if (!dom.captureStack) return;
  clearChildren(dom.captureStack);
  const header = document.createElement("div");
  header.className = "capture-stack-header";
  header.append(
    textEl("strong", "", "Recent Stack"),
    textEl("span", "item-meta", session.captures.length
      ? `${Math.min(3, session.captures.length)} shown · ${session.captures.length} total`
      : "Sidecar memory")
  );
  const showAll = textEl("button", "mini-button", "All");
  showAll.type = "button";
  showAll.disabled = !session.captures.length;
  showAll.addEventListener("click", () => {
    activeTab = "captures";
    if (uiPrefs.sidecarLayout) {
      uiPrefs = { ...uiPrefs, sidecarLayout: false };
      saveUiPrefs();
      renderShellMode();
    }
    renderInspector();
  });
  header.append(showAll);
  dom.captureStack.append(header);

  if (!session.captures.length) {
    dom.captureStack.append(textEl("p", "capture-stack-empty", "Saved captures will stay visible here while you read."));
    return;
  }

  const list = document.createElement("div");
  list.className = "capture-stack-list";
  const linkedReviewCounts = linkedReviewCountsByCapture(session);
  session.captures.slice(0, 3).forEach((capture) => {
    const row = document.createElement("article");
    row.className = "capture-stack-row";
    row.dataset.stackCaptureId = capture.id;
    const isQuestion = captureHasQuestion(capture);
    const isOpenQuestion = captureHasOpenQuestion(capture);
    const isParkedQuestion = captureHasParkedQuestion(capture);
    row.append(
      textEl("div", "capture-stack-meta", [
        capture.timestamp || "No time",
        capture.sourceTitle || session.sourceTitle || capture.materialType || session.materialType,
        new Date(capture.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      ].filter(Boolean).join(" · ")),
      textEl("p", "capture-stack-text", summarizeCapture(capture))
    );
    if (isQuestion) {
      row.append(textEl(
        "span",
        isOpenQuestion ? "capture-stack-chip" : "capture-stack-chip resolved",
        isOpenQuestion ? "Question" : isParkedQuestion ? "Parked" : "Answered"
      ));
    }
    const actions = document.createElement("div");
    actions.className = "capture-stack-actions";
    const sourceHref = buildSourceJumpUrl(capture.sourceUrl || session.sourceUrl, capture.timestamp);
    if (sourceHref) {
      const openButton = textEl("button", "mini-button", capture.timestamp ? `Open @ ${capture.timestamp}` : "Open source");
      openButton.type = "button";
      openButton.addEventListener("click", () => {
        window.open(sourceHref, "_blank", "noopener,noreferrer");
      });
      actions.append(openButton);
    }
    const noteButton = textEl("button", "mini-button", "Note");
    noteButton.type = "button";
    noteButton.addEventListener("click", () => addCaptureToNotes(capture.id));
    actions.append(noteButton);
    const cardButton = textEl("button", "mini-button", capture.promotedToReview ? "Review" : "Make card");
    cardButton.type = "button";
    cardButton.addEventListener("click", () => {
      if (capture.promotedToReview) openReviewCardFromCapture(capture.id, session.id);
      else promoteCaptureToReview(capture.id);
    });
    actions.append(cardButton);
    actions.append(captureDeleteButton(session, capture, linkedReviewCounts.get(capture.id) || 0));
    row.append(actions);
    list.append(row);
  });
  dom.captureStack.append(list);
}

function getCaptureDraftItems() {
  return buildCaptureDraftItems(workspace.sessions, uiPrefs.captureDrafts, 5);
}

function resumeCaptureDraft(sessionId) {
  const selected = selectSession(workspace, sessionId);
  const session = getActiveSession(selected);
  workspace = updateSession(selected, session.id, { focusMode: "capture" });
  activeTab = "captures";
  setActivity(session, {
    title: "Capture draft resumed",
    detail: "Continue the saved quote or thought.",
    tab: "captures",
    targetId: ""
  });
  persistAndRender();
  dom.quoteInput.focus();
}

function formatAnswerCaptureSummary(capture) {
  return String(capture?.thought || capture?.quote || "Linked answer capture")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/^(?:a|answer)\s*[:：]\s*/i, "")
    .trim() || "Linked answer capture";
}

function formatAnswerReason(reason) {
  return {
    "linked-question": "linked answer",
    "tagged-answer": "tagged answer",
    "answer-prefix": "answer draft"
  }[reason] || "";
}

function questionActionDetail(session, capture) {
  return `${session.title} · ${summarizeCapture(capture)} · ${questionConversionReceipt()}`;
}

function questionConversionReceipt() {
  const loop = buildTodayPack(workspace, new Date(), {
    dueLimit: 1,
    questionLimit: 1,
    parkedQuestionLimit: 1,
    resolvedQuestionLimit: 1,
    answerLimit: 1,
    recentLimit: 1
  }).questionLoop;
  return `Loop: ${loop.activeQuestions} active · ${loop.parkedQuestions} parked · ${loop.resolvedQuestionsToday} closed today · ${loop.questionReviewCardsToday} ${loop.questionReviewCardsToday === 1 ? "card" : "cards"} today`;
}

function formatCaptureTags(capture) {
  return (Array.isArray(capture?.tags) ? capture.tags : [])
    .map((tag) => `#${tag}`)
    .join(" ");
}

function todayStat(value, label) {
  const node = document.createElement("div");
  node.className = "today-stat";
  node.append(textEl("strong", "", value), textEl("small", "", label));
  return node;
}

function renderReturnFilesPanel() {
  const panel = document.createElement("details");
  panel.className = "handoff-card";
  const inboxCount = workspace.importedPatches.length;
  const reviewCount = workspace.importedReviewPatches.length;
  panel.open = Boolean(lastImportReceipt || inboxCount || reviewCount);
  const summary = document.createElement("summary");
  summary.className = "device-flow-summary";
  const header = document.createElement("div");
  header.className = "handoff-header";
  header.append(
    textEl("strong", "", "Device Flow"),
    textEl("span", "item-meta", deviceFlowSummaryLabel())
  );
  const badges = document.createElement("span");
  badges.className = "device-flow-badges";
  badges.append(
    textEl("span", "manual-transfer-badge", "Manual transfer"),
    textEl("span", "manual-transfer-badge is-muted", "No live sync")
  );
  summary.append(header, badges);
  const detail = textEl(
    "p",
    "handoff-detail",
    lastImportReceipt ? `Last import: ${formatImportReceipt(lastImportReceipt)}` : "Export a mirror, use it on phone or Windows, then bring return JSON back."
  );
  const handoffState = renderMirrorHandoffStatus();
  const steps = document.createElement("ol");
  steps.className = "return-files-steps";
  [
    "Export mirror on this Mac.",
    "Transfer it yourself through USB, AirDrop, email, or any file share, including a manual Feishu Drive upload.",
    "On phone or Windows, open inbox.html or review.html and save inbox/review return JSON.",
    "Back on this Mac, import one or many return JSON files at once."
  ].forEach((step) => {
    steps.append(textEl("li", "", step));
  });
  const boundary = textEl("p", "handoff-boundary", "Manual transfer only. No live Feishu sync or verified HarmonyOS device app yet.");
  const footer = document.createElement("div");
  footer.className = "item-footer";
  const importPatch = textEl("button", "mini-button primary", "Import Return Files");
  importPatch.type = "button";
  importPatch.dataset.returnFilesStep = "import";
  importPatch.addEventListener("click", () => dom.importWorkspaceInput.click());
  const exportMirror = textEl("button", "mini-button", "Export Mirror");
  exportMirror.type = "button";
  exportMirror.dataset.returnFilesStep = "export";
  exportMirror.addEventListener("click", openReturnFilesMirrorExport);
  footer.append(exportMirror, importPatch);
  panel.append(summary, detail, handoffState, steps, boundary, footer);
  return panel;
}

function deviceFlowSummaryLabel() {
  const state = normalizeMirrorHandoff(uiPrefs.mirrorHandoff);
  const currentFingerprint = buildReturnBaseFingerprint(workspace);
  const inboxCount = workspace.importedPatches.length;
  const reviewCount = workspace.importedReviewPatches.length;
  const counts = `${inboxCount} inbox · ${reviewCount} review`;
  const hasExport = Boolean(state?.returnBaseFingerprint && state?.exportedAt && state?.kind);
  if (!hasExport) return `Next: export mirror · ${counts}`;
  if (state.returnBaseFingerprint !== currentFingerprint) return `Mac changed · re-export mirror · ${counts}`;
  if (returnImportCoversExport(state)) return `Return imported · ready for next export · ${counts}`;
  return `Mirror ready · waiting for phone/Windows return · ${counts}`;
}

function renderMirrorHandoffStatus() {
  const state = normalizeMirrorHandoff(uiPrefs.mirrorHandoff);
  const currentFingerprint = buildReturnBaseFingerprint(workspace);
  const grid = document.createElement("div");
  grid.className = "handoff-state-grid";

  const hasExport = Boolean(state?.returnBaseFingerprint && state?.exportedAt && state?.kind);
  if (!hasExport) {
    grid.append(renderHandoffStateItem(
      "No mirror exported yet",
      "Export to take Today to phone or Windows."
    ));
  } else if (state.returnBaseFingerprint === currentFingerprint) {
    grid.append(renderHandoffStateItem(
      "Mirror current",
      `${state.kind} exported ${formatRelativeLocalTime(state.exportedAt)}. Ready to open inbox.html or review.html.`
    ));
  } else {
    grid.append(renderHandoffStateItem(
      "Mac changed since mirror export",
      "Re-export before another phone or Windows study pass."
    ));
  }

  const waitingForReturn = hasExport && !returnImportCoversExport(state);
  if (state?.lastReturnImport && !waitingForReturn) {
    grid.append(renderHandoffStateItem(
      "Last return imported",
      mirrorReturnImportDetail(state.lastReturnImport)
    ));
  } else if (waitingForReturn) {
    grid.append(renderHandoffStateItem(
      "Waiting for return file",
      "Import Return JSON when you are back at this Mac."
    ));
  } else {
    grid.append(renderHandoffStateItem(
      "No return imported yet",
      "Use Review or Inbox on the mirror, then bring Return JSON back."
    ));
  }
  return grid;
}

function returnImportCoversExport(state) {
  if (!state?.exportedAt || !state?.lastReturnImport?.importedAt) return false;
  const exportedAt = new Date(state.exportedAt).getTime();
  const importedAt = new Date(state.lastReturnImport.importedAt).getTime();
  if (!Number.isFinite(exportedAt) || !Number.isFinite(importedAt)) return false;
  return importedAt >= exportedAt;
}

function renderHandoffStateItem(title, detail) {
  const node = document.createElement("div");
  node.className = "handoff-state-item";
  node.append(
    textEl("strong", "", title),
    textEl("span", "", detail)
  );
  return node;
}

function mirrorReturnImportDetail(importState) {
  const parts = [
    formatRelativeLocalTime(importState.importedAt),
    `${importState.fileCount || 0} ${importState.fileCount === 1 ? "file" : "files"}`,
    `${importState.newItems || 0} new`
  ];
  if (importState.baseChangedFiles) parts.push(`${importState.baseChangedFiles} changed base`);
  if (importState.legacyBasisFiles) {
    parts.push(`${oldReturnFileCountLabel(importState.legacyBasisFiles)} - re-export mirror before next device pass`);
  }
  return parts.join(" · ");
}

function formatRelativeLocalTime(value) {
  const date = new Date(value || "");
  const time = date.getTime();
  if (!Number.isFinite(time)) return "time unknown";
  const elapsedMs = Date.now() - time;
  if (elapsedMs < 0) return date.toLocaleString();
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  if (elapsedMinutes < 1) return "just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays}d ago`;
  return date.toLocaleDateString();
}

function openReturnFilesMirrorExport() {
  const session = getActiveSession(workspace);
  activeTab = "export";
  setActivity(session, {
    title: "Mirror export ready",
    detail: "Save Mirror JSON or ZIP, then move it through USB, AirDrop, email, file share, or a manual Feishu Drive upload.",
    tab: "export",
    targetId: ""
  });
  renderInspector();
  renderActivity(session);
  const section = document.querySelector("#mirrorExportSection");
  section?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (section) pulseNode(section);
  dom.downloadMirrorBtn.focus();
}

function startReviewAtItem(item) {
  workspace = selectSession(workspace, item.sessionId);
  const session = getActiveSession(workspace);
  workspace = updateSession(workspace, session.id, { focusMode: "review" });
  activeTab = "review";
  activeReviewKey = reviewKey(item.sessionId, item.card.id);
  revealedReviewCards.delete(activeReviewKey);
  setActivity(getActiveSession(workspace), {
    title: "Review queue ready",
    detail: `${item.sessionTitle} · ${item.card.prompt.slice(0, 120)}`,
    tab: "review",
    targetId: item.card.id
  });
  persistAndRender();
  scrollActivityTarget({ tab: "review", targetId: item.card.id });
}

function openCaptureFromToday(sessionId, capture) {
  workspace = selectSession(workspace, sessionId);
  const session = getActiveSession(workspace);
  workspace = updateSession(workspace, session.id, { focusMode: "capture" });
  activeTab = "captures";
  setActivity(getActiveSession(workspace), {
    title: "Capture selected",
    detail: summarizeCapture(capture),
    tab: "captures",
    targetId: capture.id
  });
  persistAndRender();
  scrollActivityTarget({ tab: "captures", targetId: capture.id });
}

function getActiveCapture(captureId) {
  const session = getActiveSession(workspace);
  const capture = session.captures.find((item) => item.id === captureId);
  return capture ? { session, capture } : null;
}

function addCaptureToNotes(captureId) {
  const target = getActiveCapture(captureId);
  if (!target) {
    showToast("Capture no longer exists");
    return;
  }
  const { session, capture } = target;
  const updatedNotes = upsertCaptureNoteBlock(session.notesMarkdown, capture);
  workspace = updateSession(workspace, session.id, { notesMarkdown: updatedNotes });
  notesMode = "preview";
  setActivity(getActiveSession(workspace), {
    title: "Capture added to notes",
    detail: summarizeCapture(capture),
    tab: "captures",
    targetId: capture.id
  });
  persistAndRender("Capture added to notes");
}

function promoteCaptureToReview(captureId, sessionId = getActiveSession(workspace).id) {
  const targetSession = workspace.sessions.find((session) => session.id === sessionId);
  if (!targetSession) {
    showToast("Topic no longer exists");
    return;
  }
  const capture = targetSession.captures.find((item) => item.id === captureId);
  if (!capture) {
    showToast("Capture no longer exists");
    return;
  }
  if (capture.promotedToReview) return;
  workspace = selectSession(workspace, targetSession.id);
  workspace = promoteCapture(workspace, targetSession.id, capture.id);
  activeTab = "review";
  setActivity(getActiveSession(workspace), {
    title: "Review card created",
    detail: questionActionDetail(targetSession, capture),
    tab: "review",
    targetId: getActiveSession(workspace).reviewCards[0]?.id
  });
  persistAndRender("Review card created");
}

function openReviewCardFromCapture(captureId, sessionId = getActiveSession(workspace).id) {
  const targetSession = workspace.sessions.find((session) => session.id === sessionId);
  const card = targetSession?.reviewCards.find((item) => item.sourceCaptureId === captureId);
  if (!targetSession || !card) {
    showToast("Review card no longer exists");
    return;
  }
  workspace = selectSession(workspace, targetSession.id);
  workspace = updateSession(workspace, targetSession.id, { focusMode: "review" });
  activeTab = "review";
  activeReviewKey = reviewKey(targetSession.id, card.id);
  revealedReviewCards.delete(activeReviewKey);
  setActivity(getActiveSession(workspace), {
    title: "Review card opened",
    detail: `${targetSession.title} · ${card.prompt.slice(0, 120)}`,
    tab: "review",
    targetId: card.id
  });
  persistAndRender("Review card opened");
  scrollActivityTarget({ tab: "review", targetId: card.id });
}

function refreshAnsweredQuestionCard(captureId, sessionId) {
  const targetSession = workspace.sessions.find((session) => session.id === sessionId);
  const capture = targetSession?.captures.find((item) => item.id === captureId);
  if (!targetSession || !capture) {
    showToast("Question no longer exists");
    return;
  }
  const before = targetSession.reviewCards.find((card) => card.sourceCaptureId === captureId);
  workspace = refreshAnsweredQuestionReviewCard(workspace, targetSession.id, captureId);
  const nextSession = workspace.sessions.find((session) => session.id === targetSession.id);
  const after = nextSession?.reviewCards.find((card) => card.id === before?.id);
  const changed = before && after && (
    after.prompt !== before.prompt || after.answer !== before.answer || after.updatedAt !== before.updatedAt
  );
  if (!changed) {
    showToast("No linked answer is available for that card yet");
    return;
  }
  workspace = selectSession(workspace, targetSession.id);
  activeTab = "review";
  activeReviewKey = reviewKey(targetSession.id, after.id);
  revealedReviewCards.delete(activeReviewKey);
  setActivity(getActiveSession(workspace), {
    title: "Review card refreshed",
    detail: questionActionDetail(targetSession, capture),
    tab: "review",
    targetId: after.id
  });
  persistAndRender("Review card refreshed");
}

function closedQuestionCardLabel(capture, answerCapture) {
  if (!capture.promotedToReview) return "Make card";
  return answerCapture ? "Refresh card" : "Card";
}

function answerQuestionFromToday(captureId, sessionId) {
  const sourceSession = workspace.sessions.find((session) => session.id === sessionId);
  const capture = sourceSession?.captures.find((item) => item.id === captureId);
  if (!sourceSession || !capture) {
    showToast("Question no longer exists");
    return;
  }
  workspace = selectSession(workspace, sourceSession.id);
  if (captureHasParkedQuestion(capture)) {
    workspace = setCaptureQuestionParked(workspace, sourceSession.id, capture.id, false);
  }
  workspace = updateSession(workspace, sourceSession.id, { focusMode: "capture" });
  activeTab = "captures";
  setCaptureDraft(sourceSession.id, {
    quote: capture.quote || capture.thought || "Question",
    thought: "Answer:",
    timestamp: capture.timestamp || "",
    answersQuestionCaptureId: capture.id
  });
  setActivity(getActiveSession(workspace), {
    title: "Answer draft started",
    detail: questionActionDetail(sourceSession, capture),
    tab: "captures",
    targetId: capture.id
  });
  persistAndRender("Answer draft started");
  dom.thoughtInput.focus();
  dom.thoughtInput.setSelectionRange(dom.thoughtInput.value.length, dom.thoughtInput.value.length);
}

function setQuestionParked(captureId, sessionId = getActiveSession(workspace).id, parked = true) {
  const sourceSession = workspace.sessions.find((session) => session.id === sessionId);
  const capture = sourceSession?.captures.find((item) => item.id === captureId);
  if (!sourceSession || !capture) {
    showToast("Capture no longer exists");
    return;
  }
  if (!captureHasQuestion(capture) || capture.questionResolvedAt) return;
  if (Boolean(capture.questionParkedAt) === parked) return;
  workspace = setCaptureQuestionParked(workspace, sourceSession.id, capture.id, parked);
  const targetIsActive = sourceSession.id === getActiveSession(workspace).id;
  setActivity(getActiveSession(workspace), {
    title: parked ? "Question parked" : "Question resumed",
    detail: questionActionDetail(sourceSession, capture),
    tab: targetIsActive ? "captures" : "today",
    targetId: targetIsActive ? capture.id : ""
  });
  persistAndRender(parked ? "Question parked" : "Question resumed");
}

function setQuestionResolved(captureId, sessionId = getActiveSession(workspace).id, resolved = true) {
  const sourceSession = workspace.sessions.find((session) => session.id === sessionId);
  const capture = sourceSession?.captures.find((item) => item.id === captureId);
  if (!sourceSession || !capture) {
    showToast("Capture no longer exists");
    return;
  }
  if (!captureHasQuestion(capture)) return;
  if (Boolean(capture.questionResolvedAt) === resolved) return;
  workspace = setCaptureQuestionResolved(workspace, sourceSession.id, capture.id, resolved);
  const targetIsActive = sourceSession.id === getActiveSession(workspace).id;
  setActivity(getActiveSession(workspace), {
    title: resolved ? "Question resolved" : "Question reopened",
    detail: questionActionDetail(sourceSession, capture),
    tab: targetIsActive ? "captures" : "today",
    targetId: targetIsActive ? capture.id : ""
  });
  persistAndRender(resolved ? "Question resolved" : "Question reopened");
}

function renderCaptures() {
  const session = getActiveSession(workspace);
  clearChildren(dom.captureList);
  if (!session.captures.length) {
    dom.captureList.append(emptyState("No captures yet"));
    return;
  }
  session.captures.forEach((capture) => {
    const item = document.createElement("article");
    item.className = "item-card";
    item.dataset.captureId = capture.id;
    item.append(textEl("div", "item-meta", [
      capture.timestamp || "No time",
      capture.sourceTitle || session.sourceTitle || capture.materialType || session.materialType,
      new Date(capture.createdAt).toLocaleString()
    ].filter(Boolean).join(" · ")));
    if (capture.quote) item.append(textEl("blockquote", "", capture.quote));
    if (capture.thought) {
      const thought = document.createElement("div");
      thought.className = "capture-thought markdown-lite";
      renderMarkdown(thought, capture.thought);
      item.append(thought);
    }

    const footer = document.createElement("div");
    footer.className = "item-footer";
    footer.append(textEl("span", "", formatCaptureTags(capture)));
    const actions = document.createElement("div");
    actions.className = "item-actions";
    const sourceHref = buildSourceJumpUrl(capture.sourceUrl || session.sourceUrl, capture.timestamp);
    if (sourceHref) {
      const openButton = document.createElement("button");
      openButton.className = "mini-button";
      openButton.type = "button";
      openButton.textContent = capture.timestamp ? `Open @ ${capture.timestamp}` : "Open source";
      openButton.addEventListener("click", () => {
        window.open(sourceHref, "_blank", "noopener,noreferrer");
      });
      actions.append(openButton);
    }
    const noteButton = document.createElement("button");
    noteButton.className = "mini-button";
    noteButton.type = "button";
    noteButton.textContent = "Note";
    noteButton.addEventListener("click", () => addCaptureToNotes(capture.id));
    actions.append(noteButton);
    const promoteButton = document.createElement("button");
    promoteButton.className = "mini-button";
    promoteButton.type = "button";
    promoteButton.disabled = capture.promotedToReview;
    promoteButton.textContent = capture.promotedToReview ? "Card" : "Make card";
    promoteButton.addEventListener("click", () => promoteCaptureToReview(capture.id));
    actions.append(promoteButton);
    if (captureHasQuestion(capture)) {
      const resolveButton = document.createElement("button");
      resolveButton.className = "mini-button";
      resolveButton.type = "button";
      const isOpenQuestion = captureHasOpenQuestion(capture);
      const isParkedQuestion = captureHasParkedQuestion(capture);
      resolveButton.textContent = isOpenQuestion ? "Resolve" : isParkedQuestion ? "Resume" : "Reopen";
      resolveButton.addEventListener("click", () => {
        if (isParkedQuestion) setQuestionParked(capture.id, session.id, false);
        else setQuestionResolved(capture.id, session.id, isOpenQuestion);
      });
      actions.append(resolveButton);
    }
    const linkedReviewCount = session.reviewCards.filter((card) => card.sourceCaptureId === capture.id).length;
    actions.append(captureDeleteButton(session, capture, linkedReviewCount));
    footer.append(actions);
    item.append(footer);
    dom.captureList.append(item);
  });
}

function linkedReviewCountsByCapture(session) {
  const counts = new Map();
  session.reviewCards.forEach((card) => {
    if (!card.sourceCaptureId) return;
    counts.set(card.sourceCaptureId, (counts.get(card.sourceCaptureId) || 0) + 1);
  });
  return counts;
}

function captureDeleteButton(session, capture, linkedReviewCount = 0) {
  const deleteButton = document.createElement("button");
  deleteButton.className = "mini-button danger";
  deleteButton.type = "button";
  deleteButton.textContent = linkedReviewCount
    ? `Delete + ${linkedReviewCount} card${linkedReviewCount === 1 ? "" : "s"}`
    : "Delete";
  deleteButton.addEventListener("click", () => deleteCaptureWithConfirmation(session.id, capture.id));
  return deleteButton;
}

function deleteCaptureWithConfirmation(sessionId, captureId) {
  const session = workspace.sessions.find((item) => item.id === sessionId);
  const capture = session?.captures.find((item) => item.id === captureId);
  if (!session || !capture) {
    showToast("Capture already deleted");
    render();
    return;
  }
  const linkedCards = session.reviewCards.filter((card) => card.sourceCaptureId === capture.id);
  const linkedReviewCount = linkedCards.length;
  const linkedCopy = linkedReviewCount
    ? ` and ${linkedReviewCount} linked review card${linkedReviewCount === 1 ? "" : "s"}`
    : "";
  if (!window.confirm(`Delete this capture${linkedCopy}?\n\n${summarizeCapture(capture)}\n\nExisting note blocks will stay in Notes.`)) return;
  stageCaptureDeleteUndo(session.id, capture.id, summarizeCapture(capture));
  clearReviewStateForDeletedCapture(session.id, linkedCards);
  workspace = deleteCapture(workspace, session.id, capture.id);
  setActivity(session, {
    title: "Capture deleted",
    detail: summarizeCapture(capture),
    tab: "captures",
    targetId: ""
  });
  persistAndRender("Capture deleted", { keepCaptureUndo: true });
}

function clearReviewStateForDeletedCapture(sessionId, linkedCards) {
  linkedCards.forEach((card) => {
    const key = reviewKey(sessionId, card.id);
    if (activeReviewKey === key) activeReviewKey = "";
    revealedReviewCards.delete(key);
  });
}

function stageCaptureDeleteUndo(sessionId, captureId, summary) {
  clearPendingCaptureUndo();
  pendingCaptureUndo = {
    workspace,
    activeReviewKey,
    revealedReviewKeys: [...revealedReviewCards],
    sessionId,
    captureId,
    summary
  };
  pendingCaptureUndoTimer = setTimeout(() => {
    pendingCaptureUndo = null;
    pendingCaptureUndoTimer = null;
    renderActivity(getActiveSession(workspace));
  }, CAPTURE_DELETE_UNDO_MS);
}

function clearPendingCaptureUndo(options = {}) {
  if (pendingCaptureUndoTimer) clearTimeout(pendingCaptureUndoTimer);
  pendingCaptureUndoTimer = null;
  pendingCaptureUndo = null;
  if (options.renderActivityStrip) renderActivity(getActiveSession(workspace));
}

function restorePendingCaptureDelete() {
  if (!pendingCaptureUndo) {
    showToast("Nothing to undo");
    renderActivity(getActiveSession(workspace));
    return;
  }
  const undo = pendingCaptureUndo;
  clearPendingCaptureUndo();
  workspace = undo.workspace;
  activeReviewKey = undo.activeReviewKey;
  revealedReviewCards.clear();
  undo.revealedReviewKeys.forEach((key) => revealedReviewCards.add(key));
  const session = workspace.sessions.find((item) => item.id === undo.sessionId) || getActiveSession(workspace);
  setActivity(session, {
    title: "Capture delete undone",
    detail: undo.summary,
    tab: "captures",
    targetId: undo.captureId
  });
  persistAndRender("Capture restored");
}

function renderReviewCards() {
  const session = getActiveSession(workspace);
  const dueItems = getDueReviewItems(workspace);
  dom.dueCount.textContent = `${dueItems.length} due`;
  clearChildren(dom.reviewList);
  const reviewItems = getReviewItemsForDisplay();
  if (!reviewItems.length) {
    dom.reviewList.append(emptyState("No review cards yet"));
    return;
  }
  if (!reviewItems.some((item) => reviewKey(item.sessionId, item.card.id) === activeReviewKey)) {
    const [first] = reviewItems;
    activeReviewKey = first ? reviewKey(first.sessionId, first.card.id) : "";
  }
  reviewItems.forEach(({ sessionId, sessionTitle, card }) => {
    const cardSession = workspace.sessions.find((sessionItem) => sessionItem.id === sessionId);
    const evidenceCapture = cardSession?.captures.find((capture) => capture.id === card.evidenceCaptureId);
    const key = reviewKey(sessionId, card.id);
    const isDue = dueItems.some((due) => reviewKey(due.sessionId, due.card.id) === key);
    const isActive = key === activeReviewKey;
    const isRevealed = revealedReviewCards.has(key);
    const item = document.createElement("article");
    item.className = `item-card review-card${isDue ? " due-card" : ""}${isActive ? " active-review-card" : ""}`;
    item.dataset.cardId = card.id;
    item.dataset.reviewKey = key;
    item.append(
      textEl("div", "item-meta", `${isDue ? "Due now" : `Due ${new Date(card.dueAt).toLocaleDateString()}`} · ${sessionTitle} · strength ${card.strength}`),
      textEl("p", "card-prompt", card.prompt)
    );

    const footer = document.createElement("div");
    footer.className = "item-footer";
    if (isRevealed && evidenceCapture) {
      const evidence = textEl("button", "mini-button", "Answer evidence");
      evidence.type = "button";
      evidence.addEventListener("click", () => openCaptureFromToday(sessionId, evidenceCapture));
      footer.append(evidence);
    }
    if (isRevealed) {
      const answer = document.createElement("div");
      answer.className = "review-answer markdown-lite";
      renderMarkdown(answer, card.answer);
      item.append(answer);

      const again = textEl("button", "mini-button", "Again");
      again.type = "button";
      again.dataset.grade = "again";
      const good = textEl("button", "mini-button", "Good");
      good.type = "button";
      good.dataset.grade = "good";
      footer.append(again, good);
    } else {
      const reveal = textEl("button", "mini-button primary", "Reveal");
      reveal.type = "button";
      reveal.dataset.revealCard = card.id;
      footer.append(reveal);
    }
    item.append(footer);

    footer.querySelector("[data-reveal-card]")?.addEventListener("click", () => {
      activeReviewKey = key;
      revealedReviewCards.add(key);
      renderInspector();
      renderDeskReview();
    });
    footer.querySelectorAll("[data-grade]").forEach((button) => {
      button.addEventListener("click", () => {
        activeReviewKey = key;
        gradeActiveReview(button.dataset.grade);
      });
    });
    const deleteButton = textEl("button", "mini-button danger", "Delete");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", () => {
      if (!window.confirm("Delete this review card? The original capture will remain and can be promoted again.")) return;
      workspace = deleteReviewCard(workspace, sessionId, card.id);
      revealedReviewCards.delete(key);
      if (activeReviewKey === key) activeReviewKey = "";
      setActivity(getActiveSession(workspace), {
        title: "Review card deleted",
        detail: `${sessionTitle} · ${card.prompt.slice(0, 120)}`,
        tab: "review",
        targetId: ""
      });
      persistAndRender("Review card deleted");
    });
    footer.append(deleteButton);
    dom.reviewList.append(item);
  });
}

function reviewKey(sessionId, cardId) {
  return `${sessionId}::${cardId}`;
}

function renderExport() {
  const session = getActiveSession(workspace);
  dom.workspaceExport.value = workspaceJson();
  dom.reviewPackExport.value = generateReviewPackMarkdown(workspace);
  dom.markdownExport.value = generateMarkdown(session);
  dom.payloadExport.value = JSON.stringify(buildFeishuPayload(session), null, 2);
  dom.todayExport.value = generateTodayMarkdown(workspace);
  dom.mirrorExport.value = JSON.stringify(buildMirrorBundle(workspace), null, 2);
  dom.bookmarkletExport.value = buildBookmarklet();
}

function exportWorkspace() {
  const serialized = workspaceJson();
  afterSave(saveTextFile("learning-companion-workspace.json", serialized, "application/json"), markWorkspaceExported);
}

function markWorkspaceExported() {
  uiPrefs = {
    ...uiPrefs,
    workspaceBackup: {
      fingerprint: workspaceBackupFingerprint(workspace),
      exportedAt: new Date().toISOString()
    }
  };
  saveUiPrefs();
  storageWarning = hasDirectedSaveDestination()
    ? "Backup saved - verify the selected file"
    : "Backup export requested - verify the exported file";
  renderStorageNotice();
  showToast(storageWarning);
}

function recordReturnFileExportReceipt(kind) {
  recordMirrorExport(kind);
  const session = getActiveSession(workspace);
  setActivity(session, {
    title: `${kind} handoff ready`,
    detail: `Move the ${kind} through USB, AirDrop, email, file share, or a manual Feishu Drive upload; then use inbox.html or review.html to create a return JSON.`,
    tab: "export",
    targetId: ""
  });
  renderActivity(session);
}

function recordMirrorExport(kind) {
  uiPrefs = {
    ...uiPrefs,
    mirrorHandoff: normalizeMirrorHandoff({
      ...(uiPrefs.mirrorHandoff || {}),
      returnBaseFingerprint: buildReturnBaseFingerprint(workspace),
      exportedAt: new Date().toISOString(),
      kind
    })
  };
  saveUiPrefs();
}

function recordMirrorReturnImport(receipt) {
  const importState = mirrorReturnImportState(receipt);
  if (!importState) return;
  uiPrefs = {
    ...uiPrefs,
    mirrorHandoff: normalizeMirrorHandoff({
      ...(uiPrefs.mirrorHandoff || {}),
      lastReturnImport: importState
    })
  };
  saveUiPrefs();
}

function mirrorReturnImportState(receipt) {
  if (!receipt || typeof receipt !== "object") return null;
  const importedAt = cleanBackupText(receipt.importedAt || new Date().toISOString(), 32);
  if (!importedAt) return null;
  if (receipt.schema === "learning-companion.return-files-receipt.v1") {
    const fingerprints = Array.isArray(receipt.sourceReturnBaseFingerprints)
      ? receipt.sourceReturnBaseFingerprints.filter(Boolean)
      : [];
    return {
      importedAt,
      sourceFingerprint: fingerprints.length === 1 ? fingerprints[0] : fingerprints.length ? "multiple" : "",
      fileCount: Number(receipt.processedFiles) || 0,
      newItems: (Number(receipt.inbox?.added) || 0) + (Number(receipt.review?.applied) || 0),
      baseChangedFiles: Number(receipt.baseChangedFiles) || 0,
      legacyBasisFiles: Number(receipt.legacyBasisFiles) || 0
    };
  }
  return {
    importedAt,
    sourceFingerprint: receipt.sourceReturnBaseFingerprint || receipt.sourceFingerprint || "",
    fileCount: 1,
    newItems: (Number(receipt.added) || 0) + (Number(receipt.applied) || 0),
    baseChangedFiles: receipt.sourceFingerprintMatches === false ? 1 : 0,
    legacyBasisFiles: receipt.sourceFingerprintBasis === "workspace" ? 1 : 0
  };
}

function workspaceJson() {
  return JSON.stringify(workspace, null, 2);
}

function installNativeBridge() {
  window.learningCompanionNative = {
    exportWorkspaceJson() {
      persist();
      return workspaceJson();
    },
    importWorkspaceJson(text) {
      try {
        const imported = JSON.parse(String(text || ""));
        return importPortableData(imported, { focusTodayOnWorkspace: true });
      } catch (error) {
        recordImportFailure(error.message || "Import failed");
        return {
          ok: false,
          error: error.message || "Import failed"
        };
      }
    },
    captureClipboardText(text, options = {}) {
      return captureTextFromNative(text, options);
    },
    setSidecarLayout(enabled) {
      return setSidecarLayout(Boolean(enabled));
    },
    completeSaveRequest(requestId, result = {}) {
      const resolveRequest = nativeSaveRequests.get(String(requestId || ""));
      if (!resolveRequest) return false;
      nativeSaveRequests.delete(String(requestId || ""));
      resolveRequest(Boolean(result?.ok));
      return true;
    }
  };
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(message);
  } catch {
    showToast("Copy failed");
  }
}

function saveTextFile(filename, text, type) {
  if (canUseNativeSaveBridge()) {
    return saveTextFileWithNative(filename, text, type);
  }
  const blob = new Blob([text], { type });
  return saveBlobFile(filename, blob, type);
}

function saveBytesFile(filename, bytes, type) {
  return saveBlobFile(filename, new Blob([bytes], { type }), type);
}

function saveBlobFile(filename, blob, type) {
  if (canUseFileSavePicker()) {
    return window.showSaveFilePicker({
      suggestedName: filename,
      types: [filePickerType(filename, type)]
    })
      .then(async (handle) => {
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          showToast("Save failed");
        }
        return false;
      });
  }
  if (!shouldUseFallbackDownload()) {
    showToast("Save picker unavailable here; use Copy or the Mac app export.");
    return false;
  }
  downloadBlob(filename, blob);
  return true;
}

function afterSave(result, callback) {
  if (result && typeof result.then === "function") {
    result.then((saved) => {
      if (saved) callback();
    });
    return;
  }
  if (result) callback();
}

function saveCompleteMessage(label) {
  return hasDirectedSaveDestination() ? `${label} saved` : `${label} download requested`;
}

function hasDirectedSaveDestination() {
  return canUseNativeSaveBridge() || canUseFileSavePicker();
}

function canUseNativeSaveBridge() {
  return Boolean(window.webkit?.messageHandlers?.learningCompanion?.postMessage);
}

function saveTextFileWithNative(filename, text, type) {
  const requestId = `save_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return new Promise((resolveRequest) => {
    nativeSaveRequests.set(requestId, resolveRequest);
    try {
      window.webkit.messageHandlers.learningCompanion.postMessage({
        type: "saveTextFile",
        requestId,
        filename,
        mediaType: type,
        text: String(text || "")
      });
    } catch {
      nativeSaveRequests.delete(requestId);
      resolveRequest(saveBlobFile(filename, new Blob([text], { type }), type));
    }
  });
}

function canUseFileSavePicker() {
  return typeof window.showSaveFilePicker === "function"
    && !allowsAutomatedDownloadFallback();
}

function shouldUseFallbackDownload() {
  return allowsAutomatedDownloadFallback();
}

function allowsAutomatedDownloadFallback() {
  return window.__LC_ALLOW_AUTOMATED_DOWNLOADS__ === true;
}

function filePickerType(filename, type) {
  const extension = filename.includes(".") ? `.${filename.split(".").pop()}` : "";
  return {
    description: type.includes("json") ? "JSON file" : type.includes("markdown") ? "Markdown file" : "Learning Companion file",
    accept: {
      [type || "application/octet-stream"]: extension ? [extension] : []
    }
  };
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildBookmarklet() {
  const base = `${window.location.origin}${window.location.pathname}`;
  const source = `(()=>{const base=${JSON.stringify(base)};const getTime=()=>{const video=[...document.querySelectorAll("video")].find((item)=>!item.paused)||document.querySelector("video");if(!video||!Number.isFinite(video.currentTime))return"";const seconds=Math.floor(video.currentTime);return [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map((part)=>String(part).padStart(2,"0")).join(":")};const params=new URLSearchParams({capture:"1",sourceTitle:document.title,sourceUrl:location.href,quote:String(getSelection()||"").trim(),t:getTime()});window.open(base+"?"+params.toString(),"learning-companion","noopener,noreferrer,width=1100,height=760");})();`;
  return `javascript:${source}`;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

function hasUserWorkspace(value) {
  return Boolean(value?.sessions?.some((session) => (
    session.captures.length ||
    session.reviewCards.length ||
    session.notesMarkdown.trim() ||
    session.title !== "Untitled learning session"
  )));
}

function confirmBundleImport(bundle) {
  const exportedAt = bundle.exportedAt ? ` from ${new Date(bundle.exportedAt).toLocaleString()}` : "";
  const count = bundle.workspace?.sessionCount ?? bundle.files?.length ?? 0;
  return window.confirm(`Replace current workspace with mirror bundle${exportedAt}? (${count} sessions)`);
}

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add("visible");
  setTimeout(() => dom.toast.classList.remove("visible"), 1800);
}

function slugify(value) {
  return String(value || "learning-session")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "learning-session";
}

function summarizeCapture(capture) {
  if (!capture) return "No capture details yet.";
  const text = String(capture.thought || capture.quote || "Untitled capture")
    .replace(/\s+/g, " ")
    .trim();
  const prefix = capture.timestamp ? `${capture.timestamp} · ` : "";
  return `${prefix}${text}`.slice(0, 150);
}

function upsertCaptureNoteBlock(notesMarkdown, capture) {
  const start = `<!-- learning-companion:capture:${capture.id}:start -->`;
  const end = `<!-- learning-companion:capture:${capture.id}:end -->`;
  const lines = [start];
  if (capture.quote) lines.push(`> ${String(capture.quote).replace(/\n/g, "\n> ")}`);
  if (capture.thought) lines.push("", String(capture.thought).trim());
  const source = formatCaptureNoteSource(capture);
  if (source) lines.push("", source);
  lines.push(end);
  const block = lines.join("\n").replace(/\n{3,}/g, "\n\n");
  const existing = new RegExp(`\\n*<!-- learning-companion:capture:${escapeRegExp(capture.id)}:start -->[\\s\\S]*?<!-- learning-companion:capture:${escapeRegExp(capture.id)}:end -->`);
  const notes = String(notesMarkdown || "").trim();
  if (existing.test(notes)) return notes.replace(existing, `\n\n${block}`).trim();
  return [notes, block].filter(Boolean).join("\n\n");
}

function formatCaptureNoteSource(capture) {
  const href = buildSourceJumpUrl(capture.sourceUrl, capture.timestamp);
  const title = capture.sourceTitle || "Open source";
  const timestamp = capture.timestamp ? ` @ ${capture.timestamp}` : "";
  if (href) return `_Source: [${escapeMarkdownLinkText(title)}](${href})${timestamp}_`;
  if (capture.sourceTitle) return `_Source: ${capture.sourceTitle}${timestamp}_`;
  return capture.timestamp ? `_Time: ${capture.timestamp}_` : "";
}

function escapeMarkdownLinkText(value) {
  return String(value || "").replace(/[[\]\\]/g, "\\$&");
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clearChildren(node) {
  node.replaceChildren();
}

function textEl(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  node.textContent = String(text || "");
  return node;
}

function emptyState(text) {
  return textEl("div", "empty-state", text);
}
