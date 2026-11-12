// Mother's lamp room, relit: the great lens (a beehive of prism rings round the arc), a third of its
// prisms cast from green bottle glass; the keeper holding one up; the log on its desk, filled in a
// month ahead; the restrike panel. Through the lantern's bars, the town far below in sodium.
import { box, cyl, sph, ell, cap, figure, vnoise, fbm, sat } from "../sdf.mjs";

export const ID = { floor: 1, bar: 2, rail: 3, ring: 4, ringGreen: 5, arc: 6, pedestal: 7, coat: 8, skin: 9, prism: 10, desk: 11, book: 12, panel: 13, button: 14, town: 15, sea: 16, roof: 17, hair: 18 };
let cur = 0; export const idOf = () => cur;
const C = [0, 2.6, 0], R0 = 1.35;
const WENNA = { pos: [-2.0, 0, 1.5], a: 0.64, h: 1.62, head: 0.27, stoop: 0.45, girth: 0.4, neck: 0.15, arms: 1.1 };
const tmp = { d: 0, part: 0 };
const ENV = typeof process !== "undefined" && process.env ? process.env : {}, PLATE = ENV.LW_PLATE === "1", ARC = ENV.LW_ARC !== "off";
// which rings are green: the keeper's replacements (fixed pattern, about a third)
const green = (k) => [1, 4, 5, 8, 11, 12].includes(k);

