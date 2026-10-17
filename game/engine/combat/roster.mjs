// Builds fighters from the game's numbers: Lamb from the one sheet (SYSTEMS-FULL section 19: four
// compartments as combat pillars, voices scaling tools, clothing, temper, fittings, learned moves)
// and opponents from @foe records and an archetype (data/foes.mjs).
import { profileOf, buildToolMoves } from "./data/tools.mjs";
import { BODY, BODY_MOVESET } from "./data/body.mjs";
import { SPECIALS, ARCHETYPES } from "./data/foes.mjs";
import { RULES } from "./data/common.mjs";
import { createBrain } from "./ai/brain.mjs";
import { soft, DERIVED as D, GRADES, TOOLS21, FITTINGS, CLOTHING, START_GEAR, LOAD, TEMPER_STEP, COMPOSURE } from "./data/build.mjs";
import { LEARNED } from "./data/learned.mjs";
import { artMoves, runMove } from "./data/arts.mjs";
import { tempoOf, tempoMoves } from "./sim/tempo.mjs";

// Breath recovers 55% of the bar a second after a 30-frame pause (COMBAT-FEEL v2 2); opponents
// 1.4 times faster with no load penalty, so a lone one can finish a Lamb who stands still.
export const BREATH = { regenShare: 0.55, delay: 30, foe: 1.4 };
export const FOE_WINDUP = 1.6;
export const loadBand = (load) => (load <= RULES.loadBands[0] ? "light" : load <= RULES.loadBands[1] ? "medium" : "heavy");
export const learnedFromFlags = (flags = []) => [...new Set(flags.map((f) => (/\.move_(\w+)$/.exec(f) || [])[1]).filter(Boolean))];
export const LEARNABLE = Object.keys(LEARNED);
const up = (L, k) => Math.max(0, soft(L[k] ?? 3) - 3);

// A tool as Lamb holds it: its class profile, its own overrides, its fitting.
export function lambTool(toolId, fitting = null) {
  const T = TOOLS21[toolId] || TOOLS21["w.hands"], P = { ...profileOf(toolId, { cls: T.cls }), ...(T.over || {}), id: toolId };
  if (P.special === "pull" || P.special === "sweep") P.special = "none"; // taught (hookpull, sweep), not given
  const f = fitting && (T.fittings || []).includes(fitting) ? FITTINGS[fitting] : null;
  if (!f) return P;
  return { ...P, fitting, speed: P.speed * (f.speed || 1), light: P.light.map((v) => v * (f.light || 1)), heavy: P.heavy.map((v) => v * (f.heavy || 1)), special: f.special || P.special, rainProof: !!f.rainProof, rings: !!f.rings };
}

export const meets = (L, needs = {}) => shortfall(L, needs) === 0;
export const shortfall = (L, needs = {}) => Object.entries(needs).reduce((m, [k, n]) => Math.max(m, n - (L[k] ?? 3)), 0);

// What the build buys with this tool (19.2, 19.3): damage by the two scaling voices, poise
// damage by GRIP, the case's catch by PRIDE, cheaper swings by SUM, longer dodge windows by THE
// DARK and SALT (less in a heavy load), the read window by UNDERTOW and CARBON, the weak point by
// CARBON and PRECEDENT, and the yield line opponents reach sooner by the HAT voices.
export function buildBonus(L, toolId = "w.hands", temper = 0, band = "medium") {
  const T = TOOLS21[toolId] || TOOLS21["w.hands"], short = shortfall(L, T.needs), met = short === 0;
  // a harsh shortfall (CHARACTER-BUILDING 3, adapted): one point under keeps 35% of the scaling, two or more 20%
  const keep = short === 0 ? 1 : short === 1 ? 0.35 : 0.2;
  const scale = keep * Object.entries(T.scale).reduce((s, [v, g]) => s + GRADES[g] * up(L, v), 0);
  const caseClass = T.cls === "shield";
  return {
    met, dmg: (1 + scale) * (1 + TEMPER_STEP.dmg * temper), poise: (1 + 0.1 * up(L, "grip")) * (1 + TEMPER_STEP.poise * temper),
    catch: caseClass ? Math.floor(up(L, "pride") * D.pride.perCatch) : 0, roll: 1 + 0.06 * up(L, "knees"),
    breath: 1 - Math.min(D.sumOff.max, D.sumOff.per * up(L, "sum")),
    evade: Math.round(Math.min(D.evade.max, Math.max(0, soft(L.dark ?? 3) + soft(L.salt ?? 3) - 6) * D.evade.per) + (band === "heavy" || band === "over" ? D.evade.heavy : 0)),
    read: Math.min(D.read.max, Math.max(0, soft(L.undertow ?? 3) + soft(L.carbon ?? 3) - 6) * D.read.per),
    weak: 0.15 + Math.min(D.weak.max, Math.max(0, soft(L.carbon ?? 3) + soft(L.precedent ?? 3) - 6) * D.weak.per),
    end: Math.min(D.end.max, Math.max(0, soft(L.condolence ?? 3) + soft(L.formletter ?? 3) + soft(L.hearsay ?? 3) - 9) * D.end.per),
  };
}

