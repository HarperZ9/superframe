// Glyph portraits for the dialogue box (design/art/GLYPH-LANGUAGE.md section 2): from the same head
// reference the painted portraits use (characters/proto/portraits.mjs: the actor at facing 2, the idle clip
// one frame in, the portrait camera, PORTRAIT_RIG), each speaker in each expression and light is reduced to
// the glyph pipeline's intermediate: per cell of a 60 x 50 grid, its lit tone (16 levels, the same light
// function the painted bake uses: characters/render/shade.mjs), which part it shows (skin, eye, brow, lip,
// hair, hat, wool, felt, thread, light cloth, dark cloth), how its own part covers it (3 x 4) and how much
// rim it carries. The style turns this into glyphs at run time (glyph/portrait.mjs), so one bake serves
// every glyph style and both cell sizes.
//   node game/engine/paint/glyph/tools/portraits.mjs [quota|lowwater] [who,who]
// Writes characters/glyph-portraits-<cast>/<who>.json. Run under the heavy-cpu lock. Original code.
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
const ch = (p) => new URL(`../../../../../characters/${p}`, import.meta.url);
const { createCast } = await import(ch("runtime/actor.mjs"));
const { gbuffer } = await import(ch("render/figure.mjs"));
const { albedo, light } = await import(ch("render/shade.mjs"));
const { PORTRAIT_RIG } = await import(ch("proto/portrait_light.mjs"));
const { roster } = await import(ch("proto/heads_roster.mjs"));
const { setExpression, EXPRESSIONS } = await import(ch("cast/parts.mjs"));
const { INDEX } = await import(ch("rig/skeleton.mjs"));
const { BY_ID } = await import(ch("rig/materials.mjs"));

export const COLS = 60, ROWS = 50, W = 512, H = 640, SS = 2;
export const PARTS = ["bg", "skin", "eye", "white", "brow", "lip", "hair", "hat", "wool", "felt", "thread", "clothLight", "clothDark", "hatline", "mark"];
export const STRIDE = 7;   // bytes a cell: tone, part, cover low, cover high | rim, albedo r g b
const PART_OF = { skin: 1, cheek: 1, jawcool: 1, eye: 2, white: 3, brow: 4, lip: 5, hair: 6, braid: 6, hat: 7, band: 7, wool: 8, felt: 9, thread: 10, hatline: 13 };
const partOf = (id) => { const m = BY_ID[id]; if (!m) return 0; if (PART_OF[m.name] != null) return PART_OF[m.name]; return m.v > 0.55 ? 11 : 12; };

