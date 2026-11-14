// The arena's bosses (coordinator, 2026-10-21): each has phases by standing left, a pattern per phase that
// repeats in a fixed order so a player can learn it, a rest after each round of the pattern (the punish
// window), moves that use the arena (a charge that dazes the boss when it meets a wall, a pull toward the
// deep water), and telegraphs of their own (combat/arena/figure.mjs, ui/fightways.mjs drawTells). Driven
// by combat/ai/boss.mjs. Placeholder names and dressing; any pitch reskins them.
//
//   foreman   (from f.keel: the hammer)   P1 slam, sweep, sweep, charge; rest 1.6 s
//             below 60%: the slam sends a ring out along the ground; charge twice; rest 1.2 s
//             below 25%: no rest after the second charge, a ring slam to close; the shout calls the yard
//   warden    (from f.warden: the hook and chain)   P1 hook (pulls Lamb in), chain spin, thrust; rest 1.5 s
//             below 50%: whistles two hands in (once), then hook, drag toward the deep water, chain; rest 1.1 s
import MOVES from "./moves.json" with { type: "json" };

// Notes kept from the table before it moved to moves.json (P1):
// The Quota's other bosses (design/quota/05-ARENA.md): the Debt Man drags toward the ropes (anchors.ropes);
// the Clearance Sergeant (era 5's story fight) bashes with a riot shield where the warden pulls, swings a
// baton where it thrusts, and whistles two constables
// the Requisition Captain (The Quota, design/quota/05-ARENA.md): the warden's pattern with a grain hook,
// dragging toward the granary's chute (anchors.chute), whistling two corporals in
export const BOSS_SPECIALS = MOVES.bossSpecials; // the data: moves.json

