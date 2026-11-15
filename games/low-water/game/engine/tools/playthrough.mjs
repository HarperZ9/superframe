#!/usr/bin/env node
// Plays the whole game end to end, unattended: Act 1, then Act 2 (its daylight page, then Night
// 2), then Act 3 (the second daylight page, then the gale), carrying the state between acts.
//   node tools/playthrough.mjs [--build fist|fistmax|tongue|shadow|hands|eye|all] [--random N] [--seed S]
//        [--shuffle K] [--attentive] [--gates] [--acts a1.lwd,a2.lwd,a3.lwd] [--max 8000] [--json out.json] [--trace] [--places] [--prior fact,fact] [--world dir]
// --attentive layers the attentive player (tools/policy.mjs attentive()) on builds and random runs.
// A build chooses by intent at every gate (tools/policy.mjs: verb tags, check voices, what the
// scenes start and set, its preferred ending), never by label words or menu order: every menu is
// shuffled by a seeded permutation before choosing, and --shuffle K plays each build K times
// under K different shuffles. Random runs choose by a seeded hash. Fights are played by the
// combat engineer's scripted player (combat/tools/pilot.mjs), with the build's own habits on top:
// Tongue takes a talk exit as soon as one is offered, Hands works the props in reach first.
// Tide Runs and sneaks walk straight for their goal (a sneak crouched). When a conversation exits, play goes back to the last menu (as the shell's district
// menus do), or waits ten minutes when there is none.
// A run passes when it reaches the final end with a verdict sent, a Mother fate and a Lamb fate.
// Report: per run, whether it finished, where it stalled, dead ends, events that never fired,
// flags read but never set on that path, and the endings reached.
import { readFile, writeFile } from "node:fs/promises";
import { writeFileSync as require_write } from "node:fs";
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";
import { carryState } from "../game.mjs";
import { createPilot } from "../combat/tools/pilot.mjs";
import { BUILDS, ROUTES, baseOf, applyMax, score, strainFor, upkeep, endingFlags, intentOf, goalDist } from "./use-policy.mjs";
import { hashStr } from "../core/rng.mjs";
import { STORY, LEDGER } from "./use-story.mjs";
import { createWorldRecord, installWorldRecord } from "../save/worldrecord.mjs";
import { fileStorage } from "./worldfile.mjs";
import { actFiles } from "./acts.mjs";
import { evaluate } from "../core/expr.mjs";
import { installTracer } from "./tracer.mjs";
import { playInner } from "./innerplay.mjs";
import { FEEL } from "../combat/sim/hits.mjs";
import { BODY } from "../combat/sim/fighter.mjs";
import { PATHS, go } from "../combat/sim/paths.mjs";
import { loadPlateArena, PLATE_OF } from "../combat/data/plates.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const ROOT = new URL("../../../content/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const ACTS = (opt.acts ? opt.acts.split(",") : STORY.acts || actFiles(ROOT).map((f) => ROOT + f)); // the story's own acts, or every act on disk (tools/acts.mjs)
// --ablate a,b: switch combat changes back to how they were before 2026-10-21, to find which one moved an outcome
// (hitstop: the authored freezes; edge: no body-edge rule; paths: no narrow-gap bar, wall cost or wide line test)
for (const a of String(opt.ablate || "").split(",").filter(Boolean)) {
  if (a === "hitstop") { FEEL.hitstop.light = 4; FEEL.hitstop.heavy = 6; FEEL.crowdCap = 99; }
  else if (a === "edge") BODY.edge = 0;
  else if (a === "paths") { PATHS.narrow = false; PATHS.hug = 0; PATHS.wide = 0; }
  else { console.error(`--ablate: unknown ${a}`); process.exit(2); }
}
// Fights on the painted ground, as the shell plays them (ui/playlive.mjs usePlateFor): each encounter
// area's plate arena, read once (--rows plays the old flat row arenas instead)
const PLATES = {};
if (!opt.rows) for (const area of Object.keys(PLATE_OF)) { try { PLATES[area] = await loadPlateArena(ROOT.replace(/\/$/, ""), PLATE_OF[area], { fightId: area }); } catch (e) { /* no plate baked for this area: the row arena stays */ } }
// --beatlog file: every beat shown, with its clock and the tide (tools/tidelint.mjs reads it)
const BEATLOG = opt.beatlog ? { file: opt.beatlog, rows: [], last: null } : null;
process.on("exit", () => { if (BEATLOG) { try { require_write(BEATLOG.file, BEATLOG.rows.map((r) => JSON.stringify(r)).join(String.fromCharCode(10))); } catch (e) { console.error(`beatlog: ${e.message}`); } } });
const MAX = +(opt.max || 8000);

