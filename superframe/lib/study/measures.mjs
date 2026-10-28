// measures.mjs: the colour measures beyond palette and extension. Hue distribution, value structure and
// colourfulness are read from the colour histogram (so they ignore arrangement); composition reads each pixel's
// swatch and its neighbours (so it depends on arrangement, the other half of the shuffle control); Bezold and
// simultaneous contrast are computed for swatches the study picks from the subject's own palette.
import { lch, dE76, linToXYZ, lin8, luminance, cam02J, xyzToLab, labToRgb8, hex } from './cmath.mjs';
import { binOf } from './palette.mjs';
import { ACHROMATIC_C } from './extension.mjs';

const r4 = v => Math.round(v * 1e4) / 1e4;

export function hueWheel(pts, total, bins = 24) {
  const area = new Float64Array(bins), chroma = new Float64Array(bins), ml = Array.from({ length: bins }, () => [0, 0, 0]); let achro = 0, sx = 0, sy = 0, wc = 0;
  for (const p of pts) {
    const [, C, h] = lch(p.lab);
    if (C < ACHROMATIC_C) { achro += p.w; continue; }
    const b = Math.floor(h / (360 / bins)) % bins; area[b] += p.w; chroma[b] += p.w * C; for (let c = 0; c < 3; c++) ml[b][c] += p.w * p.lab[c];
    sx += p.w * Math.cos(h * Math.PI / 180); sy += p.w * Math.sin(h * Math.PI / 180); wc += p.w;
  }
  const mean = wc ? ((Math.atan2(sy, sx) * 180 / Math.PI) + 360) % 360 : null;
  return {
    method: `CIELAB hue angle of each histogram colour, ${bins} bins of ${360 / bins} degrees, weighted by area; colours with C* < ${ACHROMATIC_C} counted as achromatic; concentration is the mean resultant length of hue (0 spread evenly, 1 one hue)`,
    bins, area: [...area].map(v => r4(v / total)), mean_chroma: [...chroma].map((v, i) => (area[i] ? r4(v / area[i]) : 0)), mean_lab: ml.map((v, i) => (area[i] ? v.map(x => r4(x / area[i])) : null)),
    achromatic_share: r4(achro / total), mean_hue: mean === null ? null : r4(mean), concentration: wc ? r4(Math.hypot(sx, sy) / wc) : null,
  };
}

export function valueStructure(pts, total) {
  const hist = new Float64Array(20), sorted = pts.map(p => [p.lab[0], p.w]).sort((a, b) => a[0] - b[0]);
  let mean = 0; for (const [L, w] of sorted) { hist[Math.min(19, Math.floor(L / 5))] += w; mean += L * w; }
  const pct = q => { let t = q * total; for (const [L, w] of sorted) { t -= w; if (t <= 0) return r4(L); } return r4(sorted.at(-1)[0]); };
  const bands = [0, 0, 0, 0, 0]; for (const [L, w] of sorted) bands[Math.min(4, Math.floor(L / 20))] += w;
  mean /= total;
  return {
    method: 'CIELAB L* of each histogram colour, area-weighted; bands are L* 0-20, 20-40, 40-60, 60-80, 80-100; key: low below mean L* 40, high above 60',
    histogram_5L: [...hist].map(v => r4(v / total)), bands: bands.map(v => r4(v / total)),
    mean_L: r4(mean), p05: pct(0.05), p50: pct(0.5), p95: pct(0.95), range_p05_p95: r4(pct(0.95) - pct(0.05)),
    key: mean < 40 ? 'low' : mean > 60 ? 'high' : 'middle',
  };
}

// Hasler and Suesstrunk (2003) colourfulness M on 8-bit sRGB, from integer sums so pixel order cannot change it.
export function colourfulness(S) {
  let n = 0, a = 0, a2 = 0, b = 0, b2 = 0; const d = S.rgba;
  for (let i = 0; i < S.w * S.h; i++) {
    const p = 4 * i; if (d[p + 3] < 128) continue;
    const rg = d[p] - d[p + 1], yb2 = d[p] + d[p + 1] - 2 * d[p + 2];   // 2 * yb, kept integer
    a += rg; a2 += rg * rg; b += yb2; b2 += yb2 * yb2; n++;
  }
  const ma = a / n, mb = b / (2 * n), va = a2 / n - ma * ma, vb = b2 / (4 * n) - mb * mb;
  return { method: 'Hasler and Suesstrunk 2003: M = sqrt(var rg + var yb) + 0.3 sqrt(mean rg^2 + mean yb^2), rg = R - G, yb = (R + G)/2 - B on 8-bit sRGB', M: r4(Math.sqrt(Math.max(0, va) + Math.max(0, vb)) + 0.3 * Math.hypot(ma, mb)) };
}

