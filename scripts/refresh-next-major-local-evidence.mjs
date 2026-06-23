#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { readCurrentRevisionSync } from "./lib/git-revision.mjs";

const execFileAsync = promisify(execFile);
const SUBCOMMAND_TIMEOUT_MS = 180_000;
const PUBLIC_DRY_RUN_RECEIPT_PATTERN = /external_source_validation_public_dry_run_ok\s+(.+\.json)\s*$/m;

const DEFAULTS = Object.freeze({
  sourceApprovalRequest: ".codex-tmp/external-source-validation/source-approval-request.json",
  sourceApprovalMarkdown: ".codex-tmp/external-source-validation/source-approval-request.md",
  readinessOut: ".codex-tmp/next-major-readiness/current.json",
  readinessMarkdownOut: ".codex-tmp/next-major-readiness/current.md",
  platformHandoffOut: ".codex-tmp/platform-qa-handoff/current.json",
  platformHandoffMarkdownOut: ".codex-tmp/platform-qa-handoff/current.md",
  operatorOut: ".codex-tmp/next-major-operator/current.json",
  operatorMarkdownOut: ".codex-tmp/next-major-operator/current.md",
  koNextOut: ".codex-tmp/ko-next/current.json",
  koStatus: ".codex-tmp/ko-evidence/current-status.json",
  macManual: ".codex-tmp/mac-manual-qa/real-run-receipt.json",
  windowsStatic: ".codex-tmp/windows-static-qa/real-run-receipt.json",
  harmonyDevice: ".codex-tmp/harmony-device-qa/real-run-receipt.json",
  dryRunNote: "Refresh public source preflight for current clean HEAD via next:local-evidence."
});
const PATH_ARGS = [
  "source-approval-request",
  "source-approval-markdown",
  "readiness-out",
  "readiness-markdown-out",
  "platform-handoff-out",
  "platform-handoff-markdown-out",
  "operator-out",
  "operator-markdown-out",
  "ko-next-out",
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
  runSelfTest();
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
    operatorOut: String(parsed["operator-out"] || DEFAULTS.operatorOut),
    operatorMarkdownOut: String(parsed["operator-markdown-out"] || DEFAULTS.operatorMarkdownOut),
    koNextOut: String(parsed["ko-next-out"] || DEFAULTS.koNextOut),
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
          ".codex-tmp/return-import-dry-run/receipt.json"
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
          ".codex-tmp/dogfood-runbook/receipt.json"
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
          ".codex-tmp/mac-manual-qa/receipt.json"
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
          ".codex-tmp/windows-static-qa/receipt.json"
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
          ".codex-tmp/harmony-device-qa/receipt.json"
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
    blockedOrNotExecuted: [
      "Does not grant current-turn source approval.",
      "Does not run approved-source browser capture.",
      "Does not perform human privacy review.",
      "Does not run Mac, Windows, or HarmonyOS real platform QA.",
      "Does not build, package, deploy, check Mew-Test/main site, run remote acceptance, or authorize release."
    ]
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
  console.log(buildSuccessSummary(plan, publicDryRunReceipt, outputs));
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

function buildSuccessSummary(plan, publicDryRunReceipt, outputs) {
  const koNext = outputs.find((item) => item.id === "print-ko-next")?.stdout.trim() || "";
  const lines = [
    "next_major_local_evidence_refresh_ok",
    `Git HEAD: ${plan.currentRevision.gitHead}`,
    `Public dry-run receipt: ${publicDryRunReceipt || "TBD"}`,
    `Source approval request: ${plan.options.sourceApprovalRequest}`,
    `Readiness packet: ${plan.options.readinessOut}`,
    `Platform QA handoff: ${plan.options.platformHandoffOut}`,
    `Operator packet: ${plan.options.operatorOut}`,
    `KO next action summary: ${plan.options.koNextOut}`,
    "",
    "Boundary:"
  ];
  for (const item of plan.blockedOrNotExecuted) lines.push(`- ${item}`);
  if (koNext) lines.push("", "KO next summary:", "", koNext);
  return `${lines.join("\n")}\n`;
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

function runSelfTest() {
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
      gitHead: "0123456789abcdef0123456789abcdef01234567"
    },
    options: normalizeOptions({
      "mac-manual": "custom mac.json",
      "windows-static": "custom windows.json",
      "harmony-device": "custom harmony.json"
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
  console.log("next_major_local_evidence_refresh_selftest_ok");
}

function buildHelp() {
  return `Refresh non-claiming local next-major evidence in the only safe order.

Usage:
  npm run next:local-evidence
  npm run next:local-evidence -- --dry-run
  npm run next:local-evidence -- --mac-manual <mac-receipt.json> --windows-static <windows-receipt.json> --harmony-device <harmony-receipt.json>
  npm run next:local-evidence -- --ko-next-out .codex-tmp/ko-next/current.json

This command runs local bilingual/browser, controlled-loop, static-return,
return-import, dogfood, and pending platform QA receipts first. It then
refreshes the public-source dry-run, KO status, readiness packet, platform QA
handoff, approval request, operator packet, and KO next summary JSON/text output.
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
