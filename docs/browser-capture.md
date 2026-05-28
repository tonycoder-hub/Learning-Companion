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

Create a browser bookmark and paste this as the URL:

```javascript
javascript:(()=>{const base="http://127.0.0.1:5173/";const params=new URLSearchParams({capture:"1",sourceTitle:document.title,sourceUrl:location.href,quote:String(getSelection()||"").trim()});window.open(base+"?"+params.toString(),"learning-companion","noopener,noreferrer,width=1100,height=760");})();
```

When activated, it opens Learning Companion with:

- current page title
- current page URL
- selected text as a capture

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
