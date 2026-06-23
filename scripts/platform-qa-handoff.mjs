#!/usr/bin/env node
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { readCurrentRevision } from "./lib/git-revision.mjs";
import { CURRENT_CLEAN_KO_STATUS, assessKoStatusFreshness } from "./lib/ko-status-freshness.mjs";

const PLATFORM_QA_HANDOFF_SCHEMA = "learning-companion.platform-qa-handoff.v1";
const VALID_RESULTS = new Set(["PASS", "FAIL", "BLOCKED", "NT"]);
const PLACEHOLDER_EVIDENCE_NOTES = new Set(["tbd", "-", "--", "n/a", "na", "none", "no evidence", "placeholder", "todo"]);
const LEADING_EVIDENCE_DECORATION_PATTERN = /^(?:[`"'()[\]{}<>*_.,;:#\-\s]+|\d+[.)]\s*)+/;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const STATUS_PATH = ".codex-tmp/ko-evidence/current-status.json";

const PLATFORMS = [
  {
    id: "nativeMacManualQa",
    label: "Native Mac manual QA",
    qaPath: "dist/morning-demo/MAC_MANUAL_QA.md",
    receiptPath: ".codex-tmp/mac-manual-qa/real-run-receipt.json",
    validateCommand: "npm run mac:manual:validate:real",
    expectedRows: 27,
    requiredSessionFields: [
      "Date/time",
      "Reviewer",
      "Mac build/source",
      "macOS version",
      "Browser/source used",
      "Native build gate result",
      "Browser smoke gate result",
      "Total elapsed time",
      "Permission prompts observed",
      "Native save/import friction observed",
      "Biggest friction"
    ],
    cannotBeFilledFrom: [
      "Controlled browser smoke",
      "SwiftPM build success alone",
      "Fixture receipts",
      "Windows or HarmonyOS runs"
    ]
  },
  {
    id: "windowsStaticManualQa",
    label: "Windows static/manual QA",
    qaPath: "dist/morning-demo/WINDOWS_STATIC_QA.md",
    receiptPath: ".codex-tmp/windows-static-qa/real-run-receipt.json",
    validateCommand: "npm run windows:static:validate:real",
    expectedRows: 10,
    requiredSessionFields: [
      "Date/time",
      "Reviewer",
      "Windows browser/device",
      "Mirror build/source",
      "Transfer method",
      "Mac import method",
      "Static return contract gate result",
      "Mac Return Files import result",
      "Total elapsed time",
      "Windows local-file friction observed",
      "Return-file transfer friction observed",
      "Biggest friction"
    ],
    cannotBeFilledFrom: [
      "Static return contract checks",
      "Mac browser smoke",
      "Mac fixture import receipts",
      "Non-Windows local-folder inspection"
    ]
  },
  {
    id: "harmonyDeviceQa",
    label: "HarmonyOS device/toolchain QA",
    qaPath: "dist/morning-demo/HARMONY_DEVICE_QA.md",
    receiptPath: ".codex-tmp/harmony-device-qa/real-run-receipt.json",
    validateCommand: "npm run harmony:device:validate:real",
    expectedRows: 10,
    requiredSessionFields: [
      "Date/time",
      "Reviewer",
      "HarmonyOS device/build",
      "App build/source",
      "DevEco/toolchain gate result",
      "Import method",
      "Return transfer method",
      "Mac import method",
      "Mac Return Files import result",
      "Total elapsed time",
      "File-picker/storage friction observed",
      "Patch export/import friction observed",
      "Biggest friction"
    ],
    cannotBeFilledFrom: [
      "Harmony scaffold smoke",
      "HARMONY_SCAFFOLD_REPORT.json",
      "HARMONY_DEVECO_HANDOFF.md",
      "Generated patch fixtures"
    ]
  }
];

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(buildHelp());
  process.exit(0);
}
if (args.out === true) {
  throw new Error("--out requires a file path.");
}
if (args["markdown-out"] === true) {
  throw new Error("--markdown-out requires a file path.");
}
if (args.status === true) {
  throw new Error("--status requires a KO status JSON path.");
}

const handoff = await buildPlatformQaHandoff(args.status || STATUS_PATH);
if (args.out) {
  const outPath = resolve(String(args.out));
  await writePrivateFile(outPath, `${JSON.stringify(handoff, null, 2)}\n`);
}
if (args["markdown-out"]) {
  const markdownPath = resolve(String(args["markdown-out"]));
  await writePrivateFile(markdownPath, buildPlatformQaHandoffMarkdown(handoff));
}
console.log(buildConsoleSummary(
  handoff,
  args.out ? resolve(String(args.out)) : "",
  args["markdown-out"] ? resolve(String(args["markdown-out"])) : ""
));

async function writePrivateFile(path, content) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await chmod(path, 0o600).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
  await writeFile(path, content, { mode: 0o600 });
  await chmod(path, 0o600);
}

async function buildPlatformQaHandoff(statusPath) {
  if (!existsSync(statusPath)) {
    throw new Error(`Missing KO status file: ${statusPath}. Run: node scripts/validate-ko-evidence.mjs --allow-missing --out ${statusPath}`);
  }
  const currentRevision = await readCurrentRevision();
  const status = JSON.parse(await readFile(statusPath, "utf8"));
  const koStatusFreshness = assessKoStatusFreshness(status, currentRevision);
  const platformStatusById = new Map((Array.isArray(status.platformQaStatus) ? status.platformQaStatus : []).map((item) => [item.id, item]));
  const platforms = [];
  for (const config of PLATFORMS) {
    platforms.push(await summarizePlatform(config, platformStatusById.get(config.id), currentRevision));
  }
  return {
    schema: PLATFORM_QA_HANDOFF_SCHEMA,
    generatedAt: new Date().toISOString(),
    evidenceTier: "PLATFORM_QA_HANDOFF_ONLY",
    canClaimKo: false,
    claimBoundary: "This handoff only summarizes pending real platform QA work. It does not run Mac, Windows, or HarmonyOS QA and cannot satisfy KO evidence.",
    rawQaMarkdownRetained: false,
    rowNotesRetained: false,
    currentRevision,
    koStatusFreshness,
    executionFreshness: {
      status: currentRevision.gitAvailable && currentRevision.dirtyWorktree === false && koStatusFreshness.status === CURRENT_CLEAN_KO_STATUS
        ? "CURRENT_CLEAN_HEAD_PLATFORM_QA_HANDOFF"
        : "REVISION_REFRESH_REQUIRED_BEFORE_PLATFORM_QA",
      scope: "currentRevision records the source checkout state. koStatusFreshness records whether the local KO status file was regenerated for the same clean git HEAD before real platform QA.",
      requiredForRealRun: "Regenerate this handoff on the exact clean git HEAD used for real Mac, Windows, and HarmonyOS QA before filling platform receipts.",
      invalidatesWhen: [
        "git HEAD changes after this handoff is generated",
        "the worktree is dirty when this handoff is generated",
        "the KO status file was not regenerated or verified for currentRevision.gitHead",
        "the generated QA templates were not regenerated or verified for currentRevision.gitHead",
        "the app, mirror, or native build under test is not traceably produced from currentRevision.gitHead"
      ]
    },
    statusPath,
    koStatus: {
      canClaimKo: status.canClaimKo === true,
      evidenceTier: status.evidenceTier || "UNKNOWN",
      missingRequirements: (Array.isArray(status.requirements) ? status.requirements : [])
        .filter((item) => item.status !== "PASS")
        .map((item) => ({
          id: item.id || "UNKNOWN",
          status: item.status || "UNKNOWN",
          detail: item.detail || ""
        }))
    },
    platforms,
    nextCommands: {
      refreshKoStatus: `node scripts/validate-ko-evidence.mjs --allow-missing --out ${STATUS_PATH}`,
      finalKoGate: "npm run ko:validate -- --external <ko-evidence-review.json> --out .codex-tmp/ko-evidence/final.json",
      finalKoGateWithExplicitPlatformReceipts: "npm run ko:validate -- --external <ko-evidence-review.json> --mac-manual .codex-tmp/mac-manual-qa/real-run-receipt.json --windows-static .codex-tmp/windows-static-qa/real-run-receipt.json --harmony-device .codex-tmp/harmony-device-qa/real-run-receipt.json --out .codex-tmp/ko-evidence/final.json"
    },
    blockedOrNotExecuted: [
      "No Mac GUI manual QA was run by this handoff.",
      "No Windows browser/manual return QA was run by this handoff.",
      "No HarmonyOS DevEco/toolchain/device QA was run by this handoff.",
      "No platform screenshots, device logs, or human reviewer notes are created by this handoff.",
      "Approved external reading/video evidence and privacy review are still separate KO requirements."
    ]
  };
}

async function summarizePlatform(config, currentStatus = {}, currentRevision = {}) {
  const templateAvailable = existsSync(config.qaPath);
  const parsed = templateAvailable
    ? parseTables(await readFile(config.qaPath, "utf8"))
    : { fields: {}, rows: [] };
  const counts = summarizeRows(parsed.rows);
  const requiredSessionFields = config.requiredSessionFields.map((field) => ({
    field,
    filled: field === "Date/time"
      ? isIsoDateTimeWithTimezone(parsed.fields[field] || "")
      : hasConcreteQaText(parsed.fields[field] || "")
  }));
  const rowsNeedingConcreteNotes = parsed.rows.filter((row) => row.result !== "NT" && !hasEvidenceNote(row.notes)).length;
  return {
    id: config.id,
    label: config.label,
    qaPath: config.qaPath,
    receiptPath: config.receiptPath,
    templateAvailable,
    evidenceTier: "PLATFORM_QA_HANDOFF_ONLY",
    canClaimPlatform: false,
    currentKoStatus: {
      status: currentStatus.status || "UNKNOWN",
      detail: currentStatus.detail || "",
      evidencePath: currentStatus.evidencePath || ""
    },
    validateCommand: config.validateCommand,
    expectedRows: config.expectedRows,
    currentTemplateSummary: {
      rows: parsed.rows.length,
      ...counts,
      allRowsExecuted: parsed.rows.length === config.expectedRows && counts.nt === 0 && counts.invalid === 0,
      allRowsPass: parsed.rows.length === config.expectedRows && counts.pass === config.expectedRows && counts.fail === 0 && counts.blocked === 0 && counts.invalid === 0,
      anyRealRowsFilled: parsed.rows.some((row) => row.result !== "NT"),
      rowsNeedingConcreteNotes,
      requiredSessionFields,
      rowAreas: parsed.rows.map((row) => row.area).filter(Boolean)
    },
    executionChecklist: buildExecutionChecklist(config, currentRevision),
    nextRealRunSteps: [
      `Before filling this receipt, confirm the app, mirror, or native build under test is traceably produced from git HEAD ${currentRevision.gitHead || "TBD"} and that this handoff was regenerated from a clean worktree.`,
      `Fill ${config.qaPath} during a real ${config.label} run.`,
      "Use ISO Date/time with timezone, a concrete reviewer, and a concrete platform environment.",
      "Set every executed row to PASS, FAIL, or BLOCKED; full KO platform evidence requires all rows PASS.",
      "Every non-NT row must include a concrete Notes evidence reference.",
      `Validate with: ${config.validateCommand}`
    ],
    cannotBeFilledFrom: config.cannotBeFilledFrom
  };
}

function buildExecutionChecklist(config, currentRevision) {
  const gitHead = currentRevision.gitHead || "TBD";
  return {
    beforeRun: [
      `Regenerate this handoff on the exact clean git HEAD used for the real run: ${gitHead}.`,
      "Confirm the app, mirror, or native build under test is traceably produced from that HEAD.",
      "Keep rows as NT until they are executed on the named platform; use BLOCKED only with a concrete blocker note."
    ],
    duringRun: [
      `Fill ${config.qaPath} during the real ${config.label} run.`,
      "Fill every required session field with concrete values before treating row results as evidence.",
      "For every PASS, FAIL, or BLOCKED row, add a concrete Notes reference to what was observed."
    ],
    afterRun: [
      `Validate the filled receipt with: ${config.validateCommand}`,
      `Write the real-run receipt to: ${config.receiptPath}`,
      "Refresh KO status, readiness, platform handoff, and operator packet before making any next-major claim."
    ],
    notAcceptedEvidence: config.cannotBeFilledFrom
  };
}

function parseTables(markdown) {
  const fields = {};
  const rows = [];
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("| ") || line.includes("| ---")) continue;
    const cells = line.split("|").slice(1, -1).map((part) => part.trim());
    if (cells[0] === "Field" && cells[1] === "Value") continue;
    if (cells[0] === "Area" && cells[1] === "Steps") continue;
    if (cells.length >= 5) {
      rows.push({
        area: cells[0] || "",
        result: normalizeResult(cells[3] || ""),
        notes: cells[4] || ""
      });
    } else if (cells[0] && cells.length >= 2) {
      fields[cells[0]] = cells[1] || "";
    }
  }
  return { fields, rows };
}

function summarizeRows(rows) {
  return {
    pass: rows.filter((row) => row.result === "PASS").length,
    fail: rows.filter((row) => row.result === "FAIL").length,
    blocked: rows.filter((row) => row.result === "BLOCKED").length,
    nt: rows.filter((row) => row.result === "NT").length,
    invalid: rows.filter((row) => !VALID_RESULTS.has(row.result)).length
  };
}

function normalizeResult(value) {
  return String(value || "").trim().toUpperCase();
}

function hasConcreteQaText(value) {
  const text = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  const unwrappedText = text.replace(LEADING_EVIDENCE_DECORATION_PATTERN, "");
  return Boolean(text && !isPlaceholderQaText(text) && !isPlaceholderQaText(unwrappedText));
}

function isPlaceholderQaText(text) {
  return PLACEHOLDER_EVIDENCE_NOTES.has(text)
    || /^(tbd|todo|placeholder|no evidence|n\s*\/\s*a|na)(\b|[\s:;,.()[\]{}_-]|$)/.test(text);
}

function hasEvidenceNote(value) {
  const text = String(value || "").trim();
  return Boolean(text && !isPlaceholderEvidenceNote(text));
}

function isPlaceholderEvidenceNote(value) {
  const text = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  const unwrappedText = text.replace(LEADING_EVIDENCE_DECORATION_PATTERN, "");
  return isPlaceholderEvidenceText(text) || isPlaceholderEvidenceText(unwrappedText);
}

function isPlaceholderEvidenceText(text) {
  return PLACEHOLDER_EVIDENCE_NOTES.has(text) || /^(tbd|todo|placeholder|none|no evidence|n\s*\/\s*a|na)(\b|[\s:;,.()[\]{}_-]|$)/.test(text);
}

function isIsoDateTimeWithTimezone(value) {
  const text = String(value || "").trim();
  return ISO_DATE_TIME_PATTERN.test(text) && Number.isFinite(Date.parse(text));
}

function buildConsoleSummary(handoff, outPath, markdownPath = "") {
  const lines = [
    "platform_qa_handoff_ok",
    `Status file: ${handoff.statusPath}`,
    `KO claimable: ${handoff.koStatus.canClaimKo ? "YES" : "NO"}`,
    `Evidence tier: ${handoff.evidenceTier}`,
    `Can claim KO from this handoff: ${handoff.canClaimKo ? "YES" : "NO"}`,
    `Current git HEAD: ${handoff.currentRevision.gitHead}`,
    `Current worktree dirty: ${String(handoff.currentRevision.dirtyWorktree)}`,
    `KO status freshness: ${handoff.koStatusFreshness.status}`,
    `Platform handoff freshness: ${handoff.executionFreshness.status}`,
    `Freshness scope: ${handoff.executionFreshness.scope}`
  ];
  if (outPath) {
    lines.push(`Handoff JSON: ${outPath}`);
  }
  if (markdownPath) {
    lines.push(`Handoff Markdown: ${markdownPath}`);
  }
  lines.push("Real-run platform receipts are auto-selected by ko:next/ko:validate when present.");
  lines.push("", "Platform QA work:");
  for (const platform of handoff.platforms) {
    lines.push(`- ${platform.id}: ${platform.currentKoStatus.status}; ${platform.currentTemplateSummary.nt}/${platform.currentTemplateSummary.rows} rows still NT; validate with \`${platform.validateCommand}\``);
  }
  lines.push("", "Boundary:");
  for (const item of handoff.blockedOrNotExecuted) {
    lines.push(`- ${item}`);
  }
  return `${lines.join("\n")}\n`;
}

