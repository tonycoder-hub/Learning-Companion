// Material viewer: embeds video/doc in the center of the desk.
// Detects source type (YouTube/Bilibili/Vimeo/iframe/fallback) and renders accordingly.

import {
  isYouTubeHost,
  isBilibiliHost,
  isVimeoHost,
  extractSourceTimestamp,
  timestampToSeconds,
  secondsToTimestamp,
  buildSourceJumpUrl,
  cleanUrl,
} from "./model.js";
import { sanitizeHtml, extractReadableContent, renderReaderContent } from "./reader.js";

// --- i18n ---

const STRINGS = {
  en: {
    typeLabels: { video: "▶ Video", article: "📄 Article", doc: "📑 Doc", course: "📚 Course", book: "📖 Book", other: "📎 Other" },
    captureAtTime: "⏱ Capture at time",
    captureAtTimeTitle: "Use current video time for capture",
    openExternal: "↗ Open",
    openExternalTitle: "Open in new tab",
    collapse: "▼",
    expand: "▲",
    collapseTitle: "Collapse viewer",
    expandTitle: "Expand viewer",
    blockedNote: "If the content is blocked by the site, use the ↗ Open button.",
    fallbackTitle: "External source",
    fallbackHint: "This content cannot be embedded. Open it in a new tab, then paste quotes here.",
    videoPlayer: "Video player",
    docViewer: "Document viewer",
    loading: "Loading...",
  },
  zh: {
    typeLabels: { video: "▶ 视频", article: "📄 文章", doc: "📑 文档", course: "📚 课程", book: "📖 书籍", other: "📎 其他" },
    captureAtTime: "⏱ 截取此时",
    captureAtTimeTitle: "用当前视频时间做摘录",
    openExternal: "↗ 新窗口打开",
    openExternalTitle: "在新标签页打开",
    collapse: "▼",
    expand: "▲",
    collapseTitle: "收起阅读区",
    expandTitle: "展开阅读区",
    blockedNote: "如果内容被网站阻止嵌入，请点 ↗ 新窗口打开。",
    fallbackTitle: "外部来源",
    fallbackHint: "此内容无法嵌入。在新标签页打开后，把要点粘贴到这里即可。",
    videoPlayer: "视频播放器",
    docViewer: "文档阅读器",
    loading: "加载中...",
  }
};

function uiLang() {
  return document.body?.dataset?.uiLanguage === "zh" ? "zh" : "en";
}
function t(key) {
  return STRINGS[uiLang()][key] ?? STRINGS.en[key] ?? key;
}
function tType(mat) {
  return t("typeLabels")[mat] || mat;
}

// --- URL parsing for embed IDs ---

function parseYouTubeId(url) {
  const u = new URL(url);
  if (u.hostname === "youtu.be") return u.pathname.slice(1);
  if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2];
  return u.searchParams.get("v") || "";
}

function parseBilibiliId(url) {
  const m = url.pathname.match(/\/video\/(BV[\w]+)/i);
  return m ? m[1] : "";
}

function parseVimeoId(url) {
  const m = url.pathname.match(/\/(\d+)/);
  return m ? m[1] : "";
}

// --- Embed URL builders ---

export function buildEmbedUrl(sourceUrl, timestampSec) {
  const href = cleanUrl(sourceUrl);
  if (!href) return "";
  try {
    const url = new URL(href);
    const ts = Number.isFinite(timestampSec) && timestampSec > 0 ? Math.floor(timestampSec) : 0;
    if (isYouTubeHost(url.hostname)) {
      const id = parseYouTubeId(url);
      if (!id) return "";
      const base = `https://www.youtube.com/embed/${id}?enablejsapi=1&rel=0&modestbranding=1`;
      return ts > 0 ? `${base}&start=${ts}` : base;
    }
    if (isBilibiliHost(url.hostname)) {
      const id = parseBilibiliId(url);
      if (!id) return "";
      const base = `https://player.bilibili.com/player.html?bvid=${id}&high_quality=1&danmaku=0&autoplay=0`;
      return ts > 0 ? `${base}&t=${ts}` : base;
    }
    if (isVimeoHost(url.hostname)) {
      const id = parseVimeoId(url);
      if (!id) return "";
      const base = `https://player.vimeo.com/video/${id}?title=0&byline=0&portrait=0`;
      return ts > 0 ? `${base}#t=${ts}s` : base;
    }
  } catch { /* invalid URL */ }
  return "";
}

