// Rumour and discourse (world/discourse.mjs): the four acts on a claim through the crier's and the chalk's verbs, their record
// events and costs, the carriers' rules, and the discourse check on the slice and on bad content.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";
import { ROOT } from "./helpers.mjs";
import { lintDiscourse, simulateDiscourse } from "../tools/discoursecheck.mjs";

const SLICE = join(ROOT, "..", "..", "content", "quota", "slice.lwd");
const base = (await loadAct(SLICE, (p) => readFile(p, "utf8"))).sources, text = base.map((s) => s.text).join("\n");
const content = loadContent(base);
const game = (cls = "inspector") => { const G = createFullGame({ content, seed: 1 }); G.create({ archetype: cls === "militia" ? "q.will" : "q.ned", enter: false }); G.state.vars.q_class = cls; return G; };
const verb = (G, obj, label) => { G.setPlace(content.objects[obj].place); return G.verbs.act(obj, "mark", { label }); };

test("the claims and carriers load: the notices, the pub and the pulpit carry the hoarding claim", () => {
  assert.deepEqual(content.errors.filter((e) => e.level !== "warn"), []);
  assert.deepEqual(content.story.claims["cl.hesh_hoard"].carriers, ["notices", "pub", "pulpit"]);
  assert.deepEqual(Object.keys(content.community.carriers).sort(), ["notices", "pub", "pulpit"]);
  assert.deepEqual(lintDiscourse(content, text), []);
});

test("each act at the crier is a record event; the answer quotes its words; the flags and the act log keep it", () => {
  const G = game(), ev = [];
  G.on("discourse.act", (e) => ev.push(e.act));
  assert.ok(verb(G, "q.notice_exchange", "Shout it with him").ok);
  const answer = "Get up on the crate and say what you saw on the hill";
  assert.ok(!G.verbs.list().some((x) => x.label === answer), "the answer needs what was seen on the hill");
  G.setFlag("q.true_in_hand", true);
  assert.ok(verb(G, "q.notice_exchange", answer).ok);
  const types = G.community.state.events.map((e) => e.type);
  assert.deepEqual(types, ["spoken.position", "answer.claim"]);
  assert.match(G.community.state.events[1].words, /no hole on that hill/);
  assert.equal(G.community.state.events[1].street, "square");
  assert.ok(G.state.flags.includes("did.repeat.cl.hesh_hoard") && G.state.flags.includes("did.answer.cl.hesh_hoard"));
  assert.deepEqual(ev, ["repeat", "answer"]); assert.equal(G.discourse.acts().length, 2);
  // the paper acts are read as the hand and the voice (old saves and fixtures), and the lint refuses them in content
  G.discourse.act("tear", "cl.hesh_hoard", "square"); assert.equal(G.discourse.acts().at(-1).act, "silence");
  assert.ok(lintDiscourse(content, "discourse(paste, cl.hesh_hoard, square, cl.true_figure)").some((x) => /paper act/.test(x.msg)));
});

test("challenging costs the challenger's own household; a crier pulled down is back in two days", () => {
  for (const [cls, hh] of [["inspector", "furrowe"], ["militia", "brack"]]) {
    const G = game(cls), before = +G.community.stock("portion", hh);
    verb(G, "q.notice_post", "Tell the carts it's a lie");
    assert.ok(+G.community.stock("portion", hh) < before, `${cls}: ${hh}'s portion`);
  }
  const G = game(); G.community.shift("volume.notices", 0.3);
  verb(G, "q.notice_post", "Scrub it off with your sleeve"); const torn = G.discourse.volume("notices");
  G.community.run(3); assert.ok(G.discourse.volume("notices") > torn, "reposted");
});

test("the played check passes the slice, and fails a carrier that turns its volume the wrong way", () => {
  const res = simulateDiscourse(content, createFullGame);
  assert.equal(res.errors, 0, res.lines.filter((l) => l.startsWith("error")).join(" | "));
  const bad = `@carrier choir
name: A choir that sings the Hesh up
target: hesh
volume: 0.2
reach: all

@claim cl.bad
words: A CLAIM THAT RAISES WHAT IT ATTACKS
target: hesh
victim: haldane
carriers: choir, nowhere

@rule Rbad
name: the choir
per: street
when: volume.choir > 0.2
do: standing.hesh += 0.05 * volume.choir
delay: 1
`;
  const C = loadContent([...base, { file: "bad.lwd", text: bad + "\n@node x.bad\ndo: discourse(shout, cl.none)\ngo: q.start\n" }]);
  const msgs = lintDiscourse(C, text + bad + "discourse(shout, cl.none)").map((o) => o.msg).join("\n");
  assert.match(msgs, /claim cl\.bad: no @carrier nowhere/);
  assert.match(msgs, /discourse\(shout, cl\.none\): no act shout/); assert.match(msgs, /no claim cl\.none/);
  const C2 = loadContent([...base, { file: "bad.lwd", text: bad.replace(", nowhere", "") }]);
  assert.match(simulateDiscourse(C2, createFullGame).lines.join("\n"), /repeat cl\.bad in the choir: two weeks on, standing\.hesh is nowhere lower/);
});
