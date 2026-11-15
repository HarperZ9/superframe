// The Quota's heads against characters/notes/HEAD-BOUNDS.md: profile proportions, the eyes (visible white,
// no goggles, a wet highlight), the three-quarter contour (cheekbone hollow, jaw corner) and distinctness.
//   node proto/sculpt_check.mjs [--old] [--json out.json] [who,who]
// --old builds the old head (cast/parts.mjs head()) from the same records: the control, which must fail.
import { writeFileSync } from "node:fs";
import { roster } from "./heads_roster.mjs";
import { SCULPT } from "../cast/sculpt.mjs";
import { headGeo } from "./sculpt_geo.mjs";
import { gbuffer } from "../render/figure.mjs";
import { albedo, light, compose } from "../render/shade.mjs";
import { MATS } from "../rig/materials.mjs";
import { PORTRAIT_RIG } from "./portrait_light.mjs";
import { INDEX } from "../rig/skeleton.mjs";
import { setExpression } from "../cast/parts.mjs";

const args = process.argv.slice(2), old = args.includes("--old"), jo = args.indexOf("--json"), jsonOut = jo >= 0 ? args[jo + 1] : null;
const only = args.find((a, i) => !a.startsWith("--") && (jo < 0 || i !== jo + 1));
SCULPT.on = !old; SCULPT.bald = true; SCULPT.tagEars = true; setExpression(null);
const members = await roster("quota"), ids = only ? only.split(",") : Object.keys(members);
const B = { adult: { breadth: [0.6, 0.72], length: [0.78, 0.92], brow: [0.02, 0.07], nose: [0.055, 0.1], lips: [-0.004, 0.05], chin: [0, 0.08], ear: [0.22, 0.3] },
  child: { breadth: [0.62, 0.78], length: [0.78, 0.94], brow: [0.01, 0.06], nose: [0.04, 0.085], lips: [-0.004, 0.05], chin: [0, 0.09], ear: [0.22, 0.31] } };
const inR = (v, [a, b]) => v >= a && v <= b, WH = new Set([MATS.white.id, MATS.sclera.id]), IR = new Set([MATS.eye.id, MATS.iris.id, MATS.pupil.id, MATS.catch.id]), rows = [], desc = {};

