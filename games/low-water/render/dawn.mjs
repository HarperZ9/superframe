// The paint-over recipe, as the engine designs it (web/shaders/paintover): render the Lamp Quay
// block-out in neutral daylight from a keyframe camera, paint over it (painter.mjs), project the
// painting back onto the block-out (projector.mjs, KEYFRAME weights) and view it from a camera
// swung off the keyframe, then grade the projected painting by hour with the engine's paint-over
// grade (grade.mjs gradeFrame) driven by Low Water's own look keys over the eight slots.
// Writes the dawn key frame, an eight-slot strip and the measured hole fraction of the swing.
//   node render/dawn.mjs --out frames [--w 1280 --h 720] [--swing 9]
import { mkdirSync, writeFileSync } from "node:fs";
import { rn } from "./rn.mjs";
import { renderSpectral } from "./pipe_sodium.mjs";
import { encode, paintOver, finish, writePng } from "./post.mjs";
import { makeTracer } from "./sdf.mjs";
import S, { ID } from "./scenes/lamp_quay.mjs";

const { isoCamera, ray } = await import(rn("web/shaders/paintover/camera.mjs"));
const P = await import(rn("web/shaders/paintover/projector.mjs")), G = await import(rn("web/shaders/paintover/grade.mjs"));
const { createLookKeys, SLOTS_8 } = await import(rn("web/look/keys.mjs"));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const out = opt("--out", "frames"), W = +opt("--w", 1280), H = +opt("--h", 720), SW = +opt("--swing", 9);
mkdirSync(out, { recursive: true });

// Low Water's grade terms for the paint-over grade (same names the engine's grade reads).
// Slots: midnight, predawn, dawn, morning, noon, golden, dusk, night.
export const LW_PAINT_TERMS = {
  exposure: { values: [0.26, 0.34, 0.7, 0.95, 1.05, 0.9, 0.5, 0.3], min: 0.05, max: 2 },
  tint: [[0.62, 0.6, 1.15], [0.7, 0.72, 1.1], [1.12, 0.86, 0.92], [1.0, 0.97, 0.94], [1.0, 1.0, 1.0], [1.18, 0.92, 0.74], [1.0, 0.72, 0.98], [0.64, 0.62, 1.15]],
  saturation: { values: [0.7, 0.75, 1.0, 1.0, 1.0, 1.1, 0.95, 0.72], min: 0, max: 2 },
  lampGlow: { values: [1.0, 0.95, 0.5, 0.05, 0.0, 0.35, 0.9, 1.0], min: 0, max: 1 },
  fill: { values: [0.8, 0.85, 1.0, 1.0, 1.0, 1.0, 0.95, 0.85], min: 0, max: 1 },
};
const look = createLookKeys({ slots: 8, params: LW_PAINT_TERMS });
const t0 = Date.now(), base = { yawDeg: 36, elevDeg: 26, target: [5, 1.5, 1.5], dist: 72, ortho: false, fovY: 0.37 };
// the keyframe sees a margin round the view (fov x 1.25), as a painter would paint past the frame
const keyCam = isoCamera({ ...base, fovY: base.fovY * 1.25 }), viewCam = isoCamera({ ...base, yawDeg: base.yawDeg + SW, elevDeg: base.elevDeg - 2 });
const sceneUrl = new URL("scenes/lamp_quay.mjs", import.meta.url).href;

// 1. the daylight export from the keyframe camera, and its paint-over
const f = await renderSpectral({ sceneUrl, camera: keyCam, w: W, h: H, time: 100, plan: { ambient: 0.35, mist: 0, extinct: 0, impurity: 0.02 }, workers: 6 });
const exportRgba = encode(f, 1.1), painting = paintOver(exportRgba, W, H, f.ids, f.nrm, { seed: 31, radii: [9, 5, 3, 1.8], relief: 0.25 });
writePng(`${out}/paintover-export.png`, { width: W, height: H, data: exportRgba }); writePng(`${out}/paintover-painting.png`, { width: W, height: H, data: painting });
console.log(`export and painting ${((Date.now() - t0) / 1000).toFixed(0)} s`);

