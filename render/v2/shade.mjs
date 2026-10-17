// Stage 1 of the plate bake: trace a place once and shade every weather and time variant from the
// same hit, through the engine's spectral sodium shading (web/shaders/sodium/shade.mjs shadePixel).
// Per pixel the lights are chosen from the place's whole list (any number), up to the engine's ten,
// by their contribution, so a quay can carry dozens of lamps and lit windows. Orthographic: each
// pixel's ray has its own origin, so the mist term is given that origin. Original glue code.
//   runShade({ placeUrl, W, H, variants: [name...], scale, outFiles, workers }) -> { ids, pid, nrm, depth, pos2 }
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { openSync, writeSync, closeSync } from "node:fs";
import { rn } from "../rn.mjs";
import { makeTracer, norm, dot } from "../sdf.mjs";
import { MATERIALS } from "../kit/ids.mjs";

export const GB = 40, MAXL = 10, TYPES = { sodium: 0, window: 1, led: 2, sky: 3 };

async function engine() {
  const spectra = await import(rn("web/shaders/sodium/spectra.mjs")), shade = await import(rn("web/shaders/sodium/shade.mjs")), cam = await import(rn("web/shaders/paintover/camera.mjs"));
  const index = Object.fromEntries(spectra.MATERIALS.map((m, i) => [m.name, i]));
  for (const m of MATERIALS) if (!(m.name in index)) { index[m.name] = spectra.MATERIALS.length; spectra.MATERIALS.push(m); }
  return { spectra, shade, cam, index };
}
export const camOf = (C, scale = 1) => ({ ...C, ortho: true, scale: C.H * scale / 2 / (C.ppm * scale) });

function band(P, E, cam, W, H, y0, y1, vnames, crop) {
  const FW = crop ? crop.FW : W, FH = crop ? crop.FH : H, OX = crop ? crop.x : 0, OY = crop ? crop.y : 0;
  const S = P.world, tr = makeTracer(S.map, S.idOf), V = vnames.map((n) => P.variants[n]);
  // the union of every variant's lights; per variant an intensity per light (0 when absent)
  const all = new Map();
  V.forEach((v, k) => { for (const L of P.lights(v.V || {})) { const key = L.key || `${L.pos.join(",")}|${L.type}`; if (!all.has(key)) all.set(key, { ...L, Iv: new Float64Array(V.length) }); const e = all.get(key); e.Iv[k] = L.I; e.reach = Math.max(e.reach || 30, L.reach || 30); } });
  const LA = [...all.values()].map((L) => ({ ...L, typeN: typeof L.type === "number" ? L.type : TYPES[L.type], cone: L.cone || [0, 0, 0], mode: L.mode || 0 }));
  const plans = V.map((v) => E.shade.resolveSodium({ impurity: 0.02, rain: 0, ambient: 0.03, mist: 0.003, extinct: 0.002, ...(v.plan || {}) }));
  const n = (y1 - y0) * W, hdr = V.map(() => new Float32Array(n * 3)), ids = new Uint8Array(n).fill(255), pid = new Uint8Array(n).fill(255), nrm = new Float32Array(n * 3), depth = new Float32Array(n).fill(1e4), pos = new Float32Array(n * 3);
  const rec = new Float64Array(GB), g1 = { w: 1, h: 1, data: rec, lights: null, cam: { pos: [0, 0, 0] } }, vis = new Float64Array(LA.length), cand = [];
  let skyO = null; const skyRec = (b, d, v) => { rec.fill(0, b, b + 12); rec[b + 6] = 1; rec[b + 3] = 0; rec[b + 7] = 0; rec[b + 8] = TYPES.sky; rec[b + 9] = P.sky(d, v.V || {}, skyO); rec[b + 10] = 200; rec[b + 11] = 0; };
  const surfRec = (b, hitP, N, id, t, v) => { const s = P.surf(id, hitP, N, v.V || {}); rec[b] = hitP[0]; rec[b + 1] = hitP[1]; rec[b + 2] = hitP[2]; rec[b + 3] = E.index[s.mat] ?? 0; rec[b + 4] = N[0]; rec[b + 5] = N[1]; rec[b + 6] = N[2]; rec[b + 7] = s.scale; rec[b + 8] = s.emit ? TYPES[s.emit.type] : -1; rec[b + 9] = s.emit ? s.emit.I : 0; rec[b + 10] = t; rec[b + 11] = 1; return s; };
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
    const k = (y - y0) * W + x, r = E.cam.ray(cam, FW, FH, x + OX, y + OY), d = r.d, o = r.o, hit = tr.march(o, d, P.tmax || 260);
    g1.cam.pos = o; skyO = o;
    if (!hit.hit) { pos[k * 3 + 1] = 1e3; V.forEach((v, j) => { skyRec(0, d, v); rec.set(d, 12); rec[15] = 0; g1.lights = []; const c = E.shade.shadePixel(plans[j], g1, 0, 0, 0); hdr[j].set(c, k * 3); }); continue; }
    const P0 = hit.P, N = tr.normal(P0), id = hit.id;
    ids[k] = id; pid[k] = P.paintId ? P.paintId(id, P0, S.propOf()) : id; nrm.set(N, k * 3); depth[k] = hit.t; pos.set(P0, k * 3);
    // which variants want a reflection here
    let want = false; const sv = V.map((v) => { const s = P.surf(id, P0, N, v.V || {}); if (s.wet > 0 && N[1] > 0.6) want = true; return s; });
    let rh = null, rr = null, Nr = null;
    if (want) {
      const j = P.ripple ? P.ripple(P0) : [0, 0], Nn = norm([N[0] + j[0], N[1], N[2] + j[1]]), c = -dot(d, Nn);
      rr = [d[0] + 2 * c * Nn[0], d[1] + 2 * c * Nn[1], d[2] + 2 * c * Nn[2]];
      const o2 = [P0[0] + N[0] * 0.01, P0[1] + N[1] * 0.01, P0[2] + N[2] * 0.01]; rh = tr.march(o2, rr, 90, 0.02); if (rh.hit) Nr = tr.normal(rh.P);
      rh.F = 0.04 + 0.96 * Math.pow(1 - Math.max(0, c), 5);
    }
    // candidate lights and their visibility, once for all variants
    cand.length = 0;
    for (let i = 0; i < LA.length; i++) { const L = LA[i], vx = L.pos[0] - P0[0], vy = L.pos[1] - P0[1], vz = L.pos[2] - P0[2], dl = Math.hypot(vx, vy, vz); if (dl > L.reach || vx * N[0] + vy * N[1] + vz * N[2] <= 0) continue; cand.push(i); vis[i] = -1; }
    V.forEach((v, j) => {
      const s = sv[j];
      // the strongest few lights for this variant at this point
      const sel = []; for (const i of cand) { const L = LA[i], I = L.Iv[j]; if (I <= 0) continue; const d2 = (L.pos[0] - P0[0]) ** 2 + (L.pos[1] - P0[1]) ** 2 + (L.pos[2] - P0[2]) ** 2; sel.push([I / Math.max(0.3, d2), i]); }
      sel.sort((a, b) => b[0] - a[0]); if (sel.length > MAXL) sel.length = MAXL;
      const lights = sel.map(([, i]) => { const L = LA[i]; return { pos: L.pos, type: L.typeN, I: L.Iv[j], cone: L.cone, mode: L.mode }; });
      surfRec(0, P0, N, id, hit.t, v); rec.set(d, 12);
      rec[15] = s.wet > 0 && N[1] > 0.6 && rh ? s.wet * Math.min(1, rh.F * 1.6 + 0.12) : 0;
      if (rec[15] > 0) { if (rh.hit) surfRec(16, rh.P, Nr, rh.id, rh.t, v); else { const so = skyO; skyO = null; skyRec(16, rr, v); skyO = so; } }
      sel.forEach(([, i], q) => { if (vis[i] < 0) { const L = LA[i], vx = L.pos[0] - P0[0], vy = L.pos[1] - P0[1], vz = L.pos[2] - P0[2], dl = Math.hypot(vx, vy, vz); vis[i] = tr.shadow(P0, N, [vx / dl, vy / dl, vz / dl], Math.min(dl - 0.35, 80), L.soft || 8); } rec[28 + q] = vis[i]; });
      g1.lights = lights;
      const c = E.shade.shadePixel(plans[j], g1, 0, 0, 0); hdr[j][k * 3] = c[0]; hdr[j][k * 3 + 1] = c[1]; hdr[j][k * 3 + 2] = c[2];
    });
  }
  return { hdr, ids, pid, nrm, depth, pos };
}