// Load (19.6): tool and clothing weight (a soaked coat counts its soaked weight) against 6 + 2.5 x COAT.
export function loadOf(L, tool, gear = START_GEAR) {
  const wet = (L.wet ?? 0) > 0.5, weight = tool.weight + gear.reduce((s, g) => s + ((CLOTHING[g] || {})[wet ? "soaked" : "weight"] || 0), 0);
  const limit = LOAD.base + LOAD.perCoat * soft(L.coat ?? 2), share = weight / limit, b = LOAD.bands;
  return { weight, limit, share, band: share < b[0] ? "light" : share < b[1] ? "medium" : share <= b[2] ? "heavy" : "over" };
}

// levels: the compartments (coat nose pen hat) and voices (grip ballast knees pride sum dark salt
// carbon precedent undertow condolence formletter hearsay smell), meters (wear cold dread), wet.
export function lambDef(levels = {}, toolId = "w.case", over = {}, learned = [], { gear = START_GEAR, temper = 0, fitting = null, items = null } = {}) {
  const L = { coat: 2, nose: 3, pen: 3, hat: 3, grip: 3, ballast: 3, knees: 3, wear: 0, cold: 0, dread: 0, wet: 0, ...levels };
  const tool = lambTool(toolId, fitting), ld = loadOf(L, tool, gear), load = ld.band === "over" ? "heavy" : ld.band, b = buildBonus(L, toolId, temper, ld.band);
  const protection = gear.reduce((s, g) => s + ((CLOTHING[g] || {}).protection || 0), 0);
  const stamina = Math.max(2, D.breath.base + soft(L.knees) + soft(L.nose) * D.breath.nose - Math.floor(L.cold / 3));
  return {
    kind: "lamb", hp: D.standing.base + D.standing.perCoat * soft(L.coat) + protection, stamina, poise: Math.max(1, soft(L.ballast) + protection * 0.5), grip: L.grip, tool,
    levels: L, bonus: b, gear, temper, fitting, loadInfo: ld, protection, soften: 1 - protection / (protection + D.protectionK),
    composureMax: D.composure.base + D.composure.perHat * soft(L.hat),
    staminaRegen: stamina * BREATH.regenShare * LOAD.regen[ld.band] * (L.wear >= 6 ? 0.75 : 1), staminaDelay: BREATH.delay,
    speed: 3.3, accel: 28, turn: 14, radius: 0.38, height: 1.95, view: L.dread >= 7 ? 0.7 : 1, sight: "eyes",
    load, slow: !b.met, art: (TOOLS21[toolId] || TOOLS21["w.hands"]).art, tempo: tempoOf(L, ld.band),
    items: items || { lantern: 1, bottle: 1 }, lantern: 5, faction: null, char: "lamb", learned, ...over,
  };
}

