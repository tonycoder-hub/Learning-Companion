#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = dirname(dirname(scriptPath));
const readinessScript = join(repoRoot, "scripts/next-major-readiness.mjs");
const tmp = await mkdtemp(join(tmpdir(), "lc-next-major-readiness-"));
const fixtureRoot = join(tmp, "repo");
const inputDir = join(tmp, "inputs");
const outDir = join(tmp, "out");
let cleanRevision;
const REQUIRED_REQUIREMENT_IDS = [
  "bilingualRuntime",
  "controlledLearningLoop",
  "nativeMacManualQa",
  "windowsStaticManualQa",
  "harmonyDeviceQa",
  "approvedExternalReadingVideo"
];

try {
  await mkdir(fixtureRoot, { recursive: true });
  await mkdir(inputDir, { recursive: true });
  await mkdir(outDir, { recursive: true });
  await writeFile(join(fixtureRoot, "README.md"), "readiness fixture\n");
  await initFixtureGit("initial readiness fixture");
  cleanRevision = {
    gitAvailable: true,
    gitHead: (await git(["rev-parse", "HEAD"])).stdout.trim(),
    dirtyWorktree: false,
    statusLineCount: 0,
    statusSummary: "",
    statusTruncated: false
  };

  const blockedStatusPath = join(inputDir, "blocked-status.json");
  await writeJson(blockedStatusPath, buildStatus({
    canClaimKo: false,
    requirementStatuses: completeRequirementStatuses({
      nativeMacManualQa: "FAIL",
      windowsStaticManualQa: "FAIL",
      harmonyDeviceQa: "FAIL",
      approvedExternalReadingVideo: "MISSING"
    })
  }));
  const blockedRun = await runReadiness("blocked", blockedStatusPath);
  assert.equal(blockedRun.code, 0, blockedRun.stderr);
  assert.match(blockedRun.stdout, /next_major_readiness_ok/);
  assert.match(blockedRun.stdout, /Readiness status: NOT_READY_MISSING_EVIDENCE/);
  assert.match(blockedRun.stdout, /Can claim next-major pre-release ready: NO/);

  const blocked = await readJson(blockedRun.jsonPath);
  assert.equal(blocked.schema, "learning-companion.next-major-readiness.v1");
  assert.equal(blocked.evidenceTier, "NEXT_MAJOR_READINESS_SUMMARY_ONLY");
  assert.equal(blocked.canClaimNextMajorPreReleaseReady, false);
  assert.equal(blocked.releaseActionAuthorized, false);
  assert.equal(blocked.readinessStatus, "NOT_READY_MISSING_EVIDENCE");
  assert.equal(blocked.sourceKoStatus.canClaimKo, false);
  assert.equal(blocked.koStatusFreshness.status, "CURRENT_CLEAN_HEAD_KO_STATUS");
  assert.deepEqual(blocked.requirements.map((item) => item.id), REQUIRED_REQUIREMENT_IDS);
  assert.deepEqual(blocked.blockingRequirements.map((item) => item.id), [
    "nativeMacManualQa",
    "windowsStaticManualQa",
    "harmonyDeviceQa",
    "approvedExternalReadingVideo"
  ]);
  assert.equal(blocked.platformQaStatus.length, 3);
  assert.equal(blocked.platformQaStatus[0].rows.nt, 27);
  assert.equal(blocked.platformQaStatus[0].claimAllowed, false);
  assert.equal(blocked.platformQaStatus[0].gates.nativeBuild.pass, false);
  assert.equal(blocked.nextCommands.platformHandoff, "npm run platform:qa-handoff -- --out .codex-tmp/platform-qa-handoff/current.json --markdown-out .codex-tmp/platform-qa-handoff/current.md");
  assert.equal(blocked.nextCommands.finalizeNextMajor, "npm run next:finalize -- --external <ko-evidence-review.json>");
  assert.equal(blocked.blockedOrNotExecuted.includes("No build, package, deployment, Mew-Test, main-site, or remote acceptance check was run by this readiness packet."), true);
  assert.equal((await stat(blockedRun.jsonPath)).mode & 0o777, 0o600);
  assert.equal((await stat(blockedRun.markdownPath)).mode & 0o777, 0o600);
  const blockedMarkdown = await readFile(blockedRun.markdownPath, "utf8");
  assert.match(blockedMarkdown, /Next Major Readiness Packet/);
  assert.match(blockedMarkdown, /Release action authorized: false/);
  assert.match(blockedMarkdown, /npm run next:finalize -- --external <ko-evidence-review\.json>/);
  assert.match(blockedMarkdown, /No build, package, deployment, Mew-Test, main-site, or remote acceptance check was run by this readiness packet/);

  const cannotClaimWithPassingRequirementsStatusPath = join(inputDir, "cannot-claim-with-passing-requirements.json");
  await writeJson(cannotClaimWithPassingRequirementsStatusPath, buildStatus({
    canClaimKo: false,
    requirementStatuses: completeRequirementStatuses()
  }));
  const cannotClaimWithPassingRequirementsRun = await runReadiness("cannot-claim-with-passing-requirements", cannotClaimWithPassingRequirementsStatusPath);
  assert.equal(cannotClaimWithPassingRequirementsRun.code, 0, cannotClaimWithPassingRequirementsRun.stderr);
  const cannotClaimWithPassingRequirements = await readJson(cannotClaimWithPassingRequirementsRun.jsonPath);
  assert.equal(cannotClaimWithPassingRequirements.sourceKoStatus.canClaimKo, false);
  assert.equal(cannotClaimWithPassingRequirements.blockingRequirements.length, 0);
  assert.equal(cannotClaimWithPassingRequirements.canClaimNextMajorPreReleaseReady, false);
  assert.equal(cannotClaimWithPassingRequirements.readinessStatus, "NOT_READY_MISSING_EVIDENCE");

  const claimWithFailingRequirementStatusPath = join(inputDir, "claim-with-failing-requirement.json");
  await writeJson(claimWithFailingRequirementStatusPath, buildStatus({
    canClaimKo: true,
    requirementStatuses: completeRequirementStatuses({
      approvedExternalReadingVideo: "MISSING"
    })
  }));
  const claimWithFailingRequirementRun = await runReadiness("claim-with-failing-requirement", claimWithFailingRequirementStatusPath);
  assert.equal(claimWithFailingRequirementRun.code, 0, claimWithFailingRequirementRun.stderr);
  const claimWithFailingRequirement = await readJson(claimWithFailingRequirementRun.jsonPath);
  assert.equal(claimWithFailingRequirement.sourceKoStatus.canClaimKo, true);
  assert.deepEqual(claimWithFailingRequirement.blockingRequirements.map((item) => item.id), ["approvedExternalReadingVideo"]);
  assert.equal(claimWithFailingRequirement.canClaimNextMajorPreReleaseReady, false);
  assert.equal(claimWithFailingRequirement.readinessStatus, "NOT_READY_MISSING_EVIDENCE");

  const staleStatusPath = join(inputDir, "stale-status.json");
  await writeJson(staleStatusPath, buildStatus({
    canClaimKo: true,
    requirementStatuses: completeRequirementStatuses(),
    platformStatus: "PASSING_REAL_RUN",
    platformClaimAllowed: true,
    currentRevision: {
      ...cleanRevision,
      gitHead: "0000000000000000000000000000000000000000"
    }
  }));
  const staleRun = await runReadiness("stale", staleStatusPath);
  assert.equal(staleRun.code, 0, staleRun.stderr);
  const stale = await readJson(staleRun.jsonPath);
  assert.equal(stale.sourceKoStatus.canClaimKo, true);
  assert.equal(stale.koStatusFreshness.status, "STALE_OR_DIRTY_KO_STATUS");
  assert.deepEqual(stale.blockingRequirements.map((item) => item.id), ["koStatusFreshness"]);
  assert.equal(stale.canClaimNextMajorPreReleaseReady, false);
  assert.equal(stale.readinessStatus, "NOT_READY_MISSING_EVIDENCE");

  const refreshStatusPath = join(outDir, "refresh-status.json");
  const refreshRun = await runNode([readinessScript, "--refresh", "--status", refreshStatusPath]);
  assert.equal(refreshRun.code, 0, refreshRun.stderr);
  assert.match(refreshRun.stdout, /next_major_readiness_ok/);
  const refreshedStatus = await readJson(refreshStatusPath);
  assert.equal(refreshedStatus.schema, "learning-companion.ko-evidence-review.v1");
  assert.equal((await stat(refreshStatusPath)).mode & 0o777, 0o600);

  // Readiness trusts upstream KO requirement aggregation; platform QA rows are carried for operator context.
  const readyStatusPath = join(inputDir, "ready-status.json");
  await writeJson(readyStatusPath, buildStatus({
    canClaimKo: true,
    requirementStatuses: completeRequirementStatuses(),
    platformStatus: "PASSING_REAL_RUN",
    platformClaimAllowed: true
  }));
  const readyRun = await runReadiness("ready", readyStatusPath);
  assert.equal(readyRun.code, 0, readyRun.stderr);
  assert.match(readyRun.stdout, /Can claim next-major pre-release ready: YES/);
  const ready = await readJson(readyRun.jsonPath);
  assert.equal(ready.canClaimNextMajorPreReleaseReady, true);
  assert.equal(ready.koStatusFreshness.status, "CURRENT_CLEAN_HEAD_KO_STATUS");
  assert.equal(ready.releaseActionAuthorized, false);
  assert.equal(ready.readinessStatus, "PRE_RELEASE_EVIDENCE_READY");
  assert.equal(ready.blockingRequirements.length, 0);
  assert.equal(ready.sourceKoStatus.canClaimKo, true);
  assert.equal(ready.platformQaStatus.every((platform) => platform.claimAllowed === true), true);
  const readyMarkdown = await readFile(readyRun.markdownPath, "utf8");
  assert.match(readyMarkdown, /Can claim next-major pre-release ready: true/);
  assert.match(readyMarkdown, /Release action authorized: false/);

  const missingStatusRun = await runNode([readinessScript, "--status", join(inputDir, "missing-status.json")]);
  assert.notEqual(missingStatusRun.code, 0);
  assert.match(`${missingStatusRun.stdout}\n${missingStatusRun.stderr}`, /Missing KO status file/);

  const schemaMismatchPath = join(inputDir, "schema-mismatch.json");
  await writeJson(schemaMismatchPath, {
    schema: "wrong.schema"
  });
  const schemaMismatchRun = await runNode([readinessScript, "--status", schemaMismatchPath]);
  assert.notEqual(schemaMismatchRun.code, 0);
  assert.match(`${schemaMismatchRun.stdout}\n${schemaMismatchRun.stderr}`, /KO status schema mismatch/);

  const missingRequirementPath = join(inputDir, "missing-requirement.json");
  const missingRequirementStatus = buildStatus({
    canClaimKo: false,
    requirementStatuses: completeRequirementStatuses({
      nativeMacManualQa: "FAIL"
    })
  });
  missingRequirementStatus.requirements = missingRequirementStatus.requirements.filter((item) => item.id !== "approvedExternalReadingVideo");
  await writeJson(missingRequirementPath, missingRequirementStatus);
  const missingRequirementRun = await runNode([readinessScript, "--status", missingRequirementPath]);
  assert.notEqual(missingRequirementRun.code, 0);
  assert.match(`${missingRequirementRun.stdout}\n${missingRequirementRun.stderr}`, /missing required requirements: approvedExternalReadingVideo/);

  const missingOutPathRun = await runNode([readinessScript, "--out"]);
  assert.notEqual(missingOutPathRun.code, 0);
  assert.match(`${missingOutPathRun.stdout}\n${missingOutPathRun.stderr}`, /--out requires a file path/);

  const missingMarkdownPathRun = await runNode([readinessScript, "--markdown-out"]);
  assert.notEqual(missingMarkdownPathRun.code, 0);
  assert.match(`${missingMarkdownPathRun.stdout}\n${missingMarkdownPathRun.stderr}`, /--markdown-out requires a file path/);

  console.log("next_major_readiness_selftest_ok");
} finally {
  await rm(tmp, { recursive: true, force: true });
}

