// Every build number the Build page shows (design/UI-SYSTEM.md 7.2a), read from the combat layer's
// own preview, G.ext.combat.preview(levels, tool, opts), so the page can never disagree with the
// fight and never reads combat's internals. Owned by the UI and UX lead; pure, no state.
//   const now = buildOf(G), plan = buildOf(G, { levels: { grip: +1 } })   levels are deltas
//   const rows = statRows(now, plan)   [{ key, group, label, now, to, unit, better, plain, frames }]
// opts (gear, temper, fitting) are passed through; until preview applies them (it says so in
// `applied`), a comparison of clothes, temper or a fitting is marked as not previewed.

// The sheet's keys the fight reads (SYSTEMS-FULL 19.2): the four compartments and the voices.
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

// The sheet as the fight reads it (absolute levels), plus deltas from a plan.
export function levelsOf(G, delta = {}) {
  const rs = G.rs, S = G.sheet, L = {};
  for (const k of COMPARTMENTS) if (rs.attrs[k]) L[k] = safe(() => S.attr(k), 3);
  for (const k of FIGHT_VOICES) if (rs.skills[k]) L[k] = safe(() => S.skill(k), 3);
  for (const [k, d] of Object.entries(delta)) L[k] = (L[k] ?? 3) + d;
  return L;
}

export function buildOf(G, { levels = {}, tool = null, gear = null, temper = null, fitting = null, plan = false } = {}) {
  const C = G.ext && G.ext.combat; if (!C || !C.preview) return null;
  const opts = {}; if (gear) opts.gear = gear; if (temper != null) opts.temper = temper; if (fitting) opts.fitting = fitting;
  const asked = Object.keys(opts);
  const p = C.preview(plan || Object.keys(levels).length ? levelsOf(G, levels) : null, tool, asked.length ? opts : undefined);
  const applied = p && p.applied ? asked.every((k) => k in p.applied) : asked.length === 0;
  return { p, tool: tool || (p && p.tool) || null, applied };
}
const STARTING = { "w.case": "The claims case", "w.hands": "Bare hands" }; // what Lamb holds before content gives a tool
export const toolName = (G, id) => (G.rs.items[id] && G.rs.items[id].name) || STARTING[id] || id;

const FORM = { roll_dash: "dash", roll: "roll", roll_hop: "hop", lurch: "lurch" };

// The rows, in groups. better: 1 when higher is better, -1 when lower is better, 0 for words.
function rowsOf(B) {
  const p = B.p, f = p.frames || {}, r = [];
  const add = (group, key, label, v, o = {}) => { if (v == null || (typeof v === "number" && !Number.isFinite(v))) return; r.push({ group, key, label, v, unit: o.unit || "", better: o.better ?? 1, plain: !!o.plain, frames: !!o.frames, digits: o.digits ?? (Number.isInteger(v) ? 0 : 1) }); };
  const band = p.load && p.load.band, form = FORM[f.rollForm] || f.rollForm || "dodge";
  add("Body", "standing", "Standing", p.standing, { plain: true });
  add("Body", "breath", "Breath", p.breath, { plain: true });
  add("Body", "poise", "Poise", p.poise);
  add("Body", "composure", "Composure", p.composure, { plain: true });
  if (p.load) add("Load", "load", "Weight carried", +p.load.weight.toFixed(1), { unit: ` of ${+p.load.limit.toFixed(1)}`, better: -1, digits: 1 });
  add("Load", "band", "Load", band, { better: 0, plain: true });
  add("Load", "form", "Your dodge", form, { better: 0, plain: true });
  const mv = (key, label, m, { strike = false, dodge = false } = {}) => {
    if (!m) return;
    if (dodge && m.iframes) add("Footwork", `${key}.i`, `${label}: untouchable`, m.iframes.frames, { unit: " f", frames: true });
    if (strike) add("Tool", `${key}.su`, `${label}: frames to land`, m.startup, { unit: " f", frames: true, better: -1 });
    add(dodge ? "Footwork" : "Tool", `${key}.t`, `${label}: whole move`, m.total, { unit: " f", frames: true, better: -1 });
    if (m.base && m.total) add(dodge ? "Footwork" : "Tool", `${key}.k`, `${label}: tempo`, Math.round((100 * m.base) / m.total), { unit: "%" });
  };
  mv("roll", form[0].toUpperCase() + form.slice(1), f.roll, { dodge: true });
  mv("step", "Sidestep", f.step, { dodge: true });
  add("Tool", "met", "Requirements", p.meets === false ? "not met" : "met", { better: 0, plain: true });
  mv("light", "Light", f.light, { strike: true });
  add("Tool", "light.dmg", "Light: damage", p.light, { digits: 2 });
  mv("heavy", "Heavy", f.heavy, { strike: true });
  add("Tool", "heavy.dmg", "Heavy: damage", p.heavy, { digits: 2 });
  if (typeof p.swingCost === "number") add("Tool", "swing", "Breath a swing", Math.round(p.swingCost * 100), { unit: "%", better: -1 });
  if (f.catch && f.catch.parry) { add("Tool", "catch.w", "Catch window", f.catch.parry.frames, { unit: " f", frames: true }); add("Tool", "catch.su", "Catch opens at", f.catch.parry.from, { unit: " f", frames: true, better: -1 }); }
  if (f.art) add("Tool", "art.t", "Tool art: whole move", f.art.total, { unit: " f", frames: true, better: -1 });
  add("Read and end", "read", "Read earlier", typeof p.read === "number" ? +p.read.toFixed(1) : null, { unit: " f", frames: true });
  add("Read and end", "weak", "Weak point", typeof p.weak === "number" ? Math.round(p.weak * 100) : null, { unit: "%" });
  add("Read and end", "end", "Yield raised by", typeof p.yieldsSooner === "number" ? +p.yieldsSooner.toFixed(2) : null, { unit: " Standing", digits: 2 });
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
  const Bk = Object.fromEntries(rowsOf(b).map((x) => [x.key, x]));
  return rowsOf(a).map((x) => ({ ...x, now: x.v, other: Bk[x.key] ? Bk[x.key].v : null }));
}
export function verdict(row, from, to) {
  if (typeof from !== "number" || typeof to !== "number" || !row.better) return 0;
  return Math.sign((to - from) * row.better);
}
export const fmtNum = (v, digits = 0) => (typeof v === "number" ? v.toFixed(digits) : String(v));
export const ms = (frames) => `${Math.round((frames * 1000) / 60)} ms`;
