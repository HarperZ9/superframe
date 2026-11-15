// Weather and air (effects queue 1): snow that falls and lies on ledges and in the footprints the queue leaves, breath
// in the cold, frost creeping over the panes by the hour, dust turning in a window's shaft, heat haze over a fire. Each
// is tied to the light model's state: the frost and snow terms, the era's cold, the clock, the fires' gains, the
// windows' daylight. Original code.
import { registerEffect, hash, hidden, lightAt, lum, airLight } from "./core.mjs";
import { isFire } from "../light/sources.mjs";
import { inShaft } from "./shafts.mjs";
import { windowHours } from "../light/windows.mjs";

const lit = (ctx, x, y, base, k = 1) => { const E = lightAt(ctx, x, y), l = Math.max(0.02, lum(E)); return base.map((v, i) => Math.min(1.4, v * (0.25 + k * 1.6 * (E[i] / Math.max(l, 1e-3)) * Math.min(1, l * 2.2)))); };
// the world box over the plate's ground, kept per place
function boundsOf(ctx) {
  if (ctx.mem.bounds) return ctx.mem.bounds; const F = ctx.F, b = [Infinity, -Infinity, Infinity, -Infinity, Infinity];
  for (let i = 0; i < F.n; i += 7) { const y = F.pos[i * 3 + 1]; if (!Number.isFinite(F.N[i * 3]) || y > 500) continue; b[0] = Math.min(b[0], F.pos[i * 3]); b[1] = Math.max(b[1], F.pos[i * 3]); b[2] = Math.min(b[2], F.pos[i * 3 + 2]); b[3] = Math.max(b[3], F.pos[i * 3 + 2]); b[4] = Math.min(b[4], y); }
  return (ctx.mem.bounds = b);
}
// falling snow, gated by the light in the air (author's section 12 reference: flakes seen only inside a lamp's cone,
// sparkling there, invisible in the dark between): a flake's brightness is the irradiance where it is, so the snow
// shows in the lamp pools, the lit windows' spill and the train's headlamp, and hardly at all elsewhere at night; by day
// every flake is lit. A lit flake twinkles as it turns (off with flicker off).
registerEffect({ id: "snowfall", group: "weather", story: "terms.snowfall, gated by the light model's irradiance in the air", cost: { low: 400, high: 1600 },
  step(ctx, out, set) {
    const k = +(ctx.M.terms.snowfall || 0); if (k <= 0 || ctx.M.indoor) return;
    const [x0, x1, z0, z1, gy] = boundsOf(ctx), n = Math.round((set.quality === "low" ? 400 : 1600) * k * (set.motion === "reduced" ? 0.5 : 1)), H = 9, slow = set.motion === "reduced" ? 0.45 : 1;
    for (let i = 0; i < n; i++) {
      const v = (0.7 + 0.6 * hash(i, 1)) * slow, ph = hash(i, 2) * H, fall = (ctx.t * v + ph) % H, y = gy + H - fall;
      const sway = set.motion === "reduced" ? 0 : 0.25 * Math.sin(ctx.t * (0.8 + hash(i, 3)) + i), drift = ctx.wind * (H - y + gy) * 0.35;
      const p = [x0 + hash(i, 4) * (x1 - x0) + sway + drift, y, z0 + hash(i, 5) * (z1 - z0) + sway * 0.5];
      const E = airLight(ctx, p), l = lum(E); if (l < 0.02) continue;   // in the dark between the lamps: not seen
      const [px, py] = ctx.toPlate(p), d = ctx.depth(p); if (hidden(ctx, px, py, d)) continue;
      const tw = set.flicker === "off" ? 1 : 0.6 + 0.4 * Math.abs(Math.sin(ctx.t * (3 + 4 * hash(i, 7)) + i)), m = Math.max(...E) || 1;
      out.push({ k: "flake", x: px, y: py, d, r: (0.5 + 1.1 * hash(i, 6)) * Math.max(0.6, ctx.ppm / 40), a: Math.min(1, 0.15 + l * 2.2) * tw, rgb: E.map((c) => Math.min(1, 0.25 + 0.75 * c / m) * Math.min(1, 0.3 + l * 2.5)), glow: l > 0.15, ang: 1.4 + 0.3 * ctx.wind, len: 1 + 2 * ctx.wind * slow });
    }
    poolFlakes(ctx, out, set, k, gy, H, slow);
  } });
