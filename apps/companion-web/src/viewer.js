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
    themeLight: "Light",
    themeSepia: "Sepia",
    themeDark: "Dark",
    themeTitle: "Reading theme",
    fontSizeTitle: "Reader font size",
    fontSmaller: "A-",
    fontLarger: "A+",
    tocToggle: "TOC",
    tocTitle: "Table of contents",
    tocEmpty: "No headings",
    playbackSpeedTitle: "Playback speed",
    addBookmark: "＋ Bookmark",
    addBookmarkTitle: "Save current video time as a bookmark",
    videoBookmarks: "Bookmarks",
    openBookmarkTitle: "Jump to this bookmark",
    deleteBookmarkTitle: "Delete bookmark",
    noBookmarks: "No bookmarks yet",
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
    themeLight: "浅色",
    themeSepia: "纸色",
    themeDark: "深色",
    themeTitle: "阅读主题",
    fontSizeTitle: "阅读字号",
    fontSmaller: "A-",
    fontLarger: "A+",
    tocToggle: "目录",
    tocTitle: "目录",
    tocEmpty: "暂无标题",
    playbackSpeedTitle: "播放速度",
    addBookmark: "＋ 书签",
    addBookmarkTitle: "把当前视频时间保存为书签",
    videoBookmarks: "书签",
    openBookmarkTitle: "跳到这个书签",
    deleteBookmarkTitle: "删除书签",
    noBookmarks: "暂无书签",
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

const READER_THEMES = new Set(["light", "sepia", "dark"]);
const READER_FONT_MIN = 14;
const READER_FONT_MAX = 20;
const READER_FONT_DEFAULT = 16;

function normalizeReaderPrefs(value = {}) {
  const theme = READER_THEMES.has(value.theme) ? value.theme : "light";
  const fontSize = Math.max(
    READER_FONT_MIN,
    Math.min(READER_FONT_MAX, Math.round(Number(value.fontSize) || READER_FONT_DEFAULT))
  );
  return {
    theme,
    fontSize,
    tocCollapsed: Boolean(value.tocCollapsed)
  };
}

function readerThemeLabel(theme) {
  if (theme === "sepia") return t("themeSepia");
  if (theme === "dark") return t("themeDark");
  return t("themeLight");
}

function throttle(fn, delay = 200) {
  let lastRun = 0;
  let timer = null;
  return (...args) => {
    const now = Date.now();
    const run = () => {
      lastRun = Date.now();
      timer = null;
      fn(...args);
    };
    if (now - lastRun >= delay) {
      run();
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(run, delay - (now - lastRun));
  };
}

function slugifyHeading(value, index) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return `reader-heading-${slug || "section"}-${index + 1}`;
}

function collectReaderHeadings(content) {
  return Array.from(content.querySelectorAll(".reader-article h1, .reader-article h2, .reader-article h3"))
    .map((heading, index) => {
      const text = heading.textContent.trim();
      if (!text) return null;
      if (!heading.id) heading.id = slugifyHeading(text, index);
      return {
        id: heading.id,
        text,
        level: heading.tagName.toLowerCase()
      };
    })
    .filter(Boolean)
    .slice(0, 24);
}

function applyReaderPrefs(content, prefs) {
  const readerPrefs = normalizeReaderPrefs(prefs);
  const scroll = content.querySelector(".reader-scroll");
  if (!scroll) return;
  scroll.dataset.readerTheme = readerPrefs.theme;
  scroll.style.setProperty("--reader-font-size", `${readerPrefs.fontSize}px`);
}

function setReaderProgress(content) {
  const scroll = content.querySelector(".reader-scroll");
  const progress = content.querySelector(".reader-progress-fill");
  if (!scroll || !progress) return;
  const maxScroll = Math.max(1, scroll.scrollHeight - scroll.clientHeight);
  const percent = Math.max(0, Math.min(100, (scroll.scrollTop / maxScroll) * 100));
  progress.style.width = `${percent}%`;
}

function restoreReaderScroll(content, top) {
  const scroll = content.querySelector(".reader-scroll");
  if (!scroll) return;
  const nextTop = Math.max(0, Number(top) || 0);
  requestAnimationFrame(() => {
    scroll.scrollTop = nextTop;
    setReaderProgress(content);
  });
}

