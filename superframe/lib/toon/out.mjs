// out.mjs: files from canvases. PNG through the feed-23 encoder; motion through an ffmpeg pipe (rawvideo rgb24 in,
// H.264 out). ffmpeg is an R&D tool here, found at TOON_FFMPEG, then STACK_FFMPEG, then on PATH; the shipped
// library itself carries no encoder. Node only.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { deflateSync } from 'node:zlib';
import { spawn } from 'node:child_process';
import { encodePNG } from '../../../feed-23/build/brush/png.js';
import { bytes } from './raster.mjs';

const ensure = p => mkdirSync(dirname(p), { recursive: true });
export const FFMPEG = process.env.TOON_FFMPEG ?? process.env.STACK_FFMPEG ?? 'ffmpeg';

export async function writePng(path, K, seed = 'toon/png') {
  ensure(path);
  writeFileSync(path, await encodePNG(K.w, K.h, bytes(K, { seed, alpha: true }), b => deflateSync(b, { level: 6 })));
  return path;
}

// A movie writer: push canvases in order, then close. audio (optional) is a WAV path muxed as AAC.
export function movie(path, { w, h, fps = 24, crf = 16, audio = null } = {}) {
  ensure(path);
  const args = ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-r', String(fps), '-i', '-'];
  if (audio) args.push('-i', audio, '-c:a', 'aac', '-b:a', '192k', '-shortest');
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path);
  const ff = spawn(FFMPEG, args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => { ff.on('error', rej); ff.on('close', c => (c === 0 ? res(path) : rej(new Error(`ffmpeg exited ${c} writing ${path}`)))); });
  let n = 0;
  return {
    async push(K) {
      if (K.w !== w || K.h !== h) throw new Error(`movie: frame ${K.w}x${K.h}, expected ${w}x${h}`);
      n++; if (!ff.stdin.write(Buffer.from(bytes(K, { seed: `toon/mov/${n}` }).buffer))) await new Promise(r => ff.stdin.once('drain', r));
    },
    async close() { ff.stdin.end(); await done; return { path, frames: n }; },
  };
}
