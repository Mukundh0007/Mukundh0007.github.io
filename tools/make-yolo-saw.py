"""Build the "What YOLO saw" assets for the Visual RAG case study from real project artifacts.

Everything comes from github.com/Mukundh0007/visual-financial-rag:
  data/apple_10k.pdf                       Apple Inc. Form 10-K (public SEC filing) the pipeline processed
  data/processed_tables/p39_table_21.png   the table crop the pipeline's YOLOv8 detector saved
  storage/docstore.json                    the VLM summary the pipeline stored for that crop
                                           (src/rag/ingest.py: openai/gpt-4o-mini via OpenRouter)

The pipeline (src/vision/vision_processor.py) renders pages with fitz.Matrix(2, 2) and saves exact
integer crops, but it doesn't save box coordinates or confidences. This script renders the same page
the same way and recovers the box by locating the crop in the render (normalised cross-correlation).
It refuses to write anything if the match isn't near-exact. No confidence score is invented.

Usage:
  python3 tools/make-yolo-saw.py /path/to/visual-financial-rag-checkout
Needs: pymupdf, scikit-image, numpy, Pillow.
Writes: assets/yolo-saw/page-39(-400).webp, p39_table_21.png (copied unchanged) plus WebP display
        renditions of it, and assets/yolo-saw/meta.json
"""
import json
import pathlib
import shutil
import sys

import numpy as np
import pymupdf
from PIL import Image
from skimage.feature import match_template

PAGE, CROP = 39, "p39_table_21.png"     # the table followed through crop -> summary
OTHER_CROPS = ["p39_table_22.png"]       # other detections the pipeline saved on the same page
OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "yolo-saw"


def main(repo):
    repo = pathlib.Path(repo)
    doc = pymupdf.open(repo / "data" / "apple_10k.pdf")
    pix = doc[PAGE - 1].get_pixmap(matrix=pymupdf.Matrix(2, 2))  # same render as the pipeline
    page = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    g = lambda im: np.asarray(im.convert("L"), dtype=np.float32) / 255.0
    gp = g(page)

    def locate(name):
        crop = Image.open(repo / "data" / "processed_tables" / name).convert("RGB")
        corr = match_template(gp, g(crop))
        y, x = np.unravel_index(np.argmax(corr), corr.shape)
        score = float(corr[y, x])
        if score < 0.97:
            sys.exit(f"{name} not found reliably in page {PAGE} (best match {score:.3f}); refusing to write")
        w, h = crop.size
        px = [int(x), int(y), int(x + w), int(y + h)]
        pct = [round(100 * x / page.width, 2), round(100 * y / page.height, 2), round(100 * w / page.width, 2), round(100 * h / page.height, 2)]
        return {"crop": name, "box_px": px, "box_pct": pct, "match_score": round(score, 4)}

    focus = locate(CROP)
    others = [locate(n) for n in OTHER_CROPS]

    store = json.loads((repo / "storage" / "docstore.json").read_text())["docstore/data"]
    summary = next(v["__data__"]["text"] for v in store.values()
                   if v["__data__"].get("metadata", {}).get("file_name") == CROP)

    OUT.mkdir(parents=True, exist_ok=True)
    view = page.resize((680, round(680 * page.height / page.width)), Image.LANCZOS)
    view.save(OUT / "page-39.webp", "WEBP", quality=82, method=6)
    view.resize((400, round(400 * page.height / page.width)), Image.LANCZOS).save(OUT / "page-39-400.webp", "WEBP", quality=82, method=6)
    shutil.copyfile(repo / "data" / "processed_tables" / CROP, OUT / CROP)  # the exact crop, unchanged (linked)
    crop_im = Image.open(OUT / CROP).convert("RGB")
    for w in (572, 1144):  # display renditions of the same crop
        crop_im.resize((w, round(w * crop_im.height / crop_im.width)), Image.LANCZOS).save(OUT / f"{pathlib.Path(CROP).stem}-{w}.webp", "WEBP", quality=88, method=6)
    meta = {
        "source": "github.com/Mukundh0007/visual-financial-rag",
        "page": PAGE, "page_render_px": [page.width, page.height],
        "focus": focus, "other_detections": others,
        "summary_model": "openai/gpt-4o-mini via OpenRouter (src/rag/ingest.py)",
        "summary": summary,
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=1))
    print(json.dumps({k: v for k, v in meta.items() if k != "summary"}, indent=1))
    for f in sorted(OUT.iterdir()):
        print(f.name, f.stat().st_size, "bytes")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
