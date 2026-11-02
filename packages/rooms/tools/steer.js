// SPDX-License-Identifier: FSL-1.1-MIT
// Steer any parameter space by choosing between candidates: interactive evolution with a recorded session. The proposal
// rule is Mind's Eye's, so a session over its 26 genes reproduces the page's candidates exactly. A choice carries log2(K)
// bits at most, and the step size falls with the bits spent.
import { SH, GROUPS } from "../core/shapes.js";

const TAU = Math.PI * 2;
export const DEFAULTS = { width0: 0.3, halfLifeBits: 100, widthFloor: 0.012, mutateP: 0.35 };
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(TAU * r());
export const mixSeed = (a, b) => (Math.imul(a >>> 0, 2654435761) ^ Math.imul((b >>> 0) + 0x9e3779b9, 1597334677)) >>> 0;
const clampGene = (gene, v) => (gene.wrap ? v - Math.floor(v) : v < 0 ? 0 : v > 1 ? 1 : v);
function mutate(space, p, width, locks, r, P) {
  const c = p.slice(),
    n = space.genes.length;
  let moved = false;
  for (let i = 0; i < n; i++) {
    if (locks && locks[i]) continue;
    if (r() < P.mutateP) {
      c[i] = clampGene(space.genes[i], c[i] + width * gauss(r));
      moved = true;
    }
  }
  if (!moved) {
    const free = [];
    for (let i = 0; i < n; i++) if (!(locks && locks[i])) free.push(i);
    if (free.length) {
      const i = free[Math.floor(r() * free.length)];
      c[i] = clampGene(space.genes[i], c[i] + width * gauss(r));
    }
  }
  return c;
}
export const widthAt = (bits, P = DEFAULTS, mult = 1) =>
  Math.max(P.widthFloor, P.width0 * Math.pow(2, -bits / P.halfLifeBits)) * mult;
/** K candidates: all random on the first draw, then the parent in one slot and mutations in the rest. */
export function propose(space, seed, draw, parent, K, width, locks = null, P = DEFAULTS) {
  const r = rng(mixSeed(seed, draw)),
    out = [];
  if (!parent) {
    for (let i = 0; i < K; i++) out.push(space.genes.map(() => r()));
    return { cands: out, parentSlot: -1 };
  }
  const s = Math.floor(r() * K);
  for (let i = 0; i < K; i++) out.push(i === s ? parent.slice() : mutate(space, parent, width, locks, r, P));
  return { cands: out, parentSlot: s };
}
/** A space is a list of genes in 0..1 and a map from a genome to settings. Validated, so a tool cannot steer nothing. */
export function parameterSpace({ id, genes, toSettings }) {
  if (!id || !genes || !genes.length) throw new Error("a parameter space needs an id and genes");
  for (const g of genes) if (!g.name) throw new Error(`space ${id}: a gene has no name`);
  return { id, genes, toSettings };
}
export function session(space, { seed = 1, K = 2, params = DEFAULTS } = {}) {
  if (K < 2) throw new Error("a choice needs at least two candidates");
  let parent = null,
    bits = 0,
    draw = 0,
    current = null;
  const rows = [];
  return {
    candidates() {
      current = propose(space, seed, draw, parent, K, widthAt(bits, params), null, params);
      return current.cands;
    },
    choose(slot) {
      if (!current) throw new Error("ask for candidates first");
      if (!(slot >= 0 && slot < K)) throw new Error(`slot ${slot} is out of range`);
      parent = current.cands[slot];
      rows.push({ draw, K, slot });
      draw++;
      bits += Math.log2(K);
      current = null;
      return parent;
    },
    get best() {
      return parent;
    },
    get bits() {
      return bits;
    },
    record: () => ({ space: space.id, seed, K, rows: rows.slice() }),
  };
}
/** Rebuild a genome from a saved session, without the person. */
export function replay(space, rec, params = DEFAULTS) {
  let parent = null,
    bits = 0;
  for (const { draw, K, slot } of rec.rows) {
    parent = propose(space, rec.seed, draw, parent, K, widthAt(bits, params), null, params).cands[slot];
    bits += Math.log2(K);
  }
  return parent;
}
const lin = (a, b) => (u) => a + (b - a) * u;
/** The first registered space: Lens Room's lens controls and its shape menu. Ranges are the page's sliders. */
export function lensSpace() {
  const ids = GROUPS.flatMap(([, it]) => it).filter((v) => v !== "F" && v !== "none" && SH[v]);
  const R = { n: lin(1, 2.6), curve: lin(0, 1), size: lin(0.25, 1.8), tilt: lin(-90, 90), spin: lin(-180, 180), zoom: lin(1, 8), dist: lin(0.1, 12) };
  const names = Object.keys(R);
  return parameterSpace({
    id: "lens-room",
    genes: [{ name: "shape" }, ...names.map((name) => ({ name }))],
    toSettings: (g) => {
      const s = { shape: ids[Math.min(ids.length - 1, Math.floor(g[0] * ids.length))] };
      names.forEach((k, i) => (s[k] = R[k](g[i + 1])));
      return s;
    },
  });
}
