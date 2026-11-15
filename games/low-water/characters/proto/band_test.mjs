// A figure drawn in bands (runtime/figjob.mjs job.band, figure-core.mjs P.band and P.irr) against the same
// figure drawn whole: the shaded image, the occlusion mask and the G-buffer arrays the painting reads must
// be the same in every band's own rows, for 1 to 4 bands, with a smear, the self-shadow and an occluder.
//   node characters/proto/band_test.mjs        (exits non-zero on any difference)
import { readFile } from "node:fs/promises";
const root = new URL("../../", import.meta.url);
const { createCast } = await import("../runtime/actor.mjs");
const { renderJob } = await import("../runtime/figjob.mjs");
const { finishFigure } = await import("../runtime/figure-core.mjs");
const { medianOf } = await import("../runtime/expose.mjs");
const { CAST } = await import("../runtime/castmap.mjs");
const { RIGS } = await import("../render/rigs.mjs");
const timing = JSON.parse(await readFile(new URL("characters/anim/timing.json", root), "utf8"));
const cast = createCast({ timing, combat: null, members: CAST });
let fails = 0; const expect = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails++; };

const cases = [["lamb", { anim: "walk", loop: true }, 220], ["warden", { anim: "heavy", t: 0.3 }, 300], ["merrow", { anim: "talk_a", loop: true }, 560]];
for (const [who, pose, h] of cases) {
  const a = cast.actor(who); const w = Math.ceil(h * 0.95), view = { yawDeg: 34, elevDeg: 34, height: 2.9, centre: [0, 1.05, 0] };
  const jobs = [];
  for (let f = 0; f < 3; f++) { a.drive({ x: 0, z: 0, face: 1.1, pose: pose.t != null ? { ...pose, t: pose.t + f * 0.06 } : pose, dt: 1 / 60 }); jobs.push(a.prepare(view, w, h, RIGS.quay.rig, { tone: RIGS.quay.tone })); }
  const job = { ...jobs[2], tone: "sodium" }, m = a.mesh(job), stats = { mid: 0.06, hi: 0.03 };
  const post = { ss: 1, stats, sur: { mid: 0.07 }, look: new Set(["lift", "outline"]), seated: false, depth: 30, at: job.at, fw: [-0.46, -0.56, -0.69], ox: 400, oy: 200, truePpm: h / 2.9, yawDeg: 34, who, team: "town", person: true, split: true,
    depthAt: (sx, sy) => (sx > 400 + w * 0.55 && sy < 200 + h * 0.6 ? 1 : 1e9) };   // a post in front of the right half, upper part
  const r0 = renderJob(structuredClone(job), m, {}), d0 = new Uint8ClampedArray(w * h * 4), A0 = finishFigure(r0, post, {}, d0);
  for (const K of [1, 2, 3, 4]) {
    const edges = Array.from({ length: K + 1 }, (_, k) => Math.round((k * h) / K)), parts = [];
    for (let k = 0; k < K; k++) { const jb = { ...structuredClone(job), band: [edges[k], edges[k + 1]] }, r = renderJob(jb, m, {}), b = {}; parts.push({ jb, r, b, s: finishFigure(r, { ...post, band: jb.band }, b, new Uint8ClampedArray(w * h * 4)).samples }); }
    const irr = medianOf(parts.map((p) => p.s)); let bad = 0, n = 0;
    for (const p of parts) {
      const d = new Uint8ClampedArray(w * h * 4), A = finishFigure(p.r, { ...post, band: p.jb.band, irr }, p.b, d), [y0, y1] = p.jb.band;
      for (let i = y0 * w; i < y1 * w; i++) {
        n++;
        if (d[i * 4] !== d0[i * 4] || d[i * 4 + 1] !== d0[i * 4 + 1] || d[i * 4 + 2] !== d0[i * 4 + 2] || d[i * 4 + 3] !== d0[i * 4 + 3] || A.vis[i] !== A0.vis[i] || p.r.G.id[i] !== r0.G.id[i] || p.r.rgba[i * 4 + 3] !== r0.rgba[i * 4 + 3]) bad++;
        else for (let c = 0; c < 3; c++) if (p.r.G.N[i * 3 + c] !== r0.G.N[i * 3 + c] || p.r.G.loc[i * 3 + c] !== r0.G.loc[i * 3 + c] || p.r.G.wp[i * 3 + c] !== r0.G.wp[i * 3 + c]) { bad++; break; }
      }
    }
    expect(bad === 0 && n === w * h, `${who} ${w}x${h} in ${K} band(s): ${bad} of ${n} pixels differ from the whole render (image, mask, G-buffer)`);
  }
}
process.exit(fails ? 1 : 0);
