// One fight, for each build over seeds, on the painted ground as the shell sets it up (ui/playlive.mjs
// usePlateFor): Lamb where the player stands when the scene opens (seed 1 at the hotspot that opens it, the
// rest on a ring round it on the side the player walked in from), the opponents at the plate's fight marks
// round Lamb on ground joined to Lamb's. Routes: talk (press nothing, take the fight's words a reaction
// after they are offered), out (walk for the nearest way out by the fight's own paths) and fight (the
// scripted fighter). Prints outcome, seconds and standing left per run, and the median per build and route.
// Content: the fight id, its act, plate, area, hotspot and door come from flags, with tools/story.mjs BENCH
// as the defaults; builds from tools/policy.mjs (wader is the fist sheet played as a non-striker).
//   node tools/fightbench.mjs [--fight id --act n --plate p --area a --hot x,y,z --door x,y,z]
//     [--builds wader:talk,tongue:out,fist:fight] [--seeds 5] [--react s] [--at x,y,z] [--cold n]
//     [--talkat s] [--variant base|stagger|door] [--debug build] [--json file]
// --talkat s tries the fight's talk exit at another time, --variant stagger holds the farthest opponent
// 1.5 s, --variant door moves the nearest way out 1.5 m toward Lamb: changes tried here before they are made.
// Calibration (2026-10-21): against the browser (tools/uxfight.py) from the same start, the bench gives the
// same fight: the Gut's talk at 9 s with 3.9 standing in both. What moves the numbers is where Lamb stands
// (the opponents are placed round Lamb by the fight marks, so a start a metre over can leave one behind a
// stall) and the reaction (uxfight looks once a second, so its player answers 1 to 2 s after an offer:
// --react 1.5 matches it). The out route walks the fight's own paths; uxfight's key-steering walker is
// slower and blunders into props, so its out runs are not a measure of the exit.
// Variants are the candidate balance changes (2026-10-21), applied here only, to choose between them.
import { readFile, writeFile } from "node:fs/promises";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";
import { carryState } from "../game.mjs";
import { createPilot } from "../combat/tools/pilot.mjs";
import { BUILDS, applyMax } from "./use-policy.mjs";
import { BENCH } from "./use-story.mjs";
import { go } from "../combat/sim/paths.mjs";
import { plateArena } from "../combat/sim/plate.mjs";
import { fightFromScene, hardenGround, GROUND_CELL } from "../world/plateworld.mjs";
import { snapClear, spawnsReachable } from "../combat/sim/plate.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const ROOT = new URL("../../../content/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
// the plate as the shell reads it (place.json and its geometry)
const FIGHT = opt.fight || BENCH.fight, ACT = +(opt.act || BENCH.act), AREA = opt.area || BENCH.area;
const dir = ROOT + (opt.plate || BENCH.plate), pj = JSON.parse(await readFile(dir + "/place.json", "utf8"));
const [pb, ib] = await Promise.all([readFile(dir + "/geo-pos.f32"), readFile(dir + "/geo-id.u8")]);
const gpos = new Float32Array(pb.buffer, pb.byteOffset, pb.byteLength / 4), gids = new Uint8Array(ib.buffer, ib.byteOffset, ib.byteLength);
// where the player stands when the scene opens: within the hotspot's ring, on the side they walked
// in from (the door, the area's spawn 7 0 9.2); each seed takes its own point (--at pins one)
const HOT = (opt.hot || BENCH.hot).split(",").map(Number), DOOR = (opt.door || BENCH.door).split(",").map(Number);
const startFor = (seed) => {
  if (opt.at) return opt.at.split(",").map(Number);
  if (seed === 1) return [...HOT]; // the hotspot itself: where tools/uxfight.py stands Lamb, so seed 1 is the browser walk's fight
  const a0 = Math.atan2(DOOR[2] - HOT[2], DOOR[0] - HOT[0]), a = a0 + (seed - 3) * 0.45, r = seed === 3 ? 0.5 : 1.1;
  return [HOT[0] + Math.cos(a) * r, 0, HOT[2] + Math.sin(a) * r];
};
const REACT = 60 * +(opt.react ?? 1); // a new player's second: reading the card, finding the keys
const SEEDS = +(opt.seeds || 5), VARIANT = opt.variant || "base";
const variants = { base: {}, stagger: { stagger: 1.5 }, door: { doorNearer: 1.5 } };
const V = variants[VARIANT] || {};
const { sources } = await loadAct(ROOT + `act${ACT}/act${ACT}.lwd`, (p) => readFile(p, "utf8"));
// --talkat n: the fight's talk exit opens at n seconds (its encounter block's fight_seconds), to try a change before making it
if (opt.talkat != null) for (const s of sources) s.text = s.text.replace(new RegExp(`(@encounter ${FIGHT.replace(/\./g, "\\.")}\n(?:(?!@encounter)[^])*?talk:[^\n]*fight_seconds >= )\\d+`), `$1${opt.talkat}`);
const content = loadContent(sources);
const content1 = loadContent((await loadAct(ROOT + "act1/act1.lwd", (p) => readFile(p, "utf8"))).sources);
// the acts between the first and this one, carried through untouched (as "On to the next night" hands them on)
const between = []; for (let a = 2; a < ACT; a++) between.push(loadContent((await loadAct(ROOT + `act${a}/act${a}.lwd`, (p) => readFile(p, "utf8"))).sources));

