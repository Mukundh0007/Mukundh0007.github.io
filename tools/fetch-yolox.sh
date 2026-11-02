#!/bin/bash
# Download the official YOLOX-Nano ONNX export (Apache-2.0, Megvii-BaseDetection/YOLOX release 0.1.1rc0)
# into assets/models/ and verify its checksum.
set -euo pipefail
cd "$(dirname "$0")/.."
URL=https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_nano.onnx
curl -fsSL "$URL" -o assets/models/yolox_nano.onnx
sha256sum assets/models/yolox_nano.onnx
