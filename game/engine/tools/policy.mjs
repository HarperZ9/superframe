// How each play style chooses, for the playthrough harness (tools/playthrough.mjs), by intent:
// what an option does, never how its label is worded or where it sits in the menu.
// Signals read from the content's own data:
//   the option's verb tag ({verb: hide}), its kind (claim), a check's voice and compartment,
//   what its scenes start (fight, sneak, run; a fight's sneak opening or props), what its effects
//   set (said.* for talk, <district>.move_* lessons, lamp projects, salvage pieces), and whether
//   it leads toward the build's preferred ending (the flags the content's own fate rules read);
//   novelty: an unseen scene first, a scene seen often sinks without limit.
// Ties break by a seeded hash of the option's key, so the menu's order changes nothing; the
// harness also shuffles every menu before choosing (--shuffle-seed) to show it.
import { hashStr } from "../core/rng.mjs";

// Style of each verb (design/REWORK-PLAN.md section 4).
const VERB_STYLE = { hide: "shadow", wait: "shadow", eavesdrop: "shadow", douse: "shadow", throw: "shadow", read: "eye", rig: "hands", pry: "hands", cutpower: "hands", light: "hands", salvage: "hands", weigh: "hands", mark: "hands", wade: "hands", climb: "fist", carry: "fist" };

import { BUILDS as COMBAT_BUILDS } from "../combat/tools/minmax.mjs";
export const BUILDS = {
  fist:   { precedent: "p.wader",      comps: ["coat"],        voices: ["grip", "ballast", "knees", "pride"], weapons: ["w.hammer", "w.pole", "w.boathook", "w.stick"], ending: { fate_lamb: ["keeper", "road"], fate_mother: ["keeper", "crown"] } },
  tongue: { precedent: "p.condoler",   comps: ["hat"],         voices: ["condolence", "formletter", "chit", "hearsay"], ending: { fate_lamb: ["brine", "typist"], fate_mother: ["automated", "keeper"] } },
  shadow: { precedent: "p.nightclerk", comps: ["nose"],        voices: ["dark", "undertow", "smell", "ballast"], ending: { fate_lamb: ["road", "boat"], fate_mother: ["dark", "keeper"] } },
  hands:  { precedent: "p.fitter",     comps: ["coat", "pen"], voices: ["grip", "sum", "carbon"], weapons: ["w.boathook", "w.hammer"], ending: { fate_lamb: ["post", "keeper"], fate_mother: ["bulb", "crown"] } },
  eye:    { precedent: "p.ledger",     comps: ["pen"],         voices: ["sum", "precedent", "smallprint", "carbon"], ending: { fate_lamb: ["typist", "post"], fate_mother: ["crown", "automated"] } },
  // A min-maxed Fist (combat's ask): the fist policy on a sheet pinned at once to combat's focused
  // build (combat/tools/minmax.mjs BUILDS.focused), its tool tempered and fitted. Not an earned sheet.
  fistmax: { precedent: "p.wader",     comps: ["coat"],        voices: ["grip", "ballast", "knees", "pride"], weapons: ["w.hammer", "w.pole", "w.boathook", "w.stick"], ending: { fate_lamb: ["keeper", "road"], fate_mother: ["keeper", "crown"] }, max: COMBAT_BUILDS.focused },
};
// What each build gains from each kind of intent.
const WANT = {
  fist:   { fight: 4, lesson: 5, run: 2, claim: 0, sneak: -1, talk: 0, project: 0, salvage: 0, props: 1, sneakfight: 1 },
  fistmax:{ fight: 4, lesson: 5, run: 2, claim: 0, sneak: -1, talk: 0, project: 0, salvage: 0, props: 1, sneakfight: 1 },
  tongue: { fight: -4, lesson: 0, run: 0, claim: 3, sneak: -1, talk: 3, project: 0, salvage: 0, props: 0, sneakfight: -2 },
  shadow: { fight: -3, lesson: 0, run: 0, claim: 0, sneak: 4, talk: 0, project: 0, salvage: 0, props: 0, sneakfight: 5 },
  hands:  { fight: -1, lesson: 0, run: 3, claim: 0, sneak: 0, talk: 0, project: 5, salvage: 3, props: 4, sneakfight: 0 },
  eye:    { fight: -3, lesson: 0, run: 0, claim: 3, sneak: 0, talk: 0, project: 0, salvage: 0, props: 0, sneakfight: 0 },
};

