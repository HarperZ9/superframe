// tools/loops.mjs: render a transfer loop as a clip and save BLEED section 13's checks beside it. Per frame: the
// mean weight in the target element, the spread of weights across the item's ticks (a crossfade has none), the share
// of ticks mid-change, the front's centroid and the change per step; then whether it settled.
//   node tools/loops.mjs <loop> [seconds] [fps] [width] [--no-ca]      (OUT env: output folder, default on E:)
import { writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loopTank, LOOPS } from '../lib/medium/loops.mjs';
import { measure } from '../lib/medium/ticks.mjs';
import { pngBytes } from '../lib/export.mjs';
import { LOOK, render } from '../lib/medium/render.mjs';

const args = process.argv.slice(2).filter(a => !a.startsWith('--')), noCA = process.argv.includes('--no-ca');
const name = args[0], P = LOOPS[name], seconds = +(args[1] ?? P.seconds), fps = +(args[2] ?? 24), W = +(args[3] ?? 960), H = Math.round(W * 9 / 16);
const OUT = process.env.OUT ?? `out/flow/loops/${name}${noCA ? '-noca' : ''}`;
mkdirSync(`${OUT}/f`, { recursive: true });
const m = loopTank(name, { ca: !noCA }), look = { ...LOOK, wall: '#e9dcc0', sigma: [2.8, 1.0, 0.72], warm: '#dcc996' }, it = m.items[0], rows = [];
let prev = null; const n = Math.round(seconds * fps), T = performance.now();
for (let i = 0; i < n; i++) {
  const r = measure(it, it.elements.length - 1, prev); prev = r.snapshot; delete r.snapshot;
  rows.push({ frame: i, t: +m.time.toFixed(3), ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Array.isArray(v) ? v.map(x => +x.toFixed(2)) : v == null ? v : +v.toFixed(4)])) });
  writeFileSync(`${OUT}/f/f${String(i).padStart(4, '0')}.png`, await pngBytes(render(m, W, H, { look, view: P.view, seed: `loop/${i}` }), { seed: `loop/${i}` }));
  m.run(1 / fps);
  if (i % 48 === 0) console.log(name, i, `${((performance.now() - T) / 1000).toFixed(0)}s`, `mean ${r.mean.toFixed(2)} spread ${r.spread.toFixed(2)}`);
}
// the summary: peak spread mid-transition, the largest frame-to-frame jump of the front, and settling at the end
const mid = rows.filter(r => r.mean > 0.2 && r.mean < 0.8), jumps = rows.slice(1).map((r, i) => (r.frontAt && rows[i].frontAt ? Math.hypot(r.frontAt[0] - rows[i].frontAt[0], r.frontAt[1] - rows[i].frontAt[1]) : 0));
const tail = rows.slice(-Math.round(fps / 2)), summary = {
  loop: name, ca: !noCA, frames: n, fps, ticks: it.ticks.length,
  peak_spread: Math.max(...rows.map(r => r.spread)), mid_spread_mean: mid.length ? mid.reduce((a, r) => a + r.spread, 0) / mid.length : null,
  front_max_jump_cells: Math.max(0, ...jumps), front_median_jump_cells: jumps.sort((a, b) => a - b)[jumps.length >> 1] ?? 0,
  end_mean: rows.at(-1).mean, end_spread: rows.at(-1).spread, end_change_per_step: tail.reduce((a, r) => a + r.change, 0) / tail.length,
};
summary.settled = summary.end_spread < 0.05 && summary.end_change_per_step < 0.002;
writeFileSync(`${OUT}/checks.json`, JSON.stringify({ summary, frames: rows }, null, 1));
const FF = process.env.FFMPEG ?? 'ffmpeg';
spawnSync(FF, ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', `${OUT}/f/f%04d.png`, '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', `${OUT}/${name}.mp4`]);
console.log(JSON.stringify(summary));
