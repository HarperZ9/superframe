// Saves, settings and the world record on disk (save/filestore.mjs), and local crash reports (ui/crash.mjs).
// design/COMPLETION.md B4 and B6. Each check that can pass on a store that does nothing has a control that
// must fail it: tools/worldfile.mjs (plain files, no envelope) and the file store with its checks turned off.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileStore, nodeBridge, pathOf, decode, envelope, openStorage, installFileStorage, localStorageFace, FILE_FORMAT, KEEP_CORRUPT } from "../save/filestore.mjs";
import { installCrashReporter, scrub, MAX_PER_SESSION, KEEP } from "../ui/crash.mjs";
import { fileStorage } from "../tools/worldfile.mjs";
import { createSaves, browserStorage, memoryStorage } from "../save/save.mjs";
import { createWorldRecord } from "../save/worldrecord.mjs";
import { newSheet } from "../rules/sheet.mjs";
import { game } from "./helpers.mjs";

const fresh = () => fs.mkdtempSync(join(tmpdir(), "lw-filestore-")).replace(/\\/g, "/");
const store = (dir, o) => createFileStore(nodeBridge(dir, fs), o);
const SAVE_KEY = "lowwater.save.1";
const saveText = (clock) => JSON.stringify({ format: "low-water.save", version: 5, slot: "1", summary: { clock }, state: { place: "q.kitchen" } });
const disk = (dir, p) => fs.readFileSync(join(dir, p), "utf8");

// Controls. A plain-file store at the same paths as the file store, so a planted fault lands where it would.
const plain = (dir) => {
  const f = (k) => join(dir, pathOf(k));
  return { get: (k) => (fs.existsSync(f(k)) ? fs.readFileSync(f(k), "utf8") : null), set: (k, v) => { fs.mkdirSync(join(f(k), ".."), { recursive: true }); fs.writeFileSync(f(k), v); }, remove: (k) => fs.rmSync(f(k), { force: true }) };
};
const STORES = {
  filestore: (dir) => store(dir),
  "control: plain files": (dir) => plain(dir),
  "control: tools/worldfile.mjs": (dir) => { const s = fileStorage(dir); return { ...s, path: (k) => `${k.replace(/[^\w.-]/g, "_")}.json` }; },
  "control: checks off": (dir) => store(dir, { verify: false }),
};
const where = (S, k) => (S.path ? S.path(k) : pathOf(k));

// The check: write two saves, damage the live file so it still parses, read it back. Passes only when the store
// notices the damage and gives the last good save.
function corruptDetected(make) {
  const dir = fresh(), S = make(dir); S.set(SAVE_KEY, saveText(600)); S.set(SAVE_KEY, saveText(700));
  const p = join(dir, where(S, SAVE_KEY)); fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/("clock":\s*)700/, "$1701"));
  assert.ok(fs.readFileSync(p, "utf8").includes("701"), "the damage was planted");
  return make(dir).get(SAVE_KEY) === saveText(600);
}
// The check: the live file is gone; the store gives the last good copy.
function missingFallsBack(make) {
  const dir = fresh(), S = make(dir); S.set(SAVE_KEY, saveText(600)); S.set(SAVE_KEY, saveText(700));
  fs.rmSync(join(dir, where(S, SAVE_KEY)));
  return make(dir).get(SAVE_KEY) === saveText(600);
}

test("a corrupted save is detected and the last good one read; both controls miss it", () => {
  assert.equal(corruptDetected(STORES.filestore), true, "the file store");
  for (const c of ["control: plain files", "control: tools/worldfile.mjs", "control: checks off"]) assert.equal(corruptDetected(STORES[c]), false, `${c} must fail the check`);
});

test("a missing file falls back to the last good copy; the controls give nothing", () => {
  assert.equal(missingFallsBack(STORES.filestore), true, "the file store");
  for (const c of ["control: plain files", "control: tools/worldfile.mjs"]) assert.equal(missingFallsBack(STORES[c]), false, `${c} must fail the check`);
});

