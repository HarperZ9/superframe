// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// intent.mjs: prose to recipe, the front end a person writes in. The intent is split into clauses (commas,
// semicolons, "and", "with", "then"); each clause that names a law becomes one element, and the words around the law
// set its weights: strength (faint, soft, heavy), colour, place, scale (fine, broad), detail, and which media it
// passes into (heard, silent, lettered, carved). Text in quotes becomes the type. A few words set the whole sheet
// (paper colour, "quiet", "loud").
// Parsing is deterministic and uses no randomness: the seed acts only at render. Every word the lexicon does not
// read is listed in report.unused, and report sits outside the recipe hash, so rewording around the laws changes
// nothing that renders (tests/artifact.test.mjs checks it).

const LAW_WORDS = {
  rd: ['coral', 'reaction', 'diffusion', 'spots', 'stripes', 'worms', 'mitosis', 'turing'],
  marble: ['marble', 'marbling', 'suminagashi', 'ebru', 'swirl', 'swirls'],
  frost: ['frost', 'ice', 'snowflake', 'crystal', 'crystals', 'rime'],
  dla: ['lichen', 'branching', 'aggregate', 'coralline', 'dendrite', 'dendrites'],
  physarum: ['mycelium', 'slime', 'physarum', 'network', 'veins', 'mould', 'mold'],
  contour: ['contour', 'contours', 'topographic', 'isolines', 'elevation'],
  advect: ['ink', 'pour', 'poured', 'bleed', 'smoke', 'fluid', 'stain', 'wash'],
  life: ['life', 'automata', 'automaton', 'cells', 'conway'],
  lenia: ['lenia', 'creatures', 'organisms', 'gliders'],
  symmetry: ['symmetry', 'tiling', 'wallpaper', 'lattice', 'pattern', 'tessellation'],
  cloud: ['cloud', 'clouds', 'cumulus', 'vapour', 'vapor'],
  roads: ['roads', 'city', 'streets', 'paths', 'routes'],
  spray: ['spray', 'graffiti', 'aerosol', 'drips', 'spatter'],
  ribbon: ['ribbon', 'ribbons', 'waves', 'wave', 'current', 'tide'],
  orbit: ['orbit', 'orbits', 'planets', 'kepler', 'orbital'],
};
const RD_PRESET = { spots: 'spots', stripes: 'stripes', worms: 'worms', mitosis: 'mitosis', coral: 'coral' };
const STRENGTH = { faint: 0.35, whisper: 0.3, pale: 0.45, soft: 0.55, light: 0.5, quiet: 0.5, strong: 0.95, heavy: 1, dense: 1, deep: 0.95, bold: 0.9 };
const SCALE = { fine: 340, tiny: 420, small: 300, broad: 140, large: 140, vast: 100, wide: 150 };
const DETAIL = { rough: 0.9, grainy: 0.9, textured: 0.85, smooth: 0.15, polished: 0.1, worn: 0.75 };
const COLOUR = {
  indigo: '#2b3a6b', blue: '#2c4f8a', navy: '#1d2a4a', teal: '#1f6466', sea: '#2a6f73', green: '#3d6a3a', moss: '#57683a',
  ochre: '#b8862f', gold: '#c9a23f', yellow: '#d8b440', rust: '#a4482a', vermilion: '#c2412b', red: '#a93b29', rose: '#b8676e',
  plum: '#5a2e4f', violet: '#4b3a7a', umber: '#5a3a22', sepia: '#6b4a2c', black: '#16161a', ink: '#1d2a3a', grey: '#6b6b70', gray: '#6b6b70', bone: '#e6dccb',
};
const PLACES = [
  [/\b(upper|top)\s+left\b/, [0.25, 0.28]], [/\b(upper|top)\s+right\b/, [0.75, 0.28]], [/\b(lower|bottom)\s+left\b/, [0.25, 0.72]], [/\b(lower|bottom)\s+right\b/, [0.75, 0.72]],
  [/\b(top|upper|above|sky)\b/, [0.5, 0.22]], [/\b(bottom|lower|below|ground|floor)\b/, [0.5, 0.78]], [/\bleft\b/, [0.22, 0.5]], [/\bright\b/, [0.78, 0.5]], [/\b(centre|center|middle|heart)\b/, [0.5, 0.5]],
];
const MEDIA_WORDS = { silent: ['sound', 0], mute: ['sound', 0], heard: ['sound', 1], singing: ['sound', 1], unlettered: ['type', 0], lettered: ['type', 1], carved: ['material', 1], flat: ['material', 0.2], undrawn: ['lines', 0], drawn: ['lines', 1], unpainted: ['paint', 0.15] };
const SHEET = { quiet: { sound: 0.5 }, loud: { sound: 1 } };
const FILL = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'over', 'under', 'into', 'across', 'its', 'it', 'is', 'as', 'by', 'from', 'that', 'this', 'like']);

