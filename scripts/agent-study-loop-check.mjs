import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";

const root = resolve("apps/companion-web");
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const startedAtMs = Date.now();
const defaultOut = resolve(".codex-tmp/agent-study-loop-smoke/receipt.json");
const outPath = resolve(parseArg("--out") || defaultOut);
const runRoot = resolve(".codex-tmp/agent-study-loop-smoke", `run-${startedAtMs}`);
const profile = join(runRoot, "profile");

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"]
]);

mkdirSync(profile, { recursive: true, mode: 0o700 });
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
const debuggingPort = 9900 + Math.floor(Math.random() * 200);
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
  await waitForNativeBridge(cdp, exceptions);

  const run = await cdp.evaluate(`(() => {
    const setValue = (selector, value) => {
      const node = document.querySelector(selector);
      node.value = value;
      node.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const text = (selector) => document.querySelector(selector)?.textContent.replace(/\\s+/g, " ").trim() || "";
    const activeTab = () => document.querySelector(".tab.active")?.dataset.tab || "";
    const loopStep = () => document.querySelector('[data-learning-flow-step="loop"]');
    const loopState = () => ({
      text: loopStep()?.textContent.replace(/\\s+/g, " ").trim() || "",
      action: loopStep()?.querySelector("button")?.textContent.replace(/\\s+/g, " ").trim() || "",
      className: loopStep()?.className || ""
    });
    const latestCaptureCard = (needle) => [...document.querySelectorAll("#captureList .item-card")]
      .find((card) => card.textContent.includes(needle));
    const clickCardButton = (card, label) => {
      const button = [...(card?.querySelectorAll("button") || [])]
        .find((item) => item.textContent.replace(/\\s+/g, " ").trim() === label);
      if (!button) {
        const buttons = [...(card?.querySelectorAll("button") || [])]
          .map((item) => item.textContent.replace(/\\s+/g, " ").trim())
          .join(", ");
        const captureListText = document.querySelector("#captureList")?.textContent.replace(/\\s+/g, " ").trim() || "";
        const session = activeSession();
        throw new Error(\`Missing button \${label}; activeTab=\${activeTab()}; activity=\${text("#activityTitle")}; captures=\${session?.captures?.length || 0}; quote=\${document.querySelector("#quoteInput")?.value || ""}; thought=\${document.querySelector("#thoughtInput")?.value || ""}; card=\${card?.textContent.replace(/\\s+/g, " ").trim() || "none"}; buttons=\${buttons || "none"}; captureList=\${captureListText || "none"}\`);
      }
      button.click();
    };
    const workspace = () => JSON.parse(window.learningCompanionNative.exportWorkspaceJson());
    const activeSession = () => {
      const state = workspace();
      return state.sessions.find((session) => session.id === state.activeSessionId) || state.sessions[0];
    };

    setValue("#sessionTitle", "Agent study loop check");
    setValue("#sourceTitle", "Controlled browser study source");
    setValue("#sourceUrl", "https://example.com/controlled-study-source");
    setValue("#materialType", "doc");
    setValue("#sessionTags", "agent-check, study-loop");

    document.querySelector("#sidecarLayoutBtn").click();
    const sidecarStart = {
      shellCompact: document.querySelector(".app-shell").classList.contains("sidecar-layout"),
      railSteps: [...document.querySelectorAll("[data-sidecar-rail-step]")].map((step) => ({
        kind: step.dataset.sidecarRailStep,
        text: step.textContent.replace(/\\s+/g, " ").trim(),
        aria: step.getAttribute("aria-label") || ""
      }))
    };
    const captureRail = [...document.querySelectorAll("[data-sidecar-rail-step]")]
      .find((step) => step.dataset.sidecarRailStep === "capture");
    captureRail?.click();
    const railFocus = {
      activeTab: activeTab(),
      activeElement: document.activeElement?.id || "",
      capturePanePulsed: document.querySelector("#capturePane")?.classList.contains("pulse") === true
    };

    setValue("#quoteInput", "A study companion should preserve the source context while the learner writes.");
    setValue("#thoughtInput", "The first capture should become durable before the loop is considered clear.");
    document.querySelector("#captureBtn").click();
    const firstCaptureActivity = {
      title: text("#activityTitle"),
      detail: text("#activityDetail"),
      action: text("#activityDetailsBtn")
    };
    const sidecarAfterFirstCapture = {
      railSteps: [...document.querySelectorAll("[data-sidecar-rail-step]")].map((step) => ({
        kind: step.dataset.sidecarRailStep,
        text: step.textContent.replace(/\\s+/g, " ").trim()
      }))
    };
    document.querySelector('[data-tab="today"]').click();
    const firstCaptureLoop = loopState();
    loopStep()?.querySelector("button")?.click();
    const firstCaptureCard = latestCaptureCard("first capture should become durable");
    const firstCaptureDecision = {
      activeTab: activeTab(),
      cardVisible: Boolean(firstCaptureCard),
      needsDecision: firstCaptureCard?.classList.contains("needs-durable-decision") === true,
      decisionButtons: [...(firstCaptureCard?.querySelectorAll(".capture-decision-button") || [])].map((button) => button.textContent.replace(/\\s+/g, " ").trim())
    };
    clickCardButton(firstCaptureCard, "Add to notes");
    document.querySelector('[data-tab="today"]').click();
    const afterNotesLoop = loopState();

    setValue("#quoteInput", "Open questions should drive the next focused action.");
    setValue("#thoughtInput", "Question: How should a learner close this source-backed question?");
    document.querySelector("#captureBtn").click();
    document.querySelector('[data-tab="today"]').click();
    const questionLoop = loopState();
    const questionSection = text("[data-today-section='open_questions']") + " " + text(".question-card");
    loopStep()?.querySelector("button")?.click();
    const answerDraft = {
      activeTab: activeTab(),
      thought: document.querySelector("#thoughtInput")?.value || "",
      quote: document.querySelector("#quoteInput")?.value || "",
      draftTarget: (() => {
        const prefs = JSON.parse(localStorage.getItem("learning-companion.ui.v1") || "{}");
        const session = activeSession();
        return prefs.captureDrafts?.[session?.id || ""]?.answersQuestionCaptureId || "";
      })()
    };
    setValue("#thoughtInput", "Answer: Close the question by saving a linked answer, then return to capture when the loop clears.");
    document.querySelector("#captureBtn").click();
    document.querySelector('[data-tab="today"]').click();
    const finalLoop = loopState();
    const longToken = "SidecarLongTextToken".repeat(12);
    setValue("#quoteInput", "");
    setValue("#thoughtInput", \`Takeaway: \${longToken} should wrap without stealing the loop.\`);
    document.querySelector("#captureBtn").click();
    document.querySelector('[data-tab="today"]').click();
    const longTextSupport = {
      loop: loopState(),
      overflowX: document.body.scrollWidth > document.body.clientWidth,
      captureStackText: text("#captureStack")
    };
    const session = activeSession();
    const openQuestions = session.captures.filter((capture) => /^(?:q|question)\\s*[:：]/i.test(capture.thought || "") && !capture.questionResolvedAt && !capture.questionParkedAt).length;
    const closedQuestions = session.captures.filter((capture) => /^(?:q|question)\\s*[:：]/i.test(capture.thought || "") && capture.questionResolvedAt).length;
    const answers = session.captures.filter((capture) => /^(?:a|answer)\\s*[:：]/i.test(capture.thought || "") || capture.answersQuestionCaptureId).length;
    const notesHasFirstCapture = /first capture should become durable/i.test(session.notesMarkdown || "");

    return {
      sidecarStart,
      railFocus,
      firstCaptureActivity,
      sidecarAfterFirstCapture,
      firstCaptureLoop,
      firstCaptureDecision,
      afterNotesLoop,
      questionLoop,
      questionSection,
      answerDraft,
      finalLoop,
      longTextSupport,
      finalCounts: {
        captures: session.captures.length,
        cards: session.reviewCards.length,
        openQuestions,
        closedQuestions,
        answers,
        notesHasFirstCapture
      },
      overflowX: document.body.scrollWidth > document.body.clientWidth,
      activeTab: activeTab()
    };
  })()`, 15000);

  assert.equal(run.sidecarStart.shellCompact, true);
  assert.deepEqual(run.sidecarStart.railSteps.map((step) => step.kind), ["source", "capture", "loop"]);
  assert.match(run.sidecarStart.railSteps[1].text, /Capture first point/);
  assert.match(run.sidecarStart.railSteps[1].text, /Focus field/);
  assert.deepEqual(run.railFocus, {
    activeTab: "captures",
    activeElement: "quoteInput",
    capturePanePulsed: true
  });
  assert.equal(run.firstCaptureActivity.title, "Capture saved");
  assert.equal(run.firstCaptureActivity.action, "Exit + View capture");
  assert.match(run.sidecarAfterFirstCapture.railSteps[1].text, /Capture next point/);
  assert.match(run.sidecarAfterFirstCapture.railSteps[1].text, /Focus field/);
  assert.match(run.firstCaptureLoop.text, /Needs next step/);
  assert.equal(run.firstCaptureLoop.action, "Choose next");
  assert.deepEqual(run.firstCaptureDecision, {
    activeTab: "captures",
    cardVisible: true,
    needsDecision: true,
    decisionButtons: ["Add to notes", "Save for recall"]
  });
  assert.match(run.afterNotesLoop.text, /Clear/);
  assert.doesNotMatch(run.afterNotesLoop.text, /Needs next step/);
  assert.match(run.questionLoop.text, /1 open/);
  assert.equal(run.questionLoop.action, "Answer");
  assert.match(run.questionSection, /Open Questions/);
  assert.match(run.questionSection, /How should a learner close this source-backed question/);
  assert.equal(run.answerDraft.activeTab, "captures");
  assert.match(run.answerDraft.thought, /^Answer:/);
  assert.match(run.answerDraft.quote, /Open questions should drive the next focused action/);
  assert.notEqual(run.answerDraft.draftTarget, "");
  assert.match(run.finalLoop.text, /Clear/);
  assert.match(run.longTextSupport.loop.text, /Clear/);
  assert.doesNotMatch(run.longTextSupport.loop.text, /Needs next step/);
  assert.equal(run.longTextSupport.overflowX, false);
  assert.equal(run.finalCounts.captures, 4);
  assert.equal(run.finalCounts.openQuestions, 0);
  assert.equal(run.finalCounts.closedQuestions, 1);
  assert.equal(run.finalCounts.answers, 1);
  assert.equal(run.finalCounts.notesHasFirstCapture, true);
  assert.equal(run.overflowX, false);

  const receipt = {
    schema: "learning-companion.agent-study-loop-smoke.v1",
    generatedAt: new Date().toISOString(),
    evidenceType: "CONTROLLED_AGENT_BROWSER_SMOKE",
    provesRealUserDogfood: false,
    appUrl,
    runRoot,
    result: "PASS",
    elapsedMs: Date.now() - startedAtMs,
    caveats: [
      "Headless Chrome, not Mac WKWebView.",
      "Controlled agent fixture, not a human dogfood session.",
      "No HarmonyOS, Windows, Feishu, native picker, or real file movement coverage.",
      "No background Downloads scan; artifacts stay under project-local .codex-tmp/."
    ],
    checks: {
      sidecarCaptureRail: true,
      sidecarRailFocusesField: true,
      sidecarRailFlipsAfterFirstCapture: true,
      firstCaptureDecision: true,
      notesClearsLoop: true,
      openQuestionOwnsLoop: true,
      linkedAnswerClosesQuestion: true,
      longTextSupportCaptureDoesNotStealLoop: true,
      finalLoopClear: true,
      noHorizontalOverflow: true
    },
    observed: run
  };
  writeFileSync(outPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  cdp.close();
  console.log(`agent_study_loop_check_ok ${outPath}`);
} finally {
  chrome.kill("SIGTERM");
  await waitForProcessExit(chrome, 3000);
  server.close();
}

function parseArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] || "";
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
  const handlers = new Map();
  let id = 0;

  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", rejectOpen, { once: true });
  });

  socket.addEventListener("message", (message) => {
    const payload = JSON.parse(message.data);
    if (!payload.id || !pending.has(payload.id)) {
      if (payload.method && handlers.has(payload.method)) {
        handlers.get(payload.method).forEach((handler) => handler(payload.params || {}));
      }
      return;
    }
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
    on(method, handler) {
      const list = handlers.get(method) || [];
      list.push(handler);
      handlers.set(method, list);
    },
    close() {
      socket.close();
    }
  };
}

async function waitForNativeBridge(cdp, exceptions) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const ready = await cdp.evaluate(
      `typeof window.learningCompanionNative?.exportWorkspaceJson === "function"`,
      2000
    );
    if (ready) return;
    await sleep(100);
  }
  const latestException = exceptions.at(-1)?.exceptionDetails?.exception?.description
    || exceptions.at(-1)?.exceptionDetails?.text
    || "none";
  throw new Error(`Learning Companion native bridge was not ready; runtimeException=${latestException}`);
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
