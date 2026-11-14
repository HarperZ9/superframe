// The Quota slice's world: the cast in the fight drawer and the scenes (wiring/quota-areas.lwd), the player's
// own figure by class, the two lenses (world/lens.mjs), the harness's random class and the children's-home
// route, and the arena's venues (combat/data/skins-quota.mjs) beside Low Water's arena.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";
import { ROOT } from "./helpers.mjs";
import { CAST } from "../../../characters/runtime/castmap.mjs";
import { SKINS } from "../combat/data/skins-quota.mjs";
import { BOSSES } from "../combat/data/bosses.mjs";
import { ARCHETYPES } from "../combat/data/foes.mjs";
import { ARENAS } from "../combat/data/arenas.mjs";
import { createRun, LADDER } from "../combat/arena/run.mjs";
import { bossSpec, summoner } from "../combat/arena/spawn.mjs";
import { createWorld } from "../combat/sim/world.mjs";
import { lambDef, fighterSpec } from "../combat/roster.mjs";
import { makeG } from "../combat/tests/helpers.mjs";
import { playInner } from "../tools/innerplay.mjs";

const SLICE = join(ROOT, "..", "..", "content", "quota", "slice.lwd"), WIRING = join(ROOT, "wiring", "quota-areas.lwd");
const sources = (await loadAct(SLICE, (p) => readFile(p, "utf8"))).sources;
sources.push({ file: "quota-areas.lwd", text: await readFile(WIRING, "utf8") });
const content = loadContent(sources);
const game = (cls = "inspector") => { const G = createFullGame({ content, seed: 1 }); G.create({ archetype: cls === "militia" ? "q.will" : "q.ned", enter: false }); G.state.vars.q_class = cls; return G; };

test("the Quota cast is in the fight drawer's map, the Captain as Holt, and every figure the scenes place can be drawn", async () => {
  for (const id of ["ned", "mary", "abel", "abel_era1", "pell", "pell_adult", "will", "tomas", "aaron", "anni", "anni_adult", "holt", "edie", "davey", "rose", "bet", "ilo", "tesk", "lil", "gedge", "pask", "mott"]) assert.ok(CAST[id], id);
  assert.deepEqual(content.errors.filter((e) => e.level !== "warn"), []);
  const placed = Object.values(content.map.areas).flatMap((a) => (a.figures || []).map((f) => f.id || f.who || f.char)).filter(Boolean);
  const ids = [...(await readFile(WIRING, "utf8")).matchAll(/^figure:\s*(\w+)/gm)].map((m) => m[1]);
  for (const id of new Set([...placed, ...ids])) assert.ok(CAST[id], `no figure for ${id}`);
});

test("the player's own figure is Ned or Will by the class chosen", () => {
  const G = game(); assert.equal(G.playerFigure(), "ned");
  G.state.vars.q_class = "militia"; assert.equal(G.playerFigure(), "will");
});

test("the lenses: the bell tower is wide, a kitchen narrow, the rest near; each shows its things in words, never a figure", () => {
  const G = game();
  assert.equal(G.lens.mode(), "near");
  const seen = [];
  G.on("lens", (e) => seen.push(`${e.from}>${e.to}`));
  G.world.enter("q.tower"); assert.equal(G.lens.mode(), "wide");
  const wide = G.lens.signs();
  assert.ok(wide.some((s) => s.at === "haldane_yard" && s.stock === "hunger"), "the queue in Haldane Yard");
  for (const s of wide) assert.ok(["little", "some", "much", "well", "uneasy", "badly"].includes(s.level), JSON.stringify(s));
  G.world.enter("q.haldane"); assert.equal(G.lens.mode(), "narrow");
  const narrow = G.lens.signs();
  assert.equal(narrow.find((s) => s.stock === "bowls").count, 5, "the table, as bowls");
  G.world.enter("q.tower");
  assert.deepEqual(seen, ["near>wide", "wide>narrow", "narrow>wide"]);
  assert.equal(G.lens.seen().length, 3, "the record keeps what each lens showed when it opened");
  assert.ok(G.world.exits().some((x) => x.target === "q.haldane"), "from the tower down to a household");
});

