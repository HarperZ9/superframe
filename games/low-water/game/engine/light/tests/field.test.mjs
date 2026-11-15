// The light record over a synthetic plate: a floor with a pillar, a lamp and a fire, ray-cast through an
// orthographic camera into geo buffers the way the bake writes them. node --test game/engine/light/tests/
import test from "node:test";
import assert from "node:assert/strict";
import { camBasis } from "../../world/plateworld.mjs";
import { createLightModel } from "../model.mjs";
import { bakeField, composeField } from "../field.mjs";
import { relightRatio } from "../consume.mjs";
import { figureRig, RIM_FLOOR } from "../figure.mjs";
import { sampleOf } from "../figure.mjs";

const cam = { yawDeg: 30, elevDeg: 40, target: [0, 0, 0], dist: 40, ortho: true, scale: 6 };
function plate() {
  const W = 320, H = 240, s = 0.5, w = W * s, h = H * s, pos = new Float32Array(w * h * 3).fill(NaN), ids = new Uint8Array(w * h), B = camBasis(cam), asp = W / H;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = ((x + 0.5) / w) * 2 - 1, v = 1 - ((y + 0.5) / h) * 2, o = [0, 1, 2].map((k) => B.pos[k] + B.right[k] * u * cam.scale * asp + B.up[k] * v * cam.scale), d = B.f;
    let t = -o[1] / d[1], id = 2;   // the floor
    // the pillar: a box 0.6 m square, 3 m tall, at the origin (slab test)
    let t0 = -Infinity, t1 = Infinity; for (const [k, a, b] of [[0, -0.3, 0.3], [1, 0, 3], [2, -0.3, 0.3]]) { const q0 = (a - o[k]) / d[k], q1 = (b - o[k]) / d[k]; t0 = Math.max(t0, Math.min(q0, q1)); t1 = Math.min(t1, Math.max(q0, q1)); }
    if (t0 < t1 && t0 > 0 && t0 < t) { t = t0; id = 4; }
    const i = y * w + x; for (let k = 0; k < 3; k++) pos[i * 3 + k] = o[k] + d[k] * t; ids[i] = id;
  }
  return { pj: { place: "synthetic", width: W, height: H, geoScale: s, pxPerMetre: 40, camera: cam, footing: { 2: "stone", 4: "wood" } }, geo: { pos, ids } };
}
const { pj, geo } = plate();
const lamp = { at: [2.5, 2.2, 0], kind: "paraffin", I: 16, reach: 7, street: "s" }, fire = { at: [-3, 0.4, 2], kind: "paraffin", group: "fire", I: 6, reach: 4, street: "s" };
const model = (read = () => 1, terms = { frost: 0.8 }) => createLightModel({ place: { ...pj, variants: ["night"], variantInfo: { night: { hour: 22 } }, lights: { night: [lamp, fire] } }, terms, read, street: "s" });
const at = (F, p) => sampleOf(F, p);