const live = (F) => !F.out && !F.fallen && !F.yielded && F.hp > 0;
// a new player on the talk route presses nothing until the offer has shown for a second, then T
function talkRoute(W, S) {
  if (W.talk && S.seen == null) S.seen = W.tick;
  if (W.talk && W.tick - S.seen >= REACT) return { mx: 0, mz: 0, press: ["talk"], hold: {} };
  return { mx: 0, mz: 0, press: [], hold: {} };
}
// on the out route, makes for the nearest OUT after the first second
function outRoute(W) {
  if (W.tick < REACT) return {};
  const L = W.lamb(), ex = W.field.arena.exits || [];
  const c = ex.map(([x0, z0, x1, z1]) => [(x0 + x1) / 2, (z0 + z1) / 2]).sort((a, b) => Math.hypot(a[0] - L.x, a[1] - L.z) - Math.hypot(b[0] - L.x, b[1] - L.z))[0];
  if (!c) return {};
  if (W.field.inExit(L.x, L.z)) { const a = W.tick * 0.15, dx = c[0] + Math.cos(a) * 0.5 - L.x, dz = c[1] + Math.sin(a) * 0.5 - L.z, d = Math.hypot(dx, dz) || 1; return { mx: dx / d, mz: dz / d, press: [], hold: {} }; }
  const m = go(W, L, c[0], c[1]); return { mx: m.mx, mz: m.mz, press: [], hold: {} };
}

