import {
  WORKSPACE_SCHEMA,
  addCapture,
  addSession,
  buildFeishuPayload,
  filterSessions,
  generateMarkdown,
  getDueReviewCards,
  getActiveSession,
  gradeCard,
  promoteCapture,
  safeHref,
  sanitizeWorkspace,
  selectSession,
  updateSession
} from "./model.js";
import { renderMarkdown } from "./markdown.js";

const STORAGE_KEY = "learning-companion.workspace.v1";

const dom = {
  workspaceMeta: document.querySelector("#workspaceMeta"),
  searchInput: document.querySelector("#searchInput"),
  newSessionBtn: document.querySelector("#newSessionBtn"),
  exportWorkspaceBtn: document.querySelector("#exportWorkspaceBtn"),
  importWorkspaceInput: document.querySelector("#importWorkspaceInput"),
  storageNotice: document.querySelector("#storageNotice"),
  storageNoticeText: document.querySelector("#storageNoticeText"),
  storageExportNowBtn: document.querySelector("#storageExportNowBtn"),
  sessionList: document.querySelector("#sessionList"),
  sessionTitle: document.querySelector("#sessionTitle"),
  sourceTitle: document.querySelector("#sourceTitle"),
  sourceUrl: document.querySelector("#sourceUrl"),
  openSourceBtn: document.querySelector("#openSourceBtn"),
  materialType: document.querySelector("#materialType"),
  timestampInput: document.querySelector("#timestampInput"),
  sessionTags: document.querySelector("#sessionTags"),
  captureMetric: document.querySelector("#captureMetric"),
  cardMetric: document.querySelector("#cardMetric"),
  dueMetric: document.querySelector("#dueMetric"),
  sizeMetric: document.querySelector("#sizeMetric"),
  quoteInput: document.querySelector("#quoteInput"),
  thoughtInput: document.querySelector("#thoughtInput"),
  captureBtn: document.querySelector("#captureBtn"),
  captureCardBtn: document.querySelector("#captureCardBtn"),
  captureClozeBtn: document.querySelector("#captureClozeBtn"),
  notesEditor: document.querySelector("#notesEditor"),
  notesPreview: document.querySelector("#notesPreview"),
  notesEditBtn: document.querySelector("#notesEditBtn"),
  notesPreviewBtn: document.querySelector("#notesPreviewBtn"),
  saveState: document.querySelector("#saveState"),
  captureList: document.querySelector("#captureList"),
  reviewNextBtn: document.querySelector("#reviewNextBtn"),
  dueCount: document.querySelector("#dueCount"),
  reviewList: document.querySelector("#reviewList"),
  markdownExport: document.querySelector("#markdownExport"),
  payloadExport: document.querySelector("#payloadExport"),
  copyMarkdownBtn: document.querySelector("#copyMarkdownBtn"),
  downloadMarkdownBtn: document.querySelector("#downloadMarkdownBtn"),
  copyPayloadBtn: document.querySelector("#copyPayloadBtn"),
  downloadPayloadBtn: document.querySelector("#downloadPayloadBtn"),
  toast: document.querySelector("#toast")
};

let workspace = loadWorkspace();
let activeTab = "captures";
let notesMode = "edit";
let saveTimer = null;
let storageWarning = null;

applyUrlCapture();
render();

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

dom.importWorkspaceInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    workspace = sanitizeWorkspace(imported);
    persistAndRender("Workspace imported");
  } catch {
    showToast("Import failed");
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

window.addEventListener("pagehide", persist);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") persist();
});

dom.captureBtn.addEventListener("click", () => capture(false));
dom.captureCardBtn.addEventListener("click", () => capture(true));
dom.captureClozeBtn.addEventListener("click", () => capture("cloze"));
dom.reviewNextBtn.addEventListener("click", () => {
  activeTab = "review";
  const session = getActiveSession(workspace);
  const [next] = getDueReviewCards(session);
  if (!next) {
    showToast("No due cards");
    return;
  }
  const card = document.querySelector(`[data-card-id="${CSS.escape(next.id)}"]`);
  card?.scrollIntoView({ behavior: "smooth", block: "center" });
  card?.classList.add("pulse");
  setTimeout(() => card?.classList.remove("pulse"), 900);
});

document.addEventListener("keydown", (event) => {
  const isMod = event.metaKey || event.ctrlKey;
  if (isMod && event.key === "Enter") {
    event.preventDefault();
    capture(event.shiftKey);
  }
  if (isMod && event.key.toLowerCase() === "s") {
    event.preventDefault();
    persistAndRender("Saved");
  }
});

