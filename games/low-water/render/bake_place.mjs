// Bake a place for the game: the painted plate with its lens split into layers the player's lens
// settings can mix at run time, the blackout plate (quay), and the world buffers.
// Engine passes: sodium spectral shading, paint-over painter, lens suite, dither lighting, look keys.
//   LW_PLATE=1 node render/bake_place.mjs --place brine --out content [--w 1280 --h 720] [--only lens|dark|geo]
// Layers (display-space differences from the lens-off frame): flare (ghosts and starburst), streak
// (anamorphic), halo (halation), ca (lateral dispersion, signed, stored around 128).
import { mkdirSync, writeFileSync } from "node:fs";
import { rn } from "./rn.mjs";
import { renderSpectral } from "./pipe_sodium.mjs";
import { renderFlat } from "./pipe_flat.mjs";
import { encode, paintOver, reHdr, writePng } from "./post.mjs";
import { gradeLinear } from "./grade.mjs";
import { makeTracer } from "./sdf.mjs";

if (process.env.LW_PLATE !== "1") throw new Error("set LW_PLATE=1");
const { isoCamera, makeCamera, ray } = await import(rn("web/shaders/paintover/camera.mjs"));
const LENS = await import(rn("web/shaders/lens/lens.mjs")), LP = await import(rn("web/shaders/lens/params.mjs")), DL = await import(rn("web/shaders/ditherlight/ditherlight.mjs"));

