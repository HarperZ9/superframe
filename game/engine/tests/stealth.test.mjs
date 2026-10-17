import { test } from "node:test";
import assert from "node:assert/strict";
import { game, testContent } from "./helpers.mjs";
// A stand-in for the combat layer: the hand-off is the engine's, the fight is combat's.
const withCombat = () => { const G = game(); G.register("combat", { request(id) { G.state.pendingFight = id; }, take() { const id = G.state.pendingFight; delete G.state.pendingFight; return id; } }); return G; };
import { footstep, masking, stateOf, visibility } from "../world/stealth.mjs";

const states = (G) => { const out = []; G.on("stealth.state", (e) => out.push(`${e.watcher}:${e.to}${e.say ? ` "${e.say}"` : ""}`)); return out; };
const darkYard = (G) => { const s = G.sneaks.start("s.yard", { mode: "stepped" }); G.command(["setPower", "quay", "off"]); return s; };

test("footsteps by footing and pace; wind and rain mask sound; states from awareness", () => {
  assert.ok(footstep("water", "walk") > footstep("stone", "walk") && footstep("stone", "walk") > footstep("mud", "walk"));
  assert.ok(footstep("stone", "run") > footstep("stone", "walk") && footstep("stone", "walk") > footstep("stone", "crouch"));
  assert.ok(Math.abs(footstep("wet stone", "walk") - 0.385) < 1e-9);
  assert.ok(masking({ wind: { speed: 16 }, rain: 3 }) < masking({ wind: { speed: 0 }, rain: 0 }));
  assert.deepEqual([stateOf(0.1, true), stateOf(0.5, false), stateOf(0.8, false), stateOf(1.2, false), stateOf(1.2, true)], ["unaware", "suspicious", "searching", "searching", "seen"]);
});

test("in the dark, crouched, Lamb crosses the yard unseen", () => {
  const G = game(), s = darkYard(G);
  for (let i = 0; i < 200 && !s.state.done; i++) s.stepMove(6 - s.state.x, 2 - s.state.z, { crouch: true });
  assert.equal(s.state.outcome, "win");
  assert.deepEqual(G.sneaks.finish(), { node: "t.y.win" });
  assert.equal(G.scope.get("sneak.s.yard"), "win");
});

test("lit, walking into the cone: seen, remembered, written down, and favour lost", () => {
  const G = game(), seen = states(G), s = G.sneaks.start("s.yard", { mode: "stepped" });
  for (let i = 0; i < 200 && !s.state.done; i++) s.stepMove(3 - s.state.x, 5.5 - s.state.z);
  assert.equal(s.state.outcome, "seen");
  assert.ok(seen.includes('w.guard:seen "Test: you, stop!"'), seen.join(", "));
  assert.deepEqual(G.sneaks.finish(), { node: "t.y.caught" });
  assert.ok(G.flag("seen.w.guard") && G.flag("book.s.yard"), "lamplighter role writes it down");
  assert.equal(G.factions.get("board"), 9, "board started at 10; rep -1");
});

test("sound alone raises suspicion and a search, never an alert; the watcher says so", () => {
  const G = game(), seen = states(G), s = darkYard(G);
  G.inv.give("glass", 5);
  for (let i = 0; i < 5; i++) { s.throwNoise([3, 6]); s.step(0.5, {}); }
  assert.ok(seen.some((x) => x.startsWith('w.guard:suspicious "Test: what was that?"')), seen.join(", "));
  for (let i = 0; i < 40; i++) { if (G.inv.count("glass")) s.throwNoise([3, 6]); s.step(0.25, {}); }
  assert.notEqual(s.state.outcome, "seen");
  assert.equal(G.inv.count("glass"), 0, "param throw: each distraction uses up a glass");
  for (let i = 0; i < 200; i++) s.step(0.25, {});
  assert.ok(seen.at(-1).startsWith("w.guard:unaware"), "the search ends: 'lost'");
});

test("a hiding spot covers a still Lamb in the light", () => {
  // the guard stands 3 m off, facing Lamb; one quarter second of looking
  const vis = (hidden) => { const G = game(), s = G.sneaks.start("s.yard", { mode: "stepped" }), g = s.state.W[0]; Object.assign(g, { x: 2, z: 5, face: Math.PI }); Object.assign(s.state, hidden ? { x: 2, z: 2 } : { x: 3.5, z: 2 }); s.step(0.25, {}); return s.view().watchers[0].a; };
  assert.ok(vis(false) > 0, "seen in the open");
  assert.ok(vis(true) < vis(false), "the barrel lowers awareness");
});

test("a sneak attack from behind opens the fight with the advantage", () => {
  const G = withCombat(), t = G.talk("t.r.hub");
  t.choose(t.beat.options.find((o) => o.label === "Test sneak.").index);
  assert.equal(t.beat.sneak, "s.yard");
  const s = G.sneaks.start("s.yard", { mode: "stepped" }); G.command(["setPower", "quay", "off"]);
  s.step(1, {}); const g = s.state.W[0];
  s.state.x = g.x - Math.sin(g.face); s.state.z = g.z - Math.cos(g.face);
  assert.equal(s.ambush(), true);
  assert.deepEqual(G.state.ambush, { encounter: "e.t.guard", watcher: "w.guard", advantage: "sneak" });
  const beat = t.afterSneak();
  assert.equal(beat.fight, "e.t.guard", "the runner hands the sneak into the fight");
});

test("an seen watcher that names a fight starts it", () => {
  const G = withCombat(), s = G.sneaks.start("s.kennel", { mode: "stepped" });
  for (let i = 0; i < 100 && !s.state.done; i++) s.stepMove(1, 0);
  assert.equal(s.state.outcome, "seen");
  assert.deepEqual(G.sneaks.finish(), { fight: "e.t.dog" });
});

