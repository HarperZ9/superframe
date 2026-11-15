// The Descent (design/spine-plan/inferno/06-SYSTEMS.md section 3; design/eras/era5.md section 9; design/TRAITS.md
// section 4): once, the night before the clearance day, before the Adversary. Since the traits pass (2026-10-23) the
// Descent is four gates, one for each great trait (the compartments: HARDNESS, FEAR, SUSPICION, AUTHORITY), taken from
// the weakest of the four in him to the strongest, so the deepest gate is the part of him he fed most:
//   - a gate is armed when a trait under it was fed (its level at FED or over), beaten by force (winning isn't healing:
//     a trait cut back comes back here), lost to, or, for a lesser trait (Nobody Checks), its self-lie was heard;
//   - an armed gate's being is the great trait's body (combat/arena/forms5.mjs) fighting as its most-fed trait, in that
//     trait's last phase on that trait's own ground, narrowed by one ring for every gate before it (bowl inset, at
//     most 2), with the next most-fed trait's blows in its hands: the sin it has become, never named on screen;
//   - a gate where nothing was fed is a yard in snow with the stove door open, and the player walks through it.
// Between gates there is no offer card and no mend beyond the ladder's mendWave; standing carries from gate to gate.
// After the last gate the Adversary comes (createInnerRun({ flaw: "host", kept, heard })). No tally: the Descent
// keeps no count, records nothing of its own and writes no fate (08-ARENA rules 5 and 8); each gate's outcome goes
// out through onRecord as an inner.outcome with ring: true, the scene being the clearance day's.
//   const D = createDescent({ resolved: { flawId: verb }, heard, levels, seed, onRecord })
//   D.rings           [{ gate, flaw, second, empty }]   in order (the ids: combat/data/traits.mjs)
//   D.stage()         { kind: "ring", ring, flaw, gate, empty } | { kind: "ice", kept }
//   D.world(G)        the gate's world (an inner world in the last phase, or the snow yard)
//   D.finish(W)       reads the gate's outcome and goes on to the next gate, or to the ice
import { FLAWS } from "../data/flaws.mjs";
import { COMPARTMENT_TRAITS, VOICE_TRAITS, FED } from "../data/traits.mjs";
import { INNER_ARENAS, bowl } from "../data/arenas-inner.mjs";
import { isForce } from "../data/flaws-common.mjs";
import { createInnerWorld } from "./innerworld.mjs";
import { createWorld } from "../sim/world.mjs";
import { innerLamb } from "./innerspawn.mjs";
import { LADDER } from "./run.mjs";
import { dhypot } from "../sim/math.mjs";

const selfliesOf = (heard) => new Set((heard || []).map((s) => (typeof s === "string" ? s : s.id)));
// the order of the gates when two great traits stand level: fear first, the hands last
const GATE_ORDER = ["nose", "pen", "hat", "coat"];

// how much the run fed a trait: its level in him, more when it was cut back (it comes back) and most when it took him
export function fedOf(voice, resolved = {}, levels = {}, lies = new Set()) {
  const f = FLAWS[VOICE_TRAITS[voice].flaw], verb = resolved[f.id], lesserHeard = f.lesser && lies.has(f.selflie);
  const kept = verb === "force" || verb === "lose" || lesserHeard;
  return { voice, flaw: f.id, kept, score: (+levels[voice] || 3) + (verb === "lose" ? 3 : verb === "force" || lesserHeard ? 2 : 0) };
}

// the gates of a run: resolved maps each flaw it met to the verb its inner fight ended by ("force" when beaten)
export function ringsOf(resolved = {}, heard = [], levels = {}) {
  const lies = selfliesOf(heard), out = [];
  for (const [gate, T] of Object.entries(COMPARTMENT_TRAITS)) {
    const fed = T.voices.map((v) => fedOf(v, resolved, levels, lies)).sort((a, b) => b.score - a.score || +b.kept - +a.kept || T.voices.indexOf(a.voice) - T.voices.indexOf(b.voice));
    const armed = fed.some((x) => x.kept) || fed[0].score >= FED;
    out.push({ gate, flaw: fed[0].flaw, second: fed[1].flaw, era: FLAWS[fed[0].flaw].era, empty: !armed, level: +levels[gate] || 3 });
  }
  return out.sort((a, b) => a.level - b.level || GATE_ORDER.indexOf(a.gate) - GATE_ORDER.indexOf(b.gate));
}

// a flaw in its last phase, from the start of the ring
export function lastPhaseOf(flaw) {
  const P = flaw.phases[flaw.phases.length - 1];
  return { ...flaw, phases: [{ ...P, until: 0, trigger: null, morph: null }] };
}

