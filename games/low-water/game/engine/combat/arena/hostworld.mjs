// The Adversary's three movements (combat/data/host.mjs; DECISIONS-2026-10-22.md inferno decision 1), each a world
// of its own on the ice, played in order by the inner run (combat/arena/inner.mjs).
//   createHostWorld({ G, movement: 0 | 1 | 2, limbs: [flaw ids kept by the run], seed, levels, boons })
// limbs: the flaws this run beat by force; a run that kept none passes the last self-lie it heard, so the Host
// is smaller and never absent (04-ADVERSARY section 1.2).
import { createWorld } from "../sim/world.mjs";
import { dist, angleTo } from "../sim/fighter.mjs";
import { INNER_ARENAS } from "../data/arenas-inner.mjs";
import { HOST } from "../data/host.mjs";
import { FLAWS } from "../data/flaws.mjs";
import { flawBossSpec, innerLamb } from "./innerspawn.mjs";
import { readLamb, endAs, convertResult, NAME } from "./innerverbs.mjs";
import { dcos, dsin } from "../sim/math.mjs";
import { LIMB_PHASES, LIMB_MOVES } from "../data/fights-host.mjs";
import { installHazards, stepHazards, changeGround } from "./innerhaz.mjs";

const ICE_CH = "f";

export function createHostWorld({ G, movement = 0, limbs = [], seed = 1, levels = {}, boons = [], record = false }) {
  const M = HOST.movements[movement], base = INNER_ARENAS[HOST.arena];
  const arena = { ...base, rows: [...base.rows], exits: [] };
  const pseudo = { id: "host", town: M.shown || "The Host", tool: "w.stick", specials: HOST.specials, phases: M.phases, body: { form: M.form, defaults: M.body }, floor: 0, lines: M.lines };
  const L = innerLamb(pseudo, { levels, boons }); [L.x, L.z] = arena.spawns.lamb;
  const fighters = [L];
  if (M.body) fighters.push(flawBossSpec("boss", pseudo, arena.spawns.foes[0], { face: Math.PI / 2 }));
  if (M.id === "host") limbs.forEach((id, i) => fighters.push(limbSpec(id, i, limbs.length, arena.spawns.foes[0])));
  const W = createWorld({ G, arena, fighters, seed, record, barks: false });
  W.inner = { flaw: "host", kind: "host", movement: M.id, lay: 0, laid: false, rested: 0, lastAct: 0, ice: 0, iced: 0, said: {}, scale: 1, look: M.form, morphAt: -1e9,
    limbs: [...limbs], named: [], bossIds: ["boss"], numbers: false, anchor: HOST.anchor, nameable: M.id !== "accuser", nameHold: NAME.hold, card: null, whispers: 0 };
  W.inner.say = (at) => say(W, M, at);
  W.inner.phase = -1; W.inner.open = false; installHazards(W); // a real fight: its phases change the ice, its ground acts (combat/arena/innerhaz.mjs)
  if (M.id === "host") {
    W.inner.nameTarget = (W2) => { if (!W2.fighters.some((F) => F.id.startsWith("boss-limb") && !F.out)) return "boss"; /* every limb gone: the Host itself is named */ const Lb = W2.lamb(), live = W2.fighters.filter((F) => F.id.startsWith("boss-limb") && !F.out); const lock = Lb.lock && W2.byId(Lb.lock); return (lock && live.includes(lock) ? lock : live.sort((a, b) => dist(Lb, a) - dist(Lb, b))[0] || {}).id || null; };
    W.inner.onNamed = (W2, target) => nameLimb(W2, target);
  }
  if (M.id === "withdraws") W.inner.onNamed = (W2) => { W2.inner.card = M.verbs.name.card; endAs(W2, "talk", "recognised"); };
  const step0 = W.step;
  W.step = (inputs = {}) => {
    if (W.result) return [];
    const lamb = readLamb(W, inputs.lamb || {});
    step0({ ...inputs, lamb });
    if (W.result) convertResult(W);
    if (!W.result) after(W, M, W.events);
    return W.events;
  };
  return W;
}

// The Accuser speaks the run's own traits back to it (the traits pass, 2026-10-23; design/TRAITS.md section 4): at
// each of his phases, the first words of one trait the run fed, in that trait's own voice, so the caption names it
function echoTrait(W, limbs, phase) {
  const ids = (limbs || []).filter((id) => FLAWS[id]); if (!ids.length) return;
  const f = FLAWS[ids[phase % ids.length]], l = (f.lines || []).find((x) => x.at === "start"); if (!l) return;
  W.emit({ type: "bark", voice: l.voice, text: l.text, id: "boss", proposal: true, echo: f.id });
}

function say(W, M, at, i = 0) {
  const ls = (M.lines || []).filter((x) => x.at === at); if (!ls.length) return;
  if (at === "once") { if (W.inner.said.once) return; W.inner.said.once = true; }
  const l = ls[i % ls.length]; W.emit({ type: "bark", voice: l.voice, text: l.text, id: "boss", proposal: true });
}

