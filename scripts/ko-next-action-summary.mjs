#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { readCurrentRevision } from "./lib/git-revision.mjs";
import {
  assessSourceApprovalFreshness,
  buildApprovedCandidateCommand,
  buildFreshSourceCommands
} from "./lib/source-approval-freshness.mjs";

const args = parseArgs(process.argv.slice(2));
const statusPath = args.status || ".codex-tmp/ko-evidence/current-status.json";
const NEXT_ACTION_SCHEMA = "learning-companion.ko-next-action-summary.v1";
const DEFAULT_SOURCE_APPROVAL_REQUEST_PATH = ".codex-tmp/external-source-validation/source-approval-request.json";
const DEFAULT_SOURCE_APPROVAL_MARKDOWN_PATH = ".codex-tmp/external-source-validation/source-approval-request.md";
const DEFAULT_MAC_MANUAL_PATH = ".codex-tmp/mac-manual-qa/real-run-receipt.json";
const DEFAULT_WINDOWS_STATIC_PATH = ".codex-tmp/windows-static-qa/real-run-receipt.json";
const DEFAULT_HARMONY_DEVICE_PATH = ".codex-tmp/harmony-device-qa/real-run-receipt.json";
const sourceApprovalRequestPath = args["source-approval-request"] || DEFAULT_SOURCE_APPROVAL_REQUEST_PATH;
const sourceApprovalMarkdownPath = args["source-approval-markdown"]
  || (sourceApprovalRequestPath === DEFAULT_SOURCE_APPROVAL_REQUEST_PATH ? DEFAULT_SOURCE_APPROVAL_MARKDOWN_PATH : markdownSiblingPath(sourceApprovalRequestPath));
const cliExternalPath = args.external || "";
const platformReceiptPaths = {
  macManual: args["mac-manual"] || DEFAULT_MAC_MANUAL_PATH,
  windowsStatic: args["windows-static"] || DEFAULT_WINDOWS_STATIC_PATH,
  harmonyDevice: args["harmony-device"] || DEFAULT_HARMONY_DEVICE_PATH
};
const operatorPath = args.operator || ".codex-tmp/next-major-operator/current.json";
const execFileAsync = promisify(execFile);
const PATH_ARGS = ["status", "source-approval-request", "source-approval-markdown", "operator", "external", "bilingual", "agent-loop", "mac-manual", "windows-static", "harmony-device", "json-out"];
const CURRENT_CLEAN_OPERATOR_PACKET = "CURRENT_CLEAN_OPERATOR_PACKET";
const STALE_OR_DIRTY_OPERATOR_PACKET = "STALE_OR_DIRTY_OPERATOR_PACKET";
const CURRENT_CLEAN_PLATFORM_QA_HANDOFF = "CURRENT_CLEAN_PLATFORM_QA_HANDOFF";
const CURRENT_CLEAN_NEXT_MAJOR_READINESS = "CURRENT_CLEAN_NEXT_MAJOR_READINESS";

if (args.help) {
  console.log(buildHelp());
  process.exit(0);
}
if (args["self-test"]) {
  runSelfTest();
  process.exit(0);
}

PATH_ARGS.forEach((key) => {
  if (args[key] === true) {
    throw new Error(`--${key} requires a file path.`);
  }
});

if (args.refresh) {
  await refreshKoStatus(statusPath, args);
}

if (!existsSync(statusPath)) {
  throw new Error(`Missing KO status file: ${statusPath}. Run: npm run ko:next -- --refresh --status ${statusPath}`);
}

const status = JSON.parse(await readFile(statusPath, "utf8"));
const sourceApprovalRequestState = await readSourceApprovalRequest(sourceApprovalRequestPath, Boolean(args["source-approval-request"]));
const operatorState = await readOperatorPacket(operatorPath, Boolean(args.operator));
const currentRevision = sourceApprovalRequestState.request || operatorState.packet ? await readCurrentRevision() : null;
const sourceApprovalFreshness = sourceApprovalRequestState.request
  ? await assessSourceApprovalFreshness(sourceApprovalRequestState.request, currentRevision)
  : null;
const operatorFreshness = operatorState.packet
  ? assessOperatorPacketFreshness(operatorState.packet, currentRevision)
  : null;
const summaryContext = {
  sourceApprovalRequest: sourceApprovalRequestState.request,
  sourceApprovalRequestPath,
  sourceApprovalMarkdownPath,
  sourceApprovalRequestWarning: sourceApprovalRequestState.warning,
  sourceApprovalFreshness,
  operatorPacket: operatorState.packet,
  operatorPath,
  operatorFreshness,
  operatorWarning: operatorState.warning,
  platformReceiptPaths,
  cliExternalPath
};
if (args["json-out"]) {
  await writePrivateFile(resolve(String(args["json-out"])), `${JSON.stringify(buildNextActionArtifact(status, statusPath, summaryContext), null, 2)}\n`);
}
console.log(buildSummary(status, statusPath, summaryContext));

