// Variants without repainting everything, shown end to end. Moods: a painted base (the scripted
// paint-over) gets a mood override per mood, and only that region is repainted (the script's eye and
// feature strokes, generated from the mood's own reference, into the mood's paint layer). Ages: the same
// person painted at one age is carried to another age record through the form, with the regions that
// need repainting flagged. Writes sheets and exports the mood portraits into the set. Under the lock:
//   node tools/gpu-lock.mjs run --lock heavy-cpu "studio variants" -- node tools/studio/bin/variants.mjs --moods ned:warm,lying --age anni:anni_adult
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { castOf, newSitting, moodSitting, revariant } from "../core/session.mjs";
import { replay } from "../core/stroke.mjs";
import { flatten, resample, exportPortrait, mergeIndex, mergeManifest, idOf, ROOT, OUT_W, OUT_H, toBytes } from "../core/export.mjs";
import { saveSource } from "../core/store.mjs";
import { applyScript } from "../script/apply.mjs";
import { landmarks } from "../script/landmarks.mjs";
import { eyeStrokes, featureStrokes } from "../script/face.mjs";
import { sitterPalette } from "../core/palette.mjs";
import { nodeSink } from "../node/sink.mjs";
import { useGame, loadCastFor } from "../core/game.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const argv = process.argv.slice(2), opt = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const sheetDir = opt.sheet || "game/capture/studio-2026-10-21", sink = nodeSink(root), t0 = performance.now();
const log = (m) => console.log(`studio variants: ${m} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
await useGame(opt.game || "quota"); const { members, timing } = await loadCastFor();   // the game's cast (games/<name>.mjs)

function sheet(images, path) {
  const n = images.length, out = new Float32Array(OUT_W * n * OUT_H * 4);
  images.forEach((p, k) => { for (let y = 0; y < OUT_H; y++) out.set(p.subarray(y * OUT_W * 4, (y + 1) * OUT_W * 4), (y * OUT_W * n + k * OUT_W) * 4); });
  return sink.image(path, OUT_W * n, OUT_H, toBytes(out, OUT_W * n * OUT_H));
}
const small = (doc, mood) => resample(flatten(doc, { mood }), doc.w, doc.h, OUT_W, OUT_H);

async function moods(who, list) {
  const s = newSitting({ members, who, timing }); applyScript(s); const entries = [], shots = [small(s.doc, "neutral")];
  for (const mood of list) {
    const { paint } = moodSitting(s, mood), mref = s.moodRefs[mood], lm = landmarks(mref), pal = sitterPalette(mref);
    const recs = [...featureStrokes(mref, lm, pal), ...eyeStrokes(mref, lm)].map((r) => ({ ...r, layer: paint.name }));
    replay(s.doc, recs, { history: s.history }); shots.push(small(s.doc, mood)); log(`${who} ${mood}: ${recs.length} strokes in its region`);
  }
  for (const mood of ["neutral", ...list]) entries.push((await exportPortrait(s.doc, { mood, sink, figure: s.ref.G.id })).entry);
  await sheet(shots, `${sheetDir}/${who}-moods.png`); await saveSource(s, sink, `${ROOT}/src/${idOf(s.doc.meta.person, s.doc.meta.era)}`);
  return entries;
}
async function age(from, to) {
  const s = newSitting({ members, who: from, timing }); applyScript(s); const a = small(s.doc, "neutral");
  const r = revariant(s, { who: to }), b = small(r.doc, "neutral"), flagged = Float32Array.from(b);
  const rep = resample(Float32Array.from({ length: r.doc.w * r.doc.h * 4 }, (_, i) => (i % 4 === 3 ? 1 : r.repaint[(i / 4) | 0])), r.doc.w, r.doc.h, OUT_W, OUT_H);
  for (let i = 0; i < OUT_W * OUT_H; i++) { const f = rep[i * 4]; flagged[i * 4] = flagged[i * 4] * (1 - f * 0.6) + 0.86 * f * 0.6; flagged[i * 4 + 1] = flagged[i * 4 + 1] * (1 - f * 0.6) + 0.55 * f * 0.6; flagged[i * 4 + 2] *= 1 - f * 0.6; }
  await sheet([a, b, flagged], `${sheetDir}/${from}-to-${to}.png`);
  log(`${from} -> ${to}: ${(r.flaggedShare * 100).toFixed(1)} percent of the figure flagged for repainting`);
  return r.flaggedShare;
}

const entries = [];
for (const spec of (opt.moods || "ned:warm,lying").split(";").filter((x) => x !== "none")) { const [who, list] = spec.split(":"); entries.push(...(await moods(who, list.split(",")))); }
if (entries.length) {
  const index = await sink.readJson(`${ROOT}/index.json`).catch(() => ({})), man = await sink.readJson(`${ROOT}/manifest.json`).catch(() => null);
await sink.json(`${ROOT}/index.json`, mergeIndex(index, entries)); await sink.json(`${ROOT}/manifest.json`, mergeManifest(man, entries));
  log(`exported ${entries.length} portraits`);
}
for (const spec of (opt.age || "anni:anni_adult").split(";").filter((x) => x !== "none")) { const [from, to] = spec.split(":"); await age(from, to); }
