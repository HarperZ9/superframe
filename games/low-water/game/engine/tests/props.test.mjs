// Props that carry story (world/props.mjs, design/PITCHES.md 3c.1): the state by era and by the world, the
// examine verb, what examining records, and the prop lint (tools/proplint.mjs) on the slice and on bad records.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";
import { ROOT } from "./helpers.mjs";
import { lintProps, checkPropCoverage } from "../tools/proplint.mjs";

const SLICE = join(ROOT, "..", "..", "content", "quota", "slice.lwd"), WIRING = join(ROOT, "wiring", "quota-areas.lwd");
const base = (await loadAct(SLICE, (p) => readFile(p, "utf8"))).sources;
base.push({ file: "quota-areas.lwd", text: await readFile(WIRING, "utf8") });
const content = loadContent(base);
const game = (C = content) => { const G = createFullGame({ content: C, seed: 1 }); G.create({ archetype: "q.ned", enter: false }); return G; };

test("every prop in the slice loads, and is an object with the examine verb at its place", () => {
  assert.deepEqual(content.errors.filter((e) => e.level !== "warn"), []);
  const P = content.story.props;
  assert.ok(Object.keys(P).length >= 10);
  for (const p of Object.values(P)) { assert.equal(content.objects[p.id].verbs[0].kind, "examine"); assert.ok(["person", "household", "era"].includes(p.tells.kind)); }
  const G = game(); G.setPlace("q_haldane");
  const here = G.verbs.list().map((x) => x.object.id);
  for (const id of ["q.haldane_table", "q.haldane_bowls", "q.haldane_ration_card"]) assert.ok(here.includes(id), id);
  assert.ok(!here.includes("q.district_map"), "a prop is offered only at its own place");
});

test("a prop's state follows the era and the world: the Haldane bowls by the model, the table by era", () => {
  const G = game();
  assert.equal(G.props.state("q.haldane_bowls").id, "five");
  G.community.state.households.haldane.bowls = 4;
  assert.equal(G.props.state("q.haldane_bowls").id, "four");
  assert.equal(G.props.state("q.haldane_table").id, "fewer");
  G.state.vars.era = 5;
  assert.equal(G.props.state("q.haldane_table").id, "shop");
  assert.equal(G.props.state("q.haldane_bowls").id, "survivor");
  G.state.vars.era = 9; assert.equal(G.props.state("q.haldane_table"), null, "an era with no state shows nothing");
});

