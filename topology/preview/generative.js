(function () {
  "use strict";

  /* ═══════════════════════════════════════════════════════
   * CANVAS
   * ═══════════════════════════════════════════════════════ */
  const canvas = document.getElementById("viz");
  const ctx = canvas.getContext("2d", { alpha: false });

  /* ═══════════════════════════════════════════════════════
   * SPEC-DERIVED CONSTANTS  (Pulse Wall Visual System V3)
   * ═══════════════════════════════════════════════════════ */
  const BG            = [6, 74, 164];      // Cisco-blue field anchor
  const BG_DEEP       = [8, 56, 132];
  const BG_MID        = [18, 112, 212];
  const STRAND_NEUTRAL = [220, 230, 244];  // light strands over blue field
  const NODE_FILL     = [236, 244, 255];   // near-white node dots

  const BLUE     = [0, 78, 220];
  const MID_BLUE = [12, 128, 255];
  const CYAN     = [0, 210, 255];
  const VIOLET   = [124, 126, 255];
  const MAGENTA  = [241, 0, 163];
  const ORANGE   = [255, 116, 56];
  const WHITE    = [255, 255, 255];

  const TYPE_COLOR = {
    security:  MID_BLUE,
    platform:  CYAN,
    network:   BLUE,
    endpoint:  [0, 100, 220],
    data:      MID_BLUE,
    service:   MID_BLUE,
    server:    BLUE,
    external:  CYAN,
    default:   MID_BLUE,
  };
  const CORE_CISCO_SIGNAL = [MAGENTA, ORANGE, [255, 84, 148], [255, 142, 76]];

  const RING_INDEX = {
    external: 0, "enterprise-edge": 1, "network-enforcement": 2,
    application: 3, "soc-platform": 4, core: 5,
  };

  const SPEC = {
    hubThreshold:       5,
    hubStrandMul:       1.8,
    telemetryStrandMul: 0.75,
    ringWeight:  [0.6, 0.7, 0.85, 0.90, 1.0, 0.95],
    crossRingArcScale:  1.0,
    grad: { fadeIn: 0.30, peak: 0.60, fadeOut: 0.80, end: 0.92 },
    stagger:     0.06,
    neutralAlpha: { solid: 0.56, dashed: 0.44, dotted: 0.30 },
    strandBase:   { solid: 3.0,  dashed: 1.8,  dotted: 1.0  },
    dash:         { dashed: [6, 4], dotted: [2, 4] },
    grainAlpha:  0.07,
    cascadeMs:   300,
    fadeInMs:     400,
    orbTravelMs: 1400,
    decayMs:     4000,
  };

  const GENERATIVE_PIPE_KEY = "topology.generative.pipe.v1";
  const FLOW_TUNE_KEY       = "topology.generative.flow.tune.v1";

  const flowTune = {
    arcJitter:        0.45,
    arcInconsistency: 0.52,
    strandSpread:     1.35,
    strandInstances:  1.45,
    orbSpeed:         7.0,
    orbGlowDistance:  6.0,
    bendFillet:       8.0,
    bendQuantity:     2.0,
  };
  const scene3d = {
    yaw:        0,
    pitch:      0,
    depth:      1.0,
    perspective: 0.9,
    autoSpin:   true,
    spinSpeed:  0.35, // dial value: 0..20
  };

  const SPIN_DIAL_MAX = 20;
  const SPIN_MAX_REV_PER_SEC = 1;

  /* ═══════════════════════════════════════════════════════
   * UTILITIES
   * ═══════════════════════════════════════════════════════ */
  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function lerpColor(c0, c1, t) {
    return [
      Math.round(lerp(c0[0], c1[0], t)),
      Math.round(lerp(c0[1], c1[1], t)),
      Math.round(lerp(c0[2], c1[2], t)),
    ];
  }

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ""));
    if (!m) return null;
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  }

  function scenarioColorForIndex(ix, palette) {
    const fallback = [[34, 211, 238], [167, 139, 250], [244, 114, 182], [251, 191, 36]];
    const source = Array.isArray(palette) && palette.length ? palette : [];
    const entry = source[ix % Math.max(1, source.length)];
    const rgb = hexToRgb(entry);
    return rgb || fallback[ix % fallback.length];
  }

  function ciscoSignalColorForIndex(ix) {
    return CORE_CISCO_SIGNAL[ix % CORE_CISCO_SIGNAL.length];
  }

  function rgba(arr, a) {
    return `rgba(${arr[0]},${arr[1]},${arr[2]},${a})`;
  }

  function flowWiggle(u, seed, amp) {
    const s = seed * 17.13;
    return (
      Math.sin(u * Math.PI * 4 + s) * 0.38 +
      Math.sin(u * Math.PI * 9 + s * 1.7) * 0.28 +
      Math.sin(u * Math.PI * 17 + s * 0.4) * 0.18 +
      Math.sin(u * Math.PI * 31 + s * 2.2) * 0.12
    ) * amp;
  }

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function spinDialToRevPerSec(dial) {
    return (clamp(Number(dial) || 0, 0, SPIN_DIAL_MAX) / SPIN_DIAL_MAX) * SPIN_MAX_REV_PER_SEC;
  }
  function spinDialToRadPerMs(dial) {
    return (spinDialToRevPerSec(dial) * Math.PI * 2) / 1000;
  }
  function orbSpeedToTravelMs(speedDial) {
    const s = clamp(Number(speedDial) || 0, 0, 20) / 20;
    return Math.round(lerp(3000, 700, s));
  }

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    return h >>> 0;
  }

  function shortLabel(s, max = 20) {
    const t = String(s || "").trim();
    if (!t) return "";
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}\u2026`;
  }

  function smoothstep(e0, e1, x) {
    const t = clamp01((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  }

  /* ═══════════════════════════════════════════════════════
   * GRADIENT CLAMPING SHADER  (Spec Section F — paramount)
   *
   * t < fadeIn        → neutral
   * fadeIn  → peak    → smoothstep(neutral, signal)
   * peak    → fadeOut → signal at full saturation
   * fadeOut → end     → smoothstep(signal, neutral)
   * > end             → neutral × 0.7 (darkened terminal)
   * ═══════════════════════════════════════════════════════ */
  function strandColorAt(t, neutral, signal, stagger) {
    const g = SPEC.grad;
    const s = stagger || 0;
    const fi = g.fadeIn + s;
    const pk = g.peak + s;
    const fo = g.fadeOut + s;
    const en = g.end + s;

    if (t < fi)  return { color: neutral, mul: 1.0 };
    if (t < pk)  return { color: lerpColor(neutral, signal, smoothstep(fi, pk, t)), mul: 1.0 };
    if (t < fo)  return { color: signal, mul: 1.0 };
    if (t < en)  return { color: lerpColor(signal, neutral, smoothstep(fo, en, t)), mul: 1.0 };
    return { color: neutral, mul: 0.7 };
  }

  /* ═══════════════════════════════════════════════════════
   * TOPOLOGY ANALYSIS
   * ═══════════════════════════════════════════════════════ */
  let _cachedDegrees = null;
  let _cachedEdgeSig = "";

  function computeNodeDegrees(edges) {
    const sig = edges.length + "|" + (edges[0] ? edges[0].from : "");
    if (sig === _cachedEdgeSig && _cachedDegrees) return _cachedDegrees;
    const deg = {};
    for (const e of edges) {
      deg[e.from] = (deg[e.from] || 0) + 1;
      deg[e.to]   = (deg[e.to] || 0) + 1;
    }
    _cachedDegrees = deg;
    _cachedEdgeSig = sig;
    return deg;
  }

  function edgeStrandCount(style, degFrom, degTo) {
    let base = SPEC.strandBase[style] || SPEC.strandBase.solid;
    if (style === "dotted") base *= SPEC.telemetryStrandMul;
    const maxDeg = Math.max(degFrom || 0, degTo || 0);
    if (maxDeg > SPEC.hubThreshold) base *= SPEC.hubStrandMul;
    return Math.max(1, Math.round(base * flowTune.strandInstances));
  }

  function ringOpacity(ringId) {
    const idx = RING_INDEX[ringId];
    return idx != null ? (SPEC.ringWeight[idx] || 0.85) : 0.85;
  }

  function edgeKey(from, to) {
    return from < to ? from + "\x00" + to : to + "\x00" + from;
  }

  function typeColor(type) {
    return TYPE_COLOR[type] || TYPE_COLOR.default;
  }

  /* ═══════════════════════════════════════════════════════
   * CANVAS SIZING
   * ═══════════════════════════════════════════════════════ */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width  = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width  = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h, dpr };
  }

  /* ═══════════════════════════════════════════════════════
   * DATA PIPE
   * ═══════════════════════════════════════════════════════ */
  function readGenerativePipe() {
    try {
      const raw = localStorage.getItem(GENERATIVE_PIPE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) return null;
      return data;
    } catch (_) { return null; }
  }

  /* ═══════════════════════════════════════════════════════
   * 3D PROJECTION  (kept from previous — pseudo-3D camera)
   * ═══════════════════════════════════════════════════════ */
  function nodeDepth(n) {
    const ringDepth = {
      external: -0.9, "enterprise-edge": -0.58,
      "network-enforcement": -0.24, application: 0.04,
      "soc-platform": 0.34, core: 0.68,
    };
    const base = ringDepth[n.ringId] != null ? ringDepth[n.ringId] : 0;
    const h = hashStr(`${n.id || ""}|${n.ringId || ""}`);
    const jitter = (((h % 1000) / 1000) - 0.5) * 0.28;
    return (base + jitter) * scene3d.depth;
  }

  function mapPipePoint(n, w, h, view) {
    const vw = view?.width || 120;
    const vh = view?.height || 60;
    const marginX = w * 0.11;
    const marginY = h * 0.12;
    const innerW = w - marginX * 2;
    const innerH = h - marginY * 2;
    const nx = Math.max(0, Math.min(vw, Number(n.x) || 0)) / vw;
    const ny = Math.max(0, Math.min(vh, Number(n.y) || 0)) / vh;
    const worldX = (nx - 0.5) * 2.0;
    const worldY = (ny - 0.5) * 1.7;
    const worldZ = nodeDepth(n);
    const cy = Math.cos(scene3d.yaw);
    const sy = Math.sin(scene3d.yaw);
    const cp = Math.cos(scene3d.pitch);
    const sp = Math.sin(scene3d.pitch);
    const x1 = worldX * cy + worldZ * sy;
    const z1 = -worldX * sy + worldZ * cy;
    const y2 = worldY * cp - z1 * sp;
    const z2 = worldY * sp + z1 * cp;
    const camera = 2.8;
    const proj = camera / Math.max(0.6, camera - z2 * scene3d.perspective);
    const cx = marginX + innerW / 2;
    const cy2 = marginY + innerH / 2;
    return {
      x: cx + x1 * innerW * 0.46 * proj,
      y: cy2 + y2 * innerH * 0.46 * proj,
    };
  }

  function mapViewToCanvas(vx, vy, w, h, view) {
    const vw = view?.width || 120;
    const vh = view?.height || 60;
    const marginX = w * 0.11;
    const marginY = h * 0.12;
    return {
      x: marginX + (Math.max(0, Math.min(vw, Number(vx) || 0)) / vw) * (w - marginX * 2),
      y: marginY + (Math.max(0, Math.min(vh, Number(vy) || 0)) / vh) * (h - marginY * 2),
    };
  }

  function projectScenePoint(x, y, z, w, h) {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const worldX = (x - cx) / Math.max(1, w * 0.5);
    const worldY = (y - cy) / Math.max(1, h * 0.5);
    const worldZ = z;
    const cyaw = Math.cos(scene3d.yaw);
    const syaw = Math.sin(scene3d.yaw);
    const cp = Math.cos(scene3d.pitch);
    const sp = Math.sin(scene3d.pitch);
    const x1 = worldX * cyaw + worldZ * syaw;
    const z1 = -worldX * syaw + worldZ * cyaw;
    const y2 = worldY * cp - z1 * sp;
    const z2 = worldY * sp + z1 * cp;
    const camera = 2.7;
    const proj = camera / Math.max(0.62, camera - z2 * scene3d.perspective);
    return {
      x: cx + x1 * (w * 0.5) * proj,
      y: cy + y2 * (h * 0.5) * proj,
      scale: proj,
    };
  }

  /* ═══════════════════════════════════════════════════════
   * PERSISTENCE  (flow tune + 3D params)
   * ═══════════════════════════════════════════════════════ */
  function loadFlowTune() {
    try {
      const raw = localStorage.getItem(FLOW_TUNE_KEY);
      if (!raw) return;
      const x = JSON.parse(raw);
      if (!x || typeof x !== "object") return;
      if (typeof x.arcJitter === "number")        flowTune.arcJitter = clamp(x.arcJitter, 0, 20);
      if (typeof x.arcInconsistency === "number") flowTune.arcInconsistency = clamp(x.arcInconsistency, 0, 20);
      if (typeof x.strandSpread === "number")     flowTune.strandSpread = clamp(x.strandSpread, 0, 20);
      if (typeof x.strandInstances === "number")  flowTune.strandInstances = clamp(x.strandInstances, 0, 20);
      if (typeof x.orbSpeed === "number")         flowTune.orbSpeed = clamp(x.orbSpeed, 0, 20);
      if (typeof x.orbGlowDistance === "number")  flowTune.orbGlowDistance = clamp(x.orbGlowDistance, 0, 20);
      if (typeof x.bendFillet === "number")       flowTune.bendFillet = clamp(x.bendFillet, 0, 20);
      if (typeof x.bendQuantity === "number")     flowTune.bendQuantity = clamp(x.bendQuantity, 1, 3);
      if (typeof x.yaw === "number")         scene3d.yaw = clamp(x.yaw, -Math.PI * 2, Math.PI * 2);
      if (typeof x.pitch === "number")       scene3d.pitch = clamp(x.pitch, -1.15, 1.15);
      if (typeof x.depth === "number")       scene3d.depth = clamp(x.depth, 0, 20);
      if (typeof x.perspective === "number") scene3d.perspective = clamp(x.perspective, 0, 20);
      if (typeof x.autoSpin === "boolean")   scene3d.autoSpin = x.autoSpin;
      if (typeof x.spinSpeed === "number") {
        const rawSpin = Number(x.spinSpeed) || 0;
        // Migrate legacy persisted units (rad/ms) into dial units.
        if (rawSpin > 0 && rawSpin <= 0.02) {
          const legacyDial = (rawSpin * 1000 / (Math.PI * 2)) * SPIN_DIAL_MAX;
          scene3d.spinSpeed = clamp(legacyDial, 0, SPIN_DIAL_MAX);
        } else {
          scene3d.spinSpeed = clamp(rawSpin, 0, SPIN_DIAL_MAX);
        }
      }
    } catch (_) { /* ignore */ }
  }

  function saveFlowTune() {
    try {
      localStorage.setItem(FLOW_TUNE_KEY, JSON.stringify({
        ...flowTune,
        yaw: scene3d.yaw, pitch: scene3d.pitch,
        depth: scene3d.depth, perspective: scene3d.perspective,
        autoSpin: scene3d.autoSpin, spinSpeed: scene3d.spinSpeed,
      }));
    } catch (_) { /* ignore */ }
  }

  /* ═══════════════════════════════════════════════════════
   * CURVE GEOMETRY
   * ═══════════════════════════════════════════════════════ */
  function buildChaseCurve(p0, p1, key) {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const h = hashStr(key);
    const sign = h % 2 ? 1 : -1;
    const varAmt = flowTune.arcInconsistency;
    const jitterAmt = flowTune.arcJitter;
    const bend =
      Math.min(len * 0.22, 64) * SPEC.crossRingArcScale *
      (0.28 + ((h % 1000) / 1000) * (0.34 + varAmt * 0.16)) * sign;
    const jx = (Math.sin(h * 0.0017) * 0.5 + Math.cos(h * 0.0023) * 0.5) * jitterAmt * 8;
    const jy = (Math.cos(h * 0.0021) * 0.5 + Math.sin(h * 0.0013) * 0.5) * jitterAmt * 8;
    return {
      cx: (p0.x + p1.x) / 2 + nx * bend + jx,
      cy: (p0.y + p1.y) / 2 + ny * bend + jy,
    };
  }

  function quadPoint(p0, c, p1, t) {
    const mt = 1 - t;
    return {
      x: mt * mt * p0.x + 2 * mt * t * c.cx + t * t * p1.x,
      y: mt * mt * p0.y + 2 * mt * t * c.cy + t * t * p1.y,
    };
  }

  function estimateQuadraticLength(p0, c, p1, steps) {
    steps = steps || 22;
    let prev = p0;
    let len = 0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const p = quadPoint(p0, c, p1, t);
      len += Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = p;
    }
    return len;
  }

  function pointOnPolyline(points, t) {
    if (!Array.isArray(points) || points.length === 0) return { x: 0, y: 0 };
    if (points.length === 1) return points[0];
    const clampedT = clamp01(t);
    const segLens = [];
    let totalLen = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      segLens.push(len);
      totalLen += len;
    }
    if (totalLen < 1e-5) return points[0];
    const target = clampedT * totalLen;
    let acc = 0;
    for (let i = 0; i < segLens.length; i++) {
      const len = segLens[i];
      if (target <= acc + len || i === segLens.length - 1) {
        const a = points[i];
        const b = points[i + 1];
        const lt = len < 1e-5 ? 0 : (target - acc) / len;
        return {
          x: lerp(a.x, b.x, lt),
          y: lerp(a.y, b.y, lt),
        };
      }
      acc += len;
    }
    return points[points.length - 1];
  }

  function traceFilletedPolyline(ctx2d, points, radius) {
    if (!Array.isArray(points) || points.length < 2) return;
    if (points.length === 2 || radius <= 0.01) {
      ctx2d.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx2d.lineTo(points[i].x, points[i].y);
      return;
    }
    ctx2d.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i];
      const n = points[i + 1];
      ctx2d.arcTo(p.x, p.y, n.x, n.y, radius);
    }
    const last = points[points.length - 1];
    ctx2d.lineTo(last.x, last.y);
  }

  function buildHighwayPolyline(x1, y1, x2, y2, dx, dy, tangentFrac, bendQty) {
    const midY = (y1 + y2) * 0.5;
    const midX = (x1 + x2) * 0.5 + dx * 0.10;
    if (bendQty <= 1) {
      return [
        { x: x1, y: y1 },
        { x: midX, y: midY },
        { x: x2, y: y2 },
      ];
    }
    if (bendQty === 2) {
      const yIn2 = y1 + dy * clamp(0.22 + tangentFrac * 0.18, 0.18, 0.36);
      const yOut2 = y2 - dy * clamp(0.22 + tangentFrac * 0.18, 0.18, 0.36);
      return [
        { x: x1, y: y1 },
        { x: x1 + dx * 0.18, y: yIn2 },
        { x: x2 - dx * 0.18, y: yOut2 },
        { x: x2, y: y2 },
      ];
    }
    const yIn = y1 + dy * clamp(0.20 + tangentFrac * 0.20, 0.18, 0.32);
    const yOut = y2 - dy * clamp(0.20 + tangentFrac * 0.20, 0.18, 0.32);
    return [
      { x: x1, y: y1 },
      { x: x1, y: yIn },
      { x: midX, y: midY },
      { x: x2, y: yOut },
      { x: x2, y: y2 },
    ];
  }

  function buildEdgeAdjacency(edges) {
    const adj = new Map();
    for (const e of edges || []) {
      if (!e || !e.from || !e.to) continue;
      if (!adj.has(e.from)) adj.set(e.from, new Set());
      if (!adj.has(e.to)) adj.set(e.to, new Set());
      adj.get(e.from).add(e.to);
      adj.get(e.to).add(e.from);
    }
    return adj;
  }

  function shortestPathNodes(adj, start, goal) {
    if (!start || !goal) return null;
    if (start === goal) return [start];
    if (!adj.has(start) || !adj.has(goal)) return null;
    const q = [start];
    const prev = new Map();
    prev.set(start, null);
    for (let qi = 0; qi < q.length; qi++) {
      const cur = q[qi];
      const neighbors = adj.get(cur);
      if (!neighbors) continue;
      for (const nx of neighbors) {
        if (prev.has(nx)) continue;
        prev.set(nx, cur);
        if (nx === goal) {
          const path = [goal];
          let p = cur;
          while (p != null) {
            path.push(p);
            p = prev.get(p) || null;
          }
          path.reverse();
          return path;
        }
        q.push(nx);
      }
    }
    return null;
  }

  function scenarioScriptedNodes(route) {
    const steps = Array.isArray(route?.attackSteps) ? route.attackSteps : [];
    if (!steps.length) return Array.isArray(route?.nodes) ? route.nodes : [];
    const ordered = [...steps]
      .filter(s => Array.isArray(s.nodes) && s.nodes.length)
      .sort((a, b) => (Number(a.step) || 0) - (Number(b.step) || 0));
    const seq = [];
    for (const st of ordered) {
      for (const nid of st.nodes) {
        if (!nid) continue;
        if (!seq.length || seq[seq.length - 1] !== nid) seq.push(nid);
      }
    }
    return seq.length ? seq : (Array.isArray(route?.nodes) ? route.nodes : []);
  }

  function buildContinuousRouteNodes(route, edges) {
    const scripted = scenarioScriptedNodes(route);
    if (!Array.isArray(scripted) || scripted.length < 2) return scripted || [];
    const adj = buildEdgeAdjacency(edges);
    const out = [scripted[0]];
    for (let i = 0; i < scripted.length - 1; i++) {
      const a = scripted[i];
      const b = scripted[i + 1];
      if (!a || !b) continue;
      const segPath = shortestPathNodes(adj, a, b);
      if (Array.isArray(segPath) && segPath.length > 1) {
        for (let j = 1; j < segPath.length; j++) {
          const nid = segPath[j];
          if (out[out.length - 1] !== nid) out.push(nid);
        }
      } else if (out[out.length - 1] !== b) {
        out.push(b);
      }
    }
    return out;
  }

  /* ═══════════════════════════════════════════════════════
   * GRAIN OVERLAY  (Spec Section E — perlin noise at 7%)
   * ═══════════════════════════════════════════════════════ */
  let _grainCanvas = null;
  let _grainW = 0;
  let _grainH = 0;

  function drawGrain() {
    const pw = canvas.width;
    const ph = canvas.height;
    if (!_grainCanvas || _grainW !== pw || _grainH !== ph) {
      _grainCanvas = document.createElement("canvas");
      _grainCanvas.width = pw;
      _grainCanvas.height = ph;
      const gc = _grainCanvas.getContext("2d");
      const img = gc.createImageData(pw, ph);
      const d = img.data;
      const rng = mulberry32(42);
      for (let i = 0; i < d.length; i += 4) {
        d[i] = d[i + 1] = d[i + 2] = Math.floor(rng() * 255);
        d[i + 3] = 255;
      }
      gc.putImageData(img, 0, 0);
      _grainW = pw;
      _grainH = ph;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = SPEC.grainAlpha * 0.22;
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(_grainCanvas, 0, 0);
    ctx.restore();
  }

  function drawFieldBackground(w, h, nowMs) {
    const t = (nowMs || 0) * 0.00011;
    const d = Math.min(w, h);
    const driftX = Math.sin(t * 1.4) * 0.14 + Math.sin(t * 0.41) * 0.06;
    const driftY = Math.cos(t * 1.1) * 0.10 + Math.sin(t * 0.53) * 0.05;
    const dayNight = 0.5 + 0.5 * Math.sin(t * 0.37 - 0.8);
    const midnightLift = smoothstep(0.0, 1.0, dayNight);
    const brightLift = 1 - midnightLift;

    const g = ctx.createLinearGradient(
      -w * (0.06 + driftX), h * (1.03 - driftY),
      w * (1.06 + driftX), -h * (0.03 + driftY)
    );
    g.addColorStop(0.00, rgba(lerpColor(BG_DEEP, [2, 14, 44], midnightLift * 0.9), 1));
    g.addColorStop(0.38, rgba(lerpColor(BG, BG_MID, brightLift * 0.75), 1));
    g.addColorStop(1.00, rgba(lerpColor(BG_MID, BG_DEEP, midnightLift * 0.55), 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Amorphous blue blobs drifting across the field.
    const cx1 = w * (0.36 + 0.10 * Math.sin(t * 0.9));
    const cy1 = h * (0.40 + 0.09 * Math.cos(t * 0.73));
    const cx2 = w * (0.66 + 0.09 * Math.cos(t * 0.81 + 0.7));
    const cy2 = h * (0.60 + 0.10 * Math.sin(t * 0.67 - 0.4));
    const pulseA = 0.10 + 0.12 * (0.5 + 0.5 * Math.sin(t * 1.9));
    const pulseB = 0.08 + 0.10 * (0.5 + 0.5 * Math.cos(t * 1.6 - 0.5));

    const blobA = ctx.createRadialGradient(cx1, cy1, d * 0.10, cx1, cy1, d * 0.68);
    blobA.addColorStop(0.0, `rgba(72,186,255,${pulseA + brightLift * 0.08})`);
    blobA.addColorStop(0.45, `rgba(24,122,238,${(pulseA * 0.58) + brightLift * 0.04})`);
    blobA.addColorStop(1.0, "rgba(0,80,180,0)");
    ctx.fillStyle = blobA;
    ctx.fillRect(0, 0, w, h);

    const blobB = ctx.createRadialGradient(cx2, cy2, d * 0.11, cx2, cy2, d * 0.64);
    blobB.addColorStop(0.0, `rgba(18,146,255,${pulseB + brightLift * 0.08})`);
    blobB.addColorStop(0.42, `rgba(8,92,214,${(pulseB * 0.62) + brightLift * 0.05})`);
    blobB.addColorStop(1.0, "rgba(0,56,160,0)");
    ctx.fillStyle = blobB;
    ctx.fillRect(0, 0, w, h);

    // Broad midnight wash that comes and goes.
    const blueAura = ctx.createRadialGradient(w * 0.52, h * 0.50, d * 0.10, w * 0.52, h * 0.50, d * 0.84);
    blueAura.addColorStop(0.0, `rgba(0,188,235,${0.03 + brightLift * 0.04})`);
    blueAura.addColorStop(0.35, `rgba(0,120,220,${0.03 + brightLift * 0.03})`);
    blueAura.addColorStop(1.0, "rgba(0,60,140,0)");
    ctx.fillStyle = blueAura;
    ctx.fillRect(0, 0, w, h);
    const midnightVeil = ctx.createRadialGradient(w * 0.54, h * 0.50, d * 0.13, w * 0.54, h * 0.50, d * 0.90);
    midnightVeil.addColorStop(0.0, `rgba(4,18,52,${0.02 + midnightLift * 0.12})`);
    midnightVeil.addColorStop(0.7, `rgba(2,12,38,${0.02 + midnightLift * 0.16})`);
    midnightVeil.addColorStop(1.0, `rgba(1,8,24,${0.02 + midnightLift * 0.18})`);
    ctx.fillStyle = midnightVeil;
    ctx.fillRect(0, 0, w, h);

    // Edge shimmer: occasional pink/orange glow that appears from the perimeter.
    const shimmerA = 0.03 + Math.max(0, Math.sin(t * 2.0 - 0.8)) * 0.10;
    const shimmerB = 0.02 + Math.max(0, Math.sin(t * 1.6 + 1.1)) * 0.09;
    const pinkEdge = ctx.createRadialGradient(w * 0.00, h * 0.20, d * 0.05, w * 0.00, h * 0.20, d * 0.62);
    pinkEdge.addColorStop(0.0, `rgba(${MAGENTA[0]},${MAGENTA[1]},${MAGENTA[2]},${shimmerA})`);
    pinkEdge.addColorStop(1.0, "rgba(241,0,163,0)");
    ctx.fillStyle = pinkEdge;
    ctx.fillRect(0, 0, w, h);

    const orangeEdge = ctx.createRadialGradient(w * 1.00, h * 0.82, d * 0.05, w * 1.00, h * 0.82, d * 0.58);
    orangeEdge.addColorStop(0.0, `rgba(${ORANGE[0]},${ORANGE[1]},${ORANGE[2]},${shimmerB})`);
    orangeEdge.addColorStop(1.0, "rgba(255,116,56,0)");
    ctx.fillStyle = orangeEdge;
    ctx.fillRect(0, 0, w, h);
  }

  /* ═══════════════════════════════════════════════════════
   * BACKDROP  (grid + trust zones — light bg variant)
   * ═══════════════════════════════════════════════════════ */
  function drawBackdrop(w, h, pipe) {
    const display = pipe.display || {};
    const view = pipe.view || { width: 120, height: 60 };
    const vw = view.width || 120;
    const vh = view.height || 60;
    const marginX = w * 0.11;
    const marginY = h * 0.12;
    const innerW = w - marginX * 2;
    const innerH = h - marginY * 2;

    ctx.save();

    if (display.showTrustZones && Array.isArray(pipe.zoneHalos)) {
      for (const zone of pipe.zoneHalos) {
        const members = pipe.nodes.filter(n => n.ringId === zone.ringId);
        if (!members.length) continue;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of members) {
          const nx = Number(n.x) || 0;
          const ny = Number(n.y) || 0;
          if (nx < minX) minX = nx;
          if (ny < minY) minY = ny;
          if (nx > maxX) maxX = nx;
          if (ny > maxY) maxY = ny;
        }
        const pad = Number(zone.padding) || 1.3;
        const p0 = mapViewToCanvas(minX - pad, minY - pad, w, h, view);
        const p1 = mapViewToCanvas(maxX + pad, maxY + pad, w, h, view);
        const rxUnits = Number(zone.rx) || 1.2;
        const rr = Math.max(2, rxUnits * Math.min(innerW / vw, innerH / vh));
        ctx.fillStyle   = rgba(STRAND_NEUTRAL, 0.035);
        ctx.strokeStyle = rgba(STRAND_NEUTRAL, 0.08);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.roundRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y, rr);
        ctx.fill();
        ctx.stroke();
      }
    }

    if (display.showGrid) {
      ctx.strokeStyle = rgba(STRAND_NEUTRAL, 0.08);
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 12; i++) {
        const x = marginX + (innerW * i) / 12;
        ctx.beginPath();
        ctx.moveTo(x, marginY);
        ctx.lineTo(x, marginY + innerH);
        ctx.stroke();
      }
      for (let j = 0; j <= 6; j++) {
        const y = marginY + (innerH * j) / 6;
        ctx.beginPath();
        ctx.moveTo(marginX, y);
        ctx.lineTo(marginX + innerW, y);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /* ═══════════════════════════════════════════════════════
   * NODE RENDERING  (Spec Section C — arc-field layout)
   *
   * Nodes sit at the top of the canvas. Labels render as
   * small callout badges connected by thin leader lines.
   * ═══════════════════════════════════════════════════════ */
  let showNodeLabels = false;

  function nodeRadius(ringId) {
    const ri = RING_INDEX[ringId];
    if (ri === 5) return 3.8;
    if (ri <= 1)  return 3.6;
    if (ri === 2) return 3.2;
    return 3.0;
  }

  function drawNodes(w, h, pipe, nodeGlows, nodePositions) {
    ctx.save();
    for (const n of pipe.nodes) {
      const p = nodePositions ? nodePositions.get(n.id) : mapPipePoint(n, w, h, pipe.view);
      if (!p) continue;
      const r = nodeRadius(n.ringId);
      const col = typeColor(n.type);
      const glow = nodeGlows ? nodeGlows.get(n.id) : null;

      if (glow && glow.intensity > 0.01) {
        const gr = ctx.createRadialGradient(p.x, p.y, r, p.x, p.y, r + 4 + glow.intensity * 6);
        gr.addColorStop(0, rgba(glow.color, 0.22 * glow.intensity));
        gr.addColorStop(1, rgba(glow.color, 0));
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 4 + glow.intensity * 6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(NODE_FILL, 0.95);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 1.2, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(col, 0.72);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();

    if (showNodeLabels) {
      ctx.save();
      ctx.font = '8.5px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textBaseline = "bottom";
      for (const n of pipe.nodes) {
        const p = nodePositions ? nodePositions.get(n.id) : mapPipePoint(n, w, h, pipe.view);
        if (!p) continue;
        const text = shortLabel(n.label, 16);
        if (!text) continue;
        const r = nodeRadius(n.ringId);
        const calloutH = 14 + (hashStr(n.id) % 10);
        const lx = p.x + 2;
        const ly = p.y - r - calloutH;

        ctx.strokeStyle = rgba(STRAND_NEUTRAL, 0.12);
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - r - 1);
        ctx.lineTo(lx, ly + 6);
        ctx.stroke();

        const tw = ctx.measureText(text).width;
        const pad = 3;
        ctx.fillStyle = rgba(BG, 0.82);
        ctx.strokeStyle = rgba(STRAND_NEUTRAL, 0.10);
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.roundRect(lx - pad, ly - 10, tw + pad * 2, 13, 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = rgba(STRAND_NEUTRAL, 0.58);
        ctx.fillText(text, lx, ly);
      }
      ctx.restore();
    }
  }

  /* (pipe-bend strand removed — replaced by highway Bézier routing in drawTopology) */

  /* ═══════════════════════════════════════════════════════
   * SCENARIO / CHASE STATE
   * ═══════════════════════════════════════════════════════ */
  let activeChases = [];
  let scenarioSignature = "";
  let rafId = 0;

  function updateScenarioButtonsActive() {
    document.querySelectorAll(".scenario-btn").forEach(el => {
      const rid = el.getAttribute("data-route-id");
      const on = activeChases.some(c => c.routeId === rid);
      el.classList.toggle("is-active", on);
    });
  }

  function ensureScenarioButtons(pipe) {
    const host = document.getElementById("scenario-buttons");
    if (!host) return;
    const routes = Array.isArray(pipe?.routes) ? pipe.routes : [];
    const sig = routes.map(r => r.id).join("|");
    if (sig === scenarioSignature && host.childElementCount === routes.length) {
      updateScenarioButtonsActive();
      return;
    }
    scenarioSignature = sig;
    host.innerHTML = "";
    routes.forEach((route, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "scenario-btn";
      btn.setAttribute("data-route-id", route.id);
      btn.textContent = `${i + 1}. ${shortLabel(route.label || route.id, 26)}`;
      btn.addEventListener("click", () => {
        activeChases.push({
          id: `${route.id}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
          routeId: route.id,
          startedAt: performance.now(),
        });
        if (activeChases.length > 36) activeChases = activeChases.slice(-36);
        updateScenarioButtonsActive();
        render();
        scheduleAnimationFrame();
      });
      host.appendChild(btn);
    });
    updateScenarioButtonsActive();
  }

  function pulseEnvelope(msSinceArrival) {
    const FADE_IN = 260, HOLD = 420, FADE_OUT = 900;
    if (msSinceArrival < 0) return 0;
    if (msSinceArrival < FADE_IN) return msSinceArrival / FADE_IN;
    if (msSinceArrival < FADE_IN + HOLD) return 1;
    if (msSinceArrival < FADE_IN + HOLD + FADE_OUT) return 1 - (msSinceArrival - FADE_IN - HOLD) / FADE_OUT;
    return 0;
  }

  /* ═══════════════════════════════════════════════════════
   * EDGE ACTIVATION  (Spec Section 4 — state system)
   *
   * Cascade-driven bright path activation with a traveling
   * orb that advances edge-by-edge through each route.
   * ═══════════════════════════════════════════════════════ */
  function buildEdgeActivation(pipe, nowMs) {
    const routes = Array.isArray(pipe.routes) ? pipe.routes : [];
    const activation = new Map();
    const nodeGlows = new Map();
    const survivors = [];

    for (const chase of activeChases) {
      const ri = routes.findIndex(r => r.id === chase.routeId);
      const route = ri >= 0 ? routes[ri] : null;
      const routeNodes = buildContinuousRouteNodes(route, pipe.edges);
      if (!route || !Array.isArray(routeNodes) || routeNodes.length < 2) continue;

      const signal = ciscoSignalColorForIndex(ri);
      const elapsed = nowMs - chase.startedAt;
      const N = routeNodes.length - 1;
      const stepMs = orbSpeedToTravelMs(flowTune.orbSpeed);
      const trailMs = 900;
      const resolutionStart = N * stepMs + trailMs;
      const totalMs = resolutionStart + SPEC.decayMs;
      if (elapsed > totalMs) continue;
      survivors.push(chase);

      for (let i = 0; i < N; i++) {
        const edgeElapsed = elapsed - i * stepMs;
        if (edgeElapsed < 0) continue;

        const orbT = clamp01(edgeElapsed / stepMs);
        const orbActive = edgeElapsed >= 0 && edgeElapsed < stepMs;
        const head = orbActive ? (0.70 + 0.30 * smoothstep(0, stepMs, edgeElapsed)) : 0;
        const tail = edgeElapsed >= stepMs
          ? Math.max(0, 0.52 * (1 - (edgeElapsed - stepMs) / trailMs))
          : 0;
        let intensity = Math.max(head, tail);

        if (elapsed > resolutionStart) {
          intensity *= 1 - clamp01((elapsed - resolutionStart) / SPEC.decayMs);
        }
        if (intensity < 0.01) continue;

        const key = edgeKey(routeNodes[i], routeNodes[i + 1]);
        const existing = activation.get(key);
        if (!existing || intensity > existing.intensity) {
          activation.set(key, {
            signal,
            intensity: clamp01(intensity),
            orbT,
            orbActive,
          });
        }
      }

      for (let i = 0; i < routeNodes.length; i++) {
        const nodeArrivalMs = i * stepMs;
        const pulse = pulseEnvelope(elapsed - nodeArrivalMs);
        if (pulse > 0.01) {
          const nid = routeNodes[i];
          const existing = nodeGlows.get(nid);
          if (!existing || pulse > existing.intensity) {
            nodeGlows.set(nid, { color: signal, intensity: pulse });
          }
        }
      }
    }

    activeChases = survivors;
    updateScenarioButtonsActive();
    return { activation, nodeGlows, running: survivors.length > 0 };
  }

  /* ═══════════════════════════════════════════════════════
   * MAIN TOPOLOGY RENDERER — PANORAMIC STRAND CURTAIN
   *
   * Center-out overlapping parabolic zones. Each trust
   * zone forms a parabolic arc from the center outward.
   * Vertical curtain strands cascade from every instance.
   * Highway arc-and-tangent Bézier strands weave between
   * connected nodes across zones.
   *
   * Compositing order:
   *   1. Dark field background
   *   2. [zoom canvas transform]
   *   3. Center-out parabolic zone layout + instancing
   *   4. Zone parabola guidelines
   *   5. Vertical curtain strands (per-node drops)
   *   6. Highway arc-and-tangent interconnection strands
   *   7. Accent dots along strands
   *   8. Node instances (primary + ghost)
   *   9. Labels + cascade glow labels
   *  10. [restore transform]
   *  11. Grain overlay (screen-space)
   * ═══════════════════════════════════════════════════════ */

  const ZONE_SPREAD    = [0.95, 0.82, 0.68, 0.52, 0.35, 0.20];
  const ZONE_VERTEX_Y  = [0.05, 0.08, 0.12, 0.16, 0.21, 0.27];
  const ZONE_ARC_DEPTH = [0.42, 0.36, 0.30, 0.24, 0.18, 0.11];

  function drawTopology(w, h, pipe, nowMs) {
    const degrees = computeNodeDegrees(pipe.edges);
    const { activation, nodeGlows, running } = buildEdgeActivation(pipe, nowMs);

    /* 1. Background */
    drawFieldBackground(w, h, nowMs);

    /* 2. Zoom transform (centered, no pan) */
    const zoom = clamp(Math.pow(2.0, (scene3d.depth - 1) * 1.6), 0.25, 8);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-w / 2, -h / 2);

    /* 3. Center-out parabolic zone layout */
    const ringGroups = [[], [], [], [], [], []];
    for (const n of pipe.nodes) {
      const ri = RING_INDEX[n.ringId] != null ? RING_INDEX[n.ringId] : 3;
      ringGroups[ri].push(n);
    }

    const nodePositions  = new Map();
    const allInstances   = [];
    const instancesByNode = new Map();
    const instanceCount  = Math.max(1, Math.round(flowTune.strandInstances));
    const cx = w / 2;

    for (let ri = 0; ri < 6; ri++) {
      const nodes = ringGroups[ri];
      if (!nodes.length) continue;
      nodes.sort((a, b) => (Number(a.x) || 0) - (Number(b.x) || 0));

      const halfSpread = ZONE_SPREAD[ri] * w * 0.5;
      const vertexY    = ZONE_VERTEX_Y[ri] * h;
      const arcDepth   = ZONE_ARC_DEPTH[ri] * h;
      const totalSlots = nodes.length * instanceCount;

      for (let i = 0; i < nodes.length; i++) {
        if (!instancesByNode.has(nodes[i].id)) instancesByNode.set(nodes[i].id, []);
        for (let inst = 0; inst < instanceCount; inst++) {
          const slot = i * instanceCount + inst;
          const t = totalSlots <= 1 ? 0.5 : slot / (totalSlots - 1);
          const normX = (t - 0.5) * 2;
          const x = cx + normX * halfSpread;

          const yTop = vertexY + arcDepth * normX * normX;
          if (inst === 0) nodePositions.set(nodes[i].id, { x, y: yTop });
          const topObj = { nodeId: nodes[i].id, node: nodes[i], x, y: yTop, wx: x, wy: yTop, inst, ring: ri, tNorm: t, mirror: false };
          allInstances.push(topObj);
          instancesByNode.get(nodes[i].id).push(topObj);

          const yBot = (h - vertexY) - arcDepth * normX * normX;
          const botObj = { nodeId: nodes[i].id, node: nodes[i], x, y: yBot, wx: x, wy: yBot, inst, ring: ri, tNorm: t, mirror: true };
          allInstances.push(botObj);
          instancesByNode.get(nodes[i].id).push(botObj);
        }
      }
    }

    /* 3b. Project all node instances through scene camera */
    for (const inst of allInstances) {
      const ringZ = -0.7 + (inst.ring / 5) * 1.4;
      const mirrorZ = inst.mirror ? 0.18 : -0.18;
      const ghostZ = inst.inst * 0.018;
      const p = projectScenePoint(inst.wx, inst.wy, ringZ + mirrorZ + ghostZ, w, h);
      inst.x = p.x;
      inst.y = p.y;
      inst.proj = p.scale;
    }
    nodePositions.clear();
    for (const inst of allInstances) {
      if (!inst.mirror && inst.inst === 0 && !nodePositions.has(inst.nodeId)) {
        nodePositions.set(inst.nodeId, { x: inst.x, y: inst.y });
      }
    }

    /* 4. Zone parabola guidelines (top + mirrored bottom) */
    ctx.save();
    ctx.lineWidth = 0.4;
    for (let ri = 0; ri < 6; ri++) {
      if (!ringGroups[ri].length) continue;
      ctx.strokeStyle = rgba(STRAND_NEUTRAL, 0.03 + (5 - ri) * 0.006);
      const gHalf  = ZONE_SPREAD[ri] * w * 0.5;
      const gVert  = ZONE_VERTEX_Y[ri] * h;
      const gDepth = ZONE_ARC_DEPTH[ri] * h;
      const gzTop  = -0.7 + (ri / 5) * 1.4 - 0.18;
      const gzBot  = -0.7 + (ri / 5) * 1.4 + 0.18;
      ctx.beginPath();
      for (let s = 0; s <= 80; s++) {
        const gnx = ((s / 80) - 0.5) * 2;
        const gx = cx + gnx * gHalf;
        const gy = gVert + gDepth * gnx * gnx;
        const gp = projectScenePoint(gx, gy, gzTop, w, h);
        s === 0 ? ctx.moveTo(gp.x, gp.y) : ctx.lineTo(gp.x, gp.y);
      }
      ctx.stroke();
      ctx.beginPath();
      for (let s = 0; s <= 80; s++) {
        const gnx = ((s / 80) - 0.5) * 2;
        const gx = cx + gnx * gHalf;
        const gy = (h - gVert) - gDepth * gnx * gnx;
        const gp = projectScenePoint(gx, gy, gzBot, w, h);
        s === 0 ? ctx.moveTo(gp.x, gp.y) : ctx.lineTo(gp.x, gp.y);
      }
      ctx.stroke();
    }
    ctx.restore();

    /* 5. Vertical curtain strands (top drop down, bottom grow up) */
    const strandFloor   = h * 0.96;
    const strandCeiling = h * 0.04;

    ctx.save();
    ctx.lineCap = "round";
    for (const inst of allInstances) {
      const n = inst.node;
      const tc = typeColor(n.type);
      const deg = degrees[n.id] || 1;
      const primary = inst.inst === 0;
      const dir = inst.mirror ? -1 : 1;

      const baseCount = Math.max(1, Math.round(Math.sqrt(deg) * 1.6 * flowTune.strandSpread));
      const count = primary ? baseCount : Math.max(1, Math.ceil(baseCount * 0.35));
      const spread = Math.max(1.5, count * 0.9 * flowTune.strandSpread);

      const seed = hashStr(inst.nodeId + ":" + inst.inst + (inst.mirror ? ":m" : ""));
      const rn = mulberry32(seed);
      const centerFac = 1 - Math.pow((inst.tNorm - 0.5) * 2, 2);
      const maxReach = inst.mirror ? (inst.y - strandCeiling) : (strandFloor - inst.y);
      const envelopeH = maxReach * (0.25 + 0.75 * centerFac);

      for (let s = 0; s < count; s++) {
        const ct = count === 1 ? 0 : (s / (count - 1) - 0.5);
        const xOff = ct * spread + (rn() - 0.5) * flowTune.arcJitter * 0.7;
        const hVar = 0.78 + rn() * 0.22;
        const edgeNorm = Math.abs(ct) * 2;
        // As spread increases, trim the outer offsets to form a bell profile.
        const spreadBellStrength = clamp01((flowTune.strandSpread - 1.0) / 8.0);
        const bellMul = 1 - Math.pow(edgeNorm, 1.35) * (0.08 + 0.62 * spreadBellStrength);
        const sH = envelopeH * hVar * clamp(bellMul, 0.30, 1.0);
        if (sH < 5) continue;

        const sx = inst.x + xOff;
        const alphaBase = primary ? 0.26 : 0.08;

        const endY = inst.y + dir * sH;
        const grad = ctx.createLinearGradient(sx, inst.y, sx, endY);
        grad.addColorStop(0,    rgba(STRAND_NEUTRAL, alphaBase));
        grad.addColorStop(0.38, rgba(STRAND_NEUTRAL, alphaBase * 0.96));
        grad.addColorStop(0.48, rgba(lerpColor(STRAND_NEUTRAL, tc, 0.26), alphaBase * 0.78));
        grad.addColorStop(0.56, rgba(lerpColor(STRAND_NEUTRAL, tc, 0.34), alphaBase * 0.86));
        grad.addColorStop(0.64, rgba(STRAND_NEUTRAL, alphaBase * 0.94));
        grad.addColorStop(1.0,  rgba(STRAND_NEUTRAL, alphaBase * 0.80));

        ctx.beginPath();
        ctx.moveTo(sx, inst.y);
        const ws = (seed + s) * 0.0013;
        for (let seg = 1; seg <= 24; seg++) {
          const st = seg / 24;
          ctx.lineTo(sx + flowWiggle(st, ws, 0.35 + flowTune.arcJitter * 0.12), inst.y + dir * sH * st);
        }
        ctx.strokeStyle = grad;
        ctx.lineWidth = primary ? (0.30 + rn() * 0.35) : (0.18 + rn() * 0.14);
        ctx.stroke();
      }
    }
    ctx.restore();

    /* 6. Highway arc-and-tangent strands (mostly straight, few bends) */
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const edge of pipe.edges) {
      const insA = instancesByNode.get(edge.from) || [];
      const insB = instancesByNode.get(edge.to)   || [];
      if (!insA.length || !insB.length) continue;

      const style    = edge.style || "solid";
      const ek       = edgeKey(edge.from, edge.to);
      const act      = activation.get(ek);
      const edgeDash = SPEC.dash[style] || null;
      const baseAlpha = (SPEC.neutralAlpha[style] || 0.30) * 0.70;
      const htc      = typeColor(insA[0].node.type);
      const degA     = degrees[edge.from] || 1;
      const degB     = degrees[edge.to]   || 1;
      const sCount   = edgeStrandCount(style, degA, degB);
      const sSpread  = Math.max(1, sCount * 0.6);

      const topA = insA.filter(i => !i.mirror);
      const botB = insB.filter(i =>  i.mirror);

      for (const iA of topA) {
        let bestB = botB[0], bestD = Infinity;
        for (const iB of botB) {
          const d = Math.abs(iA.x - iB.x);
          if (d < bestD) { bestD = d; bestB = iB; }
        }
        if (!bestB) continue;

        const primary = iA.inst === 0;
        const alpha   = baseAlpha * (primary ? 1.0 : 0.22);
        const drawCnt = primary ? sCount : 1;

        const dy = bestB.y - iA.y;
        const dx = bestB.x - iA.x;
        const hFrac = Math.abs(dx) / Math.max(1, w * 0.5);
        const tangentFrac = clamp(0.30 + hFrac * 0.18, 0.18, 0.50);

        for (let si = 0; si < drawCnt; si++) {
          const sOff = drawCnt <= 1 ? 0 : ((si / (drawCnt - 1)) - 0.5) * sSpread;
          const lw = primary ? (0.35 + si * 0.04) : 0.22;
          const x1 = iA.x + sOff;
          const x2 = bestB.x + sOff;

          ctx.save();
          ctx.lineWidth = lw;
          if (edgeDash) ctx.setLineDash(edgeDash);

          const hasSignal = act && act.intensity > 0.01;
          if (hasSignal) {
            const hGrad = ctx.createLinearGradient(x1, iA.y, x2, bestB.y);
            const hotA = rgba(lerpColor(MAGENTA, WHITE, 0.16), alpha * (0.94 + act.intensity * 0.34));
            const hotB = rgba(lerpColor(ORANGE, WHITE, 0.12), alpha * (0.92 + act.intensity * 0.30));
            hGrad.addColorStop(0.00, rgba(STRAND_NEUTRAL, alpha * 0.65));
            hGrad.addColorStop(0.14, hotA);
            hGrad.addColorStop(0.50, hotB);
            hGrad.addColorStop(0.86, hotA);
            hGrad.addColorStop(1.00, rgba(STRAND_NEUTRAL, alpha * 0.65));
            ctx.strokeStyle = hGrad;
          } else if (htc) {
            const hGrad = ctx.createLinearGradient(x1, iA.y, x2, bestB.y);
            hGrad.addColorStop(0.00, rgba(STRAND_NEUTRAL, alpha));
            hGrad.addColorStop(0.44, rgba(STRAND_NEUTRAL, alpha * 0.95));
            hGrad.addColorStop(0.50, rgba(lerpColor(STRAND_NEUTRAL, htc, 0.28), alpha * 0.86));
            hGrad.addColorStop(0.56, rgba(STRAND_NEUTRAL, alpha * 0.95));
            hGrad.addColorStop(1.00, rgba(STRAND_NEUTRAL, alpha));
            ctx.strokeStyle = hGrad;
          } else {
            ctx.strokeStyle = rgba(STRAND_NEUTRAL, alpha);
          }

          const y1 = iA.y;
          const y2 = bestB.y;
          const bendQty = clamp(Math.round(flowTune.bendQuantity), 1, 3);
          const pathPts = buildHighwayPolyline(x1, y1, x2, y2, dx, dy, tangentFrac, bendQty);
          const filletMul = 0.25 + (flowTune.bendFillet / 20) * 1.75;
          const filletR = clamp((Math.min(Math.abs(dx), Math.abs(dy)) * 0.18 + 6) * filletMul, 2, 42);
          ctx.beginPath();
          traceFilletedPolyline(ctx, pathPts, filletR);
          ctx.stroke();

          if (hasSignal && primary) {
            ctx.save();
            ctx.globalCompositeOperation = "source-over";
            ctx.setLineDash([]);
            ctx.lineWidth = lw * 2.8;
            ctx.strokeStyle = rgba(act.signal, 0.14 + act.intensity * 0.30);
            ctx.beginPath();
            traceFilletedPolyline(ctx, pathPts, filletR);
            ctx.stroke();
            ctx.restore();
          }

          if (hasSignal && primary && act.orbActive && si === Math.floor(drawCnt / 2)) {
            const orbP = pointOnPolyline(pathPts, act.orbT);
            const orbR = 2.1 + act.intensity * 1.2;
            const glowScale = 0.65 + (flowTune.orbGlowDistance / 20) * 2.2;
            const rampR = Math.max(2.2, orbR * 2.2);
            const og = ctx.createRadialGradient(orbP.x, orbP.y, 0, orbP.x, orbP.y, rampR * glowScale);
            og.addColorStop(0.00, "rgba(255,255,255,0.98)");
            og.addColorStop(0.18, `rgba(${MAGENTA[0]},${MAGENTA[1]},${MAGENTA[2]},0.90)`);
            og.addColorStop(0.46, `rgba(255,128,96,0.72)`);
            og.addColorStop(0.75, `rgba(${ORANGE[0]},${ORANGE[1]},${ORANGE[2]},0.46)`);
            og.addColorStop(1.00, "rgba(255,116,56,0)");
            ctx.fillStyle = og;
            ctx.beginPath();
            ctx.arc(orbP.x, orbP.y, rampR * glowScale, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(orbP.x, orbP.y, orbR, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255,236,242,0.98)";
            ctx.fill();
          }
          ctx.restore();
        }
      }
    }
    ctx.restore();

    /* 7. Accent dots along curtain strands */
    ctx.save();
    const dotRng = mulberry32(genSeed ^ 0x1234);
    const dotCount = Math.min(allInstances.length * 6, 400);
    for (let di = 0; di < dotCount; di++) {
      const dInst = allInstances[Math.floor(dotRng() * allInstances.length)];
      if (!dInst) continue;
      const dPrimary = dInst.inst === 0;
      const dCenterFac = 1 - Math.pow((dInst.tNorm - 0.5) * 2, 2);
      const dDir = dInst.mirror ? -1 : 1;
      const dMaxH = (dInst.mirror ? (dInst.y - strandCeiling) : (strandFloor - dInst.y)) * (0.25 + 0.75 * dCenterFac);
      const dt = dotRng() * 0.88 + 0.05;
      const dotX = dInst.x + (dotRng() - 0.5) * flowTune.strandSpread * 2.5;
      const dotY = dInst.y + dDir * dMaxH * dt;
      const dotR = 0.5 + dotRng() * 0.9;
      const dotAlpha = dPrimary ? (0.25 + dotRng() * 0.42) : (0.06 + dotRng() * 0.10);

      ctx.beginPath();
      ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
      ctx.fillStyle = rgba(NODE_FILL, dotAlpha);
      ctx.fill();
    }
    ctx.restore();

    /* 8. Node instances (primary + ghost) */
    ctx.save();
    for (const inst of allInstances) {
      const primary = inst.inst === 0;
      const r   = nodeRadius(inst.node.ringId) * (primary ? 1.0 : 0.40);
      const col = typeColor(inst.node.type);
      const a   = primary ? 0.94 : 0.16;

      if (primary) {
        const glow = nodeGlows.get(inst.nodeId);
        if (glow && glow.intensity > 0.01) {
          const gr = ctx.createRadialGradient(inst.x, inst.y, r, inst.x, inst.y, r + 5 + glow.intensity * 6);
          gr.addColorStop(0, rgba(glow.color, 0.24 * glow.intensity));
          gr.addColorStop(1, rgba(glow.color, 0));
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.arc(inst.x, inst.y, r + 5 + glow.intensity * 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.beginPath();
      ctx.arc(inst.x, inst.y, r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(NODE_FILL, a);
      ctx.fill();

      if (primary) {
        ctx.beginPath();
        ctx.arc(inst.x, inst.y, r + 1.2, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(col, 0.68);
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }
    ctx.restore();

    /* 9. Labels (callout badges with leader lines) */
    if (showNodeLabels) {
      const fontSize = 8 / Math.max(zoom, 0.5);
      ctx.save();
      ctx.font = `${fontSize}px "IBM Plex Mono", ui-monospace, monospace`;
      const drawLabelBadge = (node, p, mirrored) => {
        const text = shortLabel(node.label, 14);
        if (!text) return;
        const r = nodeRadius(node.ringId);
        const calloutH = (14 + (hashStr(node.id) % 10)) / Math.max(zoom, 0.5);
        const lx = p.x + 2;
        const tw = ctx.measureText(text).width;
        const lPad = 3;

        ctx.strokeStyle = rgba(STRAND_NEUTRAL, 0.12);
        ctx.lineWidth = 0.4;

        if (!mirrored) {
          const ly = p.y - r - calloutH;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - r - 1);
          ctx.lineTo(lx, ly + fontSize + 1);
          ctx.stroke();

          ctx.fillStyle = rgba(BG, 0.82);
          ctx.strokeStyle = rgba(STRAND_NEUTRAL, 0.08);
          ctx.beginPath();
          ctx.roundRect(lx - lPad, ly - fontSize - 1, tw + lPad * 2, fontSize + 4, 2);
          ctx.fill();
          ctx.stroke();

          ctx.textBaseline = "bottom";
          ctx.fillStyle = rgba(STRAND_NEUTRAL, 0.55);
          ctx.fillText(text, lx, ly);
        } else {
          const ly = p.y + r + calloutH;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y + r + 1);
          ctx.lineTo(lx, ly - 1);
          ctx.stroke();

          ctx.fillStyle = rgba(BG, 0.82);
          ctx.strokeStyle = rgba(STRAND_NEUTRAL, 0.08);
          ctx.beginPath();
          ctx.roundRect(lx - lPad, ly - 1, tw + lPad * 2, fontSize + 4, 2);
          ctx.fill();
          ctx.stroke();

          ctx.textBaseline = "top";
          ctx.fillStyle = rgba(STRAND_NEUTRAL, 0.55);
          ctx.fillText(text, lx, ly + 1);
        }
      };

      for (const n of pipe.nodes) {
        const p = nodePositions.get(n.id);
        if (!p) continue;
        drawLabelBadge(n, p, false);
      }
      for (const inst of allInstances) {
        if (!inst.mirror || inst.inst !== 0) continue;
        if (inst.node.ringId !== "core" && inst.ring !== 5) continue;
        drawLabelBadge(inst.node, inst, true);
      }
      ctx.restore();
    }

    /* 10. Cascade glow labels */
    if (nodeGlows.size) {
      const nodeById = new Map(pipe.nodes.map(nn => [nn.id, nn]));
      const glowFontSize = 9 / Math.max(zoom, 0.5);
      ctx.save();
      ctx.font = `${glowFontSize}px "IBM Plex Mono", ui-monospace, monospace`;
      ctx.textBaseline = "bottom";
      for (const [nid, glow] of nodeGlows.entries()) {
        const node = nodeById.get(nid);
        if (!node) continue;
        const text = shortLabel(node.label, 14);
        if (!text) continue;
        const p = nodePositions.get(nid);
        if (!p) continue;
        const r = nodeRadius(node.ringId);
        const tx = p.x + r + 4;
        const ty = p.y - r - 2;
        const ga = 0.1 + glow.intensity * 0.85;
        ctx.lineWidth = 2;
        ctx.strokeStyle = rgba(BG, 0.7 + ga * 0.2);
        ctx.strokeText(text, tx, ty);
        ctx.fillStyle = `rgba(200,215,235,${Math.min(0.92, ga)})`;
        ctx.fillText(text, tx, ty);
      }
      ctx.restore();
    }

    /* 11. End zoom/pan transform */
    ctx.restore();

    /* 12. Grain (screen-space) */
    drawGrain();

    return running || scene3d.autoSpin;
  }

  /* ═══════════════════════════════════════════════════════
   * FALLBACK  (no pipe data — awaiting editor)
   * ═══════════════════════════════════════════════════════ */
  function drawFallback(w, h, nowMs) {
    drawFieldBackground(w, h, nowMs);
    drawGrain();
    ctx.save();
    ctx.font = '12px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillStyle = rgba(STRAND_NEUTRAL, 0.40);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Awaiting topology data\u2026", w / 2, h / 2);
    ctx.restore();
  }

  /* ═══════════════════════════════════════════════════════
   * SCENE CONTROLS  (3D rotation, spin)
   * ═══════════════════════════════════════════════════════ */
  let genSeed = (Date.now() & 0xffffffff) >>> 0;
  let lastPipeRaw = "";
  let lastSceneTickMs = performance.now();
  let sceneDragging = false;
  let dragLastX = 0;
  let dragLastY = 0;

  function tickScene(nowMs) {
    const dt = Math.max(0, nowMs - lastSceneTickMs);
    lastSceneTickMs = nowMs;
    if (scene3d.autoSpin && !sceneDragging) {
      scene3d.yaw += dt * spinDialToRadPerMs(scene3d.spinSpeed);
      if (scene3d.yaw > Math.PI * 2) scene3d.yaw -= Math.PI * 2;
      if (scene3d.yaw < -Math.PI * 2) scene3d.yaw += Math.PI * 2;
    }
  }

  function initSceneInteraction() {
    if (!canvas) return;
    canvas.addEventListener("mousedown", e => {
      if (e.button !== 0) return;
      sceneDragging = true;
      dragLastX = e.clientX;
      dragLastY = e.clientY;
    });
    window.addEventListener("mousemove", e => {
      if (!sceneDragging) return;
      const dx = e.clientX - dragLastX;
      const dy = e.clientY - dragLastY;
      dragLastX = e.clientX;
      dragLastY = e.clientY;
      scene3d.yaw += dx * 0.0045;
      scene3d.pitch = clamp(scene3d.pitch + dy * 0.0036, -1.15, 1.15);
      saveFlowTune();
      const running = render();
      if (running || scene3d.autoSpin) scheduleAnimationFrame();
    });
    window.addEventListener("mouseup", () => { sceneDragging = false; });
    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      scene3d.depth = clamp(scene3d.depth + (e.deltaY > 0 ? -0.12 : 0.12), 0, 4);
      saveFlowTune();
      const running = render();
      if (running || scene3d.autoSpin) scheduleAnimationFrame();
    }, { passive: false });
  }

  /* ═══════════════════════════════════════════════════════
   * RENDER
   * ═══════════════════════════════════════════════════════ */
  function render(nowMs) {
    if (nowMs == null) nowMs = performance.now();
    tickScene(nowMs);
    const { w, h } = resize();
    const pipe = readGenerativePipe();
    if (pipe && pipe.nodes.length && pipe.edges.length) {
      ensureScenarioButtons(pipe);
      return drawTopology(w, h, pipe, nowMs);
    }
    ensureScenarioButtons({ routes: [] });
    drawFallback(w, h, nowMs);
    return scene3d.autoSpin;
  }

  /* ═══════════════════════════════════════════════════════
   * SYNC & SCHEDULING
   * ═══════════════════════════════════════════════════════ */
  function syncFromPipe() {
    let raw = "";
    try { raw = localStorage.getItem(GENERATIVE_PIPE_KEY) || ""; } catch (_) { raw = ""; }
    if (raw !== lastPipeRaw) {
      lastPipeRaw = raw;
      const running = render();
      if (running) scheduleAnimationFrame();
    }
  }

  function scheduleAnimationFrame() {
    if (rafId) return;
    rafId = window.requestAnimationFrame(ts => {
      rafId = 0;
      const running = render(ts);
      if (running) scheduleAnimationFrame();
    });
  }

  /* ═══════════════════════════════════════════════════════
   * FLOW TUNE UI  (debug panel — bottom-right)
   * ═══════════════════════════════════════════════════════ */
  function initFlowTuneUi() {
    const style = document.createElement("style");
    style.textContent = `
      .flow-tune-toggle {
        position: fixed; right: 14px; bottom: 14px; z-index: 50;
        border: 1px solid rgba(180, 195, 215, 0.20);
        background: rgba(10, 14, 24, 0.80);
        color: rgba(180, 195, 215, 0.82);
        padding: 7px 10px; font-size: 10px; letter-spacing: 0.1em;
        text-transform: uppercase;
        font-family: "IBM Plex Mono", ui-monospace, monospace;
        border-radius: 2px; cursor: pointer;
      }
      .flow-tune-modal {
        position: fixed; right: 14px; bottom: 48px;
        width: min(300px, 82vw); z-index: 50;
        border: 1px solid rgba(180, 195, 215, 0.14);
        background: rgba(10, 14, 24, 0.94);
        color: rgba(180, 195, 215, 0.88);
        border-radius: 3px; padding: 10px 10px 9px;
        font-family: "IBM Plex Mono", ui-monospace, monospace;
        backdrop-filter: blur(8px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
      }
      .flow-tune-modal[hidden] { display: none; }
      .flow-tune-title {
        margin: 0 0 8px; font-size: 10px; text-transform: uppercase;
        letter-spacing: 0.14em; color: rgba(0, 78, 220, 0.8);
      }
      .flow-tune-row { margin-bottom: 8px; }
      .flow-tune-row label {
        display: flex; justify-content: space-between; gap: 8px;
        font-size: 10px; margin-bottom: 3px;
      }
      .flow-tune-row input[type="range"] {
        width: 100%; accent-color: #004e8c;
      }
      .flow-tune-actions { display: flex; justify-content: flex-end; }
      .flow-tune-actions button {
        border: 1px solid rgba(27, 43, 74, 0.22);
        background: rgba(255, 255, 255, 0.8);
        color: rgba(27, 43, 74, 0.88);
        padding: 5px 8px; font-size: 10px; letter-spacing: 0.08em;
        text-transform: uppercase; border-radius: 2px; cursor: pointer;
        font-family: "IBM Plex Mono", ui-monospace, monospace;
      }
    `;
    document.head.appendChild(style);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "flow-tune-toggle";
    btn.textContent = "Tune Flow";
    document.body.appendChild(btn);

    const modal = document.createElement("div");
    modal.className = "flow-tune-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <h3 class="flow-tune-title">Debug / Flow Tune</h3>
      <div class="flow-tune-row">
        <label>Arc jitter <span id="flow-val-jitter"></span></label>
        <input id="flow-jitter" type="range" min="0" max="20" step="0.01" />
      </div>
      <div class="flow-tune-row">
        <label>Arc inconsistency <span id="flow-val-inconsistency"></span></label>
        <input id="flow-inconsistency" type="range" min="0" max="20" step="0.01" />
      </div>
      <div class="flow-tune-row">
        <label>Strand spread <span id="flow-val-spread"></span></label>
        <input id="flow-spread" type="range" min="0" max="20" step="0.01" />
      </div>
      <div class="flow-tune-row">
        <label>Strand instances <span id="flow-val-instances"></span></label>
        <input id="flow-instances" type="range" min="0" max="20" step="0.01" />
      </div>
      <div class="flow-tune-row">
        <label>3D depth <span id="flow-val-depth"></span></label>
        <input id="flow-depth" type="range" min="0" max="20" step="0.01" />
      </div>
      <div class="flow-tune-row">
        <label>Perspective <span id="flow-val-perspective"></span></label>
        <input id="flow-perspective" type="range" min="0" max="20" step="0.01" />
      </div>
      <div class="flow-tune-row">
        <label>Spin speed <span id="flow-val-spinspeed"></span></label>
        <input id="flow-spinspeed" type="range" min="0" max="20" step="0.01" />
      </div>
      <div class="flow-tune-row">
        <label>Orb speed <span id="flow-val-orbspeed"></span></label>
        <input id="flow-orbspeed" type="range" min="0" max="20" step="0.01" />
      </div>
      <div class="flow-tune-row">
        <label>Orb glow distance <span id="flow-val-orbglow"></span></label>
        <input id="flow-orbglow" type="range" min="0" max="20" step="0.01" />
      </div>
      <div class="flow-tune-row">
        <label>Bend fillet <span id="flow-val-bendfillet"></span></label>
        <input id="flow-bendfillet" type="range" min="0" max="20" step="0.01" />
      </div>
      <div class="flow-tune-row">
        <label>Bend quantity <span id="flow-val-bendqty"></span></label>
        <input id="flow-bendqty" type="range" min="1" max="3" step="1" />
      </div>
      <div class="flow-tune-actions">
        <button type="button" id="flow-reset">Reset</button>
      </div>
    `;
    document.body.appendChild(modal);

    const refs = {
      jitter:       /** @type {HTMLInputElement} */ (modal.querySelector("#flow-jitter")),
      inconsistency:/** @type {HTMLInputElement} */ (modal.querySelector("#flow-inconsistency")),
      spread:       /** @type {HTMLInputElement} */ (modal.querySelector("#flow-spread")),
      instances:    /** @type {HTMLInputElement} */ (modal.querySelector("#flow-instances")),
      depth:        /** @type {HTMLInputElement} */ (modal.querySelector("#flow-depth")),
      perspective:  /** @type {HTMLInputElement} */ (modal.querySelector("#flow-perspective")),
      spinSpeed:    /** @type {HTMLInputElement} */ (modal.querySelector("#flow-spinspeed")),
      orbSpeed:     /** @type {HTMLInputElement} */ (modal.querySelector("#flow-orbspeed")),
      orbGlow:      /** @type {HTMLInputElement} */ (modal.querySelector("#flow-orbglow")),
      bendFillet:   /** @type {HTMLInputElement} */ (modal.querySelector("#flow-bendfillet")),
      bendQty:      /** @type {HTMLInputElement} */ (modal.querySelector("#flow-bendqty")),
      valJitter:       modal.querySelector("#flow-val-jitter"),
      valInconsistency:modal.querySelector("#flow-val-inconsistency"),
      valSpread:       modal.querySelector("#flow-val-spread"),
      valInstances:    modal.querySelector("#flow-val-instances"),
      valDepth:        modal.querySelector("#flow-val-depth"),
      valPerspective:  modal.querySelector("#flow-val-perspective"),
      valSpinSpeed:    modal.querySelector("#flow-val-spinspeed"),
      valOrbSpeed:     modal.querySelector("#flow-val-orbspeed"),
      valOrbGlow:      modal.querySelector("#flow-val-orbglow"),
      valBendFillet:   modal.querySelector("#flow-val-bendfillet"),
      valBendQty:      modal.querySelector("#flow-val-bendqty"),
      reset:        /** @type {HTMLButtonElement} */ (modal.querySelector("#flow-reset")),
    };

    const syncUi = () => {
      refs.jitter.value        = String(flowTune.arcJitter);
      refs.inconsistency.value = String(flowTune.arcInconsistency);
      refs.spread.value        = String(flowTune.strandSpread);
      refs.instances.value     = String(flowTune.strandInstances);
      refs.depth.value         = String(scene3d.depth);
      refs.perspective.value   = String(scene3d.perspective);
      refs.spinSpeed.value     = String(scene3d.spinSpeed);
      refs.orbSpeed.value      = String(flowTune.orbSpeed);
      refs.orbGlow.value       = String(flowTune.orbGlowDistance);
      refs.bendFillet.value    = String(flowTune.bendFillet);
      refs.bendQty.value       = String(Math.round(flowTune.bendQuantity));
      refs.valJitter.textContent        = flowTune.arcJitter.toFixed(2);
      refs.valInconsistency.textContent = flowTune.arcInconsistency.toFixed(2);
      refs.valSpread.textContent        = flowTune.strandSpread.toFixed(2);
      refs.valInstances.textContent     = flowTune.strandInstances.toFixed(2);
      refs.valDepth.textContent         = scene3d.depth.toFixed(2);
      refs.valPerspective.textContent   = scene3d.perspective.toFixed(2);
      refs.valSpinSpeed.textContent     = `${scene3d.spinSpeed.toFixed(2)} (${spinDialToRevPerSec(scene3d.spinSpeed).toFixed(2)} rps)`;
      refs.valOrbSpeed.textContent      = `${flowTune.orbSpeed.toFixed(2)} (${(orbSpeedToTravelMs(flowTune.orbSpeed) / 1000).toFixed(2)}s/edge)`;
      refs.valOrbGlow.textContent       = flowTune.orbGlowDistance.toFixed(2);
      refs.valBendFillet.textContent    = flowTune.bendFillet.toFixed(2);
      refs.valBendQty.textContent       = String(Math.round(flowTune.bendQuantity));
    };

    const onTune = () => {
      flowTune.arcJitter        = clamp(Number(refs.jitter.value) || 0, 0, 20);
      flowTune.arcInconsistency = clamp(Number(refs.inconsistency.value) || 0, 0, 20);
      flowTune.strandSpread     = clamp(Number(refs.spread.value) || 1, 0, 20);
      flowTune.strandInstances  = clamp(Number(refs.instances.value) || 1, 0, 20);
      flowTune.orbSpeed         = clamp(Number(refs.orbSpeed.value) || 0, 0, 20);
      flowTune.orbGlowDistance  = clamp(Number(refs.orbGlow.value) || 0, 0, 20);
      flowTune.bendFillet       = clamp(Number(refs.bendFillet.value) || 0, 0, 20);
      flowTune.bendQuantity     = clamp(Number(refs.bendQty.value) || 2, 1, 3);
      scene3d.depth       = clamp(Number(refs.depth.value) || 1, 0, 20);
      scene3d.perspective = clamp(Number(refs.perspective.value) || 1, 0, 20);
      scene3d.spinSpeed   = clamp(Number(refs.spinSpeed.value) || 0, 0, 20);
      syncUi();
      saveFlowTune();
      const running = render();
      if (running || scene3d.autoSpin) scheduleAnimationFrame();
    };

    refs.jitter.addEventListener("input", onTune);
    refs.inconsistency.addEventListener("input", onTune);
    refs.spread.addEventListener("input", onTune);
    refs.instances.addEventListener("input", onTune);
    refs.orbSpeed.addEventListener("input", onTune);
    refs.orbGlow.addEventListener("input", onTune);
    refs.bendFillet.addEventListener("input", onTune);
    refs.bendQty.addEventListener("input", onTune);
    refs.depth.addEventListener("input", onTune);
    refs.perspective.addEventListener("input", onTune);
    refs.spinSpeed.addEventListener("input", onTune);
    refs.reset.addEventListener("click", () => {
      flowTune.arcJitter = 0.45;
      flowTune.arcInconsistency = 0.52;
      flowTune.strandSpread = 1.35;
      flowTune.strandInstances = 1.45;
      flowTune.orbSpeed = 7.0;
      flowTune.orbGlowDistance = 6.0;
      flowTune.bendFillet = 8.0;
      flowTune.bendQuantity = 2.0;
      scene3d.depth = 1.0;
      scene3d.perspective = 0.9;
      scene3d.spinSpeed = 0.35;
      onTune();
    });

    btn.addEventListener("click", () => { modal.hidden = !modal.hidden; });
    syncUi();
  }

  /* ═══════════════════════════════════════════════════════
   * UI WIRING
   * ═══════════════════════════════════════════════════════ */
  function wireUi() {
    const spinBtn = document.getElementById("btn-spin");
    if (spinBtn) {
      spinBtn.classList.toggle("is-active", scene3d.autoSpin);
      spinBtn.addEventListener("click", () => {
        scene3d.autoSpin = !scene3d.autoSpin;
        spinBtn.classList.toggle("is-active", scene3d.autoSpin);
        saveFlowTune();
        const running = render();
        if (running || scene3d.autoSpin) scheduleAnimationFrame();
      });
    }
    const labelsBtn = document.getElementById("btn-labels");
    if (labelsBtn) {
      labelsBtn.classList.toggle("is-active", showNodeLabels);
      labelsBtn.addEventListener("click", () => {
        showNodeLabels = !showNodeLabels;
        labelsBtn.classList.toggle("is-active", showNodeLabels);
        render();
      });
    }
    document.getElementById("btn-regen")?.addEventListener("click", () => {
      genSeed = (Math.random() * 0xffffffff) >>> 0;
      render();
    });
    document.getElementById("btn-sync")?.addEventListener("click", () => {
      lastPipeRaw = "";
      const running = render();
      if (running || scene3d.autoSpin) scheduleAnimationFrame();
    });
  }

  /* ═══════════════════════════════════════════════════════
   * INIT
   * ═══════════════════════════════════════════════════════ */
  loadFlowTune();
  try { lastPipeRaw = localStorage.getItem(GENERATIVE_PIPE_KEY) || ""; } catch (_) { lastPipeRaw = ""; }
  initFlowTuneUi();
  initSceneInteraction();
  wireUi();
  if (scene3d.autoSpin) scheduleAnimationFrame();
  else render();
  window.addEventListener("resize", () => {
    const running = render();
    if (running || scene3d.autoSpin) scheduleAnimationFrame();
  });
  window.addEventListener("storage", e => {
    if (e.key === GENERATIVE_PIPE_KEY) syncFromPipe();
  });
  window.setInterval(syncFromPipe, 1200);
})();
