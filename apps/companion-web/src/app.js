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
  buildResumeSource,
  buildSourceJumpUrl,
  buildTodayPack,
  captureDraftStatusText,
  captureHasOpenQuestion,
  captureHasParkedQuestion,
  captureHasQuestion,
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
  summarizeCaptureDraft,
  selectSession,
  setCaptureQuestionParked,
  setCaptureQuestionResolved,
  stripSourceTimestamp,
  updateSession,
  workspaceBackupFingerprint,
  workspaceStorageNotice,
  workspaceFromPortableData
} from "./model.js";
import { renderMarkdown } from "./markdown.js";

const STORAGE_KEY = "learning-companion.workspace.v1";
const UI_PREFS_KEY = "learning-companion.ui.v1";
const UI_PREFS_SCHEMA_VERSION = 2;

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
  openSourceBtn: document.querySelector("#openSourceBtn"),
  materialType: document.querySelector("#materialType"),
  timestampInput: document.querySelector("#timestampInput"),
  sessionTags: document.querySelector("#sessionTags"),
  sidecarLayoutBtn: document.querySelector("#sidecarLayoutBtn"),
  captureMetric: document.querySelector("#captureMetric"),
  cardMetric: document.querySelector("#cardMetric"),
  dueMetric: document.querySelector("#dueMetric"),
  sizeMetric: document.querySelector("#sizeMetric"),
  activityTitle: document.querySelector("#activityTitle"),
  activityDetail: document.querySelector("#activityDetail"),
  activityDetailsBtn: document.querySelector("#activityDetailsBtn"),
  focusBriefKicker: document.querySelector("#focusBriefKicker"),
  focusBriefAction: document.querySelector("#focusBriefAction"),
  focusBriefDetail: document.querySelector("#focusBriefDetail"),
  focusBriefFacts: document.querySelector("#focusBriefFacts"),
  focusBriefSignals: document.querySelector("#focusBriefSignals"),
  focusBriefActionBtn: document.querySelector("#focusBriefActionBtn"),
  quoteInput: document.querySelector("#quoteInput"),
  thoughtInput: document.querySelector("#thoughtInput"),
  capturePane: document.querySelector("#capturePane"),
  captureStack: document.querySelector("#captureStack"),
  captureDraftStatus: document.querySelector("#captureDraftStatus"),
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
  lastImportReceipt = null;
  renderImportReceipt();
});

dom.importWorkspaceInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
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
    importPortableData(imported);
  } catch (error) {
    const message = error.message || "Import failed";
    recordImportFailure(message, file.name);
    showToast(message);
  } finally {
    event.target.value = "";
  }
});

function importPortableData(imported, options = {}) {
  const focusTodayOnWorkspace = Boolean(options.focusTodayOnWorkspace);
  if (isMobileInboxPatch(imported)) {
    const result = applyMobileInboxPatch(workspace, imported);
    workspace = result.workspace;
    lastImportReceipt = result.receipt;
    setActivity(getActiveSession(workspace), {
      title: "Mobile inbox imported",
      detail: formatInboxReceipt(result.receipt),
      tab: "captures",
      targetId: ""
    });
    persistAndRender(`Inbox import: ${result.receipt.added} added`);
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
    lastImportReceipt = result.receipt;
    setActivity(getActiveSession(workspace), {
      title: "Review progress imported",
      detail: formatImportReceipt(result.receipt),
      tab: "review",
      targetId: ""
    });
    persistAndRender(`Review import: ${result.receipt.applied} applied`);
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

dom.openSourceBtn.addEventListener("click", () => {
  const session = getActiveSession(workspace);
  const resume = buildResumeSource(session, dom.timestampInput.value);
  if (resume.href) window.open(resume.href, "_blank", "noopener,noreferrer");
});

dom.sidecarLayoutBtn.addEventListener("click", toggleSidecarLayout);
dom.activityDetailsBtn.addEventListener("click", showActivityDetails);
dom.focusBriefActionBtn.addEventListener("click", runFocusBriefAction);

window.addEventListener("pagehide", persist);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") persist();
});

