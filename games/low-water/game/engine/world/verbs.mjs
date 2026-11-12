// Interaction verbs on the world, as data on objects.
//   @object id   name, place (or area), at (x z, for sneak scenes and walkable areas), about
//                verb: kind ["label"] [? condition] [{attributes}]      (repeatable)
// Kinds and what each does by itself (attributes add to or replace it):
//   climb, pry, rig   nothing built in: a check, items and effects make them
//   wade              Lamb gets wet (wet: 0.4)
//   hide              Lamb hides here (the stealth layer's hideAt; cover: 0.8)
//   douse, light      the place's light: douse to its dark-light (or light: l), light to its own
//                     light (or light: l, sodium: s)
//   power             setPower zone (default the place's zone) to (default off)
//   salvage           gives items once (give: s.brass 1, s.copper_wire 2)
//   eavesdrop         the overhearing rule (SYSTEMS.md 5.2): loudness 6 / range (default 8 m) x
//                     (1 + 0.08 x wind x max(0, cos of the wind against dir, the bearing from
//                     speaker to Lamb)) x (1 - 0.6 x rain noise) x cover (1 unseen, 0.3 seen);
//                     heard at 1 or more. who: a @char who must be here
//   read              an instrument's live reading here (inst: id)
//   cutpower          power with to: off by default (the director's spelling, NOTES V4)
//   throw             in a sneak scene, a noise at the object; elsewhere it turns heads: nobody
//                     here sees Lamb for minutes: 3 (uses: what is thrown)
//   carry             Lamb carries the item (item: id, default the object): slower and louder
//                     in sneaks and runs, no hand for a lantern; drop() puts it down
//   weigh, mark       nothing built in (effects and flags make them)
//   wait              lets time pass in steps (step: 5) until the condition until: holds, at most
//                     max: 60 minutes, with the meters running
// @spot id (NOTES V1) is an object with one verb: area or place, at (x y z r), verb (a kind),
// name (the label), needs (items, or conditions such as skill.grip >= 6, comma separated), when,
// noise, minutes, do, node, fail, once, skill, dc, give, uses, and the kind's own keys.
// Attributes: skill, dc, red (a check; pencil retry rules as dialogue checks), ok, fail (nodes
// to play), node (played after any outcome), cost (minutes), noise (loudness; defaults by
// kind), needs (items to hand), uses (items used up), give, do (effects), once (default for
// salvage), gone (condition after which the verb is no longer offered), text (a line shown).
// Results: flag done.<object>.<kind> on success; did(object, kind) reads "ok", "fail" or "".
// A noisy verb (noise 0.5 or more) where a watcher can see Lamb sets noticed.<object>; inside a
// sneak scene it makes a noise there instead.
import { compile, compileEffects, evaluate, runEffects } from "../core/expr.mjs";
import { splitAttrs } from "../dialogue/parse.mjs";
import { parseCount } from "../rules/ruleset.mjs";
import { registerCalls } from "../core/scope.mjs";

registerCalls({
  did: (G, [obj, kind]) => G.verbs.did(obj, kind),
  hide: (G, [obj]) => G.stealth.hideAt(obj),
  carry: (G, [id]) => G.verbs.carry(id),
  drop: (G) => G.verbs.drop(),
  // after(minutes, "effects"): effects that run later in game time (a candle timer, V7)
  after: (G, _, [m, src]) => G.timers.add(+m, String(src)),
}, { did: "object", hide: "object", carry: "item" });

export const VERB_KINDS = ["climb", "wade", "hide", "douse", "light", "power", "cutpower", "pry", "rig", "salvage", "eavesdrop", "read", "throw", "carry", "weigh", "mark", "wait"];
const NOISE = { climb: 0.4, wade: 0.8, hide: 0, douse: 0.2, light: 0.2, power: 0.6, cutpower: 0.6, pry: 0.9, rig: 0.4, salvage: 0.5, eavesdrop: 0, read: 0, throw: 0, carry: 0.3, weigh: 0.2, mark: 0.1, wait: 0 };
const SPOT_KEYS = ["noise", "once", "skill", "dc", "red", "give", "uses", "text", "cost", "light", "sodium", "zone", "to", "who", "range", "dir", "inst", "cover", "wet", "item", "minutes", "step", "until", "max"];

