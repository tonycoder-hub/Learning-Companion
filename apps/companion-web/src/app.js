import {
  WORKSPACE_SCHEMA,
  addCapture,
  addSession,
  buildFeishuPayload,
  filterSessions,
  generateMarkdown,
  getActiveSession,
  gradeCard,
  promoteCapture,
  sanitizeWorkspace,
  selectSession,
  updateSession
} from "./model.js";

const STORAGE_KEY = "learning-companion.workspace.v1";

const dom = {
  workspaceMeta: document.querySelector("#workspaceMeta"),
  searchInput: document.querySelector("#searchInput"),
  newSessionBtn: document.querySelector("#newSessionBtn"),
  exportWorkspaceBtn: document.querySelector("#exportWorkspaceBtn"),
  importWorkspaceInput: document.querySelector("#importWorkspaceInput"),
  sessionList: document.querySelector("#sessionList"),
  sessionTitle: document.querySelector("#sessionTitle"),
  sourceTitle: document.querySelector("#sourceTitle"),
  sourceUrl: document.querySelector("#sourceUrl"),
  openSourceBtn: document.querySelector("#openSourceBtn"),
  materialType: document.querySelector("#materialType"),
  timestampInput: document.querySelector("#timestampInput"),
  sessionTags: document.querySelector("#sessionTags"),
  quoteInput: document.querySelector("#quoteInput"),
  thoughtInput: document.querySelector("#thoughtInput"),
  captureBtn: document.querySelector("#captureBtn"),
  captureCardBtn: document.querySelector("#captureCardBtn"),
  notesEditor: document.querySelector("#notesEditor"),
  saveState: document.querySelector("#saveState"),
  captureList: document.querySelector("#captureList"),
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
let saveTimer = null;

applyUrlCapture();
render();

dom.newSessionBtn.addEventListener("click", () => {
  workspace = addSession(workspace, "New learning session");
  persistAndRender("Session created");
  dom.sessionTitle.focus();
  dom.sessionTitle.select();
});

dom.exportWorkspaceBtn.addEventListener("click", () => {
  downloadText("learning-companion-workspace.json", JSON.stringify(workspace, null, 2), "application/json");
});

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
});

dom.openSourceBtn.addEventListener("click", () => {
  const session = getActiveSession(workspace);
  if (session.sourceUrl) window.open(session.sourceUrl, "_blank", "noopener,noreferrer");
});

dom.captureBtn.addEventListener("click", () => capture(false));
dom.captureCardBtn.addEventListener("click", () => capture(true));

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
  if (!quote && !thought && !sourceUrl && !sourceTitle) return;

  const session = getActiveSession(workspace);
  workspace = updateSession(workspace, session.id, {
    sourceUrl: sourceUrl || session.sourceUrl,
    sourceTitle: sourceTitle || session.sourceTitle
  });
  dom.quoteInput.value = quote || "";
  dom.thoughtInput.value = thought || "";
  dom.timestampInput.value = timestamp || "";
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
  workspace = addCapture(workspace, session.id, {
    quote: dom.quoteInput.value,
    thought: dom.thoughtInput.value,
    timestamp: dom.timestampInput.value,
    tags: dom.sessionTags.value
  }, { promoteToReview });
  dom.quoteInput.value = "";
  dom.thoughtInput.value = "";
  persistAndRender(promoteToReview ? "Capture + card saved" : "Capture saved");
  dom.quoteInput.focus();
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
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
  renderSessions();
  renderInspector();
}

function renderFocusMode(mode) {
  document.querySelectorAll("[data-focus-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.focusMode === mode);
  });
}

function renderSessions() {
  const visible = filterSessions(workspace, dom.searchInput.value);
  const active = getActiveSession(workspace);
  dom.sessionList.innerHTML = "";
  visible.forEach((session) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `session-row${session.id === active.id ? " active" : ""}`;
    button.innerHTML = `
      <span class="session-title">${escapeHtml(session.title)}</span>
      <span class="session-subtitle">${escapeHtml(session.sourceTitle || session.materialType)} · ${session.captures.length} captures</span>
    `;
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
}

function renderCaptures() {
  const session = getActiveSession(workspace);
  dom.captureList.innerHTML = "";
  if (!session.captures.length) {
    dom.captureList.innerHTML = `<div class="empty-state">No captures yet</div>`;
    return;
  }
  session.captures.forEach((capture) => {
    const item = document.createElement("article");
    item.className = "item-card";
    item.innerHTML = `
      <div class="item-meta">${escapeHtml(capture.timestamp || "No time")} · ${new Date(capture.createdAt).toLocaleString()}</div>
      ${capture.quote ? `<blockquote>${escapeHtml(capture.quote)}</blockquote>` : ""}
      ${capture.thought ? `<p>${escapeHtml(capture.thought)}</p>` : ""}
      <div class="item-footer">
        <span>${capture.tags.map((tag) => `#${escapeHtml(tag)}`).join(" ")}</span>
        <button class="mini-button" type="button" ${capture.promotedToReview ? "disabled" : ""}>${capture.promotedToReview ? "Card" : "Make card"}</button>
      </div>
    `;
    item.querySelector("button").addEventListener("click", () => {
      workspace = promoteCapture(workspace, session.id, capture.id);
      persistAndRender("Review card created");
    });
    dom.captureList.append(item);
  });
}

function renderReviewCards() {
  const session = getActiveSession(workspace);
  dom.reviewList.innerHTML = "";
  if (!session.reviewCards.length) {
    dom.reviewList.innerHTML = `<div class="empty-state">No review cards yet</div>`;
    return;
  }
  session.reviewCards.forEach((card) => {
    const item = document.createElement("article");
    item.className = "item-card review-card";
    item.innerHTML = `
      <div class="item-meta">Due ${new Date(card.dueAt).toLocaleDateString()} · strength ${card.strength}</div>
      <p class="card-prompt">${escapeHtml(card.prompt)}</p>
      <details>
        <summary>Answer</summary>
        <p>${escapeHtml(card.answer)}</p>
      </details>
      <div class="item-footer">
        <button class="mini-button" type="button" data-grade="-1">Again</button>
        <button class="mini-button" type="button" data-grade="1">Good</button>
      </div>
    `;
    item.querySelectorAll("[data-grade]").forEach((button) => {
      button.addEventListener("click", () => {
        workspace = gradeCard(workspace, session.id, card.id, Number(button.dataset.grade));
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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
