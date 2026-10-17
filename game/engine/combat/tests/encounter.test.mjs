// The dialogue-to-fight hand-off on the director's Act 1 records (content/act1/combat.lwd, read
// only): load, start, step through G.loop, end, finish to the outcome node, and the Record.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createGame } from "../../game.mjs";
import { installCombat } from "../encounter.mjs";
import { createPilot } from "../tools/pilot.mjs";
import { HERE, ARENA_LWD } from "./helpers.mjs";

// The director's fight files: combat.lwd (tools and foes) and every encounters*.lwd.
const ACT1 = join(HERE, "..", "..", "..", "..", "content", "act1");
export const FIGHT_FILES = () => readdirSync(ACT1).filter((f) => f === "combat.lwd" || /^encounters.*\.lwd$/.test(f)).map((f) => ({ file: f, text: readFileSync(join(ACT1, f), "utf8") }));
const game = () => {
  const G = createGame({ sources: [{ file: "arena.lwd", text: ARENA_LWD }, ...FIGHT_FILES()], seed: 11 });
  G.state.place = "floor";
  return { G, C: installCombat(G) };
};

test("every Act 1 encounter loads with its foes and outcome nodes", () => {
  const { C } = game();
  assert.deepEqual(C.errors.filter((e) => e.level !== "warn"), []);
  for (const id of ["e.salvors", "e.conger", "e.gulls", "e.eels", "e.afterdark", "e.lamplighters", "e.wardens", "e.dogs", "e.hammer"]) {
    assert.ok(C.defs[id], id);
    assert.ok(C.defs[id].nodes.win && C.defs[id].nodes.down, `${id} has win and down`);
  }
});

test("request, take, start, run through G.loop, finish: the outcome node and the Record", () => {
  const { G, C } = game(), seen = [];
  G.on("fight.request", (e) => seen.push(e.id));
  C.request("e.salvors");
  assert.deepEqual(seen, ["e.salvors"]);
  const W = C.start(C.take());
  assert.equal(W.fighters.length, 4, "Lamb, Lugg and two salvors");
  const pilot = createPilot();
  let end = null; G.on("fight.end", (e) => { end = e; });
  for (let i = 0; i < 60 * 120 && !end; i++) { C.step(pilot(W)); }
  assert.ok(end, "the fight ended within two minutes");
  const node = C.finish();
  assert.equal(node, C.defs["e.salvors"].nodes[end.outcome] || C.defs["e.salvors"].nodes.down);
  assert.ok(G.state.flags.includes("fought.e.salvors"));
  assert.equal(G.state.vars.fights, 1);
  assert.equal(C.outcome("e.salvors"), end.outcome);
  assert.equal(C.current, null);
});

test("the loop system steps the current fight from G.input", () => {
  const { G, C } = game();
  const W = C.start("e.conger");
  G.input.press("light");
  G.loop.step();
  assert.equal(W.tick, 1);
  assert.ok(W.lamb().act && W.lamb().act.id.startsWith("lamb:light_1"));
});

test("a Lamplighter who can see Lamb strike writes it down", () => {
  const { G, C } = game();
  G.state.place = "quay";
  const W = C.start("e.lamplighters");
  const L = W.lamb(), F = W.fighters[1];
  L.x = F.x; L.z = F.z - 1.4; L.face = Math.PI / 2;
  for (const f of W.fighters.slice(1)) f.mem = { next: 1e9, seen: null, move: { mx: 0, mz: 0 }, cool: 1e9 };
  C.step({ press: ["light"] });
  for (let i = 0; i < 30; i++) C.step({});
  W.result = { outcome: "fled", reason: "test", tick: W.tick };
  C.finish();
  assert.ok(G.state.flags.includes("book.violence"));
});

test("@bark records replace the placeholder lines", () => {
  const extra = "\n@bark b.frost\nkey: footing.frost\ntext: A test line for frost.\n";
  const G = createGame({ sources: [{ file: "arena.lwd", text: ARENA_LWD + extra }, ...FIGHT_FILES()], seed: 11 });
  const C = installCombat(G);
  assert.equal(C.errors.filter((e) => /bark/.test(e.msg)).length, 0);
  G.state.place = "quay";
  G.env.advance(5 * 60 + 40);
  const W = C.start("e.wardens"), seen = [];
  for (let i = 0; i < 90; i++) for (const e of C.step({})) if (e.type === "bark") seen.push(e.text);
  assert.ok(seen.includes("A test line for frost."), JSON.stringify(seen));
});

test("every @foe in the Act 1 file gets an archetype that suits its tool", async () => {
  const { styleFor } = await import("../data/foes.mjs");
  const { G } = game(), foes = G.book.records.foe;
  for (const [id, rec] of Object.entries(foes)) {
    const tool = (rec.kv.find((e) => e.key === "tool") || {}).value;
    const style = styleFor(id, rec);
    assert.ok(["holder", "skirmisher"].includes(style), id);
    if (tool && /pole|boathook|hammer/.test(tool)) assert.equal(style, "holder", `${id} carries ${tool}`);
  }
});
