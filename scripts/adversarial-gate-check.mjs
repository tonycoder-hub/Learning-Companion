#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compareOutputDirs } from "./morning-determinism-check.mjs";
import { buildMirrorIntegrityReport } from "./mirror-integrity-check.mjs";

export const ADVERSARIAL_GATES_SCHEMA = "learning-companion.adversarial-gates-report.v1";
const KEEP_CHECK_ARTIFACTS = process.env.LC_KEEP_CHECK_ARTIFACTS === "1";

export function buildAdversarialGateReport(options = {}) {
  const checkedAt = options.checkedAt || new Date().toISOString();
  const tempBase = resolve(".codex-tmp/adversarial-gate");
  mkdirSync(tempBase, { recursive: true, mode: 0o700 });
  const tempRoot = mkdtempSync(join(tempBase, "run-"));
  try {
    const deterministicFailure = buildDeterminismFailureCase(tempRoot, checkedAt);
    const mirrorFailure = buildMirrorFailureCase(tempRoot, checkedAt);
    const checks = [deterministicFailure, mirrorFailure];
    return {
      schema: ADVERSARIAL_GATES_SCHEMA,
      evidence: {
        tier: "EXECUTED",
        label: "EVIDENCE: EXECUTED",
        reason: "Adversarial fixtures prove the determinism and mirror-integrity gates fail when their invariants are violated."
      },
      checkedAt,
      ok: checks.every((check) => check.ok),
      summary: {
        checks: checks.length,
        passed: checks.filter((check) => check.ok).length
      },
      checks
    };
  } finally {
    if (!KEEP_CHECK_ARTIFACTS) rmSync(tempRoot, { recursive: true, force: true });
  }
}

function buildDeterminismFailureCase(tempRoot, checkedAt) {
  const first = join(tempRoot, "determinism-first");
  const second = join(tempRoot, "determinism-second");
  writeText(join(first, "stable.txt"), "same\n");
  writeText(join(second, "stable.txt"), "different\n");
  const report = compareOutputDirs(first, second, { checkedAt });
  assert.equal(report.ok, false);
  assert.equal(report.summary.differences > 0, true);
  return {
    name: "determinism_detects_changed_file",
    ok: true,
    expectedFailureObserved: !report.ok,
    observedDifferences: report.summary.differences,
    sampleDifferencePath: report.differences[0]?.path || ""
  };
}

function buildMirrorFailureCase(tempRoot, checkedAt) {
  const mirror = join(tempRoot, "broken-mirror");
  writeText(join(mirror, "index.html"), '<!doctype html><a href="missing.html">Broken</a>\n');
  writeText(join(mirror, "README.md"), "[Also broken](nested/missing.md)\n");
  const report = buildMirrorIntegrityReport(mirror, {
    checkedAt,
    rootLabel: "adversarial-broken-mirror"
  });
  assert.equal(report.ok, false);
  assert.equal(report.summary.brokenLinks, 2);
  return {
    name: "mirror_integrity_detects_broken_links",
    ok: true,
    expectedFailureObserved: !report.ok,
    brokenLinks: report.summary.brokenLinks,
    sampleBrokenLinks: report.brokenLinks.map((link) => ({
      sourcePath: link.sourcePath,
      href: link.href,
      targetPath: link.targetPath
    }))
  };
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, value, "utf8");
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
      console.log("Usage: node scripts/adversarial-gate-check.mjs --out dist/morning-demo/ADVERSARIAL_GATES.json");
      process.exit(0);
    }
  }
  return args;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const report = buildAdversarialGateReport({ checkedAt: args.checkedAt });
  if (args.out) {
    writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  if (!report.ok) {
    console.error("adversarial_gates_failed");
    process.exit(1);
  }
  console.log("adversarial_gates_ok");
  if (args.out) console.log(args.out);
}