document.querySelectorAll("[data-focus-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    const session = getActiveSession(workspace);
    workspace = updateSession(workspace, session.id, { focusMode: button.dataset.focusMode });
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
dom.downloadMarkdownBtn.addEventListener("click", () => {
  const session = getActiveSession(workspace);
  downloadText(`${slugify(session.title)}.md`, generateMarkdown(session), "text/markdown");
});
dom.downloadPayloadBtn.addEventListener("click", () => {
  const session = getActiveSession(workspace);
  downloadText(`${slugify(session.title)}.feishu.json`, JSON.stringify(buildFeishuPayload(session), null, 2), "application/json");
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
      tags: dom.sessionTags?.value || session.tags
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
  renderSessions();
  renderInspector();
}

function capture(promoteToReview) {
  const session = getActiveSession(workspace);
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
  renderNotesMode();
  renderStorageNotice();
  renderMetrics();
  renderSessions();
  renderInspector();
}

function renderStorageNotice() {
  if (!dom.storageNotice) return;
  const shouldShow = Boolean(storageWarning);
  dom.storageNotice.hidden = !shouldShow;
  dom.storageNoticeText.textContent = storageWarning || "";
}

function renderMetrics() {
  const session = getActiveSession(workspace);
  const due = getDueReviewCards(session).length;
  const bytes = new Blob([JSON.stringify(workspace)]).size;
  dom.captureMetric.textContent = String(session.captures.length);
  dom.cardMetric.textContent = String(session.reviewCards.length);
  dom.dueMetric.textContent = String(due);
  dom.sizeMetric.textContent = formatBytes(bytes);
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
  document.querySelectorAll("[data-focus-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.focusMode === mode);
  });
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
  renderCaptures();
  renderReviewCards();
  renderExport();
  renderMetrics();
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
    item.append(textEl("div", "item-meta", `${capture.timestamp || "No time"} · ${new Date(capture.createdAt).toLocaleString()}`));
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
    const promoteButton = document.createElement("button");
    promoteButton.className = "mini-button";
    promoteButton.type = "button";
    promoteButton.disabled = capture.promotedToReview;
    promoteButton.textContent = capture.promotedToReview ? "Card" : "Make card";
    promoteButton.addEventListener("click", () => {
      workspace = promoteCapture(workspace, session.id, capture.id);
      persistAndRender("Review card created");
    });
    footer.append(promoteButton);
    item.append(footer);
    dom.captureList.append(item);
  });
}

function renderReviewCards() {
  const session = getActiveSession(workspace);
  const dueCards = getDueReviewCards(session);
  dom.dueCount.textContent = `${dueCards.length} due`;
  clearChildren(dom.reviewList);
  if (!session.reviewCards.length) {
    dom.reviewList.append(emptyState("No review cards yet"));
    return;
  }
  const orderedCards = [...session.reviewCards].sort((a, b) => {
    const aDue = dueCards.some((due) => due.id === a.id) ? 0 : 1;
    const bDue = dueCards.some((due) => due.id === b.id) ? 0 : 1;
    if (aDue !== bDue) return aDue - bDue;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
  orderedCards.forEach((card) => {
    const isDue = dueCards.some((due) => due.id === card.id);
    const item = document.createElement("article");
    item.className = `item-card review-card${isDue ? " due-card" : ""}`;
    item.dataset.cardId = card.id;
    item.append(
      textEl("div", "item-meta", `${isDue ? "Due now" : `Due ${new Date(card.dueAt).toLocaleDateString()}`} · strength ${card.strength}`),
      textEl("p", "card-prompt", card.prompt)
    );

    const details = document.createElement("details");
    const answer = document.createElement("div");
    answer.className = "review-answer markdown-lite";
    renderMarkdown(answer, card.answer);
    details.append(textEl("summary", "", "Answer"), answer);
    item.append(details);

    const footer = document.createElement("div");
    footer.className = "item-footer";
    const again = textEl("button", "mini-button", "Again");
    again.type = "button";
    again.dataset.grade = "again";
    const good = textEl("button", "mini-button", "Good");
    good.type = "button";
    good.dataset.grade = "good";
    footer.append(again, good);
    item.append(footer);

    footer.querySelectorAll("[data-grade]").forEach((button) => {
      button.addEventListener("click", () => {
        workspace = gradeCard(workspace, session.id, card.id, button.dataset.grade);
        persistAndRender("Review updated");
      });
    });
    dom.reviewList.append(item);
  });
}

function renderExport() {
  const session = getActiveSession(workspace);
  dom.markdownExport.value = generateMarkdown(session);
  dom.payloadExport.value = JSON.stringify(buildFeishuPayload(session), null, 2);
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
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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
