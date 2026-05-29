export const WORKSPACE_SCHEMA = "learning-companion.workspace.v1";
export const WORKSPACE_SCHEMA_VERSION = 1;
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
export const FOCUS_BRIEF_SYNTHESIS_CAPTURE_THRESHOLD = 3;
export const FOCUS_BRIEF_CAPTURE_IDLE_MINUTES = 10;
export const CAPTURE_DRAFT_FOCUS_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const CAPTURE_DRAFT_LIMIT = 50;
// Keep the warning below common 5 MB localStorage quotas so export prompts arrive before writes fail.
export const WORKSPACE_STORAGE_WARNING_BYTES = 3_500_000;
export const WORKSPACE_BACKUP_STALE_DAYS = 7;

const MATERIAL_TYPES = new Set(["article", "video", "doc", "course", "book", "other"]);
const FOCUS_MODES = new Set(["capture", "synthesize", "review"]);
const SAFE_URL_SCHEMES = new Set(["http:", "https:"]);

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

export function normalizeCaptureDraft(value, now = new Date()) {
  const draft = value && typeof value === "object" ? value : {};
  const updatedAt = Number.isFinite(new Date(draft.updatedAt).getTime())
    ? new Date(draft.updatedAt).toISOString()
    : new Date(now).toISOString();
  return {
    quote: cleanText(draft.quote, MAX_CAPTURE_TEXT_LENGTH),
    thought: cleanText(draft.thought, MAX_CAPTURE_TEXT_LENGTH),
    timestamp: cleanText(draft.timestamp, 32),
    updatedAt
  };
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

function isYouTubeHost(hostname) {
  return /(^|\.)youtube\.com$/i.test(hostname) || /^youtu\.be$/i.test(hostname);
}

function isBilibiliHost(hostname) {
  return /(^|\.)bilibili\.com$/i.test(hostname);
}

function isVimeoHost(hostname) {
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
  const importedPatches = normalizeImportedPatches(safeWorkspace.importedPatches);
  if (importedPatches.includes(patchId)) {
    return {
      workspace: safeWorkspace,
      receipt: buildInboxReceipt({
        patch,
        patchId,
        workspace: safeWorkspace,
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
      updatedAt: nowIso(),
      inboxPatchId: patchId,
      inboxCaptureId
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

  const nextWorkspace = {
    ...safeWorkspace,
    updatedAt: nowIso(),
    importedPatches: [...importedPatches, patchId].slice(-200),
    sessions: safeWorkspace.sessions.map((session) => session.id === target.session.id
      ? {
        ...session,
        captures: [...importedCaptures, ...session.captures],
        updatedAt: nowIso()
      }
      : session)
  };
  const finalWorkspace = sanitizeWorkspace(nextWorkspace);
  return {
    workspace: finalWorkspace,
    receipt: buildInboxReceipt({
      patch,
      patchId,
      workspace: finalWorkspace,
      targetSession: finalWorkspace.sessions.find((session) => session.id === target.session.id) || getActiveSession(finalWorkspace),
      targetResolution: target.resolution,
      added: importedCaptures.length,
      skippedDuplicate,
      sanitizedSourceUrls,
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
        patchId,
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
      patchId,
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
  const capture = {
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
    promotedToReview: Boolean(options.promoteToReview)
  };

  let createdCard = null;
  if (options.promoteToReview) {
    createdCard = createReviewCardFromCapture(capture, workspace.clientId, {
      prompt: options.reviewPrompt,
      answer: options.reviewAnswer,
      now: options.now
    });
  }

  return {
    ...workspace,
    updatedAt: timestamp,
    sessions: workspace.sessions.map((session) => {
      if (session.id !== sessionId) return session;
      return {
        ...session,
        captures: [capture, ...session.captures],
        reviewCards: createdCard ? [createdCard, ...session.reviewCards] : session.reviewCards,
        updatedAt: timestamp
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
  const timestamp = optionIso(overrides.now) || nowIso();
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

export function getOpenQuestionItems(workspace, limit = 6) {
  return workspace.sessions
    .flatMap((session) => session.captures
      .filter((capture) => captureHasQuestion(capture))
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

export function getStudyPackStats(workspace, now = new Date()) {
  return {
    sessions: workspace.sessions.length,
    captures: workspace.sessions.reduce((sum, session) => sum + session.captures.length, 0),
    questions: workspace.sessions.reduce((sum, session) => (
      sum + session.captures.filter((capture) => captureHasQuestion(capture)).length
    ), 0),
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
  const sourceHref = buildSourceJumpUrl(resumeSourceUrl, resumeTimestamp);
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
  const questionCount = captures.filter((capture) => captureHasQuestion(capture)).length;
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
  const recentLimit = Math.max(1, Number(limits.recentLimit) || 8);
  const sessionPaths = new Map(cleanWorkspace.sessions.map((session) => [session.id, getMirrorSessionPaths(session)]));
  const activeSession = getActiveSession(cleanWorkspace);
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
    questionDefinition: `latest ${questionLimit} open question captures by capturedAt`,
    dueDefinition: "review cards with dueAt <= generatedAt",
    stats: getStudyPackStats(cleanWorkspace, now),
    focusBrief: {
      ...buildFocusBrief(activeSession, cleanWorkspace, now),
      sessionPath: sessionPaths.get(activeSession.id)?.markdownPath || ""
    },
    dueItems: dueAll.slice(0, dueLimit),
    dueOverflow: Math.max(0, dueAll.length - dueLimit),
    questionItems: questionAll.slice(0, questionLimit),
    questionOverflow: Math.max(0, questionAll.length - questionLimit),
    recentCaptures: recentAll.slice(0, recentLimit),
    recentOverflow: Math.max(0, recentAll.length - recentLimit)
  };
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
    .filter((thought) => isQuestionText(thought));
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
  const brief = pack.focusBrief;
  const lines = [
    "<!-- Generated from workspace.json. Edits will be overwritten. Source of truth: workspace.json -->",
    "",
    "# Today Study Pack",
    "",
    `Generated at: ${pack.generatedAt}`,
    `Local day window: [${pack.localDayWindow.start}, ${pack.localDayWindow.end})`,
    `Due rule: ${pack.dueDefinition}`,
    `Open question rule: ${pack.questionDefinition}`,
    `Recent rule: ${pack.recentDefinition}`,
    `Workspace: ${formatCount(stats.sessions, "session")} / ${formatCount(stats.captures, "capture")} / ${formatCount(stats.questions, "open question")} / ${formatCount(stats.cards, "card")} / ${formatCount(stats.due, "due card")}`,
    "",
    "## Resume Here",
    "",
    `- Session: ${markdownRelativeLink(brief.sessionTitle, brief.sessionPath)}`,
    `- Next: ${markdownInline(brief.nextAction.label)} - ${markdownInline(brief.nextAction.detail)}`,
    `- Why: ${markdownInline(brief.nextAction.reason)}`,
    brief.source.href
      ? `- Source: [${markdownInline(brief.source.title || "Open source")}](${brief.source.href})`
      : "- Source: _Add a source URL before the next export._",
    brief.latestCapture
      ? `- Latest capture: ${markdownInline(brief.latestCapture.summary)}${brief.latestCapture.timestamp ? ` @ ${markdownInline(brief.latestCapture.timestamp)}` : ""}`
      : "- Latest capture: _No captures yet._",
    "",
    "### Resume Signals",
    ""
  ];

  if (brief.warnings.length) {
    brief.warnings.forEach((warning) => lines.push(`- ${markdownInline(warning.label)} - ${markdownInline(warning.detail)}`));
  } else {
    lines.push("- Session is ready to continue.");
  }

  lines.push(
    "",
    "## Due Review",
    ""
  );

  if (!pack.dueItems.length) {
    lines.push("_No cards are due right now._");
  } else {
    pack.dueItems.forEach(({ sessionTitle, sessionPath, card }) => {
      lines.push(`- ${markdownInline(card.prompt)} - ${markdownRelativeLink(sessionTitle, sessionPath)}`);
      lines.push(`  - Due: ${formatDate(card.dueAt)} · strength ${card.strength}`);
    });
    if (pack.dueOverflow) lines.push(`- +${pack.dueOverflow} more due cards in workspace.json`);
  }

  lines.push(
    "",
    "## Open Questions",
    "",
    "_Questions can also appear under Recent Captures; this section keeps unresolved study questions easy to scan._",
    ""
  );
  if (!pack.questionItems.length) {
    lines.push("_No open questions captured yet._");
  } else {
    pack.questionItems.forEach(({ sessionTitle, sessionPath, capture }) => {
      const question = markdownInline(capture.thought || capture.quote || "Untitled question");
      lines.push(`- ${question} - ${markdownRelativeLink(sessionTitle, sessionPath)}`);
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
    if (pack.questionOverflow) lines.push(`- +${pack.questionOverflow} more open questions in workspace.json`);
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

export function generateReviewPackMarkdown(workspaceData) {
  const safeWorkspace = sanitizeWorkspace(workspaceData);
  const active = getActiveSession(safeWorkspace);
  const mirror = buildMirrorBundle(safeWorkspace);
  const due = getDueReviewItems(safeWorkspace);
  const captures = safeWorkspace.sessions.reduce((sum, session) => sum + session.captures.length, 0);
  const cards = safeWorkspace.sessions.reduce((sum, session) => sum + session.reviewCards.length, 0);
  const focusBrief = buildFocusBrief(active, safeWorkspace);
  const focusReason = focusBrief.nextAction.reason || "No focus reason available.";
  return [
    "# Learning Companion Review Pack",
    "",
    "> Scope: local MVP fixture/internal build. This does not prove live Feishu sync, HarmonyOS device behavior, or signed Mac packaging.",
    "",
    "## Workspace",
    "",
    `- Sessions: ${safeWorkspace.sessions.length}`,
    `- Captures: ${captures}`,
    `- Review cards: ${cards}`,
    `- Due now: ${due.length}`,
    `- Active topic: ${active.title}`,
    `- Next action: ${focusBrief.nextAction.label}`,
    `- Why: ${focusReason}`,
    "",
    "## Export Artifacts",
    "",
    `- Workspace restore: \`learning-companion-workspace.json\` (${safeWorkspace.sessions.length} sessions)`,
    `- Mirror bundle: \`learning-companion-feishu-mirror.json\` (${mirror.manifest.fileCount} files, ${mirror.manifest.bundleFingerprint})`,
    "- Mirror ZIP: `learning-companion-feishu-mirror.zip` (manual folder package)",
    "- Today pack: `TODAY.md`",
    "- Current session Markdown and `.feishu.json` sidecar",
    "",
    "## Stage Wording",
    "",
    "- Mac: internal WKWebView shell, not signed production app.",
    "- Feishu: local mirror bundle plus upload plan/dry-run boundary, not live sync.",
    "- HarmonyOS: schema reader prototype, not device-verified app.",
    "",
    "## Morning Commands",
    "",
    "Offline headline gate:",
    "",
    "```bash",
    "npm run check:morning",
    "npm run demo:morning",
    "```",
    "",
    "Separate permissioned gates:",
    "",
    "```bash",
    "npm run check:morning:native",
    "npm run check:morning:browser",
    "```",
    "",
    "## Promotion Gates",
    "",
    "- Mac dogfood: run sidecar, clipboard capture, selected-text capture, browser context, import/export, and relaunch manual QA.",
    "- Feishu live writer: configure credentials explicitly, set Drive folder target, then compare upload report against dry-run report.",
    "- HarmonyOS app: import workspace or mirror bundle on device, render reader view, export append-only inbox/review patches.",
    ""
  ].join("\n");
}

export function generateReviewHtml(workspace, now = new Date()) {
  const cleanWorkspace = sanitizeWorkspace(workspace);
  const workspaceJson = JSON.stringify(cleanWorkspace, null, 2);
  const workspaceFingerprint = fingerprintText(workspaceJson);
  const pack = buildTodayPack(cleanWorkspace, now, { dueLimit: 50, recentLimit: 1 });
  const seed = JSON.stringify({
    schema: "learning-companion.review-progress-seed.v1",
    appVersion: WORKSPACE_SCHEMA_VERSION,
    generatedAt: pack.generatedAt,
    workspaceFingerprint,
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
      `  <div class="meta">${sessionLink} · Due ${htmlText(formatDate(card.dueAt))} · strength ${htmlText(card.strength)}</div>`,
      `  <h2>${htmlText(card.prompt)}</h2>`,
      '  <button type="button" data-reveal aria-expanded="false">Reveal</button>',
      `  <div class="answer" hidden>${htmlMultiline(card.answer)}</div>`,
      '  <div class="grade-actions" hidden>',
      '    <button type="button" data-grade="again">Again</button>',
      '    <button type="button" data-grade="good">Good</button>',
      '    <span class="review-state" aria-live="polite"></span>',
      "  </div>",
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
    "    .summary, .meta, .empty, output { color: #697077; font-size: 13px; }",
    "    .card { display: grid; gap: 12px; margin: 12px 0; padding: 14px; border: 1px solid #dcd8cc; border-radius: 8px; background: white; }",
    "    button { min-height: 36px; border: 1px solid #2f6f5e; border-radius: 8px; background: #2f6f5e; color: white; font-weight: 700; }",
    "    button.secondary { background: white; color: #202124; border-color: #dcd8cc; }",
    "    .progress-panel { display: grid; gap: 10px; margin: 14px 0; padding: 12px; border: 1px solid #dcd8cc; border-radius: 8px; background: white; }",
    "    .progress-actions, .grade-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }",
    "    pre { overflow: auto; max-height: 220px; white-space: pre-wrap; word-break: break-word; border: 1px solid #dcd8cc; border-radius: 8px; padding: 10px; background: #fbfaf6; font-size: 12px; }",
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
    "    <section class=\"progress-panel\" aria-label=\"Review progress patch\">",
    "      <div class=\"progress-actions\">",
    "        <button id=\"copyProgressBtn\" type=\"button\">Copy Progress</button>",
    "        <button id=\"downloadProgressBtn\" type=\"button\">Save Progress</button>",
    "        <button id=\"clearProgressBtn\" class=\"secondary\" type=\"button\">Clear Progress</button>",
    "      </div>",
    "      <output id=\"progressStatus\">Grade cards here, then import the progress patch on the Mac app.</output>",
    "      <pre id=\"progressPreview\"></pre>",
    "    </section>",
    cards.length ? cards.join("\n") : empty,
    "  </main>",
    "  <script>",
    `    const seed = ${seed};`,
    `    const PATCH_SCHEMA = ${JSON.stringify(REVIEW_PROGRESS_PATCH_SCHEMA)};`,
    "    const storageKey = `learning-companion.review-progress.${seed.workspaceFingerprint}`;",
    "    let progress = loadProgress();",
    "    document.addEventListener('click', (event) => {",
    "      const button = event.target.closest('[data-reveal]');",
    "      if (!button) return;",
    "      const answer = button.closest('.card')?.querySelector('.answer');",
    "      if (!answer) return;",
    "      const willShow = answer.hasAttribute('hidden');",
    "      answer.toggleAttribute('hidden', !willShow);",
    "      button.textContent = willShow ? 'Hide' : 'Reveal';",
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
    "      saveProgress();",
    "      renderProgress();",
    "    });",
    "    document.querySelector('#copyProgressBtn').addEventListener('click', async () => {",
    "      try { await navigator.clipboard.writeText(JSON.stringify(buildPatch(), null, 2)); setStatus('Progress copied.'); }",
    "      catch { setStatus('Copy failed. Use Save Progress.'); }",
    "    });",
    "    document.querySelector('#downloadProgressBtn').addEventListener('click', () => {",
    "      const body = JSON.stringify(buildPatch(), null, 2);",
    "      const blob = new Blob([body], { type: 'application/json' });",
    "      const url = URL.createObjectURL(blob);",
    "      const link = document.createElement('a');",
    "      link.href = url;",
    "      link.download = 'learning-companion-review-progress-patch.json';",
    "      link.click();",
    "      URL.revokeObjectURL(url);",
    "      setStatus('Progress patch saved. Import it on the Mac app.');",
    "    });",
    "    document.querySelector('#clearProgressBtn').addEventListener('click', () => { progress = { events: {} }; saveProgress(); renderProgress(); });",
    "    function buildPatch() {",
    "      return { schema: PATCH_SCHEMA, appVersion: seed.appVersion, patchId: makeId('review_patch'), createdAt: new Date().toISOString(), source: { generatedBy: 'review.html', workspaceFingerprint: seed.workspaceFingerprint }, events: Object.values(progress.events) };",
    "    }",
    "    function renderProgress() {",
    "      document.querySelectorAll('.card').forEach((cardEl) => {",
    "        const event = progress.events[cardEl.dataset.cardKey];",
    "        const state = cardEl.querySelector('.review-state');",
    "        if (state) state.textContent = event ? `Marked ${event.grade}` : '';",
    "      });",
    "      const count = Object.keys(progress.events).length;",
    "      document.querySelector('#progressPreview').textContent = JSON.stringify(buildPatch(), null, 2);",
    "      setStatus(count ? `${count} review ${count === 1 ? 'event' : 'events'} ready to import.` : 'Grade cards here, then import the progress patch on the Mac app.');",
    "    }",
    "    function loadProgress() { try { const value = JSON.parse(localStorage.getItem(storageKey) || '{}'); return { events: value.events && typeof value.events === 'object' ? value.events : {} }; } catch { return { events: {} }; } }",
    "    function saveProgress() { localStorage.setItem(storageKey, JSON.stringify(progress)); }",
    "    function makeId(prefix) { return `${prefix}_${randomIdPart()}`; }",
    "    function randomIdPart() { const cryptoApi = globalThis.crypto; if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID(); if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') { const bytes = new Uint8Array(16); cryptoApi.getRandomValues(bytes); return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''); } return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`; }",
    "    function setStatus(message) { document.querySelector('#progressStatus').textContent = message; }",
    "    renderProgress();",
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
    `  <meta name="learning-companion-generated-at" content="${htmlAttribute(formatLocalIso(now))}">`,
    "  <title>Learning Companion Inbox</title>",
    "  <style>",
    "    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f6f0; color: #202124; }",
    "    body { margin: 0; padding: 16px; }",
    "    main { max-width: 760px; margin: 0 auto; display: grid; gap: 14px; }",
    "    h1, h2, p { margin: 0; }",
    "    h1 { font-size: 24px; } h2 { font-size: 16px; }",
    "    .summary, label, .meta, output { color: #697077; font-size: 13px; }",
    "    .panel { display: grid; gap: 10px; border: 1px solid #dcd8cc; border-radius: 8px; background: white; padding: 14px; }",
    "    label { display: grid; gap: 5px; }",
    "    input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #dcd8cc; border-radius: 8px; padding: 10px; font: inherit; }",
    "    textarea { min-height: 96px; resize: vertical; }",
    "    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }",
    "    .actions { display: flex; flex-wrap: wrap; gap: 8px; }",
    "    button { min-height: 38px; border: 1px solid #2f6f5e; border-radius: 8px; background: #2f6f5e; color: white; font-weight: 700; padding: 0 12px; }",
    "    button.secondary { background: white; color: #202124; border-color: #dcd8cc; }",
    "    .capture { border: 1px solid #dcd8cc; border-radius: 8px; padding: 10px; background: #fbfaf6; }",
    "    pre { overflow: auto; white-space: pre-wrap; word-break: break-word; border: 1px solid #dcd8cc; border-radius: 8px; padding: 10px; background: #fbfaf6; font-size: 12px; }",
    "    @media (max-width: 560px) { body { padding: 12px; } .row { grid-template-columns: 1fr; } }",
    "  </style>",
    "</head>",
    "<body>",
    "  <main>",
    "    <header>",
    "      <h1>Learning Companion Inbox</h1>",
    `      <p class="summary">Generated at ${htmlText(formatLocalIso(now))} · exports append-only capture patches for the Mac workspace.</p>`,
    "    </header>",
    "    <section class=\"panel\" aria-label=\"New mobile capture\">",
    "      <label>Topic<select id=\"topicSelect\"></select></label>",
    "      <label>Quote<textarea id=\"quoteInput\" placeholder=\"Paste a quote or transcript line\"></textarea></label>",
    "      <label>Thought<textarea id=\"thoughtInput\" placeholder=\"Your thought, question, or takeaway\"></textarea></label>",
    "      <div class=\"row\">",
    "        <label>Time<input id=\"timestampInput\" placeholder=\"08:12\"></label>",
    "        <label>Tags<input id=\"tagsInput\" placeholder=\"ml, reading\"></label>",
    "      </div>",
    "      <div class=\"row\">",
    "        <label>Source<input id=\"sourceTitleInput\" placeholder=\"Page or video title\"></label>",
    "        <label>URL<input id=\"sourceUrlInput\" placeholder=\"https://\"></label>",
    "      </div>",
    "      <div class=\"actions\">",
    "        <button id=\"addCaptureBtn\" type=\"button\">Add Capture</button>",
    "        <button id=\"clearFormBtn\" class=\"secondary\" type=\"button\">Clear Form</button>",
    "      </div>",
    "      <output id=\"statusOutput\">Drafts stay in this browser until cleared.</output>",
    "    </section>",
    "    <section class=\"panel\" aria-label=\"Draft captures\">",
    "      <h2>Draft Captures</h2>",
    "      <div id=\"draftList\"></div>",
    "      <div class=\"actions\">",
    "        <button id=\"copyPatchBtn\" type=\"button\">Copy Patch</button>",
    "        <button id=\"downloadPatchBtn\" type=\"button\">Save Patch</button>",
    "        <button id=\"clearDraftsBtn\" class=\"secondary\" type=\"button\">Clear Drafts</button>",
    "      </div>",
    "      <pre id=\"patchPreview\"></pre>",
    "    </section>",
    "  </main>",
    "  <script>",
    `    const seed = ${seed};`,
    `    const PATCH_SCHEMA = ${JSON.stringify(MOBILE_INBOX_PATCH_SCHEMA)};`,
    "    const storageKey = `learning-companion.inbox.${seed.workspaceFingerprint}`;",
    "    const topicSelect = document.querySelector('#topicSelect');",
    "    const fields = {",
    "      quote: document.querySelector('#quoteInput'),",
    "      thought: document.querySelector('#thoughtInput'),",
    "      timestamp: document.querySelector('#timestampInput'),",
    "      tags: document.querySelector('#tagsInput'),",
    "      sourceTitle: document.querySelector('#sourceTitleInput'),",
    "      sourceUrl: document.querySelector('#sourceUrlInput')",
    "    };",
    "    let drafts = loadDrafts();",
    "    seed.topics.forEach((topic) => {",
    "      const option = document.createElement('option');",
    "      option.value = topic.id;",
    "      option.textContent = topic.title;",
    "      option.selected = topic.id === seed.activeSessionId;",
    "      topicSelect.append(option);",
    "    });",
    "    topicSelect.addEventListener('change', render);",
    "    document.querySelector('#addCaptureBtn').addEventListener('click', addCapture);",
    "    document.querySelector('#clearFormBtn').addEventListener('click', clearForm);",
    "    document.querySelector('#clearDraftsBtn').addEventListener('click', () => { drafts = []; saveDrafts(); render(); });",
    "    document.querySelector('#copyPatchBtn').addEventListener('click', async () => {",
    "      try { await navigator.clipboard.writeText(JSON.stringify(buildPatch(), null, 2)); setStatus('Patch copied.'); }",
    "      catch { setStatus('Copy failed. Use Save Patch.'); }",
    "    });",
    "    document.querySelector('#downloadPatchBtn').addEventListener('click', () => {",
    "      const body = JSON.stringify(buildPatch(), null, 2);",
    "      const blob = new Blob([body], { type: 'application/json' });",
    "      const url = URL.createObjectURL(blob);",
    "      const link = document.createElement('a');",
    "      link.href = url;",
    "      link.download = 'learning-companion-inbox-patch.json';",
    "      link.click();",
    "      URL.revokeObjectURL(url);",
    "      setStatus('Patch saved. Import it on the Mac app.');",
    "    });",
    "    function addCapture() {",
    "      if (!fields.quote.value.trim() && !fields.thought.value.trim()) { setStatus('Add quote or thought first.'); return; }",
    "      drafts.push({",
    "        id: makeId('inbox_capture'),",
    "        topicId: topicSelect.value,",
    "        quote: clean(fields.quote.value, 12000),",
    "        thought: clean(fields.thought.value, 12000),",
    "        timestamp: clean(fields.timestamp.value, 32),",
    "        tags: fields.tags.value,",
    "        sourceTitle: clean(fields.sourceTitle.value, 160),",
    "        sourceUrl: safeUrl(fields.sourceUrl.value),",
    "        sourceUrlProvided: Boolean(fields.sourceUrl.value.trim()),",
    "        materialType: currentTopic().materialType || 'other',",
    "        capturedAt: new Date().toISOString()",
    "      });",
    "      saveDrafts();",
    "      clearForm();",
    "      setStatus('Capture added to patch draft.');",
    "      render();",
    "    }",
    "    function buildPatch() {",
    "      const topic = currentTopic();",
    "      const topicDrafts = drafts.filter((item) => item.topicId === topic.id);",
    "      return {",
    "        schema: PATCH_SCHEMA,",
    "        appVersion: seed.appVersion,",
    "        patchId: makeId('inbox_patch'),",
    "        createdAt: new Date().toISOString(),",
    "        source: { generatedBy: 'inbox.html', workspaceFingerprint: seed.workspaceFingerprint, topicId: seed.activeSessionId, topicTitle: seed.topics.find((item) => item.id === seed.activeSessionId)?.title || '' },",
    "        target: { topicId: topic.id, topicTitle: topic.title },",
    "        captures: topicDrafts.map((item) => ({",
    "          id: item.id,",
    "          quote: item.quote,",
    "          thought: item.thought,",
    "          timestamp: item.timestamp,",
    "          sourceTitle: item.sourceTitle || topic.sourceTitle || '',",
    "          sourceUrl: item.sourceUrlProvided ? item.sourceUrl : safeUrl(topic.sourceUrl || ''),",
    "          materialType: item.materialType || topic.materialType || 'other',",
    "          tags: item.tags,",
    "          capturedAt: item.capturedAt",
    "        }))",
    "      };",
    "    }",
    "    function render() {",
    "      const topic = currentTopic();",
    "      const topicDrafts = drafts.filter((item) => item.topicId === topic.id);",
    "      document.querySelector('#draftList').replaceChildren(...(topicDrafts.length ? topicDrafts.map(renderDraft) : [emptyDraft()]));",
    "      document.querySelector('#patchPreview').textContent = JSON.stringify(buildPatch(), null, 2);",
    "    }",
    "    function renderDraft(item) {",
    "      const node = document.createElement('article');",
    "      node.className = 'capture';",
    "      const text = item.thought || item.quote || 'Untitled capture';",
    "      node.textContent = `${new Date(item.capturedAt).toLocaleString()} · ${text}`;",
    "      return node;",
    "    }",
    "    function emptyDraft() { const node = document.createElement('p'); node.className = 'meta'; node.textContent = 'No draft captures for this topic yet.'; return node; }",
    "    function currentTopic() { return seed.topics.find((topic) => topic.id === topicSelect.value) || seed.topics[0]; }",
    "    function loadDrafts() { try { return JSON.parse(localStorage.getItem(storageKey) || '[]').filter((item) => item && item.id); } catch { return []; } }",
    "    function saveDrafts() { localStorage.setItem(storageKey, JSON.stringify(drafts.slice(-50))); }",
    "    function clearForm() { Object.values(fields).forEach((field) => { field.value = ''; }); }",
    "    function clean(value, max) { return String(value || '').replace(/[\\u0000-\\u001f\\u007f]/g, '').trim().slice(0, max); }",
    "    function safeUrl(value) { const raw = clean(value, 2048); if (!raw) return ''; try { const url = new URL(raw); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }",
    "    function makeId(prefix) { return `${prefix}_${randomIdPart()}`; }",
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
    "    function setStatus(message) { document.querySelector('#statusOutput').textContent = message; }",
    "    render();",
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
  const brief = pack.focusBrief;
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
  const signalList = brief.warnings.length
    ? brief.warnings.map((warning) => `<li>${htmlText(warning.label)} <span>${htmlText(warning.detail)}</span></li>`).join("\n")
    : "<li>Session is ready to continue.</li>";
  const sourceLine = brief.source.href
    ? `<a href="${htmlAttribute(brief.source.href)}">${htmlText(brief.source.title || "Open source")}</a>`
    : "Add a source URL before the next export.";
  const latestLine = brief.latestCapture
    ? `${htmlText(brief.latestCapture.summary)}${brief.latestCapture.timestamp ? ` <span>@ ${htmlText(brief.latestCapture.timestamp)}</span>` : ""}`
    : "No captures yet.";

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
    "    .why { color: #4b5358; }",
    "    .actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }",
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
    "      <a class=\"action\" href=\"inbox.html\"><strong>Inbox</strong><span>Capture on mobile or Windows</span></a>",
    "      <a class=\"action\" href=\"workspace.json\"><strong>Restore</strong><span>Canonical workspace JSON</span></a>",
    "    </nav>",
    "    <section class=\"panel\">",
    "      <h2>Resume Here</h2>",
    `      <p><strong>${htmlText(brief.nextAction.label)}</strong> <span>${htmlText(brief.nextAction.detail)}</span></p>`,
    `      <p class="why">Why: ${htmlText(brief.nextAction.reason)}</p>`,
    `      <p>Session: <a href="${htmlAttribute(brief.sessionPath)}">${htmlText(brief.sessionTitle)}</a></p>`,
    `      <p>Source: ${sourceLine}</p>`,
    `      <p>Latest: ${latestLine}</p>`,
    `      <ul>${signalList}</ul>`,
    "    </section>",
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
    questions: captures.filter((capture) => captureHasQuestion(capture)).length,
    cards: reviewCards.length
  };
}

export function captureHasQuestion(capture) {
  return isQuestionText(cleanText(capture?.thought, MAX_CAPTURE_TEXT_LENGTH));
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
      updatedAt: capture.updatedAt
    })).sort((a, b) => String(a.id || "").localeCompare(String(b.id || ""))),
    reviewCards: (Array.isArray(session?.reviewCards) ? session.reviewCards : []).map((card) => ({
      id: card.id,
      prompt: card.prompt,
      answer: card.answer,
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
      content: generateReviewHtml(cleanWorkspace, new Date(exportedAt))
    }),
    makeMirrorFile({
      path: "inbox.html",
      mediaType: "text/html",
      role: "mobile-inbox",
      sourceFingerprint: workspaceFingerprint,
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
    filename: "learning-companion-feishu-mirror.zip",
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

function buildInboxReceipt({ patch, patchId, workspace, targetSession, targetResolution, added, skippedDuplicate, sanitizedSourceUrls = 0, importedAt }) {
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
    totalCaptures: Array.isArray(patch.captures) ? patch.captures.length : 0,
    workspaceSessionCount: workspace.sessions.length
  };
}

function normalizeInboxCapturedAt(value, now = new Date()) {
  const raw = cleanText(value, 64);
  if (!raw) return Number.isFinite(now?.getTime?.()) ? now.toISOString() : nowIso();
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : nowIso();
}

function buildReviewProgressReceipt({
  patchId,
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
    totalEvents
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
    questionCount > 0 ? {
      kind: "open_questions",
      label: formatCount(questionCount, "open question"),
      detail: "Captured questions are parked for synthesis or review before closing the loop."
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

// Ignore incidental question marks in code or URLs; the remaining prose is the study question signal.
function isQuestionText(value) {
  const text = String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/\bhttps?:\/\/\S+/gi, " ")
    .replace(/\bwww\.\S+/gi, " ");
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
  lines.push("- `inbox.html` (mobile-inbox)");
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