// A @spot record as an object with one verb (NOTES V1).
function spotToObject(r) {
  const one = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
  const kind = one("verb"); if (!kind) throw new SyntaxError("needs verb:");
  if (!VERB_KINDS.includes(kind)) throw new SyntaxError(`unknown verb ${kind} (one of ${VERB_KINDS.join(", ")})`);
  const parts = list(one("needs")), conds = parts.filter((p) => /[<>=!(]/.test(p)), items = parts.filter((p) => !/[<>=!(]/.test(p));
  const cond = [one("when"), ...conds].filter(Boolean).map((c) => `(${c})`).join(" & ");
  const attrs = { needs: items.join(", ") || undefined, do: one("do"), ok: one("node"), fail: one("fail") };
  if (one("minutes") && kind !== "throw") attrs.cost = +one("minutes");
  for (const k of SPOT_KEYS) if (one(k) != null && attrs[k] == null) attrs[k] = isNaN(+one(k)) ? (one(k) === "yes" ? true : one(k)) : +one(k);
  const at = one("at") ? one("at").split(/\s+/).map(Number) : null;
  return { at: at ? [at[0], at.length >= 4 ? at[2] : at[1]] : null, r: at && at.length >= 4 ? at[3] : null, kind, label: one("name") || null, cond, attrs };
}
const list = (v) => (v ? String(v).split(",").map((s) => s.trim()).filter(Boolean) : []);

export function loadObjects(book) {
  const out = {}, errors = [];
  for (const r of Object.values((book.records || {}).spot || {})) {
    try {
      const s = spotToObject(r), one = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
      out[r.id] = { id: r.id, name: s.label || r.id, place: one("place") || null, area: one("area") || null, at: s.at, r: s.r, about: one("about") || "", spot: true, file: r.file, line: r.line,
        verbs: [makeVerb(s.kind, s.label, s.cond || null, s.attrs, r.line)] };
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `spot ${r.id}: ${e.message}` }); }
  }
  for (const r of Object.values((book.records || {}).object || {})) {
    try {
      const one = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
      const verbs = r.kv.filter((e) => e.key === "verb").map((e) => {
        const { body, attrs } = splitAttrs(e.value), m = body.trim().match(/^(\w+)(?:\s+"([^"]*)")?(?:\s*\?\s*(.+))?$/);
        if (!m) throw new SyntaxError(`line ${e.line}: verb: expected kind ["label"] [? cond] [{...}]`);
        if (!VERB_KINDS.includes(m[1])) throw new SyntaxError(`line ${e.line}: unknown verb ${m[1]} (one of ${VERB_KINDS.join(", ")})`);
        return makeVerb(m[1], m[2] || null, m[3], attrs, e.line);
      });
      const at = one("at") ? one("at").split(/\s+/).map(Number) : null;
      out[r.id] = { id: r.id, name: one("name") || r.id, place: one("place") || null, area: one("area") || null, at, about: one("about") || "", verbs, file: r.file, line: r.line };
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `object ${r.id}: ${e.message}` }); }
  }
  return { objects: out, errors };
}

function makeVerb(kind, label, cond, attrs, line) {
  if (attrs.skill && attrs.dc == null) throw new SyntaxError(`line ${line}: a verb with skill needs dc`);
  return { kind, label, cond: compile(cond), attrs, effects: compileEffects(attrs.do), gone: compile(attrs.gone), needs: list(attrs.needs), uses: list(attrs.uses).map(parseCount), give: list(attrs.give).map(parseCount),
    once: attrs.once != null ? !!attrs.once : kind === "salvage", noise: attrs.noise != null ? +attrs.noise : NOISE[kind], until: compile(attrs.until), line };
}

