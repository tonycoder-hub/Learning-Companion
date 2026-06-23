#!/usr/bin/env node
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { readCurrentRevision } from "./lib/git-revision.mjs";

const args = parseArgs(process.argv.slice(2));
const statusPath = args.status || ".codex-tmp/ko-evidence/current-status.json";
const sourceApprovalRequestPath = args["source-approval-request"] || ".codex-tmp/external-source-validation/source-approval-request.json";
const execFileAsync = promisify(execFile);
const PATH_ARGS = ["status", "source-approval-request", "external", "bilingual", "agent-loop", "mac-manual", "windows-static", "harmony-device"];

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
const currentRevision = sourceApprovalRequestState.request ? await readCurrentRevision() : null;
const sourceApprovalFreshness = sourceApprovalRequestState.request
  ? await assessSourceApprovalFreshness(sourceApprovalRequestState.request, currentRevision)
  : null;
console.log(buildSummary(status, statusPath, {
  sourceApprovalRequest: sourceApprovalRequestState.request,
  sourceApprovalRequestPath,
  sourceApprovalRequestWarning: sourceApprovalRequestState.warning,
  sourceApprovalFreshness
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

function buildSummary(status, statusPath, { sourceApprovalRequest, sourceApprovalRequestPath, sourceApprovalRequestWarning, sourceApprovalFreshness }) {
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

async function assessSourceApprovalFreshness(sourceApprovalRequest, currentRevision) {
  if (!sourceApprovalRequest) {
    return {
      status: "MISSING_SOURCE_APPROVAL_REQUEST",
      currentGitHead: currentRevision?.gitHead || "TBD",
      basisGitHead: "",
      problems: ["No source approval request exists."]
    };
  }
  const basis = sourceApprovalRequest.basis || {};
  if (basis.type !== "PUBLIC_SOURCE_DRY_RUN_RECEIPT") {
    const problems = ["Source approval request has no public dry-run receipt basis; regenerate it from a current clean public dry-run before using the candidate command."];
    if (!currentRevision?.gitHead) {
      problems.push("Current gitHead is unavailable.");
    }
    if (currentRevision?.dirtyWorktree !== false) {
      problems.push("Current worktree is dirty; regenerate the public dry-run after committing or stashing local changes.");
    }
    return {
      status: "STALE_OR_DIRTY_PUBLIC_DRY_RUN",
      currentGitHead: currentRevision?.gitHead || "TBD",
      basisGitHead: "",
      basisReceiptPath: basis.inputPath || "",
      problems
    };
  }
  const prior = basis.priorDryRun || {};
  const basisReceiptPath = basis.priorDryRunReceipt || basis.inputPath || "";
  const problems = [];
  problems.push(...await validatePublicDryRunReceiptBasis(basisReceiptPath, sourceApprovalRequest, prior));
  if (!prior.gitHead) {
    problems.push("Prior public dry-run gitHead is missing.");
  } else if (!currentRevision?.gitHead) {
    problems.push("Current gitHead is unavailable.");
  } else if (prior.gitHead !== currentRevision.gitHead) {
    problems.push(`Prior public dry-run gitHead ${prior.gitHead} does not match current HEAD ${currentRevision.gitHead}.`);
  }
  if (prior.dirtyWorktree !== false) {
    problems.push("Prior public dry-run was captured with a dirty worktree.");
  }
  if (currentRevision?.dirtyWorktree !== false) {
    problems.push("Current worktree is dirty; regenerate the public dry-run after committing or stashing local changes.");
  }
  if (prior.profileRetained === true) {
    problems.push("Prior public dry-run retained its browser profile.");
  }
  if (prior.profileRetained !== false) {
    problems.push("Prior public dry-run did not prove browser profileRetained is false.");
  }
  if (prior.profileCleanupOk !== true) {
    problems.push("Prior public dry-run profile cleanup was not proven.");
  }
  problems.push(...validateApprovedCandidateCommand(sourceApprovalRequest));
  return {
    status: problems.length ? "STALE_OR_DIRTY_PUBLIC_DRY_RUN" : "CURRENT_CLEAN_PUBLIC_DRY_RUN",
    currentGitHead: currentRevision?.gitHead || "TBD",
    currentDirtyWorktree: currentRevision?.dirtyWorktree,
    basisGitHead: prior.gitHead || "",
    basisDirtyWorktree: prior.dirtyWorktree === true,
    basisProfileCleanupOk: prior.profileCleanupOk === true,
    basisProfileRetained: prior.profileRetained === true,
    basisReceiptPath,
    problems
  };
}

async function validatePublicDryRunReceiptBasis(receiptPath, sourceApprovalRequest, prior) {
  const problems = [];
  if (!receiptPath) {
    return ["Prior public dry-run receipt path is missing."];
  }
  if (!existsSync(receiptPath)) {
    return [`Prior public dry-run receipt does not exist: ${receiptPath}.`];
  }
  let receipt;
  try {
    receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  } catch (error) {
    return [`Prior public dry-run receipt is unreadable JSON: ${error.message}`];
  }
  if (receipt.schema !== "learning-companion.external-source-validation-browser.v1") {
    problems.push(`Prior public dry-run receipt schema mismatch: ${receipt.schema || "missing"}.`);
  }
  if (receipt.evidenceTier !== "PUBLIC_SOURCE_DRY_RUN" || receipt.publicSourceDryRun !== true || receipt.canClaimExternalKo !== false) {
    problems.push("Prior public dry-run receipt must be a non-claiming PUBLIC_SOURCE_DRY_RUN artifact.");
  }
  const appRevision = receipt.runContext?.appRevision || {};
  if (appRevision.gitHead !== prior.gitHead) {
    problems.push(`Prior public dry-run receipt gitHead ${appRevision.gitHead || "TBD"} does not match approval request basis ${prior.gitHead || "TBD"}.`);
  }
  if (appRevision.dirtyWorktree !== prior.dirtyWorktree) {
    problems.push(`Prior public dry-run receipt dirtyWorktree ${formatMaybeBoolean(appRevision.dirtyWorktree)} does not match approval request basis ${formatMaybeBoolean(prior.dirtyWorktree)}.`);
  }
  const browser = receipt.runContext?.browser || {};
  if (browser.profileRetained !== prior.profileRetained) {
    problems.push(`Prior public dry-run receipt profileRetained ${formatMaybeBoolean(browser.profileRetained)} does not match approval request basis ${formatMaybeBoolean(prior.profileRetained)}.`);
  }
  if (browser.profileRetained !== false || prior.profileRetained !== false) {
    problems.push("Prior public dry-run receipt must prove throwaway profileRetained is false.");
  }
  if (browser.profileCleanup?.ok !== prior.profileCleanupOk) {
    problems.push(`Prior public dry-run receipt profileCleanup.ok ${formatMaybeBoolean(browser.profileCleanup?.ok)} does not match approval request basis ${formatMaybeBoolean(prior.profileCleanupOk)}.`);
  }
  const runs = Array.isArray(receipt.runs) ? receipt.runs : [];
  const readingRun = runs.find((run) => run.source?.type === "reading");
  const videoRun = runs.find((run) => run.source?.type === "video");
  if (readingRun?.source?.url !== sourceApprovalRequest.sources?.reading?.url) {
    problems.push(`Prior public dry-run receipt reading URL ${readingRun?.source?.url || "TBD"} does not match approval request reading URL ${sourceApprovalRequest.sources?.reading?.url || "TBD"}.`);
  }
  if (videoRun?.source?.url !== sourceApprovalRequest.sources?.video?.url) {
    problems.push(`Prior public dry-run receipt video URL ${videoRun?.source?.url || "TBD"} does not match approval request video URL ${sourceApprovalRequest.sources?.video?.url || "TBD"}.`);
  }
  if (videoRun?.videoTools?.bookmarkTimestamp !== sourceApprovalRequest.sources?.video?.timestamp) {
    problems.push(`Prior public dry-run receipt video timestamp ${videoRun?.videoTools?.bookmarkTimestamp || "TBD"} does not match approval request video timestamp ${sourceApprovalRequest.sources?.video?.timestamp || "TBD"}.`);
  }
  return problems;
}

function formatMaybeBoolean(value) {
  return value === true || value === false ? String(value) : "TBD";
}

function validateApprovedCandidateCommand(sourceApprovalRequest) {
  const actual = String(sourceApprovalRequest.nextCommands?.approvedCandidateAfterCurrentTurnApproval || "").trim();
  const expected = buildApprovedCandidateCommand(sourceApprovalRequest);
  if (!actual) {
    return ["Approved candidate command is missing from source approval request."];
  }
  if (actual !== expected) {
    return ["Approved candidate command does not match receipt-validated sources, timestamp, and approval text."];
  }
  return [];
}

function buildApprovedCandidateCommand(sourceApprovalRequest) {
  return [
    "npm run external:validate -- --approved-current-turn",
    "--reading-url",
    shellQuote(sourceApprovalRequest.sources?.reading?.url || ""),
    "--video-url",
    shellQuote(sourceApprovalRequest.sources?.video?.url || ""),
    "--video-timestamp",
    shellQuote(sourceApprovalRequest.sources?.video?.timestamp || ""),
    "--approval-note",
    shellQuote(sourceApprovalRequest.requestedApprovalText || "")
  ].join(" ");
}

function buildFreshSourceCommands(sourceApprovalRequest) {
  const readingUrl = sourceApprovalRequest.sources?.reading?.url || "<approved-reading-url>";
  const videoUrl = sourceApprovalRequest.sources?.video?.url || "<approved-video-url>";
  const videoTimestamp = sourceApprovalRequest.sources?.video?.timestamp || "<captured-timestamp>";
  return {
    refreshPublicDryRun: `npm run external:validate:public-dry-run -- --reading-url ${shellQuote(readingUrl)} --video-url ${shellQuote(videoUrl)} --video-timestamp ${shellQuote(videoTimestamp)} --dry-run-note ${shellQuote("Refresh public source preflight for current clean HEAD before approval request.")}`,
    refreshedApprovalRequest: "npm run external:approval-request -- --dry-run-receipt <fresh-public-dry-run-receipt.json> --out .codex-tmp/external-source-validation/source-approval-request.json --markdown-out .codex-tmp/external-source-validation/source-approval-request.md",
    approvedCandidateAfterCurrentTurnApproval: "npm run external:validate -- --approved-current-turn --reading-url <approved-reading-url> --video-url <approved-video-url> --video-timestamp <captured-timestamp> --approval-note \"<current-turn approval from refreshed request>\"",
    privacyTemplate: "npm run external:privacy-template -- --receipt <candidate-receipt.json> --out <privacy-review.json>",
    privacyReview: "npm run external:privacy-review -- --receipt <candidate-receipt.json> --review <privacy-review.json> --out <ko-evidence-review.json>"
  };
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function buildHelp() {
  return `Print the next concrete actions for the Learning Companion KO gate.

Usage:
  npm run ko:next
  npm run ko:next -- --refresh
  node scripts/ko-next-action-summary.mjs --status .codex-tmp/ko-evidence/current-status.json
  node scripts/ko-next-action-summary.mjs --source-approval-request .codex-tmp/external-source-validation/source-approval-request.json

The summary explains:
- which KO requirements already pass,
- which evidence is still missing,
- what approved reading/video learning-material URLs are needed or already staged for current-turn approval,
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
