// Focused against spread builds over every encounter in Acts 1 to 3, with the scripted fighter.
// Prints wins (win or yield), downs, and the mean length of the fights won, per build.
//   node tools/minmax.mjs [seeds=2]
// Budgets are the end of the game by section 19.4 (compartment sum about 22, 44 pages).
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGame } from "../../game.mjs";
import { installCombat } from "../encounter.mjs";
import { createPilot } from "./pilot.mjs";

const CONTENT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "content");
const read = (d, f) => ({ file: `${d}/${f}`, text: readFileSync(join(CONTENT, d, f), "utf8") });
const all = (d) => readdirSync(join(CONTENT, d)).filter((f) => f.endsWith(".lwd") && !/^act\d\.lwd$/.test(f)).map((f) => read(d, f));
const ACTS = { act1: () => [read("act1", "combat.lwd"), read("act1", "encounters1.lwd")], act2: () => [read("act1", "combat.lwd"), ...all("act2")], act3: () => [read("act1", "combat.lwd"), read("act2", "rules2.lwd"), ...all("act3")] };
const five = (v) => Object.fromEntries(["grip", "ballast", "knees", "pride", "formletter", "sum", "dark", "salt", "carbon", "precedent", "undertow", "condolence", "hearsay", "smell"].map((k) => [k, v]));

export const BUILDS = {
  focused: { levels: { coat: 9, nose: 6, pen: 3, hat: 4, ...five(3), grip: 9, ballast: 9, knees: 9, pride: 9 }, tool: "w.hammer", temper: 3, fitting: "weighted_head" },
  spread: { levels: { coat: 6, nose: 6, pen: 5, hat: 5, ...five(5) }, tool: "w.case", temper: 3 },
  early: { levels: {}, tool: "w.case", temper: 0 },
};

export function runBuild(lamb, seeds = 2) {
  const r = { fights: 0, won: 0, down: 0, wonSeconds: [], allSeconds: [] };
  for (const act of Object.keys(ACTS)) {
    const ids = Object.keys(installCombat(createGame({ sources: ACTS[act](), seed: 1 })).defs).filter((id) => !id.includes(".sneak"));
    for (const id of ids) for (let s = 1; s <= seeds; s++) {
      const G = createGame({ sources: ACTS[act](), seed: s }); if (id.startsWith("e3.oldlight")) G.env.advance(94);
      const C = installCombat(G), W = C.start(id, { lamb }), pilot = createPilot({ style: "fighter" });
      for (let i = 0; i < 60 * 125 && !W.result; i++) C.step(pilot(W));
      const o = W.result ? W.result.outcome : "none", sec = W.tick / 60;
      r.fights++; r.allSeconds.push(sec);
      if (o === "win" || o === "yield") { r.won++; r.wonSeconds.push(sec); }
      if (o === "down" || o === "lose") r.down++;
    }
  }
  const mean = (a) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : null);
  return { fights: r.fights, won: r.won, rate: +(r.won / r.fights).toFixed(2), down: r.down, meanWonSeconds: mean(r.wonSeconds), meanSeconds: mean(r.allSeconds) };
}

if (process.argv[1] && process.argv[1].endsWith("minmax.mjs")) {
  const seeds = +(process.argv[2] || 2);
  for (const [name, b] of Object.entries(BUILDS)) console.log(name, JSON.stringify(runBuild(b, seeds)));
}
