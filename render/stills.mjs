// Before and after stills at the new camera (design/CAMERA.md): for a place, a 1920 x 1080 window
// of the new plate at 1:1 (what the player sees at 1080p), and the same world point on the old plate
// magnified to the same camera (the old plate's whole frame at 1080p, times 2.25 outdoors or 1.75 in
// rooms). Optionally the character lead's figures placed into the after still (characters/render).
//   node render/stills.mjs <place> [--variant night] [--at x,y,z] [--figs] [--out render/stills]
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { rn } from "./rn.mjs";
const CAM = await import(rn("web/shaders/paintover/camera.mjs")), { readPng, writePng } = await import(rn("tools/shaders/png.mjs"));
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const name = a[0], variant = opt("--variant", null), out = opt("--out", "render/stills"), root = new URL("../content/", import.meta.url), VW = 1920, VH = 1080;
mkdirSync(out, { recursive: true });
const info = JSON.parse(readFileSync(new URL(`${name}/place.json`, root), "utf8")), v = variant || info.variants[0] || "dark";
const cam = CAM.isoCamera(info.camera), W = info.width, H = info.height, plate = readPng(readFileSync(new URL(`${name}/${v}.png`, root)));
const at = opt("--at", null) ? opt("--at").split(",").map(Number) : null;
const centre = at ? CAM.project(cam, W, H, at) : [W / 2, H / 2];
const x0 = Math.round(Math.max(0, Math.min(W - VW, centre[0] - VW / 2))), y0 = Math.round(Math.max(0, Math.min(H - VH, centre[1] - VH / 2)));
const crop = (img, X, Y, w, h) => { const o = new Float32Array(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) o[(y * w + x) * 4 + c] = img.data[((Y + y) * img.width + X + x) * 4 + c] / 255; return o; };
const after = { W: VW, H: VH, img: crop(plate, x0, y0, VW, VH), x0, y0 };
// figures (optional): the character lead's real-time path (A), placed with the plate's own camera
if (a.includes("--figs")) {
  const { placeFigures } = await import("./v2/figs.mjs");
  await placeFigures(after, { info, cam, W, H, name, scene: opt("--scene", name) });
}
const to8 = (f, w, h) => { const o = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h * 4; i++) o[i] = Math.round(Math.min(1, Math.max(0, f[i])) * 255); return o; };
const tag = `${name}-${v}${a.includes("--figs") ? "-figs" : ""}`;
writePng(`${out}/${tag}-after.png`, { width: VW, height: VH, data: to8(after.img, VW, VH) });
// before: the old plate (render/before/<place>) magnified to the new camera, around the same point
const beforeName = opt("--before", name), bdir = new URL(`../render/before/${beforeName}/`, import.meta.url);
if (existsSync(new URL("place.json", bdir))) {
  const bi = JSON.parse(readFileSync(new URL("place.json", bdir), "utf8")), bv = existsSync(new URL(`${v}.png`, bdir)) ? v : (bi.variants || ["night"])[0], bp = readPng(readFileSync(new URL(`${bv}.png`, bdir)));
  const bcam = CAM.isoCamera(bi.camera), room = !["quay", "lamp-quay"].includes(bi.place), zoom = (VW / bi.width) * (room ? 1.75 : 2.25);
  const p = at ? CAM.project(bcam, bi.width, bi.height, at) : [bi.width / 2, bi.height / 2], w = VW / zoom, h = VH / zoom, bx = Math.max(0, Math.min(bi.width - w, p[0] - w / 2)), by = Math.max(0, Math.min(bi.height - h, p[1] - h / 2));
  const o = new Uint8ClampedArray(VW * VH * 4);
  for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) { const sx = Math.min(bi.width - 1, Math.floor(bx + x / zoom)), sy = Math.min(bi.height - 1, Math.floor(by + y / zoom)), s = (sy * bi.width + sx) * 4, d = (y * VW + x) * 4; o[d] = bp.data[s]; o[d + 1] = bp.data[s + 1]; o[d + 2] = bp.data[s + 2]; o[d + 3] = 255; }
  writePng(`${out}/${name}-${v}-before.png`, { width: VW, height: VH, data: o });
  console.log(`${name}: before (old ${bv}, zoom ${zoom.toFixed(2)}) and after`);
} else console.log(`${name}: after only (no earlier plate)`);
