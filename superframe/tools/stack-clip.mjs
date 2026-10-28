// stack-clip.mjs: render living-still clips to H.264 and read each one back with the decompose motion lens (PREREG P5).
//   node tools/stack-clip.mjs [--only name]      clips and lens readings land in out/stack/clips/
// ffmpeg: STACK_FFMPEG, else ffmpeg on PATH. Lens: the decompose package at SUPERFRAME_DECOMPOSE, run with the Python
// at SUPERFRAME_PY (else python on PATH). The decompose lens is not part of this repository.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { livingStill, uniqueRate } from '../lib/stack/still.mjs';
import { gable, rain } from './stack-scenes.mjs';

const FFMPEG = process.env.STACK_FFMPEG ?? 'ffmpeg';
const PY = process.env.SUPERFRAME_PY ?? 'python';
const DR = process.env.SUPERFRAME_DECOMPOSE ?? '';
const OUT = 'out/stack/clips', FPS = 30;

export const CLIPS = [
  { name: 'still-twos-720', W: 1280, H: 720, s: 10, o: { hold: 2 } },
  { name: 'still-ones-720', W: 1280, H: 720, s: 10, o: { hold: 1 } },
  { name: 'still-threes-720', W: 1280, H: 720, s: 10, o: { hold: 3 } },
  { name: 'still-frozen-720', W: 1280, H: 720, s: 10, o: { hold: 2, grain: 0 } },
  { name: 'still-twos-rain-720', W: 1280, H: 720, s: 10, o: { hold: 2 }, rain: true },
  { name: 'still-twos-2160', W: 3840, H: 2160, s: 6, o: { hold: 2 } },
  { name: 'still-twos-rain-2160', W: 3840, H: 2160, s: 6, o: { hold: 2, cell: 6 }, rain: true },
];

async function encode(path, src, W, H, count) {
  const ff = spawn(FFMPEG, ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', path], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c} on ${path}`)))));
  for (let n = 0; n < count; n++) { if (!ff.stdin.write(Buffer.from(src(n).b.buffer))) await new Promise(r => ff.stdin.once('drain', r)); }
  ff.stdin.end(); return done;
}

function lens(path) {
  const code = `import sys, json; sys.path.insert(0, ${JSON.stringify(DR)}); from dr import d_motion; d = d_motion.extract(sys.argv[1]); print(json.dumps({k: d[k] for k in ("fps", "frames", "cadence", "boil", "flow")}))`;
  const r = spawnSync(PY, ['-I', '-c', code, path], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) { console.error(`lens failed on ${path}:\n${r.stderr}`); return { error: r.stderr.slice(-400) }; }
  return JSON.parse(r.stdout.trim().split('\n').pop());
}

export async function runClip(c) {
  const F = gable(c.W, c.H), src = livingStill(F, { N: 400, cell: 2, levels: 32, seed: c.name, ...c.o, movers: c.rain ? rain(c.W, c.H, { hold: c.o.hold }) : null });
  const count = c.s * FPS, path = `${OUT}/${c.name}.mp4`;
  const counter = uniqueRate(src, Math.min(count, 61), FPS);
  await encode(path, src, c.W, c.H, count);
  const L = lens(path);
  return { name: c.name, size: [c.W, c.H], seconds: c.s, hold: c.o.hold, grain: c.o.grain ?? 1, rain: !!c.rain, counterHz: counter, lens: L };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  mkdirSync(OUT, { recursive: true });
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null, rows = [];
  for (const c of CLIPS) { if (only && c.name !== only) continue; const r = await runClip(c); rows.push(r); console.log(JSON.stringify(r)); }
  writeFileSync(`${OUT}/lens${only ? '-' + only : ''}.json`, JSON.stringify({ date: '2026-10-28', rows }, null, 1));
}