// the same fall, sampled where the light is: inside each lamp's, fire's and the headlamp's reach the flakes come at the
// field's own density per cubic metre (times the snowfall), so the pools show the snow a whole-square field would spend
// thousands of flakes on; each flake still takes its brightness from the light where it is
function poolFlakes(ctx, out, set, k, gy, H, slow) {
  const per = (set.quality === "low" ? 0.25 : 0.8) * k * (set.motion === "reduced" ? 0.5 : 1), Ls = [...ctx.M.lights.map((L, i) => [L, ctx.gains[i]]), ...(ctx.dyn || (ctx.dyn = ctx.M.dynamic(ctx.t))).map((L) => [L, 1])];
  Ls.forEach(([L, g], li) => {
    if (g < 0.05 || L.group === "window" && g < 0.3) return; const r = Math.min(L.reach * 0.7, 12), n = L.cone ? Math.round(500 * per) : Math.min(400, Math.round(per * Math.PI * r * r * Math.min(H, L.at[1] + 3)));
    for (let j = 0; j < n; j++) {
      const v = (0.7 + 0.6 * hash(li, j, 1)) * slow, hh = Math.min(H, L.at[1] + 3), y = gy + hh - ((ctx.t * v + hash(li, j, 2) * hh) % hh), a = hash(li, j, 3) * 6.283, rr = r * Math.sqrt(hash(li, j, 4));
      const sway = set.motion === "reduced" ? 0 : 0.2 * Math.sin(ctx.t * (0.8 + hash(li, j, 5)) + j);
      let p = [L.at[0] + Math.cos(a) * rr + sway + ctx.wind * (gy + hh - y) * 0.3, y, L.at[2] + Math.sin(a) * rr];
      if (L.cone) {   // a headlamp: the flakes along its beam, out to its reach, inside the cone's widening radius
        const u = Math.sqrt(hash(li, j, 8)) * Math.min(L.reach, 40), w = u * Math.tan(Math.acos(L.cone.cos)), D = L.cone.dir, sx = -D[2], sz = D[0], o = (hash(li, j, 9) - 0.5) * 2 * w, up = (hash(li, j, 10) - 0.5) * 2 * w;
        const yy = L.at[1] + D[1] * u + up - ((ctx.t * v) % 2); p = [L.at[0] + D[0] * u + sx * o + sway, yy, L.at[2] + D[2] * u + sz * o];
      }
      const E = airLight(ctx, p), l = lum(E); if (l < 0.03) continue; const [px, py] = ctx.toPlate(p), d = ctx.depth(p); if (hidden(ctx, px, py, d)) continue;
      const tw = set.flicker === "off" ? 1 : 0.55 + 0.45 * Math.abs(Math.sin(ctx.t * (3 + 4 * hash(li, j, 6)) + j)), m = Math.max(...E) || 1;
      out.push({ k: "flake", x: px, y: py, d, r: (0.5 + 1.1 * hash(li, j, 7)) * Math.max(0.6, ctx.ppm / 40), a: Math.min(1, 0.2 + l * 2.5) * tw, rgb: E.map((c) => Math.min(1, 0.3 + 0.7 * c / m) * Math.min(1, 0.35 + l * 2.5)), glow: true, ang: 1.4 + 0.3 * ctx.wind, len: 1 + 2 * ctx.wind * slow });
    }
  });
}
// snow lying on what stands above the ground (roofs, sills, carts, the scale's canopy): a soft mask over every raised
// surface that faces up enough to hold it, under frost, open to the sky; one image per place, anchored to the plate
// (the ground's own snow is the painting's). Drawn as a layer, not as marks: k "layer" carries an RGBA image.
registerEffect({ id: "lying", group: "weather", story: "rec.frost, terms.snow and snowfall (where the snow settles)", cost: { low: 0.1, high: 0.2 },
  step(ctx, out, set) {
    const F = ctx.F, k = Math.min(1, +(ctx.M.terms.snow || 0) * 0.7 + +(ctx.M.terms.snowfall || 0)); if (!F || k <= 0 || ctx.M.indoor) return;
    if (!ctx.mem.lying) {
      const gy = boundsOf(ctx)[4], img = new Uint8ClampedArray(F.n * 4);
      for (let i = 0; i < F.n; i++) {
        if (!Number.isFinite(F.N[i * 3]) || F.pos[i * 3 + 1] < gy + 0.4) continue; const up = F.N[i * 3 + 1]; if (up < 0.55) continue;
        const a = Math.min(1, (up - 0.55) / 0.3) * Math.min(1, F.rec.frost[i] / 160) * k; if (a < 0.05) continue;
        const e = [F.E[i * 3], F.E[i * 3 + 1], F.E[i * 3 + 2]], m = Math.max(0.05, Math.max(...e));
        for (let c = 0; c < 3; c++) img[i * 4 + c] = Math.round(255 * Math.pow(Math.min(0.95, 0.14 + (e[c] / m) * Math.min(0.8, 0.22 + m * 1.4)), 1 / 2.2));
        // a painted cover, not a sheet: thinner where the world's noise is low (drifted, blown off), 3 to 5 cm grain
        const gr = 0.6 + 0.4 * hash(Math.floor(F.pos[i * 3] * 25), Math.floor(F.pos[i * 3 + 2] * 25), 3) * (0.5 + 0.5 * Math.sin(F.pos[i * 3] * 1.7 + F.pos[i * 3 + 2] * 2.3));
        img[i * 4 + 3] = Math.round(255 * a * 0.8 * gr);
      }
      softEdge(img, F.w, F.h);
      ctx.mem.lying = { k: "layer", id: "lying", w: F.w, h: F.h, scale: F.w / ctx.pj.width, rgba: img, x: 0, y: 0, d: 0, r: 0, a: 1, rgb: [1, 1, 1] };
    }
    out.push(ctx.mem.lying);
  } });
