/**
 * Floating blue field + warped dot grid — shared by Eridanus (eridanus.html) view.
 * Exposes window.GenerativeFieldBg for generative.js integration.
 */
(function () {
  "use strict";

  // Background blend target: 80% Cisco Midnight Blue, 10% Medium Blue, 10% Cisco Blue.
  const BG_DEEP = [3, 16, 52];
  const BG_MID = [12, 128, 255];
  const BG_ANCHOR = [7, 24, 45];

  const FLOAT_PALETTE = [
    [110, 210, 255],
    [72, 178, 255],
    [48, 155, 248],
    [26, 132, 246],
    [92, 204, 255],
    [58, 190, 255],
  ];

  function rgba(arr, a) {
    return `rgba(${arr[0]},${arr[1]},${arr[2]},${a})`;
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

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  let blobs = [];
  let blobSeed = 0x9e3779b9;
  let lastW = 0;
  let lastH = 0;

  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function initBlobs(w, h) {
    const rng = mulberry32(blobSeed);
    const d = Math.min(w, h);
    const n = 7;
    blobs = [];
    for (let i = 0; i < n; i++) {
      const col = FLOAT_PALETTE[i % FLOAT_PALETTE.length];
      const phase = rng() * Math.PI * 2;
      const speed = 0.08 + rng() * 0.11;
      const rx = (0.18 + rng() * 0.32) * w;
      const ry = (0.16 + rng() * 0.30) * h;
      const cx0 = rng() * w;
      const cy0 = rng() * h;
      blobs.push({
        col,
        phase,
        speed,
        cx0,
        cy0,
        rx,
        ry,
        sigma: d * (0.14 + rng() * 0.12),
        alpha: 0.07 + rng() * 0.09,
        warp: 22 + rng() * 38,
        fx: 0.7 + rng() * 0.9,
        fy: 0.6 + rng() * 0.85,
        rot: (rng() - 0.5) * 0.4,
      });
    }
  }

  function blobCenter(b, t, w, h) {
    const tt = t * b.speed + b.phase;
    const lax = 0.5 + 0.5 * Math.sin(tt * b.fx + b.rot);
    const lay = 0.5 + 0.5 * Math.cos(tt * b.fy - b.rot * 1.3);
    const bx = b.cx0 + Math.sin(tt * 0.73 + 1.1) * b.rx * 0.35 + (lax - 0.5) * b.rx * 1.1;
    const by = b.cy0 + Math.cos(tt * 0.69 - 0.4) * b.ry * 0.35 + (lay - 0.5) * b.ry * 1.1;
    const pad = b.sigma * 2.5;
    return {
      x: clamp(bx, -pad, w + pad),
      y: clamp(by, -pad, h + pad),
    };
  }

  function fieldInfluence(x, y, t, w, h) {
    let s = 0;
    for (const b of blobs) {
      const c = blobCenter(b, t, w, h);
      const dx = x - c.x;
      const dy = y - c.y;
      const d2 = dx * dx + dy * dy;
      s += Math.exp(-d2 / (2 * b.sigma * b.sigma));
    }
    return clamp(s, 0, 3);
  }

  function warpPoint(x, y, t, w, h) {
    let dx = 0;
    let dy = 0;
    for (const b of blobs) {
      const c = blobCenter(b, t, w, h);
      const px = x - c.x;
      const py = y - c.y;
      const dist = Math.hypot(px, py) + 0.5;
      const g = Math.exp(-(dist * dist) / (2 * b.sigma * b.sigma));
      const tx = -py / dist;
      const ty = px / dist;
      const amp = b.warp * g;
      dx += tx * amp;
      dy += ty * amp;
    }
    const breath = 0.45 * Math.sin(t * 0.15 + x * 0.0012) * Math.cos(t * 0.11 - y * 0.001);
    dx += breath * 3.2;
    dy += breath * 2.4;
    return { x: x + dx, y: y + dy };
  }

  function drawBaseGradient(ctx, w, h, t) {
    const driftX = Math.sin(t * 0.09) * 0.08 + Math.sin(t * 0.031) * 0.04;
    const driftY = Math.cos(t * 0.074) * 0.06;
    const g = ctx.createLinearGradient(
      -w * (0.02 + driftX),
      h * (1.02 - driftY),
      w * (1.03 + driftX),
      -h * 0.02
    );
    g.addColorStop(0, rgba(lerpColor(BG_DEEP, [1, 10, 36], 0.85), 1));
    g.addColorStop(0.42, rgba(lerpColor(BG_ANCHOR, BG_MID, 0.38), 1));
    g.addColorStop(1, rgba(lerpColor(BG_ANCHOR, BG_DEEP, 0.42), 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawFloatingBlues(ctx, w, h, t) {
    const d = Math.min(w, h);
    for (const b of blobs) {
      const c = blobCenter(b, t, w, h);
      const r = b.sigma * 2.8;
      const rg = ctx.createRadialGradient(c.x, c.y, r * 0.04, c.x, c.y, r);
      const inner = rgba(b.col, b.alpha + 0.04);
      const mid = rgba(lerpColor(b.col, BG_MID, 0.35), b.alpha * 0.55);
      rg.addColorStop(0, inner);
      rg.addColorStop(0.45, mid);
      rg.addColorStop(1, rgba(b.col, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }
    const hilight = 0.04 + 0.03 * (0.5 + 0.5 * Math.sin(t * 0.12));
    const hx = w * (0.35 + 0.2 * Math.sin(t * 0.047 + 0.2));
    const hy = h * (0.42 + 0.18 * Math.cos(t * 0.051 - 0.5));
    const hg = ctx.createRadialGradient(hx, hy, d * 0.02, hx, hy, d * 0.55);
    hg.addColorStop(0, `rgba(120, 210, 255,${hilight})`);
    hg.addColorStop(0.55, `rgba(40, 140, 230,${hilight * 0.45})`);
    hg.addColorStop(1, "rgba(20, 90, 200, 0)");
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, w, h);
  }

  function hash2d(ix, iy) {
    let x = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263);
    x = (x ^ (x >>> 13)) >>> 0;
    return x;
  }

  /**
   * Warped particle weave: thousands of tiny grains on a lattice + thread crawlers,
   * shimmer and drift — fabric-like but clearly particulate.
   */
  function drawWarpedDotGrid(ctx, w, h, t) {
    const gridStep = 11;
    ctx.globalCompositeOperation = "source-over";

    const grainAlpha = (ix, iy, infl, sparkle) => {
      const sh =
        0.42 +
        0.58 * Math.sin(t * 1.28 + ix * 0.011 + iy * 0.009) *
          Math.cos(t * 0.88 - ix * 0.007 + iy * 0.013);
      const tw = 0.55 + 0.45 * Math.sin(t * 2.05 + (ix * 7 + iy * 11) * 0.048);
      let a = (0.028 + clamp(infl * 0.052, 0, 0.08)) * sh * tw;
      if (sparkle) a *= 1.45;
      return clamp(a, 0, 0.22);
    };

    for (let gy = 0; gy <= h + gridStep; gy += gridStep) {
      for (let gx = 0; gx <= w + gridStep; gx += gridStep) {
        const ix = gx + (gy % 2) * (gridStep * 0.5);
        const iy = gy;
        const h0 = hash2d(Math.floor(ix), Math.floor(iy));
        if ((h0 & 3) !== 0) continue;

        const driftX =
          Math.sin(t * 0.92 + iy * 0.014) * 1.05 + Math.sin(t * 0.41 + ix * 0.008) * 0.55;
        const driftY =
          Math.cos(t * 0.78 - gx * 0.012) * 0.95 + Math.cos(t * 0.55 + iy * 0.009) * 0.5;
        const p = warpPoint(ix + driftX, iy + driftY, t, w, h);
        if (p.x < -2 || p.y < -2 || p.x > w + 2 || p.y > h + 2) continue;

        const infl = fieldInfluence(ix, iy, t, w, h);
        const sparkle = (h0 % 61) === 0;
        const a = grainAlpha(ix, iy, infl, sparkle);
        const sz = sparkle ? 0.9 + (h0 & 15) / 40 : 0.55 + (h0 & 7) / 35;
        const c = sparkle ? 235 : 200 + (h0 & 31);
        ctx.fillStyle = `rgba(${c}, ${228 + (h0 & 7)}, 255, ${a})`;
        ctx.fillRect(p.x - sz * 0.5, p.y - sz * 0.5, sz, sz);
      }
    }

    const threadEvery = 20;
    const along = 6;
    for (let gy = 0; gy <= h; gy += threadEvery) {
      for (let gx = 0; gx <= w; gx += along) {
        const h1 = hash2d(gx * 3 + 17, gy * 5 + 3);
        if ((h1 & 15) > 4) continue;
        const phase = gx * 0.018 + gy * 0.014 + t * 0.55;
        const ix = gx + Math.sin(phase) * 1.15 + Math.sin(t * 0.33 + gy * 0.02) * 0.4;
        const iy = gy + Math.cos(phase * 1.07) * 0.85 + Math.cos(t * 0.29 - gx * 0.017) * 0.35;
        const p = warpPoint(ix, iy, t, w, h);
        const infl = fieldInfluence(ix, iy, t, w, h);
        const a = grainAlpha(ix, iy, infl, false) * 0.85;
        const sz = 0.5 + (h1 & 11) / 40;
        ctx.fillStyle = `rgba(192, 224, 255, ${a})`;
        ctx.fillRect(p.x - sz * 0.5, p.y - sz * 0.5, sz, sz);
      }
    }

    for (let gx = 0; gx <= w; gx += threadEvery) {
      for (let gy = 0; gy <= h; gy += along) {
        const h1 = hash2d(gx * 5 + 9, gy * 3 + 31);
        if ((h1 & 15) > 4) continue;
        const phase = gy * 0.018 + gx * 0.014 + t * 0.48;
        const ix = gx + Math.sin(phase * 1.1) * 1.1;
        const iy = gy + Math.cos(phase) * 0.9 + Math.sin(t * 0.38 + gx * 0.016) * 0.4;
        const p = warpPoint(ix, iy, t, w, h);
        const infl = fieldInfluence(ix, iy, t, w, h);
        const a = grainAlpha(ix, iy, infl, false) * 0.82;
        const sz = 0.5 + (h1 & 11) / 40;
        ctx.fillStyle = `rgba(188, 222, 252, ${a})`;
        ctx.fillRect(p.x - sz * 0.5, p.y - sz * 0.5, sz, sz);
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    const cx = w * (0.35 + 0.28 * Math.sin(t * 0.095 + 0.4));
    const cy = h * (0.42 + 0.22 * Math.cos(t * 0.088 - 0.3));
    const R = Math.max(w, h) * 0.62;
    const sheen = ctx.createRadialGradient(cx, cy, R * 0.02, cx, cy, R);
    const pulse = 0.045 + 0.035 * Math.sin(t * 0.62);
    sheen.addColorStop(0, `rgba(235, 248, 255, ${pulse})`);
    sheen.addColorStop(0.35, `rgba(120, 185, 240, ${pulse * 0.35})`);
    sheen.addColorStop(0.65, "rgba(30, 70, 140, 0.02)");
    sheen.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h);

    const gx2 = w * (0.62 + 0.2 * Math.cos(t * 0.072));
    const gy2 = h * (0.55 + 0.18 * Math.sin(t * 0.068));
    const g2 = ctx.createLinearGradient(gx2 - R, gy2, gx2 + R, gy2 - R * 0.4);
    g2.addColorStop(0, "rgba(255, 255, 255, 0)");
    g2.addColorStop(0.48, `rgba(200, 230, 255, ${0.04 + 0.03 * Math.sin(t * 0.9)})`);
    g2.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function drawVignette(ctx, w, h) {
    const g = ctx.createRadialGradient(
      w * 0.5,
      h * 0.48,
      Math.min(w, h) * 0.2,
      w * 0.5,
      h * 0.52,
      Math.max(w, h) * 0.72
    );
    g.addColorStop(0, "rgba(2, 8, 28, 0)");
    g.addColorStop(0.65, "rgba(2, 10, 32, 0.12)");
    g.addColorStop(1, "rgba(1, 6, 22, 0.38)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  window.GenerativeFieldBg = {
    ensureInit(w, h) {
      if (w !== lastW || h !== lastH || !blobs.length) {
        lastW = w;
        lastH = h;
        initBlobs(w, h);
      }
    },
    drawBackground(ctx, w, h, t) {
      drawBaseGradient(ctx, w, h, t);
      drawFloatingBlues(ctx, w, h, t);
    },
    drawDotGrid(ctx, w, h, t) {
      drawWarpedDotGrid(ctx, w, h, t);
    },
    drawVignette(ctx, w, h) {
      drawVignette(ctx, w, h);
    },
    randomizeField() {
      blobSeed = (Math.random() * 0xffffffff) >>> 0;
      if (lastW > 0 && lastH > 0) initBlobs(lastW, lastH);
    },
  };
})();