test("the menu world's seen rule: light, hiding, blending", () => {
  const G = game(); G.setPlace("t.yard");
  assert.equal(G.scope.get("seen"), false, "the yard is dark");
  G.command(["setLight", "t.yard", "0.6", "0"]);
  assert.equal(G.scope.get("seen"), true, "a lamplit yard and a watcher on duty");
  G.stealth.hideAt("o.barrel"); assert.equal(G.scope.get("seen"), false);
  G.setPlace("t.room"); G.setPlace("t.yard"); assert.equal(G.scope.get("hidden"), false, "moving on leaves the hiding spot");
  G.inv.give("t.oilskin"); G.inv.equip("t.oilskin"); G.env.command(["setTerm", "fog", "0.08"]);
  assert.equal(G.scope.get("seen"), false, "in fog any guise but the default blends");
});

test("seenby.<watcher> reads its state; a voice cue speaks when a watcher turns", () => {
  const G = game(), voices = []; G.on("stealth.voice", (e) => voices.push(e.text));
  const s = darkYard(G); G.inv.give("glass", 3);
  assert.equal(G.scope.get("seenby.w.guard"), "unaware");
  s.throwNoise([3, 6]); s.step(0.5, {}); s.throwNoise([3, 6]); s.step(0.5, {});
  assert.notEqual(G.scope.get("seenby.w.guard"), "unaware");
  assert.ok(voices.includes("Test voice: he is turning."));
  const H = game(); H.setPlace("t.yard"); H.command(["setLight", "t.yard", "0.6", "0"]);
  assert.equal(H.scope.get("seenby.w.guard"), "seen"); assert.equal(H.scope.get("seenby.w.dog"), "", "not here");
});

test("a nose finds Lamb downwind in the dark, and not upwind", () => {
  const run = (windDir) => {
    const G = game(); G.env.command(["setTerm", "wind.speed", "8"]); G.env.command(["setTerm", "wind.dir", String(windDir)]);
    const s = G.sneaks.start("s.nose", { mode: "stepped" }); G.command(["setPower", "quay", "off"]); G.setPlace("t.yard");
    while (s.state.x < 2.4 && !s.state.done) s.stepMove(1, 0, { crouch: true }); // the approach only
    return s.view().watchers[0].a;
  };
  // the nose stands at x = 4, Lamb comes from x = 0: a westerly (from 270) blows Lamb's smell east to it
  assert.ok(run(270) > run(90) + 0.2, "downwind it smells Lamb; upwind it does not");
});

test("sodium makes Lamb a shop window; a carried lantern is always seen in the cone", () => {
  const look = ({ sodium = 0, lantern = false }) => {
    const G = game(), s = G.sneaks.start("s.yard", { mode: "stepped" }), g = s.state.W[0];
    G.command(["setLight", "t.quay", "0.3", String(sodium)]);
    if (lantern) { s.state.def.P.carry.push({ item: "lantern", r: 3 }); G.inv.give("lantern"); G.command(["setPower", "quay", "off"]); }
    Object.assign(g, { x: 3.5, z: 6, face: Math.PI }); Object.assign(s.state, { x: 3.5, z: 1 }); s.step(0.1, {});
    s.state.def.P.carry.length = 0; return s.view().watchers[0].a;
  };
  assert.ok(look({ sodium: 1 }) > look({ sodium: 0 }));
  assert.ok(look({ lantern: true }) > look({ sodium: 0 }), "in the dark, the lantern still gives Lamb away");
});

test("carrying a load: slower and louder in a sneak", () => {
  const dist = (carry) => { const G = game(); if (carry) G.verbs.carry("timber"); const s = G.sneaks.start("s.yard"); G.command(["setPower", "quay", "off"]); s.step(1, { x: 1, z: 0 }); return s.state.x; };
  assert.ok(dist(true) < dist(false) * 0.7);
});

test("the shared sight rule: light, fog over distance, cover, crouch, crowd and sodium", () => {
  const base = { light: 1, fog: 0.05, d: 10 };
  assert.ok(Math.abs(visibility(base) - Math.exp(-0.5)) < 1e-9);
  assert.equal(visibility({ ...base, light: 0 }), 0);
  assert.ok(visibility({ ...base, d: 20 }) < visibility(base));
  assert.ok(Math.abs(visibility({ ...base, crouch: true }) - 0.55 * visibility(base)) < 1e-9);
  assert.ok(Math.abs(visibility({ ...base, cover: 0.8 }) - 0.2 * visibility(base)) < 1e-9);
  assert.ok(Math.abs(visibility({ ...base, crowd: 1 }) - 0.3 * visibility(base)) < 1e-9);
  assert.ok(Math.abs(visibility({ ...base, sodium: 1 }) - 1.5 * visibility(base)) < 1e-9);
  assert.equal(visibility({ ...base, cover: 2 }), 0); // clamped
  assert.ok(visibility() === 0);
});

test("on a plate a wall between the watcher and Lamb hides Lamb (G.stealth.sight); with no wall Lamb is seen", () => {
  const walk = (G) => { const s = G.sneaks.start("s.yard", { mode: "stepped" }); for (let i = 0; i < 200 && !s.state.done; i++) s.stepMove(3 - s.state.x, 5.5 - s.state.z); return s.state.outcome; };
  const G = game(); G.stealth.sight = () => false; // a wall everywhere between them
  assert.notEqual(walk(G), "seen", "walled off, the lit walk is not seen");
  const H = game(); H.stealth.sight = () => true;
  assert.equal(walk(H), "seen");
});