async function refreshKoStatus(outPath, parsedArgs) {
  const refreshArgs = ["scripts/validate-ko-evidence.mjs", "--allow-missing", "--out", outPath];
  [
    ["external", "external"],
    ["bilingual", "bilingual"],
    ["agent-loop", "agent-loop"],
    ["mac-manual", "mac-manual"],
    ["windows-static", "windows-static"],
    ["harmony-device", "harmony-device"]
  ].forEach(([sourceKey, targetKey]) => {
    const value = parsedArgs[sourceKey];
    if (value) {
      refreshArgs.push(`--${targetKey}`, value);
    }
  });
  try {
    await execFileAsync(process.execPath, refreshArgs, {
      cwd: process.cwd(),
      timeout: 30000,
      maxBuffer: 1024 * 1024
    });
  } catch (error) {
    const stderr = String(error.stderr || error.message || "").trim();
    throw new Error(`Failed to refresh KO status: ${stderr || "unknown error"}`);
  }
}

async function readOperatorPacket(path, required) {
  if (!existsSync(path)) {
    if (required) throw new Error(`Missing operator packet JSON: ${path}`);
    return { packet: null, warning: "" };
  }
  try {
    const packet = JSON.parse(await readFile(path, "utf8"));
    validateOperatorPacket(packet);
    return { packet, warning: "" };
  } catch (error) {
    if (required) throw error;
    return {
      packet: null,
      warning: `Ignored invalid default operator packet at ${path}: ${error.message}`
    };
  }
}

function validateOperatorPacket(packet) {
  if (packet.schema !== "learning-companion.next-major-operator-packet.v1") {
    throw new Error(`Operator packet schema mismatch: ${packet.schema || "missing"}`);
  }
  if (packet.evidenceTier !== "NEXT_MAJOR_OPERATOR_PACKET_ONLY" || packet.canClaimNextMajorFromThisPacket !== false || packet.releaseActionAuthorized !== false) {
    throw new Error("Operator packet must be a non-claiming NEXT_MAJOR_OPERATOR_PACKET_ONLY artifact.");
  }
  if (!Array.isArray(packet.nextActionSequence) || !packet.nextActionSequence.length) {
    throw new Error("Operator packet missing nextActionSequence.");
  }
  for (const step of packet.nextActionSequence) {
    requireOperatorStepField(step.order, "order");
    requireOperatorStepField(step.id, "id");
    requireOperatorStepField(step.operatorState, "operatorState");
    requireOperatorStepField(step.action, "action");
    requireOperatorStepField(step.claimBoundary, "claimBoundary");
  }
}

function requireOperatorStepField(value, fieldName) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`Operator packet nextActionSequence step missing required ${fieldName}.`);
  return text;
}

function assessOperatorPacketFreshness(packet, currentRevision = {}) {
  const packetRevision = packet.currentRevision || {};
  const problems = [];
  if (packetRevision.gitAvailable !== true) {
    problems.push("Operator packet did not prove git revision availability.");
  }
  if (!packetRevision.gitHead) {
    problems.push("Operator packet gitHead is missing.");
  } else if (!currentRevision?.gitHead) {
    problems.push("Current gitHead is unavailable.");
  } else if (packetRevision.gitHead !== currentRevision.gitHead) {
    problems.push(`Operator packet gitHead ${packetRevision.gitHead} does not match current HEAD ${currentRevision.gitHead}.`);
  }
  if (packetRevision.dirtyWorktree !== false) {
    problems.push("Operator packet was not generated from a clean worktree.");
  }
  if (currentRevision?.gitAvailable !== true) {
    problems.push("Current git revision is unavailable.");
  }
  if (currentRevision?.dirtyWorktree !== false) {
    problems.push("Current worktree is dirty; resolve current worktree changes under current-turn authorization, then regenerate the operator packet. Do not discard changes unless explicitly asked.");
  }
  return {
    status: problems.length ? STALE_OR_DIRTY_OPERATOR_PACKET : CURRENT_CLEAN_OPERATOR_PACKET,
    currentGitHead: currentRevision?.gitHead || "TBD",
    currentDirtyWorktree: currentRevision?.dirtyWorktree ?? "TBD",
    packetGitHead: packetRevision.gitHead || "TBD",
    packetDirtyWorktree: packetRevision.dirtyWorktree ?? "TBD",
    packetStatusLineCount: packetRevision.statusLineCount ?? "TBD",
    problems
  };
}

async function readSourceApprovalRequest(path, required) {
  if (!existsSync(path)) {
    if (required) throw new Error(`Missing source approval request file: ${path}`);
    return { request: null, warning: "" };
  }
  try {
    const request = JSON.parse(await readFile(path, "utf8"));
    validateSourceApprovalRequest(request);
    return { request, warning: "" };
  } catch (error) {
    if (required) throw error;
    return {
      request: null,
      warning: `Ignored invalid default source approval request at ${path}: ${error.message}`
    };
  }
}

function validateSourceApprovalRequest(request) {
  if (request.schema !== "learning-companion.external-source-approval-request.v1") {
    throw new Error(`Source approval request schema mismatch: ${request.schema || "missing"}`);
  }
  if (request.evidenceTier !== "SOURCE_APPROVAL_REQUEST_ONLY" || request.canClaimExternalKo !== false) {
    throw new Error("Source approval request must be a non-claiming SOURCE_APPROVAL_REQUEST_ONLY artifact.");
  }
  requireSourceApprovalField(request.sources?.reading?.url, "sources.reading.url");
  requireSourceApprovalField(request.sources?.video?.url, "sources.video.url");
  requireSourceApprovalField(request.sources?.video?.timestamp, "sources.video.timestamp");
  requireSourceApprovalField(request.requestedApprovalText, "requestedApprovalText");
  const approvedCandidateCommand = requireSourceApprovalField(request.nextCommands?.approvedCandidateAfterCurrentTurnApproval, "nextCommands.approvedCandidateAfterCurrentTurnApproval");
  requireSourceApprovalField(request.nextCommands?.privacyTemplate, "nextCommands.privacyTemplate");
  requireSourceApprovalField(request.nextCommands?.privacyReview, "nextCommands.privacyReview");
  if (/<[^>]+>/.test(approvedCandidateCommand)) {
    throw new Error("Source approval request approved candidate command still contains placeholder tokens.");
  }
}

