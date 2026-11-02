// "Run my model": UI for the in-browser YOLOX-Nano demo.
// Loaded by main.js when the section comes near the viewport. Nothing heavy loads until
// the visitor picks an image or starts the camera; then the model (assets/models) and
// onnxruntime-web (pinned in the page's importmap) are fetched and run in a worker.

const S = 416, THR = 0.35, MAX_FPS = 15;
const MODEL_URL = new URL("../models/yolox_nano.onnx", import.meta.url).href;
const PALETTE = ["#39ff14", "#ff5ccf", "#36d1ff", "#ff9a3c", "#b197ff", "#ffe14d"];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (s) => document.querySelector(s);
const section = $("#demo"), view = $("#demo-view"), statusEl = $("#demo-status");
const backendEl = $("#demo-backend"), fpsEl = $("#demo-fps"), resultsEl = $("#demo-results");
const fileInput = $("#demo-file"), camBtn = $("#demo-cam"), stopBtn = $("#demo-stop"), pickBtn = $("#demo-pick");
const sampleBtns = [...document.querySelectorAll("#demo [data-sample]")];

let worker = null, ready = null, media = null, overlay = null, octx = null;
let lastDets = [], lastSize = [1, 1], frameId = 0, stream = null, running = false, timer = 0, fps = 0;
const pending = new Map();

const setStatus = (msg) => { statusEl.textContent = msg; };
const colorFor = (label) => PALETTE[[...label].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PALETTE.length];

// ---------- runtime + model (on first use only) ----------
function importmapURL(spec) {
  const map = JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports;
  return new URL(map[spec], document.baseURI).href;
}

async function fetchModel() {
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`model download failed (${res.status})`);
  const total = +res.headers.get("content-length") || 3659407;
  if (!res.body || !res.body.getReader) return res.arrayBuffer();
  const reader = res.body.getReader(), chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    setStatus(`Downloading model… ${(got / 1e6).toFixed(1)} / ${(total / 1e6).toFixed(1)} MB`);
  }
  const buf = new Uint8Array(got);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  return buf.buffer;
}

function ensureModel() {
  if (ready) return ready;
  ready = (async () => {
    setStatus("Downloading model…");
    const model = await fetchModel();
    setStatus("Starting ONNX Runtime (first run downloads its WebAssembly, a few MB)…");
    const wasm = importmapURL("onnxruntime-web/wasm");
    const urls = { wasm, webgpu: importmapURL("onnxruntime-web/webgpu"), base: wasm.slice(0, wasm.lastIndexOf("/") + 1) };
    worker = new Worker(new URL("detect-worker.js", import.meta.url), { type: "module" });
    const backend = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("runtime took too long to start")), 90000);
      worker.onerror = (e) => { clearTimeout(t); reject(new Error(e.message || "worker failed to start")); };
      worker.onmessage = ({ data }) => {
        if (data.type === "ready") { clearTimeout(t); resolve(data.backend); }
        else if (data.type === "error" && data.id === undefined) { clearTimeout(t); reject(new Error(data.message)); }
      };
      worker.postMessage({ type: "init", model, urls, allowGPU: true }, [model]);
    });
    worker.onmessage = ({ data }) => {
      const p = pending.get(data.id);
      if (!p) return;
      pending.delete(data.id);
      if (data.type === "result") p.resolve(data); else p.reject(new Error(data.message));
    };
    backendEl.textContent = `backend: ${backend}`;
    return true;
  })().catch((e) => {
    ready = null; // let the next click retry
    if (worker) { worker.terminate(); worker = null; }
    throw e;
  });
  return ready;
}

async function infer(source, w, h) {
  const r = Math.min(S / w, S / h);
  const bitmap = await createImageBitmap(source, { resizeWidth: Math.max(1, Math.round(w * r)), resizeHeight: Math.max(1, Math.round(h * r)), resizeQuality: "medium" });
  const id = ++frameId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ type: "frame", id, bitmap, scale: r, thr: THR }, [bitmap]);
  });
}

// ---------- drawing (site detection style: box, corner brackets, label tab) ----------
function ensureOverlay() {
  if (!overlay) {
    overlay = document.createElement("canvas");
    overlay.className = "demo-overlay";
    overlay.setAttribute("aria-hidden", "true");
    view.append(overlay);
    octx = overlay.getContext("2d");
    new ResizeObserver(() => draw(lastDets, lastSize[0], lastSize[1], 1)).observe(view);
  }
}