const contents = [];
// --gates: also load each act's sibling gatesN.lwd (the drafted gate records) when the act root
// does not include it yet.
for (const [i, root] of ACTS.entries()) {
  const { sources } = await loadAct(root, (p) => readFile(p, "utf8"));
  const g = root.replace(/[^/\\]*$/, `gates${i + 1}.lwd`);
  if (opt.gates && !sources.some((x) => x.file.endsWith(`gates${i + 1}.lwd`))) { try { sources.push({ file: g, text: await readFile(g, "utf8") }); } catch (e) { console.error(`--gates: no ${g}: ${e.message}`); } }
  contents.push(loadContent(sources));
}
let MENU_HOOK = null; // --liegrid snapshots a route's state at each scene's menu
const ENDS = Object.assign({}, ...contents.map(endingFlags)); // the flags each ending value needs
// A seeded permutation of a menu, so menu order can play no part in a choice.
const shuffle = (list, seed, step) => list.map((o) => ({ o, k: hashStr(`${o.key}|${step}`, seed ^ 0x2545f491) })).sort((a, b) => a.k - b.k).map((x) => x.o);

// One whole game for a build (or a random seed).
function playGame({ build = null, seed = 1, shuffleSeed = seed }) {
  const R = { build: (build || `random:${seed}`) + (opt.attentive ? " attentive" : ""), shuffleSeed, finished: false, acts: [], stall: null, deadEnds: [], reads: new Set(), sets: new Set(), fights: [], runs: [], sneaks: [], gates: [], errors: [], steps: 0 };
  let state = null;
  for (let a = 0; a < contents.length; a++) {
    const C = contents[a], G = createFullGame({ content: C, seed, state });
    if (!state) G.create({ archetype: build ? BUILDS[baseOf(build)].precedent : randomSheet(G, seed), enter: false });
    if (build) applyMax(G, build);
    if (opt.prior && !state && G.lore) G.lore.seedPrior(String(opt.prior).split(",")); // facts an earlier run left (tools/lorecheck.mjs; the world record)
    if (opt.world && !state) installWorldRecord(G, createWorldRecord(fileStorage(String(opt.world)), STORY.name || "story"), { story: STORY.name || "story", worldfacts: (C.story || {}).worldfacts || {} }); // the world record in a folder (tools/worldcheck.mjs)
    if (opt.world && !state) R.prior = { facts: [...(G.state.prior || [])], line: G.state.vars.prior_line || "", runs: +G.state.vars.prior_runs || 0 }; // what this run started from
    const sd = ROUTES[build] && ROUTES[build].seed && ROUTES[build].seed[a + 1]; // a seeded route's opening state (tools/policy.mjs ROUTES)
    if (sd) { Object.assign(G.state.vars, sd.vars || {}); for (const f of sd.flags || []) if (!G.state.flags.includes(f)) G.state.flags.push(f); R.seeded = [...(R.seeded || []), a + 1]; }
    watch(G, R);
    const tracer = opt.tracefile ? installTracer(G, { seed, policy: build || `random:${seed}`, until: typeof opt.until === "string" ? opt.until : null }) : null; // --tracefile f [--until e1.]: tools/tracer.mjs
    if (tracer) tracer.begin();
    const act = { act: a + 1, start: C.book.meta.start, end: null, clock: null, unfired: [], choices: 0 };
    R.acts.push(act);
    try { act.end = playAct(G, C, R, act, { build, seed, shuffleSeed }); }
    catch (e) { R.errors.push(`act ${a + 1}: ${e.message} @ ${(e.stack || "").split("\n").slice(1, 3).map((x) => x.trim()).join(" < ")}`); R.stall = R.stall || { act: a + 1, node: G.activeTalk && G.activeTalk.node, why: e.message }; }
    if (tracer) require_write(opt.tracefile, tracer.finish());
    act.pages = G.state.sheet.xp; act.top = Math.max(...Object.keys(G.rs.attrs).map((k) => G.sheet.attrBase(k))); act.steps = R.steps; act.gatePages = Object.keys(G.state.gates || {}).length; // cumulative at the act's end
    act.clock = clock(G); act.unfired = C.book.events.filter((e) => !G.state.fired.includes(e.id)).map((e) => e.id);
    R.learned = G.state.flags.filter((f) => /\.move_\w+$/.test(f)); R.weapon = (G.inv.worn() || {}).hand || "w.case";
    if (!act.end) break;
    if (a === contents.length - 1) {
      Object.assign(R, STORY.end(G, act)); // the story's own reading of its ending (tools/story.mjs)
      if (R.finished == null) R.finished = !!act.end; // a story that says nothing: reaching the last act's end
    }
    state = carryState(G.state); // each act has its own events
  }
  R.readNeverSet = [...R.reads].filter((f) => !R.sets.has(f)).sort();
  return R;
}

