// run.mjs: a study run. A subject (any image file, or pixels) plus a list of criteria gives study.json and one PNG
// per plate. study.json is canonical JSON v2 (superstack v0.2.0: sorted keys, no whitespace, positional numbers),
// sealed with receipt_sha256 over every other field, so Python (decompose dr/canon.py) and Flywheel can check a
// study without Node. Every float is rounded to 6 places first, as canon.plain() does, so a Python round trip of
// the file reproduces the same bytes.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { canonical } from '../../../substrate/lib/vendor/superstack.mjs';
import { loadSubject } from './load.mjs';
import { makeFrame, coverPlate } from './frame.mjs';
import { renderPlate, pngOf, MIN_WIDTH } from './render.mjs';
import { colour } from './colour.mjs';
import { SEED_RULE } from '../seed.mjs';

export const CRITERIA = { colour };
export const SCHEMA = 'superframe.study/1';
const hash = b => createHash('sha256').update(b).digest('hex');

// Plain JSON values with floats rounded to 6 places and -0 made 0; typed arrays become lists; undefined dropped.
export function plain(v) {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'number') { if (!Number.isFinite(v)) return null; const r = Math.round(v * 1e6) / 1e6; return Object.is(r, -0) ? 0 : r; }
  if (ArrayBuffer.isView(v)) return [...v].map(plain);
  if (Array.isArray(v)) return v.map(x => (x === undefined ? null : plain(x)));
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, plain(x)]));
  throw new TypeError(`study: cannot write a ${typeof v}`);
}
export const seal = body => { const b = plain(body); delete b.receipt_sha256; return { ...b, receipt_sha256: hash(Buffer.from(canonical(b), 'utf8')) }; };
export const studyBytes = rec => Buffer.from(canonical(rec), 'utf8');

// Preview copy of the subject for plates: area-averaged to at most `max` px on the long side.
function preview(S, max = 1800) {
  const f = Math.max(1, Math.max(S.w, S.h) / max); if (f === 1) return { w: S.w, h: S.h, rgba: S.rgba };
  const w = Math.round(S.w / f), h = Math.round(S.h / f), out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ya = Math.floor(y * S.h / h), yb = Math.max(ya + 1, Math.floor((y + 1) * S.h / h)), xa = Math.floor(x * S.w / w), xb = Math.max(xa + 1, Math.floor((x + 1) * S.w / w));
    const acc = [0, 0, 0, 0]; for (let j = ya; j < yb; j++) for (let i = xa; i < xb; i++) for (let c = 0; c < 4; c++) acc[c] += S.rgba[4 * (j * S.w + i) + c];
    const n = (yb - ya) * (xb - xa); for (let c = 0; c < 4; c++) out[4 * (y * w + x) + c] = Math.round(acc[c] / n);
  }
  return { w, h, rgba: out };
}

export async function runStudy({ subject: subjectPath, pixels = null, criteria = ['colour'], out = null, frame = {}, width = MIN_WIDTH, render = true, options = {} }) {
  const S = pixels ?? loadSubject(subjectPath), crits = criteria.map(id => { const c = CRITERIA[id]; if (!c) throw new Error(`study: unknown criterion ${id} (known: ${Object.keys(CRITERIA).join(', ')})`); return c; });
  const F = makeFrame(S, crits, frame), measured = {}, specs = [];
  for (const c of crits) measured[c.id] = c.measure(S, options[c.id] ?? {});
  const of = 1 + crits.reduce((a, c) => a + c.plateTitles.length, 0);
  let n = 2; const all = [];
  for (const c of crits) { const ps = c.plates(measured[c.id], S, { first: n, of }); ps.forEach(p => (p.criterion = c.id)); all.push(...ps); n += ps.length; }
  const cover = coverPlate(F, S, { of, plates: all.map(p => p.title) }); cover.criterion = 'study';
  specs.push(cover, ...all);
  const thumb = preview(S);
  for (const p of specs) p.images = { ...(p.images ?? {}), subject: thumb };
  const plates = [];
  if (out) mkdirSync(out, { recursive: true });
  for (const p of specs) {
    const rec = { id: p.id, criterion: p.criterion, title: p.title, file: `${p.id}.png` };
    if (render) {
      const R = renderPlate(p, { width }), bytes = Buffer.from(await pngOf(R));
      Object.assign(rec, { w: R.w, h: R.h, png_sha256: hash(bytes) });
      if (out) writeFileSync(join(out, rec.file), bytes);
    }
    plates.push(rec);
  }
  const body = {
    schema: SCHEMA,
    frame: F,
    subject: { file: S.file, sha256: S.sha256, w: S.w, h: S.h, decoder: S.decoder },
    tool: { name: 'superframe study', seed_rule: SEED_RULE, canonical_json: 'superstack canonical JSON v2', float_places: 6, plate_width: render ? width : null },
    criteria: measured,
    plates,
  };
  const rec = seal(body), bytes = studyBytes(rec);
  if (out) writeFileSync(join(out, 'study.json'), bytes);
  return { study: rec, bytes, specs, subject: S, measured, path: out ? join(out, "study.json") : null };
}
