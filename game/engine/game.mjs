// The game-side engine: one object that the content plugs into and the shell drives.
//   const G = createGame({ sources: [{ file, text }], seed: 7 });
//   G.create({ archetype, attrs, name })  character creation (rules/creation.mjs)
//   G.talk("keel.start")  -> a conversation (dialogue/runner.mjs)
//   G.nextScene()         -> a node to play now outside a conversation (a full meter, an event)
//   G.sheet, G.checks, G.cabinet, G.inv, G.factions, G.quests, G.world, G.pressure, G.body,
//   G.people, G.runs, G.hazards, G.settlement, G.instruments, G.memory   (the systems)
//   G.on(event, fn)  events: flag, var, xp, level, check, strain, trait.*, item.*, craft,
//                    salvage, rep, quest, rumour, meter, meter.warn, meter.full, wet, hazard.*,
//                    project, area, place, time, run.*, talk.*, end, ...
//   G.state is plain data: saving is JSON of G.state plus the environment (save/).
//   Real-time hooks (core/hooks.mjs): G.loop (fixed step, ordered systems), G.input,
//   G.register(name, api, { state, version, migrate, onLoad }), G.envAt() (world/envhub.mjs),
//   G.anims (world/anim.mjs: data-driven clip timings, events and phases).
// The environment is the night of the content's first @night record (world/night.mjs), or night
// one of Act 1, starting at @meta clock; tests may pass fixedEnv() or anything with that shape.
import { loadBook } from "./dialogue/book.mjs";
import { startTalk } from "./dialogue/runner.mjs";
import { createMemory } from "./dialogue/memory.mjs";
import { loadRuleset } from "./rules/ruleset.mjs";
import { newSheet, createSheetApi } from "./rules/sheet.mjs";
import { createChecks } from "./rules/checks.mjs";
import { createCabinet } from "./rules/cabinet.mjs";
import { createInventory } from "./rules/inventory.mjs";
import { createFactions } from "./rules/factions.mjs";
import { createCharacter, trustedMods } from "./rules/creation.mjs";
import { loadDistricts, createWorldMap } from "./world/districts.mjs";
import { loadMeters, createPressure } from "./world/pressure.mjs";
import { loadHazards, createHazards } from "./world/hazards.mjs";
import { loadProjects, createSettlement } from "./world/settlement.mjs";
import { createQuests } from "./world/quests.mjs";
import { loadInstruments, createInstruments, fill } from "./world/instruments.mjs";
import { createBody } from "./world/body.mjs";
import { loadSchedules, createPeople } from "./world/people.mjs";
import { loadRuns, createRuns } from "./world/runs.mjs";
import { loadNights, scheduleEnv, NIGHT_ONE } from "./world/night.mjs";
import { loadAnims, createAnims } from "./world/anim.mjs";
import { createEnvHub } from "./world/envhub.mjs";
import { installHooks } from "./core/hooks.mjs";
import { loadStealth, createStealthWorld } from "./world/stealth.mjs";
import { loadSneaks, createSneaks } from "./world/sneak.mjs";
import { loadObjects, createVerbs } from "./world/verbs.mjs";
import { loadGates, createGates } from "./world/gates.mjs";
import { createScope } from "./core/scope.mjs";
import { evaluate, compileEffects, runEffects, toMin } from "./core/expr.mjs";

// Everything static that content defines, loaded once.
export function loadContent(sources) {
  const book = loadBook(sources), rs = loadRuleset(book);
  const map = loadDistricts(book), meters = loadMeters(book), hz = loadHazards(book), pj = loadProjects(book), ins = loadInstruments(book);
  const runs = loadRuns(book), nights = loadNights(book), people = loadSchedules(book), anims = loadAnims(book);
  const stealth = loadStealth(book), sneaks = loadSneaks(book), objects = loadObjects(book), gates = loadGates(book);
  // LWD/0 @meta end-clock and at-end: when the clock reaches the end, the act goes to at-end.
  // It is an event like any other, so it plays at the next node boundary or from nextScene().
  if (book.meta["end-clock"] && book.meta["at-end"] && !book.events.some((e) => e.id === "meta.at-end"))
    book.events.push({ id: "meta.at-end", at: toMin(book.meta["end-clock"].trim()), when: null, steps: [{ kind: "go", value: book.meta["at-end"].trim() }], file: book.files[0], line: 0 });
  for (const e of book.events) book.nodes[`@event.${e.id}`] = { id: `@event.${e.id}`, steps: e.steps, hub: false, speaker: "", file: e.file, line: e.line, event: true };
  const errors = [...book.errors, ...rs.errors, ...map.errors, ...hz.errors, ...pj.errors, ...ins.errors, ...runs.errors, ...nights.errors, ...people.errors, ...anims.errors, ...stealth.errors, ...sneaks.errors, ...objects.errors, ...gates.errors];
  return { book, rs, map, meters, hazards: hz.hazards, projects: pj.projects, instruments: ins.instruments, runs: runs.runs, nights: nights.nights, schedules: people.schedules, anims: anims.anims, stealth, sneaks: sneaks.sneaks, objects: objects.objects, gates, errors, ok: !errors.some((e) => e.level !== "warn") };
}

export function newState(content, seed) {
  return { version: 0, seed: seed >>> 0, place: "", area: "", pos: null, flags: [], vars: {}, sheet: newSheet(content.rs), fired: [], seen: { areas: [], districts: [] } };
}

export function defaultEnv(C) {
  const night = Object.values(C.nights)[0] || NIGHT_ONE;
  return scheduleEnv({ night, places: C.book.places, clock: C.book.clock0 });
}

