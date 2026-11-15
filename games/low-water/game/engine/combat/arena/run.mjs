// The arena mode's run (coordinator, 2026-10-21): a ladder of rounds, each a few waves of archetypes and
// every fourth a boss; between rounds three offers (a level, the tool's temper, another tool, mending);
// seeds and modifiers for replay; personal records kept on the player's machine only. Pure: the arena
// page and tools/arenarun.mjs both drive it.
//   const R = createRun({ seed, mods, start: { levels, tool } })
//   R.stage()            -> { kind: "fight", round, wave, waves, foes: [[style, elite]...] | boss } | { kind: "offer", choices } | { kind: "over" }
//   R.world(G, arena)    -> a world for the current fight stage (Lamb carried in with what is left of her)
//   R.finish(W)          after a fight world ends: carries Lamb out, keeps the metrics, moves on
//   R.choose(i)          takes an offer (a venue's record boon is written to S.records and onRecord(ev))
//   R.summary()          rounds cleared, the build, the metrics (combat/arena/metrics.mjs)
// Waves hold at most three live opponents (the crowd budget the performance engineer set).
import { rand01 } from "../../core/rng.mjs";
import { createWorld } from "../sim/world.mjs";
import { lambDef, fighterSpec } from "../roster.mjs";
import { foeSpec, bossSpec, summoner } from "./spawn.mjs";
import { createMetrics } from "./metrics.mjs";
import { SKINS } from "../data/skins-quota.mjs";

// what each archetype costs a wave's budget (an elite twice), and from which round it can appear
export const POOL = { swarm: [1, 1], hound: [1, 1], skirmisher: [2, 1], cutter: [2, 2], sweeper: [2, 2], zealot: [3, 3], holder: [3, 3], shield: [3, 3], captain: [4, 4], grappler: [4, 5] };
export const LADDER = { bossEvery: 4, bosses: ["foreman", "warden"], waves: (r) => (r < 3 ? 2 : 3), budget: (r, w) => 1 + r + w, eliteFrom: 3, eliteChance: (r) => Math.min(0.5, 0.06 * r), maxLive: 3, mendBetween: 0.35, mendWave: 0.15, foeHp: (r) => Math.min(1.2, 0.6 + 0.05 * r), focus: true };
export const TOOLS = ["w.case", "w.stick", "w.boathook", "w.pole", "w.knife", "w.hammer", "w.crowbar"];
export const LEVELS = ["coat", "knees", "ballast", "grip", "pen", "nose"];
// boons: the arena's own upgrades, outside the sheet, that act at once: harder blows, more standing, more
// Breath, a longer dodge. Taking the same boon again gives half as much again each time (focus), so a run
// that commits grows faster in one thing than a run that spreads.
export const BOONS = { edge: { dmg: 0.12 }, frame: { hp: 2 }, wind: { st: 1 }, footwork: { iframes: 2 }, read: { read: 4 } };
// the boons a run offers: Low Water's four, or a venue's own (combat/data/skins-quota.mjs boons, by these ids)
const BASE_BOONS = ["edge", "frame", "wind", "footwork"];
// modifiers for replay: each changes the world or Lamb and is part of the record's key
export const MODS = {
  frost: { terms: { frost: 1 } }, fog: { terms: { fog: 0.8 } }, rain: { terms: { rain: 1 } }, dark: { blackout: true },
  frail: { lamb: { hp: 0.7 } }, glass: { lamb: { hp: 0.5 }, foe: { dmg: 0.8 } },
};

