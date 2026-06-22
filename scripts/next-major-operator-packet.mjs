#!/usr/bin/env node
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const OPERATOR_SCHEMA = "learning-companion.next-major-operator-packet.v1";
const STATUS_PATH = ".codex-tmp/ko-evidence/current-status.json";
const READINESS_PATH = ".codex-tmp/next-major-readiness/current.json";
const PLATFORM_HANDOFF_PATH = ".codex-tmp/platform-qa-handoff/current.json";
const SOURCE_APPROVAL_REQUEST_PATH = ".codex-tmp/external-source-validation/source-approval-request.json";
const PATH_ARGS = ["status", "readiness", "platform-handoff", "source-approval-request", "out", "markdown-out"];

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(buildHelp());
  process.exit(0);
}
for (const key of PATH_ARGS) {
  if (args[key] === true) throw new Error(`--${key} requires a file path.`);
}

const statusPath = String(args.status || STATUS_PATH);
const readinessPath = String(args.readiness || READINESS_PATH);
const platformHandoffPath = String(args["platform-handoff"] || PLATFORM_HANDOFF_PATH);
const sourceApprovalRequestPath = String(args["source-approval-request"] || SOURCE_APPROVAL_REQUEST_PATH);

if (args.refresh) {
  await refreshInputs({ statusPath, readinessPath, platformHandoffPath });
}

const packet = await buildOperatorPacket({
  statusPath,
  readinessPath,
  platformHandoffPath,
  sourceApprovalRequestPath
});

if (args.out) {
  await writePrivateFile(resolve(String(args.out)), `${JSON.stringify(packet, null, 2)}\n`);
}
if (args["markdown-out"]) {
  await writePrivateFile(resolve(String(args["markdown-out"])), buildOperatorMarkdown(packet));
}
console.log(buildConsoleSummary(packet, {
  outPath: args.out ? resolve(String(args.out)) : "",
  markdownPath: args["markdown-out"] ? resolve(String(args["markdown-out"])) : ""
}));

async function refreshInputs({ statusPath, readinessPath, platformHandoffPath }) {
  await runNodeScript(["scripts/validate-ko-evidence.mjs", "--allow-missing", "--out", statusPath], "KO status");
  await runNodeScript([
    "scripts/platform-qa-handoff.mjs",
    "--status",
    statusPath,
    "--out",
    platformHandoffPath
  ], "platform QA handoff");
  await runNodeScript([
    "scripts/next-major-readiness.mjs",
    "--status",
    statusPath,
    "--out",
    readinessPath
  ], "next-major readiness");
}

async function runNodeScript(argv, label) {
  try {
    await execFileAsync(process.execPath, argv, {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024
    });
  } catch (error) {
    const stderr = String(error.stderr || error.message || "").trim();
    throw new Error(`Failed to refresh ${label}: ${stderr || "unknown error"}`);
  }
}

