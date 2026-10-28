// plate.mjs: demo plates in the study kit's grammar (lib/study/kit.mjs): the image, the detected segments, the
// vanishing point, the rays that test edge reach, and the composition axis drawn over it, with the readings set below.
import { INK, PAGE, masthead, methodBlock, label, num, pct } from '../study/kit.mjs';
import { measure } from '../study/type.mjs';

export const C = { line: '#4f4a5e', conv: '#62d3e3', vp: '#f4f2f8', axis: '#f0b84a', yes: '#7bd88f', no: '#ff6b6b', truth: '#c78bff' };

const cross = (ops, x, y, r, color, width) => {
  ops.push({ op: 'line', pts: [[x - r, y], [x + r, y]], width, color }, { op: 'line', pts: [[x, y - r], [x, y + r]], width, color });
};
const ring = (ops, x, y, r, color, width) => {
  const n = 48, pts = Array.from({ length: n + 1 }, (_, k) => [x + r * Math.cos(2 * Math.PI * k / n), y + r * Math.sin(2 * Math.PI * k / n)]);
  ops.push({ op: 'line', pts, width, color });
};

// Overlay for one image drawn at (X, Y) with scale s page units per pixel; clip keeps marks inside the image box.
export function overlay(ops, X, Y, s, img, R) {
  const P = ([x, y]) => [X + x * s, Y + y * s], clip = [X, Y, X + img.w * s, Y + img.h * s], inl = new Set(R.inliers ?? []);
  for (const g of R.segs) if (!inl.has(g)) ops.push({ op: 'line', pts: [P([g.x1, g.y1]), P([g.x2, g.y2])], width: 0.7, color: C.line, clip });
  for (const l of R.wide?.lines ?? []) {
    const a = l.phi * Math.PI / 180, v = R.wide.vp, e = l.rEdge ?? l.rmax;
    ops.push({ op: 'line', pts: [P([v[0] + l.rmax * Math.cos(a), v[1] + l.rmax * Math.sin(a)]), P([v[0] + e * Math.cos(a), v[1] + e * Math.sin(a)])], width: 2.2, color: l.reachesEdge ? C.yes : C.no, clip });
    if (l.reachesEdge) { const [ex, ey] = P([v[0] + e * Math.cos(a), v[1] + e * Math.sin(a)]); ops.push({ op: 'circle', cx: ex, cy: ey, r: 5, fill: C.yes }); }
  }
  for (const g of inl) ops.push({ op: 'line', pts: [P([g.x1, g.y1]), P([g.x2, g.y2])], width: 1.1, color: C.conv, clip });
  if (R.axis) {
    const [ax, ay] = P(R.axis.anchor);
    ops.push({ op: 'line', pts: [[ax, Y], [ax, Y + img.h * s]], width: 1, color: C.axis }, { op: 'line', pts: [[X, ay], [X + img.w * s, ay]], width: 1, color: C.axis });
    ring(ops, ax, ay, 9, C.axis, 2.2);
  }
  if (R.truth?.subject) { const [x, y] = P(R.truth.subject); ring(ops, x, y, 15, C.truth, 1.4); }
  if (R.wide?.vp) { const [x, y] = P(R.wide.vp); if (x >= X && x <= clip[2] && y >= Y && y <= clip[3]) { cross(ops, x, y, 14, C.vp, 1.6); ring(ops, x, y, 5, C.vp, 1.4); } }
  if (R.truth?.vp) { const [x, y] = P(R.truth.vp); if (x >= X && x <= clip[2] && y >= Y && y <= clip[3]) ring(ops, x, y, 22, C.truth, 1); }
}

const KEY = [['segment', C.line], ['points at the vanishing point', C.conv], ['reaches the edge', C.yes], ['stops short', C.no], ['axis and anchor', C.axis], ['planted answer', C.truth]];

function legend(ops, y) {
  let x = PAGE.margin;
  for (const [t, c] of KEY) { ops.push({ op: 'rect', x, y: y - 9, w: 18, h: 4, fill: c }); label(ops, x + 26, y, t, { size: 11 }); x += 26 + measure(t, 11, { style: 'mono' }) + 22; }
  return y + 30;
}

