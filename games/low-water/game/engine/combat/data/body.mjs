// Body moves: footwork, catching, shoving, grappling and the pocket thing (SYSTEMS-FULL 18.3).
// The roll takes one of three forms by load (cleanroom/spec/COMBAT-FEEL.md 1.1): a light load
// dashes, a medium load rolls and slides out of it (the slide can be hit), a heavy load hops short
// and gets up slowly. In knee-deep water or mud any roll is a lurch with a small window (18.3).
// The sidestep is a separate, cheap, short step.
// Frames re-tuned 2026-10-17 toward the reference's proportions (COMBAT-FEEL v2 1.2: the light
// dodge mostly invulnerable up front, the roll trading commitment for distance, the heavy form
// keeping its window but doubling the recovery), scaled to Low Water's smaller arenas. A strike
// may come out of a dodge once the dodge allows it (cancel windows); TUNING.md has the sources.
// Notes kept from the table before it moved to moves.json (P1):
// from behind on an unaware opponent (sim/stealth.mjs): the small go down, the big are struck
import MOVES from "./moves.json" with { type: "json" };
export const BODY = MOVES.body; // the data: moves.json

export const BODY_MOVESET = MOVES.bodyMoveset; // the data: moves.json
