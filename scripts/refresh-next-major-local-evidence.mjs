#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { readCurrentRevisionSync } from "./lib/git-revision.mjs";

const execFileAsync = promisify(execFile);
const SUBCOMMAND_TIMEOUT_MS = 180_000;
const LOCAL_EVIDENCE_SNAPSHOT_SCHEMA = "learning-companion.next-major-local-evidence-snapshot.v1";
const PUBLIC_DRY_RUN_RECEIPT_SCHEMA = "learning-companion.external-source-validation-browser.v1";
const SOURCE_APPROVAL_REQUEST_SCHEMA = "learning-companion.external-source-approval-request.v1";
const NEXT_MAJOR_READINESS_SCHEMA = "learning-companion.next-major-readiness.v1";
const PLATFORM_QA_HANDOFF_SCHEMA = "learning-companion.platform-qa-handoff.v1";
const PLATFORM_QA_EVIDENCE_SCAFFOLD_SCHEMA = "learning-companion.platform-qa-evidence-scaffold.v1";
const NEXT_MAJOR_OPERATOR_PACKET_SCHEMA = "learning-companion.next-major-operator-packet.v1";
const KO_NEXT_ACTION_SUMMARY_SCHEMA = "learning-companion.ko-next-action-summary.v1";
const PUBLIC_DRY_RUN_RECEIPT_PATTERN = /external_source_validation_public_dry_run_ok\s+(.+\.json)\s*$/m;
const STATIC_RETURN_RECEIPT_PATTERN = /static_return_loop_ok\s+(.+receipt\.json)\s*$/m;
const CURRENT_CLEAN_PUBLIC_DRY_RUN = "CURRENT_CLEAN_PUBLIC_DRY_RUN";
const CURRENT_CLEAN_HEAD_KO_STATUS = "CURRENT_CLEAN_HEAD_KO_STATUS";
const CURRENT_CLEAN_HEAD_PLATFORM_QA_HANDOFF = "CURRENT_CLEAN_HEAD_PLATFORM_QA_HANDOFF";
const CURRENT_CLEAN_NEXT_MAJOR_READINESS = "CURRENT_CLEAN_NEXT_MAJOR_READINESS";
const CURRENT_CLEAN_PLATFORM_QA_HANDOFF = "CURRENT_CLEAN_PLATFORM_QA_HANDOFF";
const CURRENT_CLEAN_OPERATOR_PACKET = "CURRENT_CLEAN_OPERATOR_PACKET";

const DEFAULTS = Object.freeze({
  sourceApprovalRequest: ".codex-tmp/external-source-validation/source-approval-request.json",
  sourceApprovalMarkdown: ".codex-tmp/external-source-validation/source-approval-request.md",
  readinessOut: ".codex-tmp/next-major-readiness/current.json",
  readinessMarkdownOut: ".codex-tmp/next-major-readiness/current.md",
  platformHandoffOut: ".codex-tmp/platform-qa-handoff/current.json",
  platformHandoffMarkdownOut: ".codex-tmp/platform-qa-handoff/current.md",
  platformEvidenceScaffoldOut: ".codex-tmp/platform-qa-evidence/scaffold-summary.json",
  platformEvidenceScaffoldMarkdownOut: ".codex-tmp/platform-qa-evidence/scaffold-summary.md",
  operatorOut: ".codex-tmp/next-major-operator/current.json",
  operatorMarkdownOut: ".codex-tmp/next-major-operator/current.md",
  koNextOut: ".codex-tmp/ko-next/current.json",
  localEvidenceOut: ".codex-tmp/next-major-local-evidence/current.json",
  localEvidenceMarkdownOut: ".codex-tmp/next-major-local-evidence/current.md",
  koStatus: ".codex-tmp/ko-evidence/current-status.json",
  macManual: ".codex-tmp/mac-manual-qa/real-run-receipt.json",
  windowsStatic: ".codex-tmp/windows-static-qa/real-run-receipt.json",
  harmonyDevice: ".codex-tmp/harmony-device-qa/real-run-receipt.json",
  dryRunNote: "Refresh public source preflight for current clean HEAD via next:local-evidence."
});
const LOCAL_RECEIPT_PATHS = Object.freeze({
  returnImport: ".codex-tmp/return-import-dry-run/receipt.json",
  dogfood: ".codex-tmp/dogfood-runbook/receipt.json",
  macPending: ".codex-tmp/mac-manual-qa/receipt.json",
  windowsPending: ".codex-tmp/windows-static-qa/receipt.json",
  harmonyPending: ".codex-tmp/harmony-device-qa/receipt.json"
});
const EXPECTED_LOCAL_RECEIPT_IDS = Object.freeze([
  "staticReturn",
  "returnImport",
  "dogfoodPending",
  "macManualPending",
  "windowsStaticPending",
  "harmonyDevicePending"
]);
const SNAPSHOT_REQUIRED_OUTPUTS = Object.freeze([
  ["publicDryRunReceipt", "public dry-run receipt"],
  ["sourceApprovalRequest", "source approval request"],
  ["sourceApprovalMarkdown", "source approval markdown"],
  ["readinessPacket", "readiness packet"],
  ["readinessMarkdown", "readiness markdown"],
  ["platformQaHandoff", "platform QA handoff"],
  ["platformQaHandoffMarkdown", "platform QA handoff markdown"],
  ["platformQaEvidenceScaffold", "platform QA evidence scaffold"],
  ["platformQaEvidenceScaffoldMarkdown", "platform QA evidence scaffold markdown"],
  ["operatorPacket", "operator packet"],
  ["operatorMarkdown", "operator markdown"],
  ["koNextActionSummary", "KO next action summary"]
]);
const LOCAL_EVIDENCE_BLOCKED_OR_NOT_EXECUTED = Object.freeze([
  "Does not grant current-turn source approval.",
  "Does not run approved-source browser capture.",
  "Does not perform human privacy review.",
  "Does not run Mac, Windows, or HarmonyOS real platform QA.",
  "Does not build, package, deploy, check Mew-Test/main site, run remote acceptance, or authorize release."
]);
const PATH_ARGS = [
  "source-approval-request",
  "source-approval-markdown",
  "readiness-out",
  "readiness-markdown-out",
  "platform-handoff-out",
  "platform-handoff-markdown-out",
  "platform-evidence-scaffold-out",
  "platform-evidence-scaffold-markdown-out",
  "operator-out",
  "operator-markdown-out",
  "ko-next-out",
  "local-evidence-out",
  "local-evidence-markdown-out",
  "ko-status",
  "mac-manual",
  "windows-static",
  "harmony-device"
];

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(buildHelp());
  process.exit(0);
}
for (const key of PATH_ARGS) {
  if (args[key] === true) throw new Error(`--${key} requires a file path.`);
}
if (args["dry-run-note"] === true) throw new Error("--dry-run-note requires text.");
assertSupportedOptions(args);

if (args["self-test"]) {
  await runSelfTest();
} else if (args.check) {
  const options = normalizeOptions(args);
  await runLocalEvidenceSnapshotCheck(options);
} else {
  const options = normalizeOptions(args);
  const plan = await buildLocalEvidencePlan(options);
  if (args["dry-run"]) {
    console.log(buildDryRunSummary(plan));
  } else {
    await runLocalEvidenceRefresh(plan);
  }
}

function normalizeOptions(parsed) {
  return {
    sourceApprovalRequest: String(parsed["source-approval-request"] || DEFAULTS.sourceApprovalRequest),
    sourceApprovalMarkdown: String(parsed["source-approval-markdown"] || DEFAULTS.sourceApprovalMarkdown),
    readinessOut: String(parsed["readiness-out"] || DEFAULTS.readinessOut),
    readinessMarkdownOut: String(parsed["readiness-markdown-out"] || DEFAULTS.readinessMarkdownOut),
    platformHandoffOut: String(parsed["platform-handoff-out"] || DEFAULTS.platformHandoffOut),
    platformHandoffMarkdownOut: String(parsed["platform-handoff-markdown-out"] || DEFAULTS.platformHandoffMarkdownOut),
    platformEvidenceScaffoldOut: String(parsed["platform-evidence-scaffold-out"] || DEFAULTS.platformEvidenceScaffoldOut),
    platformEvidenceScaffoldMarkdownOut: String(parsed["platform-evidence-scaffold-markdown-out"] || DEFAULTS.platformEvidenceScaffoldMarkdownOut),
    operatorOut: String(parsed["operator-out"] || DEFAULTS.operatorOut),
    operatorMarkdownOut: String(parsed["operator-markdown-out"] || DEFAULTS.operatorMarkdownOut),
    koNextOut: String(parsed["ko-next-out"] || DEFAULTS.koNextOut),
    localEvidenceOut: String(parsed["local-evidence-out"] || DEFAULTS.localEvidenceOut),
    localEvidenceMarkdownOut: String(parsed["local-evidence-markdown-out"] || DEFAULTS.localEvidenceMarkdownOut),
    koStatus: String(parsed["ko-status"] || DEFAULTS.koStatus),
    platformReceiptPaths: {
      macManual: String(parsed["mac-manual"] || DEFAULTS.macManual),
      windowsStatic: String(parsed["windows-static"] || DEFAULTS.windowsStatic),
      harmonyDevice: String(parsed["harmony-device"] || DEFAULTS.harmonyDevice)
    },
    dryRunNote: String(parsed["dry-run-note"] || DEFAULTS.dryRunNote)
  };
}

