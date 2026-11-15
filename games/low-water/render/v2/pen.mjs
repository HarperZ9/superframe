// The surveyor's drawing: a pen-and-glaze rendering of a plate, a candidate third style (after the inspiration batch's
// architectural specimen sheets; techniques only). Line first, then glazes, on aged paper:
//   1. construction lines: faint lead, every edge carried a little past its ends;
//   2. contours: a technical pen where a surface ends (id, normal or depth steps), heavier on the silhouette;
//   3. shadow hatching: 45-degree ruled lines on the shadow side, crossed where the shadow is cast;
//   4. glazes: flat watercolour washes per material (ochre limestone, sienna brick, slate, bistre in shadow, a
//      Prussian sky), darker at their wet edges, the paper's fibre through them; at night a grey nocturne wash
//      with the lit windows left warm.
// Inputs at plate resolution: id (kit ids), nrm, depth (camera depth), the painted plate (its value says where the
// cast shadows are), names; terms from the light model when given. Original code; deterministic.
//   surveyor(W, H, { id, nrm, depth, plate, names, terms }, { night }) -> Uint8ClampedArray rgba
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
function hash(x, y, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s), su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v); return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv; }
const WASH = {
  stone: [0.78, 0.7, 0.52], brick: [0.72, 0.42, 0.3], roof: [0.5, 0.54, 0.6], timber: [0.66, 0.5, 0.34], plaster: [0.86, 0.8, 0.66], ground: [0.8, 0.76, 0.66],
  iron: [0.45, 0.47, 0.5], cloth: [0.6, 0.5, 0.42], window: [0.95, 0.82, 0.45], sky: [0.56, 0.68, 0.82],
};
const CLASS = { quay: "stone", cobble: "ground", slab: "stone", wall: "stone", steps: "stone", mole: "stone", tower: "stone", brick: "brick", brickdark: "brick", chimney: "brick", roof: "roof", tile: "roof",
  boards: "timber", deck: "timber", timber: "timber", plank: "timber", darkwood: "timber", plaster: "plaster", limewash: "plaster", bone: "plaster", oxblood: "brick", mustard: "plaster", teal: "roof", pink: "plaster",
  mud: "ground", sand: "ground", shingle: "ground", iron: "iron", rust: "iron", stove: "iron", sack: "cloth", canvas: "cloth", window: "window", windowdim: "window", lantern: "window", candle: "window" };
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export function surveyor(W, H, { id, nrm, depth, plate, names, terms = null }, { night = false, key = [-0.55, 0.6, -0.58], seed = 3 } = {}) {
  const n = W * H, out = new Float32Array(n * 3), cls = new Array(n);
  for (let i = 0; i < n; i++) cls[i] = id[i] ? CLASS[names[id[i]] || ""] || "plaster" : null;
  // the paper: warm, a fibre, a faint stain toward the corners
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, f = 0.96 + 0.04 * vnoise(x / 3, y / 3, seed) - 0.05 * vnoise(x / 180, y / 180, seed + 1), v = 1 - 0.12 * (((x / W - 0.5) * 1.4) ** 2 + ((y / H - 0.5) * 1.4) ** 2); out[i * 3] = 0.93 * f * v; out[i * 3 + 1] = 0.89 * f * v; out[i * 3 + 2] = 0.8 * f * v; }
  // which side: the light model's when given, else the normal against the key
  const kl = Math.hypot(...key), K = key.map((v) => v / kl), shade = new Float32Array(n), cast = new Float32Array(n);
  let Ls = []; for (let i = 0; i < n; i += 5) if (id[i]) Ls.push(lum(plate[i * 4], plate[i * 4 + 1], plate[i * 4 + 2])); Ls.sort((a, b) => a - b); const p25 = Ls.length ? Ls[Math.floor(Ls.length * 0.25)] : 60;
  for (let i = 0; i < n; i++) { if (!id[i]) continue; const d = nrm[i * 3] * K[0] + nrm[i * 3 + 1] * K[1] + nrm[i * 3 + 2] * K[2]; shade[i] = terms && terms.shade ? terms.shade[i] : clamp(-d * 3); const L = lum(plate[i * 4], plate[i * 4 + 1], plate[i * 4 + 2]); cast[i] = shade[i] < 0.3 && L < p25 ? 1 : 0; }
  // 4 first in paint order (washes go under the ink): glazes per material, darker at their wet edges, bistre in shadow
  const edge = (i, x, y) => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [0, 2], [-2, 0], [0, -2]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; if (cls[Y * W + X] !== cls[i]) return true; } return false; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, c = cls[i]; if (!c) { if (!night && y < H * 0.35) { const t = 0.25 * (1 - y / (H * 0.35)); for (let k = 0; k < 3; k++) out[i * 3 + k] *= 1 - t + t * WASH.sky[k]; } continue; }
    let w = WASH[c] || WASH.plaster, a = 0.55 + 0.1 * vnoise(x / 24, y / 24, seed + 2);
    if (edge(i, x, y)) a = Math.min(0.9, a + 0.22);   // the wash's wet edge
    for (let k = 0; k < 3; k++) out[i * 3 + k] *= 1 - a + a * w[k];
    const sh = Math.max(shade[i] * 0.85, cast[i] * 0.7); if (sh > 0) { const bistre = [0.62, 0.5, 0.4]; for (let k = 0; k < 3; k++) out[i * 3 + k] *= 1 - sh * 0.45 + sh * 0.45 * bistre[k]; }
    if (night) { const win = c === "window"; for (let k = 0; k < 3; k++) out[i * 3 + k] = win ? Math.min(1, out[i * 3 + k] * 1.1) : out[i * 3 + k] * [0.5, 0.52, 0.6][k]; }
  }
  // 3. hatching: 45-degree rules in shadow (spacing 5 px), crossed in cast shadow
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!cls[i] || cls[i] === "window") continue;
    const s = Math.max(shade[i], cast[i]); if (s < 0.35) continue;
    const a = ((x + y) % 5 + 5) % 5 < 1 ? 0.55 * s : 0, b = cast[i] && (((x - y) % 7) + 7) % 7 < 1 ? 0.45 : 0, t = Math.max(a, b) * (0.8 + 0.2 * hash(x >> 3, y >> 3, seed + 4));
    for (let k = 0; k < 3; k++) out[i * 3 + k] *= 1 - t * 0.7;
  }
  // 1 and 2. construction lead and the technical pen: edges where the surface changes; the lead runs past the ends
  const isEdge = new Uint8Array(n);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x; let e = 0;
    for (const j of [i + 1, i + W]) {
      if (id[i] !== id[j]) e = Math.max(e, (!id[i] || !id[j]) ? 3 : 2);
      else if (id[i]) { const dn = nrm[i * 3] * nrm[j * 3] + nrm[i * 3 + 1] * nrm[j * 3 + 1] + nrm[i * 3 + 2] * nrm[j * 3 + 2]; if (dn < 0.85) e = Math.max(e, 2); else if (Math.abs(depth[i] - depth[j]) > 0.35) e = Math.max(e, 2); }
    }
    isEdge[i] = e;
  }
  const ink = [0.22, 0.16, 0.12], lead = [0.55, 0.53, 0.5];
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = y * W + x, e = isEdge[i]; if (!e) continue;
    // construction lead: carried 10 px along the edge's own run (estimated from its 5 x 5 neighbourhood)
    let sx = 0, sy = 0, c = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (isEdge[i + dy * W + dx]) { sx += dx * Math.sign(dx || 1) * (dy >= 0 ? 1 : -1); sy += Math.abs(dy) * Math.sign(dx || 1); c++; }
    const L = Math.hypot(sx, sy) || 1, ux = sx / L, uy = sy / L;
    if (hash(x >> 4, y >> 4, seed + 5) < 0.5) for (const sgn of [-1, 1]) for (let t = 3; t < 12; t++) { const X = Math.round(x + ux * t * sgn), Y = Math.round(y + uy * t * sgn); if (X < 0 || Y < 0 || X >= W || Y >= H || isEdge[Y * W + X]) continue; const j = Y * W + X; for (let k = 0; k < 3; k++) out[j * 3 + k] = out[j * 3 + k] * 0.82 + lead[k] * 0.18; }
    const a = e === 3 ? 0.95 : 0.75;
    for (let k = 0; k < 3; k++) out[i * 3 + k] = out[i * 3 + k] * (1 - a) + ink[k] * a;
  }
  const o = new Uint8ClampedArray(n * 4); for (let i = 0; i < n; i++) { for (let k = 0; k < 3; k++) o[i * 4 + k] = clamp(out[i * 3 + k]) * 255; o[i * 4 + 3] = 255; }
  return o;
}
