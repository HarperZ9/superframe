// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// seattle-render.mjs: render the Seattle night scenes to looping GIFs, stills, contact sheets and 4K video.
//   node tools/seattle-render.mjs <car|porch|trees> [--variant sodium|incandescent] [--size 320x180]
//        [--mode sheet|loop|video|all] [--out out/seattle-rain] [--T 12] [--fps 12] [--video-seconds 48]
// The 4K video is the pixel frames scaled by a whole number with nearest-neighbour (ffmpeg -sws_flags neighbor), so
// one pixel-art pixel is an exact k x k block. ffmpeg comes from SEATTLE_FFMPEG, else ffmpeg on the PATH.
import { writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import { encodePNG } from '../../feed-23/build/brush/png.js';
import { scene } from '../lib/seattle/scenes.mjs';
import { shoot, sheet, rgbaOf, upscaleRGBA } from '../lib/seattle/film.mjs';
import { encodeGIF } from '../lib/seattle/gif.mjs';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const name = args[0] ?? 'car', variant = opt('variant', 'sodium'), [W, H] = opt('size', '320x180').split('x').map(Number);
const mode = opt('mode', 'sheet'), OUT = opt('out', 'out/seattle-rain'), T = +opt('T', 12), fps = +opt('fps', 12);
const tag = `${name}-${variant}-${W}x${H}`;
const png = async (path, w, h, rgba) => { writeFileSync(path, await encodePNG(w, h, rgba, b => deflateSync(b, { level: 9 }))); console.log('wrote', path); };
const log = (k, n) => { if (k % 24 === 0) process.stdout.write(`  frame ${k}/${n}\r`); };

async function loop() {
  const sc = await scene(name, { W, H, variant, loop: true, T }), frames = Math.round(T * fps), fade = Math.round(1.5 * fps);
  const film = shoot(sc, { frames, fps, fade, onFrame: log });
  const scale = Math.floor(960 / W);
  for (const k of [1, scale]) {
    const p = `${OUT}/gif/${tag}${k > 1 ? `-x${k}` : ''}.gif`;
    writeFileSync(p, encodeGIF({ w: W, h: H, palette: film.palette, frames: film.index, delay: Math.round(100 / fps), scale: k })); console.log('wrote', p);
  }
  for (const k of [0, Math.floor(frames / 3), Math.floor((2 * frames) / 3)]) await png(`${OUT}/stills/${tag}-f${String(k).padStart(3, '0')}-x${scale}.png`, W * scale, H * scale, upscaleRGBA(rgbaOf(film, k), W, H, scale));
  writeFileSync(`${OUT}/stills/${tag}-palette.json`, JSON.stringify({ hexes: film.hexes, meanDE00at60ppd: film.de }, null, 1));
  console.log('palette', film.hexes.length, 'colours; eye-filtered mean dE00 at 60 ppd:', film.de);
}

async function video() {
  const secs = +opt('video-seconds', 48), sc = await scene(name, { W, H, variant, loop: false, T: secs });
  const film = shoot(sc, { frames: Math.round(secs * fps), fps, onFrame: log }), k = Math.floor(3840 / W);
  const p = `${OUT}/video/${tag}-4k.mp4`, ff = process.env.SEATTLE_FFMPEG ?? 'ffmpeg';
  const proc = spawn(ff, ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-',
    '-vf', `scale=${W * k}:${H * k}:flags=neighbor`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-tune', 'animation',
    '-pix_fmt', 'yuv420p', '-r', '24', '-movflags', '+faststart', p], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => proc.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));
  for (let i = 0; i < film.index.length; i++) if (!proc.stdin.write(Buffer.from(rgbaOf(film, i).buffer))) await new Promise(r => proc.stdin.once('drain', r));
  proc.stdin.end(); await done; console.log('wrote', p);
}

async function contact() {
  const sc = await scene(name, { W, H, variant, loop: true, T }), frames = Math.round(T * fps);
  const film = shoot(sc, { frames, fps, onFrame: log }), picks = Array.from({ length: 6 }, (_, i) => Math.floor((i * frames) / 6) + 4 * i) .map(k => Math.min(frames - 1, k));
  const s = sheet(film, picks, 2);
  await png(`out/seattle-probe/${tag}-sheet.png`, s.w * 2, s.h * 2, upscaleRGBA(s.rgba, s.w, s.h, 2));
  console.log('palette', film.hexes.length, 'mean dE00', film.de);
}

for (const d of ['gif', 'stills', 'video']) mkdirSync(`${OUT}/${d}`, { recursive: true });
mkdirSync('out/seattle-probe', { recursive: true });
if (mode === 'sheet') await contact();
if (mode === 'loop' || mode === 'all') await loop();
if (mode === 'video' || mode === 'all') await video();