function one(build, route, seed) {
  // as the end screen's "On to the next night" hands Act 1 on (a new player's Lamb, Act 1's gear)
  const G1 = createFullGame({ content: content1, seed });
  G1.create({ archetype: BUILDS[build === "wader" ? "fist" : build].precedent, enter: false });
  if (BUILDS[build]) applyMax(G1, build);
  let st = carryState(G1.state); for (const c of between) st = carryState(createFullGame({ content: c, seed, state: st }).state);
  const G = ACT === 1 ? G1 : createFullGame({ content, seed, state: st }); // Act 1: the new game itself
  if (opt.cold) G.pressure.addMeter("cold", +opt.cold); // --cold n: the cold meter as the walk arrived with it
  const C = G.ext.combat; G.state.pos = startFor(seed);
  const S0 = fightFromScene(G, pj, FIGHT);
  const plate = plateArena(pj, gpos, gids, { datum: pj.datum || null, fight: S0.fight, cell: GROUND_CELL });
  hardenGround(plate, pj, gpos, gids, { margin: "soft" });
  plate.spawns = { lamb: snapClear(plate, plate.spawns.lamb), foes: plate.spawns.foes.map((f) => snapClear(plate, f)) };
  spawnsReachable(plate);
  C.usePlate(AREA, plate);
  const pilot = createPilot(), St = {};
  const W = C.start(FIGHT);
  const L0 = W.lamb();
  if (V.doorNearer) { // the nearest way out, moved that far toward where Lamb starts
    const i = plate.exits.map(([x0, z0, x1, z1], k) => [k, Math.hypot((x0 + x1) / 2 - L0.x, (z0 + z1) / 2 - L0.z)]).sort((a, b) => a[1] - b[1])[0][0];
    const [x0, z0, x1, z1] = plate.exits[i], cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, d = Math.hypot(cx - L0.x, cz - L0.z), ux = (L0.x - cx) / d * V.doorNearer, uz = (L0.z - cz) / d * V.doorNearer;
    plate.exits[i] = [x0 + ux, z0 + uz, x1 + ux, z1 + uz];
  }
  if (V.stagger) { const foes = W.fighters.filter((F) => F.team !== "lamb").sort((a, b) => Math.hypot(a.x - L0.x, a.z - L0.z) - Math.hypot(b.x - L0.x, b.z - L0.z)); foes[foes.length - 1].engageAt = Math.round(V.stagger * 60); }
  let end = null; G.on("fight.end", (e) => { end = e; });
  for (let i = 0; i < 60 * 120 && !W.result; i++) {
    const inp = route === "fight" ? pilot(W) : route === "talk" ? talkRoute(W, St) : outRoute(W);
    C.step(inp);
    if (opt.debug && W.tick % 60 === 0 && seed === 1 && build === opt.debug) { const L = W.lamb(); console.log(`    ${route} ${W.tick / 60} s: Lamb ${L.x.toFixed(2)},${L.z.toFixed(2)} hp ${L.hp.toFixed(1)} foes ${W.fighters.filter((F) => F.team !== "lamb").map((F) => `${F.x.toFixed(1)},${F.z.toFixed(1)}${F.aware === false ? "u" : ""}${W.visible(F, W.lamb()) ? "v" : "-"}${F.mem && F.mem.seen ? "s" : ""}`).join(" ")} exits ${JSON.stringify(W.field.arena.exits)} talk ${W.talk ? 1 : 0} speed ${W.defs.lamb.speed} load ${W.defs.lamb.load}`); }
  }
  const L = W.lamb();
  return { build, route, seed, outcome: (W.result || {}).outcome || "none", secs: +(W.tick / 60).toFixed(1), standing: +Math.max(0, L.hp).toFixed(1), of: +L.hpMax.toFixed(1), foesUp: W.fighters.filter((F) => F.team !== "lamb" && live(F)).length };
}

const rows = [];
const plan = (opt.builds || "wader:talk,wader:out,tongue:talk,tongue:out,shadow:talk,shadow:out,eye:talk,eye:out,fist:fight").split(",").map((x) => x.split(":"));
for (const [b, r] of plan) for (let s = 1; s <= SEEDS; s++) rows.push(one(b, r, s));
const med = (xs) => { const s = [...xs].sort((a, b) => a - b), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
console.log(`${FIGHT} bench, variant ${VARIANT} (${JSON.stringify(variants[VARIANT])}), ${SEEDS} seeds`);
for (const [b, r] of plan) {
  const g = rows.filter((x) => x.build === b && x.route === r), ok = (x) => ["talk", "yield", "fled", "win"].includes(x.outcome);
  const okRows = g.filter(ok);
  console.log(`  ${b.padEnd(7)} ${r.padEnd(5)} through ${okRows.length}/${g.length}; outcomes ${g.map((x) => x.outcome).join(",")}; median standing left ${med(g.map((x) => (ok(x) ? x.standing : 0)))} of ${g[0].of}; median ${med(g.map((x) => x.secs))} s`);
}
if (opt.json) await writeFile(opt.json, JSON.stringify(rows, null, 1));
