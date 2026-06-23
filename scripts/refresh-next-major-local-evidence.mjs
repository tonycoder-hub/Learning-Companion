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
  koStatus: ".codex-tmp/ko-evidence/current-status.json",
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
  "ko-status"
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
    koStatus: String(parsed["ko-status"] || DEFAULTS.koStatus),
    dryRunNote: String(parsed["dry-run-note"] || DEFAULTS.dryRunNote)
  };
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
          options.readinessMarkdownOut
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
          options.platformHandoffMarkdownOut
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
          options.sourceApprovalRequest
        ]
      },
      {
        id: "print-ko-next",
        label: "KO next summary",
        argv: [
          "scripts/ko-next-action-summary.mjs",
          "--source-approval-request",
          options.sourceApprovalRequest,
          "--operator",
          options.operatorOut,
          "--status",
          options.koStatus
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
    options: normalizeOptions({}),
    sourceApproval: {
      path: DEFAULTS.sourceApprovalRequest,
      readingUrl: request.sources.reading.url,
      videoUrl: request.sources.video.url,
      videoTimestamp: request.sources.video.timestamp
    },
    commands: [
      { id: "refresh-bilingual-runtime", argv: ["scripts/smoke-bilingual-runtime-browser.mjs"] },
      { id: "refresh-controlled-loop", argv: ["scripts/agent-study-loop-check.mjs", "--out", ".codex-tmp/agent-study-loop-smoke/receipt.json"] },
      { id: "refresh-public-source-dry-run", argv: ["scripts/external-source-validation-browser.mjs", "--public-source-dry-run"], capturePublicDryRunReceipt: true },
      { id: "refresh-ko-status", argv: ["scripts/validate-ko-evidence.mjs", "--allow-missing", "--out", DEFAULTS.koStatus] },
      { id: "refresh-readiness", argv: ["scripts/next-major-readiness.mjs", "--status", DEFAULTS.koStatus, "--out", DEFAULTS.readinessOut, "--markdown-out", DEFAULTS.readinessMarkdownOut] },
      { id: "refresh-platform-qa-handoff", argv: ["scripts/platform-qa-handoff.mjs", "--status", DEFAULTS.koStatus, "--out", DEFAULTS.platformHandoffOut, "--markdown-out", DEFAULTS.platformHandoffMarkdownOut] },
      { id: "regenerate-source-approval-request", argvFrom: "publicDryRunReceipt" },
      { id: "refresh-operator-packet", argv: ["scripts/next-major-operator-packet.mjs", "--status", DEFAULTS.koStatus, "--readiness", DEFAULTS.readinessOut, "--platform-handoff", DEFAULTS.platformHandoffOut] },
      { id: "print-ko-next", argv: ["scripts/ko-next-action-summary.mjs"] }
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
  assert.match(dryRun, /refresh-ko-status/);
  assert.match(dryRun, /refresh-readiness/);
  assert.match(dryRun, /next-major-readiness\.mjs/);
  assert.match(dryRun, /refresh-platform-qa-handoff/);
  assert.match(dryRun, /platform-qa-handoff\.mjs/);
  assert.match(dryRun, /regenerate-source-approval-request/);
  assert.match(dryRun, /fresh-public-dry-run-receipt\.json/);
  assert.match(dryRun, /Does not run approved-source browser capture/);
  assert.doesNotMatch(dryRun, /--approved-current-turn/);
  assert.match(dryRun, /Does not build, package, deploy/);
  assert.match(dryRun, /remote acceptance/);
  console.log("next_major_local_evidence_refresh_selftest_ok");
}

function buildHelp() {
  return `Refresh non-claiming local next-major evidence in the only safe order.

Usage:
  npm run next:local-evidence
  npm run next:local-evidence -- --dry-run

This command runs local bilingual/browser and controlled-loop receipts first,
then refreshes the public-source dry-run, KO status, readiness packet,
platform QA handoff, approval request, operator packet, and KO next summary.
It does not grant source approval, run approved-source capture, perform
privacy review, run real platform QA, build, deploy, or remote-accept.`;
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