function requireSourceApprovalField(value, fieldName) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`Source approval request missing required ${fieldName}.`);
  return text;
}

function buildSummary(status, statusPath, { sourceApprovalRequest, sourceApprovalRequestPath, sourceApprovalMarkdownPath, sourceApprovalRequestWarning, sourceApprovalFreshness, operatorPacket, operatorPath, operatorFreshness, operatorWarning, platformReceiptPaths, cliExternalPath }) {
  const requirements = Array.isArray(status.requirements) ? status.requirements : [];
  const platformQaStatus = Array.isArray(status.platformQaStatus) ? status.platformQaStatus : [];
  const pass = requirements.filter((item) => item.status === "PASS");
  const missing = requirements.filter((item) => item.status !== "PASS");
  const external = requirements.find((item) => item.id === "approvedExternalReadingVideo");
  const platformPending = platformQaStatus.filter((item) => item.status !== "PASSING_REAL_RUN");
  const lines = [
    "Learning Companion KO next actions",
    "",
    `Status file: ${statusPath}`,
    `KO claimable: ${status.canClaimKo === true ? "YES" : "NO"}`,
    `Evidence tier: ${status.evidenceTier || "UNKNOWN"}`,
    "",
    "Already proved:",
    ...formatRequirementList(pass, "PASS"),
    "",
    "Still missing:",
    ...formatRequirementList(missing, "MISSING"),
    "",
    "Next source evidence input:",
    ...formatSourceApprovalRequest(sourceApprovalRequest, sourceApprovalRequestPath, sourceApprovalRequestWarning, sourceApprovalFreshness),
    ...formatSourceInputCommands(sourceApprovalRequest, sourceApprovalFreshness, sourceApprovalRequestPath, sourceApprovalMarkdownPath),
    "",
    "Platform QA still required:",
    "- Generate the non-claiming platform QA handoff: npm run platform:qa-handoff -- --out .codex-tmp/platform-qa-handoff/current.json --markdown-out .codex-tmp/platform-qa-handoff/current.md",
    "- Real-run platform receipts are auto-selected by ko:next/ko:validate when present: .codex-tmp/mac-manual-qa/real-run-receipt.json, .codex-tmp/windows-static-qa/real-run-receipt.json, .codex-tmp/harmony-device-qa/real-run-receipt.json.",
    "- After real Mac QA is filled: npm run mac:manual:validate:real",
    "- After real Windows QA is filled: npm run windows:static:validate:real",
    "- After real HarmonyOS QA is filled: npm run harmony:device:validate:real",
    ...formatPlatformList(platformPending),
    "",
    "Operator critical path:",
    ...formatOperatorCriticalPath(operatorPacket, operatorPath, operatorFreshness, operatorWarning),
    "",
    "Final gate after all evidence exists:",
    ...formatFinalGateCommands({
      sourceApprovalRequestPath,
      sourceApprovalMarkdownPath,
      platformReceiptPaths,
      externalEvidencePath: cliExternalPath || external?.evidencePath || ""
    }),
    "",
    "Boundary:",
    "- Self-test and public dry-run evidence are useful checks, but they cannot fill approved external reading/video evidence rows.",
    "- Current KO remains blocked until approved external evidence plus Mac/Windows/HarmonyOS real QA all pass."
  ];
  if (external?.status === "PASS") {
    lines.splice(lines.indexOf("Next source evidence input:") + 1, 0, "- Approved external reading/video artifact is present in this status file.");
  }
  return `${lines.join("\n")}\n`;
}