// the cover's edge softened by one sample (a 3 x 3 mean of alpha where the cover begins and ends)
function softEdge(img, w, h) {
  const A = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) A[i] = img[i * 4 + 3];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; let m = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) m += A[i + dy * w + dx];
    if (A[i] && m < A[i] * 9) img[i * 4 + 3] = Math.round(m / 9);
  }
}
// footprints where the snow lies and the queue stands: each figure stamps a print every 0.6 m it walks; prints fill in
// as the snow falls (a minute in a heavy fall, ten in a light one)
registerEffect({ id: "prints", group: "weather", story: "figures walking on frost or snow", cost: { low: 0.2, high: 0.5 },
  step(ctx, out, set) {
    const F = ctx.F, mem = ctx.mem; if (!F || ctx.M.indoor) return; mem.prints ||= []; mem.last ||= {};
    for (const f of ctx.figures) {
      const id = f.id || `${f.at[0].toFixed(0)}`, l = mem.last[id]; if (l && Math.hypot(f.at[0] - l[0], f.at[2] - l[2]) < 0.6) continue;
      mem.last[id] = f.at; const [px, py] = ctx.toPlate(f.at), s = F.w / ctx.pj.width, i = Math.floor(py * s) * F.w + Math.floor(px * s);
      if (i >= 0 && i < F.n && F.rec.frost[i] > 90) mem.prints.push({ x: px, y: py, t: ctx.t, side: (mem.prints.length & 1) * 2 - 1 });
    }
    const life = 600 / (1 + 9 * (+(ctx.M.terms.snowfall || 0))), cap = set.quality === "low" ? 120 : 400;
    mem.prints = mem.prints.filter((p) => ctx.t - p.t < life).slice(-cap);
    for (const p of mem.prints) { const age = (ctx.t - p.t) / life; out.push({ k: "print", x: p.x + p.side * 0.12 * ctx.ppm, y: p.y, d: 0, r: 0.11 * ctx.ppm, a: 0.55 * (1 - age), rgb: [0.32, 0.36, 0.48], ang: 0, len: 0.2 * ctx.ppm }); }
  } });
// breath in the cold: a puff from each figure's mouth every few seconds, lit by the light where it stands
registerEffect({ id: "breath", group: "weather", story: "the cold (frost term, era 2 outdoors)", cost: { low: 0.1, high: 0.2 },
  step(ctx, out, set) {
    if (ctx.cold < 0.3) return;
    ctx.figures.forEach((f, n) => {
      const per = 3.1 + hash(n, 7), u = ((ctx.t + hash(n, 8) * per) % per) / per; if (u > 0.5) return;
      const fx = Math.cos(f.facing || 0), fz = Math.sin(f.facing || 0), w = u / 0.5, rise = set.motion === "reduced" ? 0.05 : 0.25 * w;
      const p = [f.at[0] + fx * (0.22 + 0.25 * w) + ctx.wind * 0.3 * w, f.at[1] + 1.55 + rise, f.at[2] + fz * (0.22 + 0.25 * w)], [px, py] = ctx.toPlate(p);
      out.push({ k: "puff", x: px, y: py, d: ctx.depth(p) - 0.3, r: (0.06 + 0.2 * w) * ctx.ppm, a: 0.38 * ctx.cold * (1 - w), rgb: lit(ctx, px, py, [0.9, 0.92, 0.96], 0.8), ang: 0, len: 0 });
    });
  } });
