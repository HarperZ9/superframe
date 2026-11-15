// What the Studio's buttons do, in the browser: load the cast, sit a reference, add a mood, carry the
// paint to another age or era, replay strokes, save and load the source, export into the game, and open
// a plate or prop image for paint-over. Every action goes through the same core the Node scripts use.
import { catalogue, newSitting, moodSitting, revariant, rebuildSitting } from "../core/session.mjs";
import { useGame, loadCastFor } from "../core/game.mjs";
import { loadPresets, savePreset as keepPreset } from "../core/presets.mjs";
import { createDoc, addLayer, composite } from "../core/doc.mjs";
import { createHistory } from "../core/history.mjs";
import { saveSource, loadSource } from "../core/store.mjs";
import { exportPortrait, mergeIndex, mergeManifest, idOf, ROOT, toBytes } from "../core/export.mjs";
import { moodsOf } from "../core/variants.mjs";
import { browserSink } from "./sink.mjs";
import { applyScript } from "../script/apply.mjs";
import { sceneKey, keyForSitter } from "../core/scenelight.mjs";

const sink = browserSink(), tick = () => new Promise((r) => setTimeout(r, 30));
export async function loadCast(name = "quota") {
  const cfg = await useGame(name), { members, timing } = await loadCastFor(cfg);   // the game's cast (games/<name>.mjs)
  return { members, timing, people: catalogue(members), game: cfg.name, title: cfg.title };
}
export async function sitNew(app, { who, cam, key, w, h }) {
  app.status(`rendering ${who}: reference and underpainting`, "busy"); await tick();
  app.sitting = newSitting({ members: app.cast.members, who, timing: app.cast.timing, cam, key, w, h }); await presetsFor(app);
  app.status(`${who}: reference and underpainting ready; paint on "paint"`, "ok");
}
export async function addMood(app, mood) {
  if (moodsOf(app.sitting.doc).includes(mood)) { app.status(`${mood} is already a layer group`, "drift"); return; }
  app.status(`rendering the ${mood} face`, "busy"); await tick(); moodSitting(app.sitting, mood); composite(app.sitting.doc);
  app.status(`${mood}: override and its paint layer added; repaint inside the region only`, "ok");
}
export async function carryTo(app, change) {
  app.status("re-rendering and carrying the paint through the form", "busy"); await tick();
  const r = revariant(app.sitting, change); app.sitting = r.sitting; app.showFlags = true;
  app.status(`carried; ${(r.flaggedShare * 100).toFixed(1)} percent of the figure needs repainting (shown in amber)`, r.flaggedShare > 0 ? "drift" : "ok");
}
export async function replayAll(app) {
  const n = app.sitting.doc.strokes.length; app.status(`replaying ${n} records on a fresh underpainting`, "busy"); await tick();
  app.sitting = rebuildSitting(app.sitting);
  app.status(`replayed ${n} records`, "ok");
}
const srcDir = (doc) => `${ROOT}/src/${idOf(doc.meta.person, doc.meta.era)}`;
export async function save(app) {
  const r = await saveSource(app.sitting, sink, srcDir(app.sitting.doc));
  app.status(`saved ${r.layers} painted layers and ${r.strokes} strokes to ${r.dir}`, "ok");
}
export async function load(app, id) {
  app.status(`loading ${id}`, "busy"); await tick();
  app.sitting = await loadSource(sink, `${ROOT}/src/${id}`, { members: app.cast.members, timing: app.cast.timing, newSitting, moodSitting });
  await presetsFor(app); app.status(`loaded ${id}: ${app.sitting.doc.strokes.length} strokes`, "ok");
}
export async function exportSet(app) {
  const d = app.sitting.doc, moods = ["neutral", ...moodsOf(d)], entries = [];
  for (const mood of moods) entries.push((await exportPortrait(d, { mood, sink, figure: app.sitting.ref?.G.id })).entry);
  const index = await sink.readJson(`${ROOT}/index.json`).catch(() => ({})), man = await sink.readJson(`${ROOT}/manifest.json`).catch(() => null);
  await sink.json(`${ROOT}/index.json`, mergeIndex(index, entries)); await sink.json(`${ROOT}/manifest.json`, mergeManifest(man, entries));
  await saveSource(app.sitting, sink, srcDir(d));
  app.status(`exported ${entries.length} portraits (${moods.join(", ")}) and the source`, "ok");
}
// a plate or prop image: the image locked as layer 1, a paint layer over it; exported beside its source
export async function openPlate(app, path) {
  const im = await sink.readImage(path), n = im.width * im.height, fill = new Float32Array(n * 4);
  for (let i = 0; i < n * 4; i++) fill[i] = im.data[i] / 255;
  const name = path.split("/").pop().replace(/\.png$/i, ""), doc = createDoc(im.width, im.height, { plate: path, name, keyDir: [-0.6, 0.3, 0.74] });
  addLayer(doc, { name: "underpainting", author: "source", locked: true, fill }); addLayer(doc, { name: "paint", author: "human" }); composite(doc);
  app.sitting = { doc, history: createHistory(doc), palette: app.sitting?.palette || [], ref: null, plate: true };
  app.status(`${path}: ${im.width} x ${im.height}, paint on "paint"`, "ok");
}
export async function exportPlate(app) {
  const d = app.sitting.doc, out = Float32Array.from(composite(d)), file = `content/paintover/${d.meta.name}.png`;
  await sink.image(file, d.w, d.h, toBytes(out, d.w * d.h)); await saveSource(app.sitting, sink, `content/paintover/src/${d.meta.name}`).catch((e) => app.status(e.message, "drift"));
  app.status(`wrote ${file}`, "ok");
}
// the scripted paint-over (script/): a starting point a person paints over, or a demonstration; its
// strokes are recorded as author "script", never "human"
export async function scriptPaint(app) {
  app.status("laying the scripted paint-over", "busy"); await tick();
  const r = applyScript(app.sitting, { mode: "targeted" });
  app.status(`scripted paint-over: ${r.strokes} strokes on ${r.layers.length} layers; your own work goes on "paint"`, "ok");
}
// brush presets: the starting set and the sitter's own (src/<id>/presets.json)
async function presetsFor(app) { app.presets = await loadPresets(sink, srcDir(app.sitting.doc)); }
export async function savePreset(app, name) {
  await keepPreset(sink, srcDir(app.sitting.doc), app.presets, name, { ...app.brush, tool: app.tool });
  app.presetName = name; app.status(`preset "${name}" saved with ${app.sitting.doc.meta.person}`, "ok");
}
// the key from the scene the portrait is used in (core/scenelight.mjs): "x, y, z, facing" in that scene
export async function sceneLight(app, text) {
  const v = String(text).split(/[\s,]+/).filter(Boolean).map(Number); if (v.length < 3 || v.some((n) => !Number.isFinite(n))) throw new Error('give the place as "x, y, z, facing"');
  const spec = { at: v.slice(0, 3), facing: v[3] || 0 }, k = await sceneKey(spec);
  if (!k) { app.status("no light model running here (it runs in the game); the portrait keeps its own key", "drift"); return; }
  app.form.key = keyForSitter(k, app.form.cam); await sitNew(app, app.form); app.sitting.doc.meta.lightFrom = { ...spec, key: k };
  app.status(`lit from the scene: key ${k.az} degrees from the face, ${k.el} up (${k.kind})`, "ok");
}
