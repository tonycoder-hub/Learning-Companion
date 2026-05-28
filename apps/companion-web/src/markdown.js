import { safeHref } from "./model.js";

export function renderMarkdown(container, markdown) {
  container.replaceChildren();
  const lines = String(markdown || "").split(/\r?\n/);
  let list = null;
  let quoteLines = [];
  let codeLines = [];
  let inCode = false;

  const flushList = () => {
    if (list) {
      container.append(list);
      list = null;
    }
  };
  const flushQuote = () => {
    if (quoteLines.length) {
      flushList();
      const blockquote = document.createElement("blockquote");
      blockquote.textContent = quoteLines.join("\n");
      container.append(blockquote);
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
      container.append(pre);
      codeLines = [];
    }
  };

  lines.forEach((line) => {
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

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushList();
      flushQuote();
      const level = String(Math.min(heading[1].length + 2, 5));
      const node = document.createElement(`h${level}`);
      appendInline(node, heading[2]);
      container.append(node);
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
    container.append(paragraph);
  });

  flushCode();
  flushList();
  flushQuote();
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
