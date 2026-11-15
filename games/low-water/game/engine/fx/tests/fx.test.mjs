// The effects layer: deterministic, tied to state, honouring quality and the accessibility settings, both forms drawn.
// node --test game/engine/fx/tests/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { buildScene } from "../../light/scene.mjs";
import { fxContext, runEffects, fxSettings } from "../core.mjs";
import "../weather.mjs";
import "../fire.mjs";
import { paintRgba } from "../paint.mjs";
import { glyphMarks } from "../glyph.mjs";

const dir = new URL("../../../capture/light/plates/q_granary/", import.meta.url), have = existsSync(new URL("place.json", dir));
const load = () => { const pj = JSON.parse(readFileSync(new URL("place.json", dir), "utf8")), b = readFileSync(new URL("geo-pos.f32", dir)); return { pj, geo: { pos: new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), ids: new Uint8Array(readFileSync(new URL("geo-id.u8", dir))) } }; };
const S = have ? (() => { const { pj, geo } = load(); return { pj, ...buildScene({ pj, geo, hour: 23.7, terms: { snowfall: 0.5, snow: 0.8 } }) }; })() : null;
const figs = [{ id: "a", at: [0.4, 0, 2], facing: -1.57 }, { id: "b", at: [-1.6, 0, 1.2], facing: -1.2 }];
const run = (q, t = 3, extra = {}) => runEffects(fxContext({ M: S.M, F: S.F, pj: S.pj, t, figures: figs, ...extra }), fxSettings(new URLSearchParams(q)));
const kinds = (r) => r.prims.reduce((m, p) => ((m[p.k] = (m[p.k] || 0) + 1), m), {});

test("deterministic in (state, t); off draws nothing; low draws less than high", { skip: !have && "no proof plate" }, () => {
  assert.deepEqual(run("fx=high").prims, run("fx=high").prims);
  assert.equal(run("fx=off").prims.length, 0);
  assert.ok(run("fx=low").prims.length < run("fx=high").prims.length);
});
test("tied to state: snow only when it snows, fire marks follow the fire's gain, nothing burns in a dead hearth", { skip: !have && "no proof plate" }, () => {
  const k = kinds(run("fx=high")); assert.ok(k.flake > 20 && k.flame > 0 && k.ember > 0 && run("fx=high").prims.some((p) => p.id === "lying"), JSON.stringify(k));
  const dry = { ...S.M, terms: { ...S.M.terms, snowfall: 0 } }, r = runEffects(fxContext({ M: dry, F: S.F, pj: S.pj, t: 3, figures: figs }), fxSettings(new URLSearchParams("fx=high")));
  assert.ok(!kinds(r).flake, "no snowfall, no flakes");
  const out = { ...S.M, lights: S.M.lights.map((L) => ({ ...L, decay: { ...L.decay, on: false } })) }, r2 = runEffects(fxContext({ M: out, F: S.F, pj: S.pj, t: 3, figures: figs }), fxSettings(new URLSearchParams("fx=high")));
  assert.ok(!kinds(r2).flame && !kinds(r2).ember, "a fire the street cannot feed has no flame");
});
test("accessibility: reduced motion thins the snow and stops sparks and haze; flicker off steadies the flames", { skip: !have && "no proof plate" }, () => {
  const a = kinds(run("fx=high")), b = kinds(run("fx=high&fxmotion=reduced"));
  assert.ok(b.flake <= a.flake * 0.75 && !b.spark && !b.haze, JSON.stringify([a.flake, b]));   // half the flakes fall; the lit share of each half differs a little
  const len = (q, t) => run(q, t).prims.filter((p) => p.k === "flame").map((p) => p.len.toFixed(3)).join();
  assert.notEqual(len("fx=high", 3), len("fx=high", 3.4), "full flicker moves the flame");
  assert.equal(len("fx=high&fxflicker=off&fxmotion=reduced", 3), len("fx=high&fxflicker=off&fxmotion=reduced", 3.4), "flicker off and motion reduced: the flame holds");
});
test("both forms draw: the painted form changes pixels, the glyph form sets marks", { skip: !have && "no proof plate" }, () => {
  const r = run("fx=high"), img = { width: S.pj.width, height: S.pj.height, data: new Uint8ClampedArray(S.pj.width * S.pj.height * 4).fill(20) };
  paintRgba(img, r.prims); let changed = 0; for (let i = 0; i < img.data.length; i += 4) if (img.data[i] !== 20) changed++;
  assert.ok(changed > 500, `${changed} pixels`);
  const m = glyphMarks(r.prims, { left: 0, top: 0, z: 1, ox: 0, oy: 0, cw: 8, ch: 12, cols: Math.ceil(S.pj.width / 8), rows: Math.ceil(S.pj.height / 12) });
  assert.ok(m.length > 50 && m.some((x) => x.ch === "^") && m.some((x) => x.ch === "="), `${m.length} marks`);
});