// The flags each ending value needs, read from the content's own rules: an `if: cond => var =
// value` line gives the has() atoms of its condition that are not negated; an assignment in an
// option's effects gives the value directly.
export function endingFlags(C) {
  const out = {};
  const pos = (ast, neg = false, acc = []) => {
    if (!ast) return acc;
    if (ast.k === "not") return pos(ast.a, !neg, acc);
    if (ast.k === "call" && ast.name === "has" && !neg && ast.args[0] && ast.args[0].k === "id") acc.push(ast.args[0].name);
    for (const k of ["a", "b"]) if (ast[k]) pos(ast[k], neg, acc);
    return acc;
  };
  for (const n of Object.values(C.book.nodes)) for (const s of n.steps) {
    if (s.kind !== "if" || !s.effects) continue;
    for (const st of s.effects.ast.list) if (st.k === "assign" && st.value.k === "id") ((out[st.name] ||= {})[st.value.name] ||= new Set()).add(...pos(s.cond.ast), "");
  }
  return out;
}

// What an option does: the intents its own effects and its scenes carry.
export function intentOf(G, o) {
  const I = new Set(), verb = o.s.attrs && o.s.attrs.verb;
  if (verb && VERB_STYLE[verb]) I.add(`verb:${VERB_STYLE[verb]}`);
  if (o.press && o.style && o.style !== "any") I.add(`verb:${o.style}`); // an interrogation press carries its style
  if (o.kind === "claim") I.add("claim");
  const effects = (eff) => {
    if (!eff) return;
    for (const [name, calls] of eff.calls) for (const args of calls) {
      if (name === "fight") { I.add("fight"); const enc = ((G.book.records || {}).encounter || {})[args[0]]; if (enc) { if (enc.kv.some((e) => e.key === "opening" && /sneak/.test(e.value)) || /\.sneak$/.test(args[0])) I.add("sneakfight"); if (enc.kv.some((e) => e.key === "prop")) I.add("props"); } }
      if (name === "sneak") I.add("sneak"); if (name === "run") I.add("run"); if (name === "project") I.add("project");
      if (name === "give" && /^(s\.|i\.paraffin$)/.test(String(args[0]))) I.add("salvage");
      if (name === "set" && /^said\./.test(String(args[0]))) I.add("talk");
      if (name === "set" && /\.move_\w+$/.test(String(args[0]))) I.add("lesson");
      if (name === "set") I.add(`sets:${args[0]}`);
    }
    // assignments of words and of numbers both (light_mother = 1, fate_lamb = road)
    for (const st of eff.ast.list) if (st.k === "assign" && st.op === "=" && (st.value.k === "id" || st.value.k === "lit")) I.add(`assign:${st.name.replace(/^var\./, "")}=${st.value.k === "id" ? st.value.name : st.value.v}`);
  };
  effects(o.s.effects);
  // the option's scenes, and where they flow without a choice (go, alt, call), two scenes deep
  const seen = new Set(), walk = (id, depth) => {
    const n = id && G.book.nodes[id]; if (!n || seen.has(id)) return; seen.add(id);
    for (const st of n.steps) { effects(st.effects); if (depth > 0 && ["go", "call"].includes(st.kind)) walk(st.value, depth - 1); if (depth > 0 && st.kind === "alt") walk(st.target, depth - 1); }
  };
  walk(o.s.target, 2); walk(o.s.fail, 2);
  return I;
}

// How many choices each scene is from a scene carrying a far intent (a lesson, a fight that opens
// from a sneak, a fight with props, a lamp project): a breadth-first walk backward over every
// link, three choices deep, computed once per act.
const FAR = ["lesson", "sneakfight", "props", "project"], farCache = new WeakMap();
function farMap(G) {
  if (farCache.has(G.book)) return farCache.get(G.book);
  const N = G.book.nodes, into = {}, dist = {};
  const add = (from, to) => { if (to && N[to]) (into[to] ||= []).push(from); };
  for (const n of Object.values(N)) for (const st of n.steps) { add(n.id, st.target); add(n.id, st.fail); if (["go", "call", "else"].includes(st.kind)) add(n.id, st.value); }
  for (const k of FAR) {
    const d = (dist[k] = {}), queue = [];
    for (const n of Object.values(N)) if (n.steps.some((st) => intentOf(G, { s: { target: n.id, attrs: {} }, kind: "opt" }).has(k))) { d[n.id] = 0; queue.push(n.id); }
    while (queue.length) { const id = queue.shift(); if (d[id] >= 3) continue; for (const f of into[id] || []) if (!(f in d)) { d[f] = d[id] + 1; queue.push(f); } }
  }
  farCache.set(G.book, dist); return dist;
}

