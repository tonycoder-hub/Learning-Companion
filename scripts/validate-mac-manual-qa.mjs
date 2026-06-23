#!/usr/bin/env node
import assert from "node:assert/strict";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { readCurrentRevision, revisionCanClaim } from "./lib/git-revision.mjs";

const MAC_MANUAL_QA_RECEIPT_SCHEMA = "learning-companion.mac-manual-qa-receipt.v1";
const VALID_RESULTS = new Set(["PASS", "FAIL", "BLOCKED", "NT"]);
const PLACEHOLDER_EVIDENCE_NOTES = new Set(["tbd", "-", "--", "n/a", "na", "none", "no evidence", "placeholder", "todo"]);
const LEADING_EVIDENCE_DECORATION_PATTERN = /^(?:[`"'()[\]{}<>*_.,;:#\-\s]+|\d+[.)]\s*)+/;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const EXPECTED_QA_ROWS = 27;
const REQUIRED_FULL_RUN_FIELDS = [
  ["dateTime", "Date/time"],
  ["reviewer", "Reviewer"],
  ["macBuildSource", "Mac build/source"],
  ["macosVersion", "macOS version"],
  ["browserSourceUsed", "Browser/source used"],
  ["nativeBuildGateResult", "Native build gate result"],
  ["browserSmokeGateResult", "Browser smoke gate result"],
  ["totalElapsedTime", "Total elapsed time"],
  ["permissionPromptsObserved", "Permission prompts observed"],
  ["nativeSaveImportFrictionObserved", "Native save/import friction observed"],
  ["biggestFriction", "Biggest friction"]
];

function parseArgs(argv) {
  const options = {
    qaPath: "dist/morning-demo/MAC_MANUAL_QA.md",
    outPath: ""
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
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return options;
}

function printHelp() {
  console.log("Usage: node scripts/validate-mac-manual-qa.mjs [--qa dist/morning-demo/MAC_MANUAL_QA.md] [--out receipt.json]");
  console.log("Validates a filled Mac manual QA receipt without converting pending NT rows into GUI dogfood evidence.");
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

function validateMacManualQa(markdown, qaPath, currentRevision) {
  const errors = [];
  if (!/^# Learning Companion Mac Manual QA Receipt$/m.test(markdown)) {
    errors.push("missing Mac manual QA heading");
  }
  if (!/EVIDENCE: PENDING_USER_GATE/.test(markdown)) {
    errors.push("missing pending evidence label");
  }
  if (!/does not prove signed packaging, notarization, or live Feishu\/HarmonyOS behavior/.test(markdown)) {
    errors.push("missing packaging/integration boundary");
  }
  if (!/not evidence until the Result column is filled from an actual Mac GUI run/.test(markdown)) {
    errors.push("missing not-evidence-until-filled boundary");
  }
  if (!/Cannot be filled from controlled browser smoke, SwiftPM build success, or fixture receipts/.test(markdown)) {
    errors.push("missing fixture-vs-GUI boundary");
  }

  const { fields, rows } = parseTables(markdown);
  if (rows.length !== EXPECTED_QA_ROWS) {
    errors.push(`expected ${EXPECTED_QA_ROWS} Mac manual QA rows, found ${rows.length}`);
  }

  const invalidRows = [];
  rows.forEach((row, index) => {
    const rowNumber = index + 1;
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
    macBuildSource: fields["Mac build/source"] || "",
    macosVersion: fields["macOS version"] || "",
    browserSourceUsed: fields["Browser/source used"] || "",
    nativeBuildGateResult: fields["Native build gate result"] || "",
    browserSmokeGateResult: fields["Browser smoke gate result"] || "",
    totalElapsedTime: fields["Total elapsed time"] || "",
    permissionPromptsObserved: fields["Permission prompts observed"] || "",
    nativeSaveImportFrictionObserved: fields["Native save/import friction observed"] || "",
    biggestFriction: fields["Biggest friction"] || ""
  };

  if (anyRealRowsFilled) {
    if (!isIsoDateTimeWithTimezone(sessionFields.dateTime)) {
      errors.push("Mac manual QA has filled rows but Date/time must be an ISO date-time with timezone");
    }
    [
      ["reviewer", "Reviewer"],
      ["macosVersion", "macOS version"]
    ].forEach(([key, label]) => {
      if (!hasConcreteQaText(sessionFields[key])) {
        errors.push(`Mac manual QA has filled rows but ${label} is empty, TBD, or placeholder`);
      }
    });
  }

  if (allRowsExecuted) {
    for (const [key, label] of REQUIRED_FULL_RUN_FIELDS) {
      if (["dateTime", "reviewer", "macosVersion"].includes(key)) continue;
      if (!hasConcreteQaText(sessionFields[key])) {
        errors.push(`Mac manual QA fully executed but ${label} is empty, TBD, or placeholder`);
      }
    }
    for (const [key, label] of [
      ["nativeBuildGateResult", "Native build gate result"],
      ["browserSmokeGateResult", "Browser smoke gate result"]
    ]) {
      if (isFilled(sessionFields[key]) && !VALID_RESULTS.has(normalizeResult(sessionFields[key]))) {
        errors.push(`Mac manual QA fully executed but ${label} is not PASS, FAIL, BLOCKED, or NT`);
      }
    }
  }
  const nativeBuildGatePass = isPass(sessionFields.nativeBuildGateResult);
  const browserSmokeGatePass = isPass(sessionFields.browserSmokeGateResult);
  if (anyRealRowsFilled && !revisionCanClaim(currentRevision)) {
    errors.push("Mac manual QA has filled rows but the validator did not run from a clean git HEAD");
  }

  const canClaimMacManualQaUsable = errors.length === 0 && allRowsPass && nativeBuildGatePass && browserSmokeGatePass;
  const evidenceTier = canClaimMacManualQaUsable
    ? "MANUAL_PLATFORM_QA"
    : anyRealRowsFilled ? "PARTIAL_PLATFORM_QA" : "PENDING_USER_GATE";
  const receipt = {
    schema: MAC_MANUAL_QA_RECEIPT_SCHEMA,
    evidenceTier,
    generatedAt: new Date().toISOString(),
    qaPath,
    runContext: {
      schema: "learning-companion.platform-qa-run-context.v1",
      appRevision: currentRevision
    },
    summary: {
      ok: errors.length === 0,
      rows: rows.length,
      ...counts,
      allRowsExecuted,
      allRowsPass,
      nativeBuildGatePass,
      browserSmokeGatePass,
      anyRealRowsFilled
    },
    sessionFields,
    rows,
    errors,
    claimBoundary: {
      canClaimMacManualQaUsable,
      requiresCurrentCleanRevision: true,
      doesNotProve: [
        "Signed or notarized Mac packaging",
        "Production update or install flow",
        "Feishu live sync",
        "HarmonyOS or Windows behavior",
        "Screen-reader behavior unless a real accessibility row is added and executed",
        "Human dogfood beyond the rows actually filled from the Mac GUI run"
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
  const receipt = validateMacManualQa(markdown, options.qaPath, currentRevision);
  assert.equal(receipt.schema, MAC_MANUAL_QA_RECEIPT_SCHEMA);
  if (options.outPath) {
    await mkdir(dirname(options.outPath), { recursive: true, mode: 0o700 });
    await chmod(options.outPath, 0o600).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
    await writeFile(options.outPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
    await chmod(options.outPath, 0o600);
  }
  console.log(JSON.stringify(receipt, null, 2));
  process.exitCode = receipt.summary.ok ? 0 : 1;
}

await main();
