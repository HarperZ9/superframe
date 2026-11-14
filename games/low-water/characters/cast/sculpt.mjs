// The Quota's sculpted head (2026-10-22, characters/notes/HEAD-BOUNDS.md): the head built from its planes in
// the classic construction (Loomis's ball with its sides cut flat, Asaro's planes) as signed distance shapes,
// polygonised by the forge's narrow-band mesher (forge/sdf.mjs, forge/mesher.mjs). It takes the same face
// record as the old head (cast/parts.mjs head(): skull, faceLen, jaw, jawCorners, chin, cheekbones, cheekR,
// eyes, eyeX, socket, lids, browT, browW, browShape, nose [len, width, droop, hook], noseBend, bridge,
// noseFlat, bulb, lips, mouth, mouthCut, lines, jowls, hunger, scar, teeth, gaps, hairTex, stubble) plus age,
// sex, moustache [w, t], earOut and iris, and the same expression object (setExpression), so moods carry over.
//   sculptHead(M, B, P, o) -> the head's centre (the old head's c, so hats and props sit as before)
// Units inside: R (the old head's radius), origin c = head joint + [0, 0.9 R, 0.05 R], +z forward, +y up.
// Colour is the skin's own: one skin material across the face, the lips a step off it, and a painter's
// three zones (a golden forehead, a ruddy middle, a cooler jaw) as a soft vertex tint, never a disc.
import { prepare, polygonise } from "../forge/mesher.mjs";
import { faceMaps } from "../forge/heads.mjs";
import { HEAD_CELL } from "../forge/detail.mjs";
import { limb, INDEX } from "../rig/body.mjs";
import { MATS } from "../rig/materials.mjs";
import { hairShapes, hairPaint } from "./sculpt_hair.mjs";
import { currentExpr } from "./parts.mjs";
import { faceShapes } from "./sculpt_face.mjs";
import { withIdea } from "./sculpt_ideas.mjs";
import { authoredHead } from "../forge/authored.mjs";

export const SCULPT = { on: true, bald: false, tagEars: false };   // bald and tagEars: the measures (proto/sculpt_check.mjs) read the skull under the hair and find the ears
const KS = 3, CELL = { near: 0.002, mid: 0.006, far: 0.014 };   // finer than the forge's heads at near: the lids' margins   // blend widths: the shapes' k values are written for planes that meet, this sets how softly   // proto/sculpt_check.mjs --old turns it off (the control)
const J = (B, j) => B[INDEX[j]].p, sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const CACHE = new Map(), ARRS = ["pos", "nrm", "mat", "wj", "ww", "loc", "col"];
export function sculptHead(M, B, P, o, lod = "far") {
  if (SCULPT.authored && SCULPT.authored[o.id]) return authoredHead(M, B, o, lod, SCULPT.authored[o.id]);   // a hand-built head from tools/asset replaces the generated one
  if (SCULPT.seen) SCULPT.seen[o.id] = o;
  const EXPR = currentExpr(), key = [o.id, lod, JSON.stringify(EXPR || {}), JSON.stringify(P), JSON.stringify(o), SCULPT.bald, SCULPT.tagEars].join("|"), hit = CACHE.get(key);
  if (hit) return replay(M, hit);
  const v0 = M.pos.length / 3, t0 = M.tri.length, res = build(M, B, P, o, lod, EXPR), rec = { res };
  for (const k of ARRS) rec[k] = M[k].slice(v0 * (M[k].length / (M.pos.length / 3)));
  rec.part = M.part.slice(v0).map((p) => M.parts[p]); rec.tri = M.tri.slice(t0).map((v) => v - v0);
  rec.maps = M.headMaps ? { ...M.headMaps, v0: M.headMaps.v0 - v0 } : null;
  if (CACHE.size > 24) CACHE.delete(CACHE.keys().next().value);   // a near head is about 10 MB of arrays: keep the last few
  CACHE.set(key, rec); return res;
}
function replay(M, rec) {
  const base = M.pos.length / 3, prev = M.cur;
  for (const k of ARRS) { const dst = M[k], src = rec[k]; for (let i = 0; i < src.length; i++) dst.push(src[i]); }
  const ids = new Map(); for (const name of rec.part) if (!ids.has(name)) { M.begin(name); ids.set(name, M.cur); }
  for (const name of rec.part) M.part.push(ids.get(name));
  for (const v of rec.tri) M.tri.push(v + base);
  M.cur = prev; if (rec.maps) M.headMaps = { ...rec.maps, v0: rec.maps.v0 + base };
  return rec.res;
}

