# Learning Companion

A local-first learning note app for Mac and HarmonyOS, with Feishu as the first cross-device sync layer.

## Product Direction

- Mac app: fast capture, browser context, video timestamps, and focused floating notes.
- Feishu sync: readable cross-device mirror plus structured sync payloads.
- HarmonyOS app: mobile capture, review, and lightweight edits.
- Data model: local-first Markdown/SQLite, designed to avoid lock-in.

## Repository Layout

```text
apps/
  companion-web/
  companion-mac/
docs/
  architecture.md
  browser-capture.md
  feishu-mirror.md
  github-permissions.md
  installable-web.md
  mirror-bundle-contract.md
  product-mvp.md
  roadmap.md
  synthesis-loop.md
scripts/
  setup-github-ssh.sh
  configure-github-remote.sh
  smoke-web.mjs
  smoke-browser.mjs
```

The first runnable MVP lives in `apps/companion-web`.
The first native shell scaffold lives in `apps/companion-mac`.

## Run The MVP

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

Smoke test:

```bash
npm run smoke
npm run smoke:harmony
npm run smoke:browser
```

Morning review check:

```bash
npm run check:morning
```

Generate a fixture-only local review pack for morning inspection:

```bash
npm run demo:morning
```

Open `dist/morning-demo/review-start-here.html` after generation.

Build the minimal Mac shell:

```bash
npm run mac:build
```

Current MVP status is tracked in [docs/nightly-status.md](docs/nightly-status.md).

## GitHub Hosting

This repository is intended to use a dedicated GitHub SSH identity instead of the machine's global Git configuration. See [docs/github-permissions.md](docs/github-permissions.md).