function draw(dets, natW, natH, t) {
  if (!overlay) return;
  const dpr = Math.min(devicePixelRatio || 1, 2), W = view.clientWidth, H = view.clientHeight;
  if (overlay.width !== Math.round(W * dpr) || overlay.height !== Math.round(H * dpr)) {
    overlay.width = Math.round(W * dpr); overlay.height = Math.round(H * dpr);
  }
  const c = octx;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);
  const s = Math.min(W / natW, H / natH), ox = (W - natW * s) / 2, oy = (H - natH * s) / 2;
  const grow = 1 + 0.08 * (1 - t); // snap-in when t animates 0 → 1
  c.font = '700 12px "JetBrains Mono", ui-monospace, monospace';
  c.textBaseline = "top";
  for (const d of dets) {
    const col = colorFor(d.label);
    let [x1, y1, x2, y2] = d.box;
    x1 = Math.max(0, x1); y1 = Math.max(0, y1); x2 = Math.min(natW, x2); y2 = Math.min(natH, y2);
    const cx = ox + ((x1 + x2) / 2) * s, cy = oy + ((y1 + y2) / 2) * s;
    const bw = (x2 - x1) * s * grow, bh = (y2 - y1) * s * grow, bx = cx - bw / 2, by = cy - bh / 2;
    c.globalAlpha = Math.min(1, 0.25 + t);
    c.strokeStyle = col; c.lineWidth = 2;
    c.strokeRect(bx, by, bw, bh);
    const L = Math.min(14, bw / 3, bh / 3); // corner brackets
    c.lineWidth = 4;
    c.beginPath();
    for (const [px, py, dx, dy] of [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]]) {
      c.moveTo(px, py + dy * L); c.lineTo(px, py); c.lineTo(px + dx * L, py);
    }
    c.stroke();
    const text = `${d.label} ${d.conf.toFixed(2)}`, tw = c.measureText(text).width + 12, th = 18;
    let lx = Math.min(Math.max(0, bx - 1), W - tw), ly = by - th >= 0 ? by - th : by; // keep the label inside the frame
    c.fillStyle = col; c.fillRect(lx, ly, tw, th);
    c.fillStyle = "#0a0b0d"; c.fillText(text, lx + 6, ly + 3);
  }
  c.globalAlpha = 1;
}

function show(dets, natW, natH) {
  lastDets = dets; lastSize = [natW, natH];
  if (reduce) return draw(dets, natW, natH, 1);
  const t0 = performance.now();
  (function step(now) {
    const t = Math.min(1, (now - t0) / 220);
    draw(dets, natW, natH, 1 - Math.pow(1 - t, 3));
    if (t < 1) requestAnimationFrame(step);
  })(t0);
}

function listResults(dets) {
  resultsEl.textContent = "";
  for (const d of dets) {
    const li = document.createElement("li");
    li.textContent = `${d.label} ${d.conf.toFixed(2)}`;
    li.style.setProperty("--c", colorFor(d.label));
    resultsEl.append(li);
  }
}

function setMedia(el) {
  if (media) {
    if (media.src && media.src.startsWith("blob:")) URL.revokeObjectURL(media.src);
    media.remove();
  }
  media = el;
  media.classList.add("demo-media");
  view.querySelector(".demo-empty")?.remove();
  view.prepend(media);
  ensureOverlay();
  lastDets = [];
  draw([], 1, 1, 1);
}

// ---------- still images ----------
async function runImage(src, alt) {
  stopCamera(false);
  const img = new Image();
  img.alt = alt || "Image being analysed";
  img.decoding = "async";
  img.src = src;
  try { await img.decode(); } catch (e) { setStatus("That file couldn't be read as an image."); return; }
  setMedia(img);
  try {
    await ensureModel();
    setStatus("Detecting…");
    const res = await infer(img, img.naturalWidth, img.naturalHeight);
    if (media !== img) return; // another image replaced this one
    show(res.dets, img.naturalWidth, img.naturalHeight);
    listResults(res.dets);
    fpsEl.textContent = `${Math.round(res.ms)} ms`;
    setStatus(res.dets.length ? `Found ${res.dets.length} object${res.dets.length > 1 ? "s" : ""}: ${res.dets.map((d) => `${d.label} ${d.conf.toFixed(2)}`).join(", ")}.` : "No objects found above 0.35 confidence.");
  } catch (e) {
    setStatus(`The model couldn't run: ${e.message}. Check your connection and try again.`);
  }
}

