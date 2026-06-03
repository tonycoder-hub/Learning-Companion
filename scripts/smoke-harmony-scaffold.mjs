#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  MOBILE_INBOX_PATCH_SCHEMA,
  REVIEW_PROGRESS_PATCH_SCHEMA,
  WORKSPACE_SCHEMA
} from "../apps/companion-web/src/model.js";
import { HARMONY_IMPORT_RECEIPT_SCHEMA } from "../apps/companion-harmony/src/import-boundary.mjs";
import { HARMONY_READER_VIEW_SCHEMA } from "../apps/companion-harmony/src/schema-reader.mjs";

export const HARMONY_SCAFFOLD_REPORT_SCHEMA = "learning-companion.harmony-scaffold-report.v1";

const ROOT = "apps/companion-harmony-dev";
const REQUIRED_FILES = Object.freeze([
  "README.md",
  "build-profile.json5",
  "hvigorfile.ts",
  "oh-package.json5",
  "AppScope/app.json5",
  "AppScope/resources/base/element/string.json",
  "AppScope/resources/base/media/app_icon.svg",
  "entry/build-profile.json5",
  "entry/hvigorfile.ts",
  "entry/oh-package.json5",
  "entry/src/main/module.json5",
  "entry/src/main/resources/base/profile/main_pages.json",
  "entry/src/main/resources/base/element/string.json",
  "entry/src/main/resources/base/element/color.json",
  "entry/src/main/ets/entryability/EntryAbility.ets",
  "entry/src/main/ets/pages/Index.ets",
  "entry/src/main/ets/pages/TopicDetail.ets",
  "entry/src/main/ets/pages/ReviewQueue.ets",
  "entry/src/main/ets/pages/ImportReceipt.ets",
  "entry/src/main/ets/model/workspace.ets",
  "entry/src/main/ets/model/harmonyReaderView.ets",
  "entry/src/main/ets/services/importPortableData.ets",
  "entry/src/main/ets/services/readerSessionState.ets",
  "entry/src/main/ets/services/exportPatch.ets"
]);

