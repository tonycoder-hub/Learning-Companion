#!/usr/bin/env node
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const args = parseArgs(process.argv.slice(2));
const statusPath = args.status || ".codex-tmp/ko-evidence/current-status.json";
const execFileAsync = promisify(execFile);
const PATH_ARGS = ["status", "external", "bilingual", "agent-loop", "mac-manual", "windows-static", "harmony-device"];

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
console.log(buildSummary(status, statusPath));

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

function buildSummary(status, statusPath) {
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
    "- URL here means a public learning-material link, not a repo, build, deployment, localhost, or private/internal page.",
    "- 中文：URL 就是网页链接；这里要的是公开学习材料链接，不是仓库、部署地址、本机地址或内部页面。",
    "- You can send it as: 阅读：https://... / 视频：https://... / 时间：00:15",
    "- Needed: one approved reading material URL, one approved video material URL, and the video timestamp to capture, e.g. 00:15.",
    "- Show input help: npm run external:source-help",
    "- Validate pasted input before running browser evidence: npm run external:source-intake -- --input \"阅读：https://... 视频：https://... 时间：00:15\"",
    "- Generate an approval request packet: npm run external:approval-request -- --intake-handoff .codex-tmp/external-source-validation/source-intake-handoff.json --out .codex-tmp/external-source-validation/source-approval-request.json --markdown-out .codex-tmp/external-source-validation/source-approval-request.md",
    "- Approved candidate command: npm run external:validate -- --approved-current-turn --reading-url <approved-reading-url> --video-url <approved-video-url> --video-timestamp <captured-timestamp> --approval-note \"<current-turn approval>\"",
    "- Privacy review template: npm run external:privacy-template -- --receipt <candidate-receipt.json> --out <privacy-review.json>",
    "- Privacy review validation: npm run external:privacy-review -- --receipt <candidate-receipt.json> --review <privacy-review.json> --out <ko-evidence-review.json>",
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

The summary explains:
- which KO requirements already pass,
- which evidence is still missing,
- what approved reading/video learning-material URLs are needed,
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
