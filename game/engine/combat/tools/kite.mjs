// Kiting against fair play, per play style, over every Act 1 and Act 2 encounter on its painted
// plate (the ground the shell fights on). Fair play is the scripted pilot playing like the build;
// kiting is the pilot's retreat-and-poke policy (tools/pilot.mjs kite). Prints, per style and
// policy: fights, won (win or yield), down, timed out, mean seconds, mean Standing lost.
//   node tools/kite.mjs [seeds=3] [--rows]   (--rows: the placeholder arenas instead of plates)
// Brawls and sneak openings are left out: keeping out of a brawl is a fair answer, and a sneak
// opening is decided before anyone kites. design/COMBAT-WORLD.md reads these numbers.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGame } from "../../game.mjs";
import { installCombat } from "../encounter.mjs";
import { createPilot } from "./pilot.mjs";
import { loadPlateArena, PLATE_OF } from "../data/plates.mjs";

const CONTENT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "content");
const read = (d, f) => ({ file: `${d}/${f}`, text: readFileSync(join(CONTENT, d, f), "utf8") });
const all = (d) => readdirSync(join(CONTENT, d)).filter((f) => f.endsWith(".lwd") && !/^act\d\.lwd$/.test(f)).map((f) => read(d, f));
export const ACTS = { act1: () => [read("act1", "combat.lwd"), read("act1", "encounters1.lwd")], act2: () => [read("act1", "combat.lwd"), ...all("act2")] };
export { STYLES } from "../data/styles.mjs";
import { STYLES } from "../data/styles.mjs";

const plateCache = {};
async function plateFor(area) {
  if (area in plateCache) return plateCache[area];
  const plate = PLATE_OF[area] || area, place = join(CONTENT, plate, "place.json");
  plateCache[area] = existsSync(place) ? await loadPlateArena(CONTENT, plate, { fightId: area }) : null;
  return plateCache[area];
}

export async function runPolicy(style, policy, { seeds = 3, rows = false, acts = Object.keys(ACTS) } = {}) {
  const r = { fights: 0, won: 0, down: 0, timeout: 0, timeWon: 0, fled: 0, sec: 0, lost: 0, per: {} };
  for (const act of acts) {
    const defs = installCombat(createGame({ sources: ACTS[act](), seed: 1 })).defs;
    const ids = Object.keys(defs).filter((id) => !id.includes(".sneak") && defs[id].foes.length);
    for (const id of ids) for (let s = 1; s <= seeds; s++) {
      const G = createGame({ sources: ACTS[act](), seed: s }), C = installCombat(G);
      const A = rows ? null : await plateFor(defs[id].area);
      if (A) C.usePlate(defs[id].area, A);
      const W = C.start(id, { lamb: STYLES[style] }), pilot = createPilot(policy === "fair" ? {} : { style: "kite", kite: policy === "kite" ? null : policy });
      for (let i = 0; i < 60 * 125 && !W.result; i++) C.step(pilot(W));
      const o = W.result ? W.result.outcome : "none", L = W.lamb(), won = o === "win" || o === "yield";
      r.fights++; r.sec += W.tick / 60; r.lost += (L.hpMax - L.hp) / L.hpMax;
      if (won) r.won++;
      if (o === "down" || o === "lose") r.down++;
      if (W.result && W.result.reason === "time") { r.timeout++; if (won) r.timeWon++; }
      if (o === "fled" && W.result.reason === "exit") r.fled++;
      const p = (r.per[id] ||= { won: 0, n: 0, sec: 0 }); p.n++; p.sec += W.tick / 60; if (won) p.won++;
    }
  }
  const f = (x) => +(x / r.fights).toFixed(2);
  return { fights: r.fights, won: r.won, down: r.down, fled: r.fled, timeout: r.timeout, wonAtTime: r.timeWon, meanSeconds: +(r.sec / r.fights).toFixed(1), standingLost: f(r.lost), per: r.per };
}

// The kiting variants searched for the strongest kiter (an honest test needs the best kiter, not a
// strawman): ring kept, frames between pokes, and whether it also meets an approach.
export const VARIANTS = [];
for (const ring of [2.6, 3.4, 4.5]) for (const after of [25, 50]) for (const approach of [false, true]) VARIANTS.push({ ring, after, approach });
const score = (r) => r.won * 10 - r.down * 5 - r.standingLost * 10 - r.meanSeconds / 20;

// The strongest kiter for a style: every variant, best by wins, then fewest downs and least lost.
export async function bestKite(style, opts) {
  let best = null;
  for (const v of VARIANTS) { const r = await runPolicy(style, v, opts); if (!best || score(r) > score(best.r)) best = { v, r }; }
  return best;
}

if (process.argv[1] && process.argv[1].endsWith("kite.mjs") && process.argv.includes("--search")) {
  const seeds = +(process.argv.find((a) => /^\d+$/.test(a)) || 2), rows = process.argv.includes("--rows");
  for (const style of Object.keys(STYLES)) {
    const { per, ...fair } = await runPolicy(style, "fair", { seeds, rows }), b = await bestKite(style, { seeds, rows }), { per: p2, ...kite } = b.r;
    console.log(style.padEnd(7), "fair", JSON.stringify(fair)); console.log(style.padEnd(7), "best kite", JSON.stringify(b.v), JSON.stringify(kite));
  }
} else if (process.argv[1] && process.argv[1].endsWith("kite.mjs")) {
  const seeds = +(process.argv.find((a) => /^\d+$/.test(a)) || 3), rows = process.argv.includes("--rows"), detail = process.argv.includes("--detail");
  for (const style of Object.keys(STYLES)) for (const policy of ["fair", "kite"]) {
    const { per, ...sum } = await runPolicy(style, policy, { seeds, rows });
    console.log(style.padEnd(7), policy.padEnd(5), JSON.stringify(sum));
    if (detail) for (const [id, p] of Object.entries(per)) console.log("   ", id.padEnd(22), `${p.won}/${p.n}`, (p.sec / p.n).toFixed(1));
  }
}
