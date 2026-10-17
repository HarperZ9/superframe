// The scope every expression and effect runs in: names and calls over the whole game state.
//
// Names, in the order they are tried:
//   clock, hour, time        minutes on the night's clock (compare with hh:mm)
//   place, area, district    current ids;  xp, level, points
//   wet soaked shed warm guise stove shelter bench (Lamb's body and the place, world/body.mjs)
//   runs (true while Tide Runs are on; settings can turn them into fallback checks)
//   attr.X  skill.X  rep.X  res.X  res.X.max  trait.X (status)  quest.X (stage)  project.X
//   meter.X  item.X (count)  var.X  flag.X  run.X (win, lose or "")
//   a declared @var, then a bare skill or attribute name, then an environment term (tide, fog,
//   rain, light, sodium, wind.speed, power.quay, mother, wet ...), then any undeclared variable
//   an effect has set.
// Calls (conditions):  has(flag) at(place) inarea(a) indistrict(d) seen(node) visits(node)
//   said(key) passed(key) failed(key) count(item) worn(item) trait(id) quest(id) rep(f)
//   rumour(fact[, district]) knows(fact[, district]) meter(id) skill(id) attr(id) here(char)
//   min max abs
// Calls (effects):  set(flag) clear(flag) give(item[, n]) take(item[, n]) equip(item)
//   xp(n) offer(trait) research(trait) quest(id, stage) rep(f, n) rumour(fact, district, w)
//   meter(id, n) project(id) wet(n) wait(min) journal("text") heal(res, n) hurt(res, n)
//   sneak(id) (a sneak scene) hide(object) did(object, verb) (a condition: "ok", "fail" or "")
//   seen hidden insneak day daylight (names)  sneak.X (win, seen, ambush, time or "")
//   run(id) (a Tide Run) fight(id) (an encounter, game/engine/combat/) move(char, place) forget(trait) light(place, light, sodium)
import { argOf, valueOf } from "./expr.mjs";

export function createScope(G) {
  const st = () => G.state, rs = G.rs;
  const prefixed = {
    attr: (k) => G.sheet.attr(k), skill: (k) => G.sheet.skill(k), rep: (k) => G.factions.get(k),
    res: (k) => (k.endsWith(".max") ? G.sheet.resMax(k.slice(0, -4)) : G.sheet.res(k)),
    trait: (k) => G.cabinet.status(k), quest: (k) => G.quests.stage(k), project: (k) => G.settlement.done(k),
    meter: (k) => G.pressure.meter(k), item: (k) => G.inv.count(k), var: (k) => varGet(k), flag: (k) => st().flags.includes(k),
    run: (k) => G.runs.outcome(k), sneak: (k) => G.sneaks.outcome(k), seenby: (k) => G.stealth.stateOf(k),
  };
  const varGet = (k) => (k in st().vars ? st().vars[k] : rs.vars[k] ? rs.vars[k].default : undefined);
  const scope = {
    // Is word one of the values the variable declares (@var values:)? name may be var.x or x.
    isWord(name, word) { const v = rs.vars[name.startsWith("var.") ? name.slice(4) : name]; return !!(v && v.values.includes(word)); },
    get(name) {
      switch (name) {
        case "clock": case "hour": case "time": return G.clock();
        case "place": return st().place; case "area": return st().area;
        case "district": { const d = G.world.district(); return d ? d.id : ""; }
        case "xp": return st().sheet.xp; case "level": return st().sheet.level; case "points": return st().sheet.points;
        case "wet": return G.body.wet(); case "soaked": return G.body.soaked(); case "shed": return G.body.shed();
        case "warm": return G.body.warm(); case "guise": return G.body.guise(); case "stove": return G.body.stove();
        case "shelter": return G.body.shelter(); case "bench": return G.body.bench(); case "runs": return !st().runsOff;
        case "inrun": return !!(G.runs && G.runs.current);
        case "seen": return G.stealth.seen(); case "hidden": return G.stealth.hidden();
        case "insneak": return !!(G.sneaks && G.sneaks.current);
        case "carrying": return G.state.carrying || "";
        case "phase": return phaseOf(G);
        default: break;
      }
      const dot = name.indexOf(".");
      if (dot > 0 && prefixed[name.slice(0, dot)]) return prefixed[name.slice(0, dot)](name.slice(dot + 1));
      if (rs.vars[name]) return varGet(name);
      if (rs.skills[name]) return G.sheet.skill(name);
      if (rs.attrs[name]) return G.sheet.attr(name);
      const t = G.env.term(name, st().place);
      if (t !== undefined) return t;
      return name in st().vars ? st().vars[name] : undefined;
    },
    assign(name, v) {
      const dot = name.indexOf("."), pre = dot > 0 ? name.slice(0, dot) : "", k = name.slice(dot + 1);
      if (pre === "rep") return G.factions.set(k, +v);
      if (pre === "res") return G.sheet.setRes(k, +v);
      if (pre === "meter") return G.pressure.addMeter(k, +v - G.pressure.meter(k));
      if (pre === "attr" || pre === "skill") throw new Error(`effects: ${name} cannot be assigned; use xp() and training`);
      st().vars[pre === "var" ? k : name] = v;
      G.emit("var", { name, value: v });
    },
    call(name, args, S) {
      const f = CALLS[name]; if (!f) throw new Error(`expr: unknown function ${name}()`);
      return f(G, args.map((a) => argOf(a, S)), args.map((a) => valueOf(a, S)));
    },
  };
  return scope;
}

