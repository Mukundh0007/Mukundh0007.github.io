#!/bin/bash
# Download all-MiniLM-L6-v2 (Apache-2.0; transformers.js export Xenova/all-MiniLM-L6-v2, int8-quantized ONNX)
# at a pinned revision into assets/models/all-MiniLM-L6-v2/ for in-browser semantic search.
set -euo pipefail
cd "$(dirname "$0")/.."
REV=751bff37182d3f1213fa05d7196b954e230abad9
BASE="https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/$REV"
OUT=assets/models/all-MiniLM-L6-v2
mkdir -p "$OUT/onnx"
for f in config.json tokenizer.json tokenizer_config.json onnx/model_quantized.onnx; do
  curl -fsSL "$BASE/$f" -o "$OUT/$f"
done
sha256sum "$OUT"/*.json "$OUT"/onnx/*.onnx
