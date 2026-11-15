// A portrait end to end through the Studio's own code, from the command line: sit the reference, lay the
// underpainting, replay a scripted paint-over (tools/studio/script/) through the brush engine as stroke
// records, then export into the game and save the source. Writes the three columns (underpainting, the
// first full paint-over, the targeted combination), a before-and-after, and the three reference passes. Run under the heavy-cpu lock:
//   node tools/gpu-lock.mjs run --lock heavy-cpu "studio ned" -- node tools/studio/bin/portrait.mjs --who ned --sheet game/capture/studio-2026-10-21
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { castOf, newSitting } from "../core/session.mjs";
import { flatten, resample, exportPortrait, mergeIndex, mergeManifest, idOf, ROOT, OUT_W, OUT_H, toBytes, authorship } from "../core/export.mjs";
import { saveSource } from "../core/store.mjs";
import { edgesToRgba } from "../core/passes.mjs";
import { applyScript } from "../script/apply.mjs";
import { nodeSink } from "../node/sink.mjs";
import { useGame, loadCastFor } from "../core/game.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const argv = process.argv.slice(2), opt = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const who = opt.who || "ned", sheetDir = opt.sheet || "game/capture/studio-2026-10-21", sink = nodeSink(root), t0 = performance.now();
const log = (m) => console.log(`studio portrait: ${m} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);

await useGame(opt.game || "quota"); const { members, timing } = await loadCastFor();   // the game's cast (games/<name>.mjs)
const s = newSitting({ members, who, timing }), doc = s.doc; log(`sat ${who} at ${doc.w} x ${doc.h}`);
const before = resample(flatten(doc), doc.w, doc.h, OUT_W, OUT_H);

// the first, full paint-over, for comparison only (not exported)
const old = newSitting({ members, who, timing }); applyScript(old, { mode: "full" });
const full = resample(flatten(old.doc), doc.w, doc.h, OUT_W, OUT_H), fullShare = authorship(old.doc, old.ref.G.id).pixels.script ?? 0;
// the paint-over (script/apply.mjs, targeted): its layers under the person's empty "paint" layer, replayed as strokes
const res = applyScript(s); log(`script (${res.mode}): ${res.strokes} strokes replayed; eyes placed ${res.eyes}`);
const after = resample(flatten(doc), doc.w, doc.h, OUT_W, OUT_H);

const { entry } = await exportPortrait(doc, { mood: "neutral", sink, figure: s.ref.G.id });
const index = await sink.readJson(`${ROOT}/index.json`).catch(() => ({})), man = await sink.readJson(`${ROOT}/manifest.json`).catch(() => null);
await sink.json(`${ROOT}/index.json`, mergeIndex(index, [entry])); await sink.json(`${ROOT}/manifest.json`, mergeManifest(man, [entry]));
const src = await saveSource(s, sink, `${ROOT}/src/${idOf(doc.meta.person, doc.meta.era)}`); log(`exported ${entry.file}; source ${src.layers} layers, ${src.strokes} strokes`);

// the sheets: underpainting | full paint-over | targeted combination, and before | after
const row = (imgs) => { const n = imgs.length, o = new Float32Array(OUT_W * n * OUT_H * 4); imgs.forEach((p, k) => { for (let y = 0; y < OUT_H; y++) o.set(p.subarray(y * OUT_W * 4, (y + 1) * OUT_W * 4), (y * OUT_W * n + k * OUT_W) * 4); }); return toBytes(o, OUT_W * n * OUT_H); };
await sink.image(`${sheetDir}/${who}-three-columns.png`, OUT_W * 3, OUT_H, row([before, full, after]));
await sink.image(`${sheetDir}/${who}-before-after.png`, OUT_W * 2, OUT_H, row([before, after]));
log(`script share of the figure: full ${(fullShare * 100).toFixed(1)} percent, targeted ${((entry.authorship.pixels.script ?? 0) * 100).toFixed(1)} percent`);
const overGrey = (p) => { const o = new Float32Array(p.length); for (let i = 0; i < p.length; i += 4) { const a = p[i + 3]; for (let k = 0; k < 3; k++) o[i + k] = p[i + k] * a + 0.32 * (1 - a); o[i + 3] = 1; } return o; };
const passes = [s.ref.colour, s.ref.value, edgesToRgba(s.ref.edges, doc.w, doc.h)].map((p) => resample(overGrey(p), doc.w, doc.h, OUT_W, OUT_H));
const three = new Float32Array(OUT_W * 3 * OUT_H * 4);
passes.forEach((p, k) => { for (let y = 0; y < OUT_H; y++) three.set(p.subarray(y * OUT_W * 4, (y + 1) * OUT_W * 4), (y * OUT_W * 3 + k * OUT_W) * 4); });
await sink.image(`${sheetDir}/${who}-reference-passes.png`, OUT_W * 3, OUT_H, toBytes(three, OUT_W * 3 * OUT_H));
log(`wrote ${sheetDir}/${who}-before-after.png and ${who}-reference-passes.png; authorship ${JSON.stringify(entry.authorship)}`);