// The attentive player acts on the hints the town plants (Keel names the leading marks): at the
// Act 2 dawn lamp choice it keeps Mother and a leading-mark pair (the steps post with the
// balance, or the hill lamps with the Old Bulb), choosing the pair the menu can complete; it
// keeps Mother burning when it can; it tends the lamps in its bands and never puts one out.
const PAIRS = [["light_steps", "light_balance"], ["light_hill", "light_bulb"]];
// What the attentive player reads from the content, once per act:
//   loss: scenes that set loss3.mother, and every scene within three choices of one;
//   defend: the place of the wrecker scene at Mother (the scenes the loss scenes are entered from);
//   wants: flags and var values the Act 2 dawn's bulb and balance options require.
const attCache = new WeakMap();
function attData(G) {
  if (attCache.has(G.book)) return attCache.get(G.book);
  const N = G.book.nodes, into = {}, add = (f, t) => { if (t && N[t]) (into[t] ||= []).push(f); };
  for (const n of Object.values(N)) for (const st of n.steps) { add(n.id, st.target); add(n.id, st.fail); if (["go", "call", "else"].includes(st.kind)) add(n.id, st.value); }
  const lossAt = Object.values(N).filter((n) => n.steps.some((s) => s.effects && [...s.effects.calls].some(([nm, cs]) => nm === "set" && cs.some((a) => a[0] === "loss3.mother")))).map((n) => n.id);
  const loss = {}, q = lossAt.map((id) => [id, 0]);
  while (q.length) { const [id, d] = q.shift(); if (id in loss) continue; loss[id] = d; if (d < 2) for (const f of into[id] || []) q.push([f, d + 1]); }
  const placeOf = (id) => { const n = N[id]; const p = n && n.steps.find((s) => s.kind === "place"); return p ? p.value : null; };
  const defend = new Set(lossAt.flatMap((id) => (into[id] || []).map(placeOf)).filter(Boolean));
  // how many choices each scene is from one at a defended place (the way to the mole)
  const toDefend = {}, dq = Object.keys(N).filter((id) => defend.has(placeOf(id))).map((id) => [id, 0]);
  while (dq.length) { const [id, dd] = dq.shift(); if (id in toDefend) continue; toDefend[id] = dd; if (dd < 8) for (const f of into[id] || []) dq.push([f, dd + 1]); }
  const wants = new Set();
  const atoms = (ast) => { if (!ast) return; if (ast.k === "not") return; if (ast.k === "call" && ast.name === "has" && ast.args[0]) wants.add(`sets:${ast.args[0].name}`);
    // the lamp counters that gate the option itself (light_x == 0, gale_lamps < 3) are not goals
    if (ast.k === "cmp" && ast.op === "==" && ast.a.k === "id" && !/(^|\.)(light_\w+|gale_lamps)$/.test(ast.a.name) && (ast.b.k === "id" || ast.b.k === "lit")) wants.add(`assign:${ast.a.name.replace(/^var\./, "")}=${ast.b.k === "id" ? ast.b.name : ast.b.v}`);
    for (const k of ["a", "b"]) if (ast[k]) atoms(ast[k]); };
  for (const n of Object.values(N)) for (const s of n.steps) if ((s.kind === "opt") && s.cond && /light_(bulb|balance) == 0/.test(s.cond.src)) atoms(s.cond.ast);
  // how many choices each scene is from one that hangs the lantern in the Old Light
  const toLantern = {}, lq = Object.values(N).filter((n) => n.steps.some((s) => s.effects && [...s.effects.calls].some(([nm, cs]) => nm === "set" && cs.some((a) => a[0] === "oldlight.lanterns")))).map((n) => [n.id, 0]);
  while (lq.length) { const [id, dd] = lq.shift(); if (id in toLantern) continue; toLantern[id] = dd; if (dd < 8) for (const f of into[id] || []) lq.push([f, dd + 1]); }
  const d = { loss, defend, wants, placeOf, toDefend, toLantern };
  attCache.set(G.book, d); return d;
}

export const attentiveData = (G) => attData(G);