// Composition: where each swatch lives. Coherence is the share of 4-neighbour pixel pairs that fall in the same swatch.
export function composition(S, binToSwatch, nSw) {
  const { w, h, rgba: d } = S, lab = new Int16Array(w * h).fill(-1);
  for (let i = 0; i < w * h; i++) { const p = 4 * i; if (d[p + 3] >= 128) lab[i] = binToSwatch.get(binOf(d[p], d[p + 1], d[p + 2])); }
  let same = 0, pairs = 0; const adj = Array.from({ length: nSw }, () => new Float64Array(nSw));
  const cx = new Float64Array(nSw), cy = new Float64Array(nSw), cxx = new Float64Array(nSw), cn = new Float64Array(nSw), s = 1 / Math.max(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, a = lab[i]; if (a < 0) continue;
    const u = x * s, v = y * s; cx[a] += u; cy[a] += v; cxx[a] += u * u + v * v; cn[a]++;
    for (const j of [x + 1 < w ? i + 1 : -1, y + 1 < h ? i + w : -1]) {
      if (j < 0 || lab[j] < 0) continue; pairs++;
      if (lab[j] === a) same++; else { adj[a][lab[j]]++; adj[lab[j]][a]++; }
    }
  }
  const where = [...cn].map((n, k) => n ? { centroid: [r4(cx[k] / n), r4(cy[k] / n)], spread: r4(Math.sqrt(Math.max(0, cxx[k] / n - (cx[k] / n) ** 2 - (cy[k] / n) ** 2))) } : null);
  const diff = pairs - same;
  return {
    method: 'each opaque pixel is labelled with its swatch; coherence = same-swatch 4-neighbour pairs / all pairs; centroid and spread (RMS distance from centroid) in units of the longer side; adjacency = share of unlike neighbour pairs between two swatches',
    coherence: pairs ? r4(same / pairs) : 1, where,
    adjacency: adj.map(row => [...row].map(v => (diff ? r4(v / diff) : 0))), labels: lab,
  };
}

// How faithfully the palette rebuilds the subject: mean CIE76 distance from each histogram colour to its swatch.
export function residual(pts, total, binToSwatch, swatches) {
  let s = 0, mx = 0;
  for (const p of pts) { const e = dE76(p.lab, swatches[binToSwatch.get(p.bin)].lab); s += p.w * e; mx = Math.max(mx, e); }
  return { method: 'area-weighted mean CIE76 distance from each 6-bit histogram colour (bin mean) to its swatch; the part of the colour this palette does not carry', mean_dE: r4(s / total), max_dE: r4(mx) };
}

// Pick n swatches spread apart: start from the largest chromatic one, then farthest-point in CIELAB.
export function spreadPick(swatches, n) {
  const pool = [...swatches], out = [];
  const first = pool.find(s => s.C >= ACHROMATIC_C) ?? pool[0]; if (!first) return out;
  out.push(first);
  while (out.length < Math.min(n, pool.length)) {
    let best = null, bd = -1;
    for (const s of pool) { if (out.includes(s) || s.share < 0.005) continue; const d = Math.min(...out.map(o => dE76(o.lab, s.lab))); if (d > bd) { bd = d; best = s; } }
    if (!best) break; out.push(best);
  }
  return out;
}

export const LACE = { period: 1 / 4, width: 1 / 24 };   // two crossed line families per tile, in tile units
export function bezold(swatches) {
  const cov = 1 - (1 - LACE.width / LACE.period) ** 2, pick = spreadPick(swatches, 5);
  const mix = (rgb, lace) => { const l = rgb.map(c => (1 - cov) * lin8(c) + cov * lace); return xyzToLab(linToXYZ(l)); };
  const rows = pick.map(s => { const w = mix(s.rgb, 1), k = mix(s.rgb, 0); return { i: s.i, hex: s.hex, with_white: { lab: w.map(r4), hex: hex(labToRgb8(w).rgb) }, with_black: { lab: k.map(r4), hex: hex(labToRgb8(k).rgb) }, dE_white_vs_black: r4(dE76(w, k)) }; });
  return { method: `Two crossed families of diagonal lines (period 1/4 and width 1/24 of the band width), coverage ${r4(cov)}; the optical mixture is the linear-light area average, an upper bound on assimilation at viewing distances where the lines blur, not a perception model`, coverage: r4(cov), rows };
}

export function simultaneous(swatches) {
  const warm = s => s.C * Math.cos((s.h - 50) * Math.PI / 180), used = new Set(), take = (cmp) => { const c = [...swatches].sort(cmp).find(s => !used.has(s)) ?? [...swatches].sort(cmp)[0]; used.add(c); return c; };
  const grounds = swatches.length ? { light: take((a, b) => b.L - a.L), dark: take((a, b) => a.L - b.L), warm: take((a, b) => warm(b) - warm(a)), cool: take((a, b) => warm(a) - warm(b)) } : {};
  const rest = swatches.filter(s => !used.has(s) && s.share >= 0.01);
  const centre = (rest.length ? rest : swatches).slice().sort((a, b) => b.C - a.C)[0];
  if (!centre) return { method: 'no swatches', rows: [] };
  const xyz = linToXYZ(centre.rgb.map(lin8)), ref = cam02J(xyz, 0.2);
  const rows = Object.entries(grounds).map(([role, g]) => { const J = cam02J(xyz, luminance(g.rgb)); return { role, ground: g.hex, ground_i: g.i, Yb: r4(luminance(g.rgb)), J: r4(J), dJ_vs_grey20: r4(J - ref) }; });
  return {
    method: 'grounds from the palette: lightest and darkest by L*, warmest and coolest by C*·cos(h - 50 degrees) (a convention: warm toward orange-red); centre = most chromatic remaining swatch with share of at least 1%; J is CIECAM02 lightness (average surround, La 64 cd/m2, D = 1) with Yb = the ground luminance, against a 20% grey reference. CIECAM02 models only the lightness shift a ground induces; hue and chroma induction are not modelled',
    centre: { i: centre.i, hex: centre.hex }, J_on_grey20: r4(ref), rows,
  };
}
