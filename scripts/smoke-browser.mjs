import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve("apps/companion-web");
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"]
]);

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

const debuggingPort = 9400 + Math.floor(Math.random() * 300);
const profile = join(tmpdir(), `lc-browser-smoke-${Date.now()}`);
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
  await cdp.send("Page.navigate", { url: appUrl });
  await sleep(500);

  const result = await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    setValue("#quoteInput", "Ownership lets Rust make memory safety guarantees.");
    setValue("#thoughtInput", "- Connect this with compiler-enforced lifetimes.");
    setValue("#timestampInput", "08:12");
    document.querySelector("#captureCardBtn").click();
    setValue("#quoteInput", "Spaced repetition improves durable recall. <script>alert(1)</script> <b>bold</b>");
    const quote = document.querySelector("#quoteInput");
    const start = quote.value.indexOf("durable");
    quote.setSelectionRange(start, start + "durable".length);
    document.querySelector("#captureClozeBtn").click();
    const dueBeforeGood = document.querySelector("#dueMetric").textContent;
    document.querySelector('[data-grade="good"]').click();
    document.querySelector('[data-focus-mode="synthesize"]').click();
    const synthesisVisible = !document.querySelector("#synthesisPane").hidden && document.querySelector("#capturePane").hidden;
    document.querySelector("#synthesisDraft").value = "manual synthesis survives";
    document.querySelector("#synthesisDraft").dispatchEvent(new Event("input", { bubbles: true }));
    window.confirm = () => false;
    document.querySelector("#buildSynthesisBtn").click();
    const manualDraftAfterCancel = document.querySelector("#synthesisDraft").value;
    document.querySelector('[data-focus-mode="capture"]').click();
    setValue("#quoteInput", "A later capture changes source material.");
    document.querySelector("#captureBtn").click();
    document.querySelector('[data-focus-mode="synthesize"]').click();
    const staleStatus = document.querySelector("#synthesisStatus").textContent;
    window.confirm = () => true;
    document.querySelector("#buildSynthesisBtn").click();
    const synthesisDraft = document.querySelector("#synthesisDraft").value;
    document.querySelector("#insertSynthesisBtn").click();
    document.querySelector("#insertSynthesisBtn").click();
    const workspace = JSON.parse(localStorage.getItem("learning-companion.workspace.v1"));
    const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId);
    const synthesisOccurrences = (session.notesMarkdown.match(/Synthesis - Learning Companion MVP/g) || []).length;
    return {
      captureMetric: document.querySelector("#captureMetric").textContent,
      cardMetric: document.querySelector("#cardMetric").textContent,
      dueMetric: document.querySelector("#dueMetric").textContent,
      captureText: document.querySelector("#captureList").textContent,
      reviewText: document.querySelector("#reviewList").textContent,
      previewText: document.querySelector("#notesPreview").textContent,
      notesMarkdown: session.notesMarkdown,
      synthesisVisible,
      synthesisDraft,
      manualDraftAfterCancel,
      staleStatus,
      synthesisOccurrences,
      hasScriptNode: Boolean(document.querySelector("#notesPreview script")),
      hasBoldNode: Boolean(document.querySelector("#notesPreview b")),
      captures: session.captures.length,
      cards: session.reviewCards.length,
      latestPrompt: session.reviewCards[0].prompt,
      latestAnswer: session.reviewCards[0].answer,
      dueBeforeGood,
      dueAfterGood: document.querySelector("#dueMetric").textContent,
      gradedCount: session.reviewCards.filter((card) => card.strength === 1).length,
      schemaVersion: workspace.schemaVersion,
      clientId: workspace.clientId
    };
  })()`);

  assert.equal(exceptions.length, 0);
  assert.equal(result.captures, 3);
  assert.equal(result.cards, 2);
  assert.equal(result.captureMetric, "3");
  assert.equal(result.cardMetric, "2");
  assert.equal(result.dueBeforeGood, "2");
  assert.equal(result.dueMetric, "1");
  assert.equal(result.dueAfterGood, "1");
  assert.equal(result.gradedCount, 1);
  assert.match(result.captureText, /Ownership lets Rust/);
  assert.match(result.reviewText, /compiler-enforced lifetimes/);
  assert.equal(result.synthesisVisible, true);
  assert.equal(result.manualDraftAfterCancel, "manual synthesis survives");
  assert.match(result.staleStatus, /Source changed/);
  assert.match(result.synthesisDraft, /Synthesis - Learning Companion MVP/);
  assert.match(result.synthesisDraft, /Generated from 3 captures \/ 0 questions \/ 2 cards/);
  assert.match(result.synthesisDraft, /Spaced repetition improves/);
  assert.match(result.synthesisDraft, /A later capture changes/);
  assert.equal(result.synthesisOccurrences, 1);
  assert.match(result.notesMarkdown, /Synthesis - Learning Companion MVP/);
  assert.match(result.latestPrompt, /____/);
  assert.match(result.latestAnswer, /durable/);
  assert.match(result.previewText, /Learning Companion MVP/);
  assert.match(result.previewText, /Synthesis - Learning Companion MVP/);
  assert.equal(result.hasScriptNode, false);
  assert.equal(result.hasBoldNode, false);
  assert.equal(result.schemaVersion, 1);
  assert.match(result.clientId, /^client_/);
  await cdp.close();
  console.log("smoke_browser_ok");
} finally {
  chrome.kill("SIGTERM");
  server.close();
}

async function waitForTarget(port) {
  const endpoint = `http://127.0.0.1:${port}/json`;
  const deadline = Date.now() + 12000;
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
      else resolveMessage(payload.result);
      return;
    }
    const callbacks = listeners.get(payload.method) || [];
    callbacks.forEach((callback) => callback(payload.params));
  });

  return {
    send(method, params = {}) {
      const messageId = ++id;
      socket.send(JSON.stringify({ id: messageId, method, params }));
      return new Promise((resolveMessage, rejectMessage) => {
        pending.set(messageId, { resolveMessage, rejectMessage });
      });
    },
    evaluate(expression) {
      return this.send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true
      }).then((result) => {
        if (result.exceptionDetails) {
          throw new Error(result.exceptionDetails.text || "Evaluation failed.");
        }
        return result.result.value;
      });
    },
    on(method, callback) {
      listeners.set(method, [...(listeners.get(method) || []), callback]);
    },
    close() {
      socket.close();
    }
  };
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
