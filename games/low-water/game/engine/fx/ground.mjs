// Ground (effects queue 3): cart ruts that persist and fill with snow, wet that dries through the hours after a thaw,
// grain spilled where the sacks are loaded and scavenged as the street goes hungry, and the district notices pasted on
// the walls as thickly as the carrier speaks, torn and faded by the days and pasted over when its volume rises. Each is
// read from the community model through the light model's reader (M.read: G.community.stock) and the day.
// Original code.
import { registerEffect, hash, hidden, lightAt } from "./core.mjs";
import { lightPlace } from "../light/places.mjs";

const read = (ctx, name, subject, d) => { const r = ctx.M.read; const v = r ? r(name, subject) : undefined; return Number.isFinite(+v) && v !== undefined ? +v : d; };
// walls the camera faces, at notice height, chosen on a 1.2 m grid by the place's own geometry
export function wallSpots(ctx) {
  if (ctx.mem.walls) return ctx.mem.walls; const F = ctx.F, out = [], seen = new Set(), s = ctx.pj.width / F.w;
  for (let i = 0; i < F.n; i += 3) {
    if (!Number.isFinite(F.N[i * 3]) || Math.abs(F.N[i * 3 + 1]) > 0.12) continue; const y = F.pos[i * 3 + 1]; if (y < 1.1 || y > 2.3) continue;
    // a wall, not a slope or a heap: the sample a few rows up the plate is the same upright plane, higher
    const j = i - 6 * F.w; if (j < 0 || !Number.isFinite(F.N[j * 3]) || Math.hypot(F.pos[j * 3] - F.pos[i * 3], F.pos[j * 3 + 2] - F.pos[i * 3 + 2]) > 0.12 || F.pos[j * 3 + 1] <= y) continue;
    const key = `${Math.floor(F.pos[i * 3] / 1.2)},${Math.floor(F.pos[i * 3 + 2] / 1.2)}`; if (seen.has(key)) continue; seen.add(key);
    out.push({ i, at: [F.pos[i * 3], y, F.pos[i * 3 + 2]], x: ((i % F.w) + 0.5) * s, y: (Math.floor(i / F.w) + 0.5) * s, n: [F.N[i * 3], F.N[i * 3 + 2]] });
  }
  return (ctx.mem.walls = out);
}
// the district notices: as many as the street's notices stock and the carrier's volume ask, each with a day it was pasted;
// a notice fades and tears over a week; when the volume rises a fresh one goes up over an old one
registerEffect({ id: "notices", group: "ground", story: "volume.notices and each street's notices (the rhetoric carrier)", cost: { low: 0.1, high: 0.2 },
  step(ctx, out, set) {
    if (ctx.M.indoor) return; const entry = lightPlace(ctx.pj), vol = read(ctx, "volume.notices", "", 0.1), day = ctx.day ?? 41;
    for (const [k, w] of wallSpots(ctx).entries()) {
      const street = entry.streetOf(w.at) || entry.street, thick = read(ctx, "notices", street, 0.5) * (0.4 + 1.2 * vol);
      if (hash(k, 11) > thick * 0.55) continue;
      const layers = 1 + Math.floor(hash(k, 12) * 3 * vol + vol * 2);   // pasted over, layer on layer
      for (let L = 0; L < Math.min(4, layers); L++) {
        const age = Math.max(0, (day - (day - 9 * (layers - 1 - L) - hash(k, L, 13) * 6)) / 9), torn = Math.min(1, age * 0.7 + (L < layers - 1 ? 0.3 : 0));
        const ox = (hash(k, L, 14) - 0.5) * 0.3 * ctx.ppm, sz = 0.28 * ctx.ppm, light = lightAt(ctx, w.x, w.y), lv = Math.min(1, 0.25 + 2.2 * (0.2126 * light[0] + 0.7152 * light[1] + 0.0722 * light[2]));
        const paper = [0.86, 0.82, 0.7].map((c, j) => c * lv * (1 - 0.35 * age) * (light[j] / Math.max(1e-3, Math.max(...light))) ** 0.5);
        out.push({ k: "notice", x: w.x + ox, y: w.y - L * 0.02 * ctx.ppm, d: ctx.depth(w.at) - 0.05, r: sz * 0.5, a: 0.95 * (1 - 0.25 * torn), rgb: paper, ang: 0, len: sz * 0.4, torn, seed: k * 7 + L, ink: lv });
      }
    }
  } });
