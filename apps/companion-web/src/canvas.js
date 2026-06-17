// Handwriting canvas for notes — supports pen, eraser, color, size, high-DPI, mouse + touch.
export function initNotesCanvas(canvasEl, toolbarEl, { onSave, onChange } = {}) {
  const ctx = canvasEl.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  const penBtn = toolbarEl.querySelector(".canvas-pen");
  const eraserBtn = toolbarEl.querySelector(".canvas-eraser");
  const colorInput = toolbarEl.querySelector(".canvas-color");
  const sizeInput = toolbarEl.querySelector(".canvas-size");
  const clearBtn = toolbarEl.querySelector(".canvas-clear");
  const saveBtn = toolbarEl.querySelector(".canvas-save");

  const state = {
    tool: "pen",
    color: "#1a1a1a",
    size: 2,
    drawing: false,
    lastX: 0,
    lastY: 0,
    hasDrawn: false
  };

  let changeTimer = null;
  function scheduleChange() {
    if (!onChange) return;
    if (changeTimer) clearTimeout(changeTimer);
    changeTimer = setTimeout(() => {
      changeTimer = null;
      onChange(canvasEl.toDataURL("image/png"));
    }, 400);
  }

  function resize() {
    const rect = canvasEl.getBoundingClientRect();
    canvasEl.width = Math.max(1, Math.floor(rect.width * dpr));
    canvasEl.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  function applyPen() {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = state.color;
    ctx.lineWidth = state.size;
  }

  function applyEraser() {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.lineWidth = state.size * 4;
  }

  function applyTool() {
    if (state.tool === "eraser") applyEraser(); else applyPen();
  }

  function setTool(tool) {
    state.tool = tool;
    penBtn.classList.toggle("active", tool === "pen");
    eraserBtn.classList.toggle("active", tool === "eraser");
    applyTool();
  }

  function getPos(e) {
    const rect = canvasEl.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function start(e) {
    e.preventDefault();
    state.drawing = true;
    state.hasDrawn = true;
    const { x, y } = getPos(e);
    state.lastX = x;
    state.lastY = y;
    applyTool();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
  }

  function move(e) {
    if (!state.drawing) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    applyTool();
    ctx.beginPath();
    ctx.moveTo(state.lastX, state.lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    state.lastX = x;
    state.lastY = y;
  }

  function end(e) {
    if (!state.drawing) return;
    e && e.preventDefault();
    state.drawing = false;
    scheduleChange();
  }

  // Mouse
  canvasEl.addEventListener("mousedown", start);
  canvasEl.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);

  // Touch
  canvasEl.addEventListener("touchstart", start, { passive: false });
  canvasEl.addEventListener("touchmove", move, { passive: false });
  canvasEl.addEventListener("touchend", end, { passive: false });
  canvasEl.addEventListener("touchcancel", end, { passive: false });

  // Toolbar
  penBtn.addEventListener("click", () => setTool("pen"));
  eraserBtn.addEventListener("click", () => setTool("eraser"));
  colorInput.addEventListener("input", () => {
    state.color = colorInput.value;
    if (state.tool === "pen") applyPen();
  });
  sizeInput.addEventListener("input", () => {
    state.size = parseInt(sizeInput.value, 10) || 2;
    applyTool();
  });
  clearBtn.addEventListener("click", () => {
    clear();
    if (onChange) onChange(null);
  });
  saveBtn.addEventListener("click", () => {
    const dataUrl = canvasEl.toDataURL("image/png");
    if (onSave) onSave(dataUrl);
  });

  function clear() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    ctx.restore();
    state.hasDrawn = false;
  }

  function save() {
    return canvasEl.toDataURL("image/png");
  }

  function setVisible(visible) {
    const wrap = canvasEl.parentElement;
    if (wrap) wrap.hidden = !visible;
    if (visible) {
      requestAnimationFrame(() => {
        resize();
      });
    }
  }

  function loadDataUrl(dataUrl) {
    clear();
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(img, 0, 0, canvasEl.width, canvasEl.height);
      ctx.restore();
      state.hasDrawn = true;
    };
    img.src = dataUrl;
  }

  function isEmpty() {
    return !state.hasDrawn;
  }

  resize();
  window.addEventListener("resize", () => {
    const snapshot = state.hasDrawn ? canvasEl.toDataURL("image/png") : null;
    resize();
    if (snapshot) loadDataUrl(snapshot);
  });

  return { save, clear, setVisible, loadDataUrl, isEmpty };
}
