# Installable Web Companion

## Purpose

The local web MVP can now behave like a lightweight app shell before native Mac, Windows, or HarmonyOS work starts. It includes a web app manifest, an icon, and a service worker that caches the static application files.

## What It Enables

- Mac and Windows can install the local app from a Chromium browser as a standalone window.
- The app shell can reload while offline after the first successful load.
- The same static artifact remains usable on machines where native packaging is not ready.

## Scope

This is not a replacement for the future Mac shell. Native capture still matters for:

- global hotkey
- selected text / clipboard bridge
- active browser URL detection
- SQLite or filesystem vault persistence

The installable web shell is a low-friction bridge: useful now, and disposable later if native shell work proves better.

## Cached Assets

The service worker caches:

- `index.html`
- `styles.css`
- `manifest.webmanifest`
- `bookmarklet.js`
- `assets/icon.svg`
- `src/app.js`
- `src/model.js`
- `src/markdown.js`

Workspace data still lives in local browser storage, so mirror export remains the durable cross-device handoff.
