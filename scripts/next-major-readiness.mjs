#!/usr/bin/env node
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const READINESS_SCHEMA = "learning-companion.next-major-readiness.v1";
const STATUS_PATH = ".codex-tmp/ko-evidence/current-status.json";
const KO_STATUS_SCHEMA = "learning-companion.ko-evidence-review.v1";
const REQUIRED_REQUIREMENT_IDS = [
  "bilingualRuntime",
  "controlledLearningLoop",
  "nativeMacManualQa",
  "windowsStaticManualQa",
  "harmonyDeviceQa",
  "approvedExternalReadingVideo"
];
const READINESS_PACKET_NOT_EXECUTED = [
  "No new approved external reading/video candidate was run by this readiness packet.",
  "No human privacy review was performed by this readiness packet.",
  "No native Mac manual QA was run by this readiness packet.",
  "No Windows static/manual QA was run by this readiness packet.",
  "No HarmonyOS device/toolchain QA was run by this readiness packet.",
  "No build, package, deployment, Mew-Test, main-site, or remote acceptance check was run by this readiness packet."
];

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(buildHelp());
  process.exit(0);
}
for (const key of ["status", "out", "markdown-out"]) {
  if (args[key] === true) throw new Error(`--${key} requires a file path.`);
}

const statusPath = String(args.status || STATUS_PATH);
if (args.refresh) {
  await refreshKoStatus(statusPath);
}
const readiness = await buildNextMajorReadiness(statusPath);
if (args.out) {
  await writePrivateFile(resolve(String(args.out)), `${JSON.stringify(readiness, null, 2)}\n`);
}
if (args["markdown-out"]) {
  await writePrivateFile(resolve(String(args["markdown-out"])), buildNextMajorReadinessMarkdown(readiness));
}
console.log(buildConsoleSummary(readiness, {
  outPath: args.out ? resolve(String(args.out)) : "",
  markdownPath: args["markdown-out"] ? resolve(String(args["markdown-out"])) : ""
}));

async function refreshKoStatus(statusPath) {
  try {
    await execFileAsync(process.execPath, [
      "scripts/validate-ko-evidence.mjs",
      "--allow-missing",
      "--out",
      statusPath
    ], {
      maxBuffer: 1024 * 1024
    });
  } catch (error) {
    const stderr = String(error.stderr || error.message || "").trim();
    throw new Error(`Failed to refresh KO status: ${stderr || "unknown error"}`);
  }
}