export const PLACES = {
  quay: { scene: "lamp_quay", camera: { iso: { yawDeg: 36, elevDeg: 26, target: [5, 1.5, 1.5], dist: 72, ortho: false, fovY: 0.37 } }, plan: { ambient: 0.06, mist: 0.003, extinct: 0.003 }, gain: 1.8, hour: 23.0, paint: { seed: 11, radii: [9, 5, 3, 1.8], relief: 0.25 }, body: { squeeze: 1.33, streakLenPx: 55, streakGain: 0.022, coating: { quarterAt: 600 } }, dark: "lamp_quay_dark", walk: [1, 3, 4, 5, 20] },
  brine: { scene: "brine_room", camera: { iso: { yawDeg: 34, elevDeg: 30, target: [0, 1.1, -0.3], dist: 44, ortho: false, fovY: 0.23 } }, plan: { ambient: 0.03, mist: 0.002, extinct: 0.001 }, gain: 1.8, hour: 23.2, paint: { seed: 7, radii: [8, 4.5, 2.6, 1.6], relief: 0.28 }, body: { squeeze: 1.0, streakLenPx: 40, streakGain: 0.012, coating: { quarterAt: 560 } }, walk: [1, 22] },
  weigh: { scene: "weigh_room", camera: { iso: { yawDeg: 42, elevDeg: 30, target: [-0.3, 1.5, -0.6], dist: 60, ortho: false, fovY: 0.16 } }, plan: { ambient: 0.01, mist: 0.003, extinct: 0.001 }, gain: 1.6, hour: 23.4, paint: { seed: 9, radii: [8, 4.5, 2.6, 1.6], relief: 0.28 }, body: { squeeze: 1.0, streakLenPx: 40, streakGain: 0.012 }, walk: [1] },
  lamp: { scene: "lamp_room", camera: { iso: { yawDeg: 40, elevDeg: 40, target: [0, 1.6, 0], dist: 30, ortho: false, fovY: 0.3 } }, plan: { ambient: 0.02, mist: 0.0025, extinct: 0.002 }, gain: 1.3, hour: 4.2, paint: { seed: 5, radii: [8, 4.5, 2.6, 1.6], relief: 0.3 }, body: { squeeze: 1.0, streakGain: 0.02, streakLenPx: 70, ghostGain: 40, coating: { quarterAt: 520 } }, walk: [1], variants: { lit: { LW_ARC: "on" }, dark: { LW_ARC: "off" } } },
};
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const name = opt("--place", "brine"), outRoot = opt("--out", "content"), W = +opt("--w", 1280), H = +opt("--h", 720), only = opt("--only", "all");
const C = PLACES[name]; if (!C) throw new Error(`--place one of ${Object.keys(PLACES).join(", ")}`);
const out = `${outRoot}/${name}`; mkdirSync(out, { recursive: true });
const cam = C.camera.iso ? isoCamera(C.camera.iso) : makeCamera(C.camera.make), t0 = Date.now(), here = new URL(".", import.meta.url);
const log = (s) => console.log(`${name}: ${s} ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const sceneUrl = (s) => new URL(`scenes/${s}.mjs`, here).href;

async function bakeVariant(tag, env) {
  Object.assign(process.env, env || {});
  const f = await renderSpectral({ sceneUrl: sceneUrl(C.scene), camera: cam, w: W, h: H, plan: { impurity: 0.02, ...C.plan }, workers: 6 });
  const painted = paintOver(encode(f, C.gain), W, H, f.ids, f.nrm, C.paint), frame = reHdr(painted, f, C.gain);
  const base = { ...LP.lensAtHour(C.hour), ...C.body };
  const run = (p) => { const plan = LENS.resolveLens(p, { width: W, height: H }), src = LENS.extractSources(plan, frame); return encode(gradeLinear(LENS.runLens(plan, frame, LENS.prepareSources(plan, src.list), src.keep), C.hour), C.gain); };
  const off = { ...base, ghostGain: 0, starGain: 0, streakGain: 0, haloGain: 0, caAmount: 0 };
  const plate = run(off); writePng(`${out}/${tag}.png`, { width: W, height: H, data: plate }); log(`${tag} plate`);
  const layer = (file, p, signed = false) => {
    const L = run(p), d = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H * 4; i += 4) { for (let c = 0; c < 3; c++) d[i + c] = signed ? 128 + (L[i + c] - plate[i + c]) : L[i + c] - plate[i + c]; d[i + 3] = 255; }
    writePng(`${out}/${tag}-${file}.png`, { width: W, height: H, data: d }); log(`${tag} ${file}`);
  };
  layer("flare", { ...off, ghostGain: base.ghostGain, starGain: base.starGain });
  layer("streak", { ...off, streakGain: base.streakGain });
  layer("halo", { ...off, haloGain: base.haloGain });
  layer("ca", { ...off, caAmount: base.caAmount }, true);
}

if (only === "all" || only === "lens") for (const [tag, env] of Object.entries(C.variants || { night: {} })) await bakeVariant(tag, env);
if (C.dark && (only === "all" || only === "dark")) {
  const w = W / 2, h = H / 2, D = (await import(sceneUrl(C.dark))).default, g = await renderFlat({ sceneUrl: sceneUrl(C.dark), camera: cam, w, h, kind: "dither" });
  const plan = DL.resolveDitherlight("tones4", { ink: [0.006, 0.004, 0.012], paper: [0.92, 0.89, 0.82], dark: 0.08, fogDist: 400, fogMax: 0, source: "bayer8", anchor: "screen" }, { height: h, fov: C.camera.iso.fovY });
  const r = DL.runDitherlight(plan, D.lights(), g), up = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = ((y >> 1) * w + (x >> 1)) * 4, d = (y * W + x) * 4; up[d] = r.rgba[s]; up[d + 1] = r.rgba[s + 1]; up[d + 2] = r.rgba[s + 2]; up[d + 3] = 255; }
  writePng(`${out}/dark.png`, { width: W, height: H, data: up }); log("blackout plate");
}
const S = (await import(sceneUrl(C.scene))).default;
if (only === "all" || only === "geo") {
  const tr = makeTracer(S.map, S.idOf), P = new Float32Array(W * H * 3), id = new Uint8Array(W * H).fill(255);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, r = ray(cam, W, H, x, y), hit = tr.march(r.o, r.d, 220); if (!hit.hit) { P.set([0, 1e3, 0], i * 3); continue; } P.set(hit.P, i * 3); id[i] = hit.id; }
  writeFileSync(`${out}/geo-pos.f32`, Buffer.from(P.buffer)); writeFileSync(`${out}/geo-id.u8`, Buffer.from(id.buffer)); log("world buffers");
}
writeFileSync(`${out}/place.json`, JSON.stringify({ place: name, width: W, height: H, camera: C.camera.iso, walk: C.walk, variants: Object.keys(C.variants || { night: {} }), dark: !!C.dark }, null, 1));
