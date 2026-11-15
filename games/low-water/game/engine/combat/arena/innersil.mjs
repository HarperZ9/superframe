// Each form's silhouette alone, at game scale, for the grey test (combat/tools/silhouette.mjs reads them from the
// inner capture's summary): every body that wears a form is drawn by itself on a clear layer and its covered pixels
// kept as a box and a run-length code (alternating runs of empty and covered pixels, row by row inside the box).
//   silhouettes(V) -> [{ id, form, look, box: [x, y, w, h], rle }]
import { drawForm } from "./forms.mjs";
import { poseOf } from "../anim/drive.mjs";

const IW = 640, IH = 360;
export function silhouettes(V) {
  const W = V.W, c = (V.silC ||= new OffscreenCanvas(IW, IH)), g = c.getContext("2d", { willReadFrequently: true }), out = [];
  const keep = { tips: V.tips, features: V.features, overlays: V.overlays };
  for (const F of W.fighters) {
    const d = W.defs[F.id]; if (!d.form || F.out || F.fallen) continue;
    g.clearRect(0, 0, IW, IH); V.features = []; V.overlays = []; drawForm(g, V, F, poseOf(W, F), 0.5); for (const o of V.overlays) o(g);
    const a = g.getImageData(0, 0, IW, IH).data; let x0 = IW, y0 = IH, x1 = -1, y1 = -1;
    for (let p = 0; p < IW * IH; p++) if (a[p * 4 + 3] > 128) { const x = p % IW, y = (p / IW) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) continue;
    const runs = []; let cur = 0, n = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const on = a[(y * IW + x) * 4 + 3] > 128 ? 1 : 0; if (on === cur) n++; else { runs.push(n); cur = on; n = 1; } }
    runs.push(n);
    out.push({ id: F.id, form: d.form, look: (W.inner && W.inner.look) || null, box: [x0, y0, x1 - x0 + 1, y1 - y0 + 1], rle: runs.join(",") });
  }
  V.tips = keep.tips; V.features = keep.features; V.overlays = keep.overlays;
  return out;
}
