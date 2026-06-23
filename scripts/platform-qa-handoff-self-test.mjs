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
const platformHandoffScript = join(repoRoot, "scripts/platform-qa-handoff.mjs");
const tmp = await mkdtemp(join(tmpdir(), "lc-platform-qa-handoff-"));
const fixtureRoot = join(tmp, "repo");
const outDir = join(tmp, "out");
const statusPath = join(fixtureRoot, ".codex-tmp/ko-evidence/current-status.json");
const macQaPath = join(fixtureRoot, "dist/morning-demo/MAC_MANUAL_QA.md");
const windowsQaPath = join(fixtureRoot, "dist/morning-demo/WINDOWS_STATIC_QA.md");
const harmonyQaPath = join(fixtureRoot, "dist/morning-demo/HARMONY_DEVICE_QA.md");
let cleanRevision;

const MAC_FIELDS = [
  "Date/time",
  "Reviewer",
  "Mac build/source",
  "macOS version",
  "Browser/source used",
  "Native build gate result",
  "Browser smoke gate result",
  "Total elapsed time",
  "Permission prompts observed",
  "Native save/import friction observed",
  "Biggest friction"
];

const WINDOWS_FIELDS = [
  "Date/time",
  "Reviewer",
  "Windows browser/device",
  "Mirror build/source",
  "Transfer method",
  "Mac import method",
  "Static return contract gate result",
  "Mac Return Files import result",
  "Total elapsed time",
  "Windows local-file friction observed",
  "Return-file transfer friction observed",
  "Biggest friction"
];

const HARMONY_FIELDS = [
  "Date/time",
  "Reviewer",
  "HarmonyOS device/build",
  "App build/source",
  "DevEco/toolchain gate result",
  "Import method",
  "Return transfer method",
  "Mac import method",
  "Mac Return Files import result",
  "Total elapsed time",
  "File-picker/storage friction observed",
  "Patch export/import friction observed",
  "Biggest friction"
];