async function buildOperatorPacket(paths) {
  const status = await readRequiredJson(paths.statusPath, "KO status");
  const readiness = await readRequiredJson(paths.readinessPath, "next-major readiness");
  const platformHandoff = await readRequiredJson(paths.platformHandoffPath, "platform QA handoff");
  const sourceApprovalRequest = await readOptionalJson(paths.sourceApprovalRequestPath);
  assertSchema(status, "learning-companion.ko-evidence-review.v1", "KO status");
  assertSchema(readiness, "learning-companion.next-major-readiness.v1", "next-major readiness");
  assertLiteral(readiness.evidenceTier, "NEXT_MAJOR_READINESS_SUMMARY_ONLY", "next-major readiness evidence tier");
  assertLiteral(readiness.releaseActionAuthorized, false, "next-major readiness releaseActionAuthorized");
  assertSchema(platformHandoff, "learning-companion.platform-qa-handoff.v1", "platform QA handoff");
  assertLiteral(platformHandoff.evidenceTier, "PLATFORM_QA_HANDOFF_ONLY", "platform QA handoff evidence tier");
  assertLiteral(platformHandoff.canClaimKo, false, "platform QA handoff canClaimKo");
  if (sourceApprovalRequest) {
    assertSchema(sourceApprovalRequest, "learning-companion.external-source-approval-request.v1", "source approval request");
    assertLiteral(sourceApprovalRequest.evidenceTier, "SOURCE_APPROVAL_REQUEST_ONLY", "source approval request evidence tier");
    assertLiteral(sourceApprovalRequest.canClaimExternalKo, false, "source approval request canClaimExternalKo");
  }

  const requirements = Array.isArray(status.requirements) ? status.requirements : [];
  const requirementById = new Map(requirements.map((item) => [item.id || "UNKNOWN", item]));
  const lanes = [
    buildExternalSourceLane(requirementById.get("approvedExternalReadingVideo"), sourceApprovalRequest, paths.sourceApprovalRequestPath),
    ...buildPlatformLanes(platformHandoff),
    buildFinalGateLane(readiness, platformHandoff)
  ];
  return {
    schema: OPERATOR_SCHEMA,
    generatedAt: new Date().toISOString(),
    evidenceTier: "NEXT_MAJOR_OPERATOR_PACKET_ONLY",
    canClaimNextMajorFromThisPacket: false,
    releaseActionAuthorized: false,
    claimBoundary: "Operator packet only. It consolidates already-generated readiness, source-approval, and platform handoff data; it does not grant approval, run QA, run browser evidence, perform privacy review, build, package, deploy, or run remote acceptance.",
    inputs: {
      statusPath: paths.statusPath,
      readinessPath: paths.readinessPath,
      platformHandoffPath: paths.platformHandoffPath,
      sourceApprovalRequestPath: paths.sourceApprovalRequestPath,
      sourceApprovalRequestAvailable: Boolean(sourceApprovalRequest)
    },
    sourceKoStatus: {
      evidenceTier: status.evidenceTier || "UNKNOWN",
      canClaimKo: status.canClaimKo === true
    },
    sourceReadiness: {
      evidenceTier: readiness.evidenceTier || "UNKNOWN",
      readinessStatus: readiness.readinessStatus || "UNKNOWN",
      canClaimNextMajorPreReleaseReady: readiness.canClaimNextMajorPreReleaseReady === true,
      releaseActionAuthorized: readiness.releaseActionAuthorized === true
    },
    lanes,
    operatorOrder: lanes.map((lane) => lane.id),
    blockedOrNotExecuted: [
      "No current-turn source approval was granted by this operator packet.",
      "No approved-source browser capture or screenshot validation was run by this operator packet.",
      "No human privacy review was performed by this operator packet.",
      "No Mac, Windows, or HarmonyOS real platform QA was run by this operator packet.",
      "No build, package, deployment, Mew-Test, main-site, or remote acceptance check was run by this operator packet."
    ]
  };
}

function buildExternalSourceLane(requirement = {}, sourceApprovalRequest, sourceApprovalRequestPath) {
  const hasApprovalRequest = Boolean(sourceApprovalRequest);
  return {
    id: "approvedExternalReadingVideo",
    label: "Approved external reading/video evidence",
    operatorState: hasApprovalRequest ? "NEEDS_CURRENT_TURN_APPROVAL" : "NEEDS_SOURCE_INPUT",
    currentKoStatus: {
      status: requirement.status || "UNKNOWN",
      detail: requirement.detail || "",
      evidencePath: requirement.evidencePath || ""
    },
    approvalRequest: hasApprovalRequest
      ? {
          path: sourceApprovalRequestPath,
          evidenceTier: sourceApprovalRequest.evidenceTier || "UNKNOWN",
          canClaimExternalKo: sourceApprovalRequest.canClaimExternalKo === true,
          readingUrl: sourceApprovalRequest.sources?.reading?.url || "",
          videoUrl: sourceApprovalRequest.sources?.video?.url || "",
          videoTimestamp: sourceApprovalRequest.sources?.video?.timestamp || "",
          requestedApprovalText: sourceApprovalRequest.requestedApprovalText || ""
        }
      : {
          path: sourceApprovalRequestPath,
          evidenceTier: "MISSING",
          canClaimExternalKo: false,
          readingUrl: "",
          videoUrl: "",
          videoTimestamp: "",
          requestedApprovalText: ""
        },
    nextCommands: hasApprovalRequest
      ? {
          approvedCandidateAfterCurrentTurnApproval: sourceApprovalRequest.nextCommands?.approvedCandidateAfterCurrentTurnApproval || "",
          privacyTemplate: sourceApprovalRequest.nextCommands?.privacyTemplate || "",
          privacyReview: sourceApprovalRequest.nextCommands?.privacyReview || ""
        }
      : {
          sourceIntake: "npm run external:source-intake -- --input \"阅读：https://... 视频：https://... 时间：00:15\" --out .codex-tmp/external-source-validation/source-intake-handoff.json",
          sourceApprovalRequest: "npm run external:approval-request -- --intake-handoff .codex-tmp/external-source-validation/source-intake-handoff.json --out .codex-tmp/external-source-validation/source-approval-request.json --markdown-out .codex-tmp/external-source-validation/source-approval-request.md",
          approvedCandidateAfterCurrentTurnApproval: "npm run external:validate -- --approved-current-turn --reading-url <approved-reading-url> --video-url <approved-video-url> --video-timestamp <captured-timestamp> --approval-note \"<current-turn approval>\"",
          privacyTemplate: "npm run external:privacy-template -- --receipt <candidate-receipt.json> --out <privacy-review.json>",
          privacyReview: "npm run external:privacy-review -- --receipt <candidate-receipt.json> --review <privacy-review.json> --out <ko-evidence-review.json>"
        },
    cannotBeFilledFrom: [
      "external-source self-tests",
      "public-source dry-runs without current-turn approval",
      "approval-request packets",
      "privacy templates without a completed human review"
    ]
  };
}

