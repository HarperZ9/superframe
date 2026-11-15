// The buildings behind the inner rooms (combat/arena/innerstage.mjs draws them in the order the stage lists them,
// back to front). Each is a colossal thing made of small repeated parts, the way Martin gives a palace its size:
// rows of windows too small to count, piers that run off the top of the frame, a stair, a dresser's plates. In
// values, darker toward the viewer, the side toward the shaft's source catching it. Original code.
//   BACK[name](V, g, G)   G: the stage geometry (stageGeom): xL, xR, yWall, yBack, src, st
import { gray, hash } from "./innerstage.mjs";

const IW = 640, S = 30;
const litSide = (G, x) => (G.src[0] > x ? 1 : -1);

// Martin's stepped palace: three tiers, the far ones paler (air between), windows in rows too small to count
function tiers(V, g, G) {
  const base = G.yWall, H = Math.max(40, base);
  const rows = [[0.92, 0.1, 0.075, 7], [0.66, 0.22, 0.06, 5], [0.42, 0.38, 0.045, 3]];
  for (const [top, inset, v, n] of rows.slice().reverse()) {
    const y0 = base - H * top;
    for (let b = 0; b < n; b++) {
      const w = (IW * (1 - inset * 0.6)) / n, x0 = IW * inset * 0.3 + b * w + (hash(b, n) - 0.5) * 10, h = H * top * (0.9 + 0.2 * hash(b, n, 3));
      g.fillStyle = gray(v + 0.02); g.fillRect(x0, base - h, w - 3, h);
      g.fillStyle = gray(v + 0.1); g.fillRect(litSide(G, x0 + w / 2) > 0 ? x0 + w - 5 : x0, base - h, 2, h);
      for (let y = base - h + 6; y < base - 6; y += 7) for (let x = x0 + 4; x < x0 + w - 7; x += 5) if (hash(x | 0, y | 0, n) > 0.55) { g.fillStyle = gray(v + 0.07 + 0.12 * hash(x | 0, y | 0)); g.fillRect(x, y, 1, 2); }
      g.fillStyle = gray(v - 0.01); g.fillRect(x0 - 2, base - h - 3, w + 1, 3);
    }
  }
}

// the scale-house wall (the weighted-devices pass, 2026-10-23: the pigeonholes of paper were a document wall): racks of
// iron weights rising past the frame, squat bells of iron in sizes, a lit top edge on each, gaps where one is out
function shelves(V, g, G) {
  const x0 = G.xL - 10, x1 = G.xR + 10, top = Math.max(0, G.yWall * 0.38);
  g.fillStyle = gray(0.04); g.fillRect(x0, top, x1 - x0, G.yWall - top);
  for (let y = G.yWall - 9, r = 0; y > top; y -= 9, r++) {
    g.fillStyle = gray(0.07); g.fillRect(x0, y + 7, x1 - x0, 2); // the rack's plank
    for (let x = x0 + 2, c = 0; x < x1 - 8; c++) {
      const w = 3 + ((hash(c, r, 5) * 4) | 0), h = Math.min(6, 2 + (w >> 1));
      if (hash(c, r, 9) > 0.18) { g.fillStyle = gray(0.02); g.fillRect(x, y + 7 - h, w, h); g.fillStyle = gray(0.12 + 0.16 * hash(c, r)); g.fillRect(x, y + 7 - h, w, 1); g.fillRect(x + (w >> 1), y + 6 - h, 1, 1); }
      x += w + 2;
    }
  }
  g.fillStyle = gray(0.08); g.fillRect(x0, top - 3, x1 - x0, 3);
}

// colossal pilasters across the building, off the top of the frame, with plinths and a lit edge
function pilasters(V, g, G) {
  const n = Math.max(3, Math.round((G.xR - G.xL) / 95) + 1), sp = (G.xR - G.xL + 40) / (n - 1);
  for (let i = 0; i < n; i++) {
    const x = G.xL - 20 + i * sp, w = 20;
    g.fillStyle = gray(0.05); g.fillRect(x - w / 2, 0, w, G.yWall);
    g.fillStyle = gray(0.065); g.fillRect(x - w / 2 - 4, G.yWall - 16, w + 8, 16); g.fillRect(x - w / 2 - 3, G.yWall * 0.18, w + 6, 6);
    g.fillStyle = gray(0.22); g.fillRect(litSide(G, x) > 0 ? x + w / 2 - 2 : x - w / 2, 0, 2, G.yWall - 16);
    g.fillStyle = gray(0.035); g.fillRect(x - 3, 0, 2, G.yWall - 16); g.fillRect(x + 3, 0, 1, G.yWall - 16);
  }
}

