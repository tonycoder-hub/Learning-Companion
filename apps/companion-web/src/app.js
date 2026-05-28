import {
  WORKSPACE_SCHEMA,
  MAX_INBOX_PATCH_BYTES,
  MAX_MIRROR_BUNDLE_BYTES,
  addCapture,
  addSession,
  applyMobileInboxPatch,
  buildFeishuPayload,
  buildFocusBrief,
  buildMirrorBundle,
  buildMirrorZip,
  buildSourceJumpUrl,
  buildTodayPack,
  deleteCapture,
  deleteReviewCard,
  filterSessions,
  generateMarkdown,
  generateSynthesisDraft,
  generateTodayMarkdown,
  getSynthesisStats,
  getSynthesisSourceStamp,
  getDueReviewCards,
  getDueReviewItems,
  getActiveSession,
  gradeCard,
  isMirrorBundle,
  isMobileInboxPatch,
  isMobileInboxPatchLike,
  promoteCapture,
  safeHref,
  sanitizeWorkspace,
  selectSession,
  updateSession,
  workspaceFromPortableData
} from "./model.js";
import { renderMarkdown } from "./markdown.js";

const STORAGE_KEY = "learning-companion.workspace.v1";
const UI_PREFS_KEY = "learning-companion.ui.v1";
const UI_PREFS_SCHEMA_VERSION = 1;

const dom = {
  appShell: document.querySelector(".app-shell"),
  sidebar: document.querySelector(".sidebar"),
  inspector: document.querySelector(".inspector"),
  workspaceMeta: document.querySelector("#workspaceMeta"),
  searchInput: document.querySelector("#searchInput"),
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
  markdownExport: document.querySelector("#markdownExport"),
  payloadExport: document.querySelector("#payloadExport"),
  todayExport: document.querySelector("#todayExport"),
  copyMarkdownBtn: document.querySelector("#copyMarkdownBtn"),
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
let lastActivity = null;
let lastImportReceipt = null;
const revealedReviewCards = new Set();

applyUrlCapture();
render();
registerServiceWorker();

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
      return;
    }
    if (isMobileInboxPatchLike(imported)) {
      throw new Error("Unsupported mobile inbox patch schema.");
    }
    if (isMirrorBundle(imported) && hasUserWorkspace(workspace) && !confirmBundleImport(imported)) {
      showToast("Import canceled");
      return;
    }
    workspace = workspaceFromPortableData(imported);
    persistAndRender("Workspace imported");
  } catch (error) {
    showToast(error.message || "Import failed");
  } finally {
    event.target.value = "";
  }
});

dom.searchInput.addEventListener("input", renderSessions);

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
  const href = safeHref(session.sourceUrl);
  if (href !== "#") window.open(href, "_blank", "noopener,noreferrer");
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

dom.copyMarkdownBtn.addEventListener("click", () => copyText(dom.markdownExport.value, "Markdown copied"));
dom.copyPayloadBtn.addEventListener("click", () => copyText(dom.payloadExport.value, "JSON copied"));
dom.copyTodayBtn.addEventListener("click", () => copyText(dom.todayExport.value, "Today study pack copied"));
dom.copyMirrorBtn.addEventListener("click", () => copyText(dom.mirrorExport.value, "Mirror bundle copied"));
dom.copyBookmarkletBtn.addEventListener("click", () => copyText(dom.bookmarkletExport.value, "Capture bookmarklet copied"));
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
      sidecarLayout: Boolean(parsed.sidecarLayout)
    };
  } catch {
    return defaultUiPrefs();
  }
}

function saveUiPrefs() {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify({
      schemaVersion: UI_PREFS_SCHEMA_VERSION,
      sidecarLayout: Boolean(uiPrefs.sidecarLayout)
    }));
  } catch {
    // Layout preference is non-critical; workspace persistence handles its own warning path.
  }
}

function defaultUiPrefs() {
  return {
    schemaVersion: UI_PREFS_SCHEMA_VERSION,
    sidecarLayout: false
  };
}

