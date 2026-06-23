export const WORKSPACE_SCHEMA = "learning-companion.workspace.v1";
export const WORKSPACE_SCHEMA_VERSION = 2;
export const MOBILE_INBOX_PATCH_SCHEMA = "learning-companion.mobile-inbox-patch.v1";
export const REVIEW_PROGRESS_PATCH_SCHEMA = "learning-companion.review-progress-patch.v1";
export const MAX_TITLE_LENGTH = 160;
export const MAX_URL_LENGTH = 2048;
export const MAX_NOTE_LENGTH = 120000;
export const MAX_CAPTURE_TEXT_LENGTH = 12000;
export const MAX_MIRROR_FILE_BYTES = 1_000_000;
export const MAX_MIRROR_BUNDLE_BYTES = 25_000_000;
export const MAX_MIRROR_CANONICAL_BYTES = 5_000_000;
export const MAX_INBOX_PATCH_BYTES = 256_000;
export const MAX_INBOX_PATCH_CAPTURES = 50;
export const MAX_REVIEW_PROGRESS_PATCH_BYTES = 256_000;
export const MAX_REVIEW_PROGRESS_EVENTS = 200;
export const MAX_SEARCH_QUERY_LENGTH = 200;
export const MAX_VIDEO_BOOKMARKS = 80;
export const MAX_VIDEO_BOOKMARK_LABEL_LENGTH = 80;
export const FOCUS_BRIEF_SYNTHESIS_CAPTURE_THRESHOLD = 3;
export const FOCUS_BRIEF_CAPTURE_IDLE_MINUTES = 10;
export const CAPTURE_DRAFT_FOCUS_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const CAPTURE_DRAFT_LIMIT = 50;
// Keep the warning below common 5 MB localStorage quotas so export prompts arrive before writes fail.
export const WORKSPACE_STORAGE_WARNING_BYTES = 3_500_000;
export const WORKSPACE_BACKUP_STALE_DAYS = 7;

const MATERIAL_TYPES = new Set(["article", "video", "doc", "course", "book", "other"]);
const ANSWER_TARGET_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const FOCUS_MODES = new Set(["capture", "synthesize", "review"]);
const SAFE_URL_SCHEMES = new Set(["http:", "https:"]);
const TEXT_FRAGMENT_SNIPPET_LENGTH = 140;
const TEXT_FRAGMENT_MIN_LENGTH = 12;

export function nowIso() {
  return new Date().toISOString();
}

