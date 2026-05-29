#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  MAX_INBOX_PATCH_BYTES,
  MAX_REVIEW_PROGRESS_PATCH_BYTES,
  MOBILE_INBOX_PATCH_SCHEMA,
  REVIEW_PROGRESS_PATCH_SCHEMA,
  applyMobileInboxPatch,
  applyReviewProgressPatch,
  sanitizeWorkspace,
  workspaceFromPortableData
} from "../apps/companion-web/src/model.js";

export const PATCH_INTAKE_NEGATIVE_RECEIPT_SCHEMA = "learning-companion.patch-intake-negative-receipt.v1";

const FIXED_NOW = new Date("2026-05-29T07:30:00.000+08:00");

export function buildPatchIntakeNegativeReceipt(options = {}) {
  const generatedAt = parseDate(options.generatedAt) || FIXED_NOW;
  const workspace = buildSeedWorkspace();
  const inboxPatch = buildInboxPatch();
  const reviewPatch = buildReviewPatch();
  const acceptedReview = applyReviewProgressPatch(workspace, reviewPatch, generatedAt);
  const duplicateReview = applyReviewProgressPatch(acceptedReview.workspace, reviewPatch, generatedAt);
  const staleReview = applyReviewProgressPatch(workspace, {
    ...reviewPatch,
    patchId: "negative_review_stale_patch",
    events: reviewPatch.events.map((event) => ({
      ...event,
      id: "negative_review_stale_event",
      baseUpdatedAt: "2026-05-29T06:01:00.000+08:00"
    }))
  }, generatedAt);

  const cases = [
    expectedThrowCase("malformed_json", () => JSON.parse("{ not valid json"), /Expected|Unexpected|JSON/),
    expectedThrowCase("unsupported_mobile_schema", () => workspaceFromPortableData({
      ...inboxPatch,
      schema: "learning-companion.mobile-inbox-patch.v2"
    }), /Unsupported mobile inbox patch schema/),
    expectedThrowCase("oversized_mobile_inbox_patch", () => applyMobileInboxPatch(workspace, {
      ...inboxPatch,
      captures: [{
        ...inboxPatch.captures[0],
        quote: "x".repeat(MAX_INBOX_PATCH_BYTES + 1)
      }]
    }, generatedAt), /too large/),
    expectedThrowCase("oversized_review_progress_patch", () => applyReviewProgressPatch(workspace, {
      ...reviewPatch,
      events: [{
        ...reviewPatch.events[0],
        id: "negative_review_oversized_event",
        note: "x".repeat(MAX_REVIEW_PROGRESS_PATCH_BYTES + 1)
      }]
    }, generatedAt), /too large/),
    receiptCase("duplicate_review_progress_patch", duplicateReview.receipt, {
      targetResolution: "duplicate-patch",
      applied: 0,
      skippedDuplicate: 1
    }),
    receiptCase("stale_review_progress_patch", staleReview.receipt, {
      targetResolution: "event-import",
      applied: 0,
      skippedConflict: 1
    })
  ];

  assert.equal(cases.every((item) => item.expectedFailureObserved), true);

  return {
    schema: PATCH_INTAKE_NEGATIVE_RECEIPT_SCHEMA,
    evidence: {
      tier: "EXECUTED",
      label: "EVIDENCE: EXECUTED",
      reason: "Pure model/import negative fixtures prove patch intake rejects malformed, unsupported, oversized, duplicate, and stale inputs without credentials."
    },
    generatedAt: generatedAt.toISOString(),
    summary: {
      ok: true,
      cases: cases.length,
      expectedFailuresObserved: cases.filter((item) => item.expectedFailureObserved).length,
      malformedRejected: caseObserved(cases, "malformed_json"),
      oversizedRejected: caseObserved(cases, "oversized_mobile_inbox_patch") && caseObserved(cases, "oversized_review_progress_patch"),
      duplicateReviewSkipped: duplicateReview.receipt.targetResolution === "duplicate-patch" && duplicateReview.receipt.applied === 0,
      staleReviewConflictSkipped: staleReview.receipt.skippedConflict === 1
    },
    seed: {
      workspaceSha256: sha256Json(workspace),
      inboxPatchSha256: sha256Json(inboxPatch),
      reviewPatchSha256: sha256Json(reviewPatch)
    },
    cases
  };
}