function applyUrlCapture() {
  const params = new URLSearchParams(window.location.search);
  const quote = params.get("quote");
  const thought = params.get("thought");
  const sourceUrl = params.get("sourceUrl") || params.get("url");
  const sourceTitle = params.get("sourceTitle") || params.get("title");
  const timestamp = params.get("t") || params.get("time");
  const autoCapture = params.get("capture") === "1" || params.get("autoCapture") === "1";
  if (!quote && !thought && !sourceUrl && !sourceTitle) return;

  const session = getActiveSession(workspace);
  workspace = updateSession(workspace, session.id, {
    sourceUrl: sourceUrl || session.sourceUrl,
    sourceTitle: sourceTitle || session.sourceTitle
  });
  if (autoCapture && (quote || thought)) {
    workspace = addCapture(workspace, session.id, {
      quote: quote || "",
      thought: thought || "",
      timestamp: timestamp || "",
      tags: dom.sessionTags?.value || session.tags,
      sourceTitle: sourceTitle || "",
      sourceUrl: sourceUrl || "",
      sourceProvenance: "inbound"
    });
    const updated = getActiveSession(workspace);
    setActivity(updated, {
      title: "Browser capture saved",
      detail: summarizeCapture(updated.captures[0]),
      tab: "captures",
      targetId: updated.captures[0]?.id
    });
    showToast("Browser capture saved");
  } else {
    dom.quoteInput.value = quote || "";
    dom.thoughtInput.value = thought || "";
    dom.timestampInput.value = timestamp || "";
  }
  history.replaceState({}, "", window.location.pathname);
  persist();
}

function updateSessionFromFields() {
  const session = getActiveSession(workspace);
  workspace = updateSession(workspace, session.id, {
    title: dom.sessionTitle.value,
    sourceTitle: dom.sourceTitle.value,
    sourceUrl: dom.sourceUrl.value,
    materialType: dom.materialType.value,
    tags: dom.sessionTags.value
  });
  scheduleSave();
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
  const serialized = JSON.stringify(workspace);
  const bytes = new Blob([serialized]).size;
  storageWarning = null;
  try {
    localStorage.setItem(STORAGE_KEY, serialized);
    if (bytes > 3_500_000) {
      storageWarning = `Workspace is ${(bytes / 1024 / 1024).toFixed(1)} MB`;
    }
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
  renderFocusMode(session.focusMode);
  renderShellMode();
  renderActivity(session);
  renderFocusBrief();
  renderNotesMode();
  renderStorageNotice();
  renderImportReceipt();
  renderMetrics();
  renderSessions();
  renderInspector();
}

function toggleSidecarLayout() {
  const active = document.activeElement;
  const willHidePanels = !uiPrefs.sidecarLayout;
  uiPrefs = { ...uiPrefs, sidecarLayout: !uiPrefs.sidecarLayout };
  saveUiPrefs();
  renderShellMode();
  renderActivity(getActiveSession(workspace));
  if (willHidePanels && isInSidePanel(active)) {
    dom.sidecarLayoutBtn.focus();
  }
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
      : "Current")
  );
  clearChildren(dom.focusBriefSignals);
  if (brief.warnings.length) {
    brief.warnings.forEach((warning) => {
      const signal = textEl("span", "focus-signal warn", warning.label);
      signal.title = warning.detail;
      dom.focusBriefSignals.append(signal);
    });
  } else {
    dom.focusBriefSignals.append(textEl("span", "focus-signal", "Ready"));
  }
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

