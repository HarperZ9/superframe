// Smoke and steam (queue: dithered smoke for the stoves, the ferry funnel and fog). Puffs in WORLD space rise
// from each source, drift with the wind, swell and thin; both renderers draw the same puffs. A source is a
// plate's fire or stove light (place.json lights, group fire), or a smoke mark (place.json marks.smoke: a
// funnel, a chimney). Painted mode draws them dithered: each puff's density thresholded against the blue-noise
// tile by plate pixel (so the dots stay on the world as the camera pans), in two inks (a lit grey toward the
// light, a cool shadow). Glyph mode sets the cells a puff covers to sparse type by its density. Original code.
//   const S = smokeField(); S.step(pj, variant, dt, wind); S.puffs -> [{ p: [x, y, z], r, d }]
const LIFE = 7, RATE = 1.6;
export function sourcesOf(pj, variant) {
  const out = [];
  for (const l of ((pj.lights && pj.lights[variant]) || [])) if (l.group === "fire") out.push({ at: [l.at[0], l.at[1] + 0.6, l.at[2]], k: 0.9, steam: false });
  for (const m of ((pj.marks && pj.marks.smoke) || [])) out.push({ at: m.at, k: m.k ?? 1, steam: !!m.steam });
  return out;
}
export function smokeField(seed = 1) {
  let s = seed >>> 0; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const S = { puffs: [], acc: 0, key: "" };
  S.step = (pj, variant, dt, wind = 0.3) => {
    const key = `${pj.place}|${variant}`; if (key !== S.key) { S.key = key; S.puffs.length = 0; S.src = sourcesOf(pj, variant); for (let k = 0; k < 40; k++) S.step(pj, variant, 0.2, wind); }
    if (!S.src.length) return S.puffs;
    S.acc += dt * RATE * S.src.length;
    while (S.acc >= 1) { S.acc -= 1; const src = S.src[Math.floor(rnd() * S.src.length)]; S.puffs.push({ p: [src.at[0] + (rnd() - 0.5) * 0.15, src.at[1], src.at[2] + (rnd() - 0.5) * 0.15], v: [(rnd() - 0.5) * 0.1, 0.45 + rnd() * 0.25, (rnd() - 0.5) * 0.1], age: 0, k: src.k, r: 0.14, d: 0, steam: src.steam }); }
    for (const q of S.puffs) {
      q.age += dt; q.p[0] += (q.v[0] + wind * 0.6 * Math.min(1, q.age / 2)) * dt; q.p[1] += q.v[1] * dt * (1 - q.age / (LIFE * 1.4)); q.p[2] += q.v[2] * dt;
      const t = q.age / LIFE; q.r = 0.14 + 0.9 * t; q.d = q.k * Math.min(1, q.age * 2) * (1 - t) * (1 - t);
    }
    S.puffs = S.puffs.filter((q) => q.age < LIFE);
    return S.puffs;
  };
  return S;
}