try {
  await mkdir(dirname(statusPath), { recursive: true });
  await mkdir(dirname(macQaPath), { recursive: true });
  await mkdir(outDir, { recursive: true });

  await writeFixtureFiles();
  await initFixtureGit("initial platform QA fixture");
  cleanRevision = {
    gitAvailable: true,
    gitHead: (await git(["rev-parse", "HEAD"])).stdout.trim(),
    dirtyWorktree: false,
    statusLineCount: 0,
    statusSummary: "",
    statusTruncated: false
  };
  await writeFile(statusPath, `${JSON.stringify(buildStatus(), null, 2)}\n`);

  const cleanRun = await runPlatformHandoff("clean");
  assert.equal(cleanRun.code, 0, cleanRun.stderr);
  assert.match(cleanRun.stdout, /platform_qa_handoff_ok/);
  assert.match(cleanRun.stdout, /PENDING_NOT_RUN; 27\/27 rows still NT/);
  assert.match(cleanRun.stdout, /PENDING_NOT_RUN; 10\/10 rows still NT/);

  const cleanHandoff = await readJson(cleanRun.jsonPath);
  assert.equal(cleanHandoff.schema, "learning-companion.platform-qa-handoff.v1");
  assert.equal(cleanHandoff.evidenceTier, "PLATFORM_QA_HANDOFF_ONLY");
  assert.equal(cleanHandoff.canClaimKo, false);
  assert.equal(cleanHandoff.rawQaMarkdownRetained, false);
  assert.equal(cleanHandoff.rowNotesRetained, false);
  assert.equal(cleanHandoff.executionFreshness.status, "CURRENT_CLEAN_HEAD_PLATFORM_QA_HANDOFF");
  assert.equal(cleanHandoff.koStatusFreshness.status, "CURRENT_CLEAN_HEAD_KO_STATUS");
  assert.equal(cleanHandoff.currentRevision.gitAvailable, true);
  assert.equal(cleanHandoff.currentRevision.dirtyWorktree, false);
  assert.equal(cleanHandoff.koStatus.canClaimKo, false);
  assert.deepEqual(cleanHandoff.koStatus.missingRequirements.map((item) => item.id), [
    "nativeMacManualQa",
    "windowsStaticManualQa",
    "harmonyDeviceQa",
    "approvedExternalReadingVideo"
  ]);

  const mac = cleanHandoff.platforms.find((platform) => platform.id === "nativeMacManualQa");
  const windows = cleanHandoff.platforms.find((platform) => platform.id === "windowsStaticManualQa");
  const harmony = cleanHandoff.platforms.find((platform) => platform.id === "harmonyDeviceQa");
  assert.equal(mac.currentKoStatus.status, "PENDING_NOT_RUN");
  assert.equal(mac.canClaimPlatform, false);
  assert.equal(mac.currentTemplateSummary.rows, 27);
  assert.equal(mac.currentTemplateSummary.nt, 27);
  assert.equal(mac.currentTemplateSummary.anyRealRowsFilled, false);
  assert.equal(mac.currentTemplateSummary.requiredSessionFields.every((field) => field.filled === false), true);
  assert.equal(windows.currentTemplateSummary.rows, 10);
  assert.equal(windows.currentTemplateSummary.nt, 10);
  assert.equal(harmony.currentTemplateSummary.rows, 10);
  assert.equal(harmony.currentTemplateSummary.nt, 10);
  assert.deepEqual(Object.keys(mac.executionChecklist), [
    "beforeRun",
    "duringRun",
    "afterRun",
    "notAcceptedEvidence"
  ]);
  assert.match(mac.executionChecklist.beforeRun.join("\n"), /exact clean git HEAD/);
  assert.match(mac.executionChecklist.duringRun.join("\n"), /required session field/);
  assert.match(mac.executionChecklist.afterRun.join("\n"), /mac:manual:validate:real/);
  assert.equal(mac.executionChecklist.notAcceptedEvidence.includes("Fixture receipts"), true);
  assert.match(mac.nextRealRunSteps.join("\n"), /traceably produced from git HEAD [0-9a-f]{40}/);
  assert.match(mac.cannotBeFilledFrom.join("\n"), /Fixture receipts/);
  assert.equal((await stat(cleanRun.jsonPath)).mode & 0o777, 0o600);
  assert.equal((await stat(cleanRun.markdownPath)).mode & 0o777, 0o600);
  const cleanMarkdown = await readFile(cleanRun.markdownPath, "utf8");
  assert.match(cleanMarkdown, /Platform QA Execution Handoff/);
  assert.match(cleanMarkdown, /Can claim KO: false/);
  assert.match(cleanMarkdown, /KO status freshness: CURRENT\\_CLEAN\\_HEAD\\_KO\\_STATUS/);
  assert.match(cleanMarkdown, /npm run next:finalize -- --external <ko-evidence-review\.json>/);
  assert.match(cleanMarkdown, /Execution checklist/);
  assert.match(cleanMarkdown, /Before run/);
  assert.match(cleanMarkdown, /Not accepted as evidence/);
  assert.match(cleanMarkdown, /Cannot be filled from/);
  assert.match(cleanMarkdown, /No Mac GUI manual QA was run by this handoff/);

  await writeFile(statusPath, `${JSON.stringify(buildStatus({
    currentRevision: {
      ...cleanRevision,
      gitHead: "0000000000000000000000000000000000000000"
    }
  }), null, 2)}\n`);
  const staleStatusRun = await runPlatformHandoff("stale-status");
  assert.equal(staleStatusRun.code, 0, staleStatusRun.stderr);
  const staleStatusHandoff = await readJson(staleStatusRun.jsonPath);
  assert.equal(staleStatusHandoff.koStatusFreshness.status, "STALE_OR_DIRTY_KO_STATUS");
  assert.equal(staleStatusHandoff.executionFreshness.status, "REVISION_REFRESH_REQUIRED_BEFORE_PLATFORM_QA");
  assert.ok(staleStatusHandoff.koStatusFreshness.problems.some((problem) => problem.includes("does not match current HEAD")));
  await writeFile(statusPath, `${JSON.stringify(buildStatus(), null, 2)}\n`);

  await writeFile(macQaPath, buildQaMarkdown("Mac", 27, MAC_FIELDS, {
    firstResult: "PASS",
    firstNotes: ""
  }));
  await git(["add", "dist/morning-demo/MAC_MANUAL_QA.md"]);
  await gitCommit("record fixture partial Mac QA");

  const partialRun = await runPlatformHandoff("partial");
  assert.equal(partialRun.code, 0, partialRun.stderr);
  const partialHandoff = await readJson(partialRun.jsonPath);
  const partialMac = partialHandoff.platforms.find((platform) => platform.id === "nativeMacManualQa");
  assert.equal(partialMac.currentTemplateSummary.pass, 1);
  assert.equal(partialMac.currentTemplateSummary.nt, 26);
  assert.equal(partialMac.currentTemplateSummary.anyRealRowsFilled, true);
  assert.equal(partialMac.currentTemplateSummary.rowsNeedingConcreteNotes, 1);
  assert.equal(partialMac.currentTemplateSummary.allRowsPass, false);
  assert.equal(partialMac.canClaimPlatform, false);

  await writeFile(join(fixtureRoot, "dirty-untracked.txt"), "dirty\n");
  const dirtyRun = await runPlatformHandoff("dirty");
  assert.equal(dirtyRun.code, 0, dirtyRun.stderr);
  const dirtyHandoff = await readJson(dirtyRun.jsonPath);
  assert.equal(dirtyHandoff.executionFreshness.status, "REVISION_REFRESH_REQUIRED_BEFORE_PLATFORM_QA");
  assert.equal(dirtyHandoff.currentRevision.dirtyWorktree, true);

  const missingStatus = await runNode([platformHandoffScript, "--status", join(tmp, "missing-status.json")], fixtureRoot);
  assert.notEqual(missingStatus.code, 0);
  assert.match(`${missingStatus.stdout}\n${missingStatus.stderr}`, /Missing KO status file/);

  const missingOutPath = await runNode([platformHandoffScript, "--out"], fixtureRoot);
  assert.notEqual(missingOutPath.code, 0);
  assert.match(`${missingOutPath.stdout}\n${missingOutPath.stderr}`, /--out requires a file path/);

  const missingMarkdownPath = await runNode([platformHandoffScript, "--markdown-out"], fixtureRoot);
  assert.notEqual(missingMarkdownPath.code, 0);
  assert.match(`${missingMarkdownPath.stdout}\n${missingMarkdownPath.stderr}`, /--markdown-out requires a file path/);

  console.log("platform_qa_handoff_selftest_ok");
} finally {
  await rm(tmp, { recursive: true, force: true });
}