function assertSupportedOptions(parsed) {
  if (parsed.external) {
    throw new Error("--external is not supported by next:local-evidence; use next:readiness, next:operator, ko:next, or next:finalize for approved external evidence binding.");
  }
}

async function buildLocalEvidencePlan(options) {
  const currentRevision = readCurrentRevisionSync();
  assert.equal(currentRevision.gitAvailable, true, "git revision must be available");
  assert.equal(currentRevision.dirtyWorktree, false, "next:local-evidence must run from a clean worktree");
  assert.equal(currentRevision.statusLineCount, 0, "next:local-evidence must run from a clean git status");

  const request = await readSourceApprovalRequest(options.sourceApprovalRequest);
  const readingUrl = request.sources.reading.url;
  const videoUrl = request.sources.video.url;
  const videoTimestamp = request.sources.video.timestamp;
  return {
    options,
    currentRevision,
    sourceApproval: {
      path: options.sourceApprovalRequest,
      readingUrl,
      videoUrl,
      videoTimestamp
    },
    commands: [
      {
        id: "refresh-bilingual-runtime",
        label: "bilingual browser receipt",
        argv: ["scripts/smoke-bilingual-runtime-browser.mjs"]
      },
      {
        id: "refresh-controlled-loop",
        label: "controlled learning loop receipt",
        argv: ["scripts/agent-study-loop-check.mjs", "--out", ".codex-tmp/agent-study-loop-smoke/receipt.json"]
      },
      {
        id: "refresh-static-return-contract",
        label: "static return contract receipt",
        argv: ["scripts/static-return-loop-check.mjs"]
      },
      {
        id: "refresh-return-import-dry-run",
        label: "return file import dry-run receipt",
        argv: [
          "scripts/return-file-import-dry-run.mjs",
          "--workspace",
          "dist/morning-demo/sample-workspace.json",
          "--return-file",
          "dist/morning-demo/patches/sample-mobile-inbox-patch.json",
          "--return-file",
          "dist/morning-demo/patches/sample-review-progress-patch.json",
          "--out",
          LOCAL_RECEIPT_PATHS.returnImport
        ]
      },
      {
        id: "refresh-dogfood-runbook-pending",
        label: "dogfood runbook pending receipt",
        argv: [
          "scripts/validate-dogfood-runbook.mjs",
          "--runbook",
          "dist/morning-demo/DOGFOOD_RUNBOOK.md",
          "--out",
          LOCAL_RECEIPT_PATHS.dogfood
        ]
      },
      {
        id: "refresh-mac-manual-pending",
        label: "Mac manual QA pending receipt",
        argv: [
          "scripts/validate-mac-manual-qa.mjs",
          "--qa",
          "dist/morning-demo/MAC_MANUAL_QA.md",
          "--out",
          LOCAL_RECEIPT_PATHS.macPending
        ]
      },
      {
        id: "refresh-windows-static-pending",
        label: "Windows static QA pending receipt",
        argv: [
          "scripts/validate-windows-static-qa.mjs",
          "--qa",
          "dist/morning-demo/WINDOWS_STATIC_QA.md",
          "--out",
          LOCAL_RECEIPT_PATHS.windowsPending
        ]
      },
      {
        id: "refresh-harmony-device-pending",
        label: "HarmonyOS device QA pending receipt",
        argv: [
          "scripts/validate-harmony-device-qa.mjs",
          "--qa",
          "dist/morning-demo/HARMONY_DEVICE_QA.md",
          "--out",
          LOCAL_RECEIPT_PATHS.harmonyPending
        ]
      },
      {
        id: "refresh-public-source-dry-run",
        label: "public source dry-run",
        argv: [
          "scripts/external-source-validation-browser.mjs",
          "--public-source-dry-run",
          "--reading-url",
          readingUrl,
          "--video-url",
          videoUrl,
          "--video-timestamp",
          videoTimestamp,
          "--dry-run-note",
          options.dryRunNote
        ],
        capturePublicDryRunReceipt: true
      },
      {
        id: "refresh-ko-status",
        label: "KO status",
        argv: [
          "scripts/validate-ko-evidence.mjs",
          "--allow-missing",
          ...buildCustomPlatformReceiptArgv(options.platformReceiptPaths),
          "--out",
          options.koStatus
        ]
      },
      {
        id: "refresh-readiness",
        label: "next-major readiness",
        argv: [
          "scripts/next-major-readiness.mjs",
          "--status",
          options.koStatus,
          "--out",
          options.readinessOut,
          "--markdown-out",
          options.readinessMarkdownOut,
          "--source-approval-request",
          options.sourceApprovalRequest,
          "--source-approval-markdown",
          options.sourceApprovalMarkdown,
          ...buildCustomPlatformReceiptArgv(options.platformReceiptPaths)
        ]
      },
      {
        id: "refresh-platform-qa-handoff",
        label: "platform QA handoff",
        argv: [
          "scripts/platform-qa-handoff.mjs",
          "--status",
          options.koStatus,
          "--out",
          options.platformHandoffOut,
          "--markdown-out",
          options.platformHandoffMarkdownOut,
          ...buildCustomPlatformReceiptArgv(options.platformReceiptPaths)
        ]
      },
      {
        id: "refresh-platform-qa-evidence-scaffold",
        label: "platform QA evidence scaffold",
        argv: [
          "scripts/platform-qa-evidence-scaffold.mjs",
          "--platform-handoff",
          options.platformHandoffOut,
          "--out",
          options.platformEvidenceScaffoldOut,
          "--markdown-out",
          options.platformEvidenceScaffoldMarkdownOut
        ]
      },
      {
        id: "regenerate-source-approval-request",
        label: "source approval request",
        argvFrom: "publicDryRunReceipt"
      },
      {
        id: "refresh-operator-packet",
        label: "next-major operator packet",
        argv: [
          "scripts/next-major-operator-packet.mjs",
          "--status",
          options.koStatus,
          "--readiness",
          options.readinessOut,
          "--platform-handoff",
          options.platformHandoffOut,
          "--out",
          options.operatorOut,
          "--markdown-out",
          options.operatorMarkdownOut,
          "--source-approval-request",
          options.sourceApprovalRequest,
          "--source-approval-markdown",
          options.sourceApprovalMarkdown,
          ...buildCustomPlatformReceiptArgv(options.platformReceiptPaths)
        ]
      },
      {
        id: "print-ko-next",
        label: "KO next summary",
        argv: [
          "scripts/ko-next-action-summary.mjs",
          "--source-approval-request",
          options.sourceApprovalRequest,
          "--source-approval-markdown",
          options.sourceApprovalMarkdown,
          "--operator",
          options.operatorOut,
          "--status",
          options.koStatus,
          "--json-out",
          options.koNextOut,
          ...buildCustomPlatformReceiptArgv(options.platformReceiptPaths)
        ]
      }
    ],
    blockedOrNotExecuted: [...LOCAL_EVIDENCE_BLOCKED_OR_NOT_EXECUTED]
  };
}

async function runLocalEvidenceRefresh(plan) {
  let publicDryRunReceipt = "";
  const outputs = [];
  for (const command of plan.commands) {
    const argv = command.argvFrom === "publicDryRunReceipt"
      ? [
          "scripts/external-source-validation-browser.mjs",
          "--approval-request",
          "--dry-run-receipt",
          publicDryRunReceipt,
          "--out",
          plan.options.sourceApprovalRequest,
          "--markdown-out",
          plan.options.sourceApprovalMarkdown
        ]
      : command.argv;
    assert.ok(Array.isArray(argv), `${command.id} argv must be available`);
    const result = await runNodeCommand(argv, command.label);
    outputs.push({ id: command.id, stdout: result.stdout });
    if (command.capturePublicDryRunReceipt) {
      const match = result.stdout.match(PUBLIC_DRY_RUN_RECEIPT_PATTERN);
      if (!match) throw new Error("Could not find public dry-run receipt path in command output.");
      publicDryRunReceipt = match[1].trim();
      if (!existsSync(publicDryRunReceipt)) throw new Error(`Public dry-run receipt was not written: ${publicDryRunReceipt}`);
    }
  }
  const localReceipts = await collectLocalReceiptSummaries(outputs);
  const snapshot = buildLocalEvidenceSnapshot(plan, publicDryRunReceipt, outputs, localReceipts);
  await writePrivateFile(resolve(plan.options.localEvidenceOut), `${JSON.stringify(snapshot, null, 2)}\n`);
  await writePrivateFile(resolve(plan.options.localEvidenceMarkdownOut), buildLocalEvidenceSnapshotMarkdown(snapshot));
  console.log(buildSuccessSummary(plan, publicDryRunReceipt, outputs, localReceipts));
}

