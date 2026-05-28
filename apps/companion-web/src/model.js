export const WORKSPACE_SCHEMA = "learning-companion.workspace.v1";
export const WORKSPACE_SCHEMA_VERSION = 1;
export const MAX_TITLE_LENGTH = 160;
export const MAX_URL_LENGTH = 2048;
export const MAX_NOTE_LENGTH = 120000;
export const MAX_CAPTURE_TEXT_LENGTH = 12000;
export const MAX_MIRROR_FILE_BYTES = 1_000_000;
export const MAX_MIRROR_BUNDLE_BYTES = 25_000_000;
export const MAX_MIRROR_CANONICAL_BYTES = 5_000_000;

const MATERIAL_TYPES = new Set(["article", "video", "doc", "course", "book", "other"]);
const FOCUS_MODES = new Set(["capture", "synthesize", "review"]);
const SAFE_URL_SCHEMES = new Set(["http:", "https:"]);

export function nowIso() {
  return new Date().toISOString();
}

export function formatLocalIso(value = new Date()) {
  const date = Number.isFinite(value?.getTime?.()) ? value : new Date(value);
  const pad = (number, width = 2) => String(Math.trunc(Math.abs(number))).padStart(width, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
    `${sign}${pad(offset / 60)}:${pad(offset % 60)}`
  ].join("");
}

export function makeId(prefix = "id") {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map(String).flatMap((item) => normalizeTags(item));
  }
  return String(value || "")
    .split(/[,\s#]+/)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .filter((tag, index, all) => all.indexOf(tag) === index);
}

export function cleanText(value, maxLength = MAX_CAPTURE_TEXT_LENGTH) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function cleanUrl(value) {
  const raw = cleanText(value, MAX_URL_LENGTH);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return SAFE_URL_SCHEMES.has(url.protocol) ? url.href.slice(0, MAX_URL_LENGTH) : "";
  } catch {
    return "";
  }
}

export function safeHref(value) {
  return cleanUrl(value) || "#";
}

export function timestampToSeconds(value) {
  const raw = cleanText(value, 32);
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  const parts = raw.split(":").map((part) => part.trim());
  if (!parts.length || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) return null;
  return parts.reduce((sum, part) => (sum * 60) + Number(part), 0);
}

export function buildSourceJumpUrl(sourceUrl, timestamp = "") {
  const href = cleanUrl(sourceUrl);
  if (!href) return "";
  const seconds = timestampToSeconds(timestamp);
  if (seconds === null) return href;
  try {
    const url = new URL(href);
    if (isYouTubeHost(url.hostname)) {
      url.searchParams.delete("start");
      url.searchParams.set("t", `${seconds}s`);
      return url.href;
    }
    return href;
  } catch {
    return href;
  }
}

function isYouTubeHost(hostname) {
  return /(^|\.)youtube\.com$/i.test(hostname) || /^youtu\.be$/i.test(hostname);
}

function normalizeSourceProvenance(value) {
  const normalized = cleanText(value, 32);
  return ["snapshot", "inbound", "inherited", "unknown"].includes(normalized) ? normalized : "";
}

export function normalizeCapture(capture = {}, originClientId = makeId("client"), sourceFallback = {}) {
  const timestamp = nowIso();
  const materialType = capture.materialType || sourceFallback.materialType;
  const hasCaptureSource = Boolean(capture.sourceTitle || capture.sourceUrl || capture.materialType);
  const hasInheritedSource = Boolean(sourceFallback.sourceTitle || sourceFallback.sourceUrl || sourceFallback.materialType);
  return {
    id: capture.id || makeId("capture"),
    quote: cleanText(capture.quote, MAX_CAPTURE_TEXT_LENGTH),
    thought: cleanText(capture.thought, MAX_CAPTURE_TEXT_LENGTH),
    timestamp: cleanText(capture.timestamp, 32),
    sourceTitle: cleanText(capture.sourceTitle || sourceFallback.sourceTitle, MAX_TITLE_LENGTH),
    sourceUrl: cleanUrl(capture.sourceUrl || sourceFallback.sourceUrl),
    materialType: MATERIAL_TYPES.has(materialType) ? materialType : "other",
    sourceProvenance: normalizeSourceProvenance(capture.sourceProvenance)
      || (hasCaptureSource ? "snapshot" : hasInheritedSource ? "inherited" : "unknown"),
    tags: normalizeTags(capture.tags || []),
    createdAt: capture.createdAt || timestamp,
    capturedAt: capture.capturedAt || capture.createdAt || timestamp,
    updatedAt: capture.updatedAt || capture.createdAt || timestamp,
    originClientId: capture.originClientId || originClientId,
    promotedToReview: Boolean(capture.promotedToReview)
  };
}

export function normalizeReviewCard(card = {}, originClientId = makeId("client")) {
  const timestamp = nowIso();
  return {
    id: card.id || makeId("card"),
    prompt: cleanText(card.prompt, MAX_CAPTURE_TEXT_LENGTH),
    answer: cleanText(card.answer, MAX_CAPTURE_TEXT_LENGTH),
    sourceCaptureId: cleanText(card.sourceCaptureId, 128),
    dueAt: card.dueAt || timestamp,
    strength: Math.max(0, Math.min(5, Number(card.strength) || 0)),
    createdAt: card.createdAt || timestamp,
    updatedAt: card.updatedAt || card.createdAt || timestamp,
    lastReviewedAt: card.lastReviewedAt || null,
    originClientId: card.originClientId || originClientId
  };
}

export function createSession(overrides = {}, originClientId = overrides.originClientId || makeId("client")) {
  const timestamp = nowIso();
  const sourceTitle = cleanText(overrides.sourceTitle || "", MAX_TITLE_LENGTH);
  const sourceUrl = cleanUrl(overrides.sourceUrl || "");
  const materialType = MATERIAL_TYPES.has(overrides.materialType) ? overrides.materialType : "article";
  return {
    id: overrides.id || makeId("session"),
    originClientId,
    title: cleanText(overrides.title || "Untitled learning session", MAX_TITLE_LENGTH),
    sourceTitle,
    sourceUrl,
    materialType,
    tags: normalizeTags(overrides.tags || []),
    focusMode: FOCUS_MODES.has(overrides.focusMode) ? overrides.focusMode : "capture",
    notesMarkdown: cleanText(overrides.notesMarkdown || "", MAX_NOTE_LENGTH),
    captures: Array.isArray(overrides.captures)
      ? overrides.captures.map((capture) => normalizeCapture(capture, originClientId, {
        sourceTitle,
        sourceUrl,
        materialType
      }))
      : [],
    reviewCards: Array.isArray(overrides.reviewCards)
      ? overrides.reviewCards.map((card) => normalizeReviewCard(card, originClientId))
      : [],
    createdAt: overrides.createdAt || timestamp,
    updatedAt: overrides.updatedAt || timestamp
  };
}

