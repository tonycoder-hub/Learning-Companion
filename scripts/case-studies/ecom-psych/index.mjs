#!/usr/bin/env node
// Build script for the E-commerce Psychology case study.
// Run: npm run demo:case-study
// Output: dist/ecom-psych-case-study/

import assert from "node:assert/strict";
import { mkdir, rm, writeFile, copyFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildCaseStudyWorkspace, assertCaseStudyIntegrity } from "../../build-case-study.mjs";
import { meta } from "./data/meta.mjs";
import { week1 } from "./data/week1.mjs";
import { week2 } from "./data/week2.mjs";
import { week3 } from "./data/week3.mjs";
import { week4 } from "./data/week4.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../../..");
const OUT_DIR = process.env.CASE_STUDY_OUT_DIR || "dist/ecom-psych-case-study";
const MIRROR_DIR = join(OUT_DIR, "mirror-folder");
const SEED_OUT_DIR = join(PROJECT_ROOT, "apps/companion-web/src/generated");

// Build the workspace
const courseData = { meta, weeks: [week1, week2, week3, week4] };
const result = buildCaseStudyWorkspace(courseData);

// Run integrity assertions
const integrity = assertCaseStudyIntegrity(result);
if (!integrity.ok) {
  console.error("Case study integrity check FAILED:");
  for (const err of integrity.errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}
console.log(`[case-study] Integrity OK: ${integrity.stats.sessionCount} sessions, ${integrity.stats.captureCount} captures, ${integrity.stats.cardCount} cards, ${integrity.stats.placeholderCount} placeholders`);

// Clean output directory
await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(MIRROR_DIR, { recursive: true });
await mkdir(SEED_OUT_DIR, { recursive: true });

const { workspace, mirrorBundle, mirrorZip, stats } = result;
const exportedAt = new Date().toISOString();

// Write workspace JSON
const workspaceJson = JSON.stringify(workspace, null, 2);
await writeFile(join(OUT_DIR, "ecom-psych-workspace.json"), workspaceJson);
console.log("[case-study] Wrote ecom-psych-workspace.json");

// Write mirror bundle JSON
await writeFile(join(OUT_DIR, "ecom-psych-mirror.json"), JSON.stringify(mirrorBundle, null, 2));
console.log("[case-study] Wrote ecom-psych-mirror.json");

// Write mirror ZIP (Buffer from buildMirrorZip which returns { data: Buffer })
await writeFile(join(OUT_DIR, "ecom-psych-mirror.zip"), Buffer.from(mirrorZip.data));
console.log("[case-study] Wrote ecom-psych-mirror.zip");

// Write mirror folder files
for (const file of mirrorBundle.files) {
  const filePath = join(MIRROR_DIR, file.path);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, file.content);
}
console.log(`[case-study] Wrote ${mirrorBundle.files.length} mirror files to mirror-folder/`);

// Copy workspace JSON as seed for in-app loading
const seedPath = join(SEED_OUT_DIR, "ecom-psych-seed.json");
await writeFile(seedPath, workspaceJson);
console.log(`[case-study] Wrote seed to ${seedPath}`);

