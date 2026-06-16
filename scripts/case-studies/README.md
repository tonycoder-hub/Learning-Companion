# Case Studies

This directory contains iterable case studies for Learning Companion.

## Available Case Studies

### ecom-psych — 电商心理学实战课 / E-commerce Psychology Practical Course v1.3

A 30-day bilingual e-commerce psychology course structured as a Learning Companion workspace.
Demonstrates captures, review cards, questions (open/resolved/parked), TTS segments, key terms, practice exercises, and experiment hints.

**Build:**
```bash
npm run demo:case-study
```

**Serve:**
```bash
npm run demo:case-study:serve
```

**Extend:** Edit `ecom-psych/data/week{N}.mjs`, add concepts/self-test/practice/TTS, rebuild.

## Adding a New Case Study

1. Create a new directory under `case-studies/` (e.g., `my-course/`).
2. Create `data/meta.mjs` with course metadata (see `ecom-psych/data/meta.mjs` for shape).
3. Create `data/week{N}.mjs` files with day content.
4. Create an `index.mjs` entry point that imports `buildCaseStudyWorkspace` from `../../build-case-study.mjs`.
5. Add npm scripts to `package.json`.