function buildNextActionArtifact(status, statusPath, { sourceApprovalRequest, sourceApprovalRequestPath, sourceApprovalMarkdownPath, sourceApprovalRequestWarning, sourceApprovalFreshness, operatorPacket, operatorPath, operatorFreshness, operatorWarning, platformReceiptPaths, cliExternalPath }) {
  const requirements = Array.isArray(status.requirements) ? status.requirements : [];
  const passedRequirements = requirements.filter((item) => item.status === "PASS").map(formatRequirementArtifact);
  const missingRequirements = requirements.filter((item) => item.status !== "PASS").map(formatRequirementArtifact);
  return {
    schema: NEXT_ACTION_SCHEMA,
    generatedAt: new Date().toISOString(),
    evidenceTier: "KO_NEXT_ACTION_SUMMARY_ONLY",
    canClaimKoFromThisArtifact: false,
    releaseActionAuthorized: false,
    claimBoundary: "Next-action summary only. It does not grant source approval, run browser evidence, perform privacy review, run platform QA, build, package, deploy, run remote acceptance, or satisfy KO evidence.",
    statusPath,
    sourceKoStatus: {
      evidenceTier: status.evidenceTier || "UNKNOWN",
      canClaimKo: status.canClaimKo === true
    },
    requirements: {
      passed: passedRequirements,
      missing: missingRequirements
    },
    sourceApproval: buildSourceApprovalArtifact({
      request: sourceApprovalRequest,
      path: sourceApprovalRequestPath,
      markdownPath: sourceApprovalMarkdownPath,
      warning: sourceApprovalRequestWarning,
      freshness: sourceApprovalFreshness
    }),
    platform: {
      receiptPaths: platformReceiptPaths,
      pending: (Array.isArray(status.platformQaStatus) ? status.platformQaStatus : [])
        .filter((item) => item.status !== "PASSING_REAL_RUN")
        .map((item) => ({
          id: item.id || "UNKNOWN",
          status: item.status || "UNKNOWN",
          detail: item.detail || "",
          evidencePath: item.evidencePath || ""
        })),
      validationCommands: {
        macManual: "npm run mac:manual:validate:real",
        windowsStatic: "npm run windows:static:validate:real",
        harmonyDevice: "npm run harmony:device:validate:real"
      }
    },
    operator: buildOperatorArtifact({
      packet: operatorPacket,
      path: operatorPath,
      freshness: operatorFreshness,
      warning: operatorWarning
    }),
    finalGateCommands: buildFinalGateCommandSet({
      sourceApprovalRequestPath,
      sourceApprovalMarkdownPath,
      platformReceiptPaths,
      externalEvidencePath: cliExternalPath || requirements.find((item) => item.id === "approvedExternalReadingVideo")?.evidencePath || ""
    }),
    blockedOrNotExecuted: [
      "No current-turn source approval was granted by this summary.",
      "No approved-source browser capture or screenshot validation was run by this summary.",
      "No human privacy review was performed by this summary.",
      "No Mac, Windows, or HarmonyOS real platform QA was run by this summary.",
      "No build, package, deployment, Mew-Test, main-site, or remote acceptance check was run by this summary."
    ]
  };
}

function formatRequirementArtifact(item) {
  return {
    id: item.id || "UNKNOWN",
    status: item.status || "UNKNOWN",
    detail: item.detail || "",
    evidencePath: item.evidencePath || ""
  };
}

function buildSourceApprovalArtifact({ request, path, markdownPath, warning, freshness }) {
  if (!request) {
    return {
      available: false,
      path,
      markdownPath,
      warning: warning || "",
      requiredInputShape: "阅读：https://... / 视频：https://... / 时间：00:15",
      nextCommands: {
        showInputHelp: "npm run external:source-help",
        sourceIntake: "npm run external:source-intake -- --input \"阅读：https://... 视频：https://... 时间：00:15\"",
        approvalRequest: `npm run external:approval-request -- --intake-handoff .codex-tmp/external-source-validation/source-intake-handoff.json --out ${shellQuote(path)} --markdown-out ${shellQuote(markdownPath)}`,
        approvalCheck: `npm run external:approval-check -- --source-approval-request ${shellQuote(path)} --approval-note "<current-turn approval>" --out .codex-tmp/external-source-validation/source-approval-check.json`,
        approvedCandidateAfterCurrentTurnApproval: `npm run external:validate -- --approved-current-turn --reading-url <approved-reading-url> --video-url <approved-video-url> --video-timestamp <captured-timestamp> --source-approval-request ${shellQuote(path)} --approval-note "<current-turn approval>"`,
        privacyTemplate: "npm run external:privacy-template -- --receipt <candidate-receipt.json> --out <privacy-review.json>",
        privacyReview: "npm run external:privacy-review -- --receipt <candidate-receipt.json> --review <privacy-review.json> --out <ko-evidence-review.json>"
      },
      claimBoundary: "Source input and approval-request packets do not create approved external KO evidence."
    };
  }
  const base = {
    available: true,
    path,
    markdownPath,
    readingUrl: request.sources?.reading?.url || "TBD",
    readingTitle: request.sources?.reading?.title || "TBD",
    videoUrl: request.sources?.video?.url || "TBD",
    videoTitle: request.sources?.video?.title || "TBD",
    videoTimestamp: request.sources?.video?.timestamp || "TBD",
    freshness: freshness || { status: "TBD", problems: [] },
    requestedApprovalText: request.requestedApprovalText || "TBD",
    claimBoundary: "This approval request does not grant source approval, launch approved evidence, or satisfy privacy-reviewed KO evidence."
  };
  if (freshness?.status === "STALE_OR_DIRTY_PUBLIC_DRY_RUN") {
    const freshCommands = buildFreshSourceCommands(request);
    return {
      ...base,
      nextCommands: {
        refreshPublicDryRun: freshCommands.refreshPublicDryRun,
        refreshedApprovalRequest: freshCommands.refreshedApprovalRequest,
        approvalCheck: freshCommands.approvalCheck,
        approvedCandidateAfterCurrentTurnApproval: freshCommands.approvedCandidateAfterCurrentTurnApproval,
        privacyTemplate: freshCommands.privacyTemplate,
        privacyReview: freshCommands.privacyReview
      }
    };
  }
  return {
    ...base,
    nextCommands: {
      approvalCheck: request.nextCommands?.approvalCheck || buildApprovalCheckCommandFromRequest(path, request),
      approvedCandidateAfterCurrentTurnApproval: buildApprovedCandidateCommand(request),
      privacyTemplate: request.nextCommands?.privacyTemplate || "TBD",
      privacyReview: request.nextCommands?.privacyReview || "TBD"
    }
  };
}

