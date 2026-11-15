// The inner arena's bosses: the character's own traits made flesh, each speaking the self-lie the trait told him
// (design/TRAITS.md, the traits pass of 2026-10-23; design/spine-plan/08-ARENA.md, 10-INFERNO.md, inferno/02 and 03).
// Every record names its `trait` (a voice id, combat/data/traits.mjs); `town`, the name shown, is the trait's. One record per boss, the `@flaw` of 08-ARENA section 6 and 06-SYSTEMS section 5, kept as
// data here beside the moves it needs (the ruling in combat/PROGRESS.md 29). Built in the self-critique's order
// (DECISIONS 2), era 2 first: Steady Hand (PRUDENCE, id prudence, was received), Friday, He's With Me, Nearest One, then Only and Forty
// Carts; then the Adversary (combat/data/host.mjs); then era 5's Order and Everybody Says (combat/data/flaws-e5.mjs,
// 2026-10-23), with the Descent (combat/arena/descent.mjs); then the last four, Fond of Them, Under the Goats, The
// Long Barn and The Figure (combat/data/flaws-later.mjs, 2026-10-23). All twelve are built. The traits pass adds
// three lesser beings, JEALOUSY, DREAD and SHAME (combat/data/flaws-traits.mjs), so every voice has a body.
//
//   { id, n (the bestiary's shared number), era, liar, line (furrowe | brack), tool (the character's in the dream),
//     town (the name shown: the town's virtue), sin (the designer's label, never shown), method,
//     selflie (the @selflie id in content/quota/q_readback.lwd), pending (a NEW LINE not yet in the scenes),
//     hinge { after (the scene file whose night arms it), when },
//     arena (combat/data/arenas-inner.mjs), anchor { name, key, draw } (the one object in the base look),
//     body { form, defaults }, specials { id: move }, phases [{ name, until, rest, pattern, opening, still,
//       hands, trigger { kind: time | still | grown | near, ... }, morph { look, scale, bowl, dim, lights }, voice }],
//     strike [{ kind: sign | clap | breath | grow, ... }] (what each blow the player lands does),
//     floor (a share of standing it never falls below), meantToLose, limit (frames),
//     verbs { refuse | endure | yield | lose | name: { ..., beat { scene, text } } } (the non-force ends),
//     trap { verb: why } (a verb the fight seems to offer and does not),
//     force { ends: fall | floor | grown, atFloor, dc (falls only), beat },
//     boon { id, name, what, effect, cost { who (@char), scene, beat } } (offered only after force),
//     faces (the liar's line only), objects, lines [{ at, voice, text, proposal }], senses }
import { PRUDENCE, ONLY } from "./flaws-ned.mjs";
import { FORTY, FRIDAY, WITHME, NEAREST, CHECK } from "./flaws-will.mjs";
import { HOST } from "./host.mjs";
import { ORDER as ORDER_FLAW, SAYS } from "./flaws-e5.mjs";
import { FOND, GOATS, BARN, FIGURE } from "./flaws-later.mjs";
import { JEALOUSY, DREAD, SHAME } from "./flaws-traits.mjs";
import { TRAIT_OF_FLAW } from "./traits.mjs";
import { FIGHTS, applyFight } from "./fights.mjs";

export const FLAWS = { prudence: PRUDENCE, friday: FRIDAY, withme: WITHME, nearest: NEAREST, only: ONLY, forty: FORTY, check: CHECK, order: ORDER_FLAW, says: SAYS, fond: FOND, goats: GOATS, barn: BARN, figure: FIGURE, jealousy: JEALOUSY, dread: DREAD, shame: SHAME };
// every boss a real fight (combat/data/fights.mjs, the rework of 2026-10-23): its moveset, phases and ground
for (const [id, f] of Object.entries(FIGHTS)) applyFight(FLAWS[id], f);
// the order of work and of the inner arena page's menu (the self-critique's six first, era 2's first of those)
export const ORDER = ["fond", "prudence", "friday", "withme", "nearest", "only", "forty", "goats", "barn", "figure", "order", "says"];
// lesser flaws: fought in the Descent only, never armed by a hinge of their own
export const LESSER = ["check", "jealousy", "dread", "shame"];
// every voice has exactly one being (design/TRAITS.md): a record whose trait disagrees with the table is a build error
for (const [id, f] of Object.entries(FLAWS)) if (TRAIT_OF_FLAW[id] !== f.trait) throw new Error(`flaws: ${id} names trait ${f.trait}, the table says ${TRAIT_OF_FLAW[id]}`);
export { HOST };


// every inner move, for the world's move table and the telegraph check
export const INNER_SPECIALS = Object.assign({}, ...Object.values(FLAWS).map((f) => f.specials), HOST.specials);

// the flaws a hinge arms in a run: its self-lie heard (G.state.selfLies) and the scene behind it passed
// (08-ARENA section 3: "A flaw exists in a run only if the character heard its self-lie")
export function armed(flawId, heard = []) {
  const f = FLAWS[flawId]; if (!f || f.lesser) return false;
  const lies = [f.selflie, ...(f.also || [])]; // a lie that returns in a later era (Order: Will's in era 3, Leon's in era 5)
  return heard.some((s) => lies.includes(typeof s === "string" ? s : s.id));
}