// a tall window in the wall: the shaft's own source (Only's noon sun, the kitchen's high light)
function window(V, g, G) {
  const small = V.W.field.arena.name === "kitchen", [fx, fy] = G.st.window || [G.st.shaft.from[0], 0.1], w = small ? 16 : 34, h = small ? 22 : 64, x = fx * IW - w / 2, y = Math.max(4, fy * 360 - h / 2);
  g.fillStyle = gray(0.1); g.fillRect(x - 4, y - 4, w + 8, h + 8);
  g.fillStyle = gray(0.86); g.fillRect(x, y, w, h);
  g.fillStyle = gray(0.12); g.fillRect(x + w / 2 - 1, y, 2, h); for (let k = 1; k < 4; k++) g.fillRect(x, y + (k * h) / 4, w, 1);
}

// the Brack kitchen stretched tall: a wall that runs up to a ceiling a man must bend under, the dresser grown with it
function dresser(V, g, G) {
  const ceil = G.yWall - (G.st.ceiling || 4) * S, [dx0] = V.proj(2, 1), [dx1] = V.proj(6.2, 1), top = ceil + 18;
  g.fillStyle = gray(0.06); g.fillRect(0, ceil, IW, G.yWall - ceil);
  for (let x = 6; x < IW; x += 23) { g.fillStyle = gray(0.05 + 0.02 * hash(x)); g.fillRect(x, ceil, 1 + ((hash(x, 2) * 3) | 0), G.yWall - ceil); }
  g.fillStyle = gray(0.03); g.fillRect(dx0, top, dx1 - dx0, G.yWall - top);
  g.fillStyle = gray(0.1); g.fillRect(dx0 - 3, top - 4, dx1 - dx0 + 6, 5); g.fillRect(dx0, top, 3, G.yWall - top); g.fillRect(dx1 - 3, top, 3, G.yWall - top);
  for (let y = top + 10, r = 0; y < G.yWall - 34; y += 17, r++) {
    g.fillStyle = gray(0.1); g.fillRect(dx0 + 3, y + 10, dx1 - dx0 - 6, 2);
    for (let x = dx0 + 12; x < dx1 - 10; x += 15) if (hash(x | 0, r, 2) > 0.3) { g.fillStyle = gray(0.1 + 0.1 * hash(x | 0, r)); g.beginPath(); g.ellipse(x, y + 5, 5, 5.5, 0, 0, Math.PI * 2); g.fill(); }
  }
  g.fillStyle = gray(0.2); g.fillRect(dx1 - 1, top, 1, G.yWall - top);
  window(V, g, G);
}

// the ceiling beam: Saturn's back is under it
function beam(V, g, G) {
  const y = G.yWall - (G.st.ceiling || 4) * S;
  g.fillStyle = gray(0.02); g.fillRect(0, 0, IW, Math.max(0, y));
  g.fillStyle = gray(0.045); g.fillRect(0, y - 8, IW, 14); g.fillStyle = gray(0.17); g.fillRect(0, y + 5, IW, 1);
  for (let x = 30; x < IW; x += 110) { g.fillStyle = gray(0.04); g.fillRect(x, 0, 12, y - 6); }
}

// the cells in tiers, a walkway and a stair (the yard closing to the end cell, seen as a prison of many)
function cells(V, g, G) {
  const tiers = 4, th = Math.max(22, G.yWall / tiers);
  g.fillStyle = gray(0.05); g.fillRect(0, 0, IW, G.yWall);
  for (let t = 0; t < tiers; t++) {
    const yb = G.yWall - t * th, v = 0.05 + t * 0.012;
    g.fillStyle = gray(v + 0.03); g.fillRect(0, yb - 3, IW, 3);
    for (let x = 8 + ((t * 13) % 20); x < IW - 10; x += 26) {
      const dh = th * 0.62, dw = 10;
      g.fillStyle = gray(0.015); g.fillRect(x, yb - 3 - dh, dw, dh); g.beginPath(); g.arc(x + dw / 2, yb - 3 - dh, dw / 2, Math.PI, 0); g.fill();
      g.fillStyle = gray(v + 0.13); for (let k = 1; k < 4; k++) g.fillRect(x + (k * dw) / 4, yb - 3 - dh - 2, 1, dh + 2);
    }
    for (let x = 0; x < IW; x += 6) { g.fillStyle = gray(v + 0.08); g.fillRect(x, yb - th + 2, 1, 5); }
  }
  g.strokeStyle = gray(0.12); g.lineWidth = 3; g.beginPath(); g.moveTo(20, G.yWall); g.lineTo(150, G.yWall - th * 3); g.stroke();
  g.strokeStyle = gray(0.05); g.lineWidth = 1; for (let k = 0; k < 18; k++) { const u = k / 18; g.beginPath(); g.moveTo(20 + 130 * u, G.yWall - th * 3 * u); g.lineTo(28 + 130 * u, G.yWall - th * 3 * u); g.stroke(); }
}

