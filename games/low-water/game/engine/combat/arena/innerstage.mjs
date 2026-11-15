// The inner arena's stage on the arena page (staged after John Martin and Schinkel: combat/data/stages-inner.mjs).
// Drawn in values (ink 0 to paper 1) into the 640 x 360 buffer before the tone pass (combat/arena/innertone.mjs):
//   stageGeom(V)        the camera for a dream room (its front edge near the foot of the view, so the building has
//                        the top of the frame) and the stage's screen geometry: the room's edges, the shaft
//   stageBack(V, g)      the void, the haze round the shaft's source, and the building behind the room
//   stageShaft(V, g)     the one shaft of light, from its source to the room's first lamp, and the dust in it
//   stageFront(V, g)     the raw-rock frame and the colossal side piers, over the edges of the view only
// The floor is in combat/arena/innerfloor.mjs. Everything is fixed by the world and the room (hashes, not a random
// source), so a still is the same on every run and nothing in the building moves on its own.
import { stageOf } from "../data/stages-inner.mjs";
import { BACK } from "./innerback.mjs";

const IW = 640, IH = 360, S = 30, TILT = 0.62;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const gray = (v, a = 1) => { const c = Math.round(clamp(v) * 255); return `rgba(${c},${c},${c},${a})`; };
export const hash = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// The dream room's camera: the room's front edge sits near the foot of the view, so what is above its back wall
// (the building) has the top of the frame; across, as the arena's own camera does. Then the stage's geometry.
export function stageGeom(V) {
  const W = V.W, A = W.field.arena, b = W.field.bounds, st = stageOf(A), hd = IH / 2 / (S * TILT);
  if (b.z1 - b.z0 <= 2 * hd) V.cam.z = b.z1 + 0.3 - hd;
  const [xL, yWall] = V.proj(b.x0, b.z0), [xR, yBack] = V.proj(b.x1, b.z0 + 1), [, yFront] = V.proj(b.x0, b.z1);
  const lamp = (A.lights || [])[st.shaft.pool] || (A.lights || [])[0] || { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 };
  const [px, py] = V.proj(lamp.x, lamp.z), rx = (st.shaft.w1 * S) / 2;
  const G = { st, xL, xR, yWall, yBack, yFront, src: [st.shaft.from[0] * IW, st.shaft.from[1] * IH], pool: [px, py, rx, rx * TILT], dark: !!A.blackout };
  V.stage = G;
  return G;
}

export function stageBack(V, g) {
  const G = V.stage, st = G.st;
  g.fillStyle = gray(0.025); g.fillRect(0, 0, IW, IH);
  // the haze round the source: the building stands dark against it (Martin's glow behind the palace)
  const [sx, sy] = G.src, hz = st.haze * (G.dark ? 0.55 : 1), R = 330, grd = g.createRadialGradient(sx, Math.max(sy, 10), 0, sx, Math.max(sy, 10), R);
  grd.addColorStop(0, gray(0.03 + hz)); grd.addColorStop(0.45, gray(0.03 + hz * 0.45)); grd.addColorStop(1, gray(0.03));
  g.fillStyle = grd; g.fillRect(0, 0, IW, G.yWall + 4);
  const gw = giveWay(V);
  if (gw <= 0) for (const m of st.back) { if (BACK[m]) BACK[m](V, g, G); }
  else leanOut(V, g, G, gw);
  // the back wall row: the building's plinth, its top edge catching the shaft
  g.fillStyle = gray(0.035); g.fillRect(0, G.yWall, IW, G.yBack - G.yWall);
  g.fillStyle = gray(0.16); g.fillRect(G.xL, G.yWall, G.xR - G.xL, 1);
}

// how far the room has given way (0 to 1): the Host always; a single-sin boss only in a morph that changes its body
// (DECISIONS-2026-10-22, inner arena staging call 2; inferno/06-SYSTEMS.md "Intensity without volume")
export const BODY_LOOKS = { prudence: ["coats", "eye"], father: ["saturn", "arm"], golem: ["cell", "walls"], beast: ["gap"] };
export function giveWay(V) {
  const W = V.W, I = W.inner || {}, d = W.defs.boss; if (!d || !W.byId("boss")) return 0;
  if (d.form === "host") return 1;
  if (!(BODY_LOOKS[d.form] || []).includes(I.look)) return 0;
  return Math.max(0, Math.min(1, (W.tick - I.morphAt) / 60));
}

