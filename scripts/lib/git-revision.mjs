import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";

export const DEFAULT_MAX_STATUS_SUMMARY_LINES = 20;
export const DEFAULT_GIT_STATUS_MAX_BUFFER_BYTES = 1024 * 1024;

const execFileAsync = promisify(execFile);

export async function readCurrentRevision(options = {}) {
  const cwd = options.cwd || process.cwd();
  try {
    const [{ stdout: headStdout }, { stdout: statusStdout }] = await Promise.all([
      execFileAsync("git", ["rev-parse", "HEAD"], {
        cwd,
        encoding: "utf8",
        maxBuffer: 128 * 1024
      }),
      execFileAsync("git", ["status", "--short"], {
        cwd,
        encoding: "utf8",
        maxBuffer: options.statusMaxBuffer || DEFAULT_GIT_STATUS_MAX_BUFFER_BYTES
      })
    ]);
    return buildRevisionFromGitOutput(headStdout, statusStdout, options);
  } catch (error) {
    return buildUnavailableRevision(error, options);
  }
}

export function readCurrentRevisionSync(options = {}) {
  const cwd = options.cwd || process.cwd();
  try {
    const headStdout = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd,
      encoding: "utf8",
      maxBuffer: 128 * 1024
    });
    const statusStdout = execFileSync("git", ["status", "--short"], {
      cwd,
      encoding: "utf8",
      maxBuffer: options.statusMaxBuffer || DEFAULT_GIT_STATUS_MAX_BUFFER_BYTES
    });
    return buildRevisionFromGitOutput(headStdout, statusStdout, options);
  } catch (error) {
    return buildUnavailableRevision(error, options);
  }
}

export function parseGitStatusLines(statusStdout) {
  const withoutTrailingNewlines = String(statusStdout || "").replace(/(?:\r?\n)+$/, "");
  return withoutTrailingNewlines ? withoutTrailingNewlines.split(/\r?\n/) : [];
}

export function revisionCanClaim(revision) {
  return revision?.gitAvailable === true
    && revision.dirtyWorktree === false
    && /^[0-9a-f]{40}$/i.test(String(revision.gitHead || ""));
}

function buildRevisionFromGitOutput(headStdout, statusStdout, options = {}) {
  const maxStatusSummaryLines = options.maxStatusSummaryLines || DEFAULT_MAX_STATUS_SUMMARY_LINES;
  const statusLines = parseGitStatusLines(statusStdout);
  return {
    gitAvailable: true,
    gitHead: String(headStdout || "").trim() || "TBD",
    dirtyWorktree: statusLines.length > 0,
    statusLineCount: statusLines.length,
    statusSummary: statusLines.slice(0, maxStatusSummaryLines).join("\n"),
    statusTruncated: statusLines.length > maxStatusSummaryLines
  };
}

function buildUnavailableRevision(error, options = {}) {
  return {
    gitAvailable: false,
    gitHead: "TBD",
    dirtyWorktree: "TBD",
    statusLineCount: "TBD",
    statusSummary: options.unavailableStatusSummary || "",
    statusTruncated: "TBD",
    error: String(error?.message || error || "TBD")
  };
}
