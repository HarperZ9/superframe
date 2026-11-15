// Skinning in the worker (runtime/actor.mjs prepare skinAt "worker", runtime/figjob.mjs resolveSkin) against
// skinning here: two copies of each actor driven through the same frames, one prepared each way, must give
// the same image, G-buffer and ground contact in every frame, smear frames included, and with the two ways
// mixed frame to frame (a starved figure drawn here between worker frames).
//   node characters/proto/skin_test.mjs        (exits non-zero on any difference)
import { readFile } from "node:fs/promises";
const root = new URL("../../", import.meta.url);
const { createCast } = await import("../runtime/actor.mjs");
const { renderJob } = await import("../runtime/figjob.mjs");
const { CAST } = await import("../runtime/castmap.mjs");
const { RIGS } = await import("../render/rigs.mjs");
const timing = JSON.parse(await readFile(new URL("characters/anim/timing.json", root), "utf8"));
const cast = createCast({ timing, combat: null, members: CAST });
let fails = 0; const expect = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails++; };
const same = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && !(Number.isNaN(a[i]) && Number.isNaN(b[i]))) return false; return true; };

const cases = [["warden", "heavy", 300, "worker"], ["lamb", "heavy", 220, "worker"], ["warden", "heavy", 300, "mixed"], ["fewell", "walk", 260, "worker"]];
for (const [who, anim, h, way] of cases) {
  const A = cast.actor(who), B = cast.actor(who), w = Math.ceil(h * 0.95), view = { yawDeg: 34, elevDeg: 34, height: 2.9, centre: [0, 1.05, 0] };
  let bad = 0, smears = 0, frames = 0;
  for (let f = 0; f < 14; f++) {
    const drive = { x: 0.01 * f, z: 0, face: 1.1 + 0.02 * f, pose: anim === "walk" ? { anim, loop: true } : { anim, t: 0.05 + f * 0.07 }, dt: 1 / 60 };
    A.drive(drive); B.drive(drive);
    const ja = A.prepare(view, w, h, RIGS.quay.rig, { tone: "sodium" });
    const wayB = way === "mixed" ? (f % 3 === 1 ? "here" : "worker") : way;
    const jb = structuredClone(B.prepare(view, w, h, RIGS.quay.rig, { tone: "sodium", skinAt: wayB }));   // as it crosses to a worker
    if (wayB === "worker" && (jb.S || !jb.skel)) { bad++; continue; }
    const ra = renderJob(ja, A.mesh(ja), {}), rb = renderJob(jb, B.mesh(jb), {});
    frames++; if (ja.smear) { const ti = A.mesh(ja).M.parts.indexOf("tool"); let far = 0; const M = A.mesh(ja).M; for (let v = 0; v < M.part.length; v += 7) if (M.part[v] === ti) far = Math.max(far, Math.hypot(ja.S.pos[v * 3] - ja.smear.pos[v * 3], ja.S.pos[v * 3 + 1] - ja.smear.pos[v * 3 + 1], ja.S.pos[v * 3 + 2] - ja.smear.pos[v * 3 + 2])); if (far > 0.18) smears++; }
    const ok = ja.dy === jb.dy && same(ja.at, jb.at) && same(ra.rgba, rb.rgba) && same(ra.G.id, rb.G.id) && same(ra.G.N, rb.G.N) && same(ra.G.wp, rb.G.wp) && same(ra.G.loc, rb.G.loc);
    if (!ok) bad++;
  }
  expect(bad === 0, `${who} ${anim} ${way}: ${bad} of ${frames} frames differ (${smears} with a drawn smear)`);
}
expect(true, "done"); if (fails) { console.log(`${fails} failed`); process.exit(1); }