export function resolveViewerMode(sourceUrl, materialType) {
  const href = cleanUrl(sourceUrl);
  if (!href) return "none";
  try {
    const url = new URL(href);
    if (isYouTubeHost(url.hostname) || isBilibiliHost(url.hostname) || isVimeoHost(url.hostname)) {
      return "video-embed";
    }
    if (materialType === "video") return "video-embed";
    // Feishu/Lark docs go through the reader fetch pipeline
    if (/feishu\.cn|larksuite\.com/.test(url.hostname)) {
      if (/\/(docx|wiki|docs)\//.test(url.pathname) || url.hostname.includes("feishu") || url.hostname.includes("larksuite")) {
        return "content";
      }
    }
    if (materialType === "doc") return "content";
    if (materialType === "article") return "content";
    if (materialType === "course") return "iframe-embed";
  } catch { /* invalid URL */ }
  return "fallback";
}

// --- YouTube postMessage API helpers ---

function youtubePostMessage(iframe, event, data) {
  if (!iframe?.contentWindow) return;
  try {
    iframe.contentWindow.postMessage(JSON.stringify({ event, ...data }), "https://www.youtube.com");
  } catch { /* cross-origin */ }
}

let youtubeApiReady = false;
function ensureYouTubeApi() {
  if (youtubeApiReady) return;
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
  youtubeApiReady = true;
}

// --- Fallback card ---

function appendFallbackCard(container, sourceUrl, sourceTitle) {
  const card = document.createElement("div");
  card.className = "viewer-fallback";
  const fbIcon = document.createElement("div");
  fbIcon.className = "viewer-fallback-icon";
  fbIcon.textContent = "📖";
  card.appendChild(fbIcon);
  const fbTitle = document.createElement("strong");
  fbTitle.textContent = sourceTitle || t("fallbackTitle");
  card.appendChild(fbTitle);
  const fbUrl = document.createElement("a");
  fbUrl.href = sourceUrl;
  fbUrl.target = "_blank";
  fbUrl.rel = "noopener noreferrer";
  fbUrl.textContent = sourceUrl;
  fbUrl.className = "viewer-fallback-url";
  card.appendChild(fbUrl);
  const openBtn = document.createElement("button");
  openBtn.className = "command-button primary";
  openBtn.type = "button";
  openBtn.textContent = t("openExternal");
  openBtn.onclick = () => window.open(sourceUrl, "_blank", "noopener,noreferrer");
  card.appendChild(openBtn);
  const fbHint = document.createElement("p");
  fbHint.textContent = t("fallbackHint");
  card.appendChild(fbHint);
  container.appendChild(card);
}

// --- Main render function ---

