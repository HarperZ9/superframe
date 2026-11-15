// A place's light built in steps, so a large plate never holds the main thread: the geometry, the bake and the
// surface terms each run over bands of rows, and the caller decides how much to do per slice (install.mjs uses the
// idle callback's deadline). The same result as scene.mjs buildScene, byte for byte (tests/steps.test.mjs).
//   const job = buildSteps({ pj, geo, variant, hour, read, era })   a generator; each next() does one band
//   runSteps(job, budgetMs) -> scene | null                          run until done or the budget is spent
import { geoDims, normalsOf, occlusionOf, marcher } from "./geo.mjs";
import { fieldOf, bakeRows, composeField } from "./field.mjs";
import { surfacePrep, surfaceRows } from "./surface.mjs";
import { sceneModel } from "./scene.mjs";
import { emitOwners } from "./windows.mjs";

export function* buildSteps({ pj, geo, variant = null, hour = null, read = null, era = null, terms = null, band = 24 }) {
  const [w, h] = geoDims(pj), n = w * h, N = new Float32Array(n * 3).fill(NaN), occ = new Uint8Array(n);
  for (let y = 0; y < h; y += band * 4) { normalsOf(pj, geo.pos, { rows: [y, y + band * 4], out: N }); yield "normals"; }
  for (let y = 0; y < h; y += band) { occlusionOf(pj, geo.pos, N, { rows: [y, y + band], out: occ }); yield "occlusion"; }
  const g = { pj, w, h, n, N, pos: geo.pos, ids: geo.ids, occ, blocked: marcher(pj, geo.pos) };
  const { M, entry } = sceneModel({ pj, g, variant, hour, read, era, terms }); yield "model";
  const F = fieldOf(g);
  // the bake 96 samples at a time (the costliest stage: a shadow march per light); runSteps checks its budget after each
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x += 96) { bakeRows(F, M, y, y + 1, x, Math.min(w, x + 96)); yield "bake"; }
  const P = surfacePrep(F, M);
  for (let y = 0; y < h; y += 2) { surfaceRows(F, M, P, y, y + 2); yield "surface"; }
  const owners = new Int16Array(F.n).fill(-1);
  for (let y = 0; y < h; y += 2) { emitOwners(F, M.lights, { rows: [y, y + 2], out: owners }); yield "owners"; }
  return { M, F, G: g, entry, owners, compose: (o = {}) => composeField(F, M, { indoor: !!entry.indoor, ...o }) };
}
export function runSteps(job, budgetMs = Infinity, now = () => performance.now()) {
  const t0 = now();
  for (;;) { const r = job.next(); if (r.done) return r.value; if (now() - t0 >= budgetMs) return null; }
}
