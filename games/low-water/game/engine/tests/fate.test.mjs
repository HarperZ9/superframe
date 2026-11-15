// A person's fate is decided by a named person (world/community.mjs @fate, tools/fatecheck.mjs;
// design/spine-plan/03-FATES.md section 6). Controls: the old H1 rule, planted, is refused; a @fate whose scene has no
// line by its decider fails; a fate with one outcome fails; a bowl changed by a rule fails the played check.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";
import { ROOT } from "./helpers.mjs";
import { lintFates, checkFateRuns, outcomes } from "../tools/fatecheck.mjs";

const SLICE = join(ROOT, "..", "..", "content", "quota", "slice.lwd");
const base = (await loadAct(SLICE, (p) => readFile(p, "utf8"))).sources;
const content = loadContent(base);
const withExtra = (extra) => loadContent([...base, { file: "plant.lwd", text: extra }]);

test("the slice's fates lint clean, and each has a way it falls and a way it does not", () => {
  assert.deepEqual(lintFates(content).map((o) => o.msg), []);
  for (const f of Object.values(content.community.fates)) { const o = outcomes(f, content.book.nodes); assert.ok(o.some((x) => x.fell) && o.some((x) => !x.fell), f.id); }
  assert.deepEqual(Object.values(content.community.fates).map((f) => f.decider).sort(), ["BET", "GEDGE", "HOLT"]);
});

test("control: the old H1 rule is refused: a person decides this", () => {
  const C = withExtra(`@rule H1
name: a bowl goes
per: household
when: food < 0.15
do: bowls -= 1
delay: 0
once: yes
`);
  assert.ok(C.errors.some((e) => /rule H1: writes bowls: a person decides this: use @fate/.test(e.msg)), C.errors.map((e) => e.msg).join(" | "));
  assert.ok(lintFates(C).some((o) => /rule H1/.test(o.msg)));
});

test("control: a fate whose scene has no line by its decider fails, and so does one with a single outcome", () => {
  const C = withExtra(`@fate x.silent
pressure: food < 0.15
subject: household haldane
decider: BET
scene: q.fate.yard

@fate x.one
pressure: food < 0.15
subject: household haldane
decider: ANNI
scene: q.coda.whole
`);
  const msgs = lintFates(C).map((o) => o.msg).join("\n");
  assert.match(msgs, /fate x\.silent: BET decides it, and has no line in its scene \(q\.fate\.yard\) \(A decider speaks\)/);
  assert.match(msgs, /fate x\.one: its scene has no outcome where it falls \(Two ways\)/);
});

test("the model presses and decides nothing: a pressure holds, the bowls stay, until the scene calls fate()", () => {
  const G = createFullGame({ content, seed: 1 }); G.create({ archetype: "q.ned", enter: false });
  const C = G.community; C.shift("owed", 120, "haldane_yard"); C.run(8);
  assert.ok(C.pressure("f.anni_home")); assert.equal(C.bowls("haldane"), 5);
  C.fate("f.anni_home", "anni"); assert.equal(C.bowls("haldane"), 4); C.fate("f.anni_home", "anni"); assert.equal(C.bowls("haldane"), 4, "a fate falls once");
  const ev = C.state.events.find((e) => e.type === "fate.f.anni_home"); assert.equal(ev.decider, "BET");
});

test("control: the played check fails a bowl a rule took, and a pressure whose scene never played", () => {
  const bad = { build: "x", finished: true, visited: [], pressure: { "f.anni_home": 48 }, fates: {}, table: { haldane: 4, furrowe: 4, brack: 3 },
    fateLog: [{ at: "household:haldane", name: "bowls", from: 5, to: 4, path: [{ rule: "H1" }] }] };
  const res = checkFateRuns(content, [bad]).lines.join("\n");
  assert.match(res, /the pressure f\.anni_home held on day 48 and none of its scenes \(q\.fate\.gate\) played \(Played\)/);
  assert.match(res, /bowls 5 to 4 came from the rule H1, not a person in a scene \(Cause\)/);
  assert.match(res, /the haldane table has 4 bowls; 5 members less 0 fates is 5 \(Cause\)/);
});