export function buildHarmonyScaffoldReport(options = {}) {
  const root = options.root || ROOT;
  const files = new Map(REQUIRED_FILES.map((path) => [path, read(root, path)]));
  const appConfig = JSON.parse(files.get("AppScope/app.json5"));
  const moduleConfig = JSON.parse(files.get("entry/src/main/module.json5"));
  const pages = JSON.parse(files.get("entry/src/main/resources/base/profile/main_pages.json")).src;
  const diskFiles = listFiles(root);
  const arktsSchemas = extractArktsSchemaConstants(files.get("entry/src/main/ets/model/workspace.ets"));
  const readerNextActionFields = extractArktsInterfaceFields(files.get("entry/src/main/ets/model/workspace.ets"), "HarmonyReaderNextAction");
  const jsReaderSessionText = readFileSync("apps/companion-harmony/src/import-session.mjs", "utf8");
  const arktsReaderSessionText = files.get("entry/src/main/ets/services/readerSessionState.ets");
  const topicDetailText = files.get("entry/src/main/ets/pages/TopicDetail.ets");
  const topicDetailOpenQuestionBranch = textBetween(topicDetailText, "if (selectedSection === 'open_questions')", "if (selectedSection === 'answers_today')");
  const topicDetailAnswersTodayBranch = textBetween(topicDetailText, "if (selectedSection === 'answers_today')", "Text('Read-only topic detail");
  const readerSessionStatusLiterals = [
    "empty",
    "accepted-pending-persist",
    "ready",
    "rejected-kept-current",
    "rejected-empty",
    "pending-device-persistence",
    "persisted-by-device-adapter"
  ];
  const jsSchemas = {
    WORKSPACE_SCHEMA,
    MIRROR_BUNDLE_SCHEMA: extractJsMirrorBundleSchema(),
    HARMONY_READER_VIEW_SCHEMA,
    MOBILE_INBOX_PATCH_SCHEMA,
    REVIEW_PROGRESS_PATCH_SCHEMA,
    HARMONY_IMPORT_RECEIPT_SCHEMA
  };
  const checks = [
    check("required_file_allowlist", sameArray(diskFiles, [...REQUIRED_FILES].sort())),
    check("bundle_name", appConfig.app.bundleName === "com.tonycoder.learningcompanion"),
    check("vendor", appConfig.app.vendor === "Tony Coder"),
    check("app_scope_string", /Learning Companion/.test(files.get("AppScope/resources/base/element/string.json"))),
    check("app_icon_resource", /<svg/.test(files.get("AppScope/resources/base/media/app_icon.svg"))),
    check("root_build_profile", /"modules"/.test(files.get("build-profile.json5"))),
    check("root_hvigorfile", /appTasks/.test(files.get("hvigorfile.ts"))),
    check("entry_hvigorfile", /hapTasks/.test(files.get("entry/hvigorfile.ts"))),
    check("entry_ability", moduleConfig.module.mainElement === "EntryAbility"),
    check("profile_pages", moduleConfig.module.pages === "$profile:main_pages"),
    check("phone_device_type", moduleConfig.module.deviceTypes.includes("phone")),
    check("launcher_skill", JSON.stringify(moduleConfig.module.abilities?.[0]?.skills || []).includes("action.system.home")),
    check("page_list", sameArray(pages, ["pages/Index", "pages/TopicDetail", "pages/ReviewQueue", "pages/ImportReceipt"])),
    check("readme_boundary", /not claimed as a compiled HarmonyOS app/.test(files.get("README.md"))),
    check("entry_loads_index", /loadContent\('pages\/Index'\)/.test(files.get("entry/src/main/ets/entryability/EntryAbility.ets"))),
    ...Object.entries(jsSchemas).map(([name, value]) => check(`schema_parity_${name}`, arktsSchemas[name] === value)),
    check("import_service", /importPortableJsonText/.test(files.get("entry/src/main/ets/services/importPortableData.ets"))),
    check("unsupported_receipt", /UNSUPPORTED_PORTABLE_DATA/.test(files.get("entry/src/main/ets/services/importPortableData.ets"))),
    check("import_picker_contract", /HARMONY_IMPORT_MAX_BYTES/.test(files.get("entry/src/main/ets/services/importPortableData.ets")) && /validatePortableFileCandidate/.test(files.get("entry/src/main/ets/services/importPortableData.ets")) && /describeImportPickerContract/.test(files.get("entry/src/main/ets/services/importPortableData.ets")) && /INVALID_FILE_SIZE/.test(files.get("entry/src/main/ets/services/importPortableData.ets")) && /toLowerCase\(\)/.test(files.get("entry/src/main/ets/services/importPortableData.ets"))),
    check("import_picker_index_copy", /JSON <= 5 MB/.test(files.get("entry/src/main/ets/pages/Index.ets")) && /workspace or mirror bundle/.test(files.get("entry/src/main/ets/pages/Index.ets"))),
    check("import_receipt_picker_errors", /INVALID_FILE_SIZE/.test(files.get("entry/src/main/ets/pages/ImportReceipt.ets")) && /PORTABLE_FILE_TOO_LARGE/.test(files.get("entry/src/main/ets/pages/ImportReceipt.ets")) && /UNSUPPORTED_FILE_TYPE/.test(files.get("entry/src/main/ets/pages/ImportReceipt.ets"))),
    check("readme_import_picker_contract", /5 MB max/.test(files.get("README.md")) && /Non-JSON files/.test(files.get("README.md"))),
    check("reader_session_state", /ReaderSessionState/.test(arktsReaderSessionText) && /accepted-pending-persist/.test(arktsReaderSessionText) && /rejected-kept-current/.test(arktsReaderSessionText) && /pending-device-persistence/.test(arktsReaderSessionText)),
    check("reader_session_status_parity", readerSessionStatusLiterals.every((literal) => jsReaderSessionText.includes(literal) && arktsReaderSessionText.includes(literal))),
    check("index_uses_reader_session", /createScaffoldReaderSession/.test(files.get("entry/src/main/ets/pages/Index.ets")) && /summarizeReaderSessionState/.test(files.get("entry/src/main/ets/pages/Index.ets")) && /importStatus\.message/.test(files.get("entry/src/main/ets/pages/Index.ets"))),
    check("topic_detail_uses_reader_session", /createScaffoldReaderSession/.test(topicDetailText) && /latestCapture/.test(topicDetailText) && /Manual Return/.test(topicDetailText)),
    check("topic_detail_route_sections", /router\.getParams\(\)/.test(topicDetailText) && /interface TopicDetailRouteParams/.test(topicDetailText) && /readTopicDetailRouteParams/.test(topicDetailText) && /routeTopicId/.test(topicDetailText) && /topicId/.test(topicDetailText) && /Open Questions Across Topics/.test(topicDetailText) && /Answers Today Across Topics/.test(topicDetailText) && /No open questions in the imported reader view/.test(topicDetailText) && /No answers today in the imported reader view/.test(topicDetailText)),
    check("topic_detail_section_mapping", /readerView\.openQuestions/.test(topicDetailOpenQuestionBranch) && !/readerView\.answersToday/.test(topicDetailOpenQuestionBranch) && /readerView\.answersToday/.test(topicDetailAnswersTodayBranch) && !/readerView\.openQuestions/.test(topicDetailAnswersTodayBranch)),
    check("review_queue_uses_reader_session", /createScaffoldReaderSession/.test(files.get("entry/src/main/ets/pages/ReviewQueue.ets")) && /dueReview/.test(files.get("entry/src/main/ets/pages/ReviewQueue.ets")) && /Manual Return/.test(files.get("entry/src/main/ets/pages/ReviewQueue.ets"))),
    check("return_to_mac_contract", /describeReturnToMacContract/.test(files.get("entry/src/main/ets/services/exportPatch.ets")) && /append-only return JSON/.test(files.get("entry/src/main/ets/services/exportPatch.ets")) && /Today > Return Files/.test(files.get("entry/src/main/ets/services/exportPatch.ets")) && /manual Feishu Drive/.test(files.get("entry/src/main/ets/services/exportPatch.ets"))),
    check("return_to_mac_pages", /describeReturnToMacContract/.test(files.get("entry/src/main/ets/pages/Index.ets")) && /Import \+ Return/.test(files.get("entry/src/main/ets/pages/Index.ets")) && ["entry/src/main/ets/pages/TopicDetail.ets", "entry/src/main/ets/pages/ReviewQueue.ets"].every((path) => /describeReturnToMacContract/.test(files.get(path)) && /Manual Return/.test(files.get(path))) && /describeReturnToMacContract/.test(files.get("entry/src/main/ets/pages/ImportReceipt.ets")) && /Next Phone Pass/.test(files.get("entry/src/main/ets/pages/ImportReceipt.ets"))),
    check("return_to_mac_pages_shared_source", ["entry/src/main/ets/pages/Index.ets", "entry/src/main/ets/pages/TopicDetail.ets", "entry/src/main/ets/pages/ReviewQueue.ets", "entry/src/main/ets/pages/ImportReceipt.ets"].every((path) => /returnToMac\[\d\]/.test(files.get(path)) && !/manual Feishu Drive|Today > Return Files/.test(files.get(path)))),
    check("inbox_patch_export", /buildInboxPatch/.test(files.get("entry/src/main/ets/services/exportPatch.ets"))),
    check("review_patch_export", /buildReviewProgressPatch/.test(files.get("entry/src/main/ets/services/exportPatch.ets"))),
    check("focus_action_open_source_kind", /'open_source'/.test(files.get("entry/src/main/ets/model/workspace.ets"))),
    check("focus_action_detail_reason", /detail: string/.test(files.get("entry/src/main/ets/model/workspace.ets")) && /reason: string/.test(files.get("entry/src/main/ets/model/workspace.ets"))),
    check("reader_next_action_contract", /HarmonyReaderNextActionKind/.test(files.get("entry/src/main/ets/model/workspace.ets")) && /HarmonyReaderRoute/.test(files.get("entry/src/main/ets/model/workspace.ets")) && /HarmonyReaderSurface/.test(files.get("entry/src/main/ets/model/workspace.ets")) && /HARMONY_READER_NEXT_ACTION_PRIORITY/.test(files.get("entry/src/main/ets/model/workspace.ets")) && /interface HarmonyReaderNextAction/.test(files.get("entry/src/main/ets/model/workspace.ets")) && /readerNextAction: HarmonyReaderNextAction/.test(files.get("entry/src/main/ets/model/workspace.ets"))),
    check("reader_next_action_field_parity", sameArray(readerNextActionFields, ["kind", "label", "detail", "route", "routeLabel", "meta", "secondary", "secondaryAction", "generatedAt", "surface"])),
    check("reader_next_secondary_action_contract", /interface HarmonyReaderSecondaryAction/.test(files.get("entry/src/main/ets/model/workspace.ets")) && /interface HarmonyReaderRouteParams/.test(files.get("entry/src/main/ets/model/workspace.ets")) && /secondaryAction\?: HarmonyReaderSecondaryAction/.test(files.get("entry/src/main/ets/model/workspace.ets")) && /routeParams\?: HarmonyReaderRouteParams/.test(files.get("entry/src/main/ets/model/workspace.ets")) && /readerNext\.secondaryAction/.test(files.get("entry/src/main/ets/pages/Index.ets")) && /secondaryAction\.routeLabel/.test(files.get("entry/src/main/ets/pages/Index.ets")) && /secondaryAction\.routeParams/.test(files.get("entry/src/main/ets/pages/Index.ets"))),
    check("reader_next_action_empty_view", /readerNextAction/.test(files.get("entry/src/main/ets/model/harmonyReaderView.ets")) && /Import mirror JSON/.test(files.get("entry/src/main/ets/model/harmonyReaderView.ets"))),
    check("reader_next_index", /Phone Next/.test(files.get("entry/src/main/ets/pages/Index.ets")) && /readerNext\.label/.test(files.get("entry/src/main/ets/pages/Index.ets")) && /readerNext\.routeLabel/.test(files.get("entry/src/main/ets/pages/Index.ets")) && /router\.pushUrl\(\{ url: readerNext\.route \}\)/.test(files.get("entry/src/main/ets/pages/Index.ets"))),
    check("answers_today_contract", /interface AnswerToday/.test(files.get("entry/src/main/ets/model/workspace.ets")) && /answerCaptureCountToday: number/.test(files.get("entry/src/main/ets/model/workspace.ets")) && /answeredAtSource: AnsweredAtSource/.test(files.get("entry/src/main/ets/model/workspace.ets"))),
    check("resume_here_page", /Resume Here/.test(files.get("entry/src/main/ets/pages/Index.ets"))),
    check("answers_today_page", /Answers Today/.test(files.get("entry/src/main/ets/pages/Index.ets"))),
    check("review_reveal_page", /Reveal Answer/.test(files.get("entry/src/main/ets/pages/ReviewQueue.ets"))),
    check("no_forbidden_credentials", [...files].every(([, text]) => !/mira_session|open_csrf_token|Authorization:\s*Bearer|Set-Cookie:/i.test(text)))
  ];

  return {
    schema: HARMONY_SCAFFOLD_REPORT_SCHEMA,
    evidence: {
      tier: "HANDOFF_ONLY",
      label: "EVIDENCE: HANDOFF_ONLY",
      reason: "DevEco scaffold structure and ArkTS contract names are checked locally; no SDK compile or device run is claimed."
    },
    checkedAt: options.checkedAt || new Date().toISOString(),
    ok: checks.every((item) => item.ok),
    root,
    fileCount: REQUIRED_FILES.length,
    requiredFiles: REQUIRED_FILES,
    diskFiles,
    app: {
      bundleName: appConfig.app.bundleName,
      vendor: appConfig.app.vendor,
      versionName: appConfig.app.versionName
    },
    pages,
    schemaParity: Object.fromEntries(Object.entries(jsSchemas).map(([name, value]) => [name, {
      js: value,
      arkts: arktsSchemas[name],
      ok: arktsSchemas[name] === value
    }])),
    checks
  };
}