function appendReaderProgress(content) {
  const progress = document.createElement("div");
  progress.className = "reader-progress";
  progress.setAttribute("aria-hidden", "true");
  const fill = document.createElement("div");
  fill.className = "reader-progress-fill";
  progress.appendChild(fill);
  content.appendChild(progress);
}

function appendReaderToc(content, headings, prefs, onPrefsChange) {
  const toc = document.createElement("nav");
  toc.className = "reader-toc";
  toc.setAttribute("aria-label", t("tocTitle"));
  toc.classList.toggle("collapsed", Boolean(prefs.tocCollapsed));

  const header = document.createElement("button");
  header.className = "reader-toc-header";
  header.type = "button";
  header.textContent = t("tocTitle");
  header.title = t("tocTitle");
  header.onclick = () => {
    const collapsed = !toc.classList.contains("collapsed");
    toc.classList.toggle("collapsed", collapsed);
    if (onPrefsChange) onPrefsChange({ ...prefs, tocCollapsed: collapsed });
  };
  toc.appendChild(header);

  const list = document.createElement("div");
  list.className = "reader-toc-list";
  if (!headings.length) {
    const empty = document.createElement("span");
    empty.className = "reader-toc-empty";
    empty.textContent = t("tocEmpty");
    list.appendChild(empty);
  } else {
    headings.forEach((heading) => {
      const item = document.createElement("button");
      item.className = `reader-toc-item ${heading.level}`;
      item.type = "button";
      item.textContent = heading.text;
      item.title = heading.text;
      item.onclick = () => {
        const scroll = content.querySelector(".reader-scroll");
        const target = content.querySelector(`#${CSS.escape(heading.id)}`);
        if (!scroll || !target) return;
        scroll.scrollTo({
          top: Math.max(0, target.offsetTop - 16),
          behavior: "smooth"
        });
      };
      list.appendChild(item);
    });
  }
  toc.appendChild(list);
  content.appendChild(toc);
}

function enhanceReader(content, options = {}) {
  const {
    prefs,
    restoreScrollTop,
    onScrollPositionChange,
    onReaderPrefsChange
  } = options;
  const scroll = content.querySelector(".reader-scroll");
  if (!scroll) return;
  const readerPrefs = normalizeReaderPrefs(prefs);
  applyReaderPrefs(content, readerPrefs);
  appendReaderProgress(content);
  const headings = collectReaderHeadings(content);
  if (headings.length >= 3) {
    appendReaderToc(content, headings, readerPrefs, onReaderPrefsChange);
  }
  const reportScroll = throttle(() => {
    setReaderProgress(content);
    if (onScrollPositionChange) onScrollPositionChange(scroll.scrollTop);
  }, 200);
  scroll.addEventListener("scroll", reportScroll, { passive: true });
  restoreReaderScroll(content, restoreScrollTop);
}

function appendReaderControls(controls, prefs, onPrefsChange) {
  const readerPrefs = normalizeReaderPrefs(prefs);

  const themeSelect = document.createElement("select");
  themeSelect.className = "reader-theme-select";
  themeSelect.title = t("themeTitle");
  themeSelect.setAttribute("aria-label", t("themeTitle"));
  ["light", "sepia", "dark"].forEach((theme) => {
    const option = document.createElement("option");
    option.value = theme;
    option.textContent = readerThemeLabel(theme);
    themeSelect.appendChild(option);
  });
  themeSelect.value = readerPrefs.theme;
  themeSelect.onchange = () => {
    if (onPrefsChange) onPrefsChange({ ...readerPrefs, theme: themeSelect.value });
  };
  controls.appendChild(themeSelect);

  const fontGroup = document.createElement("span");
  fontGroup.className = "reader-font-controls";
  fontGroup.title = t("fontSizeTitle");

  const smaller = document.createElement("button");
  smaller.className = "mini-button reader-font-button";
  smaller.type = "button";
  smaller.textContent = t("fontSmaller");
  smaller.title = t("fontSizeTitle");
  smaller.disabled = readerPrefs.fontSize <= READER_FONT_MIN;
  smaller.onclick = () => {
    if (onPrefsChange) onPrefsChange({ ...readerPrefs, fontSize: Math.max(READER_FONT_MIN, readerPrefs.fontSize - 1) });
  };
  fontGroup.appendChild(smaller);

  const larger = document.createElement("button");
  larger.className = "mini-button reader-font-button";
  larger.type = "button";
  larger.textContent = t("fontLarger");
  larger.title = t("fontSizeTitle");
  larger.disabled = readerPrefs.fontSize >= READER_FONT_MAX;
  larger.onclick = () => {
    if (onPrefsChange) onPrefsChange({ ...readerPrefs, fontSize: Math.min(READER_FONT_MAX, readerPrefs.fontSize + 1) });
  };
  fontGroup.appendChild(larger);

  controls.appendChild(fontGroup);
}

