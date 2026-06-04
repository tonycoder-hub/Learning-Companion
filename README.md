# Learning Companion

A Mac-first, local-first learning companion for browser-based study.

Current verified status: the runnable product is the web MVP plus a minimal Mac shell scaffold. Phone/Windows support is currently a static mirror and manual return-file loop. Static Review/Inbox pages may create browser-saved return JSON files, but those files must be moved back to Mac manually. Feishu Drive may be used as a manual file carrier, but live Feishu sync is not verified. The HarmonyOS app is a scaffold/prototype, not a device-verified app.

## Product Direction

- Mac-first study sidecar: fast capture, browser context, video timestamps, source resume, Notes, and Review.
- Manual cross-device loop: export a static mirror, use Review/Inbox on phone or Windows, then bring return JSON back to Mac.
- Feishu transport direction: possible manual file-carrier path first; no live sync claim until real integration is verified.
- HarmonyOS direction: reader/import/export scaffold toward mobile capture and review; no real-device usability claim yet.
- Data model: local-first portable workspace data, designed to avoid lock-in.

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
  promotion-gates.md
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

## License

Learning Companion is released under the [MIT License](LICENSE). You can use, copy, modify, publish, distribute, sublicense, and share it freely.
