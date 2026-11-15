// Where a stroke was laid, in the sitter's own terms: the material under its first, middle and last point
// (recorded with the stroke). When the head changes under a painting, the rebuild replays every stroke on
// the re-baked reference and flags the ones that now land on another material (an eye stroke on a brow, a
// skin stroke off the edge of a narrower face): those are the strokes the replay could not place.
//   idsAt(G, pts, size) -> [id, id, id]    unplaced(records, ref, w, h) -> { count, strokes, mask: Uint8Array }
const pick = (pts) => (pts.length ? [pts[0], pts[pts.length >> 1], pts[pts.length - 1]] : []);
export function idsAt(G, pts, size) {
  if (!G || !pts?.length) return null; const sx = G.w / size[0], sy = G.h / size[1];
  return pick(pts).map(([x, y]) => G.id[Math.max(0, Math.min(G.h - 1, Math.round(y * sy))) * G.w + Math.max(0, Math.min(G.w - 1, Math.round(x * sx)))]);
}
export function unplaced(records, ref, w, h) {
  const mask = new Uint8Array(w * h), bad = [];
  for (const r of records) {
    if (!r.on || !r.pts || (r.op && r.op !== "stroke")) continue;
    const now = idsAt(ref.G, r.pts, r.size); if (now.every((id, k) => id === r.on[k])) continue;
    bad.push(r); const sx = w / r.size[0], sy = h / r.size[1], R = Math.ceil((r.brush?.size || 8) * Math.sqrt(sx * sy));
    for (const [x, y] of r.pts) { const cx = Math.round(x * sx), cy = Math.round(y * sy); for (let yy = Math.max(0, cy - R); yy < Math.min(h, cy + R); yy++) for (let xx = Math.max(0, cx - R); xx < Math.min(w, cx + R); xx++) mask[yy * w + xx] = 1; }
  }
  return { count: bad.length, strokes: bad, mask };
}
