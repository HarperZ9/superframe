// Fight sound: what a fight's contacts sound like, played on the event the sim emits on the contact tick
// (combat/sim/hits.mjs), so the sound lands on the same frame as the hit-stop, the hit marker and the effects
// (author, 2026-11-09: "timing, sound, physics, effects, hitmarkers, etc should all be on the same scheduling").
// The sounds are synthesised (audio/sfx/strike.mjs); the weight of a blow sets its loudness and body, an edged
// tool adds a tear, armour muffles it, and a few takes of each rotate so a string of blows is not one sample.
//   soundFor(type, e) -> { sfx, secs, vol, seed, opt } | null      (pure: the tests read it)
//   const off = fightSound(G, play)       play: (sound) => void, ui/senseplayer.mjs playSound in the shell
export const FIGHT_SOUND_EVENTS = ["hit", "block", "parry", "guardbreak", "evade", "knockdown", "down"];
const EDGED = /knife|blade|sickle|spear|hook|glass|bayonet|razor|axe|saw|fid|marlinspike/i;
const TAKES = 4;
let take = 0;
const nextSeed = () => 1 + (take++ % TAKES);

// how heavy a blow reads, 0..1, from its damage and the poise it broke
export function weightOf(e) {
  const d = Math.max(0, +e.dmg || 0), p = Math.max(0, +e.poise || 0);
  return Math.max(0, Math.min(1, d / 2.5 + p / 12));
}

export function soundFor(type, e = {}) {
  switch (type) {
    case "hit": {
      const w = weightOf(e);
      return { sfx: "blow", secs: 0.3 + 0.2 * w, vol: 0.55 + 0.45 * w, seed: nextSeed(), opt: { weight: w, edge: EDGED.test(String(e.move || "")), armor: !!e.armor } };
    }
    case "block": return { sfx: "guard", secs: 0.4, vol: 0.55 + Math.min(0.35, (+e.cost || 0) / 6), seed: nextSeed(), opt: { mat: "wood" } };
    case "parry": return e.projectile ? { sfx: "guard", secs: 0.35, vol: 0.6, seed: nextSeed(), opt: { mat: "wood" } } : { sfx: "ring", secs: 0.7, vol: 0.75, seed: nextSeed(), opt: {} };
    case "guardbreak": return { sfx: "breakguard", secs: 0.6, vol: 0.85, seed: nextSeed(), opt: {} };
    case "evade": return { sfx: "whoosh", secs: 0.28, vol: 0.35, seed: nextSeed(), opt: { speed: 0.7 } };
    case "knockdown": case "down": return { sfx: "fall", secs: 0.9, vol: 0.8, seed: nextSeed(), opt: {} };
    default: return null;
  }
}

export function fightSound(G, play, now = () => Date.now()) {
  // a knockdown and a down can arrive for the same body together; one fall a body in 300 ms is enough
  const fell = {};
  const offs = FIGHT_SOUND_EVENTS.map((t) => G.on(`fight.${t}`, (e) => {
    if (t === "knockdown" || t === "down") { const k = String(e.id), at = now(); if (at - (fell[k] ?? -1e9) < 300) return; fell[k] = at; }
    const s = soundFor(t, e);
    if (!s) return;
    try { play({ ...s, at: "near" }); } catch (err) { console.warn(`fight sound: ${t}: ${err.message}`); }
  }));
  return () => offs.forEach((off) => off && off());
}
