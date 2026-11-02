// 3D point-cloud hero (three.js). Loaded by main.js only on capable desktops, after the page is
// idle, and never with reduced motion. The 2D hero stays underneath as the fallback: if anything
// here fails, nothing changes on the page.
//
// Depth: assets/depth/photo-depth.png, made once by tools/make-depth.mjs with
// Depth Anything V2 Small (Apache-2.0). Brighter = closer; the wall is dropped.
import * as THREE from "three";

const frame = document.querySelector(".hero .frame");
const hero = document.querySelector(".hero");
const PHOTO = new URL("../photo.jpg", import.meta.url).href;
const DEPTH = new URL("../depth/photo-depth.png", import.meta.url).href;
const FACE = { x: 0.3, y: 0.145, w: 0.475, h: 0.47 }; // same box as .det-face (fractions of the frame)
const W = 640, H = 800, ASPECT = W / H;
const STEP = 4;          // sample every 4th pixel: a 160 × 200 grid
const MAX_POINTS = 30000; // hard cap
const WALL = 90;         // depth values below this are background
const FOV = 22, DIST = 0.5 / Math.tan((FOV / 2) * Math.PI / 180); // frame height = 1 world unit
const SHOW_AT = 3400;    // ms after navigation: let the 2D detection sequence finish first
const ASSEMBLE = 1800;   // ms

async function pixels(url) {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  return ctx.getImageData(0, 0, W, H).data;
}

function buildCloud(rgb, dep) {
  const pos = [], col = [], start = [], seed = [];
  let zMinFace = Infinity, zMaxFace = -Infinity;
  for (let y = 0; y < H; y += STEP) for (let x = 0; x < W; x += STEP) {
    const i = (y * W + x) * 4, z = dep[i];
    if (z < WALL) continue;
    const px = (x / W - 0.5) * ASPECT, py = 0.5 - y / H, pz = (z / 255 - 0.62) * 0.3; // subtle relief
    pos.push(px, py, pz);
    col.push(rgb[i] / 255, rgb[i + 1] / 255, rgb[i + 2] / 255);
    const r = 0.8 + Math.random() * 0.9, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    start.push(r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph));
    seed.push(Math.random());
    const fx = x / W, fy = y / H;
    if (fx > FACE.x && fx < FACE.x + FACE.w && fy > FACE.y && fy < FACE.y + FACE.h) { zMinFace = Math.min(zMinFace, pz); zMaxFace = Math.max(zMaxFace, pz); }
    if (seed.length >= MAX_POINTS) break;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("aStart", new THREE.Float32BufferAttribute(start, 3));
  g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seed, 1));
  return { geometry: g, count: seed.length, zFace: [zMinFace, zMaxFace] };
}

const vertexShader = /* glsl */ `
  uniform float uProgress, uDrift, uSize, uTime;
  attribute vec3 aStart; attribute float aSeed; attribute vec3 color;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    float t = clamp((uProgress - aSeed * 0.35) / 0.65, 0.0, 1.0);
    t = 1.0 - pow(1.0 - t, 3.0);
    vec3 p = mix(aStart, position, t);
    p += normalize(aStart) * uDrift * (0.25 + aSeed * 0.6);      // drift apart on scroll
    p.z += sin(uTime * 1.3 + aSeed * 6.2832) * 0.002 * t;         // faint shimmer
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize / -mv.z;
    vColor = color;
    vAlpha = (0.2 + 0.8 * t) * (1.0 - uDrift * 0.9);
  }`;
const fragmentShader = /* glsl */ `
  varying vec3 vColor; varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5; float d = dot(c, c);
    if (d > 0.25) discard;
    gl_FragColor = vec4(vColor, vAlpha * smoothstep(0.25, 0.1, d));
  }`;