dom.captureBtn.addEventListener("click", () => capture(false));
dom.captureCardBtn.addEventListener("click", () => capture(true));
dom.captureClozeBtn.addEventListener("click", () => capture("cloze"));
dom.clearCaptureDraftBtn.addEventListener("click", clearCurrentCaptureDraft);
[dom.quoteInput, dom.thoughtInput, dom.timestampInput].forEach((node) => {
  node.addEventListener("input", saveCurrentCaptureDraft);
  node.addEventListener("change", saveCurrentCaptureDraft);
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
  if (isMod && event.key === "Enter") {
    event.preventDefault();
    capture(event.shiftKey);
  }
  if (isMod && event.key.toLowerCase() === "s") {
    event.preventDefault();
    persistAndRender("Saved");
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
dom.downloadReviewPackBtn.addEventListener("click", () => {
  downloadText("LEARNING_COMPANION_REVIEW_PACK.md", dom.reviewPackExport.value, "text/markdown");
});
dom.downloadMarkdownBtn.addEventListener("click", () => {
  const session = getActiveSession(workspace);
  downloadText(`${slugify(session.title)}.md`, generateMarkdown(session), "text/markdown");
});
dom.downloadPayloadBtn.addEventListener("click", () => {
  const session = getActiveSession(workspace);
  downloadText(`${slugify(session.title)}.feishu.json`, JSON.stringify(buildFeishuPayload(session), null, 2), "application/json");
});
dom.downloadTodayBtn.addEventListener("click", () => {
  downloadText("TODAY.md", dom.todayExport.value, "text/markdown");
});
dom.downloadMirrorBtn.addEventListener("click", () => {
  downloadText("learning-companion-feishu-mirror.json", dom.mirrorExport.value, "application/json");
});
dom.downloadMirrorZipBtn.addEventListener("click", () => {
  const zip = buildMirrorZip(workspace);
  downloadBytes(zip.filename, zip.data, zip.mediaType);
  showToast("Mirror ZIP saved");
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
      workspaceBackup: normalizeWorkspaceBackup(parsed.workspaceBackup)
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
      workspaceBackup: normalizeWorkspaceBackup(uiPrefs.workspaceBackup)
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
    workspaceBackup: null
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
  setCaptureDraft(session.id, {
    quote: dom.quoteInput.value,
    thought: dom.thoughtInput.value,
    timestamp: dom.timestampInput.value
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
  renderActivity(session);
  renderFocusBrief();
  if (activeTab === "today") renderToday();
}

function clearCurrentCaptureDraft() {
  setCaptureDraft(getActiveSession(workspace).id, {});
  clearCaptureDraftActivity(getActiveSession(workspace).id);
  renderCaptureDraft(getActiveSession(workspace));
  renderOpenSourceButton(getActiveSession(workspace));
  renderActivity(getActiveSession(workspace));
  renderFocusBrief();
  if (activeTab === "today") renderToday();
  dom.quoteInput.focus();
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
  dom.captureDraftStatus.textContent = captureDraftStatusText(draft);
  dom.clearCaptureDraftBtn.hidden = !hasDraft;
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
  return String(value || "").trim().toLowerCase();
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
  if (event?.target === dom.sourceUrl) {
    const extractedTimestamp = extractSourceTimestamp(sourceUrl);
    if (extractedTimestamp && !dom.timestampInput.value.trim()) {
      dom.timestampInput.value = extractedTimestamp;
      setCaptureDraft(session.id, {
        quote: dom.quoteInput.value,
        thought: dom.thoughtInput.value,
        timestamp: extractedTimestamp
      });
      renderCaptureDraftStatus(session);
    }
    const strippedSourceUrl = stripSourceTimestamp(sourceUrl);
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
  renderFocusBrief();
  renderSessions();
  renderInspector();
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
  workspace = addCapture(workspace, session.id, {
    quote: dom.quoteInput.value,
    thought: dom.thoughtInput.value,
    timestamp: dom.timestampInput.value,
    tags: dom.sessionTags.value
  }, {
    promoteToReview: Boolean(promoteToReview),
    reviewPrompt: cloze?.prompt,
    reviewAnswer: cloze?.answer
  });
  const updated = getActiveSession(workspace);
  const isCloze = promoteToReview === "cloze";
  setCaptureDraft(session.id, {
    timestamp: dom.timestampInput.value
  });
  setActivity(updated, {
    title: isCloze ? "Cloze card saved" : promoteToReview ? "Capture and card saved" : "Capture saved",
    detail: summarizeCapture(updated.captures[0]),
    tab: promoteToReview ? "review" : "captures",
    targetId: promoteToReview ? updated.reviewCards[0]?.id : updated.captures[0]?.id
  });
  dom.quoteInput.value = "";
  dom.thoughtInput.value = "";
  persistAndRender(promoteToReview ? "Capture + card saved" : "Capture saved");
  dom.quoteInput.focus();
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
    targetId: promoteToReview ? updated.reviewCards[0]?.id : capture?.id
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
  dom.saveState.textContent = "Saving";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persist();
    dom.saveState.textContent = "Saved";
  }, 250);
}

function persistAndRender(message) {
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

function renderOpenSourceButton(session) {
  const resume = buildResumeSource(session, dom.timestampInput.value);
  dom.openSourceBtn.disabled = !resume.href;
  const title = resume.timestamp ? `Open source at ${resume.timestamp}` : "Open source";
  dom.openSourceBtn.title = title;
  dom.openSourceBtn.setAttribute("aria-label", title);
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
    targetId: activity.targetId || ""
  };
}

function renderActivity(session) {
  const activity = getActivity(session);
  const baseAction = activity.tab === "review"
    ? "Review"
    : activity.tab === "export" ? "Export" : "Details";
  const actionText = uiPrefs.sidecarLayout ? `Exit + ${baseAction}` : baseAction;
  const actionLabel = uiPrefs.sidecarLayout
    ? `Open ${baseAction.toLowerCase()} and exit sidecar layout`
    : `Open ${baseAction.toLowerCase()}`;
  dom.activityTitle.textContent = activity.title;
  dom.activityDetail.textContent = activity.detail;
  dom.activityDetailsBtn.textContent = actionText;
  dom.activityDetailsBtn.title = actionLabel;
  dom.activityDetailsBtn.setAttribute("aria-label", actionLabel);
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
  dom.focusBriefFacts.append(
    focusBriefFact("Source", session.sourceTitle || (session.sourceUrl ? "Open source" : "No source")),
    focusBriefFact("Draft", draft.timestamp ? `Saved @ ${draft.timestamp}` : "Saved locally"),
    focusBriefFact("Sync", "Device-local"),
    focusBriefFact("Why", "Fresh local draft and no due review is blocking it.")
  );
  clearChildren(dom.focusBriefSignals);
  dom.focusBriefSignals.append(
    textEl("span", "focus-signal warn", "Draft waiting"),
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
  if (!activity.targetId) return;
  const selector = activity.tab === "review"
    ? `[data-card-id="${CSS.escape(activity.targetId)}"]`
    : `[data-capture-id="${CSS.escape(activity.targetId)}"]`;
  const target = document.querySelector(selector);
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
  pulseNode(target);
}

function pulseNode(target) {
  target?.classList.add("pulse");
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
  dom.importReceipt.classList.toggle("import-receipt-error", receipt?.schema === "learning-companion.import-error-receipt.v1");
  if (!receipt) return;
  dom.importReceiptTitle.textContent = importReceiptTitle(receipt);
  dom.importReceiptDetail.textContent = formatImportReceipt(receipt);
}

function importReceiptTitle(receipt) {
  if (receipt?.schema === "learning-companion.review-progress-receipt.v1") return "Review progress imported";
  if (receipt?.schema === "learning-companion.import-error-receipt.v1") return "Import issue";
  return "Mobile inbox imported";
}

function formatImportReceipt(receipt) {
  if (receipt?.schema === "learning-companion.import-error-receipt.v1") {
    return formatImportErrorReceipt(receipt);
  }
  if (receipt?.schema === "learning-companion.review-progress-receipt.v1") {
    return formatReviewProgressReceipt(receipt);
  }
  return formatInboxReceipt(receipt);
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
  return `${receipt.added} added, ${receipt.skippedDuplicate} skipped${sanitized}${answered}${refreshable}${answerSkipped} · ${resolution} · ${receipt.targetSessionTitle}`;
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
  return `${receipt.applied} applied${duplicate}${missing}${conflict}${invalid} · ${receipt.totalEvents} events`;
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

  dom.todayList.append(renderPatchIntakePanel());
  renderTodayDrafts();

  dom.todayList.append(textEl("div", "today-section-title", "Due Review"));
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

  dom.todayList.append(textEl("div", "today-section-title", "Question Queue Health"));
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
    jump.addEventListener("click", () => {
      const section = document.querySelector(`[data-today-section="${CSS.escape(pack.questionHealth.targetSection)}"]`);
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (section) pulseNode(section);
    });
    const footer = document.createElement("div");
    footer.className = "item-footer";
    footer.append(jump);
    health.append(footer);
  }
  dom.todayList.append(health);

  dom.todayList.append(textEl("div", "today-section-title", "Question Loop"));
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
    jump.addEventListener("click", () => {
      const section = document.querySelector(`[data-today-section="${CSS.escape(pack.questionLoop.targetSection)}"]`);
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (section) pulseNode(section);
    });
    const footer = document.createElement("div");
    footer.className = "item-footer";
    footer.append(jump);
    loop.append(footer);
  }
  dom.todayList.append(loop);

  const openQuestionTitle = textEl("div", "today-section-title", "Open Questions");
  openQuestionTitle.dataset.todaySection = "open_questions";
  dom.todayList.append(openQuestionTitle);
  if (!pack.questionItems.length) {
    dom.todayList.append(emptyState("No open questions captured"));
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
      dom.todayList.append(item);
    });
    if (pack.questionOverflow) dom.todayList.append(emptyState(`+${pack.questionOverflow} more open questions in workspace.json`));
  }

  const parkedQuestionTitle = textEl("div", "today-section-title", "Parked Questions");
  parkedQuestionTitle.dataset.todaySection = "parked_questions";
  dom.todayList.append(parkedQuestionTitle);
  if (!pack.parkedQuestionItems.length) {
    dom.todayList.append(emptyState("No parked questions"));
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
      dom.todayList.append(item);
    });
    if (pack.parkedQuestionOverflow) dom.todayList.append(emptyState(`+${pack.parkedQuestionOverflow} more parked questions in workspace.json`));
  }

  dom.todayList.append(textEl("div", "today-section-title", "Answers Today"));
  dom.todayList.append(textEl("p", "item-meta", `Answer captures in ${pack.localDayWindow.label}`));
  if (!pack.answerItems.length) {
    dom.todayList.append(emptyState("No answers captured today"));
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
      dom.todayList.append(item);
    });
    if (pack.answerOverflow) dom.todayList.append(emptyState(`+${pack.answerOverflow} more answers captured today in workspace.json`));
  }

  const closedQuestionTitle = textEl("div", "today-section-title", "Closed Today");
  closedQuestionTitle.dataset.todaySection = "closed_questions";
  dom.todayList.append(closedQuestionTitle);
  dom.todayList.append(textEl("p", "item-meta", `Local window: ${pack.localDayWindow.label}`));
  if (!pack.resolvedQuestionItems.length) {
    dom.todayList.append(emptyState("No questions closed today"));
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
      dom.todayList.append(item);
    });
    if (pack.resolvedQuestionOverflow) dom.todayList.append(emptyState(`+${pack.resolvedQuestionOverflow} more questions closed today in workspace.json`));
  }

  dom.todayList.append(textEl("div", "today-section-title", "Recent Captures"));
  if (!pack.recentCaptures.length) {
    dom.todayList.append(emptyState("No captures yet"));
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
    dom.todayList.append(item);
  });
  if (pack.recentOverflow) dom.todayList.append(emptyState(`+${pack.recentOverflow} more captures in workspace.json`));
}

