// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// wordmark.mjs: render the six CMMNS wordmark directions (lib/wordmark) to files, in worker threads.
//   node tools/wordmark.mjs assets <id|all> [--jobs 3]   4K still, reduced-motion still, 200% crop, icons, recipe
//   node tools/wordmark.mjs loop <id|all> [--jobs 6]     4K frames to the render root, then an H.264 MP4
//   node tools/wordmark.mjs sheet                        the comparison sheet from the files already written
// Small files go to OUT (out/wordmark, or WORDMARK_OUT), frames and video to RENDERS (out/wordmark-renders, or
// CMMNS_RENDERS). The loop needs ffmpeg on PATH, or its path in FFMPEG.
// Every PNG is 8-bit sRGB with a seeded TPDF dither, so the same seed and sources give the same bytes.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
export const OUT = process.env.WORDMARK_OUT ?? resolve(root, '../out/wordmark');
export const RENDERS = process.env.CMMNS_RENDERS ?? resolve(root, '../out/wordmark-renders');
export const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const W = 3840, H = 2160;
const sha = buf => createHash('sha256').update(buf).digest('hex');
const lib = async () => import('../lib/wordmark/index.mjs');
const imgLib = async () => import('../../name-art/lib/img.mjs');
const dirName = D => `${D.meta.n}-${D.meta.id}`;

// Write a picture as PNG and return { file, w, h, sha256 } (the bytes are read back for the hash).
async function save(I, path, seed) {
  const { savePNG } = await imgLib(); savePNG(I, path, seed);
  return { file: path.split(/[\\/]/).pop(), w: I.w, h: I.h, sha256: sha(readFileSync(path)) };
}
function sources() {
  const d = join(root, 'lib/wordmark'), out = {};
  for (const f of readdirSync(d).filter(f => f.endsWith('.mjs')).sort()) out[`lib/wordmark/${f}`] = sha(readFileSync(join(d, f)));
  return out;
}

// One direction's still assets and recipe.
async function assets(id) {
  const L = await lib(), D = L.byId(id), dir = join(OUT, dirName(D)), seed = L.SEED, outputs = [];
  mkdirSync(dir, { recursive: true });
  const still = await L.renderDirection(id, W, H, { mode: 'still', seed });
  outputs.push(await save(still.image, join(dir, `still-${W}x${H}.png`), `${seed}/${D.meta.id}/still`));
  const C = (await import('../lib/wordmark/sheet.mjs')).crop200(still.image, ...(D.meta.crop ?? [0.3, 0.5]));
  outputs.push(await save(C.image, join(dir, 'crop-200pct.png'), `${seed}/${D.meta.id}/crop`));
  const reduced = await L.renderDirection(id, W, H, { mode: 'reduced', seed });
  outputs.push(await save(reduced.image, join(dir, `reduced-motion-${W}x${H}.png`), `${seed}/${D.meta.id}/reduced`));
  for (const layout of ['square', 'strip']) for (const s of L.ICON_SIZES) {
    const ic = L.renderIcon(id, layout, s, { seed });
    outputs.push(await save(ic.image, join(dir, `icon-${layout}-${s}.png`), `${seed}/${D.meta.id}/icon/${layout}/${s}`));
  }
  const recipe = { direction: D.meta.n, id: D.meta.id, title: D.meta.title, text: still.text, spoken: still.spoken, seed, seed_rule: 'xmur3-mulberry32/1 (lib/seed.mjs)',
    reproduce: [`node tools/wordmark.mjs assets ${D.meta.id}`, `node tools/wordmark.mjs loop ${D.meta.id}`], technique: D.meta.technique,
    phases: { still: D.meta.still, reduced: D.meta.reduced, loop: D.meta.loop }, crop_region_px: C.region, node: process.version, sources: sources(), outputs, data: still.data };
  writeFileSync(join(dir, 'recipe.json'), JSON.stringify(recipe, null, 1));
  return `${dirName(D)}: ${outputs.length} files`;
}

// Loop frames for one direction: frame k of n at phase k / n, skipping frames already on disk (resumable).
async function frame({ id, k, n, path }) {
  const L = await lib(), r = await L.renderDirection(id, W, H, { mode: 'frame', t: k / n });
  const { savePNG } = await imgLib(); savePNG(r.image, path, `${L.SEED}/${id}/frame`);
  return `${id} f${k}`;
}

