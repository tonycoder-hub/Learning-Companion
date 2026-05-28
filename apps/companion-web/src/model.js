export const WORKSPACE_SCHEMA = "learning-companion.workspace.v1";

const MATERIAL_TYPES = new Set(["article", "video", "doc", "course", "book", "other"]);
const FOCUS_MODES = new Set(["capture", "synthesize", "review"]);

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

export function createSession(overrides = {}) {
  const timestamp = nowIso();
  return {
    id: overrides.id || makeId("session"),
    title: overrides.title || "Untitled learning session",
    sourceTitle: overrides.sourceTitle || "",
    sourceUrl: overrides.sourceUrl || "",
    materialType: MATERIAL_TYPES.has(overrides.materialType) ? overrides.materialType : "article",
    tags: normalizeTags(overrides.tags || []),
    focusMode: FOCUS_MODES.has(overrides.focusMode) ? overrides.focusMode : "capture",
    notesMarkdown: overrides.notesMarkdown || "",
    captures: Array.isArray(overrides.captures) ? overrides.captures : [],
    reviewCards: Array.isArray(overrides.reviewCards) ? overrides.reviewCards : [],
    createdAt: overrides.createdAt || timestamp,
    updatedAt: overrides.updatedAt || timestamp
  };
}

export function createDefaultWorkspace() {
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
  });
  return {
    schema: WORKSPACE_SCHEMA,
    version: 1,
    activeSessionId: session.id,
    sessions: [session],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

export function sanitizeWorkspace(input) {
  const workspace = input && typeof input === "object" ? input : createDefaultWorkspace();
  const sessions = Array.isArray(workspace.sessions) && workspace.sessions.length
    ? workspace.sessions.map((session) => createSession(session))
    : createDefaultWorkspace().sessions;
  const activeSessionId = sessions.some((session) => session.id === workspace.activeSessionId)
    ? workspace.activeSessionId
    : sessions[0].id;

  return {
    schema: WORKSPACE_SCHEMA,
    version: Number(workspace.version) || 1,
    activeSessionId,
    sessions,
    createdAt: workspace.createdAt || nowIso(),
    updatedAt: workspace.updatedAt || nowIso()
  };
}

export function getActiveSession(workspace) {
  return workspace.sessions.find((session) => session.id === workspace.activeSessionId) || workspace.sessions[0];
}

export function updateSession(workspace, sessionId, patch) {
  const updatedAt = nowIso();
  return {
    ...workspace,
    updatedAt,
    sessions: workspace.sessions.map((session) => {
      if (session.id !== sessionId) return session;
      const next = { ...session, ...patch, updatedAt };
      next.tags = normalizeTags(next.tags);
      next.materialType = MATERIAL_TYPES.has(next.materialType) ? next.materialType : "other";
      next.focusMode = FOCUS_MODES.has(next.focusMode) ? next.focusMode : "capture";
      return next;
    })
  };
}

export function addSession(workspace, title = "New learning session") {
  const session = createSession({ title });
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
  const quote = String(captureInput.quote || "").trim();
  const thought = String(captureInput.thought || "").trim();
  if (!quote && !thought) return workspace;

  const capture = {
    id: makeId("capture"),
    quote,
    thought,
    timestamp: String(captureInput.timestamp || "").trim(),
    tags: normalizeTags(captureInput.tags || []),
    createdAt: nowIso(),
    promotedToReview: Boolean(options.promoteToReview)
  };

  let createdCard = null;
  if (options.promoteToReview) {
    createdCard = createReviewCardFromCapture(capture);
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

export function createReviewCardFromCapture(capture) {
  const prompt = capture.thought
    ? `Recall the point behind: ${capture.thought}`
    : `Explain this excerpt: ${capture.quote.slice(0, 160)}`;
  const answer = [capture.quote, capture.timestamp ? `Time: ${capture.timestamp}` : ""]
    .filter(Boolean)
    .join("\n\n");
  return {
    id: makeId("card"),
    prompt,
    answer,
    sourceCaptureId: capture.id,
    dueAt: nowIso(),
    strength: 0,
    createdAt: nowIso()
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
        captures: session.captures.map((item) => item.id === captureId ? { ...item, promotedToReview: true } : item),
        reviewCards: [createReviewCardFromCapture(capture), ...session.reviewCards],
        updatedAt: nowIso()
      };
    })
  };
}

export function gradeCard(workspace, sessionId, cardId, delta) {
  return {
    ...workspace,
    updatedAt: nowIso(),
    sessions: workspace.sessions.map((session) => {
      if (session.id !== sessionId) return session;
      return {
        ...session,
        reviewCards: session.reviewCards.map((card) => {
          if (card.id !== cardId) return card;
          const strength = Math.max(0, Math.min(5, card.strength + delta));
          const days = Math.max(1, strength * strength);
          const dueAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
          return { ...card, strength, dueAt };
        }),
        updatedAt: nowIso()
      };
    })
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
