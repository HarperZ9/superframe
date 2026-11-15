// Tests for The Quota's slice cast (cast/quota.mjs). node proto/quota_test.mjs
import assert from "node:assert/strict";
import * as Q1 from "../cast/quota.mjs";
import * as Q2 from "../cast/quota2.mjs";
const Q = { ...Q1, ...Q2 };
import { MATS } from "../rig/materials.mjs";
import { SCULPT } from "../cast/sculpt.mjs";

let n = 0; const ok = (name, f) => { f(); n++; console.log("ok", name); };
const members = Object.entries(Q).filter(([, m]) => m && m.build);
const ids = members.map(([k]) => k.toLowerCase());

ok("the slice cast is all there (07-PRODUCTION.md, the head sculptor's brief)", () => {
  for (const id of ["ned", "abel", "mary", "pell", "will", "tomas", "aaron", "anni", "captain", "edie", "davey", "rose", "bet", "gedge", "pask", "mott", "tesk", "ilo", "lil"]) assert.ok(ids.includes(id), id);
  for (const [k, v] of Object.entries(Q.ERA_IDS)) assert.ok(ids.includes(v), `${k} -> ${v}`);
});
ok("every member builds at every level of detail on The Quota's own head (not a forged head sheet), with a named idea", () => {
  for (const [k, m] of members) for (const lod of ["far", "mid"]) {
    const b = m.build({ lod }); assert.ok(b.M.tri.length > 3000, `${k} ${lod}`); assert.ok(b.M.parts.includes("head"), k); assert.ok(!b.M.headAnchors, `${k} should not take a forged head sheet`);
    assert.ok(m.info.quota.idea && m.info.quota.idea.length > 10, `${k} idea`);
  }
});
ok("era 2 dress: the Tarn in dark wool, the Hesh in felt with the blue thread at the wrist", () => {
  const usesMat = (m, name) => { const b = m.build({ lod: "far" }), id = MATS[name].id; return b.M.tri.some((v) => b.M.mat[v] === id); };
  for (const k of ["NED", "MARY", "ABEL", "WILL", "PELL"]) assert.ok(usesMat(Q[k], "wool"), `${k} wool`);
  for (const k of ["TOMAS", "AARON", "ANNI"]) { assert.ok(usesMat(Q[k], "felt"), `${k} felt`); assert.ok(usesMat(Q[k], "thread"), `${k} thread`); }
  // Ned's hat line: on the sculpted head (cast/sculpt.mjs) a paler band of skin above where the brim sat, painted
  // into the vertex colour; on the old head (SCULPT.on false) the hatline material
  const nb = Q.NED.build({ lod: "mid" }), sk = (SCULPT.on ? MATS.flesh : MATS.skin).id, hp = nb.M.parts.indexOf("head"); let pale = 0, plain = 0;
  for (let v = 0; v < nb.M.mat.length; v++) if (nb.M.part[v] === hp && nb.M.mat[v] === sk) { if (nb.M.col[v * 3] > 1.03 && nb.M.col[v * 3 + 2] > 1.0) pale++; else plain++; }
  assert.ok(SCULPT.on ? pale > 50 && plain > pale : usesMat(Q.NED, "hatline"), `Ned's hat line (${pale} pale skin vertices)`);
  const wb = Q.WILL.build({ lod: "mid" }); let wpale = 0; for (let v = 0; v < wb.M.mat.length; v++) if (wb.M.mat[v] === sk && wb.M.col[v * 3] > 1.03 && wb.M.col[v * 3 + 2] > 1.0) wpale++;
  assert.ok(!SCULPT.on || wpale < pale / 4, `control: Will has no hat line (${wpale})`);
});
ok("ages: Anni at fourteen and Pell at ten are smaller than their adult selves, the old Abel stoops", () => {
  assert.ok(Q.ANNI.P.h < Q.ANNI_ADULT.P.h * 0.95 && Q.PELL.P.h < Q.PELL_ADULT.P.h * 0.8);
  assert.ok(Q.PELL.P.head / Q.PELL.P.h > Q.PELL_ADULT.P.head / Q.PELL_ADULT.P.h, "a child's head is larger for the height");
  assert.ok(Q.ABEL.P.stoop >= Q.ABEL_ERA1.P.stoop + 15 && Q.ABEL.P.h < Q.ABEL_ERA1.P.h);
  const v = Q.ageVariant({ P: { h: 1.7, leg: 0.5, head: 0.26, neck: 0.12, shoulder: 0.18, hip: 0.13, arm: 0.76, stoop: 0 }, face: { nose: [0.06, 0.02, 0.2, 0] } }, 75);
  assert.ok(v.face.jowls > 0 && v.face.nose[0] > 0.06 && v.P.stoop > 0, "the old variant adds jowls, a longer nose and a stoop");
});
ok("material ids are unique (the new wool, felt, thread and hatline)", () => { const all = Object.values(MATS).map((m) => m.id); assert.equal(new Set(all).size, all.length); });
ok("the maker's age rule (16 and over gets the lid plane and socket) sees the right ages", () => {
  // checks the ages the rule reads, not the shapes themselves; the shapes are seen in the close-up sheet
  assert.ok((Q.NED.info.quota.age ?? 40) >= 16 && (Q.PELL.info.quota.age ?? 40) < 16 && (Q.ROSE.info.quota.age ?? 40) < 16);
});
console.log(`quota: ${n} of ${n} pass`);
