// cast/index.mjs: the cast as data. Each entry names its builder, the model-sheet framing (focus: the head's
// centre in model units and the close-up radius), and the six expressions its sheet shows. Expressions are plain
// parameter sets of the builder, so the same names drive the animation tests.
import { buildPeep, PEEP } from './peep.mjs';
import { buildDarlene, DARLENE } from './darlene.mjs';
import { buildRay, RAY } from './ray.mjs';
import { buildGladhand, GLADHAND } from './gladhand.mjs';
import { buildMulch, MULCH } from './mulch.mjs';
import { buildGulp, GULP } from './gulp.mjs';

export const CAST = [
  { ...PEEP, build: buildPeep, height: 1350, focus: [0, -560], radius: 330, keys: ['ball', 'iris', 'pupil', 'lid', 'vein', 'sock', 'shoe', 'glass'],
    expressions: [
      ['neutral', { expr: { aperture: 0.45, lid: 0.3 } }], ['suspicious', { expr: { aperture: 0.12, lid: 0.55, lidTilt: 0.5, veins: 0.6 } }],
      ['taking it in', { expr: { aperture: 0.95, lid: 0.05, veins: 0.1 } }], ['seen enough', { expr: { aperture: 0.05, lid: 0.7, veins: 1 } }],
      ['pleased', { expr: { aperture: 0.6, lid: 0.15, squint: 0.2 } }], ['sad', { expr: { aperture: 0.35, lid: 0.45, lidTilt: -0.5, tear: true } }],
    ] },
  { ...DARLENE, build: buildDarlene, height: 1000, focus: [-10, -900], radius: 230, keys: ['skin', 'hair', 'shadow', 'shirt', 'blouse', 'pants', 'lip', 'lanyard'],
    expressions: [
      ['deadpan', {}], ['talking', { expr: { mouth: { kind: 'open', open: 0.35 } } }],
      ['slow blink', { expr: { lid: 0.95 } }], ['one brow', { expr: { lid: 0.4, brow: [0.6, 0.5] } }],
      ['not today', { expr: { lid: 0.7, look: [0.8, 0], brow: [-0.3, 0] } }], ['startled (rare)', { expr: { lid: 0.05, pupil: 0.6, brow: [1, 0], mouth: { kind: 'o', open: 0.5 } } }],
    ] },
  { ...RAY, build: buildRay, height: 1100, focus: [0, -960], radius: 250, keys: ['skin', 'hair', 'shirt', 'pants', 'shoe', 'lens', 'belt', 'cup'],
    expressions: [
      ['deadpan', {}], ['talking', { expr: { mouth: { kind: 'open', open: 0.4 } } }],
      ['huh', { expr: { lid: 0.3, brow: [0.5, -0.3], mouth: { kind: 'line', curve: -0.4 } } }], ['sip', { sip: 1, expr: { lid: 0.7 } }],
      ['dawning', { expr: { lid: 0.1, pupil: 0.7, brow: [0.8, 0], mouth: { kind: 'open', open: 0.15 } } }], ['annoyed', { expr: { lid: 0.5, lidTilt: 0.6, brow: [-0.4, 0.8], mouth: { kind: 'line', curve: -0.6 } } }],
    ] },
  { ...GLADHAND, build: buildGladhand, height: 1450, focus: [0, -960], radius: 300, keys: ['skin', 'suit', 'stripe', 'tie', 'hair', 'gum', 'teeth', 'gold', 'sweat'],
    expressions: [
      ['the grin', {}], ['big grin', { expr: { mouth: { open: 0.9, width: 1.15 } } }],
      ['sincere', { expr: { lid: 0.45, look: [0.8, -0.3], mouth: { open: 0.2 } } }], ['caught', { expr: { lid: 0, pupil: 0.5, mouth: { kind: 'o' } } }],
      ['wink', { expr: { lid: 0.95, mouth: { open: 0.6, width: 1.1 } } }], ['oh no', { expr: { lid: 0.1, lidTilt: -0.8, pupil: 0.6, mouth: { open: 0.1, width: 0.8 } } }],
    ] },
  { ...MULCH, build: buildMulch, height: 1500, focus: [0, -480], radius: 330, keys: ['body', 'lid', 'bin', 'mouth', 'steel', 'paper', 'rule', 'gum'],
    expressions: [
      ['idle', {}], ['chomp', { expr: { open: 1 } }],
      ['jammed', { expr: { open: 0.1, look: [0.9, 0], lookR: [-0.9, 0], sweat: true } }], ['guilty', { expr: { open: 0.05, look: [-0.8, 0.6], lookR: [-0.8, 0.6], lid: 0.4, sweat: true } }],
      ['full', { squash: 0.85, expr: { open: 0.2, lid: 0.55 } }], ['off', { expr: { open: 0, lid: 0.95, on: false } }],
    ] },
  { ...GULP, build: buildGulp, height: 1300, focus: [0, -520], radius: 380, keys: ['body', 'gum', 'throat', 'tooth', 'eye', 'thumb', 'card', 'lure'],
    expressions: [
      ['the lure', { expr: { lure: true } }], ['hungry', { expr: { open: 0.8 } }],
      ['swallowing', { expr: { open: 0.2, spin: 0.3 } }], ['notifying', { expr: { open: 0.5, blink: 0.5 } }],
      ['wide', { expr: { open: 1, spin: 0.15 } }], ['lure slipping', { expr: { lure: true, open: 0.9 } }],
    ] },
];
export const castById = id => CAST.find(c => c.id === id);