// a gate's being: the great trait's body fighting as its most-fed trait in that trait's last phase, with the next
// trait's plain blows (no calls, no ground, no drag toward a place that is not here) added to its hands at a lighter
// weight. Its id stays the trait's flaw, so the fight's own rules (a catch that heals, a mirror) and its endings hold.
export function gateFlaw(ring) {
  const T = COMPARTMENT_TRAITS[ring.gate], A = lastPhaseOf(FLAWS[ring.flaw]), B = FLAWS[ring.second], P = A.phases[0];
  const plain = (id) => { const m = B && B.specials[id]; return !!m && !!(m.hits || []).length && !m.summon && !m.hazard && !m.toward && !m.shout; };
  const borrowed = B && B.id !== A.id ? ((B.phases[B.phases.length - 1] || {}).attacks || []).filter((x) => plain(x.move)).map(({ then, ...x }) => ({ ...x, w: +(x.w * 0.6).toFixed(2) })) : [];
  const specials = { ...A.specials };
  for (const x of borrowed) { const m = B.specials[x.move]; specials[x.move] = m; if (m.wallStun && B.specials[m.wallStun]) specials[m.wallStun] = B.specials[m.wallStun]; } // a charge brings its daze
  const name = T.name.charAt(0) + T.name.slice(1).toLowerCase();
  return { ...A, town: name, gate: ring.gate, second: B ? B.id : null, specials,
    // a great trait is bigger than any one trait under it, and the room gives way round it (DECISIONS-2026-10-22,
    // staging call 2: the amalgamations may exceed the room)
    body: { ...A.body, form: T.form, defaults: { ...A.body.defaults, height: +(A.body.defaults.height * 1.5).toFixed(2), radius: +(A.body.defaults.radius * 1.2).toFixed(2) } }, phases: [{ ...P, ...(P.attacks ? { attacks: [...P.attacks, ...borrowed] } : {}) }],
    lines: [...(T.lines || []), ...(A.lines || []).filter((l) => l.at !== "start")] };
}

// the empty ring: the yard in snow, the stove door open at the far wall; walking to it ends the ring
export function createSnowRing({ G, seed = 1, levels = {}, hp = null }) {
  const A = INNER_ARENAS.snow, L = innerLamb({ tool: "w.hands" }, { levels });
  L.x = A.spawns.lamb[0]; L.z = A.spawns.lamb[1];
  const W = createWorld({ G, arena: { ...A, rows: [...A.rows] }, fighters: [L], seed, barks: false });
  if (hp != null) W.lamb().hp = Math.min(W.lamb().hpMax, hp);
  W.inner = { flaw: "snow", kind: "snow", bossIds: [], numbers: false, anchor: { name: "the stove door, open", key: "anchor", draw: "stove" } };
  const [dx, dz] = A.anchors.stove[0], step0 = W.step;
  W.step = (inputs = {}) => {
    if (W.result) return [];
    step0(inputs);
    const P = W.lamb();
    if (!W.result && P && dhypot(P.x - dx, P.z - dz) <= 1.2) { W.result = { outcome: "passed", reason: "door", tick: W.tick, verb: null, inner: true }; W.emit({ type: "end", outcome: "passed", inner: true }); }
    return W.events;
  };
  return W;
}

export function createDescent({ resolved = {}, heard = [], levels = {}, seed = 1, onRecord = null } = {}) {
  const rings = ringsOf(resolved, heard, levels), S = { i: 0, hp: null, kept: Object.keys(resolved).filter((id) => resolved[id] === "force" || resolved[id] === "lose") };
  const emit = (ev) => { if (onRecord) { try { onRecord(ev); } catch (e) { console.error(`descent: onRecord failed for ${ev.type}: ${e.message}`); } } };
  return {
    rings, state: S,
    stage() { return S.i < rings.length ? { kind: "ring", ring: S.i, flaw: rings[S.i].flaw, gate: rings[S.i].gate, empty: rings[S.i].empty } : { kind: "ice", kept: [...S.kept] }; },
    world(G) {
      const R = rings[S.i]; if (!R) throw new Error("descent: no ring now; the ice is next");
      if (R.empty) return createSnowRing({ G, seed: seed + S.i, levels, hp: S.hp });
      const f = gateFlaw(R), base = INNER_ARENAS[f.arena], arena = { ...base, rows: bowl(base.rows, Math.min(2, S.i)) };
      const W = createInnerWorld({ G, flaw: f, seed: seed + S.i, levels, arena });
      if (S.hp != null) W.lamb().hp = Math.min(W.lamb().hpMax, S.hp);
      return W;
    },
    finish(W) {
      const R = rings[S.i], res = W.result || { outcome: "down", verb: "lose", reason: "none" }, L = W.lamb();
      if (!R.empty) {
        const f = FLAWS[R.flaw], v = isForce(res.outcome) ? f.force : f.verbs[res.verb] || f.verbs.lose;
        emit({ type: "inner.outcome", flaw: R.flaw, gate: R.gate, ring: true, verb: isForce(res.outcome) ? "force" : res.verb, outcome: res.outcome, scene: "e5_day", beat: v.beat.text });
      }
      // standing carries; a breath between rings (the ladder's mendWave), never a full mend; a fall leaves him at a quarter
      const hp = L ? (L.fallen || res.outcome === "down" ? L.hpMax * 0.25 : L.hp) : null;
      S.hp = hp == null ? null : Math.min(L.hpMax, hp + L.hpMax * LADDER.mendWave);
      S.i++;
    },
  };
}
