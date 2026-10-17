// The ruleset: everything content defines besides dialogue, read from LWD records.
// Names come from content; nothing here knows Low Water's attribute or skill names.
//
//   @rules         check-mode, dice, xp-per-level, points-per-level, skill-cap, creation-points,
//                  attr-min, attr-max, cabinet-slots, start-node, start-area, autosave-minutes
//   @attr id       name, short, about, strain (meter n, or rep n: what +1 of strain costs, R1)
//   @skill id      name, short, attr, about, glyph, voice (yes/no), base (expression),
//                  train (no: never takes ranks, as the Kit's instruments, R2)
//   @resource id   name, max, start, on-zero (node)
//   @var id        default, about, values (comma list of words)
//   @trait id      name, about, glyph, research (minutes), while (mod, during research),
//                  mod (after), do (effects on completion), unlock (condition)
//   @item id       name, about, slot, stack, mod, salvage (id n, id n), tags, value,
//                  shed (0..1), warm (0..3), guise (word): clothing in weather (R7),
//                  requires (a condition to wear or wield it: skill.grip >= 6 & level >= 2),
//                  upgrade: n | needs: id n, id n | mod: target +n | about: text  (repeatable:
//                  the action-RPG build layer's gear upgrades, stage n after stage n - 1)
//   @char id       name, speaker, faction, about, role
//   @recipe id     name, in (id n, repeatable), out (id n), tool, when, cost, known
//   @faction id    name, about, start, tier (n Label, repeatable)
//   @modifier id   skill (names or *), mod (n), when, why     environment and situation modifiers
//   @archetype id  name, about, attr (id n), skill (id n), item, trait
//   @quest id      name, about, stage (id: text, repeatable), done (stage id)
//   @hazard id, @project id, @district id, @area id, @meter id: see world/*.mjs
// mod lines everywhere read:  target +n [? condition]   e.g. skill.perception -1 ? fog > 0.05
import { compile, compileEffects } from "../core/expr.mjs";

const num = (v, d = 0) => (v == null || v === "" || isNaN(+v) ? d : +v);
export function parseMod(v, source) {
  const m = String(v).trim().match(/^([\w.*]+)\s*([+-]\s*\d+(?:\.\d+)?)(?:\s*\?\s*(.*))?$/);
  if (!m) throw new SyntaxError(`mod: expected "target +n [? cond]", got ${v}`);
  return { target: m[1], amount: +m[2].replace(/\s/g, ""), cond: compile(m[3]), source };
}
// One upgrade stage of a piece of gear: "2 | needs: s.brass 1 | mod: skill.grip +1 | about: ...".
export function parseUpgrade(v, id) {
  const parts = String(v).split("|").map((s) => s.trim()), n = +parts[0];
  if (!(n >= 1)) throw new SyntaxError(`upgrade: expected "n | needs: ... | mod: ...", got ${v}`);
  const st = { n, needs: [], mods: [], about: "" };
  for (const p of parts.slice(1)) {
    const k = p.indexOf(":"), key = p.slice(0, k).trim(), val = p.slice(k + 1).trim();
    if (key === "needs") st.needs = val.split(",").filter((x) => x.trim()).map((x) => parseCount(x));
    else if (key === "mod") st.mods.push(parseMod(val, `upgrade:${id}:${n}`));
    else if (key === "about") st.about = val;
    else throw new SyntaxError(`upgrade: unknown part "${key}"`);
  }
  return st;
}
export const parseCount = (v) => { const [id, n] = String(v).trim().split(/\s+/); return { id, n: num(n, 1) }; };
const list = (v) => (v ? String(v).split(",").map((s) => s.trim()).filter(Boolean) : []);

