// The inner bosses as fights (design/COMBAT-SPEC.md 5.2 and 12; the author, 2026-10-23): for every boss and the
// Adversary's three movements, a skilled scripted player (combat/tools/pilot.mjs, which reads tells, catches,
// rolls and punishes) and an unskilled one (tools/innerbots.mjs mashBot: walks in and swings, never defends) fight
// it to its end over several seeds. Measured per boss:
//   ttk      seconds to bring it down, for the skilled player's wins (median)
//   race     the damage each side deals a second over the fight (the player's, the boss's): the DPS race
//   deaths   the share of attempts that end with the player down (skilled, unskilled)
//   tells    every move's telegraph lead against T9 (18 parryable, 30 unparryable or unblockable, 36 signature) and
//            every hazard's lead against 30; any short one fails
//   kit      the moveset's grammar: 6 to 10 attacks, 2 or 3 phases, a string, a mixup, a held (delayed) blow, a grab,
//            an unparryable blow, a signature, a rest after each string, and an arena that acts (a hazard or a
//            ground change)
// Targets (checked by combat/tests/innerduel.test.mjs): skilled deaths 0.5 or less, unskilled 0.7 or more, skilled
// ttk 60 to 180 s. Deterministic; a test driver, not the enemy AI.
//   node combat/tools/innerduel.mjs [--seeds 8] [--only fond,barn] [--json out.json]
import { makeG } from "../tests/helpers.mjs";
import { FLAWS, HOST } from "../data/flaws.mjs";
import { createInnerWorld } from "../arena/innerworld.mjs";
import { createHostWorld } from "../arena/hostworld.mjs";
import { forceBot, mashBot } from "./innerbots.mjs";
import { leadOf, needOf } from "../data/innermoves.mjs";
import { HAZ } from "../arena/innerhaz.mjs";

export const LEVELS = { grip: 5, ballast: 5, coat: 5, knees: 5, pen: 4, nose: 4 };
export const TARGET = { skilledDeaths: 0.5, unskilledDeaths: 0.7, ttk: [60, 180] };
const LIMIT = 60 * 300;

// the bosses to measure: the twelve and the lesser, then the Adversary's three movements
export function bosses() {
  const out = Object.values(FLAWS).map((f) => ({ id: f.id, flaw: f, phases: f.phases, moves: f.specials }));
  HOST.movements.forEach((M, i) => out.push({ id: `host:${M.id}`, host: i, phases: M.phases, moves: HOST.specials }));
  return out;
}

export function fight(b, seed, bot) {
  const G = makeG();
  const W = b.host != null ? createHostWorld({ G, movement: b.host, limbs: b.host === 1 ? ["prudence", "friday"] : [], seed, levels: LEVELS }) : createInnerWorld({ G, flaw: b.flaw, seed, levels: LEVELS });
  const play = bot === "skilled" ? forceBot() : mashBot(); let dealt = 0, taken = 0, i = 0;
  for (; i < LIMIT && !W.result; i++) for (const e of W.step({ lamb: play(W) })) {
    if (e.type === "hit" && e.by === "lamb" && e.id.startsWith("boss")) dealt += e.dmg;
    if (e.type === "hit" && e.id === "lamb") taken += e.dmg;
  }
  const out = W.result ? W.result.outcome : "running";
  return { outcome: out, s: i / 60, dealt, taken, down: out === "down" || out === "lose" };
}

