import { readFile } from "node:fs/promises";

export const PLATFORM_QA_HANDOFF_BINDING_SCHEMA = "learning-companion.platform-qa-handoff-binding.v1";
export const PLATFORM_QA_HANDOFF_SCHEMA = "learning-companion.platform-qa-handoff.v1";
export const CURRENT_CLEAN_HEAD_PLATFORM_QA_HANDOFF = "CURRENT_CLEAN_HEAD_PLATFORM_QA_HANDOFF";
export const CURRENT_CLEAN_HEAD_KO_STATUS = "CURRENT_CLEAN_HEAD_KO_STATUS";

export async function readPlatformHandoffBinding({ handoffPath, platformId, qaPath, currentRevision }) {
  if (!handoffPath) {
    return {
      binding: null,
      errors: ["real platform QA requires --platform-handoff generated on the current clean git HEAD"]
    };
  }
  let handoff;
  try {
    handoff = JSON.parse(await readFile(handoffPath, "utf8"));
  } catch (error) {
    return {
      binding: null,
      errors: [`platform handoff is unreadable JSON: ${error.message}`]
    };
  }
  return buildPlatformHandoffBinding({ handoff, handoffPath, platformId, qaPath, currentRevision });
}

export function buildPlatformHandoffBinding({ handoff, handoffPath, platformId, qaPath, currentRevision }) {
  const errors = [];
  if (handoff?.schema !== PLATFORM_QA_HANDOFF_SCHEMA) {
    errors.push(`platform handoff schema mismatch: ${handoff?.schema || "missing"}`);
  }
  if (handoff?.evidenceTier !== "PLATFORM_QA_HANDOFF_ONLY" || handoff?.canClaimKo !== false) {
    errors.push("platform handoff must be a non-claiming PLATFORM_QA_HANDOFF_ONLY artifact");
  }
  const handoffRevision = handoff?.currentRevision || {};
  const koFreshness = handoff?.koStatusFreshness || {};
  const executionFreshness = handoff?.executionFreshness || {};
  if (executionFreshness.status !== CURRENT_CLEAN_HEAD_PLATFORM_QA_HANDOFF) {
    errors.push(`platform handoff freshness must be ${CURRENT_CLEAN_HEAD_PLATFORM_QA_HANDOFF}`);
  }
  if (koFreshness.status !== CURRENT_CLEAN_HEAD_KO_STATUS) {
    errors.push(`platform handoff KO status freshness must be ${CURRENT_CLEAN_HEAD_KO_STATUS}`);
  }
  if (handoffRevision.gitAvailable !== true) {
    errors.push("platform handoff git state must be available");
  }
  if (handoffRevision.dirtyWorktree !== false || handoffRevision.statusLineCount !== 0) {
    errors.push("platform handoff must be generated from a clean worktree");
  }
  if (!isGitHead(handoffRevision.gitHead)) {
    errors.push("platform handoff gitHead must be a full git SHA");
  } else if (currentRevision?.gitHead && handoffRevision.gitHead !== currentRevision.gitHead) {
    errors.push(`platform handoff gitHead ${handoffRevision.gitHead} does not match current HEAD ${currentRevision.gitHead}`);
  }
  if (currentRevision?.dirtyWorktree !== false || currentRevision?.statusLineCount !== 0) {
    errors.push("platform QA validator must run from the same clean worktree as the handoff");
  }
  const platform = Array.isArray(handoff?.platforms)
    ? handoff.platforms.find((item) => item.id === platformId)
    : null;
  if (!platform) {
    errors.push(`platform handoff missing platform ${platformId}`);
  } else if (platform.qaPath !== qaPath) {
    errors.push(`platform handoff ${platformId} qaPath ${platform.qaPath || "TBD"} does not match ${qaPath}`);
  }
  const problems = [
    ...(Array.isArray(executionFreshness.problems) ? executionFreshness.problems : []),
    ...(Array.isArray(koFreshness.problems) ? koFreshness.problems : [])
  ];
  const binding = {
    schema: PLATFORM_QA_HANDOFF_BINDING_SCHEMA,
    handoffPath: String(handoffPath || ""),
    handoffSchema: handoff?.schema || "",
    evidenceTier: handoff?.evidenceTier || "",
    canClaimKo: handoff?.canClaimKo,
    platformId,
    qaPath,
    receiptPath: platform?.receiptPath || "",
    validateCommand: platform?.validateCommand || "",
    executionFreshnessStatus: executionFreshness.status || "",
    koStatusFreshnessStatus: koFreshness.status || "",
    handoffGitHead: handoffRevision.gitHead || "",
    handoffDirtyWorktree: handoffRevision.dirtyWorktree,
    handoffStatusLineCount: handoffRevision.statusLineCount,
    currentGitHead: currentRevision?.gitHead || "",
    currentDirtyWorktree: currentRevision?.dirtyWorktree,
    problems
  };
  return { binding, errors };
}

function isGitHead(value) {
  return /^[0-9a-f]{40}$/i.test(String(value || ""));
}
