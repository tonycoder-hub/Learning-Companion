import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";

const root = resolve("apps/companion-web");
const defaultHost = process.env.LC_DEV_HOST || "127.0.0.1";
const defaultPort = Number.parseInt(process.env.LC_DEV_PORT || "5173", 10);
const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"]
]);

function parseArgs(argv) {
  const options = {
    host: defaultHost,
    port: Number.isFinite(defaultPort) ? defaultPort : 5173,
    strictPort: false
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
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return options;
}

function printHelp() {
  console.log("Usage: npm run dev -- [--host 127.0.0.1] [--port 5174] [--strict-port]");
}

function resolveRoute(pathname) {
  let routePath = pathname === "/" ? "/index.html" : pathname;
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

const options = parseArgs(process.argv.slice(2));
const { address, requestedPort } = await listenWithFallback(options);
const selectedPort = typeof address === "object" && address ? address.port : options.port;
if (selectedPort !== requestedPort) {
  console.log(`Port ${requestedPort} unavailable; using ${selectedPort}.`);
}
console.log(`Learning Companion dev server listening on http://${options.host}:${selectedPort}/`);
console.log("Serving apps/companion-web");
console.log("Press Ctrl+C to stop.");
