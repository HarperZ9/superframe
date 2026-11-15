// The portrait painter (the author, 2026-10-21: conversation in painted dialogue boxes with painted portraits).
// Second pass, after the first sheet read as painted puppets (blank eyes, a dominant neck, cloth smeared into
// flat blobs, skin one waxy ramp). The painter is fed a study (study.mjs: one light with a real shadow side,
// skin in warm and cool zones, cloth folds, a counterchanged ground) and paints it coarse to fine on a toned
// canvas (brush.mjs: curved strokes along the form, each finer layer only where the canvas is still wrong),
// then the eyes (eyes.mjs), the highlights laid thick, and the paint's own relief lit by the key.
// Form maps (curvature, cavity) come from the G-buffer for any head, and from the sculptor's per-vertex maps
// where the head carries them (G.mc, rasterised by sit.mjs). Original code; deterministic by seed.
//   paintPortrait({ G, A, face, seed, opts }) -> Float32Array rgba
import { study, ground, isSkin, isEye, isHair } from "./study.mjs";
import { layer, contourField, blurK, rnd, relief } from "./brush.mjs";
import { findEyes, openEyes, paintEyes } from "./eyes.mjs";
import { MATS_PORTRAIT } from "./mats.mjs";
import { paintMouth } from "./mouth.mjs";

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const IRISES = [[0.3, 0.2, 0.12], [0.22, 0.15, 0.1], [0.34, 0.3, 0.16], [0.28, 0.33, 0.38], [0.3, 0.33, 0.28]];

// curvature (convex positive) from the divergence of the screen-space normal; cavity from how far the depth
// round a pixel stands nearer the eye than the pixel itself; the sculptor's maps where the head has them
export function formMaps(G) {
  const { w, h } = G, n = w * h, curv = new Float32Array(n), cav = new Float32Array(n), mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = G.id[i] ? 1 : 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (!mask[i]) continue;
    const r = mask[i + 1] ? i + 1 : i, l = mask[i - 1] ? i - 1 : i, d = mask[i + w] ? i + w : i, u = mask[i - w] ? i - w : i;
    curv[i] = (G.N[r * 3] - G.N[l * 3]) - (G.N[d * 3 + 1] - G.N[u * 3 + 1]);
  }
  const D = new Float32Array(n); let dmin = Infinity; for (let i = 0; i < n; i++) if (mask[i]) dmin = Math.min(dmin, G.depth[i]);
  for (let i = 0; i < n; i++) D[i] = mask[i] ? G.depth[i] : dmin + 0.3;
  const Dm = blurK(D, w, h, 1, Math.max(3, Math.round(w / 90)), 2);
  for (let i = 0; i < n; i++) if (mask[i]) cav[i] = clamp((D[i] - Dm[i]) * 60);
  const C = blurK(curv, w, h, 1, 2, 2), V = blurK(cav, w, h, 1, 1, 1);
  if (G.mc) for (let i = 0; i < n; i++) if (mask[i] && MATS_PORTRAIT.face.has(G.id[i]) && G.mc[i * 3] > 0) { C[i] = 0.5 * C[i] + 0.5 * (G.mc[i * 3] - 0.5) * 2; V[i] = Math.max(V[i], G.mc[i * 3 + 1] * 0.8); }
  return { curv: C, cav: V, mask };
}