function optionIso(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
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

export function resolveTodayWindow(now = new Date()) {
  const date = Number.isFinite(now?.getTime?.()) ? now : new Date(now);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  const dateLabel = formatLocalIso(start).slice(0, 10);
  return {
    start,
    end,
    startIso: formatLocalIso(start),
    endIso: formatLocalIso(end),
    timeZone,
    label: `${dateLabel} local (${timeZone})`
  };
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

function cleanAnswerTargetId(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.length > 128 || !ANSWER_TARGET_ID_PATTERN.test(raw)) return "";
  return raw;
}

export function normalizeCaptureDraft(value, now = new Date()) {
  const draft = value && typeof value === "object" ? value : {};
  const updatedAt = Number.isFinite(new Date(draft.updatedAt).getTime())
    ? new Date(draft.updatedAt).toISOString()
    : new Date(now).toISOString();
  return {
    quote: cleanText(draft.quote, MAX_CAPTURE_TEXT_LENGTH),
    thought: cleanText(draft.thought, MAX_CAPTURE_TEXT_LENGTH),
    timestamp: cleanText(draft.timestamp, 32),
    sourceTitle: cleanText(draft.sourceTitle, MAX_TITLE_LENGTH).replace(/\s+/g, " "),
    sourceUrl: cleanText(draft.sourceUrl, MAX_URL_LENGTH),
    materialType: MATERIAL_TYPES.has(draft.materialType) ? draft.materialType : "",
    answersQuestionCaptureId: cleanAnswerTargetId(draft.answersQuestionCaptureId),
    updatedAt
  };
}

export function resolveDraftSourceMaterialType(value = {}) {
  const draftTitle = cleanText(value.draftSourceTitle, MAX_TITLE_LENGTH).replace(/\s+/g, " ").toLowerCase();
  const currentTitle = cleanText(value.currentSourceTitle, MAX_TITLE_LENGTH).replace(/\s+/g, " ").toLowerCase();
  const resolvedTitle = cleanText(value.resolvedSourceTitle, MAX_TITLE_LENGTH).replace(/\s+/g, " ").toLowerCase();
  const draftUrl = cleanUrl(value.draftSourceUrl);
  const currentUrl = cleanUrl(value.currentSourceUrl);
  const resolvedUrl = cleanUrl(value.resolvedSourceUrl);
  const hasResolvedSource = Boolean(resolvedTitle || resolvedUrl);
  if (!hasResolvedSource) return "";
  if (MATERIAL_TYPES.has(value.draftMaterialType)) return value.draftMaterialType;
  const draftHasSource = Boolean(draftTitle || draftUrl);
  const draftMatchesCurrent = Boolean(
    draftHasSource && (
      (draftUrl && currentUrl && draftUrl === currentUrl)
      || (!draftUrl && draftTitle && currentTitle && draftTitle === currentTitle)
    )
  );
  if (!draftHasSource || draftMatchesCurrent) {
    return MATERIAL_TYPES.has(value.currentMaterialType) ? value.currentMaterialType : "other";
  }
  return "other";
}

export function hasCaptureDraft(draft) {
  return Boolean(draft?.quote?.trim() || draft?.thought?.trim() || draft?.timestamp?.trim());
}

export function hasCaptureTextDraft(draft) {
  return Boolean(draft?.quote?.trim() || draft?.thought?.trim());
}

export function captureDraftStatusText(draft) {
  if (hasCaptureTextDraft(draft)) return "Draft saved";
  if (draft?.timestamp?.trim()) return "Time kept";
  return "No draft";
}

export function summarizeCaptureDraft(draft, maxLength = 96) {
  const text = [draft?.quote, draft?.thought].filter(Boolean).join(" - ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text || "Continue the saved capture draft.";
}

export function buildCaptureDraftItems(sessions = [], captureDrafts = {}, limit = 5) {
  return sessions
    .map((session) => ({ session, draft: normalizeCaptureDraft(captureDrafts?.[session.id]) }))
    .filter(({ draft }) => hasCaptureDraft(draft))
    .sort((a, b) => new Date(b.draft.updatedAt).getTime() - new Date(a.draft.updatedAt).getTime())
    .slice(0, Math.max(0, limit));
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
  const duration = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (duration && (duration[1] || duration[2] || duration[3])) {
    return (Number(duration[1]) || 0) * 3600 + (Number(duration[2]) || 0) * 60 + (Number(duration[3]) || 0);
  }
  const parts = raw.split(":").map((part) => part.trim());
  if (!parts.length || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) return null;
  return parts.reduce((sum, part) => (sum * 60) + Number(part), 0);
}

export function secondsToTimestamp(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  const pad = (part) => String(part).padStart(2, "0");
  if (seconds >= 3600) {
    return `${Math.floor(seconds / 3600)}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
  }
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

function secondsToDurationTimestamp(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours) return `${hours}h${minutes ? `${minutes}m` : ""}${remainder}s`;
  if (minutes) return `${minutes}m${remainder}s`;
  return `${remainder}s`;
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
      url.searchParams.delete("time_continue");
      url.searchParams.set("t", `${seconds}s`);
      return url.href;
    }
    if (isBilibiliHost(url.hostname)) {
      url.searchParams.set("t", String(seconds));
      return url.href;
    }
    if (isVimeoHost(url.hostname)) {
      return setVimeoHashTimestamp(url, seconds);
    }
    return href;
  } catch {
    return href;
  }
}

export function buildSourceTextFragmentUrl(sourceUrl, text = "") {
  const href = cleanUrl(sourceUrl);
  const snippet = normalizeTextFragmentSnippet(text);
  if (!href || !snippet) return "";
  try {
    const url = new URL(href);
    if (isVideoHost(url.hostname) || isPdfLikeSourceUrl(url)) return "";
    const hash = String(url.hash || "").replace(/^#/, "");
    if (hash.includes(":~:")) return href;
    const directive = `:~:text=${encodeTextFragmentComponent(snippet)}`;
    url.hash = hash ? `${hash}${directive}` : directive;
    return url.href;
  } catch {
    return "";
  }
}

function normalizeTextFragmentSnippet(value) {
  const text = cleanText(value, MAX_CAPTURE_TEXT_LENGTH)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TEXT_FRAGMENT_SNIPPET_LENGTH)
    .trim();
  return text.length >= TEXT_FRAGMENT_MIN_LENGTH && /[\p{L}\p{N}]/u.test(text) ? text : "";
}

function encodeTextFragmentComponent(value) {
  return encodeURIComponent(value)
    .replace(/[-!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function isVideoHost(hostname) {
  return isYouTubeHost(hostname) || isBilibiliHost(hostname) || isVimeoHost(hostname);
}

function isPdfLikeSourceUrl(url) {
  return /\.pdf$/i.test(url.pathname);
}

function captureQuoteCanAnchorSource(capture) {
  return Boolean(capture?.quote) && !capture?.answersQuestionCaptureId;
}

export function isYouTubeHost(hostname) {
  return /(^|\.)youtube\.com$/i.test(hostname) || /^youtu\.be$/i.test(hostname);
}

export function isBilibiliHost(hostname) {
  return /(^|\.)bilibili\.com$/i.test(hostname);
}

export function isVimeoHost(hostname) {
  return /(^|\.)vimeo\.com$/i.test(hostname);
}

function readHashTimestamp(url) {
  const hash = String(url.hash || "").replace(/^#/, "");
  if (!hash || !hash.includes("=")) return null;
  return timestampToSeconds(new URLSearchParams(hash).get("t") || "");
}

function setVimeoHashTimestamp(url, seconds) {
  const hash = String(url.hash || "").replace(/^#/, "");
  if (hash && !hash.includes("=")) return url.href;
  const params = hash && hash.includes("=") ? new URLSearchParams(hash) : new URLSearchParams();
  params.set("t", secondsToDurationTimestamp(seconds));
  url.hash = params.toString();
  return url.href;
}

export function extractSourceTimestamp(sourceUrl) {
  const href = cleanUrl(sourceUrl);
  if (!href) return "";
  try {
    const url = new URL(href);
    if (isYouTubeHost(url.hostname)) {
      for (const key of ["t", "start", "time_continue"]) {
        const seconds = timestampToSeconds(url.searchParams.get(key) || "");
        if (seconds !== null) return secondsToTimestamp(seconds);
      }
    }
    if (isBilibiliHost(url.hostname)) {
      const seconds = timestampToSeconds(url.searchParams.get("t") || "");
      if (seconds !== null) return secondsToTimestamp(seconds);
    }
    if (isVimeoHost(url.hostname)) {
      const seconds = readHashTimestamp(url);
      if (seconds !== null) return secondsToTimestamp(seconds);
    }
    return "";
  } catch {
    return "";
  }
}

export function stripSourceTimestamp(sourceUrl) {
  const href = cleanUrl(sourceUrl);
  if (!href) return "";
  try {
    const url = new URL(href);
    if (isYouTubeHost(url.hostname)) {
      ["t", "start", "time_continue"].forEach((key) => url.searchParams.delete(key));
    }
    if (isBilibiliHost(url.hostname)) {
      url.searchParams.delete("t");
    }
    if (isVimeoHost(url.hostname)) {
      stripVimeoHashTimestamp(url);
    }
    return url.href;
  } catch {
    return href;
  }
}

function stripVimeoHashTimestamp(url) {
  const hash = String(url.hash || "").replace(/^#/, "");
  if (!hash || !hash.includes("=")) return;
  const params = new URLSearchParams(hash);
  params.delete("t");
  const nextHash = params.toString();
  url.hash = nextHash ? nextHash : "";
}

function normalizeSourceProvenance(value) {
  const normalized = cleanText(value, 32);
  return ["snapshot", "inbound", "inbox", "inherited", "unknown"].includes(normalized) ? normalized : "";
}

export function normalizeCapture(capture = {}, originClientId = makeId("client"), sourceFallback = {}) {
  const timestamp = nowIso();
  const hasOwnSourceTitle = Object.prototype.hasOwnProperty.call(capture, "sourceTitle");
  const hasOwnSourceUrl = Object.prototype.hasOwnProperty.call(capture, "sourceUrl");
  const hasOwnMaterialType = Object.prototype.hasOwnProperty.call(capture, "materialType");
  const materialType = hasOwnMaterialType ? capture.materialType : sourceFallback.materialType;
  const hasCaptureSource = Boolean(capture.sourceTitle || capture.sourceUrl || capture.materialType);
  const hasInheritedSource = Boolean(sourceFallback.sourceTitle || sourceFallback.sourceUrl || sourceFallback.materialType);
  const questionResolvedAt = capture.questionResolvedAt ? cleanText(capture.questionResolvedAt, 64) : null;
  const questionParkedAt = !questionResolvedAt && capture.questionParkedAt ? cleanText(capture.questionParkedAt, 64) : null;
  return {
    id: capture.id || makeId("capture"),
    quote: cleanText(capture.quote, MAX_CAPTURE_TEXT_LENGTH),
    thought: cleanText(capture.thought, MAX_CAPTURE_TEXT_LENGTH),
    timestamp: cleanText(capture.timestamp, 32),
    sourceTitle: cleanText(hasOwnSourceTitle ? capture.sourceTitle : sourceFallback.sourceTitle, MAX_TITLE_LENGTH),
    sourceUrl: cleanUrl(hasOwnSourceUrl ? capture.sourceUrl : sourceFallback.sourceUrl),
    materialType: MATERIAL_TYPES.has(materialType) ? materialType : "other",
    sourceProvenance: normalizeSourceProvenance(capture.sourceProvenance)
      || (hasCaptureSource ? "snapshot" : hasInheritedSource ? "inherited" : "unknown"),
    tags: normalizeTags(capture.tags || []),
    createdAt: capture.createdAt || timestamp,
    capturedAt: capture.capturedAt || capture.createdAt || timestamp,
    updatedAt: capture.updatedAt || capture.createdAt || timestamp,
    originClientId: capture.originClientId || originClientId,
    inboxPatchId: cleanText(capture.inboxPatchId, 128),
    inboxCaptureId: cleanText(capture.inboxCaptureId, 128),
    answersQuestionCaptureId: cleanAnswerTargetId(capture.answersQuestionCaptureId),
    questionResolvedAt,
    questionParkedAt,
    promotedToReview: Boolean(capture.promotedToReview)
  };
}

export function normalizeVideoBookmark(bookmark = {}) {
  const timestampSeconds = timestampToSeconds(bookmark.timestamp);
  const rawSeconds = Number(bookmark.seconds);
  const hasSeconds = bookmark.seconds !== undefined
    && bookmark.seconds !== null
    && String(bookmark.seconds).trim() !== ""
    && Number.isFinite(rawSeconds);
  const seconds = Math.max(0, Math.floor(hasSeconds ? rawSeconds : (timestampSeconds || 0)));
  const label = cleanText(bookmark.label, MAX_VIDEO_BOOKMARK_LABEL_LENGTH)
    .replace(/\s+/g, " ")
    .trim();
  const timestamp = secondsToTimestamp(seconds);
  const createdAt = optionIso(bookmark.createdAt) || nowIso();
  return {
    id: cleanText(bookmark.id, 128) || makeId("bookmark"),
    seconds,
    timestamp,
    label: label || timestamp,
    createdAt
  };
}

function normalizeVideoBookmarks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((bookmark) => normalizeVideoBookmark(bookmark))
    .filter((bookmark) => bookmark.timestamp)
    .sort((a, b) => a.seconds - b.seconds || a.createdAt.localeCompare(b.createdAt))
    .slice(0, MAX_VIDEO_BOOKMARKS);
}

// Review-card provenance invariants:
// sourceCaptureId is the originating capture; deleting that capture deletes the card.
// answersQuestionCaptureId lives on answer captures and points back to the question capture.
// evidenceCaptureId lives on cards and points to the current answer evidence capture when available.
export function normalizeReviewCard(card = {}, originClientId = makeId("client")) {
  const timestamp = nowIso();
  return {
    id: card.id || makeId("card"),
    prompt: cleanText(card.prompt, MAX_CAPTURE_TEXT_LENGTH),
    answer: cleanText(card.answer, MAX_CAPTURE_TEXT_LENGTH),
    sourceCaptureId: cleanText(card.sourceCaptureId, 128),
    evidenceCaptureId: cleanAnswerTargetId(card.evidenceCaptureId),
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
    viewerOpen: overrides.viewerOpen !== false,
    viewerMode: overrides.viewerMode || "auto",
    viewerPosition: Math.max(0, Math.round(Number(overrides.viewerPosition) || 0)),
    videoBookmarks: materialType === "video" ? normalizeVideoBookmarks(overrides.videoBookmarks) : [],
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
    importedPatches: [],
    importedReviewPatches: [],
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
    importedPatches: normalizeImportedPatches(workspace.importedPatches),
    importedReviewPatches: normalizeImportedPatches(workspace.importedReviewPatches),
    createdAt: workspace.createdAt || nowIso(),
    updatedAt: workspace.updatedAt || nowIso()
  };
}

export function workspaceFingerprint(serialized) {
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function workspaceBackupFingerprint(value) {
  const stableWorkspace = {
    ...value,
    updatedAt: ""
  };
  return workspaceFingerprint(JSON.stringify(stableWorkspace));
}

export function buildReturnBaseFingerprint(workspace) {
  const safeWorkspace = sanitizeWorkspace(workspace);
  return fingerprintText(JSON.stringify({
    schema: "learning-companion.return-base-fingerprint.v1",
    workspaceSchemaVersion: safeWorkspace.schemaVersion,
    activeSessionId: safeWorkspace.activeSessionId,
    sessions: safeWorkspace.sessions.map((session) => ({
      id: session.id,
      title: session.title,
      questionCaptures: session.captures
        .filter((capture) => captureHasQuestion(capture)
          || capture.questionResolvedAt
          || capture.questionParkedAt)
        .map((capture) => ({
          id: capture.id,
          question: captureHasQuestion(capture),
          open: captureHasOpenQuestion(capture),
          parked: captureHasParkedQuestion(capture),
          resolved: captureHasResolvedQuestion(capture)
        }))
        .sort((a, b) => String(a.id || "").localeCompare(String(b.id || ""))),
      reviewCards: session.reviewCards
        .map((card) => ({
          id: card.id,
          sourceCaptureId: card.sourceCaptureId || "",
          evidenceCaptureId: card.evidenceCaptureId || "",
          updatedAt: card.updatedAt || card.createdAt || "",
          lastReviewedAt: card.lastReviewedAt || null,
          dueAt: card.dueAt || "",
          strength: Number(card.strength) || 0
        }))
        .sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")))
    }))
  }));
}

export function hasBackupWorthyWorkspace(value) {
  return Boolean(
    value?.sessions?.length > 1 ||
    value?.importedPatches?.length ||
    value?.importedReviewPatches?.length ||
    value?.sessions?.some((session) => session.captures.length || session.reviewCards.length)
  );
}

export function workspaceStorageNotice(workspaceData, backup, bytes = 0, now = new Date()) {
  // Priority: storage pressure first, then unsaved changes, then stale matching exports.
  if (bytes > WORKSPACE_STORAGE_WARNING_BYTES) {
    return `Workspace is ${formatBytes(bytes)}; export now.`;
  }
  if (!hasBackupWorthyWorkspace(workspaceData)) return null;

  const currentFingerprint = workspaceBackupFingerprint(workspaceData);
  const backupFingerprint = cleanText(backup?.fingerprint, 64);
  if (backupFingerprint !== currentFingerprint) {
    return "Local changes not exported";
  }

  const exportedAt = new Date(backup?.exportedAt || "");
  if (!Number.isFinite(exportedAt.getTime())) {
    return "Local backup status unknown";
  }

  const date = Number.isFinite(now?.getTime?.()) ? now : new Date(now);
  const nowTime = Number.isFinite(date.getTime()) ? date.getTime() : Date.now();
  const ageDays = Math.floor((nowTime - exportedAt.getTime()) / (24 * 60 * 60 * 1000));
  if (ageDays >= WORKSPACE_BACKUP_STALE_DAYS) {
    return `Last export was ${ageDays} ${ageDays === 1 ? "day" : "days"} ago; re-export to refresh your local copy`;
  }
  return null;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function workspaceFromPortableData(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Unsupported import file.");
  }
  if (isMirrorBundle(input)) {
    return workspaceFromMirrorBundle(input);
  }
  if (isMobileInboxPatch(input)) {
    throw new Error("Mobile inbox patches must be imported into the current workspace.");
  }
  if (isMobileInboxPatchLike(input)) {
    throw new Error("Unsupported mobile inbox patch schema.");
  }
  if (isReviewProgressPatch(input)) {
    throw new Error("Review progress patches must be imported into the current workspace.");
  }
  if (isReviewProgressPatchLike(input)) {
    throw new Error("Unsupported review progress patch schema.");
  }
  return sanitizeWorkspace(input);
}

export function isMirrorBundle(input) {
  return Boolean(input && typeof input === "object" && input.schema === "learning-companion.mirror-bundle.staging.v1");
}

export function isMobileInboxPatch(input) {
  return Boolean(input && typeof input === "object" && input.schema === MOBILE_INBOX_PATCH_SCHEMA);
}

export function isMobileInboxPatchLike(input) {
  return Boolean(input && typeof input === "object" && String(input.schema || "").startsWith("learning-companion.mobile-inbox-patch."));
}

export function isReviewProgressPatch(input) {
  return Boolean(input && typeof input === "object" && input.schema === REVIEW_PROGRESS_PATCH_SCHEMA);
}

export function isReviewProgressPatchLike(input) {
  return Boolean(input && typeof input === "object" && String(input.schema || "").startsWith("learning-companion.review-progress-patch."));
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

export function applyMobileInboxPatch(workspace, patch, now = new Date()) {
  if (!isMobileInboxPatch(patch)) {
    throw new Error(isMobileInboxPatchLike(patch)
      ? "Unsupported mobile inbox patch schema."
      : "Unsupported mobile inbox patch.");
  }
  const safeWorkspace = sanitizeWorkspace(workspace);
  if (byteLength(JSON.stringify(patch)) > MAX_INBOX_PATCH_BYTES) {
    throw new Error("Mobile inbox patch is too large.");
  }
  const patchId = cleanText(patch.patchId, 128);
  if (!patchId) throw new Error("Mobile inbox patch is missing patchId.");
  const captures = Array.isArray(patch.captures) ? patch.captures : [];
  if (captures.length > MAX_INBOX_PATCH_CAPTURES) {
    throw new Error("Mobile inbox patch has too many captures.");
  }
  const importedAtIso = Number.isFinite(now?.getTime?.()) ? now.toISOString() : nowIso();
  const importedPatches = normalizeImportedPatches(safeWorkspace.importedPatches);
  if (importedPatches.includes(patchId)) {
    return {
      workspace: safeWorkspace,
      receipt: buildInboxReceipt({
        patch,
        patchId,
        workspace: safeWorkspace,
        baseWorkspace: safeWorkspace,
        targetSession: getActiveSession(safeWorkspace),
        targetResolution: "duplicate-patch",
        added: 0,
        skippedDuplicate: captures.length,
        importedAt: now
      })
    };
  }

  const target = resolveInboxPatchTarget(safeWorkspace, patch);
  const seenCaptureIds = new Set();
  const existingInboxIds = new Set(target.session.captures
    .map((capture) => capture.inboxCaptureId)
    .filter(Boolean));
  const importedCaptures = [];
  let skippedDuplicate = 0;
  let sanitizedSourceUrls = 0;
  let answeredQuestions = 0;
  let skippedAnswerTargets = 0;
  const answerTargetSkips = {
    invalid: 0,
    selfReference: 0,
    patchReference: 0,
    missing: 0,
    nonQuestion: 0,
    alreadyClosed: 0
  };
  const patchCaptureIds = new Set(captures
    .map((capture) => cleanText(capture?.id, 128))
    .filter(Boolean));

  captures.forEach((capture) => {
    const inboxCaptureId = cleanText(capture?.id, 128);
    if (!inboxCaptureId) {
      skippedDuplicate += 1;
      return;
    }
    if (seenCaptureIds.has(inboxCaptureId) || existingInboxIds.has(inboxCaptureId)) {
      skippedDuplicate += 1;
      return;
    }
    seenCaptureIds.add(inboxCaptureId);
    const rawSourceUrl = cleanText(capture?.sourceUrl, MAX_URL_LENGTH);
    const rawAnswerTarget = capture?.answersQuestionCaptureId;
    const hasAnswerTarget = rawAnswerTarget !== undefined && rawAnswerTarget !== null && String(rawAnswerTarget).trim() !== "";
    let answersQuestionCaptureId = "";
    if (hasAnswerTarget) {
      answersQuestionCaptureId = cleanAnswerTargetId(rawAnswerTarget);
      if (!answersQuestionCaptureId) {
        answerTargetSkips.invalid += 1;
      } else if (answersQuestionCaptureId === inboxCaptureId) {
        answersQuestionCaptureId = "";
        answerTargetSkips.selfReference += 1;
      } else if (patchCaptureIds.has(answersQuestionCaptureId)) {
        answersQuestionCaptureId = "";
        answerTargetSkips.patchReference += 1;
      }
    }
    const normalizedCapture = normalizeCapture({
      id: makeId("capture"),
      quote: capture.quote,
      thought: capture.thought,
      timestamp: capture.timestamp,
      sourceTitle: capture.sourceTitle,
      sourceUrl: capture.sourceUrl,
      materialType: capture.materialType,
      sourceProvenance: "inbox",
      tags: capture.tags,
      capturedAt: normalizeInboxCapturedAt(capture.capturedAt, now),
      createdAt: normalizeInboxCapturedAt(capture.capturedAt, now),
      updatedAt: importedAtIso,
      inboxPatchId: patchId,
      inboxCaptureId,
      answersQuestionCaptureId
    }, safeWorkspace.clientId, {
      sourceTitle: target.session.sourceTitle,
      sourceUrl: target.session.sourceUrl,
      materialType: target.session.materialType
    });
    if (rawSourceUrl && !normalizedCapture.sourceUrl) {
      sanitizedSourceUrls += 1;
    }
    importedCaptures.push(normalizedCapture);
  });

  importedCaptures.sort((a, b) => {
    const byTime = new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime();
    if (byTime !== 0) return byTime;
    return a.inboxCaptureId.localeCompare(b.inboxCaptureId);
  });

  const answerTargetIds = [...new Set(importedCaptures
    .map((capture) => cleanAnswerTargetId(capture.answersQuestionCaptureId))
    .filter(Boolean))];
  const answeredQuestionIds = new Set();

  const nextWorkspace = {
    ...safeWorkspace,
    updatedAt: importedAtIso,
    importedPatches: [...importedPatches, patchId].slice(-200),
    sessions: safeWorkspace.sessions.map((session) => {
      if (session.id !== target.session.id) return session;
      const targetCapturesById = new Map(session.captures.map((capture) => [capture.id, capture]));
      const targetIdsToResolve = new Set();
      answerTargetIds.forEach((targetId) => {
        const targetCapture = targetCapturesById.get(targetId);
        if (!targetCapture) {
          answerTargetSkips.missing += 1;
        } else if (!captureHasQuestion(targetCapture)) {
          answerTargetSkips.nonQuestion += 1;
        } else if (!captureHasOpenQuestion(targetCapture) && !captureHasParkedQuestion(targetCapture)) {
          answerTargetSkips.alreadyClosed += 1;
        } else {
          targetIdsToResolve.add(targetId);
        }
      });
      const capturesWithAnsweredQuestions = session.captures.map((capture) => {
        if (!targetIdsToResolve.has(capture.id)) return capture;
        answeredQuestionIds.add(capture.id);
        return {
          ...capture,
          questionResolvedAt: importedAtIso,
          questionParkedAt: null,
          updatedAt: importedAtIso
        };
      });
      return {
        ...session,
        captures: [...importedCaptures, ...capturesWithAnsweredQuestions],
        updatedAt: importedAtIso
      };
    })
  };
  answeredQuestions = answeredQuestionIds.size;
  skippedAnswerTargets = Object.values(answerTargetSkips).reduce((sum, count) => sum + count, 0);
  const finalWorkspace = sanitizeWorkspace(nextWorkspace);
  const finalTargetSession = finalWorkspace.sessions.find((session) => session.id === target.session.id) || getActiveSession(finalWorkspace);
  const refreshableReviewCards = finalTargetSession.reviewCards
    .filter((card) => answeredQuestionIds.has(card.sourceCaptureId)).length;
  return {
    workspace: finalWorkspace,
    receipt: buildInboxReceipt({
      patch,
      patchId,
      workspace: finalWorkspace,
      baseWorkspace: safeWorkspace,
      targetSession: finalTargetSession,
      targetResolution: target.resolution,
      added: importedCaptures.length,
      skippedDuplicate,
      sanitizedSourceUrls,
      answeredQuestions,
      refreshableReviewCards,
      skippedAnswerTargets,
      answerTargetSkips,
      importedAt: now
    })
  };
}

export function applyReviewProgressPatch(workspace, patch, now = new Date()) {
  if (!isReviewProgressPatch(patch)) {
    throw new Error(isReviewProgressPatchLike(patch)
      ? "Unsupported review progress patch schema."
      : "Unsupported review progress patch.");
  }
  const safeWorkspace = sanitizeWorkspace(workspace);
  if (byteLength(JSON.stringify(patch)) > MAX_REVIEW_PROGRESS_PATCH_BYTES) {
    throw new Error("Review progress patch is too large.");
  }
  const patchId = cleanText(patch.patchId, 128);
  if (!patchId) throw new Error("Review progress patch is missing patchId.");
  const events = Array.isArray(patch.events) ? patch.events : [];
  if (events.length > MAX_REVIEW_PROGRESS_EVENTS) {
    throw new Error("Review progress patch has too many events.");
  }
  const importedReviewPatches = normalizeImportedPatches(safeWorkspace.importedReviewPatches);
  if (importedReviewPatches.includes(patchId)) {
    return {
      workspace: safeWorkspace,
      receipt: buildReviewProgressReceipt({
        patch,
        patchId,
        baseWorkspace: safeWorkspace,
        targetResolution: "duplicate-patch",
        applied: 0,
        skippedDuplicate: events.length,
        totalEvents: events.length,
        importedAt: now
      })
    };
  }

  const seenEventIds = new Set();
  const nextSessions = safeWorkspace.sessions.map((session) => ({
    ...session,
    reviewCards: [...session.reviewCards]
  }));
  let applied = 0;
  let skippedDuplicate = 0;
  let skippedMissing = 0;
  let skippedConflict = 0;
  let skippedInvalid = 0;

  events.forEach((event) => {
    const eventId = cleanText(event?.id, 128);
    const sessionId = cleanText(event?.sessionId, 128);
    const cardId = cleanText(event?.cardId, 128);
    const grade = cleanText(event?.grade, 16);
    const baseUpdatedAt = cleanText(event?.baseUpdatedAt, 64);
    if (!eventId || !sessionId || !cardId || !["again", "good"].includes(grade) || !baseUpdatedAt) {
      skippedInvalid += 1;
      return;
    }
    if (seenEventIds.has(eventId)) {
      skippedDuplicate += 1;
      return;
    }
    seenEventIds.add(eventId);
    const session = nextSessions.find((item) => item.id === sessionId);
    const cardIndex = session?.reviewCards.findIndex((card) => card.id === cardId) ?? -1;
    if (!session || cardIndex < 0) {
      skippedMissing += 1;
      return;
    }
    const card = session.reviewCards[cardIndex];
    if (card.updatedAt !== baseUpdatedAt) {
      skippedConflict += 1;
      return;
    }
    const reviewedAt = normalizeReviewProgressDate(event.reviewedAt, now);
    session.reviewCards[cardIndex] = applyGrade(card, grade, reviewedAt);
    session.updatedAt = nowIso();
    applied += 1;
  });

  const nextWorkspace = sanitizeWorkspace({
    ...safeWorkspace,
    sessions: nextSessions,
    importedReviewPatches: [...importedReviewPatches, patchId].slice(-200),
    updatedAt: nowIso()
  });
  return {
    workspace: nextWorkspace,
    receipt: buildReviewProgressReceipt({
      patch,
      patchId,
      baseWorkspace: safeWorkspace,
      targetResolution: "event-import",
      applied,
      skippedDuplicate,
      skippedMissing,
      skippedConflict,
      skippedInvalid,
      totalEvents: events.length,
      importedAt: now
    })
  };
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
      next.viewerPosition = Math.max(0, Math.round(Number(next.viewerPosition) || 0));
      next.videoBookmarks = next.materialType === "video" ? normalizeVideoBookmarks(next.videoBookmarks) : [];
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

  const timestamp = optionIso(options.now) || nowIso();
  const sourceSession = workspace.sessions.find((session) => session.id === sessionId);
  const materialType = captureInput.materialType || sourceSession?.materialType;
  const savedCapture = {
    id: cleanText(captureInput.id, 128) || makeId("capture"),
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
    answersQuestionCaptureId: cleanAnswerTargetId(captureInput.answersQuestionCaptureId),
    questionResolvedAt: null,
    questionParkedAt: null,
    promotedToReview: Boolean(options.promoteToReview)
  };

  let createdCard = null;
  if (options.promoteToReview) {
    createdCard = createReviewCardFromCapture(savedCapture, workspace.clientId, {
      prompt: options.reviewPrompt,
      answer: options.reviewAnswer,
      now: options.now
    });
  }
  const resolvedQuestionCaptureId = answerTextIsReviewReady(answerCaptureText(savedCapture))
    ? savedCapture.answersQuestionCaptureId
    : "";

  return {
    ...workspace,
    updatedAt: timestamp,
    sessions: workspace.sessions.map((session) => {
      if (session.id !== sessionId) return session;
      const captures = session.captures.map((capture) => (
        capture.id === resolvedQuestionCaptureId && captureHasQuestion(capture)
          ? {
              ...capture,
              questionResolvedAt: timestamp,
              questionParkedAt: null,
              updatedAt: timestamp
            }
          : capture
      ));
      return {
        ...session,
        captures: [savedCapture, ...captures],
        reviewCards: createdCard ? [createdCard, ...session.reviewCards] : session.reviewCards,
        updatedAt: timestamp
      };
    })
  };
}

export function updateCaptureThought(workspace, sessionId, captureId, thoughtInput, options = {}) {
  const thought = cleanText(thoughtInput, MAX_CAPTURE_TEXT_LENGTH);
  if (!thought) return workspace;
  const timestamp = optionIso(options.now) || nowIso();
  let changed = false;
  const sessions = workspace.sessions.map((session) => {
    if (session.id !== sessionId) return session;
    let targetCapture = null;
    const captures = session.captures.map((capture) => {
      if (capture.id !== captureId) return capture;
      if (capture.thought === thought) return capture;
      changed = true;
      targetCapture = capture;
      return {
        ...capture,
        thought,
        updatedAt: timestamp
      };
    });
    if (!changed) return session;
    const reviewCards = session.reviewCards.map((card) => {
      if (card.sourceCaptureId !== captureId || !targetCapture) return card;
      // Only refresh the generated quote-only prompt; preserve any prompt the learner has already changed.
      const quotePrompt = `Explain this excerpt: ${targetCapture.quote.slice(0, 160)}`;
      if (card.prompt !== quotePrompt) return card;
      return {
        ...card,
        prompt: `Recall the point behind: ${thought}`,
        updatedAt: timestamp
      };
    });
    return {
      ...session,
      captures,
      reviewCards,
      updatedAt: timestamp
    };
  });
  return changed
    ? {
        ...workspace,
        updatedAt: timestamp,
        sessions
      }
    : workspace;
}

export function createReviewCardFromCapture(capture, originClientId = capture.originClientId, overrides = {}) {
  const prompt = cleanText(overrides.prompt, MAX_CAPTURE_TEXT_LENGTH) || (capture.thought
    ? `Recall the point behind: ${capture.thought}`
    : `Explain this excerpt: ${capture.quote.slice(0, 160)}`);
  const answer = [cleanText(overrides.answer, MAX_CAPTURE_TEXT_LENGTH) || capture.quote, capture.timestamp ? `Time: ${capture.timestamp}` : ""]
    .filter(Boolean)
    .join("\n\n");
  const timestamp = optionIso(overrides.now) || nowIso();
  return {
    id: makeId("card"),
    prompt,
    answer,
    sourceCaptureId: capture.id,
    evidenceCaptureId: cleanAnswerTargetId(overrides.evidenceCaptureId),
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
        reviewCards: [createReviewCardFromCapture(
          capture,
          workspace.clientId,
          reviewOverridesFromAnsweredQuestion(session, capture)
        ), ...session.reviewCards],
        updatedAt: nowIso()
      };
    })
  };
}

export function refreshAnsweredQuestionReviewCard(workspace, sessionId, captureId) {
  const timestamp = nowIso();
  let changed = false;
  const sessions = workspace.sessions.map((session) => {
    if (session.id !== sessionId) return session;
    const capture = session.captures.find((item) => item.id === captureId);
    const card = session.reviewCards.find((item) => item.sourceCaptureId === captureId);
    if (!capture || !card) return session;
    const overrides = reviewOverridesFromAnsweredQuestion(session, capture);
    if (!overrides.prompt || !overrides.answer) return session;
    changed = true;
    return {
      ...session,
      reviewCards: session.reviewCards.map((item) => item.id === card.id
        ? {
            ...item,
            prompt: overrides.prompt,
            answer: overrides.answer,
            evidenceCaptureId: overrides.evidenceCaptureId || "",
            updatedAt: timestamp
          }
        : item),
      updatedAt: timestamp
    };
  });
  if (!changed) return workspace;
  return {
    ...workspace,
    updatedAt: timestamp,
    sessions
  };
}

function reviewOverridesFromAnsweredQuestion(session, capture) {
  if (!captureHasQuestion(capture)) return {};
  const answer = latestReviewReadyAnswerForQuestion(session, capture.id);
  if (!answer) return {};
  const questionText = reviewQuestionText(capture);
  const answerText = answerCaptureText(answer);
  if (!questionText || !answerText) return {};
  const answerEvidence = answer.quote && answer.thought
    ? `Evidence: ${cleanText(answer.quote, MAX_CAPTURE_TEXT_LENGTH)}`
    : "";
  return {
    prompt: `Answer the question: ${questionText}`,
    answer: [answerText, answerEvidence, answer.timestamp ? `Time: ${answer.timestamp}` : ""]
      .filter(Boolean)
      .join("\n\n"),
    evidenceCaptureId: answer.id
  };
}

function reviewQuestionText(capture) {
  return cleanText(capture.thought || capture.quote, MAX_CAPTURE_TEXT_LENGTH)
    .replace(/^(?:q|question)\s*[:：]\s*/i, "")
    .trim();
}

function answerCaptureText(capture) {
  return cleanText(capture.thought || capture.quote, MAX_CAPTURE_TEXT_LENGTH)
    .replace(/^(?:a|answer)\s*[:：]\s*/i, "")
    .trim();
}

function latestAnswerForQuestion(session, questionCaptureId) {
  return sortedAnswersForQuestion(session, questionCaptureId)[0] || null;
}

function latestReviewReadyAnswerForQuestion(session, questionCaptureId) {
  return sortedAnswersForQuestion(session, questionCaptureId)
    .find((capture) => answerTextIsReviewReady(answerCaptureText(capture))) || null;
}

function sortedAnswersForQuestion(session, questionCaptureId) {
  return [...(session.captures || [])]
    .filter((capture) => cleanAnswerTargetId(capture.answersQuestionCaptureId) === questionCaptureId)
    .sort((a, b) => {
      const byTime = captureEventTime(b) - captureEventTime(a);
      if (byTime !== 0) return byTime;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });
}

function answerTextIsReviewReady(text) {
  const clean = cleanText(text, MAX_CAPTURE_TEXT_LENGTH);
  const wordCount = clean.split(/\s+/).filter(Boolean).length;
  return clean.length >= 12 && (wordCount >= 3 || /[\u4e00-\u9fff]/.test(clean));
}

function captureEventTime(capture) {
  const capturedTime = boundedTime(capture?.capturedAt);
  if (Number.isFinite(capturedTime)) return capturedTime;
  const createdTime = boundedTime(capture?.createdAt);
  return Number.isFinite(createdTime) ? createdTime : 0;
}

function answerCaptureTime(capture) {
  if (capture?.inboxPatchId) {
    const updatedTime = boundedTime(capture?.updatedAt);
    if (Number.isFinite(updatedTime)) return updatedTime;
  }
  return captureEventTime(capture);
}

export function setCaptureQuestionResolved(workspace, sessionId, captureId, resolved = true) {
  const timestamp = nowIso();
  let changed = false;
  const sessions = workspace.sessions.map((session) => {
    if (session.id !== sessionId) return session;
    let sessionChanged = false;
    const captures = session.captures.map((capture) => {
      if (capture.id !== captureId || !captureHasQuestion(capture)) return capture;
      if (Boolean(capture.questionResolvedAt) === Boolean(resolved)) return capture;
      sessionChanged = true;
      return {
        ...capture,
        questionResolvedAt: resolved ? timestamp : null,
        questionParkedAt: null,
        updatedAt: timestamp
      };
    });
    if (!sessionChanged) return session;
    changed = true;
    return {
      ...session,
      captures,
      updatedAt: timestamp
    };
  });
  return changed
    ? {
        ...workspace,
        updatedAt: timestamp,
        sessions
      }
    : workspace;
}

export function setCaptureQuestionParked(workspace, sessionId, captureId, parked = true) {
  const timestamp = nowIso();
  let changed = false;
  const sessions = workspace.sessions.map((session) => {
    if (session.id !== sessionId) return session;
    let sessionChanged = false;
    const captures = session.captures.map((capture) => {
      if (capture.id !== captureId || !captureHasQuestion(capture)) return capture;
      if (capture.questionResolvedAt && parked) return capture;
      if (Boolean(capture.questionParkedAt) === Boolean(parked)) return capture;
      sessionChanged = true;
      return {
        ...capture,
        questionResolvedAt: parked ? null : capture.questionResolvedAt || null,
        questionParkedAt: parked ? timestamp : null,
        updatedAt: timestamp
      };
    });
    if (!sessionChanged) return session;
    changed = true;
    return {
      ...session,
      captures,
      updatedAt: timestamp
    };
  });
  return changed
    ? {
        ...workspace,
        updatedAt: timestamp,
        sessions
      }
    : workspace;
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
        reviewCards: session.reviewCards
          .filter((card) => card.sourceCaptureId !== captureId)
          .map((card) => card.evidenceCaptureId === captureId
            ? { ...card, evidenceCaptureId: "", updatedAt: nowIso() }
            : card),
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

export function getOpenQuestionItems(workspace, limit = 6) {
  return workspace.sessions
    .flatMap((session) => session.captures
      .filter((capture) => captureHasOpenQuestion(capture))
      .map((capture) => ({
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

export function getParkedQuestionItems(workspace, limit = 6) {
  return workspace.sessions
    .flatMap((session) => session.captures
      .filter((capture) => captureHasParkedQuestion(capture))
      .map((capture) => ({
        sessionId: session.id,
        sessionTitle: session.title,
        capture,
        answerCapture: latestAnswerForQuestion(session, capture.id)
      })))
    .sort((a, b) => {
      const byParked = new Date(b.capture.questionParkedAt || b.capture.updatedAt).getTime()
        - new Date(a.capture.questionParkedAt || a.capture.updatedAt).getTime();
      if (byParked !== 0) return byParked;
      const byTime = new Date(b.capture.capturedAt || b.capture.createdAt).getTime()
        - new Date(a.capture.capturedAt || a.capture.createdAt).getTime();
      if (byTime !== 0) return byTime;
      const bySession = a.sessionTitle.localeCompare(b.sessionTitle);
      if (bySession !== 0) return bySession;
      return a.capture.id.localeCompare(b.capture.id);
    })
    .slice(0, Math.max(0, limit));
}

export function getResolvedQuestionItems(workspace, limit = 6, options = {}) {
  const sinceTime = boundedTime(options.since);
  const untilTime = boundedTime(options.until);
  return workspace.sessions
    .flatMap((session) => session.captures
      .filter((capture) => {
        if (!captureHasResolvedQuestion(capture)) return false;
        const resolvedTime = resolvedQuestionTime(capture);
        if (!Number.isFinite(resolvedTime)) return false;
        if (Number.isFinite(sinceTime) && resolvedTime < sinceTime) return false;
        if (Number.isFinite(untilTime) && resolvedTime >= untilTime) return false;
        return true;
      })
      .map((capture) => ({
        sessionId: session.id,
        sessionTitle: session.title,
        capture,
        answerCapture: latestAnswerForQuestion(session, capture.id)
      })))
    .sort((a, b) => {
      const byResolved = resolvedQuestionTime(b.capture) - resolvedQuestionTime(a.capture);
      if (byResolved !== 0) return byResolved;
      const byTime = new Date(b.capture.capturedAt || b.capture.createdAt).getTime()
        - new Date(a.capture.capturedAt || a.capture.createdAt).getTime();
      if (byTime !== 0) return byTime;
      const bySession = a.sessionTitle.localeCompare(b.sessionTitle);
      if (bySession !== 0) return bySession;
      return a.capture.id.localeCompare(b.capture.id);
    })
    .slice(0, Math.max(0, limit));
}

export function getAnswerCaptureItems(workspace, limit = 6, options = {}) {
  const sinceTime = boundedTime(options.since);
  const untilTime = boundedTime(options.until);
  return workspace.sessions
    .flatMap((session) => session.captures
      .filter((capture) => {
        if (!classifyAnswerCapture(capture).isAnswer) return false;
        const answerTime = answerCaptureTime(capture);
        if (!Number.isFinite(answerTime)) return false;
        if (Number.isFinite(sinceTime) && answerTime < sinceTime) return false;
        if (Number.isFinite(untilTime) && answerTime >= untilTime) return false;
        return true;
      })
      .map((capture) => ({
        sessionId: session.id,
        sessionTitle: session.title,
        capture,
        answerReason: classifyAnswerCapture(capture).reason,
        questionCapture: session.captures.find((item) => item.id === cleanAnswerTargetId(capture.answersQuestionCaptureId)) || null
      })))
    .sort((a, b) => {
      const byTime = answerCaptureTime(b.capture) - answerCaptureTime(a.capture);
      if (byTime !== 0) return byTime;
      const bySession = a.sessionTitle.localeCompare(b.sessionTitle);
      if (bySession !== 0) return bySession;
      return a.capture.id.localeCompare(b.capture.id);
    })
    .slice(0, Math.max(0, limit));
}

export function getStudyPackStats(workspace, now = new Date()) {
  const todayWindow = resolveTodayWindow(now);
  return {
    sessions: workspace.sessions.length,
    captures: workspace.sessions.reduce((sum, session) => sum + session.captures.length, 0),
    questions: workspace.sessions.reduce((sum, session) => (
      sum + session.captures.filter((capture) => captureHasOpenQuestion(capture)).length
    ), 0),
    parkedQuestions: workspace.sessions.reduce((sum, session) => (
      sum + session.captures.filter((capture) => captureHasParkedQuestion(capture)).length
    ), 0),
    resolvedQuestionsToday: getResolvedQuestionItems(workspace, Number.MAX_SAFE_INTEGER, {
      since: todayWindow.start,
      until: todayWindow.end
    }).length,
    answerCapturesToday: getAnswerCaptureItems(workspace, Number.MAX_SAFE_INTEGER, {
      since: todayWindow.start,
      until: todayWindow.end
    }).length,
    questionReviewCards: getQuestionReviewCardItems(workspace).length,
    questionReviewCardsToday: getQuestionReviewCardItems(workspace).filter((item) => {
      const createdTime = boundedTime(item.card.createdAt);
      return Number.isFinite(createdTime)
        && createdTime >= todayWindow.start.getTime()
        && createdTime < todayWindow.end.getTime();
    }).length,
    cards: workspace.sessions.reduce((sum, session) => sum + session.reviewCards.length, 0),
    due: getDueReviewItems(workspace, now).length
  };
}

function latestSessionCapture(session) {
  const captures = Array.isArray(session?.captures) ? [...session.captures] : [];
  return captures.sort((a, b) => {
    const byTime = new Date(b.capturedAt || b.createdAt).getTime() - new Date(a.capturedAt || a.createdAt).getTime();
    if (byTime !== 0) return byTime;
    return String(a.id || "").localeCompare(String(b.id || ""));
  })[0] || null;
}

export function buildResumeSource(session, timestampOverride = "", latestCaptureOverride = undefined) {
  const latestCapture = latestCaptureOverride === undefined ? latestSessionCapture(session) : latestCaptureOverride;
  const hasSessionSourceUrl = Boolean(cleanUrl(session?.sourceUrl || ""));
  const resumeSourceUrl = hasSessionSourceUrl ? session?.sourceUrl || "" : latestCapture?.sourceUrl || "";
  const resumeSourceTitle = session?.sourceTitle || latestCapture?.sourceTitle || "";
  const overrideTimestamp = cleanText(timestampOverride, 32);
  const resumeTimestamp = timestampToSeconds(overrideTimestamp) !== null ? overrideTimestamp : latestCapture?.timestamp || "";
  const hasResumeTimestamp = timestampToSeconds(resumeTimestamp) !== null;
  const sourceAnchorText = captureQuoteCanAnchorSource(latestCapture) ? latestCapture.quote : "";
  const textFragmentHref = hasResumeTimestamp ? "" : buildSourceTextFragmentUrl(resumeSourceUrl, sourceAnchorText);
  const sourceHref = hasResumeTimestamp
    ? buildSourceJumpUrl(resumeSourceUrl, resumeTimestamp)
    : textFragmentHref || buildSourceJumpUrl(resumeSourceUrl, resumeTimestamp);
  const sourceProvenance = hasSessionSourceUrl
    ? "session"
    : sourceHref ? "latest_capture_fallback" : "none";
  const materialType = MATERIAL_TYPES.has(session?.materialType)
    ? session.materialType
    : MATERIAL_TYPES.has(latestCapture?.materialType) ? latestCapture.materialType : "other";
  return {
    title: cleanText(resumeSourceTitle, MAX_TITLE_LENGTH),
    url: cleanUrl(resumeSourceUrl),
    href: sourceHref,
    provenance: sourceProvenance,
    timestamp: cleanText(resumeTimestamp, 32),
    materialType,
    hasTextFragment: Boolean(textFragmentHref),
    available: Boolean(sourceHref)
  };
}

export function buildFocusBrief(session, workspace = null, now = new Date()) {
  const date = Number.isFinite(now?.getTime?.()) ? now : new Date(now);
  const captures = Array.isArray(session?.captures) ? [...session.captures] : [];
  const reviewCards = Array.isArray(session?.reviewCards) ? session.reviewCards : [];
  const dueCards = getDueReviewCards({ ...session, reviewCards }, date);
  const workspaceDueCards = workspace ? getDueReviewItems(workspace, date).length : dueCards.length;
  const latestCapture = latestSessionCapture(session);
  const hasSynthesis = hasSynthesisBlock(session?.notesMarkdown);
  const synthesisStamp = getSynthesisBlockStamp(session?.notesMarkdown);
  const hasCurrentSynthesis = hasSynthesis && synthesisStamp && synthesisStamp === getSynthesisSourceStamp(session);
  const capturesSinceLastSynthesis = hasCurrentSynthesis ? 0 : captures.length;
  const source = buildResumeSource(session, "", latestCapture);
  const sourceHref = source.href;
  const questionCount = captures.filter((capture) => captureHasOpenQuestion(capture)).length;
  const minutesSinceLastCapture = latestCapture
    ? Math.max(0, Math.floor((date.getTime() - new Date(latestCapture.capturedAt || latestCapture.createdAt).getTime()) / 60000))
    : null;
  const hasRecentCapture = minutesSinceLastCapture !== null && minutesSinceLastCapture < FOCUS_BRIEF_CAPTURE_IDLE_MINUTES;
  const synthesisDue = isFocusSynthesisDue(capturesSinceLastSynthesis, hasCurrentSynthesis);
  const warnings = buildFocusBriefWarnings(session, capturesSinceLastSynthesis, synthesisDue, sourceHref, questionCount);

  return {
    schema: "learning-companion.focus-brief.v1",
    generatedAt: formatLocalIso(date),
    sessionId: cleanText(session?.id, 128),
    sessionTitle: cleanText(session?.title || "Untitled learning session", MAX_TITLE_LENGTH),
    source,
    stats: {
      captures: captures.length,
      cards: reviewCards.length,
      dueCards: dueCards.length,
      workspaceDueCards,
      capturesSinceLastSynthesis,
      questions: questionCount
    },
    latestCapture: latestCapture ? {
      id: cleanText(latestCapture.id, 128),
      summary: cleanText(latestCapture.thought || latestCapture.quote || "Untitled capture", 240),
      capturedAt: latestCapture.capturedAt || latestCapture.createdAt || "",
      timestamp: cleanText(latestCapture.timestamp, 32),
      sourceTitle: cleanText(latestCapture.sourceTitle || session?.sourceTitle || "", MAX_TITLE_LENGTH),
      sourceHref: buildSourceJumpUrl(latestCapture.sourceUrl || session?.sourceUrl || "", latestCapture.timestamp)
    } : null,
    warnings,
    nextAction: chooseFocusNextAction({
      dueCards: dueCards.length,
      workspaceDueCards,
      capturesSinceLastSynthesis,
      synthesisDue,
      hasCurrentSynthesis,
      sourceHref,
      hasRecentCapture
    })
  };
}

export function resolveCaptureDraftFocusOverride(brief, draft, now = new Date()) {
  const date = Number.isFinite(now?.getTime?.()) ? now : new Date(now);
  const updatedAt = new Date(draft?.updatedAt);
  const hasText = Boolean(String(draft?.quote || "").trim() || String(draft?.thought || "").trim());
  const ageMs = date.getTime() - updatedAt.getTime();
  const isFresh = hasText
    && Number.isFinite(updatedAt.getTime())
    && ageMs >= 0
    && ageMs <= CAPTURE_DRAFT_FOCUS_MAX_AGE_MS;
  const blockedByReview = brief?.nextAction?.kind === "review";
  return {
    schema: "learning-companion.capture-draft-focus.v1",
    shouldOverride: Boolean(isFresh && !blockedByReview),
    hasText,
    isFresh,
    blockedByReview,
    maxAgeHours: CAPTURE_DRAFT_FOCUS_MAX_AGE_MS / 60 / 60 / 1000
  };
}

export function buildTodayPack(workspace, now = new Date(), limits = {}) {
  const cleanWorkspace = sanitizeWorkspace(workspace);
  const dueLimit = Math.max(1, Number(limits.dueLimit) || 20);
  const questionLimit = Math.max(1, Number(limits.questionLimit) || 6);
  const parkedQuestionLimit = Math.max(1, Number(limits.parkedQuestionLimit) || 6);
  const resolvedQuestionLimit = Math.max(1, Number(limits.resolvedQuestionLimit) || 4);
  const answerLimit = Math.max(1, Number(limits.answerLimit) || 4);
  const recentLimit = Math.max(1, Number(limits.recentLimit) || 8);
  const sessionPaths = new Map(cleanWorkspace.sessions.map((session) => [session.id, getMirrorSessionPaths(session)]));
  const activeSession = getActiveSession(cleanWorkspace);
  const todayWindow = resolveTodayWindow(now);
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
  const questionAll = getOpenQuestionItems(cleanWorkspace, Number.MAX_SAFE_INTEGER).map((item) => ({
    ...item,
    sessionPath: sessionPaths.get(item.sessionId)?.markdownPath || ""
  }));
  const parkedQuestionAll = getParkedQuestionItems(cleanWorkspace, Number.MAX_SAFE_INTEGER).map((item) => ({
    ...item,
    sessionPath: sessionPaths.get(item.sessionId)?.markdownPath || ""
  }));
  const resolvedQuestionAll = getResolvedQuestionItems(cleanWorkspace, Number.MAX_SAFE_INTEGER, {
    since: todayWindow.start,
    until: todayWindow.end
  }).map((item) => ({
    ...item,
    sessionPath: sessionPaths.get(item.sessionId)?.markdownPath || ""
  }));
  const answerAll = getAnswerCaptureItems(cleanWorkspace, Number.MAX_SAFE_INTEGER, {
    since: todayWindow.start,
    until: todayWindow.end
  }).map((item) => ({
    ...item,
    sessionPath: sessionPaths.get(item.sessionId)?.markdownPath || ""
  }));
  const stats = getStudyPackStats(cleanWorkspace, now);
  const questionReviewAll = getQuestionReviewCardItems(cleanWorkspace).map((item) => ({
    ...item,
    sessionPath: sessionPaths.get(item.sessionId)?.markdownPath || ""
  }));
  return {
    generatedAt: formatLocalIso(now),
    reviewCutoff: formatLocalIso(now),
    localDayWindow: {
      start: todayWindow.startIso,
      end: todayWindow.endIso,
      label: todayWindow.label,
      timeZone: todayWindow.timeZone
    },
    recentDefinition: `latest ${recentLimit} captures by capturedAt`,
    questionDefinition: `latest ${questionLimit} open question captures by capturedAt`,
    parkedQuestionDefinition: `latest ${parkedQuestionLimit} parked question captures by parkedAt`,
    resolvedQuestionDefinition: `latest ${resolvedQuestionLimit} question captures resolved in ${todayWindow.label}`,
    answerDefinition: `latest ${answerLimit} answer captures in ${todayWindow.label}`,
    dueDefinition: "review cards with dueAt <= generatedAt",
    stats,
    questionHealth: buildQuestionQueueHealth(stats),
    questionLoop: buildQuestionLoopSummary(stats, resolvedQuestionAll, questionReviewAll),
    focusBrief: {
      ...buildFocusBrief(activeSession, cleanWorkspace, now),
      sessionPath: sessionPaths.get(activeSession.id)?.markdownPath || ""
    },
    dueItems: dueAll.slice(0, dueLimit),
    dueOverflow: Math.max(0, dueAll.length - dueLimit),
    questionItems: questionAll.slice(0, questionLimit),
    questionOverflow: Math.max(0, questionAll.length - questionLimit),
    parkedQuestionItems: parkedQuestionAll.slice(0, parkedQuestionLimit),
    parkedQuestionOverflow: Math.max(0, parkedQuestionAll.length - parkedQuestionLimit),
    resolvedQuestionItems: resolvedQuestionAll.slice(0, resolvedQuestionLimit),
    resolvedQuestionOverflow: Math.max(0, resolvedQuestionAll.length - resolvedQuestionLimit),
    answerItems: answerAll.slice(0, answerLimit),
    answerOverflow: Math.max(0, answerAll.length - answerLimit),
    recentCaptures: recentAll.slice(0, recentLimit),
    recentOverflow: Math.max(0, recentAll.length - recentLimit)
  };
}

function buildQuestionQueueHealth(stats) {
  const activeQuestions = Number(stats.questions) || 0;
  const parkedQuestions = Number(stats.parkedQuestions) || 0;
  const unresolvedQuestions = activeQuestions + parkedQuestions;
  if (activeQuestions > 0) {
    return {
      schema: "learning-companion.question-queue-health.v1",
      status: "active",
      label: `${formatCount(activeQuestions, "active question")} need closure`,
      detail: parkedQuestions
        ? `${formatCount(parkedQuestions, "parked question")} are waiting after the active queue.`
        : "No parked questions are waiting behind the active queue.",
      activeQuestions,
      parkedQuestions,
      unresolvedQuestions,
      targetSection: "open_questions"
    };
  }
  if (parkedQuestions > 0) {
    return {
      schema: "learning-companion.question-queue-health.v1",
      status: "parked_only",
      label: `${formatCount(parkedQuestions, "parked question")} waiting`,
      detail: "No active questions are interrupting focus; inspect parked follow-up when attention returns.",
      activeQuestions,
      parkedQuestions,
      unresolvedQuestions,
      targetSection: "parked_questions"
    };
  }
  return {
    schema: "learning-companion.question-queue-health.v1",
    status: "clear",
    label: "Question queue clear",
    detail: "No active or parked questions are waiting.",
    activeQuestions,
    parkedQuestions,
    unresolvedQuestions,
    targetSection: ""
  };
}

function buildQuestionLoopSummary(stats, resolvedQuestionItems = [], questionReviewItems = []) {
  const activeQuestions = Number(stats.questions) || 0;
  const parkedQuestions = Number(stats.parkedQuestions) || 0;
  const resolvedToday = Number(stats.resolvedQuestionsToday) || 0;
  const answeredToday = resolvedQuestionItems.filter((item) => item.answerCapture).length;
  const questionReviewCards = Number(stats.questionReviewCards) || questionReviewItems.length || 0;
  const questionReviewCardsToday = Number(stats.questionReviewCardsToday) || 0;
  const unresolvedQuestions = activeQuestions + parkedQuestions;
  // Active questions are the first jump target because they are already in the focus queue;
  // parked questions are next, and closed questions are only a review trail when no work is open.
  const targetSection = activeQuestions
    ? "open_questions"
    : parkedQuestions ? "parked_questions" : resolvedToday ? "closed_questions" : "";
  const label = activeQuestions
    ? "Question loop has active work"
    : parkedQuestions
      ? "Question loop has parked follow-up"
      : resolvedToday || questionReviewCardsToday
        ? "Question loop moved today"
        : "Question loop quiet";
  const todayDetail = [
    `${resolvedToday} closed today`,
    `${formatCount(answeredToday, "answer-linked closure")}`,
    `${formatCount(questionReviewCardsToday, "question card made today")}`
  ].join(" · ");
  const backlogDetail = [
    `${formatCount(unresolvedQuestions, "unresolved question")}`,
    `${activeQuestions} active`,
    `${parkedQuestions} parked`
  ].join(" · ");
  const lifetimeDetail = `${formatCount(questionReviewCards, "total question review card")}`;
  return {
    schema: "learning-companion.question-loop-summary.v1",
    activeQuestions,
    parkedQuestions,
    unresolvedQuestions,
    resolvedQuestionsToday: resolvedToday,
    answerLinkedResolvedToday: answeredToday,
    questionReviewCards,
    questionReviewCardsToday,
    label,
    todayDetail,
    backlogDetail,
    lifetimeDetail,
    targetSection
  };
}

function getQuestionReviewCardItems(workspace) {
  return workspace.sessions.flatMap((session) => {
    const capturesById = new Map(session.captures.map((capture) => [capture.id, capture]));
    return session.reviewCards
      .filter((card) => captureHasQuestion(capturesById.get(card.sourceCaptureId)))
      .map((card) => ({
        sessionId: session.id,
        sessionTitle: session.title,
        card,
        sourceCapture: capturesById.get(card.sourceCaptureId)
      }));
  });
}

export function filterSessions(workspace, query) {
  const needle = cleanText(query, MAX_SEARCH_QUERY_LENGTH).toLocaleLowerCase();
  if (!needle) return workspace.sessions;
  return workspace.sessions.filter((session) => {
    const haystack = [
      session.title,
      session.sourceTitle,
      session.sourceUrl,
      session.notesMarkdown,
      session.tags.join(" "),
      ...session.captures.flatMap((capture) => [capture.quote, capture.thought, capture.tags.join(" ")])
    ].join(" ").toLocaleLowerCase();
    return haystack.includes(needle);
  });
}

export function searchWorkspace(workspace, query, limit = 8) {
  const cleanWorkspace = sanitizeWorkspace(workspace);
  const needle = cleanText(query, MAX_SEARCH_QUERY_LENGTH).toLocaleLowerCase();
  const tokens = searchTokens(needle);
  if (!needle) return [];
  const results = [];

  cleanWorkspace.sessions.forEach((session) => {
    addSearchResult(results, needle, tokens, {
      type: "session",
      sessionId: session.id,
      targetId: session.id,
      title: session.title,
      meta: [session.sourceTitle || session.materialType, session.tags.map((tag) => `#${tag}`).join(" ")]
        .filter(Boolean)
        .join(" · "),
      fields: [
        { label: "Session", value: session.title, score: 70 },
        { label: "Source", value: session.sourceTitle, score: 62 },
        { label: "URL", value: session.sourceUrl, score: 50 },
        { label: "Tags", value: session.tags.join(" "), score: 48 },
        { label: "Type", value: session.materialType, score: 34 }
      ]
    });

    addSearchResult(results, needle, tokens, {
      type: "note",
      sessionId: session.id,
      targetId: "",
      title: `${session.title} notes`,
      meta: "Notes",
      fields: [
        { label: "Notes", value: session.notesMarkdown, score: 44 }
      ]
    });

    session.captures.forEach((capture) => {
      addSearchResult(results, needle, tokens, {
        type: "capture",
        sessionId: session.id,
        targetId: capture.id,
        title: capture.thought || capture.quote || capture.sourceTitle || "Untitled capture",
        meta: [session.title, capture.timestamp || "", "Capture"].filter(Boolean).join(" · "),
        fields: [
          { label: "Thought", value: capture.thought, score: 66 },
          { label: "Quote", value: capture.quote, score: 62 },
          { label: "Source", value: capture.sourceTitle, score: 44 },
          { label: "Tags", value: capture.tags.join(" "), score: 40 },
          { label: "Time", value: capture.timestamp, score: 34 }
        ]
      });
    });

    session.reviewCards.forEach((card) => {
      addSearchResult(results, needle, tokens, {
        type: "review",
        sessionId: session.id,
        targetId: card.id,
        title: card.prompt || "Review card",
        meta: [session.title, "Review card", `strength ${card.strength}`].join(" · "),
        fields: [
          { label: "Prompt", value: card.prompt, score: 58 },
          { label: "Answer", value: card.answer, score: 52 }
        ]
      });
    });
  });

  return results
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.title.localeCompare(b.title);
    })
    .slice(0, Math.max(1, Math.min(20, Number(limit) || 8)))
    .map(({ score, ...result }) => result);
}

