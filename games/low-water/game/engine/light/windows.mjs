// Windows and flames found in a plate's own geo buffers, so every lit pane and every fire the painter baked
// becomes a light the model can dim, put out, or light at dusk, with no list kept by hand. Panes are
// clustered on a 1.4 m grid; each cluster is one window light, set just in front of the glass, burning the
// era's table light inside. Emissive samples are tied to the light they belong to, so when a window goes dark
// its pane goes dark with it (consume.mjs). Original code.
//   EMIT_IDS                         material ids that glow (window, windowdim, flame, stovefire, coal, whitelamp)
//   findWindows(pj, pos, ids, N, opt) -> [{ at, n, kind: "paraffin", source, group: "window", I, reach, street }]
//   emitOwners(F, lights)             -> Int16Array per sample: the light index an emissive sample belongs to, -1 none
//   windowHours(hour)                 -> 0..1: how many windows a street would light at this hour, given the means
import { idAt } from "./surface.mjs";

export const EMIT_IDS = { window: [73, 74, 44], fire: [75, 78, 55], lamp: [79] };
const PANE = new Set(EMIT_IDS.window), ALL = new Set([...EMIT_IDS.window, ...EMIT_IDS.fire, ...EMIT_IDS.lamp]);

export function findWindows(F, { source = "tallow", streetOf = () => null, cell = 1.0, minSamples = 2 } = {}) {
  const cl = new Map();
  for (let i = 0; i < F.n; i++) {
    if (!Number.isFinite(F.pos[i * 3 + 1]) || !PANE.has(idAt(F, i))) continue;
    const x = F.pos[i * 3], y = F.pos[i * 3 + 1], z = F.pos[i * 3 + 2], k = `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
    const c = cl.get(k) || cl.set(k, { n: 0, x: 0, y: 0, z: 0, nx: 0, nz: 0 }).get(k); c.n++; c.x += x; c.y += y; c.z += z; if (Number.isFinite(F.N[i * 3])) { c.nx += F.N[i * 3]; c.nz += F.N[i * 3 + 2]; }
  }
  const out = [];
  for (const c of cl.values()) {
    if (c.n < minSamples) continue; const l = Math.hypot(c.nx, c.nz) || 1, at = [c.x / c.n + (c.nx / l) * 0.35, c.y / c.n, c.z / c.n + (c.nz / l) * 0.35];
    out.push({ at, kind: "paraffin", source, group: "window", I: 1.4, reach: 4.5, street: streetOf(at), generated: true });
  }
  return out;
}
export function emitOwners(F, lights, { rows = null, out = null } = {}) {
  const own = out || new Int16Array(F.n).fill(-1);
  for (let i = rows ? rows[0] * F.w : 0; i < (rows ? Math.min(F.n, rows[1] * F.w) : F.n); i++) {
    if (!Number.isFinite(F.pos[i * 3 + 1])) continue; const id = idAt(F, i); if (!ALL.has(id)) continue;
    const pane = PANE.has(id); let best = -1, bd = pane ? 1.2 : 1.6;
    for (let j = 0; j < lights.length; j++) {
      const L = lights[j]; if (pane !== (L.group === "window")) continue;
      const d = Math.hypot(L.at[0] - F.pos[i * 3], L.at[1] - F.pos[i * 3 + 1], L.at[2] - F.pos[i * 3 + 2]); if (d < bd) { bd = d; best = j; }
    }
    own[i] = best;
  }
  return own;
}
// people light their windows from dusk to bed, and again before dawn; a famine street goes to bed early
export function windowHours(hour) {
  const h = ((hour % 24) + 24) % 24, s = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  return Math.max(s(15.5, 17.5, h) * (1 - s(22, 23.5, h)), s(4.5, 5.5, h) * (1 - s(7.8, 8.6, h)) * 0.6);
}
// one window at a time (the author's section 16 reference: a block's windows lighting and going dark one by one): each
// household lights its window at its own time after dusk and puts it out at its own bedtime (and again before dawn),
// each switch taking a few seconds of game time, not a fade across the whole street; the share lit at any hour still
// follows windowHours. seed: the window's own number
const hs = (s, k) => { let x = Math.imul((s | 0) ^ Math.imul(k, 0x9e3779b1), 0x27d4eb2d); x ^= x >>> 15; x = Math.imul(x, 0x85ebca6b); return ((x ^ (x >>> 13)) >>> 0) / 4294967296; };
export function windowLit(hour, seed) {
  const h = ((hour % 24) + 24) % 24, on = 15.6 + 2.2 * hs(seed, 1), off = 21.2 + 2.6 * hs(seed, 2), early = hs(seed, 3) < 0.55, mOn = 4.6 + 1.0 * hs(seed, 4), mOff = 7.6 + 1.0 * hs(seed, 5), e = 0.02;
  const step = (a, b) => Math.max(0, Math.min(1, (h - a) / e)) * Math.max(0, Math.min(1, (b - h) / e));
  return Math.max(step(on, off), early ? step(mOn, mOff) * 0.9 : 0);
}
