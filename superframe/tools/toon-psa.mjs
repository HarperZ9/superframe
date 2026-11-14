// toon-psa.mjs: test 3, the weird-print PSA parody card. A 90s public-service comic page come loose: sunburst,
// bouncing hand-set type, Gulp wearing its smiley lure, Peep pointing the loupe. The lure slips; the card says what
// the thing eats. Thumbs leave frame-offset echoes (lib/stack readStack, tinted delayed copies). Everything goes
// through the comic print pass: key plate, two screened inks, plates that slide every frame.
//   node tools/toon-psa.mjs [outDir]       TOON_PEEK=40,120 renders only those frames
import { writeWAV } from '../lib/export.mjs';
import { canvas, fill, coverage, paint } from '../lib/toon/raster.mjs';
import { ellipse, star, curve } from '../lib/toon/geom.mjs';
import { drawPuppet, stage } from '../lib/toon/puppet.mjs';
import { boilStep, boil, inkClosed } from '../lib/toon/ink.mjs';
import { setLine } from '../lib/toon/letter.mjs';
import { puppetLayer } from '../lib/toon/layer.mjs';
import { readStack } from '../lib/stack/stack.mjs';
import { comicPrint } from '../lib/toon/print.mjs';
import { buildGulp } from '../lib/toon/cast/gulp.mjs';
import { buildPeep } from '../lib/toon/cast/peep.mjs';
import { mumble, bell, grind, mixInto, limit, RATE } from '../lib/toon/voice.mjs';
import { W, H, FPS, ramp, ease, pulse, box, renderClip } from '../lib/toon/scene.mjs';

const OUT = process.argv[2] ?? 'out/toon/tests', SECONDS = 8, SLIP = [3.6, 4.4];
const INK = '#16110f';

function sunburst(K, t) {
  box(K, 0, 0, W, H, '#f6ead0');
  const cx = 2750, cy = 1000, n = 22, rot = Math.floor(t * 12) * 0.006;
  for (let i = 0; i < n; i += 2) { const a0 = rot + (i / n) * Math.PI * 2, a1 = rot + ((i + 1) / n) * Math.PI * 2; fill(K, [[[cx, cy], [cx + 6000 * Math.cos(a0), cy + 6000 * Math.sin(a0)], [cx + 6000 * Math.cos(a1), cy + 6000 * Math.sin(a1)]]], '#f2a48c'); }
}
// Hand-set type: each glyph bobs and tilts on its own, redrawn every hold, with an ink rim and a hard drop shadow.
function shout(K, text, o, f) {
  const step = Math.floor(f / 2), wob = i => { const s = Math.sin(i * 12.9898 + step * 1.7) * 43758.5453, u = s - Math.floor(s); return [0, (u - 0.5) * o.size * 0.06, (u - 0.5) * 0.08]; };
  const Cs = boil(setLine(text, { ...o, wobble: wob }), { amp: 2.5, cell: 50, seed: 'type', step: boilStep(f) });
  fill(K, Cs.map(C => C.map(([x, y]) => [x + o.size * 0.05, y + o.size * 0.05])), INK);
  paint(K, coverage(Cs.flatMap(C => inkClosed(C, { w: o.size * 0.045, spread: 0.4 })), W, H), INK);
  fill(K, Cs, o.color);
}
function balloon(K, x, y, rx, ry, tail, text, size, f) {
  const B = boil([ellipse(x, y, rx, ry, 80), curve([[x - rx * 0.3, y + ry * 0.6], [tail[0], tail[1]], [x - rx * 0.05, y + ry * 0.75]], { closed: true, seg: 3 })], { amp: 3, cell: 60, seed: 'bal', step: boilStep(f) });
  paint(K, coverage(B.flatMap(C => inkClosed(C, { w: 12 })), W, H), INK); fill(K, B, '#fffdf3');
  fill(K, setLine(text, { x, y: y + size * 0.35, size, weight: 800, align: 'center' }), INK);
}

const gulpPose = t => ({ scroll: t * 1.2, reach: 0.5 + 0.5 * Math.sin(t * 5), expr: { lure: t < SLIP[1] + 0.6, lureDrop: ease(ramp(t, SLIP[0], SLIP[1] + 0.6)), open: 0.4 + 0.5 * ramp(t, SLIP[0], SLIP[1]), spin: t * 0.4, blink: t * 0.9 } });
const GM = stage(2800, 1930, 1.45), PM = stage(780, 1930, 1.05);
const arms = t => buildGulp(gulpPose(t)).filter(p => /^(arm|nail)/.test(p.id));

