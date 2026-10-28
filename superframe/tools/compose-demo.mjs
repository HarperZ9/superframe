// compose-demo.mjs: demo plates at 3840 px wide. Three synthetic scenes (a corridor with a planted subject, a rail
// track, the corridor at 200 mm framed from before its mouth), the café wall strips, and two of our own renders
// (out/refraction/bow-3840.png and out/rings/rings-3840.png), each with lines, vanishing point and axis drawn on.
//   node tools/compose-demo.mjs [out/compose]
import { writeFileSync, mkdirSync } from 'node:fs';
import { detectLines } from '../lib/compose/lines.mjs';
import { findVP } from '../lib/compose/vp.mjs';
import { wideAngle } from '../lib/compose/wide.mjs';
import { compositionAxis } from '../lib/compose/axis.mjs';
import { railScene } from '../lib/compose/scene.mjs';
import { axisScene, lensSet } from '../lib/compose/plant.mjs';
import { cafeWall, lineAngles } from '../lib/compose/cafewall.mjs';
import { scenePlate, sceneRows, cafePlate } from '../lib/compose/plate.mjs';
import { renderPlate, pngOf } from '../lib/study/render.mjs';
import { loadSubject, subjectFromRGBA } from '../lib/study/load.mjs';

const OUT = process.argv[2] ?? 'out/compose', W = 3840, H = 2160, OF = 6;
mkdirSync(OUT, { recursive: true });
const METHOD = 'Segments: level-line regions validated a contrario (number of false alarms under 1), fitted by total least squares. Vanishing point: intersections of the 60 longest segments scored by the length pointing at them (Gaussian in angle, sigma 1.5 degrees), refined by weighted least squares, and kept only if its support beats 19 sets with directions shuffled. Reach: segments grouped by polar angle round the vanishing point; a line reaches the edge when it ends within 2% of the ray to the frame edge. Depth ratio: r_max / r_min per line, equal to the ratio of depths it spans because image distance from a vanishing point goes as 1 / depth. Axis: argmax of line convergence (sigma 3 degrees) times centre-surround L* contrast, an authored product rule.';

function analyse(img, truth = null) {
  const segs = detectLines(img.rgba, img.w, img.h), wide = wideAngle(segs, img.w, img.h);
  const vpP = wide.vp ? wide.p : findVP(segs).p;
  // With no significant convergence the lines carry no axis information, so the axis is read from contrast alone.
  const axis = compositionAxis(img.rgba, img.w, img.h, wide.vp ? segs : []);
  return { segs, wide, inliers: wide.inliers ?? [], vpP, truth, axis };
}
const summary = R => ({ segments: R.segs.length, vp: R.wide.vp, vpP: R.vpP, edgeScore: R.wide.edgeScore, meanReach: R.wide.meanReach, depthRatio: R.wide.depthRatio,
  lines: R.wide.lines.length, anchor: R.axis.anchor, axisBasis: R.axis.basis, lineOnly: R.axis.lineOnly, contrastOnly: R.axis.contrastOnly, truth: R.truth && { vp: R.truth.vp, subject: R.truth.subject, depthRatio: R.truth.depthRatio } });

async function plate(spec, name) {
  const R = renderPlate(spec), path = `${OUT}/${name}`;
  writeFileSync(path, await pngOf(R)); console.log('wrote', path, R.w, 'x', R.h); return { path, w: R.w, h: R.h };
}

const results = {}, files = [];
const scenes = [
  ['01-corridor-axis.png', 'Corridor, planted subject', 'Where do the converging lines and the contrast point', () => axisScene(0, { w: W, h: H })],
  ['02-rail-track.png', 'Rail track, camera turned', 'Where do the rails meet, and do they run to the edges', () => railScene({ w: W, h: H, focalMm: 35, yaw: -7, pitch: -4 })],
  ['03-corridor-200mm.png', 'Corridor at 200 mm', 'Does a long lens framed from outside still carry lines to the edges', () => lensSet({ w: W, h: H })[1].make()],
];
let n = 1;
for (const [file, title, question, make] of scenes) {
  const sc = make(), img = { w: sc.w, h: sc.h, rgba: sc.rgba }, R = analyse(img, sc.truth);
  results[file] = summary(R);
  files.push(await plate(scenePlate({ n: n++, of: OF, title, question, subject: subjectFromRGBA(sc.w, sc.h, sc.rgba, file.replace('.png', '-scene')), img, R, rows: sceneRows(R, sc.w), method: METHOD }), file));
}

const strips = [0, 1].map(a => { const s = cafeWall(W, 960, { angleDeg: a }), segs = detectLines(s.rgba, s.w, s.h); return { planted: a, img: { w: s.w, h: s.h, rgba: s.rgba }, segs, read: lineAngles(segs) }; });
results['04-cafe-wall.png'] = strips.map(s => ({ planted: s.planted, pooled: s.read.angle, lines: s.read.lines.map(l => l.angle) }));
files.push(await plate(cafePlate({ n: n++, of: OF, subject: subjectFromRGBA(W, 960, strips[0].img.rgba, 'cafe-wall-strip'), strips,
  method: 'Tiles black and white, mortar grey, rows shifted 0, 1/4, 1/2, 1/4 of a tile; drawn by exact geometry with 16 samples per pixel. Segments within 15 degrees of the length-weighted mode are grouped by perpendicular offset; each edge line is the total-least-squares fit of its pooled pixels; the pooled reading sums the within-line scatter. The eye reads a tilt in the upper strip; the instrument reads level.' }), '04-cafe-wall.png'));

for (const [file, src, title] of [['05-own-bow.png', 'out/refraction/bow-3840.png', 'Our render: the rainbow'], ['06-own-rings.png', 'out/rings/rings-3840.png', "Our render: Newton's rings"]]) {
  const sub = loadSubject(src), img = { w: sub.w, h: sub.h, rgba: sub.rgba }, R = analyse(img);
  results[file] = { source: src, sha256: sub.sha256, ...summary(R) };
  files.push(await plate(scenePlate({ n: n++, of: OF, title, question: 'Is there any converging line structure, and where would the axis fall', subject: sub, img, R, rows: sceneRows(R, sub.w), method: METHOD }), file));
}
writeFileSync(`${OUT}/demo-results.json`, JSON.stringify({ files, results }, null, 1));
