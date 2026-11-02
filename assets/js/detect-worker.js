// YOLOX-Nano inference worker (module worker) for the "Run my model" section.
// Keeps inference off the main thread so the page stays smooth on single-threaded WASM.
// The page passes in the onnxruntime-web URLs it resolved from its importmap, so the
// pinned CDN version is defined in exactly one place (index.html).
// Pre/post-processing mirrors YOLOX's demo/ONNXRuntime/onnx_inference.py:
// BGR input, top-left letterbox padded with 114, no normalisation, grid/stride decode,
// score = objectness × class probability, class-aware NMS (IoU 0.45).

const S = 416;
const COCO = ("person bicycle car motorcycle airplane bus train truck boat traffic_light fire_hydrant stop_sign " +
  "parking_meter bench bird cat dog horse sheep cow elephant bear zebra giraffe backpack umbrella handbag tie " +
  "suitcase frisbee skis snowboard sports_ball kite baseball_bat baseball_glove skateboard surfboard tennis_racket " +
  "bottle wine_glass cup fork knife spoon bowl banana apple sandwich orange broccoli carrot hot_dog pizza donut " +
  "cake chair couch potted_plant bed dining_table toilet tv laptop mouse remote keyboard cell_phone microwave oven " +
  "toaster sink refrigerator book clock vase scissors teddy_bear hair_drier toothbrush").split(" ");

let ort, session, grid, stride, ctx;

function buildGrid() {
  const n = (S / 8) ** 2 + (S / 16) ** 2 + (S / 32) ** 2;
  grid = new Float32Array(n * 2);
  stride = new Float32Array(n);
  let k = 0;
  for (const st of [8, 16, 32]) {
    const g = S / st;
    for (let y = 0; y < g; y++) for (let x = 0; x < g; x++) { grid[2 * k] = x; grid[2 * k + 1] = y; stride[k] = st; k++; }
  }
}

async function createSession(useGPU, urls, model) {
  ort = await import(useGPU ? urls.webgpu : urls.wasm);
  ort.env.wasm.wasmPaths = urls.base;
  ort.env.wasm.numThreads = 1; // GitHub Pages can't send COOP/COEP, so no WASM threads
  return ort.InferenceSession.create(new Uint8Array(model), {
    executionProviders: [useGPU ? "webgpu" : "wasm"],
    graphOptimizationLevel: "all",
  });
}

function iou(a, b) {
  const ix = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const iy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const inter = ix * iy;
  return inter / ((a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter + 1e-9);
}

function decode(o, scale, thr) {
  const C = 85, cand = [];
  for (let i = 0, N = stride.length; i < N; i++) {
    const b = i * C, obj = o[b + 4];
    if (obj < thr) continue;
    let best = 0, cls = 0;
    for (let c = 5; c < C; c++) if (o[b + c] > best) { best = o[b + c]; cls = c - 5; }
    const conf = obj * best;
    if (conf < thr) continue;
    const st = stride[i];
    const cx = (o[b] + grid[2 * i]) * st, cy = (o[b + 1] + grid[2 * i + 1]) * st;
    const w = Math.exp(o[b + 2]) * st, h = Math.exp(o[b + 3]) * st;
    cand.push({ cls, conf, x1: (cx - w / 2) / scale, y1: (cy - h / 2) / scale, x2: (cx + w / 2) / scale, y2: (cy + h / 2) / scale });
  }
  cand.sort((a, b) => b.conf - a.conf);
  const keep = [];
  for (const c of cand) {
    if (keep.length >= 30) break;
    if (keep.every((k) => k.cls !== c.cls || iou(k, c) <= 0.45)) keep.push(c);
  }
  return keep.map((k) => ({ label: COCO[k.cls], conf: k.conf, box: [k.x1, k.y1, k.x2, k.y2] }));
}

self.onmessage = async ({ data }) => {
  if (data.type === "init") {
    try {
      let gpu = false;
      if (data.allowGPU && self.navigator && navigator.gpu) {
        try { gpu = !!(await navigator.gpu.requestAdapter()); } catch (e) { gpu = false; }
      }
      let backend = gpu ? "WebGPU" : "WASM · 1 thread";
      try {
        session = await createSession(gpu, data.urls, data.model);
      } catch (e) {
        if (!gpu) throw e;
        session = await createSession(false, data.urls, data.model); // WebGPU failed: fall back
        backend = "WASM · 1 thread";
      }
      ctx = new OffscreenCanvas(S, S).getContext("2d", { willReadFrequently: true });
      buildGrid();
      self.postMessage({ type: "ready", backend });
    } catch (e) {
      self.postMessage({ type: "error", message: (e && e.message) || String(e) });
    }
    return;
  }
  if (data.type === "frame") {
    const t0 = performance.now();
    try {
      ctx.fillStyle = "rgb(114,114,114)";
      ctx.fillRect(0, 0, S, S);
      ctx.drawImage(data.bitmap, 0, 0);
      data.bitmap.close();
      const px = ctx.getImageData(0, 0, S, S).data, n = S * S, input = new Float32Array(3 * n);
      for (let i = 0; i < n; i++) { input[i] = px[4 * i + 2]; input[n + i] = px[4 * i + 1]; input[2 * n + i] = px[4 * i]; }
      const out = await session.run({ images: new ort.Tensor("float32", input, [1, 3, S, S]) });
      const t = out.output, raw = t.location === "cpu" ? t.data : await t.getData();
      self.postMessage({ type: "result", id: data.id, dets: decode(raw, data.scale, data.thr), ms: performance.now() - t0 });
    } catch (e) {
      self.postMessage({ type: "error", id: data.id, message: (e && e.message) || String(e) });
    }
  }
};
