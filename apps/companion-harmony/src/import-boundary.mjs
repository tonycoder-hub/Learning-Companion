import {
  MOBILE_INBOX_PATCH_SCHEMA,
  REVIEW_PROGRESS_PATCH_SCHEMA,
  cleanText,
  isMirrorBundle,
  isMobileInboxPatchLike,
  isReviewProgressPatchLike,
  workspaceFromPortableData
} from "../../companion-web/src/model.js";
import {
  HARMONY_READER_VIEW_SCHEMA,
  buildHarmonyReaderView
} from "./schema-reader.mjs";

export const HARMONY_IMPORT_RECEIPT_SCHEMA = "learning-companion.harmony-import-receipt.v1";

export function importPortableForHarmony(portableData, options = {}) {
  const importedAt = normalizeIso(options.now);
  try {
    const workspace = workspaceFromPortableData(portableData);
    const view = buildHarmonyReaderView(workspace, { now: importedAt });
    return {
      ok: true,
      view,
      receipt: {
        schema: HARMONY_IMPORT_RECEIPT_SCHEMA,
        ok: true,
        importedAt,
        sourceKind: isMirrorBundle(portableData) ? "mirror-bundle" : "workspace",
        sourceSchema: portableData?.schema || "",
        readerViewSchema: HARMONY_READER_VIEW_SCHEMA,
        topicCount: view.topics.length,
        dueReviewCount: view.dueReview.length,
        mode: view.mode,
        limitations: view.limitations
      }
    };
  } catch (error) {
    return {
      ok: false,
      view: null,
      receipt: {
        schema: HARMONY_IMPORT_RECEIPT_SCHEMA,
        ok: false,
        importedAt,
        sourceKind: classifyRejectedPortableData(portableData),
        sourceSchema: portableData?.schema || "",
        errorCode: harmonyImportErrorCode(portableData),
        message: error.message || "HarmonyOS import failed"
      }
    };
  }
}

export function buildHarmonyPatchEnvelope(kind, options = {}) {
  const patchId = cleanText(options.patchId, 128);
  if (!patchId) {
    throw new Error("Harmony patch envelope requires patchId.");
  }
  const createdAt = normalizeIso(options.now);
  const target = {
    topicId: cleanText(options.target?.topicId, 128),
    topicTitle: cleanText(options.target?.topicTitle, 160)
  };
  const source = {
    generatedBy: "harmony-import-boundary",
    workspaceFingerprint: cleanText(options.workspaceFingerprint, 128),
    topicId: target.topicId,
    topicTitle: target.topicTitle
  };
  if (kind === "inbox") {
    return {
      schema: MOBILE_INBOX_PATCH_SCHEMA,
      appVersion: 1,
      patchId,
      createdAt,
      source,
      target,
      captures: (options.captures || []).map((capture, index) => ({
        id: cleanText(capture.id, 128) || `${patchId}_capture_${index + 1}`,
        quote: cleanText(capture.quote, 4000),
        thought: cleanText(capture.thought, 4000),
        timestamp: cleanText(capture.timestamp, 32),
        sourceTitle: cleanText(capture.sourceTitle, 200),
        sourceUrl: cleanText(capture.sourceUrl, 2000),
        materialType: cleanText(capture.materialType, 32) || "doc",
        tags: cleanText(capture.tags, 200),
        capturedAt: normalizeIso(capture.capturedAt || createdAt)
      }))
    };
  }
  if (kind === "review-progress") {
    return {
      schema: REVIEW_PROGRESS_PATCH_SCHEMA,
      appVersion: 1,
      patchId,
      createdAt,
      source,
      events: (options.events || []).map((event, index) => ({
        id: cleanText(event.id, 128) || `${patchId}_event_${index + 1}`,
        sessionId: cleanText(event.sessionId || target.topicId, 128),
        cardId: cleanText(event.cardId, 128),
        grade: cleanText(event.grade, 16),
        reviewedAt: normalizeIso(event.reviewedAt || createdAt),
        baseUpdatedAt: cleanText(event.baseUpdatedAt, 64),
        baseDueAt: cleanText(event.baseDueAt, 64),
        baseStrength: Number(event.baseStrength || 0)
      }))
    };
  }
  throw new Error("Unsupported Harmony patch envelope kind.");
}

function classifyRejectedPortableData(portableData) {
  if (isMobileInboxPatchLike(portableData)) return "mobile-inbox-patch";
  if (isReviewProgressPatchLike(portableData)) return "review-progress-patch";
  return "unsupported";
}

function harmonyImportErrorCode(portableData) {
  if (isMobileInboxPatchLike(portableData) || isReviewProgressPatchLike(portableData)) {
    return "PATCH_IMPORT_NOT_SUPPORTED_ON_READER";
  }
  return "UNSUPPORTED_PORTABLE_DATA";
}

function normalizeIso(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}
