#!/usr/bin/env node
// study.mjs: make a study of any image. Prints the study.json path on stdout (and nothing else), so Python and
// Flywheel can call it as a subprocess; progress and errors go to stderr.
//   node tools/study.mjs <subject> [--criteria colour] [--out DIR] [--width 3840] [--k 10] [--seed S] [--no-plates]
//        [--object T] [--perspective T] [--need T] [--objective T] [--intent T] [--maker-intent T]
import { resolve, dirname, basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runStudy } from '../lib/study/run.mjs';
import { writeViewer } from '../lib/study/viewer.mjs';

const args = process.argv.slice(2), subject = args.find((a, i) => !a.startsWith('--') && !(i && args[i - 1].startsWith('--') && !['--no-plates'].includes(args[i - 1])));
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
if (!subject) { console.error('usage: node tools/study.mjs <subject> [--criteria colour] [--out DIR] [--width 3840] [--no-plates]'); process.exit(2); }
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(opt('out', join(root, 'out', 'study', basename(subject, extname(subject)))));
const frame = { object: opt('object'), perspective: opt('perspective'), need: opt('need'), objective: opt('objective') };
if (opt('intent') || opt('maker-intent')) frame.intent = { studier: opt('intent', 'unstated'), maker: opt('maker-intent', null) };
try {
  const t0 = Date.now();
  const r = await runStudy({ subject: resolve(subject), criteria: opt('criteria', 'colour').split(','), out, frame, width: +opt('width', 3840), render: !args.includes('--no-plates'),
    options: { colour: { k: +opt('k', 10), seed: opt('seed', 'study/palette') } } });
  await writeViewer(out, r);
  console.error(`study: ${r.study.plates.length} plates, ${((Date.now() - t0) / 1000).toFixed(1)} s, receipt ${r.study.receipt_sha256.slice(0, 16)}`);
  console.log(r.path);
} catch (e) { console.error(`study: failed: ${e.stack ?? e}`); process.exit(1); }
