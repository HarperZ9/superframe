// The four ways through a fight (author, 2026-10-17): a sneak opening, an alert handed over, a
// tools build's setups, and talk exits; plus what a fighting build buys.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeWorld, makeG, run, press, ARENA_LWD } from "./helpers.mjs";
import { createWorld } from "../sim/world.mjs";
import { lambDef, foeDef, fighterSpec } from "../roster.mjs";
import { FLOOR, QUAY } from "../data/arenas.mjs";
import { parseProp } from "../sim/props.mjs";
import { createGame } from "../../game.mjs";
import { installCombat } from "../encounter.mjs";
import { angleTo } from "../sim/fighter.mjs";

// A world with an opening and props, Lamb and foes placed by hand.
function world({ clock = "23:00", arena = FLOOR, lambAt, foes, opening = "open", props = [], terms = {}, levels = {}, tool = "w.case", brains = true }) {
  const G = makeG({ clock, terms });
  const fighters = [fighterSpec("lamb", "lamb", lambDef(levels, tool), lambAt, { face: 0 })];
  foes.forEach(([style, at, over = {}], i) => fighters.push(fighterSpec(`foe${i}`, "foe", foeDef(null, style, over), at, { face: 0, brain: brains })));
  return createWorld({ G, arena, fighters, seed: 3, opening, props: props.map(parseProp) });
}
const walkTo = (W, x, z, n = 600) => { for (let i = 0; i < n; i++) { const L = W.lamb(), d = Math.hypot(x - L.x, z - L.z); if (d < 0.25) return true; W.step({ lamb: { mx: (x - L.x) / d * 0.5, mz: (z - L.z) / d * 0.5 } }); } return false; };

test("a sneak from behind in the dark takes a small opponent down, and the noise wakes the other", () => {
  const W = world({ terms: { light: 0.02 }, lambAt: [2, 9], foes: [["skirmisher", [6, 9]], ["skirmisher", [12, 9]]], opening: "sneak" });
  const [A, B] = [W.byId("foe0"), W.byId("foe1")];
  assert.ok(A.aware === false && B.aware === false);
  assert.equal(W.lamb().lantern, 0, "the lantern starts shuttered");
  assert.ok(Math.abs(angleTo(W.lamb(), A) - A.face) < 0.01, "they face away from Lamb");
  walkTo(W, 5, 9);
  assert.equal(A.aware, false, "a slow approach from behind in the dark is not noticed");
  W.lamb().face = 0;
  const ev = run(W, 1, press("light")).concat(run(W, 120));
  assert.ok(ev.some((e) => e.type === "takedown" && e.id === "foe0"));
  assert.ok(A.out || A.hp === 0, "taken down");
  assert.ok(ev.some((e) => e.type === "alert" && e.id === "foe1"), "the other heard it");
});

test("a big opponent takes a takedown as a heavy free strike and goes down, not out", () => {
  const W = world({ terms: { light: 0.02 }, lambAt: [5, 9], foes: [["holder", [6.2, 9]]], opening: "sneak", brains: false });
  W.lamb().face = 0;
  const ev = run(W, 1, press("light")).concat(run(W, 30));
  const F = W.byId("foe0");
  assert.ok(ev.some((e) => e.type === "takedown"));
  assert.ok(F.hp > 0 && F.hp <= F.hpMax - 4, `Standing ${F.hp}`);
  assert.ok(ev.some((e) => e.type === "knockdown" && e.id === "foe0"));
});

test("walking into an unaware opponent's sight under a lamp gets Lamb noticed", () => {
  const W = world({ lambAt: [10.5, 2], foes: [["skirmisher", [10.5, 6]]], opening: "sneak" });
  const F = W.byId("foe0"); F.face = -Math.PI / 2; W.lamb().lantern = 5;
  const ev = run(W, 120, { lamb: {} });
  assert.ok(ev.some((e) => e.type === "alert" && e.id === "foe0" && e.why === "sight"));
});

test("an alert hands over opponents who search from where Lamb was last seen", () => {
  const W = createWorld({ G: makeG({ clock: "23:00", terms: { light: 0.02 } }), arena: FLOOR, seed: 3, opening: "alerted", lastSeen: [4, 4],
    fighters: [fighterSpec("lamb", "lamb", lambDef(), [20, 3]), fighterSpec("foe0", "foe", foeDef(null, "holder"), [10, 9], { brain: true })] });
  W.lamb().lantern = 0;
  const F = W.byId("foe0"), d0 = Math.hypot(F.x - 4, F.z - 4);
  run(W, 180, { lamb: {} });
  assert.ok(Math.hypot(F.x - 4, F.z - 4) < d0 - 2, "it went toward the last place Lamb was seen");
  assert.ok(F.aware, "aware, no free strike");
});

test("cutting lamps darkens the ground; with the quay's three out, sodium eyes lose Lamb", () => {
  const W = world({ arena: QUAY, lambAt: [10.5, 2.8], foes: [["holder", [10.5, 7], { sight: "sodium" }]], brains: false });
  const L = W.lamb(), F = W.byId("foe0"), before = W.field.lightAt(10.5, 3);
  L.lantern = 0;
  assert.equal(W.visible(F, L), true, "seen under the sodium");
  const ev = run(W, 1, { lamb: { press: ["interact"] } });
  assert.ok(ev.some((e) => e.type === "lightcut"));
  assert.ok(W.field.lightAt(10.5, 3) < before - 0.15, "one lamp out");
  for (const x of [3.5, 17.5]) { L.x = x; L.z = 2.8; run(W, 1, { lamb: { press: ["interact"] } }); }
  L.x = 10.5; L.z = 2.8; run(W, 1);
  assert.equal(W.visible(F, L), false, "lost in the dark at 4 m");
});

