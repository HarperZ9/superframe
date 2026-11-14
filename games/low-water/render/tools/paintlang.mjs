// The paint language on a baked plate (render/v2/language.mjs), for proofs and per-era variants without a rebake:
// reads <dir>/<variant>.png, geo-id.u8 (full size) and geo-pos.f32 (geoScale), writes <out>/<name>.png for each
// setting and a metrics JSON (palette entropy, value range, edge coherence, broken share), the untouched plate
// measured as "before".
//   node render/tools/paintlang.mjs --dir render/preview/v2/q_square_wide --variant dawn --out DIR
//        --set "era1:era=1;era2:era=2;era5:era=5;decay:era=2,decay=0.8;light:sl=1" [--frost 0.5] [--mist 0] [--nrm nrm.f32]
//   sl=k runs stroke light (render/v2/strokelight.mjs) at strength k first, terms=1 with the light model's terms
//   (render/v2/lightterms.mjs); era=0 skips the language
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { language, measures } from "../v2/language.mjs";
import { strokeLight } from "../v2/strokelight.mjs";
import { lightTerms } from "../v2/lightterms.mjs";
import { BY_ID } from "../kit/ids.mjs";
import { rn } from "../rn.mjs";
const { readPng, writePng } = await import(rn("tools/shaders/png.mjs"));
const argv = process.argv.slice(2), opt = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1];
const dir = opt.dir, variant = opt.variant, out = opt.out || join(dir, "lang"); mkdirSync(out, { recursive: true });
const pl = JSON.parse(readFileSync(join(dir, "place.json"), "utf8")), img = readPng(join(dir, `${variant}.png`)), W = img.width, H = img.height;
const id = new Uint8Array(readFileSync(join(dir, "geo-id.u8")).buffer.slice(0)), gs = pl.geoScale || 0.5, gw = Math.round(W * gs), gh = Math.round(H * gs);
const pos = new Float32Array(readFileSync(join(dir, "geo-pos.f32")).buffer.slice(0));
// depth along the camera's forward from the world positions (half size, read up)
const y = (pl.camera.yawDeg * Math.PI) / 180, e = (pl.camera.elevDeg * Math.PI) / 180, fwd = [-Math.sin(y) * Math.cos(e), -Math.sin(e), -Math.cos(y) * Math.cos(e)];
const depth = new Float32Array(W * H);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const s = Math.min(gh - 1, Math.floor(j * gs)) * gw + Math.min(gw - 1, Math.floor(i * gs)); depth[j * W + i] = pos[s * 3] * fwd[0] + pos[s * 3 + 1] * fwd[1] + pos[s * 3 + 2] * fwd[2]; }
const names = []; for (const k of BY_ID) if (k) names[k.id] = k.name;
const nrm = opt.nrm ? new Float32Array(readFileSync(opt.nrm).buffer.slice(0)) : null;   // the bake's normals (render/.tmp/<place>[-pv]/nrm.f32), for stroke light
const report = { plate: dir, variant, before: measures(img.data, W, H), after: {} };
for (const spec of String(opt.set || "era2:era=2").split(";")) {
  const [nm, kv] = spec.split(":"), o = { frost: +(opt.frost || 0), mist: +(opt.mist || 0) };
  for (const p of (kv || "").split(",").filter(Boolean)) { const [k, v] = p.split("="); o[k] = +v; }
  const t0 = Date.now(); let base = img.data, sl = null;
  const terms = o.sl && o.terms ? await lightTerms({ dir, W, H }) : null;
  if (o.sl) { sl = strokeLight(base, W, H, { id, nrm, names, cam: pl.camera, terms }, { seed: 7, scale: W / 1920 * 2, strength: o.sl }); base = sl; }
  const r = o.era ? language(base, W, H, { id, depth, names }, o) : base;
  writePng(join(out, `${nm}.png`), { width: W, height: H, data: r });
  report.after[nm] = { settings: o, ...measures(r, W, H), brokenShare: +(o.era ? r.stats.brokenShare : 0).toFixed(3), ...(sl ? { strokes: sl.stats.strokes, sources: sl.stats.sources } : {}), ms: Date.now() - t0 };
  console.log(`paintlang: ${nm} ${JSON.stringify(report.after[nm])}`);
}
writeFileSync(join(out, "metrics.json"), JSON.stringify(report, null, 1));
