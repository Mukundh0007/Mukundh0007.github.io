// Terminal easter egg: press ` (backtick) or use the footer button / palette action.
// Loaded on first use. Everything it prints is read from the page itself.

const d = document;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
let dlg, out, input, lastFocus = null, history = [], hIdx = 0, clearTimer = 0;

const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
// Two columns when there's room, otherwise the second column goes on its own indented line.
const cols = (rows, w) => (out.clientWidth >= 560 ? rows.map(([a, b]) => `${a.padEnd(w)} ${b}`) : rows.flatMap(([a, b]) => [a, `    ${b}`]));

function projects() {
  const cases = [...d.querySelectorAll("article.case")].map((a) => ({ el: a, title: text(a.querySelector("h3")), slug: text(a.querySelector(".case-meta .mono")), kind: "case study" }));
  const more = [...d.querySelectorAll("li.proj")].map((li) => ({ el: li, title: text(li.querySelector("h3")), slug: text(li.querySelector(".proj-title .mono")), kind: "project" }));
  return [...cases, ...more];
}

function print(lines, cls) {
  for (const line of [].concat(lines)) {
    const p = d.createElement("p");
    if (cls) p.className = cls;
    p.textContent = line;
    out.append(p);
  }
  out.scrollTop = out.scrollHeight;
}

// Deterministic, decorative score for a box label (same text → same number).
const score = (s) => (0.81 + ([...s].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5381) % 18) / 100).toFixed(2);

function clearDetections() {
  clearTimeout(clearTimer);
  d.querySelectorAll(".det-temp").forEach((n) => n.remove());
  d.documentElement.classList.remove("detect-all");
}

function box(el, label, conf) {
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  const s = d.createElement("span");
  s.className = "det det-temp";
  s.setAttribute("aria-hidden", "true");
  s.dataset.label = label;
  s.dataset.conf = conf;
  el.append(s);
}

function detectAll() {
  clearDetections();
  const groups = [
    ["section", ".section .sec-title"], ["case_study", "article.case"], ["strength", "li.strength"], ["timeline_entry", "li.tl"],
  ];
  const counts = [];
  for (const [label, sel] of groups) {
    const els = [...d.querySelectorAll(sel)];
    els.forEach((el) => box(el, label, score(text(el).slice(0, 40))));
    counts.push(`${label} ×${els.length}`);
  }
  const nProj = d.querySelectorAll("li.proj").length;
  counts.push(`project ×${nProj}`);
  d.documentElement.classList.add("detect-all"); // also reveals every project's own box
  clearTimer = setTimeout(clearDetections, 12000);
  return counts;
}

function flash(el, label) {
  box(el, label, "1.00");
  setTimeout(() => el.querySelectorAll(".det-temp").forEach((n) => n.remove()), 3000);
}

function goTo(el, label) {
  dlg.dataset.jumped = "1"; // focus goes to the project, not back to where it was
  close();
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
  flash(el, label);
}

