#!/usr/bin/env node
// Plays the whole game end to end, unattended: Act 1, then Act 2 (its daylight page, then Night
// 2), then Act 3 (the second daylight page, then the gale), carrying the state between acts.
//   node tools/playthrough.mjs [--build fist|fistmax|tongue|shadow|hands|eye|all] [--random N] [--seed S]
//        [--shuffle K] [--attentive] [--gates] [--acts a1.lwd,a2.lwd,a3.lwd] [--max 8000] [--json out.json] [--trace]
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
import { loadAct } from "../dialogue/book.mjs";
import { loadContent, createFullGame } from "../full.mjs";
import { createPilot } from "../combat/tools/pilot.mjs";
import { BUILDS, applyMax, score, strainFor, upkeep, endingFlags, intentOf } from "./policy.mjs";
import { hashStr } from "../core/rng.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const ROOT = new URL("../../../content/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const ACTS = (opt.acts ? opt.acts.split(",") : ["act1/act1.lwd", "act2/act2.lwd", "act3/act3.lwd"].map((f) => ROOT + f));
const MAX = +(opt.max || 8000), CARRY_DROP = ["place", "area", "pos", "pendingRun", "pendingFight", "pendingSneak", "hazards", "timers", "full", "fullQueue", "camera", "stealth", "rumourAt"];

const contents = [];
// --gates: also load each act's sibling gatesN.lwd (the drafted gate records) when the act root
// does not include it yet.
for (const [i, root] of ACTS.entries()) {
  const { sources } = await loadAct(root, (p) => readFile(p, "utf8"));
  const g = root.replace(/[^/\\]*$/, `gates${i + 1}.lwd`);
  if (opt.gates && !sources.some((x) => x.file.endsWith(`gates${i + 1}.lwd`))) { try { sources.push({ file: g, text: await readFile(g, "utf8") }); } catch (e) { console.error(`--gates: no ${g}: ${e.message}`); } }
  contents.push(loadContent(sources));
}
const ENDS = Object.assign({}, ...contents.map(endingFlags)); // the flags each ending value needs
// A seeded permutation of a menu, so menu order can play no part in a choice.
const shuffle = (list, seed, step) => list.map((o) => ({ o, k: hashStr(`${o.key}|${step}`, seed ^ 0x2545f491) })).sort((a, b) => a.k - b.k).map((x) => x.o);

// One whole game for a build (or a random seed).
function playGame({ build = null, seed = 1, shuffleSeed = seed }) {
  const R = { build: (build || `random:${seed}`) + (opt.attentive ? " attentive" : ""), shuffleSeed, finished: false, acts: [], stall: null, deadEnds: [], reads: new Set(), sets: new Set(), fights: [], runs: [], sneaks: [], gates: [], errors: [], steps: 0 };
  let state = null;
  for (let a = 0; a < contents.length; a++) {
    const C = contents[a], G = createFullGame({ content: C, seed, state });
    if (!state) G.create({ archetype: build ? BUILDS[build].precedent : ["p.ledger", "p.wader", "p.condoler", "p.nightclerk", "p.fitter"][seed % 5], enter: false });
    if (build) applyMax(G, build);
    watch(G, R);
    const act = { act: a + 1, start: C.book.meta.start, end: null, clock: null, unfired: [], choices: 0 };
    R.acts.push(act);
    try { act.end = playAct(G, C, R, act, { build, seed, shuffleSeed }); }
    catch (e) { R.errors.push(`act ${a + 1}: ${e.message} @ ${(e.stack || "").split("\n").slice(1, 3).map((x) => x.trim()).join(" < ")}`); R.stall = R.stall || { act: a + 1, node: G.activeTalk && G.activeTalk.node, why: e.message }; }
    act.pages = G.state.sheet.xp; act.top = Math.max(...Object.keys(G.rs.attrs).map((k) => G.sheet.attrBase(k))); act.steps = R.steps; act.gatePages = Object.keys(G.state.gates || {}).length; // cumulative at the act's end
    act.clock = clock(G); act.unfired = C.book.events.filter((e) => !G.state.fired.includes(e.id)).map((e) => e.id);
    R.learned = G.state.flags.filter((f) => /\.move_\w+$/.test(f)); R.weapon = (G.inv.worn() || {}).hand || "w.case";
    if (!act.end) break;
    if (a === contents.length - 1) {
      R.collier = G.flag("collier.through") ? "through" : G.flag("collier.spit") ? "spit" : "neither";
      R.collierWhy = { "mole3.mother": G.scope.get("var.mole3.mother"), "loss3.mother": G.flag("loss3.mother"), "said.day2_mother": G.flag("said.day2_mother"), "hill3.bearing": G.flag("hill3.bearing"), lampout: G.state.flags.filter((f) => /^lampout\./.test(f)), "lamp.balance.lit": G.flag("lamp.balance.lit"), "lamp.steps_post.lit": G.flag("lamp.steps_post.lit") };
      R.lamps = Object.fromEntries(["light_mother", "light_steps", "light_balance", "light_hill", "light_bulb"].map((v) => [v, +G.scope.get(`var.${v}`) || 0]));
      R.endings = { end: act.end, verdict: G.quests.stage("a3.verdict") || (G.flag("dawn3.sent") ? "sent" : ""), mother: G.scope.get("fate_mother"), lamb: G.scope.get("fate_lamb"), causes: G.state.flags.filter((f) => /^cause/.test(f)) };
      R.finished = R.endings.verdict === "sent" && !!R.endings.mother && R.endings.lamb && R.endings.lamb !== "none";
    }
    state = JSON.parse(JSON.stringify(G.state)); for (const k of CARRY_DROP) delete state[k];
    state.fired = []; // each act has its own events
  }
  R.readNeverSet = [...R.reads].filter((f) => !R.sets.has(f)).sort();
  return R;
}

