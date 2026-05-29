#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { dirname, join, relative, resolve, sep } from "node:path";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

export const PERF_BUDGET_SCHEMA = "learning-companion.perf-budget-report.v1";

const DEFAULT_BUDGETS = Object.freeze({
  generatorElapsedMs: 5000,
  fileCount: 100,
  totalBytes: 5_000_000,
  largestFileBytes: 1_000_000
});

export function buildPerfBudgetReport(options = {}) {
  const repoRoot = resolve(options.repoRoot || process.cwd());
  const outDir = options.outDir || mkdtempSync(join(tmpdir(), "learning-companion-perf-"));
  const ownsOutDir = !options.outDir;
  const started = process.hrtime.bigint();
  try {
    execFileSync(process.execPath, [resolve(repoRoot, "scripts/build-morning-demo.mjs")], {
      cwd: repoRoot,
      env: {
        ...process.env,
        // The headline morning gate runs determinism separately before this check.
        // Perf uses a single isolated generator run so timing is not dominated by
        // the recursive byte-compare child run inside build-morning-demo.
        MORNING_DEMO_OUT_DIR: outDir,
        MORNING_SKIP_DETERMINISM: "1"
      },
      stdio: "pipe"
    });
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    const files = collectFiles(outDir);
    const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
    const largestFile = files.reduce((largest, file) => file.bytes > largest.bytes ? file : largest, {
      path: "",
      bytes: 0
    });
    const budgets = { ...DEFAULT_BUDGETS, ...(options.budgets || {}) };
    const checks = [
      budgetCheck("generator_elapsed_ms", elapsedMs, budgets.generatorElapsedMs, "ms"),
      budgetCheck("file_count", files.length, budgets.fileCount, "files"),
      budgetCheck("total_bytes", totalBytes, budgets.totalBytes, "bytes"),
      budgetCheck("largest_file_bytes", largestFile.bytes, budgets.largestFileBytes, "bytes")
    ];
    return {
      schema: PERF_BUDGET_SCHEMA,
      evidence: {
        tier: "EXECUTED",
        label: "EVIDENCE: EXECUTED",
        reason: "Morning pack generator was timed in an isolated output directory and checked against explicit size budgets."
      },
      checkedAt: options.checkedAt || new Date().toISOString(),
      ok: checks.every((check) => check.ok),
      budgets,
      measurements: {
        generatorElapsedMs: Math.round(elapsedMs),
        fileCount: files.length,
        totalBytes,
        largestFile
      },
      checks
    };
  } finally {
    if (ownsOutDir) rmSync(outDir, { recursive: true, force: true });
  }
}

function budgetCheck(name, actual, budget, unit) {
  return {
    name,
    ok: actual <= budget,
    actual: Math.round(actual),
    budget,
    unit
  };
}

function collectFiles(root) {
  return listFiles(root).map((path) => {
    const stats = statSync(path);
    return {
      path: relative(root, path).split(sep).join("/"),
      bytes: stats.size
    };
  }).sort((a, b) => a.path.localeCompare(b.path));
}

function listFiles(root) {
  const paths = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      paths.push(...listFiles(path));
    } else if (entry.isFile()) {
      paths.push(path);
    }
  }
  return paths;
}

function parseArgs(argv) {
  const args = {
    budgets: {},
    checkedAt: "",
    out: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") args.out = argv[++index] || "";
    else if (arg === "--checked-at") args.checkedAt = argv[++index] || "";
    else if (arg === "--max-generator-ms") args.budgets.generatorElapsedMs = parsePositiveNumber(argv[++index], arg);
    else if (arg === "--max-file-count") args.budgets.fileCount = parsePositiveNumber(argv[++index], arg);
    else if (arg === "--max-total-bytes") args.budgets.totalBytes = parsePositiveNumber(argv[++index], arg);
    else if (arg === "--max-largest-file-bytes") args.budgets.largestFileBytes = parsePositiveNumber(argv[++index], arg);
    else if (arg === "--help") {
      console.log("Usage: node scripts/perf-budget-check.mjs --out dist/perf-budget/PERF_BUDGET.json [--max-file-count 60]");
      process.exit(0);
    }
  }
  return args;
}

function parsePositiveNumber(value, flag) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${flag} expects a non-negative number`);
  }
  return number;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const report = buildPerfBudgetReport({
    budgets: args.budgets,
    checkedAt: args.checkedAt
  });
  if (args.out) {
    mkdirSync(dirname(args.out), { recursive: true, mode: 0o700 });
    writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  if (!report.ok) {
    console.error("perf_budget_failed");
    process.exit(1);
  }
  console.log("perf_budget_ok");
  if (args.out) console.log(args.out);
}