function build(M, B, P, o, lod, EXPR) {
  const R = o.r, hj = J(B, "head"), nj = J(B, "neck"), c = [hj[0], hj[1] + R * 0.9, hj[2] + R * 0.05], prev = M.cur;
  M.begin("head");
  // the body's neck tube from the collar up into the skull, as the old head has it
  limb(M, B, "neck", "head", o.neck || 0.055, (o.neck || 0.055) * 0.92, MATS[o.skin || "flesh"].id, { rings: 4, seg: 12, over: 0.15 });
  const neckY = (nj[1] - c[1]) / R - 0.15;   // R units: the neck shapes reach down to the collar
  const oi = withIdea(o), face = faceShapes(SCULPT.tagEars ? { ...oi, earMat: "hatline" } : oi, EXPR || {}, { neckY, neckR: (o.neck || 0.055) / R });
  // R units to metres in bind space
  const toM = (s) => { const q = { ...s, k: (s.k ?? 0.02) * R * (s.op === "add" && s.t !== "fn" ? KS : s.op === "sub" && s.t !== "fn" ? 1.5 : 1), bias: (s.bias || 0) * R };
    if (s.c) q.c = s.c.map((v, i) => c[i] + v * R); if (s.a) q.a = s.a.map((v, i) => c[i] + v * R); if (s.b) q.b = s.b.map((v, i) => c[i] + v * R);
    if (s.t === "ell" || s.t === "box") q.r = s.r.map((v) => v * R); if (s.round) q.round = s.round * R; if (s.t === "cap") q.r = [].concat(s.r).map((v) => v * R);
    if (s.t === "scap" || s.t === "lid") { q.R = s.R * R; q.h = s.h * R; if (s.th) q.th = s.th * R; }
    if (s.t === "fn") { const f = s.f; q.f = (x, y, z) => f((x - c[0]) / R, (y - c[1]) / R, (z - c[2]) / R) * R; q.bc = s.bc.map((v, i) => c[i] + v * R); q.br = s.br * R; }
    return q; };
  const faceM = face.shapes.map(toM), F0 = prepare(faceM, { band: 0.012 }), skinD = (x, y, z) => F0.d(c[0] + x * R, c[1] + y * R, c[2] + z * R) / R;
  const F = prepare([...faceM, ...(SCULPT.bald ? [] : hairShapes(o, face.L, skinD)).map(toM)], { band: 0.012 });
  const cell = CELL[lod] || CELL.far, top = 1.25, bot = Math.max(neckY, -2.2);
  const lo = [c[0] - 1.05 * R, c[1] + bot * R, c[2] - 1.15 * R], hi = [c[0] + 1.05 * R, c[1] + top * R, c[2] + 1.3 * R];
  const wHead = (y) => { const t = sm(nj[1] + 0.01, hj[1] + 0.04, y); return { head: t, neck: 1 - t }; };
  const tint = skinTint(o, face.L), hp = hairPaint(o), headStart = M.pos.length / 3, local = [];
  polygonise(F, { lo, hi, cell, tri: M.tri, vert: (p, n, mat) => {
    const name = mat || "skin", mm = MATS[name === "skin" ? "flesh" : name]; if (!mm) throw new Error(`sculpt: unknown material ${name}`);
    const q = [(p[0] - c[0]) / R, (p[1] - c[1]) / R, (p[2] - c[2]) / R]; local.push(p[0], p[1], p[2]);
    M.paint = name === "skin" ? () => tint(q) : name === (o.hairMat || "hair") ? () => hp(q) : null;
    const v = M.vert(p, n, mm.id, wHead(p[1])); M.paint = null; return v;
  } });
  M.headLocal = local; M.headMaps = faceMaps(M, headStart, F.d); M.headLocal = null;
  for (const eye of face.L.eyes) eyeMesh(M, c, R, eye, wHead);
  M.cur = prev;
  return c;
}

