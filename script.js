/* Halo — small progressive enhancements. The page works fine without any of it. */
(function () {
  "use strict";

  /* ── sticky nav gets a hairline once you scroll ─────────────────────── */
  var nav = document.getElementById("nav");
  var onScroll = function () {
    nav.classList.toggle("scrolled", window.scrollY > 8);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ── fade sections in as they arrive ─────────────────────────────────── */
  var targets = document.querySelectorAll(
    ".section .h2, .sub, .steps li, .card, .split-media, .split-text, .logos, .quote, .getbox, .band-text"
  );

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry, i) {
          if (!entry.isIntersecting) return;
          setTimeout(function () {
            entry.target.classList.add("in");
          }, Math.min(i * 60, 240));
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 }
    );
    targets.forEach(function (el) {
      el.classList.add("reveal");
      observer.observe(el);
    });
  }

  /* ── keep the QR caption in step with site.config.js ─────────────────── */
  var caption = document.getElementById("qr-url");
  var url = typeof SITE_URL === "string" ? SITE_URL : "";

  if (caption && url) {
    caption.textContent = url.replace(/^https?:\/\//, "").replace(/\/$/, "");

    // A loud nudge while you're testing locally — never shows to a visitor
    // on the real site, so a placeholder QR can't quietly reach a presentation.
    var local = ["localhost", "127.0.0.1", ""].indexOf(location.hostname) !== -1;
    if (local && /example\.com/.test(url)) {
      var warn = document.createElement("p");
      warn.className = "small";
      warn.style.cssText = "color:#FFC24B;margin-top:12px;max-width:40ch";
      warn.textContent =
        "Heads up (only visible on localhost): the QR code still points at the " +
        "placeholder URL. Run  node tools/make-qr.mjs \"https://your-real-url/\"  before the presentation.";
      caption.parentNode.appendChild(warn);
    }
  }
})();