export function renderViewer(container, session, options = {}) {
  const { onTimestampChange, onOpenExternal, onToggleCollapse, startTimestamp, onQuoteCapture } = options;
  if (!container) return null;

  const sourceUrl = session?.sourceUrl || "";
  const sourceTitle = session?.sourceTitle || session?.title || "";
  const materialType = session?.materialType || "article";
  const mode = resolveViewerMode(sourceUrl, materialType);
  const viewerOpen = session?.viewerOpen !== false;
  const startSec = (startTimestamp != null ? Number(startTimestamp) : null)
    || timestampToSeconds(extractSourceTimestamp(sourceUrl))
    || 0;

  container.innerHTML = "";

  if (!sourceUrl || mode === "none") {
    container.hidden = true;
    return null;
  }

  container.hidden = !viewerOpen;

  // Toolbar
  const toolbar = document.createElement("div");
  toolbar.className = "viewer-toolbar";

  const typeLabel = document.createElement("span");
  typeLabel.className = "viewer-type";
  typeLabel.textContent = tType(materialType);
  toolbar.appendChild(typeLabel);

  const titleEl = document.createElement("span");
  titleEl.className = "viewer-title";
  titleEl.textContent = sourceTitle || sourceUrl;
  titleEl.title = sourceUrl;
  toolbar.appendChild(titleEl);

  const controls = document.createElement("span");
  controls.className = "viewer-controls";

  var currentTimeSec = startSec;
  var timeDisplay = null;

  if (mode === "video-embed") {
    timeDisplay = document.createElement("span");
    timeDisplay.className = "viewer-time";
    timeDisplay.textContent = startSec > 0 ? secondsToTimestamp(startSec) : "0:00";
    controls.appendChild(timeDisplay);

    const seekBack = document.createElement("button");
    seekBack.className = "mini-button";
    seekBack.type = "button";
    seekBack.textContent = "-15s";
    seekBack.onclick = () => seekVideo(-15);
    controls.appendChild(seekBack);

    const seekFwd = document.createElement("button");
    seekFwd.className = "mini-button";
    seekFwd.type = "button";
    seekFwd.textContent = "+15s";
    seekFwd.onclick = () => seekVideo(15);
    controls.appendChild(seekFwd);

    const captureAtTime = document.createElement("button");
    captureAtTime.className = "mini-button";
    captureAtTime.type = "button";
    captureAtTime.title = t("captureAtTimeTitle");
    captureAtTime.textContent = t("captureAtTime");
    captureAtTime.onclick = () => {
      if (onTimestampChange) onTimestampChange(currentTimeSec);
    };
    controls.appendChild(captureAtTime);

    var seekVideo = (delta) => {
      currentTimeSec = Math.max(0, currentTimeSec + delta);
      if (timeDisplay) timeDisplay.textContent = secondsToTimestamp(currentTimeSec);
      if (onTimestampChange) onTimestampChange(currentTimeSec);
      const iframe = container.querySelector(".viewer-iframe");
      if (iframe) {
        const href = cleanUrl(sourceUrl);
        try {
          const url = new URL(href);
          if (isYouTubeHost(url.hostname)) {
            youtubePostMessage(iframe, "command", { func: "seekTo", args: [currentTimeSec, true] });
          } else {
            iframe.src = buildEmbedUrl(sourceUrl, currentTimeSec);
          }
        } catch { /* ignore */ }
      }
    };
  }

  const openExt = document.createElement("button");
  openExt.className = "mini-button";
  openExt.type = "button";
  openExt.textContent = t("openExternal");
  openExt.title = t("openExternalTitle");
  openExt.onclick = () => {
    if (onOpenExternal) onOpenExternal(sourceUrl);
    else window.open(buildSourceJumpUrl(sourceUrl, session?.timestamp), "_blank", "noopener,noreferrer");
  };
  controls.appendChild(openExt);

  const collapseBtn = document.createElement("button");
  collapseBtn.className = "mini-button viewer-collapse";
  collapseBtn.type = "button";
  collapseBtn.textContent = viewerOpen ? t("collapse") : t("expand");
  collapseBtn.title = viewerOpen ? t("collapseTitle") : t("expandTitle");
  collapseBtn.onclick = () => { if (onToggleCollapse) onToggleCollapse(); };
  controls.appendChild(collapseBtn);

  toolbar.appendChild(controls);
  container.appendChild(toolbar);

  // Content area
  const content = document.createElement("div");
  content.className = "viewer-content";

  if (mode === "video-embed") {
    const embedUrl = buildEmbedUrl(sourceUrl, startSec);
    if (embedUrl) {
      const wrap = document.createElement("div");
      wrap.className = "viewer-iframe-wrap";
      const iframe = document.createElement("iframe");
      iframe.className = "viewer-iframe";
      iframe.src = embedUrl;
      iframe.title = sourceTitle || t("videoPlayer");
      iframe.loading = "lazy";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";
      iframe.sandbox = "allow-scripts allow-same-origin allow-presentation allow-popups";
      iframe.setAttribute("allowfullscreen", "");
      wrap.appendChild(iframe);
      content.appendChild(wrap);

      if (sourceUrl.includes("youtube.com") || sourceUrl.includes("youtu.be")) {
        ensureYouTubeApi();
        window.addEventListener("message", (e) => {
          if (e.origin !== "https://www.youtube.com") return;
          try {
            const data = JSON.parse(e.data);
            if (data.info?.currentTime) {
              currentTimeSec = Math.floor(data.info.currentTime);
              if (timeDisplay) timeDisplay.textContent = secondsToTimestamp(currentTimeSec);
            }
          } catch { /* not JSON */ }
        });
        youtubePostMessage(iframe, "listening");
      }
    } else {
      appendFallbackCard(content, sourceUrl, sourceTitle);
    }
  } else if (mode === "iframe-embed") {
    const wrap = document.createElement("div");
    wrap.className = "viewer-iframe-wrap";
    const iframe = document.createElement("iframe");
    iframe.className = "viewer-iframe";
    iframe.src = sourceUrl;
    iframe.title = sourceTitle || t("docViewer");
    iframe.loading = "lazy";
    iframe.sandbox = "allow-scripts allow-popups";
    iframe.referrerPolicy = "no-referrer";
    wrap.appendChild(iframe);
    content.appendChild(wrap);

    const fallbackNote = document.createElement("p");
    fallbackNote.className = "viewer-iframe-note";
    fallbackNote.textContent = t("blockedNote");
    content.appendChild(fallbackNote);
  } else if (mode === "content") {
    // Reader mode: fetch and render article content
    const loadingEl = document.createElement("div");
    loadingEl.className = "reader-loading";
    loadingEl.textContent = t("loading");
    content.appendChild(loadingEl);

    const isFeishu = /feishu\.cn|larksuite\.com/.test(sourceUrl);
    const endpoint = isFeishu
      ? `/api/fetch-doc?url=${encodeURIComponent(sourceUrl)}`
      : `/api/fetch-url?url=${encodeURIComponent(sourceUrl)}`;

    fetch(endpoint)
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("fetch failed")))
      .then((result) => {
        if (result && result.ok) {
          let processed;
          if (isFeishu) {
            processed = result.html || "";
          } else {
            processed = sanitizeHtml(extractReadableContent(result.html || ""));
          }
          content.innerHTML = "";
          renderReaderContent(content, {
            html: processed,
            url: sourceUrl,
            title: result.title || sourceTitle,
            onQuoteCapture: (text) => {
              if (onQuoteCapture) onQuoteCapture(text);
            },
            lang: document.body?.dataset?.uiLanguage,
          });
        } else {
          content.innerHTML = "";
          renderReaderContent(content, {
            html: "",
            url: sourceUrl,
            title: sourceTitle,
            onQuoteCapture: (text) => {
              if (onQuoteCapture) onQuoteCapture(text);
            },
            lang: document.body?.dataset?.uiLanguage,
          });
        }
      })
      .catch(() => {
        content.innerHTML = "";
        renderReaderContent(content, {
          html: "",
          url: sourceUrl,
          title: sourceTitle,
          onQuoteCapture: (text) => {
            if (onQuoteCapture) onQuoteCapture(text);
          },
          lang: document.body?.dataset?.uiLanguage,
        });
      });
  } else {
    appendFallbackCard(content, sourceUrl, sourceTitle);
  }

  container.appendChild(content);
  return container;
}
