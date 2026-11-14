// The object-anchored brush painter (ART-DIRECTION 7.2) for figures. It repaints a figure the drawer
// has shaded, in place, as brush strokes stored in the figure's bind space:
//   - coarse to fine layers, each region with its own budget: boots and hats one coarse coat; coats
//     a coarse coat and a middle layer; collars, shirts and props middle and fine; faces and hands fine
//     and finest (CLASS, LAYERS). A stroke never crosses from one material into another.
//   - each layer's stroke size is set in screen pixels (LEVEL_PX) and turned into bind metres by the
//     figure's scale, in half-octave steps with hysteresis, so a figure at any distance is painted
//     with the same brush on screen, finer than the plate's (LOOK rule 4);
//   - a stroke's direction comes from the form, blended with the image's flow at its birth and then
//     fixed (flow.mjs); its paint is the mean lit colour of its pixels moved onto the palette's value
//     planes and glazed in pigment space (planes.mjs, km.mjs); bristles and a dry tail texture it.
// Walking, talking and fighting call the same function (the one figure drawer calls it).
//   const P = makePainter({ classOf, flowOf, groupOf }); P.paint(rgba, w, h, G, ss, ctx)
//   ctx: { key, ppm, yawDeg, palette, haze, anchor: "bind" | "screen" }   ("screen" is the shimmer control)
import { strokeAt, keyOf, centreOf, formDir, cellOf, bristle, U, resetRing, HALF_LEN, HALF_WID } from "./strokes.mjs";
import { birthDir } from "./flow.mjs";
import { paintOf } from "./planes.mjs";
import { rimOf, mass, formAccent, strokeLit } from "./rim.mjs";
import { paintRim } from "./edge.mjs";
import { glaze, ks, rOf, toLin, toByte } from "./km.mjs";
const kmMix = (a, b, t) => rOf(ks(a) * (1 - t) + ks(b) * t);

export const CLASS = { none: 0, broad: 1, cloth: 2, detail: 3, face: 4 };
export const LEVEL_PX = [11, 7, 4.5, 3];   // stroke length on screen per level (the plates brush 11, 6, 3.5, 2)
// per class: [level, covers every pixel]; the first layer is the ground coat
export const LAYERS = [null, [[0, true]], [[0, true], [1, false]], [[1, true], [2, false]], [[2, true], [3, false]]];
// how much of the drawer's own shading survives inside a stroke, per class (form at small sizes)
const KEEP = [0, 0.1, 0.12, 0.2, 0.5], SETTLE = 0.4, FACE_PUSH = 0.5, CEIL = 1.45, CATCH = 2.2, CATCH_K = 0.7;
const CL = [0, 0, 0], EMPTY = new Map();
// SLOT[level][class]: -1 the class is not painted at that level, 1 its ground coat, 2 a partial layer
const SLOT = [0, 1, 2, 3].map((L) => LAYERS.map((lay) => { const e = lay && lay.find(([lv]) => lv === L); return e ? (e[1] ? 1 : 2) : -1; }));

// Broken colour: each stroke's paint is mixed a little off its neighbours' (value and a warm or cool
// lean), fixed by the stroke's key, as a painter never reloads the brush with exactly one mix
const WARM = [1.0, 0.62, 0.32], COOL = [0.36, 0.40, 0.80], JB = [0, 0, 0];
export function broken(key, c, P, amount = 1) {
  const v = 1 + (U(key, 30) - 0.5) * 0.2 * amount, r = U(key, 31);
  glaze(c, r < 0.5 ? (P && P.light) || WARM : (P && P.shadowA) || COOL, 0.14 * amount * Math.abs(r - 0.5) * 2, 0, JB);
  c[0] = Math.min(1, JB[0] * v); c[1] = Math.min(1, JB[1] * v); c[2] = Math.min(1, JB[2] * v); return c;
}

