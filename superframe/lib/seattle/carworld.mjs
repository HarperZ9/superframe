// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// carworld.mjs: Seattle at night as seen from the back seat, lying down, out of the rear side window.
// The world is 3D and the camera moves through it: a point at distance s ahead along the road, lateral distance lat
// (toward the window) and height z sits at azimuth atan2(s, lat) and elevation atan2(z - eye, hypot(s, lat)). Near
// lamps sweep fast, far towers crawl, which is the parallax of the memory without any authored layer speeds.
// The view is angular (equidistant in azimuth and elevation), so the same function draws the view the eye sees
// and the wider, coarser map the raindrops sample.
//
// Scene facts used here (approximate, stated): a cobra-head street lamp head sits 8.5 to 9.5 m up on an arm over the
// street, every 35 to 45 m; lamp heads show a glowing lens about 0.45 x 0.25 m; downtown towers 30 to 150 m;
// Douglas firs 25 to 45 m in the residential blocks; traffic signals on mast arms about 6 m up. The low cloud deck is
// lit from below by the city's own lamps, so its glow follows the light density along the route.
import { frame, disc, poly, rect, fill } from './raster.mjs';

const hash = (i, k = 0) => { let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(k + 0x27d4eb2f, 0xc2b2ae35); x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; return ((x >>> 0) % 100000) / 100000; };
export const EYE_HEIGHT = 0.75;

// the view: ppr pixels per radian, centre azimuth/elevation, size
export const project = (V, s, lat, z) => {
  const az = Math.atan2(s, lat), el = Math.atan2(z - EYE_HEIGHT, Math.hypot(s, lat));
  return [V.w / 2 + az * V.ppr, V.h / 2 - (el - V.el0) * V.ppr, Math.hypot(s, lat, z - EYE_HEIGHT)];
};

// items within reach of position pos along the route; with a period the spacing is stretched so a whole number of
// items fits the loop, and the world repeats exactly
function* around(pos, spacing, kind, period, reach = 260) {
  const n = period ? Math.max(1, Math.round(period / spacing)) : 0, sp = n ? period / n : spacing;
  for (let i = Math.floor((pos - reach) / sp); i <= Math.ceil((pos + reach) / sp); i++) {
    const id = n ? ((i % n) + n) % n : i, j = hash(id, kind);
    yield { id, s: i * sp + (j - 0.5) * sp * 0.3 - pos, r: k => hash(id, kind * 31 + k) };
  }
}

// street lamps by road type: city streets have cobra heads on 9 m poles every ~32 m at the kerb; the freeway has
// tall median poles (about 12.5 m) every ~44 m, seen across one or two lanes
const LAMPS = { street: { sp: 32, lat: [5.5, 3], z: [8.5, 1] }, freeway: { sp: 44, lat: [8, 3], z: [12, 1] } };
function* lamps(st, reach = 160) {
  for (const road of ['street', 'freeway']) {
    const C = LAMPS[road];
    for (const it of around(st.pos, C.sp, road === 'street' ? 1 : 9, st.period, reach)) {
      const s = st.pos + it.s;
      if (st.road(s) !== road || !st.lit(s) || it.r(5) > 0.6 + 0.4 * st.density(s)) continue;
      yield { it, lat: C.lat[0] + it.r(2) * C.lat[1], z: C.z[0] + it.r(3) * C.z[1] };
    }
  }
}

export function renderWorld(V, st, L) {
  const F = frame(V.w, V.h), street = s => st.road(st.pos + s) === 'street';
  sky(F, V, st, L);
  for (const it of around(st.pos, 70, 3, st.period)) if (it.r(1) < st.density(st.pos + it.s) * 0.9) tower(F, V, it, L);
  for (const it of around(st.pos, 30, 4, st.period)) if (it.r(1) > st.density(st.pos + it.s) + 0.15) fir(F, V, it, st, L);
  for (const it of around(st.pos, 24, 6, st.period)) if (it.r(1) < 0.75 && street(it.s)) block(F, V, it, st, L);
  for (const it of around(st.pos, 120, 5, st.period, 160)) if (street(it.s)) signal(F, V, it, st, L);
  wires(F, V, st, L);
  plane(F, V, st, L);
  for (const { it, lat, z } of lamps(st)) lamp(F, V, it, L, lat, z);
  for (const o of st.overpasses ?? []) overpass(F, V, st, L, o);
  return F;
}

