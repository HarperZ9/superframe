// The pixels of one figure, from a job its actor prepared (runtime/actor.mjs prepare): the G-buffer
// (rasterize), the tool's smear, the self-shadow, albedo, light, ink, the composed image, the place's
// tone, a drip. Pure: the drawer runs it on its own thread or a figure worker runs it, with the same
// result. buf: an object kept per figure; its arrays are reused frame to frame (pool).
//   const r = renderJob(job, mesh, buf)   -> { rgba, w, h, G, full, albedo }
import { INDEX, apply } from "../rig/skeleton.mjs";
import { spriteView, rasterize, makeG, placeFn, castShadow, toScreen } from "../render/raster.mjs";
import { albedo, light, ink, compose, sodiumTone } from "../render/shade.mjs";
import { down } from "../render/image.mjs";
import { tick, tock } from "./perf.mjs";
import { skin, skinVerts, groundShift } from "../rig/body.mjs";
import { PROP_IDS } from "../render/figure.mjs";

const SMEAR = 40;   // materials.mjs smear
// tones by name, so a job can cross to a worker (a function cannot)
export const TONES = { sodium: sodiumTone };
export const toneName = (fn) => (fn == null ? null : Object.keys(TONES).find((k) => TONES[k] === fn) || undefined);

// a job prepared with skinAt "worker" (runtime/actor.mjs): skin the solved skeleton and set the ground
// contact here, as prepare() would have; the smear's last frame is skinned for the tool's vertices only,
// and whole only when the tool swept far enough to be drawn (its ground contact needs every vertex)
export function resolveSkin(job, m) {
  if (job.skel) {
    const t = tick(), S = skin(m.M, m.B, job.skel), dy = groundShift(m.M, S, PROP_IDS, job.snap);
    job.S = { pos: S.pos, nrm: S.nrm }; job.dy = dy; job.at = [job.pos[0], job.pos[1] + dy, job.pos[2]]; job.skel = null; tock("skin", t);
  }
  const p = job.smear;
  if (p && p.skel) {
    const ti = m.M.parts.indexOf("tool");
    if (ti < 0) { job.smear = { pos: new Float32Array(job.S.pos.length), facing: p.facing, at: p.base }; return job; }   // nothing of it is read
    const vs = m.toolPartVerts || (m.toolPartVerts = (() => { const M = m.M, o = new Set(); for (let v = 0; v < M.part.length; v++) if (M.part[v] === ti) o.add(v); for (let q = 0; q < M.tri.length; q += 3) if (M.part[M.tri[q]] === ti) { o.add(M.tri[q]); o.add(M.tri[q + 1]); o.add(M.tri[q + 2]); } return Int32Array.from(o); })());
    const pos = skinVerts(m.M, m.B, p.skel, vs, new Float32Array(job.S.pos.length));
    let far = 0; for (let v = 0; v < m.M.part.length; v += 7) if (m.M.part[v] === ti) far = Math.max(far, Math.hypot(job.S.pos[v * 3] - pos[v * 3], job.S.pos[v * 3 + 1] - pos[v * 3 + 1], job.S.pos[v * 3 + 2] - pos[v * 3 + 2]));
    const d = far > 0.18 ? groundShift(m.M, skin(m.M, m.B, p.skel), PROP_IDS, p.snap) : 0;   // the at is read only for a drawn smear
    job.smear = { pos, facing: p.facing, at: [p.base[0], p.base[1] + d, p.base[2]] };
  }
  return job;
}

