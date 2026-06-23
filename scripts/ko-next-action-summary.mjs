#!/usr/bin/env node
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { readCurrentRevision } from "./lib/git-revision.mjs";
import {
  assessSourceApprovalFreshness,
  buildApprovedCandidateCommand,
  buildFreshSourceCommands
} from "./lib/source-approval-freshness.mjs";

const args = parseArgs(process.argv.slice(2));
const statusPath = args.status || ".codex-tmp/ko-evidence/current-status.json";
const sourceApprovalRequestPath = args["source-approval-request"] || ".codex-tmp/external-source-validation/source-approval-request.json";
const operatorPath = args.operator || ".codex-tmp/next-major-operator/current.json";
const execFileAsync = promisify(execFile);
const PATH_ARGS = ["status", "source-approval-request", "operator", "external", "bilingual", "agent-loop", "mac-manual", "windows-static", "harmony-device"];
const CURRENT_CLEAN_OPERATOR_PACKET = "CURRENT_CLEAN_OPERATOR_PACKET";
const STALE_OR_DIRTY_OPERATOR_PACKET = "STALE_OR_DIRTY_OPERATOR_PACKET";

if (args.help) {
  console.log(buildHelp());
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
console.log(buildSummary(status, statusPath, {
  sourceApprovalRequest: sourceApprovalRequestState.request,
  sourceApprovalRequestPath,
  sourceApprovalRequestWarning: sourceApprovalRequestState.warning,
  sourceApprovalFreshness,
  operatorPacket: operatorState.packet,
  operatorPath,
  operatorFreshness,
  operatorWarning: operatorState.warning
}));

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
    problems.push("Current worktree is dirty; regenerate operator packet after committing or stashing local changes.");
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

function buildSummary(status, statusPath, { sourceApprovalRequest, sourceApprovalRequestPath, sourceApprovalRequestWarning, sourceApprovalFreshness, operatorPacket, operatorPath, operatorFreshness, operatorWarning }) {
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
    ...formatSourceInputCommands(sourceApprovalRequest, sourceApprovalFreshness),
    "",
    "Platform QA still required:",
    "- Generate the non-claiming platform QA handoff: npm run platform:qa-handoff -- --out .codex-tmp/platform-qa-handoff/current.json --markdown-out .codex-tmp/platform-qa-handoff/current.md",
    "- Real-run platform receipts are auto-selected by ko:next/ko:validate when present: .codex-tmp/mac-manual-qa/real-run-receipt.json, .codex-tmp/windows-static-qa/real-run-receipt.json, .codex-tmp/harmony-device-qa/real-run-receipt.json.",
    ...formatPlatformList(platformPending),
    "",
    "Operator critical path:",
    ...formatOperatorCriticalPath(operatorPacket, operatorPath, operatorFreshness, operatorWarning),
    "",
    "Final gate after all evidence exists:",
    "- npm run ko:validate -- --external <ko-evidence-review.json> --out .codex-tmp/ko-evidence/final.json",
    "- Explicit platform override if needed: npm run ko:validate -- --external <ko-evidence-review.json> --mac-manual .codex-tmp/mac-manual-qa/real-run-receipt.json --windows-static .codex-tmp/windows-static-qa/real-run-receipt.json --harmony-device .codex-tmp/harmony-device-qa/real-run-receipt.json --out .codex-tmp/ko-evidence/final.json",
    "- Consolidated readiness packet: npm run next:readiness -- --refresh --out .codex-tmp/next-major-readiness/current.json --markdown-out .codex-tmp/next-major-readiness/current.md",
    "- Single operator packet for all remaining gates: npm run next:operator -- --refresh --out .codex-tmp/next-major-operator/current.json --markdown-out .codex-tmp/next-major-operator/current.md",
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
    `- Current git HEAD: ${freshness?.currentGitHead || "TBD"}`
  ];
  if (freshness?.status === STALE_OR_DIRTY_OPERATOR_PACKET) {
    lines.push(
      "- Refresh operator packet command: npm run next:operator -- --refresh --out .codex-tmp/next-major-operator/current.json --markdown-out .codex-tmp/next-major-operator/current.md"
    );
  }
  if (freshness?.currentDirtyWorktree === true) {
    lines.push("- Refresh prerequisite: commit, stash, or discard current worktree changes before regenerating the operator packet.");
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

function formatSourceInputCommands(request, sourceApprovalFreshness) {
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
    "- Generate an approval request packet: npm run external:approval-request -- --intake-handoff .codex-tmp/external-source-validation/source-intake-handoff.json --out .codex-tmp/external-source-validation/source-approval-request.json --markdown-out .codex-tmp/external-source-validation/source-approval-request.md",
    "- Approved candidate command: npm run external:validate -- --approved-current-turn --reading-url <approved-reading-url> --video-url <approved-video-url> --video-timestamp <captured-timestamp> --approval-note \"<current-turn approval>\"",
    "- Privacy review template: npm run external:privacy-template -- --receipt <candidate-receipt.json> --out <privacy-review.json>",
    "- Privacy review validation: npm run external:privacy-review -- --receipt <candidate-receipt.json> --review <privacy-review.json> --out <ko-evidence-review.json>"
  ];
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
  node scripts/ko-next-action-summary.mjs --operator .codex-tmp/next-major-operator/current.json

The summary explains:
- which KO requirements already pass,
- which evidence is still missing,
- what approved reading/video learning-material URLs are needed or already staged for current-turn approval,
- the current operator critical path when available,
- which privacy-review and final KO commands to run next.`;
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