function buildOperatorArtifact({ packet, path, freshness, warning }) {
  if (!packet) {
    return {
      available: false,
      path,
      warning: warning || "",
      freshness: freshness || null,
      nextActionSequence: [],
      claimBoundary: "Missing or invalid operator packets do not satisfy KO evidence."
    };
  }
  return {
    available: true,
    path,
    evidenceTier: packet.evidenceTier || "UNKNOWN",
    canClaimNextMajorFromThisPacket: packet.canClaimNextMajorFromThisPacket === true,
    releaseActionAuthorized: packet.releaseActionAuthorized === true,
    freshness: freshness || null,
    readinessFreshness: packet.readinessFreshness || null,
    platformHandoffFreshness: packet.platformHandoffFreshness || null,
    lanes: (Array.isArray(packet.lanes) ? packet.lanes : []).map((lane) => ({
      id: lane.id || "UNKNOWN",
      label: lane.label || lane.id || "UNKNOWN",
      operatorState: lane.operatorState || "UNKNOWN",
      currentKoStatus: normalizeLaneCurrentKoStatus(lane)
    })),
    nextActionSequence: (Array.isArray(packet.nextActionSequence) ? packet.nextActionSequence : []).map((step) => ({
      order: step.order,
      id: step.id || "UNKNOWN",
      laneId: step.laneId || "UNKNOWN",
      operatorState: step.operatorState || "UNKNOWN",
      action: step.action || "",
      command: step.command || "",
      produces: step.produces || "",
      claimBoundary: step.claimBoundary || ""
    }))
  };
}

function normalizeLaneCurrentKoStatus(lane = {}) {
  if (lane.currentKoStatus) return lane.currentKoStatus;
  return {
    status: lane.operatorState || "UNKNOWN",
    detail: lane.id === "finalKoGate"
      ? "Final KO gate has no single requirement row; it waits until approved external evidence and all real platform QA receipts pass."
      : "No direct KO requirement row is attached to this operator lane.",
    evidencePath: ""
  };
}

function formatOperatorCriticalPath(packet, path, freshness, warning) {
  if (!packet) {
    const lines = [
      `- Current operator packet: ${path}`,
      "- Operator critical path unavailable; generate it with: npm run next:operator -- --refresh --out .codex-tmp/next-major-operator/current.json --markdown-out .codex-tmp/next-major-operator/current.md",
      "- Missing or invalid operator packets do not satisfy KO evidence."
    ];
    if (warning) lines.unshift(`- ${warning}`);
    return lines;
  }
  const lines = [
    `- Current operator packet: ${path}`,
    `- Evidence tier: ${packet.evidenceTier || "UNKNOWN"}; can claim next-major: ${packet.canClaimNextMajorFromThisPacket === true ? "YES" : "NO"}; release authorized: ${packet.releaseActionAuthorized === true ? "YES" : "NO"}`,
    `- Current operator packet freshness: ${freshness?.status || "TBD"}`,
    `- Operator packet git HEAD: ${freshness?.packetGitHead || "TBD"}`,
    `- Current git HEAD: ${freshness?.currentGitHead || "TBD"}`,
    ...formatOperatorReadinessFreshness(packet.readinessFreshness),
    ...formatOperatorPlatformHandoffFreshness(packet.platformHandoffFreshness)
  ];
  if (freshness?.status === STALE_OR_DIRTY_OPERATOR_PACKET) {
    lines.push(
      "- Refresh operator packet command: npm run next:operator -- --refresh --out .codex-tmp/next-major-operator/current.json --markdown-out .codex-tmp/next-major-operator/current.md"
    );
  }
  if (freshness?.currentDirtyWorktree === true) {
    lines.push("- Refresh prerequisite: resolve current worktree changes under current-turn authorization before regenerating the operator packet; do not discard changes unless explicitly asked.");
  }
  if (Array.isArray(freshness?.problems)) {
    for (const problem of freshness.problems) lines.push(`- Operator packet freshness problem: ${problem}`);
  }
  for (const step of packet.nextActionSequence) {
    lines.push(`- ${step.order}. ${step.id}: ${step.operatorState} - ${step.action}`);
  }
  lines.push("- This operator packet still does not grant approval, run QA, perform privacy review, build, package, deploy, remote-accept, or satisfy KO evidence.");
  return lines;
}

function formatOperatorReadinessFreshness(freshness) {
  if (!freshness) {
    return [
      "- Operator readiness freshness: TBD",
      "- Missing readiness freshness does not satisfy final KO evidence."
    ];
  }
  const lines = [
    `- Operator readiness freshness: ${freshness.status || "TBD"}`,
    `- Readiness packet git HEAD: ${freshness.basisGitHead || "TBD"}`,
    `- Readiness packet current git HEAD: ${freshness.currentGitHead || "TBD"}`
  ];
  if (freshness.status !== CURRENT_CLEAN_NEXT_MAJOR_READINESS) {
    lines.push(
      "- Refresh readiness packet command: npm run next:readiness -- --refresh --out .codex-tmp/next-major-readiness/current.json --markdown-out .codex-tmp/next-major-readiness/current.md"
    );
  }
  if (freshness.currentDirtyWorktree === true) {
    lines.push("- Readiness refresh prerequisite: resolve current worktree changes under current-turn authorization; do not discard changes unless explicitly asked.");
  }
  if (Array.isArray(freshness.problems)) {
    for (const problem of freshness.problems) lines.push(`- Readiness freshness problem: ${problem}`);
  }
  return lines;
}

