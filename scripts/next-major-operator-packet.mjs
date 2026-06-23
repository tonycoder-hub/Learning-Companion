#!/usr/bin/env node
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { readCurrentRevision } from "./lib/git-revision.mjs";
import {
  assessSourceApprovalFreshness,
  buildApprovedCandidateCommand,
  buildFreshSourceCommands
} from "./lib/source-approval-freshness.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = dirname(scriptPath);

const OPERATOR_SCHEMA = "learning-companion.next-major-operator-packet.v1";
const STATUS_PATH = ".codex-tmp/ko-evidence/current-status.json";
const READINESS_PATH = ".codex-tmp/next-major-readiness/current.json";
const PLATFORM_HANDOFF_PATH = ".codex-tmp/platform-qa-handoff/current.json";
const SOURCE_APPROVAL_REQUEST_PATH = ".codex-tmp/external-source-validation/source-approval-request.json";
const SOURCE_APPROVAL_MARKDOWN_PATH = ".codex-tmp/external-source-validation/source-approval-request.md";
const DEFAULT_MAC_MANUAL_PATH = ".codex-tmp/mac-manual-qa/real-run-receipt.json";
const DEFAULT_WINDOWS_STATIC_PATH = ".codex-tmp/windows-static-qa/real-run-receipt.json";
const DEFAULT_HARMONY_DEVICE_PATH = ".codex-tmp/harmony-device-qa/real-run-receipt.json";
const PATH_ARGS = [
  "status",
  "readiness",
  "platform-handoff",
  "source-approval-request",
  "source-approval-markdown",
  "external",
  "mac-manual",
  "windows-static",
  "harmony-device",
  "out",
  "markdown-out"
];
const CURRENT_PLATFORM_HANDOFF_STATUS = "CURRENT_CLEAN_HEAD_PLATFORM_QA_HANDOFF";
const CURRENT_OPERATOR_PLATFORM_HANDOFF_STATUS = "CURRENT_CLEAN_PLATFORM_QA_HANDOFF";
const CURRENT_READINESS_STATUS = "CURRENT_CLEAN_NEXT_MAJOR_READINESS";
const STALE_OR_DIRTY_READINESS_STATUS = "STALE_OR_DIRTY_NEXT_MAJOR_READINESS";
const CURRENT_KO_STATUS = "CURRENT_CLEAN_HEAD_KO_STATUS";

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
const sourceApprovalMarkdownPath = String(
  args["source-approval-markdown"]
    || (sourceApprovalRequestPath === SOURCE_APPROVAL_REQUEST_PATH ? SOURCE_APPROVAL_MARKDOWN_PATH : markdownSiblingPath(sourceApprovalRequestPath))
);
const externalEvidencePath = args.external ? String(args.external) : "";
const platformReceiptPaths = {
  macManual: String(args["mac-manual"] || DEFAULT_MAC_MANUAL_PATH),
  windowsStatic: String(args["windows-static"] || DEFAULT_WINDOWS_STATIC_PATH),
  harmonyDevice: String(args["harmony-device"] || DEFAULT_HARMONY_DEVICE_PATH)
};

if (args.refresh) {
  await refreshInputs({
    statusPath,
    readinessPath,
    platformHandoffPath,
    sourceApprovalRequestPath,
    sourceApprovalMarkdownPath,
    externalEvidencePath,
    platformReceiptPaths
  });
}