async function runNodeCommand(argv, label) {
  try {
    const result = await execFileAsync(process.execPath, argv, {
      cwd: process.cwd(),
      timeout: SUBCOMMAND_TIMEOUT_MS,
      maxBuffer: 4 * 1024 * 1024
    });
    return { stdout: String(result.stdout || ""), stderr: String(result.stderr || "") };
  } catch (error) {
    const stderr = String(error.stderr || error.message || "").trim();
    throw new Error(`Failed to refresh ${label}: ${stderr || "unknown error"}`);
  }
}

async function readSourceApprovalRequest(path) {
  const request = JSON.parse(await readFile(path, "utf8"));
  assert.equal(request.schema, "learning-companion.external-source-approval-request.v1");
  assert.equal(request.evidenceTier, "SOURCE_APPROVAL_REQUEST_ONLY");
  assert.equal(request.canClaimExternalKo, false);
  assert.ok(request.sources?.reading?.url, "source approval request must include reading URL");
  assert.ok(request.sources?.video?.url, "source approval request must include video URL");
  assert.ok(request.sources?.video?.timestamp, "source approval request must include video timestamp");
  return request;
}

async function writePrivateFile(path, content) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await chmod(path, 0o600).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
  await writeFile(path, content, { mode: 0o600 });
  await chmod(path, 0o600);
}

function buildLocalEvidenceSnapshot(plan, publicDryRunReceipt, outputs, localReceipts) {
  const koNext = outputs.find((item) => item.id === "print-ko-next")?.stdout.trim() || "";
  return {
    schema: LOCAL_EVIDENCE_SNAPSHOT_SCHEMA,
    generatedAt: new Date().toISOString(),
    evidenceTier: "NEXT_MAJOR_LOCAL_EVIDENCE_SNAPSHOT_ONLY",
    canClaimNextMajorFromThisSnapshot: false,
    releaseActionAuthorized: false,
    claimBoundary: "Local evidence snapshot only. It records current non-claiming local receipts and handoff paths; it does not grant source approval, run approved browser evidence, perform privacy review, run real platform QA, build, package, deploy, or run remote acceptance.",
    currentRevision: plan.currentRevision,
    sourceApproval: plan.sourceApproval,
    outputs: {
      publicDryRunReceipt: publicDryRunReceipt || "TBD",
      sourceApprovalRequest: plan.options.sourceApprovalRequest,
      sourceApprovalMarkdown: plan.options.sourceApprovalMarkdown,
      readinessPacket: plan.options.readinessOut,
      readinessMarkdown: plan.options.readinessMarkdownOut,
      platformQaHandoff: plan.options.platformHandoffOut,
      platformQaHandoffMarkdown: plan.options.platformHandoffMarkdownOut,
      platformQaEvidenceScaffold: plan.options.platformEvidenceScaffoldOut,
      platformQaEvidenceScaffoldMarkdown: plan.options.platformEvidenceScaffoldMarkdownOut,
      operatorPacket: plan.options.operatorOut,
      operatorMarkdown: plan.options.operatorMarkdownOut,
      koNextActionSummary: plan.options.koNextOut
    },
    localReceipts,
    koNextSummaryText: koNext,
    blockedOrNotExecuted: plan.blockedOrNotExecuted
  };
}

function buildLocalEvidenceSnapshotMarkdown(snapshot) {
  const lines = [
    "# Next Major Local Evidence Snapshot",
    "",
    `Evidence tier: ${snapshot.evidenceTier}`,
    `Can claim next-major from this snapshot: ${snapshot.canClaimNextMajorFromThisSnapshot}`,
    `Release action authorized: ${snapshot.releaseActionAuthorized}`,
    `Current git HEAD: ${snapshot.currentRevision?.gitHead || "TBD"}`,
    `Current worktree dirty: ${snapshot.currentRevision?.dirtyWorktree === true}`,
    "",
    "## Outputs",
    "",
    `- Public dry-run receipt: ${snapshot.outputs.publicDryRunReceipt}`,
    `- Source approval request: ${snapshot.outputs.sourceApprovalRequest}`,
    `- Readiness packet: ${snapshot.outputs.readinessPacket}`,
    `- Platform QA handoff: ${snapshot.outputs.platformQaHandoff}`,
    `- Platform QA evidence scaffold: ${snapshot.outputs.platformQaEvidenceScaffold}`,
    `- Operator packet: ${snapshot.outputs.operatorPacket}`,
    `- KO next action summary: ${snapshot.outputs.koNextActionSummary}`,
    "",
    "## Local Receipts",
    "",
    "| ID | Evidence tier | OK | Claim boundary | Receipt |",
    "| --- | --- | --- | --- | --- |"
  ];
  for (const receipt of snapshot.localReceipts) {
    lines.push(`| ${receipt.id} | ${receipt.evidenceTier} | ${receipt.ok} | ${receipt.claim} | ${receipt.path} |`);
  }
  lines.push("", "## Boundary", "");
  for (const item of snapshot.blockedOrNotExecuted) lines.push(`- ${item}`);
  lines.push("", "## Claim Boundary", "", snapshot.claimBoundary, "");
  if (snapshot.koNextSummaryText) {
    lines.push("## KO Next Summary", "", "```text", snapshot.koNextSummaryText, "```", "");
  }
  return `${lines.join("\n")}\n`;
}

async function runLocalEvidenceSnapshotCheck(options) {
  const snapshotPath = options.localEvidenceOut;
  if (!existsSync(snapshotPath)) {
    throw new Error(`Missing local evidence snapshot: ${snapshotPath}. Run npm run next:local-evidence first.`);
  }
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  const currentRevision = readCurrentRevisionSync();
  assertLocalEvidenceSnapshotFresh(snapshot, currentRevision);
  await assertLocalEvidenceOutputsFresh(snapshot, currentRevision);
  console.log(`next_major_local_evidence_snapshot_check_ok ${snapshotPath}`);
}

function assertLocalEvidenceSnapshotFresh(snapshot, currentRevision) {
  assert.equal(snapshot.schema, LOCAL_EVIDENCE_SNAPSHOT_SCHEMA, "local evidence snapshot schema");
  assert.equal(snapshot.evidenceTier, "NEXT_MAJOR_LOCAL_EVIDENCE_SNAPSHOT_ONLY", "local evidence snapshot evidence tier");
  assert.equal(snapshot.canClaimNextMajorFromThisSnapshot, false, "local evidence snapshot must not claim next-major readiness");
  assert.equal(snapshot.releaseActionAuthorized, false, "local evidence snapshot must not authorize release");
  assert.equal(currentRevision.gitAvailable, true, "git revision must be available for local evidence snapshot check");
  assert.equal(currentRevision.dirtyWorktree, false, "local evidence snapshot check must run from a clean worktree");
  assert.equal(currentRevision.statusLineCount, 0, "local evidence snapshot check must run from a clean git status");
  assert.equal(snapshot.currentRevision?.gitHead, currentRevision.gitHead, "local evidence snapshot git HEAD must match current HEAD");
  assert.equal(snapshot.currentRevision?.dirtyWorktree, false, "local evidence snapshot must have been created from a clean worktree");
  assert.equal(snapshot.currentRevision?.statusLineCount, 0, "local evidence snapshot must have been created from a clean git status");
  for (const [key, label] of SNAPSHOT_REQUIRED_OUTPUTS) {
    const outputPath = snapshot.outputs?.[key] || "";
    assert.ok(outputPath && outputPath !== "TBD", `local evidence snapshot ${label} output path must be present`);
    assert.ok(existsSync(outputPath), `local evidence snapshot ${label} output does not exist: ${outputPath}`);
  }
  assert.deepEqual(
    (Array.isArray(snapshot.blockedOrNotExecuted) ? snapshot.blockedOrNotExecuted : []),
    LOCAL_EVIDENCE_BLOCKED_OR_NOT_EXECUTED,
    "local evidence snapshot boundary list must remain explicit and non-claiming"
  );
  const receipts = Array.isArray(snapshot.localReceipts) ? snapshot.localReceipts : [];
  assert.equal(
    receipts.length,
    EXPECTED_LOCAL_RECEIPT_IDS.length,
    "local evidence snapshot must not contain duplicate or extra local receipts"
  );
  const receiptById = new Map(receipts.map((receipt) => [receipt.id, receipt]));
  assert.deepEqual(
    [...receiptById.keys()].sort(),
    [...EXPECTED_LOCAL_RECEIPT_IDS].sort(),
    "local evidence snapshot must list exactly the expected local receipts"
  );
  for (const id of EXPECTED_LOCAL_RECEIPT_IDS) {
    const receipt = receiptById.get(id);
    assert.equal(receipt.ok, true, `${id} receipt must be ok`);
    assert.ok(receipt.path, `${id} receipt path must be present`);
    assert.ok(existsSync(receipt.path), `${id} receipt path does not exist: ${receipt.path}`);
    assert.ok(receipt.evidenceTier, `${id} receipt evidence tier must be present`);
    assert.match(
      String(receipt.claim || ""),
      /^(?:doesNotProve=\d+|no-dogfood-claim|canClaim[A-Za-z0-9]+=false)$/,
      `${id} receipt claim boundary must be explicit and non-claiming`
    );
  }
}