// the granary's sacks stacked as cliffs, smaller and fainter as they rise (larger inside than out)
function stacks(V, g, G) {
  for (let r = 0, y = G.yWall; y > -6; r++) {
    const s = Math.max(0.45, 1 - r * 0.07), w = 16 * s, h = 9 * s, v = 0.05 + Math.min(0.06, r * 0.006);
    for (let x = -8 + (r % 2) * w * 0.5; x < IW + 8; x += w) {
      g.fillStyle = gray(v + 0.025 * hash(x | 0, r)); g.beginPath(); g.ellipse(x, y - h / 2, w / 2 + 0.5, h / 2 + 0.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = gray(v + 0.1 * (litSide(G, x) > 0 ? 1 : 0.4)); g.fillRect(x + (litSide(G, x) > 0 ? w * 0.2 : -w * 0.35), y - h + 1, w * 0.18, 1);
      if (hash(x | 0, r, 4) > 0.8) { g.fillStyle = gray(v + 0.12); g.fillRect(x - 2, y - h / 2, 4, 1); }
    }
    y -= h * 0.82;
  }
}

// the road's sky: low light at the horizon, two ridges of snow
function sky(V, g, G) {
  const hor = G.yWall - 10, grd = g.createRadialGradient(IW * 0.3, hor, 0, IW * 0.3, hor, 520);
  grd.addColorStop(0, gray(0.34)); grd.addColorStop(0.5, gray(0.16)); grd.addColorStop(1, gray(0.05));
  g.fillStyle = grd; g.fillRect(0, 0, IW, G.yWall);
  for (const [amp, base, v] of [[14, hor - 18, 0.2], [10, hor - 4, 0.12]]) {
    g.fillStyle = gray(v); g.beginPath(); g.moveTo(0, G.yWall);
    for (let x = 0; x <= IW; x += 8) g.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x * 0.011 + base) * Math.sin(x * 0.027 + 1.3)));
    g.lineTo(IW, G.yWall); g.closePath(); g.fill();
  }
}

// the posts of the district line, too many, running to the horizon
function posts(V, g, G) {
  const hor = G.yWall - 12, vx = IW * 0.72;
  for (let k = 0; k < 26; k++) {
    const u = Math.pow(0.86, k), x = vx + (20 - vx) * u, h = 6 + 80 * u, yb = hor + 10 * u;
    g.fillStyle = gray(0.05); g.fillRect(x, yb - h, Math.max(1, 4 * u), h);
    g.fillStyle = gray(0.05); g.fillRect(x - 6 * u, yb - h + 3 * u, 12 * u + 1, Math.max(1, 2 * u));
  }
  g.strokeStyle = gray(0.07); g.lineWidth = 1; g.beginPath(); g.moveTo(20, hor - 75); g.lineTo(vx, hor - 4); g.stroke();
}

// the town's bridge as one colossal arch over the ice, its parapet in snow; the haze through the arch
function bridge(V, g, G) {
  const cx = IW / 2, rx = IW * 0.56, ry = Math.max(30, G.yWall * 0.82), yb = G.yWall;
  g.fillStyle = gray(0.04); g.beginPath(); g.moveTo(-10, -2); g.lineTo(IW + 10, -2); g.lineTo(IW + 10, yb);
  for (let a = 0; a <= 1.0001; a += 0.025) g.lineTo(cx + rx * Math.cos(a * Math.PI), yb - ry * Math.sin(a * Math.PI));
  g.lineTo(-10, yb); g.closePath(); g.fill();
  for (let k = 0; k <= 24; k++) { const a = (k / 24) * Math.PI, c = Math.cos(a), s = Math.sin(a); g.strokeStyle = gray(0.025); g.lineWidth = 1; g.beginPath(); g.moveTo(cx + rx * c, yb - ry * s); g.lineTo(cx + (rx + 16) * c, yb - (ry + 14) * s); g.stroke(); }
  g.strokeStyle = gray(0.2); g.lineWidth = 1; g.beginPath(); for (let a = 0; a <= 1.0001; a += 0.025) { const x = cx + rx * Math.cos(a * Math.PI), y = yb - ry * Math.sin(a * Math.PI); a ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  g.fillStyle = gray(0.3); g.fillRect(0, 3, IW, 2);
}

export const BACK = { tiers, shelves, pilasters, window, dresser, beam, cells, stacks, sky, posts, bridge };
