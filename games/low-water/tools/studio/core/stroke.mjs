// Strokes: a pointer path turned into dabs at even spacing, by tool, with undo tiles taken before each
// write, and a record of the path so the stroke can be replayed (onto a regenerated underpainting, at
// another canvas size, or through a re-projection map after the reference changes).
//   const S = beginStroke(doc, layer, brush, { history, author, seed })
//   strokeTo(S, x, y, pressure) -> dirty rect     endStroke(S) -> record
//   replay(doc, records, { history, map, onStroke }) -> count replayed
import { BRUSH, rnd, makeBristles, dabBristles, dabBounds, clamp } from "./brush.mjs";
import { knifeDab, smudgeDab } from "./knife.mjs";
import { begin, touch, end } from "./history.mjs";
import { composite, grow } from "./doc.mjs";
import { setBlend } from "./blend.mjs";
import { idsAt } from "./placement.mjs";
import { encodeN, planeNormal, sitterFacing } from "./form.mjs";
import { liquify, transform } from "./liquify.mjs";

const DABS = { brush: dabBristles, eraser: dabBristles, knife: knifeDab, smudge: smudgeDab };
export const TOOLS = Object.keys(DABS);
const union = (a, b) => (!a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });

export function beginStroke(doc, layer, brush = {}, { history = null, author = "human", seed = 1 } = {}) {
  if (!layer) throw new Error("studio: no layer to paint on");
  if (layer.locked) throw new Error(`studio: layer "${layer.name}" is locked (the underpainting is regenerated, not painted; add a layer)`);
  if (doc.stale) composite(doc);   // a wet brush picks up what the stack shows now, never a stale picture
  const B = { ...BRUSH, ...brush, colour: [...(brush.colour || BRUSH.colour)] };
  if (!DABS[B.tool]) throw new Error(`studio: no tool "${B.tool}"`);
  const rand = rnd(seed), S = { doc, layer, brush: B, rand, bristles: makeBristles(B, rand), pts: [], last: null, dir: [1, 0], history, author, seed, rect: null,
    vis: doc.layers.filter((l) => l.visible && l.kind !== "mask").map((l) => l.name),   // what the wet brush could touch, for an exact replay
    groups: doc.groups && Object.keys(doc.groups).length ? structuredClone(doc.groups) : null };
  if (layer.kind === "form") S.formRGB = encodeN(planeNormal(B.plane || { yaw: 0, pitch: 0 }, sitterFacing(doc.meta)));   // the plane this stroke lays
  if (history) begin(history, layer);
  return S;
}
function dabAt(S, x, y, p) {
  if (S.history) touch(S.history, dabBounds(S, x, y));
  const r = DABS[S.brush.tool](S, x, y, S.dir, p); S.rect = union(S.rect, r); return r;
}
// dab spacing: the brush's own (a fraction of its size), but never wider than one bristle's footprint, or
// a sparse wide brush leaves rows of beads; k scales what each dab lays and takes up, so a finer spacing
// does not lay more paint along the same length
function spacingAt(B, p) {
  const step0 = Math.max(0.7, B.size * B.spacing * (0.3 + 0.7 * p));
  if (B.tool !== "brush" && B.tool !== "eraser") return [step0, 1];
  const width = B.size * (0.15 + 0.85 * Math.pow(clamp(p), B.sizeCurve)), rb = Math.max(0.8, ((2 * width) / Math.max(1, B.bristles)) * (B.spread ?? 0.8));
  const step = Math.max(0.5, Math.min(step0, rb * 0.7)); return [step, step / step0];
}
export function strokeTo(S, x, y, p = 0.6) {
  p = clamp(p); S.pts.push([+x.toFixed(2), +y.toFixed(2), +p.toFixed(3)]);
  if (!S.last) { S.last = { x, y, p }; return null; }
  const L = S.last, dx = x - L.x, dy = y - L.y, d = Math.hypot(dx, dy); if (d < 0.25) return null;
  // the brush turns smoothly through the segment (a sudden turn at each input point swings the outer
  // bristles and leaves a rung across the stroke)
  const seg = [dx / d, dy / d], from = S.pts.length === 2 ? seg : S.dir, to = S.pts.length === 2 ? seg : [S.dir[0] * 0.5 + seg[0] * 0.5, S.dir[1] * 0.5 + seg[1] * 0.5];
  let rect = null, t = S.carryT || 0;
  while (t <= d) {
    const f = t / d, pp = L.p + (p - L.p) * f, [step, k] = spacingAt(S.brush, pp); S.k = k;
    const u = [from[0] + (to[0] - from[0]) * f, from[1] + (to[1] - from[1]) * f], m = Math.hypot(u[0], u[1]) || 1; S.dir = [u[0] / m, u[1] / m];
    rect = union(rect, dabAt(S, L.x + dx * f, L.y + dy * f, pp)); t += step;
  }
  const m = Math.hypot(to[0], to[1]) || 1; S.dir = [to[0] / m, to[1] / m];
  S.carryT = t - d; S.last = { x, y, p }; return rect;
}
export function endStroke(S) {
  if (S.pts.length === 1) { const [x, y, p] = S.pts[0]; dabAt(S, x, y, p); }   // a tap leaves one dab
  const B = S.brush, on = idsAt(S.doc.ref?.G, S.pts, [S.doc.w, S.doc.h]), rec = { tool: B.tool, layer: S.layer.name, author: S.author, seed: S.seed, size: [S.doc.w, S.doc.h], ...(on ? { on } : {}),
    brush: { ...B, colour: B.colour.map((c) => +c.toFixed(4)) }, vis: S.vis, ...(S.groups ? { groups: S.groups } : {}), pts: S.pts };
  if (S.history) end(S.history, rec); else S.doc.strokes.push(rec);
  if (S.rect) composite(S.doc, grow(S.doc, S.rect, 2));
  return rec;
}

