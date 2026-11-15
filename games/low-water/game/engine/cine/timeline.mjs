// A cinematic as data and the pure functions that read it (design/CINEMATICS.md section 3.3). No DOM: the player
// (cine/player.mjs) draws what these return, and tests/cinematic.test.mjs checks them in node.
//   compile(script)              -> { shots (with t0, t1), total }
//   shotAt(C, t)                 -> { shot, i, local, u }
//   keyAt(keys, s, field, calm)  the value of a keyed field at local second s (eased; held at the middle when calm)
//   viewOf(pj, cam, W, H)        the view on the plate: { left, top, zoom, w, h } in plate pixels
//   peopleAt(shot, s)            [{ who, at, face, walking, gesture }]
//   morphAt(shot, s, calm)       the morph's weight 0..1
//   textAt(shot, s)              the words on screen now
//   cutsOf(C) / cutRule(C, min)  hard cuts and the spacing rule (05-CARE section 2: a cut is one transition)
//   onGround(pj, pos, p, tol)    a world point lies on the painted ground the plate shows (no figure in a wall)
import { projectPlate } from "../world/camera.mjs";

export const FRAME = [1920, 1080];
const smooth = (u) => u * u * (3 - 2 * u);
const lerp = (a, b, u) => (Array.isArray(a) ? a.map((v, k) => v + (b[k] - v) * u) : a + (b - a) * u);

export function compile(script) {
  let t = 0; const shots = script.shots.map((s, i) => { const o = { ...s, i, t0: t, t1: t + s.dur }; t += s.dur; return o; });
  return { ...script, shots, total: t };
}
export function shotAt(C, t) {
  const tt = Math.max(0, Math.min(C.total - 1e-6, t));
  const i = C.shots.findIndex((s) => tt >= s.t0 && tt < s.t1), shot = C.shots[i < 0 ? C.shots.length - 1 : i];
  return { shot, i: shot.i, local: tt - shot.t0, u: (tt - shot.t0) / shot.dur };
}

// keys: [{ s, [field]: value }] sorted by s. Between two keys the value eases; outside them it holds. Calm (reduced
// motion): the camera holds the key nearest the middle of the keyed span; a focus or other field cuts at each key.
export function keyAt(keys, s, field, calm = false, hold = "middle") {
  const K = (keys || []).filter((k) => k[field] !== undefined); if (!K.length) return undefined;
  if (calm && hold === "middle") { const mid = (K[0].s + K[K.length - 1].s) / 2; return K.reduce((b, k) => (Math.abs(k.s - mid) < Math.abs(b.s - mid) ? k : b))[field]; }
  if (s <= K[0].s) return K[0][field];
  for (let j = 1; j < K.length; j++) {
    if (s > K[j].s) continue;
    if (calm) return K[j - 1][field];   // a cut at the next key
    return lerp(K[j - 1][field], K[j][field], smooth((s - K[j - 1].s) / Math.max(1e-6, K[j].s - K[j - 1].s)));
  }
  return K[K.length - 1][field];
}

// cam: { at: world point at the frame's centre, zoom: 1 fits the plate to the frame }. The view never leaves the plate.
export function viewOf(pj, cam, W = FRAME[0], H = FRAME[1]) {
  const fit = Math.max(W / pj.width, H / pj.height), zoom = fit * Math.max(1, cam.zoom || 1), w = W / zoom, h = H / zoom;
  const [cx, cy] = projectPlate(pj.camera, pj.width, pj.height, cam.at);
  const left = Math.max(0, Math.min(pj.width - w, cx - w / 2)), top = Math.max(0, Math.min(pj.height - h, cy - h / 2));
  return { left, top, zoom, w, h };
}
export const toScreen = (pj, view, p) => { const [x, y] = projectPlate(pj.camera, pj.width, pj.height, p); return [(x - view.left) * view.zoom, (y - view.top) * view.zoom]; };

