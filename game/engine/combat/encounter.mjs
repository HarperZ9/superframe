// The hand-off between the dialogue and a fight (SYSTEMS-FULL 18.12; NOTES C1 to C5).
//
//   installCombat(G)   registers G.ext.combat and a loop system "combat" at order 20
//   content:           do: fight(e.salvors)   -> the engine calls G.ext.combat.request(id)
//   shell:             hears "fight.request", calls G.ext.combat.start(G.ext.combat.take())
//   every fixed step:  the combat system steps the fight from G.input (names below)
//   when it ends:      "fight.end" { id, outcome, node }; the runner plays G.ext.combat.finish()
//
// This mirrors Tide Runs (world/runs.mjs: request, take, start, finish, outcome) so the runner
// and the shell treat both the same way. Input names read from G.input: move {x, z} (z north),
// presses light, heavy, catch, step, roll, shove, grapple, use, lock, next, prev; held heavy,
// block.
//
// Records read: @encounter (name, area, foe: id n, win, yield, fled, down, lose, param), @foe
// (name, faction, standing, breath, poise, tool, sight, yields, char), @weapon (class, weight,
// reach). Outcome nodes: win, yield, fled, down; lose (the tide ended it) falls back to down.
// On finish: fought.<encounter id>, struck.<char> for each foe Lamb hit that names a char,
// book.violence when a Lamplighter could see Lamb strike, var fights + 1 (C1). Down never ends
// the game (C4); no foe dies (C5): Standing 0 is down, and the encounter ends in win.
// Openings (2026-10-17): `opening: sneak|alerted|open` on the record, or start(id, { opening,
// lastSeen }) / request(id, { opening, lastSeen }) from the stealth layer, which wins.
// An ambush from a sneak scene (world/stealth.mjs sets G.state.ambush = { encounter, watcher,
// advantage }) starts the fight in the sneak opening with Lamb just behind the struck opponent
// (the one whose @foe char matches the watcher's, else the first) and the takedown already under
// way: the small go down, the big take the free strike and a knockdown. The flag is cleared.
// Utility setups: `prop: <kind> <numbers> ? <condition>` (sim/props.mjs: lamp, cut, sluice, flood,
// snare); the condition is read on the game state when the fight starts. Arenas add their own
// cuttable lamps.
// Talk exits: `talk: <node> | <label> ? <condition>` (label optional). The condition is read every
// half second during the fight with these names set: fight_seconds, fight_lamb_standing,
// fight_foes_standing, fight_foes_down, fight_foes_yielding, fight_struck (opponents Lamb hit).
// While one holds, a "talk" press ends the fight with outcome talk and plays that node.
// @bark id records (key: one of BARK_KEYS in sim/barks.mjs, text: the line) replace the
// placeholder lines (C3); the last record with a key wins.
import { ARENAS } from "./data/arenas.mjs";
import { styleFor } from "./data/foes.mjs";
import { TOOLS, TOOL_CLASSES, profileOf } from "./data/tools.mjs";
import { TOOLS21, TEMPER, CLOTHING } from "./data/build.mjs";
import { lambDef, foeDef, fighterSpec, learnedFromFlags } from "./roster.mjs";
import { createWorld } from "./sim/world.mjs";
import { parseProp } from "./sim/props.mjs";
import { startMove } from "./sim/fighter.mjs";
import { rootSpeed } from "./sim/moves.mjs";
import { compile, evaluate } from "../core/expr.mjs";
import { BARK_TEXT, BARK_KEYS } from "./sim/barks.mjs";

