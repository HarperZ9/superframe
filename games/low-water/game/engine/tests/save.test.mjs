import { test } from "node:test";
import assert from "node:assert/strict";
import { game, pick } from "./helpers.mjs";
import { createSaves, memoryStorage, migrate, SAVE_VERSION } from "../save/save.mjs";
import { newSheet } from "../rules/sheet.mjs";

test("save and load round-trip the state and the night", async () => {
  const G = game(), store = memoryStorage(), saves = createSaves(G, store, { newSheet });
  G.create({ archetype: "a.clerk", enter: false });
  const t = G.start(); pick(t, "Ask the first question.");
  G.advance(40); G.env.command(["setPower", "quay", "off"]); G.body.addWet(0.3);
  assert.equal(saves.save("1", "test"), null);
  const snap = JSON.stringify(G.state), clock = G.clock();
  const H = game(), hs = createSaves(H, store, { newSheet });
  assert.equal(await hs.load("1"), null);
  assert.equal(JSON.stringify(H.state), snap.replace('"version":0', `"version":${SAVE_VERSION}`));
  assert.equal(H.clock(), clock);
  assert.equal(H.env.term("power.quay"), "off");
  assert.equal(H.body.wet(), G.body.wet());
  assert.equal(await hs.load("2"), "Empty slot");
});

test("slots list their summaries; an unknown slot is refused", () => {
  const G = game(), saves = createSaves(G, memoryStorage(), { newSheet });
  saves.save("quick");
  const l = saves.list();
  assert.equal(l.length, 11);
  assert.equal(l.find((x) => x.slot === "quick").save.summary.time, "23:00");
  assert.throws(() => saves.save("99"), /no slot/);
});

test("old saves are upgraded: the prototype's v1 shape to v3", () => {
  const v1 = { version: 1, clock: 23 * 60 + 30, notes: ["met.keel"], place: "quay", power: "off", mother: "dark", wet: 0.4 };
  const { save, upgraded } = migrate(JSON.stringify(v1));
  assert.deepEqual(upgraded, [2, 3, 4, 5]);
  assert.equal(save.version, 5);
  assert.deepEqual(save.state.flags, ["met.keel"]);
  assert.deepEqual(save.env.power, { quay: "off" });
  assert.equal(save.state.body.wet, 0.4);
  assert.throws(() => migrate({ version: 99 }), /newer than this game/);
});

test("version 5: an open read-back becomes the witness scene, resumed from its first beat", () => {
  const v4 = { format: "low-water.save", version: 4, state: { version: 4, flags: ["q.tomas_held"], selfLies: [{ id: "q.sl.signed" }], saidWords: [{ flag: "said.ned_pencil" }], community: { day: 48 },
    readback: { id: "q.record", doc: { rows: [] }, shown: 3, lastAt: 10, closed: false } }, env: {} };
  const { save, upgraded } = migrate(JSON.stringify(v4));
  assert.deepEqual(upgraded, [5]);
  assert.equal(save.state.readback, undefined);
  assert.deepEqual({ id: save.state.witness.id, i: save.state.witness.i, closed: save.state.witness.closed, from: save.state.witness.from }, { id: "q.w.anni", i: -1, closed: false, from: "q.record" });
  assert.deepEqual(save.state.selfLies, [{ id: "q.sl.signed" }]);
  assert.deepEqual(save.state.saidWords, [{ flag: "said.ned_pencil" }]);
  assert.deepEqual(save.state.community, { day: 48 });
  // a save with no read-back open passes through with nothing added
  const plain = migrate({ ...v4, state: { version: 4, flags: [] } }).save;
  assert.equal(plain.state.witness, undefined);
});

test("ink mode: one slot, written on every action, no manual saves or loads", async () => {
  const G = game(), store = memoryStorage(), saves = createSaves(G, store, { newSheet });
  G.create({ archetype: "a.clerk", enter: false, ink: true });
  const stop = saves.watch();
  assert.equal(saves.save("1"), "Ink mode: the night saves itself");
  assert.equal(await saves.load("1"), "Ink mode: there is only the one night");
  G.setFlag("t.switch", true);
  assert.ok(JSON.parse(store.get("lowwater.save.auto")).state.flags.includes("t.switch"));
  stop();
});

test("autosave on the clock every N minutes and at the end of a conversation", () => {
  const G = game(), store = memoryStorage(), saves = createSaves(G, store, { newSheet, every: 10 });
  const stop = saves.watch();
  G.advance(5); assert.equal(store.get("lowwater.save.auto") === null, false, "the first tick saves");
  const first = JSON.parse(store.get("lowwater.save.auto")).summary.clock;
  G.advance(5); G.advance(6);
  assert.ok(JSON.parse(store.get("lowwater.save.auto")).summary.clock > first);
  stop();
});
