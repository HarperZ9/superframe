// What a scripted paint-over needs to know about a reference: where each feature is (eyes, brows, the
// mouth, the face, the coat, the collar), how each pixel turns to the key (N.L), and the masks.
//   landmarks(ref) -> { w, h, ndl, mask(ids), box(ids), eyes: [{ cx, cy, rx, ry }], mouth, face, coat }
import { keyDir } from "../core/sitter.mjs";

import { IDS } from "../core/ids.mjs";
export { IDS };

export function landmarks(ref) {
  const { G } = ref, { w, h } = G, n = w * h, L = keyDir(ref.meta.key), ndl = new Float32Array(n);
  for (let i = 0; i < n; i++) if (G.id[i]) ndl[i] = G.N[i * 3] * L[0] + G.N[i * 3 + 1] * L[1] + G.N[i * 3 + 2] * L[2];
  const mask = (ids) => { const s = new Set(ids), m = new Uint8Array(n); for (let i = 0; i < n; i++) if (s.has(G.id[i])) m[i] = 1; return m; };
  const box = (ids) => {
    const s = new Set(ids); let x0 = w, y0 = h, x1 = -1, y1 = -1, cx = 0, cy = 0, k = 0;
    for (let i = 0; i < n; i++) if (s.has(G.id[i])) { const x = i % w, y = (i / w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); cx += x; cy += y; k++; }
    return k ? { x0, y0, x1, y1, cx: cx / k, cy: cy / k, n: k } : null;
  };
  const eyes = ref.anchors?.length ? ref.anchors.filter((e) => !e.hidden) : eyeBoxes(G), mouth = box(IDS.lip), face = box(IDS.skin);
  return { w, h, ndl, mask, box, eyes, mouth, mouthLine: ref.mouthLine || null, face, nose: noseTip(G, eyes, ref.mouthLine?.y ?? mouth?.cy, face), brow: box(IDS.brow), coat: box(IDS.coat), collar: box(IDS.collar), key: L };
}

// the nose's tip: the skin nearest the eye between the eyes' row and the mouth, and its size (how far the
// skin stays within a little depth of the tip)
function noseTip(G, eyes, mouthY, face) {
  if (!eyes?.length || !face || mouthY == null) return null;
  const ey = eyes.reduce((a, e) => a + e.cy, 0) / eyes.length, skin = new Set(IDS.skin); let best = -1, bd = Infinity;
  for (let y = Math.round(ey); y < Math.round(mouthY); y++) for (let x = face.x0; x <= face.x1; x++) { const i = y * G.w + x; if (skin.has(G.id[i]) && G.depth[i] < bd) { bd = G.depth[i]; best = i; } }
  if (best < 0) return null;
  const cx = best % G.w, cy = (best / G.w) | 0; let r = 2;
  while (r < (face.x1 - face.x0) / 2) { const i = cy * G.w + Math.max(0, cx - r), j = cy * G.w + Math.min(G.w - 1, cx + r); if (G.depth[i] - bd > 0.012 && G.depth[j] - bd > 0.012) break; r++; }
  return { x: cx, y: cy, r };
}
// each eye: iris and white pixels ([x, y, id] on the full canvas) split by a 2-means on x; centre, half sizes, iris
function eyeBoxesFrom(px, w) {
  const xs = px.map((p) => p[0]); let a = Math.min(...xs), b = Math.max(...xs);
  for (let it = 0; it < 10; it++) { let sa = 0, na = 0, sb = 0, nb = 0; for (const x of xs) if (Math.abs(x - a) <= Math.abs(x - b)) { sa += x; na++; } else { sb += x; nb++; } a = na ? sa / na : a; b = nb ? sb / nb : b; }
  const groups = Math.abs(b - a) < w * 0.03 ? [px] : [px.filter((p) => Math.abs(p[0] - a) <= Math.abs(p[0] - b)), px.filter((p) => Math.abs(p[0] - a) > Math.abs(p[0] - b))];
  return groups.filter((g) => g.length >= 4).map((g) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, ix = 0, iy = 0, ik = 0;
    for (const [x, y, id] of g) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); if (id === 15) { ix += x; iy += y; ik++; } }
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: Math.max(3, (x1 - x0) / 2), ry: Math.max(2, (y1 - y0) / 2), iris: ik ? [ix / ik, iy / ik] : [(x0 + x1) / 2, (y0 + y1) / 2], n: g.length };
  }).sort((p, q) => p.cx - q.cx);
}
// each eye from the reference itself (when the lids leave the eyes in view)
function eyeBoxes(G) {
  const px = []; for (let i = 0; i < G.w * G.h; i++) if (G.id[i] === 15 || G.id[i] === 28) px.push([i % G.w, (i / G.w) | 0, G.id[i]]);
  return px.length < 8 ? [] : eyeBoxesFrom(px, G.w);
}
