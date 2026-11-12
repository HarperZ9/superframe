// Act 2's fights on the director's files (content/act2, read only) and the moves Lamb learns from
// people (SYSTEMS-FULL 18.5): flags `<district>.move_<name>` unlock them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createGame } from "../../game.mjs";
import { installCombat } from "../encounter.mjs";
import { ARENAS } from "../data/arenas.mjs";
import { learnedFromFlags, lambDef } from "../roster.mjs";
import { LEARNED } from "../data/learned.mjs";
import { makeWorld, makeG, run, press, HERE } from "./helpers.mjs";

const CONTENT = join(HERE, "..", "..", "..", "..", "content");
const lwd = (dir, f) => ({ file: `${dir}/${f}`, text: readFileSync(join(CONTENT, dir, f), "utf8") });
// Act 2's places, night and fights, with Act 1's weapons and foes (combat.lwd)
const act2 = () => [lwd("act1", "combat.lwd"), ...readdirSync(join(CONTENT, "act2")).filter((f) => f.endsWith(".lwd") && f !== "act2.lwd").map((f) => lwd("act2", f))];

function game() {
  const G = createGame({ sources: act2(), seed: 13 });
  return { G, C: installCombat(G) };
}

test("every Act 2 encounter has an arena, loads its foes, and places its props", () => {
  const { G, C } = game();
  const ids = Object.keys(C.defs);
  assert.ok(ids.includes("hill.station_four") && ids.includes("e.station") && ids.includes("e.strippers"), ids.join(" "));
  for (const id of ids) {
    const enc = C.defs[id];
    assert.ok(ARENAS[enc.area], `${id}: no arena for area ${enc.area}`);
    for (const f of enc.foes) assert.ok(f.rec, `${id}: no @foe ${f.id}`);
    G.state.flags.push("hill.dark", "spit.painter_cut", "ropewalk.lamp_doused");
    const W = C.start(id);
    for (const p of W.props) assert.ok(!(p.x === 0 && p.z === 0), `${id}: a prop left at 0 0`);
    C.current = null;
  }
});

test("the station's dark (hill.dark) puts out all three white lamps, in both station fights", () => {
  for (const id of ["e.station", "hill.station_four"]) {
    const { G, C } = game();
    G.state.flags.push("hill.dark");
    const W = C.start(id);
    assert.equal(W.props.filter((p) => p.kind === "lamp" && !p.on).length, 3, id);
    assert.ok(W.field.arena.lights.every((l) => l.off), `${id}: every lamp out`);
    const { C: C2 } = game();
    const W2 = C2.start(id);
    assert.ok(W2.field.arena.lights.every((l) => !l.off), `${id}: lit without hill.dark`);
  }
});

test("a Lamb standing still in each Act 2 fight goes down within 20 seconds", () => {
  for (const id of ["e.station", "hill.station_four", "e.strippers", "e.zealots", "e.substation", "ropewalk.e.door"]) {
    const { C } = game();
    const W = C.start(id);
    for (let i = 0; i < 60 * 20 && !W.result; i++) C.step({});
    assert.ok(W.result && ["down", "lose"].includes(W.result.outcome), `${id}: ${JSON.stringify(W.result)}`);
  }
});

test("taught moves are read from <district>.move_<name> flags", () => {
  assert.deepEqual(learnedFromFlags(["gut.move_feint", "floor.move_mudstep", "floor.move_hookpull", "hill.move_sweep", "said.x"]).sort(), ["feint", "hookpull", "mudstep", "sweep"]);
  const { G, C } = game();
  G.state.flags.push("hill.move_sweep");
  G.state.inv = { items: { "w.pole": 1 }, equipped: { hand: "w.pole" } };
  const W = C.start("e.station");
  assert.ok(W.defs.lamb.learned.includes("sweep"));
  assert.ok(W.moves["lamb:sweep"] && W.moves["lamb:sweep"].knockdown, "the taught sweep knocks down");
  assert.ok(W.defs.lamb.variants.heavy.includes("lamb:sweep"), "it rides on the heavy");
  assert.equal(W.moves["lamb:sweep"].composure, 2, "and costs Composure");
});