if (!isMainThread) {
  const task = workerData, run = task.kind === 'assets' ? assets(task.id) : frame(task);
  run.then(m => parentPort.postMessage(m)).catch(e => { console.error(`wordmark worker ${task.id}: ${e.stack}`); process.exit(1); });
} else if (process.argv[1] === fileURLToPath(import.meta.url)) await main();

async function pool(tasks, jobs) {
  let next = 0, done = 0, failed = 0;
  await new Promise(res => {
    if (!tasks.length) return res();
    const spawn = () => {
      if (next >= tasks.length) return;
      const task = tasks[next++], wk = new Worker(fileURLToPath(import.meta.url), { workerData: task, resourceLimits: { maxOldGenerationSizeMb: 8192 } });
      wk.on('message', m => console.log(m));
      wk.on('error', e => console.error(`${task.id}: ${e.stack}`));
      wk.on('exit', code => { if (code) { failed++; console.error(`${task.id}: worker exited ${code}`); } if (++done === tasks.length) res(); else spawn(); });
    };
    for (let j = 0; j < Math.min(jobs, tasks.length); j++) spawn();
  });
  if (failed) throw new Error(`wordmark: ${failed} task(s) failed`);
}

function encode(dir, fps, out) {
  execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, 'f%04d.png'), '-c:v', 'libx264', '-preset', 'slow', '-tune', 'grain', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  return { file: out, bytes: readFileSync(out).length, sha256: sha(readFileSync(out)) };
}

async function loops(which, jobs) {
  const L = await lib(), Ds = which === 'all' ? L.DIRECTIONS : [L.byId(which)];
  for (const D of Ds) {
    const n = Math.round(D.meta.loop.seconds * D.meta.loop.fps), dir = join(RENDERS, 'frames', dirName(D)); mkdirSync(dir, { recursive: true });
    const tasks = []; for (let k = 0; k < n; k++) { const path = join(dir, `f${String(k).padStart(4, '0')}.png`); if (!existsSync(path)) tasks.push({ kind: 'frame', id: D.meta.id, k, n, path }); }
    await pool(tasks, jobs);
    const v = encode(dir, D.meta.loop.fps, join(RENDERS, `${dirName(D)}-loop-${W}x${H}.mp4`));
    const rp = join(OUT, dirName(D), 'recipe.json');
    if (existsSync(rp)) { const R = JSON.parse(readFileSync(rp, 'utf8')); R.loop = { frames: n, fps: D.meta.loop.fps, size: [W, H], encoder: 'ffmpeg libx264 preset slow, tune grain, CRF 16, yuv420p', ...v }; writeFileSync(rp, JSON.stringify(R, null, 1)); }
    console.log(`${dirName(D)}: ${n} frames -> ${v.file} (${(v.bytes / 1e6).toFixed(1)} MB)`);
  }
}

async function sheet() {
  const L = await lib(), S = await import('../lib/wordmark/sheet.mjs'), { loadPNG } = await imgLib();
  const titles = L.DIRECTIONS.map(D => `${D.meta.n}  ${D.meta.title}`);
  const stills = L.DIRECTIONS.map(D => loadPNG(join(OUT, dirName(D), `still-${W}x${H}.png`)));
  const rows = L.DIRECTIONS.map(D => ({ square: L.ICON_SIZES.map(s => loadPNG(join(OUT, dirName(D), `icon-square-${s}.png`))), strip: L.ICON_SIZES.map(s => loadPNG(join(OUT, dirName(D), `icon-strip-${s}.png`))) }));
  const A = S.stillsPanel(stills, titles), B = S.iconsPanel(rows, titles);
  const out = [await save(S.stack(A, B), join(OUT, 'compare-sheet.png'), 'cmmns/sheet'), await save(A, join(OUT, 'compare-stills-3840x2160.png'), 'cmmns/sheet/a'), await save(B, join(OUT, 'compare-icons-3840x2160.png'), 'cmmns/sheet/b')];
  console.log(out.map(o => `${o.file} ${o.w}x${o.h}`).join('\n'));
}

async function main() {
  const [mode, which = 'all', ...rest] = process.argv.slice(2), arg = (k, d) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : d; };
  if (mode === 'assets') { const L = await lib(); await pool((which === 'all' ? L.DIRECTIONS : [L.byId(which)]).map(D => ({ kind: 'assets', id: D.meta.id })), Number(arg('jobs', 3))); }
  else if (mode === 'loop') await loops(which, Number(arg('jobs', 6)));
  else if (mode === 'sheet') await sheet();
  else { console.error('usage: node tools/wordmark.mjs assets|loop <id|all> | sheet'); process.exit(2); }
}
