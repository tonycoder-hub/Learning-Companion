#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const MORNING_DETERMINISM_SCHEMA = "learning-companion.morning-determinism-report.v1";

export function buildMorningDeterminismReport(options = {}) {
  const repoRoot = resolve(options.repoRoot || process.cwd());
  const scriptPath = resolve(repoRoot, "scripts/build-morning-demo.mjs");
  const tempBase = join(repoRoot, ".codex-tmp/morning-determinism");
  mkdirSync(tempBase, { recursive: true, mode: 0o700 });
  const tempRoot = mkdtempSync(join(tempBase, "run-"));
  const firstOut = join(tempRoot, "first");
  const secondOut = join(tempRoot, "second");
  try {
    runGenerator(scriptPath, repoRoot, firstOut);
    runGenerator(scriptPath, repoRoot, secondOut);
    const firstFiles = fileHashes(firstOut);
    const secondFiles = fileHashes(secondOut);
    const differences = compareHashes(firstFiles, secondFiles);
    return {
      schema: MORNING_DETERMINISM_SCHEMA,
      evidence: {
        tier: "EXECUTED",
        label: "EVIDENCE: EXECUTED",
        reason: "The morning generator was run twice in isolated temp directories and output bytes were compared."
      },
      checkedAt: options.checkedAt || new Date().toISOString(),
      ok: differences.length === 0,
      summary: {
        comparedFiles: Object.keys(firstFiles).length,
        differences: differences.length
      },
      differences,
      firstOutputSha256: sha256Text(JSON.stringify(firstFiles)),
      secondOutputSha256: sha256Text(JSON.stringify(secondFiles))
    };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function compareOutputDirs(firstDir, secondDir, options = {}) {
  const firstFiles = fileHashes(resolve(firstDir));
  const secondFiles = fileHashes(resolve(secondDir));
  const differences = compareHashes(firstFiles, secondFiles);
  return {
    schema: MORNING_DETERMINISM_SCHEMA,
    evidence: {
      tier: "EXECUTED",
      label: "EVIDENCE: EXECUTED",
      reason: "Two output directories were compared byte-for-byte."
    },
    checkedAt: options.checkedAt || new Date().toISOString(),
    ok: differences.length === 0,
    summary: {
      comparedFiles: Object.keys(firstFiles).length,
      differences: differences.length
    },
    differences,
    firstOutputSha256: sha256Text(JSON.stringify(firstFiles)),
    secondOutputSha256: sha256Text(JSON.stringify(secondFiles))
  };
}

function runGenerator(scriptPath, repoRoot, outDir) {
  execFileSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      MORNING_DEMO_OUT_DIR: outDir,
      MORNING_SKIP_DETERMINISM: "1"
    },
    stdio: "pipe"
  });
}

function fileHashes(root) {
  const hashes = {};
  for (const path of listFiles(root)) {
    const data = readFileSync(path);
    hashes[toRelative(root, path)] = {
      bytes: data.length,
      sha256: createHash("sha256").update(data).digest("hex")
    };
  }
  return hashes;
}

function compareHashes(first, second) {
  const paths = Array.from(new Set([...Object.keys(first), ...Object.keys(second)])).sort();
  return paths
    .filter((path) => first[path]?.sha256 !== second[path]?.sha256 || first[path]?.bytes !== second[path]?.bytes)
    .map((path) => ({
      path,
      first: first[path] || null,
      second: second[path] || null
    }));
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
  return paths.sort((a, b) => a.localeCompare(b));
}

function toRelative(root, path) {
  return relative(root, path).split(sep).join("/");
}

function sha256Text(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function parseArgs(argv) {
  const args = {
    out: "",
    checkedAt: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") args.out = argv[++index] || "";
    else if (arg === "--checked-at") args.checkedAt = argv[++index] || "";
    else if (arg === "--help") {
      console.log("Usage: node scripts/morning-determinism-check.mjs --out dist/morning-demo/DETERMINISM.json");
      process.exit(0);
    }
  }
  return args;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const report = buildMorningDeterminismReport({ checkedAt: args.checkedAt });
  if (args.out) {
    writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  if (!report.ok) {
    console.error(`morning_determinism_failed ${report.summary.differences} differences`);
    process.exit(1);
  }
  console.log("morning_determinism_ok");
  if (args.out) console.log(args.out);
}