function watch(G, R) {
  for (const f of G.state.flags) R.sets.add(f);
  G.on("flag", (e) => { if (e.on) R.sets.add(e.id); });
  if (STORY.watch) STORY.watch(G, R, { clock: () => clock(G) });
  const call = G.scope.call.bind(G.scope);
  G.scope.call = (name, args, S) => { if (name === "has" && args[0] && args[0].k === "id") R.reads.add(args[0].name); return call(name, args, S); };
  // the first compartment at 8 and at 10 (SYSTEMS-FULL 19.4 pace): act, clock, and how far into the act
  G.on("interrog.finish", (e) => (R.interrogs ||= []).push({ act: R.acts.length, id: e.id, out: e.out ? e.out.kind : "?" }));
  // the reckoning's ledger per run (rules/reckoning.mjs, DIRECTOR.md pillar 4: what Lamb professes against
  // what Lamb does), so the living-a-lie system can be tested on every route: professions (convictions inked,
  // promises said), actions (drift moves on the lean axes, lies told, promises broken), every gap with its
  // cause, and the run's closing gap, owned and denied
  const K = (R.reckoning ||= { professed: [], acted: [], gaps: [], end: null });
  const at = () => ({ act: R.acts.length, clock: clock(G), node: G.activeTalk ? G.activeTalk.node : null });
  G.on("flag", (e) => {
    if (!e.on) return;
    if (LEDGER.professed.test(e.id)) K.professed.push({ ...at(), what: e.id });
    else if (LEDGER.acted.test(e.id)) K.acted.push({ ...at(), what: e.id });
  });
  const lean0 = {};
  G.on("var", (e) => {
    const n = String(e.name).replace(/^var\./, "");
    if (LEDGER.moves.test(n)) { const d = (+e.value || 0) - (lean0[n] ?? 0); lean0[n] = +e.value || 0; if (d) K.acted.push({ ...at(), what: `${n} ${d > 0 ? "+" : ""}${d}` }); }
    if (LEDGER.totals.includes(n)) K.end = Object.fromEntries(LEDGER.totals.map((t) => [t, +G.scope.get(`var.${t}`) || 0]));
  });
  G.on("reckoning.gap", (e) => K.gaps.push({ ...at(), n: e.n, flag: e.flag, why: e.why }));
  G.on("attr.raised", (e) => { for (const k of [8, 10]) if (e.value >= k && !(R.reach || {})[k]) (R.reach ||= {})[k] = { attr: e.id, act: R.acts.length, clock: clock(G), step: R.steps }; });
}
const clock = (G) => { const c = G.clock(); return `${String(Math.floor(c / 60) % 24).padStart(2, "0")}:${String(Math.floor(c % 60)).padStart(2, "0")}`; };

// the beat log also keeps a row for each fight, run and sneak (tools/pacing.mjs reads them; the lints skip empty text)
const logEvent = (G, act, kind, rec) => { if (!BEATLOG) return; const c = G.clock(), tf = G.env.tideAt ? G.env.tideAt : null; BEATLOG.rows.push({ build: rec.build, act: act.act, node: `${kind}:${rec.id}`, kind, place: G.state.place, clock: c, tide: tf ? +tf(c).toFixed(2) : +G.env.term("tide") || 0, rising: null, text: "", nar: "", narAt: [], secs: rec.secs ?? null, outcome: rec.outcome }); };