function buildPlatformLanes(platformHandoff) {
  return (Array.isArray(platformHandoff.platforms) ? platformHandoff.platforms : []).map((platform) => ({
    id: platform.id || "UNKNOWN",
    label: platform.label || platform.id || "UNKNOWN",
    operatorState: platform.currentKoStatus?.status === "PASSING_REAL_RUN" ? "READY_FOR_FINAL_KO_GATE" : "NEEDS_REAL_PLATFORM_RUN",
    currentKoStatus: {
      status: platform.currentKoStatus?.status || "UNKNOWN",
      detail: platform.currentKoStatus?.detail || "",
      evidencePath: platform.currentKoStatus?.evidencePath || ""
    },
    qaPath: platform.qaPath || "",
    receiptPath: platform.receiptPath || "",
    validateCommand: platform.validateCommand || "",
    expectedRows: platform.expectedRows || 0,
    currentRows: {
      total: platform.currentTemplateSummary?.rows || 0,
      pass: platform.currentTemplateSummary?.pass || 0,
      fail: platform.currentTemplateSummary?.fail || 0,
      blocked: platform.currentTemplateSummary?.blocked || 0,
      nt: platform.currentTemplateSummary?.nt || 0,
      invalid: platform.currentTemplateSummary?.invalid || 0,
      rowsNeedingConcreteNotes: platform.currentTemplateSummary?.rowsNeedingConcreteNotes || 0
    },
    requiredSessionFields: platform.currentTemplateSummary?.requiredSessionFields || [],
    nextRealRunSteps: platform.nextRealRunSteps || [],
    cannotBeFilledFrom: platform.cannotBeFilledFrom || []
  }));
}

function buildFinalGateLane(readiness, platformHandoff) {
  return {
    id: "finalKoGate",
    label: "Final KO gate",
    operatorState: readiness.canClaimNextMajorPreReleaseReady === true ? "READY_TO_VALIDATE_FINAL_KO" : "BLOCKED_UNTIL_ALL_EVIDENCE_PASSES",
    currentReadinessStatus: readiness.readinessStatus || "UNKNOWN",
    sourceReadinessCanClaim: readiness.canClaimNextMajorPreReleaseReady === true,
    releaseActionAuthorized: readiness.releaseActionAuthorized === true,
    nextCommands: {
      finalKoGate: platformHandoff.nextCommands?.finalKoGate || "npm run ko:validate -- --external <ko-evidence-review.json> --out .codex-tmp/ko-evidence/final.json",
      finalKoGateWithExplicitPlatformReceipts: platformHandoff.nextCommands?.finalKoGateWithExplicitPlatformReceipts || ""
    },
    cannotBeFilledFrom: [
      "readiness packets",
      "operator packets",
      "platform handoffs",
      "source approval requests",
      "self-test or dry-run artifacts"
    ]
  };
}

