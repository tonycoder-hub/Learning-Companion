# Learning Companion

A local-first learning note app for Mac and HarmonyOS, with Feishu as the first cross-device sync layer.

## Product Direction

- Mac app: fast capture, browser context, video timestamps, and focused floating notes.
- Feishu sync: readable cross-device mirror plus structured sync payloads.
- HarmonyOS app: mobile capture, review, and lightweight edits.
- Data model: local-first Markdown/SQLite, designed to avoid lock-in.

## Repository Layout

```text
docs/
  github-permissions.md
scripts/
  setup-github-ssh.sh
  configure-github-remote.sh
```

Application source folders will be added as the Mac and HarmonyOS projects are scaffolded.

## GitHub Hosting

This repository is intended to use a dedicated GitHub SSH identity instead of the machine's global Git configuration. See [docs/github-permissions.md](docs/github-permissions.md).
