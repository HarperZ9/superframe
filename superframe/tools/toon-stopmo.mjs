// toon-stopmo.mjs: test 2, the stop-motion piece. A desk top, a cloth sweep, tungsten light. Mulch eats a page.
// Peep walks in, stops and stares. Mulch freezes, then brings the page back up, whole. Peep reads it with the loupe.
// Clay surface, replacement jitter on every part, exposure flicker, a camera nudged by the table, shot on twos.
// Mid-walk the capture onion skin comes on (lib/stack readStack, flat ghosts of past and next frames).
//   node tools/toon-stopmo.mjs [outDir]       TOON_PEEK=40,120 renders only those frames
import { writeWAV } from '../lib/export.mjs';
import { canvas, fill, coverage, paintSafe, blurCov } from '../lib/toon/raster.mjs';
import { ellipse, roundRect } from '../lib/toon/geom.mjs';
import { drawPuppet, stage } from '../lib/toon/puppet.mjs';
import { jitterParts, flicker, expose, clay, backdrop } from '../lib/toon/stopmo.mjs';
import { castShadow, silhouette } from '../lib/toon/layer.mjs';
import { readStack } from '../lib/stack/stack.mjs';
import { buildPeep } from '../lib/toon/cast/peep.mjs';
import { buildMulch } from '../lib/toon/cast/mulch.mjs';
import { thump, grind, hum, mixInto, limit, RATE } from '../lib/toon/voice.mjs';
import { W, H, FPS, ramp, ease, pulse, renderClip } from '../lib/toon/scene.mjs';
import { rngFrom } from '../lib/seed.mjs';

const OUT = process.argv[2] ?? 'out/toon/tests', SECONDS = 10, ONION = [1.8, 3.4];
const WALK_END = 4.0, STEPS_PER_S = 1.6;

function set(K) {
  fill(K, [[[0, 0], [W, 0], [W, 1480], [0, 1480]]], '#b79a7c');
  fill(K, [[[0, 1440], [W, 1440], [W, H], [0, H]]], '#7d5534');
  backdrop(K, { seed: 'sweep', depth: 0.12, fibre: 0.05, scale: 3 });
  for (let i = 0; i < 6; i++) fill(K, [[[0, 1500 + i * 120 + i * i * 14], [W, 1490 + i * 120 + i * i * 14], [W, 1494 + i * 120 + i * i * 14], [0, 1504 + i * 120 + i * i * 14]]], '#5e3e24', 0.6);
  const lip = coverage([[[0, 1400], [W, 1400], [W, 1520], [0, 1520]]], W, H); paintSafe(K, blurCov(lip, 40), '#2a1a10', 0.22);
}

// Acting curves, seconds.
const peepX = t => 4250 - 1500 * ease(ramp(t, 0.3, WALK_END));
const stare = t => ramp(t, 4.6, 5.2), spit = t => ease(ramp(t, 6.2, 7.6)), read = t => ease(ramp(t, 7.8, 8.6));
function mulchPose(t) {
  const chewing = t < 5.0, chew = chewing ? 0.5 + 0.5 * Math.sin(t * 13) : 0.7, frozen = !chewing;
  return { expr: { open: frozen ? 0.75 - 0.5 * spit(t) : 0.2 + 0.75 * chew, look: frozen ? [0.9, 0.1] : [0.2, -0.6], lookR: frozen ? [0.9, 0.1 * stare(t)] : [-0.5, 0.4], sweat: t > 5.6, lid: 0 }, squash: 1 - 0.05 * chew * (chewing ? 1 : 0) };
}
function page(t) {
  // into the top slot while chewing, back out after the stare
  const down = t < 5 ? ease(ramp(t, 0.2, 4.8)) * 0.85 : 0.85 * (1 - spit(t)), y0 = -700 + down * 360, lift = read(t), y = y0 + (-560 - y0) * lift;
  const P = roundRect(0, 0, 250 + 20 * lift, 330, 6);
  const at = [lift * 640, y, -10 + lift * 400], bias = -0.2 + lift * 50;
  const rules = Array.from({ length: 7 }, (_, i) => ({ id: `rule${i}`, kind: 'flat', stick: true, clip: 'page', at: [at[0], at[1] - 120 + i * 38, at[2] + 1], shape: roundRect(-10 + (i % 3) * 8, 0, 170 - (i % 3) * 30 - (i === 6 ? 80 : 0), 8, 3), fill: '#5a6f8e', inkW: 0, bias: bias + 0.01 }));
  return [{ id: 'page', kind: 'flat', at, shape: P, fill: '#f4f0e4', inkW: 0, bias }, ...rules];
}
function peepPose(t) {
  const walking = t < WALK_END, step = walking ? t * STEPS_PER_S : undefined;
  return { step, loupe: true, expr: { aperture: 0.5 - 0.42 * stare(t) + 0.45 * read(t), lid: 0.25 + 0.3 * stare(t) - 0.3 * read(t), veins: 0.2 + 0.6 * stare(t) * (1 - read(t)), lidTilt: 0.4 * stare(t) * (1 - read(t)) } };
}

