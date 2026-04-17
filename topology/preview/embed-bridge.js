/**
 * Ellipsoid previews (andromeda / reticulum): ?embed=1 hides chrome; parent drives via postMessage.
 * Supports: click, setRange, setChecked, setRadio (same IDs as the standalone page modals).
 */
(function () {
  "use strict";
  if (new URLSearchParams(location.search).get("embed") !== "1") return;
  document.body.classList.add("embed-contact");
  const style = document.createElement("style");
  style.textContent =
    ".embed-contact .chrome{display:none!important}.embed-contact .viewport-stage{pointer-events:auto}";
  document.head.appendChild(style);

  function dispatchInput(el) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function dispatchChange(el) {
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  window.addEventListener("message", e => {
    if (e.source !== window.parent) return;
    const d = e.data || {};
    if (d.type !== "ellipsoid-contact") return;

    if (d.action === "click" && d.id) {
      document.getElementById(d.id)?.click();
      return;
    }
    if (d.action === "setRange" && d.id != null) {
      const el = document.getElementById(d.id);
      if (el && "value" in el) {
        el.value = String(d.value);
        dispatchInput(el);
      }
      return;
    }
    if (d.action === "setChecked" && d.id != null) {
      const el = document.getElementById(d.id);
      if (el && el.type === "checkbox") {
        el.checked = !!d.checked;
        dispatchChange(el);
      }
      return;
    }
    if (d.action === "setRadio" && d.id) {
      const el = document.getElementById(d.id);
      if (el && el.type === "radio") {
        el.checked = true;
        dispatchChange(el);
        dispatchInput(el);
      }
    }
  });
})();
