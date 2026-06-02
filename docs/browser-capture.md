# Browser Capture

The first browser integration is a local bookmarklet. It does not require an extension, a cloud account, or browser-cookie access.

## Local Sidecar URL

Run the app:

```bash
npm run dev
```

Default URL:

```text
http://127.0.0.1:5173/
```

## Bookmarklet

Open the app, switch to `Export`, and use `Copy Clip` to copy the bookmarklet for the current local app URL.

The default static bookmarklet is also available in `apps/companion-web/bookmarklet.js`:

```javascript
javascript:(()=>{const base="http://127.0.0.1:5173/";const getTime=()=>{const video=[...document.querySelectorAll("video")].find((item)=>!item.paused)||document.querySelector("video");if(!video||!Number.isFinite(video.currentTime))return"";const seconds=Math.floor(video.currentTime);return[Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map((part)=>String(part).padStart(2,"0")).join(":")};const params=new URLSearchParams({capture:"1",sourceTitle:document.title,sourceUrl:location.href,quote:String(getSelection()||"").trim(),t:getTime()});window.open(base+"?"+params.toString(),"learning-companion","noopener,noreferrer,width=1100,height=760");})();
```

When activated, it opens Learning Companion with:

- current page title
- current page URL
- selected text as a capture
- active video time when a `<video>` element is present
- source-aware routing: if the page URL already belongs to another session, the capture is saved there instead of the currently visible scratch session
- a visible activity-strip confirmation in the main desk, even if the inspector is hidden
- a capture-level snapshot of source title, URL, material type, and timestamp

If no text is selected, it still updates the current session source context.
If incoming text is staged instead of auto-saved, the app switches to capture focus and shows whether it matched an existing source or fell back to the current topic.

The browser smoke test executes the generated bookmarklet on local virtual video and document pages, then follows the opened Learning Companion URL and verifies the saved capture. This covers selected text, multi-node document selections, empty-selection source updates, page title, page URL, empty document timestamps, and `<video>.currentTime` formatting without touching browser cookies or real external accounts.

## Paste Source

`Paste Source` is the low-friction source setup path before installing or using the bookmarklet.

Safety boundary:

- It reads clipboard text only after the user clicks the visible `Paste Source` button beside the URL field.
- It keeps only the first safe `http`/`https` URL.
- It does not monitor the clipboard in the background.
- It does not read browser cookies, sessions, profiles, page DOM, or account data.
- Non-URL clipboard text is discarded and replaced with a manual-entry prompt.
- Supported video time parameters are moved into the Time field and stripped from the stored source URL.
- If a topic already has captures, the existing material type is kept instead of silently reclassifying the topic from `Doc` to `Video`.

Automated browser smoke covers a copied YouTube URL with a timestamp, a non-URL clipboard rejection, and the existing-capture material-type guardrail.

Coverage matrix:

| Capture path | Automated | Manual follow-up |
| --- | --- | --- |
| Inbound URL parse and save | Yes | Spot-check after URL contract changes |
| Generated bookmarklet -> URL on virtual pages | Yes | Spot-check after bookmarklet UI changes |
| Bookmarklet on YouTube, Feishu Docs, and developer docs | No | Required before calling browser capture broadly compatible |
| Safari/Firefox bookmarklet install and invocation | No | Required before cross-browser claims |

This smoke does not prove real-site popup behavior, CSP interactions, iframe or shadow-DOM video access, browser bookmarklet length limits, or site-specific Selection API quirks.

Routing is deterministic and conservative:

- URL matching normalizes safe `http`/`https` URLs by dropping fragments, trailing path slashes, common tracking params, and YouTube/Bilibili/Vimeo time params before matching.
- Host matching is case-insensitive through URL parsing; tracking param names are compared case-insensitively.
- Known video hosts are `youtube.com`, `youtu.be`, `bilibili.com`, and `vimeo.com`.
- If more than one session matches a URL, the active session wins first, then the most recently updated matching session, then lexical session id as a final deterministic tie-breaker.
- Exact source-title fallback only runs when the inbound URL is absent and the candidate session has no existing source URL.
- Matched-session source title/URL fields are preserved; the incoming page title/URL are snapshotted on the capture itself.
- Auto-saved captures inherit the matched session tags.

For supported video URLs, capture cards can open the source at the captured timestamp. The first implementation supports YouTube-style `t=<seconds>s` links and leaves other URLs unchanged.

## Inbound URL Contract

Learning Companion accepts:

```text
/?sourceTitle=<title>&sourceUrl=<url>&quote=<selected text>&thought=<note>&t=<timestamp>&capture=1
```

Without `capture=1`, incoming text is staged in the quick capture box instead of being saved immediately.

## Future Browser Extension

The extension should reuse the same contract first, then later add:

- active video timestamp detection
- one-click capture to current session
- source-specific templates
- optional local native bridge for the Mac shell
