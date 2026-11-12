// Key-frame runner for the spectral recipes (sodium pass -> paint-over -> lens).
//   node render/kf.mjs --kf lamp_quay [--w 1280 --h 720] [--raw] [--nopaint] [--workers 6] --out frames
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { rn } from "./rn.mjs";
import { renderSpectral } from "./pipe_sodium.mjs";
import { gradeLinear } from "./grade.mjs";
import { encode, paintOver, reHdr, lensPass, finish, rainOver, writePng } from "./post.mjs";

const { makeCamera, isoCamera } = await import(rn("web/shaders/paintover/camera.mjs"));
const here = new URL(".", import.meta.url);
const sceneUrl = (name) => new URL(`scenes/${name}.mjs`, here).href;

export const RECIPES = {
  lamp_quay: {
    scene: "lamp_quay", hour: 23.07, camera: () => isoCamera({ yawDeg: 36, elevDeg: 26, target: [5, 1.5, 1.5], dist: 72, ortho: false, fovY: 0.37 }),
    plan: { ambient: 0.06, mist: 0.003, extinct: 0.003, impurity: 0.02 }, gain: 1.6, paint: { seed: 11, radii: [9, 5, 3, 1.8], relief: 0.25 },
    lens: { squeeze: 1.33, streakLenPx: 55, streakGain: 0.022, coating: { quarterAt: 600 } }, finish: { grain: 0.035, vignette: 0.4 },
  },
  lamp_room: {
    scene: "lamp_room", hour: 4.2, camera: () => makeCamera({ ortho: false, pos: [3.3, 3.6, 4.1], fwd: [-0.6, -0.2, -0.77], fovY: 1.05 }),
    plan: { ambient: 0.02, mist: 0.0025, extinct: 0.002, impurity: 0.02 }, gain: 1.3, paint: { seed: 5, radii: [8, 4.5, 2.6, 1.6], relief: 0.3 },
    lens: { squeeze: 1.0, streakGain: 0.02, streakLenPx: 70, ghostGain: 40, coating: { quarterAt: 520 } }, finish: { grain: 0.03, vignette: 0.45 },
  },
  chancel: {
    scene: "chancel", hour: 1.2, camera: () => isoCamera({ yawDeg: 52, elevDeg: 20, target: [0.3, 4.6, 0], dist: 46, ortho: false, fovY: 0.36 }),
    plan: { ambient: 0.03, mist: 0.0018, extinct: 0.003, impurity: 0.02 }, gain: 1.7, paint: { seed: 21, radii: [9, 5, 3, 1.8], relief: 0.25 },
    lens: { squeeze: 1.33, streakGain: 0.03, streakLenPx: 60, coating: { quarterAt: 600 } }, finish: { grain: 0.035, vignette: 0.42 },
  },
  brine_door: {
    scene: "lamp_quay", hour: 23.3, camera: () => isoCamera({ yawDeg: 8, elevDeg: 34, target: [-7.7, 0.9, 0.2], dist: 16, ortho: false, fovY: 0.19 }),
    plan: { ambient: 0.012, mist: 0.003, extinct: 0.003, impurity: 0.02 }, gain: 1.6, paint: { seed: 13, radii: [8, 4.5, 2.6, 1.5], relief: 0.25 },
    lens: { squeeze: 1.33, streakLenPx: 50, streakGain: 0.02, coating: { quarterAt: 600 } }, finish: { grain: 0.035, vignette: 0.4 },
  },
};

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; }, flag = (k) => args.includes(k);
const name = opt("--kf", null), W = +opt("--w", 1280), H = +opt("--h", 720), out = opt("--out", "frames"), workers = +opt("--workers", 6);
if (!name || !RECIPES[name]) throw new Error(`--kf one of ${Object.keys(RECIPES).join(", ")}`);
const R = RECIPES[name], tag = opt("--tag", name);
mkdirSync(out, { recursive: true });
const t0 = Date.now(), cam = R.camera();
const f = await renderSpectral({ sceneUrl: sceneUrl(R.scene), camera: cam, w: W, h: H, time: R.time || 0, plan: R.plan, workers });
console.log(`${name}: spectral pass ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const raw = encode(f, R.gain);
if (flag("--raw") || flag("--nopaint")) writePng(`${out}/${tag}-raw.png`, { width: W, height: H, data: raw });
let disp = raw, sources = 0;
if (!flag("--nopaint")) {
  const painted = paintOver(raw, W, H, f.ids, f.nrm, R.paint);
  console.log(`${name}: painted ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const lf = lensPass(reHdr(painted, f, R.gain), R.hour, R.lens); sources = lf.sources;
  disp = encode(gradeLinear(lf.out, R.hour, R.grade || {}), R.gain);
  if (R.rain) disp = rainOver(disp, W, H, R.rain);
  disp = finish(disp, W, H, R.finish);
  writePng(`${out}/${tag}.png`, { width: W, height: H, data: disp });
}
writeFileSync(`${out}/${tag}.json`, JSON.stringify({ kf: name, w: W, h: H, hour: R.hour, plan: R.plan, gain: R.gain, paint: R.paint, lens: R.lens, lensSources: sources, seconds: (Date.now() - t0) / 1000, engine: "raw-native origin/main 92934a8 (git archive)" }, null, 1));
console.log(`${name}: done in ${((Date.now() - t0) / 1000).toFixed(0)} s, ${sources} lens sources`);
void pathToFileURL; void makeCamera;
