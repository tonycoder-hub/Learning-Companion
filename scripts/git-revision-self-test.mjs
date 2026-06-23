#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  buildRevisionFromGitOutput,
  buildUnavailableRevision,
  parseGitStatusLines,
  readCurrentRevision,
  readCurrentRevisionSync,
  revisionCanClaim
} from "./lib/git-revision.mjs";

const CLEAN_SHA = "0123456789abcdef0123456789abcdef01234567";
const OTHER_SHA = "89abcdef0123456789abcdef0123456789abcdef";

assert.deepEqual(parseGitStatusLines(""), []);
assert.deepEqual(parseGitStatusLines("\n\n"), []);
assert.deepEqual(parseGitStatusLines(" M scripts/a.mjs\n?? scripts/b.mjs\n"), [
  " M scripts/a.mjs",
  "?? scripts/b.mjs"
]);

const cleanRevision = buildRevisionFromGitOutput(`${CLEAN_SHA}\n`, "", {});
assert.deepEqual(cleanRevision, {
  gitAvailable: true,
  gitHead: CLEAN_SHA,
  dirtyWorktree: false,
  statusLineCount: 0,
  statusSummary: "",
  statusTruncated: false
});
assert.equal(revisionCanClaim(cleanRevision), true);

const dirtyRevision = buildRevisionFromGitOutput(`${CLEAN_SHA}\n`, " M scripts/a.mjs\n?? scripts/b.mjs\n", {
  maxStatusSummaryLines: 1
});
assert.equal(dirtyRevision.gitAvailable, true);
assert.equal(dirtyRevision.gitHead, CLEAN_SHA);
assert.equal(dirtyRevision.dirtyWorktree, true);
assert.equal(dirtyRevision.statusLineCount, 2);
assert.equal(dirtyRevision.statusSummary, " M scripts/a.mjs");
assert.equal(dirtyRevision.statusTruncated, true);
assert.equal(revisionCanClaim(dirtyRevision), false);

const malformedShaRevision = buildRevisionFromGitOutput("abc\n", "", {});
assert.equal(malformedShaRevision.dirtyWorktree, false);
assert.equal(revisionCanClaim(malformedShaRevision), false);

const unavailableRevision = buildUnavailableRevision(new Error("git missing"), {
  unavailableStatusSummary: "git revision unavailable"
});
assert.equal(unavailableRevision.gitAvailable, false);
assert.equal(unavailableRevision.gitHead, "TBD");
assert.equal(unavailableRevision.dirtyWorktree, "TBD");
assert.equal(unavailableRevision.statusLineCount, "TBD");
assert.equal(unavailableRevision.statusSummary, "git revision unavailable");
assert.equal(unavailableRevision.statusTruncated, "TBD");
assert.match(unavailableRevision.error, /git missing/);
assert.equal(revisionCanClaim(unavailableRevision), false);
assert.equal(revisionCanClaim(undefined), false);
assert.equal(revisionCanClaim({
  ...cleanRevision,
  gitHead: OTHER_SHA,
  gitAvailable: false
}), false);

const asyncRevision = await readCurrentRevision();
const syncRevision = readCurrentRevisionSync();
assert.equal(asyncRevision.gitAvailable, syncRevision.gitAvailable);
assert.equal(asyncRevision.gitHead, syncRevision.gitHead);
assert.equal(asyncRevision.dirtyWorktree, syncRevision.dirtyWorktree);
assert.equal(asyncRevision.statusLineCount, syncRevision.statusLineCount);
assert.equal(asyncRevision.statusSummary, syncRevision.statusSummary);
assert.equal(asyncRevision.statusTruncated, syncRevision.statusTruncated);
if (asyncRevision.gitAvailable) {
  assert.match(asyncRevision.gitHead, /^[0-9a-f]{40}$/i);
  assert.equal(typeof asyncRevision.dirtyWorktree, "boolean");
  assert.equal(Number.isInteger(asyncRevision.statusLineCount), true);
  assert.equal(typeof asyncRevision.statusSummary, "string");
  assert.equal(typeof asyncRevision.statusTruncated, "boolean");
}

console.log("git_revision_selftest_ok");
