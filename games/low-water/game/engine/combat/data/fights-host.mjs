// The Adversary's three movements as real fights (the rework of 2026-10-23; see combat/data/fights-a.mjs). The
// Accuser fights from his desk with a cane and his fists and closes the distance fast; the Host is a great body with
// the run's kept lies as limbs that fight beside it, on ice that spreads by phase; the One Who Withdraws strikes and
// is gone, and comes again from behind. Force ends each movement; facing it, the stillness and the whisper stay as
// optional layers.
import { swing, late, lunge, heavy, sweep, grab, slam } from "./innermoves.mjs";
import { A, F, END } from "./fights-a.mjs";

const cane = swing({ s: 24, dmg: 1.2, arc: [-40, 40], r: [0.3, 2.4] });
export const ACCUSER_FIGHT = {
  tune: { standing: 1, harm: 1.15 }, // tools/innerduel.mjs, 2026-10-23
  body: { tool: "w.hands", standing: 46, breath: 14, poise: 13, speed: 2.4, accel: 14, turn: 5, radius: 0.5, height: 1.9, grip: 6 },
  moves: {
    "accuser.cane": cane, "accuser.cane.late": late(cane, 20), "accuser.cane2": swing({ s: 22, rec: 20, dmg: 1.0, arc: [-60, 30], r: [0.3, 2.2] }),
    "accuser.hammer": heavy({ s: 38, dmg: 1.9 }),
    "accuser.clinch": grab({ s: 36, dmg: 2.2 }),
    "accuser.step": lunge({ s: 28, dmg: 1.2, reach: 8 }),
    "accuser.drive": slam({ s: 46, dmg: 1.4, r: [0, 2.4], hazard: { kind: "lane", axis: "x", at: "lamb", w: 2.0, lead: 42, dmg: 1.5, id: "crack" } }),
  },
  phases: [
    { name: "the desk", until: 0.5, rest: 70, space: [2.0, 3.4],
      attacks: [A("accuser.cane", 0, 2.3, 2, { then: [F("accuser.cane2", 1, [F("accuser.hammer", 1), END(2)]), F("accuser.cane.late", 1), END(2)] }), A("accuser.hammer", 0, 2.4, 1, { cool: 180 }), A("accuser.step", 3, 7.5, 1.2, { cool: 180 })] },
    { name: "the floor", until: -1, rest: 50, space: [1.8, 3.0], signature: { move: "accuser.drive", every: 480, first: 160, min: 0, max: 8, rest: 110 },
      attacks: [A("accuser.cane", 0, 2.3, 2, { then: [F("accuser.cane2", 1, [F("accuser.clinch", 1), F("accuser.hammer", 1)]), F("accuser.cane.late", 1.2), END(1)] }), A("accuser.clinch", 0, 1.8, 1.2, { cool: 200 }),
        A("accuser.step", 3, 7.5, 1.2, { cool: 140 })] },
  ],
};

const claw = swing({ s: 26, dmg: 1.4, arc: [-55, 55], r: [0.4, 2.8] });
export const HOST_FIGHT = {
  tune: { standing: 0.85, harm: 0.9 }, // tools/innerduel.mjs, 2026-10-23
  body: { tool: "w.hands", standing: 70, breath: 16, poise: 18, speed: 1.8, accel: 10, turn: 4, radius: 0.8, height: 4.4, grip: 10 },
  moves: {
    "host.claw": claw, "host.claw.late": late(claw, 20), "host.claw2": swing({ s: 24, rec: 22, dmg: 1.2, arc: [-70, 20], r: [0.4, 2.6] }),
    "host.wing": slam({ s: 46, dmg: 1.8, r: [0, 3.0], hazard: { kind: "ring", at: "boss", r: 3.0, lead: 42, dmg: 1.3, id: "wing" } }),
    "host.grip": grab({ s: 36, dmg: 2.6, r: [0.3, 2.2] }),
    "host.stride": lunge({ s: 30, dmg: 1.6, reach: 7, r: [0.3, 2.0] }),
    "host.sweep": sweep({ s: 40, dmg: 1.6, r: [0.4, 3.2] }),
  },
  phases: [
    { name: "the Host", until: 0.6, rest: 75, space: [2.2, 3.6], signature: { move: "host.wing", every: 600, first: 300, min: 0, max: 3.2, rest: 110 },
      attacks: [A("host.claw", 0, 2.7, 2, { then: [F("host.claw2", 1, [F("host.claw.late", 1), END(2)]), F("host.claw.late", 1), END(2)] }), A("host.stride", 3, 7, 1.2, { cool: 200 }), A("host.sweep", 0, 3.0, 0.8, { cool: 260 })] },
    { name: "the ice", until: 0.3, rest: 55, space: [2.0, 3.2], ground: { cells: { ch: "f", at: [[10, 6, 5]] } }, signature: { move: "host.wing", every: 480, first: 160, min: 0, max: 3.2, rest: 100 },
      attacks: [A("host.claw", 0, 2.7, 2, { then: [F("host.claw2", 1, [F("host.grip", 1), END(1)]), F("host.grip", 1), END(1)] }), A("host.grip", 0, 2.1, 1, { cool: 220 }),
        A("host.stride", 3, 7, 1.2, { cool: 160 }), A("host.sweep", 0, 3.0, 1, { cool: 220 })],
      hazards: [{ kind: "ring", at: "lamb", r: 2.2, every: 420, first: 200, lead: 42, dmg: 1.3, knockdown: true, id: "crack" }] },
    { name: "the cold", until: -1, rest: 45, space: [1.8, 3.0], ground: { cells: { ch: "f", at: [[10, 6, 12]] } }, signature: { move: "host.wing", every: 400, first: 100, min: 0, max: 3.2, rest: 100 },
      attacks: [A("host.claw", 0, 2.7, 2, { then: [F("host.claw2", 1.5, [F("host.grip", 1), F("host.sweep", 1)]), F("host.claw.late", 1.5), END(1)] }), A("host.grip", 0, 2.1, 1.2, { cool: 180 }),
        A("host.stride", 3, 7, 1.4, { cool: 120 })],
      hazards: [{ kind: "ring", at: "lamb", r: 2.2, every: 330, first: 120, lead: 40, dmg: 1.3, knockdown: true, id: "crack" }] },
  ],
};