// skin: a venue of The Quota's arena (combat/data/skins-quota.mjs: bread, club): its names, kits, bosses and
// boons over the same engine; no skin is Low Water's arena as built.
export function createRun({ seed = 1, mods = [], start = {}, storage = null, skin = null, onRecord = null } = {}) {
  const SK = skin ? SKINS[skin] : null; if (skin && !SK) throw new Error(`arena: no skin ${skin}`);
  const bosses = SK ? SK.bosses : LADDER.bosses, boonIds = SK ? Object.keys(SK.boons) : BASE_BOONS;
  const S = { seed, mods, round: 1, wave: 0, levels: { ...(start.levels || {}) }, tool: start.tool || "w.case", temper: 0, boons: {}, hp: null, over: false, offer: null, cleared: 0, plan: null, log: [], records: [] };
  const r = (k) => rand01(seed >>> 0, `${k}`);
  const M = createMetrics();
  const isBoss = (n) => n % LADDER.bossEvery === 0;
  function planRound(n) {
    if (isBoss(n)) return [{ boss: bosses[(n / LADDER.bossEvery - 1) % bosses.length], lvl: Math.floor((n - 1) / (LADDER.bossEvery * bosses.length)) }];
    const waves = [];
    for (let w = 0; w < LADDER.waves(n); w++) {
      let budget = LADDER.budget(n, w); const foes = [], open = Object.entries(POOL).filter(([, [, from]]) => from <= n);
      for (let k = 0; budget > 0 && foes.length < LADDER.maxLive && k < 20; k++) {
        const fit = open.filter(([, [c]]) => c <= budget); if (!fit.length) break;
        const [style, [cost]] = fit[Math.floor(r(`pick:${n}:${w}:${k}`) * fit.length)];
        const el = n >= LADDER.eliteFrom && cost * 2 <= budget && r(`elite:${n}:${w}:${k}`) < LADDER.eliteChance(n);
        foes.push([style, el]); budget -= el ? cost * 2 : cost;
        if ((style === "swarm" || style === "hound") && budget >= cost && foes.length < LADDER.maxLive) { foes.push([style, false]); budget -= cost; } // beasts come in pairs
      }
      waves.push({ foes });
    }
    return waves;
  }
  function offers() {
    const out = [], take = (o) => { if (!out.some((x) => x.id === o.id)) out.push(o); };
    for (let k = 0; out.length < 3 && k < 20; k++) {
      const x = r(`offer:${S.round}:${k}`);
      if (x < 0.3) { const lv = LEVELS[Math.floor(r(`lv:${S.round}:${k}`) * LEVELS.length)]; take({ id: `level:${lv}`, kind: "level", lv }); }
      else if (x < 0.6) { const b = boonIds[Math.floor(r(`boon:${S.round}:${k}`) * boonIds.length)]; take({ id: `boon:${b}`, kind: "boon", boon: b, ...(SK ? { name: SK.boons[b].name, from: SK.boons[b].from } : {}) }); }
      else if (x < 0.75) take({ id: "temper", kind: "temper" });
      else if (x < 0.9) { const t = TOOLS[Math.floor(r(`tool:${S.round}:${k}`) * TOOLS.length)]; if (t !== S.tool) take({ id: `tool:${t}`, kind: "tool", tool: t }); }
      else take({ id: "mend", kind: "mend" });
    }
    return out;
  }
  const lamb = () => {
    const d = lambDef(S.levels, S.tool, {}, [], { temper: S.temper });
    for (const m of S.mods) if (MODS[m] && MODS[m].lamb && MODS[m].lamb.hp) d.hp = Math.round(d.hp * MODS[m].lamb.hp);
    const g = (k) => S.boons[k] || 0; // summed boon amounts (focus included)
    if (g("dmg")) d.dmgMul = 1 + g("dmg");
    if (g("hp")) d.hp += g("hp");
    if (g("st")) { d.stamina += g("st"); d.staminaRegen = (d.staminaRegen || 0) * (1 + g("st") / 8); }
    if (g("iframes")) d.bonus = { ...(d.bonus || {}), evade: ((d.bonus || {}).evade || 0) + g("iframes") };
    if (g("read")) d.bonus = { ...(d.bonus || {}), read: ((d.bonus || {}).read || 0) + g("read") }; // the corner man: a telegraph read sooner
    return d;
  };
  const api = {
    state: S, metrics: M,
    stage() {
      if (S.over) return { kind: "over" };
      if (S.offer) return { kind: "offer", choices: S.offer };
      if (!S.plan) { S.plan = planRound(S.round); S.wave = 0; }
      const w = S.plan[S.wave];
      return { kind: "fight", round: S.round, wave: S.wave + 1, waves: S.plan.length, ...(w.boss ? { boss: w.boss, lvl: w.lvl } : { foes: w.foes }) };
    },
    world(G, arena) {
      const st = api.stage(), L = lamb(), terms = Object.assign({}, ...S.mods.map((m) => (MODS[m] || {}).terms || {}));
      for (const [k, v] of Object.entries(terms)) G.env.command(["setTerm", k, String(v)]);
      const at = arena.spawns.lamb, foes = arena.spawns.foes || [], fighters = [fighterSpec("lamb", "lamb", L, at, { face: Math.PI / 2 })];
      if (st.boss) { const b = bossSpec("boss", st.boss, foes[0] || [at[0] + 6, at[1] + 4]); if (st.lvl) { b.def.hp = Math.round(b.def.hp * (1 + 0.4 * st.lvl)); } fighters.push(b); }
      else st.foes.forEach(([style, el], i) => fighters.push(foeSpec(`foe${i}`, style, foes[i % Math.max(1, foes.length)] ? jitter(foes[i % foes.length], i) : [at[0] + 5 + i, at[1] + 4], { elite: el, skin })));
      const foeMul = Object.assign({}, ...S.mods.map((m) => (MODS[m] || {}).foe || {}));
      for (const f of fighters) if (f.team !== "lamb") { if (foeMul.dmg) f.def.dmgMul = foeMul.dmg; if (!st.boss) f.def.hp = Math.max(2, Math.round(f.def.hp * LADDER.foeHp(S.round))); } // the ladder's opponents grow with it
      const W = createWorld({ G, arena: { ...arena, exits: [], blackout: S.mods.some((m) => MODS[m] && MODS[m].blackout) }, fighters, seed: (S.seed * 7919 + S.round * 31 + S.wave) >>> 0, limitFrames: 60 * 240 }); // a ring: no way out but through
      W.summon = summoner(W);
      if (S.hp != null) W.lamb().hp = Math.min(W.lamb().hpMax, S.hp);
      M.begin(W, { round: S.round, wave: S.wave + 1, boss: st.boss || null });
      return W;
    },
    finish(W) {
      M.end(W);
      const L = W.lamb(), out = W.result ? W.result.outcome : "none";
      S.log.push({ round: S.round, wave: S.wave + 1, outcome: out, secs: +(W.tick / 60).toFixed(1), hp: +L.hp.toFixed(1) });
      if (out !== "win" && out !== "yield") { S.over = true; return; }
      S.hp = Math.min(L.hpMax, L.hp + L.hpMax * LADDER.mendWave); S.wave++; // a breath between waves
      if (S.wave >= S.plan.length) { S.picks = isBoss(S.round) ? 2 : 1; S.cleared = S.round; S.round++; S.plan = null; S.hp = Math.min(L.hpMax, S.hp + L.hpMax * LADDER.mendBetween); S.offer = offers(); } // a boss beaten: two picks
    },
    choose(i) {
      const o = S.offer && S.offer[i]; if (!o) return;
      // focus: a level raised that is already the build's highest goes up two, so a committed build reaches
      // the breakpoints at 8 and 10 (sheet breaks) while a spread one stays broad (LADDER.focus)
      if (o.kind === "level") { const lv = (k) => S.levels[k] ?? (k === "coat" ? 2 : 3), top = Math.max(...LEVELS.map(lv)); S.levels[o.lv] = lv(o.lv) + 1 + (LADDER.focus && lv(o.lv) === top && lv(o.lv) >= 5 ? 1 : 0); }
      if (o.kind === "temper") S.temper++;
      if (o.kind === "boon") { const n = (S.taken ||= {})[o.boon] = ((S.taken || {})[o.boon] || 0) + 1, mult = 1 + 0.5 * (n - 1); for (const [k, v] of Object.entries(BOONS[o.boon])) S.boons[k] = +((S.boons[k] || 0) + v * mult).toFixed(3); }
      // a venue's boon marked record: true (the nip of spirit) is written down when it is taken: on the run's
      // record list, shown at the end, and handed to onRecord (the arena page writes it to a story's record)
      if (o.kind === "boon" && SK && SK.boons[o.boon] && SK.boons[o.boon].record) { const ev = { type: "drink.taken", boon: o.boon, name: SK.boons[o.boon].name, from: SK.boons[o.boon].from, round: S.cleared, venue: skin }; S.records.push(ev); if (onRecord) { try { onRecord(ev); } catch (e) { console.error(`arena: onRecord failed for ${ev.type}: ${e.message}`); } } }
      if (o.kind === "tool") { S.tool = o.tool; S.temper = 0; }
      if (o.kind === "mend") S.hp = null;
      S.picks = (S.picks || 1) - 1;
      S.offer = S.picks > 0 ? offers().filter((x) => x.id !== o.id) : null;
    },
    skin: SK, arena: SK ? SK.arena : null,
    summary() { return { seed: S.seed, skin, mods: S.mods, cleared: S.cleared, reached: S.round, tool: S.tool, temper: S.temper, levels: S.levels, boons: S.boons, log: S.log, records: S.records, metrics: M.report() }; },
    // personal records: the best round and each boss's fastest kill, per seed and modifiers, on this machine only
    record() {
      if (!storage) return null;
      const key = `lw.arena.records`, all = safeGet(storage, key), id = `${S.seed}|${[...S.mods].sort().join(",")}`, cur = all[id] || { best: 0, bosses: {} };
      cur.best = Math.max(cur.best, S.cleared);
      for (const b of M.report().bosses) if (b.outcome === "win") cur.bosses[b.boss] = Math.min(cur.bosses[b.boss] ?? Infinity, b.secs);
      all[id] = cur; safeSet(storage, key, all); return cur;
    },
  };
  return api;
}
const jitter = (p, i) => [p[0] + (i % 2 ? 0.6 : -0.6), p[1] + (i > 1 ? 0.8 : 0)];
function safeGet(st, k) { try { return JSON.parse(st.getItem(k) || "{}"); } catch (e) { console.warn(`arena records: ${e.message}`); return {}; } }
function safeSet(st, k, v) { try { st.setItem(k, JSON.stringify(v)); } catch (e) { console.warn(`arena records: ${e.message}`); } }