export const BOSSES = {
  // the Club Champion: the foreman's moveset with gloves (the slam a straight right, the ring a body shot)
  champion: { from: "f.keel", name: "The Club Champion", reskin: "foreman",
    defaults: { tool: "w.hands", standing: 38, breath: 12, poise: 14, speed: 2.9, accel: 18, turn: 6, radius: 0.55, height: 2.1, grip: 9 },
    look: { coat: 0.85, trim: 0.2, hat: "none", stoop: 0.2, wide: 1.3, scale: 1.1 },
    specials: ["foreman.slam", "foreman.ringslam", "foreman.sweep", "foreman.charge", "foreman.dazed", "foreman.call", "boss.roar"], phases: null },
  // the Debt Man: the warden's pattern with a chain and a ledger, dragging toward the ropes
  debtman: { from: "f.warden", name: "The Debt Man", reskin: "warden",
    defaults: { tool: "w.boathook", standing: 36, breath: 12, poise: 12, speed: 2.9, accel: 18, turn: 6, radius: 0.52, height: 2.0, grip: 8 },
    look: { coat: 0.05, trim: 0.9, hat: "tall", stoop: 0.05, wide: 1.15, scale: 1.08, longcoat: true },
    specials: ["warden.hook", "warden.spin", "warden.thrust", "debtman.drag", "debtman.whistle", "boss.roar"],
    phases: [
      { until: 0.5, rest: 96, pattern: [{ move: "warden.hook", min: 1.8, max: 5.0 }, { move: "warden.spin", min: 0, max: 2.6 }, { move: "warden.thrust", min: 0.6, max: 3.4 }] },
      { until: 0, rest: 70, opening: [{ move: "debtman.whistle", min: 0, max: 99 }], pattern: [{ move: "warden.hook", min: 1.8, max: 5.0 }, { move: "debtman.drag", min: 0.6, max: 4.0 }, { move: "warden.spin", min: 0, max: 2.6 }, { move: "warden.thrust", min: 0.6, max: 3.4 }] },
    ] },
  // the Clearance Sergeant, Leon Brack (era 5's story fight): the warden's pattern with a riot shield
  sergeant: { from: "f.warden", name: "The Clearance Sergeant", reskin: "warden",
    defaults: { tool: "w.stick", standing: 38, breath: 12, poise: 13, speed: 2.8, accel: 16, turn: 6, radius: 0.55, height: 1.95, grip: 8, frontGuard: 0.4 },
    look: { coat: 0.08, trim: 0.7, hat: "cap", stoop: 0.1, wide: 1.25, scale: 1.08, shield: true },
    specials: ["sergeant.bash", "warden.spin", "sergeant.baton", "sergeant.whistle", "boss.roar"],
    phases: [
      { until: 0.5, rest: 96, pattern: [{ move: "sergeant.bash", min: 0.6, max: 2.6 }, { move: "warden.spin", min: 0, max: 2.6 }, { move: "sergeant.baton", min: 0.4, max: 2.0 }] },
      { until: 0, rest: 70, opening: [{ move: "sergeant.whistle", min: 0, max: 99 }], pattern: [{ move: "sergeant.bash", min: 0.6, max: 2.6 }, { move: "sergeant.baton", min: 0.4, max: 2.0 }, { move: "warden.spin", min: 0, max: 2.6 }, { move: "sergeant.baton", min: 0.4, max: 2.0 }] },
    ] },
  captain: { from: "f.warden", name: "The Requisition Captain",
    defaults: { tool: "w.boathook", standing: 34, breath: 12, poise: 12, speed: 2.9, accel: 18, turn: 6, radius: 0.52, height: 2.3, grip: 8 },
    look: { coat: 0.1, trim: 0.8, hat: "band", stoop: 0.05, wide: 1.2, scale: 1.15, longcoat: true },
    specials: ["warden.hook", "warden.spin", "warden.thrust", "captain.drag", "captain.whistle", "boss.roar"],
    phases: [
      { until: 0.5, rest: 96, pattern: [{ move: "warden.hook", min: 1.8, max: 5.0 }, { move: "warden.spin", min: 0, max: 2.6 }, { move: "warden.thrust", min: 0.6, max: 3.4 }] },
      { until: 0, rest: 70, opening: [{ move: "captain.whistle", min: 0, max: 99 }], pattern: [{ move: "warden.hook", min: 1.8, max: 5.0 }, { move: "captain.drag", min: 0.6, max: 4.0 }, { move: "warden.spin", min: 0, max: 2.6 }, { move: "warden.thrust", min: 0.6, max: 3.4 }] },
    ] },
  foreman: { from: "f.keel", name: "The Foreman",
    defaults: { tool: "w.hammer", standing: 38, breath: 12, poise: 14, speed: 2.7, accel: 16, turn: 5, radius: 0.6, height: 2.4, grip: 9 },
    look: { coat: 0.06, trim: 0.9, hat: "band", stoop: 0.15, wide: 1.4, scale: 1.25, longcoat: true },
    specials: ["foreman.slam", "foreman.ringslam", "foreman.sweep", "foreman.charge", "foreman.dazed", "foreman.call", "boss.roar"],
    phases: [
      { until: 0.6, rest: 110, pattern: [{ move: "foreman.slam", min: 0, max: 2.4 }, { move: "foreman.sweep", min: 0, max: 2.6 }, { move: "foreman.sweep", min: 0, max: 2.6 }, { move: "foreman.charge", min: 3.0, max: 12, back: true }] },
      { until: 0.25, rest: 72, pattern: [{ move: "foreman.ringslam", min: 0, max: 3.0 }, { move: "foreman.sweep", min: 0, max: 2.6 }, { move: "foreman.charge", min: 3.0, max: 12, back: true }, { move: "foreman.charge", min: 3.0, max: 12, back: true }] },
      { until: 0, rest: 40, pattern: [{ move: "foreman.call", min: 0, max: 99 }, { move: "foreman.sweep", min: 0, max: 2.6 }, { move: "foreman.charge", min: 3.0, max: 12, back: true }, { move: "foreman.charge", min: 3.0, max: 12, back: true, norest: true }, { move: "foreman.ringslam", min: 0, max: 3.0 }] },
    ] },
  warden: { from: "f.warden", name: "The Warden",
    defaults: { tool: "w.boathook", standing: 40, breath: 12, poise: 12, speed: 2.9, accel: 18, turn: 6, radius: 0.55, height: 2.5, grip: 8 },
    look: { coat: 0.12, trim: 0.75, hat: "tall", stoop: 0.1, wide: 1.25, scale: 1.2 },
    specials: ["warden.hook", "warden.spin", "warden.thrust", "warden.drag", "warden.whistle", "boss.roar"], items: { mud: 0 },
    phases: [
      { until: 0.5, rest: 90, pattern: [{ move: "warden.hook", min: 1.8, max: 5.0 }, { move: "warden.spin", min: 0, max: 2.6 }, { move: "warden.thrust", min: 0.6, max: 3.4 }] },
      { until: 0, rest: 66, opening: [{ move: "warden.whistle", min: 0, max: 99 }], pattern: [{ move: "warden.hook", min: 1.8, max: 5.0 }, { move: "warden.drag", min: 0.6, max: 4.0 }, { move: "warden.spin", min: 0, max: 2.6 }, { move: "warden.thrust", min: 0.6, max: 3.4 }] },
    ] },
};
// a reskin with no phases of its own plays its model's
for (const b of Object.values(BOSSES)) if (!b.phases && b.reskin) b.phases = BOSSES[b.reskin].phases;
