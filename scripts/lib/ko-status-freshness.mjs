export const CURRENT_CLEAN_KO_STATUS = "CURRENT_CLEAN_HEAD_KO_STATUS";
export const STALE_OR_DIRTY_KO_STATUS = "STALE_OR_DIRTY_KO_STATUS";

const GIT_HEAD_PATTERN = /^[0-9a-f]{40}$/i;

export function assessKoStatusFreshness(koStatus = {}, currentRevision = {}) {
  const basisRevision = koStatus.currentRevision || {};
  const problems = [];

  if (basisRevision.gitAvailable !== true) {
    problems.push("KO status did not prove git revision availability.");
  }
  if (!GIT_HEAD_PATTERN.test(String(basisRevision.gitHead || ""))) {
    problems.push("KO status gitHead is missing or invalid.");
  } else if (!GIT_HEAD_PATTERN.test(String(currentRevision.gitHead || ""))) {
    problems.push("Current gitHead is missing or invalid.");
  } else if (basisRevision.gitHead !== currentRevision.gitHead) {
    problems.push(`KO status gitHead ${basisRevision.gitHead} does not match current HEAD ${currentRevision.gitHead}.`);
  }
  if (basisRevision.dirtyWorktree !== false) {
    problems.push("KO status was not generated from a clean worktree.");
  }
  if (!Number.isInteger(basisRevision.statusLineCount) || basisRevision.statusLineCount !== 0) {
    problems.push("KO status clean worktree proof must have zero status lines.");
  }
  if (basisRevision.statusTruncated === true) {
    problems.push("KO status worktree status was truncated.");
  }
  if (currentRevision.gitAvailable !== true) {
    problems.push("Current git revision is unavailable.");
  }
  if (currentRevision.dirtyWorktree !== false) {
    problems.push("Current worktree is dirty; resolve current worktree changes under current-turn authorization, then regenerate KO status. Do not discard changes unless explicitly asked.");
  }
  if (!Number.isInteger(currentRevision.statusLineCount) || currentRevision.statusLineCount !== 0) {
    problems.push("Current clean worktree proof must have zero status lines.");
  }
  if (currentRevision.statusTruncated === true) {
    problems.push("Current worktree status was truncated.");
  }

  return {
    status: problems.length ? STALE_OR_DIRTY_KO_STATUS : CURRENT_CLEAN_KO_STATUS,
    currentGitHead: currentRevision.gitHead || "",
    currentDirtyWorktree: currentRevision.dirtyWorktree,
    basisGitHead: basisRevision.gitHead || "",
    basisDirtyWorktree: basisRevision.dirtyWorktree,
    basisStatusLineCount: basisRevision.statusLineCount ?? "TBD",
    basisStatusTruncated: basisRevision.statusTruncated === true,
    problems
  };
}