// the moveset's grammar, from its data
export function kit(b) {
  const atk = Object.entries(b.moves).filter(([id, m]) => !/roar|dazed/.test(id) && m.kind !== "parry" && ((m.hits || []).length || m.hazard));
  const used = new Set(b.phases.flatMap((p) => [...(p.attacks || []).flatMap(walk), ...(p.signature ? [p.signature.move] : []), ...(p.counter ? [p.counter.move, p.counter.then] : []), ...(p.opening || [])]));
  const mine = atk.filter(([id]) => used.has(id));
  const strings = b.phases.flatMap((p) => (p.attacks || []).filter((a) => a.then && a.then.some((o) => o.move)));
  return {
    attacks: mine.length, phases: b.phases.length,
    string: strings.length > 0, mixup: strings.some((a) => a.then.filter((o) => o.move).length >= 2 || a.then.some((o) => !o.move)),
    late: mine.some(([, m]) => m.late), grab: mine.some(([, m]) => m.blockable === false && m.knockdown), unparryable: mine.some(([, m]) => m.parryable === false),
    signature: b.phases.some((p) => p.signature), rests: b.phases.every((p) => p.rest > 0),
    arena: b.phases.some((p) => (p.hazards || []).length || p.ground || (p.morph && (p.morph.bowl || p.morph.frost))) || mine.some(([, m]) => m.hazard),
  };
}
const walk = (a) => [a.move, ...(a.then || []).flatMap((o) => (o.move ? walk(o) : []))];

// every tell against T9; every hazard's lead against HAZ.minLead
export function tells(b) {
  const short = [];
  for (const [id, m] of Object.entries(b.moves)) {
    if (m.tell) { const l = leadOf(m), n = needOf(m); if (l < n) short.push(`${id} ${l} < ${n}`); }
    if (m.hazard && (m.hazard.lead || 36) < HAZ.minLead) short.push(`${id} hazard ${m.hazard.lead} < ${HAZ.minLead}`);
  }
  for (const p of b.phases) for (const h of p.hazards || []) if ((h.lead || 36) < HAZ.minLead) short.push(`${p.name} ${h.id} ${h.lead} < ${HAZ.minLead}`);
  return short;
}

const med = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
export function measure(b, seeds) {
  const sk = seeds.map((s) => fight(b, s, "skilled")), un = seeds.map((s) => fight(b, s, "unskilled"));
  const rate = (xs, k) => +(xs.reduce((a, x) => a + x[k], 0) / Math.max(1, xs.reduce((a, x) => a + x.s, 0))).toFixed(2);
  return {
    id: b.id, ttk: med(sk.filter((x) => !x.down && x.outcome !== "running").map((x) => x.s)),
    race: { skilled: [rate(sk, "dealt"), rate(sk, "taken")], unskilled: [rate(un, "dealt"), rate(un, "taken")] },
    deaths: { skilled: +(sk.filter((x) => x.down).length / sk.length).toFixed(2), unskilled: +(un.filter((x) => x.down).length / un.length).toFixed(2) },
    timeouts: sk.filter((x) => x.outcome === "running").length + un.filter((x) => x.outcome === "running").length,
    kit: kit(b), short: tells(b),
    runs: { skilled: sk.map((x) => ({ outcome: x.outcome, s: +x.s.toFixed(2) })), unskilled: un.map((x) => ({ outcome: x.outcome, s: +x.s.toFixed(2) })) },
  };
}

if ((process.argv[1] || "").endsWith("innerduel.mjs")) {
  const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
  const n = +arg("seeds", 8), seeds = Array.from({ length: n }, (_, i) => i + 1), only = arg("only", null), rows = [];
  for (const b of bosses()) {
    if (only && !only.split(",").includes(b.id)) continue;
    const r = measure(b, seeds); rows.push(r);
    const k = r.kit, miss = Object.entries(k).filter(([key, v]) => v === false).map(([key]) => key);
    console.log(`${r.id.padEnd(15)} ttk ${r.ttk == null ? "  -" : String(Math.round(r.ttk)).padStart(3)}s  race ${r.race.skilled.join("/")} (unskilled ${r.race.unskilled.join("/")})  deaths skilled ${r.deaths.skilled} unskilled ${r.deaths.unskilled}  attacks ${k.attacks} phases ${k.phases}${miss.length ? `  MISSING ${miss.join(",")}` : ""}${r.short.length ? `  SHORT ${r.short.join("; ")}` : ""}${r.timeouts ? `  timeouts ${r.timeouts}` : ""}`);
  }
  const out = arg("json", null); if (out) (await import("node:fs")).writeFileSync(out, JSON.stringify(rows, null, 1));
}
