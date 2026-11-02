// Semantic search for the ⌘K palette: all-MiniLM-L6-v2 (Apache-2.0) runs on this device via
// transformers.js (pinned in the page's importmap). Loaded the first time someone types a query.
// The index (assets/search-index.json) was built from this page by tools/build-search-index.mjs
// with the same model files, so query and index embeddings come from the same model.
// It only finds and points to text already on the page; it never generates answers.

const INDEX_URL = new URL("../search-index.json", import.meta.url).href;
// A site-relative path, not a full URL: transformers.js 4.x skips its local file check (and so
// never loads the tokenizer) when localModelPath is an http(s) URL.
const MODELS_PATH = new URL("../models/", import.meta.url).pathname;
let ready = null, index = null, vecs = null, embed = null;

export function load(onStatus) {
  if (ready) return ready;
  ready = (async () => {
    onStatus("loading", "Loading the on-device search model (about 30 MB, first time only)…");
    const [{ pipeline, env }, idx] = await Promise.all([
      import("@huggingface/transformers"),
      fetch(INDEX_URL).then((r) => { if (!r.ok) throw new Error(`index ${r.status}`); return r.json(); }),
    ]);
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = MODELS_PATH;
    embed = await pipeline("feature-extraction", "all-MiniLM-L6-v2", { dtype: "q8", device: "wasm" });
    index = idx;
    vecs = idx.chunks.map((c) => Int8Array.from(atob(c.v), (ch) => (ch.charCodeAt(0) << 24) >> 24));
    onStatus("ready", "Semantic search is on: all-MiniLM-L6-v2, running on this device.");
  })().catch((e) => {
    ready = null; // a later query can retry
    console.warn("[semantic search]", e);
    onStatus("error", "Semantic search couldn't load; keyword results still work.");
    throw e;
  });
  return ready;
}

// Top matches by cosine similarity (vectors are normalised; the index is int8 × 127).
export async function search(query, k = 5, min = 0.25) {
  const e = (await embed(query, { pooling: "mean", normalize: true })).data;
  return vecs
    .map((v, i) => {
      let s = 0;
      for (let j = 0; j < v.length; j++) s += v[j] * e[j];
      return { ...index.chunks[i], score: s / 127 };
    })
    .filter((r) => r.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
