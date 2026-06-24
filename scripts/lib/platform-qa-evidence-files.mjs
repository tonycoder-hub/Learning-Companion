import { existsSync, readFileSync } from "node:fs";

const PLATFORM_EVIDENCE_ROOT = ".codex-tmp/platform-qa-evidence";
const PLACEHOLDER_EVIDENCE_NOTES = new Set(["tbd", "-", "--", "n/a", "na", "none", "no evidence", "placeholder", "todo"]);
const LEADING_EVIDENCE_DECORATION_PATTERN = /^(?:[`"'()[\]{}<>*_.,;:#\-\s]+|\d+[.)]\s*)+/;

export function platformQaEvidenceFileErrors({ rows, platformHandoffBinding, platformId, label }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const executedRows = safeRows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => normalizeResult(row?.result) && normalizeResult(row?.result) !== "NT");
  if (!executedRows.length) return [];

  const errors = [];
  if (!platformHandoffBinding?.handoffPath) {
    return [`${label} evidence file validation requires platform handoff binding`];
  }
  let handoff;
  try {
    handoff = JSON.parse(readFileSync(platformHandoffBinding.handoffPath, "utf8"));
  } catch (error) {
    return [`${label} evidence file validation could not read platform handoff: ${error.message}`];
  }
  const platform = Array.isArray(handoff.platforms)
    ? handoff.platforms.find((item) => item.id === platformId)
    : null;
  if (!platform) {
    return [`${label} evidence file validation missing platform handoff lane ${platformId}`];
  }
  const hints = platform.currentTemplateSummary?.rowEvidenceHints || [];
  if (!Array.isArray(hints) || hints.length === 0) {
    return [`${label} evidence file validation requires rowEvidenceHints in platform handoff`];
  }
  for (const { row, index } of executedRows) {
    const rowNumber = index + 1;
    const hint = hints[index];
    if (!hint) {
      errors.push(`${label} row ${rowNumber} evidence file validation missing rowEvidenceHints entry`);
      continue;
    }
    const expectedNotesPath = `${hint.evidenceDir}/notes.md`;
    if (!isSafeEvidenceNotesPath(expectedNotesPath)) {
      errors.push(`${label} row ${rowNumber} evidence notes path is outside platform evidence root: ${expectedNotesPath}`);
      continue;
    }
    const rowNotes = String(row?.notes || "");
    if (!rowNotes.includes(expectedNotesPath)) {
      errors.push(`${label} row ${rowNumber} must reference row-specific evidence notes: ${expectedNotesPath}`);
      continue;
    }
    if (!existsSync(expectedNotesPath)) {
      errors.push(`${label} row ${rowNumber} evidence notes file missing: ${expectedNotesPath}`);
      continue;
    }
    let evidenceText = "";
    try {
      evidenceText = readFileSync(expectedNotesPath, "utf8");
    } catch (error) {
      errors.push(`${label} row ${rowNumber} evidence notes file unreadable: ${error.message}`);
      continue;
    }
    if (!hasConcreteEvidenceFileText(evidenceText)) {
      errors.push(`${label} row ${rowNumber} evidence notes file is empty, placeholder, or still scaffold template: ${expectedNotesPath}`);
      continue;
    }
    const rowResult = normalizeResult(row?.result);
    if (["PASS", "FAIL", "BLOCKED"].includes(rowResult)) {
      const evidenceResult = extractEvidenceResult(evidenceText);
      if (!evidenceResult) {
        errors.push(`${label} row ${rowNumber} evidence notes file must include Result: ${rowResult}: ${expectedNotesPath}`);
      } else if (evidenceResult !== rowResult) {
        errors.push(`${label} row ${rowNumber} evidence notes file Result must match row result ${rowResult}: ${expectedNotesPath}`);
      }
      const observedSummary = extractEvidenceField(evidenceText, "Observed summary");
      if (!hasConcreteEvidenceFileText(observedSummary)) {
        errors.push(`${label} row ${rowNumber} evidence notes file must include a concrete Observed summary: ${expectedNotesPath}`);
      }
      if (rowResult === "PASS") {
        errors.push(...platformQaScreenshotFileErrors({
          rowNotes,
          rowNumber,
          screenshotPath: `${hint.evidenceDir}/screenshot.png`,
          label
        }));
      }
    }
  }
  return errors;
}

function platformQaScreenshotFileErrors({ rowNotes, rowNumber, screenshotPath, label }) {
  const errors = [];
  if (!isSafeEvidenceScreenshotPath(screenshotPath)) {
    return [`${label} row ${rowNumber} evidence screenshot path is outside platform evidence root: ${screenshotPath}`];
  }
  if (!String(rowNotes || "").includes(screenshotPath)) {
    errors.push(`${label} row ${rowNumber} must reference row-specific evidence screenshot: ${screenshotPath}`);
  }
  if (!existsSync(screenshotPath)) {
    errors.push(`${label} row ${rowNumber} evidence screenshot missing: ${screenshotPath}`);
    return errors;
  }
  let data;
  try {
    data = readFileSync(screenshotPath);
  } catch (error) {
    errors.push(`${label} row ${rowNumber} evidence screenshot unreadable: ${error.message}`);
    return errors;
  }
  if (!data.length) {
    errors.push(`${label} row ${rowNumber} evidence screenshot file must not be empty: ${screenshotPath}`);
  } else if (!isPngBuffer(data)) {
    errors.push(`${label} row ${rowNumber} evidence screenshot file must be a PNG: ${screenshotPath}`);
  }
  return errors;
}

export function hasConcreteEvidenceFileText(value) {
  const text = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  const unwrappedText = text.replace(LEADING_EVIDENCE_DECORATION_PATTERN, "");
  return Boolean(text && !isPlaceholderEvidenceFileText(text) && !isPlaceholderEvidenceFileText(unwrappedText));
}

function isSafeEvidenceNotesPath(value) {
  const text = String(value || "");
  return Boolean(
    text
      && !text.startsWith("/")
      && !text.includes("\\")
      && !text.split("/").includes("..")
      && text.startsWith(`${PLATFORM_EVIDENCE_ROOT}/`)
      && text.endsWith("/notes.md")
  );
}

function isSafeEvidenceScreenshotPath(value) {
  const text = String(value || "");
  return Boolean(
    text
      && !text.startsWith("/")
      && !text.includes("\\")
      && !text.split("/").includes("..")
      && text.startsWith(`${PLATFORM_EVIDENCE_ROOT}/`)
      && text.endsWith("/screenshot.png")
  );
}

function isPngBuffer(data) {
  return data.length >= 8
    && data[0] === 0x89
    && data[1] === 0x50
    && data[2] === 0x4e
    && data[3] === 0x47
    && data[4] === 0x0d
    && data[5] === 0x0a
    && data[6] === 0x1a
    && data[7] === 0x0a;
}

function isPlaceholderEvidenceFileText(text) {
  return PLACEHOLDER_EVIDENCE_NOTES.has(text)
    || /^(tbd|todo|placeholder|none|no evidence|n\s*\/\s*a|na)(\b|[\s:;,.()[\]{}_-]|$)/.test(text)
    || /(?:\btemplate only\b|\breplace before use\b|\bthis file is not qa evidence\b|<actual-result>|<observed-summary>|<reviewer>|<iso-8601-with-timezone>|<actual-environment>|<paths-or-none>|\bpass\s*\|\s*fail\s*\|\s*blocked\b)/.test(text);
}

function extractEvidenceField(text, fieldName) {
  const pattern = new RegExp(`(?:^|\\n)\\s*(?:[-*]\\s*)?${escapeRegExp(fieldName)}\\s*:\\s*([^\\n]+)`, "i");
  const match = String(text || "").match(pattern);
  return match ? match[1].trim() : "";
}

function extractEvidenceResult(text) {
  const value = extractEvidenceField(text, "Result").toUpperCase();
  const match = value.match(/^(PASS|FAIL|BLOCKED)\b/);
  return match ? match[1] : value;
}

function normalizeResult(value) {
  return String(value || "").trim().toUpperCase();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