// One act: returns its end id, or null when it stalls.
function playAct(G, C, R, act, { build, seed, shuffleSeed }) {
  let t = G.talk(C.book.meta.start), hub = null, still = 0, lastClock = G.clock();
  const clk = opt.clockcheck ? clockCheck(G, () => t, R, act) : null;
  for (let step = 0; step < MAX; step++, R.steps++) {
    const b = t.beat;
    // the beat log: every beat shown, each once (2026-10-21: it kept one per scene, and undercounted text)
    if (BEATLOG && b && b.lines && b.lines.length && b !== BEATLOG.last) { BEATLOG.last = b; const c = G.clock(), tf = G.env.tideAt ? G.env.tideAt : null; BEATLOG.rows.push({ build: build || "random", act: act.act, node: t.node, place: G.state.place, clock: c, tide: tf ? +tf(c).toFixed(2) : +G.env.term("tide") || 0, rising: tf ? tf(c + 5) > tf(c) : null, text: b.lines.map((l) => l.text).join(" "), nar: b.lines.filter((l) => l.kind === "nar").map((l) => l.text).join(" "), narAt: b.lines.filter((l) => l.kind === "nar").map((l) => [l.at ?? c, l.text]), voices: b.lines.filter((l) => l.kind === "voice").length, checks: (b.options || []).filter((o) => o.check).length, opts: (b.options || []).length }); }
    if (t.hub) hub = t.hub;
    if (b.end) return b.end;
    if (b.run) { const x = walkRun(G, b.run); R.runs.push(x); logEvent(G, act, "run", { ...x, build: build || "random" }); t.afterRun(); continue; }
    if (b.sneak) { const x = walkSneak(G, b.sneak); R.sneaks.push(x); logEvent(G, act, "sneak", { ...x, build: build || "random" }); t.afterSneak(); continue; }
    if (b.fight) { const x = { ...fight(G, b.fight, /_down$/.test(String(build)) ? build : baseOf(build)), act: act.act }; R.fights.push(x); logEvent(G, act, "fight", { ...x, build: build || "random" }); t.afterFight(); continue; }
    // an inner fight from the story's hinge (combat/innerhook.mjs): played headless by the build's habit (tools/innerplay.mjs)
    if (b.inner) { const habit = (BUILDS[baseOf(build)] || {}).habit || "tongue", x = playInner(b.inner, { habit, seed }); (R.inner ||= []).push({ id: b.inner.id, act: act.act, secs: +x.secs.toFixed(1), ends: x.ends, verbs: x.records.filter((r) => r.type === "inner.outcome" && !r.ring).map((r) => r.verb) }); logEvent(G, act, "inner", { id: b.inner.id, build: build || "random" }); t.afterInner(b.inner, x.records); continue; }
    if (b.interrogation) { // a live exchange: a few real seconds pass between presses (lies are said, heat cools)
      const nb = interrogTurn(G, t, build, R, act); if (nb === "chose") continue;
      if (nb) continue;
    }
    if (b.options && b.options.length) {
      if (MENU_HOOK) MENU_HOOK(G, t, act, R);
      if (opt.places) { const pl = G.state.place || "(none)"; (R.places ||= {})[pl] = (R.places[pl] || 0) + 1; }   // --places: where each menu was shown (for the shell's area wiring)
      if (build) upkeep(G, build, { attend: !!opt.attentive });
      else if (opt.attentive) for (const p of G.settlement.list()) if (p.next && !p.why) G.settlement.contribute(p.id);
      const menu = shuffle(b.options, shuffleSeed, step);
      const scored = menu.map((o) => ({ o, s: score(G, build || "eye", o, { seed, random: !build, ends: ENDS, attend: !!opt.attentive, menu }) })).filter((x) => x.s > -Infinity).sort((x, y) => y.s - x.s);
      if (!scored.length) { R.stall = { act: act.act, node: t.node, clock: clock(G), why: "every option is locked" }; return null; }
      // a route's appointment: be at a scene inside its hour (tools/policy.mjs ROUTES be:), travelling
      // there by the script's own options and waiting as a player waits ("Let the night move on")
      const ap = appointment(G, build, act.act);
      if (ap) {
        const D = goalDist(G, `node:${ap.at}`), dist = (x) => Math.min(...[x.o.s.target, x.o.s.fail].filter(Boolean).map((id) => D[id] ?? 99));
        const best = scored.filter((x) => dist(x) < 99).sort((x, y) => dist(x) - dist(y) || y.s - x.s)[0];
        if (best && dist(best) <= 1 && G.clock() + 10 <= ap.from) { G.advance(10); act.waits = (act.waits || 0) + 10; const n = G.nextScene(); t = G.talk(n ? n.node : t.node); continue; }
        if (best) { scored.splice(scored.indexOf(best), 1); scored.unshift(best); }
      }
      const o = scored[0].o; act.choices++;
      // a gate: a choice between options that do different things; record what was taken
      const kinds = (x) => [...intentOf(G, x)].filter((k) => !k.startsWith("sets:") && !k.startsWith("assign:")).concat(x.check ? [`check:${(G.rs.skills[x.check.skill] || {}).attr || x.check.skill}`] : []).sort().join(" ");
      if (new Set(scored.map((x) => kinds(x.o))).size > 1) R.gates.push({ act: act.act, node: t.node, took: o.label, route: kinds(o) || "plain" });
      if (opt.trace) console.log(`${clock(G)} ${t.node}: ${o.label}${opt.trace === "scores" ? `   [${scored.slice(0, 4).map((x) => `${x.o.label.slice(0, 28)} ${x.s.toFixed(1)}`).join(" | ")}]` : ""}`);
      if (clk) clk.before(t.node, o.label);
      t.choose(o.index, { strain: build ? strainFor(G, build, o) : 0 });
      if (clk) clk.after();
    } else {
      if (opt.trace) console.log(`${clock(G)} ${t.node}: [no options: ${Object.keys(b).filter((k) => b[k] && k !== "lines").join(", ")}] hub ${hub}`);
      if (b.deadEnd) R.deadEnds.push({ act: act.act, node: b.deadEnd, clock: clock(G) });
      const s = G.nextScene();
      if (s) t = G.talk(s.node);
      else if (hub && G.book.nodes[hub]) t = G.talk(hub);
      else { G.advance(10); const n = G.nextScene(); if (n) t = G.talk(n.node); else continue; }
    }
    if (G.clock() === lastClock) { if (++still > 400) { R.stall = { act: act.act, node: t.node, clock: clock(G), why: "400 choices without the clock moving (a loop)" }; return null; } }
    else { still = 0; lastClock = G.clock(); }
  }
  R.stall = { act: act.act, node: t.node, clock: clock(G), why: `no end after ${MAX} steps` };
  return null;
}