const DEFAULT_RULES = {
  "check-mode": "dice", dice: "2d6", "xp-per-level": 100, "points-per-level": 1, "chapter-every": 3, "chapter-attr-max": 10, "travel-minutes": 10, "skill-cap": 4,
  "creation-points": 12, "attr-min": 1, "attr-max": 6, "cabinet-slots": 3, "autosave-minutes": 10,
  "rep-min": -100, "rep-max": 100, "start-node": "", "start-area": "",
  "cabinet-slots-max": 6, "forget-cost": 0, "guise-default": "shelf", "wet-rate": 0.004, "dry-tau": 140, "stove-tau": 50,
  "strain-max": 3,
  // stealth and verbs tuning (world/stealth.mjs, world/sneak.mjs): named so content can retune
  "stealth-seen": 0.22, "stealth-decay": 0.12, "stealth-hear": 0.25, "stealth-sodium": 0.5, "sneak-walk": 1.4, "walk-speed": 1.5, "run-speed": 3.2, "walk-metres-per-minute": 6, "carry-speed": 0.65, "carry-noise": 1.5,
  // day phases for the term phase (clean-room PRESSURE-SYSTEMS 12.5 uses the same four)
  "phase-dawn": "04:00", "phase-day": "09:30", "phase-dusk": "15:30", "phase-dark": "21:00",
  // seconds of game time each displayed line costs (0: content prices beats with cost:)
  "line-seconds": 0,
  "gate-pages": 1, // pages a gate pays on its first resolution (world/gates.mjs)
  // the camera (design/CAMERA.md): closeness against the whole plate, and the talk slide
  "camera-outdoor": 2.25, "camera-room": 1.75, "camera-talk-x": 0.3333,
};
// What strain costs per +1 when an @attr has no strain line: Low Water's compartments
// (design/SYSTEMS-FULL.md 4.3). Any other attribute cannot be strained unless content says so.
export const DEFAULT_STRAIN = { pen: { kind: "meter", id: "wear", cost: 2 }, coat: { kind: "meter", id: "cold", cost: 2 }, nose: { kind: "meter", id: "dread", cost: 2 }, hat: { kind: "rep", id: "", cost: 1 } };
const parseStrain = (v) => { if (!v) return null; const [k, n] = v.trim().split(/\s+/); return k === "rep" || k === "favour" ? { kind: "rep", id: "", cost: num(n, 1) } : k === "no" ? { kind: "none" } : { kind: "meter", id: k, cost: num(n, 2) }; };

export function loadRuleset(book) {
  const R = book.records || {}, errors = [], rs = { rules: { ...DEFAULT_RULES }, attrs: {}, skills: {}, resources: {}, vars: {}, traits: {}, items: {}, recipes: {}, factions: {}, modifiers: [], archetypes: {}, quests: {}, chars: {}, raw: R, errors };
  const each = (kind, fn) => { for (const r of Object.values(R[kind] || {})) { try { fn(r, getter(r)); } catch (e) { errors.push({ file: r.file, line: r.line, msg: `${kind} ${r.id}: ${e.message}` }); } } };
  each("rules", (r) => { for (const { key, value } of r.kv) rs.rules[key] = isNaN(+value) ? value.trim() : +value; });
  if (book.meta && book.meta.start && !rs.rules["start-node"]) rs.rules["start-node"] = book.meta.start;
  each("attr", (r, g) => { rs.attrs[r.id] = { id: r.id, name: g.one("name") || r.id, short: g.one("short") || r.id.slice(0, 3).toUpperCase(), about: g.one("about") || "", strain: parseStrain(g.one("strain")) || DEFAULT_STRAIN[r.id] || { kind: "none" }, order: Object.keys(rs.attrs).length }; });
  each("skill", (r, g) => {
    const attr = g.one("attr"); if (attr && !rs.attrs[attr]) throw new Error(`attr ${attr} is not defined`);
    rs.skills[r.id] = { id: r.id, name: g.one("name") || r.id, short: g.one("short") || g.one("name") || r.id, attr: attr || null, about: g.one("about") || "", glyph: g.one("glyph") || "", voice: g.one("voice") !== "no", base: compile(g.one("base")), train: g.one("train") !== "no", order: Object.keys(rs.skills).length };
  });
  each("resource", (r, g) => { rs.resources[r.id] = { id: r.id, name: g.one("name") || r.id, max: compile(g.one("max") || "10"), start: g.one("start") != null ? compile(g.one("start")) : null, onZero: g.one("on-zero") || null, about: g.one("about") || "" }; });
  each("var", (r, g) => { const d = g.one("default"); rs.vars[r.id] = { id: r.id, default: d == null ? 0 : isNaN(+d) ? (d === "true" ? true : d === "false" ? false : d.trim()) : +d, values: list(g.one("values")), about: g.one("about") || "" }; });
  each("trait", (r, g) => {
    rs.traits[r.id] = { id: r.id, name: g.one("name") || r.id, about: g.one("about") || "", done: g.one("done") || "", glyph: g.one("glyph") || "", research: num(g.one("research"), 60), during: g.all("while").map((v) => parseMod(v, `trait:${r.id}`)), mods: g.all("mod").map((v) => parseMod(v, `trait:${r.id}`)), effects: compileEffects(g.one("do")), unlock: compile(g.one("unlock")) };
  });
  each("item", (r, g) => {
    rs.items[r.id] = { id: r.id, name: g.one("name") || r.id, about: g.one("about") || "", slot: g.one("slot") || null, stack: g.one("stack") === "yes", mods: g.all("mod").map((v) => parseMod(v, `item:${r.id}`)), salvage: list(g.one("salvage")).map(parseCount), tags: list(g.one("tags")), value: num(g.one("value")), glyph: g.one("glyph") || "", shed: num(g.one("shed")), warm: num(g.one("warm")), guise: g.one("guise") || null,
      requires: compile(g.one("requires")), upgrades: g.all("upgrade").map((v) => parseUpgrade(v, r.id)).sort((a, b) => a.n - b.n) };
  });
  each("recipe", (r, g) => { rs.recipes[r.id] = { id: r.id, name: g.one("name") || r.id, in: g.all("in").map(parseCount), out: parseCount(g.one("out") || ""), tool: list(g.one("tool")), when: compile(g.one("when")), cost: num(g.one("cost")), known: compile(g.one("known") || "true"), about: g.one("about") || "" }; });
  each("faction", (r, g) => { rs.factions[r.id] = { id: r.id, name: g.one("name") || r.id, about: g.one("about") || "", start: num(g.one("start")), tiers: g.all("tier").map((v) => { const k = v.trim().indexOf(" "); return { at: +v.trim().slice(0, k), label: v.trim().slice(k + 1) }; }).sort((a, b) => a.at - b.at) }; });
  each("modifier", (r, g) => { rs.modifiers.push({ id: r.id, skills: list(g.one("skill") || "*"), amount: num(g.one("mod")), cond: compile(g.one("when")), why: g.one("why") || r.id }); });
  each("archetype", (r, g) => { rs.archetypes[r.id] = { id: r.id, name: g.one("name") || r.id, about: g.one("about") || "", attrs: Object.fromEntries(g.all("attr").map(parseCount).map((c) => [c.id, c.n])), skills: Object.fromEntries(g.all("skill").map(parseCount).map((c) => [c.id, c.n])), items: g.all("item").map(parseCount), traits: g.all("trait").map((s) => s.trim()) }; });
  each("quest", (r, g) => { rs.quests[r.id] = { id: r.id, name: g.one("name") || r.id, about: g.one("about") || "", stages: g.all("stage").map((v) => { const k = v.indexOf(":"); return k < 0 ? { id: v.trim(), text: "" } : { id: v.slice(0, k).trim(), text: v.slice(k + 1).trim() }; }), done: list(g.one("done")) }; });
  each("char", (r, g) => { rs.chars[r.id] = { id: r.id, name: g.one("name") || r.id, speaker: (g.one("speaker") || r.id).toUpperCase(), faction: g.one("faction") || null, role: g.one("role") || "", about: g.one("about") || "", file: r.file, line: r.line }; });
  checkRefs(rs);
  return rs;
}

