#!/usr/bin/env node
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { readCurrentRevision } from "./lib/git-revision.mjs";
import { CURRENT_CLEAN_KO_STATUS, assessKoStatusFreshness } from "./lib/ko-status-freshness.mjs";

const execFileAsync = promisify(execFile);

const READINESS_SCHEMA = "learning-companion.next-major-readiness.v1";
const STATUS_PATH = ".codex-tmp/ko-evidence/current-status.json";
const SOURCE_APPROVAL_REQUEST_PATH = ".codex-tmp/external-source-validation/source-approval-request.json";
const SOURCE_APPROVAL_MARKDOWN_PATH = ".codex-tmp/external-source-validation/source-approval-request.md";
const DEFAULT_MAC_MANUAL_PATH = ".codex-tmp/mac-manual-qa/real-run-receipt.json";
const DEFAULT_WINDOWS_STATIC_PATH = ".codex-tmp/windows-static-qa/real-run-receipt.json";
const DEFAULT_HARMONY_DEVICE_PATH = ".codex-tmp/harmony-device-qa/real-run-receipt.json";
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
for (const key of [
  "status",
  "out",
  "markdown-out",
  "source-approval-request",
  "source-approval-markdown",
  "external",
  "mac-manual",
  "windows-static",
  "harmony-device"
]) {
  if (args[key] === true) throw new Error(`--${key} requires a file path.`);
}

const statusPath = String(args.status || STATUS_PATH);
const sourceApprovalRequestPath = String(args["source-approval-request"] || SOURCE_APPROVAL_REQUEST_PATH);
const sourceApprovalMarkdownPath = String(args["source-approval-markdown"] || SOURCE_APPROVAL_MARKDOWN_PATH);
const externalEvidencePath = args.external ? String(args.external) : "";
const platformReceiptPaths = {
  macManual: String(args["mac-manual"] || DEFAULT_MAC_MANUAL_PATH),
  windowsStatic: String(args["windows-static"] || DEFAULT_WINDOWS_STATIC_PATH),
  harmonyDevice: String(args["harmony-device"] || DEFAULT_HARMONY_DEVICE_PATH)
};
if (args.refresh) {
  await refreshKoStatus(statusPath);
}
const readiness = await buildNextMajorReadiness(statusPath, {
  sourceApprovalRequestPath,
  sourceApprovalMarkdownPath,
  externalEvidencePath,
  platformReceiptPaths
});
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

