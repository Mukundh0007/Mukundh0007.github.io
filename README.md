# mukundh0007.github.io

My personal portfolio, live at **https://mukundh0007.github.io**.

The design concept is "detected": the site behaves like a computer-vision model looking at me, with YOLO-style bounding boxes, class labels and confidence scores. It's plain HTML, CSS and a small vanilla-JS file. There's no build step, and GitHub Pages serves the `main` branch as is, so a push goes live in a minute or two.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | All the content: hero, About, case studies, more projects, strengths, timeline, contact |
| `assets/styles.css` | Design tokens (colours for light and dark), layout, detection boxes, animations |
| `assets/js/` | On-demand feature modules (loaded only when used): `detect.js` + `detect-worker.js` for the live detection demo, `terminal.js` for the terminal, `hero3d.js` for the 3D hero, `search.js` for semantic search |
| `assets/depth/` | Depth map of the photo for the 3D hero |
| `assets/models/` | Browser-side model files (`yolox_nano.onnx`, `all-MiniLM-L6-v2/`) and their licences |
| `assets/samples/` | Sample photos for the detection demo |
| `assets/search-index.json` | Precomputed embeddings of the page's sections for semantic search |
| `assets/yolo-saw/` | "What YOLO saw" artifacts (page render, table crop, stored summary in `meta.json`) |
| `assets/main.js` | Theme toggle, confidence count-ups, scroll reveal, diagram drawing, copy-email, the ⌘K / Ctrl+K palette. The page works without it |
| `404.html` | "No page detected" error page, same style |
| `assets/photo.jpg`, `assets/photo-*.webp` | Hero photo (4:5) and its responsive WebP sizes |
| `assets/Mukundh_Jayapal_Resume.pdf` | Resume, linked from the hero and Contact |
| `assets/og-image.png` | 1200×630 preview image for links shared on LinkedIn, Slack and other sites |
| `assets/fonts/` | Self-hosted Google Fonts (latin subset) |
| `assets/favicon.svg` | Browser tab icon |
| `tools/` | One-off scripts that generated committed assets (fonts, photo sizes, …) |
| `.nojekyll` | Tells GitHub Pages to serve the files as is |

## Common edits

**Text.** Everything is in `index.html`. Sections are marked with `<!-- ===== NAME ===== -->` comments.

**Hero detection boxes.** Each box is a `<span class="det" data-label="…" data-conf="…">`. Change `data-label` and `data-conf` to change what the label says. The box on the photo is positioned by `.det-face` in `styles.css` (left/top/width/height as percentages). Adjust it if you swap in a photo with different framing.

**Case studies.** Each is an `<article class="case">` with Problem / Approach / What was hard / Result cells. Cells lead with my own contribution; anything that comes from the paper or the wider team sits in a `<p class="context">` ("Paper context") note below it. The pipeline diagrams are inline SVG, with a wide version for desktop and a tall one for phones. Edit the text inside the `<text>` elements to relabel a step, and add `mine` to a step's `<g class="node">` (in both versions) to highlight it as my part.

**More projects.** Each project is an `<li class="proj">`. Copy one to add a project. The `<span class="det">` inside sets the hover label and score, and `style="--c: var(--c-cyan)"` picks its colour (`green`, `pink`, `cyan`, `orange`, `violet` or `red`).

**Strengths and timeline.** Each strength is an `<li class="strength">` with "Shown in" links to project or timeline anchors. Each timeline entry is an `<li class="tl">`, and its colour/class tag marks it as education, work, research or publication.

**3D point-cloud hero.** On capable desktops (wide screen, fine pointer, 4+ cores, no data-saver, a WebGL2 context that actually starts with hardware acceleration, no reduced motion; the browser console says which check failed, and `?3d` skips the size/hardware/data checks), `assets/js/hero3d.js` loads three.js after the page is idle and, once the 2D detection sequence has played, turns the photo into a point cloud using `assets/depth/photo-depth.png`, with a 3D box locking onto the face. It pauses when the hero is off-screen or the tab is hidden; everywhere else the 2D hero is unchanged. The depth map was made once with Depth Anything V2 Small: `cd tools && npm install && node make-depth.mjs` (on Node ≥ 22.21 behind a proxy, prefix `NODE_USE_ENV_PROXY=1`).

