#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const WINDOWS_STATIC_QA_RECEIPT_SCHEMA = "learning-companion.windows-static-qa-receipt.v1";
const VALID_RESULTS = new Set(["PASS", "FAIL", "BLOCKED", "NT"]);
const EXPECTED_QA_ROWS = 10;
const REQUIRED_FULL_RUN_FIELDS = [
  ["dateTime", "Date/time"],
  ["reviewer", "Reviewer"],
  ["windowsBrowserDevice", "Windows browser/device"],
  ["mirrorBuildSource", "Mirror build/source"],
  ["transferMethod", "Transfer method"],
  ["macImportMethod", "Mac import method"],
  ["staticReturnContractGateResult", "Static return contract gate result"],
  ["macReturnFilesImportResult", "Mac Return Files import result"],
  ["totalElapsedTime", "Total elapsed time"],
  ["windowsLocalFileFrictionObserved", "Windows local-file friction observed"],
  ["returnFileTransferFrictionObserved", "Return-file transfer friction observed"],
  ["biggestFriction", "Biggest friction"]
];

function parseArgs(argv) {
  const options = {
    qaPath: "dist/morning-demo/WINDOWS_STATIC_QA.md",
    outPath: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--qa") {
      options.qaPath = argv[index + 1] || options.qaPath;
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
  console.log("Usage: node scripts/validate-windows-static-qa.mjs [--qa dist/morning-demo/WINDOWS_STATIC_QA.md] [--out receipt.json]");
  console.log("Validates a filled Windows static QA receipt without converting pending NT rows into Windows compatibility evidence.");
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

function isPass(value) {
  return normalizeResult(value) === "PASS";
}

function validateWindowsStaticQa(markdown, qaPath) {
  const errors = [];
  if (!/^# Learning Companion Windows Static QA Receipt$/m.test(markdown)) {
    errors.push("missing Windows static QA heading");
  }
  if (!/EVIDENCE: PENDING_USER_GATE/.test(markdown)) {
    errors.push("missing pending evidence label");
  }
  if (!/PENDING RECEIPT, not QA evidence/.test(markdown)) {
    errors.push("missing pending-receipt boundary");
  }
  if (!/not evidence until the Result column is filled from a real Windows browser run/.test(markdown)) {
    errors.push("missing not-evidence-until-filled boundary");
  }
  if (!/Cannot be filled from `npm run check:static-return`, link checks, Mac browser smoke, or fixture import receipts/.test(markdown)) {
    errors.push("missing fixture-vs-Windows boundary");
  }

  const { fields, rows } = parseTables(markdown);
  if (rows.length !== EXPECTED_QA_ROWS) {
    errors.push(`expected ${EXPECTED_QA_ROWS} Windows static QA rows, found ${rows.length}`);
  }

  const invalidRows = [];
  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    if (!VALID_RESULTS.has(row.result)) {
      invalidRows.push(rowNumber);
    }
    if ((row.result === "BLOCKED" || row.result === "FAIL") && !isFilled(row.notes)) {
      errors.push(`row ${rowNumber} (${row.area || "unnamed"}) is ${row.result} without a QA note`);
    }
  });
  if (invalidRows.length) {
    errors.push(`invalid result values in rows: ${invalidRows.join(", ")}`);
  }

  const counts = summarizeRows(rows);
  const allRowsExecuted = rows.length === EXPECTED_QA_ROWS && counts.nt === 0 && counts.invalid === 0;
  const allRowsPass = allRowsExecuted && counts.pass === EXPECTED_QA_ROWS && counts.fail === 0 && counts.blocked === 0;
  const sessionFields = {
    dateTime: fields["Date/time"] || "",
    reviewer: fields.Reviewer || "",
    windowsBrowserDevice: fields["Windows browser/device"] || "",
    mirrorBuildSource: fields["Mirror build/source"] || "",
    transferMethod: fields["Transfer method"] || "",
    macImportMethod: fields["Mac import method"] || "",
    staticReturnContractGateResult: fields["Static return contract gate result"] || "",
    macReturnFilesImportResult: fields["Mac Return Files import result"] || "",
    totalElapsedTime: fields["Total elapsed time"] || "",
    windowsLocalFileFrictionObserved: fields["Windows local-file friction observed"] || "",
    returnFileTransferFrictionObserved: fields["Return-file transfer friction observed"] || "",
    biggestFriction: fields["Biggest friction"] || ""
  };

  if (allRowsExecuted) {
    for (const [key, label] of REQUIRED_FULL_RUN_FIELDS) {
      if (!isFilled(sessionFields[key])) {
        errors.push(`Windows static QA fully executed but ${label} is empty or TBD`);
      }
    }
    for (const [key, label] of [
      ["staticReturnContractGateResult", "Static return contract gate result"],
      ["macReturnFilesImportResult", "Mac Return Files import result"]
    ]) {
      if (isFilled(sessionFields[key]) && !VALID_RESULTS.has(normalizeResult(sessionFields[key]))) {
        errors.push(`Windows static QA fully executed but ${label} is not PASS, FAIL, BLOCKED, or NT`);
      }
    }
  }

  const staticReturnContractGatePass = isPass(sessionFields.staticReturnContractGateResult);
  const macReturnFilesImportPass = isPass(sessionFields.macReturnFilesImportResult);
  const receipt = {
    schema: WINDOWS_STATIC_QA_RECEIPT_SCHEMA,
    evidenceTier: "PENDING_USER_GATE",
    generatedAt: new Date().toISOString(),
    qaPath,
    summary: {
      ok: errors.length === 0,
      rows: rows.length,
      ...counts,
      allRowsExecuted,
      allRowsPass,
      staticReturnContractGatePass,
      macReturnFilesImportPass,
      anyRealRowsFilled: rows.some((row) => row.result !== "NT")
    },
    sessionFields,
    rows,
    errors,
    claimBoundary: {
      canClaimWindowsStaticLoopUsable: errors.length === 0 && allRowsPass && staticReturnContractGatePass && macReturnFilesImportPass,
      doesNotProve: [
        "Feishu live sync or remote Drive writes",
        "HarmonyOS app/device behavior",
        "Mac signing, notarization, or production packaging",
        "Native Windows app behavior",
        "Any browser or device not named in the Windows browser/device field",
        "Human dogfood beyond the rows actually filled from the Windows browser run"
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
  const receipt = validateWindowsStaticQa(markdown, options.qaPath);
  assert.equal(receipt.schema, WINDOWS_STATIC_QA_RECEIPT_SCHEMA);
  if (options.outPath) {
    await mkdir(dirname(options.outPath), { recursive: true });
    await writeFile(options.outPath, `${JSON.stringify(receipt, null, 2)}\n`);
  }
  console.log(JSON.stringify(receipt, null, 2));
  process.exitCode = receipt.summary.ok ? 0 : 1;
}

await main();
