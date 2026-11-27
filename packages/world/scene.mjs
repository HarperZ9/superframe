// SPDX-License-Identifier: MIT
// scene.mjs: one continuous scene in the field. Light crosses a Luneburg glass and a body of stirred water; a probe
// reads the water; the water is dimensioned; a voice sends a wave through all of it; a graticule shows where things
// are against where they are seen. None of these is a room: each is a property some element carries at a weight, and
// every element can carry every property. Pure: no DOM, no clock, no randomness, so a test and a page agree.
//
//   const s = createScene();        the default elements; s.elements is the list, each with .carries and .x, .y
//   s.step();                       one step of flow, dye and sound, then the field is worked out again
//   s.trace()                       the rays, as polylines in scene units, with each ray's turn in degrees
//   s.read()                        what the measuring elements read, with spread, units and the instrument's state
//   s.dims()                        the toleranced dimensions of what carries shape
//   s.describe()                    the scene in words
import { PROPERTY_IDS as NAMES, element, carry, disc, union2, mix2, n2Blend } from "./field.mjs";
import { CORES, PROPERTIES, lensProfile, traceZ0, SOUND_N2 } from "./properties.mjs";
import { measureField, dimsOf } from "./scene-read.mjs";

export const SIZE = Object.freeze({ w: 2, h: 1.2, nx: 100, ny: 60, mmPerUnit: 100, stepsPerSecond: 60 });
const TAU = 2 * Math.PI;

export const DEFAULTS = Object.freeze([
  { id: "glass", name: "Glass", x: 0.62, y: 0.6, radius: 0.3, edge: 0.06, carries: { lens: 1 }, traits: { profile: "luneburg", material: "glass" } },
  { id: "water", name: "Water", x: 1.3, y: 0.6, radius: 0.36, edge: 0.08, carries: { lens: 1, flow: 1, shape: 1 }, traits: { material: "water" } },
  { id: "probe", name: "Probe", x: 1.3, y: 0.6, radius: 0.07, edge: 0.03, carries: { measure: 1 }, traits: { material: "water" } },
  { id: "voice", name: "Voice", x: 0.95, y: 0.16, radius: 0.08, edge: 0.03, carries: { sound: 0.4 }, traits: { material: "water" } },
  { id: "ground", name: "Ground", x: 1, y: 0.6, radius: 1.4, edge: 0.2, carries: { map: 0.35 }, traits: { material: "water" } },
]);

export function createScene({ elements = DEFAULTS, size = SIZE } = {}) {
  const { nx, ny, w, h } = size, n = nx * ny, hc = w / nx;
  const els = elements.map((e) => element(structuredClone(e)));
  const F32 = () => new Float32Array(n);
  const g = { u: F32(), v: F32(), dye: F32(), p: F32(), div: F32(), curl: F32(), tmp: F32(), tmp2: F32(), conf: F32(), n2: F32(),
    phase: new Uint8Array(n).fill(1), solid: new Uint8Array(n), masks: new Map(), s: Object.fromEntries(NAMES.map((p) => [p, F32()])) };
  const wave = new CORES.WaveField(nx, ny, { cfl: 0.5, damp: 0.015 });
  const s = { size, els, g, wave, t: 0, get elements() { return els; } };
  const cx = (i) => (i + 0.5) * hc, cy = (j) => (j + 0.5) * hc;

  // masks and strengths: every element's soft region, then each property's union over the elements
  s.field = () => {
    for (const el of els) {
      const m = g.masks.get(el.id) || g.masks.set(el.id, F32()).get(el.id);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { m[j * nx + i] = disc(cx(i) - el.x, cy(j) - el.y, el.radius, el.edge); }
    }
    for (const p of NAMES) { const S = g.s[p]; S.fill(0); for (const el of els) { const wgt = el.carries[p]; if (!wgt) continue; const m = g.masks.get(el.id); for (let k = 0; k < n; k++) S[k] = union2(S[k], carry(m[k], wgt)); } }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) g.n2[j * nx + i] = s.n2Point(cx(i), cy(j));
    return s;
  };
  // n^2 at any point: each lens carrier's own profile, worked out where the ray is, so a ray bends smoothly through a
  // lens; only the dye and the pressure, which live on the grid, are interpolated between cells.
  s.n2Point = (x, y) => {
    const gx = x / hc - 0.5, gy = y / hc - 0.5, dye = bilerp(g.dye, nx, ny, gx, gy), pr = bilerp(wave.p, nx, ny, gx, gy);
    let st = 0, acc = 0, v = 0;
    for (const el of els) {
      const wgt = el.carries.lens; if (!wgt) continue;
      const c = carry(disc(x - el.x, y - el.y, el.radius, el.edge), wgt); if (c <= 0) continue;
      st = union2(st, c); v = mix2(acc, v, c, lensProfile(el, x, y, dye)); acc += c;
    }
    return Math.max(0.5, n2Blend(st, acc > 0 ? v : 1) + SOUND_N2 * pr);
  };

  s.step = () => { stepFlow(s); stepSound(s); s.t++; return s.field(); };
  s.n2At = (x, y) => bilerp(g.n2, nx, ny, x / hc - 0.5, y / hc - 0.5);
  s.trace = (rays = 17) => traceRays(s, rays);
  s.read = () => measureField(s, { traceZ0 });
  s.dims = () => dimsOf(s);
  s.describe = () => describe(s);
  s.set = (id, patch) => { const el = els.find((e) => e.id === id); if (!el) throw new Error(`scene: no element ${id}`); Object.assign(el, patch.carries ? { ...patch, carries: { ...el.carries, ...patch.carries } } : patch); return s.field(); };
  return s.field();
}

