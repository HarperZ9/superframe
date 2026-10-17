// Bake a Low Water place for the closer orthographic camera (design/CAMERA.md, 2026-10-17).
// Plates are authored at 1080p display density: one plate pixel is one screen pixel at 1920 x 1080,
// so the camera never magnifies paint (a person is about 105 px outdoors, about 180 px in rooms).
//   LW_PLATE=1 node render/bake2.mjs --place quay [--variants night,rain] [--only shade,post,dark] [--preview 0.25] [--out content]
// Writes content/<place>/: <variant>.png and <variant>-{flare,streak,halo,ca}.png, dark.png (blackout),
// geo-id.u8 (full size), geo-pos.f32 (half size: geoScale 0.5), place.json (camera, marks, arena).
// Engine passes: sodium spectral shading, paint-over painter, lens plan constants, dither lighting,
// look keys. Original glue code.
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { rn } from "./rn.mjs";
import { runShade } from "./v2/shade.mjs";
import { encode, paint, ink, reHdr, grade, sources, glow, chroma, lensAt } from "./v2/post2.mjs";

if (process.env.LW_PLATE !== "1") throw new Error("set LW_PLATE=1");
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const name = opt("--place"), outRoot = opt("--out", "content"), pv = +opt("--preview", 1), only = opt("--only", "shade,post,dark").split(",");
const placeUrl = new URL(`places/${name}.mjs`, import.meta.url).href, P = (await import(placeUrl)).default;
const vnames = (opt("--variants", Object.keys(P.variants).join(","))).split(",").filter((v) => P.variants[v]);
const cropA = opt("--crop", null), crop = cropA ? (([x, y, w, h]) => ({ x, y, w, h, FW: P.camera.W, FH: P.camera.H }))(cropA.split(",").map(Number)) : null;
const W = crop ? crop.w : Math.round(P.camera.W * pv), H = crop ? crop.h : Math.round(P.camera.H * pv), n = W * H, t0 = Date.now();
const out = crop ? `render/preview/v2/${name}-crop` : pv < 1 ? `render/preview/v2/${name}` : `${outRoot}/${name}`, tmp = `render/.tmp/${name}${crop ? "-crop" : pv < 1 ? "-pv" : ""}`;
mkdirSync(out, { recursive: true }); mkdirSync(tmp, { recursive: true });
const log = (s) => console.log(`${name} ${W}x${H}: ${s} ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const { writePng } = await import(rn("tools/shaders/png.mjs"));
const png = (f, data) => writePng(f, { width: W, height: H, data });

if (P.kind === "palette") {
  const { renderPalette } = await import("./v2/palette.mjs");
  for (const v of vnames) {
    const r = await renderPalette(placeUrl, v, W, H); png(`${out}/${v}.png`, r.up); log(`${v}: palette plate`);
    if (v === vnames[0]) { const g = r.g, w2 = W >> 1, h2 = H >> 1, ids = new Uint8Array(W * H), pos = new Float32Array(w2 * h2 * 3); for (let i = 0; i < w2 * h2; i++) { pos[i * 3] = g.P[i * 3]; pos[i * 3 + 1] = g.hit[i] ? g.P[i * 3 + 1] : 1e3; pos[i * 3 + 2] = g.P[i * 3 + 2]; } for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ids[y * W + x] = g.id[Math.min(h2 - 1, y >> 1) * w2 + Math.min(w2 - 1, x >> 1)]; writeFileSync(`${out}/geo-id.u8`, ids); writeFileSync(`${out}/geo-pos.f32`, Buffer.from(pos.buffer)); }
  }
} else if (only.includes("shade") && vnames.length) {
  const g = await runShade({ placeUrl, W, H, vnames, outFiles: vnames.map((v) => `${tmp}/${v}.f32`), workers: +opt("--workers", 6), log, crop });
  writeFileSync(`${tmp}/pid.u8`, g.pid); writeFileSync(`${tmp}/nrm.f32`, Buffer.from(g.nrm.buffer)); writeFileSync(`${tmp}/depth.f32`, Buffer.from(g.depth.buffer));
  writeFileSync(`${out}/geo-id.u8`, g.ids);
  const w2 = W >> 1, h2 = H >> 1, p2 = new Float32Array(w2 * h2 * 3);
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) p2.set(g.pos.subarray(((2 * y) * W + 2 * x) * 3, ((2 * y) * W + 2 * x) * 3 + 3), (y * w2 + x) * 3);
  writeFileSync(`${out}/geo-pos.f32`, Buffer.from(p2.buffer));
  log("traced and shaded");
}
if (only.includes("post") && P.kind !== "palette" && vnames.length) {
  const pid = new Uint8Array(readFileSync(`${tmp}/pid.u8`)), nrm = new Float32Array(readFileSync(`${tmp}/nrm.f32`).buffer.slice(0)), depth = new Float32Array(readFileSync(`${tmp}/depth.f32`).buffer.slice(0));
  for (const v of vnames) {
    const C = P.variants[v], hdr = new Float32Array(readFileSync(`${tmp}/${v}.f32`).buffer.slice(0)), gain = C.gain || 1.8;
    const radii = (C.paint?.radii || P.paint?.radii || [14, 8, 4.5, 2.6]).map((r) => r * pv);
    const painted = paint(encode(hdr, n, gain), W, H, pid, nrm, { seed: C.paint?.seed || P.paint?.seed || 11, radii, relief: C.paint?.relief ?? P.paint?.relief ?? 0.25 });
    const inked = ink(painted, W, H, pid, nrm, depth, { w: 2.2 * Math.max(0.5, pv), ...(P.ink || {}), ...(C.ink || {}) });
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
const cam = { ...P.camera, ortho: true, scale: P.camera.H / 2 / P.camera.ppm, dist: P.camera.dist || 60 };
const prev = existsSync(`${out}/place.json`) ? JSON.parse(readFileSync(`${out}/place.json`, "utf8")) : {};
const variants = [...new Set([...(prev.variants || []), ...vnames])].filter((v) => P.variants[v] && existsSync(`${out}/${v}.png`));
const { readdirSync } = await import("node:fs");
const arenas = existsSync(out) ? readdirSync(out).filter((f) => /^arena-.*\.json$/.test(f)).map((f) => { const A = JSON.parse(readFileSync(`${out}/${f}`, "utf8")); return { id: A.name, file: f, stage: A.stage.line, heightToWorld: A.stage.heightToWorld, size: [A.rows[0].length, A.rows.length] }; }) : [];
const lightsOut = P.lights ? Object.fromEntries(variants.map((v) => [v, P.lights(P.variants[v].V || {}).filter((l) => !/^(moon|sun|skyfill|fill|cellfill)$/.test(l.key || "")).map((l) => ({ at: l.pos.map((q) => +q.toFixed(2)), kind: ["sodium", "paraffin", "white", "sky"][typeof l.type === "number" ? l.type : { sodium: 0, window: 1, led: 2, sky: 3 }[l.type]] || "paraffin", I: +l.I.toFixed(2), reach: l.reach || 30, group: l.group || "" }))])) : Object.fromEntries(variants.map((v) => [v, (P.variants[v].glows || []).map((g) => ({ at: g.pos, kind: "paraffin", I: g.intensity, reach: g.radius, group: "lamp" }))]));
writeFileSync(`${out}/place.json`, JSON.stringify({
  place: name, version: 2, width: W, height: H, camera: { yawDeg: cam.yawDeg, elevDeg: cam.elevDeg, target: cam.target, dist: cam.dist, ortho: true, scale: cam.scale },
  pxPerMetre: P.camera.ppm * pv, near: +(W / 1920).toFixed(4), geoScale: 0.5, layers: P.kind === "palette" ? [] : ["flare", "streak", "halo", "ca"], style: P.kind || "painted",
  variants, variantInfo: Object.fromEntries(variants.map((v) => [v, { hour: P.variants[v].hour, weather: P.variants[v].note || "" }])),
  dark: !!P.dark, dithers: P.dithers ? Object.keys(P.dithers) : [], walk: P.walk || [], ids: P.ids || undefined, footing: P.footing || undefined, marks: P.marks || {}, lights: lightsOut, arenas, arena: P.arena || undefined, notes: P.notes || undefined,
}, null, 1));
if (only.includes("clean")) rmSync(tmp, { recursive: true, force: true });
log("done");