async function assertLocalEvidenceOutputsFresh(snapshot, currentRevision) {
  const outputs = snapshot.outputs || {};
  const publicDryRun = await readJsonOutput(outputs.publicDryRunReceipt, "public dry-run receipt");
  assert.equal(publicDryRun.schema, PUBLIC_DRY_RUN_RECEIPT_SCHEMA, "public dry-run receipt schema");
  assert.equal(publicDryRun.evidenceTier, "PUBLIC_SOURCE_DRY_RUN", "public dry-run receipt evidence tier");
  assert.equal(publicDryRun.publicSourceDryRun, true, "public dry-run receipt must remain a dry-run");
  assert.equal(publicDryRun.canClaimExternalKo, false, "public dry-run receipt must not claim external KO");
  assertCleanAppRevision(publicDryRun.runContext?.appRevision, currentRevision, "public dry-run receipt");
  assert.equal(publicDryRun.runContext?.browser?.profileRetained, false, "public dry-run receipt must not retain browser profile");
  assert.equal(publicDryRun.runContext?.browser?.profileCleanup?.ok, true, "public dry-run receipt browser profile cleanup must pass");

  const approvalRequest = await readJsonOutput(outputs.sourceApprovalRequest, "source approval request");
  assert.equal(approvalRequest.schema, SOURCE_APPROVAL_REQUEST_SCHEMA, "source approval request schema");
  assert.equal(approvalRequest.evidenceTier, "SOURCE_APPROVAL_REQUEST_ONLY", "source approval request evidence tier");
  assert.equal(approvalRequest.canClaimExternalKo, false, "source approval request must not claim external KO");
  assert.equal(approvalRequest.basis?.type, "PUBLIC_SOURCE_DRY_RUN_RECEIPT", "source approval request basis type");
  assertOutputPathMatches(
    approvalRequest.basis?.priorDryRunReceipt || approvalRequest.basis?.inputPath,
    outputs.publicDryRunReceipt,
    "source approval request basis receipt"
  );
  assert.equal(approvalRequest.basis?.priorDryRun?.gitHead, currentRevision.gitHead, "source approval request basis git HEAD must match current HEAD");
  assert.equal(approvalRequest.basis?.priorDryRun?.dirtyWorktree, false, "source approval request basis must be clean");
  assert.equal(approvalRequest.basis?.priorDryRun?.profileRetained, false, "source approval request basis must not retain browser profile");
  assert.equal(approvalRequest.basis?.priorDryRun?.profileCleanupOk, true, "source approval request basis profile cleanup must pass");

  const readiness = await readJsonOutput(outputs.readinessPacket, "readiness packet");
  assert.equal(readiness.schema, NEXT_MAJOR_READINESS_SCHEMA, "readiness packet schema");
  assert.equal(readiness.evidenceTier, "NEXT_MAJOR_READINESS_SUMMARY_ONLY", "readiness packet evidence tier");
  assert.equal(readiness.canClaimNextMajorPreReleaseReady, false, "readiness packet must not claim next-major readiness");
  assert.equal(readiness.releaseActionAuthorized, false, "readiness packet must not authorize release");
  assertCleanCurrentRevision(readiness.currentRevision, currentRevision, "readiness packet");
  assertFreshness(readiness.koStatusFreshness, CURRENT_CLEAN_HEAD_KO_STATUS, currentRevision, "readiness KO status freshness", {
    requireBasisRevision: true,
    requireBasisStatusLineCount: true
  });

  const platformHandoff = await readJsonOutput(outputs.platformQaHandoff, "platform QA handoff");
  assert.equal(platformHandoff.schema, PLATFORM_QA_HANDOFF_SCHEMA, "platform QA handoff schema");
  assert.equal(platformHandoff.evidenceTier, "PLATFORM_QA_HANDOFF_ONLY", "platform QA handoff evidence tier");
  assert.equal(platformHandoff.canClaimKo, false, "platform QA handoff must not claim KO");
  assertCleanCurrentRevision(platformHandoff.currentRevision, currentRevision, "platform QA handoff");
  assert.equal(platformHandoff.executionFreshness?.status, CURRENT_CLEAN_HEAD_PLATFORM_QA_HANDOFF, "platform QA handoff execution freshness status");
  assertFreshness(platformHandoff.koStatusFreshness, CURRENT_CLEAN_HEAD_KO_STATUS, currentRevision, "platform handoff KO status freshness", {
    requireBasisRevision: true,
    requireBasisStatusLineCount: true
  });

  const platformEvidenceScaffold = await readJsonOutput(outputs.platformQaEvidenceScaffold, "platform QA evidence scaffold");
  assert.equal(platformEvidenceScaffold.schema, PLATFORM_QA_EVIDENCE_SCAFFOLD_SCHEMA, "platform QA evidence scaffold schema");
  assert.equal(platformEvidenceScaffold.evidenceTier, "PLATFORM_QA_EVIDENCE_SCAFFOLD_ONLY", "platform QA evidence scaffold tier");
  assert.equal(platformEvidenceScaffold.canClaimKo, false, "platform QA evidence scaffold must not claim KO");
  assert.equal(platformEvidenceScaffold.canClaimPlatformQa, false, "platform QA evidence scaffold must not claim platform QA");
  assertCleanCurrentRevision(platformEvidenceScaffold.currentRevision, currentRevision, "platform QA evidence scaffold");
  assert.equal(platformEvidenceScaffold.handoffGitHead, currentRevision.gitHead, "platform QA evidence scaffold handoff git HEAD must match current HEAD");
  assert.equal(Number(platformEvidenceScaffold.summary?.screenshotsCreated || 0), 0, "platform QA evidence scaffold must not create screenshots");
  assertOutputPathMatches(platformEvidenceScaffold.platformHandoffPath, outputs.platformQaHandoff, "platform QA evidence scaffold handoff");

  const operator = await readJsonOutput(outputs.operatorPacket, "operator packet");
  assert.equal(operator.schema, NEXT_MAJOR_OPERATOR_PACKET_SCHEMA, "operator packet schema");
  assert.equal(operator.evidenceTier, "NEXT_MAJOR_OPERATOR_PACKET_ONLY", "operator packet evidence tier");
  assert.equal(operator.canClaimNextMajorFromThisPacket, false, "operator packet must not claim next-major readiness");
  assert.equal(operator.releaseActionAuthorized, false, "operator packet must not authorize release");
  assertCleanCurrentRevision(operator.currentRevision, currentRevision, "operator packet");
  assertFreshness(operator.readinessFreshness, CURRENT_CLEAN_NEXT_MAJOR_READINESS, currentRevision, "operator readiness freshness", {
    requireBasisRevision: true,
    requireBasisStatusLineCount: true
  });
  assertFreshness(operator.platformHandoffFreshness, CURRENT_CLEAN_PLATFORM_QA_HANDOFF, currentRevision, "operator platform handoff freshness", {
    requireBasisRevision: true,
    requireBasisStatusLineCount: true
  });

  const koNext = await readJsonOutput(outputs.koNextActionSummary, "KO next action summary");
  assert.equal(koNext.schema, KO_NEXT_ACTION_SUMMARY_SCHEMA, "KO next action summary schema");
  assert.equal(koNext.evidenceTier, "KO_NEXT_ACTION_SUMMARY_ONLY", "KO next action summary evidence tier");
  assert.equal(koNext.canClaimKoFromThisArtifact, false, "KO next action summary must not claim KO");
  assert.equal(koNext.releaseActionAuthorized, false, "KO next action summary must not authorize release");
  assertFreshness(koNext.sourceApproval?.freshness, CURRENT_CLEAN_PUBLIC_DRY_RUN, currentRevision, "KO next source approval freshness", {
    requireBasisRevision: true,
    requireSourceApprovalBasis: true
  });
  assertFreshness(koNext.operator?.freshness, CURRENT_CLEAN_OPERATOR_PACKET, currentRevision, "KO next operator freshness", {
    requirePacketRevision: true,
    requirePacketStatusLineCount: true
  });
  assertFreshness(koNext.operator?.readinessFreshness, CURRENT_CLEAN_NEXT_MAJOR_READINESS, currentRevision, "KO next readiness freshness", {
    requireBasisRevision: true,
    requireBasisStatusLineCount: true
  });
  assertFreshness(koNext.operator?.platformHandoffFreshness, CURRENT_CLEAN_PLATFORM_QA_HANDOFF, currentRevision, "KO next platform handoff freshness", {
    requireBasisRevision: true,
    requireBasisStatusLineCount: true
  });
  assertOutputPathMatches(
    koNext.sourceApproval?.freshness?.basisReceiptPath,
    outputs.publicDryRunReceipt,
    "KO next source approval basis receipt"
  );
}

async function readJsonOutput(path, label) {
  assert.ok(path && path !== "TBD", `${label} path must be present`);
  return JSON.parse(await readFile(path, "utf8"));
}

