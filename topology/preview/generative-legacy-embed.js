/**
 * Main-branch generative canvas (generative-legacy.js): ?embed=1 hides chrome;
 * parent preview grid drives transport via postMessage (same contract as generative.js).
 */
(function () {
  "use strict";

  if (new URLSearchParams(location.search).get("embed") !== "1") return;

  var embedStyle = document.createElement("style");
  embedStyle.textContent =
    ".generative-embed .chrome," +
    ".generative-embed .scenario-strip { display: none !important; }" +
    ".generative-embed .flow-tune-toggle," +
    ".generative-embed .flow-tune-modal { display: none !important; }";
  document.head.appendChild(embedStyle);
  document.documentElement.classList.add("generative-embed");

  window.addEventListener("message", function (e) {
    if (e.source !== window.parent) return;
    var d = e.data;
    if (!d || d.type !== "generative-contact") return;
    if (d.action === "click" && d.id) {
      var el = document.getElementById(d.id);
      if (el) el.click();
      return;
    }
    if (d.action === "scenario" && d.routeId) {
      var rid = String(d.routeId);
      var esc =
        typeof CSS !== "undefined" && CSS.escape
          ? CSS.escape(rid)
          : rid.replace(/"/g, '\\"');
      var btn = document.querySelector('.scenario-btn[data-route-id="' + esc + '"]');
      if (btn) btn.click();
    }
  });
})();
