#!/usr/bin/env node
import assert from "node:assert/strict";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { readCurrentRevision, revisionCanClaim } from "./lib/git-revision.mjs";
import { HARMONY_DEVICE_QA_AREAS } from "./lib/platform-qa-areas.mjs";
import { readPlatformHandoffBinding } from "./lib/platform-qa-handoff-binding.mjs";

const HARMONY_DEVICE_QA_RECEIPT_SCHEMA = "learning-companion.harmony-device-qa-receipt.v1";
const VALID_RESULTS = new Set(["PASS", "FAIL", "BLOCKED", "NT"]);
const PLACEHOLDER_EVIDENCE_NOTES = new Set(["tbd", "-", "--", "n/a", "na", "none", "no evidence", "placeholder", "todo"]);
const LEADING_EVIDENCE_DECORATION_PATTERN = /^(?:[`"'()[\]{}<>*_.,;:#\-\s]+|\d+[.)]\s*)+/;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const EXPECTED_QA_ROWS = HARMONY_DEVICE_QA_AREAS.length;
const REQUIRED_FULL_RUN_FIELDS = [
  ["dateTime", "Date/time"],
  ["reviewer", "Reviewer"],
  ["harmonyDeviceBuild", "HarmonyOS device/build"],
  ["appBuildSource", "App build/source"],
  ["devEcoToolchainGateResult", "DevEco/toolchain gate result"],
  ["importMethod", "Import method"],
  ["returnTransferMethod", "Return transfer method"],
  ["macImportMethod", "Mac import method"],
  ["macReturnFilesImportResult", "Mac Return Files import result"],
  ["totalElapsedTime", "Total elapsed time"],
  ["filePickerStorageFrictionObserved", "File-picker/storage friction observed"],
  ["patchExportImportFrictionObserved", "Patch export/import friction observed"],
  ["biggestFriction", "Biggest friction"]
];

function parseArgs(argv) {
  const options = {
    qaPath: "dist/morning-demo/HARMONY_DEVICE_QA.md",
    outPath: "",
    platformHandoffPath: "",
    requireClaimable: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--qa") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--qa requires a Markdown path.");
      options.qaPath = value;
      index += 1;
    } else if (arg === "--out") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--out requires a receipt JSON path.");
      options.outPath = value;
      index += 1;
    } else if (arg === "--platform-handoff") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--platform-handoff requires a platform handoff JSON path.");
      options.platformHandoffPath = value;
      index += 1;
    } else if (arg === "--require-claimable") {
      options.requireClaimable = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return options;
}

function printHelp() {
  console.log("Usage: node scripts/validate-harmony-device-qa.mjs [--qa dist/morning-demo/HARMONY_DEVICE_QA.md] [--platform-handoff .codex-tmp/platform-qa-handoff/current.json] [--out receipt.json] [--require-claimable]");
  console.log("Validates a filled HarmonyOS device QA receipt without converting scaffold or smoke evidence into device evidence.");
}

function parseTables(markdown) {
  const fields = {};
  const rows = [];
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("| ") || line.includes("| ---")) continue;
    const cells = line.split("|").slice(1, -1).map((part) => part.trim());
    if (cells[0] === "Field" && cells[1] === "Value") continue;
    if (cells[0] === "Area" && cells[1] === "Steps") continue;
    if (cells.length >= 5) {
      rows.push({
        area: cells[0] || "",
        steps: cells[1] || "",
        expected: cells[2] || "",
        result: normalizeResult(cells[3] || ""),
        notes: cells[4] || ""
      });
    } else if (cells[0] && cells.length >= 2) {
      fields[cells[0]] = cells[1] || "";
    }
  }
  return { fields, rows };
}

function normalizeResult(value) {
  return String(value || "").trim().toUpperCase();
}

function isFilled(value) {
  const text = String(value || "").trim();
  return Boolean(text && text !== "TBD" && text !== "-");
}

function hasConcreteQaText(value) {
  const text = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  const unwrappedText = text.replace(LEADING_EVIDENCE_DECORATION_PATTERN, "");
  return Boolean(text && !isPlaceholderQaText(text) && !isPlaceholderQaText(unwrappedText));
}

function isIsoDateTimeWithTimezone(value) {
  const text = String(value || "").trim();
  return ISO_DATE_TIME_PATTERN.test(text) && Number.isFinite(Date.parse(text));
}

function isPlaceholderQaText(text) {
  return PLACEHOLDER_EVIDENCE_NOTES.has(text)
    || /^(tbd|todo|placeholder|no evidence|n\s*\/\s*a|na)(\b|[\s:;,.()[\]{}_-]|$)/.test(text);
}

function hasEvidenceNote(value) {
  const text = String(value || "").trim();
  return Boolean(text && !isPlaceholderEvidenceNote(text));
}

function isPlaceholderEvidenceNote(value) {
  const text = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  const unwrappedText = text.replace(LEADING_EVIDENCE_DECORATION_PATTERN, "");
  return isPlaceholderEvidenceText(text) || isPlaceholderEvidenceText(unwrappedText);
}

function isPlaceholderEvidenceText(text) {
  return PLACEHOLDER_EVIDENCE_NOTES.has(text) || /^(tbd|todo|placeholder|none|no evidence|n\s*\/\s*a|na)(\b|[\s:;,.()[\]{}_-]|$)/.test(text);
}

function isPass(value) {
  return normalizeResult(value) === "PASS";
}

function validateHarmonyDeviceQa(markdown, qaPath, currentRevision, { platformHandoffBinding = null, platformHandoffErrors = [] } = {}) {
  const errors = [];
  if (!/^# Learning Companion HarmonyOS Device QA Receipt$/m.test(markdown)) {
    errors.push("missing HarmonyOS device QA heading");
  }
  if (!/EVIDENCE: PENDING_USER_GATE/.test(markdown)) {
    errors.push("missing pending evidence label");
  }
  if (!/PENDING RECEIPT, not device evidence/.test(markdown)) {
    errors.push("missing pending-receipt boundary");
  }
  if (!/not evidence until the Result column is filled from a real HarmonyOS phone or emulator run/.test(markdown)) {
    errors.push("missing not-evidence-until-filled boundary");
  }
  if (!/Cannot be filled from `npm run smoke:harmony`, `HARMONY_SCAFFOLD_REPORT.json`, `HARMONY_DEVECO_HANDOFF.md`, or generated patch fixtures/.test(markdown)) {
    errors.push("missing scaffold-vs-device boundary");
  }

  const { fields, rows } = parseTables(markdown);
  if (rows.length !== EXPECTED_QA_ROWS) {
    errors.push(`expected ${EXPECTED_QA_ROWS} HarmonyOS device QA rows, found ${rows.length}`);
  }

  const invalidRows = [];
  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const expectedArea = HARMONY_DEVICE_QA_AREAS[index] || "";
    if (expectedArea && row.area !== expectedArea) {
      errors.push(`row ${rowNumber} area must be ${expectedArea}`);
    }
    if (!VALID_RESULTS.has(row.result)) {
      invalidRows.push(rowNumber);
    }
    if (row.result !== "NT" && !hasEvidenceNote(row.notes)) {
      errors.push(`row ${rowNumber} (${row.area || "unnamed"}) is ${row.result} without a concrete QA note or evidence reference`);
    }
  });
  if (invalidRows.length) {
    errors.push(`invalid result values in rows: ${invalidRows.join(", ")}`);
  }

  const counts = summarizeRows(rows);
  const allRowsExecuted = rows.length === EXPECTED_QA_ROWS && counts.nt === 0 && counts.invalid === 0;
  const allRowsPass = allRowsExecuted && counts.pass === EXPECTED_QA_ROWS && counts.fail === 0 && counts.blocked === 0;
  const anyRealRowsFilled = rows.some((row) => row.result !== "NT");
  const sessionFields = {
    dateTime: fields["Date/time"] || "",
    reviewer: fields.Reviewer || "",
    harmonyDeviceBuild: fields["HarmonyOS device/build"] || "",
    appBuildSource: fields["App build/source"] || "",
    devEcoToolchainGateResult: fields["DevEco/toolchain gate result"] || "",
    importMethod: fields["Import method"] || "",
    returnTransferMethod: fields["Return transfer method"] || "",
    macImportMethod: fields["Mac import method"] || "",
    macReturnFilesImportResult: fields["Mac Return Files import result"] || "",
    totalElapsedTime: fields["Total elapsed time"] || "",
    filePickerStorageFrictionObserved: fields["File-picker/storage friction observed"] || "",
    patchExportImportFrictionObserved: fields["Patch export/import friction observed"] || "",
    biggestFriction: fields["Biggest friction"] || ""
  };

  if (anyRealRowsFilled) {
    if (!isIsoDateTimeWithTimezone(sessionFields.dateTime)) {
      errors.push("HarmonyOS device QA has filled rows but Date/time must be an ISO date-time with timezone");
    }
    [
      ["reviewer", "Reviewer"],
      ["harmonyDeviceBuild", "HarmonyOS device/build"]
    ].forEach(([key, label]) => {
      if (!hasConcreteQaText(sessionFields[key])) {
        errors.push(`HarmonyOS device QA has filled rows but ${label} is empty, TBD, or placeholder`);
      }
    });
  }

  if (allRowsExecuted) {
    for (const [key, label] of REQUIRED_FULL_RUN_FIELDS) {
      if (["dateTime", "reviewer", "harmonyDeviceBuild"].includes(key)) continue;
      if (!hasConcreteQaText(sessionFields[key])) {
        errors.push(`HarmonyOS device QA fully executed but ${label} is empty, TBD, or placeholder`);
      }
    }
    for (const [key, label] of [
      ["devEcoToolchainGateResult", "DevEco/toolchain gate result"],
      ["macReturnFilesImportResult", "Mac Return Files import result"]
    ]) {
      if (isFilled(sessionFields[key]) && !VALID_RESULTS.has(normalizeResult(sessionFields[key]))) {
        errors.push(`HarmonyOS device QA fully executed but ${label} is not PASS, FAIL, BLOCKED, or NT`);
      }
    }
  }

  const devEcoToolchainGatePass = isPass(sessionFields.devEcoToolchainGateResult);
  const macReturnFilesImportPass = isPass(sessionFields.macReturnFilesImportResult);
  if (anyRealRowsFilled && !revisionCanClaim(currentRevision)) {
    errors.push("HarmonyOS device QA has filled rows but the validator did not run from a clean git HEAD");
  }
  if (anyRealRowsFilled) {
    if (!platformHandoffBinding) {
      errors.push("HarmonyOS device QA has filled rows but --platform-handoff is required");
    }
    platformHandoffErrors.forEach((error) => {
      errors.push(`HarmonyOS device QA platform handoff: ${error}`);
    });
  }
  const canClaimHarmonyDeviceRoundtripUsable = errors.length === 0 && allRowsPass && devEcoToolchainGatePass && macReturnFilesImportPass;
  const evidenceTier = canClaimHarmonyDeviceRoundtripUsable
    ? "MANUAL_PLATFORM_QA"
    : anyRealRowsFilled ? "PARTIAL_PLATFORM_QA" : "PENDING_USER_GATE";
  const receipt = {
    schema: HARMONY_DEVICE_QA_RECEIPT_SCHEMA,
    evidenceTier,
    generatedAt: new Date().toISOString(),
    qaPath,
    runContext: {
      schema: "learning-companion.platform-qa-run-context.v1",
      appRevision: currentRevision
    },
    platformHandoffBinding,
    summary: {
      ok: errors.length === 0,
      rows: rows.length,
      ...counts,
      allRowsExecuted,
      allRowsPass,
      devEcoToolchainGatePass,
      macReturnFilesImportPass,
      anyRealRowsFilled
    },
    sessionFields,
    rows,
    errors,
    claimBoundary: {
      canClaimHarmonyDeviceRoundtripUsable,
      requiresCurrentCleanRevision: true,
      requiresCurrentPlatformHandoff: true,
      doesNotProve: [
        "Feishu live sync or remote Drive reads/writes",
        "Windows browser behavior",
        "Mac signing, notarization, or production packaging",
        "Any HarmonyOS phone or emulator not named in the HarmonyOS device/build field",
        "Background sync, clipboard, credential, or browser-cookie behavior",
        "Human dogfood beyond the rows actually filled from the HarmonyOS run"
      ]
    }
  };
  return receipt;
}

function summarizeRows(rows) {
  return {
    pass: rows.filter((row) => row.result === "PASS").length,
    fail: rows.filter((row) => row.result === "FAIL").length,
    blocked: rows.filter((row) => row.result === "BLOCKED").length,
    nt: rows.filter((row) => row.result === "NT").length,
    invalid: rows.filter((row) => !VALID_RESULTS.has(row.result)).length
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const markdown = await readFile(options.qaPath, "utf8");
  const currentRevision = await readCurrentRevision();
  const handoffResult = options.platformHandoffPath
    ? await readPlatformHandoffBinding({
      handoffPath: options.platformHandoffPath,
      platformId: "harmonyDeviceQa",
      qaPath: options.qaPath,
      currentRevision
    })
    : { binding: null, errors: [] };
  const receipt = validateHarmonyDeviceQa(markdown, options.qaPath, currentRevision, {
    platformHandoffBinding: handoffResult.binding,
    platformHandoffErrors: handoffResult.errors
  });
  assert.equal(receipt.schema, HARMONY_DEVICE_QA_RECEIPT_SCHEMA);
  if (options.outPath) {
    await mkdir(dirname(options.outPath), { recursive: true, mode: 0o700 });
    await chmod(options.outPath, 0o600).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
    await writeFile(options.outPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
    await chmod(options.outPath, 0o600);
  }
  console.log(JSON.stringify(receipt, null, 2));
  const modeErrors = [];
  if (options.requireClaimable && receipt.claimBoundary.canClaimHarmonyDeviceRoundtripUsable !== true) {
    modeErrors.push("HarmonyOS device QA --require-claimable needs a full all-PASS real run with passing DevEco/toolchain and Mac Return Files import gates.");
  }
  modeErrors.forEach((error) => console.error(error));
  process.exitCode = receipt.summary.ok && modeErrors.length === 0 ? 0 : 1;
}

await main();