test("lamp light falls off, the pillar casts a shadow away from the lamp, the record is filled", () => {
  const M = model(), F = bakeField(pj, geo, M), E = composeField(F, M);
  const near = at(F, [1.6, 0, 0]), far = at(F, [5.5, 0, 0.6]), behind = at(F, [-1.2, 0, 0]), side = at(F, [1.2, 0, 2.2]);
  assert.ok(E[near * 3] > E[far * 3] * 2, "brighter under the lamp");
  assert.ok(E[behind * 3] < E[side * 3] * 0.5, `the pillar's shadow: ${E[behind * 3].toFixed(3)} against ${E[side * 3].toFixed(3)}`);
  assert.ok(F.rec.shadow[behind] > 200, "the shadow is recorded");
  // the control: with the march off, the same measure must not find the shadow
  const F0 = bakeField(pj, geo, M, { shadows: false }), E0 = composeField(F0, M); assert.ok(!(E0[behind * 3] < E0[side * 3] * 0.5), "control: no march, no shadow");
  assert.ok(F.rec.dir[near * 3 + 1] > 40, "the ruling light is above");
  assert.ok(F.rec.K[near] > 1700 && F.rec.K[near] < 2600, `a lamp's warmth under it: ${F.rec.K[near]} K`);
  // stroke light: the key's source, its lit side and shadow side, the terminator on the pillar's round
  assert.equal(F.rec.key[near], 0, "the floor by the lamp is ruled by the lamp (light 0)");
  assert.ok(F.rec.side[near] > 30 && F.rec.term[near] < 128, "the floor faces the lamp: lit side, no terminator");
  const pillar = []; for (let i = 0; i < F.n; i++) if (geo.ids[i] === 4 && F.rec.key[i] === 0) pillar.push(i);
  assert.ok(pillar.some((i) => F.rec.side[i] > 40) && pillar.some((i) => F.rec.term[i] > 200), "the pillar shows a lit face and a terminator");
});
test("frost melts round the fire and leaves a wet ring; fog grows with depth", () => {
  const M = model(), F = bakeField(pj, geo, M), byFire = at(F, [-3, 0, 2.6]), away = at(F, [3.5, 0, -3]);
  assert.ok(F.rec.frost[away] > 120 && F.rec.frost[byFire] < F.rec.frost[away] * 0.5, `frost ${F.rec.frost[byFire]} by the fire, ${F.rec.frost[away]} away`);
  assert.ok(F.rec.wet[byFire] > F.rec.wet[away], "thaw by the fire");
  const nearCam = at(F, [4, 0, 4]), farCam = at(F, [-4, 0, -4]); assert.ok(F.rec.fog[farCam] >= F.rec.fog[nearCam]);
});
test("decay and the clock change the light; the relight ratio follows; a still frame is stable", () => {
  const rich = model(() => 1), poor = model(() => 0), Fr = bakeField(pj, geo, rich), Fp = bakeField(pj, geo, poor), i = at(Fr, [1.6, 0, 0]);
  const Er = composeField(Fr, rich).slice(), Ep = composeField(Fp, poor).slice(), Eb = composeField(Fp, poor, { asBaked: true, out: new Float32Array(Fp.n * 3) });
  assert.ok(Ep[i * 3] < Er[i * 3] * 0.3, "the poor street's lamp is out");
  const R = relightRatio(Fp, Ep, Eb); assert.ok(R[i * 3] < 0.4, `the plate darkens where the lamp went out: ${R[i * 3]}`);
  const day = composeField(Fr, rich, { hour: 12.5 }).slice(); assert.ok(day[at(Fr, [4, 0, 4]) * 3 + 1] > Er[at(Fr, [4, 0, 4]) * 3 + 1] * 3, "noon outshines the night");
  const a = composeField(Fr, rich, { t: 3.2 }).slice(), b = composeField(Fr, rich, { t: 3.2 }).slice(); assert.deepEqual(a, b);
});
test("a figure's rig: key from the real source, fill no deeper than 4:1, a rim always, terminator toward the key", () => {
  const M = model(), F = bakeField(pj, geo, M); composeField(F, M);
  const R = figureRig({ M, at: [1.0, 0, 0.5], F });
  assert.equal(R.key.kind, "paraffin"); assert.ok(R.key.dir[0] > 0.5, "the key comes from the lamp at +x");
  assert.ok(R.fill.E >= R.key.E * 0.25 - 1e-9, "fill held to 4:1"); assert.ok(R.rim.E >= RIM_FLOOR, "a rim to part the figure from the ground");
  const B = camBasis(cam), sx = R.key.dir[0] * B.right[0] + R.key.dir[2] * B.right[2]; assert.ok(Math.sign(R.terminator.dir2[0]) === Math.sign(sx), "the lit side of the face is the key's side");
  assert.ok(R.sss.k > 0.2, "the cold reddens ears and noses"); assert.ok(R.rig.key && R.rig.fill && R.rig.rim && R.rig.amb, "shade.mjs rig shape");
});
