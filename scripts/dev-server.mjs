import { createServer } from "node:http";
import { execFile } from "node:child_process";
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

const ALLOWED_INLINE_TAGS = new Set(["a", "b", "strong", "em", "i", "u", "code", "br", "span", "sub", "sup"]);
const ALLOWED_BLOCK_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "li", "pre", "blockquote", "img", "hr", "div", "section", "table", "thead", "tbody", "tr", "td", "th"]);
const ALLOWED_TAGS = new Set([...ALLOWED_INLINE_TAGS, ...ALLOWED_BLOCK_TAGS]);

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

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeXmlAttrs(tagName, attrsString) {
  // Keep only href, src, alt, title, style; strip lark-* and other custom attrs
  const allowedAttrs = tagName === "img"
    ? ["src", "alt", "title"]
    : tagName === "a"
      ? ["href", "title"]
      : [];
  const attrs = [];
  const attrRegex = /(\w[\w-]*)\s*=\s*"([^"]*)"/g;
  let match;
  while ((match = attrRegex.exec(attrsString)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2];
    if (allowedAttrs.includes(name)) {
      attrs.push(`${name}="${escapeHtml(value)}"`);
    }
  }
  if (tagName === "a") {
    attrs.push('target="_blank"', 'rel="noopener noreferrer"');
  }
  if (tagName === "img") {
    const hasStyle = attrs.some((a) => a.startsWith("style="));
    if (!hasStyle) {
      attrs.push('style="max-width:100%;height:auto;"');
    }
  }
  return attrs.length > 0 ? " " + attrs.join(" ") : "";
}

function convertXmlToHtml(raw) {
  let title = "";

  // Extract <title> first
  const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    title = titleMatch[1].replace(/<[^>]+>/g, "").trim();
  }

  // Convert <title>...</title> to <h1>...</h1>
  let html = raw.replace(/<title[^>]*>([\s\S]*?)<\/title>/gi, (_m, inner) => `<h1>${inner}</h1>`);

  // Process tags: keep allowed tags, strip disallowed tags (unwrap their content),
  // sanitize attributes
  html = html.replace(/<\/?([a-zA-Z][\w-]*)([^>]*)\/?>/g, (match, tagName, attrs) => {
    const lower = tagName.toLowerCase();
    const isClosing = match.startsWith("</");
    const isSelfClosing = match.endsWith("/>");

    if (!ALLOWED_TAGS.has(lower)) {
      // Strip the tag but keep content
      return "";
    }

    if (isClosing) {
      return `</${lower}>`;
    }
    if (isSelfClosing) {
      return `<${lower}${sanitizeXmlAttrs(lower, attrs)} />`;
    }
    return `<${lower}${sanitizeXmlAttrs(lower, attrs)}>`;
  });

  // If no title found yet, look for first <h1>
  if (!title) {
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      title = h1Match[1].replace(/<[^>]+>/g, "").trim();
    }
  }

  // Collapse excessive blank lines
  html = html.replace(/\n{3,}/g, "\n\n");

  return { html, title };
}

