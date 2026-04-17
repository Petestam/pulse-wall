/**
 * Faint dot grid (spacing = viewport width / 64) for Pulse canvases.
 * State:
 * - preview grid embeds (?sharedDotGrid=1): shared key
 * - full views (default): per-page key for individual tuning
 */
(function (global) {
  "use strict";

  var BASE_KEY = "topology.pulse.canvasDotGrid.v1";
  function pageId() {
    try {
      var fromBody = document.body && document.body.getAttribute("data-pulse-page");
      if (fromBody) return String(fromBody);
      var p = String((location && location.pathname) || "");
      var tail = p.split("/").pop() || "page";
      return tail.replace(/\.html$/i, "") || "page";
    } catch (_) {
      return "page";
    }
  }
  function resolveStorageKey() {
    try {
      var q = new URLSearchParams((location && location.search) || "");
      if (q.get("sharedDotGrid") === "1") return BASE_KEY;
    } catch (_) {}
    return BASE_KEY + "::" + pageId();
  }
  var KEY = resolveStorageKey();
  var DEFAULT = { waves: false, spacing: "square", contrast: 28 };

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return Object.assign({}, DEFAULT);
      var o = JSON.parse(raw);
      return {
        waves: !!o.waves,
        spacing: o.spacing === "triangular" ? "triangular" : "square",
        contrast: clamp(Number(o.contrast) || DEFAULT.contrast, 0, 100),
      };
    } catch (_) {
      return Object.assign({}, DEFAULT);
    }
  }

  function saveState(s) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (_) {}
  }

  var state = loadState();
  var listeners = [];

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i]();
      } catch (_) {}
    }
    try {
      global.dispatchEvent(new CustomEvent("pulse-dotgrid-change"));
    } catch (_) {}
  }

  function setState(partial) {
    if (partial.waves != null) state.waves = !!partial.waves;
    if (partial.spacing != null) {
      state.spacing = partial.spacing === "triangular" ? "triangular" : "square";
    }
    if (partial.contrast != null) state.contrast = clamp(Number(partial.contrast), 0, 100);
    saveState(state);
    notify();
  }

  function reloadFromStorage() {
    state = loadState();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w - backing store width
   * @param {number} h - backing store height
   * @param {number} tSec
   * @param {HTMLCanvasElement | null} canvasEl
   */
  function draw(ctx, w, h, tSec, canvasEl) {
    var vw = global.innerWidth || w;
    var stepVw = vw / 64;
    var cw = 1;
    if (canvasEl && typeof canvasEl.getBoundingClientRect === "function") {
      cw = canvasEl.getBoundingClientRect().width || 1;
    }
    var step = stepVw * (w / cw);
    step = Math.max(2.5, step);

    var c = state.contrast / 100;
    var baseA = 0.005 + c * 0.095;
    var waveAmp = state.waves ? 1.4 + c * 3.2 : 0;
    var tri = state.spacing === "triangular";
    var dy = tri ? step * (Math.sqrt(3) / 2) : step;

    /*
     * Match the visual footprint of Eridanus wave particles
     * (generative.js uses ~0.42–0.80px line widths, avg ~0.61).
     */
    var r = 0.61;

    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    var j0 = Math.floor(-step / dy) - 2;
    var j1 = Math.ceil(h / dy) + 2;
    var i0 = Math.floor(-step / step) - 2;
    var i1 = Math.ceil(w / step) + 2;

    for (var j = j0; j <= j1; j++) {
      var y0 = j * dy;
      var xOff = tri && (j & 1) ? step * 0.5 : 0;
      for (var i = i0; i <= i1; i++) {
        var x = i * step + xOff;
        var y = y0;
        var dx = 0;
        var dyw = 0;
        if (waveAmp > 0) {
          dx =
            Math.sin(tSec * 1.1 + x * 0.042 + y * 0.031) * waveAmp +
            Math.sin(tSec * 0.73 - x * 0.019 + y * 0.027) * 0.45;
          dyw =
            Math.cos(tSec * 0.95 - x * 0.038 + y * 0.041) * waveAmp +
            Math.sin(tSec * 0.61 + x * 0.025 - y * 0.022) * 0.45;
        }
        var px = x + dx;
        var py = y + dyw;
        if (px < -4 || py < -4 || px > w + 4 || py > h + 4) continue;

        var a = baseA;
        if (state.waves) {
          a *= 0.85 + 0.15 * Math.sin(tSec * 2.5 + x * 0.05 + y * 0.048);
        }
        a = clamp(a, 0, 0.22);
        ctx.fillStyle = "rgba(168, 218, 255, " + a.toFixed(4) + ")";
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function wireDetails(root, onChange) {
    if (!root) return;
    var waves = /** @type {HTMLInputElement | null} */ (root.querySelector("#dotgrid-waves"));
    var spacing = root.querySelectorAll('input[name="dotgrid-spacing"]');
    var contrast = /** @type {HTMLInputElement | null} */ (root.querySelector("#dotgrid-contrast"));
    var valEl = root.querySelector("#dotgrid-contrast-val");

    function syncFromState() {
      if (waves) waves.checked = state.waves;
      spacing.forEach(function (el) {
        if (el instanceof HTMLInputElement && el.value === state.spacing) {
          el.checked = true;
        }
      });
      if (contrast) contrast.value = String(state.contrast);
      if (valEl) valEl.textContent = String(state.contrast);
    }

    function apply() {
      var sp = "square";
      spacing.forEach(function (el) {
        if (el instanceof HTMLInputElement && el.checked) sp = el.value;
      });
      setState({
        waves: waves ? waves.checked : false,
        spacing: sp,
        contrast: contrast ? Number(contrast.value) : state.contrast,
      });
      if (valEl) valEl.textContent = String(state.contrast);
      if (typeof onChange === "function") onChange();
    }

    syncFromState();
    if (waves) waves.addEventListener("change", apply);
    spacing.forEach(function (el) {
      el.addEventListener("change", apply);
    });
    if (contrast) contrast.addEventListener("input", apply);

    global.addEventListener("pulse-dotgrid-change", syncFromState);
  }

  function mountFlowTuneModal(modal, onChange) {
    if (!modal) return;
    var details = document.createElement("details");
    details.className = "flow-tune-dotgrid";
    details.innerHTML =
      '<summary class="flow-tune-dotgrid__summary">Dot grid · vw/64</summary>' +
      '<div class="flow-tune-dotgrid__body">' +
      '<label class="flow-tune-dotgrid__check"><input type="checkbox" id="dotgrid-waves" /> Waves</label>' +
      '<div class="flow-tune-dotgrid__spacing">' +
      '<span class="flow-tune-dotgrid__label">Spacing</span>' +
      '<label><input type="radio" name="dotgrid-spacing" value="square" checked /> Square</label>' +
      '<label><input type="radio" name="dotgrid-spacing" value="triangular" /> Triangular</label>' +
      "</div>" +
      '<div class="flow-tune-row flow-tune-dotgrid__row">' +
      "<label>Contrast <span id=\"dotgrid-contrast-val\"></span></label>" +
      '<input id="dotgrid-contrast" type="range" min="0" max="100" step="1" />' +
      "</div>" +
      "</div>";
    modal.appendChild(details);
    wireDetails(details, onChange);
  }

  function mountChromeDetails(root, onChange) {
    wireDetails(root, onChange);
  }

  global.addEventListener("storage", function (e) {
    if (e.key === KEY && e.newValue) {
      reloadFromStorage();
      notify();
    }
  });

  global.PulseCanvasDotGrid = {
    draw: draw,
    getState: function () {
      return Object.assign({}, state);
    },
    setState: setState,
    reloadFromStorage: reloadFromStorage,
    mountFlowTuneModal: mountFlowTuneModal,
    mountChromeDetails: mountChromeDetails,
    addListener: function (fn) {
      listeners.push(fn);
      return function () {
        var i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
    STORAGE_KEY: KEY,
  };
})(typeof window !== "undefined" ? window : this);
