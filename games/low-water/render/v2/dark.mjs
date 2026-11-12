// The blackout plate: the engine's dither-quantised lighting (web/shaders/ditherlight: toneOf,
// quantise, the Bayer 8 thresholds, four tones, as the look bible chose) at half size, doubled to
// the plate. The engine's frame runner takes four lights for the whole frame; a quay in a blackout
// has more lanterns than that, so each pixel here carries its own four (the nearest that reach it)
// and is toned by the engine's per-pixel toneOf. Original glue code.
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { rn } from "../rn.mjs";
import { makeTracer, dot } from "../sdf.mjs";

async function load(placeUrl, which = "") {
  const P = (await import(placeUrl)).default, A = await import(new URL(`dark_scene.mjs?place=${encodeURIComponent(placeUrl)}${which ? `&which=${which}` : ""}`, import.meta.url).href), D = which ? P.dithers[which] : P.dark;
  const CAM = await import(rn("web/shaders/paintover/camera.mjs")), cam = CAM.isoCamera({ ...P.camera, ortho: true, scale: P.camera.H / 2 / P.camera.ppm, dist: P.camera.dist || 60 });
  return { P, A, CAM, cam, L: A.lights(), D };
}
function rows({ P, A, CAM, cam, L, D }, w, h, y0, y1) {
  const tr = makeTracer(P.world.map, P.world.idOf), n = (y1 - y0) * w;
  const g = { kind: new Uint8Array(n), albedo: new Float32Array(n), depth: new Float32Array(n), wpos: new Float32Array(n * 3), nrm: new Float32Array(n * 3), li: new Int16Array(n * 4).fill(-1), vis: new Float32Array(n * 4), haze: new Float32Array(n) };
  for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) {
    const i = (y - y0) * w + x, { o, d } = CAM.ray(cam, w, h, x, y), hit = tr.march(o, d, 260);
    if (D.haze) g.haze[i] = D.haze(o, d, hit.hit ? hit.t : 260);
    if (!hit.hit) { g.kind[i] = 0; g.albedo[i] = A.sky(d); g.depth[i] = 260; continue; }
    const N = tr.normal(hit.P), em = A.emissive(hit.id, hit.P);
    g.kind[i] = em ? 1 : 2; g.albedo[i] = em ? 1 : A.albedo(hit.id, hit.P); g.depth[i] = hit.t;
    for (let c = 0; c < 3; c++) { g.wpos[i * 3 + c] = hit.P[c]; g.nrm[i * 3 + c] = N[c]; }
    if (em) continue;
    const near = [];
    for (let k = 0; k < L.length; k++) { const v = [L[k].pos[0] - hit.P[0], L[k].pos[1] - hit.P[1], L[k].pos[2] - hit.P[2]], dl = Math.hypot(v[0], v[1], v[2]); if (dl > L[k].radius * 1.05 || dot(v, N) <= 0) continue; near.push([dl / (L[k].intensity || 1), k, v, dl]); }
    near.sort((a, b) => a[0] - b[0]);
    near.slice(0, 4).forEach(([, k, v, dl], q) => { g.li[i * 4 + q] = k; g.vis[i * 4 + q] = tr.shadow(hit.P, N, [v[0] / dl, v[1] / dl, v[2] / dl], dl - 0.4, 12); });
  }
  return g;
}
if (!isMainThread) {
  const { placeUrl, w, h, y0, y1, which } = workerData, S = await load(placeUrl, which), g = rows(S, w, h, y0, y1);
  parentPort.postMessage({ y0, g });
}

export async function renderDark(P, placeUrl, W, H, pv = 1, workers = 6, which = "") {
  const w = W >> 1, h = H >> 1, band = Math.ceil(h / workers), parts = [];
  await Promise.all(Array.from({ length: workers }, (_, k) => new Promise((res, rej) => {
    const y0 = k * band, y1 = Math.min(h, y0 + band); if (y0 >= y1) { res(); return; }
    const wk = new Worker(new URL(import.meta.url), { workerData: { placeUrl, w, h, y0, y1, which } });
    wk.on("message", (m) => { parts.push(m); wk.terminate(); res(); }); wk.on("error", rej);
  })));
  const DL = await import(rn("web/shaders/ditherlight/ditherlight.mjs")), TH = await import(rn("web/shaders/ditherlight/thresholds.mjs")), S = await load(placeUrl, which);
  const plan = DL.resolveDitherlight("tones4", { ink: [0.006, 0.004, 0.012], paper: [0.92, 0.89, 0.82], dark: 0.08, fogDist: 400, fogMax: 0, source: "bayer8", anchor: "screen", ...(S.D.plan || {}) }, { height: h, fov: 0.3 });
  const table = Array.from({ length: plan.levels }, (_, k) => DL.levelRgb8(plan, k)), up = new Uint8ClampedArray(W * H * 4), half = new Uint8ClampedArray(w * h * 3);
  const px = { vis: [0, 0, 0, 0], wpos: [0, 0, 0], nrm: [0, 0, 1], apos: [0, 0, 0], anrm: [0, 0, 1] }, Ls = [null, null, null, null];
  for (const { y0, g } of parts) {
    const rowsN = g.kind.length / w;
    for (let r = 0; r < rowsN; r++) for (let x = 0; x < w; x++) {
      const i = r * w + x, y = y0 + r; px.kind = g.kind[i]; px.albedo = g.albedo[i]; px.depth = g.depth[i]; px.haze = g.haze[i]; px.ix = x; px.iy = y;
      for (let c = 0; c < 3; c++) { px.wpos[c] = px.apos[c] = g.wpos[i * 3 + c]; px.nrm[c] = px.anrm[c] = g.nrm[i * 3 + c]; }
      let m = 0; for (let q = 0; q < 4; q++) { const k = g.li[i * 4 + q]; if (k < 0) break; Ls[m] = S.L[k]; px.vis[m] = g.vis[i * 4 + q]; m++; }
      const Y = DL.toneOf(plan, Ls.slice(0, m), px), [cx, cy] = TH.anchorCell(plan, px), k = DL.quantise(plan, Y, TH.thresholdAt(plan.source, cx, cy));
      half.set(table[k], (y * w + x) * 3);
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = (Math.min(h - 1, y >> 1) * w + Math.min(w - 1, x >> 1)) * 3, d = (y * W + x) * 4; up[d] = half[s]; up[d + 1] = half[s + 1]; up[d + 2] = half[s + 2]; up[d + 3] = 255; }
  return up;
}
