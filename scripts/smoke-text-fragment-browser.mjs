import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const smokeBase = resolve(".codex-tmp/text-fragment-browser-smoke");
const smokeRoot = join(smokeBase, `text-fragment-${Date.now()}`);
const profile = join(smokeRoot, "profile");
const targetText = "Browser text fragment smoke target phrase lands below the fold.";

mkdirSync(profile, { recursive: true, mode: 0o700 });
const pagePath = join(smokeRoot, "text-fragment-source.html");

const page = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Text Fragment Smoke</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; }
      main { padding: 24px; }
      .spacer { height: 2200px; }
      #target { font-size: 24px; line-height: 1.4; padding: 24px; border: 2px solid #247a63; }
    </style>
  </head>
  <body>
    <main>
      <p>Top of the source page.</p>
      <div class="spacer"></div>
      <p id="target">${targetText}</p>
      <div class="spacer"></div>
    </main>
  </body>
</html>`;

writeFileSync(pagePath, page);
const debuggingPort = 9900 + Math.floor(Math.random() * 200);
const fragment = `#:~:text=${encodeURIComponent(targetText)}`;
const pageUrl = `${pathToFileURL(pagePath).href}${fragment}`;
const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-extensions",
  "--disable-sync",
  "--no-first-run",
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${debuggingPort}`,
  pageUrl
], { stdio: "ignore" });

try {
  const target = await waitForTarget(debuggingPort);
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await sleep(1200);
  const result = await cdp.evaluate(`(() => {
    const target = document.querySelector("#target");
    const rect = target.getBoundingClientRect();
    return {
      hash: location.hash,
      scrollY: Math.round(window.scrollY),
      targetTop: Math.round(rect.top),
      targetText: target.textContent.trim()
    };
  })()`, 8000);

  assert.ok(pageUrl.includes(fragment));
  assert.equal(result.targetText, targetText);
  assert.ok(result.scrollY > 1000, `Expected text fragment to scroll below the fold, got ${result.scrollY}`);
  assert.ok(result.targetTop >= 0 && result.targetTop < 500, `Expected target near viewport, got ${result.targetTop}`);

  cdp.close();
  console.log("smoke_text_fragment_browser_ok");
} finally {
  chrome.kill("SIGTERM");
  await waitForProcessExit(chrome, 3000);
}

async function waitForTarget(port) {
  const endpoint = `http://127.0.0.1:${port}/json`;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const targets = await fetch(endpoint).then((response) => response.json());
      const target = targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
      if (target) return target;
    } catch {
      await sleep(150);
    }
  }
  throw new Error("Chrome DevTools target was not ready.");
}

function waitForProcessExit(process, timeoutMs) {
  if (process.exitCode !== null || process.signalCode !== null) return Promise.resolve();
  return new Promise((resolveExit) => {
    const timeout = setTimeout(resolveExit, timeoutMs);
    process.once("exit", () => {
      clearTimeout(timeout);
      resolveExit();
    });
  });
}

async function connectCdp(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let id = 0;

  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", rejectOpen, { once: true });
  });

  socket.addEventListener("message", (message) => {
    const payload = JSON.parse(message.data);
    if (!payload.id || !pending.has(payload.id)) return;
    const { resolveMessage, rejectMessage } = pending.get(payload.id);
    pending.delete(payload.id);
    if (payload.error) rejectMessage(new Error(payload.error.message));
    else resolveMessage(payload.result);
  });

  return {
    send(method, params = {}) {
      const messageId = ++id;
      socket.send(JSON.stringify({ id: messageId, method, params }));
      return new Promise((resolveMessage, rejectMessage) => {
        pending.set(messageId, { resolveMessage, rejectMessage });
      });
    },
    evaluate(expression, timeoutMs = 8000) {
      return withTimeout(this.send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true
      }).then((result) => {
        if (result.exceptionDetails) {
          throw new Error(result.exceptionDetails.exception?.description
            || result.exceptionDetails.text
            || "Evaluation failed.");
        }
        return result.result.value;
      }), timeoutMs, "Runtime.evaluate timed out.");
    },
    close() {
      socket.close();
    }
  };
}

function withTimeout(promise, timeoutMs, message) {
  return new Promise((resolveTimeout, rejectTimeout) => {
    const timeout = setTimeout(() => rejectTimeout(new Error(message)), timeoutMs);
    promise.then((value) => {
      clearTimeout(timeout);
      resolveTimeout(value);
    }, (error) => {
      clearTimeout(timeout);
      rejectTimeout(error);
    });
  });
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
