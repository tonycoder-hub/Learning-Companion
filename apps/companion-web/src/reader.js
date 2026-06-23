// Reader content renderer: sanitization, content extraction, markdown conversion,
// and DOM rendering for the in-app article reader.

// --- HTML sanitization ---

const DANGEROUS_TAGS = [
  "script", "style", "iframe", "form", "input", "object", "embed", "noscript"
];

export function sanitizeHtml(html) {
  if (!html || typeof html !== "string") return "";
  let clean = html;

  // Remove dangerous tags and their content (case-insensitive)
  for (const tag of DANGEROUS_TAGS) {
    const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    clean = clean.replace(re, "");
    // Also remove self-closing or unclosed versions
    const re2 = new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi");
    clean = clean.replace(re2, "");
  }

  // Remove on* event handler attributes (e.g. onclick, onerror, onload, onmouseover)
  clean = clean.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // Remove javascript: URLs in href/src attributes
  clean = clean.replace(/\s+(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, "");
  clean = clean.replace(/\s+(href|src)\s*=\s*javascript:[^\s>]+/gi, "");

  return clean;
}

// --- Readable content extraction ---

const BOILERPLATE_SELECTORS = [
  "script", "style", "nav", "footer", "header", "aside",
  ".sidebar", ".nav", ".comments", ".ad",
  "[role=navigation]", ".header", ".footer"
];

export function extractReadableContent(rawHtml) {
  if (!rawHtml || typeof rawHtml !== "string") return "";
  const doc = new DOMParser().parseFromString(rawHtml, "text/html");

  // Remove boilerplate
  for (const sel of BOILERPLATE_SELECTORS) {
    doc.querySelectorAll(sel).forEach(el => el.remove());
  }

  // Collect candidates
  const candidates = [];

  const mainEl = doc.querySelector("main");
  if (mainEl) candidates.push(mainEl);
  const articleEl = doc.querySelector("article");
  if (articleEl) candidates.push(articleEl);
  const roleMain = doc.querySelector("[role=main]");
  if (roleMain) candidates.push(roleMain);

  // Also consider divs and sections with substantial paragraph content
  doc.querySelectorAll("div, section").forEach(el => {
    const pCount = el.querySelectorAll("p").length;
    if (pCount >= 3) candidates.push(el);
  });

  let best = null;
  let bestScore = 0;

  for (const el of candidates) {
    const pCount = el.querySelectorAll("p").length;
    const textLen = (el.textContent || "").trim().length;
    const score = pCount * 10 + textLen / 100;
    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }

  if (best && bestScore > 0) {
    return best.innerHTML;
  }

  const body = doc.body;
  return body ? body.innerHTML : "";
}

// --- Simple Markdown to HTML ---

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineFormat(text) {
  // Escape HTML first
  let out = escapeHtml(text);

  // Inline code (handle before other inline to avoid mangling)
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Links [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const safeUrl = /^https?:\/\//i.test(url) ? url : "#";
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // Bold **text**
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Italic *text*
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");

  return out;
}

export function markdownToSimpleHtml(md) {
  if (!md || typeof md !== "string") return "";

  const lines = md.split("\n");
  const out = [];
  let i = 0;
  let inCodeBlock = false;
  let codeLines = [];
  let listType = null; // "ul" or "ol"
  let listItems = [];

  function flushList() {
    if (listType && listItems.length > 0) {
      const tag = listType;
      out.push(`<${tag}>`);
      for (const item of listItems) {
        out.push(`<li>${inlineFormat(item)}</li>`);
      }
      out.push(`</${tag}>`);
      listType = null;
      listItems = [];
    }
  }

  while (i < lines.length) {
    const line = lines[i];

    // Code block fences
    if (/^```/.test(line)) {
      flushList();
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLines = [];
      } else {
        inCodeBlock = false;
        out.push("<pre><code>" + escapeHtml(codeLines.join("\n")) + "</code></pre>");
        codeLines = [];
      }
      i++;
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      flushList();
      out.push("<hr>");
      i++;
      continue;
    }

    // Headings
    const h4 = line.match(/^####\s+(.*)/);
    const h3 = line.match(/^###\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h1 = line.match(/^#\s+(.*)/);
    if (h4) { flushList(); out.push(`<h4>${inlineFormat(h4[1])}</h4>`); i++; continue; }
    if (h3) { flushList(); out.push(`<h3>${inlineFormat(h3[1])}</h3>`); i++; continue; }
    if (h2) { flushList(); out.push(`<h2>${inlineFormat(h2[1])}</h2>`); i++; continue; }
    if (h1) { flushList(); out.push(`<h1>${inlineFormat(h1[1])}</h1>`); i++; continue; }

    // Blockquote
    const bq = line.match(/^>\s?(.*)/);
    if (bq) {
      flushList();
      const bqLines = [bq[1]];
      i++;
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        bqLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${inlineFormat(bqLines.join(" "))}</blockquote>`);
      continue;
    }

    // Unordered list
    const ul = line.match(/^[-*]\s+(.*)/);
    if (ul) {
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listItems.push(ul[1]);
      i++;
      continue;
    }

    // Ordered list
    const ol = line.match(/^\d+\.\s+(.*)/);
    if (ol) {
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(ol[1]);
      i++;
      continue;
    }

    // Empty line - flush list, then skip
    if (/^\s*$/.test(line)) {
      flushList();
      i++;
      continue;
    }

    // Paragraph: collect consecutive non-empty, non-special lines
    flushList();
    const paraLines = [line];
    i++;
    while (i < lines.length) {
      const nxt = lines[i];
      if (/^\s*$/.test(nxt)) break;
      if (/^```/.test(nxt)) break;
      if (/^---+\s*$/.test(nxt)) break;
      if (/^#{1,4}\s/.test(nxt)) break;
      if (/^>\s?/.test(nxt)) break;
      if (/^[-*]\s+/.test(nxt)) break;
      if (/^\d+\.\s+/.test(nxt)) break;
      paraLines.push(nxt);
      i++;
    }
    out.push(`<p>${inlineFormat(paraLines.join(" "))}</p>`);
  }

  flushList();
  if (inCodeBlock && codeLines.length > 0) {
    out.push("<pre><code>" + escapeHtml(codeLines.join("\n")) + "</code></pre>");
  }

  return out.join("\n");
}

// --- Reader rendering ---

let selectionDismissInstalled = false;

function removeSelectionButton() {
  document.querySelectorAll(".selection-capture-btn").forEach((existing) => existing.remove());
}

function selectionLabel(lang) {
  return lang === "zh" ? "摘录" : "Quote";
}

function selectionAriaLabel(lang) {
  return lang === "zh" ? "摘录选中文本到快速摘录" : "Quote selected text into Quick Capture";
}

function selectionInsideArticle(article, selection) {
  if (!article || !selection || selection.rangeCount === 0) return false;
  const anchor = selection.anchorNode;
  const focus = selection.focusNode;
  return Boolean(anchor && focus && article.contains(anchor) && article.contains(focus));
}

function selectionRect(range) {
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
  if (rects.length) return rects[0];
  const rect = range.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0 ? rect : null;
}

function placeSelectionButton(button, rect) {
  const margin = 8;
  const width = Math.max(88, button.offsetWidth || 100);
  const height = Math.max(32, button.offsetHeight || 32);
  const maxLeft = Math.max(margin, window.innerWidth - width - margin);
  const maxTop = Math.max(margin, window.innerHeight - height - margin);
  const rawLeft = rect.left + rect.width / 2 - width / 2;
  const rawTop = rect.top - height - margin;
  const left = Math.min(maxLeft, Math.max(margin, rawLeft));
  const top = Math.min(maxTop, Math.max(margin, rawTop));
  button.style.left = `${left}px`;
  button.style.top = `${top}px`;
}

function showSelectionButton(article, onQuoteCapture, lang) {
  removeSelectionButton();
  const sel = window.getSelection();
  if (!selectionInsideArticle(article, sel)) return;
  const text = sel.toString().replace(/\s+/g, " ").trim();
  if (text.length <= 2) return;

  const range = sel.getRangeAt(0);
  const rect = selectionRect(range);
  if (!rect) return;

  const btn = document.createElement("button");
  btn.className = "selection-capture-btn";
  btn.type = "button";
  btn.textContent = selectionLabel(lang);
  btn.title = selectionAriaLabel(lang);
  btn.setAttribute("aria-label", selectionAriaLabel(lang));
  btn.style.visibility = "hidden";
  btn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onQuoteCapture) onQuoteCapture(text);
    removeSelectionButton();
    sel.removeAllRanges();
  });
  document.body.appendChild(btn);
  placeSelectionButton(btn, rect);
  btn.style.visibility = "";
}

function ensureSelectionDismissListener() {
  if (selectionDismissInstalled) return;
  selectionDismissInstalled = true;
  const dismiss = (e) => {
    if (e.target && e.target.classList && e.target.classList.contains("selection-capture-btn")) return;
    removeSelectionButton();
  };
  document.addEventListener("mousedown", dismiss);
  document.addEventListener("touchstart", dismiss, { passive: true });
}

export function renderReaderContent(container, options) {
  if (!container) return;
  const { html, url, title, onQuoteCapture, lang } = options || {};

  container.innerHTML = "";

  const scroll = document.createElement("div");
  scroll.className = "reader-scroll";

  // Source bar
  if (url) {
    const bar = document.createElement("div");
    bar.className = "reader-source-bar";
    let domain = url;
    try { domain = new URL(url).hostname; } catch { /* keep as-is */ }
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = domain;
    bar.appendChild(link);
    if (title) {
      const sep = document.createElement("span");
      sep.textContent = "·";
      bar.appendChild(sep);
      const titleSpan = document.createElement("span");
      titleSpan.textContent = title;
      titleSpan.style.overflow = "hidden";
      titleSpan.style.textOverflow = "ellipsis";
      titleSpan.style.whiteSpace = "nowrap";
      bar.appendChild(titleSpan);
    }
    scroll.appendChild(bar);
  }

  const article = document.createElement("div");
  article.className = "reader-article";

  const hasContent = html && typeof html === "string" && html.trim().length > 0;

  if (hasContent) {
    article.innerHTML = sanitizeHtml(html);
    scroll.appendChild(article);
  } else {
    // Paste fallback
    const hint = document.createElement("div");
    hint.className = "reader-paste-hint";
    hint.textContent = lang === "zh"
      ? "无法加载内容？请把文章粘贴到下方。"
      : "Can't load the content? Paste the article below.";
    scroll.appendChild(hint);

    const textarea = document.createElement("textarea");
    textarea.className = "reader-paste-area";
    textarea.placeholder = lang === "zh" ? "粘贴文章内容..." : "Paste article content...";
    scroll.appendChild(textarea);

    const preview = document.createElement("div");
    preview.className = "reader-paste-preview";
    scroll.appendChild(preview);

    textarea.addEventListener("input", () => {
      preview.innerHTML = markdownToSimpleHtml(textarea.value);
    });
  }

  container.appendChild(scroll);

  // Text selection handling (only when there is article content)
  if (hasContent) {
    article.tabIndex = 0;
    article.addEventListener("mouseup", () => requestAnimationFrame(() => showSelectionButton(article, onQuoteCapture, lang)));
    article.addEventListener("keyup", () => requestAnimationFrame(() => showSelectionButton(article, onQuoteCapture, lang)));
    article.addEventListener("touchend", () => setTimeout(() => showSelectionButton(article, onQuoteCapture, lang), 0), { passive: true });
    ensureSelectionDismissListener();
  }
}