function draw(f, t) {
  let K = canvas(W, H, '#000000'); sunburst(K, t);
  const echo = [6, 3].map((k, i) => ({ layer: puppetLayer(arms(Math.max(0, t - k / FPS)), -0.15, GM, W, H, { inkW: 6 }), tint: i ? [0.2, 0.6, 0.95] : [0.9, 0.25, 0.3], opacity: i ? 0.7 : 0.5 }));
  K = { ...readStack({ w: W, h: H, px: K.px }, echo) };
  const bo = { amp: 3, cell: 70, step: boilStep(f) };
  drawPuppet(K, buildGulp(gulpPose(t)), -0.15, GM, { inkW: 7, boil: { ...bo, seed: 'gulp' } });
  const stare = ramp(t, SLIP[1], SLIP[1] + 0.4);
  drawPuppet(K, buildPeep({ expr: { aperture: 0.6 - 0.5 * stare, lid: 0.2 + 0.35 * stare, veins: 0.2 + 0.7 * stare, lidTilt: 0.4 * stare } }), 0.35, PM, { inkW: 7, boil: { ...bo, seed: 'peep' } });
  const pop = ramp(t, 0.15, 0.5), pop2 = ramp(t, 0.6, 0.95);
  if (pop > 0) shout(K, "DON'T FEED", { x: 140, y: 380, size: 330 * (0.6 + 0.4 * pop), weight: 800, color: '#fffdf3' }, f);
  if (pop2 > 0) shout(K, 'THE FEED!', { x: 160, y: 720, size: 380 * (0.6 + 0.4 * pop2), weight: 800, color: '#e3262f', skew: 0.12 }, f);
  if (t > 1.4) balloon(K, 1080, 900, 360, 150, [880, 1200], t < SLIP[1] ? 'LOOK CLOSER.' : 'SEE?', 92, f);
  if (t > SLIP[1] + 0.2) {
    const s = ease(ramp(t, SLIP[1] + 0.2, SLIP[1] + 0.5)), cx = 1620, cy = 1400;
    const S = boil([star(cx, cy, 520 * s, 360 * s, 14, 0.1)], { amp: 4, cell: 60, seed: 'burst', step: boilStep(f) });
    paint(K, coverage(S.flatMap(C => inkClosed(C, { w: 14 })), W, H), INK); fill(K, S, '#fffdf3');
    if (s > 0.9) { shout(K, 'IT EATS', { x: cx, y: cy - 30, size: 150, weight: 800, align: 'center', color: '#e3262f' }, f); shout(K, 'YOUR TIME!', { x: cx, y: cy + 140, size: 150, weight: 800, align: 'center', color: '#e3262f' }, f); }
  }
  box(K, 0, 2000, W, 160, INK);
  fill(K, setLine('A PUBLIC SERVICE MESSAGE FROM THE COMMONS.   YOUR TIME IS YOURS.', { x: W / 2, y: 2100, size: 60, style: 'mono', weight: 600, align: 'center' }), '#fffdf3');
  return comicPrint(K, { f: Math.floor(f / 2), cell: 12, misreg: 7 });
}

function soundtrack(path) {
  const bus = new Float32Array(Math.ceil(SECONDS * RATE));
  mixInto(bus, bell(784, 1.4), 0.15, 0.7); mixInto(bus, bell(988, 1.4), 0.6, 0.6); mixInto(bus, bell(1175, 1.8), 0.95, 0.55);
  const ann = { f0: 128, formant: 1.02, speed: 5, fall: 0.15, seed: 'announcer' };
  mixInto(bus, mumble("Don't feed the feed!", ann).pcm, 0.4, 0.7);
  mixInto(bus, bell(392, 1.0, { index: 6 }), SLIP[0] + 0.2, 0.5); mixInto(bus, bell(330, 1.2, { index: 7 }), SLIP[0] + 0.5, 0.5);
  mixInto(bus, grind(0.9, { seed: 'psa', cut: 40 }), SLIP[1], 0.25);
  mixInto(bus, mumble('It eats your time!', { ...ann, f0: 140 }).pcm, SLIP[1] + 0.5, 0.7);
  mixInto(bus, bell(523, 2.0), 6.4, 0.5);
  writeWAV(path, { rate: RATE, channels: [limit(bus)] });
  return path;
}

if (process.env.TOON_PEEK) {
  const { writePng } = await import('../lib/toon/out.mjs');
  for (const f of process.env.TOON_PEEK.split(',').map(Number)) console.log(await writePng(`${OUT}/peek/03-f${f}.png`, draw(f, f / FPS)));
  process.exit(0);
}
const wav = soundtrack(`${OUT}/03-psa-card.wav`);
console.log(await renderClip(`${OUT}/03-psa-card.mp4`, { seconds: SECONDS, draw, audio: wav, stills: [20, 60, 96, 112, 150, 190], stillDir: `${OUT}/stills/03` }));
