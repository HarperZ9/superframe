// The G-buffer's curvature and cavity channels (render/raster.mjs, G.curv and G.cav; layout in
// design/STATE.md): each covered pixel is the barycentric blend of its triangle's per-vertex bytes, with
// the same weights as the bind point G.loc. Per-vertex bytes set to a linear function of the bind height
// must come back as that function of G.loc's height, within the vertex bytes' rounding; uncovered pixels
// keep 128 and 0; the sculpted head's own maps reach the pixels; bands give the whole render's channels.
// A control reads the bytes against the wrong axis and must fail.
//   LW_SCULPTED_HEADS=1 node characters/proto/curv_test.mjs
process.env.LW_SCULPTED_HEADS ??= "1";
import { readFile } from "node:fs/promises";
const { createCast } = await import("../runtime/actor.mjs");
const { renderJob } = await import("../runtime/figjob.mjs");
const { CAST } = await import("../runtime/castmap.mjs");
const { RIGS } = await import("../render/rigs.mjs");
const timing = JSON.parse(await readFile(new URL("../anim/timing.json", import.meta.url), "utf8"));
const cast = createCast({ timing, combat: null, members: CAST });
let fails = 0; const expect = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails++; };
const a = cast.actor("lamb"), h = 420, w = Math.ceil(h * 0.95), view = { yawDeg: 34, elevDeg: 34, height: 2.9, centre: [0, 1.05, 0] };
a.drive({ x: 0, z: 0, face: 1.1, pose: { anim: "idle", loop: true }, dt: 1 / 60 });
const job = a.prepare(view, w, h, RIGS.quay.rig, { tone: "sodium" }), m = a.mesh(job), M = m.M;
expect(!!M.headMaps, `the sculpted head carries its maps (${M.headMaps ? M.headMaps.n : 0} vertices)`);
// 1: the head's own maps reach the pixels
{ const r = renderJob(structuredClone(job), m, {}), G = r.G; let off = 0, cov = 0, outside = 0;
  for (let i = 0; i < G.id.length; i++) { if (G.id[i]) { cov++; if (G.curv[i] !== 128 || G.cav[i] !== 0) off++; } else if (G.curv[i] !== 128 || G.cav[i] !== 0) outside++; }
  expect(off > 0 && outside === 0, `head maps on ${off} of ${cov} covered pixels; ${outside} uncovered pixels off 128 and 0`); }
// 2: linear bytes in the bind height come back as that function of G.loc's height
const saved = M._maps, n = M.pos.length / 3, lin = (axis) => { const curv = new Uint8Array(n), cav = new Uint8Array(n); for (let v = 0; v < n; v++) { const y = M.loc[v * 3 + axis]; curv[v] = Math.round(40 + 100 * y); cav[v] = Math.round(230 - 100 * y); } return { n, curv, cav }; };
let ylo = Infinity, yhi = -Infinity; for (let v = 0; v < n; v++) { ylo = Math.min(ylo, M.loc[v * 3 + 1]); yhi = Math.max(yhi, M.loc[v * 3 + 1]); }
function check(axis) {
  M._maps = lin(axis); const r = renderJob(structuredClone(job), m, {}), G = r.G; let worst = 0, cov = 0;
  for (let i = 0; i < G.id.length; i++) if (G.id[i]) { cov++; const y = G.loc[i * 3 + 1]; worst = Math.max(worst, Math.abs(G.curv[i] - (40 + 100 * y)), Math.abs(G.cav[i] - (230 - 100 * y))); }
  return { worst, cov };
}
expect(40 + 100 * ylo >= 0 && 40 + 100 * yhi <= 255 && 230 - 100 * yhi >= 0 && 230 - 100 * ylo <= 255, `bind heights ${ylo.toFixed(2)} to ${yhi.toFixed(2)} m keep the test bytes in 0..255`);
{ const { worst, cov } = check(1); expect(worst <= 1.0001, `${cov} pixels: the blend matches G.loc's weights within ${worst.toFixed(3)} (vertex rounding allows 1)`); }
{ const { worst } = check(0); expect(worst > 5, `control: bytes from the wrong axis are off by up to ${worst.toFixed(1)}`); }
M._maps = saved;
// 3: bands give the whole render's channels
{ const r0 = renderJob(structuredClone(job), m, {}); let bad = 0;
  for (const K of [2, 3]) { const edges = Array.from({ length: K + 1 }, (_, k) => Math.round((k * h) / K));
    for (let k = 0; k < K; k++) { const jb = { ...structuredClone(job), band: [edges[k], edges[k + 1]] }, r = renderJob(jb, m, {}); for (let i = edges[k] * w; i < edges[k + 1] * w; i++) if (r.G.curv[i] !== r0.G.curv[i] || r.G.cav[i] !== r0.G.cav[i]) bad++; } }
  expect(bad === 0, `in 2 and 3 bands: ${bad} pixels' channels differ from the whole render`); }
if (fails) { console.log(`${fails} failed`); process.exit(1); }