// one cell: the part most of it shows (eyes, brows and lips win when present: they carry the expression),
// its mean lit value, its own part's 3 x 4 cover, its rim (edge pixels facing away from the viewer) and its
// mean albedo. The old heads paint their eyes, brows and mouths into the skin's colour rather than giving
// them their own material, so a skin cell whose pixels are much darker than the skin around them is a
// "mark", and its cover is where those dark pixels lie.
const lumOf = (a, i) => 0.2126 * a[i * 3] + 0.7152 * a[i * 3 + 1] + 0.0722 * a[i * 3 + 2];
function cell(G, E, A, x0, y0, cw, chh, skinRef) {
  const votes = new Map(), cov = new Float32Array(12), dark = new Float32Array(12), alb = [0, 0, 0]; let lum = 0, n = 0, rim = 0, nd = 0;
  for (let y = y0; y < y0 + chh; y++) for (let x = x0; x < x0 + cw; x++) {
    const i = y * G.w + x, id = G.id[i]; if (!id) continue; const p = partOf(id); votes.set(p, (votes.get(p) || 0) + 1); n++;
    lum += 0.2126 * E[i * 3] * A[i * 3] + 0.7152 * E[i * 3 + 1] * A[i * 3 + 1] + 0.0722 * E[i * 3 + 2] * A[i * 3 + 2];
    for (let c = 0; c < 3; c++) alb[c] += A[i * 3 + c];
    rim += Math.pow(1 - Math.min(1, Math.abs(G.N[i * 3 + 2])), 3);
    if (p === 1 && lumOf(A, i) < skinRef * 0.6) { nd++; dark[Math.min(3, Math.floor(((y - y0) * 4) / chh)) * 3 + Math.min(2, Math.floor(((x - x0) * 3) / cw))]++; }
  }
  if (n < (cw * chh) / 6) return [0, 0, 0, 0, 0, 0, 0];
  let part = 0, best = 0; for (const [p, v] of votes) { const w = v * ([2, 4, 5, 3].includes(p) ? 4 : 1); if (w > best) { best = w; part = p; } }
  const per = (cw * chh) / 12; let bits = 0;
  if (part === 1 && nd > n * 0.1) { part = 14; for (let r = 0; r < 12; r++) if (dark[r] / per > 0.3) bits |= 1 << r; }
  else { for (let y = y0; y < y0 + chh; y++) for (let x = x0; x < x0 + cw; x++) { const id = G.id[y * G.w + x]; if (id && partOf(id) === part) cov[Math.min(3, Math.floor(((y - y0) * 4) / chh)) * 3 + Math.min(2, Math.floor(((x - x0) * 3) / cw))]++; } for (let r = 0; r < 12; r++) if (cov[r] / per > 0.4) bits |= 1 << r; }
  const v = 1 - Math.exp(-2.2 * (lum / n) * 1.6), tone = Math.max(0, Math.min(15, Math.round(v * 15)));
  return [tone, part, bits & 255, (bits >> 8) | (Math.min(3, Math.round((rim / n) * 6)) << 4), ...alb.map((a) => Math.round((255 * a) / n))];
}
function bakeGrid(G, E, A) {
  const cw = G.w / COLS, chh = G.h / ROWS, buf = new Uint8Array(COLS * ROWS * STRIDE);
  let sl = 0, sn = 0; for (let i = 0; i < G.w * G.h; i++) if (G.id[i] && partOf(G.id[i]) === 1) { sl += lumOf(A.rgb, i); sn++; }   // the skin's own value, for the marks
  const skinRef = sn ? sl / sn : 0.5;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) buf.set(cell(G, E, A.rgb, Math.round(c * cw), Math.round(r * chh), Math.round(cw), Math.round(chh), skinRef), (r * COLS + c) * STRIDE);
  return Buffer.from(buf).toString("base64");
}
function bakeSitter(w, C, timing) {
  const out = { who: w, cols: COLS, rows: ROWS, stride: STRIDE, parts: PARTS, moods: {} };
  for (const expr of Object.keys(EXPRESSIONS)) {
    setExpression(expr);
    const Cx = { ...C }, a = createCast({ timing, members: { [w]: Cx } }).actor(w, { facing: 34 - 32 }); a.play("idle", { force: true, fade: 1 }); a.update(1 / 60);
    const pose = a.pose(), hy = a.toWorld(a.skeleton(pose)[INDEX.head].p)[1], view = { yawDeg: 34, elevDeg: 6, height: 0.8, centre: [0, hy - 0.02, 0] };
    const { G } = gbuffer([{ C: Cx, pose, facing: 34 - 32, tool: "hands" }], view, W, H, SS, PORTRAIT_RIG.paraffin.rig);
    const A = albedo(G, Cx.palette || {}); out.moods[expr] = {};
    for (const [lname, L] of Object.entries(PORTRAIT_RIG)) out.moods[expr][lname] = bakeGrid(G, light(G, L.rig, Cx.palette || {}), A);
    setExpression(null);
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith("portraits.mjs")) {
  const [castArg = "quota", only] = process.argv.slice(2), members = await roster(castArg);
  const timing = JSON.parse(readFileSync(ch("anim/timing.json"), "utf8")), dir = ch(`glyph-portraits-${castArg}/`);
  mkdirSync(dir, { recursive: true });
  const index = {};
  for (const w of only ? only.split(",") : Object.keys(members)) {
    const t0 = Date.now(), P = bakeSitter(w, members[w], timing);
    writeFileSync(new URL(`${w}.json`, dir), JSON.stringify(P)); index[w] = `characters/glyph-portraits-${castArg}/${w}.json`;
    console.log(`glyph portrait ${w}: ${Object.keys(P.moods).length} expressions, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  let old = {}; try { old = JSON.parse(readFileSync(new URL("index.json", dir), "utf8")); } catch { /* a first bake */ }
  writeFileSync(new URL("index.json", dir), JSON.stringify({ ...old, ...index }, null, 1));
}
