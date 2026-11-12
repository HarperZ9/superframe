// G-buffers for the engine's dither-quantised lighting (web/shaders/ditherlight) and palette-locked
// lighting (web/shaders/palettelight) from a Low Water SDF scene, built on a small worker pool.
// The shading is the engine's own runDitherlight / runPalettelight on the assembled buffer.
//   scene (dither):  { map, idOf, albedo(id, P) -> tone, emissive(id) -> bool, sky(d) -> tone, lights(spec) -> engine lights (<= 4), haze?(o, d, t, spec) -> 0..1 }
//   scene (palette): { map, idOf, cls(id, P) -> { cls, a }, lightsPL(spec) -> { moonDir, lamp, window } }
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { rn } from "./rn.mjs";
import { makeTracer, dot } from "./sdf.mjs";

async function camMod() { return import(rn("web/shaders/paintover/camera.mjs")); }

function rowsDither(S, C, camera, w, h, y0, y1, spec) {
  const tr = makeTracer(S.map, S.idOf), lights = S.lights(spec), n = (y1 - y0) * w;
  const g = { albedo: new Float32Array(n), kind: new Uint8Array(n), depth: new Float32Array(n), wpos: new Float32Array(n * 3), nrm: new Float32Array(n * 3), apos: new Float32Array(n * 3), anrm: new Float32Array(n * 3), id: new Uint8Array(n), vis: new Float32Array(n * 4), haze: new Float32Array(n) };
  for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) {
    const i = (y - y0) * w + x, { o, d } = C.ray(camera, w, h, x, y), hit = tr.march(o, d, 200);
    g.haze[i] = S.haze ? S.haze(o, d, hit.hit ? hit.t : 200, spec, lights) : 0;
    if (!hit.hit) { g.kind[i] = 0; g.albedo[i] = S.sky(d); g.depth[i] = 200; g.id[i] = 255; continue; }
    const N = tr.normal(hit.P);
    g.kind[i] = S.emissive(hit.id, hit.P) ? 1 : 2; g.albedo[i] = S.albedo(hit.id, hit.P); g.id[i] = hit.id;
    g.depth[i] = (hit.P[0] - camera.pos[0]) * camera.fwd[0] + (hit.P[1] - camera.pos[1]) * camera.fwd[1] + (hit.P[2] - camera.pos[2]) * camera.fwd[2];
    for (let c = 0; c < 3; c++) { g.wpos[i * 3 + c] = hit.P[c]; g.apos[i * 3 + c] = hit.P[c]; g.nrm[i * 3 + c] = N[c]; g.anrm[i * 3 + c] = N[c]; }
    if (g.kind[i] === 2) for (let k = 0; k < Math.min(4, lights.length); k++) {
      const L = lights[k], v = [L.pos[0] - hit.P[0], L.pos[1] - hit.P[1], L.pos[2] - hit.P[2]], dl = Math.hypot(v[0], v[1], v[2]);
      if (dot(v, N) <= 0 || dl > (L.radius || L.range || 60)) continue;
      g.vis[i * 4 + k] = tr.shadow(hit.P, N, [v[0] / dl, v[1] / dl, v[2] / dl], dl - 0.4, 12);
    }
  }
  return g;
}
function rowsPalette(S, C, camera, w, h, y0, y1, spec) {
  const tr = makeTracer(S.map, S.idOf), PL = S.lightsPL(spec), n = (y1 - y0) * w;
  const g = { hit: new Uint8Array(n), cls: new Uint8Array(n), a: new Float32Array(n), depth: new Float32Array(n), P: new Float32Array(n * 3), N: new Float32Array(n * 3), vis: new Float32Array(n * 3), phase: new Float32Array(n) };
  for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) {
    const i = (y - y0) * w + x, { o, d } = C.ray(camera, w, h, x, y), hit = tr.march(o, d, 200);
    if (!hit.hit) continue;
    const N = tr.normal(hit.P), c = S.cls(hit.id, hit.P, N);
    g.hit[i] = 1; g.cls[i] = c.cls; g.a[i] = c.a; g.phase[i] = c.phase || 0;
    g.depth[i] = (hit.P[0] - camera.pos[0]) * camera.fwd[0] + (hit.P[1] - camera.pos[1]) * camera.fwd[1] + (hit.P[2] - camera.pos[2]) * camera.fwd[2];
    for (let k = 0; k < 3; k++) { g.P[i * 3 + k] = hit.P[k]; g.N[i * 3 + k] = N[k]; }
    if (c.cls >= 4) continue; // void, window, lamp: no lighting
    g.vis[i * 3] = dot(N, PL.moonDir) > 0 ? tr.shadow(hit.P, N, PL.moonDir, 40, 10) : 0;
    const v = [PL.lamp[0] - hit.P[0], PL.lamp[1] - hit.P[1], PL.lamp[2] - hit.P[2]], dl = Math.hypot(v[0], v[1], v[2]);
    g.vis[i * 3 + 1] = dl < 12 && dot(v, N) > 0 ? tr.shadow(hit.P, N, [v[0] / dl, v[1] / dl, v[2] / dl], dl - 0.6, 6) : 0;
    g.vis[i * 3 + 2] = 1;
  }
  return g;
}

if (!isMainThread) {
  const { sceneUrl, camera, w, h, y0, y1, spec, kind } = workerData;
  const S = (await import(sceneUrl)).default, C = await camMod();
  const g = kind === "dither" ? rowsDither(S, C, camera, w, h, y0, y1, spec) : rowsPalette(S, C, camera, w, h, y0, y1, spec);
  parentPort.postMessage({ y0, g });
}

// Assemble a full G-buffer from bands. kind: "dither" | "palette".
export async function renderFlat({ sceneUrl, camera, w, h, spec = {}, kind, workers = 6 }) {
  const n = Math.max(1, Math.min(workers, h)), band = Math.ceil(h / n), parts = [];
  await Promise.all(Array.from({ length: n }, (_, k) => new Promise((res, rej) => {
    const y0 = k * band, y1 = Math.min(h, y0 + band); if (y0 >= y1) { res(); return; }
    const wk = new Worker(new URL(import.meta.url), { workerData: { sceneUrl, camera, w, h, y0, y1, spec, kind } });
    wk.on("message", (m) => { parts.push(m); wk.terminate(); res(); }); wk.on("error", rej);
  })));
  parts.sort((a, b) => a.y0 - b.y0);
  const g = {}, keys = Object.keys(parts[0].g);
  for (const key of keys) { const per = parts[0].g[key].length / ((Math.min(h, band)) * w), T = parts[0].g[key].constructor, a = new T(w * h * per); for (const p of parts) a.set(p.g[key], p.y0 * w * per); g[key] = a; }
  if (kind === "dither") { g.width = w; g.height = h; g.prev = new Float32Array(w * h * 3).fill(NaN); } else { g.w = w; g.h = h; }
  return g;
}
