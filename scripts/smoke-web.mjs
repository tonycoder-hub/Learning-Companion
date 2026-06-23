import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  WORKSPACE_SCHEMA,
  WORKSPACE_SCHEMA_VERSION,
  MAX_CAPTURE_TEXT_LENGTH,
  MAX_INBOX_PATCH_CAPTURES,
  MAX_REVIEW_PROGRESS_EVENTS,
  MAX_SEARCH_QUERY_LENGTH,
  WORKSPACE_BACKUP_STALE_DAYS,
  MOBILE_INBOX_PATCH_SCHEMA,
  REVIEW_PROGRESS_PATCH_SCHEMA,
  addCapture,
  addSession,
  applyMobileInboxPatch,
  applyGrade,
  applyReviewProgressPatch,
  buildFeishuPayload,
  buildCaptureDraftItems,
  buildFocusBrief,
  buildMirrorBundle,
  buildMirrorZip,
  buildReturnBaseFingerprint,
  buildResumeSource,
  buildSourceJumpUrl,
  buildSourceTextFragmentUrl,
  buildTodayPack,
  captureDraftStatusText,
  captureHasReviewReadyAnswer,
  captureHasOpenQuestion,
  captureHasParkedQuestion,
  captureHasQuestion,
  captureHasResolvedQuestion,
  cleanText,
  cleanUrl,
  createDefaultWorkspace,
  createSession,
  deleteCapture,
  deleteReviewCard,
  extractSourceTimestamp,
  filterSessions,
  formatBytes,
  formatLocalIso,
  generateInboxHtml,
  generateMarkdown,
  generateMirrorIndexHtml,
  generateReviewPackMarkdown,
  generateReviewHtml,
  generateSynthesisDraft,
  generateTodayMarkdown,
  getAnswerCaptureItems,
  getRecentCaptureItems,
  getSynthesisStats,
  getSynthesisSourceStamp,
  getDueReviewCards,
  getDueReviewItems,
  getParkedQuestionItems,
  getResolvedQuestionItems,
  getActiveSession,
  gradeCard,
  hasCaptureDraft,
  hasCaptureTextDraft,
  isMobileInboxPatch,
  isMobileInboxPatchLike,
  isReviewProgressPatch,
  isReviewProgressPatchLike,
  normalizeCaptureDraft,
  normalizeVideoBookmark,
  promoteCapture,
  refreshAnsweredQuestionReviewCard,
  resolveCaptureDraftFocusOverride,
  resolveDraftSourceMaterialType,
  resolveTodayWindow,
  reviewIntervalDays,
  safeHref,
  sanitizeWorkspace,
  searchWorkspace,
  secondsToTimestamp,
  setCaptureQuestionParked,
  setCaptureQuestionResolved,
  stripSourceTimestamp,
  timestampToSeconds,
  updateCaptureThought,
  updateSession,
  workspaceBackupFingerprint,
  workspaceFingerprint,
  workspaceStorageNotice,
  workspaceFromPortableData
} from "../apps/companion-web/src/model.js";
import {
  FEISHU_UPLOAD_PLAN_SCHEMA,
  FEISHU_UPLOAD_REPORT_SCHEMA,
  buildFeishuUploadDryRunReport,
  buildFeishuUploadPlan,
  materializeMirrorBundle
} from "./feishu-mirror-uploader.mjs";

function extractStaticSeed(html) {
  const match = html.match(/const seed = (.+);/);
  assert.ok(match, "static page seed should be embedded");
  return JSON.parse(match[1]);
}

