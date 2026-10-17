// Box-downscale a plate (or crop a window of it at full size) for looking at it.
//   node render/tools/thumb.mjs <in.png> <out.png> [--w 1600] [--crop x,y,w,h]
import { readFileSync } from "node:fs";
import { rn } from "../rn.mjs";
const { readPng, writePng } = await import(rn("tools/shaders/png.mjs"));
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const src = readPng(readFileSync(a[0])), crop = opt("--crop", null);
if (crop) { const [x0, y0, w, h] = crop.split(",").map(Number), o = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) o[(y * w + x) * 4 + c] = src.data[((y0 + y) * src.width + x0 + x) * 4 + c]; writePng(a[1], { width: w, height: h, data: o }); }
else { const W = +opt("--w", 1600), k = src.width / W, H = Math.round(src.height / k), o = new Uint8ClampedArray(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = [0, 0, 0]; let n = 0; for (let yy = Math.floor(y * k); yy < Math.floor((y + 1) * k); yy++) for (let xx = Math.floor(x * k); xx < Math.floor((x + 1) * k); xx++) { const i = (yy * src.width + xx) * 4; s[0] += src.data[i]; s[1] += src.data[i + 1]; s[2] += src.data[i + 2]; n++; } for (let c = 0; c < 3; c++) o[(y * W + x) * 4 + c] = s[c] / n; o[(y * W + x) * 4 + 3] = 255; } writePng(a[1], { width: W, height: H, data: o }); }