async function runReadiness(label, statusPath) {
  const jsonPath = join(outDir, `${label}.json`);
  const markdownPath = join(outDir, `${label}.md`);
  const result = await runNode([
    readinessScript,
    "--status",
    statusPath,
    "--out",
    jsonPath,
    "--markdown-out",
    markdownPath
  ], fixtureRoot);
  return {
    ...result,
    jsonPath,
    markdownPath
  };
}

async function initFixtureGit(message) {
  await git(["init"]);
  await git(["add", "."]);
  await gitCommit(message);
}

async function git(args) {
  const result = await runCommand("git", args, fixtureRoot);
  assert.equal(result.code, 0, result.stderr || result.stdout);
  return result;
}

async function gitCommit(message) {
  await git([
    "-c",
    "user.name=Learning Companion Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "-m",
    message
  ]);
}

async function runNode(args, cwd = repoRoot) {
  return runCommand(process.execPath, args, cwd);
}

async function runCommand(command, args, cwd) {
  try {
    const result = await execFileAsync(command, args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    });
    return {
      code: 0,
      stdout: result.stdout || "",
      stderr: result.stderr || ""
    };
  } catch (error) {
    return {
      code: Number.isInteger(error.code) ? error.code : 1,
      stdout: String(error.stdout || ""),
      stderr: String(error.stderr || error.message || "")
    };
  }
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function buildStatus({ canClaimKo, requirementStatuses, platformStatus = "PENDING_NOT_RUN", platformClaimAllowed = false, currentRevision = cleanRevision }) {
  assert.deepEqual([...Object.keys(requirementStatuses)].sort(), [...REQUIRED_REQUIREMENT_IDS].sort());
  return {
    schema: "learning-companion.ko-evidence-review.v1",
    evidenceTier: canClaimKo ? "KO_READY" : "KO_MISSING_EVIDENCE",
    canClaimKo,
    currentRevision,
    requirements: REQUIRED_REQUIREMENT_IDS.map((id) => {
      const status = requirementStatuses[id];
      return {
        id,
        status,
        evidencePath: status === "PASS" ? `.codex-tmp/evidence/${id}.json` : "",
        detail: status === "PASS" ? "fixture pass" : `fixture ${id} not ready`
      };
    }),
    platformQaStatus: [
      buildPlatformStatus("nativeMacManualQa", "Native Mac manual QA", 27, platformStatus, platformClaimAllowed, {
        nativeBuild: false,
        browserSmoke: false
      }),
      buildPlatformStatus("windowsStaticManualQa", "Windows static/manual QA", 10, platformStatus, platformClaimAllowed, {
        staticReturnContract: false,
        macReturnFilesImport: false
      }),
      buildPlatformStatus("harmonyDeviceQa", "HarmonyOS device/toolchain QA", 10, platformStatus, platformClaimAllowed, {
        devEcoToolchain: false,
        macReturnFilesImport: false
      })
    ]
  };
}

function completeRequirementStatuses(overrides = {}) {
  return Object.fromEntries(REQUIRED_REQUIREMENT_IDS.map((id) => [
    id,
    Object.prototype.hasOwnProperty.call(overrides, id) ? overrides[id] : "PASS"
  ]));
}

function buildPlatformStatus(id, label, totalRows, status, claimAllowed, gatePasses) {
  const passing = status === "PASSING_REAL_RUN";
  return {
    id,
    label,
    status,
    evidencePath: `.codex-tmp/${id}/receipt.json`,
    detail: passing ? "fixture passing real run" : "fixture pending run",
    rows: {
      total: totalRows,
      pass: passing ? totalRows : 0,
      fail: 0,
      blocked: 0,
      nt: passing ? 0 : totalRows,
      invalid: 0,
      allRowsExecuted: passing,
      allRowsPass: passing,
      anyRealRowsFilled: passing
    },
    gates: Object.fromEntries(Object.entries(gatePasses).map(([key, value]) => [key, {
      label: key,
      pass: passing ? true : value
    }])),
    claimAllowed
  };
}
