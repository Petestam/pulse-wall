(function () {
  "use strict";

  const canvas = document.getElementById("viz");
  const ctx = canvas.getContext("2d", { alpha: false });

  function drawPulseCanvasDotGrid(w, h, nowMs) {
    if (window.PulseCanvasDotGrid && typeof window.PulseCanvasDotGrid.draw === "function") {
      window.PulseCanvasDotGrid.draw(ctx, w, h, (nowMs || 0) * 0.001, canvas);
    }
  }

  const DEEP_BLUE = [3, 16, 52];
  const BLUE = [0, 78, 220];
  const CYAN = [0, 210, 255];
  const MID_BLUE = [12, 128, 255];
  const VIOLET = [124, 126, 255];
  const MAGENTA = [241, 0, 163];
  const ORANGE = [255, 116, 56];
  const WHITE = [240, 250, 255];
  const GENERATIVE_PIPE_KEY = "topology.generative.pipe.v1";
  const FLOW_TUNE_KEY = "topology.generative.flow.tune.v1";
  const IS_EMBED =
    typeof location !== "undefined" &&
    new URLSearchParams(location.search).get("embed") === "1";
  const TYPE_COLOR = {
    security: MID_BLUE,
    platform: CYAN,
    network: BLUE,
    endpoint: [172, 218, 255],
    external: CYAN,
    data: MID_BLUE,
    service: [70, 170, 255],
    server: [42, 118, 255],
    default: [130, 196, 255],
  };

  const flowTune = {
    arcJitter: 0.45,
    arcInconsistency: 0.52,
    strandSpread: 1.35,
    strandInstances: 1.45,
  };
  const scene3d = {
    yaw: -0.62,
    pitch: 0.3,
    depth: 1.0,
    perspective: 0.9,
    autoSpin: true,
    spinSpeed: 0.00011,
  };

  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpColor(c0, c1, t) {
    return [
      Math.round(lerp(c0[0], c1[0], t)),
      Math.round(lerp(c0[1], c1[1], t)),
      Math.round(lerp(c0[2], c1[2], t)),
    ];
  }

  function colorAtT(t) {
    if (t < 0.34) return lerpColor(DEEP_BLUE, BLUE, t / 0.34);
    if (t < 0.7) return lerpColor(BLUE, MID_BLUE, (t - 0.34) / 0.36);
    return lerpColor(MID_BLUE, CYAN, (t - 0.7) / 0.3);
  }

  function ciscoColorAtT(t) {
    const x = ((t % 1) + 1) % 1;
    if (x < 0.25) return lerpColor(BLUE, CYAN, x / 0.25);
    if (x < 0.5) return lerpColor(CYAN, VIOLET, (x - 0.25) / 0.25);
    if (x < 0.75) return lerpColor(VIOLET, MAGENTA, (x - 0.5) / 0.25);
    return lerpColor(MAGENTA, ORANGE, (x - 0.75) / 0.25);
  }

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ""));
    if (!m) return null;
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  }

  function scenarioColorForIndex(ix, palette) {
    const fallback = [
      [34, 211, 238],
      [167, 139, 250],
      [244, 114, 182],
      [251, 191, 36],
    ];
    const source = Array.isArray(palette) && palette.length ? palette : [];
    const entry = source[ix % Math.max(1, source.length)];
    const rgb = hexToRgb(entry);
    return rgb || fallback[ix % fallback.length];
  }

  function rgba(arr, a) {
    return `rgba(${arr[0]},${arr[1]},${arr[2]},${a})`;
  }

  /** Layered sines → smooth organic wiggle along parameter u ∈ [0,1]. */
  function flowWiggle(u, seed, amp) {
    const s = seed * 17.13;
    return (
      Math.sin(u * Math.PI * 4 + s) * 0.38 +
      Math.sin(u * Math.PI * 9 + s * 1.7) * 0.28 +
      Math.sin(u * Math.PI * 17 + s * 0.4) * 0.18 +
      Math.sin(u * Math.PI * 31 + s * 2.2) * 0.12
    ) * amp;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width || window.innerWidth || 1));
    const h = Math.max(1, Math.round(rect.height || window.innerHeight || 1));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h, dpr };
  }

  function readGenerativePipe() {
    try {
      const raw = localStorage.getItem(GENERATIVE_PIPE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) return null;
      return data;
    } catch (_) {
      return null;
    }
  }

  function typeColor(type) {
    return TYPE_COLOR[type] || TYPE_COLOR.default;
  }

  function nodeDepth(n) {
    const ringDepth = {
      external: -0.9,
      "enterprise-edge": -0.58,
      "network-enforcement": -0.24,
      application: 0.04,
      "soc-platform": 0.34,
      core: 0.68,
    };
    const base = ringDepth[n.ringId] != null ? ringDepth[n.ringId] : 0;
    const h = hashStr(`${n.id || ""}|${n.ringId || ""}`);
    const jitter = (((h % 1000) / 1000) - 0.5) * 0.28;
    return (base + jitter) * scene3d.depth;
  }

  function mapPipePoint(n, w, h, view) {
    const vw = view?.width || 120;
    const vh = view?.height || 50;
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
    const vh = view?.height || 50;
    const marginX = w * 0.11;
    const marginY = h * 0.12;
    return {
      x: marginX + (Math.max(0, Math.min(vw, Number(vx) || 0)) / vw) * (w - marginX * 2),
      y: marginY + (Math.max(0, Math.min(vh, Number(vy) || 0)) / vh) * (h - marginY * 2),
    };
  }

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    return h >>> 0;
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function shortLabel(s, max = 20) {
    const t = String(s || "").trim();
    if (!t) return "";
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
  }

  function loadFlowTune() {
    try {
      const raw = localStorage.getItem(FLOW_TUNE_KEY);
      if (!raw) return;
      const x = JSON.parse(raw);
      if (!x || typeof x !== "object") return;
      if (typeof x.arcJitter === "number") flowTune.arcJitter = clamp(x.arcJitter, 0, 20);
      if (typeof x.arcInconsistency === "number") {
        flowTune.arcInconsistency = clamp(x.arcInconsistency, 0, 20);
      }
      if (typeof x.strandSpread === "number") flowTune.strandSpread = clamp(x.strandSpread, 0, 20);
      if (typeof x.strandInstances === "number") {
        flowTune.strandInstances = clamp(x.strandInstances, 0, 20);
      }
      if (!IS_EMBED) {
        if (typeof x.yaw === "number") scene3d.yaw = clamp(x.yaw, -20, 20);
        if (typeof x.pitch === "number") scene3d.pitch = clamp(x.pitch, -20, 20);
        if (typeof x.depth === "number") scene3d.depth = clamp(x.depth, 0, 20);
        if (typeof x.perspective === "number") {
          scene3d.perspective = clamp(x.perspective, 0, 20);
        }
        if (typeof x.autoSpin === "boolean") scene3d.autoSpin = x.autoSpin;
        if (typeof x.spinSpeed === "number") {
          scene3d.spinSpeed = clamp(x.spinSpeed, 0, 20);
        }
      }
    } catch (_) {
      /* ignore */
    }
  }

  function saveFlowTune() {
    try {
      if (IS_EMBED) {
        let prev = {};
        try {
          const raw = localStorage.getItem(FLOW_TUNE_KEY);
          if (raw) prev = JSON.parse(raw) || {};
        } catch (_) {}
        localStorage.setItem(
          FLOW_TUNE_KEY,
          JSON.stringify({ ...prev, ...flowTune })
        );
      } else {
        localStorage.setItem(
          FLOW_TUNE_KEY,
          JSON.stringify({
            ...flowTune,
            yaw: scene3d.yaw,
            pitch: scene3d.pitch,
            depth: scene3d.depth,
            perspective: scene3d.perspective,
            autoSpin: scene3d.autoSpin,
            spinSpeed: scene3d.spinSpeed,
          })
        );
      }
    } catch (_) {
      /* ignore */
    }
  }

  function pulseEnvelope(msSinceArrival) {
    const FADE_IN = 260;
    const HOLD = 420;
    const FADE_OUT = 900;
    if (msSinceArrival < 0) return 0;
    if (msSinceArrival < FADE_IN) return msSinceArrival / FADE_IN;
    if (msSinceArrival < FADE_IN + HOLD) return 1;
    if (msSinceArrival < FADE_IN + HOLD + FADE_OUT) {
      const x = (msSinceArrival - FADE_IN - HOLD) / FADE_OUT;
      return 1 - x;
    }
    return 0;
  }

  function drawPipeBackdrop(w, h, pipe) {
    const display = pipe.display || {};
    const view = pipe.view || { width: 120, height: 50 };
    const vw = view.width || 120;
    const vh = view.height || 50;
    const marginX = w * 0.11;
    const marginY = h * 0.12;
    const innerW = w - marginX * 2;
    const innerH = h - marginY * 2;

    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    if (display.showTrustZones && Array.isArray(pipe.zoneHalos)) {
      for (const zone of pipe.zoneHalos) {
        const members = pipe.nodes.filter((n) => n.ringId === zone.ringId);
        if (!members.length) continue;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const n of members) {
          const nx = Number(n.x) || 0;
          const ny = Number(n.y) || 0;
          if (nx < minX) minX = nx;
          if (ny < minY) minY = ny;
          if (nx > maxX) maxX = nx;
          if (ny > maxY) maxY = ny;
        }
        const pad = Number(zone.padding) || 1.3;
        const x0 = minX - pad;
        const y0 = minY - pad;
        const zw = maxX - minX + pad * 2;
        const zh = maxY - minY + pad * 2;
        const p0 = mapViewToCanvas(x0, y0, w, h, view);
        const p1 = mapViewToCanvas(x0 + zw, y0 + zh, w, h, view);
        const rxUnits = Number(zone.rx) || 1.2;
        const rr = Math.max(2, rxUnits * Math.min(innerW / vw, innerH / vh));
        ctx.fillStyle = "rgba(0, 152, 255, 0.018)";
        ctx.strokeStyle = "rgba(0, 210, 255, 0.07)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.roundRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y, rr);
        ctx.fill();
        ctx.stroke();
      }
    }

    if (display.showGrid) {
      const cols = 12;
      const rows = 6;
      ctx.strokeStyle = "rgba(112, 178, 255, 0.05)";
      ctx.lineWidth = 0.65;
      for (let i = 0; i <= cols; i++) {
        const x = marginX + (innerW * i) / cols;
        ctx.beginPath();
        ctx.moveTo(x, marginY);
        ctx.lineTo(x, marginY + innerH);
        ctx.stroke();
      }
      for (let j = 0; j <= rows; j++) {
        const y = marginY + (innerH * j) / rows;
        ctx.beginPath();
        ctx.moveTo(marginX, y);
        ctx.lineTo(marginX + innerW, y);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function nodeRadiusByType(type) {
    switch (type) {
      case "external":
        return 4.6;
      case "platform":
        return 4.2;
      case "data":
        return 3.8;
      case "security":
      case "server":
        return 3.3;
      case "network":
      case "service":
        return 3.1;
      default:
        return 2.9;
    }
  }

  let showNodeLabels = false;

  function drawPipeNodes(w, h, pipe) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    for (const n of pipe.nodes) {
      const p = mapPipePoint(n, w, h, pipe.view);
      const coreR = nodeRadiusByType(n.type);
      const gap = 1.45;
      const ringWidth = 1.15;
      const col = typeColor(n.type);
      const ringGrad = ctx.createLinearGradient(
        p.x - coreR - gap,
        p.y - coreR - gap,
        p.x + coreR + gap,
        p.y + coreR + gap
      );
      ringGrad.addColorStop(0, rgba(lerpColor(col, BLUE, 0.45), 0.95));
      ringGrad.addColorStop(1, rgba(lerpColor(col, CYAN, 0.45), 0.92));

      ctx.beginPath();
      ctx.arc(p.x, p.y, coreR, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(6, 12, 20, 0.96)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p.x, p.y, coreR + gap, 0, Math.PI * 2);
      ctx.strokeStyle = ringGrad;
      ctx.lineWidth = ringWidth;
      ctx.stroke();
    }
    ctx.restore();

    if (showNodeLabels) {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.font = '10px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textBaseline = "middle";
      for (const n of pipe.nodes) {
        const p = mapPipePoint(n, w, h, pipe.view);
        const coreR = nodeRadiusByType(n.type);
        const text = shortLabel(n.label, 18);
        if (!text) continue;
        const tx = p.x + coreR + 5;
        const ty = p.y - coreR - 1;
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = "rgba(4, 16, 36, 0.85)";
        ctx.strokeText(text, tx, ty);
        ctx.fillStyle = "rgba(182, 225, 255, 0.78)";
        ctx.fillText(text, tx, ty);
      }
      ctx.restore();
    }
  }

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
      Math.min(len * 0.22, 64) *
      (0.28 + ((h % 1000) / 1000) * (0.34 + varAmt * 0.16)) *
      sign;
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

  function strokeQuadraticWindow(p0, c, p1, t0, t1, strokeStyle, lineWidth, alpha) {
    const a = clamp01(Math.min(t0, t1));
    const b = clamp01(Math.max(t0, t1));
    if (b - a < 0.002 || alpha <= 0.001) return;
    const steps = Math.max(10, Math.ceil((b - a) * 52));
    const s = quadPoint(p0, c, p1, a);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    for (let i = 1; i <= steps; i++) {
      const t = a + (b - a) * (i / steps);
      const p = quadPoint(p0, c, p1, t);
      ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
  }

  const CHASE_SPEED_PX_PER_MS = 0.12;
  const CHASE_PRELIGHT_MS = 760;
  const CHASE_TAIL_DECAY_MS = 2200;
  const CHASE_NODE_GLOW_WINDOW_MS = 1750;
  let activeChases = [];
  let scenarioSignature = "";
  let rafId = 0;

  function updateScenarioButtonsActive() {
    document.querySelectorAll(".scenario-btn").forEach((el) => {
      const rid = el.getAttribute("data-route-id");
      const on = activeChases.some((c) => c.routeId === rid);
      el.classList.toggle("is-active", on);
    });
  }

  function ensureScenarioButtons(pipe) {
    const host = document.getElementById("scenario-buttons");
    if (!host) return;
    const routes = Array.isArray(pipe?.routes) ? pipe.routes : [];
    const sig = routes.map((r) => r.id).join("|");
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

  function estimateQuadraticLength(p0, c, p1, steps = 22) {
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

  function buildRouteTrack(route, nodeById, w, h, view) {
    const segments = [];
    const nodeArrivalMs = new Array(route.nodes.length).fill(0);
    let cumulative = 0;
    for (let i = 0; i < route.nodes.length - 1; i++) {
      const a = nodeById.get(route.nodes[i]);
      const b = nodeById.get(route.nodes[i + 1]);
      if (!a || !b) {
        nodeArrivalMs[i + 1] = cumulative;
        continue;
      }
      const p0 = mapPipePoint(a, w, h, view);
      const p1 = mapPipePoint(b, w, h, view);
      const c = buildChaseCurve(p0, p1, `${route.id}:${i}`);
      const lengthPx = Math.max(12, estimateQuadraticLength(p0, c, p1));
      const durationMs = lengthPx / CHASE_SPEED_PX_PER_MS;
      const seg = {
        i,
        p0,
        p1,
        c,
        startMs: cumulative,
        durationMs,
        endMs: cumulative + durationMs,
      };
      cumulative = seg.endMs;
      segments.push(seg);
      nodeArrivalMs[i + 1] = cumulative;
    }
    return { segments, nodeArrivalMs, totalTravelMs: cumulative };
  }

  function drawScenarioChase(w, h, pipe, nowMs) {
    const nodeById = new Map(pipe.nodes.map((n) => [n.id, n]));
    const routes = Array.isArray(pipe.routes) ? pipe.routes : [];
    const palette = Array.isArray(pipe.routeColors) ? pipe.routeColors : [];
    if (!routes.length || !activeChases.length) return false;
    const labelPulseByNodeId = new Map();

    const survivors = [];
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const chase of activeChases) {
      const routeIndex = routes.findIndex((r) => r.id === chase.routeId);
      const route = routeIndex >= 0 ? routes[routeIndex] : null;
      if (!route || !Array.isArray(route.nodes) || route.nodes.length < 2) continue;
      const activeCol = scenarioColorForIndex(routeIndex, palette);
      const track = buildRouteTrack(route, nodeById, w, h, pipe.view);
      const segmentCount = track.segments.length;
      if (!segmentCount) continue;
      const elapsed = nowMs - chase.startedAt;
      const prelightProgress = clamp01(elapsed / CHASE_PRELIGHT_MS);
      const travelElapsed = Math.max(0, elapsed - CHASE_PRELIGHT_MS);
      const totalMs = CHASE_PRELIGHT_MS + track.totalTravelMs + CHASE_TAIL_DECAY_MS * 0.5;
      if (elapsed > totalMs) continue;
      survivors.push(chase);
      const routeTailDecay = Math.exp(
        -Math.max(0, travelElapsed - track.totalTravelMs) / CHASE_TAIL_DECAY_MS
      );

      for (const seg of track.segments) {
        const { i, p0, p1, c } = seg;
        const t = (travelElapsed - seg.startMs) / seg.durationMs;
        const fullGrad = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
        fullGrad.addColorStop(0, rgba(lerpColor(activeCol, DEEP_BLUE, 0.22), 0.24));
        fullGrad.addColorStop(0.5, rgba(activeCol, 0.38));
        fullGrad.addColorStop(1, rgba(lerpColor(activeCol, DEEP_BLUE, 0.22), 0.28));

        const fullGradCore = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
        fullGradCore.addColorStop(0, rgba(lerpColor(activeCol, WHITE, 0.18), 0.62));
        fullGradCore.addColorStop(0.5, rgba(lerpColor(activeCol, WHITE, 0.28), 0.88));
        fullGradCore.addColorStop(1, rgba(lerpColor(activeCol, WHITE, 0.18), 0.68));
        strokeQuadraticWindow(
          p0,
          c,
          p1,
          0,
          1,
          fullGrad,
          8.8,
          (0.04 + 0.22 * prelightProgress) * routeTailDecay
        );
        strokeQuadraticWindow(
          p0,
          c,
          p1,
          0,
          1,
          fullGrad,
          4.8,
          (0.08 + 0.26 * prelightProgress) * routeTailDecay
        );
        strokeQuadraticWindow(
          p0,
          c,
          p1,
          0,
          1,
          fullGradCore,
          2.6,
          (0.16 + 0.52 * prelightProgress) * routeTailDecay
        );
        if (t <= 0) continue;
        const activeT = clamp01(t);

        const age = Math.max(0, t - 1);
        const decay = Math.exp(-age * 0.82);
        const headT = t <= 1 ? activeT : 1;
        const tightSpan = 0.14;
        const softSpan = 0.46;
        const tightTail = Math.max(0, headT - tightSpan);
        const softTail = Math.max(0, headT - softSpan);
        const tailStart = quadPoint(p0, c, p1, tightTail);
        const tailHead = quadPoint(p0, c, p1, headT);
        const phase = nowMs * 0.00022 + i * 0.073;

        const tailGrad = ctx.createLinearGradient(
          tailStart.x,
          tailStart.y,
          tailHead.x,
          tailHead.y
        );
        tailGrad.addColorStop(0, rgba(ciscoColorAtT(phase + 0.0), 0.06));
        tailGrad.addColorStop(0.28, rgba(ciscoColorAtT(phase + 0.25), 0.26));
        tailGrad.addColorStop(0.62, rgba(ciscoColorAtT(phase + 0.62), 0.54));
        tailGrad.addColorStop(0.86, rgba(ciscoColorAtT(phase + 0.86), 0.78));
        tailGrad.addColorStop(1, rgba(ciscoColorAtT(phase + 1.0), 0.9));

        const tailGlow = ctx.createLinearGradient(
          tailStart.x,
          tailStart.y,
          tailHead.x,
          tailHead.y
        );
        tailGlow.addColorStop(0, rgba(ciscoColorAtT(phase + 0.0), 0.0));
        tailGlow.addColorStop(0.45, rgba(ciscoColorAtT(phase + 0.5), 0.12));
        tailGlow.addColorStop(1, rgba(ciscoColorAtT(phase + 1.0), 0.34));

        const tailAura = ctx.createLinearGradient(
          tailStart.x,
          tailStart.y,
          tailHead.x,
          tailHead.y
        );
        tailAura.addColorStop(0, rgba(ciscoColorAtT(phase + 0.0), 0.0));
        tailAura.addColorStop(0.6, rgba(ciscoColorAtT(phase + 0.5), 0.05));
        tailAura.addColorStop(1, rgba(ciscoColorAtT(phase + 1.0), 0.12));

        strokeQuadraticWindow(
          p0,
          c,
          p1,
          softTail,
          headT,
          tailAura,
          9.8,
          (0.012 + 0.06 * decay) * clamp01((headT - softTail) / softSpan)
        );

        strokeQuadraticWindow(
          p0,
          c,
          p1,
          softTail,
          headT,
          tailGlow,
          5.4,
          (0.018 + 0.085 * decay) * clamp01((headT - softTail) / softSpan)
        );
        strokeQuadraticWindow(
          p0,
          c,
          p1,
          tightTail,
          headT,
          tailGrad,
          2.25,
          (0.22 + 0.66 * decay) * clamp01((headT - tightTail) / tightSpan)
        );

        if (t >= 0 && t <= 1.55) {
          const head = quadPoint(p0, c, p1, activeT);
          const pulse = 0.62 + 0.38 * Math.sin(activeT * Math.PI);
          const headCol = ciscoColorAtT(phase + 1.0);
          const headDecay = Math.exp(-Math.max(0, t - 1) * 0.95);
          const dx = p1.x - p0.x;
          const dy = p1.y - p0.y;
          const len = Math.hypot(dx, dy) || 1;
          const tx = dx / len;
          const ty = dy / len;
          const nx = -ty;
          const ny = tx;
          const stretch = 14 + 10 * pulse;
          const spread = 10 + 9 * pulse;
          const core = 6 + 4 * pulse;

          const blob = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, stretch);
          blob.addColorStop(0, rgba(lerpColor(headCol, WHITE, 0.42), 0.16 * headDecay));
          blob.addColorStop(0.35, rgba(lerpColor(headCol, CYAN, 0.25), 0.12 * headDecay));
          blob.addColorStop(1, rgba(headCol, 0));
          ctx.globalAlpha = 1;
          ctx.fillStyle = blob;
          ctx.fillRect(head.x - stretch, head.y - stretch, stretch * 2, stretch * 2);

          const smear = ctx.createRadialGradient(
            head.x + tx * 2.5,
            head.y + ty * 2.5,
            0,
            head.x + tx * 2.5,
            head.y + ty * 2.5,
            spread
          );
          smear.addColorStop(0, rgba(lerpColor(headCol, WHITE, 0.3), 0.11 * headDecay));
          smear.addColorStop(0.45, rgba(headCol, 0.07 * headDecay));
          smear.addColorStop(1, rgba(headCol, 0));
          ctx.fillStyle = smear;
          ctx.fillRect(head.x - spread, head.y - spread, spread * 2, spread * 2);

          const haze = ctx.createRadialGradient(
            head.x + nx * 1.8,
            head.y + ny * 1.8,
            0,
            head.x + nx * 1.8,
            head.y + ny * 1.8,
            core
          );
          haze.addColorStop(0, rgba(lerpColor(headCol, WHITE, 0.5), 0.09 * headDecay));
          haze.addColorStop(1, rgba(headCol, 0));
          ctx.fillStyle = haze;
          ctx.fillRect(head.x - core, head.y - core, core * 2, core * 2);
        }
      }

      for (let i = 0; i < route.nodes.length; i++) {
        const n = nodeById.get(route.nodes[i]);
        if (!n) continue;
        const p = mapPipePoint(n, w, h, pipe.view);
        const arrivalMs = track.nodeArrivalMs[i] || 0;
        const dt = Math.abs(travelElapsed - arrivalMs);
        const k = clamp01(1 - dt / CHASE_NODE_GLOW_WINDOW_MS);
        if (k <= 0) continue;
        const col = ciscoColorAtT(i / Math.max(1, route.nodes.length - 1));
        ctx.globalAlpha = 1;
        ctx.fillStyle = rgba(col, 0.09 + k * 0.24);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.1 + 4.7 * k, 0, Math.PI * 2);
        ctx.fill();

        const msSinceArrival = travelElapsed - arrivalMs;
        const lp = pulseEnvelope(msSinceArrival);
        if (lp > 0) {
          const prev = labelPulseByNodeId.get(n.id) || 0;
          if (lp > prev) labelPulseByNodeId.set(n.id, lp);
        }
      }
    }

    ctx.restore();

    if (labelPulseByNodeId.size) {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.font = '10px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textBaseline = "middle";
      for (const [nodeId, pulse] of labelPulseByNodeId.entries()) {
        const node = nodeById.get(nodeId);
        if (!node) continue;
        const text = shortLabel(node.label, 18);
        if (!text) continue;
        const p = mapPipePoint(node, w, h, pipe.view);
        const r = nodeRadiusByType(node.type);
        const tx = p.x + r + 5;
        const ty = p.y - r - 1;
        const a = 0.08 + pulse * 0.88;
        ctx.lineWidth = 2.8;
        ctx.strokeStyle = `rgba(4,16,36,${Math.min(0.92, 0.25 + a * 0.75)})`;
        ctx.strokeText(text, tx, ty);
        ctx.fillStyle = `rgba(196,235,255,${Math.min(0.98, a)})`;
        ctx.fillText(text, tx, ty);
      }
      ctx.restore();
    }

    activeChases = survivors;
    updateScenarioButtonsActive();
    return survivors.length > 0;
  }

  function drawPipeRadial(w, h, seed, pipe) {
    const rand = mulberry32(seed);
    const nodeById = new Map(pipe.nodes.map((n) => [n.id, n]));
    const edgeCount = Math.max(1, pipe.edges.length);

    ctx.fillStyle = "rgb(7,24,45)";
    ctx.fillRect(0, 0, w, h);
    drawPulseCanvasDotGrid(w, h, performance.now());
    drawPipeBackdrop(w, h, pipe);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (let i = 0; i < pipe.edges.length; i++) {
      const edge = pipe.edges[i];
      const a = nodeById.get(edge.from);
      const b = nodeById.get(edge.to);
      if (!a || !b) continue;
      const p0 = mapPipePoint(a, w, h, pipe.view);
      const p1 = mapPipePoint(b, w, h, pipe.view);
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2;
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const baseBend =
        Math.min(len * 0.24, Math.min(w, h) * 0.12) * (0.55 + rand() * 0.85);
      const bendNoise = (rand() - 0.5) * 2 * Math.min(len * 0.18, 10) * flowTune.arcInconsistency;
      const bend = baseBend + bendNoise;
      const jitterMag = Math.min(len * 0.08, 14) * flowTune.arcJitter;
      const c1x = p0.x + dx * 0.28 + nx * bend + (rand() - 0.5) * 2 * jitterMag;
      const c1y = p0.y + dy * 0.28 + ny * bend + (rand() - 0.5) * 2 * jitterMag;
      const c2x = p0.x + dx * 0.72 + nx * bend + (rand() - 0.5) * 2 * jitterMag;
      const c2y = p0.y + dy * 0.72 + ny * bend + (rand() - 0.5) * 2 * jitterMag;

      const col0 = typeColor(a.type);
      const col1 = typeColor(b.type);
      const g = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
      g.addColorStop(0, rgba(lerpColor(col0, DEEP_BLUE, 0.35), 0.18));
      g.addColorStop(0.45, rgba(MID_BLUE, 0.19));
      g.addColorStop(1, rgba(lerpColor(col1, CYAN, 0.2), 0.22));

      const bundles = Math.max(
        2,
        Math.round((4 + Math.min(8, Math.floor(26 / Math.sqrt(edgeCount)))) * flowTune.strandInstances)
      );
      for (let k = 0; k < bundles; k++) {
        const t = k / Math.max(1, bundles - 1) - 0.5;
        const spread = (0.4 + rand() * 0.7) * t * 8 * flowTune.strandSpread;
        const spreadJitter = (rand() - 0.5) * 2 * 1.2 * flowTune.arcJitter;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.bezierCurveTo(
          c1x + nx * (spread + spreadJitter),
          c1y + ny * (spread + spreadJitter),
          c2x + nx * (spread - spreadJitter),
          c2y + ny * (spread - spreadJitter),
          p1.x,
          p1.y
        );
        ctx.strokeStyle = g;
        ctx.lineWidth = 0.45 + rand() * 0.45;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      if (i % 2 === 0) {
        ctx.fillStyle = rgba(lerpColor(col0, col1, 0.5), 0.16);
        ctx.beginPath();
        ctx.arc(mx, my, 0.8 + rand() * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
    drawPipeNodes(w, h, pipe);
  }

  function drawPipeComet(w, h, seed, pipe) {
    const rand = mulberry32(seed);
    const nodeById = new Map(pipe.nodes.map((n) => [n.id, n]));
    const spineX = w * 0.86;
    const centerY = h * 0.5;

    ctx.fillStyle = "rgb(7,24,45)";
    ctx.fillRect(0, 0, w, h);
    drawPulseCanvasDotGrid(w, h, performance.now());
    drawPipeBackdrop(w, h, pipe);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const edge of pipe.edges) {
      const a = nodeById.get(edge.from);
      const b = nodeById.get(edge.to);
      if (!a || !b) continue;
      const pa = mapPipePoint(a, w, h, pipe.view);
      const pb = mapPipePoint(b, w, h, pipe.view);
      const left = pa.x < pb.x ? pa : pb;
      const right = pa.x < pb.x ? pb : pa;
      const sourceY = centerY + (right.y - centerY) * 0.45 + (rand() - 0.5) * h * 0.03;
      const startX = Math.max(spineX - w * 0.04, right.x);
      const colA = typeColor(a.type);
      const colB = typeColor(b.type);
      const g = ctx.createLinearGradient(startX, sourceY, left.x, left.y);
      g.addColorStop(0, rgba(CYAN, 0.16));
      g.addColorStop(0.45, rgba(lerpColor(colA, MID_BLUE, 0.5), 0.16));
      g.addColorStop(1, rgba(lerpColor(colB, BLUE, 0.4), 0.14));
      const strandCount = Math.max(1, Math.round(1 + flowTune.strandInstances * 2.2));
      for (let s = 0; s < strandCount; s++) {
        const t = strandCount === 1 ? 0 : s / (strandCount - 1) - 0.5;
        const fanBase = (rand() - 0.5) * h * 0.06;
        const fanSpread = t * h * 0.05 * flowTune.strandSpread;
        const fan = fanBase + fanSpread;
        const jitter = (rand() - 0.5) * 2 * h * 0.02 * flowTune.arcJitter;
        const bendBias = (rand() - 0.5) * 2 * w * 0.035 * flowTune.arcInconsistency;
        ctx.beginPath();
        ctx.moveTo(startX, sourceY + fan * 0.15);
        ctx.quadraticCurveTo(
          (startX + left.x) / 2 + w * 0.05 + bendBias,
          (sourceY + left.y) / 2 + fan + jitter,
          left.x,
          left.y
        );
        ctx.strokeStyle = g;
        ctx.lineWidth = (0.42 + rand() * 0.38) * (0.9 + 0.18 * (1 - Math.abs(t)));
        ctx.lineCap = "round";
        ctx.stroke();
      }
    }

    for (let i = 0; i < pipe.nodes.length * 8; i++) {
      const n = pipe.nodes[i % pipe.nodes.length];
      const p = mapPipePoint(n, w, h, pipe.view);
      const x = spineX + (rand() - 0.5) * w * 0.025;
      const y = centerY + (p.y - centerY) * 0.9 + (rand() - 0.5) * h * 0.02;
      ctx.fillStyle = rgba(lerpColor(CYAN, WHITE, rand()), 0.08 + rand() * 0.12);
      ctx.beginPath();
      ctx.arc(x, y, 0.35 + rand() * 1.05, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    drawPipeNodes(w, h, pipe);
  }

  function drawRadial(w, h, seed) {
    const rand = mulberry32(seed);
    const cx = w * 0.5 + (rand() - 0.5) * w * 0.04;
    const cy = h * 0.48 + (rand() - 0.5) * h * 0.06;
    const scale = Math.min(w, h);
    const innerR = scale * (0.06 + rand() * 0.02);
    const outerR = scale * (0.42 + rand() * 0.06);

    const petals = 9 + Math.floor(rand() * 4);
    const strandsPerPetal = 55 + Math.floor(rand() * 35);
    const steps = 56;

    ctx.fillStyle = "rgb(7,24,45)";
    ctx.fillRect(0, 0, w, h);
    drawPulseCanvasDotGrid(w, h, performance.now());

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (let p = 0; p < petals; p++) {
      const petalBase = (p / petals) * Math.PI * 2 + rand() * 0.4;
      const petalWidth = 0.35 + rand() * 0.25;

      for (let s = 0; s < strandsPerPetal; s++) {
        const strandSeed = seed + p * 10000 + s * 97;
        const r0 = mulberry32(strandSeed);
        const angleJitter = (r0() - 0.5) * petalWidth * 0.9;
        const baseAngle = petalBase + angleJitter;
        const amp = scale * 0.022 * (0.6 + r0() * 0.8);

        const pts = [];
        for (let i = 0; i <= steps; i++) {
          const u = i / steps;
          const ease = u * u * (3 - 2 * u);
          const r = innerR + (outerR - innerR) * Math.pow(ease, 0.88 + r0() * 0.08);
          const wob = flowWiggle(u, strandSeed * 0.001, petalWidth * 0.55);
          const theta = baseAngle + wob + Math.sin(u * Math.PI + petalBase) * petalWidth * 0.12;
          const x0 = cx + Math.cos(theta) * r;
          const y0 = cy + Math.sin(theta) * r;
          const tx = -Math.sin(theta);
          const ty = Math.cos(theta);
          const perp = flowWiggle(u * 1.3, strandSeed * 0.002, amp * (1 - u * 0.35));
          pts.push({ x: x0 + tx * perp, y: y0 + ty * perp });
        }

        const g = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[pts.length - 1].x, pts[pts.length - 1].y);
        g.addColorStop(0, rgba(colorAtT(0), 0.22));
        g.addColorStop(0.35, rgba(colorAtT(0.38), 0.35));
        g.addColorStop(0.62, rgba(colorAtT(0.62), 0.4));
        g.addColorStop(1, rgba(colorAtT(0.95), 0.28));

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = g;
        ctx.lineWidth = 0.55 + r0() * 0.35;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
      }
    }

    ctx.restore();

    /* Inner ring haze */
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const ringCount = 420;
    for (let i = 0; i < ringCount; i++) {
      const a = (i / ringCount) * Math.PI * 2 + rand() * 0.2;
      const jr = innerR * (0.85 + rand() * 0.35);
      const x = cx + Math.cos(a) * jr;
      const y = cy + Math.sin(a) * jr;
      const col = rgba(lerpColor(CYAN, WHITE, rand() * 0.5), 0.08 + rand() * 0.12);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, 0.4 + rand() * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    /* Outer particle mist */
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const mist = 380;
    for (let i = 0; i < mist; i++) {
      const a = rand() * Math.PI * 2;
      const rr = outerR * (0.92 + rand() * 0.14);
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      ctx.fillStyle = rgba(lerpColor(WHITE, CYAN, rand()), 0.04 + rand() * 0.1);
      ctx.beginPath();
      ctx.arc(x, y, 0.25 + rand() * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    /* Central void */
    const voidGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR * 1.15);
    voidGrad.addColorStop(0, "rgba(0,0,0,0.92)");
    voidGrad.addColorStop(0.7, "rgba(3,6,13,0.55)");
    voidGrad.addColorStop(1, "rgba(3,6,13,0)");
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = voidGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, innerR * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawComet(w, h, seed) {
    const rand = mulberry32(seed);
    const spineX = w * 0.88 + (rand() - 0.5) * w * 0.02;
    const midY = h * 0.5;

    ctx.fillStyle = "rgb(7,24,45)";
    ctx.fillRect(0, 0, w, h);
    drawPulseCanvasDotGrid(w, h, performance.now());

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const lines = 2200;
    for (let i = 0; i < lines; i++) {
      const lineSeed = seed + i * 2654435761;
      const r = mulberry32(lineSeed);

      const gauss = () => {
        let s = 0;
        for (let k = 0; k < 6; k++) s += r() - 0.5;
        return s / 3;
      };

      const y0 = midY + gauss() * h * 0.42;
      const x0 = spineX + (r() - 0.5) * w * 0.04;
      const reach = 0.15 + r() * 0.78;
      const x1 = r() * w * reach;
      const fan = (1 - x1 / w) * h * 0.48;
      const y1 = midY + (r() - 0.5) * fan * 2;

      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      const nx0 = x0 / w;
      const nx1 = x1 / w;
      g.addColorStop(0, rgba(CYAN, 0.12 + r() * 0.1));
      g.addColorStop(lerp(0.15, 0.45, nx0 * 0.5), rgba(MID_BLUE, 0.14 + r() * 0.08));
      g.addColorStop(lerp(0.4, 0.72, nx1), rgba(BLUE, 0.12 + r() * 0.1));
      g.addColorStop(1, rgba(DEEP_BLUE, 0.06 + r() * 0.06));

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      if (r() > 0.72) {
        const mx = (x0 + x1) / 2 + (r() - 0.5) * w * 0.03;
        const my = (y0 + y1) / 2 + flowWiggle(0.5, lineSeed, h * 0.012);
        ctx.quadraticCurveTo(mx, my, x1, y1);
      } else {
        ctx.lineTo(x1, y1);
      }
      ctx.strokeStyle = g;
      ctx.lineWidth = 0.45 + r() * 0.55;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    ctx.restore();

    /* Hub dots along spine */
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const dots = 900;
    for (let i = 0; i < dots; i++) {
      const r = mulberry32(seed + i + 999);
      const y = midY + (r() - 0.5) * h * 0.5;
      const x = spineX + (r() - 0.5) * w * 0.025;
      ctx.fillStyle = rgba(WHITE, 0.06 + r() * 0.14);
      ctx.beginPath();
      ctx.arc(x, y, 0.35 + r() * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    /* Left tip glow line */
    const tipGrad = ctx.createLinearGradient(0, midY, w * 0.2, midY);
    tipGrad.addColorStop(0, "rgba(0,120,255,0.18)");
    tipGrad.addColorStop(0.5, "rgba(0,185,255,0.09)");
    tipGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = tipGrad;
    ctx.fillRect(0, midY - h * 0.06, w * 0.22, h * 0.12);
    ctx.restore();
  }

  let mode = "radial";
  let genSeed = (Date.now() & 0xffffffff) >>> 0;
  let lastPipeRaw = "";
  let lastSceneTickMs = performance.now();
  let sceneDragging = false;
  let dragLastX = 0;
  let dragLastY = 0;

  function parseMode() {
    const q = new URLSearchParams(window.location.search).get("mode");
    if (q === "comet" || q === "radial") mode = q;
  }

  function tickScene(nowMs) {
    const dt = Math.max(0, nowMs - lastSceneTickMs);
    lastSceneTickMs = nowMs;
    if (scene3d.autoSpin && !sceneDragging) {
      scene3d.yaw += dt * scene3d.spinSpeed;
      if (scene3d.yaw > Math.PI * 2) scene3d.yaw -= Math.PI * 2;
    }
  }

  function initSceneInteraction() {
    if (!canvas) return;
    let scenePtrId = null;
    function onPointerDown(e) {
      if (e.button !== 0) return;
      sceneDragging = true;
      scenePtrId = e.pointerId;
      dragLastX = e.clientX;
      dragLastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    }
    function onPointerMove(e) {
      if (!sceneDragging || e.pointerId !== scenePtrId) return;
      const dx = e.clientX - dragLastX;
      const dy = e.clientY - dragLastY;
      dragLastX = e.clientX;
      dragLastY = e.clientY;
      scene3d.yaw += dx * 0.006;
      scene3d.pitch = clamp(scene3d.pitch + dy * 0.0045, -20, 20);
      saveFlowTune();
      const running = render();
      if (running || scene3d.autoSpin) scheduleAnimationFrame();
    }
    function onPointerUp(e) {
      if (e.pointerId !== scenePtrId) return;
      sceneDragging = false;
      scenePtrId = null;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("lostpointercapture", onPointerUp);
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        scene3d.depth = clamp(scene3d.depth + (e.deltaY > 0 ? -0.05 : 0.05), 0, 20);
        saveFlowTune();
        const running = render();
        if (running || scene3d.autoSpin) scheduleAnimationFrame();
      },
      { passive: false }
    );
  }

  function render(nowMs = performance.now()) {
    tickScene(nowMs);
    const { w, h } = resize();
    const pipe = readGenerativePipe();
    if (pipe && pipe.nodes.length && pipe.edges.length) {
      ensureScenarioButtons(pipe);
      if (mode === "comet") drawPipeComet(w, h, genSeed, pipe);
      else drawPipeRadial(w, h, genSeed, pipe);
      return drawScenarioChase(w, h, pipe, nowMs) || scene3d.autoSpin;
    }
    ensureScenarioButtons({ routes: [] });
    if (mode === "comet") drawComet(w, h, genSeed);
    else drawRadial(w, h, genSeed);
    return scene3d.autoSpin;
  }

  function syncFromPipe() {
    let raw = "";
    try {
      raw = localStorage.getItem(GENERATIVE_PIPE_KEY) || "";
    } catch (_) {
      raw = "";
    }
    if (raw !== lastPipeRaw) {
      lastPipeRaw = raw;
      const running = render();
      if (running) scheduleAnimationFrame();
    }
  }

  function scheduleAnimationFrame() {
    if (rafId) return;
    rafId = window.requestAnimationFrame((ts) => {
      rafId = 0;
      const running = render(ts);
      if (running) scheduleAnimationFrame();
    });
  }

  function pushModeToUrl() {
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("mode", mode);
      history.replaceState(null, "", u);
    } catch (_) {
      /* ignore */
    }
  }

  function initFlowTuneUi() {
    const style = document.createElement("style");
    style.textContent = `
      .flow-tune-toggle {
        position: fixed;
        right: 14px;
        bottom: 14px;
        z-index: 50;
        border: 1px solid rgba(0, 210, 255, 0.35);
        background: rgba(3, 8, 20, 0.82);
        color: rgba(222, 245, 255, 0.95);
        padding: 7px 10px;
        font-size: 10px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        font-family: "IBM Plex Mono", ui-monospace, monospace;
        border-radius: 2px;
        cursor: pointer;
      }
      .flow-tune-modal {
        position: fixed;
        right: 14px;
        bottom: 48px;
        width: min(300px, 82vw);
        z-index: 50;
        border: 1px solid rgba(0, 210, 255, 0.28);
        background: rgba(4, 10, 24, 0.92);
        color: rgba(220, 244, 255, 0.95);
        border-radius: 3px;
        padding: 10px 10px 9px;
        font-family: "IBM Plex Mono", ui-monospace, monospace;
        backdrop-filter: blur(8px);
      }
      .flow-tune-modal[hidden] { display: none; }
      .flow-tune-title {
        margin: 0 0 8px;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: rgba(154, 224, 255, 0.9);
      }
      .flow-tune-row { margin-bottom: 8px; }
      .flow-tune-row label {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        font-size: 10px;
        margin-bottom: 3px;
      }
      .flow-tune-row input[type="range"] {
        width: 100%;
        accent-color: #00d2ff;
      }
      .flow-tune-actions {
        display: flex;
        justify-content: flex-end;
      }
      .flow-tune-actions button {
        border: 1px solid rgba(0, 210, 255, 0.3);
        background: rgba(6, 18, 34, 0.9);
        color: rgba(220, 244, 255, 0.95);
        padding: 5px 8px;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        border-radius: 2px;
        cursor: pointer;
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
      <div class="flow-tune-actions">
        <button type="button" id="flow-reset">Reset</button>
      </div>
    `;
    document.body.appendChild(modal);

    if (window.PulseCanvasDotGrid && typeof window.PulseCanvasDotGrid.mountFlowTuneModal === "function") {
      window.PulseCanvasDotGrid.mountFlowTuneModal(modal, function () {
        var running = render();
        if (running || scene3d.autoSpin) scheduleAnimationFrame();
      });
    }

    const refs = {
      jitter: /** @type {HTMLInputElement} */ (modal.querySelector("#flow-jitter")),
      inconsistency: /** @type {HTMLInputElement} */ (modal.querySelector("#flow-inconsistency")),
      spread: /** @type {HTMLInputElement} */ (modal.querySelector("#flow-spread")),
      instances: /** @type {HTMLInputElement} */ (modal.querySelector("#flow-instances")),
      depth: /** @type {HTMLInputElement} */ (modal.querySelector("#flow-depth")),
      perspective: /** @type {HTMLInputElement} */ (modal.querySelector("#flow-perspective")),
      spinSpeed: /** @type {HTMLInputElement} */ (modal.querySelector("#flow-spinspeed")),
      valJitter: modal.querySelector("#flow-val-jitter"),
      valInconsistency: modal.querySelector("#flow-val-inconsistency"),
      valSpread: modal.querySelector("#flow-val-spread"),
      valInstances: modal.querySelector("#flow-val-instances"),
      valDepth: modal.querySelector("#flow-val-depth"),
      valPerspective: modal.querySelector("#flow-val-perspective"),
      valSpinSpeed: modal.querySelector("#flow-val-spinspeed"),
      reset: /** @type {HTMLButtonElement} */ (modal.querySelector("#flow-reset")),
    };

    const syncUi = () => {
      refs.jitter.value = String(flowTune.arcJitter);
      refs.inconsistency.value = String(flowTune.arcInconsistency);
      refs.spread.value = String(flowTune.strandSpread);
      refs.instances.value = String(flowTune.strandInstances);
      refs.depth.value = String(scene3d.depth);
      refs.perspective.value = String(scene3d.perspective);
      refs.spinSpeed.value = String(scene3d.spinSpeed);
      refs.valJitter.textContent = flowTune.arcJitter.toFixed(2);
      refs.valInconsistency.textContent = flowTune.arcInconsistency.toFixed(2);
      refs.valSpread.textContent = flowTune.strandSpread.toFixed(2);
      refs.valInstances.textContent = flowTune.strandInstances.toFixed(2);
      refs.valDepth.textContent = scene3d.depth.toFixed(2);
      refs.valPerspective.textContent = scene3d.perspective.toFixed(2);
      refs.valSpinSpeed.textContent = scene3d.spinSpeed.toFixed(5);
    };

    const onTune = () => {
      flowTune.arcJitter = clamp(Number(refs.jitter.value) || 0, 0, 20);
      flowTune.arcInconsistency = clamp(Number(refs.inconsistency.value) || 0, 0, 20);
      flowTune.strandSpread = clamp(Number(refs.spread.value) || 1, 0, 20);
      flowTune.strandInstances = clamp(Number(refs.instances.value) || 1, 0, 20);
      scene3d.depth = clamp(Number(refs.depth.value) || 1, 0, 20);
      scene3d.perspective = clamp(Number(refs.perspective.value) || 1, 0, 20);
      scene3d.spinSpeed = clamp(Number(refs.spinSpeed.value) || 0, 0, 20);
      syncUi();
      saveFlowTune();
      const running = render();
      if (running || scene3d.autoSpin) scheduleAnimationFrame();
    };

    refs.jitter.addEventListener("input", onTune);
    refs.inconsistency.addEventListener("input", onTune);
    refs.spread.addEventListener("input", onTune);
    refs.instances.addEventListener("input", onTune);
    refs.depth.addEventListener("input", onTune);
    refs.perspective.addEventListener("input", onTune);
    refs.spinSpeed.addEventListener("input", onTune);
    refs.reset.addEventListener("click", () => {
      flowTune.arcJitter = 0.45;
      flowTune.arcInconsistency = 0.52;
      flowTune.strandSpread = 1.35;
      flowTune.strandInstances = 1.45;
      scene3d.depth = 1.0;
      scene3d.perspective = 0.9;
      scene3d.spinSpeed = 0.00011;
      onTune();
    });

    btn.addEventListener("click", () => {
      modal.hidden = !modal.hidden;
    });
    syncUi();
  }

  function wireUi() {
    document.getElementById("btn-radial")?.addEventListener("click", () => {
      mode = "radial";
      pushModeToUrl();
      render();
    });
    document.getElementById("btn-comet")?.addEventListener("click", () => {
      mode = "comet";
      pushModeToUrl();
      render();
    });
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

  parseMode();
  loadFlowTune();
  try {
    lastPipeRaw = localStorage.getItem(GENERATIVE_PIPE_KEY) || "";
  } catch (_) {
    lastPipeRaw = "";
  }
  initFlowTuneUi();
  initSceneInteraction();
  wireUi();
  if (scene3d.autoSpin) scheduleAnimationFrame();
  else render();
  window.addEventListener("resize", () => {
    const running = render();
    if (running || scene3d.autoSpin) scheduleAnimationFrame();
  });
  window.addEventListener("pulse-dotgrid-change", () => {
    const running = render();
    if (running || scene3d.autoSpin) scheduleAnimationFrame();
  });
  window.addEventListener("storage", (e) => {
    if (e.key === GENERATIVE_PIPE_KEY) syncFromPipe();
    if (IS_EMBED && e.key === FLOW_TUNE_KEY && e.newValue) {
      try {
        const x = JSON.parse(e.newValue);
        if (x && typeof x === "object") {
          if (typeof x.arcJitter === "number") flowTune.arcJitter = clamp(x.arcJitter, 0, 20);
          if (typeof x.arcInconsistency === "number") {
            flowTune.arcInconsistency = clamp(x.arcInconsistency, 0, 20);
          }
          if (typeof x.strandSpread === "number") flowTune.strandSpread = clamp(x.strandSpread, 0, 20);
          if (typeof x.strandInstances === "number") {
            flowTune.strandInstances = clamp(x.strandInstances, 0, 20);
          }
        }
        const running = render();
        if (running || scene3d.autoSpin) scheduleAnimationFrame();
      } catch (_) {}
    }
  });
  window.setInterval(syncFromPipe, 1200);
})();