function renderTodayDrafts() {
  const drafts = getCaptureDraftItems();
  if (!drafts.length) return;
  dom.todayList.append(textEl("div", "today-section-title", "Capture Drafts"));
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
    const cardButton = textEl("button", "mini-button", capture.promotedToReview ? "Card" : "Make card");
    cardButton.type = "button";
    cardButton.disabled = capture.promotedToReview;
    cardButton.addEventListener("click", () => promoteCaptureToReview(capture.id));
    actions.append(cardButton);
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

function renderPatchIntakePanel() {
  const panel = document.createElement("article");
  panel.className = "item-card handoff-card";
  const inboxCount = workspace.importedPatches.length;
  const reviewCount = workspace.importedReviewPatches.length;
  const header = document.createElement("div");
  header.className = "handoff-header";
  header.append(
    textEl("strong", "", "Patch Intake"),
    textEl("span", "item-meta", `${inboxCount} inbox · ${reviewCount} review`)
  );
  const detail = textEl(
    "p",
    "handoff-detail",
    lastImportReceipt ? formatImportReceipt(lastImportReceipt) : "Append-only JSON return path"
  );
  const footer = document.createElement("div");
  footer.className = "item-footer";
  const importPatch = textEl("button", "mini-button primary", "Import Patch");
  importPatch.type = "button";
  importPatch.addEventListener("click", () => dom.importWorkspaceInput.click());
  const exportMirror = textEl("button", "mini-button", "Export Mirror");
  exportMirror.type = "button";
  exportMirror.addEventListener("click", () => {
    activeTab = "export";
    renderInspector();
  });
  footer.append(importPatch, exportMirror);
  panel.append(header, detail, footer);
  return panel;
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
    detail: summarizeCapture(capture),
    tab: "review",
    targetId: getActiveSession(workspace).reviewCards[0]?.id
  });
  persistAndRender("Review card created");
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
    detail: summarizeCapture(capture),
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
    timestamp: capture.timestamp || ""
  });
  setActivity(getActiveSession(workspace), {
    title: "Answer draft started",
    detail: `${sourceSession.title} · ${summarizeCapture(capture)}`,
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
    detail: `${sourceSession.title} · ${summarizeCapture(capture)}`,
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
    detail: `${sourceSession.title} · ${summarizeCapture(capture)}`,
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
    const deleteButton = document.createElement("button");
    deleteButton.className = "mini-button danger";
    deleteButton.type = "button";
    deleteButton.textContent = linkedReviewCount
      ? `Delete + ${linkedReviewCount} card${linkedReviewCount === 1 ? "" : "s"}`
      : "Delete";
    deleteButton.addEventListener("click", () => {
      const linkedCopy = linkedReviewCount
        ? ` and ${linkedReviewCount} linked review card${linkedReviewCount === 1 ? "" : "s"}`
        : "";
      if (!window.confirm(`Delete this capture${linkedCopy}? Notes already inserted will be kept.`)) return;
      workspace = deleteCapture(workspace, session.id, capture.id);
      activeReviewKey = "";
      revealedReviewCards.clear();
      setActivity(getActiveSession(workspace), {
        title: "Capture deleted",
        detail: summarizeCapture(capture),
        tab: "captures",
        targetId: ""
      });
      persistAndRender("Capture deleted");
    });
    actions.append(deleteButton);
    footer.append(actions);
    item.append(footer);
    dom.captureList.append(item);
  });
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
  downloadText("learning-companion-workspace.json", serialized, "application/json");
  uiPrefs = {
    ...uiPrefs,
    workspaceBackup: {
      fingerprint: workspaceBackupFingerprint(workspace),
      exportedAt: new Date().toISOString()
    }
  };
  saveUiPrefs();
  storageWarning = "Export requested - verify downloaded file";
  renderStorageNotice();
  showToast("Export requested - verify downloaded file");
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

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  downloadBlob(filename, blob);
}

function downloadBytes(filename, bytes, type) {
  downloadBlob(filename, new Blob([bytes], { type }));
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