// One turn of an interrogation for the harness: three real seconds of the loop (G.loop.step at 60
// Hz), an outcome the clock reached plays, and an open lie is called when Lamb holds its fact (the
// attentive player and the Eye always listen; others call it half the time, by seeded hash).
function interrogTurn(G, t, build, R, act) {
  for (let i = 0; i < 180 && G.interrog.current && !G.interrog.outcome(); i++) G.loop.step();
  if (G.interrog.current && G.interrog.outcome()) { t.interrogResolve(); return "chose"; }
  const l = G.interrog.openLie(), b = t.beat;
  if (t.interrogRefresh) t.interrogRefresh();
  const b2 = Object.assign(b, t.beat); // the act loop holds b: keep it current
  if (l && G.interrog.canCatch(l) && (baseOf(build) === "eye" || opt.attentive || hashStr(l.id, R.shuffleSeed) % 2 === 0)) {
    const i = b2.options.findIndex((o) => o.lie); if (i >= 0) { t.choose(i); R.liesCaught = (R.liesCaught || 0) + 1; return "chose"; }
  }
  // never the lie call by chance: only with a lie open and the fact held (above)
  b2.options = b2.options.filter((o) => !o.lie);
  return null;
}

function walkRun(G, id) {
  const r = G.runs.start(id, { mode: "stepped" }), g = r.state.def.goal;
  for (let i = 0; i < 4000 && !r.state.done; i++) { const v = r.view(); r.stepMove(v.goal.x - r.state.x, v.goal.z - r.state.z); }
  return { id, outcome: r.state.outcome || "unfinished", reason: r.state.reason };
}
function walkSneak(G, id) {
  const s = G.sneaks.start(id, { mode: "stepped" }), g = s.state.def.goal;
  for (let i = 0; i < 4000 && !s.state.done; i++) s.stepMove(g.x - s.state.x, g.z - s.state.z, { crouch: true });
  return { id, outcome: s.state.outcome || "unfinished" };
}
function fight(G, id, build) {
  const C = G.ext.combat, pilot = createPilot(), step = C.step;
  const habit = (BUILDS[build] && BUILDS[build].habit) || build; // a story's build may fight like one of these (tools/quota/policy.mjs)
  C.step = (inp) => step(inp || (C.current ? habits(C.current.W, pilot(C.current.W), habit) : null));
  const area = (C.defs[id] || {}).area; if (area && PLATES[area]) C.usePlate(area, PLATES[area]);
  C.start(id); G.loop.clockRate = C.clockRate || 8;
  C.current.W._wordsCanCome = wordsCanCome(G, C.defs[id]);
  let end = null; const off = G.on("fight.end", (e) => { end = e; });
  for (let i = 0; i < 60 * 600 && !end; i++) {
    G.loop.step();
    if (opt.fightdebug === id && C.current && C.current.W.tick % 60 === 0) { const W = C.current.W, L = W.lamb(); console.log(`    ${id} ${(W.tick / 60).toFixed(0)} s: Lamb ${L.x.toFixed(2)},${L.z.toFixed(2)} hp ${L.hp.toFixed(1)} ${L.act ? L.act.id : ""} way ${W._way ? W._way.map((v) => v.toFixed(1)) : "-"} talk ${W.talk ? W.talk.node : "-"} comp ${L.composure != null ? L.composure.toFixed(2) : "?"} struck ${W.struck.length} exits ${(W.field.arena.exits || []).length} speed ${(W.defs.lamb || {}).speed} load ${(W.defs.lamb || {}).load}`); }
  }
  off(); C.step = step; G.loop.clockRate = 0;
  // A fight that never ends is a finding; it is closed as down (Lamb goes down: a scene, never a
  // loss) so the night can go on and the rest of the path is still played.
  if (opt.fightlog) { const W = C.current.W, L = W.lamb(); console.log(`  fight ${id} at ${clock(G)}: ${end ? end.outcome : "no end"} after ${(W.tick / 60).toFixed(1)} s; Lamb ${L.hp.toFixed(1)} of ${L.hpMax.toFixed(1)}; foes ${W.fighters.filter((F) => F.team !== "lamb").map((F) => `${F.id} ${F.out ? "out" : F.hp.toFixed(1)}`).join(", ")}`); }
  if (!end) { C.current.W.result = { outcome: "down", reason: "harness: no end in ten minutes", tick: C.current.W.tick }; return { id, outcome: "NO END (closed as down)" }; }
  return { id, outcome: end.outcome, secs: C.current && C.current.W ? +(C.current.W.tick / 60).toFixed(1) : null };
}

// A route's appointment now due in this act: { at, from, to } (minutes), within two hours ahead of
// its hour and not yet kept (kept: the scene was entered inside the hour).
function appointment(G, build, actNo) {
  const R = ROUTES[build]; if (!R || !R.be) return null;
  for (const b of R.be) {
    if (b.act !== actNo || (b.after && !G.memory.visits(b.after))) continue; // after: a scene that must come first
    const from = toMinutes(b.from), to = toMinutes(b.to), c = G.clock(), key = `kept:${b.at}@${b.from}`;
    if (G.state.vars[key]) continue;
    if (c >= from && c <= to && G.memory.visits(b.at) > (G.state.vars[`seen0:${b.at}@${b.from}`] ?? Infinity)) { G.state.vars[key] = 1; continue; }
    if (c >= from - 120 && c <= to) { if (G.state.vars[`seen0:${b.at}@${b.from}`] == null || c < from) G.state.vars[`seen0:${b.at}@${b.from}`] = G.memory.visits(b.at); return { at: b.at, from, to }; }
  }
  return null;
}
const toMinutes = (s) => { const [h, m] = s.split(":").map(Number); return (h < 12 ? h + 24 : h) * 60 + m; };

