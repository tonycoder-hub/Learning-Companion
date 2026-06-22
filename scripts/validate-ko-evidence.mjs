#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const KO_SCHEMA = "learning-companion.ko-evidence-review.v1";
const SELFTEST_SCHEMA = "learning-companion.ko-evidence-selftest.v1";
const BILINGUAL_SCHEMA = "learning-companion.bilingual-browser-smoke.v1";
const AGENT_LOOP_SCHEMA = "learning-companion.agent-study-loop-smoke.v1";
const EXTERNAL_CLAIM_SCHEMA = "learning-companion.external-source-ko-evidence-review.v1";
const MAC_MANUAL_QA_SCHEMA = "learning-companion.mac-manual-qa-receipt.v1";
const WINDOWS_STATIC_QA_SCHEMA = "learning-companion.windows-static-qa-receipt.v1";
const HARMONY_DEVICE_QA_SCHEMA = "learning-companion.harmony-device-qa-receipt.v1";
const PLATFORM_RESULTS = new Set(["PASS", "FAIL", "BLOCKED", "NT"]);
const PLACEHOLDER_EVIDENCE_NOTES = new Set(["tbd", "-", "--", "n/a", "na", "none", "no evidence", "placeholder", "todo"]);
const LEADING_EVIDENCE_DECORATION_PATTERN = /^(?:[`"'()[\]{}<>*_.,;:#\-\s]+|\d+[.)]\s*)+/;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const MAC_MANUAL_QA_AREAS = [
  "Launch",
  "Morning pack shortcut",
  "Sidecar",
  "Sidecar focus rail",
  "Floating",
  "Clipboard capture",
  "Quick Capture draft persistence",
  "Keyboard quick capture",
  "Source time staging",
  "Paste Source setup",
  "Today draft resume",
  "First-run First Note",
  "Today section map",
  "Focus Brief draft precedence",
  "Focus Brief question signal",
  "Open question handoff",
  "Question close loop",
  "Source timestamp jump",
  "Selected text capture",
  "Clipboard fallback guard",
  "Browser context",
  "Native import success",
  "Native import failure",
  "Export backup",
  "Relaunch persistence",
  "Mirror inspection",
  "Feishu dry-run artifact"
];
const WINDOWS_STATIC_QA_AREAS = [
  "Launch mirror home",
  "Read Today",
  "Pre-return fingerprint check",
  "Review return file",
  "Inbox return file",
  "Unsaved leave warning",
  "Manual transfer back",
  "Batch partial-import guard",
  "Wrong file guard",
  "Static boundary"
];
const HARMONY_DEVICE_QA_AREAS = [
  "DevEco/toolchain compile",
  "File candidate guard",
  "Import workspace JSON",
  "Import mirror bundle",
  "Failed import preservation",
  "Phone next action",
  "Review reveal",
  "Offline relaunch",
  "Capture patch export",
  "Review patch export"
];
const PLATFORM_FULL_RUN_FIELDS = {
  macManualQa: [
    ["dateTime", "Date/time"],
    ["reviewer", "Reviewer"],
    ["macBuildSource", "Mac build/source"],
    ["macosVersion", "macOS version"],
    ["browserSourceUsed", "Browser/source used"],
    ["nativeBuildGateResult", "Native build gate result"],
    ["browserSmokeGateResult", "Browser smoke gate result"],
    ["totalElapsedTime", "Total elapsed time"],
    ["permissionPromptsObserved", "Permission prompts observed"],
    ["nativeSaveImportFrictionObserved", "Native save/import friction observed"],
    ["biggestFriction", "Biggest friction"]
  ],
  windowsStaticQa: [
    ["dateTime", "Date/time"],
    ["reviewer", "Reviewer"],
    ["windowsBrowserDevice", "Windows browser/device"],
    ["mirrorBuildSource", "Mirror build/source"],
    ["transferMethod", "Transfer method"],
    ["macImportMethod", "Mac import method"],
    ["staticReturnContractGateResult", "Static return contract gate result"],
    ["macReturnFilesImportResult", "Mac Return Files import result"],
    ["totalElapsedTime", "Total elapsed time"],
    ["windowsLocalFileFrictionObserved", "Windows local-file friction observed"],
    ["returnFileTransferFrictionObserved", "Return-file transfer friction observed"],
    ["biggestFriction", "Biggest friction"]
  ],
  harmonyDeviceQa: [
    ["dateTime", "Date/time"],
    ["reviewer", "Reviewer"],
    ["harmonyDeviceBuild", "HarmonyOS device/build"],
    ["appBuildSource", "App build/source"],
    ["devEcoToolchainGateResult", "DevEco/toolchain gate result"],
    ["importMethod", "Import method"],
    ["returnTransferMethod", "Return transfer method"],
    ["macImportMethod", "Mac import method"],
    ["macReturnFilesImportResult", "Mac Return Files import result"],
    ["totalElapsedTime", "Total elapsed time"],
    ["filePickerStorageFrictionObserved", "File-picker/storage friction observed"],
    ["patchExportImportFrictionObserved", "Patch export/import friction observed"],
    ["biggestFriction", "Biggest friction"]
  ]
};
const DEFAULT_PLATFORM_RECEIPTS = {
  macManual: {
    pendingPath: ".codex-tmp/mac-manual-qa/receipt.json",
    realRunPath: ".codex-tmp/mac-manual-qa/real-run-receipt.json"
  },
  windowsStatic: {
    pendingPath: ".codex-tmp/windows-static-qa/receipt.json",
    realRunPath: ".codex-tmp/windows-static-qa/real-run-receipt.json"
  },
  harmonyDevice: {
    pendingPath: ".codex-tmp/harmony-device-qa/receipt.json",
    realRunPath: ".codex-tmp/harmony-device-qa/real-run-receipt.json"
  }
};

const args = parseArgs(process.argv.slice(2));
assertPathArgs(args, ["bilingual", "agent-loop", "mac-manual", "windows-static", "harmony-device", "external", "out"]);

if (args["self-test"]) {
  await runSelfTest();
} else {
  const report = await buildKoReport({
    bilingualPath: args.bilingual || ".codex-tmp/bilingual-browser-smoke/receipt.json",
    agentLoopPath: args["agent-loop"] || ".codex-tmp/agent-study-loop-smoke/receipt.json",
    macManualPath: args["mac-manual"] || selectPlatformReceiptPath(DEFAULT_PLATFORM_RECEIPTS.macManual),
    windowsStaticPath: args["windows-static"] || selectPlatformReceiptPath(DEFAULT_PLATFORM_RECEIPTS.windowsStatic),
    harmonyDevicePath: args["harmony-device"] || selectPlatformReceiptPath(DEFAULT_PLATFORM_RECEIPTS.harmonyDevice),
    externalPath: args.external || "",
    allowMissing: Boolean(args["allow-missing"])
  });
  const outPath = args.out || ".codex-tmp/ko-evidence/current-status.json";
  await writeJson(outPath, report);
  console.log(`${report.canClaimKo ? "ko_evidence_ready" : "ko_evidence_not_ready"} ${outPath}`);
  if (!report.canClaimKo && !args["allow-missing"]) process.exitCode = 1;
}

async function buildKoReport({
  bilingualPath,
  agentLoopPath,
  macManualPath,
  windowsStaticPath,
  harmonyDevicePath,
  externalPath,
  allowMissing = false,
  allowSelfTestFixtures = false
}) {
  const requirements = [];
  const blockers = [];
  const warnings = [];
  const evidence = {};
  const platformQaStatus = summarizePlatformQaStatus([
    {
      id: "nativeMacManualQa",
      label: "native Mac manual bilingual/runtime QA",
      path: macManualPath,
      schema: MAC_MANUAL_QA_SCHEMA,
      claimKey: "canClaimMacManualQaUsable",
      environmentKey: "macosVersion",
      environmentLabel: "macOS version",
      expectedAreas: MAC_MANUAL_QA_AREAS,
      requiredFullRunFields: PLATFORM_FULL_RUN_FIELDS.macManualQa,
      gateKeys: [
        ["nativeBuildGatePass", "Native build gate"],
        ["browserSmokeGatePass", "Browser smoke gate"]
      ]
    },
    {
      id: "windowsStaticManualQa",
      label: "Windows static/manual bilingual QA",
      path: windowsStaticPath,
      schema: WINDOWS_STATIC_QA_SCHEMA,
      claimKey: "canClaimWindowsStaticLoopUsable",
      environmentKey: "windowsBrowserDevice",
      environmentLabel: "Windows browser/device",
      expectedAreas: WINDOWS_STATIC_QA_AREAS,
      requiredFullRunFields: PLATFORM_FULL_RUN_FIELDS.windowsStaticQa,
      gateKeys: [
        ["staticReturnContractGatePass", "Static return contract gate"],
        ["macReturnFilesImportPass", "Mac Return Files import gate"]
      ]
    },
    {
      id: "harmonyDeviceQa",
      label: "HarmonyOS device/toolchain bilingual QA",
      path: harmonyDevicePath,
      schema: HARMONY_DEVICE_QA_SCHEMA,
      claimKey: "canClaimHarmonyDeviceRoundtripUsable",
      environmentKey: "harmonyDeviceBuild",
      environmentLabel: "HarmonyOS device/build",
      expectedAreas: HARMONY_DEVICE_QA_AREAS,
      requiredFullRunFields: PLATFORM_FULL_RUN_FIELDS.harmonyDeviceQa,
      gateKeys: [
        ["devEcoToolchainGatePass", "DevEco/toolchain gate"],
        ["macReturnFilesImportPass", "Mac Return Files import gate"]
      ]
    }
  ]);

  collectRequirement({
    requirements,
    blockers,
    label: "browser bilingual runtime",
    path: bilingualPath,
    validate: validateBilingualReceipt,
    evidenceKey: "bilingualRuntime",
    evidence,
    allowSelfTestFixtures
  });

  collectRequirement({
    requirements,
    blockers,
    label: "controlled learning loop",
    path: agentLoopPath,
    validate: validateAgentLoopReceipt,
    evidenceKey: "controlledLearningLoop",
    evidence,
    allowSelfTestFixtures
  });

  collectRequirement({
    requirements,
    blockers,
    label: "native Mac manual bilingual/runtime QA",
    path: macManualPath,
    validate: validateMacManualQaReceipt,
    evidenceKey: "nativeMacManualQa",
    evidence,
    allowSelfTestFixtures
  });

  collectRequirement({
    requirements,
    blockers,
    label: "Windows static/manual bilingual QA",
    path: windowsStaticPath,
    validate: validateWindowsStaticQaReceipt,
    evidenceKey: "windowsStaticManualQa",
    evidence,
    allowSelfTestFixtures
  });

  collectRequirement({
    requirements,
    blockers,
    label: "HarmonyOS device/toolchain bilingual QA",
    path: harmonyDevicePath,
    validate: validateHarmonyDeviceQaReceipt,
    evidenceKey: "harmonyDeviceQa",
    evidence,
    allowSelfTestFixtures
  });

  if (!externalPath) {
    blockers.push("Missing --external path to a privacy-reviewed approved-source KO evidence artifact.");
    requirements.push({
      id: "approvedExternalReadingVideo",
      status: "MISSING",
      evidencePath: "",
      detail: "Requires learning-companion.external-source-ko-evidence-review.v1 from npm run external:privacy-review."
    });
  } else {
    collectRequirement({
      requirements,
      blockers,
      label: "approved external reading/video evidence",
      path: externalPath,
      validate: (claim, claimPath) => validateExternalClaim(claim, claimPath, { allowSelfTestFixtures }),
      evidenceKey: "approvedExternalReadingVideo",
      evidence,
      allowSelfTestFixtures
    });
  }

  warnings.push("Controlled loop and browser bilingual receipts are local/headless evidence; they do not prove human learning comprehension.");

  const canClaimKo = blockers.length === 0;
  return {
    schema: KO_SCHEMA,
    generatedAt: new Date().toISOString(),
    evidenceTier: canClaimKo ? "KO_READY_EVIDENCE_REVIEW" : "KO_MISSING_EVIDENCE",
    canClaimKo,
    requirements,
    blockers,
    warnings,
    platformQaStatus,
    evidence,
    allowMissing,
    claimBoundary: {
      proves: canClaimKo ? [
        "Representative browser runtime can switch English and Chinese for the covered study-loop surfaces.",
        "The controlled browser study loop can capture, route, answer, and clear local learning-loop work.",
        "Native Mac manual QA, Windows static/manual QA, and HarmonyOS device/toolchain QA receipts are completed and passing.",
        "One approved reading source and one approved video source have privacy-reviewed evidence artifacts."
      ] : [],
      doesNotProve: [
        "All reading sites or all video platforms work.",
        "Authenticated/private sources are supported.",
        "Human comprehension beyond recorded evidence.",
        "Production packaging, live sync, or target devices/browsers outside the completed platform receipts."
      ]
    }
  };
}

function collectRequirement({ requirements, blockers, label, path, validate, evidenceKey, evidence, allowSelfTestFixtures = false }) {
  try {
    assertNonTbd(path, `${label} evidence path`);
    if (!allowSelfTestFixtures) rejectSelfTestPath(path, `${label} evidence path`);
    assert.equal(existsSync(path), true, `${label} evidence file missing: ${path}`);
    const parsed = readJsonSync(path, label);
    const summary = validate(parsed, path);
    requirements.push({
      id: evidenceKey,
      status: "PASS",
      evidencePath: path,
      detail: summary.detail
    });
    evidence[evidenceKey] = summary.evidence;
  } catch (error) {
    requirements.push({
      id: evidenceKey,
      status: "FAIL",
      evidencePath: path || "",
      detail: error.message
    });
    blockers.push(`${label}: ${error.message}`);
  }
}

function selectPlatformReceiptPath({ realRunPath, pendingPath }) {
  return existsSync(realRunPath) ? realRunPath : pendingPath;
}

function summarizePlatformQaStatus(items) {
  return items.map((item) => {
    const evidencePath = item.path || "";
    const base = {
      id: item.id,
      label: item.label,
      evidencePath,
      status: "MISSING",
      detail: "Platform QA receipt has not been generated."
    };
    if (!evidencePath) return base;
    if (!existsSync(evidencePath)) {
      return {
        ...base,
        detail: `Platform QA receipt missing: ${evidencePath}`
      };
    }

    try {
      const receipt = readJsonSync(evidencePath, item.label);
      if (receipt.schema !== item.schema) {
        return {
          ...base,
          status: "INVALID",
          detail: `Platform QA receipt schema mismatch: ${receipt.schema || "missing"}`
        };
      }
      const summary = receipt.summary || {};
      const gates = Object.fromEntries(item.gateKeys.map(([key, label]) => [
        key,
        {
          label,
          pass: summary[key] === true
        }
      ]));
      const claimAllowed = receipt.claimBoundary?.[item.claimKey] === true;
      const platformEvidenceErrors = [
        ...platformRowEvidenceErrors(receipt, item),
        ...platformClaimEvidenceErrors(receipt, item)
      ];
      const blockingReasons = summarizePlatformBlockingReasons({ summary, gates, claimAllowed, platformEvidenceErrors });
      return {
        ...base,
        status: classifyPlatformQaStatus({ summary, gates, claimAllowed, platformEvidenceErrors }),
        detail: blockingReasons.length ? blockingReasons.join("; ") : "Platform QA receipt is completed and claimable.",
        schema: receipt.schema,
        evidenceTier: receipt.evidenceTier || "",
        generatedAt: receipt.generatedAt || "",
        rows: {
          total: Number(summary.rows || 0),
          pass: Number(summary.pass || 0),
          fail: Number(summary.fail || 0),
          blocked: Number(summary.blocked || 0),
          nt: Number(summary.nt || 0),
          invalid: Number(summary.invalid || 0),
          allRowsExecuted: summary.allRowsExecuted === true,
          allRowsPass: summary.allRowsPass === true,
          anyRealRowsFilled: summary.anyRealRowsFilled === true
        },
        gates,
        session: {
          reviewer: receipt.sessionFields?.reviewer || "",
          environment: receipt.sessionFields?.[item.environmentKey] || ""
        },
        claimAllowed,
        errors: [...(Array.isArray(receipt.errors) ? receipt.errors : []), ...platformEvidenceErrors]
      };
    } catch (error) {
      return {
        ...base,
        status: "INVALID",
        detail: error.message
      };
    }
  });
}

function summarizePlatformBlockingReasons({ summary, gates, claimAllowed, platformEvidenceErrors = [] }) {
  const reasons = [];
  if (summary.ok !== true) reasons.push("receipt structure is not valid");
  if (summary.anyRealRowsFilled !== true) reasons.push("no real platform rows are filled");
  if (summary.allRowsPass !== true) reasons.push("rows are not all PASS");
  if (platformEvidenceErrors.length) reasons.push(...platformEvidenceErrors);
  Object.values(gates).forEach((gate) => {
    if (!gate.pass) reasons.push(`${gate.label} is not PASS`);
  });
  if (!claimAllowed) reasons.push("claim boundary is false");
  return reasons;
}

function classifyPlatformQaStatus({ summary, gates, claimAllowed, platformEvidenceErrors = [] }) {
  const rows = Number(summary.rows || 0);
  const nt = Number(summary.nt || 0);
  const allGatesPass = Object.values(gates).every((gate) => gate.pass);
  if (platformEvidenceErrors.length) return "INVALID_OR_INCOMPLETE";
  if (summary.ok === true && summary.allRowsPass === true && summary.anyRealRowsFilled === true && allGatesPass && claimAllowed) {
    return "PASSING_REAL_RUN";
  }
  if (summary.ok === true && summary.anyRealRowsFilled !== true && rows > 0 && nt === rows) {
    return "PENDING_NOT_RUN";
  }
  if (summary.ok === true && summary.anyRealRowsFilled === true) {
    return "PARTIAL_OR_BLOCKED_RUN";
  }
  return "INVALID_OR_INCOMPLETE";
}

function platformClaimEvidenceErrors(receipt, item) {
  const errors = [];
  const rowSummary = derivePlatformRowSummary(receipt.rows, item.expectedAreas?.length || 0);
  const receiptErrors = Array.isArray(receipt.errors) ? receipt.errors : [];
  if (!Array.isArray(receipt.errors)) {
    errors.push(`${item.label} receipt errors must be listed`);
  }
  if (receiptErrors.length > 0) {
    errors.push(`${item.label} receipt errors must be empty before a platform claim`);
  }
  if (receiptErrors.length > 0 && receipt.summary?.ok === true) {
    errors.push(`${item.label} summary ok must not be true while receipt errors are present`);
  }
  if (rowSummary.anyRealRowsFilled === true) {
    if (!isIsoDateTimeWithTimezone(receipt.sessionFields?.dateTime)) {
      errors.push(`${item.label} Date/time must be an ISO date-time with timezone`);
    }
    [
      ["reviewer", "Reviewer"],
      [item.environmentKey, item.environmentLabel]
    ].forEach(([key, label]) => {
      if (!hasConcretePlatformText(receipt.sessionFields?.[key])) {
        errors.push(`${item.label} ${label} must be filled with concrete platform QA evidence`);
      }
    });
  }
  if (rowSummary.allRowsExecuted === true) {
    for (const [key, label] of item.requiredFullRunFields || []) {
      if (!hasConcretePlatformText(receipt.sessionFields?.[key])) {
        errors.push(`${item.label} ${label} must be filled with concrete platform QA evidence`);
      }
    }
  }
  const gatesPass = item.gateKeys.every(([key]) => receipt.summary?.[key] === true);
  const fullRunFieldsConcrete = rowSummary.allRowsExecuted === true
    && (item.requiredFullRunFields || []).every(([key]) => hasConcretePlatformText(receipt.sessionFields?.[key]));
  const expectedClaimAllowed = receiptErrors.length === 0
    && rowSummary.allRowsPass === true
    && gatesPass
    && fullRunFieldsConcrete;
  const claimAllowed = receipt.claimBoundary?.[item.claimKey] === true;
  if (claimAllowed !== expectedClaimAllowed) {
    errors.push(`${item.label} claim boundary must match derived platform evidence: expected ${expectedClaimAllowed}`);
  }
  if (expectedClaimAllowed && receipt.evidenceTier !== "MANUAL_PLATFORM_QA") {
    errors.push(`${item.label} evidenceTier must be MANUAL_PLATFORM_QA only for a claimable full platform run`);
  }
  if (!expectedClaimAllowed && receipt.evidenceTier === "MANUAL_PLATFORM_QA") {
    errors.push(`${item.label} evidenceTier must not be MANUAL_PLATFORM_QA unless the full platform run is claimable`);
  }
  if (!rowSummary.anyRealRowsFilled && receipt.evidenceTier !== "PENDING_USER_GATE") {
    errors.push(`${item.label} evidenceTier must remain PENDING_USER_GATE until real platform rows are filled`);
  }
  if (rowSummary.anyRealRowsFilled && !expectedClaimAllowed && receipt.evidenceTier !== "PARTIAL_PLATFORM_QA") {
    errors.push(`${item.label} evidenceTier must be PARTIAL_PLATFORM_QA for non-claimable filled platform rows`);
  }
  return errors;
}

function platformRowEvidenceErrors(receipt, item) {
  const errors = [];
  const label = item.label;
  const rows = Array.isArray(receipt.rows) ? receipt.rows : null;
  if (!rows) {
    return [`${label} receipt rows must be listed for row-level evidence review`];
  }
  const expectedRows = item.expectedAreas?.length || 0;
  if (expectedRows && rows.length !== expectedRows) {
    errors.push(`${label} receipt rows length ${rows.length} does not match expected rows ${expectedRows}`);
  }
  if (expectedRows) {
    item.expectedAreas.forEach((expectedArea, index) => {
      const actualArea = String(rows[index]?.area || "").trim();
      if (actualArea !== expectedArea) {
        errors.push(`${label} row ${index + 1} area must be ${expectedArea}`);
      }
    });
  }
  const derived = derivePlatformRowSummary(rows, expectedRows);
  [
    ["rows", derived.rows],
    ["pass", derived.pass],
    ["fail", derived.fail],
    ["blocked", derived.blocked],
    ["nt", derived.nt],
    ["invalid", derived.invalid]
  ].forEach(([key, expected]) => {
    if (Number(receipt.summary?.[key] || 0) !== expected) {
      errors.push(`${label} summary ${key} does not match rows: expected ${expected}`);
    }
  });
  [
    ["allRowsExecuted", derived.allRowsExecuted],
    ["allRowsPass", derived.allRowsPass],
    ["anyRealRowsFilled", derived.anyRealRowsFilled]
  ].forEach(([key, expected]) => {
    if (Boolean(receipt.summary?.[key]) !== expected) {
      errors.push(`${label} summary ${key} does not match rows: expected ${expected}`);
    }
  });
  rows.forEach((row, index) => {
    const result = String(row?.result || "").trim().toUpperCase();
    if (result && result !== "NT" && !hasEvidenceNote(row?.notes)) {
      errors.push(`${label} row ${index + 1} (${row?.area || "unnamed"}) is ${result} without a concrete QA note or evidence reference`);
    }
  });
  return errors;
}

function derivePlatformRowSummary(rows, expectedRows = 0) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const normalized = safeRows.map((row) => String(row?.result || "").trim().toUpperCase());
  const summary = {
    rows: safeRows.length,
    pass: normalized.filter((result) => result === "PASS").length,
    fail: normalized.filter((result) => result === "FAIL").length,
    blocked: normalized.filter((result) => result === "BLOCKED").length,
    nt: normalized.filter((result) => result === "NT").length,
    invalid: normalized.filter((result) => !PLATFORM_RESULTS.has(result)).length
  };
  const rowCountMatches = !expectedRows || summary.rows === expectedRows;
  return {
    ...summary,
    allRowsExecuted: rowCountMatches && summary.rows > 0 && summary.nt === 0 && summary.invalid === 0,
    allRowsPass: rowCountMatches && summary.rows > 0 && summary.pass === summary.rows && summary.fail === 0 && summary.blocked === 0 && summary.nt === 0 && summary.invalid === 0,
    anyRealRowsFilled: normalized.some((result) => result !== "NT")
  };
}

function hasEvidenceNote(value) {
  const text = String(value || "").trim();
  return Boolean(text && !isPlaceholderEvidenceNote(text));
}

function hasConcretePlatformText(value) {
  const text = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  const unwrappedText = text.replace(LEADING_EVIDENCE_DECORATION_PATTERN, "");
  return Boolean(text && !isPlaceholderPlatformText(text) && !isPlaceholderPlatformText(unwrappedText));
}

function isPlaceholderPlatformText(text) {
  return PLACEHOLDER_EVIDENCE_NOTES.has(text)
    || /^(tbd|todo|placeholder|no evidence|n\s*\/\s*a|na)(\b|[\s:;,.()[\]{}_-]|$)/.test(text);
}

function isIsoDateTimeWithTimezone(value) {
  const text = String(value || "").trim();
  return ISO_DATE_TIME_PATTERN.test(text) && Number.isFinite(Date.parse(text));
}

function isPlaceholderEvidenceNote(value) {
  const text = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  const unwrappedText = text.replace(LEADING_EVIDENCE_DECORATION_PATTERN, "");
  return isPlaceholderEvidenceText(text) || isPlaceholderEvidenceText(unwrappedText);
}

function isPlaceholderEvidenceText(text) {
  return PLACEHOLDER_EVIDENCE_NOTES.has(text) || /^(tbd|todo|placeholder|none|no evidence|n\s*\/\s*a|na)(\b|[\s:;,.()[\]{}_-]|$)/.test(text);
}

function validateBilingualReceipt(receipt) {
  assert.equal(receipt.schema, BILINGUAL_SCHEMA, "bilingual receipt schema mismatch");
  assert.equal(receipt.result, "PASS", "bilingual browser smoke must PASS");
  assert.equal(receipt.evidenceType, "CONTROLLED_BROWSER_RUNTIME_SMOKE", "bilingual receipt evidence type mismatch");
  [
    "staticShellChromeZh",
    "staticShellChromeEnAfterSwitch",
    "newSessionDefaultZh",
    "exportCopyZh",
    "exportCopyEn",
    "studyShellZh",
    "studyShellEnAfterSwitch",
    "todayLearningFlowZh",
    "reviewToolbarZh",
    "mainLoopCaptureZh",
    "synthesisOverwriteConfirmZh",
    "mirrorImportConfirmZh",
    "recentStackZh",
    "searchResultsZh",
    "activityHintZh",
    "importReceiptZh",
    "importReceiptEnAfterSwitch",
    "returnedWorkNudgeZh",
    "returnedWorkNudgeEnAfterSwitch",
    "returnFilePreviewZh",
    "noHorizontalOverflow"
  ].forEach((key) => assert.equal(receipt.checks?.[key], true, `bilingual check ${key} must be true`));
  return {
    detail: "Representative English/Chinese runtime switching receipt passed.",
    evidence: {
      schema: receipt.schema,
      generatedAt: receipt.generatedAt,
      evidenceType: receipt.evidenceType,
      checks: receipt.checks
    }
  };
}

function validateMacManualQaReceipt(receipt) {
  assert.equal(receipt.schema, MAC_MANUAL_QA_SCHEMA, "Mac manual QA receipt schema mismatch");
  const item = {
    label: "Mac manual QA",
    environmentKey: "macosVersion",
    environmentLabel: "macOS version",
    expectedAreas: MAC_MANUAL_QA_AREAS,
    requiredFullRunFields: PLATFORM_FULL_RUN_FIELDS.macManualQa,
    gateKeys: [
      ["nativeBuildGatePass", "Native build gate"],
      ["browserSmokeGatePass", "Browser smoke gate"]
    ],
    claimKey: "canClaimMacManualQaUsable"
  };
  assert.deepEqual(platformRowEvidenceErrors(receipt, item), [], "Mac manual QA rows must match the expected QA matrix and include evidence notes for every non-NT result");
  assert.deepEqual(platformClaimEvidenceErrors(receipt, item), [], "Mac manual QA session fields, tier, errors, and claim boundary must match derived evidence");
  assertTrue(receipt.summary?.ok, "Mac manual QA receipt must be structurally valid");
  assertTrue(receipt.summary?.allRowsPass, "Mac manual QA rows must all PASS");
  assertTrue(receipt.summary?.nativeBuildGatePass, "Mac native build gate must PASS");
  assertTrue(receipt.summary?.browserSmokeGatePass, "Mac browser smoke gate must PASS");
  assertTrue(receipt.summary?.anyRealRowsFilled, "Mac manual QA must include a real filled run");
  assertTrue(receipt.claimBoundary?.canClaimMacManualQaUsable, "Mac manual QA claim boundary must be true");
  return {
    detail: "Native Mac manual/runtime QA receipt is completed and passing.",
    evidence: {
      schema: receipt.schema,
      generatedAt: receipt.generatedAt,
      evidenceTier: receipt.evidenceTier,
      rows: receipt.summary.rows,
      pass: receipt.summary.pass,
      reviewer: receipt.sessionFields?.reviewer,
      macosVersion: receipt.sessionFields?.macosVersion
    }
  };
}

function validateWindowsStaticQaReceipt(receipt) {
  assert.equal(receipt.schema, WINDOWS_STATIC_QA_SCHEMA, "Windows static QA receipt schema mismatch");
  const item = {
    label: "Windows static QA",
    environmentKey: "windowsBrowserDevice",
    environmentLabel: "Windows browser/device",
    expectedAreas: WINDOWS_STATIC_QA_AREAS,
    requiredFullRunFields: PLATFORM_FULL_RUN_FIELDS.windowsStaticQa,
    gateKeys: [
      ["staticReturnContractGatePass", "Static return contract gate"],
      ["macReturnFilesImportPass", "Mac Return Files import gate"]
    ],
    claimKey: "canClaimWindowsStaticLoopUsable"
  };
  assert.deepEqual(platformRowEvidenceErrors(receipt, item), [], "Windows static QA rows must match the expected QA matrix and include evidence notes for every non-NT result");
  assert.deepEqual(platformClaimEvidenceErrors(receipt, item), [], "Windows static QA session fields, tier, errors, and claim boundary must match derived evidence");
  assertTrue(receipt.summary?.ok, "Windows static QA receipt must be structurally valid");
  assertTrue(receipt.summary?.allRowsPass, "Windows static QA rows must all PASS");
  assertTrue(receipt.summary?.staticReturnContractGatePass, "Windows static-return contract gate must PASS");
  assertTrue(receipt.summary?.macReturnFilesImportPass, "Windows Mac Return Files import gate must PASS");
  assertTrue(receipt.summary?.anyRealRowsFilled, "Windows static QA must include a real filled run");
  assertTrue(receipt.claimBoundary?.canClaimWindowsStaticLoopUsable, "Windows static QA claim boundary must be true");
  return {
    detail: "Windows static/manual QA receipt is completed and passing.",
    evidence: {
      schema: receipt.schema,
      generatedAt: receipt.generatedAt,
      evidenceTier: receipt.evidenceTier,
      rows: receipt.summary.rows,
      pass: receipt.summary.pass,
      reviewer: receipt.sessionFields?.reviewer,
      windowsBrowserDevice: receipt.sessionFields?.windowsBrowserDevice
    }
  };
}

function validateHarmonyDeviceQaReceipt(receipt) {
  assert.equal(receipt.schema, HARMONY_DEVICE_QA_SCHEMA, "HarmonyOS device QA receipt schema mismatch");
  const item = {
    label: "HarmonyOS device QA",
    environmentKey: "harmonyDeviceBuild",
    environmentLabel: "HarmonyOS device/build",
    expectedAreas: HARMONY_DEVICE_QA_AREAS,
    requiredFullRunFields: PLATFORM_FULL_RUN_FIELDS.harmonyDeviceQa,
    gateKeys: [
      ["devEcoToolchainGatePass", "DevEco/toolchain gate"],
      ["macReturnFilesImportPass", "Mac Return Files import gate"]
    ],
    claimKey: "canClaimHarmonyDeviceRoundtripUsable"
  };
  assert.deepEqual(platformRowEvidenceErrors(receipt, item), [], "HarmonyOS device QA rows must match the expected QA matrix and include evidence notes for every non-NT result");
  assert.deepEqual(platformClaimEvidenceErrors(receipt, item), [], "HarmonyOS device QA session fields, tier, errors, and claim boundary must match derived evidence");
  assertTrue(receipt.summary?.ok, "HarmonyOS device QA receipt must be structurally valid");
  assertTrue(receipt.summary?.allRowsPass, "HarmonyOS device QA rows must all PASS");
  assertTrue(receipt.summary?.devEcoToolchainGatePass, "HarmonyOS DevEco/toolchain gate must PASS");
  assertTrue(receipt.summary?.macReturnFilesImportPass, "HarmonyOS Mac Return Files import gate must PASS");
  assertTrue(receipt.summary?.anyRealRowsFilled, "HarmonyOS device QA must include a real filled run");
  assertTrue(receipt.claimBoundary?.canClaimHarmonyDeviceRoundtripUsable, "HarmonyOS device QA claim boundary must be true");
  return {
    detail: "HarmonyOS device/toolchain QA receipt is completed and passing.",
    evidence: {
      schema: receipt.schema,
      generatedAt: receipt.generatedAt,
      evidenceTier: receipt.evidenceTier,
      rows: receipt.summary.rows,
      pass: receipt.summary.pass,
      reviewer: receipt.sessionFields?.reviewer,
      harmonyDeviceBuild: receipt.sessionFields?.harmonyDeviceBuild
    }
  };
}

function validateAgentLoopReceipt(receipt) {
  assert.equal(receipt.schema, AGENT_LOOP_SCHEMA, "agent loop receipt schema mismatch");
  assert.equal(receipt.result, "PASS", "agent study loop must PASS");
  assert.equal(receipt.evidenceType, "CONTROLLED_AGENT_BROWSER_SMOKE", "agent loop evidence type mismatch");
  assert.equal(receipt.provesRealUserDogfood, false, "controlled loop must not claim real user dogfood");
  [
    "sidecarCaptureRail",
    "firstCaptureDecision",
    "notesClearsLoop",
    "openQuestionOwnsLoop",
    "linkedAnswerClosesQuestion",
    "finalLoopClear",
    "noHorizontalOverflow"
  ].forEach((key) => assert.equal(receipt.checks?.[key], true, `agent loop check ${key} must be true`));
  return {
    detail: "Controlled capture/question/answer/notes loop receipt passed.",
    evidence: {
      schema: receipt.schema,
      generatedAt: receipt.generatedAt,
      evidenceType: receipt.evidenceType,
      checks: receipt.checks
    }
  };
}

function validateExternalClaim(claim, claimPath, { allowSelfTestFixtures = false } = {}) {
  assert.equal(claim.schema, EXTERNAL_CLAIM_SCHEMA, "external evidence schema mismatch");
  assert.equal(claim.evidenceTier, "APPROVED_SOURCE_PRIVACY_REVIEWED", "external evidence tier mismatch");
  assert.equal(claim.canClaimExternalKo, true, "external evidence must allow external KO claim");
  assert.equal(claim.fixtureOnly, false, "external evidence must explicitly not be fixture-only");
  assert.equal(claim.reviewKind, "HUMAN_PRIVACY_REVIEW", "external evidence must come from a human privacy review");
  if (!allowSelfTestFixtures) {
    rejectSelfTestPath(claimPath, "external evidence path");
    rejectSelfTestPath(claim.receiptPath, "external receipt path");
    rejectSelfTestPath(claim.reviewPath, "external review path");
  }
  assert.equal(existsSync(claim.receiptPath), true, `external receipt missing: ${claim.receiptPath}`);
  assert.equal(existsSync(claim.reviewPath), true, `external review missing: ${claim.reviewPath}`);
  assertExternalSource(claim.reading, "reading", { allowSelfTestFixtures });
  assertExternalSource(claim.video, "video", { allowSelfTestFixtures });
  assertNonTbd(claim.video?.timestamp, "video timestamp");
  assertExternalRunContext(claim.runContext);
  return {
    detail: "Approved reading/video evidence has a privacy-reviewed external KO artifact.",
    evidence: {
      schema: claim.schema,
      generatedAt: claim.generatedAt,
      evidenceTier: claim.evidenceTier,
      reviewer: claim.reviewer,
      reviewedAt: claim.reviewedAt,
      readingUrl: claim.reading.url,
      videoUrl: claim.video.url,
      videoTimestamp: claim.video.timestamp,
      runContext: {
        appRevision: claim.runContext.appRevision,
        browser: claim.runContext.browser,
        network: claim.runContext.network
      }
    }
  };
}

function assertExternalSource(source, label, { allowSelfTestFixtures = false } = {}) {
  assertHttpUrl(source?.url, `${label}.url`);
  assertApprovedExternalUrl(source.url, `${label}.url`);
  assertNonTbd(source.title, `${label}.title`);
  assert.equal(Array.isArray(source.files), true, `${label}.files must be listed`);
  assert.ok(source.files.length > 0, `${label}.files must not be empty`);
  source.files.forEach((file) => {
    if (!allowSelfTestFixtures) rejectSelfTestPath(file, `${label} evidence file`);
    assert.equal(existsSync(file), true, `${label} evidence file missing: ${file}`);
  });
}

function assertApprovedExternalUrl(value, label) {
  assertHttpUrl(value, label);
  const parsed = new URL(value);
  const host = normalizeHostname(parsed.hostname);
  if (isDisallowedExternalHost(host)) {
    throw new Error(`${label} must be a public, non-private approved source URL; ${parsed.hostname} is local, private, reserved, or internal.`);
  }
  for (const [key] of parsed.searchParams) {
    if (isSensitiveQueryKey(key)) throw new Error(`${label} query key ${key} looks sensitive.`);
  }
}

function isSensitiveQueryKey(key) {
  const compact = String(key || "").trim().toLowerCase().replace(/[-_\s]/g, "");
  return new Set([
    "token",
    "accesstoken",
    "idtoken",
    "refreshtoken",
    "session",
    "sessionid",
    "auth",
    "authtoken",
    "authorization",
    "apikey",
    "key",
    "secret",
    "password",
    "passcode",
    "code",
    "jwt",
    "sig",
    "signature",
    "expires",
    "expiry",
    "expiration",
    "expiresin",
    "awsaccesskeyid",
    "xamzsignature",
    "xamzcredential",
    "xamzsecuritytoken",
    "xamzexpires",
    "xamzsignedheaders",
    "xgoogsignature",
    "xgoogcredential",
    "xgoogsecuritytoken",
    "xgoogexpires",
    "xgoogsignedheaders",
    "xgoogalgorithm",
    "keypairid",
    "policy"
  ]).has(compact);
}

function assertExternalRunContext(runContext) {
  assert.equal(runContext?.schema, "learning-companion.external-source-run-context.v1", "external claim runContext schema mismatch");
  assertHttpUrl(runContext.app?.url, "external claim runContext.app.url");
  assertNonTbd(runContext.app?.root, "external claim runContext.app.root");
  assertGitHead(runContext.appRevision?.gitHead, "external claim runContext.appRevision.gitHead");
  assert.equal(typeof runContext.appRevision?.dirtyWorktree, "boolean", "external claim runContext dirtyWorktree must be boolean");
  assert.equal(Number.isInteger(runContext.appRevision?.statusLineCount), true, "external claim runContext statusLineCount must be an integer");
  assert.equal(typeof runContext.appRevision?.statusTruncated, "boolean", "external claim runContext statusTruncated must be boolean");
  assertNonTbd(runContext.browser?.chromePath, "external claim runContext.browser.chromePath");
  assert.equal(runContext.browser?.headless, true, "external claim runContext browser must be headless");
  assert.equal(runContext.browser?.profileMode, "throwaway-profile", "external claim runContext browser profile mode must be throwaway-profile");
  assert.equal(runContext.browser?.profileRetained, false, "external claim runContext browser profile must be cleaned");
  assert.equal(runContext.browser?.profileCleanup?.attempted, true, "external claim runContext browser profile cleanup must be attempted");
  assert.equal(runContext.browser?.profileCleanup?.ok, true, "external claim runContext browser profile cleanup must pass");
  assert.equal(runContext.browser?.profileCleanup?.retained, false, "external claim runContext browser profile cleanup must not retain the profile");
  assert.equal(runContext.viewport?.app?.width, 1440, "external claim runContext app viewport width mismatch");
  assert.equal(runContext.viewport?.sourceEvidence?.width, 720, "external claim runContext source-evidence viewport width mismatch");
  assert.equal(runContext.network?.mode, "APPROVED_REMOTE_SOURCE_AND_LOCAL_APP", "external claim runContext network mode must be approved remote source plus local app");
  assert.equal(runContext.network?.localAppServer, "127.0.0.1 ephemeral", "external claim runContext local app server must be ephemeral localhost");
}

async function runSelfTest() {
  const root = resolve(".codex-tmp/ko-evidence-selftest", timestampSlug(new Date()));
  await mkdir(root, { recursive: true, mode: 0o700 });
  const fixtures = await createKoFixtures(root);
  const passReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: fixtures.macManualPath,
    windowsStaticPath: fixtures.windowsStaticPath,
    harmonyDevicePath: fixtures.harmonyDevicePath,
    externalPath: fixtures.externalPath,
    allowSelfTestFixtures: true
  });
  assert.equal(passReport.canClaimKo, true);
  assert.deepEqual(passReport.platformQaStatus.map((item) => item.status), [
    "PASSING_REAL_RUN",
    "PASSING_REAL_RUN",
    "PASSING_REAL_RUN"
  ]);

  const missingReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: fixtures.macManualPath,
    windowsStaticPath: fixtures.windowsStaticPath,
    harmonyDevicePath: fixtures.harmonyDevicePath,
    externalPath: "",
    allowMissing: true
  });
  assert.equal(missingReport.canClaimKo, false);
  assert.ok(missingReport.blockers.some((item) => item.includes("Missing --external")));

  const selfTestExternal = {
    ...fixtures.externalClaim,
    fixtureOnly: true,
    reading: {
      ...fixtures.externalClaim.reading,
      url: "https://example.com/approved-reading"
    }
  };
  const selfTestExternalPath = join(root, "selftest-like-external.json");
  await writeJson(selfTestExternalPath, selfTestExternal);
  const rejectedReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: fixtures.macManualPath,
    windowsStaticPath: fixtures.windowsStaticPath,
    harmonyDevicePath: fixtures.harmonyDevicePath,
    externalPath: selfTestExternalPath,
    allowMissing: true,
    allowSelfTestFixtures: true
  });
  assert.equal(rejectedReport.canClaimKo, false);
  assert.ok(rejectedReport.blockers.some((item) => item.includes("fixture-only")));

  const missingRunContextExternalPath = join(root, "missing-run-context-external.json");
  await writeJson(missingRunContextExternalPath, {
    ...fixtures.externalClaim,
    runContext: undefined
  });
  const missingRunContextReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: fixtures.macManualPath,
    windowsStaticPath: fixtures.windowsStaticPath,
    harmonyDevicePath: fixtures.harmonyDevicePath,
    externalPath: missingRunContextExternalPath,
    allowMissing: true,
    allowSelfTestFixtures: true
  });
  assert.equal(missingRunContextReport.canClaimKo, false);
  assert.ok(missingRunContextReport.blockers.some((item) => item.includes("runContext schema mismatch")));

  const retainedProfileExternalPath = join(root, "retained-profile-external.json");
  await writeJson(retainedProfileExternalPath, {
    ...fixtures.externalClaim,
    runContext: {
      ...fixtures.externalClaim.runContext,
      browser: {
        ...fixtures.externalClaim.runContext.browser,
        profileRetained: true,
        profileCleanup: {
          attempted: true,
          ok: true,
          retained: true,
          error: "profile still exists after cleanup"
        }
      }
    }
  });
  const retainedProfileReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: fixtures.macManualPath,
    windowsStaticPath: fixtures.windowsStaticPath,
    harmonyDevicePath: fixtures.harmonyDevicePath,
    externalPath: retainedProfileExternalPath,
    allowMissing: true,
    allowSelfTestFixtures: true
  });
  assert.equal(retainedProfileReport.canClaimKo, false);
  assert.ok(retainedProfileReport.blockers.some((item) => item.includes("browser profile must be cleaned")));

  const failedProfileCleanupExternalPath = join(root, "failed-profile-cleanup-external.json");
  await writeJson(failedProfileCleanupExternalPath, {
    ...fixtures.externalClaim,
    runContext: {
      ...fixtures.externalClaim.runContext,
      browser: {
        ...fixtures.externalClaim.runContext.browser,
        profileRetained: false,
        profileCleanup: {
          attempted: true,
          ok: false,
          retained: false,
          error: "ENOTEMPTY"
        }
      }
    }
  });
  const failedProfileCleanupReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: fixtures.macManualPath,
    windowsStaticPath: fixtures.windowsStaticPath,
    harmonyDevicePath: fixtures.harmonyDevicePath,
    externalPath: failedProfileCleanupExternalPath,
    allowMissing: true,
    allowSelfTestFixtures: true
  });
  assert.equal(failedProfileCleanupReport.canClaimKo, false);
  assert.ok(failedProfileCleanupReport.blockers.some((item) => item.includes("profile cleanup must pass")));

  const localExternalSourcePath = join(root, "local-external-source.json");
  await writeJson(localExternalSourcePath, {
    ...fixtures.externalClaim,
    reading: {
      ...fixtures.externalClaim.reading,
      url: "http://127.0.0.1:12345/private-reading"
    }
  });
  const localExternalSourceReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: fixtures.macManualPath,
    windowsStaticPath: fixtures.windowsStaticPath,
    harmonyDevicePath: fixtures.harmonyDevicePath,
    externalPath: localExternalSourcePath,
    allowMissing: true,
    allowSelfTestFixtures: true
  });
  assert.equal(localExternalSourceReport.canClaimKo, false);
  assert.ok(localExternalSourceReport.blockers.some((item) => item.includes("public, non-private approved source URL")));

  const mappedIpv6ExternalSourcePath = join(root, "mapped-ipv6-external-source.json");
  await writeJson(mappedIpv6ExternalSourcePath, {
    ...fixtures.externalClaim,
    reading: {
      ...fixtures.externalClaim.reading,
      url: "http://[::ffff:127.0.0.1]/private-reading"
    }
  });
  const mappedIpv6ExternalSourceReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: fixtures.macManualPath,
    windowsStaticPath: fixtures.windowsStaticPath,
    harmonyDevicePath: fixtures.harmonyDevicePath,
    externalPath: mappedIpv6ExternalSourcePath,
    allowMissing: true,
    allowSelfTestFixtures: true
  });
  assert.equal(mappedIpv6ExternalSourceReport.canClaimKo, false);
  assert.ok(mappedIpv6ExternalSourceReport.blockers.some((item) => item.includes("public, non-private approved source URL")));

  const sensitiveQueryExternalPath = join(root, "sensitive-query-external-source.json");
  await writeJson(sensitiveQueryExternalPath, {
    ...fixtures.externalClaim,
    video: {
      ...fixtures.externalClaim.video,
      url: "https://www.youtube.com/watch?v=learning-companion-approved-video&token=abc"
    }
  });
  const sensitiveQueryExternalReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: fixtures.macManualPath,
    windowsStaticPath: fixtures.windowsStaticPath,
    harmonyDevicePath: fixtures.harmonyDevicePath,
    externalPath: sensitiveQueryExternalPath,
    allowMissing: true,
    allowSelfTestFixtures: true
  });
  assert.equal(sensitiveQueryExternalReport.canClaimKo, false);
  assert.ok(sensitiveQueryExternalReport.blockers.some((item) => item.includes("query key token looks sensitive")));

  const signedQueryExternalPath = join(root, "signed-query-external-source.json");
  await writeJson(signedQueryExternalPath, {
    ...fixtures.externalClaim,
    video: {
      ...fixtures.externalClaim.video,
      url: "https://www.youtube.com/watch?v=learning-companion-approved-video&X-Goog-Signature=abc"
    }
  });
  const signedQueryExternalReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: fixtures.macManualPath,
    windowsStaticPath: fixtures.windowsStaticPath,
    harmonyDevicePath: fixtures.harmonyDevicePath,
    externalPath: signedQueryExternalPath,
    allowMissing: true,
    allowSelfTestFixtures: true
  });
  assert.equal(signedQueryExternalReport.canClaimKo, false);
  assert.ok(signedQueryExternalReport.blockers.some((item) => item.includes("query key X-Goog-Signature looks sensitive")));

  const pendingPlatformPath = join(root, "pending-mac-manual-receipt.json");
  await writeJson(pendingPlatformPath, {
    ...fixtures.macManualReceipt,
    evidenceTier: "PENDING_USER_GATE",
    rows: fixtures.macManualReceipt.rows.map((row) => ({ ...row, result: "NT", notes: "" })),
    summary: {
      ...fixtures.macManualReceipt.summary,
      pass: 0,
      nt: fixtures.macManualReceipt.summary.rows,
      allRowsExecuted: false,
      allRowsPass: false,
      nativeBuildGatePass: false,
      browserSmokeGatePass: false,
      anyRealRowsFilled: false
    },
    claimBoundary: {
      ...fixtures.macManualReceipt.claimBoundary,
      canClaimMacManualQaUsable: false
    }
  });
  const pendingPlatformReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: pendingPlatformPath,
    windowsStaticPath: fixtures.windowsStaticPath,
    harmonyDevicePath: fixtures.harmonyDevicePath,
    externalPath: fixtures.externalPath,
    allowMissing: true,
    allowSelfTestFixtures: true
  });
  assert.equal(pendingPlatformReport.canClaimKo, false);
  assert.ok(pendingPlatformReport.blockers.some((item) => item.includes("Mac manual QA rows must all PASS")));
  const pendingMacStatus = pendingPlatformReport.platformQaStatus.find((item) => item.id === "nativeMacManualQa");
  assert.equal(pendingMacStatus?.status, "PENDING_NOT_RUN");
  assert.ok(pendingMacStatus?.detail.includes("no real platform rows are filled"));

  const defaultPendingPath = join(root, "default-platform-receipt.json");
  const defaultRealRunPath = join(root, "default-platform-real-run-receipt.json");
  await writeJson(defaultPendingPath, { schema: "pending.fixture" });
  assert.equal(
    selectPlatformReceiptPath({ pendingPath: defaultPendingPath, realRunPath: defaultRealRunPath }),
    defaultPendingPath
  );
  await writeJson(defaultRealRunPath, { schema: "real.fixture" });
  assert.equal(
    selectPlatformReceiptPath({ pendingPath: defaultPendingPath, realRunPath: defaultRealRunPath }),
    defaultRealRunPath
  );

  const missingPlatformNotesPath = join(root, "missing-platform-row-notes-receipt.json");
  await writeJson(missingPlatformNotesPath, {
    ...fixtures.macManualReceipt,
    rows: fixtures.macManualReceipt.rows.map((row, index) => (
      index === 0 ? { ...row, notes: "" } : row
    ))
  });
  const missingPlatformNotesReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: missingPlatformNotesPath,
    windowsStaticPath: fixtures.windowsStaticPath,
    harmonyDevicePath: fixtures.harmonyDevicePath,
    externalPath: fixtures.externalPath,
    allowMissing: true,
    allowSelfTestFixtures: true
  });
  assert.equal(missingPlatformNotesReport.canClaimKo, false);
  assert.ok(missingPlatformNotesReport.blockers.some((item) => item.includes("without a concrete QA note or evidence reference")));
  const missingNotesMacStatus = missingPlatformNotesReport.platformQaStatus.find((item) => item.id === "nativeMacManualQa");
  assert.equal(missingNotesMacStatus?.status, "INVALID_OR_INCOMPLETE");

  const placeholderPlatformNotesPath = join(root, "placeholder-platform-row-notes-receipt.json");
  await writeJson(placeholderPlatformNotesPath, {
    ...fixtures.macManualReceipt,
    rows: fixtures.macManualReceipt.rows.map((row, index) => (
      index === 0 ? { ...row, notes: "N/A" } : row
    ))
  });
  const placeholderPlatformNotesReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: placeholderPlatformNotesPath,
    windowsStaticPath: fixtures.windowsStaticPath,
    harmonyDevicePath: fixtures.harmonyDevicePath,
    externalPath: fixtures.externalPath,
    allowMissing: true,
    allowSelfTestFixtures: true
  });
  assert.equal(placeholderPlatformNotesReport.canClaimKo, false);
  assert.ok(placeholderPlatformNotesReport.blockers.some((item) => item.includes("without a concrete QA note or evidence reference")));
  const placeholderNotesMacStatus = placeholderPlatformNotesReport.platformQaStatus.find((item) => item.id === "nativeMacManualQa");
  assert.equal(placeholderNotesMacStatus?.status, "INVALID_OR_INCOMPLETE");

  const decoratedPlaceholderPlatformNotesPath = join(root, "decorated-placeholder-platform-row-notes-receipt.json");
  await writeJson(decoratedPlaceholderPlatformNotesPath, {
    ...fixtures.macManualReceipt,
    rows: fixtures.macManualReceipt.rows.map((row, index) => (
      index === 0 ? { ...row, notes: "- todo: capture screenshot" } : row
    ))
  });
  const decoratedPlaceholderPlatformNotesReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: decoratedPlaceholderPlatformNotesPath,
    windowsStaticPath: fixtures.windowsStaticPath,
    harmonyDevicePath: fixtures.harmonyDevicePath,
    externalPath: fixtures.externalPath,
    allowMissing: true,
    allowSelfTestFixtures: true
  });
  assert.equal(decoratedPlaceholderPlatformNotesReport.canClaimKo, false);
  assert.ok(decoratedPlaceholderPlatformNotesReport.blockers.some((item) => item.includes("without a concrete QA note or evidence reference")));
  const decoratedPlaceholderNotesMacStatus = decoratedPlaceholderPlatformNotesReport.platformQaStatus.find((item) => item.id === "nativeMacManualQa");
  assert.equal(decoratedPlaceholderNotesMacStatus?.status, "INVALID_OR_INCOMPLETE");

  const windowsPlaceholderPlatformNotesPath = join(root, "windows-placeholder-platform-row-notes-receipt.json");
  await writeJson(windowsPlaceholderPlatformNotesPath, {
    ...fixtures.windowsStaticReceipt,
    rows: fixtures.windowsStaticReceipt.rows.map((row, index) => (
      index === 0 ? { ...row, notes: "1. todo: capture screenshot" } : row
    ))
  });
  const windowsPlaceholderPlatformNotesReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: fixtures.macManualPath,
    windowsStaticPath: windowsPlaceholderPlatformNotesPath,
    harmonyDevicePath: fixtures.harmonyDevicePath,
    externalPath: fixtures.externalPath,
    allowMissing: true,
    allowSelfTestFixtures: true
  });
  assert.equal(windowsPlaceholderPlatformNotesReport.canClaimKo, false);
  assert.ok(windowsPlaceholderPlatformNotesReport.blockers.some((item) => item.includes("without a concrete QA note or evidence reference")));
  const windowsPlaceholderNotesStatus = windowsPlaceholderPlatformNotesReport.platformQaStatus.find((item) => item.id === "windowsStaticManualQa");
  assert.equal(windowsPlaceholderNotesStatus?.status, "INVALID_OR_INCOMPLETE");

  const harmonyPlaceholderPlatformNotesPath = join(root, "harmony-placeholder-platform-row-notes-receipt.json");
  await writeJson(harmonyPlaceholderPlatformNotesPath, {
    ...fixtures.harmonyDeviceReceipt,
    rows: fixtures.harmonyDeviceReceipt.rows.map((row, index) => (
      index === 0 ? { ...row, notes: "> todo: capture screenshot" } : row
    ))
  });
  const harmonyPlaceholderPlatformNotesReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: fixtures.macManualPath,
    windowsStaticPath: fixtures.windowsStaticPath,
    harmonyDevicePath: harmonyPlaceholderPlatformNotesPath,
    externalPath: fixtures.externalPath,
    allowMissing: true,
    allowSelfTestFixtures: true
  });
  assert.equal(harmonyPlaceholderPlatformNotesReport.canClaimKo, false);
  assert.ok(harmonyPlaceholderPlatformNotesReport.blockers.some((item) => item.includes("without a concrete QA note or evidence reference")));
  const harmonyPlaceholderNotesStatus = harmonyPlaceholderPlatformNotesReport.platformQaStatus.find((item) => item.id === "harmonyDeviceQa");
  assert.equal(harmonyPlaceholderNotesStatus?.status, "INVALID_OR_INCOMPLETE");

  const placeholderPlatformReviewerPath = join(root, "placeholder-platform-reviewer-receipt.json");
  await writeJson(placeholderPlatformReviewerPath, {
    ...fixtures.macManualReceipt,
    sessionFields: {
      ...fixtures.macManualReceipt.sessionFields,
      reviewer: "N/A"
    }
  });
  const placeholderPlatformReviewerReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: placeholderPlatformReviewerPath,
    windowsStaticPath: fixtures.windowsStaticPath,
    harmonyDevicePath: fixtures.harmonyDevicePath,
    externalPath: fixtures.externalPath,
    allowMissing: true,
    allowSelfTestFixtures: true
  });
  assert.equal(placeholderPlatformReviewerReport.canClaimKo, false);
  assert.ok(placeholderPlatformReviewerReport.blockers.some((item) => item.includes("Reviewer must be filled with concrete platform QA evidence")));
  const placeholderReviewerMacStatus = placeholderPlatformReviewerReport.platformQaStatus.find((item) => item.id === "nativeMacManualQa");
  assert.equal(placeholderReviewerMacStatus?.status, "INVALID_OR_INCOMPLETE");

  const relativePlatformDatePath = join(root, "relative-platform-date-receipt.json");
  await writeJson(relativePlatformDatePath, {
    ...fixtures.windowsStaticReceipt,
    sessionFields: {
      ...fixtures.windowsStaticReceipt.sessionFields,
      dateTime: "today"
    }
  });
  const relativePlatformDateReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: fixtures.macManualPath,
    windowsStaticPath: relativePlatformDatePath,
    harmonyDevicePath: fixtures.harmonyDevicePath,
    externalPath: fixtures.externalPath,
    allowMissing: true,
    allowSelfTestFixtures: true
  });
  assert.equal(relativePlatformDateReport.canClaimKo, false);
  assert.ok(relativePlatformDateReport.blockers.some((item) => item.includes("Date/time must be an ISO date-time with timezone")));
  const relativeDateWindowsStatus = relativePlatformDateReport.platformQaStatus.find((item) => item.id === "windowsStaticManualQa");
  assert.equal(relativeDateWindowsStatus?.status, "INVALID_OR_INCOMPLETE");

  const mismatchedPlatformSummaryPath = join(root, "mismatched-platform-summary-receipt.json");
  await writeJson(mismatchedPlatformSummaryPath, {
    ...fixtures.harmonyDeviceReceipt,
    rows: fixtures.harmonyDeviceReceipt.rows.map((row) => ({ ...row, result: "NT", notes: "" })),
    summary: {
      ...fixtures.harmonyDeviceReceipt.summary,
      rows: fixtures.harmonyDeviceReceipt.summary.rows,
      pass: fixtures.harmonyDeviceReceipt.summary.rows,
      fail: 0,
      blocked: 0,
      nt: 0,
      invalid: 0,
      allRowsExecuted: true,
      allRowsPass: true,
      anyRealRowsFilled: true
    },
    claimBoundary: {
      ...fixtures.harmonyDeviceReceipt.claimBoundary,
      canClaimHarmonyDeviceRoundtripUsable: true
    }
  });
  const mismatchedPlatformSummaryReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: fixtures.macManualPath,
    windowsStaticPath: fixtures.windowsStaticPath,
    harmonyDevicePath: mismatchedPlatformSummaryPath,
    externalPath: fixtures.externalPath,
    allowMissing: true,
    allowSelfTestFixtures: true
  });
  assert.equal(mismatchedPlatformSummaryReport.canClaimKo, false);
  assert.ok(mismatchedPlatformSummaryReport.blockers.some((item) => item.includes("summary allRowsPass does not match rows")));
  const mismatchedPlatformSummaryStatus = mismatchedPlatformSummaryReport.platformQaStatus.find((item) => item.id === "harmonyDeviceQa");
  assert.equal(mismatchedPlatformSummaryStatus?.status, "INVALID_OR_INCOMPLETE");

  const truncatedPlatformRowsPath = join(root, "truncated-platform-rows-receipt.json");
  await writeJson(truncatedPlatformRowsPath, {
    ...fixtures.macManualReceipt,
    rows: fixtures.macManualReceipt.rows.slice(0, 1),
    summary: {
      ...fixtures.macManualReceipt.summary,
      rows: 1,
      pass: 1,
      allRowsExecuted: true,
      allRowsPass: true,
      anyRealRowsFilled: true
    },
    claimBoundary: {
      ...fixtures.macManualReceipt.claimBoundary,
      canClaimMacManualQaUsable: true
    }
  });
  const truncatedPlatformRowsReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: truncatedPlatformRowsPath,
    windowsStaticPath: fixtures.windowsStaticPath,
    harmonyDevicePath: fixtures.harmonyDevicePath,
    externalPath: fixtures.externalPath,
    allowMissing: true,
    allowSelfTestFixtures: true
  });
  assert.equal(truncatedPlatformRowsReport.canClaimKo, false);
  assert.ok(truncatedPlatformRowsReport.blockers.some((item) => item.includes("receipt rows length 1 does not match expected rows")));
  const truncatedRowsMacStatus = truncatedPlatformRowsReport.platformQaStatus.find((item) => item.id === "nativeMacManualQa");
  assert.equal(truncatedRowsMacStatus?.status, "INVALID_OR_INCOMPLETE");

  const platformReceiptErrorsPath = join(root, "platform-receipt-errors-receipt.json");
  await writeJson(platformReceiptErrorsPath, {
    ...fixtures.windowsStaticReceipt,
    errors: ["hand-edited validator error that must remain blocking"],
    summary: {
      ...fixtures.windowsStaticReceipt.summary,
      ok: true
    }
  });
  const platformReceiptErrorsReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: fixtures.macManualPath,
    windowsStaticPath: platformReceiptErrorsPath,
    harmonyDevicePath: fixtures.harmonyDevicePath,
    externalPath: fixtures.externalPath,
    allowMissing: true,
    allowSelfTestFixtures: true
  });
  assert.equal(platformReceiptErrorsReport.canClaimKo, false);
  assert.ok(platformReceiptErrorsReport.blockers.some((item) => item.includes("receipt errors must be empty before a platform claim")));
  const receiptErrorsWindowsStatus = platformReceiptErrorsReport.platformQaStatus.find((item) => item.id === "windowsStaticManualQa");
  assert.equal(receiptErrorsWindowsStatus?.status, "INVALID_OR_INCOMPLETE");

  const nonClaimableManualTierPath = join(root, "nonclaimable-manual-tier-receipt.json");
  await writeJson(nonClaimableManualTierPath, {
    ...fixtures.harmonyDeviceReceipt,
    rows: fixtures.harmonyDeviceReceipt.rows.map((row, index) => (
      index === 0 ? { ...row, result: "FAIL", notes: ".codex-tmp/ko-evidence-selftest/harmony-fail-note.txt" } : row
    )),
    summary: {
      ...fixtures.harmonyDeviceReceipt.summary,
      pass: fixtures.harmonyDeviceReceipt.summary.rows - 1,
      fail: 1,
      allRowsPass: false
    },
    evidenceTier: "MANUAL_PLATFORM_QA",
    claimBoundary: {
      ...fixtures.harmonyDeviceReceipt.claimBoundary,
      canClaimHarmonyDeviceRoundtripUsable: false
    }
  });
  const nonClaimableManualTierReport = await buildKoReport({
    bilingualPath: fixtures.bilingualPath,
    agentLoopPath: fixtures.agentLoopPath,
    macManualPath: fixtures.macManualPath,
    windowsStaticPath: fixtures.windowsStaticPath,
    harmonyDevicePath: nonClaimableManualTierPath,
    externalPath: fixtures.externalPath,
    allowMissing: true,
    allowSelfTestFixtures: true
  });
  assert.equal(nonClaimableManualTierReport.canClaimKo, false);
  assert.ok(nonClaimableManualTierReport.blockers.some((item) => item.includes("evidenceTier must not be MANUAL_PLATFORM_QA")));
  const nonClaimableManualTierStatus = nonClaimableManualTierReport.platformQaStatus.find((item) => item.id === "harmonyDeviceQa");
  assert.equal(nonClaimableManualTierStatus?.status, "INVALID_OR_INCOMPLETE");

  const summary = {
    schema: SELFTEST_SCHEMA,
    generatedAt: new Date().toISOString(),
    fixtureOnly: true,
    canClaimKo: false,
    validatedPassShapeInMemory: passReport.schema === KO_SCHEMA && passReport.canClaimKo === true,
    negativeCases: [
      "missing external evidence rejected",
      "fixture-only external evidence rejected",
      "external run context missing rejected",
      "local or private external source URL rejected",
      "IPv4-mapped IPv6 external source URL rejected",
      "sensitive external source query key rejected",
      "signed external source query key rejected",
      "pending platform evidence rejected",
      "pending platform status summarized",
      "real-run platform receipt path selected before pending receipt path",
      "platform PASS rows without evidence notes rejected",
      "platform PASS rows with placeholder evidence notes rejected",
      "platform PASS rows with decorated placeholder evidence notes rejected",
      "Windows platform PASS rows with numbered placeholder evidence notes rejected",
      "Harmony platform PASS rows with blockquote placeholder evidence notes rejected",
      "platform placeholder reviewer rejected",
      "platform relative Date/time rejected",
      "platform summary/row mismatch rejected",
      "platform truncated row set rejected",
      "platform receipt errors rejected",
      "platform nonclaimable manual tier rejected"
    ]
  };
  const outPath = join(root, "selftest-summary.json");
  await writeJson(outPath, summary);
  console.log(`ko_evidence_selftest_ok ${outPath}`);
}

async function createKoFixtures(root) {
  const bilingualPath = join(root, "bilingual-receipt.json");
  const agentLoopPath = join(root, "agent-loop-receipt.json");
  const macManualPath = join(root, "mac-manual-qa-receipt.json");
  const windowsStaticPath = join(root, "windows-static-qa-receipt.json");
  const harmonyDevicePath = join(root, "harmony-device-qa-receipt.json");
  const externalPath = join(root, "external-claim.json");
  const evidenceFiles = [
    join(root, "external", "reading", "01-source-and-app-before-capture.png"),
    join(root, "external", "reading", "02-capture-saved.png"),
    join(root, "external", "reading", "03-resume-source.png"),
    join(root, "external", "video", "01-source-and-app-before-capture.png"),
    join(root, "external", "video", "02-capture-saved.png"),
    join(root, "external", "video", "03-resume-source.png"),
    join(root, "external", "video", "04-video-timestamp.png")
  ];
  await Promise.all(evidenceFiles.map(async (file) => {
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(file, "fixture\n");
  }));
  const receiptPath = join(root, "candidate-receipt.json");
  const reviewPath = join(root, "privacy-review.json");
  await writeJson(receiptPath, { schema: "fixture.receipt" });
  await writeJson(reviewPath, { schema: "fixture.review" });
  await writeJson(bilingualPath, {
    schema: BILINGUAL_SCHEMA,
    generatedAt: new Date().toISOString(),
    evidenceType: "CONTROLLED_BROWSER_RUNTIME_SMOKE",
    result: "PASS",
    checks: {
      staticShellChromeZh: true,
      staticShellChromeEnAfterSwitch: true,
      newSessionDefaultZh: true,
      exportCopyZh: true,
      exportCopyEn: true,
      studyShellZh: true,
      studyShellEnAfterSwitch: true,
      todayLearningFlowZh: true,
      reviewToolbarZh: true,
      mainLoopCaptureZh: true,
      synthesisOverwriteConfirmZh: true,
      mirrorImportConfirmZh: true,
      recentStackZh: true,
      searchResultsZh: true,
      activityHintZh: true,
      importReceiptZh: true,
      importReceiptEnAfterSwitch: true,
      returnedWorkNudgeZh: true,
      returnedWorkNudgeEnAfterSwitch: true,
      returnFilePreviewZh: true,
      noHorizontalOverflow: true
    }
  });
  await writeJson(agentLoopPath, {
    schema: AGENT_LOOP_SCHEMA,
    generatedAt: new Date().toISOString(),
    evidenceType: "CONTROLLED_AGENT_BROWSER_SMOKE",
    provesRealUserDogfood: false,
    result: "PASS",
    checks: {
      sidecarCaptureRail: true,
      firstCaptureDecision: true,
      notesClearsLoop: true,
      openQuestionOwnsLoop: true,
      linkedAnswerClosesQuestion: true,
      finalLoopClear: true,
      noHorizontalOverflow: true
    }
  });
  const macManualReceipt = {
    schema: MAC_MANUAL_QA_SCHEMA,
    evidenceTier: "MANUAL_PLATFORM_QA",
    generatedAt: new Date().toISOString(),
    summary: {
      ok: true,
      rows: MAC_MANUAL_QA_AREAS.length,
      pass: MAC_MANUAL_QA_AREAS.length,
      fail: 0,
      blocked: 0,
      nt: 0,
      invalid: 0,
      allRowsExecuted: true,
      allRowsPass: true,
      nativeBuildGatePass: true,
      browserSmokeGatePass: true,
      anyRealRowsFilled: true
    },
    sessionFields: {
      dateTime: new Date().toISOString(),
      reviewer: "Self Test",
      macBuildSource: "Self Test Mac build",
      macosVersion: "Self Test macOS",
      browserSourceUsed: "Self Test browser",
      nativeBuildGateResult: "PASS",
      browserSmokeGateResult: "PASS",
      totalElapsedTime: "10 minutes",
      permissionPromptsObserved: "None observed during self-test fixture",
      nativeSaveImportFrictionObserved: "None observed during self-test fixture",
      biggestFriction: "None observed during self-test fixture"
    },
    rows: buildPlatformQaRows(MAC_MANUAL_QA_AREAS, "Mac manual QA"),
    errors: [],
    claimBoundary: {
      canClaimMacManualQaUsable: true
    }
  };
  const windowsStaticReceipt = {
    schema: WINDOWS_STATIC_QA_SCHEMA,
    evidenceTier: "MANUAL_PLATFORM_QA",
    generatedAt: new Date().toISOString(),
    summary: {
      ok: true,
      rows: WINDOWS_STATIC_QA_AREAS.length,
      pass: WINDOWS_STATIC_QA_AREAS.length,
      fail: 0,
      blocked: 0,
      nt: 0,
      invalid: 0,
      allRowsExecuted: true,
      allRowsPass: true,
      staticReturnContractGatePass: true,
      macReturnFilesImportPass: true,
      anyRealRowsFilled: true
    },
    sessionFields: {
      dateTime: new Date().toISOString(),
      reviewer: "Self Test",
      windowsBrowserDevice: "Self Test Windows",
      mirrorBuildSource: "Self Test mirror",
      transferMethod: "Self Test transfer",
      macImportMethod: "Self Test Mac import",
      staticReturnContractGateResult: "PASS",
      macReturnFilesImportResult: "PASS",
      totalElapsedTime: "10 minutes",
      windowsLocalFileFrictionObserved: "None observed during self-test fixture",
      returnFileTransferFrictionObserved: "None observed during self-test fixture",
      biggestFriction: "None observed during self-test fixture"
    },
    rows: buildPlatformQaRows(WINDOWS_STATIC_QA_AREAS, "Windows static QA"),
    errors: [],
    claimBoundary: {
      canClaimWindowsStaticLoopUsable: true
    }
  };
  const harmonyDeviceReceipt = {
    schema: HARMONY_DEVICE_QA_SCHEMA,
    evidenceTier: "MANUAL_PLATFORM_QA",
    generatedAt: new Date().toISOString(),
    summary: {
      ok: true,
      rows: HARMONY_DEVICE_QA_AREAS.length,
      pass: HARMONY_DEVICE_QA_AREAS.length,
      fail: 0,
      blocked: 0,
      nt: 0,
      invalid: 0,
      allRowsExecuted: true,
      allRowsPass: true,
      devEcoToolchainGatePass: true,
      macReturnFilesImportPass: true,
      anyRealRowsFilled: true
    },
    sessionFields: {
      dateTime: new Date().toISOString(),
      reviewer: "Self Test",
      harmonyDeviceBuild: "Self Test HarmonyOS",
      appBuildSource: "Self Test app build",
      devEcoToolchainGateResult: "PASS",
      importMethod: "Self Test import",
      returnTransferMethod: "Self Test return transfer",
      macImportMethod: "Self Test Mac import",
      macReturnFilesImportResult: "PASS",
      totalElapsedTime: "10 minutes",
      filePickerStorageFrictionObserved: "None observed during self-test fixture",
      patchExportImportFrictionObserved: "None observed during self-test fixture",
      biggestFriction: "None observed during self-test fixture"
    },
    rows: buildPlatformQaRows(HARMONY_DEVICE_QA_AREAS, "HarmonyOS device QA"),
    errors: [],
    claimBoundary: {
      canClaimHarmonyDeviceRoundtripUsable: true
    }
  };
  await writeJson(macManualPath, macManualReceipt);
  await writeJson(windowsStaticPath, windowsStaticReceipt);
  await writeJson(harmonyDevicePath, harmonyDeviceReceipt);
  const externalClaim = {
    schema: EXTERNAL_CLAIM_SCHEMA,
    generatedAt: new Date().toISOString(),
    evidenceTier: "APPROVED_SOURCE_PRIVACY_REVIEWED",
    canClaimExternalKo: true,
    fixtureOnly: false,
    reviewKind: "HUMAN_PRIVACY_REVIEW",
    receiptPath,
    reviewPath,
    reviewer: "Self Test",
    reviewedAt: new Date().toISOString(),
    reading: {
      url: "https://www.wikipedia.org/learning-companion-approved-reading",
      title: "Approved Reading",
      files: evidenceFiles.filter((file) => file.includes("/reading/"))
    },
    video: {
      url: "https://www.youtube.com/watch?v=learning-companion-approved-video",
      title: "Approved Video",
      timestamp: "01:35",
      files: evidenceFiles.filter((file) => file.includes("/video/"))
    },
    runContext: {
      schema: "learning-companion.external-source-run-context.v1",
      app: {
        url: "http://127.0.0.1:12345/",
        root: "/tmp/learning-companion/apps/companion-web"
      },
      appRevision: {
        gitHead: "0123456789abcdef0123456789abcdef01234567",
        dirtyWorktree: true,
        statusLineCount: 1,
        statusTruncated: false
      },
      browser: {
        chromePath: "/usr/bin/chromium",
        headless: true,
        profileMode: "throwaway-profile",
        profileRetained: false,
        profileCleanup: {
          attempted: true,
          ok: true,
          retained: false,
          error: ""
        }
      },
      viewport: {
        app: {
          width: 1440,
          height: 900,
          deviceScaleFactor: 1,
          mobile: false
        },
        sourceEvidence: {
          width: 720,
          height: 900,
          deviceScaleFactor: 1,
          mobile: false
        },
        composite: {
          width: 1440,
          height: 900
        }
      },
      network: {
        mode: "APPROVED_REMOTE_SOURCE_AND_LOCAL_APP",
        localAppServer: "127.0.0.1 ephemeral",
        browserFlags: [
          "--disable-background-networking",
          "--disable-component-update",
          "--disable-extensions",
          "--disable-sync",
          "--no-first-run"
        ]
      }
    }
  };
  await writeJson(externalPath, externalClaim);
  return {
    bilingualPath,
    agentLoopPath,
    macManualPath,
    macManualReceipt,
    windowsStaticPath,
    windowsStaticReceipt,
    harmonyDevicePath,
    harmonyDeviceReceipt,
    externalPath,
    externalClaim
  };
}

function buildPlatformQaRows(areas, label) {
  const slug = label.toLowerCase().replaceAll(" ", "-");
  return areas.map((area, index) => ({
    area,
    steps: "Self-test fixture step",
    expected: "Self-test fixture expected result",
    result: "PASS",
    notes: `.codex-tmp/ko-evidence-selftest/${slug}-row-${index + 1}.txt`
  }));
}

function rejectSelfTestPath(value, label) {
  assertNonTbd(value, label);
  assert.equal(String(value).includes("external-source-privacy-review-selftest"), false, `${label} must not come from privacy-review self-test artifacts`);
  assert.equal(String(value).includes("ko-evidence-selftest"), false, `${label} must not come from KO self-test artifacts`);
}

function assertTrue(value, message) {
  if (value !== true) throw new Error(message);
}

function assertNonTbd(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.trim() && value.trim() !== "TBD", `${label} must be filled`);
}

function assertHttpUrl(value, label) {
  assertNonTbd(value, label);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute URL.`);
  }
  assert.ok(["http:", "https:"].includes(parsed.protocol), `${label} must use http(s).`);
  assert.equal(parsed.username || parsed.password, "", `${label} must not include credentials.`);
}

