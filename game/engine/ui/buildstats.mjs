// Every build number the Build page shows (design/UI-SYSTEM.md 7.2a), read from the combat
// engineer's own functions so the page can never disagree with the fight: lambDef (the derived
// numbers, the load, the build bonus, the tempo) and fighterSpec (Lamb's final move table, after
// the build, learned moves and tempo are applied). Owned by the UI and UX lead; pure, no state.
//   const now = buildOf(G), plan = buildOf(G, { levels: { grip: +1 } })   levels are deltas
//   const rows = statRows(now, plan)   [{ key, group, label, now, to, unit, better, plain, frames }]
import { lambDef, fighterSpec, learnedFromFlags } from "../combat/roster.mjs";
import { TOOLS21, CLOTHING, LOAD } from "../combat/data/build.mjs";

// The sheet's keys that the fight reads (combat/roster.mjs lambDef).
export const COMPARTMENTS = ["coat", "nose", "pen", "hat"];
export const FIGHT_VOICES = ["grip", "ballast", "knees", "pride", "sum", "dark", "salt", "carbon", "precedent", "undertow", "condolence", "formletter", "hearsay", "smell"];
export const PILLAR = { coat: "Endure", nose: "Evade", pen: "Read", hat: "End" };
export const PILLAR_WORDS = {
  coat: "Standing, the load you can carry, heavy tools; strikes land and stagger you less",
  nose: "Dodge windows, how fast you move out of the way, footing in the wet",
  pen: "Read the blow before it comes, find the weak point, spend less Breath",
  hat: "People give in sooner; Composure for learned moves and talk exits",
};
const safe = (fn, d) => { try { const v = fn(); return Number.isFinite(v) ? v : d; } catch (e) { console.warn(`buildstats: ${e.message}; using ${d}`); return d; } };

// The sheet as the fight reads it, plus deltas from a plan.
export function levelsOf(G, delta = {}) {
  const rs = G.rs, S = G.sheet, P = G.pressure, L = {};
  for (const k of COMPARTMENTS) if (rs.attrs[k]) L[k] = safe(() => S.attr(k), 3);
  for (const k of FIGHT_VOICES) if (rs.skills[k]) L[k] = safe(() => S.skill(k), 3);
  for (const k of ["wear", "cold", "dread"]) L[k] = safe(() => P.meter(k), 0);
  L.wet = safe(() => G.body.wet(), 0);
  for (const [k, d] of Object.entries(delta)) L[k] = (L[k] ?? 3) + d;
  return L;
}

export function equipped(G) {
  const eq = (G.state.inv || {}).equipped || {};
  const hand = eq.hand && TOOLS21[eq.hand] ? eq.hand : "w.case";
  const gear = Object.entries(eq).filter(([slot, id]) => slot !== "hand" && id && CLOTHING[id]).map(([, id]) => id);
  return { tool: hand, gear };
}

export function buildOf(G, { levels = {}, tool = null, gear = null, temper = null, fitting = null } = {}) {
  const L = levelsOf(G, levels), eq = equipped(G), t = tool || eq.tool, gr = gear || eq.gear;
  const tools = ((G.state.ext || {}).combat || {}).tools || {};
  const ts = tools[t], tp = temper ?? (typeof ts === "number" ? ts : (ts && ts.temper) || 0);
  const ft = fitting ?? (ts && typeof ts === "object" ? ts.fitting || null : null);
  const learned = learnedFromFlags(G.state.flags || []);
  const def = lambDef(L, t, {}, learned, { gear: gr.length ? gr : undefined, temper: tp, fitting: ft });
  const spec = fighterSpec("lamb", "lamb", def, [0, 0]);
  return { L, tool: t, gear: gr, temper: tp, fitting: ft, def, moves: spec.moves, set: spec.def.moveset };
}

const total = (m) => (m ? (m.startup || 0) + (m.active || 0) + (m.recovery || 0) : 0);
const span = (w) => (w ? w[1] - w[0] + 1 : 0);
const dist = (m) => (m && m.root ? m.root.reduce((s, [a, b, v]) => s + ((b - a) * v) / 60, 0) : 0);
const FORM = { light: "dash", medium: "roll", heavy: "hop", over: "hop" };

