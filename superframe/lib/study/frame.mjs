// frame.mjs: the study frame, six fields declared before any measurement (author, 2026-10-28: "If you can identify
// the perspective, the intent, the need, the criteria, and the objective, and the object of observation, you can
// digest anything."). The caller supplies them; each criterion offers defaults. The studier's intent is declared;
// a maker's intent is only ever an inference, so it is stored with status 'inferred' and never as a measurement.
import { INK, PAGE, masthead, methodBlock } from './kit.mjs';
import { paraLines } from './render.mjs';

export const FIELDS = ['object', 'perspective', 'need', 'objective', 'criteria', 'intent'];

export function makeFrame(subject, criteria, given = {}) {
  const d = Object.assign({}, ...criteria.map(c => c.frameDefaults?.(subject) ?? {}));
  const f = { ...d, ...Object.fromEntries(Object.entries(given).filter(([, v]) => v !== undefined && v !== null)) };
  f.object ??= `${subject.file}, ${subject.w} x ${subject.h} px`;
  f.perspective ??= 'the image as stored, read as sRGB';
  f.need ??= 'unstated';
  f.objective ??= 'unstated';
  f.criteria ??= criteria.map(c => c.id).join(', ');
  const intent = typeof f.intent === 'object' && f.intent ? f.intent : { studier: f.intent ?? 'unstated' };
  intent.studier_status = 'declared';
  if (intent.maker !== undefined && intent.maker !== null) intent.maker_status = 'inferred';
  else { intent.maker = null; intent.maker_status = 'not inferred by this study'; }
  f.intent = intent;
  return Object.fromEntries(FIELDS.map(k => [k, f[k]]));
}

const intentText = i => `Studier (declared): ${i.studier}` + (i.maker ? `. Maker (inferred, not measured): ${i.maker}` : '. Maker: not inferred by this study.');

export function coverPlate(frame, subject, { of, plates }) {
  const ops = [], { margin: m, w } = PAGE, width = w - 2 * m;
  let y = masthead(ops, { n: 1, of, criterion: 'study', title: 'The frame', question: 'What is observed, from where, for whom, toward what, by which criteria, with what intent', subject });
  const ar = subject.h / subject.w, iw = Math.min(width, 640 / ar), ih = iw * ar;
  ops.push({ op: 'image', x: m, y, w: iw, h: ih, src: 'subject' });
  y += ih + 50;
  const keyW = 170;
  for (const k of FIELDS) {
    const v = k === 'intent' ? intentText(frame.intent) : String(frame[k]);
    ops.push({ op: 'text', x: m, y: y + 4, text: k.toUpperCase(), size: 13, style: 'mono', color: INK.signal, track: 80 });
    ops.push({ op: 'para', x: m + keyW, y: y + 4, w: width - keyW, text: v, size: 19, lead: 27, color: INK.text });
    y += Math.max(1, paraLines(v, 19, width - keyW, {})) * 27 + 26;
  }
  y += 10;
  ops.push({ op: 'text', x: m, y: y + 4, text: 'PLATES', size: 13, style: 'mono', color: INK.signal, track: 80 });
  plates.forEach((p, k) => {
    const col = k % 2, row = Math.floor(k / 2);
    ops.push({ op: 'text', x: m + keyW + col * 345, y: y + 4 + row * 26, text: `${String(k + 2).padStart(2, '0')}  ${p}`, size: 15, color: INK.muted });
  });
  y += Math.ceil(plates.length / 2) * 26 + 40;
  const h = methodBlock(ops, y, 'The six fields are declared by the caller before any measurement and stored as the frame block of study.json. Intent belongs to the studier and is declared; any reading of what a maker meant is an inference and is labelled so. The subject is identified by the SHA-256 of its file.');
  return { id: 'frame', title: 'The frame', w, h, ground: INK.ground, ops };
}
