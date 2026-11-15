// The palette knife and the smudge.
// Knife: a flat blade held across the direction of travel. Loaded, it lays a flat swathe of its colour
// with hard edges; it flattens the paint's height under it to a plane and pushes a ridge up at the
// blade's two ends; it takes up much of the wet colour it scrapes over, so it drags paint along.
// Smudge: a finger through wet paint. It carries the colour it started on and smears it forward,
// taking up what it passes; it lays no new paint and leaves the height mostly alone.
//   knifeDab(S, cx, cy, dir, p) smudgeDab(S, cx, cy, dir, p) -> rect
import { mix as kmMix } from "../../../game/engine/paint/km.mjs";
import { clamp } from "./brush.mjs";

function deposit(S, i, col, a) {
  const L = S.layer, i4 = i * 4, La = L.rgba[i4 + 3], Na = La + (1 - La) * a, c = [L.rgba[i4], L.rgba[i4 + 1], L.rgba[i4 + 2]];
  kmMix(La > 0.001 ? c : col, col, Na > 0 ? a / Na : 1, c);
  L.rgba[i4] = c[0]; L.rgba[i4 + 1] = c[1]; L.rgba[i4 + 2] = c[2]; L.rgba[i4 + 3] = Na;
  for (let k = 0; k < 3; k++) S.doc.flat[i4 + k] = S.doc.flat[i4 + k] * (1 - a) + c[k] * a;
}
const wetAt = (S, i) => [S.doc.flat[i * 4], S.doc.flat[i * 4 + 1], S.doc.flat[i * 4 + 2]];

export function knifeDab(S, cx, cy, dir, p) {
  const { doc, layer: L, brush: B } = S, { w, h } = doc, half = B.size * (0.6 + 0.4 * clamp(p)), thick = Math.max(1.5, B.size * 0.18);
  const nx = -dir[1], ny = dir[0], R = Math.ceil(half + thick) + 1, k = S.knife || (S.knife = { col: [...B.colour], load: B.load });
  const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(w - 1, Math.ceil(cx + R)), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(h - 1, Math.ceil(cy + R));
  const plane = B.impasto * 0.6 * k.load, flow = B.flow * (0.6 + 0.4 * clamp(p));
  let took = [0, 0, 0], n = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x - cx, py = y - cy, u = px * nx + py * ny, v = px * dir[0] + py * dir[1];   // u along the blade, v across it
    if (Math.abs(u) > half + 0.5 || Math.abs(v) > thick + 0.5) continue;
    const aa = clamp(half + 0.5 - Math.abs(u)) * clamp(thick + 0.5 - Math.abs(v)), i = y * w + x, wet = wetAt(S, i);
    took[0] += wet[0]; took[1] += wet[1]; took[2] += wet[2]; n++;
    if (L.kind === "mask") { L.rgba[i * 4 + 3] = clamp(L.rgba[i * 4 + 3] + aa * flow); continue; }
    deposit(S, i, k.col, aa * flow * Math.min(1, 0.3 + k.load));
    if (L.height) {
      const end = Math.abs(u) > half * 0.82 ? (Math.abs(u) - half * 0.82) / (half * 0.18) : 0;   // the ridge at the blade's ends
      L.height[i] = L.height[i] * (1 - 0.7 * aa) + (plane + end * B.impasto * 0.8) * 0.7 * aa;
    }
  }
  if (n) kmMix(k.col, took.map((t) => t / n), clamp(B.pickup * 0.5), k.col);   // the blade drags what it scraped
  k.load = Math.max(0, k.load - B.depletion * 1.5);
  return { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

export function smudgeDab(S, cx, cy, dir, p) {
  const { doc, layer: L, brush: B } = S, { w, h } = doc, r = B.size * (0.4 + 0.6 * clamp(p)), strength = B.flow * (0.5 + 0.5 * clamp(p));
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
  if (!S.carry) S.carry = wetAt(S, Math.round(cy) * w + Math.round(cx));
  let took = [0, 0, 0], n = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const d2 = ((x - cx) ** 2 + (y - cy) ** 2) / (r * r); if (d2 >= 1) continue;
    const i = y * w + x, f = (1 - d2) * (1 - d2), wet = wetAt(S, i);
    took[0] += wet[0] * f; took[1] += wet[1] * f; took[2] += wet[2] * f; n += f;
    if (L.kind !== "mask") deposit(S, i, S.carry, strength * f * 0.8);
    if (L.height) L.height[i] *= 1 - 0.15 * f * strength;
  }
  if (n) kmMix(S.carry, took.map((t) => t / n), 0.22, S.carry);
  return { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}