// a freeway overpass: the underside of a deck 18 m wide at 6.2 m, crossing every azimuth; per pixel, the eye ray
// meets the deck's plane at horizontal distance (6.2 - eye) / tan(el), and the deck covers it if that point's
// distance along the road falls inside the deck. Its concrete is lit by the freeway lamps beside it.
function overpass(F, V, st, L, s0) {
  const a = s0 - st.pos, b = a + 18;
  if (b < -80 || a > 80) return;
  for (let y = 0; y < F.h; y++) {
    const el = V.el0 + (F.h / 2 - y) / V.ppr; if (el <= 0.05) continue;
    const rho = (6.2 - EYE_HEIGHT) / Math.tan(el);
    for (let x = 0; x < F.w; x++) {
      const az = (x - F.w / 2) / V.ppr, s = rho * Math.sin(az), lat = rho * Math.cos(az);
      if (s < a || s > b || lat < -2) continue;
      const lit = 0.25 + 0.75 * Math.exp(-((s - a) ** 2) / 30) + 0.5 * Math.exp(-((s - b) ** 2) / 30);
      F.d.set(L.concrete(lit), 3 * (y * F.w + x));
    }
  }
}

// low cloud deck lit from below: glow ~ local lamp density, with drifting texture
function sky(F, V, st, L) {
  const { w, h } = F, g = 0.003 + 0.009 * st.density(st.pos), amb = L.night;
  for (let y = 0; y < h; y++) {
    const el = V.el0 + (h / 2 - y) / V.ppr, fall = Math.max(0.35, 1 - 0.5 * Math.max(0, el - 0.3));
    for (let x = 0; x < w; x++) {
      const az = (x - w / 2) / V.ppr, u = az * 3 + st.pos * 0.0015, v = el * 5 + st.t * 0.01;
      const n = 0.75 + 0.25 * Math.sin(u * 2.1 + Math.sin(v * 1.7)) * Math.sin(v * 2.9 + u * 0.7);
      const i = 3 * (y * w + x), k = g * fall * n;
      for (let c = 0; c < 3; c++) F.d[i + c] = L.glow[c] * k + amb[c];
    }
  }
}

function tower(F, V, it, L) {
  const lat = 50 + it.r(2) * 90, H = 30 + it.r(3) ** 1.5 * 120, wd = 18 + it.r(4) * 22;
  const [xa, yTop] = project(V, it.s - wd / 2, lat, H), [xb] = project(V, it.s + wd / 2, lat, H), [, yBase] = project(V, it.s, lat, 0);
  if (xb < -20 || xa > V.w + 20) return;
  rect(F, xa, yTop, xb, yBase, L.towerDark);
  const floors = Math.floor(H / 3.6), cols = Math.max(2, Math.floor(wd / 3));
  for (let f = 2; f < floors; f++) for (let c = 0; c < cols; c++) {
    if (hash(it.id * 977 + f, c) > 0.3) continue;
    const s = it.s - wd / 2 + (c + 0.5) * wd / cols, [x, y] = project(V, s, lat, f * 3.6 + 1.5);
    const warm = hash(it.id + f, c + 7) < 0.25, sz = Math.max(0.5, 1.4 * V.ppr / (lat * 200));
    disc(F, x, y, sz, warm ? L.window : L.office, { mode: 'add', k: 1 });
  }
}

// Douglas fir silhouette: a narrow cone with drooping branch tiers, under-lit faintly by the street
function fir(F, V, it, st, L) {
  const lat = 14 + it.r(2) * 30, H = 25 + it.r(3) * 20, base = H * 0.18;
  const [xt, yt] = project(V, it.s, lat, H), [, yb] = project(V, it.s, lat, 2);
  if (xt < -60 || xt > V.w + 60) return;
  const pts = [[xt, yt]], tiers = 12;
  for (let k = 1; k <= tiers; k++) {
    const z = H - (H - 2) * k / tiers, half = Math.min(base, (H - z) * 0.28) * (0.8 + 0.3 * hash(it.id, k));
    const [xl, yl] = project(V, it.s - half, lat, z - 0.8), [xr] = project(V, it.s + half, lat, z - 0.8);
    pts.push([xr, yl]); pts.unshift([xl, yl]);
    const [, yu] = project(V, it.s, lat, z + 0.6), inset = (xr - xl) * 0.12;
    pts.push([xr - inset, yu]); pts.unshift([xl + inset, yu]);
  }
  pts.push([xt + 1, yb]); pts.unshift([xt - 1, yb]);
  poly(F, pts, L.fir(st.density(st.pos + it.s)));
}

// houses and low apartment blocks across the street: a dark mass with warm windows, now and then the blue flicker of
// a television (a CRT's phosphors, near 9300 K)
function block(F, V, it, st, L) {
  const lat = 18 + it.r(2) * 16, H = 7 + it.r(3) * (8 + 14 * st.density(st.pos + it.s)), wd = 9 + it.r(4) * 8;
  const [xa, yTop] = project(V, it.s - wd / 2, lat, H), [xb] = project(V, it.s + wd / 2, lat, H), [, yBase] = project(V, it.s, lat, 0);
  if (xb < -20 || xa > V.w + 20) return;
  const [xr, yr] = project(V, it.s, lat, H + 2.2 * (it.r(6) < 0.6));
  poly(F, [[xa, yBase], [xa, yTop], [xr, yr], [xb, yTop], [xb, yBase]], L.towerDark);
  for (let f = 0; f < Math.floor(H / 3); f++) for (let c = 0; c < 3; c++) {
    const q = hash(it.id * 131 + f, c); if (q > 0.38) continue;
    const [x, y, d] = project(V, it.s - wd / 2 + (c + 0.5) * wd / 3, lat, f * 3 + 1.6), sz = Math.max(0.6, 0.7 / d * V.ppr);
    const tv = q < 0.05, flick = tv ? 0.6 + 0.4 * Math.sin(st.t * 23 + it.id) * Math.sin(st.t * 7.1) : 1;
    rect(F, x - sz, y - sz * 0.7, x + sz, y + sz * 0.7, (tv ? L.tv : L.window).map(v => v * flick * 0.5));
  }
}

