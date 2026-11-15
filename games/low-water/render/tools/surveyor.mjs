// The surveyor's drawing on a baked plate (render/v2/pen.mjs): reads <dir>/<variant>.png, geo-id.u8, geo-pos.f32 and the
// bake's normals, writes <out>/<name>.png (day and night). A candidate third style; see render/PROGRESS.md.
//   node render/tools/surveyor.mjs --dir render/preview/v2/q_square_wide --variant dawn --nrm render/.tmp/q_square_wide-pv/nrm.f32 --out DIR [--terms]
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { surveyor } from "../v2/pen.mjs";
import { lightTerms } from "../v2/lightterms.mjs";
import { BY_ID } from "../kit/ids.mjs";
import { rn } from "../rn.mjs";
const { readPng, writePng } = await import(rn("tools/shaders/png.mjs"));
const argv = process.argv.slice(2), opt = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const dir = opt.dir, out = opt.out; mkdirSync(out, { recursive: true });
const pl = JSON.parse(readFileSync(join(dir, "place.json"), "utf8")), img = readPng(join(dir, `${opt.variant}.png`)), W = img.width, H = img.height;
const id = new Uint8Array(readFileSync(join(dir, "geo-id.u8"))), nrm = new Float32Array(readFileSync(opt.nrm).buffer.slice(0)), gs = pl.geoScale || 0.5, gw = Math.round(W * gs), gh = Math.round(H * gs);
const pos = new Float32Array(readFileSync(join(dir, "geo-pos.f32")).buffer.slice(0)), y0 = (pl.camera.yawDeg * Math.PI) / 180, e0 = (pl.camera.elevDeg * Math.PI) / 180, fwd = [-Math.sin(y0) * Math.cos(e0), -Math.sin(e0), -Math.cos(y0) * Math.cos(e0)];
const depth = new Float32Array(W * H); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const s = Math.min(gh - 1, Math.floor(j * gs)) * gw + Math.min(gw - 1, Math.floor(i * gs)); depth[j * W + i] = pos[s * 3] * fwd[0] + pos[s * 3 + 1] * fwd[1] + pos[s * 3 + 2] * fwd[2]; }
const names = []; for (const k of BY_ID) if (k) names[k.id] = k.name;
const terms = opt.terms ? await lightTerms({ dir, W, H }) : null;
for (const night of [false, true]) writePng(join(out, night ? "night.png" : "day.png"), { width: W, height: H, data: surveyor(W, H, { id, nrm, depth, plate: img.data, names, terms }, { night }) });
console.log("surveyor: day and night in", out);
