// A plate's painting read to linear luminance off the main thread (runtime/platectx.mjs): the image decoded,
// drawn at the geo buffer's size and read back here, so a move to a new plate does not stall the frame on
// a GPU readback (perf/PROGRESS.md 19).
//   { url, gw, gh, id } -> { id, L: Float32Array } | { id, error }
import { validOf } from "./platectx.mjs";
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const LIN = Float32Array.from({ length: 256 }, (_, i) => lin(i));
export async function lumaFrom(blob, gw, gh) {
  const bm = await createImageBitmap(blob), c = new OffscreenCanvas(gw, gh), g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(bm, 0, 0, gw, gh); bm.close();
  const d = g.getImageData(0, 0, gw, gh).data, L = new Float32Array(gw * gh);
  for (let i = 0; i < L.length; i++) L[i] = 0.2126 * LIN[d[i * 4]] + 0.7152 * LIN[d[i * 4 + 1]] + 0.0722 * LIN[d[i * 4 + 2]];
  return L;
}
if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
  self.onmessage = async (e) => {
    const { url, gw, gh, id } = e.data;
    if (e.data.type === "geo") {   // the geo buffer and each cell's validity (platectx.mjs validOf)
      try { const r = await fetch(url); if (!r.ok) throw new Error(`${url} ${r.status}`); const pos = new Float32Array(await r.arrayBuffer()), valid = validOf(pos, e.data.n); self.postMessage({ id, pos, valid }, [pos.buffer, valid.buffer]); }
      catch (err) { self.postMessage({ id, error: err.message }); }
      return;
    }
    try { const r = await fetch(url); if (!r.ok) throw new Error(`${url} ${r.status}`); const L = await lumaFrom(await r.blob(), gw, gh); self.postMessage({ id, L }, [L.buffer]); }
    catch (err) { self.postMessage({ id, error: err.message }); }
  };
}