function normalizePlaybackRate(value) {
  const rate = Number(value);
  return [0.75, 1, 1.25, 1.5, 2].includes(rate) ? rate : 1;
}

function appendVideoBookmarks(content, bookmarks = [], callbacks = {}) {
  const rail = document.createElement("div");
  rail.className = "video-bookmarks";
  rail.setAttribute("aria-label", t("videoBookmarks"));
  const heading = document.createElement("span");
  heading.className = "video-bookmarks-title";
  heading.textContent = t("videoBookmarks");
  rail.appendChild(heading);

  if (!bookmarks.length) {
    const empty = document.createElement("span");
    empty.className = "video-bookmarks-empty";
    empty.textContent = t("noBookmarks");
    rail.appendChild(empty);
  } else {
    bookmarks.forEach((bookmark) => {
      const chip = document.createElement("span");
      chip.className = "video-bookmark-chip";
      chip.dataset.videoBookmarkId = bookmark.id;

      const jump = document.createElement("button");
      jump.className = "video-bookmark-jump";
      jump.type = "button";
      jump.title = t("openBookmarkTitle");
      jump.textContent = `${bookmark.timestamp} · ${bookmark.label}`;
      jump.onclick = () => callbacks.onJump?.(bookmark);
      chip.appendChild(jump);

      const remove = document.createElement("button");
      remove.className = "video-bookmark-delete";
      remove.type = "button";
      remove.title = t("deleteBookmarkTitle");
      remove.setAttribute("aria-label", t("deleteBookmarkTitle"));
      remove.textContent = "×";
      remove.onclick = () => callbacks.onDelete?.(bookmark);
      chip.appendChild(remove);
      rail.appendChild(chip);
    });
  }
  content.appendChild(rail);
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
  const {
    onTimestampChange,
    onOpenExternal,
    onToggleCollapse,
    startTimestamp,
    onQuoteCapture,
    readerPrefs,
    onReaderPrefsChange,
    onReaderScroll,
    videoBookmarks = [],
    playbackRate,
    onPlaybackRateChange,
    onAddVideoBookmark,
    onDeleteVideoBookmark
  } = options;
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
  container.learningCompanionVideo = null;

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
  var seekVideoTo = null;
  var pauseVideo = null;
  var applyPlaybackRate = null;

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

    const speedSelect = document.createElement("select");
    speedSelect.className = "video-speed-select";
    speedSelect.title = t("playbackSpeedTitle");
    speedSelect.setAttribute("aria-label", t("playbackSpeedTitle"));
    [0.75, 1, 1.25, 1.5, 2].forEach((rate) => {
      const option = document.createElement("option");
      option.value = String(rate);
      option.textContent = `${rate}×`;
      speedSelect.appendChild(option);
    });
    speedSelect.value = String(normalizePlaybackRate(playbackRate));
    speedSelect.onchange = () => {
      const nextRate = normalizePlaybackRate(speedSelect.value);
      applyPlaybackRate?.(nextRate);
      onPlaybackRateChange?.(nextRate);
    };
    controls.appendChild(speedSelect);

    const bookmarkButton = document.createElement("button");
    bookmarkButton.className = "mini-button";
    bookmarkButton.type = "button";
    bookmarkButton.dataset.videoBookmarkAction = "add";
    bookmarkButton.title = t("addBookmarkTitle");
    bookmarkButton.textContent = t("addBookmark");
    bookmarkButton.onclick = () => onAddVideoBookmark?.(currentTimeSec);
    controls.appendChild(bookmarkButton);

    seekVideoTo = (seconds) => {
      currentTimeSec = Math.max(0, Math.floor(Number(seconds) || 0));
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
    var seekVideo = (delta) => seekVideoTo(currentTimeSec + delta);
    pauseVideo = () => {
      const iframe = container.querySelector(".viewer-iframe");
      if (!iframe) return;
      try {
        const url = new URL(cleanUrl(sourceUrl));
        if (isYouTubeHost(url.hostname)) {
          youtubePostMessage(iframe, "command", { func: "pauseVideo", args: [] });
          return;
        }
        if (isVimeoHost(url.hostname)) {
          iframe.contentWindow?.postMessage({ method: "pause" }, "https://player.vimeo.com");
        }
      } catch { /* ignore */ }
    };
    applyPlaybackRate = (rate) => {
      const iframe = container.querySelector(".viewer-iframe");
      if (!iframe) return;
      try {
        const url = new URL(cleanUrl(sourceUrl));
        if (isYouTubeHost(url.hostname)) {
          youtubePostMessage(iframe, "command", { func: "setPlaybackRate", args: [rate] });
          return;
        }
        if (isVimeoHost(url.hostname)) {
          iframe.contentWindow?.postMessage({ method: "setPlaybackRate", value: rate }, "https://player.vimeo.com");
        }
      } catch { /* ignore */ }
    };
    container.learningCompanionVideo = {
      pause: pauseVideo,
      seekTo: seekVideoTo
    };
  }

  if (mode === "content") {
    appendReaderControls(controls, readerPrefs, onReaderPrefsChange);
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
    content.classList.add("has-video-bookmarks");
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
      appendVideoBookmarks(content, videoBookmarks, {
        onJump(bookmark) {
          seekVideoTo?.(bookmark.seconds);
        },
        onDelete(bookmark) {
          onDeleteVideoBookmark?.(bookmark);
        }
      });
      const applyInitialPlaybackRate = () => applyPlaybackRate?.(normalizePlaybackRate(playbackRate));
      requestAnimationFrame(applyInitialPlaybackRate);
      iframe.addEventListener("load", () => {
        setTimeout(applyInitialPlaybackRate, 150);
      }, { once: true });

      if (sourceUrl.includes("youtube.com") || sourceUrl.includes("youtu.be")) {
        ensureYouTubeApi();
        let lastTsReport = 0;
        window.addEventListener("message", (e) => {
          if (e.origin !== "https://www.youtube.com") return;
          try {
            const data = JSON.parse(e.data);
            if (data.info?.currentTime) {
              currentTimeSec = Math.floor(data.info.currentTime);
              if (timeDisplay) timeDisplay.textContent = secondsToTimestamp(currentTimeSec);
              // Throttle timestamp reporting to once per 2 seconds
              const now = Date.now();
              if (onTimestampChange && now - lastTsReport > 2000) {
                lastTsReport = now;
                onTimestampChange(currentTimeSec);
              }
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
              if (onQuoteCapture) onQuoteCapture(text, { timestamp: currentTimeSec });
            },
            lang: document.body?.dataset?.uiLanguage,
          });
          enhanceReader(content, {
            prefs: readerPrefs,
            restoreScrollTop: session?.viewerPosition,
            onScrollPositionChange: onReaderScroll,
            onReaderPrefsChange
          });
        } else {
          content.innerHTML = "";
          renderReaderContent(content, {
            html: "",
            url: sourceUrl,
            title: sourceTitle,
            onQuoteCapture: (text) => {
              if (onQuoteCapture) onQuoteCapture(text, { timestamp: currentTimeSec });
            },
            lang: document.body?.dataset?.uiLanguage,
          });
          enhanceReader(content, {
            prefs: readerPrefs,
            restoreScrollTop: session?.viewerPosition,
            onScrollPositionChange: onReaderScroll,
            onReaderPrefsChange
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
            if (onQuoteCapture) onQuoteCapture(text, { timestamp: currentTimeSec });
          },
          lang: document.body?.dataset?.uiLanguage,
        });
        enhanceReader(content, {
          prefs: readerPrefs,
          restoreScrollTop: session?.viewerPosition,
          onScrollPositionChange: onReaderScroll,
          onReaderPrefsChange
        });
      });
  } else {
    appendFallbackCard(content, sourceUrl, sourceTitle);
  }

  container.appendChild(content);
  return container;
}