// --clockcheck: the shell's live world, and a guard on the clock (2026-10-21, after a re-entrant
// interrupt let one choice run a day). The live world asks the conversation for an interrupt on every
// tick of the clock, as ui/playlive.mjs does; every clock movement is recorded with whether it was
// stated (a node's or an option's cost, a wait, a cut: an advance made at the top level) or came from
// inside another advance (re-entrant, never stated). A choice whose clock moved by more than its stated
// minutes plus those of interrupts that played, or any re-entrant advance outside such an interrupt, is a
// finding in R.clockFindings.
function clockCheck(G, getTalk, R, act) {
  const adv = G.advance, envAdv = G.env.advance; let depth = 0, stated = 0, nested = 0, c0 = 0, at = null;
  G.advance = (m) => { if (depth > 0) nested += +m || 0; else stated += +m || 0; depth++; try { return adv(m); } finally { depth--; } };
  G.env.advance = (m) => { if (depth === 0) stated += +m || 0; return envAdv(m); }; // a cut moves the clock without living it
  // an interrupt that plays (a due event, a full meter) is the live world working: its minutes are stated by
  // its own scene; minutes advanced inside an interrupt that played nothing, or inside a play, are not
  let played = 0;
  G.on("time", () => { const t = getTalk(); if (!(t && t.beat && t.beat.options && t.interrupt)) return; const inPlay = t.isPlaying && t.isPlaying(), n0 = nested; if (t.interrupt() && !inPlay) played += nested - n0; });
  R.clockFindings ||= [];
  return {
    before(node, label) { stated = 0; nested = 0; played = 0; c0 = G.clock(); at = { node, label }; },
    after() {
      const moved = G.clock() - c0;
      if (nested - played > 0.01 || moved > stated + played + 0.01) R.clockFindings.push({ act: act.act, ...at, moved, stated, played, nested });
    },
  };
}

