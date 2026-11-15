// Composing the visible cells of the world: each cell's material language, its light, its break and
// thin-thing lines, emitters, fog with depth, and the glyph level held by hysteresis (per world cell,
// so it survives the camera's pan). Writes the frame's cell arrays: glyph, foreground, background,
// emission. Original code.
import { langOf, EDGES, SNOW } from "./materials.mjs";
import { TONES, TONE_HYST } from "./tonemap.mjs";
import { makeShaper } from "./shape.mjs";
import { blueNoise } from "./bluenoise.mjs";
const BN = blueNoise(64);
import { SHAPE_N } from "./atlas.mjs";

export const PALETTES = {
  full: { name: "full colour" }, green: { name: "phosphor green", tint: [0.3, 1.0, 0.45] }, amber: { name: "amber", tint: [1.0, 0.66, 0.2] },
  paper: { name: "ink on paper", paper: [233, 227, 212], ink: [29, 20, 24] },
};
// the display curve as a table on [0, 4) at 1/1024 steps (it saturates long before 4)
const ENC = new Uint8Array(4097); for (let i = 0; i <= 4096; i++) ENC[i] = Math.round(255 * (1 - Math.exp((-2.2 * i) / 1024)));
const enc = (v) => (v <= 0 ? 0 : v >= 4 ? 255 : ENC[(v * 1024) | 0]);

