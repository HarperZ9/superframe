// Spectral light pass for a Low Water scene: builds the G-buffer layout of the engine's sodium pass
// (web/shaders/fixtures/sodium-quay-render.mjs, 40 floats per pixel) from one of our SDF scenes,
// then runs the engine's own shading (web/shaders/sodium/shade.mjs runSodium) on it. Lights are
// low-pressure sodium, warm window (2700 K), white LED and sky (4100 K), as the engine defines.
// Our materials are appended to the engine's MATERIALS table before the response table is built,
// so every colour comes from the engine's spectral integration. Rows run on a small worker pool.
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { rn } from "./rn.mjs";
import { makeTracer, norm, dot } from "./sdf.mjs";

export const GB = 40, MAX_LIGHTS = 10;
const TYPES = { sodium: 0, window: 1, led: 2, sky: 3 };

async function loadEngine(scene) {
  const spectra = await import(rn("web/shaders/sodium/spectra.mjs")), shade = await import(rn("web/shaders/sodium/shade.mjs")), cam = await import(rn("web/shaders/paintover/camera.mjs"));
  const base = spectra.MATERIALS.length, index = Object.fromEntries(spectra.MATERIALS.map((m, i) => [m.name, i]));
  for (const m of scene.materials || []) if (!(m.name in index)) { index[m.name] = spectra.MATERIALS.length; spectra.MATERIALS.push(m); }
  return { spectra, shade, cam, index, base };
}

function buildRows(S, E, camera, w, h, y0, y1, time) {
  const tr = makeTracer(S.map, S.idOf), lights = S.lights(time).slice(0, MAX_LIGHTS), n = (y1 - y0) * w;
  const data = new Float64Array(n * GB), ids = new Uint8Array(n).fill(255), nrm = new Float32Array(n * 3);
  const put = (b, hit, d) => {
    if (!hit.hit) { data.set([0, 0, 0, 0, 0, 1, 0, 0, TYPES.sky, S.sky(d), 200, 0], b); return null; }
    const N = tr.normal(hit.P), s = S.surf(hit.id, hit.P, N, d, time);
    data.set([...hit.P, E.index[s.mat] ?? 0, ...N, s.scale, s.emit ? TYPES[s.emit.type] : -1, s.emit ? s.emit.I : 0, hit.t, 1], b);
    return { N, s };
  };
  for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) {
    const k = (y - y0) * w + x, b = k * GB, r = E.cam.ray(camera, w, h, x, y), d = r.d, hit = tr.march(r.o, d, 220);
    const L = put(b, hit, d); data.set(d, b + 12);
    if (!L) continue;
    ids[k] = S.paintId ? S.paintId(hit.id, hit.P) : hit.id; nrm.set(L.N, k * 3);
    // wet reflection: one ray about a slightly broken normal
    if (L.s.wet > 0 && L.N[1] > 0.6) {
      const jitter = S.ripple ? S.ripple(hit.P, time) : [0, 0], Nn = norm([L.N[0] + jitter[0], L.N[1], L.N[2] + jitter[1]]), c = -dot(d, Nn);
      const rr = [d[0] + 2 * c * Nn[0], d[1] + 2 * c * Nn[1], d[2] + 2 * c * Nn[2]], F = 0.04 + 0.96 * Math.pow(1 - Math.max(0, c), 5);
      data[b + 15] = L.s.wet * Math.min(1, F * 1.6 + 0.12);
      const o2 = [hit.P[0] + L.N[0] * 0.01, hit.P[1] + L.N[1] * 0.01, hit.P[2] + L.N[2] * 0.01], h2 = tr.march(o2, rr, 80, 0.02);
      put(b + 16, h2, rr);
    }
    if (L.s.scale > 0) for (let j = 0; j < lights.length; j++) {
      const Lp = lights[j].pos, v = [Lp[0] - hit.P[0], Lp[1] - hit.P[1], Lp[2] - hit.P[2]], dl = Math.hypot(v[0], v[1], v[2]);
      if (dl > (lights[j].reach || 40) || dot(v, L.N) <= 0) continue;
      data[b + 28 + j] = tr.shadow(hit.P, L.N, [v[0] / dl, v[1] / dl, v[2] / dl], dl - 0.35, 8);
    }
  }
  return { data, ids, nrm, lights };
}

if (!isMainThread) {
  const { sceneUrl, camera, w, h, y0, y1, time, plan } = workerData;
  const S = (await import(sceneUrl)).default, E = await loadEngine(S);
  const g = buildRows(S, E, camera, w, h, y0, y1, time);
  // rain streaks are drawn in post: shadePixel keys them to the frame height, and a worker sees one band
  const p = E.shade.resolveSodium({ ...plan, rain: 0 }), sub = { w, h: y1 - y0, data: g.data, lights: g.lights, cam: camera };
  const hdr = new Float64Array(w * (y1 - y0) * 4);
  for (let y = 0; y < y1 - y0; y++) for (let x = 0; x < w; x++) { const c = E.shade.shadePixel(p, sub, x, y, time), i = (y * w + x) * 4; hdr[i] = c[0]; hdr[i + 1] = c[1]; hdr[i + 2] = c[2]; hdr[i + 3] = 1; }
  parentPort.postMessage({ y0, y1, hdr, ids: g.ids, nrm: g.nrm }, [hdr.buffer, g.ids.buffer, g.nrm.buffer]);
}

// Render a scene through the engine's sodium shading. Returns { width, height, data (HDR RGBA f64), ids, nrm }.
export async function renderSpectral({ sceneUrl, camera, w, h, time = 0, plan = {}, workers = 6 }) {
  const n = Math.max(1, Math.min(workers, h)), band = Math.ceil(h / n), out = new Float64Array(w * h * 4), ids = new Uint8Array(w * h), nrm = new Float32Array(w * h * 3);
  await Promise.all(Array.from({ length: n }, (_, k) => new Promise((res, rej) => {
    const y0 = k * band, y1 = Math.min(h, y0 + band); if (y0 >= y1) { res(); return; }
    const wk = new Worker(new URL(import.meta.url), { workerData: { sceneUrl, camera, w, h, y0, y1, time, plan } });
    wk.on("message", (m) => { out.set(m.hdr, m.y0 * w * 4); ids.set(m.ids, m.y0 * w); nrm.set(m.nrm, m.y0 * w * 3); wk.terminate(); res(); });
    wk.on("error", rej);
  })));
  return { width: w, height: h, data: out, ids, nrm };
}
