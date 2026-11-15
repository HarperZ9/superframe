// The last four inner bosses' forms (combat/arena/forms.mjs has the rules they follow): Fond of Them's bowing coat
// under the good hat, Under the Goats' glowing hoard and its sacks, The Long Barn's roof ribs and chute, The Figure
// stitched from sacking and twine. Placeholder forms until the character lead's production forms exist, drawn for their
// silhouettes at game scale. No Hesh person, child or perpetrator is drawn; Ilo is a voice only.
import { gray, hash } from "./innerstage.mjs";
import { feat, tip, limb, poly, oval } from "./forms.mjs";

// Fond of Them: a coat bowing from the waist under a broad hat; the strings run up from the character into the brim;
// in the offer the coat sits and the hat floats free toward him
function hatcoat(P) {
  const { g, V, F, I, bx, by, H, w, ink, s, light } = P, offer = I.look === "offer", strings = I.look === "strings", bow = strings ? 1.6 : 0.35 + 0.15 * Math.sin(V.t * 0.06);
  const h = offer ? H * 0.62 : strings ? H * 0.68 : H, top = [bx + s * w * bow * (offer ? 0 : 1.6), by - h * 0.9];
  poly(g, [[bx - w * 1.1, by], [bx + w * 1.1, by], [top[0] + w * 0.55, top[1] + 6], [top[0] - w * 0.55, top[1] + 6]], ink);
  const hat = offer ? [bx + s * w * 2.2, by - H * 1.05] : [top[0], top[1] - 4];
  oval(g, hat[0], hat[1] + 3, w * 1.25, w * 0.3, 0.05); poly(g, [[hat[0] - w * 0.68, hat[1] + 5], [hat[0] + w * 0.68, hat[1] + 5], [hat[0] + w * 0.56, hat[1] - w * 0.82], [hat[0] - w * 0.56, hat[1] - w * 0.82]], 0.02); poly(g, [[hat[0] - w * 0.55, hat[1] + 2], [hat[0] + w * 0.55, hat[1] + 2], [hat[0] + w * 0.45, hat[1] - w * 0.7], [hat[0] - w * 0.45, hat[1] - w * 0.7]], 0.05);
  g.fillStyle = gray(0.88 * (0.75 + 0.25 * light)); g.fillRect(hat[0] - w * 0.45, hat[1] - 5, w * 0.9, 4); // the polished band on the dark crown
  feat(V, "hat", { box: [hat[0] - w * 0.45, hat[1] - 5, w * 0.9, 4] });
  if (I.look === "strings") { const L = V.W.lamb(), [lx, ly] = V.proj(L.x, L.z, 1.4); g.strokeStyle = gray(0.85); g.lineWidth = 1; for (const k of [-6, 0, 6]) { g.beginPath(); g.moveTo(lx + k, ly); g.lineTo(hat[0] + k, hat[1]); g.stroke(); } }
  tip(V, F, top[0] + s * w, top[1] + h * 0.3);
}

// Under the Goats: a low mound of snow with grain glowing through it; the hoard heaps sacks on it; the dragon is the
// heap coiled high, spined with sack necks
function hoard(P) {
  const { g, V, F, I, bx, by, H, w, ink, s, light } = P, dragon = I.look === "dragon", heap = I.look === "hoard" || dragon;
  const hw = w * (dragon ? 2.0 : 1.7), hh = H * (dragon ? 1.05 : 0.45);
  oval(g, bx, by - hh * 0.45, hw, hh * 0.55, ink);
  oval(g, bx, by - hh * 0.55, hw * 0.75, hh * 0.42, 0.02); oval(g, bx, by - hh * 0.55, hw * 0.4, hh * 0.2, 0.97); // the glow of grain, deep in the dark mound
  if (!dragon) feat(V, "glow", { box: [bx - hw * 0.3, by - hh * 0.68, hw * 0.6, hh * 0.26] }); // on the dragon he is coiled over it: the heap, not the glow, is what reads
  if (I.look === "hoard") for (let k = 0; k < 5; k++) oval(g, bx - s * hw * 0.8, by - w * 0.4 - k * w * 0.5, w * 0.36, w * 0.26, 0.62 * (0.7 + 0.3 * light)); // sacks stacked as they come up
  if (heap) for (let k = 0; k < (dragon ? 7 : 4); k++) { const x = bx + (k - 3) * w * 0.5, y = by - hh * (0.7 + 0.25 * hash(k, 5)); oval(g, x, y, w * 0.32, w * 0.24, 0.08 + 0.04 * hash(k, 2)); }
  if (dragon) for (let k = 0; k < 5; k++) { const x = bx + (k - 2) * w * 0.6; limb(g, [[x, by - hh * 0.95], [x + s * 4, by - hh * 1.2]], 4, 2, ink); }
  tip(V, F, bx + s * hw, by - hh * 0.5);
}