function buildPlatformQaHandoffMarkdown(handoff) {
  const lines = [
    "# Platform QA Execution Handoff",
    "",
    `Evidence tier: ${markdownInline(handoff.evidenceTier)}`,
    `Can claim KO: ${handoff.canClaimKo ? "true" : "false"}`,
    `Status file: ${markdownInline(handoff.statusPath)}`,
    `KO claimable before this handoff: ${handoff.koStatus.canClaimKo ? "YES" : "NO"}`,
    `Current git HEAD: ${markdownInline(handoff.currentRevision.gitHead)}`,
    `Current worktree dirty: ${markdownInline(String(handoff.currentRevision.dirtyWorktree))}`,
    `KO status freshness: ${markdownInline(handoff.koStatusFreshness.status)}`,
    `Handoff freshness: ${markdownInline(handoff.executionFreshness.status)}`,
    `Freshness scope: ${markdownInline(handoff.executionFreshness.scope)}`,
    `Required before real platform QA: ${markdownInline(handoff.executionFreshness.requiredForRealRun)}`,
    "",
    "Invalidates when:",
    ""
  ];
  for (const item of handoff.executionFreshness.invalidatesWhen) {
    lines.push(`- ${markdownInline(item)}`);
  }
  const freshnessProblems = handoff.koStatusFreshness.problems || [];
  if (freshnessProblems.length) {
    lines.push("", "## KO Status Freshness Problems", "");
    for (const problem of freshnessProblems) {
      lines.push(`- ${markdownInline(problem)}`);
    }
  }
  lines.push(
    "",
    "## Missing KO Requirements",
    ""
  );
  if (handoff.koStatus.missingRequirements.length) {
    for (const requirement of handoff.koStatus.missingRequirements) {
      lines.push(`- ${markdownInline(requirement.id)}: ${markdownInline(requirement.status)} - ${markdownInline(requirement.detail || "TBD")}`);
    }
  } else {
    lines.push("- none");
  }
  lines.push("", "## Platform Runs", "");
  for (const platform of handoff.platforms) {
    const summary = platform.currentTemplateSummary;
    lines.push(
      `### ${markdownInline(platform.label)}`,
      "",
      `- Platform ID: ${markdownInline(platform.id)}`,
      `- Current KO status: ${markdownInline(platform.currentKoStatus.status)} - ${markdownInline(platform.currentKoStatus.detail || "TBD")}`,
      `- QA template: ${markdownInline(platform.qaPath)}`,
      `- Expected rows: ${platform.expectedRows}`,
      `- Current rows: ${summary.rows} total; PASS ${summary.pass}; FAIL ${summary.fail}; BLOCKED ${summary.blocked}; NT ${summary.nt}; invalid ${summary.invalid}`,
      `- Rows needing concrete Notes: ${summary.rowsNeedingConcreteNotes}`,
      `- Can claim from this handoff: ${platform.canClaimPlatform ? "true" : "false"}`,
      "",
      "Required session fields:",
      ""
    );
    for (const field of summary.requiredSessionFields) {
      lines.push(`- ${field.filled ? "filled" : "missing"}: ${markdownInline(field.field)}`);
    }
    lines.push(
      "",
      "Validate after the real run:",
      "",
      "```bash",
      platform.validateCommand,
      "```",
      "",
      "Real-run steps:",
      ""
    );
    for (const step of platform.nextRealRunSteps) {
      lines.push(`- ${markdownInline(step)}`);
    }
    appendExecutionChecklistMarkdown(lines, platform.executionChecklist);
    lines.push("", "Cannot be filled from:", "");
    for (const item of platform.cannotBeFilledFrom) {
      lines.push(`- ${markdownInline(item)}`);
    }
    lines.push("", "Row areas:", "");
    for (const area of summary.rowAreas) {
      lines.push(`- ${markdownInline(area)}`);
    }
    lines.push("");
  }
  lines.push(
    "## Final Gate Commands",
    "",
    "```bash",
    handoff.nextCommands.refreshKoStatus,
    handoff.nextCommands.finalKoGate,
    handoff.nextCommands.finalKoGateWithExplicitPlatformReceipts,
    "```",
    "",
    "## Boundary",
    "",
    markdownInline(handoff.claimBoundary),
    ""
  );
  for (const item of handoff.blockedOrNotExecuted) {
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
    for (const item of items) {
      lines.push(`- ${markdownInline(item)}`);
    }
    lines.push("");
  }
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
  return `Build a non-claiming handoff for the remaining Learning Companion platform QA gates.

Usage:
  npm run platform:qa-handoff
  npm run platform:qa-handoff -- --out .codex-tmp/platform-qa-handoff/current.json
  npm run platform:qa-handoff -- --out .codex-tmp/platform-qa-handoff/current.json --markdown-out .codex-tmp/platform-qa-handoff/current.md

The handoff reads ${STATUS_PATH} plus the generated Mac, Windows, and HarmonyOS
QA templates. It does not run any platform QA and cannot satisfy KO evidence.`;
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