// Write CASE_STUDY_GUIDE.md
const guide = `# Case Study: ${meta.titleEn} / ${meta.titleZh}

## What This Is

This is a pre-built Learning Companion workspace for the **${meta.titleEn}** course.
It demonstrates captures, review cards, spaced repetition, questions (open/resolved/parked),
TTS shadowing segments, key terms, practice exercises, and experiment hints — all mapped
from the actual course content.

## How to Use

1. Open Learning Companion in your browser (run \`npm run dev\`).
2. Click the **📚 Case Study** button in the sidebar, or import \`ecom-psych-workspace.json\`.
3. Explore the 4 week sessions (W1-W4). W1 is fully populated (D1-D7); W2-W4 are structured placeholders ready to fill.
4. Try the review cards, browse captures, switch between English/中文.

## How to Extend (Iteration Workflow)

To add more course content (e.g., W2 D1 Social Proof):

1. Open \`scripts/case-studies/ecom-psych/data/week2.mjs\`
2. Find the placeholder day entry:
   \`\`\`js
   { day: 1, objectiveEn: "...", placeholder: true, label: "..." }
   \`\`\`
3. Replace it with a full day object (copy the D1 structure as a template):
   - \`objectiveEn\`, \`objectiveZh\`, \`oneLiner\`
   - \`keyTerms[]\`: { key, termEn, termZh, definition, example, tags }
   - \`concepts[]\`: { key, termEn, termZh, keyQuote, explanation, reviewPrompt, reviewAnswer, tags }
   - \`selfTest[]\`: { key, question, answer }
   - \`practice\`: { prompt, exampleOutput }
   - \`ttsSegments[]\`: { enScript, zhRecap, shadowingSentence }
   - \`openQuestions[]\`, \`parkedQuestions[]\`, \`resolvedQuestions[]\` (optional)
   - \`experimentHint\`: { hypothesis, notes } (optional)
   - \`rubric\`: rubric string (optional)
4. Remove \`placeholder: true\` and the \`label\` field.
5. Run \`npm run demo:case-study\` to rebuild.
6. Run \`npm run smoke\` to verify no regressions.
7. Reload the app and click "Case Study" again to see the new content.

## Course Source

- Navigation: ${meta.feishuNavUrl}
- W1: ${meta.weekUrls[1]}
- W2: ${meta.weekUrls[2]}
- W3: ${meta.weekUrls[3]}
- W4: ${meta.weekUrls[4]}
- Toolbox: ${meta.toolboxUrl}

## Build Stats

- Sessions: ${stats.sessionCount}
- Captures: ${stats.captureCount}
- Review cards: ${stats.cardCount}
- Placeholder entries: ${stats.placeholderCount}
- Version: ${stats.version}
- Built at: ${exportedAt}

## File Structure

\`\`\`
scripts/case-studies/ecom-psych/
├── index.mjs              # This build script
├── README.md              # This guide
└── data/
    ├── meta.mjs           # Course metadata
    ├── week1.mjs          # W1 content (D1-D7 complete)
    ├── week2.mjs          # W2 scaffold (placeholder days)
    ├── week3.mjs          # W3 scaffold
    └── week4.mjs          # W4 scaffold + graduation deliverables
\`\`\`
`;
await writeFile(join(OUT_DIR, "CASE_STUDY_GUIDE.md"), guide);
console.log("[case-study] Wrote CASE_STUDY_GUIDE.md");

// Write SUMMARY.json
const summary = {
  ok: true,
  courseTitle: meta.titleEn,
  courseTitleZh: meta.titleZh,
  version: meta.version,
  builtAt: exportedAt,
  ...stats,
  files: {
    workspace: "ecom-psych-workspace.json",
    mirror: "ecom-psych-mirror.json",
    mirrorZip: "ecom-psych-mirror.zip",
    mirrorFolder: "mirror-folder/",
    guide: "CASE_STUDY_GUIDE.md",
  },
  weeks: [week1, week2, week3, week4].map((w) => ({
    week: w.week,
    titleEn: w.titleEn,
    titleZh: w.titleZh,
    days: w.days.length,
    placeholderDays: w.days.filter((d) => d.placeholder).length,
  })),
};
await writeFile(join(OUT_DIR, "SUMMARY.json"), JSON.stringify(summary, null, 2));
console.log("[case-study] Wrote SUMMARY.json");

// Determinism check: build twice and compare workspace JSON
const result2 = buildCaseStudyWorkspace(courseData);
const ws2 = JSON.stringify(result2.workspace, null, 2);
assert.equal(workspaceJson.length, ws2.length, "Determinism check: workspace JSON should be byte-stable across builds");
assert.equal(workspaceJson, ws2, "Determinism check: workspace JSON should be identical across builds");
console.log("[case-study] Determinism check passed");

console.log(`[case-study] Build complete → ${OUT_DIR}/`);
