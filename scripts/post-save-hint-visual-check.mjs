import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { readFile } from "node:fs/promises";

const root = resolve("apps/companion-web");
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const startedAtMs = Date.now();
const defaultOut = resolve(".codex-tmp/post-save-hint-visual/receipt.json");
const outPath = resolve(parseArg("--out") || defaultOut);
const runRoot = resolve(".codex-tmp/post-save-hint-visual", `run-${startedAtMs}`);
const profile = join(runRoot, "profile");
const screenshotsDir = join(runRoot, "screenshots");

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"]
]);

mkdirSync(profile, { recursive: true, mode: 0o700 });
mkdirSync(screenshotsDir, { recursive: true, mode: 0o700 });
mkdirSync(dirname(outPath), { recursive: true, mode: 0o700 });

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const filePath = join(root, url.pathname === "/" ? "index.html" : url.pathname);
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes.get(extname(filePath)) || "application/octet-stream",
      "cache-control": "no-store"
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
const debuggingPort = 9800 + Math.floor(Math.random() * 200);
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
  const exceptions = [];
  cdp.on("Runtime.exceptionThrown", (event) => exceptions.push(event));
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");

  const viewportRuns = [];
  for (const viewport of [
    { label: "narrow", width: 390, height: 760 },
    { label: "desktop", width: 1280, height: 720 }
  ]) {
    viewportRuns.push(await runViewportCheck(cdp, viewport, exceptions));
  }

  assert.equal(exceptions.length, 0);
  for (const run of viewportRuns) {
    assert.equal(run.note.layout.bodyOverflowX, false);
    assert.equal(run.note.layout.hintVisible, true);
    assert.equal(run.note.layout.hintTextButtonOverlap, false);
    assert.equal(run.note.layout.activityButtonOverflow, false);
    assert.equal(run.note.activity.action, "Open at quote");
    assert.equal(run.note.activity.hintAction, "View note");
    assert.equal(run.recall.layout.bodyOverflowX, false);
    assert.equal(run.recall.layout.hintVisible, true);
    assert.equal(run.recall.layout.hintTextButtonOverlap, false);
    assert.equal(run.recall.layout.activityButtonOverflow, false);
    assert.match(run.recall.activity.action, /Open at quote|Resume source/);
    assert.match(run.recall.activity.actionAria, /new tab; Quick Capture stays ready/);
    assert.equal(run.recall.activity.hintKind, "afterCardMade");
    assert.equal(run.recall.activity.hintAction, "Review card");
  }

  const receipt = {
    schema: "learning-companion.post-save-hint-visual.v1",
    result: "PASS",
    evidenceType: "CONTROLLED_HEADLESS_BROWSER_VISUAL",
    createdAt: new Date().toISOString(),
    appUrl,
    viewports: viewportRuns,
    provesRealUserDogfood: false,
    doesNotProve: [
      "real Mac dogfood",
      "Safari visual behavior",
      "Windows or HarmonyOS browser behavior",
      "screen-reader accessibility audit",
      "human comprehension of the post-save hint copy"
    ]
  };
  writeFileSync(outPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  cdp.close();
  console.log(`post_save_hint_visual_ok ${outPath}`);
} finally {
  chrome.kill("SIGTERM");
  server.close();
  await waitForProcessExit(chrome, 3000);
}

