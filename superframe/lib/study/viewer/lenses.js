// lenses.js: each lens of the colour study as the viewer shows it. A lens has a name, its question, an overview
// essence (one number and one strip), a view, parts (each with a weight where weight means something), a law and
// a method. Every number comes from study.json.
const bal = () => C.extension[state.scale];
const sw = i => SW[i];
const swLabel = s => `${s.hex.toUpperCase()}`;
const strip = rows => el('div', { class: 'strip', 'aria-hidden': 'true' }, rows.map(([hex, w]) => el('span', { style: { background: hex, width: pct(w, 3) } })));
const table = (caption, head, rows) => el('table', {}, el('caption', { class: 'sr' }, caption), el('thead', {}, el('tr', {}, head.map(h => el('th', { scope: 'col' }, h)))), el('tbody', {}, rows.map(r => el('tr', {}, r.map(c => el('td', {}, c))))));
const seg = (label, opts, cur, pick) => el('div', { class: 'seg', role: 'group', 'aria-label': label }, opts.map(([v, t]) => el('button', { 'aria-pressed': String(v === cur), on: { click: () => pick(v) } }, t)));

const LENS = {
  palette: {
    name: 'Palette', plate: 'palette', question: 'Which colours make the picture, and how much of it each one covers.',
    lensLine: 'palette lens: k-means in CIELAB over the colour histogram',
    essence: () => [pct(SW[0]?.share ?? 0, 0), `largest swatch ${SW[0]?.hex.toUpperCase() ?? ''}`, strip(SW.map(s => [s.hex, s.share]))],
    view: () => [strip(SW.map(s => [s.hex, s.share])), table('Palette swatches', ['#', 'hex', 'L*', 'a*', 'b*', 'share'], SW.map((s, i) => [i + 1, s.hex, num(s.lab[0], 1), num(s.lab[1], 1), num(s.lab[2], 1), pct(s.share)]))],
    parts: () => SW.map((s, i) => ({ key: String(i), label: `Swatch ${i + 1}  ${swLabel(s)}`, sub: `L* ${num(s.L, 1)}  C* ${num(s.C, 1)}  h ${num(s.h, 0)}`, weight: s.share, hex: s.hex, mask: swatchMask(i),
      cells: [['hex', s.hex], ['CIELAB', s.lab.map(v => num(v, 2)).join(', ')], ['LCh', `${num(s.L, 2)}, ${num(s.C, 2)}, ${num(s.h, 1)}`], ['weight', `${pct(s.share, 2)} of the area (${s.pixels} of ${C.opaque_pixels} pixels)`], ['weight measured as', C.palette.method.share], ['sRGB gamut', s.gamut_clipped ? 'clipped to fit' : 'inside']] })),
    law: 'share_i = pixels assigned to swatch i / opaque pixels\nassignment: nearest centre in CIELAB (CIE76)',
    method: () => `${C.palette.method.method}. Share: ${C.palette.method.share}. Settings: k at most ${C.palette.params.k}, merge below dE ${C.palette.params.mergeDE}, seed "${C.palette.params.seed}". The palette rebuilds the picture with a mean CIE76 error of ${num(C.residual?.mean_dE, 2)}: the residual is what this lens leaves out.`,
  },
  extension: {
    name: 'Extension', plate: 'extension-lstar', question: 'How far the areas are from balance by light value.',
    lensLine: 'extension lens: Goethe balance, area inversely proportional to light value',
    essence: () => [`${C.extension.lstar.parts_in_100} in 100`, 'would change colour (measured L*)', strip(C.extension.lstar.rows.map(r => [r.hex, r.balanced]))],
    view: () => {
      const B = bal();
      return [el('div', { class: 'controls' }, seg('Light scale', [['lstar', 'Measured CIE L*'], ['goethe', "Goethe's lights"]], state.scale, v => set({ scale: v }))),
        el('p', {}, el('span', { class: 'big' }, `${B.parts_in_100} in 100`), el('br'), B.note ?? `parts of the surface would change colour to come into balance on ${B.scale_name} (d = ${num(B.distance, 4)}).`),
        el('p', { class: 'note' }, 'As it is'), strip(B.rows.map(r => [r.hex, r.painted])), el('p', { class: 'note' }, 'In balance'), strip(B.rows.map(r => [r.hex, r.balanced])),
        B.excluded_share > 0 ? el('p', { class: 'note' }, `${pct(B.excluded_share)} of the picture has no value on this scale and is left out.`) : null];
    },
    parts: () => bal().rows.map(r => ({ key: String(r.i), label: `Swatch ${r.i + 1}  ${r.hex.toUpperCase()}`, sub: `light ${num(r.value, 2)}; in balance ${pct(r.balanced)}`, weight: r.painted, hex: r.hex, mask: swatchMask(r.i),
      cells: [['scale', bal().scale_name], ['light value', num(r.value, 3)], ['weight as it is', pct(r.painted, 2)], ['weight in balance', pct(r.balanced, 2)], ['change', `${r.change >= 0 ? '+' : ''}${pct(r.change, 2)}`]] })),
    law: 'balanced_i = (1 / light_i) / sum_j (1 / light_j)\nd = 1/2 * sum_i | painted_i - balanced_i |',
    method: () => `${bal().scale_name}: ${bal().method}. ${bal().distance_method}.`,
  },
  bezold: {
    name: 'Bezold lace', plate: 'bezold', question: 'The same colours laced with one line colour, then another.',
    lensLine: 'Bezold lens: linear-light area mixture of colour and lace',
    essence: () => [num(Math.max(0, ...C.bezold.rows.map(r => r.dE_white_vs_black)), 0), 'largest dE, white lace vs black', strip(C.bezold.rows.map(r => [r.hex, 1 / C.bezold.rows.length]))],
    view: () => {
      const cvs = el('canvas', { class: 'viz', width: 720, height: 240, role: 'img', 'aria-label': `bands laced with ${state.lace}` }), rows = C.bezold.rows, cov = C.bezold.coverage;
      const g = cvs.getContext('2d'), bw = 720 / rows.length, P = bw / 4, t = bw / 24;
      rows.forEach((r, i) => { g.fillStyle = r.hex; g.fillRect(i * bw, 0, bw, 240); });
      g.save(); g.beginPath(); g.rect(0, 0, 720, 240); g.clip(); g.strokeStyle = state.lace; g.lineWidth = t;
      for (let c = -240; c < 720 + 240; c += P * Math.SQRT2) { g.beginPath(); g.moveTo(c, 0); g.lineTo(c + 240, 240); g.stroke(); g.beginPath(); g.moveTo(c + 240, 0); g.lineTo(c, 240); g.stroke(); }
      g.restore();
      const lace = rgbOf(state.lace).map(v => lin(v / 255));
      const mixes = rows.map(r => { const l = rgbOf(r.hex).map((v, c) => (1 - cov) * lin(v / 255) + cov * lace[c]); return { hex: hexOfLin(l), lab: labOfLin(l) }; });
      const pick = el('input', { type: 'color', value: state.lace, 'aria-label': 'Lace colour', on: { change: e => set({ lace: e.target.value }) } });
      return [el('div', { class: 'controls' }, seg('Lace', [['#ffffff', 'White'], ['#000000', 'Black']], state.lace, v => set({ lace: v })), pick), cvs,
        table('Area mixture with the chosen lace', ['band', 'colour', 'mixture', 'mixture L*', 'dE white vs black (study)'], rows.map((r, i) => [i + 1, r.hex, mixes[i].hex, num(mixes[i].lab[0], 1), num(r.dE_white_vs_black, 1)]))];
    },
    parts: () => C.bezold.rows.map((r, k) => ({ key: String(r.i), label: `Band ${k + 1}  ${r.hex.toUpperCase()}`, sub: `with white ${r.with_white.hex}, with black ${r.with_black.hex}`, weight: null, hex: r.hex, chip: String(k + 1), mask: swatchMask(r.i),
      cells: [['colour', r.hex], ['mixed with white', `${r.with_white.hex}  L* ${num(r.with_white.lab[0], 1)}`], ['mixed with black', `${r.with_black.hex}  L* ${num(r.with_black.lab[0], 1)}`], ['dE between them', num(r.dE_white_vs_black, 2)]] })),
    law: 'mix = (1 - c) * colour + c * lace   (linear light)\nc = 1 - (1 - width / period)^2',
    method: () => C.bezold.method + '.',
  },
  grounds: {
    name: 'Grounds', plate: 'simultaneous', question: 'One colour on four grounds taken from the picture itself.',
    lensLine: 'simultaneous-contrast lens: CIECAM02 lightness J with the ground as background',
    essence: () => [`${num(Math.max(...C.simultaneous.rows.map(r => r.J)) - Math.min(...C.simultaneous.rows.map(r => r.J)), 1)} J`, 'lightness swing across grounds', strip(C.simultaneous.rows.map(r => [r.ground, 0.25]))],
    view: () => [el('div', { class: 'panels', role: 'img', 'aria-label': `centre ${C.simultaneous.centre?.hex} on four grounds` }, C.simultaneous.rows.map(r => el('div', { style: { background: r.ground } }, el('i', { style: { background: C.simultaneous.centre.hex } })))),
      table('Lightness of the centre on each ground', ['ground', 'hex', 'J', 'vs 20% grey'], C.simultaneous.rows.map(r => [r.role, r.ground, num(r.J, 1), num(r.dJ_vs_grey20, 1)]))],
    parts: () => C.simultaneous.rows.map(r => ({ key: r.role, label: `${r.role[0].toUpperCase() + r.role.slice(1)} ground  ${r.ground.toUpperCase()}`, sub: `centre J ${num(r.J, 1)}`, weight: null, hex: r.ground, chip: r.role[0].toUpperCase(), mask: swatchMask(r.ground_i),
      cells: [['ground', r.ground], ['ground luminance Yb', num(r.Yb, 4)], ['centre', C.simultaneous.centre.hex], ['J on this ground', num(r.J, 2)], ['J shift vs 20% grey', num(r.dJ_vs_grey20, 2)]] })),
    law: 'J = 100 (A / A_w)^(c z),  z = 1.48 + sqrt(Yb / Yw)\n(CIECAM02, average surround)',
    method: () => C.simultaneous.method + '.',
  },
  hue: {
    name: 'Hue', plate: 'hue', question: 'Where the colour sits on the hue circle.',
    lensLine: 'hue lens: CIELAB hue angle, area-weighted',
    essence: () => [num(C.hue.concentration, 2), 'hue concentration (0 spread, 1 one hue)', strip(C.hue.area.map((a, k) => [C.hue.mean_lab[k] ? hexOfLin(labToLin(C.hue.mean_lab[k])) : '#000', a]).filter(([, a]) => a > 0))],
    view: () => [table('Hue statistics', ['mean hue', 'concentration', 'achromatic', 'colourfulness M'], [[C.hue.mean_hue === null ? 'none' : `${num(C.hue.mean_hue, 0)} deg`, num(C.hue.concentration, 3), pct(C.hue.achromatic_share), num(C.colourfulness.M, 1)]])],
    parts: () => C.hue.area.map((a, k) => ({ a, k })).filter(q => q.a > 0).map(({ a, k }) => { const step = 360 / C.hue.bins, hex = hexOfLin(labToLin(C.hue.mean_lab[k]));
      return { key: String(k), label: `Hue ${k * step} to ${(k + 1) * step} deg`, sub: `mean chroma ${num(C.hue.mean_chroma[k], 1)}`, weight: a, hex, chip: String(k * step), mask: hueMask(k),
        cells: [['bin', `${k * step} to ${(k + 1) * step} degrees`], ['weight', pct(a, 2)], ['mean colour', hex], ['mean chroma', num(C.hue.mean_chroma[k], 2)]] }; }),
    law: 'h_ab = atan2(b*, a*);  chromatic when C*ab >= 8\nconcentration = | sum w e^(i h) | / sum w',
    method: () => `${C.hue.method}. Colourfulness: ${C.colourfulness.method}.`,
  },
  value: {
    name: 'Value', plate: 'value', question: 'How light and dark are spread, read without hue.',
    lensLine: 'value lens: CIELAB L*, area-weighted',
    essence: () => [num(C.value.mean_L, 0), `mean L*, ${C.value.key} key`, strip(C.value.bands.map((b, i) => [['#1b1b1b', '#474747', '#777777', '#ababab', '#e2e2e2'][i], b]))],
    view: () => [table('Value statistics', ['mean L*', 'key', 'p05', 'p50', 'p95'], [[num(C.value.mean_L, 1), C.value.key, num(C.value.p05, 1), num(C.value.p50, 1), num(C.value.p95, 1)]])],
    parts: () => C.value.bands.map((b, i) => ({ key: String(i), label: `L* ${i * 20} to ${i * 20 + 20}`, sub: null, weight: b, hex: ['#1b1b1b', '#474747', '#777777', '#ababab', '#e2e2e2'][i], chip: String(i * 20), mask: bandMask(i),
      cells: [['band', `L* ${i * 20} to ${i * 20 + 20}`], ['weight', pct(b, 2)]] })),
    law: 'L* = 116 f(Y / Yn) - 16',
    method: () => C.value.method + '.',
  },
  composition: {
    name: 'Composition', plate: 'composition', question: 'Where each colour lives, and which colours touch.',
    lensLine: 'composition lens: swatch labels and their 4-neighbours',
    essence: () => [pct(C.composition.coherence, 0), 'of neighbouring pixels share a swatch', strip(SW.map(s => [s.hex, s.share]))],
    view: () => [el('p', {}, el('span', { class: 'big' }, pct(C.composition.coherence)), el('br'), 'of neighbouring pixel pairs share a swatch.')],
    parts: () => SW.map((s, i) => ({ key: String(i), label: `Swatch ${i + 1}  ${s.hex.toUpperCase()}`, sub: C.composition.where[i] ? `centre ${C.composition.where[i].centroid.map(v => num(v, 2)).join(', ')}, spread ${num(C.composition.where[i].spread, 2)}` : null, weight: s.share, hex: s.hex, mask: swatchMask(i),
      cells: [['centre (x, y)', C.composition.where[i]?.centroid.map(v => num(v, 3)).join(', ') ?? 'n/a'], ['spread', num(C.composition.where[i]?.spread, 3)], ['touches most', topTouch(i)]] })),
    law: 'coherence = same-swatch neighbour pairs / all neighbour pairs',
    method: () => C.composition.method + '.',
  },
  checks: {
    name: 'Checks', plate: null, question: 'Controls that show the lenses respond the way a sound instrument should.',
    lensLine: 'controls: a shuffled copy and a uniform grey',
    essence: () => [C.controls ? `${[C.controls.shuffle.holds, C.controls.grey.holds].filter(Boolean).length} of 2` : 'none', 'controls hold', null],
    view: () => [el('div', { class: 'controls' }, seg('Picture shown', [['subject', 'Subject'], ['shuffled', 'Shuffled'], ['grey', 'Grey']], state.view, v => { shuf = null; set({ view: v }); }))],
    parts: () => C.controls ? [
      { key: 'shuffle', label: 'Shuffled pixels', sub: C.controls.shuffle.holds ? 'holds' : 'FAILS', weight: null, hex: null, chip: C.controls.shuffle.holds ? 'ok' : 'x',
        cells: [['palette', C.controls.shuffle.same_hexes ? 'same swatches' : 'swatches differ'], ['largest share change', num(C.controls.shuffle.max_share_change, 6)], ['coherence, subject', pct(C.controls.shuffle.coherence_original, 2)], ['coherence, shuffled', pct(C.controls.shuffle.coherence, 2)]] },
      { key: 'grey', label: 'Uniform grey', sub: C.controls.grey.holds ? 'holds' : 'FAILS', weight: null, hex: C.controls.grey.hex, chip: C.controls.grey.holds ? 'ok' : 'x',
        cells: [['grey', C.controls.grey.hex], ['swatches', C.controls.grey.swatches], ['d on measured L*', num(C.controls.grey.distance.lstar, 4)], ["d on Goethe's lights", num(C.controls.grey.distance.goethe, 4)]] }] : [],
    law: 'shuffle: palette and shares unchanged, coherence falls\ngrey: one swatch, d = 0 on both scales',
    method: () => C.controls?.method ?? 'No controls were run.',
  },
  frame: {
    name: 'Frame', plate: 'frame', question: 'What is observed, from where, for whom, toward what, by which criteria, with what intent.',
    lensLine: 'the frame is declared, not measured',
    essence: () => [S.frame.intent.studier_status, 'studier intent', null],
    view: () => [],
    parts: () => ['object', 'perspective', 'need', 'objective', 'criteria', 'intent'].map(k => ({ key: k, label: k[0].toUpperCase() + k.slice(1), sub: k === 'intent' ? S.frame.intent.studier : S.frame[k], weight: null, hex: null, chip: k[0].toUpperCase(),
      cells: k === 'intent' ? [['studier (declared)', S.frame.intent.studier], ['maker', S.frame.intent.maker ? `${S.frame.intent.maker} (inferred)` : S.frame.intent.maker_status]] : [[k, S.frame[k]]] })),
    law: 'declared before measurement; a maker\'s intent is only ever inferred',
    method: () => 'The six fields are supplied by whoever runs the study, before any measurement, and stored as the frame block of study.json.',
  },
};
function labToLin([L, a, b]) {
  const fy = (L + 16) / 116, fi = t => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27)), X = 0.95047 * fi(fy + a / 500), Y = fi(fy), Z = 1.08883 * fi(fy - b / 200);
  return [3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z, -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z, 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z];
}
function topTouch(i) { const row = C.composition.adjacency[i] ?? []; let j = -1, m = 0; row.forEach((v, k) => { if (v > m) { m = v; j = k; } }); return j < 0 ? 'none' : `swatch ${j + 1} ${SW[j].hex} (${pct(m)} of unlike edges)`; }

function overview() {
  const tiles = Object.entries(LENS).map(([id, L]) => {
    const [key, unit, vis] = L.essence();
    return el('button', { class: 'tile', 'data-key': id, on: { click: e => go({ lens: id, part: null, method: false }, e.currentTarget) } }, el('span', { class: 'name' }, L.name), el('span', { class: 'key' }, key), el('span', { class: 'unit' }, unit), vis);
  });
  return [el('h2', { tabindex: '-1', class: 'sr' }, 'Study overview'), el('div', { class: 'tiles' }, tiles)];
}