// The gale lamps as a plan: the value of a set of kept lamps is a leading-mark pair (steps post
// with balance, hill with the Old Bulb) worth 10 each, Mother 3 (she must also be defended). An
// option is worth what it adds to the best set still reachable with the slots left, so choosing
// one lamp of a pair counts the pair, and a choice that assigns several lamps at once (the
// town's choice) is valued for the set it makes, once.
const LAMPS = ["light_mother", "light_steps", "light_balance", "light_hill", "light_bulb"];
function planValue(S) {
  return (S.has("light_mother") ? 3 : 0) + (S.has("light_steps") && S.has("light_balance") ? 10 : 0) + (S.has("light_hill") && S.has("light_bulb") ? 10 : 0);
}
function bestFrom(S, slots, offered) {
  let best = planValue(S);
  if (slots <= 0) return best;
  for (const v of offered) if (!S.has(v)) best = Math.max(best, bestFrom(new Set([...S, v]), slots - 1, offered.filter((x) => x !== v)));
  return best;
}
function lampPlan(G, I, menu) {
  const assigns = LAMPS.filter((v) => I.has(`assign:${v}=1`));
  const lit = new Set(LAMPS.filter((v) => +G.scope.get(`var.${v}`) === 1)); if (G.flag("hill3.bearing")) lit.add("light_hill");
  // wiping the board throws away the set kept so far
  if (LAMPS.some((v) => I.has(`assign:${v}=0`)) && planValue(lit) > 0) return -3 - planValue(lit);
  if (!assigns.length) return 0;
  const total = +(G.scope.get("var.gale_lamps") || 0), slots = Math.max(0, 3 - total);
  const offered = [...new Set(menu.flatMap((m) => LAMPS.filter((v) => intentOf(G, m).has(`assign:${v}=1`) && LAMPS.filter((x) => intentOf(G, m).has(`assign:${x}=1`)).length === 1)))];
  const now = bestFrom(lit, slots, offered);
  const after = new Set([...lit, ...assigns]), used = assigns.length === 1 ? 1 : slots; // a multi-lamp choice uses every slot
  return (bestFrom(after, slots - used, offered) - now) * 1.5 + 2; // the +2 makes keeping lamps beat leaving the choice
}
export function attentive(G, I, menu, o = null) {
  let sc = 0;
  const A = attData(G);
  if (o) {
    // defend Mother: near the wreckers' climb, go where they will be; never walk into a loss
    const dist = Math.min(...[o.s.target, o.s.fail].filter(Boolean).map((id) => A.loss[id] ?? 9));
    if (dist < 9) sc -= 8 / (dist + 1);
    const c = ((G.clock() % 1440) + 1440) % 1440;
    // from 02:30 to 04:00, head for the wreckers' place by the fewest choices (it takes walking)
    if (c >= 150 && c < 240 && A.defend.size) { const dd = A.toDefend[o.s.target]; if (dd != null) sc += 30 * Math.pow(0.7, dd); } // urgent: beats the revisit penalty
  }
  // a promise to tend Mother that the night may not let Lamb keep is not made (keep it or not make it)
  if (I.has("sets:said.day2_mother")) sc -= 6;
  // during the eye (23:30 to 01:00) go and hang a lantern in the Old Light
  if (o) { const c = ((G.clock() % 1440) + 1440) % 1440, dl = A.toLantern[o.s.target]; if ((c >= 1410 || c < 60) && dl != null && !G.flag("oldlight.lanterns")) sc += 20 * Math.pow(0.7, dl); }
  if (I.has("sets:oldlight.lanterns")) sc += 10;
  // what the Act 2 dawn needs for the bulb and the balance, and the balance lamp's materials
  for (const k of I) if (A.wants.has(k)) sc += 4;
  if (!G.flag("lamp.balance.lit") && [...I].some((k) => k === "salvage" || k === "project")) sc += 1;
  sc += lampPlan(G, I, menu);
  if (I.has("assign:mole3.mother=on")) sc += 5;
  for (const k of I) {
    if (/^sets:(.*\.tended|.*lamps_held|hill3\.bearing|mother\.restruck|lamp\..*\.lit)$/.test(k)) sc += 4;
    if (/^sets:lampout\./.test(k)) sc -= 4;
  }
  return sc;
}

