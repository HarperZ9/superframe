// The movement stick, shaped (engine PROGRESS 37, 2026-10-22). A radial dead zone with hysteresis and a
// rescale, so a stick resting near the edge of the dead zone never flickers between still and moving:
//   - it turns on past STICK.dead and off only under STICK.release;
//   - while on, the length runs from STICK.floor (just over combat's 0.2, below which the sim reads no
//     direction: combat/sim/fighter.mjs MOVE_INPUT) at the dead zone's edge to 1 at full tilt, continuously;
//   - direction is the stick's own; the length is never over 1.
// The old rule (on at 0.35, the raw length passed on) stepped from 0 to 1.2 m/s at the edge and flickered with
// a stick's noise there; tests/stick.test.mjs keeps that rule as its control.
export const STICK = { dead: 0.3, release: 0.24, floor: 0.21 };
export function shapeStick(ax, ay, wasOn = false, S = STICK) {
  const m = Math.hypot(ax, ay), on = m >= (wasOn ? S.release : S.dead);
  if (!on || m === 0) return { x: 0, z: 0, on: false };
  const k = Math.min(1, S.floor + ((1 - S.floor) * Math.max(0, m - S.dead)) / (1 - S.dead)) / m;
  return { x: ax * k, z: ay * k, on: true };
}
