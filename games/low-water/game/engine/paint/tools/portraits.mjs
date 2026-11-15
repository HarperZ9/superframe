// Painted dialogue portraits (paint/portrait/): each sitter posed and framed head and shoulders (sit.mjs), a
// study made of one light (study.mjs) and painted (painter.mjs). Moods come from the voice bible's
// portraitCue (game/engine/dialogue/direction.mjs: an emotion and intensity, and the lie flag), mapped onto
// the old head's expression units or the sculpted head's sliders. Writes <out>/<who>/<mood>.png and, with
// --debug, the study beside each. Run under the heavy-cpu lock, a few sitters a job.
//   node game/engine/paint/tools/portraits.mjs --out DIR [--sculpted] [--who fewell,marrow] [--mood neutral,warm,lying]
//        [--w 640 --h 800] [--debug] [--gaze dx,dy] [--brushmood] (the mood in the brushwork: PAINT-LANGUAGE.md)
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
if (opt.sculpted) process.env.LW_SCULPTED_HEADS = "1";   // before the rig is imported (forge/heads.mjs reads it once)
const here = new URL("../../../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), root = opt.root || here;
const ch = (p) => pathToFileURL(join(root, "characters", p)).href;
const { roster } = await import(ch("proto/heads_roster.mjs")), { EXPRESSIONS } = await import(ch("cast/parts.mjs"));
const { writePng, toRgba8 } = await import(ch("render/io.mjs"));
const { sit } = await import("../portrait/sit.mjs"), { paintPortrait } = await import("../portrait/painter.mjs");
const { MOODS, exprFor } = await import("../portrait/moods.mjs");
// the voice bible's mapping from a line's direction to the face (another lead's module; read where it is)
let portraitCue = null;
for (const r of [root]) { const p = join(r, "game/engine/dialogue/direction.mjs"); if (existsSync(p)) { ({ portraitCue } = await import(pathToFileURL(p).href)); break; } }
if (!portraitCue) throw new Error("portraits: game/engine/dialogue/direction.mjs (portraitCue) not found");

const out = opt.out || "game/capture/paint/portraits", W = +(opt.w || 640), H = +(opt.h || 800);
const members = { ...(await roster()), ...(await quotaCast()) }, timing = JSON.parse(readFileSync(join(root, "characters/anim/timing.json"), "utf8"));
const who = (opt.who || "fewell,marrow,fennick,sabine").split(","), moods = (opt.mood || "neutral").split(",");
const log = [];
// The Quota's cast (characters/cast/quota.mjs): every exported member by its id (ned, mary, pell, pell_adult, abel, ...)
async function quotaCast() {
  try { const Q = await import(ch("cast/quota.mjs")), o = {}; for (const v of Object.values(Q)) if (v && typeof v === "object" && typeof v.build === "function" && v.info?.quota?.id) o[v.info.quota.id] = { ...v }; return o; }
  catch (e) { console.warn(`portraits: no Quota cast (${e.message})`); return {}; }
}
for (const w of who) {
  const C = members[w]; if (!C) { console.log(`portraits: no ${w}`); continue; }
  mkdirSync(join(out, w), { recursive: true });
  for (const m of moods) {
    const t0 = Date.now(), { cue, ...expr } = exprFor(portraitCue, EXPRESSIONS, MOODS[m] || {}, !!opt.sculpted);
    const s = sit({ C, who: w, expr, timing, w: W, h: H });
    const seed = [...w].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    const img = paintPortrait({ G: s.G, A: s.A, face: s.face, seed, opts: { cue, dir: opt.brushmood ? MOODS[m] || {} : {}, ...(opt.gaze ? { gaze: opt.gaze.split(",").map(Number) } : {}) } });
    writePng(join(out, w, `${m}.png`), { width: W, height: H, data: toRgba8(img, W, H) });
    if (opt.debug) { const a = new Float32Array(W * H * 4); for (let i = 0; i < W * H; i++) { a[i * 4] = img.ref[i * 3]; a[i * 4 + 1] = img.ref[i * 3 + 1]; a[i * 4 + 2] = img.ref[i * 3 + 2]; a[i * 4 + 3] = 1; } writePng(join(out, w, `${m}.study.png`), { width: W, height: H, data: toRgba8(a, W, H) }); }
    const rec = { who: w, mood: m, sculpted: !!opt.sculpted, cue, neck: s.neck, eyes: img.info.eyes, strokes: img.info.strokes, ms: Date.now() - t0 };
    log.push(rec); console.log(`portraits: ${w} ${m} ${rec.ms} ms, neck shift ${s.neck.shiftPx} px, eyes ${JSON.stringify(rec.eyes)}`);
  }
}
writeFileSync(join(out, `log-${process.pid}.json`), JSON.stringify(log, null, 1));
