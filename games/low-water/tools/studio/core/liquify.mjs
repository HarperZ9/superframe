// Liquify and transform: reshape what is painted, to fix proportion (a skull too round, a mouth too weak).
// Both work on every layer that exists when they are made, the locked underpainting and the masks included,
// so the picture moves as one; both are records in the painting's log and replay exactly.
// Liquify: a brush that moves pixels. push drags them along the stroke, pull the other way, pinch draws
// them toward the brush's centre, bloat pushes them out. Each dab is a backward warp, out(p) = in(p - v(p)),
// with v falling off smoothly to the brush's edge.
// Transform: a lasso polygon whose contents are moved, scaled and rotated about its centre and laid over
// the picture with a feathered edge (the picture under the old place stays; shrink with pinch instead).
//   liquify(doc, rec, history?)  transform(doc, rec, history?)  footprint(rec, w, h) -> Uint8Array
import { begin, touch, end } from "./history.mjs";
import { composite } from "./doc.mjs";

// falloff: "tight" (the default) for features; "broad" holds its strength further out, for reach, so one
// large brush moves a whole skull or jaw as a mass instead of denting its middle
const fall = (r2, R2, broad) => (r2 >= R2 ? 0 : broad ? Math.cos((Math.sqrt(r2 / R2) * Math.PI) / 2) : (1 - r2 / R2) ** 2);
function sample(src, w, h, x, y, ch, out) {   // bilinear, clamped at the edges
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(x))), y0 = Math.max(0, Math.min(h - 1, Math.floor(y))), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
  const fx = Math.max(0, Math.min(1, x - x0)), fy = Math.max(0, Math.min(1, y - y0));
  for (let k = 0; k < ch; k++) {
    const a = src[(y0 * w + x0) * ch + k], b = src[(y0 * w + x1) * ch + k], c = src[(y1 * w + x0) * ch + k], d = src[(y1 * w + x1) * ch + k];
    out[k] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
  return out;
}
// warp one layer inside rect: out(p) = in(map(p)) blended by weight(p) (map returns null to leave p);
// the source is copied only over src (where map can reach), not the whole canvas
function crop(a, w, ch, r) {
  const cw = r.x1 - r.x0, out = new Float32Array(cw * (r.y1 - r.y0) * ch);
  for (let y = r.y0; y < r.y1; y++) out.set(a.subarray((y * w + r.x0) * ch, (y * w + r.x1) * ch), (y - r.y0) * cw * ch);
  return out;
}
function warpLayer(L, w, h, rect, map, src) {
  const cw = src.x1 - src.x0, chh = src.y1 - src.y0, rgba = crop(L.rgba, w, 4, src), hgt = L.height ? crop(L.height, w, 1, src) : null, c4 = [0, 0, 0, 0], c1 = [0];
  for (let y = rect.y0; y < rect.y1; y++) for (let x = rect.x0; x < rect.x1; x++) {
    const m = map(x, y); if (!m) continue; const [qx, qy, wt] = m, i = y * w + x;
    sample(rgba, cw, chh, qx - src.x0, qy - src.y0, 4, c4); for (let k = 0; k < 4; k++) L.rgba[i * 4 + k] += (c4[k] - L.rgba[i * 4 + k]) * wt;
    if (hgt) { sample(hgt, cw, chh, qx - src.x0, qy - src.y0, 1, c1); L.height[i] += (c1[0] - L.height[i]) * wt; }
  }
}
const layersOf = (doc, rec) => doc.layers.filter((l) => rec.layers.includes(l.name));
const clampRect = (doc, x0, y0, x1, y1) => ({ x0: Math.max(0, Math.floor(x0)), y0: Math.max(0, Math.floor(y0)), x1: Math.min(doc.w, Math.ceil(x1)), y1: Math.min(doc.h, Math.ceil(y1)) });

