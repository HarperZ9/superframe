// Perspective chapters (world/perspective.mjs): a second sheet for one chapter inside a run, the world keeping what
// it did, and the run's own character back exactly as they were; a save in the middle; the perspective check.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";
import { ROOT } from "./helpers.mjs";
import { lintPerspectives, checkPerspectiveRuns } from "../tools/perspectivecheck.mjs";
import { createSaves, memoryStorage } from "../save/save.mjs";
import { newSheet } from "../rules/sheet.mjs";

const SLICE = join(ROOT, "..", "..", "content", "quota", "slice.lwd");
const base = (await loadAct(SLICE, (p) => readFile(p, "utf8"))).sources;
const content = loadContent(base);
const game = () => { const G = createFullGame({ content, seed: 1 }); G.create({ archetype: "q.will", enter: false }); G.state.vars.q_class = "militia"; G.state.vars.q_door = "held"; return G; };
const person = (G) => JSON.stringify(["sheet", "inv", "cabinet", "checks", "ink"].map((k) => G.state[k] ?? null));
const pick = (t, words) => t.choose(t.beat.options.findIndex((o) => o.label.includes(words)));

test("the chapter is played as Bet on her own sheet, and Will comes back exactly as he was", () => {
  const G = game(); G.sheet.raise && G.state.sheet.points++; G.checks.resolve("x.test", "grip", 2);
  const before = person(G), ev = [];
  for (const k of ["perspective.start", "perspective.end"]) G.on(k, (e) => ev.push(`${k}:${e.id}`));
  const t = G.talk("q.persp.bet.door");
  assert.equal(G.perspective.active(), "q.pov.bet");
  assert.equal(G.state.sheet.archetype, "q.bet"); assert.equal(G.state.sheet.name, "Bet Haldane"); assert.equal(G.playerFigure(), "bet");
  assert.equal(G.sheet.attr("nose"), 4, "her compartments, not his"); assert.deepEqual(G.state.inv.equipped, {}, "her own pack");
  G.community.record("witness.door", "haldane", "haldane_yard");
  pick(t, "Get Anni home");
  assert.equal(G.perspective.active(), null);
  assert.equal(person(G), before, "the sheet, pack, cabinet, checks and ink are his again");
  assert.equal(G.playerFigure(), "will");
  assert.equal(G.state.vars.bet_door, "home", "what she chose stays in the world");
  assert.equal(G.community.state.events.at(-1).pov, "q.pov.bet", "the record says whose eyes it was");
  assert.deepEqual(ev, ["perspective.start:q.pov.bet", "perspective.end:q.pov.bet"]);
});

test("a save in the middle of the chapter loads back into it, and ends the same", async () => {
  const S = memoryStorage(), G = game(), before = person(G);
  const saves = createSaves(G, S, { newSheet });
  G.talk("q.persp.bet.door"); saves.save("1", "outside the granary");
  const H = game(); const sv = createSaves(H, S, { newSheet }); await sv.load("1");
  assert.equal(H.perspective.active(), "q.pov.bet"); assert.equal(H.state.sheet.archetype, "q.bet");
  H.perspective.end(); assert.equal(person(H), before);
  assert.equal(G.perspective.end(), true); assert.equal(G.perspective.end(), false, "ending twice does nothing");
});

test("the perspective lint and the played check catch a chapter that does not come back", () => {
  assert.deepEqual(lintPerspectives(content), []);
  const bad = `@perspective x.pov
archetype: q.nobody
start: x.start
return: q.coda

@node x.start
nar: A chapter that forgets to begin.
opt: "Out" -> x.out
opt: "On" -> q.coda

@node x.out
end: q.end
`;
  const msgs = lintPerspectives(loadContent([...base, { file: "bad.lwd", text: bad }])).map((o) => o.msg).join("\n");
  for (const re of [/x\.pov: no archetype q\.nobody/, /x\.pov: the start node x\.start does not say perspective\(x\.pov\)/, /x\.pov: the node x\.out ends the act inside the chapter/, /x\.pov: the node x\.start goes to q\.coda without ending the chapter/, /x\.pov: no path from x\.start ends the chapter/]) assert.match(msgs, re);
  const ok = { id: "q.pov.bet", ended: true, changed: [], figureBefore: "will", figureAfter: "will", worldKept: true, during: { archetype: "q.bet", figure: "bet" } };
  assert.equal(checkPerspectiveRuns(content, [{ build: "a", finished: true, perspectives: [ok] }]).errors, 0);
  const out = checkPerspectiveRuns(content, [{ build: "b", finished: true, perspectives: [{ ...ok, changed: ["inv"], figureAfter: "bet", worldKept: false, during: { archetype: "q.will", figure: "will" } }, { id: "q.pov.bet", ended: false }] }]).lines.join("\n");
  for (const re of [/b: q\.pov\.bet: the run's own inv came back changed/, /the figure came back as bet/, /what the chapter did to the world was undone/, /the sheet in the chapter was q\.will/, /the figure in the chapter was will/, /b: q\.pov\.bet never ended/]) assert.match(out, re);
  assert.match(checkPerspectiveRuns(content, []).lines.join("\n"), /q\.pov\.bet: played on no run/);
});
