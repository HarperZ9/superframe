// The glyph pipeline's explicit intermediate (after the author's Trace ASCII note, 2026-10-21: "the
// character is the tone map; everything else is interpretation"): every world cell's lit value quantised
// to TONES levels, held by hysteresis, stored per frame (renderer state.buf.T, 255 where no surface). A
// style (glyph/styles/*.json) turns the levels into glyphs and colours; one scene, many styles.
// Original code.
export const TONES = 16;
// hysteresis in tone levels: a level is held while the value stays within 0.5 + hyst levels of it. Scaling
// the hold to the old nine-step width (1.6 levels here) made a cell at level 1 unable ever to fall to 0
// (the dark-plate control passed); one level's width keeps the bottom free and still holds against flicker
export const TONE_HYST = 1;
// A ramp of n glyphs from the atlas's measured ink coverage: for each of n targets evenly spaced from the
// emptiest glyph to the fullest allowed, the unused glyph whose coverage is nearest (monotone by
// construction). cov: coverage per glyph index; chars: candidate glyph indexes; maxCov caps the top (a
// solid block reads as a hole, not a tone).
export function measuredRamp(cov, chars, n = TONES, maxCov = 0.42) {
  const pool = [...new Set(chars)].filter((g) => cov[g] <= maxCov).sort((a, b) => cov[a] - cov[b]); if (!pool.length) return [];
  const lo = cov[pool[0]], hi = cov[pool[pool.length - 1]], out = []; let from = 0;
  for (let k = 0; k < n; k++) {
    const want = lo + ((hi - lo) * k) / (n - 1); let best = from, bd = Infinity;
    for (let j = from; j < pool.length; j++) { const d = Math.abs(cov[pool[j]] - want); if (d < bd) { bd = d; best = j; } else if (cov[pool[j]] > want) break; }
    out.push(pool[best]); from = Math.min(pool.length - 1, best + (k < n - 1 && pool.length - best > n - 1 - k ? 1 : 0));
  }
  return out;
}
