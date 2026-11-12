// Key-frame runner for the dither (ditherlight) and palette (palettelight) recipes.
//   node render/flat.mjs --kf weigh_vote [--w 640 --h 360] [--up 2] --out frames
import { mkdirSync, writeFileSync } from "node:fs";
import { rn } from "./rn.mjs";
import { renderFlat } from "./pipe_flat.mjs";

const { isoCamera, makeCamera } = await import(rn("web/shaders/paintover/camera.mjs"));
const DL = await import(rn("web/shaders/ditherlight/ditherlight.mjs")), PL = await import(rn("web/shaders/palettelight/palettelight.mjs"));
const { makeRadial } = await import(rn("web/shaders/ditherlight/lights.mjs"));
const { writePng } = await import(rn("tools/shaders/png.mjs"));
const here = new URL(".", import.meta.url), sceneUrl = (n) => new URL(`scenes/${n}.mjs`, here).href;

export const RECIPES = {
  weigh_vote: {
    kind: "dither", scene: "weigh_vote", camera: () => isoCamera({ yawDeg: 42, elevDeg: 30, target: [-0.2, 1.6, -0.8], dist: 60, ortho: false, fovY: 0.13 }), fov: 0.13,
    preset: "ink", over: { ink: [0.006, 0.003, 0.012], paper: [0.95, 0.9, 0.8], dark: 0.01, fogDist: 400, fogMax: 0, source: "bayer8", anchor: "screen" },
  },
  flats: {
    kind: "dither", scene: "flats", camera: () => isoCamera({ yawDeg: 28, elevDeg: 13, target: [-2, 2.6, -3], dist: 21, ortho: false, fovY: 0.85 }), fov: 0.85, spec: { beamAngle: -0.2 },
    preset: "tones4", over: { ink: [0.008, 0.006, 0.014], paper: [0.93, 0.9, 0.82], dark: 0.04, fogDist: 46, fogMax: 1, source: "bayer8", anchor: "screen" },
  },
  gut: {
    kind: "palette", scene: "gut", camera: () => isoCamera({ yawDeg: 18, elevDeg: 50, target: [0, 1.2, -0.5], dist: 60, ortho: true, scale: 6.0 }), time: 1.7, over: { gain: 1.6, ambient: 0.1, moon: 0.4 },
  },
};

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const name = opt("--kf", null), W = +opt("--w", 640), H = +opt("--h", 360), UP = +opt("--up", 2), out = opt("--out", "frames"), tag = opt("--tag", name);
if (!RECIPES[name]) throw new Error(`--kf one of ${Object.keys(RECIPES).join(", ")}`);
const R = RECIPES[name], t0 = Date.now(), cam = R.camera(), S = (await import(sceneUrl(R.scene))).default;
mkdirSync(out, { recursive: true });
const g = await renderFlat({ sceneUrl: sceneUrl(R.scene), camera: cam, w: W, h: H, spec: R.spec || {}, kind: R.kind });
let rgba;
if (R.kind === "dither") {
  const plan = DL.resolveDitherlight(R.preset, R.over, { height: H, fov: R.fov });
  rgba = DL.runDitherlight(plan, S.lights(R.spec || {}), g).rgba;
} else {
  const L = S.lightsPL(R.spec || {}), plan = PL.resolvePalettelight({ lampPos: L.lamp, moonDir: L.moonDir, ...(R.over || {}) });
  plan.glows = L.glows.map((p) => makeRadial(p)); // the scene's own window glows (the engine's defaults belong to its chapel)
  rgba = PL.runPalettelight(plan, g, R.time || 0).rgba;
}
const up = new Uint8ClampedArray(W * UP * H * UP * 4);
for (let y = 0; y < H * UP; y++) for (let x = 0; x < W * UP; x++) { const s = (((y / UP) | 0) * W + ((x / UP) | 0)) * 4, d = (y * W * UP + x) * 4; up[d] = rgba[s]; up[d + 1] = rgba[s + 1]; up[d + 2] = rgba[s + 2]; up[d + 3] = 255; }
writePng(`${out}/${tag}.png`, { width: W * UP, height: H * UP, data: up });
writeFileSync(`${out}/${tag}.json`, JSON.stringify({ kf: name, kind: R.kind, w: W, h: H, up: UP, preset: R.preset, over: R.over, seconds: (Date.now() - t0) / 1000, engine: "raw-native origin/main 92934a8 (git archive)" }, null, 1));
console.log(`${name}: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
void makeCamera;