export function createVerbs(G, objects) {
  const V = () => (G.state.verbs ||= {}), key = (o, v) => `${o.id}:${v.kind}`;
  const here = (o) => (o.place ? o.place === G.state.place : o.area ? o.area === G.state.area : false);
  const name = (id) => (G.rs.items[id] ? G.rs.items[id].name : id);
  function why(o, v) {
    for (const id of v.needs) if (!G.inv.count(id)) return `Needs ${name(id)}`;
    for (const c of v.uses) if (G.inv.count(c.id) < c.n) return `Needs ${c.n} ${name(c.id)}`;
    if (v.kind === "eavesdrop" && v.attrs.who && G.content.schedules[v.attrs.who] && G.content.schedules[v.attrs.who].length && G.people.where(v.attrs.who) !== G.state.place) return "Nobody to listen to";
    if (v.attrs.skill) { const p = G.checks.preview(key(o, v), v.attrs.skill, +v.attrs.dc, v.attrs.red ? "never" : "raise"); if (p.locked) return p.locked; }
    return null;
  }
  const offered = (o, v) => !(v.cond && !evaluate(v.cond, G.scope)) && !(v.gone && evaluate(v.gone, G.scope)) && !(v.once && V()[key(o, v)] === "ok") && !(v.attrs.red && V()[key(o, v)]);
  const api = {
    objects,
    // What Lamb can do here now: [{ object, verb, label, why (null when it can be done), check }]
    list(place = null) {
      const out = [];
      for (const o of Object.values(objects)) {
        if (place ? o.place !== place : !here(o)) continue;
        for (const v of o.verbs) if (offered(o, v)) out.push({ object: o, verb: v, label: v.label || o.name, why: why(o, v),
          check: v.attrs.skill ? G.checks.preview(key(o, v), v.attrs.skill, +v.attrs.dc, v.attrs.red ? "never" : "raise") : null });
      }
      return out;
    },
    did: (objId, kind) => V()[`${objId}:${kind}`] || "",
    carry(id) { G.state.carrying = id; G.emit("carry", { id }); },
    drop() { const id = G.state.carrying; delete G.state.carrying; if (id) G.emit("drop", { id }); },
    // Do a verb. Returns { ok, node, lines, why }; why is set when it could not be tried.
    act(objId, kind, { label = null } = {}) {
      const o = objects[objId]; if (!o) throw new Error(`no object ${objId}`);
      const v = o.verbs.find((x) => x.kind === kind && (!label || x.label === label) && offered(o, x)); if (!v) return { ok: false, why: "Not here, not now", lines: [] };
      const w = why(o, v); if (w) return { ok: false, why: w, lines: [] };
      if (v.attrs.cost) G.advance(+v.attrs.cost);
      let ok = true; const lines = [];
      if (v.attrs.skill) ok = G.checks.resolve(key(o, v), v.attrs.skill, +v.attrs.dc).pass;
      if (ok && v.kind === "eavesdrop") ok = api.overhear(v) >= 1;
      if (ok) { for (const c of v.uses) G.inv.take(c.id, c.n); builtIn(G, o, v, lines); for (const c of v.give) G.inv.give(c.id, c.n); if (v.effects) runEffects(v.effects, G.scope); G.setFlag(`done.${o.id}.${v.kind}`, true); }
      V()[key(o, v)] = ok ? "ok" : "fail";
      if (v.attrs.text && ok) lines.push({ kind: "nar", who: "", text: G.fill(String(v.attrs.text)) });
      noise(G, o, v);
      G.emit("verb", { object: o.id, kind: v.kind, ok });
      return { ok, node: (ok ? v.attrs.ok : v.attrs.fail) || v.attrs.node || null, lines };
    },
    // SYSTEMS.md 5.2, for an eavesdrop verb.
    overhear(v) {
      const e = G.envAt(), range = +(v.attrs.range || 8), dir = ((+v.attrs.dir || 0) * Math.PI) / 180;
      const tx = Math.sin(dir), tz = Math.cos(dir), wl = e.wind.speed || 1, cos = e.wind.speed ? (e.wind.x * tx + e.wind.z * tz) / wl : 0;
      const cover = G.stealth.seen() ? 0.3 : 1;
      return (6 / range) * (1 + 0.08 * e.wind.speed * Math.max(0, cos)) * (1 - 0.6 * Math.min(1, e.rain / 4)) * cover;
    },
  };
  return api;
}

function builtIn(G, o, v, lines) {
  const p = G.book.places[o.place || G.state.place] || {}, at = o.place || G.state.place, A = v.attrs;
  switch (v.kind) {
    case "wade": G.body.addWet(A.wet != null ? +A.wet : 0.4); break;
    case "hide": G.stealth.hideAt(o.id); break;
    case "douse": G.command(["setLight", at, String(A.light ?? p.dark ?? 0.05), "0"], `verb:${o.id}`); break;
    case "light": G.command(["setLight", at, String(A.light ?? p.light ?? 0.5), String(A.sodium ?? 0)], `verb:${o.id}`); break;
    case "power": case "cutpower": G.command(["setPower", String(A.zone || p.zone || at), String(A.to || "off")], `verb:${o.id}`); break;
    case "throw": { const s = G.sneaks && G.sneaks.current; if (s) s.throwNoise(o.at || null); else G.stealth.distract(+(A.minutes || 3)); break; }
    case "carry": G.verbs.carry(String(A.item || o.id)); break;
    case "wait": { const step = +(A.step || 5), max = +(A.max || 60); for (let t = 0; t < max && !(v.until && evaluate(v.until, G.scope)); t += step) G.advance(step); break; }
    case "read": { const out = A.inst ? G.instruments.read(A.inst) : null; if (out) lines.push({ kind: "inst", who: out.who, text: out.text }); break; }
    default: break;
  }
}

function noise(G, o, v) {
  if (!(v.noise > 0)) return;
  const s = G.sneaks && G.sneaks.current;
  if (s) { const at = o.at || [s.state.x, s.state.z]; s.noise(at[0], at[1], v.noise * 3); return; }
  if (v.noise >= 0.5 && G.stealth.seen()) { G.setFlag(`noticed.${o.id}`, true); G.emit("stealth.noticed", { object: o.id, kind: v.kind }); }
}
