// puppet.mjs: the 2.5D puppet the cast is built from. A character is a list of parts placed in model space (units,
// y down, z toward the viewer at view angle 0). The view turns the whole puppet about its vertical axis, so one
// definition gives every turnaround angle, every expression and every animation frame:
//   morph  a shape drawn twice by hand, from the front and from the side; a view blends the two point for point
//          with weights cos^2 and sin^2 of the view angle (back and far-side views mirror them);
//   tube   a limb: a 3D path with a radius per point, drawn as a capsule;
//   flat   a shape that always faces the camera (sweat, sparks, props held flat);
//   stroke an open inked line on a surface (mouth lines, wrinkles, seams).
// Parts sort by their turned depth, painter's order. A part with `clip` is drawn only inside the part it names, and
// a parent's ink waits until its last clipped child is drawn, so features never cover the outline they sit inside.
import { resample, blend, flipX, apply, tube as tubeOutline, bbox } from './geom.mjs';
import { coverage, clip, cut, shiftCov, paint } from './raster.mjs';
import { inkClosed, inkOpen, boil, KEY_LIGHT } from './ink.mjs';

const RES = new WeakMap();
const res = C => { if (!RES.has(C)) RES.set(C, resample(C, 120)); return RES.get(C); };

export function turn([x, y, z], theta) {
  const c = Math.cos(theta), s = Math.sin(theta);
  return [x * c + z * s, y, -x * s + z * c];
}

// The 2D outline of a morph part at view angle theta, in model units, centred on the turned centre.
export function morphOutline(p, theta) {
  const c = Math.cos(theta), s = Math.sin(theta), F = res(c < 0 && p.back ? p.back : p.front), S = res(p.side ?? p.front);
  const f = c < 0 && !p.back ? flipX(F) : F, sd = s < 0 ? flipX(S) : S;
  const B = blend(resample(f, 120), resample(sd, 120), c * c, s * s), [cx, cy] = turn(p.at, theta);
  // aim: [from, to] in 3D; the shape (authored pointing down, +y) turns to follow that bone on screen
  let a = p.rot ?? 0;
  if (p.aim) { const A = turn(p.aim[0], theta), Bq = turn(p.aim[1], theta), dx = Bq[0] - A[0], dy = Bq[1] - A[1]; if (Math.hypot(dx, dy) > 1e-3) a += Math.atan2(dy, dx) - Math.PI / 2; }
  if (!a) return B.map(([x, y]) => [x + cx, y + cy]);
  const ca = Math.cos(a), sa = Math.sin(a);
  return B.map(([x, y]) => [ca * x - sa * y + cx, sa * x + ca * y + cy]);
}

// Turn every part into screen geometry with a depth. m maps model units to pixels.
export function place(parts, theta, m) {
  const out = [];
  for (const p of parts) {
    if (p.hide?.(theta)) continue;
    let C, d, open = false;
    if (p.kind === 'morph') { C = morphOutline(p, theta); d = turn(p.at, theta)[2]; }
    else if (p.kind === 'tube') { const T = p.path.map(q => turn(q, theta)); C = tubeOutline(T.map(q => [q[0], q[1]]), p.r); d = T.reduce((s, q) => s + q[2], 0) / T.length; }
    else if (p.kind === 'flat') { const [cx, cy, cz] = turn(p.at, theta); C = p.shape.map(([x, y]) => [x + cx, y + cy]); d = cz; }
    else if (p.kind === 'stroke') { const T = p.path.map(q => turn(q, theta)); C = T.map(q => [q[0], q[1]]); d = T.reduce((s, q) => s + q[2], 0) / T.length; open = true; }
    else throw new Error(`puppet: unknown part kind ${p.kind}`);
    out.push({ p, C: apply(m, C), depth: d + (p.bias ?? 0), open });
  }
  // depthOf: [id, offset] pins a part just behind (or in front of) another, whatever the view (a neck under its head)
  const byId = new Map(out.map(o => [o.p.id, o]));
  for (const o of out) if (o.p.depthOf && byId.has(o.p.depthOf[0])) o.depth = byId.get(o.p.depthOf[0]).depth + o.p.depthOf[1];
  // stick: a decal on its clip parent (a sticker's face, a tooth in a gum) draws right after that parent in any view
  for (let pass = 0; pass < 3; pass++) for (const o of out) if (o.p.stick && o.p.clip && byId.has(o.p.clip)) { const q = byId.get(o.p.clip); o.depth = q.depth + 0.001 * (1 + (o.p.bias ?? 0) - (q.p.bias ?? 0)); }
  return out.sort((a, b) => a.depth - b.depth);
}