export function createDefaultWorkspace() {
  const clientId = makeId("client");
  const session = createSession({
    title: "Learning Companion MVP",
    sourceTitle: "Product design desk",
    sourceUrl: "https://github.com/tonycoder-hub/Learning-Companion",
    materialType: "doc",
    tags: ["mvp", "learning"],
    notesMarkdown: [
      "# Learning Companion MVP",
      "",
      "- Capture the source context before writing analysis.",
      "- Keep excerpts, notes, and review cards connected.",
      "- Export readable Markdown plus a structured JSON payload."
    ].join("\n")
  }, clientId);
  return {
    schema: WORKSPACE_SCHEMA,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    version: WORKSPACE_SCHEMA_VERSION,
    clientId,
    activeSessionId: session.id,
    sessions: [session],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

export function sanitizeWorkspace(input) {
  const workspace = input && typeof input === "object" ? input : createDefaultWorkspace();
  if (workspace.schema && workspace.schema !== WORKSPACE_SCHEMA) {
    throw new Error("Unsupported workspace schema.");
  }
  const major = Number(workspace.schemaVersion || workspace.version || WORKSPACE_SCHEMA_VERSION);
  if (major > WORKSPACE_SCHEMA_VERSION) {
    throw new Error("Unsupported workspace version.");
  }
  const clientId = cleanText(workspace.clientId, 128) || makeId("client");
  const sessions = Array.isArray(workspace.sessions) && workspace.sessions.length
    ? workspace.sessions.map((session) => createSession(session, session.originClientId || clientId))
    : [createSession({}, clientId)];
  const activeSessionId = sessions.some((session) => session.id === workspace.activeSessionId)
    ? workspace.activeSessionId
    : sessions[0].id;

  return {
    schema: WORKSPACE_SCHEMA,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    version: WORKSPACE_SCHEMA_VERSION,
    clientId,
    activeSessionId,
    sessions,
    createdAt: workspace.createdAt || nowIso(),
    updatedAt: workspace.updatedAt || nowIso()
  };
}

export function workspaceFromPortableData(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Unsupported import file.");
  }
  if (isMirrorBundle(input)) {
    return workspaceFromMirrorBundle(input);
  }
  return sanitizeWorkspace(input);
}

export function isMirrorBundle(input) {
  return Boolean(input && typeof input === "object" && input.schema === "learning-companion.mirror-bundle.staging.v1");
}

export function workspaceFromMirrorBundle(bundle) {
  if (bundle.schema !== "learning-companion.mirror-bundle.staging.v1") {
    throw new Error("Unsupported mirror bundle.");
  }
  if (bundle.contractStability && bundle.contractStability !== "experimental") {
    throw new Error("Unsupported mirror bundle stability.");
  }
  if (bundle.canonical !== "workspace.json") {
    throw new Error("Mirror bundle canonical payload is missing.");
  }
  if (!Array.isArray(bundle.files)) {
    throw new Error("Mirror bundle file list is missing.");
  }
  const declaredBytes = Number(bundle.manifest?.totalBytes || 0);
  const contentBytes = bundle.files.reduce((sum, file) => sum + byteLength(file?.content || ""), 0);
  if (declaredBytes > MAX_MIRROR_BUNDLE_BYTES || contentBytes > MAX_MIRROR_BUNDLE_BYTES) {
    throw new Error("Mirror bundle is too large to import.");
  }
  const restoreFiles = bundle.files.filter((item) => item?.role === "workspace-restore");
  if (restoreFiles.length !== 1) {
    throw new Error("Mirror bundle must contain exactly one restore payload.");
  }
  const [file] = restoreFiles;
  if (file.path !== "workspace.json") {
    throw new Error("Mirror bundle restore payload path is invalid.");
  }
  if (!file || file.encoding !== "utf-8" || typeof file.content !== "string") {
    throw new Error("Mirror bundle has no workspace restore payload.");
  }
  if (!file.content.trim()) {
    throw new Error("Mirror bundle restore payload is empty.");
  }
  if (byteLength(file.content) > MAX_MIRROR_CANONICAL_BYTES) {
    throw new Error("Mirror bundle restore payload is too large.");
  }
  try {
    return sanitizeWorkspace(JSON.parse(file.content));
  } catch (error) {
    throw new Error(error instanceof SyntaxError
      ? "Mirror bundle restore payload is not valid JSON."
      : error.message || "Mirror bundle restore payload is invalid.");
  }
}

export function getActiveSession(workspace) {
  return workspace.sessions.find((session) => session.id === workspace.activeSessionId) || workspace.sessions[0];
}

export function updateSession(workspace, sessionId, patch) {
  const updatedAt = nowIso();
  return {
    ...workspace,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    updatedAt,
    sessions: workspace.sessions.map((session) => {
      if (session.id !== sessionId) return session;
      const next = { ...session, ...patch, updatedAt };
      next.tags = normalizeTags(next.tags);
      next.title = cleanText(next.title, MAX_TITLE_LENGTH) || "Untitled learning session";
      next.sourceTitle = cleanText(next.sourceTitle, MAX_TITLE_LENGTH);
      next.sourceUrl = cleanUrl(next.sourceUrl);
      next.notesMarkdown = cleanText(next.notesMarkdown, MAX_NOTE_LENGTH);
      next.materialType = MATERIAL_TYPES.has(next.materialType) ? next.materialType : "other";
      next.focusMode = FOCUS_MODES.has(next.focusMode) ? next.focusMode : "capture";
      return next;
    })
  };
}

export function addSession(workspace, title = "New learning session") {
  const session = createSession({ title }, workspace.clientId);
  return {
    ...workspace,
    activeSessionId: session.id,
    updatedAt: nowIso(),
    sessions: [session, ...workspace.sessions]
  };
}

export function selectSession(workspace, sessionId) {
  if (!workspace.sessions.some((session) => session.id === sessionId)) return workspace;
  return { ...workspace, activeSessionId: sessionId };
}

export function addCapture(workspace, sessionId, captureInput, options = {}) {
  const quote = cleanText(captureInput.quote, MAX_CAPTURE_TEXT_LENGTH);
  const thought = cleanText(captureInput.thought, MAX_CAPTURE_TEXT_LENGTH);
  if (!quote && !thought) return workspace;

  const timestamp = nowIso();
  const sourceSession = workspace.sessions.find((session) => session.id === sessionId);
  const materialType = captureInput.materialType || sourceSession?.materialType;
  const capture = {
    id: makeId("capture"),
    quote,
    thought,
    timestamp: cleanText(captureInput.timestamp, 32),
    sourceTitle: cleanText(captureInput.sourceTitle || sourceSession?.sourceTitle, MAX_TITLE_LENGTH),
    sourceUrl: cleanUrl(captureInput.sourceUrl || sourceSession?.sourceUrl),
    materialType: MATERIAL_TYPES.has(materialType) ? materialType : "other",
    sourceProvenance: normalizeSourceProvenance(captureInput.sourceProvenance) || "snapshot",
    tags: normalizeTags(captureInput.tags || []),
    createdAt: timestamp,
    capturedAt: timestamp,
    updatedAt: timestamp,
    originClientId: workspace.clientId,
    promotedToReview: Boolean(options.promoteToReview)
  };

  let createdCard = null;
  if (options.promoteToReview) {
    createdCard = createReviewCardFromCapture(capture, workspace.clientId, {
      prompt: options.reviewPrompt,
      answer: options.reviewAnswer
    });
  }

  return {
    ...workspace,
    updatedAt: nowIso(),
    sessions: workspace.sessions.map((session) => {
      if (session.id !== sessionId) return session;
      return {
        ...session,
        captures: [capture, ...session.captures],
        reviewCards: createdCard ? [createdCard, ...session.reviewCards] : session.reviewCards,
        updatedAt: nowIso()
      };
    })
  };
}

export function createReviewCardFromCapture(capture, originClientId = capture.originClientId, overrides = {}) {
  const prompt = cleanText(overrides.prompt, MAX_CAPTURE_TEXT_LENGTH) || (capture.thought
    ? `Recall the point behind: ${capture.thought}`
    : `Explain this excerpt: ${capture.quote.slice(0, 160)}`);
  const answer = [cleanText(overrides.answer, MAX_CAPTURE_TEXT_LENGTH) || capture.quote, capture.timestamp ? `Time: ${capture.timestamp}` : ""]
    .filter(Boolean)
    .join("\n\n");
  const timestamp = nowIso();
  return {
    id: makeId("card"),
    prompt,
    answer,
    sourceCaptureId: capture.id,
    dueAt: timestamp,
    strength: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    originClientId: originClientId || makeId("client")
  };
}

export function promoteCapture(workspace, sessionId, captureId) {
  return {
    ...workspace,
    updatedAt: nowIso(),
    sessions: workspace.sessions.map((session) => {
      if (session.id !== sessionId) return session;
      const capture = session.captures.find((item) => item.id === captureId);
      if (!capture || capture.promotedToReview) return session;
      return {
        ...session,
        captures: session.captures.map((item) => item.id === captureId
          ? { ...item, promotedToReview: true, updatedAt: nowIso() }
          : item),
        reviewCards: [createReviewCardFromCapture(capture, workspace.clientId), ...session.reviewCards],
        updatedAt: nowIso()
      };
    })
  };
}

export function deleteCapture(workspace, sessionId, captureId) {
  return {
    ...workspace,
    updatedAt: nowIso(),
    sessions: workspace.sessions.map((session) => {
      if (session.id !== sessionId) return session;
      return {
        ...session,
        captures: session.captures.filter((capture) => capture.id !== captureId),
        reviewCards: session.reviewCards.filter((card) => card.sourceCaptureId !== captureId),
        updatedAt: nowIso()
      };
    })
  };
}

export function deleteReviewCard(workspace, sessionId, cardId) {
  return {
    ...workspace,
    updatedAt: nowIso(),
    sessions: workspace.sessions.map((session) => {
      if (session.id !== sessionId) return session;
      return {
        ...session,
        reviewCards: session.reviewCards.filter((card) => card.id !== cardId),
        captures: session.captures.map((capture) => (
          session.reviewCards.some((card) => card.id === cardId && card.sourceCaptureId === capture.id)
            ? { ...capture, promotedToReview: false, updatedAt: nowIso() }
            : capture
        )),
        updatedAt: nowIso()
      };
    })
  };
}

export function gradeCard(workspace, sessionId, cardId, delta) {
  const grade = delta === "again" || delta === "good"
    ? delta
    : Number(delta) > 0 ? "good" : "again";
  return {
    ...workspace,
    updatedAt: nowIso(),
    sessions: workspace.sessions.map((session) => {
      if (session.id !== sessionId) return session;
      return {
        ...session,
        reviewCards: session.reviewCards.map((card) => {
          if (card.id !== cardId) return card;
          return applyGrade(card, grade);
        }),
        updatedAt: nowIso()
      };
    })
  };
}

export function applyGrade(card, grade, now = new Date()) {
  const delta = grade === "good" ? 1 : -1;
  const strength = Math.max(0, Math.min(5, Number(card.strength || 0) + delta));
  const days = reviewIntervalDays(strength);
  const dueAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  const reviewedAt = now.toISOString();
  return {
    ...card,
    strength,
    dueAt,
    lastReviewedAt: reviewedAt,
    updatedAt: reviewedAt
  };
}

export function reviewIntervalDays(strength) {
  const buckets = [0, 1, 3, 7, 14, 30];
  return buckets[Math.max(0, Math.min(5, strength))] ?? 1;
}

export function getDueReviewCards(session, now = new Date()) {
  const nowTime = now.getTime();
  return [...session.reviewCards]
    .filter((card) => new Date(card.dueAt).getTime() <= nowTime)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

export function getDueReviewItems(workspace, now = new Date()) {
  return workspace.sessions
    .flatMap((session) => getDueReviewCards(session, now).map((card) => ({
      sessionId: session.id,
      sessionTitle: session.title,
      card
    })))
    .sort((a, b) => {
      const byDue = new Date(a.card.dueAt).getTime() - new Date(b.card.dueAt).getTime();
      if (byDue !== 0) return byDue;
      return a.sessionTitle.localeCompare(b.sessionTitle);
    });
}

export function getRecentCaptureItems(workspace, limit = 6) {
  return workspace.sessions
    .flatMap((session) => session.captures.map((capture) => ({
      sessionId: session.id,
      sessionTitle: session.title,
      capture
    })))
    .sort((a, b) => {
      const byTime = new Date(b.capture.capturedAt || b.capture.createdAt).getTime()
        - new Date(a.capture.capturedAt || a.capture.createdAt).getTime();
      if (byTime !== 0) return byTime;
      const bySession = a.sessionTitle.localeCompare(b.sessionTitle);
      if (bySession !== 0) return bySession;
      return a.capture.id.localeCompare(b.capture.id);
    })
    .slice(0, Math.max(0, limit));
}

export function getStudyPackStats(workspace, now = new Date()) {
  return {
    sessions: workspace.sessions.length,
    captures: workspace.sessions.reduce((sum, session) => sum + session.captures.length, 0),
    cards: workspace.sessions.reduce((sum, session) => sum + session.reviewCards.length, 0),
    due: getDueReviewItems(workspace, now).length
  };
}

export function buildTodayPack(workspace, now = new Date(), limits = {}) {
  const cleanWorkspace = sanitizeWorkspace(workspace);
  const dueLimit = Math.max(1, Number(limits.dueLimit) || 20);
  const recentLimit = Math.max(1, Number(limits.recentLimit) || 8);
  const sessionPaths = new Map(cleanWorkspace.sessions.map((session) => [session.id, getMirrorSessionPaths(session)]));
  const dueAll = getDueReviewItems(cleanWorkspace, now).map((item) => ({
    ...item,
    sessionPath: sessionPaths.get(item.sessionId)?.markdownPath || ""
  })).sort((a, b) => {
    const nowTime = now.getTime();
    const byOverdue = (nowTime - new Date(b.card.dueAt).getTime()) - (nowTime - new Date(a.card.dueAt).getTime());
    if (byOverdue !== 0) return byOverdue;
    const byCreated = new Date(a.card.createdAt).getTime() - new Date(b.card.createdAt).getTime();
    if (byCreated !== 0) return byCreated;
    const bySession = a.sessionTitle.localeCompare(b.sessionTitle);
    if (bySession !== 0) return bySession;
    return a.card.id.localeCompare(b.card.id);
  });
  const recentAll = getRecentCaptureItems(cleanWorkspace, Number.MAX_SAFE_INTEGER).map((item) => ({
    ...item,
    sessionPath: sessionPaths.get(item.sessionId)?.markdownPath || ""
  }));
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return {
    generatedAt: formatLocalIso(now),
    reviewCutoff: formatLocalIso(now),
    localDayWindow: {
      start: formatLocalIso(dayStart),
      end: formatLocalIso(dayEnd)
    },
    recentDefinition: `latest ${recentLimit} captures by capturedAt`,
    dueDefinition: "review cards with dueAt <= generatedAt",
    stats: getStudyPackStats(cleanWorkspace, now),
    dueItems: dueAll.slice(0, dueLimit),
    dueOverflow: Math.max(0, dueAll.length - dueLimit),
    recentCaptures: recentAll.slice(0, recentLimit),
    recentOverflow: Math.max(0, recentAll.length - recentLimit)
  };
}

export function filterSessions(workspace, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (!needle) return workspace.sessions;
  return workspace.sessions.filter((session) => {
    const haystack = [
      session.title,
      session.sourceTitle,
      session.sourceUrl,
      session.notesMarkdown,
      session.tags.join(" "),
      ...session.captures.flatMap((capture) => [capture.quote, capture.thought, capture.tags.join(" ")])
    ].join(" ").toLowerCase();
    return haystack.includes(needle);
  });
}

export function generateMarkdown(session) {
  const lines = [
    `# ${session.title}`,
    "",
    `Source: ${session.sourceTitle || "Untitled"}`,
    session.sourceUrl ? `URL: ${session.sourceUrl}` : "",
    `Type: ${session.materialType}`,
    session.tags.length ? `Tags: ${session.tags.map((tag) => `#${tag}`).join(" ")}` : "",
    "",
    "## Notes",
    "",
    session.notesMarkdown || "_No notes yet._",
    "",
    "## Captures",
    ""
  ].filter((line) => line !== "");

  if (!session.captures.length) {
    lines.push("_No captures yet._");
  } else {
    session.captures.forEach((capture) => {
      lines.push(`### ${formatDate(capture.createdAt)}${capture.timestamp ? ` @ ${capture.timestamp}` : ""}`);
      const captureSource = formatCaptureSource(capture, session);
      if (captureSource) lines.push("", captureSource);
      if (capture.quote) lines.push("", `> ${capture.quote.replace(/\n/g, "\n> ")}`);
      if (capture.thought) lines.push("", capture.thought);
      if (capture.tags.length) lines.push("", capture.tags.map((tag) => `#${tag}`).join(" "));
      lines.push("");
    });
  }

  if (session.reviewCards.length) {
    lines.push("", "## Review Cards", "");
    session.reviewCards.forEach((card) => {
      lines.push(`- Q: ${card.prompt}`);
      lines.push(`  A: ${card.answer.replace(/\n/g, " ")}`);
    });
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function generateSynthesisDraft(session) {
  const title = cleanText(session.title || "Learning session", MAX_TITLE_LENGTH);
  const captures = Array.isArray(session.captures) ? session.captures : [];
  const reviewCards = Array.isArray(session.reviewCards) ? session.reviewCards : [];
  const stats = getSynthesisStats(session);
  const lines = [
    `## Synthesis - ${title}`,
    "",
    session.sourceTitle ? `Source: ${cleanText(session.sourceTitle, MAX_TITLE_LENGTH)}` : "",
    session.sourceUrl ? `URL: ${cleanUrl(session.sourceUrl)}` : "",
    `Generated from ${formatCount(stats.captures, "capture")} / ${formatCount(stats.questions, "question")} / ${formatCount(stats.cards, "card")}.`,
    "",
    "### Key Takeaways",
    ""
  ].filter((line) => line !== "");

  if (!captures.length) {
    lines.push("- No captures yet. Add quotes or thoughts first.");
  } else {
    captures.slice(0, 8).forEach((capture) => {
      const point = cleanText(capture.thought || capture.quote, MAX_CAPTURE_TEXT_LENGTH);
      lines.push(`- ${point.replace(/\n+/g, " ").slice(0, 240)}`);
      if (capture.quote && capture.thought) {
        lines.push(`  - Evidence: ${cleanText(capture.quote, MAX_CAPTURE_TEXT_LENGTH).replace(/\n+/g, " ").slice(0, 180)}`);
      }
    });
  }

  lines.push("", "### Open Questions", "");
  const questions = captures
    .map((capture) => cleanText(capture.thought, MAX_CAPTURE_TEXT_LENGTH))
    .filter((thought) => /\?/.test(thought));
  if (questions.length) {
    questions.slice(0, 5).forEach((question) => lines.push(`- ${question}`));
  } else {
    lines.push("- What should I be able to recall without looking?");
    lines.push("- Which idea changes how I would solve a real problem?");
  }

  lines.push("", "### Review Targets", "");
  if (reviewCards.length) {
    reviewCards.slice(0, 6).forEach((card) => lines.push(`- ${cleanText(card.prompt, MAX_CAPTURE_TEXT_LENGTH)}`));
  } else {
    lines.push("- Promote the strongest captures into review cards.");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function generateTodayMarkdown(workspace, now = new Date()) {
  const pack = buildTodayPack(workspace, now);
  const { stats } = pack;
  const lines = [
    "<!-- Generated from workspace.json. Edits will be overwritten. Source of truth: workspace.json -->",
    "",
    "# Today Study Pack",
    "",
    `Generated at: ${pack.generatedAt}`,
    `Local day window: [${pack.localDayWindow.start}, ${pack.localDayWindow.end})`,
    `Due rule: ${pack.dueDefinition}`,
    `Recent rule: ${pack.recentDefinition}`,
    `Workspace: ${formatCount(stats.sessions, "session")} / ${formatCount(stats.captures, "capture")} / ${formatCount(stats.cards, "card")} / ${formatCount(stats.due, "due card")}`,
    "",
    "## Due Review",
    ""
  ];

  if (!pack.dueItems.length) {
    lines.push("_No cards are due right now._");
  } else {
    pack.dueItems.forEach(({ sessionTitle, sessionPath, card }) => {
      lines.push(`- ${markdownInline(card.prompt)} - ${markdownRelativeLink(sessionTitle, sessionPath)}`);
      lines.push(`  - Due: ${formatDate(card.dueAt)} · strength ${card.strength}`);
    });
    if (pack.dueOverflow) lines.push(`- +${pack.dueOverflow} more due cards in workspace.json`);
  }

  lines.push("", "## Recent Captures", "");
  if (!pack.recentCaptures.length) {
    lines.push("_No captures yet._");
  } else {
    pack.recentCaptures.forEach(({ sessionTitle, sessionPath, capture }) => {
      const summary = markdownInline(capture.thought || capture.quote || "Untitled capture");
      lines.push(`- ${summary} - ${markdownRelativeLink(sessionTitle, sessionPath)}`);
      const source = buildSourceJumpUrl(capture.sourceUrl, capture.timestamp);
      if (source) {
        lines.push(`  - Source: [${markdownInline(capture.sourceTitle || "Open source")}](${source})${capture.timestamp ? ` @ ${markdownInline(capture.timestamp)}` : ""}`);
      } else if (capture.sourceTitle) {
        lines.push(`  - Source: ${markdownInline(capture.sourceTitle)}`);
      }
      if (capture.tags.length) {
        lines.push(`  - Tags: ${capture.tags.map((tag) => `#${markdownInline(tag)}`).join(" ")}`);
      }
    });
    if (pack.recentOverflow) lines.push(`- +${pack.recentOverflow} more captures in workspace.json`);
  }

  lines.push(
    "",
    "## Notes",
    "",
    "- `workspace.json` remains the canonical restore payload.",
    "- This file is a readable derived study index for Feishu Drive, Windows, and mobile review."
  );

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function generateReviewHtml(workspace, now = new Date()) {
  const cleanWorkspace = sanitizeWorkspace(workspace);
  const workspaceJson = JSON.stringify(cleanWorkspace, null, 2);
  const workspaceFingerprint = fingerprintText(workspaceJson);
  const pack = buildTodayPack(cleanWorkspace, now, { dueLimit: 50, recentLimit: 1 });
  const cards = pack.dueItems.map(({ sessionTitle, sessionPath, card }) => {
    const safeSessionPath = isSafeMirrorSessionPath(sessionPath) ? sessionPath : "";
    const sessionLink = safeSessionPath
      ? `<a href="${htmlAttribute(sessionPath)}">${htmlText(sessionTitle)}</a>`
      : htmlText(sessionTitle);
    return [
      '<article class="card">',
      `  <div class="meta">${sessionLink} · Due ${htmlText(formatDate(card.dueAt))} · strength ${htmlText(card.strength)}</div>`,
      `  <h2>${htmlText(card.prompt)}</h2>`,
      '  <button type="button" data-reveal aria-expanded="false">Reveal</button>',
      `  <div class="answer" hidden>${htmlMultiline(card.answer)}</div>`,
      "</article>"
    ].join("\n");
  });

  const empty = '<p class="empty">No cards are due right now.</p>';
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <meta name="referrer" content="no-referrer">',
    '  <meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'">',
    `  <meta name="learning-companion-source" content="workspace.json">`,
    `  <meta name="learning-companion-workspace-fingerprint" content="${htmlAttribute(workspaceFingerprint)}">`,
    `  <meta name="learning-companion-generated-at" content="${htmlAttribute(pack.generatedAt)}">`,
    "  <title>Learning Companion Review Pack</title>",
    "  <style>",
    "    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f6f0; color: #202124; }",
    "    body { margin: 0; padding: 18px; }",
    "    main { max-width: 760px; margin: 0 auto; }",
    "    header { margin-bottom: 16px; }",
    "    h1 { margin: 0 0 6px; font-size: 24px; }",
    "    h2 { margin: 0; font-size: 17px; line-height: 1.35; }",
    "    .summary, .meta, .empty { color: #697077; font-size: 13px; }",
    "    .card { display: grid; gap: 12px; margin: 12px 0; padding: 14px; border: 1px solid #dcd8cc; border-radius: 8px; background: white; }",
    "    button { min-height: 36px; border: 1px solid #2f6f5e; border-radius: 8px; background: #2f6f5e; color: white; font-weight: 700; }",
    "    .answer { padding: 10px; border: 1px solid #dcd8cc; border-radius: 8px; background: #fbfaf6; line-height: 1.5; }",
    "    a { color: #315f82; }",
    "    @media (max-width: 520px) { body { padding: 12px; } h1 { font-size: 21px; } }",
    "  </style>",
    "</head>",
    "<body>",
    "  <main>",
    "    <header>",
    "      <h1>Learning Companion Review Pack</h1>",
    `      <p class="summary">Generated at ${htmlText(pack.generatedAt)} · ${htmlText(pack.stats.due)} due ${pack.stats.due === 1 ? "card" : "cards"} · source of truth: workspace.json</p>`,
    "    </header>",
    cards.length ? cards.join("\n") : empty,
    "  </main>",
    "  <script>",
    "    document.addEventListener('click', (event) => {",
    "      const button = event.target.closest('[data-reveal]');",
    "      if (!button) return;",
    "      const answer = button.closest('.card')?.querySelector('.answer');",
    "      if (!answer) return;",
    "      const willShow = answer.hasAttribute('hidden');",
    "      answer.toggleAttribute('hidden', !willShow);",
    "      button.textContent = willShow ? 'Hide' : 'Reveal';",
    "      button.setAttribute('aria-expanded', String(willShow));",
    "    });",
    "  </script>",
    "</body>",
    "</html>",
    ""
  ].join("\n");
}

export function generateMirrorIndexHtml(workspace, now = new Date()) {
  const cleanWorkspace = sanitizeWorkspace(workspace);
  const workspaceJson = JSON.stringify(cleanWorkspace, null, 2);
  const workspaceFingerprint = fingerprintText(workspaceJson);
  const pack = buildTodayPack(cleanWorkspace, now, { dueLimit: 6, recentLimit: 4 });
  const sessionLinks = cleanWorkspace.sessions.map((session) => {
    const paths = getMirrorSessionPaths(session);
    const due = getDueReviewCards(session, now).length;
    return [
      '<article class="session">',
      `  <a href="${htmlAttribute(paths.markdownPath)}">${htmlText(session.title)}</a>`,
      `  <span>${htmlText(session.captures.length)} captures · ${htmlText(session.reviewCards.length)} cards · ${htmlText(due)} due</span>`,
      "</article>"
    ].join("\n");
  });
  const dueList = pack.dueItems.length
    ? pack.dueItems.map(({ sessionTitle, card }) => `<li>${htmlText(card.prompt)} <span>${htmlText(sessionTitle)}</span></li>`).join("\n")
    : "<li>No cards due right now.</li>";
  const recentList = pack.recentCaptures.length
    ? pack.recentCaptures.map(({ sessionTitle, capture }) => `<li>${htmlText(capture.thought || capture.quote || "Untitled capture")} <span>${htmlText(sessionTitle)}</span></li>`).join("\n")
    : "<li>No captures yet.</li>";

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <meta name="referrer" content="no-referrer">',
    '  <meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'">',
    `  <meta name="learning-companion-source" content="workspace.json">`,
    `  <meta name="learning-companion-workspace-fingerprint" content="${htmlAttribute(workspaceFingerprint)}">`,
    `  <meta name="learning-companion-generated-at" content="${htmlAttribute(pack.generatedAt)}">`,
    "  <title>Learning Companion Mirror</title>",
    "  <style>",
    "    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f6f0; color: #202124; }",
    "    body { margin: 0; padding: 18px; }",
    "    main { max-width: 860px; margin: 0 auto; display: grid; gap: 16px; }",
    "    h1, h2, p { margin: 0; }",
    "    h1 { font-size: 26px; } h2 { font-size: 16px; }",
    "    .summary, li span, .session span { color: #697077; font-size: 13px; }",
    "    .actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }",
    "    .action, .panel, .session { border: 1px solid #dcd8cc; border-radius: 8px; background: white; padding: 14px; }",
    "    .action { display: grid; gap: 5px; text-decoration: none; color: #202124; }",
    "    .action strong { color: #2f6f5e; }",
    "    .panel { display: grid; gap: 10px; }",
    "    ul { margin: 0; padding-left: 20px; }",
    "    li { margin: 8px 0; }",
    "    .sessions { display: grid; gap: 8px; }",
    "    .session { display: grid; gap: 5px; }",
    "    a { color: #315f82; }",
    "    @media (max-width: 620px) { body { padding: 12px; } .actions { grid-template-columns: 1fr; } }",
    "  </style>",
    "</head>",
    "<body>",
    "  <main>",
    "    <header>",
    "      <h1>Learning Companion Mirror</h1>",
    `      <p class="summary">Generated at ${htmlText(pack.generatedAt)} · ${htmlText(pack.stats.sessions)} sessions · ${htmlText(pack.stats.due)} due cards · source of truth: workspace.json</p>`,
    "    </header>",
    "    <nav class=\"actions\" aria-label=\"Mirror entry points\">",
    "      <a class=\"action\" href=\"TODAY.md\"><strong>Today</strong><span>Due review and recent captures</span></a>",
    "      <a class=\"action\" href=\"review.html\"><strong>Review</strong><span>Reveal-only portable cards</span></a>",
    "      <a class=\"action\" href=\"workspace.json\"><strong>Restore</strong><span>Canonical workspace JSON</span></a>",
    "    </nav>",
    "    <section class=\"panel\">",
    "      <h2>Due Review Preview</h2>",
    `      <ul>${dueList}</ul>`,
    "    </section>",
    "    <section class=\"panel\">",
    "      <h2>Recent Capture Preview</h2>",
    `      <ul>${recentList}</ul>`,
    "    </section>",
    "    <section class=\"panel\">",
    "      <h2>Sessions</h2>",
    `      <div class="sessions">${sessionLinks.join("\n")}</div>`,
    "    </section>",
    "  </main>",
    "</body>",
    "</html>",
    ""
  ].join("\n");
}

export function getSynthesisStats(session) {
  const captures = Array.isArray(session.captures) ? session.captures : [];
  const reviewCards = Array.isArray(session.reviewCards) ? session.reviewCards : [];
  return {
    captures: captures.length,
    questions: captures
      .map((capture) => cleanText(capture.thought, MAX_CAPTURE_TEXT_LENGTH))
      .filter((thought) => /\?/.test(thought)).length,
    cards: reviewCards.length
  };
}

export function buildFeishuPayload(session) {
  return {
    schema: "learning-companion.feishu-export.v1",
    exportedAt: nowIso(),
    target: {
      drive: "markdown-plus-json",
      docTitle: session.title
    },
    session,
    markdown: generateMarkdown(session)
  };
}

export function buildMirrorBundle(workspace) {
  const exportedAt = nowIso();
  const cleanWorkspace = sanitizeWorkspace(workspace);
  const workspaceJson = JSON.stringify(cleanWorkspace, null, 2);
  const workspaceFingerprint = fingerprintText(workspaceJson);
  const files = [];
  const sessionFiles = cleanWorkspace.sessions.flatMap((session) => {
    const paths = getMirrorSessionPaths(session);
    return [
      makeMirrorFile({
        path: paths.markdownPath,
        mediaType: "text/markdown",
        role: "readable-session",
        sessionId: session.id,
        content: generateMarkdown(session)
      }),
      makeMirrorFile({
        path: paths.sidecarPath,
        mediaType: "application/json",
        role: "session-sidecar",
        sessionId: session.id,
        content: JSON.stringify(buildFeishuPayload(session), null, 2)
      })
    ];
  });

  files.push(
    makeMirrorFile({
      path: "index.html",
      mediaType: "text/html",
      role: "mirror-home",
      sourceFingerprint: workspaceFingerprint,
      content: generateMirrorIndexHtml(cleanWorkspace, new Date(exportedAt))
    }),
    makeMirrorFile({
      path: "README.md",
      mediaType: "text/markdown",
      role: "mirror-index",
      content: generateMirrorReadme(cleanWorkspace, sessionFiles)
    }),
    makeMirrorFile({
      path: "TODAY.md",
      mediaType: "text/markdown",
      role: "study-pack",
      content: generateTodayMarkdown(cleanWorkspace, new Date(exportedAt))
    }),
    makeMirrorFile({
      path: "review.html",
      mediaType: "text/html",
      role: "portable-review",
      sourceFingerprint: workspaceFingerprint,
      content: generateReviewHtml(cleanWorkspace, new Date(exportedAt))
    }),
    makeMirrorFile({
      path: "workspace.json",
      mediaType: "application/json",
      role: "workspace-restore",
      content: workspaceJson
    }),
    ...sessionFiles
  );
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  if (totalBytes > MAX_MIRROR_BUNDLE_BYTES) {
    throw new Error("Mirror bundle is too large to export safely.");
  }
  const topicIndex = Object.fromEntries(cleanWorkspace.sessions.map((session) => {
    const paths = getMirrorSessionPaths(session);
    return [session.id, {
      title: session.title,
      markdownPath: paths.markdownPath,
      sidecarPath: paths.sidecarPath
    }];
  }));
  const manifestFiles = files.map((file) => ({
    path: file.path,
    role: file.role,
    sessionId: file.sessionId,
    sourceFingerprint: file.sourceFingerprint,
    bytes: file.bytes,
    contentFingerprint: file.contentFingerprint
  }));

  return {
    schema: "learning-companion.mirror-bundle.staging.v1",
    contractStability: "experimental",
    exportedAt,
    canonical: "workspace.json",
    derived: ["index.html", "README.md", "TODAY.md", "review.html", "sessions/*.md", "sessions/*.feishu.json"],
    generator: {
      name: "learning-companion-web",
      version: WORKSPACE_SCHEMA_VERSION,
      generatedAt: exportedAt
    },
    semantics: {
      snapshot: "full",
      uploaderInputOnly: true
    },
    target: {
      drive: "feishu-drive-manual-upload",
      layout: "folder-files-in-json-bundle"
    },
    workspace: {
      schema: cleanWorkspace.schema,
      schemaVersion: cleanWorkspace.schemaVersion,
      clientId: cleanWorkspace.clientId,
      activeSessionId: cleanWorkspace.activeSessionId,
      sessionCount: cleanWorkspace.sessions.length
    },
    manifest: {
      fileCount: files.length,
      totalBytes,
      maxFileBytes: MAX_MIRROR_FILE_BYTES,
      maxBundleBytes: MAX_MIRROR_BUNDLE_BYTES,
      fingerprintAlgorithm: "fnv1a-32-non-cryptographic",
      bundleFingerprint: fingerprintText(JSON.stringify(manifestFiles)),
      topicIndex
    },
    files
  };
}

export function buildMirrorZip(workspace) {
  const bundle = buildMirrorBundle(workspace);
  const files = bundle.files.map((file) => ({
    path: file.path,
    content: file.content
  }));
  const data = buildStoredZip(files, new Date(bundle.exportedAt));
  return {
    filename: "learning-companion-feishu-mirror.zip",
    mediaType: "application/zip",
    bytes: data.length,
    fileCount: files.length,
    bundleFingerprint: bundle.manifest.bundleFingerprint,
    data
  };
}

function formatCount(count, singular) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function markdownInline(value) {
  return cleanText(value, MAX_CAPTURE_TEXT_LENGTH)
    .replace(/\s+/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[[\]()`*_{}|]/g, "\\$&")
    .slice(0, 240);
}

function htmlText(value) {
  return cleanText(value, MAX_CAPTURE_TEXT_LENGTH)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlMultiline(value) {
  return htmlText(value).replace(/\n/g, "<br>");
}

function htmlAttribute(value) {
  return htmlText(value);
}

function getMirrorSessionPaths(session) {
  const baseName = `${slugifyPath(session.title)}-${shortId(session.id)}`;
  return {
    markdownPath: `sessions/${baseName}.md`,
    sidecarPath: `sessions/${baseName}.feishu.json`
  };
}

function markdownRelativeLink(label, path) {
  if (!path) return markdownInline(label);
  return `[${markdownInline(label)}](${normalizeMirrorPath(path)})`;
}

function isSafeMirrorSessionPath(path) {
  return /^sessions\/[A-Za-z0-9._-]+\.md$/.test(String(path || "")) && normalizeMirrorPath(path) === path;
}

function formatCaptureSource(capture, session) {
  const sourceTitle = cleanText(capture.sourceTitle || session.sourceTitle, MAX_TITLE_LENGTH);
  const sourceUrl = buildSourceJumpUrl(capture.sourceUrl || session.sourceUrl, capture.timestamp);
  if (!sourceTitle && !sourceUrl) return "";
  if (sourceUrl) return `Source: [${sourceTitle || "Open source"}](${sourceUrl})`;
  return `Source: ${sourceTitle}`;
}

function generateMirrorReadme(workspace, sessionFiles) {
  const lines = [
    "# Learning Companion Mirror",
    "",
    "This bundle is an experimental full snapshot for export/restore. It is not the final Feishu Drive folder layout.",
    "",
    `Exported sessions: ${workspace.sessions.length}`,
    `Workspace schema: ${workspace.schema} v${workspace.schemaVersion}`,
    "",
    "## Restore",
    "",
    "- Keep `workspace.json` as the canonical restore payload.",
    "- Open `TODAY.md` first for a portable due-review and recent-capture study pack.",
    "- Use `sessions/*.md` as readable Feishu Drive/Docs material.",
    "- Keep `sessions/*.feishu.json` beside Markdown files for future round-trip sync.",
    "- A future uploader should translate this bundle into Drive files instead of uploading this JSON as the final layout.",
    "",
    "## Files",
    ""
  ];
  lines.push("- `README.md` (mirror-index)");
  lines.push("- `index.html` (mirror-home)");
  lines.push("- `TODAY.md` (study-pack)");
  lines.push("- `review.html` (portable-review)");
  lines.push("- `workspace.json` (workspace-restore)");
  sessionFiles.forEach((file) => {
    lines.push(`- \`${file.path}\` (${file.role}, ${file.bytes} B)`);
  });
  return lines.join("\n").trim() + "\n";
}

function makeMirrorFile({ path, mediaType, role, sessionId = "", sourceFingerprint = "", content }) {
  const safePath = normalizeMirrorPath(path);
  const bytes = byteLength(content);
  if (bytes > MAX_MIRROR_FILE_BYTES) {
    throw new Error(`Mirror file is too large: ${safePath}`);
  }
  return {
    path: safePath,
    mediaType,
    encoding: "utf-8",
    role,
    sessionId,
    sourceFingerprint,
    bytes,
    contentFingerprint: fingerprintText(content),
    content
  };
}

function byteLength(value) {
  return new TextEncoder().encode(String(value || "")).length;
}

function buildStoredZip(files, timestamp = new Date()) {
  const encoder = new TextEncoder();
  const chunks = [];
  const centralChunks = [];
  const entries = files.map((file) => {
    const nameBytes = encoder.encode(normalizeMirrorPath(file.path));
    const body = encoder.encode(String(file.content || ""));
    return {
      nameBytes,
      body,
      crc: crc32(body),
      size: body.length
    };
  });
  const dos = toDosDateTime(timestamp);
  let offset = 0;

  entries.forEach((entry) => {
    const localHeader = new Uint8Array(30 + entry.nameBytes.length);
    const view = new DataView(localHeader.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, dos.time, true);
    view.setUint16(12, dos.date, true);
    view.setUint32(14, entry.crc, true);
    view.setUint32(18, entry.size, true);
    view.setUint32(22, entry.size, true);
    view.setUint16(26, entry.nameBytes.length, true);
    localHeader.set(entry.nameBytes, 30);
    chunks.push(localHeader, entry.body);

    const centralHeader = new Uint8Array(46 + entry.nameBytes.length);
    const central = new DataView(centralHeader.buffer);
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, dos.time, true);
    central.setUint16(14, dos.date, true);
    central.setUint32(16, entry.crc, true);
    central.setUint32(20, entry.size, true);
    central.setUint32(24, entry.size, true);
    central.setUint16(28, entry.nameBytes.length, true);
    central.setUint32(42, offset, true);
    centralHeader.set(entry.nameBytes, 46);
    centralChunks.push(centralHeader);
    offset += localHeader.length + entry.body.length;
  });

  const centralOffset = offset;
  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);

  return concatBytes([...chunks, ...centralChunks, end]);
}

function toDosDateTime(value) {
  const date = Number.isFinite(value?.getTime?.()) ? value : new Date();
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function fingerprintText(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function slugifyPath(value) {
  const slug = cleanText(value, MAX_TITLE_LENGTH)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "learning-session";
  return isReservedPathSegment(slug) ? `topic-${slug}` : slug;
}

function shortId(value) {
  return cleanText(value, 128).replace(/[^a-zA-Z0-9_-]/g, "").slice(-8) || makeId("s").slice(-8);
}

function normalizeMirrorPath(path) {
  const normalized = cleanText(path, 240).replace(/\\/g, "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.includes("..") ||
    /[\u0000-\u001F\u007F]/.test(normalized)
  ) {
    throw new Error("Unsafe mirror path.");
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || isReservedPathSegment(segment.replace(/\.[^.]+$/, "")))) {
    throw new Error("Unsafe mirror path.");
  }
  if (normalized.length > 240) {
    throw new Error("Mirror path is too long.");
  }
  return normalized;
}

function isReservedPathSegment(value) {
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value);
}

export function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value;
  }
}
