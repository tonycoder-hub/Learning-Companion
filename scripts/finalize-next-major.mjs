#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SUBCOMMAND_TIMEOUT_MS = 120_000;

const DEFAULTS = Object.freeze({
  koOut: ".codex-tmp/ko-evidence/final.json",
  readinessOut: ".codex-tmp/next-major-readiness/current.json",
  platformHandoffOut: ".codex-tmp/platform-qa-handoff/current.json",
  operatorOut: ".codex-tmp/next-major-operator/current.json",
  localEvidence: ".codex-tmp/next-major-local-evidence/current.json",
  sourceApprovalRequest: ".codex-tmp/external-source-validation/source-approval-request.json",
  sourceApprovalMarkdown: ".codex-tmp/external-source-validation/source-approval-request.md",
  macManual: ".codex-tmp/mac-manual-qa/real-run-receipt.json",
  windowsStatic: ".codex-tmp/windows-static-qa/real-run-receipt.json",
  harmonyDevice: ".codex-tmp/harmony-device-qa/real-run-receipt.json"
});
const PATH_ARGS = [
  "external",
  "ko-out",
  "readiness-out",
  "platform-handoff-out",
  "operator-out",
  "local-evidence",
  "source-approval-request",
  "source-approval-markdown",
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
if (args["self-test"]) {
  runSelfTest();
} else {
  const options = normalizeOptions(args);
  const plan = buildFinalizePlan(options);
  if (args["dry-run"]) {
    console.log(buildDryRunSummary(plan));
  } else {
    await runFinalizePlan(plan);
  }
}

function normalizeOptions(parsed) {
  if (!parsed.external) {
    throw new Error("--external is required and must point to a privacy-reviewed approved-source KO evidence artifact.");
  }
  const sourceApprovalRequest = String(parsed["source-approval-request"] || DEFAULTS.sourceApprovalRequest);
  const sourceApprovalMarkdown = String(
    parsed["source-approval-markdown"]
      || (sourceApprovalRequest === DEFAULTS.sourceApprovalRequest ? DEFAULTS.sourceApprovalMarkdown : markdownSiblingPath(sourceApprovalRequest))
  );
  return {
    external: String(parsed.external),
    koOut: String(parsed["ko-out"] || DEFAULTS.koOut),
    readinessOut: String(parsed["readiness-out"] || DEFAULTS.readinessOut),
    platformHandoffOut: String(parsed["platform-handoff-out"] || DEFAULTS.platformHandoffOut),
    operatorOut: String(parsed["operator-out"] || DEFAULTS.operatorOut),
    localEvidence: String(parsed["local-evidence"] || DEFAULTS.localEvidence),
    sourceApprovalRequest,
    sourceApprovalMarkdown,
    macManual: String(parsed["mac-manual"] || DEFAULTS.macManual),
    windowsStatic: String(parsed["windows-static"] || DEFAULTS.windowsStatic),
    harmonyDevice: String(parsed["harmony-device"] || DEFAULTS.harmonyDevice)
  };
}

function buildFinalizePlan(options) {
  return {
    options,
    commands: [
      {
        id: "check-local-evidence-snapshot",
        label: "local evidence snapshot freshness",
        argv: [
          "scripts/refresh-next-major-local-evidence.mjs",
          "--check",
          "--local-evidence-out",
          options.localEvidence
        ]
      },
      {
        id: "validate-final-ko",
        label: "final KO evidence",
        argv: [
          "scripts/validate-ko-evidence.mjs",
          "--external",
          options.external,
          "--mac-manual",
          options.macManual,
          "--windows-static",
          options.windowsStatic,
          "--harmony-device",
          options.harmonyDevice,
          "--out",
          options.koOut
        ],
        output: options.koOut
      },
      {
        id: "refresh-readiness",
        label: "next-major readiness",
        argv: [
          "scripts/next-major-readiness.mjs",
          "--status",
          options.koOut,
          "--out",
          options.readinessOut,
          "--markdown-out",
          markdownSiblingPath(options.readinessOut),
          "--source-approval-request",
          options.sourceApprovalRequest,
          "--source-approval-markdown",
          options.sourceApprovalMarkdown,
          "--external",
          options.external,
          "--mac-manual",
          options.macManual,
          "--windows-static",
          options.windowsStatic,
          "--harmony-device",
          options.harmonyDevice
        ],
        output: options.readinessOut
      },
      {
        id: "refresh-platform-handoff",
        label: "platform QA handoff",
        argv: [
          "scripts/platform-qa-handoff.mjs",
          "--status",
          options.koOut,
          "--out",
          options.platformHandoffOut,
          "--markdown-out",
          markdownSiblingPath(options.platformHandoffOut),
          "--mac-manual",
          options.macManual,
          "--windows-static",
          options.windowsStatic,
          "--harmony-device",
          options.harmonyDevice
        ],
        output: options.platformHandoffOut
      },
      {
        id: "refresh-operator-packet",
        label: "next-major operator packet",
        argv: [
          "scripts/next-major-operator-packet.mjs",
          "--status",
          options.koOut,
          "--readiness",
          options.readinessOut,
          "--platform-handoff",
          options.platformHandoffOut,
          "--source-approval-request",
          options.sourceApprovalRequest,
          "--source-approval-markdown",
          options.sourceApprovalMarkdown,
          "--external",
          options.external,
          "--mac-manual",
          options.macManual,
          "--windows-static",
          options.windowsStatic,
          "--harmony-device",
          options.harmonyDevice,
          "--out",
          options.operatorOut,
          "--markdown-out",
          markdownSiblingPath(options.operatorOut)
        ],
        output: options.operatorOut
      }
    ],
    blockedOrNotExecuted: [
      "This finalizer does not grant current-turn source approval.",
      "This finalizer does not perform human privacy review.",
      "This finalizer does not run Mac, Windows, or HarmonyOS QA.",
      "This finalizer does not build, package, deploy, check Mew-Test/main site, run remote acceptance, or authorize release."
    ]
  };
}

async function runFinalizePlan(plan) {
  await assertReadableFile(plan.options.external, "privacy-reviewed external KO evidence artifact");
  await assertReadableFile(plan.options.sourceApprovalRequest, "source approval request");
  const externalClaim = await readJson(plan.options.external);
  const sourceApprovalRequest = await readJson(plan.options.sourceApprovalRequest);
  for (const command of plan.commands) {
    if (command.output) await ensureParentDirectory(command.output);
    await runNodeCommand(command.argv, command.label);
  }
  const ko = await readJson(plan.options.koOut);
  const readiness = await readJson(plan.options.readinessOut);
  const operator = await readJson(plan.options.operatorOut);
  assert.equal(ko.schema, "learning-companion.ko-evidence-review.v1");
  assert.equal(ko.canClaimKo, true, "final KO evidence must be claimable before finalizing next-major packets");
  assert.equal(readiness.schema, "learning-companion.next-major-readiness.v1");
  assert.equal(readiness.canClaimNextMajorPreReleaseReady, true, "readiness packet must be pre-release ready");
  assert.equal(readiness.releaseActionAuthorized, false, "readiness packet must not authorize release");
  assert.equal(operator.schema, "learning-companion.next-major-operator-packet.v1");
  assert.equal(operator.canClaimNextMajorFromThisPacket, false, "operator packet must remain non-claiming");
  assert.equal(operator.releaseActionAuthorized, false, "operator packet must not authorize release");
  assert.equal(operator.readinessFreshness?.status, "CURRENT_CLEAN_NEXT_MAJOR_READINESS", "operator packet readiness freshness must be current");
  assert.equal(operator.platformHandoffFreshness?.status, "CURRENT_CLEAN_PLATFORM_QA_HANDOFF", "operator packet platform handoff freshness must be current");
  assertFinalizerOutputBindings(plan, { ko, externalClaim, sourceApprovalRequest, readiness, operator });
  console.log(buildSuccessSummary(plan, { ko, readiness, operator }));
}

async function runNodeCommand(argv, label) {
  try {
    await execFileAsync(process.execPath, argv, {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024,
      timeout: SUBCOMMAND_TIMEOUT_MS
    });
  } catch (error) {
    const stderr = String(error.stderr || error.message || "").trim();
    throw new Error(`Failed to finalize ${label}: ${stderr || "unknown error"}`);
  }
}

async function assertReadableFile(path, label) {
  try {
    await access(path, constants.R_OK);
  } catch {
    throw new Error(`Missing readable ${label}: ${path}`);
  }
}

async function ensureParentDirectory(path) {
  const directory = resolve(dirname(path));
  await mkdir(directory, { recursive: true, mode: 0o700 });
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function buildSuccessSummary(plan, { ko, readiness, operator }) {
  const lines = [
    "next_major_finalize_ok",
    `Final KO: ${plan.options.koOut}`,
    `KO claimable: ${ko.canClaimKo ? "YES" : "NO"}`,
    `Readiness: ${plan.options.readinessOut}`,
    `Readiness status: ${readiness.readinessStatus || "UNKNOWN"}`,
    `Operator packet: ${plan.options.operatorOut}`,
    `Local evidence snapshot checked: ${plan.options.localEvidence}`,
    `Operator remains non-claiming: ${operator.canClaimNextMajorFromThisPacket === false ? "YES" : "NO"}`,
    "",
    "Boundary:"
  ];
  for (const item of plan.blockedOrNotExecuted) lines.push(`- ${item}`);
  return `${lines.join("\n")}\n`;
}

function assertFinalizerOutputBindings(plan, { ko, externalClaim, sourceApprovalRequest, readiness, operator }) {
  const { options } = plan;
  assertFinalKoOutputBindings(options, { ko, externalClaim, sourceApprovalRequest });
  assert.equal(operator.inputs?.sourceApprovalRequestPath, options.sourceApprovalRequest, "operator packet source approval request path must match finalizer input");
  assert.equal(operator.inputs?.sourceApprovalMarkdownPath, options.sourceApprovalMarkdown, "operator packet source approval markdown path must match finalizer input");
  assert.equal(operator.inputs?.externalEvidencePath, options.external, "operator packet external evidence path must match finalizer input");
  assert.equal(operator.inputs?.platformReceiptPaths?.macManual, options.macManual, "operator packet Mac receipt path must match finalizer input");
  assert.equal(operator.inputs?.platformReceiptPaths?.windowsStatic, options.windowsStatic, "operator packet Windows receipt path must match finalizer input");
  assert.equal(operator.inputs?.platformReceiptPaths?.harmonyDevice, options.harmonyDevice, "operator packet Harmony receipt path must match finalizer input");

  assertCommandHasFlagPath(readiness.nextCommands?.finalizeNextMajor, "--external", options.external, "readiness finalize command");
  assertCommandHasFlagPath(readiness.nextCommands?.finalKoGate, "--external", options.external, "readiness final KO command");
  assertCommandHasFlagPath(readiness.nextCommands?.finalKoGateWithExplicitPlatformReceipts, "--external", options.external, "readiness explicit final KO command");
  assertCommandHasFlagPath(readiness.nextCommands?.finalKoGateWithExplicitPlatformReceipts, "--mac-manual", options.macManual, "readiness explicit final KO command");
  assertCommandHasFlagPath(readiness.nextCommands?.finalKoGateWithExplicitPlatformReceipts, "--windows-static", options.windowsStatic, "readiness explicit final KO command");
  assertCommandHasFlagPath(readiness.nextCommands?.finalKoGateWithExplicitPlatformReceipts, "--harmony-device", options.harmonyDevice, "readiness explicit final KO command");

  const finalLane = (Array.isArray(operator.lanes) ? operator.lanes : []).find((lane) => lane.id === "finalKoGate") || {};
  assert.equal(finalLane.readinessReady, true, "operator final lane readinessReady must be true");
  assert.equal(finalLane.platformHandoffReady, true, "operator final lane platformHandoffReady must be true");
  assert.equal(finalLane.readinessFreshness?.status, "CURRENT_CLEAN_NEXT_MAJOR_READINESS", "operator final lane readiness freshness must be current");
  assert.equal(finalLane.platformHandoffFreshness?.status, "CURRENT_CLEAN_PLATFORM_QA_HANDOFF", "operator final lane platform handoff freshness must be current");
  assert.equal(finalLane.operatorState, "READY_TO_VALIDATE_FINAL_KO", "operator final lane must be ready to validate final KO");
  assertCommandHasFlagPath(finalLane.nextCommands?.finalizeNextMajor, "--external", options.external, "operator finalize command");
  assertCommandHasFlagPath(finalLane.nextCommands?.finalKoGate, "--external", options.external, "operator final KO command");
  assertCommandHasFlagPath(finalLane.nextCommands?.finalKoGateWithExplicitPlatformReceipts, "--external", options.external, "operator explicit final KO command");
  assertCommandHasFlagPath(finalLane.nextCommands?.finalKoGateWithExplicitPlatformReceipts, "--mac-manual", options.macManual, "operator explicit final KO command");
  assertCommandHasFlagPath(finalLane.nextCommands?.finalKoGateWithExplicitPlatformReceipts, "--windows-static", options.windowsStatic, "operator explicit final KO command");
  assertCommandHasFlagPath(finalLane.nextCommands?.finalKoGateWithExplicitPlatformReceipts, "--harmony-device", options.harmonyDevice, "operator explicit final KO command");

  const hasSourceOverride = options.sourceApprovalRequest !== DEFAULTS.sourceApprovalRequest
    || options.sourceApprovalMarkdown !== DEFAULTS.sourceApprovalMarkdown;
  if (hasSourceOverride) {
    assertCommandHasFlagPath(readiness.nextCommands?.finalizeNextMajor, "--source-approval-request", options.sourceApprovalRequest, "readiness finalize command");
    assertCommandHasFlagPath(readiness.nextCommands?.finalizeNextMajor, "--source-approval-markdown", options.sourceApprovalMarkdown, "readiness finalize command");
    assertCommandHasFlagPath(finalLane.nextCommands?.finalizeNextMajor, "--source-approval-request", options.sourceApprovalRequest, "operator finalize command");
    assertCommandHasFlagPath(finalLane.nextCommands?.finalizeNextMajor, "--source-approval-markdown", options.sourceApprovalMarkdown, "operator finalize command");
  }

  const hasPlatformOverride = options.macManual !== DEFAULTS.macManual
    || options.windowsStatic !== DEFAULTS.windowsStatic
    || options.harmonyDevice !== DEFAULTS.harmonyDevice;

  const finalAction = (Array.isArray(operator.nextActionSequence) ? operator.nextActionSequence : [])
    .find((step) => step.id === "validate-final-ko") || {};
  assertCommandHasFlagPath(finalAction.command, "--external", options.external, "operator critical-path final action");
  if (hasSourceOverride) {
    assertCommandHasFlagPath(finalAction.command, "--source-approval-request", options.sourceApprovalRequest, "operator critical-path final action");
    assertCommandHasFlagPath(finalAction.command, "--source-approval-markdown", options.sourceApprovalMarkdown, "operator critical-path final action");
  }
  if (hasPlatformOverride) {
    assertCommandHasFlagPath(finalAction.command, "--mac-manual", options.macManual, "operator critical-path final action");
    assertCommandHasFlagPath(finalAction.command, "--windows-static", options.windowsStatic, "operator critical-path final action");
    assertCommandHasFlagPath(finalAction.command, "--harmony-device", options.harmonyDevice, "operator critical-path final action");
  }
}

function assertFinalKoOutputBindings(options, { ko, externalClaim, sourceApprovalRequest }) {
  const externalRequirement = (Array.isArray(ko.requirements) ? ko.requirements : [])
    .find((item) => item.id === "approvedExternalReadingVideo") || {};
  assert.equal(externalRequirement.evidencePath, options.external, "final KO external evidence path must match finalizer input");

  [
    ["nativeMacManualQa", options.macManual, "Mac"],
    ["windowsStaticManualQa", options.windowsStatic, "Windows"],
    ["harmonyDeviceQa", options.harmonyDevice, "HarmonyOS"]
  ].forEach(([id, path, label]) => {
    const requirement = (Array.isArray(ko.requirements) ? ko.requirements : []).find((item) => item.id === id) || {};
    assert.equal(requirement.evidencePath, path, `final KO ${label} platform receipt path must match finalizer input`);
  });

  assert.equal(sourceApprovalRequest?.schema, "learning-companion.external-source-approval-request.v1", "source approval request schema");
  assert.equal(sourceApprovalRequest?.evidenceTier, "SOURCE_APPROVAL_REQUEST_ONLY", "source approval request evidence tier");
  assert.equal(sourceApprovalRequest?.canClaimExternalKo, false, "source approval request must remain non-claiming");

  assert.equal(externalClaim?.schema, "learning-companion.external-source-ko-evidence-review.v1", "external claim schema");
  assert.equal(externalClaim?.evidenceTier, "APPROVED_SOURCE_PRIVACY_REVIEWED", "external claim evidence tier");
  assert.equal(externalClaim?.canClaimExternalKo, true, "external claim must allow external KO claim");
  assert.equal(externalClaim?.fixtureOnly, false, "external claim must not be fixture-only");
  assert.equal(externalClaim?.reviewKind, "HUMAN_PRIVACY_REVIEW", "external claim review kind");

  const externalClaimSourceApproval = externalClaim.sourceApprovalRequest || {};
  assertResolvedPathEqual(externalClaimSourceApproval.requestPath, options.sourceApprovalRequest, "external claim source approval request path must match finalizer input");
  assert.equal(externalClaimSourceApproval.requestedApprovalText, sourceApprovalRequest.requestedApprovalText, "external claim requested approval text must match source approval request");
  assert.equal(externalClaimSourceApproval.approvedReadingUrl, sourceApprovalRequest.sources?.reading?.url, "external claim approved reading URL must match source approval request");
  assert.equal(externalClaimSourceApproval.approvedVideoUrl, sourceApprovalRequest.sources?.video?.url, "external claim approved video URL must match source approval request");
  assert.equal(externalClaimSourceApproval.approvedVideoTimestamp, sourceApprovalRequest.sources?.video?.timestamp, "external claim approved video timestamp must match source approval request");
  assert.equal(externalClaimSourceApproval.basisGitHead, sourceApprovalRequest.basis?.priorDryRun?.gitHead, "external claim source approval basis git HEAD must match source approval request");
  assert.equal(externalClaimSourceApproval.basisDirtyWorktree, sourceApprovalRequest.basis?.priorDryRun?.dirtyWorktree, "external claim source approval basis dirty worktree must match source approval request");
  assert.equal(externalClaimSourceApproval.basisProfileCleanupOk, sourceApprovalRequest.basis?.priorDryRun?.profileCleanupOk, "external claim source approval basis profile cleanup must match source approval request");
  assert.equal(externalClaimSourceApproval.basisProfileRetained, sourceApprovalRequest.basis?.priorDryRun?.profileRetained, "external claim source approval basis profile retention must match source approval request");
  assertResolvedPathEqual(
    externalClaimSourceApproval.basisReceiptPath,
    sourceApprovalRequest.basis?.priorDryRunReceipt || sourceApprovalRequest.basis?.inputPath,
    "external claim source approval basis receipt path must match source approval request"
  );

  const externalSourceApproval = ko.evidence?.approvedExternalReadingVideo?.sourceApprovalRequest || {};
  assertResolvedPathEqual(externalSourceApproval.requestPath, options.sourceApprovalRequest, "final KO source approval request path must match finalizer input");
  assert.equal(externalSourceApproval.requestedApprovalText, sourceApprovalRequest.requestedApprovalText, "final KO requested approval text must match source approval request");
  assert.equal(externalSourceApproval.approvedReadingUrl, sourceApprovalRequest.sources?.reading?.url, "final KO approved reading URL must match source approval request");
  assert.equal(externalSourceApproval.approvedVideoUrl, sourceApprovalRequest.sources?.video?.url, "final KO approved video URL must match source approval request");
  assert.equal(externalSourceApproval.approvedVideoTimestamp, sourceApprovalRequest.sources?.video?.timestamp, "final KO approved video timestamp must match source approval request");
  assert.equal(externalSourceApproval.basisGitHead, sourceApprovalRequest.basis?.priorDryRun?.gitHead, "final KO source approval basis git HEAD must match source approval request");
  assert.equal(externalSourceApproval.basisDirtyWorktree, sourceApprovalRequest.basis?.priorDryRun?.dirtyWorktree, "final KO source approval basis dirty worktree must match source approval request");
  assert.equal(externalSourceApproval.basisProfileCleanupOk, sourceApprovalRequest.basis?.priorDryRun?.profileCleanupOk, "final KO source approval basis profile cleanup must match source approval request");
  assert.equal(externalSourceApproval.basisProfileRetained, sourceApprovalRequest.basis?.priorDryRun?.profileRetained, "final KO source approval basis profile retention must match source approval request");
  assertResolvedPathEqual(
    externalSourceApproval.basisReceiptPath,
    sourceApprovalRequest.basis?.priorDryRunReceipt || sourceApprovalRequest.basis?.inputPath,
    "final KO source approval basis receipt path must match source approval request"
  );

  assertResolvedPathEqual(externalSourceApproval.requestPath, externalClaimSourceApproval.requestPath, "final KO source approval request path must match external claim");
  assert.equal(externalSourceApproval.requestedApprovalText, externalClaimSourceApproval.requestedApprovalText, "final KO requested approval text must match external claim");
  assert.equal(externalSourceApproval.approvedReadingUrl, externalClaimSourceApproval.approvedReadingUrl, "final KO approved reading URL must match external claim");
  assert.equal(externalSourceApproval.approvedVideoUrl, externalClaimSourceApproval.approvedVideoUrl, "final KO approved video URL must match external claim");
  assert.equal(externalSourceApproval.approvedVideoTimestamp, externalClaimSourceApproval.approvedVideoTimestamp, "final KO approved video timestamp must match external claim");
  assert.equal(externalSourceApproval.basisGitHead, externalClaimSourceApproval.basisGitHead, "final KO source approval basis git HEAD must match external claim");
  assert.equal(externalSourceApproval.basisDirtyWorktree, externalClaimSourceApproval.basisDirtyWorktree, "final KO source approval basis dirty worktree must match external claim");
  assert.equal(externalSourceApproval.basisProfileCleanupOk, externalClaimSourceApproval.basisProfileCleanupOk, "final KO source approval basis profile cleanup must match external claim");
  assert.equal(externalSourceApproval.basisProfileRetained, externalClaimSourceApproval.basisProfileRetained, "final KO source approval basis profile retention must match external claim");
  assertResolvedPathEqual(externalSourceApproval.basisReceiptPath, externalClaimSourceApproval.basisReceiptPath, "final KO source approval basis receipt path must match external claim");
}

function assertResolvedPathEqual(actual, expected, message) {
  assert.notEqual(String(actual || "").trim(), "", `${message}: actual path must be present`);
  assert.notEqual(String(expected || "").trim(), "", `${message}: expected path must be present`);
  assert.equal(resolve(String(actual || "")), resolve(String(expected || "")), message);
}

function assertCommandHasFlagPath(command, flag, path, label) {
  const text = String(command || "");
  const expected = `${flag} ${shellQuote(path)}`;
  const boundaryPattern = new RegExp(`(?:^|\\s)${escapeRegExp(expected)}(?=$|\\s)`);
  assert.match(text, boundaryPattern, `${label} must include ${expected} as a complete shell argument`);
}

function escapeRegExp(value) {
  return String(value).replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function buildDryRunSummary(plan) {
  const lines = [
    "next_major_finalize_dry_run",
    "Commands that would run, in order:",
    "Dry-run boundary: no file readability, schema, KO, privacy, platform, readiness, or operator validation is performed."
  ];
  for (const command of plan.commands) {
    lines.push(`- ${command.id}: ${formatNodeCommand(command.argv)}`);
  }
  lines.push("", "Boundary:");
  for (const item of plan.blockedOrNotExecuted) lines.push(`- ${item}`);
  return `${lines.join("\n")}\n`;
}

function formatNodeCommand(argv) {
  return ["node", ...argv].map(shellQuote).join(" ");
}

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(text)) return text;
  return `'${text.replace(/'/g, "'\\''")}'`;
}

function markdownSiblingPath(jsonPath) {
  const text = String(jsonPath);
  return text.endsWith(".json") ? `${text.slice(0, -5)}.md` : `${text}.md`;
}

function runSelfTest() {
  const customSourceOptions = normalizeOptions({
    external: "fixtures/external-ko.json",
    "source-approval-request": ".codex-tmp/selftest/custom source approval.json"
  });
  assert.equal(customSourceOptions.sourceApprovalMarkdown, ".codex-tmp/selftest/custom source approval.md");
  const explicitMarkdownOptions = normalizeOptions({
    external: "fixtures/external-ko.json",
    "source-approval-request": ".codex-tmp/selftest/custom source approval.json",
    "source-approval-markdown": ".codex-tmp/selftest/custom source approval note.md"
  });
  assert.equal(explicitMarkdownOptions.sourceApprovalMarkdown, ".codex-tmp/selftest/custom source approval note.md");

  const plan = buildFinalizePlan({
    external: "fixtures/external-ko.json",
    koOut: ".codex-tmp/selftest/final.json",
    readinessOut: ".codex-tmp/selftest/readiness.json",
    platformHandoffOut: ".codex-tmp/selftest/platform.json",
    operatorOut: ".codex-tmp/selftest/operator.json",
    sourceApprovalRequest: ".codex-tmp/selftest/source-approval-request.json",
    sourceApprovalMarkdown: ".codex-tmp/selftest/source-approval-request.md",
    localEvidence: ".codex-tmp/selftest/local-evidence.json",
    macManual: ".codex-tmp/selftest/mac-real.json",
    windowsStatic: ".codex-tmp/selftest/windows-real.json",
    harmonyDevice: ".codex-tmp/selftest/harmony-real.json"
  });
  assert.equal(plan.options.external, "fixtures/external-ko.json");
  assert.equal(plan.options.sourceApprovalRequest, ".codex-tmp/selftest/source-approval-request.json");
  assert.equal(plan.options.localEvidence, ".codex-tmp/selftest/local-evidence.json");
  assert.equal(plan.options.macManual, ".codex-tmp/selftest/mac-real.json");
  const localEvidenceCheck = plan.commands.find((command) => command.id === "check-local-evidence-snapshot");
  assert.ok(localEvidenceCheck);
  assert.deepEqual(localEvidenceCheck.argv, [
    "scripts/refresh-next-major-local-evidence.mjs",
    "--check",
    "--local-evidence-out",
    ".codex-tmp/selftest/local-evidence.json"
  ]);
  assert.equal(localEvidenceCheck.output, undefined);
  const finalKo = plan.commands.find((command) => command.id === "validate-final-ko");
  assert.ok(finalKo);
  assert.equal(finalKo.argv.includes("--allow-missing"), false);
  assert.deepEqual(finalKo.argv.slice(0, 1), ["scripts/validate-ko-evidence.mjs"]);
  assert.equal(finalKo.argv.includes("--external"), true);
  assert.equal(finalKo.argv.includes("fixtures/external-ko.json"), true);
  assert.equal(finalKo.argv.includes(".codex-tmp/selftest/mac-real.json"), true);
  assert.equal(finalKo.argv.includes(".codex-tmp/selftest/windows-real.json"), true);
  assert.equal(finalKo.argv.includes(".codex-tmp/selftest/harmony-real.json"), true);

  const readiness = plan.commands.find((command) => command.id === "refresh-readiness");
  const platform = plan.commands.find((command) => command.id === "refresh-platform-handoff");
  const operator = plan.commands.find((command) => command.id === "refresh-operator-packet");
  assert.equal(readiness.argv.includes(".codex-tmp/selftest/final.json"), true);
  assert.equal(readiness.argv.includes(".codex-tmp/selftest/source-approval-request.json"), true);
  assert.equal(readiness.argv.includes(".codex-tmp/selftest/source-approval-request.md"), true);
  assert.equal(readiness.argv.includes("fixtures/external-ko.json"), true);
  assert.equal(readiness.argv.includes(".codex-tmp/selftest/mac-real.json"), true);
  assert.equal(readiness.argv.includes(".codex-tmp/selftest/windows-real.json"), true);
  assert.equal(readiness.argv.includes(".codex-tmp/selftest/harmony-real.json"), true);
  assert.equal(platform.argv.includes(".codex-tmp/selftest/final.json"), true);
  assert.equal(platform.argv.includes(".codex-tmp/selftest/mac-real.json"), true);
  assert.equal(platform.argv.includes(".codex-tmp/selftest/windows-real.json"), true);
  assert.equal(platform.argv.includes(".codex-tmp/selftest/harmony-real.json"), true);
  assert.equal(operator.argv.includes(".codex-tmp/selftest/source-approval-request.json"), true);
  assert.equal(operator.argv.includes(".codex-tmp/selftest/source-approval-request.md"), true);
  assert.equal(operator.argv.includes("fixtures/external-ko.json"), true);
  assert.equal(operator.argv.includes(".codex-tmp/selftest/mac-real.json"), true);
  assert.equal(operator.argv.includes(".codex-tmp/selftest/windows-real.json"), true);
  assert.equal(operator.argv.includes(".codex-tmp/selftest/harmony-real.json"), true);
  assert.equal(operator.argv.includes(".codex-tmp/selftest/operator.md"), true);

  const dryRun = buildDryRunSummary(plan);
  assert.match(dryRun, /next_major_finalize_dry_run/);
  assert.match(dryRun, /node scripts\/refresh-next-major-local-evidence\.mjs --check --local-evidence-out \.codex-tmp\/selftest\/local-evidence\.json/);
  assert.match(dryRun, /node scripts\/validate-ko-evidence\.mjs/);
  assert.match(dryRun, /node scripts\/next-major-readiness\.mjs/);
  assert.match(dryRun, /--source-approval-request \.codex-tmp\/selftest\/source-approval-request\.json/);
  assert.match(dryRun, /--source-approval-markdown \.codex-tmp\/selftest\/source-approval-request\.md/);
  assert.match(dryRun, /--external fixtures\/external-ko\.json/);
  assert.match(dryRun, /--mac-manual \.codex-tmp\/selftest\/mac-real\.json/);
  assert.match(dryRun, /--windows-static \.codex-tmp\/selftest\/windows-real\.json/);
  assert.match(dryRun, /--harmony-device \.codex-tmp\/selftest\/harmony-real\.json/);
  assert.match(dryRun, /node scripts\/platform-qa-handoff\.mjs/);
  assert.match(dryRun, /node scripts\/platform-qa-handoff\.mjs .*--mac-manual \.codex-tmp\/selftest\/mac-real\.json/);
  assert.match(dryRun, /node scripts\/platform-qa-handoff\.mjs .*--windows-static \.codex-tmp\/selftest\/windows-real\.json/);
  assert.match(dryRun, /node scripts\/platform-qa-handoff\.mjs .*--harmony-device \.codex-tmp\/selftest\/harmony-real\.json/);
  assert.match(dryRun, /node scripts\/next-major-operator-packet\.mjs/);
  assert.match(dryRun, /node scripts\/next-major-operator-packet\.mjs .*--source-approval-markdown \.codex-tmp\/selftest\/source-approval-request\.md/);
  assert.match(dryRun, /node scripts\/next-major-operator-packet\.mjs .*--external fixtures\/external-ko\.json/);
  assert.match(dryRun, /node scripts\/next-major-operator-packet\.mjs .*--mac-manual \.codex-tmp\/selftest\/mac-real\.json/);
  assert.match(dryRun, /node scripts\/next-major-operator-packet\.mjs .*--windows-static \.codex-tmp\/selftest\/windows-real\.json/);
  assert.match(dryRun, /node scripts\/next-major-operator-packet\.mjs .*--harmony-device \.codex-tmp\/selftest\/harmony-real\.json/);
  assert.match(dryRun, /Dry-run boundary: no file readability/);
  assert.match(dryRun, /does not build, package, deploy/);

  const successfulReadiness = {
    nextCommands: {
      finalizeNextMajor: "npm run next:finalize -- --external fixtures/external-ko.json --source-approval-request .codex-tmp/selftest/source-approval-request.json --source-approval-markdown .codex-tmp/selftest/source-approval-request.md --mac-manual .codex-tmp/selftest/mac-real.json --windows-static .codex-tmp/selftest/windows-real.json --harmony-device .codex-tmp/selftest/harmony-real.json",
      finalKoGate: "npm run ko:validate -- --external fixtures/external-ko.json --out .codex-tmp/ko-evidence/final.json",
      finalKoGateWithExplicitPlatformReceipts: "npm run ko:validate -- --external fixtures/external-ko.json --mac-manual .codex-tmp/selftest/mac-real.json --windows-static .codex-tmp/selftest/windows-real.json --harmony-device .codex-tmp/selftest/harmony-real.json --out .codex-tmp/ko-evidence/final.json"
    }
  };
  const successfulOperator = {
    inputs: {
      sourceApprovalRequestPath: ".codex-tmp/selftest/source-approval-request.json",
      sourceApprovalMarkdownPath: ".codex-tmp/selftest/source-approval-request.md",
      externalEvidencePath: "fixtures/external-ko.json",
      platformReceiptPaths: {
        macManual: ".codex-tmp/selftest/mac-real.json",
        windowsStatic: ".codex-tmp/selftest/windows-real.json",
        harmonyDevice: ".codex-tmp/selftest/harmony-real.json"
      }
    },
    lanes: [
      {
        id: "finalKoGate",
        operatorState: "READY_TO_VALIDATE_FINAL_KO",
        readinessReady: true,
        platformHandoffReady: true,
        readinessFreshness: { status: "CURRENT_CLEAN_NEXT_MAJOR_READINESS" },
        platformHandoffFreshness: { status: "CURRENT_CLEAN_PLATFORM_QA_HANDOFF" },
        nextCommands: {
          finalizeNextMajor: successfulReadiness.nextCommands.finalizeNextMajor,
          finalKoGate: successfulReadiness.nextCommands.finalKoGate,
          finalKoGateWithExplicitPlatformReceipts: successfulReadiness.nextCommands.finalKoGateWithExplicitPlatformReceipts
        }
      }
    ],
    nextActionSequence: [
      {
        id: "validate-final-ko",
        command: successfulReadiness.nextCommands.finalizeNextMajor
      }
    ]
  };
  const successfulSourceApprovalRequest = {
    schema: "learning-companion.external-source-approval-request.v1",
    evidenceTier: "SOURCE_APPROVAL_REQUEST_ONLY",
    canClaimExternalKo: false,
    requestedApprovalText: "I approve these exact public learning-material sources for the current turn: reading=https://example.org/reading video=https://example.org/video.mp4 timestamp=00:03",
    sources: {
      reading: { url: "https://example.org/reading" },
      video: { url: "https://example.org/video.mp4", timestamp: "00:03" }
    },
    basis: {
      priorDryRunReceipt: ".codex-tmp/selftest/public-dry-run.json",
      priorDryRun: {
        gitHead: "0123456789abcdef0123456789abcdef01234567",
        dirtyWorktree: false,
        profileCleanupOk: true,
        profileRetained: false
      }
    }
  };
  const successfulKo = {
    requirements: [
      { id: "approvedExternalReadingVideo", evidencePath: "fixtures/external-ko.json" },
      { id: "nativeMacManualQa", evidencePath: ".codex-tmp/selftest/mac-real.json" },
      { id: "windowsStaticManualQa", evidencePath: ".codex-tmp/selftest/windows-real.json" },
      { id: "harmonyDeviceQa", evidencePath: ".codex-tmp/selftest/harmony-real.json" }
    ],
    evidence: {
      approvedExternalReadingVideo: {
        sourceApprovalRequest: {
          requestPath: ".codex-tmp/selftest/source-approval-request.json",
          requestedApprovalText: successfulSourceApprovalRequest.requestedApprovalText,
          approvedReadingUrl: successfulSourceApprovalRequest.sources.reading.url,
          approvedVideoUrl: successfulSourceApprovalRequest.sources.video.url,
          approvedVideoTimestamp: successfulSourceApprovalRequest.sources.video.timestamp,
          basisGitHead: successfulSourceApprovalRequest.basis.priorDryRun.gitHead,
          basisDirtyWorktree: successfulSourceApprovalRequest.basis.priorDryRun.dirtyWorktree,
          basisReceiptPath: successfulSourceApprovalRequest.basis.priorDryRunReceipt,
          basisProfileCleanupOk: successfulSourceApprovalRequest.basis.priorDryRun.profileCleanupOk,
          basisProfileRetained: successfulSourceApprovalRequest.basis.priorDryRun.profileRetained
        }
      }
    }
  };
  const successfulExternalClaim = {
    schema: "learning-companion.external-source-ko-evidence-review.v1",
    evidenceTier: "APPROVED_SOURCE_PRIVACY_REVIEWED",
    canClaimExternalKo: true,
    fixtureOnly: false,
    reviewKind: "HUMAN_PRIVACY_REVIEW",
    sourceApprovalRequest: successfulKo.evidence.approvedExternalReadingVideo.sourceApprovalRequest
  };
  const successfulBindings = {
    ko: successfulKo,
    externalClaim: successfulExternalClaim,
    sourceApprovalRequest: successfulSourceApprovalRequest,
    readiness: successfulReadiness,
    operator: successfulOperator
  };
  assertFinalizerOutputBindings(plan, successfulBindings);
  assert.throws(() => assertFinalizerOutputBindings(plan, {
    ...successfulBindings,
    ko: {
      ...successfulKo,
      evidence: {
        approvedExternalReadingVideo: {
          sourceApprovalRequest: {
            ...successfulKo.evidence.approvedExternalReadingVideo.sourceApprovalRequest,
            requestPath: ".codex-tmp/selftest/other-source-approval-request.json"
          }
        }
      }
    }
  }), /final KO source approval request path must match finalizer input/);
  assert.throws(() => assertFinalizerOutputBindings(plan, {
    ...successfulBindings,
    sourceApprovalRequest: {
      ...successfulSourceApprovalRequest,
      requestedApprovalText: "I approve different sources."
    }
  }), /external claim requested approval text must match source approval request/);
  assert.throws(() => assertFinalizerOutputBindings(plan, {
    ...successfulBindings,
    ko: {
      ...successfulKo,
      evidence: {
        approvedExternalReadingVideo: {
          sourceApprovalRequest: {
            ...successfulKo.evidence.approvedExternalReadingVideo.sourceApprovalRequest,
            requestedApprovalText: "I approve different sources."
          }
        }
      }
    }
  }), /final KO requested approval text must match source approval request/);
  assert.throws(() => assertFinalizerOutputBindings(plan, {
    ...successfulBindings,
    externalClaim: {
      ...successfulExternalClaim,
      sourceApprovalRequest: {
        ...successfulExternalClaim.sourceApprovalRequest,
        requestPath: ".codex-tmp/selftest/other-source-approval-request.json"
      }
    }
  }), /external claim source approval request path must match finalizer input/);
  assert.throws(() => assertFinalizerOutputBindings(plan, {
    ...successfulBindings,
    externalClaim: {
      ...successfulExternalClaim,
      sourceApprovalRequest: {
        ...successfulExternalClaim.sourceApprovalRequest,
        approvedReadingUrl: "https://example.org/other-reading"
      }
    }
  }), /external claim approved reading URL must match source approval request/);
  assert.throws(() => assertFinalizerOutputBindings(plan, {
    ...successfulBindings,
    externalClaim: {
      ...successfulExternalClaim,
      sourceApprovalRequest: {
        ...successfulExternalClaim.sourceApprovalRequest,
        basisGitHead: "abcdef0123456789abcdef0123456789abcdef01"
      }
    }
  }), /external claim source approval basis git HEAD must match source approval request/);
  assert.throws(() => assertFinalizerOutputBindings(plan, {
    ...successfulBindings,
    externalClaim: {
      ...successfulExternalClaim,
      canClaimExternalKo: false
    }
  }), /external claim must allow external KO claim/);
  assert.throws(() => assertFinalizerOutputBindings(plan, {
    ...successfulBindings,
    externalClaim: {
      ...successfulExternalClaim,
      sourceApprovalRequest: {
        ...successfulExternalClaim.sourceApprovalRequest,
        basisReceiptPath: ""
      }
    }
  }), /external claim source approval basis receipt path must match source approval request: actual path must be present/);
  assert.throws(() => assertFinalizerOutputBindings({
    ...plan,
    options: {
      ...plan.options,
      external: "fixtures/plan-swapped-external.json"
    }
  }, successfulBindings), /final KO external evidence path must match finalizer input/);
  assert.throws(() => assertFinalizerOutputBindings(plan, {
    ...successfulBindings,
    readiness: successfulReadiness,
    operator: {
      ...successfulOperator,
      inputs: {
        ...successfulOperator.inputs,
        externalEvidencePath: "fixtures/wrong-external.json"
      }
    }
  }), /external evidence path must match finalizer input/);
  assert.throws(() => assertFinalizerOutputBindings(plan, {
    ...successfulBindings,
    readiness: {
      nextCommands: {
        ...successfulReadiness.nextCommands,
        finalKoGate: "npm run ko:validate -- --external fixtures/external-ko.json.bak --out .codex-tmp/ko-evidence/final.json"
      }
    },
    operator: successfulOperator
  }), /readiness final KO command must include --external fixtures\/external-ko\.json as a complete shell argument/);
  assert.throws(() => assertFinalizerOutputBindings(plan, {
    ...successfulBindings,
    readiness: {
      nextCommands: {
        ...successfulReadiness.nextCommands,
        finalKoGate: "npm run ko:validate -- --bad--external fixtures/external-ko.json --out .codex-tmp/ko-evidence/final.json"
      }
    },
    operator: successfulOperator
  }), /readiness final KO command must include --external fixtures\/external-ko\.json as a complete shell argument/);
  assert.throws(() => assertFinalizerOutputBindings(plan, {
    ...successfulBindings,
    readiness: successfulReadiness,
    operator: {
      ...successfulOperator,
      lanes: [
        {
          ...successfulOperator.lanes[0],
          readinessFreshness: { status: "STALE_OR_DIRTY_NEXT_MAJOR_READINESS" }
        }
      ]
    }
  }), /operator final lane readiness freshness must be current/);
  assert.throws(() => assertFinalizerOutputBindings(plan, {
    ...successfulBindings,
    readiness: successfulReadiness,
    operator: {
      ...successfulOperator,
      nextActionSequence: [
        {
          id: "validate-final-ko",
          command: "npm run next:finalize -- --external fixtures/external-ko.json --source-approval-request .codex-tmp/selftest/source-approval-request.json --source-approval-markdown .codex-tmp/selftest/source-approval-request.md"
        }
      ]
    }
  }), /operator critical-path final action must include --mac-manual \.codex-tmp\/selftest\/mac-real\.json as a complete shell argument/);

  const spacedPlan = buildFinalizePlan({
    external: "fixtures/external ko.json",
    koOut: ".codex-tmp/selftest/final spaced.json",
    readinessOut: ".codex-tmp/selftest/readiness spaced.json",
    platformHandoffOut: ".codex-tmp/selftest/platform spaced.json",
    operatorOut: ".codex-tmp/selftest/operator spaced.json",
    localEvidence: ".codex-tmp/selftest/local evidence spaced.json",
    sourceApprovalRequest: ".codex-tmp/selftest/source approval request.json",
    sourceApprovalMarkdown: ".codex-tmp/selftest/source approval note.md",
    macManual: ".codex-tmp/selftest/mac real.json",
    windowsStatic: ".codex-tmp/selftest/windows real.json",
    harmonyDevice: ".codex-tmp/selftest/harmony real.json"
  });
  const spacedFinalizeCommand = [
    "npm run next:finalize -- --external",
    shellQuote(spacedPlan.options.external),
    "--source-approval-request",
    shellQuote(spacedPlan.options.sourceApprovalRequest),
    "--source-approval-markdown",
    shellQuote(spacedPlan.options.sourceApprovalMarkdown),
    "--mac-manual",
    shellQuote(spacedPlan.options.macManual),
    "--windows-static",
    shellQuote(spacedPlan.options.windowsStatic),
    "--harmony-device",
    shellQuote(spacedPlan.options.harmonyDevice)
  ].join(" ");
  const spacedFinalKoCommand = [
    "npm run ko:validate -- --external",
    shellQuote(spacedPlan.options.external),
    "--out",
    ".codex-tmp/ko-evidence/final.json"
  ].join(" ");
  const spacedExplicitFinalKoCommand = [
    "npm run ko:validate -- --external",
    shellQuote(spacedPlan.options.external),
    "--mac-manual",
    shellQuote(spacedPlan.options.macManual),
    "--windows-static",
    shellQuote(spacedPlan.options.windowsStatic),
    "--harmony-device",
    shellQuote(spacedPlan.options.harmonyDevice),
    "--out",
    ".codex-tmp/ko-evidence/final.json"
  ].join(" ");
  const spacedReadiness = {
    nextCommands: {
      finalizeNextMajor: spacedFinalizeCommand,
      finalKoGate: spacedFinalKoCommand,
      finalKoGateWithExplicitPlatformReceipts: spacedExplicitFinalKoCommand
    }
  };
  const spacedOperator = {
    inputs: {
      sourceApprovalRequestPath: spacedPlan.options.sourceApprovalRequest,
      sourceApprovalMarkdownPath: spacedPlan.options.sourceApprovalMarkdown,
      externalEvidencePath: spacedPlan.options.external,
      platformReceiptPaths: {
        macManual: spacedPlan.options.macManual,
        windowsStatic: spacedPlan.options.windowsStatic,
        harmonyDevice: spacedPlan.options.harmonyDevice
      }
    },
    lanes: [
      {
        id: "finalKoGate",
        operatorState: "READY_TO_VALIDATE_FINAL_KO",
        readinessReady: true,
        platformHandoffReady: true,
        readinessFreshness: { status: "CURRENT_CLEAN_NEXT_MAJOR_READINESS" },
        platformHandoffFreshness: { status: "CURRENT_CLEAN_PLATFORM_QA_HANDOFF" },
        nextCommands: {
          finalizeNextMajor: spacedFinalizeCommand,
          finalKoGate: spacedFinalKoCommand,
          finalKoGateWithExplicitPlatformReceipts: spacedExplicitFinalKoCommand
        }
      }
    ],
    nextActionSequence: [
      {
        id: "validate-final-ko",
        command: spacedFinalizeCommand
      }
    ]
  };
  const spacedSourceApprovalRequest = {
    ...successfulSourceApprovalRequest,
    requestedApprovalText: "I approve these exact public learning-material sources for the current turn: reading=https://example.org/reading-spaced video=https://example.org/video-spaced.mp4 timestamp=00:04",
    sources: {
      reading: { url: "https://example.org/reading-spaced" },
      video: { url: "https://example.org/video-spaced.mp4", timestamp: "00:04" }
    },
    basis: {
      ...successfulSourceApprovalRequest.basis,
      priorDryRunReceipt: ".codex-tmp/selftest/public dry run spaced.json"
    }
  };
  const spacedKo = {
    requirements: [
      { id: "approvedExternalReadingVideo", evidencePath: spacedPlan.options.external },
      { id: "nativeMacManualQa", evidencePath: spacedPlan.options.macManual },
      { id: "windowsStaticManualQa", evidencePath: spacedPlan.options.windowsStatic },
      { id: "harmonyDeviceQa", evidencePath: spacedPlan.options.harmonyDevice }
    ],
    evidence: {
      approvedExternalReadingVideo: {
        sourceApprovalRequest: {
          requestPath: spacedPlan.options.sourceApprovalRequest,
          requestedApprovalText: spacedSourceApprovalRequest.requestedApprovalText,
          approvedReadingUrl: spacedSourceApprovalRequest.sources.reading.url,
          approvedVideoUrl: spacedSourceApprovalRequest.sources.video.url,
          approvedVideoTimestamp: spacedSourceApprovalRequest.sources.video.timestamp,
          basisGitHead: spacedSourceApprovalRequest.basis.priorDryRun.gitHead,
          basisDirtyWorktree: spacedSourceApprovalRequest.basis.priorDryRun.dirtyWorktree,
          basisReceiptPath: spacedSourceApprovalRequest.basis.priorDryRunReceipt,
          basisProfileCleanupOk: spacedSourceApprovalRequest.basis.priorDryRun.profileCleanupOk,
          basisProfileRetained: spacedSourceApprovalRequest.basis.priorDryRun.profileRetained
        }
      }
    }
  };
  const spacedExternalClaim = {
    ...successfulExternalClaim,
    sourceApprovalRequest: spacedKo.evidence.approvedExternalReadingVideo.sourceApprovalRequest
  };
  assertFinalizerOutputBindings(spacedPlan, {
    ko: spacedKo,
    externalClaim: spacedExternalClaim,
    sourceApprovalRequest: spacedSourceApprovalRequest,
    readiness: spacedReadiness,
    operator: spacedOperator
  });
  console.log("next_major_finalize_selftest_ok");
}

function buildHelp() {
  return `Finalize Learning Companion next-major pre-release evidence after every required evidence artifact exists.

Usage:
  npm run next:finalize -- --external <ko-evidence-review.json>
  npm run next:finalize -- --external <ko-evidence-review.json> --dry-run

Optional source approval path binding:
  --source-approval-request <path> --source-approval-markdown <path>

Optional platform receipt path binding:
  --mac-manual <receipt.json> --windows-static <receipt.json> --harmony-device <receipt.json>

Optional local evidence snapshot binding:
  --local-evidence <snapshot.json>

This command checks the local evidence snapshot, runs strict KO validation, then refreshes readiness, platform handoff, and operator packets.
Dry-run only prints the command plan; it does not read or validate evidence files.
This command does not grant approval, perform privacy review, run platform QA, build, package, deploy, remote-accept, or authorize release.`;
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