const packet = await buildOperatorPacket({
  statusPath,
  readinessPath,
  platformHandoffPath,
  sourceApprovalRequestPath,
  sourceApprovalMarkdownPath,
  externalEvidencePath,
  platformReceiptPaths
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

async function refreshInputs({
  statusPath,
  readinessPath,
  platformHandoffPath,
  sourceApprovalRequestPath,
  sourceApprovalMarkdownPath,
  externalEvidencePath,
  platformReceiptPaths
}) {
  await runNodeScript([scriptInThisDir("validate-ko-evidence.mjs"), "--allow-missing", "--out", statusPath], "KO status");
  const readinessArgv = [
    scriptInThisDir("next-major-readiness.mjs"),
    "--status",
    statusPath,
    "--out",
    readinessPath,
    "--markdown-out",
    markdownSiblingPath(readinessPath),
    "--source-approval-request",
    sourceApprovalRequestPath,
    "--source-approval-markdown",
    sourceApprovalMarkdownPath
  ];
  if (externalEvidencePath) {
    readinessArgv.push("--external", externalEvidencePath);
  }
  readinessArgv.push(...buildCustomPlatformReceiptArgv(platformReceiptPaths));
  await runNodeScript(readinessArgv, "next-major readiness");
  await runNodeScript([
    scriptInThisDir("platform-qa-handoff.mjs"),
    "--status",
    statusPath,
    "--out",
    platformHandoffPath,
    "--markdown-out",
    markdownSiblingPath(platformHandoffPath),
    ...buildCustomPlatformReceiptArgv(platformReceiptPaths)
  ], "platform QA handoff");
}

function scriptInThisDir(fileName) {
  return resolve(scriptDir, fileName);
}

function markdownSiblingPath(jsonPath) {
  const text = String(jsonPath);
  return text.endsWith(".json") ? text.slice(0, -5) + ".md" : `${text}.md`;
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

  const currentRevision = await readCurrentRevision();
  const readinessFreshness = assessReadinessFreshness(readiness, currentRevision);
  const platformHandoffFreshness = assessPlatformHandoffFreshness(platformHandoff, currentRevision);
  const requirements = Array.isArray(status.requirements) ? status.requirements : [];
  const requirementById = new Map(requirements.map((item) => [item.id || "UNKNOWN", item]));
  const lanes = [
    await buildExternalSourceLane(requirementById.get("approvedExternalReadingVideo"), sourceApprovalRequest, paths.sourceApprovalRequestPath, currentRevision),
    ...buildPlatformLanes(platformHandoff, platformHandoffFreshness, paths),
    buildFinalGateLane(readiness, platformHandoff, platformHandoffFreshness, readinessFreshness, {
      sourceApprovalRequestPath: paths.sourceApprovalRequestPath,
      sourceApprovalMarkdownPath: paths.sourceApprovalMarkdownPath,
      externalEvidencePath: paths.externalEvidencePath || "",
      platformReceiptPaths: paths.platformReceiptPaths || {}
    })
  ];
  const nextActionSequence = buildNextActionSequence(lanes);
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
      sourceApprovalMarkdownPath: paths.sourceApprovalMarkdownPath,
      externalEvidencePath: paths.externalEvidencePath || "",
      platformReceiptPaths: paths.platformReceiptPaths || {},
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
      releaseActionAuthorized: readiness.releaseActionAuthorized === true,
      koStatusFreshness: readiness.koStatusFreshness?.status || "UNKNOWN"
    },
    currentRevision,
    readinessFreshness,
    platformHandoffFreshness,
    lanes,
    operatorOrder: lanes.map((lane) => lane.id),
    nextActionSequence,
    blockedOrNotExecuted: [
      "No current-turn source approval was granted by this operator packet.",
      "No approved-source browser capture or screenshot validation was run by this operator packet.",
      "No human privacy review was performed by this operator packet.",
      "No Mac, Windows, or HarmonyOS real platform QA was run by this operator packet.",
      "No build, package, deployment, Mew-Test, main-site, or remote acceptance check was run by this operator packet."
    ]
  };
}