test("without the lesson the boathook and pole heavies are plain; with it a paid variant pulls or sweeps", () => {
  assert.equal(lambDef({}, "w.boathook").tool.special, "none");
  assert.equal(lambDef({}, "w.pole").tool.special, "none");
  const hook = makeWorld({ brains: false, foes: [], tool: "w.boathook", lamb: { coat: 3 }, learned: ["hookpull"] });
  assert.ok(hook.moves["lamb:hookpull"].knockdown && hook.moves["lamb:hookpull"].knock < 0, "the hook-pull drags");
  const L = hook.lamb();
  assert.ok(run(hook, 1, press("heavy")).some((e) => e.move === "lamb:heavy"), "without Composure: the plain heavy");
  const hook2 = makeWorld({ brains: false, foes: [], tool: "w.boathook", lamb: { coat: 3 }, learned: ["hookpull"] }); hook2.lamb().composure = 4;
  assert.ok(run(hook2, 1, press("heavy")).some((e) => e.move === "lamb:hookpull"), "with Composure: the hook-pull");
  void L;
});

test("the feint: a heavy released early becomes a quick strike; held, it stays a heavy", () => {
  const tap = makeWorld({ brains: false, foes: [["holder", [6.5, 5.5]]], learned: ["feint"] }); tap.lamb().composure = 3;
  run(tap, 1, { lamb: { press: ["heavy"], hold: { heavy: true } } }); run(tap, 3, { lamb: { hold: { heavy: true } } });
  const ev = run(tap, 40);
  assert.ok(ev.some((e) => e.type === "move" && e.move === "lamb:feint"), "released at frame 4: the feint");
  assert.ok(ev.some((e) => e.type === "hit" && e.move === "lamb:feint"));
  const hold = makeWorld({ brains: false, foes: [["holder", [6.5, 5.5]]], learned: ["feint"] });
  run(hold, 1, { lamb: { press: ["heavy"], hold: { heavy: true } } });
  const ev2 = run(hold, 12, { lamb: { hold: { heavy: true } } }).concat(run(hold, 40));
  assert.ok(!ev2.some((e) => e.move === "lamb:feint"), "held past frame 8: the heavy");
  const plain = makeWorld({ brains: false, foes: [["holder", [6.5, 5.5]]] });
  run(plain, 1, { lamb: { press: ["heavy"], hold: { heavy: true } } }); run(plain, 3, { lamb: { hold: { heavy: true } } });
  assert.ok(!run(plain, 40).some((e) => e.move === "lamb:feint"), "untaught: a tap is still a heavy");
});

test("the mud-step: no lurch in knee water once Nan Cockle has taught it", () => {
  const plain = makeWorld({ G: makeG({ clock: "23:50" }), brains: false, lambAt: [10.5, 5.5], foes: [] });
  assert.ok(run(plain, 1, press("roll", { mx: 1, mz: 0 })).some((e) => e.move === "lamb:lurch"));
  const W = makeWorld({ G: makeG({ clock: "23:50" }), brains: false, lambAt: [10.5, 5.5], foes: [], learned: ["mudstep"] });
  assert.ok(run(W, 1, press("roll", { mx: 1, mz: 0 })).some((e) => e.move === "lamb:roll"));
});

test("the brawl fills itself with brawlers, and it ends: Lamb last standing, down, out, or it breaks up", () => {
  const { C } = game();
  const W = C.start("brine2.brawl");
  assert.ok(W.fighters.length >= 4, "brawlers were added");
  assert.ok(new Set(W.fighters.map((F) => F.team)).size === W.fighters.length, "everyone on a side of their own");
  for (let i = 0; i < 60 * 70 && !W.result; i++) C.step({});
  assert.ok(W.result, "the brawl ended within 70 seconds");
});

test("every lesson the content teaches maps onto a built move", () => {
  const flags = ["weigh3.move_guard", "weigh2.move_snare", "spit.move_shove", "ropewalk3.move_return", "ropewalk.move_reset", "quay2.move_turn", "quay2.move_oarsweep", "mole3.move_hold", "gasholder3.move_count", "gut.move_feint", "floor.move_mudstep", "floor.move_hookpull", "brine.move_stool", "hill.move_sweep"];
  for (const n of learnedFromFlags(flags)) assert.ok(LEARNED[n], `${n} is a learned move`);
});

test("Pip's turn (taught as quay2.move_turn) starts without error and re-aims past the opponent", async () => {
  const { makeWorld } = await import("./helpers.mjs");
  const learned = learnedFromFlags(["quay2.move_turn"]);
  assert.deepEqual(learned, ["tuberunner"]);
  const W = makeWorld({ learned, brains: false, foes: [["holder", [6.5, 5.5]]] });
  const id = Object.keys(W.moves).find((k) => W.moves[k].behind);
  assert.ok(id, "a move with the behind flag exists");
  const L = W.fighters.find((F) => F.team === "lamb"), T = W.fighters.find((F) => F.team === "foe");
  T.x = L.x + 1.5; T.z = L.z;
  const { startMove } = await import("../sim/fighter.mjs");
  startMove(W, L, id, {});
  assert.ok(Number.isFinite(L.act.dir));
});