test("files: one per slot, an envelope with a version, the last good copy as .bak, read back after write", () => {
  const dir = fresh(), S = store(dir, { build: "b-test" });
  S.set(SAVE_KEY, saveText(600)); S.set(SAVE_KEY, saveText(700));
  const live = JSON.parse(disk(dir, "saves/slot-1.json")), bak = JSON.parse(disk(dir, "saves/slot-1.json.bak"));
  assert.equal(live.format, FILE_FORMAT); assert.equal(live.version, 1); assert.equal(live.key, SAVE_KEY); assert.equal(live.build, "b-test");
  assert.equal(live.data.summary.clock, 700, "a save reads as JSON on disk"); assert.equal(bak.data.summary.clock, 600);
  assert.deepEqual(fs.readdirSync(join(dir, "saves")).sort(), ["slot-1.json", "slot-1.json.bak"], "no .tmp left behind");
  assert.equal(S.get(SAVE_KEY), saveText(700)); assert.equal(S.lastSlot(), "1");
  assert.equal(pathOf("lowwater.save.auto"), "saves/slot-auto.json");
  assert.equal(pathOf("lw.world.quota"), "world/quota.json"); assert.equal(pathOf("lw.world.quota.b"), "world/quota.b.json");
  assert.equal(pathOf("lowwater.prefs"), "settings/lowwater.prefs.json");
  assert.notEqual(pathOf("a/b"), pathOf("a_b"), "two keys never share a file");
  assert.equal(S.get("lowwater.save.2"), null, "an empty slot is empty");
  // a value that is not compact JSON is kept as text, exactly
  S.set("lw.tilt", "warm "); assert.equal(S.get("lw.tilt"), "warm "); assert.equal(JSON.parse(disk(dir, pathOf("lw.tilt"))).text, "warm ");
});

test("a damaged file is moved aside and kept for the report, at most KEEP_CORRUPT of them", () => {
  const dir = fresh(), seen = [], S = store(dir, { onIncident: (e) => seen.push(e.kind) });
  S.set(SAVE_KEY, saveText(600)); S.set(SAVE_KEY, saveText(700));
  fs.writeFileSync(join(dir, "saves/slot-1.json"), disk(dir, "saves/slot-1.json").slice(0, 90)); // truncated
  assert.equal(S.get(SAVE_KEY), saveText(600), "a truncated file falls back to .bak");
  const kept = fs.readdirSync(join(dir, "saves")).filter((n) => n.includes(".corrupt-"));
  assert.equal(kept.length, 1); assert.equal(disk(dir, `saves/${kept[0]}`).length, 90, "the bad file is kept as it was");
  assert.deepEqual(seen, ["corrupt", "restored"]);
  assert.equal(JSON.parse(disk(dir, "saves/slot-1.json")).data.summary.clock, 600, "the live file is written back from .bak");
  for (let i = 0; i < KEEP_CORRUPT + 2; i++) { fs.writeFileSync(join(dir, "saves/slot-1.json"), "{"); S.get(SAVE_KEY); }
  assert.equal(fs.readdirSync(join(dir, "saves")).filter((n) => n.includes(".corrupt-")).length, KEEP_CORRUPT);
  const inc = S.incidents().find((e) => e.kind === "corrupt");
  assert.match(inc.kept, /^saves\/slot-1\.json\.corrupt-/, "incidents name relative paths only");
});

// A bridge that dies on its n-th call, part way through a write when that call is a write.
function dying(dir, n) {
  const B = nodeBridge(dir, fs); let k = 0;
  const die = () => { if (++k === n) throw new Error("killed"); };
  return { ...B, read: B.read, list: B.list, write: (p, t) => { if (k + 1 === n) { fs.writeFileSync(join(dir, p), t.slice(0, t.length >> 1)); } die(); B.write(p, t); }, rename: (a, b) => { die(); B.rename(a, b); }, remove: (p) => { die(); B.remove(p); } };
}

test("a write killed at any step leaves the old save or the new one whole; a plain write leaves half", () => {
  const outcomes = new Set();
  for (let n = 1; n <= 12; n++) {
    const dir = fresh(); store(dir).set(SAVE_KEY, saveText(600)); store(dir).set(SAVE_KEY, saveText(650));
    try { createFileStore(dying(dir, n)).set(SAVE_KEY, saveText(700)); } catch (e) { assert.equal(e.message, "killed"); }
    assert.equal(decode(disk(dir, pathOf(SAVE_KEY)), SAVE_KEY).ok, true, `killed at call ${n}: the live file is whole before any recovery`);
    const got = store(dir).get(SAVE_KEY);
    assert.ok(got === saveText(650) || got === saveText(700), `killed at call ${n}: read ${String(got).slice(0, 60)}`);
    outcomes.add(got === saveText(700) ? "new" : "old");
  }
  assert.deepEqual([...outcomes].sort(), ["new", "old"], "the kills land both before and after the last rename");
  // a whole .tmp beside a missing live file is a write killed before its last rename: it is the newest
  const d2 = fresh(); store(d2).set(SAVE_KEY, saveText(650));
  fs.writeFileSync(join(d2, `${pathOf(SAVE_KEY)}.tmp`), JSON.stringify(envelope(SAVE_KEY, saveText(700)))); fs.rmSync(join(d2, pathOf(SAVE_KEY)));
  assert.equal(store(d2).get(SAVE_KEY), saveText(700), "the whole .tmp is promoted over the older .bak");
  assert.equal(fs.existsSync(join(d2, `${pathOf(SAVE_KEY)}.tmp`)), false);
  // the control: a plain write killed half way
  const dir = fresh(), P = plain(dir); P.set(SAVE_KEY, saveText(650));
  fs.writeFileSync(join(dir, pathOf(SAVE_KEY)), saveText(700).slice(0, 40));
  assert.notEqual(P.get(SAVE_KEY), saveText(650), "control: the plain store has lost the old save");
});

