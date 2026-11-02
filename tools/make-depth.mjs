// Generate the depth map for the 3D point-cloud hero.
//
// Model: Depth Anything V2 Small (Apache-2.0), ONNX export onnx-community/depth-anything-v2-small,
// pinned to a fixed revision. (Only the Small variant is Apache-2.0; Base/Large are non-commercial.)
// Input:  assets/photo.jpg (640×800)
// Output: assets/depth/photo-depth.png (8-bit grayscale, same size; brighter = closer)
//
// Usage:  cd tools && npm install && node make-depth.mjs
//         (behind an HTTPS proxy on Node >= 22.21: NODE_USE_ENV_PROXY=1 node make-depth.mjs)
import { pipeline, RawImage, env } from "@huggingface/transformers";
import sharp from "sharp"; // installed with transformers.js
import { fileURLToPath } from "node:url";
import { mkdirSync, statSync } from "node:fs";

const MODEL = "onnx-community/depth-anything-v2-small";
const REVISION = "4472b7362082ad9968fee890ca0f1e5aca36b93d";
const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));

env.cacheDir = root("tools/.cache");
const estimate = await pipeline("depth-estimation", MODEL, { dtype: "fp32", revision: REVISION });
const image = await RawImage.read(root("assets/photo.jpg"));
const { depth } = await estimate(image);
mkdirSync(root("assets/depth"), { recursive: true });
const out = root("assets/depth/photo-depth.png");
await sharp(Buffer.from(depth.data), { raw: { width: depth.width, height: depth.height, channels: depth.channels } })
  .toColourspace("b-w").png({ compressionLevel: 9 }).toFile(out);
console.log(`depth ${depth.width}×${depth.height}, ${depth.channels} channel(s) → ${out} (${statSync(out).size} bytes)`);
