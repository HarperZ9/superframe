// The light layer's per-plate fields (paint/lightlayer.mjs prepare) made off the frame: the ground's normals,
// the wet mask and the lamps' reflections in the wet ground, by the same functions (paint/lightfield.mjs), so
// a move between places does not stall on them (design/state/perf.md). The canvases come back as ImageBitmaps.
//   { id, place, pj, rain, lights, lantern?: { at, opts } } -> { id, normals, wet: { k, rough, lowY, highY, canvas }, glints: { canvas, x0, y0 } | null, pool? }
// lantern: the carried light where it stands as the place loads, its pool made here too (the same poolField)
import { wetMask, glossLobe, groundNormals, poolField } from "./lightfield.mjs";
// this worker's 2D canvases in software (lightfield.mjs only puts pixels into them): no GPU work beside the
// page's while a place loads (the same pixels: checked against the main thread's)
const getCtx = OffscreenCanvas.prototype.getContext;
OffscreenCanvas.prototype.getContext = function (type, opts) { return getCtx.call(this, type, type === "2d" ? { willReadFrequently: true, ...(opts || {}) } : opts); };
const geos = new Map();   // place -> { pos, ids }
async function geoOf(place) {
  if (!geos.has(place)) geos.set(place, (async () => {
    const [p, i] = await Promise.all([`/content/${place}/geo-pos.f32`, `/content/${place}/geo-id.u8`].map(async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.arrayBuffer(); }));
    return { pos: new Float32Array(p), ids: new Uint8Array(i) };
  })());
  return geos.get(place);
}
self.onmessage = async (e) => {
  const m = e.data;
  try {
    const geo = await geoOf(m.place), normals = groundNormals(m.pj, geo.pos), wet = wetMask(m.pj, geo.pos, geo.ids, normals, { rain: m.rain }), glints = glossLobe(m.pj, geo.pos, normals, wet, m.lights);
    const pf = m.lantern ? poolField(m.pj, geo.pos, normals, wet, m.lantern.at, m.lantern.opts) : null;
    const pool = pf ? { x0: pf.x0, y0: pf.y0, pool: pf.pool.transferToImageBitmap(), glint: pf.glint ? pf.glint.transferToImageBitmap() : null } : null;
    const wb = wet.canvas.transferToImageBitmap(), gb = glints && glints.canvas ? glints.canvas.transferToImageBitmap() : null;
    self.postMessage({ id: m.id, normals, wet: { ...wet, canvas: wb }, glints: glints ? { ...glints, canvas: gb } : null, pool }, [normals.buffer, wet.k.buffer, wet.rough.buffer, wb, ...(gb ? [gb] : []), ...(pool ? [pool.pool, ...(pool.glint ? [pool.glint] : [])] : [])]);
  } catch (err) { self.postMessage({ id: m.id, error: err.message }); }
};
