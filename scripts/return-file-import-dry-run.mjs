#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  applyMobileInboxPatch,
  applyReviewProgressPatch,
  isMobileInboxPatch,
  isMobileInboxPatchLike,
  isReviewProgressPatch,
  isReviewProgressPatchLike,
  workspaceBackupFingerprint,
  workspaceFromPortableData
} from "../apps/companion-web/src/model.js";

const RETURN_IMPORT_DRY_RUN_SCHEMA = "learning-companion.return-file-import-dry-run.v1";

function parseArgs(argv) {
  const options = {
    workspacePath: "",
    returnFiles: [],
    outPath: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workspace") {
      options.workspacePath = argv[index + 1] || "";
      index += 1;
    } else if (arg === "--return-file") {
      const value = argv[index + 1] || "";
      if (value) options.returnFiles.push(value);
      index += 1;
    } else if (arg === "--out") {
      options.outPath = argv[index + 1] || "";
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return options;
}

function printHelp() {
  console.log("Usage: node scripts/return-file-import-dry-run.mjs --workspace workspace.json --return-file return.json [--return-file return2.json] [--out receipt.json]");
  console.log("The dry run applies inbox returns before review returns, reports import receipts, and does not write the updated workspace.");
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message || "parse failed"}`);
  }
}

function classifyReturnFile(payload, path, index) {
  if (isMobileInboxPatch(payload)) {
    return { index, path, type: "mobile-inbox", payload, order: 0 };
  }
  if (isReviewProgressPatch(payload)) {
    return { index, path, type: "review-progress", payload, order: 1 };
  }
  if (isMobileInboxPatchLike(payload)) {
    return { index, path, type: "unsupported-mobile-inbox", payload, order: 2 };
  }
  if (isReviewProgressPatchLike(payload)) {
    return { index, path, type: "unsupported-review-progress", payload, order: 2 };
  }
  return { index, path, type: "unsupported", payload, order: 2 };
}

function summarizeInboxReceipt(receipt) {
  return {
    type: "mobile-inbox",
    patchId: receipt.patchId || "",
    targetResolution: receipt.targetResolution || "",
    added: Number(receipt.added || 0),
    skippedDuplicate: Number(receipt.skippedDuplicate || 0),
    sanitizedSourceUrls: Number(receipt.sanitizedSourceUrls || 0),
    answeredQuestions: Number(receipt.answeredQuestions || 0),
    refreshableReviewCards: Number(receipt.refreshableReviewCards || 0),
    sourceFingerprintMatches: receipt.sourceFingerprintMatches,
    sourceFingerprintBasis: receipt.sourceFingerprintBasis || ""
  };
}

function summarizeReviewReceipt(receipt) {
  return {
    type: "review-progress",
    patchId: receipt.patchId || "",
    targetResolution: receipt.targetResolution || "",
    totalEvents: Number(receipt.totalEvents || 0),
    applied: Number(receipt.applied || 0),
    skippedDuplicate: Number(receipt.skippedDuplicate || 0),
    skippedMissing: Number(receipt.skippedMissing || 0),
    skippedConflict: Number(receipt.skippedConflict || 0),
    skippedInvalid: Number(receipt.skippedInvalid || 0),
    sourceFingerprintMatches: receipt.sourceFingerprintMatches,
    sourceFingerprintBasis: receipt.sourceFingerprintBasis || ""
  };
}

function unsupportedSummary(item) {
  return {
    path: item.path,
    type: item.type,
    ok: false,
    error: item.type === "unsupported"
      ? "Return Files import only accepts inbox or review return files."
      : "Unsupported return file schema."
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.workspacePath || !options.returnFiles.length) {
    printHelp();
    process.exitCode = 2;
    return;
  }

  const baseWorkspace = workspaceFromPortableData(await readJson(options.workspacePath, "workspace"));
  const returnItems = [];
  for (let index = 0; index < options.returnFiles.length; index += 1) {
    const path = options.returnFiles[index];
    returnItems.push(classifyReturnFile(await readJson(path, `return file ${index + 1}`), path, index));
  }

  const ordered = [...returnItems].sort((a, b) => (a.order - b.order) || (a.index - b.index));
  let workingWorkspace = baseWorkspace;
  const files = [];
  for (const item of ordered) {
    try {
      if (item.type === "mobile-inbox") {
        const result = applyMobileInboxPatch(workingWorkspace, item.payload, new Date("2099-01-02T08:00:00+08:00"));
        workingWorkspace = result.workspace;
        files.push({
          path: item.path,
          ok: true,
          ...summarizeInboxReceipt(result.receipt)
        });
      } else if (item.type === "review-progress") {
        const result = applyReviewProgressPatch(workingWorkspace, item.payload, new Date("2099-01-02T08:00:00+08:00"));
        workingWorkspace = result.workspace;
        files.push({
          path: item.path,
          ok: true,
          ...summarizeReviewReceipt(result.receipt)
        });
      } else {
        files.push(unsupportedSummary(item));
      }
    } catch (error) {
      files.push({
        path: item.path,
        type: item.type,
        ok: false,
        error: error.message || "Import failed."
      });
    }
  }

  const summary = {
    ok: files.every((file) => file.ok),
    totalFiles: files.length,
    importedFiles: files.filter((file) => file.ok).length,
    failedFiles: files.filter((file) => !file.ok).length,
    inboxAdded: files.reduce((sum, file) => sum + Number(file.added || 0), 0),
    reviewApplied: files.reduce((sum, file) => sum + Number(file.applied || 0), 0),
    workspaceChanged: workspaceBackupFingerprint(baseWorkspace) !== workspaceBackupFingerprint(workingWorkspace),
    outputWorkspaceWritten: false
  };

  const receipt = {
    schema: RETURN_IMPORT_DRY_RUN_SCHEMA,
    evidenceTier: "EXECUTED_LOCAL_DRY_RUN",
    generatedAt: new Date().toISOString(),
    workspacePath: options.workspacePath,
    workspaceFingerprintBefore: workspaceBackupFingerprint(baseWorkspace),
    workspaceFingerprintAfter: workspaceBackupFingerprint(workingWorkspace),
    summary,
    files,
    boundaries: {
      proves: [
        "The selected return JSON files can be parsed and applied through the same model import functions used by the Mac app.",
        "The dry run can report wrong return-file types without overwriting the workspace."
      ],
      doesNotProve: [
        "A real phone or Windows browser created these files.",
        "The Mac UI file picker was used.",
        "The updated workspace was saved.",
        "Feishu live sync or credentialed upload."
      ]
    }
  };

  if (options.outPath) {
    await mkdir(dirname(options.outPath), { recursive: true });
    await writeFile(options.outPath, `${JSON.stringify(receipt, null, 2)}\n`);
  }
  console.log(JSON.stringify(receipt, null, 2));
  assert.equal(receipt.schema, RETURN_IMPORT_DRY_RUN_SCHEMA);
  process.exitCode = summary.ok ? 0 : 1;
}

await main();