export function makeComposer(kinds, atlas) {
  const langs = []; for (const k of kinds) if (k) langs[k.id] = langOf(k);
  const voidL = langOf(null), snowL = { name: "snow", ...SNOW, tone: 0.85 }, edgeG = EDGES.map((e) => atlas.index(e)), shaper = makeShaper(atlas), occF = new Float32Array(SHAPE_N);
  const DOTS = [".", "·", "•", "o"].map((c) => atlas.index(c));
  const rampG = new Map(); const ramp = (L) => { let r = rampG.get(L.ramp); if (!r) rampG.set(L.ramp, (r = [...L.ramp].map((ch) => atlas.index(ch)))); return r; };
  // frame: { C, E (light per world cell), levels (hysteresis per world cell), I0, J0, cols, rows, fog: { on, near, far, k, col }, palette, opts }
  // per world cell, what does not change frame to frame: the language and the motif's glyph (-1 none)
  let stat = null;
  const statics = (C) => {
    if (stat && stat.C === C) return stat;
    const N = C.nI * C.nJ, L = new Array(N), motif = new Int16Array(N).fill(-1), contour = new Int8Array(N).fill(-1), low = new Int16Array(N);
    for (let c = 0; c < N; c++) { const l = langs[C.k1[c]] || voidL; L[c] = l; if (l.motif && Number.isFinite(C.P[c * 3 + 1])) { const m = l.motif([C.P[c * 3], C.P[c * 3 + 1], C.P[c * 3 + 2]], { up: C.N[c * 3 + 1] > 0.8 }); if (m) motif[c] = atlas.index(m); } }
    // the night floor's two parts, per world cell: the contour (the cell sits on a change of kind or a depth
    // jump and is the nearer side: | / - \ by which neighbours differ) and the language's faintest glyph
    const fin = (k) => Number.isFinite(C.P[k * 3 + 1]);
    for (let J = 0; J < C.nJ; J++) for (let I = 0; I < C.nI; I++) {
      const c = J * C.nI + I; if (!fin(c)) continue;
      const rp = L[c].ramp; let lg = -1; for (const ch of rp) if (ch !== " ") { lg = atlas.index(ch); break; } low[c] = lg;
      const d = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dI, dJ]) => {
        const X = I + dI, Y = J + dJ; if (X < 0 || Y < 0 || X >= C.nI || Y >= C.nJ) return false; const q = Y * C.nI + X;
        if (!fin(q)) return true;   // against the void: a silhouette
        return (C.k1[q] !== C.k1[c] || Math.abs(C.depth[q] - C.depth[c]) >= 0.6) && C.depth[c] <= C.depth[q] + 0.05;
      });
      const h = d[0] || d[1], v = d[2] || d[3]; if (!h && !v) continue;
      contour[c] = h && v ? ((d[0] && d[2]) || (d[1] && d[3]) ? 1 : 3) : h ? 0 : 2;
    }
    return (stat = { C, L, motif, contour, low });
  };
  // the composed result per world cell, kept: a world cell is composed again only when it is dirty (first
  // seen, or its light changed: the lantern's cells, last frame's and this one's); settings changes clear it
  let W = null;
  const cache = (C, key) => {
    if (W && W.C === C && W.key === key) return W;
    const N = C.nI * C.nJ;
    return (W = { C, key, G: new Int16Array(N), FG: new Uint8ClampedArray(N * 3), BG: new Uint8ClampedArray(N * 3), EM: new Uint8Array(N), TM: new Uint8Array(N).fill(255), done: new Uint8Array(N) });
  };
  return function compose(fr, out) {
    const { C, E, levels, I0, J0, cols, rows, palette, opts } = fr, n = cols * rows, ST = statics(C);
    const P = PALETTES[palette] || PALETTES.full, focus = fr.focus;
    const Wc = cache(C, `${palette}|${(opts.dream || 0).toFixed(2)}|${opts.style || ''}|${opts.shape}|${opts.dither}|${opts.ditherScreen ? `${fr.I0},${fr.J0}` : ''}|${opts.exposure}|${opts.hyst}|${opts.edges}|${opts.motif}|${opts.fog}|${opts.floor}|${fr.fog.k.toFixed(3)}|${(opts.snow || 0).toFixed(2)}|${(opts.decay || 0).toFixed(2)}|${opts.weight}|${opts.lightGen || 0}|${opts.floorK || 1}|${opts.halftone ? 1 : 0}|${opts.adapt || 1}`);
    if (fr.dirty) for (const k of fr.dirty) Wc.done[k] = 0;
    const G = Wc.G, FG = Wc.FG, BG = Wc.BG, EM = Wc.EM, TM = Wc.TM, styleRamp = opts.toneRamp || null;   // a style's own 16-glyph ramp (glyph/styles), else each material's
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const vo = y * cols + x, I = I0 + x, J = J0 + y;
      if (I < 0 || J < 0 || I >= C.nI || J >= C.nJ) { if (out.T) out.T[vo] = 255; out.G[vo] = 0; out.EM[vo] = 0; out.FG[vo * 3] = out.FG[vo * 3 + 1] = out.FG[vo * 3 + 2] = 0; setBg(out.BG, vo, P, 0, 0, 0); continue; }
      const o = J * C.nI + I;
      if (!Wc.done[o]) { Wc.done[o] = 1; cell(o); }
      out.G[vo] = G[o]; out.EM[vo] = EM[o]; if (out.T) out.T[vo] = TM[o]; out.FG[vo * 3] = FG[o * 3]; out.FG[vo * 3 + 1] = FG[o * 3 + 1]; out.FG[vo * 3 + 2] = FG[o * 3 + 2]; out.BG[vo * 3] = BG[o * 3]; out.BG[vo * 3 + 1] = BG[o * 3 + 1]; out.BG[vo * 3 + 2] = BG[o * 3 + 2];
    }
    return n;
    // snow (opts.snow, the light model's cover): an outdoor surface facing up speaks snow's language
    function underSnow(L, c) { return opts.snow > 0 && L.outdoor && !L.emit && C.N[c * 3 + 1] > 0.72 && BN.at((c % C.nI) + 5, ((c / C.nI) | 0) + 11) < opts.snow ? snowL : L; }
    // weight and size (opts.weight): a lit near cell takes the bold cut, a cell far in the fog the small one;
    // decay (opts.decay, 0..1): letters drop out, others fall to a lighter step, a smudged row drags its type
    function weathered(gi, rp, lv, t, fog, wI, wJ) {
      const d = opts.decay || 0;
      if (d > 0 && gi !== rp[0]) {
        const r = BN.at(wI + 13, wJ + 29), smudge = ((Math.imul(wJ + 7, 2654435761) >>> 0) % 1000) / 1000 < 0.1 * d;
        if (r < 0.2 * d) return rp[0];
        if (smudge && r < 0.55) return atlas.index(r < 0.3 ? "~" : "=");
        if (r < 0.55 * d && lv > 1) gi = rp[lv - 1];
      }
      if (opts.weight === false) return gi;
      if (fog > 0.45) return atlas.cut(gi, "small");
      return t >= 11 && fog < 0.15 ? atlas.cut(gi, "bold") : gi;
    }
    // the night floor, the halftone falloff and the shape of a partly covered cell (a cell's glyph after its tone)
    function floorAndShape(c, L, { lv, v, base, gi, rp, wI, wJ }, col) {
    // the night floor (opts.floor): where the light leaves a cell all but empty, the plate's structure
    // still reads in dim type. A cell on a change of kind or depth draws its contour; any other surface
    // keeps its language's faintest glyph. Both at a low floor of value, in the surface's own hue, so the
    // night stays dark and brightness still follows the light above it (glyph/legibility.mjs measures it).
    // halftone falloff (opts.halftone, at night): where a lamp's light thins into the dark, a cell below the
    // ramp's first steps takes a dot sized by its light, dithered by world-anchored blue noise, in the lamp's
    // colour, so a pool spreads as a halftone gradient instead of stopping at its last letter
    if (opts.halftone && lv <= 1 && v > 0.035 && !L.emit && gi === base) { const k = v * 5 + (BN.at(wI + 3, wJ + 17) - 0.5) * 0.9; if (k > 0.35) { gi = DOTS[Math.min(DOTS.length - 1, Math.floor(k))]; const m = Math.max(1, 0.06 / Math.max(1e-4, 0.2126 * col[0] + 0.7152 * col[1] + 0.0722 * col[2])); col[0] *= m; col[1] *= m; col[2] *= m; } }
    if (opts.floor && L.ramp.trim()) {
      const lum = 0.2126 * col[0] + 0.7152 * col[1] + 0.0722 * col[2], sc = ST.contour[c];
      let want = 0;
      if (sc >= 0 && lv <= 2) { if (gi === base || lv === 0) gi = edgeG[sc]; want = FLOOR.edge * opts.floor * (opts.floorK || 1); }
      else if (lv === 0 && ST.low[c] >= 0) { gi = ST.low[c]; want = FLOOR.tex * opts.floor * (opts.floorK || 1); }
      else if (gi !== base && lv <= 1) want = FLOOR.edge * opts.floor * (opts.floorK || 1);   // a break or a thin thing already drawn
      if (want > lum) {
        if (lum > 1e-4) { const k = want / lum; col[0] *= k; col[1] *= k; col[2] *= k; }
        else { const f = L.fg, fl = 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2] || 1; col[0] = (f[0] * want) / fl; col[1] = (f[1] * want) / fl; col[2] = (f[2] * want) / fl; }
      }
    }
    // shape (opts.shape): a cell the surface only partly covers (a silhouette, a break, a thin thing's edge)
    // takes the glyph whose ink lies where the cover is, at the ink its tone already asked for
    if (opts.shape !== false && C.occ && gi !== rp[0] && atlas.cov[gi] > 0.01) {
      const inv = C.thin[c] >= 0;   // a thin thing crossing the cell: its ink where the main surface is not
      let on = 0; for (let r = 0; r < SHAPE_N; r++) { const v = C.occ[c * SHAPE_N + r]; occF[r] = inv ? 1 - v / 255 : v / 255; if (v) on++; }
      // an outline (a contour, a break or a thin thing: the cell drew a line glyph) follows the boundary in the
      // cover; a lit surface's edge fills its covered side
      // Tested three ways on the night plates (render/PROGRESS.md 67): outlines read best as the slope glyphs
      // they were (a matched mark per cell broke a long edge into ticks), so only a lit surface's partly
      // covered cell takes a shape: ink on its covered side
      if (on >= 2 && on <= SHAPE_N - 2) { const line = gi === edgeG[0] || gi === edgeG[1] || gi === edgeG[2] || gi === edgeG[3]; if (!line) gi = shaper.pick(occF, Math.max(atlas.cov[gi], 0.1)); }
    }
      return gi;
    }
    function cell(o) {
      EM[o] = 0;
      if (!Number.isFinite(C.P[o * 3 + 1])) { G[o] = 0; FG[o * 3] = FG[o * 3 + 1] = FG[o * 3 + 2] = 0; setBg(BG, o, P, 0, 0, 0); return; }
      const c = o, L = underSnow(ST.L[c], c), r = E[c * 3], g = E[c * 3 + 1], b = E[c * 3 + 2];
      // emitters set their own glyph in their own light
      if (L.emit) { TM[o] = TONES - 1; G[o] = atlas.index(L.emit.glyph); EM[o] = L.name === "window" || L.name === "windowdim" || L.name === "porthole" ? 70 : 255; const e = L.emit.c; FG[o * 3] = enc(e[0] * 1.6); FG[o * 3 + 1] = enc(e[1] * 1.6); FG[o * 3 + 2] = enc(e[2] * 1.6); setBg(BG, o, P, e[0] * 0.25, e[1] * 0.25, e[2] * 0.25); tintFg(FG, o, P); return; }
      const lit = 0.2126 * r + 0.7152 * g + 0.0722 * b, x0 = lit * (0.6 + 1.2 * L.tone) * opts.exposure * (opts.adapt || 1), v = x0 >= 1 ? 1 : x0 <= 0 ? 0 : Math.exp(0.7 * Math.log(x0));
      // fog with depth: past the focus the glyphs thin and the colour goes to the fog's
      const fog = opts.fog ? fr.fog.k * smooth(fr.fog.near, fr.fog.far, C.depth[c] - focus) : 0;
      // the tone map: the cell's lit value in TONES levels (glyph/tonemap.mjs), held by hysteresis; everything
      // after this line is the style's interpretation of it (which glyph, which colour)
      // dither (opts.dither, tone levels): a blue-noise offset before the tone is rounded, by the WORLD cell, so
      // a gradient breaks into an even scatter of steps that stays on its surface as the camera moves
      // (opts.ditherScreen: the control, the same noise by screen cell)
      const wI = o % C.nI, wJ = (o / C.nI) | 0, dz = opts.dither ? (BN.at(opts.ditherScreen ? wI - fr.I0 : wI, opts.ditherScreen ? wJ - fr.J0 : wJ) - 0.5) * opts.dither : 0;
      const rp = ramp(L), q = v * (1 - fog * 0.6) * (TONES - 1) + dz;
      let t = levels[c];
      if (t === 255 || Math.abs(q - t) >= (0.5 + opts.hyst) * TONE_HYST) t = Math.max(0, Math.min(TONES - 1, Math.round(q)));
      levels[c] = t; TM[o] = t;
      // the dream (paint/dream.mjs): the tone washed toward the middle, half the type gone by world-anchored blue
      // noise, the rest a step or two lighter: sparse, half-formed
      const dk = opts.dream || 0, tw = dk ? Math.round(t * (1 - 0.55 * dk) + 7.5 * 0.55 * dk * (t > 0 ? 1 : 0)) : t;
      let lv = Math.floor((tw * (rp.length - 1)) / (TONES - 1) + 0.25);
      if (dk) { lv = Math.max(0, lv - Math.round(2 * dk)); if (BN.at(wI + 31, wJ + 7) < 0.55 * dk) lv = 0; }   // a material's step from the tone, biased dark: the first tone stays empty, as the old ramps' first step did
      const base = styleRamp ? styleRamp[t] : rp[lv]; let gi = base;
      // the surface's make where it is lit enough to show, a thin thing's line, a break's line
      if (opts.motif && lv >= 2 && ST.motif[c] >= 0 && L === ST.L[c]) gi = ST.motif[c];
      let fr2 = L.fg[0] * r, fg2 = L.fg[1] * g, fb2 = L.fg[2] * b;
      if (opts.edges && C.thin[c] >= 0 && lv >= 1) { gi = edgeG[C.thin[c]]; const L2 = langs[C.k2[c]]; if (L2 && !L2.emit) { fr2 = L2.fg[0] * r * 1.3; fg2 = L2.fg[1] * g * 1.3; fb2 = L2.fg[2] * b * 1.3; } }
      else if (opts.edges && C.step[c] >= 0 && lv >= 1) { gi = edgeG[C.step[c]]; fr2 *= 1.35; fg2 *= 1.35; fb2 *= 1.35; }
      const col = [fr2, fg2, fb2]; gi = floorAndShape(c, L, { lv, v, base, gi, rp, wI, wJ }, col); fr2 = col[0]; fg2 = col[1]; fb2 = col[2];
      G[o] = weathered(gi, rp, lv, t, fog, wI, wJ);
      if (fog > 0) { const t = fog * 0.7; fr2 = fr2 * (1 - t) + fr.fog.col[0] * t; fg2 = fg2 * (1 - t) + fr.fog.col[1] * t; fb2 = fb2 * (1 - t) + fr.fog.col[2] * t; }
      // a lit glyph carries a little more than the light gives it, so type reads on the dark ground
      const lift = 1.6; FG[o * 3] = enc(fr2 * lift); FG[o * 3 + 1] = enc(fg2 * lift); FG[o * 3 + 2] = enc(fb2 * lift);
      setBg(BG, o, P, fr2 * L.bg, fg2 * L.bg, fb2 * L.bg); tintFg(FG, o, P);
    }
  };

}
// the night floor's values (linear, before the glyph's lift): a contour, a surface's faint texture
export const FLOOR = { edge: 0.085, tex: 0.045 };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function setBg(BG, o, P, r, g, b) {
  if (P.paper) { BG[o * 3] = P.paper[0]; BG[o * 3 + 1] = P.paper[1]; BG[o * 3 + 2] = P.paper[2]; return; }
  BG[o * 3] = 14 + enc(r) * 0.5; BG[o * 3 + 1] = 10 + enc(g) * 0.5; BG[o * 3 + 2] = 14 + enc(b) * 0.5;
}
// palettes other than full colour turn the lit colour into the palette's tint at its value (paper: ink by value)
export function tintFg(FG, o, P) {
  if (!P.tint && !P.paper) return;
  const l = (0.2126 * FG[o * 3] + 0.7152 * FG[o * 3 + 1] + 0.0722 * FG[o * 3 + 2]) / 255;
  if (P.paper) { const k = 0.35 + 0.65 * Math.min(1, l * 1.6); for (let c = 0; c < 3; c++) FG[o * 3 + c] = Math.round(P.paper[c] + (P.ink[c] - P.paper[c]) * k); return; }
  for (let c = 0; c < 3; c++) FG[o * 3 + c] = Math.round(255 * Math.min(1, P.tint[c] * (0.2 + 0.95 * l)));
}