export function renderJob(job, m, buf = null) {
  resolveSkin(job, m);
  const { view, w, h, ss, bands, rig, palette, S, dy } = job, pos = job.pos, tone = typeof job.tone === "string" ? TONES[job.tone] : job.tone;
  const t0 = tick();
  const V = spriteView(view, { w: w * ss, h: h * ss, height: view.height, centre: view.centre }), G = makeG(w * ss, h * ss, buf && buf.G); if (buf) buf.G = G;
  const pl = placeFn(job.facing, job.at), hid = new Set(job.hid);
  // job.band [y0, y1) (ss 1): this worker's rows of the figure; G two rows more each side (the ink reads a
  // row round), the image one row more each side (the occlusion feather reads a row round)
  const B = job.band && ss === 1 ? job.band : null, gRows = B ? [Math.max(0, B[0] - 2), Math.min(h, B[1] + 2)] : null, cRows = B ? [Math.max(0, B[0] - 1), Math.min(h, B[1] + 1)] : null;
  tock("gbuf", t0); let t = tick();
  rasterize(V, m.M, S, G, pl, hid, null, 0, gRows); tock("raster", t); t = tick();
  // smear: when the tool sweeps far in one frame (a fast strike's two-frame hit window), draw it
  // again at points between last frame and this one, so the swing reads as an arc, not a jump
  const prev = job.smear;
  if (prev) {
    const ti = m.M.parts.indexOf("tool"); let far = 0;
    if (ti >= 0) for (let v = 0; v < m.M.part.length; v += 7) if (m.M.part[v] === ti) far = Math.max(far, Math.hypot(S.pos[v * 3] - prev.pos[v * 3], S.pos[v * 3 + 1] - prev.pos[v * 3 + 1], S.pos[v * 3 + 2] - prev.pos[v * 3 + 2]));
    if (far > 0.18) {
      const n = Math.min(20, Math.ceil(far / 0.03)), pplPrev = placeFn(prev.facing, prev.at), tmp = { pos: new Float32Array(S.pos.length), nrm: S.nrm };
      // only the tool's triangles are drawn, so only their vertices are blended (rasterize reads no
      // other); both ends of each vertex's path are placed once, not once a step
      const verts = m.toolVerts || (m.toolVerts = (() => { const M = m.M, o = new Set(); for (let q = 0; q < M.tri.length; q += 3) if (M.part[M.tri[q]] === ti) { o.add(M.tri[q]); o.add(M.tri[q + 1]); o.add(M.tri[q + 2]); } return Int32Array.from(o); })());
      const nv2 = verts.length, A3 = new Float64Array(nv2 * 3), B3 = new Float64Array(nv2 * 3);
      for (let j = 0; j < nv2; j++) { const v = verts[j], a = pplPrev.p([prev.pos[v * 3], prev.pos[v * 3 + 1], prev.pos[v * 3 + 2]]), b = pl.p([S.pos[v * 3], S.pos[v * 3 + 1], S.pos[v * 3 + 2]]); A3[j * 3] = a[0]; A3[j * 3 + 1] = a[1]; A3[j * 3 + 2] = a[2]; B3[j * 3] = b[0]; B3[j * 3 + 1] = b[1]; B3[j * 3 + 2] = b[2]; }
      const r = (job.facing * Math.PI) / 180, c = Math.cos(r), sn = Math.sin(r);
      // the swing turns about the hand: the pivot is the tool point that moved least, and every other point
      // goes round it on an arc (direction turned, length mixed), so the trail is the swept fan of the tool
      // and not a chord between two frames, which drew as a flat, broken triangle (2026-10-22)
      let pj = 0, pm = 1e9; for (let j = 0; j < nv2; j++) { const d = Math.hypot(B3[j * 3] - A3[j * 3], B3[j * 3 + 1] - A3[j * 3 + 1], B3[j * 3 + 2] - A3[j * 3 + 2]); if (d < pm) { pm = d; pj = j; } }
      const P0 = [A3[pj * 3], A3[pj * 3 + 1], A3[pj * 3 + 2]], P1 = [B3[pj * 3], B3[pj * 3 + 1], B3[pj * 3 + 2]];
      const D0 = new Float64Array(nv2 * 3), D1 = new Float64Array(nv2 * 3), ang = new Float64Array(nv2); let reach = 0;
      for (let j = 0; j < nv2; j++) for (let q = 0; q < 3; q++) { D0[j * 3 + q] = A3[j * 3 + q] - P0[q]; D1[j * 3 + q] = B3[j * 3 + q] - P1[q]; }
      for (let j = 0; j < nv2; j++) { const a0 = Math.hypot(D0[j * 3], D0[j * 3 + 1], D0[j * 3 + 2]), a1 = Math.hypot(D1[j * 3], D1[j * 3 + 1], D1[j * 3 + 2]); ang[j] = a0 > 1e-6 && a1 > 1e-6 ? Math.acos(Math.max(-1, Math.min(1, (D0[j * 3] * D1[j * 3] + D0[j * 3 + 1] * D1[j * 3 + 1] + D0[j * 3 + 2] * D1[j * 3 + 2]) / (a0 * a1)))) : 0; reach = Math.max(reach, ang[j] * Math.max(a0, a1)); }
      const steps = Math.min(48, Math.max(n, Math.ceil(reach / 0.015)));   // the tip moves at most 1.5 cm a copy: no gaps
      for (let k = 1; k < steps; k++) {
        const tt = k / steps;
        for (let j = 0; j < nv2; j++) {
          const v = verts[j], w = ang[j], s0 = w > 1e-4 ? Math.sin((1 - tt) * w) / Math.sin(w) : 1 - tt, s1 = w > 1e-4 ? Math.sin(tt * w) / Math.sin(w) : tt;
          const q0 = P0[0] + (P1[0] - P0[0]) * tt + D0[j * 3] * s0 + D1[j * 3] * s1, q1 = P0[1] + (P1[1] - P0[1]) * tt + D0[j * 3 + 1] * s0 + D1[j * 3 + 1] * s1, q2 = P0[2] + (P1[2] - P0[2]) * tt + D0[j * 3 + 2] * s0 + D1[j * 3 + 2] * s1;
          const dx = q0 - pos[0], dz = q2 - pos[2]; tmp.pos[v * 3] = c * dx - sn * dz; tmp.pos[v * 3 + 1] = q1 - (pos[1] + dy); tmp.pos[v * 3 + 2] = sn * dx + c * dz;
        }
        rasterize(V, m.M, tmp, G, pl, hid, ["tool"], SMEAR, gRows);
      }
    }
  }
  tock("smear", t); t = tick(); if (job.shadows) castShadow(G, m.M, S, pl, job.shadowDir, { hidden: hid, rows: cRows }); tock("selfshadow", t); t = tick();
  const A = albedo(G, palette, { buf, rows: cRows }); tock("albedo", t); t = tick(); const E = light(G, rig, palette, { buf, rows: cRows }); tock("light", t); t = tick(); const I = ink(G, { scale: ss, buf, rows: cRows }); tock("ink", t); t = tick(); const out = compose(G, A, E, I, { bands, buf, rows: cRows }); tock("compose", t); t = tick();
  if (tone) for (let i = cRows ? cRows[0] * G.w : 0, i1 = cRows ? cRows[1] * G.w : G.w * G.h; i < i1; i++) if (G.id[i]) out.set(tone([out[i * 4], out[i * 4 + 1], out[i * 4 + 2]]), i * 4);
  if (job.drip) drip(out, G, V, pl, job.drip.S, job.drip.joints, job.drip.t, cRows);
  const res = { ...down(out, G.w, G.h, ss), G, full: out, albedo: A.rgb }; tock("tone", t); return res;   // albedo (full resolution) lets a drawer read the light apart from the clothes
}