// frost creeping over a pane through the night: none at dusk, the panes' lower halves by midnight, the whole pane by
// dawn; it melts by mid-morning, and never on a pane with a fire behind it
registerEffect({ id: "panefrost", group: "weather", story: "the clock and the cold on every window the model knows", cost: { low: 0.1, high: 0.3 },
  step(ctx, out, set) {
    if (ctx.cold < 0.2) return; const h = ((ctx.M.hour % 24) + 24) % 24, night = h >= 16.5 ? (h - 16.5) / 8 : h < 11 ? Math.min(1, (h + 7.5) / 8) * (1 - Math.max(0, (h - 8.5) / 2.5)) : 0, f = Math.max(0, Math.min(1, night)) * ctx.cold;
    if (f < 0.05) return; const per = set.quality === "low" ? 4 : 9;
    ctx.M.lights.forEach((L, li) => {
      if (L.group !== "window" && L.kind !== "window") return; const warm = L.group === "window" && ctx.gains[li] > 0.5 ? 0.4 : 1;
      for (let j = 0; j < per; j++) {
        const a = hash(li, j) * Math.PI * 2, rr = 0.3 * (1 - f * hash(li, j, 3)), p = [L.at[0] + Math.cos(a) * rr, L.at[1] - 0.25 + 0.5 * f * hash(li, j, 5) - 0.2, L.at[2] + Math.sin(a) * rr], [px, py] = ctx.toPlate(p);
        out.push({ k: "frost", x: px, y: py, d: ctx.depth(p) - 0.4, r: 0.05 * ctx.ppm, a: 0.6 * f * warm, rgb: [0.82, 0.88, 0.98], ang: a, len: 0.1 * ctx.ppm });
      }
    });
  } });
// dust turning in a window's shaft (indoors, by day): motes inside the cone from the pane toward the floor, lit only
// while the daylight is in
registerEffect({ id: "motes", group: "weather", story: "a window's daylight in a room", cost: { low: 0.1, high: 0.2 },
  step(ctx, out, set) {
    if (!ctx.M.indoor) return; const day = Math.min(1, lum(ctx.sky.amb) / 0.2); if (day < 0.35) return;   // dust shows only in a real shaft of day
    ctx.M.lights.forEach((L, li) => {
      if (L.kind !== "window") return; const to = [-L.at[0] * 0.6, -L.at[1] + 0.1, -L.at[2] * 0.6], len = Math.hypot(...to) || 1, n = set.quality === "low" ? 30 : 90;
      for (let j = 0; j < n; j++) {
        const s = hash(li, j, 1), sp = set.motion === "reduced" ? 0 : ctx.t * 0.05, rr = 0.15 + 0.9 * s * hash(li, j, 9), a = hash(li, j, 2) * 6.283 + sp * (0.5 + hash(li, j, 3));
        const p = [L.at[0] + to[0] * s + Math.cos(a) * rr * 0.6, L.at[1] + to[1] * s + Math.sin(a * 1.3) * rr * 0.4 + (sp * 0.1 % 0.3), L.at[2] + to[2] * s + Math.sin(a) * rr * 0.6], [px, py] = ctx.toPlate(p);
        const lit = inShaft(ctx, p); if (lit <= 0.02) continue;   // dust is seen only in the shaft
        out.push({ k: "mote", x: px, y: py, d: ctx.depth(p) - 0.2, r: 0.012 * ctx.ppm + 0.6, a: 0.8 * lit * (0.4 + 0.6 * hash(li, j, 4)), rgb: L.rgb.map((v) => 0.6 + 0.5 * v), glow: true, ang: 0, len: 0 });
      }
    });
  } });
// heat haze over a fire: wavering streaks in the air above it (painted), a shimmer of marks (glyph); off under reduced motion
registerEffect({ id: "haze", group: "weather", story: "each fire's gain", cost: { low: 0.05, high: 0.1 },
  step(ctx, out, set) {
    if (set.motion === "reduced") return;
    ctx.M.lights.forEach((L, li) => {
      if (!isFire(L.kind) || L.group === "window" || ctx.gains[li] < 0.3 || L.kind === "candle") return; const n = set.quality === "low" ? 3 : 6;
      for (let j = 0; j < n; j++) {
        const h = ((ctx.t * 0.6 + hash(li, j)) % 1), p = [L.at[0] + (hash(li, j, 2) - 0.5) * 0.4 + 0.05 * Math.sin(ctx.t * 7 + j), L.at[1] + 0.3 + h * 0.9, L.at[2] + (hash(li, j, 3) - 0.5) * 0.3], [px, py] = ctx.toPlate(p);
        const d = ctx.depth(p); if (hidden(ctx, px, py, d)) continue;
        out.push({ k: "haze", x: px, y: py, d, r: 0.025 * ctx.ppm, a: 0.08 * (1 - h) * ctx.gains[li], rgb: [1, 0.85, 0.7], ang: 1.571 + 0.3 * Math.sin(ctx.t * 5 + j), len: 0.1 * ctx.ppm });
      }
    });
  } });
export const WEATHER = true;
