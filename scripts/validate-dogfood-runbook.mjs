#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const DOGFOOD_RECEIPT_SCHEMA = "learning-companion.dogfood-runbook-receipt.v1";
const VALID_RESULTS = new Set(["PASS", "FAIL", "BLOCKED", "NT"]);

function parseArgs(argv) {
  const options = {
    runbookPath: "dist/morning-demo/DOGFOOD_RUNBOOK.md",
    outPath: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--runbook") {
      options.runbookPath = argv[index + 1] || options.runbookPath;
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
  console.log("Usage: node scripts/validate-dogfood-runbook.mjs [--runbook dist/morning-demo/DOGFOOD_RUNBOOK.md] [--out receipt.json]");
  console.log("Validates a filled dogfood runbook without treating fixture rows as executed evidence.");
}

function parseTables(markdown) {
  const lines = markdown.split("\n");
  const fields = {};
  const rows = [];
  for (const line of lines) {
    if (!line.startsWith("| ") || line.includes("| ---")) continue;
    const cells = line.split("|").map((part) => part.trim());
    if (cells[1] === "Field" && cells[2] === "Value") continue;
    if (cells[1] === "Step" && cells[2] === "Action") continue;
    if (/^\d+$/.test(cells[1])) {
      rows.push({
        step: Number.parseInt(cells[1], 10),
        action: cells[2] || "",
        expected: cells[3] || "",
        result: normalizeResult(cells[4] || ""),
        notes: cells[5] || ""
      });
    } else if (cells[1] && cells.length >= 3) {
      fields[cells[1]] = cells[2] || "";
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

function validateRunbook(markdown, runbookPath) {
  const errors = [];
  if (!/^# Learning Companion Dogfood Runbook$/m.test(markdown)) {
    errors.push("missing dogfood runbook heading");
  }
  if (!/EVIDENCE: PENDING_USER_GATE/.test(markdown)) {
    errors.push("missing pending evidence label");
  }
  if (!/not evidence until the Result column is filled from an actual run/.test(markdown)) {
    errors.push("missing not-evidence boundary");
  }
  const { fields, rows } = parseTables(markdown);
  if (rows.length !== 11) {
    errors.push(`expected 11 dogfood rows, found ${rows.length}`);
  }
  const invalidRows = [];
  rows.forEach((row) => {
    if (!VALID_RESULTS.has(row.result)) {
      invalidRows.push(row.step);
    }
    if ((row.result === "BLOCKED" || row.result === "FAIL") && !isFilled(row.notes)) {
      errors.push(`row ${row.step} is ${row.result} without a friction note`);
    }
  });
  if (invalidRows.length) {
    errors.push(`invalid result values in rows: ${invalidRows.join(", ")}`);
  }

  const macRows = rows.filter((row) => row.step >= 1 && row.step <= 6);
  const deviceRows = rows.filter((row) => row.step >= 7 && row.step <= 11);
  const counts = summarizeRows(rows);
  const macCounts = summarizeRows(macRows);
  const deviceCounts = summarizeRows(deviceRows);
  const sessionFields = {
    dateTime: fields["Date/time"] || "",
    reviewer: fields.Reviewer || "",
    macBuildSource: fields["Mac build/source"] || "",
    browserSourceUsed: fields["Browser/source used"] || "",
    phoneBrowserDevice: fields["Phone browser/device, if used"] || "",
    windowsBrowserDevice: fields["Windows browser/device, if used"] || "",
    manualDeviceTransportUsed: fields["Manual device transport used"] || "",
    totalElapsedTime: fields["Total elapsed time"] || "",
    totalManualSteps: fields["Total manual steps"] || "",
    macLoopFrictionObserved: fields["Mac loop friction observed"] || "",
    manualDeviceLoopFrictionObserved: fields["Manual device loop friction observed"] || "",
    biggestFriction: fields["Biggest friction"] || ""
  };

  const macLoopExecuted = macCounts.nt === 0 && macRows.length === 6;
  const manualDeviceLoopExecuted = deviceCounts.nt === 0 && deviceRows.length === 5;
  if (macLoopExecuted && !isFilled(sessionFields.macLoopFrictionObserved)) {
    errors.push("Mac loop executed but Mac loop friction observed is empty or TBD");
  }
  if (manualDeviceLoopExecuted && !isFilled(sessionFields.manualDeviceLoopFrictionObserved)) {
    errors.push("Manual device loop executed but Manual device loop friction observed is empty or TBD");
  }
  if (manualDeviceLoopExecuted && !isFilled(sessionFields.manualDeviceTransportUsed)) {
    errors.push("Manual device loop executed but transport used is empty or TBD");
  }

  const macLoopUsable = macLoopExecuted && macCounts.fail === 0 && macCounts.blocked === 0;
  const manualDeviceLoopUsable = manualDeviceLoopExecuted && deviceCounts.fail === 0 && deviceCounts.blocked === 0;
  const receipt = {
    schema: DOGFOOD_RECEIPT_SCHEMA,
    evidenceTier: "PENDING_USER_GATE",
    generatedAt: new Date().toISOString(),
    runbookPath,
    summary: {
      ok: errors.length === 0,
      rows: rows.length,
      ...counts,
      macLoopExecuted,
      macLoopUsable,
      manualDeviceLoopExecuted,
      manualDeviceLoopUsable,
      anyRealRowsFilled: rows.some((row) => row.result !== "NT")
    },
    sessionFields,
    rows,
    errors,
    claimBoundary: {
      canClaimMacDogfoodUsable: errors.length === 0 && macLoopUsable,
      canClaimManualDeviceLoopUsable: errors.length === 0 && manualDeviceLoopUsable,
      cannotClaim: [
        "Production packaging",
        "Feishu live sync",
        "HarmonyOS app/device behavior unless that real device was used",
        "Windows behavior unless a real Windows browser row set was executed"
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
  const markdown = await readFile(options.runbookPath, "utf8");
  const receipt = validateRunbook(markdown, options.runbookPath);
  assert.equal(receipt.schema, DOGFOOD_RECEIPT_SCHEMA);
  if (options.outPath) {
    await mkdir(dirname(options.outPath), { recursive: true });
    await writeFile(options.outPath, `${JSON.stringify(receipt, null, 2)}\n`);
  }
  console.log(JSON.stringify(receipt, null, 2));
  process.exitCode = receipt.summary.ok ? 0 : 1;
}

await main();
