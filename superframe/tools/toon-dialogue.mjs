// toon-dialogue.mjs: test 1, the deadpan dialogue beat. County records office, night desk. Ray asks for a record;
// Darlene tells him where it went. Two-shot, cut to the shredder, cut to Ray. Animated on twos with a boiling line;
// the comedy is in the holds. Sound: the cast's own mumble voices, a fluorescent hum and the shredder grind.
//   node tools/toon-dialogue.mjs [outDir]
import { writeWAV } from '../lib/export.mjs';
import { canvas, fill } from '../lib/toon/raster.mjs';
import { ellipse } from '../lib/toon/geom.mjs';
import { drawPuppet, stage } from '../lib/toon/puppet.mjs';
import { boilStep } from '../lib/toon/ink.mjs';
import { setLine } from '../lib/toon/letter.mjs';
import { buildRay } from '../lib/toon/cast/ray.mjs';
import { buildDarlene } from '../lib/toon/cast/darlene.mjs';
import { buildMulch } from '../lib/toon/cast/mulch.mjs';
import { mumble, mouthAt, hum, grind, mixInto, limit, RATE } from '../lib/toon/voice.mjs';
import { W, H, box, inked, rect, caption, lineAt, pulse, ramp, renderClip } from '../lib/toon/scene.mjs';

const OUT = process.argv[2] ?? 'out/toon/tests', SECONDS = 14.5;
const RAY_V = { f0: 96, formant: 0.94, speed: 4.4, seed: 'ray' }, DAR_V = { f0: 178, formant: 1.16, speed: 3.4, fall: 0.5, seed: 'darlene' };
const SCRIPT = [
  [1.0, 'ray', "I'm here about the record."], [3.7, 'darlene', 'Which one.'], [5.1, 'ray', 'The one that says what happened.'],
  [8.4, 'darlene', 'That one went in the shredder.'], [13.0, 'ray', 'Huh.'],
];
const LINES = SCRIPT.map(([t, who, text]) => { const v = mumble(text, who === 'ray' ? RAY_V : DAR_V); return { t, who, text, ...v }; });
const CAPS = LINES.map(l => [l.t, l.t + Math.max(1.1, l.seconds + 0.25), l.text]);
const talk = (who, t) => { for (const l of LINES) if (l.who === who && t >= l.t && t < l.t + l.seconds) return mouthAt(l.syl, t - l.t, who === 'ray' ? 0.42 : 0.3); return 0; };
const mouthOf = v => (v > 0.03 ? { kind: 'open', open: v } : { kind: 'line', curve: 0 });
const blink = (t, at) => at.some(b => t >= b && t < b + 0.17);

// ---- the set: a records counter under a fluorescent tube, painted flat
function office(K, t) {
  box(K, 0, 0, W, H, '#c9c6a2'); box(K, 0, 1340, W, H - 1340, '#8f8d70'); box(K, 0, 1330, W, 18, '#6f6d55');
  box(K, 600, 0, 2600, 70, '#e9ecdc'); inked(K, [rect(560, 60, 2680, 60, 10)], '#f4f6ea');
  inked(K, [rect(1640, 230, 980, 300, 16)], '#2f4f45');
  fill(K, setLine('RECORDS', { x: 2130, y: 420, size: 170, weight: 800, align: 'center' }), '#e9e2c8');
  inked(K, [ellipse(3450, 380, 130, 130, 64)], '#f3efe2');
  const ang = (t / 60) * Math.PI * 2 - 0.4; for (const [len, a, w] of [[90, ang, 7], [70, -1.1 + t * 0.002, 10]]) fill(K, [rect(3446, 380 - len, w, len, 3)].map(C => C.map(([x, y]) => { const dx = x - 3450, dy = y - 380; return [3450 + dx * Math.cos(a) - dy * Math.sin(a), 380 + dx * Math.sin(a) + dy * Math.cos(a)]; })), '#17120e');
  inked(K, [rect(260, 520, 640, 760, 10)], '#b9b38f'); for (let i = 0; i < 4; i++) inked(K, [rect(300, 560 + i * 180, 560, 150, 6)], '#a8a17c');
}
function counter(K) {
  inked(K, [rect(1700, 1330, 2300, 900, 6)], '#9b7650');
  for (let i = 0; i < 6; i++) box(K, 1760 + i * 380, 1420, 6, 760, '#7f5f3e');
  inked(K, [rect(1640, 1270, 2400, 90, 10)], '#ddd4b8');
  inked(K, [rect(2050, 1150, 120, 130, 14)], '#c8352d');
  fill(K, setLine('TAKE A NUMBER', { x: 2110, y: 1130, size: 34, weight: 700, align: 'center', style: 'mono' }), '#17120e');
}

