// Theme toggle + footer year. The site works fully without this file.
(function () {
  var root = document.documentElement;
  var btn = document.querySelector(".theme-toggle");
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function effectiveTheme() {
    var t = root.getAttribute("data-theme");
    if (t === "light" || t === "dark") return t;
    return mq && mq.matches ? "dark" : "light";
  }

  function sync() {
    if (btn) btn.setAttribute("aria-pressed", String(effectiveTheme() === "dark"));
  }

  if (btn) {
    btn.hidden = false;
    sync();
    btn.addEventListener("click", function () {
      var next = effectiveTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      sync();
    });
    if (mq && mq.addEventListener) mq.addEventListener("change", sync);
  }

  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
