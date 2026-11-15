// What every inner boss shares (design/spine-plan/inferno/02-BESTIARY-A.md section 1, the nine rules; 08-ARENA.md
// section 4; DECISIONS-2026-10-22.md). The record each boss fills is described in combat/data/flaws.mjs.
import { BOSS_SPECIALS } from "./bosses.mjs";

// the verbs that end a fight without force (06-SYSTEMS.md section 2), and the outcome each ends as
export const VERBS = { refuse: "fled", endure: "endured", yield: "laid", lose: "down", name: "talk" };
// force: a boss brought down by blows (or to its floor, or grown to fill the arena) ends as `forced`, never `win`
export const FORCE = new Set(["win", "forced"]);
export const isForce = (outcome) => FORCE.has(outcome);

// what no inner outcome may write (08-ARENA rule 5; spine-plan/03-FATES.md): a fate, a witness beat
export const FATE_FIELDS = ["bowls", "taken", "members", "end", "witness", "fate"];
// numbers a non-force ending may not carry (DECISIONS 4: "Endings without force change only the scene that follows, never a number")
export const NUMBER_FIELDS = ["dc", "level", "levels", "stat", "stock", "standing", "breath", "boon"];

// Faces (rule 6): a boss wears only its liar's line. Ids are the lines' people in the Quota's cast
// (content/quota: @char q.<id>) and the later eras' protagonists (design/quota/02-HOUSEHOLDS.md) not yet in it.
export const LINES = { furrowe: ["abel", "ned", "pell", "ruth", "era5"], brack: ["josh", "will", "ann", "leon"] };
// never a part of any boss: the Hesh (and the town Hesh by marriage), the children, the world's perpetrators
export const NEVER_FACES = {
  hesh: ["tomas", "anni", "aaron", "bet", "ilo", "dorrah", "tesk", "oren"],
  child: ["davey", "rose", "aaron", "anni", "ryan", "kit"],
  perpetrator: ["captain", "holt", "gedge", "pask", "krall", "mott", "fenn", "iris"],
};

// A boss move like an existing one, with changes (the bosses reskin the Foreman's and the Warden's moves:
// 06-SYSTEMS.md section 1).
export const like = (id, over = {}) => { const m = BOSS_SPECIALS[id]; if (!m) throw new Error(`flaws: no boss move ${id}`); return { ...m, ...over }; };
export const H = (arc, r, extra = {}) => ({ arc, r, ...extra });
export const step = (move, min, max, extra = {}) => ({ move, min, max, ...extra });
// a beat the next scene plays: the scene file it belongs in and what happens, a PROPOSAL for the story lead
export const beat = (scene, text) => ({ scene, text, proposal: true });
