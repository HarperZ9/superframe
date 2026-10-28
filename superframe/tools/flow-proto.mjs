// tools/flow-proto.mjs: the FLOW prototype's deliverables. Typed words, oil, heat from below and wind across the top,
// in one tank of water and air. Writes a 4K still, a 1280 x 720 loop (PNG frames and an MP4), the analysis views
// (exploded sheets, depth planes, mosaic by law, elements and mediums, flow ribbons), every sheet as data, and a
// core sample. Output goes to out/flow/proto (OUT env to change); ffmpeg is FFMPEG, else ffmpeg on PATH.
//   node tools/flow-proto.mjs [words]
import { writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tank, loop, exportSheets } from '../lib/medium/index.mjs';
import { writePNG, pngBytes } from '../lib/export.mjs';

const OUT = process.env.OUT ?? 'out/flow/proto', words = process.argv[2] ?? 'flow', FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
mkdirSync(`${OUT}/loop`, { recursive: true });
const t0 = performance.now(), log = (...a) => console.log(`${((performance.now() - t0) / 1000).toFixed(1)}s`, ...a);

// the still: the moment the words have just broken into filaments under the first waves
const m = tank(words); m.run(4);
await writePNG(`${OUT}/still-4k.png`, m.render(3840, 2160), { seed: 'still' }); log('4K still');
await writePNG(`${OUT}/still-1080.png`, m.render(1920, 1080), { seed: 'still' });
// the readings of the same moment
const living = m.render(960, 540);
await writePNG(`${OUT}/view-exploded.png`, m.view({ W: 1920, H: 1080, mode: 'exploded', layers: ['temperature', 'pigment', 'oil', 'advection', 'buoyancy', 'colourTemperature'], living }).raster, {});
await writePNG(`${OUT}/view-planes.png`, m.view({ W: 1920, H: 1080, layers: 'planes', living }).raster, {});
for (const axis of ['laws', 'elements', 'mediums', 'temperature']) await writePNG(`${OUT}/view-mosaic-${axis}.png`, m.view({ W: 1920, H: 1080, mosaic: { axis, tileSize: 1, maxTile: 16 } }).raster, {});
await writePNG(`${OUT}/view-stack.png`, m.view({ W: 1920, H: 1080, layers: ['salt', 'temperature', 'pigment', 'oil', 'sediment', 'smoke'] }).raster, {});
await writePNG(`${OUT}/view-ribbons.png`, m.view({ W: 1920, H: 1080, mosaic: { axis: 'speed', ribbons: true } }).raster, {});
writeFileSync(`${OUT}/sheets.json`, JSON.stringify(exportSheets(m).map(s => ({ ...s, values: Array.from(s.values, v => +v.toFixed(4)) }))));
writeFileSync(`${OUT}/core-sample.json`, JSON.stringify([m.core(0.4, 0.5), m.core(0.62, 0.8), m.core(0.5, 0.31), m.core(0.24, 0.93)], null, 1));
writeFileSync(`${OUT}/additives.json`, JSON.stringify(m.log, null, 1));
log('views');

// later: the words have reached the salt layer and spread along it; the ribbon has been carried across the plume
const late = tank(words); late.run(10);
await writePNG(`${OUT}/still-late-4k.png`, late.render(3840, 2160), { seed: 'late' });
await writePNG(`${OUT}/view-late-exploded.png`, late.view({ W: 1920, H: 1080, mode: 'exploded', layers: ['salt', 'pigment', 'temperature', 'smoke', 'buoyancy'], living: late.render(960, 540) }).raster, {});
log('late still');

// the loop: 4 s at 12 fps from t = 1.0, closing on itself
const L = loop(words, { t0: 1, seconds: 4, fps: 12, W: 1280, H: 720 });
for (let i = 0; i < L.motion.frames.length; i++) writeFileSync(`${OUT}/loop/f${String(i).padStart(3, '0')}.png`, await pngBytes({ w: 1280, h: 720, data: L.motion.frames[i] }, { seed: `loop/${i}` }));
log('loop frames', L.motion.frames.length);
const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', '12', '-i', `${OUT}/loop/f%03d.png`, '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', `${OUT}/loop.mp4`]);
log(r.status === 0 ? 'loop.mp4' : `ffmpeg failed: ${String(r.stderr).slice(0, 200)}`);