export function generateMarkdown(session) {
  const sourceTitle = session.sourceTitle || "Untitled";
  const tagLine = session.tags.length ? session.tags.map((tag) => `#${tag}`).join(" ") : "";
  const lines = [
    `# ${session.title}`,
    "",
    "_中文：主题笔记_",
    "",
    `Source: ${sourceTitle}`,
    `来源：${sourceTitle}`,
    session.sourceUrl ? `URL: ${session.sourceUrl}` : "",
    session.sourceUrl ? `链接：${session.sourceUrl}` : "",
    `Type: ${session.materialType}`,
    `类型：${session.materialType}`,
    tagLine ? `Tags: ${tagLine}` : "",
    tagLine ? `标签：${tagLine}` : "",
    "",
    "## Notes",
    "_中文：笔记_",
    "",
    session.notesMarkdown || "_No notes yet._",
    session.notesMarkdown ? "" : "_还没有笔记。_",
    "",
    ...(session.videoBookmarks?.length ? [
      "## Video Bookmarks",
      "_中文：视频书签_",
      "",
      ...session.videoBookmarks.map((bookmark) => {
        const href = buildSourceJumpUrl(session.sourceUrl, bookmark.timestamp);
        const label = `${bookmark.timestamp} - ${bookmark.label}`;
        return href ? `- [${label}](${href})` : `- ${label}`;
      }),
      ""
    ] : []),
    "## Captures",
    "_中文：摘录_",
    ""
  ].filter((line) => line !== "");

  if (!session.captures.length) {
    lines.push("_No captures yet._");
    lines.push("_还没有摘录。_");
  } else {
    session.captures.forEach((capture) => {
      lines.push(`### ${formatDate(capture.createdAt)}${capture.timestamp ? ` @ ${capture.timestamp}` : ""}`);
      const captureSource = formatCaptureSource(capture, session);
      const captureSourceZh = formatCaptureSource(capture, session, "zh");
      if (captureSource) lines.push("", captureSource);
      if (captureSourceZh) lines.push(captureSourceZh);
      if (capture.quote) lines.push("", `> ${capture.quote.replace(/\n/g, "\n> ")}`);
      if (capture.thought) lines.push("", capture.thought);
      if (capture.tags.length) lines.push("", capture.tags.map((tag) => `#${tag}`).join(" "));
      lines.push("");
    });
  }

  if (session.reviewCards.length) {
    lines.push("", "## Review Cards", "_中文：复习卡片_", "");
    session.reviewCards.forEach((card) => {
      lines.push(`- Q: ${card.prompt}`);
      lines.push(`  问：${card.prompt}`);
      lines.push(`  A: ${card.answer.replace(/\n/g, " ")}`);
      lines.push(`  答：${card.answer.replace(/\n/g, " ")}`);
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
    `_中文：综合草稿 - ${title}_`,
    "",
    session.sourceTitle ? `Source: ${cleanText(session.sourceTitle, MAX_TITLE_LENGTH)}` : "",
    session.sourceTitle ? `来源：${cleanText(session.sourceTitle, MAX_TITLE_LENGTH)}` : "",
    session.sourceUrl ? `URL: ${cleanUrl(session.sourceUrl)}` : "",
    session.sourceUrl ? `链接：${cleanUrl(session.sourceUrl)}` : "",
    `Generated from ${formatCount(stats.captures, "capture")} / ${formatCount(stats.questions, "question")} / ${formatCount(stats.cards, "card")}.`,
    `生成自 ${formatCountZh(stats.captures, "条摘录")} / ${formatCountZh(stats.questions, "个问题")} / ${formatCountZh(stats.cards, "张卡片")}。`,
    "",
    "### Key Takeaways",
    "_中文：关键收获_",
    ""
  ].filter((line) => line !== "");

  if (!captures.length) {
    lines.push("- No captures yet. Add quotes or thoughts first.");
    lines.push("- 还没有摘录。先添加原文或想法。");
  } else {
    captures.slice(0, 8).forEach((capture) => {
      const point = cleanText(capture.thought || capture.quote, MAX_CAPTURE_TEXT_LENGTH);
      lines.push(`- ${point.replace(/\n+/g, " ").slice(0, 240)}`);
      if (capture.quote && capture.thought) {
        lines.push(`  - Evidence: ${cleanText(capture.quote, MAX_CAPTURE_TEXT_LENGTH).replace(/\n+/g, " ").slice(0, 180)}`);
        lines.push(`  - 证据：${cleanText(capture.quote, MAX_CAPTURE_TEXT_LENGTH).replace(/\n+/g, " ").slice(0, 180)}`);
      }
    });
  }

  lines.push("", "### Open Questions", "_中文：开放问题_", "");
  const questions = captures
    .filter((capture) => captureHasOpenQuestion(capture))
    .map((capture) => cleanText(capture.thought, MAX_CAPTURE_TEXT_LENGTH));
  if (questions.length) {
    questions.slice(0, 5).forEach((question) => lines.push(`- ${question}`));
  } else {
    lines.push("- What should I be able to recall without looking?");
    lines.push("- 不看资料时，我应该能回忆什么？");
    lines.push("- Which idea changes how I would solve a real problem?");
    lines.push("- 哪个想法会改变我解决真实问题的方式？");
  }

  lines.push("", "### Review Targets", "_中文：复习目标_", "");
  if (reviewCards.length) {
    reviewCards.slice(0, 6).forEach((card) => lines.push(`- ${cleanText(card.prompt, MAX_CAPTURE_TEXT_LENGTH)}`));
  } else {
    lines.push("- Promote the strongest captures into review cards.");
    lines.push("- 把最有价值的摘录提升为复习卡片。");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function generateTodayMarkdown(workspace, now = new Date()) {
  const pack = buildTodayPack(workspace, now);
  const { stats } = pack;
  const brief = pack.focusBrief;
  const nextAction = translateMirrorFocusNextAction(brief.nextAction);
  const lines = [
    "<!-- Generated from workspace.json. Edits will be overwritten. Source of truth: workspace.json -->",
    "",
    "# Today Study Pack",
    "_中文：今日学习包_",
    "",
    `Generated at: ${pack.generatedAt}`,
    `生成时间：${pack.generatedAt}`,
    `Local day window: [${pack.localDayWindow.start}, ${pack.localDayWindow.end})`,
    `本地日期窗口：[${pack.localDayWindow.start}, ${pack.localDayWindow.end})`,
    `Due rule: ${pack.dueDefinition}`,
    `到期规则：${pack.dueDefinition}`,
    `Open question rule: ${pack.questionDefinition}`,
    `开放问题规则：${pack.questionDefinition}`,
    `Parked question rule: ${pack.parkedQuestionDefinition}`,
    `暂存问题规则：${pack.parkedQuestionDefinition}`,
    `Closed today rule: ${pack.resolvedQuestionDefinition}`,
    `今日关闭规则：${pack.resolvedQuestionDefinition}`,
    `Answer rule: ${pack.answerDefinition}`,
    `回答规则：${pack.answerDefinition}`,
    `Recent rule: ${pack.recentDefinition}`,
    `最近摘录规则：${pack.recentDefinition}`,
    `Workspace: ${formatCount(stats.sessions, "session")} / ${formatCount(stats.captures, "capture")} / ${formatCount(stats.questions, "open question")} / ${formatCount(stats.parkedQuestions || 0, "parked question")} / ${stats.resolvedQuestionsToday || 0} closed today / ${stats.answerCapturesToday || 0} answers today / ${formatCount(stats.cards, "card")} / ${formatCount(stats.due, "due card")}`,
    `工作区：${stats.sessions} 个主题 / ${stats.captures} 条摘录 / ${stats.questions} 个开放问题 / ${stats.parkedQuestions || 0} 个暂存问题 / ${stats.resolvedQuestionsToday || 0} 个今日关闭 / ${stats.answerCapturesToday || 0} 个今日回答 / ${stats.cards} 张卡片 / ${stats.due} 张到期卡`,
    "",
    "## Resume Here",
    "_中文：从这里继续_",
    "",
    `- Session: ${markdownRelativeLink(brief.sessionTitle, brief.sessionPath)}`,
    `- 主题：${markdownRelativeLink(brief.sessionTitle, brief.sessionPath)}`,
    `- Next: ${markdownInline(brief.nextAction.label)} - ${markdownInline(brief.nextAction.detail)}`,
    `- 下一步：${markdownInline(nextAction.labelZh)} - ${markdownInline(nextAction.detailZh)}`,
    `- Why: ${markdownInline(brief.nextAction.reason)}`,
    `- 原因：${markdownInline(nextAction.reasonZh || brief.nextAction.reason)}`,
    brief.source.href
      ? `- Source: [${markdownInline(brief.source.title || "Open source")}](${brief.source.href})`
      : "- Source: _Add a source URL before the next export._",
    brief.source.href
      ? `- 来源：[${markdownInline(brief.source.title || "打开来源")}](${brief.source.href})`
      : "- 来源：_下次导出前请添加来源 URL。_",
    brief.latestCapture
      ? `- Latest capture: ${markdownInline(brief.latestCapture.summary)}${brief.latestCapture.timestamp ? ` @ ${markdownInline(brief.latestCapture.timestamp)}` : ""}`
      : "- Latest capture: _No captures yet._",
    brief.latestCapture
      ? `- 最新摘录：${markdownInline(brief.latestCapture.summary)}${brief.latestCapture.timestamp ? ` @ ${markdownInline(brief.latestCapture.timestamp)}` : ""}`
      : "- 最新摘录：_还没有摘录。_",
    "",
    "### Resume Signals",
    "_中文：继续信号_",
    ""
  ];

  if (brief.warnings.length) {
    brief.warnings.forEach((warning) => {
      const translated = translateMirrorFocusWarning(warning);
      lines.push(`- ${markdownInline(warning.label)} - ${markdownInline(warning.detail)}`);
      lines.push(`  - 中文：${markdownInline(translated.labelZh)} - ${markdownInline(translated.detailZh)}`);
    });
  } else {
    lines.push("- Session is ready to continue.");
    lines.push("- 主题已准备好继续。");
  }

  lines.push(
    "",
    "## Due Review",
    "_中文：到期复习_",
    ""
  );

  if (!pack.dueItems.length) {
    lines.push("_No cards are due right now._");
    lines.push("_现在没有到期卡片。_");
  } else {
    pack.dueItems.forEach(({ sessionTitle, sessionPath, card }) => {
      lines.push(`- ${markdownInline(card.prompt)} - ${markdownRelativeLink(sessionTitle, sessionPath)}`);
      lines.push(`  - Due: ${formatDate(card.dueAt)} · strength ${card.strength}`);
      lines.push(`  - 到期：${formatDate(card.dueAt)} · 强度 ${card.strength}`);
    });
    if (pack.dueOverflow) {
      lines.push(`- +${pack.dueOverflow} more due cards in workspace.json`);
      lines.push(`- workspace.json 中还有 ${pack.dueOverflow} 张到期卡`);
    }
  }

  lines.push(
    "",
    "## Question Queue Health",
    "_中文：问题队列健康度_",
    "",
    `- ${markdownInline(pack.questionHealth.label)} - ${markdownInline(pack.questionHealth.detail)}`,
    `- Active: ${pack.questionHealth.activeQuestions} · Parked: ${pack.questionHealth.parkedQuestions} · Unresolved: ${pack.questionHealth.unresolvedQuestions}`,
    `- 活跃：${pack.questionHealth.activeQuestions} · 暂存：${pack.questionHealth.parkedQuestions} · 未解决：${pack.questionHealth.unresolvedQuestions}`,
    ""
  );

  lines.push(
    "",
    "## Question Loop",
    "_中文：问题闭环_",
    "",
    "_Today metrics use the local day window; lifetime card totals span the workspace history._",
    "_今日指标使用本地日期窗口；生命周期卡片总数覆盖整个工作区历史。_",
    `- ${markdownInline(pack.questionLoop.label)}`,
    `- Today: ${markdownInline(pack.questionLoop.todayDetail)}`,
    `- 今日：${stats.resolvedQuestionsToday || 0} 个问题已关闭 · ${stats.answerCapturesToday || 0} 个回答已捕获`,
    `- Backlog: ${markdownInline(pack.questionLoop.backlogDetail)}`,
    `- 积压：${stats.questions} 个开放问题 · ${stats.parkedQuestions || 0} 个暂存问题`,
    `- Lifetime: ${markdownInline(pack.questionLoop.lifetimeDetail)}`,
    `- 全部历史：${stats.cards} 张复习卡`,
    ""
  );

  lines.push(
    "",
    "## Open Questions",
    "_中文：开放问题_",
    "",
    "_Questions can also appear under Recent Captures; this section keeps unresolved study questions easy to scan._",
    "_问题也可能出现在最近摘录里；本节让未解决的学习问题更容易扫描。_",
    ""
  );
  if (!pack.questionItems.length) {
    lines.push("_No open questions captured yet._");
    lines.push("_还没有捕获开放问题。_");
  } else {
    pack.questionItems.forEach(({ sessionTitle, sessionPath, capture }) => {
      const question = markdownInline(capture.thought || capture.quote || "Untitled question");
      lines.push(`- ${question} - ${markdownRelativeLink(sessionTitle, sessionPath)}`);
      const source = buildSourceJumpUrl(capture.sourceUrl, capture.timestamp);
      if (source) {
        lines.push(`  - Source: [${markdownInline(capture.sourceTitle || "Open source")}](${source})${capture.timestamp ? ` @ ${markdownInline(capture.timestamp)}` : ""}`);
        lines.push(`  - 来源：[${markdownInline(capture.sourceTitle || "打开来源")}](${source})${capture.timestamp ? ` @ ${markdownInline(capture.timestamp)}` : ""}`);
      } else if (capture.sourceTitle) {
        lines.push(`  - Source: ${markdownInline(capture.sourceTitle)}`);
        lines.push(`  - 来源：${markdownInline(capture.sourceTitle)}`);
      }
      if (capture.tags.length) {
        lines.push(`  - Tags: ${capture.tags.map((tag) => `#${markdownInline(tag)}`).join(" ")}`);
        lines.push(`  - 标签：${capture.tags.map((tag) => `#${markdownInline(tag)}`).join(" ")}`);
      }
    });
    if (pack.questionOverflow) {
      lines.push(`- +${pack.questionOverflow} more open questions in workspace.json`);
      lines.push(`- workspace.json 中还有 ${pack.questionOverflow} 个开放问题`);
    }
  }

  lines.push(
    "",
    "## Parked Questions",
    "_中文：暂存问题_",
    "",
    "_Parked questions are unresolved, but they are intentionally out of the active focus queue._",
    "_暂存问题尚未解决，但已被有意移出当前焦点队列。_",
    ""
  );
  if (!pack.parkedQuestionItems.length) {
    lines.push("_No parked questions._");
    lines.push("_没有暂存问题。_");
  } else {
    pack.parkedQuestionItems.forEach(({ sessionTitle, sessionPath, capture }) => {
      const question = markdownInline(capture.thought || capture.quote || "Untitled question");
      const parkedAt = capture.questionParkedAt ? ` · parked ${formatDate(capture.questionParkedAt)}` : "";
      lines.push(`- ${question} - ${markdownRelativeLink(sessionTitle, sessionPath)}${parkedAt}`);
      if (capture.questionParkedAt) lines.push(`  - 暂存：${formatDate(capture.questionParkedAt)}`);
    });
    if (pack.parkedQuestionOverflow) {
      lines.push(`- +${pack.parkedQuestionOverflow} more parked questions in workspace.json`);
      lines.push(`- workspace.json 中还有 ${pack.parkedQuestionOverflow} 个暂存问题`);
    }
  }

  lines.push(
    "",
    "## Answers Today",
    "_中文：今日回答_",
    "",
    "_Answer captures stay visible here even when they are not linked to a closed question._",
    "_即使回答摘录没有关联到已关闭问题，也会在这里保持可见。_",
    ""
  );
  if (!pack.answerItems.length) {
    lines.push("_No answers captured today._");
    lines.push("_今天还没有捕获回答。_");
  } else {
    pack.answerItems.forEach(({ sessionTitle, sessionPath, capture, questionCapture, answerReason }) => {
      lines.push(`- ${markdownInline(answerCaptureText(capture) || capture.quote || "Untitled answer")} - ${markdownRelativeLink(sessionTitle, sessionPath)}`);
      if (answerReason) {
        lines.push(`  - Reason: ${markdownInline(answerReason)}`);
        lines.push(`  - 原因：${markdownInline(answerReason)}`);
      }
      if (questionCapture) {
        lines.push(`  - Answers: ${markdownInline(reviewQuestionText(questionCapture) || "linked question")}`);
        lines.push(`  - 回答问题：${markdownInline(reviewQuestionText(questionCapture) || "关联问题")}`);
      }
      const source = buildSourceJumpUrl(capture.sourceUrl, capture.timestamp);
      if (source) {
        lines.push(`  - Source: [${markdownInline(capture.sourceTitle || "Open source")}](${source})${capture.timestamp ? ` @ ${markdownInline(capture.timestamp)}` : ""}`);
        lines.push(`  - 来源：[${markdownInline(capture.sourceTitle || "打开来源")}](${source})${capture.timestamp ? ` @ ${markdownInline(capture.timestamp)}` : ""}`);
      }
    });
    if (pack.answerOverflow) {
      lines.push(`- +${pack.answerOverflow} more answers captured today in workspace.json`);
      lines.push(`- workspace.json 中还有 ${pack.answerOverflow} 个今日回答`);
    }
  }

  lines.push(
    "",
    "## Closed Today",
    "_中文：今日关闭_",
    "",
    `_Questions resolved in ${markdownInline(pack.localDayWindow.label)} stay visible here as a closure trail._`,
    `_在 ${markdownInline(pack.localDayWindow.label)} 解决的问题会留在这里，作为闭环轨迹。_`,
    ""
  );
  if (!pack.resolvedQuestionItems.length) {
    lines.push("_No questions closed today._");
    lines.push("_今天还没有关闭问题。_");
  } else {
    pack.resolvedQuestionItems.forEach(({ sessionTitle, sessionPath, capture, answerCapture }) => {
      const question = markdownInline(capture.thought || capture.quote || "Untitled question");
      const closedAt = capture.questionResolvedAt ? ` · closed ${formatDate(capture.questionResolvedAt)}` : "";
      lines.push(`- ${question} - ${markdownRelativeLink(sessionTitle, sessionPath)}${closedAt}`);
      if (capture.questionResolvedAt) lines.push(`  - 关闭：${formatDate(capture.questionResolvedAt)}`);
      if (answerCapture) {
        lines.push(`  - Answer: ${markdownInline(answerCaptureText(answerCapture) || "Linked answer capture")}`);
        lines.push(`  - 回答：${markdownInline(answerCaptureText(answerCapture) || "关联回答摘录")}`);
      }
    });
    if (pack.resolvedQuestionOverflow) {
      lines.push(`- +${pack.resolvedQuestionOverflow} more questions closed today in workspace.json`);
      lines.push(`- workspace.json 中还有 ${pack.resolvedQuestionOverflow} 个今日关闭问题`);
    }
  }

  lines.push("", "## Recent Captures", "_中文：最近摘录_", "");
  if (!pack.recentCaptures.length) {
    lines.push("_No captures yet._");
    lines.push("_还没有摘录。_");
  } else {
    pack.recentCaptures.forEach(({ sessionTitle, sessionPath, capture }) => {
      const summary = markdownInline(capture.thought || capture.quote || "Untitled capture");
      lines.push(`- ${summary} - ${markdownRelativeLink(sessionTitle, sessionPath)}`);
      const source = buildSourceJumpUrl(capture.sourceUrl, capture.timestamp);
      if (source) {
        lines.push(`  - Source: [${markdownInline(capture.sourceTitle || "Open source")}](${source})${capture.timestamp ? ` @ ${markdownInline(capture.timestamp)}` : ""}`);
        lines.push(`  - 来源：[${markdownInline(capture.sourceTitle || "打开来源")}](${source})${capture.timestamp ? ` @ ${markdownInline(capture.timestamp)}` : ""}`);
      } else if (capture.sourceTitle) {
        lines.push(`  - Source: ${markdownInline(capture.sourceTitle)}`);
        lines.push(`  - 来源：${markdownInline(capture.sourceTitle)}`);
      }
      if (capture.tags.length) {
        lines.push(`  - Tags: ${capture.tags.map((tag) => `#${markdownInline(tag)}`).join(" ")}`);
        lines.push(`  - 标签：${capture.tags.map((tag) => `#${markdownInline(tag)}`).join(" ")}`);
      }
    });
    if (pack.recentOverflow) {
      lines.push(`- +${pack.recentOverflow} more captures in workspace.json`);
      lines.push(`- workspace.json 中还有 ${pack.recentOverflow} 条摘录`);
    }
  }

  lines.push(
    "",
    "## Notes",
    "_中文：说明_",
    "",
    "- `workspace.json` remains the canonical restore payload.",
    "- `workspace.json` 仍然是规范恢复载荷。",
    "- This file is a readable derived study index for Feishu Drive, Windows, and mobile review.",
    "- 此文件是供飞书云文档、Windows 和移动端复习阅读的派生学习索引。"
  );

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function generateReviewPackMarkdown(workspaceData) {
  const safeWorkspace = sanitizeWorkspace(workspaceData);
  const active = getActiveSession(safeWorkspace);
  const mirror = buildMirrorBundle(safeWorkspace);
  const due = getDueReviewItems(safeWorkspace);
  const captures = safeWorkspace.sessions.reduce((sum, session) => sum + session.captures.length, 0);
  const cards = safeWorkspace.sessions.reduce((sum, session) => sum + session.reviewCards.length, 0);
  const focusBrief = buildFocusBrief(active, safeWorkspace);
  const focusAction = translateMirrorFocusNextAction(focusBrief.nextAction);
  const focusReason = focusBrief.nextAction.reason || "No focus reason available.";
  return [
    "# Learning Companion Review Pack",
    "_中文：学习伴侣复习包_",
    "",
    "> Scope: local MVP fixture/internal build. This does not prove live Feishu sync, HarmonyOS device behavior, or signed Mac packaging.",
    "> 中文范围：本地 MVP fixture / 内部构建。它不能证明飞书实时同步、HarmonyOS 真机行为或已签名 Mac 包。",
    "",
    "## Workspace",
    "_中文：工作区_",
    "",
    `- Sessions: ${safeWorkspace.sessions.length}`,
    `- 主题数：${safeWorkspace.sessions.length}`,
    `- Captures: ${captures}`,
    `- 摘录数：${captures}`,
    `- Review cards: ${cards}`,
    `- 复习卡片：${cards}`,
    `- Due now: ${due.length}`,
    `- 当前到期：${due.length}`,
    `- Active topic: ${active.title}`,
    `- 当前主题：${active.title}`,
    `- Next action: ${focusBrief.nextAction.label}`,
    `- 下一步：${focusAction.labelZh}`,
    `- Why: ${focusReason}`,
    `- 原因：${focusAction.reasonZh || focusReason}`,
    "",
    "## Export Artifacts",
    "_中文：导出产物_",
    "",
    `- Workspace restore: \`learning-companion-workspace.json\` (${safeWorkspace.sessions.length} sessions)`,
    `- 工作区恢复：\`learning-companion-workspace.json\`（${safeWorkspace.sessions.length} 个主题）`,
    `- Mirror bundle: \`learning-companion-mirror.json\` (${mirror.manifest.fileCount} files, ${mirror.manifest.bundleFingerprint})`,
    `- 镜像包：\`learning-companion-mirror.json\`（${mirror.manifest.fileCount} 个文件，${mirror.manifest.bundleFingerprint}）`,
    "- Mirror ZIP: `learning-companion-mirror.zip` (manual folder package)",
    "- 镜像 ZIP：`learning-companion-mirror.zip`（手动文件夹包）",
    "- Today pack: `TODAY.md`",
    "- 今日学习包：`TODAY.md`",
    "- Current session Markdown and `.feishu.json` sidecar",
    "- 当前主题 Markdown 和 `.feishu.json` sidecar",
    "",
    "## Stage Wording",
    "_中文：阶段措辞_",
    "",
    "- Mac: internal WKWebView shell, not signed production app.",
    "- Mac：内部 WKWebView shell，不是已签名生产应用。",
    "- Feishu: local mirror bundle plus upload plan/dry-run boundary, not live sync.",
    "- 飞书：本地镜像包加上传计划 / dry-run 边界，不是实时同步。",
    "- HarmonyOS: schema reader prototype, not device-verified app.",
    "- HarmonyOS：schema reader 原型，不是真机验证应用。",
    "",
    "## Morning Commands",
    "_中文：Morning 命令_",
    "",
    "Offline headline gate:",
    "离线 headline gate：",
    "",
    "```bash",
    "npm run check:morning",
    "npm run demo:morning",
    "```",
    "",
    "Separate permissioned gates:",
    "需要单独授权的 gate：",
    "",
    "```bash",
    "npm run check:morning:native",
    "npm run check:morning:browser",
    "```",
    "",
    "## Promotion Gates",
    "_中文：推广 gate_",
    "",
    "- Mac dogfood: run sidecar, clipboard capture, selected-text capture, browser context, import/export, and relaunch manual QA.",
    "- Mac dogfood：运行 sidecar、剪贴板摘录、选中文本摘录、浏览器上下文、导入/导出和重启手动 QA。",
    "- Feishu live writer: configure credentials explicitly, set Drive folder target, then compare upload report against dry-run report.",
    "- 飞书 live writer：显式配置凭证，设置云文档文件夹目标，然后将上传报告与 dry-run 报告对比。",
    "- HarmonyOS app: import workspace or mirror bundle on device, render reader view, export append-only inbox/review patches.",
    "- HarmonyOS 应用：在设备上导入工作区或镜像包，渲染 reader view，并导出 append-only 收件箱/复习 patch。",
    ""
  ].join("\n");
}

function returnReadyBadgeCss() {
  return [
    "    .return-ready-badge { display: grid; gap: 4px; padding: 10px 12px; border: 1px solid #b9d7cb; border-radius: 8px; background: #f0faf5; }",
    "    .return-ready-badge strong { color: #2f6f5e; }",
    "    .return-ready-badge span { color: #4b5358; font-size: 13px; line-height: 1.4; }"
  ];
}

function staticMirrorI18nCss() {
  return [
    "    .mirror-language-radio { position: absolute; opacity: 0; pointer-events: none; }",
    "    .mirror-language-switch { max-width: 860px; margin: 0 auto 12px; display: flex; gap: 8px; justify-content: flex-end; }",
    "    .mirror-language-switch label { display: inline-flex; min-height: 34px; align-items: center; padding: 6px 10px; border: 1px solid #dcd8cc; border-radius: 8px; background: #fff; color: #315f82; font-size: 13px; font-weight: 700; cursor: pointer; }",
    "    #mirrorLangEn:checked ~ .mirror-language-switch label[for='mirrorLangEn'], #mirrorLangZh:checked ~ .mirror-language-switch label[for='mirrorLangZh'] { border-color: #2f6f5e; background: #e7f1ec; color: #202124; }",
    "    .i18n-zh { display: none; }",
    "    #mirrorLangZh:checked ~ main .i18n-en, #mirrorLangZh:checked ~ .mirror-language-switch .i18n-en { display: none; }",
    "    #mirrorLangZh:checked ~ main .i18n-zh, #mirrorLangZh:checked ~ .mirror-language-switch .i18n-zh { display: inline; }",
    "    #mirrorLangEn:checked ~ main .i18n-zh, #mirrorLangEn:checked ~ .mirror-language-switch .i18n-zh { display: none; }"
  ];
}

function staticMirrorLanguageToggleHtml() {
  return [
    "  <input class=\"mirror-language-radio\" id=\"mirrorLangEn\" name=\"mirrorLanguage\" type=\"radio\" checked>",
    "  <input class=\"mirror-language-radio\" id=\"mirrorLangZh\" name=\"mirrorLanguage\" type=\"radio\">",
    "  <div class=\"mirror-language-switch\" role=\"group\" aria-label=\"Language / 语言\">",
    "    <label for=\"mirrorLangEn\">English</label>",
    "    <label for=\"mirrorLangZh\">中文</label>",
    "  </div>"
  ];
}

function i18nText(en, zh) {
  return `<span class="i18n-en">${htmlText(en)}</span><span class="i18n-zh" lang="zh-CN">${htmlText(zh)}</span>`;
}

function staticRuntimeI18nScriptLines() {
  return [
    "    function escapeRuntimeHtml(value) { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;'); }",
    "    function normalizeRuntimeI18n(en, zh) { if (en && typeof en === 'object') return { en: String(en.en || ''), zh: String(en.zh || en.en || '') }; return { en: String(en || ''), zh: String(zh || en || '') }; }",
    "    function i18nRuntimeHtml(en, zh) { const pair = normalizeRuntimeI18n(en, zh); return `<span class=\"i18n-en\">${escapeRuntimeHtml(pair.en)}</span><span class=\"i18n-zh\" lang=\"zh-CN\">${escapeRuntimeHtml(pair.zh)}</span>`; }",
    "    function setI18nHtml(node, en, zh) { if (node) node.innerHTML = i18nRuntimeHtml(en, zh); }",
    "    function i18nRuntimeText(en, zh) { const pair = normalizeRuntimeI18n(en, zh); return document.querySelector('#mirrorLangZh')?.checked ? pair.zh : pair.en; }",
    "    function setI18nPlaceholder(node, en, zh) { if (node) node.placeholder = i18nRuntimeText(en, zh); }",
    "    function appendRuntimeI18n(message, enSuffix, zhSuffix) { const pair = normalizeRuntimeI18n(message); return { en: `${pair.en}${enSuffix}`, zh: `${pair.zh}${zhSuffix || enSuffix}` }; }"
  ];
}

function returnReadyBadgeHtml({ bilingual = false } = {}) {
  const title = bilingual
    ? i18nText("Return-ready mirror", "可返回的镜像")
    : htmlText("Return-ready mirror");
  const detail = bilingual
    ? i18nText("Review and Inbox return files from this mirror include the Mac return-base check via source.returnBaseFingerprint. Static mirror only; no live sync.", "这个镜像中的复习和收件箱返回文件会包含 Mac 返回基线检查 source.returnBaseFingerprint。仅静态镜像；无实时同步。")
    : htmlText("Review and Inbox return files from this mirror include the Mac return-base check via source.returnBaseFingerprint. Static mirror only; no live sync.");
  return [
    "    <section class=\"return-ready-badge\" aria-label=\"Return-ready mirror\">",
    `      <strong>${title}</strong>`,
    `      <span>${detail}</span>`,
    "    </section>"
  ];
}

function staticNoScriptHtml() {
  return [
    "    <noscript>",
    "      <section class=\"panel\" role=\"alert\">",
    "        <h2>JavaScript required for return files</h2>",
    "        <p class=\"summary\">This mirror remains readable, but Review and Inbox return files need JavaScript. If this message stays visible, open the mirror in a browser that allows local file scripts or continue in the Mac app.</p>",
    "      </section>",
    "    </noscript>"
  ];
}

function mirrorFirstNumber(value) {
  return cleanText(value, MAX_TITLE_LENGTH).match(/\d+/)?.[0] || "";
}

function translateMirrorFocusNextAction(action = {}) {
  const count = mirrorFirstNumber(action.label) || mirrorFirstNumber(action.detail);
  switch (action.kind) {
    case "review": {
      const workspace = cleanText(action.label, MAX_TITLE_LENGTH).includes("workspace");
      return {
        ...action,
        labelZh: count ? `复习 ${count} 张${workspace ? "工作区" : ""}到期卡片` : "复习到期卡片",
        detailZh: workspace
          ? "其他主题也有到期卡；队列会按最早到期和主题标题排序。"
          : "先揭示并评分，再加入更多材料。",
        reasonZh: workspace ? "工作区复习债务优先于添加新材料。" : "当前主题有现在到期的复习。"
      };
    }
    case "synthesize":
      return {
        ...action,
        labelZh: "构建综合",
        detailZh: count ? `${count} 条摘录可以压缩进笔记。` : "摘录可以压缩进笔记。",
        reasonZh: "未综合摘录已达到压缩阈值。"
      };
    case "capture":
      return {
        ...action,
        labelZh: "摘录下一个要点",
        detailZh: `最近 ${FOCUS_BRIEF_CAPTURE_IDLE_MINUTES} 分钟没有新增摘录。`,
        reasonZh: "来源可用，但这个主题已经安静了一段时间。"
      };
    case "continue":
      return {
        ...action,
        labelZh: "继续阅读",
        detailZh: "来源已打开；摘录下一个能改变你理解的想法。",
        reasonZh: "已有最近摘录，所以现在最适合继续阅读。"
      };
    case "open_source":
      return {
        ...action,
        labelZh: "添加来源",
        detailZh: "继续摘录前先粘贴浏览器 URL。",
        reasonZh: "缺少来源上下文，之后很难回到材料。"
      };
    default:
      return {
        ...action,
        labelZh: action.label || "",
        detailZh: action.detail || "",
        reasonZh: action.reason || ""
      };
  }
}

function translateMirrorFocusWarning(warning = {}) {
  const count = mirrorFirstNumber(warning.label) || mirrorFirstNumber(warning.detail);
  switch (warning.kind) {
    case "missing_source":
      return {
        ...warning,
        labelZh: "缺少来源",
        detailZh: "添加浏览器 URL，摘录才能跳回材料。"
      };
    case "notes_empty":
      return {
        ...warning,
        labelZh: "笔记为空",
        detailZh: "结束主题前，至少把一条摘录整理进笔记。"
      };
    case "open_questions":
      return {
        ...warning,
        labelZh: count ? `${count} 个开放问题` : "开放问题",
        detailZh: "已捕获的问题会先停在综合或复习队列里，之后再闭环。"
      };
    case "needs_synthesis":
      return {
        ...warning,
        labelZh: "需要综合",
        detailZh: count ? `${count} 条摘录正在等待综合块。` : "摘录正在等待综合块。"
      };
    default:
      return {
        ...warning,
        labelZh: warning.label || "",
        detailZh: warning.detail || ""
      };
  }
}

function returnAfterSaveCss() {
  return [
    "    .return-after-save { display: grid; gap: 4px; padding: 10px 12px; border: 1px solid #b9d7cb; border-radius: 8px; background: #f0faf5; }",
    "    .return-after-save strong { color: #2f6f5e; }",
    "    .return-after-save span { color: #4b5358; font-size: 13px; line-height: 1.4; white-space: pre-line; }",
    "    .return-after-save a { color: #315f82; font-size: 13px; font-weight: 700; }"
  ];
}

const RETURN_FILE_TRANSPORT_HINT = [
  "Move it to Mac, then import or paste it from Today > Return Files.",
  "",
  "If a file was saved: Windows - check Downloads; HarmonyOS phone - check the Files app's Downloads folder; other browsers - check the browser's default download folder.",
  "",
  "If no file was created: use Copy or Manual Copy, paste the return JSON into a trusted note, email, or message, then move it to Mac.",
  "",
  "Manual carriers after you have the JSON: AirDrop, USB, file share, email, or Feishu Drive; no live sync."
].join("\n");

const RETURN_FILE_TRANSPORT_HINT_ZH = [
  "把它带回 Mac，然后从今日 > 返回文件导入或粘贴。",
  "",
  "如果已经保存文件：Windows 请检查下载目录；HarmonyOS 手机请检查文件应用的下载目录；其他浏览器请检查浏览器默认下载目录。",
  "",
  "如果没有生成文件：使用复制或手动复制，把返回 JSON 粘贴到可信的笔记、邮件或消息里，再带回 Mac。",
  "",
  "拿到 JSON 后可用的手动载体：AirDrop、USB、文件共享、邮件或飞书云文档；没有实时同步。"
].join("\n");

function returnAfterSaveHtml() {
  return [
    "      <div id=\"returnAfterSave\" class=\"return-after-save\" role=\"status\" aria-live=\"polite\" hidden>",
    `        <strong>${i18nText("Next: send this return file back to your Mac", "下一步：把这个返回文件发回你的 Mac")}</strong>`,
    `        <span id="returnAfterSaveText">${i18nText(RETURN_FILE_TRANSPORT_HINT, RETURN_FILE_TRANSPORT_HINT_ZH)}</span>`,
    "        <a id=\"returnAfterSaveFollowup\" hidden></a>",
    "      </div>"
  ];
}

function buildReviewReturnFollowup(pack) {
  if (!pack.dueItems.length || !pack.questionItems.length) return null;
  const item = pack.questionItems[0];
  return {
    label: `Answer ${formatCount(pack.stats.questions, "open question")}`,
    labelZh: `回答 ${pack.stats.questions} 个开放问题`,
    href: buildInboxAnswerHref(item.sessionId, item.capture),
    detail: "This mirror also has open questions. Save this review return file, then open Inbox if you want to answer one before moving files back to Mac.",
    detailZh: "这个镜像里还有开放问题。先保存复习返回文件；如果想在把文件带回 Mac 前回答一个问题，再打开收件箱。"
  };
}

function buildInboxReturnFollowup(pack) {
  if (!pack.dueItems.length) return null;
  return {
    label: `Review ${formatCount(pack.stats.due, "due card")}`,
    labelZh: `复习 ${pack.stats.due} 张到期卡片`,
    href: "review.html",
    detail: "This mirror also has due review. Save this inbox return file, then open Review if you want to finish the exported queue before moving files back to Mac.",
    detailZh: "这个镜像里还有到期复习。先保存收件箱返回文件；如果想在把文件带回 Mac 前完成导出的队列，再打开复习。"
  };
}

export function generateReviewHtml(workspace, now = new Date()) {
  const cleanWorkspace = sanitizeWorkspace(workspace);
  const workspaceJson = JSON.stringify(cleanWorkspace, null, 2);
  const workspaceFingerprint = fingerprintText(workspaceJson);
  const returnBaseFingerprint = buildReturnBaseFingerprint(cleanWorkspace);
  const pack = buildTodayPack(cleanWorkspace, now, { dueLimit: 50, recentLimit: 1 });
  const followup = buildReviewReturnFollowup(pack);
  const seed = JSON.stringify({
    schema: "learning-companion.review-progress-seed.v1",
    appVersion: WORKSPACE_SCHEMA_VERSION,
    generatedAt: pack.generatedAt,
    workspaceFingerprint,
    returnBaseFingerprint,
    followup,
    cards: pack.dueItems.map(({ sessionId, sessionTitle, card }) => ({
      sessionId,
      sessionTitle,
      cardId: card.id,
      baseUpdatedAt: card.updatedAt || card.createdAt || "",
      baseDueAt: card.dueAt,
      baseStrength: card.strength
    }))
  }).replace(/</g, "\\u003c");
  const cards = pack.dueItems.map(({ sessionId, sessionTitle, sessionPath, card }) => {
    const cardKey = `${sessionId}::${card.id}`;
    const safeSessionPath = isSafeMirrorSessionPath(sessionPath) ? sessionPath : "";
    const sessionLink = safeSessionPath
      ? `<a href="${htmlAttribute(sessionPath)}">${htmlText(sessionTitle)}</a>`
      : htmlText(sessionTitle);
    return [
      `<article class="card" data-card-key="${htmlAttribute(cardKey)}">`,
      `  <div class="meta">${sessionLink} · ${i18nText(`Due ${formatDate(card.dueAt)}`, `到期 ${formatDate(card.dueAt)}`)} · ${i18nText(`strength ${card.strength}`, `强度 ${card.strength}`)}</div>`,
      `  <h2>${htmlText(card.prompt)}</h2>`,
      `  <button type="button" data-reveal aria-expanded="false">${i18nText("Reveal", "揭示")}</button>`,
      `  <div class="answer" hidden>${htmlMultiline(card.answer)}</div>`,
      '  <div class="grade-actions" hidden>',
      `    <button type="button" data-grade="again">${i18nText("Again", "再练")}</button>`,
      `    <button type="button" data-grade="good">${i18nText("Good", "通过")}</button>`,
      '    <span class="review-state" aria-live="polite"></span>',
      "  </div>",
      "</article>"
    ].join("\n");
  });

  const empty = `<p class="empty">${i18nText("No cards are due right now.", "现在没有到期卡片。")}</p>`;
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
    `  <meta name="learning-companion-return-base-fingerprint" content="${htmlAttribute(returnBaseFingerprint)}">`,
    `  <meta name="learning-companion-generated-at" content="${htmlAttribute(pack.generatedAt)}">`,
    "  <title>Learning Companion Review Pack</title>",
    "  <style>",
    "    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f6f0; color: #202124; }",
    "    body { margin: 0; padding: 18px; }",
    "    main { max-width: 760px; margin: 0 auto; }",
    "    header { margin-bottom: 16px; }",
    "    h1 { margin: 0 0 6px; font-size: 24px; }",
    "    h2 { margin: 0; font-size: 17px; line-height: 1.35; }",
    "    h3 { margin: 0; font-size: 14px; }",
    "    .summary, .meta, .empty, output { color: #697077; font-size: 13px; }",
    "    .return-note { display: grid; gap: 6px; margin: 14px 0; padding: 12px; border: 1px solid #dcd8cc; border-radius: 8px; background: white; }",
    "    .return-note strong { color: #2f6f5e; }",
    ...staticMirrorI18nCss(),
    ...returnReadyBadgeCss(),
    ...returnAfterSaveCss(),
    "    code { border: 1px solid #e7e2d5; border-radius: 6px; padding: 1px 5px; background: #fbfaf6; }",
    "    .card { display: grid; gap: 12px; margin: 12px 0; padding: 14px; border: 1px solid #dcd8cc; border-radius: 8px; background: white; }",
    "    button { min-height: 36px; border: 1px solid #2f6f5e; border-radius: 8px; background: #2f6f5e; color: white; font-weight: 700; }",
    "    button.secondary { background: white; color: #202124; border-color: #dcd8cc; }",
    "    button:disabled { opacity: 0.55; cursor: not-allowed; }",
    "    .progress-panel { display: grid; gap: 10px; margin: 14px 0; padding: 12px; border: 1px solid #dcd8cc; border-radius: 8px; background: white; }",
    "    .progress-actions, .grade-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }",
    "    pre { overflow: auto; max-height: 220px; white-space: pre-wrap; word-break: break-word; border: 1px solid #dcd8cc; border-radius: 8px; padding: 10px; background: #fbfaf6; font-size: 12px; }",
    "    .answer { padding: 10px; border: 1px solid #dcd8cc; border-radius: 8px; background: #fbfaf6; line-height: 1.5; }",
    "    a { color: #315f82; }",
    "    @media (max-width: 520px) { body { padding: 12px; } h1 { font-size: 21px; } .progress-actions, .grade-actions { display: grid; grid-template-columns: 1fr; } button { width: 100%; padding: 0 12px; } }",
    "  </style>",
    "</head>",
    "<body>",
    ...staticMirrorLanguageToggleHtml(),
    "  <main>",
    ...staticNoScriptHtml(),
    "    <header>",
    `      <h1>${i18nText("Learning Companion Review Pack", "学习伴侣复习包")}</h1>`,
    `      <p class="summary">${i18nText(`Generated at ${pack.generatedAt} · ${pack.stats.due} due ${pack.stats.due === 1 ? "card" : "cards"} · static mirror, not live sync`, `生成于 ${pack.generatedAt} · ${pack.stats.due} 张到期卡 · 静态镜像，非实时同步`)}</p>`,
    "    </header>",
    ...returnReadyBadgeHtml({ bilingual: true }),
    "    <section class=\"return-note\" aria-label=\"Return to Mac\">",
    `      <strong>${i18nText("Return to Mac", "返回 Mac")}</strong>`,
    `      <span>${i18nText("Grade cards here, then save a timestamped review return file. Move that file back to the Mac and import it from Today > Return Files.", "在这里给卡片评分，然后保存带时间戳的复习返回文件。把文件带回 Mac，并从今日 > 返回文件导入。")}</span>`,
    "    </section>",
    "    <section class=\"progress-panel\" aria-label=\"Review progress patch\">",
    "      <div class=\"progress-actions\">",
    `        <button id="copyProgressBtn" type="button">${i18nText("Copy Return File", "复制返回文件")}</button>`,
    `        <button id="downloadProgressBtn" class="secondary" type="button">${i18nText("Save Return File", "保存返回文件")}</button>`,
    `        <button id="selectProgressBtn" class="secondary" type="button" aria-label="Select return file for manual copy">${i18nText("Manual Copy", "手动复制")}</button>`,
    `        <button id="clearProgressBtn" class="secondary" type="button">${i18nText("Clear Progress", "清除进度")}</button>`,
    "      </div>",
    `      <output id="progressStatus">${i18nText("Grade cards here, then save a return file for the Mac app.", "在这里给卡片评分，然后为 Mac 应用保存返回文件。")}</output>`,
    "      <p id=\"returnFileHint\" class=\"meta\"></p>",
    "      <p id=\"returnSaveMode\" class=\"meta\"></p>",
    "      <p id=\"returnManualHelp\" class=\"meta\"></p>",
    "      <p id=\"returnNextStep\" class=\"meta\" role=\"status\" aria-live=\"polite\"></p>",
    ...returnAfterSaveHtml(),
    `      <h3 class="return-preview-title">${i18nText("Return file preview", "返回文件预览")}</h3>`,
    `      <p class="return-copy-hint meta">${i18nText("If Copy or Save is blocked, use Manual Copy; the selected text below is the return file JSON.", "如果复制或保存被阻止，请使用手动复制；下方选中的文本就是返回文件 JSON。")}</p>`,
    "      <pre id=\"progressPreview\"></pre>",
    "    </section>",
    cards.length ? cards.join("\n") : empty,
    "  </main>",
    "  <script>",
    `    const seed = ${seed};`,
    `    const PATCH_SCHEMA = ${JSON.stringify(REVIEW_PROGRESS_PATCH_SCHEMA)};`,
    ...staticRuntimeI18nScriptLines(),
    "    const storageKey = `learning-companion.review-progress.${seed.workspaceFingerprint}`;",
    "    const returnMetaKey = `${storageKey}.return-file`;",
    "    let storageAvailable = true;",
    "    let progress = loadProgress();",
    "    let returnMeta = loadReturnMeta('review_patch');",
    "    let lastSavedFingerprint = '';",
    "    document.addEventListener('click', (event) => {",
    "      const button = event.target.closest('[data-reveal]');",
    "      if (!button) return;",
    "      const answer = button.closest('.card')?.querySelector('.answer');",
    "      if (!answer) return;",
    "      const willShow = answer.hasAttribute('hidden');",
    "      answer.toggleAttribute('hidden', !willShow);",
    "      setRevealButton(button, willShow);",
    "      button.setAttribute('aria-expanded', String(willShow));",
    "      const gradeActions = button.closest('.card')?.querySelector('.grade-actions');",
    "      if (gradeActions) gradeActions.hidden = !willShow;",
    "    });",
    "    document.addEventListener('click', (event) => {",
    "      const button = event.target.closest('[data-grade]');",
    "      if (!button) return;",
    "      const cardEl = button.closest('.card');",
    "      const card = seed.cards.find((item) => `${item.sessionId}::${item.cardId}` === cardEl?.dataset.cardKey);",
    "      if (!card) return;",
    "      const key = `${card.sessionId}::${card.cardId}`;",
    "      const existing = progress.events[key] || {};",
    "      progress.events[key] = {",
    "        id: existing.id || makeId('review_event'),",
    "        sessionId: card.sessionId,",
    "        cardId: card.cardId,",
    "        grade: button.dataset.grade,",
    "        reviewedAt: new Date().toISOString(),",
    "        baseUpdatedAt: card.baseUpdatedAt,",
    "        baseDueAt: card.baseDueAt,",
    "        baseStrength: card.baseStrength",
    "      };",
    "      const savedProgress = saveProgress();",
    "      renderProgress();",
    "      if (!savedProgress) setStatus(storageUnavailableStatus('Review marked in this return file.', '本次复习已标记到返回文件中。'));",
    "    });",
    "    document.querySelector('#copyProgressBtn').addEventListener('click', async () => {",
    "      if (!hasReturnProgress()) { setStatus(noReviewReturnMessage()); return; }",
    "      try { const patch = buildPatch(); await navigator.clipboard.writeText(JSON.stringify(patch, null, 2)); markSaved(); showReturnAfterSave('copied'); const filename = returnFileName('learning-companion-review-progress-patch', patch.patchId); setStatus(`Return file copied. Name it ${filename} when you save it.`, `返回文件已复制。保存时请命名为 ${filename}。`); }",
    "      catch { selectReturnJson('progressPreview', storageAvailable ? { en: 'Copy failed. Return file selected; copy it manually.', zh: '复制失败。已选中返回文件；请手动复制。' } : { en: 'Copy failed. Return file selected; copy it manually before closing this page.', zh: '复制失败。已选中返回文件；关闭此页面前请手动复制。' }); }",
    "    });",
    "    document.querySelector('#selectProgressBtn').addEventListener('click', () => { if (!hasReturnProgress()) { setStatus(noReviewReturnMessage()); return; } selectReturnJson('progressPreview', { en: 'Return file selected. Copy it manually, then bring it back to the Mac.', zh: '已选中返回文件。请手动复制，然后带回 Mac。' }); });",
    "    document.querySelector('#downloadProgressBtn').addEventListener('click', async () => {",
    "      if (!hasReturnProgress()) { setStatus(noReviewReturnMessage()); return; }",
    "      const patch = buildPatch();",
    "      const body = JSON.stringify(patch, null, 2);",
    "      const mode = await saveReturnJson(returnFileName('learning-companion-review-progress-patch', patch.patchId), body);",
    "      if (!mode) return;",
    "      markSaved();",
    "      showReturnAfterSave(mode);",
    "      setStatus(mode === 'picker' ? { en: 'Return file saved. Move it back to the Mac and import it from Today > Return Files.', zh: '返回文件已保存。把它带回 Mac，并从今日 > 返回文件导入。' } : { en: 'Return file download requested. Move it back to the Mac and import it from Today > Return Files.', zh: '已请求下载返回文件。把它带回 Mac，并从今日 > 返回文件导入。' });",
    "    });",
    "    document.querySelector('#clearProgressBtn').addEventListener('click', () => { if (!hasReturnProgress()) { setStatus(noReviewReturnMessage()); return; } clearProgress(); });",
    "    window.addEventListener('beforeunload', (event) => {",
    "      if (!hasUnsavedProgress()) return;",
    "      event.preventDefault();",
    "      event.returnValue = '';",
    "    });",
    "    document.querySelectorAll('input[name=\"mirrorLanguage\"]').forEach((input) => { input.addEventListener('change', renderProgress); });",
    "    function buildPatch() {",
    "      return { schema: PATCH_SCHEMA, appVersion: seed.appVersion, patchId: returnMeta.patchId, createdAt: new Date().toISOString(), source: { generatedBy: 'review.html', workspaceFingerprint: seed.workspaceFingerprint, returnBaseFingerprint: seed.returnBaseFingerprint }, events: Object.values(progress.events) };",
    "    }",
    "    function clearProgress() {",
    "      progress = { events: {} };",
    "      returnMeta = resetReturnMeta('review_patch');",
    "      const savedProgress = saveProgress();",
    "      markSaved();",
    "      renderProgress();",
    "      if (!savedProgress) setStatus(storageUnavailableStatus('Review progress cleared in memory.', '复习进度已在内存中清除。'));",
    "    }",
    "    function renderProgress() {",
    "      renderSaveMode();",
    "      document.querySelectorAll('[data-reveal]').forEach((button) => { const answer = button.closest('.card')?.querySelector('.answer'); setRevealButton(button, answer && !answer.hasAttribute('hidden')); });",
    "      document.querySelectorAll('.card').forEach((cardEl) => {",
    "        const event = progress.events[cardEl.dataset.cardKey];",
    "        const state = cardEl.querySelector('.review-state');",
    "        if (state) setI18nHtml(state, event ? `Marked ${event.grade}` : '', event ? `已标记：${gradeLabel(event.grade)}` : '');",
    "      });",
    "      const count = Object.keys(progress.events).length;",
    "      setReturnActionsEnabled(count > 0);",
    "      const patch = buildPatch();",
    "      const filename = returnFileName('learning-companion-review-progress-patch', patch.patchId);",
    "      document.querySelector('#progressPreview').textContent = JSON.stringify(patch, null, 2);",
    "      setI18nHtml(document.querySelector('#returnFileHint'), `Suggested JSON file: ${filename}`, `建议 JSON 文件：${filename}`);",
    "      setI18nHtml(document.querySelector('#returnManualHelp'), `Locked-down browser: use Manual Copy, press Ctrl+C or Command+C, or long-press the selected text on phone, paste into a text editor such as Notepad, and save as ${filename} before moving it back to Mac.`, `受限浏览器：使用手动复制，按 Ctrl+C 或 Command+C，或在手机上长按已选中文本，粘贴到记事本等文本编辑器中，并保存为 ${filename} 后再带回 Mac。`);",
    "      setI18nHtml(document.querySelector('#returnNextStep'), count ? `${count} review ${count === 1 ? 'event' : 'events'} staged in this return file. Use Copy or ${returnFileActionVerb('en')} to take it back to Mac before closing.` : noReviewReturnMessage('en'), count ? `${count} 条复习记录已暂存到这个返回文件。关闭前请使用复制或${returnFileActionVerb('zh')}把它带回 Mac。` : noReviewReturnMessage('zh'));",
    "      if (!count || hasUnsavedProgress()) hideReturnAfterSave();",
    "      setStatus(count ? { en: `${count} review ${count === 1 ? 'event' : 'events'} ready. Save the return file, move it back to the Mac, then import from Today > Return Files.`, zh: `${count} 条复习记录已就绪。保存返回文件，把它带回 Mac，然后从今日 > 返回文件导入。` } : noReviewReturnMessage());",
    "    }",
    "    function setRevealButton(button, isRevealed) { setI18nHtml(button, isRevealed ? 'Hide' : 'Reveal', isRevealed ? '隐藏' : '揭示'); }",
    "    function gradeLabel(grade) { return grade === 'again' ? '再练' : grade === 'good' ? '通过' : grade; }",
    "    function progressFingerprint() { return JSON.stringify(progress.events || {}); }",
    "    function markSaved() { lastSavedFingerprint = progressFingerprint(); }",
    "    function hasReturnProgress() { return Object.keys(progress.events || {}).length > 0; }",
    "    function noReviewReturnMessage(lang) { const pair = seed.cards.length ? { en: 'No review return file yet. Reveal and grade a card first.', zh: '还没有复习返回文件。请先揭示并评分一张卡片。' } : { en: 'No due cards in this mirror. Nothing to return from Review; close this tab or use Inbox for notes.', zh: '这个镜像里没有到期卡片。复习页没有需要返回的内容；可以关闭此标签页，或用收件箱记录笔记。' }; return lang ? pair[lang] : pair; }",
    "    function setReturnActionsEnabled(enabled) { ['copyProgressBtn', 'downloadProgressBtn', 'selectProgressBtn', 'clearProgressBtn'].forEach((id) => { const button = document.querySelector(`#${id}`); if (button) button.disabled = !enabled; }); }",
    "    function hasUnsavedProgress() { return Object.keys(progress.events || {}).length > 0 && progressFingerprint() !== lastSavedFingerprint; }",
    "    function showReturnAfterSave(mode) {",
    "      const panel = document.querySelector('#returnAfterSave');",
    "      const text = document.querySelector('#returnAfterSaveText');",
    "      if (!panel || !text) return;",
    "      const action = mode === 'picker' ? { en: 'saved', zh: '已保存' } : mode === 'download' ? { en: 'downloaded', zh: '已下载' } : { en: 'copied', zh: '已复制' };",
    `      setI18nHtml(text, \`Return file \${action.en}. ${RETURN_FILE_TRANSPORT_HINT} You can keep reviewing here; new grades will stage into the next return file.\`, \`返回文件\${action.zh}。${RETURN_FILE_TRANSPORT_HINT_ZH} 你可以继续在这里复习；新的评分会暂存到下一个返回文件。\`);`,
    "      renderReturnFollowup();",
    "      panel.hidden = false;",
    "    }",
    "    function hideReturnAfterSave() { const panel = document.querySelector('#returnAfterSave'); if (panel) panel.hidden = true; }",
    "    function renderReturnFollowup() {",
    "      const link = document.querySelector('#returnAfterSaveFollowup');",
    "      const followup = seed.followup || null;",
    "      if (!link) return;",
    "      if (!followup?.href) { link.hidden = true; link.removeAttribute('href'); link.textContent = ''; return; }",
    "      link.href = followup.href;",
    "      setI18nHtml(link, `${followup.label}: ${followup.detail}`, `${followup.labelZh || followup.label}: ${followup.detailZh || followup.detail}`);",
    "      link.hidden = false;",
    "    }",
    "    function loadProgress() { try { const value = JSON.parse(localStorage.getItem(storageKey) || '{}'); return { events: value.events && typeof value.events === 'object' ? value.events : {} }; } catch { storageAvailable = false; return { events: {} }; } }",
    "    function saveProgress() { try { localStorage.setItem(storageKey, JSON.stringify(progress)); return true; } catch { storageAvailable = false; return false; } }",
    "    function storageUnavailableStatus(prefix = 'Review progress staged in this return file.', zhPrefix = '复习进度已暂存到这个返回文件中。') { return { en: `${prefix} Browser storage is unavailable, so keep this page open and use Copy, Manual Copy, or the available save action before closing.`, zh: `${zhPrefix} 浏览器存储不可用，因此关闭前请保持此页面打开，并使用复制、手动复制或可用的保存操作。` }; }",
    "    function makeId(prefix) { return `${prefix}_${randomIdPart()}`; }",
    "    function returnFileName(prefix, id) { return `${prefix}-${returnMeta.stamp}-${shortId(id)}.json`; }",
    "    function loadReturnMeta(prefix) { try { const value = JSON.parse(localStorage.getItem(returnMetaKey) || '{}'); if (value.patchId && value.stamp) return { patchId: cleanReturnId(value.patchId), stamp: cleanReturnStamp(value.stamp) }; } catch { storageAvailable = false; } return resetReturnMeta(prefix); }",
    "    function resetReturnMeta(prefix) { const next = { patchId: makeId(prefix), stamp: compactLocalStamp(new Date()) }; try { localStorage.setItem(returnMetaKey, JSON.stringify(next)); } catch { storageAvailable = false; } return next; }",
    "    function cleanReturnId(value) { return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) || makeId('return_patch'); }",
    "    function cleanReturnStamp(value) { return /^\\d{8}-\\d{4}$/.test(String(value || '')) ? String(value) : compactLocalStamp(new Date()); }",
    "    function selectReturnJson(previewId, message) {",
    "      const preview = document.querySelector(`#${previewId}`);",
    "      if (!preview) { setStatus(message); return false; }",
    "      try {",
    "        const range = document.createRange();",
    "        range.selectNodeContents(preview);",
    "        const selection = window.getSelection();",
    "        if (!selection) throw new Error('Selection unavailable');",
    "        selection.removeAllRanges();",
    "        selection.addRange(range);",
    "        preview.setAttribute('tabindex', '-1');",
    "        preview.focus();",
    "        setStatus(message);",
    "        return true;",
    "      } catch {",
    "        preview.setAttribute('tabindex', '-1');",
    "        preview.focus();",
    "        setStatus(appendRuntimeI18n(message, ' If selection did not work, manually highlight the return file below.', ' 如果未能选中，请手动高亮下方返回文件。'));",
    "        return false;",
    "      }",
    "    }",
    "    async function saveReturnJson(filename, body) {",
    "      renderSaveMode();",
    "      const blob = new Blob([body], { type: 'application/json' });",
    "      if (canUseSavePicker()) {",
    "        try {",
    "          const handle = await window.showSaveFilePicker({ suggestedName: filename, types: [{ description: 'JSON file', accept: { 'application/json': ['.json'] } }] });",
    "          const writable = await handle.createWritable();",
    "          await writable.write(blob);",
    "          await writable.close();",
    "          return 'picker';",
    "        } catch (error) {",
    "          if (error?.name !== 'AbortError') setStatus('Save failed. Use Copy Return File instead.', '保存失败。请改用复制返回文件。');",
    "          return '';",
    "        }",
    "      }",
    "      if (!shouldUseFallbackDownload()) { renderProgress(); selectReturnJson('progressPreview', { en: 'Save picker unavailable here. Return file selected for manual copy. Nothing was saved to disk.', zh: '此处无法使用保存选择器。已选中返回文件用于手动复制；没有保存到磁盘。' }); return ''; }",
    "      try {",
    "        const url = URL.createObjectURL(blob);",
    "        const link = document.createElement('a');",
    "        link.href = url;",
    "        link.download = filename;",
    "        link.click();",
    "        URL.revokeObjectURL(url);",
    "        return 'download';",
    "      } catch {",
    "        selectReturnJson('progressPreview', { en: 'Save failed. Return file selected; copy it manually.', zh: '保存失败。已选中返回文件；请手动复制。' });",
    "        return '';",
    "      }",
    "    }",
    "    function canUseSavePicker() { return typeof window.showSaveFilePicker === 'function' && !allowsAutomatedDownloadFallback(); }",
    "    function shouldUseFallbackDownload() { return allowsAutomatedDownloadFallback(); }",
    "    function allowsAutomatedDownloadFallback() { return window.__LC_ALLOW_AUTOMATED_DOWNLOADS__ === true; }",
    "    function returnFileActionVerb(lang = 'en') { if (canUseSavePicker()) return lang === 'zh' ? '保存' : 'Save'; if (shouldUseFallbackDownload()) return lang === 'zh' ? '下载' : 'Download'; return lang === 'zh' ? '手动复制' : 'Manual Copy'; }",
    "    function renderSaveMode() {",
    "      const button = document.querySelector('#downloadProgressBtn');",
    "      const mode = document.querySelector('#returnSaveMode');",
    "      if (!button || !mode) return;",
    "      if (canUseSavePicker()) { setI18nHtml(button, 'Save Return File', '保存返回文件'); setI18nHtml(mode, 'This browser can save with a file picker. Choose where to keep the return file.', '这个浏览器可以用文件选择器保存。请选择返回文件的保存位置。'); return; }",
    "      if (shouldUseFallbackDownload()) { setI18nHtml(button, 'Download Return File', '下载返回文件'); setI18nHtml(mode, 'Automated download fallback is enabled for this controlled test run. Ordinary browsers should use Copy or a file picker.', '这个受控测试已启用自动下载回退。普通浏览器应使用复制或文件选择器。'); return; }",
    "      setI18nHtml(button, 'Select Return File', '选择返回文件');",
    "      setI18nHtml(mode, 'No file picker detected. Use Copy Return File, or select the preview and save it manually in Files or a text editor.', '未检测到文件选择器。请使用复制返回文件，或选中预览内容并在文件应用或文本编辑器中手动保存。');",
    "    }",
    "    function compactLocalStamp(date) { const pad = (n) => String(n).padStart(2, '0'); return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`; }",
    "    function shortId(value) { const safe = String(value || '').replace(/[^a-zA-Z0-9_-]/g, ''); return safe.slice(-8) || randomIdPart().slice(0, 8); }",
    "    function randomIdPart() { const cryptoApi = globalThis.crypto; if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID(); if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') { const bytes = new Uint8Array(16); cryptoApi.getRandomValues(bytes); return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''); } return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`; }",
    "    function setStatus(message, zh) { setI18nHtml(document.querySelector('#progressStatus'), message, zh); }",
    "    renderSaveMode();",
    "    renderProgress();",
    "    if (!storageAvailable) setStatus(storageUnavailableStatus('Review progress is memory-only.', '复习进度仅保存在内存中。'));",
    "  </script>",
    "</body>",
    "</html>",
    ""
  ].join("\n");
}

export function generateInboxHtml(workspace, now = new Date()) {
  const cleanWorkspace = sanitizeWorkspace(workspace);
  const workspaceJson = JSON.stringify(cleanWorkspace, null, 2);
  const workspaceFingerprint = fingerprintText(workspaceJson);
  const returnBaseFingerprint = buildReturnBaseFingerprint(cleanWorkspace);
  const pack = buildTodayPack(cleanWorkspace, now, { dueLimit: 50, recentLimit: 1 });
  const followup = buildInboxReturnFollowup(pack);
  const topics = cleanWorkspace.sessions.map((session) => ({
    id: session.id,
    title: session.title,
    sourceTitle: session.sourceTitle,
    sourceUrl: session.sourceUrl,
    materialType: session.materialType,
    tags: session.tags
  }));
  const seed = JSON.stringify({
    schema: "learning-companion.mobile-inbox-seed.v1",
    appVersion: WORKSPACE_SCHEMA_VERSION,
    generatedAt: formatLocalIso(now),
    workspaceFingerprint,
    returnBaseFingerprint,
    followup,
    activeSessionId: cleanWorkspace.activeSessionId,
    topics
  }).replace(/</g, "\\u003c");

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
    `  <meta name="learning-companion-return-base-fingerprint" content="${htmlAttribute(returnBaseFingerprint)}">`,
    `  <meta name="learning-companion-generated-at" content="${htmlAttribute(formatLocalIso(now))}">`,
    "  <title>Learning Companion Inbox</title>",
    "  <style>",
    "    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f6f0; color: #202124; }",
    "    body { margin: 0; padding: 16px; }",
    "    main { max-width: 760px; margin: 0 auto; display: grid; gap: 14px; }",
    "    h1, h2, p { margin: 0; }",
    "    h1 { font-size: 24px; } h2 { font-size: 16px; } h3 { margin: 0; font-size: 14px; }",
    "    .summary, label, .meta, output { color: #697077; font-size: 13px; }",
    "    .panel { display: grid; gap: 10px; border: 1px solid #dcd8cc; border-radius: 8px; background: white; padding: 14px; }",
    ...staticMirrorI18nCss(),
    ...returnReadyBadgeCss(),
    ...returnAfterSaveCss(),
    "    label { display: grid; gap: 5px; }",
    "    input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #dcd8cc; border-radius: 8px; padding: 10px; font: inherit; }",
    "    textarea { min-height: 96px; resize: vertical; }",
    "    textarea[readonly] { background: #fbfaf6; color: #4b5358; }",
    "    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }",
    "    .actions { display: flex; flex-wrap: wrap; gap: 8px; }",
    "    button { min-height: 38px; border: 1px solid #2f6f5e; border-radius: 8px; background: #2f6f5e; color: white; font-weight: 700; padding: 0 12px; }",
    "    button.secondary { background: white; color: #202124; border-color: #dcd8cc; }",
    "    button:disabled { opacity: 0.55; cursor: not-allowed; }",
    "    .answer-context { display: none; gap: 6px; border: 1px solid #b9d7cb; border-radius: 8px; background: #eef6f3; color: #315f52; padding: 12px; }",
    "    .answer-context.is-visible { display: grid; }",
    "    .answer-context strong { color: #245447; }",
    "    .answer-context q { color: #202124; font-weight: 600; }",
    "    .capture { border: 1px solid #dcd8cc; border-radius: 8px; padding: 10px; background: #fbfaf6; }",
    "    code { border: 1px solid #e7e2d5; border-radius: 6px; padding: 1px 5px; background: #fbfaf6; }",
    "    pre { overflow: auto; white-space: pre-wrap; word-break: break-word; border: 1px solid #dcd8cc; border-radius: 8px; padding: 10px; background: #fbfaf6; font-size: 12px; }",
    "    @media (max-width: 560px) { body { padding: 12px; } .row { grid-template-columns: 1fr; } .actions { display: grid; grid-template-columns: 1fr; } button { width: 100%; } }",
    "  </style>",
    "</head>",
    "<body>",
    ...staticMirrorLanguageToggleHtml(),
    "  <main>",
    ...staticNoScriptHtml(),
    "    <header>",
    `      <h1>${i18nText("Learning Companion Inbox", "学习伴侣收件箱")}</h1>`,
    `      <p class="summary">${i18nText(`Generated at ${formatLocalIso(now)} · static mirror, not live sync.`, `生成于 ${formatLocalIso(now)} · 静态镜像，非实时同步。`)}</p>`,
    "    </header>",
    ...returnReadyBadgeHtml({ bilingual: true }),
    "    <section class=\"panel\" aria-label=\"Return to Mac\">",
    `      <h2>${i18nText("Return to Mac", "返回 Mac")}</h2>`,
    `      <p class="summary">${i18nText("Add captures here, then save a timestamped inbox return file. Move that file back to the Mac and import it from Today > Return Files.", "在这里添加摘录，然后保存带时间戳的收件箱返回文件。把文件带回 Mac，并从今日 > 返回文件导入。")}</p>`,
    "    </section>",
    "    <section class=\"panel\" aria-label=\"New mobile capture\">",
    "      <div id=\"answerContext\" class=\"answer-context\" role=\"status\" aria-live=\"polite\" hidden>",
    `        <strong id="answerContextTitle">${i18nText("You're answering a question from this mirror", "你正在回答这个镜像中的问题")}</strong>`,
    "        <q id=\"answerQuestionPreview\"></q>",
    `        <span id="answerContextText">${i18nText("Your answer will be saved to a return file you move back to Mac.", "你的回答会保存到一个带回 Mac 的返回文件中。")}</span>`,
    "      </div>",
    `      <label>${i18nText("Topic", "主题")}<select id="topicSelect" aria-describedby="topicSourceHint"></select></label>`,
    "      <p id=\"topicSourceHint\" class=\"meta\"></p>",
    `      <label><span id="quoteLabel">${i18nText("Quote", "引文")}</span><textarea id="quoteInput" placeholder="Paste a quote or transcript line"></textarea></label>`,
    `      <label><span id="thoughtLabel">${i18nText("Thought", "想法")}</span><textarea id="thoughtInput" placeholder="Your thought, question, or takeaway"></textarea></label>`,
    "      <div class=\"row\">",
    `        <label>${i18nText("Time", "时间")}<input id="timestampInput" placeholder="08:12"></label>`,
    `        <label>${i18nText("Tags", "标签")}<input id="tagsInput" placeholder="ml, reading"></label>`,
    "      </div>",
    "      <div class=\"row\">",
    `        <label>${i18nText("Source", "来源")}<input id="sourceTitleInput" placeholder="Page or video title"></label>`,
    `        <label>${i18nText("URL", "链接")}<input id="sourceUrlInput" placeholder="https://"></label>`,
    "      </div>",
    "      <div class=\"actions\">",
    `        <button id="addCaptureBtn" type="button">${i18nText("Add Capture", "添加摘录")}</button>`,
    `        <button id="clearFormBtn" class="secondary" type="button">${i18nText("Clear Form", "清空表单")}</button>`,
    "      </div>",
    `      <output id="statusOutput">${i18nText("Drafts stay in this browser until you save a return file for the Mac app.", "草稿会留在这个浏览器里，直到你为 Mac 应用保存返回文件。")}</output>`,
    "    </section>",
    "    <section class=\"panel\" aria-label=\"Draft captures\">",
    `      <h2>${i18nText("Draft Captures", "草稿摘录")}</h2>`,
    "      <div id=\"draftList\"></div>",
    "      <div class=\"actions\">",
    `        <button id="copyPatchBtn" type="button">${i18nText("Copy Return File", "复制返回文件")}</button>`,
    `        <button id="downloadPatchBtn" class="secondary" type="button">${i18nText("Save Return File", "保存返回文件")}</button>`,
    `        <button id="selectPatchBtn" class="secondary" type="button" aria-label="Select return file for manual copy">${i18nText("Manual Copy", "手动复制")}</button>`,
    `        <button id="clearDraftsBtn" class="secondary" type="button">${i18nText("Clear Drafts", "清除草稿")}</button>`,
    "      </div>",
      "      <p id=\"returnFileHint\" class=\"meta\"></p>",
      "      <p id=\"returnSaveMode\" class=\"meta\"></p>",
      "      <p id=\"returnManualHelp\" class=\"meta\"></p>",
    "      <p id=\"returnNextStep\" class=\"meta\" role=\"status\" aria-live=\"polite\"></p>",
    ...returnAfterSaveHtml(),
    `      <h3 class="return-preview-title">${i18nText("Return file preview", "返回文件预览")}</h3>`,
    `      <p class="return-copy-hint meta">${i18nText("If Copy or Save is blocked, use Manual Copy; the selected text below is the return file JSON.", "如果复制或保存被阻止，请使用手动复制；下方选中的文本就是返回文件 JSON。")}</p>`,
    "      <pre id=\"patchPreview\"></pre>",
    "    </section>",
    "  </main>",
    "  <script>",
    `    const seed = ${seed};`,
    `    const PATCH_SCHEMA = ${JSON.stringify(MOBILE_INBOX_PATCH_SCHEMA)};`,
    ...staticRuntimeI18nScriptLines(),
    "    const storageKey = `learning-companion.inbox.${seed.workspaceFingerprint}`;",
    "    const returnMetaKey = `${storageKey}.return-file`;",
    "    const topicSelect = document.querySelector('#topicSelect');",
    "    const fields = {",
    "      quote: document.querySelector('#quoteInput'),",
    "      thought: document.querySelector('#thoughtInput'),",
    "      timestamp: document.querySelector('#timestampInput'),",
    "      tags: document.querySelector('#tagsInput'),",
    "      sourceTitle: document.querySelector('#sourceTitleInput'),",
    "      sourceUrl: document.querySelector('#sourceUrlInput')",
    "    };",
    "    const fieldLabels = { quote: document.querySelector('#quoteLabel'), thought: document.querySelector('#thoughtLabel') };",
    "    const answerContext = document.querySelector('#answerContext');",
    "    const answerContextTitle = document.querySelector('#answerContextTitle');",
    "    const answerQuestionPreview = document.querySelector('#answerQuestionPreview');",
    "    const answerContextText = document.querySelector('#answerContextText');",
    "    let storageAvailable = true;",
    "    let drafts = loadDrafts();",
    "    let returnMeta = loadReturnMeta('inbox_patch');",
    "    let lastSavedFingerprint = '';",
    "    let sourceUrlExplicit = false;",
    "    let answerToCaptureId = '';",
    "    let answerContextState = '';",
    "    let answerContextQuestion = '';",
    "    seed.topics.forEach((topic) => {",
    "      const option = document.createElement('option');",
    "      option.value = topic.id;",
    "      option.textContent = topic.title;",
    "      option.selected = topic.id === seed.activeSessionId;",
    "      topicSelect.append(option);",
    "    });",
    "    applyQueryPrefill();",
    "    topicSelect.addEventListener('change', render);",
    "    document.querySelector('#addCaptureBtn').addEventListener('click', addCapture);",
    "    document.querySelector('#clearFormBtn').addEventListener('click', clearForm);",
    "    document.querySelectorAll('input[name=\"mirrorLanguage\"]').forEach((input) => input.addEventListener('change', () => { renderAnswerContext(); renderTopicSourceHint(); }));",
    "    fields.sourceTitle.addEventListener('input', () => { renderTopicSourceHint(); });",
    "    fields.sourceUrl.addEventListener('input', () => { sourceUrlExplicit = false; renderTopicSourceHint(); });",
    "    document.querySelector('#clearDraftsBtn').addEventListener('click', clearDrafts);",
    "    document.querySelectorAll('input[name=\"mirrorLanguage\"]').forEach((input) => { input.addEventListener('change', render); });",
    "    // Copy/Save build a current-topic patch; Clear Drafts intentionally clears every staged topic draft on this mirror page.",
    "    document.querySelector('#copyPatchBtn').addEventListener('click', async () => {",
    "      if (!hasCurrentTopicDrafts()) { setStatus(noInboxReturnMessage()); return; }",
    "      try { const patch = buildPatch(); await navigator.clipboard.writeText(JSON.stringify(patch, null, 2)); markSaved(); showReturnAfterSave('copied'); answerContextState = ''; answerContextQuestion = ''; renderAnswerContext(); const filename = returnFileName('learning-companion-inbox-patch', patch.patchId); setStatus(`Return file copied. Name it ${filename} when you save it.`, `返回文件已复制。保存时请命名为 ${filename}。`); }",
    "      catch { selectReturnJson('patchPreview', storageAvailable ? { en: 'Copy failed. Return file selected; copy it manually.', zh: '复制失败。已选中返回文件；请手动复制。' } : { en: 'Copy failed. Return file selected; copy it manually before closing this page.', zh: '复制失败。已选中返回文件；关闭此页面前请手动复制。' }); }",
    "    });",
    "    document.querySelector('#selectPatchBtn').addEventListener('click', () => { if (!hasCurrentTopicDrafts()) { setStatus(noInboxReturnMessage()); return; } selectReturnJson('patchPreview', { en: 'Return file selected. Copy it manually, then bring it back to the Mac.', zh: '已选中返回文件。请手动复制，然后带回 Mac。' }); });",
    "    document.querySelector('#downloadPatchBtn').addEventListener('click', async () => {",
    "      if (!hasCurrentTopicDrafts()) { setStatus(noInboxReturnMessage()); return; }",
    "      const patch = buildPatch();",
    "      const body = JSON.stringify(patch, null, 2);",
    "      const mode = await saveReturnJson(returnFileName('learning-companion-inbox-patch', patch.patchId), body);",
    "      if (!mode) return;",
    "      markSaved();",
    "      showReturnAfterSave(mode);",
    "      answerContextState = '';",
    "      answerContextQuestion = '';",
    "      renderAnswerContext();",
    "      setStatus(mode === 'picker' ? { en: 'Return file saved. Move it back to the Mac and import it from Today > Return Files.', zh: '返回文件已保存。把它带回 Mac，并从今日 > 返回文件导入。' } : { en: 'Return file download requested. Move it back to the Mac and import it from Today > Return Files.', zh: '已请求下载返回文件。把它带回 Mac，并从今日 > 返回文件导入。' });",
    "    });",
    "    window.addEventListener('beforeunload', (event) => {",
    "      if (!hasUnsavedDrafts()) return;",
    "      event.preventDefault();",
    "      event.returnValue = '';",
    "    });",
    "    function addCapture() {",
    "      if (!fields.quote.value.trim() && !fields.thought.value.trim()) { setStatus('Add quote or thought first.', '请先添加引文或想法。'); return; }",
    "      const wasAnswerDraft = Boolean(answerToCaptureId);",
    "      const capturedQuestion = answerContextQuestion || clean(fields.quote.value, 120) || 'Linked question from this mirror';",
    "      drafts.push({",
    "        id: makeId('inbox_capture'),",
    "        topicId: topicSelect.value,",
    "        quote: clean(fields.quote.value, 12000),",
    "        thought: clean(fields.thought.value, 12000),",
    "        timestamp: clean(fields.timestamp.value, 32),",
    "        tags: fields.tags.value,",
    "        sourceTitle: clean(fields.sourceTitle.value, 160),",
    "        sourceUrl: safeUrl(fields.sourceUrl.value),",
    "        sourceUrlProvided: sourceUrlExplicit || Boolean(fields.sourceUrl.value.trim()),",
    "        answersQuestionCaptureId: answerToCaptureId,",
    "        materialType: currentTopic().materialType || 'other',",
    "        capturedAt: new Date().toISOString()",
    "      });",
    "      const savedDrafts = saveDrafts();",
    "      clearForm({ keepAnswerContext: wasAnswerDraft });",
    "      if (wasAnswerDraft) {",
    "        answerContextState = 'captured';",
    "        answerContextQuestion = capturedQuestion;",
    "        setStatus(savedDrafts ? { en: 'Answer captured in return draft. Save the return file when ready.', zh: '回答已加入返回草稿。准备好后保存返回文件。' } : storageUnavailableStatus('Answer captured in this return draft.', '回答已加入这个返回草稿。'));",
    "      } else setStatus(savedDrafts ? { en: 'Capture added to return draft. Save the return file when ready.', zh: '摘录已加入返回草稿。准备好后保存返回文件。' } : storageUnavailableStatus('Capture added to this return draft.', '摘录已加入这个返回草稿。'));",
    "      render();",
    "    }",
    "    function clearDrafts() {",
    "      if (!drafts.length) { setStatus('No draft captures to clear.', '没有可清除的草稿摘录。'); return; }",
    "      drafts = [];",
    "      returnMeta = resetReturnMeta('inbox_patch');",
    "      answerContextState = '';",
    "      answerContextQuestion = '';",
    "      answerToCaptureId = '';",
    "      const savedDrafts = saveDrafts();",
    "      markSaved();",
    "      render();",
    "      if (!savedDrafts) setStatus(storageUnavailableStatus('Drafts cleared in memory.', '草稿已在内存中清除。'));",
    "    }",
    "    function buildPatch() {",
    "      const topic = currentTopic();",
    "      const topicDrafts = drafts.filter((item) => item.topicId === topic.id);",
    "      return {",
    "        schema: PATCH_SCHEMA,",
    "        appVersion: seed.appVersion,",
    "        patchId: returnMeta.patchId,",
    "        createdAt: new Date().toISOString(),",
    "        source: { generatedBy: 'inbox.html', workspaceFingerprint: seed.workspaceFingerprint, returnBaseFingerprint: seed.returnBaseFingerprint, topicId: seed.activeSessionId, topicTitle: seed.topics.find((item) => item.id === seed.activeSessionId)?.title || '' },",
    "        target: { topicId: topic.id, topicTitle: topic.title },",
    "        captures: topicDrafts.map((item) => ({",
    "          id: item.id,",
    "          quote: item.quote,",
    "          thought: item.thought,",
    "          timestamp: item.timestamp,",
    "          sourceTitle: item.sourceTitle || topic.sourceTitle || '',",
    "          sourceUrl: item.sourceUrlProvided ? item.sourceUrl : safeUrl(topic.sourceUrl || ''),",
    "          answersQuestionCaptureId: item.answersQuestionCaptureId || '',",
    "          materialType: item.materialType || topic.materialType || 'other',",
    "          tags: item.tags,",
    "          capturedAt: item.capturedAt",
    "        }))",
    "      };",
    "    }",
    "    function render() {",
    "      renderSaveMode();",
    "      const topic = currentTopic();",
    "      renderTopicSourceHint(topic);",
    "      const topicDrafts = drafts.filter((item) => item.topicId === topic.id);",
    "      document.querySelector('#draftList').replaceChildren(...(topicDrafts.length ? topicDrafts.map(renderDraft) : [emptyDraft()]));",
    "      setReturnActionsEnabled(topicDrafts.length > 0, drafts.length > 0);",
    "      const patch = buildPatch();",
    "      const filename = returnFileName('learning-companion-inbox-patch', patch.patchId);",
    "      document.querySelector('#patchPreview').textContent = JSON.stringify(patch, null, 2);",
    "      setI18nHtml(document.querySelector('#returnFileHint'), `Suggested JSON file: ${filename}`, `建议 JSON 文件：${filename}`);",
    "      setI18nHtml(document.querySelector('#returnManualHelp'), `Locked-down browser: use Manual Copy, press Ctrl+C or Command+C, or long-press the selected text on phone, paste into a text editor such as Notepad, and save as ${filename} before moving it back to Mac.`, `受限浏览器：使用手动复制，按 Ctrl+C 或 Command+C，或在手机上长按已选中文本，粘贴到记事本等文本编辑器中，并保存为 ${filename} 后再带回 Mac。`);",
    "      setI18nHtml(document.querySelector('#returnNextStep'), topicDrafts.length ? `${topicDrafts.length} draft ${topicDrafts.length === 1 ? 'capture' : 'captures'} staged in this return file. Use Copy or ${returnFileActionVerb('en')} to take it back to Mac before closing.` : noInboxReturnMessage('en'), topicDrafts.length ? `${topicDrafts.length} 条草稿摘录已暂存到这个返回文件。关闭前请使用复制或${returnFileActionVerb('zh')}把它带回 Mac。` : noInboxReturnMessage('zh'));",
    "      if (!topicDrafts.length || hasUnsavedDrafts()) hideReturnAfterSave();",
    "      renderAnswerContext();",
    "    }",
    "    function renderDraft(item) {",
    "      const node = document.createElement('article');",
    "      node.className = 'capture';",
    "      const text = item.thought || item.quote || 'Untitled capture';",
    "      node.textContent = `${new Date(item.capturedAt).toLocaleString()} · ${text}`;",
    "      return node;",
    "    }",
    "    function emptyDraft() { const node = document.createElement('p'); node.className = 'meta'; setI18nHtml(node, 'No draft captures for this topic yet.', '这个主题还没有草稿摘录。'); return node; }",
    "    function applyQueryPrefill() {",
    "      const params = new URLSearchParams(window.location.search);",
    "      const topicId = clean(params.get('topicId'), 128);",
    "      let notice = null;",
    "      if (topicId) {",
    "        if (seed.topics.some((topic) => topic.id === topicId)) topicSelect.value = topicId;",
    "        else notice = { en: 'Answer draft loaded with active topic; original topic was not found.', zh: '已用当前主题加载回答草稿；未找到原始主题。' };",
    "      }",
    "      fields.quote.value = clean(params.get('quote'), 12000);",
    "      fields.thought.value = clean(params.get('thought'), 12000);",
    "      fields.timestamp.value = clean(params.get('timestamp'), 32);",
    "      fields.tags.value = clean(params.get('tags'), 240);",
    "      fields.sourceTitle.value = clean(params.get('sourceTitle'), 160);",
    "      const rawSourceUrl = params.get('sourceUrl');",
    "      sourceUrlExplicit = rawSourceUrl !== null;",
    "      answerToCaptureId = clean(params.get('answerToCaptureId'), 128);",
    "      answerContextState = answerToCaptureId ? 'draft' : '';",
    "      answerContextQuestion = answerToCaptureId ? (clean(fields.quote.value, 120) || 'Linked question from this mirror') : '';",
    "      fields.sourceUrl.value = safeUrl(rawSourceUrl);",
    "      if (answerToCaptureId || fields.quote.value || fields.thought.value) setStatus(notice || { en: 'Answer draft loaded from mirror link.', zh: '已从镜像链接加载回答草稿。' });",
    "      renderAnswerContext();",
    "    }",
    "    function renderAnswerContext() {",
    "      if (!answerContext || !answerContextTitle || !answerQuestionPreview || !answerContextText) return;",
    "      const active = Boolean(answerContextState);",
    "      answerContext.hidden = !active;",
    "      answerContext.classList.toggle('is-visible', active);",
    "      if (!active) {",
    "        answerContextTitle.textContent = '';",
    "        answerQuestionPreview.textContent = '';",
    "        answerContextText.textContent = '';",
    "        setAnswerFieldMode(false);",
    "        return;",
    "      }",
    "      const question = answerContextState === 'captured' ? answerContextQuestion : (clean(fields.quote.value, 120) || answerContextQuestion || 'Linked question from this mirror');",
    "      answerContextQuestion = question;",
    "      setAnswerFieldMode(answerContextState === 'draft');",
    "      setI18nHtml(answerContextTitle, answerContextState === 'captured' ? 'Answer captured in this return draft' : \"You're answering a question from this mirror\", answerContextState === 'captured' ? '回答已加入这个返回草稿' : '你正在回答这个镜像中的问题');",
    "      answerQuestionPreview.textContent = question;",
    "      setI18nHtml(answerContextText, answerContextState === 'captured' ? 'Save or copy the return file to move it back to Mac.' : 'Your answer will be saved to a return file you move back to Mac.', answerContextState === 'captured' ? '保存或复制返回文件，把它带回 Mac。' : '你的回答会保存到一个带回 Mac 的返回文件中。');",
    "    }",
    "    function setAnswerFieldMode(isAnswerDraft) {",
    "      setI18nHtml(fieldLabels.quote, isAnswerDraft ? 'Question from Mac' : 'Quote', isAnswerDraft ? '来自 Mac 的问题' : '引文');",
    "      setI18nHtml(fieldLabels.thought, isAnswerDraft ? 'Answer to return' : 'Thought', isAnswerDraft ? '要带回的回答' : '想法');",
    "      setI18nPlaceholder(fields.quote, isAnswerDraft ? 'Question carried from the Mac mirror' : 'Paste a quote or transcript line', isAnswerDraft ? '从 Mac 镜像带来的问题' : '粘贴引文或转写行');",
    "      setI18nPlaceholder(fields.thought, isAnswerDraft ? 'Write the answer to bring back to Mac' : 'Your thought, question, or takeaway', isAnswerDraft ? '写下要带回 Mac 的回答' : '你的想法、问题或收获');",
    "      setI18nPlaceholder(fields.sourceTitle, 'Page or video title', '页面或视频标题');",
    "      fields.quote.readOnly = Boolean(isAnswerDraft);",
    "      fields.quote.setAttribute('aria-readonly', String(Boolean(isAnswerDraft)));",
    "    }",
    "    function currentTopic() { return seed.topics.find((topic) => topic.id === topicSelect.value) || seed.topics[0]; }",
    "    function currentTopicDrafts() { const topic = currentTopic(); return drafts.filter((item) => item.topicId === topic.id); }",
    "    function hasCurrentTopicDrafts() { return currentTopicDrafts().length > 0; }",
    "    function noInboxReturnMessage(lang) { const pair = { en: 'No draft captures for this topic yet. Add a quote or thought before saving a return file.', zh: '这个主题还没有草稿摘录。保存返回文件前请先添加引文或想法。' }; return lang ? pair[lang] : pair; }",
    "    function setReturnActionsEnabled(hasTopicDrafts, hasAnyDrafts) { ['copyPatchBtn', 'downloadPatchBtn', 'selectPatchBtn'].forEach((id) => { const button = document.querySelector(`#${id}`); if (button) button.disabled = !hasTopicDrafts; }); const clear = document.querySelector('#clearDraftsBtn'); if (clear) clear.disabled = !hasAnyDrafts; }",
    "    function loadDrafts() { try { return JSON.parse(localStorage.getItem(storageKey) || '[]').filter((item) => item && item.id); } catch { storageAvailable = false; return []; } }",
    "    function saveDrafts() { try { localStorage.setItem(storageKey, JSON.stringify(drafts.slice(-50))); return true; } catch { storageAvailable = false; return false; } }",
    "    function storageUnavailableStatus(prefix = 'Draft staged in this return file.', zhPrefix = '草稿已暂存到这个返回文件中。') { return { en: `${prefix} Browser storage is unavailable, so keep this page open and use Copy, Manual Copy, or the available save action before closing.`, zh: `${zhPrefix} 浏览器存储不可用，因此关闭前请保持此页面打开，并使用复制、手动复制或可用的保存操作。` }; }",
    "    function draftsFingerprint() { return JSON.stringify(drafts || []); }",
    "    function markSaved() { lastSavedFingerprint = draftsFingerprint(); }",
    "    function hasUnsavedDrafts() { return drafts.length > 0 && draftsFingerprint() !== lastSavedFingerprint; }",
    "    function showReturnAfterSave(mode) {",
    "      const panel = document.querySelector('#returnAfterSave');",
    "      const text = document.querySelector('#returnAfterSaveText');",
    "      if (!panel || !text) return;",
    "      const action = mode === 'picker' ? { en: 'saved', zh: '已保存' } : mode === 'download' ? { en: 'downloaded', zh: '已下载' } : { en: 'copied', zh: '已复制' };",
    `      setI18nHtml(text, \`Return file \${action.en}. ${RETURN_FILE_TRANSPORT_HINT} You can keep capturing here; new drafts will stage into the next return file.\`, \`返回文件\${action.zh}。${RETURN_FILE_TRANSPORT_HINT_ZH} 你可以继续在这里摘录；新的草稿会暂存到下一个返回文件。\`);`,
    "      renderReturnFollowup();",
    "      panel.hidden = false;",
    "    }",
    "    function hideReturnAfterSave() { const panel = document.querySelector('#returnAfterSave'); if (panel) panel.hidden = true; }",
    "    function renderReturnFollowup() {",
    "      const link = document.querySelector('#returnAfterSaveFollowup');",
    "      const followup = seed.followup || null;",
    "      if (!link) return;",
    "      if (!followup?.href) { link.hidden = true; link.removeAttribute('href'); link.textContent = ''; return; }",
    "      link.href = followup.href;",
    "      setI18nHtml(link, `${followup.label}: ${followup.detail}`, `${followup.labelZh || followup.label}: ${followup.detailZh || followup.detail}`);",
    "      link.hidden = false;",
    "    }",
    "    function renderTopicSourceHint(topic = currentTopic()) {",
    "      const hint = document.querySelector('#topicSourceHint');",
    "      if (!hint) return;",
    "      if (fields.sourceTitle.value.trim() || fields.sourceUrl.value.trim()) { setI18nHtml(hint, 'Using the Source or URL you entered for this capture.', '正在使用你为这条摘录输入的来源或 URL。'); return; }",
    "      setI18nHtml(hint, topic.sourceTitle || topic.sourceUrl ? `Source: ${topic.sourceTitle || 'Linked source'} - used for new captures unless you fill Source or URL below.` : 'This mirror has no topic source. Add Source or URL if this capture needs one.', topic.sourceTitle || topic.sourceUrl ? `来源：${topic.sourceTitle || '关联来源'} - 新摘录会默认使用它，除非你在下方填写来源或 URL。` : '这个镜像没有主题来源。如果这条摘录需要来源，请添加来源或 URL。');",
    "    }",
    "    function clearForm(options = {}) { Object.values(fields).forEach((field) => { field.value = ''; }); sourceUrlExplicit = false; answerToCaptureId = ''; if (!options.keepAnswerContext) { answerContextState = ''; answerContextQuestion = ''; } renderAnswerContext(); renderTopicSourceHint(); }",
    "    function clean(value, max) { return String(value || '').replace(/[\\u0000-\\u001f\\u007f]/g, '').trim().slice(0, max); }",
    "    function safeUrl(value) { const raw = clean(value, 2048); if (!raw) return ''; try { const url = new URL(raw); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }",
    "    function makeId(prefix) { return `${prefix}_${randomIdPart()}`; }",
    "    function returnFileName(prefix, id) { return `${prefix}-${returnMeta.stamp}-${shortId(id)}.json`; }",
    "    function loadReturnMeta(prefix) { try { const value = JSON.parse(localStorage.getItem(returnMetaKey) || '{}'); if (value.patchId && value.stamp) return { patchId: cleanReturnId(value.patchId), stamp: cleanReturnStamp(value.stamp) }; } catch {} return resetReturnMeta(prefix); }",
    "    function resetReturnMeta(prefix) { const next = { patchId: makeId(prefix), stamp: compactLocalStamp(new Date()) }; try { localStorage.setItem(returnMetaKey, JSON.stringify(next)); } catch { storageAvailable = false; } return next; }",
    "    function cleanReturnId(value) { return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) || makeId('return_patch'); }",
    "    function cleanReturnStamp(value) { return /^\\d{8}-\\d{4}$/.test(String(value || '')) ? String(value) : compactLocalStamp(new Date()); }",
    "    function selectReturnJson(previewId, message) {",
    "      const preview = document.querySelector(`#${previewId}`);",
    "      if (!preview) { setStatus(message); return false; }",
    "      try {",
    "        const range = document.createRange();",
    "        range.selectNodeContents(preview);",
    "        const selection = window.getSelection();",
    "        if (!selection) throw new Error('Selection unavailable');",
    "        selection.removeAllRanges();",
    "        selection.addRange(range);",
    "        preview.setAttribute('tabindex', '-1');",
    "        preview.focus();",
    "        setStatus(message);",
    "        return true;",
    "      } catch {",
    "        preview.setAttribute('tabindex', '-1');",
    "        preview.focus();",
    "        setStatus(appendRuntimeI18n(message, ' If selection did not work, manually highlight the return file below.', ' 如果未能选中，请手动高亮下方返回文件。'));",
    "        return false;",
    "      }",
    "    }",
    "    async function saveReturnJson(filename, body) {",
    "      renderSaveMode();",
    "      const blob = new Blob([body], { type: 'application/json' });",
    "      if (canUseSavePicker()) {",
    "        try {",
    "          const handle = await window.showSaveFilePicker({ suggestedName: filename, types: [{ description: 'JSON file', accept: { 'application/json': ['.json'] } }] });",
    "          const writable = await handle.createWritable();",
    "          await writable.write(blob);",
    "          await writable.close();",
    "          return 'picker';",
    "        } catch (error) {",
    "          if (error?.name !== 'AbortError') setStatus('Save failed. Use Copy Return File instead.', '保存失败。请改用复制返回文件。');",
    "          return '';",
    "        }",
    "      }",
    "      if (!shouldUseFallbackDownload()) { render(); selectReturnJson('patchPreview', { en: 'Save picker unavailable here. Return file selected for manual copy. Nothing was saved to disk.', zh: '此处无法使用保存选择器。已选中返回文件用于手动复制；没有保存到磁盘。' }); return ''; }",
    "      try {",
    "        const url = URL.createObjectURL(blob);",
    "        const link = document.createElement('a');",
    "        link.href = url;",
    "        link.download = filename;",
    "        link.click();",
    "        URL.revokeObjectURL(url);",
    "        return 'download';",
    "      } catch {",
    "        selectReturnJson('patchPreview', { en: 'Save failed. Return file selected; copy it manually.', zh: '保存失败。已选中返回文件；请手动复制。' });",
    "        return '';",
    "      }",
    "    }",
    "    function canUseSavePicker() { return typeof window.showSaveFilePicker === 'function' && !allowsAutomatedDownloadFallback(); }",
    "    function shouldUseFallbackDownload() { return allowsAutomatedDownloadFallback(); }",
    "    function allowsAutomatedDownloadFallback() { return window.__LC_ALLOW_AUTOMATED_DOWNLOADS__ === true; }",
    "    function returnFileActionVerb(lang = 'en') { if (canUseSavePicker()) return lang === 'zh' ? '保存' : 'Save'; if (shouldUseFallbackDownload()) return lang === 'zh' ? '下载' : 'Download'; return lang === 'zh' ? '手动复制' : 'Manual Copy'; }",
    "    function renderSaveMode() {",
    "      const button = document.querySelector('#downloadPatchBtn');",
    "      const mode = document.querySelector('#returnSaveMode');",
    "      if (!button || !mode) return;",
    "      if (canUseSavePicker()) { setI18nHtml(button, 'Save Return File', '保存返回文件'); setI18nHtml(mode, 'This browser can save with a file picker. Choose where to keep the return file.', '这个浏览器可以用文件选择器保存。请选择返回文件的保存位置。'); return; }",
    "      if (shouldUseFallbackDownload()) { setI18nHtml(button, 'Download Return File', '下载返回文件'); setI18nHtml(mode, 'Automated download fallback is enabled for this controlled test run. Ordinary browsers should use Copy or a file picker.', '这个受控测试已启用自动下载回退。普通浏览器应使用复制或文件选择器。'); return; }",
    "      setI18nHtml(button, 'Select Return File', '选择返回文件');",
    "      setI18nHtml(mode, 'No file picker detected. Use Copy Return File, or select the preview and save it manually in Files or a text editor.', '未检测到文件选择器。请使用复制返回文件，或选中预览内容并在文件应用或文本编辑器中手动保存。');",
    "    }",
    "    function compactLocalStamp(date) { const pad = (n) => String(n).padStart(2, '0'); return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`; }",
    "    function shortId(value) { const safe = String(value || '').replace(/[^a-zA-Z0-9_-]/g, ''); return safe.slice(-8) || randomIdPart().slice(0, 8); }",
    "    function randomIdPart() {",
    "      const cryptoApi = globalThis.crypto;",
    "      if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();",
    "      if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {",
    "        const bytes = new Uint8Array(16);",
    "        cryptoApi.getRandomValues(bytes);",
    "        bytes[6] = (bytes[6] & 0x0f) | 0x40;",
    "        bytes[8] = (bytes[8] & 0x3f) | 0x80;",
    "        return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');",
    "      }",
    "      return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;",
    "    }",
    "    function setStatus(message, zh) { setI18nHtml(document.querySelector('#statusOutput'), message, zh); }",
    "    renderSaveMode();",
    "    render();",
    "    if (!storageAvailable) setStatus(storageUnavailableStatus('Drafts are memory-only.', '草稿仅保存在内存中。'));",
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
  const returnBaseFingerprint = buildReturnBaseFingerprint(cleanWorkspace);
  const pack = buildTodayPack(cleanWorkspace, now, { dueLimit: 6, recentLimit: 4 });
  const brief = pack.focusBrief;
  const sessionLinks = cleanWorkspace.sessions.map((session) => {
    const paths = getMirrorSessionPaths(session);
    const due = getDueReviewCards(session, now).length;
    return [
      '<article class="session">',
      `  <a href="${htmlAttribute(paths.markdownPath)}">${htmlText(session.title)}</a>`,
      `  <span>${i18nText(`${session.captures.length} captures · ${session.reviewCards.length} cards · ${due} due`, `${session.captures.length} 条摘录 · ${session.reviewCards.length} 张卡片 · ${due} 张到期`)}</span>`,
      "</article>"
    ].join("\n");
  });
  const dueList = pack.dueItems.length
    ? pack.dueItems.map(({ sessionTitle, card }) => `<li>${htmlText(card.prompt)} <span>${htmlText(sessionTitle)}</span></li>`).join("\n")
    : `<li>${i18nText("No cards due right now.", "现在没有到期卡片。")}</li>`;
  const questionList = pack.questionItems.length
    ? [
        ...pack.questionItems.map(({ sessionId, sessionTitle, sessionPath, capture }) => {
          const sessionLabel = isSafeMirrorSessionPath(sessionPath)
            ? `<a href="${htmlAttribute(sessionPath)}">${htmlText(sessionTitle)}</a>`
            : htmlText(sessionTitle);
          const answerHref = buildInboxAnswerHref(sessionId, capture);
          return `<li>${htmlText(capture.thought || capture.quote || "Untitled question")} <span>${sessionLabel} · <a href="${htmlAttribute(answerHref)}">${i18nText("Draft answer in inbox", "在收件箱草拟回答")}</a></span></li>`;
        }),
        pack.questionOverflow > 0 ? `<li>${i18nText(`${formatCount(pack.questionOverflow, "more open question")} in`, `还有 ${pack.questionOverflow} 个开放问题在`)} <a href="TODAY.md">TODAY.md</a>.</li>` : ""
      ].filter(Boolean).join("\n")
    : `<li>${i18nText("No open questions captured yet.", "还没有捕获开放问题。")}</li>`;
  const recentList = pack.recentCaptures.length
    ? pack.recentCaptures.map(({ sessionTitle, capture }) => `<li>${htmlText(capture.thought || capture.quote || "Untitled capture")} <span>${htmlText(sessionTitle)}</span></li>`).join("\n")
    : `<li>${i18nText("No captures yet.", "还没有摘录。")}</li>`;
  const mirrorNextAction = translateMirrorFocusNextAction(brief.nextAction);
  const signalList = brief.warnings.length
    ? brief.warnings.map((warning) => {
        const translated = translateMirrorFocusWarning(warning);
        return `<li>${i18nText(warning.label, translated.labelZh)} <span>${i18nText(warning.detail, translated.detailZh)}</span></li>`;
      }).join("\n")
    : `<li>${i18nText("Session is ready to continue.", "这个主题可以继续学习。")}</li>`;
  const sourceLine = brief.source.href
    ? `<a href="${htmlAttribute(brief.source.href)}">${htmlText(brief.source.title || "Open source")}</a>`
    : i18nText("Add a source URL before the next export.", "下次导出前请添加来源 URL。");
  const latestLine = brief.latestCapture
    ? `${htmlText(brief.latestCapture.summary)}${brief.latestCapture.timestamp ? ` <span>@ ${htmlText(brief.latestCapture.timestamp)}</span>` : ""}`
    : i18nText("No captures yet.", "还没有摘录。");
  const mirrorDeviceAction = buildMirrorDeviceAction(pack, brief);

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <meta name="referrer" content="no-referrer">',
    '  <meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'none\'">',
    `  <meta name="learning-companion-source" content="workspace.json">`,
    `  <meta name="learning-companion-workspace-fingerprint" content="${htmlAttribute(workspaceFingerprint)}">`,
    `  <meta name="learning-companion-return-base-fingerprint" content="${htmlAttribute(returnBaseFingerprint)}">`,
    `  <meta name="learning-companion-generated-at" content="${htmlAttribute(pack.generatedAt)}">`,
    "  <title>Learning Companion Mirror</title>",
    "  <style>",
    "    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f6f0; color: #202124; }",
    "    body { margin: 0; padding: 18px; }",
    "    main { max-width: 860px; margin: 0 auto; display: grid; gap: 16px; }",
    "    h1, h2, p { margin: 0; }",
    "    h1 { font-size: 26px; } h2 { font-size: 16px; }",
    "    .summary, li span, .session span { color: #697077; font-size: 13px; }",
    "    .why { color: #4b5358; }",
    "    .actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }",
    "    .action, .panel, .session { border: 1px solid #dcd8cc; border-radius: 8px; background: white; padding: 14px; }",
    "    .action { display: grid; gap: 5px; text-decoration: none; color: #202124; }",
    "    .action strong { color: #2f6f5e; }",
    "    .panel { display: grid; gap: 10px; }",
    ...staticMirrorI18nCss(),
    ...returnReadyBadgeCss(),
    "    .steps { margin: 0; padding-left: 22px; }",
    "    .steps li { padding-left: 2px; }",
    "    .steps strong { display: block; color: #2f6f5e; }",
    "    .device-next-panel { border-left: 4px solid #2f6f5e; background: #eef6f3; }",
    "    .device-next-link { display: grid; gap: 5px; color: #202124; text-decoration: none; }",
    "    .device-next-link:focus-visible { outline: 3px solid #315f82; outline-offset: 3px; }",
    "    .device-next-link:hover strong, .device-next-link:focus-visible strong { text-decoration: underline; }",
    "    .device-next-link strong { color: #2f6f5e; }",
    "    .device-next-link span, .device-next-link small { color: #4b5358; }",
    "    .device-next-secondary { align-self: start; display: inline-flex; align-items: center; min-height: 32px; padding: 5px 9px; border: 1px solid #b9d7cb; border-radius: 8px; background: #fff; color: #315f82; font-size: 13px; font-weight: 700; text-decoration: none; }",
    "    .device-next-secondary:focus-visible { outline: 3px solid #315f82; outline-offset: 3px; }",
    "    span.device-next-secondary { min-height: auto; padding: 0; border-color: transparent; background: transparent; color: #697077; font-weight: 600; }",
    "    ul { margin: 0; padding-left: 20px; }",
    "    li { margin: 8px 0; }",
    "    .sessions { display: grid; gap: 8px; }",
    "    .session { display: grid; gap: 5px; }",
    "    a { color: #315f82; }",
    "    @media (max-width: 620px) { body { padding: 12px; } .actions { grid-template-columns: 1fr; } }",
    "  </style>",
    "</head>",
    "<body>",
    ...staticMirrorLanguageToggleHtml(),
    "  <main>",
    ...staticNoScriptHtml(),
    "    <header>",
    `      <h1>${i18nText("Learning Companion Mirror", "学习伴侣镜像")}</h1>`,
    `      <p class="summary">${i18nText(`Generated at ${pack.generatedAt} · ${formatCount(pack.stats.sessions, "session")} · ${formatCount(pack.stats.questions, "open question")} · ${formatCount(pack.stats.due, "due card")} · source of truth: workspace.json`, `生成于 ${pack.generatedAt} · ${pack.stats.sessions} 个主题 · ${pack.stats.questions} 个开放问题 · ${pack.stats.due} 张到期卡 · 事实来源：workspace.json`)}</p>`,
    "    </header>",
    ...returnReadyBadgeHtml({ bilingual: true }),
    "    <section class=\"panel device-next-panel\" aria-label=\"Next from this export\">",
    `      <h2>${i18nText("Next from this export", "本次导出的下一步")}</h2>`,
    `      <a class="device-next-link" href="${htmlAttribute(mirrorDeviceAction.href)}"${mirrorDeviceAction.external ? ' target="_blank" rel="noreferrer noopener"' : ""}><strong>${i18nText(mirrorDeviceAction.label, mirrorDeviceAction.labelZh)}</strong><span>${i18nText(mirrorDeviceAction.detail, mirrorDeviceAction.detailZh)}</span><small>${i18nText(`${mirrorDeviceAction.meta} · As of ${pack.generatedAt} · Static mirror. Save a return file when done.`, `${mirrorDeviceAction.metaZh} · 截至 ${pack.generatedAt} · 静态镜像。完成后保存返回文件。`)}</small></a>`,
    ...(mirrorDeviceAction.secondary ? [mirrorDeviceAction.secondaryHref
      ? `      <a class="device-next-secondary" href="${htmlAttribute(mirrorDeviceAction.secondaryHref)}">${i18nText(mirrorDeviceAction.secondary, mirrorDeviceAction.secondaryZh || mirrorDeviceAction.secondary)}</a>`
      : `      <span class="device-next-secondary">${i18nText(mirrorDeviceAction.secondary, mirrorDeviceAction.secondaryZh || mirrorDeviceAction.secondary)}</span>`] : []),
    "    </section>",
    "    <nav class=\"actions\" aria-label=\"Mirror entry points\">",
    `      <a class="action" href="TODAY.md"><strong>${i18nText("Today", "今日")}</strong><span>${i18nText("Due review, open questions, and recent captures", "到期复习、开放问题和最近摘录")}</span></a>`,
    `      <a class="action" href="review.html"><strong>${i18nText("Review", "复习")}</strong><span>${i18nText("Grade cards, then save a return file", "给卡片评分，然后保存返回文件")}</span></a>`,
    `      <a class="action" href="inbox.html"><strong>${i18nText("Inbox", "收件箱")}</strong><span>${i18nText("Capture on mobile or Windows, then save a return file", "在手机或 Windows 上摘录，然后保存返回文件")}</span></a>`,
    `      <a class="action" href="workspace.json"><strong>${i18nText("Restore", "恢复")}</strong><span>${i18nText("Canonical workspace JSON", "权威工作区 JSON")}</span></a>`,
    "    </nav>",
    "    <section class=\"panel\">",
    `      <h2>${i18nText("Manual Return", "手动返回")}</h2>`,
    "      <ol class=\"steps\">",
    `        <li><strong>${i18nText("Read Today", "阅读今日")}</strong><span>${i18nText("Start with the due cards, open questions, and latest capture context.", "从到期卡片、开放问题和最新摘录上下文开始。")}</span></li>`,
    `        <li><strong>${i18nText("Work here", "在这里处理")}</strong><span>${i18nText("Use Review for due cards or Inbox for mobile/Windows notes and answers.", "用复习处理到期卡，用收件箱记录手机/Windows 笔记和回答。")}</span></li>`,
    `        <li><strong>${i18nText("Return file back to Mac", "把返回文件带回 Mac")}</strong><span>${i18nText("Save a return file, move it back yourself, then import it from Today > Return Files.", "保存返回文件，自行带回，然后从今日 > 返回文件导入。")}</span></li>`,
    "      </ol>",
    `      <p class="summary">${i18nText("Static mirror only. This page does not live sync with the Mac workspace.", "仅静态镜像。此页面不会与 Mac 工作区实时同步。")}</p>`,
    "    </section>",
    "    <section class=\"panel\">",
    `      <h2>${i18nText("Resume Here", "从这里继续")}</h2>`,
    `      <p><strong>${i18nText(mirrorNextAction.label, mirrorNextAction.labelZh)}</strong> <span>${i18nText(mirrorNextAction.detail, mirrorNextAction.detailZh)}</span></p>`,
    `      <p class="why">${i18nText(`Why: ${mirrorNextAction.reason}`, `原因：${mirrorNextAction.reasonZh}`)}</p>`,
    `      <p>${i18nText("Session:", "主题：")} <a href="${htmlAttribute(brief.sessionPath)}">${htmlText(brief.sessionTitle)}</a></p>`,
    `      <p>${i18nText("Source:", "来源：")} ${sourceLine}</p>`,
    `      <p>${i18nText("Latest:", "最新：")} ${latestLine}</p>`,
    `      <ul>${signalList}</ul>`,
    "    </section>",
    "    <section class=\"panel\">",
    `      <h2>${i18nText("Due Review Preview", "到期复习预览")}</h2>`,
    `      <ul>${dueList}</ul>`,
    "    </section>",
    "    <section class=\"panel\">",
    `      <h2>${i18nText("Open Question Preview", "开放问题预览")}</h2>`,
    `      <ul>${questionList}</ul>`,
    "    </section>",
    "    <section class=\"panel\">",
    `      <h2>${i18nText("Recent Capture Preview", "最近摘录预览")}</h2>`,
    `      <ul>${recentList}</ul>`,
    "    </section>",
    "    <section class=\"panel\">",
    `      <h2>${i18nText("Sessions", "主题")}</h2>`,
    `      <div class="sessions">${sessionLinks.join("\n")}</div>`,
    "    </section>",
    "  </main>",
    "</body>",
    "</html>",
    ""
  ].join("\n");
}

function buildMirrorDeviceAction(pack, brief = null) {
  if (pack.dueItems.length) {
    const [questionItem] = pack.questionItems;
    const secondaryHref = questionItem ? buildInboxAnswerHref(questionItem.sessionId, questionItem.capture) : "inbox.html";
    return {
      href: "review.html",
      label: "Review due cards",
      labelZh: "复习到期卡片",
      detail: "Grade the due queue here, then save a return file for Mac.",
      detailZh: "在这里完成到期队列评分，然后为 Mac 保存返回文件。",
      meta: formatCount(pack.stats.due, "due card"),
      metaZh: `${pack.stats.due} 张到期卡`,
      secondary: pack.stats.questions ? `Also answer ${formatCount(pack.stats.questions, "open question")} in Inbox.` : "",
      secondaryZh: pack.stats.questions ? `也可以在收件箱回答 ${pack.stats.questions} 个开放问题。` : "",
      secondaryHref: pack.stats.questions ? secondaryHref : ""
    };
  }
  if (pack.questionItems.length) {
    const item = pack.questionItems[0];
    return {
      href: buildInboxAnswerHref(item.sessionId, item.capture),
      label: "Answer next question",
      labelZh: "回答下一个问题",
      detail: summarizeMirrorDeviceAction(item.capture?.thought || item.capture?.quote || "Open question"),
      detailZh: summarizeMirrorDeviceAction(item.capture?.thought || item.capture?.quote || "开放问题"),
      meta: formatCount(pack.stats.questions, "open question"),
      metaZh: `${pack.stats.questions} 个开放问题`,
      secondary: ""
    };
  }
  const source = brief?.source;
  if (source?.href) {
    const sourceLabel = cleanText(source.title || "Source", MAX_TITLE_LENGTH) || "Source";
    const timestamp = cleanText(source.timestamp, 32);
    return {
      href: source.href,
      label: timestamp ? "Resume source on this device" : "Read source on this device",
      labelZh: timestamp ? "在此设备继续来源" : "在此设备阅读来源",
      detail: `${sourceLabel}${timestamp ? ` @ ${timestamp}` : ""} · then return to Inbox to save a note for Mac.`,
      detailZh: `${sourceLabel}${timestamp ? ` @ ${timestamp}` : ""} · 然后回到收件箱，为 Mac 保存笔记。`,
      meta: timestamp ? "Source moment available; come back to this mirror tab for return JSON" : "Source linked; come back to this mirror tab for return JSON",
      metaZh: timestamp ? "来源时刻可用；返回这个镜像标签页生成返回 JSON" : "来源已连接；返回这个镜像标签页生成返回 JSON",
      secondary: "Then capture in Inbox.",
      secondaryZh: "然后在收件箱摘录。",
      secondaryHref: "inbox.html",
      external: true
    };
  }
  return {
    href: "inbox.html",
    label: "Capture on this device",
    labelZh: "在此设备摘录",
    detail: "Add a note here, then save a return file for Mac.",
    detailZh: "在这里添加笔记，然后为 Mac 保存返回文件。",
    meta: "No due cards or open questions; return by JSON",
    metaZh: "没有到期卡或开放问题；通过 JSON 返回",
    secondary: ""
  };
}

function summarizeMirrorDeviceAction(value) {
  const text = cleanText(value, 140);
  if (!text) return "Use Inbox for a quick append-only capture.";
  return text.length > 120 ? `${text.slice(0, 117).trimEnd()}...` : text;
}

export function getSynthesisStats(session) {
  const captures = Array.isArray(session.captures) ? session.captures : [];
  const reviewCards = Array.isArray(session.reviewCards) ? session.reviewCards : [];
  return {
    captures: captures.length,
    questions: captures.filter((capture) => captureHasOpenQuestion(capture)).length,
    cards: reviewCards.length
  };
}

function buildInboxAnswerHref(sessionId, capture) {
  const answerToCaptureId = cleanQueryParam(capture?.id, 128);
  if (!answerToCaptureId) return "inbox.html";
  const params = new URLSearchParams();
  params.set("topicId", cleanQueryParam(sessionId, 128));
  params.set("quote", cleanQueryParam(capture?.thought || capture?.quote || "Untitled question", MAX_CAPTURE_TEXT_LENGTH));
  params.set("thought", "Answer:");
  params.set("answerToCaptureId", answerToCaptureId);
  if (capture?.timestamp) params.set("timestamp", cleanQueryParam(capture.timestamp, 32));
  const tags = normalizeTags([...(capture?.tags || []), "answer"]).join(", ");
  if (tags) params.set("tags", tags);
  return `inbox.html?${params.toString()}`;
}

function cleanQueryParam(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function captureHasQuestion(capture) {
  return isQuestionText(cleanText(capture?.thought, MAX_CAPTURE_TEXT_LENGTH));
}

export function captureHasOpenQuestion(capture) {
  return captureHasQuestion(capture) && !capture?.questionResolvedAt && !capture?.questionParkedAt;
}

export function captureHasParkedQuestion(capture) {
  return captureHasQuestion(capture) && !capture?.questionResolvedAt && Boolean(capture?.questionParkedAt);
}

export function captureHasResolvedQuestion(capture) {
  return captureHasQuestion(capture) && Boolean(capture?.questionResolvedAt);
}

export function captureHasAnswer(capture) {
  return classifyAnswerCapture(capture).isAnswer;
}

export function captureHasReviewReadyAnswer(capture) {
  return captureHasAnswer(capture) && answerTextIsReviewReady(answerCaptureText(capture));
}

function classifyAnswerCapture(capture) {
  const answerTargetId = cleanAnswerTargetId(capture?.answersQuestionCaptureId);
  if (answerTargetId) return { isAnswer: true, reason: "linked-question" };
  const thought = cleanText(capture?.thought, MAX_CAPTURE_TEXT_LENGTH);
  const strippedThought = thought.replace(/^(?:a|answer)\s*[:：]\s*/i, "").trim();
  const body = strippedThought || (!thought ? cleanText(capture?.quote, MAX_CAPTURE_TEXT_LENGTH) : "");
  if (normalizeTags(capture?.tags || []).includes("answer") && body.length >= 12) {
    return { isAnswer: true, reason: "tagged-answer" };
  }
  if (/^(?:a|answer)\s*[:：]\s*/i.test(thought) && body.length >= 12) {
    return { isAnswer: true, reason: "answer-prefix" };
  }
  return { isAnswer: false, reason: "" };
}

function resolvedQuestionTime(capture) {
  return boundedTime(capture?.questionResolvedAt);
}

function boundedTime(value) {
  if (!value) return Number.NaN;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.NaN;
}

export function getSynthesisSourceStamp(session) {
  return fingerprintText(JSON.stringify({
    sourceTitle: session?.sourceTitle || "",
    sourceUrl: session?.sourceUrl || "",
    captures: (Array.isArray(session?.captures) ? session.captures : []).map((capture) => ({
      id: capture.id,
      quote: capture.quote,
      thought: capture.thought,
      timestamp: capture.timestamp,
      questionResolvedAt: capture.questionResolvedAt || null,
      questionParkedAt: capture.questionParkedAt || null,
      updatedAt: capture.updatedAt
    })).sort((a, b) => String(a.id || "").localeCompare(String(b.id || ""))),
    reviewCards: (Array.isArray(session?.reviewCards) ? session.reviewCards : []).map((card) => ({
      id: card.id,
      prompt: card.prompt,
      answer: card.answer,
      evidenceCaptureId: card.evidenceCaptureId || "",
      updatedAt: card.updatedAt
    })).sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")))
  }));
}

export function buildFeishuPayload(session, now = new Date()) {
  return {
    schema: "learning-companion.feishu-export.v1",
    exportedAt: Number.isFinite(now?.getTime?.()) ? now.toISOString() : nowIso(),
    target: {
      drive: "markdown-plus-json",
      docTitle: session.title
    },
    focusBrief: buildFocusBrief(session, null, now),
    session,
    markdown: generateMarkdown(session)
  };
}

export function buildMirrorBundle(workspace, options = {}) {
  const exportedAt = optionIso(options.exportedAt) || nowIso();
  const cleanWorkspace = sanitizeWorkspace(workspace);
  const workspaceJson = JSON.stringify(cleanWorkspace, null, 2);
  const workspaceFingerprint = fingerprintText(workspaceJson);
  const returnBaseFingerprint = buildReturnBaseFingerprint(cleanWorkspace);
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
        content: JSON.stringify(buildFeishuPayload(session, new Date(exportedAt)), null, 2)
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
      sourceReturnBaseFingerprint: returnBaseFingerprint,
      content: generateReviewHtml(cleanWorkspace, new Date(exportedAt))
    }),
    makeMirrorFile({
      path: "inbox.html",
      mediaType: "text/html",
      role: "mobile-inbox",
      sourceFingerprint: workspaceFingerprint,
      sourceReturnBaseFingerprint: returnBaseFingerprint,
      content: generateInboxHtml(cleanWorkspace, new Date(exportedAt))
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
    derived: ["index.html", "README.md", "TODAY.md", "review.html", "inbox.html", "sessions/*.md", "sessions/*.feishu.json"],
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

export function buildMirrorZip(workspace, options = {}) {
  const bundle = buildMirrorBundle(workspace, options);
  const files = bundle.files.map((file) => ({
    path: file.path,
    content: file.content
  }));
  const data = buildStoredZip(files, new Date(bundle.exportedAt));
  return {
    filename: "learning-companion-mirror.zip",
    mediaType: "application/zip",
    bytes: data.length,
    fileCount: files.length,
    bundleFingerprint: bundle.manifest.bundleFingerprint,
    data
  };
}

function normalizeImportedPatches(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, 128))
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index)
    .slice(-200);
}

function addSearchResult(results, needle, tokens, candidate) {
  const match = bestSearchMatch(candidate.fields, needle, tokens);
  if (!match) return;
  results.push({
    type: candidate.type,
    sessionId: candidate.sessionId,
    targetId: candidate.targetId,
    title: cleanText(candidate.title, MAX_TITLE_LENGTH) || "Untitled",
    meta: cleanText(candidate.meta, MAX_TITLE_LENGTH),
    excerpt: buildSearchExcerpt(match.value, needle),
    matchLabel: match.label,
    score: match.score
  });
}

function searchTokens(needle) {
  return needle
    .split(/[\s,.;:!?()[\]{}"'<>/\\|]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token, index, all) => all.indexOf(token) === index)
    .slice(0, 8);
}

function bestSearchMatch(fields, needle, tokens) {
  const normalizedFields = fields.map((field) => ({
    ...field,
    value: String(field.value || ""),
    lowerValue: String(field.value || "").toLocaleLowerCase()
  }));
  const exact = normalizedFields.reduce((best, field) => {
    if (!field.lowerValue.includes(needle)) return best;
    const match = {
      label: field.label,
      value: field.value,
      score: field.score + 24
    };
    return !best || match.score > best.score ? match : best;
  }, null);
  if (exact || !tokens.length) return exact;

  const matches = [];
  for (const token of tokens) {
    const match = normalizedFields.reduce((best, field) => {
      if (!field.lowerValue.includes(token)) return best;
      const candidate = {
        label: field.label,
        value: field.value,
        score: field.score
      };
      return !best || candidate.score > best.score ? candidate : best;
    }, null);
    if (!match) return null;
    matches.push(match);
  }

  const labels = matches
    .map((match) => match.label)
    .filter((label, index, all) => all.indexOf(label) === index);
  const primary = matches.reduce((best, match) => (match.score > best.score ? match : best), matches[0]);
  return {
    label: labels.length === 1 ? labels[0] : `${tokens.length} terms: ${labels.slice(0, 3).join(", ")}`,
    value: primary.value,
    score: primary.score + (tokens.length * 8) + (labels.length * 3)
  };
}

function buildSearchExcerpt(value, needle) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const index = text.toLocaleLowerCase().indexOf(needle);
  if (index < 0) return cleanText(text, 180);
  const start = Math.max(0, index - 48);
  const end = Math.min(text.length, index + needle.length + 92);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";
  return cleanText(`${prefix}${text.slice(start, end)}${suffix}`, 180);
}

function resolveInboxPatchTarget(workspace, patch) {
  const targetId = cleanText(patch.target?.topicId, 128);
  const targetTitle = cleanText(patch.target?.topicTitle, MAX_TITLE_LENGTH);
  const byId = workspace.sessions.find((session) => session.id === targetId);
  if (byId) return { session: byId, resolution: "id-match" };
  const byTitle = targetTitle
    ? workspace.sessions.find((session) => session.title === targetTitle)
    : null;
  if (byTitle) return { session: byTitle, resolution: "title-match" };
  return { session: getActiveSession(workspace), resolution: "active-fallback" };
}

function buildPatchFingerprintStatus(patch, workspace) {
  const sourceReturnBaseFingerprint = cleanText(patch?.source?.returnBaseFingerprint, 64);
  const currentReturnBaseFingerprint = workspace ? buildReturnBaseFingerprint(workspace) : "";
  const sourceWorkspaceFingerprint = cleanText(patch?.source?.workspaceFingerprint, 64);
  const currentWorkspaceFingerprint = workspace
    ? `fnv1a-${workspaceFingerprint(JSON.stringify(workspace, null, 2))}`
    : "";
  let sourceFingerprintMatches = null;
  let sourceFingerprintBasis = "missing";
  if (sourceReturnBaseFingerprint) {
    sourceFingerprintMatches = sourceReturnBaseFingerprint === currentReturnBaseFingerprint;
    sourceFingerprintBasis = "return-base";
  } else if (sourceWorkspaceFingerprint) {
    sourceFingerprintMatches = sourceWorkspaceFingerprint === currentWorkspaceFingerprint;
    sourceFingerprintBasis = "workspace";
  }
  return {
    sourceReturnBaseFingerprint,
    currentReturnBaseFingerprint,
    sourceWorkspaceFingerprint,
    currentWorkspaceFingerprint,
    sourceFingerprintBasis,
    sourceFingerprintMatches
  };
}

function buildInboxReceipt({
  patch,
  patchId,
  workspace,
  baseWorkspace,
  targetSession,
  targetResolution,
  added,
  skippedDuplicate,
  sanitizedSourceUrls = 0,
  answeredQuestions = 0,
  refreshableReviewCards = 0,
  skippedAnswerTargets = 0,
  answerTargetSkips = {},
  importedAt
}) {
  return {
    schema: "learning-companion.mobile-inbox-receipt.v1",
    patchId,
    importedAt: Number.isFinite(importedAt?.getTime?.()) ? importedAt.toISOString() : nowIso(),
    targetResolution,
    targetSessionId: targetSession.id,
    targetSessionTitle: targetSession.title,
    sourceTopicTitle: cleanText(patch.source?.topicTitle || patch.target?.topicTitle || "", MAX_TITLE_LENGTH),
    added,
    skippedDuplicate,
    sanitizedSourceUrls,
    answeredQuestions,
    refreshableReviewCards,
    skippedAnswerTargets,
    answerTargetSkips: {
      invalid: Number(answerTargetSkips.invalid) || 0,
      selfReference: Number(answerTargetSkips.selfReference) || 0,
      patchReference: Number(answerTargetSkips.patchReference) || 0,
      missing: Number(answerTargetSkips.missing) || 0,
      nonQuestion: Number(answerTargetSkips.nonQuestion) || 0,
      alreadyClosed: Number(answerTargetSkips.alreadyClosed) || 0
    },
    totalCaptures: Array.isArray(patch.captures) ? patch.captures.length : 0,
    workspaceSessionCount: workspace.sessions.length,
    ...buildPatchFingerprintStatus(patch, baseWorkspace || workspace)
  };
}

function normalizeInboxCapturedAt(value, now = new Date()) {
  const raw = cleanText(value, 64);
  if (!raw) return Number.isFinite(now?.getTime?.()) ? now.toISOString() : nowIso();
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : nowIso();
}

function buildReviewProgressReceipt({
  patch,
  patchId,
  baseWorkspace,
  targetResolution,
  applied,
  skippedDuplicate = 0,
  skippedMissing = 0,
  skippedConflict = 0,
  skippedInvalid = 0,
  totalEvents,
  importedAt
}) {
  return {
    schema: "learning-companion.review-progress-receipt.v1",
    patchId,
    importedAt: Number.isFinite(importedAt?.getTime?.()) ? importedAt.toISOString() : nowIso(),
    targetResolution,
    applied,
    skippedDuplicate,
    skippedMissing,
    skippedConflict,
    skippedInvalid,
    totalEvents,
    ...buildPatchFingerprintStatus(patch, baseWorkspace)
  };
}

function normalizeReviewProgressDate(value, now = new Date()) {
  const raw = cleanText(value, 64);
  if (!raw) return Number.isFinite(now?.getTime?.()) ? now : new Date();
  const date = new Date(raw);
  return Number.isFinite(date.getTime())
    ? date
    : Number.isFinite(now?.getTime?.()) ? now : new Date();
}

function buildFocusBriefWarnings(session, capturesSinceLastSynthesis, synthesisDue, sourceHref, questionCount = 0) {
  const captures = Array.isArray(session?.captures) ? session.captures : [];
  return [
    !sourceHref ? {
      kind: "missing_source",
      label: "Source missing",
      detail: "Add the browser URL so captures can jump back to the material."
    } : null,
    captures.length && !cleanText(session?.notesMarkdown || "", MAX_NOTE_LENGTH) ? {
      kind: "notes_empty",
      label: "Notes empty",
      detail: "Move at least one capture into notes before ending the session."
    } : null,
    // Warning targets are optional, navigation-only hints for clients; they must not promote a warning
    // into the primary Focus Brief nextAction.
    questionCount > 0 ? {
      kind: "open_questions",
      label: formatCount(questionCount, "open question"),
      detail: "Captured questions are parked for synthesis or review before closing the loop.",
      actionLabel: "Open questions",
      targetTab: "today",
      targetSection: "open_questions"
    } : null,
    synthesisDue ? {
      kind: "needs_synthesis",
      label: "Synthesis due",
      detail: `${capturesSinceLastSynthesis} captures are waiting for a synthesis block.`
    } : null
  ].filter(Boolean);
}

function chooseFocusNextAction({ dueCards, workspaceDueCards, capturesSinceLastSynthesis, synthesisDue, sourceHref, hasRecentCapture }) {
  if (dueCards > 0) {
    return {
      kind: "review",
      label: `Review ${formatCount(dueCards, "due card")}`,
      detail: "Reveal and grade before adding more material.",
      reason: "Active topic has due review due now.",
      focusMode: "review",
      tab: "review"
    };
  }
  if (workspaceDueCards > 0) {
    return {
      kind: "review",
      label: `Review ${formatCount(workspaceDueCards, "workspace due card")}`,
      detail: "Due cards exist outside the active topic; queue is earliest due, then topic title.",
      reason: "Workspace review debt outranks adding new material.",
      focusMode: "review",
      tab: "review"
    };
  }
  if (synthesisDue) {
    return {
      kind: "synthesize",
      label: "Build synthesis",
      detail: `${capturesSinceLastSynthesis} captures are ready to compress into notes.`,
      reason: "Unsynthesized captures reached the compression threshold.",
      focusMode: "synthesize",
      tab: "captures"
    };
  }
  if (sourceHref && !hasRecentCapture) {
    return {
      kind: "capture",
      label: "Capture next point",
      detail: `No capture in the last ${FOCUS_BRIEF_CAPTURE_IDLE_MINUTES} minutes.`,
      reason: "The source is available and the session has gone quiet.",
      focusMode: "capture",
      tab: "captures"
    };
  }
  if (sourceHref) {
    return {
      kind: "continue",
      label: "Keep reading",
      detail: "The source is open; capture the next idea that changes your model.",
      reason: "A recent capture exists, so the best next step is to keep reading.",
      focusMode: "capture",
      tab: "captures"
    };
  }
  return {
    kind: "open_source",
    label: "Add source",
    detail: "Paste the browser URL before capturing more notes.",
    reason: "Source context is missing, so captures would be hard to revisit.",
    focusMode: "capture",
    tab: "captures"
  };
}

function isFocusSynthesisDue(capturesSinceLastSynthesis, hasCurrentSynthesis) {
  return capturesSinceLastSynthesis >= FOCUS_BRIEF_SYNTHESIS_CAPTURE_THRESHOLD && !hasCurrentSynthesis;
}

// Ignore incidental question marks in code or URLs; an explicit Question: prefix is also a study question signal.
function isQuestionText(value) {
  const text = String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/\bhttps?:\/\/\S+/gi, " ")
    .replace(/\bwww\.\S+/gi, " ");
  const prefixed = text.match(/^(?:q|question)\s*[:：]\s*(.+)$/i);
  if (prefixed) return Boolean(prefixed[1].trim());
  return /[?？]/.test(text);
}

function hasSynthesisBlock(notesMarkdown) {
  return /<!-- learning-companion:synthesis:start -->[\s\S]*?<!-- learning-companion:synthesis:end -->/.test(String(notesMarkdown || ""));
}

function getSynthesisBlockStamp(notesMarkdown) {
  return String(notesMarkdown || "").match(/<!-- learning-companion:synthesis-source:([A-Za-z0-9._:-]+) -->/)?.[1] || "";
}

function formatCount(count, singular) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function formatCountZh(count, unit) {
  return `${count} ${unit}`;
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

function formatCaptureSource(capture, session, language = "en") {
  const sourceTitle = cleanText(capture.sourceTitle || session.sourceTitle, MAX_TITLE_LENGTH);
  const sourceUrl = buildSourceJumpUrl(capture.sourceUrl || session.sourceUrl, capture.timestamp);
  if (!sourceTitle && !sourceUrl) return "";
  if (language === "zh") {
    if (sourceUrl) return `来源：[${sourceTitle || "打开来源"}](${sourceUrl})`;
    return `来源：${sourceTitle}`;
  }
  if (sourceUrl) return `Source: [${sourceTitle || "Open source"}](${sourceUrl})`;
  return `Source: ${sourceTitle}`;
}

function generateMirrorReadme(workspace, sessionFiles) {
  const lines = [
    "# Learning Companion Mirror",
    "_中文：学习伴侣镜像_",
    "",
    "This bundle is an experimental full snapshot for export/restore. It is not the final Feishu Drive folder layout.",
    "中文：这是用于导出/恢复的实验性完整快照，还不是最终的飞书云文档文件夹布局。",
    "",
    `Exported sessions: ${workspace.sessions.length}`,
    `导出主题数：${workspace.sessions.length}`,
    `Workspace schema: ${workspace.schema} v${workspace.schemaVersion}`,
    `工作区 schema：${workspace.schema} v${workspace.schemaVersion}`,
    "",
    "## Restore",
    "_中文：恢复_",
    "",
    "- Keep `workspace.json` as the canonical restore payload.",
    "  - 中文：把 `workspace.json` 作为权威恢复载荷保留。",
    "- Open `TODAY.md` first for a portable due-review and recent-capture study pack.",
    "  - 中文：先打开 `TODAY.md`，它是可携带的到期复习和最近摘录学习包。",
    "- Use `sessions/*.md` as readable Feishu Drive/Docs material.",
    "  - 中文：把 `sessions/*.md` 当作可阅读的飞书云文档/文档材料。",
    "- Keep `sessions/*.feishu.json` beside Markdown files for future round-trip sync.",
    "  - 中文：把 `sessions/*.feishu.json` 与 Markdown 文件放在一起，供未来往返同步使用。",
    "- A future uploader should translate this bundle into Drive files instead of uploading this JSON as the final layout.",
    "  - 中文：未来上传器应把这个 bundle 转换成云文档文件，而不是把这些 JSON 当作最终布局直接上传。",
    "",
    "## Files",
    "_中文：文件_",
    "File paths, schema names, role strings, and byte counts stay unchanged for sync.",
    "中文：文件路径、schema 名称、role 字符串和字节数为同步保持不变。",
    ""
  ];
  lines.push("- `README.md` (mirror-index)");
  lines.push("  - 中文：镜像说明");
  lines.push("- `index.html` (mirror-home)");
  lines.push("  - 中文：镜像首页");
  lines.push("- `TODAY.md` (study-pack)");
  lines.push("  - 中文：今日学习包");
  lines.push("- `review.html` (portable-review)");
  lines.push("  - 中文：可携带复习页");
  lines.push("- `inbox.html` (mobile-inbox)");
  lines.push("  - 中文：移动收件箱");
  lines.push("- `workspace.json` (workspace-restore)");
  lines.push("  - 中文：工作区恢复载荷");
  sessionFiles.forEach((file) => {
    lines.push(`- \`${file.path}\` (${file.role}, ${file.bytes} B)`);
  });
  return lines.join("\n").trim() + "\n";
}

function makeMirrorFile({ path, mediaType, role, sessionId = "", sourceFingerprint = "", sourceReturnBaseFingerprint = "", content }) {
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
    sourceReturnBaseFingerprint,
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