function runFocusBriefAction() {
  const session = getActiveSession(workspace);
  const brief = buildFocusBrief(session, workspace);
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
  if (!receipt) return;
  dom.importReceiptTitle.textContent = "Mobile inbox imported";
  dom.importReceiptDetail.textContent = formatInboxReceipt(receipt);
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
  return `${receipt.added} added, ${receipt.skippedDuplicate} skipped${sanitized} · ${resolution} · ${receipt.targetSessionTitle}`;
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
  const pack = buildTodayPack(workspace, new Date(), { dueLimit: 5, recentLimit: 5 });
  const { stats } = pack;
  clearChildren(dom.todaySummary);
  clearChildren(dom.todayList);
  dom.todaySummary.append(
    todayStat(String(stats.due), "due"),
    todayStat(String(stats.captures), "captures"),
    todayStat(String(stats.cards), "cards")
  );

  dom.todayList.append(textEl("div", "today-section-title", "Due Review"));
  if (!pack.dueItems.length) {
    dom.todayList.append(emptyState("No cards due right now"));
  } else {
    pack.dueItems.forEach((item) => {
      const card = document.createElement("article");
      card.className = "item-card due-card";
      card.append(
        textEl("div", "item-meta", `${item.sessionTitle} · strength ${item.card.strength}`),
        textEl("p", "card-prompt", item.card.prompt)
      );
      const footer = document.createElement("div");
      footer.className = "item-footer";
      const review = textEl("button", "mini-button primary", "Review");
      review.type = "button";
      review.addEventListener("click", () => startReviewAtItem(item));
      footer.append(review);
      card.append(footer);
      dom.todayList.append(card);
    });
    if (pack.dueOverflow) dom.todayList.append(emptyState(`+${pack.dueOverflow} more due cards in workspace.json`));
  }

  dom.todayList.append(textEl("div", "today-section-title", "Recent Captures"));
  if (!pack.recentCaptures.length) {
    dom.todayList.append(emptyState("No captures yet"));
    return;
  }
  pack.recentCaptures.forEach(({ sessionId, sessionTitle, capture }) => {
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
    footer.append(textEl("span", "", capture.tags.map((tag) => `#${tag}`).join(" ")));
    const view = textEl("button", "mini-button", "View");
    view.type = "button";
    view.addEventListener("click", () => openCaptureFromToday(sessionId, capture));
    footer.append(view);
    item.append(footer);
    dom.todayList.append(item);
  });
  if (pack.recentOverflow) dom.todayList.append(emptyState(`+${pack.recentOverflow} more captures in workspace.json`));
}

function todayStat(value, label) {
  const node = document.createElement("div");
  node.className = "today-stat";
  node.append(textEl("strong", "", value), textEl("small", "", label));
  return node;
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
    footer.append(textEl("span", "", capture.tags.map((tag) => `#${tag}`).join(" ")));
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
    noteButton.addEventListener("click", () => {
      const updatedNotes = upsertCaptureNoteBlock(getActiveSession(workspace).notesMarkdown, capture);
      workspace = updateSession(workspace, session.id, { notesMarkdown: updatedNotes });
      notesMode = "preview";
      setActivity(getActiveSession(workspace), {
        title: "Capture added to notes",
        detail: summarizeCapture(capture),
        tab: "captures",
        targetId: capture.id
      });
      persistAndRender("Capture added to notes");
    });
    actions.append(noteButton);
    const promoteButton = document.createElement("button");
    promoteButton.className = "mini-button";
    promoteButton.type = "button";
    promoteButton.disabled = capture.promotedToReview;
    promoteButton.textContent = capture.promotedToReview ? "Card" : "Make card";
    promoteButton.addEventListener("click", () => {
      workspace = promoteCapture(workspace, session.id, capture.id);
      setActivity(getActiveSession(workspace), {
        title: "Review card created",
        detail: summarizeCapture(capture),
        tab: "review",
        targetId: getActiveSession(workspace).reviewCards[0]?.id
      });
      persistAndRender("Review card created");
    });
    actions.append(promoteButton);
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
  dom.markdownExport.value = generateMarkdown(session);
  dom.payloadExport.value = JSON.stringify(buildFeishuPayload(session), null, 2);
  dom.todayExport.value = generateTodayMarkdown(workspace);
  dom.mirrorExport.value = JSON.stringify(buildMirrorBundle(workspace), null, 2);
  dom.bookmarkletExport.value = buildBookmarklet();
}

function exportWorkspace() {
  downloadText("learning-companion-workspace.json", JSON.stringify(workspace, null, 2), "application/json");
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

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