function convertMarkdownToHtml(raw) {
  const lines = raw.split(/\r?\n/);
  const result = [];
  let title = "";
  let inCodeBlock = false;
  let inList = null; // "ul" or "ol"
  let paragraph = [];

  function flushParagraph() {
    if (paragraph.length > 0) {
      result.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  }

  function closeList() {
    if (inList) {
      result.push(`</${inList}>`);
      inList = null;
    }
  }

  for (const line of lines) {
    // Code fences
    if (line.startsWith("```")) {
      flushParagraph();
      closeList();
      if (!inCodeBlock) {
        result.push("<pre><code>");
        inCodeBlock = true;
      } else {
        result.push("</code></pre>");
        inCodeBlock = false;
      }
      continue;
    }
    if (inCodeBlock) {
      result.push(escapeHtml(line));
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      closeList();
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      if (!title && level === 1) title = text;
      result.push(`<h${level}>${inlineMarkdown(text)}</h${level}>`);
      continue;
    }

    // Unordered list items
    const ulMatch = line.match(/^[\s]*[-*+]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      if (inList !== "ul") {
        closeList();
        result.push("<ul>");
        inList = "ul";
      }
      result.push(`<li>${inlineMarkdown(ulMatch[1].trim())}</li>`);
      continue;
    }

    // Ordered list items
    const olMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      if (inList !== "ol") {
        closeList();
        result.push("<ol>");
        inList = "ol";
      }
      result.push(`<li>${inlineMarkdown(olMatch[1].trim())}</li>`);
      continue;
    }

    // Blockquote
    const bqMatch = line.match(/^>\s?(.+)$/);
    if (bqMatch) {
      flushParagraph();
      closeList();
      result.push(`<blockquote>${inlineMarkdown(bqMatch[1].trim())}</blockquote>`);
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line) || /^\*\*\*+\s*$/.test(line)) {
      flushParagraph();
      closeList();
      result.push("<hr>");
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      flushParagraph();
      closeList();
      continue;
    }

    // Regular text -> accumulate in paragraph
    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();

  if (!title) {
    // Use first non-empty line as title
    title = lines.map((l) => l.trim()).find((l) => l.length > 0) || "";
    title = title.replace(/^#+\s*/, "").slice(0, 120);
  }

  return { html: result.join("\n"), title };
}

function inlineMarkdown(text) {
  // Images: ![alt](url)
  let out = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) => {
    return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" style="max-width:100%;height:auto;">`;
  });
  // Links: [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  // Inline code
  out = out.replace(/`([^`]+)`/g, (_m, code) => `<code>${escapeHtml(code)}</code>`);
  // Bold
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // Italic
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(/_([^_]+)_/g, "<em>$1</em>");
  return out;
}

function convertLarkToHtml(raw) {
  const trimmed = raw.trim();
  // Detect if output is XML/HTML-like: starts with < and contains known tags
  const looksLikeXml = /<[a-zA-Z][\w-]*[\s>]/i.test(trimmed) && /<\/[a-zA-Z][\w-]*>/i.test(trimmed);

  const { html: innerHtml, title } = looksLikeXml
    ? convertXmlToHtml(trimmed)
    : convertMarkdownToHtml(trimmed);

  const finalTitle = title || trimmed.split("\n")[0].slice(0, 120) || "Untitled";
  const html = `<article class="reader-article">\n${innerHtml}\n</article>`;
  return { html, title: finalTitle };
}

function execFileAsync(file, args, options) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        const err = new Error(stderr || error.message);
        err.cause = error;
        reject(err);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

const MAX_DOC_SIZE = 500 * 1024; // 500 KB

function extractTitleFromHtml(html) {
  // Prefer explicit <title>...</title>
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    const t = titleMatch[1].replace(/<[^>]+>/g, "").trim();
    if (t) return t;
  }
  // Fall back to first <h1>...</h1>
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const t = h1Match[1].replace(/<[^>]+>/g, "").trim();
    if (t) return t;
  }
  return "";
}

async function handleFetchDoc(url, response) {
  const docUrl = url.searchParams.get("url");
  if (!docUrl) {
    sendJson(response, 400, { ok: false, error: "Missing 'url' query parameter" });
    return;
  }
  try {
    const { stdout } = await execFileAsync(
      "lark-cli",
      ["docs", "+fetch", "--api-version", "v2", "--doc", docUrl],
      { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
    );

    let html;
    let title;

    // lark-cli returns JSON: { ok, data: { document: { content, document_id } } }
    // The content field is already clean HTML.
    try {
      const parsed = JSON.parse(stdout);
      const docContent = parsed?.data?.document?.content;
      if (typeof docContent === "string" && docContent.length > 0) {
        if (docContent.length > MAX_DOC_SIZE) {
          sendJson(response, 413, { ok: false, error: "Document too large" });
          return;
        }
        title = extractTitleFromHtml(docContent) || parsed?.data?.document?.title || "";
        html = `<article class="reader-article">\n${docContent}\n</article>`;
      } else {
        // JSON parsed but no content field - fall through to fallback
        throw new Error("No document.content in lark-cli JSON response");
      }
    } catch {
      // Fallback: stdout is not JSON (or missing content) - treat as raw XML/markdown
      const converted = convertLarkToHtml(stdout);
      if (converted.html.length > MAX_DOC_SIZE) {
        sendJson(response, 413, { ok: false, error: "Document too large" });
        return;
      }
      html = converted.html;
      title = converted.title;
    }

    if (html.length > MAX_DOC_SIZE) {
      sendJson(response, 413, { ok: false, error: "Document too large" });
      return;
    }

    sendJson(response, 200, { ok: true, html, title });
  } catch (error) {
    sendJson(response, 500, { ok: false, error: error.message || String(error) });
  }
}

async function handleFetchUrl(url, response) {
  const targetUrl = url.searchParams.get("url");
  if (!targetUrl) {
    sendJson(response, 400, { ok: false, error: "Missing 'url' query parameter" });
    return;
  }
  // SSRF protection: only allow http(s), block private/local IPs
  let parsed;
  try { parsed = new URL(targetUrl); } catch { sendJson(response, 400, { ok: false, error: "Invalid URL" }); return; }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    sendJson(response, 400, { ok: false, error: "Only http(s) URLs allowed" });
    return;
  }
  const blockedHosts = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|0\.|::1|fe80:|fc00:|fd00:)/i;
  if (blockedHosts.test(parsed.hostname)) {
    sendJson(response, 403, { ok: false, error: "Internal addresses not allowed" });
    return;
  }
  try {
    const res = await fetch(targetUrl, {
      headers: { "User-Agent": "Mozilla/5.0 LearningCompanion/1.0" },
      redirect: "follow"
    });
    const html = await res.text();
    sendJson(response, 200, { ok: true, html });
  } catch (error) {
    sendJson(response, 500, { ok: false, error: error.message || String(error) });
  }
}

function createStaticServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");

      // API routes take precedence
      if (url.pathname.startsWith("/api/")) {
        if (request.method !== "GET" && request.method !== "HEAD") {
          sendJson(response, 405, { ok: false, error: "Method not allowed" });
          return;
        }
        if (url.pathname === "/api/fetch-doc") {
          await handleFetchDoc(url, response);
          return;
        }
        if (url.pathname === "/api/fetch-url") {
          await handleFetchUrl(url, response);
          return;
        }
        sendJson(response, 404, { ok: false, error: "Unknown API endpoint" });
        return;
      }

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