function assertCleanCurrentRevision(revision, currentRevision, label) {
  assert.equal(revision?.gitAvailable, true, `${label} git state must be available`);
  assert.equal(revision?.gitHead, currentRevision.gitHead, `${label} git HEAD must match current HEAD`);
  assert.equal(revision?.dirtyWorktree, false, `${label} must be clean`);
  assert.equal(revision?.statusLineCount, 0, `${label} status line count must be zero`);
}

function assertCleanAppRevision(revision, currentRevision, label) {
  assert.equal(revision?.gitHead, currentRevision.gitHead, `${label} git HEAD must match current HEAD`);
  assert.equal(revision?.dirtyWorktree, false, `${label} must be clean`);
  assert.equal(revision?.statusLineCount || 0, 0, `${label} status line count must be zero`);
}

function assertFreshness(freshness, expectedStatus, currentRevision, label, options = {}) {
  assert.equal(freshness?.status, expectedStatus, `${label} status`);
  assert.equal(freshness?.currentGitHead, currentRevision.gitHead, `${label} current git HEAD must match current HEAD`);
  assert.equal(freshness?.currentDirtyWorktree, false, `${label} current worktree must be clean`);
  if (options.requireBasisRevision) {
    assert.equal(freshness.basisGitHead, currentRevision.gitHead, `${label} basis git HEAD must match current HEAD`);
    assert.equal(freshness.basisDirtyWorktree, false, `${label} basis worktree must be clean`);
  }
  if (options.requireBasisStatusLineCount) {
    assert.equal(freshness.basisStatusLineCount, 0, `${label} basis status line count must be zero`);
  }
  if (options.requirePacketRevision) {
    assert.equal(freshness.packetGitHead, currentRevision.gitHead, `${label} packet git HEAD must match current HEAD`);
    assert.equal(freshness.packetDirtyWorktree, false, `${label} packet worktree must be clean`);
  }
  if (options.requirePacketStatusLineCount) {
    assert.equal(freshness.packetStatusLineCount, 0, `${label} packet status line count must be zero`);
  }
  if (options.requireSourceApprovalBasis) {
    assert.equal(freshness.basisProfileCleanupOk, true, `${label} basis profile cleanup must pass`);
    assert.equal(freshness.basisProfileRetained, false, `${label} basis profile must not be retained`);
  }
  assert.equal(Array.isArray(freshness?.problems) ? freshness.problems.length : 0, 0, `${label} problems must be empty`);
}

function assertOutputPathMatches(actualPath, expectedPath, label) {
  assert.equal(resolve(String(actualPath || "")), resolve(String(expectedPath || "")), `${label} path must match local evidence snapshot`);
}

function buildSuccessSummary(plan, publicDryRunReceipt, outputs, localReceipts) {
  const koNext = outputs.find((item) => item.id === "print-ko-next")?.stdout.trim() || "";
  const lines = [
    "next_major_local_evidence_refresh_ok",
    `Git HEAD: ${plan.currentRevision.gitHead}`,
    `Public dry-run receipt: ${publicDryRunReceipt || "TBD"}`,
    `Source approval request: ${plan.options.sourceApprovalRequest}`,
    `Readiness packet: ${plan.options.readinessOut}`,
    `Platform QA handoff: ${plan.options.platformHandoffOut}`,
    `Platform QA evidence scaffold: ${plan.options.platformEvidenceScaffoldOut}`,
    `Operator packet: ${plan.options.operatorOut}`,
    `KO next action summary: ${plan.options.koNextOut}`,
    `Local evidence snapshot: ${plan.options.localEvidenceOut}`,
    `Local evidence snapshot markdown: ${plan.options.localEvidenceMarkdownOut}`,
    "",
    "Local receipt summary:"
  ];
  for (const receipt of localReceipts) {
    lines.push(`- ${receipt.id}: tier=${receipt.evidenceTier}; ok=${receipt.ok}; claim=${receipt.claim}; receipt=${receipt.path}`);
  }
  lines.push(
    "",
    "Boundary:"
  );
  for (const item of plan.blockedOrNotExecuted) lines.push(`- ${item}`);
  if (koNext) lines.push("", "KO next summary:", "", koNext);
  return `${lines.join("\n")}\n`;
}

async function collectLocalReceiptSummaries(outputs) {
  const staticOutput = outputs.find((item) => item.id === "refresh-static-return-contract")?.stdout || "";
  const staticMatch = staticOutput.match(STATIC_RETURN_RECEIPT_PATTERN);
  const staticPath = staticMatch?.[1]?.trim() || "";
  const entries = [
    { id: "staticReturn", path: staticPath },
    { id: "returnImport", path: LOCAL_RECEIPT_PATHS.returnImport },
    { id: "dogfoodPending", path: LOCAL_RECEIPT_PATHS.dogfood },
    { id: "macManualPending", path: LOCAL_RECEIPT_PATHS.macPending },
    { id: "windowsStaticPending", path: LOCAL_RECEIPT_PATHS.windowsPending },
    { id: "harmonyDevicePending", path: LOCAL_RECEIPT_PATHS.harmonyPending }
  ];
  const summaries = [];
  for (const entry of entries) {
    if (!entry.path) throw new Error(`Missing local receipt path for ${entry.id}`);
    if (!existsSync(entry.path)) throw new Error(`Local receipt was not written for ${entry.id}: ${entry.path}`);
    const receipt = JSON.parse(await readFile(entry.path, "utf8"));
    summaries.push({
      id: entry.id,
      path: entry.path,
      evidenceTier: receipt.evidenceTier || "UNKNOWN",
      ok: receipt.summary?.ok === true,
      claim: summarizeClaimBoundary(receipt)
    });
  }
  return summaries;
}

function summarizeClaimBoundary(receipt) {
  const claim = receipt.claimBoundary || {};
  if (claim.canClaimMacDogfoodUsable === false && claim.canClaimManualDeviceLoopUsable === false) {
    return "no-dogfood-claim";
  }
  for (const [key, value] of Object.entries(claim)) {
    if (/^canClaim/.test(key) && value === false) return `${key}=false`;
  }
  if (Array.isArray(receipt.boundaries?.doesNotProve) && receipt.boundaries.doesNotProve.length > 0) {
    return `doesNotProve=${receipt.boundaries.doesNotProve.length}`;
  }
  return "TBD";
}

function buildDryRunSummary(plan) {
  const lines = [
    "next_major_local_evidence_refresh_dry_run",
    `Git HEAD: ${plan.currentRevision.gitHead}`,
    `Reading URL: ${plan.sourceApproval.readingUrl}`,
    `Video URL: ${plan.sourceApproval.videoUrl}`,
    `Video timestamp: ${plan.sourceApproval.videoTimestamp}`,
    "",
    "Commands that would run in strict order:"
  ];
  for (const command of plan.commands) {
    if (command.argvFrom === "publicDryRunReceipt") {
      lines.push(`- ${command.id}: node scripts/external-source-validation-browser.mjs --approval-request --dry-run-receipt <fresh-public-dry-run-receipt.json> --out ${plan.options.sourceApprovalRequest} --markdown-out ${plan.options.sourceApprovalMarkdown}`);
    } else {
      lines.push(`- ${command.id}: ${formatNodeCommand(command.argv)}`);
    }
  }
  lines.push("", "Boundary:");
  for (const item of plan.blockedOrNotExecuted) lines.push(`- ${item}`);
  return `${lines.join("\n")}\n`;
}

function formatNodeCommand(argv) {
  return ["node", ...argv].map(shellQuote).join(" ");
}

function buildCustomPlatformReceiptArgv(platformReceiptPaths = {}) {
  const macManual = platformReceiptPaths.macManual || DEFAULTS.macManual;
  const windowsStatic = platformReceiptPaths.windowsStatic || DEFAULTS.windowsStatic;
  const harmonyDevice = platformReceiptPaths.harmonyDevice || DEFAULTS.harmonyDevice;
  if (macManual === DEFAULTS.macManual
    && windowsStatic === DEFAULTS.windowsStatic
    && harmonyDevice === DEFAULTS.harmonyDevice) {
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

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(text)) return text;
  return `'${text.replace(/'/g, "'\\''")}'`;
}

