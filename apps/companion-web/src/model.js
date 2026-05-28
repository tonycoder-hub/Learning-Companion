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

export function normalizeCapture(capture = {}, originClientId = makeId("client")) {
  const timestamp = nowIso();
  return {
    id: capture.id || makeId("capture"),
    quote: cleanText(capture.quote, MAX_CAPTURE_TEXT_LENGTH),
    thought: cleanText(capture.thought, MAX_CAPTURE_TEXT_LENGTH),
    timestamp: cleanText(capture.timestamp, 32),
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
  return {
    id: overrides.id || makeId("session"),
    originClientId,
    title: cleanText(overrides.title || "Untitled learning session", MAX_TITLE_LENGTH),
    sourceTitle: cleanText(overrides.sourceTitle || "", MAX_TITLE_LENGTH),
    sourceUrl: cleanUrl(overrides.sourceUrl || ""),
    materialType: MATERIAL_TYPES.has(overrides.materialType) ? overrides.materialType : "article",
    tags: normalizeTags(overrides.tags || []),
    focusMode: FOCUS_MODES.has(overrides.focusMode) ? overrides.focusMode : "capture",
    notesMarkdown: cleanText(overrides.notesMarkdown || "", MAX_NOTE_LENGTH),
    captures: Array.isArray(overrides.captures)
      ? overrides.captures.map((capture) => normalizeCapture(capture, originClientId))
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
  const capture = {
    id: makeId("capture"),
    quote,
    thought,
    timestamp: cleanText(captureInput.timestamp, 32),
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
  const files = [];
  const sessionFiles = cleanWorkspace.sessions.flatMap((session) => {
    const baseName = `${slugifyPath(session.title)}-${shortId(session.id)}`;
    return [
      makeMirrorFile({
        path: `sessions/${baseName}.md`,
        mediaType: "text/markdown",
        role: "readable-session",
        sessionId: session.id,
        content: generateMarkdown(session)
      }),
      makeMirrorFile({
        path: `sessions/${baseName}.feishu.json`,
        mediaType: "application/json",
        role: "session-sidecar",
        sessionId: session.id,
        content: JSON.stringify(buildFeishuPayload(session), null, 2)
      })
    ];
  });

  files.push(
    makeMirrorFile({
      path: "README.md",
      mediaType: "text/markdown",
      role: "mirror-index",
      content: generateMirrorReadme(cleanWorkspace, sessionFiles)
    }),
    makeMirrorFile({
      path: "workspace.json",
      mediaType: "application/json",
      role: "workspace-restore",
      content: JSON.stringify(cleanWorkspace, null, 2)
    }),
    ...sessionFiles
  );
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  if (totalBytes > MAX_MIRROR_BUNDLE_BYTES) {
    throw new Error("Mirror bundle is too large to export safely.");
  }
  const topicIndex = Object.fromEntries(cleanWorkspace.sessions.map((session) => {
    const baseName = `${slugifyPath(session.title)}-${shortId(session.id)}`;
    return [session.id, {
      title: session.title,
      markdownPath: `sessions/${baseName}.md`,
      sidecarPath: `sessions/${baseName}.feishu.json`
    }];
  }));
  const manifestFiles = files.map((file) => ({
    path: file.path,
    role: file.role,
    sessionId: file.sessionId,
    bytes: file.bytes,
    contentFingerprint: file.contentFingerprint
  }));

  return {
    schema: "learning-companion.mirror-bundle.staging.v1",
    contractStability: "experimental",
    exportedAt,
    canonical: "workspace.json",
    derived: ["README.md", "sessions/*.md", "sessions/*.feishu.json"],
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

function formatCount(count, singular) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
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
    "- Use `sessions/*.md` as readable Feishu Drive/Docs material.",
    "- Keep `sessions/*.feishu.json` beside Markdown files for future round-trip sync.",
    "- A future uploader should translate this bundle into Drive files instead of uploading this JSON as the final layout.",
    "",
    "## Files",
    ""
  ];
  sessionFiles.forEach((file) => {
    lines.push(`- \`${file.path}\` (${file.role}, ${file.bytes} B)`);
  });
  return lines.join("\n").trim() + "\n";
}

function makeMirrorFile({ path, mediaType, role, sessionId = "", content }) {
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
    bytes,
    contentFingerprint: fingerprintText(content),
    content
  };
}

function byteLength(value) {
  return new TextEncoder().encode(String(value || "")).length;
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