function getter(r) {
  return { one: (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; }, all: (k) => r.kv.filter((e) => e.key === k).map((e) => e.value) };
}

function checkRefs(rs) {
  const err = (where, msg) => { const r = where; rs.errors.push({ file: r && r.file, line: r && r.line, msg }); };
  for (const a of Object.values(rs.archetypes)) {
    for (const k of Object.keys(a.attrs)) if (!rs.attrs[k]) err(rs.raw.archetype[a.id], `archetype ${a.id}: attr ${k} is not defined`);
    for (const k of Object.keys(a.skills)) if (!rs.skills[k]) err(rs.raw.archetype[a.id], `archetype ${a.id}: skill ${k} is not defined`);
    for (const it of a.items) if (!rs.items[it.id]) err(rs.raw.archetype[a.id], `archetype ${a.id}: item ${it.id} is not defined`);
    for (const t of a.traits) if (!rs.traits[t]) err(rs.raw.archetype[a.id], `archetype ${a.id}: trait ${t} is not defined`);
  }
  for (const r of Object.values(rs.recipes)) for (const c of [...r.in, r.out, ...r.tool.map((id) => ({ id }))]) if (c.id && !rs.items[c.id]) err(rs.raw.recipe[r.id], `recipe ${r.id}: item ${c.id} is not defined`);
  for (const it of Object.values(rs.items)) for (const c of it.salvage) if (!rs.items[c.id]) err(rs.raw.item[it.id], `item ${it.id}: salvage item ${c.id} is not defined`);
  for (const m of rs.modifiers) for (const s of m.skills) if (s !== "*" && !rs.skills[s]) err(rs.raw.modifier[m.id], `modifier ${m.id}: skill ${s} is not defined`);
  for (const c of Object.values(rs.chars)) if (c.faction && !rs.factions[c.faction]) err(c, `char ${c.id}: faction ${c.faction} is not defined`);
  for (const a of Object.values(rs.attrs)) if (a.strain.kind === "meter" && rs.raw.meter && !rs.raw.meter[a.strain.id]) err(rs.raw.attr[a.id], `attr ${a.id}: strain meter ${a.strain.id} is not defined`);
}

// The tier label for a reputation value.
export function tierOf(faction, value) { let label = ""; for (const t of faction.tiers) if (value >= t.at) label = t.label; return label; }