// Replay records onto doc. A record names its layer; a missing layer is made (author from the record).
// map(x, y) -> [x, y] | null moves a point (re-projection); a null point is dropped (no form there).
export function replay(doc, records, { history = null, map = null, onStroke = null, addLayer = null } = {}) {
  let n = 0; const shown = doc.layers.map((l) => [l, l.visible]), groups = structuredClone(doc.groups || {});
  for (const rec of records) {
    if (rec.op && rec.op !== "stroke") { replayOp(doc, rec, { history, map }); n++; if (onStroke) onStroke(n, rec); continue; }
    let L = doc.layers.find((l) => l.name === rec.layer);
    if (!L && addLayer) L = addLayer(rec.layer, rec.author);
    if (!L) throw new Error(`studio: replay: no layer "${rec.layer}"`);
    if (rec.vis) showAsRecorded(doc, rec.vis, rec.groups);
    const sx = doc.w / rec.size[0], sy = doc.h / rec.size[1], k = Math.sqrt(sx * sy);
    const S = beginStroke(doc, L, { ...rec.brush, size: rec.brush.size * k }, { history, author: rec.author, seed: rec.seed });
    for (const [x, y, p] of rec.pts) { const q = map ? map(x * sx, y * sy) : [x * sx, y * sy]; if (q) strokeTo(S, q[0], q[1], p); }
    endStroke(S);   // the new record is in this doc's frame (mapped and scaled), so it replays here as it stands
    n++; if (onStroke) onStroke(n, rec);
  }
  if (records.some((r) => r.vis)) { for (const [l, v] of shown) l.visible = v; doc.groups = groups; composite(doc); }
  return n;
}
// the log's other records: a region's blend, a liquify, a transform
function replayOp(doc, rec, { history }) {
  if (rec.op === "blend") { setBlend(doc, rec.region, rec.value, { history }); return; }
  if (rec.op === "liquify") { liquify(doc, rec, history); return; }
  if (rec.op === "transform") { transform(doc, rec, history); return; }
  throw new Error(`studio: replay: no operation "${rec.op}"`);
}
// the layers visible when the stroke was made (the wet surface it picked colour up from); a recompose only
// when that differs from now
function showAsRecorded(doc, vis, groups = null) {
  const want = new Set(vis); let changed = JSON.stringify(doc.groups || {}) !== JSON.stringify(groups || {});
  doc.groups = structuredClone(groups || {});
  for (const l of doc.layers) if (l.kind !== "mask") { const v = want.has(l.name); if (l.visible !== v) { l.visible = v; changed = true; } }
  if (changed) composite(doc);
}