// The build's own habits on top of the scripted fighter: Tongue says the offered words at once;
// Hands walks to the nearest prop it can work (a lit lamp, a closed sluice) and works it first.
// Whether any of a fight's talk exits could open for this Lamb: each condition read with the fight's own
// numbers at their kindest (late enough, nobody struck, Lamb standing), so what is left is what Lamb knows
// and carries. A talker with no words to come leaves at once (2026-10-21: Act 1's after-vote dark, whose
// words need a fact; Tongue without it stood with its guard up and went down).
function wordsCanCome(G, enc) {
  const v = (G.state.vars ||= {}), keep = {}, kind = { fight_seconds: 999, fight_struck: 0, fight_lamb_standing: 99, fight_foes_standing: 0, fight_foes_down: 9, fight_foes_yielding: 9 };
  for (const k of Object.keys(kind)) { keep[k] = v[k]; v[k] = kind[k]; }
  try { return ((enc && enc.talks) || []).some((t) => { try { return !t.when || !!evaluate(t.when, G.scope); } catch (e) { return false; } }); }
  finally { for (const k of Object.keys(kind)) { if (keep[k] === undefined) delete v[k]; else v[k] = keep[k]; } }
}
function habits(W, input, build) {
  // a route that goes down (its name ends in _down, tools/quota/policy.mjs): stands where it is and takes it
  if (/_down$/.test(String(build))) return { mx: 0, mz: 0, press: [], hold: {} };
  const inp = { ...input, press: [...((input && input.press) || [])] };
  // the non-fighters' ways through (2026-10-21): Tongue and Eye take the fight's talk exit when it is
  // offered (talk it down; read the room); Shadow makes for the nearest way out and slips away
  if ((build === "tongue" || build === "eye" || build === "shadow") && W.talk) inp.press.push("talk"); // Shadow too: on the ice there is no slipping away, but anyone can call for the steward
  // and hold their hands for the first twelve seconds while no exit is offered: several exits open only
  // to a Lamb who has not struck (the station's "ask Gorm", the warrant), and a talker waits for them
  if ((build === "tongue" || build === "eye") && !W.talk && W.tick < 60 * 12) inp.press = inp.press.filter((k) => !["light", "heavy", "art", "shove"].includes(k));
  // a talk exit costs Composure, and holding the guard is what fills it (a blow blocked while Lamb has
  // not struck): a talker short of the words keeps the guard up and waits for them, rather than rolling
  const short = W.talk && W.lamb() && W.lamb().composure < (W.talk.cost ?? 2);
  if (build === "tongue" && short) return { mx: 0, mz: 0, press: [], hold: { block: true } };
  // Eye reads the room: unless the words are on offer and it has the Composure to say them, it makes
  // for the clearest way out at once, as Shadow does, and says them if they come on the way (2026-10-21:
  // an Eye waiting for words it could not pay for went down in the station and among the gulls)
  // Tongue too, when no words can come in this fight (wordsCanCome): a talker with nothing to say leaves
  if (build === "shadow" || (build === "eye" && (!W.talk || short)) || (build === "tongue" && !W.talk && !W._wordsCanCome)) {
    // the way out with the fewest people between: each exit scored by its distance and by every
    // opponent nearer to it than Lamb is; walked by the fight's own paths (combat/sim/paths.mjs go),
    // rolling when the pilot would (a slip, not a stand)
    const L = W.lamb(), ex = (W.field.arena && W.field.arena.exits) || [], foes = W.fighters.filter((F) => F.team !== "lamb" && !F.out);
    const sc = (c) => Math.hypot(c[0] - L.x, c[1] - L.z) + 4 * foes.filter((F) => Math.hypot(F.x - c[0], F.z - c[1]) < Math.hypot(L.x - c[0], L.z - c[1])).length;
    let c = L && ex.map(([x0, z0, x1, z1]) => [(x0 + x1) / 2, (z0 + z1) / 2]).sort((a, b) => sc(a) - sc(b))[0];
    if (c && W._way && sc(W._way) < sc(c) + 6) c = W._way; // keep to the way chosen unless another is much clearer (no dithering)
    W._way = c;
    if (c) {
      // in the way out, keep walking (leaving takes steering, sim/world.mjs fleeT), round inside the
      // doorway; and no rolling within three metres of it, a roll goes wherever the threat is not
      if (W.field.inExit(L.x, L.z)) { const a = W.tick * 0.15, tx = c[0] + Math.cos(a) * 0.5, tz = c[1] + Math.sin(a) * 0.5, dx = tx - L.x, dz = tz - L.z, d = Math.hypot(dx, dz) || 1; return { mx: dx / d, mz: dz / d, press: inp.press.filter((k) => k === "talk"), hold: {} }; } // on into the doorway, staying in it
      const m = go(W, L, c[0], c[1]), near = Math.hypot(c[0] - L.x, c[1] - L.z) < 3;
      return { mx: m.mx, mz: m.mz, press: inp.press.filter((k) => (!near && (k === "roll" || k === "step")) || k === "talk"), hold: {} };
    }
  }
  if (build === "hands") {
    const L = W.lamb(), usable = (p) => p.x != null && (p.kind === "lamp" ? p.on : p.kind === "sluice" ? !p.open : false);
    const p = L && (W.props || []).filter(usable).sort((a, b) => Math.hypot(a.x - L.x, a.z - L.z) - Math.hypot(b.x - L.x, b.z - L.z))[0];
    if (p && W.tick < 60 * 12) { const dx = p.x - L.x, dz = p.z - L.z, d = Math.hypot(dx, dz); if (d <= 1.3) inp.press.push("interact"); else return { mx: dx / d, mz: dz / d, press: inp.press, hold: {} }; } // mz is world z (2026-10-21: it was flipped, so Hands walked away from the prop)
  }
  return inp;
}

// ---- --interrogations (every build into every scene) and --liegrid (each build's own route state
// into each scene, calling every lie): tools/interrog-grid.mjs
if (opt.interrogations || opt.liegrid) {
  const { runMatrix, runLieGrid } = await import("./interrog-grid.mjs");
  const X = { contents, opt, ENDS, createFullGame, BUILDS, applyMax, upkeep, score, strainFor, playGame, setMenuHook: (fn) => { MENU_HOOK = fn; } };
  const rows = opt.liegrid ? await runLieGrid(X) : runMatrix(X);
  if (opt.json) await writeFile(opt.json, JSON.stringify(rows, null, 1));
  process.exit(0);
}

// ---- --window act:from-to: what is new to do in a stretch of the night (tools/window.mjs)
if (opt.window) {
  const { runWindow } = await import("./window.mjs");
  const X = { contents, opt, createFullGame, playGame, setMenuHook: (fn) => { MENU_HOOK = fn; } };
  const rows = await runWindow(X, opt.window, (opt.build && opt.build !== "all" ? opt.build : "fist,tongue,shadow,eye,hands").split(","));
  if (opt.json) await writeFile(opt.json, JSON.stringify(rows, null, 1));
  process.exit(0);
}