test("versions: a bare file (version 0) is upgraded on read; a newer file is left alone and not overwritten", () => {
  const dir = fresh(); fs.mkdirSync(join(dir, "world"), { recursive: true });
  const bare = JSON.stringify({ format: "low-water.world", version: 1, story: "quota", runs: [], sum: "x" });
  fs.writeFileSync(join(dir, "world/quota.json"), bare);
  const S = store(dir); assert.equal(S.get("lw.world.quota"), bare);
  assert.equal(JSON.parse(disk(dir, "world/quota.json")).format, FILE_FORMAT, "rewritten in the envelope");
  assert.equal(disk(dir, "world/quota.json.bak"), bare, "the bare file kept as .bak");
  const newer = JSON.stringify({ ...envelope("lw.world.quota", bare), version: 99 });
  fs.writeFileSync(join(dir, "world/quota.json"), newer);
  assert.equal(S.get("lw.world.quota"), null);
  assert.throws(() => S.set("lw.world.quota", "{}"), /newer build/);
  assert.equal(disk(dir, "world/quota.json"), newer, "the newer file is untouched");
  assert.equal(decode(newer, "lw.world.quota").newer, true);
  assert.equal(decode(disk(dir, "world/quota.json.bak"), "lw.world.quota").ok, true);
  assert.match(decode(JSON.stringify(envelope("lowwater.save.2", "1")), SAVE_KEY).why, /holds/, "a file copied over the wrong slot is caught");
});

test("remove clears a slot with its copies; the bridge refuses paths outside its root", () => {
  const dir = fresh(), S = store(dir); S.set(SAVE_KEY, saveText(600)); S.set(SAVE_KEY, saveText(700)); S.remove(SAVE_KEY);
  assert.equal(S.get(SAVE_KEY), null, "a removed slot does not come back from .bak");
  const B = nodeBridge(dir, fs);
  for (const p of ["../x.json", "/etc/x", "C:/x", "saves/../../x"]) assert.throws(() => B.read(p), /refused/);
});

test("in the game: saves, the world record and settings through the file store; the browser keeps its storage", async () => {
  const dir = fresh(), g = {}, S = installFileStorage(nodeBridge(dir, fs), { g });
  assert.ok(S && g.__lwFileStore === S);
  const G = game(), saves = createSaves(G, browserStorage(g.localStorage), { newSheet });
  G.create({ archetype: "a.clerk", enter: false }); G.advance(40);
  assert.equal(saves.save("3", "on disk"), null);
  assert.ok(fs.existsSync(join(dir, "saves/slot-3.json")));
  const H = game(), back = createSaves(H, browserStorage(localStorageFace(store(dir))), { newSheet });
  assert.equal(await back.load("3"), null); assert.equal(H.clock(), G.clock());
  const W = createWorldRecord(browserStorage(g.localStorage), "quota"); W.add({ run: "r1", facts: ["world.dead.tomas"] });
  assert.deepEqual(createWorldRecord(store(dir), "quota").priorFacts(), ["world.dead.tomas"]);
  assert.ok(fs.existsSync(join(dir, "world/quota.json")) && fs.existsSync(join(dir, "world/quota.b.json")));
  g.localStorage.setItem("lowwater.prefs", JSON.stringify({ textSize: 1.25 }));
  assert.equal(JSON.parse(disk(dir, "settings/lowwater.prefs.json")).data.textSize, 1.25);
  assert.ok(g.localStorage.length >= 4); g.localStorage.clear(); assert.equal(g.localStorage.length, 0);
  assert.equal(installFileStorage(null, { g: {} }), null, "no bridge: nothing is replaced");
  const mem = memoryStorage(); assert.deepEqual(openStorage({ bridge: null, browser: mem }), { storage: mem, kind: "browser" });
  assert.equal(openStorage({ bridge: nodeBridge(dir, fs) }).kind, "file");
});

// Crash reports. The names below stand for a player's own; the check fails if any reaches a report.
const PERSONAL = [/Ada\b/, /ada\.l@example\.com/, /lowwater\.local/, /token=/];
const personal = (text) => PERSONAL.filter((re) => re.test(text)).map(String);
const PLANTED = Object.assign(new Error("could not open C:\\Users\\Ada\\AppData\\Local\\Low Water\\saves for ada.l@example.com"), { stack: "Error: planted\n    at play (https://lowwater.local/ui/play.mjs?token=abc:12:7)\n    at /home/Ada/game.mjs:3:1" });