export function bilerp(f, nx, ny, x, y) {
  x = Math.min(nx - 1.001, Math.max(0, x)); y = Math.min(ny - 1.001, Math.max(0, y));
  const i = x | 0, j = y | 0, a = x - i, b = y - j, k = j * nx + i;
  return (1 - b) * ((1 - a) * f[k] + a * f[k + 1]) + b * ((1 - a) * f[k + nx] + a * f[k + nx + 1]);
}

// Flow: each element carrying flow stirs the water around a centre that wanders, and pours dye at a point that circles.
// The stable-fluids core moves it; outside what carries flow the water is held still, across the rim it slows smoothly.
function stepFlow(s) {
  const { g, els, size: { nx, ny, w } } = s, hc = w / nx, n = nx * ny, F = g.s.flow;
  for (const el of els) {
    const wgt = el.carries.flow; if (!wgt) continue;
    const m = g.masks.get(el.id), ph = s.t * 0.021, ox = el.x + 0.35 * el.radius * Math.cos(ph), oy = el.y + 0.35 * el.radius * Math.sin(ph * 1.3);
    const px = el.x + 0.55 * el.radius * Math.cos(-ph * 1.7), py = el.y + 0.55 * el.radius * Math.sin(-ph * 1.7);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, c = carry(m[k], wgt); if (c <= 0) continue;
      const dx = (i + 0.5) * hc - ox, dy = (j + 0.5) * hc - oy, r2 = (dx * dx + dy * dy) / (el.radius * el.radius);
      const swirl = 0.05 * c * Math.exp(-r2 * 1.5) / el.radius;
      g.u[k] += -dy * swirl; g.v[k] += dx * swirl;
      const ex = (i + 0.5) * hc - px, ey = (j + 0.5) * hc - py, pour = Math.exp(-(ex * ex + ey * ey) / (0.0025 * el.radius / 0.36));
      g.dye[k] = Math.min(1.2, g.dye[k] + 0.06 * c * pour);
    }
  }
  for (let k = 0; k < n; k++) g.conf[k] = 0.25 * F[k];
  CORES.confine(g.u, g.v, g.conf, nx, ny, 1, g.curl);
  g.tmp.set(g.u); g.tmp2.set(g.v);
  CORES.advect(g.tmp, g.tmp, g.tmp2, nx, ny, 1, g.u); CORES.advect(g.tmp2, g.tmp, g.tmp2, nx, ny, 1, g.v);
  CORES.project(g.u, g.v, g.phase, g.solid, nx, ny, 16, g.p, g.div);
  for (let k = 0; k < n; k++) { const hold = 1 - 0.25 * (1 - F[k]); g.u[k] *= 0.996 * hold; g.v[k] *= 0.996 * hold; }
  g.tmp.set(g.dye); CORES.advect(g.tmp, g.u, g.v, nx, ny, 1, g.dye);
  CORES.diffuse(g.dye, 0.02, nx, ny, 2, g.tmp, null);
  for (let k = 0; k < n; k++) g.dye[k] *= 0.9985 - 0.03 * (1 - F[k]);
}
// Sound: the elements carrying sound drive one wave at their weighted centre, with the summed weight as its strength.
function stepSound(s) {
  const { els, wave, size: { nx, w } } = s, hc = w / nx;
  let a = 0, x = 0, y = 0;
  for (const el of els) { const c = el.carries.sound; if (!c) continue; a += c; x += c * el.x; y += c * el.y; }
  wave.step(a > 0 ? [x / a / hc, y / a / hc] : null, a > 0 ? 0.05 * a * Math.sin((TAU * s.t) / 24) : 0);
}

// Rays: parallel light from the left, each integrated by the lens core's RK4 step of x'' = grad(n^2) / 2.
function traceRays(s, rays) {
  const { w, h } = s.size, dt = 0.01, out = [];
  const n2 = (q) => s.n2Point(q[0], q[1]);
  for (let r = 0; r < rays; r++) {
    let p = [0.005, (h * (r + 0.5)) / rays, 0], v = [Math.sqrt(n2(p)), 0, 0];
    const pts = [[p[0], p[1]]];
    for (let k = 0; k < 600 && p[0] < w && p[0] >= 0 && p[1] >= 0 && p[1] <= h; k++) {
      ({ p, v } = CORES.rk4(p, v, dt, n2));
      if (k % 3 === 2) pts.push([p[0], p[1]]);
    }
    pts.push([p[0], p[1]]);
    out.push({ points: pts, turn: (Math.atan2(v[1], v[0]) * 180) / Math.PI });
  }
  return out;
}

function describe(s) {
  const rays = s.trace(), turned = rays.filter((r) => Math.abs(r.turn) > 1), most = rays.reduce((a, r) => (Math.abs(r.turn) > Math.abs(a.turn) ? r : a), rays[0]);
  const say = [`Light enters from the left in ${rays.length} rays; ${turned.length} leave turned by more than a degree, the most by ${Math.abs(most.turn).toFixed(0)} degrees.`];
  const carried = NAMES.map((p) => [p, s.els.filter((e) => e.carries[p] > 0).map((e) => `${e.name.toLowerCase()} at ${Math.round(e.carries[p] * 100)} percent`)]).filter(([, l]) => l.length);
  say.push(carried.map(([p, l]) => `${PROPERTIES[p].name} is carried by ${l.join(" and ")}.`).join(" "));
  const r = s.read();
  if (r.readings.length) say.push(`The measuring region reads ${r.readings.filter((q) => q.show).map((q) => `${q.name} ${q.text}`).join(", ")}.`);
  else say.push("Nothing carries measurement, so nothing is read.");
  const d = s.dims();
  if (d) say.push(`The shaped region is ${d.major.text} by ${d.minor.text}.`);
  return say.join(" ");
}
