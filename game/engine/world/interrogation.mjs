// Interrogation (author, 2026-10-17: dialogue menus lead into fighting, dialogue, or interrogation;
// SYSTEMS-FULL 20; shape agreed with the director in NOTES-FOR-ENGINEER). A live exchange: the
// person stays on the plate, the world runs, and the menu is a set of presses. Two numbers move:
// nerve (how much pressure before they break; 0 breaks) and heat (rises with threats; at bolt they
// leave, at swing they fight). Heat cools while Lamb says nothing; the person says their lies on
// their own clock, and a lie can be caught for a few seconds by a Lamb who holds the fact.
//   @interrogation id
//   name, who (@char), place, nerve, heat, cool (heat lost a cool step; default 1), cool-every
//   (seconds a cool step; default 8), hold (seconds of silence before they leave by walk:)
//   bolt: N -> node        heat at or over N: they walk or run out; the node plays
//   swing: N -> encounter  heat at or over N: they fight (optional; checked before bolt)
//   break: node            nerve at 0: they tell; walk: node   Lamb walked off, or hold ran out
//   press: <style> "label" -> node [? cond] {nerve: -n, heat: +n, skill, dc, again}
//          style is fist, tongue, shadow, hands, eye or any (a tag for the verb mark); a press with
//          a skill is a visible check (pass applies the numbers, fail heat +1 only); once each
//          unless {again}; its node is a short reply ending return:
//   lie: id "text" {catch: fact, nerve: -n, heat, node, after: seconds}   said after `after`
//          seconds (default 5); "That's a lie." within LIE_OPEN seconds by a Lamb holding the
//          fact applies the numbers and plays the node; called with no lie open or without the
//          fact, it costs nerve +2
//   tell: N "text"         said once, when nerve first falls to N or below
//   content: do: interrogate(id)   (an effect, as fight(id))
// G.interrog: request(id), take(), start(id), current, step(dt) (the loop calls it), presses(),
// press(step, { strain }), callLie(), outcome(), walkAway(), finish(), face().
import { registerCalls } from "../core/scope.mjs";
import { parseChoice, splitAttrs } from "../dialogue/parse.mjs";

registerCalls({ interrogate: (G, [id]) => G.interrog.request(id) }, { interrogate: "interrogation" });

export const LIE_OPEN = 4, STYLES = ["fist", "tongue", "shadow", "hands", "eye", "any"];
const one = (r, k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
const arrow = (v) => { const m = String(v || "").match(/^\s*(-?\d+(?:\.\d+)?)\s*->\s*(\S+)\s*$/); return m ? { at: +m[1], to: m[2] } : null; };
const unq = (v) => String(v).trim().replace(/^"(.*)"$/, "$1");

export function loadInterrogations(book) {
  const out = {}, errors = [];
  for (const r of Object.values((book.records || {}).interrogation || {})) {
    try {
      const at = (e) => ({ file: r.file, line: e.line, node: r.id });
      const presses = r.kv.filter((e) => e.key === "press").map((e, i) => {
        const v = e.value.trim(), sp = v.indexOf(" "), style = v.slice(0, sp);
        if (!STYLES.includes(style)) throw new SyntaxError(`press: style ${style} is not one of ${STYLES.join(" ")}`);
        const s = parseChoice(e.value.trim().slice(sp + 1).match(/\{[^}]*skill:/) ? "check" : "opt", v.slice(sp + 1).replace(/->\s*(\S+)/, (m0, t) => (/\{[^}]*skill:/.test(v) ? `-> ${t} / ${t}` : m0)), at(e));
        if (s.attrs.again) s.attrs.once = false; // an again press stays on offer after it passes
        return { ...s, style, key: `${r.id}.press.${i}`, again: !!s.attrs.again, nerve: +s.attrs.nerve || 0, heat: +s.attrs.heat || 0 };
      });
      const lies = r.kv.filter((e) => e.key === "lie").map((e) => {
        const { body, attrs } = splitAttrs(e.value), m = body.trim().match(/^(\S+)\s+"(.*)"$/);
        if (!m) throw new SyntaxError(`lie: expected id "text" {catch, nerve, node}, got ${e.value}`);
        return { id: m[1], text: m[2], catch: attrs.catch || null, nerve: +attrs.nerve || 0, heat: +attrs.heat || 0, node: attrs.node || null, after: attrs.after != null ? +attrs.after : 5, line: e.line };
      });
      const tells = r.kv.filter((e) => e.key === "tell").map((e) => { const m = e.value.trim().match(/^(-?\d+)\s+(.*)$/); if (!m) throw new SyntaxError(`tell: expected N "text", got ${e.value}`); return { at: +m[1], text: unq(m[2]) }; });
      const d = { id: r.id, name: one(r, "name") || r.id, who: one(r, "who") || null, place: one(r, "place") || null,
        nerve: +(one(r, "nerve") ?? 6), heat: +(one(r, "heat") ?? 0), cool: +(one(r, "cool") ?? 1), coolEvery: +(one(r, "cool-every") ?? 8), hold: one(r, "hold") != null ? +one(r, "hold") : null,
        bolt: arrow(one(r, "bolt")), swing: arrow(one(r, "swing")), break: one(r, "break") || null, walk: one(r, "walk") || null, presses, lies, tells, file: r.file, line: r.line };
      if (!d.break) throw new SyntaxError("needs break: node");
      if (one(r, "bolt") && !d.bolt) throw new SyntaxError("bolt: expected N -> node");
      if (one(r, "swing") && !d.swing) throw new SyntaxError("swing: expected N -> encounter");
      out[r.id] = d;
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `interrogation ${r.id}: ${e.message}` }); }
  }
  return { interrogations: out, errors };
}