function reporter(dir) {
  const target = new EventTarget(), fsx = store(dir), C = installCrashReporter({ storage: fsx, build: "b-test", target, doc: null, fileStore: fsx });
  return { target, fsx, C };
}

test("a planted throw in the page writes a report with the build, slot and beats, and no personal data", () => {
  const dir = fresh(), { target, fsx, C } = reporter(dir), G = game();
  C.watchGame(G); fsx.set("lowwater.save.quick", saveText(600));
  G.create({ archetype: "a.clerk", enter: false }); G.emit("talk.choice", { node: "q.kitchen.tin", label: "My name is Ada" });
  target.dispatchEvent(Object.assign(new Event("error"), { error: PLANTED }));
  const ids = C.reports(); assert.equal(ids.length, 1);
  const file = `crash/${ids[0]}.json`, text = disk(dir, file), r = JSON.parse(text).data;
  assert.equal(r.format, "low-water.crash"); assert.equal(r.build, "b-test"); assert.equal(r.where, "page"); assert.equal(r.slot, "quick");
  assert.match(r.error.message, /<home>.*<email>/); assert.match(r.error.stack, /https:\/\/<host>\/ui\/play\.mjs:12:7/);
  assert.ok(r.beats.some((b) => b.ev === "talk.choice" && b.node === "q.kitchen.tin"));
  assert.ok(r.beats.every((b) => Object.keys(b).every((k) => ["ev", "id", "node", "place", "slot", "area"].includes(k))));
  assert.deepEqual(personal(text), [], "no personal data in the report");
  // the control: the same report without the scrub carries all of it
  assert.equal(personal(JSON.stringify({ message: PLANTED.message, stack: PLANTED.stack, label: "My name is Ada" })).length, PERSONAL.length, "control: the unscrubbed error must fail the check");
});

test("a planted throw in a worker writes a report, named or not; promises too; reports are capped and pruned", () => {
  const dir = fresh(), { target, C } = reporter(dir), w = new EventTarget();
  C.watchWorker(w, "plate");
  const ev = Object.assign(new Event("error", { cancelable: true }), { message: "Uncaught Error: planted in the worker", filename: "https://lowwater.local/ui/plateworker.mjs", lineno: 4, colno: 9 });
  w.dispatchEvent(ev);
  assert.equal(ev.defaultPrevented, true, "reported once, not again by the page");
  // a worker nobody watches: its error reaches the page with no error object (the HTML rule for dedicated workers)
  target.dispatchEvent(Object.assign(new Event("error"), { message: "Uncaught Error: planted in another worker", filename: "https://lowwater.local/paint/lightworker.mjs", lineno: 2, colno: 1 }));
  target.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: new Error("planted in a promise") }));
  const rs = C.reports().map((id) => C.read(id));
  assert.deepEqual(rs.map((r) => r.where), ["worker plate", "page", "page (promise)"]);
  assert.match(rs[0].error.stack, /^at https:\/\/<host>\/ui\/plateworker\.mjs:4:9$/);
  assert.match(rs[1].error.message, /planted in another worker/);
  for (let i = 0; i < 10; i++) target.dispatchEvent(Object.assign(new Event("error"), { error: new Error(`loop ${i}`) }));
  assert.equal(C.reports().length, MAX_PER_SESSION, "a throw in a loop cannot fill the disk");
  // across sessions only the newest KEEP stay
  for (let s = 0; s < 3; s++) { const R = installCrashReporter({ storage: store(dir), target: new EventTarget(), doc: null }); for (let i = 0; i < MAX_PER_SESSION; i++) R.report(new Error(`s${s} ${i}`)); }
  assert.equal(fs.readdirSync(join(dir, "crash")).filter((n) => n.endsWith(".json") && !n.startsWith("index")).length, KEEP);
});

test("scrub: home folders, hosts, query strings and e-mail addresses go; the file and line stay", () => {
  assert.equal(scrub("at f (http://127.0.0.1:8791/engine/ui/app.mjs?v=2:10:5)"), "at f (http://<host>/engine/ui/app.mjs:10:5)");
  assert.equal(scrub("open C:\\Users\\Ada\\x and D:/Users/ada/y"), "open <home>\\x and <home>/y");
  assert.equal(scrub("file:///C:/Users/Ada/game/x.mjs:1:2"), "file://<host>/<home>/game/x.mjs:1:2");
  assert.equal(scrub("from ada.l@example.com"), "from <email>");
});
