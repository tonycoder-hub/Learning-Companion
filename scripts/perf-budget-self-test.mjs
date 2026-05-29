#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const outDir = mkdtempSync(join(tmpdir(), "learning-companion-perf-selftest-"));
const outFile = join(outDir, "PERF_BUDGET.json");

try {
  let failedAsExpected = false;
  try {
    execFileSync(process.execPath, [
      "scripts/perf-budget-check.mjs",
      "--out",
      outFile,
      "--max-file-count",
      "1"
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "pipe"
    });
  } catch (error) {
    failedAsExpected = true;
    assert.equal(error.status, 1);
  }

  assert.equal(failedAsExpected, true);
  const report = JSON.parse(readFileSync(outFile, "utf8"));
  assert.equal(report.schema, "learning-companion.perf-budget-report.v1");
  assert.equal(report.ok, false);
  assert.equal(report.checks.some((check) => check.name === "file_count" && check.ok === false), true);
  console.log("perf_budget_selftest_ok");
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