const tempBase = resolve(".codex-tmp/smoke-web");
mkdirSync(tempBase, { recursive: true, mode: 0o700 });
const cleanupSmokeArtifacts = process.env.LC_CLEAN_SMOKE_ARTIFACTS === "1";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const manifest = JSON.parse(readFileSync("apps/companion-web/manifest.webmanifest", "utf8"));
const indexHtml = readFileSync("apps/companion-web/index.html", "utf8");
const appJs = readFileSync("apps/companion-web/src/app.js", "utf8");
const viewerJs = readFileSync("apps/companion-web/src/viewer.js", "utf8");
const markdownJs = readFileSync("apps/companion-web/src/markdown.js", "utf8");
const appCss = readFileSync("apps/companion-web/styles.css", "utf8");
const macMainSwift = readFileSync("apps/companion-mac/Sources/LearningCompanionMac/main.swift", "utf8");
const serviceWorker = readFileSync("apps/companion-web/service-worker.js", "utf8");
const devServerJs = readFileSync("scripts/dev-server.mjs", "utf8");
const morningDemoBuilderJs = readFileSync("scripts/build-morning-demo.mjs", "utf8");
const smokeBrowserJs = readFileSync("scripts/smoke-browser.mjs", "utf8");
const smokeSourceResumeJs = readFileSync("scripts/smoke-source-resume.mjs", "utf8");
const smokeTextFragmentBrowserJs = readFileSync("scripts/smoke-text-fragment-browser.mjs", "utf8");
const agentStudyLoopCheckJs = readFileSync("scripts/agent-study-loop-check.mjs", "utf8");
const smokeBilingualRuntimeBrowserJs = readFileSync("scripts/smoke-bilingual-runtime-browser.mjs", "utf8");
const externalSourceValidationBrowserJs = readFileSync("scripts/external-source-validation-browser.mjs", "utf8");
const externalSourcePrivacyReviewJs = readFileSync("scripts/validate-external-source-privacy-review.mjs", "utf8");
const koEvidenceReviewJs = readFileSync("scripts/validate-ko-evidence.mjs", "utf8");
const koNextActionSummaryJs = readFileSync("scripts/ko-next-action-summary.mjs", "utf8");
const platformQaHandoffJs = readFileSync("scripts/platform-qa-handoff.mjs", "utf8");
const platformQaHandoffBindingJs = readFileSync("scripts/lib/platform-qa-handoff-binding.mjs", "utf8");
const nextMajorReadinessJs = readFileSync("scripts/next-major-readiness.mjs", "utf8");
const nextMajorOperatorPacketJs = readFileSync("scripts/next-major-operator-packet.mjs", "utf8");
const finalizeNextMajorJs = readFileSync("scripts/finalize-next-major.mjs", "utf8");
const refreshNextMajorLocalEvidenceJs = readFileSync("scripts/refresh-next-major-local-evidence.mjs", "utf8");
const macManualQaValidatorJs = readFileSync("scripts/validate-mac-manual-qa.mjs", "utf8");
const windowsStaticQaValidatorJs = readFileSync("scripts/validate-windows-static-qa.mjs", "utf8");
const harmonyDeviceQaValidatorJs = readFileSync("scripts/validate-harmony-device-qa.mjs", "utf8");
const gitRevisionHelperJs = readFileSync("scripts/lib/git-revision.mjs", "utf8");
const koStatusFreshnessHelperJs = readFileSync("scripts/lib/ko-status-freshness.mjs", "utf8");
const platformQaAreasHelperJs = readFileSync("scripts/lib/platform-qa-areas.mjs", "utf8");
const gitRevisionSelfTestJs = readFileSync("scripts/git-revision-self-test.mjs", "utf8");
const sourceApprovalFreshnessHelperJs = readFileSync("scripts/lib/source-approval-freshness.mjs", "utf8");
const sourceApprovalFreshnessSelfTestJs = readFileSync("scripts/source-approval-freshness-self-test.mjs", "utf8");
const platformQaHandoffSelfTestJs = readFileSync("scripts/platform-qa-handoff-self-test.mjs", "utf8");
const nextMajorReadinessSelfTestJs = readFileSync("scripts/next-major-readiness-self-test.mjs", "utf8");
const nextMajorOperatorSelfTestJs = readFileSync("scripts/next-major-operator-self-test.mjs", "utf8");
const nextAgentPromptMd = readFileSync("NEXT_AGENT_PROMPT.md", "utf8");
const promotionGatesMd = readFileSync("docs/promotion-gates.md", "utf8");
const macManualQaMd = readFileSync("docs/mac-manual-qa.md", "utf8");
const thirdPartyContinuationPromptMd = readFileSync("docs/third-party-continuation-prompt.md", "utf8");
const userFlowAuditMd = readFileSync("docs/user-flow-audit.md", "utf8");
const validateMorningReceiptsJs = readFileSync("scripts/validate-morning-receipts.mjs", "utf8");
assert.equal(packageJson.scripts.dev, "node scripts/dev-server.mjs");
assert.equal(packageJson.scripts["external:validate"], "node scripts/external-source-validation-browser.mjs");
assert.equal(packageJson.scripts["external:source-help"], "node scripts/external-source-validation-browser.mjs --help");
assert.equal(packageJson.scripts["external:source-intake"], "node scripts/external-source-validation-browser.mjs --source-intake");
assert.equal(packageJson.scripts["external:approval-request"], "node scripts/external-source-validation-browser.mjs --approval-request");
assert.equal(packageJson.scripts["external:validate:selftest"], "node scripts/external-source-validation-browser.mjs --self-test");
assert.equal(packageJson.scripts["external:validate:public-dry-run"], "node scripts/external-source-validation-browser.mjs --public-source-dry-run");
assert.equal(packageJson.scripts["external:privacy-template"], "node scripts/validate-external-source-privacy-review.mjs --write-template");
assert.equal(packageJson.scripts["external:privacy-review"], "node scripts/validate-external-source-privacy-review.mjs");
assert.equal(packageJson.scripts["external:privacy-review:selftest"], "node scripts/validate-external-source-privacy-review.mjs --self-test");
assert.equal(packageJson.scripts["ko:next"], "node scripts/ko-next-action-summary.mjs");
assert.equal(packageJson.scripts["ko:validate"], "node scripts/validate-ko-evidence.mjs");
assert.equal(packageJson.scripts["ko:validate:selftest"], "node scripts/validate-ko-evidence.mjs --self-test");
assert.equal(packageJson.scripts["next:readiness"], "node scripts/next-major-readiness.mjs");
assert.equal(packageJson.scripts["next:readiness:selftest"], "node scripts/next-major-readiness-self-test.mjs");
assert.equal(packageJson.scripts["next:operator"], "node scripts/next-major-operator-packet.mjs");
assert.equal(packageJson.scripts["next:operator:selftest"], "node scripts/next-major-operator-self-test.mjs");
assert.equal(packageJson.scripts["next:finalize"], "node scripts/finalize-next-major.mjs");
assert.equal(packageJson.scripts["next:finalize:selftest"], "node scripts/finalize-next-major.mjs --self-test");
assert.equal(packageJson.scripts["next:local-evidence"], "node scripts/refresh-next-major-local-evidence.mjs");
assert.equal(packageJson.scripts["next:local-evidence:selftest"], "node scripts/refresh-next-major-local-evidence.mjs --self-test");
assert.equal(packageJson.scripts["platform:qa-handoff"], "node scripts/platform-qa-handoff.mjs");
assert.equal(packageJson.scripts["platform:qa-handoff:selftest"], "node scripts/platform-qa-handoff-self-test.mjs");
assert.equal(packageJson.scripts["morning:receipts"], "node scripts/validate-morning-receipts.mjs");
assert.equal(packageJson.scripts["mac:manual:validate"], "node scripts/validate-mac-manual-qa.mjs");
assert.equal(packageJson.scripts["mac:manual:validate:real"], "node scripts/validate-mac-manual-qa.mjs --qa dist/morning-demo/MAC_MANUAL_QA.md --platform-handoff .codex-tmp/platform-qa-handoff/current.json --out .codex-tmp/mac-manual-qa/real-run-receipt.json");
assert.equal(packageJson.scripts["windows:static:validate"], "node scripts/validate-windows-static-qa.mjs");
assert.equal(packageJson.scripts["windows:static:validate:real"], "node scripts/validate-windows-static-qa.mjs --qa dist/morning-demo/WINDOWS_STATIC_QA.md --platform-handoff .codex-tmp/platform-qa-handoff/current.json --out .codex-tmp/windows-static-qa/real-run-receipt.json");
assert.equal(packageJson.scripts["harmony:device:validate"], "node scripts/validate-harmony-device-qa.mjs");
assert.equal(packageJson.scripts["harmony:device:validate:real"], "node scripts/validate-harmony-device-qa.mjs --qa dist/morning-demo/HARMONY_DEVICE_QA.md --platform-handoff .codex-tmp/platform-qa-handoff/current.json --out .codex-tmp/harmony-device-qa/real-run-receipt.json");
assert.equal(packageJson.scripts["git:revision:selftest"], "node scripts/git-revision-self-test.mjs");
assert.equal(packageJson.scripts["source:approval-freshness:selftest"], "node scripts/source-approval-freshness-self-test.mjs");
assert.equal(packageJson.scripts.smoke, "node scripts/git-revision-self-test.mjs && node scripts/source-approval-freshness-self-test.mjs && node scripts/platform-qa-handoff-self-test.mjs && node scripts/next-major-readiness-self-test.mjs && node scripts/next-major-operator-self-test.mjs && node scripts/finalize-next-major.mjs --self-test && node scripts/refresh-next-major-local-evidence.mjs --self-test && node scripts/smoke-web.mjs");
assert.match(validateMorningReceiptsJs, /const DEFAULT_ROOT = "dist\/morning-demo"/);
assert.match(validateMorningReceiptsJs, /process\.env\.MORNING_DEMO_OUT_DIR \|\| DEFAULT_ROOT/);
assert.match(validateMorningReceiptsJs, /--root=/);
assert.match(validateMorningReceiptsJs, /Usage: node scripts\/validate-morning-receipts\.mjs \[--root dist\/morning-demo\]/);
assert.match(gitRevisionHelperJs, /export async function readCurrentRevision/);
assert.match(gitRevisionHelperJs, /export function readCurrentRevisionSync/);
assert.match(gitRevisionHelperJs, /export function revisionCanClaim/);
assert.match(koStatusFreshnessHelperJs, /CURRENT_CLEAN_HEAD_KO_STATUS/);
assert.match(koStatusFreshnessHelperJs, /STALE_OR_DIRTY_KO_STATUS/);
assert.match(koStatusFreshnessHelperJs, /assessKoStatusFreshness/);
assert.doesNotMatch(koStatusFreshnessHelperJs, /after committing or stashing local changes/);
assert.match(platformQaAreasHelperJs, /export const MAC_MANUAL_QA_AREAS/);
assert.match(platformQaAreasHelperJs, /export const WINDOWS_STATIC_QA_AREAS/);
assert.match(platformQaAreasHelperJs, /export const HARMONY_DEVICE_QA_AREAS/);
assert.match(platformQaAreasHelperJs, /Quick Capture draft persistence/);
assert.match(platformQaAreasHelperJs, /Pre-return fingerprint check/);
assert.match(platformQaAreasHelperJs, /DevEco\/toolchain compile/);
assert.match(koEvidenceReviewJs, /from "\.\/lib\/platform-qa-areas\.mjs"/);
assert.match(gitRevisionHelperJs, /export function buildRevisionFromGitOutput/);
assert.match(gitRevisionHelperJs, /export function buildUnavailableRevision/);
assert.match(gitRevisionHelperJs, /dirtyWorktree: "TBD"/);
assert.match(gitRevisionSelfTestJs, /git_revision_selftest_ok/);
assert.match(gitRevisionSelfTestJs, /readCurrentRevisionSync/);
assert.match(gitRevisionSelfTestJs, /revisionCanClaim\(undefined\)/);
assert.match(gitRevisionSelfTestJs, /maxStatusSummaryLines: 1/);
assert.match(sourceApprovalFreshnessHelperJs, /export async function assessSourceApprovalFreshness/);
assert.match(sourceApprovalFreshnessHelperJs, /CURRENT_CLEAN_PUBLIC_DRY_RUN/);
assert.match(sourceApprovalFreshnessHelperJs, /STALE_OR_DIRTY_PUBLIC_DRY_RUN/);
assert.match(sourceApprovalFreshnessHelperJs, /export function buildApprovedCandidateCommand/);
assert.match(sourceApprovalFreshnessHelperJs, /function validateRequestedApprovalText/);
assert.match(sourceApprovalFreshnessHelperJs, /function parseApprovalTokens/);
assert.match(sourceApprovalFreshnessHelperJs, /Requested approval text must include the exact approved reading URL/);
assert.match(sourceApprovalFreshnessSelfTestJs, /genericApprovalTextRequest/);
assert.match(sourceApprovalFreshnessHelperJs, /export function buildFreshSourceCommands/);
assert.match(sourceApprovalFreshnessHelperJs, /refreshPublicDryRun/);
assert.match(sourceApprovalFreshnessHelperJs, /validatePublicDryRunReceiptBasis/);
assert.match(sourceApprovalFreshnessHelperJs, /validateApprovedCandidateCommand/);
assert.match(sourceApprovalFreshnessHelperJs, /sourceApprovalRequest\.approvalRequestPath/);
assert.match(sourceApprovalFreshnessHelperJs, /DEFAULT_SOURCE_APPROVAL_REQUEST_PATH/);
assert.match(sourceApprovalFreshnessHelperJs, /--out \$\{shellQuote\(approvalRequestPath\)\}/);
assert.match(sourceApprovalFreshnessHelperJs, /--markdown-out \$\{shellQuote\(markdownSiblingPath\(approvalRequestPath\)\)\}/);
assert.match(sourceApprovalFreshnessHelperJs, /--source-approval-request \$\{shellQuote\(approvalRequestPath\)\}/);
assert.match(sourceApprovalFreshnessHelperJs, /function markdownSiblingPath/);
assert.match(sourceApprovalFreshnessHelperJs, /Prior public dry-run receipt path is missing/);
assert.doesNotMatch(sourceApprovalFreshnessHelperJs, /after committing or stashing local changes/);
assert.match(sourceApprovalFreshnessHelperJs, /external-source-validation-browser\.v1/);
assert.match(sourceApprovalFreshnessHelperJs, /profileRetained is false/);
assert.match(sourceApprovalFreshnessHelperJs, /does not match receipt-validated sources/);
assert.match(sourceApprovalFreshnessSelfTestJs, /source_approval_freshness_selftest_ok/);
assert.match(sourceApprovalFreshnessSelfTestJs, /mismatchedCommand/);
assert.match(sourceApprovalFreshnessSelfTestJs, /--source-approval-request/);
assert.match(sourceApprovalFreshnessSelfTestJs, /profileRetained/);
assert.match(platformQaHandoffSelfTestJs, /platform_qa_handoff_selftest_ok/);
assert.match(platformQaHandoffSelfTestJs, /PLATFORM_QA_HANDOFF_ONLY/);
assert.match(platformQaHandoffSelfTestJs, /CURRENT_CLEAN_HEAD_PLATFORM_QA_HANDOFF/);
assert.match(platformQaHandoffSelfTestJs, /REVISION_REFRESH_REQUIRED_BEFORE_PLATFORM_QA/);
assert.match(platformQaHandoffSelfTestJs, /rowsNeedingConcreteNotes/);
assert.match(platformQaHandoffSelfTestJs, /--out requires a file path/);
assert.match(platformQaHandoffSelfTestJs, /--markdown-out requires a file path/);
assert.match(platformQaHandoffSelfTestJs, /Missing KO status file/);
assert.match(platformQaHandoffBindingJs, /learning-companion\.platform-qa-handoff-binding\.v1/);
assert.match(platformQaHandoffBindingJs, /learning-companion\.platform-qa-handoff\.v1/);
assert.match(platformQaHandoffBindingJs, /readPlatformHandoffBinding/);
assert.match(platformQaHandoffBindingJs, /buildPlatformHandoffBinding/);
assert.match(platformQaHandoffBindingJs, /CURRENT_CLEAN_HEAD_PLATFORM_QA_HANDOFF/);
assert.match(platformQaHandoffBindingJs, /CURRENT_CLEAN_HEAD_KO_STATUS/);
assert.match(platformQaHandoffBindingJs, /executionFreshness\.problems/);
assert.match(platformQaHandoffBindingJs, /real platform QA requires --platform-handoff/);
assert.match(platformQaHandoffBindingJs, /platform handoff gitHead .* does not match current HEAD/);
assert.match(platformQaHandoffBindingJs, /platform QA validator must run from the same clean worktree as the handoff/);
assert.match(platformQaHandoffBindingJs, /platform handoff missing platform/);
assert.match(nextMajorReadinessSelfTestJs, /next_major_readiness_selftest_ok/);
assert.match(nextMajorReadinessSelfTestJs, /NEXT_MAJOR_READINESS_SUMMARY_ONLY/);
assert.match(nextMajorReadinessSelfTestJs, /NOT_READY_MISSING_EVIDENCE/);
assert.match(nextMajorReadinessSelfTestJs, /PRE_RELEASE_EVIDENCE_READY/);
assert.match(nextMajorReadinessSelfTestJs, /cannot-claim-with-passing-requirements/);
assert.match(nextMajorReadinessSelfTestJs, /claim-with-failing-requirement/);
assert.match(nextMajorReadinessSelfTestJs, /refresh-status\.json/);
assert.match(nextMajorReadinessSelfTestJs, /releaseActionAuthorized, false/);
assert.match(nextMajorReadinessSelfTestJs, /missing required requirements/);
assert.match(nextMajorReadinessSelfTestJs, /--markdown-out requires a file path/);
assert.match(nextMajorOperatorSelfTestJs, /next_major_operator_selftest_ok/);
assert.match(nextMajorOperatorSelfTestJs, /NEEDS_CURRENT_TURN_APPROVAL/);
assert.match(nextMajorOperatorSelfTestJs, /NEEDS_FRESH_PUBLIC_DRY_RUN_OR_APPROVAL_REQUEST/);
assert.match(nextMajorOperatorSelfTestJs, /NEEDS_FRESH_PLATFORM_QA_HANDOFF/);
assert.match(nextMajorOperatorSelfTestJs, /NEEDS_SOURCE_INPUT/);
assert.match(nextMajorOperatorSelfTestJs, /windowsStaticManualQa/);
assert.match(nextMajorOperatorSelfTestJs, /harmonyDeviceQa/);
assert.match(nextMajorOperatorSelfTestJs, /real-platform-operator/);
assert.match(nextMajorOperatorSelfTestJs, /direct-source-only-binding/);
assert.match(nextMajorOperatorSelfTestJs, /custom source only approval/);
assert.match(nextMajorOperatorSelfTestJs, /double-quoted-source-fallback/);
assert.match(nextMajorOperatorSelfTestJs, /old source approval request/);
assert.match(nextMajorOperatorSelfTestJs, /countOccurrences/);
assert.match(nextMajorOperatorSelfTestJs, /CURRENT_CLEAN_PLATFORM_QA_HANDOFF/);
assert.match(nextMajorOperatorSelfTestJs, /CURRENT_CLEAN_PUBLIC_DRY_RUN/);
assert.match(nextMajorOperatorSelfTestJs, /releaseActionAuthorized mismatch/);
assert.match(devServerJs, /--port/);
assert.match(devServerJs, /--strict-port/);
assert.match(devServerJs, /Port \$\{requestedPort\} unavailable; using \$\{selectedPort\}\./);
assert.match(devServerJs, /cache-control/);
assert.equal(manifest.display, "standalone");
assert.equal(manifest.start_url, "./");
assert.equal(manifest.icons[0].src, "./assets/icon.svg");
assert.match(indexHtml, /Capture \(Cmd\/Ctrl\+Enter\)/);
assert.match(indexHtml, /Cmd\/Ctrl\+Shift\+Enter/);
assert.match(indexHtml, /role="combobox"/);
assert.match(indexHtml, /aria-controls="searchResults"/);
assert.match(indexHtml, /role="listbox"/);
assert.match(indexHtml, /id="sidecarRail" class="sidecar-rail" aria-label="Sidecar study rail" aria-live="off"/);
assert.match(indexHtml, /id="activityHint" class="next-step-hint" data-next-step-hint="" data-hint-installed="true" hidden/);
assert.match(indexHtml, /id="activityHintBtn" class="mini-button" type="button"/);
assert.match(indexHtml, /id="sidecarLayoutBtn"[^>]+aria-label="Focus sidecar layout"[^>]*>Focus Sidecar<\/button>/);
assert.match(indexHtml, /id="languageSelect"[^>]*aria-label="Language \/ 语言"/);
assert.match(indexHtml, /<option value="zh">中<\/option>/);
assert.match(indexHtml, /id="focusBriefActionBtn" class="command-button" type="button">Start typing<\/button>/);
assert.match(indexHtml, /id="updateNotice" class="storage-notice update-notice" hidden/);
assert.match(indexHtml, /id="updateReloadBtn" class="mini-button" type="button">Reload/);
assert.match(indexHtml, /id="workspaceExportSection" class="export-section-title"/);
assert.match(indexHtml, /id="workspaceExportNote" class="export-note"/);
assert.match(indexHtml, /id="workspaceExportJsonSummary"/);
assert.match(indexHtml, /id="browserCaptureExportSection" class="export-section-title"/);
assert.match(indexHtml, /id="browserCaptureExportNote" class="export-note"/);
assert.match(indexHtml, /id="notesToolbar" class="notes-toolbar" aria-label="Notes formatting"/);
assert.match(indexHtml, /data-notes-tool="bold"/);
assert.match(indexHtml, /id="insertTimestampNoteBtn"/);
assert.match(appJs, /ArrowDown/);
assert.match(appJs, /aria-activedescendant/);
assert.match(appJs, /event\.isComposing/);
assert.match(appJs, /searchResultsCollapsed/);
assert.match(appJs, /scrollIntoView\(\{ block: "nearest" \}\)/);
assert.match(appJs, /openSearchResult\(results\[Math\.max\(0, activeSearchIndex\)\]\)/);
assert.match(appJs, /UI_PREFS_SCHEMA_VERSION = \d+/);
assert.match(appJs, /language: normalizeUiLanguage\(parsed\.language\)/);
assert.match(appJs, /function langText\(en, zh\)/);
assert.match(appJs, /function languageText\(language, en, zh\)/);
assert.match(appJs, /document\.documentElement\.lang = language === "zh" \? "zh-CN" : "en"/);
assert.match(appJs, /label\[for="sessionTitle"\]/);
assert.match(appJs, /data-focus-mode="synthesize"/);
assert.match(appJs, /data-tab="captures"/);
assert.match(appJs, /Question Queue Health", "问题队列健康度"/);
assert.match(appJs, /Study Details", "学习详情"/);
assert.match(appJs, /Review Next", "复习下一张"/);
assert.match(appJs, /Recent Stack", "最近堆栈"/);
assert.match(appJs, /Search result opened", "搜索结果已打开"/);
assert.match(appJs, /Time adjusted", "时间已调整"/);
assert.match(appJs, /Source resumed", "来源已继续"/);
assert.match(appJs, /Capture note updated", "摘录笔记已更新"/);
assert.match(appJs, /function renderExportShellCopy\(\)/);
assert.match(appJs, /function exportShellCopy\(\)/);
assert.match(appJs, /function exportToastCopy\(kind\)/);
assert.match(appJs, /function localizedMessage\(message\)/);
assert.doesNotMatch(appJs, /copyText\(dom\.workspaceExport\.value, "Workspace copied"\)/);
[
  "完整工作区（全部主题）",
  "仅本地备份。这里不是云同步，也不是飞书上传。",
  "显示工作区 JSON",
  "复制工作区",
  "保存工作区",
  "复习包",
  "当前主题",
  "镜像文件夹",
  "浏览器摘录",
  "复制 Clip，把它加入浏览器书签",
  "工作区已复制",
  "今日学习包已复制",
  "镜像 bundle 已复制",
  "备份已保存 - 请确认所选文件",
  "已请求导出备份 - 请确认导出的文件",
  "这里无法使用保存选择器；请使用复制，或通过 Mac 应用导出。"
].forEach((text) => assert.ok(appJs.includes(text), `app.js should include bilingual export surface copy: ${text}`));
assert.match(appJs, /function importReceiptTitle\(receipt, language = currentLanguage\(\)\)/);
assert.match(appJs, /function formatImportReceipt\(receipt, language = currentLanguage\(\)\)/);
assert.match(appJs, /function formatReturnFilesReceipt\(receipt, language = currentLanguage\(\)\)/);
assert.match(appJs, /function returnedWorkTitle\(work, language = currentLanguage\(\)\)/);
assert.match(appJs, /formatImportReceipt\(lastImportReceipt, "en"\)/);
assert.match(appJs, /formatImportReceipt\(lastImportReceipt, "zh"\)/);
[
  "Return files imported",
  "Mobile inbox imported",
  "Review progress imported",
  "Import issue",
  "Open Return Files",
  "Import failed",
  "Last import:",
  "返回文件已导入",
  "移动收件箱已导入",
  "复习进度已导入",
  "导入问题",
  "导入失败",
  "打开返回文件",
  "上次导入：",
  "镜像基线已变化 - 下次设备处理前请导出更新镜像",
  "刷新卡片",
  "查看已关闭问题",
  "导入详情"
].forEach((text) => assert.ok(appJs.includes(text), `app.js should include bilingual receipt copy: ${text}`));
assert.match(appJs, /schema === "learning-companion\.return-files-receipt\.v1"/);
assert.match(appJs, /kind: "return-files"/);
assert.match(appJs, /renderCaptureStarterCopy/);
assert.match(appJs, /function renderNotesToolbarCopy/);
assert.match(appJs, /function insertCurrentTimestampNote/);
assert.match(appJs, /function addVideoBookmarkAt/);
assert.match(appJs, /videoPlaybackRate: normalizeVideoPlaybackRate/);
assert.match(appJs, /parsedSchemaVersion > UI_PREFS_SCHEMA_VERSION/);
assert.match(smokeBrowserJs, /assertUiPrefsV6Migration/);
assert.match(smokeBrowserJs, /draftQuote: "migration draft quote"/);
assert.match(appJs, /workspaceBackupFingerprint/);
assert.match(appJs, /workspaceStorageNotice/);
assert.match(appJs, /mirrorHandoff/);
assert.match(appJs, /buildReturnBaseFingerprint\(workspace\)/);
assert.match(appJs, /workspaceFingerprint: workspaceBackupFingerprint\(workspace\)/);
assert.match(appJs, /mirrorHandoffContentChanged/);
assert.match(appJs, /deviceFlowActionState/);
assert.match(appJs, /return-files-action-hint/);
assert.match(appJs, /Next: import or paste the return file/);
assert.match(appJs, /Export Updated Mirror/);
assert.match(appJs, /mirrorReturnImportCoversCurrentWorkspace/);
assert.match(appJs, /mirrorLegacyReturnImportCoversExport/);
assert.match(appCss, /\.notes-toolbar/);
assert.match(appCss, /\.video-bookmarks/);
assert.match(appJs, /mirrorExportChangeSummary/);
assert.match(appJs, /MIRROR_EXPORT_CHANGE_FIELDS/);
assert.match(appJs, /renderMirrorChangeDetail/);
assert.match(appJs, /device-flow-change-detail/);
assert.match(appJs, /Mirror contents changed/);
assert.match(appJs, /Mirror baseline changed/);
assert.match(appJs, /workspace changed/);
assert.match(appJs, /return baseline changed/);
assert.match(appJs, /time-derived due-card changes/);
assert.match(appJs, /No mirror exported yet/);
assert.match(appJs, /Mirror current/);
assert.match(appJs, /Mac changed since mirror export/);
assert.match(appJs, /Last return imported/);
assert.match(appJs, /Paste Return File/);
assert.match(appJs, /pasteReturnFileFromClipboard/);
assert.match(appJs, /ACTIVITY_NEXT_HINTS/);
assert.match(appJs, /afterQuoteSave/);
assert.match(appJs, /afterThoughtAdded/);
assert.match(appJs, /afterCardMade/);
assert.match(appJs, /Saved for recall\. Jump back to the source; the card is here when you want to review/);
assert.match(appJs, /afterCardMadeSourceLinked/);
assert.match(appJs, /Open the new review card/);
assert.match(appJs, /dataset\.hintInstalled = "true"/);
assert.match(appJs, /runActivityHintAction/);
assert.match(appJs, /Clipboard does not contain an inbox or review return file\. Use Import Return Files for full workspace files/);
assert.match(appJs, /Clipboard text is not valid JSON/);
assert.match(appJs, /showSaveFilePicker/);
assert.match(appJs, /messageHandlers\?\.learningCompanion/);
assert.match(appJs, /completeSaveRequest/);
assert.match(appJs, /shouldUseFallbackDownload/);
assert.match(appJs, /__LC_ALLOW_AUTOMATED_DOWNLOADS__/);
assert.match(macMainSwift, /private func nativeText\(_ en: String, _ zh: String\) -> String/);
assert.match(macMainSwift, /Locale\.preferredLanguages\.first\?\.lowercased\(\)/);
[
  "导入工作区...",
  "导出工作区...",
  "打开晨间复习包",
  "保存选中文本为摘录",
  "保存剪贴板为摘录",
  "从剪贴板填充摘录",
  "进入侧栏窗口",
  "恢复桌面窗口",
  "保持窗口置顶",
  "导入 Learning Companion 工作区",
  "导出 Learning Companion 工作区",
  "保存 Learning Companion 导出",
  "无法从 Web 视图读取当前工作区。",
  "未找到 Learning Companion Web 应用",
  "全局快捷键：不可用",
  "选中文本：需要辅助功能权限"
].forEach((text) => assert.ok(macMainSwift.includes(text), `Mac shell should include bilingual native copy: ${text}`));
assert.match(macMainSwift, /WKScriptMessageHandler/);
assert.match(macMainSwift, /configuration\.userContentController\.add\(self, name: "learningCompanion"\)/);
assert.match(macMainSwift, /payload\["type"\] as\? String == "saveTextFile"/);
assert.match(macMainSwift, /completeNativeSaveRequest\(requestId, ok: true\)/);
assert.match(appJs, /if \(!shouldUseFallbackDownload\(\)\) \{[\s\S]+downloadBlob\(filename, blob\);/);
assert.match(appJs, /Backup export requested - verify the exported file/);
assert.match(appJs, /Backup saved - verify the selected file/);
assert.match(appJs, /openFocusBriefWarning/);
assert.match(appJs, /answerQuestionFromToday/);
assert.match(appJs, /Finish current draft before answering/);
assert.match(appJs, /Answer draft resumed/);
assert.match(appJs, /focusCaptureDraftContinuation/);
assert.match(appJs, /answerDraftBlocksQuestion/);
assert.match(appJs, /Time kept @/);
assert.match(appJs, /todayDraftSourceMeta/);
assert.match(appJs, /todayDraftSourceDetail/);
assert.match(appJs, /Draft began on/);
assert.match(appJs, /redundantKinds = \["capture", "continue"\]/);
assert.match(appJs, /data-today-section/);
assert.match(appJs, /captureContextOpenLabel/);
assert.match(appJs, /captureContextOpenTitle/);
assert.match(appJs, /Quick Capture stays ready/);
assert.match(appJs, /快速摘录保持可用/);
assert.match(appJs, /captureContextDraftSummary/);
assert.match(indexHtml, /id="captureContextDraft" class="capture-context-draft"/);
assert.match(appJs, /captureIsQuoteOnly/);
assert.match(appJs, /Highlight saved/);
assert.match(appJs, /source page is unchanged/);
assert.match(appJs, /targetPane: "highlightAnnotation"/);
assert.match(appJs, /activityTargetsHighlightAnnotation/);
assert.match(appJs, /Add thought to saved highlight/);
assert.match(appJs, /captureStackNextStep/);
assert.match(appJs, /Needs your why — or leave it as a quote/);
assert.match(appJs, /需要补上你的原因/);
assert.match(appJs, /Choose next: add to Notes for synthesis, or save for recall/);
assert.match(appJs, /In Notes · keep reading, or save for recall practice/);
assert.match(appJs, /capture-detail-next/);
assert.match(appJs, /Highlight already has a thought/);
assert.match(appJs, /高亮已经有想法/);
assert.match(appJs, /updateCaptureThought/);
assert.match(appJs, /Add why this highlight matters/);
assert.match(appJs, /Update note/);
assert.match(appJs, /更新笔记/);
assert.match(appJs, /View in Notes/);
assert.match(appJs, /captureNoteActionMeta/);
assert.match(appJs, /Add this capture to Notes for synthesis/);
assert.match(appJs, /View this generated capture block in Notes/);
assert.match(appJs, /Update this capture's generated Notes block/);
assert.match(appJs, /Capture note opened/);
assert.match(appJs, /captureNoteState/);
assert.match(appJs, /captureNoteBlockMarkdown/);
assert.match(appJs, /captureNoteFingerprint/);
assert.match(appJs, /learning-companion:capture-fingerprint/);
assert.match(appJs, /Capture note updated/);
assert.match(appJs, /targetPane: "notes"/);
assert.match(appJs, /pendingCaptureUndoRemainingSeconds/);
assert.match(appJs, /Undo delete \(/);
assert.match(appJs, /seconds remaining/);
assert.match(appJs, /A new save replaced the capture-delete recovery point/);
assert.match(appJs, /dataset\.draftSourceState/);
assert.match(appJs, /Use current to re-anchor before saving/);
assert.match(appJs, /View note/);
assert.match(appJs, /target\?\.focus\(\{ preventScroll: true \}\)/);
assert.match(appJs, /targetPane: "quickCapture"/);
assert.match(appJs, /installShellCompatibilityNodes/);
assert.match(appJs, /watchServiceWorkerUpdate/);
assert.match(appJs, /updateNoticeShown/);
assert.match(appJs, /dom\.updateReloadBtn\.disabled = true/);
assert.match(appJs, /registration\.waiting/);
assert.match(appJs, /controllerchange/);
assert.match(appJs, /App update ready - reload to use the newest Learning Flow\./);
assert.match(appJs, /staysInSidecar/);
assert.match(appJs, /activityStaysInSidecar/);
assert.match(appJs, /activityTargetsQuickCapture/);
assert.match(appJs, /activityTargetsSource/);
assert.match(appJs, /Focus Quick Capture/);
assert.match(appJs, /Focus Source URL/);
assert.match(appJs, /Link source or jot loose thought/);
assert.match(appJs, /function resolveStartHereLoopPreviewState/);
assert.match(appJs, /function focusFirstCaptureFromLoopPreview/);
assert.match(appJs, /Pending - After first capture/);
assert.match(appJs, /First capture ready/);
assert.match(appJs, /Save to unlock Notes, Review, and return files/);
assert.match(appJs, /wide: true,\n    tone: "pending"/);
assert.match(appJs, /After first capture/);
assert.match(appJs, /later phone\/Windows pass/);
assert.match(appCss, /\.highlight-annotation-form/);
assert.match(appCss, /\.capture-stack-next/);
assert.match(appCss, /\.capture-note-chip/);
assert.match(appCss, /\.notes-preview \.note-capture-block/);
assert.match(markdownJs, /noteCaptureId/);
assert.match(markdownJs, /learning-companion:capture:/);
assert.match(markdownJs, /CAPTURE_MARKER_PATTERN/);
assert.match(markdownJs, /findValidCaptureMarkerLines/);
assert.match(markdownJs, /aria-label", "Generated capture note"/);
assert.match(markdownJs, /tabIndex = -1/);
assert.match(appJs, /resumeCurrentSource/);
assert.match(appJs, /handleCaptureContextSourceAction/);
assert.match(appJs, /promptForSource/);
assert.match(appJs, /Resume @/);
assert.match(appJs, /Set source URL/);
assert.match(indexHtml, /data-capture-starter="question"/);
assert.match(indexHtml, /Cmd\/Ctrl\+Shift\+1/);
assert.match(indexHtml, /Cmd\/Ctrl\+Shift\+2/);
assert.match(indexHtml, /Cmd\/Ctrl\+Shift\+3/);
assert.match(appJs, /applyCaptureStarter/);
assert.match(appJs, /handleCaptureStarterShortcut/);
assert.match(appJs, /isEditableTarget\(event\.target\)/);
assert.match(appJs, /targetPane: "quickCapture"/);
assert.match(appJs, /never commit a capture\/card/);
assert.match(appJs, /renderCaptureStarters/);
assert.match(appJs, /captureSaveActivity/);
assert.match(appJs, /targetSection: "open_questions"/);
assert.match(appJs, /targetSection: linked \? "closed_questions" : "answers_today"/);
assert.match(appJs, /Saved in Answers Today\. It did not close a question because no question was linked\./);
assert.match(appJs, /Save it for recall if needed/);
assert.match(appJs, /Question draft still needs a body/);
const captureSaveActivityBody = appJs.match(/function captureSaveActivity[\s\S]*?\n}\n\nfunction captureSaveToast/)?.[0] || "";
assert.equal((captureSaveActivityBody.match(/actionLabel:/g) || []).length, 7);
assert.match(appJs, /function cardMadeActivity/);
assert.match(appJs, /targetPane: "reviewCardSourceResume"/);
assert.match(appJs, /sourceFirst: false/);
assert.match(appJs, /renderTodaySectionMap/);
assert.match(appJs, /renderLearningFlowPanel/);
assert.match(appJs, /nextCaptureDecisionItem/);
assert.match(appJs, /captureNeedsDurableDecision/);
assert.match(appJs, /Choose latest capture's next step/);
assert.match(appJs, /choose whether the latest capture belongs in Notes or Review/);
assert.match(appJs, /resolveSourceSessionState/);
assert.match(appJs, /resumeSourceFromLearningFlow/);
assert.match(appJs, /renderSidecarRail/);
assert.match(appJs, /dataset\.sidecarRailStep/);
assert.match(appJs, /Focus Sidecar/);
assert.match(appJs, /Full Desk/);
assert.match(appJs, /openTodayFromSidecar/);
assert.match(appJs, /dataset\.learningFlowStep = step\.kind/);
assert.match(appJs, /classList\.add\("is-wide"\)/);
assert.match(appJs, /actionAriaLabel/);
assert.match(appJs, /Read source/);
assert.match(appJs, /Needs source/);
assert.match(appJs, /renderReturnedWorkNudge/);
assert.match(appJs, /function renderDeviceTransferGuide/);
assert.match(appJs, /Manual round trip/);
assert.match(appJs, /extract it first/);
assert.match(appJs, /Return patches move Mac-ward only/);
assert.match(appJs, /does not import inbox\/review return patches back into itself/);
assert.match(appJs, /learning-companion-inbox-patch-\*\.json/);
assert.match(appJs, /learning-companion-review-progress-patch-\*\.json/);
assert.match(appJs, /will not auto-scan Downloads/);
assert.match(appJs, /manual file carrier here; it is not verified live sync/);
assert.match(appJs, /Returned from phone\/Windows/);
assert.match(appJs, /returnReceiptNewWork/);
assert.match(appJs, /dismissedReturnNudgeKey/);
assert.match(appJs, /returnedWorkAction/);
assert.match(appJs, /returnedWorkTertiary/);
assert.match(appJs, /Review status/);
assert.match(appJs, /openReturnedReviewStatus/);
assert.match(appJs, /no cards are due right now/);
assert.match(appJs, /returnedInboxAnsweredQuestions/);
assert.match(appJs, /returnedInboxRefreshableReviewCards/);
assert.match(appJs, /returnedAnswerFollowup/);
assert.match(appJs, /Refresh cards/);
assert.match(appJs, /View closed questions/);
assert.match(appJs, /Returned review-progress events stay higher priority/);
assert.match(appJs, /seedFirstQuestionDraft/);
assert.match(appJs, /Question ready in Quick Capture for/);
assert.match(appJs, /link a source later to anchor it/);
assert.match(appJs, /todayMapTarget/);
assert.match(appJs, /dom\.todayList\.append\(dom\.todaySummary\)/);
assert.match(appJs, /older return file/);
assert.match(appJs, /export updated mirror/);
assert.match(appJs, /signal-button/);
assert.match(appJs, /const scrollTarget = section \|\| dom\.todayList/);
assert.match(appJs, /shouldCompressSidecarFocusBrief/);
assert.match(appJs, /is-sidecar-redundant/);
assert.match(appCss, /\.today-map-button/);
assert.match(appCss, /\.learning-flow-panel/);
assert.match(appCss, /\.learning-flow-step\.is-wide/);
assert.match(appCss, /\.learning-flow-step\.is-source/);
assert.match(appCss, /\.learning-flow-step\.is-pending/);
assert.match(appCss, /\.needs-durable-decision \.capture-decision-button/);
assert.match(appCss, /\.next-step-hint/);
assert.match(appCss, /\.activity-copy \.next-step-hint span/);
assert.match(appCss, /\.sidecar-rail/);
assert.match(appCss, /\.sidecar-rail-button/);
assert.match(appCss, /\.app-shell\.sidecar-layout \.metrics-row/);
assert.match(appCss, /\.app-shell\.sidecar-layout \.focus-brief/);
assert.match(appCss, /\.app-shell\.sidecar-layout \.focus-brief\.is-sidecar-redundant/);
assert.match(appCss, /\.app-shell\.sidecar-layout \.focus-brief-facts/);
assert.match(appCss, /\.sidecar-toggle \{/);
assert.match(appCss, /minmax\(124px, auto\)/);
assert.match(appCss, /\.returned-work-card/);
assert.match(appCss, /\.capture-context-target[\s\S]+-webkit-line-clamp: 2/);
assert.match(appCss, /\.capture-context-target[\s\S]+overflow-wrap: anywhere/);
assert.match(appCss, /\.capture-context-source[\s\S]+-webkit-line-clamp: 2/);
assert.match(appCss, /\.capture-context-source[\s\S]+overflow-wrap: anywhere/);
assert.match(appCss, /\.capture-context-draft[\s\S]+overflow-wrap: anywhere/);
assert.match(appCss, /\.capture-context-source\.warn/);
assert.match(appCss, /\.manual-transfer-badge/);
assert.match(appCss, /\.device-flow-badges/);
assert.match(appCss, /\.device-transfer-guide/);
assert.match(appCss, /\.device-transfer-grid/);
assert.match(appCss, /\.device-transfer-card/);
assert.match(appCss, /\.return-files-action-hint/);
assert.match(appCss, /\.return-files-action-group/);
assert.match(appCss, /\.return-files-action-group\.is-intake/);
assert.match(appCss, /\.handoff-state-grid/);
assert.match(appCss, /\.handoff-change-detail/);
assert.match(appCss, /\.handoff-change-list/);
assert.match(appCss, /grid-column: 1 \/ -1/);
assert.match(appCss, /\.today-detail-drawer/);
assert.match(appCss, /\.today-detail-badge/);
assert.match(appCss, /\.storage-notice\.update-notice/);
assert.match(appCss, /prefers-reduced-motion: reduce/);
assert.match(serviceWorker, /CACHE_NAME/);
assert.match(serviceWorker, /learning-companion-static-v\d+/);
assert.match(serviceWorker, /STATIC_ASSETS/);
assert.match(serviceWorker, /src\/app\.js/);
assert.match(serviceWorker, /src\/viewer\.js/);
assert.match(serviceWorker, /src\/reader\.js/);
assert.match(serviceWorker, /src\/voice\.js/);
assert.match(serviceWorker, /src\/canvas\.js/);
assert.match(serviceWorker, /pathname\.startsWith\("\/api\/"\)/);
assert.match(serviceWorker, /await fetch\(request\)/);
assert.match(serviceWorker, /cache\.match\(request\)/);
assert.match(serviceWorker, /name\.startsWith\("learning-companion-static-"\) && name !== CACHE_NAME/);
assert.match(smokeBrowserJs, /const chromePath = resolveChromePath\(\)/);
assert.match(smokeBrowserJs, /process\.env\.CHROME_PATH/);
assert.match(smokeBrowserJs, /\/usr\/bin\/chromium/);
assert.doesNotMatch(smokeBrowserJs, /const chromePath = ["']\/Applications\/Google Chrome\.app/);
[smokeSourceResumeJs, smokeTextFragmentBrowserJs, agentStudyLoopCheckJs, externalSourceValidationBrowserJs].forEach((browserScript) => {
  assert.match(browserScript, /const chromePath = resolveChromePath\(\)/);
  assert.match(browserScript, /process\.env\.CHROME_PATH/);
  assert.match(browserScript, /\/usr\/bin\/chromium/);
  assert.doesNotMatch(browserScript, /const chromePath = ["']\/Applications\/Google Chrome\.app/);
});
assert.match(smokeBilingualRuntimeBrowserJs, /snapshotStudyShell/);
assert.match(smokeBilingualRuntimeBrowserJs, /staticShellChromeZh: true/);
assert.match(smokeBilingualRuntimeBrowserJs, /staticShellChromeEnAfterSwitch: true/);
assert.match(smokeBilingualRuntimeBrowserJs, /newSessionDefaultZh: true/);
assert.match(smokeBilingualRuntimeBrowserJs, /studyShellZh: true/);
assert.match(smokeBilingualRuntimeBrowserJs, /todayLearningFlowZh: true/);
assert.match(smokeBilingualRuntimeBrowserJs, /reviewToolbarZh: true/);
assert.match(smokeBilingualRuntimeBrowserJs, /mainLoopCaptureZh: true/);
assert.match(smokeBilingualRuntimeBrowserJs, /synthesisOverwriteConfirmZh: true/);
assert.match(smokeBilingualRuntimeBrowserJs, /mirrorImportConfirmZh: true/);
assert.match(smokeBilingualRuntimeBrowserJs, /recentStackZh: true/);
assert.match(smokeBilingualRuntimeBrowserJs, /searchResultsZh: true/);
assert.match(smokeBilingualRuntimeBrowserJs, /activityHintZh: true/);
assert.match(smokeBilingualRuntimeBrowserJs, /问题队列健康度/);
assert.match(smokeBilingualRuntimeBrowserJs, /搜索主题、笔记、摘录/);
assert.match(smokeBilingualRuntimeBrowserJs, /导入工作区、镜像包或补丁/);
assert.match(smokeBilingualRuntimeBrowserJs, /综合草稿/);
assert.match(smokeBilingualRuntimeBrowserJs, /新建学习主题/);
assert.match(smokeBilingualRuntimeBrowserJs, /用重新生成的版本替换已编辑的综合草稿/);
assert.match(smokeBilingualRuntimeBrowserJs, /用镜像 bundle/);
assert.match(appJs, /Replace current workspace with mirror bundle/);
assert.match(appJs, /Replace your edited synthesis draft with a regenerated version/);
assert.match(appJs, /defaultNewSessionTitle/);
assert.match(smokeBilingualRuntimeBrowserJs, /复习下一张/);
assert.match(smokeBilingualRuntimeBrowserJs, /最近堆栈/);
assert.match(smokeBilingualRuntimeBrowserJs, /添加想法/);
assert.match(smokeBilingualRuntimeBrowserJs, /查找/);
assert.match(externalSourceValidationBrowserJs, /approved-current-turn/);
assert.match(externalSourceValidationBrowserJs, /buildCliHelp/);
assert.match(externalSourceValidationBrowserJs, /public learning-material URL/);
assert.match(externalSourceValidationBrowserJs, /public-source-dry-run/);
assert.match(externalSourceValidationBrowserJs, /dry-run-note/);
assert.match(externalSourceValidationBrowserJs, /reading-url/);
assert.match(externalSourceValidationBrowserJs, /video-url/);
assert.match(externalSourceValidationBrowserJs, /approval-note/);
assert.match(externalSourceValidationBrowserJs, /External video validation requires --video-timestamp/);
assert.match(externalSourceValidationBrowserJs, /args\["video-timestamp"\]/);
assert.match(externalSourceValidationBrowserJs, /--out-root requires a directory path/);
assert.match(externalSourceValidationBrowserJs, /--out requires a file path/);
assert.match(externalSourceValidationBrowserJs, /requireStringArg/);
assert.match(externalSourceValidationBrowserJs, /writePrivateFile/);
assert.match(externalSourceValidationBrowserJs, /error\?\.code !== "ENOENT"/);
assert.match(externalSourceValidationBrowserJs, /chmod\(path, 0o600\)/);
assert.match(externalSourceValidationBrowserJs, /allocateTcpPort\(\)/);
assert.doesNotMatch(externalSourceValidationBrowserJs, /9800 \+ Math\.floor/);
assert.match(externalSourceValidationBrowserJs, /LOCAL_FIXTURE_SELF_TEST/);
assert.match(externalSourceValidationBrowserJs, /APPROVED_SOURCE_CANDIDATE/);
assert.match(externalSourceValidationBrowserJs, /PUBLIC_SOURCE_DRY_RUN/);
assert.match(externalSourceValidationBrowserJs, /PUBLIC_SOURCE_DRY_RUN_NOT_APPROVED/);
assert.match(externalSourceValidationBrowserJs, /PUBLIC_REMOTE_SOURCE_DRY_RUN_AND_LOCAL_APP/);
assert.match(externalSourceValidationBrowserJs, /assertSourcePageUsable/);
assert.match(externalSourceValidationBrowserJs, /This site can.t be reached/);
assert.match(externalSourceValidationBrowserJs, /too little visible content/);
assert.match(externalSourceValidationBrowserJs, /external-source-run-context\.v1/);
assert.match(externalSourceValidationBrowserJs, /gitHeadCaptured/);
assert.match(externalSourceValidationBrowserJs, /dirtyWorktree/);
assert.match(externalSourceValidationBrowserJs, /statusCaptured/);
assert.match(externalSourceValidationBrowserJs, /throwaway-profile/);
assert.match(externalSourceValidationBrowserJs, /cleanupBrowserProfile/);
assert.match(externalSourceValidationBrowserJs, /profileRetained = profileCleanup\.retained/);
assert.match(externalSourceValidationBrowserJs, /profileCleanup/);
assert.match(externalSourceValidationBrowserJs, /Browser profile retained after run/);
assert.match(externalSourceValidationBrowserJs, /APPROVED_REMOTE_SOURCE_AND_LOCAL_APP/);
assert.match(externalSourceValidationBrowserJs, /sourceEvidence/);
assert.match(externalSourceValidationBrowserJs, /runApprovedUrlBoundarySelfChecks/);
assert.match(externalSourceValidationBrowserJs, /::ffff:127\.0\.0\.1/);
assert.match(externalSourceValidationBrowserJs, /isPrivateOrReservedIpv4/);
assert.match(externalSourceValidationBrowserJs, /expandMappedIpv4/);
assert.match(externalSourceValidationBrowserJs, /isSensitiveQueryKey/);
assert.match(externalSourceValidationBrowserJs, /X-Amz-Signature/);
assert.match(externalSourceValidationBrowserJs, /keyword=learning/);
assert.match(externalSourceValidationBrowserJs, /public, non-private approved source URL/);
assert.match(externalSourceValidationBrowserJs, /canClaimExternalKo: false/);
assert.match(externalSourceValidationBrowserJs, /cannot be privacy-reviewed into KO evidence/);
assert.match(externalSourceValidationBrowserJs, /Human privacy review is still required/);
assert.match(externalSourceValidationBrowserJs, /--no-sandbox/);
assert.match(externalSourceValidationBrowserJs, /02b-video-learning-tools\.png/);
assert.match(externalSourceValidationBrowserJs, /exerciseVideoLearningTools/);
assert.match(externalSourceValidationBrowserJs, /data-video-bookmark-action/);
assert.match(externalSourceValidationBrowserJs, /videoLearningToolsCaptured/);
assert.match(externalSourceValidationBrowserJs, /timestampNoteInserted/);
assert.match(externalSourceValidationBrowserJs, /videoBookmarkSaved/);
assert.match(externalSourceValidationBrowserJs, /playbackRatePersisted/);
assert.match(viewerJs, /videoBookmarkAction = "add"/);
assert.match(externalSourcePrivacyReviewJs, /external-source-privacy-review\.v1/);
assert.match(externalSourcePrivacyReviewJs, /external-source-ko-evidence-review\.v1/);
assert.match(externalSourcePrivacyReviewJs, /external-source-privacy-review-selftest\.v1/);
assert.match(externalSourcePrivacyReviewJs, /source-approval-request-binding\.v1/);
assert.match(externalSourcePrivacyReviewJs, /function validateSourceApprovalRequestBinding/);
assert.match(externalSourcePrivacyReviewJs, /sourceApprovalRequestBinding freshness must be CURRENT_CLEAN_PUBLIC_DRY_RUN/);
assert.match(externalSourcePrivacyReviewJs, /requested approval text must match receipt binding/);
assert.match(externalSourcePrivacyReviewJs, /sourceApprovalRequestBinding\.requestedApprovalText/);
assert.match(externalSourcePrivacyReviewJs, /function assertRequestedApprovalTextCoversSources/);
assert.match(externalSourcePrivacyReviewJs, /function parseApprovalTokens/);
assert.match(externalSourcePrivacyReviewJs, /requestedApprovalTextMatched/);
assert.match(externalSourcePrivacyReviewJs, /sourceApprovalRequestPath/);
assert.match(externalSourcePrivacyReviewJs, /approvedReadingUrl: receiptSummary\.sourceApprovalRequestBinding\.approvedReadingUrl/);
assert.match(externalSourcePrivacyReviewJs, /approvedVideoTimestamp: receiptSummary\.sourceApprovalRequestBinding\.approvedVideoTimestamp/);
assert.match(externalSourcePrivacyReviewJs, /gitHeadCaptured: runContext\.appRevision\.gitHeadCaptured/);
assert.match(externalSourcePrivacyReviewJs, /statusCaptured: runContext\.appRevision\.statusCaptured/);
assert.match(externalSourcePrivacyReviewJs, /statusShort: runContext\.appRevision\.statusShort/);
assert.match(koEvidenceReviewJs, /sourceApprovalRequest\.requestedApprovalText/);
assert.match(koEvidenceReviewJs, /external claim sourceApprovalRequest\.requestedApprovalText/);
assert.match(koEvidenceReviewJs, /function assertRequestedApprovalTextCoversClaim/);
assert.match(koEvidenceReviewJs, /function parseApprovalTokens/);
assert.match(externalSourcePrivacyReviewJs, /mode: 0o600/);
assert.match(externalSourcePrivacyReviewJs, /error\?\.code !== "ENOENT"/);
assert.match(externalSourcePrivacyReviewJs, /chmod\(path, 0o600\)/);
assert.match(externalSourcePrivacyReviewJs, /--out requires a file path/);
assert.match(externalSourcePrivacyReviewJs, /assertNotPrivacyReviewSelfTestPath/);
assert.match(externalSourcePrivacyReviewJs, /must not come from external-source privacy-review self-test artifacts/);
assert.match(externalSourcePrivacyReviewJs, /APPROVED_SOURCE_CANDIDATE/);
assert.match(externalSourcePrivacyReviewJs, /LOCAL_FIXTURE_SELF_TEST/);
assert.match(externalSourcePrivacyReviewJs, /PUBLIC_SOURCE_DRY_RUN/);
assert.match(externalSourcePrivacyReviewJs, /public source dry-run receipt rejected/);
assert.match(externalSourcePrivacyReviewJs, /privacy-review self-test receipt path rejected/);
assert.match(externalSourcePrivacyReviewJs, /privacy-review self-test review path rejected/);
assert.match(externalSourcePrivacyReviewJs, /missing source approval request binding rejected/);
assert.match(externalSourcePrivacyReviewJs, /stale source approval request binding rejected/);
assert.match(externalSourcePrivacyReviewJs, /mismatched source approval request reading URL rejected/);
assert.match(externalSourcePrivacyReviewJs, /mismatched source approval request video timestamp rejected/);
assert.match(externalSourcePrivacyReviewJs, /APPROVED_SOURCE_PRIVACY_REVIEWED/);
assert.match(externalSourcePrivacyReviewJs, /canClaimExternalKo: true/);
assert.match(externalSourcePrivacyReviewJs, /fixtureOnly: true/);
assert.match(externalSourcePrivacyReviewJs, /validatedClaimShapeInMemory/);
assert.doesNotMatch(externalSourcePrivacyReviewJs, /join\(root, "claim\.json"\)/);
assert.match(externalSourcePrivacyReviewJs, /noSecretsTokensSessionIds/);
assert.match(externalSourcePrivacyReviewJs, /runContextReviewed/);
assert.match(externalSourcePrivacyReviewJs, /appRevisionRecorded/);
assert.match(externalSourcePrivacyReviewJs, /assertGitHead/);
assert.match(externalSourcePrivacyReviewJs, /assertConcreteReviewText/);
assert.match(externalSourcePrivacyReviewJs, /assertIsoDateTime/);
assert.match(externalSourcePrivacyReviewJs, /PLACEHOLDER_REVIEW_TEXT/);
assert.match(externalSourcePrivacyReviewJs, /PLACEHOLDER_REVIEW_PREFIX_PATTERN/);
assert.match(externalSourcePrivacyReviewJs, /TRAILING_REVIEW_DECORATION_PATTERN/);
assert.match(externalSourcePrivacyReviewJs, /ISO date-time with timezone/);
assert.match(externalSourcePrivacyReviewJs, /concrete privacy-review notes/);
assert.match(externalSourcePrivacyReviewJs, /assertApprovedExternalUrl/);
assert.match(externalSourcePrivacyReviewJs, /isPrivateOrReservedIpv4/);
assert.match(externalSourcePrivacyReviewJs, /isSensitiveQueryKey/);
assert.match(externalSourcePrivacyReviewJs, /expandMappedIpv4/);
assert.match(externalSourcePrivacyReviewJs, /local or private source URL rejected/);
assert.match(externalSourcePrivacyReviewJs, /IPv4-mapped IPv6 local source URL rejected/);
assert.match(externalSourcePrivacyReviewJs, /sensitive source query key rejected/);
assert.match(externalSourcePrivacyReviewJs, /signed source query key rejected/);
assert.match(externalSourcePrivacyReviewJs, /X-Amz-Signature/);
assert.match(externalSourcePrivacyReviewJs, /throwaway-profile/);
assert.match(externalSourcePrivacyReviewJs, /profileRetained, false/);
assert.match(externalSourcePrivacyReviewJs, /profile cleanup must pass/);
assert.match(externalSourcePrivacyReviewJs, /retained-profile-receipt/);
assert.match(externalSourcePrivacyReviewJs, /failed-profile-cleanup-receipt/);
assert.match(externalSourcePrivacyReviewJs, /videoTimestampPass/);
assert.match(externalSourcePrivacyReviewJs, /videoLearningToolsPass/);
assert.match(externalSourcePrivacyReviewJs, /02b-video-learning-tools\.png/);
assert.match(externalSourcePrivacyReviewJs, /timestampNoteInserted/);
assert.match(externalSourcePrivacyReviewJs, /videoBookmarkSaved/);
assert.match(externalSourcePrivacyReviewJs, /playbackRatePersisted/);
assert.match(externalSourcePrivacyReviewJs, /placeholder reviewer rejected/);
assert.match(externalSourcePrivacyReviewJs, /relative reviewedAt timestamp rejected/);
assert.match(externalSourcePrivacyReviewJs, /placeholder approval reference rejected/);
assert.match(externalSourcePrivacyReviewJs, /placeholder review notes rejected/);
assert.match(externalSourcePrivacyReviewJs, /None of the screenshots contained private or sensitive content/);
assert.match(externalSourcePrivacyReviewJs, /No evidence of private account identity/);
assert.match(externalSourcePrivacyReviewJs, /local fixture self-tests cannot be privacy-reviewed into KO evidence/);
assert.match(koEvidenceReviewJs, /learning-companion\.ko-evidence-review\.v1/);
assert.match(koEvidenceReviewJs, /learning-companion\.ko-evidence-selftest\.v1/);
assert.match(koEvidenceReviewJs, /learning-companion\.external-source-ko-evidence-review\.v1/);
assert.match(koEvidenceReviewJs, /mode: 0o600/);
assert.match(koEvidenceReviewJs, /error\?\.code !== "ENOENT"/);
assert.match(koEvidenceReviewJs, /chmod\(path, 0o600\)/);
assert.match(koEvidenceReviewJs, /requires a file path/);
assert.match(koEvidenceReviewJs, /learning-companion\.mac-manual-qa-receipt\.v1/);
assert.match(koEvidenceReviewJs, /learning-companion\.windows-static-qa-receipt\.v1/);
assert.match(koEvidenceReviewJs, /learning-companion\.harmony-device-qa-receipt\.v1/);
assert.match(koEvidenceReviewJs, /DEFAULT_PLATFORM_RECEIPTS/);
assert.match(koEvidenceReviewJs, /real-run-receipt\.json/);
assert.match(koEvidenceReviewJs, /selectPlatformReceiptPath/);
assert.match(koEvidenceReviewJs, /todayLearningFlowZh/);
assert.match(koEvidenceReviewJs, /reviewToolbarZh/);
assert.match(koEvidenceReviewJs, /mainLoopCaptureZh/);
assert.match(koEvidenceReviewJs, /recentStackZh/);
assert.match(koEvidenceReviewJs, /searchResultsZh/);
assert.match(koEvidenceReviewJs, /activityHintZh/);
assert.match(koEvidenceReviewJs, /assertExternalRunContext/);
assert.match(koEvidenceReviewJs, /external claim runContext/);
assert.match(koEvidenceReviewJs, /external-source-run-context\.v1/);
assert.match(koEvidenceReviewJs, /source-approval-request-binding\.v1/);
assert.match(koEvidenceReviewJs, /function assertExternalSourceApprovalRequest/);
assert.match(koEvidenceReviewJs, /sourceApprovalRequest freshness must be CURRENT_CLEAN_PUBLIC_DRY_RUN/);
assert.match(koEvidenceReviewJs, /sourceApprovalRequest reading URL must match claim/);
assert.match(koEvidenceReviewJs, /sourceApprovalRequest video timestamp must match claim/);
assert.match(koEvidenceReviewJs, /assertApprovedExternalUrl/);
assert.match(koEvidenceReviewJs, /expandMappedIpv4/);
assert.match(koEvidenceReviewJs, /local or private external source URL rejected/);
assert.match(koEvidenceReviewJs, /IPv4-mapped IPv6 external source URL rejected/);
assert.match(koEvidenceReviewJs, /sensitive external source query key rejected/);
assert.match(koEvidenceReviewJs, /signed external source query key rejected/);
assert.match(koEvidenceReviewJs, /external stale git revision rejected/);
assert.match(koEvidenceReviewJs, /external dirty git revision rejected/);
assert.match(koEvidenceReviewJs, /missing external source approval request rejected/);
assert.match(koEvidenceReviewJs, /stale external source approval request rejected/);
assert.match(koEvidenceReviewJs, /mismatched external source approval request reading URL rejected/);
assert.match(koEvidenceReviewJs, /mismatched external source approval request video timestamp rejected/);
assert.match(koEvidenceReviewJs, /external claim gitHead .* does not match current HEAD/);
assert.match(koEvidenceReviewJs, /external claim must be captured from a clean git worktree/);
assert.match(koEvidenceReviewJs, /X-Goog-Signature/);
assert.match(koEvidenceReviewJs, /throwaway-profile/);
assert.match(koEvidenceReviewJs, /profileRetained, false/);
assert.match(koEvidenceReviewJs, /profile cleanup must pass/);
assert.match(koEvidenceReviewJs, /retained-profile-external/);
assert.match(koEvidenceReviewJs, /failed-profile-cleanup-external/);
assert.match(koEvidenceReviewJs, /KO_MISSING_EVIDENCE/);
assert.match(koEvidenceReviewJs, /KO_READY_EVIDENCE_REVIEW/);
assert.match(koEvidenceReviewJs, /Missing --external path/);
assert.match(koEvidenceReviewJs, /native Mac manual bilingual\/runtime QA/);
assert.match(koEvidenceReviewJs, /Windows static\/manual bilingual QA/);
assert.match(koEvidenceReviewJs, /HarmonyOS device\/toolchain bilingual QA/);
assert.match(koEvidenceReviewJs, /canClaimMacManualQaUsable/);
assert.match(koEvidenceReviewJs, /canClaimWindowsStaticLoopUsable/);
assert.match(koEvidenceReviewJs, /canClaimHarmonyDeviceRoundtripUsable/);
assert.match(koEvidenceReviewJs, /fixtureOnly, false/);
assert.match(koEvidenceReviewJs, /HUMAN_PRIVACY_REVIEW/);
assert.match(koEvidenceReviewJs, /external-source-privacy-review-selftest/);
assert.match(koEvidenceReviewJs, /ko-evidence-selftest/);
assert.match(koEvidenceReviewJs, /fixture-only external evidence rejected/);
assert.match(koEvidenceReviewJs, /pending platform evidence rejected/);
assert.match(koEvidenceReviewJs, /real-run platform receipt path selected before pending receipt path/);
assert.match(koEvidenceReviewJs, /platformRowEvidenceErrors/);
assert.match(koEvidenceReviewJs, /PLACEHOLDER_EVIDENCE_NOTES/);
assert.match(koEvidenceReviewJs, /LEADING_EVIDENCE_DECORATION_PATTERN/);
assert.match(koEvidenceReviewJs, /isPlaceholderEvidenceNote/);
assert.match(koEvidenceReviewJs, /isPlaceholderEvidenceText/);
assert.match(koEvidenceReviewJs, /without a concrete QA note or evidence reference/);
assert.match(koEvidenceReviewJs, /platform PASS rows without evidence notes rejected/);
assert.match(koEvidenceReviewJs, /platform PASS rows with placeholder evidence notes rejected/);
assert.match(koEvidenceReviewJs, /platform PASS rows with decorated placeholder evidence notes rejected/);
assert.match(koEvidenceReviewJs, /Windows platform PASS rows with numbered placeholder evidence notes rejected/);
assert.match(koEvidenceReviewJs, /Harmony platform PASS rows with blockquote placeholder evidence notes rejected/);
assert.match(koEvidenceReviewJs, /platform placeholder reviewer rejected/);
assert.match(koEvidenceReviewJs, /platform relative Date\/time rejected/);
assert.match(koEvidenceReviewJs, /platform summary\/row mismatch rejected/);
assert.match(koEvidenceReviewJs, /platform truncated row set rejected/);
assert.match(koEvidenceReviewJs, /platform receipt errors rejected/);
assert.match(koEvidenceReviewJs, /platform nonclaimable manual tier rejected/);
assert.match(koEvidenceReviewJs, /derivePlatformRowSummary/);
assert.match(koEvidenceReviewJs, /summary allRowsPass does not match rows/);
assert.match(koEvidenceReviewJs, /receipt rows length .* does not match expected rows/);
assert.match(koEvidenceReviewJs, /receipt errors must be empty before a platform claim/);
assert.match(koEvidenceReviewJs, /claim boundary must match derived platform evidence/);
assert.match(koEvidenceReviewJs, /platformClaimEvidenceErrors/);
assert.match(koEvidenceReviewJs, /PLATFORM_QA_HANDOFF_BINDING_SCHEMA/);
assert.match(koEvidenceReviewJs, /CURRENT_CLEAN_HEAD_PLATFORM_QA_HANDOFF/);
assert.match(koEvidenceReviewJs, /function platformHandoffBindingErrors/);
assert.match(koEvidenceReviewJs, /platformHandoffBinding schema mismatch/);
assert.match(koEvidenceReviewJs, /platformHandoffBinding freshness must be/);
assert.match(koEvidenceReviewJs, /platformHandoffBinding platformId must be/);
assert.match(koEvidenceReviewJs, /platformHandoffBinding handoff git HEAD must match receipt runContext/);
assert.match(koEvidenceReviewJs, /missing platform handoff binding rejected/);
assert.match(koEvidenceReviewJs, /stale platform handoff binding rejected/);
assert.match(koEvidenceReviewJs, /problem platform handoff binding rejected/);
assert.match(koEvidenceReviewJs, /mismatched platform handoff binding id rejected/);
assert.match(koEvidenceReviewJs, /mismatched platform handoff binding git rejected/);
assert.match(koEvidenceReviewJs, /MANUAL_PLATFORM_QA/);
assert.match(koEvidenceReviewJs, /PARTIAL_PLATFORM_QA/);
assert.match(koEvidenceReviewJs, /Date\/time must be an ISO date-time with timezone/);
assert.match(koEvidenceReviewJs, /Reviewer must be filled with concrete platform QA evidence/);
assert.match(finalizeNextMajorJs, /next_major_finalize_ok/);
assert.match(finalizeNextMajorJs, /next_major_finalize_dry_run/);
assert.match(finalizeNextMajorJs, /--external is required/);
assert.match(finalizeNextMajorJs, /macManual: "\.codex-tmp\/mac-manual-qa\/real-run-receipt\.json"/);
assert.match(finalizeNextMajorJs, /windowsStatic: "\.codex-tmp\/windows-static-qa\/real-run-receipt\.json"/);
assert.match(finalizeNextMajorJs, /harmonyDevice: "\.codex-tmp\/harmony-device-qa\/real-run-receipt\.json"/);
assert.match(finalizeNextMajorJs, /scripts\/validate-ko-evidence\.mjs/);
assert.match(finalizeNextMajorJs, /scripts\/next-major-readiness\.mjs/);
assert.match(finalizeNextMajorJs, /scripts\/platform-qa-handoff\.mjs/);
assert.match(finalizeNextMajorJs, /scripts\/next-major-operator-packet\.mjs/);
assert.match(finalizeNextMajorJs, /canClaimKo, true/);
assert.match(finalizeNextMajorJs, /releaseActionAuthorized, false/);
assert.match(finalizeNextMajorJs, /does not build, package, deploy/);
assert.match(finalizeNextMajorJs, /finalKo\.argv\.includes\("--allow-missing"\), false/);
assert.match(finalizeNextMajorJs, /SUBCOMMAND_TIMEOUT_MS = 120_000/);
assert.match(finalizeNextMajorJs, /assertReadableFile\(plan\.options\.external/);
assert.match(finalizeNextMajorJs, /assertReadableFile\(plan\.options\.sourceApprovalRequest/);
assert.match(finalizeNextMajorJs, /sourceApprovalMarkdown/);
assert.match(finalizeNextMajorJs, /function assertFinalizerOutputBindings/);
assert.match(finalizeNextMajorJs, /assertFinalizerOutputBindings\(plan, \{ readiness, operator \}\)/);
assert.match(finalizeNextMajorJs, /async function runFinalizePlan\(plan\)[\s\S]*assertFinalizerOutputBindings\(plan, \{ readiness, operator \}\)/);
assert.match(finalizeNextMajorJs, /operator\.inputs\?\.sourceApprovalRequestPath/);
assert.match(finalizeNextMajorJs, /operator\.inputs\?\.sourceApprovalMarkdownPath/);
assert.match(finalizeNextMajorJs, /operator\.inputs\?\.externalEvidencePath/);
assert.match(finalizeNextMajorJs, /operator\.inputs\?\.platformReceiptPaths\?\.macManual/);
assert.match(finalizeNextMajorJs, /assertCommandHasFlagPath\(readiness\.nextCommands\?\.finalizeNextMajor, "--external", options\.external/);
assert.match(finalizeNextMajorJs, /assertCommandHasFlagPath\(finalLane\.nextCommands\?\.finalizeNextMajor, "--external", options\.external/);
assert.match(finalizeNextMajorJs, /assertCommandHasFlagPath\(finalAction\.command, "--external", options\.external/);
assert.match(finalizeNextMajorJs, /assertCommandHasFlagPath\(finalAction\.command, "--mac-manual", options\.macManual/);
assert.match(finalizeNextMajorJs, /as a complete shell argument/);
assert.match(finalizeNextMajorJs, /function escapeRegExp/);
assert.ok(finalizeNextMajorJs.includes("new RegExp(`(?:^|\\\\s)${escapeRegExp(expected)}(?=$|\\\\s)`)"));
assert.match(finalizeNextMajorJs, /"--source-approval-request",\s*options\.sourceApprovalRequest/);
assert.match(finalizeNextMajorJs, /"--source-approval-markdown",\s*options\.sourceApprovalMarkdown/);
assert.match(finalizeNextMajorJs, /"--external",\s*options\.external/);
assert.match(finalizeNextMajorJs, /"--mac-manual",\s*options\.macManual/);
assert.match(finalizeNextMajorJs, /"--windows-static",\s*options\.windowsStatic/);
assert.match(finalizeNextMajorJs, /"--harmony-device",\s*options\.harmonyDevice/);
assert.match(finalizeNextMajorJs, /id: "refresh-operator-packet"[\s\S]*"--source-approval-markdown",\s*options\.sourceApprovalMarkdown/);
assert.match(finalizeNextMajorJs, /id: "refresh-operator-packet"[\s\S]*"--external",\s*options\.external/);
assert.match(finalizeNextMajorJs, /id: "refresh-operator-packet"[\s\S]*"--mac-manual",\s*options\.macManual/);
assert.match(finalizeNextMajorJs, /id: "refresh-operator-packet"[\s\S]*"--windows-static",\s*options\.windowsStatic/);
assert.match(finalizeNextMajorJs, /id: "refresh-operator-packet"[\s\S]*"--harmony-device",\s*options\.harmonyDevice/);
assert.match(finalizeNextMajorJs, /constants\.R_OK/);
assert.match(finalizeNextMajorJs, /Dry-run boundary: no file readability/);
assert.match(finalizeNextMajorJs, /Dry-run only prints the command plan/);
assert.doesNotMatch(finalizeNextMajorJs, /\bchmod\b/);
assert.match(refreshNextMajorLocalEvidenceJs, /next_major_local_evidence_refresh_ok/);
assert.match(refreshNextMajorLocalEvidenceJs, /refresh-bilingual-runtime/);
assert.match(refreshNextMajorLocalEvidenceJs, /refresh-controlled-loop/);
assert.match(refreshNextMajorLocalEvidenceJs, /refresh-public-source-dry-run/);
assert.match(refreshNextMajorLocalEvidenceJs, /refresh-ko-status/);
assert.match(refreshNextMajorLocalEvidenceJs, /refresh-readiness/);
assert.match(refreshNextMajorLocalEvidenceJs, /refresh-platform-qa-handoff/);
assert.match(refreshNextMajorLocalEvidenceJs, /scripts\/validate-ko-evidence\.mjs/);
assert.match(refreshNextMajorLocalEvidenceJs, /scripts\/next-major-readiness\.mjs/);
assert.match(refreshNextMajorLocalEvidenceJs, /"--source-approval-request",\s*options\.sourceApprovalRequest/);
assert.match(refreshNextMajorLocalEvidenceJs, /"--source-approval-markdown",\s*options\.sourceApprovalMarkdown/);
assert.match(refreshNextMajorLocalEvidenceJs, /scripts\/platform-qa-handoff\.mjs/);
assert.match(refreshNextMajorLocalEvidenceJs, /regenerate-source-approval-request/);
assert.match(refreshNextMajorLocalEvidenceJs, /refresh-operator-packet/);
assert.match(refreshNextMajorLocalEvidenceJs, /id: "refresh-operator-packet"[\s\S]*"--source-approval-request",\s*options\.sourceApprovalRequest/);
assert.match(refreshNextMajorLocalEvidenceJs, /id: "refresh-operator-packet"[\s\S]*"--source-approval-markdown",\s*options\.sourceApprovalMarkdown/);
assert.match(refreshNextMajorLocalEvidenceJs, /print-ko-next/);
assert.match(refreshNextMajorLocalEvidenceJs, /Readiness packet:/);
assert.match(refreshNextMajorLocalEvidenceJs, /Platform QA handoff:/);
assert.match(refreshNextMajorLocalEvidenceJs, /Does not run approved-source browser capture/);
assert.match(refreshNextMajorLocalEvidenceJs, /Does not perform human privacy review/);
assert.match(refreshNextMajorLocalEvidenceJs, /Does not run Mac, Windows, or HarmonyOS real platform QA/);
assert.doesNotMatch(refreshNextMajorLocalEvidenceJs, /"--approved-current-turn"/);
assert.match(koNextActionSummaryJs, /npm run next:local-evidence/);
[macManualQaValidatorJs, windowsStaticQaValidatorJs, harmonyDeviceQaValidatorJs].forEach((validatorJs) => {
  assert.match(validatorJs, /PLACEHOLDER_EVIDENCE_NOTES/);
  assert.match(validatorJs, /LEADING_EVIDENCE_DECORATION_PATTERN/);
  assert.match(validatorJs, /ISO_DATE_TIME_PATTERN/);
  assert.match(validatorJs, /hasConcreteQaText/);
  assert.match(validatorJs, /MANUAL_PLATFORM_QA/);
  assert.match(validatorJs, /PARTIAL_PLATFORM_QA/);
  assert.match(validatorJs, /must be an ISO date-time with timezone/);
  assert.match(validatorJs, /is empty, TBD, or placeholder/);
  assert.match(validatorJs, /isPlaceholderEvidenceNote/);
  assert.match(validatorJs, /isPlaceholderEvidenceText/);
  assert.match(validatorJs, /row\.result !== "NT"/);
  assert.match(validatorJs, /from "\.\/lib\/platform-qa-areas\.mjs"/);
  assert.match(validatorJs, /row \${rowNumber} area must be/);
  assert.match(validatorJs, /without a concrete QA note or evidence reference/);
  assert.match(validatorJs, /readPlatformHandoffBinding/);
  assert.match(validatorJs, /--platform-handoff/);
  assert.match(validatorJs, /platformHandoffBinding/);
  assert.match(validatorJs, /requiresCurrentPlatformHandoff: true/);
  assert.match(validatorJs, /has filled rows but --platform-handoff is required/);
  assert.match(validatorJs, /mode: 0o700/);
  assert.match(validatorJs, /mode: 0o600/);
  assert.match(validatorJs, /error\?\.code !== "ENOENT"/);
  assert.match(validatorJs, /chmod\(options\.outPath, 0o600\)/);
  assert.match(validatorJs, /--out requires a receipt JSON path/);
  assert.match(validatorJs, /--qa requires a Markdown path/);
});
assert.match(morningDemoBuilderJs, /For every non-`NT` row, fill Notes with the concrete evidence reference/);
assert.match(morningDemoBuilderJs, /每个非 `NT` 行都必须在 Notes 写入具体证据引用/);
assert.match(morningDemoBuilderJs, /Date\/time must be an ISO date-time with timezone/);
assert.match(morningDemoBuilderJs, /Date\/time 必须是带时区的 ISO 时间/);
assert.match(morningDemoBuilderJs, /Filled but non-claimable rows validate as partial platform QA/);
assert.match(morningDemoBuilderJs, /不可声明的行只算 partial platform QA/);
assert.match(morningDemoBuilderJs, /Every `PASS`, `FAIL`, or `BLOCKED` row must include a concrete Notes evidence reference/);
assert.match(morningDemoBuilderJs, /npm run mac:manual:validate:real/);
assert.match(morningDemoBuilderJs, /npm run windows:static:validate:real/);
assert.match(morningDemoBuilderJs, /npm run harmony:device:validate:real/);
assert.doesNotMatch(morningDemoBuilderJs, /npm run mac:manual:validate(?!:(?:smoke|real))/);
assert.doesNotMatch(morningDemoBuilderJs, /npm run windows:static:validate(?!:(?:smoke|real))/);
assert.doesNotMatch(morningDemoBuilderJs, /npm run harmony:device:validate(?!:(?:smoke|real))/);
[nextAgentPromptMd, promotionGatesMd, macManualQaMd, thirdPartyContinuationPromptMd, userFlowAuditMd].forEach((markdown) => {
  assert.doesNotMatch(markdown, /npm run mac:manual:validate(?!:(?:smoke|real))/);
  assert.doesNotMatch(markdown, /npm run windows:static:validate(?!:(?:smoke|real))/);
  assert.doesNotMatch(markdown, /npm run harmony:device:validate(?!:(?:smoke|real))/);
});
assert.match(koNextActionSummaryJs, /Learning Companion KO next actions/);
assert.match(koNextActionSummaryJs, /execFileAsync\(process\.execPath/);
assert.match(koNextActionSummaryJs, /--refresh/);
assert.match(koNextActionSummaryJs, /source-approval-request/);
assert.match(koNextActionSummaryJs, /operator/);
assert.match(koNextActionSummaryJs, /requires a file path/);
assert.match(koNextActionSummaryJs, /Failed to refresh KO status/);
assert.match(koNextActionSummaryJs, /learning-companion\.external-source-approval-request\.v1/);
assert.match(koNextActionSummaryJs, /SOURCE_APPROVAL_REQUEST_ONLY/);
assert.match(koNextActionSummaryJs, /Ignored invalid default source approval request/);
assert.match(koNextActionSummaryJs, /learning-companion\.next-major-operator-packet\.v1/);
assert.match(koNextActionSummaryJs, /NEXT_MAJOR_OPERATOR_PACKET_ONLY/);
assert.match(koNextActionSummaryJs, /CURRENT_CLEAN_OPERATOR_PACKET/);
assert.match(koNextActionSummaryJs, /STALE_OR_DIRTY_OPERATOR_PACKET/);
assert.match(koNextActionSummaryJs, /CURRENT_CLEAN_PLATFORM_QA_HANDOFF/);
assert.match(koNextActionSummaryJs, /assessOperatorPacketFreshness/);
assert.match(koNextActionSummaryJs, /formatOperatorPlatformHandoffFreshness/);
assert.match(koNextActionSummaryJs, /Ignored invalid default operator packet/);
assert.match(koNextActionSummaryJs, /Operator packet missing nextActionSequence/);
assert.match(koNextActionSummaryJs, /Operator critical path/);
assert.match(koNextActionSummaryJs, /Current operator packet freshness/);
assert.match(koNextActionSummaryJs, /Operator platform handoff freshness/);
assert.match(koNextActionSummaryJs, /Refresh operator packet command/);
assert.match(koNextActionSummaryJs, /Refresh platform handoff command/);
assert.match(koNextActionSummaryJs, /Refresh prerequisite/);
assert.match(koNextActionSummaryJs, /do not discard changes unless explicitly asked/);
assert.doesNotMatch(koNextActionSummaryJs, /after committing or stashing local changes/);
assert.match(koNextActionSummaryJs, /This operator packet still does not grant approval/);
assert.match(koNextActionSummaryJs, /Source approval request missing required/);
assert.match(koNextActionSummaryJs, /approved candidate command still contains placeholder tokens/);
assert.match(koNextActionSummaryJs, /readCurrentRevision/);
assert.match(koNextActionSummaryJs, /source-approval-freshness\.mjs/);
assert.match(koNextActionSummaryJs, /assessSourceApprovalFreshness/);
assert.match(koNextActionSummaryJs, /buildApprovedCandidateCommand/);
assert.match(koNextActionSummaryJs, /buildFreshSourceCommands/);
assert.match(koNextActionSummaryJs, /STALE_OR_DIRTY_PUBLIC_DRY_RUN/);
assert.match(koNextActionSummaryJs, /Current approval request/);
assert.match(koNextActionSummaryJs, /Current approval request freshness/);
assert.match(koNextActionSummaryJs, /Freshness problem/);
assert.match(koNextActionSummaryJs, /Do not run the prior approved candidate command/);
assert.match(koNextActionSummaryJs, /Refresh public dry-run command/);
assert.match(koNextActionSummaryJs, /Approval text to copy exactly/);
assert.match(koNextActionSummaryJs, /Approved candidate command after exact current-turn approval/);
assert.match(koNextActionSummaryJs, /still does not grant source approval/);
assert.match(koNextActionSummaryJs, /To replace these sources/);
assert.match(koNextActionSummaryJs, /URL here means a public learning-material link/);
assert.match(koNextActionSummaryJs, /URL 就是网页链接/);
assert.match(koNextActionSummaryJs, /阅读：https:\/\/\.\.\. \/ 视频：https:\/\/\.\.\. \/ 时间：00:15/);
assert.match(koNextActionSummaryJs, /npm run external:source-help/);
assert.match(koNextActionSummaryJs, /npm run external:source-intake/);
assert.match(koNextActionSummaryJs, /npm run external:approval-request/);
assert.match(koNextActionSummaryJs, /npm run external:validate -- --approved-current-turn/);
assert.match(koNextActionSummaryJs, /--out \$\{shellQuote\(path\)\}/);
assert.match(koNextActionSummaryJs, /--markdown-out \$\{shellQuote\(markdownPath\)\}/);
assert.match(koNextActionSummaryJs, /--source-approval-request \$\{shellQuote\(path\)\}/);
assert.match(koNextActionSummaryJs, /function formatFinalGateCommands/);
assert.match(koNextActionSummaryJs, /function buildPlatformReceiptArgs/);
assert.match(koNextActionSummaryJs, /cliExternalPath/);
assert.match(koNextActionSummaryJs, /sourceApprovalMarkdownPath/);
assert.match(koNextActionSummaryJs, /DEFAULT_SOURCE_APPROVAL_MARKDOWN_PATH/);
assert.match(koNextActionSummaryJs, /"source-approval-markdown"/);
assert.match(koNextActionSummaryJs, /externalEvidencePath/);
assert.match(koNextActionSummaryJs, /externalEvidencePath \? shellQuote\(externalEvidencePath\) : "<ko-evidence-review\.json>"/);
assert.match(koNextActionSummaryJs, /--source-approval-request \$\{shellQuote\(sourceApprovalRequestPath\)\}/);
assert.match(koNextActionSummaryJs, /--source-approval-markdown \$\{shellQuote\(sourceApprovalMarkdownPath\)\}/);
assert.match(koNextActionSummaryJs, /--mac-manual \$\{shellQuote\(macManual\)\}/);
assert.match(koNextActionSummaryJs, /--windows-static \$\{shellQuote\(windowsStatic\)\}/);
assert.match(koNextActionSummaryJs, /--harmony-device \$\{shellQuote\(harmonyDevice\)\}/);
assert.match(koNextActionSummaryJs, /function shellQuote/);
assert.match(koNextActionSummaryJs, /npm run platform:qa-handoff -- --out \.codex-tmp\/platform-qa-handoff\/current\.json --markdown-out \.codex-tmp\/platform-qa-handoff\/current\.md/);
assert.match(koNextActionSummaryJs, /Real-run platform receipts are auto-selected by ko:next\/ko:validate when present/);
assert.match(koNextActionSummaryJs, /npm run mac:manual:validate:real/);
assert.match(koNextActionSummaryJs, /npm run windows:static:validate:real/);
assert.match(koNextActionSummaryJs, /npm run harmony:device:validate:real/);
assert.match(koNextActionSummaryJs, /DEFAULT_MAC_MANUAL_PATH/);
assert.match(koNextActionSummaryJs, /DEFAULT_WINDOWS_STATIC_PATH/);
assert.match(koNextActionSummaryJs, /DEFAULT_HARMONY_DEVICE_PATH/);
assert.match(koNextActionSummaryJs, /npm run next:readiness -- --refresh --out \.codex-tmp\/next-major-readiness\/current\.json --markdown-out \.codex-tmp\/next-major-readiness\/current\.md/);
assert.match(koNextActionSummaryJs, /npm run next:operator -- --refresh --out \.codex-tmp\/next-major-operator\/current\.json --markdown-out \.codex-tmp\/next-major-operator\/current\.md/);
assert.match(koNextActionSummaryJs, /Self-test and public dry-run evidence/);
assert.match(nextMajorReadinessJs, /learning-companion\.next-major-readiness\.v1/);
assert.match(nextMajorReadinessJs, /learning-companion\.ko-evidence-review\.v1/);
assert.match(nextMajorReadinessJs, /NEXT_MAJOR_READINESS_SUMMARY_ONLY/);
assert.match(nextMajorReadinessJs, /REQUIRED_REQUIREMENT_IDS/);
assert.match(nextMajorReadinessJs, /READINESS_PACKET_NOT_EXECUTED/);
assert.match(nextMajorReadinessJs, /function assertRequiredRequirements/);
assert.match(nextMajorReadinessJs, /KO status is missing required requirements/);
assert.match(nextMajorReadinessJs, /assessKoStatusFreshness/);
assert.match(nextMajorReadinessJs, /koStatusFreshness/);
assert.match(nextMajorReadinessJs, /KO status must be regenerated from the current clean git HEAD/);
assert.match(nextMajorReadinessJs, /canClaimNextMajorPreReleaseReady/);
assert.match(nextMajorReadinessJs, /releaseActionAuthorized: false/);
assert.match(nextMajorReadinessJs, /blockedOrNotExecuted: READINESS_PACKET_NOT_EXECUTED/);
assert.doesNotMatch(nextMajorReadinessJs, /blockedOrNotExecuted: ready \? \[\]/);
assert.match(nextMajorReadinessJs, /NOT_READY_MISSING_EVIDENCE/);
assert.match(nextMajorReadinessJs, /Readiness summary only/);
assert.match(nextMajorReadinessJs, /does not authorize release/);
assert.match(nextMajorReadinessJs, /No new approved external reading\/video candidate was run by this readiness packet/);
assert.match(nextMajorReadinessJs, /No build, package, deployment, Mew-Test, main-site, or remote acceptance check was run by this readiness packet/);
assert.match(nextMajorReadinessJs, /scripts\/validate-ko-evidence\.mjs/);
assert.match(nextMajorReadinessJs, /--allow-missing/);
assert.match(nextMajorReadinessJs, /SOURCE_APPROVAL_REQUEST_PATH/);
assert.match(nextMajorReadinessJs, /SOURCE_APPROVAL_MARKDOWN_PATH/);
assert.match(nextMajorReadinessJs, /DEFAULT_MAC_MANUAL_PATH/);
assert.match(nextMajorReadinessJs, /DEFAULT_WINDOWS_STATIC_PATH/);
assert.match(nextMajorReadinessJs, /DEFAULT_HARMONY_DEVICE_PATH/);
assert.match(nextMajorReadinessJs, /sourceApprovalRequestPath/);
assert.match(nextMajorReadinessJs, /sourceApprovalMarkdownPath/);
assert.match(nextMajorReadinessJs, /externalEvidencePath/);
assert.match(nextMajorReadinessJs, /platformReceiptPaths/);
assert.match(nextMajorReadinessJs, /--source-approval-request", shellQuote\(sourceApprovalRequestPath\)/);
assert.match(nextMajorReadinessJs, /--source-approval-markdown", shellQuote\(sourceApprovalMarkdownPath\)/);
assert.match(nextMajorReadinessJs, /parts\.push\("--external", shellQuote\(externalEvidencePath\)\)/);
assert.match(nextMajorReadinessJs, /function buildFinalizeNextMajorCommand/);
assert.match(nextMajorReadinessJs, /function buildFinalKoGateCommand/);
assert.match(nextMajorReadinessJs, /formatExternalEvidenceArg\(externalEvidencePath\)/);
assert.match(nextMajorReadinessJs, /--mac-manual/);
assert.match(nextMajorReadinessJs, /--windows-static/);
assert.match(nextMajorReadinessJs, /--harmony-device/);
assert.match(nextMajorReadinessJs, /function buildNextMajorReadinessMarkdown/);
assert.match(nextMajorReadinessJs, /Next Major Readiness Packet/);
assert.match(nextMajorReadinessJs, /function writePrivateFile/);
assert.match(nextMajorReadinessJs, /chmod\(path, 0o600\)/);
assert.match(nextMajorReadinessJs, /"external"/);
assert.match(nextMajorReadinessJs, /"mac-manual"/);
assert.match(nextMajorReadinessJs, /"windows-static"/);
assert.match(nextMajorReadinessJs, /"harmony-device"/);
assert.match(nextMajorReadinessJs, /requires a file path/);
const readinessSmokeDir = mkdtempSync(join(tempBase, "next-major-readiness-"));
try {
  const readinessRepo = join(readinessSmokeDir, "repo");
  mkdirSync(readinessRepo, { recursive: true, mode: 0o700 });
  writeFileSync(join(readinessRepo, "README.md"), "readiness smoke fixture\n");
  execFileSync("git", ["init"], { cwd: readinessRepo, stdio: "ignore" });
  execFileSync("git", ["add", "."], { cwd: readinessRepo, stdio: "ignore" });
  execFileSync("git", [
    "-c",
    "user.name=Learning Companion Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "-m",
    "initial readiness smoke fixture"
  ], { cwd: readinessRepo, stdio: "ignore" });
  const readinessHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: readinessRepo, encoding: "utf8" }).trim();
  const claimableStatusPath = join(readinessSmokeDir, "claimable-ko-status.json");
  const readinessJsonPath = join(readinessSmokeDir, "readiness.json");
  const readinessMarkdownPath = join(readinessSmokeDir, "readiness.md");
  writeFileSync(claimableStatusPath, `${JSON.stringify({
    schema: "learning-companion.ko-evidence-review.v1",
    evidenceTier: "KO_READY_EVIDENCE_REVIEW",
    canClaimKo: true,
    currentRevision: {
      gitAvailable: true,
      gitHead: readinessHead,
      dirtyWorktree: false,
      statusLineCount: 0,
      statusSummary: "",
      statusTruncated: false
    },
    requirements: [
      { id: "bilingualRuntime", status: "PASS", evidencePath: ".codex-tmp/example/bilingual.json", detail: "fixture pass" },
      { id: "controlledLearningLoop", status: "PASS", evidencePath: ".codex-tmp/example/loop.json", detail: "fixture pass" },
      { id: "nativeMacManualQa", status: "PASS", evidencePath: ".codex-tmp/example/mac.json", detail: "fixture pass" },
      { id: "windowsStaticManualQa", status: "PASS", evidencePath: ".codex-tmp/example/windows.json", detail: "fixture pass" },
      { id: "harmonyDeviceQa", status: "PASS", evidencePath: ".codex-tmp/example/harmony.json", detail: "fixture pass" },
      { id: "approvedExternalReadingVideo", status: "PASS", evidencePath: ".codex-tmp/example/external.json", detail: "fixture pass" }
    ],
    platformQaStatus: []
  }, null, 2)}\n`);
  const readinessConsole = execFileSync(process.execPath, [
    resolve("scripts/next-major-readiness.mjs"),
    "--status",
    claimableStatusPath,
    "--out",
    readinessJsonPath,
    "--markdown-out",
    readinessMarkdownPath
  ], { cwd: readinessRepo, encoding: "utf8" });
  const readinessFixture = JSON.parse(readFileSync(readinessJsonPath, "utf8"));
  const readinessMarkdown = readFileSync(readinessMarkdownPath, "utf8");
  assert.equal(readinessFixture.canClaimNextMajorPreReleaseReady, true);
  assert.equal(readinessFixture.koStatusFreshness.status, "CURRENT_CLEAN_HEAD_KO_STATUS");
  assert.equal(readinessFixture.releaseActionAuthorized, false);
  assert.equal(readinessFixture.readinessStatus, "PRE_RELEASE_EVIDENCE_READY");
  assert.equal(readinessFixture.blockingRequirements.length, 0);
  assert.equal(readinessFixture.blockedOrNotExecuted.length, 6);
  assert.equal(readinessFixture.blockedOrNotExecuted.includes("No build, package, deployment, Mew-Test, main-site, or remote acceptance check was run by this readiness packet."), true);
  assert.match(readinessConsole, /Can claim next-major pre-release ready: YES/);
  assert.match(readinessConsole, /KO status freshness: CURRENT_CLEAN_HEAD_KO_STATUS/);
  assert.match(readinessConsole, /does not authorize release/);
  assert.match(readinessMarkdown, /Release action authorized: false/);
  assert.match(readinessMarkdown, /KO status freshness: CURRENT\\_CLEAN\\_HEAD\\_KO\\_STATUS/);
  assert.match(readinessMarkdown, /No build, package, deployment, Mew-Test, main-site, or remote acceptance check was run by this readiness packet/);
  const staleStatusPath = join(readinessSmokeDir, "stale-ko-status.json");
  const staleReadinessJsonPath = join(readinessSmokeDir, "stale-readiness.json");
  writeFileSync(staleStatusPath, `${JSON.stringify({
    ...readinessFixture.sourceKoStatus,
    schema: "learning-companion.ko-evidence-review.v1",
    evidenceTier: "KO_READY_EVIDENCE_REVIEW",
    canClaimKo: true,
    currentRevision: {
      gitAvailable: true,
      gitHead: "0000000000000000000000000000000000000000",
      dirtyWorktree: false,
      statusLineCount: 0,
      statusSummary: "",
      statusTruncated: false
    },
    requirements: readinessFixture.requirements,
    platformQaStatus: []
  }, null, 2)}\n`);
  execFileSync(process.execPath, [
    resolve("scripts/next-major-readiness.mjs"),
    "--status",
    staleStatusPath,
    "--out",
    staleReadinessJsonPath
  ], { cwd: readinessRepo, encoding: "utf8" });
  const staleReadinessFixture = JSON.parse(readFileSync(staleReadinessJsonPath, "utf8"));
  assert.equal(staleReadinessFixture.koStatusFreshness.status, "STALE_OR_DIRTY_KO_STATUS");
  assert.equal(staleReadinessFixture.canClaimNextMajorPreReleaseReady, false);
  assert.equal(staleReadinessFixture.blockingRequirements.some((item) => item.id === "koStatusFreshness"), true);
  assert.equal(statSync(readinessJsonPath).mode & 0o777, 0o600);
  assert.equal(statSync(readinessMarkdownPath).mode & 0o777, 0o600);
} finally {
  if (cleanupSmokeArtifacts) rmSync(readinessSmokeDir, { recursive: true, force: true });
}
assert.match(nextMajorOperatorPacketJs, /learning-companion\.next-major-operator-packet\.v1/);
assert.match(nextMajorOperatorPacketJs, /NEXT_MAJOR_OPERATOR_PACKET_ONLY/);
assert.match(nextMajorOperatorPacketJs, /canClaimNextMajorFromThisPacket: false/);
assert.match(nextMajorOperatorPacketJs, /releaseActionAuthorized: false/);
assert.match(nextMajorOperatorPacketJs, /sourceApprovalRequestAvailable/);
assert.match(nextMajorOperatorPacketJs, /NEEDS_CURRENT_TURN_APPROVAL/);
assert.match(nextMajorOperatorPacketJs, /NEEDS_FRESH_PUBLIC_DRY_RUN_OR_APPROVAL_REQUEST/);
assert.match(nextMajorOperatorPacketJs, /NEEDS_FRESH_PLATFORM_QA_HANDOFF/);
assert.match(nextMajorOperatorPacketJs, /NEEDS_REAL_PLATFORM_RUN/);
assert.match(nextMajorOperatorPacketJs, /BLOCKED_UNTIL_ALL_EVIDENCE_PASSES/);
assert.match(nextMajorOperatorPacketJs, /source-approval-freshness\.mjs/);
assert.match(nextMajorOperatorPacketJs, /assessSourceApprovalFreshness/);
assert.match(nextMajorOperatorPacketJs, /STALE_OR_DIRTY_PUBLIC_DRY_RUN/);
assert.match(nextMajorOperatorPacketJs, /buildApprovedCandidateCommand/);
assert.match(nextMajorOperatorPacketJs, /buildFreshSourceCommands/);
assert.match(nextMajorOperatorPacketJs, /--out \$\{shellQuote\(sourceApprovalRequestPath\)\}/);
assert.match(nextMajorOperatorPacketJs, /--markdown-out \$\{shellQuote\(markdownSiblingPath\(sourceApprovalRequestPath\)\)\}/);
assert.match(nextMajorOperatorPacketJs, /--source-approval-request \$\{shellQuote\(sourceApprovalRequestPath\)\}/);
assert.match(nextMajorOperatorPacketJs, /produces: lane\.approvalRequest\?\.path \|\| SOURCE_APPROVAL_REQUEST_PATH/);
assert.match(nextMajorOperatorPacketJs, /function shellQuote/);
assert.match(nextMajorOperatorPacketJs, /CURRENT_CLEAN_PLATFORM_QA_HANDOFF/);
assert.match(nextMajorOperatorPacketJs, /STALE_OR_DIRTY_PLATFORM_QA_HANDOFF/);
assert.match(nextMajorOperatorPacketJs, /assessPlatformHandoffFreshness/);
assert.doesNotMatch(nextMajorOperatorPacketJs, /after committing or stashing local changes/);
assert.match(nextMajorOperatorPacketJs, /nextActionSequence/);
assert.match(nextMajorOperatorPacketJs, /buildNextActionSequence/);
assert.match(nextMajorOperatorPacketJs, /appendSourceNextActions/);
assert.match(nextMajorOperatorPacketJs, /Critical Path/);
assert.match(nextMajorOperatorPacketJs, /get-current-turn-source-approval/);
assert.match(nextMajorOperatorPacketJs, /Exact approval text to request/);
assert.match(nextMajorOperatorPacketJs, /Exact approval text to copy/);
assert.match(nextMajorOperatorPacketJs, /run-approved-external-source-candidate/);
assert.match(nextMajorOperatorPacketJs, /validate-final-ko/);
assert.match(nextMajorOperatorPacketJs, /Platform handoff freshness/);
assert.match(nextMajorOperatorPacketJs, /refreshPlatformHandoff/);
assert.match(nextMajorOperatorPacketJs, /No current-turn source approval was granted by this operator packet/);
assert.match(nextMajorOperatorPacketJs, /No approved-source browser capture or screenshot validation was run by this operator packet/);
assert.match(nextMajorOperatorPacketJs, /No Mac, Windows, or HarmonyOS real platform QA was run by this operator packet/);
assert.match(nextMajorOperatorPacketJs, /No build, package, deployment, Mew-Test, main-site, or remote acceptance check was run by this operator packet/);
assert.match(nextMajorOperatorPacketJs, /assertLiteral\(readiness\.evidenceTier, "NEXT_MAJOR_READINESS_SUMMARY_ONLY"/);
assert.match(nextMajorOperatorPacketJs, /assertLiteral\(readiness\.releaseActionAuthorized, false/);
assert.match(nextMajorOperatorPacketJs, /assertLiteral\(platformHandoff\.evidenceTier, "PLATFORM_QA_HANDOFF_ONLY"/);
assert.match(nextMajorOperatorPacketJs, /assertLiteral\(platformHandoff\.canClaimKo, false/);
assert.match(nextMajorOperatorPacketJs, /assertLiteral\(sourceApprovalRequest\.evidenceTier, "SOURCE_APPROVAL_REQUEST_ONLY"/);
assert.match(nextMajorOperatorPacketJs, /assertLiteral\(sourceApprovalRequest\.canClaimExternalKo, false/);
assert.match(nextMajorOperatorPacketJs, /readiness\.nextCommands\?\.finalizeNextMajor/);
assert.match(nextMajorOperatorPacketJs, /readiness\.nextCommands\?\.finalKoGate/);
assert.match(nextMajorOperatorPacketJs, /readiness\.nextCommands\?\.finalKoGateWithExplicitPlatformReceipts/);
assert.match(nextMajorOperatorPacketJs, /SOURCE_APPROVAL_MARKDOWN_PATH/);
assert.match(nextMajorOperatorPacketJs, /DEFAULT_MAC_MANUAL_PATH/);
assert.match(nextMajorOperatorPacketJs, /sourceApprovalMarkdownPath/);
assert.match(nextMajorOperatorPacketJs, /externalEvidencePath/);
assert.match(nextMajorOperatorPacketJs, /platformReceiptPaths/);
assert.match(nextMajorOperatorPacketJs, /readinessArgv\.push\("--external", externalEvidencePath\)/);
assert.match(nextMajorOperatorPacketJs, /function buildBoundFinalGateCommands/);
assert.match(nextMajorOperatorPacketJs, /!hasSourceOverride && !hasExternalOverride && !hasPlatformOverride/);
assert.match(nextMajorOperatorPacketJs, /function appendSourceApprovalArgs/);
assert.match(nextMajorOperatorPacketJs, /appendSourceApprovalArgs\(/);
assert.match(nextMajorOperatorPacketJs, /function replaceOrAppendFlagPath/);
assert.ok(nextMajorOperatorPacketJs.includes('|"(?:\\\\\\\\.|[^"])*"|\\\\S+)'));
assert.match(nextMajorOperatorPacketJs, /function escapeRegExp/);
assert.match(nextMajorOperatorPacketJs, /function buildCustomPlatformReceiptArgv/);
assert.match(nextMajorOperatorPacketJs, /function buildCustomPlatformReceiptCommandArgs/);
assert.match(nextMajorOperatorPacketJs, /function buildOperatorMarkdown/);
assert.match(nextMajorOperatorPacketJs, /Next Major Operator Packet/);
assert.match(nextMajorOperatorPacketJs, /executionChecklist/);
assert.match(nextMajorOperatorPacketJs, /Not accepted as evidence/);
assert.match(nextMajorOperatorPacketJs, /function writePrivateFile/);
assert.match(nextMajorOperatorPacketJs, /chmod\(path, 0o600\)/);
assert.match(nextMajorOperatorPacketJs, /"source-approval-markdown"/);
assert.match(nextMajorOperatorPacketJs, /"external"/);
assert.match(nextMajorOperatorPacketJs, /"mac-manual"/);
assert.match(nextMajorOperatorPacketJs, /"windows-static"/);
assert.match(nextMajorOperatorPacketJs, /"harmony-device"/);
const operatorSmokeDir = mkdtempSync(join(tempBase, "next-major-operator-"));
try {
  const statusPath = join(operatorSmokeDir, "ko-status.json");
  const readinessPath = join(operatorSmokeDir, "readiness.json");
  const platformPath = join(operatorSmokeDir, "platform.json");
  const approvalPath = join(operatorSmokeDir, "approval.json");
  const operatorJsonPath = join(operatorSmokeDir, "operator.json");
  const operatorMarkdownPath = join(operatorSmokeDir, "operator.md");
  const staleOperatorJsonPath = join(operatorSmokeDir, "stale-operator.json");
  const cleanPlatformOperatorJsonPath = join(operatorSmokeDir, "clean-platform-operator.json");
  writeFileSync(statusPath, `${JSON.stringify({
    schema: "learning-companion.ko-evidence-review.v1",
    evidenceTier: "KO_MISSING_EVIDENCE",
    canClaimKo: false,
    requirements: [
      { id: "approvedExternalReadingVideo", status: "MISSING", detail: "fixture missing", evidencePath: "" },
      { id: "nativeMacManualQa", status: "FAIL", detail: "fixture pending", evidencePath: "" }
    ]
  }, null, 2)}\n`);
  writeFileSync(readinessPath, `${JSON.stringify({
    schema: "learning-companion.next-major-readiness.v1",
    evidenceTier: "NEXT_MAJOR_READINESS_SUMMARY_ONLY",
    canClaimNextMajorPreReleaseReady: false,
    releaseActionAuthorized: false,
    readinessStatus: "NOT_READY_MISSING_EVIDENCE"
  }, null, 2)}\n`);
  writeFileSync(platformPath, `${JSON.stringify({
    schema: "learning-companion.platform-qa-handoff.v1",
    evidenceTier: "PLATFORM_QA_HANDOFF_ONLY",
    canClaimKo: false,
    nextCommands: {
      finalizeNextMajor: "npm run next:finalize -- --external <ko-evidence-review.json>",
      finalKoGate: "npm run ko:validate -- --external <ko-evidence-review.json> --out .codex-tmp/ko-evidence/final.json",
      finalKoGateWithExplicitPlatformReceipts: "npm run ko:validate -- --external <ko-evidence-review.json> --mac-manual .codex-tmp/mac-manual-qa/real-run-receipt.json --windows-static .codex-tmp/windows-static-qa/real-run-receipt.json --harmony-device .codex-tmp/harmony-device-qa/real-run-receipt.json --out .codex-tmp/ko-evidence/final.json"
    },
    platforms: [
      {
        id: "nativeMacManualQa",
        label: "Native Mac manual QA",
        currentKoStatus: { status: "PENDING_NOT_RUN", detail: "fixture pending", evidencePath: "" },
        qaPath: "dist/morning-demo/MAC_MANUAL_QA.md",
        receiptPath: ".codex-tmp/mac-manual-qa/real-run-receipt.json",
        validateCommand: "npm run mac:manual:validate:real",
        expectedRows: 27,
        currentTemplateSummary: {
          rows: 27,
          pass: 0,
          fail: 0,
          blocked: 0,
          nt: 27,
          invalid: 0,
          rowsNeedingConcreteNotes: 0,
          requiredSessionFields: [{ field: "Reviewer", filled: false }]
        },
        nextRealRunSteps: ["Fill the real Mac QA template."],
        cannotBeFilledFrom: ["fixture receipts"]
      }
    ]
  }, null, 2)}\n`);
  writeFileSync(approvalPath, `${JSON.stringify({
    schema: "learning-companion.external-source-approval-request.v1",
    evidenceTier: "SOURCE_APPROVAL_REQUEST_ONLY",
    canClaimExternalKo: false,
    basis: {
      type: "PUBLIC_SOURCE_DRY_RUN_RECEIPT",
      priorDryRunReceipt: ".codex-tmp/external-source-validation/old-public-dry-run/receipt.json",
      priorDryRun: {
        gitHead: "0000000000000000000000000000000000000000",
        dirtyWorktree: true,
        profileCleanupOk: true,
        profileRetained: false
      }
    },
    sources: {
      reading: { url: "https://example.com/reading", title: "Fixture reading" },
      video: { url: "https://example.com/video.mp4", title: "Fixture video", timestamp: "00:03" }
    },
    requestedApprovalText: "Fixture approval text.",
    nextCommands: {
      approvedCandidateAfterCurrentTurnApproval: "npm run external:validate -- --approved-current-turn --reading-url https://example.com/reading --video-url https://example.com/video.mp4 --video-timestamp 00:03 --approval-note 'Fixture approval text.'",
      privacyTemplate: "npm run external:privacy-template -- --receipt <candidate-receipt.json> --out <privacy-review.json>",
      privacyReview: "npm run external:privacy-review -- --receipt <candidate-receipt.json> --review <privacy-review.json> --out <ko-evidence-review.json>"
    }
  }, null, 2)}\n`);
  const operatorConsole = execFileSync(process.execPath, [
    "scripts/next-major-operator-packet.mjs",
    "--status",
    statusPath,
    "--readiness",
    readinessPath,
    "--platform-handoff",
    platformPath,
    "--source-approval-request",
    approvalPath,
    "--out",
    operatorJsonPath,
    "--markdown-out",
    operatorMarkdownPath
  ], { encoding: "utf8" });
  const operatorPacket = JSON.parse(readFileSync(operatorJsonPath, "utf8"));
  const operatorMarkdown = readFileSync(operatorMarkdownPath, "utf8");
  writeFileSync(staleOperatorJsonPath, `${JSON.stringify({
    ...operatorPacket,
    currentRevision: {
      ...operatorPacket.currentRevision,
      gitHead: "0000000000000000000000000000000000000000"
    }
  }, null, 2)}\n`);
  writeFileSync(cleanPlatformOperatorJsonPath, `${JSON.stringify({
    ...operatorPacket,
    platformHandoffFreshness: {
      status: "CURRENT_CLEAN_PLATFORM_QA_HANDOFF",
      currentGitHead: operatorPacket.currentRevision.gitHead,
      currentDirtyWorktree: false,
      basisGitHead: operatorPacket.currentRevision.gitHead,
      basisDirtyWorktree: false,
      basisExecutionFreshnessStatus: "CURRENT_CLEAN_HEAD_PLATFORM_QA_HANDOFF",
      basisStatusLineCount: 0,
      basisStatusTruncated: false,
      problems: []
    }
  }, null, 2)}\n`);
  assert.equal(operatorPacket.schema, "learning-companion.next-major-operator-packet.v1");
  assert.equal(operatorPacket.canClaimNextMajorFromThisPacket, false);
  assert.equal(operatorPacket.releaseActionAuthorized, false);
  assert.equal(operatorPacket.inputs.sourceApprovalRequestAvailable, true);
  assert.equal(operatorPacket.platformHandoffFreshness.status, "STALE_OR_DIRTY_PLATFORM_QA_HANDOFF");
  assert.equal(operatorPacket.lanes.some((lane) => lane.operatorState === "NEEDS_FRESH_PUBLIC_DRY_RUN_OR_APPROVAL_REQUEST"), true);
  assert.equal(operatorPacket.lanes.some((lane) => lane.operatorState === "NEEDS_FRESH_PLATFORM_QA_HANDOFF"), true);
  assert.equal(operatorPacket.lanes.some((lane) => lane.nextCommands?.refreshPlatformHandoff), true);
  assert.equal(operatorPacket.nextActionSequence.some((step) => step.id === "refresh-public-source-dry-run"), true);
  assert.equal(operatorPacket.nextActionSequence.some((step) => step.id === "refresh-platform-qa-handoff"), true);
  assert.equal(operatorPacket.nextActionSequence.some((step) => step.id === "validate-final-ko"), true);
  assert.equal(operatorPacket.blockedOrNotExecuted.length, 5);
  assert.match(operatorConsole, /Can claim next-major from this packet: NO/);
  assert.match(operatorConsole, /NEEDS_FRESH_PUBLIC_DRY_RUN_OR_APPROVAL_REQUEST/);
  assert.match(operatorConsole, /NEEDS_FRESH_PLATFORM_QA_HANDOFF/);
  assert.match(operatorMarkdown, /Fixture approval text/);
  assert.match(operatorMarkdown, /## Critical Path/);
  assert.match(operatorMarkdown, /Approval request freshness: STALE\\_OR\\_DIRTY\\_PUBLIC\\_DRY\\_RUN/);
  assert.match(operatorMarkdown, /Platform handoff freshness: STALE\\_OR\\_DIRTY\\_PLATFORM\\_QA\\_HANDOFF/);
  assert.match(operatorMarkdown, /Platform handoff executionFreshness.status is TBD/);
  assert.match(operatorMarkdown, /platform:qa-handoff/);
  assert.match(operatorMarkdown, /refresh public source preflight/i);
  assert.match(operatorMarkdown, /No build, package, deployment, Mew-Test, main-site, or remote acceptance check was run by this operator packet/);
  assert.equal(statSync(operatorJsonPath).mode & 0o777, 0o600);
  assert.equal(statSync(operatorMarkdownPath).mode & 0o777, 0o600);
  const customExternalPath = join(operatorSmokeDir, "custom external evidence.json");
  const customApprovalMarkdownPath = join(operatorSmokeDir, "custom approval note.md");
  const customMacManualPath = join(operatorSmokeDir, "custom mac receipt.json");
  const customWindowsStaticPath = join(operatorSmokeDir, "custom windows receipt.json");
  const customHarmonyDevicePath = join(operatorSmokeDir, "custom harmony receipt.json");
  const koNextConsole = execFileSync(process.execPath, [
    "scripts/ko-next-action-summary.mjs",
    "--status",
    statusPath,
    "--external",
    customExternalPath,
    "--source-approval-request",
    approvalPath,
    "--source-approval-markdown",
    customApprovalMarkdownPath,
    "--mac-manual",
    customMacManualPath,
    "--windows-static",
    customWindowsStaticPath,
    "--harmony-device",
    customHarmonyDevicePath,
    "--operator",
    operatorJsonPath
  ], { encoding: "utf8" });
  assert.match(koNextConsole, /Operator critical path:/);
  const expectedOperatorFreshness = operatorPacket.currentRevision?.dirtyWorktree === false
    ? "CURRENT_CLEAN_OPERATOR_PACKET"
    : "STALE_OR_DIRTY_OPERATOR_PACKET";
  assert.match(koNextConsole, new RegExp(`Current operator packet freshness: ${expectedOperatorFreshness}`));
  assert.match(koNextConsole, /Operator platform handoff freshness: STALE_OR_DIRTY_PLATFORM_QA_HANDOFF/);
  assert.match(koNextConsole, /Refresh platform handoff command: npm run platform:qa-handoff -- --status/);
  assert.match(koNextConsole, /Platform handoff freshness problem: Platform handoff executionFreshness.status is TBD/);
  if (expectedOperatorFreshness === "STALE_OR_DIRTY_OPERATOR_PACKET") {
    assert.match(koNextConsole, /Refresh operator packet command: npm run next:operator -- --refresh/);
    assert.match(koNextConsole, /Refresh prerequisite: resolve current worktree changes under current-turn authorization before regenerating the operator packet; do not discard changes unless explicitly asked/);
    assert.match(koNextConsole, /Operator packet freshness problem: Operator packet was not generated from a clean worktree/);
  }
  assert.match(koNextConsole, /refresh-public-source-dry-run/);
  assert.match(koNextConsole, /refresh-platform-qa-handoff/);
  assert.match(koNextConsole, /validate-final-ko/);
  assert.match(koNextConsole, /One-command final refresh: npm run next:finalize .*--external .*custom external evidence\.json/);
  assert.match(koNextConsole, /npm run ko:validate .*--external .*custom external evidence\.json/);
  assert.match(koNextConsole, /One-command final refresh: npm run next:finalize .*--source-approval-request .*approval\.json/);
  assert.match(koNextConsole, /One-command final refresh: npm run next:finalize .*--source-approval-markdown .*custom approval note\.md/);
  assert.match(koNextConsole, /One-command final refresh: npm run next:finalize .*--mac-manual .*custom mac receipt\.json/);
  assert.match(koNextConsole, /One-command final refresh: npm run next:finalize .*--windows-static .*custom windows receipt\.json/);
  assert.match(koNextConsole, /One-command final refresh: npm run next:finalize .*--harmony-device .*custom harmony receipt\.json/);
  assert.match(koNextConsole, /npm run ko:validate .*--mac-manual .*custom mac receipt\.json/);
  assert.match(koNextConsole, /npm run ko:validate .*--windows-static .*custom windows receipt\.json/);
  assert.match(koNextConsole, /npm run ko:validate .*--harmony-device .*custom harmony receipt\.json/);
  assert.match(koNextConsole, /Consolidated readiness packet: npm run next:readiness .*--source-approval-request .*approval\.json/);
  assert.match(koNextConsole, /Consolidated readiness packet: npm run next:readiness .*--source-approval-markdown .*custom approval note\.md/);
  assert.match(koNextConsole, /Consolidated readiness packet: npm run next:readiness .*--external .*custom external evidence\.json/);
  assert.match(koNextConsole, /Consolidated readiness packet: npm run next:readiness .*--mac-manual .*custom mac receipt\.json/);
  assert.match(koNextConsole, /Consolidated readiness packet: npm run next:readiness .*--windows-static .*custom windows receipt\.json/);
  assert.match(koNextConsole, /Consolidated readiness packet: npm run next:readiness .*--harmony-device .*custom harmony receipt\.json/);
  assert.match(koNextConsole, /Single operator packet for all remaining gates: npm run next:operator .*--source-approval-request .*approval\.json/);
  assert.match(koNextConsole, /Single operator packet for all remaining gates: npm run next:operator .*--source-approval-markdown .*custom approval note\.md/);
  assert.match(koNextConsole, /Single operator packet for all remaining gates: npm run next:operator .*--external .*custom external evidence\.json/);
  assert.match(koNextConsole, /Single operator packet for all remaining gates: npm run next:operator .*--mac-manual .*custom mac receipt\.json/);
  assert.match(koNextConsole, /Single operator packet for all remaining gates: npm run next:operator .*--windows-static .*custom windows receipt\.json/);
  assert.match(koNextConsole, /Single operator packet for all remaining gates: npm run next:operator .*--harmony-device .*custom harmony receipt\.json/);
  assert.match(koNextConsole, /This operator packet still does not grant approval/);
  const staleKoNextConsole = execFileSync(process.execPath, [
    "scripts/ko-next-action-summary.mjs",
    "--status",
    statusPath,
    "--source-approval-request",
    approvalPath,
    "--operator",
    staleOperatorJsonPath
  ], { encoding: "utf8" });
  assert.match(staleKoNextConsole, /Current operator packet freshness: STALE_OR_DIRTY_OPERATOR_PACKET/);
  assert.match(staleKoNextConsole, /Refresh operator packet command: npm run next:operator -- --refresh/);
  assert.match(staleKoNextConsole, /Operator packet freshness problem: Operator packet gitHead 0000000000000000000000000000000000000000 does not match current HEAD/);
  const cleanPlatformKoNextConsole = execFileSync(process.execPath, [
    "scripts/ko-next-action-summary.mjs",
    "--status",
    statusPath,
    "--source-approval-request",
    approvalPath,
    "--operator",
    cleanPlatformOperatorJsonPath
  ], { encoding: "utf8" });
  assert.match(cleanPlatformKoNextConsole, /Operator platform handoff freshness: CURRENT_CLEAN_PLATFORM_QA_HANDOFF/);
  assert.doesNotMatch(cleanPlatformKoNextConsole, /Refresh platform handoff command/);
  assert.doesNotMatch(cleanPlatformKoNextConsole, /Platform handoff freshness problem/);
  const missingSourceKoNextConsole = execFileSync(process.execPath, [
    resolve("scripts/ko-next-action-summary.mjs"),
    "--status",
    statusPath
  ], { cwd: operatorSmokeDir, encoding: "utf8" });
  assert.match(missingSourceKoNextConsole, /Generate an approval request packet: .*--out \.codex-tmp\/external-source-validation\/source-approval-request\.json --markdown-out \.codex-tmp\/external-source-validation\/source-approval-request\.md/);
  assert.match(missingSourceKoNextConsole, /Approved candidate command: .*--source-approval-request \.codex-tmp\/external-source-validation\/source-approval-request\.json/);
  assert.match(missingSourceKoNextConsole, /One-command final refresh: npm run next:finalize -- --external <ko-evidence-review\.json>$/m);
} finally {
  if (cleanupSmokeArtifacts) rmSync(operatorSmokeDir, { recursive: true, force: true });
}
assert.match(platformQaHandoffJs, /learning-companion\.platform-qa-handoff\.v1/);
assert.match(platformQaHandoffJs, /PLATFORM_QA_HANDOFF_ONLY/);
assert.match(platformQaHandoffJs, /canClaimKo: false/);
assert.match(platformQaHandoffJs, /rawQaMarkdownRetained: false/);
assert.match(platformQaHandoffJs, /rowNotesRetained: false/);
assert.match(platformQaHandoffJs, /--out requires a file path/);
assert.match(platformQaHandoffJs, /--markdown-out requires a file path/);
assert.match(platformQaHandoffJs, /--status requires a KO status JSON path/);
assert.match(platformQaHandoffJs, /function buildPlatformQaHandoffMarkdown/);
assert.match(platformQaHandoffJs, /Platform QA Execution Handoff/);
assert.match(platformQaHandoffJs, /Required session fields/);
assert.match(platformQaHandoffJs, /Execution checklist/);
assert.match(platformQaHandoffJs, /notAcceptedEvidence/);
assert.match(platformQaHandoffJs, /Cannot be filled from/);
assert.match(platformQaHandoffJs, /function markdownInline/);
assert.match(platformQaHandoffJs, /No Mac GUI manual QA was run by this handoff/);
assert.match(platformQaHandoffJs, /No Windows browser\/manual return QA was run by this handoff/);
assert.match(platformQaHandoffJs, /No HarmonyOS DevEco\/toolchain\/device QA was run by this handoff/);
assert.match(platformQaHandoffJs, /mode: 0o600/);
assert.match(platformQaHandoffJs, /error\?\.code !== "ENOENT"/);
assert.match(platformQaHandoffJs, /function writePrivateFile/);
assert.match(platformQaHandoffJs, /chmod\(path, 0o600\)/);
assert.match(platformQaHandoffJs, /Real-run platform receipts are auto-selected by ko:next\/ko:validate when present/);
assert.match(platformQaHandoffJs, /finalKoGateWithExplicitPlatformReceipts/);
assert.match(platformQaHandoffJs, /npm run mac:manual:validate:real/);
assert.match(platformQaHandoffJs, /npm run windows:static:validate:real/);
assert.match(platformQaHandoffJs, /npm run harmony:device:validate:real/);
assert.match(externalSourceValidationBrowserJs, /中文：URL 就是网页链接/);
assert.match(externalSourceValidationBrowserJs, /阅读：https:\/\/<public-reading-material>/);
assert.match(externalSourceValidationBrowserJs, /视频：https:\/\/<public-video-material>/);
assert.match(externalSourceValidationBrowserJs, /function runSourceIntake/);
assert.match(externalSourceValidationBrowserJs, /function runSourceApprovalRequest/);
assert.match(externalSourceValidationBrowserJs, /source_intake_ok/);
assert.match(externalSourceValidationBrowserJs, /source_intake_error/);
assert.match(externalSourceValidationBrowserJs, /source_approval_request_ok/);
assert.match(externalSourceValidationBrowserJs, /source_approval_request_error/);
assert.match(externalSourceValidationBrowserJs, /external-source-intake-handoff\.v1/);
assert.match(externalSourceValidationBrowserJs, /external-source-approval-request\.v1/);
assert.match(externalSourceValidationBrowserJs, /SOURCE_INTAKE_HANDOFF_ONLY/);
assert.match(externalSourceValidationBrowserJs, /SOURCE_APPROVAL_REQUEST_ONLY/);
assert.match(externalSourceValidationBrowserJs, /rawInputRetained: false/);
assert.match(externalSourceValidationBrowserJs, /requestedApprovalText/);
assert.match(externalSourceValidationBrowserJs, /approvalRequestPath/);
assert.match(externalSourceValidationBrowserJs, /--source-approval-request requires a file path/);
assert.match(externalSourceValidationBrowserJs, /--approved-current-turn requires --source-approval-request/);
assert.match(externalSourceValidationBrowserJs, /function validateApprovedRunSourceApprovalRequest/);
assert.match(externalSourceValidationBrowserJs, /function validateApprovedRunSourceApprovalRequestObject/);
assert.match(externalSourceValidationBrowserJs, /assessSourceApprovalFreshness/);
assert.match(externalSourceValidationBrowserJs, /CURRENT_CLEAN_PUBLIC_DRY_RUN/);
assert.match(externalSourceValidationBrowserJs, /sourceApprovalRequestBinding/);
assert.match(externalSourceValidationBrowserJs, /function buildSourceApprovalRequestBinding/);
assert.match(externalSourceValidationBrowserJs, /source-approval-request-binding\.v1/);
assert.match(externalSourceValidationBrowserJs, /requestedApprovalText: request\.requestedApprovalText/);
assert.match(externalSourceValidationBrowserJs, /function assertRequestedApprovalTextCoversSources/);
assert.match(externalSourceValidationBrowserJs, /function parseApprovalTokens/);
assert.match(externalSourceValidationBrowserJs, /requestedApprovalTextMatched/);
assert.match(externalSourceValidationBrowserJs, /function assertCurrentCleanSourceApprovalFreshness/);
assert.match(externalSourceValidationBrowserJs, /freshness must be CURRENT_CLEAN_PUBLIC_DRY_RUN/);
assert.match(externalSourceValidationBrowserJs, /does not match --approval-note/);
assert.match(externalSourceValidationBrowserJs, /Use exactly one of --intake-handoff <path> or --dry-run-receipt <path>/);
assert.match(externalSourceValidationBrowserJs, /summary\.ok true/);
assert.match(externalSourceValidationBrowserJs, /function optionalBoolean/);
assert.match(externalSourceValidationBrowserJs, /function markdownInline/);
assert.match(externalSourceValidationBrowserJs, /No current-turn source approval was granted by this request artifact/);
assert.match(externalSourceValidationBrowserJs, /mode: 0o600/);
assert.match(externalSourceValidationBrowserJs, /No browser was launched/);
assert.match(externalSourceValidationBrowserJs, /approvalRequiredBeforeKoEvidence/);
assert.match(externalSourceValidationBrowserJs, /privacyReviewChecklist/);
assert.match(externalSourceValidationBrowserJs, /Handoff JSON/);
assert.match(externalSourceValidationBrowserJs, /APPROVED_IN_CURRENT_TURN/);

let workspace = createDefaultWorkspace();
assert.equal(workspace.schema, WORKSPACE_SCHEMA);
assert.equal(workspace.schemaVersion, WORKSPACE_SCHEMA_VERSION);
assert.equal(workspace.version, WORKSPACE_SCHEMA_VERSION);

const reviewPackMarkdown = generateReviewPackMarkdown(workspace);
assert.match(reviewPackMarkdown, /Learning Companion Review Pack/);
assert.match(reviewPackMarkdown, /学习伴侣复习包/);
assert.match(reviewPackMarkdown, /Next action: Capture next point/);
assert.match(reviewPackMarkdown, /下一步：摘录下一个要点/);
assert.match(reviewPackMarkdown, /Why: The source is available and the session has gone quiet\./);
assert.match(reviewPackMarkdown, /原因：来源可用，但这个主题已经安静了一段时间。/);
assert.match(reviewPackMarkdown, /Offline headline gate/);
assert.match(reviewPackMarkdown, /离线 headline gate/);
assert.match(reviewPackMarkdown, /Separate permissioned gates/);
assert.match(reviewPackMarkdown, /需要单独授权的 gate/);
assert.match(reviewPackMarkdown, /npm run check:morning:browser/);
assert.match(reviewPackMarkdown, /中文范围：本地 MVP fixture/);
assert.match(reviewPackMarkdown, /导出产物/);
assert.match(reviewPackMarkdown, /HarmonyOS：schema reader 原型/);

const normalizedDraft = normalizeCaptureDraft({
  quote: "  Draft quote\n",
  thought: "Draft thought",
  timestamp: " 08:12 ",
  sourceTitle: "  Source doc ",
  sourceUrl: " https://example.com/lesson ",
  materialType: "video",
  answersQuestionCaptureId: "capture_answer_target",
  updatedAt: "2026-05-29T00:01:00.000Z"
});
assert.deepEqual(normalizedDraft, {
  quote: "Draft quote",
  thought: "Draft thought",
  timestamp: "08:12",
  sourceTitle: "Source doc",
  sourceUrl: "https://example.com/lesson",
  materialType: "video",
  answersQuestionCaptureId: "capture_answer_target",
  updatedAt: "2026-05-29T00:01:00.000Z"
});
assert.equal(hasCaptureDraft(normalizedDraft), true);
assert.equal(hasCaptureTextDraft(normalizedDraft), true);
assert.equal(captureDraftStatusText(normalizedDraft), "Draft saved");
assert.equal(captureDraftStatusText(normalizeCaptureDraft({ timestamp: "01:23" })), "Time kept");
assert.equal(captureDraftStatusText(normalizeCaptureDraft({})), "No draft");
assert.match(normalizeCaptureDraft({ quote: "\u0000safe" }).quote, /^safe$/);
assert.deepEqual(
  {
    sourceTitle: normalizeCaptureDraft({ quote: "legacy draft" }).sourceTitle,
    sourceUrl: normalizeCaptureDraft({ quote: "legacy draft" }).sourceUrl
  },
  { sourceTitle: "", sourceUrl: "" }
);
assert.equal(normalizeCaptureDraft({ sourceTitle: "\u0000 Source\nTitle " }).sourceTitle, "Source Title");
assert.equal(normalizeCaptureDraft({ sourceUrl: ` ${"x".repeat(2200)} ` }).sourceUrl.length, 2048);
assert.equal(normalizeCaptureDraft({ quote: "Invalid type", materialType: "slides" }).materialType, "");
assert.equal(normalizeCaptureDraft({ answersQuestionCaptureId: "bad answer target!" }).answersQuestionCaptureId, "");
assert.equal(normalizeCaptureDraft({ quote: "x" }, new Date("2026-05-29T00:02:00.000Z")).updatedAt, "2026-05-29T00:02:00.000Z");
assert.equal(resolveDraftSourceMaterialType({
  currentMaterialType: "video",
  resolvedSourceTitle: "",
  resolvedSourceUrl: ""
}), "");
assert.equal(resolveDraftSourceMaterialType({
  currentSourceTitle: "Doc source",
  currentSourceUrl: "https://example.com/doc",
  currentMaterialType: "doc",
  resolvedSourceTitle: "Doc source",
  resolvedSourceUrl: "https://example.com/doc"
}), "doc");
assert.equal(resolveDraftSourceMaterialType({
  draftSourceTitle: "Legacy doc",
  draftSourceUrl: "https://example.com/legacy-doc",
  currentSourceTitle: "Current video",
  currentSourceUrl: "https://www.youtube.com/watch?v=legacyvideo",
  currentMaterialType: "video",
  resolvedSourceTitle: "Legacy doc",
  resolvedSourceUrl: "https://example.com/legacy-doc"
}), "other");
assert.equal(resolveDraftSourceMaterialType({
  draftSourceTitle: "Legacy doc",
  draftSourceUrl: "https://example.com/legacy-doc",
  currentSourceTitle: "Legacy doc",
  currentSourceUrl: "https://example.com/legacy-doc",
  currentMaterialType: "doc",
  resolvedSourceTitle: "Legacy doc",
  resolvedSourceUrl: "https://example.com/legacy-doc"
}), "doc");

const draftSessions = [
  createSession({ id: "draft_a", title: "Draft A" }, workspace.clientId),
  createSession({ id: "draft_b", title: "Draft B" }, workspace.clientId),
  createSession({ id: "draft_empty", title: "Draft Empty" }, workspace.clientId)
];
const draftItems = buildCaptureDraftItems(draftSessions, {
  draft_a: { quote: "Older draft", updatedAt: "2026-05-29T00:01:00.000Z" },
  draft_b: { thought: "Newest draft", updatedAt: "2026-05-29T00:03:00.000Z" },
  draft_empty: { quote: "   ", updatedAt: "2026-05-29T00:04:00.000Z" }
}, 5);
assert.deepEqual(draftItems.map((item) => item.session.id), ["draft_b", "draft_a"]);
assert.equal(buildCaptureDraftItems(draftSessions, { draft_a: { quote: "Only draft" } }, 0).length, 0);
assert.match(workspace.clientId, /^client_/);
assert.equal(workspace.sessions.length, 1);
assert.equal(cleanUrl("javascript:alert(1)"), "");
assert.equal(cleanUrl("data:text/html,hi"), "");
assert.equal(safeHref("javascript:alert(1)"), "#");
assert.equal(cleanUrl("https://example.com/a path").startsWith("https://example.com/"), true);
assert.equal(cleanText("ok\u0000bad"), "okbad");
assert.equal(cleanText("x".repeat(MAX_CAPTURE_TEXT_LENGTH + 10)).length, MAX_CAPTURE_TEXT_LENGTH);
assert.equal(buildSourceJumpUrl("javascript:alert(1)", "01:00"), "");
assert.equal(buildSourceJumpUrl("https://example.com/video", "01:00"), "https://example.com/video");
assert.equal(buildSourceJumpUrl("https://youtu.be/rust123?start=12", "01:00"), "https://youtu.be/rust123?t=60s");
assert.equal(buildSourceJumpUrl("https://youtu.be/rust123", "1m30s"), "https://youtu.be/rust123?t=90s");
assert.equal(buildSourceJumpUrl("https://www.bilibili.com/video/BV123/?p=2", "01:30"), "https://www.bilibili.com/video/BV123/?p=2&t=90");
assert.equal(buildSourceJumpUrl("https://m.bilibili.com/video/BV123/?p=2", "01:30"), "https://m.bilibili.com/video/BV123/?p=2&t=90");
assert.equal(buildSourceJumpUrl("https://vimeo.com/123456789?h=abc", "01:30"), "https://vimeo.com/123456789?h=abc#t=1m30s");
assert.equal(buildSourceJumpUrl("https://vimeo.com/123456789?h=abc#autoplay=1", "01:30"), "https://vimeo.com/123456789?h=abc#autoplay=1&t=1m30s");
assert.equal(buildSourceJumpUrl("https://vimeo.com/123456789#chapter-one", "01:30"), "https://vimeo.com/123456789#chapter-one");
const normalizedVideoBookmark = normalizeVideoBookmark({ seconds: 95.8, label: "  Key idea  " });
assert.equal(normalizedVideoBookmark.seconds, 95);
assert.equal(normalizedVideoBookmark.timestamp, "01:35");
assert.equal(normalizedVideoBookmark.label, "Key idea");
assert.equal(normalizeVideoBookmark({ timestamp: "02:05", label: "timestamp only" }).seconds, 125);
assert.equal(normalizeVideoBookmark({ seconds: 42, timestamp: "99:99", label: "canonical" }).timestamp, "00:42");
assert.equal(normalizeVideoBookmark({ seconds: 0, timestamp: "99:99", label: "start" }).timestamp, "00:00");
const bookmarkSession = createSession({
  title: "Video bookmark topic",
  sourceUrl: "https://youtu.be/rust123",
  materialType: "video",
  videoBookmarks: [normalizedVideoBookmark]
}, workspace.clientId);
assert.equal(bookmarkSession.videoBookmarks.length, 1);
assert.match(generateMarkdown(bookmarkSession), /## Video Bookmarks/);
assert.match(generateMarkdown(bookmarkSession), /\[01:35 - Key idea\]\(https:\/\/youtu\.be\/rust123\?t=95s\)/);
let bookmarkWorkspace = createDefaultWorkspace();
const bookmarkActive = getActiveSession(bookmarkWorkspace);
bookmarkWorkspace = updateSession(bookmarkWorkspace, bookmarkActive.id, {
  sourceUrl: "https://youtu.be/rust123",
  materialType: "video",
  videoBookmarks: [{ seconds: 42, timestamp: "99:99", label: "canonical" }]
});
assert.equal(getActiveSession(bookmarkWorkspace).videoBookmarks[0].timestamp, "00:42");
bookmarkWorkspace = updateSession(bookmarkWorkspace, bookmarkActive.id, { materialType: "article" });
assert.equal(getActiveSession(bookmarkWorkspace).videoBookmarks.length, 0);
assert.doesNotMatch(generateMarkdown(getActiveSession(bookmarkWorkspace)), /Video Bookmarks/);
assert.equal(
  buildSourceTextFragmentUrl("https://example.com/article?unit=1", "A captured sentence worth reopening beside the sidecar."),
  "https://example.com/article?unit=1#:~:text=A%20captured%20sentence%20worth%20reopening%20beside%20the%20sidecar."
);
assert.equal(
  buildSourceTextFragmentUrl("https://example.com/article#chapter-two", "A captured sentence worth reopening beside the sidecar."),
  "https://example.com/article#chapter-two:~:text=A%20captured%20sentence%20worth%20reopening%20beside%20the%20sidecar."
);
assert.equal(
  buildSourceTextFragmentUrl("https://example.com/article", "Line one,\nline-two & three"),
  "https://example.com/article#:~:text=Line%20one%2C%20line%2Dtwo%20%26%20three"
);
assert.equal(
  buildSourceTextFragmentUrl("https://example.com/article#:~:text=Existing", "A captured sentence worth reopening beside the sidecar."),
  "https://example.com/article#:~:text=Existing"
);
assert.equal(buildSourceTextFragmentUrl("https://www.youtube.com/watch?v=doc", "A captured sentence worth reopening."), "");
assert.equal(buildSourceTextFragmentUrl("javascript:alert(1)", "A captured sentence worth reopening."), "");
assert.equal(buildSourceTextFragmentUrl("https://example.com/lesson.pdf", "A captured sentence worth reopening."), "");
assert.equal(buildSourceTextFragmentUrl("https://example.com/article", "short"), "");
assert.equal(buildSourceTextFragmentUrl("https://example.com/article", "------------"), "");
assert.equal(buildSourceTextFragmentUrl("https://example.com/article", "x".repeat(160)), `https://example.com/article#:~:text=${"x".repeat(140)}`);
assert.equal(timestampToSeconds("abc"), null);
assert.equal(timestampToSeconds("1:2:3:4"), null);
assert.equal(timestampToSeconds("1hxm"), null);
assert.equal(timestampToSeconds("1m30s"), 90);
assert.equal(timestampToSeconds("1h02m03s"), 3723);
assert.equal(secondsToTimestamp(90), "01:30");
assert.equal(secondsToTimestamp(3601), "1:00:01");
assert.equal(extractSourceTimestamp("https://youtu.be/rust123?t=1m30s"), "01:30");
assert.equal(extractSourceTimestamp("https://youtu.be/rust123?t=90"), "01:30");
assert.equal(extractSourceTimestamp("https://youtu.be/rust123?t=1m30s&start=492&time_continue=3723"), "01:30");
assert.equal(extractSourceTimestamp("https://www.youtube.com/watch?v=rust123&start=492"), "08:12");
assert.equal(extractSourceTimestamp("https://www.youtube.com/watch?v=rust123&time_continue=3723"), "1:02:03");
assert.equal(extractSourceTimestamp("https://www.bilibili.com/video/BV123/?p=2&t=90"), "01:30");
assert.equal(extractSourceTimestamp("https://m.bilibili.com/video/BV123/?p=2&t=90"), "01:30");
assert.equal(extractSourceTimestamp("https://b23.tv/abc?t=90"), "");
assert.equal(extractSourceTimestamp("https://vimeo.com/123456789?h=abc#t=1m30s"), "01:30");
assert.equal(extractSourceTimestamp("https://player.vimeo.com/video/123456789#t=90s&autoplay=1"), "01:30");
assert.equal(extractSourceTimestamp("https://example.com/video?t=1m30s"), "");
assert.equal(stripSourceTimestamp("https://youtu.be/rust123?t=1m30s"), "https://youtu.be/rust123");
assert.equal(stripSourceTimestamp("https://www.youtube.com/watch?v=rust123&start=492"), "https://www.youtube.com/watch?v=rust123");
assert.equal(
  stripSourceTimestamp("https://www.youtube.com/watch?v=rust123&list=PL1&index=2&t=90#notes"),
  "https://www.youtube.com/watch?v=rust123&list=PL1&index=2#notes"
);
assert.equal(stripSourceTimestamp("https://www.bilibili.com/video/BV123/?p=2&t=90"), "https://www.bilibili.com/video/BV123/?p=2");
assert.equal(stripSourceTimestamp("https://vimeo.com/123456789?h=abc#t=1m30s"), "https://vimeo.com/123456789?h=abc");
assert.equal(stripSourceTimestamp("https://vimeo.com/123456789?h=abc#t=1m30s&autoplay=1"), "https://vimeo.com/123456789?h=abc#autoplay=1");
assert.equal(stripSourceTimestamp("https://vimeo.com/123456789#chapter-one"), "https://vimeo.com/123456789#chapter-one");
assert.equal(stripSourceTimestamp("https://example.com/video?t=1m30s"), "https://example.com/video?t=1m30s");

let highlightWorkspace = createDefaultWorkspace();
highlightWorkspace = addCapture(highlightWorkspace, getActiveSession(highlightWorkspace).id, {
  id: "capture_quote_only_annotation",
  quote: "A quote-only highlight should stay as one capture.",
  thought: "",
  timestamp: "02:10"
}, { now: "2026-05-29T00:04:00.000Z" });
const highlightSession = getActiveSession(highlightWorkspace);
highlightWorkspace = updateCaptureThought(
  highlightWorkspace,
  highlightSession.id,
  "capture_quote_only_annotation",
  "This explains why annotation must be in-place.",
  { now: "2026-05-29T00:05:00.000Z" }
);
const annotatedHighlight = getActiveSession(highlightWorkspace).captures[0];
assert.equal(getActiveSession(highlightWorkspace).captures.length, 1);
assert.equal(annotatedHighlight.thought, "This explains why annotation must be in-place.");
assert.equal(annotatedHighlight.quote, "A quote-only highlight should stay as one capture.");
assert.equal(annotatedHighlight.updatedAt, "2026-05-29T00:05:00.000Z");
assert.equal(updateCaptureThought(highlightWorkspace, highlightSession.id, annotatedHighlight.id, ""), highlightWorkspace);
assert.equal(updateCaptureThought(highlightWorkspace, highlightSession.id, annotatedHighlight.id, "   "), highlightWorkspace);

let promotedHighlightWorkspace = createDefaultWorkspace();
promotedHighlightWorkspace = addCapture(promotedHighlightWorkspace, getActiveSession(promotedHighlightWorkspace).id, {
  id: "capture_promoted_quote_only_annotation",
  quote: "A promoted quote-only highlight should keep its linked card useful.",
  thought: ""
}, { promoteToReview: true, now: "2026-05-29T00:06:00.000Z" });
const promotedHighlightSession = getActiveSession(promotedHighlightWorkspace);
assert.match(promotedHighlightSession.reviewCards[0].prompt, /^Explain this excerpt:/);
promotedHighlightWorkspace = updateCaptureThought(
  promotedHighlightWorkspace,
  promotedHighlightSession.id,
  "capture_promoted_quote_only_annotation",
  "Use the annotation as the recall prompt.",
  { now: "2026-05-29T00:07:00.000Z" }
);
const refreshedPromotedHighlight = getActiveSession(promotedHighlightWorkspace);
assert.equal(refreshedPromotedHighlight.captures.length, 1);
assert.equal(refreshedPromotedHighlight.reviewCards.length, 1);
assert.equal(refreshedPromotedHighlight.reviewCards[0].prompt, "Recall the point behind: Use the annotation as the recall prompt.");
const editedPromptWorkspace = {
  ...promotedHighlightWorkspace,
  sessions: promotedHighlightWorkspace.sessions.map((item) => item.id === promotedHighlightSession.id
    ? {
        ...item,
        reviewCards: item.reviewCards.map((card) => ({
          ...card,
          prompt: "Custom learner prompt should survive annotation."
        }))
      }
    : item)
};
const preservedPromptWorkspace = updateCaptureThought(
  editedPromptWorkspace,
  promotedHighlightSession.id,
  "capture_promoted_quote_only_annotation",
  "A later annotation should not overwrite custom prompts.",
  { now: "2026-05-29T00:08:00.000Z" }
);
assert.equal(getActiveSession(preservedPromptWorkspace).reviewCards[0].prompt, "Custom learner prompt should survive annotation.");

workspace = addSession(workspace, "Rust ownership course");
let session = getActiveSession(workspace);
assert.equal(session.title, "Rust ownership course");
workspace = updateSession(workspace, session.id, {
  sourceTitle: "RustConf ownership talk",
  sourceUrl: "https://www.youtube.com/watch?v=rust123",
  materialType: "video"
});
session = getActiveSession(workspace);

workspace = addCapture(workspace, session.id, {
  quote: "Ownership lets Rust make memory safety guarantees without a garbage collector.",
  thought: "Connect this to compile-time lifetime checks.",
  timestamp: "08:12",
  tags: "rust memory"
}, { promoteToReview: true, now: "2026-05-29T00:10:00.000Z" });

session = getActiveSession(workspace);
assert.equal(session.captures.length, 1);
assert.equal(session.reviewCards.length, 1);
assert.equal(session.captures[0].tags.includes("rust"), true);
assert.equal(session.captures[0].originClientId, workspace.clientId);
assert.equal(session.captures[0].updatedAt.length > 0, true);
assert.equal(session.captures[0].sourceTitle, "RustConf ownership talk");
assert.equal(session.captures[0].sourceUrl, "https://www.youtube.com/watch?v=rust123");
assert.equal(session.captures[0].materialType, "video");
assert.equal(session.captures[0].sourceProvenance, "snapshot");
assert.equal(getDueReviewCards(session).length, 1);
assert.equal(getDueReviewItems(workspace).length, 1);
assert.equal(timestampToSeconds("08:12"), 492);
assert.equal(buildSourceJumpUrl(session.captures[0].sourceUrl, session.captures[0].timestamp), "https://www.youtube.com/watch?v=rust123&t=492s");
const backupFingerprint = workspaceBackupFingerprint(workspace);
const backupNow = new Date("2026-05-29T00:30:00.000Z");
const emptyWorkspace = createDefaultWorkspace();
const emptyBackupFingerprint = workspaceBackupFingerprint(emptyWorkspace);
assert.equal(workspaceStorageNotice(createDefaultWorkspace(), null, 1000, backupNow), null);
assert.equal(workspaceStorageNotice(emptyWorkspace, { fingerprint: emptyBackupFingerprint, exportedAt: "2026-05-21T00:30:00.000Z" }, 1000, backupNow), null);
assert.equal(workspaceStorageNotice(workspace, null, 1000, backupNow), "Local changes not exported");
assert.equal(workspaceStorageNotice(workspace, { fingerprint: backupFingerprint, exportedAt: "2026-05-28T00:30:00.000Z" }, 1000, backupNow), null);
assert.equal(
  workspaceStorageNotice(workspace, { fingerprint: backupFingerprint, exportedAt: "2026-05-21T23:30:00.000Z" }, 1000, backupNow),
  `Last export was ${WORKSPACE_BACKUP_STALE_DAYS} days ago; re-export to refresh your local copy`
);
assert.equal(workspaceStorageNotice(workspace, { fingerprint: backupFingerprint, exportedAt: "2026-05-28T00:30:00.000Z" }, 4_000_000, backupNow), "Workspace is 3.8 MB; export now.");
assert.equal(workspaceStorageNotice(workspace, { fingerprint: backupFingerprint, exportedAt: "2026-05-21T23:30:00.000Z" }, 4_000_000, backupNow), "Workspace is 3.8 MB; export now.");
assert.equal(formatBytes(1536), "2 KB");

const promotedDeterminismBase = addSession(createDefaultWorkspace(), "Promoted card determinism");
const promotedDeterminismSession = getActiveSession(promotedDeterminismBase);
const promotedDeterminismInput = {
  id: "capture_promoted_deterministic",
  quote: "Fixed review-card timestamps make resume gates stable.",
  thought: "Check promoted card determinism."
};
const promotedA = addCapture(promotedDeterminismBase, promotedDeterminismSession.id, promotedDeterminismInput, {
  promoteToReview: true,
  now: "2026-05-29T00:12:00.000Z"
});
const promotedB = addCapture(promotedDeterminismBase, promotedDeterminismSession.id, promotedDeterminismInput, {
  promoteToReview: true,
  now: "2026-05-29T00:12:00.000Z"
});
const scrubPromotedCard = (workspaceValue) => {
  const card = getActiveSession(workspaceValue).reviewCards[0];
  return { ...card, id: "<generated-card-id>" };
};
assert.deepEqual(scrubPromotedCard(promotedA), scrubPromotedCard(promotedB));
assert.equal(scrubPromotedCard(promotedA).dueAt, "2026-05-29T00:12:00.000Z");
assert.equal(scrubPromotedCard(promotedA).createdAt, "2026-05-29T00:12:00.000Z");
assert.equal(scrubPromotedCard(promotedA).updatedAt, "2026-05-29T00:12:00.000Z");

const timedWorkspace = addCapture(workspace, session.id, {
  id: "timed_capture",
  quote: "Timed capture for deterministic receipts.",
  thought: "The script can inject capture time without changing app defaults."
}, { now: "2026-05-29T01:02:03.000Z" });
const timedCapture = getActiveSession(timedWorkspace).captures[0];
assert.equal(timedCapture.id, "timed_capture");
assert.equal(timedCapture.createdAt, "2026-05-29T01:02:03.000Z");
assert.equal(timedCapture.capturedAt, "2026-05-29T01:02:03.000Z");
assert.equal(timedCapture.updatedAt, "2026-05-29T01:02:03.000Z");

let multiReviewWorkspace = addSession(workspace, "Algorithms course");
const algorithmsSession = getActiveSession(multiReviewWorkspace);
multiReviewWorkspace = addCapture(multiReviewWorkspace, algorithmsSession.id, {
  quote: "Dijkstra explores the lowest-cost frontier first.",
  thought: "Recall why greedy selection works.",
  tags: "algorithms graph"
}, { promoteToReview: true, now: "2026-05-29T00:11:00.000Z" });
const dueItems = getDueReviewItems(multiReviewWorkspace);
assert.equal(dueItems.length, 2);
assert.equal(dueItems.some((item) => item.sessionTitle === "Rust ownership course"), true);
assert.equal(dueItems.some((item) => item.sessionTitle === "Algorithms course"), true);
assert.equal(getRecentCaptureItems(multiReviewWorkspace, 1)[0].sessionTitle, "Algorithms course");

const workspaceDueElsewhere = sanitizeWorkspace({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  activeSessionId: "focus_active_clean",
  sessions: [
    {
      id: "focus_active_clean",
      title: "Clean active topic",
      sourceTitle: "Clean source",
      sourceUrl: "https://example.com/clean",
      materialType: "doc",
      tags: [],
      focusMode: "capture",
      notesMarkdown: "",
      captures: [],
      reviewCards: []
    },
    {
      id: "focus_due_elsewhere",
      title: "Due elsewhere",
      sourceTitle: "Other source",
      sourceUrl: "https://example.com/other",
      materialType: "doc",
      tags: [],
      focusMode: "capture",
      notesMarkdown: "",
      captures: [],
      reviewCards: [{
        id: "elsewhere_card",
        prompt: "Remember this outside the active topic",
        answer: "Because Today is workspace-scoped.",
        dueAt: "2026-05-29T00:00:00.000Z",
        strength: 0
      }]
    }
  ]
});
const workspaceDueBrief = buildFocusBrief(getActiveSession(workspaceDueElsewhere), workspaceDueElsewhere, new Date("2026-05-29T00:20:00.000Z"));
assert.equal(workspaceDueBrief.stats.dueCards, 0);
assert.equal(workspaceDueBrief.stats.workspaceDueCards, 1);
assert.equal(workspaceDueBrief.nextAction.kind, "review");
assert.match(workspaceDueBrief.nextAction.label, /workspace due card/);
assert.equal(workspaceDueBrief.nextAction.detail, "Due cards exist outside the active topic; queue is earliest due, then topic title.");
assert.equal(workspaceDueBrief.nextAction.reason, "Workspace review debt outranks adding new material.");

const inboxPatch = {
  schema: MOBILE_INBOX_PATCH_SCHEMA,
  appVersion: WORKSPACE_SCHEMA_VERSION,
  patchId: "patch_mobile_001",
  createdAt: "2026-05-29T08:00:00+08:00",
  source: {
    generatedBy: "inbox.html",
    workspaceFingerprint: "fnv1a-test",
    topicId: session.id,
    topicTitle: session.title
  },
  target: {
    topicId: session.id,
    topicTitle: session.title
  },
  captures: [{
    id: "inbox_capture_001",
    quote: "Mobile reading adds a follow-up quote.",
    thought: "Bring this back from HarmonyOS.",
    timestamp: "03:21",
    sourceTitle: "Mobile article",
    sourceUrl: "javascript:alert(1)",
    materialType: "article",
    tags: "mobile inbox",
    capturedAt: "2026-05-29T08:01:00+08:00"
  }, {
    id: "inbox_capture_001",
    quote: "Duplicate inside patch",
    thought: "Should be skipped",
    capturedAt: "2026-05-29T08:02:00+08:00"
  }]
};
assert.equal(isMobileInboxPatch(inboxPatch), true);
let inboxResult = applyMobileInboxPatch(workspace, inboxPatch, new Date("2026-05-29T08:05:00+08:00"));
let inboxSession = inboxResult.workspace.sessions.find((item) => item.id === session.id);
const importedInboxCapture = inboxSession.captures.find((capture) => capture.inboxCaptureId === "inbox_capture_001");
assert.equal(inboxResult.receipt.targetResolution, "id-match");
assert.equal(inboxResult.receipt.added, 1);
assert.equal(inboxResult.receipt.skippedDuplicate, 1);
assert.equal(inboxResult.receipt.sanitizedSourceUrls, 1);
assert.equal(inboxResult.receipt.answeredQuestions, 0);
assert.equal(inboxResult.receipt.skippedAnswerTargets, 0);
assert.equal(inboxResult.receipt.sourceWorkspaceFingerprint, "fnv1a-test");
assert.equal(inboxResult.receipt.currentWorkspaceFingerprint, `fnv1a-${workspaceFingerprint(JSON.stringify(sanitizeWorkspace(workspace), null, 2))}`);
assert.equal(inboxResult.receipt.sourceFingerprintBasis, "workspace");
assert.equal(inboxResult.receipt.sourceFingerprintMatches, false);
assert.equal(importedInboxCapture.sourceProvenance, "inbox");
assert.equal(importedInboxCapture.sourceUrl, "");
assert.equal(importedInboxCapture.inboxCaptureId, "inbox_capture_001");
assert.equal(inboxResult.workspace.importedPatches.includes("patch_mobile_001"), true);
const matchingInboxFingerprint = `fnv1a-${workspaceFingerprint(JSON.stringify(sanitizeWorkspace(workspace), null, 2))}`;
const matchingInboxResult = applyMobileInboxPatch(workspace, {
  ...inboxPatch,
  patchId: "patch_mobile_matching_base",
  source: { ...inboxPatch.source, workspaceFingerprint: matchingInboxFingerprint },
  captures: []
});
assert.equal(matchingInboxResult.receipt.sourceFingerprintMatches, true);
const matchingInboxReturnBaseFingerprint = buildReturnBaseFingerprint(workspace);
const matchingInboxReturnBaseResult = applyMobileInboxPatch(workspace, {
  ...inboxPatch,
  patchId: "patch_mobile_matching_return_base",
  source: { ...inboxPatch.source, returnBaseFingerprint: matchingInboxReturnBaseFingerprint },
  captures: []
});
assert.equal(matchingInboxReturnBaseResult.receipt.sourceReturnBaseFingerprint, matchingInboxReturnBaseFingerprint);
assert.equal(matchingInboxReturnBaseResult.receipt.currentReturnBaseFingerprint, matchingInboxReturnBaseFingerprint);
assert.equal(matchingInboxReturnBaseResult.receipt.sourceFingerprintBasis, "return-base");
assert.notEqual(matchingInboxReturnBaseResult.receipt.sourceFingerprintBasis, "workspace");
assert.ok(matchingInboxReturnBaseResult.receipt.sourceWorkspaceFingerprint);
assert.equal(matchingInboxReturnBaseResult.receipt.sourceFingerprintMatches, true);
const unrelatedMacCaptureWorkspace = addCapture(workspace, session.id, {
  quote: "Unrelated Mac capture after mirror export.",
  thought: "This should not stale the phone return base.",
  timestamp: "09:30"
});
const unrelatedMacCaptureReturnResult = applyMobileInboxPatch(unrelatedMacCaptureWorkspace, {
  ...inboxPatch,
  patchId: "patch_mobile_unrelated_mac_capture",
  source: { ...inboxPatch.source, returnBaseFingerprint: matchingInboxReturnBaseFingerprint },
  captures: []
});
assert.equal(unrelatedMacCaptureReturnResult.receipt.sourceFingerprintMatches, true);
const legacyInboxResult = applyMobileInboxPatch(workspace, {
  ...inboxPatch,
  patchId: "patch_mobile_legacy_base",
  source: { generatedBy: "inbox.html", topicId: session.id, topicTitle: session.title },
  captures: []
});
assert.equal(legacyInboxResult.receipt.sourceWorkspaceFingerprint, "");
assert.equal(legacyInboxResult.receipt.sourceFingerprintMatches, null);
const duplicateInboxResult = applyMobileInboxPatch(inboxResult.workspace, inboxPatch);
assert.equal(duplicateInboxResult.receipt.targetResolution, "duplicate-patch");
assert.equal(duplicateInboxResult.receipt.added, 0);
assert.equal(duplicateInboxResult.receipt.sourceFingerprintMatches, false);
assert.equal(duplicateInboxResult.workspace.sessions.find((item) => item.id === session.id).captures.length, inboxSession.captures.length);

const titlePatch = {
  ...inboxPatch,
  patchId: "patch_mobile_002",
  target: { topicId: "missing", topicTitle: session.title },
  captures: [{ ...inboxPatch.captures[0], id: "inbox_capture_002", sourceUrl: "https://example.com/mobile" }]
};
const titleResult = applyMobileInboxPatch(workspace, titlePatch);
assert.equal(titleResult.receipt.targetResolution, "title-match");
assert.equal(titleResult.workspace.sessions.find((item) => item.id === session.id).captures.find((capture) => capture.inboxCaptureId === "inbox_capture_002").sourceUrl, "https://example.com/mobile");

const fallbackPatch = {
  ...inboxPatch,
  patchId: "patch_mobile_003",
  target: { topicId: "missing", topicTitle: "Missing title" },
  captures: [{ ...inboxPatch.captures[0], id: "inbox_capture_003", thought: "Fallback capture" }]
};
const fallbackResult = applyMobileInboxPatch(workspace, fallbackPatch);
assert.equal(fallbackResult.receipt.targetResolution, "active-fallback");
assert.equal(getActiveSession(fallbackResult.workspace).captures.find((capture) => capture.inboxCaptureId === "inbox_capture_003").thought, "Fallback capture");

assert.equal(isMobileInboxPatchLike({ schema: "learning-companion.mobile-inbox-patch.v2" }), true);
assert.throws(() => workspaceFromPortableData({ schema: "learning-companion.mobile-inbox-patch.v2" }), /Unsupported mobile inbox patch schema/);
assert.throws(() => applyMobileInboxPatch(workspace, { ...inboxPatch, patchId: "" }), /patchId/);
assert.throws(() => applyMobileInboxPatch(workspace, {
  ...inboxPatch,
  patchId: "patch_mobile_too_many",
  captures: Array.from({ length: MAX_INBOX_PATCH_CAPTURES + 1 }, (_, index) => ({
    ...inboxPatch.captures[0],
    id: `too_many_${index}`
  }))
}), /too many captures/);

const markdown = generateMarkdown(session);
assert.match(markdown, /Rust ownership course/);
assert.match(markdown, /_中文：主题笔记_/);
assert.match(markdown, /08:12/);
assert.match(markdown, /RustConf ownership talk/);
assert.match(markdown, /来源：RustConf ownership talk/);
assert.match(markdown, /t=492s/);
assert.match(markdown, /链接：https:\/\/www\.youtube\.com\/watch\?v=rust123/);
assert.match(markdown, /类型：video/);
assert.match(markdown, /_中文：笔记_/);
assert.match(markdown, /_中文：摘录_/);
assert.match(markdown, /Review Cards/);
assert.match(markdown, /_中文：复习卡片_/);
assert.match(markdown, /问：/);
assert.match(markdown, /答：/);
const emptySessionMarkdown = generateMarkdown(createSession({ title: "Empty export topic" }, workspace.clientId));
assert.match(emptySessionMarkdown, /_No notes yet\._/);
assert.match(emptySessionMarkdown, /_还没有笔记。_/);
assert.match(emptySessionMarkdown, /_No captures yet\._/);
assert.match(emptySessionMarkdown, /_还没有摘录。_/);
const taggedSessionMarkdown = generateMarkdown(createSession({ title: "Tagged export topic", tags: ["rust", "memory"] }, workspace.clientId));
assert.match(taggedSessionMarkdown, /Tags: #rust #memory/);
assert.match(taggedSessionMarkdown, /标签：#rust #memory/);

const synthesis = generateSynthesisDraft(session);
assert.match(synthesis, /Synthesis - Rust ownership course/);
assert.match(synthesis, /综合草稿 - Rust ownership course/);
assert.match(synthesis, /Generated from 1 capture \/ 0 questions \/ 1 card/);
assert.match(synthesis, /生成自 1 条摘录 \/ 0 个问题 \/ 1 张卡片。/);
assert.match(synthesis, /链接：https:\/\/www\.youtube\.com\/watch\?v=rust123/);
assert.match(synthesis, /compile-time lifetime checks/);
assert.match(synthesis, /_中文：关键收获_/);
assert.match(synthesis, /证据：/);
assert.match(synthesis, /Review Targets/);
assert.match(synthesis, /_中文：复习目标_/);
const emptySynthesisDraft = generateSynthesisDraft(createSession({ title: "Empty synthesis topic" }, workspace.clientId));
assert.match(emptySynthesisDraft, /_中文：开放问题_/);
assert.match(emptySynthesisDraft, /不看资料时，我应该能回忆什么？/);
assert.match(emptySynthesisDraft, /哪个想法会改变我解决真实问题的方式？/);
assert.match(emptySynthesisDraft, /_中文：复习目标_/);
assert.match(emptySynthesisDraft, /把最有价值的摘录提升为复习卡片。/);

const focusNow = new Date("2026-05-29T00:20:00.000Z");
const questionSession = createSession({
  title: "Question parking",
  sourceUrl: "https://example.com/questions",
  captures: [{
    id: "question_capture",
    thought: "Why does ownership make aliasing safe？",
    quote: "Ownership constrains mutable aliases.",
    capturedAt: "2026-05-29T00:18:00.000Z"
  }],
  reviewCards: []
}, workspace.clientId);
const questionBrief = buildFocusBrief(questionSession, null, focusNow);
assert.equal(captureHasQuestion(questionSession.captures[0]), true);
assert.equal(captureHasOpenQuestion(questionSession.captures[0]), true);
assert.equal(getSynthesisStats(questionSession).questions, 1);
assert.equal(questionBrief.stats.questions, 1);
assert.equal(questionBrief.warnings.some((warning) => warning.kind === "open_questions"), true);
const questionWarning = questionBrief.warnings.find((warning) => warning.kind === "open_questions");
assert.equal(questionWarning.actionLabel, "Open questions");
assert.equal(questionWarning.targetTab, "today");
assert.equal(questionWarning.targetSection, "open_questions");
assert.match(generateSynthesisDraft(questionSession), /Why does ownership make aliasing safe？/);

const questionReviewSession = createSession({
  ...questionSession,
  reviewCards: [{
    id: "question_due_card",
    prompt: "Recall the open question context.",
    answer: "Use the captured question as evidence.",
    sourceCaptureId: "question_capture",
    dueAt: "2026-05-29T00:19:00.000Z",
    strength: 0,
    createdAt: "2026-05-29T00:19:00.000Z",
    updatedAt: "2026-05-29T00:19:00.000Z"
  }]
}, workspace.clientId);
const questionReviewBrief = buildFocusBrief(questionReviewSession, {
  ...workspace,
  activeSessionId: questionReviewSession.id,
  sessions: [questionReviewSession]
}, focusNow);
const questionReviewWarning = questionReviewBrief.warnings.find((warning) => warning.kind === "open_questions");
assert.equal(questionReviewBrief.nextAction.kind, "review");
assert.equal(questionReviewBrief.nextAction.reason, "Active topic has due review due now.");
assert.equal(questionReviewWarning.targetTab, "today");
assert.equal(questionReviewWarning.targetSection, "open_questions");

let questionLifecycleWorkspace = sanitizeWorkspace({
  ...createDefaultWorkspace(),
  activeSessionId: questionSession.id,
  sessions: [questionSession]
});
const questionCaptureId = questionSession.captures[0].id;
const questionReturnBaseFingerprint = buildReturnBaseFingerprint(questionLifecycleWorkspace);
assert.equal(buildReturnBaseFingerprint(questionLifecycleWorkspace), questionReturnBaseFingerprint);
assert.notEqual(buildReturnBaseFingerprint(setCaptureQuestionResolved(
  questionLifecycleWorkspace,
  questionSession.id,
  questionCaptureId,
  true
)), questionReturnBaseFingerprint);
let parkedQuestionWorkspace = setCaptureQuestionParked(
  questionLifecycleWorkspace,
  questionSession.id,
  questionCaptureId
);
let parkedQuestionSession = getActiveSession(parkedQuestionWorkspace);
const parkedQuestionCapture = parkedQuestionSession.captures[0];
assert.match(parkedQuestionCapture.questionParkedAt, /^\d{4}-\d{2}-\d{2}T/);
assert.equal(parkedQuestionCapture.questionResolvedAt, null);
assert.equal(captureHasOpenQuestion(parkedQuestionCapture), false);
assert.equal(captureHasParkedQuestion(parkedQuestionCapture), true);
assert.equal(getParkedQuestionItems(parkedQuestionWorkspace, 10).length, 1);
assert.equal(buildTodayPack(parkedQuestionWorkspace, focusNow).stats.questions, 0);
assert.equal(buildTodayPack(parkedQuestionWorkspace, focusNow).stats.parkedQuestions, 1);
assert.equal(buildTodayPack(parkedQuestionWorkspace, focusNow).questionItems.length, 0);
assert.equal(buildTodayPack(parkedQuestionWorkspace, focusNow).parkedQuestionItems.length, 1);
assert.equal(buildTodayPack(parkedQuestionWorkspace, focusNow).questionHealth.status, "parked_only");
assert.equal(buildTodayPack(parkedQuestionWorkspace, focusNow).questionHealth.unresolvedQuestions, 1);
assert.match(generateTodayMarkdown(parkedQuestionWorkspace, focusNow), /Parked Questions/);
assert.match(generateTodayMarkdown(parkedQuestionWorkspace, focusNow), /Question Queue Health/);
assert.match(generateTodayMarkdown(parkedQuestionWorkspace, focusNow), /Why does ownership make aliasing safe/);
assert.equal(buildFocusBrief(parkedQuestionSession, parkedQuestionWorkspace, focusNow).stats.questions, 0);
assert.equal(buildFocusBrief(parkedQuestionSession, parkedQuestionWorkspace, focusNow).warnings.some((warning) => warning.kind === "open_questions"), false);
const parkedQuestionSynthesisOpenQuestions = generateSynthesisDraft(parkedQuestionSession).split("### Open Questions")[1].split("### Review Targets")[0];
assert.doesNotMatch(parkedQuestionSynthesisOpenQuestions, /Why does ownership make aliasing safe/);
const roundTripParkedWorkspace = workspaceFromPortableData(JSON.parse(JSON.stringify(parkedQuestionWorkspace)));
assert.equal(captureHasParkedQuestion(getActiveSession(roundTripParkedWorkspace).captures[0]), true);
const resolvedFromParkedWorkspace = setCaptureQuestionResolved(
  parkedQuestionWorkspace,
  questionSession.id,
  questionCaptureId,
  true
);
const resolvedFromParkedCapture = getActiveSession(resolvedFromParkedWorkspace).captures[0];
assert.equal(captureHasParkedQuestion(resolvedFromParkedCapture), false);
assert.equal(resolvedFromParkedCapture.questionParkedAt, null);
assert.notEqual(resolvedFromParkedCapture.questionResolvedAt, null);
const reopenedFromParkedCapture = getActiveSession(setCaptureQuestionResolved(
  resolvedFromParkedWorkspace,
  questionSession.id,
  questionCaptureId,
  false
)).captures[0];
assert.equal(captureHasOpenQuestion(reopenedFromParkedCapture), true);
assert.equal(reopenedFromParkedCapture.questionParkedAt, null);
const illegalResolvedParkedWorkspace = workspaceFromPortableData(JSON.parse(JSON.stringify({
  ...parkedQuestionWorkspace,
  sessions: parkedQuestionWorkspace.sessions.map((sessionItem) => ({
    ...sessionItem,
    captures: sessionItem.captures.map((captureItem) => captureItem.id === questionCaptureId
      ? {
          ...captureItem,
          questionResolvedAt: "2026-05-29T00:30:00.000Z",
          questionParkedAt: "2026-05-29T00:29:00.000Z"
        }
      : captureItem)
  }))
})));
const illegalNormalizedCapture = getActiveSession(illegalResolvedParkedWorkspace).captures[0];
assert.equal(illegalNormalizedCapture.questionResolvedAt, "2026-05-29T00:30:00.000Z");
assert.equal(illegalNormalizedCapture.questionParkedAt, null);
assert.equal(setCaptureQuestionParked(
  illegalResolvedParkedWorkspace,
  questionSession.id,
  questionCaptureId,
  true
), illegalResolvedParkedWorkspace);
parkedQuestionWorkspace = setCaptureQuestionParked(
  parkedQuestionWorkspace,
  questionSession.id,
  questionCaptureId,
  false
);
assert.equal(getActiveSession(parkedQuestionWorkspace).captures[0].questionParkedAt, null);
assert.equal(captureHasOpenQuestion(getActiveSession(parkedQuestionWorkspace).captures[0]), true);
const localWeakAnswerWorkspace = addCapture(questionLifecycleWorkspace, questionSession.id, {
  id: "local_weak_answer_capture",
  quote: "Weak answer body.",
  thought: "Answer: ok",
  answersQuestionCaptureId: questionCaptureId
}, { now: "2026-05-29T00:30:30.000Z" });
const localWeakAnswerSession = getActiveSession(localWeakAnswerWorkspace);
assert.equal(localWeakAnswerSession.captures[0].answersQuestionCaptureId, questionCaptureId);
assert.equal(captureHasReviewReadyAnswer(localWeakAnswerSession.captures[0]), false);
assert.equal(captureHasOpenQuestion(localWeakAnswerSession.captures.find((capture) => capture.id === questionCaptureId)), true);
assert.equal(captureHasReviewReadyAnswer({
  thought: "Answer: supercalifragilistic",
  answersQuestionCaptureId: questionCaptureId
}), false);
const localAnswerWorkspace = addCapture(questionLifecycleWorkspace, questionSession.id, {
  id: "local_answer_capture",
  quote: "Ownership makes aliasing safe by enforcing one mutable owner.",
  thought: "Answer: the compiler rejects overlapping mutable aliases before runtime.",
  answersQuestionCaptureId: questionCaptureId
}, { now: "2026-05-29T00:31:30.000Z" });
const localAnswerSession = getActiveSession(localAnswerWorkspace);
const localAnsweredQuestion = localAnswerSession.captures.find((capture) => capture.id === questionCaptureId);
assert.equal(localAnswerSession.captures[0].answersQuestionCaptureId, questionCaptureId);
assert.equal(captureHasReviewReadyAnswer(localAnswerSession.captures[0]), true);
assert.equal(captureHasOpenQuestion(localAnsweredQuestion), false);
assert.equal(captureHasResolvedQuestion(localAnsweredQuestion), true);
assert.equal(localAnsweredQuestion.questionParkedAt, null);
assert.match(localAnsweredQuestion.questionResolvedAt, /^2026-05-29T00:31:30/);
const answerInboxPatch = {
  schema: MOBILE_INBOX_PATCH_SCHEMA,
  appVersion: WORKSPACE_SCHEMA_VERSION,
  patchId: "patch_answer_question_001",
  createdAt: "2026-05-29T00:31:00.000Z",
  source: {
    generatedBy: "inbox.html",
    workspaceFingerprint: "answer-test",
    topicId: questionSession.id,
    topicTitle: questionSession.title
  },
  target: {
    topicId: questionSession.id,
    topicTitle: questionSession.title
  },
  captures: [{
    id: "inbox_answer_capture_001",
    quote: "Ownership makes aliasing safe by enforcing one mutable owner.",
    thought: "Answer: the compiler rejects overlapping mutable aliases before runtime.",
    tags: "answer question",
    answersQuestionCaptureId: questionCaptureId,
    capturedAt: "2026-05-29T00:31:00.000Z"
  }]
};
const answerInboxResult = applyMobileInboxPatch(questionLifecycleWorkspace, answerInboxPatch, new Date("2026-05-29T00:32:00.000Z"));
const answerInboxSession = getActiveSession(answerInboxResult.workspace);
const answeredOriginalQuestion = answerInboxSession.captures.find((capture) => capture.id === questionCaptureId);
const importedAnswerCapture = answerInboxSession.captures.find((capture) => capture.inboxCaptureId === "inbox_answer_capture_001");
assert.equal(answerInboxResult.receipt.answeredQuestions, 1);
assert.equal(answerInboxResult.receipt.refreshableReviewCards, 0);
assert.equal(answerInboxResult.receipt.skippedAnswerTargets, 0);
assert.deepEqual(answerInboxResult.receipt.answerTargetSkips, {
  invalid: 0,
  selfReference: 0,
  patchReference: 0,
  missing: 0,
  nonQuestion: 0,
  alreadyClosed: 0
});
assert.equal(captureHasOpenQuestion(answeredOriginalQuestion), false);
assert.equal(captureHasResolvedQuestion(answeredOriginalQuestion), true);
assert.equal(answeredOriginalQuestion.questionParkedAt, null);
assert.match(answeredOriginalQuestion.questionResolvedAt, /^2026-05-29T00:32:00/);
assert.equal(importedAnswerCapture.answersQuestionCaptureId, questionCaptureId);
const promotedAnsweredQuestionWorkspace = promoteCapture(answerInboxResult.workspace, questionSession.id, questionCaptureId);
const promotedAnsweredQuestionSession = getActiveSession(promotedAnsweredQuestionWorkspace);
const promotedAnsweredQuestionCard = promotedAnsweredQuestionSession.reviewCards[0];
assert.equal(promotedAnsweredQuestionSession.captures.find((capture) => capture.id === questionCaptureId).promotedToReview, true);
assert.equal(promotedAnsweredQuestionCard.sourceCaptureId, questionCaptureId);
assert.equal(promotedAnsweredQuestionCard.evidenceCaptureId, importedAnswerCapture.id);
assert.match(promotedAnsweredQuestionCard.prompt, /Answer the question: Why does ownership make aliasing safe/);
assert.match(promotedAnsweredQuestionCard.answer, /compiler rejects overlapping mutable aliases/);
assert.match(promotedAnsweredQuestionCard.answer, /Evidence: Ownership makes aliasing safe/);
const evidenceDeletedQuestionWorkspace = deleteCapture(
  promotedAnsweredQuestionWorkspace,
  questionSession.id,
  promotedAnsweredQuestionCard.evidenceCaptureId
);
const evidenceDeletedQuestionCard = getActiveSession(evidenceDeletedQuestionWorkspace).reviewCards[0];
assert.equal(evidenceDeletedQuestionCard.sourceCaptureId, questionCaptureId);
assert.equal(evidenceDeletedQuestionCard.evidenceCaptureId, "");
const prePromotedQuestionWorkspace = promoteCapture(questionLifecycleWorkspace, questionSession.id, questionCaptureId);
const prePromotedQuestionCardId = getActiveSession(prePromotedQuestionWorkspace).reviewCards[0].id;
const answeredPrePromotedQuestion = applyMobileInboxPatch(prePromotedQuestionWorkspace, {
  ...answerInboxPatch,
  patchId: "patch_answer_question_pre_promoted",
  captures: [{
    ...answerInboxPatch.captures[0],
    id: "inbox_answer_capture_pre_promoted"
  }]
}, new Date("2026-05-29T00:33:30.000Z"));
assert.equal(answeredPrePromotedQuestion.receipt.answeredQuestions, 1);
assert.equal(answeredPrePromotedQuestion.receipt.refreshableReviewCards, 1);
const prePromotedAnswerCapture = getActiveSession(answeredPrePromotedQuestion.workspace)
  .captures.find((capture) => capture.inboxCaptureId === "inbox_answer_capture_pre_promoted");
const refreshedPrePromotedQuestion = promoteCapture(answeredPrePromotedQuestion.workspace, questionSession.id, questionCaptureId);
const refreshedPrePromotedSession = getActiveSession(refreshedPrePromotedQuestion);
assert.equal(refreshedPrePromotedSession.reviewCards.length, 1);
assert.equal(refreshedPrePromotedSession.reviewCards[0].id, prePromotedQuestionCardId);
assert.doesNotMatch(refreshedPrePromotedSession.reviewCards[0].prompt, /Answer the question:/);
assert.equal(refreshedPrePromotedSession.reviewCards[0].evidenceCaptureId, "");
assert.equal(refreshedPrePromotedSession.captures.find((capture) => capture.id === questionCaptureId).promotedToReview, true);
const answerRefreshedPrePromotedQuestion = refreshAnsweredQuestionReviewCard(
  answeredPrePromotedQuestion.workspace,
  questionSession.id,
  questionCaptureId
);
const answerRefreshedPrePromotedSession = getActiveSession(answerRefreshedPrePromotedQuestion);
assert.equal(answerRefreshedPrePromotedSession.reviewCards.length, 1);
assert.equal(answerRefreshedPrePromotedSession.reviewCards[0].id, prePromotedQuestionCardId);
assert.match(answerRefreshedPrePromotedSession.reviewCards[0].prompt, /Answer the question: Why does ownership make aliasing safe/);
assert.match(answerRefreshedPrePromotedSession.reviewCards[0].answer, /compiler rejects overlapping mutable aliases/);
assert.equal(answerRefreshedPrePromotedSession.reviewCards[0].evidenceCaptureId, prePromotedAnswerCapture.id);
assert.equal(answerRefreshedPrePromotedSession.reviewCards[0].dueAt, getActiveSession(prePromotedQuestionWorkspace).reviewCards[0].dueAt);
const answeredTodayPack = buildTodayPack(answerInboxResult.workspace, new Date("2026-05-29T00:32:30.000Z"), {
  resolvedQuestionLimit: 2
});
assert.equal(answeredTodayPack.stats.resolvedQuestionsToday, 1);
assert.equal(answeredTodayPack.stats.answerCapturesToday, 1);
assert.equal(answeredTodayPack.stats.questionReviewCards, 0);
assert.equal(answeredTodayPack.stats.questionReviewCardsToday, 0);
assert.equal(answeredTodayPack.resolvedQuestionItems.length, 1);
assert.equal(answeredTodayPack.resolvedQuestionItems[0].capture.id, questionCaptureId);
assert.equal(answeredTodayPack.resolvedQuestionItems[0].answerCapture.inboxCaptureId, "inbox_answer_capture_001");
assert.equal(answeredTodayPack.answerItems.length, 1);
assert.equal(answeredTodayPack.answerItems[0].capture.inboxCaptureId, "inbox_answer_capture_001");
assert.equal(answeredTodayPack.answerItems[0].questionCapture.id, questionCaptureId);
assert.equal(answeredTodayPack.questionLoop.resolvedQuestionsToday, 1);
assert.equal(answeredTodayPack.questionLoop.answerLinkedResolvedToday, 1);
assert.equal(answeredTodayPack.questionLoop.questionReviewCards, 0);
assert.equal(answeredTodayPack.questionLoop.questionReviewCardsToday, 0);
assert.equal(answeredTodayPack.questionLoop.targetSection, "closed_questions");
assert.match(answeredTodayPack.questionLoop.todayDetail, /1 answer-linked closure/);
assert.equal(getResolvedQuestionItems(answerInboxResult.workspace, 10, {
  since: new Date("2026-05-29T00:00:00.000Z"),
  until: new Date("2026-05-30T00:00:00.000Z")
}).length, 1);
assert.equal(getAnswerCaptureItems(answerInboxResult.workspace, 10, {
  since: new Date("2026-05-29T00:00:00.000Z"),
  until: new Date("2026-05-30T00:00:00.000Z")
}).length, 1);
const answeredTodayMarkdown = generateTodayMarkdown(answerInboxResult.workspace, new Date("2026-05-29T00:32:30.000Z"));
assert.match(answeredTodayMarkdown, /Closed Today/);
assert.match(answeredTodayMarkdown, /今日关闭/);
assert.match(answeredTodayMarkdown, /Answers Today/);
assert.match(answeredTodayMarkdown, /今日回答/);
assert.match(answeredTodayMarkdown, /answers today/);
assert.match(answeredTodayMarkdown, /今日回答/);
assert.match(answeredTodayMarkdown, /1 closed today/);
assert.match(answeredTodayMarkdown, /1 个今日关闭/);
assert.match(answeredTodayMarkdown, /Why does ownership make aliasing safe/);
assert.match(answeredTodayMarkdown, /Answer: the compiler rejects overlapping mutable aliases before runtime/);
assert.match(answeredTodayMarkdown, /回答：the compiler rejects overlapping mutable aliases before runtime/);
assert.match(answeredTodayMarkdown, /Reason: linked-question/);
assert.match(answeredTodayMarkdown, /原因：linked-question/);
assert.match(answeredTodayMarkdown, /Answers: Why does ownership make aliasing safe/);
assert.match(answeredTodayMarkdown, /回答问题：Why does ownership make aliasing safe/);
assert.match(answeredTodayMarkdown, /## Answers Today[\s\S]+## Closed Today/);
assert.doesNotMatch(answeredTodayMarkdown, /Answer: Answer:/);
const reopenedAfterAnswerWorkspace = setCaptureQuestionResolved(
  answerInboxResult.workspace,
  questionSession.id,
  questionCaptureId,
  false
);
const reopenedAfterAnswerPack = buildTodayPack(reopenedAfterAnswerWorkspace, new Date("2026-05-29T00:40:00.000Z"));
assert.equal(reopenedAfterAnswerPack.stats.resolvedQuestionsToday, 0);
assert.equal(reopenedAfterAnswerPack.resolvedQuestionItems.length, 0);
assert.equal(reopenedAfterAnswerPack.stats.questions, 1);
assert.equal(reopenedAfterAnswerPack.questionLoop.activeQuestions, 1);
assert.equal(reopenedAfterAnswerPack.questionLoop.targetSection, "open_questions");
assert.equal(reopenedAfterAnswerPack.questionItems[0].capture.id, questionCaptureId);
const reansweredQuestionResult = applyMobileInboxPatch(reopenedAfterAnswerWorkspace, {
  ...answerInboxPatch,
  patchId: "patch_answer_question_reresolve",
  createdAt: "2026-05-29T14:00:00.000Z",
  captures: [{
    ...answerInboxPatch.captures[0],
    id: "inbox_answer_capture_reresolve",
    capturedAt: "2026-05-29T14:00:00.000Z"
  }]
}, new Date("2026-05-29T14:01:00.000Z"));
const reansweredPack = buildTodayPack(reansweredQuestionResult.workspace, new Date("2026-05-29T14:02:00.000Z"));
assert.equal(reansweredPack.stats.resolvedQuestionsToday, 1);
assert.equal(reansweredPack.resolvedQuestionItems.length, 1);
assert.match(reansweredPack.resolvedQuestionItems[0].capture.questionResolvedAt, /^2026-05-29T14:01:00/);
const answeredQuestionCardFixture = workspaceFromPortableData({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  clientId: "client_answered_question_cards",
  activeSessionId: "answered_card_topic",
  sessions: [{
    id: "answered_card_topic",
    title: "Answered card semantics",
    captures: [{
      id: "q_prefixed_question",
      quote: "",
      thought: "Q: Which invariant survives stale heap entries?",
      tags: ["question"],
      capturedAt: "2099-01-02T10:00:00.000Z",
      createdAt: "2099-01-02T10:00:00.000Z",
      updatedAt: "2099-01-02T10:00:00.000Z",
      questionResolvedAt: "2099-01-02T12:10:00.000Z"
    }, {
      id: "answer_captured_earlier",
      quote: "Stale heap entries are ignored when popped.",
      thought: "Answer: discard entries whose distance no longer matches the best-known distance.",
      answersQuestionCaptureId: "q_prefixed_question",
      capturedAt: "2099-01-02T11:00:00.000Z",
      createdAt: "2099-01-02T13:00:00.000Z",
      updatedAt: "2099-01-02T13:00:00.000Z"
    }, {
      id: "answer_created_only",
      quote: "Final invariant: distances are only committed when popped fresh.",
      thought: "",
      answersQuestionCaptureId: "q_prefixed_question",
      createdAt: "2099-01-02T12:00:00.000Z",
      updatedAt: "2099-01-02T12:00:00.000Z"
    }, {
      id: "answer_weak_latest",
      thought: "Answer: ok",
      answersQuestionCaptureId: "q_prefixed_question",
      capturedAt: "2099-01-02T13:00:00.000Z",
      createdAt: "2099-01-02T13:00:00.000Z",
      updatedAt: "2099-01-02T13:00:00.000Z"
    }],
    reviewCards: []
  }]
});
const promotedQPrefixedQuestion = promoteCapture(answeredQuestionCardFixture, "answered_card_topic", "q_prefixed_question");
const qPrefixedQuestionCard = getActiveSession(promotedQPrefixedQuestion).reviewCards[0];
assert.match(qPrefixedQuestionCard.prompt, /Answer the question: Which invariant survives stale heap entries\?/);
assert.doesNotMatch(qPrefixedQuestionCard.prompt, /Answer the question: Q:/);
assert.match(qPrefixedQuestionCard.answer, /Final invariant: distances are only committed when popped fresh/);
assert.doesNotMatch(qPrefixedQuestionCard.answer, /Answer: ok/);
assert.doesNotMatch(qPrefixedQuestionCard.answer, /discard entries whose distance/);
assert.doesNotMatch(qPrefixedQuestionCard.answer, /Evidence:/);
assert.equal(qPrefixedQuestionCard.evidenceCaptureId, "answer_created_only");
const weakOnlyAnswerCardFixture = workspaceFromPortableData({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  clientId: "client_weak_answered_question",
  activeSessionId: "weak_answered_card_topic",
  sessions: [{
    id: "weak_answered_card_topic",
    title: "Weak answered card semantics",
    captures: [{
      id: "weak_answer_question",
      quote: "The derivation needs a stable invariant.",
      thought: "Question: What invariant should I keep?",
      tags: ["question"],
      capturedAt: "2099-01-02T10:00:00.000Z",
      createdAt: "2099-01-02T10:00:00.000Z",
      updatedAt: "2099-01-02T10:00:00.000Z",
      questionResolvedAt: "2099-01-02T11:00:00.000Z"
    }, {
      id: "weak_answer_only",
      thought: "Answer: ok",
      answersQuestionCaptureId: "weak_answer_question",
      capturedAt: "2099-01-02T11:00:00.000Z",
      createdAt: "2099-01-02T11:00:00.000Z",
      updatedAt: "2099-01-02T11:00:00.000Z"
    }],
    reviewCards: []
  }]
});
const weakOnlyAnswerCard = getActiveSession(promoteCapture(weakOnlyAnswerCardFixture, "weak_answered_card_topic", "weak_answer_question")).reviewCards[0];
assert.doesNotMatch(weakOnlyAnswerCard.prompt, /Answer the question:/);
assert.doesNotMatch(weakOnlyAnswerCard.answer, /Answer: ok/);
assert.equal(weakOnlyAnswerCard.evidenceCaptureId, "");
const tiedAnswerCardFixture = workspaceFromPortableData({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  clientId: "client_answered_question_tie",
  activeSessionId: "answered_card_tie_topic",
  sessions: [{
    id: "answered_card_tie_topic",
    title: "Answered card tie semantics",
    captures: [{
      id: "tie_question",
      thought: "Question: Which equal-timestamp answer wins?",
      tags: ["question"],
      capturedAt: "2099-01-02T10:00:00.000Z",
      createdAt: "2099-01-02T10:00:00.000Z",
      updatedAt: "2099-01-02T10:00:00.000Z",
      questionResolvedAt: "2099-01-02T12:10:00.000Z"
    }, {
      id: "answer_a",
      thought: "Answer: lower lexical id should lose the deterministic tie.",
      answersQuestionCaptureId: "tie_question",
      capturedAt: "2099-01-02T12:00:00.000Z",
      createdAt: "2099-01-02T12:00:00.000Z",
      updatedAt: "2099-01-02T12:00:00.000Z"
    }, {
      id: "answer_z",
      thought: "Answer: higher lexical id wins the deterministic tie.",
      answersQuestionCaptureId: "tie_question",
      capturedAt: "2099-01-02T12:00:00.000Z",
      createdAt: "2099-01-02T12:00:00.000Z",
      updatedAt: "2099-01-02T12:00:00.000Z"
    }],
    reviewCards: []
  }]
});
const tiedAnswerCard = getActiveSession(promoteCapture(tiedAnswerCardFixture, "answered_card_tie_topic", "tie_question")).reviewCards[0];
assert.match(tiedAnswerCard.prompt, /Answer the question: Which equal-timestamp answer wins\?/);
assert.match(tiedAnswerCard.answer, /higher lexical id wins/);
assert.doesNotMatch(tiedAnswerCard.answer, /lower lexical id/);
assert.equal(tiedAnswerCard.evidenceCaptureId, "answer_z");
const duplicateAnswerInboxResult = applyMobileInboxPatch(answerInboxResult.workspace, answerInboxPatch, new Date("2026-05-29T00:32:30.000Z"));
assert.equal(duplicateAnswerInboxResult.receipt.targetResolution, "duplicate-patch");
assert.equal(duplicateAnswerInboxResult.receipt.answeredQuestions, 0);
assert.equal(duplicateAnswerInboxResult.receipt.refreshableReviewCards, 0);
assert.equal(duplicateAnswerInboxResult.receipt.skippedAnswerTargets, 0);
const alreadyClosedAnswerResult = applyMobileInboxPatch(answerInboxResult.workspace, {
  ...answerInboxPatch,
  patchId: "patch_answer_question_already_closed",
  captures: [{
    ...answerInboxPatch.captures[0],
    id: "inbox_answer_capture_already_closed"
  }]
}, new Date("2026-05-29T00:32:45.000Z"));
assert.equal(alreadyClosedAnswerResult.receipt.answeredQuestions, 0);
assert.equal(alreadyClosedAnswerResult.receipt.skippedAnswerTargets, 1);
assert.equal(alreadyClosedAnswerResult.receipt.answerTargetSkips.alreadyClosed, 1);
const badAnswerTargetPatch = {
  ...answerInboxPatch,
  patchId: "patch_answer_question_missing",
  captures: [{
    ...answerInboxPatch.captures[0],
    id: "inbox_answer_capture_missing",
    answersQuestionCaptureId: "missing_question_capture"
  }]
};
const badAnswerTargetResult = applyMobileInboxPatch(questionLifecycleWorkspace, badAnswerTargetPatch, new Date("2026-05-29T00:33:00.000Z"));
assert.equal(badAnswerTargetResult.receipt.answeredQuestions, 0);
assert.equal(badAnswerTargetResult.receipt.skippedAnswerTargets, 1);
assert.equal(badAnswerTargetResult.receipt.answerTargetSkips.missing, 1);
assert.equal(captureHasOpenQuestion(getActiveSession(badAnswerTargetResult.workspace).captures.find((capture) => capture.id === questionCaptureId)), true);
const answerTargetGuardPatch = {
  ...answerInboxPatch,
  patchId: "patch_answer_question_guards",
  captures: [{
    ...answerInboxPatch.captures[0],
    id: "self_ref_capture",
    answersQuestionCaptureId: "self_ref_capture"
  }, {
    ...answerInboxPatch.captures[0],
    id: "batch_target_capture",
    answersQuestionCaptureId: questionCaptureId
  }, {
    ...answerInboxPatch.captures[0],
    id: "batch_ref_capture",
    answersQuestionCaptureId: "batch_target_capture"
  }, {
    ...answerInboxPatch.captures[0],
    id: "invalid_target_capture",
    answersQuestionCaptureId: `${"x".repeat(129)}!`
  }]
};
const answerTargetGuardResult = applyMobileInboxPatch(questionLifecycleWorkspace, answerTargetGuardPatch, new Date("2026-05-29T00:34:00.000Z"));
assert.equal(answerTargetGuardResult.receipt.added, 4);
assert.equal(answerTargetGuardResult.receipt.answeredQuestions, 1);
assert.equal(answerTargetGuardResult.receipt.skippedAnswerTargets, 3);
assert.equal(answerTargetGuardResult.receipt.answerTargetSkips.selfReference, 1);
assert.equal(answerTargetGuardResult.receipt.answerTargetSkips.patchReference, 1);
assert.equal(answerTargetGuardResult.receipt.answerTargetSkips.invalid, 1);
const crossTopicWorkspace = addSession(questionLifecycleWorkspace, "Different question answer target");
const crossTopicId = crossTopicWorkspace.sessions.find((item) => item.title === "Different question answer target").id;
const crossTopicAnswerResult = applyMobileInboxPatch(crossTopicWorkspace, {
  ...answerInboxPatch,
  patchId: "patch_answer_question_cross_topic",
  target: { topicId: crossTopicId, topicTitle: "Different question answer target" },
  captures: [{
    ...answerInboxPatch.captures[0],
    id: "inbox_answer_capture_cross_topic"
  }]
}, new Date("2026-05-29T00:35:00.000Z"));
assert.equal(crossTopicAnswerResult.receipt.answeredQuestions, 0);
assert.equal(crossTopicAnswerResult.receipt.skippedAnswerTargets, 1);
assert.equal(crossTopicAnswerResult.receipt.answerTargetSkips.missing, 1);
assert.equal(captureHasOpenQuestion(crossTopicAnswerResult.workspace.sessions.find((item) => item.id === questionSession.id).captures.find((capture) => capture.id === questionCaptureId)), true);
questionLifecycleWorkspace = setCaptureQuestionResolved(
  questionLifecycleWorkspace,
  questionSession.id,
  questionCaptureId
);
let questionLifecycleSession = getActiveSession(questionLifecycleWorkspace);
const resolvedQuestionTimestamp = questionLifecycleSession.captures[0].questionResolvedAt;
assert.equal(captureHasQuestion(questionLifecycleSession.captures[0]), true);
assert.equal(captureHasOpenQuestion(questionLifecycleSession.captures[0]), false);
assert.match(resolvedQuestionTimestamp, /^\d{4}-\d{2}-\d{2}T/);
assert.equal(getSynthesisStats(questionLifecycleSession).questions, 0);
assert.equal(buildFocusBrief(questionLifecycleSession, questionLifecycleWorkspace, focusNow).stats.questions, 0);
assert.equal(buildTodayPack(questionLifecycleWorkspace, focusNow).stats.questions, 0);
assert.equal(buildTodayPack(questionLifecycleWorkspace, focusNow).questionItems.length, 0);
const resolvedQuestionSynthesis = generateSynthesisDraft(questionLifecycleSession);
const resolvedQuestionOpenQuestions = resolvedQuestionSynthesis.split("### Open Questions")[1].split("### Review Targets")[0];
assert.match(resolvedQuestionSynthesis, /Generated from 1 capture \/ 0 questions \/ 0 cards/);
assert.doesNotMatch(resolvedQuestionOpenQuestions, /Why does ownership make aliasing safe/);
assert.equal(setCaptureQuestionResolved(
  questionLifecycleWorkspace,
  questionSession.id,
  questionCaptureId
), questionLifecycleWorkspace);
const roundTripResolvedWorkspace = workspaceFromPortableData(JSON.parse(JSON.stringify(questionLifecycleWorkspace)));
const roundTripResolvedSession = getActiveSession(roundTripResolvedWorkspace);
assert.equal(roundTripResolvedSession.captures[0].questionResolvedAt, resolvedQuestionTimestamp);
assert.equal(captureHasOpenQuestion(roundTripResolvedSession.captures[0]), false);
questionLifecycleWorkspace = setCaptureQuestionResolved(
  questionLifecycleWorkspace,
  questionSession.id,
  questionCaptureId,
  false
);
questionLifecycleSession = getActiveSession(questionLifecycleWorkspace);
assert.equal(captureHasOpenQuestion(questionLifecycleSession.captures[0]), true);
assert.equal(questionLifecycleSession.captures[0].questionResolvedAt, null);
assert.equal(buildTodayPack(questionLifecycleWorkspace, focusNow).stats.questions, 1);
assert.equal(setCaptureQuestionResolved(
  questionLifecycleWorkspace,
  questionSession.id,
  questionCaptureId,
  false
), questionLifecycleWorkspace);
const legacyQuestionWorkspace = sanitizeWorkspace({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  version: WORKSPACE_SCHEMA_VERSION,
  clientId: "legacy_question_client",
  activeSessionId: "legacy_question_session",
  createdAt: "2026-05-29T00:00:00.000Z",
  updatedAt: "2026-05-29T00:00:00.000Z",
  sessions: [{
    id: "legacy_question_session",
    originClientId: "legacy_question_client",
    title: "Legacy question topic",
    sourceTitle: "",
    sourceUrl: "",
    materialType: "article",
    tags: [],
    focusMode: "capture",
    notesMarkdown: "",
    captures: [{
      id: "legacy_question_capture",
      originClientId: "legacy_question_client",
      quote: "",
      thought: "Why does this old workspace still count?",
      timestamp: "",
      tags: [],
      createdAt: "2026-05-29T00:00:00.000Z",
      capturedAt: "2026-05-29T00:00:00.000Z",
      updatedAt: "2026-05-29T00:00:00.000Z",
      promotedToReview: false
    }],
    reviewCards: [],
    createdAt: "2026-05-29T00:00:00.000Z",
    updatedAt: "2026-05-29T00:00:00.000Z"
  }]
});
assert.equal(getActiveSession(legacyQuestionWorkspace).captures[0].questionResolvedAt, null);
assert.equal(getActiveSession(legacyQuestionWorkspace).captures[0].questionParkedAt, null);
assert.equal(captureHasOpenQuestion(getActiveSession(legacyQuestionWorkspace).captures[0]), true);

const statementSession = createSession({
  title: "No question parking",
  sourceUrl: "https://example.com/statements",
  captures: [{
    id: "statement_capture",
    thought: "Ownership constrains aliases without an explicit question.",
    capturedAt: "2026-05-29T00:18:30.000Z"
  }],
  reviewCards: []
}, workspace.clientId);
const statementBrief = buildFocusBrief(statementSession, null, focusNow);
assert.equal(captureHasQuestion(statementSession.captures[0]), false);
assert.equal(getSynthesisStats(statementSession).questions, 0);
assert.equal(statementBrief.stats.questions, 0);
assert.equal(statementBrief.warnings.some((warning) => warning.kind === "open_questions"), false);
assert.equal(captureHasQuestion({ thought: "Question: why ownership matters" }), true);
assert.equal(captureHasQuestion({ thought: "Q: ownership matters" }), true);
assert.equal(captureHasQuestion({ thought: "Question: " }), false);

const urlCodeSession = createSession({
  title: "Question false positives",
  sourceUrl: "https://example.com/question-false-positives",
  captures: [
    {
      id: "url_capture",
      thought: "Reference https://example.com/course?unit=1 before the next section.",
      capturedAt: "2026-05-29T00:18:40.000Z"
    },
    {
      id: "inline_code_capture",
      thought: "Try `value?.prop` in the console.",
      capturedAt: "2026-05-29T00:18:50.000Z"
    },
    {
      id: "fenced_code_capture",
      thought: "```\nfetch('/api?debug=1')\n```",
      capturedAt: "2026-05-29T00:19:00.000Z"
    }
  ],
  reviewCards: []
}, workspace.clientId);
const urlCodeBrief = buildFocusBrief(urlCodeSession, null, focusNow);
assert.equal(urlCodeSession.captures.every((capture) => !captureHasQuestion(capture)), true);
assert.equal(getSynthesisStats(urlCodeSession).questions, 0);
assert.equal(urlCodeBrief.stats.questions, 0);
assert.equal(urlCodeBrief.warnings.some((warning) => warning.kind === "open_questions"), false);
const urlCodeSynthesis = generateSynthesisDraft(urlCodeSession);
const urlCodeOpenQuestions = urlCodeSynthesis.split("### Open Questions")[1].split("### Review Targets")[0];
assert.match(urlCodeSynthesis, /Generated from 3 captures \/ 0 questions \/ 0 cards/);
assert.doesNotMatch(urlCodeOpenQuestions, /https:\/\/example\.com/);
assert.doesNotMatch(urlCodeOpenQuestions, /value\?\.prop/);
assert.doesNotMatch(urlCodeOpenQuestions, /api\?debug/);

const mixedQuestionSession = createSession({
  title: "Questions with code and links",
  sourceUrl: "https://example.com/mixed-questions",
  captures: [
    {
      id: "url_question_capture",
      thought: "Why does https://example.com/course?unit=1 still load slowly?",
      capturedAt: "2026-05-29T00:19:10.000Z"
    },
    {
      id: "code_question_capture",
      thought: "Does `value?.prop` short-circuit when value is null?",
      capturedAt: "2026-05-29T00:19:20.000Z"
    }
  ],
  reviewCards: []
}, workspace.clientId);
const mixedQuestionSynthesis = generateSynthesisDraft(mixedQuestionSession);
assert.equal(mixedQuestionSession.captures.every((capture) => captureHasQuestion(capture)), true);
assert.equal(getSynthesisStats(mixedQuestionSession).questions, 2);
assert.match(mixedQuestionSynthesis, /Why does https:\/\/example\.com\/course\?unit=1 still load slowly\?/);
assert.match(mixedQuestionSynthesis, /Does `value\?\.prop` short-circuit when value is null\?/);

const emptySynthesis = generateSynthesisDraft(createSession({ title: "Empty topic" }, workspace.clientId));
assert.match(emptySynthesis, /No captures yet/);
assert.deepEqual(getSynthesisStats(session), { captures: 1, questions: 0, cards: 1 });

const dueFocusBrief = buildFocusBrief(session, workspace, focusNow);
assert.equal(dueFocusBrief.schema, "learning-companion.focus-brief.v1");
assert.equal(dueFocusBrief.nextAction.kind, "review");
assert.equal(dueFocusBrief.nextAction.reason, "Active topic has due review due now.");
assert.match(generateReviewPackMarkdown(workspace), /Why: Active topic has due review due now\./);
assert.equal(dueFocusBrief.stats.dueCards, 1);
assert.equal(dueFocusBrief.source.href, "https://www.youtube.com/watch?v=rust123&t=492s");
assert.equal(dueFocusBrief.source.provenance, "session");
assert.deepEqual(dueFocusBrief.source, buildResumeSource(session));
assert.equal(buildResumeSource(session).href, "https://www.youtube.com/watch?v=rust123&t=492s");
assert.equal(buildResumeSource(session, "09:00").href, "https://www.youtube.com/watch?v=rust123&t=540s");
assert.equal(buildResumeSource(session, "not a timestamp").href, "https://www.youtube.com/watch?v=rust123&t=492s");
assert.match(generateTodayMarkdown(workspace, focusNow), /Source: \[RustConf ownership talk\]\(https:\/\/www\.youtube\.com\/watch\?v=rust123&t=492s\)/);
assert.match(generateTodayMarkdown(workspace, focusNow), /来源：\[RustConf ownership talk\]\(https:\/\/www\.youtube\.com\/watch\?v=rust123&t=492s\)/);
const noCaptureSession = createSession({
  title: "Source without captures",
  sourceTitle: "Readable source",
  sourceUrl: "https://example.com/guide"
}, workspace.clientId);
const noCaptureSourceBrief = buildFocusBrief(noCaptureSession, null, focusNow);
assert.equal(noCaptureSourceBrief.source.href, "https://example.com/guide");
assert.equal(noCaptureSourceBrief.source.provenance, "session");
assert.deepEqual(noCaptureSourceBrief.source, buildResumeSource(noCaptureSession));
const noTimestampSourceBrief = buildFocusBrief(createSession({
  title: "Source with untimed capture",
  sourceTitle: "Video without timestamp",
  sourceUrl: "https://www.youtube.com/watch?v=notimed",
  captures: [{ id: "notimed_capture", quote: "No timestamp yet", thought: "", timestamp: "", capturedAt: "2026-05-29T00:19:00.000Z" }]
}, workspace.clientId), null, focusNow);
assert.equal(noTimestampSourceBrief.source.href, "https://www.youtube.com/watch?v=notimed");
const articleResumeSession = createSession({
  title: "Article resume",
  sourceTitle: "Article guide",
  sourceUrl: "https://example.com/article-guide#section-two",
  materialType: "article",
  captures: [{
    id: "article_capture",
    quote: "This exact passage should reopen near the sidecar capture.",
    thought: "This thought is not used as a source anchor.",
    timestamp: "",
    capturedAt: "2026-05-29T00:19:00.000Z"
  }]
}, workspace.clientId);
assert.equal(
  buildResumeSource(articleResumeSession).href,
  "https://example.com/article-guide#section-two:~:text=This%20exact%20passage%20should%20reopen%20near%20the%20sidecar%20capture."
);
assert.equal(buildResumeSource(articleResumeSession).hasTextFragment, true);
assert.equal(
  buildResumeSource(articleResumeSession, "01:00").href,
  "https://example.com/article-guide#section-two"
);
assert.equal(buildResumeSource(articleResumeSession, "01:00").hasTextFragment, false);
const linkedAnswerResumeSession = createSession({
  title: "Linked answer resume",
  sourceTitle: "Article guide",
  sourceUrl: "https://example.com/answer-source",
  materialType: "article",
  captures: [{
    id: "linked_answer_capture",
    quote: "Question: Which compiler rule matters?",
    thought: "Answer: The ownership rule matters.",
    answersQuestionCaptureId: "question_capture",
    timestamp: "",
    capturedAt: "2026-05-29T00:19:00.000Z"
  }]
}, workspace.clientId);
assert.equal(buildResumeSource(linkedAnswerResumeSession).href, "https://example.com/answer-source");
assert.equal(buildResumeSource(linkedAnswerResumeSession).hasTextFragment, false);
const competingCaptureSession = createSession({
  title: "Capture override resume",
  sourceTitle: "Article guide",
  sourceUrl: "https://example.com/competing-source",
  materialType: "article",
  captures: [
    {
      id: "older_capture",
      quote: "Older quote should own this explicit resume target.",
      thought: "",
      timestamp: "",
      capturedAt: "2026-05-29T00:18:00.000Z"
    },
    {
      id: "newer_capture",
      quote: "Newer quote should not steal an explicit capture resume target.",
      thought: "",
      timestamp: "",
      capturedAt: "2026-05-29T00:19:00.000Z"
    }
  ]
}, workspace.clientId);
assert.equal(
  buildResumeSource(competingCaptureSession, "", competingCaptureSession.captures[0]).href,
  "https://example.com/competing-source#:~:text=Older%20quote%20should%20own%20this%20explicit%20resume%20target."
);
assert.equal(
  buildResumeSource(competingCaptureSession).href,
  "https://example.com/competing-source#:~:text=Newer%20quote%20should%20not%20steal%20an%20explicit%20capture%20resume%20target."
);
const captureFallbackSession = createSession({
  title: "Source fallback",
  captures: [{
    id: "fallback_capture",
    quote: "Fallback source capture",
    thought: "",
    timestamp: "00:30",
    sourceTitle: "Fallback video",
    sourceUrl: "https://youtu.be/fallback",
    capturedAt: "2026-05-29T00:19:00.000Z"
  }]
}, workspace.clientId);
const captureFallbackBrief = buildFocusBrief(captureFallbackSession, null, focusNow);
assert.equal(captureFallbackBrief.source.href, "https://youtu.be/fallback?t=30s");
assert.equal(captureFallbackBrief.source.title, "Fallback video");
assert.equal(captureFallbackBrief.source.provenance, "latest_capture_fallback");
assert.deepEqual(captureFallbackBrief.source, buildResumeSource(captureFallbackSession));
assert.equal(buildResumeSource(captureFallbackSession).href, "https://youtu.be/fallback?t=30s");
assert.deepEqual(resolveCaptureDraftFocusOverride(dueFocusBrief, {
  quote: "A fresh draft should not outrank review.",
  updatedAt: "2026-05-29T00:19:00.000Z"
}, focusNow), {
  schema: "learning-companion.capture-draft-focus.v1",
  shouldOverride: false,
  hasText: true,
  isFresh: true,
  blockedByReview: true,
  maxAgeHours: 24
});
const synthesizeBrief = buildFocusBrief(createSession({
  id: "focus_synthesize",
  title: "Synthesis needed",
  sourceUrl: "https://example.com/course",
  captures: [
    { id: "cap_a", thought: "First idea", capturedAt: "2026-05-29T00:00:00.000Z" },
    { id: "cap_b", thought: "Second idea?", capturedAt: "2026-05-29T00:01:00.000Z" },
    { id: "cap_c", thought: "Third idea", capturedAt: "2026-05-29T00:02:00.000Z" }
  ],
  reviewCards: []
}, workspace.clientId), null, focusNow);
assert.equal(synthesizeBrief.nextAction.kind, "synthesize");
assert.equal(synthesizeBrief.nextAction.reason, "Unsynthesized captures reached the compression threshold.");
assert.equal(synthesizeBrief.stats.capturesSinceLastSynthesis, 3);
assert.equal(synthesizeBrief.stats.questions, 1);
assert.equal(synthesizeBrief.warnings.some((warning) => warning.kind === "needs_synthesis"), true);
assert.equal(synthesizeBrief.warnings.some((warning) => warning.kind === "open_questions"), true);
assert.equal(resolveCaptureDraftFocusOverride(synthesizeBrief, {
  thought: "Fresh draft can outrank synthesis.",
  updatedAt: "2026-05-29T00:19:00.000Z"
}, focusNow).shouldOverride, true);
assert.equal(resolveCaptureDraftFocusOverride(synthesizeBrief, {
  thought: "Stale draft stays in Today only.",
  updatedAt: "2026-05-27T00:19:00.000Z"
}, focusNow).shouldOverride, false);
assert.equal(resolveCaptureDraftFocusOverride(synthesizeBrief, {
  timestamp: "08:12",
  updatedAt: "2026-05-29T00:19:00.000Z"
}, focusNow).shouldOverride, false);
assert.equal(resolveCaptureDraftFocusOverride(synthesizeBrief, {
  thought: "Future-dated drafts should not own focus.",
  updatedAt: "2026-05-30T00:19:00.000Z"
}, focusNow).shouldOverride, false);
const oldCaptureBrief = buildFocusBrief(createSession({
  id: "focus_capture",
  title: "Capture next",
  sourceUrl: "https://example.com/course",
  captures: [{ id: "cap_old", thought: "Older thought", capturedAt: "2026-05-29T00:00:00.000Z" }],
  reviewCards: []
}, workspace.clientId), null, focusNow);
assert.equal(oldCaptureBrief.nextAction.kind, "capture");
assert.equal(oldCaptureBrief.nextAction.reason, "The source is available and the session has gone quiet.");
const recentCaptureBrief = buildFocusBrief(createSession({
  id: "focus_continue",
  title: "Continue reading",
  sourceUrl: "https://example.com/course",
  captures: [{ id: "cap_recent", thought: "Fresh thought", capturedAt: "2026-05-29T00:15:00.000Z" }],
  reviewCards: []
}, workspace.clientId), null, focusNow);
assert.equal(recentCaptureBrief.nextAction.kind, "continue");
assert.equal(recentCaptureBrief.nextAction.reason, "A recent capture exists, so the best next step is to keep reading.");
const noSourceBrief = buildFocusBrief(createSession({ id: "focus_no_source", title: "No source" }, workspace.clientId), null, focusNow);
assert.equal(noSourceBrief.nextAction.kind, "open_source");
assert.equal(noSourceBrief.nextAction.reason, "Source context is missing, so captures would be hard to revisit.");
assert.equal(noSourceBrief.warnings.some((warning) => warning.kind === "missing_source"), true);
const unsafeSourceBrief = buildFocusBrief(createSession({
  id: "focus_unsafe_source",
  title: "Unsafe source",
  sourceUrl: "javascript:alert(1)",
  captures: []
}, workspace.clientId), null, focusNow);
assert.equal(unsafeSourceBrief.source.href, "");
assert.equal(unsafeSourceBrief.nextAction.kind, "open_source");
let synthesizedSession = createSession({
  id: "focus_synthesized",
  title: "Synthesized",
  sourceUrl: "https://example.com/course",
  captures: [
    { id: "done_a", thought: "First idea", capturedAt: "2026-05-29T00:00:00.000Z" },
    { id: "done_b", thought: "Second idea", capturedAt: "2026-05-29T00:01:00.000Z" },
    { id: "done_c", thought: "Third idea", capturedAt: "2026-05-29T00:02:00.000Z" }
  ],
  reviewCards: []
}, workspace.clientId);
synthesizedSession = {
  ...synthesizedSession,
  notesMarkdown: [
    "<!-- learning-companion:synthesis:start -->",
    `<!-- learning-companion:synthesis-source:${getSynthesisSourceStamp(synthesizedSession)} -->`,
    "Done",
    "<!-- learning-companion:synthesis:end -->"
  ].join("\n")
};
const synthesizedBrief = buildFocusBrief(synthesizedSession, null, focusNow);
assert.equal(synthesizedBrief.stats.capturesSinceLastSynthesis, 0);
assert.equal(synthesizedBrief.warnings.some((warning) => warning.kind === "needs_synthesis"), false);
assert.equal(getSynthesisSourceStamp({
  ...synthesizedSession,
  captures: [...synthesizedSession.captures].reverse(),
  reviewCards: [...synthesizedSession.reviewCards].reverse()
}), getSynthesisSourceStamp(synthesizedSession));
const evidenceStampSession = {
  ...synthesizedSession,
  reviewCards: [{
    id: "stamp_card",
    prompt: "Same prompt",
    answer: "Same answer",
    sourceCaptureId: "done_a",
    evidenceCaptureId: "answer_a",
    updatedAt: "2026-05-29T00:03:00.000Z"
  }]
};
assert.notEqual(getSynthesisSourceStamp(evidenceStampSession), getSynthesisSourceStamp({
  ...evidenceStampSession,
  reviewCards: [{
    ...evidenceStampSession.reviewCards[0],
    evidenceCaptureId: "answer_b"
  }]
}));
const staleSynthesisBrief = buildFocusBrief({
  ...synthesizedSession,
  captures: [
    { id: "new_after_synth", thought: "New idea after the old synthesis", capturedAt: "2026-05-29T00:19:00.000Z" },
    ...synthesizedSession.captures
  ]
}, null, focusNow);
assert.equal(staleSynthesisBrief.nextAction.kind, "synthesize");

const frozenToday = new Date("2099-01-02T00:00:00.000Z");
const todayPack = buildTodayPack(multiReviewWorkspace, frozenToday, { dueLimit: 1, recentLimit: 1 });
assert.equal(todayPack.stats.due, 2);
assert.equal(todayPack.stats.questions, 0);
assert.equal(todayPack.stats.parkedQuestions, 0);
assert.equal(todayPack.stats.resolvedQuestionsToday, 0);
assert.equal(todayPack.stats.answerCapturesToday, 0);
assert.equal(todayPack.stats.questionReviewCards, 0);
assert.equal(todayPack.stats.questionReviewCardsToday, 0);
assert.equal(todayPack.questionHealth.status, "clear");
assert.equal(todayPack.questionLoop.label, "Question loop quiet");
assert.equal(todayPack.questionLoop.questionReviewCards, 0);
assert.match(todayPack.questionLoop.todayDetail, /0 answer-linked closures/);
assert.equal(todayPack.dueItems.length, 1);
assert.equal(todayPack.dueOverflow, 1);
assert.equal(todayPack.questionItems.length, 0);
assert.equal(todayPack.parkedQuestionItems.length, 0);
assert.equal(todayPack.resolvedQuestionItems.length, 0);
assert.equal(todayPack.recentCaptures.length, 1);
assert.equal(todayPack.focusBrief.nextAction.kind, "review");
assert.equal(todayPack.focusBrief.sessionId, multiReviewWorkspace.activeSessionId);
assert.match(todayPack.dueItems[0].sessionPath, /^sessions\/.+\.md$/);
assert.match(todayPack.recentCaptures[0].sessionPath, /^sessions\/.+\.md$/);
assert.match(todayPack.localDayWindow.start, /T00:00:00[+-]\d{2}:\d{2}$/);
assert.match(formatLocalIso(frozenToday), /2099-01-02T\d{2}:00:00[+-]\d{2}:\d{2}$/);
const todayMarkdown = generateTodayMarkdown(multiReviewWorkspace, frozenToday);
assert.equal(todayMarkdown, generateTodayMarkdown(multiReviewWorkspace, frozenToday));
assert.match(todayMarkdown, /Generated from workspace\.json/);
assert.match(todayMarkdown, /Today Study Pack/);
assert.match(todayMarkdown, /今日学习包/);
assert.match(todayMarkdown, /Local day window: \[/);
assert.match(todayMarkdown, /本地日期窗口：\[/);
assert.match(todayMarkdown, /Due rule: review cards with dueAt <= generatedAt/);
assert.match(todayMarkdown, /到期规则：review cards with dueAt <= generatedAt/);
assert.match(todayMarkdown, /工作区：3 个主题 \/ 2 条摘录 \/ 0 个开放问题/);
assert.match(todayMarkdown, /Resume Here/);
assert.match(todayMarkdown, /从这里继续/);
assert.match(todayMarkdown, /Next: Review/);
assert.match(todayMarkdown, /下一步：复习 1 张到期卡片/);
assert.match(todayMarkdown, /原因：当前主题有现在到期的复习。|原因：工作区复习债务优先于添加新材料。/);
assert.match(todayMarkdown, /\]\(sessions\/.+\.md\)/);
assert.match(todayMarkdown, /Due Review/);
assert.match(todayMarkdown, /到期复习/);
assert.match(todayMarkdown, /Question Queue Health/);
assert.match(todayMarkdown, /问题队列健康度/);
assert.match(todayMarkdown, /Question queue clear/);
assert.match(todayMarkdown, /Question Loop/);
assert.match(todayMarkdown, /问题闭环/);
assert.match(todayMarkdown, /Question loop quiet/);
assert.match(todayMarkdown, /Today metrics use the local day window/);
assert.match(todayMarkdown, /今日指标使用本地日期窗口/);
assert.match(todayMarkdown, /Open Questions/);
assert.match(todayMarkdown, /开放问题/);
assert.match(todayMarkdown, /No open questions captured yet/);
assert.match(todayMarkdown, /还没有捕获开放问题/);
assert.match(todayMarkdown, /Parked Questions/);
assert.match(todayMarkdown, /暂存问题/);
assert.match(todayMarkdown, /No parked questions/);
assert.match(todayMarkdown, /没有暂存问题/);
assert.match(todayMarkdown, /Closed Today/);
assert.match(todayMarkdown, /今日关闭/);
assert.match(todayMarkdown, /No questions closed today/);
assert.match(todayMarkdown, /今天还没有关闭问题/);
assert.match(todayMarkdown, /Recent Captures/);
assert.match(todayMarkdown, /最近摘录/);
assert.match(todayMarkdown, /Recall why greedy selection works/);
assert.match(todayMarkdown, /`workspace\.json` 仍然是规范恢复载荷/);
const boundaryNow = new Date("2099-01-02T23:59:30");
const boundaryWindow = resolveTodayWindow(boundaryNow);
const boundaryPack = buildTodayPack(multiReviewWorkspace, boundaryNow);
assert.equal(boundaryPack.localDayWindow.start, boundaryWindow.startIso);
assert.equal(boundaryPack.localDayWindow.end, boundaryWindow.endIso);
assert.equal(generateTodayMarkdown(multiReviewWorkspace, boundaryNow).includes(boundaryWindow.label), true);

const questionTodayWorkspace = addCapture(multiReviewWorkspace, algorithmsSession.id, {
  quote: "A stale heap item can survive after a better path is found.",
  thought: "Which invariant breaks if the heap is stale?",
  timestamp: "14:05",
  tags: "question graph"
}, { now: "2099-01-02T00:05:00.000Z" });
const questionTodayPack = buildTodayPack(questionTodayWorkspace, frozenToday, {
  dueLimit: 1,
  questionLimit: 1,
  recentLimit: 1
});
assert.equal(questionTodayPack.stats.questions, 1);
assert.equal(questionTodayPack.stats.parkedQuestions, 0);
assert.equal(questionTodayPack.questionHealth.status, "active");
assert.equal(questionTodayPack.questionHealth.targetSection, "open_questions");
assert.equal(questionTodayPack.questionLoop.activeQuestions, 1);
assert.equal(questionTodayPack.questionLoop.targetSection, "open_questions");
assert.equal(questionTodayPack.questionItems.length, 1);
assert.equal(questionTodayPack.questionItems[0].sessionTitle, "Algorithms course");
assert.match(questionTodayPack.questionItems[0].sessionPath, /^sessions\/.+\.md$/);
assert.equal(questionTodayPack.questionOverflow, 0);
const questionTodayMarkdown = generateTodayMarkdown(questionTodayWorkspace, frozenToday);
assert.match(questionTodayMarkdown, /Open question rule: latest 6 open question captures by capturedAt/);
assert.match(questionTodayMarkdown, /开放问题规则：latest 6 open question captures by capturedAt/);
assert.match(questionTodayMarkdown, /Parked question rule: latest 6 parked question captures by parkedAt/);
assert.match(questionTodayMarkdown, /暂存问题规则：latest 6 parked question captures by parkedAt/);
assert.match(questionTodayMarkdown, /Closed today rule: latest 4 question captures resolved in 2099-01-02 local/);
assert.match(questionTodayMarkdown, /今日关闭规则：latest 4 question captures resolved in 2099-01-02 local/);
assert.match(questionTodayMarkdown, /Answer rule: latest 4 answer captures in 2099-01-02 local/);
assert.match(questionTodayMarkdown, /回答规则：latest 4 answer captures in 2099-01-02 local/);
assert.match(questionTodayMarkdown, /Workspace: 3 sessions \/ 3 captures \/ 1 open question \/ 0 parked questions \/ 0 closed today \/ 0 answers today \/ 2 cards \/ 2 due cards/);
assert.match(questionTodayMarkdown, /工作区：3 个主题 \/ 3 条摘录 \/ 1 个开放问题 \/ 0 个暂存问题 \/ 0 个今日关闭 \/ 0 个今日回答 \/ 2 张卡片 \/ 2 张到期卡/);
assert.match(questionTodayMarkdown, /Questions can also appear under Recent Captures/);
assert.match(questionTodayMarkdown, /问题也可能出现在最近摘录里/);
assert.match(questionTodayMarkdown, /Question Loop/);
assert.match(questionTodayMarkdown, /Question loop has active work/);
assert.match(questionTodayMarkdown, /Backlog: 1 unresolved question/);
assert.match(questionTodayMarkdown, /积压：1 个开放问题 · 0 个暂存问题/);
const mixedMirrorIndexHtml = generateMirrorIndexHtml(questionTodayWorkspace, frozenToday);
assert.match(mixedMirrorIndexHtml, /Next from this export/);
assert.match(mixedMirrorIndexHtml, /本次导出的下一步/);
assert.match(mixedMirrorIndexHtml, /Review due cards/);
assert.match(mixedMirrorIndexHtml, /复习到期卡片/);
assert.match(mixedMirrorIndexHtml, /Also answer 1 open question in Inbox\./);
assert.match(mixedMirrorIndexHtml, /class="device-next-secondary" href="inbox\.html\?/);
assert.doesNotMatch(mixedMirrorIndexHtml, /class="device-next-link" href="inbox\.html\?[^"]+"/);
const mixedSecondaryHref = mixedMirrorIndexHtml.match(/class="device-next-secondary" href="([^"]+)"/)?.[1] || "";
assert.match(mixedSecondaryHref, /^inbox\.html\?[^#]+$/);
assert.match(mixedSecondaryHref, /answerToCaptureId=/);
assert.doesNotMatch(mixedSecondaryHref, /workspaceFingerprint|returnBaseFingerprint|\/Users|file:/);
const mixedReviewHtml = generateReviewHtml(questionTodayWorkspace, frozenToday);
const mixedReviewFollowup = extractStaticSeed(mixedReviewHtml).followup;
assert.equal(mixedReviewFollowup.label, "Answer 1 open question");
assert.equal(mixedReviewFollowup.labelZh, "回答 1 个开放问题");
assert.match(mixedReviewFollowup.href, /^inbox\.html\?[^#]+$/);
assert.match(mixedReviewFollowup.href, /answerToCaptureId=/);
assert.doesNotMatch(mixedReviewFollowup.href, /(?:^|\/)\.\.(?:\/|$)/);
assert.match(mixedReviewFollowup.detail, /Save this review return file/);
assert.match(mixedReviewFollowup.detailZh, /保存复习返回文件/);
assert.doesNotMatch(mixedReviewFollowup.href, /workspaceFingerprint|returnBaseFingerprint|\/Users|file:/);
assert.equal(extractStaticSeed(generateReviewHtml(multiReviewWorkspace, frozenToday)).followup, null);
const twoQuestionMirrorWorkspace = addCapture(questionTodayWorkspace, algorithmsSession.id, {
  quote: "Another stale heap edge case.",
  thought: "Question: Which tie-breaker keeps the exported path deterministic?",
  tags: "question graph"
}, { now: "2099-01-02T00:06:00.000Z" });
const twoQuestionMirrorIndexHtml = generateMirrorIndexHtml(twoQuestionMirrorWorkspace, frozenToday);
assert.match(twoQuestionMirrorIndexHtml, /Also answer 2 open questions in Inbox\./);
const pluralSecondaryHref = twoQuestionMirrorIndexHtml.match(/class="device-next-secondary" href="([^"]+)"/)?.[1] || "";
assert.match(pluralSecondaryHref, /^inbox\.html\?[^#]+$/);
assert.doesNotMatch(pluralSecondaryHref, /workspaceFingerprint|returnBaseFingerprint|\/Users|file:/);
const overflowResolvedCaptures = Array.from({ length: 6 }, (_, index) => ({
  id: `resolved_overflow_${index}`,
  quote: "",
  thought: `Resolved overflow question ${index}?`,
  timestamp: "",
  tags: ["question", "resolved"],
  capturedAt: `2099-01-02T00:0${index}:00.000Z`,
  createdAt: `2099-01-02T00:0${index}:00.000Z`,
  updatedAt: `2099-01-02T00:${10 + index}:00.000Z`,
  sourceTitle: "",
  sourceUrl: "",
  materialType: "doc",
  sourceProvenance: "manual",
  promotedToReview: false,
  questionResolvedAt: `2099-01-02T00:${10 + index}:00.000Z`,
  questionParkedAt: null
}));
const overflowResolvedWorkspace = workspaceFromPortableData({
  ...multiReviewWorkspace,
  sessions: multiReviewWorkspace.sessions.map((session) => session.id === algorithmsSession.id
    ? {
        ...session,
        captures: [...session.captures, ...overflowResolvedCaptures]
      }
    : session)
});
const overflowResolvedPack = buildTodayPack(overflowResolvedWorkspace, frozenToday, {
  dueLimit: 1,
  recentLimit: 1,
  resolvedQuestionLimit: 2
});
assert.equal(overflowResolvedPack.stats.resolvedQuestionsToday, 6);
assert.equal(overflowResolvedPack.questionLoop.resolvedQuestionsToday, 6);
assert.equal(overflowResolvedPack.questionLoop.targetSection, "closed_questions");
assert.equal(overflowResolvedPack.resolvedQuestionItems.length, 2);
assert.equal(overflowResolvedPack.resolvedQuestionItems[0].capture.thought, "Resolved overflow question 5?");
assert.equal(overflowResolvedPack.resolvedQuestionOverflow, 4);
assert.match(generateTodayMarkdown(overflowResolvedWorkspace, frozenToday), /\+2 more questions closed today in workspace\.json/);
assert.match(generateTodayMarkdown(overflowResolvedWorkspace, frozenToday), /workspace\.json 中还有 2 个今日关闭问题/);
const overflowAnswerWorkspace = workspaceFromPortableData({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  clientId: "client_answer_overflow",
  activeSessionId: "answer_overflow_topic",
  sessions: [{
    id: "answer_overflow_topic",
    title: "Answer overflow topic",
    captures: Array.from({ length: 6 }, (_, index) => ({
      id: `answer_overflow_${index}`,
      thought: `Answer: overflow answer ${index} has enough detail to classify.`,
      tags: ["answer"],
      capturedAt: `2099-01-02T00:0${index}:00.000Z`,
      createdAt: `2099-01-02T00:0${index}:00.000Z`,
      updatedAt: `2099-01-02T00:0${index}:00.000Z`
    })),
    reviewCards: []
  }]
});
const overflowAnswerPack = buildTodayPack(overflowAnswerWorkspace, frozenToday, { answerLimit: 2 });
assert.equal(overflowAnswerPack.stats.answerCapturesToday, 6);
assert.equal(overflowAnswerPack.answerItems.length, 2);
assert.equal(overflowAnswerPack.answerItems[0].answerReason, "tagged-answer");
assert.equal(overflowAnswerPack.answerOverflow, 4);
assert.match(generateTodayMarkdown(overflowAnswerWorkspace, frozenToday), /\+2 more answers captured today in workspace\.json/);
assert.match(generateTodayMarkdown(overflowAnswerWorkspace, frozenToday), /workspace\.json 中还有 2 个今日回答/);
const priorSessionAnswerWorkspace = workspaceFromPortableData({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  clientId: "client_prior_session_answer",
  activeSessionId: "prior_question_topic",
  sessions: [{
    id: "prior_question_topic",
    title: "Prior question topic",
    captures: [{
      id: "prior_session_question",
      thought: "Why does answer location matter?",
      tags: ["question"],
      capturedAt: "2099-01-02T09:00:00.000Z",
      createdAt: "2099-01-02T09:00:00.000Z",
      updatedAt: "2099-01-02T10:00:00.000Z",
      questionResolvedAt: "2099-01-02T10:00:00.000Z"
    }],
    reviewCards: []
  }, {
    id: "prior_answer_topic",
    title: "Prior answer topic",
    captures: [{
      id: "prior_session_answer",
      thought: "Answer: same-session linking prevents accidental cross-topic closure.",
      tags: ["answer"],
      answersQuestionCaptureId: "prior_session_question",
      capturedAt: "2099-01-02T10:01:00.000Z",
      createdAt: "2099-01-02T10:01:00.000Z",
      updatedAt: "2099-01-02T10:01:00.000Z"
    }],
    reviewCards: []
  }]
});
const priorSessionAnswerPack = buildTodayPack(priorSessionAnswerWorkspace, frozenToday);
assert.equal(priorSessionAnswerPack.questionLoop.resolvedQuestionsToday, 1);
assert.equal(priorSessionAnswerPack.questionLoop.answerLinkedResolvedToday, 0);
assert.equal(priorSessionAnswerPack.resolvedQuestionItems[0].answerCapture, null);
const priorPromotedQuestion = promoteCapture(priorSessionAnswerWorkspace, "prior_question_topic", "prior_session_question");
const priorPromotedCard = getActiveSession(priorPromotedQuestion).reviewCards[0];
assert.equal(priorPromotedCard.evidenceCaptureId, "");
assert.doesNotMatch(priorPromotedCard.answer, /same-session linking prevents/);
const questionOnlyMirrorWorkspace = workspaceFromPortableData({
  ...questionTodayWorkspace,
  sessions: questionTodayWorkspace.sessions.map((item) => ({ ...item, reviewCards: [] }))
});
const questionOnlyMirrorPack = buildTodayPack(questionOnlyMirrorWorkspace, frozenToday, {
  dueLimit: 1,
  questionLimit: 1,
  recentLimit: 1
});
assert.equal(questionOnlyMirrorPack.stats.due, 0);
assert.equal(questionOnlyMirrorPack.stats.questions, 1);
assert.equal(extractStaticSeed(generateReviewHtml(questionOnlyMirrorWorkspace, frozenToday)).followup, null);
const questionMirrorIndexHtml = generateMirrorIndexHtml(questionOnlyMirrorWorkspace, frozenToday);
assert.match(questionMirrorIndexHtml, /Next from this export/);
assert.match(questionMirrorIndexHtml, /Answer next question/);
assert.match(questionMirrorIndexHtml, /回答下一个问题/);
assert.match(questionMirrorIndexHtml, /Open Question Preview/);
assert.match(questionMirrorIndexHtml, /1 open question/);
assert.match(questionMirrorIndexHtml, /Which invariant breaks if the heap is stale\?/);
assert.match(questionMirrorIndexHtml, /href="sessions\/.+\.md"/);
assert.match(questionMirrorIndexHtml, /Draft answer in inbox/);
assert.match(questionMirrorIndexHtml, /在收件箱草拟回答/);
assert.doesNotMatch(questionMirrorIndexHtml, /Read source on this device/);
assert.doesNotMatch(questionMirrorIndexHtml, /class="device-next-link" href="inbox\.html\?[^"]+" target="_blank"/);
const nextQuestionHref = questionMirrorIndexHtml.match(/class="device-next-link" href="(inbox\.html\?[^"]+)"/)?.[1]?.replace(/&amp;/g, "&") || "";
const nextQuestionParams = new URLSearchParams(nextQuestionHref.split("?")[1] || "");
assert.equal(nextQuestionParams.get("answerToCaptureId"), questionOnlyMirrorPack.questionItems[0].capture.id);
assert.equal(nextQuestionParams.get("thought"), "Answer:");
const questionAnswerHref = questionMirrorIndexHtml.match(/href="(inbox\.html\?[^"]+)">[\s\S]*?Draft answer in inbox/)?.[1]?.replace(/&amp;/g, "&") || "";
const questionAnswerParams = new URLSearchParams(questionAnswerHref.split("?")[1] || "");
assert.equal(questionAnswerParams.get("topicId"), algorithmsSession.id);
assert.equal(questionAnswerParams.get("answerToCaptureId"), questionOnlyMirrorPack.questionItems[0].capture.id);
assert.equal(questionAnswerParams.get("quote"), "Which invariant breaks if the heap is stale?");
assert.equal(questionAnswerParams.get("thought"), "Answer:");
assert.equal(questionAnswerParams.get("timestamp"), "14:05");
assert.match(questionAnswerParams.get("tags") || "", /answer/);
let hostileQuestionWorkspace = addCapture(multiReviewWorkspace, algorithmsSession.id, {
  quote: "Hostile mirror quote should stay inert.",
  thought: `Can mirror links carry <script>alert("x")</script> & #hash ?q=1\r\nemoji 😀 RTL שלום ${"x".repeat(4096)}?`,
  tags: "question hostile"
}, { now: "2099-01-02T00:30:00.000Z" });
const hostileMirrorIndexHtml = generateMirrorIndexHtml(hostileQuestionWorkspace, frozenToday);
const hostileAnswerHref = hostileMirrorIndexHtml.match(/href="(inbox\.html\?[^"]+)">[\s\S]*?Draft answer in inbox/)?.[1]?.replace(/&amp;/g, "&") || "";
const hostileAnswerParams = new URLSearchParams(hostileAnswerHref.split("?")[1] || "");
assert.equal(hostileAnswerParams.get("topicId"), algorithmsSession.id);
assert.match(hostileAnswerParams.get("answerToCaptureId") || "", /^capture_/);
assert.match(hostileAnswerParams.get("quote") || "", /Can mirror links carry <script>alert\("x"\)<\/script> & #hash \?q=1emoji 😀 RTL שלום/);
assert.doesNotMatch(hostileAnswerParams.get("quote") || "", /[\r\n]/);
assert.equal(hostileAnswerParams.get("thought"), "Answer:");
assert.match(hostileAnswerParams.get("tags") || "", /answer/);
assert.doesNotMatch(hostileMirrorIndexHtml, /<script>alert/);
const hostileQuestionOnlyMirrorHtml = generateMirrorIndexHtml(workspaceFromPortableData({
  ...hostileQuestionWorkspace,
  sessions: hostileQuestionWorkspace.sessions.map((item) => ({ ...item, reviewCards: [] }))
}), frozenToday);
assert.match(hostileQuestionOnlyMirrorHtml, /Answer next question/);
assert.doesNotMatch(hostileQuestionOnlyMirrorHtml, /<script>alert/);
const hostileNextHref = hostileQuestionOnlyMirrorHtml.match(/class="device-next-link" href="(inbox\.html\?[^"]+)"/)?.[1]?.replace(/&amp;/g, "&") || "";
const hostileNextParams = new URLSearchParams(hostileNextHref.split("?")[1] || "");
assert.match(hostileNextParams.get("quote") || "", /Can mirror links carry <script>alert\("x"\)<\/script> & #hash \?q=1emoji 😀 RTL שלום/);
assert.doesNotMatch(hostileNextParams.get("quote") || "", /[\r\n]/);
assert.equal(hostileNextParams.get("thought"), "Answer:");
let overflowMirrorQuestionWorkspace = addCapture(questionTodayWorkspace, algorithmsSession.id, {
  quote: "HTML-like study input should stay inert in the mirror home.",
  thought: "What about <script>alert(\"x\")</script> & \"quotes\"?",
  tags: "question html"
}, { now: "2099-01-02T00:20:00.000Z" });
for (let index = 0; index < 6; index += 1) {
  overflowMirrorQuestionWorkspace = addCapture(overflowMirrorQuestionWorkspace, algorithmsSession.id, {
    quote: `Overflow mirror question ${index + 1}.`,
    thought: `What overflow mirror question ${index + 1}?`,
    tags: "question overflow"
  }, { now: `2099-01-02T00:1${index}:00.000Z` });
}
const overflowMirrorIndexHtml = generateMirrorIndexHtml(overflowMirrorQuestionWorkspace, frozenToday);
assert.match(overflowMirrorIndexHtml, /Open Question Preview/);
assert.match(overflowMirrorIndexHtml, /2 more open questions in/);
assert.match(overflowMirrorIndexHtml, /还有 2 个开放问题在/);
assert.match(overflowMirrorIndexHtml, /<a href="TODAY\.md">TODAY\.md<\/a>/);
assert.doesNotMatch(overflowMirrorIndexHtml, /<script>alert/);
assert.doesNotMatch(overflowMirrorIndexHtml, /"quotes"/);
assert.match(overflowMirrorIndexHtml, /What about &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; &quot;quotes&quot;\?/);
assert.match(questionTodayMarkdown, /Which invariant breaks if the heap is stale\?/);
assert.match(questionTodayMarkdown, /#question #graph/);

let overflowQuestionWorkspace = multiReviewWorkspace;
Array.from({ length: 7 }, (_, index) => index).forEach((index) => {
  overflowQuestionWorkspace = addCapture(overflowQuestionWorkspace, algorithmsSession.id, {
    thought: `Overflow question ${index}?`,
    tags: "question overflow"
  }, { now: `2099-01-02T00:0${index}:00.000Z` });
});
const overflowQuestionPack = buildTodayPack(overflowQuestionWorkspace, frozenToday, {
  dueLimit: 1,
  questionLimit: 2,
  recentLimit: 1
});
assert.equal(overflowQuestionPack.stats.questions, 7);
assert.equal(overflowQuestionPack.questionItems.length, 2);
assert.equal(overflowQuestionPack.questionItems[0].capture.thought, "Overflow question 6?");
assert.equal(overflowQuestionPack.questionItems[1].capture.thought, "Overflow question 5?");
assert.equal(overflowQuestionPack.questionOverflow, 5);
const overflowQuestionMarkdown = generateTodayMarkdown(overflowQuestionWorkspace, frozenToday);
const overflowOpenQuestions = overflowQuestionMarkdown.split("## Open Questions")[1].split("## Recent Captures")[0];
assert.match(overflowQuestionMarkdown, /Overflow question 6\?/);
assert.doesNotMatch(overflowOpenQuestions, /Overflow question 0\?/);
assert.match(overflowQuestionMarkdown, /\+1 more open questions in workspace\.json/);

const reviewHtml = generateReviewHtml(multiReviewWorkspace, frozenToday);
assert.match(reviewHtml, /Learning Companion Review Pack/);
assert.match(reviewHtml, /学习伴侣复习包/);
assert.match(reviewHtml, /mirror-language-switch/);
assert.match(reviewHtml, /id="mirrorLangZh"/);
assert.match(reviewHtml, /Content-Security-Policy/);
assert.match(reviewHtml, /learning-companion-workspace-fingerprint/);
assert.match(reviewHtml, /learning-companion-return-base-fingerprint/);
assert.match(reviewHtml, /returnBaseFingerprint/);
assert.match(reviewHtml, /Return-ready mirror/);
assert.match(reviewHtml, /可返回的镜像/);
assert.match(reviewHtml, /Mac return-base check/);
assert.match(reviewHtml, /source\.returnBaseFingerprint/);
assert.match(reviewHtml, /learning-companion\.review-progress-patch\.v1/);
assert.match(reviewHtml, /Return to Mac/);
assert.match(reviewHtml, /返回 Mac/);
assert.match(reviewHtml, /timestamped review return file/);
assert.match(reviewHtml, /Save Return File/);
assert.match(reviewHtml, /保存返回文件/);
assert.match(reviewHtml, /copyProgressBtn" type="button">[\s\S]*?Copy Return File/);
assert.match(reviewHtml, /复制返回文件/);
assert.doesNotMatch(reviewHtml, /Copy Return JSON/);
assert.doesNotMatch(reviewHtml, /Save Return JSON/);
assert.doesNotMatch(reviewHtml, /Return JSON file/);
assert.match(reviewHtml, /selectProgressBtn" class="secondary"/);
assert.match(reviewHtml, /selectProgressBtn" class="secondary"[\s\S]*?Manual Copy/);
assert.match(reviewHtml, /手动复制/);
assert.match(reviewHtml, /downloadProgressBtn" class="secondary"/);
assert.match(reviewHtml, /button:disabled/);
assert.match(reviewHtml, /setReturnActionsEnabled/);
assert.match(reviewHtml, /selectReturnJson/);
assert.match(reviewHtml, /Return file selected/);
assert.match(reviewHtml, /已选中返回文件/);
assert.match(reviewHtml, /returnFileName\('learning-companion-review-progress-patch'/);
assert.match(reviewHtml, /returnMetaKey/);
assert.match(reviewHtml, /Suggested JSON file:/);
assert.match(reviewHtml, /建议 JSON 文件/);
assert.match(reviewHtml, /returnManualHelp/);
assert.match(reviewHtml, /returnSaveMode/);
assert.match(reviewHtml, /Locked-down browser: use Manual Copy/);
assert.match(reviewHtml, /受限浏览器：使用手动复制/);
assert.match(reviewHtml, /press Ctrl\+C/);
assert.match(reviewHtml, /long-press the selected text on phone/);
assert.match(reviewHtml, /Notepad/);
assert.match(reviewHtml, /returnNextStep/);
assert.match(reviewHtml, /role="status" aria-live="polite"/);
assert.match(reviewHtml, /returnAfterSave/);
assert.match(reviewHtml, /returnAfterSaveFollowup/);
assert.match(reviewHtml, /Next: send this return file back to your Mac/);
assert.match(reviewHtml, /下一步：把这个返回文件发回你的 Mac/);
assert.match(reviewHtml, /white-space: pre-line/);
assert.match(reviewHtml, /Move it to Mac, then import or paste it from Today &gt; Return Files|Move it to Mac, then import or paste it from Today > Return Files/);
assert.match(reviewHtml, /把它带回 Mac，然后从今日 &gt; 返回文件导入|把它带回 Mac，然后从今日 > 返回文件导入/);
assert.match(reviewHtml, /If a file was saved: Windows - check Downloads/);
assert.match(reviewHtml, /如果已经保存文件/);
assert.match(reviewHtml, /HarmonyOS phone - check the Files app&#39;s Downloads folder|HarmonyOS phone - check the Files app's Downloads folder/);
assert.match(reviewHtml, /If no file was created: use Copy or Manual Copy/);
assert.match(reviewHtml, /如果没有生成文件/);
assert.match(reviewHtml, /Manual carriers after you have the JSON: AirDrop, USB, file share, email, or Feishu Drive; no live sync/);
assert.match(reviewHtml, /拿到 JSON 后可用的手动载体/);
assert.match(reviewHtml, /showReturnAfterSave/);
assert.match(reviewHtml, /hideReturnAfterSave/);
assert.match(reviewHtml, /renderReturnFollowup/);
assert.match(reviewHtml, /You can keep reviewing here/);
assert.match(reviewHtml, /你可以继续在这里复习/);
assert.match(reviewHtml, /Return file preview/);
assert.match(reviewHtml, /返回文件预览/);
assert.match(reviewHtml, /selected text below is the return file JSON/);
assert.match(reviewHtml, /下方选中的文本就是返回文件 JSON/);
assert.match(reviewHtml, /No review return file yet\. Reveal and grade a card first/);
assert.match(reviewHtml, /还没有复习返回文件/);
assert.match(reviewHtml, /No due cards in this mirror\. Nothing to return from Review/);
assert.match(reviewHtml, /这个镜像里没有到期卡片/);
assert.match(reviewHtml, /returnFileActionVerb/);
assert.match(reviewHtml, /returnFileActionVerb\(lang = 'en'\)/);
assert.match(reviewHtml, /lang === 'zh' \? '保存'/);
assert.match(reviewHtml, /lang === 'zh' \? '下载'/);
assert.match(reviewHtml, /lang === 'zh' \? '手动复制'/);
assert.match(reviewHtml, /Download Return File/);
assert.match(reviewHtml, /下载返回文件/);
assert.match(reviewHtml, /Select Return File/);
assert.match(reviewHtml, /选择返回文件/);
assert.match(reviewHtml, /No file picker detected/);
assert.match(reviewHtml, /未检测到文件选择器/);
assert.match(reviewHtml, /setI18nHtml\(button, 'Save Return File', '保存返回文件'\)/);
assert.match(reviewHtml, /Name it/);
assert.match(reviewHtml, /保存时请命名为/);
assert.match(reviewHtml, /showSaveFilePicker/);
assert.match(reviewHtml, /shouldUseFallbackDownload/);
assert.match(reviewHtml, /__LC_ALLOW_AUTOMATED_DOWNLOADS__/);
assert.match(reviewHtml, /Save picker unavailable here/);
assert.match(reviewHtml, /此处无法使用保存选择器/);
assert.match(reviewHtml, /storageUnavailableStatus/);
assert.match(reviewHtml, /Browser storage is unavailable/);
assert.match(reviewHtml, /浏览器存储不可用/);
assert.match(reviewHtml, /Review progress is memory-only/);
assert.match(reviewHtml, /复习进度仅保存在内存中/);
assert.match(reviewHtml, /function setStatus\(message, zh\) \{ setI18nHtml\(document\.querySelector\('#progressStatus'\), message, zh\); \}/);
assert.doesNotMatch(reviewHtml, /textContent = message/);
assert.doesNotMatch(reviewHtml, /\$\{message\} If selection did not work/);
assert.match(reviewHtml, /appendRuntimeI18n/);
assert.match(reviewHtml, /function saveProgress\(\) \{ try \{ localStorage\.setItem/);
assert.match(reviewHtml, /function clearProgress\(\)/);
assert.match(reviewHtml, /Save picker unavailable here\. Return file selected for manual copy\. Nothing was saved to disk\./);
assert.match(reviewHtml, /没有保存到磁盘/);
assert.match(reviewHtml, /progress-actions, \.grade-actions \{ display: grid; grid-template-columns: 1fr; \}/);
assert.match(reviewHtml, /beforeunload/);
assert.match(reviewHtml, /Today &gt; Return Files/);
assert.match(reviewHtml, /data-reveal/);
assert.match(reviewHtml, /揭示/);
assert.match(reviewHtml, /隐藏/);
assert.match(reviewHtml, /setRevealButton/);
assert.match(reviewHtml, /data-grade="good"/);
assert.match(reviewHtml, /通过/);
assert.match(reviewHtml, /已标记/);
assert.match(reviewHtml, /Recall why greedy selection works/);
assert.match(reviewHtml, /href="sessions\/.+\.md"/);
assert.equal(reviewHtml.includes("<script>alert"), false);
assert.equal(/<script[^>]+src=/i.test(reviewHtml), false);
assert.equal(/\bfetch\s*\(/.test(reviewHtml), false);
assert.equal(/XMLHttpRequest/.test(reviewHtml), false);
assert.equal(reviewHtml, generateReviewHtml(multiReviewWorkspace, frozenToday));

const [reviewProgressItem] = getDueReviewItems(multiReviewWorkspace, frozenToday);
const reviewProgressPatch = {
  schema: REVIEW_PROGRESS_PATCH_SCHEMA,
  appVersion: WORKSPACE_SCHEMA_VERSION,
  patchId: "review_patch_001",
  createdAt: "2099-01-02T08:00:00.000Z",
  source: { generatedBy: "review.html", workspaceFingerprint: "fnv1a-test" },
  events: [{
    id: "review_event_001",
    sessionId: reviewProgressItem.sessionId,
    cardId: reviewProgressItem.card.id,
    grade: "good",
    reviewedAt: "2099-01-02T08:01:00.000Z",
    baseUpdatedAt: reviewProgressItem.card.updatedAt,
    baseDueAt: reviewProgressItem.card.dueAt,
    baseStrength: reviewProgressItem.card.strength
  }, {
    id: "review_event_001",
    sessionId: reviewProgressItem.sessionId,
    cardId: reviewProgressItem.card.id,
    grade: "again",
    reviewedAt: "2099-01-02T08:02:00.000Z",
    baseUpdatedAt: reviewProgressItem.card.updatedAt,
    baseDueAt: reviewProgressItem.card.dueAt,
    baseStrength: reviewProgressItem.card.strength
  }]
};
assert.equal(isReviewProgressPatch(reviewProgressPatch), true);
let reviewProgressResult = applyReviewProgressPatch(multiReviewWorkspace, reviewProgressPatch, frozenToday);
const reviewedSession = reviewProgressResult.workspace.sessions.find((item) => item.id === reviewProgressItem.sessionId);
const reviewedCard = reviewedSession.reviewCards.find((card) => card.id === reviewProgressItem.card.id);
assert.equal(reviewProgressResult.receipt.applied, 1);
assert.equal(reviewProgressResult.receipt.skippedDuplicate, 1);
assert.equal(reviewProgressResult.receipt.sourceWorkspaceFingerprint, "fnv1a-test");
assert.equal(reviewProgressResult.receipt.currentWorkspaceFingerprint, `fnv1a-${workspaceFingerprint(JSON.stringify(sanitizeWorkspace(multiReviewWorkspace), null, 2))}`);
assert.equal(reviewProgressResult.receipt.sourceFingerprintBasis, "workspace");
assert.equal(reviewProgressResult.receipt.sourceFingerprintMatches, false);
assert.equal(reviewProgressResult.workspace.importedReviewPatches.includes("review_patch_001"), true);
assert.equal(reviewedCard.strength, reviewProgressItem.card.strength + 1);
assert.equal(reviewedCard.lastReviewedAt, "2099-01-02T08:01:00.000Z");
const matchingReviewProgressResult = applyReviewProgressPatch(multiReviewWorkspace, {
  ...reviewProgressPatch,
  patchId: "review_patch_matching_base",
  source: {
    ...reviewProgressPatch.source,
    workspaceFingerprint: `fnv1a-${workspaceFingerprint(JSON.stringify(sanitizeWorkspace(multiReviewWorkspace), null, 2))}`,
    returnBaseFingerprint: buildReturnBaseFingerprint(multiReviewWorkspace)
  },
  events: [{ ...reviewProgressPatch.events[0], id: "review_event_matching_base" }]
}, frozenToday);
assert.equal(matchingReviewProgressResult.receipt.sourceFingerprintBasis, "return-base");
assert.equal(matchingReviewProgressResult.receipt.sourceFingerprintMatches, true);
const duplicateReviewProgressResult = applyReviewProgressPatch(reviewProgressResult.workspace, reviewProgressPatch);
assert.equal(duplicateReviewProgressResult.receipt.targetResolution, "duplicate-patch");
assert.equal(duplicateReviewProgressResult.receipt.applied, 0);
assert.equal(duplicateReviewProgressResult.receipt.sourceFingerprintMatches, false);
const staleReviewProgressResult = applyReviewProgressPatch(reviewProgressResult.workspace, {
  ...reviewProgressPatch,
  patchId: "review_patch_002",
  events: [{ ...reviewProgressPatch.events[0], id: "review_event_002" }]
});
assert.equal(staleReviewProgressResult.receipt.applied, 0);
assert.equal(staleReviewProgressResult.receipt.skippedConflict, 1);
const missingReviewProgressResult = applyReviewProgressPatch(multiReviewWorkspace, {
  ...reviewProgressPatch,
  patchId: "review_patch_003",
  events: [{ ...reviewProgressPatch.events[0], id: "review_event_003", cardId: "missing_card" }]
});
assert.equal(missingReviewProgressResult.receipt.skippedMissing, 1);
assert.equal(isReviewProgressPatchLike({ schema: "learning-companion.review-progress-patch.v2" }), true);
assert.throws(() => workspaceFromPortableData({ schema: "learning-companion.review-progress-patch.v2" }), /Unsupported review progress patch schema/);
assert.throws(() => applyReviewProgressPatch(multiReviewWorkspace, { ...reviewProgressPatch, patchId: "" }), /patchId/);
assert.throws(() => applyReviewProgressPatch(multiReviewWorkspace, {
  ...reviewProgressPatch,
  patchId: "review_patch_too_many",
  events: Array.from({ length: MAX_REVIEW_PROGRESS_EVENTS + 1 }, (_, index) => ({
    ...reviewProgressPatch.events[0],
    id: `too_many_review_${index}`
  }))
}), /too many events/);

const maliciousReviewWorkspace = sanitizeWorkspace({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  activeSessionId: "malicious_session",
  sessions: [{
    id: "malicious_session",
    title: "Bad \" onclick=alert(1) x=\" & topic",
    sourceTitle: "",
    sourceUrl: "",
    materialType: "doc",
    focusMode: "capture",
    notesMarkdown: "",
    tags: [],
    captures: [],
    reviewCards: [{
      id: "malicious_card",
      prompt: "Prompt \" onclick=alert(1) x=\" <img src=x onerror=alert(1)>",
      answer: "Answer & <script>alert(1)</script> ' `",
      dueAt: "2026-05-29T00:00:00.000Z",
      strength: 0
    }]
  }]
});
const maliciousReviewHtml = generateReviewHtml(maliciousReviewWorkspace, frozenToday);
assert.match(maliciousReviewHtml, /&quot; onclick=alert\(1\) x=&quot;/);
assert.match(maliciousReviewHtml, /&amp;/);
assert.match(maliciousReviewHtml, /&#39;/);
assert.equal(maliciousReviewHtml.includes("<img src=x"), false);
assert.equal(maliciousReviewHtml.includes("<script>alert"), false);

const inboxHtml = generateInboxHtml(multiReviewWorkspace, frozenToday);
assert.match(inboxHtml, /Learning Companion Inbox/);
assert.match(inboxHtml, /学习伴侣收件箱/);
assert.match(inboxHtml, /mirror-language-switch/);
assert.match(inboxHtml, /id="mirrorLangZh"/);
assert.match(inboxHtml, /learning-companion\.mobile-inbox-patch\.v1/);
assert.match(inboxHtml, /learning-companion-return-base-fingerprint/);
assert.match(inboxHtml, /returnBaseFingerprint/);
assert.match(inboxHtml, /Return-ready mirror/);
assert.match(inboxHtml, /可返回的镜像/);
assert.match(inboxHtml, /Mac return-base check/);
assert.match(inboxHtml, /source\.returnBaseFingerprint/);
assert.match(inboxHtml, /Return to Mac/);
assert.match(inboxHtml, /返回 Mac/);
assert.match(inboxHtml, /timestamped inbox return file/);
assert.match(inboxHtml, /Save Return File/);
assert.match(inboxHtml, /保存返回文件/);
assert.match(inboxHtml, /copyPatchBtn" type="button">[\s\S]*?Copy Return File/);
assert.match(inboxHtml, /复制返回文件/);
assert.doesNotMatch(inboxHtml, /Copy Return JSON/);
assert.doesNotMatch(inboxHtml, /Save Return JSON/);
assert.doesNotMatch(inboxHtml, /Return JSON file/);
assert.match(inboxHtml, /selectPatchBtn" class="secondary"/);
assert.match(inboxHtml, /selectPatchBtn" class="secondary"[\s\S]*?Manual Copy/);
assert.match(inboxHtml, /手动复制/);
assert.match(inboxHtml, /downloadPatchBtn" class="secondary"/);
assert.match(inboxHtml, /button:disabled/);
assert.match(inboxHtml, /setReturnActionsEnabled/);
assert.match(inboxHtml, /selectReturnJson/);
assert.match(inboxHtml, /Return file selected/);
assert.match(inboxHtml, /已选中返回文件/);
assert.match(inboxHtml, /returnFileName\('learning-companion-inbox-patch'/);
assert.match(inboxHtml, /returnMetaKey/);
assert.match(inboxHtml, /Suggested JSON file:/);
assert.match(inboxHtml, /建议 JSON 文件/);
assert.match(inboxHtml, /returnManualHelp/);
assert.match(inboxHtml, /returnSaveMode/);
assert.match(inboxHtml, /Locked-down browser: use Manual Copy/);
assert.match(inboxHtml, /受限浏览器：使用手动复制/);
assert.match(inboxHtml, /press Ctrl\+C/);
assert.match(inboxHtml, /long-press the selected text on phone/);
assert.match(inboxHtml, /Notepad/);
assert.match(inboxHtml, /textarea\[readonly\]/);
assert.match(inboxHtml, /returnNextStep/);
assert.match(inboxHtml, /role="status" aria-live="polite"/);
assert.match(inboxHtml, /returnAfterSave/);
assert.match(inboxHtml, /returnAfterSaveFollowup/);
assert.match(inboxHtml, /Next: send this return file back to your Mac/);
assert.match(inboxHtml, /下一步：把这个返回文件发回你的 Mac/);
assert.match(inboxHtml, /white-space: pre-line/);
assert.match(inboxHtml, /Move it to Mac, then import or paste it from Today &gt; Return Files|Move it to Mac, then import or paste it from Today > Return Files/);
assert.match(inboxHtml, /把它带回 Mac，然后从今日 &gt; 返回文件导入|把它带回 Mac，然后从今日 > 返回文件导入/);
assert.match(inboxHtml, /If a file was saved: Windows - check Downloads/);
assert.match(inboxHtml, /如果已经保存文件/);
assert.match(inboxHtml, /HarmonyOS phone - check the Files app&#39;s Downloads folder|HarmonyOS phone - check the Files app's Downloads folder/);
assert.match(inboxHtml, /If no file was created: use Copy or Manual Copy/);
assert.match(inboxHtml, /如果没有生成文件/);
assert.match(inboxHtml, /Manual carriers after you have the JSON: AirDrop, USB, file share, email, or Feishu Drive; no live sync/);
assert.match(inboxHtml, /拿到 JSON 后可用的手动载体/);
assert.match(inboxHtml, /showReturnAfterSave/);
assert.match(inboxHtml, /hideReturnAfterSave/);
assert.match(inboxHtml, /renderReturnFollowup/);
assert.match(inboxHtml, /You can keep capturing here/);
assert.match(inboxHtml, /你可以继续在这里摘录/);
assert.match(inboxHtml, /Return file preview/);
assert.match(inboxHtml, /返回文件预览/);
assert.match(inboxHtml, /selected text below is the return file JSON/);
assert.match(inboxHtml, /下方选中的文本就是返回文件 JSON/);
assert.match(inboxHtml, /草稿摘录/);
assert.match(inboxHtml, /添加摘录/);
assert.match(inboxHtml, /清空表单/);
assert.match(inboxHtml, /No draft captures for this topic yet/);
assert.match(inboxHtml, /这个主题还没有草稿摘录/);
assert.match(inboxHtml, /Add a quote or thought before saving a return file/);
assert.match(inboxHtml, /保存返回文件前请先添加引文或想法/);
assert.match(inboxHtml, /returnFileActionVerb/);
assert.match(inboxHtml, /returnFileActionVerb\(lang = 'en'\)/);
assert.match(inboxHtml, /lang === 'zh' \? '保存'/);
assert.match(inboxHtml, /lang === 'zh' \? '下载'/);
assert.match(inboxHtml, /lang === 'zh' \? '手动复制'/);
assert.match(inboxHtml, /Download Return File/);
assert.match(inboxHtml, /下载返回文件/);
assert.match(inboxHtml, /Select Return File/);
assert.match(inboxHtml, /选择返回文件/);
assert.match(inboxHtml, /No file picker detected/);
assert.match(inboxHtml, /未检测到文件选择器/);
assert.match(inboxHtml, /setI18nHtml\(button, 'Save Return File', '保存返回文件'\)/);
assert.match(inboxHtml, /Name it/);
assert.match(inboxHtml, /保存时请命名为/);
assert.match(inboxHtml, /showSaveFilePicker/);
assert.match(inboxHtml, /shouldUseFallbackDownload/);
assert.match(inboxHtml, /__LC_ALLOW_AUTOMATED_DOWNLOADS__/);
assert.match(inboxHtml, /Save picker unavailable here/);
assert.match(inboxHtml, /此处无法使用保存选择器/);
assert.match(inboxHtml, /storageUnavailableStatus/);
assert.match(inboxHtml, /Browser storage is unavailable/);
assert.match(inboxHtml, /浏览器存储不可用/);
assert.match(inboxHtml, /Drafts are memory-only/);
assert.match(inboxHtml, /草稿仅保存在内存中/);
assert.match(inboxHtml, /function setStatus\(message, zh\) \{ setI18nHtml\(document\.querySelector\('#statusOutput'\), message, zh\); \}/);
assert.doesNotMatch(inboxHtml, /textContent = message/);
assert.doesNotMatch(inboxHtml, /\$\{message\} If selection did not work/);
assert.match(inboxHtml, /appendRuntimeI18n/);
assert.match(inboxHtml, /function saveDrafts\(\) \{ try \{ localStorage\.setItem/);
assert.match(inboxHtml, /function clearDrafts\(\)/);
assert.match(inboxHtml, /Save picker unavailable here\. Return file selected for manual copy\. Nothing was saved to disk\./);
assert.match(inboxHtml, /没有保存到磁盘/);
assert.match(inboxHtml, /\.actions \{ display: grid; grid-template-columns: 1fr; \}/);
assert.match(inboxHtml, /beforeunload/);
assert.match(inboxHtml, /Today &gt; Return Files/);
assert.match(inboxHtml, /Content-Security-Policy/);
assert.match(inboxHtml, /getRandomValues/);
assert.match(inboxHtml, /applyQueryPrefill/);
assert.match(inboxHtml, /Answer draft loaded from mirror link/);
assert.match(inboxHtml, /已从镜像链接加载回答草稿/);
assert.match(inboxHtml, /original topic was not found/);
assert.match(inboxHtml, /未找到原始主题/);
assert.match(inboxHtml, /Using the Source or URL you entered for this capture/);
assert.match(inboxHtml, /正在使用你为这条摘录输入的来源或 URL/);
assert.match(inboxHtml, /This mirror has no topic source/);
assert.match(inboxHtml, /这个镜像没有主题来源/);
assert.match(inboxHtml, /answerContext/);
assert.match(inboxHtml, /role="status" aria-live="polite"/);
assert.match(inboxHtml, /id="quoteLabel"[\s\S]*?Quote/);
assert.match(inboxHtml, /id="quoteLabel"[\s\S]*?引文/);
assert.match(inboxHtml, /id="thoughtLabel"[\s\S]*?Thought/);
assert.match(inboxHtml, /id="thoughtLabel"[\s\S]*?想法/);
assert.match(inboxHtml, /Question from Mac/);
assert.match(inboxHtml, /来自 Mac 的问题/);
assert.match(inboxHtml, /Answer to return/);
assert.match(inboxHtml, /要带回的回答/);
assert.match(inboxHtml, /Question carried from the Mac mirror/);
assert.match(inboxHtml, /从 Mac 镜像带来的问题/);
assert.match(inboxHtml, /Write the answer to bring back to Mac/);
assert.match(inboxHtml, /写下要带回 Mac 的回答/);
assert.match(inboxHtml, /setAnswerFieldMode/);
assert.match(inboxHtml, /fields\.quote\.readOnly = Boolean\(isAnswerDraft\)/);
assert.match(inboxHtml, /aria-readonly/);
assert.match(inboxHtml, /You're answering a question from this mirror/);
assert.match(inboxHtml, /你正在回答这个镜像中的问题/);
assert.match(inboxHtml, /Your answer will be saved to a return file you move back to Mac/);
assert.match(inboxHtml, /你的回答会保存到一个带回 Mac 的返回文件中/);
assert.match(inboxHtml, /setI18nHtml\(answerContextTitle,/);
assert.match(inboxHtml, /回答已加入这个返回草稿/);
assert.match(inboxHtml, /setI18nHtml\(answerContextText,/);
assert.match(inboxHtml, /保存或复制返回文件，把它带回 Mac。/);
assert.match(inboxHtml, /renderAnswerContext/);
const inboxFollowup = extractStaticSeed(inboxHtml).followup;
assert.equal(inboxFollowup.label, "Review 2 due cards");
assert.equal(inboxFollowup.labelZh, "复习 2 张到期卡片");
assert.equal(inboxFollowup.href, "review.html");
assert.match(inboxFollowup.detail, /Save this inbox return file/);
assert.match(inboxFollowup.detailZh, /保存收件箱返回文件/);
assert.doesNotMatch(inboxFollowup.href, /workspaceFingerprint|returnBaseFingerprint|\/Users|file:/);
assert.equal(extractStaticSeed(generateInboxHtml(createDefaultWorkspace(), frozenToday)).followup, null);
assert.equal(extractStaticSeed(generateInboxHtml(questionOnlyMirrorWorkspace, frozenToday)).followup, null);
assert.equal(inboxHtml.includes("<link"), false);
assert.equal(/<script[^>]+src=/i.test(inboxHtml), false);
assert.equal(/<iframe/i.test(inboxHtml), false);
assert.equal(/srcdoc=/i.test(inboxHtml), false);
assert.equal(/href=["']javascript:/i.test(inboxHtml), false);
assert.equal(/\bfetch\s*\(/.test(inboxHtml), false);
assert.equal(/XMLHttpRequest/.test(inboxHtml), false);
assert.equal(/\bimport\s*\(/.test(inboxHtml), false);

const manyCardsWorkspace = sanitizeWorkspace({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  activeSessionId: "many_cards_session",
  sessions: [{
    id: "many_cards_session",
    title: "Many cards",
    sourceTitle: "",
    sourceUrl: "",
    materialType: "doc",
    focusMode: "capture",
    notesMarkdown: "",
    tags: [],
    captures: [],
    reviewCards: Array.from({ length: 55 }, (_, index) => ({
      id: `many_card_${index}`,
      prompt: `Prompt ${index}`,
      answer: `Answer ${index}`,
      dueAt: "2026-05-29T00:00:00.000Z",
      strength: 0,
      createdAt: `2026-05-29T00:00:${String(index).padStart(2, "0")}.000Z`
    }))
  }]
});
const manyCardsReviewHtml = generateReviewHtml(manyCardsWorkspace, frozenToday);
assert.equal((manyCardsReviewHtml.match(/<article class="card"/g) || []).length, 50);

const mirrorIndexHtml = generateMirrorIndexHtml(multiReviewWorkspace, frozenToday);
assert.match(mirrorIndexHtml, /Learning Companion Mirror/);
assert.match(mirrorIndexHtml, /学习伴侣镜像/);
assert.match(mirrorIndexHtml, /mirror-language-switch/);
assert.match(mirrorIndexHtml, /id="mirrorLangZh"/);
assert.match(mirrorIndexHtml, /href="TODAY\.md"/);
assert.match(mirrorIndexHtml, /href="review\.html"/);
assert.match(mirrorIndexHtml, /href="inbox\.html"/);
assert.match(mirrorIndexHtml, /href="workspace\.json"/);
assert.match(mirrorIndexHtml, /Next from this export/);
assert.ok(mirrorIndexHtml.indexOf("Next from this export") < mirrorIndexHtml.indexOf("Mirror entry points"));
assert.match(mirrorIndexHtml, /Review due cards/);
assert.match(mirrorIndexHtml, /复习到期卡片/);
assert.match(mirrorIndexHtml, /2 due cards/);
assert.doesNotMatch(mirrorIndexHtml, /class="device-next-link" href="review\.html" target="_blank"/);
assert.match(mirrorIndexHtml, /As of 2099-01-02T08:00:00\+08:00/);
assert.match(mirrorIndexHtml, /device-next-link:focus-visible/);
assert.match(mirrorIndexHtml, /device-next-secondary:focus-visible/);
assert.match(mirrorIndexHtml, /span\.device-next-secondary/);
assert.match(mirrorIndexHtml, /Manual Return/);
assert.match(mirrorIndexHtml, /手动返回/);
assert.match(mirrorIndexHtml, /Read Today/);
assert.match(mirrorIndexHtml, /阅读今日/);
assert.match(mirrorIndexHtml, /Work here/);
assert.match(mirrorIndexHtml, /Return file back to Mac/);
assert.match(mirrorIndexHtml, /Static mirror only/);
assert.match(mirrorIndexHtml, /仅静态镜像/);
assert.match(mirrorIndexHtml, /Today &gt; Return Files/);
assert.match(mirrorIndexHtml, /href="sessions\/.+\.md"/);
assert.match(mirrorIndexHtml, /Resume Here/);
assert.match(mirrorIndexHtml, /从这里继续/);
assert.match(mirrorIndexHtml, /Review 1 due card/);
assert.match(mirrorIndexHtml, /复习 1 张到期卡片/);
assert.match(mirrorIndexHtml, /先揭示并评分，再加入更多材料/);
assert.match(mirrorIndexHtml, /Why: Active topic has due review due now/);
assert.match(mirrorIndexHtml, /原因：当前主题有现在到期的复习/);
assert.match(mirrorIndexHtml, /Session:/);
assert.match(mirrorIndexHtml, /主题：/);
assert.match(mirrorIndexHtml, /Source:/);
assert.match(mirrorIndexHtml, /来源：/);
assert.match(mirrorIndexHtml, /Latest:/);
assert.match(mirrorIndexHtml, /最新：/);
assert.match(mirrorIndexHtml, /Open Question Preview/);
assert.match(mirrorIndexHtml, /No open questions captured yet/);
assert.match(generateMirrorIndexHtml(workspace, focusNow), /href="https:\/\/www\.youtube\.com\/watch\?v=rust123&amp;t=492s"/);
assert.match(mirrorIndexHtml, /Content-Security-Policy/);
assert.match(mirrorIndexHtml, /script-src 'none'/);
assert.match(mirrorIndexHtml, /learning-companion-workspace-fingerprint/);
assert.match(mirrorIndexHtml, /learning-companion-return-base-fingerprint/);
assert.match(mirrorIndexHtml, /Return-ready mirror/);
assert.match(mirrorIndexHtml, /可返回的镜像/);
assert.match(mirrorIndexHtml, /Mac return-base check/);
assert.match(mirrorIndexHtml, /source\.returnBaseFingerprint/);
assert.doesNotMatch(mirrorIndexHtml, /Return JSON back to Mac/);
assert.equal(mirrorIndexHtml.includes("<script"), false);
assert.equal(mirrorIndexHtml, generateMirrorIndexHtml(multiReviewWorkspace, frozenToday));
const noSourceBase = createDefaultWorkspace();
const noSourceSession = getActiveSession(noSourceBase);
const noSourceMirrorWorkspace = updateSession(noSourceBase, noSourceSession.id, {
  sourceTitle: "",
  sourceUrl: "",
  materialType: "other"
});
const noSourceMirrorIndexHtml = generateMirrorIndexHtml(noSourceMirrorWorkspace, frozenToday);
assert.match(noSourceMirrorIndexHtml, /Next from this export/);
assert.match(noSourceMirrorIndexHtml, /Capture on this device/);
assert.match(noSourceMirrorIndexHtml, /在此设备摘录/);
assert.match(noSourceMirrorIndexHtml, /class="device-next-link" href="inbox\.html"/);
assert.match(noSourceMirrorIndexHtml, /No due cards or open questions; return by JSON/);
assert.doesNotMatch(noSourceMirrorIndexHtml, /Read source on this device/);
const sourceOnlyBase = createDefaultWorkspace();
const sourceOnlySession = getActiveSession(sourceOnlyBase);
const sourceOnlyWorkspace = updateSession(sourceOnlyBase, sourceOnlySession.id, {
  sourceTitle: "Device reading source",
  sourceUrl: "https://example.com/device-reading",
  materialType: "article"
});
const sourceOnlyMirrorIndexHtml = generateMirrorIndexHtml(sourceOnlyWorkspace, frozenToday);
assert.match(sourceOnlyMirrorIndexHtml, /Next from this export/);
assert.match(sourceOnlyMirrorIndexHtml, /Read source on this device/);
assert.match(sourceOnlyMirrorIndexHtml, /在此设备阅读来源/);
assert.match(sourceOnlyMirrorIndexHtml, /href="https:\/\/example\.com\/device-reading" target="_blank" rel="noreferrer noopener"/);
assert.match(sourceOnlyMirrorIndexHtml, /Device reading source · then return to Inbox to save a note for Mac\./);
assert.match(sourceOnlyMirrorIndexHtml, /然后回到收件箱/);
assert.match(sourceOnlyMirrorIndexHtml, /Source linked; come back to this mirror tab for return JSON/);
assert.match(sourceOnlyMirrorIndexHtml, /class="device-next-secondary" href="inbox\.html">[\s\S]*?Then capture in Inbox\./);
assert.match(sourceOnlyMirrorIndexHtml, /然后在收件箱摘录/);
assert.doesNotMatch(sourceOnlyMirrorIndexHtml, /class="device-next-link" href="inbox\.html"/);
const sourceResumeBase = createDefaultWorkspace();
const sourceResumeSession = getActiveSession(sourceResumeBase);
let sourceResumeWorkspace = updateSession(sourceResumeBase, sourceResumeSession.id, {
  sourceTitle: "Device video source",
  sourceUrl: "https://www.youtube.com/watch?v=device123",
  materialType: "video"
});
sourceResumeWorkspace = addCapture(sourceResumeWorkspace, sourceResumeSession.id, {
  quote: "Timestamped point for device resume.",
  thought: "Use this moment when continuing off Mac.",
  timestamp: "01:35"
}, { now: "2099-01-02T00:45:00.000Z" });
const sourceResumeMirrorIndexHtml = generateMirrorIndexHtml(sourceResumeWorkspace, frozenToday);
assert.match(sourceResumeMirrorIndexHtml, /Resume source on this device/);
assert.match(sourceResumeMirrorIndexHtml, /在此设备继续来源/);
assert.match(sourceResumeMirrorIndexHtml, /href="https:\/\/www\.youtube\.com\/watch\?v=device123&amp;t=95s" target="_blank" rel="noreferrer noopener"/);
assert.match(sourceResumeMirrorIndexHtml, /Device video source @ 01:35 · then return to Inbox to save a note for Mac\./);
assert.match(sourceResumeMirrorIndexHtml, /Source moment available; come back to this mirror tab for return JSON/);
assert.match(sourceResumeMirrorIndexHtml, /class="device-next-secondary" href="inbox\.html">[\s\S]*?Then capture in Inbox\./);
assert.match(sourceResumeMirrorIndexHtml, /然后在收件箱摘录/);
const unsafeSourceMirrorWorkspace = updateSession(noSourceBase, noSourceSession.id, {
  sourceTitle: "Unsafe source",
  sourceUrl: "javascript:alert(1)",
  materialType: "article"
});
const unsafeSourceMirrorIndexHtml = generateMirrorIndexHtml(unsafeSourceMirrorWorkspace, frozenToday);
assert.match(unsafeSourceMirrorIndexHtml, /Capture on this device/);
assert.match(unsafeSourceMirrorIndexHtml, /在此设备摘录/);
assert.doesNotMatch(unsafeSourceMirrorIndexHtml, /Read source on this device|Resume source on this device|javascript:alert/);
const bareQuestionWorkspace = addCapture(noSourceMirrorWorkspace, noSourceSession.id, {
  thought: "Question:",
  tags: "question"
}, { now: "2099-01-02T00:40:00.000Z" });
const bareQuestionMirrorIndexHtml = generateMirrorIndexHtml(bareQuestionWorkspace, frozenToday);
assert.match(bareQuestionMirrorIndexHtml, /Capture on this device/);
assert.doesNotMatch(bareQuestionMirrorIndexHtml, /Answer next question/);
assert.doesNotMatch(bareQuestionMirrorIndexHtml, /Read source on this device/);

const payload = buildFeishuPayload(session);
assert.equal(payload.schema, "learning-companion.feishu-export.v1");
assert.equal(payload.session.id, session.id);
assert.equal(payload.focusBrief.sessionId, session.id);
assert.equal(payload.focusBrief.nextAction.kind, "review");

const mirror = buildMirrorBundle(workspace);
assert.equal(mirror.schema, "learning-companion.mirror-bundle.staging.v1");
assert.equal(mirror.contractStability, "experimental");
assert.equal(mirror.canonical, "workspace.json");
assert.equal(mirror.semantics.snapshot, "full");
assert.equal(mirror.workspace.sessionCount, workspace.sessions.length);
assert.equal(mirror.manifest.fileCount, 6 + workspace.sessions.length * 2);
assert.equal(mirror.files.some((file) => file.path === "index.html" && file.role === "mirror-home" && /^fnv1a-[a-f0-9]{8}$/.test(file.sourceFingerprint) && file.content.includes("Return-ready mirror")), true);
assert.equal(mirror.files.some((file) => file.path === "workspace.json" && file.role === "workspace-restore"), true);
assert.equal(mirror.files.some((file) => file.path === "TODAY.md" && file.role === "study-pack"), true);
assert.equal(mirror.files.some((file) => file.path === "review.html" && file.role === "portable-review" && /^fnv1a-[a-f0-9]{8}$/.test(file.sourceFingerprint) && /^fnv1a-[a-f0-9]{8}$/.test(file.sourceReturnBaseFingerprint) && file.content.includes("Return-ready mirror")), true);
assert.equal(mirror.files.some((file) => file.path === "inbox.html" && file.role === "mobile-inbox" && /^fnv1a-[a-f0-9]{8}$/.test(file.sourceReturnBaseFingerprint) && file.content.includes("Return-ready mirror")), true);
assert.equal(mirror.files.some((file) => file.path === "inbox.html" && file.role === "mobile-inbox" && file.content.includes("Learning Companion Inbox")), true);
assert.equal(mirror.files.some((file) => file.path === "TODAY.md" && /Due Review/.test(file.content)), true);
assert.equal(mirror.files.some((file) => file.path.endsWith(".md") && /Rust ownership course/.test(file.content)), true);
const mirrorReadme = mirror.files.find((file) => file.path === "README.md")?.content || "";
assert.match(mirrorReadme, /Learning Companion Mirror/);
assert.match(mirrorReadme, /This bundle is an experimental full snapshot/);
assert.match(mirrorReadme, /## Restore/);
assert.match(mirrorReadme, /Keep `workspace\.json` as the canonical restore payload/);
assert.match(mirrorReadme, /## Files/);
assert.match(mirrorReadme, /File paths, schema names, role strings, and byte counts stay unchanged for sync\./);
assert.match(mirrorReadme, /学习伴侣镜像/);
assert.match(mirrorReadme, /导出主题数：/);
assert.match(mirrorReadme, /工作区 schema：/);
assert.match(mirrorReadme, /_中文：恢复_/);
assert.match(mirrorReadme, /把 `workspace\.json` 作为权威恢复载荷保留/);
assert.match(mirrorReadme, /_中文：文件_/);
assert.match(mirrorReadme, /文件路径、schema 名称、role 字符串和字节数为同步保持不变。/);
assert.match(mirrorReadme, /中文：镜像首页/);
const mirrorHome = mirror.files.find((file) => file.path === "index.html")?.content || "";
const mirrorDeviceHref = mirrorHome.match(/class="device-next-link" href="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&") || "";
assert.equal(mirror.files.some((file) => file.path === mirrorDeviceHref.split("?")[0]), true);
assert.equal(mirror.files.every((file) => file.encoding === "utf-8"), true);
assert.equal(mirror.files.every((file) => /^fnv1a-[a-f0-9]{8}$/.test(file.contentFingerprint)), true);
assert.equal(/^fnv1a-[a-f0-9]{8}$/.test(mirror.manifest.bundleFingerprint), true);

const mirrorZip = buildMirrorZip(workspace);
const mirrorZipNames = listZipFileNames(mirrorZip.data);
assert.equal(mirrorZip.filename, "learning-companion-mirror.zip");
assert.equal(mirrorZip.mediaType, "application/zip");
assert.equal(mirrorZip.fileCount, mirror.manifest.fileCount);
assert.equal(mirrorZip.bytes, mirrorZip.data.length);
assert.equal(mirrorZipNames.length, mirror.files.length);
assert.equal(mirrorZipNames.includes("workspace.json"), true);
assert.equal(mirrorZipNames.includes("index.html"), true);
assert.equal(mirrorZipNames.includes("README.md"), true);
assert.equal(mirrorZipNames.includes("TODAY.md"), true);
assert.equal(mirrorZipNames.includes("review.html"), true);
assert.equal(mirrorZipNames.includes("inbox.html"), true);
assert.equal(mirrorZipNames.some((path) => path.endsWith(".md") && path.startsWith("sessions/")), true);
assert.equal(mirrorZipNames.some((path) => path.endsWith(".feishu.json")), true);

const uploadPlan = buildFeishuUploadPlan(mirror, {
  rootName: "Tony Learning Mirror",
  generatedAt: "2026-05-29T08:00:00.000+08:00"
});
assert.equal(uploadPlan.schema, FEISHU_UPLOAD_PLAN_SCHEMA);
assert.equal(uploadPlan.planVersion, 1);
assert.equal(uploadPlan.evidence.tier, "DRY_RUN");
assert.equal(uploadPlan.bundleFingerprint, mirror.manifest.bundleFingerprint);
assert.equal(uploadPlan.provider.name, "feishu-drive");
assert.equal(uploadPlan.provider.auth.status, "not-included");
assert.equal(uploadPlan.provider.auth.reason, "credential-free-planner");
assert.equal(uploadPlan.source.bundleFingerprint, mirror.manifest.bundleFingerprint);
assert.equal(uploadPlan.source.fileCount, mirror.manifest.fileCount);
assert.equal(uploadPlan.target.layout, "folder-files");
assert.equal(uploadPlan.files.length, mirror.files.length);
assert.equal(uploadPlan.files.every((file) => file.action === "upsert"), true);
assert.equal(uploadPlan.files.some((file) => file.path === "TODAY.md" && file.role === "study-pack"), true);
assert.equal(uploadPlan.files.some((file) => file.path === "workspace.json" && file.role === "workspace-restore"), true);
const uploadOutDir = mkdtempSync(join(tempBase, "feishu-upload-"));
try {
  const uploadResult = materializeMirrorBundle(mirror, uploadOutDir, { plan: uploadPlan });
  assert.equal(uploadResult.ok, true);
  assert.equal(uploadResult.fileCount, mirror.files.length);
  assert.equal(uploadResult.bundleFingerprint, mirror.manifest.bundleFingerprint);
  assert.equal(existsSync(join(uploadOutDir, "files", "TODAY.md")), true);
  assert.equal(existsSync(join(uploadOutDir, "files", "workspace.json")), true);
  assert.equal(existsSync(join(uploadOutDir, "feishu-upload-plan.json")), true);
  const dryRunReport = buildFeishuUploadDryRunReport(uploadPlan, join(uploadOutDir, "files"), {
    generatedAt: "2026-05-29T08:01:00.000+08:00"
  });
  assert.equal(dryRunReport.schema, FEISHU_UPLOAD_REPORT_SCHEMA);
  assert.equal(dryRunReport.evidence.tier, "DRY_RUN");
  assert.equal(dryRunReport.mode, "dry-run");
  assert.equal(dryRunReport.ok, true);
  assert.equal(dryRunReport.boundary.network, "not-called");
  assert.match(dryRunReport.boundary.statement, /No network call was made/);
  assert.equal(dryRunReport.wouldSend.status, "not-sent");
  assert.equal(dryRunReport.wouldSend.requestCount, mirror.files.length);
  assert.equal(dryRunReport.wouldSend.requests.every((request) => request.adapterAction === "upsert"), true);
  assert.equal(dryRunReport.wouldSend.requests.every((request) => /^[a-f0-9]{64}$/.test(request.payloadSha256)), true);
  assert.equal(dryRunReport.targetTree.rootName, "Tony Learning Mirror");
  assert.equal(dryRunReport.targetTree.directories.includes("sessions"), true);
  assert.equal(dryRunReport.targetTree.files.length, mirror.files.length);
  assert.equal(dryRunReport.targetTree.files.every((file) => /^[a-f0-9]{64}$/.test(file.payloadSha256)), true);
  assert.equal(dryRunReport.targetTree.files.some((file) => file.path === "TODAY.md" && file.filename === "TODAY.md"), true);
  assert.equal(dryRunReport.summary.plannedFiles, mirror.files.length);
  assert.equal(dryRunReport.summary.verifiedFiles, mirror.files.length);
  assert.equal(dryRunReport.summary.wouldUpsert, mirror.files.length);
  assert.equal(dryRunReport.files.every((file) => file.status === "would-upsert"), true);
  assert.equal(dryRunReport.files.every((file) => /^[a-f0-9]{64}$/.test(file.payloadSha256)), true);
} finally {
  if (cleanupSmokeArtifacts) rmSync(uploadOutDir, { recursive: true, force: true });
}
assert.throws(() => buildFeishuUploadPlan({
  ...mirror,
  schema: "learning-companion.mirror-bundle.staging.v2"
}), /Unsupported mirror bundle schema/);
assert.throws(() => buildFeishuUploadPlan({
  ...mirror,
  files: mirror.files.map((file, index) => index === 0 ? { ...file, path: "../escape.md" } : file)
}), /Unsafe mirror path/);
assert.throws(() => buildFeishuUploadPlan({
  ...mirror,
  files: mirror.files.map((file, index) => index === 0 ? { ...file, path: "C:/escape.md" } : file)
}), /Unsafe mirror path/);
assert.throws(() => buildFeishuUploadPlan({
  ...mirror,
  files: [...mirror.files, { ...mirror.files[0] }]
}), /Duplicate mirror path/);
assert.throws(() => buildFeishuUploadPlan({
  ...mirror,
  files: mirror.files.map((file) => file.path === "workspace.json" ? { ...file, bytes: file.bytes + 1 } : file)
}), /byte count mismatch/);
assert.throws(() => buildFeishuUploadPlan({
  ...mirror,
  files: mirror.files.filter((file) => file.path !== "workspace.json")
}), /exactly one workspace.json/);
assert.throws(() => buildFeishuUploadDryRunReport({
  ...uploadPlan,
  provider: { ...uploadPlan.provider, auth: { status: "configured" } }
}, "/tmp"), /must not include auth/);
assert.throws(() => buildFeishuUploadDryRunReport({
  ...uploadPlan,
  files: uploadPlan.files.map((file, index) => index === 0 ? { ...file, action: "delete" } : file)
}, "/tmp"), /Unsupported upload action/);
const overwriteOutDir = mkdtempSync(join(tempBase, "feishu-overwrite-"));
try {
  materializeMirrorBundle(mirror, overwriteOutDir, { plan: uploadPlan });
  assert.throws(() => materializeMirrorBundle(mirror, overwriteOutDir, { plan: uploadPlan }), /already exists/);
} finally {
  if (cleanupSmokeArtifacts) rmSync(overwriteOutDir, { recursive: true, force: true });
}
const symlinkOutDir = mkdtempSync(join(tempBase, "feishu-symlink-"));
try {
  mkdirSync(join(symlinkOutDir, "files"), { recursive: true });
  const symlinkTarget = join(tempBase, "symlink-target");
  mkdirSync(symlinkTarget, { recursive: true, mode: 0o700 });
  symlinkSync(symlinkTarget, join(symlinkOutDir, "files", "sessions"), "dir");
  assert.throws(() => materializeMirrorBundle(mirror, symlinkOutDir, { plan: uploadPlan, force: true }), /symbolic link/);
} finally {
  if (cleanupSmokeArtifacts) rmSync(symlinkOutDir, { recursive: true, force: true });
}

const restoredWorkspaceFile = mirror.files.find((file) => file.path === "workspace.json");
const restoredWorkspace = sanitizeWorkspace(JSON.parse(restoredWorkspaceFile.content));
const importedFromMirror = workspaceFromPortableData(mirror);
assert.equal(importedFromMirror.activeSessionId, workspace.activeSessionId);
assert.equal(getActiveSession(importedFromMirror).title, session.title);
const sidecarPoisoned = workspaceFromPortableData({
  ...mirror,
  files: mirror.files.map((file) => file.role === "session-sidecar"
    ? { ...file, content: JSON.stringify({ sessions: [{ title: "Poisoned sidecar" }] }) }
    : file)
});
assert.equal(getActiveSession(sidecarPoisoned).title, session.title);
const restoredMirror = buildMirrorBundle(restoredWorkspace);
assert.deepEqual(
  restoredMirror.files.map((file) => file.path).sort(),
  mirror.files.map((file) => file.path).sort()
);
assert.throws(() => workspaceFromPortableData({
  ...mirror,
  canonical: "sessions/first.md"
}), /canonical/);
assert.throws(() => workspaceFromPortableData({
  ...mirror,
  files: [
    ...mirror.files,
    { ...restoredWorkspaceFile, path: "backup-workspace.json" }
  ]
}), /exactly one/);
assert.throws(() => workspaceFromPortableData({
  ...mirror,
  files: mirror.files.map((file) => file.path === "workspace.json"
    ? { ...file, content: "not json" }
    : file)
}), /not valid JSON/);

const collisionWorkspace = sanitizeWorkspace({
  ...workspace,
  activeSessionId: "same_a",
  sessions: [
    createSession({ id: "same_a", title: "Algebra" }, workspace.clientId),
    createSession({ id: "same_b", title: "algebra" }, workspace.clientId),
    createSession({ id: "reserved_con", title: "CON" }, workspace.clientId)
  ]
});
const collisionBundle = buildMirrorBundle(collisionWorkspace);
const markdownPaths = collisionBundle.files.filter((file) => file.path.endsWith(".md")).map((file) => file.path);
assert.equal(new Set(markdownPaths).size, markdownPaths.length);
assert.equal(markdownPaths.some((path) => /topic-con/.test(path)), true);

workspace = promoteCapture(workspace, session.id, session.captures[0].id);
session = getActiveSession(workspace);
assert.equal(session.reviewCards.length, 1);

let cleanupWorkspace = addCapture(workspace, session.id, {
  quote: "Temporary capture for cleanup.",
  thought: "This should be removable."
}, { promoteToReview: true });
let cleanupSession = getActiveSession(cleanupWorkspace);
const cleanupCaptureId = cleanupSession.captures[0].id;
const cleanupCardId = cleanupSession.reviewCards[0].id;
cleanupWorkspace = deleteReviewCard(cleanupWorkspace, cleanupSession.id, cleanupCardId);
cleanupSession = getActiveSession(cleanupWorkspace);
assert.equal(cleanupSession.reviewCards.some((card) => card.id === cleanupCardId), false);
assert.equal(cleanupSession.captures.find((capture) => capture.id === cleanupCaptureId).promotedToReview, false);
cleanupWorkspace = promoteCapture(cleanupWorkspace, cleanupSession.id, cleanupCaptureId);
cleanupSession = getActiveSession(cleanupWorkspace);
assert.equal(cleanupSession.reviewCards.some((card) => card.sourceCaptureId === cleanupCaptureId), true);
cleanupWorkspace = deleteCapture(cleanupWorkspace, cleanupSession.id, cleanupCaptureId);
cleanupSession = getActiveSession(cleanupWorkspace);
assert.equal(cleanupSession.captures.some((capture) => capture.id === cleanupCaptureId), false);
assert.equal(cleanupSession.reviewCards.some((card) => card.sourceCaptureId === cleanupCaptureId), false);

workspace = gradeCard(workspace, session.id, session.reviewCards[0].id, "good");
session = getActiveSession(workspace);
assert.equal(session.reviewCards[0].strength, 1);
assert.equal(getDueReviewCards(session).length, 0);
assert.equal(reviewIntervalDays(0), 0);
assert.equal(reviewIntervalDays(2), 3);
assert.equal(reviewIntervalDays(5), 30);

const now = new Date("2026-05-29T00:00:00.000Z");
const failed = applyGrade({ ...session.reviewCards[0], strength: 1 }, "again", now);
const passed = applyGrade({ ...session.reviewCards[0], strength: 1 }, "good", now);
assert.equal(failed.strength, 0);
assert.equal(passed.strength, 2);
assert.ok(new Date(failed.dueAt).getTime() < new Date(passed.dueAt).getTime());

const filtered = filterSessions(workspace, "ownership");
assert.equal(filtered.length, 1);
const captureSearch = searchWorkspace(workspace, "lifetime", 5);
assert.equal(captureSearch[0].type, "capture");
assert.equal(captureSearch[0].sessionId, session.id);
assert.equal(captureSearch[0].targetId, session.captures[0].id);
assert.match(captureSearch[0].excerpt, /lifetime/);
const splitCaptureSearch = searchWorkspace(workspace, "rust lifetime", 5);
assert.equal(splitCaptureSearch[0].type, "capture");
assert.equal(splitCaptureSearch[0].targetId, session.captures[0].id);
assert.match(splitCaptureSearch[0].matchLabel, /2 terms:/);
const splitSourceSearch = searchWorkspace(workspace, "rustconf video", 5);
assert.equal(splitSourceSearch[0].type, "session");
assert.match(splitSourceSearch[0].matchLabel, /2 terms:/);
let splitGuardWorkspace = createDefaultWorkspace();
splitGuardWorkspace = addSession(splitGuardWorkspace, "Zebra source only");
splitGuardWorkspace = addSession(splitGuardWorkspace, "Quartz topic only");
assert.equal(searchWorkspace(splitGuardWorkspace, "zebra quartz", 5).length, 0);
let cjkSearchWorkspace = createDefaultWorkspace();
cjkSearchWorkspace = addSession(cjkSearchWorkspace, "中文学习");
let cjkSession = getActiveSession(cjkSearchWorkspace);
cjkSearchWorkspace = addCapture(cjkSearchWorkspace, cjkSession.id, {
  quote: "保持焦点，不要被浏览器标签打断。",
  thought: "侧边栏应该帮助回到上下文。",
  tags: "学习"
});
const cjkSearch = searchWorkspace(cjkSearchWorkspace, "学习 焦点", 5);
assert.equal(cjkSearch[0].type, "capture");
assert.match(cjkSearch[0].matchLabel, /2 terms:/);
const sourceSearch = searchWorkspace(workspace, "RustConf", 5);
assert.equal(sourceSearch.some((result) => result.type === "session" && result.matchLabel === "Source"), true);
const reviewSearch = searchWorkspace(workspace, "garbage collector", 5);
assert.equal(reviewSearch.some((result) => result.type === "review" && result.targetId === session.reviewCards[0].id), true);
workspace = updateSession(workspace, session.id, {
  notesMarkdown: `${session.notesMarkdown}\n\nRemember the borrow checker comparison.`
});
session = getActiveSession(workspace);
const noteSearch = searchWorkspace(workspace, "borrow checker", 5);
assert.equal(noteSearch.some((result) => result.type === "note" && result.sessionId === session.id), true);
const cappedSearch = searchWorkspace(workspace, `${"x".repeat(MAX_SEARCH_QUERY_LENGTH + 50)}lifetime`, 5);
assert.equal(cappedSearch.length, 0);

const sanitized = sanitizeWorkspace(JSON.parse(JSON.stringify(workspace)));
assert.equal(sanitized.activeSessionId, workspace.activeSessionId);
assert.equal(sanitized.schemaVersion, WORKSPACE_SCHEMA_VERSION);

const legacyWorkspace = sanitizeWorkspace({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  version: WORKSPACE_SCHEMA_VERSION,
  clientId: "client_legacy",
  activeSessionId: "legacy_session",
  sessions: [{
    id: "legacy_session",
    originClientId: "client_legacy",
    title: "Legacy source",
    sourceTitle: "Legacy doc",
    sourceUrl: "https://example.com/legacy",
    materialType: "doc",
    tags: [],
    focusMode: "capture",
    notesMarkdown: "",
    captures: [{
      id: "legacy_capture",
      originClientId: "client_legacy",
      quote: "Old capture",
      thought: "",
      timestamp: "",
      tags: [],
      createdAt: "2026-05-29T00:00:00.000Z",
      capturedAt: "2026-05-29T00:00:00.000Z",
      updatedAt: "2026-05-29T00:00:00.000Z",
      promotedToReview: false
    }],
    reviewCards: [],
    createdAt: "2026-05-29T00:00:00.000Z",
    updatedAt: "2026-05-29T00:00:00.000Z"
  }],
  createdAt: "2026-05-29T00:00:00.000Z",
  updatedAt: "2026-05-29T00:00:00.000Z"
});
const legacyCapture = getActiveSession(legacyWorkspace).captures[0];
assert.equal(legacyCapture.sourceTitle, "Legacy doc");
assert.equal(legacyCapture.sourceUrl, "https://example.com/legacy");
assert.equal(legacyCapture.materialType, "doc");
assert.equal(legacyCapture.sourceProvenance, "inherited");

const roundTrip = sanitizeWorkspace(JSON.parse(JSON.stringify(sanitized)));
assert.equal(roundTrip.clientId, workspace.clientId);
assert.equal(getActiveSession(roundTrip).reviewCards.length, 1);

assert.throws(() => sanitizeWorkspace({
  schema: WORKSPACE_SCHEMA,
  schemaVersion: WORKSPACE_SCHEMA_VERSION + 1,
  version: WORKSPACE_SCHEMA_VERSION + 1,
  sessions: []
}), /Unsupported workspace version/);

console.log("smoke_web_ok");

function listZipFileNames(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const decoder = new TextDecoder();
  let endOffset = -1;
  for (let offset = data.length - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  assert.notEqual(endOffset, -1);
  const entryCount = view.getUint16(endOffset + 10, true);
  let offset = view.getUint32(endOffset + 16, true);
  const names = [];
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(view.getUint32(offset, true), 0x02014b50);
    assert.equal((view.getUint16(offset + 8, true) & 0x0800) > 0, true);
    assert.equal(view.getUint16(offset + 10, true), 0);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    names.push(decoder.decode(data.slice(offset + 46, offset + 46 + nameLength)));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}