const flags = (G) => G.state.flags;
const hm = (s) => { const [h, m] = String(s).split(":").map(Number); return h * 60 + m; };
// dawn, day, dusk or dark from the clock's time of day and the @rules phase-* times
function phaseOf(G) {
  const t = ((G.clock() % 1440) + 1440) % 1440, R = G.rs.rules, P = [["dawn", hm(R["phase-dawn"])], ["day", hm(R["phase-day"])], ["dusk", hm(R["phase-dusk"])], ["dark", hm(R["phase-dark"])]].sort((a, b) => a[1] - b[1]);
  let cur = P[P.length - 1][0]; for (const [n, at] of P) if (t >= at) cur = n; return cur;
}
const CALLS = {
  has: (G, [id]) => flags(G).includes(id),
  at: (G, [id]) => G.state.place === id,
  inarea: (G, [id]) => G.state.area === id,
  indistrict: (G, [id]) => { const d = G.world.district(); return !!d && d.id === id; },
  seen: (G, [id]) => G.memory.visits(id) > 0,
  visits: (G, [id]) => G.memory.visits(id),
  said: (G, [k]) => G.memory.said(k),
  passed: (G, [k]) => !!((G.state.checks || {})[k] || {}).pass,
  failed: (G, [k]) => { const c = (G.state.checks || {})[k]; return !!c && !c.pass; },
  count: (G, [id]) => G.inv.count(id),
  worn: (G, [id]) => G.inv.isWorn(id),
  trait: (G, [id]) => G.cabinet.status(id),
  skill: (G, [id]) => G.sheet.skill(id),
  attr: (G, [id]) => G.sheet.attr(id),
  knows: (G, [f, d]) => G.pressure.knows(f, d),
  here: (G, [id]) => G.people.here(id),
  run: (G, [id]) => G.runs.request(id),
  fight: (G, [id]) => { if (!G.ext || !G.ext.combat) throw new Error(`fight(${id}): combat is not installed`); return G.ext.combat.request(id); },
  move: (G, [id, place]) => G.people.move(id, place),
  forget: (G, [id]) => G.cabinet.forget(id),
  light: (G, [place], [, l, s]) => G.command(["setLight", place, String(l), String(s ?? 0)], "effect"),
  min: (G, _, v) => Math.min(...v), max: (G, _, v) => Math.max(...v), abs: (G, _, [v]) => Math.abs(v),
  // both: read with one argument, change with two
  quest: (G, [id, stage]) => (stage === undefined ? G.quests.stage(id) : G.quests.set(id, stage)),
  rep: (G, [id], [, n]) => (n === undefined ? G.factions.get(id) : G.factions.add(id, +n)),
  meter: (G, [id], [, n]) => (n === undefined ? G.pressure.meter(id) : G.pressure.addMeter(id, +n)),
  rumour: (G, [f, d], [, , w]) => (w === undefined ? G.pressure.rumour(f, d) : G.pressure.addRumour(f, d, +w)),
  // effects
  set: (G, [id]) => G.setFlag(id, true),
  clear: (G, [id]) => G.setFlag(id, false),
  give: (G, [id], [, n]) => G.inv.give(id, n === undefined ? 1 : +n),
  take: (G, [id], [, n]) => G.inv.take(id, n === undefined ? 1 : +n),
  equip: (G, [id]) => G.inv.equip(id),
  xp: (G, _, [n]) => G.sheet.addXp(+n),
  offer: (G, [id]) => G.cabinet.offer(id),
  research: (G, [id]) => G.cabinet.research(id),
  project: (G, [id]) => G.settlement.contribute(id),
  wet: (G, _, [n]) => G.command(["wet", "lamb", String(n)], "effect"),
  wait: (G, _, [n]) => G.advance(+n),
  journal: (G, _, [text]) => G.quests.write("note", "", String(text)),
  heal: (G, [id], [, n]) => G.sheet.setRes(id, G.sheet.res(id) + +n),
  hurt: (G, [id], [, n]) => G.sheet.setRes(id, G.sheet.res(id) - +n),
};
export const KNOWN_CALLS = new Set(Object.keys(CALLS));
// Modules register their own named calls (gates and instructions), as the clean-room
// architecture specs recommend: registerCalls({ name: (G, ids, values) => ... }, { name: "kind" }).
// The id kind tells the validator what the first argument names.
export function registerCalls(calls, idKinds = {}) {
  for (const [name, fn] of Object.entries(calls)) { if (CALLS[name] && CALLS[name] !== fn) throw new Error(`registerCalls: ${name} is already defined`); CALLS[name] = fn; KNOWN_CALLS.add(name); }
  Object.assign(ID_ARG_CALLS, idKinds);
}
export const ID_ARG_CALLS = { fight: "encounter", light: "place", here: "char", run: "run", move: "char", forget: "trait", has: "flag", set: "flag", clear: "flag", at: "place", seen: "node", visits: "node", inarea: "area", indistrict: "district", count: "item", worn: "item", give: "item", take: "item", equip: "item", trait: "trait", offer: "trait", research: "trait", quest: "quest", rep: "faction", meter: "meter", project: "project", skill: "skill", attr: "attr", heal: "resource", hurt: "resource" };
