// Bake Lamp Quay for the playable prototype: the night plate (engine sodium shading, paint-over
// painter, lens suite, Low Water grade), the blackout plate (engine dither-quantised lighting), and
// the world buffers the game walks on and draws over (world position and surface id per pixel),
// all from one camera. Run with LW_PLATE=1 so the people the game draws are not baked in.
//   LW_PLATE=1 node render/bake_quay.mjs --out content/quay [--w 1280 --h 720]
import { mkdirSync, writeFileSync } from "node:fs";
import { rn } from "./rn.mjs";
import { renderSpectral } from "./pipe_sodium.mjs";
import { renderFlat } from "./pipe_flat.mjs";
import { encode, paintOver, reHdr, lensPass, finish, writePng } from "./post.mjs";
import { gradeLinear } from "./grade.mjs";
import { makeTracer } from "./sdf.mjs";
import Q from "./scenes/lamp_quay.mjs";
import DarkScene from "./scenes/lamp_quay_dark.mjs";

if (process.env.LW_PLATE !== "1") throw new Error("set LW_PLATE=1");
const { isoCamera, ray } = await import(rn("web/shaders/paintover/camera.mjs"));
const DL = await import(rn("web/shaders/ditherlight/ditherlight.mjs"));
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const out = opt("--out", "content/quay"), W = +opt("--w", 1280), H = +opt("--h", 720), only = opt("--only", "all");
mkdirSync(out, { recursive: true });
export const CAMERA = { yawDeg: 36, elevDeg: 26, target: [5, 1.5, 1.5], dist: 72, ortho: false, fovY: 0.37 };
const cam = isoCamera(CAMERA), t0 = Date.now(), here = new URL(".", import.meta.url);
const log = (s) => console.log(`${s} ${((Date.now() - t0) / 1000).toFixed(0)} s`);

if (only === "all" || only === "night") {
  const gain = 1.8, f = await renderSpectral({ sceneUrl: new URL("scenes/lamp_quay.mjs", here).href, camera: cam, w: W, h: H, plan: { ambient: 0.06, mist: 0.003, extinct: 0.003, impurity: 0.02 }, workers: 6 });
  const painted = paintOver(encode(f, gain), W, H, f.ids, f.nrm, { seed: 11, radii: [9, 5, 3, 1.8], relief: 0.25 });
  const lf = lensPass(reHdr(painted, f, gain), 23.0, { squeeze: 1.33, streakLenPx: 55, streakGain: 0.022, coating: { quarterAt: 600 } });
  writePng(`${out}/night.png`, { width: W, height: H, data: finish(encode(gradeLinear(lf.out, 23.0), gain), W, H, { grain: 0.0, vignette: 0.0 }) });
  log("night plate");
}
if (only === "all" || only === "dark") {
  const w = W / 2, h = H / 2, g = await renderFlat({ sceneUrl: new URL("scenes/lamp_quay_dark.mjs", here).href, camera: cam, w, h, kind: "dither" });
  const plan = DL.resolveDitherlight("tones4", { ink: [0.006, 0.004, 0.012], paper: [0.92, 0.89, 0.82], dark: 0.08, fogDist: 400, fogMax: 0, source: "bayer8", anchor: "screen" }, { height: h, fov: CAMERA.fovY });
  const r = DL.runDitherlight(plan, DarkScene.lights(), g), up = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = ((y >> 1) * w + (x >> 1)) * 4, d = (y * W + x) * 4; up[d] = r.rgba[s]; up[d + 1] = r.rgba[s + 1]; up[d + 2] = r.rgba[s + 2]; up[d + 3] = 255; }
  writePng(`${out}/dark.png`, { width: W, height: H, data: up });
  log("blackout plate");
}
if (only === "all" || only === "geo") {
  // world position (x, y, z as float32) and surface id per pixel; sky is id 255 with y = 1e3
  const tr = makeTracer(Q.map, Q.idOf), P = new Float32Array(W * H * 3), id = new Uint8Array(W * H).fill(255);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, r = ray(cam, W, H, x, y), hit = tr.march(r.o, r.d, 220);
    if (!hit.hit) { P.set([0, 1e3, 0], i * 3); continue; }
    P.set(hit.P, i * 3); id[i] = hit.id;
  }
  writeFileSync(`${out}/geo-pos.f32`, Buffer.from(P.buffer)); writeFileSync(`${out}/geo-id.u8`, Buffer.from(id.buffer));
  log("world buffers");
}
writeFileSync(`${out}/place.json`, JSON.stringify({ place: "lamp-quay", width: W, height: H, camera: CAMERA, ids: (await import("./scenes/lamp_quay.mjs")).ID }, null, 1));