function frameParts(f, t) {
  const mul = jitterParts([...buildMulch(mulchPose(t)), ...page(t)], f, { amp: 3.5, rot: 0.01, seed: 'sm/mulch' });
  const pe = jitterParts(buildPeep(peepPose(t)), f, { amp: 3.5, rot: 0.012, seed: 'sm/peep' });
  return { mul, pe, peepTheta: -Math.PI / 2 + 1.05 * ease(ramp(t, WALK_END - 0.3, WALK_END + 0.5)) };
}

const nudge = f => { const r = rngFrom(`sm/cam/${f}`); return [(r() - 0.5) * 5, (r() - 0.5) * 5]; };
function draw(f, t) {
  const K = canvas(W, H, '#000000'); set(K);
  const { mul, pe, peepTheta } = frameParts(f, t), [cx, cy] = nudge(f);
  const mM = stage(1350 + cx, 1990 + cy, 1.55), mP = stage(peepX(t) + cx, 2010 + cy, 1.45);
  castShadow(K, mul, -0.25, mM, { dx: 90, dy: -30, blur: 40, opacity: 0.42 });
  castShadow(K, pe, peepTheta, mP, { dx: 90, dy: -30, blur: 40, opacity: 0.42 });
  const surf = id => clay({ seed: id, ridge: 0.6 });
  drawPuppet(K, mul, -0.25, mM, { outline: false, inkW: 5, surface: surf('mulch') });
  drawPuppet(K, pe, peepTheta, mP, { outline: false, inkW: 5, surface: surf('peep') });
  expose(K, flicker(f, { depth: 0.04 }));
  return t >= ONION[0] && t < ONION[1] ? onion(K, f, t) : K;
}

// Capture onion skin: Peep's silhouette at the held frames before (warm) and after (cool), flat, over the live view.
function onion(K, f, t) {
  const entries = [];
  for (const j of [-6, -4, -2, 2, 4]) {
    const g = f + j, tg = g / FPS, { pe, peepTheta } = frameParts(g, tg), { a } = silhouette(pe, peepTheta, stage(peepX(tg), 2010, 1.45), W, H);
    entries.push({ layer: { w: W, h: H, px: new Float32Array(W * H * 3), a }, flat: j < 0 ? [0.85, 0.25, 0.2] : [0.2, 0.55, 0.95], opacity: 0.3 * Math.min(ramp(t, ONION[0], ONION[0] + 0.25), 1 - ramp(t, ONION[1] - 0.25, ONION[1])) });
  }
  return readStack({ w: W, h: H, px: K.px }, entries);
}

function soundtrack(path) {
  const bus = new Float32Array(Math.ceil(SECONDS * RATE));
  mixInto(bus, hum(SECONDS, { level: 0.012, seed: 'sm' }), 0);
  for (let s = 0.4; s < WALK_END; s += 1 / (2 * STEPS_PER_S)) mixInto(bus, thump(0.25, { f: 70 + (s * 37 % 20), seed: `step${s}` }), s, 0.55);
  mixInto(bus, grind(4.8, { seed: 'sm-eat' }), 0.2, 0.25);
  const back = grind(1.4, { seed: 'sm-spit', cut: 31 }).reverse(); mixInto(bus, back, 6.2, 0.3);
  mixInto(bus, thump(0.3, { f: 55, seed: 'stop' }), WALK_END + 0.05, 0.7);
  writeWAV(path, { rate: RATE, channels: [limit(bus)] });
  return path;
}

if (process.env.TOON_PEEK) {
  const { writePng } = await import('../lib/toon/out.mjs');
  for (const f of process.env.TOON_PEEK.split(',').map(Number)) console.log(await writePng(`${OUT}/peek/02-f${f}.png`, draw(f, f / FPS)));
  process.exit(0);
}
const wav = soundtrack(`${OUT}/02-stop-motion.wav`);
console.log(await renderClip(`${OUT}/02-stop-motion.mp4`, { seconds: SECONDS, draw, audio: wav, stills: [30, 96, 130, 170, 206, 228], stillDir: `${OUT}/stills/02` }));