function normalizeHostname(hostname) {
  return String(hostname || "").trim().replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "").toLowerCase();
}

function isDisallowedExternalHost(host) {
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (!host.includes(".") && !host.includes(":")) return true;
  if (["example.com", "example.net", "example.org"].includes(host)) return true;
  if ([
    ".example.com",
    ".example.net",
    ".example.org",
    ".local",
    ".internal",
    ".lan",
    ".home",
    ".test",
    ".invalid"
  ].some((suffix) => host.endsWith(suffix))) return true;
  return isPrivateOrReservedIpv4(host) || isPrivateOrReservedIpv6(host);
}

function isPrivateOrReservedIpv4(host) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
  const parts = host.split(".").map((part) => Number(part));
  if (parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && b === 18) ||
    (a === 198 && b === 19) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function isPrivateOrReservedIpv6(host) {
  if (!host.includes(":")) return false;
  if (host === "::" || host === "::1") return true;
  if (host.startsWith("fe80:")) return true;
  if (/^f[cd][0-9a-f]{0,2}:/i.test(host)) return true;
  if (host.startsWith("::ffff:")) {
    return isPrivateOrReservedIpv4(expandMappedIpv4(host.slice("::ffff:".length)));
  }
  return false;
}

function expandMappedIpv4(value) {
  if (value.includes(".")) return value;
  const match = value.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!match) return value;
  const high = Number.parseInt(match[1], 16);
  const low = Number.parseInt(match[2], 16);
  return [
    (high >> 8) & 255,
    high & 255,
    (low >> 8) & 255,
    low & 255
  ].join(".");
}

function assertGitHead(value, label) {
  assertNonTbd(value, label);
  assert.match(value, /^[a-f0-9]{40}$/i, `${label} must be a 40-character git SHA`);
}

function readJsonSync(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read ${label} JSON at ${path}: ${error.message}`);
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await chmod(path, 0o600).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
  });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
}

function assertPathArgs(parsedArgs, keys) {
  keys.forEach((key) => {
    if (parsedArgs[key] === true) {
      throw new Error(`--${key} requires a file path.`);
    }
  });
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

function timestampSlug(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