test("a sluice floods its zone: everyone in it goes down, a light opponent at waist depth is swept", () => {
  const W = world({ lambAt: [3, 3.2], foes: [["skirmisher", [11, 9]], ["holder", [13, 9]]], props: [["sluice", 3, 3, 8, 6, 16, 12, 1.3]], brains: false });
  run(W, 1, { lamb: { press: ["interact"] } });
  const ev = run(W, 60);
  assert.ok(ev.some((e) => e.type === "surge"));
  assert.ok(ev.some((e) => e.type === "swept" && e.id === "foe0"), JSON.stringify(ev.filter((e) => ["swept", "knockdown", "fall"].includes(e.type))));
  assert.ok(ev.some((e) => e.type === "knockdown" && e.id === "foe1"));
});

test("a rigged rope snares the first opponent to step on it, and holds it for a free strike", () => {
  const W = world({ lambAt: [3, 9], foes: [["holder", [9, 9]]], props: [["snare", 5.5, 9]] });
  let snared = null;
  for (let i = 0; i < 400 && !snared; i++) snared = W.step({ lamb: {} }).find((e) => e.type === "snared");
  assert.ok(snared, "the holder walked into it");
  assert.equal(W.byId("foe0").act.id, "snared");
});

test("a shove on frost or wet stone puts the target on the ground", () => {
  const W = world({ clock: "04:40", arena: QUAY, lambAt: [10, 3], foes: [["holder", [11, 3]]], brains: false });
  const ev = run(W, 1, press("shove")).concat(run(W, 30));
  assert.ok(ev.some((e) => e.type === "slip" && e.id === "foe0"));
  assert.ok(ev.some((e) => e.type === "knockdown" && e.id === "foe0"));
});

test("the lantern shutters and unshutters; shuttered, Lamb is harder to see", () => {
  const W = world({ terms: { light: 0.02 }, lambAt: [4, 9], foes: [["holder", [11, 9]]], brains: false });
  assert.equal(W.visible(W.byId("foe0"), W.lamb()), true, "lit at 7 m");
  run(W, 1, { lamb: { press: ["lantern"] } });
  assert.equal(W.lamb().lantern, 0);
  run(W, 1);
  assert.equal(W.visible(W.byId("foe0"), W.lamb()), false, "dark at 7 m");
});

test("a talk exit offered by content ends the fight on a talk press and plays its node", () => {
  const extra = `
@encounter e.test
name: Test talk
area: floor
foe: f.t 1
win: t.win
down: t.down
talk: t.parley | Put the tool down ? fight_seconds >= 1
prop: snare 9 9 ? has(t.rigged)

@foe f.t
name: A test opponent
standing: 9
breath: 6
poise: 3
`;
  const G = createGame({ sources: [{ file: "arena.lwd", text: ARENA_LWD + extra }], seed: 11 });
  G.state.place = "floor";
  const C = installCombat(G), W = C.start("e.test");
  assert.equal(W.props.filter((p) => p.kind === "snare").length, 0, "the snare needs t.rigged");
  let offer = null;
  W.lamb().composure = 4;
  for (let i = 0; i < 120 && !offer; i++) offer = C.step({}).find((e) => e.type === "talk.offer");
  assert.ok(offer && offer.label === "Put the tool down");
  C.step({ press: ["talk"] });
  assert.equal(W.result.outcome, "talk");
  assert.equal(C.finish(), "t.parley");
  assert.equal(G.state.vars.fight_seconds, undefined, "fight names are cleared");
});

test("a fighting build hits harder, catches wider and rolls further than a middling one", () => {
  const plain = makeWorld({ brains: false, foes: [] }), built = makeWorld({ brains: false, foes: [], lamb: { coat: 4, knees: 6, ballast: 6, grip: 6, pride: 6 } });
  const m = (W, id) => W.moves[id];
  assert.ok(m(built, "lamb:light_1").dmg > m(plain, "lamb:light_1").dmg * 1.3);
  assert.ok(m(built, "lamb:catch").active > m(plain, "lamb:catch").active);
  assert.ok(m(built, "lamb:roll").root[0][2] > m(plain, "lamb:roll").root[0][2]);
  assert.equal(built.defs.lamb.moveset.roll.medium, "lamb:roll");
  assert.ok(built.lamb().hpMax > plain.lamb().hpMax && built.lamb().stMax > plain.lamb().stMax);
});

test("an ambush from the stealth layer opens the fight with the takedown already landing", () => {
  const extra = `
@encounter e.amb
name: Test ambush
area: floor
foe: f.a 1
foe: f.b 1
win: t.win
down: t.down

@foe f.a
name: A small watcher
standing: 8
breath: 6
poise: 3

@foe f.b
name: Another
standing: 9
breath: 6
poise: 3
`;
  const G = createGame({ sources: [{ file: "arena.lwd", text: ARENA_LWD + extra }], seed: 11 });
  G.state.place = "floor"; G.state.ambush = { encounter: "e.amb", watcher: "w.none", advantage: "sneak" };
  const C = installCombat(G), W = C.start("e.amb"), ev = [];
  assert.equal(G.state.ambush, undefined, "the flag is cleared");
  assert.equal(W.opening, "sneak");
  for (let i = 0; i < 40; i++) ev.push(...C.step({}));
  assert.ok(ev.some((e) => e.type === "takedown"), JSON.stringify(ev.filter((e) => e.type !== "lock").slice(0, 6)));
  assert.ok(W.fighters[1].hp === 0, "the struck watcher is down");
});