async function buildNextMajorReadiness(statusPath) {
  if (!existsSync(statusPath)) {
    throw new Error(`Missing KO status file: ${statusPath}. Run: npm run next:readiness -- --refresh --out .codex-tmp/next-major-readiness/current.json`);
  }
  const status = JSON.parse(await readFile(statusPath, "utf8"));
  if (status.schema !== KO_STATUS_SCHEMA) {
    throw new Error(`KO status schema mismatch: ${status.schema || "missing"}`);
  }
  const requirements = normalizeRequirements(status.requirements);
  assertRequiredRequirements(requirements);
  const platformQaStatus = normalizePlatformStatuses(status.platformQaStatus);
  const blockingRequirements = requirements.filter((item) => item.status !== "PASS");
  const ready = status.canClaimKo === true && blockingRequirements.length === 0;
  return {
    schema: READINESS_SCHEMA,
    generatedAt: new Date().toISOString(),
    evidenceTier: "NEXT_MAJOR_READINESS_SUMMARY_ONLY",
    canClaimNextMajorPreReleaseReady: ready,
    releaseActionAuthorized: false,
    readinessStatus: ready ? "PRE_RELEASE_EVIDENCE_READY" : "NOT_READY_MISSING_EVIDENCE",
    claimBoundary: "Readiness summary only. It does not authorize release, run external-source validation, privacy review, Mac QA, Windows QA, HarmonyOS QA, build, packaging, deployment, or remote acceptance.",
    statusPath,
    sourceKoStatus: {
      schema: status.schema || "UNKNOWN",
      evidenceTier: status.evidenceTier || "UNKNOWN",
      canClaimKo: status.canClaimKo === true
    },
    requirements,
    blockingRequirements,
    platformQaStatus,
    nextCommands: {
      refreshReadiness: "npm run next:readiness -- --refresh --out .codex-tmp/next-major-readiness/current.json --markdown-out .codex-tmp/next-major-readiness/current.md",
      sourceApprovalRequest: "npm run external:approval-request -- --intake-handoff .codex-tmp/external-source-validation/source-intake-handoff.json --out .codex-tmp/external-source-validation/source-approval-request.json --markdown-out .codex-tmp/external-source-validation/source-approval-request.md",
      approvedSourceCandidate: "npm run external:validate -- --approved-current-turn --reading-url <approved-reading-url> --video-url <approved-video-url> --video-timestamp <captured-timestamp> --approval-note \"<current-turn approval>\"",
      privacyTemplate: "npm run external:privacy-template -- --receipt <candidate-receipt.json> --out <privacy-review.json>",
      privacyReview: "npm run external:privacy-review -- --receipt <candidate-receipt.json> --review <privacy-review.json> --out <ko-evidence-review.json>",
      platformHandoff: "npm run platform:qa-handoff -- --out .codex-tmp/platform-qa-handoff/current.json --markdown-out .codex-tmp/platform-qa-handoff/current.md",
      finalKoGate: "npm run ko:validate -- --external <ko-evidence-review.json> --out .codex-tmp/ko-evidence/final.json",
      finalKoGateWithExplicitPlatformReceipts: "npm run ko:validate -- --external <ko-evidence-review.json> --mac-manual .codex-tmp/mac-manual-qa/real-run-receipt.json --windows-static .codex-tmp/windows-static-qa/real-run-receipt.json --harmony-device .codex-tmp/harmony-device-qa/real-run-receipt.json --out .codex-tmp/ko-evidence/final.json"
    },
    blockedOrNotExecuted: READINESS_PACKET_NOT_EXECUTED
  };
}

function assertRequiredRequirements(requirements) {
  const ids = new Set(requirements.map((item) => item.id));
  const missing = REQUIRED_REQUIREMENT_IDS.filter((id) => !ids.has(id));
  if (missing.length) {
    throw new Error(`KO status is missing required requirements: ${missing.join(", ")}`);
  }
}

function normalizeRequirements(requirements) {
  return (Array.isArray(requirements) ? requirements : []).map((item) => ({
    id: item.id || "UNKNOWN",
    status: item.status || "UNKNOWN",
    evidencePath: item.evidencePath || "",
    detail: item.detail || ""
  }));
}

function normalizePlatformStatuses(statuses) {
  return (Array.isArray(statuses) ? statuses : []).map((item) => ({
    id: item.id || "UNKNOWN",
    label: item.label || "",
    status: item.status || "UNKNOWN",
    evidencePath: item.evidencePath || "",
    detail: item.detail || "",
    rows: {
      total: item.rows?.total ?? 0,
      pass: item.rows?.pass ?? 0,
      fail: item.rows?.fail ?? 0,
      blocked: item.rows?.blocked ?? 0,
      nt: item.rows?.nt ?? 0,
      invalid: item.rows?.invalid ?? 0,
      allRowsExecuted: item.rows?.allRowsExecuted === true,
      allRowsPass: item.rows?.allRowsPass === true,
      anyRealRowsFilled: item.rows?.anyRealRowsFilled === true
    },
    gates: Object.fromEntries(Object.entries(item.gates || {}).map(([key, gate]) => [key, {
      label: gate?.label || key,
      pass: gate?.pass === true
    }])),
    claimAllowed: item.claimAllowed === true
  }));
}

function buildConsoleSummary(readiness, { outPath, markdownPath }) {
  const lines = [
    "next_major_readiness_ok",
    `Status file: ${readiness.statusPath}`,
    `Readiness status: ${readiness.readinessStatus}`,
    `Can claim next-major pre-release ready: ${readiness.canClaimNextMajorPreReleaseReady ? "YES" : "NO"}`,
    `KO claimable: ${readiness.sourceKoStatus.canClaimKo ? "YES" : "NO"}`
  ];
  if (outPath) lines.push(`Readiness JSON: ${outPath}`);
  if (markdownPath) lines.push(`Readiness Markdown: ${markdownPath}`);
  lines.push("", "Blocking requirements:");
  if (readiness.blockingRequirements.length) {
    for (const item of readiness.blockingRequirements) {
      lines.push(`- ${item.id}: ${item.status} - ${item.detail || "TBD"}`);
    }
  } else {
    lines.push("- none");
  }
  lines.push("", "Boundary:");
  lines.push(`- ${readiness.claimBoundary}`);
  for (const item of readiness.blockedOrNotExecuted) {
    lines.push(`- ${item}`);
  }
  return `${lines.join("\n")}\n`;
}

