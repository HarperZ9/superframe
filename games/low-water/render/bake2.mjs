// Bake a Low Water place for the closer orthographic camera (design/CAMERA.md, 2026-10-17).
// Plates are authored at 1080p display density: one plate pixel is one screen pixel at 1920 x 1080,
// so the camera never magnifies paint (a person is about 105 px outdoors, about 180 px in rooms).
//   LW_PLATE=1 node render/bake2.mjs --place quay [--variants night,rain] [--only shade,post,dark] [--preview 0.25] [--out content]
// Writes content/<place>/: <variant>.png and <variant>-{flare,streak,halo,ca}.png, dark.png (blackout),
// geo-id.u8 (full size), geo-pos.f32 (half size: geoScale 0.5), place.json (camera, marks, arena).
// Engine passes: sodium spectral shading, paint-over painter, lens plan constants, dither lighting,
// look keys. Original glue code.
import { mkdirSync, writeFileSync as writeRaw, readFileSync, existsSync, rmSync, renameSync, readdirSync } from "node:fs";
// every output is written beside its name and renamed over it, so a game reading the folder while a bake
// runs sees the old file or the new one, never a half-written one (a headless run read the quay's dark plate
// mid-write and Chrome reported it as "cannot be decoded", 2026-10-21)
const writeFileSync = (f, d) => { const t = `${f}.part`; writeRaw(t, d); renameSync(t, f); };
import { rn } from "./rn.mjs";
import { runShade } from "./v2/shade.mjs";
import { encode, paint, ink, reHdr, grade, sources, glow, chroma, lensAt } from "./v2/post2.mjs";