// The painter's three zones over one skin: forehead a touch golden, the middle third (nose, cheeks, ears)
// ruddier, the jaw cooler, and darker where a man shaves; the sockets a shade violet where the skin is thin.
// Multipliers within about 6 % (a flushed face, Will's, to 10 %): read as temperature in the planes, not marks.
function skinTint(o, L) {
  const man = o.sex !== "f" && (o.age ?? 40) >= 16, fl = o.flush ?? 1, stub = o.stubble ? 1 : 0;
  return ([x, y, z]) => {
    const fore = sm(L.yb - 0.05, L.yb + 0.25, y), low = 1 - sm(L.mouthY - 0.12, L.noseY, y), mid = Math.max(0, 1 - fore - low);
    const cheek = Math.exp(-(((Math.abs(x) - 0.38) / 0.2) ** 2) - (((y - L.noseY - 0.05) / 0.22) ** 2)) * (z > 0.2 ? 1 : 0.4);
    const nose = Math.exp(-((x / 0.1) ** 2) - (((y - L.noseY) / 0.12) ** 2)) * sm(0.75, 0.95, z), ear = sm(0.55, 0.62, Math.abs(x)) * sm(0.3, 0, z) * Math.exp(-(((y - L.earY) / 0.3) ** 2));
    const socket = Math.exp(-(((Math.abs(x) - L.eyeX) / 0.13) ** 2) - (((y - L.eyeY + 0.02) / 0.1) ** 2)) * sm(0.55, 0.7, z);
    const ruddy = (0.03 * mid + 0.02 * cheek + 0.04 * nose + 0.05 * ear) * fl, gold = 0.02 * fore, cool = (man ? 0.03 : 0.012) * low * sm(0.1, 0.4, z), beard = (man ? 0.05 + 0.08 * stub : 0) * low * sm(L.mouthY + 0.02, L.mouthY - 0.08, y) * sm(0.2, 0.5, z) * (1 - Math.exp(-((x / 0.12) ** 2) * 0.5) * 0.3);
    let scar = 0; if (L.scar && z > 0.4) { const [x0, y0, x1, y1] = L.scar, vx = x1 - x0, vy = y1 - y0, t = Math.max(0, Math.min(1, ((x - x0) * vx + (y - y0) * vy) / (vx * vx + vy * vy))), d = Math.hypot(x - x0 - vx * t, y - y0 - vy * t); scar = Math.exp(-((d / 0.012) ** 2)); }
    const lip = L.lips && z > 0.7 ? Math.max(0, 1 - Math.hypot(x / L.lips.w, (y - L.lips.y) / L.lips.h)) : 0, lk = Math.min(1, lip * 2.2) * (o.sex === "f" ? 1 : 0.8);   // the lips' colour, painted with a soft edge
    const s = (1 - 0.05 * socket - beard + 0.1 * scar) * (o.hatLine ? 1 + 0.06 * sm(L.yb + 0.25, L.yb + 0.29, y) : 1);   // the good hat's line: paler above where the brim sat
    return [s * (1 + ruddy + gold - cool * 0.6) * (1 - 0.06 * lk), s * (1 - ruddy * 0.45 + gold * 0.5 - cool * 0.1) * (1 - 0.2 * lk), s * (1 - ruddy * 0.5 - gold * 0.8 + cool * 0.35 + 0.025 * socket) * (1 - 0.18 * lk)];
  };
}

// The palette for the sculpted head: the lips a step off the skin (they were a smear of their own colour), and
// an iris colour by people, seeded by the person (the Tarn grey, blue, hazel or brown; the Hesh and Vell brown).
const IRIS = { tarn: [[0.36, 0.42, 0.48], [0.38, 0.4, 0.34], [0.42, 0.33, 0.21], [0.3, 0.21, 0.14]], dark: [[0.22, 0.14, 0.09], [0.27, 0.17, 0.1]] };
export function sculptPalette(pal, spec) {
  if (!SCULPT.on) return pal;
  const sk = pal.skin?.c || MATS.skin.c, lip = pal.lip?.c || MATS.lip.c, h = [...String(spec.id || "x")].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const set = /hesh|vell/i.test(String(spec.people || "")) && !/Tarn, raised/.test(String(spec.people)) ? IRIS.dark : IRIS.tarn, ic = set[h % set.length];
  const l = (c) => +(0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]).toFixed(3);
  const lc = sk.map((v, i) => +(v * 0.62 + lip[i] * 0.38 * (sk[i] / Math.max(0.05, MATS.skin.c[i]))).toFixed(3));
  return { ...pal, lip: { c: lc, v: l(lc) }, iris: pal.iris || { c: ic, v: l(ic) } };
}

