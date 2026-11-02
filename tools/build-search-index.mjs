// Build assets/search-index.json for semantic search in the ⌘K palette.
//
// Chunks come straight from index.html (sections, case-study cells, projects, strengths,
// timeline entries), so the index only ever contains text that is already on the site.
// Each chunk is embedded with the same model files and library the browser uses:
// all-MiniLM-L6-v2 (Apache-2.0), int8-quantized ONNX in assets/models/all-MiniLM-L6-v2
// (tools/fetch-minilm.sh), via transformers.js 4.3.1, mean pooling + L2 normalisation.
// Vectors are stored as int8 (×127) in base64.
//
// Usage:  cd tools && npm install && node build-search-index.mjs     (rerun after editing index.html)
import { pipeline, env } from "@huggingface/transformers";
import { parseHTML } from "linkedom";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const { document } = parseHTML(readFileSync(root("index.html"), "utf8"));
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
// Text with spaces between elements (textContent would glue "Problem" + "Financial…" and tag lists together).
const text = (el) => !el ? "" : [...el.childNodes].map((n) => (n.nodeType === 3 ? n.textContent : n.nodeName === "WBR" ? "\u0000" : text(n))).join(" ").replace(/ ?\u0000 ?/g, "")
  .replace(/\s+/g, " ").replace(/\s+([.,;:!?)])/g, "$1").trim();

const chunks = [];
const add = (sel, kind, title, body) => chunks.push({ sel, kind, title, body: body.replace(/\s+/g, " ").trim() });

add("#top", "Intro", "Mukundh Jayapal", [$(".status"), $(".tagline"), $(".hero-meta")].map(text).join(" "));
add("#about", "About", "About", [$("#about .about-lead"), ...$$("#about .about-body p:not(.focus)")].map(text).join(" "));
add("#about .focus", "About", "What I'm looking for", text($("#about .focus")));
for (const a of $$("article.case")) {
  const title = text($("h3", a));
  add(`#${a.id}`, "Case study", title, [text($(".case-lede", a)), text($(".tags", a))].join(" "));
  $$(".case-grid > .cell", a).forEach((cell, i) => add(`#${a.id} .case-grid > .cell:nth-child(${i + 1})`, "Case study", `${title}: ${text($("h4", cell))}`, $$("p", cell).map(text).join(" ")));
}
add(".saw", "Case study", "What YOLO saw", [$(".saw-head p"), ...$$(".saw-cap"), $(".saw-credit")].map(text).join(" "));
add("#demo", "Section", "Live detection demo", [$("#demo .sec-sub"), $("#demo .demo-privacy"), $("#demo .demo-credits")].map(text).join(" "));
for (const li of $$("li.proj")) add(`#${li.id}`, "Project", text($("h3", li)), [text($(".proj-title .mono", li)), text($(".proj-desc", li)), text($(".tags", li))].join(" "));
$$("li.strength").forEach((li, i) => add(`.strengths > li:nth-child(${i + 1})`, "Strength", text($("h3", li)), [text($(".s-main p", li)), text($(".proof-links", li)), text($(".s-tools", li))].join(" ")));
$$("li.tl").forEach((li, i) => add(li.id ? `#${li.id}` : `.timeline > li:nth-child(${i + 1})`, "Experience", text($("h3", li)), [text($(".tl-date", li)), text($(".tl-class", li)), text($(".tl-org", li)), ...$$(".tl-body p:not(.tl-org)", li).map(text)].join(" ")));
add("#contact", "Section", "Contact", text($("#contact .contact")));

env.localModelPath = root("assets/models/");
env.allowRemoteModels = false;
const embed = await pipeline("feature-extraction", "all-MiniLM-L6-v2", { dtype: "q8" });
const out = await embed(chunks.map((c) => `${c.kind}: ${c.title}. ${c.body}`), { pooling: "mean", normalize: true });
const dims = out.dims[1], data = out.data;

const index = {
  model: "Xenova/all-MiniLM-L6-v2@751bff3 (int8 ONNX), mean pooling, normalized",
  library: "@huggingface/transformers 4.3.1",
  dims,
  chunks: chunks.map((c, i) => {
    const q = Int8Array.from(data.slice(i * dims, (i + 1) * dims), (v) => Math.max(-127, Math.min(127, Math.round(v * 127))));
    return { sel: c.sel, kind: c.kind, title: c.title, snippet: c.body.length > 140 ? c.body.slice(0, 137).replace(/\s+\S*$/, "") + "…" : c.body, v: Buffer.from(q.buffer).toString("base64") };
  }),
};
for (const c of index.chunks) if (!document.querySelector(c.sel)) throw new Error(`selector matches nothing: ${c.sel}`);
writeFileSync(root("assets/search-index.json"), JSON.stringify(index));
console.log(`${index.chunks.length} chunks × ${dims} dims → assets/search-index.json (${readFileSync(root("assets/search-index.json")).length} bytes)`);
