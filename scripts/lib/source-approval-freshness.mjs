import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

export const CURRENT_CLEAN_PUBLIC_DRY_RUN = "CURRENT_CLEAN_PUBLIC_DRY_RUN";
export const STALE_OR_DIRTY_PUBLIC_DRY_RUN = "STALE_OR_DIRTY_PUBLIC_DRY_RUN";
const DEFAULT_SOURCE_APPROVAL_REQUEST_PATH = ".codex-tmp/external-source-validation/source-approval-request.json";

export async function assessSourceApprovalFreshness(sourceApprovalRequest, currentRevision = {}) {
  const revision = currentRevision || {};
  if (!sourceApprovalRequest) {
    return {
      status: "MISSING_SOURCE_APPROVAL_REQUEST",
      currentGitHead: revision.gitHead || "TBD",
      basisGitHead: "",
      problems: ["No source approval request exists."]
    };
  }
  const basis = sourceApprovalRequest.basis || {};
  if (basis.type !== "PUBLIC_SOURCE_DRY_RUN_RECEIPT") {
    const problems = ["Source approval request has no public dry-run receipt basis; regenerate it from a current clean public dry-run before using the candidate command."];
    if (!revision.gitHead) {
      problems.push("Current gitHead is unavailable.");
    }
    if (revision.dirtyWorktree !== false) {
      problems.push("Current worktree is dirty; resolve current worktree changes under current-turn authorization, then regenerate the public dry-run. Do not discard changes unless explicitly asked.");
    }
    return {
      status: STALE_OR_DIRTY_PUBLIC_DRY_RUN,
      currentGitHead: revision.gitHead || "TBD",
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
  } else if (!revision.gitHead) {
    problems.push("Current gitHead is unavailable.");
  } else if (prior.gitHead !== revision.gitHead) {
    problems.push(`Prior public dry-run gitHead ${prior.gitHead} does not match current HEAD ${revision.gitHead}.`);
  }
  if (prior.dirtyWorktree !== false) {
    problems.push("Prior public dry-run was captured with a dirty worktree.");
  }
  if (revision.dirtyWorktree !== false) {
    problems.push("Current worktree is dirty; resolve current worktree changes under current-turn authorization, then regenerate the public dry-run. Do not discard changes unless explicitly asked.");
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
  problems.push(...validateRequestedApprovalText(sourceApprovalRequest));
  problems.push(...validateApprovedCandidateCommand(sourceApprovalRequest));
  return {
    status: problems.length ? STALE_OR_DIRTY_PUBLIC_DRY_RUN : CURRENT_CLEAN_PUBLIC_DRY_RUN,
    currentGitHead: revision.gitHead || "TBD",
    currentDirtyWorktree: revision.dirtyWorktree,
    basisGitHead: prior.gitHead || "",
    basisDirtyWorktree: prior.dirtyWorktree === true,
    basisProfileCleanupOk: prior.profileCleanupOk === true,
    basisProfileRetained: prior.profileRetained === true,
    basisReceiptPath,
    problems
  };
}

export function buildApprovedCandidateCommand(sourceApprovalRequest) {
  const parts = [
    "npm run external:validate -- --approved-current-turn",
    "--reading-url",
    shellQuote(sourceApprovalRequest.sources?.reading?.url || ""),
    "--video-url",
    shellQuote(sourceApprovalRequest.sources?.video?.url || ""),
    "--video-timestamp",
    shellQuote(sourceApprovalRequest.sources?.video?.timestamp || "")
  ];
  if (sourceApprovalRequest.approvalRequestPath) {
    parts.push("--source-approval-request", shellQuote(sourceApprovalRequest.approvalRequestPath));
  }
  parts.push("--approval-note", shellQuote(sourceApprovalRequest.requestedApprovalText || ""));
  return parts.join(" ");
}

export function buildFreshSourceCommands(sourceApprovalRequest) {
  const readingUrl = sourceApprovalRequest.sources?.reading?.url || "<approved-reading-url>";
  const videoUrl = sourceApprovalRequest.sources?.video?.url || "<approved-video-url>";
  const videoTimestamp = sourceApprovalRequest.sources?.video?.timestamp || "<captured-timestamp>";
  const approvalRequestPath = sourceApprovalRequest.approvalRequestPath || DEFAULT_SOURCE_APPROVAL_REQUEST_PATH;
  return {
    refreshPublicDryRun: `npm run external:validate:public-dry-run -- --reading-url ${shellQuote(readingUrl)} --video-url ${shellQuote(videoUrl)} --video-timestamp ${shellQuote(videoTimestamp)} --dry-run-note ${shellQuote("Refresh public source preflight for current clean HEAD before approval request.")}`,
    refreshedApprovalRequest: `npm run external:approval-request -- --dry-run-receipt <fresh-public-dry-run-receipt.json> --out ${shellQuote(approvalRequestPath)} --markdown-out ${shellQuote(markdownSiblingPath(approvalRequestPath))}`,
    approvedCandidateAfterCurrentTurnApproval: `npm run external:validate -- --approved-current-turn --reading-url <approved-reading-url> --video-url <approved-video-url> --video-timestamp <captured-timestamp> --source-approval-request ${shellQuote(approvalRequestPath)} --approval-note "<current-turn approval from refreshed request>"`,
    privacyTemplate: "npm run external:privacy-template -- --receipt <candidate-receipt.json> --out <privacy-review.json>",
    privacyReview: "npm run external:privacy-review -- --receipt <candidate-receipt.json> --review <privacy-review.json> --out <ko-evidence-review.json>"
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

function validateRequestedApprovalText(sourceApprovalRequest) {
  const text = String(sourceApprovalRequest.requestedApprovalText || "");
  const readingUrl = sourceApprovalRequest.sources?.reading?.url || "";
  const videoUrl = sourceApprovalRequest.sources?.video?.url || "";
  const videoTimestamp = sourceApprovalRequest.sources?.video?.timestamp || "";
  const problems = [];
  const tokens = parseApprovalTokens(text);
  if (!text.trim()) {
    problems.push("Requested approval text is missing from source approval request.");
    return problems;
  }
  if (tokens.reading.count !== 1) {
    problems.push("Requested approval text must contain exactly one reading= token.");
  }
  if (tokens.video.count !== 1) {
    problems.push("Requested approval text must contain exactly one video= token.");
  }
  if (tokens.timestamp.count !== 1) {
    problems.push("Requested approval text must contain exactly one timestamp= token.");
  }
  if (tokens.reading.count === 1 && tokens.reading.value !== readingUrl) {
    problems.push("Requested approval text must include the exact approved reading URL.");
  }
  if (tokens.video.count === 1 && tokens.video.value !== videoUrl) {
    problems.push("Requested approval text must include the exact approved video URL.");
  }
  if (tokens.timestamp.count === 1 && tokens.timestamp.value !== videoTimestamp) {
    problems.push("Requested approval text must include the exact approved video timestamp.");
  }
  return problems;
}

function parseApprovalTokens(text) {
  const value = String(text || "");
  return Object.fromEntries(["reading", "video", "timestamp"].map((token) => {
    const matches = Array.from(value.matchAll(new RegExp(`(^|\\s)${token}=([^\\s]+)`, "g")));
    return [token, {
      count: matches.length,
      value: matches[0]?.[2] || ""
    }];
  }));
}

function formatMaybeBoolean(value) {
  return value === true || value === false ? String(value) : "TBD";
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function markdownSiblingPath(jsonPath) {
  const text = String(jsonPath);
  return text.endsWith(".json") ? `${text.slice(0, -5)}.md` : `${text}.md`;
}