export function makePainter({ classOf, flowOf, groupOf, toneOf = null, imageFlow = 0.4, gpu = null }) {
  // gpu (paint/gpu.mjs): the membership pass on the GPU; the CPU's strokeAt stays the reference and the fallback
  let memBuf = null, memF = null, pos4 = null; const slotId = new Float32Array(256);
  const actors = new Map();
  const st = (key) => { let a = actors.get(key); if (!a) actors.set(key, (a = { e: [null, null, null, null], dirs: new Map(), cache: new Map(), prev: new Map(), frame: 0 })); return a; };
  // the bind-space cell size for a level, in half-octave steps, kept until the ideal is 0.75 of a step away
  function cellSize(a, L, ppm, loose = 1) {
    const ideal = 2 * Math.log2((LEVEL_PX[L] * loose) / (2 * HALF_LEN * ppm));
    if (a.e[L] == null || Math.abs(ideal - a.e[L]) > 0.75) { a.e[L] = Math.round(ideal); a.cache.clear(); resetRing(); }
    return 2 ** (a.e[L] / 2);
  }
  const R = { key: 0, u: 0, v: 0, m: 0, ord: 0 }, cell = [0, 0, 0], cen = [0, 0, 0], form = [0, 0, 0];

  function paint(rgba, w, h, G, ss, ctx) {
    const DBG = globalThis.__lwPaintDebug || {};
    const t0 = performance.now(), a = st(ctx.key); a.frame++; if (a.prev.size > 40000) a.prev.clear();
    const screen = ctx.anchor === "screen", ppm = ctx.ppm, P = ctx.palette;
    const yaw = ((ctx.yawDeg || 0) * Math.PI) / 180, el = ((ctx.elevDeg ?? 30) * Math.PI) / 180, rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const V = [-Math.sin(yaw) * Math.cos(el), -Math.sin(el), -Math.cos(yaw) * Math.cos(el)], Ld = ctx.light || [-0.4, 0.8, 0.45];
    // the figure's pixels: where, which region, which bind point
    let n = 0; const idxA = new Int32Array(w * h), gisA = new Int32Array(w * h);
    for (let i = 0; i < w * h; i++) { if (!rgba[i * 4 + 3]) continue; const gi = ((i / w) | 0) * ss * G.w + (i % w) * ss; if (classOf[G.id[gi]]) { idxA[n] = i; gisA[n++] = gi; } }
    if (!n) return null;
    const maps = G.curv && G.cav && !DBG.noMaps ? true : false;
    const idx = idxA.subarray(0, n), gis = gisA.subarray(0, n), cls = new Uint8Array(n), pos = new Float32Array(n * 3);
    const base = new Float32Array(n * 3), out = new Float32Array(n * 3), lumB = new Float32Array(n), side = new Float32Array(n), graze = new Float32Array(n), lit = new Float32Array(n);
    for (let q = 0; q < n; q++) {
      const i = idx[q], gi = gis[q]; cls[q] = classOf[G.id[gi]];
      for (let c = 0; c < 3; c++) out[q * 3 + c] = base[q * 3 + c] = toLin(rgba[i * 4 + c]);
      lumB[q] = 0.2126 * base[q * 3] + 0.7152 * base[q * 3 + 1] + 0.0722 * base[q * 3 + 2];
      const nx = G.N[gi * 3], ny = G.N[gi * 3 + 1], nz = G.N[gi * 3 + 2];
      side[q] = nx * rx + nz * rz; graze[q] = 1 - Math.abs(nx * V[0] + ny * V[1] + nz * V[2]); lit[q] = nx * Ld[0] + ny * Ld[1] + nz * Ld[2];
      if (screen) { pos[q * 3] = ((ctx.ox || 0) + (i % w)) / ppm; pos[q * 3 + 1] = -((ctx.oy || 0) + ((i / w) | 0)) / ppm; pos[q * 3 + 2] = 0; }   // the control: strokes fixed to the screen
      else { pos[q * 3] = G.loc[gi * 3]; pos[q * 3 + 1] = G.loc[gi * 3 + 1]; pos[q * 3 + 2] = G.loc[gi * 3 + 2]; }
    }
    // the face's own mean value: face strokes are pushed apart from it (a face at play size is a few
    // strokes; its planes and accents must differ by more than the drawer's soft shading gives)
    let fs = 0, fn = 0; for (let q = 0; q < n; q++) if (cls[q] === CLASS.face) { fs += Math.log(Math.max(1e-4, lumB[q])); fn++; }
    const faceMean = fn ? Math.exp(fs / fn) : 0;
    // the figure's own mean value (the massing turns about it) and the ground's (the rim is set from it)
    let fl = 0; for (let q = 0; q < n; q++) fl += lumB[q]; fl /= n;
    const G0 = ctx.ground != null && ctx.ground > 0 ? ctx.ground : 0.03;
    const counts = [0, 0, 0, 0], firstMean = new Float32Array(n).fill(-1), trace = globalThis.__lwPaintTrace && globalThis.__lwPaintTrace.who === ctx.key ? new Uint32Array(n) : null;
    const dirs = screen ? null : a.dirs, cache = screen ? null : a.cache;
    const sk = new Uint32Array(n), su = new Float32Array(n), sv = new Float32Array(n), sa = new Float32Array(n), si = new Int32Array(n);
    let useGpu = !!gpu && !DBG.cpu;
    if (useGpu) {
      try {
        if (!pos4 || pos4.length !== w * h * 4) pos4 = new Float32Array(w * h * 4); else pos4.fill(0);
        for (let q = 0; q < n; q++) { const o = idx[q] * 4; pos4[o] = pos[q * 3]; pos4[o + 1] = pos[q * 3 + 1]; pos4[o + 2] = pos[q * 3 + 2]; pos4[o + 3] = G.id[gis[q]]; }
        gpu.begin(w, h, pos4);
      } catch (e) { console.warn(`paint: GPU unavailable (${e.message}); the CPU paints`); gpu = null; useGpu = false; }
    }
    for (let L = 0; L < 4; L++) {
      const s = cellSize(a, L, ppm, ctx.loose || 1), wpx = HALF_WID * s * ppm, nBr = Math.floor((2 * wpx) / 2);
      const slot = SLOT[L];   // per class: -1 not painted at this level, 1 ground coat, 2 partial
      let any = false; for (let c = 1; c < 5; c++) if (slot[c] > 0) any = true; if (!any) continue;
      // births: a stroke first seen this frame gets its direction now, fixed for good
      if (imageFlow > 0 && !screen) {
        const born = new Map();
        let pi = NaN, pj = 0, pk = 0, pg = -1;   // neighbouring pixels mostly share a cell: the same cell and group is looked up once
        for (let q = 0; q < n; q++) { if (slot[cls[q]] < 0) continue; const id = G.id[gis[q]], gr = groupOf[id]; cellOf(pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2], s, cell); if (cell[0] === pi && cell[1] === pj && cell[2] === pk && gr === pg) continue; pi = cell[0]; pj = cell[1]; pk = cell[2]; pg = gr; const k = keyOf(cell[0], cell[1], cell[2], L, gr); if (!a.dirs.has(k) && !born.has(k)) born.set(k, [q, cell[0], cell[1], cell[2], id]); }
        for (const [k, [q, i, j, kk, id]] of born) { centreOf(k, i, j, kk, s, cen); formDir(k, cen, flowOf[id], form); a.cache.delete(k); a.dirs.set(k, birthDir(rgba, w, h, G, ss, idx[q] % w, (idx[q] / w) | 0, form, imageFlow).slice()); }   // a copy: birthDir hands back the shared form array on a flat patch, and the next birth would rewrite this stroke's direction (the performance engineer's find)
        if (a.dirs.size > 60000) { a.dirs.clear(); a.cache.clear(); }   // a figure seen from every side holds a few thousand
        resetRing();
      }
      if (useGpu) gpu.dirs(screen ? EMPTY : a.dirs);   // the birth directions the GPU's frames read
      // membership on the GPU when it is there: every pixel's stroke for this layer in one pass, read back
      let mem = null;
      if (useGpu) {
        for (let id = 0; id < 256; id++) slotId[id] = slot[classOf[id]] ?? -1;
        try { mem = memBuf = gpu.membership(L, s, groupOf, flowOf, slotId, memBuf); if (!memF || memF.buffer !== mem.buffer) memF = new Float32Array(mem.buffer); }
        catch (e) { console.warn(`paint: GPU membership failed (${e.message}); the CPU paints`); gpu = null; useGpu = false; mem = null; }
      }
      // membership and each stroke's mean (sums in typed arrays, one index per stroke)
      const index = new Map(); let ns = 0, lastK = -1, lastI = -1;
      const cap = Math.min(n, 65536), sum = new Float32Array(cap * 8), face = new Uint8Array(cap), tone = new Float32Array(cap), keyAt = new Uint32Array(cap), fm = maps ? new Float32Array(cap * 2) : null;
      for (let q = 0; q < n; q++) {
        const sl = slot[cls[q]]; si[q] = -1; if (sl < 0) continue;
        const id = G.id[gis[q]], full = sl === 1;
        let r;
        if (mem) { const o = idx[q] * 4, m = memF[o + 3]; if (m <= -9) r = null; else { R.key = mem[o]; R.u = memF[o + 1]; R.v = memF[o + 2]; R.m = m; r = R; } }
        else r = strokeAt(pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2], s, L, groupOf[id], flowOf[id], full, dirs, R, cache);
        if (!r) continue;
        let k = r.key === lastK ? lastI : index.get(r.key);
        if (k === undefined) { if (ns >= cap) continue; k = ns++; index.set(r.key, k); face[k] = cls[q] === CLASS.face ? 1 : 0; tone[k] = toneOf ? toneOf[id] || 1 : 1; keyAt[k] = r.key; }
        lastK = r.key; lastI = k;
        sk[q] = r.key; su[q] = r.u; sv[q] = r.v; sa[q] = full ? 1 : Math.min(1, (r.m * wpx) / 2); si[q] = k;
        const o = k * 8; sum[o] += base[q * 3]; sum[o + 1] += base[q * 3 + 1]; sum[o + 2] += base[q * 3 + 2]; sum[o + 3] += side[q]; sum[o + 4]++; sum[o + 5] += graze[q]; sum[o + 6] += lit[q]; sum[o + 7] += G.N[gis[q] * 3 + 1];
        if (fm) { fm[k * 2] += G.curv[gis[q]]; fm[k * 2 + 1] += G.cav[gis[q]]; }
      }
      const col = new Float32Array(ns * 4), mean = [0, 0, 0];
      for (let k = 0; k < ns; k++) {
        const o = k * 8, c = sum[o + 4]; mean[0] = sum[o] / c; mean[1] = sum[o + 1] / c; mean[2] = sum[o + 2] / c;
        col[k * 4 + 3] = 0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2];
        mass(mean, sum[o + 6] / c, fl, mean);
        const pc = rimOf(broken(keyAt[k], paintOf(mean, sum[o + 3] / c, face[k], P, ctx.haze || 0, mean), P, ctx.brokenK || 1), sum[o + 5] / c, sum[o + 6] / c, ctx.ground, P); // the paint on a stroke settles over a few frames (a stroke seen in the last three frames
        // a catch-light from the world on a face in shade (a brim, a turned head): the planes that face the
        // eye and the lit ground below take the ground's light back, so a face at play size is a lit plane
        // beside a dark eye band, never a blank oval. Lamb is not lit by the lantern; this is bounce, from the ground
        if (face[k] && !DBG.noCatch) { const ny = sum[o + 7] / c, gz = sum[o + 5] / c, lm = 0.2126 * pc[0] + 0.7152 * pc[1] + 0.0722 * pc[2], want = CATCH * G0;
          if (ny < 0.35 && gz < 0.55 && lm < want) { const t = CATCH_K * Math.min(1, (0.35 - ny) / 0.5) * (1 - gz / 0.55), g = Math.min(3, 1 + ((want / Math.max(lm, 1e-5)) - 1) * t); glaze(pc, P.light, 0.25 * t, 0, CL); pc[0] = Math.min(1, CL[0] * g); pc[1] = Math.min(1, CL[1] * g); pc[2] = Math.min(1, CL[2] * g); } }
        if (face[k] && faceMean > 0) { const lm = col[k * 4 + 3], g = Math.min(2, Math.max(0.5, Math.pow(Math.max(1e-5, lm) / faceMean, FACE_PUSH))); pc[0] = Math.min(1, pc[0] * g); pc[1] = Math.min(1, pc[1] * g); pc[2] = Math.min(1, pc[2] * g); }
        if (!DBG.noStrokeLit && !screen) strokeLit(pc, sum[o + 6] / c, keyAt[k], P, ctx.strokeLit ?? 1);   // stroke light: the plates' rule on figures
        if (fm) formAccent(pc, (fm[k * 2] / c - 128) / 127, fm[k * 2 + 1] / c / 255, sum[o + 6] / c, face[k], P);   // R4: the sculptor's curvature and cavity, where the rasteriser carries them
        if (tone[k] !== 1) { pc[0] *= tone[k]; pc[1] *= tone[k]; pc[2] *= tone[k]; }   // accents: eyes and brows darker, as painted
        // moves 40% of the way to its new mix), so sub-pixel changes in which pixels a stroke covers never flicker it
        if (!screen) { const pr = a.prev.get(keyAt[k]); if (pr && a.frame - pr[3] <= 3) { for (let c = 0; c < 3; c++) pc[c] = pr[c] + (pc[c] - pr[c]) * (DBG.settle ?? SETTLE); } if (pr) { pr[0] = pc[0]; pr[1] = pc[1]; pr[2] = pc[2]; pr[3] = a.frame; } else a.prev.set(keyAt[k], Float32Array.of(pc[0], pc[1], pc[2], a.frame)); }
        col[k * 4] = pc[0]; col[k * 4 + 1] = pc[1]; col[k * 4 + 2] = pc[2];
      }
      counts[L] = ns;
      // lay the strokes: pigment over what is there (Kubelka-Munk), the drawer's own value kept a little inside each
      for (let q = 0; q < n; q++) {
        const k = si[q]; if (k < 0) continue;
        const full = slot[cls[q]] === 1; if (!full && (DBG.noPartial || (sum[k * 8 + 4] < 4 && !DBG.noSpeck))) continue;   // a speck in a partial layer: left to the coat below
        const Lm = col[k * 4 + 3], kk = KEEP[cls[q]], rel = Lm > 1e-5 ? Math.pow(Math.max(1e-4, lumB[q]) / Lm, kk) : 1;
        const B = bristle(sk[q], su[q], sv[q], nBr), m = (rel < 1.25 ? rel : 1.25) * B.k, t = sa[q] * B.cover;
        for (let c = 0; c < 3; c++) { let p = col[k * 4 + c] * m; if (p > 1) p = 1; out[q * 3 + c] = t >= 1 ? p : kmMix(out[q * 3 + c], p, t); }
        if (full && firstMean[q] < 0) { firstMean[q] = Lm; if (trace) trace[q] = sk[q]; }
      }
    }
    let mo = 0; for (let q = 0; q < n; q++) mo += 0.2126 * out[q * 3] + 0.7152 * out[q * 3 + 1] + 0.0722 * out[q * 3 + 2]; mo /= n;
    // the paint never brightens a figure on average: exposure is the drawer's (and its brightness guard's);
    // the painter moves value about inside the figure. A figure over CEIL times the ground is brought down to it
    const cap = Math.min(fl, CEIL * G0), down = mo > cap && cap > 0 ? cap / mo : 1;
    if (down < 1) for (let q = 0; q < n * 3; q++) out[q] *= down;
    // ink and eyes stay: a pixel much darker than its ground stroke was a line, and the line is kept over the paint
    // dark neighbours of a figure pixel (8 round it, in the drawer's own shading): ink lines keep theirs
    const qOf = new Int32Array(w * h).fill(-1); for (let q = 0; q < n; q++) qOf[idx[q]] = q;
    const darkNb = (q) => { const i = idx[q], x = i % w, y = (i / w) | 0, Lm = firstMean[q]; let c = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const r = qOf[Y * w + X]; if (r >= 0 && lumB[r] < 0.3 * Lm) c++; } return c; };
    const nearEdge = (q) => { const i = idx[q], x = i % w, y = (i / w) | 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h || !rgba[(Y * w + X) * 4 + 3]) return true; } return false; };
    const lumF = new Float32Array(n);
    for (let q = 0; q < n; q++) {
      const Lm = firstMean[q], i = idx[q];
      let keep = Lm > 0 ? (DBG.noInk ? 0 : Math.min(1, Math.max(0, (0.3 * Lm - lumB[q]) / (0.15 * Lm)))) : 1;
      if (keep > 0 && Lm > 0 && darkNb(q) < 2) keep = 0;   // a line has dark neighbours along it; a lone dark pixel is a speck, painted over
      if (keep < 1 && Lm > 0 && base[q * 3 + 2] > base[q * 3] && lumB[q] > 1.2 * Lm && nearEdge(q)) keep = 1;   // the drawer's cool back rim on the silhouette is kept, not averaged into the coat
      for (let c = 0; c < 3; c++) { const v = out[q * 3 + c] * (1 - keep) + base[q * 3 + c] * keep; out[q * 3 + c] = v; rgba[i * 4 + c] = toByte(v); }
      lumF[q] = 0.2126 * out[q * 3] + 0.7152 * out[q * 3 + 1] + 0.0722 * out[q * 3 + 2];
    }
    // the painted rim on the silhouette, toward the ruling lamp as it falls on the screen
    const up = [-rz * V[1], rz * V[0] - rx * V[2], rx * V[1]];   // camera up: right x forward (right = [rx, 0, rz])
    const rimPx = DBG.noRim ? 0 : paintRim(rgba, w, h, [Ld[0] * rx + Ld[2] * rz, -(Ld[0] * up[0] + Ld[1] * up[1] + Ld[2] * up[2])], G0, P);
    // face legibility: spread of the face's values (p90 - p10 over p90 + p10), unpainted and painted
    const spread = (arr) => { const v = []; for (let q = 0; q < n; q++) if (cls[q] === CLASS.face) v.push(arr[q]); if (v.length < 6) return null; v.sort((a, b) => a - b); const a = v[Math.floor(v.length * 0.1)], b = v[Math.floor(v.length * 0.9)]; return +((b - a) / Math.max(1e-6, a + b)).toFixed(3); };
    const faceStats = { px: fn, before: spread(lumB), after: spread(lumF) };
    const ms = performance.now() - t0, S = (globalThis.__lwPaintStats ||= {});
    let alphaSum = 0; for (let q = 0; q < n; q++) alphaSum += rgba[idx[q] * 4 + 3];
    S[ctx.key] = { ms: +ms.toFixed(2), px: n, ground: +G0.toFixed(4), rimPx, face: faceStats, rim: globalThis.__lwRimStats && globalThis.__lwRimStats.last, alpha: +(alphaSum / n / 255).toFixed(3), strokes: counts, cells: a.e.map((e) => (e == null ? null : +(2 ** (e / 2)).toFixed(4))), anchor: screen ? "screen" : "bind" };
    if (trace) globalThis.__lwPaintTrace.frames.push({ x0: ctx.ox || 0, y0: ctx.oy || 0, w, idx: Int32Array.from(idx), loc: Float32Array.from(Array.from(gis, (gi) => [G.loc[gi * 3], G.loc[gi * 3 + 1], G.loc[gi * 3 + 2]]).flat()), key: trace, base: Float32Array.from(lumB), out: lumF });
    return S[ctx.key];
  }
  // the unpainted drawer, recorded as paint() records (the stability measure's baseline)
  function trace(rgba, w, h, G, ss, info) {
    const T = globalThis.__lwPaintTrace; if (!T || T.who !== info.key) return null;
    const idx = [], loc = [], lb = [];
    for (let i = 0; i < w * h; i++) { if (!rgba[i * 4 + 3]) continue; const gi = ((i / w) | 0) * ss * G.w + (i % w) * ss; if (!classOf[G.id[gi]]) continue; idx.push(i); loc.push(G.loc[gi * 3], G.loc[gi * 3 + 1], G.loc[gi * 3 + 2]); lb.push(0.2126 * toLin(rgba[i * 4]) + 0.7152 * toLin(rgba[i * 4 + 1]) + 0.0722 * toLin(rgba[i * 4 + 2])); }
    const L = Float32Array.from(lb);
    T.frames.push({ x0: info.ox || 0, y0: info.oy || 0, w, idx: Int32Array.from(idx), loc: Float32Array.from(loc), key: new Uint32Array(idx.length), base: L, out: L });
    return null;
  }
  return { paint, trace, actors };
}
