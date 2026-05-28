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
- a visible activity-strip confirmation in the main desk, even if the inspector is hidden

If no text is selected, it still updates the current session source context.

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