async function buildNextMajorReadiness(statusPath, {
  sourceApprovalRequestPath,
  sourceApprovalMarkdownPath,
  externalEvidencePath,
  platformReceiptPaths
}) {
  if (!existsSync(statusPath)) {
    throw new Error(`Missing KO status file: ${statusPath}. Run: npm run next:readiness -- --refresh --out .codex-tmp/next-major-readiness/current.json`);
  }
  const status = JSON.parse(await readFile(statusPath, "utf8"));
  if (status.schema !== KO_STATUS_SCHEMA) {
    throw new Error(`KO status schema mismatch: ${status.schema || "missing"}`);
  }
  const currentRevision = await readCurrentRevision();
  const koStatusFreshness = assessKoStatusFreshness(status, currentRevision);
  const requirements = normalizeRequirements(status.requirements);
  assertRequiredRequirements(requirements);
  const platformQaStatus = normalizePlatformStatuses(status.platformQaStatus);
  const blockingRequirements = requirements.filter((item) => item.status !== "PASS");
  if (koStatusFreshness.status !== CURRENT_CLEAN_KO_STATUS) {
    blockingRequirements.push({
      id: "koStatusFreshness",
      status: "FAIL",
      evidencePath: statusPath,
      detail: "KO status must be regenerated from the current clean git HEAD before next-major readiness can be claimed."
    });
  }
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
    currentRevision,
    koStatusFreshness,
    sourceKoStatus: {
      schema: status.schema || "UNKNOWN",
      evidenceTier: status.evidenceTier || "UNKNOWN",
      canClaimKo: status.canClaimKo === true
    },
    requirements,
    blockingRequirements,
    platformQaStatus,
    nextCommands: {
      refreshReadiness: buildRefreshReadinessCommand({
        sourceApprovalRequestPath,
        sourceApprovalMarkdownPath,
        externalEvidencePath,
        platformReceiptPaths
      }),
      sourceApprovalRequest: buildSourceApprovalRequestCommand({ sourceApprovalRequestPath, sourceApprovalMarkdownPath }),
      approvedSourceCandidate: buildApprovedSourceCandidateCommand(sourceApprovalRequestPath),
      privacyTemplate: "npm run external:privacy-template -- --receipt <candidate-receipt.json> --out <privacy-review.json>",
      privacyReview: "npm run external:privacy-review -- --receipt <candidate-receipt.json> --review <privacy-review.json> --out <ko-evidence-review.json>",
      platformHandoff: buildPlatformHandoffCommand({
        statusPath,
        platformReceiptPaths
      }),
      finalizeNextMajor: buildFinalizeNextMajorCommand({
        externalEvidencePath,
        sourceApprovalRequestPath,
        sourceApprovalMarkdownPath,
        platformReceiptPaths
      }),
      finalKoGate: buildFinalKoGateCommand({
        externalEvidencePath
      }),
      finalKoGateWithExplicitPlatformReceipts: buildFinalKoGateCommand({
        externalEvidencePath,
        platformReceiptPaths
      })
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

function buildRefreshReadinessCommand({
  sourceApprovalRequestPath,
  sourceApprovalMarkdownPath,
  externalEvidencePath,
  platformReceiptPaths
}) {
  const parts = [
    "npm run next:readiness -- --refresh",
    "--out",
    ".codex-tmp/next-major-readiness/current.json",
    "--markdown-out",
    ".codex-tmp/next-major-readiness/current.md"
  ];
  if (sourceApprovalRequestPath !== SOURCE_APPROVAL_REQUEST_PATH) {
    parts.push("--source-approval-request", shellQuote(sourceApprovalRequestPath));
  }
  if (sourceApprovalMarkdownPath !== SOURCE_APPROVAL_MARKDOWN_PATH) {
    parts.push("--source-approval-markdown", shellQuote(sourceApprovalMarkdownPath));
  }
  if (externalEvidencePath) {
    parts.push("--external", shellQuote(externalEvidencePath));
  }
  const platformArgs = formatPlatformReceiptArgs(platformReceiptPaths, { includeDefaults: false });
  if (platformArgs) parts.push(platformArgs);
  return parts.join(" ");
}

function buildSourceApprovalRequestCommand({ sourceApprovalRequestPath, sourceApprovalMarkdownPath }) {
  return [
    "npm run external:approval-request -- --intake-handoff",
    ".codex-tmp/external-source-validation/source-intake-handoff.json",
    "--out",
    shellQuote(sourceApprovalRequestPath),
    "--markdown-out",
    shellQuote(sourceApprovalMarkdownPath)
  ].join(" ");
}

function buildApprovedSourceCandidateCommand(sourceApprovalRequestPath) {
  return [
    "npm run external:validate -- --approved-current-turn",
    "--reading-url <approved-reading-url>",
    "--video-url <approved-video-url>",
    "--video-timestamp <captured-timestamp>",
    "--source-approval-request",
    shellQuote(sourceApprovalRequestPath),
    '--approval-note "<current-turn approval>"'
  ].join(" ");
}

function buildPlatformHandoffCommand({ statusPath, platformReceiptPaths }) {
  const parts = [
    "npm run platform:qa-handoff --"
  ];
  if (statusPath !== STATUS_PATH) {
    parts.push("--status", shellQuote(statusPath));
  }
  parts.push(
    "--out",
    ".codex-tmp/platform-qa-handoff/current.json",
    "--markdown-out",
    ".codex-tmp/platform-qa-handoff/current.md"
  );
  const platformArgs = formatPlatformReceiptArgs(platformReceiptPaths, { includeDefaults: false });
  if (platformArgs) parts.push(platformArgs);
  return parts.join(" ");
}

function buildFinalizeNextMajorCommand({
  externalEvidencePath,
  sourceApprovalRequestPath,
  sourceApprovalMarkdownPath,
  platformReceiptPaths
}) {
  const parts = [
    "npm run next:finalize -- --external",
    formatExternalEvidenceArg(externalEvidencePath)
  ];
  if (sourceApprovalRequestPath !== SOURCE_APPROVAL_REQUEST_PATH) {
    parts.push("--source-approval-request", shellQuote(sourceApprovalRequestPath));
  }
  if (sourceApprovalMarkdownPath !== SOURCE_APPROVAL_MARKDOWN_PATH) {
    parts.push("--source-approval-markdown", shellQuote(sourceApprovalMarkdownPath));
  }
  const platformArgs = formatPlatformReceiptArgs(platformReceiptPaths, { includeDefaults: false });
  if (platformArgs) parts.push(platformArgs);
  return parts.join(" ");
}

function buildFinalKoGateCommand({ externalEvidencePath, platformReceiptPaths = null }) {
  const parts = [
    "npm run ko:validate -- --external",
    formatExternalEvidenceArg(externalEvidencePath)
  ];
  const platformArgs = platformReceiptPaths
    ? formatPlatformReceiptArgs(platformReceiptPaths, { includeDefaults: true })
    : "";
  if (platformArgs) parts.push(platformArgs);
  parts.push("--out", ".codex-tmp/ko-evidence/final.json");
  return parts.join(" ");
}

function formatExternalEvidenceArg(externalEvidencePath) {
  return externalEvidencePath ? shellQuote(externalEvidencePath) : "<ko-evidence-review.json>";
}

function formatPlatformReceiptArgs(platformReceiptPaths, { includeDefaults }) {
  const macManual = platformReceiptPaths?.macManual || DEFAULT_MAC_MANUAL_PATH;
  const windowsStatic = platformReceiptPaths?.windowsStatic || DEFAULT_WINDOWS_STATIC_PATH;
  const harmonyDevice = platformReceiptPaths?.harmonyDevice || DEFAULT_HARMONY_DEVICE_PATH;
  const hasCustomReceipt = macManual !== DEFAULT_MAC_MANUAL_PATH
    || windowsStatic !== DEFAULT_WINDOWS_STATIC_PATH
    || harmonyDevice !== DEFAULT_HARMONY_DEVICE_PATH;
  if (!includeDefaults && !hasCustomReceipt) return "";
  return [
    "--mac-manual",
    shellQuote(macManual),
    "--windows-static",
    shellQuote(windowsStatic),
    "--harmony-device",
    shellQuote(harmonyDevice)
  ].join(" ");
}

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(text)) return text;
  return `'${text.replace(/'/g, "'\\''")}'`;
}