test("examining shows the state's text, sets seen flags, emits prop.examine, and runs through the verb", () => {
  const G = game(); G.setPlace("q_returns");
  const seen = []; G.on("prop.examine", (e) => seen.push(e));
  const r = G.verbs.act("q.district_map", "examine");
  assert.ok(r.ok); assert.match(r.lines.map((l) => l.text).join(" "), /crease runs right through Krall's End/);
  assert.ok(G.state.flags.includes("seen.q.district_map") && G.state.flags.includes("seen.q.district_map.worn"));
  assert.deepEqual(seen.map((e) => [e.id, e.state, e.tells.kind, e.tells.id]), [["q.district_map", "worn", "person", "q.ned"]]);
  const again = G.verbs.act("q.district_map", "examine"); assert.ok(again.ok, "a prop can be looked at again");
});

// the cell log is Tomas's cap on the Brack kitchen nail now (weighted devices, 2026-10-23, DEVICE-AUDIT 3.4)
test("the nail behind the Brack door shows what the week did: Will's coat, and Tomas's cap once he is dead", () => {
  const G = game();
  assert.equal(G.props.state("q.brack_nail").id, "coat");
  G.setFlag("q.tomas_held", true); assert.equal(G.props.state("q.brack_nail").id, "coat", "not before the Sunday");
  G.community.state.day = 45; assert.equal(G.props.state("q.brack_nail").id, "cap");
  const G2 = game(); G2.state.vars.q_class = "militia"; G2.setFlag("q.tomas_held", true); G2.community.state.day = 45; G2.setPlace("q_brack_kitchen");
  G2.props.touch("q.brack_nail", 0); assert.ok(G2.lore.isFound("q.lore.cell_log"), "the hand on the cap finds it");
});

test("the prop lint passes the slice (plates by name only) and catches each kind of bad record", () => {
  const plates = { q_haldane: { id: "q_haldane", marks: ["hearth", "table", "well_shelf", "ration_card"] } };
  const plateOf = (C, place) => plates[place] || null;
  assert.deepEqual(lintProps(content, { plateOf }).filter((o) => o.level === "error"), []);
  const bad = `@prop x.notells
name: A cup
place: q_haldane
mark: table
state: 2 cup | A cup that belonged to somebody, once, long before the famine.

@prop x.nofallback
name: A jug
place: q_haldane
mark: jug
tells: household haldane
state: 2 full ? bowls(haldane) >= 5 | A jug of water from the Well, carried up by Anni every morning before light.

@prop x.short
name: A stool
place: q_nowhere
tells: person q.nobody
state: 2 stool | A stool.

@prop x.badcond
name: A pot
place: q_haldane
mark: hearth
tells: household nobody
state: 2 pot ? nosuchcall(1) | The pot on its hook, which Bet scours with sand because the soap went in the autumn.
`;
  const C = loadContent([...base, { file: "bad.lwd", text: bad }]);
  const msgs = lintProps(C, { plateOf }).filter((o) => o.level === "error").map((o) => o.msg).join("\n");
  assert.match(msgs, /x\.notells: tells: expected/);
  assert.match(msgs, /x\.nofallback: era 2: the last state \(full\) has a condition/);
  assert.match(msgs, /x\.nofallback: mark jug: not on the plate q_haldane/);
  assert.match(msgs, /x\.short: tells: no @char q\.nobody/);
  assert.match(msgs, /x\.short: place: no @place q_nowhere/);
  assert.match(msgs, /x\.short: state 2 stool: the text says too little/);
  assert.match(msgs, /x\.badcond: tells: no @household nobody/);
  assert.match(msgs, /x\.badcond: state 2 pot: the condition fails/);
});

test("the coverage check fails a prop at a scene's place that no run looked at, and lists unreached states", () => {
  // the runs play every era in turn, so a state of any era counts (era 4's props were reported never seen while
  // only era 2's states counted, 2026-10-23); each prop's first state of each era stands for "looked at"
  const all = Object.values(content.story.props).filter((p) => p.place !== "q_haldane").flatMap((p) => p.states.map((s) => `${p.id}:${s.id}`));
  // every hand on a thing done too (weighted devices, 2026-10-23: a touch done on no run is an error of its own)
  const touched = Object.values(content.story.props).flatMap((p) => (p.touches || []).map((t) => `${p.id}:${t.kind}`));
  const res = checkPropCoverage(content, [{ props: all, touched }]);
  assert.equal(res.errors, 4, res.lines.join(" | ")); // the four Haldane props: the coda is set at q_haldane
  assert.match(res.lines.join(" | "), /error: q\.haldane_bowls \(q_haldane, q3_mott_house, q4_joss_flat, q5_mara_flat\): no run looked at it/); // its era 3 and 4 places, 2026-10-23
  const full = checkPropCoverage(content, [{ props: [...all, "q.haldane_table:laid", "q.haldane_bowls:five", "q.haldane_ration_card:card", "q.haldane_thread:spool"], touched }]);
  assert.equal(full.errors, 0); assert.match(full.lines.join(" | "), /q\.haldane_bowls: era 2 state four .* no run reached it/);
  // an era 4 prop seen in era 4 is seen, and one nobody looked at is an error, not an era 2 warning
  const era4 = checkPropCoverage(content, [{ props: all.filter((k) => !k.startsWith("q.bank_map:")), touched }]);
  assert.match(era4.lines.join(" | "), /error: q\.bank_map \(q4_board\): no run looked at it/);
  assert.doesNotMatch(res.lines.join(" | "), /q\.bank_map/);
});

test("a prop stands where its era's scenes are set (in:): era 5's table is in the shop window, and the verb is offered there", () => {
  const G = game(); G.state.vars.era = 5; G.setPlace("q5_shop");
  assert.ok(G.props.here().some((p) => p.id === "q.haldane_table"));
  assert.ok(G.verbs.list().some((v) => v.object.id === "q.haldane_table"));
  const line = G.verbs.act("q.haldane_table", "examine").lines[0];
  assert.match(line.text, /antique shop/); assert.equal(line.macro, undefined); // the mark is q_haldane's plate's, not the shop's
  G.state.vars.era = 2; G.setPlace("q5_shop");
  assert.ok(!G.props.here().some((p) => p.id === "q.haldane_table"));
  const bad = loadContent([...base, { file: "bad.lwd", text: "@prop x.where\nname: A cup\nplace: q_haldane\ntells: era\nin: 5 nowhere_at_all\nstate: 2 cup | A cup that belonged to somebody once, long before the famine.\n" }]);
  assert.match(lintProps(bad).map((o) => o.msg).join(" | "), /in: 5 nowhere_at_all: no @place/);
});

test("the close look: a prop's macro: rides on its line, needs a mark, and plays only when it may (examinecam)", async () => {
  assert.deepEqual(content.story.props["q.district_map"].macro, { secs: 2.4, zoom: 2 });
  const G = game(); G.setPlace("q_returns");
  const line = G.verbs.act("q.district_map", "examine").lines[0];
  assert.deepEqual(line.macro, { secs: 2.4, zoom: 2, place: "q_returns", mark: "map" });
  const bad = loadContent([...base, { file: "bad.lwd", text: "@prop x.nomark\nname: A cup\nplace: q_haldane\ntells: era\nmacro: 2\nstate: 2 cup | A cup that belonged to somebody once, long before the famine.\n" }]);
  assert.ok(bad.errors.some((e) => /x\.nomark: macro: expected .* on a prop with a mark/.test(e.msg)));
  // the look itself, against a stand-in camera and input
  const { examineLook } = await import("../ui/examinecam.mjs");
  const L = new Map(); globalThis.addEventListener = (k, f) => L.set(k, f); globalThis.removeEventListener = (k) => L.delete(k);
  let settled = false; const calls = [];
  const cam = { macro: (at, o) => calls.push(at ? ["in", at, o] : ["out"]), macroSettled: () => settled, place: () => ({ marks: { spots: [{ id: "map", at: [1, 0, 2] }] } }) };
  const shown = [], show = (l) => shown.push(l);
  examineLook({ G, prefs: { calm: true } }, { cam }, [line], show); assert.equal(shown.length, 1, "reduced motion: the text at once, no camera");
  assert.equal(calls.length, 0);
  examineLook({ G, prefs: { closeLooks: false } }, { cam }, [line], show); assert.equal(shown.length, 2, "close looks off");
  examineLook({ G, prefs: {} }, { cam }, [line], show);
  assert.deepEqual(calls[0].slice(0, 2), ["in", [1, 0.9, 2]]); assert.equal(shown.length, 2, "the text waits for the camera");
  assert.deepEqual(globalThis.__lwFocusRequest.at, [1, 0.9, 2], "the shallow-focus request");
  L.get("keydown")(); assert.equal(shown.length, 3, "any input skips to the text"); assert.equal(calls[1][2].skip, true);
  L.get("keydown")(); assert.deepEqual(calls.at(-1), ["out"], "the next lets the look go"); assert.equal(globalThis.__lwFocusRequest, null);
  const noMark = { ...line, macro: { ...line.macro, mark: "nowhere" } };
  examineLook({ G, prefs: {} }, { cam }, [noMark], show); assert.equal(shown.length, 4, "no mark on the plate: the text at once");
  delete globalThis.addEventListener; delete globalThis.removeEventListener;
});