// ---- run and report
const builds = opt.build === "routes" ? Object.keys(ROUTES) : opt.build && opt.build !== "all" ? opt.build.split(",") : opt.random ? [] : Object.keys(BUILDS);
const runs = [];
for (const b of builds) for (let k = 0; k < +(opt.shuffle || 1); k++) runs.push(playGame({ build: b, seed: +(opt.seed || 1), shuffleSeed: 101 + k }));
for (let k = 0; k < +(opt.random || 0); k++) runs.push(playGame({ seed: +(opt.seed || 1) + k }));
for (const r of runs) {
  const won = r.fights.filter((f) => f.outcome === "win" || f.outcome === "yield" || f.outcome === "talk").length;
  console.log(`\n== ${r.build} (menu shuffle ${r.shuffleSeed}): ${r.finished ? "FINISHED" : "did not finish"} (${r.steps} steps); fights won ${won} of ${r.fights.length}`);
  console.log(`   pages by the end of each act (gates paid): ${r.acts.map((a) => `act ${a.act} ${a.pages} (${a.gatePages})`).join(", ")}`);
  const into = (x) => { if (!x) return "not reached"; const A = r.acts[x.act - 1], s0 = x.act > 1 ? r.acts[x.act - 2].steps : 0; return `${x.attr} in act ${x.act} at ${x.clock} (${Math.round((100 * (x.step - s0)) / Math.max(1, (A.steps ?? x.step) - s0))}% of its steps)`; };
  console.log(`   interrogations: ${(r.interrogs || []).map((x) => `${x.id} ${x.out}`).join(", ") || "none"}${r.liesCaught ? `; lies caught ${r.liesCaught}` : ""}`);
  console.log(`   highest compartment by the end of each act: ${r.acts.map((a) => `act ${a.act} ${a.top}`).join(", ")}; first at 8: ${into((r.reach || {})[8])}; first at 10: ${into((r.reach || {})[10])}`);
  for (const a of r.acts) console.log(`   act ${a.act}: ${a.end ? `ended ${a.end}` : "no end"} at ${a.clock}, ${a.choices} choices; events never fired: ${a.unfired.length ? a.unfired.join(", ") : "none"}`);
  for (const line of STORY.report ? STORY.report(r) : []) console.log(`   ${line}`);
  if (r.stall) console.log(`   stalled: act ${r.stall.act} at ${r.stall.node || "?"} ${r.stall.clock || ""}: ${r.stall.why}`);
  if (r.deadEnds.length) console.log(`   dead ends: ${r.deadEnds.map((d) => `${d.node} (act ${d.act}, ${d.clock})`).join(", ")}`);
  console.log(`   fights: ${r.fights.map((f) => `${f.id} ${f.outcome}`).join(", ") || "none"}; runs: ${r.runs.map((x) => `${x.id} ${x.outcome}`).join(", ") || "none"}; sneaks: ${r.sneaks.map((x) => `${x.id} ${x.outcome}`).join(", ") || "none"}`);
  console.log(`   moves learned: ${(r.learned || []).join(", ") || "none"}; weapon in hand: ${r.weapon}`);
  const tally = {}; for (const g of r.gates) for (const k of g.route.split(" ")) tally[k] = (tally[k] || 0) + 1;
  if (r.clockFindings) console.log(`   clock check: ${r.clockFindings.length} choice${r.clockFindings.length === 1 ? "" : "s"} moved the clock past their stated minutes${r.clockFindings.length ? ": " + r.clockFindings.slice(0, 3).map((f) => `act ${f.act} ${f.node} "${f.label}" moved ${f.moved} for ${f.stated} stated (${f.nested} re-entrant)`).join("; ") : ""}`);
  console.log(`   routes at ${r.gates.length} gates: ${Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ")}`);
  console.log(`   flags read but never set on this path: ${r.readNeverSet.length}${r.readNeverSet.length ? ` (${r.readNeverSet.slice(0, 12).join(", ")}${r.readNeverSet.length > 12 ? ", ..." : ""})` : ""}`);
  if (r.reckoning) { const K = r.reckoning, e = K.end || {}; console.log(`   reckoning: professed ${K.professed.length} (${[...new Set(K.professed.map((x) => x.what))].slice(0, 6).join(", ") || "none"}); acted ${K.acted.length}; gaps ${K.gaps.length} (${K.gaps.map((g) => g.flag).slice(0, 6).join(", ") || "none"}); ${Object.entries(e).map(([k, v]) => `${k} ${v}`).join(", ") || "no totals"}`); }
  const stuck = r.fights.filter((f) => /^NO END/.test(f.outcome)); if (stuck.length) console.log(`   fights that never ended: ${stuck.map((f) => f.id).join(", ")}`);
  if (r.errors.length) console.log(`   errors: ${r.errors.join(" | ")}`);
}
if (opt.json) await writeFile(opt.json, JSON.stringify(runs.map((r) => ({ ...r, reads: undefined, sets: undefined })), null, 1));

// A random run's sheet: one of Low Water's five Precedents by seed, or, for a story without them (the
// Quota: @rules creation: none), the story's start-archetype; its own choice gives the class sheet.
function randomSheet(G, seed) {
  const pool = ["p.ledger", "p.wader", "p.condoler", "p.nightclerk", "p.fitter"].filter((a) => G.rs.archetypes[a]);
  return pool.length ? pool[seed % pool.length] : G.rs.rules["start-archetype"] || Object.keys(G.rs.archetypes)[0];
}
