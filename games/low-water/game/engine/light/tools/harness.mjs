// The glyph proof: one Quota plate drawn by the real glyph renderer (paint/glyph/renderer.mjs), first under its
// own light (before), then with its light cells taken from the light model (after), so the record can be seen
// in type before the glyph lead wires it. Nothing in the renderer changes: the harness replaces the renderer's
// baked light cells (state.E) between two frames. Query: plate, hour, state, t, light=own|model, base.
//   /engine/light/tools/harness.html?plate=q_granary&hour=23.7&state=start&light=model
import { createGlyphRenderer } from "../../paint/glyph/renderer.mjs";
import { sceneLight } from "../proof.mjs";
import { glyphCells } from "../adapters.mjs";
import { parseLwd, readerOf } from "./stockstates.mjs";
import { fxContext, runEffects, fxSettings } from "../../fx/core.mjs";
import "../../fx/weather.mjs";
import "../../fx/fire.mjs";
import "../../fx/ground.mjs";
import "../../fx/decay.mjs";
import "../../fx/combat.mjs";
import "../../fx/dream.mjs";
import "../../fx/shafts.mjs";
import "../../fx/water.mjs";
import "../../fx/fog.mjs";
import { glyphMarks, drawMarks } from "../../fx/glyph.mjs";
import { FX_SCENES, figuresFor } from "../../fx/tools/scenes.mjs";

const q = new URLSearchParams(location.search), base = q.get("base") || "/capture/light/plates/", plate = q.get("plate") || "q_granary";
async function load() {
  const pj = await (await fetch(`${base}${plate}/place.json`)).json();
  const pos = new Float32Array(await (await fetch(`${base}${plate}/geo-pos.f32`)).arrayBuffer()), ids = new Uint8Array(await (await fetch(`${base}${plate}/geo-id.u8`)).arrayBuffer());
  const kinds = await (await fetch("/engine/paint/glyph/kinds.json")).json(), byId = []; for (const k of kinds) byId[k.id] = k;
  const lwd = await (await fetch("/content/quota/q_community.lwd")).text();
  return { pj, geo: { pos, ids }, kinds, byId, read: readerOf(parseLwd(lwd), q.get("state") || "start") };
}
async function main() {
  const { pj, geo, kinds, byId, read } = await load(), host = document.getElementById("host"), v = pj.variants[0];
  const W = innerWidth, H = innerHeight, zoom = Math.min(W / pj.width, H / pj.height);
  const R = createGlyphRenderer({ parent: host, kinds, opts: { gpu: false, smoke: false } });
  const scene = { place: pj, geo, variant: v, hour: pj.variantInfo[v].hour, terms: { rain: 0, fog: 0, wind: 0 }, figures: [], darkness: 0, kinds: byId, ways: [] };
  const cam = { left: 0, top: 0, zoom, W, H }, lights = { place: (pj.lights && pj.lights[v]) || [], lantern: null };
  R.show(true); R.renderFrame(scene, cam, lights, null); const legOwn = R.measure();
  const fxs = q.get("fxscene") ? FX_SCENES.find((x) => x.id === q.get("fxscene")) : null;
  const t0 = performance.now(), L = sceneLight({ pj, geo, read, hour: +(q.get("hour") || pj.variantInfo[v].hour), t: +(q.get("t") || 0), terms: fxs && fxs.terms }), bakeMs = performance.now() - t0;
  let cellMs = 0; const mean = (A) => { let m = 0, n = 0; for (let i = 1; i < A.length; i += 3) if (A[i] > 0) { m += A[i]; n++; } return +(m / (n || 1)).toFixed(4); }, own = mean(R.state.E); let model = null;
  if (q.get("light") === "model") {
    const t1 = performance.now(), E = glyphCells(R.state.C, L.S.F, L.Enow, { exposure: q.get("exposure") === "1" ? 1 : null }); cellMs = performance.now() - t1; model = mean(E);
    R.state.E = E; R.state.Edyn = new Float32Array(E.length); R.state.levels.fill(255); R.state.prev = null;
    R.opts.exposure += 1e-9;   // a new key for the composer's per-cell cache, so every cell is composed again under the new light
    R.renderFrame(scene, cam, lights, null);
  }
  const leg = (m) => m && { structure: +m.structure.toFixed(3), coverage: +m.coverage.toFixed(3), median: m.median, p90: m.p90, follows: +(m.follows ?? 0).toFixed(3) };
  let fxInfo = null;
  if (fxs && q.get("fx") === "1") fxInfo = drawFx(fxs, pj, L, host, R, zoom);
  window.__light = { ok: true, fx: fxInfo, exposure: q.get("light") === "model" ? R.state.E.exposure : null, meanOwn: own, meanModel: model, legibility: leg(q.get("light") === "model" ? R.measure() : legOwn), bakeMs: +bakeMs.toFixed(1), cellMs: +cellMs.toFixed(1), glyph: R.state.stats, lights: L.S.M.lights.length };
  document.documentElement.dataset.ready = "1";
}
// the effects in type over the glyph frame, the way fx/glyph.mjs hands them to the glyph renderer
function drawFx(sc, pj, L, host, R, zoom) {
  const t = +(sc.t ?? 4), figs = figuresFor(sc, pj), set = fxSettings(new URLSearchParams(location.search)); let ctx = null;
  for (let k = 0; k <= 8; k++) { const tk = t - 4 + k * 0.5; ctx = fxContext({ M: L.S.M, F: L.S.F, pj, t: tk, day: sc.day ?? 41, sync: true, figures: figs.map((f) => ({ ...f, at: [f.at[0] + (f.walk || 0) * tk, f.at[1], f.at[2]] })), wind: sc.wind ?? 0.4, prev: ctx }); ctx.events = sc.events || null; ctx.future = sc.future || null; if (k < 8) runEffects(ctx, set); }
  const t1 = performance.now(), r = runEffects(ctx, set), g = R.state.grid, grid = { ...g, left: 0, top: 0, z: zoom }, marks = glyphMarks(r.prims, grid), ms = performance.now() - t1;
  const c = document.createElement("canvas"); c.width = innerWidth; c.height = innerHeight; c.style.cssText = "position:absolute;inset:0;pointer-events:none"; host.append(c);
  drawMarks(c.getContext("2d"), marks, grid, R.opts.font); return { prims: r.prims.length, marks: marks.length, ms: +ms.toFixed(2) };
}
main().catch((e) => { console.error(e); window.__light = { ok: false, error: String(e && e.stack || e) }; document.documentElement.dataset.ready = "1"; });