function buildNextActionSequence(lanes) {
  const sequence = [];
  const laneById = new Map(lanes.map((lane) => [lane.id, lane]));
  const sourceLane = laneById.get("approvedExternalReadingVideo");
  if (sourceLane) {
    appendSourceNextActions(sequence, sourceLane);
  }
  const platformLanes = lanes.filter((lane) => lane.id !== "approvedExternalReadingVideo" && lane.id !== "finalKoGate");
  if (platformLanes.some((lane) => lane.operatorState === "NEEDS_FRESH_PLATFORM_QA_HANDOFF")) {
    const refreshCommand = platformLanes.find((lane) => lane.nextCommands?.refreshPlatformHandoff)?.nextCommands?.refreshPlatformHandoff || "";
    sequence.push({
      id: "refresh-platform-qa-handoff",
      laneId: "platformQa",
      operatorState: "NEEDS_FRESH_PLATFORM_QA_HANDOFF",
      action: "Regenerate the platform QA handoff on the exact clean HEAD before any real platform run is treated as KO evidence.",
      command: refreshCommand,
      produces: "Fresh non-claiming platform QA handoff.",
      claimBoundary: "This refresh still does not run Mac, Windows, or HarmonyOS QA."
    });
  }
  for (const lane of platformLanes) {
    if (lane.currentKoStatus?.status === "PASSING_REAL_RUN") continue;
    sequence.push({
      id: `run-${lane.id}`,
      laneId: lane.id,
      operatorState: lane.operatorState,
      action: `Execute the real ${lane.label} run, fill ${lane.qaPath}, then validate the receipt.`,
      command: lane.validateCommand || "",
      produces: lane.receiptPath || "",
      claimBoundary: "Only a real named-platform run with all rows PASS can satisfy this lane."
    });
  }
  const finalLane = laneById.get("finalKoGate");
  if (finalLane) {
    if (finalLane.readinessFreshness?.status !== CURRENT_READINESS_STATUS) {
      sequence.push({
        id: "refresh-readiness-packet",
        laneId: "finalKoGate",
        operatorState: "NEEDS_FRESH_NEXT_MAJOR_READINESS",
        action: "Regenerate the next-major readiness packet on the exact clean HEAD before the final KO lane is treated as ready.",
        command: finalLane.nextCommands?.refreshReadiness || "",
        produces: "Fresh non-claiming next-major readiness packet.",
        claimBoundary: "This refresh still does not run source approval, privacy review, platform QA, build, deploy, or remote acceptance."
      });
    }
    sequence.push({
      id: "validate-final-ko",
      laneId: "finalKoGate",
      operatorState: finalLane.operatorState,
      action: "After approved external evidence and all real platform receipts exist, run the final KO gate and refresh readiness/operator packets.",
      command: finalLane.nextCommands?.finalizeNextMajor || finalLane.nextCommands?.finalKoGateWithExplicitPlatformReceipts || finalLane.nextCommands?.finalKoGate || "",
      produces: ".codex-tmp/ko-evidence/final.json plus refreshed readiness/operator artifacts.",
      claimBoundary: "Do not run or treat this as passing until every preceding lane has real PASS evidence."
    });
  }
  return sequence.map((step, index) => ({
    order: index + 1,
    ...step
  }));
}

function appendSourceNextActions(sequence, lane) {
  if (lane.operatorState === "NEEDS_SOURCE_INPUT") {
    sequence.push({
      id: "collect-source-input",
      laneId: lane.id,
      operatorState: lane.operatorState,
      action: "Collect one public reading URL, one public video URL, and one video timestamp, then generate a source approval request.",
      command: [lane.nextCommands?.sourceIntake, lane.nextCommands?.sourceApprovalRequest].filter(Boolean).join(" && "),
      produces: lane.approvalRequest?.path || SOURCE_APPROVAL_REQUEST_PATH,
      claimBoundary: "Source input and approval requests do not grant approval or create KO evidence."
    });
    return;
  }
  if (lane.operatorState === "NEEDS_FRESH_PUBLIC_DRY_RUN_OR_APPROVAL_REQUEST") {
    sequence.push({
      id: "refresh-public-source-dry-run",
      laneId: lane.id,
      operatorState: lane.operatorState,
      action: "Refresh the public-source dry run and approval request against the current clean HEAD before asking for approval.",
      command: [lane.nextCommands?.refreshPublicDryRun, lane.nextCommands?.refreshedApprovalRequest].filter(Boolean).join(" && "),
      produces: "Fresh source approval request tied to the current clean HEAD.",
      claimBoundary: "A public dry-run is not approved external evidence."
    });
  }
  sequence.push({
    id: "get-current-turn-source-approval",
    laneId: lane.id,
    operatorState: lane.operatorState,
    action: "Get exact current-turn approval text from the user before running approved browser evidence.",
    command: "",
    produces: lane.approvalRequest?.requestedApprovalText || "TBD",
    claimBoundary: "This operator packet cannot grant approval on the user's behalf."
  });
  sequence.push({
    id: "run-approved-external-source-candidate",
    laneId: lane.id,
    operatorState: lane.operatorState,
    action: "Run the approved external-source browser validation only after exact current-turn approval exists.",
    command: lane.nextCommands?.approvedCandidateAfterCurrentTurnApproval || "",
    produces: "External-source candidate receipt.",
    claimBoundary: "The candidate receipt still needs privacy review before KO use."
  });
  sequence.push({
    id: "complete-external-source-privacy-review",
    laneId: lane.id,
    operatorState: lane.operatorState,
    action: "Generate the privacy template, complete human privacy review, and validate the KO evidence review artifact.",
    command: [lane.nextCommands?.privacyTemplate, lane.nextCommands?.privacyReview].filter(Boolean).join(" && "),
    produces: "learning-companion.external-source-ko-evidence-review.v1",
    claimBoundary: "Privacy templates without completed review cannot satisfy KO evidence."
  });
}

