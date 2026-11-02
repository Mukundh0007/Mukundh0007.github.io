// Mukundh Jayapal portfolio: theme toggle, detection count-ups, scroll reveal,
// pipeline drawing, copy-email, the Ctrl/⌘ K command palette and lazy loaders
// for the on-demand features in assets/js/.
// The page works without this file.
(function () {
  var d = document, root = d.documentElement;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, c) { return (c || d).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };

  /* ---------- Theme ---------- */
  var toggle = $(".theme-toggle"), mq = matchMedia("(prefers-color-scheme: dark)");
  var theme = function () { return root.getAttribute("data-theme") || (mq.matches ? "dark" : "light"); };
  var syncTheme = function () { if (toggle) toggle.setAttribute("aria-pressed", String(theme() === "dark")); };
  if (toggle) {
    syncTheme();
    toggle.addEventListener("click", function () {
      var t = theme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", t);
      try { localStorage.setItem("theme", t); } catch (e) {}
      syncTheme();
    });
    if (mq.addEventListener) mq.addEventListener("change", syncTheme);
  }

  /* ---------- Confidence count-up on detection labels ---------- */
  function countUp(el, delay) {
    if (!el) return;
    var end = parseFloat(el.getAttribute("data-end") || el.getAttribute("data-conf"));
    el.setAttribute("data-end", end.toFixed(2));
    if (reduce) return;
    el.setAttribute("data-conf", "0.00");
    setTimeout(function () {
      var t0 = performance.now();
      (function step(now) {
        var p = Math.min(1, (now - t0) / 650);
        el.setAttribute("data-conf", (end * (1 - Math.pow(1 - p, 3))).toFixed(2));
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    }, delay || 0);
  }
  $$(".hero .det").forEach(function (el) {
    countUp(el, (parseFloat(getComputedStyle(el).animationDelay) || 0) * 1000);
  });
  $$(".proj").forEach(function (p) {
    var det = $(".det", p), run = function () { countUp(det, 60); };
    p.addEventListener("mouseenter", run);
    p.addEventListener("focusin", run);
  });

  /* ---------- Scroll reveal + pipeline drawing ---------- */
  // Reveal once an element's top clears the bottom 10% of the screen (works for tall
  // panels too); draw a pipeline once a third of it is visible.
  var watch = function (sel, cls, opts) {
    var els = $$(sel);
    if (reduce || !("IntersectionObserver" in window)) { els.forEach(function (el) { el.classList.add(cls); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add(cls); io.unobserve(e.target); } });
    }, opts);
    els.forEach(function (el) { io.observe(el); });
  };
  watch(".reveal", "is-in", { rootMargin: "0px 0px -10% 0px", threshold: 0 });
  watch(".pipeline", "is-drawn", { threshold: 0.35 });

  /* ---------- Toast + copy email ---------- */
  var toast = $(".toast"), toastTimer;
  function say(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("is-on"); }, 2200);
  }
  var copyBtn = $("[data-copy]");
  if (copyBtn && navigator.clipboard) {
    copyBtn.hidden = false;
    copyBtn.addEventListener("click", function () {
      navigator.clipboard.writeText(copyBtn.getAttribute("data-copy")).then(
        function () { say("Email copied"); },
        function () { say("Couldn't copy. Select the address instead."); }
      );
    });
  }

  /* ---------- Command palette ---------- */
  var mac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
  $$(".kbd-mod").forEach(function (k) { k.textContent = mac ? "⌘" : "Ctrl"; });

  var dlg = $("#cmdk"), input = $("#cmdk-input"), list = $("#cmdk-list"), openBtn = $(".cmdk-btn");
  if (dlg && typeof dlg.showModal === "function") {
    var items = $$("[data-cmd]").map(function (el, i) {
      return { el: el, label: el.getAttribute("data-cmd"), kind: el.getAttribute("data-cmd-group") || "Section", id: "cmdk-o" + i };
    });
    var shown = [], active = 0, jumped = false, lastFocus = null;
    // Semantic search (assets/js/search.js): loads on the first typed query, never on page load.
    var sem = [], semMod = null, semTimer = 0, semReady = false, semPending = false, semStatus = $("#cmdk-sem"), net = navigator.connection || {};
    var semAllowed = !net.saveData && !/2g$/.test(net.effectiveType || "");
    var setSem = function (state, msg) { semReady = state === "ready"; if (semStatus) semStatus.textContent = msg; };

    var mark = function () {
      $$("[role=option]", list).forEach(function (li, i) { li.setAttribute("aria-selected", String(i === active)); });
      var cur = shown[active];
      if (cur) {
        input.setAttribute("aria-activedescendant", cur.id);
        var li = d.getElementById(cur.id);
        if (li) li.scrollIntoView({ block: "nearest" });
      } else {
        input.removeAttribute("aria-activedescendant");
      }
    };

    var render = function () {
      var words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
      shown = items.filter(function (it) {
        var hay = (it.label + " " + it.kind).toLowerCase();
        return words.every(function (w) { return hay.indexOf(w) > -1; });
      });
      sem.forEach(function (r, i) {
        var el = d.querySelector(r.sel);
        if (el && !shown.some(function (it) { return it.el === el; })) {
          shown.push({ el: el, label: r.title, kind: "semantic " + r.score.toFixed(2), snippet: r.snippet, score: r.score, sem: true, id: "cmdk-s" + i });
        }
      });
      active = Math.min(active, Math.max(0, shown.length - 1));
      list.textContent = "";
      shown.forEach(function (it, i) {
        var li = d.createElement("li"), name = d.createElement("span"), kind = d.createElement("span");
        li.id = it.id;
        li.setAttribute("role", "option");
        name.textContent = it.label;
        kind.className = "cmdk-kind";
        kind.textContent = it.kind;
        if (it.sem) {
          li.className = "cmdk-sem-opt" + (i && !shown[i - 1].sem ? " is-first" : "");
          var snip = d.createElement("span");
          snip.className = "cmdk-snippet";
          snip.textContent = it.snippet;
          name.append(snip);
        }
        li.append(name, kind);
        li.addEventListener("click", function () { run(it); });
        li.addEventListener("mousemove", function () { if (active !== i) { active = i; mark(); } });
        list.append(li);
      });
      if (!shown.length) {
        var empty = d.createElement("li");
        empty.className = "cmdk-empty";
        empty.setAttribute("role", "option");
        empty.setAttribute("aria-disabled", "true");
        empty.textContent = semPending ? "No keyword matches. Looking for semantic matches…" : "No matches";
        list.append(empty);
      }
      mark();
    };

    var open = function () {
      lastFocus = d.activeElement;
      input.value = "";
      active = 0;
      sem = [];
      if (!semReady) setSem("idle", semAllowed ? "Keyword matches appear first; type 3+ characters for semantic matches from an on-device model." : "Semantic search is off to save data; keyword search works.");
      render();
      dlg.showModal();
      input.focus();
    };

    var cite = function (el, score) {
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      var b = d.createElement("span");
      b.className = "det det-temp det-cite";
      b.setAttribute("aria-hidden", "true");
      b.dataset.label = "match";
      b.dataset.conf = score.toFixed(2);
      el.append(b);
      setTimeout(function () { b.remove(); }, 4500);
    };

    var run = function (it) {
      var el = it.el;
      jumped = true;
      dlg.close();
      if (it.sem) cite(el, it.score);
      else if (el.matches("a, button")) { el.click(); return; }
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
    };

    var querySem = function () {
      clearTimeout(semTimer);
      var q = input.value.trim();
      semPending = q.length >= 3 && semAllowed;
      if (!semPending) return;
      semTimer = setTimeout(function () {
        (semMod || (semMod = import(new URL("assets/js/search.js", d.baseURI).href)))
          .then(function (m) { return m.load(setSem).then(function () { return m.search(q); }); })
          .then(function (res) {
            if (!dlg.open || input.value.trim() !== q) return; // a newer query replaced this one
            sem = res;
            semPending = false;
            render();
          })
          .catch(function () {
            semPending = false;
            render();
            if (!semStatus) return;
            if (semReady) semStatus.textContent = "Semantic search couldn't run that query; keyword results still work.";
            else if (!/couldn't/.test(semStatus.textContent)) setSem("error", "Semantic search couldn't load; keyword results still work.");
          });
      }, 250);
    };
    input.addEventListener("input", function () { active = 0; sem = []; querySem(); render(); });
    input.addEventListener("keydown", function (e) {
      var n = shown.length;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (n) { active = (active + (e.key === "ArrowDown" ? 1 : n - 1)) % n; mark(); }
      } else if (e.key === "Home" || e.key === "End") {
        if (n) { e.preventDefault(); active = e.key === "Home" ? 0 : n - 1; mark(); }
      } else if (e.key === "Enter" && shown[active]) {
        e.preventDefault();
        run(shown[active]);
      }
    });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", function () {
      if (!jumped && lastFocus && lastFocus.focus) lastFocus.focus();
      jumped = false;
    });
    if (openBtn) openBtn.addEventListener("click", open);
    d.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (dlg.open) dlg.close(); else open();
      }
    });
  }

  /* ---------- What YOLO saw: play once in view, pause off-screen, Replay ---------- */
  $$(".saw").forEach(function (fig) {
    var btn = $(".saw-replay", fig), played = false;
    var play = function () { fig.classList.remove("is-playing"); void fig.offsetWidth; fig.classList.add("is-playing"); played = true; };
    if (reduce || !("IntersectionObserver" in window)) { fig.classList.add("is-playing"); return; }
    new IntersectionObserver(function (es) {
      var on = es[0].isIntersecting;
      fig.classList.toggle("is-paused", !on);
      if (on && !played) play();
    }, { threshold: 0.15 }).observe(fig);
    if (btn) { btn.hidden = false; btn.addEventListener("click", play); }
  });

  /* ---------- On-demand features: load their code only when needed ---------- */
  // Live detection demo: the module (a few KB) loads when the section nears the viewport;
  // the model and ONNX Runtime load only after the visitor starts a detection.
  var demo = $("#demo");
  if (demo) {
    var loadDemo = function () {
      import(new URL("assets/js/detect.js", d.baseURI).href).catch(function () {
        var s = $("#demo-status");
        if (s) s.textContent = "The demo couldn't load. Refresh the page to try again.";
      });
    };
    if ("IntersectionObserver" in window) {
      var dio = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { dio.disconnect(); loadDemo(); }
      }, { rootMargin: "400px 0px" });
      dio.observe(demo);
    } else {
      loadDemo();
    }
  }

  /* ---------- 3D point-cloud hero: capable desktops only, after the page is idle ---------- */
  (function () {
    var frame = $(".hero .frame"), conn = navigator.connection || {};
    if (!frame || reduce || !("WebGL2RenderingContext" in window)) return;
    var capable = matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)").matches &&
      (navigator.hardwareConcurrency || 0) >= 4 && (!navigator.deviceMemory || navigator.deviceMemory >= 4) &&
      !conn.saveData && !/2g$/.test(conn.effectiveType || "");
    if (!capable) return;
    var go = function () { import(new URL("assets/js/hero3d.js", d.baseURI).href).catch(function () { /* stay 2D */ }); };
    var idle = function () { (window.requestIdleCallback || function (f) { setTimeout(f, 1200); })(go, { timeout: 3000 }); };
    if (d.readyState === "complete") idle(); else window.addEventListener("load", idle, { once: true });
  })();

  /* ---------- Terminal easter egg: ` key, footer button or palette ---------- */
  var termMod = null;
  var openTerminal = function () {
    (termMod || (termMod = import(new URL("assets/js/terminal.js", d.baseURI).href)))
      .then(function (m) { m.open(); })
      .catch(function () { termMod = null; say("The terminal couldn't load."); });
  };
  d.addEventListener("keydown", function (e) {
    if (e.key !== "`" || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) || d.querySelector("dialog[open]")) return;
    e.preventDefault();
    openTerminal();
  });
  $$(".term-btn").forEach(function (b) { b.addEventListener("click", openTerminal); });

  /* ---------- Footer year ---------- */
  var year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