if (process.env.LW_PLATE !== "1") throw new Error("set LW_PLATE=1");
// a variant named like the blackout plate or a dither plate would be overwritten by it (dark.png): refuse
const RESERVED_VARIANTS = ["dark"];
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const hires = args.includes("--hires");   // --hires (with --preview 2): the colour plates only, for the 4K path (ui/platecam.mjs); the 1x geo buffers and place.json are kept
const name = opt("--place"), outRoot = opt("--out", "content"), pv = +opt("--preview", 1), only = opt("--only", "shade,post,dark").split(",");
const placeUrl = new URL(`places/${name}.mjs`, import.meta.url).href, P = (await import(placeUrl)).default;
for (const v of Object.keys(P.variants || {})) if (RESERVED_VARIANTS.includes(v) || (P.dithers && v in P.dithers)) throw new Error(`bake2: variant "${v}" of ${name} would be overwritten by the ${v === "dark" ? "blackout" : "dither"} plate (${v}.png); rename it`);
const vnames = (opt("--variants", Object.keys(P.variants).join(","))).split(",").filter((v) => P.variants[v]);
const cropA = opt("--crop", null), crop = cropA ? (([x, y, w, h]) => ({ x, y, w, h, FW: P.camera.W, FH: P.camera.H }))(cropA.split(",").map(Number)) : null;
const W = crop ? crop.w : Math.round(P.camera.W * pv), H = crop ? crop.h : Math.round(P.camera.H * pv), n = W * H, t0 = Date.now();
// --preview-out <dir>: a preview or crop goes to <dir>/<place> with its working files beside it, not to render/preview/v2
// (game/engine/paint/tests/recipe.test.mjs bakes tiny previews there so it never overwrites an artist's preview)
const pvOut = opt("--preview-out", null), pvDir = pvOut || "render/preview/v2";
const out = crop ? `${pvDir}/${name}-crop` : pv < 1 ? `${pvDir}/${name}` : `${outRoot}/${name}`, tmp = `${pvOut && (crop || pv < 1) ? `${pvOut}/.tmp` : "render/.tmp"}/${name}${crop ? "-crop" : pv < 1 ? "-pv" : pv > 1 ? `-x${pv}` : ""}`;
mkdirSync(out, { recursive: true }); mkdirSync(tmp, { recursive: true });
const log = (s) => console.log(`${name} ${W}x${H}: ${s} ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const { writePng } = await import(rn("tools/shaders/png.mjs"));
const png = (f, data) => { const t = `${f}.part.png`; writePng(t, { width: W, height: H, data }); renameSync(t, f); };
// place.json: what the game reads beside the plates. Built before the post stage too (baked = false: the variants this
// bake is making count as made), because the stroke light's terms (v2/lightterms.mjs) read its lights, camera and
// variants: they used to read the place.json the last bake left, so a plate whose lights had changed came out
// differently on its first and second rebake, and a bake into an empty folder had no terms at all (plates pass 2026-10-24).
function placeMeta(baked) {
  const cam = { ...P.camera, ortho: true, scale: P.camera.H / 2 / P.camera.ppm, dist: P.camera.dist || 60 };
  const prev = existsSync(`${out}/place.json`) ? JSON.parse(readFileSync(`${out}/place.json`, "utf8")) : {};
  const variants = [...new Set([...(prev.variants || []), ...vnames])].filter((v) => P.variants[v] && (!baked || existsSync(`${out}/${v}.png`)));
  const arenas = existsSync(out) ? readdirSync(out).filter((f) => /^arena-.*\.json$/.test(f)).map((f) => { const A = JSON.parse(readFileSync(`${out}/${f}`, "utf8")); return { id: A.name, file: f, stage: A.stage.line, heightToWorld: A.stage.heightToWorld, size: [A.rows[0].length, A.rows.length] }; }) : [];
  // fight marks for the combat converter (game/engine/combat/sim/plate.mjs reads marks.fight): spawns,
  // anchors and the radius of the painted fight ground, in world x, z, from the plate's arena files
  const fights = {};
  for (const a of arenas) {
    const A = JSON.parse(readFileSync(`${out}/${a.file}`, "utf8")), [ax0, az0] = A.source.rect, w = (p) => [+(ax0 + p[0]).toFixed(2), +(az0 + p[1]).toFixed(2)], t = P.camera.target;
    let r = 0; A.rows.forEach((line, ri) => [...line].forEach((ch, ci) => { if (!A.legend[ch].solid) r = Math.max(r, Math.hypot(ax0 + ci + 0.5 - t[0], az0 + ri + 0.5 - t[2])); }));
    fights[a.id] = { lamb: w(A.spawns.lamb), foes: A.spawns.foes.map(w), anchors: Object.fromEntries(Object.entries(A.anchors).map(([k, v]) => [k, v.map(w)])), r: +(r + 0.6).toFixed(2), arena: a.file, stage: a.stage };
  }
  const fightMain = fights[name] || fights[{ station: "hill" }[name]] || Object.values(fights)[0];
  const lightsOut = P.lights ? Object.fromEntries(variants.map((v) => [v, P.lights(P.variants[v].V || {}).filter((l) => !/^(moon|sun|skyfill|fill|cellfill)$/.test(l.key || "")).map((l) => ({ at: l.pos.map((q) => +q.toFixed(2)), kind: ["sodium", "paraffin", "white", "sky"][typeof l.type === "number" ? l.type : { sodium: 0, window: 1, led: 2, sky: 3 }[l.type]] || "paraffin", I: +l.I.toFixed(2), reach: l.reach || 30, group: l.group || "" }))])) : Object.fromEntries(variants.map((v) => [v, (P.variants[v].glows || []).map((g) => ({ at: g.pos, kind: "paraffin", I: g.intensity, reach: g.radius, group: "lamp" }))]));
  // figure lights: light the figures take and the plate does not (a variant's figureLights, else the place's): the room's
  // key from the camera side, so a figure stands lit in a lit room instead of black against it (the returns room,
  // 2026-10-22). Read by the people layer only (game/engine/ui/peoplelayer.mjs); no lamp is drawn for them.
  const figOut = Object.fromEntries(variants.map((v) => [v, (P.variants[v].figureLights || P.figureLights || []).map((l) => ({ at: l.pos.map((q) => +q.toFixed(2)), kind: l.kind || "paraffin", I: +(+l.I).toFixed(2), reach: l.reach || 8, figure: true }))]).filter(([, L]) => L.length));
  return {
    ...prev, // keys others add (the tide datum, shell hints) survive a re-bake
    place: name, version: 2, width: W, height: H, camera: { yawDeg: cam.yawDeg, elevDeg: cam.elevDeg, target: cam.target, dist: cam.dist, ortho: true, scale: cam.scale },
    pxPerMetre: P.camera.ppm * pv, near: +(W / 1920).toFixed(4), geoScale: 0.5, layers: P.kind === "palette" ? [] : ["flare", "streak", "halo", "ca"], style: P.kind || "painted",
    variants, variantInfo: Object.fromEntries(variants.map((v) => [v, { hour: P.variants[v].hour, weather: P.variants[v].note || "" }])),
    dark: !!P.dark, dithers: P.dithers ? Object.keys(P.dithers) : [], walk: P.walk || [], ids: P.ids || undefined, footing: P.footing || undefined, marks: { ...(P.marks || {}), ...(fightMain ? { fight: fightMain, fights } : {}) }, lights: lightsOut, ...(Object.keys(figOut).length ? { figureLights: figOut } : {}), arenas, arena: P.arena || undefined, notes: P.notes || undefined,
  };
}

if (P.kind === "palette") {
  const { renderPalette } = await import("./v2/palette.mjs");
  for (const v of vnames) {
    const r = await renderPalette(placeUrl, v, W, H);
    // Oil and Ink over the palette (author 2026-10-18: "Oil and Ink"; the Gut's flat palette blocks read as an
    // unpainted fallback in play, 2026-10-21): the palette render brushed and inked like every other plate,
    // its colours kept. P.paintover === false keeps the flat palette.
    let img = r.up;
    if (P.paintover !== false) {
      const g = r.g, w2 = g.w, h2 = g.h, pidF = new Uint8Array(W * H), nrmF = new Float32Array(W * H * 3), depF = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s2 = Math.min(h2 - 1, y >> 1) * w2 + Math.min(w2 - 1, x >> 1), d = y * W + x; pidF[d] = g.hit[s2] ? (P.paintId ? P.paintId(g.id[s2], [g.P[s2 * 3], g.P[s2 * 3 + 1], g.P[s2 * 3 + 2]], -1) : g.id[s2]) : 0; nrmF[d * 3] = g.N[s2 * 3]; nrmF[d * 3 + 1] = g.N[s2 * 3 + 1]; nrmF[d * 3 + 2] = g.N[s2 * 3 + 2]; depF[d] = g.hit[s2] ? g.depth[s2] : 1e3; }
      const radii = (P.paint?.radii || [14, 8, 4.5, 2.6]).map((rr) => rr * pv);
      img = ink(paint(r.up, W, H, pidF, nrmF, { seed: P.paint?.seed || 29, radii, relief: P.paint?.relief ?? 0.25 }), W, H, pidF, nrmF, depF, { w: 2.2 * Math.max(0.5, pv), ...(P.ink || {}) });
    }
    png(`${out}/${v}.png`, img); log(`${v}: palette plate${P.paintover !== false ? ", painted and inked" : ""}`);
    if (v === vnames[0]) { const g = r.g, w2 = W >> 1, h2 = H >> 1, ids = new Uint8Array(W * H), pos = new Float32Array(w2 * h2 * 3); for (let i = 0; i < w2 * h2; i++) { pos[i * 3] = g.P[i * 3]; pos[i * 3 + 1] = g.hit[i] ? g.P[i * 3 + 1] : 1e3; pos[i * 3 + 2] = g.P[i * 3 + 2]; } for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ids[y * W + x] = g.id[Math.min(h2 - 1, y >> 1) * w2 + Math.min(w2 - 1, x >> 1)]; writeFileSync(`${out}/geo-id.u8`, ids); writeFileSync(`${out}/geo-pos.f32`, Buffer.from(pos.buffer)); }
  }
} else if (opt("--band", null) && vnames.length) {
  // one band of rows of the shade (render/tools/bakequeue.mjs runs the bands, each a short heavy-cpu job); the rows
  // land in the tmp files at their offsets, and --only assemble writes the geo buffers once every band is in
  const [ya, yb] = opt("--band").split(":").map(Number), geoFiles = { ids: `${tmp}/g-ids.u8`, pid: `${tmp}/pid.u8`, nrm: `${tmp}/nrm.f32`, depth: `${tmp}/depth.f32`, pos: `${tmp}/g-pos.f32` };
  await runShade({ placeUrl, W, H, vnames, outFiles: vnames.map((v) => `${tmp}/${v}.f32`), workers: +opt("--workers", 6), log, crop, band: [ya, Math.min(H, yb)], geoFiles });
  log(`band ${ya}:${yb} shaded`);
} else if (only.includes("assemble")) {
  const ids = new Uint8Array(readFileSync(`${tmp}/g-ids.u8`)), pos = new Float32Array(readFileSync(`${tmp}/g-pos.f32`).buffer.slice(0));
  if (!hires) writeFileSync(`${out}/geo-id.u8`, ids);
  const w2 = W >> 1, h2 = H >> 1, p2 = new Float32Array(w2 * h2 * 3);
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) p2.set(pos.subarray(((2 * y) * W + 2 * x) * 3, ((2 * y) * W + 2 * x) * 3 + 3), (y * w2 + x) * 3);
  if (!hires) writeFileSync(`${out}/geo-pos.f32`, Buffer.from(p2.buffer));
  log("assembled");
} else if (only.includes("shade") && vnames.length) {
  const g = await runShade({ placeUrl, W, H, vnames, outFiles: vnames.map((v) => `${tmp}/${v}.f32`), workers: +opt("--workers", 6), log, crop });
  writeFileSync(`${tmp}/pid.u8`, g.pid); writeFileSync(`${tmp}/nrm.f32`, Buffer.from(g.nrm.buffer)); writeFileSync(`${tmp}/depth.f32`, Buffer.from(g.depth.buffer));
  if (!hires) writeFileSync(`${out}/geo-id.u8`, g.ids);
  const w2 = W >> 1, h2 = H >> 1, p2 = new Float32Array(w2 * h2 * 3);
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) p2.set(g.pos.subarray(((2 * y) * W + 2 * x) * 3, ((2 * y) * W + 2 * x) * 3 + 3), (y * w2 + x) * 3);
  if (!hires) writeFileSync(`${out}/geo-pos.f32`, Buffer.from(p2.buffer));
  log("traced and shaded");
}
if (only.includes("post") && P.kind !== "palette" && vnames.length) {
  const pid = new Uint8Array(readFileSync(`${tmp}/pid.u8`)), nrm = new Float32Array(readFileSync(`${tmp}/nrm.f32`).buffer.slice(0)), depth = new Float32Array(readFileSync(`${tmp}/depth.f32`).buffer.slice(0));
  for (const v of vnames) {
    const C = P.variants[v], hdr = new Float32Array(readFileSync(`${tmp}/${v}.f32`).buffer.slice(0)), gain = C.gain || 1.8;
    const radii = (C.paint?.radii || P.paint?.radii || [14, 8, 4.5, 2.6]).map((r) => r * pv);
    const painted = paint(encode(hdr, n, gain), W, H, pid, nrm, { seed: C.paint?.seed || P.paint?.seed || 11, radii, relief: C.paint?.relief ?? P.paint?.relief ?? 0.25 });
    let inked = ink(painted, W, H, pid, nrm, depth, { w: 2.2 * Math.max(0.5, pv), ...(P.ink || {}), ...(C.ink || {}) });
    // the paint language (design/art/PAINT-LANGUAGE.md): strokes by material, light, era and decay, where the place asks
    const langOpt = C.language ?? P.language;
    const slOpt = C.strokeLight ?? P.strokeLight;
    if (slOpt && existsSync(`${out}/geo-id.u8`)) { const { strokeLight } = await import("./v2/strokelight.mjs"), { BY_ID } = await import("./kit/ids.mjs"), nm = []; for (const k of BY_ID) if (k) nm[k.id] = k.name; const gid = new Uint8Array(readFileSync(`${out}/geo-id.u8`)); if (gid.length === n) { let terms = null; try { const { lightTerms } = await import("./v2/lightterms.mjs"); terms = await lightTerms({ dir: out, W, H, hour: C.hour, pj: placeMeta(false) }); } catch (e) { log(`${v}: stroke light without the light model's terms (${e.message})`); } inked = strokeLight(inked, W, H, { id: gid, nrm, names: nm, cam: P.camera, terms }, { seed: P.paint?.seed || 11, scale: Math.max(0.5, pv) * (P.camera.ppm >= 150 ? 1 : 0.7), strength: slOpt.strength ?? 1, frost: C.V?.frost || 0 }); log(`${v}: stroke light, ${inked.stats.strokes} strokes, ${inked.stats.sources} sources${terms ? ", the light model's terms" : ""}`); } }
    if (langOpt) { const { language } = await import("./v2/language.mjs"), { BY_ID } = await import("./kit/ids.mjs"), names = []; for (const k of BY_ID) if (k) names[k.id] = k.name; const gid = existsSync(`${out}/geo-id.u8`) ? new Uint8Array(readFileSync(`${out}/geo-id.u8`)) : null; if (gid && gid.length === n) { inked = language(inked, W, H, { id: gid, depth, names }, { frost: C.V?.frost || 0, seed: P.paint?.seed || 11, ...langOpt }); log(`${v}: paint language era ${langOpt.era ?? 2}, decay ${langOpt.decay ?? 0}, broken ${inked.stats.brokenShare.toFixed(3)}`); } else log(`${v}: paint language skipped (no full-size geo-id.u8 yet)`); }
    // era 3's out-of-register colour (v2/misregister.mjs), where a variant asks for it (Anni's kitchen at year 38)
    if (C.misregister) { const { misregister } = await import("./v2/misregister.mjs"); inked = misregister(inked, W, H, { dx: Math.round((C.misregister.dx ?? 2) * pv) || 1, dy: Math.round((C.misregister.dy ?? 1) * pv) }); log(`${v}: misregistered colour`); }
    const lin = reHdr(inked, hdr, n, gain), hour = C.hour ?? 23, lens = lensAt(hour, { ...(P.lens || {}), ...(C.lens || {}) });
    const plate = encode(grade(lin, n, hour, C.grade || {}), n, gain); png(`${out}/${v}.png`, plate);
    const srcs = sources(lin, W, H, lens.threshold);
    const layer = (file, frame, signed = false) => { const L = encode(grade(frame, n, hour, C.grade || {}), n, gain), d = new Uint8ClampedArray(n * 4); for (let i = 0; i < n * 4; i += 4) { for (let c = 0; c < 3; c++) d[i + c] = signed ? 128 + (L[i + c] - plate[i + c]) : L[i + c] - plate[i + c]; d[i + 3] = 255; } png(`${out}/${v}-${file}.png`, d); };
    layer("flare", glow(lin, W, H, srcs, lens, "star")); layer("streak", glow(lin, W, H, srcs, lens, "streak")); layer("halo", glow(lin, W, H, srcs, lens, "halo")); layer("ca", chroma(lin, W, H, lens), true);
    log(`${v}: plate and lens layers (${srcs.length} sources)`);
  }
}
if (only.includes("dark") && P.dark && !crop) {
  const { renderDark } = await import("./v2/dark.mjs");
  const up = await renderDark(P, placeUrl, W, H, pv); png(`${out}/dark.png`, up); log("blackout plate");
}
if (only.includes("dark") && P.dithers && !crop) { const { renderDark } = await import("./v2/dark.mjs"); for (const k of Object.keys(P.dithers)) { png(`${out}/${k}.png`, await renderDark(P, placeUrl, W, H, pv, 6, k)); log(`dither plate ${k}`); } }
if (!hires) writeFileSync(`${out}/place.json`, JSON.stringify(placeMeta(true), null, 1));
if (only.includes("clean")) rmSync(tmp, { recursive: true, force: true });
log("done");