export function createGame({ sources = null, content = null, env = null, seed = 1, state = null } = {}) {
  const C = content || loadContent(sources);
  const listeners = new Map();
  const G = {
    content: C, book: C.book, rs: C.rs, env: env || defaultEnv(C),
    state: state || newState(C, seed), activeTalk: null,
    on(ev, fn) { const l = listeners.get(ev) || []; l.push(fn); listeners.set(ev, l); return () => listeners.set(ev, (listeners.get(ev) || []).filter((f) => f !== fn)); },
    emit(ev, data) { for (const fn of listeners.get(ev) || []) fn(data, ev); for (const fn of listeners.get("*") || []) fn(data, ev); },
    clock: () => G.env.clock(),
  };
  G.scope = createScope(G);
  G.memory = createMemory(G);
  G.sheet = createSheetApi(G);
  G.checks = createChecks(G);
  G.cabinet = createCabinet(G);
  G.inv = createInventory(G);
  G.factions = createFactions(G);
  G.quests = createQuests(G);
  G.world = createWorldMap(G, C.map);
  G.pressure = createPressure(G, { districts: C.map.districts, meters: C.meters });
  G.hazards = createHazards(G, C.hazards);
  G.settlement = createSettlement(G, C.projects);
  G.instruments = createInstruments(G, C.instruments);
  G.body = createBody(G);
  G.people = createPeople(G, C.schedules);
  G.runs = createRuns(G, C.runs);
  G.anims = createAnims(G, C.anims);
  G.envAt = createEnvHub(G);
  G.stealth = createStealthWorld(G);
  G.sneaks = createSneaks(G, C.sneaks);
  G.verbs = createVerbs(G, C.objects);
  G.gates = createGates(G, C.gates); // pays a page on each gate's first resolution (SYSTEMS-FULL 19.4)
  G.modSources = () => [...G.inv.mods(), ...G.cabinet.mods(), ...trustedMods(G)];
  G.fill = (text) => fill(text, G.scope);
  // Effects that run later in game time: after(minutes, "effects") in content (state.timers).
  G.timers = {
    add(minutes, src) { compileEffects(src); (G.state.timers ||= []).push({ at: G.clock() + minutes, src }); },
    due() { const T = G.state.timers || [], now = G.clock(); for (const t of T.filter((x) => x.at <= now)) { T.splice(T.indexOf(t), 1); runEffects(compileEffects(t.src), G.scope); G.emit("timer", t); } },
  };
  installActions(G);
  installHooks(G);
  G.on("place", () => G.stealth.unhide()); // moving on leaves a hiding spot
  G.loop.add("animation", (dt) => G.anims.update(dt), { order: 30 });
  return G;
}

const STEP = 5; // minutes: the night, the body and the meters move together in steps this long

function installActions(G) {
  G.flag = (id) => G.state.flags.includes(id);
  G.setFlag = (id, on) => {
    const has = G.flag(id);
    if (on && !has) {
      G.state.flags.push(id);
      const f = G.book.facts[id];
      if (f && f.about && f.journal) G.quests.write("fact", id, f.about);
      G.emit("flag", { id, on: true, fact: f || null });
    } else if (!on && has) { G.state.flags = G.state.flags.filter((x) => x !== id); G.emit("flag", { id, on: false }); }
  };
  G.setPlace = (p) => { if (G.state.place !== p) { G.state.place = p; G.emit("place", { id: p }); } };
  // LWD cmd lines: Lamb's wetness is the body's; the rest go to the environment.
  G.command = (args, source = "") => {
    const [c, a, b, w] = args;
    if (c === "wet") { G.body.addWet(+(a === "lamb" || isNaN(+a) ? b : a) || 0); G.emit("cmd", { args, source }); return; }
    if (G.env.command(args)) { G.emit("cmd", { args, source }); return; }
    if (c === "addRumour") { G.pressure.addRumour(a, b, +w || 0.2); return; }
    if (c === "give") { G.inv.give(a, +b || 1); return; }
    G.emit("cmd.unknown", { args, source });
  };
  G.read = ([id]) => G.instruments.read(id);
  G.advance = (minutes) => {
    if (!(minutes > 0)) return;
    const before = G.clock();
    for (let left = minutes; left > 1e-9;) {
      const m = Math.min(STEP, left); left -= m;
      G.env.advance(m);
      G.body.tick(m);
      G.cabinet.tick(m);
      G.pressure.tick(m);
      G.timers.due();
    }
    G.emit("time", { before, after: G.clock(), minutes });
  };
  // The first @event whose time has come and whose condition holds, not yet played.
  G.dueEvent = () => G.book.events.find((e) => !G.state.fired.includes(e.id) && G.clock() >= e.at && (!e.when || evaluate(e.when, G.scope))) || null;
  // Outside a conversation: what should play now (a filled meter's scene first, then an event).
  G.nextScene = () => {
    if (G.activeTalk) return null;
    const f = G.pressure.takeFull();
    if (f) { G.pressure.afterFull(f.id); return { kind: "meter", id: f.id, node: f.node }; }
    const e = G.dueEvent();
    if (e) { G.state.fired.push(e.id); return { kind: "event", id: e.id, node: `@event.${e.id}` }; }
    return null;
  };
  G.talk = (node, opts = {}) => { const t = startTalk(G, node, { exits: G.exits || new Set(), ...opts }); t.start(); return t; };
  G.start = (node = G.rs.rules["start-node"] || G.book.meta.start) => G.talk(node);
  G.create = (choice) => createCharacter(G, choice);
}
