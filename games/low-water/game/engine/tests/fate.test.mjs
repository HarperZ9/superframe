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
import { lintFates, checkFateRuns, outcomes, EXEMPT } from "../tools/fatecheck.mjs";

const SLICE = join(ROOT, "..", "..", "content", "quota", "slice.lwd");
const base = (await loadAct(SLICE, (p) => readFile(p, "utf8"))).sources;
const content = loadContent(base);
const withExtra = (extra) => loadContent([...base, { file: "plant.lwd", text: extra }]);

test("the slice's fates lint clean, and each has a way it falls and a way it does not", () => {
  assert.deepEqual(lintFates(content).map((o) => o.msg), []);
  // Two ways holds for every fate but the ones tools/fatecheck.mjs lists in EXEMPT, each with its decision of record.
  // There is one: f.e5_danil, era 5's canon hinge, which falls on every way out of its scene. The list is pinned
  // here, so a second exemption fails this test until it is added on purpose.
  assert.deepEqual(Object.keys(EXEMPT), ["f.e5_danil"]);
  for (const f of Object.values(content.community.fates)) {
    const o = outcomes(f, content.book.nodes);
    if (EXEMPT[f.id]) assert.ok(o.length > 0 && o.every((x) => x.fell), `${f.id}: exempt, and falls on every way out`);
    else assert.ok(o.some((x) => x.fell) && o.some((x) => !x.fell), f.id);
  }
  // Era 2's three fates and their deciders, as before. The slice now carries eras 1, 3, 4 and 5 as well
  // (e1_world.lwd, e3_world.lwd, e4_world.lwd, e5_world.lwd): 23 fates, each pinned to the person who decides it.
  const deciders = Object.fromEntries(Object.values(content.community.fates).map((f) => [f.id, f.decider]));
  assert.deepEqual(Object.keys(deciders).filter((id) => !/^f\.e\d_/.test(id)).map((id) => deciders[id]).sort(), ["BET", "GEDGE", "HOLT"]);
  assert.deepEqual(deciders, {
    "f.anni_home": "BET", "f.aaron_taken": "GEDGE", "f.tomas_held": "HOLT",
    "f.e1_sallis": "JOSH", "f.e1_kel": "GEORGE",
    "f.e3_flat": "TOBIN", "f.e3_list": "ANNI", "f.e3_aaron": "WILL", "f.e3_bed": "CLARA", "f.e3_sholl": "ANNI", "f.e3_well": "GEDGE", "f.e3_tomas": "TOMAS",
    "f.e4_hire": "JOSS", "f.e4_map": "VICTOR", "f.e4_lew": "COL", "f.e4_row": "DALE", "f.e4_shelter": "ANNI",
    "f.e5_danil": "LEON", "f.e5_cert": "SAM", "f.e5_house": "LEON", "f.e5_frank": "FRANK", "f.e5_page_tom": "TOM", "f.e5_page_leon": "LEON",
  });
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
