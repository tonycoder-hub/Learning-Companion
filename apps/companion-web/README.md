# Companion Web MVP

Dependency-free local MVP for the Learning Companion sidecar.

Run:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

The app stores data in `localStorage` and can export/import a portable workspace JSON payload. The Export tab can also save a credential-free Feishu mirror bundle containing Markdown, workspace JSON, and per-session sidecars.

Browser capture:

```text
bookmarklet.js
```

Use the app's Export tab `Copy Clip` action, or copy the JavaScript URL from `bookmarklet.js` into a browser bookmark while the local server is running. The bookmarklet captures title, URL, selected text, and active video time when available.