function readingRows(ops, y, rows) {
  const m = PAGE.margin, colW = (PAGE.w - 2 * m) / 3;
  rows.forEach(([k, v], i) => {
    const x = m + (i % 3) * colW, yy = y + Math.floor(i / 3) * 58;
    label(ops, x, yy, k.toUpperCase(), { size: 11, color: INK.faint });
    ops.push({ op: 'text', x, y: yy + 26, text: v, size: 18, style: 'mono', color: INK.text });
  });
  return y + Math.ceil(rows.length / 3) * 58 + 10;
}

// One plate: subject image with overlay, legend, reading rows, method text.
export function scenePlate({ n, of, title, question, subject, img, R, rows, method }) {
  const ops = [], m = PAGE.margin, width = PAGE.w - 2 * m;
  let y = masthead(ops, { n, of, criterion: 'compose', title, question, subject });
  const s = width / img.w;
  ops.push({ op: 'image', x: m, y, w: width, h: img.h * s, src: 'subject' });
  overlay(ops, m, y, s, img, R);
  y = legend(ops, y + img.h * s + 34);
  y = readingRows(ops, y + 14, rows);
  const h = methodBlock(ops, y + 10, method);
  return { id: subject.file, title, w: PAGE.w, h, ground: INK.ground, ops, images: { subject: img } };
}

// The readings for a scene, as label/value pairs.
export function sceneRows(R, w) {
  const W = R.wide, rows = [];
  rows.push(['vanishing point', W.vp ? `${num(W.vp[0], 1)}, ${num(W.vp[1], 1)} px` : W.rejected ? `none (${W.rejected})` : `none (p = ${num(R.vpP, 2)})`]);
  if (R.truth?.vp && W.vp) rows.push(['error against planted', `${pct(Math.hypot(W.vp[0] - R.truth.vp[0], W.vp[1] - R.truth.vp[1]) / w, 3)} of W`]);
  rows.push(['segments, converging', `${R.segs.length}, ${R.inliers?.length ?? 0}`]);
  if (W.vp) rows.push(['lines reach edges', `${num(W.edgeScore, 2)} of ${W.lines.length}`], ['mean reach', num(W.meanReach, 3)], ['depth ratio', R.truth?.depthRatio ? `${num(W.depthRatio, 2)} (planted ${num(R.truth.depthRatio, 2)})` : num(W.depthRatio, 2)]);
  if (R.axis) rows.push(['anchor', `${num(R.axis.anchor[0], 0)}, ${num(R.axis.anchor[1], 0)} px`], ['axis read from', R.axis.basis]);
  if (R.axis && R.truth?.subject) rows.push(['anchor to subject', `${pct(Math.hypot(R.axis.anchor[0] - R.truth.subject[0], R.axis.anchor[1] - R.truth.subject[1]) / w, 2)} of W`]);
  return rows;
}

// The café wall plate: each strip with its detected edge lines, and the angle each line reads.
export function cafePlate({ n, of, subject, strips, method }) {
  const ops = [], m = PAGE.margin, width = PAGE.w - 2 * m, images = {};
  let y = masthead(ops, { n, of, criterion: 'compose', title: 'Café wall', question: 'Do lines the eye reads as tilted measure as level', subject });
  strips.forEach((st, k) => {
    const s = width / st.img.w, key = `strip${k}`; images[key] = st.img;
    label(ops, m, y + 4, `PLANTED ${num(st.planted, 2)} DEG`, { size: 12, color: INK.signal });
    label(ops, m + width, y + 4, `READS ${num(st.read.angle, 4)} DEG POOLED`, { size: 12, color: INK.text, align: 'right' });
    y += 22;
    ops.push({ op: 'image', x: m, y, w: width, h: st.img.h * s, src: key });
    for (const g of st.segs) if (Math.abs(g.angle - st.read.mode) <= 15) ops.push({ op: 'line', pts: [[m + g.x1 * s, y + g.y1 * s], [m + g.x2 * s, y + g.y2 * s]], width: 1, color: C.conv });
    y += st.img.h * s + 26;
    const per = st.read.lines.map(l => num(l.angle, 3)).join('  ');
    ops.push({ op: 'para', x: m, y, w: width, text: `Each edge line, top to bottom: ${per}`, size: 13, lead: 19, style: 'mono', color: INK.muted });
    y += 60;
  });
  const h = methodBlock(ops, y, method);
  return { id: subject.file, title: 'Café wall', w: PAGE.w, h, ground: INK.ground, ops, images };
}