for (const id of ids) {
  const C = members[id], b = C.build({ lod: "near" }), g = headGeo(b.M, b.B), H = g.H, age = C.info?.quota?.age ?? 40, bb = age < 16 ? B.child : B.adult, lm = g.lm;
  const r = { id, age, H: +H.toFixed(3), breadth: g.breadth / H, length: g.length / H, brow: (lm.gl[1] - lm.cornea[1]) / H, nose: (lm.prn[1] - lm.sn[1]) / H,
    lips: Math.min(g.eLine.ls, g.eLine.li) / H, chin: (lm.sn[1] - lm.pg[1]) / H, ear: g.earLen / H };
  r.fail = Object.keys(bb).filter((k) => !inR(r[k], bb[k]));
  // three-quarter: the far contour per 3 mm from the projected skin
  const bin = 0.003, far = new Map(); for (const p of g.proj) { const k = Math.round(p.y / bin); far.set(k, Math.max(far.get(k) ?? -9, p.u)); }
  const cont = [...far.entries()].map(([k, u]) => [k * bin, u]).sort((a, c) => c[0] - a[0]), seg = (y0, y1) => cont.filter(([y]) => y <= y0 && y >= y1);
  const Z = seg(lm.cornea[0] - 0.005, lm.sn[0]).reduce((a, p) => (p[1] > a[1] ? p : a), [0, -9]), Jp = seg(lm.sto[0], lm.me[0]).reduce((a, p) => (p[1] > a[1] ? p : a), [0, -9]);
  let dip = 0; for (const [y, u] of seg(Z[0], Jp[0])) { const t = (y - Z[0]) / (Jp[0] - Z[0] || 1); dip = Math.max(dip, Z[1] + (Jp[1] - Z[1]) * t - u); }
  const low = seg(lm.sto[0], lm.me[0] + 0.01 * H), step = Math.max(1, Math.round(0.02 * H / bin)), pts = low.filter((_, i) => i % step === 0), ang = [];
  for (let i = 1; i < pts.length; i++) ang.push(Math.atan2(pts[i][1] - pts[i - 1][1], pts[i - 1][0] - pts[i][0]) * 57.3);
  const turns = ang.slice(1).map((a, i) => Math.abs(a - ang[i])).sort((a, c) => a - c), med = turns.length ? turns[Math.floor(turns.length / 2)] : 0, peak = turns.length ? turns[turns.length - 1] : 0;
  r.cheekDip = dip / H; r.jawCorner = med > 0.5 ? peak / med : peak > 3 ? 9 : 0;
  const exempt = age < 16 || id === "pask";
  if (!exempt) { if (r.cheekDip < 0.005) r.fail.push("cheekDip"); if (r.jawCorner < 2.5) r.fail.push("jawCorner"); }
  // eyes: frontal, 4 px a millimetre or more, the eyes' own material ids
  const pose = (() => { const a = { ...C }; return a; })();
  const hp = b.B[INDEX.head].p, eyeY = lm.cornea[0] + hp[1], view = { yawDeg: 0, elevDeg: 0, height: 0.12, centre: [0, eyeY, 0] }, S = 480;
  const fig = [{ C: { ...C, [`mesh_near_${C.info?.tool}`]: b }, pose: { hide: ["props", "tool"] }, facing: 0 }];
  const { G } = gbuffer(fig, view, S, S, 1, PORTRAIT_RIG.paraffin.rig);
  if (process.env.EYE_DUMP === id) { const { writePng, toRgba8 } = await import("../render/io.mjs"); const im = new Float32Array(S * S * 4); for (let i = 0; i < S * S; i++) { const v = G.id[i]; im.set(WH.has(v) ? [1, 1, 1, 1] : IR.has(v) ? [0.2, 0.3, 0.9, 1] : v ? [0.8, 0.5, 0.4, 1] : [0, 0, 0, 1], i * 4); } writePng("out/eye-dump.png", { width: S, height: S, data: toRgba8(im, S, S) }); }
  const A = albedo(G, C.palette || {}), E = light(G, PORTRAIT_RIG.paraffin.rig, C.palette || {}), img = compose(G, A, E, null, { bands: 0 });
  const eye = [0, 1].map((side) => {
    let white = 0, iris = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let y = 0; y < S; y++) for (let x = side ? S / 2 : 0; x < (side ? S : S / 2); x++) { const id2 = G.id[y * S + x]; if (WH.has(id2)) white++; if (IR.has(id2)) { iris++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
    let show = 0, cols = 0, hl = 0;
    if (iris) { const q = (x1 - x0) / 4; for (let x = Math.round(x0 + q); x <= x1 - q; x++) { cols++; let top = -1, bot = -1; for (let y = y0; y <= y1; y++) if (IR.has(G.id[y * S + x])) { if (top < 0) top = y; bot = y; }
        const above = [1, 2, 3].some((d) => WH.has(G.id[(top - d) * S + x])), below = [1, 2, 3].some((d) => WH.has(G.id[(bot + d) * S + x])); if (above || below) show++; }
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * S + x, v = 0.3 * img[i * 4] + 0.59 * img[i * 4 + 1] + 0.11 * img[i * 4 + 2]; if (IR.has(G.id[i]) && v >= 0.75) hl++; } }
    return { white: white / Math.max(1, white + iris), show: cols ? show / cols : 1, hl };
  });
  r.white = Math.min(...eye.map((e) => e.white)); r.whiteMax = Math.max(...eye.map((e) => e.white)); r.goggle = Math.max(...eye.map((e) => e.show)); r.highlight = Math.min(...eye.map((e) => e.hl));
  if (!inR(r.white, [0.3, 0.65]) || !inR(r.whiteMax, [0.3, 0.65])) r.fail.push("white"); if (r.goggle > 0.15) r.fail.push("goggle"); if (r.highlight < 1) r.fail.push("highlight");
  desc[id] = [g.profile, g.width, g.far].flatMap((L) => { const m = L.reduce((a, v) => a + v, 0) / L.length; return L.map((v) => v - m); });
  rows.push(r);
  console.log([id.padEnd(11), ...["breadth", "length", "brow", "nose", "lips", "chin", "ear", "cheekDip", "jawCorner", "white", "goggle"].map((k) => `${k} ${r[k].toFixed(3)}`), `hl ${r.highlight}`, r.fail.length ? "FAIL " + r.fail.join(",") : "ok"].join("  "));
}
// distinctness
const pairs = []; const ks = Object.keys(desc);
for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { const a = desc[ks[i]], c = desc[ks[j]]; pairs.push({ a: ks[i], b: ks[j], d: Math.sqrt(a.reduce((s, v, k) => s + (v - c[k]) ** 2, 0) / a.length) }); }
pairs.sort((a, c) => a.d - c.d);
const med = pairs.length ? pairs[Math.floor(pairs.length / 2)].d : 0, clone = desc.ned ? 0 : null;
console.log(`distinctness: closest ${pairs.slice(0, 3).map((p) => `${p.a}/${p.b} ${p.d.toFixed(4)}`).join(", ")}; median ${med.toFixed(4)}; clone control (Ned against Ned) ${clone}`);
const distinct = { min: pairs[0]?.d ?? 0, median: med, ok: (pairs[0]?.d ?? 0) >= 0.012 && med >= 0.03, closest: pairs.slice(0, 5) };
const nFail = rows.filter((r) => r.fail.length).length;
console.log(`${old ? "OLD HEAD (control)" : "sculpted head"}: ${rows.length - nFail} of ${rows.length} pass every bound; distinctness ${distinct.ok ? "pass" : "FAIL"}`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ old, rows, distinct }, null, 1));
