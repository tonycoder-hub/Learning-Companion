export const HARMONY_READER_SESSION_SCHEMA = "learning-companion.harmony-reader-session.v1";

export function createHarmonyReaderSessionState(options = {}) {
  const now = normalizeIso(options.now);
  return {
    schema: HARMONY_READER_SESSION_SCHEMA,
    updatedAt: now,
    currentView: options.view || null,
    lastImportReceipt: options.receipt || null,
    importStatus: {
      state: options.view ? "ready" : "empty",
      message: options.view ? "Reader view is ready." : "No workspace or mirror bundle has been imported.",
      changedView: Boolean(options.view)
    },
    storage: {
      status: options.view ? "pending-device-persistence" : "empty",
      adapter: "device-storage-not-wired",
      savedAt: "",
      key: ""
    },
    limitations: [
      "Session state is a prototype contract; no HarmonyOS storage adapter has executed it.",
      "Successful imports replace the current reader view only after schema parsing succeeds.",
      "Rejected imports keep the previous reader view visible.",
      "lastImportReceipt is a single-slot receipt for the most recent import attempt."
    ]
  };
}

export function applyHarmonyImportResult(state, result, options = {}) {
  const previous = state?.schema === HARMONY_READER_SESSION_SCHEMA
    ? state
    : createHarmonyReaderSessionState({ now: options.now });
  const receipt = result?.receipt || null;
  const now = normalizeIso(receipt?.importedAt || options.now);

  if (result?.ok && result.view) {
    return {
      ...previous,
      updatedAt: now,
      currentView: result.view,
      lastImportReceipt: receipt,
      importStatus: {
        state: "accepted-pending-persist",
        message: acceptedMessage(receipt, result.view),
        changedView: true
      },
      storage: {
        status: "pending-device-persistence",
        adapter: options.storageAdapter || "device-storage-not-wired",
        savedAt: "",
        key: ""
      }
    };
  }

  return {
    ...previous,
    updatedAt: now,
    lastImportReceipt: receipt,
    importStatus: {
      state: previous.currentView ? "rejected-kept-current" : "rejected-empty",
      message: rejectedMessage(receipt),
      changedView: false
    }
  };
}

export function markHarmonyReaderSessionPersisted(state, options = {}) {
  const previous = state?.schema === HARMONY_READER_SESSION_SCHEMA
    ? state
    : createHarmonyReaderSessionState({ now: options.now });
  if (!previous.currentView) return previous;
  const savedAt = normalizeIso(options.savedAt || options.now);
  return {
    ...previous,
    updatedAt: savedAt,
    storage: {
      status: "persisted-by-device-adapter",
      adapter: options.storageAdapter || "device-storage-not-wired",
      savedAt,
      key: String(options.key || "")
    },
    importStatus: {
      ...previous.importStatus,
      state: "ready",
      message: "Reader view is ready from the last accepted import."
    }
  };
}

export function summarizeHarmonyReaderSessionState(state) {
  if (!state?.currentView) {
    return state?.importStatus?.message || "No workspace or mirror bundle has been imported.";
  }
  const view = state.currentView;
  const topicCount = view.topics?.length || 0;
  const dueCount = view.dueReview?.length || 0;
  const openCount = view.workspace?.openQuestionCount || 0;
  const answerCount = view.workspace?.answerCaptureCountToday || 0;
  const storageStatus = state.storage?.status || "unknown";
  return `${topicCount} topics · ${dueCount} due · ${openCount} active questions · ${answerCount} answers today · ${storageStatus}`;
}

function acceptedMessage(receipt, view) {
  const source = receipt?.sourceKind || "portable data";
  const topicCount = receipt?.topicCount ?? view?.topics?.length ?? 0;
  const dueCount = receipt?.dueReviewCount ?? view?.dueReview?.length ?? 0;
  return `Imported ${source}: ${topicCount} topics and ${dueCount} due review cards.`;
}

function rejectedMessage(receipt) {
  if (!receipt) return "Import failed before a receipt was produced.";
  const code = receipt.errorCode || "UNKNOWN_IMPORT_ERROR";
  const message = receipt.message || "The selected file could not be imported.";
  return `${code}: ${message}`;
}

function normalizeIso(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}
