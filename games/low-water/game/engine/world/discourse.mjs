// Rumour and discourse (design/DISCOURSE-SYSTEM.md, PITCHES 3a.2: rhetoric as a system). A claim is carried by the
// community model's carriers (@carrier in world/community.mjs: in The Quota the district's chalk and its crier, the
// pub, the pulpit), whose volume the model's rules turn into standing street by street (The Quota's R17 and its
// siblings). The player acts on a claim in four ways, each with its consequences in the model and in the record:
//   repeat     say it where a carrier is heard: that carrier's volume goes up; record spoken.position on the claim's
//              victim
//   challenge  say against it there: the volume goes down, and the claim's challenge-cost runs (honesty costs,
//              PITCHES Decay constraint 2); record challenge.claim
//   silence    stop the carrier with your hands: scrub the chalk off a door, pull the crier down off his crate. The
//              first carrier's volume and the street's stock of it go down; the global silenced.<claim> counts it, for
//              the rule that brings it back; record silence.claim; seen doing it, the flag noticed.<claim>
//   answer     put your own account in its place, out loud, where it was carried (what you saw on the hill): as
//              silence, and the answering claim's words go up in its place; record answer.claim quoting them
// The device rule (2026-10-23, design/DEVICE-AUDIT.md): no act is reading or pasting paper. tear and paste, the
// paper acts, are read as silence and answer so old saves and fixtures still run; tools/discoursecheck.mjs refuses
// them in story content.
//
//   @claim cl.hesh_hoard
//   words: The Hesh have the grain under the goats.           the claim in the town's own words, as people say it
//   target: hesh                                             the people it is about (a model people)
//   victim: haldane                                          the household it lands on (record events name it)
//   carriers: notices, pub, pulpit                           where it is carried (@carrier ids; the first is the one
//                                                            silence and answer act on)
//   step: 0.1                                                how far one act moves a carrier's volume
//   first: Krall's crier, from day 39                        (provenance, for the designers)
//   challenge-cost: shift(portion, -0.05, {self})             effects a challenge runs (optional); {self} is the
//                                                            player's household (@meta player-household)
//
// In content: discourse(<act>, <claim>[, <carrier or street>[, <answering claim>]]) as an effect, on an option or
// on an @object verb (verb: mark "Scrub the goat off the door" {do: discourse(silence, cl.hesh_hoard, square)}).
// State: flags did.<act>.<claim>; G.state.discourse [{ act, claim, where, words, day, clock }]; event
// discourse.act. Every act is a record event, so the witness's oracle and the world record keep it.
import { compileEffects, runEffects } from "../core/expr.mjs";
import { registerCalls } from "../core/scope.mjs";

export const ACTS = ["repeat", "challenge", "silence", "answer"];
export const OLD_ACTS = { tear: "silence", paste: "answer" }; // the paper acts, read as the hand and the voice
const list = (v) => (v ? String(v).split(",").map((s) => s.trim()).filter(Boolean) : []);

export function loadClaims(book) {
  const claims = {}, errors = [];
  for (const r of Object.values((book.records || {}).claim || {})) {
    try {
      const one = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
      for (const e of r.kv) if (!["words", "target", "victim", "carriers", "step", "first", "challenge-cost", "about"].includes(e.key)) throw new SyntaxError(`line ${e.line}: unknown key "${e.key}"`);
      if (!one("words")) throw new SyntaxError("needs words:");
      if (!list(one("carriers")).length) throw new SyntaxError("needs carriers:");
      const costSrc = one("challenge-cost") || null; if (costSrc) compileEffects(costSrc.replace(/\{self\}/g, "self")); // checked now, compiled per act with {self} filled
      claims[r.id] = { id: r.id, words: one("words"), target: one("target") || null, victim: one("victim") || "", carriers: list(one("carriers")), step: +(one("step") || 0.1), first: one("first") || "", costSrc, file: r.file, line: r.line };
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `claim ${r.id}: ${e.message}` }); }
  }
  return { claims, errors };
}

registerCalls({ discourse: (G, [act, claim, where, over]) => { if (G.discourse) G.discourse.act(act, claim, where || "", over || ""); } }, { discourse: "discourse" });

export function installDiscourse(G, claims) {
  if (G.discourse) return G.discourse;
  const M = () => G.community, H = (id) => M() && M().model.households[id];
  const streetOf = (claim, where) => (M() && M().model.streets[where] ? where : H(claim.victim) ? H(claim.victim).street : "");
  // the player's own household: @meta player-household: <var> <value>=<household> ... (The Quota: q_class inspector=furrowe militia=brack)
  const ph = String((G.book.meta || {})["player-household"] || "").trim().split(/\s+/), phMap = Object.fromEntries(ph.slice(1).map((x) => x.split("=")));
  const selfHousehold = () => (ph[0] ? phMap[G.scope.get(`var.${ph[0]}`)] : null) || null;
  const vol = (c) => (M() ? +M().state.globals[`volume.${c}`] || 0 : 0);
  const shiftVol = (c, d) => { if (!M()) return; const now = vol(c), to = Math.max(0, Math.min(1, now + d)); M().shift(`volume.${c}`, to - now); };
  const api = {
    claims, volume: vol,
    // act: returns the record event id, or null when the act does not apply here
    act(act, id, where = "", overId = "") {
      act = OLD_ACTS[act] || act;
      const c = claims[id]; if (!c) throw new Error(`discourse: no claim ${id}`);
      if (!ACTS.includes(act)) throw new Error(`discourse: no act ${act} (one of ${ACTS.join(", ")})`);
      const carrier = c.carriers.includes(where) ? where : c.carriers[0];
      if (!c.carriers.includes(carrier)) return null;
      const street = streetOf(c, where), C = M();
      let ev = null, words = c.words;
      if (act === "repeat") { shiftVol(carrier, c.step); ev = C && C.record("spoken.position", c.victim, street, { claim: id, act, carrier, words }); }
      if (act === "challenge") { shiftVol(carrier, -0.8 * c.step); if (c.costSrc) runEffects(compileEffects(c.costSrc.replace(/\{self\}/g, selfHousehold() || c.victim)), G.scope); ev = C && C.record("challenge.claim", c.victim, street, { claim: id, act, carrier, words }); }
      if (act === "silence" || act === "answer") {
        const first = c.carriers[0];
        shiftVol(first, -c.step); if (C && street) C.shift(first, -Math.min(0.2, +C.stock(first, street) || 0), street);
        if (C) C.shift(`silenced.${id.replace(/^cl\./, "")}`, 1);
        if (G.stealth && G.stealth.seen && G.stealth.seen()) G.setFlag(`noticed.${id}`, true);
        if (act === "answer") { const o = claims[overId]; if (!o) throw new Error(`discourse: answer needs the claim said in its place (got ${overId || "nothing"})`); words = o.words; ev = C && C.record("answer.claim", o.victim || c.victim, street, { claim: overId, over: id, act, words }); }
        else ev = C && C.record("silence.claim", c.victim, street, { claim: id, act });
      }
      G.setFlag(`did.${act}.${id}`, true);
      (G.state.discourse ||= []).push({ act, claim: id, over: overId || null, where: street, carrier, words, day: C ? C.day() : null, clock: Math.round(G.clock()) });
      G.emit("discourse.act", { act, claim: id, over: overId || null, street, carrier, words, event: ev });
      return ev;
    },
    acts: () => [...(G.state.discourse || [])],
  };
  G.discourse = api;
  return api;
}
