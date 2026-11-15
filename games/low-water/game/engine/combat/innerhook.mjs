// The story's hinge into the inner arena (design/COMPLETION.md row S18; design/spine-plan/08-ARENA.md section 3). A
// scene calls `inner(<flaw>, <next node>)`: the flaw is played the night after the scene where its self-lie was heard
// (armed: the self-lie is in G.state.selfLies; the Descent and the Adversary come once, at the end of era 5, whatever
// was heard). Armed, the runner ends the beat with beat.inner = { id, next, heard, resolved, kept, levels } and the shell
// (an overlay of the arena page) or the harness (tools/playthrough.mjs) plays it; talk.afterInner(records) writes what
// it recorded and plays `next`. Not armed, nothing happens and the node goes on. What is written is story state only,
// in G.state.inner (the verb each fight ended by, and a boon owed): never a fate, never a count on screen (08-ARENA
// rules 5 and 8). innerend(id) and innerboon(id) (combat/arena/inner.mjs) read it for the scene that follows.
//   content:  do: inner(says, e5.trade)        G.innerHinge.request(id, next)  .take()  .finish(records)
//
// The traits pass (design/TRAITS.md, 2026-10-23): every flaw is one of the character's traits embodied, so the hinge
// carries the sheet's levels into the dream (the trait is as strong there as it is in him), and brings back what the
// night did to the trait: G.state.inner.marks[voice] (cut back, made terms with, lost to), read by the sheet as a
// modifier named for the night (G.modSources), so the voices speak more or less in every later scene and the tools
// they scale hit harder or softer. The night is felt as it opens and as he wakes: the trait's presence cue
// (trait.<voice>.near) and the outcome's (trait.cut, trait.terms, trait.taken), from content/quota/traits.lwd.
import { registerCalls } from "../core/scope.mjs";
import { FLAWS, armed } from "./data/flaws.mjs";
import { flawId, COMPARTMENT_TRAITS, VOICE_TRAITS, MARK_WORDS } from "./data/traits.mjs";

export const ONCE = new Set(["descent", "host"]);
const OUTCOME_CUE = { force: "trait.cut", terms: "trait.terms", lose: "trait.taken" };

registerCalls({ inner: (G, [id, next]) => G.innerHinge && G.innerHinge.request(String(id), next == null ? null : String(next)) });

// the sheet as the dream reads it: every compartment and voice at its effective level (the same values a check uses)
export function sheetLevels(G) {
  const L = {}, S = G.sheet; if (!S || !G.rs) return L;
  const safe = (fn) => { try { const v = fn(); return Number.isFinite(v) ? v : undefined; } catch (e) { console.warn(`inner hinge: a level could not be read: ${e.message}`); return undefined; } };
  for (const k of Object.keys(COMPARTMENT_TRAITS)) if (G.rs.attrs[k]) { const v = safe(() => S.attr(k)); if (v != null) L[k] = v; }
  for (const k of Object.keys(VOICE_TRAITS)) if (G.rs.skills[k]) { const v = safe(() => S.skill(k)); if (v != null) L[k] = v; }
  return L;
}

// the night's marks as sheet modifiers: one per trait the inner arena changed, named for what last happened to it
export function innerMods(G) {
  const marks = ((G.state && G.state.inner) || {}).marks || {};
  return Object.entries(marks).filter(([, m]) => m && m.amount).map(([voice, m]) => ({ target: `skill.${voice}`, amount: m.amount, label: MARK_WORDS[m.last] || "inside", source: "inner" }));
}

const fire = (G, id) => { if (!G.senses || !G.senses.cues || !G.senses.cues[id]) return; try { G.senses.fire(id, { via: "inner" }); } catch (e) { console.error(`inner hinge: the cue ${id} failed: ${e.message}`); } };

export function installInnerHinge(G) {
  if (G.innerHinge) return G.innerHinge;
  const heard = () => G.state.selfLies || [];
  const st = () => {
    const S = (G.state.inner ||= {});
    // a save from before the traits pass keeps its flaw under the old id (design/TRAITS-RENAME.md section 3)
    for (const old of Object.keys(S)) { const now = flawId(old); if (now !== old && !S[now]) { S[now] = S[old]; delete S[old]; } }
    return S;
  };
  const prev = G.modSources; if (typeof prev === "function") G.modSources = () => [...prev(), ...innerMods(G)];
  const api = {
    // the run so far, as the Descent and the Adversary read it: each flaw it met and the verb it ended by
    resolved: () => Object.fromEntries(Object.entries(st()).filter(([k, v]) => FLAWS[k] && v && v.verb).map(([k, v]) => [k, v.verb])),
    // the traits the Host is made of: those cut back by force, and (since the traits pass) those that took him
    kept: () => Object.entries(st()).filter(([k, v]) => FLAWS[k] && v && (v.verb === "force" || v.verb === "lose")).map(([k]) => k),
    armed: (id0) => { const id = flawId(id0); return ONCE.has(id) ? !(st()[id] && st()[id].verb) : !!FLAWS[id] && armed(id, heard()) && !(st()[id] && st()[id].verb); },
    request(id0, next) {
      const id = flawId(id0);
      if (!ONCE.has(id) && !FLAWS[id]) throw new Error(`inner(${id0}): no such flaw`);
      if (!api.armed(id)) return; // not heard, or already fought: the scene goes on
      G.state.pendingInner = { id, next, heard: heard().map((s) => (typeof s === "string" ? s : s.id)), resolved: api.resolved(), kept: api.kept(), levels: sheetLevels(G) };
      // the trait's presence before the night: in the body, in the pad, in the room
      const f = FLAWS[id]; if (f && f.trait) fire(G, `trait.${f.trait}.near`);
      G.emit("inner.request", { id });
    },
    take() { const p = G.state.pendingInner; delete G.state.pendingInner; return p || null; },
    // the records the inner run emitted (combat/arena/inner.mjs, descent.mjs): story state only
    finish(id, records = []) {
      const S = st();
      for (const r of records) {
        if (r.type === "inner.outcome" && r.ring) continue; // a Descent ring is a return, not the flaw's own night
        if (r.type === "inner.outcome") S[r.flaw] = { ...(S[r.flaw] || {}), verb: r.verb, beat: r.beat };
        if (r.type === "boon.cost") S[r.flaw] = { ...(S[r.flaw] || {}), boon: r.boon };
        if (r.type === "trait.change" && VOICE_TRAITS[r.trait]) {
          const M = (S.marks ||= {}), m = (M[r.trait] ||= { amount: 0 });
          m.amount += +r.delta || 0; m.last = r.mark;
          fire(G, OUTCOME_CUE[r.mark]);
        }
      }
      if (id === "descent") S.descent = { verb: "walked" };
      G.emit("inner.done", { id });
    },
  };
  G.innerHinge = api;
  return api;
}