// ---------- camera ----------
async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setStatus("This browser can't open a camera here. Try a sample or your own image."); return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  } catch (e) {
    const name = e && e.name;
    setStatus(
      name === "NotAllowedError" || name === "SecurityError" ? "Camera permission was denied. You can still try a sample or your own image."
        : name === "NotFoundError" || name === "OverconstrainedError" ? "No camera found. Try a sample or your own image."
          : "The camera couldn't start (it may be in use by another app). Try a sample or your own image."
    );
    return;
  }
  const video = document.createElement("video");
  video.muted = true; video.playsInline = true; video.autoplay = true;
  video.setAttribute("aria-label", "Your camera feed");
  video.srcObject = stream;
  setMedia(video);
  try { await video.play(); } catch (e) { /* autoplay with muted video is allowed */ }
  camBtn.disabled = true; stopBtn.disabled = false;
  try { await ensureModel(); } catch (e) { setStatus(`The model couldn't run: ${e.message}.`); stopCamera(false); return; }
  if (!stream) return; // stopped while loading
  running = true;
  setStatus("Camera running. Detection happens on this device.");
  loop();
}

async function loop() {
  if (!running) return;
  const t0 = performance.now(), video = media;
  try {
    if (video.readyState >= 2 && video.videoWidth) {
      const res = await infer(video, video.videoWidth, video.videoHeight);
      if (!running) return;
      lastDets = res.dets; lastSize = [video.videoWidth, video.videoHeight];
      draw(res.dets, video.videoWidth, video.videoHeight, 1);
      const inst = 1000 / Math.max(1, performance.now() - t0);
      fps = fps ? fps * 0.8 + inst * 0.2 : inst;
      fpsEl.textContent = `${fps.toFixed(1)} fps · ${Math.round(res.ms)} ms`;
      listResults(res.dets);
    }
  } catch (e) {
    setStatus(`Detection stopped: ${e.message}`);
    stopCamera(false);
    return;
  }
  timer = setTimeout(() => requestAnimationFrame(loop), Math.max(0, 1000 / MAX_FPS - (performance.now() - t0)));
}

function stopCamera(announce = true, why = "") {
  const wasOn = !!stream;
  running = false;
  clearTimeout(timer);
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  camBtn.disabled = false; stopBtn.disabled = true;
  fps = 0;
  if (wasOn && announce) {
    if (media && media.tagName === "VIDEO") { lastDets = []; draw([], 1, 1, 1); }
    setStatus(why || "Camera stopped.");
  }
}

// ---------- wiring ----------
function init() {
  const ok = typeof Worker === "function" && typeof OffscreenCanvas === "function" && "createImageBitmap" in window && "ResizeObserver" in window;
  if (!ok) { setStatus("This browser doesn't support the in-browser demo. Try a recent Chrome, Edge, Firefox or Safari."); return; }
  for (const b of sampleBtns) b.addEventListener("click", () => runImage(b.dataset.sample, b.dataset.alt));
  pickBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    if (f) runImage(URL.createObjectURL(f), "Your image");
    fileInput.value = "";
  });
  view.addEventListener("dragover", (e) => { e.preventDefault(); view.classList.add("is-drag"); });
  view.addEventListener("dragleave", () => view.classList.remove("is-drag"));
  view.addEventListener("drop", (e) => {
    e.preventDefault();
    view.classList.remove("is-drag");
    const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith("image/"));
    if (f) runImage(URL.createObjectURL(f), "Your image"); else setStatus("Drop an image file (JPEG, PNG, WebP…).");
  });
  camBtn.addEventListener("click", startCamera);
  stopBtn.addEventListener("click", () => stopCamera(true));
  new IntersectionObserver((es) => {
    if (!es[0].isIntersecting && running) stopCamera(true, "Camera stopped because the demo scrolled out of view.");
  }).observe(section);
  document.addEventListener("visibilitychange", () => { if (document.hidden && running) stopCamera(true, "Camera stopped because the tab was hidden."); });
  for (const el of [...sampleBtns, pickBtn, camBtn]) el.disabled = false;
  section.dataset.ready = "true";
}

init();
