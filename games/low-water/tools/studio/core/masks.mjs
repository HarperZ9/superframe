// Masks made from the reference by a rule, so a mask can be rebuilt from its rule rather than stored as
// an image (images stay out of git; the rule goes in doc.json). Rules:
//   { kind: "all" }                                 everything (a new mask shows all of its layer)
//   { kind: "ids", ids: [..], invert, grow, soft }   the pixels of these materials, grown and softened
//   { kind: "shade", lo, hi, foot }                  one strong light: where the form turns from the key
//                                                    (N.L from lo down to hi), and the canvas's foot
//   { kind: "lit", ids, lo, hi, invert }             these materials where they turn to the key (N.L lo..hi)
//   { kind: "features", ids, eye }                   the eyes (discs round the eye anchors, eye radii) and
//                                                    these materials (the lips)
//   maskFill(rule, ref) -> Float32Array rgba (alpha only)   ruleWeights(rule, ref) -> Float32Array 0..1
import { dilate, blur1 } from "./passes.mjs";
import { keyDir } from "./sitter.mjs";

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const ndlAt = (G, L, i) => G.N[i * 3] * L[0] + G.N[i * 3 + 1] * L[1] + G.N[i * 3 + 2] * L[2];

function shadeWeights(rule, ref, m) {
  const { G } = ref, L = keyDir(ref.meta.key), { lo = 0.3, hi = 0.02, foot = 0.62 } = rule;
  for (let i = 0; i < m.length; i++) {
    const f = ss(foot, 1, ((i / G.w) | 0) / G.h);
    m[i] = G.id[i] ? Math.max(ss(lo, hi, ndlAt(G, L, i)), f * 0.7) : f * 0.8;
  }
  return m;
}
function litWeights(rule, ref, m) {
  const { G } = ref, L = keyDir(ref.meta.key), set = new Set(rule.ids), { lo = 0.25, hi = 0.45 } = rule;
  for (let i = 0; i < m.length; i++) if (set.has(G.id[i])) { const t = ss(lo, hi, ndlAt(G, L, i)); m[i] = rule.invert ? 1 - t : t; }
  return m;
}
function featureWeights(rule, ref, m) {
  const { G } = ref, set = new Set(rule.ids || []), k = rule.eye ?? 1.6;
  for (let i = 0; i < m.length; i++) if (set.has(G.id[i])) m[i] = 1;
  for (const e of ref.anchors || []) {
    const rx = e.rx * k, ry = Math.max(e.ry, e.rx * 0.4) * k * 1.4;
    for (let y = Math.max(0, Math.floor(e.cy - ry)); y < Math.min(G.h, Math.ceil(e.cy + ry)); y++)
      for (let x = Math.max(0, Math.floor(e.cx - rx)); x < Math.min(G.w, Math.ceil(e.cx + rx)); x++)
        if (((x - e.cx) / rx) ** 2 + ((y - e.cy) / ry) ** 2 < 1) m[y * G.w + x] = 1;
  }
  return m;
}
function weights(rule, ref) {
  const { G } = ref, m = new Float32Array(G.w * G.h);
  if (rule.kind === "ids") { const set = new Set(rule.ids); for (let i = 0; i < m.length; i++) m[i] = set.has(G.id[i]) !== !!rule.invert ? 1 : 0; return m; }
  if (rule.kind === "all") return m.fill(1);
  if (rule.kind === "shade") return shadeWeights(rule, ref, m);
  if (rule.kind === "lit") return litWeights(rule, ref, m);
  if (rule.kind === "features") return featureWeights(rule, ref, m);
  throw new Error(`studio: no mask rule "${rule.kind}"`);
}
export function ruleWeights(rule, ref) {
  const { w, h } = ref.G; let m = weights(rule, ref);
  if (rule.grow) { const g = dilate(Uint8Array.from(m, (v) => (v > 0.5 ? 1 : 0)), w, h, rule.grow); m = Float32Array.from(g, (v, i) => Math.max(v, m[i])); }
  return blur1(m, w, h, rule.soft ?? 1);
}
export function maskFill(rule, ref) {
  const a = ruleWeights(rule, ref), fill = new Float32Array(a.length * 4);
  for (let i = 0; i < a.length; i++) fill[i * 4 + 3] = a[i];
  return fill;
}