function liquifyDab(doc, layers, mode, cx, cy, d, R, k, history, broad = false) {
  const rect = clampRect(doc, cx - R - 1, cy - R - 1, cx + R + 2, cy + R + 2), R2 = R * R; if (history) touch(history, rect);
  const map = (x, y) => {
    const dx = x - cx, dy = y - cy, f = fall(dx * dx + dy * dy, R2, broad); if (!f) return null;
    const v = mode === "push" ? [d[0] * k * f, d[1] * k * f] : mode === "pull" ? [-d[0] * k * f, -d[1] * k * f] : mode === "pinch" ? [-dx * k * f * 0.25, -dy * k * f * 0.25] : [dx * k * f * 0.25, dy * k * f * 0.25];
    return [x - v[0], y - v[1], 1];
  };
  const src = clampRect(doc, cx - 2 * R - 2, cy - 2 * R - 2, cx + 2 * R + 3, cy + 2 * R + 3);
  for (const L of layers) warpLayer(L, doc.w, doc.h, rect, map, src);
  return rect;
}
// a liquify record: { op: "liquify", mode, radius, strength, pts: [[x, y, p]], layers: [names], size: [w, h] }
// live: beginLiquify, liquifyTo per pointer move (returns the rect it changed), endLiquify -> the record
export function beginLiquify(doc, { mode = "push", radius = 40, strength = 0.8, reach = false } = {}, history = null) {
  const layers = [...doc.layers], rec = { op: "liquify", mode, radius, strength, ...(reach ? { reach: true } : {}), pts: [], layers: layers.map((l) => l.name), size: [doc.w, doc.h], author: "human" };
  if (!["push", "pull", "pinch", "bloat"].includes(mode)) throw new Error(`studio: no liquify mode "${mode}"`);
  if (history) begin(history, layers);
  return { doc, rec, layers, history, last: null };
}
export function liquifyTo(Q, x, y, p = 0.7) {
  const { doc, rec, layers, history } = Q, R = rec.radius, k = rec.strength * p; rec.pts.push([+x.toFixed(2), +y.toFixed(2), +p.toFixed(3)]);
  let rect = null; const add = (r) => (rect = rect ? { x0: Math.min(rect.x0, r.x0), y0: Math.min(rect.y0, r.y0), x1: Math.max(rect.x1, r.x1), y1: Math.max(rect.y1, r.y1) } : r);
  if (!Q.last) { if (rec.mode === "pinch" || rec.mode === "bloat") add(liquifyDab(doc, layers, rec.mode, x, y, [0, 0], R, k, history, rec.reach)); Q.last = [x, y]; return rect; }
  const dx = x - Q.last[0], dy = y - Q.last[1], steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (R * 0.25)));
  for (let j = 1; j <= steps; j++) add(liquifyDab(doc, layers, rec.mode, Q.last[0] + (dx * j) / steps, Q.last[1] + (dy * j) / steps, [dx / steps, dy / steps], R, k, history, rec.reach));
  Q.last = [x, y]; return rect;
}
export function endLiquify(Q) {
  if (Q.history) end(Q.history, Q.rec); else Q.doc.strokes.push(Q.rec);
  Q.doc.stale = true; composite(Q.doc); return Q.rec;
}
// replay: the record on the layers it named, scaled to this canvas
export function liquify(doc, rec, history = null) {
  const s = doc.w / rec.size[0], Q = beginLiquify(doc, { mode: rec.mode, radius: rec.radius * s, strength: rec.strength, reach: rec.reach }, history);
  Q.layers = doc.layers.filter((l) => rec.layers.includes(l.name)); Q.rec.layers = Q.layers.map((l) => l.name); if (rec.author) Q.rec.author = rec.author;
  if (history) begin(history, Q.layers);
  for (const [x, y, p] of rec.pts) liquifyTo(Q, x * s, y * s, p);
  return endLiquify(Q);
}

const centroid = (poly) => poly.reduce((a, [x, y]) => [a[0] + x / poly.length, a[1] + y / poly.length], [0, 0]);
function inside(poly, x, y) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }
function edgeDist(poly, x, y) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i], ex = bx - ax, ey = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey || 1)));
    best = Math.min(best, Math.hypot(x - ax - t * ex, y - ay - t * ey));
  }
  return best;
}
// a transform record: { op: "transform", poly: [[x, y]], dx, dy, scale, rot (degrees), feather, layers, size }
export function transform(doc, rec, history = null) {
  const s = doc.w / rec.size[0], poly = rec.poly.map(([x, y]) => [x * s, y * s]), [cx, cy] = centroid(poly), a = (-rec.rot * Math.PI) / 180, co = Math.cos(a), si = Math.sin(a);
  const tx = rec.dx * s, ty = rec.dy * s, sc = rec.scale || 1, F = Math.max(0.5, rec.feather * s), layers = layersOf(doc, rec);
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]), r = Math.max(Math.max(...xs) - cx, cx - Math.min(...xs), Math.max(...ys) - cy, cy - Math.min(...ys)) * sc * 1.5;
  const rect = clampRect(doc, cx + tx - r, cy + ty - r, cx + tx + r, cy + ty + r);
  if (history) { begin(history, layers); touch(history, rect); }
  const map = (x, y) => {
    const px = (x - cx - tx) / sc, py = (y - cy - ty) / sc, qx = cx + px * co - py * si, qy = cy + px * si + py * co;
    if (!inside(poly, qx, qy)) return null; return [qx, qy, Math.min(1, edgeDist(poly, qx, qy) / F)];
  };
  const src = clampRect(doc, Math.min(...xs) - 2, Math.min(...ys) - 2, Math.max(...xs) + 3, Math.max(...ys) + 3);
  for (const L of layers) warpLayer(L, doc.w, doc.h, rect, map, src);
  if (history) end(history, rec); else doc.strokes.push(rec);
  doc.stale = true; composite(doc); return rec;
}
// where an operation moved pixels (for re-projection's flags: the carried paint there was reshaped)
export function footprint(rec, w, h) {
  const m = new Uint8Array(w * h), s = w / rec.size[0];
  if (rec.op === "liquify") for (const [x, y] of rec.pts) { const R = rec.radius * s, cx = x * s, cy = y * s; for (let yy = Math.max(0, Math.floor(cy - R)); yy < Math.min(h, cy + R); yy++) for (let xx = Math.max(0, Math.floor(cx - R)); xx < Math.min(w, cx + R); xx++) if ((xx - cx) ** 2 + (yy - cy) ** 2 < R * R) m[yy * w + xx] = 1; }
  if (rec.op === "transform") { const poly = rec.poly.map(([x, y]) => [x * s, y * s]); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(poly, x, y)) m[y * w + x] = 1; }
  return m;
}
export const reshapes = (rec) => rec.op === "liquify" || rec.op === "transform";
