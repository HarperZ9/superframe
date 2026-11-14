// The inner run (design/spine-plan/inferno/06-SYSTEMS.md section 3): not the ladder. A hinge arms it: after a
// scene whose self-lie was heard and kept, the night's sleep opens the stove door and plays that one flaw. One
// fight, then the morning. The Adversary is the one exception: three movements in a row, once, at the end.
//   const R = createInnerRun({ flaw, heard, kept, levels, boons, onRecord, seed, G })
//   R.stage()   { kind: "fight", flaw, movement? } | { kind: "offer", boon } | { kind: "morning", beat } | { kind: "over" }
//   R.world(G)  the fight's world (combat/arena/innerworld.mjs, hostworld.mjs)
//   R.finish(W) reads the outcome: records it (onRecord), offers the flaw's boon only after force, or goes on
//   R.choose(i) 0 takes the boon (its cost recorded at once), 1 declines it
// No tally (08-ARENA rule 8): the run keeps no records of its own, writes no storage, has no record(), and its
// summary holds no count. What it writes goes out through onRecord as story records, never to the screen:
//   inner.outcome { flaw, verb, outcome, scene, beat, dc? }   (dc only on force, and only falling)
//   boon.cost { flaw, boon, name, who, scene, beat }
//   trait.change { flaw, trait, mark, delta }   what the night did to the trait in him (design/TRAITS.md section 2):
//     force cuts it back (-1), terms keep its ear (+1), losing gives it him (+2); never a fate, never on screen
// Nothing here writes a fate field or a witness beat (08-ARENA rule 5; combat/tools/flawcheck.mjs).
import { FLAWS, HOST, armed } from "../data/flaws.mjs";
import { isForce } from "../data/flaws-common.mjs";
import { createInnerWorld } from "./innerworld.mjs";
import { createHostWorld } from "./hostworld.mjs";
import { registerCalls } from "../../core/scope.mjs";
import { OUTCOME_MARK, markOf, flawId as migrated } from "../data/traits.mjs";

// For the story's conditions (the scene that follows reads them; the story lead writes the beats):
//   innerend(id)  the verb the flaw's last inner fight ended by ("" when none): refuse, endure, yield, lose, name, force
//   innerboon(id) the flaw's boon was taken (its cost is owed)
registerCalls({
  innerend: (G, [id]) => ((G.state.inner || {})[migrated(String(id).replace(/^q\.fl\./, ""))] || {}).verb || "",
  innerboon: (G, [id]) => !!((G.state.inner || {})[migrated(String(id).replace(/^q\.fl\./, ""))] || {}).boon,
});

