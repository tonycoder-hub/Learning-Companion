import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const root = resolve("apps/companion-web");
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const smokeBase = resolve(".codex-tmp/source-resume-smoke");
const smokeRoot = join(smokeBase, `source-resume-${Date.now()}`);
const profile = join(smokeRoot, "profile");

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"]
]);

mkdirSync(profile, { recursive: true, mode: 0o700 });

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const filePath = join(root, url.pathname === "/" ? "index.html" : url.pathname);
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes.get(extname(filePath)) || "application/octet-stream"
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("not found");
  }
});

const listenPort = await new Promise((resolvePort) => {
  server.listen(0, "127.0.0.1", () => resolvePort(server.address().port));
});
const debuggingPort = 9700 + Math.floor(Math.random() * 200);
const appUrl = `http://127.0.0.1:${listenPort}/`;
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
  appUrl
], { stdio: "ignore" });

try {
  const target = await waitForTarget(debuggingPort);
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Page.navigate", { url: appUrl });
  await sleep(500);

  const result = await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const readActivity = () => ({
      title: document.querySelector("#activityTitle").textContent,
      detail: document.querySelector("#activityDetail").textContent,
      action: document.querySelector("#activityDetailsBtn").textContent,
      aria: document.querySelector("#activityDetailsBtn").getAttribute("aria-label") || "",
      targetId: document.querySelector("#activityDetailsBtn").dataset.activityTargetId || "",
      hintHidden: document.querySelector("#activityHint")?.hidden !== false,
      hintKind: document.querySelector("#activityHint")?.dataset.nextStepHint || "",
      hintText: document.querySelector("#activityHintText")?.textContent || "",
      hintAction: document.querySelector("#activityHintBtn")?.textContent || "",
      hintAria: document.querySelector("#activityHintBtn")?.getAttribute("aria-label") || "",
      activeTab: document.querySelector(".tab.active")?.dataset.tab || "",
      activeElement: document.activeElement?.id || ""
    });
    const capturePlain = (title, sourceTitle, sourceUrl, timestamp) => {
      document.querySelector("#newSessionBtn").click();
      setValue("#sessionTitle", title);
      setValue("#sourceTitle", sourceTitle);
      setValue("#sourceUrl", sourceUrl);
      setValue("#timestampInput", timestamp);
      setValue("#quoteInput", "Ordinary capture quote.");
      setValue("#thoughtInput", "Ordinary capture thought.");
      document.querySelector("#captureBtn").click();
      return readActivity();
    };
    const clickHint = () => {
      let opened = "";
      let target = "";
      let features = "";
      const nativeOpen = window.open;
      window.open = (href, nextTarget, nextFeatures) => {
        opened = href;
        target = nextTarget;
        features = nextFeatures;
        return null;
      };
      document.querySelector("#activityHintBtn").click();
      window.open = nativeOpen;
      return {
        activity: readActivity(),
        opened,
        target,
        features,
        capturePanePulsed: document.querySelector("#capturePane")?.classList.contains("pulse") === true
      };
    };
    setValue("#sessionTitle", "Ordinary capture resume hint");
    setValue("#sourceTitle", "Ordinary resume source");
    setValue("#sourceUrl", "https://example.com/ordinary-resume");
    setValue("#timestampInput", "");
    setValue("#quoteInput", "Ordinary capture quote.");
    setValue("#thoughtInput", "Ordinary capture thought.");
    document.querySelector("#captureBtn").click();
    const saved = readActivity();
    document.querySelector("#activityDetailsBtn").click();
    const viewed = readActivity();
    const viewedCapturePulsed = document.querySelector(\`[data-capture-id="\${saved.targetId}"]\`)?.classList.contains("pulse") === true;
    const bareClick = clickHint();
    const noSource = capturePlain("Ordinary capture without source", "", "", "");
    const timed = capturePlain("Timed ordinary capture resume hint", "Timed ordinary source", "https://www.youtube.com/watch?v=ordinaryTimed", "00:42");
    const timedClick = clickHint();
    return {
      saved,
      viewed,
      viewedCapturePulsed,
      bareClick,
      noSource,
      timed,
      timedClick
    };
  })()`, 12000);

  assert.equal(result.saved.title, "Capture saved");
  assert.equal(result.saved.action, "View capture");
  assert.equal(result.saved.aria, "View capture");
  assert.notEqual(result.saved.targetId, "");
  assert.equal(result.viewed.title, "Capture saved");
  assert.equal(result.viewed.activeTab, "captures");
  assert.equal(result.viewedCapturePulsed, true);
  assert.equal(result.saved.hintHidden, false);
  assert.equal(result.saved.hintKind, "afterCaptureSavedSourceLinked");
  assert.match(result.saved.hintText, /open the source/);
  assert.equal(result.saved.hintAction, "Open source");
  assert.equal(result.saved.hintAria, "Open the source after saving this capture");
  assert.equal(result.bareClick.opened, "https://example.com/ordinary-resume");
  assert.equal(result.bareClick.target, "_blank");
  assert.equal(result.bareClick.features, "noopener,noreferrer");
  assert.equal(result.bareClick.activity.title, "Source resumed");
  assert.match(result.bareClick.activity.detail, /Ordinary resume source reopened/);
  assert.equal(result.bareClick.activity.action, "View capture");
  assert.equal(result.bareClick.activity.activeTab, "captures");
  assert.equal(result.bareClick.activity.activeElement, "thoughtInput");
  assert.equal(result.bareClick.capturePanePulsed, true);
  assert.equal(result.noSource.title, "Capture saved");
  assert.equal(result.noSource.hintHidden, true);
  assert.equal(result.noSource.hintKind, "");
  assert.equal(result.timed.title, "Capture saved");
  assert.equal(result.timed.hintHidden, false);
  assert.equal(result.timed.hintKind, "afterCaptureSavedTimedSourceLinked");
  assert.match(result.timed.hintText, /saved source moment/);
  assert.equal(result.timed.hintAction, "Resume source");
  assert.equal(result.timed.hintAria, "Resume the source moment after saving this capture");
  const timedUrl = new URL(result.timedClick.opened);
  assert.equal(timedUrl.origin, "https://www.youtube.com");
  assert.equal(timedUrl.pathname, "/watch");
  assert.equal(timedUrl.searchParams.get("v"), "ordinaryTimed");
  assert.equal(timedUrl.searchParams.get("t"), "42s");
  assert.equal(result.timedClick.activity.title, "Source resumed");
  assert.match(result.timedClick.activity.detail, /Timed ordinary source reopened/);

  cdp.close();
  console.log("smoke_source_resume_ok");
} finally {
  chrome.kill("SIGTERM");
  await waitForProcessExit(chrome, 3000);
  server.close();
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
    evaluate(expression, timeoutMs = 12000) {
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
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]).finally(() => clearTimeout(timeout));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