const pxScale = m => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

// Draw a placed puppet onto canvas K. opts: { ink: '#hex', inkW (model units), boil: { amp px, cell px, seed,
// step }, light, shade: true }.
export function drawPuppet(K, parts, theta, m, opts = {}) {
  const S = place(parts, theta, m), k = pxScale(m), covs = new Map(), pending = new Map(), kids = new Map();
  for (const s of S) if (s.p.clip) kids.set(s.p.clip, (kids.get(s.p.clip) ?? 0) + 1);
  const ink = opts.ink ?? '#17120e', light = opts.light ?? KEY_LIGHT, bo = opts.boil ?? {};
  for (const s of S) {
    const p = s.p, parent = p.clip ? covs.get(p.clip) : null;
    if (p.clip && !covs.has(p.clip)) { settle(p.clip); continue; }          // its parent is hidden or not drawn yet
    const [C] = boil([s.C], { ...bo, seed: `${bo.seed ?? 'boil'}/${p.id}`, amp: (bo.amp ?? 0) * (p.boil ?? 1) });
    const iw = (p.inkW ?? 1) * (opts.inkW ?? 7) * k;                         // inkW is in model units
    if (s.open) { const A = coverage(inkOpen(C, { w: iw * (p.w ?? 0.7), taper: p.taper }), K.w, K.h); paint(K, parent ? clip(A, parent) : A, p.color ?? ink); settle(p.clip); continue; }
    let A = coverage([C], K.w, K.h); if (parent) A = clip(A, parent);
    if (!A) { settle(p.clip); continue; }
    paint(K, A, p.fill, p.opacity ?? 1);
    if (p.shade && opts.shade !== false) shadeCel(K, A, C, p.shade, light);
    if (p.pattern) p.pattern(K, A, C, k);
    if (opts.surface) opts.surface(K, A, C, p, k);
    covs.set(p.id, A);
    const drawInk = () => { if (p.inkW === 0 || opts.outline === false) return; let I = coverage(inkClosed(C, { w: iw, light }), K.w, K.h); if (parent) I = clip(I, parent); paint(K, I, p.inkColor ?? ink); };
    if (kids.get(p.id)) pending.set(p.id, drawInk); else drawInk();
    settle(p.clip);
  }
  for (const f of pending.values()) f();
  return covs;
  function settle(id) { if (!id) return; const n = (kids.get(id) ?? 1) - 1; kids.set(id, n); if (n <= 0 && pending.has(id)) { pending.get(id)(); pending.delete(id); } }
}

// Cel shadow: the part minus itself shifted toward the light, painted in the shadow tone.
function shadeCel(K, A, C, shade, light) {
  const [x0, y0, x1, y1] = bbox([C]), size = Math.min(x1 - x0, y1 - y0) * (shade.off ?? 0.16);
  const B = cut(A, shiftCov(A, light[0] * size, light[1] * size));
  paint(K, B, shade.fill ?? shade, shade.opacity ?? 1);
}

// A model-to-screen map: model units (y down, feet at y = 0) to pixels, feet at (x, y), `px` pixels per unit.
export const stage = (x, y, px) => [px, 0, 0, px, x, y];