// An eye meshed exactly in rings about its gaze, so the iris and pupil are round and the cornea has a true
// normal for its highlight: the eyeball (white) from the back pole to the iris's rim, then the cornea's cap
// (iris, then pupil) bulging in front. Each band has its own vertices so its material is clean at the rim.
function eyeMesh(M, c, R, { e, er, ir, n, bulge }, wHead) {
  const ax = n, t1 = Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  let u = t1.map((v, i) => v - ax[i] * d(t1, ax)); const ul = Math.hypot(...u); u = u.map((v) => v / ul);
  const w = [ax[1] * u[2] - ax[2] * u[1], ax[2] * u[0] - ax[0] * u[2], ax[0] * u[1] - ax[1] * u[0]], seg = 40;
  const rc = er * 0.62, cc = e.map((v, i) => v + ax[i] * (er + bulge - rc)), tc = Math.asin(ir / er), pc = Math.asin(Math.min(1, ir / rc)), pp = Math.asin(ir * 0.42 / rc);
  // rings: [centre (R units), radius, normal fn] as polar angle about a sphere centre
  const ring = (ctr, rad, th) => ({ ctr, rad, th });
  const bands = [];
  const sweep = (ctr, rad, a0, a1, steps, mat) => { const L = []; for (let i = 0; i <= steps; i++) L.push(ring(ctr, rad, a0 + (a1 - a0) * i / steps)); bands.push({ L, mat }); };
  sweep(e, er, Math.PI * 0.98, tc, 14, "sclera"); sweep(cc, rc, pc, pp, 5, "iris"); sweep(cc, rc, pp, 0.0001, 3, "pupil");
  const at = (q) => c.map((v, i) => v + q[i] * R);
  for (const { L, mat } of bands) {
    const id = MATS[mat].id, base = M.pos.length / 3;
    for (const r of L) for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2, s = Math.sin(r.th), co = Math.cos(r.th);
      const nn = [0, 1, 2].map((i) => ax[i] * co + (u[i] * Math.cos(a) + w[i] * Math.sin(a)) * s), p = at(r.ctr.map((v, i) => v + nn[i] * r.rad));
      M.vert(p, nn, id, wHead(p[1]));
    }
    for (let j = 0; j < L.length - 1; j++) for (let k = 0; k < seg; k++) {
      const a = base + j * seg + k, b = base + j * seg + ((k + 1) % seg), cN = a + seg, dN = b + seg;
      M.tri.push(cN, a, b, cN, b, dN);   // the front ring's vertex first: the band's material either way
    }
  }
  // the catchlight a painter puts on the cornea, up and toward the key's side: a small pale cap that the light
  // still shades (in shadow it goes dark), so the eye keeps a point of life at play size
  const cd = [0, 1, 2].map((i) => ax[i] + u[i] * 0.42 - w[i] * 0.22), cl = Math.hypot(...cd), cn = cd.map((v) => v / cl), cu = [cn[1] * ax[2] - cn[2] * ax[1], cn[2] * ax[0] - cn[0] * ax[2], cn[0] * ax[1] - cn[1] * ax[0]], cul = Math.hypot(...cu) || 1;
  const e1 = cu.map((v) => v / cul), e2 = [cn[1] * e1[2] - cn[2] * e1[1], cn[2] * e1[0] - cn[0] * e1[2], cn[0] * e1[1] - cn[1] * e1[0]], id = MATS.catch.id, base = M.pos.length / 3, rr = rc * 1.006, ang = 0.27;
  M.vert(at(cc.map((v, i) => v + cn[i] * rr)), cn, id, wHead(at(cc)[1]));
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2, nn = [0, 1, 2].map((i) => cn[i] * Math.cos(ang) + (e1[i] * Math.cos(a) + e2[i] * Math.sin(a)) * Math.sin(ang)), p = at(cc.map((v, i) => v + nn[i] * rr)); M.vert(p, nn, id, wHead(p[1])); }
  for (let k = 0; k < 10; k++) M.tri.push(base, base + 1 + k, base + 1 + ((k + 1) % 10));
}
