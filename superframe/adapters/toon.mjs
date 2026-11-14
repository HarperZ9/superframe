// adapters/toon.mjs: the cartoon pipeline as graph nodes. toon.cel draws a cast member as cel animation (flat
// fills, a cel shadow, silhouette-weighted ink, optional boil on twos); toon.stopmo draws the same puppet as clay
// on a table (replacement jitter, flicker, no ink); sound.mumble and sound.foley are the cast's own audio.
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import { canvas } from '../lib/toon/raster.mjs';
import { drawPuppet, stage } from '../lib/toon/puppet.mjs';
import { boilStep, heldFrame } from '../lib/toon/ink.mjs';
import { jitterParts, flicker, expose, clay, backdrop } from '../lib/toon/stopmo.mjs';
import { CAST, castById } from '../lib/toon/cast/index.mjs';
import { mumble, thump, grind, hum, bell, RATE } from '../lib/toon/voice.mjs';

const SRC = 'superframe/lib/toon';
const IDS = CAST.map(c => c.id), EXPR = ['neutral', 'e2', 'e3', 'e4', 'e5', 'e6'];
const toRaster = K => { const R = make.raster(K.w, K.h); for (let i = 0; i < K.w * K.h; i++) { R.data[4 * i] = K.px[3 * i]; R.data[4 * i + 1] = K.px[3 * i + 1]; R.data[4 * i + 2] = K.px[3 * i + 2]; R.data[4 * i + 3] = 1; } return R; };
const castParams = {
  who: { type: 'enum', options: IDS, default: 'peep' },
  view: { type: 'number', min: -180, max: 180, default: 0, unit: 'deg' },
  expression: { type: 'enum', options: EXPR, default: 'neutral', doc: 'the six expressions of the model sheet, in sheet order' },
  frame: { type: 'int', min: 0, max: 239, default: 0 },
};
function framing(c, w, h) { const px = (h * 0.86) / c.height; return stage(w / 2, h * 0.94, px); }
const poseOf = (c, e) => c.expressions[Math.max(0, EXPR.indexOf(e))][1];

export const NODES = [
  defineNode({
    id: 'toon.cel', title: 'Cel cartoon: flat fills, weighted ink, boil on twos', lane: 'image', domains: ['animation', 'illustration'], source: `${SRC}/puppet.mjs`,
    doc: 'A cast member as cel animation. Ink is thicker on the side away from the key light; the line boils (redraws) every `hold` frames through a cycle of three drawings.',
    outputs: { raster: 'raster' },
    params: { ...castParams, boil: { type: 'number', min: 0, max: 8, default: 2, unit: 'px' }, hold: { type: 'int', min: 1, max: 4, default: 2, unit: 'frames' }, ground: { type: 'color', default: '#ece3cf' } },
    cost: () => 60,
    render: ({ params, w, h }) => {
      const c = castById(params.who), K = canvas(w, h, params.ground), f = heldFrame(params.frame, params.hold);
      drawPuppet(K, c.build(poseOf(c, params.expression)), params.view * Math.PI / 180, framing(c, w, h), { inkW: 7, boil: { amp: params.boil * w / 1000, cell: 60 * w / 1000, seed: `cel/${c.id}`, step: boilStep(f, { hold: params.hold }) } });
      return { raster: toRaster(K) };
    },
  }),
  defineNode({
    id: 'toon.stopmo', title: 'Stop motion: clay, replacement jitter, flicker', lane: 'image', domains: ['animation', 'stop motion'], source: `${SRC}/stopmo.mjs`,
    doc: 'The same puppet as modelling clay on a cloth sweep: every part knocked a little each frame, exposure flickering, a dome of volume and thumb ridges in the light, no ink.',
    outputs: { raster: 'raster' },
    params: { ...castParams, jitter: { type: 'number', min: 0, max: 10, default: 3, unit: 'model units' }, flicker: { type: 'number', min: 0, max: 0.1, default: 0.035, unit: 'share' }, ground: { type: 'color', default: '#cdb79a' } },
    cost: () => 200,
    render: ({ params, w, h }) => {
      const c = castById(params.who), K = backdrop(canvas(w, h, params.ground), { scale: w / 1000 });
      const parts = jitterParts(c.build(poseOf(c, params.expression)), params.frame, { amp: params.jitter, seed: `stopmo/${c.id}` });
      drawPuppet(K, parts, params.view * Math.PI / 180, framing(c, w, h), { outline: false, inkW: 5, surface: clay({ seed: c.id }) });
      expose(K, flicker(params.frame, { depth: params.flicker }));
      return { raster: toRaster(K) };
    },
  }),
  defineNode({
    id: 'sound.mumble', title: 'Deadpan mumble (formant voice, lip-sync timing)', lane: 'sound', domains: ['speech', 'acoustics'], source: `${SRC}/voice.mjs`,
    doc: 'Source-filter speech that says nothing: glottal pulses through three formant resonators gliding between the line\'s own vowels, with a falling pitch. The caption carries the words.',
    inputs: { text: { type: 'text', optional: true } }, outputs: { audio: 'audio' },
    params: { line: { type: 'string', default: 'which one', options: ['which one', 'the one that says what happened', 'huh'] }, f0: { type: 'number', min: 70, max: 260, default: 110, unit: 'Hz' }, formant: { type: 'number', min: 0.8, max: 1.4, default: 1 } },
    cost: () => 20,
    render: ({ inputs, params }) => ({ audio: make.audio(RATE, [mumble(inputs.text?.text || params.line, { f0: params.f0, formant: params.formant }).pcm]) }),
  }),
  defineNode({
    id: 'sound.foley', title: 'Cast foley: thump, grind, hum, bell', lane: 'sound', domains: ['acoustics', 'foley'], source: `${SRC}/voice.mjs`,
    outputs: { audio: 'audio' },
    params: { kind: { type: 'enum', options: ['thump', 'grind', 'hum', 'bell'], default: 'grind' }, seconds: { type: 'number', min: 0.2, max: 4, default: 1, unit: 's' } },
    cost: () => 10,
    render: ({ params }) => {
      const s = params.seconds, x = params.kind === 'thump' ? thump(s) : params.kind === 'grind' ? grind(s) : params.kind === 'hum' ? hum(s, { level: 0.2 }) : bell(660, s);
      return { audio: make.audio(RATE, [x]) };
    },
  }),
];