function check(name, ok) {
  return { name, ok: Boolean(ok) };
}

function sameArray(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function read(root, path) {
  return readFileSync(join(root, path), "utf8");
}

function listFiles(root) {
  const paths = [];
  walk(root, paths);
  return paths.map((path) => relative(root, path).split(sep).join("/")).sort();
}

function walk(path, paths) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) walk(child, paths);
    else if (entry.isFile()) paths.push(child);
  }
}

function extractArktsSchemaConstants(text) {
  const constants = {};
  for (const match of text.matchAll(/export const ([A-Z_]+) = '([^']+)'/g)) {
    constants[match[1]] = match[2];
  }
  return constants;
}

function extractArktsInterfaceFields(text, interfaceName) {
  const match = text.match(new RegExp(`export interface ${interfaceName} \\{([\\s\\S]*?)\\n\\}`));
  if (!match) return [];
  return [...match[1].matchAll(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\??\s*:/gm)].map((item) => item[1]);
}

function textBetween(text, start, end) {
  const startIndex = text.indexOf(start);
  if (startIndex === -1) return "";
  const endIndex = text.indexOf(end, startIndex + start.length);
  if (endIndex === -1) return text.slice(startIndex);
  return text.slice(startIndex, endIndex);
}

function extractJsMirrorBundleSchema() {
  const modelText = readFileSync("apps/companion-web/src/model.js", "utf8");
  const match = modelText.match(/schema:\s*"([^"]*mirror-bundle[^"]*)"/);
  if (!match) throw new Error("Unable to find mirror bundle schema in web model");
  return match[1];
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = buildHarmonyScaffoldReport();
  assert.equal(report.ok, true);
  console.log("smoke_harmony_scaffold_ok");
}
