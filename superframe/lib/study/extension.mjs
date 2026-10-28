// extension.mjs: Goethe's contrast of extension. Each colour has a light value; a composition is "in balance" when
// each colour's area is inversely proportional to its light value, so a bright colour needs less room than a dark
// one. The balance distance is the share of the surface that would have to change colour to reach balance:
// d = 1/2 * sum |painted_i - balanced_i| (total variation distance between the two area distributions).
// Two light scales are offered, and each result names its scale; they are never mixed.

export const GOETHE_LIGHT = { yellow: 9, orange: 8, red: 6, green: 6, blue: 4, violet: 3 };
// Anchors on the sRGB HSV hue circle: the primaries and secondaries of the display, violet at #8000ff.
const ANCHORS = [[0, 'red'], [30, 'orange'], [60, 'yellow'], [120, 'green'], [240, 'blue'], [270, 'violet'], [360, 'red']];
export const ACHROMATIC_C = 8;   // CIELAB chroma below this is treated as achromatic (no Goethe value)
export const LSTAR_FLOOR = 5;    // a black would need infinite area; L* is floored here

export const SCALES = {
  goethe: {
    id: 'goethe', name: "Goethe's light numbers",
    method: `traditional scale: yellow 9, orange 8, red 6, green 6, blue 4, violet 3 (Goethe, as tabulated by Itten); a swatch's value is interpolated linearly on the sRGB HSV hue circle between anchors red 0, orange 30, yellow 60, green 120, blue 240, violet 270 degrees; swatches with CIELAB chroma below ${ACHROMATIC_C} have no value and are left out, and the remaining shares are renormalised`,
    value: sw => {
      if (sw.C < ACHROMATIC_C || sw.hsv_hue === null) return null;
      for (let i = 0; i < ANCHORS.length - 1; i++) {
        const [h0, a] = ANCHORS[i], [h1, b] = ANCHORS[i + 1];
        if (sw.hsv_hue >= h0 && sw.hsv_hue <= h1) { const t = (sw.hsv_hue - h0) / (h1 - h0); return GOETHE_LIGHT[a] + t * (GOETHE_LIGHT[b] - GOETHE_LIGHT[a]); }
      }
      return null;
    },
  },
  lstar: {
    id: 'lstar', name: 'Measured CIE L*',
    method: `measured scale: a swatch's value is its CIELAB lightness L* (D65), floored at ${LSTAR_FLOOR} so a black has a finite balancing area; every swatch is included`,
    value: sw => Math.max(sw.L, LSTAR_FLOOR),
  },
};

export function balance(swatches, scaleId) {
  const scale = SCALES[scaleId];
  const rows = swatches.map(sw => ({ i: sw.i, hex: sw.hex, value: scale.value(sw), share: sw.share }));
  const inc = rows.filter(r => r.value !== null), excluded = rows.filter(r => r.value === null).reduce((a, r) => a + r.share, 0);
  const P = inc.reduce((a, r) => a + r.share, 0), inv = inc.reduce((a, r) => a + 1 / r.value, 0);
  for (const r of inc) { r.painted = r.share / P; r.balanced = (1 / r.value) / inv; r.change = r.balanced - r.painted; }
  const distance = inc.length < 2 ? 0 : inc.reduce((a, r) => a + Math.abs(r.change), 0) / 2;
  return {
    scale: scale.id, scale_name: scale.name, method: scale.method,
    distance_method: 'd = 1/2 * sum over included swatches of |painted share - balanced share|; balanced share = (1/value) / sum(1/value); shares renormalised over included swatches',
    distance, parts_in_100: Math.round(distance * 100),
    note: inc.length < 2 ? 'fewer than two swatches carry a value on this scale, so balance is trivial and d = 0' : null,
    excluded_share: excluded,
    rows: inc.map(r => ({ i: r.i, hex: r.hex, value: r.value, painted: r.painted, balanced: r.balanced, change: r.change })),
  };
}