function formatOperatorPlatformHandoffFreshness(freshness) {
  if (!freshness) {
    return [
      "- Operator platform handoff freshness: TBD",
      "- Missing platform handoff freshness does not satisfy platform QA evidence."
    ];
  }
  const lines = [
    `- Operator platform handoff freshness: ${freshness.status || "TBD"}`,
    `- Platform handoff git HEAD: ${freshness.basisGitHead || "TBD"}`,
    `- Platform handoff current git HEAD: ${freshness.currentGitHead || "TBD"}`
  ];
  if (freshness.status !== CURRENT_CLEAN_PLATFORM_QA_HANDOFF) {
    lines.push(
      "- Refresh platform handoff command: npm run platform:qa-handoff -- --status .codex-tmp/ko-evidence/current-status.json --out .codex-tmp/platform-qa-handoff/current.json --markdown-out .codex-tmp/platform-qa-handoff/current.md"
    );
  }
  if (freshness.currentDirtyWorktree === true) {
    lines.push("- Platform handoff refresh prerequisite: resolve current worktree changes under current-turn authorization; do not discard changes unless explicitly asked.");
  }
  if (Array.isArray(freshness.problems)) {
    for (const problem of freshness.problems) lines.push(`- Platform handoff freshness problem: ${problem}`);
  }
  return lines;
}

function formatSourceApprovalRequest(request, path, warning, sourceApprovalFreshness) {
  if (!request) {
    const lines = [
      "- URL here means a public learning-material link, not a repo, build, deployment, localhost, or private/internal page.",
      "- 中文：URL 就是网页链接；这里要的是公开学习材料链接，不是仓库、部署地址、本机地址或内部页面。",
      "- You can send it as: 阅读：https://... / 视频：https://... / 时间：00:15",
      "- Needed: one approved reading material URL, one approved video material URL, and the video timestamp to capture, e.g. 00:15."
    ];
    if (warning) lines.unshift(`- ${warning}`);
    return lines;
  }
  const freshness = request.approvalFreshness || {};
  const nextCommands = request.nextCommands || {};
  const currentFreshness = sourceApprovalFreshness || { status: "TBD", problems: [] };
  const lines = [
    `- Current approval request: ${path}`,
    `- Reading URL: ${request.sources?.reading?.url || "TBD"}`,
    `- Reading title: ${request.sources?.reading?.title || "TBD"}`,
    `- Video URL: ${request.sources?.video?.url || "TBD"}`,
    `- Video title: ${request.sources?.video?.title || "TBD"}`,
    `- Video timestamp: ${request.sources?.video?.timestamp || "TBD"}`,
    `- Approval request basis: ${freshness.status || "TBD"}; required operator freshness: ${freshness.requiredOperatorFreshness || "TBD"}`,
    `- Current approval request freshness: ${currentFreshness.status || "TBD"}`,
    `- Current git HEAD: ${currentFreshness.currentGitHead || "TBD"}`,
    `- Basis public dry-run git HEAD: ${currentFreshness.basisGitHead || "TBD"}`,
    `- Basis public dry-run receipt: ${currentFreshness.basisReceiptPath || "TBD"}`,
    ...formatFreshnessProblems(currentFreshness.problems)
  ];
  if (currentFreshness.status === "STALE_OR_DIRTY_PUBLIC_DRY_RUN") {
    const freshCommands = buildFreshSourceCommands(request);
    lines.push(
      "- Do not run the prior approved candidate command until this request is refreshed against the current clean HEAD.",
      `- Refresh public dry-run command: ${freshCommands.refreshPublicDryRun}`,
      `- Regenerate approval request command: ${freshCommands.refreshedApprovalRequest}`,
      `- Approval pre-check command after refreshed current-turn approval: ${freshCommands.approvalCheck}`,
      `- Approved candidate command after refreshed current-turn approval: ${freshCommands.approvedCandidateAfterCurrentTurnApproval}`,
      `- Privacy template command: ${freshCommands.privacyTemplate}`,
      `- Privacy review validation command: ${freshCommands.privacyReview}`,
      "- This approval request still does not grant source approval, launch approved evidence, or satisfy privacy-reviewed KO evidence."
    );
    return lines;
  }
  return [
    ...lines,
    `- Approval text to copy exactly: ${request.requestedApprovalText || "TBD"}`,
    `- Approval pre-check command after exact current-turn approval: ${nextCommands.approvalCheck || buildApprovalCheckCommandFromRequest(path, request)}`,
    `- Approved candidate command after exact current-turn approval: ${buildApprovedCandidateCommand(request)}`,
    `- Privacy template command: ${nextCommands.privacyTemplate || "TBD"}`,
    `- Privacy review validation command: ${nextCommands.privacyReview || "TBD"}`,
    "- This approval request still does not grant source approval, launch approved evidence, or satisfy privacy-reviewed KO evidence."
  ];
}

function formatFreshnessProblems(problems) {
  if (!Array.isArray(problems) || !problems.length) return [];
  return problems.map((problem) => `- Freshness problem: ${problem}`);
}