async function runSelfTest() {
  const request = {
    schema: "learning-companion.external-source-approval-request.v1",
    evidenceTier: "SOURCE_APPROVAL_REQUEST_ONLY",
    canClaimExternalKo: false,
    sources: {
      reading: { url: "https://example.org/reading" },
      video: { url: "https://example.org/video.mp4", timestamp: "00:03" }
    }
  };
  const plan = {
    currentRevision: {
      gitAvailable: true,
      gitHead: "0123456789abcdef0123456789abcdef01234567",
      dirtyWorktree: false,
      statusLineCount: 0
    },
    options: normalizeOptions({
      "mac-manual": "custom mac.json",
      "windows-static": "custom windows.json",
      "harmony-device": "custom harmony.json",
      "local-evidence-out": ".codex-tmp/selftest/local evidence.json",
      "local-evidence-markdown-out": ".codex-tmp/selftest/local evidence.md"
    }),
    sourceApproval: {
      path: DEFAULTS.sourceApprovalRequest,
      readingUrl: request.sources.reading.url,
      videoUrl: request.sources.video.url,
      videoTimestamp: request.sources.video.timestamp
    },
    commands: [
      { id: "refresh-bilingual-runtime", argv: ["scripts/smoke-bilingual-runtime-browser.mjs"] },
      { id: "refresh-controlled-loop", argv: ["scripts/agent-study-loop-check.mjs", "--out", ".codex-tmp/agent-study-loop-smoke/receipt.json"] },
      { id: "refresh-static-return-contract", argv: ["scripts/static-return-loop-check.mjs"] },
      { id: "refresh-return-import-dry-run", argv: ["scripts/return-file-import-dry-run.mjs", "--workspace", "dist/morning-demo/sample-workspace.json", "--return-file", "dist/morning-demo/patches/sample-mobile-inbox-patch.json", "--return-file", "dist/morning-demo/patches/sample-review-progress-patch.json", "--out", ".codex-tmp/return-import-dry-run/receipt.json"] },
      { id: "refresh-dogfood-runbook-pending", argv: ["scripts/validate-dogfood-runbook.mjs", "--runbook", "dist/morning-demo/DOGFOOD_RUNBOOK.md", "--out", ".codex-tmp/dogfood-runbook/receipt.json"] },
      { id: "refresh-mac-manual-pending", argv: ["scripts/validate-mac-manual-qa.mjs", "--qa", "dist/morning-demo/MAC_MANUAL_QA.md", "--out", ".codex-tmp/mac-manual-qa/receipt.json"] },
      { id: "refresh-windows-static-pending", argv: ["scripts/validate-windows-static-qa.mjs", "--qa", "dist/morning-demo/WINDOWS_STATIC_QA.md", "--out", ".codex-tmp/windows-static-qa/receipt.json"] },
      { id: "refresh-harmony-device-pending", argv: ["scripts/validate-harmony-device-qa.mjs", "--qa", "dist/morning-demo/HARMONY_DEVICE_QA.md", "--out", ".codex-tmp/harmony-device-qa/receipt.json"] },
      { id: "refresh-public-source-dry-run", argv: ["scripts/external-source-validation-browser.mjs", "--public-source-dry-run"], capturePublicDryRunReceipt: true },
      { id: "refresh-ko-status", argv: ["scripts/validate-ko-evidence.mjs", "--allow-missing", "--mac-manual", "custom mac.json", "--windows-static", "custom windows.json", "--harmony-device", "custom harmony.json", "--out", DEFAULTS.koStatus] },
      { id: "refresh-readiness", argv: ["scripts/next-major-readiness.mjs", "--status", DEFAULTS.koStatus, "--out", DEFAULTS.readinessOut, "--markdown-out", DEFAULTS.readinessMarkdownOut, "--source-approval-request", DEFAULTS.sourceApprovalRequest, "--source-approval-markdown", DEFAULTS.sourceApprovalMarkdown, "--mac-manual", "custom mac.json", "--windows-static", "custom windows.json", "--harmony-device", "custom harmony.json"] },
      { id: "refresh-platform-qa-handoff", argv: ["scripts/platform-qa-handoff.mjs", "--status", DEFAULTS.koStatus, "--out", DEFAULTS.platformHandoffOut, "--markdown-out", DEFAULTS.platformHandoffMarkdownOut, "--mac-manual", "custom mac.json", "--windows-static", "custom windows.json", "--harmony-device", "custom harmony.json"] },
      { id: "refresh-platform-qa-evidence-scaffold", argv: ["scripts/platform-qa-evidence-scaffold.mjs", "--platform-handoff", DEFAULTS.platformHandoffOut, "--out", DEFAULTS.platformEvidenceScaffoldOut, "--markdown-out", DEFAULTS.platformEvidenceScaffoldMarkdownOut] },
      { id: "regenerate-source-approval-request", argvFrom: "publicDryRunReceipt" },
      { id: "refresh-operator-packet", argv: ["scripts/next-major-operator-packet.mjs", "--status", DEFAULTS.koStatus, "--readiness", DEFAULTS.readinessOut, "--platform-handoff", DEFAULTS.platformHandoffOut, "--source-approval-request", DEFAULTS.sourceApprovalRequest, "--source-approval-markdown", DEFAULTS.sourceApprovalMarkdown, "--mac-manual", "custom mac.json", "--windows-static", "custom windows.json", "--harmony-device", "custom harmony.json"] },
      { id: "print-ko-next", argv: ["scripts/ko-next-action-summary.mjs", "--source-approval-request", DEFAULTS.sourceApprovalRequest, "--source-approval-markdown", DEFAULTS.sourceApprovalMarkdown, "--json-out", DEFAULTS.koNextOut, "--mac-manual", "custom mac.json", "--windows-static", "custom windows.json", "--harmony-device", "custom harmony.json"] }
    ],
    blockedOrNotExecuted: [
      "Does not grant current-turn source approval.",
      "Does not run approved-source browser capture.",
      "Does not perform human privacy review.",
      "Does not run Mac, Windows, or HarmonyOS real platform QA.",
      "Does not build, package, deploy, check Mew-Test/main site, run remote acceptance, or authorize release."
    ]
  };
  assert.deepEqual(plan.commands.map((command) => command.id), [
    "refresh-bilingual-runtime",
    "refresh-controlled-loop",
    "refresh-static-return-contract",
    "refresh-return-import-dry-run",
    "refresh-dogfood-runbook-pending",
    "refresh-mac-manual-pending",
    "refresh-windows-static-pending",
    "refresh-harmony-device-pending",
    "refresh-public-source-dry-run",
    "refresh-ko-status",
    "refresh-readiness",
    "refresh-platform-qa-handoff",
    "refresh-platform-qa-evidence-scaffold",
    "regenerate-source-approval-request",
    "refresh-operator-packet",
    "print-ko-next"
  ]);
  const dryRun = buildDryRunSummary(plan);
  assert.match(dryRun, /next_major_local_evidence_refresh_dry_run/);
  assert.match(dryRun, /refresh-bilingual-runtime/);
  assert.match(dryRun, /refresh-static-return-contract: node scripts\/static-return-loop-check\.mjs/);
  assert.match(dryRun, /refresh-return-import-dry-run: node scripts\/return-file-import-dry-run\.mjs .*--workspace dist\/morning-demo\/sample-workspace\.json/);
  assert.match(dryRun, /refresh-return-import-dry-run: node scripts\/return-file-import-dry-run\.mjs .*--return-file dist\/morning-demo\/patches\/sample-mobile-inbox-patch\.json/);
  assert.match(dryRun, /refresh-return-import-dry-run: node scripts\/return-file-import-dry-run\.mjs .*--return-file dist\/morning-demo\/patches\/sample-review-progress-patch\.json/);
  assert.match(dryRun, /refresh-dogfood-runbook-pending: node scripts\/validate-dogfood-runbook\.mjs .*--runbook dist\/morning-demo\/DOGFOOD_RUNBOOK\.md/);
  assert.match(dryRun, /refresh-mac-manual-pending: node scripts\/validate-mac-manual-qa\.mjs .*--qa dist\/morning-demo\/MAC_MANUAL_QA\.md/);
  assert.match(dryRun, /refresh-windows-static-pending: node scripts\/validate-windows-static-qa\.mjs .*--qa dist\/morning-demo\/WINDOWS_STATIC_QA\.md/);
  assert.match(dryRun, /refresh-harmony-device-pending: node scripts\/validate-harmony-device-qa\.mjs .*--qa dist\/morning-demo\/HARMONY_DEVICE_QA\.md/);
  assert.match(dryRun, /refresh-ko-status/);
  assert.match(dryRun, /refresh-ko-status: node scripts\/validate-ko-evidence\.mjs .*--mac-manual 'custom mac\.json'/);
  assert.match(dryRun, /refresh-readiness/);
  assert.match(dryRun, /next-major-readiness\.mjs/);
  assert.match(dryRun, /refresh-readiness: node scripts\/next-major-readiness\.mjs .*--windows-static 'custom windows\.json'/);
  assert.match(dryRun, /--source-approval-request \.codex-tmp\/external-source-validation\/source-approval-request\.json/);
  assert.match(dryRun, /--source-approval-markdown \.codex-tmp\/external-source-validation\/source-approval-request\.md/);
  assert.match(dryRun, /refresh-platform-qa-handoff/);
  assert.match(dryRun, /platform-qa-handoff\.mjs/);
  assert.match(dryRun, /refresh-platform-qa-handoff: node scripts\/platform-qa-handoff\.mjs .*--harmony-device 'custom harmony\.json'/);
  assert.match(dryRun, /refresh-platform-qa-evidence-scaffold: node scripts\/platform-qa-evidence-scaffold\.mjs .*--platform-handoff \.codex-tmp\/platform-qa-handoff\/current\.json/);
  assert.match(dryRun, /regenerate-source-approval-request/);
  assert.match(dryRun, /fresh-public-dry-run-receipt\.json/);
  assert.match(dryRun, /refresh-operator-packet: node scripts\/next-major-operator-packet\.mjs/);
  assert.match(dryRun, /refresh-operator-packet: node scripts\/next-major-operator-packet\.mjs .*--source-approval-request \.codex-tmp\/external-source-validation\/source-approval-request\.json/);
  assert.match(dryRun, /refresh-operator-packet: node scripts\/next-major-operator-packet\.mjs .*--source-approval-markdown \.codex-tmp\/external-source-validation\/source-approval-request\.md/);
  assert.match(dryRun, /refresh-operator-packet: node scripts\/next-major-operator-packet\.mjs .*--mac-manual 'custom mac\.json'/);
  assert.match(dryRun, /print-ko-next: node scripts\/ko-next-action-summary\.mjs .*--source-approval-request \.codex-tmp\/external-source-validation\/source-approval-request\.json/);
  assert.match(dryRun, /print-ko-next: node scripts\/ko-next-action-summary\.mjs .*--source-approval-markdown \.codex-tmp\/external-source-validation\/source-approval-request\.md/);
  assert.match(dryRun, /print-ko-next: node scripts\/ko-next-action-summary\.mjs .*--json-out \.codex-tmp\/ko-next\/current\.json/);
  assert.match(dryRun, /print-ko-next: node scripts\/ko-next-action-summary\.mjs .*--windows-static 'custom windows\.json'/);
  assert.match(dryRun, /Does not run approved-source browser capture/);
  assert.doesNotMatch(dryRun, /--approved-current-turn/);
  assert.match(dryRun, /Does not build, package, deploy/);
  assert.match(dryRun, /remote acceptance/);
  assert.throws(() => assertSupportedOptions({ external: "custom external.json" }), /--external is not supported by next:local-evidence/);
  const fakeReceipts = [
    {
      id: "dogfoodPending",
      path: ".codex-tmp/dogfood-runbook/receipt.json",
      evidenceTier: "PENDING_USER_GATE",
      ok: true,
      claim: "no-dogfood-claim"
    }
  ];
  const snapshot = buildLocalEvidenceSnapshot(plan, "public-dry-run.json", [{ id: "print-ko-next", stdout: "KO next text" }], fakeReceipts);
  assert.equal(snapshot.schema, LOCAL_EVIDENCE_SNAPSHOT_SCHEMA);
  assert.equal(snapshot.evidenceTier, "NEXT_MAJOR_LOCAL_EVIDENCE_SNAPSHOT_ONLY");
  assert.equal(snapshot.canClaimNextMajorFromThisSnapshot, false);
  assert.equal(snapshot.releaseActionAuthorized, false);
  assert.equal(snapshot.outputs.publicDryRunReceipt, "public-dry-run.json");
  assert.equal(snapshot.outputs.sourceApprovalRequest, DEFAULTS.sourceApprovalRequest);
  assert.equal(snapshot.outputs.platformQaEvidenceScaffold, DEFAULTS.platformEvidenceScaffoldOut);
  assert.equal(snapshot.localReceipts[0].claim, "no-dogfood-claim");
  const snapshotMarkdown = buildLocalEvidenceSnapshotMarkdown(snapshot);
  assert.match(snapshotMarkdown, /Next Major Local Evidence Snapshot/);
  assert.match(snapshotMarkdown, /NEXT_MAJOR_LOCAL_EVIDENCE_SNAPSHOT_ONLY/);
  assert.match(snapshotMarkdown, /no-dogfood-claim/);
  assert.match(snapshotMarkdown, /Does not run approved-source browser capture/);
  assert.throws(
    () => assertLocalEvidenceSnapshotFresh(snapshot, { gitAvailable: true, gitHead: "different", dirtyWorktree: false, statusLineCount: 0 }),
    /git HEAD must match current HEAD/
  );
  const cleanRevision = {
    gitAvailable: true,
    gitHead: plan.currentRevision.gitHead,
    dirtyWorktree: false,
    statusLineCount: 0
  };
  const selfTestOutputDir = resolve(".codex-tmp/selftest/local-evidence-outputs");
  const publicDryRunPath = resolve(selfTestOutputDir, "public-dry-run.json");
  const sourceApprovalRequestPath = resolve(selfTestOutputDir, "source-approval-request.json");
  const readinessPath = resolve(selfTestOutputDir, "readiness.json");
  const platformHandoffPath = resolve(selfTestOutputDir, "platform-handoff.json");
  const platformEvidenceScaffoldPath = resolve(selfTestOutputDir, "platform-evidence-scaffold.json");
  const operatorPath = resolve(selfTestOutputDir, "operator.json");
  const koNextPath = resolve(selfTestOutputDir, "ko-next.json");
  const sourceApprovalMarkdownPath = resolve(selfTestOutputDir, "source-approval-request.md");
  const readinessMarkdownPath = resolve(selfTestOutputDir, "readiness.md");
  const platformHandoffMarkdownPath = resolve(selfTestOutputDir, "platform-handoff.md");
  const platformEvidenceScaffoldMarkdownPath = resolve(selfTestOutputDir, "platform-evidence-scaffold.md");
  const operatorMarkdownPath = resolve(selfTestOutputDir, "operator.md");
  const publicDryRunFixture = {
    schema: PUBLIC_DRY_RUN_RECEIPT_SCHEMA,
    evidenceTier: "PUBLIC_SOURCE_DRY_RUN",
    publicSourceDryRun: true,
    canClaimExternalKo: false,
    runContext: {
      appRevision: {
        gitHead: cleanRevision.gitHead,
        dirtyWorktree: false,
        statusLineCount: 0
      },
      browser: {
        profileRetained: false,
        profileCleanup: { ok: true }
      }
    }
  };
  const sourceApprovalRequestFixture = {
    schema: SOURCE_APPROVAL_REQUEST_SCHEMA,
    evidenceTier: "SOURCE_APPROVAL_REQUEST_ONLY",
    canClaimExternalKo: false,
    basis: {
      type: "PUBLIC_SOURCE_DRY_RUN_RECEIPT",
      priorDryRunReceipt: publicDryRunPath,
      priorDryRun: {
        gitHead: cleanRevision.gitHead,
        dirtyWorktree: false,
        profileRetained: false,
        profileCleanupOk: true
      }
    }
  };
  const readinessFixture = {
    schema: NEXT_MAJOR_READINESS_SCHEMA,
    evidenceTier: "NEXT_MAJOR_READINESS_SUMMARY_ONLY",
    canClaimNextMajorPreReleaseReady: false,
    releaseActionAuthorized: false,
    currentRevision: cleanRevision,
    koStatusFreshness: {
      status: CURRENT_CLEAN_HEAD_KO_STATUS,
      currentGitHead: cleanRevision.gitHead,
      currentDirtyWorktree: false,
      basisGitHead: cleanRevision.gitHead,
      basisDirtyWorktree: false,
      basisStatusLineCount: 0,
      problems: []
    }
  };
  const platformHandoffFixture = {
    schema: PLATFORM_QA_HANDOFF_SCHEMA,
    evidenceTier: "PLATFORM_QA_HANDOFF_ONLY",
    canClaimKo: false,
    currentRevision: cleanRevision,
    executionFreshness: {
      status: CURRENT_CLEAN_HEAD_PLATFORM_QA_HANDOFF
    },
    koStatusFreshness: {
      status: CURRENT_CLEAN_HEAD_KO_STATUS,
      currentGitHead: cleanRevision.gitHead,
      currentDirtyWorktree: false,
      basisGitHead: cleanRevision.gitHead,
      basisDirtyWorktree: false,
      basisStatusLineCount: 0,
      problems: []
    }
  };
  const platformEvidenceScaffoldFixture = {
    schema: PLATFORM_QA_EVIDENCE_SCAFFOLD_SCHEMA,
    evidenceTier: "PLATFORM_QA_EVIDENCE_SCAFFOLD_ONLY",
    canClaimKo: false,
    canClaimPlatformQa: false,
    platformHandoffPath,
    handoffGitHead: cleanRevision.gitHead,
    currentRevision: cleanRevision,
    summary: {
      platforms: 1,
      rows: 1,
      notesCreated: 1,
      notesSkippedExisting: 0,
      screenshotTodoCreated: 1,
      screenshotTodoSkippedExisting: 0,
      screenshotsCreated: 0
    },
    platforms: [
      {
        id: "nativeMacManualQa",
        label: "Native Mac manual QA",
        suggestedEvidenceRoot: ".codex-tmp/platform-qa-evidence/nativeMacManualQa/0123456789abcdef0123456789abcdef01234567",
        rowsScaffolded: 1,
        rows: [
          {
            row: 1,
            area: "Launch",
            notesPath: ".codex-tmp/platform-qa-evidence/nativeMacManualQa/0123456789abcdef0123456789abcdef01234567/01-launch/notes.md",
            screenshotPath: ".codex-tmp/platform-qa-evidence/nativeMacManualQa/0123456789abcdef0123456789abcdef01234567/01-launch/screenshot.png",
            screenshotCreated: false
          }
        ]
      }
    ]
  };
  const operatorFixture = {
    schema: NEXT_MAJOR_OPERATOR_PACKET_SCHEMA,
    evidenceTier: "NEXT_MAJOR_OPERATOR_PACKET_ONLY",
    canClaimNextMajorFromThisPacket: false,
    releaseActionAuthorized: false,
    currentRevision: cleanRevision,
    readinessFreshness: {
      status: CURRENT_CLEAN_NEXT_MAJOR_READINESS,
      currentGitHead: cleanRevision.gitHead,
      currentDirtyWorktree: false,
      basisGitHead: cleanRevision.gitHead,
      basisDirtyWorktree: false,
      basisStatusLineCount: 0,
      problems: []
    },
    platformHandoffFreshness: {
      status: CURRENT_CLEAN_PLATFORM_QA_HANDOFF,
      currentGitHead: cleanRevision.gitHead,
      currentDirtyWorktree: false,
      basisGitHead: cleanRevision.gitHead,
      basisDirtyWorktree: false,
      basisStatusLineCount: 0,
      problems: []
    }
  };
  const koNextFixture = {
    schema: KO_NEXT_ACTION_SUMMARY_SCHEMA,
    evidenceTier: "KO_NEXT_ACTION_SUMMARY_ONLY",
    canClaimKoFromThisArtifact: false,
    releaseActionAuthorized: false,
    sourceApproval: {
      freshness: {
        status: CURRENT_CLEAN_PUBLIC_DRY_RUN,
        currentGitHead: cleanRevision.gitHead,
        currentDirtyWorktree: false,
        basisGitHead: cleanRevision.gitHead,
        basisDirtyWorktree: false,
        basisProfileCleanupOk: true,
        basisProfileRetained: false,
        basisReceiptPath: publicDryRunPath,
        problems: []
      }
    },
    operator: {
      freshness: {
        status: CURRENT_CLEAN_OPERATOR_PACKET,
        currentGitHead: cleanRevision.gitHead,
        currentDirtyWorktree: false,
        packetGitHead: cleanRevision.gitHead,
        packetDirtyWorktree: false,
        packetStatusLineCount: 0,
        problems: []
      },
      readinessFreshness: {
        status: CURRENT_CLEAN_NEXT_MAJOR_READINESS,
        currentGitHead: cleanRevision.gitHead,
        currentDirtyWorktree: false,
        basisGitHead: cleanRevision.gitHead,
        basisDirtyWorktree: false,
        basisStatusLineCount: 0,
        problems: []
      },
      platformHandoffFreshness: {
        status: CURRENT_CLEAN_PLATFORM_QA_HANDOFF,
        currentGitHead: cleanRevision.gitHead,
        currentDirtyWorktree: false,
        basisGitHead: cleanRevision.gitHead,
        basisDirtyWorktree: false,
        basisStatusLineCount: 0,
        problems: []
      }
    }
  };
  await Promise.all([
    writePrivateFile(publicDryRunPath, `${JSON.stringify(publicDryRunFixture, null, 2)}\n`),
    writePrivateFile(sourceApprovalRequestPath, `${JSON.stringify(sourceApprovalRequestFixture, null, 2)}\n`),
    writePrivateFile(readinessPath, `${JSON.stringify(readinessFixture, null, 2)}\n`),
    writePrivateFile(platformHandoffPath, `${JSON.stringify(platformHandoffFixture, null, 2)}\n`),
    writePrivateFile(platformEvidenceScaffoldPath, `${JSON.stringify(platformEvidenceScaffoldFixture, null, 2)}\n`),
    writePrivateFile(operatorPath, `${JSON.stringify(operatorFixture, null, 2)}\n`),
    writePrivateFile(koNextPath, `${JSON.stringify(koNextFixture, null, 2)}\n`),
    writePrivateFile(sourceApprovalMarkdownPath, "source approval request\n"),
    writePrivateFile(readinessMarkdownPath, "readiness\n"),
    writePrivateFile(platformHandoffMarkdownPath, "platform handoff\n"),
    writePrivateFile(platformEvidenceScaffoldMarkdownPath, "platform evidence scaffold\n"),
    writePrivateFile(operatorMarkdownPath, "operator\n")
  ]);
  const outputBackedSnapshot = {
    ...snapshot,
    outputs: {
      publicDryRunReceipt: publicDryRunPath,
      sourceApprovalRequest: sourceApprovalRequestPath,
      sourceApprovalMarkdown: sourceApprovalMarkdownPath,
      readinessPacket: readinessPath,
      readinessMarkdown: readinessMarkdownPath,
      platformQaHandoff: platformHandoffPath,
      platformQaHandoffMarkdown: platformHandoffMarkdownPath,
      platformQaEvidenceScaffold: platformEvidenceScaffoldPath,
      platformQaEvidenceScaffoldMarkdown: platformEvidenceScaffoldMarkdownPath,
      operatorPacket: operatorPath,
      operatorMarkdown: operatorMarkdownPath,
      koNextActionSummary: koNextPath
    },
    localReceipts: EXPECTED_LOCAL_RECEIPT_IDS.map((id) => ({
      id,
      path: "scripts/refresh-next-major-local-evidence.mjs",
      evidenceTier: id.endsWith("Pending") ? "PENDING_USER_GATE" : "EXECUTED_LOCAL_DRY_RUN",
      ok: true,
      claim: id === "dogfoodPending" ? "no-dogfood-claim" : id.endsWith("Pending") ? "canClaimExample=false" : "doesNotProve=1"
    })),
    blockedOrNotExecuted: [...LOCAL_EVIDENCE_BLOCKED_OR_NOT_EXECUTED]
  };
  assert.doesNotThrow(() => assertLocalEvidenceSnapshotFresh(outputBackedSnapshot, cleanRevision));
  await assertLocalEvidenceOutputsFresh(outputBackedSnapshot, cleanRevision);
  const stalePublicDryRunPath = resolve(selfTestOutputDir, "stale-public-dry-run.json");
  await writePrivateFile(stalePublicDryRunPath, `${JSON.stringify({
    ...publicDryRunFixture,
    runContext: {
      ...publicDryRunFixture.runContext,
      appRevision: {
        ...publicDryRunFixture.runContext.appRevision,
        gitHead: "ffffffffffffffffffffffffffffffffffffffff"
      }
    }
  }, null, 2)}\n`);
  await assert.rejects(
    () => assertLocalEvidenceOutputsFresh({
      ...outputBackedSnapshot,
      outputs: {
        ...outputBackedSnapshot.outputs,
        publicDryRunReceipt: stalePublicDryRunPath
      }
    }, cleanRevision),
    /public dry-run receipt git HEAD must match current HEAD/
  );
  const missingFreshnessHeadKoNextPath = resolve(selfTestOutputDir, "missing-freshness-head-ko-next.json");
  await writePrivateFile(missingFreshnessHeadKoNextPath, `${JSON.stringify({
    ...koNextFixture,
    sourceApproval: {
      freshness: {
        ...koNextFixture.sourceApproval.freshness,
        currentGitHead: undefined
      }
    }
  }, null, 2)}\n`);
  await assert.rejects(
    () => assertLocalEvidenceOutputsFresh({
      ...outputBackedSnapshot,
      outputs: {
        ...outputBackedSnapshot.outputs,
        koNextActionSummary: missingFreshnessHeadKoNextPath
      }
    }, cleanRevision),
    /KO next source approval freshness current git HEAD must match current HEAD/
  );
  console.log("next_major_local_evidence_refresh_selftest_ok");
}