async function runViewportCheck(cdp, viewport, exceptions) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width < 600
  });
  await cdp.send("Page.navigate", { url: appUrl });
  await waitForNativeBridge(cdp, exceptions);

  const noteActivity = await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const readActivity = () => ({
      title: document.querySelector("#activityTitle")?.textContent || "",
      detail: document.querySelector("#activityDetail")?.textContent || "",
      action: document.querySelector("#activityDetailsBtn")?.textContent || "",
      actionAria: document.querySelector("#activityDetailsBtn")?.getAttribute("aria-label") || "",
      hintKind: document.querySelector("#activityHint")?.dataset.nextStepHint || "",
      hintText: document.querySelector("#activityHintText")?.textContent || "",
      hintAction: document.querySelector("#activityHintBtn")?.textContent || "",
      hintAria: document.querySelector("#activityHintBtn")?.getAttribute("aria-label") || ""
    });
    setValue("#sourceTitle", "Visual evidence source");
    setValue("#sourceUrl", "https://example.com/post-save-visual-source");
    setValue("#materialType", "article");
    setValue("#quoteInput", "Visual evidence quote anchors the source return hint.");
    setValue("#thoughtInput", "This note should return to the source while keeping View note secondary.");
    document.querySelector("#captureBtn").click();
    const row = [...document.querySelectorAll("#captureStack .capture-stack-row")]
      .find((item) => item.textContent.includes("View note secondary"));
    [...(row?.querySelectorAll("button") || [])]
      .find((button) => button.textContent === "Add to notes")
      ?.click();
    window.scrollTo(0, 0);
    return readActivity();
  })()`);
  const noteLayout = await readHintLayout(cdp);
  const noteScreenshot = await captureActivityScreenshot(cdp, `${viewport.label}-note.png`);

  const recallActivity = await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const readActivity = () => ({
      title: document.querySelector("#activityTitle")?.textContent || "",
      detail: document.querySelector("#activityDetail")?.textContent || "",
      action: document.querySelector("#activityDetailsBtn")?.textContent || "",
      actionAria: document.querySelector("#activityDetailsBtn")?.getAttribute("aria-label") || "",
      hintKind: document.querySelector("#activityHint")?.dataset.nextStepHint || "",
      hintText: document.querySelector("#activityHintText")?.textContent || "",
      hintAction: document.querySelector("#activityHintBtn")?.textContent || "",
      hintAria: document.querySelector("#activityHintBtn")?.getAttribute("aria-label") || ""
    });
    document.querySelector("#newSessionBtn").click();
    setValue("#sessionTitle", "Recall hint visual evidence");
    setValue("#sourceTitle", "Recall visual source");
    setValue("#sourceUrl", "https://example.com/recall-hint-visual-source");
    setValue("#materialType", "article");
    setValue("#quoteInput", "Recall hint visual quote should stay readable.");
    setValue("#thoughtInput", "This review card should keep source return visible without crowding the action.");
    document.querySelector("#captureCardBtn").click();
    window.scrollTo(0, 0);
    return readActivity();
  })()`);
  const recallLayout = await readHintLayout(cdp);
  const recallScreenshot = await captureActivityScreenshot(cdp, `${viewport.label}-recall.png`);

  return {
    ...viewport,
    note: {
      activity: noteActivity,
      layout: noteLayout,
      screenshot: noteScreenshot
    },
    recall: {
      activity: recallActivity,
      layout: recallLayout,
      screenshot: recallScreenshot
    }
  };
}

async function readHintLayout(cdp) {
  return cdp.evaluate(`(() => {
    const rectOf = (selector) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      if (!rect) return null;
      return {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    };
    const overlap = (a, b) => Boolean(a && b
      && a.left < b.right
      && a.right > b.left
      && a.top < b.bottom
      && a.bottom > b.top);
    const strip = rectOf(".activity-strip");
    const action = rectOf("#activityDetailsBtn");
    return {
      bodyOverflowX: document.body.scrollWidth > document.body.clientWidth,
      strip,
      title: document.querySelector("#activityTitle")?.textContent || "",
      detail: document.querySelector("#activityDetail")?.textContent || "",
      hintVisible: document.querySelector("#activityHint")?.hidden === false,
      hintKind: document.querySelector("#activityHint")?.dataset.nextStepHint || "",
      hintText: document.querySelector("#activityHintText")?.textContent || "",
      hintAction: document.querySelector("#activityHintBtn")?.textContent || "",
      hintRect: rectOf("#activityHint"),
      hintTextRect: rectOf("#activityHintText"),
      hintButtonRect: rectOf("#activityHintBtn"),
      actionRect: action,
      hintTextButtonOverlap: overlap(rectOf("#activityHintText"), rectOf("#activityHintBtn")),
      activityButtonOverflow: Boolean(strip && action && action.right > strip.right + 1)
    };
  })()`);
}

async function captureActivityScreenshot(cdp, fileName) {
  const clip = await cdp.evaluate(`(() => {
    const rect = document.querySelector(".activity-strip")?.getBoundingClientRect();
    if (!rect) throw new Error("Activity strip not found.");
    return {
      x: Math.max(0, rect.left - 12),
      y: Math.max(0, rect.top - 12 + window.scrollY),
      width: Math.min(document.documentElement.scrollWidth, rect.width + 24),
      height: rect.height + 24,
      scale: 1
    };
  })()`);
  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip
  });
  const outFile = join(screenshotsDir, fileName);
  writeFileSync(outFile, Buffer.from(screenshot.data, "base64"), { mode: 0o600 });
  return outFile;
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

async function waitForNativeBridge(cdp, exceptions) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const ready = await cdp.evaluate(`Boolean(window.learningCompanionNative && document.querySelector("#captureBtn"))`);
    if (ready) return;
    await sleep(100);
  }
  const lastException = exceptions.at(-1)?.exceptionDetails?.exception?.description || "";
  throw new Error(lastException || "Native bridge was not ready.");
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
  const listeners = new Map();
  let id = 0;

  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", rejectOpen, { once: true });
  });

  socket.addEventListener("message", (message) => {
    const payload = JSON.parse(message.data);
    if (payload.id && pending.has(payload.id)) {
      const { resolveMessage, rejectMessage } = pending.get(payload.id);
      pending.delete(payload.id);
      if (payload.error) rejectMessage(new Error(payload.error.message));
      else resolveMessage(payload.result || {});
      return;
    }
    const callbacks = listeners.get(payload.method) || [];
    for (const callback of callbacks) callback(payload.params || {});
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
    on(method, callback) {
      listeners.set(method, [...(listeners.get(method) || []), callback]);
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

function parseArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