function buildNextMajorReadinessMarkdown(readiness) {
  const lines = [
    "# Next Major Readiness Packet",
    "",
    `Readiness status: ${markdownInline(readiness.readinessStatus)}`,
    `Can claim next-major pre-release ready: ${readiness.canClaimNextMajorPreReleaseReady ? "true" : "false"}`,
    `Release action authorized: ${readiness.releaseActionAuthorized ? "true" : "false"}`,
    `KO claimable: ${readiness.sourceKoStatus.canClaimKo ? "true" : "false"}`,
    `Evidence tier: ${markdownInline(readiness.evidenceTier)}`,
    `Status file: ${markdownInline(readiness.statusPath)}`,
    "",
    "## Requirements",
    ""
  ];
  for (const requirement of readiness.requirements) {
    lines.push(`- ${markdownInline(requirement.id)}: ${markdownInline(requirement.status)} - ${markdownInline(requirement.detail || "TBD")} ${requirement.evidencePath ? `(evidence: ${markdownInline(requirement.evidencePath)})` : ""}`.trim());
  }
  lines.push("", "## Platform QA Status", "");
  if (readiness.platformQaStatus.length) {
    for (const platform of readiness.platformQaStatus) {
      lines.push(
        `### ${markdownInline(platform.label || platform.id)}`,
        "",
        `- ID: ${markdownInline(platform.id)}`,
        `- Status: ${markdownInline(platform.status)} - ${markdownInline(platform.detail || "TBD")}`,
        `- Evidence path: ${markdownInline(platform.evidencePath || "TBD")}`,
        `- Rows: total ${platform.rows.total}; PASS ${platform.rows.pass}; FAIL ${platform.rows.fail}; BLOCKED ${platform.rows.blocked}; NT ${platform.rows.nt}; invalid ${platform.rows.invalid}`,
        `- Claim allowed: ${platform.claimAllowed ? "true" : "false"}`,
        ""
      );
    }
  } else {
    lines.push("- none");
  }
  lines.push(
    "## Next Commands",
    "",
    "```bash",
    readiness.nextCommands.refreshReadiness,
    readiness.nextCommands.sourceApprovalRequest,
    readiness.nextCommands.approvedSourceCandidate,
    readiness.nextCommands.privacyTemplate,
    readiness.nextCommands.privacyReview,
    readiness.nextCommands.platformHandoff,
    readiness.nextCommands.finalKoGate,
    readiness.nextCommands.finalKoGateWithExplicitPlatformReceipts,
    "```",
    "",
    "## Boundary",
    "",
    markdownInline(readiness.claimBoundary),
    ""
  );
  if (readiness.blockedOrNotExecuted.length) {
    for (const item of readiness.blockedOrNotExecuted) {
      lines.push(`- ${markdownInline(item)}`);
    }
  } else {
    lines.push("- none");
  }
  return `${lines.join("\n")}\n`;
}

async function writePrivateFile(path, content) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await chmod(path, 0o600).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
  await writeFile(path, content, { mode: 0o600 });
  await chmod(path, 0o600);
}

function markdownInline(value) {
  const text = String(value ?? "TBD").replace(/\s+/g, " ").trim() || "TBD";
  return text
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHelp() {
  return `Build a non-claiming next-major readiness packet from the current KO status.

Usage:
  npm run next:readiness -- --refresh --out .codex-tmp/next-major-readiness/current.json --markdown-out .codex-tmp/next-major-readiness/current.md

This command may refresh the KO status with --allow-missing. It does not run
external-source validation, privacy review, platform QA, build, package,
deployment, Mew-Test, main-site, or remote acceptance checks.`;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}
