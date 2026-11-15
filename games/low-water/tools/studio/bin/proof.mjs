// A proof through the Studio's own code: underpainting, the targeted paint-over, the form override (planes
// and light from them; --form off to leave it out), each mood as an override
// with its eyes and mouth repainted, then a liquify pass that fixes the proportion (script/reshape.mjs),
// applied last so it moves the paint, the moods and the underpainting together. Exports the set, saves
// the source, and writes a sheet: underpainting | each mood, finished. Under the heavy-cpu lock:
//   node tools/gpu-lock.mjs run --lock heavy-cpu studio-proof -- node tools/studio/bin/proof.mjs --who will --moods angry
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { castOf, newSitting, moodSitting } from "../core/session.mjs";
import { replay } from "../core/stroke.mjs";
import { flatten, resample, exportPortrait, mergeIndex, mergeManifest, idOf, ROOT, OUT_W, OUT_H, toBytes } from "../core/export.mjs";
import { saveSource } from "../core/store.mjs";
import { sitterPalette } from "../core/palette.mjs";
import { applyScript, applyForm } from "../script/apply.mjs";
import { landmarks } from "../script/landmarks.mjs";
import { eyeStrokes, featureStrokes } from "../script/face.mjs";
import { reshapeRecords } from "../script/reshape.mjs";
import { nodeSink } from "../node/sink.mjs";
import { useGame, loadCastFor } from "../core/game.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const argv = process.argv.slice(2), opt = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const who = opt.who || "will", moods = String(opt.moods || "angry").split(",").filter(Boolean), sheetDir = opt.sheet || "game/capture/studio-2026-10-21", sink = nodeSink(root), t0 = performance.now();
const log = (m) => console.log(`studio proof: ${m} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
await useGame(opt.game || "quota"); const { members, timing } = await loadCastFor();   // the game's cast (games/<name>.mjs)

const s = newSitting({ members, who, timing }), doc = s.doc, small = (mood) => resample(flatten(doc, { mood }), doc.w, doc.h, OUT_W, OUT_H);
const under = small("neutral"); log(`sat ${who}`);
const res = applyScript(s); log(`targeted paint-over: ${res.strokes} strokes`);
if (opt.form !== "off") { const fr = applyForm(s); log(`form override: ${fr.strokes} strokes (planes, and light from them); underpainting showing through the planes: ${(fr.uncovered * 100).toFixed(2)} percent`); }
for (const mood of moods) {
  const { paint } = moodSitting(s, mood), mref = s.moodRefs[mood], lm = landmarks(mref);
  const recs = [...featureStrokes(mref, lm, sitterPalette(mref)), ...eyeStrokes(mref, lm)].map((r) => ({ ...r, layer: paint.name }));
  replay(doc, recs, { history: s.history }); log(`${mood}: ${recs.length} strokes in its region`);
}
const unshaped = small("neutral"), shape = reshapeRecords(s.ref, landmarks(s.ref), doc);
replay(doc, shape, { history: s.history }); log(`liquify pass: ${shape.length} records`);
const entries = []; for (const mood of ["neutral", ...moods]) entries.push((await exportPortrait(doc, { mood, sink, figure: s.ref.G.id })).entry);
const index = await sink.readJson(`${ROOT}/index.json`).catch(() => ({})), man = await sink.readJson(`${ROOT}/manifest.json`).catch(() => null);
await sink.json(`${ROOT}/index.json`, mergeIndex(index, entries)); await sink.json(`${ROOT}/manifest.json`, mergeManifest(man, entries));
await saveSource(s, sink, `${ROOT}/src/${idOf(doc.meta.person, doc.meta.era)}`);
const cols = [under, unshaped, ...["neutral", ...moods].map((m) => small(m))], n = cols.length, o = new Float32Array(OUT_W * n * OUT_H * 4);
cols.forEach((p, k) => { for (let y = 0; y < OUT_H; y++) o.set(p.subarray(y * OUT_W * 4, (y + 1) * OUT_W * 4), (y * OUT_W * n + k * OUT_W) * 4); });
await sink.image(`${sheetDir}/${who}-proof.png`, OUT_W * n, OUT_H, toBytes(o, OUT_W * n * OUT_H));
log(`wrote ${sheetDir}/${who}-proof.png (underpainting | painted, before liquify | ${["neutral", ...moods].join(" | ")}); script share ${JSON.stringify(entries[0].authorship)}`);