// The collier rule's inputs, read the moment its outcome is set (04:05), not at the end.
function collierInputs(G) {
  const L = Object.fromEntries(["light_mother", "light_steps", "light_balance", "light_hill", "light_bulb"].map((v) => [v, +G.scope.get(`var.${v}`) || 0]));
  const out = (k) => G.flag(`lampout.${k}`);
  return { clock: clock(G), marks: {
    mother: !G.flag("loss3.mother") && (G.scope.get("var.mole3.mother") === "on" || (G.scope.get("var.mole3.mother") === "auto" && L.light_mother === 1 && !G.flag("said.day2_mother"))),
    stepsBalance: L.light_steps === 1 && !out("steps") && L.light_balance === 1 && !out("balance"),
    hillBulb: (G.flag("hill3.bearing") || L.light_hill === 1) && !out("hill") && L.light_bulb === 1 && !out("bulb"),
    lantern: G.flag("oldlight.lanterns") } };
}

function watch(G, R) {
  for (const f of G.state.flags) R.sets.add(f);
  G.on("flag", (e) => { if (e.on) R.sets.add(e.id); if (e.on && (e.id === "collier.through" || e.id === "collier.spit")) R.collierAt = collierInputs(G); });
  const call = G.scope.call.bind(G.scope);
  G.scope.call = (name, args, S) => { if (name === "has" && args[0] && args[0].k === "id") R.reads.add(args[0].name); return call(name, args, S); };
  // the first compartment at 8 and at 10 (SYSTEMS-FULL 19.4 pace): act, clock, and how far into the act
  G.on("interrog.finish", (e) => (R.interrogs ||= []).push({ act: R.acts.length, id: e.id, out: e.out ? e.out.kind : "?" }));
  G.on("attr.raised", (e) => { for (const k of [8, 10]) if (e.value >= k && !(R.reach || {})[k]) (R.reach ||= {})[k] = { attr: e.id, act: R.acts.length, clock: clock(G), step: R.steps }; });
}
const clock = (G) => { const c = G.clock(); return `${String(Math.floor(c / 60) % 24).padStart(2, "0")}:${String(Math.floor(c % 60)).padStart(2, "0")}`; };