// power lines between wooden poles 40 m apart, 7 m out, sagging as catenaries (sag about 1.5% of the span)
function wires(F, V, st, L) {
  for (const it of around(st.pos, 40, 7, st.period, 140)) for (let k = 0; k < 3; k++) {
    if (st.road(st.pos + it.s) !== 'street') continue;
    const z0 = 9.4 + 0.5 * k, lat = 7 + 0.3 * k;
    let prev = null;
    for (let q = 0; q <= 24; q++) {
      const u = q / 24, s = it.s + 40 * u, z = z0 - 0.6 * 4 * u * (1 - u), p = project(V, s, lat, z);
      if (prev) for (let m = 0; m <= 4; m++) disc(F, prev[0] + (p[0] - prev[0]) * m / 4, prev[1] + (p[1] - prev[1]) * m / 4, Math.max(0.5, 0.02 / p[2] * V.ppr), L.housing);
      prev = p;
    }
  }
}

// an airliner on approach under the cloud base, its red beacon flashing about once a second
function plane(F, V, st, L) {
  const ph = ((st.t % 24) + 24) % 24, x = V.w * (1.1 - ph / 14), y = V.h * 0.5 - (0.62 - V.el0) * V.ppr * 0.4;
  if (x < -10 || x > V.w + 10) return;
  disc(F, x, y, 0.5, L.nav.map(v => v * 0.08), { mode: 'add' });
  if ((st.t * 1.1) % 1 < 0.12) disc(F, x + 1.5, y + 0.6, 0.5, L.signal[0].map(v => v * 0.006), { mode: 'add' });
}

// a cobra-head lamp: dark housing, glowing refractor below it
function lamp(F, V, it, L, lat, z) {
  const [x, y, d] = project(V, it.s, lat, z);
  if (x < -40 || x > V.w + 40 || y < -40 || y > V.h + 40) return;
  const rx = 0.45 / d * V.ppr / 2, ry = 0.22 / d * V.ppr / 2, [xh, yh] = project(V, it.s, lat + 0.15, z + 0.25);
  ellipse(F, xh, yh, rx * 1.25, ry * 1.4, L.housing, 'set');
  ellipse(F, x, y, rx, ry, L.lamp, 'add');
  // the arm back to the pole, at the pole's side of the head
  const [xp, yp] = project(V, it.s, lat + 2.5, z + 0.3);
  for (let k = 0; k <= 12; k++) { const t = k / 12; disc(F, xh + (xp - xh) * t, yh + (yp - yh) * t, Math.max(0.5, 0.08 / d * V.ppr), L.housing); }
}

function signal(F, V, it, st, L) {
  const lat = 6 + it.r(2) * 2, z = 6.2, phase = ((st.t + it.r(3) * 30) % 30) / 30;
  const which = phase < 0.45 ? 2 : phase < 0.55 ? 1 : 0;
  for (let k = 0; k < 3; k++) {
    const [x, y, d] = project(V, it.s, lat, z + 0.35 * (1 - k)), r = 0.11 / d * V.ppr;
    if (x < -30 || x > V.w + 30) return;
    disc(F, x, y, Math.max(0.6, r * 1.6), L.housing);
    if (k === 2 - which) disc(F, x, y, Math.max(0.5, r), L.signal[which], { mode: 'add' });
  }
}
function ellipse(F, cx, cy, rx, ry, rgb, mode) {
  rx = Math.max(0.5, rx); ry = Math.max(0.5, ry);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry; if (u * u + v * v > 1) continue;
    if (x < 0 || y < 0 || x >= F.w || y >= F.h) continue;
    const i = 3 * (y * F.w + x); for (let c = 0; c < 3; c++) F.d[i + c] = mode === 'add' ? F.d[i + c] + rgb[c] : rgb[c];
  }
}

// illuminance at the car from the nearby lamps (inverse square, cosine to the roof), for the interior wash
export function interiorLight(st) {
  let E = 0;
  for (const { it, lat, z } of lamps(st, 80)) { const h = z - 1.2, d2 = it.s * it.s + lat * lat + h * h; E += (h / Math.sqrt(d2)) / d2; }
  const under = (st.overpasses ?? []).some(o => st.pos > o - 2 && st.pos < o + 20);
  return under ? E * 0.15 : E;
}
export { fill };
