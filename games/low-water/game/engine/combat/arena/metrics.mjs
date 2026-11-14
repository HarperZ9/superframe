// Numbers for tuning the arena (coordinator, 2026-10-21: "instrument time-to-kill, dodge success and deaths
// per pattern"). Watches every event a fight world emits, fight by fight:
//   ttk        seconds from an opponent's entry to its fall, by archetype (an elite apart)
//   dodges     Lamb's dodges started, and how many let a blow pass through (an evade)
//   taken      blows that landed on Lamb, by the move that landed them (a pattern), with damage
//   deaths     the move that put Lamb down for good, by pattern
//   bosses     each boss fight: outcome, seconds, the phase reached, wall dazes
//   fights     each fight: round, wave, outcome, seconds, Lamb's standing at the end
// A pattern is the move id with the fighter's own prefix taken off (foe2:light_1 is light_1 of its kind).
export function createMetrics() {
  const R = { ttk: {}, dodges: { tried: 0, evaded: 0 }, taken: {}, deaths: {}, bosses: [], fights: [] };
  let cur = null;
  const pattern = (W, id, move) => { const k = (W.defs[id] || {}).kind || "?", m = String(move || "?").replace(/^[^:]*:/, ""); return `${k}:${m}`; };
  return {
    begin(W, ctx) {
      cur = { ...ctx, W, start: {}, lastOnLamb: null, dodging: null, phase: 0, dazed: 0 };
      for (const F of W.fighters) if (F.team !== "lamb") cur.start[F.id] = 0;
      const emit = W.emit;
      W.emit = (e) => { emit(e); see(W, e); };
    },
    end(W) {
      const out = W.result ? W.result.outcome : "none", secs = +(W.tick / 60).toFixed(1);
      if (out === "down" && cur.lastOnLamb) R.deaths[cur.lastOnLamb] = (R.deaths[cur.lastOnLamb] || 0) + 1;
      if (cur.boss) R.bosses.push({ boss: cur.boss, round: cur.round, outcome: out, secs, phase: cur.phase, dazed: cur.dazed, left: +(W.byId("boss") || { hp: 0 }).hp.toFixed(1) });
      R.fights.push({ round: cur.round, wave: cur.wave, boss: cur.boss, outcome: out, secs, hp: +W.lamb().hp.toFixed(1) });
      cur = null;
    },
    report() {
      const ttk = Object.fromEntries(Object.entries(R.ttk).map(([k, xs]) => [k, { n: xs.length, median: median(xs) }]));
      return { ttk, dodges: { ...R.dodges, rate: R.dodges.tried ? +(R.dodges.evaded / R.dodges.tried).toFixed(2) : null }, taken: R.taken, deaths: R.deaths, bosses: R.bosses, fights: R.fights };
    },
  };
  function see(W, e) {
    if (!cur) return;
    if (e.type === "join") cur.start[e.id] = W.tick;
    if (e.type === "fall" && cur.start[e.id] != null) { const F = W.byId(e.id), k = `${W.defs[e.id].kind}${W.defs[e.id].elite ? "+" : ""}`; (R.ttk[k] ||= []).push(+((W.tick - cur.start[e.id]) / 60).toFixed(1)); delete cur.start[e.id]; void F; }
    if (e.type === "move" && e.id === "lamb" && (W.moves[e.move] || {}).kind === "dodge") { R.dodges.tried++; cur.dodging = { at: W.tick, evaded: false }; }
    if (e.type === "evade" && e.id === "lamb" && cur.dodging && !cur.dodging.evaded) { cur.dodging.evaded = true; R.dodges.evaded++; }
    if (e.type === "hit" && e.id === "lamb") { const p = pattern(W, e.by, e.move); cur.lastOnLamb = p; const t = (R.taken[p] ||= { n: 0, dmg: 0 }); t.n++; t.dmg = +(t.dmg + (e.dmg || 0)).toFixed(2); }
    if (e.type === "boss.phase") cur.phase = Math.max(cur.phase, e.phase);
    if (e.type === "wallhit") cur.dazed++;
  }
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : +((s[n / 2 - 1] + s[n / 2]) / 2).toFixed(1)) : null; };
