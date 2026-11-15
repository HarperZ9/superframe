// Dreams (world/dreams.mjs): a possible future from the model through the dreamer's fear, set against the day it
// names with no verdict; and the dream check on the slice and on bad content.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";
import { ROOT } from "./helpers.mjs";
import { lintDreams, checkDreamRuns } from "../tools/dreamcheck.mjs";

const SLICE = join(ROOT, "..", "..", "content", "quota", "slice.lwd");
const base = (await loadAct(SLICE, (p) => readFile(p, "utf8"))).sources, text = base.map((s) => s.text).join("\n");
const content = loadContent(base);
const game = (C = content) => { const G = createFullGame({ content: C, seed: 1 }); G.create({ archetype: "q.ned", enter: false }); G.state.vars.q_class = "inspector"; return G; };

test("dreaming looks ahead on a copy: the real model, flags and variables are untouched, and nothing is emitted", () => {
  const G = game(), before = JSON.stringify([G.community.state, G.state.vars, G.state.flags]), ev = [];
  G.on("community.rule", () => ev.push(1));
  const s = G.dreams.project("q.dream.table");
  assert.ok(s && s.text);
  assert.equal(JSON.stringify([G.community.state, G.state.vars, G.state.flags]), before); assert.deepEqual(ev, []);
});

test("the dreamer's fear is in the dream: a household the model leaves at the edge is dreamed short", () => {
  const G = game(); G.community.state.streets.haldane_yard.food = 0.2; // near the line where a child goes (rule H1)
  const withFear = G.dreams.project("q.dream.table").id;
  const d = G.dreams.all["q.dream.table"], fears = d.fears; d.fears = [];
  const without = G.dreams.project("q.dream.table").id; d.fears = fears;
  assert.notEqual(withFear, without, `fear ${withFear}, no fear ${without}`);
});

test("a dream is kept, set against its day with no verdict, and cues the dream look when it comes true", () => {
  const G = game(), seen = [], cmds = [];
  G.on("dream.due", (e) => seen.push(e)); G.on("cmd", (e) => cmds.push(e.args.join(" ")));
  const text = G.fill("{{dream(q.dream.table)}}"); assert.match(text, /bowl/);
  assert.equal(G.fill("{{dream(q.dream.table)}}"), text, "the same night, the same dream");
  const x = G.dreams.list()[0]; assert.equal(x.due, 48); assert.equal(x.matched, null);
  G.advance(7 * 1440);
  assert.equal(seen.length, 1); assert.equal(typeof seen[0].matched, "boolean");
  assert.equal(cmds.includes("dream cue"), seen[0].matched, "the recognition only when it came true");
  const row = G.readback.build("q.record").rows.find((r) => r.kind === "dream");
  assert.equal(row.when, "Day 48"); assert.equal(row.told.marker, "dream: q.dream.table"); assert.match(row.happened[0], /bowl/);
  assert.ok(!/premonition|fear|came true/i.test(JSON.stringify(row)), "no verdict in the record");
});

test("the dream lint and the played check catch bad dreams and closed readings", () => {
  const bad = `@dream x.one
days: 0
see: Something seen. ? nosuch(1)
reading: premonition | only one
`;
  const C = loadContent([...base, { file: "bad.lwd", text: bad }]), msgs = lintDreams(C, game(C), text + bad).map((o) => o.msg).join("\n");
  for (const re of [/x\.one: needs two readings/, /x\.one: days: looks ahead/, /x\.one: the last see: has a condition/, /x\.one: see s1: the condition fails/, /x\.one: no scene dreams it/]) assert.match(msgs, re);
  assert.deepEqual(lintDreams(content, game(), text), []);
  const run = (b, matched, cls = "inspector") => ({ build: b, endings: { class: cls }, dreams: [{ id: "q.dream.table", matched, finished: true }] });
  assert.equal(checkDreamRuns(content, [run("a", true), run("b", false)]).errors, 0);
  assert.match(checkDreamRuns(content, [run("a", true), run("b", false), run("c", false, "militia"), run("d", false, "militia")]).lines.join(" | "), /for militia it came true on none of 2 runs/);
  assert.match(checkDreamRuns(content, [run("a", true), run("b", true)]).lines.join("\n"), /the fear reading is closed/);
  assert.match(checkDreamRuns(content, [run("a", false)]).lines.join("\n"), /the premonition reading is closed/);
  assert.match(checkDreamRuns(content, [{ build: "c" }]).lines.join("\n"), /dreamed on no run/);
  assert.match(checkDreamRuns(content, [run("a", null)]).lines.join("\n"), /finished without setting the dream against its day/);
});