const one = (r, k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
const all = (r, k) => r.kv.filter((e) => e.key === k).map((e) => e.value.trim());

export function loadEncounters(book) {
  const recs = book.records || {}, out = {}, errors = [];
  for (const r of Object.values(recs.weapon || {})) {
    const cls = one(r, "class");
    if (!TOOL_CLASSES[cls]) { errors.push({ file: r.file, line: r.line, msg: `weapon ${r.id}: unknown class ${cls}` }); continue; }
    TOOLS[r.id] = { ...(TOOLS[r.id] || {}), name: one(r, "name") || r.id, cls, ...(one(r, "weight") ? { weight: +one(r, "weight") } : {}) };
  }
  for (const r of Object.values(recs.encounter || {})) {
    const foes = all(r, "foe").map((v) => { const [id, n] = v.split(/\s+/); return { id, n: +(n || 1), rec: (recs.foe || {})[id] || null }; });
    const missing = foes.filter((f) => !f.rec).map((f) => f.id);
    if (missing.length) errors.push({ file: r.file, line: r.line, level: "warn", msg: `encounter ${r.id}: no @foe ${missing.join(", ")}` });
    const cond = (v) => { const [body, c] = v.split(/\s+\?\s+/); try { return { body: body.trim(), when: c ? compile(c) : null }; } catch (e) { errors.push({ file: r.file, line: r.line, msg: `encounter ${r.id}: ${e.message}` }); return null; } };
    const props = all(r, "prop").map(cond).filter(Boolean).map((p) => ({ ...p, prop: parseProp(p.body.split(/\s+/)) }));
    for (const p of props) if (!p.prop) errors.push({ file: r.file, line: r.line, msg: `encounter ${r.id}: unknown prop "${p.body}"` });
    const talks = all(r, "talk").map(cond).filter(Boolean).map((t) => { const [node, label] = t.body.split("|").map((x) => x.trim()); return { node, label: label || "Talk", when: t.when }; });
    out[r.id] = { id: r.id, name: one(r, "name") || r.id, area: one(r, "area"), light: one(r, "light") || null, foes, params: all(r, "param"),
      opening: one(r, "opening") || "open", props: props.filter((p) => p.prop), talks,
      nodes: Object.fromEntries(["win", "yield", "fled", "down", "lose"].map((k) => [k, one(r, k) || null])) };
  }
  const barks = { ...BARK_TEXT };
  for (const r of Object.values(recs.bark || {})) {
    const key = one(r, "key"), text = one(r, "text");
    if (!BARK_KEYS.includes(key) || !text) { errors.push({ file: r.file, line: r.line, level: "warn", msg: `bark ${r.id}: needs key (${BARK_KEYS.join(", ")}) and text` }); continue; }
    barks[key] = text;
  }
  return { encounters: out, errors, barks };
}

const num = (f, d) => { try { const v = +f(); return isFinite(v) ? v : d; } catch { return d; } };

// Lamb's fighting numbers from the sheet and the body, read at the start of the fight.
export const VOICES = ["grip", "ballast", "knees", "pride", "formletter", "sum", "dark", "salt", "carbon", "precedent", "undertow", "condolence", "hearsay", "smell"];
export const COMPARTMENTS = ["coat", "nose", "pen", "hat"];
const toolState = (G, tool) => { const t = (((G.state.ext || {}).combat || {}).tools || {})[tool]; return typeof t === "number" ? { temper: t } : t || {}; };

export function lambFromGame(G) {
  const S = G.sheet, P = G.pressure, levels = {};
  // a compartment or voice the content does not define reads 0 on the sheet; real ones never do
  for (const c of COMPARTMENTS) levels[c] = num(() => S.attr(c), 0) || (c === "coat" ? 2 : 3);
  for (const v of VOICES) levels[v] = num(() => S.skill(v), 0) || 3;
  Object.assign(levels, { wear: num(() => P.meter("wear"), 0), cold: num(() => P.meter("cold"), 0), dread: num(() => P.meter("dread"), 0), wet: num(() => G.body.wet(), 0) });
  const hand = ((G.state.inv || {}).equipped || {}).hand, tool = hand && (TOOLS21[hand] || TOOLS[hand]) ? hand : "w.case";
  const learned = learnedFromFlags(G.state.flags || []);
  const eq = (G.state.inv || {}).equipped || {}, gear = Object.entries(eq).filter(([slot, id]) => slot !== "hand" && id && CLOTHING[id]).map(([, id]) => id);
  const ts = toolState(G, tool), count = (id) => (G.inv ? G.inv.count(id) : 0);
  const items = { lantern: Math.max(1, count("i.lantern")), bottle: 1, rope: count("w.rope"), salt: count("w.salt") };
  return { levels, tool, learned, gear, temper: ts.temper || 0, fitting: ts.fitting || null,
    def: lambDef(levels, tool, {}, learned, { gear: gear.length ? gear : undefined, temper: ts.temper || 0, fitting: ts.fitting || null, items }) };
}

// Every fight ends: an encounter that is still going after FIGHT_LIMIT seconds breaks off
// (sim/world.mjs breakOff: yield when Lamb has the better of it, else fled).
export const FIGHT_LIMIT = 120;

// A brawl (`param: brawl`, no foe lines): five brawlers, every one on a side of their own, who go
// for whoever is nearest. Lamb may join, keep out (an exit), or stand in it. After a minute it
// breaks up (yield) if Lamb is still standing.
export const BRAWL = { count: 5, seconds: 60, standing: 6, breath: 6, poise: 3 };

function brawlWorld(G, enc, A, fighters, spawns, barkText) {
  for (let k = 0; k < BRAWL.count; k++) {
    const at = spawns[k % spawns.length], def = foeDef({ standing: BRAWL.standing, breath: BRAWL.breath, poise: BRAWL.poise, faction: "brine", name: "A drinker" }, "skirmisher");
    const off = [at[0] + (k >= spawns.length ? 1.2 : 0), at[1] + (k % 2) * 0.8]; // spread, but never into a wall
    fighters.push(fighterSpec(`brawler#${k}`, `brawl${k}`, { ...def, items: {} }, onGround(A, off) ? off : at, { face: k, brain: true }));
  }
  const W = createWorld({ G, arena: A, fighters, seed: G.state.seed ^ (G.env.clock() * 131), barkText, limitFrames: BRAWL.seconds * 60 });
  W.brawl = true;
  return W;
}

// Is (x, z) on walkable ground in this arena? (plate grids have solid cells; row arenas do not)
function onGround(A, [x, z]) {
  if (!A.grid) return true;
  const c = Math.floor((x - A.origin[0]) / A.cell), r = Math.floor((z - A.origin[1]) / A.cell);
  return c >= 0 && r >= 0 && c < A.grid.w && r < A.grid.h && !!A.grid.cells[r * A.grid.w + c];
}

const holds = (G, c) => { try { return !c || !!evaluate(c, G.scope); } catch (e) { console.error("combat: condition failed:", e.message); return false; } };

function buildWorld(G, enc, arenas, barkText, opts = {}, plates = null) {
  const arena = (plates && plates[enc.area]) || arenas[enc.area] || arenas.floor;
  const place = G.book.places[G.state.place] ? G.state.place : arena.place;
  const A = { ...arena, place, blackout: enc.light === "blackout" || !!arena.blackout };
  // opts.lamb { levels, tool, gear, learned, temper, fitting }: a given build in place of the sheet (tools, tests)
  const L = opts.lamb ? { def: lambDef(opts.lamb.levels || {}, opts.lamb.tool || "w.case", {}, opts.lamb.learned || [], { gear: opts.lamb.gear, temper: opts.lamb.temper || 0, fitting: opts.lamb.fitting || null }) } : lambFromGame(G), spawns = arena.spawns.foes, fighters = [fighterSpec("lamb", "lamb", L.def, arena.spawns.lamb, { face: Math.PI / 2 })];
  let i = 0;
  if (!enc.foes.length && enc.params.some((p) => /^brawl\b/.test(p))) return brawlWorld(G, enc, A, fighters, spawns, barkText);
  for (const f of enc.foes) for (let k = 0; k < f.n; k++, i++) {
    const style = styleFor(f.id, f.rec), at = spawns[i % spawns.length];
    const off = [at[0] + Math.floor(i / spawns.length), at[1]], spot = Math.floor(i / spawns.length) && !onGround(A, off) ? at : off;
    fighters.push(fighterSpec(`${f.id}#${k}`, "foe", foeDef(f.rec, style), spot, { face: -Math.PI / 2, brain: true }));
  }
  const props = enc.props.filter((p) => holds(G, p.when)).map((p) => p.prop);
  const end = L.def.bonus.end || 0;
  for (const f of fighters) if (f.team !== "lamb" && f.def.yields != null && end) f.def = { ...f.def, yields: Math.min(f.def.hp - 1, f.def.yields + end) };
  return createWorld({ G, arena: A, fighters, seed: G.state.seed ^ (G.env.clock() * 131), barkText, props, opening: opts.opening || enc.opening, lastSeen: opts.lastSeen || null, endEmpty: true, limitFrames: FIGHT_LIMIT * 60 });
}

export function inputFromG(G) {
  const I = G.input, mv = I.get("move") || { x: 0, z: 0 };
  const names = ["light", "heavy", "catch", "step", "roll", "shove", "grapple", "use", "lock", "next", "prev", "lantern", "interact", "talk", "art", "art2"];
  return { mx: +mv.x || 0, mz: -(+mv.z || 0), press: names.filter((n) => I.pressed(n)), hold: { heavy: !!I.get("heavy"), block: !!I.get("block"), run: !!I.get("run") } };
}

// Real seconds per game minute while a fight runs. A typical fight is 15 to 30 real seconds, so
// it costs two to four game minutes; a Lamb who stands still is down in one or two. The shell
// sets G.loop.clockRate from G.ext.combat.clockRate.
export const FIGHT_CLOCK_RATE = 8;

export function installCombat(G, { arenas = ARENAS } = {}) {
  const { encounters, errors, barks } = loadEncounters(G.book);
  const api = {
    defs: encounters, errors, current: null, clockRate: FIGHT_CLOCK_RATE, plates: {},
    // what a level-up screen or the bench can show: Lamb's fighting numbers for given levels
    preview: (levels = null, tool = null, opts = null) => previewOf(G, levels, tool, opts),
    // the bench (19.7): temper 0 to 5 paid in salvage and minutes, and one fitting per tool
    upgradeCost: (tool) => upgradeCost(G, tool),
    upgrade: (tool) => upgrade(G, tool),
    fit: (tool, fitting) => fit(G, tool, fitting),
    // a painted plate's arena (sim/plate.mjs) for an encounter area: fights there run on the plate
    usePlate(area, arena) { api.plates[area] = arena; },
    request(id, opts = null) { if (!encounters[id]) throw new Error(`no encounter ${id}`); G.state.pendingFight = id; if (opts) G.state.pendingFightOpts = opts; G.emit("fight.request", { id, ...(opts || {}) }); },
    take() { const id = G.state.pendingFight; delete G.state.pendingFight; return id || null; },
    start(id, opts = null) {
      const enc = encounters[id]; if (!enc) throw new Error(`no encounter ${id}`);
      const amb = G.state.ambush && G.state.ambush.encounter === id ? G.state.ambush : null; delete G.state.ambush;
      const o = opts || G.state.pendingFightOpts || (amb ? { opening: "sneak" } : {}); delete G.state.pendingFightOpts;
      api.current = { id, W: buildWorld(G, enc, arenas, barks, o, api.plates) };
      if (amb) ambushOpening(G, api.current.W, amb);
      const d = api.current.W.defs.lamb, lamb = { standing: d.hp, breath: d.stamina, poise: d.poise, grip: d.grip, tool: d.tool.id, load: d.load, learned: d.learned || [], levels: d.levels };
      G.emit("fight.start", { id, name: enc.name, lamb });
      if (typeof process !== "undefined" && process.env && process.env.COMBAT_TRACE) console.log(`[combat] start ${id}`, JSON.stringify(lamb));
      return api.current.W;
    },
    // One fixed step (the loop calls this); input defaults to G.input.
    step(input = null) {
      const c = api.current; if (!c || c.W.result) return [];
      const ev = c.W.step({ lamb: input || inputFromG(G) });
      if (c.W.tick % 30 === 0 && !c.W.result) offerTalk(G, c, encounters[c.id]);
      for (const e of ev) G.emit(`fight.${e.type}`, e);
      if (c.W.result) G.emit("fight.end", { id: c.id, outcome: c.W.result.outcome, node: nodeFor(encounters[c.id], c.W.result.outcome, c.W) });
      return ev;
    },
    // The node the fight leads to, once it is over; records it and clears the fight.
    finish() {
      const c = api.current; if (!c || !c.W.result) return null;
      api.current = null;
      record(G, c);
      for (const k of ["fight_seconds", "fight_lamb_standing", "fight_foes_standing", "fight_foes_down", "fight_foes_yielding", "fight_struck"]) delete (G.state.vars || {})[k];
      return nodeFor(encounters[c.id], c.W.result.outcome, c.W);
    },
    outcome: (id) => ((G.state.ext.combat || {}).fights || {})[id] || "",
  };
  G.register("combat", api, { state: () => ({ fights: {}, tools: {} }), version: 1 });
  G.loop.add("combat", () => api.step(), { order: 20 });
  return api;
}

// The ambush the player made in the sneak scene lands on the fight's first frames.
function ambushOpening(G, W, amb) {
  const w = ((G.content.stealth || {}).watchers || {})[amb.watcher], L = W.lamb();
  const foes = W.fighters.filter((F) => F.team !== "lamb");
  const T = (w && w.char && foes.find((F) => W.defs[F.id].char === w.char)) || foes[0];
  if (!T) return;
  T.aware = false; T.notice = 0;
  L.x = T.x - Math.cos(T.face) * 1.1; L.z = T.z - Math.sin(T.face) * 1.1; L.face = T.face; L.lantern = 0;
  startMove(W, L, "takedown");
  W.emit({ type: "ambush", id: T.id, watcher: amb.watcher, advantage: amb.advantage || "sneak" });
}

// Every number the Build page shows, for the current Lamb or a change not yet made: levels (a
// level-up), tool, and opts { gear, temper, fitting } (clothes to compare, a temper step or fitting
// at the bench). `applied` echoes what was used. Single source for ui/buildstats.mjs.
function previewOf(G, levels, tool, opts = null) {
  const now = lambFromGame(G), L = { ...now.levels, ...(levels || {}) }, t = tool || now.tool, ts = toolState(G, t), o = opts || {};
  const T = TOOLS21[t] || TOOLS21["w.hands"];
  const gear = o.gear ? o.gear.filter((g) => CLOTHING[g]) : now.gear.length ? now.gear : undefined;
  const temper = o.temper != null ? Math.max(0, Math.min(TEMPER.length, Math.round(o.temper))) : ts.temper || 0;
  const fitting = o.fitting !== undefined ? (o.fitting && (T.fittings || []).includes(o.fitting) ? o.fitting : null) : ts.fitting || null;
  const d = lambDef(L, t, {}, now.learned, { gear, temper, fitting });
  const S = fighterSpec("lamb", "lamb", d, [0, 0]), set = S.def.moveset, M = S.moves, sec = (n) => +(n / 60).toFixed(2);
  const strike = (id) => { const m = id && M[id]; return m ? { dmg: +(m.dmg || 0).toFixed(2), poise: +(m.poise || 0).toFixed(2), breath: +(m.stamina || 0).toFixed(2) } : null; };
  const dist = (id) => { const m = id && M[id]; if (!m) return null; let x = 0; const n = (m.startup || 0) + (m.active || 0) + (m.recovery || 0); for (let f = 0; f < n; f++) x += rootSpeed({ root: m.root || [] }, f) / 60; return +x.toFixed(2); };
  const stun = d.tempo.stun, roll = set.roll[d.load] || set.roll.medium;
  return { standing: d.hp, breath: d.stamina, poise: d.poise, composure: d.composureMax, load: d.loadInfo, meets: d.bonus.met, needs: T.needs, scale: T.scale,
    light: +(d.tool.light[0] * d.bonus.dmg).toFixed(2), heavy: +(d.tool.heavy[0] * d.bonus.dmg).toFixed(2), read: d.bonus.read, weak: d.bonus.weak, evade: d.bonus.evade,
    yieldsSooner: d.bonus.end, swingCost: d.bonus.breath, art: d.art, temper: d.temper, fitting: d.fitting, fittings: T.fittings,
    // the rows the Build page asked for (UI lead, 2026-10-17)
    breathPerSecond: +d.staminaRegen.toFixed(2), breathDelay: sec(d.staminaDelay),
    protection: d.protection, softened: +(1 - d.soften).toFixed(3),
    strikes: { light: strike(set.light), heavy: strike(set.heavy), charged: strike(`lamb:heavy_charged`), art: strike(set.art), art2: strike(set.art2) },
    dodge: { step: dist(set.step), roll: dist(roll), rollForm: roll.replace(/^lamb:/, "") },
    staggered: { stagger: sec(Math.round(60 * stun)), knockdown: sec(Math.round(48 * stun) + Math.round(50 * stun)) },
    breaks: d.breaks, tempo: d.tempo,
    frames: framesOf(S, d),
    applied: { levels: L, tool: t, gear: d.gear, temper: d.temper, fitting: d.fitting } };
}

// Frame counts at this body's tempo, for the Build page (60 frames a second): each move's
// startup, active, recovery and total; windows as [first, last) frame and a count.
function framesOf(S, d) {
  const set = S.def.moveset, M = S.moves;
  const win = (w) => (w ? { from: w[0], to: w[1], frames: w[1] - w[0] } : null);
  const one = (id) => {
    const m = id && M[id]; if (!m) return null;
    const total = (m.startup || 0) + (m.active || 0) + (m.recovery || 0);
    return { startup: m.startup || 0, active: m.active || 0, recovery: m.recovery || 0, total, base: m.baseTotal || total, iframes: win(m.iframes), parry: win(m.parry), sweep: win(m.sweep) };
  };
  const roll = set.roll[d.load] || set.roll.medium; // the form chooseRoll picks on dry ground
  return { light: one(set.light), heavy: one(set.heavy), charged: one("lamb:heavy_charged"), catch: one(set.catch), step: one(set.step), roll: one(roll), rollForm: roll.replace(/^lamb:/, ""), art: one(set.art), art2: one(set.art2), fps: 60 };
}

function upgradeCost(G, tool) {
  const ts = toolState(G, tool), lv = ts.temper || 0, step = TEMPER[lv];
  if (!step) return null;
  const have = (id) => (G.inv ? G.inv.count(id) : 0);
  return { temper: lv, next: lv + 1, needs: step.needs, minutes: step.minutes, affordable: Object.entries(step.needs).every(([id, n]) => have(id) >= n) };
}

// Temper a tool one step at a bench: pays the salvage and the minutes; false if it cannot.
function upgrade(G, tool) {
  const c = upgradeCost(G, tool); if (!c || !c.affordable) return false;
  for (const [id, n] of Object.entries(c.needs)) G.inv.take(id, n);
  const tools = (G.state.ext.combat.tools ||= {}); tools[tool] = { ...toolState(G, tool), temper: c.next };
  if (G.advance) G.advance(Math.round(c.minutes * (lambFromGame(G).def.tempo.bench || 1))); // PEN works the bench faster
  G.emit("combat.temper", { tool, temper: c.next });
  return true;
}

// Fit a tool with one of its fittings (19.7); a second fitting replaces the first.
function fit(G, tool, fitting) {
  const T = TOOLS21[tool]; if (!T || !(T.fittings || []).includes(fitting)) return false;
  const tools = (G.state.ext.combat.tools ||= {}); tools[tool] = { ...toolState(G, tool), fitting };
  if (G.advance) G.advance(15);
  G.emit("combat.fit", { tool, fitting });
  return true;
}

const nodeFor = (enc, outcome, W = null) => (outcome === "talk" && W ? W.result.reason : enc.nodes[outcome] || (outcome === "lose" ? enc.nodes.down : null) || enc.nodes.down);

// The fight's numbers as names the talk conditions can read, then the first exit that holds.
function offerTalk(G, c, enc) {
  if (!enc.talks.length) return;
  const W = c.W, foes = W.fighters.filter((F) => F.team !== "lamb"), v = (G.state.vars ||= {});
  Object.assign(v, { fight_seconds: Math.floor(W.tick / 60), fight_lamb_standing: +W.lamb().hp.toFixed(2), fight_foes_standing: +foes.reduce((s, F) => s + F.hp, 0).toFixed(2),
    fight_foes_down: foes.filter((F) => F.out && !F.yielded).length, fight_foes_yielding: foes.filter((F) => F.yielded).length, fight_struck: W.struck.length });
  W.offerTalk(enc.talks.find((t) => holds(G, t.when)) || null);
}

function record(G, c) {
  const W = c.W, ext = G.state.ext.combat;
  ext.fights[c.id] = W.result.outcome;
  G.setFlag(`fought.${c.id}`, true);
  for (const id of W.struck) { const ch = W.defs[id].char; if (ch) G.setFlag(`struck.${ch}`, true); }
  if (W.seenViolence) G.setFlag("book.violence", true);
  const vars = (G.state.vars ||= {});
  vars.fights = (+vars.fights || 0) + 1;
}
