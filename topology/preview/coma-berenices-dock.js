/**
 * Coma Berenices grid dock: strand transport, scenarios, flow tune, ellipsoid controls.
 * Definitions live in shared-modal-registry.js (PulseModalRegistry).
 */
(function () {
  "use strict";

  var R = window.PulseModalRegistry;
  if (!R) {
    console.error("Load shared-modal-registry.js before coma-berenices-dock.js");
    return;
  }

  var FLOW_TUNE_KEY = R.FLOW_TUNE_KEY;
  var GENERATIVE_PIPE_KEY = R.GENERATIVE_PIPE_KEY;
  var DOTGRID_KEY = "topology.pulse.canvasDotGrid.v1";
  var DOTGRID_DEFAULT = { waves: false, spacing: "square", contrast: 28 };
  var DEFAULT_FLOW = R.DEFAULT_FLOW_TUNE;
  var TUNE_FIELDS = R.STRAND_CONTACT_SLIDERS;
  var ELLIPSOID = R.ELLIPSOID_CONTROL_SECTIONS;

  var ifrStrand = Array.from(
    document.querySelectorAll(
      'iframe[src*="orion.html"], iframe[src*="eridanus.html"], iframe[src*="perseus.html"]',
    ),
  );
  var ifrEllipsoid = Array.from(
    document.querySelectorAll('iframe[src*="andromeda.html"], iframe[src*="reticulum.html"]'),
  );

  function postStrand(msg) {
    ifrStrand.forEach(function (f) {
      try {
        f.contentWindow.postMessage(msg, "*");
      } catch (_) {}
    });
  }

  function postEllipsoid(payload) {
    var target = payload.target || "both";
    var msg = {};
    for (var k in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, k) && k !== "target") msg[k] = payload[k];
    }
    ifrEllipsoid.forEach(function (f) {
      var isFabric = f.src.indexOf("reticulum.html") !== -1;
      var isGradient = f.src.indexOf("andromeda.html") !== -1 && !isFabric;
      if (target === "gradient" && !isGradient) return;
      if (target === "fabric" && !isFabric) return;
      try {
        f.contentWindow.postMessage(msg, "*");
      } catch (_) {}
    });
  }

  function getTune() {
    var x = {};
    try {
      x = JSON.parse(localStorage.getItem(FLOW_TUNE_KEY) || "{}");
    } catch (_) {
      x = {};
    }
    var out = {};
    for (var d in DEFAULT_FLOW) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_FLOW, d)) out[d] = DEFAULT_FLOW[d];
    }
    for (var k in x) {
      if (Object.prototype.hasOwnProperty.call(x, k)) out[k] = x[k];
    }
    return out;
  }

  function setTune(next) {
    var merged = getTune();
    for (var k in next) {
      if (Object.prototype.hasOwnProperty.call(next, k)) merged[k] = next[k];
    }
    localStorage.setItem(FLOW_TUNE_KEY, JSON.stringify(merged));
  }

  function getDotGridState() {
    var x = {};
    try {
      x = JSON.parse(localStorage.getItem(DOTGRID_KEY) || "{}");
    } catch (_) {
      x = {};
    }
    return {
      waves: !!x.waves,
      spacing: x.spacing === "triangular" ? "triangular" : DOTGRID_DEFAULT.spacing,
      contrast: Number.isFinite(Number(x.contrast))
        ? Math.max(0, Math.min(100, Number(x.contrast)))
        : DOTGRID_DEFAULT.contrast,
    };
  }

  function setDotGridState(next) {
    var cur = getDotGridState();
    var merged = {
      waves: next.waves != null ? !!next.waves : cur.waves,
      spacing: next.spacing === "triangular" ? "triangular" : (next.spacing === "square" ? "square" : cur.spacing),
      contrast: next.contrast != null
        ? Math.max(0, Math.min(100, Number(next.contrast)))
        : cur.contrast,
    };
    localStorage.setItem(DOTGRID_KEY, JSON.stringify(merged));
  }

  function refreshDockChrome() {
    var t = getTune();
    document.getElementById("dock-spin").classList.toggle("is-active", t.autoSpin !== false);
    document.getElementById("dock-labels").classList.toggle("is-active", !!t.showNodeLabels);
  }

  function shortLabel(s, max) {
    var t = String(s || "").trim();
    if (!t) return "";
    if (t.length <= max) return t;
    return t.slice(0, max - 1) + "\u2026";
  }

  function rebuildScenarios() {
    var host = document.getElementById("scenario-buttons");
    host.innerHTML = "";
    var routes = [];
    try {
      var raw = localStorage.getItem(GENERATIVE_PIPE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        routes = Array.isArray(data.routes) ? data.routes : [];
      }
    } catch (_) {}
    routes.forEach(function (route, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "scenario-btn";
      btn.textContent = i + 1 + ". " + shortLabel(route.label || route.id, 22);
      btn.addEventListener("click", function () {
        postStrand({
          type: "generative-contact",
          action: "scenario",
          routeId: route.id,
        });
      });
      host.appendChild(btn);
    });
  }

  function buildTuneGrid() {
    var grid = document.getElementById("tune-grid");
    TUNE_FIELDS.forEach(function (def) {
      var lab = document.createElement("label");
      lab.className = "dock-field";
      var span = document.createElement("span");
      span.textContent = def.label;
      var row = document.createElement("div");
      row.className = "row";
      var input = document.createElement("input");
      input.type = "range";
      input.min = String(def.min);
      input.max = String(def.max);
      input.step = String(def.step);
      input.dataset.key = def.key;
      var val = document.createElement("span");
      val.className = "val";
      val.id = "val-" + def.key;
      row.appendChild(input);
      row.appendChild(val);
      lab.appendChild(span);
      lab.appendChild(row);
      grid.appendChild(lab);

      function updateVal() {
        val.textContent = Number(input.value).toFixed(def.step >= 1 ? 0 : 2);
      }
      input.addEventListener("input", function () {
        updateVal();
        var o = {};
        o[def.key] = Number(input.value);
        setTune(o);
        refreshDockChrome();
      });
      updateVal();
    });
  }

  function syncTuneInputsFromStorage() {
    var t = getTune();
    document.querySelectorAll("#tune-grid input[type=range]").forEach(function (el) {
      var k = el.dataset.key;
      if (!k || typeof t[k] !== "number") return;
      el.value = String(t[k]);
      var val = document.getElementById("val-" + k);
      var def = TUNE_FIELDS.find(function (f) {
        return f.key === k;
      });
      if (val) val.textContent = Number(el.value).toFixed(def && def.step >= 1 ? 0 : 2);
    });
  }

  function resetFlowTuneDefaults() {
    var o = {};
    for (var k in DEFAULT_FLOW) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_FLOW, k)) o[k] = DEFAULT_FLOW[k];
    }
    localStorage.setItem(FLOW_TUNE_KEY, JSON.stringify(o));
    syncTuneInputsFromStorage();
    refreshDockChrome();
  }

  function buildEllipsoidControls() {
    var root = document.getElementById("ellipsoid-controls");
    ELLIPSOID.forEach(function (sec) {
      var block = document.createElement("details");
      block.className = "dock-block dock-block--sub";
      if (sec.title === "Background (canvas)") block.open = true;

      var summary = document.createElement("summary");
      summary.textContent = sec.title;
      block.appendChild(summary);

      var grid = document.createElement("div");
      grid.className = "ellipsoid-grid";
      grid.style.marginTop = "10px";

      sec.fields.forEach(function (field) {
        if (field.t === "radioBtns") {
          var wrap = document.createElement("div");
          wrap.className = "dock-field";
          var lab = document.createElement("span");
          lab.textContent = field.label;
          wrap.appendChild(lab);
          var row = document.createElement("div");
          row.className = "btn-row";
          field.buttons.forEach(function (b) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "btn--small";
            btn.textContent = b.text;
            btn.addEventListener("click", function () {
              postEllipsoid({
                type: "ellipsoid-contact",
                action: "click",
                id: b.id,
              });
            });
            row.appendChild(btn);
          });
          wrap.appendChild(row);
          grid.appendChild(wrap);
          return;
        }
        if (field.t === "button") {
          var wrapB = document.createElement("div");
          wrapB.className = "dock-field";
          var spanB = document.createElement("span");
          spanB.textContent = field.label;
          wrapB.appendChild(spanB);
          var btnB = document.createElement("button");
          btnB.type = "button";
          btnB.className = "btn--small";
          btnB.textContent = field.text || field.label;
          btnB.addEventListener("click", function () {
            postEllipsoid({
              type: "ellipsoid-contact",
              action: "click",
              id: field.id,
              target: field.target || "both",
            });
          });
          wrapB.appendChild(btnB);
          grid.appendChild(wrapB);
          return;
        }
        if (field.t === "checkbox") {
          var labC = document.createElement("label");
          labC.className = "dock-field";
          var rowC = document.createElement("div");
          rowC.className = "row";
          rowC.style.gap = "10px";
          var inputC = document.createElement("input");
          inputC.type = "checkbox";
          inputC.checked = !!field.c;
          var spanC = document.createElement("span");
          if (field.target === "gradient") {
            spanC.appendChild(document.createTextNode(field.label + " "));
            var tagG = document.createElement("span");
            tagG.className = "tag";
            tagG.textContent = "gradient";
            spanC.appendChild(tagG);
          } else if (field.target === "fabric") {
            spanC.appendChild(document.createTextNode(field.label + " "));
            var tagF = document.createElement("span");
            tagF.className = "tag";
            tagF.textContent = "fabric";
            spanC.appendChild(tagF);
          } else {
            spanC.textContent = field.label;
          }
          inputC.addEventListener("change", function () {
            postEllipsoid({
              type: "ellipsoid-contact",
              action: "setChecked",
              id: field.id,
              checked: inputC.checked,
              target: field.target || "both",
            });
          });
          rowC.appendChild(inputC);
          rowC.appendChild(spanC);
          labC.appendChild(rowC);
          grid.appendChild(labC);
          return;
        }
        if (field.t === "range") {
          var labR = document.createElement("label");
          labR.className = "dock-field";
          var spanR = document.createElement("span");
          if (field.target === "fabric") {
            spanR.appendChild(document.createTextNode(field.label + " "));
            var tagR = document.createElement("span");
            tagR.className = "tag";
            tagR.textContent = "fabric";
            spanR.appendChild(tagR);
          } else {
            spanR.textContent = field.label;
          }
          var rowR = document.createElement("div");
          rowR.className = "row";
          var inputR = document.createElement("input");
          inputR.type = "range";
          inputR.min = String(field.min);
          inputR.max = String(field.max);
          inputR.step = String(field.step);
          inputR.value = String(field.v);
          var valR = document.createElement("span");
          valR.className = "val";
          valR.textContent = inputR.value;
          inputR.addEventListener("input", function () {
            valR.textContent = inputR.value;
            postEllipsoid({
              type: "ellipsoid-contact",
              action: "setRange",
              id: field.id,
              value: Number(inputR.value),
              target: field.target || "both",
            });
          });
          rowR.appendChild(inputR);
          rowR.appendChild(valR);
          labR.appendChild(spanR);
          labR.appendChild(rowR);
          grid.appendChild(labR);
        }
      });
      block.appendChild(grid);
      root.appendChild(block);
    });
  }

  function buildDotGridMasterControls() {
    var root = document.getElementById("dotgrid-master-grid");
    if (!root) return;
    root.innerHTML = "";

    var waves = document.createElement("label");
    waves.className = "dock-field";
    var wavesRow = document.createElement("div");
    wavesRow.className = "row";
    wavesRow.style.gap = "10px";
    var wavesInput = document.createElement("input");
    wavesInput.type = "checkbox";
    wavesInput.id = "dotgrid-master-waves";
    var wavesText = document.createElement("span");
    wavesText.textContent = "Waves";
    wavesRow.appendChild(wavesInput);
    wavesRow.appendChild(wavesText);
    waves.appendChild(wavesRow);
    root.appendChild(waves);

    var spacing = document.createElement("label");
    spacing.className = "dock-field";
    var spacingTitle = document.createElement("span");
    spacingTitle.textContent = "Spacing";
    spacing.appendChild(spacingTitle);
    var spacingRow = document.createElement("div");
    spacingRow.className = "row";
    spacingRow.style.gap = "12px";
    var spacingSquare = document.createElement("label");
    spacingSquare.className = "row";
    spacingSquare.style.gap = "6px";
    var spacingSquareInput = document.createElement("input");
    spacingSquareInput.type = "radio";
    spacingSquareInput.name = "dotgrid-master-spacing";
    spacingSquareInput.value = "square";
    var spacingSquareText = document.createElement("span");
    spacingSquareText.textContent = "Square";
    spacingSquare.appendChild(spacingSquareInput);
    spacingSquare.appendChild(spacingSquareText);
    var spacingTri = document.createElement("label");
    spacingTri.className = "row";
    spacingTri.style.gap = "6px";
    var spacingTriInput = document.createElement("input");
    spacingTriInput.type = "radio";
    spacingTriInput.name = "dotgrid-master-spacing";
    spacingTriInput.value = "triangular";
    var spacingTriText = document.createElement("span");
    spacingTriText.textContent = "Triangular";
    spacingTri.appendChild(spacingTriInput);
    spacingTri.appendChild(spacingTriText);
    spacingRow.appendChild(spacingSquare);
    spacingRow.appendChild(spacingTri);
    spacing.appendChild(spacingRow);
    root.appendChild(spacing);

    var contrast = document.createElement("label");
    contrast.className = "dock-field";
    var contrastTitle = document.createElement("span");
    contrastTitle.textContent = "Contrast";
    var contrastRow = document.createElement("div");
    contrastRow.className = "row";
    var contrastInput = document.createElement("input");
    contrastInput.type = "range";
    contrastInput.min = "0";
    contrastInput.max = "100";
    contrastInput.step = "1";
    contrastInput.id = "dotgrid-master-contrast";
    var contrastVal = document.createElement("span");
    contrastVal.className = "val";
    contrastVal.id = "dotgrid-master-contrast-val";
    contrastRow.appendChild(contrastInput);
    contrastRow.appendChild(contrastVal);
    contrast.appendChild(contrastTitle);
    contrast.appendChild(contrastRow);
    root.appendChild(contrast);

    function syncUi() {
      var s = getDotGridState();
      wavesInput.checked = !!s.waves;
      spacingSquareInput.checked = s.spacing === "square";
      spacingTriInput.checked = s.spacing === "triangular";
      contrastInput.value = String(s.contrast);
      contrastVal.textContent = String(Math.round(s.contrast));
    }
    function applyUi() {
      setDotGridState({
        waves: wavesInput.checked,
        spacing: spacingTriInput.checked ? "triangular" : "square",
        contrast: Number(contrastInput.value),
      });
      syncUi();
    }
    wavesInput.addEventListener("change", applyUi);
    spacingSquareInput.addEventListener("change", applyUi);
    spacingTriInput.addEventListener("change", applyUi);
    contrastInput.addEventListener("input", applyUi);
    syncUi();
  }

  document.getElementById("dock-spin").addEventListener("click", function () {
    var t = getTune();
    setTune({ autoSpin: !t.autoSpin });
    refreshDockChrome();
  });
  document.getElementById("dock-labels").addEventListener("click", function () {
    var t = getTune();
    setTune({ showNodeLabels: !t.showNodeLabels });
    refreshDockChrome();
  });
  document.getElementById("dock-sync").addEventListener("click", function () {
    postStrand({ type: "generative-contact", action: "click", id: "btn-sync" });
  });
  document.getElementById("dock-regen").addEventListener("click", function () {
    postStrand({ type: "generative-contact", action: "click", id: "btn-regen" });
  });
  document.getElementById("dock-ellipsoid-reset").addEventListener("click", function () {
    postEllipsoid({ type: "ellipsoid-contact", action: "click", id: "btn-reset" });
  });
  document.getElementById("btn-flow-reset").addEventListener("click", resetFlowTuneDefaults);

  window.addEventListener("storage", function (e) {
    if (e.key === GENERATIVE_PIPE_KEY) rebuildScenarios();
    if (e.key === FLOW_TUNE_KEY) {
      syncTuneInputsFromStorage();
      refreshDockChrome();
    }
    if (e.key === DOTGRID_KEY) {
      var contrastVal = document.getElementById("dotgrid-master-contrast-val");
      var waves = document.getElementById("dotgrid-master-waves");
      var contrast = document.getElementById("dotgrid-master-contrast");
      var spacingSquare = document.querySelector('input[name="dotgrid-master-spacing"][value="square"]');
      var spacingTri = document.querySelector('input[name="dotgrid-master-spacing"][value="triangular"]');
      var s = getDotGridState();
      if (waves) waves.checked = !!s.waves;
      if (spacingSquare) spacingSquare.checked = s.spacing === "square";
      if (spacingTri) spacingTri.checked = s.spacing === "triangular";
      if (contrast) contrast.value = String(s.contrast);
      if (contrastVal) contrastVal.textContent = String(Math.round(s.contrast));
    }
  });

  buildTuneGrid();
  buildDotGridMasterControls();
  buildEllipsoidControls();
  syncTuneInputsFromStorage();
  refreshDockChrome();
  rebuildScenarios();
})();