// A person: { who, path: [[x, y, z], ...], from, to (local seconds over which the path is walked), face (radians, when
// standing), acts: [{ s, anim, dur, hold, faceTo: [x, z] }] }. Walking speed is the path's length over (to - from).
function along(path, u) {
  if (path.length === 1) return { at: path[0], dir: null };
  const seg = path.slice(1).map((p, k) => Math.hypot(p[0] - path[k][0], p[2] - path[k][2])), total = seg.reduce((a, b) => a + b, 0);
  let d = Math.max(0, Math.min(1, u)) * total;
  for (let k = 0; k < seg.length; k++) {
    if (d <= seg[k] || k === seg.length - 1) { const f = seg[k] ? Math.min(1, d / seg[k]) : 0, a = path[k], b = path[k + 1]; return { at: lerp(a, b, f), dir: [b[0] - a[0], b[2] - a[2]] }; }
    d -= seg[k];
  }
  return { at: path[path.length - 1], dir: null };
}
export function personAt(p, s) {
  const from = p.from ?? 0, to = p.to ?? from, moving = to > from && s > from && s < to;
  const { at, dir } = along(p.path, to > from ? (s - from) / (to - from) : 0);
  let face = p.face ?? 0; if (moving && dir) face = Math.atan2(dir[1], dir[0]); else if (s >= to && to > from && p.faceEnd !== undefined) face = p.faceEnd;
  let gesture = null;
  for (const a of p.acts || []) if (s >= a.s && (a.hold || s < a.s + a.dur)) {
    gesture = { anim: a.anim, t: Math.min(s - a.s, a.hold ? a.dur : Infinity) };
    if (a.faceTo) face = Math.atan2(a.faceTo[1] - at[2], a.faceTo[0] - at[0]);
  }
  return { who: p.who, slot: p.slot, at, face, walking: moving && !gesture, gesture };
}
export const peopleAt = (shot, s) => (shot.people || []).filter((p) => (p.on ?? 0) <= s && s < (p.off ?? Infinity)).map((p) => personAt(p, s));

// morph: { look, in: [s0, s1], out: [s2, s3] }: up over [s0, s1], held, down over [s2, s3]; calm: a cut at s1 and s2
export function morphAt(shot, s, calm = false) {
  const m = shot.morph; if (!m) return 0;
  const [a, b] = m.in, [c, d] = m.out;
  if (calm) return s >= b && s < c ? 1 : 0;
  if (s < a || s >= d) return 0;
  if (s < b) return smooth((s - a) / (b - a));
  if (s < c) return 1;
  return 1 - smooth((s - c) / (d - c));
}
export const textAt = (shot, s) => (shot.text || []).filter((x) => s >= x.s0 && s < x.s1);

// A shot begins with a hard cut unless it names a dissolve (seconds); under reduced motion every dissolve is a cut.
export function cutsOf(C, calm = false) { return C.shots.slice(1).filter((s) => calm || !s.dissolve).map((s) => s.t0); }
export function cutRule(C, min = 0.4, calm = false) {
  const ts = cutsOf(C, calm), errs = [];
  for (let k = 1; k < ts.length; k++) if (ts[k] - ts[k - 1] < min) errs.push(`cuts at ${ts[k - 1].toFixed(2)} s and ${ts[k].toFixed(2)} s are under ${min} s apart`);
  return errs;
}

// The plate's world point under a plate pixel (geo-pos.f32 at geoScale), or null where nothing was painted.
export function geoPoint(pj, pos, px, py) {
  const s = pj.geoScale || 1, gw = Math.round(pj.width * s), gh = Math.round(pj.height * s), x = Math.floor(px * s), y = Math.floor(py * s);
  if (x < 0 || y < 0 || x >= gw || y >= gh) return null;
  const i = (y * gw + x) * 3, P = [pos[i], pos[i + 1], pos[i + 2]];
  return Number.isFinite(P[0] + P[1] + P[2]) && !(P[0] === 0 && P[1] === 0 && P[2] === 0) && P[1] < 999 ? P : null;
}
// A figure's feet at p stand on what the plate shows at that pixel: the painted surface there is within tol metres
// of p, and low (ground, not a roof or a wall's face).
export function onGround(pj, pos, p, tol = 0.8) {
  const [px, py] = projectPlate(pj.camera, pj.width, pj.height, p), g = geoPoint(pj, pos, px, py);
  return !!g && Math.hypot(g[0] - p[0], g[2] - p[2]) <= tol && Math.abs(g[1] - p[1]) <= 0.5;
}
