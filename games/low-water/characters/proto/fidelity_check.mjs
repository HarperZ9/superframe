// Body fidelity measures (characters/notes/FIDELITY.md): profile nose projection, hand size, torso
// silhouette, and cloth against the body in motion (legs through the coat or dress, the apron's lie).
//   node proto/fidelity_check.mjs [--json out/fidelity.json] [--who a,b]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { skin } from "../rig/body.mjs";
import { INDEX, JOINTS } from "../rig/skeleton.mjs";
import { solveFigure } from "../rig/solvefig.mjs";
import { MATS, BY_ID } from "../rig/materials.mjs";
import { roster } from "./heads_roster.mjs";
import * as lamb from "../cast/lamb.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const cf = new URL("../../game/engine/combat/out/timing.combat.json", import.meta.url), combat = existsSync(cf) ? JSON.parse(readFileSync(cf, "utf8")) : null;
const q = await roster("quota"), members = { lamb, ...q }, WHO = arg("--who", Object.keys(members).join(",")).split(",");
const SKIN = new Set(["skin", "cheek", "jawcool", "hatline", "scar"].map((n) => MATS[n].id)), PANT = new Set(["trouser", "wool", "felt", "goodwool", "patch", "grey", "black"].map((n) => MATS[n].id));
const dom = (M, v) => M.wj[v * 4];   // the vertex's heaviest joint
const J = (n) => INDEX[n];

function statics(C) {
  const m = C.build({ lod: "mid", tool: C.info?.tool || "hands" }), M = m.M, B = m.B, nv = M.pos.length / 3, P = C.P, R = 0.135 * (P.head / 0.26);
  const at = (v) => [M.pos[v * 3], M.pos[v * 3 + 1], M.pos[v * 3 + 2]], part = (n) => M.parts.indexOf(n);
  // nose: the furthest-forward skin point near the midline, against the cheeks' front at its height
  const hp = part("head"), head = []; for (let v = 0; v < nv; v++) if (M.part[v] === hp && SKIN.has(M.mat[v])) head.push(at(v));
  let tip = null; for (const p of head) if (Math.abs(p[0]) < 0.12 * R && (!tip || p[2] > tip[2])) tip = p;
  let cheek = -1e9; for (const p of head) if (Math.abs(p[0]) > 0.3 * R && Math.abs(p[0]) < 0.5 * R && Math.abs(p[1] - tip[1]) < 0.25 * R) cheek = Math.max(cheek, p[2]);
  // the open hand: length from the wrist, breadth, thickness (palm toward the body: x)
  const hh = part("handR.open"), w = B[J("handR")].p, hv = []; for (let v = 0; v < nv; v++) if (M.part[v] === hh) hv.push(at(v));
  const ext = (k) => Math.max(...hv.map((p) => p[k])) - Math.min(...hv.map((p) => p[k]));
  const hand = { len: Math.max(...hv.map((p) => w[1] - p[1])), breadth: ext(2), thick: ext(0) };
  // torso: shoulder breadth, the narrowest waist between hips and chest, hips (verts whose heaviest joint is the trunk)
  const body = []; for (let v = 0; v < nv; v++) if (M.part[v] === 0) body.push([at(v), dom(M, v)]);
  const pel = B[J("pelvis")].p[1], ch = B[J("chest")].p[1];
  const sh = Math.max(...body.filter(([, j]) => j === J("chest") || j === J("clavL") || j === J("clavR") || j === J("armL") || j === J("armR")).filter(([p]) => p[1] > ch).map(([p]) => Math.abs(p[0])));
  let waist = 1e9; for (let y = pel + 0.08; y < ch; y += 0.02) { const s = body.filter(([p, j]) => j === J("spine") && Math.abs(p[1] - y) < 0.012).map(([p]) => Math.abs(p[0])); if (s.length) waist = Math.min(waist, Math.max(...s)); }
  return { R, nose: (tip[2] - cheek) / R, noseCm: (tip[2] - cheek) * 100, hand: { len: hand.len / P.h, breadth: hand.breadth / P.h, thick: hand.thick / P.h }, waistToShoulder: waist / sh, mesh: m };
}