function formatSourceInputCommands(request, sourceApprovalFreshness, path, markdownPath = markdownSiblingPath(path)) {
  if (request && sourceApprovalFreshness?.status === "STALE_OR_DIRTY_PUBLIC_DRY_RUN") {
    return [
      "- To replace these sources instead of refreshing them, regenerate source intake and approval request before asking for current-turn approval."
    ];
  }
  if (request) {
    return [
      "- To replace these sources, regenerate source intake and approval request before asking for current-turn approval."
    ];
  }
  return [
    "- Show input help: npm run external:source-help",
    "- Validate pasted input before running browser evidence: npm run external:source-intake -- --input \"阅读：https://... 视频：https://... 时间：00:15\"",
    `- Generate an approval request packet: npm run external:approval-request -- --intake-handoff .codex-tmp/external-source-validation/source-intake-handoff.json --out ${shellQuote(path)} --markdown-out ${shellQuote(markdownPath)}`,
    `- Approval pre-check command: npm run external:approval-check -- --source-approval-request ${shellQuote(path)} --approval-note "<current-turn approval>" --out .codex-tmp/external-source-validation/source-approval-check.json`,
    `- Approved candidate command: npm run external:validate -- --approved-current-turn --reading-url <approved-reading-url> --video-url <approved-video-url> --video-timestamp <captured-timestamp> --source-approval-request ${shellQuote(path)} --approval-note "<current-turn approval>"`,
    "- Privacy review template: npm run external:privacy-template -- --receipt <candidate-receipt.json> --out <privacy-review.json>",
    "- Privacy review validation: npm run external:privacy-review -- --receipt <candidate-receipt.json> --review <privacy-review.json> --out <ko-evidence-review.json>"
  ];
}

function buildApprovalCheckCommandFromRequest(path, request) {
  return [
    "npm run external:approval-check --",
    "--source-approval-request",
    shellQuote(path),
    "--approval-note",
    shellQuote(request?.requestedApprovalText || "<current-turn approval>"),
    "--out",
    ".codex-tmp/external-source-validation/source-approval-check.json"
  ].join(" ");
}

function formatFinalGateCommands({
  sourceApprovalRequestPath,
  sourceApprovalMarkdownPath,
  platformReceiptPaths,
  externalEvidencePath = ""
}) {
  const commands = buildFinalGateCommandSet({
    sourceApprovalRequestPath,
    sourceApprovalMarkdownPath,
    platformReceiptPaths,
    externalEvidencePath
  });
  return [
    `- Refresh local non-claiming evidence in safe order: ${commands.refreshLocalEvidence}`,
    `- One-command final refresh: ${commands.finalizeNextMajor}`,
    `- ${commands.finalKoGate}`,
    `- Explicit platform override if needed: ${commands.finalKoGateWithExplicitPlatformReceipts}`,
    `- Consolidated readiness packet: ${commands.refreshReadiness}`,
    `- Single operator packet for all remaining gates: ${commands.refreshOperator}`
  ];
}

function buildFinalGateCommandSet({
  sourceApprovalRequestPath,
  sourceApprovalMarkdownPath,
  platformReceiptPaths,
  externalEvidencePath = ""
}) {
  const externalArg = externalEvidencePath ? shellQuote(externalEvidencePath) : "<ko-evidence-review.json>";
  const hasSourceOverride = sourceApprovalRequestPath !== DEFAULT_SOURCE_APPROVAL_REQUEST_PATH
    || sourceApprovalMarkdownPath !== DEFAULT_SOURCE_APPROVAL_MARKDOWN_PATH;
  const sourceArgs = !hasSourceOverride
    ? ""
    : ` --source-approval-request ${shellQuote(sourceApprovalRequestPath)} --source-approval-markdown ${shellQuote(sourceApprovalMarkdownPath)}`;
  const platformArgs = buildPlatformReceiptArgs(platformReceiptPaths);
  const externalCommandArgs = externalEvidencePath ? ` --external ${externalArg}` : "";
  return {
    refreshLocalEvidence: "npm run next:local-evidence",
    finalizeNextMajor: `npm run next:finalize -- --external ${externalArg}${sourceArgs}${platformArgs.finalize}`,
    finalKoGate: `npm run ko:validate -- --external ${externalArg}${platformArgs.validate} --out .codex-tmp/ko-evidence/final.json`,
    finalKoGateWithExplicitPlatformReceipts: `npm run ko:validate -- --external ${externalArg}${platformArgs.explicit} --out .codex-tmp/ko-evidence/final.json`,
    refreshReadiness: `npm run next:readiness -- --refresh --out .codex-tmp/next-major-readiness/current.json --markdown-out .codex-tmp/next-major-readiness/current.md${sourceArgs}${externalCommandArgs}${platformArgs.finalize}`,
    refreshOperator: `npm run next:operator -- --refresh --out .codex-tmp/next-major-operator/current.json --markdown-out .codex-tmp/next-major-operator/current.md${sourceArgs}${externalCommandArgs}${platformArgs.finalize}`
  };
}