function wide(K, f, t) {
  office(K, t);
  const step = boilStep(f), boil = { amp: 2.6, cell: 70, step };
  const dLid = blink(t, [0.4, 3.1, 11]) ? 0.97 : 0.55 + 0.4 * pulse(t, 7.0, 8.2);
  drawPuppet(K, buildDarlene({ expr: { lid: dLid, mouth: mouthOf(talk('darlene', t)), look: [0.3, 0] } }), -0.7, stage(2900, 2090, 1.6), { inkW: 7, boil: { ...boil, seed: 'darlene' } });
  counter(K);
  const rLid = blink(t, [2.3, 6.4, 9.5]) ? 0.97 : 0.45;
  drawPuppet(K, buildRay({ expr: { lid: rLid, mouth: mouthOf(talk('ray', t)), look: [0.4, 0] }, lean: 0 }), 0.85, stage(1080, 2050, 1.55), { inkW: 7, boil: { ...boil, seed: 'ray' } });
}
function shredCU(K, f, t) {
  box(K, 0, 0, W, H, '#b7b48f'); for (let i = 0; i < 3; i++) inked(K, [rect(200, 300 + i * 520, 3440, 40, 4)], '#8a7b5c');
  for (let i = 0; i < 9; i++) inked(K, [rect(260 + i * 380, 40 + (i % 3) * 520, 300, 250, 8)], i % 2 ? '#c9b48a' : '#bba57b');
  const chew = 0.5 + 0.5 * Math.sin(t * 15), u = ramp(t, 10.0, 11.6);
  drawPuppet(K, buildMulch({ expr: { open: 0.25 + 0.7 * chew, look: [0.8, -0.2 + u * 0.6], lookR: [-0.7, 0.4] }, squash: 1 - 0.04 * chew }), -0.3, stage(1920, 2380, 2.6), { inkW: 6, boil: { amp: 3.2, cell: 70, step: boilStep(f), seed: 'mulch' } });
}
function rayCU(K, f, t) {
  box(K, 0, 0, W, H, '#c9c6a2'); box(K, 0, 1900, W, 260, '#8f8d70');
  inked(K, [rect(2700, -200, 1600, 700, 30)], '#2f4f45'); fill(K, setLine('REC', { x: 2840, y: 380, size: 420, weight: 800 }), '#e9e2c8');
  const sip = pulse(t, 11.7, 12.9) ** 0.5, huh = ramp(t, 13.0, 13.4);
  const e = { lid: blink(t, [12.95]) ? 0.97 : 0.45 + 0.25 * sip - 0.15 * huh, brow: [0.5 * huh, -0.2 * huh], mouth: mouthOf(talk('ray', t)), look: [0.3, 0] };
  drawPuppet(K, buildRay({ expr: e, sip }), 0.55, stage(1450, 1000 + 960 * 3.6, 3.6), { inkW: 6, boil: { amp: 3.2, cell: 80, step: boilStep(f), seed: 'ray' } });
}

function draw(f, t) {
  const K = canvas(W, H, '#000000');
  if (t < 10.0) wide(K, f, t); else if (t < 11.6) shredCU(K, f, t); else rayCU(K, f, t);
  caption(K, lineAt(CAPS, t));
  return K;
}

function soundtrack(path) {
  const bus = new Float32Array(Math.ceil(SECONDS * RATE));
  mixInto(bus, hum(SECONDS, { level: 0.02 }), 0);
  for (const l of LINES) mixInto(bus, l.pcm, l.t, 0.8);
  mixInto(bus, grind(2.2, { seed: 'dlg' }), 9.6, 0.22);
  writeWAV(path, { rate: RATE, channels: [limit(bus)] });
  return path;
}

if (process.env.TOON_PEEK) {                                   // TOON_PEEK=24,130 renders only those frames
  const { writePng } = await import('../lib/toon/out.mjs');
  for (const f of process.env.TOON_PEEK.split(',').map(Number)) console.log(await writePng(`${OUT}/peek/01-f${f}.png`, draw(f, f / 24)));
  process.exit(0);
}
const wav = soundtrack(`${OUT}/01-deadpan-dialogue.wav`);
const res = await renderClip(`${OUT}/01-deadpan-dialogue.mp4`, { seconds: SECONDS, draw, audio: wav, stills: [24, 90, 130, 186, 216, 252, 290, 330], stillDir: `${OUT}/stills/01` });
console.log(res);