function assessReadinessFreshness(readiness, currentRevision) {
  const basisRevision = readiness.currentRevision || {};
  const koStatusFreshness = readiness.koStatusFreshness || {};
  const problems = [];
  if (koStatusFreshness.status !== CURRENT_KO_STATUS) {
    problems.push(`Readiness KO status freshness is ${koStatusFreshness.status || "TBD"}, expected ${CURRENT_KO_STATUS}.`);
  }
  if (basisRevision.gitAvailable !== true) {
    problems.push("Readiness packet did not prove git revision availability.");
  }
  if (!basisRevision.gitHead) {
    problems.push("Readiness packet gitHead is missing.");
  } else if (!currentRevision.gitHead) {
    problems.push("Current gitHead is unavailable.");
  } else if (basisRevision.gitHead !== currentRevision.gitHead) {
    problems.push(`Readiness packet gitHead ${basisRevision.gitHead} does not match current HEAD ${currentRevision.gitHead}.`);
  }
  if (basisRevision.dirtyWorktree !== false) {
    problems.push("Readiness packet did not prove it was generated from a clean worktree.");
  }
  if (currentRevision.dirtyWorktree !== false) {
    problems.push("Current worktree is dirty; resolve current worktree changes under current-turn authorization, then regenerate the readiness packet. Do not discard changes unless explicitly asked.");
  }
  return {
    status: problems.length ? STALE_OR_DIRTY_READINESS_STATUS : CURRENT_READINESS_STATUS,
    currentGitHead: currentRevision.gitHead,
    currentDirtyWorktree: currentRevision.dirtyWorktree,
    basisGitHead: basisRevision.gitHead || "",
    basisDirtyWorktree: basisRevision.dirtyWorktree,
    basisKoStatusFreshnessStatus: koStatusFreshness.status || "",
    basisStatusLineCount: basisRevision.statusLineCount ?? "TBD",
    basisStatusTruncated: basisRevision.statusTruncated === true,
    problems
  };
}

function assessPlatformHandoffFreshness(platformHandoff, currentRevision) {
  const basisRevision = platformHandoff.currentRevision || {};
  const executionFreshness = platformHandoff.executionFreshness || {};
  const problems = [];
  if (executionFreshness.status !== CURRENT_PLATFORM_HANDOFF_STATUS) {
    problems.push(`Platform handoff executionFreshness.status is ${executionFreshness.status || "TBD"}, expected ${CURRENT_PLATFORM_HANDOFF_STATUS}.`);
  }
  if (basisRevision.gitAvailable !== true) {
    problems.push("Platform handoff did not prove git revision availability.");
  }
  if (!basisRevision.gitHead) {
    problems.push("Platform handoff gitHead is missing.");
  } else if (!currentRevision.gitHead) {
    problems.push("Current gitHead is unavailable.");
  } else if (basisRevision.gitHead !== currentRevision.gitHead) {
    problems.push(`Platform handoff gitHead ${basisRevision.gitHead} does not match current HEAD ${currentRevision.gitHead}.`);
  }
  if (basisRevision.dirtyWorktree !== false) {
    problems.push("Platform handoff did not prove it was generated from a clean worktree.");
  }
  if (currentRevision.dirtyWorktree !== false) {
    problems.push("Current worktree is dirty; resolve current worktree changes under current-turn authorization, then regenerate the platform handoff. Do not discard changes unless explicitly asked.");
  }
  return {
    status: problems.length ? "STALE_OR_DIRTY_PLATFORM_QA_HANDOFF" : CURRENT_OPERATOR_PLATFORM_HANDOFF_STATUS,
    currentGitHead: currentRevision.gitHead,
    currentDirtyWorktree: currentRevision.dirtyWorktree,
    basisGitHead: basisRevision.gitHead || "",
    basisDirtyWorktree: basisRevision.dirtyWorktree,
    basisExecutionFreshnessStatus: executionFreshness.status || "",
    basisStatusLineCount: basisRevision.statusLineCount ?? "TBD",
    basisStatusTruncated: basisRevision.statusTruncated === true,
    problems
  };
}

