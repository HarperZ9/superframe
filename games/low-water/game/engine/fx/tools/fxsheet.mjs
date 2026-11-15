// Effects proof, painted form: each scene's plate relit by the light model (before) and with the effects painted over it
// (after), at the scene's clock and a fixed time so stills repeat; a close crop of each scene's busiest region is
// written beside it at twice the size. Prints each effect's cost and primitive count. The glyph form is drawn by
// game/engine/light/tools/harness.html with fx=1 (tools/glyphsheet.mjs --fx).
//   node game/engine/fx/tools/fxsheet.mjs [--plates <dir>] [--out <dir>] [--quality high|low] [--t 4]
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readPng, writePng } from "../../light/tools/png.mjs";
import { sheet } from "../../light/tools/sheet.mjs";
import { stocksReader } from "../../light/tools/stocks.mjs";
import { sceneLight } from "../../light/proof.mjs";
import { relightRgba } from "../../light/consume.mjs";
import { fxContext, runEffects, fxSettings } from "../core.mjs";
import "../weather.mjs";
import "../fire.mjs";
import "../ground.mjs";
import "../decay.mjs";
import "../combat.mjs";
import "../dream.mjs";
import "../shafts.mjs";
import "../water.mjs";
import "../fog.mjs";
import { paintRgba } from "../paint.mjs";
import { FX_SCENES, figuresFor } from "./scenes.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const root = join(fileURLToPath(import.meta.url), "../../../../.."), plates = opt.plates || join(root, "game/capture/light/plates"), out = opt.out || join(root, "game/capture/fx/oil");
mkdirSync(out, { recursive: true });
const set = fxSettings(new URLSearchParams(`fx=${opt.quality || "high"}`)), cells = [], costs = {};
for (const sc of FX_SCENES) {
  if (opt.only && !opt.only.split(",").includes(sc.id)) continue;
  const dir = join(plates, sc.plate), pj = JSON.parse(readFileSync(join(dir, "place.json"), "utf8")), b = readFileSync(join(dir, "geo-pos.f32"));
  const geo = { pos: new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), ids: new Uint8Array(readFileSync(join(dir, "geo-id.u8"))) };
  const t = +(opt.t ?? sc.t ?? 4), L = sceneLight({ pj, geo, read: stocksReader(root, sc.state || "start"), hour: sc.hour, t, terms: sc.terms }), img = readPng(join(dir, `${pj.variants[0]}.png`));
  const before = { width: img.width, height: img.height, data: relightRgba(img.data, img.width, img.height, L.S.F, L.ratio, L.emit) }, figures = figuresFor(sc, pj);
  // a few seconds of history first, so footprints exist and breath is mid-cycle
  let ctx = null; for (let k = 0; k <= 8; k++) { const tk = t - 4 + k * 0.5; ctx = fxContext({ M: L.S.M, F: L.S.F, pj, t: tk, day: sc.day ?? 41, sync: true, figures: figures.map((f) => ({ ...f, at: [f.at[0] + (f.walk || 0) * tk, f.at[1], f.at[2]] })), wind: sc.wind ?? 0.4, prev: ctx }); ctx.events = sc.events || null; ctx.future = sc.future || null; if (k < 8) runEffects(ctx, set); }
  const r = runEffects(ctx, set), after = paintRgba({ width: before.width, height: before.height, data: before.data.slice() }, r.prims);
  costs[sc.id] = r.ms; writePng(join(out, `${sc.id}-before.png`), before); writePng(join(out, `${sc.id}-after.png`), after);
  cells.push({ img: before, label: `${sc.label} BEFORE` }, { img: after, label: `${sc.label} AFTER (${r.prims.length})` });
  if (sc.crop) { const [cx, cy, cw, ch] = sc.crop, crop = (im) => ({ width: cw, height: ch, data: (() => { const d = new Uint8ClampedArray(cw * ch * 4); for (let y = 0; y < ch; y++) d.set(im.data.subarray(((cy + y) * im.width + cx) * 4, ((cy + y) * im.width + cx + cw) * 4), y * cw * 4); return d; })() });
    cells.push({ img: crop(before), label: "CLOSE BEFORE" }, { img: crop(after), label: "CLOSE AFTER" }); }
  console.log(sc.id, JSON.stringify(r.ms));
}
writeFileSync(join(out, "costs.json"), JSON.stringify(costs, null, 1));
writePng(join(out, "sheet.png"), sheet(cells, { cols: 4, cellW: 480, cellH: 300, title: "EFFECTS: PAINTED FORM, BEFORE AND AFTER" }));