// 2. G-buffers: the keyframe depth (for the projector) and the swung view
const tr = makeTracer(S.map, S.idOf);
function gbuf(cam) {
  const n = W * H, g = { w: W, h: H, hit: new Uint8Array(n), id: new Uint8Array(n).fill(255), depth: new Float32Array(n).fill(1e9), P: new Float32Array(n * 3), N: new Float32Array(n * 3), shade: new Float32Array(n * 3) };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, r = ray(cam, W, H, x, y), h = tr.march(r.o, r.d, 220);
    if (!h.hit) { g.shade.set([0.55, 0.6, 0.66], i * 3); continue; }
    const N = tr.normal(h.P); g.hit[i] = 1; g.id[i] = h.id; g.P.set(h.P, i * 3); g.N.set(N, i * 3);
    g.depth[i] = (h.P[0] - cam.pos[0]) * cam.fwd[0] + (h.P[1] - cam.pos[1]) * cam.fwd[1] + (h.P[2] - cam.pos[2]) * cam.fwd[2];
  }
  return g;
}
const gk = gbuf(keyCam), gv = gbuf(viewCam);
console.log(`g-buffers ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const projectors = [P.makeProjector(keyCam, W, H, painting, gk.depth)];
// a second keyframe past the swing, painted only where the first cannot reach (the engine demo's
// hole-filling secondary): its export keeps the first painting's colours where they project
const key2 = isoCamera({ ...base, yawDeg: base.yawDeg + 2 * SW, elevDeg: base.elevDeg - 3, fovY: base.fovY * 1.25 });
{
  const f2 = await renderSpectral({ sceneUrl, camera: key2, w: W, h: H, time: 100, plan: { ambient: 0.35, mist: 0, extinct: 0, impurity: 0.02 }, workers: 6 });
  const g2 = gbuf(key2), ex2 = encode(f2, 1.1), mask = new Uint8Array(W * H), hole = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { if (!g2.hit[i]) continue; const s = P.shadePoint(projectors, [g2.P[i * 3], g2.P[i * 3 + 1], g2.P[i * 3 + 2]], [g2.N[i * 3], g2.N[i * 3 + 1], g2.N[i * 3 + 2]], key2, P.KEYFRAME); if (s.rgb) for (let c = 0; c < 3; c++) ex2[i * 4 + c] = Math.round(Math.min(1, s.rgb[c]) * 255); else hole[i] = 1; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (hole[y * W + x]) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) mask[Y * W + X] = 1; }
  const rgb = new Float32Array(W * H * 3); for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) rgb[i * 3 + c] = ex2[i * 4 + c] / 255;
  const { paint } = await import(rn("web/shaders/paintover/painter.mjs"));
  const p2 = paint({ w: W, h: H, rgb }, { id: f2.ids, N: f2.nrm }, { seed: 32, radii: [9, 5, 3, 1.8], relief: 0.25, mask });
  projectors.push(P.makeProjector(key2, W, H, p2.rgba8, g2.depth));
  console.log(`second keyframe ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
const proj = P.renderProjected(projectors, gv, viewCam, { opt: P.KEYFRAME, fallback: () => [0.36, 0.34, 0.4] });
let hit = 0, holes = 0; for (let i = 0; i < W * H; i++) if (gv.hit[i]) { hit++; if (!proj.covered[i]) holes++; }

// 3. grade by hour: lamps, lanterns and windows glow at night
const lamp = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) if ([ID.sodium, ID.lantern, ID.win, ID.porthole, ID.merrowLamp].includes(gv.id[i])) lamp[i] = 1;
const glow = G.glowOf(lamp, W, H);
const dawnHour = 6.15, dawn = finish(G.gradeFrame(proj.rgb, W, H, look.at(dawnHour), glow), W, H, { grain: 0.03, vignette: 0.35 });
writePng(`${out}/kf8-dawn-daybook.png`, { width: W, height: H, data: dawn });
// the strip: eight slots, each a half-size frame, in two rows of four
const sw = W / 2, sh = H / 2, strip = new Uint8ClampedArray(W * 2 * H * 4);
SLOTS_8.forEach((s, k) => {
  const fr = G.gradeFrame(proj.rgb, W, H, look.at(s.hour), glow), ox = (k % 4) * sw, oy = Math.floor(k / 4) * sh;
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { const a = ((y * 2) * W + x * 2) * 4, b = ((oy + y) * W * 2 + ox + x) * 4; for (let c = 0; c < 4; c++) strip[b + c] = fr[a + c]; }
});
writePng(`${out}/kf8-slots-strip.png`, { width: W * 2, height: H, data: strip });
const facts = { keyframes: [{ yawDeg: base.yawDeg, elevDeg: base.elevDeg }, { yawDeg: base.yawDeg + 2 * SW, elevDeg: base.elevDeg - 3 }], swingYawDeg: SW, swingElevDeg: -2, holeFraction: holes / hit, hitPixels: hit, dawnHour, slots: SLOTS_8, terms: LW_PAINT_TERMS, seconds: (Date.now() - t0) / 1000, engine: "raw-native origin/main 92934a8 (git archive)" };
writeFileSync(`${out}/kf8-dawn-daybook.json`, JSON.stringify(facts, null, 1));
console.log(`hole fraction ${(100 * holes / hit).toFixed(2)}% at ${SW} degrees; done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