const lawOf = word => Object.entries(LAW_WORDS).find(([, ws]) => ws.includes(word))?.[0] ?? null;
const words = s => s.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter(Boolean);

// golden-angle placement for elements with no place word: stable, spread, and never random
const golden = i => { const a = i * 2.39996, rad = 0.12 + 0.2 * Math.sqrt((i + 0.5) / 6); return [0.5 + rad * Math.cos(a) * 1.3, 0.5 + rad * Math.sin(a)]; };

export function parseIntent(intent, { seed = 'artifact', size = [3840, 2160] } = {}) {
  const quoted = [...intent.matchAll(/"([^"]+)"|“([^”]+)”/g)].map(m => m[1] ?? m[2]), bare = intent.replace(/"[^"]*"|“[^”]*”/g, ' ');
  const clauses = bare.split(/[,;.]|\band\b|\bwith\b|\bthen\b|\bwhile\b/i).map(s => s.trim()).filter(Boolean);
  const used = new Set(), unused = [], elements = [], media = {}, palette = {}, counts = {};
  for (const clause of clauses) {
    const ws = words(clause), law = ws.map(lawOf).find(Boolean), lc = clause.toLowerCase();
    if (!law) {
      for (const w of ws) {
        if (w === 'paper' || w === 'ground') { const c = ws.map(x => COLOUR[x]).find(Boolean); if (c) { palette.paper = c; used.add(w); ws.filter(x => COLOUR[x]).forEach(x => used.add(x)); } }
        else if (SHEET[w]?.sound !== undefined) { media.sound = SHEET[w].sound; used.add(w); }
        else if (elements.length && MEDIA_WORDS[w]) { const prev = elements.at(-1); prev.transparency[MEDIA_WORDS[w][0]] = MEDIA_WORDS[w][1]; used.add(w); }
        else if (elements.length && STRENGTH[w] !== undefined) { elements.at(-1).strength = STRENGTH[w]; used.add(w); }
      }
      ws.forEach(w => { if (!used.has(w) && !FILL.has(w)) unused.push(w); });
      continue;
    }
    const lawWord = ws.find(w => lawOf(w) === law); used.add(lawWord);
    counts[lawWord] = (counts[lawWord] ?? 0) + 1;
    const e = { id: counts[lawWord] > 1 ? `${lawWord}${counts[lawWord]}` : lawWord, law, weights: {}, region: {}, transparency: {} };
    if (law === 'rd' && RD_PRESET[lawWord]) e.weights.preset = RD_PRESET[lawWord];
    for (const w of ws) {
      if (STRENGTH[w] !== undefined) { e.strength = STRENGTH[w]; used.add(w); }
      else if (SCALE[w] !== undefined) { e.scale = SCALE[w]; used.add(w); }
      else if (DETAIL[w] !== undefined) { e.detail = DETAIL[w]; used.add(w); }
      else if (COLOUR[w]) { e.ink = COLOUR[w]; used.add(w); }
      else if (MEDIA_WORDS[w]) { e.transparency[MEDIA_WORDS[w][0]] = MEDIA_WORDS[w][1]; used.add(w); }
    }
    const pl = PLACES.find(([re]) => re.test(lc));
    if (pl) { [e.region.cx, e.region.cy] = pl[1]; lc.match(pl[0])[0].split(/\s+/).forEach(w => used.add(w)); }
    else [e.region.cx, e.region.cy] = golden(elements.length);
    const big = /\b(everywhere|whole|all over|across)\b/.test(lc); if (big) { e.region = { cx: 0.5, cy: 0.5, rx: 0.52, ry: 0.55, feather: 0.4 }; ['everywhere', 'whole', 'across'].forEach(w => used.add(w)); }
    e.region.rx ??= 0.26; e.region.ry ??= 0.34; e.region.feather ??= 0.45;
    ws.forEach(w => { if (!used.has(w) && !FILL.has(w) && lawOf(w) !== law) unused.push(w); });
    elements.push(e);
  }
  const recipe = { schema: 'superframe.artifact/1', seed, size, text: quoted.join(' '), palette, media, elements };
  return { recipe, report: { clauses: clauses.length, elements: elements.map(e => `${e.id} (${e.law})`), unused: [...new Set(unused)].sort() } };
}

export const LEXICON = { LAW_WORDS, STRENGTH, SCALE, DETAIL, COLOUR, MEDIA_WORDS };