export function createInnerRun({ flaw: flawId0, flawRec = null, arena = null, heard = null, kept = [], levels = {}, boons = [], onRecord = null, seed = 1, G = null } = {}) {
  const flawId = migrated(flawId0), adversary = flawId === "host", flaw = flawRec || (adversary ? HOST : FLAWS[flawId]); // flawRec: a record not in FLAWS (a checker's planted control)
  if (!flaw) throw new Error(`inner run: no flaw ${flawId}`);
  // armed only by its hinge: the self-lie heard (heard: G.state.selfLies, or ids); the Adversary always comes
  const isArmed = adversary || heard == null || armed(flawId, heard);
  const S = { flaw: flawId, movement: 0, phase: isArmed ? "fight" : "over", result: null, offer: null, morning: null, boons: [...boons] };
  const emit = (ev) => {
    if (G && G.state && (ev.type === "inner.outcome" || ev.type === "boon.cost")) { const st = (G.state.inner ||= {}), k = ev.flaw; st[k] = { ...(st[k] || {}), ...(ev.type === "inner.outcome" ? { verb: ev.verb, beat: ev.beat } : { boon: ev.boon }) }; }
    if (onRecord) { try { onRecord(ev); } catch (e) { console.error(`inner run: onRecord failed for ${ev.type}: ${e.message}`); } }
  };
  // the trait the flaw embodies, changed by how the night ended (design/TRAITS.md section 2)
  const traitChange = (verb) => { if (!flaw.trait) return; const mark = markOf(verb); emit({ type: "trait.change", flaw: flawId, trait: flaw.trait, mark, delta: OUTCOME_MARK[mark] }); };
  const api = {
    state: S, flaw,
    stage() {
      if (S.phase === "fight") return { kind: "fight", flaw: flawId, ...(adversary ? { movement: S.movement, name: HOST.movements[S.movement].name } : {}) };
      if (S.phase === "offer") return { kind: "offer", boon: S.offer };
      if (S.phase === "morning") return { kind: "morning", beat: S.morning };
      return { kind: "over" };
    },
    world(G2) {
      if (S.phase !== "fight") throw new Error("inner run: no fight now");
      return adversary ? createHostWorld({ G: G2, movement: S.movement, limbs: limbsOf(kept, heard), seed, levels, boons: S.boons })
        : createInnerWorld({ G: G2, flaw, seed, levels, boons: S.boons, arena });
    },
    finish(W) {
      const R = W.result || { outcome: "down", reason: "none", verb: "lose" }; S.result = { outcome: R.outcome, verb: R.verb, reason: R.reason };
      if (adversary) {
        const M = HOST.movements[S.movement], v = M.verbs[R.verb] || M.verbs.lose || Object.values(M.verbs)[0];
        emit({ type: "inner.outcome", flaw: "host", movement: M.id, verb: R.verb, outcome: R.outcome, scene: v.beat.scene, beat: v.beat.text });
        if (S.movement < HOST.movements.length - 1) { S.movement++; return; }
        S.morning = v.beat; S.phase = "morning"; return;
      }
      if (isForce(R.outcome)) {
        const F = flaw.force;
        emit({ type: "inner.outcome", flaw: flawId, verb: "force", outcome: R.outcome, scene: F.beat.scene, beat: F.beat.text, dc: { ...F.dc } });
        traitChange("force");
        S.morning = F.beat;
        // one offer, the flaw's own, only after force (06-SYSTEMS section 4); the player can decline it
        // a boon with no cost is never offered (no boon is free: 08-ARENA rule 4)
        if (flaw.boon && !flaw.boon.cost) console.error(`inner run: ${flawId}'s boon ${flaw.boon.id} has no cost; not offered`);
        else if (flaw.boon) { S.offer = { ...flaw.boon }; S.phase = "offer"; return; }
        S.phase = "morning"; return;
      }
      const v = flaw.verbs[R.verb] || flaw.verbs.lose;
      emit({ type: "inner.outcome", flaw: flawId, verb: R.verb, outcome: R.outcome, scene: v.beat.scene, beat: v.beat.text });
      traitChange(R.verb);
      S.morning = v.beat; S.phase = "morning";
    },
    choose(i) {
      if (S.phase !== "offer") return;
      if (i === 0) { const b = S.offer; S.boons.push(b); emit({ type: "boon.cost", flaw: flawId, boon: b.id, name: b.name, who: b.cost.who, scene: b.cost.scene, beat: b.cost.beat }); }
      S.offer = null; S.phase = "morning";
    },
    // the morning: the next scene plays; the run is over
    wake() { if (S.phase === "morning") S.phase = "over"; },
    summary() { return { flaw: flawId, verb: S.result && S.result.verb, beat: S.morning && S.morning.text }; },
  };
  return api;
}

// the Host's limbs: the flaws this run kept (beaten by force); a run that kept none brings the last self-lie it
// heard, as one limb (04-ADVERSARY section 1.2: smaller, never absent)
export function limbsOf(kept = [], heard = []) {
  const k = kept.filter((id) => FLAWS[id]); if (k.length) return k;
  const last = [...(heard || [])].reverse().map((s) => (typeof s === "string" ? s : s.id)).map((sl) => Object.values(FLAWS).find((f) => f.selflie === sl)).find(Boolean);
  return [last ? last.id : "prudence"];
}