function buildPlatformReceiptArgs(paths = {}) {
  const macManual = paths.macManual || DEFAULT_MAC_MANUAL_PATH;
  const windowsStatic = paths.windowsStatic || DEFAULT_WINDOWS_STATIC_PATH;
  const harmonyDevice = paths.harmonyDevice || DEFAULT_HARMONY_DEVICE_PATH;
  const explicit = ` --mac-manual ${shellQuote(macManual)} --windows-static ${shellQuote(windowsStatic)} --harmony-device ${shellQuote(harmonyDevice)}`;
  const usesDefaults = macManual === DEFAULT_MAC_MANUAL_PATH
    && windowsStatic === DEFAULT_WINDOWS_STATIC_PATH
    && harmonyDevice === DEFAULT_HARMONY_DEVICE_PATH;
  return {
    finalize: usesDefaults ? "" : explicit,
    validate: usesDefaults ? "" : explicit,
    explicit
  };
}

function markdownSiblingPath(jsonPath) {
  const text = String(jsonPath);
  return text.endsWith(".json") ? `${text.slice(0, -5)}.md` : `${text}.md`;
}

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(text)) return text;
  return `'${text.replace(/'/g, "'\\''")}'`;
}

function runSelfTest() {
  const artifact = buildNextActionArtifact({
    evidenceTier: "KO_MISSING_EVIDENCE",
    canClaimKo: false,
    requirements: [],
    platformQaStatus: []
  }, ".codex-tmp/ko-evidence/current-status.json", {
    sourceApprovalRequest: null,
    sourceApprovalRequestPath: DEFAULT_SOURCE_APPROVAL_REQUEST_PATH,
    sourceApprovalMarkdownPath: DEFAULT_SOURCE_APPROVAL_MARKDOWN_PATH,
    sourceApprovalRequestWarning: "",
    sourceApprovalFreshness: null,
    operatorPacket: {
      evidenceTier: "NEXT_MAJOR_OPERATOR_PACKET_ONLY",
      canClaimNextMajorFromThisPacket: false,
      releaseActionAuthorized: false,
      lanes: [
        {
          id: "approvedExternalReadingVideo",
          label: "Approved external reading/video evidence",
          operatorState: "NEEDS_CURRENT_TURN_APPROVAL",
          currentKoStatus: {
            status: "MISSING",
            detail: "Requires external KO evidence.",
            evidencePath: ""
          }
        },
        {
          id: "customDiagnosticLane",
          label: "Custom diagnostic lane",
          operatorState: "WAITING_FOR_OPERATOR"
        },
        {
          id: "finalKoGate",
          label: "Final KO gate",
          operatorState: "BLOCKED_UNTIL_ALL_EVIDENCE_PASSES"
        }
      ],
      nextActionSequence: []
    },
    operatorPath: ".codex-tmp/next-major-operator/current.json",
    operatorFreshness: null,
    operatorWarning: "",
    platformReceiptPaths,
    cliExternalPath: ""
  });
  const sourceLane = artifact.operator.lanes.find((lane) => lane.id === "approvedExternalReadingVideo");
  assert.deepEqual(sourceLane.currentKoStatus, {
    status: "MISSING",
    detail: "Requires external KO evidence.",
    evidencePath: ""
  });
  const genericLane = artifact.operator.lanes.find((lane) => lane.id === "customDiagnosticLane");
  assert.equal(genericLane.currentKoStatus.status, "WAITING_FOR_OPERATOR");
  assert.match(genericLane.currentKoStatus.detail, /No direct KO requirement row/);
  const finalLane = artifact.operator.lanes.find((lane) => lane.id === "finalKoGate");
  assert.equal(finalLane.currentKoStatus.status, "BLOCKED_UNTIL_ALL_EVIDENCE_PASSES");
  assert.match(finalLane.currentKoStatus.detail, /waits until approved external evidence/);
  assert.equal(finalLane.currentKoStatus.evidencePath, "");
  console.log("ko_next_action_summary_selftest_ok");
}

async function writePrivateFile(path, content) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await chmod(path, 0o600).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  await writeFile(path, content, { mode: 0o600 });
  await chmod(path, 0o600);
}

function formatRequirementList(items, fallbackStatus) {
  if (!items.length) return [`- none (${fallbackStatus})`];
  return items.map((item) => `- ${item.id}: ${item.status || fallbackStatus}${item.detail ? ` - ${item.detail}` : ""}`);
}

function formatPlatformList(items) {
  if (!items.length) return ["- none"];
  return items.map((item) => `- ${item.id}: ${item.status || "UNKNOWN"}${item.detail ? ` - ${item.detail}` : ""}`);
}

function buildHelp() {
  return `Print the next concrete actions for the Learning Companion KO gate.

Usage:
  npm run ko:next
  npm run ko:next -- --refresh
  node scripts/ko-next-action-summary.mjs --status .codex-tmp/ko-evidence/current-status.json
  node scripts/ko-next-action-summary.mjs --source-approval-request .codex-tmp/external-source-validation/source-approval-request.json
  node scripts/ko-next-action-summary.mjs --source-approval-request .codex-tmp/external-source-validation/source-approval-request.json --source-approval-markdown .codex-tmp/external-source-validation/source-approval-request.md
  node scripts/ko-next-action-summary.mjs --operator .codex-tmp/next-major-operator/current.json
  node scripts/ko-next-action-summary.mjs --json-out .codex-tmp/ko-next/current.json

The summary explains:
- which KO requirements already pass,
- which evidence is still missing,
- what approved reading/video learning-material URLs are needed or already staged for current-turn approval,
- the current operator critical path when available,
- which privacy-review and final KO commands to run next.

With --json-out, the command writes a private 0600
learning-companion.ko-next-action-summary.v1 artifact for handoff tooling.`;
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