export function paintPortrait({ G, A, face, seed = 7, opts = {} }) {
  const o = { key: { dir: [-0.6, 0.35, 0.72], c: [1.0, 0.84, 0.64] }, keyScreen: [-0.62, -0.55], tone: [0.3, 0.24, 0.19], layers: [[26, 0.0, 0.6, 12], [14, 0.09, 0.3, 10], [7, 0.13, 0.2, 8], [3.5, 0.18, 0.13, 5]], gaze: [0, 0], ...opts };
  const { w, h } = G, n = w * h, rand = rnd(seed), scale = h / 800, M = formMaps(G), B = brushMood(o.dir);
  const S = study({ G, A, face, maps: M, key: o.key, opts: o.study });
  const gr = ground({ G, face, mask: M.mask, keySide: Math.sign(o.keyScreen[0]) || -1, colours: o.groundColours });
  // the reference: the study over the ground; where figure and ground meet in value the edge is lost (softened)
  const ref = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) ref[i * 3 + c] = M.mask[i] ? S.rgb[i * 3 + c] : gr[i * 3 + c];
  const soft = blurK(ref, w, h, 3, Math.max(2, Math.round(3 * scale)), 2), edge = blurK(Float32Array.from(M.mask), w, h, 1, 2, 1);
  for (let i = 0; i < n; i++) {
    if (edge[i] <= 0.02 || edge[i] >= 0.98) continue;
    const lf = 0.3 * S.rgb[i * 3] + 0.59 * S.rgb[i * 3 + 1] + 0.11 * S.rgb[i * 3 + 2], lg = 0.3 * gr[i * 3] + 0.59 * gr[i * 3 + 1] + 0.11 * gr[i * 3 + 2];
    const lose = M.mask[i] && isSkin(G.id[i]) ? 0 : clamp(1 - Math.abs(lf - lg) / 0.12);
    for (let c = 0; c < 3; c++) ref[i * 3 + c] += (soft[i * 3 + c] - ref[i * 3 + c]) * lose;
  }
  // the toned canvas (a warm imprimatura shows between the strokes)
  const canvas = new Float32Array(n * 3), height = new Float32Array(n);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) canvas[i * 3 + c] = o.tone[c] * (0.92 + 0.16 * rand());
  // where the finest layers may go: the face and hair and the hands (detail lives where the eye goes)
  const fine = new Uint8Array(n); for (let i = 0; i < n; i++) { const id = G.id[i]; fine[i] = id && (MATS_PORTRAIT.face.has(id) || isEye(id) || isHair(id)) ? 1 : 0; }
  const fineD = blurK(Float32Array.from(fine), w, h, 1, Math.round(4 * scale), 1); for (let i = 0; i < n; i++) fine[i] = fineD[i] > 0.05 ? 1 : 0;
  const counts = [];
  o.layers.forEach(([R0, T, clip, maxLen], k) => {
    const R = Math.max(1.2, R0 * scale), refK = blurK(ref, w, h, 3, Math.max(0, Math.round(R * 0.5)), 2), field = contourField(refK, w, h, Math.max(2, Math.round(R * 0.8)));
    counts.push(layer(canvas, refK, { w, h, R, T, maxLen: maxLen * B.len, minLen: k === 0 ? 3 : 2, field, rand, clip: clip * B.clip, alpha: k === 0 ? 1 : 0.92, only: k >= 2 ? fine : null, height, fallback: [0.78, -0.62], jitter: (k < 2 ? 0.08 : 0.045) * B.jitter, bristle: B.bristle }));
  });
  // highlights laid thick: short light strokes where lit skin turns convex toward the lamp
  const hiRef = canvas.slice(); let nh = 0;
  for (let i = 0; i < n; i++) if (G.id[i] && isSkin(G.id[i]) && S.light[i] > 0.9 && M.curv[i] > 0.1) { nh++; for (let c = 0; c < 3; c++) hiRef[i * 3 + c] = Math.min(1, S.rgb[i * 3 + c] * 1.22 + 0.05); }
  if (nh) layer(canvas, hiRef, { w, h, R: Math.max(1.2, 2.2 * scale), T: 0.05, maxLen: 3, minLen: 1, field: contourField(hiRef, w, h, 3), rand, clip: 0.12, alpha: 0.85, height, fallback: [0.78, -0.62] });
  // the eyes
  const eyes = openEyes(findEyes(G), { turn: face.turn ?? -1, lids: o.cue?.lids ?? 0, w, h });
  paintEyes(canvas, eyes, { w, h, study: S.rgb, irisColour: o.iris || IRISES[seed % IRISES.length], gaze: o.gaze, key: o.keyScreen });
  const mouth = paintMouth(canvas, G, { w, h, corners: o.cue?.corners || 0, study: S.rgb, paint: !!o.cue });
  relief(canvas, height, w, h, o.keyScreen, 0.6 * B.relief);
  const out = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { out[i * 4] = canvas[i * 3]; out[i * 4 + 1] = canvas[i * 3 + 1]; out[i * 4 + 2] = canvas[i * 3 + 2]; out[i * 4 + 3] = 1; }
  out.info = { strokes: counts, eyes: eyes.map((e) => ({ cx: Math.round(e.cx), cy: Math.round(e.cy), wd: e.wd, ht: e.ht, opened: !!e.opened })), mouth: mouth ? { x0: mouth.x0, x1: mouth.x1, y: Math.round(mouth.y) } : null };
  out.study = S.rgb; out.ref = ref;
  return out;
}

// The mood in the brushwork (design/art/PAINT-LANGUAGE.md): a lie paints tighter and harder, grief looser and
// more broken, anger heavier. dir: the voice bible's direction ({ emo, int, lie }).
export function brushMood(dir = {}) {
  const B = { len: 1, clip: 1, jitter: 1, bristle: 1, relief: 1 };
  if (dir.lie) Object.assign(B, { len: 0.65, clip: 0.75, jitter: 0.4, bristle: 0.5 });
  else if (dir.emo === "grieving" || dir.emo === "tired") Object.assign(B, { len: 1.35, clip: 1.3, jitter: 1.6, bristle: 1.6, relief: 0.7 });
  else if (dir.emo === "angry" || dir.emo === "contempt") Object.assign(B, { len: 0.9, jitter: 1.2, relief: 1.6 });
  else if (dir.emo === "afraid" || dir.emo === "anxious") Object.assign(B, { len: 0.8, jitter: 1.4 });
  return B;
}
