(function () {
  "use strict";

  const CELL = 10;
  const VIEW_W = 120;
  /** Canvas height in SVG units (12:5 aspect with width — wall tile). */
  const VIEW_H = 50;

  /** Concentric trust-zone lanes on full 12:5 canvas (elliptical). */
  const CONCENTRIC_LAYOUT = {
    cx: VIEW_W / 2,
    cy: VIEW_H / 2,
    rings: {
      external: { rx: 57.0, ry: 22.75, band: 0.105, power: 4.8, phase: Math.PI * 1.02 },
      "enterprise-edge": { rx: 50.8, ry: 20.0, band: 0.100, power: 4.2, phase: Math.PI * 0.96 },
      "network-enforcement": { rx: 42.4, ry: 16.42, band: 0.095, power: 3.8, phase: Math.PI * 0.88 },
      application: { rx: 32.8, ry: 12.5, band: 0.090, power: 3.4, phase: Math.PI * 0.18 },
      "soc-platform": { rx: 22.8, ry: 8.92, band: 0.085, power: 3.0, phase: -Math.PI / 2 },
      core: { rx: 14.4, ry: 5.92, band: 0.075, power: 2.6, phase: Math.PI * 0.08 },
    },
  };

  const MODE_ORDER = { security: 0, observability: 1, platform: 2 };
  const MODE_LABELS = {
    security: "Security",
    observability: "Observability",
    platform: "Platform",
  };

  const EDGE_STROKE = {
    solid: { width: 0.11, dash: "none", opacity: 0.72 },
    dashed: { width: 0.09, dash: "0.65 0.5", opacity: 0.62 },
    dotted: { width: 0.09, dash: "0.28 0.42", opacity: 0.55 },
  };

  /** @type {SVGSVGElement | null} */
  let svg = null;
  /** @type {{ x: number, y: number, w: number, h: number }} */
  let viewBox = { x: 0, y: 0, w: VIEW_W, h: VIEW_H };
  let dragging = false;
  /** @type {{ x: number, y: number } | null} */
  let dragLast = null;

  /** @type {Map<string, { id: string, label: string, type: string, col: number, row: number, ringId: string, ringLabel: string }>} */
  let nodeMap = new Map();
  /** @type {object | null} */
  let components = null;
  /** @type {object | null} */
  let routesPayload = null;
  /** @type {string[]} */
  let selectedRouteIds = [];
  const MAX_ROUTES = 4;
  const GENERATIVE_PIPE_KEY = "topology.generative.pipe.v1";

  /** Edit mode: drag nodes, add/remove edges, palette, export JSON. */
  let editMode = false;
  let edgePairingMode = false;
  /** @type {string | null} */
  let edgeFromId = null;
  /** @type {string | null} */
  let draggingNodeId = null;
  /** @type {{ type: string, ringId: string, label: string } | null} */
  let placePalettePending = null;
  /** @type {{ from: string, to: string } | null} */
  let pendingEdge = null;

  const NS = "http://www.w3.org/2000/svg";

  /** Primitive shape kinds (visual only; node `type` maps into these). */
  const SHAPE_KIND = {
    FILLED_CIRCLE: "filledCircle",
    OUTLINE_CIRCLE: "outlineCircle",
    SQUARE: "square",
    DIAMOND: "diamond",
    TRIANGLE: "triangle",
    HEXAGON: "hexagon",
  };

  /** Map node.type → one of six primitive shapes. */
  const TYPE_SHAPE_KIND = {
    security: SHAPE_KIND.HEXAGON,
    network: SHAPE_KIND.DIAMOND,
    endpoint: SHAPE_KIND.TRIANGLE,
    external: SHAPE_KIND.OUTLINE_CIRCLE,
    data: SHAPE_KIND.SQUARE,
    service: SHAPE_KIND.SQUARE,
    server: SHAPE_KIND.SQUARE,
    platform: SHAPE_KIND.FILLED_CIRCLE,
    default: SHAPE_KIND.FILLED_CIRCLE,
  };

  /** Distance from node center to lowest point of shape (label anchor). */
  const SHAPE_BOTTOM_BY_KIND = {
    [SHAPE_KIND.FILLED_CIRCLE]: 1.05,
    [SHAPE_KIND.OUTLINE_CIRCLE]: 1.05,
    [SHAPE_KIND.SQUARE]: 1.02,
    [SHAPE_KIND.DIAMOND]: 1.08,
    [SHAPE_KIND.TRIANGLE]: 1.08,
    [SHAPE_KIND.HEXAGON]: 1.08,
  };

  /** Legend: dot scale by role (Cisco-inspired palette via SVG gradients). */
  const DOT_LEGEND = [
    { type: "external", caption: "External — largest ring (perimeter)" },
    { type: "platform", caption: "Platform — large focal nodes" },
    { type: "data", caption: "Data / crown — medium–large" },
    { type: "security", caption: "Security controls — medium" },
    { type: "server", caption: "Server / compute — medium" },
    { type: "endpoint", caption: "Endpoint — smallest dots" },
  ];

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    }
    return 0x7fffffff & h;
  }

  function nodePos(node) {
    if (typeof node.layoutX === "number" && typeof node.layoutY === "number") {
      return { x: node.layoutX, y: node.layoutY };
    }
    if (typeof node.x === "number" && typeof node.y === "number") {
      return { x: node.x, y: node.y };
    }
    return {
      x: node.col * CELL + CELL / 2,
      y: node.row * CELL + CELL / 2,
    };
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  /** SVG-unit radius for the node dot (type drives visual hierarchy). */
  function nodeDotRadius(type) {
    const t = type || "default";
    const map = {
      endpoint: 0.38,
      external: 0.92,
      platform: 0.78,
      security: 0.56,
      network: 0.52,
      data: 0.68,
      service: 0.54,
      server: 0.62,
      default: 0.5,
    };
    return map[t] ?? map.default;
  }

  function nodeGradUrl(type) {
    const t = type || "default";
    const id = {
      security: "nodeGrad-security",
      platform: "nodeGrad-platform",
      external: "nodeGrad-external",
      endpoint: "nodeGrad-endpoint",
      network: "nodeGrad-network",
      data: "nodeGrad-data",
      service: "nodeGrad-service",
      server: "nodeGrad-server",
      default: "nodeGrad-default",
    }[t] || "nodeGrad-default";
    return `url(#${id})`;
  }

  /** Distance from node center to label baseline (dots only). */
  function dotBottom(type) {
    return nodeDotRadius(type) + 0.28;
  }

  function estimatedNodeRadius(node) {
    const dr = nodeDotRadius(node.type || "default");
    const lines = wrapLabelLines(node.label || "", 18);
    const longest = lines.reduce((mx, ln) => Math.max(mx, ln.length), 0);
    const halfLabelW = longest * 0.22;
    const labelH = 0.28 + lines.length * 0.88;
    return clamp(
      Math.max(dr + 0.55, halfLabelW * 0.92 + 0.45, dr + labelH * 0.42 + 0.35),
      dr + 0.4,
      6.4
    );
  }

  function clampNodeToCanvas(node) {
    const margin = (node.layoutRadius || 3) + 0.35;
    node.layoutX = clamp(node.layoutX, margin, VIEW_W - margin);
    node.layoutY = clamp(node.layoutY, margin, VIEW_H - margin);
  }

  function getRingConfig(ringId) {
    return CONCENTRIC_LAYOUT.rings[ringId] || CONCENTRIC_LAYOUT.rings.application;
  }

  function signedPowAbs(v, exp) {
    return Math.sign(v) * Math.pow(Math.abs(v), exp);
  }

  function ringPoint(cfg, theta, rho) {
    const p = cfg.power || 2;
    const e = 2 / p;
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const x = cfg.rx * signedPowAbs(c, e) * rho;
    const y = cfg.ry * signedPowAbs(s, e) * rho;
    return { x: CONCENTRIC_LAYOUT.cx + x, y: CONCENTRIC_LAYOUT.cy + y };
  }

  function projectNodeToRingBand(node) {
    const cfg = getRingConfig(node.ringId);
    const p = cfg.power || 2;
    let dx = node.layoutX - CONCENTRIC_LAYOUT.cx;
    let dy = node.layoutY - CONCENTRIC_LAYOUT.cy;
    let rho = Math.pow(
      Math.pow(Math.abs(dx) / cfg.rx, p) + Math.pow(Math.abs(dy) / cfg.ry, p),
      1 / p
    );
    if (!rho || rho < 1e-6) {
      const t = typeof node.layoutSeedAngle === "number" ? node.layoutSeedAngle : 0;
      const pt = ringPoint(cfg, t, 1);
      dx = pt.x - CONCENTRIC_LAYOUT.cx;
      dy = pt.y - CONCENTRIC_LAYOUT.cy;
      rho = 1;
    }
    const minRho = Math.max(0.2, 1 - cfg.band);
    const maxRho = 1 + cfg.band;
    const target = clamp(rho, minRho, maxRho);
    const scale = target / rho;
    node.layoutX = CONCENTRIC_LAYOUT.cx + dx * scale;
    node.layoutY = CONCENTRIC_LAYOUT.cy + dy * scale;
    clampNodeToCanvas(node);
  }

  function seedConcentricPositions(nodeMap) {
    const byRing = new Map();
    for (const node of nodeMap.values()) {
      node.layoutRadius = estimatedNodeRadius(node);
      if (!byRing.has(node.ringId)) byRing.set(node.ringId, []);
      byRing.get(node.ringId).push(node);
    }

    for (const [ringId, ringNodes] of byRing) {
      const cfg = getRingConfig(ringId);
      const sorted = [...ringNodes].sort((a, b) => hashStr(a.id) - hashStr(b.id));
      const n = sorted.length || 1;
      const step = (Math.PI * 2) / n;
      for (let i = 0; i < sorted.length; i++) {
        const node = sorted[i];
        const h = hashStr(node.id);
        const jitter = ((((h >>> 3) % 1000) / 1000) - 0.5) * step * 0.45;
        const t = cfg.phase + i * step + jitter;
        const radial = 1 + ((((h >>> 11) % 1000) / 1000) - 0.5) * cfg.band * 1.3;
        node.layoutSeedAngle = t;
        const p = ringPoint(cfg, t, radial);
        node.layoutX = p.x;
        node.layoutY = p.y;
        projectNodeToRingBand(node);
      }
    }
  }

  function edgeAttractionWeight(edge) {
    let w = 1;
    if (edge.style === "dashed") w = 0.66;
    else if (edge.style === "dotted") w = 0.32;
    if (edge.trustBoundary) w *= 1.35;
    return w;
  }

  function resolveNodeCollisions(nodes, passes) {
    const gap = 0.85;
    for (let pass = 0; pass < passes; pass++) {
      let moved = false;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = b.layoutX - a.layoutX;
          let dy = b.layoutY - a.layoutY;
          let dist = Math.sqrt(dx * dx + dy * dy);
          const dMin = (a.layoutRadius || 3) + (b.layoutRadius || 3) + gap;
          if (dist >= dMin) continue;
          if (!dist || dist < 1e-6) {
            const t = (hashStr(a.id + "|" + b.id) % 360) * (Math.PI / 180);
            dx = Math.cos(t) * 0.01;
            dy = Math.sin(t) * 0.01;
            dist = 0.01;
          }
          const ux = dx / dist;
          const uy = dy / dist;
          const push = (dMin - dist) * 0.52;
          a.layoutX -= ux * push;
          a.layoutY -= uy * push;
          b.layoutX += ux * push;
          b.layoutY += uy * push;
          projectNodeToRingBand(a);
          projectNodeToRingBand(b);
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  /**
   * Constrained force refinement on concentric trust-ring seeds.
   */
  function runForceLayout(nodeMap, edges) {
    const nodes = [...nodeMap.values()];
    const n = nodes.length;
    if (n === 0) return;
    const k = Math.sqrt((VIEW_W * VIEW_H) / n) * 1.08;
    const iterations = 260;

    for (let iter = 0; iter < iterations; iter++) {
      const temp = 1 - iter / iterations;
      const disp = new Map(nodes.map((nd) => [nd.id, { dx: 0, dy: 0 }]));

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = b.layoutX - a.layoutX;
          let dy = b.layoutY - a.layoutY;
          let dist = Math.sqrt(dx * dx + dy * dy) || 0.06;
          const f = (k * k) / dist;
          const fx = (dx / dist) * f;
          const fy = (dy / dist) * f;
          disp.get(a.id).dx -= fx;
          disp.get(a.id).dy -= fy;
          disp.get(b.id).dx += fx;
          disp.get(b.id).dy += fy;
        }
      }

      for (const e of edges) {
        const a = nodeMap.get(e.from);
        const b = nodeMap.get(e.to);
        if (!a || !b) continue;
        let dx = b.layoutX - a.layoutX;
        let dy = b.layoutY - a.layoutY;
        let dist = Math.sqrt(dx * dx + dy * dy) || 0.06;
        const w = edgeAttractionWeight(e);
        const f = ((dist * dist) / k) * w * 0.36;
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        disp.get(a.id).dx += fx;
        disp.get(a.id).dy += fy;
        disp.get(b.id).dx -= fx;
        disp.get(b.id).dy -= fy;
      }

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = b.layoutX - a.layoutX;
          let dy = b.layoutY - a.layoutY;
          let dist = Math.sqrt(dx * dx + dy * dy) || 0.06;
          const dMin = (a.layoutRadius || 3) + (b.layoutRadius || 3) + 0.85;
          if (dist >= dMin) continue;
          const fx = (dx / dist) * (dMin - dist) * (0.30 + 0.45 * temp);
          const fy = (dy / dist) * (dMin - dist) * (0.30 + 0.45 * temp);
          disp.get(a.id).dx -= fx;
          disp.get(a.id).dy -= fy;
          disp.get(b.id).dx += fx;
          disp.get(b.id).dy += fy;
        }
      }

      for (const node of nodes) {
        const cfg = getRingConfig(node.ringId);
        const p = cfg.power || 2;
        const d = disp.get(node.id);
        const dx = node.layoutX - CONCENTRIC_LAYOUT.cx;
        const dy = node.layoutY - CONCENTRIC_LAYOUT.cy;
        const gx = (Math.sign(dx) * Math.pow(Math.abs(dx) / cfg.rx, p - 1)) / cfg.rx;
        const gy = (Math.sign(dy) * Math.pow(Math.abs(dy) / cfg.ry, p - 1)) / cfg.ry;
        const gradLen = Math.sqrt(gx * gx + gy * gy) || 1;
        const nx = gx / gradLen;
        const ny = gy / gradLen;
        const rho = Math.pow(
          Math.pow(Math.abs(dx) / cfg.rx, p) + Math.pow(Math.abs(dy) / cfg.ry, p),
          1 / p
        ) || 1;
        const radialErr = 1 - rho;
        const radialHome = 0.22 + 0.18 * temp;
        d.dx += nx * radialErr * radialHome * cfg.rx * 0.9;
        d.dy += ny * radialErr * radialHome * cfg.ry * 0.9;

        if (typeof node.layoutSeedAngle === "number") {
          const angle = Math.atan2(dy, dx);
          let delta = node.layoutSeedAngle - angle;
          while (delta > Math.PI) delta -= Math.PI * 2;
          while (delta < -Math.PI) delta += Math.PI * 2;
          const tangential = 0.06 * temp;
          const tx = -ny;
          const ty = nx;
          d.dx += tx * delta * tangential * cfg.rx * 0.85;
          d.dy += ty * delta * tangential * cfg.ry * 0.85;
        }
      }

      const scale = (0.14 + 0.16 * temp) * (iter < 70 ? 1.16 : 1);
      for (const node of nodes) {
        const d = disp.get(node.id);
        node.layoutX += d.dx * scale;
        node.layoutY += d.dy * scale;
        projectNodeToRingBand(node);
      }
      resolveNodeCollisions(nodes, 4);
    }
    resolveNodeCollisions(nodes, 28);
  }

  function findRingNodeRecord(nodeId) {
    if (!components || !components.rings) return null;
    for (const ring of components.rings) {
      const node = (ring.nodes || []).find((n) => n.id === nodeId);
      if (node) return { ring, node };
    }
    return null;
  }

  function hasAnySavedPositions(data) {
    if (!data || !data.rings) return false;
    for (const ring of data.rings) {
      for (const n of ring.nodes || []) {
        if (typeof n.x === "number" && typeof n.y === "number") return true;
      }
    }
    return false;
  }

  function shouldSkipForceLayout(data) {
    const d = data.display || {};
    if (d.layout === "interactive" && d.useSavedPositions && hasAnySavedPositions(data)) {
      return true;
    }
    return false;
  }

  function applySavedPositionsToMap() {
    for (const node of nodeMap.values()) {
      const found = findRingNodeRecord(node.id);
      if (found && typeof found.node.x === "number" && typeof found.node.y === "number") {
        node.layoutX = found.node.x;
        node.layoutY = found.node.y;
        node.layoutRadius = estimatedNodeRadius(node);
      }
    }
  }

  function syncAllPositionsToRingData() {
    for (const node of nodeMap.values()) {
      if (typeof node.layoutX !== "number" || typeof node.layoutY !== "number") continue;
      const found = findRingNodeRecord(node.id);
      if (found) {
        found.node.x = node.layoutX;
        found.node.y = node.layoutY;
      }
    }
  }

  function applyGraphLayout(data) {
    if (!data || !data.edges) return;
    const d = data.display || {};
    if (d.layout === "grid") {
      for (const node of nodeMap.values()) {
        node.layoutX = node.col * CELL + CELL / 2;
        node.layoutY = node.row * CELL + CELL / 2;
        node.layoutRadius = estimatedNodeRadius(node);
      }
      return;
    }
    if (shouldSkipForceLayout(data)) {
      applySavedPositionsToMap();
      return;
    }
    seedConcentricPositions(nodeMap);
    runForceLayout(nodeMap, data.edges);
    syncAllPositionsToRingData();
  }

  function svgPoint(clientX, clientY) {
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return pt.matrixTransform(ctm.inverse());
  }

  function setViewBoxAttr() {
    if (!svg) return;
    svg.setAttribute(
      "viewBox",
      `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`
    );
  }

  function fitViewToExtents() {
    if (!nodeMap || nodeMap.size === 0) {
      viewBox = { x: 0, y: 0, w: VIEW_W, h: VIEW_H };
      setViewBoxAttr();
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of nodeMap.values()) {
      const p = nodePos(node);
      const r = node.layoutRadius || estimatedNodeRadius(node) || 3;
      const lines = wrapLabelLines(node.label || "", 18);
      const labelHalfW = lines.reduce((mx, ln) => Math.max(mx, ln.length * 0.22), 0);
      const labelTop = p.y + dotBottom(node.type || "default") + 0.28;
      const labelBottom = labelTop + lines.length * 0.92;
      minX = Math.min(minX, p.x - Math.max(r, labelHalfW + 0.4));
      maxX = Math.max(maxX, p.x + Math.max(r, labelHalfW + 0.4));
      minY = Math.min(minY, p.y - (r + 0.5));
      maxY = Math.max(maxY, labelBottom + 0.6);
    }

    const pad = 1.8;
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;
    minX = clamp(minX, 0, VIEW_W);
    minY = clamp(minY, 0, VIEW_H);
    maxX = clamp(maxX, 0, VIEW_W);
    maxY = clamp(maxY, 0, VIEW_H);

    let w = Math.max(10, maxX - minX);
    let h = Math.max(6, maxY - minY);
    const targetAspect = VIEW_W / VIEW_H;
    const aspect = w / h;
    if (aspect > targetAspect) {
      const desiredH = w / targetAspect;
      const extra = desiredH - h;
      minY -= extra / 2;
      h = desiredH;
    } else {
      const desiredW = h * targetAspect;
      const extra = desiredW - w;
      minX -= extra / 2;
      w = desiredW;
    }

    const maxXStart = Math.max(0, VIEW_W - w);
    const maxYStart = Math.max(0, VIEW_H - h);
    viewBox = {
      x: clamp(minX, 0, maxXStart),
      y: clamp(minY, 0, maxYStart),
      w: Math.min(VIEW_W, w),
      h: Math.min(VIEW_H, h),
    };
    setViewBoxAttr();
  }

  function buildNodeMap(data) {
    nodeMap = new Map();
    for (const ring of data.rings) {
      for (const n of ring.nodes) {
        const merged = {
          ...n,
          ringId: ring.id,
          ringLabel: ring.label,
        };
        if (typeof n.x === "number" && typeof n.y === "number") {
          merged.layoutX = n.x;
          merged.layoutY = n.y;
        }
        nodeMap.set(n.id, merged);
      }
    }
  }

  function undirectedKey(a, b) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  /**
   * For each undirected segment, which active routes use it (directed step).
   * @returns {Map<string, { routeId: string, from: string, to: string }[]>}
   */
  function buildSegmentUsage(activeRoutes) {
    const map = new Map();
    for (const route of activeRoutes) {
      const ids = route.nodes;
      for (let i = 0; i < ids.length - 1; i++) {
        const from = ids[i];
        const to = ids[i + 1];
        const key = undirectedKey(from, to);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push({ routeId: route.id, from, to });
      }
    }
    return map;
  }

  function offsetEndpoints(ax, ay, bx, by, offsetIndex, totalOnSegment) {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const off = (offsetIndex - (totalOnSegment - 1) / 2) * 0.38;
    return {
      x1: ax + nx * off,
      y1: ay + ny * off,
      x2: bx + nx * off,
      y2: by + ny * off,
    };
  }

  function boundsForNodeIds(ids) {
    const pts = [];
    for (const id of ids || []) {
      const n = nodeMap.get(id);
      if (n) pts.push(nodePos(n));
    }
    if (pts.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { minX, minY, maxX, maxY };
  }

  function renderZoneHalos() {
    const g = document.getElementById("layer-zone-halos");
    if (!g || !components) return;
    g.innerHTML = "";

    const zones = Array.isArray(components.zoneHalos) ? components.zoneHalos : [];
    for (const zone of zones) {
      const ring = (components.rings || []).find((r) => r.id === zone.ringId);
      if (!ring || !Array.isArray(ring.nodes)) continue;
      const b = boundsForNodeIds(ring.nodes.map((n) => n.id));
      if (!b) continue;

      const pad = Number(zone.padding) || 1.3;
      const minX = b.minX - pad;
      const minY = b.minY - pad;
      const w = b.maxX - b.minX + pad * 2;
      const h = b.maxY - b.minY + pad * 2;

      const ghost = document.createElementNS(NS, "rect");
      ghost.setAttribute("x", String(minX - 0.2));
      ghost.setAttribute("y", String(minY - 0.2));
      ghost.setAttribute("width", String(w + 0.4));
      ghost.setAttribute("height", String(h + 0.4));
      ghost.setAttribute("rx", String((zone.rx != null ? zone.rx : 1.2) + 0.15));
      ghost.setAttribute("ry", String((zone.rx != null ? zone.rx : 1.2) + 0.15));
      ghost.setAttribute("fill", "none");
      ghost.setAttribute("stroke", "#00bceb");
      ghost.setAttribute("stroke-opacity", "0.14");
      ghost.setAttribute("stroke-width", "0.05");
      ghost.setAttribute("stroke-dasharray", "0.45 0.4");
      ghost.setAttribute("class", "zone-halo-ghost");
      ghost.setAttribute("pointer-events", "none");
      g.appendChild(ghost);

      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", String(minX));
      rect.setAttribute("y", String(minY));
      rect.setAttribute("width", String(w));
      rect.setAttribute("height", String(h));
      rect.setAttribute("rx", String(zone.rx != null ? zone.rx : 1.2));
      rect.setAttribute("ry", String(zone.rx != null ? zone.rx : 1.2));
      rect.setAttribute("fill", zone.fill || "rgba(0, 188, 235, 0.06)");
      rect.setAttribute("stroke", zone.stroke || "rgba(0, 80, 115, 0.2)");
      rect.setAttribute("stroke-width", String(zone.strokeWidth != null ? zone.strokeWidth : 0.08));
      rect.setAttribute("class", "zone-halo");
      rect.setAttribute("pointer-events", "none");
      g.appendChild(rect);

      if (zone.label) {
        const text = document.createElementNS(NS, "text");
        text.setAttribute("x", String(minX + 0.5));
        text.setAttribute("y", String(minY + 0.85));
        text.setAttribute("font-size", "0.52");
        text.setAttribute("font-weight", "600");
        text.setAttribute("font-family", "IBM Plex Sans, Inter, system-ui, sans-serif");
        text.setAttribute("letter-spacing", "0.06");
        text.setAttribute("class", "zone-halo-label");
        text.setAttribute("text-anchor", "start");
        text.setAttribute("dominant-baseline", "hanging");
        text.textContent = zone.label;
        g.appendChild(text);
      }
    }
  }

  function renderTrustMembranes() {
    const g = document.getElementById("layer-trust-membranes");
    if (!g || !components) return;
    g.innerHTML = "";

    const membranes = Array.isArray(components.trustMembranes)
      ? components.trustMembranes
      : [];

    for (const membrane of membranes) {
      const a = nodeMap.get(membrane.from);
      const b = nodeMap.get(membrane.to);
      if (!a || !b) continue;

      const pa = nodePos(a);
      const pb = nodePos(b);
      const mx = (pa.x + pb.x) / 2;
      const my = (pa.y + pb.y) / 2;
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;

      const length = Number(membrane.length) || 4.2;
      const thickness = Number(membrane.thickness) || 0.5;
      const rx = Number(membrane.rx) || thickness / 2;

      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", String(mx - length / 2));
      rect.setAttribute("y", String(my - thickness / 2));
      rect.setAttribute("width", String(length));
      rect.setAttribute("height", String(thickness));
      rect.setAttribute("rx", String(rx));
      rect.setAttribute("ry", String(rx));
      rect.setAttribute("fill", membrane.fill || "rgba(255, 130, 0, 0.16)");
      rect.setAttribute("stroke", membrane.stroke || "rgba(0, 80, 115, 0.45)");
      rect.setAttribute("stroke-width", String(membrane.strokeWidth != null ? membrane.strokeWidth : 0.1));
      if (membrane.strokeDasharray) {
        rect.setAttribute("stroke-dasharray", membrane.strokeDasharray);
      }
      rect.setAttribute("filter", membrane.filter || "url(#membrane-glow)");
      rect.setAttribute("class", "trust-membrane");
      rect.setAttribute("pointer-events", "none");
      rect.setAttribute("transform", `rotate(${angle} ${mx} ${my})`);
      g.appendChild(rect);

      if (membrane.label) {
        const text = document.createElementNS(NS, "text");
        text.setAttribute("x", String(mx));
        text.setAttribute("y", String(my - 1.0));
        text.setAttribute("font-size", "0.6");
        text.setAttribute("font-weight", "600");
        text.setAttribute("font-family", "IBM Plex Sans, Inter, system-ui, sans-serif");
        text.setAttribute("letter-spacing", "0.04");
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("fill", "#005073");
        text.setAttribute("class", "membrane-label");
        text.setAttribute("pointer-events", "none");
        text.textContent = membrane.label;
        g.appendChild(text);
      }
    }
  }

  function renderGrid(show) {
    const g = document.getElementById("layer-grid");
    if (!g) return;
    g.innerHTML = "";
    if (!show) return;
    const majorStep = CELL * 5;
    for (let x = 0; x <= VIEW_W; x += CELL) {
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line.setAttribute("x1", String(x));
      line.setAttribute("y1", "0");
      line.setAttribute("x2", String(x));
      line.setAttribute("y2", String(VIEW_H));
      const major = x % majorStep === 0 || x === VIEW_W;
      line.setAttribute("class", major ? "grid-line grid-line--major" : "grid-line");
      g.appendChild(line);
    }
    for (let y = 0; y <= VIEW_H; y += CELL) {
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );
      line.setAttribute("x1", "0");
      line.setAttribute("y1", String(y));
      line.setAttribute("x2", String(VIEW_W));
      line.setAttribute("y2", String(y));
      const major = y % majorStep === 0 || y === VIEW_H;
      line.setAttribute("class", major ? "grid-line grid-line--major" : "grid-line");
      g.appendChild(line);
    }
  }

  /** @type {number | null} */
  let selectedEdgeIndex = null;

  function renderBaseEdges() {
    const g = document.getElementById("layer-base-edges");
    const gLabels = document.getElementById("layer-edge-labels");
    if (!g || !components) return;
    g.innerHTML = "";
    if (gLabels) gLabels.innerHTML = "";
    const edges = components.edges || [];
    edges.forEach((edge, edgeIndex) => {
      const a = nodeMap.get(edge.from);
      const b = nodeMap.get(edge.to);
      if (!a || !b) return;
      const pa = nodePos(a);
      const pb = nodePos(b);
      const st = EDGE_STROKE[edge.style] || EDGE_STROKE.solid;
      const isTrust = Boolean(edge.trustBoundary);
      const key = `${edge.from}|${edge.to}`;
      const { strands, bendMag } = edgeStrandPaths(pa.x, pa.y, pb.x, pb.y, key);
      const midD = strands[1].d;

      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      const eg = document.createElementNS(NS, "g");
      eg.setAttribute("class", isTrust ? "base-edge-group edge-trust-boundary" : "base-edge-group");
      eg.dataset.from = edge.from;
      eg.dataset.to = edge.to;
      eg.dataset.edgeIndex = String(edgeIndex);

      const strokeGrad = isTrust ? "url(#edge-trust-grad)" : "url(#edge-strand-grad)";
      const widths = [0.075, 0.11, 0.075];
      const opac = [0.38, 0.78, 0.38];
      const selected = editMode && selectedEdgeIndex === edgeIndex;

      const spine = document.createElementNS(NS, "path");
      spine.setAttribute("d", midD);
      spine.setAttribute("fill", "none");
      spine.setAttribute("stroke", "#061424");
      spine.setAttribute("stroke-width", "0.2");
      spine.setAttribute("stroke-opacity", "0.055");
      spine.setAttribute("stroke-linecap", "round");
      spine.setAttribute("class", "base-edge-spine");
      spine.setAttribute("pointer-events", "none");
      eg.appendChild(spine);

      strands.forEach((s, si) => {
        const path = document.createElementNS(NS, "path");
        path.setAttribute("d", s.d);
        path.setAttribute("fill", "none");
        if (selected) {
          path.setAttribute("stroke", "#00bceb");
        } else {
          path.setAttribute("stroke", strokeGrad);
        }
        path.setAttribute("stroke-width", String(widths[si]));
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute(
          "stroke-opacity",
          String(selected ? 0.95 : opac[si] * st.opacity)
        );
        if (st.dash !== "none") path.setAttribute("stroke-dasharray", st.dash);
        path.setAttribute("class", "base-edge-strand");
        path.setAttribute("pointer-events", editMode ? "none" : "stroke");
        eg.appendChild(path);
      });

      const showTip = (e) => {
        const aNode = nodeMap.get(edge.from);
        const bNode = nodeMap.get(edge.to);
        if (!tooltipEl || !aNode || !bNode) return;
        tooltipEl.hidden = false;
        const styleLbl = edge.style || "solid";
        tooltipEl.innerHTML = `<div class="tooltip__meta">EDGE</div><strong class="tooltip__title">${escapeHtml(aNode.label)} → ${escapeHtml(bNode.label)}</strong><div class="tooltip__body">${escapeHtml(styleLbl)}${isTrust ? " · trust boundary" : ""}</div>`;
        moveTooltip(e);
      };
      if (!editMode) {
        eg.addEventListener("mouseenter", showTip);
        eg.addEventListener("mousemove", moveTooltip);
        eg.addEventListener("mouseleave", hideTooltip);
      }
      g.appendChild(eg);

      if (editMode) {
        const hit = document.createElementNS(NS, "path");
        hit.setAttribute("d", midD);
        hit.setAttribute("stroke", "transparent");
        hit.setAttribute("stroke-width", "1.85");
        hit.setAttribute("fill", "none");
        hit.setAttribute("pointer-events", "stroke");
        hit.setAttribute("stroke-linecap", "round");
        hit.setAttribute("class", "base-edge-hit");
        hit.dataset.edgeIndex = String(edgeIndex);
        hit.addEventListener("mouseenter", showTip);
        hit.addEventListener("mousemove", moveTooltip);
        hit.addEventListener("mouseleave", hideTooltip);
        hit.addEventListener("click", (e) => {
          if (!editMode) return;
          e.stopPropagation();
          e.preventDefault();
          selectedEdgeIndex = edgeIndex;
          redrawStatic();
        });
        g.appendChild(hit);
      }

      if (gLabels && edge.midLabel) {
        const mx = (pa.x + pb.x) / 2 + nx * bendMag * 0.36;
        const my = (pa.y + pb.y) / 2 + ny * bendMag * 0.36;
        const ox = (-ny) * 0.85;
        const oy = nx * 0.85;
        const text = document.createElementNS(NS, "text");
        text.setAttribute("x", String(mx + ox));
        text.setAttribute("y", String(my + oy));
        text.setAttribute("font-size", "0.52");
        text.setAttribute("font-weight", "600");
        text.setAttribute("letter-spacing", "0.12");
        text.setAttribute("font-family", "IBM Plex Sans, Inter, system-ui, sans-serif");
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("fill", "#005073");
        text.setAttribute("class", "edge-mid-label");
        text.setAttribute("pointer-events", "none");
        text.textContent = edge.midLabel;
        gLabels.appendChild(text);
      }
    });
  }

  function renderRoutes() {
    const g = document.getElementById("layer-routes");
    const legendRoutes = document.getElementById("legend-routes");
    if (!g || !routesPayload) return;
    g.innerHTML = "";
    if (legendRoutes) legendRoutes.innerHTML = "";

    const routes = routesPayload.routes || [];
    const palette = routesPayload.routeColors || [
      "#00bceb",
      "#e22386",
      "#ff8200",
      "#005073",
    ];

    const activeRoutes = selectedRouteIds
      .map((id) => routes.find((r) => r.id === id))
      .filter(Boolean);

    const segmentUsage = buildSegmentUsage(activeRoutes);

    activeRoutes.forEach((route, idx) => {
      const color = palette[idx % palette.length];
      const ids = route.nodes;
      for (let i = 0; i < ids.length - 1; i++) {
        const from = ids[i];
        const to = ids[i + 1];
        const na = nodeMap.get(from);
        const nb = nodeMap.get(to);
        if (!na || !nb) continue;
        const pa = nodePos(na);
        const pb = nodePos(nb);
        const key = undirectedKey(from, to);
        const users = segmentUsage.get(key) || [];
        const uniqueRouteIds = [...new Set(users.map((u) => u.routeId))];
        uniqueRouteIds.sort(
          (x, y) => selectedRouteIds.indexOf(x) - selectedRouteIds.indexOf(y)
        );
        const pos = uniqueRouteIds.indexOf(route.id);
        const o = offsetEndpoints(
          pa.x,
          pa.y,
          pb.x,
          pb.y,
          pos,
          uniqueRouteIds.length
        );

        const d = routeCurvedPath(o.x1, o.y1, o.x2, o.y2, route.id, i);
        const glow = document.createElementNS(NS, "path");
        glow.setAttribute("d", d);
        glow.setAttribute("fill", "none");
        glow.setAttribute("stroke", color);
        glow.setAttribute("stroke-width", "0.72");
        glow.setAttribute("stroke-opacity", "0.24");
        glow.setAttribute("stroke-linecap", "round");
        glow.setAttribute("filter", "url(#route-glow-soft)");
        glow.setAttribute("class", "route-edge-glow");
        g.appendChild(glow);

        const path = document.createElementNS(NS, "path");
        path.setAttribute("d", d);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", color);
        path.setAttribute("stroke-width", "0.38");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("filter", "url(#route-glow)");
        path.setAttribute("class", "route-edge");
        g.appendChild(path);
      }
    });

    if (legendRoutes) {
      activeRoutes.forEach((route, idx) => {
        const color = palette[idx % palette.length];
        const li = document.createElement("li");
        const sw = document.createElement("span");
        sw.className = "legend__swatch";
        sw.style.background = color;
        li.appendChild(sw);
        const span = document.createElement("span");
        span.textContent = route.label;
        li.appendChild(span);
        legendRoutes.appendChild(li);
      });
      if (activeRoutes.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No routes selected.";
        legendRoutes.appendChild(li);
      }
    }
  }

  /**
   * @param {string} text
   * @param {number} maxLen
   * @returns {string[]}
   */
  function wrapLabelLines(text, maxLen) {
    const words = String(text).trim().split(/\s+/);
    if (words.length === 0) return [""];
    const lines = [];
    let i = 0;
    while (lines.length < 2 && i < words.length) {
      let line = words[i++];
      while (
        i < words.length &&
        (line + " " + words[i]).length <= maxLen
      ) {
        line += " " + words[i++];
      }
      lines.push(line);
    }
    if (i < words.length) {
      const tail = words.slice(i).join(" ");
      const last = lines[lines.length - 1];
      const combined = last + " " + tail;
      lines[lines.length - 1] =
        combined.length <= maxLen * 2
          ? combined
          : combined.slice(0, Math.max(0, maxLen * 2 - 1)).trim() + "…";
    }
    return lines;
  }

  function shapeKindForType(type) {
    return TYPE_SHAPE_KIND[type] ?? TYPE_SHAPE_KIND.default;
  }

  function shapeBottom(type) {
    const kind = shapeKindForType(type);
    return SHAPE_BOTTOM_BY_KIND[kind] ?? SHAPE_BOTTOM_BY_KIND[SHAPE_KIND.FILLED_CIRCLE];
  }

  /**
   * Regular polygon points centered at origin; first vertex at top (-90°).
   * @param {number} n
   * @param {number} r circumradius
   */
  function polygonPoints(n, r) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = ((Math.PI * 2) / n) * i - Math.PI / 2;
      pts.push(`${(r * Math.cos(a)).toFixed(3)},${(r * Math.sin(a)).toFixed(3)}`);
    }
    return pts.join(" ");
  }

  /**
   * Append primitive shape centered at (0,0) inside `g`.
   * @param {string} fill node fill color (outline circle uses none)
   */
  function appendShapeForKind(g, kind, fill, stroke) {
    const strokeW = "0.1";
    const S = 0.82;
    const R = 1.02 * S;

    const add = (el) => {
      g.appendChild(el);
      return el;
    };

    switch (kind) {
      case SHAPE_KIND.FILLED_CIRCLE: {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", "0");
        c.setAttribute("cy", "0");
        c.setAttribute("r", String(R));
        c.setAttribute("fill", fill);
        c.setAttribute("stroke", stroke);
        c.setAttribute("stroke-width", strokeW);
        return add(c);
      }
      case SHAPE_KIND.OUTLINE_CIRCLE: {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", "0");
        c.setAttribute("cy", "0");
        c.setAttribute("r", String(R));
        c.setAttribute("fill", "none");
        c.setAttribute("stroke", fill);
        c.setAttribute("stroke-width", "0.22");
        return add(c);
      }
      case SHAPE_KIND.SQUARE: {
        const a = R;
        const r = document.createElementNS(NS, "rect");
        r.setAttribute("x", String(-a));
        r.setAttribute("y", String(-a));
        r.setAttribute("width", String(2 * a));
        r.setAttribute("height", String(2 * a));
        r.setAttribute("fill", fill);
        r.setAttribute("stroke", stroke);
        r.setAttribute("stroke-width", strokeW);
        return add(r);
      }
      case SHAPE_KIND.DIAMOND: {
        const p = document.createElementNS(NS, "path");
        p.setAttribute("d", `M 0,${-R} L ${R},0 L 0,${R} L ${-R},0 Z`);
        p.setAttribute("fill", fill);
        p.setAttribute("stroke", stroke);
        p.setAttribute("stroke-width", strokeW);
        p.setAttribute("stroke-linejoin", "miter");
        return add(p);
      }
      case SHAPE_KIND.TRIANGLE: {
        const rTri = R * 1.15;
        const poly = document.createElementNS(NS, "polygon");
        poly.setAttribute("points", polygonPoints(3, rTri));
        poly.setAttribute("fill", fill);
        poly.setAttribute("stroke", stroke);
        poly.setAttribute("stroke-width", strokeW);
        poly.setAttribute("stroke-linejoin", "round");
        return add(poly);
      }
      case SHAPE_KIND.HEXAGON: {
        const poly = document.createElementNS(NS, "polygon");
        poly.setAttribute("points", polygonPoints(6, R));
        poly.setAttribute("fill", fill);
        poly.setAttribute("stroke", stroke);
        poly.setAttribute("stroke-width", strokeW);
        poly.setAttribute("stroke-linejoin", "round");
        return add(poly);
      }
      default: {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", "0");
        c.setAttribute("cy", "0");
        c.setAttribute("r", String(R));
        c.setAttribute("fill", fill);
        c.setAttribute("stroke", stroke);
        c.setAttribute("stroke-width", strokeW);
        return add(c);
      }
    }
  }

  /** Append shape for node.type (maps to one of six primitives). */
  function appendShapeForType(g, type, fill, stroke) {
    return appendShapeForKind(g, shapeKindForType(type), fill, stroke);
  }

  /** Ash Thorp–style multi-size gradient dots (replaces polygon shapes on canvas). */
  function appendNodeDot(g, type) {
    const t = type || "default";
    const r = nodeDotRadius(t);
    const fill = "#08111d";
    const stroke = nodeGradUrl(t);
    const sw = t === "external" ? 0.12 : 0.08;
    const gap = t === "external" ? 0.2 : 0.16;

    const c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", "0");
    c.setAttribute("cy", "0");
    c.setAttribute("r", String(r));
    c.setAttribute("fill", fill);
    c.setAttribute("class", "topology-node-dot");
    g.appendChild(c);

    const ring = document.createElementNS(NS, "circle");
    ring.setAttribute("cx", "0");
    ring.setAttribute("cy", "0");
    ring.setAttribute("r", String(r + gap));
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", stroke);
    ring.setAttribute("stroke-width", String(sw));
    ring.setAttribute("class", "topology-node-dot-ring");
    ring.setAttribute("pointer-events", "none");
    g.appendChild(ring);
  }

  /**
   * Three curved Bézier strands between endpoints (deterministic per edge key).
   * @returns {{ strands: { d: string }[], bendMag: number }}
   */
  function edgeStrandPaths(x1, y1, x2, y2, seedKey) {
    const seed = hashStr(seedKey);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const phase = ((seed % 1000) / 1000) * Math.PI * 2;
    const bendMag = Math.min(len * 0.2, 5.5) * (0.42 + 0.58 * Math.sin(phase));
    const strands = [];
    for (let s = -1; s <= 1; s++) {
      const spread = s * 0.22;
      const bend = bendMag + spread * 0.4;
      const nx = -dy / len;
      const ny = dx / len;
      const cx1 = x1 + dx * 0.32 + nx * bend;
      const cy1 = y1 + dy * 0.32 + ny * bend;
      const cx2 = x1 + dx * 0.68 + nx * bend;
      const cy2 = y1 + dy * 0.68 + ny * bend;
      const d = `M ${x1} ${y1} C ${cx1} ${cy1} ${cx2} ${cy2} ${x2} ${y2}`;
      strands.push({ d });
    }
    return { strands, bendMag };
  }

  function routeCurvedPath(x1, y1, x2, y2, routeId, segIndex) {
    const key = `${routeId}|${segIndex}`;
    const { strands } = edgeStrandPaths(x1, y1, x2, y2, key);
    return strands[1].d;
  }

  let nodeDragMoved = false;

  function syncEdgeModeButton() {
    const btn = document.getElementById("btn-edge-mode");
    if (!btn) return;
    btn.classList.toggle("btn--active", edgePairingMode);
    btn.textContent = edgePairingMode ? "Cancel edge…" : "Add edge…";
  }

  function updateEdgeHint() {
    const el = document.getElementById("edge-mode-hint");
    if (!el) return;
    if (!edgePairingMode) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    if (pendingEdge) {
      el.textContent = "Style the connection below, then Add connection or Cancel.";
      return;
    }
    if (!edgeFromId) el.textContent = "Click the first node…";
    else el.textContent = "Click the second node…";
  }

  function handleNodeClickForEdge(nodeId) {
    if (!edgeFromId) {
      edgeFromId = nodeId;
      updateEdgeHint();
      return;
    }
    if (edgeFromId === nodeId) {
      edgeFromId = null;
      updateEdgeHint();
      return;
    }
    pendingEdge = { from: edgeFromId, to: nodeId };
    edgeFromId = null;
    const panel = document.getElementById("add-edge-panel");
    if (panel) panel.hidden = false;
    updateEdgeHint();
  }

  function syncRingNodeXY(nodeId) {
    const node = nodeMap.get(nodeId);
    const found = findRingNodeRecord(nodeId);
    if (node && found && typeof node.layoutX === "number" && typeof node.layoutY === "number") {
      found.node.x = node.layoutX;
      found.node.y = node.layoutY;
      if (editMode && components) {
        components.display = components.display || {};
        components.display.layout = "interactive";
        components.display.useSavedPositions = true;
      }
    }
  }

  function startNodeDrag(e, nodeId) {
    const node = nodeMap.get(nodeId);
    if (!node || !svg) return;
    const grp = e.currentTarget;
    draggingNodeId = nodeId;
    grp.classList.add("dragging");
    const startPt = svgPoint(e.clientX, e.clientY);
    const pos = nodePos(node);
    const ox = typeof node.layoutX === "number" ? node.layoutX : pos.x;
    const oy = typeof node.layoutY === "number" ? node.layoutY : pos.y;
    node.layoutX = ox;
    node.layoutY = oy;
    node.layoutRadius = estimatedNodeRadius(node);
    nodeDragMoved = false;
    let dragRaf = null;

    const onMove = (ev) => {
      const cur = svgPoint(ev.clientX, ev.clientY);
      if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > 3) nodeDragMoved = true;
      const dx = cur.x - startPt.x;
      const dy = cur.y - startPt.y;
      node.layoutX = ox + dx;
      node.layoutY = oy + dy;
      clampNodeToCanvas(node);
      node.layoutRadius = estimatedNodeRadius(node);
      syncRingNodeXY(nodeId);
      if (dragRaf) cancelAnimationFrame(dragRaf);
      dragRaf = requestAnimationFrame(() => {
        renderNodes();
        renderBaseEdges();
        renderTrustMembranes();
        renderRoutes();
        renderZoneHalos();
        dragRaf = null;
      });
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      draggingNodeId = null;
      document
        .querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`)
        ?.classList.remove("dragging");
      syncRingNodeXY(nodeId);
      renderNodes();
      renderBaseEdges();
      renderTrustMembranes();
      renderRoutes();
      renderZoneHalos();
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function renderNodes() {
    const gShapes = document.getElementById("layer-nodes");
    const gLabels = document.getElementById("layer-node-labels");
    if (!gShapes || !gLabels) return;
    gShapes.innerHTML = "";
    gLabels.innerHTML = "";

    nodeMap.forEach((node) => {
      const p = nodePos(node);
      const type = node.type || "default";
      const grp = document.createElementNS(NS, "g");
      grp.setAttribute("class", "topology-node-group");
      grp.setAttribute("transform", `translate(${p.x},${p.y})`);
      grp.dataset.nodeId = node.id;

      appendNodeDot(grp, type);

      grp.addEventListener("mouseenter", (e) => showTooltip(e, node, p.x, p.y));
      grp.addEventListener("mousemove", moveTooltip);
      grp.addEventListener("mouseleave", hideTooltip);
      grp.addEventListener("click", (ev) => {
        if (editMode && edgePairingMode) {
          ev.stopPropagation();
          handleNodeClickForEdge(node.id);
          return;
        }
        if (nodeDragMoved) {
          nodeDragMoved = false;
          return;
        }
        toggleNodeFocus(node.id);
      });
      grp.addEventListener("mousedown", (ev) => {
        if (!editMode) return;
        ev.stopPropagation();
        startNodeDrag(ev, node.id);
      });

      gShapes.appendChild(grp);

      const lines = wrapLabelLines(node.label, 18);
      const lineHeight = 0.92;
      const fontSize = 0.78;
      const topY = p.y + dotBottom(type) + 0.28;

      lines.forEach((line, i) => {
        const text = document.createElementNS(NS, "text");
        text.setAttribute("x", String(p.x));
        text.setAttribute("y", String(topY + i * lineHeight));
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "hanging");
        text.setAttribute("class", "node-label");
        text.setAttribute("font-size", String(fontSize));
        text.setAttribute("font-weight", "600");
        text.setAttribute("letter-spacing", "0.03");
        text.setAttribute("font-family", "IBM Plex Sans, Inter, system-ui, sans-serif");
        text.setAttribute("pointer-events", "none");
        text.textContent = line;
        gLabels.appendChild(text);
      });
    });
  }

  function renderLegendShapes() {
    const el = document.getElementById("legend-shapes");
    if (!el) return;
    el.innerHTML = "";
    for (const row of DOT_LEGEND) {
      const li = document.createElement("li");
      li.className = "legend-shape-row";

      const mini = document.createElementNS(NS, "svg");
      mini.setAttribute("viewBox", "-2.4 -2.4 4.8 4.8");
      mini.setAttribute("width", "36");
      mini.setAttribute("height", "36");
      mini.classList.add("legend-shape-svg");
      const mg = document.createElementNS(NS, "g");
      appendNodeDot(mg, row.type);
      mini.appendChild(mg);

      const span = document.createElement("span");
      span.className = "legend-shape-caption";
      span.textContent = row.caption;

      li.appendChild(mini);
      li.appendChild(span);
      el.appendChild(li);
    }
  }

  let focusedNodeId = null;

  function neighborsOf(nodeId) {
    if (!components) return new Set();
    const s = new Set();
    for (const e of components.edges) {
      if (e.from === nodeId) s.add(e.to);
      if (e.to === nodeId) s.add(e.from);
    }
    return s;
  }

  function toggleNodeFocus(nodeId) {
    focusedNodeId = focusedNodeId === nodeId ? null : nodeId;
    const neighbors = focusedNodeId ? neighborsOf(focusedNodeId) : null;
    document.querySelectorAll(".topology-node-group").forEach((g) => {
      const id = g.dataset.nodeId;
      if (!neighbors) {
        g.style.opacity = "";
      } else {
        g.style.opacity = id === focusedNodeId || neighbors.has(id) ? "1" : "0.25";
      }
    });
    document.querySelectorAll(".base-edge-group").forEach((grp) => {
      if (!neighbors) {
        grp.style.opacity = "";
      } else {
        const f = grp.dataset.from;
        const t = grp.dataset.to;
        const connected = f === focusedNodeId || t === focusedNodeId;
        grp.style.opacity = connected ? "1" : "0.12";
      }
    });
    document.querySelectorAll(".node-label").forEach((lbl) => {
      lbl.style.opacity = neighbors ? "0.3" : "";
    });
    if (focusedNodeId) {
      const focusNode = nodeMap.get(focusedNodeId);
      if (focusNode) {
        const p = nodePos(focusNode);
        document.querySelectorAll(".node-label").forEach((lbl) => {
          const lx = parseFloat(lbl.getAttribute("x"));
          const ly = parseFloat(lbl.getAttribute("y"));
          const close = neighbors
            ? [...neighbors, focusedNodeId].some((nid) => {
                const n = nodeMap.get(nid);
                if (!n) return false;
                const np = nodePos(n);
                return Math.abs(np.x - lx) < 1 && Math.abs(np.y - ly) < 8;
              })
            : false;
          lbl.style.opacity = close ? "1" : "0.2";
        });
      }
    }
  }

  function clearNodeFocus() {
    focusedNodeId = null;
    document.querySelectorAll(".topology-node-group").forEach((g) => {
      g.style.opacity = "";
    });
    document.querySelectorAll(".base-edge-group").forEach((grp) => {
      grp.style.opacity = "";
    });
    document.querySelectorAll(".node-label").forEach((lbl) => {
      lbl.style.opacity = "";
    });
  }

  const tooltipEl = document.getElementById("tooltip");

  function showTooltip(evt, node, _sx, _sy) {
    if (!tooltipEl) return;
    tooltipEl.hidden = false;
    tooltipEl.innerHTML = `<div class="tooltip__meta">NODE</div><strong class="tooltip__title">${escapeHtml(node.label)}</strong><span class="tooltip__ring">${escapeHtml(
      node.ringLabel
    )}</span><div class="tooltip__id">${escapeHtml(node.id)} · ${escapeHtml(node.type)}</div>`;
    moveTooltip(evt);
  }

  function moveTooltip(evt) {
    if (!tooltipEl || tooltipEl.hidden) return;
    const wrap = document.querySelector(".canvas-wrap");
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    let left = evt.clientX - rect.left + 12;
    let top = evt.clientY - rect.top + 12;
    if (left > rect.width - 200) left -= 180;
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.hidden = true;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderLegendEdges() {
    const el = document.getElementById("legend-edges");
    if (!el || !components || !components.styleGuide) return;
    el.innerHTML = "";
    const sg = components.styleGuide;
    const entries = [
      ["solid", sg.solid],
      ["dashed", sg.dashed],
      ["dotted", sg.dotted],
    ];
    for (const [key, label] of entries) {
      const li = document.createElement("li");
      const sw = document.createElement("span");
      sw.className = "legend__swatch legend__swatch--" + key;
      if (key === "solid") sw.style.background = "#5c6b82";
      li.appendChild(sw);
      const span = document.createElement("span");
      span.textContent = label;
      li.appendChild(span);
      el.appendChild(li);
    }
  }

  function syncCheckboxDisabled() {
    const atMax = selectedRouteIds.length >= MAX_ROUTES;
    document.querySelectorAll(".route-item input[type=checkbox]").forEach((cb) => {
      if (!cb.checked && atMax) cb.disabled = true;
      else cb.disabled = false;
    });
    const counter = document.getElementById("route-counter");
    if (counter) counter.textContent = `${selectedRouteIds.length} / ${MAX_ROUTES}`;
  }

  function renderRoutePanel() {
    const host = document.getElementById("route-groups");
    if (!host || !routesPayload) return;
    const routes = [...(routesPayload.routes || [])].sort((a, b) => {
      const mo = MODE_ORDER[a.mode] - MODE_ORDER[b.mode];
      if (mo !== 0) return mo;
      return a.label.localeCompare(b.label);
    });

    const groups = { security: [], observability: [], platform: [] };
    for (const r of routes) {
      if (groups[r.mode]) groups[r.mode].push(r);
    }

    host.innerHTML = "";
    for (const mode of ["security", "observability", "platform"]) {
      const list = groups[mode];
      if (!list || list.length === 0) continue;
      const section = document.createElement("div");
      section.className = "route-group";
      const title = document.createElement("div");
      title.className = "route-group__title";
      title.textContent = MODE_LABELS[mode];
      section.appendChild(title);
      for (const route of list) {
        const label = document.createElement("label");
        label.className = "route-item";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.dataset.routeId = route.id;
        input.checked = selectedRouteIds.includes(route.id);
        input.addEventListener("change", () => {
          if (input.checked) {
            if (selectedRouteIds.length >= MAX_ROUTES) {
              const first = selectedRouteIds.shift();
              const prev = document.querySelector(
                `input[data-route-id="${first}"]`
              );
              if (prev) prev.checked = false;
            }
            selectedRouteIds.push(route.id);
          } else {
            selectedRouteIds = selectedRouteIds.filter((x) => x !== route.id);
          }
          syncCheckboxDisabled();
          renderRoutes();
        });
        const span = document.createElement("span");
        span.innerHTML = `${escapeHtml(route.label)}<small>${escapeHtml(
          route.description || ""
        )}</small>`;
        label.appendChild(input);
        label.appendChild(span);
        section.appendChild(label);
      }
      host.appendChild(section);
    }
    syncCheckboxDisabled();
  }

  function presetMixed() {
    const routes = routesPayload && routesPayload.routes;
    if (!routes || routes.length < 12) return;
    const pick = (mode) => routes.find((r) => r.mode === mode);
    selectedRouteIds = [];
    const a = pick("security");
    const b = routes.filter((r) => r.mode === "security")[1];
    const c = pick("observability");
    const d = pick("platform");
    if (a) selectedRouteIds.push(a.id);
    if (c) selectedRouteIds.push(c.id);
    if (d) selectedRouteIds.push(d.id);
    if (b) selectedRouteIds.push(b.id);
    document.querySelectorAll(".route-item input[type=checkbox]").forEach((cb) => {
      cb.checked = selectedRouteIds.includes(cb.dataset.routeId);
    });
    syncCheckboxDisabled();
    renderRoutes();
  }

  function clearRoutes() {
    selectedRouteIds = [];
    document.querySelectorAll(".route-item input[type=checkbox]").forEach((cb) => {
      cb.checked = false;
    });
    syncCheckboxDisabled();
    renderRoutes();
  }

  function buildGenerativePipePayload() {
    if (!components) return null;
    const nodes = [];
    nodeMap.forEach((node) => {
      const p = nodePos(node);
      nodes.push({
        id: node.id,
        label: node.label || "",
        type: node.type || "default",
        ringId: node.ringId || "",
        x: Number(p.x) || 0,
        y: Number(p.y) || 0,
      });
    });
    const edges = (components.edges || []).map((e) => ({
      from: e.from,
      to: e.to,
      style: e.style || "solid",
      trustBoundary: Boolean(e.trustBoundary),
      midLabel: e.midLabel || "",
    }));
    const routes = (routesPayload?.routes || []).map((r) => ({
      id: r.id,
      label: r.label || "",
      nodes: Array.isArray(r.nodes) ? [...r.nodes] : [],
      attackSteps: Array.isArray(r.attackSteps)
        ? r.attackSteps.map((step) => ({
            step: Number(step.step) || 0,
            title: step.title || "",
            tool: step.tool || "",
            nodes: Array.isArray(step.nodes) ? [...step.nodes] : [],
          }))
        : [],
      mode: r.mode || "",
    }));
    const zoneHalos = (components.zoneHalos || []).map((z) => ({
      ringId: z.ringId || "",
      label: z.label || "",
      padding: Number(z.padding) || 1.3,
      rx: Number(z.rx) || 1.2,
      strokeColor: z.strokeColor || "#00bceb",
      fillColor: z.fillColor || "rgba(0,188,235,0.06)",
    }));
    const toggleGrid = document.getElementById("toggle-grid");
    const toggleTrust = document.getElementById("toggle-trust-zones");
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      view: { width: VIEW_W, height: VIEW_H },
      display: {
        showGrid: Boolean(toggleGrid && toggleGrid.checked),
        showTrustZones: Boolean(toggleTrust ? toggleTrust.checked : true),
      },
      selectedRouteIds: [...selectedRouteIds],
      nodes,
      edges,
      routes,
      zoneHalos,
      routeColors: Array.isArray(routesPayload?.routeColors)
        ? [...routesPayload.routeColors]
        : [],
    };
  }

  function publishGenerativePipe() {
    const payload = buildGenerativePipePayload();
    if (!payload) return;
    try {
      localStorage.setItem(GENERATIVE_PIPE_KEY, JSON.stringify(payload));
    } catch (_) {
      /* ignore storage failures */
    }
  }

  function redrawStatic() {
    buildNodeMap(components);
    const layoutMode = components?.display?.layout;
    if (layoutMode !== "grid") {
      applyGraphLayout(components);
    }
    if (svg) svg.classList.toggle("edit-mode", editMode);
    if (svg) svg.classList.toggle("place-pending", Boolean(placePalettePending));
    renderGrid(document.getElementById("toggle-grid")?.checked ?? false);
    renderZoneHalos();
    renderTrustMembranes();
    renderBaseEdges();
    renderNodes();
    renderLegendEdges();
    renderLegendShapes();
    renderRoutes();
    publishGenerativePipe();
  }

  function setEditorUiEnabled(on) {
    for (const id of ["btn-edge-mode", "btn-relayout", "btn-export-json"]) {
      const b = document.getElementById(id);
      if (b) b.disabled = !on;
    }
  }

  function addNodeAt(ringId, type, label, x, y) {
    if (!components || !components.rings) return;
    const ring = components.rings.find((r) => r.id === ringId);
    if (!ring) return;
    const id = `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const cell = { col: Math.floor(x / CELL), row: Math.floor(y / CELL) };
    const node = {
      id,
      label: label || "New",
      type: type || "service",
      col: clamp(cell.col, 0, 11),
      row: clamp(cell.row, 0, 4),
      x,
      y,
    };
    if (!ring.nodes) ring.nodes = [];
    ring.nodes.push(node);
    components.display = components.display || {};
    components.display.layout = "interactive";
    components.display.useSavedPositions = true;
    buildNodeMap(components);
    applyGraphLayout(components);
    redrawStatic();
    fitViewToExtents();
  }

  function exportComponentsJson() {
    if (!components) return;
    syncAllPositionsToRingData();
    const out = JSON.parse(JSON.stringify(components));
    out.display = out.display || {};
    out.display.layout = "interactive";
    out.display.useSavedPositions = true;
    for (const ring of out.rings || []) {
      for (const n of ring.nodes || []) {
        const nm = nodeMap.get(n.id);
        if (nm && typeof nm.layoutX === "number" && typeof nm.layoutY === "number") {
          n.x = nm.layoutX;
          n.y = nm.layoutY;
        }
      }
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = "components.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function relayoutFromScratch() {
    if (!components || !components.rings) return;
    for (const ring of components.rings) {
      for (const n of ring.nodes || []) {
        delete n.x;
        delete n.y;
      }
    }
    components.display = components.display || {};
    components.display.layout = "concentric-trust";
    delete components.display.useSavedPositions;
    selectedEdgeIndex = null;
    pendingEdge = null;
    edgePairingMode = false;
    edgeFromId = null;
    const panel = document.getElementById("add-edge-panel");
    if (panel) panel.hidden = true;
    syncEdgeModeButton();
    updateEdgeHint();
    buildNodeMap(components);
    applyGraphLayout(components);
    redrawStatic();
    fitViewToExtents();
  }

  function deleteSelectedEdge() {
    if (selectedEdgeIndex === null || !components || !components.edges) return;
    const ix = selectedEdgeIndex;
    if (ix < 0 || ix >= components.edges.length) return;
    components.edges.splice(ix, 1);
    selectedEdgeIndex = null;
    redrawStatic();
  }

  function cancelAddEdgePanel() {
    pendingEdge = null;
    const panel = document.getElementById("add-edge-panel");
    if (panel) panel.hidden = true;
    edgeFromId = null;
    updateEdgeHint();
  }

  function confirmAddEdgeFromPanel() {
    if (!pendingEdge || !components) return;
    if (!components.edges) components.edges = [];
    const styleSel = document.getElementById("new-edge-style");
    const trustCb = document.getElementById("new-edge-trust");
    const midInput = document.getElementById("new-edge-midlabel");
    const style = (styleSel && styleSel.value) || "solid";
    const trust = trustCb && trustCb.checked;
    const midLabel = (midInput && midInput.value.trim()) || "";
    const edge = {
      from: pendingEdge.from,
      to: pendingEdge.to,
      style,
    };
    if (trust) edge.trustBoundary = true;
    if (midLabel) edge.midLabel = midLabel;
    components.edges.push(edge);
    pendingEdge = null;
    const panel = document.getElementById("add-edge-panel");
    if (panel) panel.hidden = true;
    edgeFromId = null;
    updateEdgeHint();
    redrawStatic();
  }

  const PALETTE_TEMPLATES = [
    { type: "endpoint", ringId: "application", label: "Endpoint" },
    { type: "service", ringId: "application", label: "Service" },
    { type: "security", ringId: "network-enforcement", label: "New control" },
    { type: "network", ringId: "network-enforcement", label: "Network path" },
    { type: "platform", ringId: "soc-platform", label: "Platform" },
    { type: "data", ringId: "core", label: "Data asset" },
    { type: "external", ringId: "external", label: "External" },
  ];

  function draftNewNodeLabel(fallback) {
    const input = /** @type {HTMLInputElement | null} */ (
      document.getElementById("new-node-label")
    );
    const typed = input ? input.value.trim() : "";
    return typed || fallback || "New";
  }

  function initPalette() {
    const host = document.getElementById("palette");
    if (!host) return;
    host.innerHTML = "";
    for (const tpl of PALETTE_TEMPLATES) {
      const el = document.createElement("div");
      el.className = "palette-item";
      el.setAttribute("draggable", "true");
      el.dataset.ringId = tpl.ringId;
      el.dataset.type = tpl.type;
      el.dataset.label = tpl.label;
      el.innerHTML = `<span>${escapeHtml(tpl.label)}</span> <kbd>${escapeHtml(tpl.type)}</kbd>`;
      el.addEventListener("dragstart", (e) => {
        if (!editMode) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData(
          "application/json",
          JSON.stringify({
            type: tpl.type,
            ringId: tpl.ringId,
            label: draftNewNodeLabel(tpl.label),
          })
        );
        e.dataTransfer.effectAllowed = "copy";
      });
      el.addEventListener("click", (e) => {
        if (!editMode) return;
        e.preventDefault();
        placePalettePending = {
          type: tpl.type,
          ringId: tpl.ringId,
          label: draftNewNodeLabel(tpl.label),
        };
        redrawStatic();
      });
      host.appendChild(el);
    }
  }

  function initEditor() {
    initPalette();
    const toggleEdit = document.getElementById("toggle-edit-mode");
    if (toggleEdit) {
      toggleEdit.addEventListener("change", (e) => {
        editMode = /** @type {HTMLInputElement} */ (e.target).checked;
        setEditorUiEnabled(editMode);
        if (!editMode) {
          edgePairingMode = false;
          edgeFromId = null;
          pendingEdge = null;
          placePalettePending = null;
          const panel = document.getElementById("add-edge-panel");
          if (panel) panel.hidden = true;
          syncEdgeModeButton();
          updateEdgeHint();
        }
        redrawStatic();
      });
    }
    setEditorUiEnabled(false);

    document.getElementById("btn-edge-mode")?.addEventListener("click", () => {
      if (!editMode) return;
      if (edgePairingMode) {
        edgePairingMode = false;
        edgeFromId = null;
        pendingEdge = null;
        const panel = document.getElementById("add-edge-panel");
        if (panel) panel.hidden = true;
      } else {
        edgePairingMode = true;
        edgeFromId = null;
        pendingEdge = null;
        const panel = document.getElementById("add-edge-panel");
        if (panel) panel.hidden = true;
      }
      syncEdgeModeButton();
      updateEdgeHint();
    });

    document.getElementById("btn-add-edge-confirm")?.addEventListener("click", confirmAddEdgeFromPanel);
    document.getElementById("btn-add-edge-cancel")?.addEventListener("click", cancelAddEdgePanel);

    document.getElementById("btn-export-json")?.addEventListener("click", () => {
      if (!editMode) return;
      exportComponentsJson();
    });

    document.getElementById("btn-relayout")?.addEventListener("click", () => {
      if (!editMode) return;
      relayoutFromScratch();
    });

    document.getElementById("btn-open-generative")?.addEventListener("click", () => {
      publishGenerativePipe();
      const u = new URL("./orion.html", window.location.href);
      window.open(u.href, "_blank", "noopener,noreferrer");
    });

    window.addEventListener("keydown", (e) => {
      if (!editMode) return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedEdgeIndex !== null) {
          e.preventDefault();
          deleteSelectedEdge();
        }
      }
    });
  }

  function initDrawerUi() {
    const btn = document.getElementById("btn-toggle-drawer");
    if (!btn) return;
    const setState = (open) => {
      document.body.classList.toggle("drawer-collapsed", !open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.textContent = open ? "Hide editor" : "Show editor";
    };
    setState(!document.body.classList.contains("drawer-collapsed"));
    btn.addEventListener("click", () => {
      const open = document.body.classList.contains("drawer-collapsed");
      setState(open);
    });
  }

  async function load() {
    const cUrl = new URL("../components.json", window.location.href).href;
    const rUrl = new URL("../routes.json", window.location.href).href;

    const [cRes, rRes] = await Promise.all([fetch(cUrl), fetch(rUrl)]);
    if (!cRes.ok) throw new Error("Failed to load components.json");
    if (!rRes.ok) throw new Error("Failed to load routes.json");
    components = await cRes.json();
    routesPayload = await rRes.json();
  }

  function initPanZoom() {
    svg = document.getElementById("topology-svg");
    if (!svg) return;

    svg.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const pt = svgPoint(e.clientX, e.clientY);
        const zoom = e.deltaY > 0 ? 1.09 : 1 / 1.09;
        let nw = viewBox.w * zoom;
        let nh = viewBox.h * zoom;
        if (nw < 25 || nw > 600) return;
        viewBox.x = pt.x - (pt.x - viewBox.x) * zoom;
        viewBox.y = pt.y - (pt.y - viewBox.y) * zoom;
        viewBox.w = nw;
        viewBox.h = nh;
        setViewBoxAttr();
      },
      { passive: false }
    );

    svg.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (editMode && e.target && /** @type {Element} */ (e.target).closest) {
        const t = /** @type {Element} */ (e.target);
        if (
          t.closest(".topology-node-group") ||
          t.closest(".base-edge-hit")
        ) {
          return;
        }
      }
      dragging = true;
      dragLast = svgPoint(e.clientX, e.clientY);
    });

    svg.addEventListener("click", (e) => {
      if (!editMode) return;
      const t = e.target instanceof Element ? e.target : null;
      if (!t || !t.closest) return;
      const onNode = t.closest(".topology-node-group");
      const onEdgeHit = t.closest(".base-edge-hit");
      if (placePalettePending && !onNode && !onEdgeHit) {
        const pt = svgPoint(e.clientX, e.clientY);
        const p = placePalettePending;
        placePalettePending = null;
        addNodeAt(p.ringId, p.type, p.label, pt.x, pt.y);
        return;
      }
      if (placePalettePending) return;
      if (!onNode && !onEdgeHit) {
        selectedEdgeIndex = null;
        clearNodeFocus();
        renderBaseEdges();
      }
    });

    svg.addEventListener(
      "dragover",
      (e) => {
        if (!editMode) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      },
      false
    );

    svg.addEventListener("drop", (e) => {
      if (!editMode) return;
      e.preventDefault();
      const raw = e.dataTransfer.getData("application/json");
      if (!raw) return;
      try {
        const tpl = JSON.parse(raw);
        if (tpl.ringId && tpl.type) {
          const pt = svgPoint(e.clientX, e.clientY);
          addNodeAt(tpl.ringId, tpl.type, tpl.label || "New", pt.x, pt.y);
        }
      } catch (_) {
        /* ignore */
      }
    });

    window.addEventListener("mouseup", () => {
      dragging = false;
      dragLast = null;
    });

    window.addEventListener("mousemove", (e) => {
      if (!dragging || !dragLast || !svg) return;
      const cur = svgPoint(e.clientX, e.clientY);
      viewBox.x += dragLast.x - cur.x;
      viewBox.y += dragLast.y - cur.y;
      dragLast = cur;
      setViewBoxAttr();
    });

    svg.addEventListener("dblclick", fitViewToExtents);
  }

  function injectGridStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .grid-line { stroke: rgba(91, 122, 154, 0.16); stroke-width: 0.05; pointer-events: none; }
      .grid-line--major { stroke: rgba(0, 80, 115, 0.14); stroke-width: 0.075; }
      .base-edge-spine { vector-effect: non-scaling-stroke; }
      .route-edge-glow { pointer-events: none; }
      .route-edge { pointer-events: none; }
      .node-label { fill: #061424; paint-order: stroke fill; stroke: rgba(255,255,255,0.92); stroke-width: 0.1; font-weight: 600; letter-spacing: 0.03em; font-family: "IBM Plex Sans", Inter, system-ui, sans-serif; }
      .topology-node-group { cursor: default; }
      .edge-mid-label { paint-order: stroke fill; stroke: rgba(255,255,255,0.88); stroke-width: 0.07; font-weight: 600; letter-spacing: 0.12em; }
      .membrane-label { paint-order: stroke fill; stroke: rgba(255,255,255,0.9); stroke-width: 0.08; font-weight: 600; fill: #005073; }
      .zone-halo-label { fill: #061424; paint-order: stroke fill; stroke: rgba(255,255,255,0.85); stroke-width: 0.05; pointer-events: none; opacity: 0.75; }
      .base-edge-group:hover .base-edge-strand { stroke-opacity: 0.95 !important; }
      .base-edge-group:hover .base-edge-spine { stroke-opacity: 0.1 !important; }
    `;
    document.head.appendChild(style);
  }

  async function main() {
    injectGridStyles();
    initDrawerUi();
    const panelTitle = document.getElementById("panel-topology-title");
    try {
      await load();
      if (panelTitle) panelTitle.textContent = components.name || "Master topology";
      initPanZoom();
      initEditor();
      redrawStatic();
      fitViewToExtents();
      renderRoutePanel();

      document.getElementById("toggle-grid")?.addEventListener("change", (e) => {
        renderGrid(/** @type {HTMLInputElement} */ (e.target).checked);
        publishGenerativePipe();
      });

      document.getElementById("toggle-connectors")?.addEventListener("change", (e) => {
        const show = /** @type {HTMLInputElement} */ (e.target).checked;
        const vis = show ? "" : "none";
        const baseEdges = document.getElementById("layer-base-edges");
        const edgeLabels = document.getElementById("layer-edge-labels");
        if (baseEdges) baseEdges.style.display = vis;
        if (edgeLabels) edgeLabels.style.display = vis;
      });

      document.getElementById("toggle-trust-zones")?.addEventListener("change", (e) => {
        const show = /** @type {HTMLInputElement} */ (e.target).checked;
        const vis = show ? "" : "none";
        const halos = document.getElementById("layer-zone-halos");
        const membranes = document.getElementById("layer-trust-membranes");
        if (halos) halos.style.display = vis;
        if (membranes) membranes.style.display = vis;
        publishGenerativePipe();
      });

      document.getElementById("btn-preset")?.addEventListener("click", presetMixed);
      document.getElementById("btn-clear-routes")?.addEventListener("click", clearRoutes);
      document.getElementById("btn-reset-view")?.addEventListener("click", fitViewToExtents);

      presetMixed();
    } catch (err) {
      console.error(err);
      if (panelTitle) {
        panelTitle.textContent = "Failed to load topology";
      }
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent =
        String(err.message) +
        " — serve this folder over HTTP (see README), or check paths to JSON.";
      document.querySelector(".panel")?.appendChild(p);
    }
  }

  main();
})();