// the building in two halves, each leaning out from the boss, and the split in the ceiling over him
function leanOut(V, g, G, gw) {
  const B = V.W.byId("boss"), [bx] = V.proj(B.x, B.z), c = 0.22 * gw;
  for (const [x0, x1, s] of [[0, bx, 1], [bx, IW, -1]]) {
    g.save(); g.beginPath(); g.rect(x0, 0, x1 - x0, G.yWall + 2); g.clip();
    g.transform(1, 0, s * c, 1, -s * c * G.yWall, 0);
    for (const m of G.st.back) if (BACK[m]) BACK[m](V, g, G);
    g.restore();
  }
  const w = 130 * gw, top = -4, bot = Math.max(8, G.yWall - (G.st.ceiling || 3.2) * S * 0.9);
  const edge = (k) => Array.from({ length: 9 }, (_, i) => { const u = i / 8; return [bx + k * w * (1 - u) * 0.5 + (hash(i, k + 3) - 0.5) * 10 * gw, top + (bot - top) * u]; });
  const L = edge(-1), R = edge(1).reverse(), grd = g.createRadialGradient(bx, top, 0, bx, top, Math.max(1, bot - top + 40));
  grd.addColorStop(0, gray(0.3 + 0.2 * gw)); grd.addColorStop(1, gray(0.08));
  g.fillStyle = grd; g.beginPath(); [...L, ...R].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
  g.strokeStyle = gray(0.01); g.lineWidth = 2; for (const E of [L, R]) { g.beginPath(); E.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
}

// The shaft: soft layers from a slot at the source to the pool on the floor, the pool, and dust standing in it
export function stageShaft(V, g) {
  const G = V.stage, sh = G.st.shaft, [sx, sy] = G.src, [px, py, rx, ry] = G.pool, k = sh.k * (G.dark ? 0.75 : 1);
  for (let i = 0; i < 5; i++) {
    const f = 1 - i * 0.18, a = 0.045 * k * 2;
    g.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`; g.beginPath();
    g.moveTo(sx - (sh.w0 / 2) * f, sy); g.lineTo(sx + (sh.w0 / 2) * f, sy); g.lineTo(px + rx * f, py); g.lineTo(px - rx * f, py); g.closePath(); g.fill();
  }
  const grd = g.createRadialGradient(px, py, 0, px, py, rx * 1.15);
  grd.addColorStop(0, `rgba(255,255,255,${(0.32 * k).toFixed(3)})`); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.save(); g.translate(px, py); g.scale(1, TILT); g.translate(-px, -py); g.fillStyle = grd; g.fillRect(px - rx * 1.2, py - rx * 1.2, rx * 2.4, rx * 2.4); g.restore();
}

// dust standing in the shaft, drawn after the bodies: fixed points along the shaft that drift slowly (Only's noon:
// they do not move at all)
export function shaftDust(V, g) {
  const G = V.stage, sh = G.st.shaft, [sx, sy] = G.src, [px, py, rx] = G.pool, t = sh.still ? 0 : V.t;
  for (let i = 0; i < 46; i++) {
    const u = (hash(i, 7) + t * 0.0006 * (0.5 + hash(i, 9))) % 1, w = (hash(i, 8) - 0.5) * 0.9, wid = sh.w0 / 2 + (rx - sh.w0 / 2) * u;
    const x = sx + (px - sx) * u + w * wid + Math.sin(t * 0.01 + i) * 1.5, y = sy + (py - sy) * u;
    if (y < 0) continue;
    g.fillStyle = gray(0.55 + 0.35 * hash(i, 3), 0.45 + 0.4 * (1 - Math.abs(w) * 1.6)); g.fillRect(x | 0, y | 0, 1, 1);
  }
}

// a raw-rock frame round the view (Schinkel's cave mouth, Martin's Pandemonium cavern), and the colossal piers in
// the margins either side of a narrow room. Only the frame's edges: never over the room's floor.
export function stageFront(V, g) {
  const G = V.stage;
  if (G.st.side) for (const [x0, x1, s] of [[0, G.xL - 4, 1], [G.xR + 4, IW, -1]]) if (x1 - x0 > 18) pier(g, x0, x1, s, G);
  if (G.st.rock) rock(V, g, G);
}

function pier(g, x0, x1, side, G) {
  const w = Math.min(70, (x1 - x0) * 0.8), cx = side > 0 ? x1 - w / 2 - 6 : x0 + w / 2 + 6, lit = G.src[0] > cx ? 1 : -1;
  g.fillStyle = gray(0.05); g.fillRect(cx - w / 2, 0, w, IH);
  g.fillStyle = gray(0.07); g.fillRect(cx - w / 2 - 6, IH - 40, w + 12, 40); g.fillRect(cx - w / 2 - 4, G.yWall - 30, w + 8, 10);
  for (let y = 14; y < IH - 40; y += 22) { g.fillStyle = gray(0.035); g.fillRect(cx - w / 2, y, w, 1); }
  g.fillStyle = gray(0.2); g.fillRect(lit > 0 ? cx + w / 2 - 2 : cx - w / 2, 0, 2, IH - 40);
  for (let k = 0; k < 4; k++) { g.fillStyle = gray(0.045); g.fillRect(cx - w / 2 + 6 + k * ((w - 12) / 4), 0, 2, IH - 40); }
}

// ragged rock along the top and down the sides, its inner edge just catching the haze
function rock(V, g, G) {
  const edge = (n, f) => Array.from({ length: n + 1 }, (_, i) => f(i / n, hash(i, n, 31)));
  const top = edge(40, (u, r) => [u * IW, 10 + r * 16 + 26 * (1 - Math.sin(u * Math.PI))]);
  g.fillStyle = gray(0.018); g.beginPath(); g.moveTo(0, 0); for (const [x, y] of top) g.lineTo(x, y); g.lineTo(IW, 0); g.closePath(); g.fill();
  g.strokeStyle = gray(0.12); g.lineWidth = 1; g.beginPath(); top.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? 0 : IW, side = edge(24, (u, r) => [x0 - s * (8 + r * 14 + 30 * (1 - u) ** 2), u * G.yWall + 20]);
    g.fillStyle = gray(0.018); g.beginPath(); g.moveTo(x0, 0); for (const [x, y] of side) g.lineTo(x, y); g.lineTo(x0, G.yWall + 30); g.closePath(); g.fill();
  }
}
