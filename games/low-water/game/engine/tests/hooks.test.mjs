import { test } from "node:test";
import assert from "node:assert/strict";
import { game } from "./helpers.mjs";
import { createSaves, memoryStorage } from "../save/save.mjs";
import { newSheet } from "../rules/sheet.mjs";
import { toMin } from "../core/expr.mjs";

test("the fixed-step loop runs systems in order and moves the clock at clockRate", () => {
  const G = game(), seen = [];
  G.loop.add("b", () => seen.push("b"), { order: 60 });
  G.loop.add("a", () => seen.push("a"), { order: 20 });
  assert.deepEqual(G.loop.systems(), ["hazards", "interrogation", "a", "animation", "b"]);
  assert.equal(G.loop.frame(1 / 60 + 1e-6), 1);
  assert.deepEqual(seen, ["a", "b"]);
  assert.equal(G.loop.frame(10), 8, "at most 8 steps per frame");
  const c0 = G.clock(); G.loop.clockRate = 4;
  for (let i = 0; i < 60 * 8; i++) G.loop.step();
  assert.equal(G.clock() - c0, 2, "8 real seconds at 4 s a minute");
  assert.throws(() => G.loop.add("a", () => {}), /already added/);
});

test("input: held values persist, presses last one step", () => {
  const G = game(); let saw = null;
  G.loop.add("reader", () => { saw = G.input.pressed("attack"); });
  G.input.set("move", { x: 1, z: 0 }); G.input.press("attack");
  G.loop.step(); assert.equal(saw, true);
  G.loop.step(); assert.equal(saw, false);
  assert.deepEqual(G.input.get("move"), { x: 1, z: 0 });
});

test("register(): an extension's state is saved, migrated and handed back on load", async () => {
  const store = memoryStorage(), G = game(), saves = createSaves(G, store, { newSheet });
  G.register("combat", { name: "x" }, { state: () => ({ stance: "low" }), version: 1 });
  G.state.ext.combat.stance = "guard"; saves.save("1");
  const H = game(); let got = null;
  H.register("combat", {}, { state: () => ({ stance: "low" }), version: 2, migrate: (s) => ({ ...s, poise: 3 }), onLoad: (s) => { got = s; } });
  await createSaves(H, store, { newSheet }).load("1");
  assert.deepEqual(got, { version: 2, stance: "guard", poise: 3 });
  assert.throws(() => H.register("combat", {}), /already registered/);
});

test("envAt(): footing from the place and weather, wind as a vector, depth from water", () => {
  const G = game(); G.setPlace("t.yard");
  assert.equal(G.envAt().footing, "stone");
  G.env.command(["setTerm", "rain", "2"]);
  assert.equal(G.envAt().footing, "wet stone");
  G.env.command(["setTerm", "frost", "1"]);
  const e = G.envAt({ groundY: 0, waterY: 0.3 });
  assert.equal(e.footing, "water"); assert.ok(Math.abs(e.depth - 0.3) < 1e-9);
  assert.equal(G.envAt().footing, "frost"); assert.equal(G.envAt().grip, 0.35);
  G.env.command(["setTerm", "wind.dir", "270"]); G.env.command(["setTerm", "wind.speed", "10"]);
  assert.ok(Math.abs(G.envAt().wind.x - 10) < 1e-9, "a westerly blows east");
  G.setPlace("t.room"); assert.equal(G.envAt().footing, "stone", "indoors: no frost or rain");
});

test("animation: events and phases from data, rate from an expression, next clip", () => {
  const G = game(), ev = []; G.on("*", (d, name) => { if (name.startsWith("anim.")) ev.push(`${name}:${d.name || d.clip}${d.on === undefined ? "" : d.on ? "+" : "-"}`); });
  const a = G.anims.actor("t.lamb");
  assert.equal(a.play("t.swing"), true);
  for (let i = 0; i < 60; i++) G.loop.step();
  assert.deepEqual(ev.slice(0, 5), ["anim.start:t.swing", "anim.phase:active+", "anim.event:whoosh", "anim.phase:active-", "anim.start:t.walk"]);
  assert.equal(a.state().clip, "t.walk");
  assert.equal(a.play("nope"), false);
  const H = game(); H.create({ archetype: "a.diver", enter: false }); // knots 4 + 1 rank = 5
  const b = H.anims.actor("t.lamb"); b.play("t.swing"); H.anims.update(0.1);
  assert.ok(Math.abs(b.state().t - 0.12) < 1e-9, "rate 1.2 at knots 5");
});

test("a run with no drawn ground gets a course built from its hazards and params", () => {
  const G = game(); G.advance(toMin("23:20") - G.clock());
  const r = G.runs.start("t.built", { mode: "stepped" }), v = r.view();
  assert.ok(v.rects.length >= 16 && v.frost.length > 0 && v.pursuer && v.climb.length === 1);
  assert.equal(v.goal.name, "test steps");
  const H = game(); H.advance(toMin("23:20") - H.clock());
  const q = H.runs.start("t.built");
  for (let i = 0; i < 4000 && !q.state.done; i++) q.step(0.05, {});
  assert.deepEqual([q.state.outcome, q.state.reason], ["lose", "swept"], "standing still, the tide takes Lamb");
  assert.ok(Number.isFinite(v.waterY), "a hazard reading the tide builds water");
});
