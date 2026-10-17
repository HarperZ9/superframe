// Palette-locked plates (the Gut): the engine's palette-locked lighting (web/shaders/palettelight:
// resolvePalettelight, runPalettelight, its fixed ramps and the cycling void ramp) on a G-buffer
// traced from a place, at half size and doubled, as the look bible's Gut frame was. Every lit wire
// lamp is one of the plan's glows; each pixel's glow visibility is its shadow toward the nearest lit
// lamp. Original glue code.
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { rn } from "../rn.mjs";
import { makeTracer, dot } from "../sdf.mjs";
import { BY_ID } from "../kit/ids.mjs";
import { fbm, vnoise } from "../sdf.mjs";

const CLS = { ground: 0, stone: 1, wood: 2, foliage: 3, void: 4, window: 5, lamp: 6 };
const KIND_CLS = { cobble: "ground", slab: "ground", mud: "ground", quay: "ground", steps: "ground", sand: "ground", shingle: "ground", brick: "stone", brickdark: "stone", roof: "stone", chimney: "stone", wall: "stone", limewash: "stone", plaster: "stone", iron: "stone", ice: "stone", glass: "stone", timber: "wood", plank: "wood", barrel: "wood", fishbox: "wood", crate: "wood", tar: "wood", darkwood: "wood", boards: "wood", rope: "foliage", fish: "foliage", net: "foliage", weed: "foliage", weedrock: "foliage", oilskin: "foliage", gutter: "void", pool: "void", window: "window", windowdim: "window", red: "window", green: "window", oxblood: "window", lantern: "lamp", stovefire: "window" };
export function clsOf(id, P, V = {}) {
  const k = BY_ID[id], name = k ? k.name : "wall", c = KIND_CLS[name] || "stone", n = fbm(P[0] * 1.5 + P[1], P[2] * 1.5);
  if (c === "void" && V.frozen) return { cls: CLS.stone, a: 0.15 + 0.12 * n };
  if (c === "void") return { cls: CLS.void, a: 1, phase: (0.55 * vnoise(P[0] * 0.8, P[2] * 0.8) + 0.45 * vnoise(P[2] * 2.1, P[0] * 2.1 + 3) + 0.06 * P[0] + 10) % 1 };
  if (c === "window") return V.doorsDark && name !== "window" && name !== "windowdim" ? { cls: CLS.wood, a: 0.4 } : { cls: CLS.window, a: (name === "windowdim" ? 0.35 : 0.6) + 0.4 * n };
  if (c === "lamp") return V.lampsOff ? { cls: CLS.stone, a: 0.3 } : { cls: CLS.lamp, a: 1 };
  if (name === "ice") return { cls: CLS.stone, a: 0.18 + 0.15 * n };
  return { cls: CLS[c], a: (c === "stone" ? 0.45 : 0.55) + 0.45 * n };
}
async function load(placeUrl, vname) {
  const P = (await import(placeUrl)).default, CAM = await import(rn("web/shaders/paintover/camera.mjs"));
  return { P, V: P.variants[vname], cam: CAM.isoCamera({ ...P.camera, ortho: true, scale: P.camera.H / 2 / P.camera.ppm, dist: P.camera.dist || 40 }), CAM };
}
function rows({ P, V, cam, CAM }, w, h, y0, y1) {
  const tr = makeTracer(P.world.map, P.world.idOf), n = (y1 - y0) * w, glows = V.glows, moon = V.moonDir;
  const g = { id: new Uint8Array(n).fill(255), hit: new Uint8Array(n), cls: new Uint8Array(n), a: new Float32Array(n), depth: new Float32Array(n), P: new Float32Array(n * 3), N: new Float32Array(n * 3), vis: new Float32Array(n * 3), phase: new Float32Array(n) };
  for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) {
    const i = (y - y0) * w + x, { o, d } = CAM.ray(cam, w, h, x, y), hit = tr.march(o, d, 200);
    if (!hit.hit) continue;
    const N = tr.normal(hit.P), c = clsOf(hit.id, hit.P, V.V || {});
    g.hit[i] = 1; g.id[i] = hit.id; g.cls[i] = c.cls; g.a[i] = c.a; g.phase[i] = c.phase || 0; g.depth[i] = hit.t;
    for (let k = 0; k < 3; k++) { g.P[i * 3 + k] = hit.P[k]; g.N[i * 3 + k] = N[k]; }
    if (c.cls >= 4) continue;
    g.vis[i * 3] = dot(N, moon) > 0 ? tr.shadow(hit.P, N, moon, 40, 10) : 0;
    let best = null, bd = 1e9; for (const L of glows) { const dd = Math.hypot(L.pos[0] - hit.P[0], L.pos[1] - hit.P[1], L.pos[2] - hit.P[2]); if (dd < bd) { bd = dd; best = L; } }
    if (best && bd < best.radius) { const v = [best.pos[0] - hit.P[0], best.pos[1] - hit.P[1], best.pos[2] - hit.P[2]]; g.vis[i * 3 + 2] = dot(v, N) > 0 ? tr.shadow(hit.P, N, [v[0] / bd, v[1] / bd, v[2] / bd], bd - 0.4, 8) : 0; }
    g.vis[i * 3 + 1] = 0;
  }
  return g;
}
if (!isMainThread) { const { placeUrl, vname, w, h, y0, y1 } = workerData, S = await load(placeUrl, vname); parentPort.postMessage({ y0, g: rows(S, w, h, y0, y1) }); }

export async function renderPalette(placeUrl, vname, W, H, workers = 6) {
  const w = W >> 1, h = H >> 1, band = Math.ceil(h / workers), parts = [];
  await Promise.all(Array.from({ length: workers }, (_, k) => new Promise((res, rej) => { const y0 = k * band, y1 = Math.min(h, y0 + band); if (y0 >= y1) { res(); return; } const wk = new Worker(new URL(import.meta.url), { workerData: { placeUrl, vname, w, h, y0, y1 } }); wk.on("message", (m) => { parts.push(m); wk.terminate(); res(); }); wk.on("error", rej); })));
  parts.sort((a, b) => a.y0 - b.y0);
  const g = { w, h }; for (const key of Object.keys(parts[0].g)) { const T = parts[0].g[key].constructor, per = parts[0].g[key].length / ((parts[0].g.hit.length)), a = new T(w * h * per); for (const p of parts) a.set(p.g[key], p.y0 * w * per); g[key] = a; }
  const PL = await import(rn("web/shaders/palettelight/palettelight.mjs")), LT = await import(rn("web/shaders/ditherlight/lights.mjs")), S = await load(placeUrl, vname);
  const plan = PL.resolvePalettelight({ lampPos: [0, -100, 0], moonDir: S.V.moonDir, ...(S.V.over || {}) });
  plan.lamp = LT.makeRadial({ pos: [0, -100, 0], radius: 0.1, core: 0.1, intensity: 0, wrap: 0 }); plan.glows = S.V.glows.map((p) => LT.makeRadial(p));
  const rgba = PL.runPalettelight(plan, g, S.V.time ?? 1.7).rgba, up = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = (Math.min(h - 1, y >> 1) * w + Math.min(w - 1, x >> 1)) * 4, d = (y * W + x) * 4; up[d] = rgba[s]; up[d + 1] = rgba[s + 1]; up[d + 2] = rgba[s + 2]; up[d + 3] = 255; }
  return { up, g };
}
