// Tests for the head sculptor (forge/heads*.mjs, ART-DIRECTION 7.1). node proto/heads_test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DIRECTOR } from "../forge/heads.director.mjs";
import { HEAD_DEFAULT } from "../forge/anatomy.mjs";
import { SHEETS } from "../forge/heads.cast.mjs";
import { KEYS, validateHead, pastNatural, DEFAULTS } from "../forge/headkeys.mjs";
import { layersFor, limit, HEAD_CELL } from "../forge/detail.mjs";
import { ellExact, ellBound } from "../forge/ellipsoid.mjs";
import { headAlone, SCULPTED_HEADS } from "../forge/heads.mjs";
import { bakeMaps, exactDistance } from "../forge/maps.mjs";
import { packMesh, unpackMesh } from "../forge/meshio.mjs";
import { roster } from "./heads_roster.mjs";

let n = 0; const ok = (name, f) => { f(); n++; console.log("ok", name); };
const heads = JSON.parse(readFileSync(new URL("../../design/art/heads.json", import.meta.url), "utf8"));

ok("the director's records are copied unchanged from design/art/heads.json", () => {
  assert.deepEqual(DIRECTOR, heads.people);
  for (const [k, v] of Object.entries(heads.defaults)) assert.deepEqual(HEAD_DEFAULT[k], v, k);
});
ok("every slider reaches well past natural (at least twice the natural span) and holds the defaults", () => {
  for (const [k, { natural: [a, b], slider: [lo, hi] }] of Object.entries(KEYS)) {
    assert.ok(hi - lo >= 2 * (b - a) - 1e-9, `${k} slider too narrow`);
    const [key, i] = k.split("."), v = i == null ? DEFAULTS[key] : DEFAULTS[key][+i];
    assert.ok(v >= lo && v <= hi, `${k} default outside its slider`);
  }
});
ok("every sheet is valid: keys in range, one idea, a neck record and a collar record", () => {
  for (const [id, sh] of Object.entries(SHEETS)) assert.deepEqual(validateHead(sh), [], id);
  assert.ok(validateHead({ idea: "x", head: {}, neck: { visible_m: 0 } }).some((e) => e.includes("collar")), "a sheet without a collar must fail");
});
ok("the principals sit past natural on several keys", () => {
  for (const id of ["keel", "lamb", "sabine", "wenna", "penhallow", "gorm", "hobb", "marrow"]) assert.ok(pastNatural({ ...DEFAULTS, ...SHEETS[id].head }).length >= 3, id);
});
ok("no two people share a head: every pair differs by a fifth of a slider on three keys or more", () => {
  const ids = Object.keys(SHEETS), val = (h, k) => { const [a, i] = k.split("."), v = h[a] ?? DEFAULTS[a]; return i == null ? v : v[+i]; };
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const A = SHEETS[ids[i]].head, B = SHEETS[ids[j]].head; let far = 0;
    for (const [k, { slider: [lo, hi] }] of Object.entries(KEYS)) if (Math.abs(val(A, k) - val(B, k)) > 0.2 * (hi - lo)) far++;
    const hairDiffers = (SHEETS[ids[i]].hair?.style || "bald") !== (SHEETS[ids[j]].hair?.style || "bald") || (SHEETS[ids[i]].beard?.style || "") !== (SHEETS[ids[j]].beard?.style || "");
    assert.ok(far + (hairDiffers ? 1 : 0) >= 3, `${ids[i]} and ${ids[j]} differ on only ${far} keys`);
  }
});
ok("displacement stays below the alias limit at every level of detail, and a layer above it is dropped", () => {
  let dropped = 0;
  for (const sh of Object.values(SHEETS)) for (const lod of Object.keys(HEAD_CELL)) { const r = layersFor(sh.detail || [], lod); for (const d of r.keep) assert.ok(d.freq <= limit(lod), `${d.t} at ${lod}`); dropped += r.dropped.length; }
  assert.ok(dropped > 0);
  assert.equal(layersFor([{ t: "creases", amp: 0.001, freq: 1000 }], "near").keep.length, 0);
});
ok("the exact ellipsoid distance is never more than the distance to sampled surface points, and the bound is off", () => {
  const R = [0.08, 0.135, 0.098], pts = []; let r = 7; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 20000; i++) { const u = rnd() * 2 * Math.PI, v = Math.acos(2 * rnd() - 1); pts.push([R[0] * Math.sin(v) * Math.cos(u), R[1] * Math.cos(v), R[2] * Math.sin(v) * Math.sin(u)]); }
  let worstOver = 0, worstUnder = 0, boundErr = 0;
  for (let t = 0; t < 150; t++) {
    const p = [(rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.4]; let b = 1e9; for (const q of pts) b = Math.min(b, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
    const e = Math.abs(ellExact(...p, ...R)); worstOver = Math.max(worstOver, e - b); worstUnder = Math.max(worstUnder, b - e); boundErr = Math.max(boundErr, Math.abs(Math.abs(ellBound(...p, ...R)) - b));
  }
  assert.ok(worstOver < 1e-6, `exact exceeds the sampled distance by ${worstOver}`);
  assert.ok(worstUnder < 0.004, `exact under the sampled distance by ${worstUnder}`);
  assert.ok(boundErr > 0.005, "the bound should differ (else this test proves nothing)");
});
const members = await roster();
ok("a head bakes to .lwmesh with its three maps and reads back whole", () => {
  const { M, model } = headAlone("penhallow", members.penhallow.P, { lod: "far" });
  const maps = bakeMaps({ pos: M.pos, nrm: M.nrm, tri: M.tri }, model.F.d), back = unpackMesh(packMesh({ M, grips: null, hands: null, tool: null, meta: { id: "penhallow" } }, maps), null);
  assert.equal(back.M.tri.length, M.tri.length); assert.deepEqual(Object.keys(back.maps), ["curvature", "thickness", "cavity"]);
  assert.equal(back.maps.cavity.length, M.pos.length / 3); assert.ok(back.maps.thickness.every((v) => v > 0 && v <= 0.0501));
  const again = headAlone("penhallow", members.penhallow.P, { lod: "far" });
  assert.equal(again.M.tri.length, M.tri.length, "sculpting is deterministic");
});
ok("the maps' signed exact distance agrees with the field's side at least 99 percent of the time", () => {
  const { M, model } = headAlone("keel", members.keel.P, { lod: "mid" }), d = exactDistance({ pos: M.pos, nrm: M.nrm, tri: M.tri }, { signed: true });
  let r = 3, bad = 0, total = 0; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 1500; k++) { const v = Math.floor(rnd() * M.pos.length / 3), h = (rnd() * 2 - 1) * 0.03, q = [0, 1, 2].map((i) => M.pos[v * 3 + i] + M.nrm[v * 3 + i] * h), a = d(...q), f = model.F.d(...q); if (a == null || Math.abs(f) < 0.001) continue; total++; if (Math.sign(a) !== Math.sign(f)) bad++; }
  assert.ok(total > 1000 && bad / total < 0.01, `${bad} of ${total}`);
});
ok("cast members build with the sculpted head and its drawn collar; people without a sheet keep the old head", () => {
  if (!SCULPTED_HEADS) { for (const id of ["keel", "lamb", "penhallow"]) { const b = members[id].build({ lod: "far" }); assert.ok(b.M.parts.includes("head") && !b.M.headAnchors, id); } return; }
  for (const id of ["keel", "lamb", "penhallow"]) { const b = members[id].build({ lod: "far" }); assert.ok(b.M.parts.includes("head") && b.M.parts.includes("collar"), id); assert.ok(b.M.headAnchors?.mouth, id); }
  const w = members.warden?.build?.({ lod: "far" }); if (w) assert.ok(w.M.parts.includes("head") && !w.M.headAnchors);
});
{
  const { headModel } = await import("../forge/heads.mjs"), P = members.wenna.P, base = headModel("wenna", P, { lod: "far" }), H = base.HP, s = base.s;
  const at = (m, p) => m.F.d(...p), mouth = [0, (H.mouth_y - 0.012) * s, H.mouth_z * s];   // inside the closed lower lip, in the gap when the jaw opens
  assert.equal(at(headModel("wenna", P, { lod: "far", expr: { brow: 0, lids: 0, corners: 0, jaw: 0 } }), mouth), at(base, mouth));
  assert.ok(at(base, mouth) < 0 && at(headModel("wenna", P, { lod: "far", expr: { jaw: 1 } }), mouth) > 0, "an open jaw opens the mouth");
  const { MATS } = await import("../rig/materials.mjs"), browY = (expr) => { const { M } = headAlone("gorm", members.gorm.P, { lod: "near", expr }); let y = 0, k = 0; for (let v = 0; v < M.mat.length; v++) if (M.mat[v] === MATS.brow.id) { y += M.pos[v * 3 + 1]; k++; } return y / k; };
  assert.ok(browY({ brow: 1 }) > browY({}) + 0.008, "raised brows move up");
  n++; console.log("ok expression sliders (checked: zero is neutral, the jaw opens, the brows rise)");
}
{
  const { checkRules } = await import("../forge/headrules.mjs"), bad = [];
  for (const [id, sh] of Object.entries(SHEETS)) { const b = members[id].build({ lod: "far" }), r = checkRules(sh, b.M.headNeck); if (r.errors.length) bad.push(`${id}: ${r.errors.join("; ")}`); }
  assert.deepEqual(bad, [], "every head inside human proportions or a named exaggeration");
  assert.ok(checkRules({ head: { neck_r: 0.02, jaw_w: 0.06 } }).errors.some((e) => e.startsWith("neck_width")), "a stalk neck must fail");
  assert.equal(checkRules({ head: { neck_r: 0.02, jaw_w: 0.06 }, exaggerate: { neck_width: "test" } }).errors.length, 0, "a named exaggeration is waived");
  n++; console.log("ok proportion rules: every head inside human ranges or a named exaggeration, and a stalk neck fails");
}
{
  const C = members.penhallow, a = C.build({ lod: "mid" }), b = C.build({ lod: "mid", tool: "hands" });   // the second replays the cached head
  const headOf = (M) => { const hi = M.parts.indexOf("head"), out = []; for (let v = 0; v < M.part.length; v++) if (M.part[v] === hi) out.push(M.pos[v * 3], M.pos[v * 3 + 1], M.pos[v * 3 + 2], M.col[v * 3], M.mat[v]); return out; };
  assert.deepEqual(headOf(b.M), headOf(a.M), "a cached head replays exactly");
  if (SCULPTED_HEADS) assert.ok(b.M.headAnchors && b.M.headMaps && b.M.headMaps.v0 >= 0);
  n++; console.log("ok a cached head replays exactly (positions, paint, materials, anchors, maps)");
}
console.log(`heads: ${n} of ${n} pass`);