export function createInterrogations(G, defs) {
  const say = (S, text, kind = "line") => { const L = { kind, who: S.speaker, whoId: S.def.who, text, face: api.face() }; S.said.push(L); G.emit("interrog.say", L); return L; };
  const api = {
    defs, current: null,
    request(id) { if (!defs[id]) throw new Error(`no interrogation ${id}`); G.state.pendingInterrog = id; G.emit("interrog.request", { id }); },
    take() { const id = G.state.pendingInterrog; delete G.state.pendingInterrog; return id || null; },
    start(id) {
      const def = defs[id]; if (!def) throw new Error(`no interrogation ${id}`);
      const c = (G.rs.chars || {})[def.who];
      api.current = { def, nerve: def.nerve, heat: Math.max(0, def.heat), t: 0, quiet: 0, used: new Set(), lies: def.lies.map((l) => ({ ...l, saidAt: null })), told: new Set(), said: [], out: null, speaker: c ? c.speaker : String(def.who || "").toUpperCase() };
      G.emit("interrog.start", { id, who: def.who });
      return api.current;
    },
    // Real seconds pass: heat cools in silence, lies are said, silence can run out.
    step(dt) {
      const S = api.current; if (!S || S.out) return;
      S.t += dt; S.quiet += dt;
      if (S.def.cool && S.quiet >= S.def.coolEvery) { S.quiet -= S.def.coolEvery; if (S.heat > 0) { S.heat = Math.max(0, S.heat - S.def.cool); G.emit("interrog.cool", { heat: S.heat }); } }
      for (const l of S.lies) if (l.saidAt == null && S.t >= l.after) { l.saidAt = S.t; say(S, l.text); G.emit("interrog.lie", { id: l.id }); }
      if (S.def.hold != null && S.t - (S.lastPress ?? 0) >= S.def.hold && S.def.walk) { S.out = { kind: "walk", node: S.def.walk }; G.emit("interrog.end", S.out); }
    },
    // The presses on offer now (step objects the dialogue runner turns into options).
    presses() {
      const S = api.current; if (!S || S.out) return [];
      return S.def.presses.filter((p) => (p.again || !S.used.has(p.key)) && (!p.cond || G.scope && evalCond(G, p.cond)));
    },
    openLie() { const S = api.current; return S && S.lies.find((l) => l.saidAt != null && !l.caught && S.t - l.saidAt <= LIE_OPEN) || null; },
    // A press: { node, pass } and the numbers applied (fail: heat +1 only).
    press(p, { pass = true } = {}) {
      const S = api.current; if (!S || S.out) return null;
      S.used.add(p.key); S.lastPress = S.t; S.quiet = 0;
      if (pass) { S.nerve += p.nerve; S.heat = Math.max(0, S.heat + p.heat); } else S.heat += 1;
      api.afterNumbers();
      return { node: p.target, pass };
    },
    // "That's a lie."
    callLie() {
      const S = api.current; if (!S || S.out) return null;
      S.lastPress = S.t; S.quiet = 0;
      const l = api.openLie();
      if (l && (!l.catch || G.flag(l.catch))) { l.caught = true; S.nerve += l.nerve; S.heat = Math.max(0, S.heat + l.heat); api.afterNumbers(); G.emit("interrog.caught", { id: l.id }); return { node: l.node, caught: true }; }
      S.nerve += 2; api.afterNumbers(); return { node: null, caught: false };
    },
    afterNumbers() {
      const S = api.current, D = S.def;
      for (const t of D.tells) if (S.nerve <= t.at && !S.told.has(t.at)) { S.told.add(t.at); say(S, t.text, "nar"); }
      if (S.nerve <= 0) S.out = { kind: "break", node: D.break };
      else if (D.swing && S.heat >= D.swing.at) S.out = { kind: "swing", fight: D.swing.to };
      else if (D.bolt && S.heat >= D.bolt.at) S.out = { kind: "bolt", node: D.bolt.to };
      if (S.out) G.emit("interrog.end", S.out);
    },
    outcome: () => (api.current && api.current.out) || null,
    walkAway() { const S = api.current; if (!S) return null; S.out = { kind: "walk", node: S.def.walk }; G.emit("interrog.end", S.out); return S.out; },
    finish() { const S = api.current; api.current = null; if (S) G.emit("interrog.finish", { id: S.def.id, out: S.out, nerve: S.nerve, heat: S.heat }); return S && S.out; },
    // The person's face, for lines and the portrait: startled near breaking, set near acting, else wary.
    face() {
      const S = api.current; if (!S) return null; const D = S.def, act = Math.min(D.bolt ? D.bolt.at : Infinity, D.swing ? D.swing.at : Infinity);
      return S.nerve <= 2 ? "startled" : act - S.heat <= 1 ? "set" : "wary";
    },
  };
  return api;
}

import { evaluate } from "../core/expr.mjs";
function evalCond(G, cond) { try { return !!evaluate(cond, G.scope); } catch (e) { console.warn(`interrogation: condition failed: ${e.message}`); return false; } }
