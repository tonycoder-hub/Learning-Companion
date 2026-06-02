import { safeHref } from "./model.js";

const CAPTURE_MARKER_PATTERN = /^<!--\s*learning-companion:capture:([A-Za-z0-9._:-]+):(start|end)\s*-->$/;

export function renderMarkdown(container, markdown) {
  container.replaceChildren();
  const lines = String(markdown || "").split(/\r?\n/);
  const validCaptureMarkerLines = findValidCaptureMarkerLines(lines);
  let list = null;
  let quoteLines = [];
  let codeLines = [];
  let inCode = false;
  let captureBlock = null;

  const appendNode = (node) => {
    (captureBlock || container).append(node);
  };

  const flushList = () => {
    if (list) {
      appendNode(list);
      list = null;
    }
  };
  const flushQuote = () => {
    if (quoteLines.length) {
      flushList();
      const blockquote = document.createElement("blockquote");
      blockquote.textContent = quoteLines.join("\n");
      appendNode(blockquote);
      quoteLines = [];
    }
  };
  const flushCode = () => {
    if (codeLines.length) {
      flushList();
      flushQuote();
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = codeLines.join("\n");
      pre.append(code);
      appendNode(pre);
      codeLines = [];
    }
  };

  const closeCaptureBlock = () => {
    flushList();
    flushQuote();
    flushCode();
    captureBlock = null;
  };

  lines.forEach((line, index) => {
    if (line.trim().startsWith("```")) {
      if (inCode) flushCode();
      inCode = !inCode;
      return;
    }
    if (inCode) {
      codeLines.push(line);
      return;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      flushQuote();
      return;
    }
    if (/^<!--\s*learning-companion:synthesis:(start|end)\s*-->$/.test(trimmed)) {
      flushList();
      flushQuote();
      return;
    }
    const captureMarker = CAPTURE_MARKER_PATTERN.exec(trimmed);
    if (captureMarker && validCaptureMarkerLines.has(index)) {
      if (captureMarker[2] === "start") {
        flushList();
        flushQuote();
        flushCode();
        captureBlock = document.createElement("section");
        captureBlock.className = "note-capture-block";
        captureBlock.dataset.noteCaptureId = captureMarker[1];
        captureBlock.setAttribute("aria-label", "Generated capture note");
        captureBlock.tabIndex = -1;
        container.append(captureBlock);
      } else {
        closeCaptureBlock();
      }
      return;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushList();
      flushQuote();
      const level = String(Math.min(heading[1].length + 2, 5));
      const node = document.createElement(`h${level}`);
      appendInline(node, heading[2]);
      appendNode(node);
      return;
    }

    const bullet = /^[-*]\s+(.+)$/.exec(trimmed);
    if (bullet) {
      flushQuote();
      if (!list) list = document.createElement("ul");
      const item = document.createElement("li");
      appendInline(item, bullet[1]);
      list.append(item);
      return;
    }

    if (trimmed.startsWith(">")) {
      quoteLines.push(trimmed.replace(/^>\s?/, ""));
      return;
    }

    flushList();
    flushQuote();
    const paragraph = document.createElement("p");
    appendInline(paragraph, trimmed);
    appendNode(paragraph);
  });

  flushCode();
  flushList();
  flushQuote();
}

function findValidCaptureMarkerLines(lines) {
  const valid = new Set();
  let pending = null;
  let inCode = false;
  lines.forEach((line, index) => {
    if (line.trim().startsWith("```")) {
      inCode = !inCode;
      return;
    }
    if (inCode) return;
    const marker = CAPTURE_MARKER_PATTERN.exec(line.trim());
    if (!marker) return;
    if (marker[2] === "start") {
      pending = { id: marker[1], index };
      return;
    }
    if (pending?.id === marker[1]) {
      valid.add(pending.index);
      valid.add(index);
      pending = null;
      return;
    }
    pending = null;
  });
  return valid;
}

function appendInline(parent, text) {
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let cursor = 0;
  let match = pattern.exec(text);
  while (match) {
    if (match.index > cursor) parent.append(document.createTextNode(text.slice(cursor, match.index)));
    const href = safeHref(match[2]);
    if (href === "#") {
      parent.append(document.createTextNode(match[1]));
    } else {
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.textContent = match[1];
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      parent.append(anchor);
    }
    cursor = match.index + match[0].length;
    match = pattern.exec(text);
  }
  if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
}
