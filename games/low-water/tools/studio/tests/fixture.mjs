// Shared fixtures for the Studio's tests: a small canvas with a grey underpainting and a paint layer,
// a memory sink, and pixel helpers. No cast render, so the core tests run in well under a second.
import { createDoc, addLayer, composite } from "../core/doc.mjs";
import { createHistory } from "../core/history.mjs";

export function smallDoc(w = 96, h = 64, grey = 0.5) {
  const doc = createDoc(w, h, { who: "test", person: "test", era: 2, keyDir: [-0.6, 0.3, 0.74], cam: {}, key: {}, seed: 1 });
  const fill = new Float32Array(w * h * 4); for (let i = 0; i < w * h; i++) { fill[i * 4] = fill[i * 4 + 1] = fill[i * 4 + 2] = grey; fill[i * 4 + 3] = 1; }
  addLayer(doc, { name: "underpainting", author: "procedural", locked: true, fill });
  const paint = addLayer(doc, { name: "paint", author: "human" });
  composite(doc);
  return { doc, paint, history: createHistory(doc) };
}
export const px = (L, w, x, y) => Array.from(L.rgba.subarray((y * w + x) * 4, (y * w + x) * 4 + 4));
export const alphaAt = (L, w, x, y) => L.rgba[(y * w + x) * 4 + 3];
export const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
export function memSink() {
  const files = new Map();
  return {
    files,
    async image(p, w, h, data) { files.set(p, { width: w, height: h, data: Uint8ClampedArray.from(data) }); },
    async json(p, obj) { files.set(p, JSON.parse(JSON.stringify(obj))); },
    async text(p, str) { files.set(p, String(str)); },
    async readText(p) { if (!files.has(p)) throw new Error(`no ${p}`); return files.get(p); },
    async readJson(p) { if (!files.has(p)) throw new Error(`no ${p}`); return files.get(p); },
    async readImage(p) { if (!files.has(p)) throw new Error(`no ${p}`); return files.get(p); },
  };
}
// a straight stroke from (x0, y0) to (x1, y1) in n steps at pressure p
export function line(x0, y0, x1, y1, n = 20, p = 0.7) { const out = []; for (let k = 0; k <= n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, p]); return out; }