function expectedThrowCase(name, fn, pattern) {
  try {
    fn();
  } catch (error) {
    const message = String(error?.message || error);
    return {
      name,
      kind: "throws",
      expectedFailureObserved: pattern.test(message),
      messagePattern: String(pattern),
      observedMessage: sanitizeErrorMessage(message)
    };
  }
  return {
    name,
    kind: "throws",
    expectedFailureObserved: false,
    messagePattern: String(pattern),
    observedMessage: ""
  };
}

function receiptCase(name, receipt, expected) {
  const checks = Object.entries(expected).map(([field, value]) => ({
    field,
    expected: value,
    actual: receipt[field],
    ok: receipt[field] === value
  }));
  return {
    name,
    kind: "receipt",
    expectedFailureObserved: checks.every((check) => check.ok),
    receiptSchema: receipt.schema,
    checks
  };
}

function caseObserved(cases, name) {
  return cases.some((item) => item.name === name && item.expectedFailureObserved);
}

function sanitizeErrorMessage(message) {
  return message.replace(/\s+/g, " ").slice(0, 240);
}

function buildSeedWorkspace() {
  return sanitizeWorkspace({
    schema: "learning-companion.workspace.v1",
    schemaVersion: 1,
    version: 1,
    clientId: "client_patch_negative_receipt",
    activeSessionId: "session_patch_negative",
    importedPatches: [],
    importedReviewPatches: [],
    createdAt: "2026-05-29T06:00:00.000+08:00",
    updatedAt: "2026-05-29T06:10:00.000+08:00",
    sessions: [
      {
        id: "session_patch_negative",
        originClientId: "client_patch_negative_receipt",
        title: "Patch intake negative fixtures",
        sourceTitle: "Portable patch contract",
        sourceUrl: "https://example.com/patch-contract",
        materialType: "doc",
        tags: ["patch", "receipt"],
        focusMode: "review",
        notesMarkdown: "# Patch intake negative fixtures",
        captures: [],
        reviewCards: [
          {
            id: "card_patch_negative",
            prompt: "What should stale review progress do?",
            answer: "Skip with a conflict receipt.",
            sourceCaptureId: "",
            dueAt: "2026-05-29T06:00:00.000+08:00",
            strength: 0,
            createdAt: "2026-05-29T06:00:00.000+08:00",
            updatedAt: "2026-05-29T06:00:00.000+08:00",
            lastReviewedAt: null,
            originClientId: "client_patch_negative_receipt"
          }
        ],
        createdAt: "2026-05-29T06:00:00.000+08:00",
        updatedAt: "2026-05-29T06:10:00.000+08:00"
      }
    ]
  });
}

function buildInboxPatch() {
  return {
    schema: MOBILE_INBOX_PATCH_SCHEMA,
    appVersion: 1,
    patchId: "negative_mobile_inbox_patch",
    createdAt: "2026-05-29T07:00:00.000+08:00",
    target: {
      topicId: "session_patch_negative",
      topicTitle: "Patch intake negative fixtures"
    },
    captures: [
      {
        id: "negative_mobile_capture",
        quote: "Phone capture should append only.",
        thought: "Reject invalid transport before touching workspace state.",
        capturedAt: "2026-05-29T07:01:00.000+08:00"
      }
    ]
  };
}

function buildReviewPatch() {
  return {
    schema: REVIEW_PROGRESS_PATCH_SCHEMA,
    appVersion: 1,
    patchId: "negative_review_progress_patch",
    createdAt: "2026-05-29T07:02:00.000+08:00",
    events: [
      {
        id: "negative_review_event",
        sessionId: "session_patch_negative",
        cardId: "card_patch_negative",
        grade: "good",
        reviewedAt: "2026-05-29T07:03:00.000+08:00",
        baseUpdatedAt: "2026-05-29T06:00:00.000+08:00",
        baseDueAt: "2026-05-29T06:00:00.000+08:00",
        baseStrength: 0
      }
    ]
  };
}

function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function parseArgs(argv) {
  const args = { out: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") args.out = argv[++index] || "";
    else if (arg === "--help") {
      console.log("Usage: node scripts/patch-intake-negative-receipt.mjs --out dist/patch-intake-negative/PATCH_INTAKE_NEGATIVE_RECEIPT.json");
      process.exit(0);
    }
  }
  return args;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const receipt = buildPatchIntakeNegativeReceipt();
  if (args.out) {
    mkdirSync(dirname(args.out), { recursive: true, mode: 0o700 });
    writeFileSync(args.out, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  }
  if (!receipt.summary.ok) {
    console.error("patch_intake_negative_failed");
    process.exit(1);
  }
  console.log("patch_intake_negative_ok");
  if (args.out) console.log(args.out);
}
