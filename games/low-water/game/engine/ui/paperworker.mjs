// The aged pages made off the frame (the UI art lead's, 2026-10-21): ui/aged.mjs posts a page's
// parameters, this makes its pixels (ui/paper.mjs, the same function) and sends them back.
import { paperPixels } from "./paper.mjs";
self.onmessage = (e) => {
  const { id, opts } = e.data;
  try { const P = paperPixels(opts); self.postMessage({ id, w: P.w, h: P.h, data: P.data }, [P.data.buffer]); }
  catch (err) { self.postMessage({ id, error: String(err && err.message || err) }); }
};
