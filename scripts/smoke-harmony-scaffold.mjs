#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const HARMONY_SCAFFOLD_REPORT_SCHEMA = "learning-companion.harmony-scaffold-report.v1";

const ROOT = "apps/companion-harmony-dev";
const REQUIRED_FILES = Object.freeze([
  "README.md",
  "AppScope/app.json5",
  "entry/src/main/module.json5",
  "entry/src/main/resources/base/profile/main_pages.json",
  "entry/src/main/resources/base/element/string.json",
  "entry/src/main/resources/base/element/color.json",
  "entry/src/main/ets/entryability/EntryAbility.ets",
  "entry/src/main/ets/pages/Index.ets",
  "entry/src/main/ets/pages/TopicDetail.ets",
  "entry/src/main/ets/pages/ReviewQueue.ets",
  "entry/src/main/ets/pages/ImportReceipt.ets",
  "entry/src/main/ets/model/workspace.ts",
  "entry/src/main/ets/model/harmonyReaderView.ts",
  "entry/src/main/ets/services/importPortableData.ts",
  "entry/src/main/ets/services/exportPatch.ts"
]);

export function buildHarmonyScaffoldReport(options = {}) {
  const root = options.root || ROOT;
  const files = new Map(REQUIRED_FILES.map((path) => [path, read(root, path)]));
  const appConfig = JSON.parse(files.get("AppScope/app.json5"));
  const moduleConfig = JSON.parse(files.get("entry/src/main/module.json5"));
  const pages = JSON.parse(files.get("entry/src/main/resources/base/profile/main_pages.json")).src;
  const checks = [
    check("bundle_name", appConfig.app.bundleName === "com.tonycoder.learningcompanion"),
    check("vendor", appConfig.app.vendor === "Tony Coder"),
    check("entry_ability", moduleConfig.module.mainElement === "EntryAbility"),
    check("profile_pages", moduleConfig.module.pages === "$profile:main_pages"),
    check("phone_device_type", moduleConfig.module.deviceTypes.includes("phone")),
    check("page_list", sameArray(pages, ["pages/Index", "pages/TopicDetail", "pages/ReviewQueue", "pages/ImportReceipt"])),
    check("readme_boundary", /not claimed as a compiled HarmonyOS app/.test(files.get("README.md"))),
    check("entry_loads_index", /loadContent\('pages\/Index'\)/.test(files.get("entry/src/main/ets/entryability/EntryAbility.ets"))),
    check("workspace_schema", /learning-companion\.workspace\.v1/.test(files.get("entry/src/main/ets/model/workspace.ts"))),
    check("review_patch_schema", /learning-companion\.review-progress-patch\.v1/.test(files.get("entry/src/main/ets/model/workspace.ts"))),
    check("import_service", /importPortableJsonText/.test(files.get("entry/src/main/ets/services/importPortableData.ts"))),
    check("unsupported_receipt", /UNSUPPORTED_PORTABLE_DATA/.test(files.get("entry/src/main/ets/services/importPortableData.ts"))),
    check("inbox_patch_export", /buildInboxPatch/.test(files.get("entry/src/main/ets/services/exportPatch.ts"))),
    check("review_patch_export", /buildReviewProgressPatch/.test(files.get("entry/src/main/ets/services/exportPatch.ts"))),
    check("resume_here_page", /Resume Here/.test(files.get("entry/src/main/ets/pages/Index.ets"))),
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
    app: {
      bundleName: appConfig.app.bundleName,
      vendor: appConfig.app.vendor,
      versionName: appConfig.app.versionName
    },
    pages,
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = buildHarmonyScaffoldReport();
  assert.equal(report.ok, true);
  console.log("smoke_harmony_scaffold_ok");
}