const COMMANDS = {
  help: () => print(cols([
    ["help", "this list"], ["ls projects", "case studies and projects"], ["cat about", "the About section"],
    ["open <project>", "jump to a project (Tab completes)"], ["resume", "open the resume (PDF)"],
    ["detect --all", "draw detection boxes on the page (--clear removes them)"], ["whoami", "who this site is about"],
    ["clear", "clear the screen"], ["exit", "close (or press Esc)"],
  ], 17)),
  ls: (args) => {
    if (args[0] !== "projects") return print(args.length ? `ls: ${args.join(" ")}: try "ls projects"` : "about  projects  resume", args.length ? "term-err" : "");
    print(cols(projects().map((p) => [p.slug, p.title + (p.kind === "case study" ? "  [case study]" : "")]), 30));
  },
  cat: (args) => {
    if (args[0] !== "about") return print(`cat: ${args.join(" ") || "(nothing)"}: try "cat about"`, "term-err");
    const about = d.querySelector("#about");
    print([text(about.querySelector(".about-lead")), "", ...[...about.querySelectorAll(".about-body p")].map(text)]);
  },
  open: (args) => {
    const q = args.join(" ").toLowerCase();
    if (!q) return print('open: which project? Try "ls projects".', "term-err");
    const all = projects();
    const hits = all.filter((p) => p.slug.toLowerCase() === q || p.title.toLowerCase() === q);
    const fuzzy = hits.length ? hits : all.filter((p) => p.slug.toLowerCase().includes(q) || p.title.toLowerCase().includes(q));
    if (fuzzy.length === 1) { print(`opening ${fuzzy[0].title}…`); setTimeout(() => goTo(fuzzy[0].el, fuzzy[0].kind.replace(" ", "_")), reduce ? 0 : 250); return; }
    print(fuzzy.length ? [`open: "${q}" matches ${fuzzy.length} projects:`, ...fuzzy.map((p) => `  ${p.slug}`)] : `open: no project matches "${q}". Try "ls projects".`, fuzzy.length ? "" : "term-err");
  },
  resume: () => {
    const a = d.querySelector('a[href$=".pdf"]');
    if (!a) return print("resume: not found", "term-err");
    print("opening resume (PDF)…");
    window.open(a.href, "_blank", "noopener");
  },
  detect: (args) => {
    if (args[0] === "--clear") { clearDetections(); return print("cleared."); }
    if (args[0] !== "--all") return print('detect: try "detect --all" or "detect --clear"', "term-err");
    const counts = detectAll();
    print([`detected ${counts.join(", ")}`, "close the terminal to look (boxes clear after 12 s)."]);
  },
  whoami: () => print([text(d.querySelector("#hero-title")).replace(/\s+/g, " "), text(d.querySelector(".tagline"))]),
  clear: () => { out.textContent = ""; },
  exit: () => close(),
};

function run(line) {
  print(`$ ${line}`, "term-cmd");
  const [cmd, ...args] = line.trim().split(/\s+/);
  if (!cmd) return;
  (COMMANDS[cmd.toLowerCase()] || (() => print(`command not found: ${cmd}. Type "help".`, "term-err")))(args);
}

function complete() {
  const v = input.value, m = v.match(/^(\s*open\s+)(\S*)$/i);
  if (m) {
    const opts = projects().map((p) => p.slug).filter((s) => s.toLowerCase().startsWith(m[2].toLowerCase()));
    if (opts.length === 1) input.value = m[1] + opts[0];
    else if (opts.length > 1) print(opts.join("  "));
    return;
  }
  const cmds = Object.keys(COMMANDS).filter((c) => c.startsWith(v.trim()));
  if (cmds.length === 1) input.value = cmds[0] + " ";
}

function build() {
  dlg = d.createElement("dialog");
  dlg.className = "term";
  dlg.setAttribute("aria-labelledby", "term-title");
  dlg.innerHTML = `
    <div class="term-bar"><span class="term-dots" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="term-title" id="term-title">mukundh@portfolio: ~</span>
      <button type="button" class="term-close" aria-label="Close terminal">×</button></div>
    <div class="term-out" role="log" aria-live="polite" tabindex="0" aria-label="Terminal output"></div>
    <form class="term-form"><label for="term-input" class="term-ps">$</label>
      <input id="term-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Command"></form>`;
  d.body.append(dlg);
  out = dlg.querySelector(".term-out");
  input = dlg.querySelector("input");
  dlg.querySelector(".term-close").addEventListener("click", close);
  dlg.querySelector("form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = "";
    if (v.trim()) { history.push(v); hIdx = history.length; }
    run(v);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" && history.length) { e.preventDefault(); hIdx = Math.max(0, hIdx - 1); input.value = history[hIdx]; }
    else if (e.key === "ArrowDown" && history.length) { e.preventDefault(); hIdx = Math.min(history.length, hIdx + 1); input.value = history[hIdx] || ""; }
    else if (e.key === "Tab" && input.value.trim()) { e.preventDefault(); complete(); }
  });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
  dlg.addEventListener("close", () => { if (lastFocus && lastFocus.isConnected && !dlg.dataset.jumped) lastFocus.focus(); delete dlg.dataset.jumped; });
  print(['Welcome. Type "help" for commands, Esc to close.']);
}

export function open() {
  if (!dlg) build();
  if (dlg.open) return;
  lastFocus = d.activeElement;
  dlg.showModal();
  input.focus();
}

export function close() {
  if (dlg && dlg.open) dlg.close();
}