if (!isMainThread) {
  const { placeUrl, W, H, vnames, scale, crop } = workerData;
  const P = (await import(placeUrl)).default, E = await engine(), cam = E.cam.isoCamera({ ...P.camera, ortho: true, scale: P.camera.H / 2 / P.camera.ppm, dist: P.camera.dist || 60 });
  parentPort.on("message", (m) => { if (m.stop) { process.exit(0); } const r = band(P, E, cam, W, H, m.y0, m.y1, vnames, crop); parentPort.postMessage({ y0: m.y0, y1: m.y1, ...r }, [r.ids.buffer, r.pid.buffer, r.nrm.buffer, r.depth.buffer, r.pos.buffer, ...r.hdr.map((h) => h.buffer)]); });
  parentPort.postMessage({ ready: true });
}

// Trace and shade a whole plate on a worker pool. Variant frames go straight to files (Float32 RGB).
export async function runShade({ placeUrl, W, H, vnames, scale = 1, outFiles, workers = 6, rows = 8, log = () => {}, crop = null }) {
  const fds = outFiles.map((f) => openSync(f, "w")), n = W * H;
  const ids = new Uint8Array(n), pid = new Uint8Array(n), nrm = new Float32Array(n * 3), depth = new Float32Array(n), pos = new Float32Array(n * 3);
  let next = 0, done = 0; const t0 = Date.now();
  await Promise.all(Array.from({ length: workers }, () => new Promise((res, rej) => {
    const wk = new Worker(new URL(import.meta.url), { workerData: { placeUrl, W, H, vnames, scale, crop } });
    const give = () => { if (next >= H) { wk.postMessage({ stop: true }); res(); return; } const y0 = next; next = Math.min(H, next + rows); wk.postMessage({ y0, y1: next }); };
    wk.on("message", (m) => {
      if (m.ready) { give(); return; }
      const o = m.y0 * W; ids.set(m.ids, o); pid.set(m.pid, o); nrm.set(m.nrm, o * 3); depth.set(m.depth, o); pos.set(m.pos, o * 3);
      m.hdr.forEach((h, j) => writeSync(fds[j], new Uint8Array(h.buffer), 0, h.byteLength, o * 12));
      const before = done; done += m.y1 - m.y0; if (Math.floor(before * 20 / H) !== Math.floor(done * 20 / H)) log(`shade ${((100 * done) / H).toFixed(0)}% ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      give();
    });
    wk.on("error", rej);
  })));
  fds.forEach((fd) => closeSync(fd));
  return { ids, pid, nrm, depth, pos };
}