async function readRequiredJson(path, label) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${label} JSON: ${path}. Run npm run next:operator -- --refresh first.`);
  }
  return JSON.parse(await readFile(path, "utf8"));
}

async function readOptionalJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(await readFile(path, "utf8"));
}

function assertSchema(value, expected, label) {
  if (value.schema !== expected) {
    throw new Error(`${label} schema mismatch: ${value.schema || "missing"}`);
  }
}

function assertLiteral(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function buildConsoleSummary(packet, { outPath, markdownPath }) {
  const lines = [
    "next_major_operator_packet_ok",
    `Evidence tier: ${packet.evidenceTier}`,
    `Can claim next-major from this packet: ${packet.canClaimNextMajorFromThisPacket ? "YES" : "NO"}`,
    `Source readiness: ${packet.sourceReadiness.readinessStatus}`,
    `KO claimable: ${packet.sourceKoStatus.canClaimKo ? "YES" : "NO"}`
  ];
  if (outPath) lines.push(`Operator JSON: ${outPath}`);
  if (markdownPath) lines.push(`Operator Markdown: ${markdownPath}`);
  lines.push("", "Operator lanes:");
  for (const lane of packet.lanes) {
    const status = lane.currentKoStatus?.status || lane.currentReadinessStatus || "UNKNOWN";
    lines.push(`- ${lane.id}: ${lane.operatorState}; status ${status}`);
  }
  lines.push("", "Boundary:");
  lines.push(`- ${packet.claimBoundary}`);
  for (const item of packet.blockedOrNotExecuted) {
    lines.push(`- ${item}`);
  }
  return `${lines.join("\n")}\n`;
}

function buildOperatorMarkdown(packet) {
  const lines = [
    "# Next Major Operator Packet",
    "",
    `Evidence tier: ${markdownInline(packet.evidenceTier)}`,
    `Can claim next-major from this packet: ${packet.canClaimNextMajorFromThisPacket ? "true" : "false"}`,
    `Release action authorized: ${packet.releaseActionAuthorized ? "true" : "false"}`,
    `Source readiness: ${markdownInline(packet.sourceReadiness.readinessStatus)}`,
    `KO claimable: ${packet.sourceKoStatus.canClaimKo ? "true" : "false"}`,
    "",
    "## Inputs",
    ""
  ];
  for (const [key, value] of Object.entries(packet.inputs)) {
    lines.push(`- ${markdownInline(key)}: ${markdownInline(value)}`);
  }
  lines.push("", "## Operator Lanes", "");
  for (const lane of packet.lanes) {
    lines.push(
      `### ${markdownInline(lane.label)}`,
      "",
      `- ID: ${markdownInline(lane.id)}`,
      `- Operator state: ${markdownInline(lane.operatorState)}`
    );
    if (lane.currentKoStatus) {
      lines.push(`- Current KO status: ${markdownInline(lane.currentKoStatus.status)} - ${markdownInline(lane.currentKoStatus.detail || "TBD")}`);
    }
    if (lane.approvalRequest) {
      lines.push(
        `- Approval request path: ${markdownInline(lane.approvalRequest.path)}`,
        `- Reading URL: ${markdownInline(lane.approvalRequest.readingUrl || "TBD")}`,
        `- Video URL: ${markdownInline(lane.approvalRequest.videoUrl || "TBD")}`,
        `- Video timestamp: ${markdownInline(lane.approvalRequest.videoTimestamp || "TBD")}`,
        `- Approval text needed: ${markdownInline(lane.approvalRequest.requestedApprovalText || "TBD")}`
      );
    }
    if (lane.qaPath) {
      lines.push(
        `- QA template: ${markdownInline(lane.qaPath)}`,
        `- Receipt path: ${markdownInline(lane.receiptPath || "TBD")}`,
        `- Rows: total ${lane.currentRows.total}; PASS ${lane.currentRows.pass}; FAIL ${lane.currentRows.fail}; BLOCKED ${lane.currentRows.blocked}; NT ${lane.currentRows.nt}; invalid ${lane.currentRows.invalid}`,
        `- Rows needing concrete Notes: ${lane.currentRows.rowsNeedingConcreteNotes}`
      );
    }
    const commands = lane.nextCommands || {};
    if (lane.validateCommand) commands.validateCommand = lane.validateCommand;
    if (Object.keys(commands).length) {
      lines.push("", "Commands:", "", "```bash");
      for (const command of Object.values(commands).filter(Boolean)) {
        lines.push(command);
      }
      lines.push("```");
    }
    if (Array.isArray(lane.nextRealRunSteps) && lane.nextRealRunSteps.length) {
      lines.push("", "Real-run steps:", "");
      for (const step of lane.nextRealRunSteps) lines.push(`- ${markdownInline(step)}`);
    }
    if (Array.isArray(lane.cannotBeFilledFrom) && lane.cannotBeFilledFrom.length) {
      lines.push("", "Cannot be filled from:", "");
      for (const item of lane.cannotBeFilledFrom) lines.push(`- ${markdownInline(item)}`);
    }
    lines.push("");
  }
  lines.push("## Boundary", "", markdownInline(packet.claimBoundary), "");
  for (const item of packet.blockedOrNotExecuted) {
    lines.push(`- ${markdownInline(item)}`);
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
  return `Build a non-claiming operator packet for the remaining next-major gates.

Usage:
  npm run next:operator -- --refresh --out .codex-tmp/next-major-operator/current.json --markdown-out .codex-tmp/next-major-operator/current.md

This command may refresh local KO/readiness/platform handoff summaries. It does
not grant source approval, run approved-source browser evidence, perform privacy
review, run Mac/Windows/HarmonyOS QA, build, package, deploy, or run remote
acceptance checks.`;
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
