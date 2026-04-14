/**
 * Shared modal / control definitions for strand (generative + contact sheet) and ellipsoid (contact sheet).
 * Single source of truth: generative.js builds “Tune Flow” from STRAND_FLOW_MODAL_ROWS;
 * contact-sheet dock uses STRAND_CONTACT_SLIDERS + ELLIPSOID_CONTROL_SECTIONS.
 */
(function (global) {
  "use strict";

  var FLOW_TUNE_KEY = "topology.generative.flow.tune.v1";
  var GENERATIVE_PIPE_KEY = "topology.generative.pipe.v1";

  var DEFAULT_FLOW_TUNE = {
    arcJitter: 0.45,
    arcInconsistency: 0.52,
    strandSpread: 1.35,
    strandInstances: 1.45,
    orbSpeed: 7.0,
    orbGlowDistance: 6.0,
    bendFillet: 8.0,
    bendQuantity: 2.0,
    fieldHighwayStrands: 8,
    tweenQty: 4,
    tweenJitter: 10,
    tweenOffset: 10,
    depth: 1.0,
    perspective: 0.9,
    autoSpin: true,
    spinSpeed: 0.35,
    showNodeLabels: false,
    yaw: 0,
    pitch: 0,
  };

  /**
   * Rows for the generative “Tune Flow” modal (classic vs field filter via classic/field flags).
   * flowKey: key on flowTune | sceneKey: key on scene3d
   */
  var STRAND_FLOW_MODAL_ROWS = [
    { inputId: "flow-jitter", valId: "flow-val-jitter", flowKey: "arcJitter", min: 0, max: 20, step: 0.01, labelClassic: "Arc jitter", labelField: "Arc jitter", classic: true, field: true, format: "fixed2" },
    { inputId: "flow-inconsistency", valId: "flow-val-inconsistency", flowKey: "arcInconsistency", min: 0, max: 20, step: 0.01, labelClassic: "Arc inconsistency", labelField: "Arc inconsistency", classic: true, field: true, format: "fixed2" },
    { inputId: "flow-spread", valId: "flow-val-spread", flowKey: "strandSpread", min: 0, max: 20, step: 0.01, labelClassic: "Strand spread", labelField: "Particle waves", classic: true, field: true, format: "fixed2" },
    { inputId: "flow-instances", valId: "flow-val-instances", flowKey: "strandInstances", min: 0, max: 20, step: 0.01, labelClassic: "Strand instances", labelField: "", classic: true, field: false, format: "fixed2" },
    { inputId: "flow-field-strands", valId: "flow-val-field-strands", flowKey: "fieldHighwayStrands", min: 1, max: 8, step: 1, labelClassic: "", labelField: "Highway strand count", classic: false, field: true, format: "int" },
    { inputId: "flow-tween-qty", valId: "flow-val-tween-qty", flowKey: "tweenQty", min: 0, max: 20, step: 0.01, labelClassic: "", labelField: "Tween qty", classic: false, field: true, format: "tweenGap" },
    { inputId: "flow-tween-jitter", valId: "flow-val-tween-jitter", flowKey: "tweenJitter", min: 0, max: 20, step: 0.01, labelClassic: "", labelField: "Tween jitter", classic: false, field: true, format: "fixed2" },
    { inputId: "flow-tween-offset", valId: "flow-val-tween-offset", flowKey: "tweenOffset", min: 0, max: 20, step: 0.01, labelClassic: "", labelField: "Tween offset", classic: false, field: true, format: "fixed2" },
    { inputId: "flow-depth", valId: "flow-val-depth", sceneKey: "depth", min: 0, max: 20, step: 0.01, labelClassic: "3D depth", labelField: "3D depth", classic: true, field: true, format: "fixed2" },
    { inputId: "flow-perspective", valId: "flow-val-perspective", sceneKey: "perspective", min: 0, max: 20, step: 0.01, labelClassic: "Perspective", labelField: "Perspective", classic: true, field: true, format: "fixed2" },
    { inputId: "flow-spinspeed", valId: "flow-val-spinspeed", sceneKey: "spinSpeed", min: 0, max: 20, step: 0.01, labelClassic: "Spin speed", labelField: "Spin speed", classic: true, field: true, format: "spinRps" },
    { inputId: "flow-orbspeed", valId: "flow-val-orbspeed", flowKey: "orbSpeed", min: 0, max: 20, step: 0.01, labelClassic: "Orb speed", labelField: "Orb speed", classic: true, field: true, format: "orbSec" },
    { inputId: "flow-orbglow", valId: "flow-val-orbglow", flowKey: "orbGlowDistance", min: 0, max: 20, step: 0.01, labelClassic: "Orb glow distance", labelField: "Orb glow distance", classic: true, field: true, format: "fixed2" },
    { inputId: "flow-bendfillet", valId: "flow-val-bendfillet", flowKey: "bendFillet", min: 0, max: 40, step: 0.01, labelClassic: "Bend fillet", labelField: "Bend fillet", classic: true, field: true, format: "fixed2" },
    { inputId: "flow-bendqty", valId: "flow-val-bendqty", flowKey: "bendQuantity", min: 1, max: 8, step: 1, labelClassic: "Bend quantity", labelField: "Bend quantity", classic: true, field: true, format: "int" },
  ];

  /** Contact sheet: all sliders that map to FLOW_TUNE_KEY (includes camera yaw/pitch for editor parity). */
  var STRAND_CONTACT_SLIDERS = [
    { key: "arcJitter", label: "Arc jitter", min: 0, max: 20, step: 0.01 },
    { key: "arcInconsistency", label: "Arc inconsistency", min: 0, max: 20, step: 0.01 },
    { key: "strandSpread", label: "Strand spread / particle waves", min: 0, max: 20, step: 0.01 },
    { key: "strandInstances", label: "Strand instances (classic)", min: 0, max: 20, step: 0.01 },
    { key: "fieldHighwayStrands", label: "Highway strands (field)", min: 1, max: 8, step: 1 },
    { key: "tweenQty", label: "Tween qty (field)", min: 0, max: 20, step: 0.01 },
    { key: "tweenJitter", label: "Tween jitter (field)", min: 0, max: 20, step: 0.01 },
    { key: "tweenOffset", label: "Tween offset (field)", min: 0, max: 20, step: 0.01 },
    { key: "depth", label: "3D depth", min: 0, max: 20, step: 0.01 },
    { key: "perspective", label: "Perspective", min: 0, max: 20, step: 0.01 },
    { key: "yaw", label: "Yaw (rad)", min: -6.29, max: 6.29, step: 0.01 },
    { key: "pitch", label: "Pitch (rad)", min: -1.15, max: 1.15, step: 0.01 },
    { key: "spinSpeed", label: "Spin speed", min: 0, max: 20, step: 0.01 },
    { key: "orbSpeed", label: "Orb speed", min: 0, max: 20, step: 0.01 },
    { key: "orbGlowDistance", label: "Orb glow distance", min: 0, max: 20, step: 0.01 },
    { key: "bendFillet", label: "Bend fillet", min: 0, max: 40, step: 0.01 },
    { key: "bendQuantity", label: "Bend quantity", min: 1, max: 8, step: 1 },
  ];

  var ELLIPSOID_CONTROL_SECTIONS = [
    {
      title: "Background (canvas)",
      fields: [
        { t: "range", id: "bg-wave-freq", label: "Waves", min: 0, max: 100, step: 1, v: 58 },
        { t: "range", id: "bg-wave-contrast", label: "Contrast", min: 0, max: 100, step: 1, v: 52 },
      ],
    },
    {
      title: "Solid & volume",
      fields: [
        { t: "radioBtns", label: "Solid mode", buttons: [
          { id: "solid-mode-ellipsoid", text: "Ellipsoid" },
          { id: "solid-mode-volume", text: "12×5×5 volume" },
        ]},
        { t: "checkbox", id: "chk-solid-geometry", label: "Show solid geometry", c: false },
      ],
    },
    {
      title: "Surface slide (axis slide modal)",
      fields: [
        { t: "checkbox", id: "chk-axis-slide-anim", label: "Animate slide", c: false },
        { t: "range", id: "slide-anim-speed", label: "Animation speed", min: 10, max: 250, step: 5, v: 100 },
        { t: "range", id: "slide-angle", label: "Mesh slide angle", min: 0, max: 90, step: 1, v: 50 },
        { t: "range", id: "slide-off-v", label: "V offset (azimuth)", min: 0, max: 360, step: 2, v: 0 },
        { t: "range", id: "slide-off-u", label: "U offset (colatitude)", min: 0, max: 360, step: 2, v: 0 },
      ],
    },
    {
      title: "Panels (seams)",
      fields: [
        { t: "checkbox", id: "chk-panel-seams", label: "Seam lines", c: false },
        { t: "checkbox", id: "chk-panel-dots", label: "Seam dots", c: true },
        { t: "checkbox", id: "chk-panel-uniform", label: "Uniform wrap", c: true },
        { t: "range", id: "panel-wrap-jitter", label: "Wrap jitter", min: 0, max: 100, step: 1, v: 35 },
        { t: "range", id: "panel-tightness", label: "Panel tightness", min: 3, max: 12, step: 1, v: 6 },
        { t: "range", id: "panel-dot-density", label: "Seam dot density", min: 0, max: 100, step: 1, v: 3 },
        { t: "range", id: "panel-seam-seed", label: "Seam layout seed", min: 0, max: 2000, step: 1, v: 0 },
        { t: "range", id: "panel-link-skip", label: "Panel link skip", min: 0, max: 12, step: 1, v: 2 },
        { t: "range", id: "panel-line-dash", label: "Panel seam lines", min: 0, max: 100, step: 1, v: 42 },
        { t: "button", id: "btn-panel-seam-reseed", label: "Reseed seams", text: "Reseed" },
      ],
    },
    {
      title: "Fabric · grid network & drift (fabric build only)",
      fields: [
        { t: "checkbox", id: "chk-panel-network-grid", label: "Structured grid network", c: true, target: "fabric" },
        { t: "range", id: "panel-agentic-flow", label: "Agentic flow", min: 0, max: 100, step: 1, v: 32, target: "fabric" },
        { t: "range", id: "fabric-flow", label: "Fabric flow (seam drift)", min: 0, max: 100, step: 1, v: 52, target: "fabric" },
        { t: "range", id: "fabric-ray-curl", label: "Link bend (mid segment)", min: 0, max: 100, step: 1, v: 48, target: "fabric" },
        { t: "range", id: "fabric-center-density", label: "Center density (screen)", min: 0, max: 100, step: 1, v: 58, target: "fabric" },
      ],
    },
    {
      title: "Mesh",
      fields: [
        { t: "checkbox", id: "chk-mesh-show", label: "Show wireframe", c: false },
        { t: "range", id: "mesh-opacity", label: "Wire opacity", min: 15, max: 100, step: 1, v: 100 },
        { t: "range", id: "irregular-seed", label: "Irregular seed", min: 0, max: 2000, step: 1, v: 0 },
        { t: "range", id: "irregular-scale", label: "Irregular scale", min: 0, max: 250, step: 1, v: 100 },
      ],
    },
    {
      title: "Markers",
      fields: [
        { t: "checkbox", id: "chk-markers-show", label: "Show vertex markers", c: true },
        { t: "range", id: "marker-count", label: "Marker count", min: 0, max: 2016, step: 1, v: 50 },
        { t: "range", id: "marker-size", label: "Dot size", min: 50, max: 500, step: 5, v: 300 },
      ],
    },
    {
      title: "Pathfinder",
      fields: [
        { t: "checkbox", id: "chk-paths-show", label: "Show paths", c: true },
        { t: "checkbox", id: "chk-path-through", label: "Through points", c: true, target: "gradient" },
        { t: "checkbox", id: "chk-static-volume-points", label: "Static volume points", c: true },
        { t: "range", id: "path-fillet", label: "Fillet amount", min: 0, max: 500, step: 5, v: 100 },
        { t: "range", id: "path-handle", label: "Offset orb size", min: 0, max: 260, step: 1, v: 100 },
        { t: "range", id: "path-extend", label: "Offset orb rotation", min: 0, max: 360, step: 1, v: 0 },
      ],
    },
  ];

  function getStrandModalRows(isField) {
    return STRAND_FLOW_MODAL_ROWS.filter(function (row) {
      return isField ? row.field : row.classic;
    });
  }

  function buildFlowTuneModalHtml(isField) {
    var rows = getStrandModalRows(isField);
    var html = '<h3 class="flow-tune-title">Debug / Flow Tune</h3>';
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var label = isField ? row.labelField : row.labelClassic;
      html += '<div class="flow-tune-row">';
      html += '<label>' + label + ' <span id="' + row.valId + '"></span></label>';
      html += '<input id="' + row.inputId + '" type="range" min="' + row.min + '" max="' + row.max + '" step="' + row.step + '" />';
      html += "</div>";
    }
    html += '<div class="flow-tune-actions"><button type="button" id="flow-reset">Reset</button></div>';
    return html;
  }

  /** Apply reset values to flowTune + scene3d objects in generative.js */
  function applyFlowTuneReset(isField, flowTune, scene3d) {
    flowTune.arcJitter = 0.45;
    flowTune.arcInconsistency = 0.52;
    flowTune.strandSpread = 1.35;
    flowTune.strandInstances = isField ? 1 : 1.45;
    flowTune.orbSpeed = 7.0;
    flowTune.orbGlowDistance = 6.0;
    flowTune.bendFillet = 8.0;
    flowTune.bendQuantity = 2.0;
    if (isField) {
      flowTune.fieldHighwayStrands = 8;
      flowTune.tweenQty = 4;
      flowTune.tweenJitter = 10;
      flowTune.tweenOffset = 10;
    }
    scene3d.depth = 1.0;
    scene3d.perspective = 0.9;
    scene3d.spinSpeed = 0.35;
  }

  global.PulseModalRegistry = {
    FLOW_TUNE_KEY: FLOW_TUNE_KEY,
    GENERATIVE_PIPE_KEY: GENERATIVE_PIPE_KEY,
    DEFAULT_FLOW_TUNE: DEFAULT_FLOW_TUNE,
    STRAND_FLOW_MODAL_ROWS: STRAND_FLOW_MODAL_ROWS,
    STRAND_CONTACT_SLIDERS: STRAND_CONTACT_SLIDERS,
    ELLIPSOID_CONTROL_SECTIONS: ELLIPSOID_CONTROL_SECTIONS,
    getStrandModalRows: getStrandModalRows,
    buildFlowTuneModalHtml: buildFlowTuneModalHtml,
    applyFlowTuneReset: applyFlowTuneReset,
  };
})(typeof window !== "undefined" ? window : globalThis);
