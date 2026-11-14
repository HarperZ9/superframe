// The sitter's limited palette: the lit colours of the figure gathered into a few mixes (k-means on a
// sample of the reference), plus the ground's two colours and a warm light and a cool shadow drawn from
// the sitter's own skin. A painter picks from these and mixes between two of them (pigment mixing);
// keeping to them is what makes a set of portraits look painted by one hand in one light.
//   sitterPalette(ref, { k }) -> [{ name, c: [r,g,b], v }]   mixSwatch(a, b, t)   valueOf(c)
import { mix as kmMix } from "../../../game/engine/paint/km.mjs";
import { lum } from "./passes.mjs";

const SKIN_IDS = new Set([4, 29, 39, 60]);
function kmeans(pts, k, rounds = 8) {
  pts.sort((a, b) => lum(...a) - lum(...b));
  const C = Array.from({ length: k }, (_, j) => [...pts[Math.floor(((j + 0.5) / k) * pts.length)]]);
  for (let it = 0; it < rounds; it++) {
    const S = C.map(() => [0, 0, 0, 0]);
    for (const p of pts) {
      let b = 0, bd = Infinity;
      for (let j = 0; j < k; j++) { const d = (p[0] - C[j][0]) ** 2 + (p[1] - C[j][1]) ** 2 + (p[2] - C[j][2]) ** 2; if (d < bd) { bd = d; b = j; } }
      S[b][0] += p[0]; S[b][1] += p[1]; S[b][2] += p[2]; S[b][3]++;
    }
    for (let j = 0; j < k; j++) if (S[j][3]) C[j] = [S[j][0] / S[j][3], S[j][1] / S[j][3], S[j][2] / S[j][3]];
  }
  return C;
}
const sw = (name, c) => ({ name, c: c.map((x) => +Math.min(1, Math.max(0, x)).toFixed(4)), v: +lum(...c).toFixed(3) });

export function sitterPalette(ref, { k = 7, ground = [[0.30, 0.31, 0.34], [0.12, 0.11, 0.13]] } = {}) {
  const { G, colour } = ref, fig = [], skin = [];
  for (let i = 0; i < G.w * G.h; i += 5) {
    if (!G.id[i]) continue; const c = [colour[i * 4], colour[i * 4 + 1], colour[i * 4 + 2]];
    fig.push(c); if (SKIN_IDS.has(G.id[i])) skin.push(c);
  }
  if (!fig.length) return [sw("ground light", ground[0]), sw("ground dark", ground[1])];
  const mixes = kmeans(fig, Math.min(k, fig.length)).map((c, j) => sw(`mix ${j + 1}`, c));
  const out = [...mixes, sw("ground light", ground[0]), sw("ground dark", ground[1])];
  if (skin.length) {
    skin.sort((a, b) => lum(...a) - lum(...b));
    const hi = skin[Math.floor(skin.length * 0.95)], lo = skin[Math.floor(skin.length * 0.1)];
    out.push(sw("skin light, warm", [hi[0] * 1.12 + 0.04, hi[1] * 1.05 + 0.03, hi[2] * 0.92]));
    out.push(sw("skin shadow, cool", kmMix(lo, [0.32, 0.34, 0.42], 0.35)));
    out.push(sw("skin turning, grey", kmMix(skin[Math.floor(skin.length / 2)], [0.45, 0.46, 0.5], 0.4)));
  }
  out.push(sw("catch-light", [0.96, 0.94, 0.9]), sw("darkest dark", [0.07, 0.045, 0.05]));
  return out;
}
export const mixSwatch = (a, b, t) => kmMix(a, b, t, [0, 0, 0]);
export const valueOf = (c) => lum(c[0], c[1], c[2]);
// the nearest palette colour to c (for the "keep to the palette" check)
export function nearest(pal, c) {
  let best = pal[0], bd = Infinity;
  for (const s of pal) { const d = (s.c[0] - c[0]) ** 2 + (s.c[1] - c[1]) ** 2 + (s.c[2] - c[2]) ** 2; if (d < bd) { bd = d; best = s; } }
  return { swatch: best, dist: Math.sqrt(bd) };
}
