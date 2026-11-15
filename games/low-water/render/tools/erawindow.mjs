// The era window proof on a baked plate: the plate in era A outside (drained), era B inside a painted window.
//   node render/tools/erawindow.mjs --dir render/preview/v2/q_square_wide --variant dawn --nrm <nrm.f32> --here 2 --there 1 --rect x,y,w,h --out FILE
import { readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { language } from "../v2/language.mjs";
import { strokeLight } from "../v2/strokelight.mjs";
import { eraWindow } from "../v2/erawindow.mjs";
import { BY_ID } from "../kit/ids.mjs";
import { rn } from "../rn.mjs";
const { readPng, writePng } = await import(rn("tools/shaders/png.mjs"));
const argv = process.argv.slice(2), opt = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1];
const dir = opt.dir, pl = JSON.parse(readFileSync(join(dir, "place.json"), "utf8")), img = readPng(join(dir, `${opt.variant}.png`)), W = img.width, H = img.height;
const id = new Uint8Array(readFileSync(join(dir, "geo-id.u8"))), nrm = opt.nrm ? new Float32Array(readFileSync(opt.nrm).buffer.slice(0)) : null;
const names = []; for (const k of BY_ID) if (k) names[k.id] = k.name;
const lit = strokeLight(img.data, W, H, { id, nrm, names, cam: pl.camera }, { scale: W / 1920 * 2 });
const at = (era) => language(lit, W, H, { id, depth: null, names }, { era: +era, seed: 5 });
const out = eraWindow(W, H, { here: at(opt.here || 2), there: at(opt.there || 1), rect: (opt.rect || "560,40,300,380").split(",").map(Number), drain: +(opt.drain ?? 0.85) });
mkdirSync(dirname(opt.out), { recursive: true }); writePng(opt.out, { width: W, height: H, data: out }); console.log("era window:", opt.out);
