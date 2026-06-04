#!/usr/bin/env node
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";

const root = resolve(process.env.MORNING_DEMO_OUT_DIR || "dist/morning-demo");
const defaultHost = process.env.LC_MORNING_HOST || "127.0.0.1";
const defaultPort = Number.parseInt(process.env.LC_MORNING_PORT || "5174", 10);
const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".zip", "application/zip"],
  [".txt", "text/plain; charset=utf-8"]
]);

function parseArgs(argv) {
  const options = {
    host: defaultHost,
    port: Number.isFinite(defaultPort) ? defaultPort : 5174,
    strictPort: false,
    smoke: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--host" || arg === "--bind") {
      options.host = argv[index + 1] || options.host;
      index += 1;
    } else if (arg === "--port") {
      const value = Number.parseInt(argv[index + 1] || "", 10);
      if (Number.isFinite(value)) options.port = value;
      index += 1;
    } else if (arg === "--strict-port") {
      options.strictPort = true;
    } else if (arg === "--smoke") {
      options.smoke = true;
      options.port = 0;
      options.strictPort = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return options;
}

function printHelp() {
  console.log("Usage: npm run demo:morning:serve -- [--host 127.0.0.1] [--port 5174] [--strict-port]");
  console.log("Smoke: node scripts/serve-morning-demo.mjs --smoke");
}

function resolveRoute(pathname) {
  let routePath = pathname === "/" ? "/review-start-here.html" : pathname;
  try {
    routePath = decodeURIComponent(routePath);
  } catch {
    return null;
  }
  const filePath = resolve(root, `.${routePath}`);
  const relativePath = relative(root, filePath);
  if (relativePath === "" || relativePath.startsWith("..") || relativePath.includes(`..${sep}`)) return null;
  return filePath;
}

function createStaticServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      const filePath = resolveRoute(url.pathname);
      if (!filePath) {
        response.writeHead(403);
        response.end("forbidden");
        return;
      }
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
}

function listenOnce(server, host, port) {
  return new Promise((resolveListen, rejectListen) => {
    const onError = (error) => {
      server.off("listening", onListening);
      rejectListen(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolveListen(server.address());
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

async function listenWithFallback(options) {
  const candidates = options.strictPort || options.port === 0
    ? [options.port]
    : Array.from({ length: 20 }, (_, index) => options.port + index);
  let lastError = null;
  for (const port of candidates) {
    const server = createStaticServer();
    try {
      const address = await listenOnce(server, options.host, port);
      return { server, address, requestedPort: options.port };
    } catch (error) {
      lastError = error;
      try {
        server.close();
      } catch {
        // The listen attempt can fail before the server enters a running state.
      }
      if (error.code !== "EADDRINUSE" || options.strictPort) throw error;
    }
  }
  throw lastError;
}

async function smoke(server, address, host) {
  const selectedPort = typeof address === "object" && address ? address.port : 0;
  const baseUrl = `http://${host}:${selectedPort}/`;
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Learning Companion Morning Review/);
  assert.match(html, /Dogfood Route/);
  assert.match(html, /DOGFOOD_RUNBOOK\.md/);
  assert.match(html, /Fixture-only review pack/);
  const runbook = await fetch(`${baseUrl}DOGFOOD_RUNBOOK.md`);
  assert.equal(runbook.status, 200);
  assert.match(await runbook.text(), /Learning Companion Dogfood Runbook/);
  server.close();
  console.log("morning_demo_server_smoke_ok");
  console.log(baseUrl);
}

const options = parseArgs(process.argv.slice(2));
const { server, address, requestedPort } = await listenWithFallback(options);
const selectedPort = typeof address === "object" && address ? address.port : options.port;
if (options.smoke) {
  await smoke(server, address, options.host);
} else {
  if (selectedPort !== requestedPort) {
    console.log(`Port ${requestedPort} unavailable; using ${selectedPort}.`);
  }
  console.log(`Learning Companion morning review pack listening on http://${options.host}:${selectedPort}/`);
  console.log(`Serving ${root}`);
  console.log("Press Ctrl+C to stop.");
}
