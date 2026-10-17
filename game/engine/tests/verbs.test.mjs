import { test } from "node:test";
import assert from "node:assert/strict";
import { game } from "./helpers.mjs";
import { VERB_KINDS } from "../world/verbs.mjs";

const at = () => { const G = game({ mode: "fixed" }); G.setPlace("t.yard"); return G; };
const kinds = (G) => G.verbs.list().map((x) => x.verb.kind);

test("the test yard offers every verb kind", () => {
  const G = at(), k = new Set(kinds(G));
  G.verbs.act("o.lamp", "light"); for (const x of kinds(G)) k.add(x); // douse is offered once lit
  for (const v of VERB_KINDS) assert.ok(k.has(v), `missing ${v}`);
  assert.deepEqual(game().verbs.list(), [], "nothing elsewhere");
});

test("climb: a pencil check with ok and fail nodes, locked until the sum changes", () => {
  const G = at(), r = G.verbs.act("o.wall", "climb");
  assert.deepEqual([r.ok, r.node], [false, "t.y.slip"], "knots 1 against 4");
  assert.equal(G.verbs.did("o.wall", "climb"), "fail");
  assert.equal(G.verbs.act("o.wall", "climb").why, "Nothing has changed.");
  const H = at(); H.create({ archetype: "a.diver", enter: false }); H.setPlace("t.yard");
  assert.deepEqual([H.verbs.act("o.wall", "climb").ok, H.flag("done.o.wall.climb")], [true, true]);
});

test("wade wets Lamb and says so; hide hides", () => {
  const G = at(), r = G.verbs.act("o.pool", "wade");
  assert.equal(G.body.wet(), 0.3); assert.equal(r.lines[0].text, "Test: the water is to the knee.");
  G.verbs.act("o.barrel", "hide"); assert.equal(G.scope.get("hidden"), true);
});

test("light and douse change the place's light, each offered only when it makes sense", () => {
  const G = at();
  assert.ok(G.verbs.list().some((x) => x.label === "Test light the lamp."));
  G.verbs.act("o.lamp", "light"); assert.equal(G.env.term("light", "t.yard"), 0.6);
  assert.ok(G.verbs.list().some((x) => x.label === "Test douse the lamp.") && !G.verbs.list().some((x) => x.label === "Test light the lamp."));
  G.verbs.act("o.lamp", "douse"); assert.equal(G.env.term("light", "t.yard"), 0.02, "back to its dark-light");
});

test("power: cut, then restore, by label", () => {
  const G = at();
  G.verbs.act("o.board", "power"); assert.equal(G.env.term("power.yard"), "off");
  assert.ok(G.verbs.list().some((x) => x.label === "Test restore the yard power."));
  G.verbs.act("o.board", "power"); assert.equal(G.env.term("power.yard"), "on");
});

test("pry needs a tool and gives once; a noisy verb where a watcher sees is noticed", () => {
  const G = at();
  assert.equal(G.verbs.list().find((x) => x.verb.kind === "pry").why, "Needs Test knife");
  G.inv.give("knife"); G.command(["setLight", "t.yard", "0.6", "0"]);
  const r = G.verbs.act("o.crate", "pry");
  assert.ok(r.ok && G.inv.count("glass") === 1);
  assert.ok(G.flag("noticed.o.crate"), "noise 0.9 in a lit yard with the guard on duty");
  assert.ok(!kinds(G).includes("pry"), "once");
});

test("rig uses its items and runs its effects; salvage goes with the tide", () => {
  const G = at();
  assert.equal(G.verbs.act("o.rope", "rig").why, "Needs 1 Wick");
  G.inv.give("wick"); assert.equal(G.verbs.act("o.rope", "rig").ok, true);
  assert.ok(G.flag("t.rigged") && G.inv.count("wick") === 0);
  G.env.command(["setTerm", "tide", "0.5"]); assert.ok(!kinds(G).includes("salvage"), "gone: tide > 0");
  G.env.command(["clearTerm", "tide"]); G.verbs.act("o.scrap", "salvage"); assert.equal(G.inv.count("timber"), 1);
});

test("eavesdrop: someone to hear, then the overhearing rule decides", () => {
  const G = at();
  assert.equal(G.verbs.act("o.window", "eavesdrop").why, "Nobody to listen to");
  G.people.move("t.speaker", "t.yard"); G.env.command(["setTerm", "wind.speed", "0"]); G.env.command(["setTerm", "rain", "0"]);
  assert.deepEqual([G.verbs.act("o.window", "eavesdrop").node], ["t.y.heard"], "6 / 4 = 1.5");
  const H = at(); H.people.move("t.speaker", "t.yard"); H.env.command(["setTerm", "wind.speed", "0"]); H.env.command(["setTerm", "rain", "6"]);
  assert.equal(H.verbs.act("o.window", "eavesdrop").node, "t.y.muffled", "rain noise: 1.5 x 0.4");
});

test("read gives the instrument's line; verbs inside a conversation", () => {
  const G = at(), r = G.verbs.act("o.post", "read");
  assert.match(r.lines[0].text, /^Tide -?\d/);
  const H = at(), t = H.talk("t.r.hub"), b = t.verb("o.pool", "wade");
  assert.equal(b.lines[0].text, "Test: the water is to the knee.");
  assert.ok(b.options && b.options.length, "the conversation goes on");
});

test("@spot records: one verb each; needs mixes items and conditions", () => {
  const G = at(), sack = () => G.verbs.list().find((x) => x.object.id === "sp.sack");
  assert.equal(sack().why, "Needs Timber", "the item part of needs is a reason");
  G.inv.give("timber"); assert.equal(sack().why, null);
  const sw = G.verbs.list().find((x) => x.object.id === "sp.switch");
  assert.deepEqual([sw.label, sw.verb.kind, sw.verb.noise], ["Test pull the yard switch.", "cutpower", 0.6]);
  G.state.sheet.attrs.hands = 0; // knots 0: the condition part hides it (this game's sheet only)
  assert.equal(sack(), undefined);
});

test("cutpower, carry, weigh, mark, wait and a delayed rig", () => {
  const G = at();
  G.verbs.act("sp.switch", "cutpower"); assert.equal(G.env.term("power.yard"), "off");
  G.inv.give("timber"); assert.equal(G.verbs.act("sp.sack", "carry").ok, true); assert.equal(G.scope.get("carrying"), "timber");
  G.scope.call("drop", [], G.scope); assert.equal(G.scope.get("carrying"), "");
  G.verbs.act("sp.scale", "weigh"); assert.ok(G.flag("t.weighed"));
  G.verbs.act("sp.chalk", "mark"); assert.equal(G.verbs.did("sp.chalk", "mark"), "ok");
  G.verbs.act("sp.candle", "rig"); assert.ok(!G.flag("t.timer_done"));
  G.advance(20); assert.ok(G.flag("t.timer_done"), "after(20, ...) ran on time");
  const H = at(); H.advance(5); H.verbs.act("sp.bench", "wait");
  assert.ok(H.env.term("tide") > -0.4, "waited until the tide turned");
});

test("throw: outside a sneak it turns heads for a few minutes", () => {
  const G = at(); G.command(["setLight", "t.yard", "0.6", "0"]); G.inv.give("glass");
  assert.equal(G.scope.get("seen"), true);
  G.verbs.act("sp.bottle", "throw"); assert.equal(G.scope.get("seen"), false, "distracted");
  assert.equal(G.inv.count("glass"), 0);
  G.advance(4); assert.equal(G.scope.get("seen"), true, "they look back");
});
