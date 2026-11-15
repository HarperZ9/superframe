// The plate camera's worker (ui/platecam.mjs): the heavy reads of a newly loaded plate, off the frame, by the
// same functions the camera would run itself (ui/platedata.mjs), so a move between places does not stall.
//   { type: "geo", id, name, pj, overhead } -> { id, pos, ids, arena, occ }   the geo buffers, the walking ground and the occlusion data
//   { type: "rgb", id, url, w, h }           -> { id, d, w, h }               the plate's colours at plate pixels
//   { type: "mix", id, base, v, names, w, lens } -> { id, img, lens }        the plate and its lens layers composed (ImageBitmaps)
//   { type: "planes", id, name, pj, overhead, step } -> { id, planes: [{ d0, d1, x0, y0, w, h, tiles: [{ x0, y0, w, h, img }] }] }   multiplane masks
import { camBasis } from "../world/plateworld.mjs";
import { occludeData, plateGround, mixInto, depthPlanes } from "./platedata.mjs";

async function geo({ name, pj, overhead }) {
  const [p, i] = await Promise.all([`/content/${name}/geo-pos.f32`, `/content/${name}/geo-id.u8`].map(async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.arrayBuffer(); }));
  const pos = new Float32Array(p), ids = new Uint8Array(i);
  let arena = null, warn = null;
  try { arena = plateGround(pj, pos, ids); } catch (e) { warn = e.message; }
  const occ = pj && pj.camera ? occludeData(pj, pos, arena, camBasis(pj.camera), overhead) : null;
  return { pos, ids, arena, occ, warn };
}
async function rgb({ url, w, h }) {
  const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const bm = await createImageBitmap(await r.blob()), c = new OffscreenCanvas(w, h), x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(bm, 0, 0, w, h); bm.close();
  return { d: x.getImageData(0, 0, w, h).data, w, h };
}
const bitmap = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return createImageBitmap(await r.blob()); };
async function mix({ base, v, names, w, lens, cpu = true }) {
  const [plate, ...rest] = await Promise.all([bitmap(`${base}${v}.png`), ...names.map((k) => bitmap(`${base}${v}-${k}.png`).catch(() => null))]);
  const L = { plate }; names.forEach((k, i) => { L[k === "ca" ? "ca" : k] = rest[i]; });
  const cv = new OffscreenCanvas(1, 1), lc = lens ? new OffscreenCanvas(1, 1) : null;
  if (cpu) { cv.getContext("2d", { willReadFrequently: true }); if (lc) lc.getContext("2d", { willReadFrequently: true }); }   // software canvases: no GPU work beside the page's (checked equal)
  mixInto(cv, L, w, lc);
  for (const b of [plate, ...rest]) if (b) b.close();
  return { img: cv.transferToImageBitmap(), lens: lc ? lc.transferToImageBitmap() : null };
}
async function planes({ name, pj, overhead, step }) {
  const g = await geo({ name, pj, overhead });
  const P = depthPlanes(pj, g.pos, g.arena, g.occ, step), T = 128;
  // each band in tiles of T plate pixels, the empty ones dropped: less to hold and to draw
  return Promise.all(P.map(async (p) => {
    const tiles = [];
    for (let ty = 0; ty < p.h; ty += T) for (let tx = 0; tx < p.w; tx += T) {
      const w = Math.min(T, p.w - tx), h = Math.min(T, p.h - ty); let any = false;
      for (let y = 0; y < h && !any; y++) for (let x = 0; x < w; x++) if (p.data[((ty + y) * p.w + tx + x) * 4 + 3]) { any = true; break; }
      if (!any) continue;
      const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) d.set(p.data.subarray(((ty + y) * p.w + tx) * 4, ((ty + y) * p.w + tx + w) * 4), y * w * 4);
      tiles.push({ x0: p.x0 + tx, y0: p.y0 + ty, w, h, img: await createImageBitmap(new ImageData(d, w, h)) });
    }
    return { d0: p.d0, d1: p.d1, x0: p.x0, y0: p.y0, w: p.w, h: p.h, tiles };
  }));
}
self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === "geo") { const g = await geo(m); self.postMessage({ id: m.id, ...g }, [g.pos.buffer, g.ids.buffer, ...(g.occ ? [g.occ.D.buffer, g.occ.up.buffer] : [])]); }
    else if (m.type === "mix") { const x = await mix(m); self.postMessage({ id: m.id, ...x }, [x.img, ...(x.lens ? [x.lens] : [])]); }
    else if (m.type === "planes") { const P = await planes(m); self.postMessage({ id: m.id, planes: P }, P.flatMap((p) => p.tiles.map((t) => t.img))); }
    else if (m.type === "rgb") { const c = await rgb(m); self.postMessage({ id: m.id, ...c }, [c.d.buffer]); }
  } catch (err) { self.postMessage({ id: m.id, error: err.message }); }
};
