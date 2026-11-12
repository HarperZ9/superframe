// Every encounter in Acts 1 to 3 (the director's files, read only) reaches an outcome within the
// time cap, with Lamb standing still and with the scripted player fighting. A fight that cannot
// end would hang the night; this is the guard against it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createGame } from "../../game.mjs";
import { installCombat, FIGHT_LIMIT } from "../encounter.mjs";
import { createPilot } from "../tools/pilot.mjs";
import { HERE } from "./helpers.mjs";

const CONTENT = join(HERE, "..", "..", "..", "..", "content");
const read = (dir, f) => ({ file: `${dir}/${f}`, text: readFileSync(join(CONTENT, dir, f), "utf8") });
const all = (dir) => (existsSync(join(CONTENT, dir)) ? readdirSync(join(CONTENT, dir)).filter((f) => f.endsWith(".lwd") && !/^act\d\.lwd$/.test(f)).map((f) => read(dir, f)) : []);
// Each act with the fight records it leans on from the acts before it.
const ACTS = {
  act1: () => [read("act1", "combat.lwd"), ...readdirSync(join(CONTENT, "act1")).filter((f) => /^encounters.*\.lwd$/.test(f)).map((f) => read("act1", f))],
  act2: () => [read("act1", "combat.lwd"), ...all("act2")],
  act3: () => [read("act1", "combat.lwd"), read("act2", "rules2.lwd"), ...all("act3")],
};
const CAP = (FIGHT_LIMIT + 5) * 60;

function runAll(act, mode) {
  const ids = Object.keys(installCombat(createGame({ sources: ACTS[act](), seed: 3 })).defs);
  const stuck = [], outcomes = {};
  for (const id of ids) {
    const G = createGame({ sources: ACTS[act](), seed: 3 }), C = installCombat(G), W = C.start(id), pilot = createPilot({ style: "fighter" });
    for (let i = 0; i < CAP && !W.result; i++) C.step(mode === "idle" ? {} : pilot(W));
    if (!W.result) stuck.push(id); else outcomes[W.result.outcome] = (outcomes[W.result.outcome] || 0) + 1;
  }
  return { ids, stuck, outcomes };
}

for (const act of Object.keys(ACTS)) for (const mode of ["idle", "fighter"]) {
  test(`every ${act} encounter ends within ${FIGHT_LIMIT + 5} s with ${mode === "idle" ? "Lamb standing still" : "the scripted fighter"}`, { timeout: 600000 }, () => {
    const r = runAll(act, mode);
    if (act !== "act3" || r.ids.length) assert.ok(r.ids.length > 0, `${act}: no encounters loaded`);
    assert.deepEqual(r.stuck, [], `${act} ${mode}: no outcome for ${r.stuck.join(", ")} (outcomes ${JSON.stringify(r.outcomes)})`);
  });
}