test("a record event is stamped with the lens it was made in", () => {
  const G = game(); G.world.enter("q.tower");
  G.community.record("export.train", "haldane", "haldane_yard");
  assert.equal(G.community.state.events[0].lens, "wide");
});

test("the 310-and-stand-aside route reaches the children's home with Tomas still there", () => {
  const G = game();
  const t = G.talk("q.office.ned"); t.choose(t.beat.options.findIndex((o) => /q_figure\s*=\s*inflated/.test(String(o.s.attrs.do || ""))));
  const g = G.talk("q.granary.aside");
  // the night (Bet's chapter, the dream), the week, Bet at the returns room and at the gate: the inspector refuses
  // to write the line and says nothing at the gate, and nobody brought food, so Bet lets Anni go in
  const prefer = [/can't write that/, /Say nothing/];
  // the inspector heard Only's lie at the office, so its inner fight comes that night (S18): played headless with
  // a talk build, and the story goes on from its record
  for (let i = 0; i < 20 && g.beat && (g.beat.options || g.beat.inner); i++) {
    if (g.beat.inner) { g.afterInner(g.beat.inner, playInner(g.beat.inner, { habit: "tongue" }).records); continue; }
    const k = prefer.map((re) => g.beat.options.findIndex((o) => re.test(o.label))).find((x) => x >= 0); g.choose(k ?? 0);
  }
  assert.ok(G.state.inner && G.state.inner.only, "Only was fought the night after the office");
  assert.ok(G.memory.visits("q.fate.gate") > 0, "Bet decides at the gate");
  assert.ok(G.memory.visits("q.coda.home") > 0, Object.keys(G.state.memory.visits).filter((n) => n.startsWith("q.coda")).join(", "));
});

test("the arena's venues: every archetype named and kitted, their bosses built, their boons named; Low Water's arena as it was", () => {
  for (const [id, S] of Object.entries(SKINS)) {
    for (const style of Object.keys(ARCHETYPES)) assert.ok(S.archetypes[style] && S.archetypes[style].name, `${id}: ${style}`);
    for (const b of S.bosses) assert.ok(BOSSES[b] && BOSSES[b].phases, `${id}: boss ${b}`);
    assert.deepEqual(Object.keys(S.boons).sort(), ["edge", "footwork", "read", "wind"]);
    assert.ok(ARENAS[S.arena], `${id}: arena ${S.arena}`);
  }
  for (const n of [4, 8]) { const R = createRun({ seed: 2, skin: "club" }); R.state.round = n; assert.equal(R.stage().boss, ["champion", "debtman"][n / 4 - 1]); }
  const plain = createRun({ seed: 2 }); plain.state.round = 4; assert.equal(plain.stage().boss, LADDER.bosses[0]);
  const R = createRun({ seed: 2, skin: "bread" }), W = R.world(makeG(), ARENAS.millyard);
  assert.ok(W.fighters.filter((F) => F.team !== "lamb").every((F) => Object.values(SKINS.bread.archetypes).some((k) => k.name === W.defs[F.id].name)), "the bread fights' names");
});

test("the Clearance Sergeant: shield bash where the warden pulls, baton where it thrusts, two shielded constables on the whistle", () => {
  const W = createWorld({ G: makeG(), arena: ARENAS.floor, seed: 1, fighters: [fighterSpec("lamb", "lamb", lambDef({}), ARENAS.floor.spawns.lamb, { face: Math.PI / 2 }), bossSpec("boss", "sergeant", [9, 8])] });
  W.summon = summoner(W);
  const seq = [];
  for (let i = 0; i < 60 * 30 && !W.result; i++) { W.lamb().hp = W.lamb().hpMax; for (const e of W.step({ lamb: {} })) if (e.type === "move" && e.id === "boss") seq.push(e.move); }
  assert.deepEqual(seq.slice(0, 3), ["sergeant.bash", "warden.spin", "sergeant.baton"]);
  assert.ok(W.defs.boss.frontGuard > 0, "a riot shield");
  const B = W.byId("boss"); B.hp = B.hpMax * 0.4;
  for (let i = 0; i < 60 * 10; i++) { W.lamb().hp = W.lamb().hpMax; W.step({ lamb: {} }); }
  const hands = W.fighters.filter((F) => F.id.startsWith("boss-hand"));
  assert.equal(hands.length, 2); assert.ok(hands.every((F) => W.defs[F.id].style === "shield"));
});

test("the Quota's own ruleset: no Gullet Precedents, no creation screen; the choice at q.start gives the chosen man's sheet", () => {
  assert.equal(content.rs.rules.creation, "none");
  assert.ok(!Object.keys(content.rs.archetypes).some((a) => a.startsWith("p.")), "no Gullet Precedents");
  for (const [label, id, cls] of [["Ned Furrowe", "q.ned", "inspector"], ["Will Brack", "q.will", "militia"]]) {
    const G = createFullGame({ content, seed: 1 });
    assert.deepEqual(G.create({ archetype: content.rs.rules["start-archetype"], enter: false }), []);
    const gained = []; G.on("item.gain", (d) => gained.push(d.id));
    const t = G.talk("q.start"); t.choose(t.beat.options.findIndex((o) => o.label.includes(label)));
    assert.deepEqual(gained, [], "his own clothes come without found notes");
    assert.ok(G.state.inv.equipped.coat, "his coat is on");
    assert.equal(G.state.sheet.archetype, id); assert.equal(G.state.sheet.name, label); assert.equal(G.state.vars.q_class, cls);
  }
});

test("the HUD reads its fields from the story: the Quota shows the plain's weather and no day number, no tide; Low Water's default is unchanged", async () => {
  const { hudConfig, dayWords, weatherWords } = await import("../ui/hudtab.mjs");
  const G = game();
  const cfg = hudConfig(G);
  assert.deepEqual(cfg.fields, ["clock", "weather", "place"], "no day counter on the Quota's HUD (2026-10-22)");
  assert.equal(dayWords(G, cfg), "Day 41 of the winter", "the day line is still read from the model, only not shown");
  assert.equal(weatherWords(G, cfg.weather), "frost");
  assert.equal(G.env.term("tide"), 0, "the plain has no tide");
  G.env.advance(17 * 60); assert.match(weatherWords(G, cfg.weather), /^frost, (heavy )?snow, (a hard wind|a gale) off the hill$/, "the wind in words: @meta numbers: off");
  assert.deepEqual(hudConfig({ book: { meta: {} } }).fields, ["clock", "tide", "weather", "place"]);
});

test("the nip of spirit goes in the record when it is taken; the other boons do not", () => {
  const seen = [], R = createRun({ seed: 2, skin: "bread", onRecord: (ev) => seen.push(ev) });
  R.state.cleared = 3;
  R.state.offer = [{ id: "boon:edge", kind: "boon", boon: "edge" }, { id: "boon:wind", kind: "boon", boon: "wind" }];
  R.choose(1); assert.equal(R.summary().records.length, 0);
  R.state.offer = [{ id: "boon:edge", kind: "boon", boon: "edge" }]; R.choose(0);
  assert.equal(seen.length, 1); assert.equal(seen[0].type, "drink.taken"); assert.equal(seen[0].round, 3); assert.equal(seen[0].venue, "bread");
  assert.deepEqual(R.summary().records, seen);
  const G = game(); const R2 = createRun({ seed: 2, skin: "club", onRecord: (ev) => G.community.record(ev.type, "", "", { round: ev.round }) });
  R2.state.offer = [{ id: "boon:edge", kind: "boon", boon: "edge" }]; R2.choose(0);
  assert.ok(G.community.state.events.some((e) => e.type === "drink.taken"), "a story's record gets it through onRecord");
});

test("the plain has no tide to wait for: no turn terms, no wait row, no tide line; Low Water's nights keep theirs", async () => {
  const { waitRow } = await import("../ui/waiting.mjs");
  const G = game();
  for (const k of ["tide.dir", "tide.next", "tide.next.at", "tide.next.h"]) assert.equal(G.env.term(k), undefined, k);
  assert.equal(waitRow({ G }, {}), null, "no 'Wait for the turn at low water' on the plain");
  const act1 = loadContent((await loadAct(join(ROOT, "..", "..", "content", "act1", "act1.lwd"), (p) => readFile(p, "utf8"))).sources);
  const L = createFullGame({ content: act1, seed: 1 });
  assert.ok(["high", "low"].includes(L.env.term("tide.next")), "the Gullet's night still turns");
});