function buildConsoleSummary(readiness, { outPath, markdownPath }) {
  const lines = [
    "next_major_readiness_ok",
    `Status file: ${readiness.statusPath}`,
    `Readiness status: ${readiness.readinessStatus}`,
    `Can claim next-major pre-release ready: ${readiness.canClaimNextMajorPreReleaseReady ? "YES" : "NO"}`,
    `KO claimable: ${readiness.sourceKoStatus.canClaimKo ? "YES" : "NO"}`,
    `KO status freshness: ${readiness.koStatusFreshness.status}`
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
    `Current git HEAD: ${markdownInline(readiness.currentRevision.gitHead || "TBD")}`,
    `Current worktree dirty: ${markdownInline(String(readiness.currentRevision.dirtyWorktree))}`,
    `KO status freshness: ${markdownInline(readiness.koStatusFreshness.status)}`,
    "",
    "## Requirements",
    ""
  ];
  for (const requirement of readiness.requirements) {
    lines.push(`- ${markdownInline(requirement.id)}: ${markdownInline(requirement.status)} - ${markdownInline(requirement.detail || "TBD")} ${requirement.evidencePath ? `(evidence: ${markdownInline(requirement.evidencePath)})` : ""}`.trim());
  }
  const freshnessProblems = readiness.koStatusFreshness.problems || [];
  if (freshnessProblems.length) {
    lines.push("", "## KO Status Freshness Problems", "");
    for (const problem of freshnessProblems) {
      lines.push(`- ${markdownInline(problem)}`);
    }
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
    readiness.nextCommands.finalizeNextMajor,
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

Optional source approval path binding:
  --source-approval-request <path> --source-approval-markdown <path>

Optional final gate path binding:
  --external <ko-evidence-review.json>
  --mac-manual <receipt.json> --windows-static <receipt.json> --harmony-device <receipt.json>

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