// a sack that came up out of the snow: tied at the neck, sagging
function sack(P) {
  const { g, V, F, bx, by, w, s, light } = P, r = Math.max(w, 14) * 0.6;
  oval(g, bx, by - r * 0.9, r, r * 0.95, 0.06); // dark hessian, which reads on snow
  poly(g, [[bx - 3, by - r * 1.8], [bx + 3, by - r * 1.8], [bx + 2, by - r * 2.3], [bx - 2, by - r * 2.3]], 0.06); // the neck
  g.fillStyle = gray(0.92 * (0.75 + 0.25 * light)); g.fillRect(bx - r * 0.55, by - r * 1.0, r * 1.1, 3); // the cord round its belly
  feat(V, "sack", { box: [bx - r * 0.55, by - r * 1.0, r * 1.1, 3] });
  tip(V, F, bx + s * r, by - r);
}

// The Long Barn: the granary as a body, roof ribs over a dark gut, the chute hanging in front for a throat; the
// whistle puts steam through the ribs; at the end the ribs fold in and it is eating its own walls
function barn(P) {
  const { g, V, F, I, bx, by, H, w, ink, s, light } = P, self = I.look === "itself", bw = w * (self ? 1.4 : 2.2), bh = H * 1.05;
  poly(g, [[bx - bw, by], [bx + bw, by], [bx + bw * 0.95, by - bh * 0.3], [bx, by - bh * 1.15], [bx - bw * 0.95, by - bh * 0.3]], ink); // low eaves, a steep gable
  g.strokeStyle = gray(0.62 * (0.6 + 0.4 * light)); g.lineWidth = 2;
  for (let k = 1; k < 5; k++) { const x = bx - bw + (k * bw * 2) / 5; g.beginPath(); g.moveTo(x, by - 2); g.lineTo(x + (self ? (bx - x) * 0.4 : 0), by - bh * (0.3 + 0.8 * (1 - Math.abs(x - bx) / bw))); g.stroke(); }
  const cx = bx + s * bw * 0.35; g.fillStyle = gray(0.7 * (0.6 + 0.4 * light)); g.fillRect(cx - 4, by - bh * 0.7, 8, bh * 0.55); // the chute
  feat(V, "chute", { box: [cx - 4, by - bh * 0.7, 8, bh * 0.55] });
  if (I.look === "whistle") for (let k = 0; k < 6; k++) oval(g, bx + s * k * 3, by - bh - 4 - k * w * 0.45, w * (0.35 + 0.08 * k), w * 0.3, 0.6, 0.85); // steam through the ridge
  tip(V, F, cx, by - bh * 0.15);
}

// The Figure: tall and stooped, stitched from sacking and twine, Ned's coat across its shoulders; on the river and
// the ice it is the same shape on a pale ground
function figure(P) {
  const { g, V, F, I, bx, by, H, w, ink, s, light } = P, lean = s * w * 0.6;
  for (let k = 0; k < 6; k++) {
    const y = by - (k + 1) * H * 0.15, x = bx + lean * (k / 6), ww = w * (0.8 - 0.04 * k);
    g.fillStyle = gray((0.42 + 0.08 * hash(k, 3)) * (0.8 + 0.2 * light)); g.fillRect(x - ww, y, ww * 2, H * 0.14);
    g.fillStyle = gray(0.05); for (let q = 0; q < 3; q++) g.fillRect(x - ww * 0.6 + q * ww * 0.6, y + H * 0.13, 2, 2); // the twine stitches
    if (k === 4) { g.fillStyle = gray(0.1); g.fillRect(x - ww * 1.1, y, ww * 2.2, H * 0.12); feat(V, "coat", { box: [x - ww * 1.1, y, ww * 2.2, H * 0.12] }); } // Ned's coat over the shoulders
  }
  oval(g, bx + lean * 1.15, by - H * 0.98, w * 0.42, w * 0.5, ink); // the head bowed forward
  limb(g, [[bx + lean * 0.8, by - H * 0.78], [bx + lean * 1.6 + s * w * 0.6, by - H * 0.5]], 4, 3, ink); // the long arm
  if (I.look === "ice") { g.fillStyle = gray(0.85); g.fillRect(bx - w * 1.6, by - 3, w * 3.2, 3); } // the ice under it
  tip(V, F, bx + lean * 1.6 + s * w * 0.6, by - H * 0.5);
}

export const FORMS4 = { hatcoat, hoard, sack, barn, figure };