// Water dripping from a figure (Keel): drops fall from the given joints (a hand's fingertips, the
// cap's brim) under gravity, each a short pale streak lit like wet light, cycling forever.
function drip(out, G, V, pl, S, joints, t, rows = null) {
  const ppm = V.ppm, g = 9.8;
  joints.forEach((j, ji) => {
    const at = S[INDEX[j]]; if (!at) return;
    const o = j === "head" ? [0, 0.3, 0.14] : [0, -0.11, 0.02], base = pl.p(apply(at.R, o).map((v, k) => v + at.p[k]));
    for (let d = 0; d < 3; d++) {
      const per = 0.55 + 0.17 * ((ji * 3 + d) % 4), ph = (t + (ji * 0.37 + d * 0.41)) % per, fall = 0.5 * g * ph * ph;
      if (fall > base[1]) continue;
      const q = toScreen(V, [base[0] + (j === "head" ? (d - 1) * 0.06 : 0), base[1] - fall, base[2]]), len = Math.max(2, Math.min(10, g * ph * ppm * 0.012));
      for (let k = 0; k < len; k++) { const x = Math.round(q[0]), y = Math.round(q[1]) - k; if (x < 0 || y < 0 || x >= G.w || y >= G.h || (rows && (y < rows[0] || y >= rows[1]))) continue; const i = (y * G.w + x) * 4, a = 0.75 * (1 - k / len); out[i] = out[i] * (1 - a) + 0.85 * a; out[i + 1] = out[i + 1] * (1 - a) + 0.82 * a; out[i + 2] = out[i + 2] * (1 - a) + 0.75 * a; out[i + 3] = Math.max(out[i + 3], a); }
    }
  });
}