async function writeFixtureFiles() {
  await writeFile(join(fixtureRoot, ".gitignore"), ".codex-tmp/\n");
  await writeFile(macQaPath, buildQaMarkdown("Mac", 27, MAC_FIELDS));
  await writeFile(windowsQaPath, buildQaMarkdown("Windows", 10, WINDOWS_FIELDS));
  await writeFile(harmonyQaPath, buildQaMarkdown("Harmony", 10, HARMONY_FIELDS));
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

async function runPlatformHandoff(label) {
  const jsonPath = join(outDir, `${label}.json`);
  const markdownPath = join(outDir, `${label}.md`);
  const result = await runNode([
    platformHandoffScript,
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

async function runNode(args, cwd) {
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

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function buildStatus({ currentRevision = cleanRevision } = {}) {
  return {
    schema: "learning-companion.ko-evidence-review.v1",
    evidenceTier: "KO_MISSING_EVIDENCE",
    canClaimKo: false,
    currentRevision,
    requirements: [
      {
        id: "bilingualRuntime",
        status: "PASS",
        detail: "fixture bilingual runtime passed"
      },
      {
        id: "controlledLearningLoop",
        status: "PASS",
        detail: "fixture controlled loop passed"
      },
      {
        id: "nativeMacManualQa",
        status: "FAIL",
        detail: "Mac manual QA rows must all PASS"
      },
      {
        id: "windowsStaticManualQa",
        status: "FAIL",
        detail: "Windows static QA rows must all PASS"
      },
      {
        id: "harmonyDeviceQa",
        status: "FAIL",
        detail: "HarmonyOS device QA rows must all PASS"
      },
      {
        id: "approvedExternalReadingVideo",
        status: "MISSING",
        detail: "Requires privacy-reviewed approved external evidence"
      }
    ],
    platformQaStatus: [
      {
        id: "nativeMacManualQa",
        status: "PENDING_NOT_RUN",
        detail: "fixture pending Mac",
        evidencePath: ".codex-tmp/mac-manual-qa/receipt.json"
      },
      {
        id: "windowsStaticManualQa",
        status: "PENDING_NOT_RUN",
        detail: "fixture pending Windows",
        evidencePath: ".codex-tmp/windows-static-qa/receipt.json"
      },
      {
        id: "harmonyDeviceQa",
        status: "PENDING_NOT_RUN",
        detail: "fixture pending Harmony",
        evidencePath: ".codex-tmp/harmony-device-qa/receipt.json"
      }
    ]
  };
}

function buildQaMarkdown(label, rows, fields, options = {}) {
  const lines = [
    `# ${label} QA Fixture`,
    "",
    "| Field | Value |",
    "| --- | --- |"
  ];
  for (const field of fields) {
    lines.push(`| ${field} | TBD |`);
  }
  lines.push(
    "",
    "| Area | Steps | Expected | Result | Notes |",
    "| --- | --- | --- | --- | --- |"
  );
  for (let index = 0; index < rows; index += 1) {
    const result = index === 0 && options.firstResult ? options.firstResult : "NT";
    const notes = index === 0 && Object.hasOwn(options, "firstNotes") ? options.firstNotes : "";
    lines.push(`| ${label} area ${index + 1} | Do fixture step ${index + 1}. | See expected fixture state. | ${result} | ${notes} |`);
  }
  return `${lines.join("\n")}\n`;
}
