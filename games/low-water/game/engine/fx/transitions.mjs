// Ink-blot variants (camera queue): three more ways between places beside the painted lead's blot (paint/inkblot.mjs):
// bleed (ink running down from the top along the paper's grain), burn (a scorched edge eating in from a point, for the
// fire and the requisition), page-turn (the page lifting from a corner and laying the next one down). Each is a coverage
// a(x, y, u) in 0..1 for progress u in 0..1 (1 covered), deterministic, so both styles can use it as a mask: the
// painted style over its canvas, the glyph style per cell. Original code.
//   TRANSITIONS[name](x, y, u, W, H, seed) -> { a, edge }   edge: how close to the moving front (for a burnt or wet rim)
//   applyTransition(img, next, name, u, seed)               composes two RGBA frames for a still
const hh = (a, b) => { let x = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1); x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); return ((x ^ (x >>> 13)) >>> 0) / 4294967296; };
const vn = (x, y, s) => { const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = hh(i + s, j), b = hh(i + 1 + s, j), c = hh(i + s, j + 1), d = hh(i + 1 + s, j + 1), U = u * u * (3 - 2 * u), V = v * v * (3 - 2 * v); return (a * (1 - U) + b * U) * (1 - V) + (c * (1 - U) + d * U) * V; };
const band = (d, w) => Math.max(0, 1 - Math.abs(d) / w);
export const TRANSITIONS = {
  bleed(x, y, u, W, H, s) {   // ink running down: the front sags where the paper's grain (a vertical noise) lets it
    const run = vn(x / 60, 0.5, s) * 0.3 + vn(x / 14, 0.5, s + 5) * 0.12 + vn(x / 4, y / 90, s + 3) * 0.04, front = (u * 1.5 - run) * H, d = front - y;
    return { a: d > 0 ? 1 : 0, edge: band(d, 10) };
  },
  burn(x, y, u, W, H, s) {   // a scorched hole from the centre's left, its ragged edge glowing
    const cx = W * 0.35, cy = H * 0.55, r = Math.hypot(x - cx, (y - cy) * 1.2) / Math.hypot(W, H), rag = vn(x / 22, y / 22, s) * 0.12 + vn(x / 7, y / 7, s + 9) * 0.04, d = (u * 1.25 - r - rag) * Math.hypot(W, H);
    return { a: d > 0 ? 1 : 0, edge: band(d, 9) };
  },
  pageTurn(x, y, u, W, H) {   // the page lifts from the bottom right; its curl is a moving diagonal with a shadow before it
    const k = (x / W + y / H) / 2, front = 1 - u * 1.15, d = (k - front) * Math.hypot(W, H);
    return { a: d > 0 ? 1 : 0, edge: band(d, 26) };
  },
};
export function applyTransition(img, next, name, u, seed = 3) {
  const f = TRANSITIONS[name], W = img.width, H = img.height, out = { width: W, height: H, data: new Uint8ClampedArray(img.data) };
  const rim = name === "burn" ? [255, 120, 30] : name === "bleed" ? [12, 10, 16] : [0, 0, 0];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const { a, edge } = f(x, y, u, W, H, seed), q = (y * W + x) * 4;
    for (let k = 0; k < 3; k++) {
      let v = a ? next.data[q + k] : img.data[q + k];
      if (name === "pageTurn" && !a) v *= 1 - 0.5 * edge;   // the shadow under the lifting page
      else if (edge > 0) v = v * (1 - edge * 0.8) + rim[k] * edge * 0.8;
      out.data[q + k] = v;
    }
    out.data[q + 3] = 255;
  }
  return out;
}