// cloth in motion: per frame, in the pelvis's frame, 15 degree bins, the cloth's radius at a height taken within 4 cm of it; a leg vertex outside the
// coat's or dress's surface in a bin the cloth covers is a poke-through; the apron's gap to what is under it
function cloth(who, C, m) {
  const cast = createCast({ timing, combat, members: { [who]: C } }), a = cast.actor(who, { tool: C.info?.tool || "hands" }), M = m.M, nv = M.pos.length / 3;
  const sk = M.parts.indexOf("skirt"), apronId = MATS.apron.id, apronPart = M.parts.indexOf("apron");
  const isApron = (v) => (apronPart >= 0 ? M.part[v] === apronPart : M.mat[v] === apronId);
  let poke = 0, frames = 0, gapMax = 0, inside = 0, apronN = 0;
  const seq = [[0, (x) => { x.play("walk", { force: true }); x.state.vWant = 1.4; }], [120, (x) => { x.play("run", { force: true }); x.state.vWant = 3.6; }], [200, (x) => x.playUpper("light_1")]];
  for (let f = 0; f < 240; f++) {
    for (const [t, fn] of seq) if (t === f) fn(a);
    a.update(1 / 60); if (f % 6) continue; frames++;
    const Sk = solveFigure(C, m, a.pose(), a.locksLocal()), S = skin(M, m.B, Sk), pl = Sk[J("pelvis")], Rt = pl.R;
    const loc = (v) => { const d = [S.pos[v * 3] - pl.p[0], S.pos[v * 3 + 1] - pl.p[1], S.pos[v * 3 + 2] - pl.p[2]]; return [Rt[0] * d[0] + Rt[3] * d[1] + Rt[6] * d[2], Rt[1] * d[0] + Rt[4] * d[1] + Rt[7] * d[2], Rt[2] * d[0] + Rt[5] * d[1] + Rt[8] * d[2]]; };
    const bin = (p) => Math.floor((Math.atan2(p[2], p[0]) + Math.PI) / (Math.PI / 12)), rad = (p) => Math.hypot(p[0], p[2]);
    // per angle bin, points [y, r]; a surface's radius at height y in a bin: the most out within 4 cm of y
    const cov = Array.from({ length: 24 }, () => []), und = Array.from({ length: 24 }, () => []);
    const at = (arr, b, y) => { let r = null; for (const [py, pr] of arr[(b + 24) % 24]) if (Math.abs(py - y) < 0.04) r = Math.max(r ?? 0, pr); return r; };
    for (let v = 0; v < nv; v++) { if (M.part[v] !== sk || isApron(v)) continue; const p = loc(v), e = [p[1], rad(p)]; cov[bin(p)].push(e); und[bin(p)].push(e); }
    for (let v = 0; v < nv; v++) {
      if (M.part[v] !== 0 || !PANT.has(M.mat[v])) continue; const j = dom(M, v); if (![J("thighL"), J("thighR"), J("shinL"), J("shinR")].includes(j)) continue;
      const p = loc(v), c = at(cov, bin(p), p[1]); if (c != null && rad(p) > c + 0.006) poke++;
      und[bin(p)].push([p[1], rad(p)]);
    }
    for (let v = 0; v < nv; v++) {
      if (!isApron(v)) continue; const p = loc(v), b = bin(p); let u = null;   // cloth bridges a stride: what is under it is the most out of the bins within 30 degrees
      for (let d = -2; d <= 2; d++) { const x = at(und, b + d, p[1]); if (x != null) u = Math.max(u ?? 0, x); } if (u == null) continue;
      const own = at(und, b, p[1]); if (own != null && rad(p) - own < -0.006) inside++;
      apronN++; gapMax = Math.max(gapMax, rad(p) - u);
    }
  }
  return { pokePerFrame: poke / frames, apronGapCm: apronN ? gapMax * 100 : null, apronInside: apronN ? inside / frames : null };
}

const rows = [];
for (const who of WHO) {
  const C = { ...members[who] }, s = statics(C), c = cloth(who, C, s.mesh); delete s.mesh;
  rows.push({ who, ...s, ...c });
  console.log(`${who.padEnd(11)} nose ${s.nose.toFixed(2)} R (${s.noseCm.toFixed(1)} cm)  hand ${(s.hand.len * 100).toFixed(1)}/${(s.hand.breadth * 100).toFixed(1)}/${(s.hand.thick * 100).toFixed(1)} %h  waist/shoulder ${s.waistToShoulder.toFixed(2)}  legs through cloth ${c.pokePerFrame.toFixed(1)}/frame${c.apronGapCm != null ? `  apron gap max ${c.apronGapCm.toFixed(1)} cm, inside ${c.apronInside.toFixed(1)}/frame` : ""}`);
}
const J2 = arg("--json", null); if (J2) writeFileSync(J2, JSON.stringify(rows, null, 1));