// a limb of the Host: a kept lie that fights beside it, two moves, killable
export const LIMB_MOVES = {
  "host.limb": swing({ s: 28, dmg: 1.0, arc: [-40, 40], r: [0.3, 2.3] }),
  "host.limb.lunge": lunge({ s: 30, dmg: 1.0, reach: 6 }),
};
export const LIMB_PHASES = [{ name: "limb", until: -1, rest: 140, space: [2.2, 4.0], attacks: [A("host.limb", 0, 2.2, 2), A("host.limb.lunge", 2.6, 6, 1, { cool: 300 })] }];

const cut = swing({ s: 22, rec: 20, dmg: 1.2, arc: [-50, 50], r: [0.3, 2.2] });
export const WITHDRAWS_FIGHT = {
  tune: { standing: 1, harm: 1.4 }, // tools/innerduel.mjs, 2026-10-23
  body: { tool: "w.hands", standing: 40, breath: 14, poise: 10, speed: 3.2, accel: 20, turn: 7, radius: 0.45, height: 1.9, grip: 6 },
  moves: {
    "withdraws.cut": cut, "withdraws.cut.late": late(cut, 22), "withdraws.cut2": swing({ s: 24, rec: 22, dmg: 1.3, arc: [-20, 60], r: [0.3, 2.3] }),
    // it goes: back out of reach with its safe frames, then comes again
    "withdraws.go": { kind: "attack", startup: 6, active: 0, recovery: 22, stamina: 1, iframes: [0, 24], root: [[0, 20, -7]], hits: [] },
    "withdraws.come": { ...lunge({ s: 30, a: 8, dmg: 1.6, reach: 10, r: [0.2, 1.6] }), iframes: [0, 18], parryable: false, tell: { at: [0, 29], kind: "pounce" } },
    "withdraws.take": grab({ s: 36, dmg: 2.4 }),
    "withdraws.whisper": slam({ s: 46, dmg: 1.2, r: [0, 2.2], hazard: { kind: "ring", at: "lamb", r: 2.0, lead: 42, dmg: 1.4, knockdown: true, id: "whisper" } }),
  },
  phases: [
    { name: "the yard", until: 0.5, rest: 65, space: [2.4, 4.0],
      attacks: [A("withdraws.cut", 0, 2.1, 2, { then: [F("withdraws.cut2", 1, [F("withdraws.go", 1), END(1)]), F("withdraws.cut.late", 1), F("withdraws.go", 1)] }), A("withdraws.come", 3.5, 9, 1.4, { cool: 180 })] },
    { name: "first light", until: -1, rest: 45, space: [2.2, 3.6], signature: { move: "withdraws.whisper", every: 420, first: 120, min: 0, max: 9, rest: 100 },
      attacks: [A("withdraws.cut", 0, 2.1, 2, { then: [F("withdraws.cut2", 1, [F("withdraws.take", 1), F("withdraws.go", 1)]), F("withdraws.cut.late", 1.2), F("withdraws.go", 1)] }),
        A("withdraws.take", 0, 1.8, 1, { cool: 200 }), A("withdraws.come", 3.5, 9, 1.6, { cool: 140 })] },
  ],
};
