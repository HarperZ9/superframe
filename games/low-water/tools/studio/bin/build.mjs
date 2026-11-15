// The release build step for painted portraits: every source in characters/portraits-painted/src/
// (doc.json and strokes.jsonl; images stay out of git) is rebuilt by replaying its strokes, and each of
// its moods is exported with the index and manifest. --check compares against the PNGs already there
// and fails (exit 1) when any channel differs by more than 1/255; a portrait whose head changed is
// re-baked instead, with the strokes it could not place flagged. Under the heavy-cpu lock:
//   node tools/gpu-lock.mjs run --lock heavy-cpu "studio build" -- node tools/studio/bin/build.mjs [--check] [--only ned@e2]
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { castOf, newSitting, moodSitting } from "../core/session.mjs";
import { loadSource, saveSource } from "../core/store.mjs";
import { flatten, resample, toBytes, exportPortrait, mergeIndex, mergeManifest, ROOT, OUT_W, OUT_H } from "../core/export.mjs";
import { moodsOf } from "../core/variants.mjs";
import { nodeSink } from "../node/sink.mjs";
import { useGame, loadCastFor } from "../core/game.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const argv = process.argv.slice(2), check = argv.includes("--check"), only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : null;
const game = argv.includes("--game") ? argv[argv.indexOf("--game") + 1] : "quota"; await useGame(game);
const sink = nodeSink(root), { members, timing } = await loadCastFor();
const ids = readdirSync(join(root, ROOT, "src")).filter((d) => existsSync(join(root, ROOT, "src", d, "doc.json")) && (!only || d === only));

async function compare(doc, mood, file) {
  if (!existsSync(join(root, file))) return { mood, missing: true };
  const want = await sink.readImage(file), got = toBytes(resample(flatten(doc, { mood }), doc.w, doc.h, OUT_W, OUT_H), OUT_W * OUT_H); let worst = 0;
  for (let i = 0; i < got.length; i++) if ((i & 3) !== 3) worst = Math.max(worst, Math.abs(got[i] - want.data[i]));
  return { mood, worst };
}
// a portrait whose head changed (its fingerprint) is re-baked: the reference rendered again, the strokes
// replayed on it, the images written, and the strokes it could not place listed (their places in the
// log saved as meta.unplaced) for a person to look at. Only a painting on an unchanged head can fail.
let failed = 0; const entries = [];
for (const id of ids) {
  const s = await loadSource(sink, `${ROOT}/src/${id}`, { members, timing, newSitting, moodSitting }), rebake = s.refChanged;
  if (rebake) console.log(`studio build: ${id}: the head changed since it was painted; re-baked and replayed, ${s.unplaced} stroke(s) could not be placed (flagged)`);
  for (const mood of ["neutral", ...moodsOf(s.doc)]) {
    const file = `${ROOT}/${id}/${mood}-paraffin.png`;
    if (check && !rebake) { const r = await compare(s.doc, mood, file); if (r.missing || r.worst > 1) failed++; console.log(`studio build: ${id} ${mood}: ${r.missing ? "no image to check" : `worst ${r.worst}/255`}`); continue; }
    const e = (await exportPortrait(s.doc, { mood, sink, figure: s.ref.G.id })).entry; if (rebake) e.unplaced = s.unplaced; entries.push(e); console.log(`studio build: ${id} ${mood} written${rebake ? " (re-baked)" : ""}`);
  }
  if (rebake) await saveSource(s, sink, `${ROOT}/src/${id}`);   // the source now records the new head's fingerprint
}
if (entries.length) {
  const index = await sink.readJson(`${ROOT}/index.json`).catch(() => ({})), man = await sink.readJson(`${ROOT}/manifest.json`).catch(() => null);
  await sink.json(`${ROOT}/index.json`, mergeIndex(index, entries)); await sink.json(`${ROOT}/manifest.json`, mergeManifest(man, entries));
}
if (failed) { console.error(`studio build: ${failed} portrait(s) do not match their rebuild within 1/255`); process.exit(1); }