async function buildExternalSourceLane(requirement = {}, sourceApprovalRequest, sourceApprovalRequestPath, currentRevision) {
  const hasApprovalRequest = Boolean(sourceApprovalRequest);
  const approvalFreshness = await assessSourceApprovalFreshness(sourceApprovalRequest, currentRevision);
  const needsFreshApprovalRequest = hasApprovalRequest && approvalFreshness.status === "STALE_OR_DIRTY_PUBLIC_DRY_RUN";
  return {
    id: "approvedExternalReadingVideo",
    label: "Approved external reading/video evidence",
    operatorState: !hasApprovalRequest
      ? "NEEDS_SOURCE_INPUT"
      : needsFreshApprovalRequest
        ? "NEEDS_FRESH_PUBLIC_DRY_RUN_OR_APPROVAL_REQUEST"
        : "NEEDS_CURRENT_TURN_APPROVAL",
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
          requestedApprovalText: sourceApprovalRequest.requestedApprovalText || "",
          freshness: approvalFreshness
        }
      : {
          path: sourceApprovalRequestPath,
          evidenceTier: "MISSING",
          canClaimExternalKo: false,
          readingUrl: "",
          videoUrl: "",
          videoTimestamp: "",
          requestedApprovalText: "",
          freshness: approvalFreshness
        },
    nextCommands: needsFreshApprovalRequest
      ? buildFreshSourceCommands(sourceApprovalRequest)
      : hasApprovalRequest
      ? {
          approvedCandidateAfterCurrentTurnApproval: buildApprovedCandidateCommand(sourceApprovalRequest),
          privacyTemplate: sourceApprovalRequest.nextCommands?.privacyTemplate || "",
          privacyReview: sourceApprovalRequest.nextCommands?.privacyReview || ""
        }
      : {
          sourceIntake: "npm run external:source-intake -- --input \"阅读：https://... 视频：https://... 时间：00:15\" --out .codex-tmp/external-source-validation/source-intake-handoff.json",
          sourceApprovalRequest: `npm run external:approval-request -- --intake-handoff .codex-tmp/external-source-validation/source-intake-handoff.json --out ${shellQuote(sourceApprovalRequestPath)} --markdown-out ${shellQuote(markdownSiblingPath(sourceApprovalRequestPath))}`,
          approvedCandidateAfterCurrentTurnApproval: `npm run external:validate -- --approved-current-turn --reading-url <approved-reading-url> --video-url <approved-video-url> --video-timestamp <captured-timestamp> --source-approval-request ${shellQuote(sourceApprovalRequestPath)} --approval-note "<current-turn approval>"`,
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

function buildPlatformLanes(platformHandoff, platformHandoffFreshness, pathBindings = {}) {
  const needsFreshPlatformHandoff = platformHandoffFreshness.status !== CURRENT_OPERATOR_PLATFORM_HANDOFF_STATUS;
  const refreshCommands = buildPlatformRefreshCommands(pathBindings);
  return (Array.isArray(platformHandoff.platforms) ? platformHandoff.platforms : []).map((platform) => ({
    id: platform.id || "UNKNOWN",
    label: platform.label || platform.id || "UNKNOWN",
    operatorState: needsFreshPlatformHandoff
      ? "NEEDS_FRESH_PLATFORM_QA_HANDOFF"
      : platform.currentKoStatus?.status === "PASSING_REAL_RUN"
        ? "READY_FOR_FINAL_KO_GATE"
        : "NEEDS_REAL_PLATFORM_RUN",
    platformHandoffFreshness,
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
    nextCommands: needsFreshPlatformHandoff
      ? refreshCommands
      : {},
    executionChecklist: platform.executionChecklist || {},
    nextRealRunSteps: platform.nextRealRunSteps || [],
    cannotBeFilledFrom: platform.cannotBeFilledFrom || []
  }));
}

function buildPlatformRefreshCommands({
  statusPath = STATUS_PATH,
  readinessPath = READINESS_PATH,
  platformHandoffPath = PLATFORM_HANDOFF_PATH,
  sourceApprovalRequestPath = SOURCE_APPROVAL_REQUEST_PATH,
  sourceApprovalMarkdownPath = SOURCE_APPROVAL_MARKDOWN_PATH,
  externalEvidencePath = "",
  platformReceiptPaths = {}
} = {}) {
  const customPlatformArgs = buildCustomPlatformReceiptCommandArgs(platformReceiptPaths);
  const refreshPlatformParts = [
    "npm run platform:qa-handoff -- --status",
    shellQuote(statusPath),
    "--out",
    shellQuote(platformHandoffPath),
    "--markdown-out",
    shellQuote(markdownSiblingPath(platformHandoffPath)),
    ...customPlatformArgs
  ];
  const refreshOperatorParts = [
    "npm run next:operator -- --refresh",
    "--status",
    shellQuote(statusPath),
    "--readiness",
    shellQuote(readinessPath),
    "--platform-handoff",
    shellQuote(platformHandoffPath),
    "--source-approval-request",
    shellQuote(sourceApprovalRequestPath),
    "--source-approval-markdown",
    shellQuote(sourceApprovalMarkdownPath)
  ];
  if (externalEvidencePath) {
    refreshOperatorParts.push("--external", shellQuote(externalEvidencePath));
  }
  refreshOperatorParts.push(
    ...customPlatformArgs,
    "--out",
    ".codex-tmp/next-major-operator/current.json",
    "--markdown-out",
    ".codex-tmp/next-major-operator/current.md"
  );
  return {
    refreshPlatformHandoff: refreshPlatformParts.join(" "),
    refreshOperatorPacket: refreshOperatorParts.join(" ")
  };
}

function buildFinalGateLane(readiness, platformHandoff, platformHandoffFreshness, readinessFreshness, pathBindings = {}) {
  const platformHandoffReady = platformHandoffFreshness.status === CURRENT_OPERATOR_PLATFORM_HANDOFF_STATUS;
  const readinessReady = readinessFreshness.status === CURRENT_READINESS_STATUS;
  const fallbackCommands = {
    refreshReadiness: readiness.nextCommands?.refreshReadiness
      || "npm run next:readiness -- --refresh --out .codex-tmp/next-major-readiness/current.json --markdown-out .codex-tmp/next-major-readiness/current.md",
    finalizeNextMajor: readiness.nextCommands?.finalizeNextMajor
      || platformHandoff.nextCommands?.finalizeNextMajor
      || "npm run next:finalize -- --external <ko-evidence-review.json>",
    finalKoGate: readiness.nextCommands?.finalKoGate
      || platformHandoff.nextCommands?.finalKoGate
      || "npm run ko:validate -- --external <ko-evidence-review.json> --out .codex-tmp/ko-evidence/final.json",
    finalKoGateWithExplicitPlatformReceipts: readiness.nextCommands?.finalKoGateWithExplicitPlatformReceipts
      || platformHandoff.nextCommands?.finalKoGateWithExplicitPlatformReceipts
      || ""
  };
  const boundFinalCommands = buildBoundFinalGateCommands(pathBindings, fallbackCommands);
  return {
    id: "finalKoGate",
    label: "Final KO gate",
    operatorState: readiness.canClaimNextMajorPreReleaseReady === true && platformHandoffReady && readinessReady ? "READY_TO_VALIDATE_FINAL_KO" : "BLOCKED_UNTIL_ALL_EVIDENCE_PASSES",
    currentReadinessStatus: readiness.readinessStatus || "UNKNOWN",
    sourceReadinessCanClaim: readiness.canClaimNextMajorPreReleaseReady === true,
    readinessReady,
    readinessFreshness,
    platformHandoffReady,
    platformHandoffFreshness,
    releaseActionAuthorized: readiness.releaseActionAuthorized === true,
    nextCommands: {
      refreshReadiness: fallbackCommands.refreshReadiness,
      finalizeNextMajor: boundFinalCommands.finalizeNextMajor || fallbackCommands.finalizeNextMajor,
      finalKoGate: boundFinalCommands.finalKoGate || fallbackCommands.finalKoGate,
      finalKoGateWithExplicitPlatformReceipts: boundFinalCommands.finalKoGateWithExplicitPlatformReceipts || fallbackCommands.finalKoGateWithExplicitPlatformReceipts
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

function buildBoundFinalGateCommands({
  sourceApprovalRequestPath = SOURCE_APPROVAL_REQUEST_PATH,
  sourceApprovalMarkdownPath = SOURCE_APPROVAL_MARKDOWN_PATH,
  externalEvidencePath = "",
  platformReceiptPaths = {}
} = {}, fallbackCommands = {}) {
  const hasSourceOverride = sourceApprovalRequestPath !== SOURCE_APPROVAL_REQUEST_PATH
    || sourceApprovalMarkdownPath !== SOURCE_APPROVAL_MARKDOWN_PATH;
  const hasExternalOverride = Boolean(externalEvidencePath);
  const customPlatformArgs = buildCustomPlatformReceiptCommandArgs(platformReceiptPaths);
  const hasPlatformOverride = customPlatformArgs.length > 0;
  if (!hasSourceOverride && !hasExternalOverride && !hasPlatformOverride) {
    return {};
  }
  if (hasSourceOverride && !hasExternalOverride && !hasPlatformOverride) {
    return {
      finalizeNextMajor: appendSourceApprovalArgs(
        fallbackCommands.finalizeNextMajor || "npm run next:finalize -- --external <ko-evidence-review.json>",
        sourceApprovalRequestPath,
        sourceApprovalMarkdownPath
      )
    };
  }

  const externalArg = externalEvidencePath ? shellQuote(externalEvidencePath) : "<ko-evidence-review.json>";
  const finalizeParts = ["npm run next:finalize -- --external", externalArg];
  if (hasSourceOverride) {
    finalizeParts.push(
      "--source-approval-request",
      shellQuote(sourceApprovalRequestPath),
      "--source-approval-markdown",
      shellQuote(sourceApprovalMarkdownPath)
    );
  }
  if (hasPlatformOverride) finalizeParts.push(...customPlatformArgs);

  const finalKoParts = [
    "npm run ko:validate -- --external",
    externalArg,
    "--out",
    ".codex-tmp/ko-evidence/final.json"
  ];
  const explicitFinalKoParts = [
    "npm run ko:validate -- --external",
    externalArg,
    ...buildPlatformReceiptCommandArgs(platformReceiptPaths),
    "--out",
    ".codex-tmp/ko-evidence/final.json"
  ];
  return {
    finalizeNextMajor: finalizeParts.join(" "),
    finalKoGate: finalKoParts.join(" "),
    finalKoGateWithExplicitPlatformReceipts: explicitFinalKoParts.join(" ")
  };
}

function appendSourceApprovalArgs(command, sourceApprovalRequestPath, sourceApprovalMarkdownPath) {
  return replaceOrAppendFlagPath(
    replaceOrAppendFlagPath(command, "--source-approval-request", sourceApprovalRequestPath),
    "--source-approval-markdown",
    sourceApprovalMarkdownPath
  );
}

function replaceOrAppendFlagPath(command, flag, path) {
  const replacement = `${flag} ${shellQuote(path)}`;
  const pattern = new RegExp(`(^|\\s)${escapeRegExp(flag)}\\s+(?:'(?:(?:'\\\\''|[^'])*)'|"(?:\\\\.|[^"])*"|\\S+)`);
  if (pattern.test(command)) {
    return command.replace(pattern, `$1${replacement}`);
  }
  return `${command} ${replacement}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function buildCustomPlatformReceiptArgv(platformReceiptPaths = {}) {
  const macManual = platformReceiptPaths.macManual || DEFAULT_MAC_MANUAL_PATH;
  const windowsStatic = platformReceiptPaths.windowsStatic || DEFAULT_WINDOWS_STATIC_PATH;
  const harmonyDevice = platformReceiptPaths.harmonyDevice || DEFAULT_HARMONY_DEVICE_PATH;
  if (macManual === DEFAULT_MAC_MANUAL_PATH
    && windowsStatic === DEFAULT_WINDOWS_STATIC_PATH
    && harmonyDevice === DEFAULT_HARMONY_DEVICE_PATH) {
    return [];
  }
  return [
    "--mac-manual",
    macManual,
    "--windows-static",
    windowsStatic,
    "--harmony-device",
    harmonyDevice
  ];
}

function buildCustomPlatformReceiptCommandArgs(platformReceiptPaths = {}) {
  return buildCustomPlatformReceiptArgv(platformReceiptPaths).map((value, index) => (
    index % 2 === 0 ? value : shellQuote(value)
  ));
}

function buildPlatformReceiptCommandArgs(platformReceiptPaths = {}) {
  return [
    "--mac-manual",
    shellQuote(platformReceiptPaths.macManual || DEFAULT_MAC_MANUAL_PATH),
    "--windows-static",
    shellQuote(platformReceiptPaths.windowsStatic || DEFAULT_WINDOWS_STATIC_PATH),
    "--harmony-device",
    shellQuote(platformReceiptPaths.harmonyDevice || DEFAULT_HARMONY_DEVICE_PATH)
  ];
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
    `KO claimable: ${packet.sourceKoStatus.canClaimKo ? "YES" : "NO"}`,
    `Readiness freshness: ${packet.readinessFreshness.status}`,
    `Platform handoff freshness: ${packet.platformHandoffFreshness.status}`
  ];
  if (outPath) lines.push(`Operator JSON: ${outPath}`);
  if (markdownPath) lines.push(`Operator Markdown: ${markdownPath}`);
  lines.push("", "Operator lanes:");
  for (const lane of packet.lanes) {
    const status = lane.currentKoStatus?.status || lane.currentReadinessStatus || "UNKNOWN";
    lines.push(`- ${lane.id}: ${lane.operatorState}; status ${status}`);
  }
  lines.push("", "Next action sequence:");
  for (const step of packet.nextActionSequence) {
    lines.push(`- ${step.order}. ${step.id}: ${step.operatorState}`);
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
    `Current git HEAD: ${markdownInline(packet.currentRevision.gitHead || "TBD")}`,
    `Current worktree dirty: ${packet.currentRevision.dirtyWorktree ? "true" : "false"}`,
    `Readiness freshness: ${markdownInline(packet.readinessFreshness.status)}`,
    `Platform handoff freshness: ${markdownInline(packet.platformHandoffFreshness.status)}`,
    ""
  ];
  const readinessFreshnessProblems = packet.readinessFreshness.problems || [];
  if (readinessFreshnessProblems.length) {
    lines.push("", "## Readiness Freshness Problems", "");
    for (const problem of readinessFreshnessProblems) {
      lines.push(`- ${markdownInline(problem)}`);
    }
  }
  const platformFreshnessProblems = packet.platformHandoffFreshness.problems || [];
  if (platformFreshnessProblems.length) {
    lines.push("", "## Platform Handoff Freshness Problems", "");
    for (const problem of platformFreshnessProblems) {
      lines.push(`- ${markdownInline(problem)}`);
    }
  }
  lines.push("", "## Inputs", "");
  for (const [key, value] of Object.entries(packet.inputs)) {
    lines.push(`- ${markdownInline(key)}: ${markdownInline(value)}`);
  }
  lines.push("", "## Critical Path", "");
  for (const step of packet.nextActionSequence) {
    lines.push(
      `### ${step.order}. ${markdownInline(step.id)}`,
      "",
      `- Lane: ${markdownInline(step.laneId)}`,
      `- Operator state: ${markdownInline(step.operatorState)}`,
      `- Action: ${markdownInline(step.action)}`,
      `- Produces: ${markdownInline(step.produces || "TBD")}`,
      `- Claim boundary: ${markdownInline(step.claimBoundary)}`
    );
    if (step.id === "get-current-turn-source-approval" && step.produces) {
      lines.push("", "Exact approval text to request:", "", "```text", step.produces, "```");
    }
    if (step.command) {
      lines.push("", "Command:", "", "```bash", step.command, "```");
    }
    lines.push("");
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
        `- Approval text needed: ${markdownInline(lane.approvalRequest.requestedApprovalText || "TBD")}`,
        `- Approval request freshness: ${markdownInline(lane.approvalRequest.freshness?.status || "TBD")}`
      );
      if (lane.approvalRequest.requestedApprovalText) {
        lines.push("", "Exact approval text to copy:", "", "```text", lane.approvalRequest.requestedApprovalText, "```");
      }
      const freshnessProblems = lane.approvalRequest.freshness?.problems || [];
      for (const problem of freshnessProblems) {
        lines.push(`- Freshness problem: ${markdownInline(problem)}`);
      }
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
    appendExecutionChecklistMarkdown(lines, lane.executionChecklist);
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

function appendExecutionChecklistMarkdown(lines, checklist = {}) {
  const sections = [
    ["Before run", checklist.beforeRun],
    ["During run", checklist.duringRun],
    ["After run", checklist.afterRun],
    ["Not accepted as evidence", checklist.notAcceptedEvidence]
  ];
  if (!sections.some(([, items]) => Array.isArray(items) && items.length)) return;
  lines.push("", "Execution checklist:", "");
  for (const [label, items] of sections) {
    if (!Array.isArray(items) || !items.length) continue;
    lines.push(`${label}:`, "");
    for (const item of items) lines.push(`- ${markdownInline(item)}`);
    lines.push("");
  }
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

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(text)) return text;
  return `'${text.replace(/'/g, "'\\''")}'`;
}

function buildHelp() {
  return `Build a non-claiming operator packet for the remaining next-major gates.

Usage:
  npm run next:operator -- --refresh --out .codex-tmp/next-major-operator/current.json --markdown-out .codex-tmp/next-major-operator/current.md

With --refresh, this command refreshes local KO, readiness, and platform handoff
summaries and writes readiness/platform Markdown siblings next to their JSON
files. It does not grant source approval, run approved-source browser evidence,
perform privacy review, run Mac/Windows/HarmonyOS QA, build, package, deploy, or
run remote acceptance checks.

Optional path bindings:
  --source-approval-request <path> --source-approval-markdown <path>
  --external <ko-evidence-review.json>
  --mac-manual <receipt.json> --windows-static <receipt.json> --harmony-device <receipt.json>`;
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