// The rows, in groups. better: 1 when higher is better, -1 when lower is better, 0 for words.
// plain: shown in the Plain density. frames: also shown in milliseconds.
function rowsOf(B) {
  const d = B.def, b = d.bonus || {}, m = B.moves, s = B.set, t = d.tempo || {};
  const band = d.loadInfo ? d.loadInfo.band : d.load;
  const light = m[s.light], heavy = m[s.heavy], charged = m["lamb:heavy_charged"], cat = m[s.catch];
  const dodge = m[(s.roll || {})[band === "over" ? "heavy" : band]], step = m[s.step], art = s.art ? m[s.art] : null;
  const r = [];
  const add = (group, key, label, v, o = {}) => r.push({ group, key, label, v, unit: o.unit || "", better: o.better ?? 1, plain: !!o.plain, frames: !!o.frames, digits: o.digits ?? (Number.isInteger(v) ? 0 : 1) });
  add("Body", "standing", "Standing", d.hp, { plain: true });
  add("Body", "breath", "Breath", d.stamina, { plain: true });
  add("Body", "regen", "Breath back /s", d.staminaRegen, { digits: 2 });
  add("Body", "poise", "Poise", d.poise);
  add("Body", "composure", "Composure", d.composureMax, { plain: true });
  add("Body", "protection", "Protection", d.protection);
  add("Body", "soften", "Blow softened", Math.round((1 - (d.soften ?? 1)) * 100), { unit: "%" });
  if (t.stun) add("Body", "stun", "Staggered for", Math.round(t.stun * 100), { unit: "%", better: -1 });
  if (d.loadInfo) add("Load", "load", "Weight carried", +d.loadInfo.weight.toFixed(1), { unit: ` of ${+d.loadInfo.limit.toFixed(1)}`, better: -1, digits: 1 });
  add("Load", "band", "Load", band, { better: 0, plain: true });
  add("Load", "form", "Your dodge", FORM[band] || band, { better: 0, plain: true });
  add("Load", "recovery", "Breath recovery", Math.round(((LOAD.regen || {})[band] || 1) * 100), { unit: "%" });
  if (dodge) {
    add("Footwork", "dodge.i", `${FORM[band] || "Dodge"}: untouchable`, span(dodge.iframes), { unit: " f", frames: true });
    add("Footwork", "dodge.t", `${FORM[band] || "Dodge"}: whole move`, total(dodge), { unit: " f", frames: true, better: -1 });
    add("Footwork", "dodge.d", `${FORM[band] || "Dodge"}: distance`, +dist(dodge).toFixed(2), { unit: " m", digits: 2 });
    add("Footwork", "dodge.b", `${FORM[band] || "Dodge"}: Breath`, dodge.stamina, { better: -1 });
  }
  if (step) {
    add("Footwork", "step.i", "Sidestep: untouchable", span(step.iframes), { unit: " f", frames: true });
    add("Footwork", "step.t", "Sidestep: whole move", total(step), { unit: " f", frames: true, better: -1 });
  }
  if (t.dodge) add("Footwork", "tempo.d", "Footwork tempo", Math.round(100 / t.dodge), { unit: "%" });
  add("Tool", "met", "Requirements", b.met === false ? "not met" : "met", { better: 0, plain: true });
  if (light) {
    add("Tool", "light.su", "Light: frames to land", light.startup, { unit: " f", frames: true, better: -1 });
    add("Tool", "light.t", "Light: whole move", total(light), { unit: " f", frames: true, better: -1 });
    add("Tool", "light.dmg", "Light: damage", +(light.dmg || 0).toFixed(2), { digits: 2 });
    add("Tool", "light.p", "Light: poise damage", +(light.poise || 0).toFixed(2), { digits: 2 });
    add("Tool", "light.b", "Breath a swing", +(light.stamina || 0).toFixed(2), { better: -1, digits: 2 });
  }
  if (heavy) {
    add("Tool", "heavy.su", "Heavy: frames to land", heavy.startup, { unit: " f", frames: true, better: -1 });
    add("Tool", "heavy.t", "Heavy: whole move", total(heavy), { unit: " f", frames: true, better: -1 });
    add("Tool", "heavy.dmg", "Heavy: damage", +(heavy.dmg || 0).toFixed(2), { digits: 2 });
    add("Tool", "heavy.p", "Heavy: poise damage", +(heavy.poise || 0).toFixed(2), { digits: 2 });
  }
  if (charged) add("Tool", "charged.dmg", "Charged heavy: damage", +(charged.dmg || 0).toFixed(2), { digits: 2 });
  if (cat && cat.parry) {
    add("Tool", "catch.w", "Catch window", span(cat.parry), { unit: " f", frames: true, plain: false });
    add("Tool", "catch.su", "Catch opens at", cat.parry[0], { unit: " f", frames: true, better: -1 });
  }
  if (t.swing) add("Tool", "tempo.s", "Swing tempo", Math.round(100 / t.swing), { unit: "%" });
  if (art && art.composure) add("Tool", "art", "Tool art: Composure", art.composure, { better: -1 });
  add("Read and end", "read", "Read earlier", +(b.read || 0).toFixed(1), { unit: " f", frames: true });
  add("Read and end", "weak", "Weak point", Math.round((b.weak || 0) * 100), { unit: "%" });
  add("Read and end", "end", "Yield raised by", +(b.end || 0).toFixed(2), { unit: " Standing", digits: 2 });
  return r;
}

// Rows for now, with a planned value where it differs.
export function statRows(now, plan = null) {
  const a = rowsOf(now), b = plan ? rowsOf(plan) : null;
  const byKey = b ? Object.fromEntries(b.map((x) => [x.key, x])) : {};
  return a.map((x) => { const y = byKey[x.key]; return { ...x, now: x.v, to: y && y.v !== x.v ? y.v : null }; });
}

// A comparison of two builds over the same rows (gear side by side).
export function compareRows(a, b) {
  const A = rowsOf(a), Bk = Object.fromEntries(rowsOf(b).map((x) => [x.key, x]));
  return A.map((x) => ({ ...x, now: x.v, other: Bk[x.key] ? Bk[x.key].v : null }));
}

// Whether a change is better for Lamb (1), worse (-1) or neither (0).
export function verdict(row, from, to) {
  if (typeof from !== "number" || typeof to !== "number" || !row.better) return 0;
  return Math.sign((to - from) * row.better);
}
export const fmtNum = (v, digits = 0) => (typeof v === "number" ? v.toFixed(digits) : String(v));
export const ms = (frames) => `${Math.round((frames * 1000) / 60)} ms`;