// Score an option for a build. Higher is better; locked options are never chosen.
export function score(G, build, o, { seed = 0, random = false, ends = {}, attend = false, menu = [] } = {}) {
  if (o.locked) return -Infinity;
  const tie = hashStr(o.key, seed) / 4294967296; // order-free tie-break, fixed by the seed
  const visits = G.memory.visits(o.s.target) + (o.s.fail ? G.memory.visits(o.s.fail) : 0);
  if (random) return tie - visits * 0.05 + (attend ? attentive(G, intentOf(G, o), menu, o) : 0);
  const B = BUILDS[build], W = WANT[build], I = intentOf(G, o);
  let sc = tie * 0.5;
  for (const k of I) {
    if (k in W) sc += W[k];
    if (k === `verb:${build}` || (build === "fistmax" && k === "verb:fist")) sc += 3; else if (k.startsWith("verb:")) sc -= 0.5;
  }
  const far = farMap(G);
  for (const k of FAR) if (!I.has(k) && W[k] > 0) { const d = Math.min(...[o.s.target, o.s.fail].filter(Boolean).map((id) => far[k][id] ?? 99)); if (d < 99) sc += W[k] * Math.pow(0.6, d + 1); }
  if (o.check) {
    const sk = G.rs.skills[o.check.skill], mine = (sk && B.comps.includes(sk.attr)) || B.voices.includes(o.check.skill), pass = o.check.total >= o.check.dc;
    sc += pass ? (mine ? 3 : 1.5) : mine ? -1 : -3;
    if (o.check.red && !pass) sc -= 2;
  }
  // the build's ending: options that set what its preferred fate needs, or assign it outright
  for (const [v, prefs] of Object.entries(B.ending)) prefs.forEach((val, rank) => {
    const weight = rank === 0 ? 4 : 2, need = (ends[v] || {})[val];
    if (I.has(`assign:${v}=${val}`)) sc += weight * 2;
    if (need) for (const f of need) if (f && I.has(`sets:${f}`)) sc += weight;
  });
  sc += visits === 0 ? 3 : -visits * 1.5;
  if (o.said) sc -= 1;
  if (attend) sc += attentive(G, I, menu, o);
  return sc;
}

export function strainFor(G, build, o) {
  if (!o.check || !o.canStrain) return 0;
  const short = o.check.dc - o.check.total, sk = G.rs.skills[o.check.skill];
  if (short <= 0 || short > 3 || !(sk && BUILDS[build].comps.includes(sk.attr))) return 0;
  const st = o.strain(short); return st.ok ? short : 0;
}

// Between beats: pages into the build's voices, then a Margin slot; research found notes; the
// best weapon the build can carry in hand; and for Hands, every lamp-project stage it can pay for.
export function applyMax(G, build) {
  const M = BUILDS[build] && BUILDS[build].max; if (!M) return null;
  const sh = G.state.sheet, set = [];
  for (const [id, v] of Object.entries(M.levels)) if (G.rs.attrs[id]) { sh.attrs[id] = Math.max(sh.attrs[id] || 0, v); set.push(id); }
  for (const [id, v] of Object.entries(M.levels)) if (G.rs.skills[id] && !G.rs.attrs[id]) {
    const short = v - G.sheet.skill(id); if (short > 0) { sh.ranks[id] = (sh.ranks[id] || 0) + short; set.push(id); }
  }
  // The tool in hand. w.hammer is a combat @weapon with no @item, so no inventory can hold it; the
  // harness puts it in the hand slot directly (what combat reads) and upkeep leaves it there.
  if (M.tool && G.rs.items[M.tool]) { if (!G.inv.count(M.tool)) G.inv.give(M.tool); G.inv.equip(M.tool); }
  else if (M.tool) { const inv = (G.state.inv = G.state.inv || {}); (inv.equipped = inv.equipped || {}).hand = M.tool; }
  const ext = (G.state.ext = G.state.ext || {}), cb = (ext.combat = ext.combat || {}), tools = (cb.tools = cb.tools || {});
  if (M.tool) tools[M.tool] = { temper: M.temper || 0, fitting: M.fitting || null };
  return set;
}

export function upkeep(G, build, { attend = false } = {}) {
  // chapter pages (19.4) into the build's own compartment first, then its next one, then any
  if (G.sheet.chapters) for (let guard = 0; G.sheet.chapters() > 0 && guard < 20; guard++) {
    const c = [...BUILDS[build].comps, ...Object.keys(G.rs.attrs)].find((id) => G.sheet.canRaiseAttr(id)); if (!c) break; G.sheet.raiseAttr(c);
  }
  for (let guard = 0; G.state.sheet.points > 0 && guard < 20; guard++) {
    const v = BUILDS[build].voices.find((id) => G.rs.skills[id] && G.sheet.canRaise(id));
    if (v) { G.sheet.raise(v); continue; }
    if (!G.cabinet.canBuySlot()) G.cabinet.buySlot(); else break;
  }
  for (const t of G.cabinet.list()) if (t.status === "found" && !t.why) G.cabinet.research(t.id);
  const W = BUILDS[build].weapons || [];
  const best = !BUILDS[build].max && W.find((id) => G.inv.count(id) > 0); if (best && !G.inv.isWorn(best)) G.inv.equip(best);
  if (build === "hands" || attend) for (const p of G.settlement.list()) if (p.next && !p.why) G.settlement.contribute(p.id);
}