export function map(x, y, z) {
  let d = Infinity, id = 0;
  const T = (t, i) => { if (t < d) { d = t; id = i; } };
  T(y, ID.floor);
  // the lantern: a ring of bars and a rail; glass is not drawn
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  if (r > 4.4 && r < 5.6) {
    const seg = (2 * Math.PI) / 14, aa = ((a % seg) + seg) % seg - seg / 2;
    T(Math.max(Math.abs(aa * r) - 0.06, Math.abs(r - 5.0) - 0.08, y - (PLATE ? 3.2 : 6.2), PLATE ? (x + z) - 2.5 : -1), ID.bar);
    T(Math.max(Math.abs(r - 5.0) - 0.1, Math.abs(y - 1.0) - 0.06), ID.rail);
    if (!PLATE) T(Math.max(Math.abs(r - 5.0) - 0.14, Math.abs(y - 6.2) - 0.15), ID.rail);
  }
  if (!PLATE) T(Math.max(-(y - 6.3), r - 5.4, y - 6.6), ID.roof);
  // the lens: horizontal prism rings bulging into a beehive round the arc
  const lensBound = Math.max(r - R0 - 0.35, 0.85 - y, y - 4.55);
  if (lensBound < 0.25) {
    const slit = Math.abs(Math.sin(a * 4)) * r - 0.035;
    for (let k = 0; k < 14; k++) {
      const yk = 1.05 + k * 0.255, t = (yk - C[1]) / 1.6, rk = R0 * Math.sqrt(Math.max(0.12, 1 - t * t * 0.55)) + 0.08;
      const tor = (Math.hypot(r - rk, (y - yk) * 1.5) / 1.5 - 0.105) * 0.9;
      T(Math.max(tor, -slit), green(k) ? ID.ringGreen : ID.ring);
    }
    T(Math.max(Math.abs(slit + 0.035) - 0.012, Math.abs(y - 2.7) - 1.85, Math.abs(r - R0) - 0.25), ID.pedestal); // the brass frame
  } else if (lensBound < d) d = lensBound; // a bound only: never a hit, keeps the id
  T(sph(x, y, z, C[0], C[1], C[2], 0.18), ID.arc);
  T(cyl(x, y, z, 0, 0.45, 0, 0.55, 0.45), ID.pedestal);
  // the keeper, a green prism in her hand at the window of the lens
  if (!PLATE) { const q = figure(x, y, z, WENNA, tmp); if (q < d) { d = q; id = tmp.part === 1 ? ID.skin : ID.coat; } }
    if (!PLATE) T(Math.max(Math.abs(x + 1.42) + Math.abs(z - 1.08) - 0.17, Math.abs(y - 1.55) - 0.13), ID.prism);
  // the log on its desk and the restrike panel
  T(box(x, y, z, -2.6, 0.85, 2.3, 0.7, 0.05, 0.45), ID.desk); for (const s of [-1, 1]) T(box(x, y, z, -2.6 + 0.6 * s, 0.42, 2.3, 0.05, 0.42, 0.4), ID.desk);
  T(box(x, y, z, -2.55, 0.93, 2.3, 0.42, 0.03, 0.3), ID.book);
  T(box(x, y, z, -3.6, 1.7, -2.2, 0.06, 0.45, 0.35), ID.panel); T(sph(x, y, z, -3.52, 1.75, -2.2, 0.07), ID.button);
  // below the lantern: the sea, and the town in sodium
  T(y + 30, ID.sea);
  if (y < -10) { const cx = Math.floor(x / 2.2), cz = Math.floor(z / 2.2), lit = vnoise(cx * 0.9, cz * 0.9) > 0.68 && (cx * cx + cz * cz) > 100 && z < -10;
    if (lit) T(sph(x, y, z, cx * 2.2 + 1.1, -29.3, cz * 2.2 + 1.1, 0.35), ID.town); }
  cur = id; return d;
}
export const materials = [{ name: "lw bottle", q: [-60, 45, -6.94], peak: 0.55 }, { name: "lw prism", flat: 0.85 }, { name: "lw brass", q: [0, 10, -4.4], peak: 0.7 }, { name: "lw navy", q: [0, -12, 3.6], peak: 0.22 }, { name: "lw flesh", q: [0, 6, -2.2], peak: 0.55 }, { name: "lw bone", q: [0, 2, -0.1], peak: 0.72 }, { name: "lw oxblood", q: [0, 10, -6.0], peak: 0.55 }, { name: "lw tar", flat: 0.035 }, { name: "lw water", flat: 0.03 }];
const S = (mat, scale = 1, wet = 0, emit = null) => ({ mat, scale, wet, emit });
export function surf(id, P) {
  const n = fbm(P[0] * 2 + P[1], P[2] * 2);
  switch (id) {
    case ID.floor: return S("metal", 0.6 + 0.3 * n, 0.3); case ID.bar: case ID.rail: case ID.roof: return S("lw tar", 2);
    case ID.ring: return S("lw prism", 1.2, 0.6); case ID.ringGreen: return S("lw bottle", 1.4, 0.6);
    case ID.arc: return ARC ? S("grey", 0, 0, { type: "led", I: 400 }) : S("metal", 1.2);
    case ID.pedestal: return S("lw brass", 0.8, 0.4);
    case ID.coat: return S("lw oxblood", 0.8); case ID.skin: return S("lw flesh", 1); case ID.hair: return S("lw bone", 1);
    case ID.prism: return S("lw bottle", 2.2, 0.8);
    case ID.desk: return S("lw tar", 4); case ID.book: return S("lw bone", 1.1); case ID.panel: return S("lw brass", 0.9, 0.3); case ID.button: return S("red paint", 1.2);
    case ID.town: return S("grey", 0, 0, { type: "sodium", I: 60 }); case ID.sea: return S("lw water", 1, 1);
    default: return S("grey", 1);
  }
}
export function lights() {
  if (!ARC) return [{ pos: [-30, 18, -40], type: 3, I: 900, cone: [0, 0, 0], mode: 0, reach: 90 }, { pos: [30, -25, 30], type: 0, I: 2500, cone: [0, 0, 0], mode: 0, reach: 90 }];
  // the arc itself; the same arc seen refracted outward across the ring faces (a light just
  // outside the lens on each side the camera can see), and a cold sky through the bars
  return [
    { pos: [0, 2.6, 0], type: 2, I: 30, cone: [0, 0, 0], mode: 0, reach: 12 },
    { pos: [1.9, 2.6, 2.6], type: 2, I: 9, cone: [0, 0, 0], mode: 0, reach: 6 },
    { pos: [2.9, 2.4, -0.4], type: 2, I: 7, cone: [0, 0, 0], mode: 0, reach: 6 },
    { pos: [-0.6, 2.7, 3.1], type: 2, I: 7, cone: [0, 0, 0], mode: 0, reach: 6 },
    { pos: [-30, 18, -40], type: 3, I: 600, cone: [0, 0, 0], mode: 0, reach: 90 },
  ];
}
export const sky = (d) => 0.02 + 0.05 * Math.max(0, d[1]);
export const ripple = (P) => [0.05 * (vnoise(P[0] * 3, P[2] * 3) - 0.5), 0.05 * (vnoise(P[0] * 3 + 5, P[2] * 3) - 0.5)];
export default { map, idOf, materials, surf, lights, sky, ripple };
