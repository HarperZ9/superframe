// Pressure: how hard opponents press Lamb. A fight is short in a night measured in minutes, so the
// pressure rises with time and with passivity:
//   one opponent may attack Lamb at a time at first; a second after `rampFrames`; one more while
//   Lamb is passive (has not struck, caught, shoved or grappled for `passiveFrames`)
//   a passive Lamb also shortens every opponent's cooldown to `passiveCool` of its length, and a string
//   is always carried through
// So a Lamb who stands still is down within seconds, and a Lamb who fights back keeps the
// one-at-a-time rhythm for the first twenty seconds. Values are chosen; see TUNING.md.
export const PRESSURE = { rampFrames: 1200, passiveFrames: 150, passiveCool: 0.2, maxTokens: 3 };

export const passive = (W, T) => W.tick - (T.lastOffense ?? 0) > PRESSURE.passiveFrames;
export const coolScale = (W, T) => (passive(W, T) ? PRESSURE.passiveCool : 1);

export function tokensAllowed(W, T) {
  let n = 1;
  if (W.tick > PRESSURE.rampFrames) n++;
  if (passive(W, T)) n++;
  return Math.min(PRESSURE.maxTokens, n);
}
