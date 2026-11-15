// Undo and redo. A stroke saves only the tiles it touches (64 px, copy on first touch), before it changes
// them; undo swaps those tiles back and keeps the swapped-out pixels for redo. An operation that changes
// several layers at once (a liquify, a transform) begins with all of them and saves tiles for each.
// Layer changes (add, remove, reorder, opacity) save the list itself; other changes (a region's blend)
// carry their own undo and redo. The record goes with its entry, so undo also drops it from the log
// that replays the painting, and redo puts it back.
//   const H = createHistory(doc)  begin(H, layer | [layers])  touch(H, rect)  end(H, record)
//   structural(H, label, fn)  pushOp(H, record, undoFn, redoFn)  undo(H) redo(H) -> the entry, or null
export function createHistory(doc, { tile = 64, limit = 80 } = {}) {
  return { doc, tile, limit, done: [], undone: [], cur: null };
}
export function begin(H, layers) { H.cur = { type: "stroke", layers: Array.isArray(layers) ? layers : [layers], tiles: new Map() }; }

function tileCopy(L, w, h, tx, ty, T) {
  const x0 = tx * T, y0 = ty * T, x1 = Math.min(w, x0 + T), y1 = Math.min(h, y0 + T), cw = x1 - x0, rgba = new Float32Array(cw * (y1 - y0) * 4), hgt = L.height ? new Float32Array(cw * (y1 - y0)) : null;
  for (let y = y0; y < y1; y++) {
    rgba.set(L.rgba.subarray((y * w + x0) * 4, (y * w + x1) * 4), (y - y0) * cw * 4);
    if (hgt) hgt.set(L.height.subarray(y * w + x0, y * w + x1), (y - y0) * cw);
  }
  return { x0, y0, x1, y1, rgba, hgt };
}
function tilePut(L, w, t) {
  const cw = t.x1 - t.x0;
  for (let y = t.y0; y < t.y1; y++) {
    L.rgba.set(t.rgba.subarray((y - t.y0) * cw * 4, (y - t.y0 + 1) * cw * 4), (y * w + t.x0) * 4);
    if (t.hgt) L.height.set(t.hgt.subarray((y - t.y0) * cw, (y - t.y0 + 1) * cw), y * w + t.x0);
  }
}
// called before anything writes inside rect, for every layer the entry began with
export function touch(H, rect) {
  const c = H.cur; if (!c) return; const { w, h } = H.doc, T = H.tile;
  for (let ty = Math.max(0, Math.floor(rect.y0 / T)); ty <= Math.min(Math.ceil(h / T) - 1, Math.floor((rect.y1 - 1) / T)); ty++)
    for (let tx = Math.max(0, Math.floor(rect.x0 / T)); tx <= Math.min(Math.ceil(w / T) - 1, Math.floor((rect.x1 - 1) / T)); tx++)
      c.layers.forEach((L, li) => { const k = `${li}:${ty}:${tx}`; if (!c.tiles.has(k)) c.tiles.set(k, { L, t: tileCopy(L, w, h, tx, ty, T) }); });
}
export function end(H, record = null) {
  const c = H.cur; H.cur = null; if (!c || !c.tiles.size) return null;
  const e = { type: "stroke", tiles: [...c.tiles.values()], stroke: record };
  if (record) H.doc.strokes.push(record);
  push(H, e); return e;
}
export function structural(H, label, fn) {
  const before = [...H.doc.layers], activeBefore = H.doc.active, props = snapshotProps(before); fn();
  push(H, { type: "struct", label, before, after: [...H.doc.layers], activeBefore, activeAfter: H.doc.active, props });
}
export function pushOp(H, record, undoFn, redoFn) { if (record) H.doc.strokes.push(record); push(H, { type: "op", stroke: record, undo: undoFn, redo: redoFn }); }
const snapshotProps = (layers) => layers.map((l) => ({ l, opacity: l.opacity, visible: l.visible, name: l.name }));
function push(H, e) { H.done.push(e); if (H.done.length > H.limit) H.done.shift(); H.undone.length = 0; }

function swapTiles(H, e) {
  e.tiles = e.tiles.map(({ L, t }) => { const cur = tileCopy(L, H.doc.w, H.doc.h, t.x0 / H.tile, t.y0 / H.tile, H.tile); tilePut(L, H.doc.w, t); return { L, t: cur }; });
}
const dropRecord = (H, r) => { if (r) H.doc.strokes.splice(H.doc.strokes.lastIndexOf(r), 1); };
export function undo(H) {
  const e = H.done.pop(); if (!e) return null;
  if (e.type === "stroke") { swapTiles(H, e); if (e.after) e.after.undo(); dropRecord(H, e.stroke); }
  else if (e.type === "op") { e.undo(); dropRecord(H, e.stroke); }
  else { e.propsAfter = snapshotProps(e.after); H.doc.layers = [...e.before]; H.doc.active = e.activeBefore; for (const p of e.props) Object.assign(p.l, { opacity: p.opacity, visible: p.visible, name: p.name }); }
  H.doc.stale = true; H.undone.push(e); return e;
}
export function redo(H) {
  const e = H.undone.pop(); if (!e) return null;
  if (e.type === "stroke") { swapTiles(H, e); if (e.after) e.after.redo(); if (e.stroke) H.doc.strokes.push(e.stroke); }
  else if (e.type === "op") { e.redo(); if (e.stroke) H.doc.strokes.push(e.stroke); }
  else { H.doc.layers = [...e.after]; H.doc.active = e.activeAfter; for (const p of e.propsAfter || []) Object.assign(p.l, { opacity: p.opacity, visible: p.visible, name: p.name }); }
  H.doc.stale = true; H.done.push(e); return e;
}