// A limb: a kept lie that fights beside the Host (killable since the rework of 2026-10-23); it strikes with the
// Host's limb move in turn, one limb at a time; it falls only when named.
function limbSpec(flawId, i, n, at) {
  const f = FLAWS[flawId] || { id: flawId, town: flawId, body: { defaults: {} } };
  const a = (i / Math.max(1, n)) * Math.PI * 2, pos = [at[0] + dcos(a) * 1.3, at[1] + dsin(a) * 0.9];
  const body = { tool: "w.hands", standing: 8, breath: 8, poise: 6, speed: 1.2, accel: 8, turn: 4, radius: 0.35, height: 1.6, grip: 6 };
  const pseudo = { id: `limb:${flawId}`, town: f.town, specials: Object.fromEntries(Object.keys(LIMB_MOVES).map((k) => [k, HOST.specials[k]])), phases: LIMB_PHASES, body: { form: "limb", defaults: body }, floor: 0 };
  const s = flawBossSpec(`boss-limb-${flawId}`, pseudo, pos, { face: a });
  s.def.boss = null; s.def.limbOf = flawId; s.def.limbForm = (f.body || {}).form || null;
  return s;
}

function after(W, M, ev) {
  const I = W.inner, L = W.lamb();
  if (W.tick === 1) say(W, M, "start");
  for (const e of ev) if (e.type === "boss.phase" && e.id === "boss") { I.phase = e.phase; changeGround(W, (M.phases[e.phase] || {}).ground); if (M.id === "accuser") echoTrait(W, I.limbs, e.phase); }
  stepHazards(W, M.phases[I.phase], ev); if (W.result) return;
  I.open = I.phase >= 1; // facing it, the stillness and the whisper only once the fight is joined (innerworld.mjs)
  const B = W.byId("boss"); if (B && (B.out || B.hp <= 0)) for (const F of W.fighters) if (F.id.startsWith("boss-limb") && !F.out) { F.out = true; F.yielded = true; W.emit({ type: "yield", id: F.id, by: "lamb" }); }
  for (const e of ev) if (e.type === "hit" && e.by === "lamb") {
    I.lastAct = W.tick;
    if (M.id === "accuser") say(W, M, "struck");
    if (M.id === "host") say(W, M, "struck"); // the ice spreads by phase now, not by blows (fights-host.mjs)
  }
  if (M.id === "accuser") {
    // the stillness: once the fight is joined, M.silence frames with no blow landed and he lets the player go
    if (I.open && W.tick - I.lastAct >= M.silence) { say(W, M, "end"); return endAs(W, "endured", "silence"); }
    if (W.tick >= 60 * 300) { say(W, M, "end"); return endAs(W, "endured", "time"); }
  }
  if (M.id === "host") {
    // one limb strikes at a time, in turn
    const live = W.fighters.filter((F) => F.id.startsWith("boss-limb") && !F.out), turn = live.length ? live[Math.floor(W.tick / 120) % live.length] : null;
    for (const F of live) if (F.mem && F !== turn) F.mem.rest = Math.max(F.mem.rest || 0, W.tick + 2);
    if (W.tick >= 60 * 300) return endAs(W, "down", "time");
  }
  if (M.id === "withdraws") {
    if (W.tick % M.whisper.every === 0) { say(W, M, "whisper", I.whispers); I.whispers++; }
    // first light comes whether or not he knew it: the card all the same, the outcome not a recognition
    if (W.tick >= 60 * 300) { I.card = M.verbs.name.card; return endAs(W, "endured", "dawn"); }
  }
  void L;
}

// Every blow the player lands spreads the ice one ring in from the edge (footing: frost); when it covers
// M.freeze.reach of the floor it has reached him: a loss
function freeze(W, M) {
  const I = W.inner, A = W.field.arena, base = INNER_ARENAS[HOST.arena].rows; I.ice += M.freeze.perBlow;
  const h = base.length, w = base[0].length; let open = 0, iced = 0;
  A.rows = base.map((r, z) => [...r].map((ch, x) => { if (ch === "K") return ch; open++; const edge = Math.min(x, z, w - 1 - x, h - 1 - z); if (edge <= I.ice * 0.6) { iced++; return ICE_CH; } return ch; }).join(""));
  I.iced = +(iced / Math.max(1, open)).toFixed(3); W.emit({ type: "freeze", share: I.iced });
  if (I.iced >= M.freeze.reach) endAs(W, "down", "ice");
}

function nameLimb(W, id) {
  const I = W.inner, F = id && W.byId(id); if (!F || F.out) return;
  if (id === "boss") { say(W, HOST.movements[1], "named"); return endAs(W, "talk", "named"); } // its limbs gone, the Host named
  F.out = true; F.yielded = true; I.named.push(W.defs[id].limbOf); W.emit({ type: "out", id, named: true });
  say(W, HOST.movements[1], "named");
  const left = W.fighters.filter((G2) => G2.id.startsWith("boss-limb") && !G2.out).length;
  I.scale = +((left + 1) / (I.limbs.length + 1)).toFixed(3);
  const B = W.byId("boss"); if (B) { W.defs.boss.height = +(W.defs.boss.baseHeight * Math.max(0.7, I.scale)).toFixed(3); }
  if (!left) endAs(W, "talk", "named");
}