function buildHelp() {
  return `Refresh non-claiming local next-major evidence in the only safe order.

Usage:
  npm run next:local-evidence
  npm run next:local-evidence -- --dry-run
  npm run next:local-evidence -- --mac-manual <mac-receipt.json> --windows-static <windows-receipt.json> --harmony-device <harmony-receipt.json>
  npm run next:local-evidence -- --ko-next-out .codex-tmp/ko-next/current.json
  npm run next:local-evidence -- --platform-evidence-scaffold-out .codex-tmp/platform-qa-evidence/scaffold-summary.json --platform-evidence-scaffold-markdown-out .codex-tmp/platform-qa-evidence/scaffold-summary.md
  npm run next:local-evidence -- --local-evidence-out .codex-tmp/next-major-local-evidence/current.json --local-evidence-markdown-out .codex-tmp/next-major-local-evidence/current.md
  npm run next:local-evidence:check

This command runs local bilingual/browser, controlled-loop, static-return,
return-import, dogfood, and pending platform QA receipts first. It then
refreshes the public-source dry-run, KO status, readiness packet, platform QA
handoff, platform QA evidence scaffold, approval request, operator packet,
KO next summary, and local evidence snapshot JSON/Markdown output.
It does not grant source approval, run approved-source capture, perform
privacy review, run real platform QA, build, deploy, or remote-accept.
It intentionally rejects --external; bind approved external KO evidence with
next:readiness, next:operator, ko:next, or next:finalize instead.`;
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