// cart ruts: two dark lines along the brigade's road, cut as deep as the carts ran (owed and export), filling with snow
registerEffect({ id: "ruts", group: "ground", story: "owed and export (the brigade's carts); snowfall fills them", cost: { low: 0.1, high: 0.2 },
  step(ctx, out, set) {
    const ruts = lightPlace(ctx.pj).ruts; if (!ruts || ctx.M.indoor) return;
    const use = Math.min(1, 0.4 + read(ctx, "export", "", 0) * 0.4 + read(ctx, "owed", "haldane_yard", 0) * 0.002), fill = Math.min(0.85, +(ctx.M.terms.snowfall || 0) * 0.8);
    for (const path of ruts) for (let s = 0; s < path.length - 1; s++) {
      const a = path[s], b = path[s + 1], L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.ceil(L / 0.35), ux = (b[0] - a[0]) / L, uz = (b[2] - a[2]) / L;
      for (let j = 0; j < n; j++) for (const side of [-0.7, 0.7]) {
        const t = j / n, p = [a[0] + (b[0] - a[0]) * t - uz * side, 0.02, a[2] + (b[2] - a[2]) * t + ux * side], [px, py] = ctx.toPlate(p), q = ctx.toPlate([p[0] + ux * 0.4, 0.02, p[2] + uz * 0.4]);
        out.push({ k: "rut", x: px, y: py, d: ctx.depth(p), r: 0.06 * ctx.ppm, a: 0.45 * use * (1 - fill) * (0.8 + 0.2 * hash(s, j)), rgb: [0.16, 0.14, 0.15], ang: Math.atan2(q[1] - py, q[0] - px), len: Math.hypot(q[0] - px, q[1] - py) });
      }
    }
  } });
// grain spilled where the sacks are handled (a place's spill marks), scavenged as the street goes hungry: by the hunger
// stock, the spill that was there at the requisition is picked up kernel by kernel
registerEffect({ id: "spill", group: "ground", story: "the export's sacks, scavenged by hunger", cost: { low: 0.05, high: 0.1 },
  step(ctx, out, set) {
    const spots = lightPlace(ctx.pj).spill; if (!spots) return; const entry = lightPlace(ctx.pj);
    spots.forEach((sp, k) => {
      const hunger = read(ctx, "hunger", entry.streetOf(sp) || entry.street, 0.3), left = Math.max(0, 1 - hunger * 1.3), n = Math.round((set.quality === "low" ? 40 : 120) * left);
      for (let j = 0; j < n; j++) {
        const a = hash(k, j, 1) * 6.283, rr = Math.sqrt(hash(k, j, 2)) * 0.9, p = [sp[0] + Math.cos(a) * rr * 1.4, 0.02, sp[2] + Math.sin(a) * rr], [px, py] = ctx.toPlate(p);
        if (hidden(ctx, px, py, ctx.depth(p))) continue; const E = lightAt(ctx, px, py), m = Math.min(1, 0.3 + 2 * Math.max(...E));
        out.push({ k: "grain", x: px, y: py, d: ctx.depth(p), r: 0.012 * ctx.ppm + 0.4, a: 0.9, rgb: [0.78 * m, 0.62 * m, 0.3 * m], ang: hash(k, j, 3) * 3, len: 0.02 * ctx.ppm });
      }
    });
  } });
// wet that dries: the thaw ring round a fire and the morning's melt darken the ground and dry back over hours since the
// thaw (terms.thawHours, 0 just thawed), from the edges inward
registerEffect({ id: "drying", group: "ground", story: "rec.wet and the hours since the thaw", cost: { low: 0.1, high: 0.2 },
  step(ctx, out, set) {
    const F = ctx.F; if (!F) return; const hrs = +(ctx.M.terms.thawHours ?? -1); if (hrs < 0) return; const dry = Math.min(1, hrs / 6);
    if (!ctx.mem.wetLayer || ctx.mem.wetDry !== dry.toFixed(2)) {
      const img = new Uint8ClampedArray(F.n * 4);
      for (let i = 0; i < F.n; i++) { const w = F.rec.wet[i] / 255; if (w < 0.05) continue; const a = Math.max(0, w - dry * (1.1 - 0.4 * hash(i % F.w >> 2, (i / F.w) >> 2))); if (a <= 0) continue; img[i * 4] = 18; img[i * 4 + 1] = 16; img[i * 4 + 2] = 22; img[i * 4 + 3] = Math.round(140 * a); }
      ctx.mem.wetLayer = { k: "layer", id: "wet", ch: null, w: F.w, h: F.h, scale: F.w / ctx.pj.width, rgba: img, x: 0, y: 0, d: 0, r: 0, a: 1, rgb: [0, 0, 0] }; ctx.mem.wetDry = dry.toFixed(2);
    }
    out.push(ctx.mem.wetLayer);
  } });
export const GROUND = true;