async function main() {
  if (!frame || !hero) return;
  const [rgb, dep] = await Promise.all([pixels(PHOTO), pixels(DEPTH)]);
  const cloud = buildCloud(rgb, dep);

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "low-power" });
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(dpr);
  const canvas = renderer.domElement;
  canvas.className = "hero3d";
  canvas.setAttribute("aria-hidden", "true");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, ASPECT, 0.1, 10);
  camera.position.set(0, 0, DIST);
  const group = new THREE.Group();
  scene.add(group);

  const uniforms = { uProgress: { value: 0 }, uDrift: { value: 0 }, uSize: { value: 1 }, uTime: { value: 0 } };
  const points = new THREE.Points(cloud.geometry, new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false }));
  group.add(points);

  // 3D detection box around the face; depth extent comes from the cloud itself
  const [z0, z1] = cloud.zFace;
  const bw = FACE.w * ASPECT, bh = FACE.h, bd = Math.max(0.04, z1 - z0) + 0.04;
  const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(bw, bh, bd)), new THREE.LineBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0 }));
  box.position.set((FACE.x + FACE.w / 2 - 0.5) * ASPECT, 0.5 - (FACE.y + FACE.h / 2), (z0 + z1) / 2);
  group.add(box);
  const label = document.createElement("span");
  label.className = "hero3d-label";
  label.setAttribute("aria-hidden", "true");
  const faceLabel = frame.querySelector(".det-face");
  label.textContent = faceLabel ? `${faceLabel.dataset.label} ${faceLabel.dataset.end || faceLabel.dataset.conf}` : "ai_engineer";
  const corner = new THREE.Vector3(-bw / 2, bh / 2, bd / 2);

  let cssW = 0, cssH = 0;
  const resize = () => {
    cssW = frame.clientWidth; cssH = frame.clientHeight;
    renderer.setSize(cssW, cssH, false);
    camera.aspect = cssW / cssH; camera.updateProjectionMatrix();
    // ~3.5 CSS px per point at the photo plane, so the 160 × 200 grid reads as a solid face
    uniforms.uSize.value = 3.5 * (cssW / 400) * dpr * DIST;
  };
  resize();
  new ResizeObserver(resize).observe(frame);

  // pointer parallax (gentle) and scroll drift
  let tx = 0, ty = 0, rx = 0, ry = 0;
  window.addEventListener("pointermove", (e) => { ty = (e.clientX / innerWidth - 0.5) * 0.36; tx = (e.clientY / innerHeight - 0.5) * 0.16; }, { passive: true });
  const drift = () => Math.min(1, Math.max(0, scrollY / Math.max(1, hero.offsetHeight * 0.85)));

  // run only while the hero is on screen and the tab is visible
  let visible = true, raf = 0, startAt = 0, frames = 0;
  const tmp = new THREE.Vector3();
  const tick = (now) => {
    raf = 0;
    if (!visible || document.hidden) return;
    if (!startAt) startAt = now;
    const p = Math.min(1, (now - startAt) / ASSEMBLE);
    uniforms.uProgress.value = p;
    uniforms.uTime.value = now / 1000;
    uniforms.uDrift.value = drift();
    rx += (tx - rx) * 0.06; ry += (ty - ry) * 0.06;
    group.rotation.set(rx, ry, 0);
    const lock = Math.min(1, Math.max(0, (p - 0.85) / 0.15)); // box locks on as the face settles
    box.material.opacity = lock * (1 - uniforms.uDrift.value);
    box.scale.setScalar(1 + 0.25 * (1 - lock));
    renderer.render(scene, camera);
    tmp.copy(corner).multiply(box.scale).applyMatrix4(box.matrixWorld).project(camera);
    const lx = Math.min(Math.max(0, (tmp.x + 1) / 2 * cssW - 2), cssW - label.offsetWidth);
    const ly = Math.max(0, (1 - tmp.y) / 2 * cssH - label.offsetHeight);
    label.style.transform = `translate(${lx}px, ${ly}px)`;
    label.style.opacity = String(box.material.opacity);
    frames++;
    frame.__hero3d = { frames, points: cloud.count, progress: p, drift: uniforms.uDrift.value, rotY: ry };
    raf = requestAnimationFrame(tick);
  };
  const wake = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick); };
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; wake(); }).observe(hero);
  document.addEventListener("visibilitychange", wake);

  // Hand over from the 2D photo once the 2D detection sequence has played.
  await new Promise((r) => setTimeout(r, Math.max(0, SHOW_AT - performance.now())));
  frame.append(canvas, label);
  requestAnimationFrame(() => frame.classList.add("is-3d"));
  wake();
}

main().catch((e) => {
  console.warn("[hero3d] staying 2D:", e);
  frame?.querySelectorAll(".hero3d, .hero3d-label").forEach((n) => n.remove());
  frame?.classList.remove("is-3d");
});