const kv = (rec, k) => { const x = rec && rec.kv && rec.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
const yieldsAt = (s) => { const m = /standing\s*<=\s*([\d.]+)/.exec(s || ""); return m ? +m[1] : null; };

// An opponent from its @foe record (or a plain object with the same keys) and an archetype.
export function foeDef(rec, style, over = {}) {
  const A = ARCHETYPES[style], d = A.defaults, get = (k) => (rec && rec.kv ? kv(rec, k) : rec && rec[k]);
  const toolId = get("tool") || d.tool, tool = profileOf(toolId), stamina = +(get("breath") || d.breath);
  return {
    kind: style, name: get("name") || style, hp: +(get("standing") || d.standing), stamina, poise: +(get("poise") || d.poise), grip: d.grip, tool,
    staminaRegen: stamina * BREATH.regenShare * BREATH.foe, staminaDelay: BREATH.delay, speed: d.speed, accel: d.accel, turn: d.turn, radius: d.radius, height: d.height,
    sight: get("sight") || "eyes", view: 1, load: loadBand(tool.weight), slow: false, yields: yieldsAt(get("yields")),
    faction: get("faction") || null, char: get("char") || null, items: { ...A.items }, lantern: 0, style, ...over,
  };
}

// Lamb's own copies: strikes by the build, the case's catch by PRIDE, swings cheaper by SUM, and
// footwork with its own ids (lamb:roll ...) and windows lengthened by THE DARK and SALT.
function strengthen(moves, p, b) {
  const out = {};
  for (const [id, m] of Object.entries(moves)) {
    if (id.startsWith(p) && m.dmg) out[id] = { ...m, dmg: m.dmg * b.dmg, poise: m.poise * (b.poise || 1), stamina: m.stamina * b.breath };
    if (id.startsWith(p) && m.parry && b.catch) out[id] = { ...m, active: m.active + b.catch, parry: [m.parry[0], m.parry[1] + b.catch] };
    if (!id.startsWith(p) && m.kind === "dodge" && m.root) {
      const total = (m.startup || 0) + (m.active || 0) + (m.recovery || 0);
      const win = m.iframes ? [m.iframes[0], Math.min(m.iframes[1] + b.evade, total - 2)] : null;
      out[`${p}${id}`] = { ...m, anim: m.anim || id, iframes: win && win[1] >= win[0] ? win : m.iframes, root: m.root.map(([f0, f1, v]) => [f0, f1, v * b.roll]) };
    }
  }
  return out;
}

// Learned variants (data/learned.mjs): a copy of the move they ride on, patched, with its cost.
function learnedVariants(moves, p, def) {
  const out = {}, variants = {}, cls = def.tool.cls;
  for (const name of def.learned || []) {
    const L = LEARNED[name]; if (!L || L.kind !== "variant" || L.of === "tap" || (L.tools && !L.tools.includes(cls))) continue;
    const baseId = { heavy: `${p}heavy`, shove: "shove", step: `${p}step`, use: "use_rope" }[L.of], base = moves[baseId]; if (!base) continue;
    const m = { ...base, ...L.patch, composure: L.cost, anim: `${base.anim || L.of}.${name}` };
    if (L.patch.wide && m.hits) m.hits = m.hits.map((h) => ({ ...h, arc: [-L.patch.wide, L.patch.wide] }));
    if (L.patch.behind) m.root = [[0, 14, 11]];
    if (L.patch.snare) m.item = { use: "rope", proj: { speed: 10, mass: 1.5, dmg: 0.3, poise: 2, r: 0.45, knockdown: true, parryable: false, blockable: false, snare: true } };
    out[`${p}${name}`] = m; (variants[L.of] ||= []).push(`${p}${name}`);
  }
  return { moves: out, variants };
}

// The feint: the heavy's wind-up, cut short by an early release into a quick strike.
function addFeint(moves, p, P) {
  const h = moves[`${p}heavy`], l = moves[`${p}light_1`];
  moves[`${p}feint`] = { ...l, startup: 8, recovery: l.recovery + 4, dmg: l.dmg * 0.8, poise: l.poise * 1.2, next: {}, cancel: { step: l.cancel.step, roll: l.cancel.roll }, composure: LEARNED.feint.cost, anim: `${P.cls}.feint` };
  moves[`${p}heavy`] = { ...h, tap: { before: 8, into: `${p}feint` } };
}

const ownFootwork = (set, p) => ({ ...set, step: `${p}${set.step}`, roll: Object.fromEntries(Object.entries(set.roll).map(([k, v]) => [k, `${p}${v}`])) });

// A fighter spec for createWorld. brain: true gives the archetype's brain.
export function fighterSpec(id, team, def, at, { face = 0, brain = false } = {}) {
  const p = `${id}:`, hands = profileOf("w.hands");
  const windup = team === "lamb" ? 1 : FOE_WINDUP, b = def.bonus || { dmg: 1, poise: 1, catch: 0, roll: 1, breath: 1, evade: 0 };
  const moves = { ...buildToolMoves(def.tool, { prefix: p, slow: def.slow, windup }), ...buildToolMoves(hands, { prefix: `${p}hands:`, windup }), ...BODY };
  let variants = {};
  if (team === "lamb") {
    Object.assign(moves, strengthen(moves, p, b));
    if ((def.learned || []).includes("feint")) addFeint(moves, p, def.tool);
    Object.assign(moves, artMoves(def.tool, def.art, p), runMove(def.tool, p));
    const lv = learnedVariants(moves, p, def); Object.assign(moves, lv.moves); variants = lv.variants;
    if (def.tempo) Object.assign(moves, tempoMoves(moves, p, def.tempo));
  }
  const A = def.style && ARCHETYPES[def.style];
  if (A) for (const s of A.specials) moves[s] = SPECIALS[s];
  const base = { ...BODY_MOVESET, light: `${p}light_1`, heavy: `${p}heavy`, catch: `${p}catch` };
  const moveset = team === "lamb" ? { ...ownFootwork(base, p), art: moves[`${p}art`] ? `${p}art` : null, run: `${p}run`, use: ["use_lantern", "use_bottle", "use_rope", "use_salt"] } : base;
  const handset = { light: `${p}hands:light_1`, heavy: `${p}hands:heavy`, catch: `${p}hands:catch` };
  return { id, team, x: at[0], z: at[1], face, def: { ...def, moveset, hands: handset, variants }, moves, brain: brain && A ? createBrain(A.brain) : null };
}
export { COMPOSURE };