// One act: returns its end id, or null when it stalls.
function playAct(G, C, R, act, { build, seed, shuffleSeed }) {
  let t = G.talk(C.book.meta.start), hub = null, still = 0, lastClock = G.clock();
  for (let step = 0; step < MAX; step++, R.steps++) {
    const b = t.beat;
    if (t.hub) hub = t.hub;
    if (b.end) return b.end;
    if (b.run) { R.runs.push(walkRun(G, b.run)); t.afterRun(); continue; }
    if (b.sneak) { R.sneaks.push(walkSneak(G, b.sneak)); t.afterSneak(); continue; }
    if (b.fight) { R.fights.push(fight(G, b.fight, build)); t.afterFight(); continue; }
    if (b.interrogation) { // a live exchange: a few real seconds pass between presses (lies are said, heat cools)
      const nb = interrogTurn(G, t, build, R, act); if (nb === "chose") continue;
      if (nb) continue;
    }
    if (b.options && b.options.length) {
      if (build) upkeep(G, build, { attend: !!opt.attentive });
      else if (opt.attentive) for (const p of G.settlement.list()) if (p.next && !p.why) G.settlement.contribute(p.id);
      const menu = shuffle(b.options, shuffleSeed, step);
      const scored = menu.map((o) => ({ o, s: score(G, build || "eye", o, { seed, random: !build, ends: ENDS, attend: !!opt.attentive, menu }) })).filter((x) => x.s > -Infinity).sort((x, y) => y.s - x.s);
      if (!scored.length) { R.stall = { act: act.act, node: t.node, clock: clock(G), why: "every option is locked" }; return null; }
      const o = scored[0].o; act.choices++;
      // a gate: a choice between options that do different things; record what was taken
      const kinds = (x) => [...intentOf(G, x)].filter((k) => !k.startsWith("sets:") && !k.startsWith("assign:")).concat(x.check ? [`check:${(G.rs.skills[x.check.skill] || {}).attr || x.check.skill}`] : []).sort().join(" ");
      if (new Set(scored.map((x) => kinds(x.o))).size > 1) R.gates.push({ act: act.act, node: t.node, took: o.label, route: kinds(o) || "plain" });
      if (opt.trace) console.log(`${clock(G)} ${t.node}: ${o.label}${opt.trace === "scores" ? `   [${scored.slice(0, 4).map((x) => `${x.o.label.slice(0, 28)} ${x.s.toFixed(1)}`).join(" | ")}]` : ""}`);
      t.choose(o.index, { strain: build ? strainFor(G, build, o) : 0 });
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
  if (l && G.interrog.canCatch(l) && (build === "eye" || opt.attentive || hashStr(l.id, R.shuffleSeed) % 2 === 0)) {
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
  C.step = (inp) => step(inp || (C.current ? habits(C.current.W, pilot(C.current.W), build) : null));
  C.start(id); G.loop.clockRate = C.clockRate || 8;
  let end = null; const off = G.on("fight.end", (e) => { end = e; });
  for (let i = 0; i < 60 * 600 && !end; i++) G.loop.step();
  off(); C.step = step; G.loop.clockRate = 0;
  // A fight that never ends is a finding; it is closed as down (Lamb goes down: a scene, never a
  // loss) so the night can go on and the rest of the path is still played.
  if (!end) { C.current.W.result = { outcome: "down", reason: "harness: no end in ten minutes", tick: C.current.W.tick }; return { id, outcome: "NO END (closed as down)" }; }
  return { id, outcome: end.outcome };
}

// The build's own habits on top of the scripted fighter: Tongue says the offered words at once;
// Hands walks to the nearest prop it can work (a lit lamp, a closed sluice) and works it first.
function habits(W, input, build) {
  const inp = { ...input, press: [...((input && input.press) || [])] };
  if (build === "tongue" && W.talk) inp.press.push("talk");
  if (build === "hands") {
    const L = W.lamb(), usable = (p) => p.x != null && (p.kind === "lamp" ? p.on : p.kind === "sluice" ? !p.open : false);
    const p = L && (W.props || []).filter(usable).sort((a, b) => Math.hypot(a.x - L.x, a.z - L.z) - Math.hypot(b.x - L.x, b.z - L.z))[0];
    if (p && W.tick < 60 * 12) { const dx = p.x - L.x, dz = p.z - L.z, d = Math.hypot(dx, dz); if (d <= 1.3) inp.press.push("interact"); else return { mx: dx / d, mz: -dz / d, press: inp.press, hold: {} }; }
  }
  return inp;
}

// ---- --interrogations: every build into every interrogation, pressing in its own style
// Each scene is opened at the node that calls interrogate() (as the scene's menu option would), on
// a fresh game of its act with the build's archetype and the pages a build has filed by then in a
// whole playthrough (act 1: none; act 2: 10; act 3: 17), spent by the build's upkeep. Each turn
// three real seconds pass; the build presses its own style first (the highest-scoring of those),
// then `any`, then anything; it calls an open lie when it holds the fact. Reported per build and
// scene: the outcome (break, bolt, swing, walk), presses taken, and checks passed.
if (opt.interrogations) {
  const PAGES = [0, 10, 17], STYLE = (b) => (b === "fistmax" ? "fist" : b), out = [];
  const startOf = (C, id) => Object.values(C.book.nodes).find((n) => n.steps.some((st) => st.effects && st.effects.calls && (st.effects.calls.get("interrogate") || []).some((a) => a[0] === id)));
  for (const [ai, C] of contents.entries()) for (const id of Object.keys(C.interrogations || {})) {
    const def = C.interrogations[id], start = startOf(C, id);
    for (const build of ["fist", "tongue", "shadow", "hands", "eye"]) {
      const G = createFullGame({ content: C, seed: 1 });
      G.create({ archetype: BUILDS[build].precedent, enter: false }); applyMax(G, build);
      if (PAGES[ai]) G.sheet.addXp(PAGES[ai] * (+G.rs.rules["xp-per-level"] || 1));
      upkeep(G, build);
      if (def.place) G.setPlace(def.place);
      const row = { act: ai + 1, id, build, out: null, presses: [], passed: 0, checks: 0, lies: 0, why: null };
      G.on("interrog.finish", (e) => { if (e.id === id) row.out = e.out ? e.out.kind : "ended"; });
      try {
        let t = G.talk(start ? start.id : null);
        for (let turn = 0; turn < 40 && t.beat && t.beat.interrogation; turn++) {
          for (let i = 0; i < 180 && G.interrog.current && !G.interrog.outcome(); i++) G.loop.step();
          if (G.interrog.outcome()) { t.interrogResolve(); break; }
          t.interrogRefresh();
          const l = G.interrog.openLie(), O = t.beat.options;
          if (l && G.interrog.canCatch(l)) { const i = O.findIndex((o) => o.lie); if (i >= 0) { row.lies++; t.choose(i); if (G.interrog.current) continue; break; } }
          const presses = O.filter((o) => !o.lie && !o.locked), sc = (o) => score(G, build, o, { seed: 1, ends: ENDS, menu: presses });
          const pick = [presses.filter((o) => o.style === STYLE(build)), presses.filter((o) => o.style === "any"), presses].map((L) => L.sort((x, y) => sc(y) - sc(x))[0]).find(Boolean);
          if (!pick) { row.why = "no press left"; for (let i = 0; i < 60 * 30 && G.interrog.current && !G.interrog.outcome(); i++) G.loop.step(); if (G.interrog.outcome()) t.interrogResolve(); break; } // live play: silence
          row.presses.push(`${pick.style}${pick.check ? `:${pick.check.skill || ""}` : ""}`);
          const b = t.choose(pick.index, { strain: strainFor(G, build, pick) });
          if (pick.check) { row.checks++; const L = (b.lines || []).find((x) => x.kind === "check"); if (L && L.check && L.check.pass) row.passed++; }
          if (!G.interrog.current) break;
        }
        if (!row.out) row.out = t.beat && t.beat.interrogation ? "unfinished" : "never opened";
      } catch (e) { row.out = "error"; row.why = e.message; }
      out.push(row);
    }
  }
  // the outcome as the engine recorded it
  console.log("act  interrogation  build   outcome      presses (style:skill)                          checks passed  lies caught");
  for (const r of out) console.log(`${r.act}    ${r.id.padEnd(13)} ${r.build.padEnd(7)} ${String(r.out).padEnd(12)} ${r.presses.join(" ").padEnd(46)} ${`${r.passed}/${r.checks}`.padEnd(14)} ${r.lies}${r.why ? `  (${r.why})` : ""}`);
  if (opt.json) await writeFile(opt.json, JSON.stringify(out, null, 1));
  process.exit(0);
}

// ---- run and report
const builds = opt.build && opt.build !== "all" ? [opt.build] : opt.random ? [] : Object.keys(BUILDS);
const runs = [];
for (const b of builds) for (let k = 0; k < +(opt.shuffle || 1); k++) runs.push(playGame({ build: b, seed: 1, shuffleSeed: 101 + k }));
for (let k = 0; k < +(opt.random || 0); k++) runs.push(playGame({ seed: +(opt.seed || 1) + k }));
for (const r of runs) {
  const won = r.fights.filter((f) => f.outcome === "win" || f.outcome === "yield" || f.outcome === "talk").length;
  console.log(`\n== ${r.build} (menu shuffle ${r.shuffleSeed}): ${r.finished ? "FINISHED" : "did not finish"} (${r.steps} steps); fights won ${won} of ${r.fights.length}`);
  console.log(`   pages by the end of each act (gates paid): ${r.acts.map((a) => `act ${a.act} ${a.pages} (${a.gatePages})`).join(", ")}`);
  const into = (x) => { if (!x) return "not reached"; const A = r.acts[x.act - 1], s0 = x.act > 1 ? r.acts[x.act - 2].steps : 0; return `${x.attr} in act ${x.act} at ${x.clock} (${Math.round((100 * (x.step - s0)) / Math.max(1, (A.steps ?? x.step) - s0))}% of its steps)`; };
  console.log(`   interrogations: ${(r.interrogs || []).map((x) => `${x.id} ${x.out}`).join(", ") || "none"}${r.liesCaught ? `; lies caught ${r.liesCaught}` : ""}`);
  console.log(`   highest compartment by the end of each act: ${r.acts.map((a) => `act ${a.act} ${a.top}`).join(", ")}; first at 8: ${into((r.reach || {})[8])}; first at 10: ${into((r.reach || {})[10])}`);
  for (const a of r.acts) console.log(`   act ${a.act}: ${a.end ? `ended ${a.end}` : "no end"} at ${a.clock}, ${a.choices} choices; events never fired: ${a.unfired.length ? a.unfired.join(", ") : "none"}`);
  if (r.collier) console.log(`   collier: ${r.collier}; gale lamps kept: ${Object.entries(r.lamps).filter(([, v]) => v).map(([k]) => k.slice(6)).join(", ") || "none"}; rule inputs: ${JSON.stringify(r.collierWhy)}`);
  if (r.endings) console.log(`   endings: ${r.endings.end}; verdict ${r.endings.verdict || "none"}; Mother ${r.endings.mother}; Lamb ${r.endings.lamb}; causes ${r.endings.causes.join(", ") || "none"}`);
  if (r.stall) console.log(`   stalled: act ${r.stall.act} at ${r.stall.node || "?"} ${r.stall.clock || ""}: ${r.stall.why}`);
  if (r.deadEnds.length) console.log(`   dead ends: ${r.deadEnds.map((d) => `${d.node} (act ${d.act}, ${d.clock})`).join(", ")}`);
  console.log(`   fights: ${r.fights.map((f) => `${f.id} ${f.outcome}`).join(", ") || "none"}; runs: ${r.runs.map((x) => `${x.id} ${x.outcome}`).join(", ") || "none"}; sneaks: ${r.sneaks.map((x) => `${x.id} ${x.outcome}`).join(", ") || "none"}`);
  console.log(`   moves learned: ${(r.learned || []).join(", ") || "none"}; weapon in hand: ${r.weapon}`);
  const tally = {}; for (const g of r.gates) for (const k of g.route.split(" ")) tally[k] = (tally[k] || 0) + 1;
  console.log(`   routes at ${r.gates.length} gates: ${Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ")}`);
  console.log(`   flags read but never set on this path: ${r.readNeverSet.length}${r.readNeverSet.length ? ` (${r.readNeverSet.slice(0, 12).join(", ")}${r.readNeverSet.length > 12 ? ", ..." : ""})` : ""}`);
  const stuck = r.fights.filter((f) => /^NO END/.test(f.outcome)); if (stuck.length) console.log(`   fights that never ended: ${stuck.map((f) => f.id).join(", ")}`);
  if (r.errors.length) console.log(`   errors: ${r.errors.join(" | ")}`);
}
if (opt.json) await writeFile(opt.json, JSON.stringify(runs.map((r) => ({ ...r, reads: undefined, sets: undefined })), null, 1));