**Live detection demo.** The detector is Megvii's pretrained YOLOX-Nano (COCO), not a model I trained; the site runs it in the browser. `assets/js/detect.js` loads when the section nears the viewport; the YOLOX-Nano model and onnxruntime-web load only after a visitor picks an image or starts the camera. Inference runs in a Web Worker (`detect-worker.js`) on WebGPU when available, otherwise single-threaded WASM (GitHub Pages can't send the COOP/COEP headers WASM threads need). Library versions are pinned once, in the `<script type="importmap">` in `index.html`. `tools/fetch-yolox.sh` re-downloads the model and `tools/export-samples.py` regenerates the sample photos.

**What YOLO saw (Visual RAG case study).** Real artifacts from github.com/Mukundh0007/visual-financial-rag: page 39 of the Apple 10-K the pipeline processed, the two table crops its YOLOv8 detector saved there, and the gpt-4o-mini summary stored in its index. `tools/make-yolo-saw.py <path-to-that-repo>` rebuilds `assets/yolo-saw/`: it renders the page exactly as the pipeline does and recovers each box by locating the saved crop in the render (it refuses to write if the match isn't near-exact). The pipeline didn't save detector confidences, so none are shown.

**Terminal easter egg.** Press <kbd>`</kbd> (or use the footer's Terminal button or the palette) for a small terminal: `help`, `ls projects`, `cat about`, `open <project>`, `resume`, `detect --all`, `clear`, `exit`. It lives in `assets/js/terminal.js`, loads on first use, and reads everything it prints from the page.

**Semantic search (⌘K / Ctrl+K).** Keyword matches appear instantly; after the first typed query (3+ characters), `assets/js/search.js` loads all-MiniLM-L6-v2 (int8, `assets/models/all-MiniLM-L6-v2/`, about 23 MB, plus about 7 MB of ONNX Runtime) via transformers.js and adds semantic matches from `assets/search-index.json`. Choosing one scrolls to that part of the page and outlines it as a "visual citation". It only points to text already on the page. It's skipped with data-saver or on 2G. After editing `index.html`, rebuild the index: `cd tools && npm install && node build-search-index.mjs`. `tools/fetch-minilm.sh` re-downloads the model.

**Command palette.** Any element with a `data-cmd="Label"` attribute shows up in the palette. `data-cmd-group` sets the small tag on the right. Links and buttons are clicked, and anything else is scrolled to.

**Colours and fonts.** Tokens live at the top of `styles.css`: one light block and two identical dark blocks (system preference and manual toggle). Keep the two dark blocks in sync. Fonts are Bricolage Grotesque and JetBrains Mono from Google Fonts, self-hosted for speed (`tools/fetch-fonts.py` re-downloads them).

**Resume or photo.** Replace the file and keep the same name. After changing the photo, run `python3 tools/make-photo-variants.py` to rebuild the WebP sizes.

## Preview locally

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000 (and http://localhost:8000/nope to see the 404 page on GitHub Pages; the local server shows its own).

## Publishing

Commit and push to `main`. GitHub Pages deploys from the `main` branch, root folder (**Settings → Pages**).

## Licences

| Asset | Licence |
| --- | --- |
| Bricolage Grotesque, JetBrains Mono (fonts) | SIL Open Font License 1.1 |
| Feather icons (inline SVG sprite) | MIT |
| YOLOX-Nano model (`assets/models/yolox_nano.onnx`, official ONNX export from Megvii-BaseDetection/YOLOX release 0.1.1rc0) | Apache-2.0 (`assets/models/YOLOX-LICENSE.txt`) |
| onnxruntime-web 1.30.0 (loaded from jsDelivr) | MIT |
| Depth Anything V2 Small (used once to make `assets/depth/photo-depth.png`; onnx-community/depth-anything-v2-small @ 4472b73) | Apache-2.0 (the Base/Large variants are non-commercial and weren't used) |
| three.js 0.186.1 (loaded from jsDelivr) | MIT |
| all-MiniLM-L6-v2 (`assets/models/all-MiniLM-L6-v2/`, transformers.js export Xenova/all-MiniLM-L6-v2 @ 751bff3, int8) | Apache-2.0 |
| transformers.js 4.3.1 (loaded from jsDelivr; also used in `tools/`) | Apache-2.0 |
| linkedom 0.18.13 (`tools/` only) | ISC |
| Sample photos: astronaut Eileen Collins (NASA) | Public domain |
| Sample photos: Chelsea the cat (Stéfan van der Walt), coffee cup (Rachel Michetti) | CC0, via scikit-image |
| `assets/yolo-saw/` page render and table crop | From Apple Inc.'s 2025 Form 10-K (public SEC filing), as processed by visual-financial-rag (my repo; it has no licence file) |
